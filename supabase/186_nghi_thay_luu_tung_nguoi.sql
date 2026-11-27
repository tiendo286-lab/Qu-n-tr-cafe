-- 186 (anh Tiến chốt 27/11/2026, "cách 2"): trang Duyệt nghỉ & làm thay — LƯU RIÊNG TỪNG NGƯỜI trong ca có nhiều người nghỉ / hỗ trợ.
-- Trước: phải chọn đủ lý do cho mọi người trong ca mới lưu được (app_cv_save ghi cả ca).
-- Nay: thêm app_cv_save_one(ca, 1 dòng) — ghi dòng của 1 người, giữ nguyên dòng đã lưu của người khác.
--   · Chưa đủ người → ca vẫn "Chưa phân loại" (ở thẻ Chờ phân loại), Chủ CHƯA duyệt được, bảng công CHƯA tính gì
--     (bảng công chỉ lấy ca Chủ đã duyệt — không đổi).
--   · Đủ người → y như bấm Lưu cả ca: sang "Chờ Chủ duyệt", báo Chủ.
-- Không sửa app_cv_save / app_cv_approve / app__cv_write (2 tham số) / quyền. Chạy lại nhiều lần không sao.

-- 1) Ghi dở: bản 3 tham số của app__cv_write. p_partial = true thì bỏ 2 phép kiểm "đủ người" ở cuối; mọi phép kiểm từng dòng giữ nguyên bản tệp 47.
create or replace function public.app__cv_write(p_id bigint, p_items jsonb, p_partial boolean) returns void
language plpgsql security definer set search_path = public as $$
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
    if rs is null or rs not in ('tu_tim', 'nho_ql', 'ma_chay', 'thieu_lich', 'bo_ca') then raise exception 'Chọn lý do cho từng người.'; end if;
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
    values (p_id, ab, rs, hp, case when hp is null then hn end, hrs, coalesce((x ->> 'x2')::boolean, false) and (hp is not null or hn is not null),
            case when rs = 'nho_ql' then hrs else 0 end, nullif(trim(coalesce(x ->> 'note', '')), ''), case when rs = 'bo_ca' then public.app__cv_fine() else 0 end);
    if ab is not null then seen_a := seen_a || ab; end if;
    if hp is not null then seen_h := seen_h || hp; end if;
  end loop;
  if coalesce(p_partial, false) then return; end if;
  if not (na <@ seen_a) then raise exception 'Còn người nghỉ chưa chọn lý do.'; end if;
  if not (nh <@ seen_h) then raise exception 'Còn người hỗ trợ chưa gắn vào dòng nào (làm thay ai, hoặc "Quản lý không xếp đủ lịch").'; end if;
end $$;
revoke execute on function public.app__cv_write(bigint, jsonb, boolean) from public, anon, authenticated;

-- 2) Trạng thái: ca mới lưu dở (các dòng đã có đều đúng người, còn thiếu người, CHƯA có dấu "đã phân loại") → vẫn 'chua_phan_loai'.
--    Ca đã từng phân loại xong rồi nhân sự đổi (có dấu set_at) → vẫn 'lech' như cũ. Các trường hợp khác không đổi.
create or replace function public.app__cv_state(p_id bigint) returns text
language plpgsql stable security definer set search_path = public as $$
declare na bigint[]; nh bigint[]; ra bigint[]; rh bigint[]; wk bigint[]; rv public.shift_cover_reviews;
begin
  select coalesce(array_agg(employee_id) filter (where kind = 'nghi'), '{}'), coalesce(array_agg(employee_id) filter (where kind = 'ho_tro'), '{}')
    into na, nh from public.app__cv_people(p_id);
  if cardinality(na) = 0 and cardinality(nh) = 0 then return 'khong_can'; end if;
  if not exists (select 1 from public.shift_covers where report_id = p_id) then return 'chua_phan_loai'; end if;
  select coalesce(array_agg(absent_id) filter (where absent_id is not null), '{}'), coalesce(array_agg(helper_id) filter (where helper_id is not null), '{}')
    into ra, rh from public.shift_covers where report_id = p_id;
  -- bước 47: người làm thay có thể là người hỗ trợ hoặc người trong lịch có làm
  select coalesce(array_agg((s ->> 'employee_id')::bigint), '{}') into wk
    from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s where coalesce((s ->> 'worked')::boolean, true);
  select * into rv from public.shift_cover_reviews where report_id = p_id;
  if not (na <@ ra and ra <@ na and nh <@ rh and rh <@ (nh || wk)) then
    if ra <@ na and rh <@ (nh || wk) and rv.set_at is null then return 'chua_phan_loai'; end if;   -- 186: đang lưu dở từng người
    return 'lech';
  end if;
  return case when rv.ok_at is not null then 'da_duyet' else 'cho_duyet' end;
end $$;

-- 3) Lưu 1 người. p_item cùng dạng 1 phần tử của p_items ở app_cv_save:
--    {absent_id, reason, helper_id, helper_name, hours, x2}  (người hỗ trợ không làm thay ai: absent_id = null, reason = 'thieu_lich', helper_id).
create or replace function public.app_cv_save_one(p_id bigint, p_item jsonb) returns text
language plpgsql security definer set search_path = public as $$
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
    if a.system_role <> 'chu' then
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
end $$;
revoke execute on function public.app_cv_save_one(bigint, jsonb) from public, anon;
grant execute on function public.app_cv_save_one(bigint, jsonb) to authenticated;

insert into public.app_migrations(file) values ('186_nghi_thay_luu_tung_nguoi.sql') on conflict (file) do nothing;
