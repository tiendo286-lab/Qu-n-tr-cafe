-- Bài thử tệp 144 (giờ chốt theo file Fabi + sửa tay). Gửi CÙNG LẦN sau nội dung 144 (chạy 2 lần).
-- Tự hoàn tác: cuối khối RAISE EXCEPTION 'REPORT>> ...'. Dữ liệu: cơ sở 4 ngày 17/11 (bỏ file Fabi trong khối) và cơ sở 2 ngày 17/11 (có file Fabi).
do $$
declare
  rep text := '';
  a_chu bigint; a_ql bigint; a_ql2 bigint; a_nv bigint;
  s4 bigint := 273; c4 bigint := 303; t4 bigint := 343;      -- cơ sở 4, 17/11
  s2 bigint := 274; c2 bigint := 304; t2 bigint := 342;      -- cơ sở 2, 17/11
  m0 jsonb; m1 jsonb; d0 jsonb; d1 jsonb; j jsonb; n int; n2 int; tr public.shift_reports; ma text;
begin
  select id into a_chu from accounts where system_role = 'chu' and locked = 0 order by id limit 1;
  a_ql := 6;   -- quản lý được giao cơ sở 4
  a_ql2 := 7;  -- quản lý cơ sở 2, 3 (không phải cơ sở 4)
  select a.id into a_nv from accounts a join employees e on e.id = a.employee_id where a.system_role = 'nv' and a.locked = 0 and e.status = 'Đang làm' order by a.id limit 1;

  delete from fabi_shifts where branch_id = 4 and work_date = '2026-11-17';   -- ca không có file

  -- (a) QL được giao, Sáng không file, sửa tay +10 phút
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_ql), 'role', 'authenticated')::text, true);
  m0 := jsonb_build_array(public.app__ca_money(s4), public.app__ca_money(c4));
  d0 := jsonb_build_array(public.app__stc_ds_state(s4) - 'exp' - 'prev', public.app__stc_ds_state(c4) - 'exp' - 'prev');
  begin
    j := public.app_ca_gio_save(s4, '2026-11-17 12:33', 'nhập nhầm');
    m1 := jsonb_build_array(public.app__ca_money(s4), public.app__ca_money(c4));
    d1 := jsonb_build_array(public.app__stc_ds_state(s4) - 'exp' - 'prev', public.app__stc_ds_state(c4) - 'exp' - 'prev');
    rep := rep || format(E'\n(a) end=%s next_start=%s money_same=%s state_same=%s ret=%s',
      public.app__ca_eff(s4) ->> 'rev_end', public.app__ca_eff(c4) ->> 'rev_start', m0 = m1, d0 = d1, j);
  exception when others then rep := rep || E'\n(a) LỖI: ' || sqlerrm; end;

  -- (b) Chiều đã Xác nhận Fabi, sửa tay
  begin
    j := public.app_ca_gio_save(c4, '2026-11-17 17:31', 'chốt bổ sung');
    rep := rep || format(E'\n(b) end=%s toi_start=%s thoi_gian_con=%s done=%s',
      public.app__ca_eff(c4) ->> 'rev_end', public.app__ca_eff(t4) ->> 'rev_start',
      exists (select 1 from shift_report_checks where report_id = c4 and item = 'thoi_gian'), public.app__stc_ds_state(c4) ->> 'done');
  exception when others then rep := rep || E'\n(b) LỖI: ' || sqlerrm; end;

  -- (c) QL cơ sở khác + nhân viên
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_ql2), 'role', 'authenticated')::text, true);
  begin perform public.app_ca_gio_save(s4, '2026-11-17 12:40', 'x'); rep := rep || E'\n(c) QL khác: KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(c) QL khác chặn: ' || sqlerrm; end;
  begin j := public.app_ca_gio(s4); rep := rep || E'\n(c) QL khác đọc: can_edit=' || coalesce(j ->> 'can_edit', 'null');
  exception when others then rep := rep || E'\n(c) QL khác đọc bị chặn: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_nv), 'role', 'authenticated')::text, true);
  begin perform public.app_ca_gio_save(s4, '2026-11-17 12:40', 'x'); rep := rep || E'\n(c) NV: KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(c) NV chặn: ' || sqlerrm; end;

  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_ql), 'role', 'authenticated')::text, true);
  -- (d) lý do trống
  begin perform public.app_ca_gio_save(s4, '2026-11-17 12:40', '  '); rep := rep || E'\n(d) KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(d) ' || sqlerrm; end;
  -- (e) bằng giờ bắt đầu
  begin perform public.app_ca_gio_save(s4, '2026-11-17 06:45', 'x'); rep := rep || E'\n(e) KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(e) ' || sqlerrm; end;
  -- (f) Sáng ≥ giờ chốt Chiều; Tối qua nửa đêm
  begin perform public.app_ca_gio_save(s4, '2026-11-17 17:31', 'x'); rep := rep || E'\n(f) KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(f) ' || sqlerrm; end;
  begin j := public.app_ca_gio_save(t4, '2026-11-18 00:30', 'đóng muộn');
    rep := rep || format(E'\n(f) Tối end=%s next=%s', public.app__ca_eff(t4) ->> 'rev_end', coalesce(j ->> 'next', 'null'));
  exception when others then rep := rep || E'\n(f) Tối LỖI: ' || sqlerrm; end;
  -- (g) tháng đã chốt
  insert into fin_month_closes(branch_id, month) values (4, '2026-11');
  begin perform public.app_ca_gio_save(s4, '2026-11-17 12:40', 'x'); rep := rep || E'\n(g) KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(g) ' || sqlerrm; end;
  delete from fin_month_closes where branch_id = 4 and month = '2026-11';
  -- (h) ca sau chưa gửi phiếu
  update shift_reports set status = 'dang_chot' where id = t4;
  select count(*) into n from shift_recon_log where report_id = t4 and action = 'sua_gio_theo';
  begin perform public.app_ca_gio_save(c4, '2026-11-17 17:41', 'x');
    select count(*) into n2 from shift_recon_log where report_id = t4 and action = 'sua_gio_theo';
    select * into tr from shift_reports where id = t4;
    rep := rep || format(E'\n(h) log_toi_tang=%s forced_start=%s', n2 - n, public.app__ca_forced_start(tr));
  exception when others then rep := rep || E'\n(h) LỖI: ' || sqlerrm; end;
  update shift_reports set status = 'hoan_thanh' where id = t4;
  -- (i) lịch sử của lần (a)
  rep := rep || format(E'\n(i) log_sang=%s log_chieu_theo=%s', (select count(*) from shift_recon_log where report_id = s4 and action = 'sua_gio'),
    (select count(*) from shift_recon_log where report_id = c4 and action = 'sua_gio_theo'));
  begin j := public.app_ca_gio(s4); rep := rep || format(E'\n(i) app_ca_gio log=%s can_edit=%s by_fabi=%s', jsonb_array_length(j -> 'log'), j ->> 'can_edit', j ->> 'by_fabi');
  exception when others then rep := rep || E'\n(i) LỖI: ' || sqlerrm; end;
  -- (j) sai dạng
  begin perform public.app_ca_gio_save(s4, 'abc', 'x'); rep := rep || E'\n(j) KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(j) ' || sqlerrm; end;

  -- (p) lối riêng cho giờ KHÔNG mở đường sửa tiền: đang chờ kế toán, đặt app.ca_gio rồi sửa doanh thu → phải bị chặn
  perform set_config('app.ca_gio', s4::text, true);
  begin update shift_report_recon set data = data || '{"total_revenue": 1}'::jsonb where report_id = s4; get diagnostics n = row_count;
    rep := rep || E'\n(p) KHÔNG CHẶN sửa tiền, số dòng=' || n;
  exception when others then rep := rep || E'\n(p) chặn sửa tiền: ' || left(sqlerrm, 40); end;
  perform set_config('app.ca_gio', '', true);

  -- ===== Có file Fabi: cơ sở 2, QL 7 được giao
  perform set_config('request.jwt.claims', json_build_object('sub', (select auth_user_id from accounts where id = a_ql2), 'role', 'authenticated')::text, true);
  -- (k) có file: Chiều by_fabi, không sửa tay được
  begin j := public.app_ca_gio(c2); rep := rep || format(E'\n(k) by_fabi=%s can_edit=%s fabi_close=%s', j ->> 'by_fabi', j ->> 'can_edit', j ->> 'fabi_close');
  exception when others then rep := rep || E'\n(k) đọc LỖI: ' || sqlerrm; end;
  begin perform public.app_ca_gio_save(c2, '2026-11-17 17:50', 'x'); rep := rep || E'\n(k) KHÔNG CHẶN';
  exception when others then rep := rep || E'\n(k) ' || sqlerrm; end;
  -- (l) nhân viên gửi phiếu khi đã có file: giả lập bước cuối của gửi phiếu (app__ca_finish → app__fabi_apply_report)
  update shift_reports set rev_end = '2026-11-17 12:00' where id = s2;
  delete from shift_report_recon where report_id = s2;
  begin perform public.app__fabi_apply_report(s2);
    rep := rep || format(E'\n(l) sang_end=%s (file 12:43)', public.app__ca_eff(s2) ->> 'rev_end');
  exception when others then rep := rep || E'\n(l) LỖI: ' || sqlerrm; end;
  -- (m) kế toán tải lại file với giờ khác
  select ma_ca into ma from fabi_shifts where branch_id = 2 and work_date = '2026-11-17' and shift = 'Chiều';
  update fabi_shifts set close_at = '2026-11-17 17:50' where ma_ca = ma;
  select count(*) into n from shift_recon_log where report_id = c2 and action = 'gio_fabi';
  begin perform public.app__fabi_apply(ma);
    select count(*) into n2 from shift_recon_log where report_id = c2 and action = 'gio_fabi';
    rep := rep || format(E'\n(m) chieu_end=%s toi_start=%s log_tang=%s', public.app__ca_eff(c2) ->> 'rev_end', public.app__ca_eff(t2) ->> 'rev_start', n2 - n);
    perform public.app__fabi_apply(ma);
    select count(*) into n from shift_recon_log where report_id = c2 and action = 'gio_fabi';
    rep := rep || format(' lan2_tang=%s', n - n2);
  exception when others then rep := rep || E'\n(m) LỖI: ' || sqlerrm; end;
  -- (n) giờ file vô lý (Sáng ≥ giờ chốt Chiều) → không áp, fabi_bad, sửa tay được
  select ma_ca into ma from fabi_shifts where branch_id = 2 and work_date = '2026-11-17' and shift = 'Sáng';
  update fabi_shifts set close_at = '2026-11-17 18:00' where ma_ca = ma;
  begin perform public.app__fabi_apply(ma); j := public.app_ca_gio(s2);
    rep := rep || format(E'\n(n) sang_end=%s fabi_bad=%s by_fabi=%s can_edit=%s', public.app__ca_eff(s2) ->> 'rev_end', j ->> 'fabi_bad', j ->> 'by_fabi', j ->> 'can_edit');
  exception when others then rep := rep || E'\n(n) LỖI: ' || sqlerrm; end;
  -- (o) danh sách chạy bù
  begin j := public.app__ca_gio_fabi_all(true);
    rep := rep || format(E'\n(o) so_ca=%s moi_ca_khac=%s', jsonb_array_length(j), not exists (select 1 from jsonb_array_elements(j) x where x ->> 'from' = x ->> 'to'));
  exception when others then rep := rep || E'\n(o) LỖI: ' || sqlerrm; end;

  raise exception 'REPORT>> %', rep;
end $$;
