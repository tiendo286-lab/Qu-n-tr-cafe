-- Bài thử cho supabase/146_hang_hoa_loc_ngay.sql (bước 167). Gửi SAU tệp 146. Tự tạo dữ liệu giả rồi REPORT>> tự hoàn tác.
-- Chạy được cả trên CSDL thử cục bộ (kiem_tra/may_chu_cuc_bo) lẫn máy chủ thật (mọi thứ hoàn lại khi báo REPORT).
do $$
declare chu public.accounts; br bigint; a bigint; b bigint; c bigint; f bigint; j jsonb; k jsonb; n int := 0; ids text; e text;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  select id into br from public.branches where status = 'Đang hoạt động' order by sort_order, id limit 1;
  -- 3 lần giao giả ở năm 2031 (không trùng dữ liệu thật)
  insert into public.delivery_invoices(branch_id, work_date, doc_no, state, received_at, received_date, recon_at, deliv_path)
    values (br, '2031-10-28', 'T146-A', 'da_nhan', '2031-11-02 09:00:00', '2031-11-02', '2031-11-03 10:00:00', 'x/a.jpg') returning id into a;
  insert into public.delivery_invoices(branch_id, work_date, doc_no, state, received_at, received_date)
    values (br, '2031-11-05', 'T146-B', 'da_nhan', '2031-11-05 08:00:00', '2031-11-05') returning id into b;
  insert into public.delivery_invoices(branch_id, work_date, doc_no, state) values (br, '2031-11-20', 'T146-C', 'dang_chuyen') returning id into c;
  insert into public.delivery_followups(branch_id, invoice_id, kind, name, qty, status, created_at, resolved_at, resolved_month, resolved_ref, resolved_amount)
    values (br, a, 'hd_bs', 'Món thử', 1, 'xong', '2031-11-03 10:00:00', '2031-11-10 09:00:00', '2031-11', 'HĐ1', 1000) returning id into f;

  -- 1. cách gọi cũ (2 tham số): theo tháng ngày giao như trước
  j := public.app_nh_list('2031-11', br);
  select string_agg(x ->> 'doc_no', ',' order by x ->> 'doc_no') into ids from jsonb_array_elements(j -> 'rows') x where x ->> 'doc_no' like 'T146-%';
  if ids is distinct from 'T146-B,T146-C' then raise exception 'SAI 1: gọi kiểu cũ tháng 11 phải ra B,C — ra %', ids; end if; n := n + 1;
  -- 2. lọc Ngày nhận cả tháng 11 → A, B (C chưa nhận)
  j := public.app_nh_list(null, br, '2031-11-01', '2031-11-30', 'nhan');
  select string_agg(x ->> 'doc_no', ',' order by x ->> 'doc_no') into ids from jsonb_array_elements(j -> 'rows') x where x ->> 'doc_no' like 'T146-%';
  if ids is distinct from 'T146-A,T146-B' then raise exception 'SAI 2: Ngày nhận tháng 11 phải ra A,B — ra %', ids; end if; n := n + 1;
  -- 3. Ngày đối soát 03/11 → chỉ A
  j := public.app_nh_list(null, br, '2031-11-03', '2031-11-03', 'ds');
  select string_agg(x ->> 'doc_no', ',') into ids from jsonb_array_elements(j -> 'rows') x where x ->> 'doc_no' like 'T146-%';
  if ids is distinct from 'T146-A' then raise exception 'SAI 3: Ngày đối soát 03/11 phải ra A — ra %', ids; end if; n := n + 1;
  -- 4. Ngày giao 25/10–05/11 → B trên A (mới nhất trên)
  j := public.app_nh_list(null, br, '2031-10-25', '2031-11-05', 'giao');
  select string_agg(x ->> 'doc_no', ',' order by o) into ids from jsonb_array_elements(j -> 'rows') with ordinality t(x, o) where x ->> 'doc_no' like 'T146-%';
  if ids is distinct from 'T146-B,T146-A' then raise exception 'SAI 4: Ngày giao 25/10–05/11 phải ra B,A — ra %', ids; end if; n := n + 1;
  -- 5. khoảng ngày hỏng bị chặn
  begin perform public.app_nh_list(null, br, '2031-11-10', '2031-11-01', 'giao'); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 5: từ > đến không bị chặn'; end if; end; n := n + 1;
  begin perform public.app_nh_list(null, br, '2031-11-01', '2031-11-02', 'abc'); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 5b: loại ngày lạ không bị chặn'; end if; end; n := n + 1;

  -- 6. Kiểm soát: gọi kiểu cũ — Đã xử lý theo tháng xử lý (11) có mục f
  j := public.app_gh_control(br, '2031-11');
  if not exists (select 1 from jsonb_array_elements(j -> 'done') x where (x ->> 'id')::bigint = f) then raise exception 'SAI 6: gọi kiểu cũ thiếu mục đã xử lý'; end if; n := n + 1;
  -- 7. lọc Ngày giao tháng 11 → mục f (giao 28/10) không có; Ngày đối soát tháng 11 → có
  k := public.app_gh_control(br, '2031-11', '2031-11-01', '2031-11-30', 'giao');
  if exists (select 1 from jsonb_array_elements(k -> 'done') x where (x ->> 'id')::bigint = f) then raise exception 'SAI 7a: lọc Ngày giao tháng 11 vẫn có mục giao 28/10'; end if; n := n + 1;
  k := public.app_gh_control(br, '2031-11', '2031-11-01', '2031-11-30', 'ds');
  if not exists (select 1 from jsonb_array_elements(k -> 'done') x where (x ->> 'id')::bigint = f) then raise exception 'SAI 7b: lọc Ngày đối soát tháng 11 thiếu mục'; end if; n := n + 1;
  -- 8. tiền tháng không đổi khi lọc khoảng ngày
  if (j -> 'money') is distinct from (k -> 'money') then raise exception 'SAI 8: tiền tháng đổi khi lọc: % / %', j -> 'money', k -> 'money'; end if; n := n + 1;
  -- 9. mục có ngày nhận / ngày đối soát
  select x into k from jsonb_array_elements(j -> 'done') x where (x ->> 'id')::bigint = f;
  if k ->> 'received_date' is distinct from '2031-11-02' or k ->> 'recon_date' is distinct from '2031-11-03' or k ->> 'work_date' is distinct from '2031-10-28' then
    raise exception 'SAI 9: ngày của mục Kiểm soát: %', k; end if; n := n + 1;
  -- 10. người không có quyền bị chặn
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from public.accounts where system_role = 'nv' and auth_user_id is not null and locked = 0 limit 1), 'role', 'authenticated')::text, true);
  begin perform public.app_nh_list(null, br, '2031-11-01', '2031-11-30', 'giao'); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 10: nhân viên xem được danh sách'; end if; end; n := n + 1;

  raise exception 'REPORT>> ĐẠT % kiểm tra (tệp 146)', n;
end $$;
