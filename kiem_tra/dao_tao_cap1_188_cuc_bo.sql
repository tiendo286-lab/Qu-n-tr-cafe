-- Bài thử CỤC BỘ cho supabase/188_dao_tao_cap1_khong_sua_muc_dat.sql (27/11/2026). Seed như bài 174:
-- Chủ A1, QL tổng A2 = người phụ trách chính, QL Một A3 = HD chính, QL Hai A4, NV Cấp 1 A5, NV mới A6. Chạy sau tệp 188 ×2:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/dao_tao_cap1_188_cuc_bo.sql
do $$
declare rep text := ''; tid bigint; j jsonb; e text; m public.training_marks;
  u_chu text := '00000000-0000-0000-0000-000000000001'; u_hdc text := '00000000-0000-0000-0000-000000000003';
  u_qla text := '00000000-0000-0000-0000-000000000004'; u_c1 text := '00000000-0000-0000-0000-000000000005';
  login text := 'request.jwt.claims';
begin
  insert into public.training_review_config(singleton, account_id) values (true, 2) on conflict (singleton) do update set account_id = excluded.account_id;
  perform set_config(login, json_build_object('sub', u_chu, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(6, jsonb_build_object('start_date', to_char(public.vn_now()::date - 1, 'YYYY-MM-DD'), 'instructor_id', 3));
  -- HD chính giao mục 1, 2, 3 cho Cấp 1
  perform set_config(login, json_build_object('sub', u_hdc, 'role', 'authenticated')::text, true);
  perform public.app_dt_followup_save(tid, 1, 5, null, false, 1);
  perform public.app_dt_followup_save(tid, 2, 5, null, false, 1);
  perform public.app_dt_followup_save(tid, 3, 5, null, false, 1);
  -- Cấp 1 chấm mục 1 → chờ kiểm tra; vẫn sửa được khi đang chờ
  perform set_config(login, json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  perform public.app_dt_mark(tid, 1, jsonb_build_object('introduced', true));
  perform public.app_dt_mark(tid, 1, jsonb_build_object('practiced', true, 'level', 'kha'));
  e := null; begin perform public.app_dt_mark(tid, 1, jsonb_build_object('level', 'tot')); exception when others then e := sqlerrm; end;
  select * into m from public.training_marks where training_id = tid and item_no = 1;
  rep := rep || E'\n' || case when e is null and m.level = 'tot' and m.cho_kiem_tra then 'ĐẠT' else 'HỎNG' end || format(' (1) mục đang chờ kiểm tra: Cấp 1 vẫn sửa mức được — %s', coalesce(e, 'được'));
  j := public.app_dt_get(tid);
  rep := rep || E'\n' || case when (j ->> 'cap1_lock')::boolean then 'ĐẠT' else 'HỎNG' end || ' (2) app_dt_get báo cap1_lock = có cho Cấp 1';
  -- HD chính xác nhận đạt mục 1
  perform set_config(login, json_build_object('sub', u_hdc, 'role', 'authenticated')::text, true);
  perform public.app_dt_check_ok(tid, 1, null);
  j := public.app_dt_get(tid);
  rep := rep || E'\n' || case when not (j ->> 'cap1_lock')::boolean then 'ĐẠT' else 'HỎNG' end || ' (3) HD chính: cap1_lock = không';
  -- Cấp 1 sửa mục đã xác nhận → bị chặn, số liệu giữ nguyên
  perform set_config(login, json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_mark(tid, 1, jsonb_build_object('level', 'tb')); exception when others then e := sqlerrm; end;
  select * into m from public.training_marks where training_id = tid and item_no = 1;
  rep := rep || E'\n' || case when e like '%đã được xác nhận đạt%' and m.level = 'tot' and not m.cho_kiem_tra then 'ĐẠT' else 'HỎNG' end || format(' (4) mục đã xác nhận: Cấp 1 đổi mức bị chặn, giữ mức cũ — %s', coalesce(e, 'KHÔNG chặn'));
  e := null; begin perform public.app_dt_mark(tid, 1, jsonb_build_object('practiced', false, 'level', null)); exception when others then e := sqlerrm; end;
  select * into m from public.training_marks where training_id = tid and item_no = 1;
  rep := rep || E'\n' || case when e like '%đã được xác nhận đạt%' and m.level = 'tot' then 'ĐẠT' else 'HỎNG' end || format(' (5) Cấp 1 bỏ tích mục đã xác nhận cũng bị chặn — %s', coalesce(e, 'KHÔNG chặn'));
  -- mục khác chưa chấm: Cấp 1 vẫn làm bình thường
  e := null; begin perform public.app_dt_mark(tid, 2, jsonb_build_object('introduced', true)); perform public.app_dt_mark(tid, 2, jsonb_build_object('practiced', true, 'level', 'tb'));
  exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e is null then 'ĐẠT' else 'HỎNG' end || format(' (6) mục chưa xác nhận: Cấp 1 chấm bình thường — %s', coalesce(e, 'được'));
  -- HD chính và quản lý có quyền vẫn sửa được mục đã xác nhận
  perform set_config(login, json_build_object('sub', u_hdc, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_mark(tid, 1, jsonb_build_object('level', 'kha')); exception when others then e := sqlerrm; end;
  select * into m from public.training_marks where training_id = tid and item_no = 1;
  rep := rep || E'\n' || case when e is null and m.level = 'kha' and not m.cho_kiem_tra then 'ĐẠT' else 'HỎNG' end || format(' (7) HD chính sửa mục đã xác nhận: được, vẫn tính đạt — %s', coalesce(e, 'được'));
  -- giai đoạn 2: mục 1 (Khá, đã xác nhận) giao Cấp 1 luyện thêm → Cấp 1 chấm lại được (ngoại lệ có chủ đích)
  perform public.app_dt_followup_save(tid, 1, 5, 'luyện thêm', true, 1);
  perform set_config(login, json_build_object('sub', u_c1, 'role', 'authenticated')::text, true);
  e := null; begin perform public.app_dt_mark(tid, 1, jsonb_build_object('level', 'tot')); exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e is null then 'ĐẠT' else 'HỎNG' end || format(' (8) Cấp 1 đang được giao giai đoạn 2 của mục đó: chấm lại được — %s', coalesce(e, 'được'));
  raise exception 'REPORT>> %', rep;
end $$;
