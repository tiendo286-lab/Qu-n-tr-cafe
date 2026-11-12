-- =====================================================================
-- BƯỚC 42: CHỐT CA MỚI — ĐỢT 2: KẾ TOÁN TẢI FILE CHI TIẾT CA TỪ FABI (anh Tiến chốt 12/11/2026). Chạy sau 41. Chạy lại nhiều lần không sao.
--  * Kế toán chỉ tải file "BÁO CÁO CA CHI TIẾT" của từng ca (web đọc file trên trình duyệt, gửi số lên đây).
--  * Web ghép file với phiếu chốt ca theo cơ sở (tên cửa hàng trên Fabi) + ngày + ca (giờ mở ca: trước 11h Sáng, trước 16h Chiều, còn lại Tối).
--  * Số Fabi là số đúng: phiếu đã hoàn thành mà khác → ghi vào BẢN ĐỐI SOÁT theo Fabi (có lịch sử), báo quản lý;
--    ca đã hoàn thành đối soát mà số đổi → tự MỞ LẠI đối soát. Ca có trên Fabi mà chưa có phiếu → báo quản lý.
--  * Lela Box (không dùng Fabi) không nằm trong danh sách cửa hàng.
-- =====================================================================

create table if not exists public.fabi_stores (
  store_name text primary key,
  branch_id bigint not null references public.branches(id) on delete cascade
);
insert into public.fabi_stores(store_name, branch_id)
select x.n, b.id from (values ('Milano Coffee - Lê Hồng Phong', 'LHP'), ('Milano Coffee - Đông Khê', 'ĐK'), ('Milano Coffee - Hồ Sen', 'HS'), ('Lela Cafe', 'LL')) x(n, c)
join public.branches b on b.code = x.c
on conflict (store_name) do nothing;

create table if not exists public.fabi_shifts (
  ma_ca text primary key,
  store_name text not null,
  branch_id bigint references public.branches(id) on delete set null,
  work_date text, shift text, open_at text, close_at text,
  dau bigint, cuoi bigint, net bigint, ck bigint, tm bigint, no bigint, other bigint, hd integer, tong bigint,
  pay jsonb not null default '[]', tra_no jsonb not null default '[]', sua jsonb not null default '[]', bills jsonb not null default '[]',
  report_id bigint references public.shift_reports(id) on delete set null,
  diff jsonb not null default '[]',
  fixed jsonb not null default '[]',
  uploaded_by bigint,
  uploaded_at text not null default public.vn_now_text()
);
create index if not exists idx_fabi_shifts_day on public.fabi_shifts (branch_id, work_date, shift);
alter table public.fabi_stores enable row level security;
alter table public.fabi_shifts enable row level security;
revoke all on public.fabi_stores from anon, authenticated;
revoke all on public.fabi_shifts from anon, authenticated;

-- 'dd/mm/yyyy hh:mi' → 'yyyy-mm-dd hh:mi'
create or replace function public.app__fabi_ts(p text) returns text
language sql immutable as $$
  select case when coalesce(p, '') ~ '^\d{2}/\d{2}/\d{4}' then substr(p, 7, 4) || '-' || substr(p, 4, 2) || '-' || substr(p, 1, 2) || coalesce(' ' || nullif(trim(substr(p, 11, 6)), ''), '') end
$$;
create or replace function public.app__fabi_shift(p_open text) returns text
language sql immutable as $$
  select case when p_open is null then null
              when substr(p_open, 12, 2)::int < 11 then 'Sáng' when substr(p_open, 12, 2)::int < 16 then 'Chiều' else 'Tối' end
$$;

