-- Bài thử CỤC BỘ cho supabase/161_sua_no_ban5_test_cong_no.sql (chặng 3, anh Tiến chốt 22/11/2026): dựng lại đúng 2 chỗ dữ liệu thật
-- (nợ bàn 5 Đông Khê 01/11 Sáng ghi 2 lần; "Test công nợ" LHP 04/11 Sáng) rồi chạy hàm sửa. Postgres cục bộ, REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/sua_du_lieu_161_cuc_bo.sql
do $$
declare rep text := ''; n int; m0 jsonb; m1 jsonb; d public.shift_debts; nm text;
begin
  update public.branches set display_code = 'LHP' where id = 1;
  update public.branches set display_code = 'ĐK' where id = 2;
  insert into public.debt_people(id, branch_id, name, grp, active) values (16, 1, 'Test công nợ', 'khach', 1), (19, 2, 'khách nợ bàn 5', 'khach', 1);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (59, 1, '2026-11-04', 'Sáng', 'hoan_thanh', 'hoan_thanh', 'ngay', 1000000, 1000000, 500000, 400000, 0, 101000, 1400000, 0),
         (60, 2, '2026-11-01', 'Sáng', 'hoan_thanh', 'chua', 'ngay', 1000000, 1000000, 3808000, 1936000, 1872000, 0, 2760000, 1846000);
  insert into public.shift_report_moves(id, report_id, kind, amount, note, sort_order) values
    (996101, 60, 'tien_mat', -117000, 'tiền vòi nước + jack loa', 1), (996102, 60, 'tien_mat', -70000, 'đá bi', 2), (996103, 60, 'chuyen_khoan', -26000, 'khách nợ', 3);
  insert into public.shift_debts(id, branch_id, report_id, table_name, amount, kind, grp, person_id) values
    (22, 2, 60, 'khách nợ bàn 5', 28000, 'muon', 'khach', 19), (20, 1, 59, 'Test công nợ', 73000, 'bill', 'khach', 16);
  insert into public.shift_report_results(report_id, item, result, amount) select 60, it, 'khop', 0 from unnest(public.app__ca_money_items()) it;
  insert into public.stc_ca_done(report_id) values (59);
  m0 := public.app__ca_money(60);

  n := public.app__sua_du_lieu_161();
  rep := rep || E'\n' || case when n = 3 then 'ĐẠT' else 'HỎNG' end || format(' (1) sửa đủ 3 việc: %s', n);

  -- (2) khoản chi chuyển khoản 26.000 "khách nợ" không còn; 2 khoản chi kia giữ nguyên
  select count(*) into n from public.app__tc_moves_x(2, '2026-11-01', '2026-11-01') m where m.report_id = 60 and m.auto is null;
  rep := rep || E'\n' || case when n = 2 and not exists (select 1 from public.app__tc_moves_x(2, '2026-11-01', '2026-11-01') m where m.report_id = 60 and m.amount = -26000)
                              then 'ĐẠT' else 'HỎNG' end || format(' (2) bỏ khoản chi CK 26.000 "khách nợ", còn %s khoản chi của ca', n);

  -- (3) khách mượn tiền mặt → nợ chuyển khoản, vẫn 28.000, khách vẫn còn nợ
  select * into d from public.shift_debts where id = 22;
  rep := rep || E'\n' || case when d.kind = 'ck' and d.amount = 28000 and d.closed_at is null then 'ĐẠT' else 'HỎNG' end
        || format(' (3) nợ bàn 5: loại %s · %s · còn nợ %s', d.kind, d.amount, d.closed_at is null);

  -- (4) tiền của ca: tiền mặt bớt "thừa" 28.000 (39.000 → 11.000 như máy chủ thật), chuyển khoản thêm 2.000 (0 → thừa 2.000)
  m1 := public.app__ca_money(60);
  rep := rep || E'\n' || case when (m1 ->> 'tm_left')::bigint - (m0 ->> 'tm_left')::bigint = -28000 and (m1 ->> 'ck_left')::bigint - (m0 ->> 'ck_left')::bigint = 2000 then 'ĐẠT' else 'HỎNG' end
        || format(' (4) lệch TM %s → %s · lệch CK %s → %s', m0 ->> 'tm_left', m1 ->> 'tm_left', m0 ->> 'ck_left', m1 ->> 'ck_left');

  -- (5) "Test công nợ" → "Khách không rõ (04/11)", tiền giữ nguyên (ca đã hoàn thành đối soát)
  select name into nm from public.debt_people where id = 16;
  select * into d from public.shift_debts where id = 20;
  rep := rep || E'\n' || case when nm = 'Khách không rõ (04/11)' and d.table_name = nm and d.amount = 73000 and d.kind = 'bill' then 'ĐẠT' else 'HỎNG' end
        || format(' (5) người nợ: %s · khoản nợ: %s %s %s', nm, d.table_name, d.kind, d.amount);

  -- (6) chạy lại: dữ liệu đã khác bản cũ → không đụng gì
  n := public.app__sua_du_lieu_161();
  rep := rep || E'\n' || case when n = 0 then 'ĐẠT' else 'HỎNG' end || format(' (6) chạy lại → sửa %s việc', n);

  -- (7) có lịch sử sửa như khi bấm trên web
  rep := rep || E'\n' || case when exists (select 1 from public.shift_recon_log l where l.report_id = 60 and l.action = 'xoa' and l.field = 'moves')
                                   and exists (select 1 from public.shift_recon_log l where l.report_id = 60 and l.action = 'bao_no_sua')
                                   and exists (select 1 from public.stc_edits e where e.ref = 'cd:22' and e.action = 'sua') then 'ĐẠT' else 'HỎNG' end
        || ' (7) có lịch sử: xoá khoản chi, sửa nợ của ca';
  raise exception 'REPORT>> %', rep;
end $$;
