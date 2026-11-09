-- =====================================================================
-- 25. Ca FULL TIME (LHP) gộp vào ca chính (anh Tiến chốt 09/11/2026)
--  · Xếp lịch: người FULL TIME hiện trong ca chính, tính định biên cho MỌI ca chính chồng giờ (giao diện).
--    Máy chủ chặn xếp cùng một người vào ca FULL TIME và ca khác trùng giờ trong cùng ngày.
--  · Order: FULL TIME "Đi làm được" → ca chính tự "Đi làm được"; ca chính "Nghỉ" → FULL TIME tự "Nghỉ".
--  · Bảng ca / việc tự sinh: không còn ô ca FULL TIME, không báo "quá giờ chưa chốt"; không mở phiếu riêng cho ca FULL TIME;
--    mở phiếu ca chính thì tự thêm người FULL TIME làm chồng giờ vào danh sách nhân viên của phiếu.
-- Chạy lại nhiều lần không sao.
-- =====================================================================

-- "6:45" / "06:45" / "06:45:00" → số phút
create or replace function public.app__hm_min(p text) returns int
language sql immutable as $$
  select case when p ~ '^\s*\d{1,2}:\d{2}' then split_part(trim(p), ':', 1)::int * 60 + left(split_part(trim(p), ':', 2), 2)::int end
$$;

-- Hai ca (mỗi ca theo giờ của cơ sở mình) có chồng giờ không. Thiếu giờ thì coi là trùng khi cùng tên.
create or replace function public.app__shift_overlap(b1 bigint, s1 text, b2 bigint, s2 text) returns boolean
language sql stable security definer set search_path = public as $$
  with x as (
    select (select public.app__hm_min(bs.start_time) from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id where bs.branch_id = b1 and s.name = s1) a1,
           (select public.app__hm_min(bs.end_time)   from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id where bs.branch_id = b1 and s.name = s1) a2,
           (select public.app__hm_min(bs.start_time) from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id where bs.branch_id = b2 and s.name = s2) c1,
           (select public.app__hm_min(bs.end_time)   from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id where bs.branch_id = b2 and s.name = s2) c2)
  select case when a1 is null or a2 is null or c1 is null or c2 is null then s1 = s2
              else least(a2, c2) - greatest(a1, c1) > 0 end from x
$$;

-- Ca chính của một ca FULL TIME: cùng giờ bắt đầu (FT Sáng → Sáng) hoặc cùng giờ kết thúc (FT Tối → Tối) ở cơ sở bật ca đó; không có giờ thì theo tên.
create or replace function public.app__ft_parent(p_shift text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.name from public.branch_shifts f join public.shifts fs on fs.id = f.shift_id
       join public.branch_shifts bm on bm.branch_id = f.branch_id and bm.enabled = 1
       join public.shifts m on m.id = bm.shift_id and m.status = 'Đang sử dụng' and public.app__ca_chain(m.name)
      where fs.name = p_shift and f.enabled = 1
        and (public.app__hm_min(bm.start_time) = public.app__hm_min(f.start_time) or public.app__hm_min(bm.end_time) = public.app__hm_min(f.end_time))
      order by (public.app__hm_min(bm.start_time) = public.app__hm_min(f.start_time)) desc, m.sort_order limit 1),
    (select m.name from public.shifts m where m.status = 'Đang sử dụng' and public.app__ca_chain(m.name)
        and ((p_shift ilike '%sáng%' and m.name ilike '%sáng%') or (p_shift ilike '%tối%' and m.name ilike '%tối%'))
      order by m.sort_order limit 1))
$$;

-- ---------------------------------------------------------------- Xếp lịch: chặn trùng giờ với ca FULL TIME
create or replace function public.app__assign(p_week bigint, p_emp bigint, p_day int, p_shift text, p_branch bigint,
                                              p_role text, p_slot int) returns void
