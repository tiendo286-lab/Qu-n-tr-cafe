-- Dữ liệu giả cho PostgreSQL cục bộ. Tạo trước khi chạy migration 120.
insert into public.branches(id, code, name) values (101, 'TEST101', 'Cơ sở thử 1'), (102, 'TEST102', 'Cơ sở thử 2');
insert into public.employees(id, code, name, rank) values
  (101, 'T101', 'Học viên thử', 'Thử việc'), (102, 'T102', 'Người kèm thử', 'Cấp 1'),
  (103, 'T103', 'Tài khoản ngoài thử', 'Cấp 1'), (104, 'T104', 'Học viên cũ thử', 'Cấp 1');
insert into public.accounts(id, employee_id, system_role) values
  (101, null, 'chu'), (102, null, 'nv'), (103, 102, 'nv'), (104, 103, 'nv'), (105, null, 'ql');
insert into public.trainings(id, employee_id, program_id, start_date, manager_id)
  select 101, 101, id, (public.vn_now()::date - 8)::text, 105 from public.training_programs where code = 'chay_ban'
  union all select 102, 104, id, (public.vn_now()::date - 20)::text, 105 from public.training_programs where code = 'chay_ban';
insert into public.training_marks(training_id, item_no, introduced, practiced, level)
  select 102, no, true, true, 'tot' from public.training_items;

