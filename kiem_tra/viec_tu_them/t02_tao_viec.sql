-- KIỂM TRA bước 123 (tệp 106): web tự tạo việc tự thêm theo lịch, làm bổ sung, phạt theo cơ sở. Chạy trong begin … rollback.
-- a) lịch tuần đúng thứ hôm nay → 1 việc, hạn = 23:59:59 hôm nay + quá hạn cho phép   b) tick 2 lần → vẫn 1 việc
-- c) hằng tháng ngày 31: tháng 2 → 28/02, tháng 4 → 30/04   d) lịch hôm qua → 1 việc "làm bổ sung" không hạn; lưu lại 2 lần → vẫn 1
-- e) quá hạn → phạt gợi ý theo mức cơ sở; việc bổ sung không phạt   f) cơ sở tắt → không việc   g) việc tắt → không việc
begin;
do $$
declare chu uuid; b1 bigint; b2 bigint; b3 bigint; d1 bigint; j int; j2 int; dw int; yw int; ww int; today date; base jsonb; t1 bigint; tx bigint; r jsonb;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false; f_ok boolean := false; g_ok boolean := false;
        m jsonb := '{}'::jsonb; due text; v jsonb;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select id into b1 from public.branches where status = 'Đang hoạt động' order by sort_order limit 1;
  select id into b2 from public.branches where status = 'Đang hoạt động' order by sort_order offset 1 limit 1;
  select id into b3 from public.branches where status = 'Đang hoạt động' order by sort_order offset 2 limit 1;
  select id into d1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('nv', 'ql') order by id limit 1;
  today := public.vn_now()::date; dw := extract(isodow from today); yw := extract(isodow from today - 1); ww := extract(isodow from today - 2);
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  base := jsonb_build_object('name', 'Lau kính (thử)', 'need_photo', false, 'need_check', false, 'enabled', true,
    'rows', jsonb_build_array(
      jsonb_build_object('branch_id', b1, 'enabled', true, 'accounts', jsonb_build_array(d1), 'cycle', 'tuan', 'day', dw, 'grace_h', 24, 'fine', 30000),
      jsonb_build_object('branch_id', b2, 'enabled', true, 'accounts', jsonb_build_array(d1), 'cycle', 'tuan', 'day', yw, 'grace_h', 24, 'fine', 20000),
      jsonb_build_object('branch_id', b3, 'enabled', false, 'accounts', jsonb_build_array(d1), 'cycle', 'ngay', 'grace_h', 4, 'fine', 10000)));
  j := public.app_pc_custom_save(null, base);
  j2 := public.app_pc_custom_save(null, base || jsonb_build_object('name', 'Việc tắt (thử)', 'enabled', false));
  perform public.app__pc_tick();
  -- a)
  begin
    select t.id, s.due_at into t1, due from public.pc_tasks t join public.pc_steps s on s.task_id = t.id where t.key = 'cu:' || j || ':' || b1 || ':' || today;
    a_ok := t1 is not null and due = to_char(today + 1, 'YYYY-MM-DD') || ' 23:59:59'
      and (select title from public.pc_tasks where id = t1) like 'Lau kính (thử) · % · ' || to_char(today, 'DD/MM')
      and (select accounts from public.pc_steps where task_id = t1) = array[d1];
  exception when others then m := m || jsonb_build_object('a', sqlerrm); end;
  -- b)
  begin
    perform public.app__pc_tick();
    b_ok := (select count(*) from public.pc_tasks where job = j and branch_id = b1 and not extra) = 1;
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  -- c)
  begin
    c_ok := (select array_agg(x) from public.app__pc_runs('thang', 31, '2027-02-01', '2027-04-30') x) = array['2027-02-28', '2027-03-31', '2027-04-30']::date[]
      and (select count(*) from public.app__pc_runs('ngay', null, '2027-02-01', '2027-02-07')) = 7
      and (select array_agg(x) from public.app__pc_runs('tuan', 2, '2027-02-01', '2027-02-14') x) = array['2027-02-02', '2027-02-09']::date[];
  exception when others then m := m || jsonb_build_object('c', sqlerrm); end;
  -- d)
  begin
    select id into tx from public.pc_tasks where job = j and branch_id = b2 and extra;
    perform public.app_pc_custom_save(j, base || jsonb_build_object('rows', jsonb_build_array(base->'rows'->0, base->'rows'->1 || '{"grace_h": 48}', base->'rows'->2)));
    perform public.app__pc_tick();
    perform public.app_pc_custom_save(j, base || jsonb_build_object('rows', jsonb_build_array(base->'rows'->0, base->'rows'->1 || jsonb_build_object('day', ww), base->'rows'->2)));
    perform public.app__pc_tick();
    d_ok := tx is not null and (select count(*) from public.pc_tasks where job = j and branch_id = b2) = 1
      and (select run_date from public.pc_tasks where id = tx) = to_char(today - 1, 'YYYY-MM-DD')
      and (select due_at from public.pc_steps where task_id = tx) is null;
  exception when others then m := m || jsonb_build_object('d', sqlerrm); end;
  -- e)
  begin
    update public.pc_steps set due_at = '2026-01-05 23:59:59' where task_id in (t1, tx);
    perform public.app__pc_tick();
    r := public.app_pc_penalties('2026-01');
    select x into v from jsonb_array_elements(r->'rows') x where (x->>'job')::int = j limit 1;
    e_ok := (select count(*) from public.pc_penalties where src = 'pc' and ref_id = t1) = 1
      and not exists (select 1 from public.pc_penalties where ref_id = tx and src = 'pc')
      and (v->>'fine')::bigint = 30000;
  exception when others then m := m || jsonb_build_object('e', sqlerrm); end;
  -- f) g)
  f_ok := not exists (select 1 from public.pc_tasks where job = j and branch_id = b3);
  g_ok := not exists (select 1 from public.pc_tasks where job = j2);
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok and f_ok and g_ok then 'PASS' else 'FAIL' end,
    'a_tao_dung_ngay', a_ok, 'b_khong_trung', b_ok, 'c_ngay_lam', c_ok, 'd_lam_bo_sung', d_ok, 'e_phat_theo_co_so', e_ok, 'f_co_so_tat', f_ok, 'g_viec_tat', g_ok,
    'loi', m, 'job', j, 'due', due);
end $$;
rollback;