language plpgsql security definer set search_path = public as $$
declare e record; bcode text; clash record; had boolean;
begin
  if not exists (select 1 from public.employees where id = p_emp and status = 'Đang làm') then
    raise exception 'Nhân viên không còn làm.';
  end if;
  if not exists (select 1 from public.employee_branches where employee_id = p_emp and branch_id = p_branch) then
    raise exception 'Nhân viên không được khai báo làm ở chi nhánh này.';
  end if;
  if not exists (select 1 from public.employee_roles where employee_id = p_emp and role = p_role) then
    raise exception 'Nhân viên không có vai trò này.';
  end if;
  select * into e from public.weekly_schedule_entries
   where week_id = p_week and employee_id = p_emp and weekday = p_day and shift = p_shift;
  had := found;
  if had and e.state = 'ĐÃ XẾP' and not (e.branch_id = p_branch and e.role = p_role) then
    select code into bcode from public.branches where id = e.branch_id;
    raise exception 'Nhân viên này đã được xếp ở % cùng ca.', coalesce(bcode, 'chi nhánh khác');
  end if;
  -- Ca FULL TIME: không xếp trùng giờ với ca khác của cùng người trong ngày (ca thường liền nhau vẫn được)
  select x.shift, coalesce(b2.display_code, b2.code) bc into clash
    from public.weekly_schedule_entries x left join public.branches b2 on b2.id = x.branch_id
   where x.week_id = p_week and x.employee_id = p_emp and x.weekday = p_day and x.state = 'ĐÃ XẾP' and x.shift <> p_shift
     and (not public.app__ca_chain(p_shift) or not public.app__ca_chain(x.shift))
     and public.app__shift_overlap(p_branch, p_shift, x.branch_id, x.shift)
   limit 1;
  if clash.shift is not null then
    raise exception 'Nhân viên này đã được xếp ca % ở % trùng giờ với ca %. Gỡ ca kia trước.', clash.shift, coalesce(clash.bc, '?'), p_shift;
  end if;
  if had then
    update public.weekly_schedule_entries set state = 'ĐÃ XẾP', branch_id = p_branch, role = p_role, slot = p_slot,
           source = 'MANUAL', is_manual = 1, updated_at = public.vn_now_text() where id = e.id;
  else
    insert into public.weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, branch_id, role,
                                               slot, source, is_manual)
    values (p_week, p_emp, p_day, p_shift, public.app__base_for(p_week, p_emp, p_day, p_shift), 'ĐÃ XẾP', p_branch, p_role,
            p_slot, 'MANUAL', 1);
  end if;
end $$;

-- ---------------------------------------------------------------- Order: quy tắc FULL TIME ↔ ca chính (mọi đường nhập: nhân viên, quản lý sửa, nhập file)
create or replace function public.app__order_ft_rule() returns trigger
language plpgsql security definer set search_path = public as $$
declare par text; f record; cur text;
begin
  if not public.app__ca_chain(new.shift) and new.status = 'ĐI LÀM ĐƯỢC' then
    -- đọc lại: dòng có thể vừa bị quy tắc kia đổi trong cùng lần lưu
    select status into cur from public.order_entries where id = new.id;
    if cur is distinct from 'ĐI LÀM ĐƯỢC' then return null; end if;
    par := public.app__ft_parent(new.shift);
    if par is null then return null; end if;
    insert into public.order_entries as oe (week_id, employee_id, weekday, shift, status, imported_at, is_manual)
    values (new.week_id, new.employee_id, new.weekday, par, 'ĐI LÀM ĐƯỢC', new.imported_at, new.is_manual)
    on conflict (week_id, employee_id, weekday, shift) do update set status = excluded.status, imported_at = excluded.imported_at, is_manual = excluded.is_manual
      where oe.status is distinct from 'ĐI LÀM ĐƯỢC';
    if found then perform public.app__sync_order_change(new.week_id, new.employee_id, new.weekday, par, 'ĐI LÀM ĐƯỢC'); end if;
  elsif public.app__ca_chain(new.shift) and new.status = 'NGHỈ' then
    select status into cur from public.order_entries where id = new.id;
    if cur is distinct from 'NGHỈ' then return null; end if;
    for f in select s.name from public.shifts s where s.status = 'Đang sử dụng' and not public.app__ca_chain(s.name) and public.app__ft_parent(s.name) = new.shift loop
      update public.order_entries set status = 'NGHỈ', imported_at = new.imported_at, is_manual = new.is_manual
       where week_id = new.week_id and employee_id = new.employee_id and weekday = new.weekday and shift = f.name and status = 'ĐI LÀM ĐƯỢC';
      if found then perform public.app__sync_order_change(new.week_id, new.employee_id, new.weekday, f.name, 'NGHỈ'); end if;
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists order_ft_rule on public.order_entries;
create trigger order_ft_rule after insert or update of status on public.order_entries
  for each row execute function public.app__order_ft_rule();

