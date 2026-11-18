-- Bài thử máy chủ cho supabase/129_so_thu_chi_sua.sql (Sổ thu chi mới đợt 2a: sửa / thêm / xoá khoản ngoài ca, người nợ ✓).
-- Gửi CÙNG LẦN với tệp 129. Kết thúc bằng lỗi có chủ ý REPORT>> nên mọi thay đổi tự hoàn tác.
do $$
declare chu public.accounts; nv public.accounts; ql public.accounts; br bigint := 1; other bigint; m text := to_char(public.vn_now(), 'YYYY-MM');
        dd text := left(public.vn_now_text(), 10); j jsonb; rep text := ''; eid bigint; tid bigint; did bigint; n int; chi0 bigint; chi1 bigint; err text;
  function_dummy int;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  select a.* into ql from public.accounts a where a.system_role = 'ql' and a.auth_user_id is not null
     and exists (select 1 from public.fin_branch_managers f where f.account_id = a.id) order by a.id limit 1;
  select b.id into other from public.branches b where b.status = 'Đang hoạt động'
     and not exists (select 1 from public.fin_branch_managers f where f.account_id = ql.id and f.branch_id = b.id) order by b.sort_order limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  j := public.app_stc_month(br, m);
  chi0 := coalesce((select sum((x ->> 'amount')::bigint) from jsonb_array_elements(j -> 'items') x where x ->> 'book' = 'chi' and x ->> 'pm' = 'tm' and not coalesce((x ->> 'void')::boolean, false)), 0);
  -- (a) thêm khoản chi ngoài ca
  eid := public.app_stc_entry_save(null, jsonb_build_object('branch_id', br, 'entry_date', dd, 'kind', 'chi', 'amount', 100000, 'note', 'Khoản thử STC', 'pay_method', 'tien_mat'), null);
  j := public.app_stc_month(br, m);
  rep := rep || E'\n(a) thêm: ' || coalesce((select x -> 'edit' ->> 'action' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'e:' || eid), 'KHÔNG THẤY')
         || ' · sửa được ' || coalesce((select x ->> 'can_edit' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'e:' || eid), '?');
  -- (b) sửa 2 lần
  perform public.app_stc_entry_save(eid, jsonb_build_object('entry_date', dd, 'kind', 'chi', 'amount', 120000, 'note', 'Khoản thử STC', 'pay_method', 'tien_mat'), 'thử');
  perform public.app_stc_entry_save(eid, jsonb_build_object('entry_date', dd, 'kind', 'chi', 'amount', 150000, 'note', 'Khoản thử STC', 'pay_method', 'tien_mat'), 'thử lần 2');
  j := public.app_stc_month(br, m);
  chi1 := coalesce((select sum((x ->> 'amount')::bigint) from jsonb_array_elements(j -> 'items') x where x ->> 'book' = 'chi' and x ->> 'pm' = 'tm' and not coalesce((x ->> 'void')::boolean, false)), 0);
  rep := rep || E'\n(b) sửa 2 lần: gạch ngang ' || (select count(*) from jsonb_array_elements(j -> 'items') x where (x ->> 'void')::boolean and x ->> 'title' = 'Khoản thử STC')
         || ' · hiện tại ' || coalesce((select x ->> 'amount' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'e:' || eid), '?')
         || ' (cũ ' || coalesce((select x -> 'edit' ->> 'old_amount' from jsonb_array_elements(j -> 'items') x where x ->> 'id' = 'e:' || eid), '?') || ')'
         || ' · tổng chi TM tăng ' || (chi1 - chi0);
  -- (d) sửa không lý do
  begin perform public.app_stc_entry_save(eid, jsonb_build_object('entry_date', dd, 'kind', 'chi', 'amount', 1, 'note', 'x', 'pay_method', 'tien_mat'), ' ');
        rep := rep || E'\n(d) KHÔNG chặn sửa thiếu lý do!';
  exception when others then rep := rep || E'\n(d) sửa thiếu lý do: ' || sqlerrm; end;
  -- (c) xoá
  perform public.app_stc_entry_delete(eid, 'thử xoá');
  j := public.app_stc_month(br, m);
  chi1 := coalesce((select sum((x ->> 'amount')::bigint) from jsonb_array_elements(j -> 'items') x where x ->> 'book' = 'chi' and x ->> 'pm' = 'tm' and not coalesce((x ->> 'void')::boolean, false)), 0);
  rep := rep || E'\n(c) xoá: gạch ngang ' || (select count(*) from jsonb_array_elements(j -> 'items') x where (x ->> 'void')::boolean and x ->> 'title' = 'Khoản thử STC')
         || ' · lần cuối ' || coalesce((select x -> 'void_info' ->> 'action' from jsonb_array_elements(j -> 'items') x where (x ->> 'void')::boolean and x ->> 'title' = 'Khoản thử STC' order by x ->> 'id' desc limit 1), '?')
         || ' · tổng chi TM lệch so với lúc đầu ' || (chi1 - chi0);
  -- (e) luân chuyển: thêm rồi sửa
  tid := public.app_stc_transfer_save(null, jsonb_build_object('branch_id', br, 'date', dd, 'direction', 'tm_tk', 'amount', 1000000, 'note', 'Thử LC'), null);
  perform public.app_stc_transfer_save(tid, jsonb_build_object('date', dd, 'direction', 'tm_tk', 'amount', 2000000, 'note', 'Thử LC'), 'thử');
  j := public.app_stc_month(br, m);
  rep := rep || E'\n(e) luân chuyển: gạch ngang ' || (select count(*) from jsonb_array_elements(j -> 'items') x where (x ->> 'void')::boolean and x ->> 'title' like 'Nộp tiền mặt vào tài khoản · Thử LC%')
         || ' · vế vào − vế ra ' || coalesce((select sum(case when x ->> 'book' = 'thu' then (x ->> 'amount')::bigint else -(x ->> 'amount')::bigint end) from jsonb_array_elements(j -> 'items') x
                                              where x ->> 'id' like 't:' || tid || ':%'), 0);
  -- (f) cho nợ ngoài ca → thu một phần → huỷ thu
  did := public.app_stc_debt_save(null, jsonb_build_object('branch_id', br, 'name', 'Khách thử STC', 'amount', 50000, 'kind', 'muon', 'date', dd), null);
  perform public.app_stc_collect(did, jsonb_build_object('date', dd, 'kind', 'tien_mat', 'amount', 20000), null);
  perform public.app_stc_uncollect(did, 'thu nhầm');
  j := public.app_stc_month(br, m);
  rep := rep || E'\n(f) cho nợ: khoản ' || (select count(*) from jsonb_array_elements(j -> 'items') x where x ->> 'title' like '%Khách thử STC%' and x ->> 'col' = 'no' and x ->> 'book' = 'chi' and not coalesce((x ->> 'void')::boolean, false))
         || ' · thu nợ gạch ngang ' || (select count(*) from jsonb_array_elements(j -> 'items') x where x ->> 'title' like '%Khách thử STC%' and x ->> 'book' = 'thu' and (x ->> 'void')::boolean);
  -- (g) người nợ ✓
  n := public.app_stc_person_mark(br, 'Khách thử STC', true);
  j := public.app_stc_month(br, m);
  rep := rep || E'\n(g) ✓: đổi ' || n || ' khoản · nhóm ' || (select string_agg(distinct grp, ',') from public.shift_debts where branch_id = br and table_name = 'Khách thử STC' and closed_at is null)
         || ' · people ' || coalesce((select p ->> 'no_remind' from jsonb_array_elements(j -> 'people') p where p ->> 'name' = 'Khách thử STC'), 'KHÔNG THẤY');
  -- (h) quyền
  if ql.id is not null and other is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
    begin perform public.app_stc_entry_save(null, jsonb_build_object('branch_id', other, 'entry_date', dd, 'kind', 'chi', 'amount', 1000, 'note', 'x', 'pay_method', 'tien_mat'), null);
          rep := rep || E'\n(h) KHÔNG chặn quản lý sửa cơ sở không được giao!';
    exception when others then rep := rep || E'\n(h) quản lý, cơ sở không được giao: ' || sqlerrm; end;
  else rep := rep || E'\n(h) bỏ qua: không có quản lý được giao cơ sở'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_entry_save(null, jsonb_build_object('branch_id', br, 'entry_date', dd, 'kind', 'chi', 'amount', 1000, 'note', 'x', 'pay_method', 'tien_mat'), null);
        rep := rep || E'\n(h) KHÔNG chặn nhân viên!';
  exception when others then rep := rep || E'\n(h) nhân viên: ' || sqlerrm; end;
  raise exception 'REPORT>> %', rep;
end $$;
