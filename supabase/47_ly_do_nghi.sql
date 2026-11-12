-- Bước 47 — Lý do nghỉ (anh Tiến chốt 12/11/2026)
-- * Thêm lý do "Bỏ ca": người nghỉ bị PHẠT 200.000đ (ghi ở Bảng công / Công của tôi, báo cho người nghỉ).
-- * "Ma chay tứ thân phụ mẫu" đổi tên thành "Quản lý đồng ý cho nghỉ (không bị trừ lương)" (giữ mã ma_chay cho dữ liệu cũ).
-- * Người làm thay / được x2 chọn được cả người trong lịch có làm ở ca (không chỉ người hỗ trợ phát sinh); tích x2 thì bắt buộc chọn người.
-- Chạy lại nhiều lần không sao.

alter table public.shift_covers add column if not exists fine bigint not null default 0;
alter table public.shift_covers drop constraint if exists shift_covers_reason_check;
alter table public.shift_covers add constraint shift_covers_reason_check check (reason in ('tu_tim', 'nho_ql', 'ma_chay', 'thieu_lich', 'bo_ca'));

create or replace function public.app__cv_fine() returns bigint language sql immutable as $$ select 200000::bigint $$;

create or replace function public.app__cv_label(p_reason text) returns text
language sql immutable as $$
  select case p_reason when 'tu_tim' then 'Tự tìm người thay' when 'nho_ql' then 'Nhờ quản lý tìm người'
                       when 'ma_chay' then 'Quản lý đồng ý cho nghỉ (không trừ lương)' when 'bo_ca' then 'Bỏ ca (phạt 200.000đ)' when 'thieu_lich' then 'Quản lý không xếp đủ lịch' else p_reason end
$$;

