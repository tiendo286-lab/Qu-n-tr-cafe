-- KIỂM TRA tệp 126 (sửa app__pc_tick: bí danh bảng "sc" trùng biến record "sc" → lỗi "record sc is not assigned yet"
-- mỗi khi cần tạo dòng việc con hàng hoá job 11–14, làm app_pc_mine / app_pc_all hỏng). Ghép supabase/126_sua_pc_tick_bi_danh.sql vào đầu.
-- Khối DO luôn kết thúc bằng RAISE 'REPORT>> …' nên mọi thay đổi tự hoàn tác.
do $$ declare q public.accounts; n_cho int; begin
  select * into q from public.accounts where system_role = 'ql' and auth_user_id is not null and locked = 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', q.auth_user_id, 'role', 'authenticated')::text, true);
  update public.settings set value = '2000-01-01 00:00:00' where key = 'pc_tick_at';   -- ép tick chạy
  perform public.app_pc_mine();
  select count(*) into n_cho from public.app__pc_sources() x join public.pc_jobs j on j.job = x.job and j.enabled
   where x.job in (11, 12, 13, 14) and not exists (select 1 from public.pc_items i where i.key = x.job || ':' || x.key)
     and exists (select 1 from public.pc_tasks t where t.job = x.job and t.done_at is null and t.branch_id is not distinct from x.branch_id);
  assert n_cho = 0, 'Còn việc con hàng hoá chưa được tạo: ' || n_cho;
  raise exception 'REPORT>> PASS 126: app_pc_mine chạy được, việc con hàng hoá đã tạo đủ';
end $$;
