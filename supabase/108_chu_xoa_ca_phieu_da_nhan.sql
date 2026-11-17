-- BƯỚC 108: Chủ xóa được cả phiếu xuất ĐÃ NHẬN (anh Tiến chốt 17/11).
-- Xóa phiếu → tự xóa theo: dòng hàng, số lượng nhận, ảnh nhận hàng, file phiếu, ghi chú thiếu hàng (on delete cascade).
-- Trả về đường dẫn mọi tệp trong kho 'hoa-don' (file phiếu, ảnh nhận, hoá đơn giao, hoá đơn bù) để web xóa tệp.
-- Việc trong Bảng phân công gắn với phiếu tự đóng ở lần quét kế tiếp (nguồn không còn).
create or replace function public.app_nh_delete(p_id bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.accounts; i public.delivery_invoices; paths jsonb;
begin
  a:=public.app__need(null);
  if coalesce(a.system_role,'')<>'chu' then raise exception 'Chỉ Chủ được xóa phiếu xuất.'; end if;
  select * into i from public.delivery_invoices where id=p_id for update;
  if i.id is null then return '[]'; end if;
  select coalesce(jsonb_agg(distinct path),'[]') into paths from (
    select path from public.delivery_invoice_files where invoice_id=p_id
    union all select path from public.delivery_receipt_photos where invoice_id=p_id
    union all select i.deliv_path union all select i.bu_path) x where coalesce(path,'')<>'';
  delete from public.delivery_invoices where id=p_id;
  perform public.app_log('nhap_hang_xoa_hoa_don','id='||p_id||' '||coalesce(i.doc_no,'')||' '||coalesce(i.state,''));
  return paths;
end $$;

revoke all on function public.app_nh_delete(bigint) from public,anon;
grant execute on function public.app_nh_delete(bigint) to authenticated;

insert into public.app_migrations(file) values('108_chu_xoa_ca_phieu_da_nhan.sql') on conflict(file) do nothing;
