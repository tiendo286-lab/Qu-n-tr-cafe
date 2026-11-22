-- Chặng 3 (anh Tiến chốt 22/11/2026): sửa 2 khoản dữ liệu thật. Chạy MỘT lần (nếu chưa có trong app_migrations), và chỉ sửa khi dữ liệu còn đúng như cũ.
--  1) Nợ bàn 5 — Đông Khê ca Sáng 01/11 (phiếu 60). Khách nợ nhưng nhân viên bấm "đã trả chuyển khoản" trên Fabi, rồi ghi nợ HAI lần, cả hai sai:
--     "Khách mượn tiền mặt 28.000" (két thật không hụt) + khoản chi chuyển khoản 26.000 ghi chú "khách nợ" (nợ bị ghi thành chi phí).
--     Anh chốt: một khoản Nợ chuyển khoản 28.000 (khách vẫn còn nợ). Sửa bằng đúng hàm web dùng: app_stc_move_save (xoá khoản chi 26.000)
--     + app_stc_ca_debt_save (đổi "khách mượn" → "nợ chuyển khoản", giữ 28.000). Đo khi chạy thử: tiền mặt thừa 39.000 → 11.000, chuyển khoản 0 → thừa 2.000
--     → quản lý xử lý ở bước Chênh lệch như ca thường.
--  2) "Test công nợ" 73.000 — LHP ca Sáng 04/11 (phiếu 59, nợ hoá đơn). Máy Fabi ghi ca nợ 101.000 = 73.000 + 28.000 → khoản nợ thật bị đặt tên thử.
--     Anh chốt: giữ khoản, đổi tên thành "Khách không rõ (04/11)" (người nợ + khoản nợ chưa thu, qua app_stc_person_save). Không đổi tiền.
--  Chạy bằng vai Chủ để đi qua đúng kiểm tra quyền và ghi lịch sử như khi bấm trên web. Không có tên người thật trong tệp.
-- Bài thử: kiem_tra/sua_du_lieu_161_cuc_bo.sql (Postgres cục bộ).

create or replace function public.app__sua_du_lieu_161() returns int
language plpgsql security definer set search_path = public as $$
declare chu public.accounts; mk text; n int := 0; pp public.debt_people;
  rs text := 'Anh Tiến chốt 22/11 (chặng 3): nợ bàn 5 bị ghi 2 lần (khách mượn TM 28.000 + chi CK 26.000) — đúng là 1 khoản nợ chuyển khoản 28.000';
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  if chu.id is null then return 0; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  -- 1a) khoản chi chuyển khoản 26.000 "khách nợ" của phiếu 60 (Đông Khê, 01/11, Sáng)
  select m.mkey into mk from public.shift_reports r join public.branches b on b.id = r.branch_id
    cross join lateral public.app__tc_moves_x(r.branch_id, r.work_date, r.work_date) m
   where r.id = 60 and coalesce(b.display_code, b.code) in ('ĐK', 'DK') and r.work_date = '2026-11-01' and r.shift = 'Sáng'
     and m.report_id = 60 and m.pay = 'chuyen_khoan' and m.amount = -26000 and m.note = 'khách nợ' and m.auto is null
   limit 1;
  if mk is not null then perform public.app_stc_move_save(60, mk, '{"delete": true}'::jsonb, rs); n := n + 1; end if;
  -- 1b) "khách mượn tiền mặt" 28.000 → "nợ chuyển khoản" 28.000
  if exists (select 1 from public.shift_debts d join public.shift_reports r on r.id = d.report_id join public.branches b on b.id = r.branch_id
              where d.id = 22 and d.report_id = 60 and d.kind = 'muon' and d.amount = 28000 and d.closed_at is null
                and coalesce(b.display_code, b.code) in ('ĐK', 'DK') and r.work_date = '2026-11-01') then
    perform public.app_stc_ca_debt_save(60, 22, '{"kind": "ck", "amount": "28000"}'::jsonb, rs); n := n + 1;
  end if;
  -- 2) "Test công nợ" → "Khách không rõ (04/11)"
  select p.* into pp from public.debt_people p join public.branches b on b.id = p.branch_id
   where p.id = 16 and p.name = 'Test công nợ' and coalesce(b.display_code, b.code) = 'LHP';
  if pp.id is not null and exists (select 1 from public.shift_debts d where d.id = 20 and d.person_id = 16 and d.report_id = 59 and d.amount = 73000) then
    perform public.app_stc_person_save(16, jsonb_build_object('name', 'Khách không rõ (04/11)', 'phone', pp.phone, 'grp', pp.grp, 'active', pp.active));
    n := n + 1;
  end if;
  return n;
end $$;

revoke all on function public.app__sua_du_lieu_161() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from public.app_migrations where file = '161_sua_no_ban5_test_cong_no.sql') then
    perform public.app__sua_du_lieu_161();
  end if;
end $$;

insert into public.app_migrations(file) values ('161_sua_no_ban5_test_cong_no.sql') on conflict (file) do nothing;
