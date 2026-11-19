-- Bài thử tệp 145 (Xem như người khác). Gửi CÙNG LẦN sau nội dung 145 (chạy 2 lần). Tự hoàn tác: cuối khối RAISE EXCEPTION 'REPORT>> ...'.
do $$
declare
  rep text := ''; a_chu bigint; a_chu2 bigint; a_ql bigint := 6; a_nv bigint; a_lock bigint; j jsonb; n int; m int;
  claims text;
  setjwt constant text := 'set';
begin
  select id into a_chu from accounts where system_role = 'chu' and locked = 0 order by id limit 1;
  select id into a_chu2 from accounts where system_role = 'chu' and id <> a_chu order by id limit 1;
  select a.id into a_nv from accounts a join employees e on e.id = a.employee_id where a.system_role = 'nv' and a.locked = 0 and e.status = 'Đang làm' order by a.id limit 1;
  select id into a_lock from accounts where locked = 1 order by id limit 1;

  -- (a) Chủ, chưa xem
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated', 'session_id', 'S1')::text, true);
  rep := rep || format(E'\n(a) role=%s', (public.app_account()).system_role);
  -- (b) bắt đầu xem như QL
  begin perform public.app_view_as_start(a_ql);
    j := public.app_me();
    rep := rep || format(E'\n(b) id=%s role=%s view_as=%s phan_quyen=%s stc_can_branch1=%s',
      (public.app_account()).id = a_ql, j ->> 'role', j -> 'view_as' ->> 'account_id', public.app_can('phan_quyen'), public.app__stc_can(1));
    select count(*) into n from audit_log where action = 'xem_nhu' and account_id = a_chu;
    rep := rep || format(' log_chu=%s', n);
  exception when others then rep := rep || E'\n(b) LỖI: ' || sqlerrm; end;
  -- (c) cùng Chủ, phiên khác
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated', 'session_id', 'S2')::text, true);
  rep := rep || format(E'\n(c) phiên khác role=%s', (public.app_account()).system_role);
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated', 'session_id', 'S1')::text, true);
  -- (d) hàm chạy trước → chỉ đọc, ghi bị chặn
  perform set_config('request.path', '/rpc/app_log', true);
  begin perform public.app__pre_request(); insert into audit_log(account_id, action, detail) values (a_chu, 'thu', 'x'); rep := rep || E'\n(d) KHÔNG CHẶN GHI';
  exception when others then rep := rep || E'\n(d) chặn: ' || left(sqlerrm, 60); end;
  -- (f) đang xem A → đổi sang B (được dù đang xem)
  perform set_config('request.path', '/rpc/app_view_as_start', true);
  begin perform public.app__pre_request(); perform public.app_view_as_start(a_nv);
    rep := rep || format(E'\n(f) đổi người: id_la_nv=%s', (public.app_account()).id = a_nv);
  exception when others then rep := rep || E'\n(f) LỖI: ' || sqlerrm; end;
  -- (e) thoát chạy được cả khi đang xem
  perform set_config('request.path', '/rpc/app_view_as_stop', true);
  begin perform public.app__pre_request(); perform public.app_view_as_stop();
    rep := rep || format(E'\n(e) thoát: role=%s', (public.app_account()).system_role);
  exception when others then rep := rep || E'\n(e) LỖI: ' || sqlerrm; end;
  -- (g) hết hạn → về Chủ
  perform public.app_view_as_start(a_ql);
  update view_as set expires_at = now() - interval '1 second';
  rep := rep || format(E'\n(g) hết hạn: role=%s', (public.app_account()).system_role);
  -- (h) QL không bật được; dòng view_as giả cho phiên QL bị bỏ qua
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_ql), 'role', 'authenticated', 'session_id', 'S3')::text, true);
  begin perform public.app_view_as_start(a_nv); rep := rep || E'\n(h) QL bật được: SAI';
  exception when others then rep := rep || E'\n(h) QL bị chặn: ' || left(sqlerrm, 60); end;
  insert into view_as(session_id, owner_account_id, target_account_id, expires_at) values ('S3', a_ql, a_nv, now() + interval '10 minutes')
    on conflict (session_id) do update set owner_account_id = excluded.owner_account_id, target_account_id = excluded.target_account_id, expires_at = excluded.expires_at;
  rep := rep || format(E'\n(h) dòng giả: id_van_la_ql=%s', (public.app_account()).id = a_ql);
  -- (i) không xem như Chủ / tài khoản khoá
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated', 'session_id', 'S1')::text, true);
  begin perform public.app_view_as_start(coalesce(a_chu2, a_chu)); rep := rep || E'\n(i) xem như Chủ: SAI';
  exception when others then rep := rep || E'\n(i) chặn Chủ: ' || left(sqlerrm, 60); end;
  if a_lock is not null then
    begin perform public.app_view_as_start(a_lock); rep := rep || E'\n(i) xem như TK khoá: SAI';
    exception when others then rep := rep || E'\n(i) chặn TK khoá: ' || left(sqlerrm, 60); end;
  else rep := rep || E'\n(i) không có tài khoản khoá để thử'; end if;
  -- (j) hàm chạy trước không lỗi khi không có JWT / không có session_id / người thường
  begin
    perform set_config('request.jwt.claims', '', true); perform public.app__pre_request();
    perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated')::text, true); perform public.app__pre_request();
    perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_nv), 'role', 'authenticated', 'session_id', 'S4')::text, true); perform public.app__pre_request();
    insert into audit_log(account_id, action, detail) values (a_nv, 'thu', 'x'); delete from audit_log where action = 'thu';
    rep := rep || E'\n(j) không lỗi, người thường vẫn ghi được';
  exception when others then rep := rep || E'\n(j) LỖI: ' || sqlerrm; end;
  -- (k) danh sách người chọn được
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated', 'session_id', 'S1')::text, true);
  begin j := public.app_view_as_people();
    rep := rep || format(E'\n(k) người=%s co_chu=%s ql_co_co_so=%s', jsonb_array_length(j), exists (select 1 from jsonb_array_elements(j) x where x ->> 'role' = 'chu'),
      exists (select 1 from jsonb_array_elements(j) x where (x ->> 'account_id')::bigint = a_ql and jsonb_array_length(x -> 'branches') > 0));
  exception when others then rep := rep || E'\n(k) LỖI: ' || sqlerrm; end;
  -- (l) chính sách đọc bảng tài khoản: đang xem như NV thì chỉ thấy dòng của NV
  perform public.app_view_as_start(a_nv);
  select count(*) into n from accounts where auth_user_id = (public.app_account()).auth_user_id;
  rep := rep || format(E'\n(l) app_account_la_nv=%s', (public.app_account()).id = a_nv);
  -- (m) dưới VAI WEB (authenticated / anon): hàm chạy trước + app_me + Thoát chạy được (không thì cả web chết)
  perform public.app_view_as_stop();
  begin
    execute 'set local role authenticated';
    perform public.app__pre_request(); j := public.app_me(); perform public.app_view_as_start(a_ql); perform public.app_view_as_stop();
    execute 'reset role';
    execute 'set local role anon'; perform set_config('request.jwt.claims', '', true); perform public.app__pre_request(); execute 'reset role';
    rep := rep || format(E'\n(m) vai web chạy được: me_role=%s', j ->> 'role');
  exception when others then execute 'reset role'; rep := rep || E'\n(m) LỖI dưới vai web: ' || sqlerrm; end;
  -- (n) duyệt mã I2/I3: xem như tài khoản phải đổi mật khẩu → app_me không bắt đổi; có expires_in (giây, theo đồng hồ máy chủ)
  update accounts set must_change = 1 where id = a_nv;
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_chu), 'role', 'authenticated', 'session_id', 'S9')::text, true);
  perform public.app_view_as_start(a_nv); j := public.app_me();
  rep := rep || format(E'\n(n) must_change=%s expires_in=%s', j ->> 'must_change', j -> 'view_as' ->> 'expires_in');
  -- (o) duyệt mã I4: đường dẫn có tiền tố (/rest/v1/rpc/...) vẫn cho Thoát
  perform set_config('request.path', '/rest/v1/rpc/app_view_as_stop', true);
  begin perform public.app__pre_request(); perform public.app_view_as_stop(); rep := rep || format(E'\n(o) thoát qua tiền tố: role=%s', (public.app_account()).system_role);
  exception when others then rep := rep || E'\n(o) LỖI: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
