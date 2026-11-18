-- KIỂM TRA tệp 125 (app_today_more sửa sau soát lỗi: who_id, bỏ việc bị xoá / tự bỏ). Ghép supabase/125_viec_hom_nay_sua.sql vào đầu cùng lần gửi.
-- Chỉ dùng dữ liệu giả (ZZT124…); khối DO luôn kết thúc bằng RAISE 'REPORT>> …' nên mọi thay đổi tự hoàn tác.
do $$
declare
  aa public.accounts; ab public.accounts; br bigint; emp bigint; hd bigint; qlemp bigint; tid bigint; pid bigint;
  k_wait bigint; k_today bigint; k_old bigint; pct bigint; pdel bigint; pdrop bigint; j jsonb; jb jsonb; today text := public.vn_now()::date::text;
begin
  -- A: Quản lý có đăng nhập; B: Chủ
  select * into aa from public.accounts where system_role = 'ql' and auth_user_id is not null and locked = 0 order by id limit 1;
  select * into ab from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  select id into br from public.branches where status = 'Đang hoạt động' order by sort_order, id limit 1;
  select id into qlemp from public.employees where rank = 'Quản lý' and status = 'Đang làm' order by id limit 1;
  assert aa.id is not null and ab.id is not null and qlemp is not null, 'Thiếu tài khoản / nhân viên để thử';
  assert not has_function_privilege('anon', 'public.app_today_more()', 'EXECUTE'), 'Khách không gọi được';
  assert has_function_privilege('authenticated', 'public.app_today_more()', 'EXECUTE'), 'Người đăng nhập gọi được';

  -- Việc giao riêng: A đã báo xong, B kiểm tra
  insert into public.tasks(kind, content, branch_id, assignee_id, reviewer_id, giver_id, created_by, status, submitted_at)
    values ('viec', 'ZZT124 chờ kiểm tra', br, aa.id, ab.id, ab.id, ab.id, 'cho_duyet', public.vn_now_text()) returning id into k_wait;
  -- Việc A làm, B duyệt Đạt hôm nay / hôm qua
  insert into public.tasks(kind, content, branch_id, assignee_id, reviewer_id, giver_id, created_by, status, approved_by, approved_at)
    values ('viec', 'ZZT124 xong hôm nay', br, aa.id, ab.id, ab.id, ab.id, 'hoan_thanh', ab.id, public.vn_now_text()) returning id into k_today;
  insert into public.tasks(kind, content, branch_id, assignee_id, reviewer_id, giver_id, created_by, status, approved_by, approved_at)
    values ('viec', 'ZZT124 xong hôm qua', br, aa.id, ab.id, ab.id, ab.id, 'hoan_thanh', ab.id, to_char(public.vn_now() - interval '1 day', 'YYYY-MM-DD HH24:MI:SS')) returning id into k_old;
  -- Việc Bảng phân công A làm, xong hôm nay
  insert into public.pc_tasks(job, branch_id, title, done_at, done_by) values (1, br, 'ZZT124 đối soát', public.vn_now_text(), aa.id) returning id into pct;
  insert into public.pc_steps(task_id, step, name, accounts, start_at, done_at, done_by) values (pct, 1, 'Làm', array[aa.id], public.vn_now_text(), public.vn_now_text(), aa.id);
  -- Việc bị xoá / tự bỏ hôm nay (A có tên ở bước) → không được tính là Đã xong
  insert into public.pc_tasks(job, branch_id, title, done_at, done_by, done_note) values (1, br, 'ZZT124 bị xoá', public.vn_now_text(), ab.id, 'Việc đã bị xoá') returning id into pdel;
  insert into public.pc_tasks(job, branch_id, title, done_at, done_by, done_note) values (1, br, 'ZZT124 tự bỏ', public.vn_now_text(), null, 'Quá 7 ngày — bỏ làm bổ sung') returning id into pdrop;
  insert into public.pc_steps(task_id, step, name, accounts, start_at, done_at) values (pdel, 1, 'Làm', array[aa.id], public.vn_now_text(), public.vn_now_text()), (pdrop, 1, 'Làm', array[aa.id], public.vn_now_text(), public.vn_now_text());

  -- Phiếu đào tạo A phụ trách, 2 hạng mục giao người hướng dẫn (1 xong, 1 chưa)
  insert into public.employees(code, name, rank, status) values ('ZZT124', 'Học viên thử', 'Thử việc', 'Đang làm') returning id into emp;
  insert into public.employees(code, name, rank, status) values ('ZZT124H', 'Hướng dẫn thử', 'Cấp 1', 'Đang làm') returning id into hd;
  select id into pid from public.training_programs where code = 'chay_ban';
  insert into public.trainings(employee_id, program_id, start_date, manager_id, branch_id, instructor_id)
    values (emp, pid, public.vn_now()::date::text, aa.id, br, qlemp) returning id into tid;
  insert into public.training_followups(training_id, item_no, employee_id, is_extra, finished_at) values (tid, 1, hd, false, null), (tid, 2, hd, false, public.vn_now_text());
  insert into public.training_marks(training_id, item_no, introduced, practiced) values (tid, 1, true, false) on conflict (training_id, item_no) do update set introduced = true, practiced = false, level = null;

  -- Đăng nhập A
  perform set_config('request.jwt.claims', json_build_object('sub', aa.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_today_more();
  assert j->>'today' = today, 'Ngày hôm nay';
  assert (select count(*) from jsonb_array_elements(j->'review_wait') x where (x->>'id')::bigint = k_wait) = 1, 'A thấy việc mình đã báo xong đang chờ kiểm tra';
  assert (select count(*) from jsonb_array_elements(j->'done_today') x where x->>'kind' = 'gv' and (x->>'id')::bigint = k_today and x->>'by' is not null and x->>'who' is not null) = 1, 'Việc Đạt hôm nay có người kiểm tra + người làm';
  assert not exists (select 1 from jsonb_array_elements(j->'done_today') x where x->>'kind' = 'gv' and (x->>'id')::bigint = k_old), 'Không có việc xong hôm qua';
  assert (select count(*) from jsonb_array_elements(j->'done_today') x where x->>'kind' = 'pc' and (x->>'id')::bigint = pct and (x->>'job')::int = 1 and (x->>'who_id')::bigint = aa.id) = 1, 'Việc phân công xong hôm nay, có who_id';
  assert (select x->>'who_id' from jsonb_array_elements(j->'done_today') x where x->>'kind' = 'gv' and (x->>'id')::bigint = k_today)::bigint = aa.id, 'Việc giao riêng xong hôm nay có who_id = người làm';
  assert not exists (select 1 from jsonb_array_elements(j->'done_today') x where x->>'kind' = 'pc' and (x->>'id')::bigint in (pdel, pdrop)), 'Việc bị xoá / tự bỏ không tính là Đã xong';
  assert (select count(*) from jsonb_array_elements(j->'followups') x where (x->>'training_id')::bigint = tid) = 1, 'Chỉ còn 1 hạng mục chưa xong';
  assert (select x->>'stage' from jsonb_array_elements(j->'followups') x where (x->>'training_id')::bigint = tid) = 'da_gioi_thieu', 'Bước: đã giới thiệu';
  assert (select x->>'instructor' from jsonb_array_elements(j->'followups') x where (x->>'training_id')::bigint = tid) = 'Hướng dẫn thử', 'Tên người hướng dẫn';
  assert (select x->>'due' from jsonb_array_elements(j->'followups') x where (x->>'training_id')::bigint = tid) = (public.vn_now()::date + 12)::text, 'Hạn = ngày bắt đầu + 12';

  -- Đăng nhập B (người kiểm tra, không phụ trách phiếu)
  perform set_config('request.jwt.claims', json_build_object('sub', ab.auth_user_id, 'role', 'authenticated')::text, true);
  jb := public.app_today_more();
  assert not exists (select 1 from jsonb_array_elements(jb->'review_wait') x where (x->>'id')::bigint = k_wait), 'B là người kiểm tra: không ở danh sách chờ của B';
  assert not exists (select 1 from jsonb_array_elements(jb->'followups') x where (x->>'training_id')::bigint = tid), 'B không phụ trách phiếu';
  assert exists (select 1 from jsonb_array_elements(jb->'done_today') x where x->>'kind' = 'gv' and (x->>'id')::bigint = k_today), 'B đã duyệt Đạt hôm nay: thấy trong Đã xong';

  raise exception 'REPORT>> PASS 125: review_wait=%, done_today=%, followups=% (A)', jsonb_array_length(j->'review_wait'), jsonb_array_length(j->'done_today'), jsonb_array_length(j->'followups');
end $$;
