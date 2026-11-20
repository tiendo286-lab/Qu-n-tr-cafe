-- Bài thử máy chủ cho supabase/154_giao_ca_chia_doi.sql trên dữ liệu thật (tự hoàn tác). Gửi CÙNG MỘT LẦN, theo thứ tự:
--   begin isolation level repeatable read; → kiem_tra/giao_ca_154_truoc.sql → supabase/154_giao_ca_chia_doi.sql (2 lần) → tệp này
do $$
declare chu public.accounts; rep text := ''; r2 record; g text; a0 jsonb; b0 jsonb; n int := 0; n2 int := 0; t text := ''; okb boolean; k int; kd int; d text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- (0) sổ tháng giống hệt trước (trong 'blame' của ca chỉ thêm cột prev_amt trống)
  for r2 in select t0.branch_id, t0.j o, public.app_stc_month(t0.branch_id, to_char(public.vn_now(), 'YYYY-MM')) nw from pg_temp.t154_so t0 order by 1 loop
    n := n + 1; okb := true;
    for g in select jsonb_object_keys(r2.o) union select jsonb_object_keys(r2.nw) loop
      a0 := r2.o -> g; b0 := r2.nw -> g;
      if g = 'cas' then
        b0 := (select coalesce(jsonb_agg(case when jsonb_typeof(c -> 'blame') = 'object' then jsonb_set(c, '{blame}', (c -> 'blame') - 'prev_amt') else c end order by c ->> 'id'), '[]') from jsonb_array_elements(b0) c);
        a0 := (select coalesce(jsonb_agg(c order by c ->> 'id'), '[]') from jsonb_array_elements(a0) c);
      end if;
      if a0 is distinct from b0 then okb := false; t := t || format(E'\n    cơ sở %s · khoá %s khác', r2.branch_id, g); end if;
    end loop;
    if okb then n2 := n2 + 1; end if;
  end loop;
  rep := rep || E'\n' || case when n > 0 and n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (0) sổ tháng cũ = mới ở %s / %s cơ sở', n2, n) || t;
  -- (1) tiền từng ca ở Xác nhận Fabi (app__ca_money) 45 ngày gần đây không đổi
  select count(*), count(*) filter (where t0.m is distinct from public.app__ca_money(t0.id)) into k, kd from pg_temp.t154_ca t0;
  select string_agg(t0.id::text, ', ') into d from (select id from pg_temp.t154_ca t0 where t0.m is distinct from public.app__ca_money(t0.id) limit 10) t0;
  rep := rep || E'\n' || case when k > 0 and kd = 0 then 'ĐẠT' else 'HỎNG' end || format(' (1) tiền của ca (Xác nhận Fabi): %s ca, %s ca khác%s', k, kd, coalesce(' — ' || d, ''));
  -- (2) đã vá đủ chỗ
  rep := rep || E'\n' || case when position('app__stc_handover_adj' in pg_get_functiondef('public.app__ca_money(bigint)'::regprocedure)) > 0
        and position('ob.prev_amt is not null' in pg_get_functiondef('public.app__ca_money(bigint)'::regprocedure)) > 0
        and position('app__stc_handover_adj' in pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure)) > 0
        and position('doi' in pg_get_functiondef('public.app_stc_ds_blame(bigint,text,text)'::regprocedure)) > 0
        and exists (select 1 from information_schema.columns where table_name = 'stc_open_blame' and column_name = 'prev_amt')
        and exists (select 1 from public.app_migrations where file = '154_giao_ca_chia_doi.sql')
      then 'ĐẠT' else 'HỎNG' end || ' (2) đã vá app__ca_money, app_stc_month, app_stc_ds_blame + cột prev_amt + sổ tệp đã chạy';
  -- (3) số lần chọn ai chịu đang có (dòng cũ, giữ cách cũ)
  rep := rep || E'\n    (3) đang có ' || (select count(*) from public.stc_open_blame) || ' lần chọn ai chịu lệch mở ca (dòng cũ, không đổi số)';
  raise exception 'REPORT>> %', rep;
end $$;
