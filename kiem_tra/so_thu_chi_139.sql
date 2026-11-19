-- Bài thử cho supabase/139_so_thu_chi_moi_tru_luong.sql. Gửi sau 139 ×2. REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; j jsonb; rep text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_stc_month(1, '2026-11');
  rep := 'shortfalls: ' || coalesce(jsonb_array_length(j -> 'shortfalls')::text, 'KHÔNG CÓ KHOÁ')
      || ' · loại: ' || coalesce((select string_agg(distinct x ->> 'item', ',') from jsonb_array_elements(j -> 'shortfalls') x), '-')
      || ' · có khoá đủ: ' || coalesce((select bool_and(x ? 'move_mkey' and x ? 'reply' and x ? 'employee_id' and x ? 'report_id') from jsonb_array_elements(j -> 'shortfalls') x)::text, '-')
      || ' · số phiếu thật: ' || (select count(*) from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id where r.branch_id = 1 and r.work_date between '2026-11-01' and '2026-11-30' and s.status <> 'huy');
  raise exception 'REPORT>> %', rep;
end $$;
