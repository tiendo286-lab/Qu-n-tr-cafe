-- Chụp TRƯỚC khi chạy tệp 154 (sổ tháng này + tiền từng ca tính ở Xác nhận Fabi) để so cũ / mới — tiền không được đổi. Gửi CÙNG MỘT LẦN, theo thứ tự:
--   begin isolation level repeatable read; → kiem_tra/giao_ca_154_truoc.sql → supabase/154_giao_ca_chia_doi.sql (2 lần) → kiem_tra/giao_ca_154.sql
-- Kết quả là lỗi có chủ ý REPORT>> và mọi thay đổi tự hoàn tác.
do $$
declare acc public.accounts;
begin
  select * into acc from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', acc.auth_user_id, 'role', 'authenticated')::text, true);
  create temp table if not exists t154_so on commit drop as
    select b.id branch_id, public.app_stc_month(b.id, to_char(public.vn_now(), 'YYYY-MM')) j from public.branches b where b.status = 'Đang hoạt động';
  create temp table if not exists t154_ca on commit drop as
    select r.id, public.app__ca_money(r.id) m from public.shift_reports r
     where r.status = 'hoan_thanh' and r.work_date >= to_char(public.vn_now() - interval '45 days', 'YYYY-MM-DD');
end $$;
