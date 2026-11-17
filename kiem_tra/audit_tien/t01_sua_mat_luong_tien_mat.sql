-- KIỂM TRA (đang FAIL = có lỗi): quản lý sửa 1 ô bất kỳ ở bước Kiểm tra (app_ca_recon_save)
-- thì "lương trả tiền mặt" (cash_paid) của nhân viên bị xoá khỏi bản kiểm tra → tiền mặt bị tính THỪA đúng bằng số lương.
-- Chạy trong begin … rollback: không đổi dữ liệu thật. Kết quả hiện ở dòng REPORT>>.
begin;
do $$
declare rid bigint; chu uuid; m1 bigint; m2 bigint; cups0 int; luong bigint; luong_sau bigint;
begin
  -- dựng tình huống (sẽ hoàn tác): phiếu đã gửi gần nhất, 1 người làm ca được trả 200.000 lương tiền mặt
  select r.id, r.cups into rid, cups0 from public.shift_reports r
   where r.status = 'hoan_thanh' and not public.app__fin_locked(r.branch_id, r.work_date)
     and exists (select 1 from public.shift_report_staff s where s.report_id = r.id and s.worked = 1)
   order by r.work_date desc, r.id desc limit 1;
  update public.shift_report_staff set cash_paid = 200000
   where id = (select min(id) from public.shift_report_staff where report_id = rid and worked = 1);
  delete from public.shift_report_recon where report_id = rid;   -- bản kiểm tra dựng lại từ phiếu
  luong := 200000;
  select a.auth_user_id into chu from public.accounts a where a.system_role = 'chu' and a.auth_user_id is not null and coalesce(a.locked,0) = 0 order by a.id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu, 'role', 'authenticated')::text, true);
  -- như phiếu vừa gửi, quản lý chưa duyệt mục nào (đường bình thường của bước Kiểm tra)
  update public.shift_reports set recon_status = 'chua' where id = rid;
  delete from public.shift_report_results where report_id = rid;
  delete from public.shift_report_checks where report_id = rid;
  m1 := (public.app__ca_money(rid) ->> 'tm_left')::bigint;
  perform public.app_ca_recon_save(rid, jsonb_build_object('cups', coalesce(cups0, 0) + 1), 'kiểm tra tự động');
  m2 := (public.app__ca_money(rid) ->> 'tm_left')::bigint;
  select coalesce(sum(nullif(s ->> 'cash_paid', '')::bigint), 0) into luong_sau
    from public.shift_report_recon x, jsonb_array_elements(x.data -> 'staff') s where x.report_id = rid;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when m1 = m2 then 'PASS' else 'FAIL' end,
    'phieu', rid, 'luong_tien_mat_truoc', luong, 'luong_tien_mat_sau_khi_sua', luong_sau, 'lech_tien_mat_truoc', m1, 'lech_tien_mat_sau', m2);
end $$;
rollback;
