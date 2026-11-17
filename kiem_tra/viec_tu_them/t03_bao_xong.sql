-- KIỂM TRA bước 123 (tệp 106): báo xong kèm ảnh, kiểm tra Đạt / Làm lại. Chạy trong begin … rollback.
-- a) bắt buộc ảnh: thiếu ảnh → lỗi; có ảnh, không kiểm tra → việc đóng, lưu ảnh   b) có kiểm tra → mở bước Kiểm tra cho người kiểm tra, hạn = check_h
-- c) người làm bấm kiểm tra → lỗi   d) Làm lại thiếu lý do / hạn sai → lỗi; đủ → bước làm lại (redo) cho người làm cũ; báo xong lại → Kiểm tra;
--    quá hạn kiểm tra → phạt người kiểm tra; Đạt → đóng   e) người kiểm tra bị khoá → bước Kiểm tra trống, Chủ Đạt được   g) "Xong bước" cũ không dùng cho việc tự thêm
begin;
do $$
declare chu uuid; ud1 uuid; uk1 uuid; b1 bigint; d1 bigint; k1 bigint; k2 bigint; dw int; j1 int; j2 int; j3 int; t1 bigint; t2 bigint; t3 bigint; base jsonb;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false; g_ok boolean := false;
        m jsonb := '{}'::jsonb; st public.pc_steps; e1 text; e2 text; e3 text;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select id, auth_user_id into d1, ud1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('nv', 'ql') and auth_user_id is not null order by id limit 1;
  select id, auth_user_id into k1, uk1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('ql', 'ql_tong') and auth_user_id is not null and id <> d1 order by id limit 1;
  select id into k2 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('ql', 'ql_tong', 'nv') and id not in (d1, k1) order by id limit 1;
  select id into b1 from public.branches where status = 'Đang hoạt động' order by sort_order limit 1;
  dw := extract(isodow from public.vn_now()::date);
  base := jsonb_build_object('name', 'Thử báo xong', 'need_photo', true, 'need_check', false, 'enabled', true,
    'rows', jsonb_build_array(jsonb_build_object('branch_id', b1, 'enabled', true, 'accounts', jsonb_build_array(d1), 'cycle', 'tuan', 'day', dw, 'grace_h', 24, 'fine', 30000,
      'checkers', jsonb_build_array(k1), 'check_h', 12)));
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  j1 := public.app_pc_custom_save(null, base);
  j2 := public.app_pc_custom_save(null, base || '{"name":"Thử kiểm tra","need_check":true,"need_photo":false}');
  j3 := public.app_pc_custom_save(null, base || jsonb_build_object('name', 'Thử khoá', 'need_check', true, 'need_photo', false,
          'rows', jsonb_build_array(base->'rows'->0 || jsonb_build_object('checkers', jsonb_build_array(k2)))));
  set local session_replication_role = replica; update public.accounts set locked = 1 where id = k2; set local session_replication_role = origin;
  perform public.app__pc_tick();
  select id into t1 from public.pc_tasks where job = j1; select id into t2 from public.pc_tasks where job = j2; select id into t3 from public.pc_tasks where job = j3;
  perform set_config('request.jwt.claims', json_build_object('sub', ud1, 'role', 'authenticated')::text, true);
  -- g)
  begin perform public.app_pc_step_done(t1); m := m || '{"g":"không lỗi"}';
  exception when others then g_ok := sqlerrm = 'Bấm Báo xong ở thẻ việc.'; m := m || jsonb_build_object('g', sqlerrm); end;
  -- a)
  begin perform public.app_pc_report_done(t1, 'Đã lau', '{}'); e1 := 'không lỗi'; exception when others then e1 := sqlerrm; end;
  begin
    perform public.app_pc_report_done(t1, 'Đã lau', array['pc' || t1 || '/a.jpg']);
    a_ok := e1 = 'Cần ít nhất 1 ảnh mới báo xong được.' and (select done_at is not null from public.pc_tasks where id = t1)
      and (select photos = array['pc' || t1 || '/a.jpg'] and note = 'Đã lau' and done_by = d1 from public.pc_steps where task_id = t1 and step = 0);
  exception when others then m := m || jsonb_build_object('a', sqlerrm, 'a1', e1); end;
  -- b)
  begin
    perform public.app_pc_report_done(t2, 'Xong', null);
    select * into st from public.pc_steps where task_id = t2 and done_at is null;
    b_ok := st.name = 'Kiểm tra' and st.step = 1 and st.accounts = array[k1] and st.due_at = public.app__pc_add(st.start_at, 0.5)
      and (select done_at is null from public.pc_tasks where id = t2);
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  -- c)
  begin perform public.app_pc_check(t2, true, null, null); m := m || '{"c":"không lỗi"}';
  exception when others then c_ok := sqlerrm = 'Bước này không giao cho bạn.'; m := m || jsonb_build_object('c', sqlerrm); end;
  -- d)
  perform set_config('request.jwt.claims', json_build_object('sub', uk1, 'role', 'authenticated')::text, true);
  begin perform public.app_pc_check(t2, false, ' ', 24); e2 := 'không lỗi'; exception when others then e2 := sqlerrm; end;
  begin perform public.app_pc_check(t2, false, 'Lau lại', 5); e3 := 'không lỗi'; exception when others then e3 := sqlerrm; end;
  begin
    perform public.app_pc_check(t2, false, 'Lau lại', 24);
    select * into st from public.pc_steps where task_id = t2 and done_at is null;
    d_ok := e2 = 'Ghi lý do làm lại.' and e3 = 'Chọn hạn làm lại.' and st.step = 0 and st.redo and st.accounts = array[d1] and st.due_at = public.app__pc_add(st.start_at, 1)
      and (select note from public.pc_steps where task_id = t2 and name = 'Kiểm tra' and done_at is not null) = 'Lau lại';
    perform set_config('request.jwt.claims', json_build_object('sub', ud1, 'role', 'authenticated')::text, true);
    perform public.app_pc_report_done(t2, 'Đã lau lại', null);
    update public.pc_steps set due_at = '2026-01-06 10:00:00' where task_id = t2 and done_at is null and name = 'Kiểm tra';
    perform public.app__pc_tick();
    d_ok := d_ok and exists (select 1 from public.pc_penalties where ref_id = t2 and account_id = k1 and step_name = 'Kiểm tra');
    perform set_config('request.jwt.claims', json_build_object('sub', uk1, 'role', 'authenticated')::text, true);
    perform public.app_pc_check(t2, true, null, null);
    d_ok := d_ok and (select done_at is not null from public.pc_tasks where id = t2);
  exception when others then m := m || jsonb_build_object('d', sqlerrm, 'd2', e2, 'd3', e3); end;
  -- e)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', ud1, 'role', 'authenticated')::text, true);
    perform public.app_pc_report_done(t3, 'Xong', null);
    select * into st from public.pc_steps where task_id = t3 and done_at is null;
    perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
    perform public.app_pc_check(t3, true, null, null);
    e_ok := st.name = 'Kiểm tra' and cardinality(st.accounts) = 0 and (select done_at is not null from public.pc_tasks where id = t3);
  exception when others then m := m || jsonb_build_object('e', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok and g_ok then 'PASS' else 'FAIL' end,
    'a_bat_buoc_anh', a_ok, 'b_mo_kiem_tra', b_ok, 'c_nguoi_lam_khong_kiem', c_ok, 'd_lam_lai_dat_phat', d_ok, 'e_kt_bi_khoa_chu_dat', e_ok, 'g_khong_xong_buoc', g_ok, 'loi', m);
end $$;
rollback;
