-- KIỂM TRA bước 130: Thu chi / Lệch tiền / Chốt tháng cơ sở sau khi tăng tốc phải GIỐNG HỆT bản cũ. Tự hoàn tác.
-- Cách chạy: thay dòng đánh dấu TEP_MAY_CHU bên dưới bằng nội dung tệp supabase/114_toc_do_thu_chi_lech_tien.sql.
-- Đạt: REPORT>> khác=0. "repeatable read" để bản cũ và mới đọc cùng 1 bản chụp dữ liệu (máy chủ thật đang có người ghi).
begin isolation level repeatable read;
select set_config('request.jwt.claim.sub', (select auth_user_id::text from public.accounts where system_role = 'chu' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
create temp table _k on commit drop as
  select f, m, id b from unnest(array['tc_summary', 'gap_list', 'fin_calc', 'fin_month']) f, unnest(array['2026-10', '2026-11', '2026-12']) m,
         public.branches where status = 'Đang hoạt động';
create temp table _o (f text, m text, b bigint, v jsonb, ms int) on commit drop;
create temp table _n (f text, m text, b bigint, v jsonb, ms int) on commit drop;
create or replace function pg_temp.chay(p_f text, p_m text, p_b bigint) returns jsonb language plpgsql as $$
declare d1 text := to_char((p_m || '-01')::date + interval '1 month' - interval '1 day', 'YYYY-MM-DD');
begin
  return case p_f when 'tc_summary' then public.app_tc_summary(p_b, p_m || '-01', d1) when 'gap_list' then public.app_gap_list(p_b, p_m)
                  when 'fin_calc' then public.app__fin_calc(p_b, p_m) else public.app_fin_month(p_b, p_m) end;
exception when others then return jsonb_build_object('LOI', sqlerrm);
end $$;
do $$ declare k record; t timestamptz; v jsonb;
begin
  for k in select * from _k loop t := clock_timestamp(); v := pg_temp.chay(k.f, k.m, k.b);
    insert into _o values (k.f, k.m, k.b, v, round(extract(epoch from clock_timestamp() - t) * 1000)); end loop;
end $$;

-- @@TEP_MAY_CHU@@

do $$ declare k record; t timestamptz; v jsonb; khac int; ds text; tg text;
begin
  for k in select * from _k loop t := clock_timestamp(); v := pg_temp.chay(k.f, k.m, k.b);
    insert into _n values (k.f, k.m, k.b, v, round(extract(epoch from clock_timestamp() - t) * 1000)); end loop;
  select count(*), string_agg(o.f || ':' || o.m || ':' || o.b, ', ') into khac, ds
    from _o o join _n n on n.f = o.f and n.m = o.m and n.b = o.b where n.v is distinct from o.v;
  select string_agg(format('%s %s: %s → %s', f, m, co, mo), ' | ' order by f, m) into tg
    from (select o.f, o.m, sum(o.ms) co, sum(n.ms) mo from _o o join _n n on n.f = o.f and n.m = o.m and n.b = o.b group by o.f, o.m) x;
  raise exception 'REPORT>> khác=% (%) · lỗi=% · số mục=% || %', khac, coalesce(ds, '-'),
    (select count(*) from _n x where x.v ? 'LOI'), (select count(*) from _n), tg;
end $$;
rollback;