-- ---------------------------------------------------------------- Phiếu chốt ca: không mở phiếu riêng cho ca FULL TIME; tự thêm người FULL TIME vào phiếu ca chính
create or replace function public.app_ca_open(p_branch bigint, p_date text, p_shift text) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; rid bigint; prev public.shift_reports; w public.weeks; wd int; first_shift text;
begin
  a := public.app__need('chot_ca');
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Ngày không hợp lệ.'; end if;
  if not public.app__ca_chain(p_shift) then
    raise exception 'Ca % không có phiếu chốt ca riêng. Người làm FULL TIME được ghi vào phiếu của ca chính (Sáng / Chiều / Tối).', p_shift;
  end if;
  if p_date > to_char(public.vn_now() + interval '1 day', 'YYYY-MM-DD') then raise exception 'Chưa tới ngày làm việc này.'; end if;
  if not exists (select 1 from public.branch_shifts bs join public.shifts s on s.id = bs.shift_id
                  where bs.branch_id = p_branch and bs.enabled = 1 and s.name = p_shift) then
    raise exception 'Cơ sở này không có ca %.', p_shift;
  end if;
  select id into rid from public.shift_reports where branch_id = p_branch and work_date = p_date and shift = p_shift;
  if rid is not null then return rid; end if;
  first_shift := (public.app__shifts())[1];
  insert into public.shift_reports(branch_id, work_date, shift, created_by, updated_by)
  values (p_branch, p_date, p_shift, a.id, a.id)
  on conflict (branch_id, work_date, shift) do nothing
  returning id into rid;
  if rid is null then   -- người khác vừa tạo cùng lúc
    select id into rid from public.shift_reports where branch_id = p_branch and work_date = p_date and shift = p_shift;
    return rid;
  end if;
  if p_shift = first_shift then
    update public.shift_reports set rev_start = p_date || ' 06:45', opening_cash = 1000000 where id = rid;
  else
    select * into prev from public.shift_reports
     where branch_id = p_branch and work_date = p_date and shift = public.app__ca_prev_shift(p_shift) and status = 'hoan_thanh';
    if prev.id is not null and p_shift = (public.app__shifts())[2] then
      update public.shift_reports set rev_start = prev.rev_end where id = rid;
    end if;
  end if;
  -- Nhân viên theo lịch đã xếp đúng ngày, cơ sở, ca
  select * into w from public.weeks where start_date <= p_date and end_date >= p_date;
  if w.id is not null then
    wd := (p_date::date - w.start_date::date);
    insert into public.shift_report_staff(report_id, employee_id, source, role, worked)
    select rid, e.employee_id, 'lich', e.role, 1
      from public.weekly_schedule_entries e
     where e.week_id = w.id and e.weekday = wd and e.branch_id = p_branch and e.state = 'ĐÃ XẾP'
       and (e.shift = p_shift or (not public.app__ca_chain(e.shift) and public.app__shift_overlap(p_branch, e.shift, p_branch, p_shift)))
    on conflict do nothing;
  end if;
  perform public.app_log('mo_phieu_chot_ca', 'report=' || rid);
  return rid;
end $$;

