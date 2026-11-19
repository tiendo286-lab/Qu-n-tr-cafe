-- Bài thử cho supabase/138_so_thu_chi_ql_ghi_khoan.sql. Gửi sau 138 ×2. REPORT>> tự hoàn tác.
do $$
declare ql public.accounts; rep text := ''; b1 bigint; b2 bigint; eid bigint;
begin
  for ql in select a.* from public.accounts a where a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id loop
    perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
    select min(b.id) into b1 from public.branches b where b.status = 'Đang hoạt động' and coalesce(public.app__stc_can(b.id), false);
    exit when b1 is not null;
  end loop;
  select min(b.id) into b2 from public.branches b where b.status = 'Đang hoạt động' and not coalesce(public.app__stc_can(b.id), false);
  rep := 'QL ' || ql.id || ' · cơ sở ' || coalesce(b1::text, '?');
  begin
    eid := public.app_stc_entry_save(null, jsonb_build_object('branch_id', b1, 'entry_date', to_char(public.vn_now(), 'YYYY-MM-DD'), 'kind', 'chi', 'amount', 12000, 'note', 'thử 138', 'pay_method', 'tien_mat'), 'thử');
    rep := rep || E'\n(a) QL thêm khoản chi ngoài ca: được (id ' || eid || ')';
    perform public.app_stc_entry_save(eid, jsonb_build_object('branch_id', b1, 'entry_date', to_char(public.vn_now(), 'YYYY-MM-DD'), 'kind', 'chi', 'amount', 15000, 'note', 'thử 138 sửa', 'pay_method', 'tien_mat'), 'thử sửa');
    rep := rep || ' · sửa: được';
    perform public.app_stc_entry_delete(eid, 'thử xoá');
    rep := rep || ' · xoá: được';
  exception when others then rep := rep || E'\n(a) QL ghi khoản LỖI: ' || sqlerrm; end;
  if b2 is not null then
    begin perform public.app_stc_entry_save(null, jsonb_build_object('branch_id', b2, 'entry_date', to_char(public.vn_now(), 'YYYY-MM-DD'), 'kind', 'chi', 'amount', 12000, 'note', 'thử', 'pay_method', 'tien_mat'), 'thử');
      rep := rep || E'\n(b) KHÔNG chặn QL ghi cơ sở khác!';
    exception when others then rep := rep || E'\n(b) cơ sở khác: ' || sqlerrm; end;
  end if;
  raise exception 'REPORT>> %', rep;
end $$;
