-- Bài thử cho supabase/179_ai_khong_gia_danh.sql — chìa khoá máy Mac (ai_viec, ai_doc) không giả được tài khoản Chủ.
-- Dùng SET SESSION AUTHORIZATION để đóng vai đúng như khi máy Mac kết nối thẳng. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/179_ai_khong_gia_danh.sql
do $$
declare rep text := ''; a public.accounts; ok boolean;
  CHU constant text := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_doc') then create role ai_doc nologin; end if;
  execute 'grant usage on schema public to ai_doc';
  -- trường hợp xấu nhất (máy thật có thể để PUBLIC gọi được hàm): mở quyền gọi cho 2 vai trong bài thử (tự hoàn tác)
  execute 'grant execute on function public.app_account(), public.app__real_account(), public.app_can(text), public.app_staff() to ai_viec, ai_doc';
  begin execute 'grant execute on function public.app__uid() to ai_viec, ai_doc'; exception when undefined_function then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', CHU, 'role', 'authenticated')::text, true);

  -- đường thường của web (không phải chìa khoá máy Mac): vẫn nhận ra Chủ
  a := public.app_account();
  rep := rep || case when a.system_role = 'chu' then 'ĐẠT' else 'HỎNG' end || ' đường thường: vẫn nhận ra Chủ' || chr(10);
  rep := rep || case when public.app_can('phan_quyen') then 'ĐẠT' else 'HỎNG' end || ' đường thường: Chủ vẫn có quyền' || chr(10);

  -- chìa khoá nhận việc của máy Mac giả danh Chủ → không được
  execute 'set session authorization ai_viec';
  perform set_config('request.jwt.claims', json_build_object('sub', CHU, 'role', 'authenticated')::text, true);
  a := public.app_account();
  ok := a.id is null and not public.app_can('phan_quyen') and not public.app_staff();
  execute 'reset session authorization';
  rep := rep || case when ok then 'ĐẠT' else 'HỎNG' end || ' ai_viec đặt danh tính Chủ vẫn không được nhận là Chủ' || chr(10);

  -- chìa khoá chỉ đọc cũng vậy
  execute 'set session authorization ai_doc';
  perform set_config('request.jwt.claims', json_build_object('sub', CHU, 'role', 'authenticated')::text, true);
  a := public.app__real_account();
  ok := a.id is null and public.app__uid() is null;
  execute 'reset session authorization';
  rep := rep || case when ok then 'ĐẠT' else 'HỎNG' end || ' ai_doc đặt danh tính Chủ vẫn không được nhận là Chủ' || chr(10);

  raise exception 'REPORT>> %', chr(10) || rep;
end $$;
