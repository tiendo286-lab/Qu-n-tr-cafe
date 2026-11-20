-- Bài thử cho supabase/149_dao_tao_tab_phan_cong.sql (bước 170). Gửi SAU tệp 148 + 149. Dữ liệu giả năm 2031, REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; hdc public.accounts; qlk public.accounts; ptc public.accounts; c1 public.accounts;
  trainee bigint; trainee2 bigint; tid bigint; tid2 bigint; x1 bigint; x2 bigint; z bigint; br1 bigint; br2 bigint; wk bigint;
  j jsonb; r jsonb; n int := 0; e text; k int; k2 int; sh text[] := public.app__shifts();
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  select a.* into hdc from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Quản lý' and x.status = 'Đang làm' and a.system_role <> 'chu' order by (a.system_role <> 'ql'), a.id limit 1;
  select a.* into qlk from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Quản lý' and x.status = 'Đang làm' and a.system_role = 'ql' and a.id <> hdc.id order by a.id limit 1;
  select a.* into c1 from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Cấp 1' and x.status = 'Đang làm' order by a.id limit 1;
  select a.* into ptc from public.accounts a where a.locked = 0 and a.auth_user_id is not null and a.id not in (chu.id, hdc.id, qlk.id, c1.id) and a.system_role not in ('nv', 'ql') order by (a.system_role = 'ql_tong'), a.id limit 1;
  if hdc.id is null or qlk.id is null or c1.id is null or ptc.id is null then raise exception 'Thiếu tài khoản để thử'; end if;
  insert into public.training_review_config(singleton, account_id) values (true, ptc.id) on conflict (singleton) do update set account_id = excluded.account_id;
  select id into br1 from public.branches where status = 'Đang hoạt động' order by sort_order, id limit 1;
  select id into br2 from public.branches where status = 'Đang hoạt động' and id <> br1 order by sort_order, id limit 1;
  -- người giả: NV mới ×2, Cấp 1 X (trùng 2 ca), Cấp 1 Z (cùng cơ sở, không trùng ca)
  insert into public.employees(code, name, rank, status) values ('T149', 'NV mới 149', 'Thử việc', 'Đang làm') returning id into trainee;
  insert into public.employees(code, name, rank, status) values ('T149B', 'NV mới 149B', 'Thử việc', 'Đang làm') returning id into trainee2;
  insert into public.employees(code, name, rank, status) values ('T149X', 'Cấp 1 X 149', 'Cấp 1', 'Đang làm') returning id into x1;
  insert into public.employees(code, name, rank, status) values ('T149Z', 'Cấp 1 Z 149', 'Cấp 1', 'Đang làm') returning id into z;
  insert into public.accounts(employee_id, login_name, system_role, locked) select v, 't149_' || v, 'nv', 0 from unnest(array[x1, z]) v
    on conflict (employee_id) do update set locked = 0;
  insert into public.employee_branches(employee_id, branch_id) values (z, br1) on conflict do nothing;
  insert into public.weeks(start_date, end_date) values ('2031-03-03', '2031-03-09') returning id into wk;
  -- NV mới (bắt đầu 04/03): ca 03/03 (trước ngày bắt đầu — bỏ), 04/03 sh1 br1, 05/03 sh2 br1, 06/03 sh1 br2, 09/03 sh1 br1; X trùng 04/03 sh1 br1 + 05/03 sh2 br1 (06/03 khác ca)
  insert into public.schedule_published(week_id, employee_id, weekday, shift, branch_id, role, published_at) values
    (wk, trainee, 0, sh[1], br1, 'phuc_vu', '2031-03-01 10:00:00'), (wk, trainee, 1, sh[1], br1, 'phuc_vu', '2031-03-01 10:00:00'),
    (wk, trainee, 2, sh[2], br1, 'phuc_vu', '2031-03-01 10:00:00'), (wk, trainee, 3, sh[1], br2, 'phuc_vu', '2031-03-01 10:00:00'),
    (wk, trainee, 6, sh[1], br1, 'phuc_vu', '2031-03-01 10:00:00'),
    (wk, x1, 1, sh[1], br1, 'phuc_vu', '2031-03-01 10:00:00'), (wk, x1, 2, sh[2], br1, 'phuc_vu', '2031-03-01 10:00:00'), (wk, x1, 3, sh[2], br2, 'phuc_vu', '2031-03-01 10:00:00');
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(trainee, jsonb_build_object('start_date', '2031-03-04', 'instructor_id', hdc.employee_id, 'branch_id', br2));
  tid2 := public.app_dt_create(trainee2, jsonb_build_object('start_date', '2031-03-04', 'instructor_id', qlk.employee_id));

  -- 1. ai thấy: HDC chỉ phiếu mình; Chủ + PTC mọi phiếu; Cấp 1 không thấy tab
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_assign_board('chay_ban');
  if not (j ->> 'can_board')::boolean or not exists (select 1 from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid)
     or exists (select 1 from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid2) then raise exception 'SAI 1: HDC phải thấy đúng phiếu của mình'; end if; n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', ptc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_assign_board('chay_ban');
  if (select count(*) from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint in (tid, tid2)) <> 2 then raise exception 'SAI 2: PTC phải thấy mọi phiếu mở'; end if; n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', c1.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_assign_board('chay_ban');
  if (j ->> 'can_board')::boolean then raise exception 'SAI 3: Cấp 1 không được thấy tab Phân công'; end if; n := n + 1;
  -- 2. lịch + gợi ý (xem bằng Chủ)
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_assign_board('chay_ban');
  select x into r from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid;
  if jsonb_array_length(r -> 'sched') <> 4 then raise exception 'SAI 4: lịch phải chỉ lấy ca đã công bố từ ngày bắt đầu → hạn (4 ca, bỏ ca 03/03 trước ngày bắt đầu), có %', r -> 'sched'; end if; n := n + 1;
  if (r ->> 'best_branch')::bigint <> br1 then raise exception 'SAI 5: cơ sở gợi ý phải là nơi nhiều ca nhất (br1), có %', r ->> 'best_branch'; end if; n := n + 1;
  if (r -> 'same' -> 0 ->> 'id')::bigint is distinct from x1 or (r -> 'same' -> 0 ->> 'n')::int <> 2 then raise exception 'SAI 6: Cùng ca phải có Cấp 1 X "trùng 2 ca" (04/03 + 05/03 cùng cơ sở, cùng ca), có %', r -> 'same'; end if; n := n + 1;
  if not exists (select 1 from jsonb_array_elements(r -> 'br_c1') x where (x ->> 'id')::bigint = z) then raise exception 'SAI 7: "Cấp 1 cơ sở" thiếu Cấp 1 Z'; end if; n := n + 1;
  if not exists (select 1 from jsonb_array_elements(r -> 'other') x where (x ->> 'id')::bigint = hdc.employee_id and (x ->> 'hdc')::boolean) then raise exception 'SAI 8: nhóm Khác thiếu HD chính'; end if; n := n + 1;
  if (r ->> 'n_chua')::int <> (r ->> 'total')::int or (r ->> 'n_kt')::int <> 0 then raise exception 'SAI 9: phiếu mới phải chưa giao hết: %/%', r ->> 'n_chua', r ->> 'total'; end if; n := n + 1;

  -- 3. giao hàng loạt (HDC) 3 hạng mục cho X → 1 thông báo gộp
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  select count(*) into k from public.notifications x join public.accounts ac on ac.id = x.account_id where ac.employee_id = x1;
  j := public.app_dt_assign_bulk(tid, array[1, 2, 3], x1, br1, 'kèm ca sáng');
  select count(*) into k2 from public.notifications x join public.accounts ac on ac.id = x.account_id where ac.employee_id = x1;
  if k2 <> k + 1 or not exists (select 1 from public.notifications x join public.accounts ac on ac.id = x.account_id where ac.employee_id = x1 and x.title = 'Bạn được giao hướng dẫn 3 hạng mục') then
    raise exception 'SAI 10: giao 3 hạng mục phải đúng 1 thông báo gộp (có % mới)', k2 - k; end if; n := n + 1;
  j := public.app_dt_assign_board('chay_ban'); select x into r from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid;
  if (r ->> 'n_dang')::int <> 3 or (r ->> 'n_chua')::int <> (r ->> 'total')::int - 3 then raise exception 'SAI 11: sau giao: đang giao 3, chưa giao total-3'; end if; n := n + 1;
  if (select count(*) from public.training_followups where training_id = tid and branch_id = br1 and note = 'kèm ca sáng') <> 3 then raise exception 'SAI 12: giao hàng loạt phải lưu cơ sở + ghi chú'; end if; n := n + 1;
  -- Quản lý khác giao hàng loạt bị chặn (dùng chung kiểm tra quyền)
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_assign_bulk(tid, array[4], x1, null, null); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 13: Quản lý khác giao hàng loạt được'; end if; end; n := n + 1;
  -- 4. Cấp 1 X ghi mục 3 → Chờ kiểm tra hiện ở bảng
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from public.accounts where employee_id = x1), 'role', 'authenticated')::text, true);
  if (select auth_user_id from public.accounts where employee_id = x1) is null then
    update public.accounts set auth_user_id = gen_random_uuid() where employee_id = x1;
    perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from public.accounts where employee_id = x1), 'role', 'authenticated')::text, true);
  end if;
  perform public.app_dt_mark(tid, 3, '{"introduced": true, "practiced": true, "level": "kha"}');
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_assign_board('chay_ban'); select x into r from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid;
  if (r ->> 'n_kt')::int <> 1 or not exists (select 1 from jsonb_array_elements(r -> 'items') x where (x ->> 'no')::int = 3 and x ->> 'state' = 'cho_kt') then raise exception 'SAI 14: mục Cấp 1 ghi phải hiện Chờ kiểm tra ở bảng'; end if; n := n + 1;
  -- 5. Trả về HD chính
  perform public.app_dt_assign_bulk(tid, array[1, 2], null, null, null);
  j := public.app_dt_assign_board('chay_ban'); select x into r from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid;
  if exists (select 1 from jsonb_array_elements(r -> 'items') x where (x ->> 'no')::int in (1, 2) and x ->> 'state' <> 'chua_giao') then raise exception 'SAI 15: Trả về HD chính → Chưa giao'; end if; n := n + 1;
  -- 6. mục Pha chế không lẫn
  j := public.app_dt_assign_board('pha_che');
  if exists (select 1 from jsonb_array_elements(j -> 'rows') x where (x ->> 'id')::bigint = tid) then raise exception 'SAI 16: phiếu Chạy bàn lọt vào Pha chế'; end if; n := n + 1;

  raise exception 'REPORT>> ĐẠT % kiểm tra (tệp 149)', n;
end $$;
