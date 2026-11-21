-- Bài thử CỤC BỘ cho supabase/156_fabi_trong_doanh_thu.sql (chặng 2, anh Tiến chốt 21/11): tệp Fabi có nhưng KHÔNG có số doanh thu
-- (net / tm / ck trống) → "Lấy số máy Fabi" ở ô Doanh thu bị chặn (trước đây ghi doanh thu của ca thành trống); quản lý ghi số theo phiếu máy in
-- bằng "Sai, sửa số", Chủ duyệt thì ô khớp. Ô Tiền mở ca: máy không có số đầu ca cũng chặn lấy số. Chạy trên Postgres cục bộ đã có tệp 150–155. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/fabi_trong_156_cuc_bo.sql
do $$
declare chu public.accounts; ql public.accounts; rep text := ''; t text; q1 bigint; s jsonb; e jsonb;
  F constant bigint := 995601; G constant bigint := 995602; H constant bigint := 995603;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into ql from public.accounts x where coalesce(x.system_role, '') <> 'chu' and x.auth_user_id is not null and coalesce(x.locked, 0) = 0
     and public.app__ca_auto_ok(x, 1) order by (x.system_role = 'ql') desc, x.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- ca F: như ca LHP chiều 04/11 — tệp Fabi có tiền đầu ca nhưng KHÔNG có doanh thu; nhân viên ghi 2.107.000 (TM 992.000 + CK 1.031.000 + nợ 84.000)
  -- ca G: tệp Fabi đủ số (để thử không đổi cách cũ) · ca H: tệp Fabi không có cả tiền đầu ca
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (F, 1, '2026-11-04', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 3334000, 3334000, 2107000, 992000, 1031000, 84000, 4210000, 1031000),
         (G, 1, '2026-11-05', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 520000, 320000, 200000, 0, 1300000, 200000),
         (H, 1, '2026-11-06', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 520000, 320000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 156', 1) on conflict do nothing;
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id) values
    ('thu-156-F', 'Cửa hàng thử 156', 1, '2026-11-04', 'Chiều', 3334000, null, null, null, 0, F),
    ('thu-156-G', 'Cửa hàng thử 156', 1, '2026-11-05', 'Chiều', 1000000, 500000, 300000, 200000, 0, G),
    ('thu-156-H', 'Cửa hàng thử 156', 1, '2026-11-06', 'Chiều', null, 500000, 300000, 200000, 0, H);
  insert into public.bank_accounts(id, branch_id, account_no, active) values (995601, 1, 'thu-156', 1);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select q.id, k.id, 0, case when k.id = 995601 then q.ck else 0 end from public.bank_accounts k, (values (F, 1031000), (G, 200000), (H, 200000)) q(id, ck) where k.branch_id = 1 and k.active = 1;

  -- (1) "Lấy số máy Fabi" ở ô Doanh thu khi máy không có số → bị chặn, báo rõ; doanh thu trên phiếu giữ nguyên
  begin perform public.app_stc_ds_fabi(F, 'dt', null, null); t := 'LẤY ĐƯỢC'; exception when others then t := sqlerrm; end;
  e := public.app__ca_eff(F);
  rep := rep || E'\n' || case when t like '%không có số doanh thu%' and (e ->> 'total_revenue')::bigint = 2107000 then 'ĐẠT' else 'HỎNG' end
        || format(' (1) Lấy số máy khi máy không có số doanh thu: %s · doanh thu phiếu %s', t, coalesce(e ->> 'total_revenue', 'TRỐNG'));

  -- (2) trước khi sửa: ô Doanh thu chưa khớp (chặn Xác nhận Fabi)
  s := public.app__stc_ds_state(F);
  rep := rep || E'\n' || case when not (s ->> 'dt')::boolean then 'ĐẠT' else 'HỎNG' end || format(' (2) ô doanh thu khi máy không có số: %s', s ->> 'dt');

  -- (3) quản lý gửi số theo phiếu máy in → chờ Chủ; Chủ duyệt → ô khớp, doanh thu = TM + CK + nợ
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  q1 := public.app_stc_fix_request(F, 'dt', jsonb_build_object('tm', 992000, 'ck', 1031000), 'Máy Fabi không có số, ghi theo phiếu máy in');
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_stc_fix_decide(q1, true, null);
  s := public.app__stc_ds_state(F); e := public.app__ca_eff(F);
  rep := rep || E'\n' || case when (s ->> 'dt')::boolean and (e ->> 'total_revenue')::bigint = 2107000 and (e ->> 'pos_cash')::bigint = 992000 and (e ->> 'pos_transfer')::bigint = 1031000
        then 'ĐẠT' else 'HỎNG' end || format(' (3) Chủ duyệt số theo phiếu máy in: ô doanh thu %s · doanh thu %s', s ->> 'dt', e ->> 'total_revenue');

  -- (4) ca F: ô Tiền mở ca vẫn lấy số máy được (máy có số đầu ca)
  begin perform public.app_stc_ds_fabi(F, 'mo', null, null); t := 'ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t = 'ĐƯỢC' then 'ĐẠT' else 'HỎNG' end || ' (4) ô tiền mở ca (máy có số) vẫn lấy số máy được: ' || t;

  -- (5) ca G (máy đủ số): Lấy số máy ở ô Doanh thu như cũ
  begin perform public.app_stc_ds_fabi(G, 'dt', null, null); t := 'ĐƯỢC'; exception when others then t := sqlerrm; end;
  e := public.app__ca_eff(G);
  rep := rep || E'\n' || case when t = 'ĐƯỢC' and (e ->> 'total_revenue')::bigint = 500000 then 'ĐẠT' else 'HỎNG' end || format(' (5) máy đủ số: lấy số doanh thu như cũ (%s, doanh thu %s)', t, e ->> 'total_revenue');

  -- (6) ca H: máy không có số tiền đầu ca → chặn lấy số ô Tiền mở ca, tiền mở ca trên phiếu giữ nguyên
  begin perform public.app_stc_ds_fabi(H, 'mo', null, null); t := 'LẤY ĐƯỢC'; exception when others then t := sqlerrm; end;
  e := public.app__ca_eff(H);
  rep := rep || E'\n' || case when t like '%không có số%' and (e ->> 'opening_cash')::bigint = 1000000 then 'ĐẠT' else 'HỎNG' end
        || format(' (6) máy không có tiền đầu ca: %s · tiền mở ca phiếu %s', t, coalesce(e ->> 'opening_cash', 'TRỐNG'));

  raise exception 'REPORT>> %', rep;
end $$;
