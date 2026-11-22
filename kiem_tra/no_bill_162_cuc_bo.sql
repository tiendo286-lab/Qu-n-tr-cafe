-- Bài thử CỤC BỘ cho supabase/162_no_bill_khop_danh_sach.sql (chặng 4, anh Tiến chốt 22/11/2026 "Báo đỏ và chặn"):
-- ô Nợ ở bước 1 so thêm Nợ bill của ca với tổng danh sách khách nợ hoá đơn của ca; lệch → chặn Xác nhận Fabi; "Lấy số máy Fabi" ô Nợ bị chặn
-- khi máy ghi ít hơn danh sách, máy ghi nhiều hơn thì bắt chọn người nợ phần chênh; gỡ bằng "Sai, sửa số" (Chủ duyệt).
-- Kèm: Tệp ca Fabi biết ca nào đã Xác nhận Fabi (cờ xn) để hết báo "Cần quản lý xem". Postgres cục bộ, REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/no_bill_162_cuc_bo.sql
do $$
declare chu public.accounts; rep text := ''; t text; s jsonb; e jsonb; q1 bigint; j jsonb; n bigint;
  A constant bigint := 996201;   -- như LHP Chiều 04/11: nhân viên ghi nợ 84.000 (có khách trong danh sách), máy Fabi ghi 0
  B constant bigint := 996202;   -- máy Fabi ghi nợ 150.000, danh sách 120.000
  C constant bigint := 996203;   -- bình thường: không nợ, máy 0
  D constant bigint := 996204;   -- như LHP Chiều 01/11 sau khi lỡ "lấy số máy": nợ trên phiếu 0, danh sách vẫn 28.000
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-11-04', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 584000, 300000, 200000, 84000, 1300000, 200000),
         (B, 1, '2026-11-05', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 620000, 300000, 200000, 120000, 1300000, 200000),
         (C, 1, '2026-11-06', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (D, 1, '2026-11-07', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 162', 1) on conflict do nothing;
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id, diff) values
    ('thu-162-A', 'Cửa hàng thử 162', 1, '2026-11-04', 'Chiều', 1000000, 500000, 300000, 200000, 0, A, '["no"]'),
    ('thu-162-B', 'Cửa hàng thử 162', 1, '2026-11-05', 'Chiều', 1000000, 650000, 300000, 200000, 150000, B, '["no"]'),
    ('thu-162-C', 'Cửa hàng thử 162', 1, '2026-11-06', 'Chiều', 1000000, 500000, 300000, 200000, 0, C, '["tm"]'),
    ('thu-162-D', 'Cửa hàng thử 162', 1, '2026-11-07', 'Chiều', 1000000, 500000, 300000, 200000, 0, D, '[]');
  insert into public.bank_accounts(id, branch_id, account_no, active) values (996201, 1, 'thu-162', 1);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select q.id, k.id, 0, case when k.id = 996201 then 200000 else 0 end from public.bank_accounts k, (values (A), (B), (C), (D)) q(id) where k.branch_id = 1 and k.active = 1;
  insert into public.debt_people(id, branch_id, name, grp, active) values (996201, 1, 'Khách thử 162', 'khach', 1), (996202, 1, 'Bàn thử 162', 'khach', 1);
  insert into public.shift_debts(id, branch_id, report_id, table_name, amount, kind, grp, person_id) values
    (996201, 1, A, 'Bàn thử 162', 84000, 'bill', 'khach', 996202),
    (996202, 1, B, 'Bàn thử 162', 120000, 'bill', 'khach', 996202),
    (996204, 1, D, 'Bàn thử 162', 28000, 'bill', 'khach', 996202);

  -- (1) ca A: máy ghi 0 < danh sách 84.000 → ô Nợ đỏ; "Lấy số máy Fabi" bị chặn, nợ trên phiếu giữ 84.000
  s := public.app__stc_ds_state(A);
  begin perform public.app_stc_ds_fabi(A, 'no', null, null); t := 'LẤY ĐƯỢC'; exception when others then t := sqlerrm; end;
  e := public.app__ca_eff(A);
  rep := rep || E'\n' || case when not (s ->> 'no')::boolean and (s ->> 'bill_list')::bigint = 84000 and t like '%ít hơn danh sách%' and (e ->> 'pos_debt')::bigint = 84000 then 'ĐẠT' else 'HỎNG' end
        || format(' (1) máy 0 < danh sách 84.000: ô nợ %s, danh sách %s · lấy số máy → %s · nợ phiếu %s', s ->> 'no', s ->> 'bill_list', t, e ->> 'pos_debt');

  -- (2) ca A: "Sai, sửa số" Nợ bill = 84.000 (Chủ gửi = duyệt ngay) → ô Nợ khớp
  q1 := public.app_stc_fix_request(A, 'no', jsonb_build_object('val', 84000), 'Khách bàn thử nợ thật, máy ghi đã trả');
  s := public.app__stc_ds_state(A);
  rep := rep || E'\n' || case when (s ->> 'no')::boolean then 'ĐẠT' else 'HỎNG' end || format(' (2) sửa số Nợ bill = danh sách (Chủ duyệt) → ô nợ %s', s ->> 'no');

  -- (3) ca D: nợ trên phiếu 0 = máy 0 nhưng danh sách 28.000 → trước đây xanh (giấu lệch), nay đỏ
  s := public.app__stc_ds_state(D);
  rep := rep || E'\n' || case when not (s ->> 'no')::boolean and (s ->> 'bill_list')::bigint = 28000 then 'ĐẠT' else 'HỎNG' end
        || format(' (3) nợ phiếu 0 = máy 0, danh sách 28.000 → ô nợ %s (danh sách %s)', s ->> 'no', s ->> 'bill_list');

  -- (4) ca B: máy 150.000 > danh sách 120.000 → lấy số máy phải chọn người nợ phần chênh; chọn rồi thì nợ phiếu = danh sách = 150.000
  begin perform public.app_stc_ds_fabi(B, 'no', null, null); t := 'LẤY ĐƯỢC'; exception when others then t := sqlerrm; end;
  perform public.app_stc_ds_fabi(B, 'no', 'Khách thử 162', null);
  s := public.app__stc_ds_state(B); e := public.app__ca_eff(B);
  rep := rep || E'\n' || case when t like '%chọn người nợ phần chênh%' and (e ->> 'pos_debt')::bigint = 150000 and (s ->> 'bill_list')::bigint = 150000 and (s ->> 'no')::boolean then 'ĐẠT' else 'HỎNG' end
        || format(' (4) máy 150.000 > danh sách 120.000: không chọn người → %s · chọn người → nợ phiếu %s, danh sách %s, ô nợ %s', t, e ->> 'pos_debt', s ->> 'bill_list', s ->> 'no');

  -- (5) ca C bình thường: không đổi
  s := public.app__stc_ds_state(C);
  rep := rep || E'\n' || case when (s ->> 'no')::boolean and (s ->> 'bill_list')::bigint = 0 then 'ĐẠT' else 'HỎNG' end || format(' (5) ca bình thường: ô nợ %s', s ->> 'no');

  -- (6) Tệp ca Fabi: ca đã Xác nhận Fabi (có kết quả tiền mặt + chuyển khoản) → xn = true; ca chưa → false
  insert into public.shift_report_results(report_id, item, result, amount) values (C, 'tien_mat', 'khop', 0), (C, 'chuyen_khoan', 'khop', 0);
  j := public.app_fabi_list('2026-11-04', '2026-11-07');
  rep := rep || E'\n' || case when (select (x ->> 'xn')::boolean from jsonb_array_elements(j -> 'files') x where x ->> 'ma_ca' = 'thu-162-C')
                                   and not (select (x ->> 'xn')::boolean from jsonb_array_elements(j -> 'files') x where x ->> 'ma_ca' = 'thu-162-A') then 'ĐẠT' else 'HỎNG' end
        || ' (6) Tệp ca Fabi: ca đã xác nhận có xn = true, ca chưa xác nhận xn = false';
  raise exception 'REPORT>> %', rep;
end $$;
