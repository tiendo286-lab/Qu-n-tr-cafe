-- Bước 159 (19/11/2026, anh Tiến chốt): KHÁCH TRẢ NỢ MỘT LẦN, ĐỦ CẢ KHOẢN + ghi rõ ngày / ca trả ở mọi chỗ có khách nợ.
-- Khách đưa thiếu (nợ 100.000, đưa 60.000): khoản cũ đóng ĐỦ 100.000, thêm nợ mới 40.000 (rest_of = khoản cũ) —
--   phiếu chốt ca: nợ mới nằm trong chính ca đó (TM → 'muon' trừ két, CK → 'ck' trừ hotline);
--   ngoài ca (Công nợ / Sổ thu chi): nợ mới quản lý ghi, tiền đưa từ quỹ (fund_out = 1) — quỹ +100.000 thu nợ, −40.000 cho nợ.
-- Bỏ trả → nợ mới (còn mở) tự xoá; nợ mới đã trả thì phải bỏ trả nó trước. Không còn tách khoản (split_from) — trigger chặn mọi đường cũ.
-- Gán nợ ở phiếu chênh lệch: két dư phải đủ cả khoản. Thiết kế: tai_lieu/superpowers/specs/2026-11-19-tra-no-mot-lan-design.md.
-- Bài thử: kiem_tra/tra_no_mot_lan_142.sql. Chạy lại nhiều lần không sao.

alter table public.shift_debts add column if not exists rest_of bigint references public.shift_debts(id) on delete set null;
create index if not exists shift_debts_rest_of on public.shift_debts(rest_of) where rest_of is not null;

-- 1. Không tách khoản nữa
create or replace function public.app__debt_no_split() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.split_from is not null then
    raise exception 'Khách phải trả đủ cả khoản nợ — đưa thiếu thì ghi phần còn thiếu thành nợ mới.';
  end if;
  return NEW;
end $$;
drop trigger if exists debt_no_split on public.shift_debts;
create trigger debt_no_split before insert on public.shift_debts for each row execute function public.app__debt_no_split();

-- 2. Bỏ trả khoản cũ → xoá nợ mới (phần còn thiếu) nếu chưa ai trả
create or replace function public.app__debt_rest_undo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if OLD.closed_at is not null and NEW.closed_at is null then
    if exists (select 1 from public.shift_debts x where x.rest_of = NEW.id and x.closed_at is not null) then
      raise exception 'Phần còn thiếu của khoản này (nợ mới) đã được trả — bỏ trả khoản đó trước.';
    end if;
    delete from public.shift_debts where rest_of = NEW.id and closed_at is null;
  end if;
  return NEW;
end $$;
drop trigger if exists debt_rest_undo on public.shift_debts;
create trigger debt_rest_undo after update of closed_at on public.shift_debts for each row execute function public.app__debt_rest_undo();

-- nơi phát sinh khoản nợ (cho ghi chú nợ mới)
create or replace function public.app__debt_from(p_id bigint) returns text
language sql stable security definer set search_path = public as $$
  select case when o.id is not null then 'ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') else 'quản lý ghi ' || to_char(left(d.created_at, 10)::date, 'DD/MM') end
    from public.shift_debts d left join public.shift_reports o on o.id = d.report_id where d.id = p_id;
$$;
revoke all on function public.app__debt_from(bigint) from public, anon, authenticated;

-- 3. Phiếu chốt ca: khách trả nợ (đưa thiếu → nợ mới trong ca này)
create or replace function public.app_ca_debt_collect_part(p_debt bigint, p_report bigint, p_kind text, p_amount bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); d public.shift_debts;
begin
  select * into d from public.shift_debts where id = p_debt for update;
  if d.id is null or d.closed_at is not null then raise exception 'Khoản nợ này đã được thu hoặc không còn.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền khách trả lớn hơn 0.'; end if;
  if p_amount > d.amount then raise exception 'Khách trả nhiều hơn số nợ (%).', public.app__vnd(d.amount); end if;
  perform public.app_ca_debt_collect(p_debt, p_report, p_kind, coalesce(nullif(trim(coalesce(p_note, '')), ''),
    case when p_amount < d.amount then 'Đã thu — khách đưa ' || public.app__vnd(p_amount) || ', thiếu ' || public.app__vnd(d.amount - p_amount) || ' ghi nợ mới' else 'Đã thu' end));
  if p_amount < d.amount then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, grp, family, rest_of)
    values (d.branch_id, p_report, d.table_name, d.amount - p_amount, 'Còn thiếu khi trả nợ ' || public.app__debt_from(d.id), d.phone, a.id, public.vn_now_text(),
            case when p_kind = 'chuyen_khoan' then 'ck' else 'muon' end, coalesce(d.grp, 'khach'), coalesce(d.family, 0), d.id);
  end if;
end $$;

