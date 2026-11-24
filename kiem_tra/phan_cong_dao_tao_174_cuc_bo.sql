-- Bài thử CỤC BỘ cho supabase/174_phan_cong_dao_tao_theo_ca.sql (anh Tiến duyệt 24/11/2026): phân công đào tạo theo ca,
-- quản lý giao lại cho Cấp 1, Lấy lại, quản lý giao lại được Xác nhận đạt, trang cũ giao đè thì mục rời ca.
-- Postgres cục bộ (seed: Chủ A1, QL tổng A2 = người phụ trách chính, QL Một A3 = HD chính, QL Hai A4 = quản lý A, NV Cấp 1 A5 = Cấp 1 B, NV mới A6).
-- Chạy sau khi đã chạy tệp 174 HAI lần (thử chạy lại):
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/phan_cong_dao_tao_174_cuc_bo.sql
do $$
declare rep text := ''; tid bigint; d date := public.vn_now()::date; wid bigint; j jsonb; e text; n int; n2 int;
  f public.training_followups;
  u_chu text := '00000000-0000-0000-0000-000000000001'; u_ptc text := '00000000-0000-0000-0000-000000000002';
  u_hdc text := '00000000-0000-0000-0000-000000000003'; u_qla text := '00000000-0000-0000-0000-000000000004';
  u_c1 text := '00000000-0000-0000-0000-000000000005';
