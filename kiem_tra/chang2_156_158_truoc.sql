-- Chụp TRƯỚC khi chạy tệp 156, 157, 158 (chặng 2) để so cũ / mới trên dữ liệu thật. Gửi CÙNG MỘT LẦN, theo thứ tự:
--   begin isolation level repeatable read; → tệp này → 156 → 157 → 158 (mỗi tệp 2 lần) → kiem_tra/chang2_156_158.sql
-- Kết quả là lỗi có chủ ý REPORT>> và mọi thay đổi tự hoàn tác.
do $$
declare acc public.accounts;
begin
  select * into acc from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', acc.auth_user_id, 'role', 'authenticated')::text, true);
  create temp table if not exists tc2_so on commit drop as
    select b.id branch_id, public.app_stc_month(b.id, to_char(public.vn_now(), 'YYYY-MM')) j from public.branches b where b.status = 'Đang hoạt động';
  create temp table if not exists tc2_ca on commit drop as
    select r.id, public.app__ca_money(r.id) m from public.shift_reports r where r.work_date >= to_char(public.vn_now() - interval '45 days', 'YYYY-MM-DD');
  create temp table if not exists tc2_kq on commit drop as
    select report_id, item, result, amount, computed, by_account from public.shift_report_results;
  create temp table if not exists tc2_tra on commit drop as
    select d.report_id from public.stc_ca_done d
     where d.at = 'trước bước 171'
       and exists (select 1 from public.shift_report_results s where s.report_id = d.report_id and s.item in ('tien_mat', 'chuyen_khoan'))
       and not exists (select 1 from public.shift_report_results s where s.report_id = d.report_id and s.item in ('tien_mat', 'chuyen_khoan') and s.by_account is not null);
  create temp table if not exists tc2_done on commit drop as select count(*) so_dau from public.stc_ca_done;
end $$;