create or replace function public.app__cv_write(p_id bigint, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
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
    if rs not in ('tu_tim', 'nho_ql', 'ma_chay', 'thieu_lich', 'bo_ca') then raise exception 'Chọn lý do cho từng người.'; end if;
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
    values (p_id, ab, rs, hp, case when hp is null then hn end, hrs, coalesce((x ->> 'x2')::boolean, false) and (hp is not null or hn is not null),
            case when rs = 'nho_ql' then hrs else 0 end, nullif(trim(coalesce(x ->> 'note', '')), ''), case when rs = 'bo_ca' then public.app__cv_fine() else 0 end);
    if ab is not null then seen_a := seen_a || ab; end if;
    if hp is not null then seen_h := seen_h || hp; end if;
  end loop;
  if not (na <@ seen_a) then raise exception 'Còn người nghỉ chưa chọn lý do.'; end if;
  if not (nh <@ seen_h) then raise exception 'Còn người hỗ trợ chưa gắn vào dòng nào (làm thay ai, hoặc "Quản lý không xếp đủ lịch").'; end if;
end $$;

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
  if not (na <@ ra and ra <@ na and nh <@ rh and rh <@ (nh || wk)) then return 'lech'; end if;
  select * into rv from public.shift_cover_reviews where report_id = p_id;
  return case when rv.ok_at is not null then 'da_duyet' else 'cho_duyet' end;
end $$;

create or replace function public.app_cv_get(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; rv public.shift_cover_reviews;
begin
  a := public.app__need('doi_soat');
  select * into r from public.shift_reports where id = p_id;
  if r.id is null then raise exception 'Không tìm thấy phiếu.'; end if;
  select * into rv from public.shift_cover_reviews where report_id = p_id;
  return jsonb_build_object('state', public.app__cv_state(p_id), 'can_classify', public.app__cv_classify_can(), 'is_owner', a.system_role = 'chu',
    'open', public.app__cv_open(r.work_date), 'recon_status', r.recon_status,
    'people', coalesce((select jsonb_agg(jsonb_build_object('employee_id', p.employee_id, 'kind', p.kind, 'hours', p.hours,
                  'code', e.code, 'name', e.name, 'pay_cash', e.pay_cash) order by p.kind desc, e.code)
                from public.app__cv_people(p_id) p join public.employees e on e.id = p.employee_id), '[]'),
    -- bước 47: người trong lịch có làm ở ca (chọn làm người làm thay / được x2)
    'workers', coalesce((select jsonb_agg(jsonb_build_object('employee_id', e.id, 'code', e.code, 'name', e.name,
                  'hours', public.app__hours(s ->> 'time_in', s ->> 'time_out')) order by e.code)
                from jsonb_array_elements(coalesce(public.app__ca_eff(p_id) -> 'staff', '[]'::jsonb)) s join public.employees e on e.id = (s ->> 'employee_id')::bigint
               where coalesce((s ->> 'worked')::boolean, true) and s ->> 'source' = 'lich'), '[]'),
    'fine', public.app__cv_fine(),
    'rows', coalesce((select jsonb_agg(public.app__cv_json(c) order by c.id) from public.shift_covers c where c.report_id = p_id), '[]'),
    'set_by', public.app__acc_name(rv.set_by), 'set_at', rv.set_at, 'ok_by', public.app__acc_name(rv.ok_by), 'ok_at', rv.ok_at, 'ok_note', rv.ok_note);
end $$;

create or replace function public.app_cv_approve(p_id bigint, p_items jsonb, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare a public.accounts; r public.shift_reports; c public.shift_covers; st text; t text;
begin
  a := public.app__need('doi_soat');
  if a.system_role <> 'chu' then raise exception 'Chỉ Chủ duyệt nghỉ / làm thay.'; end if;
  select * into r from public.shift_reports where id = p_id for update;
  if r.id is null or r.status not in ('hoan_thanh', 'dang_chot') then raise exception 'Không tìm thấy phiếu.'; end if;   -- bước 46: làm được cả khi đang chốt
  if r.recon_status = 'hoan_thanh' then raise exception 'Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.'; end if;
  if p_items is not null then perform public.app__cv_write(p_id, p_items); end if;
  st := public.app__cv_state(p_id);
  if st in ('chua_phan_loai', 'lech') then raise exception 'Chưa phân loại đủ người nghỉ / người hỗ trợ của ca.'; end if;
  if st = 'khong_can' then return st; end if;
  insert into public.shift_cover_reviews(report_id, set_by, set_at, ok_by, ok_at, ok_note) values (p_id, a.id, public.vn_now_text(), a.id, public.vn_now_text(), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (report_id) do update set ok_by = excluded.ok_by, ok_at = excluded.ok_at, ok_note = excluded.ok_note,
     set_by = coalesce(public.shift_cover_reviews.set_by, excluded.set_by), set_at = coalesce(public.shift_cover_reviews.set_at, excluded.set_at);
  t := public.app__ca_title(r);
  for c in select * from public.shift_covers where report_id = p_id loop
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
end $$;

create or replace function public.app_bang_cong(p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
          'cash_paid', coalesce(sum(w.cash) filter (where w.worked), 0),
          'absent', count(*) filter (where not w.worked),
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
                       exists (select 1 from public.shift_report_checks k where k.report_id = r.id and k.item = 'nhan_su') official
                  from public.shift_reports r cross join lateral jsonb_array_elements(coalesce(public.app__ca_eff(r.id) -> 'staff', '[]'::jsonb)) s
                 where r.status = 'hoan_thanh' and r.work_date between f and t) w on w.eid = e.id
         group by e.id) q), '[]'),
    'covers', coalesce((select jsonb_agg(public.app__cv_json(c) || jsonb_build_object('date', r.work_date, 'shift', r.shift,
                  'branch', coalesce(b.display_code, b.code), 'approved', v.ok_at is not null, 'open', public.app__cv_open(r.work_date)) order by r.work_date, r.shift, c.id)
                from public.shift_covers c join public.shift_reports r on r.id = c.report_id join public.branches b on b.id = r.branch_id
                left join public.shift_cover_reviews v on v.report_id = c.report_id
               where r.work_date between f and t), '[]'));
end $$;

revoke execute on function public.app__cv_fine() from public, anon, authenticated;
