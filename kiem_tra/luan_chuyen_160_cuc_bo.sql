-- Bài thử CỤC BỘ cho supabase/160_doi_luan_chuyen_trong_ca.sql (chặng 3, anh Tiến chốt 22/11/2026):
-- "Đổi thành Luân chuyển TM – CK" cho một khoản thu / chi của ca đã xác nhận Fabi (vd LHP ca Sáng 09/11: khách chuyển khoản 500.000 để rút
-- tiền mặt, phiếu ghi thành chi tiền mặt → chuyển khoản dư 500.000). Giữ vế cũ, thêm vế ngược lại ở hình thức kia, cùng số tiền; hai vế
-- "Không tính" chi phí. Chạy trên Postgres cục bộ. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/luan_chuyen_160_cuc_bo.sql
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; m0 jsonb; m1 jsonb; d jsonb; k text; mk text; msg text; n int; cat bigint; chi0 bigint; chi1 bigint;
  A constant bigint := 996001;   -- ca đã xác nhận Fabi, có khoản chi tiền mặt 500.000 "khách CK rút tiền mặt"
  B constant bigint := 996002;   -- ca chưa xác nhận Fabi
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-10-09', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 2000000, 1000000, 1000000, 0, 1500000, 1500000),
         (B, 1, '2026-10-09', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1500000, 1500000, 0, 0, 0, 0, 1500000, 0);
  insert into public.shift_report_moves(id, report_id, kind, amount, note, sort_order) values
    (996001, A, 'tien_mat', -500000, 'Khách CK rút tiền mặt', 1), (996002, A, 'tien_mat', -40000, 'Mua đá', 2), (996003, B, 'tien_mat', -30000, 'Mua chanh', 1);
  insert into public.shift_report_results(report_id, item, result, amount) select A, it, 'khop', 0 from unnest(public.app__ca_money_items()) it;
  select m.mkey into mk from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = A and m.amount = -500000;
  select id into cat from public.fin_categories where kind = 'chi' order by sort_order, id limit 1;
  insert into public.fin_move_cats(report_id, mkey, category_id, excluded, checked) values (A, mk, cat, 0, 1);   -- trước đây đã chọn nhóm như một khoản chi
  m0 := public.app__ca_money(A);
  chi0 := (public.app__fin_full(1, '2026-10') -> 'totals' ->> 'chi')::bigint;

  -- (1) thiếu lý do → chặn (giống mọi chỗ sửa ở Sổ thu chi)
  begin perform public.app_stc_move_exchange(A, mk, ''); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%lý do%' then 'ĐẠT' else 'HỎNG' end || ' (1) không ghi lý do → ' || msg;

  -- (2) đổi: giữ vế tiền mặt −500.000, thêm vế chuyển khoản +500.000, cùng mã luân chuyển, cùng nội dung
  k := public.app_stc_move_exchange(A, mk, 'Khách chuyển khoản để rút tiền mặt');
  select data into d from public.shift_report_recon where report_id = A;
  select count(*) into n from jsonb_array_elements(d -> 'moves') v where v ->> 'exchange_key' = k
     and ((v ->> 'kind' = 'tien_mat' and (v ->> 'amount')::bigint = -500000) or (v ->> 'kind' = 'chuyen_khoan' and (v ->> 'amount')::bigint = 500000))
     and v ->> 'note' = 'Khách CK rút tiền mặt';
  rep := rep || E'\n' || case when n = 2 and jsonb_array_length(d -> 'moves') = 3 then 'ĐẠT' else 'HỎNG' end
        || format(' (2) bản đối soát có 2 vế luân chuyển (mã %s), tổng %s dòng: %s', k, jsonb_array_length(d -> 'moves'), d -> 'moves');

  -- (3) tiền: tiền mặt giữ nguyên, chuyển khoản "phải có" thêm 500.000 (dư 500.000 → hết dư)
  m1 := public.app__ca_money(A);
  rep := rep || E'\n' || case when (m1 ->> 'tm_left')::bigint = (m0 ->> 'tm_left')::bigint and (m1 ->> 'ck_left')::bigint = (m0 ->> 'ck_left')::bigint - 500000 then 'ĐẠT' else 'HỎNG' end
        || format(' (3) lệch TM %s → %s · lệch CK %s → %s', m0 ->> 'tm_left', m1 ->> 'tm_left', m0 ->> 'ck_left', m1 ->> 'ck_left');

  -- (4) hai vế là luân chuyển, "Không tính", đã đối soát → không vào chi phí, không chặn Chốt tháng
  select count(*) into n from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
   where m.report_id = A and m.auto = 'doi_tien' and fc.excluded = 1 and fc.checked = 1 and fc.category_id is null;
  chi1 := (public.app__fin_full(1, '2026-10') -> 'totals' ->> 'chi')::bigint;
  rep := rep || E'\n' || case when n = 2 and chi1 = chi0 - 500000 then 'ĐẠT' else 'HỎNG' end
        || format(' (4) 2 vế "Không tính" + đã đối soát: %s · chi phí tháng %s → %s', n, chi0, chi1);

  -- (5) đổi lại lần nữa / đổi khoản tự động → chặn
  begin perform public.app_stc_move_exchange(A, mk, 'lần 2'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg <> 'không chặn' then 'ĐẠT' else 'HỎNG' end || ' (5) đổi lại khoản đã là luân chuyển → ' || msg;

  -- (6) ca chưa xác nhận Fabi → chặn
  select m.mkey into mk from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = B;
  begin perform public.app_stc_move_exchange(B, mk, 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%xác nhận Fabi%' then 'ĐẠT' else 'HỎNG' end || ' (6) ca chưa xác nhận Fabi → ' || msg;

  -- (7) có ghi lịch sử sửa (Sổ thu chi + bản đối soát)
  rep := rep || E'\n' || case when exists (select 1 from public.stc_edits e where e.kind = 'move' and e.action = 'luan_chuyen' and e.ref like 'm:' || A || ':%')
                                   and exists (select 1 from public.shift_recon_log l where l.report_id = A and l.field = 'moves' and l.reason like '%Luân chuyển%') then 'ĐẠT' else 'HỎNG' end
        || ' (7) có lịch sử sửa ở Sổ thu chi và bản đối soát';

  -- (8) nhân viên ca không đổi được
  select * into nv from public.accounts a where a.auth_user_id is not null and a.system_role = 'nv' order by a.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  select m.mkey into mk from public.app__tc_moves_x(1, '2026-10-09', '2026-10-09') m where m.report_id = A and m.amount = -40000;
  begin perform public.app_stc_move_exchange(A, mk, 'thử'); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg <> 'không chặn' then 'ĐẠT' else 'HỎNG' end || ' (8) nhân viên ca gọi → ' || msg;
  raise exception 'REPORT>> %', rep;
end $$;
