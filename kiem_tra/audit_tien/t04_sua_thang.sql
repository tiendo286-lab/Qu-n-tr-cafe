-- KIỂM TRA bước 119: "Sửa thẳng" trên ca đã hoàn thành đối soát
-- a) Chủ Sửa thẳng mục Doanh thu: ô của mục CHƯA duyệt (tiền mặt) vẫn sửa được
-- b) Sửa thẳng thêm khách nợ (nợ hoá đơn — không đổi số lệch) → được
-- c) thêm "khách mượn" làm đổi số lệch tiền mặt đã duyệt → bị từ chối "Số lệch … đã đổi"
-- d) Quản lý (không phải Chủ) Sửa thẳng mục Công nợ → được; mục web tự đối soát → "chỉ Chủ"
-- Chạy trong begin … rollback. Kết quả ở REPORT>>.
begin;
do $$
declare rid bigint; chu uuid; ql uuid; r0 public.shift_reports; cc bigint; a_ok boolean := false; b_ok boolean := false; c_ok boolean := false;
        d1_ok boolean := false; d2_ok boolean := false; m1 text; m2 text; m3 text; m4 text; m5 text;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select a.auth_user_id into ql from public.accounts a where a.system_role in ('ql', 'ql_tong') and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by (a.system_role = 'ql') desc, a.id limit 1;
  -- phiếu đã có file Fabi + đủ ngân hàng (không bị "chờ kế toán")
  select * into r0 from public.shift_reports r where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date)
     and exists (select 1 from public.fabi_shifts f where f.report_id = r.id) and (public.app__ca_money(r.id) ->> 'bank_ok')::boolean
   order by r.work_date desc, r.id desc limit 1;
  rid := r0.id;
  set local session_replication_role = replica;   -- dựng tình huống: tạm tắt trigger khoá (chỉ trong phần dựng)
  delete from public.shift_report_results where report_id = rid;
  delete from public.shift_report_checks where report_id = rid;
  delete from public.shift_report_recon where report_id = rid;
  delete from public.shift_shortfalls where report_id = rid;
  update public.shift_reports set recon_status = 'hoan_thanh' where id = rid;
  insert into public.shift_report_checks(report_id, item, checked_at) values (rid, 'doanh_thu', public.vn_now_text()), (rid, 'cong_no', public.vn_now_text());
  insert into public.shift_report_results(report_id, item, result, amount, at) values (rid, 'cong_no', 'khop', 0, public.vn_now_text());
  set local session_replication_role = origin;
  -- a) Chủ
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  cc := coalesce((public.app__ca_eff(rid) ->> 'cash_counted')::bigint, 0) + 1000;
  begin
    perform public.app_ca_recon_direct(rid, jsonb_build_object('cash_counted', cc), 'kiểm tra tự động', array['doanh_thu']);
    a_ok := (public.app__ca_eff(rid) ->> 'cash_counted')::bigint = cc;
  exception when others then m1 := sqlerrm;
  end;
  -- tiền mặt được duyệt với số lệch hiện tại
  insert into public.shift_report_checks(report_id, item, checked_at) values (rid, 'tien_mat', public.vn_now_text()) on conflict do nothing;
  insert into public.shift_report_results(report_id, item, result, amount, computed, at)
  values (rid, 'tien_mat', 'khop', 0, (public.app__ca_money(rid) ->> 'tm_left')::bigint, public.vn_now_text()) on conflict (report_id, item) do update set computed = excluded.computed;
  -- b) nợ hoá đơn: không đổi số lệch
  perform set_config('app.gap0_' || rid, '', true);   -- mỗi lần bấm trên web là 1 giao dịch riêng → mốc mới
  begin
    perform public.app_ca_recon_debt_set(rid, null, 'bill', 'Bàn thử 119', 50000, null, 'kiểm tra tự động');
    b_ok := exists (select 1 from public.shift_debts where report_id = rid and table_name = 'Bàn thử 119');
  exception when others then m2 := sqlerrm;
  end;
  -- c) khách mượn: đổi số lệch tiền mặt đã duyệt → phải bị từ chối
  perform set_config('app.gap0_' || rid, '', true);   -- mỗi lần bấm trên web là 1 giao dịch riêng → mốc mới
  begin
    perform public.app_ca_recon_debt_set(rid, null, 'muon', 'Khách thử 119', 70000, null, 'kiểm tra tự động');
    c_ok := false; m3 := 'không bị từ chối';
  exception when others then c_ok := sqlerrm like '%Số lệch%'; m3 := sqlerrm;
  end;
  -- d) Quản lý
  perform set_config('app.gap0_' || rid, '', true);   -- mỗi lần bấm trên web là 1 giao dịch riêng → mốc mới
  perform set_config('request.jwt.claims', json_build_object('sub', ql, 'role', 'authenticated')::text, true);
  begin
    perform public.app_ca_recon_direct(rid, '{}'::jsonb, 'kiểm tra tự động', array['cong_no']);
    perform public.app_ca_recon_debt_set(rid, null, 'bill', 'Bàn thử 119 QL', 10000, null, 'kiểm tra tự động');
    d1_ok := exists (select 1 from public.shift_debts where report_id = rid and table_name = 'Bàn thử 119 QL');
  exception when others then m4 := sqlerrm;
  end;
  update public.shift_report_checks set auto = 1 where report_id = rid and item = 'doanh_thu';
  begin
    perform public.app_ca_recon_direct(rid, '{}'::jsonb, 'kiểm tra tự động', array['doanh_thu']);
    m5 := 'không bị từ chối';
  exception when others then d2_ok := sqlerrm like '%chỉ Chủ%'; m5 := sqlerrm;
  end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d1_ok and d2_ok then 'PASS' else 'FAIL' end,
    'a_o_muc_chua_duyet_van_mo', a_ok, 'a_loi', m1, 'b_them_no_hd', b_ok, 'b_loi', m2, 'c_tu_choi_doi_so_lech', c_ok, 'c_loi', m3,
    'd1_quan_ly_sua_thang_cong_no', d1_ok, 'd1_loi', m4, 'd2_muc_tu_doi_soat_chi_chu', d2_ok, 'd2_loi', m5, 'phieu', rid);
end $$;
rollback;
