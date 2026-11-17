-- KIỂM TRA bước 126 (tệp 110): tên việc Lệch tiền không còn mã máy; Giao việc riêng báo người giao / người làm cũ; việc tự thêm bị xoá
-- không hiện "Xong"; việc Làm bổ sung quá 7 ngày tự bỏ. Chạy trong begin … rollback (in REPORT>>).
-- a) tên Lệch: 'tien_mat' → 'Tiền mặt'   b) báo xong khi người kiểm tra ≠ người giao → người giao được báo   c) Đạt → người giao được báo
-- d) đổi người làm → người làm cũ được báo   e) mục Đã xong: việc bị xoá có drop = true   f) Làm bổ sung quá 7 ngày → tự đóng, không phạt
begin;
do $$
declare chu uuid; uchu bigint; ud1 uuid; d1 bigint; d2 bigint; uk1 uuid; k1 bigint; b1 bigint; tid bigint; tid2 bigint; j int; tx bigint; r jsonb;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false; f_ok boolean := false; m jsonb := '{}'::jsonb;
begin
  select a.auth_user_id, a.id into chu, uchu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select id, auth_user_id into d1, ud1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('nv', 'ql') and auth_user_id is not null order by id limit 1;
  select id into d2 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('nv', 'ql') and id <> d1 order by id limit 1;
  select id, auth_user_id into k1, uk1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('ql', 'ql_tong') and auth_user_id is not null and id not in (d1, d2) order by id limit 1;
  select id into b1 from public.branches where status = 'Đang hoạt động' order by sort_order limit 1;
  -- a)
  begin
    a_ok := public.app__pc_item_label('tien_mat') = 'Tiền mặt' and public.app__pc_item_label('chuyen_khoan') = 'Chuyển khoản'
      and not exists (select 1 from public.app__pc_sources() x where x.job = 7 and x.title ~ '^Lệch [a-z]+_[a-z_]+ ');
  exception when others then m := m || jsonb_build_object('a', sqlerrm); end;
  -- b) c)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
    tid := public.app_gv_create(jsonb_build_object('content', 'Thử báo tin 126', 'branch_id', b1, 'assignee_id', d1, 'reviewer_id', k1, 'due', to_char(public.vn_now() + interval '1 day', 'YYYY-MM-DD HH24:MI'), 'priority', 'binh_thuong'));
    perform set_config('request.jwt.claims', json_build_object('sub', ud1, 'role', 'authenticated')::text, true);
    perform public.app_gv_accept(tid);
    perform public.app_gv_submit(tid, 'Đã làm', 'cv' || tid || '/a.jpg');
    b_ok := exists (select 1 from public.notifications where account_id = uchu and title = 'Việc đã báo xong' and body like '%Thử báo tin 126%');
    perform set_config('request.jwt.claims', json_build_object('sub', uk1, 'role', 'authenticated')::text, true);
    perform public.app_gv_review(tid, true, null, null);
    c_ok := exists (select 1 from public.notifications where account_id = uchu and title = 'Việc đã được xác nhận Đạt' and body like '%Thử báo tin 126%');
  exception when others then m := m || jsonb_build_object('bc', sqlerrm); end;
  -- d)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
    tid2 := public.app_gv_create(jsonb_build_object('content', 'Thử đổi người 126', 'branch_id', b1, 'assignee_id', d1, 'reviewer_id', k1, 'due', to_char(public.vn_now() + interval '1 day', 'YYYY-MM-DD HH24:MI'), 'priority', 'binh_thuong'));
    perform public.app_gv_reassign(tid2, d2, null);
    d_ok := exists (select 1 from public.notifications where account_id = d1 and title = 'Việc đã chuyển cho người khác' and body like '%Thử đổi người 126%');
  exception when others then m := m || jsonb_build_object('d', sqlerrm); end;
  -- e)
  begin
    j := public.app_pc_custom_save(null, jsonb_build_object('name', 'Thử xoá 126', 'need_photo', false, 'need_check', false, 'enabled', true,
      'rows', jsonb_build_array(jsonb_build_object('branch_id', b1, 'enabled', true, 'accounts', jsonb_build_array(uchu), 'cycle', 'ngay', 'grace_h', 24, 'fine', 0))));
    perform public.app__pc_tick();
    perform public.app_pc_custom_delete(j);
    r := public.app_pc_mine();
    e_ok := exists (select 1 from jsonb_array_elements(r->'done') x where x->>'title' like 'Thử xoá 126%' and (x->>'drop')::boolean);
  exception when others then m := m || jsonb_build_object('e', sqlerrm); end;
  -- f)
  begin
    j := public.app_pc_custom_save(null, jsonb_build_object('name', 'Thử bổ sung 126', 'need_photo', false, 'need_check', false, 'enabled', true,
      'rows', jsonb_build_array(jsonb_build_object('branch_id', b1, 'enabled', true, 'accounts', jsonb_build_array(d1), 'cycle', 'tuan', 'day', extract(isodow from public.vn_now()::date - 1)::int, 'grace_h', 24, 'fine', 50000))));
    perform public.app__pc_tick();
    select id into tx from public.pc_tasks where job = j and extra;
    update public.pc_tasks set created_at = to_char(public.vn_now() - interval '8 day', 'YYYY-MM-DD HH24:MI:SS') where id = tx;
    perform public.app__pc_tick();
    f_ok := tx is not null and (select done_at is not null and done_note = 'Quá 7 ngày — bỏ làm bổ sung' from public.pc_tasks where id = tx)
      and not exists (select 1 from public.pc_penalties where ref_id = tx);
  exception when others then m := m || jsonb_build_object('f', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok and f_ok then 'PASS' else 'FAIL' end,
    'a_ten_lech', a_ok, 'b_bao_nguoi_giao_bao_xong', b_ok, 'c_bao_nguoi_giao_dat', c_ok, 'd_bao_nguoi_cu', d_ok, 'e_xoa_khong_hien_xong', e_ok, 'f_bo_sung_7_ngay', f_ok, 'loi', m);
end $$;
rollback;
