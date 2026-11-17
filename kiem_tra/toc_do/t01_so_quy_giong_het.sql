-- KIỂM TRA bước 128: Sổ quỹ / Chốt tháng sau khi tăng tốc phải GIỐNG HỆT bản cũ. Chạy trong begin … rollback.
-- Cách chạy: thay dòng đánh dấu TEP_MAY_CHU bên dưới bằng nội dung tệp supabase/NNN_toc_do_so_quy.sql (không thay = tự so bản cũ với chính nó).
-- Đạt: REPORT>> khác=0. Kèm thời gian cũ → mới (ms).
begin;
select set_config('request.jwt.claim.sub', (select auth_user_id::text from public.accounts where system_role = 'chu' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
create temp table _k on commit drop as
  select 'fin_overview' f, m, null::bigint b from unnest(array['2026-10', '2026-11']) m
  union all select 'fin_full', m, id from unnest(array['2026-10', '2026-11', '2026-12']) m, public.branches where status = 'Đang hoạt động'
  union all select 'fund_overview', m, null from unnest(array['2026-10', '2026-11', '2026-12']) m
  union all select 'fund_branch', m, id from unnest(array['2026-10', '2026-11', '2026-12']) m, public.branches where status = 'Đang hoạt động';
create temp table _o (f text, m text, b bigint, v jsonb, ms int) on commit drop;
create temp table _n (f text, m text, b bigint, v jsonb, ms int) on commit drop;
create or replace function pg_temp.chay(p_f text, p_m text, p_b bigint) returns jsonb language plpgsql as $$
begin
  return case p_f when 'fin_overview' then public.app_fin_overview(p_m) when 'fin_full' then public.app__fin_full(p_b, p_m)
                  when 'fund_overview' then public.app_fund_overview(p_m) else public.app_fund_branch(p_b, p_m) end;
exception when others then return jsonb_build_object('LOI', sqlerrm);
end $$;
-- Sổ quỹ từng cơ sở: các dòng cùng ngày + cùng loại ưu tiên bản cũ xếp tùy lúc (sắp xếp không cố định) → so "rows" theo tập hợp, mọi khoá khác so y hệt.
create or replace function pg_temp.chuan(p_f text, v jsonb) returns jsonb language sql as $$
  select case when p_f = 'fund_branch' and v ? 'rows'
              then v || jsonb_build_object('rows', (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(v -> 'rows') x)) else v end
$$;
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
  select count(*), string_agg(o.f || ':' || o.m || ':' || coalesce(o.b::text, '-'), ', ') into khac, ds
    from _o o join _n n on n.f = o.f and n.m = o.m and n.b is not distinct from o.b where pg_temp.chuan(n.f, n.v) is distinct from pg_temp.chuan(o.f, o.v);
  select string_agg(format('%s %s: %s → %s', f, m, co, mo), ' | ' order by f, m) into tg
    from (select o.f, o.m, sum(o.ms) co, sum(n.ms) mo from _o o join _n n on n.f = o.f and n.m = o.m and n.b is not distinct from o.b group by o.f, o.m) x;
  raise exception 'REPORT>> khác=% (%) · lỗi=% · số mục=% || %', khac, coalesce(ds, '-'),
    (select count(*) from _n x where x.v ? 'LOI'), (select count(*) from _n), tg;
end $$;
rollback;
