-- Bài thử tệp 205 (người ngoài: ẩn, so tên bỏ dấu) — CSDL thử cục bộ sau seed.sql + tệp 203 + 205; tự hoàn tác. Đạt khi ra "REPORT>> ĐẠT …".
do $$
declare u uuid; h jsonb; a jsonb; b jsonb; err text; n0 int; ok text[] := '{}'; bad text[] := '{}';
begin
  if public.app__khong_dau('  Đặng   Thị NĂM ') = 'dang thi nam' then ok := ok || 'bỏ dấu: Đặng Thị NĂM → dang thi nam'::text;
  else bad := bad || ('bỏ dấu sai: ' || public.app__khong_dau('  Đặng   Thị NĂM ')); end if;

  select auth_user_id into u from public.accounts where login_name = 'nv1';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  a := public.app_ca_outsider_add('Anh Năm thử', null);
  select count(*) into n0 from public.employees;
  b := public.app_ca_outsider_add('ANH NAM  THU', null);
  if (b ->> 'id') = (a ->> 'id') and (b ->> 'existed')::boolean and (select count(*) from public.employees) = n0 and b ->> 'name' = 'Anh Năm thử'
    then ok := ok || 'trùng tên sau khi bỏ dấu → dùng lại hồ sơ cũ, giữ tên cũ'::text; else bad := bad || ('bỏ dấu trùng: ' || b::text); end if;

  begin perform public.app_ca_outsider_hide((a ->> 'id')::bigint, true); bad := bad || 'nhân viên ẩn được (phải chặn)'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('nhân viên không ẩn được: ' || err); end;

  select auth_user_id into u from public.accounts where login_name = 'chu';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform public.app_ca_outsider_hide((a ->> 'id')::bigint, true);
  h := public.app_ca_helpers();
  if not exists (select 1 from jsonb_array_elements(h -> 'outside') x where x ->> 'id' = a ->> 'id')
     and exists (select 1 from jsonb_array_elements(h -> 'outside_hidden') x where x ->> 'id' = a ->> 'id')
     and not exists (select 1 from jsonb_array_elements(h -> 'former') x where x ->> 'id' = a ->> 'id')
    then ok := ok || 'ẩn: rời nhóm chọn người, sang nhóm đã ẩn, không lẫn Nhân viên cũ'::text; else bad := bad || 'ẩn sai nhóm'::text; end if;
  begin perform public.app_ca_outsider_rename((select id from public.employees where is_outsider and id <> (a ->> 'id')::bigint limit 1), 'anh nam thu');
    if exists (select 1 from public.employees where is_outsider and id <> (a ->> 'id')::bigint) then bad := bad || 'đổi tên trùng (bỏ dấu) với người đã ẩn không bị chặn'::text; end if;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('đổi tên trùng (bỏ dấu) bị chặn: ' || err); end;
  begin perform public.app_ca_outsider_hide((select id from public.employees where not is_outsider limit 1), true); bad := bad || 'ẩn được nhân viên thật'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('không ẩn nhân viên thật: ' || err); end;

  select auth_user_id into u from public.accounts where login_name = 'nv1';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  b := public.app_ca_outsider_add('anh nam thu', null);
  h := public.app_ca_helpers();
  if (b ->> 'id') = (a ->> 'id') and exists (select 1 from jsonb_array_elements(h -> 'outside') x where x ->> 'id' = a ->> 'id')
     and not (select outsider_hidden from public.employees where id = (a ->> 'id')::bigint)
    then ok := ok || 'gõ lại tên người đã ẩn → dùng lại hồ sơ cũ và tự hiện lại'::text; else bad := bad || 'không tự hiện lại'::text; end if;

  raise exception 'REPORT>> % — đạt % · hỏng % || %', case when cardinality(bad) = 0 then 'ĐẠT' else 'LỖI' end,
    cardinality(ok), cardinality(bad), array_to_string(bad || ok, ' || ');
end $$;
