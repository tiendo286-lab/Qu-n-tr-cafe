-- Bước 174 (21/11/2026): trang "Đào tạo của tôi" không còn hiện phiếu cho "Quản lý phụ trách" cũ.
-- Bước 169 (tệp 148) đã bỏ "Quản lý phụ trách" (trainings.manager_id) khỏi quyền / thông báo / Việc của tôi, nhưng sót hàm app_dt_mine (tệp 09):
-- người từng là Quản lý phụ trách vẫn thấy phiếu ở "Đào tạo của tôi" với nhãn "Bạn phụ trách", dù không còn vai trò gì trên phiếu.
-- Nay: chỉ hiện phiếu tôi được đào tạo, hoặc tôi là người hướng dẫn chính / người đào tạo tiếp. Cột manager_id vẫn GIỮ trong CSDL (như tệp 148).
-- Không đổi quyền mở phiếu (app_dt_get), không đổi danh sách Đào tạo của quản lý. Chạy lại nhiều lần không sao.

create or replace function public.app_dt_mine() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need(null);
  return coalesce((select jsonb_agg(public.app__dt_summary(t) || jsonb_build_object(
      'employee', (select e.code || ' – ' || e.name from public.employees e where e.id = t.employee_id),
      'role', case when t.employee_id = a.employee_id then 'hoc' else 'huong_dan' end) order by t.start_date desc)
    from public.trainings t
   where a.employee_id is not null
     and (t.employee_id = a.employee_id or t.instructor_id = a.employee_id or t.cont_trainer_id = a.employee_id)), '[]');
end $$;

insert into public.app_migrations(file) values ('155_dao_tao_cua_toi.sql') on conflict (file) do nothing;
