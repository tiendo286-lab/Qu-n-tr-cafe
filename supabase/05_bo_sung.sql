-- =====================================================================
-- QUẢN TRỊ LỊCH LÀM – BƯỚC 5: BỔ SUNG cho bản web mới (chạy sau 04). Chạy lại nhiều lần không sao.
-- =====================================================================

-- Đánh dấu đã đọc các thông báo có đường dẫn tới một tuần (khi mở Lịch của tôi)
create or replace function public.app_notifications_read_link(p_link text) returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = public.vn_now_text()
   where account_id = (public.app_account()).id and read_at is null and link = p_link
$$;

-- Sửa nhanh cấp bậc trong danh sách nhân viên
create or replace function public.app_set_rank(p_id bigint, p_rank text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; acc public.accounts; old text;
begin
  a := public.app__need('quan_ly_nhan_vien');
  if p_rank not in ('Thử việc', 'Cấp 1', 'Cấp 2', 'Quản lý') then raise exception 'Cấp bậc không hợp lệ.'; end if;
  select rank into old from public.employees where id = p_id;
  if old is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  select * into acc from public.accounts where employee_id = p_id;
  if acc.system_role in ('chu', 'ql_tong') and not public.app_can('phan_quyen') and acc.id <> a.id then
    raise exception 'Chỉ Chủ được sửa thông tin của Quản lý tổng.';
  end if;
  update public.employees set rank = p_rank, updated_at = public.vn_now_text() where id = p_id;
  perform public.app_log('sua_cap_bac', 'employee=' || p_id || ':' || old || '->' || p_rank);
end $$;

-- Bỏ phần Đánh giá nhân viên khỏi bản web: không ai (trừ Chủ) còn quyền đánh giá. Dữ liệu cũ vẫn giữ.
update public.role_permissions set allowed = 0 where perm = 'danh_gia';

revoke execute on function public.app_notifications_read_link(text), public.app_set_rank(bigint, text) from public, anon;
grant execute on function public.app_notifications_read_link(text), public.app_set_rank(bigint, text) to authenticated;
