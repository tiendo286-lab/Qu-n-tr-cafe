-- Bước 119 (17/11/2026): quản lý sửa thẳng Phiếu chốt ca ở bước Kiểm tra
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-17-ql-sua-phieu-design.md · Kế hoạch: tai_lieu/superpowers/plans/2026-11-17-ql-sua-phieu.md
-- Bài kiểm tra: kiem_tra/audit_tien/t01…t06 (chạy trong begin … rollback).
-- Mỗi hàm lấy từ bản đang chạy trên máy chủ (pg_get_functiondef) rồi sửa. Chạy lại nhiều lần không sao.

-- ================================================================ 1. app__ca_money trả thêm ck_expected (Phải nhận chuyển khoản)
-- ck_left_bank = bank_received − ck_expected; ô "Chuyển khoản ngân hàng" (phieu_ca.js) dùng ck_expected thay cho CK Fabi.
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
    'ck_basis', case when bank_ok then 'ke_toan' else 'nhan_vien' end, 'ck_left', coalesce(ck_bank, ck_nv),
    'ck_expected', pt + ck_mv + col_ck - ck_new);   -- bước 119: chuyển khoản PHẢI NHẬN (ô Chuyển khoản ngân hàng ở bước Kiểm tra)
end $function$;

insert into public.app_migrations(file) values ('101_ql_sua_phieu.sql') on conflict (file) do nothing;
