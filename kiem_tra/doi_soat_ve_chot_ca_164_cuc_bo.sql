-- Bài thử CỤC BỘ cho supabase/164_doi_soat_ve_chot_ca.sql (đưa Đối soát Fabi về lại Chốt ca — anh Tiến duyệt thiết kế 22/11):
-- 2 hàm ĐỌC cho bảng tuần Chốt ca (ô hai dòng Việc · Tiền) và nút "Ca tiếp theo chưa xong". Không đổi luật.
-- Postgres cục bộ (seed: Chủ, Quản lý tổng, 2 Quản lý, NV…). REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql
do $$
declare chu public.accounts; ql public.accounts; nv public.accounts; rep text := ''; t jsonb; c jsonb; v jsonb; e text; ids bigint[];
  K constant bigint := 996401;   -- chưa có file Fabi → chờ kế toán
  R constant bigint := 996402;   -- Fabi lệch doanh thu, chưa xác nhận → ô đỏ
  X constant bigint := 996403;   -- khớp, chưa xác nhận; phần việc mới có Ai làm ca (ngày riêng: không có ca trước cùng ngày)
  T3 constant bigint := 996408;  -- ca Tối cùng ngày với K, R (chỉ để thử thứ tự Sáng → Chiều → Tối)
  H constant bigint := 996404;   -- đã Xác nhận Fabi, chưa bấm Hoàn thành
  O constant bigint := 996405;   -- đã bấm Hoàn thành phần tiền, chưa xong phần việc
  M1 constant bigint := 996406;  -- 30/11
  M2 constant bigint := 996407;  -- 01/12 (tuần bắc qua 2 tháng)
  row_of constant text := 'select x from jsonb_array_elements($1) x where (x ->> ''id'')::bigint = $2';
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into ql from public.accounts where system_role = 'ql' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null and coalesce(locked, 0) = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (K, 1, '2026-11-10', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (R, 1, '2026-11-10', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (X, 1, '2026-11-11', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (T3, 1, '2026-11-10', 'Tối', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (H, 1, '2026-11-12', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (O, 1, '2026-11-13', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (M1, 1, '2026-11-30', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (M2, 1, '2026-12-01', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 164', 1) on conflict do nothing;
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id, diff) values
    ('thu-164-R', 'Cửa hàng thử 164', 1, '2026-11-10', 'Chiều', 1000000, 450000, 250000, 200000, 0, R, '["net"]'),
    ('thu-164-X', 'Cửa hàng thử 164', 1, '2026-11-11', 'Chiều', 1000000, 500000, 300000, 200000, 0, X, '[]'),
    ('thu-164-H', 'Cửa hàng thử 164', 1, '2026-11-12', 'Chiều', 1000000, 500000, 300000, 200000, 0, H, '[]'),
    ('thu-164-O', 'Cửa hàng thử 164', 1, '2026-11-13', 'Chiều', 1000000, 500000, 300000, 200000, 0, O, '[]');
  insert into public.bank_accounts(id, branch_id, account_no, active) values (996401, 1, 'thu-164', 1);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select q.id, k.id, 0, case when k.id = 996401 then 200000 else 0 end from public.bank_accounts k, (values (R), (X), (H), (O)) q(id) where k.branch_id = 1 and k.active = 1;

  -- dựng trạng thái: X có Ai làm ca; H, O đã Xác nhận Fabi; O đã bấm Hoàn thành phần tiền
  perform public.app_ca_check(X, 'nhan_su', true);
  perform public.app_stc_ds_close(H);
  perform public.app_stc_ds_close(O);
  insert into public.stc_ca_done(report_id, by_account) values (O, chu.id) on conflict do nothing;

  t := public.app_ca_ds_tuan(1, '2026-11-09', '2026-11-15');
  -- (1) chờ kế toán
  execute row_of into v using t, K;
  rep := rep || E'\n' || case when v ->> 'tien' is not null and v -> 'tien' ->> 'st' = 'kt' and v ->> 'tab' = 'viec' and not (v -> 'viec' ->> 'xong')::boolean then 'ĐẠT' else 'HỎNG' end
        || format(' (1) chưa có file Fabi → tiền %s, tab %s', v -> 'tien' ->> 'st', v ->> 'tab');
  -- (2) ô đỏ
  execute row_of into v using t, R;
  rep := rep || E'\n' || case when v -> 'tien' ->> 'st' = 'red' then 'ĐẠT' else 'HỎNG' end || format(' (2) Fabi lệch doanh thu, chưa xác nhận → %s', v -> 'tien' ->> 'st');
  -- (3) chờ xác nhận + (6) phần việc thiếu Bàn giao / Nhập hàng
  execute row_of into v using t, X;
  rep := rep || E'\n' || case when v -> 'tien' ->> 'st' = 'xn' then 'ĐẠT' else 'HỎNG' end || format(' (3) khớp, chưa xác nhận → %s', v -> 'tien' ->> 'st');
  rep := rep || E'\n' || case when not (v -> 'viec' ->> 'xong')::boolean and (v -> 'viec' ->> 'thieu') ilike '%giao%' and (v -> 'viec' ->> 'thieu') not ilike '%nhân sự%' then 'ĐẠT' else 'HỎNG' end
        || format(' (6) có Ai làm ca, thiếu → %s', v -> 'viec' ->> 'thieu');
  -- (4) đã xác nhận, chưa Hoàn thành
  execute row_of into v using t, H;
  rep := rep || E'\n' || case when v -> 'tien' ->> 'st' = 'ht' and v ->> 'tab' = 'viec' then 'ĐẠT' else 'HỎNG' end || format(' (4) đã Xác nhận Fabi → %s, tab %s', v -> 'tien' ->> 'st', v ->> 'tab');
  -- (5) đã bấm Hoàn thành phần tiền
  execute row_of into v using t, O;
  rep := rep || E'\n' || case when v -> 'tien' ->> 'st' = 'ok' and v ->> 'recon' is distinct from 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end || format(' (5) có stc_ca_done → %s, recon %s', v -> 'tien' ->> 'st', v ->> 'recon');

  -- (10) ca tiếp theo: đúng thứ tự Sáng → Chiều → Tối, qua 2 ngày
  c := public.app_ca_ds_con(1);
  select array_agg((e1 ->> 'id')::bigint order by q.ord) into ids from jsonb_array_elements(c) with ordinality q(e1, ord) where (e1 ->> 'id')::bigint in (K, R, T3, X, H, O);
  rep := rep || E'\n' || case when ids = array[K, R, T3, X, H, O] then 'ĐẠT' else 'HỎNG' end || format(' (10) danh sách chưa xong theo thứ tự: %s', ids);

  -- (8) luật 17/11 giữ nguyên (anh Tiến chốt lại 22/11 chiều): chờ kế toán thì phần việc cũng chờ; danh sách chưa xong đánh dấu ca chờ kế toán
  begin perform public.app_ca_check(K, 'nhan_su', true); e := 'GHI ĐƯỢC'; exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e like 'Phiếu chờ kế toán%' and (select q ->> 'st' from jsonb_array_elements(c) q where (q ->> 'id')::bigint = K) = 'kt'
                                   and (select q ->> 'st' from jsonb_array_elements(c) q where (q ->> 'id')::bigint = H) = 'ht' then 'ĐẠT' else 'HỎNG' end
        || ' (8) chờ kế toán: ghi Ai làm ca bị chặn (luật 17/11) → ' || left(e, 60) || ' · danh sách chưa xong ghi st=kt';

  -- (7) ca đã bấm Hoàn thành phần tiền: xong 3 dấu phần việc là tự "Đã đối soát" (luật cũ) và rời danh sách chưa xong
  perform public.app_ca_check(O, 'nhan_su', true); perform public.app_ca_check(O, 'ban_giao', true); perform public.app_ca_check(O, 'nhap_hang', true);
  t := public.app_ca_ds_tuan(1, '2026-11-09', '2026-11-15'); execute row_of into v using t, O;
  c := public.app_ca_ds_con(1);
  rep := rep || E'\n' || case when v ->> 'recon' = 'hoan_thanh' and (v -> 'viec' ->> 'xong')::boolean and v ->> 'tab' = 'xong'
                                   and not exists (select 1 from jsonb_array_elements(c) q where (q ->> 'id')::bigint = O) then 'ĐẠT' else 'HỎNG' end
        || format(' (7) đủ 3 dấu phần việc sau Hoàn thành tiền → recon %s, việc %s, tab %s', v ->> 'recon', v -> 'viec' ->> 'xong', v ->> 'tab');

  -- (11) khoảng ngày bắc qua 2 tháng
  t := public.app_ca_ds_tuan(1, '2026-11-30', '2026-12-01');
  rep := rep || E'\n' || case when (select count(*) from jsonb_array_elements(t) q where (q ->> 'id')::bigint in (M1, M2)) = 2 then 'ĐẠT' else 'HỎNG' end
        || ' (11) tuần 30/11–01/12 có đủ ca của cả hai tháng';

  -- (9) quyền: quản lý không được giao cơ sở → []; được giao → có; nhân viên → []
  delete from public.pc_assign where job = 1 and branch_id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  t := public.app_ca_ds_tuan(1, '2026-11-09', '2026-11-15'); c := public.app_ca_ds_con(1);
  rep := rep || E'\n' || case when t = '[]'::jsonb and c = '[]'::jsonb then 'ĐẠT' else 'HỎNG' end || format(' (9a) quản lý không được giao → %s / %s dòng', jsonb_array_length(t), jsonb_array_length(c));
  insert into public.pc_assign(job, branch_id, accounts) values (1, 1, array[ql.id]);
  t := public.app_ca_ds_tuan(1, '2026-11-09', '2026-11-15');
  rep := rep || E'\n' || case when jsonb_array_length(t) >= 5 then 'ĐẠT' else 'HỎNG' end || format(' (9b) quản lý được giao (dòng Đối soát ca) → %s dòng', jsonb_array_length(t));
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin t := public.app_ca_ds_tuan(1, '2026-11-09', '2026-11-15'); e := jsonb_array_length(t)::text; exception when others then e := 'lỗi: ' || sqlerrm; end;
  rep := rep || E'\n' || case when e = '0' then 'ĐẠT' else 'HỎNG' end || ' (9c) nhân viên → ' || e || ' dòng';
  raise exception 'REPORT>> %', rep;
end $$;
