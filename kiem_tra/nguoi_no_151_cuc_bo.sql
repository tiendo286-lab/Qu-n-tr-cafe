-- Bài thử CỤC BỘ cho supabase/151_nguoi_no.sql (bước 172 đợt B) — chạy trên Postgres cục bộ (kiem_tra/may_chu_cuc_bo/), KHÔNG cần máy chủ thật.
-- Tự dựng dữ liệu giả ở cơ sở 1, đăng nhập giả là Chủ / nhân viên của seed.sql. REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/nguoi_no_151_cuc_bo.sql
-- Bài trên dữ liệu thật (tự hoàn tác): kiem_tra/nguoi_no_151.sql.
do $$
declare chu public.accounts; nv public.accounts; rep text := ''; j jsonb; n int; n2 int; pid bigint; pid2 bigint; did bigint; cid bigint; t text; g text; ok boolean;
  A constant bigint := 991001;
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

  -- (10) nhân viên không vào được Sổ thu chi: xem / sửa danh sách đều bị từ chối
  perform set_config('request.jwt.claims', json_build_object('sub', nv.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_stc_people(1); t := 'XEM ĐƯỢC';
  exception when others then t := sqlerrm; end;
  begin perform public.app_stc_person_save(null, jsonb_build_object('branch_id', 1, 'name', 'NV thêm 151', 'grp', 'khach')); g := 'THÊM ĐƯỢC';
  exception when others then g := sqlerrm; end;
  rep := rep || E'\n' || case when t <> 'XEM ĐƯỢC' and g <> 'THÊM ĐƯỢC' then 'ĐẠT' else 'HỎNG' end || format(' (10) nhân viên: xem → %s · thêm → %s', t, g);

  raise exception 'REPORT>> %', rep;
end $$;
