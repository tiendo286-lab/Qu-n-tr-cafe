-- Bài thử CỤC BỘ cho supabase/163_lich_su_dao_tao.sql (chặng 4, anh Tiến duyệt thiết kế 21/11 + chốt làm cả 2 đợt 22/11):
-- sổ lịch sử mọi lần tích / bỏ tích / chọn mức / Xác nhận đạt / đào tạo lại; chạy bù phiếu cũ; nhận xét + xác nhận theo NGÀY THẬT; xem lịch sử.
-- Postgres cục bộ (seed: Chủ, Quản lý tổng, 2 Quản lý, NV Cấp 1, NV thử việc, Kế toán). REPORT>> tự hoàn tác.
--   PG_DIR=<thư mục> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/lich_su_dao_tao_163_cuc_bo.sql
do $$
declare chu public.accounts; hdc public.accounts; qlt public.accounts; c1 public.accounts; tv public.accounts; kt public.accounts;
  rep text := ''; tid bigint; n0 int; n1 int; e text; j jsonb; l public.training_mark_log; today text := left(public.vn_now_text(), 10);
  as_ public.accounts;
begin
  select * into chu from public.accounts where system_role = 'chu' and auth_user_id is not null order by id limit 1;
  select a.* into hdc from public.accounts a join public.employees x on x.id = a.employee_id where a.auth_user_id is not null and a.system_role = 'ql' and x.rank = 'Quản lý' order by a.id limit 1;
  select * into qlt from public.accounts where system_role = 'ql_tong' and auth_user_id is not null order by id limit 1;
  select a.* into c1 from public.accounts a join public.employees x on x.id = a.employee_id where a.auth_user_id is not null and x.rank = 'Cấp 1' order by a.id limit 1;
  select a.* into tv from public.accounts a join public.employees x on x.id = a.employee_id where a.auth_user_id is not null and x.rank = 'Thử việc' order by a.id limit 1;
  select * into kt from public.accounts where system_role = 'ke_toan' and auth_user_id is not null order by id limit 1;
  insert into public.training_review_config(singleton, account_id) values (true, qlt.id) on conflict (singleton) do update set account_id = excluded.account_id;
  perform set_config('request.jwt.claims', json_build_object('sub', chu.auth_user_id, 'role', 'authenticated')::text, true);
  tid := public.app_dt_create(tv.employee_id, jsonb_build_object('start_date', to_char(public.vn_now()::date - 2, 'YYYY-MM-DD'), 'instructor_id', hdc.employee_id));

  -- (1) HDC tích "Đã giới thiệu" mục 1 → đúng 1 dòng gioi_thieu, tên HDC, ngày Việt Nam hôm nay
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_mark(tid, 1, jsonb_build_object('introduced', true));
  select count(*) into n0 from public.training_mark_log where training_id = tid and item_no = 1;
  select * into l from public.training_mark_log where training_id = tid and item_no = 1 order by id desc limit 1;
  rep := rep || E'\n' || case when n0 = 1 and l.kind = 'gioi_thieu' and l.by_account = hdc.id and l.day = today and l.old is not null is false then 'ĐẠT' else 'HỎNG' end
        || format(' (1) giới thiệu: %s dòng, loại %s, ngày %s', n0, l.kind, l.day);

  -- (2) thực hành + mức Khá → 1 dòng muc (cũ → mới)
  perform public.app_dt_mark(tid, 1, jsonb_build_object('practiced', true, 'level', 'kha'));
  select * into l from public.training_mark_log where training_id = tid and item_no = 1 order by id desc limit 1;
  rep := rep || E'\n' || case when l.kind = 'muc' and l.new ->> 'level' = 'kha' and (l.old ->> 'practiced')::boolean = false then 'ĐẠT' else 'HỎNG' end
        || format(' (2) thực hành + mức: loại %s, cũ %s → mới %s', l.kind, l.old, l.new);

  -- (3) lưu lại y nguyên → không thêm dòng
  select count(*) into n0 from public.training_mark_log where training_id = tid;
  perform public.app_dt_mark(tid, 1, jsonb_build_object('level', 'kha'));
  select count(*) into n1 from public.training_mark_log where training_id = tid;
  rep := rep || E'\n' || case when n1 = n0 then 'ĐẠT' else 'HỎNG' end || format(' (3) lưu lại không đổi gì: %s → %s dòng', n0, n1);

  -- (4) đào tạo lại, ra CÙNG mức cũ → vẫn có dòng dao_tao_lai
  perform public.app_dt_mark(tid, 1, jsonb_build_object('level', 'kha', 'relearn', true));
  select * into l from public.training_mark_log where training_id = tid and item_no = 1 order by id desc limit 1;
  rep := rep || E'\n' || case when l.kind = 'dao_tao_lai' and l.new ->> 'level' = 'kha' then 'ĐẠT' else 'HỎNG' end || format(' (4) đào tạo lại cùng mức: loại %s', l.kind);

  -- (5) Cấp 1 được giao mục 2 ghi mức → dòng muc có dấu chờ kiểm tra; (6) HDC Xác nhận đạt → dòng xac_nhan tên HDC
  perform public.app_dt_followup_save(tid, 2, c1.employee_id, null, false, null);
  perform set_config('request.jwt.claims', json_build_object('sub', c1.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_mark(tid, 2, jsonb_build_object('introduced', true, 'practiced', true, 'level', 'tb'));
  select * into l from public.training_mark_log where training_id = tid and item_no = 2 order by id desc limit 1;
  rep := rep || E'\n' || case when l.kind = 'muc' and l.pending and l.by_account = c1.id then 'ĐẠT' else 'HỎNG' end || format(' (5) Cấp 1 ghi mức: loại %s, chờ kiểm tra %s', l.kind, l.pending);
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_check_ok(tid, 2);
  select * into l from public.training_mark_log where training_id = tid and item_no = 2 order by id desc limit 1;
  rep := rep || E'\n' || case when l.kind = 'xac_nhan' and l.by_account = hdc.id and not l.pending then 'ĐẠT' else 'HỎNG' end || format(' (6) Xác nhận đạt: loại %s, người %s', l.kind, l.by_account = hdc.id);

  -- (7) bỏ tích → dòng bo_tich
  perform public.app_dt_mark(tid, 3, jsonb_build_object('introduced', true));
  perform public.app_dt_mark(tid, 3, jsonb_build_object('introduced', false));
  select * into l from public.training_mark_log where training_id = tid and item_no = 3 order by id desc limit 1;
  rep := rep || E'\n' || case when l.kind = 'bo_tich' then 'ĐẠT' else 'HỎNG' end || format(' (7) bỏ tích: loại %s', l.kind);

  -- (8) tích lúc 23:30 giờ Việt Nam thuộc đúng ngày đó
  insert into public.training_marks(training_id, item_no, introduced, practiced, level, by_account, at) values (tid, 4, true, false, null, hdc.id, '2026-11-20 23:30:00');
  select * into l from public.training_mark_log where training_id = tid and item_no = 4 order by id desc limit 1;
  rep := rep || E'\n' || case when l.day = '2026-11-20' then 'ĐẠT' else 'HỎNG' end || format(' (8) tích 23:30 ngày 20/11 → ngày %s', l.day);

  -- (9) chạy bù phiếu cũ: mục ghi trước khi có sổ (không qua sổ) → 1 dòng ghi_cu (+ 1 dòng xác nhận nếu đã xác nhận); chạy lại không nhân đôi
  perform set_config('app.dt_nolog', '1', true);
  insert into public.training_marks(training_id, item_no, introduced, practiced, level, by_account, at, checked_by, checked_at) values (tid, 5, true, true, 'tot', hdc.id, '2026-11-19 10:00:00', hdc.id, '2026-11-19 10:00:00');
  perform set_config('app.dt_nolog', '', true);
  n0 := public.app__dt_log_backfill(); n1 := public.app__dt_log_backfill();
  rep := rep || E'\n' || case when n0 = 2 and n1 = 0 and (select count(*) from public.training_mark_log where training_id = tid and item_no = 5) = 2 then 'ĐẠT' else 'HỎNG' end
        || format(' (9) chạy bù: lần 1 thêm %s dòng, lần 2 thêm %s', n0, n1);

  -- (10) xem lịch sử: người học xem được (kèm tên người tích); kế toán không liên quan bị chặn
  perform set_config('request.jwt.claims', json_build_object('sub', tv.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_history(tid);
  rep := rep || E'\n' || case when jsonb_array_length(j -> 'log') >= 8 and (j -> 'log' -> 0 ->> 'by') is not null then 'ĐẠT' else 'HỎNG' end
        || format(' (10a) người học xem lịch sử: %s dòng, dòng đầu do %s', jsonb_array_length(j -> 'log'), j -> 'log' -> 0 ->> 'by');
  perform set_config('request.jwt.claims', json_build_object('sub', kt.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_history(tid); e := 'XEM ĐƯỢC'; exception when others then e := sqlerrm; end;
  rep := rep || E'\n' || case when e <> 'XEM ĐƯỢC' then 'ĐẠT' else 'HỎNG' end || ' (10b) kế toán không liên quan → ' || e;

  -- (11) nhận xét / xác nhận theo ngày thật: chỉ ngày đã có lần tích; người học xác nhận phần mình, HDC phần người hướng dẫn
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_dnote_comment(tid, today, 'Hôm nay học tốt mục 1');
  begin perform public.app_dt_dnote_comment(tid, '2026-01-01', 'x'); e := 'GHI ĐƯỢC'; exception when others then e := sqlerrm; end;
  perform public.app_dt_dnote_confirm(tid, today, 'hd', true);
  perform set_config('request.jwt.claims', json_build_object('sub', c1.auth_user_id, 'role', 'authenticated')::text, true);
  begin perform public.app_dt_dnote_confirm(tid, today, 'nv', true); as_ := null; exception when others then as_ := c1; end;
  perform set_config('request.jwt.claims', json_build_object('sub', tv.auth_user_id, 'role', 'authenticated')::text, true);
  perform public.app_dt_dnote_confirm(tid, today, 'nv', true);
  j := public.app_dt_history(tid);
  rep := rep || E'\n' || case when e <> 'GHI ĐƯỢC' and as_.id is not null
                                   and (select x ->> 'comment' from jsonb_array_elements(j -> 'notes') x where x ->> 'day' = today) = 'Hôm nay học tốt mục 1'
                                   and (select (x ->> 'trainee_at') is not null and (x ->> 'instructor_by') is not null from jsonb_array_elements(j -> 'notes') x where x ->> 'day' = today)
                              then 'ĐẠT' else 'HỎNG' end
        || format(' (11) nhận xét theo ngày thật: ngày không có lần tích → %s; Cấp 1 xác nhận thay người học bị chặn: %s', e, as_.id is not null);

  -- (12) phiếu vẫn mở như cũ (app_dt_get không đổi)
  perform set_config('request.jwt.claims', json_build_object('sub', hdc.auth_user_id, 'role', 'authenticated')::text, true);
  j := public.app_dt_get(tid);
  rep := rep || E'\n' || case when jsonb_array_length(j -> 'items') = 68 and j ? 'can_check' and j ? 'followups' then 'ĐẠT' else 'HỎNG' end || ' (12) app_dt_get vẫn đủ khoá như cũ';
  raise exception 'REPORT>> %', rep;
end $$;
