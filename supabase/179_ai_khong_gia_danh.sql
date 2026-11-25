-- 179 — Chìa khoá của máy Mac (vai ai_viec, ai_doc) không giả được người đăng nhập (anh Tiến chọn "cách 1" 26/11/2026)
-- Vấn đề (soát độc lập 26/11): kết nối thẳng vào Postgres tự đặt được request.jwt.claims → auth.uid() trả id của Chủ →
-- hàm app_* của Milano (PUBLIC gọi được) tưởng là Chủ. Sửa: app__uid() trả NULL khi phiên đăng nhập là ai_viec / ai_doc;
-- 4 hàm đọc thẳng auth.uid() chuyển sang app__uid(). Thân hàm giữ y hệt bản mới nhất (145, 07x, 02); mọi đường khác của web
-- (PostgREST, kho ảnh, hẹn giờ, trình soạn SQL) không đổi. Vai máy Mac mới sau này phải thêm vào danh sách trong app__uid().
-- Chạy lại nhiều lần không lỗi.

create or replace function public.app__uid() returns uuid
language sql stable security definer set search_path = public as $$
  select case when session_user in ('ai_viec', 'ai_doc') then null else auth.uid() end
$$;
revoke execute on function public.app__uid() from public, anon;
grant execute on function public.app__uid() to authenticated, service_role;

create or replace function public.app__real_account() returns public.accounts
language sql stable security definer set search_path = public as $$
  select a.* from public.accounts a
  left join public.employees e on e.id = a.employee_id
  where a.auth_user_id = public.app__uid()
    and a.locked = 0
    and (a.employee_id is null or e.status = 'Đang làm')
  limit 1
$$;

create or replace function public.app__dt_hdc_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  if new.instructor_id is not distinct from old.instructor_id then return new; end if;
  if new.instructor_id is null then return new; end if;
  if coalesce(public.app__uid()::text, '') = '' then return new; end if;   -- việc nội bộ máy chủ (không có người gọi)
  select * into a from public.accounts where auth_user_id = public.app__uid() and locked = 0 limit 1;
  if a.id is not null and (coalesce(a.system_role = 'chu', false) or public.app__dt_is_ptc(a)) then return new; end if;
  raise exception 'Chỉ người phụ trách chính đào tạo hoặc Chủ được đổi người hướng dẫn chính.';
end $$;

create or replace function public.app_password_changed() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.accounts set must_change = 0, has_password = 1, password_set_at = public.vn_now_text(),
         password_set_by = id
   where auth_user_id = public.app__uid();
end $$;

create or replace function public.app_touch_login() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.accounts set last_login_at = public.vn_now_text() where auth_user_id = public.app__uid();
end $$;

insert into public.app_migrations(file) values ('179_ai_khong_gia_danh.sql') on conflict (file) do nothing;
