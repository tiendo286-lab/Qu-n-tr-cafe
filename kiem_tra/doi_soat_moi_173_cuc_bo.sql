-- Bài thử CỤC BỘ cho supabase/173_doi_soat_moi_sua_tu_do.sql (trang đối soát ca mới — đợt 2 + 3, anh Tiến giao 24/11/2026).
-- Luật mới (cờ app.ds_moi, chỉ các hàm app_ds2_* đặt): sửa tự do tới khi Hoàn thành; hàm cũ (không cờ) giữ luật cũ.
-- Ca giả 997301 (cơ sở 1, 26/11 ca Tối, có file Fabi + số ngân hàng), đăng nhập giả là Chủ của seed.sql. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> <pgv>/bin/python kiem_tra/may_chu_cuc_bo/chay.py kiem_tra/doi_soat_moi_173_cuc_bo.sql
-- Trong một khối DO mọi lệnh chung một giao dịch nên cờ do hàm app_ds2_* đặt còn tới cuối khối — bài thử tự xoá cờ trước khi thử hàm cũ
-- (trên web mỗi lệnh gọi là một giao dịch riêng nên cờ không sang lệnh khác).
do $$
declare chu public.accounts; rep text := ''; msg text; mk text; j jsonb; st text; n int; cat bigint;
  A constant bigint := 997301;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  rep := rep || E'\n' || case when not public.app__ds_moi() then 'ĐẠT' else 'HỎNG' end || ' (0) đầu giao dịch chưa có cờ luật mới';

  -- dựng ca: mở ca 1.000.000 · bán 500.000 = TM 300.000 + CK 200.000 · quản lý đếm két 1.300.000 · ngân hàng 200.000
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-11-26', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 173', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (997301, 1, 'thu-173', 1);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id)
  values ('thu-173-A', 'Cửa hàng thử 173', 1, '2026-11-26', 'Tối', 1000000, 500000, 300000, 200000, 0, A);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select A, k.id, 0, case when k.id = 997301 then 200000 else 0 end from public.bank_accounts k where k.branch_id = 1 and k.active = 1;
  -- web có thể vừa tự đối soát ca này: xoá dấu tự duyệt để bắt đầu từ "chưa xác nhận Fabi"
  perform set_config('app.ca_auto', '1', true);
  delete from public.shift_report_results where report_id = A;
  delete from public.shift_report_checks where report_id = A;
  update public.shift_reports set recon_status = 'chua', recon_by = null, recon_at = null where id = A;
  perform set_config('app.ca_auto', '', true);
  select id into cat from public.fin_categories where kind = 'chi' order by sort_order, id limit 1;

  -- (1) chưa xác nhận Fabi: hàm cũ không cho thêm khoản chi, bản mới cho
  begin perform public.app_stc_move_save(A, null, jsonb_build_object('kind', 'tien_mat', 'amount', -50000, 'note', 'Mua đá', 'category_id', cat), 'thử'); msg := 'không chặn';
  exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%chưa chốt tiền%' then 'ĐẠT' else 'HỎNG' end || ' (1a) chưa xác nhận, hàm cũ thêm khoản chi → ' || msg;
  begin mk := public.app_ds2_move_save(A, null, jsonb_build_object('kind', 'tien_mat', 'amount', -50000, 'note', 'Mua đá', 'category_id', cat), 'thử'); msg := 'thêm được';
  exception when others then msg := 'LỖI ' || sqlerrm; end;
  rep := rep || E'\n' || case when msg = 'thêm được' and public.app__ds_moi() then 'ĐẠT' else 'HỎNG' end || ' (1b) bản mới thêm khoản chi → ' || msg;
  perform set_config('app.ds_moi', '', true);

  -- (2) xác nhận Fabi bằng hàm cũ → ca "đã chốt tiền"
  begin perform public.app_stc_ds_close(A); msg := 'xác nhận được'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  rep := rep || E'\n' || case when coalesce((public.app__stc_ds_state(A) ->> 'done')::boolean, false) then 'ĐẠT' else 'HỎNG' end || ' (2) hàm cũ Xác nhận Fabi → ' || msg;

  -- (3) đã xác nhận: hàm cũ không cho sửa tiền mặt quản lý đếm; bản mới cho; xoá cờ thì hàm cũ lại chặn
  begin perform public.app_stc_ds_cash(A, 'ca', 1250000); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%đã chốt tiền%' then 'ĐẠT' else 'HỎNG' end || ' (3a) đã xác nhận, hàm cũ sửa tiền mặt đếm → ' || msg;
  begin perform public.app_ds2_ds_cash(A, 'ca', 1250000); msg := 'sửa được'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  rep := rep || E'\n' || case when msg = 'sửa được' and (select ql_counted from public.shift_reports where id = A) = 1250000 then 'ĐẠT' else 'HỎNG' end || ' (3b) bản mới sửa tiền mặt đếm → ' || msg;
  perform set_config('app.ds_moi', '', true);
  begin perform public.app_stc_ds_cash(A, 'ca', 1250000); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%đã chốt tiền%' then 'ĐẠT' else 'HỎNG' end || ' (3c) xoá cờ → hàm cũ vẫn chặn → ' || msg;
  begin perform public.app_stc_ds_fabi(A, 'dt', null, 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%đã chốt tiền%' then 'ĐẠT' else 'HỎNG' end || ' (3d) hàm cũ Lấy số máy khi đã xác nhận → ' || msg;

  -- (4) Hoàn thành mới thiếu ô tích → báo danh sách, KHÔNG lưu gì (không dấu duyệt phần việc, không tích, không Hoàn thành)
  begin j := public.app_ds2_finish(A, array['nhan_su', 'ban_giao', 'nhap_hang'], array[]::text[]); msg := 'không báo thiếu';
  exception when others then msg := sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  rep := rep || E'\n' || case when msg like 'Còn mục chưa kiểm tra:%' and msg like '%không sót khoản thu%'
      and not exists (select 1 from public.stc_ca_done where report_id = A) and not exists (select 1 from public.stc_ca_ticks where report_id = A)
      and not exists (select 1 from public.shift_report_checks where report_id = A and item = 'nhan_su') then 'ĐẠT' else 'HỎNG' end
    || ' (4) Hoàn thành thiếu ô tích → ' || left(msg, 200);

  -- (5) Hoàn thành mới đủ → ghi lại mục tiền theo số mới (lệch 0), duyệt phần việc, tích, Hoàn thành
  begin j := public.app_ds2_finish(A, array['nhan_su', 'ban_giao', 'nhap_hang'], array['anh', 'sot', 'that', 'goi']); msg := 'xong ' || coalesce(j::text, '');
  exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  select recon_status into st from public.shift_reports where id = A;
  rep := rep || E'\n' || case when msg like 'xong%' and exists (select 1 from public.stc_ca_done where report_id = A)
      and exists (select 1 from public.shift_report_results where report_id = A and item = 'tien_mat' and result = 'khop')
      and exists (select 1 from public.shift_report_checks where report_id = A and item = 'nhan_su') then 'ĐẠT' else 'HỎNG' end
    || ' (5) Hoàn thành đủ → ' || left(msg, 160) || ' · đối soát ' || st
    || ' · tiền mặt ' || coalesce((select result || ' ' || amount from public.shift_report_results where report_id = A and item = 'tien_mat'), '?');

  -- (6) đã Hoàn thành: bản mới cũng không cho sửa tiền
  begin perform public.app_ds2_ds_cash(A, 'ca', 1200000); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%hoàn thành đối soát%' then 'ĐẠT' else 'HỎNG' end || ' (6a) đã Hoàn thành, bản mới sửa tiền mặt → ' || msg;
  begin perform public.app_ds2_move_save(A, null, jsonb_build_object('kind', 'tien_mat', 'amount', -10000, 'note', 'Mua thêm', 'category_id', cat), 'thử'); msg := 'không chặn';
  exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%hoàn thành đối soát%' then 'ĐẠT' else 'HỎNG' end || ' (6b) đã Hoàn thành, bản mới thêm khoản chi → ' || msg;
  perform set_config('app.ds_moi', '', true);

  -- (7) Mở lại mới: bỏ Hoàn thành + mục tiền, giữ duyệt phần việc; sửa được ngay; Hoàn thành lại được
  begin perform public.app_ds2_reopen(A, null); msg := 'mở được'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  select recon_status into st from public.shift_reports where id = A;
  rep := rep || E'\n' || case when msg = 'mở được' and not exists (select 1 from public.stc_ca_done where report_id = A)
      and not exists (select 1 from public.shift_report_results where report_id = A and item in ('tien_mat', 'chuyen_khoan'))
      and exists (select 1 from public.shift_report_checks where report_id = A and item = 'nhan_su') then 'ĐẠT' else 'HỎNG' end
    || ' (7a) Mở lại → ' || msg || ' · đối soát ' || st;
  begin perform public.app_ds2_ds_cash(A, 'ca', 1250000); msg := 'sửa được'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  rep := rep || E'\n' || case when msg = 'sửa được' then 'ĐẠT' else 'HỎNG' end || ' (7b) sau Mở lại, bản mới sửa tiền mặt → ' || msg;
  begin j := public.app_ds2_finish(A, array['nhan_su', 'ban_giao', 'nhap_hang'], array['anh', 'sot', 'that', 'goi']); msg := 'xong';
  exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  rep := rep || E'\n' || case when msg = 'xong' and exists (select 1 from public.stc_ca_done where report_id = A) then 'ĐẠT' else 'HỎNG' end || ' (7c) Hoàn thành lại → ' || msg;

  -- (8) Duyệt phần việc riêng: mã lạ bị bỏ qua, phần đã duyệt không lỗi
  perform public.app_ds2_reopen(A, 'thử 8');
  begin perform public.app_ds2_work_ok(A, array['nhan_su', 'la']); msg := 'được'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  rep := rep || E'\n' || case when msg = 'được' then 'ĐẠT' else 'HỎNG' end || ' (8) Duyệt phần việc (đã duyệt + mã lạ) → ' || msg;

  -- (9) quyền giữ nguyên: nhân viên gọi bản mới bị chặn như hàm cũ
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from public.accounts where system_role = 'nv' and auth_user_id is not null order by id limit 1), 'role', 'authenticated')::text, true);
  begin perform public.app_ds2_ds_cash(A, 'ca', 1250000); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%Chỉ Chủ%' or msg like '%không được%' then 'ĐẠT' else 'HỎNG' end || ' (9a) nhân viên gọi app_ds2_ds_cash → ' || msg;
  begin j := public.app_ds2_finish(A, array['nhan_su'], array['anh']); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%Chỉ Chủ%' or msg like '%không được%' then 'ĐẠT' else 'HỎNG' end || ' (9b) nhân viên gọi app_ds2_finish → ' || msg;
  perform set_config('app.ds_moi', '', true);

  select count(*) into n from regexp_matches(rep, 'HỎNG', 'g');
  raise exception 'REPORT>> % %', case when n = 0 then 'ĐẠT hết' else n || ' HỎNG' end, rep;
end $$;
