-- Bài thử cho supabase/155_dao_tao_cua_toi.sql (bước 174). Gửi SAU tệp 155. Tự tạo người / phiếu giả rồi REPORT>> tự hoàn tác.
-- Trên bản cũ (trước tệp 155) dòng 1 phải HỎNG: Quản lý phụ trách cũ vẫn thấy phiếu.
do $$
declare chu public.accounts; hdc public.accounts; qlk public.accounts;
  trainee bigint; tid bigint; j jsonb; r text := ''; ok boolean;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  select a.* into hdc from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Quản lý' and x.status = 'Đang làm' and a.system_role <> 'chu' order by (a.system_role <> 'ql'), a.id limit 1;
  select a.* into qlk from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Quản lý' and x.status = 'Đang làm' and a.system_role = 'ql' and a.id <> hdc.id order by a.id limit 1;
  if chu.id is null or hdc.id is null or qlk.id is null then raise exception 'Thiếu tài khoản để thử (cần Chủ + 2 Quản lý)'; end if;
  insert into public.employees(code, name, rank, status) values ('T155', 'Nhân viên thử 155', 'Thử việc', 'Đang làm') returning id into trainee;

  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(trainee, jsonb_build_object('start_date', to_char(public.vn_now()::date - 2, 'YYYY-MM-DD'), 'instructor_id', hdc.employee_id));
  update public.trainings set manager_id = qlk.id where id = tid;   -- "Quản lý phụ trách" kiểu cũ

  -- 1. Quản lý phụ trách cũ (không là người hướng dẫn) KHÔNG còn thấy phiếu ở "Đào tạo của tôi"
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_mine();
  ok := not exists (select 1 from jsonb_array_elements(j) x where (x ->> 'id')::bigint = tid);
  r := r || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (1) Quản lý phụ trách cũ không thấy phiếu ở Đào tạo của tôi';

  -- 2. Người hướng dẫn chính vẫn thấy, nhãn "huong_dan"
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_mine();
  ok := exists (select 1 from jsonb_array_elements(j) x where (x ->> 'id')::bigint = tid and x ->> 'role' = 'huong_dan');
  r := r || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (2) Người hướng dẫn chính vẫn thấy phiếu, nhãn hướng dẫn';

  -- 3. Người vừa là Quản lý phụ trách cũ vừa là người đào tạo tiếp → vẫn thấy (vì là người đào tạo tiếp), nhãn "huong_dan" chứ không phải "quan_ly"
  update public.trainings set cont_trainer_id = qlk.employee_id where id = tid;
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_mine();
  ok := exists (select 1 from jsonb_array_elements(j) x where (x ->> 'id')::bigint = tid and x ->> 'role' = 'huong_dan');
  r := r || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (3) Người đào tạo tiếp vẫn thấy phiếu, nhãn hướng dẫn';
  update public.trainings set cont_trainer_id = null where id = tid;

  -- 4. Không ai còn nhận nhãn "quan_ly"
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  update public.trainings set manager_id = chu.id where id = tid;
  j := public.app_dt_mine();
  ok := not exists (select 1 from jsonb_array_elements(j) x where x ->> 'role' = 'quan_ly');
  r := r || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (4) Không còn nhãn "Bạn phụ trách"';

  -- 5. Người học thấy phiếu của mình, nhãn "hoc" (mượn tài khoản Quản lý khác làm người học của một phiếu mới)
  tid := public.app_dt_create(qlk.employee_id, jsonb_build_object('start_date', to_char(public.vn_now()::date - 1, 'YYYY-MM-DD'), 'instructor_id', hdc.employee_id));
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_mine();
  ok := exists (select 1 from jsonb_array_elements(j) x where (x ->> 'id')::bigint = tid and x ->> 'role' = 'hoc');
  r := r || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (5) Người học thấy phiếu của mình';

  -- 6. Quản lý phụ trách cũ vẫn KHÔNG mất quyền mở phiếu nếu có quyền khác (không đổi app_dt_get): Chủ mở được
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  ok := (public.app_dt_get(tid) ->> 'id') is not null or public.app_dt_get(tid) is not null;
  r := r || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (6) Mở phiếu (app_dt_get) không đổi';

  raise exception 'REPORT>> %', r;
end $$;
