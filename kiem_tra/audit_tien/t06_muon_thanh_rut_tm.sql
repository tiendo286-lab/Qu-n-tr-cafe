-- KIỂM TRA bước 119: "Đổi thành Khách CK rút tiền mặt" cho khoản Khách mượn (giống LHP 09/11: ca A ghi khách mượn 500.000, ca B ghi khách trả CK)
-- Sau khi đổi: ca A tiền mặt không đổi, chuyển khoản lệch giảm 500.000; ca B bỏ khoản trả (lệch CK tăng 500.000); khoản nợ hết; ca A có 1 cặp đổi tiền; lịch sử ở cả 2 ca.
-- Thêm: ca B đã duyệt chuyển khoản → từ chối; không lý do → từ chối. Chạy trong begin … rollback.
begin;
do $$
declare ca bigint; cb bigint; br bigint; chu uuid; did bigint; a0 jsonb; b0 jsonb; a1 jsonb; b1 jsonb; npair int; nlog_a int; nlog_b int;
        main_ok boolean := false; e1 boolean := false; e2 boolean := false; m0 text; m1 text; m2 text;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select r.id, r.branch_id into ca, br from public.shift_reports r where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date) order by r.work_date desc, r.id desc limit 1;
  select r.id into cb from public.shift_reports r where r.status = 'hoan_thanh' and r.id <> ca and r.branch_id = br and not public.app__fin_locked(r.branch_id, r.work_date) order by r.work_date desc, r.id desc limit 1;
  set local session_replication_role = replica;   -- dựng tình huống (tắt trigger khoá trong phần dựng)
  update public.shift_reports set recon_status = 'chua' where id in (ca, cb);
  delete from public.shift_report_results where report_id in (ca, cb);
  delete from public.shift_report_checks where report_id in (ca, cb);
  set local session_replication_role = origin;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, note, created_by, kind) values (br, ca, 'Khách thử 119', 500000, null, null, 'muon') returning id into did;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_report_id = cb, collect_kind = 'chuyen_khoan', close_note = 'thử' where id = did;
  a0 := public.app__ca_money(ca); b0 := public.app__ca_money(cb);
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- không lý do → từ chối
  begin
    perform public.app_ca_recon_debt_to_exchange(ca, did, '');
    m1 := 'không bị từ chối';
  exception when others then e1 := sqlerrm like '%lý do%'; m1 := sqlerrm;
  end;
  -- ca B đã duyệt chuyển khoản → từ chối
  set local session_replication_role = replica;
  insert into public.shift_report_checks(report_id, item, checked_at) values (cb, 'chuyen_khoan', public.vn_now_text());
  set local session_replication_role = origin;
  begin
    perform public.app_ca_recon_debt_to_exchange(ca, did, 'kiểm tra tự động');
    m2 := 'không bị từ chối';
  exception when others then e2 := sqlerrm like '%mở lại%'; m2 := sqlerrm;
  end;
  set local session_replication_role = replica;
  delete from public.shift_report_checks where report_id = cb;
  set local session_replication_role = origin;
  perform set_config('app.gap0_' || ca, '', true); perform set_config('app.gap0_' || cb, '', true);
  -- đổi
  begin
    perform public.app_ca_recon_debt_to_exchange(ca, did, 'kiểm tra tự động');
    a1 := public.app__ca_money(ca); b1 := public.app__ca_money(cb);
    select count(*) into npair from jsonb_array_elements(public.app__ca_eff(ca) -> 'moves') m where nullif(m ->> 'exchange_key', '') is not null;
    select count(*) into nlog_a from public.shift_recon_log where report_id = ca and reason = 'kiểm tra tự động';
    select count(*) into nlog_b from public.shift_recon_log where report_id = cb and reason like 'kiểm tra tự động%';
    main_ok := (a1 ->> 'tm_left')::bigint = (a0 ->> 'tm_left')::bigint
      and (a1 ->> 'ck_left')::bigint = (a0 ->> 'ck_left')::bigint - 500000
      and (b1 ->> 'col_ck')::bigint = (b0 ->> 'col_ck')::bigint - 500000
      and (b1 ->> 'ck_left')::bigint = (b0 ->> 'ck_left')::bigint + 500000
      and not exists (select 1 from public.shift_debts where id = did)
      and npair = 2 and nlog_a >= 1 and nlog_b >= 1
      -- bước 120 (cần máy chủ 102): ghi chú "đổi từ Khách mượn"
      and exists (select 1 from jsonb_array_elements(public.app__ca_move_notes(ca)) e where e ->> 'type' = 'doi' and e -> 'before' ->> 'kind' = 'muon' and (e -> 'before' ->> 'amount')::bigint = 500000);
  exception when others then m0 := sqlerrm;
  end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when main_ok and e1 and e2 then 'PASS' else 'FAIL' end,
    'doi_dung', main_ok, 'loi', m0, 'tm_A', json_build_array(a0 ->> 'tm_left', a1 ->> 'tm_left'), 'ck_A', json_build_array(a0 ->> 'ck_left', a1 ->> 'ck_left'),
    'ck_B', json_build_array(b0 ->> 'ck_left', b1 ->> 'ck_left'), 'so_dong_doi_tien_A', npair, 'log_A', nlog_a, 'log_B', nlog_b,
    'chan_khong_ly_do', e1, 'chan_khong_ly_do_loi', m1, 'chan_ca_B_da_duyet', e2, 'chan_ca_B_loi', m2, 'ca_A', ca, 'ca_B', cb);
end $$;
rollback;
