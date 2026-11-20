-- Bài thử CỤC BỘ cho supabase/150_doi_soat_6_buoc.sql (bước 171 đợt A) — chạy trên Postgres cục bộ (kiem_tra/may_chu_cuc_bo/), KHÔNG cần máy chủ thật.
-- Tự dựng 2 ca giả tối thiểu (cơ sở 1, ngày 2026-11-25), đăng nhập giả là Chủ / nhân viên của seed.sql. REPORT>> tự hoàn tác.
-- Mục đích: mọi đường làm ca thành "Đã đối soát" đều phải có dấu Hoàn thành (stc_ca_done); tích mục; Hoàn thành / Mở lại; khoá + bỏ tích.
--   <pgv>/bin/python kiem_tra/may_chu_cuc_bo/chay.py kiem_tra/doi_soat_6_buoc_150_cuc_bo.sql
-- Bài trên dữ liệu thật (tự hoàn tác): kiem_tra/doi_soat_6_buoc_150.sql.
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; it text; st text; miss text[]; j jsonb;
  A constant bigint := 990001; B constant bigint := 990002;
  procedure_note text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- ca A: nhân viên đã gửi phiếu, đủ mọi mục kiểm + đủ kết quả tiền (như ca đã Xác nhận Fabi và xong phần việc), CHƯA bấm Hoàn thành
  --   mở ca 1.000.000 · bán 500.000 = tiền mặt 300.000 + chuyển khoản 200.000 · quản lý đếm két 1.300.000 · ngân hàng nhận 200.000 → khớp hết
  --   cơ sở có dùng file Fabi + đã có file Fabi và số ngân hàng của ca (đúng đường "web tự đối soát" đang chạy thật)
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-11-25', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 150', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (990001, 1, 'thu-150', 1);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id)
  values ('thu-150-A', 'Cửa hàng thử 150', 1, '2026-11-25', 'Tối', 1000000, 500000, 300000, 200000, 0, A);
  insert into public.bank_account_balances(report_id, account_id, opening, closing) values (A, 990001, 0, 200000);
  j := public.app__ca_kt_state(A);
  rep := rep || E'\n    ca thử A: cần file Fabi=' || (j ->> 'need') || ' · đủ file=' || (j ->> 'ready') || ' · web tự duyệt: ' || coalesce((select string_agg(item, ',' order by item) from public.shift_report_checks where report_id = A), 'chưa mục nào');
  update public.shift_reports set recon_status = 'chua', recon_by = null, recon_at = null where id = A and recon_status = 'hoan_thanh';   -- nếu web vừa tự hoàn thành (bản chưa vá)
  perform set_config('app.ca_auto', '1', true);   -- lối riêng của web tự đối soát, để chèn thẳng phần còn lại qua các khoá
  foreach it in array public.app__ca_check_items() loop
    insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (A, it, chu.id, public.vn_now_text()) on conflict (report_id, item) do nothing;
  end loop;
  foreach it in array public.app__ca_money_items() loop
    insert into public.shift_report_results(report_id, item, result, amount, by_account, at) values (A, it, 'khop', 0, chu.id, public.vn_now_text()) on conflict (report_id, item) do nothing;
  end loop;
  perform set_config('app.ca_auto', '', true);

  -- (1) app__ca_auto_finish: chưa bấm Hoàn thành thì KHÔNG thành Đã đối soát
  perform public.app__ca_auto_finish(A, chu.id);
  select recon_status into st from public.shift_reports where id = A;
  rep := rep || E'\n' || case when st <> 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end || ' (1) app__ca_auto_finish khi chưa bấm Hoàn thành → đối soát ' || st;

  -- (2) nút "Hoàn thành" ở trang Đối soát ca (app_ca_recon_finish): chưa bấm Hoàn thành ở Sổ thu chi thì bị chặn, báo rõ phải làm ở đâu
  begin
    perform public.app_ca_recon_finish(A);
    select recon_status into st from public.shift_reports where id = A;
    rep := rep || E'\nHỎNG (2) app_ca_recon_finish vẫn hoàn thành được khi chưa bấm Hoàn thành đối soát ca → đối soát ' || st;
    update public.shift_reports set recon_status = 'chua', recon_by = null, recon_at = null where id = A;
  exception when others then
    rep := rep || E'\n' || case when sqlerrm like '%Sổ thu chi%' then 'ĐẠT' else 'HỎNG' end || ' (2) app_ca_recon_finish: ' || sqlerrm;
  end;

  -- (3) web tự hoàn thành (app__ca_auto_green): chưa bấm Hoàn thành thì không tự thành Đã đối soát
  begin
    st := public.app__ca_auto_green(A);
    rep := rep || E'\n' || case when (select recon_status from public.shift_reports where id = A) <> 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end
      || ' (3) app__ca_auto_green trả "' || st || '" → đối soát ' || (select recon_status from public.shift_reports where id = A);
    update public.shift_reports set recon_status = 'chua', recon_by = null, recon_at = null where id = A and recon_status = 'hoan_thanh';
  exception when others then rep := rep || E'\n    (3) app__ca_auto_green lỗi: ' || sqlerrm;
  end;

  -- (4) tích mục: mã lạ bị chặn, tích 2 lần không lỗi, bỏ tích
  begin perform public.app_stc_tick(A, 'la', true); rep := rep || E'\nHỎNG (4) tích được mã lạ';
  exception when others then rep := rep || E'\nĐẠT (4) mã lạ: ' || sqlerrm; end;
  perform public.app_stc_tick(A, 'anh', true); perform public.app_stc_tick(A, 'anh', true); perform public.app_stc_tick(A, 'sot', true); perform public.app_stc_tick(A, 'sot', false);
  rep := rep || E'\n' || case when (select array_agg(item order by item) from public.stc_ca_ticks where report_id = A) = array['anh'] then 'ĐẠT' else 'HỎNG' end
    || ' (4b) tích 2 lần + bỏ tích → còn: ' || coalesce((select string_agg(item, ',' order by item) from public.stc_ca_ticks where report_id = A), '');

  -- (5) Hoàn thành khi còn thiếu mục → lỗi liệt kê; đủ mục → ghi dấu + ca thành Đã đối soát
  begin perform public.app_stc_ds_done(A); rep := rep || E'\nHỎNG (5) Hoàn thành được khi còn thiếu mục';
  exception when others then rep := rep || E'\n' || case when sqlerrm like 'Còn mục chưa kiểm tra:%' and sqlerrm like '%không sót khoản thu%' and sqlerrm like '%két để lại%' then 'ĐẠT' else 'HỎNG' end || ' (5) ' || left(sqlerrm, 260); end;
  foreach it in array array['goi', 'sot'] loop perform public.app_stc_tick(A, it, true); end loop;
  miss := public.app__stc_ds_missing(A);
  rep := rep || E'\n' || case when cardinality(miss) = 0 then 'ĐẠT' else 'HỎNG' end || ' (5b) tích đủ (ảnh, gối đầu, không sót) → còn thiếu: ' || coalesce(nullif(array_to_string(miss, ' · '), ''), 'không');
  begin
    perform public.app_stc_ds_done(A);
    select recon_status into st from public.shift_reports where id = A;
    rep := rep || E'\n' || case when st = 'hoan_thanh' and exists (select 1 from public.stc_ca_done where report_id = A and by_account = chu.id) then 'ĐẠT' else 'HỎNG' end || ' (5c) Hoàn thành → có dấu, đối soát ' || st;
  exception when others then rep := rep || E'\nHỎNG (5c) Hoàn thành lỗi: ' || sqlerrm; end;

  -- (6) đã Hoàn thành: không tích được, không đổi được tiền mặt đếm; sổ tháng trả ticks + done
  begin perform public.app_stc_tick(A, 'hd', true); rep := rep || E'\nHỎNG (6) vẫn tích được khi đã Hoàn thành';
  exception when others then rep := rep || E'\n' || case when sqlerrm like '%Mở lại trước%' then 'ĐẠT' else 'HỎNG' end || ' (6) tích khi đã Hoàn thành: ' || sqlerrm; end;
  begin update public.shift_reports set ql_counted = 900000 where id = A; rep := rep || E'\nHỎNG (6b) đổi được tiền mặt đếm khi đã Hoàn thành';
  exception when others then rep := rep || E'\n' || case when sqlerrm like '%Mở lại trước%' then 'ĐẠT' else 'HỎNG' end || ' (6b) đổi tiền mặt đếm khi đã Hoàn thành: ' || sqlerrm; end;
  select c into j from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'cas') c where (c ->> 'id')::bigint = A;
  rep := rep || E'\n' || case when j -> 'ticks' = '["anh", "goi", "sot"]'::jsonb and j -> 'done' ->> 'at' is not null and (j ->> 'recon_money_done')::boolean then 'ĐẠT' else 'HỎNG' end
    || ' (6c) sổ tháng: ticks ' || coalesce((j -> 'ticks')::text, 'thiếu') || ' · done ' || coalesce((j -> 'done')::text, 'thiếu');

  -- (7) Mở lại: mất dấu, ca về chưa đối soát xong, giữ mục đã tích; đổi tiền mặt đếm → bỏ tích gối đầu, giữ ảnh + không sót
  perform public.app_stc_ds_undone(A);
  select recon_status into st from public.shift_reports where id = A;
  rep := rep || E'\n' || case when st = 'mo_lai' and not exists (select 1 from public.stc_ca_done where report_id = A)
      and (select count(*) from public.stc_ca_ticks where report_id = A) = 3 then 'ĐẠT' else 'HỎNG' end || ' (7) Mở lại → đối soát ' || st || ', mất dấu, giữ 3 mục đã tích';
  update public.shift_reports set ql_counted = 950000 where id = A;
  rep := rep || E'\n' || case when (select array_agg(item order by item) from public.stc_ca_ticks where report_id = A) = array['anh', 'sot'] then 'ĐẠT' else 'HỎNG' end
    || ' (7b) đổi tiền mặt đếm → còn tích: ' || coalesce((select string_agg(item, ',' order by item) from public.stc_ca_ticks where report_id = A), '');

  -- (8) có dấu Hoàn thành thì các đường cũ hoàn thành được (ca xong phần việc sau khi đã bấm Hoàn thành)
  insert into public.stc_ca_done(report_id, by_account) values (A, chu.id);
  perform public.app__ca_auto_finish(A, chu.id);
  select recon_status into st from public.shift_reports where id = A;
  rep := rep || E'\n' || case when st = 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end || ' (8) đã có dấu → app__ca_auto_finish hoàn thành: ' || st;

  -- (12) file Fabi: cập nhật không đổi số (số cốc, ghi lại đúng số cũ) thì giữ nguyên; đổi số / hoá đơn sửa → bỏ tích ảnh + bỏ dấu Hoàn thành
  update public.fabi_shifts set cups = 7 where ma_ca = 'thu-150-A';
  update public.fabi_shifts set net = net, tm = tm, sua = sua where ma_ca = 'thu-150-A';
  rep := rep || E'\n' || case when exists (select 1 from public.stc_ca_done where report_id = A) and exists (select 1 from public.stc_ca_ticks where report_id = A and item = 'anh') then 'ĐẠT' else 'HỎNG' end
    || ' (12) file Fabi cập nhật không đổi số → giữ dấu Hoàn thành + mục ảnh';
  update public.fabi_shifts set sua = '[{"hd": "thử"}]'::jsonb where ma_ca = 'thu-150-A';
  rep := rep || E'\n' || case when not exists (select 1 from public.stc_ca_done where report_id = A) and not exists (select 1 from public.stc_ca_ticks where report_id = A and item = 'anh')
      and exists (select 1 from public.stc_ca_ticks where report_id = A and item = 'sot') then 'ĐẠT' else 'HỎNG' end
    || ' (12b) file Fabi đổi danh sách hoá đơn sửa → bỏ dấu Hoàn thành + bỏ tích ảnh, giữ mục khác: ' || coalesce((select string_agg(item, ',' order by item) from public.stc_ca_ticks where report_id = A), '');
  select c into j from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'cas') c where (c ->> 'id')::bigint = A;
  miss := public.app__stc_ds_missing(A);
  rep := rep || E'\n' || case when (j -> 'fabi' ->> 'edited_bills')::int = 1 and array_to_string(miss, '|') like '%hoá đơn bị sửa%' then 'ĐẠT' else 'HỎNG' end
    || ' (12c) ca có hoá đơn sửa → phải tích mục hoá đơn: ' || array_to_string(miss, ' · ');

  -- (13) kết quả Chuyển khoản bị gỡ (mọi kiểu mở lại) → dấu Hoàn thành tự mất; sổ tháng không trả done khi ca chưa xác nhận Fabi
  insert into public.stc_ca_done(report_id, by_account) values (A, chu.id);
  perform set_config('app.ca_auto', '1', true);
  delete from public.shift_report_results where report_id = A and item = 'chuyen_khoan';
  select c into j from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'cas') c where (c ->> 'id')::bigint = A;
  rep := rep || E'\n' || case when not exists (select 1 from public.stc_ca_done where report_id = A) and not (j ->> 'recon_money_done')::boolean and jsonb_typeof(j -> 'done') = 'null' then 'ĐẠT' else 'HỎNG' end
    || ' (13) gỡ kết quả Chuyển khoản → mất dấu Hoàn thành; sổ tháng: đã xác nhận=' || (j ->> 'recon_money_done') || ' done=' || coalesce((j -> 'done')::text, 'thiếu');
  insert into public.shift_report_results(report_id, item, result, amount, by_account, at) values (A, 'chuyen_khoan', 'khop', 0, chu.id, public.vn_now_text());
  perform set_config('app.ca_auto', '', true);

  -- (9) Mở lại xác nhận Fabi bỏ luôn dấu Hoàn thành
  insert into public.stc_ca_done(report_id, by_account) values (A, chu.id) on conflict do nothing;
  begin
    perform public.app_stc_ds_reopen(A, null);
    rep := rep || E'\n' || case when not exists (select 1 from public.stc_ca_done where report_id = A) then 'ĐẠT' else 'HỎNG' end || ' (9) Mở lại xác nhận Fabi → bỏ dấu Hoàn thành';
  exception when others then rep := rep || E'\nHỎNG (9) Mở lại xác nhận Fabi lỗi: ' || sqlerrm; end;

  -- (10) ca B chưa có kết quả tiền (chưa Xác nhận Fabi): không Hoàn thành được
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status) values (B, 1, '2026-11-26', 'Sáng', 'hoan_thanh', 'chua');
  begin perform public.app_stc_ds_done(B); rep := rep || E'\nHỎNG (10) Hoàn thành được ca chưa Xác nhận Fabi';
  exception when others then rep := rep || E'\n' || case when sqlerrm like '%Chưa Xác nhận Fabi%' then 'ĐẠT' else 'HỎNG' end || ' (10) ' || sqlerrm; end;

  -- (11) nhân viên không tích, không Hoàn thành, không Mở lại được
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_tick(A, 'anh', false); rep := rep || E'\nHỎNG (11) nhân viên bỏ tích được';
  exception when others then rep := rep || E'\nĐẠT (11) nhân viên tích: ' || sqlerrm; end;
  begin perform public.app_stc_ds_done(A); rep := rep || E'\nHỎNG (11b) nhân viên Hoàn thành được';
  exception when others then rep := rep || E'\nĐẠT (11b) nhân viên Hoàn thành: ' || sqlerrm; end;
  begin perform public.app_stc_ds_undone(A); rep := rep || E'\nHỎNG (11c) nhân viên Mở lại được';
  exception when others then rep := rep || E'\nĐẠT (11c) nhân viên Mở lại: ' || sqlerrm; end;

  raise exception 'REPORT>> %', rep;
end $$;
