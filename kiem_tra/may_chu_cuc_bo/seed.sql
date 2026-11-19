-- Dữ liệu giả tối thiểu cho CSDL thử cục bộ (KHÔNG phải dữ liệu thật). Chạy sau dung_csdl.py.
-- (thêm nhân viên có thể tự tạo tài khoản → tài khoản ghi đè theo employee_id; tìm tài khoản theo login_name (id tài khoản không cố định))
-- 3 cơ sở, 6 người: Chủ (A1), QL tổng (A2), QL cơ sở 1 (A3), QL cơ sở 2 (A4), NV cấp 1 (A5), NV mới (A6), Kế toán (A7).
insert into public.branches(id, code, name, display_code, status, sort_order) values
  (1, 'CS1', 'Cơ sở 1', 'CS1', 'Đang hoạt động', 1), (2, 'CS2', 'Cơ sở 2', 'CS2', 'Đang hoạt động', 2), (3, 'CS3', 'Cơ sở 3', 'CS3', 'Đang hoạt động', 3)
on conflict (id) do nothing;
insert into public.employees(id, code, name, rank, status) values
  (1, 'E1', 'Chủ Thử', 'Quản lý', 'Đang làm'), (2, 'E2', 'QLT Thử', 'Quản lý', 'Đang làm'), (3, 'E3', 'QL Một', 'Quản lý', 'Đang làm'),
  (4, 'E4', 'QL Hai', 'Quản lý', 'Đang làm'), (5, 'E5', 'NV Cấp Một', 'Cấp 1', 'Đang làm'), (6, 'E6', 'NV Mới', 'Thử việc', 'Đang làm'), (7, 'E7', 'KT Thử', 'Kế toán', 'Đang làm')
on conflict (id) do nothing;
insert into public.employee_branches(employee_id, branch_id) values (3, 1), (4, 2), (5, 1), (6, 1), (2, 1), (2, 2) on conflict do nothing;
insert into public.accounts(id, login_name, employee_id, system_role, auth_user_id, locked) values
  (1, 'chu', 1, 'chu', '00000000-0000-0000-0000-000000000001', 0), (2, 'qlt', 2, 'ql_tong', '00000000-0000-0000-0000-000000000002', 0),
  (3, 'ql1', 3, 'ql', '00000000-0000-0000-0000-000000000003', 0), (4, 'ql2', 4, 'ql', '00000000-0000-0000-0000-000000000004', 0),
  (5, 'nv1', 5, 'nv', '00000000-0000-0000-0000-000000000005', 0), (6, 'nv6', 6, 'nv', '00000000-0000-0000-0000-000000000006', 0),
  (7, 'kt', 7, 'ke_toan', '00000000-0000-0000-0000-000000000007', 0)
on conflict (employee_id) do update set login_name = excluded.login_name, system_role = excluded.system_role, auth_user_id = excluded.auth_user_id, locked = 0;
-- đăng nhập trong bài thử: perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000N', 'role', 'authenticated')::text, true);
insert into public.shifts(id, code, name, sort_order) values (1, 'S', 'Sáng', 1), (2, 'C', 'Chiều', 2), (3, 'T', 'Tối', 3) on conflict (id) do nothing;
-- dời bộ đếm id sau khi chèn id cố định (để bài thử chèn thêm người / ca không trùng id)
select setval(pg_get_serial_sequence('public.branches', 'id'), (select max(id) from public.branches));
select setval(pg_get_serial_sequence('public.employees', 'id'), (select max(id) from public.employees));
select setval(pg_get_serial_sequence('public.accounts', 'id'), (select max(id) from public.accounts));
select setval(pg_get_serial_sequence('public.shifts', 'id'), (select max(id) from public.shifts));
