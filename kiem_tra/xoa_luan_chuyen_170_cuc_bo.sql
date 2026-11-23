-- Bài thử cho supabase/170_xoa_luan_chuyen_trong_ca.sql (anh Tiến chốt 23/11/2026):
-- Xoá phiếu "Luân chuyển TM – CK" của ca đã xác nhận Fabi — xoá cả 2 vế, bắt lý do, ghi lịch sử. Dựng lại đúng chuyện ĐK ca Tối 03/11:
-- quản lý thêm TRÙNG 2 phiếu luân chuyển giống hệt nhau, xoá 1 phiếu thì phiếu còn lại phải nguyên vẹn.
-- Dữ liệu giả (ca 996xxx), REPORT>> tự hoàn tác. CHỈ chạy trên Postgres cục bộ (máy chủ thật không cho tắt chốt chặn "chờ kế toán" khi dựng ca giả;
-- 23/11 đã thử trên máy chủ thật bằng chính ca Tối 03/11 ĐK, tự hoàn tác: 6/6 đạt, lệch TM −80.000 / CK +80.000 → 0 / 0).
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/xoa_luan_chuyen_170_cuc_bo.sql
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; m0 jsonb; m1 jsonb; m2 jsonb; d jsonb; mk text; mk2 text; mkda text; msg text; n int; n2 int; cat bigint; i int;
  A constant bigint := 996001;   -- ca đã xác nhận Fabi
  B constant bigint := 996002;   -- ca chưa xác nhận Fabi, nhân viên tự ghi 1 phiếu luân chuyển
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-10-09', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 2000000, 1000000, 1000000, 0, 1960000, 1000000),
         (B, 1, '2026-10-09', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1960000, 1960000, 0, 0, 0, 0, 1960000, 0);
  insert into public.shift_report_moves(id, report_id, kind, amount, note, sort_order) values (996001, A, 'tien_mat', -40000, 'Mua đá', 1);
  perform set_config('session_replication_role', 'replica', true);   -- ca giả không có file Fabi / số ngân hàng: tạm tắt chốt chặn "chờ kế toán" khi dựng
  insert into public.shift_report_results(report_id, item, result, amount) select A, it, 'khop', 0 from unnest(public.app__ca_money_items()) it;
  perform set_config('session_replication_role', 'origin', true);
  select m.mkey into mkda from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = A and m.amount = -40000;
  select id into cat from public.fin_categories where kind = 'chi' order by sort_order, id limit 1;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, checked) values (A, mkda, cat, 0, 1);
  m0 := public.app__ca_money(A);

  -- dựng: quản lý thêm 2 phiếu luân chuyển giống hệt nhau (như bấm "+ Thêm phiếu › Luân chuyển" 2 lần)
  for i in 1..2 loop
    mk := public.app_stc_move_save(A, null, jsonb_build_object('kind', 'chuyen_khoan', 'amount', -80000, 'note', 'khách ck rút tm'), 'khách ck rút tm');
    perform public.app_stc_move_exchange(A, mk, 'khách ck rút tm');
    if i = 1 then m1 := public.app__ca_money(A); end if;
  end loop;
  select data into d from public.shift_report_recon where report_id = A;
  rep := rep || E'\n' || case when jsonb_array_length(d -> 'moves') = 5 then 'ĐẠT' else 'HỎNG' end || format(' (0) dựng xong: %s dòng (1 chi + 2 phiếu luân chuyển × 2 vế)', jsonb_array_length(d -> 'moves'));
  select m.mkey into mk from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = A and m.auto = 'doi_tien' and m.pay = 'chuyen_khoan' order by m.ord limit 1;

  -- (1) thiếu lý do → chặn
  begin perform public.app_stc_move_exchange_delete(A, mk, ''); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%lý do%' then 'ĐẠT' else 'HỎNG' end || ' (1) không ghi lý do → ' || msg;

  -- (2) khoản chi thường → không xoá bằng đường này
  begin perform public.app_stc_move_exchange_delete(A, mkda, 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%không phải phiếu Luân chuyển%' then 'ĐẠT' else 'HỎNG' end || ' (2) khoản chi thường → ' || msg;

  -- (3) xoá 1 phiếu (bấm vào vế chuyển khoản): mất đúng 2 vế cùng mã, phiếu kia + khoản chi còn nguyên
  perform public.app_stc_move_exchange_delete(A, mk, 'Thêm trùng 2 lần');
  select data into d from public.shift_report_recon where report_id = A;
  select count(*), count(distinct v ->> 'exchange_key') into n, n2 from jsonb_array_elements(d -> 'moves') v where nullif(v ->> 'exchange_key', '') is not null;
  rep := rep || E'\n' || case when jsonb_array_length(d -> 'moves') = 3 and n = 2 and n2 = 1 then 'ĐẠT' else 'HỎNG' end
        || format(' (3) còn %s dòng, trong đó %s vế luân chuyển của %s phiếu: %s', jsonb_array_length(d -> 'moves'), n, n2, d -> 'moves');

  -- (4) tiền: về đúng như lúc mới có 1 phiếu
  m2 := public.app__ca_money(A);
  rep := rep || E'\n' || case when m2 ->> 'tm_left' = m1 ->> 'tm_left' and m2 ->> 'ck_left' = m1 ->> 'ck_left' then 'ĐẠT' else 'HỎNG' end
        || format(' (4) lệch TM %s (1 phiếu: %s) · lệch CK %s (1 phiếu: %s)', m2 ->> 'tm_left', m1 ->> 'tm_left', m2 ->> 'ck_left', m1 ->> 'ck_left');

  -- (5) nhóm chi phí: phiếu còn lại 2 vế "Không tính" + đã đối soát; khoản chi giữ nhóm; không còn dòng mồ côi
  select count(*) into n from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
   where m.report_id = A and m.auto = 'doi_tien' and fc.excluded = 1 and fc.checked = 1 and fc.category_id is null;
  select count(*) into n2 from public.fin_move_cats fc where fc.report_id = A
     and not exists (select 1 from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = A and m.mkey = fc.mkey);
  rep := rep || E'\n' || case when n = 2 and n2 = 0 and exists (select 1 from public.fin_move_cats fc where fc.report_id = A and fc.mkey = mkda and fc.category_id = cat) then 'ĐẠT' else 'HỎNG' end
        || format(' (5) 2 vế còn lại "Không tính": %s · dòng nhóm mồ côi: %s · khoản chi giữ nhóm', n, n2);

  -- (6) lịch sử: Sổ thu chi 2 dòng xoá (2 vế), bản đối soát 1 dòng; mở phiếu ca không lỗi
  select count(*) into n from public.stc_edits e where e.kind = 'move' and e.action = 'xoa' and e.ref like 'm:' || A || ':%' and e.old ->> 'col' = 'lc';
  begin perform public.app_ca_get(A); msg := 'mở được'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when n = 2 and msg = 'mở được' and exists (select 1 from public.shift_recon_log l where l.report_id = A and l.action = 'xoa' and l.reason like '%xoá Luân chuyển%' and jsonb_array_length(l.before) = 2)
        then 'ĐẠT' else 'HỎNG' end || format(' (6) lịch sử Sổ thu chi %s dòng xoá · phiếu ca: %s', n, msg);

  -- (7) xoá nốt phiếu còn lại, lần này bấm vào vế tiền mặt → tiền về như lúc chưa có phiếu nào
  select m.mkey into mk2 from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = A and m.auto = 'doi_tien' and m.pay = 'tien_mat';
  perform public.app_stc_move_exchange_delete(A, mk2, 'Xoá nốt');
  select data into d from public.shift_report_recon where report_id = A; m2 := public.app__ca_money(A);
  rep := rep || E'\n' || case when jsonb_array_length(d -> 'moves') = 1 and m2 ->> 'tm_left' = m0 ->> 'tm_left' and m2 ->> 'ck_left' = m0 ->> 'ck_left' then 'ĐẠT' else 'HỎNG' end
        || format(' (7) xoá nốt: còn %s dòng · lệch TM %s (ban đầu %s) · lệch CK %s (ban đầu %s)', jsonb_array_length(d -> 'moves'), m2 ->> 'tm_left', m0 ->> 'tm_left', m2 ->> 'ck_left', m0 ->> 'ck_left');

  -- (8) phiếu vừa xoá → gọi lại bị chặn
  begin perform public.app_stc_move_exchange_delete(A, mk2, 'lần 2'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg <> 'không chặn' then 'ĐẠT' else 'HỎNG' end || ' (8) xoá lại phiếu đã xoá → ' || msg;

  -- (9) ca đã Hoàn thành đối soát → chặn; ca chưa xác nhận Fabi → chặn
  mk := public.app_stc_move_save(A, null, jsonb_build_object('kind', 'chuyen_khoan', 'amount', -80000, 'note', 'khách ck rút tm'), 'thêm lại');
  perform public.app_stc_move_exchange(A, mk, 'thêm lại');
  insert into public.stc_ca_done(report_id, by_account, at) values (A, chu.id, public.vn_now_text());
  begin perform public.app_stc_move_exchange_delete(A, mk, 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%hoàn thành đối soát%' then 'ĐẠT' else 'HỎNG' end || ' (9a) ca đã Hoàn thành → ' || msg;
  delete from public.stc_ca_done where report_id = A;
  begin perform public.app_stc_move_exchange_delete(B, 'x#1', 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%xác nhận Fabi%' then 'ĐẠT' else 'HỎNG' end || ' (9b) ca chưa xác nhận Fabi → ' || msg;

  -- (10) nhân viên ca không xoá được
  select * into nv from public.accounts a where a.auth_user_id is not null and a.system_role = 'nv' order by a.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_move_exchange_delete(A, mk, 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg <> 'không chặn' then 'ĐẠT' else 'HỎNG' end || ' (10) nhân viên ca gọi → ' || msg;
  raise exception 'REPORT>> %', rep;
end $$;
