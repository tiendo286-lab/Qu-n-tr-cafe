-- 194 (anh Tiến chốt 28/11/2026): lý do "ĐỔI CA (lịch chưa sửa)" ở Nghỉ & làm thay.
-- Thực tế hai bạn đổi ca nhưng quản lý chưa kịp sửa lịch trên app → web thấy "người có lịch nghỉ + người hỗ trợ".
-- Anh Tiến chọn: thêm lý do "Đổi ca", KHỎI DUYỆT — không ai bị trừ, không ai x2, không tính là nghỉ.
--   · shift_covers.reason nhận thêm 'doi_ca'; dòng 'doi_ca' luôn x2 = false, trừ giờ = 0, phạt = 0.
--   · Ca mà MỌI dòng đều là 'doi_ca' → lưu xong là "đã duyệt" luôn (app__cv_auto_ok), không báo Chủ, không báo nhân viên.
--     Ca có lẫn lý do khác → vẫn Chờ Chủ duyệt như cũ.
--   · Bảng công: ca nghỉ có lý do 'doi_ca' (đã duyệt) không đếm vào cột số ca nghỉ.
-- Các hàm dưới đây lấy nguyên bản đang chạy (sau tệp 193), chỉ đổi đúng các chỗ ghi "194". Chạy lại nhiều lần không sao.

-- 1) Cho phép lý do mới
alter table public.shift_covers drop constraint if exists shift_covers_reason_check;
alter table public.shift_covers add constraint shift_covers_reason_check
  check (reason = any (array['tu_tim'::text, 'nho_ql'::text, 'ma_chay'::text, 'thieu_lich'::text, 'bo_ca'::text, 'doi_ca'::text]));

