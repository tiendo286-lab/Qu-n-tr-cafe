-- KIỂM TRA bước 120: ghi chú sửa thu chi (app__ca_move_notes, app_ca_get.move_notes)
-- Phiếu gốc: Mua đá −150.000, Mua giấy −30.000 ×2, Mua chanh −20.000, cặp Khách CK rút TM 200.000.
-- Quản lý sửa: Mua đá −100.000, bỏ 1 dòng Mua giấy, thêm Thu CK +50.000 "Hoàn tiền" → sua / giu+xoa / giu / giu (1 dòng) / them.
-- Sửa Mua đá về −150.000 → giu. Phiếu không có bản kiểm tra → []. Chạy trong begin … rollback.
begin;
do $$
declare rid bigint; r2 bigint; chu uuid; k uuid := gen_random_uuid(); n jsonb; m_da jsonb; ok_sua boolean; ok_giay boolean; ok_chanh boolean; ok_doi boolean; ok_them boolean;
        ok_back boolean; ok_none boolean; ok_get boolean; mv jsonb; mv2 jsonb; msg text;
begin
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by a.id limit 1;
  select r.id into rid from public.shift_reports r where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date) and coalesce((public.app__ca_kt_state(r.id) ->> 'ready')::boolean, false) order by r.work_date desc, r.id desc limit 1;
  set local session_replication_role = replica;   -- dựng tình huống
  update public.shift_reports set recon_status = 'chua' where id = rid;
  delete from public.shift_report_results where report_id = rid;
  delete from public.shift_report_checks where report_id = rid;
  delete from public.shift_report_recon where report_id = rid;
  delete from public.shift_report_moves where report_id = rid;
  insert into public.shift_report_moves(report_id, kind, amount, note, sort_order, exchange_key) values
    (rid, 'tien_mat', -150000, 'Mua đá', 1, null), (rid, 'tien_mat', -30000, 'Mua giấy', 2, null), (rid, 'tien_mat', -30000, 'Mua giấy', 3, null),
    (rid, 'tien_mat', -20000, 'Mua chanh', 4, null), (rid, 'tien_mat', -200000, 'Khách A', 5, k), (rid, 'chuyen_khoan', 200000, 'Khách A', 6, k);
  set local session_replication_role = origin;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  mv := jsonb_build_array(
    jsonb_build_object('kind', 'tien_mat', 'amount', -100000, 'note', 'Mua đá'), jsonb_build_object('kind', 'tien_mat', 'amount', -30000, 'note', 'Mua giấy'),
    jsonb_build_object('kind', 'tien_mat', 'amount', -20000, 'note', 'Mua chanh'),
    jsonb_build_object('kind', 'tien_mat', 'amount', -200000, 'note', 'Khách A', 'exchange_key', k), jsonb_build_object('kind', 'chuyen_khoan', 'amount', 200000, 'note', 'Khách A', 'exchange_key', k),
    jsonb_build_object('kind', 'chuyen_khoan', 'amount', 50000, 'note', 'Hoàn tiền'));
  begin
    perform public.app_ca_recon_save(rid, jsonb_build_object('moves', mv), 'gõ nhầm');
    n := public.app__ca_move_notes(rid);
    select e into m_da from jsonb_array_elements(n) e where e ->> 'note' = 'Mua đá';
    ok_sua := m_da ->> 'type' = 'sua' and (m_da -> 'before' ->> 'amount')::bigint = -150000 and m_da ->> 'reason' = 'gõ nhầm' and coalesce(m_da ->> 'by', '') <> '';
    ok_giay := (select count(*) from jsonb_array_elements(n) e where e ->> 'note' = 'Mua giấy' and e ->> 'type' = 'giu') = 1
           and (select count(*) from jsonb_array_elements(n) e where e ->> 'note' = 'Mua giấy' and e ->> 'type' = 'xoa' and e ->> 'reason' = 'gõ nhầm' and coalesce(e ->> 'by', '') <> '') = 1;   -- 2 dòng giống hệt: dòng xoá vẫn biết ai xoá
    ok_chanh := (select e ->> 'type' from jsonb_array_elements(n) e where e ->> 'note' = 'Mua chanh') = 'giu';
    ok_doi := (select count(*) from jsonb_array_elements(n) e where e ->> 'note' = 'Khách A') = 1
          and (select e ->> 'type' from jsonb_array_elements(n) e where e ->> 'note' = 'Khách A') = 'giu';
    ok_them := (select e ->> 'type' from jsonb_array_elements(n) e where e ->> 'note' = 'Hoàn tiền') = 'them';
    -- sửa Mua đá về như cũ
    mv2 := jsonb_set(mv, '{0,amount}', '-150000'::jsonb);
    perform public.app_ca_recon_save(rid, jsonb_build_object('moves', mv2), 'sửa lại');
    ok_back := (select e ->> 'type' from jsonb_array_elements(public.app__ca_move_notes(rid)) e where e ->> 'note' = 'Mua đá') = 'giu';
    ok_get := public.app_ca_get(rid) ? 'move_notes';
  exception when others then msg := sqlerrm;
  end;
  select r.id into r2 from public.shift_reports r where r.status = 'hoan_thanh' and not exists (select 1 from public.shift_report_recon x where x.report_id = r.id) order by r.id desc limit 1;
  begin
    ok_none := r2 is null or public.app__ca_move_notes(r2) = '[]'::jsonb;
  exception when others then msg := coalesce(msg, '') || ' none: ' || sqlerrm;
  end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when ok_sua and ok_giay and ok_chanh and ok_doi and ok_them and ok_back and ok_none and ok_get then 'PASS' else 'FAIL' end,
    'sua_mua_da', ok_sua, 'giu_xoa_mua_giay', ok_giay, 'giu_mua_chanh', ok_chanh, 'doi_tien_1_dong', ok_doi, 'them_hoan_tien', ok_them, 'sua_ve_nhu_cu', ok_back,
    'khong_ban_kiem_tra', ok_none, 'app_ca_get_co_move_notes', ok_get, 'loi', msg, 'notes', n, 'phieu', rid);
end $$;
rollback;
