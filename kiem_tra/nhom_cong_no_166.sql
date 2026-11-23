-- Bài thử tệp 166 (chặng 6.4: nhóm Chủ + nợ khách không cần tên). Chạy NGAY SAU tệp 166 trong cùng một lần gửi (tự hoàn tác).
-- Trước tệp 166 phải có: create temp table t166_truoc as select branch_id, sum(amount) s, count(*) n from public.shift_debts where closed_at is null group by 1;
-- Đạt: "REPORT>> ĐẠT 9/9 …".
DO $test$
declare uid uuid; acc bigint; br bigint; rid bigint; d text := to_char(public.vn_now()::date, 'YYYY-MM-DD'); m text := to_char(public.vn_now()::date, 'YYYY-MM');
  kp bigint; kp2 bigint; pchu bigint; pnha bigint; d1 bigint; d2 bigint; d3 bigint; d4 bigint; d5 bigint; rest bigint; x public.shift_debts; j jsonb; e text;
  ok text[] := '{}'; fn text; h1 text; h2 text; n int;
begin
  select id, auth_user_id into acc, uid from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  insert into public.branches(code, name, sort_order) values ('T166_' || substr(gen_random_uuid()::text, 1, 6), 'Cơ sở thử 166', 999) returning id into br;
  insert into public.shift_reports(branch_id, work_date, shift, status, created_by) values (br, d, 'Sáng', 'dang_chot', acc) returning id into rid;

  -- C1 người chung "Khách"
  kp := public.app__khach_person(br); kp2 := public.app__khach_person(br);
  if kp is null or kp <> kp2 or not exists (select 1 from public.debt_people where id = kp and grp = 'khach' and name = 'Khách' and active = 1) then raise exception 'FAIL C1 %/%', kp, kp2; end if;
  ok := array_append(ok, 'C1'::text);

  -- C2 + C3 (người, nợ ngoài ca nhóm chu)
  pchu := public.app_stc_person_save(null, jsonb_build_object('branch_id', br, 'name', 'Chủ thử', 'grp', 'chu'));
  pnha := public.app_stc_person_save(null, jsonb_build_object('branch_id', br, 'name', 'Người nhà thử', 'grp', 'khac'));
  d1 := public.app_cn_debt_save(null, jsonb_build_object('branch_id', br, 'grp', 'chu', 'name', 'Chủ thử', 'amount', 5000, 'kind', 'muon', 'date', d));
  select * into x from public.shift_debts where id = d1;
  if x.grp <> 'chu' or x.family <> 1 or x.person_id is distinct from pchu then raise exception 'FAIL C2 grp=% fam=% person=%', x.grp, x.family, x.person_id; end if;
  update public.shift_debts set family = 1, note = 'thử' where id = d1;
  if (select grp from public.shift_debts where id = d1) <> 'chu' then raise exception 'FAIL C2 đổi family làm mất nhóm chu'; end if;
  ok := array_append(ok, 'C2'::text);
  foreach fn in array array['app__debt_grp_sync', 'app__ca_save_core', 'app_ca_recon_apply', 'app_cn_debt_save', 'app_cn_person_save', 'app_stc_ca_debt_save',
                            'app_stc_debt_sort', 'app_stc_person_save', 'app_tc_move_to_debt'] loop
    if not exists (select 1 from pg_proc where proname = fn and prosrc like '%''khach'', ''kho'', ''chu'', ''khac''%') then raise exception 'FAIL C3 % chưa nhận chu', fn; end if;
  end loop;
  ok := array_append(ok, 'C3'::text);

  -- C4 nợ phiếu ca nhóm khách: người chung, chữ gõ giữ
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind, grp) values (br, rid, 'bàn 5', 30000, acc, 'muon', 'khach') returning id into d2;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind, grp) values (br, rid, 'anh lấy 100k', 100000, acc, 'muon', 'khac') returning id into d3;
  select * into x from public.shift_debts where id = d2;
  if x.person_id is distinct from kp or x.table_name <> 'bàn 5' then raise exception 'FAIL C4 person=% name=%', x.person_id, x.table_name; end if;
  ok := array_append(ok, 'C4'::text);

  -- C5 Công nợ › Ghi nợ khách (ngoài ca) tên lạ / để trống
  d4 := public.app_cn_debt_save(null, jsonb_build_object('branch_id', br, 'grp', 'khach', 'name', 'bàn 7', 'amount', 7000, 'kind', 'muon', 'date', d));
  d5 := public.app_cn_debt_save(null, jsonb_build_object('branch_id', br, 'grp', 'khach', 'name', '', 'amount', 2000, 'kind', 'bill', 'date', d));
  if (select person_id from public.shift_debts where id = d4) is distinct from kp or (select table_name from public.shift_debts where id = d4) <> 'bàn 7'
     or (select table_name from public.shift_debts where id = d5) <> 'Khách' then raise exception 'FAIL C5'; end if;
  ok := array_append(ok, 'C5'::text);

  -- C6 bước 1: nợ khách coi như đã xếp, nợ khác chưa xếp; Xếp nợ khác vào chu
  update public.shift_reports set status = 'hoan_thanh' where id = rid;
  j := public.app_stc_month(br, m);
  if not exists (select 1 from jsonb_array_elements(j -> 'ca_debts') z where (z ->> 'id')::bigint = d2 and (z ->> 'sorted')::boolean)
     or not exists (select 1 from jsonb_array_elements(j -> 'ca_debts') z where (z ->> 'id')::bigint = d3 and not (z ->> 'sorted')::boolean) then
    raise exception 'FAIL C6 sorted %', j -> 'ca_debts';
  end if;
  if not exists (select 1 from pg_proc where proname = 'app__stc_ds_missing' and prosrc like '%g.sorted_at is null and coalesce(g.grp, ''khach'') <> ''khach''%') then raise exception 'FAIL C6 ds_missing'; end if;
  begin
    perform public.app_stc_debt_sort(d3, pchu, 'chu');
    select * into x from public.shift_debts where id = d3;
    if x.grp <> 'chu' or x.person_id <> pchu or x.sorted_at is null or x.content <> 'anh lấy 100k' then raise exception 'FAIL C6 xếp chu % % %', x.grp, x.person_id, x.content; end if;
    perform public.app_stc_debt_sort(d3, null, 'khach');   -- Đổi nhóm về Khách hàng: không cần người
    select * into x from public.shift_debts where id = d3;
    if x.grp <> 'khach' or x.person_id <> kp or x.table_name <> 'anh lấy 100k' then raise exception 'FAIL C6 về khách % % %', x.grp, x.person_id, x.table_name; end if;
  exception when others then
    get stacked diagnostics e = message_text;
    if e like 'FAIL%' then raise; end if;
    if e not like '%kế toán%' then raise exception 'FAIL C6 xếp lỗi: %', e; end if;   -- ca thử chưa có dữ liệu kế toán: chấp nhận, đã kiểm phần sorted
  end;
  ok := array_append(ok, ('C6' || case when e like '%kế toán%' then '(xếp: ca thử chờ kế toán)' else '(xếp chu + về khách đã chạy)' end)::text);

  -- C7 khách trả một phần (ngoài ca) → khoản còn lại vẫn người chung, nhóm khách
  perform public.app_cn_debt_collect(d4, d, 'tien_mat', 3000, null);
  select * into x from public.shift_debts where rest_of = d4 order by id desc limit 1;
  if x.id is null then select * into x from public.shift_debts where split_from = d4 and closed_at is null order by id desc limit 1; end if;
  if x.id is null or x.grp <> 'khach' or x.person_id is distinct from kp then raise exception 'FAIL C7 % % %', x.id, x.grp, x.person_id; end if;
  ok := array_append(ok, 'C7'::text);

  -- C8 người chung không sửa được; không tạo người nhóm khách
  begin perform public.app_stc_person_save(kp, jsonb_build_object('name', 'Khách', 'grp', 'khach', 'active', 0)); raise exception 'FAIL C8 ngừng dùng người chung được';
  exception when others then get stacked diagnostics e = message_text; if e like 'FAIL%' or e not like '%luôn có%' then raise exception 'FAIL C8a: %', e; end if; end;
  begin perform public.app_stc_person_save(null, jsonb_build_object('branch_id', br, 'name', 'Bàn 9', 'grp', 'khach')); raise exception 'FAIL C8 tạo người khách được';
  exception when others then get stacked diagnostics e = message_text; if e like 'FAIL%' or e not like '%không cần tên%' then raise exception 'FAIL C8b: %', e; end if; end;
  ok := array_append(ok, 'C8'::text);

  -- C9 chuyển dữ liệu: tổng tiền mỗi cơ sở không đổi; chạy lần 2 không đổi gì; mỗi cơ sở đúng 1 người "Khách"
  if exists (select 1 from t166_truoc t left join (select branch_id, sum(amount) s, count(*) n from public.shift_debts where closed_at is null and branch_id <> br group by 1) z
              on z.branch_id = t.branch_id where (z.s, z.n) is distinct from (t.s, t.n)) then raise exception 'FAIL C9 tổng tiền đổi'; end if;
  select md5(string_agg(id || '|' || coalesce(grp, '') || '|' || coalesce(person_id::text, '') || '|' || coalesce(table_name, '') || '|' || coalesce(content, ''), ',' order by id)) into h1 from public.shift_debts where branch_id <> br;
  execute $m$do $mig$
