-- Bài thử máy chủ cho supabase/152_sua_no_cua_ca.sql trên dữ liệu thật (tự hoàn tác). Gửi CÙNG MỘT LẦN, theo thứ tự:
--   kiem_tra/nguoi_no_151_truoc.sql → supabase/151_nguoi_no.sql (2 lần) → supabase/152_sua_no_cua_ca.sql (2 lần) → kiem_tra/nguoi_no_151.sql → kiem_tra/sua_no_ca_152.sql
-- (bài nguoi_no_151.sql dừng bằng REPORT>> nên khi gửi thật thì gửi HAI bó: bó 1 kết thúc ở nguoi_no_151.sql, bó 2 thay bằng tệp này.)
-- Dùng một ca thật đã Xác nhận Fabi của tháng đang mở; thêm một khoản nợ thử rồi sửa / đổi / xoá; mọi thứ tự hoàn tác. Mỗi dòng bắt đầu bằng ĐẠT hoặc HỎNG.
do $$
declare chu public.accounts; rep text := ''; r public.shift_reports; br bigint; px bigint; d1 bigint; tm0 bigint; tm1 bigint; ck0 bigint; ck1 bigint; n int; t text; j jsonb;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  select id into br from public.branches where status = 'Đang hoạt động' order by id limit 1;
  select x.* into r from public.shift_reports x
   where x.branch_id = br and x.status = 'hoan_thanh' and left(x.work_date, 7) = to_char(public.vn_now(), 'YYYY-MM')
     and coalesce((public.app__stc_ds_state(x.id) ->> 'done')::boolean, false)
     and not (coalesce((public.app__ca_kt_state(x.id) ->> 'need')::boolean, false) and not coalesce((public.app__ca_kt_state(x.id) ->> 'ready')::boolean, false))
     and not public.app__fin_locked(x.branch_id, x.work_date)
   order by x.work_date desc, x.id desc limit 1;
  if r.id is null then raise exception 'REPORT>> %', E'\n    tháng này cơ sở thử chưa có ca nào đã Xác nhận Fabi — bỏ qua (đã thử ở cục bộ)'; end if;
  delete from public.stc_ca_done where report_id = r.id;   -- tự hoàn tác
  select id into px from public.debt_people where branch_id = br and lower(btrim(name)) = 'kho tổng';
  rep := rep || format(E'\n    ca thử %s (%s %s)', r.id, r.work_date, r.shift);

  -- (1) thêm khoản quên ghi TM 20.000 → tiền mặt dư (thực nhận − phải có) tăng 20.000; coi như đã xếp
  tm0 := (public.app__ca_money(r.id) ->> 'tm_left')::bigint;
  d1 := public.app_stc_ca_debt_save(r.id, null, jsonb_build_object('kind', 'muon', 'amount', 20000, 'person_id', px, 'grp', 'kho', 'note', 'thử 152'), 'Bài thử 152');
  tm1 := (public.app__ca_money(r.id) ->> 'tm_left')::bigint;
  rep := rep || E'\n' || case when tm1 - tm0 = 20000 and (select sorted_at is not null from public.shift_debts where id = d1) then 'ĐẠT' else 'HỎNG' end || format(' (1) thêm TM 20.000: TM dư %s → %s', tm0, tm1);

  -- (2) sửa 20.000 → 15.000 → TM dư giảm 5.000; sổ tháng có dấu sửa
  perform public.app_stc_ca_debt_save(r.id, d1, jsonb_build_object('kind', 'muon', 'amount', 15000), 'Bài thử 152');
  tm0 := tm1; tm1 := (public.app__ca_money(r.id) ->> 'tm_left')::bigint;
  select count(*) into n from jsonb_array_elements(public.app_stc_month(br, left(r.work_date, 7)) -> 'ca_debts') x
   where (x ->> 'id')::bigint = d1 and x -> 'edit' ->> 'action' = 'sua' and (x -> 'edit' ->> 'old_amount')::bigint = 20000;
  rep := rep || E'\n' || case when tm1 - tm0 = -5000 and n = 1 then 'ĐẠT' else 'HỎNG' end || format(' (2) sửa 20.000 → 15.000: TM dư %s → %s · dấu sửa ở sổ tháng %s', tm0, tm1, n);

  -- (3) đổi thành Luân chuyển: TM dư không đổi, CK dư giảm 15.000 (chuyển khoản phải có tăng)
  ck0 := (public.app__ca_money(r.id) ->> 'ck_left')::bigint;
  perform public.app_stc_ca_debt_to_exchange(r.id, d1, 'Bài thử 152');
  ck1 := (public.app__ca_money(r.id) ->> 'ck_left')::bigint; tm0 := tm1; tm1 := (public.app__ca_money(r.id) ->> 'tm_left')::bigint;
  select count(*) into n from jsonb_array_elements(public.app_stc_month(br, left(r.work_date, 7)) -> 'ca_debts') x where (x ->> 'id')::bigint = d1 and x ->> 't' = 'xoa' and x -> 'edit' ->> 'action' = 'doi';
  rep := rep || E'\n' || case when tm1 = tm0 and ck1 - ck0 = -15000 and n = 1 then 'ĐẠT' else 'HỎNG' end || format(' (3) đổi thành Luân chuyển: TM dư %s → %s · CK dư %s → %s · dòng đã đổi ở sổ tháng %s', tm0, tm1, ck0, ck1, n);

  -- (4) nợ hoá đơn thật của ca (nếu có) không sửa được
  select id into d1 from public.shift_debts where report_id = r.id and coalesce(kind, 'bill') = 'bill' and split_from is null limit 1;
  if d1 is not null then
    begin perform public.app_stc_ca_debt_delete(r.id, d1, 'thử'); t := 'XOÁ ĐƯỢC'; exception when others then t := sqlerrm; end;
    rep := rep || E'\n' || case when t like '%Nợ hoá đơn không sửa ở đây%' then 'ĐẠT' else 'HỎNG' end || ' (4) xoá nợ hoá đơn: ' || t;
  else
    rep := rep || E'\n    (4) ca thử không có nợ hoá đơn — bỏ qua';
  end if;

  raise exception 'REPORT>> %', rep;
end $$;
