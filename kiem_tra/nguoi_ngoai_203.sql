-- Bài thử tệp 203 (người ngoài làm ca) — chạy trên CSDL thử cục bộ sau seed.sql; tự hoàn tác. Đạt khi ra "REPORT>> ĐẠT …".
do $$
declare u uuid; h jsonb; a jsonb; b jsonb; c jsonb; err text; n0 int; ok text[] := '{}'; bad text[] := '{}';
begin
  select auth_user_id into u from public.accounts where login_name = 'nv1';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  select count(*) into n0 from public.employees;

  a := public.app_ca_outsider_add('  Anh   Nam thử ', '0900 000 200');
  if a ->> 'name' = 'Anh Nam thử' and a ->> 'code' ~ '^NG[0-9]+$' and (a ->> 'existed')::boolean = false and (a ->> 'pay_cash')::boolean
    then ok := ok || 'nhân viên tạo được người ngoài, tên gọn dấu cách, mã NG'::text; else bad := bad || ('tạo: ' || a::text); end if;
  if exists (select 1 from public.employees e where e.id = (a ->> 'id')::bigint and e.is_outsider and e.status = 'Ngừng làm' and e.rank = 'Người ngoài')
     and not exists (select 1 from public.accounts where employee_id = (a ->> 'id')::bigint)
     and (select phone from public.employee_contacts where employee_id = (a ->> 'id')::bigint) = '0900 000 200'
    then ok := ok || 'hồ sơ: người ngoài, Ngừng làm, không tài khoản, có số điện thoại'::text; else bad := bad || 'hồ sơ sai'::text; end if;

  b := public.app_ca_outsider_add('ANH NAM THỬ', null);
  if (b ->> 'id') = (a ->> 'id') and (b ->> 'existed')::boolean and (select count(*) from public.employees) = n0 + 1
    then ok := ok || 'trùng tên (khác hoa thường) → dùng lại hồ sơ cũ'::text; else bad := bad || ('trùng: ' || b::text); end if;

  c := public.app_ca_outsider_add('Chị Hoa thử', null);
  if c ->> 'code' <> a ->> 'code' then ok := ok || 'người thứ hai có mã khác'::text; else bad := bad || 'mã trùng'::text; end if;

  h := public.app_ca_helpers();
  if jsonb_array_length(h -> 'outside') = 2
     and not exists (select 1 from jsonb_array_elements(h -> 'former') x where (x ->> 'id') in (a ->> 'id', c ->> 'id'))
     and not exists (select 1 from jsonb_array_elements(h -> 'active') x where (x ->> 'id') in (a ->> 'id', c ->> 'id'))
     and not exists (select 1 from jsonb_array_elements(public.app_ca_employees()) x where (x ->> 'id') in (a ->> 'id', c ->> 'id'))
    then ok := ok || 'danh sách: 2 người ngoài ở nhóm riêng, không lẫn nhóm khác'::text; else bad := bad || ('danh sách: ' || (h -> 'outside')::text); end if;

  begin perform public.app_ca_outsider_add(' x ', null); bad := bad || 'tên 1 ký tự không bị chặn'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('tên ngắn bị chặn: ' || err); end;
  begin perform public.app_ca_outsider_add('Người thử', 'abc'); bad := bad || 'sđt sai không bị chặn'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('sđt sai bị chặn: ' || err); end;
  begin perform public.app_ca_outsider_rename((a ->> 'id')::bigint, 'Anh Nam sửa'); bad := bad || 'nhân viên đổi tên được (phải chặn)'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('nhân viên không đổi tên được: ' || err); end;

  select auth_user_id into u from public.accounts where login_name = 'chu';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform public.app_ca_outsider_rename((a ->> 'id')::bigint, ' Anh Nam   sửa ');
  if (select name from public.employees where id = (a ->> 'id')::bigint) = 'Anh Nam sửa' then ok := ok || 'Chủ đổi tên được'::text; else bad := bad || 'đổi tên sai'::text; end if;
  begin perform public.app_ca_outsider_rename((a ->> 'id')::bigint, 'chị hoa THỬ'); bad := bad || 'đổi trùng tên người khác không bị chặn'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('đổi trùng tên bị chặn: ' || err); end;
  begin perform public.app_ca_outsider_rename((select id from public.employees where not is_outsider limit 1), 'Tên khác'); bad := bad || 'đổi tên nhân viên thật qua hàm này (phải chặn)'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('không đổi tên nhân viên thật: ' || err); end;

  perform set_config('request.jwt.claims', '{}', true);
  begin perform public.app_ca_outsider_add('Không đăng nhập', null); bad := bad || 'chưa đăng nhập vẫn tạo được'::text;
  exception when others then get stacked diagnostics err = message_text; ok := ok || ('chưa đăng nhập bị chặn: ' || err); end;

  raise exception 'REPORT>> % — đạt % · hỏng % || %', case when cardinality(bad) = 0 then 'ĐẠT' else 'LỖI' end,
    cardinality(ok), cardinality(bad), array_to_string(bad || ok, ' || ');
end $$;
