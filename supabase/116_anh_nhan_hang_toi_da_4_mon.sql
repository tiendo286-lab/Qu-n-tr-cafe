-- Bước 132 (anh Tiến chốt 17/11): mỗi ảnh nhận hàng kho tổng gắn tối đa 4 món (món trong phiếu + món ngoài phiếu + món ghi tay)
-- để ảnh nào cũng nhìn rõ, đếm được. Ảnh cũ đã nhiều hơn 4 món giữ nguyên. Chạy lại nhiều lần không sao.

CREATE OR REPLACE FUNCTION public.app_gh_photo_add(p_id bigint, p_path text, p_lines bigint[])
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); i public.delivery_invoices; nid bigint;
begin
  if a.id is null or not (public.app_can('chot_ca') or public.app_can('doi_soat')) then raise exception 'Bạn không có quyền.'; end if;
  select * into i from public.delivery_invoices where id = p_id;
  perform public.app__gh_can_edit(i);
  if coalesce(p_path, '') !~ ('^gh' || p_id || '/[^/]+$') then raise exception 'Đường dẫn ảnh không hợp lệ.'; end if;
  if (select count(distinct x) from unnest(coalesce(p_lines, '{}')) x) > 4 then raise exception 'Mỗi ảnh tối đa 4 món — chụp ảnh khác cho các món còn lại.'; end if;   -- bước 132
  insert into public.delivery_receipt_photos(invoice_id, path, created_by) values (p_id, p_path, a.id) returning id into nid;
  insert into public.delivery_photo_lines(photo_id, line_id)
  select nid, l.id from public.delivery_lines l where l.invoice_id = p_id and l.id = any(coalesce(p_lines, '{}')) on conflict do nothing;
  return nid;
end $function$
;

revoke all on function public.app_gh_photo_add(bigint, text, bigint[]) from public, anon;
grant execute on function public.app_gh_photo_add(bigint, text, bigint[]) to authenticated;

insert into public.app_migrations(file) values ('116_anh_nhan_hang_toi_da_4_mon.sql') on conflict (file) do nothing;
