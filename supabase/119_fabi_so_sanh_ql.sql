-- Bước 136 (TINH_NANG_DA_CHOT 5r41): tab File ca Fabi — quản lý (quyền Đối soát) xem được; mỗi file gửi kèm đủ 7 số nhân viên nhập
-- trên phiếu (kể cả số khớp) + tên người chốt phiếu để web vẽ bảng so sánh. Tải file (app_fabi_upload) vẫn chỉ Kế toán. Chạy lại nhiều lần không sao.
create or replace function public.app_fabi_list(p_from text, p_to text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need(null);
  if not (public.app_can('ke_toan') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  return jsonb_build_object(
    'files', coalesce((select jsonb_agg(jsonb_build_object('ma_ca', f.ma_ca, 'store', f.store_name, 'branch_code', b.code, 'work_date', f.work_date, 'shift', f.shift,
               'open_at', f.open_at, 'close_at', f.close_at, 'dau', f.dau, 'net', f.net, 'ck', f.ck, 'tm', f.tm, 'no', f.no, 'tong', f.tong, 'chenh', f.tong - f.cuoi,
               'tra_no', f.tra_no, 'sua', f.sua, 'report_id', f.report_id, 'report_status', r.status, 'diff', f.diff, 'fixed', f.fixed,
               'uploaded_by', public.app__acc_name(f.uploaded_by), 'uploaded_at', f.uploaded_at, 'cups', f.cups, 'cups_by', f.cups_by, 'cups_unknown', f.cups_unknown,
               'nv', case when r.id is not null then jsonb_build_object('ipos_opening', r.ipos_opening, 'total_revenue', r.total_revenue, 'pos_transfer', r.pos_transfer,
                       'pos_cash', r.pos_cash, 'pos_debt', r.pos_debt, 'cash_counted', r.cash_counted, 'pos_diff', r.pos_diff) end,
               'nguoi_chot', public.app__acc_name(r.completed_by))
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
revoke execute on function public.app_fabi_list(text, text) from public, anon;
grant execute on function public.app_fabi_list(text, text) to authenticated;

insert into public.app_migrations(file) values ('119_fabi_so_sanh_ql.sql') on conflict (file) do nothing;