declare b record;
begin
  for b in select id from public.branches loop perform public.app__khach_person(b.id); end loop;
  if exists (select 1 from public.debt_people where id = 14 and grp = 'khac') then
    update public.shift_debts d set grp = 'khac', person_id = 14 where d.id in (26, 29) and d.branch_id = (select branch_id from public.debt_people where id = 14)
       and (d.grp, d.person_id) is distinct from ('khac', 14::bigint);
  end if;
  if exists (select 1 from public.debt_people where id = 17 and lower(btrim(name)) = 'tiến') then
    update public.debt_people set grp = 'chu' where id = 17 and grp is distinct from 'chu';
    update public.shift_debts set grp = 'chu' where person_id = 17 and grp is distinct from 'chu';
  end if;
  update public.shift_debts d set person_id = public.app__khach_person(d.branch_id)
   where coalesce(d.grp, 'khach') = 'khach' and d.person_id is distinct from public.app__khach_person(d.branch_id);
  update public.debt_people p set active = 0
   where p.grp = 'khach' and p.active = 1 and p.id <> public.app__khach_person(p.branch_id);
end $mig$$m$;
  select md5(string_agg(id || '|' || coalesce(grp, '') || '|' || coalesce(person_id::text, '') || '|' || coalesce(table_name, '') || '|' || coalesce(content, ''), ',' order by id)) into h2 from public.shift_debts where branch_id <> br;
  if h1 <> h2 then raise exception 'FAIL C9 chạy lần 2 đổi dữ liệu'; end if;
  if exists (select 1 from public.branches b where (select count(*) from public.debt_people p where p.branch_id = b.id and lower(btrim(p.name)) = 'khách') <> 1) then raise exception 'FAIL C9 số người Khách'; end if;
  if exists (select 1 from public.shift_debts where coalesce(grp, 'khach') = 'khach' and person_id is distinct from public.app__khach_person(branch_id)) then raise exception 'FAIL C9 còn nợ khách chưa gắn người chung'; end if;
  ok := array_append(ok, 'C9'::text);

  raise exception 'REPORT>> ĐẠT %/9 (%) · chu mở = % đ / % khoản · khách mở = % đ · người khách còn dùng = % · nợ nhóm (mở): %', cardinality(ok), array_to_string(ok, ' '),
    (select coalesce(sum(amount), 0) from public.shift_debts where grp = 'chu' and closed_at is null and branch_id <> br),
    (select count(*) from public.shift_debts where grp = 'chu' and closed_at is null and branch_id <> br),
    (select coalesce(sum(amount), 0) from public.shift_debts where grp = 'khach' and closed_at is null and branch_id <> br),
    (select count(*) from public.debt_people where grp = 'khach' and active = 1 and branch_id <> br),
    (select string_agg(g || '=' || s, ' ') from (select grp g, sum(amount) s from public.shift_debts where closed_at is null and branch_id <> br group by 1 order by 1) z);
end $test$;
