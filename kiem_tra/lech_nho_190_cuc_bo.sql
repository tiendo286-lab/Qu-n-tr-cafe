-- Bài thử CỤC BỘ cho supabase/190_lech_nho_tu_tao_phieu.sql (anh Tiến chốt 27/11/2026): lệch nhỏ ≤ 5.000 tự tạo phiếu khi Hoàn thành đối soát ca.
-- Ca giả 997901 (cơ sở 1, 26/11 Tối): tiền mặt THIẾU 3.000, chuyển khoản DƯ 2.000. Ca giả 997902 (25/11 Tối): tiền mặt thiếu 50.000 (lệch lớn).
-- Đăng nhập giả là Chủ của seed.sql. REPORT>> tự hoàn tác. Chạy sau tệp 190 ×2:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/lech_nho_190_cuc_bo.sql
do $$
declare chu public.accounts; rep text := ''; msg text; j jsonb; x jsonb; n int; n2 int; f0 int; g record;
  A constant bigint := 997901; B constant bigint := 997902;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.fin_categories(kind, name) select 'chi', 'Âm tiền – quán chịu' where not exists (select 1 from public.fin_categories where kind = 'chi' and name = 'Âm tiền – quán chịu');
  insert into public.fin_categories(kind, name) select 'thu', 'Thu khác' where not exists (select 1 from public.fin_categories where kind = 'thu' and name = 'Thu khác');
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 190', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (997901, 1, 'thu-190', 1);
  -- ca A: mở 1.000.000 · bán 500.000 = TM 300.000 + CK 200.000 · quản lý đếm 1.297.000 (thiếu 3.000) · ngân hàng 202.000 (dư 2.000)
  -- ca B: như trên nhưng quản lý đếm 1.250.000 (thiếu 50.000), ngân hàng đủ 200.000
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-11-26', 'Tối', 'hoan_thanh', 'chua', 'ca', 1297000, 1000000, 1000000, 500000, 300000, 200000, 0, 1297000, 200000),
         (B, 1, '2026-11-25', 'Tối', 'hoan_thanh', 'chua', 'ca', 1250000, 1000000, 1000000, 500000, 300000, 200000, 0, 1250000, 200000);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id)
  values ('thu-190-A', 'Cửa hàng thử 190', 1, '2026-11-26', 'Tối', 1000000, 500000, 300000, 200000, 0, A), ('thu-190-B', 'Cửa hàng thử 190', 1, '2026-11-25', 'Tối', 1000000, 500000, 300000, 200000, 0, B);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select r.id, k.id, 0, case when k.id = 997901 then case when r.id = A then 402000 else 200000 end else 0 end   -- số dư nối tiếp theo tài khoản: ca B (25/11) nhận 200.000, ca A (26/11) nhận 202.000
    from public.bank_accounts k cross join (values (A), (B)) r(id) where k.branch_id = 1 and k.active = 1;
  perform set_config('app.ca_auto', '1', true);
  delete from public.shift_report_results where report_id in (A, B); delete from public.shift_report_checks where report_id in (A, B);
  delete from public.stc_ca_done where report_id in (A, B);
  update public.shift_reports set recon_status = 'chua', recon_by = null, recon_at = null where id in (A, B);
  perform set_config('app.ca_auto', '', true);
  j := public.app__ca_money(A);
  rep := rep || E'\n' || case when (j ->> 'tm_left')::bigint = -3000 and (j ->> 'ck_left')::bigint = 2000 then 'ĐẠT' else 'HỎNG' end || format(' (0) ca A dựng đúng: tiền mặt %s, chuyển khoản %s', j ->> 'tm_left', j ->> 'ck_left');
  select count(*) into f0 from public.fin_entries;

  -- (1) chưa Hoàn thành: không có phiếu tự tạo, lệch nhỏ chưa thành dòng chênh lệch
  select count(*) into n from public.app__gap_rows(1, '2026-11-26', '2026-11-26') z where z.report_id = A;
  rep := rep || E'\n' || case when n = 0 and not exists (select 1 from public.gap_decisions where report_id = A) then 'ĐẠT' else 'HỎNG' end || ' (1) chưa Hoàn thành: chưa có phiếu, lệch nhỏ vẫn như cũ';

  -- (2) Hoàn thành ca A → tự tạo 2 phiếu: chi Quán chịu 3.000 (tiền mặt), thu Thu khác 2.000 (chuyển khoản)
  begin j := public.app_ds2_finish(A, array['nhan_su', 'ban_giao', 'nhap_hang'], array['anh', 'sot', 'that', 'goi']); msg := 'xong';
  exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  select count(*) into n from public.gap_decisions d where d.report_id = A and d.auto;
  rep := rep || E'\n' || case when msg = 'xong' and n = 2
      and exists (select 1 from public.gap_decisions d join public.fin_entries e on e.id = d.fin_entry_id join public.fin_categories c on c.id = e.category_id
                   where d.report_id = A and d.item = 'tien_mat' and d.kind = 'quan_chiu' and d.amount = 3000 and e.kind = 'chi' and e.amount = 3000 and e.no_fund and c.name = 'Âm tiền – quán chịu' and e.entry_date = '2026-11-26')
      and exists (select 1 from public.gap_decisions d join public.fin_entries e on e.id = d.fin_entry_id join public.fin_categories c on c.id = e.category_id
                   where d.report_id = A and d.item = 'chuyen_khoan' and d.kind = 'thu_khac' and d.amount = 2000 and e.kind = 'thu' and e.amount = 2000 and e.no_fund and c.name = 'Thu khác')
      then 'ĐẠT' else 'HỎNG' end || format(' (2) Hoàn thành ca lệch nhỏ → %s · %s phiếu tự tạo (chi Quán chịu 3.000 + thu Thu khác 2.000)', msg, n);
  rep := rep || E'\n' || case when (select recon_status from public.shift_reports where id = A) = 'hoan_thanh' then 'ĐẠT' else 'HỎNG' end || ' (2b) ca vẫn thành Đã đối soát như cũ';

  -- (3) lệch nhỏ đã có phiếu thành dòng chênh lệch trạng thái xong; sổ tháng ghi "Đã xử lý" + quyết định có auto
  select count(*), count(*) filter (where z.state = 'xong' and z.remain = 0) into n, n2 from public.app__gap_rows(1, '2026-11-26', '2026-11-26') z where z.report_id = A;
  rep := rep || E'\n' || case when n = 2 and n2 = 2 then 'ĐẠT' else 'HỎNG' end || format(' (3a) 2 dòng chênh lệch của ca A đều xong, còn lại 0 (%s / %s)', n2, n);
  j := public.app_stc_month(1, '2026-11');
  select i into x from jsonb_array_elements(j -> 'items') i where i ->> 'id' = 'g:' || A || ':tm';
  rep := rep || E'\n' || case when x ->> 'status' like 'Đã xử lý%' and (x -> 'gap' -> 'decisions' -> 0 ->> 'auto')::boolean and (x ->> 'amount')::bigint = 3000 and x ->> 'book' = 'chi' then 'ĐẠT' else 'HỎNG' end
    || format(' (3b) sổ tháng: dòng lệch tiền mặt ca A "%s", số tiền %s, quyết định auto = %s', x ->> 'status', x ->> 'amount', x -> 'gap' -> 'decisions' -> 0 ->> 'auto');
  rep := rep || E'\n' || case when public.app__gap_pending(1, '2026-11-26', '2026-11-26') = 0 then 'ĐẠT' else 'HỎNG' end || ' (3c) không làm tăng số chênh lệch chờ (điều kiện chốt tháng)';

  -- (4) gọi lại không tạo trùng
  n := public.app__gap_auto_small(A, chu.id);
  rep := rep || E'\n' || case when n = 0 and (select count(*) from public.gap_decisions where report_id = A) = 2 then 'ĐẠT' else 'HỎNG' end || ' (4) gọi lại: không tạo trùng';

  -- (5) Mở lại Hoàn thành → phiếu tự tạo tự huỷ (cả phiếu thu chi), lệch nhỏ về như cũ
  begin perform public.app_ds2_reopen(A, 'thử mở lại'); msg := 'mở lại được'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  select count(*) into n from public.fin_entries;
  rep := rep || E'\n' || case when msg = 'mở lại được' and not exists (select 1 from public.gap_decisions where report_id = A) and n = f0
      and (select count(*) from public.app__gap_rows(1, '2026-11-26', '2026-11-26') z where z.report_id = A) = 0 then 'ĐẠT' else 'HỎNG' end
    || format(' (5) Mở lại → %s · phiếu tự tạo đã huỷ hết (phiếu thu chi %s → %s)', msg, f0, n);

  -- (6) Hoàn thành lại → tạo lại
  begin j := public.app_ds2_finish(A, array['nhan_su', 'ban_giao', 'nhap_hang'], array['anh', 'sot', 'that', 'goi']); msg := 'xong'; exception when others then msg := 'LỖI ' || sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  rep := rep || E'\n' || case when msg = 'xong' and (select count(*) from public.gap_decisions where report_id = A and auto) = 2 then 'ĐẠT' else 'HỎNG' end || ' (6) Hoàn thành lại → tạo lại 2 phiếu — ' || msg;

  -- (7) ca B lệch LỚN (thiếu 50.000): Hoàn thành không tự tạo phiếu, vẫn là chênh lệch chờ xử lý như cũ
  begin j := public.app_ds2_finish(B, array['nhan_su', 'ban_giao', 'nhap_hang'], array['anh', 'sot', 'that', 'goi', 'lech_tm']); msg := 'xong'; exception when others then msg := sqlerrm; end;
  perform set_config('app.ds_moi', '', true);
  select * into g from public.app__gap_rows(1, '2026-11-25', '2026-11-25') z where z.report_id = B and z.item = 'tien_mat';
  rep := rep || E'\n' || case when not exists (select 1 from public.gap_decisions where report_id = B) and g.remain = 50000 and g.state = 'cho_gan' then 'ĐẠT' else 'HỎNG' end
    || format(' (7) ca lệch lớn: không tự tạo phiếu, còn %s chờ xử lý (%s) — Hoàn thành: %s', g.remain, g.state, left(msg, 80));

  -- (8) tạo bù: xoá tay phiếu tự tạo của ca A rồi chạy hàm tạo bù → tạo lại đúng 2 phiếu của 1 ca; chạy lần nữa không thêm
  perform public.app__gap_auto_clear(A);
  j := public.app__gap_auto_backfill();
  x := public.app__gap_auto_backfill();
  rep := rep || E'\n' || case when (j ->> 'phieu')::int = 2 and (j ->> 'ca')::int = 1 and (j ->> 'loi')::int = 0 and (x ->> 'phieu')::int = 0 then 'ĐẠT' else 'HỎNG' end || format(' (8) tạo bù: lần 1 %s · lần 2 %s', j, x);

  -- (9) Chủ huỷ tay một phiếu tự tạo bằng đường có sẵn → lệch nhỏ đó về như cũ, không tự tạo lại ngay
  perform public.app_gap_decision_delete((select id from public.gap_decisions where report_id = A and item = 'tien_mat'));
  rep := rep || E'\n' || case when (select count(*) from public.gap_decisions where report_id = A) = 1
      and not exists (select 1 from public.app__gap_rows(1, '2026-11-26', '2026-11-26') z where z.report_id = A and z.item = 'tien_mat') then 'ĐẠT' else 'HỎNG' end
    || ' (9) Chủ huỷ tay phiếu tự tạo: được, lệch nhỏ đó về "coi như khớp"';

  -- (10) quyền gọi: web không gọi được hàm nội bộ
  rep := rep || E'\n' || case when not has_function_privilege('authenticated', 'public.app__gap_auto_small(bigint, bigint)', 'execute')
      and not has_function_privilege('authenticated', 'public.app__gap_auto_backfill()', 'execute') and not has_function_privilege('anon', 'public.app__gap_auto_clear(bigint)', 'execute') then 'ĐẠT' else 'HỎNG' end
    || ' (10) hàm nội bộ không cho web gọi';
  raise exception 'REPORT>> %', rep;
end $$;
