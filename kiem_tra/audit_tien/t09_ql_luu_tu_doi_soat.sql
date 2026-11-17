-- KIỂM TRA bước 129 (tệp 113): phiếu web đã tự đối soát — Quản lý tổng và quản lý được phân công cơ sở (người đối soát) Lưu được phần tiền
-- (lý do bắt buộc, lịch sử), Chủ được báo; quản lý cơ sở khác vẫn bị chặn. Chạy trong begin … rollback (in REPORT>>).
begin;
do $$
declare rid bigint; br bigint; uql uuid; ql bigint; uqx uuid; qx bigint; uqt uuid; qt bigint; chu bigint; r jsonb; e2 text;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; m jsonb := '{}'::jsonb;
begin
  select id into chu from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 order by id limit 1;
  select id, auth_user_id into qt, uqt from public.accounts where system_role = 'ql_tong' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  -- cơ sở có người đối soát là quản lý (không phải QL tổng) + 1 quản lý khác không được phân công cơ sở đó
  select pa.branch_id, a.id, a.auth_user_id into br, ql, uql from public.pc_assign pa join public.accounts a on a.id = any(pa.accounts)
   where pa.job = 1 and a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and exists (select 1 from public.shift_reports r1 where r1.branch_id = pa.branch_id and r1.status = 'hoan_thanh' and not public.app__fin_locked(r1.branch_id, r1.work_date)
                   and coalesce((public.app__ca_kt_state(r1.id) ->> 'ready')::boolean, false))
   order by pa.branch_id limit 1;
  select a.id, a.auth_user_id into qx, uqx from public.accounts a where a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and not a.id = any(public.app__pc_who(1, 'branch', br)) order by a.id limit 1;
  select r0.id into rid from public.shift_reports r0 where r0.branch_id = br and r0.status = 'hoan_thanh' and not public.app__fin_locked(r0.branch_id, r0.work_date)
     and coalesce((public.app__ca_kt_state(r0.id) ->> 'ready')::boolean, false) order by r0.work_date desc, r0.id desc limit 1;
  -- dựng: mục Công nợ + Thu chi web tự đối soát
  set local session_replication_role = replica;
  delete from public.shift_report_checks where report_id = rid;
  insert into public.shift_report_checks(report_id, item, checked_at, auto) values (rid, 'cong_no', public.vn_now_text(), 1), (rid, 'thu_chi', public.vn_now_text(), 1);
  set local session_replication_role = origin;
  -- a) quản lý KHÁC cơ sở → chặn
  perform set_config('request.jwt.claims', json_build_object('sub', uqx, 'role', 'authenticated')::text, true);
  begin
    perform public.app_ca_recon_apply(rid, jsonb_build_object('fields', jsonb_build_object('moves', '[{"kind":"chuyen_khoan","amount":-1000,"note":"thử 128"}]'::jsonb)), 'thử 128');
    e2 := 'không bị chặn';
  exception when others then e2 := sqlerrm; end;
  a_ok := qx is not null and e2 = 'Mục web đã tự đối soát — chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này sửa được.';
  m := m || jsonb_build_object('a', e2);
  -- b) quản lý đối soát của cơ sở → lưu được, Chủ được báo
  perform set_config('request.jwt.claims', json_build_object('sub', uql, 'role', 'authenticated')::text, true);
  begin
    r := public.app_ca_recon_apply(rid, jsonb_build_object('debts', jsonb_build_array(jsonb_build_object('op', 'set', 'id', null, 'kind', 'ck', 'name', 'Thử 128', 'amount', 1000, 'note', null))), 'thử 128 ql');
    b_ok := (r->>'changed')::boolean and exists (select 1 from public.shift_debts where report_id = rid and table_name = 'Thử 128')
      and exists (select 1 from public.notifications where account_id = chu and title = 'Quản lý sửa phiếu web đã tự đối soát' and body like '%thử 128 ql%')
      and exists (select 1 from public.shift_recon_log where report_id = rid and reason = 'thử 128 ql');
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  -- c) Quản lý tổng → lưu được
  set local session_replication_role = replica;
  insert into public.shift_report_checks(report_id, item, checked_at, auto) values (rid, 'cong_no', public.vn_now_text(), 1) on conflict (report_id, item) do update set auto = 1;
  set local session_replication_role = origin;
  perform set_config('request.jwt.claims', json_build_object('sub', uqt, 'role', 'authenticated')::text, true);
  begin
    r := public.app_ca_recon_apply(rid, jsonb_build_object('debts', jsonb_build_array(jsonb_build_object('op', 'set', 'id', null, 'kind', 'ck', 'name', 'Thử 128b', 'amount', 2000, 'note', null))), 'thử 128 qlt');
    c_ok := (r->>'changed')::boolean;
  exception when others then m := m || jsonb_build_object('c', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok then 'PASS' else 'FAIL' end,
    'a_ql_khac_bi_chan', a_ok, 'b_ql_co_so_luu_duoc_bao_chu', b_ok, 'c_ql_tong_luu_duoc', c_ok, 'loi', m, 'phieu', rid, 'co_so', br);
end $$;
rollback;
