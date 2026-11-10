-- =====================================================================
-- BƯỚC 33: KHOẢN ÂM MẶC ĐỊNH TRỪ LƯƠNG — anh Tiến chốt 11/11/2026. Chạy sau 32. Chạy lại nhiều lần không sao.
--  * Quản lý đối soát hạng mục tiền ra THIẾU → số thiếu chia đều cho nhân viên được tích (sửa được số từng người)
--    và mỗi khoản âm MẶC ĐỊNH ghi "Trừ lương" ngay (auto_tru = true), báo nhân viên.
--  * Khoản "trừ lương mặc định" vẫn đổi / bỏ được khi quản lý đổi kết quả đối soát hoặc mở lại phiếu.
--    Quản lý chọn tình trạng bằng tay (Đã bù / Trừ lương / Miễn / Chưa xử lý) → thành chính thức, khóa như trước.
--  * Nhân viên vẫn giải trình được khi khoản đang ở trừ lương mặc định.
--  * Khoản âm cũ đang "Chưa xử lý" giữ nguyên.
-- =====================================================================

alter table public.shift_shortfalls add column if not exists auto_tru boolean not null default false;

create or replace function public.app__ka_json(s public.shift_shortfalls) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'report_id', s.report_id, 'item', s.item, 'item_label', public.app__ca_item_label(s.item),
    'employee_id', s.employee_id, 'employee', (select e.code || ' – ' || e.name from public.employees e where e.id = s.employee_id),
    'amount', s.amount, 'reason', s.reason, 'status', s.status, 'auto_tru', s.auto_tru, 'status_note', s.status_note, 'status_by', public.app__acc_name(s.status_by), 'status_at', s.status_at,
    'seen_at', s.seen_at, 'reply', s.reply, 'reply_at', s.reply_at, 'created_by', public.app__acc_name(s.created_by), 'created_at', s.created_at,
    'work_date', r.work_date, 'shift', r.shift, 'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = r.branch_id),
    'branch_id', r.branch_id)
  from public.shift_reports r where r.id = s.report_id
$$;

create or replace function public.app__ca_drop_shortfalls(p_id bigint, p_item text, p_keep bigint[], p_why text) returns void
language plpgsql security definer set search_path = public as $$
declare s record; r public.shift_reports;
begin
  select * into r from public.shift_reports where id = p_id;
  for s in select * from public.shift_shortfalls where report_id = p_id and (p_item is null or item = p_item) and (status = 'chua_xu_ly' or (status = 'tru_luong' and auto_tru)) loop
    if not (s.employee_id = any(coalesce(p_keep, '{}'))) then
      perform public.app__notify_emp(s.employee_id, 'Khoản âm đã được hủy',
        public.app__ca_title(r) || ' · ' || public.app__ca_item_label(s.item) || ': khoản âm ' || public.app__vnd(s.amount) || ' đã hủy. ' || p_why, '/cua-toi/khoan-am');
    end if;
  end loop;
  if p_keep is null then
    update public.shift_shortfalls set status = 'huy', auto_tru = false, status_note = p_why, status_at = public.vn_now_text()
     where report_id = p_id and (p_item is null or item = p_item) and (status = 'chua_xu_ly' or (status = 'tru_luong' and auto_tru));
  else
    delete from public.shift_shortfalls where report_id = p_id and item = p_item and (status = 'chua_xu_ly' or (status = 'tru_luong' and auto_tru));
  end if;
end $$;

