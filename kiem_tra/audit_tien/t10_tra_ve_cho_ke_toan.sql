-- KIỂM TRA bước 131 (tệp 115): phiếu đã "hoàn thành đối soát" khi chưa đủ file Fabi + số dư ngân hàng (quản lý tự chốt trước bước 122)
-- → trả về Chờ kế toán; kế toán nhập được số dư; không còn phiếu nào đã đối soát mà thiếu dữ liệu kế toán. Chạy trong begin … rollback.
begin;
do $$
declare kt uuid; rid bigint; acc bigint; rid2 bigint; acc2 bigint; d_ok boolean := false; e_ok boolean := false; n_bad int; a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; m jsonb := '{}'::jsonb;
begin
  -- a) không còn phiếu đã đối soát mà thiếu dữ liệu kế toán
  select count(*) into n_bad from public.shift_reports r
   where r.recon_status = 'hoan_thanh' and coalesce((public.app__ca_kt_state(r.id) ->> 'need')::boolean, false)
     and not coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false);
  a_ok := n_bad = 0;
  -- b) phiếu đã trả về: không còn mục đã duyệt / kết quả, có ghi lịch sử
  select l.report_id into rid from public.shift_recon_log l where l.action = 'tra_ve_cho_ke_toan' order by l.id limit 1;
  b_ok := rid is not null
    and (select recon_status <> 'hoan_thanh' and not coalesce(self_reconciled, false) from public.shift_reports where id = rid)
    and not exists (select 1 from public.shift_report_checks where report_id = rid)
    and not exists (select 1 from public.shift_report_results where report_id = rid);
  -- c) kế toán nhập được số dư ngân hàng
  select a.auth_user_id into kt from public.accounts a where a.auth_user_id is not null and coalesce(a.locked, 0) = 0
     and (a.system_role = 'ke_toan' or exists (select 1 from public.account_perms p where p.account_id = a.id and p.perm = 'ke_toan')) order by a.id limit 1;
  select id into acc from public.bank_accounts where branch_id = (select branch_id from public.shift_reports where id = rid) and active = 1 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', kt, 'role', 'authenticated')::text, true);
  begin
    perform public.app_kt_bank_save_accounts(rid, jsonb_build_array(jsonb_build_object('account_id', acc, 'opening', 1000000, 'opening_manual', true, 'closing', 1500000, 'transfers_out', 0, 'note', 'thử 131')));
    c_ok := exists (select 1 from public.bank_account_balances where report_id = rid and account_id = acc and closing = 1500000);
  exception when others then m := m || jsonb_build_object('c', sqlerrm); end;
  -- d) phiếu bình thường đang chờ kế toán (cơ sở 2 tài khoản): kế toán nhập tài khoản đầu tiên được (trước đây bị chặn vì ghi lịch sử)
  select r.id into rid2 from public.shift_reports r
   where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and not coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false)
     and (select count(*) from public.bank_accounts b where b.branch_id = r.branch_id and b.active = 1) >= 2
     and not exists (select 1 from public.bank_account_balances x where x.report_id = r.id) and r.id <> rid
   order by r.work_date desc limit 1;
  select id into acc2 from public.bank_accounts where branch_id = (select branch_id from public.shift_reports where id = rid2) and active = 1 order by id limit 1;
  begin
    perform public.app_kt_bank_save_accounts(rid2, jsonb_build_array(jsonb_build_object('account_id', acc2, 'opening', 2000000, 'opening_manual', true, 'closing', 2500000, 'transfers_out', 0, 'note', null)));
    d_ok := exists (select 1 from public.bank_account_balances where report_id = rid2 and account_id = acc2 and closing = 2500000);
  exception when others then m := m || jsonb_build_object('d', sqlerrm); end;
  -- e) quản lý vẫn KHÔNG ghi được Kiểm tra khi phiếu đang chờ kế toán
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1), 'role', 'authenticated')::text, true);
  begin
    perform public.app_ca_recon_apply(rid2, jsonb_build_object('fields', jsonb_build_object('cups', 1)), 'thử 131');
    m := m || '{"e":"không bị chặn"}';
  exception when others then e_ok := sqlerrm like 'Phiếu chờ kế toán%'; m := m || jsonb_build_object('e', left(sqlerrm, 60)); end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok then 'PASS' else 'FAIL' end,
    'a_khong_con_phieu_thieu_du_lieu', a_ok, 'so_phieu_thieu', n_bad, 'b_tra_ve_cho_ke_toan', b_ok, 'phieu', rid, 'c_ke_toan_nhap_duoc', c_ok,
    'd_ke_toan_nhap_phieu_dang_cho', d_ok, 'phieu_d', rid2, 'e_quan_ly_van_bi_chan', e_ok, 'loi', m);
end $$;
rollback;
