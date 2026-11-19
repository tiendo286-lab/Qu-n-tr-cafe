-- Bài thử cho supabase/142_tra_no_mot_lan.sql. Gửi sau 142 ×2. REPORT>> tự hoàn tác (không đổi dữ liệu thật).
do $$
declare chu public.accounts; rep text := ''; d public.shift_debts; n public.shift_debts; j jsonb; rid bigint; today text := left(public.vn_now_text(), 10);
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- 1. tách khoản bị chặn
  select * into d from public.shift_debts where closed_at is null and amount > 2000 and report_id is null order by id desc limit 1;
  if d.id is null then select * into d from public.shift_debts where closed_at is null and amount > 2000 order by id desc limit 1; end if;
  begin
    insert into public.shift_debts(branch_id, table_name, amount, kind, created_at, split_from) values (d.branch_id, 'X', 1000, 'bill', public.vn_now_text(), d.id);
    rep := rep || '1. tách khoản: VẪN THÊM ĐƯỢC';
  exception when others then rep := rep || '1. tách khoản bị chặn: ' || left(sqlerrm, 50);
  end;
  -- 2. ngoài ca: khách đưa thiếu 1.000
  perform public.app_cn_debt_collect(d.id, today, 'tien_mat', d.amount - 1000, null);
  select * into n from public.shift_debts where rest_of = d.id;
  rep := rep || format(E'\n2. khoản cũ %s: đóng=%s số=%s (ban đầu %s) · nợ mới: số=%s loại=%s quỹ=%s ca=%s ghi chú="%s"',
    d.id, (select closed_at is not null from public.shift_debts where id = d.id), (select amount from public.shift_debts where id = d.id), d.amount,
    n.amount, n.kind, n.fund_out, coalesce(n.report_id::text, 'ngoài ca'), n.note);
  -- 3. Sổ thu chi: debt_paid + Cho nợ ngoài ca của nợ mới
  j := public.app_stc_month(d.branch_id, left(today, 7));
  rep := rep || format(E'\n3. debt_paid[%s] = %s · Cho nợ mới trong sổ chi: %s', d.id, coalesce((j -> 'debt_paid' -> d.id::text)::text, 'KHÔNG CÓ'),
    (select count(*) from jsonb_array_elements(j -> 'items') x where x ->> 'book' = 'chi' and x ->> 'col' = 'no' and (x ->> 'amount')::bigint = 1000));
  -- 4. bỏ trả → nợ mới tự xoá, khoản cũ mở lại
  perform public.app_cn_debt_uncollect(d.id);
  rep := rep || format(E'\n4. bỏ trả: khoản cũ mở=%s · nợ mới còn=%s', (select closed_at is null from public.shift_debts where id = d.id), (select count(*) from public.shift_debts where rest_of = d.id));
  -- 5. phiếu chốt ca: debts có paid_date / paid_shift
  select report_id into rid from public.shift_debts where report_id is not null and closed_at is not null order by id desc limit 1;
  j := public.app_ca_get(rid);
  rep := rep || format(E'\n5. app_ca_get(%s) debts có paid_shift: %s · mẫu: %s', rid,
    coalesce((select bool_and(x ? 'paid_shift') from jsonb_array_elements(j -> 'debts') x)::text, 'không có nợ'),
    coalesce((select (x -> 'paid_date')::text || ' ' || (x -> 'paid_shift')::text from jsonb_array_elements(j -> 'debts') x where x ->> 'closed_at' is not null limit 1), '-'));
  -- 6. gán nợ phiếu chênh lệch đã vá
  rep := rep || E'\n6. gán nợ đủ khoản: ' || (position('két dư phải đủ cả khoản' in pg_get_functiondef('public.app_stc_gap_debt(bigint,text,bigint,bigint,text)'::regprocedure)) > 0);
  raise exception 'REPORT>> %', rep;
end $$;
