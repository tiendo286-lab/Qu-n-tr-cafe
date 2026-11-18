-- KIỂM TRA tệp 120 trên máy chủ thật. Ghép nội dung supabase/120_cong_viec_dao_tao.sql vào đầu cùng giao dịch.
-- Dùng một học viên giả; khối DO luôn kết thúc bằng RAISE 'REPORT>> …' nên mọi thay đổi tự hoàn tác.
do $$
declare
  p jsonb := '{"introduced":true,"practiced":true,"level":"tot"}';
  achu public.accounts; aql public.accounts; ahelp public.accounts; aout public.accounts;
  emp bigint; tid bigint; br bigint; n_items int; j jsonb; m jsonb := '{}'::jsonb; e text;
  n_before bigint;
begin
  select * into achu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  select * into aql from public.accounts where system_role = 'ql' and auth_user_id is not null and locked = 0 order by id limit 1;
  select a.* into ahelp from public.accounts a join public.employees x on x.id = a.employee_id
    where a.system_role = 'nv' and a.auth_user_id is not null and a.locked = 0 and x.status = 'Đang làm' and x.rank = 'Cấp 1'
    order by a.id limit 1;
  select a.* into aout from public.accounts a join public.employees x on x.id = a.employee_id
    where a.system_role = 'nv' and a.auth_user_id is not null and a.locked = 0 and x.status = 'Đang làm' and a.id <> ahelp.id
      and not exists (select 1 from public.account_perms q where q.account_id = a.id)
      and not exists (select 1 from public.trainings t where a.employee_id in (t.employee_id, t.instructor_id, t.cont_trainer_id) or t.manager_id = a.id)
    order by a.id limit 1;
  select id into br from public.branches where status = 'Đang hoạt động' order by sort_order, id limit 1;

  -- Phiếu thật giữ trạng thái
  m := m || jsonb_build_object('phieu_that', (select jsonb_object_agg(t.id, public.app__dt_status(t)) from public.trainings t));
  assert not has_table_privilege('authenticated', 'public.training_review_config', 'INSERT'), 'Cấu hình riêng tư';
  assert not has_table_privilege('authenticated', 'public.training_followups', 'UPDATE'), 'Phân công riêng tư';
  assert not has_function_privilege('authenticated', 'public.app__dt_reviewer()', 'EXECUTE'), 'Hàm nội bộ bị khóa';
  assert not has_function_privilege('anon', 'public.app_dt_work_list(boolean)', 'EXECUTE'), 'Khách không gọi được';

  -- Học viên giả
  insert into public.employees(code, name, rank, status) values ('ZZT120', 'Học viên thử', 'Thử việc', 'Đang làm') returning id into emp;
  insert into public.trainings(employee_id, program_id, start_date, manager_id, branch_id)
    select emp, id, (public.vn_now()::date - 8)::text, aql.id, br from public.training_programs where code = 'chay_ban' returning id into tid;
  select count(*) into n_items from public.training_items i join public.trainings t on t.program_id = i.program_id where t.id = tid;
  select count(*) into n_before from public.notifications;

  -- Chủ: chọn mình làm người nhận xét
  perform set_config('request.jwt.claims', json_build_object('sub', achu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_reviewer_save(achu.id);
  j := public.app_dt_work_list(true);
  assert exists (select 1 from jsonb_array_elements(j -> 'rows') r where (r ->> 'id')::bigint = tid and r -> 'my_duties' ? 'Kiểm tra và nhận xét'), 'Người nhận xét thấy phiếu';
  j := public.app_dt_work_list();
  m := m || jsonb_build_object('chu_ds_chung', jsonb_array_length(j -> 'rows'), 'chu_tai_khoan', jsonb_array_length(j -> 'accounts'));
  perform public.app_dt_get(t.id) from public.trainings t;   -- mọi phiếu thật mở được
  assert public.app_dt_get(tid) ->> 'status' = 'dao_tao_tiep', 'Mốc 8 ngày';
  assert (public.app_dt_get(tid) ->> 'due')::date = public.vn_now()::date + 4, 'Hạn 12 ngày';
  begin
    perform public.app_dt_work_action(tid, 'review', 'Đóng sớm');
    raise assert_failure using message = 'Đã cho đóng phiếu chưa đủ mục';
  exception when raise_exception then
    assert sqlerrm = 'Cần hoàn thành đủ hạng mục trước khi nhận xét cuối.';
  end;
  perform public.app_dt_followup_save(tid, 1, ahelp.employee_id, null, false, br);
  assert public.app_dt_get(tid) ->> 'status' = 'dao_tao_tiep', 'Giao thường không mở bổ sung';
  assert public.app_dt_get(tid) -> 'followups' -> 0 ->> 'branch_id' = br::text, 'Lưu cơ sở hạng mục';
  perform public.app_dt_followup_save(tid, 1, null, 'Cần thực hành thêm');
  assert public.app_dt_get(tid) ->> 'status' = 'dao_tao_bo_sung', 'Người nhận xét yêu cầu luyện thêm';
  perform public.app_dt_work_action(tid, 'remind', 'Nhắc thử');

  -- Quản lý phụ trách giao người kèm cho mục bổ sung
  perform set_config('request.jwt.claims', json_build_object('sub', aql.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_followup_save(tid, 1, ahelp.employee_id, null);
  assert public.app_dt_get(tid) -> 'followups' -> 0 ->> 'note' = 'Cần thực hành thêm', 'Giữ ghi chú';
  assert public.app_dt_get(tid) -> 'followups' -> 0 ->> 'branch_id' = br::text, 'Giữ cơ sở khi giao bổ sung';
  begin
    perform public.app_dt_work_action(tid, 'review', 'Sai người');
    raise assert_failure using message = 'Quản lý nhận xét thay';
  exception when raise_exception then
    assert sqlerrm = 'Chỉ người được giao nhận xét có quyền.';
  end;

  -- Người ngoài
  if aout.id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', aout.auth_user_id, 'role', 'authenticated')::text, true);
    assert not exists (select 1 from jsonb_array_elements(public.app_dt_work_list() -> 'rows') r where (r ->> 'id')::bigint = tid), 'Người ngoài không thấy phiếu';
    begin
      perform public.app_dt_reviewer_save(aout.id);
      raise assert_failure using message = 'Người ngoài đổi người nhận xét';
    exception when raise_exception then
      assert sqlerrm = 'Chỉ Chủ được chọn người nhận xét.';
    end;
    begin
      perform public.app_dt_get(tid);
      raise assert_failure using message = 'Người ngoài xem được phiếu';
    exception when raise_exception then null;
    end;
  end if;

  -- Người kèm hạng mục 1
  perform set_config('request.jwt.claims', json_build_object('sub', ahelp.auth_user_id, 'role', 'authenticated')::text, true);
  assert (public.app_dt_get(tid) -> 'followups' -> 0 ->> 'mine')::boolean, 'Thấy mục của mình';
  assert exists (select 1 from jsonb_array_elements(public.app_dt_work_list(true) -> 'rows') r
    where (r ->> 'id')::bigint = tid and r -> 'my_duties' ? 'Hướng dẫn hạng mục được giao'), 'Việc của người kèm';
  begin
    perform public.app_dt_mark(tid, 2, p);
    raise assert_failure using message = 'Người kèm sửa mục không được giao';
  exception when raise_exception then
    assert sqlerrm = 'Bạn chỉ được cập nhật hạng mục được giao.';
  end;
  perform public.app_dt_mark(tid, 1, p);

  -- Chủ hoàn tất các mục còn lại và nhận xét
  perform set_config('request.jwt.claims', json_build_object('sub', achu.auth_user_id, 'role', 'authenticated')::text, true);
  begin
    perform public.app_dt_mark(tid, 2, '{"introduced":true,"practiced":true}');
    raise assert_failure using message = 'Lưu thực hành thiếu mức';
  exception when raise_exception then
    assert sqlerrm = 'Chọn mức đạt khi đánh dấu đã thực hành.';
  end;
  perform public.app_dt_mark(tid, i.no, p) from public.training_items i join public.trainings t on t.program_id = i.program_id
    where t.id = tid and i.no <> 1;
  assert public.app_dt_get(tid) ->> 'status' = 'cho_nhan_xet', 'Đủ mục thì chờ nhận xét';
  perform public.app_dt_work_action(tid, 'review', 'Đạt đủ hạng mục');
  assert public.app_dt_get(tid) ->> 'status' = 'hoan_thanh', 'Hoàn thành sau nhận xét';
  assert not exists (select 1 from jsonb_array_elements(public.app_dt_work_list(true) -> 'rows') r where (r ->> 'id')::bigint = tid), 'Phiếu xong rời Việc của tôi';

  m := m || jsonb_build_object('so_muc', n_items, 'achieved', public.app_dt_get(tid) ->> 'achieved',
    'thong_bao_moi', (select count(*) from public.notifications) - n_before,
    'tb_nguoi_kem', (select json_agg(distinct title) from public.notifications where account_id = ahelp.id and link = '/dao-tao/phieu?id=' || tid),
    'tb_quan_ly', (select json_agg(distinct title) from public.notifications where account_id = aql.id and link = '/dao-tao/phieu?id=' || tid),
    'co_nguoi_ngoai', aout.id is not null,
    'phieu_that_sau', (select jsonb_object_agg(t.id, public.app__dt_status(t)) from public.trainings t where t.id <> tid));
  raise exception 'REPORT>> %', m;
end $$;
