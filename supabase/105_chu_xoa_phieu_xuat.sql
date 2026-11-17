-- BƯỚC 105: Chỉ Chủ được xóa phiếu xuất chưa bắt đầu nhận.
create or replace function public.app_nh_delete(p_id bigint) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.accounts; i public.delivery_invoices; paths jsonb;
begin
  a:=public.app__need(null);
  if coalesce(a.system_role,'')<>'chu' then raise exception 'Chỉ Chủ được xóa phiếu xuất.'; end if;
  select * into i from public.delivery_invoices where id=p_id for update;
  if i.id is null then return '[]'; end if;
  if i.state<>'dang_chuyen' then raise exception 'Hàng đã được báo nhận, không xóa phiếu xuất được.'; end if;
  if public.app__nh_started(p_id) then raise exception 'Nhân viên đang nhận hàng theo phiếu này — không xóa được.'; end if;
  select coalesce(jsonb_agg(path),'[]') into paths from (
    select path from public.delivery_invoice_files where invoice_id=p_id
    union all select path from public.delivery_receipt_photos where invoice_id=p_id) x;
  delete from public.delivery_invoices where id=p_id;
  perform public.app_log('nhap_hang_xoa_hoa_don','id='||p_id||' '||coalesce(i.doc_no,''));
  return paths;
end $$;

revoke all on function public.app_nh_delete(bigint) from public,anon;
grant execute on function public.app_nh_delete(bigint) to authenticated;

insert into public.app_migrations(file) values('105_chu_xoa_phieu_xuat.sql') on conflict(file) do nothing;