create or replace function public.app_ca_result_set(p_id bigint, p_item text, p_result text, p_amount bigint, p_reason text, p_people jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; m jsonb; amt bigint; why text := nullif(trim(coalesce(p_reason, '')), '');
        x jsonb; tot bigint := 0; emps bigint[] := '{}'; e bigint; ea bigint; comp bigint; basis text;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status <> 'hoan_thanh' then raise exception 'Nhân viên chưa hoàn thành phiếu này.'; end if;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if not (p_item = any(public.app__ca_money_items())) then raise exception 'Hạng mục không hợp lệ.'; end if;
  if p_result not in ('khop', 'thieu', 'thua') then raise exception 'Chọn KHỚP, THIẾU hoặc THỪA.'; end if;
  amt := case when p_result = 'khop' then 0 else coalesce(p_amount, 0) end;
  if p_result <> 'khop' and amt <= 0 then raise exception 'Nhập số tiền % (lớn hơn 0).', case when p_result = 'thieu' then 'thiếu' else 'thừa' end; end if;
  if p_result <> 'khop' and why is null then raise exception 'Ghi lý do % tiền.', case when p_result = 'thieu' then 'thiếu' else 'thừa' end; end if;
  if exists (select 1 from public.shift_shortfalls where report_id = p_id and item = p_item and status in ('da_bu', 'tru_luong', 'mien') and not (status = 'tru_luong' and auto_tru)) then
    raise exception 'Khoản âm của hạng mục này đã được xử lý (đã bù / trừ lương / miễn) nên không đổi được kết quả.';
  end if;
  if p_result = 'thieu' then
    if jsonb_typeof(coalesce(p_people, '[]')) <> 'array' or jsonb_array_length(coalesce(p_people, '[]')) = 0 then
      raise exception 'Chọn nhân viên chịu khoản thiếu.';
    end if;
    for x in select * from jsonb_array_elements(p_people) loop
      e := (x ->> 'employee_id')::bigint; ea := coalesce((x ->> 'amount')::bigint, 0);
      if not exists (select 1 from public.employees where id = e) then raise exception 'Nhân viên không hợp lệ.'; end if;
      if e = any(emps) then raise exception 'Mỗi nhân viên chỉ chọn một lần.'; end if;
      if ea <= 0 then raise exception 'Số tiền của từng nhân viên phải lớn hơn 0.'; end if;
      emps := emps || e; tot := tot + ea;
    end loop;
    if tot <> amt then raise exception 'Tổng tiền chia cho nhân viên (%) phải bằng số tiền thiếu (%).', public.app__vnd(tot), public.app__vnd(amt); end if;
  end if;
  m := public.app__ca_money(p_id);
  comp := case p_item when 'tien_mat' then (m ->> 'tm_left')::bigint when 'chuyen_khoan' then (m ->> 'ck_left')::bigint end;
  basis := case when p_item = 'chuyen_khoan' then m ->> 'ck_basis' end;
  -- khoản âm: thay danh sách chưa xử lý bằng danh sách mới
  perform public.app__ca_drop_shortfalls(p_id, p_item, emps, 'Quản lý đã đổi kết quả đối soát.');
  if p_result = 'thieu' then
    for x in select * from jsonb_array_elements(p_people) loop
      insert into public.shift_shortfalls(report_id, item, employee_id, amount, reason, created_by, status, auto_tru, status_note, status_by, status_at)
      values (p_id, p_item, (x ->> 'employee_id')::bigint, (x ->> 'amount')::bigint, why, a.id,
              'tru_luong', true, 'Mặc định trừ lương khi đối soát', a.id, public.vn_now_text());
      perform public.app__notify_emp((x ->> 'employee_id')::bigint, 'Bạn có khoản âm — mặc định trừ lương',
        public.app__ca_title(r) || ' · ' || public.app__ca_item_label(p_item) || ': bạn chịu ' || public.app__vnd((x ->> 'amount')::bigint)
        || E'\nLý do: ' || why || E'\nNgười đối soát: ' || public.app__acc_name(a.id)
        || E'\nMặc định: TRỪ LƯƠNG. Không đồng ý thì gửi giải trình ở mục Khoản âm của tôi.', '/cua-toi/khoan-am');
    end loop;
  end if;
  insert into public.shift_report_results(report_id, item, result, amount, computed, basis, reason, by_account, at)
  values (p_id, p_item, p_result, amt, comp, basis, why, a.id, public.vn_now_text())
  on conflict (report_id, item) do update set result = excluded.result, amount = excluded.amount, computed = excluded.computed, basis = excluded.basis,
         reason = excluded.reason, by_account = excluded.by_account, at = excluded.at;
  insert into public.shift_report_checks(report_id, item, checked_by, checked_at) values (p_id, p_item, a.id, public.vn_now_text())
  on conflict (report_id, item) do update set checked_by = excluded.checked_by, checked_at = excluded.checked_at;
  insert into public.shift_recon_log(report_id, action, field, after, reason, by_account)
  values (p_id, 'ket_qua', p_item, jsonb_build_object('result', p_result, 'amount', amt, 'people', coalesce(p_people, '[]')), why, a.id);
  perform public.app__ca_auto_finish(p_id, a.id);
  perform public.app_log('doi_soat_ket_qua', 'report=' || p_id || ' ' || p_item || '=' || p_result || ' ' || amt);
end $$;

create or replace function public.app_ca_result_clear(p_id bigint, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu.'; end if;
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if exists (select 1 from public.shift_shortfalls where report_id = p_id and item = p_item and status in ('da_bu', 'tru_luong', 'mien') and not (status = 'tru_luong' and auto_tru)) then
    raise exception 'Khoản âm của hạng mục này đã được xử lý nên không bỏ được kết quả.';
  end if;
  perform public.app__ca_drop_shortfalls(p_id, p_item, '{}', 'Quản lý đã bỏ kết quả đối soát.');
  delete from public.shift_report_results where report_id = p_id and item = p_item;
  delete from public.shift_report_checks where report_id = p_id and item = p_item;
  insert into public.shift_recon_log(report_id, action, field, by_account) values (p_id, 'bo_ket_qua', p_item, a.id);
end $$;

create or replace function public.app_ka_set_status(p_id bigint, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; s public.shift_shortfalls; r public.shift_reports; lbl text;
begin
  a := public.app__need('doi_soat');
  if p_status not in ('chua_xu_ly', 'da_bu', 'tru_luong', 'mien') then raise exception 'Tình trạng không hợp lệ.'; end if;
  if p_status = 'mien' and trim(coalesce(p_note, '')) = '' then raise exception 'Miễn khoản âm phải ghi lý do.'; end if;
  update public.shift_shortfalls set status = p_status, auto_tru = false, status_note = nullif(trim(coalesce(p_note, '')), ''), status_by = a.id, status_at = public.vn_now_text()
   where id = p_id and status <> 'huy' returning * into s;
  if s.id is null then raise exception 'Không tìm thấy khoản âm.'; end if;
  select * into r from public.shift_reports where id = s.report_id;
  lbl := case p_status when 'da_bu' then 'Đã bù' when 'tru_luong' then 'Trừ lương' when 'mien' then 'Miễn' else 'Chưa xử lý' end;
  perform public.app__notify_emp(s.employee_id, 'Khoản âm: ' || lbl,
    public.app__ca_title(r) || ' · ' || public.app__vnd(s.amount) || ' → ' || lbl || coalesce(E'\n' || nullif(trim(coalesce(p_note, '')), ''), ''), '/cua-toi/khoan-am');
  perform public.app_log('khoan_am_tinh_trang', 'report=' || s.report_id || ' ' || p_status);
end $$;
