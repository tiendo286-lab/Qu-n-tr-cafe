-- Bài thử tệp 194 (lý do Đổi ca, khỏi duyệt). Gửi CÙNG một lần: phần TRƯỚC → nội dung tệp 194 (chỗ -- @@194@@) → phần SAU.
-- Phần SAU kết thúc bằng lỗi có chủ ý "REPORT>> …" nên mọi thứ tự hoàn tác. Đạt: "REPORT>> ĐẠT n/n".

create temp table _cv194_truoc on commit drop as
  select r.id, public.app__cv_state(r.id) st from public.shift_reports r
   where r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD') and r.status in ('hoan_thanh', 'dang_chot');

-- @@194@@

do $t$
declare chu uuid; qlt uuid; ok text[] := '{}'; bad text[] := '{}'; n int; rid bigint; st text; ab bigint; hp bigint; c public.shift_covers; v public.shift_cover_reviews;
  a1 int; a2 int; mon text; nt0 bigint; nt1 bigint;
begin
  select auth_user_id into chu from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  select auth_user_id into qlt from public.accounts where system_role = 'ql_tong' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', coalesce(qlt, chu)::text, true);

  select count(*) into n from _cv194_truoc t where public.app__cv_state(t.id) is distinct from t.st;
  if n = 0 then ok := array_append(ok, format('1 trạng thái %s ca cũ không đổi', (select count(*) from _cv194_truoc))); else bad := array_append(bad, format('1 có %s ca đổi trạng thái', n)); end if;

  if not has_function_privilege('authenticated', 'public.app__cv_auto_ok(bigint,bigint)', 'execute') and not has_function_privilege('anon', 'public.app__cv_auto_ok(bigint,bigint)', 'execute')
     and has_function_privilege('authenticated', 'public.app_cv_save(bigint,jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.app__cv_write(bigint,jsonb)', 'execute')
  then ok := array_append(ok, '2 quyền gọi đúng'); else bad := array_append(bad, '2 quyền gọi sai'); end if;

  if public.app__cv_label('doi_ca') like 'Đổi ca%' then ok := array_append(ok, '3 tên lý do'); else bad := array_append(bad, '3 tên lý do sai'); end if;

  -- ca đúng 1 người nghỉ + 1 người hỗ trợ, chưa hoàn thành đối soát, tháng còn mở
  select r.id into rid from public.shift_reports r
   where r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD') and r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and public.app__cv_open(r.work_date)
     and (select count(*) filter (where kind = 'nghi') from public.app__cv_people(r.id)) = 1 and (select count(*) filter (where kind = 'ho_tro') from public.app__cv_people(r.id)) = 1
   order by r.work_date desc limit 1;
  if rid is null then raise exception 'REPORT>> KHÔNG CÓ CA THỬ · đạt: % · hỏng: %', array_to_string(ok, ' · '), array_to_string(bad, ' · '); end if;
  select employee_id into ab from public.app__cv_people(rid) where kind = 'nghi'; select employee_id into hp from public.app__cv_people(rid) where kind = 'ho_tro';
  select substr(work_date, 1, 7) into mon from public.shift_reports where id = rid;
  delete from public.shift_covers where report_id = rid; delete from public.shift_cover_reviews where report_id = rid;
  select count(*) into nt0 from public.notifications;

  -- 4. Quản lý tổng lưu Đổi ca (cố tình gửi x2 = true) → xong luôn, x2 bị bỏ, không trừ, không phạt
  st := public.app_cv_save(rid, jsonb_build_array(jsonb_build_object('absent_id', ab, 'reason', 'doi_ca', 'helper_id', hp, 'x2', true)));
  select * into c from public.shift_covers where report_id = rid; select * into v from public.shift_cover_reviews where report_id = rid;
  if st = 'da_duyet' and c.reason = 'doi_ca' and not c.x2 and c.deduct_hours = 0 and c.fine = 0 and v.ok_at is not null and v.ok_note like 'Đổi ca%'
  then ok := array_append(ok, '4 lưu Đổi ca: đã duyệt luôn, x2 bỏ, không trừ / phạt'); else bad := array_append(bad, '4 lưu Đổi ca ra ' || coalesce(st, '?') || ' x2=' || coalesce(c.x2::text, '?')); end if;
  select count(*) into nt1 from public.notifications;
  if nt1 = nt0 then ok := array_append(ok, '5 không gửi thông báo nào'); else bad := array_append(bad, format('5 có %s thông báo', nt1 - nt0)); end if;
  if not exists (select 1 from jsonb_array_elements(public.app_cv_todo()) x where (x ->> 'id')::bigint = rid)
     and exists (select 1 from jsonb_array_elements(public.app_cv_done(mon)) x where (x ->> 'id')::bigint = rid)
  then ok := array_append(ok, '6 ca rời danh sách chờ, nằm ở Đã duyệt'); else bad := array_append(bad, '6 danh sách sai'); end if;

  -- 7. Bảng công: Đổi ca không tính là nghỉ; đổi sang lý do khác thì lại tính
  perform set_config('request.jwt.claim.sub', chu::text, true);
  select (x ->> 'absent')::int into a1 from jsonb_array_elements(public.app_bang_cong(mon) -> 'rows') x where (x ->> 'employee_id')::bigint = ab;
  perform set_config('request.jwt.claim.sub', coalesce(qlt, chu)::text, true);
  st := public.app_cv_save(rid, jsonb_build_array(jsonb_build_object('absent_id', ab, 'reason', 'tu_tim', 'helper_id', hp, 'x2', false)));
  if st = 'cho_duyet' and exists (select 1 from public.shift_cover_reviews where report_id = rid and ok_at is null)
  then ok := array_append(ok, '8 đổi sang lý do khác: quay lại Chờ Chủ duyệt'); else bad := array_append(bad, '8 đổi lý do ra ' || coalesce(st, '?')); end if;
  perform set_config('request.jwt.claim.sub', chu::text, true);
  perform public.app_cv_approve(rid, null, '');
  select (x ->> 'absent')::int into a2 from jsonb_array_elements(public.app_bang_cong(mon) -> 'rows') x where (x ->> 'employee_id')::bigint = ab;
  if a2 = a1 + 1 then ok := array_append(ok, format('7 bảng công: Đổi ca %s ca nghỉ, lý do khác %s', a1, a2)); else bad := array_append(bad, format('7 bảng công %s / %s', a1, a2)); end if;

  -- 9. Lưu từng người với Đổi ca cũng xong luôn
  perform set_config('request.jwt.claim.sub', coalesce(qlt, chu)::text, true);
  delete from public.shift_covers where report_id = rid; delete from public.shift_cover_reviews where report_id = rid;
  st := public.app_cv_save_one(rid, jsonb_build_object('absent_id', ab, 'reason', 'doi_ca', 'helper_id', hp, 'x2', false));
  if st = 'da_duyet' then ok := array_append(ok, '9 lưu từng người Đổi ca: đã duyệt luôn'); else bad := array_append(bad, '9 lưu từng người ra ' || coalesce(st, '?')); end if;

  -- 10. Đổi ca phải gắn với người nghỉ
  begin perform public.app_cv_save(rid, jsonb_build_array(jsonb_build_object('absent_id', null, 'reason', 'doi_ca', 'helper_id', hp))); bad := array_append(bad, '10 Đổi ca không người nghỉ mà lưu được');
  exception when others then ok := array_append(ok, '10 Đổi ca phải gắn người nghỉ'); end;

  raise exception 'REPORT>> % %/% · đạt: % · hỏng: %', case when cardinality(bad) = 0 then 'ĐẠT' else 'HỎNG' end, cardinality(ok), cardinality(ok) + cardinality(bad), array_to_string(ok, ' · '), array_to_string(bad, ' · ');
end $t$;
