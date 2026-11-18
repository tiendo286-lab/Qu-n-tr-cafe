-- KIỂM TRA tệp 122: người hướng dẫn chính phải là nhân viên cấp Quản lý, bắt buộc khi tạo phiếu.
-- Ghép supabase/122_huong_dan_chinh_quan_ly.sql vào đầu cùng lần gửi; kết thúc RAISE 'REPORT>> …' nên tự hoàn tác.
do $$
declare achu public.accounts; emp bigint; mgr bigint; other bigint; tid bigint; m jsonb := '{}'::jsonb;
begin
  select * into achu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  select id into mgr from public.employees where rank = 'Quản lý' and status = 'Đang làm' order by id limit 1;
  select e.id into other from public.employees e join public.accounts x on x.employee_id = e.id and x.locked = 0
    where e.rank = 'Cấp 1' and e.status = 'Đang làm' order by e.id limit 1;
  insert into public.employees(code, name, rank, status) values ('ZZT122', 'Học viên thử', 'Thử việc', 'Đang làm') returning id into emp;
  perform set_config('request.jwt.claims', json_build_object('sub', achu.auth_user_id, 'role', 'authenticated')::text, true);

  begin
    perform public.app_dt_create(emp, jsonb_build_object('start_date', public.vn_now()::date::text));
    raise assert_failure using message = 'Tạo phiếu không có người hướng dẫn chính';
  exception when raise_exception then
    assert sqlerrm = 'Chọn người hướng dẫn chính (nhân viên cấp Quản lý).', sqlerrm;
  end;
  begin
    perform public.app_dt_create(emp, jsonb_build_object('start_date', public.vn_now()::date::text, 'instructor_id', other));
    raise assert_failure using message = 'Cho nhân viên Cấp 1 làm người hướng dẫn chính';
  exception when raise_exception then
    assert sqlerrm = 'Người hướng dẫn chính phải là nhân viên cấp Quản lý đang làm.', sqlerrm;
  end;
  tid := public.app_dt_create(emp, jsonb_build_object('start_date', public.vn_now()::date::text, 'instructor_id', mgr));
  assert (select instructor_id from public.trainings where id = tid) = mgr, 'Tạo phiếu với Quản lý';
  begin
    perform public.app_dt_update(tid, jsonb_build_object('instructor_id', other));
    raise assert_failure using message = 'Đổi sang Cấp 1';
  exception when raise_exception then
    assert sqlerrm = 'Người hướng dẫn chính phải là nhân viên cấp Quản lý đang làm.', sqlerrm;
  end;
  begin
    perform public.app_dt_update(tid, jsonb_build_object('instructor_id', null));
    raise assert_failure using message = 'Xoá người hướng dẫn chính';
  exception when raise_exception then
    assert sqlerrm = 'Chọn người hướng dẫn chính (nhân viên cấp Quản lý).', sqlerrm;
  end;
  perform public.app_dt_update(tid, jsonb_build_object('day8_review', 'Thử sửa ô khác'));
  -- phiếu cũ chưa có người hướng dẫn vẫn sửa được ô khác
  update public.trainings set updated_at = public.vn_now_text() where instructor_id is null;
  -- phân công riêng từng hạng mục vẫn giao được cho Cấp 1
  perform public.app_dt_followup_save(tid, 1, other, null, false, null);
  assert exists (select 1 from public.training_followups where training_id = tid and employee_id = other), 'Hạng mục vẫn giao được Cấp 1';
  m := jsonb_build_object('mgr', mgr, 'cap1', other, 'phieu', tid,
    'phieu_cu_khong_hd', (select count(*) from public.trainings where instructor_id is null));
  raise exception 'REPORT>> %', m;
end $$;
