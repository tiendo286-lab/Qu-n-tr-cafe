-- KIỂM TRA bước 127 (tệp 111): bỏ nhắc nhân viên về phiếu chốt ca, chỉ báo người đối soát 1 lần (2 giờ sau hết ca, 7–22 giờ);
-- báo trước hạn 1 giờ + lúc vừa trễ cho việc trong Bảng phân công và Giao việc riêng; số đếm phạt chờ xác nhận. Chạy trong begin … rollback.
-- a) phiếu chưa xong: nhân viên không bị nhắc; người đối soát nhận đúng 1 lần   b) việc sắp hết hạn → báo 1 lần; vừa trễ → báo 1 lần; trễ lâu (lúc lên bản) → không báo
-- c) Giao việc riêng sắp hết hạn → người làm được báo   d) app_viec_reminder có pen_wait cho Chủ, nhân viên = 0
begin;
do $$
declare chu uuid; uchu bigint; ud1 uuid; d1 bigint; k1 bigint; b1 bigint; rid bigint; e timestamp; pn timestamp; ql bigint[]; staff bigint[]; n0 int; n1 int; n2 int;
        j int; t1 bigint; sid bigint; gid bigint; r jsonb;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; m jsonb := '{}'::jsonb;
begin
  select a.auth_user_id, a.id into chu, uchu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select id, auth_user_id into d1, ud1 from public.accounts where coalesce(locked, 0) = 0 and system_role = 'nv' and auth_user_id is not null order by id limit 1;
  select id into k1 from public.accounts where coalesce(locked, 0) = 0 and system_role in ('ql', 'ql_tong') and id <> d1 order by id limit 1;
  -- a) chọn 1 phiếu có người đối soát, giờ hết ca + 3 giờ rơi vào 7–21 giờ
  begin
    select r0.id, public.app__ca_end_at(r0) into rid, e from public.shift_reports r0
     where public.app__ca_end_at(r0) is not null and extract(hour from public.app__ca_end_at(r0) + interval '3 hour') between 7 and 20
       and cardinality(public.app__pc_who(1, 'branch', r0.branch_id)) > 0
       and exists (select 1 from public.shift_report_staff s join public.accounts ac on ac.employee_id = s.employee_id where s.report_id = r0.id and s.worked = 1)
     order by r0.work_date desc limit 1;
    set local session_replication_role = replica;
    update public.shift_reports set status = 'dang_chot' where id = rid;
    set local session_replication_role = origin;
    ql := public.app__pc_who(1, 'branch', (select branch_id from public.shift_reports where id = rid));
    staff := array(select ac.id from public.shift_report_staff s join public.accounts ac on ac.employee_id = s.employee_id where s.report_id = rid and s.worked = 1 and not ac.id = any(ql));
    delete from public.notifications where title like 'Phiếu chốt ca chưa xong%' and link = '/ca/phieu?id=' || rid;   -- bỏ thông báo cũ của phiếu này (trong giao dịch thử)
    perform public.app_ca_part_tick(e + interval '1 hour');                 -- mới 1 giờ: chưa báo
    select count(*) into n0 from public.notifications where title like 'Phiếu chốt ca chưa xong%' and link = '/ca/phieu?id=' || rid;
    perform public.app_ca_part_tick(e + interval '3 hour');
    perform public.app_ca_part_tick(e + interval '4 hour');
    select count(*) into n1 from public.notifications where title like 'Phiếu chốt ca chưa xong%' and link = '/ca/phieu?id=' || rid and account_id = any(ql);
    select count(*) into n2 from public.notifications where title like 'Phiếu chốt ca chưa xong%' and link = '/ca/phieu?id=' || rid and account_id = any(staff);
    a_ok := rid is not null and n0 = 0 and n1 = cardinality(ql) and n2 = 0;
    if not a_ok then m := m || jsonb_build_object('a', json_build_object('rid', rid, 'n0', n0, 'n1', n1, 'ql', cardinality(ql), 'n2', n2)); end if;
  exception when others then m := m || jsonb_build_object('a', sqlerrm); end;
  select id into b1 from public.branches where status = 'Đang hoạt động' order by sort_order limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- b)
  begin
    j := public.app_pc_custom_save(null, jsonb_build_object('name', 'Thử hạn 127', 'need_photo', false, 'need_check', false, 'enabled', true,
      'rows', jsonb_build_array(jsonb_build_object('branch_id', b1, 'enabled', true, 'accounts', jsonb_build_array(d1), 'cycle', 'ngay', 'grace_h', 24, 'fine', 50000))));
    perform public.app__pc_tick();
    select t.id, s.id into t1, sid from public.pc_tasks t join public.pc_steps s on s.task_id = t.id where t.job = j and not t.extra and s.done_at is null;
    update public.pc_steps set due_at = to_char(public.vn_now() + interval '30 minute', 'YYYY-MM-DD HH24:MI:SS') where id = sid;
    perform public.app__pc_tick(); perform public.app__pc_tick();
    n0 := (select count(*) from public.notifications where account_id = d1 and title like 'Sắp hết hạn: Thử hạn 127%');
    update public.pc_steps set due_at = to_char(public.vn_now() - interval '10 minute', 'YYYY-MM-DD HH24:MI:SS') where id = sid;
    perform public.app__pc_tick(); perform public.app__pc_tick();
    n1 := (select count(*) from public.notifications where account_id = d1 and title like 'Đã quá hạn: Thử hạn 127%');
    update public.pc_steps set due_at = to_char(public.vn_now() - interval '5 hour', 'YYYY-MM-DD HH24:MI:SS') where id = sid;
    perform public.app__pc_tick();
    n2 := (select count(*) from public.notifications where account_id = d1 and title like 'Đã quá hạn: Thử hạn 127%');
    b_ok := n0 = 1 and n1 = 1 and n2 = 1;
    if not b_ok then m := m || jsonb_build_object('b', json_build_object('n0', n0, 'n1', n1, 'n2', n2)); end if;
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  -- c)
  begin
    gid := public.app_gv_create(jsonb_build_object('content', 'Thử hạn GV 127', 'branch_id', b1, 'assignee_id', d1, 'reviewer_id', k1,
      'due', to_char(public.vn_now() + interval '40 minute', 'YYYY-MM-DD HH24:MI'), 'priority', 'binh_thuong'));
    perform public.app__pc_tick(); perform public.app__pc_tick();
    c_ok := (select count(*) from public.notifications where account_id = d1 and title = 'Sắp hết hạn: Thử hạn GV 127') = 1;
  exception when others then m := m || jsonb_build_object('c', sqlerrm); end;
  -- d)
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
    r := public.app_viec_reminder();
    d_ok := (r->>'pen_wait')::int = (select count(*) from public.pc_penalties where status = 'cho');
    perform set_config('request.jwt.claims', json_build_object('sub', ud1, 'role', 'authenticated')::text, true);
    r := public.app_viec_reminder();
    d_ok := coalesce(d_ok, false) and coalesce((r->>'pen_wait')::int, -1) = 0;
  exception when others then m := m || jsonb_build_object('d', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok then 'PASS' else 'FAIL' end,
    'a_chi_bao_nguoi_doi_soat', a_ok, 'b_bao_han_viec', b_ok, 'c_bao_han_giao_viec', c_ok, 'd_so_dem_phat', d_ok, 'loi', m);
end $$;
rollback;
