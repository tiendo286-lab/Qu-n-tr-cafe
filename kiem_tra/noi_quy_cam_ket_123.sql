-- KIỂM TRA tệp 123: việc đọc Nội quy / ký Cam kết trong app_today_me, trang theo dõi app_tl_follow, Kế toán sửa cam kết.
-- Ghép supabase/123_noi_quy_cam_ket_viec.sql vào đầu cùng lần gửi; kết thúc RAISE 'REPORT>> …' nên tự hoàn tác.
do $$
declare
  anv public.accounts; akt public.accounts; achu public.accounts; j jsonb; m jsonb := '{}'::jsonb;
  n_docs int; first_doc bigint; newbie bigint; e public.employees;
begin
  select a.* into anv from public.accounts a join public.employees x on x.id = a.employee_id
    where a.system_role = 'nv' and a.auth_user_id is not null and a.locked = 0 and x.status = 'Đang làm'
      and not exists (select 1 from public.account_perms p where p.account_id = a.id) order by a.id limit 1;
  select a.* into akt from public.accounts a where a.auth_user_id is not null and a.locked = 0
    and (a.system_role = 'ke_toan' or exists (select 1 from public.account_perms p where p.account_id = a.id and p.perm = 'ke_toan')) order by a.id limit 1;
  select * into achu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  select count(*) into n_docs from public.docs where kind = 'noi_quy' and published_version > 0;
  -- trạng thái sạch cho nhân viên thử
  delete from public.doc_reads where employee_id = anv.employee_id;
  delete from public.employee_commitments where employee_id = anv.employee_id;
  update public.employees set start_date = '2026-01-01' where id = anv.employee_id;

  perform set_config('request.jwt.claims', json_build_object('sub', anv.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_today_me();
  assert (j -> 'rules' ->> 'total')::int = n_docs and (j -> 'rules' ->> 'read')::int = 0, 'Đếm nội quy chưa đọc';
  assert (j -> 'rules' ->> 'due')::date = (select min(published_at::date) from public.docs where kind = 'noi_quy' and published_version > 0) + 12, 'Hạn 12 ngày từ ngày đăng';
  first_doc := (j -> 'rules' ->> 'first_unread')::bigint;
  assert first_doc is not null, 'Có bài chưa đọc đầu tiên';
  assert j -> 'commit' ->> 'status' = 'chua_ky' and (j -> 'commit' ->> 'due')::date = date '2026-11-30', 'Cam kết nhân viên cũ hạn 30/11';
  assert j -> 'follow' is null or j -> 'follow' = 'null'::jsonb, 'Nhân viên không có việc theo dõi';
  perform public.app_tl_read(first_doc);
  j := public.app_today_me();
  assert (j -> 'rules' ->> 'read')::int = 1 and (j -> 'rules' ->> 'first_unread')::bigint is distinct from first_doc, 'Đọc 1 bài thì còn lại';
  begin
    perform public.app_tl_set_commit(anv.employee_id, 'da_ky_nop', null);
    raise assert_failure using message = 'Nhân viên tự sửa cam kết';
  exception when raise_exception then null;
  end;
  begin
    perform public.app_tl_follow();
    raise assert_failure using message = 'Nhân viên xem trang theo dõi';
  exception when raise_exception then null;
  end;
  m := m || jsonb_build_object('nv', j - 'shifts');

  -- nhân viên mới: hạn 12 ngày từ ngày vào làm
  insert into public.employees(code, name, rank, status, start_date) values ('ZZT123', 'Nhân viên mới thử', 'Thử việc', 'Đang làm', '2026-11-25') returning * into e;
  assert public.app__tl_commit_due(e) = date '2026-12-07', 'Hạn cam kết nhân viên mới';

  if akt.id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', akt.auth_user_id, 'role', 'authenticated')::text, true);
    j := public.app_today_me();
    assert jsonb_array_length(j -> 'follow' -> 'rules') = n_docs, 'Kế toán theo dõi mỗi bài 1 việc';
    assert (j -> 'follow' -> 'commit' ->> 'pending')::int > 0, 'Kế toán theo dõi cam kết';
    perform public.app_tl_set_commit(anv.employee_id, 'da_ky_nop', null);
    assert (select status from public.employee_commitments where employee_id = anv.employee_id) = 'da_ky_nop', 'Kế toán cập nhật Đã ký và nộp';
    j := public.app_tl_follow();
    assert exists (select 1 from jsonb_array_elements(j -> 'rows') r where (r ->> 'employee_id')::bigint = e.id and r ->> 'commit_due' = '2026-12-07'), 'Trang theo dõi có hạn cam kết';
    assert jsonb_array_length(j -> 'docs') = n_docs, 'Trang theo dõi có đủ bài';
    m := m || jsonb_build_object('kt_follow', (public.app_today_me() -> 'follow'), 'rows', jsonb_array_length(j -> 'rows'));
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', anv.auth_user_id, 'role', 'authenticated')::text, true);
  assert public.app_today_me() -> 'commit' is null or public.app_today_me() -> 'commit' = 'null'::jsonb, 'Đã ký và nộp thì hết việc';

  perform set_config('request.jwt.claims', json_build_object('sub', achu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_tl_follow();   -- Chủ xem được trang theo dõi
  m := m || jsonb_build_object('chu_follow', public.app_today_me() -> 'follow');
  assert not has_function_privilege('anon', 'public.app_tl_follow()', 'EXECUTE'), 'Khách không gọi được';
  assert not has_function_privilege('authenticated', 'public.app__tl_commit_due(public.employees)', 'EXECUTE'), 'Hàm nội bộ bị khóa';
  raise exception 'REPORT>> %', m;
end $$;
