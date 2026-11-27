-- Bài thử CỤC BỘ cho supabase/187_phan_cong_dao_tao_diem_nho.sql (27/11/2026): thông báo chỉ khi có mục mới, chỉ mục lịch theo nhân viên,
-- danh sách Cấp 1 chỉ gửi quản lý, quản lý đã giao lại hết vẫn mở được phiếu.
-- Postgres cục bộ (seed như bài 174: Chủ A1, QL tổng A2 = người phụ trách chính, QL Một A3 = HD chính, QL Hai A4 = quản lý A, NV Cấp 1 A5, NV mới A6, Kế toán A7).
-- Chạy sau khi đã chạy tệp 187 HAI lần:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/phan_cong_dao_tao_187_cuc_bo.sql
do $$
declare rep text := ''; tid bigint; d date := public.vn_now()::date; wid bigint; j jsonb; e text; n int; b text;
  u_chu text := '00000000-0000-0000-0000-000000000001'; u_ptc text := '00000000-0000-0000-0000-000000000002';
  u_qla text := '00000000-0000-0000-0000-000000000004'; u_c1 text := '00000000-0000-0000-0000-000000000005';
  u_kt text := '00000000-0000-0000-0000-000000000007';
begin
  insert into public.training_review_config(singleton, account_id) values (true, 2) on conflict (singleton) do update set account_id = excluded.account_id;
  perform set_config('request.jwt.claims', json_build_object('sub', u_chu, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(6, jsonb_build_object('start_date', to_char(d - 1, 'YYYY-MM-DD'), 'instructor_id', 3));
  insert into public.weeks(start_date, end_date) values (to_char(d - 1, 'YYYY-MM-DD'), to_char(d + 5, 'YYYY-MM-DD'))
    on conflict (start_date) do update set end_date = excluded.end_date returning id into wid;
  insert into public.schedule_published(week_id, employee_id, weekday, shift, branch_id, role, published_at) values
    (wid, 6, 2, 'Sáng', 1, 'phuc_vu', '2026-01-01 00:00:00'), (wid, 5, 2, 'Sáng', 1, 'phuc_vu', '2026-01-01 00:00:00'),
    (wid, 4, 2, 'Sáng', 1, 'quan_ly', '2026-01-01 00:00:00') on conflict do nothing;
  -- để chắc là đang thử đúng luật mới: bỏ quyền Đào tạo / Quản lý nhân viên của mọi vai (tự hoàn tác cuối bài)
  update public.role_permissions set allowed = 0 where perm in ('dao_tao', 'quan_ly_nhan_vien');

  -- (1) thông báo chỉ khi có mục mới
  perform set_config('request.jwt.claims', json_build_object('sub', u_ptc, 'role', 'authenticated')::text, true);
  delete from public.notifications where account_id = 4;
  j := public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 4, array[5,6,7]);
  select count(*), max(body) into n, b from public.notifications where account_id = 4;
  rep := rep || E'\n' || case when n = 1 and b like '%· 3 mục ·%' and (j ->> 'moi')::int = 3 then 'ĐẠT' else 'HỎNG' end || format(' (1a) giao 3 mục mới: %s thông báo "%s", kết quả %s', n, b, j);
  j := public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 4, array[5,6,7]);
  select count(*) into n from public.notifications where account_id = 4;
  rep := rep || E'\n' || case when n = 1 and (j ->> 'moi')::int = 0 and (j ->> 'n')::int = 3 then 'ĐẠT' else 'HỎNG' end || format(' (1b) lưu lại y nguyên: vẫn %s thông báo, kết quả %s', n, j);
  j := public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 4, array[5,6]);
  select count(*) into n from public.notifications where account_id = 4;
  rep := rep || E'\n' || case when n = 1 and (j ->> 'moi')::int = 0 then 'ĐẠT' else 'HỎNG' end || format(' (1c) chỉ bớt mục 7: vẫn %s thông báo, kết quả %s', n, j);
  j := public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 4, array[5,6,8]);
  select count(*) into n from public.notifications where account_id = 4;
  select body into b from public.notifications where account_id = 4 order by id desc limit 1;
  rep := rep || E'\n' || case when n = 2 and b like '%· 1 mục ·%' and (j ->> 'moi')::int = 1 then 'ĐẠT' else 'HỎNG' end || format(' (1d) thêm mục 8: %s thông báo, cái mới "%s"', n, b);

  -- (2) chỉ mục lịch theo nhân viên
  select count(*) into n from pg_indexes where schemaname = 'public' and tablename = 'schedule_published' and indexname = 'schedule_published_employee';
  rep := rep || E'\n' || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' (2) có chỉ mục schedule_published(employee_id)';

  -- (3) danh sách Cấp 1 chỉ gửi quản lý
  perform set_config('request.jwt.claims', json_build_object('sub', u_qla, 'role', 'authenticated')::text, true);
  j := public.app_dt_my_plan();
  rep := rep || E'\n' || case when jsonb_array_length(j -> 'cap1') >= 1 and jsonb_array_length(j -> 'shifts') = 1 then 'ĐẠT' else 'HỎNG' end || format(' (3a) quản lý: có danh sách Cấp 1 (%s người), 1 ca', jsonb_array_length(j -> 'cap1'));

  -- (4) quản lý giao lại HẾT phần mình cho Cấp 1 vẫn mở được phiếu + lịch sử
  perform public.app_dt_sub_assign(tid, d + 1, 'Sáng', 5, array[5,6,8]);
  select count(*) into n from public.training_followups where training_id = tid and employee_id = 4;
  e := null; begin perform public.app_dt_get(tid); perform public.app_dt_history(tid); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when n = 0 and e is null then 'ĐẠT' else 'HỎNG' end || format(' (4a) quản lý đã giao lại hết (còn giữ %s mục): mở phiếu + lịch sử — %s', n, coalesce(e, 'được'));
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  j := public.app_dt_my_plan();
  e := null; begin perform public.app_dt_get(tid); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when jsonb_array_length(j -> 'cap1') = 0 and jsonb_array_length(j -> 'shifts') = 1 and e is null then 'ĐẠT' else 'HỎNG' end || format(' (3b) Cấp 1: danh sách Cấp 1 rỗng (%s), vẫn có ca dạy, mở phiếu %s', jsonb_array_length(j -> 'cap1'), coalesce(e, 'được'));
  perform set_config('request.jwt.claims', json_build_object('sub', u_kt, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_get(tid); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e like '%không xem được%' then 'ĐẠT' else 'HỎNG' end || format(' (4b) người không liên quan: vẫn bị chặn mở phiếu — %s', coalesce(e, 'KHÔNG chặn'));
  e := null; begin perform public.app_dt_history(tid); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e like '%không xem được%' then 'ĐẠT' else 'HỎNG' end || format(' (4c) người không liên quan: vẫn bị chặn xem lịch sử — %s', coalesce(e, 'KHÔNG chặn'));
  -- (4d) quản lý Lấy lại hết rồi người phụ trách chính bỏ giao → không còn liên quan → lại bị chặn
  perform set_config('request.jwt.claims', json_build_object('sub', u_qla, 'role', 'authenticated')::text, true);
  perform public.app_dt_sub_take(tid, d + 1, 'Sáng', 5);
  perform set_config('request.jwt.claims', json_build_object('sub', u_ptc, 'role', 'authenticated')::text, true);
  perform public.app_dt_plan_unassign(tid, d + 1, 'Sáng', 4);
  perform set_config('request.jwt.claims', json_build_object('sub', u_qla, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_get(tid); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e like '%không xem được%' then 'ĐẠT' else 'HỎNG' end || format(' (4d) quản lý hết phần dạy: không còn mở được phiếu — %s', coalesce(e, 'KHÔNG chặn'));

  raise exception 'REPORT>> %', rep;
end $$;
