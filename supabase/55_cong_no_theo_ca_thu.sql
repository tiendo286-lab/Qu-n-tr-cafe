-- =====================================================================
-- BƯỚC 55: CÔNG NỢ ĐÃ THU HIỆN Ở ĐÚNG CA THU (anh Tiến chốt 12/11/2026). Chạy sau 54. Chạy lại không sao. Chỉ thêm hàm đọc.
--  * Tiền khách trả nợ vẫn tính vào ca thu như cũ (closed_report_id). Đây chỉ sửa phần hiển thị ở tab Đối soát:
--    - ca phát sinh nợ: dòng nợ ghi "Đã thu ở ca … (tiền mặt / chuyển khoản)" → app_ca_debts_paid;
--    - Bảng ca: ô ca thu ghi "Thu nợ …đ", ô ca nợ chỉ ghi "Có công nợ" khi còn nợ chưa thu → app_ca_debt_marks.
--  * Chỉ tính nợ bàn (khách mượn tiền quán hiện ở Thu chi, không tính ở đây).
-- =====================================================================

create or replace function public.app_ca_debts_paid(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need(null);
  if not (public.app_can('doi_soat') or public.app_can('chot_ca') or public.app_can('ke_toan')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'report_id', c.id, 'shift', c.shift, 'work_date', c.work_date, 'status', c.status,
                     'kind', d.collect_kind, 'amount', d.amount) order by d.id)
                     from public.shift_debts d join public.shift_reports c on c.id = d.closed_report_id
                    where d.report_id = p_id and d.closed_at is not null and coalesce(d.kind, 'bill') <> 'muon'), '[]');
end $$;

create or replace function public.app_ca_debt_marks(p_date text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('doi_soat');
  return coalesce((select jsonb_agg(z) from (
      select jsonb_build_object('report_id', r.id,
        'open_amt', (select coalesce(sum(d.amount), 0) from public.shift_debts d where d.report_id = r.id and d.closed_at is null and coalesce(d.kind, 'bill') <> 'muon'),
        'paid_amt', (select coalesce(sum(d.amount), 0) from public.shift_debts d where d.closed_report_id = r.id and coalesce(d.kind, 'bill') <> 'muon')) z
        from public.shift_reports r where r.work_date = p_date) q), '[]');
end $$;

revoke execute on function public.app_ca_debts_paid(bigint), public.app_ca_debt_marks(text) from public, anon;
grant execute on function public.app_ca_debts_paid(bigint), public.app_ca_debt_marks(text) to authenticated;
