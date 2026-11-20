-- Bài thử cho supabase/148_dao_tao_phan_cong.sql (bước 169). Gửi SAU tệp 148. Tự tạo người / phiếu giả rồi REPORT>> tự hoàn tác.
-- Vai: Chủ · người phụ trách chính (PTC) · HD chính (HDC) · nhân viên Cấp 1 · Quản lý khác (phải bị chặn) · Quản lý tổng (phải bị chặn nếu không là PTC).
do $$
declare chu public.accounts; hdc public.accounts; qlk public.accounts; c1 public.accounts; ptc public.accounts; qlt public.accounts;
  trainee bigint; tid bigint; n int := 0; e text; j jsonb; k int; k2 int; nomgr bigint;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null and locked = 0 order by id limit 1;
  -- 2 Quản lý có tài khoản (HDC + Quản lý khác), 1 Cấp 1, 1 tài khoản làm PTC (khác các vai trên)
  select a.* into hdc from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Quản lý' and x.status = 'Đang làm' and a.system_role <> 'chu' order by (a.system_role <> 'ql'), a.id limit 1;
  select a.* into qlk from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Quản lý' and x.status = 'Đang làm' and a.system_role = 'ql' and a.id <> hdc.id order by a.id limit 1;
  select a.* into c1 from public.accounts a join public.employees x on x.id = a.employee_id where a.locked = 0 and a.auth_user_id is not null and x.rank = 'Cấp 1' and x.status = 'Đang làm' order by a.id limit 1;
  select a.* into qlt from public.accounts a where a.locked = 0 and a.auth_user_id is not null and a.system_role = 'ql_tong' and a.id <> hdc.id order by a.id limit 1;
  select a.* into ptc from public.accounts a where a.locked = 0 and a.auth_user_id is not null and a.id not in (chu.id, hdc.id, qlk.id, c1.id, coalesce(qlt.id, 0)) and a.system_role <> 'nv' order by a.id limit 1;
  if hdc.id is null or qlk.id is null or c1.id is null or ptc.id is null then raise exception 'Thiếu tài khoản để thử (cần 2 Quản lý, 1 Cấp 1, 1 tài khoản khác làm PTC)'; end if;
  insert into public.training_review_config(singleton, account_id) values (true, ptc.id) on conflict (singleton) do update set account_id = excluded.account_id;
  insert into public.employees(code, name, rank, status) values ('T148', 'Nhân viên thử 148', 'Thử việc', 'Đang làm') returning id into trainee;

  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(trainee, jsonb_build_object('start_date', to_char(public.vn_now()::date - 2, 'YYYY-MM-DD'), 'instructor_id', hdc.employee_id));
  update public.trainings set manager_id = qlk.id where id = tid;   -- 6. Quản lý phụ trách cũ không còn cho quyền gì

  -- 3. Quản lý khác (kể cả đang là "Quản lý phụ trách") bị chặn giao
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_followup_save(tid, 1, c1.employee_id, null, false, null); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 1: Quản lý khác vẫn giao được hạng mục'; end if; end; n := n + 1;
  -- Quản lý tổng (không là PTC) bị chặn
  if qlt.id is not null and qlt.id <> ptc.id then
    perform set_config('request.jwt.claims', json_build_object('sub', qlt.auth_user_id, 'role', 'authenticated')::text, true);
    begin perform public.app_dt_followup_save(tid, 1, c1.employee_id, null, false, null); raise exception 'KHÔNG CHẶN';
    exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 2: Quản lý tổng vẫn giao được hạng mục'; end if; end; n := n + 1;
  end if;
  -- HDC, PTC, Chủ giao được
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_followup_save(tid, 1, c1.employee_id, null, false, null); n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', ptc.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_followup_save(tid, 2, c1.employee_id, null, false, null); n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_followup_save(tid, 3, c1.employee_id, null, false, null); n := n + 1;
  -- app_dt_get theo vai
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_get(tid);
  if (j ->> 'can_assign')::boolean or (j ->> 'can_check')::boolean then raise exception 'SAI 3: Quản lý khác vẫn có can_assign / can_check'; end if; n := n + 1;

  -- 4. Cấp 1 ghi mức đạt → Chờ kiểm tra, chưa tính đạt, báo HDC + PTC
  perform set_config('request.jwt.claims', json_build_object('sub', c1.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_mark(tid, 1, '{"introduced": true, "practiced": true, "level": "kha"}');
  if not (j ->> 'pending')::boolean or (j ->> 'achieved')::int <> 0 then raise exception 'SAI 4: Cấp 1 ghi mức đạt phải Chờ kiểm tra, chưa tính đạt: %', j; end if; n := n + 1;
  perform public.app_dt_mark(tid, 2, '{"introduced": true, "practiced": true, "level": "tb"}');
  select count(*) into k from public.notifications where account_id in (hdc.id, ptc.id) and title = 'Hạng mục đào tạo chờ kiểm tra' and link = '/dao-tao/phieu?id=' || tid;
  if k <> 2 then raise exception 'SAI 5: phải có đúng 1 thông báo chờ kiểm tra cho HDC + 1 cho PTC (gộp, không dồn) — có %', k; end if; n := n + 1;
  -- Cấp 1 / Quản lý khác không xác nhận đạt được
  begin perform public.app_dt_check_ok(tid, 1, null); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 6: Cấp 1 tự xác nhận đạt được'; end if; end; n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_check_ok(tid, 1, null); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 7: Quản lý khác xác nhận đạt được'; end if; end; n := n + 1;
  -- Việc của tôi của HDC có "Chờ bạn kiểm tra 2 hạng mục"
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_work_list(true);
  if not exists (select 1 from jsonb_array_elements(j -> 'rows') r where (r ->> 'id')::bigint = tid and (r -> 'my_duties') ? 'Chờ bạn kiểm tra 2 hạng mục') then raise exception 'SAI 8: Việc của tôi (HDC) thiếu "Chờ bạn kiểm tra 2 hạng mục"'; end if; n := n + 1;
  -- 5. HDC xác nhận đạt (sửa mức) → tính đạt
  j := public.app_dt_check_ok(tid, 1, 'tot');
  if (j ->> 'achieved')::int <> 1 or j ->> 'level' <> 'tot' then raise exception 'SAI 9: HDC xác nhận đạt: %', j; end if; n := n + 1;
  -- HDC tự ghi thì khỏi kiểm
  j := public.app_dt_mark(tid, 4, '{"introduced": true, "practiced": true, "level": "tot"}');
  if (j ->> 'pending')::boolean or (j ->> 'achieved')::int <> 2 then raise exception 'SAI 10: HDC tự ghi phải tính đạt ngay: %', j; end if; n := n + 1;
  -- phiếu chỉ sang chờ nhận xét khi không còn Chờ kiểm tra (mục 2 còn chờ)
  insert into public.training_marks(training_id, item_no, introduced, practiced, level, at)
    select tid, i.no, true, true, 'tot', public.vn_now_text() from public.training_items i
     where i.program_id = (select program_id from public.trainings where id = tid) and not exists (select 1 from public.training_marks m where m.training_id = tid and m.item_no = i.no);
  if public.app__dt_status((select t from public.trainings t where id = tid)) = 'cho_nhan_xet' then raise exception 'SAI 11: còn mục Chờ kiểm tra mà phiếu đã sang chờ nhận xét'; end if; n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', ptc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_check_ok(tid, 2, null);
  if j ->> 'status' <> 'cho_nhan_xet' then raise exception 'SAI 12: PTC xác nhận mục cuối → phải chờ nhận xét, có %', j ->> 'status'; end if; n := n + 1;

  -- sửa thêm: đổi cơ sở cùng người → không báo lại
  delete from public.training_marks where training_id = tid and item_no > 10;   -- mở lại phiếu để còn giao được
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  select count(*) into k from public.notifications where account_id = c1.id and title = 'Bạn được giao hướng dẫn hạng mục';
  perform public.app_dt_followup_save(tid, 3, c1.employee_id, null, false, (select id from public.branches where status = 'Đang hoạt động' order by id limit 1));
  select count(*) into k2 from public.notifications where account_id = c1.id and title = 'Bạn được giao hướng dẫn hạng mục';
  if k2 <> k then raise exception 'SAI 13: đổi cơ sở cùng người vẫn báo "được giao hướng dẫn"'; end if; n := n + 1;
  perform public.app_dt_followup_save(tid, 11, c1.employee_id, null, false, null);
  select count(*) into k2 from public.notifications where account_id = c1.id and title = 'Bạn được giao hướng dẫn hạng mục';
  if k2 <> k + 1 then raise exception 'SAI 14: giao người mới phải báo 1 lần'; end if; n := n + 1;
  -- "Đổi phân công" giữ dấu "Đã đánh giá giai đoạn 2"
  insert into public.training_followups(training_id, item_no, employee_id, is_extra, finished_at) values (tid, 12, c1.employee_id, true, '2031-01-01 10:00:00')
    on conflict (training_id, item_no) do update set is_extra = true, finished_at = '2031-01-01 10:00:00';
  perform public.app_dt_followup_save(tid, 12, hdc.employee_id, null, false, null);
  if (select phase2_done_at from public.training_followups where training_id = tid and item_no = 12) is null then raise exception 'SAI 15: Đổi phân công làm mất dấu Đã đánh giá giai đoạn 2'; end if; n := n + 1;

  -- 2. PTC đổi HDC; HDC cũ hết quyền giao, HDC mới giao được
  perform set_config('request.jwt.claims', json_build_object('sub', ptc.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_instructor_save(tid, qlk.employee_id); n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_followup_save(tid, 13, c1.employee_id, null, false, null); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 16: HDC cũ vẫn giao được sau khi bị đổi'; end if; end; n := n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_followup_save(tid, 13, c1.employee_id, null, false, null); n := n + 1;
  -- người không phải PTC (Cấp 1) không đổi HDC được
  perform set_config('request.jwt.claims', json_build_object('sub', c1.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_instructor_save(tid, hdc.employee_id); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 17: Cấp 1 đổi được HDC'; end if; end; n := n + 1;
  -- anh chốt 20/11: HDC (Quản lý, kể cả có quyền Đào tạo) không đổi được HDC — cả 2 đường (instructor_save, app_dt_update)
  perform set_config('request.jwt.claims', json_build_object('sub', qlk.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_instructor_save(tid, hdc.employee_id); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 17b: Quản lý (không phải PTC / Chủ) đổi được HDC'; end if; end; n := n + 1;
  begin perform public.app_dt_update(tid, jsonb_build_object('instructor_id', hdc.employee_id)); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 17c: Quản lý đổi được HDC qua app_dt_update'; end if; end; n := n + 1;
  if (select instructor_id from public.trainings where id = tid) <> qlk.employee_id then raise exception 'SAI 17d: HDC bị đổi dù đã chặn'; end if; n := n + 1;
  -- Chủ đổi được
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_instructor_save(tid, hdc.employee_id);
  if (select instructor_id from public.trainings where id = tid) <> hdc.employee_id then raise exception 'SAI 17e: Chủ không đổi được HDC'; end if; n := n + 1;
  -- HDC phải có tài khoản đang hoạt động
  insert into public.employees(code, name, rank, status) values ('T148Q', 'Quản lý thử 148', 'Quản lý', 'Đang làm') returning id into nomgr;
  update public.accounts set locked = 1 where employee_id = nomgr;
  perform set_config('request.jwt.claims', json_build_object('sub', ptc.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_instructor_save(tid, nomgr); raise exception 'KHÔNG CHẶN';
  exception when others then e := sqlerrm; if e = 'KHÔNG CHẶN' then raise exception 'SAI 18: HDC không có tài khoản hoạt động mà vẫn chọn được'; end if; end; n := n + 1;
  -- 7. hạng mục ghi trước đây (cột mới mặc định false) vẫn tính đạt
  if exists (select 1 from public.training_marks where cho_kiem_tra and training_id <> tid) then raise exception 'SAI 19: có hạng mục cũ bị chuyển sang Chờ kiểm tra'; end if; n := n + 1;

  raise exception 'REPORT>> ĐẠT % kiểm tra (tệp 148)', n;
end $$;
