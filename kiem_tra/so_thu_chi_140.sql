-- Bài thử cho supabase/140_no_cua_ca.sql. Gửi sau 140 ×2 (hoặc một mình: phải báo KHÔNG CÓ KHOÁ). REPORT>> tự hoàn tác.
do $$
declare chu public.accounts; j jsonb; rep text := ''; b bigint; t0 timestamptz; ms int;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  for b in select id from public.branches order by id loop
    t0 := clock_timestamp();
    j := public.app_stc_month(b, '2026-11');
    ms := extract(milliseconds from clock_timestamp() - t0)::int;
    rep := rep || format(E'\n[cơ sở %s · %s ms] ca_debts: %s', b, ms, coalesce(jsonb_array_length(j -> 'ca_debts')::text, 'KHÔNG CÓ KHOÁ'));
    if j ? 'ca_debts' then
      rep := rep
        || ' · mới ' || (select count(*) from jsonb_array_elements(j -> 'ca_debts') x where x ->> 't' = 'moi')
        || ' · trả ' || (select count(*) from jsonb_array_elements(j -> 'ca_debts') x where x ->> 't' = 'tra')
        || ' · trả một phần / đã trả ' || (select count(*) from jsonb_array_elements(j -> 'ca_debts') x where x ->> 't' = 'moi' and (x ->> 'left')::bigint < (x ->> 'amount')::bigint)
        || ' · khoá đủ ' || coalesce((select bool_and(x ? 'report_id' and x ? 'who' and x ? 'kind' and x ? 'amount' and x ? 'left' and x ? 'pm' and x ? 'from') from jsonb_array_elements(j -> 'ca_debts') x)::text, '-')
        -- ca có tổng HĐ khác dòng Nợ trên phiếu (pos_debt)
        || ' · ca HĐ ≠ pos_debt: ' || coalesce((select string_agg(c ->> 'id' || '(' || coalesce(h.s, 0) || '≠' || (c -> 'nv' ->> 'debt') || ')', ', ')
             from jsonb_array_elements(j -> 'cas') c
             left join lateral (select sum((x ->> 'amount')::bigint) s from jsonb_array_elements(j -> 'ca_debts') x
                                 where x ->> 't' = 'moi' and x ->> 'kind' = 'bill' and x ->> 'report_id' = c ->> 'id') h on true
            where coalesce(h.s, 0) <> coalesce((c -> 'nv' ->> 'debt')::bigint, 0)), 'không')
        -- dòng mới trong ca không thuộc ca nào của tháng
        || ' · lạc ca: ' || (select count(*) from jsonb_array_elements(j -> 'ca_debts') x
             where not exists (select 1 from jsonb_array_elements(j -> 'cas') c where c ->> 'id' = x ->> 'report_id'));
    end if;
  end loop;
  raise exception 'REPORT>> %', rep;
end $$;
