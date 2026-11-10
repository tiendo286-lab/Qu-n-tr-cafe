-- 27. Nút "Ngừng làm" / "Đi làm lại" cho nhân viên (đổi trạng thái nhanh, không phải mở form sửa).
-- Ngừng làm: tài khoản bị khóa đăng nhập ngay (đã có sẵn ở app_login), không hiện trong order / xếp lịch mới; lịch sử giữ nguyên.
-- Trả về số ca đã xếp từ hôm nay trở đi để quản lý biết mà thay người. Chạy lại nhiều lần không sao.

create or replace function public.app_set_employee_status(p_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; acc public.accounts; e public.employees; n int := 0; today date := public.vn_now()::date;
begin
  a := public.app__need('quan_ly_nhan_vien');
  if coalesce(p_status, '') not in ('Đang làm', 'Ngừng làm') then raise exception 'Trạng thái không hợp lệ.'; end if;
  select * into e from public.employees where id = p_id;
  if e.id is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  select * into acc from public.accounts where employee_id = p_id;
  if coalesce(acc.id = a.id, false) and p_status = 'Ngừng làm' then raise exception 'Không thể tự chuyển mình sang Ngừng làm.'; end if;
  if coalesce(acc.system_role, '') = 'chu' and p_status = 'Ngừng làm' then raise exception 'Không thể chuyển tài khoản Chủ sang Ngừng làm.'; end if;
  if coalesce(acc.system_role, '') = 'ql_tong' and not public.app_can('phan_quyen') then
    raise exception 'Chỉ Chủ được đổi trạng thái của Quản lý tổng.';
  end if;
  if e.status is distinct from p_status then
    update public.employees set status = p_status, updated_at = public.vn_now_text() where id = p_id;
    perform public.app_log(case when p_status = 'Ngừng làm' then 'ngung_lam' else 'di_lam_lai' end, e.code);
  end if;
  select count(*) into n from public.weekly_schedule_entries s join public.weeks w on w.id = s.week_id
   where s.employee_id = p_id and s.branch_id is not null and s.state = 'ĐÃ XẾP' and w.start_date::date + s.weekday >= today;
  return jsonb_build_object('status', p_status, 'future_shifts', n);
end $$;

revoke execute on function public.app_set_employee_status(bigint, text) from public, anon;
grant execute on function public.app_set_employee_status(bigint, text) to authenticated;
