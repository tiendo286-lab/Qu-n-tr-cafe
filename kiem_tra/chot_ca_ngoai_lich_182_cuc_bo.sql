-- Bài thử cho supabase/182_chot_ca_ngoai_lich.sql (việc #11, anh Tiến chốt cách A 26/11/2026):
-- nhân viên KHÔNG có tên trong ca vẫn nhận được phần CHƯA AI NHẬN; không giành được phần người khác đang làm.
-- Dữ liệu giả (phiếu 997001), REPORT>> tự hoàn tác. Chạy trên Postgres cục bộ:
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/chot_ca_ngoai_lich_182_cuc_bo.sql
do $$
declare rep text := ''; msg text; n int; P constant bigint := 997001; ok boolean; j jsonb;
  NV1 constant text := '00000000-0000-0000-0000-000000000005';  -- có tên trong ca
  NV6 constant text := '00000000-0000-0000-0000-000000000006';  -- KHÔNG có tên trong ca (quản lý chưa đổi kịp lịch)
  QL1 constant text := '00000000-0000-0000-0000-000000000003';
  a6 bigint; a1 bigint;
begin
  select id into a6 from public.accounts where login_name = 'nv6';
  select id into a1 from public.accounts where login_name = 'nv1';
  insert into public.shift_reports(id, branch_id, work_date, shift, status) values (P, 1, '2026-10-10', 'Sáng', 'dang_chot');
  insert into public.shift_report_staff(report_id, employee_id, source) values (P, 5, 'lich');

  -- (1) người ngoài lịch thấy can_claim = false (nút "Nhận lại" ẩn) nhưng vẫn nhận được phần chưa ai nhận
  perform set_config('request.jwt.claims', json_build_object('sub', NV6, 'role', 'authenticated')::text, true);
  j := public.app_ca_parts(P);
  begin perform public.app_ca_part_claim(P, 'tien', false); msg := 'nhận được'; exception when others then msg := sqlerrm; end;
  select count(*) into n from public.shift_report_parts where report_id = P and part = 'tien' and claimed_by = a6;
  rep := rep || E'\n' || case when msg = 'nhận được' and n = 1 and (j ->> 'can_claim') = 'false' then 'ĐẠT' else 'HỎNG' end
        || format(' (1) người ngoài lịch nhận phần Tiền chưa ai nhận → %s (can_claim=%s)', msg, j ->> 'can_claim');

  -- (2) nhật ký ghi "(ngoài lịch)"
  select count(*) into n from public.audit_log where action = 'nhan_phan_ca' and detail = 'report=' || P || ' tien (ngoài lịch)';
  rep := rep || E'\n' || case when n = 1 then 'ĐẠT' else 'HỎNG' end || ' (2) nhật ký ghi "(ngoài lịch)": ' || n || ' dòng';

  -- (3) người ngoài lịch đang nhận phần Tiền → tải được ảnh phiếu Fabi; phần Nhận hàng chưa nhận → không
  ok := public.app__storage_ca_upload('r' || P || '/ipos/a.jpg');
  rep := rep || E'\n' || case when ok and not public.app__storage_ca_upload('r' || P || '/hang/a.jpg') then 'ĐẠT' else 'HỎNG' end
        || ' (3) tải ảnh Fabi: ' || ok;

  -- (4) người khác (có tên trong ca) không tải ảnh vào phần người ngoài lịch đang nhận
  perform set_config('request.jwt.claims', json_build_object('sub', NV1, 'role', 'authenticated')::text, true);
  ok := public.app__storage_ca_upload('r' || P || '/ipos/b.jpg');
  rep := rep || E'\n' || case when not ok then 'ĐẠT' else 'HỎNG' end || ' (4) người không nhận phần tải ảnh Fabi: ' || ok;

  -- (5) bấm nhận thường khi đã có người → chặn như cũ
  begin perform public.app_ca_part_claim(P, 'tien', false); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%đã có%nhận%' then 'ĐẠT' else 'HỎNG' end || ' (5) nhận thường phần đã có người → ' || msg;

  -- (6) người có tên trong ca vẫn "Nhận lại" được từ người ngoài lịch
  begin perform public.app_ca_part_claim(P, 'tien', true); msg := 'nhận được'; exception when others then msg := sqlerrm; end;
  select count(*) into n from public.shift_report_parts where report_id = P and part = 'tien' and claimed_by = a1;
  rep := rep || E'\n' || case when msg = 'nhận được' and n = 1 then 'ĐẠT' else 'HỎNG' end || ' (6) người có tên trong ca nhận lại → ' || msg;

  -- (7) cách A: người ngoài lịch KHÔNG giành lại được phần người khác đang làm
  perform set_config('request.jwt.claims', json_build_object('sub', NV6, 'role', 'authenticated')::text, true);
  begin perform public.app_ca_part_claim(P, 'tien', true); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  select count(*) into n from public.shift_report_parts where report_id = P and part = 'tien' and claimed_by = a1;
  rep := rep || E'\n' || case when msg like '%Chỉ nhân viên có tên trong ca%' and n = 1 then 'ĐẠT' else 'HỎNG' end || ' (7) người ngoài lịch giành phần → ' || msg;

  -- (8) người ngoài lịch mất phần thì cũng mất quyền tải ảnh
  ok := public.app__storage_ca_upload('r' || P || '/ipos/c.jpg');
  rep := rep || E'\n' || case when not ok then 'ĐẠT' else 'HỎNG' end || ' (8) hết nhận phần → tải ảnh: ' || ok;

  -- (9) quản lý nhận lại được như cũ
  perform set_config('request.jwt.claims', json_build_object('sub', QL1, 'role', 'authenticated')::text, true);
  begin perform public.app_ca_part_claim(P, 'tien', true); msg := 'nhận được'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg = 'nhận được' then 'ĐẠT' else 'HỎNG' end || ' (9) quản lý nhận lại → ' || msg;

  -- (10) phiếu đã hoàn thành → chặn như cũ
  update public.shift_reports set status = 'hoan_thanh' where id = P;
  perform set_config('request.jwt.claims', json_build_object('sub', NV6, 'role', 'authenticated')::text, true);
  begin perform public.app_ca_part_claim(P, 'nhan_su', false); msg := 'không chặn'; exception when others then msg := sqlerrm; end;
  rep := rep || E'\n' || case when msg like '%đã hoàn thành%' then 'ĐẠT' else 'HỎNG' end || ' (10) phiếu đã hoàn thành → ' || msg;

  raise exception 'REPORT>> %', rep;
end $$;
