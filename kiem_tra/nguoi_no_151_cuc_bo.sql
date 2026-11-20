-- Bài thử CỤC BỘ cho supabase/151_nguoi_no.sql (bước 172 đợt B) — chạy trên Postgres cục bộ (kiem_tra/may_chu_cuc_bo/), KHÔNG cần máy chủ thật.
-- Tự dựng dữ liệu giả ở cơ sở 1, đăng nhập giả là Chủ / nhân viên của seed.sql. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/nguoi_no_151_cuc_bo.sql
-- Bài trên dữ liệu thật (tự hoàn tác): kiem_tra/nguoi_no_151.sql.
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; j jsonb; n int; n2 int; pid bigint; pid2 bigint; did bigint; cid bigint; t text; g text; ok boolean;
  A constant bigint := 991001; B constant bigint := 991002; d1 bigint; d2 bigint; d3 bigint; d4 bigint; px bigint; miss text[]; it text; s public.shift_debts;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select * into nv from public.accounts where system_role = 'nv' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);

  -- (1) "Kho tổng" có ở mọi cơ sở, mỗi cơ sở đúng 1
  select count(*), count(*) filter (where k.n = 1) into n, n2
    from (select b.id, (select count(*) from public.debt_people p where p.branch_id = b.id and lower(btrim(p.name)) = 'kho tổng' and p.grp = 'kho' and p.active = 1) n from public.branches b) k;
  rep := rep || E'\n' || case when n > 0 and n = n2 then 'ĐẠT' else 'HỎNG' end || format(' (1) Kho tổng: %s / %s cơ sở có đúng 1', n2, n);

  -- (2) chạy bù: dựng nợ kiểu cũ (tắt trigger gác tên như dữ liệu trước tệp 151) rồi gọi lại hàm chạy bù
  alter table public.shift_debts disable trigger stc_debt_person;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind, grp, phone) values
    (1, null, 'Thử Nợ Khác 151', 100000, chu.id, 'muon', 'khac', '0900000151'),
    (1, null, 'Thử khách còn nợ 151', 50000, chu.id, 'bill', 'khach', null),
    (1, null, 'Thử khách đã trả 151', 70000, chu.id, 'bill', 'khach', null);
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = chu.id where table_name = 'Thử khách đã trả 151';
  alter table public.shift_debts enable trigger stc_debt_person;
  perform public.app__debt_people_backfill();
  select count(*) filter (where name = 'Thử Nợ Khác 151' and grp = 'khac' and phone = '0900000151'),
         count(*) filter (where name = 'Thử khách còn nợ 151' and grp = 'khach'),
         count(*) filter (where name = 'Thử khách đã trả 151')
    into n, n2, cid from public.debt_people where branch_id = 1;
  select count(*) into did from public.shift_debts d join public.debt_people p on p.id = d.person_id where d.table_name in ('Thử Nợ Khác 151', 'Thử khách còn nợ 151');
  rep := rep || E'\n' || case when n = 1 and n2 = 1 and cid = 0 and did = 2 then 'ĐẠT' else 'HỎNG' end
      || format(' (2) chạy bù: nợ khác %s · khách còn nợ %s · khách đã trả %s (phải 0) · khoản đã gắn người %s / 2', n, n2, cid, did);

  -- (3) thêm người → có trong danh sách; trùng tên khác hoa thường → lỗi
  pid := public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', '  Anh Thử 151 ', 'phone', '0911', 'grp', 'khach'));
  j := public.app_stc_people(1);
  select count(*) into n from jsonb_array_elements(j) x where (x ->> 'id')::bigint = pid and x ->> 'name' = 'Anh Thử 151' and x ->> 'grp' = 'khach' and (x ->> 'active')::int = 1;
  begin perform public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'anh thử 151', 'grp', 'khac')); t := 'KHÔNG báo lỗi';
  exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when n = 1 and t like '%Đã có người nợ tên này%' then 'ĐẠT' else 'HỎNG' end || format(' (3) thêm người: trong danh sách %s · thêm trùng: %s', n, t);

  -- (7) nợ ngoài ca: tên lạ bị từ chối; tên có sẵn viết khác hoa thường thì nhận, gắn đúng người, chuẩn lại tên
  begin perform public.app_cn_debt_save(null, jsonb_build_object('branch_id', 1, 'name', 'Người lạ 151', 'amount', 30000, 'kind', 'muon', 'grp', 'khach')); t := 'KHÔNG báo lỗi';
  exception when others then t := sqlerrm; end;
  did := public.app_cn_debt_save(null, jsonb_build_object('branch_id', 1, 'name', 'ANH THỬ 151', 'amount', 40000, 'kind', 'muon', 'grp', 'khach'));
  select d.person_id = pid and d.table_name = 'Anh Thử 151' into ok from public.shift_debts d where d.id = did;
  rep := rep || E'\n' || case when t like '%chưa có trong danh sách%' and ok then 'ĐẠT' else 'HỎNG' end || format(' (7) nợ ngoài ca: tên lạ → %s · tên có sẵn gắn đúng người: %s', t, ok);

  -- (4) đổi tên → khoản chưa thu đổi theo, khoản đã thu giữ nguyên
  cid := public.app_cn_debt_save(null, jsonb_build_object('branch_id', 1, 'name', 'Anh Thử 151', 'amount', 10000, 'kind', 'muon', 'grp', 'khach'));
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = chu.id where id = cid;
  perform public.app_stc_person_save(pid, jsonb_build_object('branch_id', 1, 'name', 'Anh Thử Mới 151', 'phone', '0911', 'grp', 'khach', 'active', 1));
  select (select table_name from public.shift_debts where id = did), (select table_name from public.shift_debts where id = cid) into t, g;
  rep := rep || E'\n' || case when t = 'Anh Thử Mới 151' and g = 'Anh Thử 151' then 'ĐẠT' else 'HỎNG' end || format(' (4) đổi tên: khoản chưa thu "%s" · khoản đã thu "%s"', t, g);

  -- (4b) đổi nhóm → khoản chưa thu đổi nhóm
  perform public.app_stc_person_save(pid, jsonb_build_object('branch_id', 1, 'name', 'Anh Thử Mới 151', 'phone', '0911', 'grp', 'khac', 'active', 1));
  select grp into g from public.shift_debts where id = did;
  rep := rep || E'\n' || case when g = 'khac' then 'ĐẠT' else 'HỎNG' end || ' (4b) đổi nhóm người → khoản chưa thu vào nhóm ' || g;

  -- (5) ngừng dùng → không còn nhận ở nợ ngoài ca; vẫn nằm trong danh sách với active = 0
  perform public.app_stc_person_save(pid, jsonb_build_object('branch_id', 1, 'name', 'Anh Thử Mới 151', 'phone', '0911', 'grp', 'khac', 'active', 0));
  begin perform public.app_cn_debt_save(null, jsonb_build_object('branch_id', 1, 'name', 'Anh Thử Mới 151', 'amount', 5000, 'kind', 'muon', 'grp', 'khac')); t := 'KHÔNG báo lỗi';
  exception when others then t := sqlerrm; end;
  select count(*) into n from jsonb_array_elements(public.app_stc_people(1)) x where (x ->> 'id')::bigint = pid and (x ->> 'active')::int = 0;
  rep := rep || E'\n' || case when t like '%chưa có trong danh sách%' and n = 1 then 'ĐẠT' else 'HỎNG' end || format(' (5) ngừng dùng: ghi nợ mới → %s · còn trong danh sách (mờ) %s', t, n);

  -- (6) Kho tổng: không đổi tên, không ngừng dùng
  select id into pid2 from public.debt_people where branch_id = 1 and lower(btrim(name)) = 'kho tổng';
  begin perform public.app_stc_person_save(pid2, jsonb_build_object('branch_id', 1, 'name', 'Kho khác', 'grp', 'kho', 'active', 1)); t := 'KHÔNG báo lỗi';
  exception when others then t := sqlerrm; end;
  begin perform public.app_stc_person_save(pid2, jsonb_build_object('branch_id', 1, 'name', 'Kho tổng', 'grp', 'kho', 'active', 0)); g := 'KHÔNG báo lỗi';
  exception when others then g := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Kho tổng luôn có%' and g like '%Kho tổng luôn có%' then 'ĐẠT' else 'HỎNG' end || format(' (6) Kho tổng: đổi tên → %s · ngừng dùng → %s', t, g);

  -- (8) nợ ghi trong phiếu ca (nhân viên gõ tay, phiếu đang chốt): tên lạ vẫn thêm được, chưa gắn người
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (A, 1, '2026-11-26', 'Sáng', 'dang_chot', 'chua', 'ngay', 1000000, 1000000, 100000, 100000, 0, 0, 1100000, 0);
  begin
    insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, A, 'bàn 7 chị lạ 151', 20000, chu.id, 'bill') returning id, person_id into did, pid2;
    t := case when pid2 is null then 'thêm được, chưa gắn người' else 'gắn nhầm người' end;
  exception when others then t := 'BỊ CHẶN: ' || sqlerrm; end;
  rep := rep || E'\n' || case when t = 'thêm được, chưa gắn người' then 'ĐẠT' else 'HỎNG' end || ' (8) nợ trong phiếu ca tên lạ: ' || t;

  -- (9) phần còn thiếu khi khách trả nợ (rest_of) của một khoản nợ cũ gõ tay (không có người trong danh sách) vẫn tạo được
  alter table public.shift_debts disable trigger stc_debt_person;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, null, 'Nợ cũ gõ tay 151', 90000, chu.id, 'bill') returning id into cid;
  alter table public.shift_debts enable trigger stc_debt_person;
  begin
    insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind, rest_of) values (1, null, 'Nợ cũ gõ tay 151', 30000, chu.id, 'muon', cid);
    t := 'tạo được';
  exception when others then t := 'BỊ CHẶN: ' || sqlerrm; end;
  rep := rep || E'\n' || case when t = 'tạo được' then 'ĐẠT' else 'HỎNG' end || ' (9) phần còn thiếu của nợ cũ gõ tay: ' || t;

  -- (11) gọi lại hàm chạy bù: lần đầu nhặt thêm tên khách còn nợ vừa dựng ở (8), (9); gọi lần nữa thì không thêm ai (không nhân đôi)
  perform public.app__debt_people_backfill();
  select count(*) into n from public.debt_people;
  did := public.app__debt_people_backfill();
  select count(*) into n2 from public.debt_people;
  rep := rep || E'\n' || case when did = 0 and n2 = n then 'ĐẠT' else 'HỎNG' end || format(' (11) chạy bù lần nữa: thêm %s người, %s → %s', did, n, n2);

  -- ===== Phần 2: quản lý xếp người + nhóm công nợ cho nợ mới của ca =====
  -- ca B (Tối 10/11): nhân viên đã gửi phiếu, kế toán đã có file Fabi + số ngân hàng, đã Xác nhận Fabi (đủ kết quả tiền); có nợ mới
  insert into public.shift_reports(id, branch_id, work_date, shift, status, recon_status, cash_mode, ql_counted,
      opening_cash, ipos_opening, total_revenue, pos_cash, pos_transfer, pos_debt, cash_counted, reported_transfer)
  values (B, 1, '2026-11-10', 'Tối', 'hoan_thanh', 'chua', 'ca', 1300000, 1000000, 1000000, 500000, 300000, 200000, 0, 1300000, 200000);
  insert into public.fabi_stores(store_name, branch_id) values ('Cửa hàng thử 151', 1) on conflict do nothing;
  insert into public.bank_accounts(id, branch_id, account_no, active) values (991002, 1, 'thu-151', 1);
  insert into public.fabi_shifts(ma_ca, store_name, branch_id, work_date, shift, dau, net, tm, ck, no, report_id)
  values ('thu-151-B', 'Cửa hàng thử 151', 1, '2026-11-10', 'Tối', 1000000, 500000, 300000, 200000, 0, B);
  insert into public.bank_account_balances(report_id, account_id, opening, closing)
  select B, k.id, 0, case when k.id = 991002 then 200000 else 0 end from public.bank_accounts k where k.branch_id = 1 and k.active = 1;
  perform set_config('app.ca_auto', '1', true);
  foreach it in array public.app__ca_money_items() loop
    insert into public.shift_report_results(report_id, item, result, amount, by_account, at) values (B, it, 'khop', 0, chu.id, public.vn_now_text()) on conflict (report_id, item) do nothing;
  end loop;
  perform set_config('app.ca_auto', '', true);
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, B, 'bàn 3 anh Tí 151', 20000, chu.id, 'muon') returning id into d1;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, B, 'bàn 4 đã trả 151', 15000, chu.id, 'muon') returning id into d2;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = chu.id where id = d2;
  px := public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'Anh Tí 151', 'phone', '0933', 'grp', 'khach'));

  -- (12) ca đã xác nhận còn 1 nợ mới chưa xếp → thiếu mục xếp nhóm; khoản đã trả không tính
  miss := public.app__stc_ds_missing(B);
  select count(*) into n from unnest(miss) x where x like 'Còn 1 khoản nợ mới chưa xếp người + nhóm công nợ%';
  rep := rep || E'\n' || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' (12) ca còn 1 nợ mới chưa xếp: ' || array_to_string(miss, ' · ');

  -- (14) xếp cho người đã ngừng dùng / nhóm sai → lỗi
  begin perform public.app_stc_debt_sort(d1, pid, 'khac'); t := 'XẾP ĐƯỢC'; exception when others then t := sqlerrm; end;
  begin perform public.app_stc_debt_sort(d1, px, 'la'); g := 'XẾP ĐƯỢC'; exception when others then g := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%Chọn người nợ trong danh sách%' and g like '%Chọn nhóm công nợ%' then 'ĐẠT' else 'HỎNG' end || format(' (14) người đã ngừng dùng → %s · nhóm sai → %s', t, g);

  -- (15) xếp đúng: gắn người + nhóm + dấu đã xếp, tên theo danh sách, giữ lại chữ nhân viên gõ; hết thiếu
  perform public.app_stc_debt_sort(d1, px, 'khach');
  select * into s from public.shift_debts where id = d1;
  select count(*) into n from unnest(public.app__stc_ds_missing(B)) x where x like '%chưa xếp người + nhóm công nợ%';
  rep := rep || E'\n' || case when s.person_id = px and s.grp = 'khach' and s.sorted_at is not null and s.sorted_by = chu.id and s.table_name = 'Anh Tí 151'
        and s.content = 'bàn 3 anh Tí 151' and n = 0 then 'ĐẠT' else 'HỎNG' end
      || format(' (15) xếp: người %s · nhóm %s · đã xếp %s · tên "%s" · NV ghi "%s" · còn thiếu %s', s.person_id = px, s.grp, s.sorted_at is not null, s.table_name, s.content, n);

  -- (17b) phần còn thiếu khi khách trả nợ (rest_of) thừa hưởng người + dấu đã xếp của khoản gốc
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind, rest_of) values (1, B, 'Anh Tí 151', 5000, chu.id, 'muon', d1) returning id into d3;
  select d.person_id = px and d.sorted_at is not null into ok from public.shift_debts d where d.id = d3;
  rep := rep || E'\n' || case when ok then 'ĐẠT' else 'HỎNG' end || ' (17b) phần còn thiếu thừa hưởng người + đã xếp: ' || coalesce(ok::text, 'null');

  -- (16) nhân viên sửa lại tên khoản đã xếp → về chưa xếp, lại bị đòi xếp
  update public.shift_debts set table_name = 'tên khác 151' where id = d1;
  select * into s from public.shift_debts where id = d1;
  select count(*) into n from unnest(public.app__stc_ds_missing(B)) x where x like 'Còn 1 khoản nợ mới chưa xếp%';
  rep := rep || E'\n' || case when s.person_id is null and s.sorted_at is null and n = 1 then 'ĐẠT' else 'HỎNG' end
      || format(' (16) sửa tên sau khi xếp: còn gắn người %s · còn dấu đã xếp %s · bị đòi xếp lại %s', s.person_id is not null, s.sorted_at is not null, n);

  -- (17) khoản đã thu hết: xếp thì lỗi
  begin perform public.app_stc_debt_sort(d2, px, 'khach'); t := 'XẾP ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t like '%đã thu%' then 'ĐẠT' else 'HỎNG' end || ' (17) xếp khoản đã thu: ' || t;

  -- (17c) nợ tách kiểu cũ: khoản gốc đã thu, khoản con (split_from) chưa thu → vẫn bị đòi xếp; xếp khoản gốc thì khoản con nhận theo
  alter table public.shift_debts disable trigger debt_no_split;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind) values (1, B, 'bàn 9 tách cũ 151', 30000, chu.id, 'bill') returning id into d4;
  insert into public.shift_debts(branch_id, report_id, table_name, amount, created_by, kind, split_from) values (1, B, 'bàn 9 tách cũ 151', 10000, chu.id, 'bill', d4) returning id into cid;
  alter table public.shift_debts enable trigger debt_no_split;
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = chu.id where id = d4;
  select count(*) into n from unnest(public.app__stc_ds_missing(B)) x where x like 'Còn 2 khoản nợ mới chưa xếp%';
  perform public.app_stc_debt_sort(d4, px, 'khach');
  select d.person_id = px and d.table_name = 'Anh Tí 151' and d.sorted_at is not null into ok from public.shift_debts d where d.id = cid;
  select count(*) into n2 from unnest(public.app__stc_ds_missing(B)) x where x like 'Còn 1 khoản nợ mới chưa xếp%';
  rep := rep || E'\n' || case when n = 1 and ok and n2 = 1 then 'ĐẠT' else 'HỎNG' end || format(' (17c) nợ tách kiểu cũ: trước khi xếp bị đòi %s · khoản con nhận người %s · sau khi xếp còn đòi 1 khoản khác %s', n, ok, n2);

  -- (18) ca đã Hoàn thành đối soát → xếp bị chặn
  insert into public.stc_ca_done(report_id, by_account) values (B, chu.id);
  begin perform public.app_stc_debt_sort(d1, px, 'khach'); t := 'XẾP ĐƯỢC'; exception when others then t := sqlerrm; end;
  delete from public.stc_ca_done where report_id = B;
  rep := rep || E'\n' || case when t like '%Mở lại trước%' then 'ĐẠT' else 'HỎNG' end || ' (18) xếp khi ca đã Hoàn thành: ' || t;

  -- (19) sổ tháng: dòng "nợ mới" của ca có thêm 4 khoá
  perform public.app_stc_debt_sort(d1, px, 'khach');
  select x into j from jsonb_array_elements(public.app_stc_month(1, '2026-11') -> 'ca_debts') x where (x ->> 'id')::bigint = d1 and x ->> 't' = 'moi';
  rep := rep || E'\n' || case when j ? 'grp' and j ? 'person_id' and j ? 'sorted' and j ? 'content' and (j ->> 'sorted')::boolean and (j ->> 'person_id')::bigint = px
        and j ->> 'content' = 'tên khác 151' and j ->> 'who' = 'Anh Tí 151' then 'ĐẠT' else 'HỎNG' end || ' (19) sổ tháng › ca_debts: ' || coalesce(j::text, 'không thấy dòng');

  -- (20) tab Công nợ › đổi tên / nhóm cho cả các khoản của một người (app_cn_person_save) vẫn làm được như trước bước 172:
  --      tên mới chưa có → người đang gắn với các khoản được đổi tên theo (giữ nguyên mã người), cả khoản đã thu lẫn chưa thu
  px := public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'Chú Ba 151', 'grp', 'khac'));
  d1 := public.app_cn_debt_save(null, jsonb_build_object('branch_id', 1, 'name', 'Chú Ba 151', 'amount', 11000, 'kind', 'muon', 'grp', 'khac'));
  d2 := public.app_cn_debt_save(null, jsonb_build_object('branch_id', 1, 'name', 'Chú Ba 151', 'amount', 12000, 'kind', 'muon', 'grp', 'khac'));
  update public.shift_debts set closed_at = public.vn_now_text(), closed_by = chu.id where id = d2;
  begin n := public.app_cn_person_save(array[d1, d2], 'Chú Ba Sáu 151', '0977151', 'khac'); t := 'đổi được ' || n || ' khoản';
  exception when others then t := 'BỊ CHẶN: ' || sqlerrm; end;
  select count(*) into n2 from public.debt_people where branch_id = 1 and name = 'Chú Ba Sáu 151' and id = px and phone = '0977151';
  select count(*) into n from public.shift_debts where id in (d1, d2) and table_name = 'Chú Ba Sáu 151' and person_id = px;
  rep := rep || E'\n' || case when t = 'đổi được 2 khoản' and n2 = 1 and n = 2 and not exists (select 1 from public.debt_people where branch_id = 1 and name = 'Chú Ba 151') then 'ĐẠT' else 'HỎNG' end
      || format(' (20) Công nợ đổi tên người: %s · người cũ được đổi tên (giữ mã) %s · 2 khoản mang tên mới, đúng người %s', t, n2, n);
  -- (20b) đổi sang tên một người đã có → các khoản về người đó (gộp), nhóm theo lựa chọn
  begin n := public.app_cn_person_save(array[d1], 'Anh Tí 151', '', 'khach'); t := 'đổi được';
  exception when others then t := 'BỊ CHẶN: ' || sqlerrm; end;
  select (person_id = (select id from public.debt_people where branch_id = 1 and name = 'Anh Tí 151')) and grp = 'khach' into ok from public.shift_debts where id = d1;
  rep := rep || E'\n' || case when t = 'đổi được' and ok then 'ĐẠT' else 'HỎNG' end || format(' (20b) Công nợ đổi sang tên người đã có: %s · khoản về đúng người + nhóm %s', t, ok);

  -- (10) nhân viên không vào được Sổ thu chi: xem / sửa danh sách đều bị từ chối
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_people(1); t := 'XEM ĐƯỢC';
  exception when others then t := sqlerrm; end;
  begin perform public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'NV thêm 151', 'grp', 'khach')); g := 'THÊM ĐƯỢC';
  exception when others then g := sqlerrm; end;
  rep := rep || E'\n' || case when t <> 'XEM ĐƯỢC' and g <> 'THÊM ĐƯỢC' then 'ĐẠT' else 'HỎNG' end || format(' (10) nhân viên: xem → %s · thêm → %s', t, g);

  -- (13) nhân viên không xếp nhóm công nợ được
  begin perform public.app_stc_debt_sort(d1, px, 'khach'); t := 'XẾP ĐƯỢC'; exception when others then t := sqlerrm; end;
  rep := rep || E'\n' || case when t <> 'XẾP ĐƯỢC' and t not like '%does not exist%' then 'ĐẠT' else 'HỎNG' end || ' (13) nhân viên xếp nhóm: ' || t;

  raise exception 'REPORT>> %', rep;
end $$;
