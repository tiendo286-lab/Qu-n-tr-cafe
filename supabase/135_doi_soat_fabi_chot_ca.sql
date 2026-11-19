-- Bước 151 (19/11/2026, VÙNG KHOÁ — anh Tiến mở bằng mật khẩu 19/11): Đối soát Fabi + Chốt ca vĩnh viễn + Khoản treo.
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-19-doi-soat-fabi-chot-ca-design.md · Kế hoạch: tai_lieu/superpowers/plans/2026-11-19-doi-soat-fabi-chot-ca.md
-- Bài thử: kiem_tra/so_thu_chi_135.sql (tự hoàn tác). Chạy lại nhiều lần không sao.
-- * "Xác nhận Fabi" = app_stc_ds_close cũ (không đổi). "Chốt ca" mới = app_stc_ca_final: khoá vĩnh viễn, không có hàm mở lại.
-- * Khoá bằng trigger stc_final_guard (giống khoá tháng fin_guard): bảng tiền người dùng sửa → báo lỗi; bảng hệ thống tự ghi
--   (file Fabi, số dư ngân hàng, bản đối soát / mục đã duyệt / cột tiền của phiếu) → bỏ qua lặng lẽ, để kế toán tải file hay mở trang cũ không hỏng.
--   Vì vậy app_ca_recon_apply và các hàm đối soát cũ không đổi được ca đã chốt.
-- * Khoản treo (stc_treo): phần lệch còn chờ lúc chốt (chuyển khoản thiếu chờ tiền về — hạn 3 ngày; tiền thừa chờ ghép — tới hết tháng).
--   Đã về / Ghép = quyết định kind 'treo' ghi lên ca nhận (chưa chốt); ca gốc không đổi. Quá hạn: trừ tiền / quán chịu ghi lên ca gốc qua lối riêng.

-- ---------------------------------------------------------------- bảng
create table if not exists public.stc_ca_finals (
  report_id bigint primary key references public.shift_reports(id) on delete cascade,
  by_account bigint, at text not null default public.vn_now_text());
alter table public.stc_ca_finals enable row level security;
revoke all on public.stc_ca_finals from anon, authenticated;

create table if not exists public.stc_treo (
  id bigserial primary key,
  report_id bigint not null references public.shift_reports(id) on delete cascade,
  item text not null check (item in ('tien_mat', 'chuyen_khoan')),
  kind text not null check (kind in ('tien', 'thua')),
  amount bigint not null check (amount > 0),
  status text not null default 'mo' check (status in ('mo', 'xong')),
  done_kind text, done_note text, done_by bigint, done_at text,
  created_by bigint, created_at text not null default public.vn_now_text());
alter table public.stc_treo enable row level security;
revoke all on public.stc_treo from anon, authenticated;
create index if not exists stc_treo_report on public.stc_treo(report_id);

alter table public.gap_decisions add column if not exists treo_id bigint references public.stc_treo(id) on delete set null;
alter table public.gap_decisions drop constraint if exists gap_decisions_kind_check;
alter table public.gap_decisions add constraint gap_decisions_kind_check check (kind in ('quan_chiu', 'thu_khac', 'treo'));

