-- KIỂM TRA bước 136 (tệp 119): app_fabi_list cho Kế toán + Quản lý (Đối soát), chặn nhân viên; mỗi file có 'nv' (7 số phiếu) + 'nguoi_chot'.
-- Ghép nội dung supabase/119_fabi_so_sanh_ql.sql vào đầu cùng giao dịch; khối DO luôn kết thúc bằng RAISE 'REPORT>> …' nên tự hoàn tác.
do $$
declare uchu uuid; uql uuid; unv uuid; d1 text; d0 text; j jsonb; e2 text; m jsonb := '{}'::jsonb; f jsonb;
begin
  select auth_user_id into uchu from public.accounts where system_role = 'chu' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  select a.auth_user_id into uql from public.accounts a where a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and not exists (select 1 from public.account_perms p where p.account_id = a.id and p.perm = 'ke_toan') order by a.id limit 1;
  select a.auth_user_id into unv from public.accounts a where a.system_role = 'nv' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and not exists (select 1 from public.account_perms p where p.account_id = a.id) order by a.id limit 1;
  select max(work_date) into d1 from public.fabi_shifts; d0 := to_char(d1::date - 6, 'YYYY-MM-DD');
  -- Chủ
  perform set_config('request.jwt.claims', json_build_object('sub', uchu, 'role', 'authenticated')::text, true);
  j := public.app_fabi_list(d0, d1);
  f := (select x from jsonb_array_elements(j -> 'files') x where x -> 'nv' is not null and x ->> 'report_status' = 'hoan_thanh' limit 1);
  m := m || jsonb_build_object('chu_files', jsonb_array_length(j -> 'files'),
    'co_nv', (select count(*) from jsonb_array_elements(j -> 'files') x where jsonb_typeof(x -> 'nv') = 'object'),
    'khong_phieu_nv_null', (select bool_and(jsonb_typeof(x -> 'nv') = 'null' or x -> 'nv' is null) from jsonb_array_elements(j -> 'files') x where x ->> 'report_id' is null),
    'mau_nv_keys', (select array_agg(k order by k) from jsonb_object_keys(f -> 'nv') k), 'mau_nguoi_chot_co', f ->> 'nguoi_chot' is not null,
    'mau_diff', f -> 'diff', 'missing', jsonb_array_length(j -> 'missing'));
  -- Quản lý (không có quyền Kế toán)
  perform set_config('request.jwt.claims', json_build_object('sub', uql, 'role', 'authenticated')::text, true);
  begin j := public.app_fabi_list(d0, d1); m := m || jsonb_build_object('ql_files', jsonb_array_length(j -> 'files'));
  exception when others then m := m || jsonb_build_object('ql_loi', sqlerrm); end;
  begin perform public.app_fabi_upload('[]'::jsonb); m := m || jsonb_build_object('ql_upload', 'ĐƯỢC (SAI)');
  exception when others then m := m || jsonb_build_object('ql_upload', 'bị chặn: ' || sqlerrm); end;
  -- Nhân viên
  perform set_config('request.jwt.claims', json_build_object('sub', unv, 'role', 'authenticated')::text, true);
  begin j := public.app_fabi_list(d0, d1); m := m || jsonb_build_object('nv', 'ĐƯỢC (SAI)');
  exception when others then m := m || jsonb_build_object('nv', 'bị chặn: ' || sqlerrm); end;
  m := m || jsonb_build_object('tuan', d0 || '..' || d1, 'co_ql', uql is not null, 'co_nv_tk', unv is not null);
  raise exception 'REPORT>> %', m;
end $$;
