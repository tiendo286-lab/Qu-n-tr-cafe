-- KIỂM TRA bước 119: quản lý sửa Bàn giao ca sau và ảnh phiếu Fabi ở bước Kiểm tra
-- a) sửa nội dung 1 dòng + thêm 1 dòng → đúng, có lịch sử  b) không lý do → lỗi
-- c) dòng đã giao thành việc (task_id) không bị xoá  d) thêm rồi xoá ảnh Fabi → được, có lịch sử; xoá ảnh Fabi cuối cùng → lỗi
-- Chạy trong begin … rollback. Kết quả ở REPORT>>.
begin;
do $$
declare rid bigint; ql uuid; h1 bigint; hk bigint; tk bigint; r jsonb; a_ok boolean := false; b_ok boolean := false; c_ok boolean := true;
        d_ok boolean := false; d2_ok boolean := false; pid bigint; m1 text; m2 text; m3 text; br bigint; n int;
begin
  select a.auth_user_id into ql from public.accounts a where a.system_role in ('ql', 'ql_tong') and a.auth_user_id is not null and coalesce(a.locked, 0) = 0 order by (a.system_role = 'ql') desc, a.id limit 1;
  select r0.id, r0.branch_id into rid, br from public.shift_reports r0 where r0.status = 'hoan_thanh' and not public.app__fin_locked(r0.branch_id, r0.work_date) and coalesce((public.app__ca_kt_state(r0.id) ->> 'ready')::boolean, false)
   order by r0.work_date desc, r0.id desc limit 1;
  -- dựng: 1 dòng bàn giao thường, 1 dòng đã giao thành việc (nếu có việc nào để gắn), đúng 1 ảnh Fabi
  delete from public.handover_items where report_id = rid and task_id is null;
  insert into public.handover_items(branch_id, report_id, content, created_by) values (br, rid, 'Nội dung cũ', null) returning id into h1;
  select task_id into tk from public.handover_items where task_id is not null limit 1;
  if tk is not null then
    insert into public.handover_items(branch_id, report_id, content, created_by, task_id) values (br, rid, 'Đã giao thành việc', null, tk) returning id into hk;
  end if;
  delete from public.shift_report_photos where report_id = rid and kind = 'ipos';
  insert into public.shift_report_photos(report_id, path, created_by, kind) values (rid, 'r' || rid || '/ipos/goc.jpg', null, 'ipos');
  perform set_config('request.jwt.claims', json_build_object('sub', ql, 'role', 'authenticated')::text, true);
  -- a)
  begin
    r := public.app_ca_recon_handover_save(rid, jsonb_build_array(jsonb_build_object('id', h1, 'content', 'Nội dung đã sửa'), jsonb_build_object('id', null, 'content', 'Dòng thêm')), 'kiểm tra tự động');
    select count(*) into n from public.handover_items where report_id = rid and task_id is null and content in ('Nội dung đã sửa', 'Dòng thêm');
    a_ok := n = 2 and exists (select 1 from public.shift_recon_log where report_id = rid and field = 'handover' and reason = 'kiểm tra tự động');
  exception when others then m1 := sqlerrm;
  end;
  -- b)
  begin
    perform public.app_ca_recon_handover_save(rid, '[{"id":null,"content":"Không lý do"}]'::jsonb, '');
    m2 := 'không bị từ chối';
  exception when others then b_ok := sqlerrm like '%lý do%'; m2 := sqlerrm;
  end;
  -- c) gửi danh sách rỗng: dòng thường bị xoá, dòng đã giao thành việc giữ nguyên
  if hk is not null then
    begin
      perform public.app_ca_recon_handover_save(rid, '[]'::jsonb, 'kiểm tra tự động');
      c_ok := exists (select 1 from public.handover_items where id = hk) and not exists (select 1 from public.handover_items where report_id = rid and task_id is null);
    exception when others then c_ok := false; m1 := coalesce(m1, '') || ' c: ' || sqlerrm;
    end;
  end if;
  -- d) ảnh
  begin
    pid := public.app_ca_recon_photo_add(rid, 'r' || rid || '/ipos/them119.jpg', 'kiểm tra tự động');
    perform public.app_ca_recon_photo_del(pid, 'kiểm tra tự động');
    select count(*) into n from public.shift_recon_log where report_id = rid and field = 'photo_ipos';
    d_ok := n = 2 and not exists (select 1 from public.shift_report_photos where id = pid);
  exception when others then m3 := sqlerrm;
  end;
  begin
    perform public.app_ca_recon_photo_del((select id from public.shift_report_photos where report_id = rid and kind = 'ipos' limit 1), 'kiểm tra tự động');
    m3 := coalesce(m3, '') || ' xoá ảnh cuối không bị chặn';
  exception when others then d2_ok := sqlerrm like '%ít nhất 1 ảnh%';
  end;
  raise exception 'REPORT>> %', json_build_object('ket_qua', case when a_ok and b_ok and c_ok and d_ok and d2_ok then 'PASS' else 'FAIL' end,
    'a_sua_them_ban_giao', a_ok, 'a_loi', m1, 'b_bat_buoc_ly_do', b_ok, 'b_loi', m2, 'c_giu_dong_da_giao_viec', c_ok, 'c_co_tinh_huong', hk is not null,
    'd_them_xoa_anh', d_ok, 'd2_chan_xoa_anh_cuoi', d2_ok, 'd_loi', m3, 'phieu', rid);
end $$;
rollback;
