-- Bài thử tệp 186 (lưu riêng từng người ở Nghỉ & làm thay). Chạy trong CÙNG một lần gửi, theo thứ tự:
--   (1) phần "TRƯỚC" dưới đây  →  (2) nội dung supabase/186_nghi_thay_luu_tung_nguoi.sql  →  (3) phần "SAU".
-- Phần SAU kết thúc bằng lỗi có chủ ý "REPORT>> …" nên mọi thứ tự hoàn tác (không lưu gì lên máy chủ).
-- Đạt: "REPORT>> ĐẠT n/n …". Tệp này ghép sẵn bằng dòng đánh dấu  -- @@186@@  (chỗ chèn tệp 186).

-- ===== TRƯỚC: chụp trạng thái mọi ca 60 ngày gần đây bằng hàm CŨ =====
create temp table _cv186_truoc on commit drop as
  select r.id, public.app__cv_state(r.id) st from public.shift_reports r
   where r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD') and r.status in ('hoan_thanh', 'dang_chot');

-- @@186@@

-- ===== SAU =====
do $t$
declare acc bigint; uid uuid; ok text[] := '{}'; bad text[] := '{}'; n int; rid bigint; st text; msg text; p record; items jsonb; k int := 0; np int;
begin
  select id, auth_user_id into acc, uid from public.accounts where system_role = 'chu' and locked = 0 and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub', uid::text, true);

  -- 1. Dữ liệu đang có: không ca nào đổi trạng thái vì hàm mới
  select count(*) into n from _cv186_truoc t where public.app__cv_state(t.id) is distinct from t.st;
  if n = 0 then ok := array_append(ok, (format('1 trạng thái %s ca cũ không đổi', (select count(*) from _cv186_truoc)))::text); else bad := array_append(bad, (format('1 có %s ca đổi trạng thái', n))::text); end if;

  -- 2. Quyền gọi
  if has_function_privilege('authenticated', 'public.app_cv_save_one(bigint,jsonb)', 'execute')
     and not has_function_privilege('anon', 'public.app_cv_save_one(bigint,jsonb)', 'execute')
     and not has_function_privilege('authenticated', 'public.app__cv_write(bigint,jsonb,boolean)', 'execute')
  then ok := array_append(ok, ('2 quyền gọi đúng')::text); else bad := array_append(bad, ('2 quyền gọi sai')::text); end if;

  -- Chọn 1 ca chưa hoàn thành đối soát, tháng còn mở, có từ 2 người nghỉ / hỗ trợ
  select r.id into rid from public.shift_reports r
   where r.work_date >= to_char(public.vn_now()::date - 60, 'YYYY-MM-DD') and r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh'
     and public.app__cv_open(r.work_date) and (select count(*) from public.app__cv_people(r.id)) >= 2
   order by r.work_date desc limit 1;
  if rid is null then raise exception 'REPORT>> KHÔNG CÓ CA THỬ (không ca nào có từ 2 người nghỉ / hỗ trợ) · đạt: % · hỏng: %', array_to_string(ok, ' · '), array_to_string(bad, ' · '); end if;
  select count(*) into np from public.app__cv_people(rid);
  delete from public.shift_covers where report_id = rid; delete from public.shift_cover_reviews where report_id = rid;

  -- 3. Lưu lần lượt từng người; trước người cuối ca vẫn "chưa phân loại", Chủ chưa duyệt được
  for p in select * from public.app__cv_people(rid) order by kind desc, employee_id loop
    k := k + 1;
    st := public.app_cv_save_one(rid, case when p.kind = 'nghi' then jsonb_build_object('absent_id', p.employee_id, 'reason', 'ma_chay')
                                           else jsonb_build_object('absent_id', null, 'reason', 'thieu_lich', 'helper_id', p.employee_id, 'x2', false) end);
    if k = 1 then
      if st = 'chua_phan_loai' and (select count(*) from public.shift_covers where report_id = rid) = 1
         and not exists (select 1 from public.shift_cover_reviews where report_id = rid and set_at is not null)
      then ok := array_append(ok, ('3 lưu 1 người: ca vẫn chưa phân loại, 1 dòng')::text); else bad := array_append(bad, (('3 lưu 1 người ra ' || st))::text); end if;
      begin perform public.app_cv_approve(rid, null, ''); bad := array_append(bad, ('4 ca lưu dở mà Chủ duyệt được')::text);
      exception when others then msg := sqlerrm; if msg like 'Chưa phân loại đủ%' then ok := array_append(ok, ('4 ca lưu dở Chủ chưa duyệt được')::text); else bad := array_append(bad, (('4 ' || msg))::text); end if; end;
      if exists (select 1 from jsonb_array_elements(public.app_cv_todo()) x where (x ->> 'id')::bigint = rid and x ->> 'state' = 'chua_phan_loai')
      then ok := array_append(ok, ('5 ca lưu dở nằm ở danh sách chờ phân loại')::text); else bad := array_append(bad, ('5 ca lưu dở không ở danh sách chờ')::text); end if;
    end if;
  end loop;
  if st = 'cho_duyet' and (select count(*) from public.shift_covers where report_id = rid) = np
     and exists (select 1 from public.shift_cover_reviews where report_id = rid and set_at is not null and ok_at is null)
  then ok := array_append(ok, (format('6 lưu đủ %s người: sang chờ Chủ duyệt', np))::text); else bad := array_append(bad, (('6 lưu đủ ra ' || coalesce(st, '?')))::text); end if;

  -- 7. Lưu lại 1 người đã lưu (đổi lý do) không sinh dòng thừa
  select * into p from public.app__cv_people(rid) order by kind desc, employee_id limit 1;
  if p.kind = 'nghi' then
    st := public.app_cv_save_one(rid, jsonb_build_object('absent_id', p.employee_id, 'reason', 'tu_tim'));
    if st = 'cho_duyet' and (select count(*) from public.shift_covers where report_id = rid) = np
       and (select reason from public.shift_covers where report_id = rid and absent_id = p.employee_id) = 'tu_tim'
    then ok := array_append(ok, ('7 lưu lại 1 người: đổi lý do, không thừa dòng')::text); else bad := array_append(bad, (('7 lưu lại ra ' || st))::text); end if;
  else ok := array_append(ok, ('7 (ca không có người nghỉ — bỏ qua)')::text); end if;

  -- 8. Thiếu lý do thì báo, không ghi
  begin perform public.app_cv_save_one(rid, jsonb_build_object('absent_id', p.employee_id, 'reason', '')); bad := array_append(bad, ('8 thiếu lý do vẫn lưu')::text);
  exception when others then msg := sqlerrm; if msg like 'Chọn lý do%' or msg like 'Lý do%' then ok := array_append(ok, ('8 thiếu lý do bị chặn')::text); else bad := array_append(bad, (('8 ' || msg))::text); end if; end;

  -- 9. Lưu cả ca kiểu cũ và Chủ duyệt vẫn chạy
  select jsonb_agg(jsonb_build_object('absent_id', c.absent_id, 'reason', c.reason, 'helper_id', c.helper_id, 'helper_name', c.helper_name, 'hours', c.hours, 'x2', c.x2))
    into items from public.shift_covers c where c.report_id = rid;
  st := public.app_cv_save(rid, items);
  if st = 'cho_duyet' then st := public.app_cv_approve(rid, null, ''); end if;
  if st = 'da_duyet' then ok := array_append(ok, ('9 Lưu cả ca + Chủ duyệt như cũ')::text); else bad := array_append(bad, (('9 ra ' || st))::text); end if;

  -- 10. Ca đã duyệt, lưu 1 người (đủ người) → về chờ Chủ duyệt, bỏ dấu duyệt
  st := public.app_cv_save_one(rid, (select jsonb_build_object('absent_id', c.absent_id, 'reason', c.reason, 'helper_id', c.helper_id, 'helper_name', c.helper_name, 'hours', c.hours, 'x2', c.x2)
                                       from public.shift_covers c where c.report_id = rid order by c.id limit 1));
  if st = 'cho_duyet' then ok := array_append(ok, ('10 sửa 1 người ở ca đã duyệt → chờ duyệt lại')::text); else bad := array_append(bad, (('10 ra ' || st))::text); end if;

  raise exception 'REPORT>> % %/% · ca thử có % người · % %', case when cardinality(bad) = 0 then 'ĐẠT' else 'HỎNG' end, cardinality(ok), cardinality(ok) + cardinality(bad), np,
    array_to_string(ok, ' · '), case when cardinality(bad) > 0 then ' ||| HỎNG: ' || array_to_string(bad, ' · ') else '' end;
end $t$;