create or replace function public.app__stc_final(p_report bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select p_report is not null and exists (select 1 from public.stc_ca_finals f where f.report_id = p_report)
$$;

-- ---------------------------------------------------------------- khoá ca đã chốt
create or replace function public.app__stc_final_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; rids bigint[]; rid bigint; hit bigint; same boolean; cols text[];
begin
  o := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  n := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  if TG_TABLE_NAME = 'shift_reports' then rids := array[(coalesce(n, o) ->> 'id')::bigint];
  elsif TG_TABLE_NAME = 'gap_matches' then
    rids := array[(o ->> 'short_report')::bigint, (o ->> 'over_report')::bigint, (n ->> 'short_report')::bigint, (n ->> 'over_report')::bigint];
  else rids := array[(o ->> 'report_id')::bigint, (n ->> 'report_id')::bigint];
  end if;
  foreach rid in array rids loop
    if rid is not null and public.app__stc_final(rid) then hit := rid; exit; end if;
  end loop;
  if hit is null then return case when TG_OP = 'DELETE' then OLD else NEW end; end if;

  -- sửa cột không phải tiền thì cho qua (đóng nợ khi khách trả, nhân viên giải trình khoản âm, Chủ duyệt…)
  cols := case TG_TABLE_NAME
    when 'shift_reports' then array['branch_id', 'work_date', 'shift', 'status', 'recon_status', 'total_revenue', 'pos_cash', 'pos_transfer', 'reported_transfer',
                                    'cash_counted', 'opening_cash', 'ipos_opening', 'pos_debt', 'pos_diff', 'cash_mode', 'ql_counted', 'rev_start', 'rev_end']
    when 'shift_debts' then array['report_id', 'amount', 'kind', 'table_name', 'branch_id']
    when 'shift_shortfalls' then array['report_id', 'item', 'employee_id', 'amount']
    when 'stc_gap_requests' then array['report_id', 'item', 'kind', 'amount']
    when 'gap_matches' then array['short_report', 'over_report', 'item', 'amount']
    when 'branch_loans' then array['report_id', 'amount', 'method', 'branch_id']
    else null end;
  if TG_OP = 'UPDATE' and cols is not null then
    select bool_and((o -> c) is not distinct from (n -> c)) into same from unnest(cols) c;
    if same then return NEW; end if;
  end if;

  -- lối riêng của khoản treo quá hạn (trừ tiền / quán chịu ghi lên ca gốc, kể cả lúc Chủ duyệt sau đó)
  if TG_TABLE_NAME in ('shift_shortfalls', 'stc_gap_requests', 'gap_decisions')
     and exists (select 1 from public.stc_treo t where t.report_id = hit and t.kind = 'tien' and t.done_kind in ('tru', 'qc')) then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  -- hệ thống tự ghi: bỏ qua lặng lẽ (giữ nguyên số của ca đã chốt, không làm hỏng việc tải file Fabi / số dư ngân hàng / mở trang cũ)
  if TG_TABLE_NAME in ('shift_reports', 'shift_report_checks', 'fabi_shifts', 'bank_shift_balances', 'bank_account_balances') then return null; end if;
  if TG_TABLE_NAME = 'shift_report_recon' and (TG_OP = 'INSERT'
       or hit::text in (coalesce(current_setting('app.fabi_report', true), ''), coalesce(current_setting('app.ca_submit_report', true), ''),
                        coalesce(current_setting('app.ca_self_submit', true), ''))) then
    return null;
  end if;
  raise exception 'Ca này đã CHỐT CA (khoá vĩnh viễn) nên không sửa được.';
end $$;

do $$
declare t text;
begin
  foreach t in array array['shift_reports', 'shift_report_moves', 'shift_report_recon', 'shift_report_results', 'shift_report_checks', 'fin_move_cats',
                           'shift_debts', 'shift_bank_outs', 'shift_shortfalls', 'gap_decisions', 'gap_matches', 'stc_gap_requests', 'stc_open_blame',
                           'branch_loans', 'fabi_shifts', 'bank_shift_balances', 'bank_account_balances'] loop
    execute format('drop trigger if exists stc_final_guard on public.%I', t);
    execute format('create trigger stc_final_guard before insert or update or delete on public.%I for each row execute function public.app__stc_final_guard()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- Xác nhận Fabi (sửa lỗi đợt 4)
-- Ca có mục Tiền mặt / Chuyển khoản web đã tự đối soát (khớp, bị khoá tự động) thì "Chốt tiền ca" cũ báo lỗi khoá.
-- Nay: mục đã có kết quả giống hệt (hoặc đã 'khớp' mà lệch ≤ 5.000 — luật coi như khớp) thì không ghi lại.
create or replace function public.app_stc_ds_close(p_report bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; s jsonb; m jsonb; it text; v bigint; res text;
begin
  r := public.app__stc_ds_need(p_report, true);
  s := public.app__stc_ds_state(p_report);
  if not (s ->> 'has_fabi')::boolean or not (s ->> 'kt_ready')::boolean then raise exception 'Chờ kế toán (file Fabi / số ngân hàng) rồi mới xác nhận.'; end if;
  if not ((s ->> 'mo1')::boolean and (s ->> 'mo2')::boolean and (s ->> 'dt')::boolean and (s ->> 'no')::boolean) then
    raise exception 'Còn ô đỏ ở ① (tiền mở ca / doanh thu / nợ) — sửa xong mới xác nhận.';
  end if;
  if (s ->> 'need_tm')::boolean then raise exception 'Nhập tiền mặt thực nhận ở ② trước.'; end if;
  m := public.app__ca_money(p_report);
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    v := (m ->> case it when 'tien_mat' then 'tm_left' else 'ck_left' end)::bigint;
    res := case when coalesce(v, 0) = 0 then 'khop' when v < 0 then 'thieu' else 'thua' end;
    if exists (select 1 from public.shift_report_results x where x.report_id = p_report and x.item = it
                 and ((x.result = res and coalesce(x.amount, 0) = abs(coalesce(v, 0))) or (x.result = 'khop' and abs(coalesce(v, 0)) <= 5000))) then continue; end if;
    perform public.app_ca_result_set(p_report, it, res, abs(coalesce(v, 0)), case when res = 'khop' then null else 'Xác nhận Fabi (Sổ thu chi) — lệch xử lý ở phiếu chênh lệch' end, '[]'::jsonb);
  end loop;
  perform public.app_log('stc_chot_tien_ca', 'report=' || p_report);
  return jsonb_build_object('tm', (m ->> 'tm_left')::bigint, 'ck', (m ->> 'ck_left')::bigint);
end $$;

-- ---------------------------------------------------------------- Chốt ca
create or replace function public.app_stc_ca_final(p_report bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; g record; todo int; out jsonb := '[]'; tid bigint;
begin
  r := public.app__stc_ds_need(p_report, false);
  if public.app__stc_final(p_report) then raise exception 'Ca đã chốt rồi.'; end if;
  if not coalesce((public.app__stc_ds_state(p_report) ->> 'done')::boolean, false) then raise exception 'Chưa xác nhận Fabi — xác nhận ở phần A trước.'; end if;
  select count(*) into todo from jsonb_array_elements(public.app_stc_month(r.branch_id, left(r.work_date, 7)) -> 'items') x
   where (x ->> 'ca_id')::bigint = p_report and x ->> 'book' = 'chi' and x ->> 'col' = 'chi' and coalesce(x ->> 'cat', '') = ''
     and not coalesce((x ->> 'void')::boolean, false);
  if todo > 0 then raise exception 'Còn % khoản chi chưa phân loại.', todo; end if;
  if exists (select 1 from public.stc_gap_requests q where q.report_id = p_report and q.status = 'cho_duyet')
     or exists (select 1 from public.gap_matches m where m.status = 'cho_duyet' and (m.short_report = p_report or m.over_report = p_report)) then
    raise exception 'Còn khoản chờ Chủ duyệt (quán chịu / ghép) — duyệt xong mới chốt.';
  end if;
  for g in select * from public.app__gap_rows(r.branch_id, r.work_date, r.work_date) x where x.report_id = p_report and x.remain > 5000 loop
    if g.state = 'cho_gan' then raise exception 'Tiền mặt thiếu còn % chưa xử lý (trừ tiền / quán chịu / ghép).', public.app__vnd(g.remain); end if;
  end loop;
  insert into public.stc_ca_finals(report_id, by_account) values (p_report, a.id);
  for g in select * from public.app__gap_rows(r.branch_id, r.work_date, r.work_date) x where x.report_id = p_report and x.remain > 5000 and x.state in ('cho_tien', 'du') loop
    insert into public.stc_treo(report_id, item, kind, amount, created_by) values (p_report, g.item, case when g.state = 'cho_tien' then 'tien' else 'thua' end, g.remain, a.id)
      returning id into tid;
    out := out || jsonb_build_object('id', tid, 'item', g.item, 'kind', case when g.state = 'cho_tien' then 'tien' else 'thua' end, 'amount', g.remain);
  end loop;
  perform public.app_log('stc_chot_ca', 'report=' || p_report || ' · khoản treo ' || jsonb_array_length(out));
  return jsonb_build_object('treo', out);
end $$;

-- ---------------------------------------------------------------- đọc: ca đã chốt + khoản treo của cơ sở
create or replace function public.app__stc_treo_left(p_treo bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select t.amount - coalesce((select sum(d.amount) from public.gap_decisions d where d.treo_id = t.id), 0) from public.stc_treo t where t.id = p_treo
$$;

create or replace function public.app_stc_finals(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts := public.app_account(); today date := public.vn_now()::date; m0 text := p_month || '-01'; m1 text := p_month || '-31';
begin
  if a.id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  if not public.app__fin_admin() then raise exception 'Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.'; end if;
  return jsonb_build_object(
    'finals', coalesce((select jsonb_agg(jsonb_build_object('id', f.report_id, 'by', public.app__acc_name(f.by_account), 'at', f.at))
                         from public.stc_ca_finals f join public.shift_reports r on r.id = f.report_id
                        where r.branch_id = p_branch and r.work_date between m0 and m1), '[]'),
    'treo', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'report_id', t.report_id, 'date', r.work_date, 'shift', r.shift,
               'pm', case when t.item = 'tien_mat' then 'tm' else 'ck' end, 'kind', t.kind, 'amount', t.amount, 'left', public.app__stc_treo_left(t.id),
               'status', t.status, 'done_kind', t.done_kind, 'done_note', t.done_note, 'done_at', t.done_at,
               'days_left', 3 - (today - r.work_date::date),
               'over', t.kind = 'tien' and t.status = 'mo' and today - r.work_date::date > 3,
               'thu_khac', t.kind = 'thua' and t.status = 'mo' and left(r.work_date, 7) < to_char(today, 'YYYY-MM'))
             order by t.status, r.work_date, t.id)
          from public.stc_treo t join public.shift_reports r on r.id = t.report_id
         where r.branch_id = p_branch and (t.status = 'mo' or coalesce(t.done_at, t.created_at) >= m0)), '[]'));
end $$;

-- ---------------------------------------------------------------- Khoản treo: Đã về (chờ tiền về) / Ghép (tiền thừa) → quyết định lên ca nhận
create or replace function public.app_stc_treo_use(p_treo bigint, p_report bigint, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); t public.stc_treo; o public.shift_reports; r public.shift_reports; lft bigint; need text; rs text;
begin
  select * into t from public.stc_treo where id = p_treo for update;
  if t.id is null or t.status <> 'mo' then raise exception 'Khoản treo không còn mở.'; end if;
  select * into o from public.shift_reports where id = t.report_id;
  r := public.app__stc_gap_need(p_report);
  if r.branch_id <> o.branch_id then raise exception 'Chỉ dùng cho ca cùng cơ sở.'; end if;
  if public.app__stc_final(p_report) then raise exception 'Ca nhận đã chốt — chọn ca chưa chốt.'; end if;
  need := case when t.kind = 'tien' then 'du' else 'thieu' end;
  lft := public.app__stc_treo_left(t.id);
  if p_amount is null or p_amount <= 0 then raise exception 'Nhập số tiền lớn hơn 0.'; end if;
  if p_amount > lft then raise exception 'Khoản treo chỉ còn %.', public.app__vnd(lft); end if;
  if p_amount > public.app__stc_gap_avail(p_report, t.item, need) then
    raise exception 'Ca nhận chỉ còn % %.', public.app__vnd(public.app__stc_gap_avail(p_report, t.item, need)), case when need = 'du' then 'tiền dư' else 'tiền thiếu' end;
  end if;
  rs := coalesce(nullif(trim(p_reason), ''), case when t.kind = 'tien' then 'Tiền về của khoản treo' else 'Ghép tiền thừa của khoản treo' end)
        || ' (ca ' || o.shift || ' ' || to_char(o.work_date::date, 'DD/MM') || ')';
  insert into public.gap_decisions(report_id, item, kind, amount, reason, created_by, treo_id) values (p_report, t.item, 'treo', p_amount, rs, a.id, t.id);
  if lft - p_amount <= 0 then
    update public.stc_treo set status = 'xong', done_kind = case when kind = 'tien' then 've' else 'ghep' end,
           done_note = (case when kind = 'tien' then 'tiền về ở ca ' else 'ghép với ca ' end) || r.shift || ' ' || to_char(r.work_date::date, 'DD/MM'),
           done_by = a.id, done_at = public.vn_now_text() where id = t.id;
  end if;
  perform public.app_log('stc_treo_dung', 'treo=' || t.id || ' → report=' || p_report || ' ' || p_amount);
end $$;

-- ---------------------------------------------------------------- Khoản treo chờ tiền về quá 3 ngày: trừ tiền nhân viên / quán chịu (ghi lên ca gốc)
create or replace function public.app_stc_treo_close(p_treo bigint, p_kind text, p_people jsonb, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); t public.stc_treo; o public.shift_reports; lft bigint; res text;
begin
  select * into t from public.stc_treo where id = p_treo for update;
  if t.id is null or t.status <> 'mo' then raise exception 'Khoản treo không còn mở.'; end if;
  if t.kind <> 'tien' then raise exception 'Chỉ khoản chờ tiền về mới trừ tiền / quán chịu.'; end if;
  select * into o from public.shift_reports where id = t.report_id;
  if public.vn_now()::date - o.work_date::date <= 3 then raise exception 'Chưa quá hạn 3 ngày — chờ tiền về hoặc bấm "Đã về".'; end if;
  if coalesce(p_kind, '') not in ('tru', 'qc') then raise exception 'Chọn trừ tiền hoặc quán chịu.'; end if;
  lft := public.app__stc_treo_left(t.id);
  update public.stc_treo set done_kind = p_kind where id = t.id;   -- mở lối riêng của trigger cho ca gốc
  if p_kind = 'tru' then perform public.app_stc_gap_tl(t.report_id, t.item, p_people, p_reason); res := 'ok';
  else res := public.app_stc_gap_qc(t.report_id, t.item, lft, p_reason); end if;
  update public.stc_treo set status = 'xong', done_by = a.id, done_at = public.vn_now_text(),
         done_note = case when p_kind = 'tru' then 'trừ tiền nhân viên' when res = 'cho_duyet' then 'quán chịu (chờ Chủ duyệt)' else 'quán chịu' end
   where id = t.id;
  perform public.app_log('stc_treo_dong', 'treo=' || t.id || ' ' || p_kind);
  return res;
end $$;

revoke all on function public.app__stc_final(bigint), public.app__stc_final_guard(), public.app__stc_treo_left(bigint) from public, anon, authenticated;
revoke all on function public.app_stc_ca_final(bigint), public.app_stc_finals(bigint, text), public.app_stc_treo_use(bigint, bigint, bigint, text),
  public.app_stc_treo_close(bigint, text, jsonb, text) from public, anon;
grant execute on function public.app_stc_ca_final(bigint), public.app_stc_finals(bigint, text), public.app_stc_treo_use(bigint, bigint, bigint, text),
  public.app_stc_treo_close(bigint, text, jsonb, text) to authenticated;

insert into public.app_migrations(file) values ('135_doi_soat_fabi_chot_ca.sql') on conflict (file) do nothing;
