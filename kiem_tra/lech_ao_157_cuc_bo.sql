-- Bài thử CỤC BỘ cho supabase/157_lech_ao_giao_ket.sql (chặng 2, anh Tiến chốt 21/11): "lệch ảo khi giao két".
-- Ca trước THU THEO CA (quản lý thu két, để lại 1.000.000 gối đầu) → ca sau phải mở đúng 1.000.000; so số ca sau đếm với 1.000.000,
-- KHÔNG so với số nhân viên ca trước đếm cả két (trước đây: ca sau thiếu 30.000 thì ca trước hiện thiếu 330.000).
-- Ca trước THU CUỐI NGÀY: giữ nguyên cách cũ (so với số ca trước đếm, có "rút quỹ"). Chạy trên Postgres cục bộ. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/lech_ao_157_cuc_bo.sql
do $$
declare chu public.accounts; rep text := ''; h jsonb; m jsonb; fl bigint := coalesce(public.app__fund_set('fund_cash_float')::bigint, 1000000);
  A1 constant bigint := 995701; A2 constant bigint := 995702;   -- ngày 1: ca trước thu theo ca, ca sau thiếu 30.000
  B1 constant bigint := 995703; B2 constant bigint := 995704;   -- ngày 2: ca trước thu theo ca, ca sau mở đúng gối đầu
  C1 constant bigint := 995705; C2 constant bigint := 995706;   -- ngày 3: ca trước thu cuối ngày, ca sau thiếu 30.000 so với két ca trước
  D1 constant bigint := 995707; D2 constant bigint := 995708;   -- ngày 4: ca trước thu cuối ngày, ca sau mở bằng gối đầu (phần dư nộp quỹ)
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted, opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A1, 1, '2026-10-01', 'Sáng', 'hoan_thanh', 'chua', 'ca', 1300000, fl, fl, 300000, 300000, 0, 0, 1300000, 0),
         (A2, 1, '2026-10-01', 'Chiều', 'hoan_thanh', 'chua', 'ngay', null, fl - 30000, fl - 30000, 0, 0, 0, 0, fl - 30000, 0),
         (B1, 1, '2026-10-02', 'Sáng', 'hoan_thanh', 'chua', 'ca', 1300000, fl, fl, 300000, 300000, 0, 0, 1300000, 0),
         (B2, 1, '2026-10-02', 'Chiều', 'hoan_thanh', 'chua', 'ngay', null, fl, fl, 0, 0, 0, 0, fl, 0),
         (C1, 1, '2026-10-03', 'Sáng', 'hoan_thanh', 'chua', 'ngay', null, fl, fl, 300000, 300000, 0, 0, 1300000, 0),
         (C2, 1, '2026-10-03', 'Chiều', 'hoan_thanh', 'chua', 'ngay', null, 1270000, 1270000, 0, 0, 0, 0, 1270000, 0),
         (D1, 1, '2026-10-04', 'Sáng', 'hoan_thanh', 'chua', 'ngay', null, fl, fl, 300000, 300000, 0, 0, 1300000, 0),
         (D2, 1, '2026-10-04', 'Chiều', 'hoan_thanh', 'chua', 'ngay', null, fl, fl, 0, 0, 0, 0, fl, 0);

  -- (1) ca trước thu theo ca, ca sau mở thiếu 30.000 so với gối đầu → lệch đúng −30.000 (không phải −330.000)
  h := public.app__ca_hand(A2);
  rep := rep || E'\n' || case when (h ->> 'gap_eff')::bigint = -30000 and h ->> 'state' in ('lech', 'can_dem_lai') then 'ĐẠT' else 'HỎNG' end
        || format(' (1) ca trước thu theo ca, ca sau thiếu 30.000: lệch %s (trạng thái %s)', h ->> 'gap_eff', h ->> 'state');
  m := public.app__ca_money(A1);
  rep := rep || E'\n' || case when (m ->> 'handover_gap')::bigint = -30000 then 'ĐẠT' else 'HỎNG' end
        || format(' (1b) trang Xác nhận Fabi của ca trước: lệch giao két %s', m ->> 'handover_gap');

  -- (2) ca trước thu theo ca, ca sau mở đúng gối đầu → khớp, không lệch
  h := public.app__ca_hand(B2);
  rep := rep || E'\n' || case when (h ->> 'gap_eff')::bigint = 0 and h ->> 'state' = 'khop' then 'ĐẠT' else 'HỎNG' end
        || format(' (2) ca trước thu theo ca, ca sau mở đúng gối đầu: lệch %s (trạng thái %s)', h ->> 'gap_eff', h ->> 'state');

  -- (3) ca trước thu cuối ngày: so với két ca trước như cũ → thiếu 30.000
  h := public.app__ca_hand(C2);
  rep := rep || E'\n' || case when (h ->> 'gap_eff')::bigint = -30000 then 'ĐẠT' else 'HỎNG' end
        || format(' (3) ca trước thu cuối ngày, ca sau thiếu 30.000 so với két: lệch %s (như cũ)', h ->> 'gap_eff');

  -- (4) ca trước thu cuối ngày, ca sau mở bằng gối đầu, phần dư nộp quỹ → "rút quỹ", không lệch (như cũ)
  h := public.app__ca_hand(D2);
  rep := rep || E'\n' || case when h ->> 'state' = 'rut_quy' and (h ->> 'gap_eff')::bigint = 0 and (h ->> 'rut')::bigint = 300000 then 'ĐẠT' else 'HỎNG' end
        || format(' (4) ca trước thu cuối ngày, mở bằng gối đầu: trạng thái %s · rút %s (như cũ)', h ->> 'state', h ->> 'rut');

  raise exception 'REPORT>> %', rep;
end $$;
