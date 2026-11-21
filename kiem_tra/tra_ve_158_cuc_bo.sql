-- Bài thử CỤC BỘ cho supabase/158_tra_ve_ca_web_tu_ghi.sql (chặng 2, anh Tiến chốt 21/11): ca có dấu Hoàn thành chạy bù lúc lên bản 6 bước
-- ('trước bước 171') mà kết quả tiền mặt + chuyển khoản do WEB tự ghi (không ai bấm) → trả về chờ quản lý xem (bỏ dấu Hoàn thành, cất bản sao để quay lại).
-- Không đụng: ca có người xác nhận, ca bấm Hoàn thành thật, kết quả tiền. Chạy trên Postgres cục bộ. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/tra_ve_158_cuc_bo.sql
do $$
declare chu public.accounts; rep text := ''; n int; n2 int; k0 int; r0 bigint; r1 bigint;
  X constant bigint := 995801; Y constant bigint := 995802; Z constant bigint := 995803;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, opening_cash, total_revenue, cash_counted)
  values (X, 1, '2026-10-10', 'Sáng', 'hoan_thanh', 'chua', 1000000, 500000, 1500000),
         (Y, 1, '2026-10-10', 'Chiều', 'hoan_thanh', 'chua', 1000000, 500000, 1500000),
         (Z, 1, '2026-10-10', 'Tối', 'hoan_thanh', 'chua', 1000000, 500000, 1500000);
  -- X: web tự ghi cả 2 kết quả + dấu chạy bù → TRẢ VỀ · Y: Chủ ghi kết quả tiền mặt + dấu chạy bù → GIỮ · Z: web tự ghi nhưng dấu do bấm Hoàn thành thật → GIỮ
  insert into public.shift_report_results(report_id, item, result, amount, computed, reason, by_account) values
    (X, 'tien_mat', 'khop', 0, 0, 'Web tự đối soát', null), (X, 'chuyen_khoan', 'khop', 0, 0, 'Web tự đối soát', null),
    (Y, 'tien_mat', 'khop', 0, 0, 'Chủ xem', chu.id), (Y, 'chuyen_khoan', 'khop', 0, 0, 'Web tự đối soát', null),
    (Z, 'tien_mat', 'khop', 0, 0, 'Web tự đối soát', null), (Z, 'chuyen_khoan', 'khop', 0, 0, 'Web tự đối soát', null);
  insert into public.stc_ca_done(report_id, by_account, at) values (X, null, 'trước bước 171'), (Y, null, 'trước bước 171'), (Z, chu.id, '2026-11-20 20:00:00');
  select count(*) into k0 from public.shift_report_results where report_id in (X, Y, Z);

  n := public.app__stc_tra_ve_ca_web();
  rep := rep || E'\n' || case when not exists (select 1 from public.stc_ca_done where report_id = X)
                               and exists (select 1 from public.stc_ca_done_tra_ve where report_id = X and at = 'trước bước 171')
        then 'ĐẠT' else 'HỎNG' end || ' (1) ca web tự ghi + dấu chạy bù: trả về (bỏ dấu Hoàn thành, có bản sao để quay lại)';
  rep := rep || E'\n' || case when exists (select 1 from public.stc_ca_done where report_id = Y) and exists (select 1 from public.stc_ca_done where report_id = Z)
        then 'ĐẠT' else 'HỎNG' end || ' (2) ca có người xác nhận / bấm Hoàn thành thật: giữ nguyên';
  select count(*) into n2 from public.shift_report_results where report_id in (X, Y, Z);
  rep := rep || E'\n' || case when n2 = k0 then 'ĐẠT' else 'HỎNG' end || format(' (3) kết quả tiền không đổi (%s → %s dòng)', k0, n2);
  rep := rep || E'\n' || case when n >= 1 and public.app__stc_tra_ve_ca_web() = 0 then 'ĐẠT' else 'HỎNG' end || format(' (4) chạy lần hai không trả thêm ca nào (lần 1: %s ca)', n);

  -- (5) quay lại được: chép bản sao về
  insert into public.stc_ca_done(report_id, by_account, at) select report_id, by_account, at from public.stc_ca_done_tra_ve where report_id = X on conflict do nothing;
  rep := rep || E'\n' || case when exists (select 1 from public.stc_ca_done where report_id = X and at = 'trước bước 171') then 'ĐẠT' else 'HỎNG' end || ' (5) quay lại cách cũ bằng bản sao';
  -- (6) người dùng web không gọi được hàm trả về
  rep := rep || E'\n' || case when not has_function_privilege('authenticated', 'public.app__stc_tra_ve_ca_web()', 'execute') then 'ĐẠT' else 'HỎNG' end || ' (6) web không gọi được hàm trả về';
  raise exception 'REPORT>> %', rep;
end $$;
