-- KIỂM TRA tệp 169 (bản gọn số chuyển khoản ngân hàng): mọi kết quả phải GIỐNG HỆT bản cũ. Chạy trong begin … rollback (tự hoàn tác).
-- Cách chạy: thay dòng đánh dấu TEP_MAY_CHU bên dưới bằng nội dung tệp supabase/169_toc_do_ngan_hang_gon.sql (không thay = tự so bản cũ với chính nó,
-- khi đó mục "gọn ≠ đầy đủ" báo -1 vì chưa có hàm gọn). Chọn nhóm bằng dòng đánh dấu NHOM: 'goc' (từng ca / từng ngày) hoặc 'trang' (các trang lớn).
-- Đạt: REPORT>> khác=0 · lỗi=0 · gọn ≠ đầy đủ=0. Kèm thời gian cũ → mới (ms).
begin isolation level repeatable read;   -- bản cũ và mới cùng đọc 1 bản chụp dữ liệu (máy chủ thật đang có người ghi)
select set_config('request.jwt.claim.sub', (select auth_user_id::text from public.accounts where system_role = 'chu' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
create temp table _nhom on commit drop as select '@@NHOM@@'::text n;
create temp table _k on commit drop as
  -- nhóm gốc: từng phiếu ca, từng ngày, từng tháng
  select 'goc' n, 'ca_money' f, r.id::text a, null::text b from public.shift_reports r
  union all select 'goc', 'bank_auto', br.id::text, d.d from public.branches br cross join (select distinct work_date d from public.shift_reports) d
  union all select 'goc', 'fin_calc', br.id::text, m from public.branches br cross join unnest(array['2026-10', '2026-11', '2026-12']) m
  union all select 'goc', 'gap_rows', br.id::text, '2026-11' from public.branches br
  union all select 'goc', 'fund_rows', br.id::text, '2026-11' from public.branches br
  -- nhóm trang: các hàm web gọi
  union all select 'trang', 'stc_month', br.id::text, m from public.branches br cross join unnest(array['2026-11', '2026-12']) m where br.status = 'Đang hoạt động'
  union all select 'trang', 'ca_overview', d.d, null from (select distinct work_date d from public.shift_reports) d
  union all select 'trang', 'ca_get', r.id::text, null from public.shift_reports r
  union all select 'trang', 'fund_branch', br.id::text, '2026-11' from public.branches br where br.status = 'Đang hoạt động'
  union all select 'trang', 'fund_overview', '2026-11', null
  union all select 'trang', 'fin_overview', '2026-11', null
  union all select 'trang', 'fin_full', br.id::text, '2026-11' from public.branches br where br.status = 'Đang hoạt động'
  union all select 'trang', 'ds_tuan', br.id::text, w.d from public.branches br cross join unnest(array['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']) w(d) where br.status = 'Đang hoạt động'
  union all select 'trang', 'ds_con', br.id::text, null from public.branches br where br.status = 'Đang hoạt động'
  union all select 'trang', 'ds_todo', br.id::text, null from public.branches br where br.status = 'Đang hoạt động'
  union all select 'trang', 'tc_summary', br.id::text, '2026-11' from public.branches br where br.status = 'Đang hoạt động';
delete from _k where n <> (select n from _nhom);
create temp table _o (f text, a text, b text, v text, ms numeric) on commit drop;
create temp table _n (f text, a text, b text, v text, ms numeric) on commit drop;
-- Sổ quỹ từng cơ sở: các dòng cùng ngày + cùng loại bản cũ xếp tuỳ lúc (bài t01) → so "rows" theo tập hợp, mọi khoá khác so y hệt.
-- Sổ thu chi tháng: "open_debts" xếp theo ngày, các khoản CÙNG NGÀY bản cũ cũng xếp tuỳ lúc (đo 23/11: gọi bản cũ 13 lần liên tiếp, lần 1 và lần 13
-- khác thứ tự, cùng tập hợp) → cũng so theo tập hợp.
create or replace function pg_temp.chuan(v jsonb) returns jsonb language sql as $$
  select v || coalesce((select jsonb_object_agg(k, (select coalesce(jsonb_agg(x order by x::text), '[]') from jsonb_array_elements(v -> k) x))
                          from unnest(array['rows', 'open_debts']) k where jsonb_typeof(v -> k) = 'array'), '{}'::jsonb)
$$;
create or replace function pg_temp.chay(p_f text, p_a text, p_b text) returns text language plpgsql as $$
begin
  return case p_f
    when 'ca_money' then public.app__ca_money(p_a::bigint)::text
    when 'bank_auto' then public.app__fund_bank_auto(p_a::bigint, p_b)::text
    when 'fin_calc' then public.app__fin_calc(p_a::bigint, p_b)::text
    when 'gap_rows' then (select coalesce(jsonb_agg(to_jsonb(g) order by g.report_id, g.item), '[]')::text from public.app__gap_rows(p_a::bigint, p_b || '-01', p_b || '-30') g)
    when 'fund_rows' then (select coalesce(jsonb_agg(to_jsonb(g) order by to_jsonb(g)::text), '[]')::text from public.app__fund_rows(p_a::bigint, p_b || '-01', p_b || '-30') g)
    when 'stc_month' then pg_temp.chuan(public.app_stc_month(p_a::bigint, p_b))::text
    when 'ca_overview' then public.app_ca_overview(p_a)::text
    when 'ca_get' then public.app_ca_get(p_a::bigint)::text
    when 'fund_branch' then pg_temp.chuan(public.app_fund_branch(p_a::bigint, p_b))::text
    when 'fund_overview' then public.app_fund_overview(p_a)::text
    when 'fin_overview' then public.app_fin_overview(p_a)::text
    when 'fin_full' then public.app__fin_full(p_a::bigint, p_b)::text
    when 'ds_tuan' then public.app_ca_ds_tuan(p_a::bigint, p_b::date, p_b::date + 6)::text
    when 'ds_con' then public.app_ca_ds_con(p_a::bigint)::text
    when 'ds_todo' then public.app_ds_todo(p_a::bigint)::text
    when 'tc_summary' then public.app_tc_summary(p_a::bigint, p_b || '-01', p_b || '-30')::text
  end;
exception when others then return 'LOI: ' || sqlerrm;
end $$;
do $$ declare k record; t timestamptz; v text;
begin
  for k in select * from _k loop t := clock_timestamp(); v := pg_temp.chay(k.f, k.a, k.b);
    insert into _o values (k.f, k.a, k.b, v, extract(epoch from clock_timestamp() - t) * 1000); end loop;
end $$;

-- @@TEP_MAY_CHU@@

do $$ declare k record; t timestamptz; v text; khac int; ds text; tg text; gon int;
begin
  for k in select * from _k loop t := clock_timestamp(); v := pg_temp.chay(k.f, k.a, k.b);
    insert into _n values (k.f, k.a, k.b, v, extract(epoch from clock_timestamp() - t) * 1000); end loop;
  select count(*), string_agg(o.f || ':' || coalesce(o.a, '-') || ':' || coalesce(o.b, '-'), ', ') into khac, ds
    from _o o join _n n on n.f = o.f and n.a is not distinct from o.a and n.b is not distinct from o.b where n.v is distinct from o.v;
  select string_agg(format('%s ×%s: %s → %s', f, c, co, mo), ' | ' order by f) into tg
    from (select o.f, count(*) c, round(sum(o.ms)) co, round(sum(n.ms)) mo from _o o join _n n on n.f = o.f and n.a is not distinct from o.a and n.b is not distinct from o.b group by o.f) x;
  -- bản gọn phải cho đúng 3 số của bản đầy đủ, trên MỌI phiếu ca
  begin
    execute $q$select count(*) from public.shift_reports r
      where (select jsonb_build_object('received', j -> 'received', 'entered', j -> 'entered', 'account_count', j -> 'account_count') from (select public.app__kt_bank_json(r) j) q)
            is distinct from public.app__kt_bank_sum(r)$q$ into gon;
  exception when undefined_function then gon := -1;
  end;
  raise exception 'REPORT>> nhóm % · khác=% (%) · lỗi cũ=% mới=% · số mục=% · gọn ≠ đầy đủ=% trên % phiếu || %', (select n from _nhom), khac, coalesce(left(ds, 300), '-'),
    (select count(*) from _o x where x.v like 'LOI: %'), (select count(*) from _n x where x.v like 'LOI: %'), (select count(*) from _n), gon, (select count(*) from public.shift_reports), tg;
end $$;
rollback;
