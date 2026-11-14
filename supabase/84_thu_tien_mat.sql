-- Bước 88 (anh Tiến 14/11/2026): Đối soát ca › Tiền thực nhận — quản lý chọn cách thu tiền mặt cho từng ca:
--  * Thu theo ca: quản lý đếm và thu ngay cuối ca, nhập số đếm (ql_counted) → lệch tiền mặt của ca tính theo số quản lý đếm.
--  * Thu cuối ngày (mặc định): tiền để lại két cho ca sau — điều kiện tiền kết ca = tiền mở ca sau (ca sau nhận két lệch đã tính vào ca này).
-- Chạy lại nhiều lần không sao.

alter table public.shift_reports add column if not exists cash_mode text;
alter table public.shift_reports add column if not exists ql_counted bigint;
alter table public.shift_reports add column if not exists ql_counted_by bigint;
alter table public.shift_reports add column if not exists ql_counted_at text;

create or replace function public.app_ca_cash_mode(p_id bigint, p_mode text, p_counted bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu ca.'; end if;
  if r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa hoàn thành phiếu ca.'; end if;
  if coalesce(r.recon_status, '') = 'hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — mở lại để sửa.'; end if;
  if coalesce(p_mode, '') not in ('ca', 'ngay') then raise exception 'Chọn thu theo ca hay thu cuối ngày.'; end if;
  if p_mode = 'ca' and p_counted is not null and p_counted < 0 then raise exception 'Số đếm không được âm.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  update public.shift_reports set cash_mode = p_mode, ql_counted = case when p_mode = 'ca' then p_counted end,
         ql_counted_by = case when p_mode = 'ca' and p_counted is not null then a.id end,
         ql_counted_at = case when p_mode = 'ca' and p_counted is not null then public.vn_now_text() end
   where id = p_id;
  perform public.app_log('ca_cach_thu', 'id=' || p_id || ' ' || p_mode || coalesce(' ' || p_counted, ''));
end $$;
revoke all on function public.app_ca_cash_mode(bigint, text, bigint) from public, anon;
grant execute on function public.app_ca_cash_mode(bigint, text, bigint) to authenticated;


-- bước 89: quản lý đổi loại nợ (Nợ HĐ / Nợ TM / Nợ CK) của khoản nợ phát sinh trong ca khi đối soát
create or replace function public.app_ca_debt_kind(p_debt bigint, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.shift_debts; r public.shift_reports;
begin
  perform public.app__need('doi_soat');
  select * into d from public.shift_debts where id = p_debt;
  if d.id is null then raise exception 'Không tìm thấy khoản nợ.'; end if;
  if coalesce(p_kind, '') not in ('bill', 'muon', 'ck') then raise exception 'Loại nợ không đúng.'; end if;
  if d.closed_at is not null then raise exception 'Khoản nợ đã thu — không đổi loại được.'; end if;
  select * into r from public.shift_reports where id = d.report_id;
  if r.id is null then raise exception 'Chỉ đổi được khoản nợ ghi ở phiếu ca.'; end if;
  if coalesce(r.recon_status, '') = 'hoan_thanh' then raise exception 'Ca đã hoàn thành đối soát — mở lại để sửa.'; end if;
  if public.app__fin_locked(r.branch_id, r.work_date) then raise exception 'Tháng này đã CHỐT.'; end if;
  update public.shift_debts set kind = p_kind where id = p_debt;
  perform public.app_log('no_doi_loai', 'debt=' || p_debt || ' ' || coalesce(d.kind, 'bill') || '→' || p_kind);
end $$;
revoke all on function public.app_ca_debt_kind(bigint, text) from public, anon;
grant execute on function public.app_ca_debt_kind(bigint, text) to authenticated;

CREATE OR REPLACE FUNCTION public.app__ca_money(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.shift_reports; nx public.shift_reports; d jsonb; b jsonb; tm_mv bigint; ck_mv bigint; debt_new bigint; col_tm bigint; col_ck bigint;
        cc bigint; op bigint; pc bigint; pt bigint; rt bigint; tot bigint; tm_left bigint; ck_nv bigint; ck_bank bigint; bank_ok boolean; ck_new bigint;
        nh jsonb; hg bigint := 0; ns text;
begin
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then return null; end if;
  d := public.app__ca_eff(p_id);
  b := public.app__kt_bank_json(r);
  select coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'tien_mat'), 0),
         coalesce(sum((m ->> 'amount')::bigint) filter (where m ->> 'kind' = 'chuyen_khoan'), 0)
    into tm_mv, ck_mv from jsonb_array_elements(coalesce(d -> 'moves', '[]')) m;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') = 'bill';
  select coalesce(sum(amount), 0) into ck_new from public.shift_debts where report_id = p_id and kind = 'ck';   -- bước 84: Nợ CK
  select coalesce(sum(amount) filter (where collect_kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where collect_kind = 'chuyen_khoan'), 0)
    into col_tm, col_ck from public.shift_debts where closed_report_id = p_id;
  cc := case when r.cash_mode = 'ca' and r.ql_counted is not null then r.ql_counted else (d ->> 'cash_counted')::bigint end; op := (d ->> 'opening_cash')::bigint; pc := (d ->> 'pos_cash')::bigint;
  pt := (d ->> 'pos_transfer')::bigint; rt := (d ->> 'reported_transfer')::bigint; tot := (d ->> 'total_revenue')::bigint;
  -- ca sau đếm nhận két lệch → khoản lệch tính cho ca này (ca giao)
  ns := public.app__ca_next_shift(r.shift);
  if ns is not null then
    select * into nx from public.shift_reports where branch_id = r.branch_id and work_date = r.work_date and shift = ns;
    if nx.id is not null then nh := public.app__ca_hand(nx.id); hg := coalesce((nh ->> 'gap_eff')::bigint, 0); end if;
  end if;
  tm_left := cc - op - pc - tm_mv - col_tm;
  ck_nv := rt - pt - ck_mv - col_ck + ck_new;
  bank_ok := coalesce((b ->> 'account_count')::int, 0) > 0 and (b ->> 'entered')::int = (b ->> 'account_count')::int;
  ck_bank := case when bank_ok then (b ->> 'received')::bigint - pt - ck_mv - col_ck + ck_new end;
  return jsonb_build_object('sum_gap', tot - pc - pt - debt_new, 'debt_new', debt_new, 'ck_new', ck_new, 'cash_mode', coalesce(r.cash_mode, 'ngay'), 'ql_counted', r.ql_counted, 'nv_counted', (d ->> 'cash_counted')::bigint, 'col_tm', col_tm, 'col_ck', col_ck,
    'tm_moves', tm_mv, 'ck_moves', ck_mv, 'tm_left_self', tm_left, 'handover_gap', hg, 'tm_left', tm_left + hg,
    'next_hand', case when nh is not null and nh ->> 'state' not in ('chua_dem', 'cho_ca_truoc') then jsonb_build_object('shift', ns, 'id', nx.id,
       'state', nh ->> 'state', 'counted', (nh ->> 'counted')::bigint, 'first_count', (nh ->> 'first_count')::bigint, 'gap', (nh ->> 'gap')::bigint,
       'giver', nh ->> 'giver', 'counted_by', nh ->> 'counted_by', 'counted_at', nh ->> 'counted_at', 'recount_at', nh ->> 'recount_at') end,
    'ck_left_nv', ck_nv, 'ck_left_bank', ck_bank,
    'bank_received', (b ->> 'received')::bigint, 'bank_ok', bank_ok,
    'ck_basis', case when bank_ok then 'ke_toan' else 'nhan_vien' end, 'ck_left', coalesce(ck_bank, ck_nv));
end $function$;

CREATE OR REPLACE FUNCTION public.app__ca_money_selfcheck(p_days integer DEFAULT 45)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', z.id, 'tm_money', z.tm1, 'tm_check', z.tm2, 'ck_money', z.ck1, 'ck_check', z.ck2)), '[]')
    from (select r.id, (m ->> 'tm_left_self')::bigint tm1, (m ->> 'ck_left_nv')::bigint ck1,
                 coalesce(case when r.cash_mode = 'ca' then r.ql_counted end, r.cash_counted) - r.opening_cash - r.pos_cash
                   - ((select coalesce(sum(amount), 0) from public.shift_report_moves where report_id = r.id and kind = 'tien_mat')
                      - (select coalesce(sum(cash_paid), 0) from public.shift_report_staff where report_id = r.id and worked = 1)
                      - (select coalesce(sum(amount), 0) from public.shift_debts where report_id = r.id and kind = 'muon'))
                   - (select coalesce(sum(amount), 0) from public.shift_debts where closed_report_id = r.id and collect_kind = 'tien_mat') tm2,
                 r.reported_transfer - r.pos_transfer
                   - (select coalesce(sum(amount), 0) from public.shift_report_moves where report_id = r.id and kind = 'chuyen_khoan')
                   - (select coalesce(sum(amount), 0) from public.shift_debts where closed_report_id = r.id and collect_kind = 'chuyen_khoan')
                   + (select coalesce(sum(amount), 0) from public.shift_debts where report_id = r.id and kind = 'ck') ck2
            from public.shift_reports r cross join lateral (select public.app__ca_money(r.id) m) mm
           where r.status = 'hoan_thanh' and r.work_date >= to_char(public.vn_now()::date - p_days, 'YYYY-MM-DD')
             and not exists (select 1 from public.shift_report_recon x where x.report_id = r.id)) z
   where z.tm1 is distinct from z.tm2 or z.ck1 is distinct from z.ck2
$function$;

insert into public.app_migrations(file) values ('84_thu_tien_mat.sql') on conflict (file) do nothing;
