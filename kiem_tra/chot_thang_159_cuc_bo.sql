-- Bài thử CỤC BỘ cho supabase/159_chot_thang_con_thieu.sql (chặng 3, anh Tiến chốt 22/11/2026): khung "Còn thiếu để chốt tháng".
-- app_fin_missing đếm đúng các việc app_fin_close chặn (cùng điều kiện) + chia ca chưa hoàn thành đối soát theo chỗ kẹt;
-- app_fin_close chỉ đổi chữ báo lỗi (không còn chỉ tới Quản lý ca › Thu chi / Âm tiền, Sổ quỹ). Chạy trên Postgres cục bộ. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/chot_thang_159_cuc_bo.sql
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; j jsonb; fj jsonb; n int; msg text; d text; ok boolean;
  mi text[] := public.app__ca_money_items(); ci text[] := public.app__ca_check_items(); want jsonb;
  P1 constant bigint := 995901;   -- phiếu đang chốt dở
  K1 constant bigint := 995902;   -- chờ kế toán: chưa có file Fabi
  F1 constant bigint := 995903;   -- đủ kế toán, chưa xác nhận Fabi
  H1 constant bigint := 995904;   -- đã xác nhận Fabi, chưa bấm Hoàn thành đối soát ca
  V1 constant bigint := 995905;   -- phần tiền xong, thiếu Nhân sự + Bàn giao
  X1 constant bigint := 995906;   -- đã hoàn thành đối soát → không tính
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 159', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (995999, 1, 'TK-THU-159', 1);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer, self_reconciled)
  values (P1, 1, '2026-10-05', 'Sáng', 'dang_chot', 'chua', 'ngay', 1000000, 1000000, 0, 0, 0, 0, 1000000, 0, false),
         (K1, 1, '2026-10-06', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 0, 0, 0, 0, 1000000, 0, false),
         (F1, 1, '2026-10-06', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 0, 0, 0, 0, 1000000, 0, false),
         (H1, 1, '2026-10-07', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 0, 0, 0, 0, 1000000, 0, false),
         (V1, 1, '2026-10-07', 'Chiều', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 0, 0, 0, 0, 1000000, 0, true),
         (X1, 1, '2026-10-08', 'Sáng', 'hoan_thanh', 'hoan_thanh', 'ngay', 1000000, 1000000, 0, 0, 0, 0, 1000000, 0, true);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, report_id)
  select 'T159-' || x, 'Cửa hàng thử 159', 1, r.work_date, r.shift, x from unnest(array[F1, H1, V1, X1]) x join public.shift_reports r on r.id = x;
  insert into public.bank_account_balances(report_id, account_id, opening, closing) select x, 995999, 0, 0 from unnest(array[F1, H1, V1, X1]) x;
  insert into public.shift_report_results(report_id, item, result, amount) select x, it, 'khop', 0 from unnest(array[H1, V1, X1]) x cross join unnest(mi) it;
  insert into public.stc_ca_done(report_id) values (V1), (X1);
  insert into public.shift_report_checks(report_id, item, checked_at) select V1, it, '2026-10-07 20:00' from unnest(ci) it where it not in ('nhan_su', 'ban_giao');
  insert into public.shift_report_checks(report_id, item, checked_at) select X1, it, '2026-10-08 13:00' from unnest(ci) it;

  j := public.app_fin_missing(1, '2026-10');
  fj := public.app__fin_full(1, '2026-10');

  -- (1) phiếu đang chốt dở: có đúng phiếu P1, số bằng số trang đang dùng (app__fin_full)
  rep := rep || E'\n' || case when jsonb_path_exists(j, '$.in_progress[*] ? (@.id == $x)', jsonb_build_object('x', P1))
                               and jsonb_array_length(j -> 'in_progress') = (fj -> 'revenue' ->> 'in_progress')::int then 'ĐẠT' else 'HỎNG' end
        || format(' (1) phiếu đang chốt dở: %s (trang Chốt tháng đếm %s)', j -> 'in_progress', fj -> 'revenue' ->> 'in_progress');

  -- (2) ca chưa hoàn thành đối soát chia đúng chỗ kẹt
  ok := jsonb_path_exists(j, '$.recon.kt[*] ? (@.id == $x)', jsonb_build_object('x', K1))
    and (select (x -> 'miss') ? 'file chốt ca Fabi' from jsonb_array_elements(j -> 'recon' -> 'kt') x where (x ->> 'id')::bigint = K1);
  rep := rep || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || format(' (2a) chờ kế toán (chưa có file Fabi): %s', j -> 'recon' -> 'kt');
  rep := rep || E'\n' || case when jsonb_path_exists(j, '$.recon.fabi[*] ? (@.id == $x)', jsonb_build_object('x', F1)) then 'ĐẠT' else 'HỎNG' end
        || format(' (2b) chưa xác nhận Fabi: %s', j -> 'recon' -> 'fabi');
  rep := rep || E'\n' || case when jsonb_path_exists(j, '$.recon.hoan_thanh[*] ? (@.id == $x)', jsonb_build_object('x', H1)) then 'ĐẠT' else 'HỎNG' end
        || format(' (2c) đã xác nhận Fabi, chưa bấm Hoàn thành: %s', j -> 'recon' -> 'hoan_thanh');
  want := to_jsonb(array(select public.app__ca_item_label(it) from unnest(ci) with ordinality u(it, o) where it in ('nhan_su', 'ban_giao') order by o));
  rep := rep || E'\n' || case when (select x -> 'miss' from jsonb_array_elements(j -> 'recon' -> 'viec') x where (x ->> 'id')::bigint = V1) = want then 'ĐẠT' else 'HỎNG' end
        || format(' (2d) phần tiền xong, còn phần việc: %s (cần thiếu %s)', j -> 'recon' -> 'viec', want);
  select count(*) into n from jsonb_each(j -> 'recon') g cross join jsonb_array_elements(g.value) x;
  rep := rep || E'\n' || case when n = (fj -> 'revenue' ->> 'done')::int - (fj -> 'revenue' ->> 'recon')::int and n = 4
                                   and not jsonb_path_exists(j, '$.recon.*[*] ? (@.id == $x)', jsonb_build_object('x', X1)) then 'ĐẠT' else 'HỎNG' end
        || format(' (2e) tổng các nhóm %s = số ca chưa hoàn thành đối soát trang đang báo %s; ca đã xong không tính', n,
                  (fj -> 'revenue' ->> 'done')::int - (fj -> 'revenue' ->> 'recon')::int);

  -- (3) các số còn lại y hệt điều kiện của app_fin_close
  select count(*) into n from public.app__tc_moves(1, '2026-10-01', '2026-10-31') m
    left join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey where coalesce(fc.checked, 0) = 0;
  rep := rep || E'\n' || case when (j ->> 'unchecked')::int = n and (j ->> 'gap_pending')::int = public.app__gap_pending(1, '2026-10-01', '2026-10-31')
                                   and (j ->> 'ext_bad')::int = (select count(*) from public.ext_entries e where left(e.entry_date, 7) = '2026-10' and not public.app__ext_ok(e.id))
                              then 'ĐẠT' else 'HỎNG' end
        || format(' (3) khoản chờ đối soát %s · chênh lệch chờ %s · Quỹ ngoài chưa chia %s (cùng cách đếm khi chốt)', j ->> 'unchecked', j ->> 'gap_pending', j ->> 'ext_bad');

  -- (4) Chốt tháng vẫn chặn đúng thứ tự, chữ báo lỗi mới
  begin perform public.app_fin_close(1, '2026-10', null); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like 'Còn 1 phiếu chốt ca đang chốt dở%' then 'ĐẠT' else 'HỎNG' end || ' (4a) còn phiếu dở → chặn: ' || msg;
  delete from public.shift_reports where id = P1;
  begin perform public.app_fin_close(1, '2026-10', null); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like 'Còn 4 ca chưa hoàn thành đối soát%' and msg like '%Còn thiếu để chốt tháng%' then 'ĐẠT' else 'HỎNG' end || ' (4b) còn ca chưa xong → chặn: ' || msg;
  update public.shift_reports set recon_status = 'hoan_thanh' where id in (K1, F1, H1, V1);
  insert into public.shift_report_moves(id, report_id, kind, amount, note, sort_order) values (995901, X1, 'tien_mat', -50000, 'Mua đá (thử 159)', 1);
  j := public.app_fin_missing(1, '2026-10');
  begin perform public.app_fin_close(1, '2026-10', null); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like 'Còn 1 khoản thu chi%' and msg like '%Sổ thu chi › Sổ chi%' and msg not like '%Quản lý ca%' and (j ->> 'unchecked')::int = 1
                                   and coalesce(jsonb_array_length(j -> 'recon' -> 'viec'), 0) = 0 then 'ĐẠT' else 'HỎNG' end
        || format(' (4c) khoản chi chưa chọn nhóm → chặn (khung đếm %s): %s', j ->> 'unchecked', msg);

  -- (5) chữ báo lỗi không còn chỉ tới trang đã gỡ
  d := pg_get_functiondef('public.app_fin_close(bigint,text,text)'::regprocedure);
  rep := rep || E'\n' || case when position('Quản lý ca ›' in d) = 0 and position('Sổ quỹ ›' in d) = 0 and position('Sổ thu chi › Quỹ ngoài' in d) > 0
                                   and position('Đối soát Fabi (bước Chênh lệch)' in d) > 0 then 'ĐẠT' else 'HỎNG' end
        || ' (5) app_fin_close không còn "Quản lý ca ›" / "Sổ quỹ ›"; có "Sổ thu chi › Quỹ ngoài", "Đối soát Fabi (bước Chênh lệch)"';

  -- (6) người không có quyền Chốt tháng của cơ sở thì không xem được
  select * into nv from public.accounts a where a.auth_user_id is not null and a.system_role = 'nv' order by a.id limit 1;   -- nhân viên ca
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_fin_missing(1, '2026-10'); msg := 'xem được'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg <> 'xem được' then 'ĐẠT' else 'HỎNG' end || format(' (6) tài khoản %s (không quản lý) gọi → %s', coalesce(nv.system_role, '?'), msg);
  raise exception 'REPORT>> %', rep;
end $$;
