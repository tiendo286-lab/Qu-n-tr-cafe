-- Bài thử máy chủ cho supabase/127_so_thu_chi_xem.sql (Sổ thu chi mới, đợt 1 — chỉ đọc).
-- Gửi CÙNG LẦN với tệp 127 (hoặc sau khi 127 đã chạy). Kết thúc bằng lỗi có chủ ý REPORT>> nên tự hoàn tác.
-- Báo: (a) số ca / khoản theo cột; (b) chênh lệch mới khác app__ca_money cũ (tm_left_self / ck_left_bank);
--      (c) luân chuyển không cân (vế vào ≠ vế ra); (d) ngày tồn quỹ mới khác Sổ quỹ cũ; (e) thời gian; (f) chặn quản lý cơ sở.
do $$
declare chu public.accounts; ql public.accounts; b record; j jsonb; t0 timestamptz; rep text := ''; ms int; n_bad int; n_lc int; n_days int; ex text; sample text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into ql from public.accounts where system_role = 'ql' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  for b in select id, coalesce(display_code, code) code from public.branches where status = 'Đang hoạt động' order by sort_order loop
    t0 := clock_timestamp();
    j := public.app_stc_month(b.id, '2026-11');
    ms := extract(milliseconds from clock_timestamp() - t0)::int;
    -- (b) so chênh lệch mới với hàm cũ (chỉ ca đã có đủ số)
    select count(*), string_agg(z.s, ' | ') filter (where z.rn <= 4) into n_bad, sample from (
      select c ->> 'shift' || ' ' || (c ->> 'date') || ' ' || it.pm || ': mới ' || coalesce(nw.v, 0) || ' cũ ' || coalesce(od.v, 0) s, row_number() over () rn
        from jsonb_array_elements(j -> 'cas') c
        cross join (values ('tm'), ('ck')) it(pm)
        cross join lateral (select coalesce(sum(case when x ->> 'book' = 'thu' then (x ->> 'amount')::bigint else -(x ->> 'amount')::bigint end), 0) v
                              from jsonb_array_elements(j -> 'items') x where x ->> 'col' = 'lech' and (x ->> 'ca_id')::bigint = (c ->> 'id')::bigint and x ->> 'pm' = it.pm) nw
        cross join lateral (select case when it.pm = 'tm' then (m ->> 'tm_left_self')::bigint else (m ->> 'ck_left_bank')::bigint end v
                              from (select public.app__ca_money((c ->> 'id')::bigint) m) mm) od
       where od.v is not null and coalesce(nw.v, 0) <> od.v) z;
    -- (c) luân chuyển: mỗi ca / mỗi ngày ngoài ca, vế vào = vế ra (không tính chuyển về Quỹ ngoài)
    select count(*) into n_lc from (
      select coalesce(x ->> 'ca_id', x ->> 'date') k, sum(case when x ->> 'book' = 'thu' then (x ->> 'amount')::bigint else -(x ->> 'amount')::bigint end) s
        from jsonb_array_elements(j -> 'items') x where x ->> 'col' = 'lc' and not (x ->> 'to_qn')::boolean group by 1) q where q.s <> 0;
    -- (d) tồn quỹ mới theo ngày so với Sổ quỹ cũ
    select count(*), string_agg(q.s, ' | ') filter (where q.rn <= 3) into n_days, ex from (
      select f ->> 'date' || ' ' || pm.k || ': cũ ' || (f ->> pm.k) || ' mới ' || nw.v s, row_number() over (order by f ->> 'date') rn
        from jsonb_array_elements(j -> 'compare' -> 'fund_days') f cross join (values ('tm'), ('ck')) pm(k)
        cross join lateral (select (j -> 'opening' ->> pm.k)::bigint + coalesce(sum(case when x ->> 'book' = 'thu' then (x ->> 'amount')::bigint else -(x ->> 'amount')::bigint end), 0) v
                              from jsonb_array_elements(j -> 'items') x where x ->> 'pm' = pm.k and x ->> 'date' <= f ->> 'date') nw
       where (f ->> pm.k)::bigint <> nw.v) q;
    rep := rep || E'\n' || b.code || ': ' || ms || 'ms · ca ' || jsonb_array_length(j -> 'cas') || ' · khoản '
      || coalesce((select string_agg(k || '=' || n, ' ') from (select x ->> 'col' k, count(*) n from jsonb_array_elements(j -> 'items') x group by 1 order by 1) q), 'không có')
      || ' · (b) lệch khác cũ ' || n_bad || coalesce(' [' || sample || ']', '')
      || ' · (c) luân chuyển lệch ' || n_lc
      || ' · (d) ngày tồn quỹ khác Sổ quỹ cũ ' || n_days || coalesce(' [' || ex || ']', '')
      || ' · ca chờ kế toán ' || (select count(*) from jsonb_array_elements(j -> 'cas') c where (c ->> 'kt_wait')::boolean);
  end loop;

  -- (f) quản lý cơ sở bị chặn
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  begin
    perform public.app_stc_month(1, '2026-11');
    rep := rep || E'\n(f) KHÔNG chặn quản lý cơ sở!';
  exception when others then
    rep := rep || E'\n(f) quản lý cơ sở: ' || sqlerrm;
  end;
  raise exception 'REPORT>> %', rep;
end $$;
