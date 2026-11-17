-- KIỂM TRA bước 119: ô Nợ (pos_debt), Tiền chênh lệch (pos_diff), Số dư đầu phiếu Fabi (ipos_opening)
-- a) quản lý sửa được trên bản kiểm tra, có lịch sử, phiếu nhân viên giữ nguyên
-- b) pos_diff để trống → null; pos_debt âm → báo lỗi
-- c) bản kiểm tra cũ (trước bước 119, thiếu 3 khoá) → lấy theo phiếu nhân viên
-- d) tải file Fabi → tự sửa 3 ô theo file
-- Chạy trong begin … rollback. Kết quả ở REPORT>>.
begin;
do $$
declare rid bigint; chu uuid; e jsonb; nlog int; okb1 boolean := false; okb2 boolean := false; r0 public.shift_reports;
        a_ok boolean; c_ok boolean; d_ok boolean := null; f public.fabi_shifts; fr bigint; msg text;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  select * into r0 from public.shift_reports r
   where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date) and coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false)
   order by r.work_date desc, r.id desc limit 1;
  rid := r0.id;
  set local session_replication_role = replica;   -- dựng: tắt trigger khoá mục web tự đối soát trong phần dựng
  update public.shift_reports set recon_status = 'chua' where id = rid;
  delete from public.shift_report_results where report_id = rid;
  delete from public.shift_report_checks where report_id = rid;
  delete from public.shift_report_recon where report_id = rid;
  set local session_replication_role = origin;
  -- a)
  perform public.app_ca_recon_save(rid, '{"pos_debt":50000,"pos_diff":-3000,"ipos_opening":1000000}'::jsonb, 'kiểm tra tự động');
  e := public.app__ca_eff(rid);
  select count(*) into nlog from public.shift_recon_log where report_id = rid and action = 'sua' and field in ('pos_debt', 'pos_diff', 'ipos_opening') and reason = 'kiểm tra tự động';
  a_ok := (e ->> 'pos_debt')::bigint = 50000 and (e ->> 'pos_diff')::bigint = -3000 and (e ->> 'ipos_opening')::bigint = 1000000
          and nlog = 3 - (case when r0.pos_debt = 50000 then 1 else 0 end) - (case when r0.pos_diff = -3000 then 1 else 0 end) - (case when r0.ipos_opening = 1000000 then 1 else 0 end)
          and (select pos_debt from public.shift_reports where id = rid) is not distinct from r0.pos_debt;
  -- b)
  begin
    perform public.app_ca_recon_save(rid, '{"pos_diff":null}'::jsonb, 'kiểm tra tự động');
    okb1 := (public.app__ca_eff(rid) -> 'pos_diff') is null or jsonb_typeof(public.app__ca_eff(rid) -> 'pos_diff') = 'null';
  exception when others then okb1 := false; msg := sqlerrm;
  end;
  begin
    perform public.app_ca_recon_save(rid, '{"pos_debt":-1}'::jsonb, 'kiểm tra tự động');
    okb2 := false;
  exception when others then okb2 := sqlerrm like '%không được âm%';
  end;
  -- c) bản kiểm tra kiểu cũ (không có 3 khoá)
  update public.shift_report_recon set data = data - 'pos_debt' - 'pos_diff' - 'ipos_opening' where report_id = rid;
  e := public.app__ca_eff(rid);
  c_ok := (e ->> 'pos_debt')::bigint is not distinct from r0.pos_debt and (e ->> 'pos_diff')::bigint is not distinct from r0.pos_diff
          and (e ->> 'ipos_opening')::bigint is not distinct from r0.ipos_opening;
  -- c2) bản kiểu cũ, quản lý lưu 1 ô khác (số cốc) → 3 ô vẫn theo phiếu nhân viên, không thành trống
  perform public.app_ca_recon_save(rid, jsonb_build_object('cups', coalesce(r0.cups, 0) + 1), 'kiểm tra tự động');
  e := public.app__ca_eff(rid);
  c_ok := c_ok and (e ->> 'pos_debt')::bigint is not distinct from r0.pos_debt and (e ->> 'ipos_opening')::bigint is not distinct from r0.ipos_opening;
  -- d) file Fabi
  select fs.* into f from public.fabi_shifts fs join public.shift_reports r on r.id = fs.report_id
   where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date) and fs.no is not null and fs.dau is not null and fs.tong is not null and fs.cuoi is not null and coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false)
   order by r.work_date desc limit 1;
  if f.ma_ca is not null then
    fr := f.report_id;
    update public.shift_reports set pos_debt = f.no + 1000, ipos_opening = f.dau + 1, pos_diff = (f.tong - f.cuoi) + 7 where id = fr;
    delete from public.shift_report_recon where report_id = fr;
    perform public.app__fabi_apply(f.ma_ca);
    e := public.app__ca_eff(fr);
    d_ok := (e ->> 'pos_debt')::bigint = f.no and (e ->> 'ipos_opening')::bigint = f.dau and (e ->> 'pos_diff')::bigint = f.tong - f.cuoi
            and exists (select 1 from public.shift_recon_log where report_id = fr and field = 'pos_debt' and reason like 'Theo file Fabi%');
  end if;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and okb1 and okb2 and c_ok and coalesce(d_ok, false) then 'PASS' else 'FAIL' end,
    'a_sua_duoc_co_lich_su', a_ok, 'b1_chenh_lech_trong', okb1, 'b1_loi', msg, 'b2_no_am_bi_chan', okb2, 'c_ban_cu', c_ok, 'd_fabi_tu_sua', d_ok, 'phieu', rid, 'phieu_fabi', fr);
end $$;
rollback;
