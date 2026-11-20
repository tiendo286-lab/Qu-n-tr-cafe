-- Bài thử CỤC BỘ cho supabase/152_sua_no_cua_ca.sql (gộp vào bước 172 đợt B — sửa khoản nợ của ca ở bước 1 Đối soát Fabi).
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-20-sua-no-cua-ca-design.md. Chạy trên Postgres cục bộ đã có tệp 150 + 151. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/sua_no_ca_152_cuc_bo.sql
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; it text; j jsonb; n int; t text; ok boolean;
  C constant bigint := 992001; CD constant bigint := 992002; CX constant bigint := 992003;
  px bigint; poff bigint; d1 bigint; dq bigint; dbill bigint; dpaid bigint; dx bigint; dd bigint; nid bigint;
  tm0 bigint; ck0 bigint; tm1 bigint; ck1 bigint; lt0 bigint; lt1 bigint; s public.shift_debts; mv jsonb;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- ca C (Tối 13/11, cơ sở 1): đã gửi phiếu, kế toán đủ file Fabi + số ngân hàng, đã Xác nhận Fabi (đủ kết quả tiền), CHƯA Hoàn thành
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (C, 1, '2026-11-13', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 500000, 300000, 200000, 20000, 1300000, 200000),
         (CD, 1, '2026-11-14', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000),
         (CX, 1, '2026-11-15', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 152', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (992001, 1, 'thu-152', 1);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id) values
    ('thu-152-C', 'Cửa hàng thử 152', 1, '2026-11-13', 'Tối', 1000000, 500000, 300000, 200000, 20000, C),
    ('thu-152-D', 'Cửa hàng thử 152', 1, '2026-11-14', 'Tối', 1000000, 500000, 300000, 200000, 0, CD),
    ('thu-152-CX', 'Cửa hàng thử 152', 1, '2026-11-15', 'Tối', 1000000, 500000, 300000, 200000, 0, CX);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select q.id, k.id, 0, case when k.id = 992001 then 200000 else 0 end from public.bank_accounts k, (values (C), (CD), (CX)) q(id) where k.branch_id = 1 and k.active = 1;
  perform set_config('app.ca_auto', '1', true);
  foreach it in array public.app__ca_money_items() loop
    insert into public.shift_report_results(report_id, item, result, amount, by_account, at) values (C, it, 'khop', 0, chu.id, public.vn_now_text()), (CX, it, 'khop', 0, chu.id, public.vn_now_text())
    on conflict (report_id, item) do nothing;
  end loop;
  perform set_config('app.ca_auto', '', true);
  px := public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'Khách thử 152', 'grp', 'khach'));
  poff := public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'Người nghỉ 152', 'grp', 'khac'));
  perform public.app_stc_person_save(poff, jsonb_build_object('branch_id', 1, 'name', 'Người nghỉ 152', 'grp', 'khac', 'active', 0));
  -- nợ của ca C do nhân viên ghi: TM 50.000 · HĐ 20.000 · TM 15.000 đã thu ở ca sau
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, C, 'khách nợ bàn 5 152', 50000, nv.id, 'muon') returning id into d1;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, C, 'anh Vinh 152', 20000, nv.id, 'bill') returning id into dbill;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, C, 'chị Hoa 152', 15000, nv.id, 'muon') returning id into dpaid;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = chu.id, closed_report_id = CX, collect_kind = 'tien_mat' where id = dpaid;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, CX, 'nợ ca khác 152', 10000, nv.id, 'muon') returning id into dx;
  insert into public.stc_ca_ticks(report_id, item, by_account) values (C, 'ld', chu.id), (C, 'sau_tm', chu.id), (C, 'sau_ck', chu.id), (C, 'anh', chu.id);
  tm0 := (public.app__ca_money(C) ->> 'tm_left')::bigint; ck0 := (public.app__ca_money(C) ->> 'ck_left')::bigint;
  lt0 := (select coalesce(sum(case when i ->> 'book' = 'thu' then (i ->> 'amount')::bigint else -(i ->> 'amount')::bigint end), 0)
            from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'items') i where (i ->> 'ca_id')::bigint = C and i ->> 'col' = 'lech' and i ->> 'pm' = 'tm');
  rep := rep || format(E'\n    ca thử C: tiền mặt dư (thực nhận − phải có) %s · chuyển khoản dư %s · lệch TM ở sổ %s', tm0, ck0, lt0);
  -- app__ca_money.tm_left / ck_left = thực nhận − phải có: phải có tăng thì số này GIẢM đúng bằng phần tăng

  -- (1) sửa số tiền TM 50.000 → 30.000 (sau Xác nhận Fabi): khách mượn ít đi 20.000 → tiền mặt phải có tăng 20.000 → dư giảm 20.000, lệch ở sổ giảm 20.000; ghi vết; bỏ tích
  perform public.app_stc_ca_debt_save(C, d1, jsonb_build_object('kind', 'muon', 'amount', 30000), 'NV ghi nhầm số');
  tm1 := (public.app__ca_money(C) ->> 'tm_left')::bigint;
  lt1 := (select coalesce(sum(case when i ->> 'book' = 'thu' then (i ->> 'amount')::bigint else -(i ->> 'amount')::bigint end), 0)
            from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'items') i where (i ->> 'ca_id')::bigint = C and i ->> 'col' = 'lech' and i ->> 'pm' = 'tm');
  select count(*) into n from public.shift_recon_log l where l.report_id = C and l.action = 'bao_no_sua' and l.reason = 'Sổ thu chi: NV ghi nhầm số' and (l.before ->> 'amount')::bigint = 50000 and (l.after ->> 'amount')::bigint = 30000;
  rep := rep || E'\n' || case when tm1 - tm0 = -20000 and lt1 - lt0 = -20000 and n = 1 then 'ĐẠT' else 'HỎNG' end
      || format(' (1) sửa 50.000 → 30.000: TM dư %s → %s · lệch TM ở sổ %s → %s · ghi vết %s', tm0, tm1, lt0, lt1, n);
  -- (10) bỏ tích: ld, sau_tm, sau_ck mất; ảnh giữ
  select string_agg(item, ',' order by item) into t from public.stc_ca_ticks where report_id = C;
  rep := rep || E'\n' || case when t = 'anh' then 'ĐẠT' else 'HỎNG' end || ' (10) sau khi sửa nợ: mục còn tích = ' || coalesce(t, '(không)');

  -- (2) đổi TM → CK (30.000): tiền mặt phải có +30.000 → TM dư −30.000; chuyển khoản phải có −30.000 → CK dư +30.000
  tm0 := tm1; ck0 := (public.app__ca_money(C) ->> 'ck_left')::bigint;
  perform public.app_stc_ca_debt_save(C, d1, jsonb_build_object('kind', 'ck', 'amount', 30000), 'Khách hứa chuyển khoản');
  tm1 := (public.app__ca_money(C) ->> 'tm_left')::bigint; ck1 := (public.app__ca_money(C) ->> 'ck_left')::bigint;
  rep := rep || E'\n' || case when tm1 - tm0 = -30000 and ck1 - ck0 = 30000 then 'ĐẠT' else 'HỎNG' end || format(' (2) đổi TM → CK: TM %s → %s · CK %s → %s', tm0, tm1, ck0, ck1);

  -- (7e) không đổi gì → báo
  begin perform public.app_stc_ca_debt_save(C, d1, jsonb_build_object('kind', 'ck', 'amount', 30000), 'thử'); t := 'LƯU ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Chưa đổi gì%' then 'ĐẠT' else 'HỎNG' end || ' (7e) lưu mà không đổi gì: ' || t;

  -- (3) xoá khoản Nợ CK 30.000: chuyển khoản phải có +30.000 → CK dư −30.000; ghi vết bao_no_xoa
  ck0 := ck1;
  perform public.app_stc_ca_debt_delete(C, d1, 'Không phải nợ, khách đã trả ngay');
  ck1 := (public.app__ca_money(C) ->> 'ck_left')::bigint;
  select count(*) into n from public.shift_recon_log l where l.report_id = C and l.action = 'bao_no_xoa' and (l.before ->> 'id')::bigint = d1 and l.reason like 'Sổ thu chi: %';
  rep := rep || E'\n' || case when ck1 - ck0 = -30000 and not exists (select 1 from public.shift_debts where id = d1) and n = 1 then 'ĐẠT' else 'HỎNG' end
      || format(' (3) xoá: CK %s → %s · ghi vết %s', ck0, ck1, n);

  -- (4) thêm khoản quên ghi (TM 40.000) cho người trong danh sách: tiền mặt phải có −40.000 → TM dư +40.000; coi như đã xếp
  tm0 := tm1;
  nid := public.app_stc_ca_debt_save(C, null, jsonb_build_object('kind', 'muon', 'amount', 40000, 'person_id', px, 'grp', 'khach', 'note', 'bàn 7 quên ghi'), 'NV quên ghi');
  tm1 := (public.app__ca_money(C) ->> 'tm_left')::bigint;
  select * into s from public.shift_debts where id = nid;
  rep := rep || E'\n' || case when tm1 - tm0 = 40000 and s.report_id = C and s.person_id = px and s.table_name = 'Khách thử 152' and s.grp = 'khach' and s.sorted_at is not null
        and s.note = 'bàn 7 quên ghi' and s.kind = 'muon' then 'ĐẠT' else 'HỎNG' end
      || format(' (4) thêm khoản quên ghi: TM %s → %s · người %s · đã xếp %s · nội dung "%s"', tm0, tm1, s.person_id = px, s.sorted_at is not null, s.note);

  -- (5) thêm với người không có / đã ngừng dùng → từ chối
  begin perform public.app_stc_ca_debt_save(C, null, jsonb_build_object('kind', 'muon', 'amount', 5000, 'person_id', poff, 'grp', 'khac', 'note', 'x'), 'thử'); t := 'THÊM ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Chọn người nợ trong danh sách%' then 'ĐẠT' else 'HỎNG' end || ' (5) thêm cho người đã ngừng dùng: ' || t;

  -- (6) đổi thành Luân chuyển TM – CK (khoản TM 40.000 vừa thêm): khoản nợ mất, tiền mặt phải có không đổi, chuyển khoản phải có +40.000 → CK dư −40.000; đúng một cặp −TM / +CK
  tm0 := tm1; ck0 := (public.app__ca_money(C) ->> 'ck_left')::bigint;
  perform public.app_stc_ca_debt_to_exchange(C, nid, 'Khách chuyển khoản rồi rút tiền mặt');
  tm1 := (public.app__ca_money(C) ->> 'tm_left')::bigint; ck1 := (public.app__ca_money(C) ->> 'ck_left')::bigint;
  select data -> 'moves' into mv from public.shift_report_recon where report_id = C;
  select count(*) into n from jsonb_array_elements(mv) a, jsonb_array_elements(mv) b
   where a ->> 'exchange_key' = b ->> 'exchange_key' and a ->> 'kind' = 'tien_mat' and (a ->> 'amount')::bigint = -40000 and b ->> 'kind' = 'chuyen_khoan' and (b ->> 'amount')::bigint = 40000
     and a ->> 'note' = 'Khách CK rút tiền mặt – Khách thử 152';
  rep := rep || E'\n' || case when tm1 = tm0 and ck1 - ck0 = -40000 and n = 1 and not exists (select 1 from public.shift_debts where id = nid) then 'ĐẠT' else 'HỎNG' end
      || format(' (6) đổi thành Luân chuyển: TM %s → %s · CK %s → %s · cặp đổi tiền %s', tm0, tm1, ck0, ck1, n);

  -- (7) từ chối: nợ hoá đơn · khoản đã thu · khoản của ca khác · thiếu lý do · đổi Luân chuyển khoản CK
  begin perform public.app_stc_ca_debt_save(C, dbill, jsonb_build_object('kind', 'bill', 'amount', 1000), 'thử'); t := 'SỬA ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Nợ hoá đơn không sửa ở đây%' then 'ĐẠT' else 'HỎNG' end || ' (7a) sửa nợ hoá đơn: ' || t;
  begin perform public.app_stc_ca_debt_delete(C, dbill, 'thử'); t := 'XOÁ ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Nợ hoá đơn không sửa ở đây%' then 'ĐẠT' else 'HỎNG' end || ' (7a2) xoá nợ hoá đơn: ' || t;
  begin perform public.app_stc_ca_debt_save(C, dpaid, jsonb_build_object('kind', 'muon', 'amount', 1000), 'thử'); t := 'SỬA ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Khách đã trả khoản này%' then 'ĐẠT' else 'HỎNG' end || ' (7b) sửa khoản khách đã trả: ' || t;
  begin perform public.app_stc_ca_debt_delete(C, dx, 'thử'); t := 'XOÁ ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Không tìm thấy khoản nợ của ca này%' then 'ĐẠT' else 'HỎNG' end || ' (7c) xoá khoản của ca khác: ' || t;
  begin perform public.app_stc_ca_debt_save(C, null, jsonb_build_object('kind', 'muon', 'amount', 5000, 'person_id', px, 'grp', 'khach', 'note', 'x'), ''); t := 'THÊM ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Ghi lý do%' then 'ĐẠT' else 'HỎNG' end || ' (7d) thiếu lý do: ' || t;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, C, 'nợ ck 152', 8000, nv.id, 'ck') returning id into dd;
  begin perform public.app_stc_ca_debt_to_exchange(C, dd, 'thử'); t := 'ĐỔI ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Chỉ khoản nợ tiền mặt%' then 'ĐẠT' else 'HỎNG' end || ' (7h) đổi Luân chuyển khoản CK: ' || t;

  -- (9) sổ tháng: khoản sửa có dấu sửa (số cũ, loại cũ, ai, lý do); khoản đã xoá / đã đổi hiện dòng t = 'xoa'
  perform public.app_stc_ca_debt_save(C, dd, jsonb_build_object('kind', 'ck', 'amount', 6000), 'Khách trả bớt');
  j := public.app_stc_month(1, '2026-11') -> 'ca_debts';
  select count(*) into n from jsonb_array_elements(j) x where (x ->> 'id')::bigint = dd and x ->> 't' = 'moi' and x -> 'edit' ->> 'action' = 'sua'
     and (x -> 'edit' ->> 'old_amount')::bigint = 8000 and x -> 'edit' ->> 'old_kind' = 'ck' and x -> 'edit' ->> 'reason' = 'Khách trả bớt' and coalesce(x -> 'edit' ->> 'by', '') <> '';
  select count(*) filter (where (x ->> 'id')::bigint = d1 and x -> 'edit' ->> 'action' = 'xoa' and (x ->> 'amount')::bigint = 30000),
         count(*) filter (where (x ->> 'id')::bigint = nid and x -> 'edit' ->> 'action' = 'doi')
    into tm0, tm1 from jsonb_array_elements(j) x where x ->> 't' = 'xoa' and (x ->> 'report_id')::bigint = C;
  rep := rep || E'\n' || case when n = 1 and tm0 = 1 and tm1 = 1 then 'ĐẠT' else 'HỎNG' end || format(' (9) sổ tháng › ca_debts: dấu sửa %s · dòng đã xoá %s · dòng đã đổi Luân chuyển %s', n, tm0, tm1);

  -- (8) trước Xác nhận Fabi (ca CD: kế toán đủ, chưa có kết quả tiền) vẫn sửa được
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, CD, 'bàn 2 ca D 152', 25000, nv.id, 'muon') returning id into dq;
  begin perform public.app_stc_ca_debt_save(CD, dq, jsonb_build_object('kind', 'muon', 'amount', 20000), 'NV ghi nhầm'); select amount::text into t from public.shift_debts where id = dq;
  exception when others then t := 'BỊ CHẶN: ' || sqlerrm; end;
  rep := rep || E'\n' || case when t = '20000' then 'ĐẠT' else 'HỎNG' end || ' (8) trước Xác nhận Fabi: số tiền sau khi sửa = ' || t;

  -- (7f) ca đã Hoàn thành → phải Mở lại trước
  insert into public.stc_ca_done(report_id, by_account) values (C, chu.id);
  begin perform public.app_stc_ca_debt_save(C, dd, jsonb_build_object('kind', 'ck', 'amount', 5000), 'thử'); t := 'SỬA ĐƯỢC'; exception when others then t := sqlerrm; end;
  delete from public.stc_ca_done where report_id = C;
  rep := rep || E'\n' || case when t like '%Mở lại trước%' then 'ĐẠT' else 'HỎNG' end || ' (7f) sửa khi ca đã Hoàn thành: ' || t;

  -- (7g) nhân viên không sửa được
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_ca_debt_save(C, dd, jsonb_build_object('kind', 'ck', 'amount', 5000), 'thử'); t := 'SỬA ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t <> 'SỬA ĐƯỢC' and t not like '%does not exist%' then 'ĐẠT' else 'HỎNG' end || ' (7g) nhân viên sửa: ' || t;

  raise exception 'REPORT>> %', rep;
end $$;
