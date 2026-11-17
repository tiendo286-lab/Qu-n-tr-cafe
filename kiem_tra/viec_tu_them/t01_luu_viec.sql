-- KIỂM TRA bước 123 (tệp 106): lưu / xoá việc tự thêm trong Bảng phân công. Chạy trong begin … rollback (in REPORT>>).
-- a) Chủ lưu việc mới 2 cơ sở (1 tắt) → số ≥ 100, 2 dòng lịch, người làm, 1 bước   b) thiếu tên   c) có kiểm tra mà thiếu người kiểm tra
-- d) người kiểm tra trùng người làm   e) QL tổng không sửa được   f) đổi ngày làm → from_date = hôm nay; không đổi → giữ
-- g) xoá khi có 1 việc đang mở → huỷ việc đó, bảng không còn việc   h) không xoá được việc có sẵn
begin;
do $$
declare chu uuid; qlt uuid; b1 bigint; b2 bigint; c1 text; d1 bigint; d2 bigint; k1 bigint; j int; r jsonb; tid bigint; n int;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false;
        f_ok boolean := false; g_ok boolean := false; h_ok boolean := false; m jsonb := '{}'::jsonb; fd0 text;
        base jsonb;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select a.auth_user_id into qlt from public.accounts a where a.system_role = 'ql_tong' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select id, coalesce(display_code, code) into b1, c1 from public.branches where status = 'Đang hoạt động' order by sort_order limit 1;
  select id into b2 from public.branches where status = 'Đang hoạt động' order by sort_order offset 1 limit 1;
  select id into d1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('nv', 'ql') order by id limit 1;
  select id into d2 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('nv', 'ql') order by id offset 1 limit 1;
  select id into k1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('ql', 'ql_tong') and id not in (d1, d2) order by id limit 1;
  base := jsonb_build_object('name', 'Vệ sinh máy pha (thử)', 'guide', 'Lau group head', 'need_photo', true, 'need_check', false, 'enabled', true,
    'rows', jsonb_build_array(
      jsonb_build_object('branch_id', b1, 'enabled', true, 'accounts', jsonb_build_array(d1), 'cycle', 'tuan', 'day', 2, 'grace_h', 24, 'fine', 50000, 'checkers', '[]'::jsonb, 'check_h', 24),
      jsonb_build_object('branch_id', b2, 'enabled', false, 'accounts', '[]'::jsonb, 'cycle', 'ngay', 'day', null, 'grace_h', 4, 'fine', 20000, 'checkers', '[]'::jsonb, 'check_h', 24)));
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- a)
  begin
    j := public.app_pc_custom_save(null, base);
    a_ok := j >= 100 and (select count(*) from public.pc_sched where job = j) = 2
      and (select accounts from public.pc_assign where job = j and branch_id = b1) = array[d1]
      and (select jsonb_array_length(steps) from public.pc_jobs where job = j) = 1
      and (select custom and need_photo and name = 'Vệ sinh máy pha (thử)' from public.pc_jobs where job = j)
      and (select from_date from public.pc_sched where job = j and branch_id = b1) = to_char(public.vn_now(), 'YYYY-MM-DD');
  exception when others then m := m || jsonb_build_object('a', sqlerrm);
  end;
  -- b)
  begin perform public.app_pc_custom_save(null, base || '{"name":"  "}'); m := m || '{"b":"không lỗi"}';
  exception when others then b_ok := sqlerrm = 'Ghi tên việc.'; m := m || jsonb_build_object('b', sqlerrm); end;
  -- c)
  begin perform public.app_pc_custom_save(null, base || '{"need_check":true}'); m := m || '{"c":"không lỗi"}';
  exception when others then c_ok := sqlerrm = 'Chọn người kiểm tra cho ' || c1 || '.'; m := m || jsonb_build_object('c', sqlerrm); end;
  -- d)
  begin
    perform public.app_pc_custom_save(null, base || jsonb_build_object('need_check', true, 'rows', jsonb_build_array(base->'rows'->0 || jsonb_build_object('checkers', jsonb_build_array(d1)))));
    m := m || '{"d":"không lỗi"}';
  exception when others then d_ok := sqlerrm = 'Người kiểm tra phải khác người làm.'; m := m || jsonb_build_object('d', sqlerrm); end;
  -- f) đổi ngày làm / giữ nguyên
  begin
    update public.pc_sched set from_date = '2026-01-01' where job = j;
    perform public.app_pc_custom_save(j, base || jsonb_build_object('guide', 'Lau kỹ hơn'));
    fd0 := (select from_date from public.pc_sched where job = j and branch_id = b1);
    perform public.app_pc_custom_save(j, base || jsonb_build_object('rows', jsonb_build_array(base->'rows'->0 || '{"day":3}', base->'rows'->1)));
    f_ok := fd0 = '2026-01-01' and (select from_date from public.pc_sched where job = j and branch_id = b1) = to_char(public.vn_now(), 'YYYY-MM-DD')
      and (select guide from public.pc_jobs where job = j) = 'Lau group head';
  exception when others then m := m || jsonb_build_object('f', sqlerrm);
  end;
  -- h)
  begin perform public.app_pc_custom_delete(1); m := m || '{"h":"không lỗi"}';
  exception when others then h_ok := sqlerrm = 'Chỉ xoá được việc tự thêm.'; m := m || jsonb_build_object('h', sqlerrm); end;
  -- g)
  begin
    insert into public.pc_tasks(job, key, branch_id, title, run_date) values (j, 'cu:' || j || ':' || b1 || ':2026-11-17', b1, 'thử', '2026-11-17') returning id into tid;
    insert into public.pc_steps(task_id, step, name, accounts, start_at) values (tid, 0, 'Làm', array[d1], public.vn_now_text());
    n := public.app_pc_custom_delete(j);
    r := public.app_pc_board();
    g_ok := n = 1 and (select done_note from public.pc_tasks where id = tid) = 'Việc đã bị xoá'
      and not exists (select 1 from public.pc_steps where task_id = tid and done_at is null)
      and not exists (select 1 from jsonb_array_elements(r->'jobs') x where (x->>'job')::int = j);
  exception when others then m := m || jsonb_build_object('g', sqlerrm);
  end;
  -- e)
  perform set_config('request.jwt.claims', json_build_object('sub', qlt, 'role', 'authenticated')::text, true);
  begin perform public.app_pc_custom_save(null, base); m := m || '{"e":"không lỗi"}';
  exception when others then e_ok := sqlerrm = 'Chỉ tài khoản Chủ sửa được Bảng phân công.'; m := m || jsonb_build_object('e', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok and f_ok and g_ok and h_ok then 'PASS' else 'FAIL' end,
    'a_luu_moi', a_ok, 'b_thieu_ten', b_ok, 'c_thieu_nguoi_kt', c_ok, 'd_kt_trung_nguoi_lam', d_ok, 'e_qlt_khong_sua', e_ok,
    'f_from_date', f_ok, 'g_xoa', g_ok, 'h_khong_xoa_viec_co_san', h_ok, 'loi', m, 'job', j);
end $$;
rollback;
