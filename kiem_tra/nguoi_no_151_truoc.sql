-- Chụp sổ tháng TRƯỚC khi chạy tệp 151, để bài thử so cũ / mới (tiền không được đổi). Gửi theo thứ tự trong CÙNG MỘT LẦN:
--   kiem_tra/nguoi_no_151_truoc.sql → supabase/151_nguoi_no.sql (2 lần) → kiem_tra/nguoi_no_151.sql
-- Kết quả là lỗi có chủ ý REPORT>> và mọi thay đổi tự hoàn tác.
do $$
declare acc public.accounts;
begin
  select * into acc from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', acc.auth_user_id, 'role', 'authenticated')::text, true);
  create temp table if not exists t151_truoc on commit drop as
    select b.id branch_id, public.app_stc_month(b.id, to_char(public.vn_now(), 'YYYY-MM')) j from public.branches b where b.status = 'Đang hoạt động';
end $$;
