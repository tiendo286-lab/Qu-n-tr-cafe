-- KIỂM TRA bước 121: app_ca_recon_apply — lưu cả gói thay đổi phần tiền trong 1 lần, cùng 1 lý do
-- a) gói hợp lệ (sửa số + thu chi + thêm báo nợ) → lưu đủ, lịch sử cùng lý do, mục tiền đã duyệt bị mở lại
-- b) gói có thao tác hỏng ở cuối → KHÔNG lưu gì  c) có thay đổi mà thiếu lý do → lỗi  d) gói rỗng → changed=false
-- e) quản lý (không phải Chủ) lưu khi có mục web tự đối soát → lỗi "chỉ Chủ". Chạy trong begin … rollback.
begin;
do $$
declare rid bigint; chu uuid; ql uuid; cc0 bigint; r jsonb; a_ok boolean := false; b_ok boolean := false; c_ok boolean := false; d_ok boolean := false; e_ok boolean := false;
        m1 text; m2 text; m3 text; m4 text; m5 text; nlog int; mv jsonb;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select a.auth_user_id into ql from public.accounts a where a.system_role in ('ql', 'ql_tong') and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by (a.system_role = 'ql') desc, a.id limit 1;
  select r0.id into rid from public.shift_reports r0 where r0.status = 'hoan_thanh' and not public.app__fin_locked(r0.branch_id, r0.work_date) order by r0.work_date desc, r0.id desc limit 1;
  set local session_replication_role = replica;   -- dựng: tiền mặt + thu chi đã duyệt (không phải tự đối soát)
  update public.shift_reports set recon_status = 'chua' where id = rid;
  delete from public.shift_report_results where report_id = rid;
  delete from public.shift_report_checks where report_id = rid;
  delete from public.shift_report_recon where report_id = rid;
  delete from public.shift_report_moves where report_id = rid;
  insert into public.shift_report_moves(report_id, kind, amount, note, sort_order) values (rid, 'tien_mat', -150000, 'Mua đá', 1), (rid, 'tien_mat', -30000, 'Mua giấy', 2);
  insert into public.shift_report_checks(report_id, item, checked_at) values (rid, 'tien_mat', public.vn_now_text()), (rid, 'thu_chi', public.vn_now_text());
  insert into public.shift_report_results(report_id, item, result, amount, at) values (rid, 'tien_mat', 'khop', 0, public.vn_now_text());
  set local session_replication_role = origin;
  cc0 := (public.app__recon_snapshot(rid) ->> 'cash_counted')::bigint;
  mv := '[{"kind":"tien_mat","amount":-100000,"note":"Mua đá"},{"kind":"chuyen_khoan","amount":50000,"note":"Hoàn tiền"}]'::jsonb;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- d) rỗng
  begin
    r := public.app_ca_recon_apply(rid, '{}'::jsonb, null);
    d_ok := coalesce((r ->> 'changed')::boolean, true) = false;
  exception when others then m4 := sqlerrm;
  end;
  -- c) thiếu lý do
  begin
    perform public.app_ca_recon_apply(rid, jsonb_build_object('fields', jsonb_build_object('moves', mv)), '');
    m3 := 'không bị từ chối';
  exception when others then c_ok := sqlerrm like '%lý do%'; m3 := sqlerrm;
  end;
  -- b) thao tác hỏng ở cuối → không lưu gì
  begin
    perform public.app_ca_recon_apply(rid, jsonb_build_object('fields', jsonb_build_object('moves', mv, 'cash_counted', cc0 + 1000),
      'debts', '[{"op":"remove","id":-1}]'::jsonb), 'thử 121 hỏng');
    m2 := 'không bị lỗi';
  exception when others then m2 := sqlerrm;
  end;
  b_ok := m2 <> 'không bị lỗi' and not exists (select 1 from public.shift_report_recon where report_id = rid and (data ->> 'cash_counted')::bigint = cc0 + 1000)
          and exists (select 1 from public.shift_report_checks where report_id = rid and item = 'tien_mat')
          and not exists (select 1 from public.shift_recon_log where report_id = rid and reason = 'thử 121 hỏng');
  -- a) gói hợp lệ
  begin
    r := public.app_ca_recon_apply(rid, jsonb_build_object('fields', jsonb_build_object('moves', mv, 'cash_counted', cc0 + 1000),
      'debts', '[{"op":"set","id":null,"kind":"bill","name":"Bàn thử 121","amount":30000,"note":null}]'::jsonb), 'thử 121');
    select count(*) into nlog from public.shift_recon_log where report_id = rid and reason = 'thử 121';
    a_ok := (r ->> 'changed')::boolean and (public.app__ca_eff(rid) ->> 'cash_counted')::bigint = cc0 + 1000
      and jsonb_array_length(public.app__ca_eff(rid) -> 'moves') >= 2
      and exists (select 1 from public.shift_debts where report_id = rid and table_name = 'Bàn thử 121')
      and not exists (select 1 from public.shift_report_checks where report_id = rid and item in ('tien_mat', 'thu_chi'))
      and nlog >= 2;
  exception when others then m1 := sqlerrm;
  end;
  -- e) quản lý + mục web tự đối soát
  set local session_replication_role = replica;
  insert into public.shift_report_checks(report_id, item, checked_at, auto) values (rid, 'doanh_thu', public.vn_now_text(), 1) on conflict (report_id, item) do update set auto = 1;
  set local session_replication_role = origin;
  perform set_config('request.jwt.claims', json_build_object('sub', ql, 'role', 'authenticated')::text, true);
  begin
    perform public.app_ca_recon_apply(rid, jsonb_build_object('fields', jsonb_build_object('cups', 999)), 'thử 121 ql');
    m5 := 'không bị từ chối';
  exception when others then e_ok := sqlerrm like '%chỉ Chủ%'; m5 := sqlerrm;
  end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and e_ok then 'PASS' else 'FAIL' end,
    'a_luu_ca_goi', a_ok, 'a_loi', m1, 'b_hong_thi_khong_luu', b_ok, 'b_loi', m2, 'c_bat_buoc_ly_do', c_ok, 'c_loi', m3, 'd_goi_rong', d_ok, 'd_loi', m4,
    'e_tu_doi_soat_chi_chu', e_ok, 'e_loi', m5, 'phieu', rid);
end $$;
rollback;