begin
  insert into public.training_review_config(singleton, account_id) values (true, 2) on conflict (singleton) do update set account_id = excluded.account_id;
  perform set_config('request.jwt.claims', json_build_object('sub', u_chu, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(6, jsonb_build_object('start_date', to_char(d - 1, 'YYYY-MM-DD'), 'instructor_id', 3));
  -- lịch đã công bố: NV mới hôm qua Sáng · hôm nay Chiều · mai Sáng · ngày kia Tối; Cấp 1 B + quản lý A mai Sáng (cơ sở 1)
  insert into public.weeks(start_date, end_date) values (to_char(d - 1, 'YYYY-MM-DD'), to_char(d + 5, 'YYYY-MM-DD'))
    on conflict (start_date) do update set end_date = excluded.end_date returning id into wid;
  insert into public.schedule_published(week_id, employee_id, weekday, shift, branch_id, role, published_at) values
    (wid, 6, 0, 'Sáng', 1, 'phuc_vu', '2026-01-01 00:00:00'), (wid, 6, 1, 'Chiều', 1, 'phuc_vu', '2026-01-01 00:00:00'),
    (wid, 6, 2, 'Sáng', 1, 'phuc_vu', '2026-01-01 00:00:00'), (wid, 6, 3, 'Tối', 1, 'phuc_vu', '2026-01-01 00:00:00'),
    (wid, 5, 2, 'Sáng', 1, 'phuc_vu', '2026-01-01 00:00:00'), (wid, 4, 2, 'Sáng', 1, 'quan_ly', '2026-01-01 00:00:00')
  on conflict do nothing;

  -- (1a) người phụ trách chính xem bảng
  perform set_config('request.jwt.claims', json_build_object('sub', u_ptc, 'role', 'authenticated')::text, true);
  j := public.app_dt_plan_board();
  select r into j from jsonb_array_elements(j -> 'rows') r where (r ->> 'id')::bigint = tid;
  rep := rep || E'\n' || case when j is not null and jsonb_array_length(j -> 'shifts') = 4
      and exists (select 1 from jsonb_array_elements(j -> 'shifts') s where s ->> 'date' = (d + 1)::text and s -> 'mates' @> '5'::jsonb)
      and jsonb_array_length(j -> 'items') = 68 then 'ĐẠT' else 'HỎNG' end
    || format(' (1a) PTC xem bảng: %s ca, %s mục', jsonb_array_length(j -> 'shifts'), jsonb_array_length(j -> 'items'));
  -- (1b) Cấp 1 không xem được bảng
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  j := public.app_dt_plan_board();
  rep := rep || E'\n' || case when not (j ->> 'can_board')::boolean and jsonb_array_length(j -> 'rows') = 0 then 'ĐẠT' else 'HỎNG' end || ' (1b) Cấp 1: không có bảng';

  -- (2a) PTC giao mục 1–8 + 10 cho quản lý A ca mai Sáng; mục 9 cho HD chính cùng ca
  perform set_config('request.jwt.claims', json_build_object('sub', u_ptc, 'role', 'authenticated')::text, true);
  delete from public.notifications where account_id in (3, 4, 5);
  j := public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 4, array[1,2,3,4,5,6,7,8,10]);
  perform public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 3, array[9]);
  select count(*) into n from public.training_followups where training_id = tid and employee_id = 4 and work_date = d + 1 and work_shift = 'Sáng' and sub_by is null;
  select count(*) into n2 from public.notifications where account_id = 4;
  rep := rep || E'\n' || case when n = 9 and n2 = 1 and (j ->> 'n')::int = 9 then 'ĐẠT' else 'HỎNG' end || format(' (2a) giao 9 mục cho quản lý A ca mai: %s dòng, %s thông báo, kết quả %s', n, n2, j);
  -- (2b) chuyển mục 3–4 sang HD chính ca ngày kia Tối
  j := public.app_dt_plan_assign(tid, d + 2, 'Tối', 1, 3, array[3,4]);
  select count(*) into n from public.training_followups where training_id = tid and item_no in (3, 4) and employee_id = 3 and work_date = d + 2 and work_shift = 'Tối';
  rep := rep || E'\n' || case when n = 2 and (j ->> 'moved')::int = 2 then 'ĐẠT' else 'HỎNG' end || format(' (2b) chuyển ca: %s dòng ở ca mới, kết quả %s', n, j);
  -- (2c) trang cũ đổi người mục 1 → mục rời ca
  perform public.app_dt_followup_save(tid, 1, 5, null, false, 1);
  select * into f from public.training_followups where training_id = tid and item_no = 1;
  rep := rep || E'\n' || case when f.employee_id = 5 and f.work_date is null and f.work_shift is null then 'ĐẠT' else 'HỎNG' end || format(' (2c) trang cũ giao đè: người %s, ngày %s', f.employee_id, f.work_date);
  -- (2d) mục đã đạt không bị giao lại
  perform set_config('request.jwt.claims', json_build_object('sub', u_hdc, 'role', 'authenticated')::text, true);
  perform public.app_dt_mark(tid, 2, jsonb_build_object('introduced', true));
  perform public.app_dt_mark(tid, 2, jsonb_build_object('practiced', true, 'level', 'kha'));
  perform set_config('request.jwt.claims', json_build_object('sub', u_ptc, 'role', 'authenticated')::text, true);
  j := public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 5, array[2]);
  select * into f from public.training_followups where training_id = tid and item_no = 2;
  rep := rep || E'\n' || case when (j ->> 'skipped')::int = 1 and f.employee_id = 4 then 'ĐẠT' else 'HỎNG' end || format(' (2d) mục đã đạt: bỏ qua %s, vẫn người %s', j ->> 'skipped', f.employee_id);
  -- (2e) ca không có trong lịch / ngày đã qua
  e := null; begin perform public.app_dt_plan_assign(tid, d + 3, 'Sáng', 1, 4, array[11]); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e ilike '%lịch đã công bố%' then 'ĐẠT' else 'HỎNG' end || ' (2e) ca ngoài lịch bị chặn: ' || coalesce(e, 'không lỗi');
  e := null; begin perform public.app_dt_plan_assign(tid, d - 1, 'Sáng', 1, 4, array[11]); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e ilike '%Ngày đã qua%' then 'ĐẠT' else 'HỎNG' end || ' (2e) ngày đã qua bị chặn: ' || coalesce(e, 'không lỗi');
  -- (2f) giao lại phần quản lý A chỉ mục 5–8 → mục 10 trả về (chưa xếp ca, HD chính); mục 2 đã đạt giữ nguyên
  perform public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 4, array[5,6,7,8]);
  select * into f from public.training_followups where training_id = tid and item_no = 10;
  select count(*) into n from public.training_followups where training_id = tid and employee_id = 4 and work_date = d + 1;
  rep := rep || E'\n' || case when f.employee_id is null and f.work_date is null and n = 5 then 'ĐẠT' else 'HỎNG' end || format(' (2f) bỏ tích mục 10: người %s, ngày %s; quản lý A còn %s mục', f.employee_id, f.work_date, n);

  -- (3) bỏ phần HD chính ca ngày kia
  n := public.app_dt_plan_unassign(tid, d + 2, 'Tối', 3);
  select count(*) into n2 from public.training_followups where training_id = tid and item_no in (3, 4) and work_date is not null;
  rep := rep || E'\n' || case when n = 2 and n2 = 0 then 'ĐẠT' else 'HỎNG' end || format(' (3) bỏ giao: %s mục, còn ngày %s', n, n2);

  -- (5a) quản lý A giao lại mục 5–6 cho Cấp 1 B
  perform set_config('request.jwt.claims', json_build_object('sub', u_qla, 'role', 'authenticated')::text, true);
  delete from public.notifications where account_id = 5;
  j := public.app_dt_sub_assign(tid, d + 1, 'Sáng', 5, array[5,6]);
  select count(*) into n from public.training_followups where training_id = tid and item_no in (5, 6) and employee_id = 5 and sub_by = 4 and work_date = d + 1;
  select count(*) into n2 from public.notifications where account_id = 5;
  rep := rep || E'\n' || case when n = 2 and n2 = 1 then 'ĐẠT' else 'HỎNG' end || format(' (5a) giao lại 5–6 cho Cấp 1: %s dòng, %s thông báo', n, n2);
  -- (5b) giao lại [6,7] → 5 về quản lý A, 7 sang Cấp 1 B
  perform public.app_dt_sub_assign(tid, d + 1, 'Sáng', 5, array[6,7]);
  select count(*) into n from public.training_followups where training_id = tid and item_no = 5 and employee_id = 4 and sub_by is null and work_date = d + 1;
  select count(*) into n2 from public.training_followups where training_id = tid and item_no in (6, 7) and employee_id = 5 and sub_by = 4;
  rep := rep || E'\n' || case when n = 1 and n2 = 2 then 'ĐẠT' else 'HỎNG' end || format(' (5b) đổi phần giao lại: mục 5 về %s, 6–7 ở Cấp 1 %s', n, n2);
  -- (5c) mục của người khác
  e := null; begin perform public.app_dt_sub_assign(tid, d + 1, 'Sáng', 5, array[9]); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e ilike '%Chỉ giao lại được mục của bạn%' then 'ĐẠT' else 'HỎNG' end || ' (5c) mục không phải của mình: ' || coalesce(e, 'không lỗi');
  -- (5d) người nhận không phải Cấp 1
  e := null; begin perform public.app_dt_sub_assign(tid, d + 1, 'Sáng', 3, array[8]); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e ilike '%Cấp 1%' then 'ĐẠT' else 'HỎNG' end || ' (5d) người nhận là quản lý: ' || coalesce(e, 'không lỗi');
  -- (5e) Cấp 1 tự gọi
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_sub_assign(tid, d + 1, 'Sáng', 5, array[6]); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e ilike '%quản lý%' then 'ĐẠT' else 'HỎNG' end || ' (5e) Cấp 1 không giao lại được: ' || coalesce(e, 'không lỗi');

  -- (6a) Cấp 1 B ghi mức mục 6 → chờ kiểm tra, báo quản lý A
  delete from public.notifications where account_id = 4;
  perform public.app_dt_mark(tid, 6, jsonb_build_object('introduced', true));
  perform public.app_dt_mark(tid, 6, jsonb_build_object('practiced', true, 'level', 'tot'));
  select count(*) into n from public.notifications where account_id = 4 and title ilike '%chờ kiểm tra%';
  perform set_config('request.jwt.claims', json_build_object('sub', u_qla, 'role', 'authenticated')::text, true);
  j := public.app_dt_my_plan();
  rep := rep || E'\n' || case when n = 1 and exists (select 1 from jsonb_array_elements(j -> 'checks') c where (c ->> 'no')::int = 6 and (c ->> 'training_id')::bigint = tid) then 'ĐẠT' else 'HỎNG' end
    || format(' (6a) Cấp 1 ghi mức: %s thông báo cho quản lý A, chờ kiểm tra %s', n, j -> 'checks');
  -- (6b) Lấy lại: chỉ mục 7 (chưa chấm) về quản lý A
  n := public.app_dt_sub_take(tid, d + 1, 'Sáng', 5);
  select count(*) into n2 from public.training_followups where training_id = tid and item_no = 6 and employee_id = 5 and sub_by = 4;
  select * into f from public.training_followups where training_id = tid and item_no = 7;
  rep := rep || E'\n' || case when n = 1 and n2 = 1 and f.employee_id = 4 and f.sub_by is null then 'ĐẠT' else 'HỎNG' end || format(' (6b) Lấy lại: %s mục, mục 6 giữ %s', n, n2);
  -- (6c) Cấp 1 không xác nhận được; quản lý A xác nhận đạt
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_check_ok(tid, 6, null); exception when others then e := sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_qla, 'role', 'authenticated')::text, true);
  j := public.app_dt_check_ok(tid, 6, null);
  select count(*) into n from public.training_marks where training_id = tid and item_no = 6 and level = 'tot' and not cho_kiem_tra and checked_by = 4;
  rep := rep || E'\n' || case when e is not null and n = 1 then 'ĐẠT' else 'HỎNG' end || format(' (6c) xác nhận: Cấp 1 bị chặn (%s), quản lý A xác nhận %s', e, n);

  -- (7) Cấp 1 B xem việc của mình: 1 ca, ai giao lại, Ngày 3
  perform public.app_dt_sub_assign(tid, d + 1, 'Sáng', 5, array[8]);
  perform set_config('request.jwt.claims', json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  j := public.app_dt_my_plan();
  rep := rep || E'\n' || case when jsonb_array_length(j -> 'shifts') = 1 and j -> 'shifts' -> 0 ->> 'by' = 'E4 – QL Hai' and (j -> 'shifts' -> 0 ->> 'day_no')::int = 3 then 'ĐẠT' else 'HỎNG' end
    || format(' (7) việc của Cấp 1: %s', j -> 'shifts');

  -- (9) người phụ trách chính bấm Sửa phần của Cấp 1 B (mục 8 do quản lý A giao lại) và thêm mục 11 → mục 8 VẪN là "A giao lại", mục 11 giao thẳng
  perform set_config('request.jwt.claims', json_build_object('sub', u_ptc, 'role', 'authenticated')::text, true);
  perform public.app_dt_plan_assign(tid, d + 1, 'Sáng', 1, 5, array[8, 11]);
  select count(*) into n from public.training_followups where training_id = tid and item_no = 8 and employee_id = 5 and sub_by = 4;
  select count(*) into n2 from public.training_followups where training_id = tid and item_no = 11 and employee_id = 5 and sub_by is null and work_date = d + 1;
  rep := rep || E'\n' || case when n = 1 and n2 = 1 then 'ĐẠT' else 'HỎNG' end || format(' (9) Sửa phần Cấp 1 giữ dấu giao lại: mục 8 %s, mục 11 %s', n, n2);

  -- (8) web không đọc thẳng bảng
  rep := rep || E'\n' || case when not has_table_privilege('authenticated', 'public.training_followups', 'select') then 'ĐẠT' else 'HỎNG' end || ' (8) bảng không mở cho web';
  raise exception 'REPORT>> %', rep;
end $$;