-- Bắt đầu kiểm tra
do $$
declare p jsonb := '{"introduced":true,"practiced":true,"level":"tot"}';
begin
  perform set_config('test.account', '101', true);
  assert public.app_dt_get(102)->>'status' = 'hoan_thanh', 'Phiếu cũ đã xong phải giữ trạng thái';
  assert public.app_dt_get(101)->>'status' = 'dao_tao_tiep', 'Mốc đào tạo tiếp sau 8 ngày';
  assert (public.app_dt_get(101)->>'due')::date = public.vn_now()::date + 4, 'Hạn công việc 12 ngày';
  perform public.app_dt_reviewer_save(102);
  assert not has_table_privilege('authenticated', 'public.training_review_config', 'INSERT'), 'Cấu hình riêng tư';
  assert not has_table_privilege('authenticated', 'public.training_followups', 'UPDATE'), 'Phân công riêng tư';
  assert not has_function_privilege('authenticated', 'public.app__dt_reviewer()', 'EXECUTE'), 'Hàm nội bộ bị khóa';

  perform set_config('test.account', '102', true);
  assert jsonb_array_length(public.app_dt_work_list(true)->'rows') = 1, 'Người nhận xét chỉ nhận phiếu đang mở trong Việc của tôi';
  assert public.app_dt_work_list(true)->'rows'->0->'my_duties' ? 'Kiểm tra và nhận xét', 'Thiếu trách nhiệm người nhận xét';
  assert jsonb_array_length(public.app_dt_work_list()->'rows') = 2, 'Người nhận xét xem danh sách chung';
  assert public.app_dt_work_list()->'rows'->0->>'program' = 'chay_ban', 'Phiếu có mã chương trình để chia mục';
  begin
    perform public.app_dt_work_action(101, 'review', 'Thử đóng sớm');
    raise assert_failure using message = 'Đã cho đóng phiếu chưa đủ mục';
  exception when raise_exception then
    assert sqlerrm = 'Cần hoàn thành đủ hạng mục trước khi nhận xét cuối.';
  end;
  perform public.app_dt_followup_save(101, 1, 102, null, false, 102);
  assert public.app_dt_get(101)->>'status' = 'dao_tao_tiep', 'Giao người thường không mở đào tạo bổ sung';
  assert public.app_dt_get(101)->'followups'->0->>'name' = 'Người kèm thử';
  assert public.app_dt_get(101)->'followups'->0->>'branch' = 'TEST102';
  perform public.app_dt_followup_save(101, 2, null, null, false, 101);
  assert public.app_dt_get(101)->'followups'->1->>'branch' = 'TEST101', 'Chọn cơ sở riêng khi dùng hướng dẫn chính';
  perform public.app_dt_followup_save(101, 1, null, 'Cần thực hành thêm');
  perform public.app_dt_work_action(101, 'remind', 'Nhắc thử');

  perform set_config('test.account', '105', true);
  perform public.app_dt_followup_save(101, 1, 102, null);
  assert public.app_dt_get(101)->>'status' = 'dao_tao_bo_sung';
  assert public.app_dt_get(101)->'followups'->0->>'note' = 'Cần thực hành thêm';
  assert public.app_dt_get(101)->'followups'->0->>'branch' = 'TEST102', 'Giữ cơ sở khi giao bổ sung';

  perform set_config('test.account', '104', true);
  assert jsonb_array_length(public.app_dt_work_list()->'rows') = 0, 'Người ngoài không thấy phiếu';
  begin
    perform public.app_dt_reviewer_save(104);
    raise assert_failure using message = 'Đã cho người ngoài đổi người nhận xét';
  exception when raise_exception then
    assert sqlerrm = 'Chỉ Chủ được chọn người nhận xét.';
  end;

  perform set_config('test.account', '103', true);
  assert (public.app_dt_get(101)->'followups'->0->>'mine')::boolean;
  assert public.app_dt_work_list(true)->'rows'->0->'my_duties' ? 'Hướng dẫn hạng mục được giao', 'Thiếu việc của người được giao';
  assert exists (select 1 from public.test_notifications where account = 103 and title = 'Bạn được giao đào tạo bổ sung');

  begin
    perform public.app_dt_mark(101, 2, p);
    raise assert_failure using message = 'Đã cho người kèm sửa mục không được giao';
  exception when raise_exception then
    assert sqlerrm = 'Bạn chỉ được cập nhật hạng mục được giao.';
  end;
  perform public.app_dt_mark(101, 1, p);

  perform set_config('test.account', '105', true);
  begin
    perform public.app_dt_mark(101, 2, '{"introduced":true,"practiced":true}');
    raise assert_failure using message = 'Đã cho lưu thực hành thiếu mức đạt';
  exception when raise_exception then
    assert sqlerrm = 'Chọn mức đạt khi đánh dấu đã thực hành.';
  end;
  perform public.app_dt_mark(101, i.no, p) from public.training_items i where i.no <> 1;
  assert public.app_dt_get(101)->>'status' = 'cho_nhan_xet';
  begin
    perform public.app_dt_work_action(101, 'review', 'Sai người');
    raise assert_failure using message = 'Đã cho người ngoài nhận xét';
  exception when raise_exception then
    assert sqlerrm = 'Chỉ người được giao nhận xét có quyền.';
  end;

  perform set_config('test.account', '102', true);
  perform public.app_dt_followup_save(101, 1, null, 'Luyện lại lần hai');
  assert public.app_dt_get(101)->>'status' = 'dao_tao_bo_sung';
  assert (public.app_dt_get(101)->>'achieved')::integer = 68, 'Giữ kết quả khi giao luyện lại';
  perform set_config('test.account', '105', true);
  perform public.app_dt_followup_save(101, 1, 102, null);
  perform set_config('test.account', '103', true);
  perform public.app_dt_mark(101, 1, p);
  perform set_config('test.account', '102', true);
  update public.trainings set start_date = (public.vn_now()::date - 7)::text where id = 101;
  begin
    perform public.app_dt_work_action(101, 'review', 'Đóng trước ngày 8');
    raise assert_failure using message = 'Đã cho hoàn thành trước ngày 8';
  exception when raise_exception then
    assert sqlerrm = 'Chưa đến mốc 8 ngày để hoàn thành phiếu.';
  end;
  update public.trainings set start_date = (public.vn_now()::date - 8)::text where id = 101;
  perform public.app_dt_work_action(101, 'review', 'Đạt đủ hạng mục');
  assert public.app_dt_get(101)->>'status' = 'hoan_thanh';
  assert public.app_dt_get(101)->>'workflow_review' = 'Đạt đủ hạng mục';
  assert exists (select 1 from public.test_notifications where account = 105 and title = 'Nhắc hoàn thành đào tạo');
  assert exists (select 1 from public.test_notifications where account = 102 and title = 'Phiếu đào tạo chờ nhận xét');
  insert into public.employees(id, code, name, rank) values (106, 'T106', 'Học viên mới thử', 'Thử việc');
  insert into public.trainings(id, employee_id, program_id, start_date, manager_id, instructor_id)
  select 106, 106, id, public.vn_now()::date::text, 105, 102 from public.training_programs where code = 'chay_ban';
  assert exists (select 1 from public.test_notifications where account = 103 and title = 'Bạn được phân công đào tạo');
  assert exists (select 1 from public.test_notifications where account = 105 and title = 'Bạn được phân công đào tạo');
  update public.trainings set instructor_id = 103 where id = 106;
  assert exists (select 1 from public.test_notifications where account = 104 and title = 'Bạn được phân công đào tạo');
  perform set_config('test.account', '103', true);
  assert jsonb_array_length(public.app_dt_work_list(true)->'rows') = 0, 'Người cũ không còn thấy việc đã chuyển hoặc đã đóng';
  perform set_config('test.account', '104', true);
  assert public.app_dt_work_list(true)->'rows'->0->'my_duties' ? 'Hướng dẫn', 'Người mới phải thấy việc vừa giao';

end $$;
select 'ĐẠT quyền, hạn, giao bổ sung, nhắc hạn, nhận xét và phiếu cũ' as ket_qua;
