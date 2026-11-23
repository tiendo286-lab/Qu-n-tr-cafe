-- KIỂM TRA tệp 171 (Sổ thu chi tháng lấy số ngân hàng bằng bản gọn): kết quả phải GIỐNG HỆT bản cũ, theo TỪNG VAI. Chạy trong begin … rollback (tự hoàn tác).
-- Cách chạy: thay dòng đánh dấu TEP_MAY_CHU bên dưới bằng nội dung tệp supabase/171_stc_month_ngan_hang_gon.sql
-- (không thay = tự so bản cũ với chính nó; khi đó "đã áp tệp" = false).
-- So: app_stc_month mọi cơ sở đang hoạt động × tháng 10, 11, 12 × vai (1 Chủ, mọi quản lý tổng, mọi quản lý — quản lý chỉ xem được cơ sở
-- của mình, các cơ sở khác ra lỗi; lỗi cũng phải giống hệt) + app__stc_ds_missing (nút Hoàn thành đối soát) của 12 ca gần nhất ĐÃ Xác nhận Fabi
-- (ca chưa xác nhận thì hàm dừng sớm, không gọi app_stc_month — chọn ca chưa xác nhận là thử hụt), vai Chủ.
-- Đạt: REPORT>> khác=0 · lỗi cũ = lỗi mới · đã áp tệp=true. Kèm thời gian cũ → mới (ms).
begin isolation level repeatable read;   -- bản cũ và mới cùng đọc 1 bản chụp dữ liệu (máy chủ thật đang có người ghi)
create temp table _vai on commit drop as
  (select a.id acc, 'chu'::text vai, a.auth_user_id::text uid from public.accounts a
    where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1)
  union all
  select a.id, a.system_role, a.auth_user_id::text from public.accounts a
   where a.system_role in ('ql_tong', 'ql') and a.auth_user_id is not null and coalesce(a.locked, 0) = 0;
select set_config('request.jwt.claim.sub', uid, true), set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true) from _vai where vai = 'chu';
create temp table _k on commit drop as
  select v.acc, v.vai, v.uid, 'stc_month'::text f, b.id a, m b
    from _vai v cross join public.branches b cross join unnest(array['2026-10', '2026-11', '2026-12']) m
   where b.status = 'Đang hoạt động'
  union all
  select v.acc, v.vai, v.uid, 'ds_missing', r.id, null
    from (select * from _vai where vai = 'chu') v
    cross join (select x.id from public.shift_reports x where x.status = 'hoan_thanh' and coalesce((public.app__stc_ds_state(x.id) ->> 'done')::boolean, false)
                 order by x.work_date desc, x.id desc limit 12) r;
create temp table _o (acc bigint, f text, a bigint, b text, v text, ms numeric) on commit drop;
create temp table _n (acc bigint, f text, a bigint, b text, v text, ms numeric) on commit drop;
-- "open_debts" (và "rows") các khoản cùng ngày bản cũ cũng xếp tuỳ lúc (đo 23/11) → so theo tập hợp, mọi khoá khác so y hệt.
create or replace function pg_temp.chuan(v jsonb) returns jsonb language sql as $$
  select v || coalesce((select jsonb_object_agg(k, (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(v -> k) x))
                          from unnest(array['rows', 'open_debts']) k where jsonb_typeof(v -> k) = 'array'), '{}'::jsonb)
$$;
create or replace function pg_temp.chay(p_uid text, p_f text, p_a bigint, p_b text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  return case p_f when 'stc_month' then pg_temp.chuan(public.app_stc_month(p_a, p_b))::text
                  when 'ds_missing' then to_jsonb(public.app__stc_ds_missing(p_a))::text end;
exception when others then return 'LOI: ' || sqlerrm;
end $$;
do $$ declare k record; t timestamptz; v text;
begin
  for k in select * from _k loop t := clock_timestamp(); v := pg_temp.chay(k.uid, k.f, k.a, k.b);
    insert into _o values (k.acc, k.f, k.a, k.b, v, extract(epoch from clock_timestamp() - t) * 1000); end loop;
end $$;

-- @@TEP_MAY_CHU@@

do $$ declare k record; t timestamptz; v text; khac int; ds text; tg text;
begin
  for k in select * from _k loop t := clock_timestamp(); v := pg_temp.chay(k.uid, k.f, k.a, k.b);
    insert into _n values (k.acc, k.f, k.a, k.b, v, extract(epoch from clock_timestamp() - t) * 1000); end loop;
  select count(*), string_agg(o.f || ':' || o.acc || ':' || o.a || ':' || coalesce(o.b, '-'), ', ') into khac, ds
    from _o o join _n n on n.acc = o.acc and n.f = o.f and n.a = o.a and n.b is not distinct from o.b where n.v is distinct from o.v;
  select string_agg(format('%s ×%s: %s → %s', f, c, co, mo), ' | ' order by f) into tg
    from (select o.f, count(*) c, round(sum(o.ms)) co, round(sum(n.ms)) mo
            from _o o join _n n on n.acc = o.acc and n.f = o.f and n.a = o.a and n.b is not distinct from o.b
           where o.v not like 'LOI: %' group by o.f) x;
  raise exception 'REPORT>> khác=% (%) · lỗi cũ=% mới=% · số mục=% (% vai) · đã áp tệp=% || %', khac, coalesce(left(ds, 300), '-'),
    (select count(*) from _o x where x.v like 'LOI: %'), (select count(*) from _n x where x.v like 'LOI: %'), (select count(*) from _n),
    (select count(*) from _vai), (select p.prosrc like '%app__kt_bank_sum(x) b%' from pg_proc p where p.oid = 'public.app_stc_month(bigint, text)'::regprocedure), tg;
end $$;
rollback;
