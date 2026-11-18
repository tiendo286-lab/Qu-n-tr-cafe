-- KIỂM TRA bước 133 (tệp mới sau 116): Báo nợ chọn người nợ (nhóm Công nợ), Thu/Chi → Báo nợ ở Kiểm tra, Luân chuyển tiền mặt – CK 2 chiều,
-- quyền Kiểm tra chỉ Chủ / QL tổng / quản lý đối soát cơ sở. Chạy trong begin … rollback (in REPORT>>).
begin;
do $$
declare chu uuid; uql uuid; ql bigint; uqx uuid; qx bigint; br bigint; rid bigint; rd bigint; r jsonb; e text; ppl jsonb; did bigint;
        a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false; m jsonb := '{}'::jsonb;
        k uuid := gen_random_uuid();
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  -- cơ sở có quản lý đối soát (vai ql) + phiếu đủ dữ liệu kế toán; 1 quản lý khác không phân công cơ sở đó
  select pa.branch_id, a.id, a.auth_user_id into br, ql, uql from public.pc_assign pa join public.accounts a on a.id = any(pa.accounts)
   where pa.job = 1 and a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and exists (select 1 from public.shift_reports r1 where r1.branch_id = pa.branch_id and r1.status = 'hoan_thanh' and not public.app__fin_locked(r1.branch_id, r1.work_date)
                   and coalesce((public.app__ca_kt_state(r1.id) ->> 'ready')::boolean, false))
   order by pa.branch_id limit 1;
  select a.id, a.auth_user_id into qx, uqx from public.accounts a where a.system_role = 'ql' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and not a.id = any(public.app__pc_who(1, 'branch', br)) order by a.id limit 1;
  select r0.id into rid from public.shift_reports r0 where r0.branch_id = br and r0.status = 'hoan_thanh' and not public.app__fin_locked(r0.branch_id, r0.work_date)
     and coalesce((public.app__ca_kt_state(r0.id) ->> 'ready')::boolean, false) order by r0.work_date desc, r0.id desc limit 1;
  set local session_replication_role = replica;
  delete from public.shift_report_checks where report_id = rid;   -- phiếu chưa duyệt mục nào, không có mục web tự đối soát
  set local session_replication_role = origin;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- a) phiếu nhân viên đang chốt: Báo nợ chọn người → đúng nhóm
  begin
    select r1.id into rd from public.shift_reports r1 where r1.status = 'dang_chot' order by r1.id desc limit 1;
    if rd is null then  -- không có phiếu đang chốt: tạm đưa 1 phiếu về đang chốt trong giao dịch thử
      select id into rd from public.shift_reports where status = 'hoan_thanh' order by id desc limit 1;
      set local session_replication_role = replica; update public.shift_reports set status = 'dang_chot' where id = rd; set local session_replication_role = origin;
    end if;
    perform public.app__ca_save_core(rd, jsonb_build_object('debts', jsonb_build_array(
      jsonb_build_object('table_name', 'Kho tổng', 'kind', 'ck', 'amount', 1000, 'grp', 'kho'),
      jsonb_build_object('table_name', 'Người nhà thử', 'kind', 'muon', 'amount', 2000, 'grp', 'khac'),
      jsonb_build_object('table_name', 'Bàn thử 133', 'kind', 'bill', 'amount', 3000))));
    a_ok := (select grp from public.shift_debts where report_id = rd and table_name = 'Kho tổng') = 'kho'
      and (select grp from public.shift_debts where report_id = rd and table_name = 'Người nhà thử') = 'khac'
      and (select grp from public.shift_debts where report_id = rd and table_name = 'Bàn thử 133') = 'khach';
  exception when others then m := m || jsonb_build_object('a', sqlerrm); end;
  -- b) danh sách người nợ của cơ sở
  begin
    ppl := public.app_ca_debt_people((select branch_id from public.shift_reports where id = rd));
    b_ok := exists (select 1 from jsonb_array_elements(ppl) x where x->>'grp' = 'kho' and lower(x->>'name') = 'kho tổng')
      and exists (select 1 from jsonb_array_elements(ppl) x where x->>'grp' = 'khac' and x->>'name' = 'Người nhà thử')
      and not exists (select 1 from jsonb_array_elements(ppl) x where x->>'name' = 'Bàn thử 133');
    if not b_ok then m := m || jsonb_build_object('b', ppl); end if;
  exception when others then m := m || jsonb_build_object('b', sqlerrm); end;
  -- e) quản lý KHÔNG phân công cơ sở: không kiểm tra, không lưu (kể cả phiếu chưa web tự đối soát)
  perform set_config('request.jwt.claims', json_build_object('sub', uqx, 'role', 'authenticated')::text, true);
  begin
    r := public.app_ca_get(rid);
    begin
      perform public.app_ca_recon_apply(rid, jsonb_build_object('debts', jsonb_build_array(jsonb_build_object('op', 'set', 'id', null, 'kind', 'ck', 'name', 'Thử', 'amount', 1000))), 'thử 133');
      e := 'không bị chặn';
    exception when others then e := sqlerrm; end;
    e_ok := qx is not null and not coalesce((r->>'can_recon')::boolean, true) and coalesce(r->>'recon_note', '') like 'Chỉ%'
      and e = 'Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này kiểm tra / sửa được phiếu này.';
    m := m || jsonb_build_object('e', e, 'e_note', r->>'recon_note', 'e_can', r->>'can_recon');
  exception when others then m := m || jsonb_build_object('e2', sqlerrm); end;
  -- c) quản lý đối soát cơ sở: Thu/Chi → Báo nợ Kho tổng ở Kiểm tra (1 lần Lưu)
  perform set_config('request.jwt.claims', json_build_object('sub', uql, 'role', 'authenticated')::text, true);
  begin
    r := public.app_ca_recon_apply(rid, jsonb_build_object('debts', jsonb_build_array(jsonb_build_object('op', 'set', 'id', null, 'kind', 'ck', 'name', 'Kho tổng',
           'amount', 5000, 'note', 'kho vay', 'grp', 'kho', 'from', 'Chi CK 5.000 · thử 133'))), 'đổi chi thành nợ');
    select id into did from public.shift_debts where report_id = rid and table_name = 'Kho tổng' and amount = 5000;
    c_ok := (r->>'changed')::boolean and (select grp from public.shift_debts where id = did) = 'kho'
      and exists (select 1 from public.shift_recon_log where report_id = rid and action = 'bao_no_them' and before = to_jsonb('Chi CK 5.000 · thử 133'::text));
  exception when others then m := m || jsonb_build_object('c', sqlerrm); end;
  -- d) Luân chuyển tiền mặt – CK: chiều CK → TM hợp lệ; 2 vế cùng dấu bị chặn
  begin
    perform public.app__ca_validate_exchanges(jsonb_build_array(
      jsonb_build_object('kind', 'tien_mat', 'amount', 5000, 'note', 'rút về két', 'exchange_key', k),
      jsonb_build_object('kind', 'chuyen_khoan', 'amount', -5000, 'note', 'rút về két', 'exchange_key', k)));
    begin
      perform public.app__ca_validate_exchanges(jsonb_build_array(
        jsonb_build_object('kind', 'tien_mat', 'amount', 5000, 'note', 'x', 'exchange_key', k),
        jsonb_build_object('kind', 'chuyen_khoan', 'amount', 5000, 'note', 'x', 'exchange_key', k)));
      e := 'không bị chặn';
    exception when others then e := sqlerrm; end;
    d_ok := e like 'Phiếu luân chuyển tiền mặt – CK%';
    m := m || jsonb_build_object('d', e);
  exception when others then m := m || jsonb_build_object('d2', sqlerrm); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok then 'PASS' else 'FAIL' end,
    'a_bao_no_dung_nhom', a_ok, 'b_danh_sach_nguoi_no', b_ok, 'c_thu_chi_thanh_no_kho', c_ok, 'd_luan_chuyen_2_chieu', d_ok, 'e_quyen_kiem_tra', e_ok, 'loi', m, 'phieu', rid);
end $$;
rollback;