-- 4. Ngoài ca (Công nợ › Đã thu, Sổ thu chi › Thu nợ, app_cn_collect_many): đưa thiếu → nợ mới quản lý ghi, tiền từ quỹ
create or replace function public.app_cn_debt_collect(p_id bigint, p_date text, p_kind text, p_amount bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; d public.shift_debts; dt text := coalesce(nullif(p_date, ''), left(public.vn_now_text(), 10));
begin
  select * into d from public.shift_debts where id = p_id for update;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  a := public.app__tc_need(d.branch_id);
  if not coalesce(public.app__cn_can(d.branch_id), false) then raise exception 'Bạn không được thu công nợ của cơ sở này.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ này đã thu rồi.'; end if;
  if coalesce(p_kind, '') not in ('tien_mat', 'chuyen_khoan') then raise exception 'Chọn tiền mặt hay chuyển khoản.'; end if;
  if dt !~ '^\d{4}-\d{2}-\d{2}$' or dt > left(public.vn_now_text(), 10) then raise exception 'Ngày thu không hợp lệ.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > d.amount then raise exception 'Số tiền thu phải lớn hơn 0 và không quá %.', public.app__vnd(d.amount); end if;
  if public.app__fin_locked(d.branch_id, dt) then raise exception 'Tháng này đã CHỐT — không ghi thu được.'; end if;
  update public.shift_debts set closed_at = dt || substr(public.vn_now_text(), 11), closed_by = a.id, closed_report_id = null, collect_kind = p_kind,
         close_note = coalesce(nullif(trim(coalesce(p_note, '')), ''),
           case when p_amount < d.amount then 'Quản lý thu — khách đưa ' || public.app__vnd(p_amount) || ', thiếu ' || public.app__vnd(d.amount - p_amount) || ' ghi nợ mới' else 'Quản lý thu' end)
   where id = d.id;
  if p_amount < d.amount then
    insert into public.shift_debts(branch_id, report_id, table_name, amount, note, phone, created_by, created_at, kind, grp, family, fund_out, rest_of)
    values (d.branch_id, null, d.table_name, d.amount - p_amount, 'Còn thiếu khi trả nợ ' || public.app__debt_from(d.id), d.phone, a.id, dt || substr(public.vn_now_text(), 11),
            case when p_kind = 'chuyen_khoan' then 'ck' else 'muon' end, coalesce(d.grp, 'khach'), coalesce(d.family, 0), 1, d.id);
  end if;
  perform public.app_log('khach_no_thu', 'debt=' || d.id || ' ' || p_amount || ' ' || p_kind);
end $$;

-- 5. Gán nợ ở phiếu chênh lệch: phải đủ cả khoản (vá bản đang chạy)
do $$
declare d text; anchor text := 'if p_amount < d.amount then   -- trả một phần: phần còn lại thành khoản nợ riêng';
begin
  d := pg_get_functiondef('public.app_stc_gap_debt(bigint,text,bigint,bigint,text)'::regprocedure);
  if position('két dư phải đủ cả khoản' in d) = 0 then
    if position(anchor in d) = 0 then raise exception 'app_stc_gap_debt: không thấy chỗ vá.'; end if;
    d := replace(d, anchor, 'if p_amount < d.amount then raise exception ''Khách trả nợ một lần — két dư phải đủ cả khoản nợ (%).'', public.app__vnd(d.amount); end if;
  if false then');
    execute d;
  end if;
end $$;

-- 6. Sổ thu chi: ngày / ca trả của từng khoản đã trả (khoá 'debt_paid' = { id: {date, shift, pm} })
do $$
declare d text;
  anchor text := $q$'items', coalesce((select jsonb_agg(jsonb_build_object('id', v.id$q$;
  add text := $q$'debt_paid', coalesce((select jsonb_object_agg(g.id::text, jsonb_build_object('date', coalesce(x.work_date, left(g.closed_at, 10)), 'shift', x.shift, 'pm', g.collect_kind))
        from public.shift_debts g left join public.shift_reports x on x.id = g.closed_report_id left join public.shift_reports o on o.id = g.report_id
       where g.branch_id = p_branch and g.closed_at is not null
         and (left(g.closed_at, 10) >= d0 or coalesce(o.work_date, left(g.created_at, 10)) >= d0)), '{}'::jsonb),
    $q$;
begin
  d := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  if position($q$'debt_paid', coalesce($q$ in d) = 0 then
    if position(anchor in d) = 0 then raise exception 'app_stc_month: không thấy chỗ chèn (items).'; end if;
    d := replace(d, anchor, add || anchor);
    execute d;
  end if;
end $$;

-- 7. Phiếu chốt ca (app_ca_get › debts): thêm ngày / ca trả — chỉ phần danh sách nợ, không đụng phần quyền
do $$
declare d text;
  anchor text := 'jsonb_agg(to_jsonb(d) order by d.id) from public.shift_debts d where d.report_id = r.id';
  repl text := $q$jsonb_agg(to_jsonb(d) || jsonb_build_object('paid_date', (select coalesce(x.work_date, left(d.closed_at, 10)) from (select 1) one left join public.shift_reports x on x.id = d.closed_report_id where d.closed_at is not null),
                 'paid_shift', (select x.shift from public.shift_reports x where x.id = d.closed_report_id)) order by d.id) from public.shift_debts d where d.report_id = r.id$q$;
begin
  d := pg_get_functiondef('public.app_ca_get(bigint)'::regprocedure);
  if position('''paid_shift''' in d) = 0 then
    if position(anchor in d) = 0 then raise exception 'app_ca_get: không thấy chỗ vá (debts).'; end if;
    d := replace(d, anchor, repl);
    execute d;
  end if;
end $$;

insert into public.app_migrations(file) values ('142_tra_no_mot_lan.sql') on conflict (file) do nothing;