-- ---------------------------------------------------------------- Bảng ca: bỏ ô ca FULL TIME
create or replace function public.app_ca_overview(p_date text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb; ds boolean := public.app_can('doi_soat');
begin
  perform public.app__need('chot_ca');
  select coalesce(jsonb_agg(x.j order by x.ord, x.sord), '[]'::jsonb) into out from (
    select b.sort_order as ord, sh.sort_order as sord,
           jsonb_build_object('branch_id', b.id, 'branch_code', coalesce(b.display_code, b.code), 'branch_name', b.name,
             'shift', sh.name, 'start_time', bs.start_time, 'end_time', bs.end_time,
             'report_id', r.id, 'status', r.status, 'recon_status', r.recon_status,
             'created_by', public.app__acc_name(r.created_by), 'completed_by', public.app__acc_name(r.completed_by),
             'completed_at', r.completed_at,
             'cash_left', (m.j ->> 'tm_left')::bigint, 'transfer_left', (m.j ->> 'ck_left')::bigint, 'ck_basis', m.j ->> 'ck_basis',
             'handover_gap', (m.j ->> 'handover_gap')::bigint,
             'hand_state', case when ds then hd.h ->> 'state' end, 'hand_gap', case when ds then (hd.h ->> 'gap')::bigint end,
             'revenue', (e.d ->> 'total_revenue')::bigint, 'cups', (e.d ->> 'cups')::int,
             'checks', (select count(*) from public.shift_report_checks c where c.report_id = r.id),
             'short_total', (select sum(x.amount) from public.shift_report_results x where x.report_id = r.id and x.result = 'thieu'),
             'over_total', (select sum(x.amount) from public.shift_report_results x where x.report_id = r.id and x.result = 'thua'),
             'has_debt', exists (select 1 from public.shift_debts d where d.report_id = r.id)) as j
      from public.branches b
      join public.branch_shifts bs on bs.branch_id = b.id and bs.enabled = 1
      join public.shifts sh on sh.id = bs.shift_id and sh.status = 'Đang sử dụng'
      left join public.shift_reports r on r.branch_id = b.id and r.work_date = p_date and r.shift = sh.name
      left join lateral (select case when r.status = 'hoan_thanh' then public.app__ca_eff(r.id) end as d) e on true
      left join lateral (select case when r.status = 'hoan_thanh' and ds then public.app__ca_money(r.id) end as j) m on true
      left join lateral (select case when r.id is not null and ds then public.app__ca_hand(r.id) end as h) hd on true
     where b.status = 'Đang hoạt động' and public.app__ca_chain(sh.name)
  ) x;
  return out;
end $$;

-- ---------------------------------------------------------------- Việc tự sinh: không báo ca FULL TIME "quá giờ chưa chốt"
create or replace function public.app_viec_auto() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '[]'; today text := to_char(public.vn_now(), 'YYYY-MM-DD'); nowhm text := to_char(public.vn_now(), 'HH24:MI'); x jsonb;
begin
  perform public.app__need('hop_giao_viec');
  -- Vận hành: ca chờ đối soát (30 ngày)
  select coalesce(jsonb_agg(jsonb_build_object('key', 'doi_soat:r=' || r.id, 'category', 'van_hanh', 'topic', 'doi_soat_ca',
            'title', 'Đối soát ' || public.app__ca_title(r) || case when r.recon_status = 'mo_lai' then ' (đang đối soát lại)' else '' end,
            'detail', 'Nhân viên đã hoàn thành phiếu ' || coalesce(r.completed_at, '') || ' · đã đối soát ' ||
                      (select count(*) from public.shift_report_checks c where c.report_id = r.id) || '/' || array_length(public.app__ca_check_items(), 1) || ' hạng mục',
            'link', '/ca/phieu?id=' || r.id, 'at', r.work_date) order by r.work_date, r.id), '[]') into x
    from public.shift_reports r
   where r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh' and r.work_date >= to_char(public.vn_now() - interval '30 days', 'YYYY-MM-DD');
  out := out || x;
  -- Vận hành: ca quá giờ chưa chốt (3 ngày gần nhất, từ ngày bắt đầu dùng chốt ca trên web) — gộp mỗi ngày 1 việc
  select coalesce(jsonb_agg(jsonb_build_object('key', 'chua_chot:d=' || q.d, 'category', 'van_hanh', 'topic', 'doi_soat_ca',
            'title', q.n || ' ca quá giờ chưa chốt ngày ' || to_char(q.d::date, 'DD/MM/YYYY'),
            'detail', q.names, 'link', '/ca?ngay=' || q.d, 'at', q.d) order by q.d), '[]') into x
    from (select d.d, count(*) n,
                 string_agg(coalesce(b.display_code, b.code) || ' ' || sh.name || case when r.id is null then ' (chưa mở)' else ' (đang chốt dở)' end, ', ' order by b.sort_order, sh.sort_order) names
            from (select to_char(public.vn_now() - (g || ' days')::interval, 'YYYY-MM-DD') d from generate_series(0, 3) g) d
            cross join public.branches b
            join public.branch_shifts bs on bs.branch_id = b.id and bs.enabled = 1
            join public.shifts sh on sh.id = bs.shift_id and sh.status = 'Đang sử dụng'
            left join public.shift_reports r on r.branch_id = b.id and r.work_date = d.d and r.shift = sh.name
           where b.status = 'Đang hoạt động' and public.app__ca_chain(sh.name) and (r.id is null or r.status = 'dang_chot')
             and d.d >= coalesce((select min(work_date) from public.shift_reports), today)
             and (d.d < today or (bs.end_time is not null and left(bs.end_time::text, 5) < nowhm and bs.end_time > bs.start_time))
           group by d.d) q;
  out := out || x;
  -- Vận hành: khoản âm chưa xử lý (gộp 1 việc)
  select case when count(*) = 0 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('key', 'khoan_am', 'category', 'van_hanh', 'topic', 'khoan_am',
            'title', 'Xử lý ' || count(*) || ' khoản âm chưa xử lý (' || public.app__vnd(sum(s.amount)::bigint) || ')',
            'detail', string_agg(distinct e.code || ' – ' || e.name, ', '), 'link', '/quan-ly/khoan-am', 'at', min(r.work_date))) end into x
    from public.shift_shortfalls s join public.employees e on e.id = s.employee_id join public.shift_reports r on r.id = s.report_id
   where s.status = 'chua_xu_ly';
  out := out || x;
  -- Quản lý: chưa đọc bản mới nội quy / quy trình
  select coalesce(jsonb_agg(jsonb_build_object('key', 'doc:d=' || q.id || ':v=' || q.published_version, 'category', 'quan_ly', 'topic', 'noi_quy',
            'title', q.n || ' nhân viên chưa đọc ' || case q.kind when 'noi_quy' then 'nội quy' else 'quy trình' end || ': ' || coalesce(q.published_title, q.title),
            'detail', q.names, 'link', case q.kind when 'noi_quy' then '/noi-quy' else '/quy-trinh' end, 'at', q.published_at) order by q.kind, q.sort_order), '[]') into x
    from (select dc.*, count(e.id) n, string_agg(e.code || ' – ' || e.name, ', ' order by e.code) filter (where e.id is not null) names
            from public.docs dc
            join public.employees e on e.status = 'Đang làm'
             and not exists (select 1 from public.doc_reads rd where rd.doc_id = dc.id and rd.employee_id = e.id and rd.version >= dc.published_version)
           where dc.published_version > 0
           group by dc.id) q
   where q.n > 0;
  out := out || x;
  -- Quản lý: cam kết
  select coalesce(jsonb_agg(jsonb_build_object('key', 'cam_ket:' || st, 'category', 'quan_ly', 'topic', 'cam_ket',
            'title', n || ' nhân viên ' || case st when 'chua_ky' then 'chưa ký cam kết' else 'đã ký nhưng chưa nộp cam kết' end,
            'detail', names, 'link', '/quan-ly/nhan-vien', 'at', null)), '[]') into x
    from (select coalesce(c.status, 'chua_ky') st, count(*) n, string_agg(e.code || ' – ' || e.name, ', ' order by e.code) names
            from public.employees e left join public.employee_commitments c on c.employee_id = e.id
           where e.status = 'Đang làm' and coalesce(c.status, 'chua_ky') <> 'da_ky_nop'
           group by 1) q;
  out := out || x;
  -- Quản lý: đào tạo quá hạn (đào tạo tiếp, chưa đạt)
  select coalesce(jsonb_agg(jsonb_build_object('key', 'dao_tao:t=' || t.id, 'category', 'quan_ly', 'topic', 'dao_tao',
            'title', 'Đào tạo tiếp: ' || e.code || ' – ' || e.name || ' (quá 8 ngày, ' || public.app__dt_achieved(t.id) || '/' || public.app__dt_total(t.program_id) || ' hạng mục)',
            'detail', 'Bắt đầu ' || to_char(t.start_date::date, 'DD/MM/YYYY') || coalesce(' · đào tạo tiếp: ' || t.cont_trainer_name, ''),
            'link', '/dao-tao/phieu?id=' || t.id, 'at', t.start_date) order by t.start_date), '[]') into x
    from public.trainings t join public.employees e on e.id = t.employee_id
   where e.status = 'Đang làm' and t.cont_result is null and public.app__dt_status(t) = 'dao_tao_tiep';
  out := out || x;
  -- bỏ việc đã giao (còn mở)
  return coalesce((select jsonb_agg(i) from jsonb_array_elements(out) i
                    where not exists (select 1 from public.tasks t where t.auto_key = i ->> 'key' and t.status <> 'hoan_thanh')), '[]');
end $$;

-- ---------------------------------------------------------------- Quyền gọi hàm
revoke execute on function public.app__hm_min(text), public.app__shift_overlap(bigint, text, bigint, text), public.app__ft_parent(text),
  public.app__assign(bigint, bigint, int, text, bigint, text, int), public.app__order_ft_rule() from public, anon, authenticated;
revoke execute on function public.app_ca_open(bigint, text, text), public.app_ca_overview(text), public.app_viec_auto() from public, anon;
grant execute on function public.app_ca_open(bigint, text, text), public.app_ca_overview(text), public.app_viec_auto() to authenticated;