-- So 1 ca Fabi với phiếu chốt ca; phiếu đã hoàn thành thì sửa bản đối soát theo Fabi
create or replace function public.app__fabi_apply(p_ma text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f public.fabi_shifts; r public.shift_reports; e jsonb; v_diff jsonb := '[]'; v_fixed jsonb := '[]'; k text; lbl text; fv bigint; nv bigint; ev bigint;
        chain boolean; first_ boolean; st text; acc bigint;
begin
  begin acc := (public.app_account()).id; exception when others then acc := null; end;
  select * into f from public.fabi_shifts where ma_ca = p_ma;
  if f.ma_ca is null then return null; end if;
  if f.branch_id is null then update public.fabi_shifts set report_id = null, diff = '[]', fixed = '[]' where ma_ca = p_ma; return jsonb_build_object('status', 'chua_ro_co_so'); end if;
  select * into r from public.shift_reports where branch_id = f.branch_id and work_date = f.work_date and shift = f.shift;
  if r.id is null then
    update public.fabi_shifts set report_id = null, diff = '[]', fixed = '[]' where ma_ca = p_ma;
    return jsonb_build_object('status', 'chua_phieu');
  end if;
  if r.status <> 'hoan_thanh' then
    update public.fabi_shifts set report_id = r.id, diff = '[]', fixed = '[]' where ma_ca = p_ma;
    return jsonb_build_object('status', 'dang_chot', 'report_id', r.id);
  end if;
  first_ := r.shift = (public.app__shifts())[1];
  chain := public.app__ca_chain(r.shift);
  -- nhân viên gõ khác Fabi?
  for k, lbl, fv, nv in
    select * from (values ('ipos_opening', 'Số dư đầu', f.dau, r.ipos_opening), ('total_revenue', 'Doanh thu NET', f.net, r.total_revenue),
                          ('pos_transfer', 'Chuyển khoản', f.ck, r.pos_transfer), ('pos_cash', 'Tiền mặt', f.tm, r.pos_cash),
                          ('pos_debt', 'Nợ', f.no, r.pos_debt), ('cash_counted', 'Tổng tiền', f.tong, r.cash_counted),
                          ('pos_diff', 'Tiền chênh lệch', f.tong - f.cuoi, r.pos_diff)) v(a, b, c, d)
  loop
    if fv is not null and fv is distinct from nv then v_diff := v_diff || jsonb_build_object('field', k, 'label', lbl, 'nv', nv, 'fabi', fv); end if;
  end loop;
  -- bản đối soát phải theo Fabi
  e := public.app__ca_eff(r.id);
  for k, lbl, fv in
    select * from (values ('total_revenue', 'Doanh thu NET', f.net), ('pos_cash', 'Tiền mặt', f.tm), ('pos_transfer', 'Chuyển khoản', f.ck),
                          ('cash_counted', 'Tổng tiền', f.tong), ('opening_cash', 'Tiền đầu ca', case when chain and not first_ then f.dau end)) v(a, b, c)
  loop
    ev := nullif(e ->> k, '')::bigint;
    if fv is not null and fv is distinct from ev then
      if not exists (select 1 from public.shift_report_recon where report_id = r.id) then
        insert into public.shift_report_recon(report_id, data, updated_by) values (r.id, public.app__recon_snapshot(r.id), acc);
      end if;
      update public.shift_report_recon set data = data || jsonb_build_object(k, fv), updated_by = acc, updated_at = public.vn_now_text() where report_id = r.id;
      insert into public.shift_recon_log(report_id, action, field, before, after, reason, by_account)
      values (r.id, 'sua', k, to_jsonb(ev), to_jsonb(fv), 'Theo file Fabi (mã ca ' || f.ma_ca || ')', acc);
      v_fixed := v_fixed || jsonb_build_object('field', k, 'label', lbl, 'before', ev, 'fabi', fv);
    end if;
  end loop;
  st := case when jsonb_array_length(v_diff) = 0 and jsonb_array_length(v_fixed) = 0 then 'khop' else 'lech' end;
  if jsonb_array_length(v_fixed) > 0 then
    if r.recon_status = 'hoan_thanh' then
      update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = r.id;
      insert into public.shift_recon_log(report_id, action, reason, by_account) values (r.id, 'mo_lai_doi_soat', 'File Fabi khác số đã đối soát', acc);
    end if;
    perform public.app__notify_doi_soat('Số Fabi khác phiếu chốt ca',
      public.app__ca_title(r) || ': ' || (select string_agg(x ->> 'label', ', ') from jsonb_array_elements(v_fixed) x) || ' đã sửa theo file Fabi'
        || case when r.recon_status = 'hoan_thanh' then ' — ca đã MỞ LẠI đối soát.' else '.' end,
      '/quan-ly/doi-soat/ca?id=' || r.id);
  end if;
  update public.fabi_shifts set report_id = r.id, diff = v_diff, fixed = fabi_shifts.fixed || v_fixed where ma_ca = p_ma;
  return jsonb_build_object('status', st, 'report_id', r.id, 'diff', v_diff, 'fixed', v_fixed);
end $$;

create or replace function public.app__fabi_apply_report(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare m text; r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_id;
  for m in select f.ma_ca from public.fabi_shifts f where f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift loop
    perform public.app__fabi_apply(m);
  end loop;
end $$;

-- Kế toán tải file (đã đọc trên trình duyệt). p_rows: [{ma_ca, store, open, close, dau, cuoi, net, hd, pay:[{name,amount}], tra_no:[{method,amount}], sua:[...], bills:[{menh_gia,sl,tong}], tong}]
create or replace function public.app_fabi_upload(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; x jsonb; bid bigint; op text; out jsonb := '[]'; res jsonb; ma text; nm text; pay jsonb; ck bigint; tm bigint; no_ bigint; oth bigint;
begin
  a := public.app__need('ke_toan');
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Chưa có file nào.'; end if;
  if jsonb_array_length(p_rows) > 100 then raise exception 'Mỗi lần tải tối đa 100 file.'; end if;
  for x in select * from jsonb_array_elements(p_rows) loop
    ma := trim(coalesce(x ->> 'ma_ca', '')); nm := trim(coalesce(x ->> 'store', ''));
    if ma = '' or nm = '' then raise exception 'File thiếu mã ca hoặc tên cửa hàng.'; end if;
    select branch_id into bid from public.fabi_stores where lower(store_name) = lower(nm);
    op := public.app__fabi_ts(x ->> 'open');
    pay := coalesce(x -> 'pay', '[]');
    select coalesce(sum((p ->> 'amount')::bigint) filter (where lower(p ->> 'name') like '%chuyển khoản%'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(trim(p ->> 'name')) = 'tiền mặt'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(trim(p ->> 'name')) = 'nợ'), 0),
           coalesce(sum((p ->> 'amount')::bigint) filter (where lower(p ->> 'name') not like '%chuyển khoản%' and lower(trim(p ->> 'name')) not in ('tiền mặt', 'nợ')), 0)
      into ck, tm, no_, oth from jsonb_array_elements(pay) p;
    insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, open_at, close_at, dau, cuoi, net, ck, tm, no, other, hd, tong, pay, tra_no, sua, bills, uploaded_by, uploaded_at)
    values (ma, nm, bid, left(op, 10), public.app__fabi_shift(op), op, public.app__fabi_ts(x ->> 'close'),
            nullif(x ->> 'dau', '')::bigint, nullif(x ->> 'cuoi', '')::bigint, nullif(x ->> 'net', '')::bigint, ck, tm, no_, oth,
            nullif(x ->> 'hd', '')::int, nullif(x ->> 'tong', '')::bigint, pay, coalesce(x -> 'tra_no', '[]'), coalesce(x -> 'sua', '[]'), coalesce(x -> 'bills', '[]'),
            a.id, public.vn_now_text())
    on conflict (ma_ca) do update set store_name = excluded.store_name, branch_id = excluded.branch_id, work_date = excluded.work_date, shift = excluded.shift,
      open_at = excluded.open_at, close_at = excluded.close_at, dau = excluded.dau, cuoi = excluded.cuoi, net = excluded.net, ck = excluded.ck, tm = excluded.tm,
      no = excluded.no, other = excluded.other, hd = excluded.hd, tong = excluded.tong, pay = excluded.pay, tra_no = excluded.tra_no, sua = excluded.sua, bills = excluded.bills,
      uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at;
    res := public.app__fabi_apply(ma);
    if res ->> 'status' = 'chua_phieu' then
      perform public.app__notify_doi_soat('Ca có trên Fabi nhưng chưa có phiếu chốt ca',
        (select code from public.branches where id = bid) || ' · ca ' || public.app__fabi_shift(op) || ' ' || to_char(left(op, 10)::date, 'DD/MM') || ' (mã ca ' || ma || ').', '/ca?ngay=' || left(op, 10));
    end if;
    out := out || (jsonb_build_object('ma_ca', ma, 'store', nm, 'branch_code', (select code from public.branches where id = bid), 'work_date', left(op, 10),
                   'shift', public.app__fabi_shift(op)) || coalesce(res, '{}'::jsonb));
  end loop;
  perform public.app_log('tai_file_fabi', jsonb_array_length(p_rows) || ' ca');
  return out;
end $$;

-- Trang kế toán: các ca Fabi đã tải + phiếu trên web chưa có file Fabi (trong khoảng ngày)
create or replace function public.app_fabi_list(p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('ke_toan');
  return jsonb_build_object(
    'files', coalesce((select jsonb_agg(jsonb_build_object('ma_ca', f.ma_ca, 'store', f.store_name, 'branch_code', b.code, 'work_date', f.work_date, 'shift', f.shift,
               'open_at', f.open_at, 'close_at', f.close_at, 'dau', f.dau, 'net', f.net, 'ck', f.ck, 'tm', f.tm, 'no', f.no, 'tong', f.tong, 'chenh', f.tong - f.cuoi,
               'tra_no', f.tra_no, 'sua', f.sua, 'report_id', f.report_id, 'report_status', r.status, 'diff', f.diff, 'fixed', f.fixed,
               'uploaded_by', public.app__acc_name(f.uploaded_by), 'uploaded_at', f.uploaded_at)
               order by f.work_date desc, b.sort_order, f.open_at)
             from public.fabi_shifts f left join public.branches b on b.id = f.branch_id left join public.shift_reports r on r.id = f.report_id
            where f.work_date between p_from and p_to), '[]'),
    'missing', coalesce((select jsonb_agg(jsonb_build_object('report_id', r.id, 'branch_code', b.code, 'work_date', r.work_date, 'shift', r.shift, 'status', r.status)
               order by r.work_date desc, b.sort_order, r.shift)
             from public.shift_reports r join public.branches b on b.id = r.branch_id
            where r.work_date between p_from and p_to and public.app__ca_chain(r.shift)
              and exists (select 1 from public.fabi_stores s where s.branch_id = r.branch_id)
              and not exists (select 1 from public.fabi_shifts f where f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift)), '[]'));
end $$;

-- Trang đối soát ca: số Fabi của ca (nếu đã tải)
create or replace function public.app_fabi_for_report(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.shift_reports;
begin
  perform public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id;
  return (select jsonb_build_object('ma_ca', f.ma_ca, 'open_at', f.open_at, 'close_at', f.close_at, 'dau', f.dau, 'cuoi', f.cuoi, 'net', f.net, 'ck', f.ck, 'tm', f.tm,
            'no', f.no, 'other', f.other, 'hd', f.hd, 'tong', f.tong, 'chenh', f.tong - f.cuoi, 'pay', f.pay, 'tra_no', f.tra_no, 'sua', f.sua,
            'diff', f.diff, 'fixed', f.fixed, 'uploaded_by', public.app__acc_name(f.uploaded_by), 'uploaded_at', f.uploaded_at)
          from public.fabi_shifts f where f.branch_id = r.branch_id and f.work_date = r.work_date and f.shift = r.shift order by f.uploaded_at desc limit 1);
end $$;

create or replace function public.app__ca_finish(p_id bigint, p_acc bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ca_part_check(p_id, 'tien');
  perform public.app__ca_part_check(p_id, 'nhan_su');
  update public.shift_reports set status = 'hoan_thanh', completed_by = p_acc, completed_at = public.vn_now_text(),
         updated_by = p_acc, updated_at = public.vn_now_text()
   where id = p_id;
  perform public.app_log('hoan_thanh_chot_ca', 'report=' || p_id || ' (đủ các phần việc)');
  perform public.app__ca_auto_recon(p_id, p_acc);
  perform public.app__fabi_apply_report(p_id);   -- bước 42: có file Fabi rồi thì so ngay
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_\_fabi%' or p.proname like 'app\_fabi%' or p.proname = 'app__ca_finish') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then execute format('revoke execute on function %s from authenticated', f.sig);
    else execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