-- 2) Tên hiển thị
CREATE OR REPLACE FUNCTION public.app__cv_label(p_reason text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_reason when 'tu_tim' then 'Tự tìm người thay' when 'nho_ql' then 'Nhờ quản lý tìm người'
                       when 'ma_chay' then 'Quản lý đồng ý cho nghỉ (không trừ lương)' when 'bo_ca' then 'Bỏ ca (phạt 200.000đ)' when 'thieu_lich' then 'Quản lý không xếp đủ lịch' when 'doi_ca' then 'Đổi ca (lịch chưa sửa)' else p_reason end
$function$;

-- 3) Ghi phân loại: nhận 'doi_ca'; dòng 'doi_ca' không bao giờ x2 (194)
CREATE OR REPLACE FUNCTION public.app__cv_write(p_id bigint, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x jsonb; na bigint[]; nh bigint[]; wk bigint[]; seen_a bigint[] := '{}'; seen_h bigint[] := '{}'; ab bigint; hp bigint; hn text; rs text; hrs numeric; ph numeric;
begin
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' then raise exception 'Dữ liệu phân loại không hợp lệ.'; end if;
  select coalesce(array_agg(employee_id) filter (where kind = 'nghi'), '{}'), coalesce(array_agg(employee_id) filter (where kind = 'ho_tro'), '{}')
    into na, nh from public.app__cv_people(p_id);
  -- bước 47: người trong lịch có làm ở ca cũng chọn được làm người làm thay / được x2
  select coalesce(array_agg((s ->> 'employee_id')::bigint), '{}') into wk
    from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s where coalesce((s ->> 'worked')::boolean, true);
  delete from public.shift_covers where report_id = p_id;
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    ab := nullif(x ->> 'absent_id', '')::bigint; hp := nullif(x ->> 'helper_id', '')::bigint; hn := nullif(trim(coalesce(x ->> 'helper_name', '')), '');
    rs := x ->> 'reason';
    if rs not in ('tu_tim', 'nho_ql', 'ma_chay', 'thieu_lich', 'bo_ca', 'doi_ca') then raise exception 'Chọn lý do cho từng người.'; end if;
    if coalesce((x ->> 'x2')::boolean, false) and hp is null and hn is null then raise exception 'Tích x2 thì chọn người được x2.'; end if;
    if ab is not null and not (ab = any(na)) then raise exception 'Người nghỉ không có trong ca (danh sách nhân sự đã đổi, tải lại trang).'; end if;
    if ab is not null and ab = any(seen_a) then raise exception 'Mỗi người nghỉ chỉ phân loại 1 lần.'; end if;
    if ab is null and rs <> 'thieu_lich' then raise exception 'Lý do "%" phải gắn với người nghỉ.', public.app__cv_label(rs); end if;
    if ab is not null and rs = 'thieu_lich' then raise exception 'Người nghỉ không dùng lý do "Quản lý không xếp đủ lịch".'; end if;
    if hp is not null and not (hp = any(nh) or hp = any(wk)) then raise exception 'Người làm thay / được x2 phải là người có làm trong ca.'; end if;
    if hp is not null and hp = any(seen_h) then raise exception 'Mỗi người hỗ trợ chỉ gắn với 1 dòng.'; end if;
    if hp is null and hn is null and rs in ('nho_ql', 'thieu_lich') then raise exception 'Chọn người làm thay / làm thêm cho lý do "%".', public.app__cv_label(rs); end if;
    select public.app__hours(s ->> 'time_in', s ->> 'time_out') into ph
      from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s where (s ->> 'employee_id')::bigint = hp limit 1;
    hrs := case when hp is not null then coalesce(nullif(x ->> 'hours', '')::numeric, ph, 0) else coalesce(nullif(x ->> 'hours', '')::numeric, 0) end;
    if hrs < 0 or hrs > 24 then raise exception 'Số giờ làm thay không hợp lệ.'; end if;
    if rs = 'nho_ql' and hrs <= 0 then raise exception 'Nhập số giờ người làm thay đã làm (để trừ người nghỉ).'; end if;
    insert into public.shift_covers(report_id, absent_id, reason, helper_id, helper_name, hours, x2, deduct_hours, note, fine)
    values (p_id, ab, rs, hp, case when hp is null then hn end, hrs, coalesce((x ->> 'x2')::boolean, false) and (hp is not null or hn is not null) and rs <> 'doi_ca',
            case when rs = 'nho_ql' then hrs else 0 end, nullif(trim(coalesce(x ->> 'note', '')), ''), case when rs = 'bo_ca' then public.app__cv_fine() else 0 end);
    if ab is not null then seen_a := seen_a || ab; end if;
    if hp is not null then seen_h := seen_h || hp; end if;
  end loop;
  if not (na <@ seen_a) then raise exception 'Còn người nghỉ chưa chọn lý do.'; end if;
  if not (nh <@ seen_h) then raise exception 'Còn người hỗ trợ chưa gắn vào dòng nào (làm thay ai, hoặc "Quản lý không xếp đủ lịch").'; end if;
end $function$;
CREATE OR REPLACE FUNCTION public.app__cv_write(p_id bigint, p_items jsonb, p_partial boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x jsonb; na bigint[]; nh bigint[]; wk bigint[]; seen_a bigint[] := '{}'; seen_h bigint[] := '{}'; ab bigint; hp bigint; hn text; rs text; hrs numeric; ph numeric;
begin
  if jsonb_typeof(coalesce(p_items, '[]')) <> 'array' then raise exception 'Dữ liệu phân loại không hợp lệ.'; end if;
  select coalesce(array_agg(employee_id) filter (where kind = 'nghi'), '{}'), coalesce(array_agg(employee_id) filter (where kind = 'ho_tro'), '{}')
    into na, nh from public.app__cv_people(p_id);
  select coalesce(array_agg((s ->> 'employee_id')::bigint), '{}') into wk
    from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s where coalesce((s ->> 'worked')::boolean, true);
  delete from public.shift_covers where report_id = p_id;
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    ab := nullif(x ->> 'absent_id', '')::bigint; hp := nullif(x ->> 'helper_id', '')::bigint; hn := nullif(trim(coalesce(x ->> 'helper_name', '')), '');
    rs := x ->> 'reason';
    if rs is null or rs not in ('tu_tim', 'nho_ql', 'ma_chay', 'thieu_lich', 'bo_ca', 'doi_ca') then raise exception 'Chọn lý do cho từng người.'; end if;
    if coalesce((x ->> 'x2')::boolean, false) and hp is null and hn is null then raise exception 'Tích x2 thì chọn người được x2.'; end if;
    if ab is not null and not (ab = any(na)) then raise exception 'Người nghỉ không có trong ca (danh sách nhân sự đã đổi, tải lại trang).'; end if;
    if ab is not null and ab = any(seen_a) then raise exception 'Mỗi người nghỉ chỉ phân loại 1 lần.'; end if;
    if ab is null and rs <> 'thieu_lich' then raise exception 'Lý do "%" phải gắn với người nghỉ.', public.app__cv_label(rs); end if;
    if ab is not null and rs = 'thieu_lich' then raise exception 'Người nghỉ không dùng lý do "Quản lý không xếp đủ lịch".'; end if;
    if hp is not null and not (hp = any(nh) or hp = any(wk)) then raise exception 'Người làm thay / được x2 phải là người có làm trong ca.'; end if;
    if hp is not null and hp = any(seen_h) then raise exception 'Người làm thay này đã được chọn cho người nghỉ khác trong ca. Mỗi người hỗ trợ chỉ gắn với 1 dòng.'; end if;
    if hp is null and hn is null and rs in ('nho_ql', 'thieu_lich') then raise exception 'Chọn người làm thay / làm thêm cho lý do "%".', public.app__cv_label(rs); end if;
    select public.app__hours(s ->> 'time_in', s ->> 'time_out') into ph
      from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s where (s ->> 'employee_id')::bigint = hp limit 1;
    hrs := case when hp is not null then coalesce(nullif(x ->> 'hours', '')::numeric, ph, 0) else coalesce(nullif(x ->> 'hours', '')::numeric, 0) end;
    if hrs < 0 or hrs > 24 then raise exception 'Số giờ làm thay không hợp lệ.'; end if;
    if rs = 'nho_ql' and hrs <= 0 then raise exception 'Nhập số giờ người làm thay đã làm (để trừ người nghỉ).'; end if;
    insert into public.shift_covers(report_id, absent_id, reason, helper_id, helper_name, hours, x2, deduct_hours, note, fine)
    values (p_id, ab, rs, hp, case when hp is null then hn end, hrs, coalesce((x ->> 'x2')::boolean, false) and (hp is not null or hn is not null) and rs <> 'doi_ca',
            case when rs = 'nho_ql' then hrs else 0 end, nullif(trim(coalesce(x ->> 'note', '')), ''), case when rs = 'bo_ca' then public.app__cv_fine() else 0 end);
    if ab is not null then seen_a := seen_a || ab; end if;
    if hp is not null then seen_h := seen_h || hp; end if;
  end loop;
  if coalesce(p_partial, false) then return; end if;
  if not (na <@ seen_a) then raise exception 'Còn người nghỉ chưa chọn lý do.'; end if;
  if not (nh <@ seen_h) then raise exception 'Còn người hỗ trợ chưa gắn vào dòng nào (làm thay ai, hoặc "Quản lý không xếp đủ lịch").'; end if;
end $function$;

-- 4) Khỏi duyệt: ca đã phân loại đủ và mọi dòng đều là Đổi ca → ghi "đã duyệt" luôn (194). Hàm nội bộ, web không gọi được.
create or replace function public.app__cv_auto_ok(p_id bigint, p_acc bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.app__cv_state(p_id) <> 'cho_duyet' then return false; end if;
  if exists (select 1 from public.shift_covers where report_id = p_id and reason <> 'doi_ca') then return false; end if;
  update public.shift_cover_reviews set ok_by = p_acc, ok_at = public.vn_now_text(), ok_note = 'Đổi ca — không cần Chủ duyệt' where report_id = p_id;
  perform public.app_log('doi_ca_khoi_duyet', 'report=' || p_id);
  perform public.app__ca_auto_finish(p_id, p_acc);
  return true;
end $$;
revoke execute on function public.app__cv_auto_ok(bigint, bigint) from public, anon, authenticated;

-- 5) Lưu cả ca / lưu từng người: ca toàn Đổi ca thì xong luôn, không báo Chủ (194)
CREATE OR REPLACE FUNCTION public.app_cv_save(p_id bigint, p_items jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; x bigint;
begin
  a := public.app__need('doi_soat');
  if not public.app__cv_classify_can() then raise exception 'Chỉ Quản lý tổng / Chủ phân loại nghỉ và làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' and not r.self_reconciled then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  perform public.app__cv_write(p_id, p_items);
  insert into public.shift_cover_reviews(report_id, set_by, set_at) values (p_id, a.id, public.vn_now_text())
  on conflict (report_id) do update set set_by = excluded.set_by, set_at = excluded.set_at, ok_by = null, ok_at = null, ok_note = null;
  perform public.app_log('phan_loai_nghi_lam_thay', 'report=' || p_id);
  perform public.app__cv_auto_ok(p_id, a.id);   -- 194
  if a.system_role <> 'chu' and public.app__cv_state(p_id) <> 'da_duyet' then
    for x in select id from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 loop
      perform public.app__notify(x, 'Chờ duyệt nghỉ / làm thay', public.app__ca_title(r) || E'\nQuản lý tổng đã phân loại, Chủ duyệt thì phiếu mới hoàn thành đối soát.',
        '/quan-ly/doi-soat/ca?id=' || p_id);
    end loop;
  end if;
  return public.app__cv_state(p_id);
end $function$;
CREATE OR REPLACE FUNCTION public.app_cv_save_one(p_id bigint, p_item jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; x bigint; na bigint[]; nh bigint[]; wk bigint[]; ab bigint; hp bigint; keep jsonb; st text;
begin
  a := public.app__need('doi_soat');
  if not public.app__cv_classify_can() then raise exception 'Chỉ Quản lý tổng / Chủ phân loại nghỉ và làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;
  if r.recon_status = 'hoan_thanh' and not r.self_reconciled then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if jsonb_typeof(coalesce(p_item, 'null')) <> 'object' then raise exception 'Dữ liệu phân loại không hợp lệ.'; end if;
  ab := nullif(p_item ->> 'absent_id', '')::bigint; hp := nullif(p_item ->> 'helper_id', '')::bigint;
  if ab is null and hp is null then raise exception 'Dữ liệu phân loại không hợp lệ.'; end if;
  select coalesce(array_agg(employee_id) filter (where kind = 'nghi'), '{}'), coalesce(array_agg(employee_id) filter (where kind = 'ho_tro'), '{}')
    into na, nh from public.app__cv_people(p_id);
  select coalesce(array_agg((s ->> 'employee_id')::bigint), '{}') into wk
    from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s where coalesce((s ->> 'worked')::boolean, true);
  -- Giữ các dòng đã lưu của NGƯỜI KHÁC còn đúng nhân sự của ca; bỏ dòng cũ của chính người này,
  -- và bỏ dòng "làm thêm, không thay ai" của người vừa được chọn làm người thay.
  select coalesce(jsonb_agg(jsonb_build_object('absent_id', c.absent_id, 'reason', c.reason, 'helper_id', c.helper_id, 'helper_name', c.helper_name,
                                                'hours', c.hours, 'x2', c.x2, 'note', c.note) order by c.id), '[]'::jsonb)
    into keep from public.shift_covers c
   where c.report_id = p_id
     and (c.absent_id is null or c.absent_id = any(na))
     and (c.helper_id is null or c.helper_id = any(nh) or c.helper_id = any(wk))
     and not (ab is not null and c.absent_id is not distinct from ab)
     and not (ab is null and c.absent_id is null and c.helper_id is not distinct from hp)
     and not (hp is not null and c.absent_id is null and c.helper_id = hp);
  perform public.app__cv_write(p_id, keep || jsonb_build_array(p_item), true);
  -- Đủ người chưa?
  if (select na <@ coalesce(array_agg(c.absent_id) filter (where c.absent_id is not null), '{}')
         and nh <@ coalesce(array_agg(c.helper_id) filter (where c.helper_id is not null), '{}')
        from public.shift_covers c where c.report_id = p_id) then
    insert into public.shift_cover_reviews(report_id, set_by, set_at) values (p_id, a.id, public.vn_now_text())
    on conflict (report_id) do update set set_by = excluded.set_by, set_at = excluded.set_at, ok_by = null, ok_at = null, ok_note = null;
    perform public.app_log('phan_loai_nghi_lam_thay', 'report=' || p_id);
    perform public.app__cv_auto_ok(p_id, a.id);   -- 194
    if a.system_role <> 'chu' and public.app__cv_state(p_id) <> 'da_duyet' then
      for x in select id from public.accounts where system_role = 'chu' and coalesce(locked, 0) = 0 loop
        perform public.app__notify(x, 'Chờ duyệt nghỉ / làm thay', public.app__ca_title(r) || E'\nQuản lý tổng đã phân loại, Chủ duyệt thì phiếu mới hoàn thành đối soát.',
          '/quan-ly/doi-soat/ca?id=' || p_id);
      end loop;
    end if;
  else
    -- Còn thiếu người: bỏ dấu "đã phân loại" / "Chủ đã duyệt" (nếu có) để ca nằm ở Chờ phân loại và bảng công không tính.
    update public.shift_cover_reviews set set_by = null, set_at = null, ok_by = null, ok_at = null, ok_note = null where report_id = p_id;
    perform public.app_log('phan_loai_nghi_lam_thay', 'report=' || p_id || ' (lưu 1 người, chưa đủ)');
  end if;
  st := public.app__cv_state(p_id);
  return st;
end $function$;

-- 6) Chủ duyệt ca có lẫn dòng Đổi ca: dòng Đổi ca không gửi báo "nghỉ ca / làm thay ca" cho nhân viên (194)
CREATE OR REPLACE FUNCTION public.app_cv_approve(p_id bigint, p_items jsonb, p_note text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; r public.shift_reports; c public.shift_covers; st text; t text;
begin
  a := public.app__need('doi_soat');
  if a.system_role <> 'chu' then raise exception 'Chỉ Chủ duyệt nghỉ / làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' and not r.self_reconciled then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if p_items is not null then perform public.app__cv_write(p_id, p_items); end if;
  st := public.app__cv_state(p_id);
  if st in ('chua_phan_loai', 'lech') then raise exception 'Chưa phân loại đủ người nghỉ / người hỗ trợ của ca.'; end if;
  if st = 'khong_can' then return st; end if;
  insert into public.shift_cover_reviews(report_id, set_by, set_at, ok_by, ok_at, ok_note) values (p_id, a.id, public.vn_now_text(), a.id, public.vn_now_text(), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (report_id) do update set ok_by = excluded.ok_by, ok_at = excluded.ok_at, ok_note = excluded.ok_note,
     set_by = coalesce(public.shift_cover_reviews.set_by, excluded.set_by), set_at = coalesce(public.shift_cover_reviews.set_at, excluded.set_at);
  t := public.app__ca_title(r);
  for c in select * from public.shift_covers where report_id = p_id and reason <> 'doi_ca' loop   -- 194
    if c.absent_id is not null then
      perform public.app__notify_emp(c.absent_id, case when c.fine > 0 then 'Bỏ ca: bị phạt ' || public.app__vnd(c.fine) when c.deduct_hours > 0 then 'Nghỉ ca: bị trừ ' || c.deduct_hours || ' giờ' else 'Nghỉ ca: không bị trừ' end,
        t || E'\nLý do: ' || public.app__cv_label(c.reason)
        || coalesce(E'\nNgười làm thay: ' || (select e.code || ' – ' || e.name from public.employees e where e.id = c.helper_id), E'\nNgười làm thay: ' || c.helper_name, '')
        || case when c.deduct_hours > 0 then E'\nSố giờ người làm thay đã làm được trừ vào lương của bạn.' else '' end
        || E'\nKhông đồng ý thì gửi khiếu nại ở Của tôi › Công của tôi.', '/cua-toi/cong');
    end if;
    if c.helper_id is not null then
      perform public.app__notify_emp(c.helper_id, case when c.x2 then 'Làm thay ca: được x2 lương' else 'Làm thay ca: lương thường' end,
        t || E'\n' || case when c.absent_id is not null then 'Làm thay: ' || (select e.code || ' – ' || e.name from public.employees e where e.id = c.absent_id) else 'Làm thêm (quản lý không xếp đủ lịch)' end
        || E'\nSố giờ: ' || c.hours || case when c.x2 then ' (được cộng thêm ' || c.hours || ' giờ)' else '' end
        || E'\nKhông đồng ý thì gửi khiếu nại ở Của tôi › Công của tôi.', '/cua-toi/cong');
    end if;
  end loop;
  perform public.app_log('duyet_nghi_lam_thay', 'report=' || p_id);
  perform public.app__ca_auto_finish(p_id, a.id);
  return public.app__cv_state(p_id);
end $function$;

-- 7) Bảng công: ca nghỉ do Đổi ca (đã duyệt) không tính là nghỉ (194)
CREATE OR REPLACE FUNCTION public.app_bang_cong(p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts; f text; t text;
begin
  a := public.app__need(null);
  if not (public.app_can('bao_cao') or public.app__cv_classify_can()) then raise exception 'Bạn không có quyền thực hiện thao tác này.'; end if;
  if coalesce(p_month, '') !~ '^\d{4}-\d{2}$' then raise exception 'Tháng không hợp lệ.'; end if;
  f := p_month || '-01'; t := to_char((f::date + interval '1 month' - interval '1 day'), 'YYYY-MM-DD');
  return jsonb_build_object('month', p_month, 'can_resolve', public.app__cv_classify_can(), 'is_owner', a.system_role = 'chu',
    'rows', coalesce((select jsonb_agg(x order by x ->> 'code') from (
        select jsonb_build_object('employee_id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash, 'status', e.status,
          'shifts', count(*) filter (where w.worked), 'hours', coalesce(sum(w.hours) filter (where w.worked), 0),
          'pending', count(*) filter (where w.worked and not w.official),
          'cash_paid', coalesce(sum(w.cash) filter (where w.worked), 0)   -- bước 90: + khoản Chi lương tiền mặt gán cho người này ở Thu chi
             + coalesce((select sum(abs(m.amount)) from public.app__tc_moves_x(null, f, t) m join public.fin_move_cats fc on fc.report_id = m.report_id and fc.mkey = m.mkey
                          where fc.employee_id = e.id and m.pay = 'tien_mat' and m.amount < 0), 0),
          'absent', count(*) filter (where not w.worked and not w.swapped),   -- 194
          'x2_hours', coalesce((select sum(c.hours) from public.shift_covers c join public.shift_reports r2 on r2.id = c.report_id
                         join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                        where c.helper_id = e.id and c.x2 and r2.work_date between f and t), 0),
          'deduct_hours', coalesce((select sum(c.deduct_hours) from public.shift_covers c join public.shift_reports r2 on r2.id = c.report_id
                         join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                        where c.absent_id = e.id and r2.work_date between f and t), 0),
          'fine', coalesce((select sum(c.fine) from public.shift_covers c join public.shift_reports r2 on r2.id = c.report_id
                         join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                        where c.absent_id = e.id and r2.work_date between f and t), 0)) x
          from public.employees e
          join (select (s ->> 'employee_id')::bigint eid, coalesce((s ->> 'worked')::boolean, true) worked, public.app__hours(s ->> 'time_in', s ->> 'time_out') hours,
                       coalesce(nullif(s ->> 'cash_paid', '')::bigint, 0) cash,
                       exists (select 1 from public.shift_report_checks k where k.report_id = r.id and k.item = 'nhan_su') official,
                       exists (select 1 from public.shift_covers c join public.shift_cover_reviews v on v.report_id = c.report_id and v.ok_at is not null
                                where c.report_id = r.id and c.absent_id = (s ->> 'employee_id')::bigint and c.reason = 'doi_ca') swapped   -- 194
                  from public.shift_reports r cross join lateral jsonb_array_elements(coalesce(public.app__ca_eff(r.id) -> 'staff', '[]'::jsonb)) s
                 where r.status = 'hoan_thanh' and r.work_date between f and t) w on w.eid = e.id
         group by e.id) q), '[]'),
    'covers', coalesce((select jsonb_agg(public.app__cv_json(c) || jsonb_build_object('date', r.work_date, 'shift', r.shift,
                  'branch', coalesce(b.display_code, b.code), 'approved', v.ok_at is not null, 'open', public.app__cv_open(r.work_date)) order by r.work_date, r.shift, c.id)
                from public.shift_covers c join public.shift_reports r on r.id = c.report_id join public.branches b on b.id = r.branch_id
                left join public.shift_cover_reviews v on v.report_id = c.report_id
               where r.work_date between f and t), '[]'));
end $function$;

insert into public.app_migrations(file) values ('194_nghi_thay_doi_ca.sql') on conflict (file) do nothing;
