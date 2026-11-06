-- =====================================================================
-- QUẢN TRỊ LỊCH LÀM – BƯỚC 3: GẮN TÀI KHOẢN CHỦ
-- Làm trước: Authentication → Users → Add user → Create new user
--   Email: admin@milano.invalid   Password: (mật khẩu của anh)   Tick "Auto Confirm User"
--   (Nếu Supabase báo email không hợp lệ thì dùng admin@example.com)
-- Sau đó dán file này vào SQL Editor → Run.
-- Đăng nhập web bằng mã: admin
-- =====================================================================
insert into public.accounts (login_name, display_name, system_role, auth_user_id, auth_email, has_password, must_change,
                             password_set_at)
select 'admin', 'Chủ', 'chu', u.id, u.email, 1, 0, public.vn_now_text()
  from auth.users u
 where lower(u.email) in ('admin@milano.invalid', 'admin@example.com')
on conflict do nothing;

select id, login_name, system_role, auth_email,
       case when auth_user_id is null then 'CHƯA GẮN – kiểm tra lại email' else 'Đã gắn OK' end as trang_thai
  from public.accounts where system_role = 'chu';
