-- Bài thử CỤC BỘ cho supabase/153_sua_so_fabi.sql (bước 173 đợt C — máy Fabi ghi sai: quản lý gửi số đúng, Chủ duyệt / từ chối).
-- Chạy trên Postgres cục bộ đã có tệp 150–152. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/sua_so_fabi_153_cuc_bo.sql
do $$
declare chu public.accounts; ql public.accounts; nv public.accounts; rep text := ''; it text; t text; n int; q1 bigint; q2 bigint; q3 bigint; s jsonb; e jsonb; m0 bigint; m1 bigint; j jsonb;
  F constant bigint := 993001; G constant bigint := 993002;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  -- quản lý (không phải Chủ) đối soát được cơ sở 1
  select * into ql from public.accounts x where coalesce(x.system_role, '') <> 'chu' and x.auth_user_id is not null and coalesce(x.locked, 0) = 0
     and public.app__ca_auto_ok(x, 1) order by (x.system_role = 'ql') desc, x.id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- ca F: máy Fabi ghi doanh thu 500.000 (TM 300.000 + CK 200.000) nhưng thật là 520.000 (TM 320.000); nhân viên ghi 480.000 (TM 280.000)
  -- ca G: máy ghi tiền mở ca 1.000.000 nhưng thật là 950.000 (nhân viên ghi đúng 950.000); máy ghi nợ bill 0, thật 30.000 (nhân viên ghi 30.000)
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (F, 1, '2026-11-16', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 480000, 280000, 200000, 0, 1300000, 200000),
         (G, 1, '2026-11-17', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 950000, 950000, 530000, 300000, 200000, 30000, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 153', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (993001, 1, 'thu-153', 1);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id) values
    ('thu-153-F', 'Cửa hàng thử 153', 1, '2026-11-16', 'Tối', 1000000, 500000, 300000, 200000, 0, F),
    ('thu-153-G', 'Cửa hàng thử 153', 1, '2026-11-17', 'Tối', 1000000, 500000, 300000, 200000, 0, G);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select q.id, k.id, 0, case when k.id = 993001 then 200000 else 0 end from public.bank_accounts k, (values (F), (G)) q(id) where k.branch_id = 1 and k.active = 1;

  s := public.app__stc_ds_state(F);
  rep := rep || format(E'\n    ca F trước khi sửa: ô doanh thu %s', s ->> 'dt');

  -- (1) quản lý gửi sửa ô Doanh thu (TM 320.000, CK 200.000) → chờ Chủ duyệt; ô vẫn đỏ
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  q1 := public.app_stc_fix_request(F, 'dt', jsonb_build_object('tm', 320000, 'ck', 200000), 'Máy Fabi lỗi mất 1 hoá đơn 40.000');
  s := public.app__stc_ds_state(F);
  rep := rep || E'\n' || case when (select status from public.stc_fix_requests where id = q1) = 'cho' and not (s ->> 'dt')::boolean and s -> 'fix' -> 'dt' ->> 'status' = 'cho'
        then 'ĐẠT' else 'HỎNG' end || format(' (1) quản lý gửi sửa doanh thu: trạng thái %s · ô doanh thu %s', s -> 'fix' -> 'dt' ->> 'status', s ->> 'dt');

  -- (2) đang chờ → Xác nhận Fabi bị chặn, báo rõ
  begin perform public.app_stc_ds_close(F); t := 'XÁC NHẬN ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%chờ Chủ duyệt%' then 'ĐẠT' else 'HỎNG' end || ' (2) Xác nhận Fabi khi số sửa đang chờ: ' || t;

  -- (3) đang chờ thì không gửi thêm yêu cầu cho cùng ô
  begin perform public.app_stc_fix_request(F, 'dt', jsonb_build_object('tm', 1, 'ck', 1), 'x'); t := 'GỬI ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%đang chờ Chủ duyệt%' then 'ĐẠT' else 'HỎNG' end || ' (3) gửi lần hai khi đang chờ: ' || t;

  -- (4) quản lý không duyệt được
  begin perform public.app_stc_fix_decide(q1, true, null); t := 'DUYỆT ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Chỉ Chủ%' then 'ĐẠT' else 'HỎNG' end || ' (4) quản lý tự duyệt: ' || t;

  -- (5) quản lý Bỏ sửa → bo; gửi lại được
  perform public.app_stc_fix_cancel(q1);
  q2 := public.app_stc_fix_request(F, 'dt', jsonb_build_object('tm', 320000, 'ck', 200000), 'Máy Fabi lỗi mất 1 hoá đơn 40.000');
  rep := rep || E'\n' || case when (select status from public.stc_fix_requests where id = q1) = 'bo' and (select status from public.stc_fix_requests where id = q2) = 'cho'
        then 'ĐẠT' else 'HỎNG' end || ' (5) Bỏ sửa rồi gửi lại';

  -- (6) Chủ từ chối (có lý do) → Xác nhận Fabi vẫn bị chặn, báo "Chủ từ chối"
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_stc_fix_decide(q2, false, 'Xem lại camera');
  begin perform public.app_stc_ds_close(F); t := 'XÁC NHẬN ĐƯỢC'; exception when others then t := sqlerrm; end;
  s := public.app__stc_ds_state(F);
  rep := rep || E'\n' || case when (select status || '|' || decide_note from public.stc_fix_requests where id = q2) = 'tu_choi|Xem lại camera' and t like '%từ chối%' and s -> 'fix' -> 'dt' ->> 'status' = 'tu_choi'
        then 'ĐẠT' else 'HỎNG' end || ' (6) Chủ từ chối: ' || t;

  -- (7) quản lý sửa lại số → yêu cầu mới; Chủ duyệt → phiếu theo số đã duyệt, ô xanh, tiền của ca theo số mới
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  q3 := public.app_stc_fix_request(F, 'dt', jsonb_build_object('tm', 320000, 'ck', 200000), 'Đã xem camera: có hoá đơn 40.000');
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  m0 := (public.app__ca_money(F) ->> 'tm_left')::bigint;
  perform public.app_stc_fix_decide(q3, true, null);
  e := public.app__ca_eff(F); s := public.app__stc_ds_state(F); m1 := (public.app__ca_money(F) ->> 'tm_left')::bigint;
  rep := rep || E'\n' || case when (select status from public.stc_fix_requests where id = q3) = 'duyet' and (e ->> 'pos_cash')::bigint = 320000 and (e ->> 'pos_transfer')::bigint = 200000
        and (e ->> 'total_revenue')::bigint = 520000 and (s ->> 'dt')::boolean and m1 - m0 = -40000 and (s ->> 'fabi_rev')::bigint = 500000 then 'ĐẠT' else 'HỎNG' end
      || format(' (7) Chủ duyệt: phiếu TM %s · CK %s · doanh thu %s · ô doanh thu %s · TM dư %s → %s (phải có +40.000) · số máy vẫn %s', e ->> 'pos_cash', e ->> 'pos_transfer', e ->> 'total_revenue', s ->> 'dt', m0, m1, s ->> 'fabi_rev');

  -- (8) quản lý không bỏ được số Chủ đã duyệt
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_fix_cancel(q3); t := 'BỎ ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Chỉ Chủ%' then 'ĐẠT' else 'HỎNG' end || ' (8) quản lý bỏ số Chủ đã duyệt: ' || t;

  -- (9) Chủ tự gửi ô Tiền mở ca (ca G: 950.000) → duyệt ngay; ô tiền mở ca xanh theo số đã duyệt
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  q1 := public.app_stc_fix_request(G, 'mo', jsonb_build_object('val', 950000), 'Máy nhập nhầm tiền đầu ca');
  s := public.app__stc_ds_state(G);
  rep := rep || E'\n' || case when (select status from public.stc_fix_requests where id = q1) = 'duyet' and (s ->> 'mo1')::boolean then 'ĐẠT' else 'HỎNG' end
      || format(' (9) Chủ tự gửi sửa tiền mở ca → duyệt ngay · ô tiền mở ca %s', s ->> 'mo1');

  -- (10) ô Nợ bill (ca G: máy 0, thật 30.000) — quản lý gửi, Chủ duyệt → ô xanh, nợ bill trên phiếu 30.000
  perform set_config('request.jwt.claims', json_build_object('sub', ql.auth_user_id, 'role', 'authenticated')::text, true);
  q2 := public.app_stc_fix_request(G, 'no', jsonb_build_object('val', 30000), 'Máy không ghi nợ bàn 4');
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_stc_fix_decide(q2, true, null);
  s := public.app__stc_ds_state(G);
  rep := rep || E'\n' || case when (s ->> 'no')::boolean and (public.app__ca_eff(G) ->> 'pos_debt')::bigint = 30000 then 'ĐẠT' else 'HỎNG' end || ' (10) ô Nợ bill theo số đã duyệt: ' || (s ->> 'no');

  -- (11) mọi ô xanh nhờ số đã duyệt → Xác nhận Fabi không còn bị chặn vì số sửa (ca F)
  begin perform public.app_stc_ds_close(F); t := 'XÁC NHẬN ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t = 'XÁC NHẬN ĐƯỢC' or (t not like '%Chủ%' and t not like '%ô đỏ%') then 'ĐẠT' else 'HỎNG' end || ' (11) Xác nhận Fabi sau khi Chủ duyệt: ' || t;

  -- (12) đã Xác nhận Fabi thì không gửi sửa số nữa (phải Mở lại xác nhận trước)
  begin perform public.app_stc_fix_request(F, 'mo', jsonb_build_object('val', 1), 'x'); t := 'GỬI ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Mở lại%' then 'ĐẠT' else 'HỎNG' end || ' (12) gửi sửa sau Xác nhận Fabi: ' || t;

  -- (13) sổ tháng: ca có danh sách yêu cầu sửa số theo ô
  select c -> 'fixes' into j from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'cas') c where (c ->> 'id')::bigint = G;
  rep := rep || E'\n' || case when j -> 'mo' ->> 'status' = 'duyet' and j -> 'no' ->> 'status' = 'duyet' and (j -> 'no' -> 'new' ->> 'val')::bigint = 30000 and coalesce(j -> 'no' ->> 'by', '') <> ''
        then 'ĐẠT' else 'HỎNG' end || ' (13) sổ tháng › fixes: ' || coalesce(left(j::text, 200), 'không có');

  -- (14) Chủ bỏ số đã duyệt (ô Nợ bill ca G) → bo, ô về đỏ (số phiếu khác máy)
  perform public.app_stc_fix_cancel(q2);
  s := public.app__stc_ds_state(G);
  rep := rep || E'\n' || case when (select status from public.stc_fix_requests where id = q2) = 'bo' and not (s ->> 'no')::boolean then 'ĐẠT' else 'HỎNG' end || ' (14) Chủ bỏ số đã duyệt → ô nợ bill ' || (s ->> 'no');

  -- (15) nhân viên không gửi được
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_fix_request(G, 'dt', jsonb_build_object('tm', 1, 'ck', 1), 'x'); t := 'GỬI ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t <> 'GỬI ĐƯỢC' and t not like '%does not exist%' then 'ĐẠT' else 'HỎNG' end || ' (15) nhân viên gửi: ' || t;

  raise exception 'REPORT>> %', rep;
end $$;
