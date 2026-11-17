-- KIỂM TRA bước 124 (tệp 107): việc có sẵn cài đặt từng cơ sở. Chạy trong begin … rollback (in REPORT>>).
-- a) sau 107: có lịch từng cơ sở bằng giá trị cũ; chạy tick không đóng / không đổi hạn việc đang mở
-- b) tắt Kiểm quỹ ở 1 cơ sở → không tạo việc mới cơ sở đó; việc đang mở của cơ sở tắt không bị đóng
-- c) mức phạt theo cơ sở   d) Kiểm quỹ đổi sang Thứ (hôm nay) → tạo việc hôm nay, hạn 23:59 + quá hạn cho phép
-- e) Có kiểm tra: hồ sơ xong → bước Kiểm tra; Làm lại → bước làm lại không bị tự đóng; báo xong → Kiểm tra; Đạt → đóng
-- f) không nhận bước thêm tay   g) đổi ngày Kiểm quỹ giữa kỳ không tự đóng việc kỳ cũ
begin;
do $$
declare chu uuid; uk1 uuid; k1 bigint; b5 bigint; t5 bigint; g_ok boolean := false; b1 bigint; b2 bigint; b3 bigint; b4 bigint; c1 text; nb int; n0 int; n1 int; d0 text; d1 text; dw int; today date; tb2 bigint; tb4 bigint; t3 bigint; r jsonb; st public.pc_steps; rows jsonb;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false; f_ok boolean := false; m jsonb := '{}'::jsonb;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select id, auth_user_id into k1, uk1 from public.accounts a where coalesce(locked, 0) = 0 and system_role in ('ql', 'ql_tong', 'chu') and auth_user_id is not null
     and not exists (select 1 from public.pc_assign pa where pa.job = 1 and a.id = any(pa.accounts)) order by (system_role = 'chu'), id limit 1;
  select id into b1 from public.branches where status = 'Đang hoạt động' order by sort_order limit 1;
  select id into b2 from public.branches where status = 'Đang hoạt động' order by sort_order offset 1 limit 1;
  select id, coalesce(display_code, code) into b3, c1 from public.branches where status = 'Đang hoạt động' order by sort_order offset 2 limit 1;
  select id into b4 from public.branches where status = 'Đang hoạt động' order by sort_order offset 3 limit 1;
  select count(*) into nb from public.branches where status = 'Đang hoạt động';
  today := public.vn_now()::date; dw := extract(isodow from today);
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- a)
  begin
    select count(*), string_agg(s.id || '=' || coalesce(s.due_at, '-'), ',' order by s.id) into n0, d0
      from public.pc_steps s join public.pc_tasks t on t.id = s.task_id where t.done_at is null and s.done_at is null;
    update public.settings set value = '2000-01-01 00:00:00' where key = 'pc_tick_at';
    perform public.app__pc_tick();
    select count(*), string_agg(s.id || '=' || coalesce(s.due_at, '-'), ',' order by s.id) into n1, d1
      from public.pc_steps s join public.pc_tasks t on t.id = s.task_id where t.done_at is null and s.done_at is null;
    a_ok := (select count(*) from public.pc_sched where job in (1, 3, 4, 7, 8, 10, 11, 12)) = 8 * nb
      and (select due_h = 24 and fine = (select fine from public.pc_jobs where job = 1) from public.pc_sched where job = 1 and branch_id = b1)
      and (select cycle = 'tuan' and day = 1 and grace_h = 72 from public.pc_sched where job = 10 and branch_id = b1)
      and (select due_h is null from public.pc_sched where job = 8 and branch_id = b1)
      and n0 = n1 and d0 = d1;
    if not a_ok then m := m || jsonb_build_object('a', json_build_object('n0', n0, 'n1', n1, 'same_due', d0 = d1)); end if;
  exception when others then m := m || jsonb_build_object('a', sqlerrm); end;
  -- b)
  begin
    update public.pc_sched set enabled = false where job = 10 and branch_id in (b1, b4);
    delete from public.pc_tasks where job = 10 and branch_id in (b1, b2) and done_at is null;
    select id into tb4 from public.pc_tasks where job = 10 and branch_id = b4 and done_at is null;
    perform public.app__pc_tick();
    select id into tb2 from public.pc_tasks where job = 10 and branch_id = b2 and done_at is null;
    b_ok := tb2 is not null and not exists (select 1 from public.pc_tasks where job = 10 and branch_id = b1 and done_at is null)
      and (tb4 is null or (select done_at is null from public.pc_tasks where id = tb4));
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  -- c)
  begin
    update public.pc_sched set fine = 30000 where job = 10 and branch_id = b2;
    update public.pc_steps set due_at = to_char(today, 'YYYY-MM-DD') || ' 00:30:00' where task_id = tb2 and done_at is null;
    perform public.app__pc_tick();
    r := public.app_pc_penalties(to_char(today, 'YYYY-MM'));
    c_ok := exists (select 1 from jsonb_array_elements(r->'rows') x where (x->>'job')::int = 10 and x->>'code' = (select coalesce(display_code, code) from public.branches where id = b2) and (x->>'fine')::bigint = 30000);
  exception when others then m := m || jsonb_build_object('c', sqlerrm); end;
  -- d)
  begin
    perform public.app_pc_job_save(10, jsonb_build_object('enabled', true, 'fine', 50000, 'need_check', false,
      'rows', jsonb_build_array(jsonb_build_object('branch_id', b3, 'enabled', true, 'due_h', null, 'fine', 50000, 'cycle', 'tuan', 'day', dw, 'grace_h', 72))));
    delete from public.pc_tasks where job = 10 and branch_id = b3 and done_at is null;
    perform public.app__pc_tick();
    select t.id into t3 from public.pc_tasks t where t.key = '10:kq:' || b3 || ':' || to_char(today, 'YYYY-MM-DD');
    d_ok := t3 is not null and (select due_at from public.pc_steps where task_id = t3 and done_at is null) = to_char(today + 3, 'YYYY-MM-DD') || ' 23:59:59'
      and (select from_date from public.pc_sched where job = 10 and branch_id = b3) = to_char(today, 'YYYY-MM-DD');
    if not d_ok then m := m || jsonb_build_object('d', json_build_object('t3', t3, 'due', (select due_at from public.pc_steps where task_id = t3 and done_at is null))); end if;
  exception when others then m := m || jsonb_build_object('d', sqlerrm); end;
  -- e)
  begin
    select jsonb_agg(jsonb_build_object('branch_id', id, 'enabled', true, 'due_h', null, 'fine', 50000, 'cycle', 'tuan', 'day', 1, 'grace_h', 72, 'checkers', jsonb_build_array(k1), 'check_h', 12)) into rows
      from public.branches where status = 'Đang hoạt động' and id <> b3;
    perform public.app_pc_job_save(10, jsonb_build_object('enabled', true, 'fine', 50000, 'need_check', true,
      'rows', rows || jsonb_build_array(jsonb_build_object('branch_id', b3, 'enabled', true, 'due_h', null, 'fine', 50000, 'cycle', 'tuan', 'day', dw, 'grace_h', 72, 'checkers', jsonb_build_array(k1), 'check_h', 12))));
    set local session_replication_role = replica;
    insert into public.fund_counts(branch_id, method, count_date, counted, book, created_at) values (b2, 'tien_mat', to_char(today, 'YYYY-MM-DD'), 0, 0, public.vn_now_text());
    set local session_replication_role = origin;
    perform public.app__pc_tick();
    select * into st from public.pc_steps where task_id = tb2 and done_at is null;
    e_ok := st.name = 'Kiểm tra' and st.accounts = array[k1] and st.due_at = public.app__pc_add(st.start_at, 0.5);
    perform set_config('request.jwt.claims', json_build_object('sub', uk1, 'role', 'authenticated')::text, true);
    perform public.app_pc_check(tb2, false, 'Đếm lại', 24);
    perform public.app__pc_tick();
    select * into st from public.pc_steps where task_id = tb2 and done_at is null;
    e_ok := e_ok and st.redo and st.step = 0;
    perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
    perform public.app_pc_report_done(tb2, 'Đã đếm lại', null);
    select * into st from public.pc_steps where task_id = tb2 and done_at is null;
    e_ok := e_ok and st.name = 'Kiểm tra';
    perform public.app_pc_check(tb2, true, null, null);
    e_ok := e_ok and (select done_at is not null from public.pc_tasks where id = tb2);
  exception when others then m := m || jsonb_build_object('e', sqlerrm); end;
  -- g) đổi ngày Kiểm quỹ giữa kỳ: việc kỳ cũ đang mở (chưa kiểm quỹ) KHÔNG bị tự đóng
  begin
    select id into b5 from public.branches where status = 'Đang hoạt động' order by sort_order offset 4 limit 1;
    select id into t5 from public.pc_tasks where job = 10 and branch_id = b5 and done_at is null order by id limit 1;
    perform public.app_pc_job_save(10, jsonb_build_object('enabled', true, 'fine', 50000, 'need_check', false,
      'rows', jsonb_build_array(jsonb_build_object('branch_id', b5, 'enabled', true, 'due_h', null, 'fine', 50000, 'cycle', 'tuan', 'day', dw, 'grace_h', 72))));
    perform public.app__pc_tick();
    g_ok := t5 is not null and (select done_at is null from public.pc_tasks where id = t5);
    if not g_ok then m := m || jsonb_build_object('g', json_build_object('t5', t5, 'note', (select done_note from public.pc_tasks where id = t5))); end if;
  exception when others then m := m || jsonb_build_object('g', sqlerrm); end;
  -- f)
  begin
    perform public.app_pc_job_save(1, jsonb_build_object('enabled', true, 'fine', 50000, 'steps', '[{"n":"Đối soát","who":"branch","d":1},{"n":"Kiểm tra lại","who":"branch","d":1}]'::jsonb));
    m := m || '{"f":"không lỗi"}';
  exception when others then f_ok := sqlerrm = 'Việc này không thêm bước được — dùng Có kiểm tra.'; m := m || jsonb_build_object('f', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok and f_ok and g_ok then 'PASS' else 'FAIL' end,
    'a_giu_nguyen', a_ok, 'b_tat_co_so', b_ok, 'c_phat_co_so', c_ok, 'd_kiem_quy_lich', d_ok, 'e_kiem_tra', e_ok, 'f_khong_them_buoc', f_ok, 'g_doi_ngay_khong_dong', g_ok, 'loi', m);
end $$;
rollback;
