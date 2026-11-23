-- Bài thử tệp 165 (app_cv_done — thẻ "Đã duyệt" của trang Duyệt nghỉ & làm thay). Chạy trên CSDL thử cục bộ, tự hoàn tác.
-- Đạt: "LỖI: REPORT>> ĐẠT …".
DO $test$
declare uid uuid; acc bigint; emp bigint; emp2 bigint; br bigint; rid bigint; nuid uuid := gen_random_uuid(); nv bigint;
  d text := to_char(public.vn_now()::date, 'YYYY-MM-DD'); m text := to_char(public.vn_now()::date, 'YYYY-MM'); res jsonb; bad boolean; cases text[] := '{}';
begin
  select id, auth_user_id into acc, uid from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  insert into public.branches(code, name, sort_order) values ('T165_' || substr(gen_random_uuid()::text, 1, 6), 'Cơ sở thử 165', 999) returning id into br;
  insert into public.employees(code, name, rank) values ('T165A_' || substr(gen_random_uuid()::text, 1, 6), 'Nhân viên thử A', '1') returning id into emp;
  insert into public.employees(code, name, rank) values ('T165B_' || substr(gen_random_uuid()::text, 1, 6), 'Nhân viên thử B', '1') returning id into emp2;
  insert into public.shift_reports(branch_id, work_date, shift, status, created_by) values (br, d, 'Sáng', 'hoan_thanh', acc) returning id into rid;
  insert into public.shift_report_staff(report_id, employee_id, source, worked, absent_reason) values (rid, emp, 'lich', 0, 'Nghỉ thử');
  insert into public.shift_report_staff(report_id, employee_id, source, worked, time_in, time_out) values (rid, emp2, 'ho_tro', 1, '06:45', '12:30');
  if public.app__cv_state(rid) <> 'chua_phan_loai' then raise exception 'FAIL dựng ca: state %', public.app__cv_state(rid); end if;

  -- (1) chưa duyệt thì không có trong "Đã duyệt"
  res := public.app_cv_done(m);
  if exists (select 1 from jsonb_array_elements(res) x where (x->>'id')::bigint = rid) then raise exception 'FAIL (1) ca chưa duyệt đã hiện'; end if;
  cases := cases || '(1) ca chưa duyệt không hiện'::text;

  -- (2) phân loại + Chủ duyệt → có trong tháng, đủ trường, không khiếu nại
  perform public.app_cv_save(rid, jsonb_build_array(jsonb_build_object('absent_id', emp, 'reason', 'nho_ql', 'helper_id', emp2, 'hours', 5.75, 'x2', true)));
  if exists (select 1 from jsonb_array_elements(public.app_cv_done(m)) x where (x->>'id')::bigint = rid) then raise exception 'FAIL (2a) chờ duyệt đã hiện'; end if;
  perform public.app_cv_approve(rid, null, 'Duyệt thử 165');
  select x into res from jsonb_array_elements(public.app_cv_done(m)) x where (x->>'id')::bigint = rid;
  if res is null then raise exception 'FAIL (2) ca đã duyệt không hiện'; end if;
  if res->>'date' <> d or res->>'shift' <> 'Sáng' or res->>'ok_at' is null or (res->>'complaint')::boolean then raise exception 'FAIL (2) trường sai: %', res; end if;
  cases := cases || '(2) ca đã duyệt hiện đủ ngày / ca / giờ duyệt, không khiếu nại'::text;

  -- (3) khiếu nại chưa xem → cờ complaint; đã xem → hết cờ
  update public.shift_covers set complaint_helper = 'Em làm 6 giờ' where report_id = rid;
  select x into res from jsonb_array_elements(public.app_cv_done(m)) x where (x->>'id')::bigint = rid;
  if not (res->>'complaint')::boolean then raise exception 'FAIL (3a) thiếu cờ khiếu nại'; end if;
  update public.shift_covers set resolved_at = public.vn_now_text() where report_id = rid;
  select x into res from jsonb_array_elements(public.app_cv_done(m)) x where (x->>'id')::bigint = rid;
  if (res->>'complaint')::boolean then raise exception 'FAIL (3b) khiếu nại đã xem vẫn báo'; end if;
  cases := cases || '(3) cờ khiếu nại chưa xem'::text;

  -- (4) tháng khác không có; tháng sai báo lỗi
  if jsonb_array_length(public.app_cv_done('2000-01')) <> 0 then raise exception 'FAIL (4a) tháng khác'; end if;
  bad := false; begin perform public.app_cv_done('11/2026'); exception when others then bad := position('Tháng không hợp lệ' in sqlerrm) > 0; end;
  if not bad then raise exception 'FAIL (4b) tháng sai không báo'; end if;
  bad := false; begin perform public.app_cv_done(null); exception when others then bad := position('Tháng không hợp lệ' in sqlerrm) > 0; end;
  if not bad then raise exception 'FAIL (4c) tháng rỗng không báo'; end if;
  cases := cases || '(4) lọc đúng tháng, tháng sai / rỗng báo lỗi'::text;

  -- (5) nhân viên (không có quyền đối soát) không đọc được
  update public.accounts set system_role = 'nv', auth_user_id = nuid, locked = 0 where employee_id = emp returning id into nv;
  if nv is null then insert into public.accounts(employee_id, display_name, system_role, auth_user_id) values (emp, 'Nhân viên thử 165', 'nv', nuid) returning id into nv; end if;
  perform set_config('request.jwt.claim.sub', nuid::text, true);
  bad := false; begin perform public.app_cv_done(m); exception when others then bad := true; end;
  if not bad then raise exception 'FAIL (5) nhân viên đọc được'; end if;
  cases := cases || '(5) nhân viên không đọc được'::text;

  raise exception 'REPORT>> ĐẠT %/5: %', cardinality(cases), array_to_string(cases, ' · ');
end $test$;
