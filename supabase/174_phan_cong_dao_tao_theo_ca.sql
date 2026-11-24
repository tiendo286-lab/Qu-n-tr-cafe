-- 174 (anh Tiến duyệt 24/11/2026): PHÂN CÔNG ĐÀO TẠO THEO CA — trang mới chạy song song trang Đào tạo cũ.
--  * training_followups thêm ngày ca dạy (work_date), tên ca (work_shift), "giao lại bởi" (sub_by = quản lý đã giao lại cho Cấp 1).
--    Một hạng mục vẫn là MỘT dòng: chuyển ca = sửa dòng đó (rời ca cũ). Lịch sử tích (training_mark_log) giữ nguyên.
--  * Trang cũ (app_dt_followup_save / app_dt_assign_bulk) đổi người dạy một mục → mục rời ca (xoá ngày / ca / giao lại bởi),
--    trang mới hiện "đã giao, chưa xếp ca". Hàm mới đặt cờ phiên app.dt_plan để không bị xoá.
--  * app_dt_plan_board / app_dt_plan_assign / app_dt_plan_unassign: người có quyền giao như cũ (Chủ, người phụ trách chính, HD chính).
--  * MỞ THÊM QUYỀN (anh đồng ý 24/11): quản lý được giao ở một ca được giao lại CHỈ phần của mình cho một nhân viên Cấp 1
--    (app_dt_sub_assign) và Lấy lại khi Cấp 1 chưa chấm (app_dt_sub_take); quản lý đó được Xác nhận đạt mục mình đã giao lại
--    (app_dt_check_ok), và được báo khi Cấp 1 ghi mức. Không đổi quyền nào khác.
--  * app_dt_my_plan: việc đào tạo của tôi (Việc hôm nay).
--  Chạy lại nhiều lần không lỗi.

alter table public.training_followups add column if not exists work_date date;
alter table public.training_followups add column if not exists work_shift text;
alter table public.training_followups add column if not exists sub_by bigint references public.employees(id) on delete set null;
create index if not exists training_followups_ca on public.training_followups (training_id, work_date, work_shift);

-- ---------------------------------------------------------------- trang cũ đổi người → mục rời ca
create or replace function public.app__dt_followup_plan_clear() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.employee_id is distinct from old.employee_id and coalesce(current_setting('app.dt_plan', true), '') <> '1' then
    new.work_date := null; new.work_shift := null; new.sub_by := null;
  end if;
  return new;
end $$;
drop trigger if exists training_followups_plan_clear on public.training_followups;
create trigger training_followups_plan_clear before update on public.training_followups
  for each row execute function public.app__dt_followup_plan_clear();

-- ---------------------------------------------------------------- lịch đã công bố của một người từ một ngày
create or replace function public.app__dt_sched(p_emp bigint, p_from date) returns table(d date, branch_id bigint, shift text)
language sql stable set search_path = public as $$
  select distinct (w.start_date::date + sp.weekday), sp.branch_id, sp.shift
    from public.schedule_published sp join public.weeks w on w.id = sp.week_id
   where sp.employee_id = p_emp and (w.start_date::date + sp.weekday) >= p_from
$$;
-- người làm cùng ca (theo lịch đã công bố), trừ một người
create or replace function public.app__dt_mates(p_date date, p_shift text, p_branch bigint, p_except bigint) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(distinct sp.employee_id), '[]'::jsonb)
    from public.schedule_published sp join public.weeks w on w.id = sp.week_id
   where w.start_date::date <= p_date and w.start_date::date + 6 >= p_date and (w.start_date::date + sp.weekday) = p_date
     and sp.shift = p_shift and sp.branch_id = p_branch and sp.employee_id is distinct from p_except
$$;
-- trạng thái một hạng mục: chua · gioi_thieu · cho_kt · dat
create or replace function public.app__dt_item_state(m public.training_marks) returns text
language sql immutable as $$
  select case when m.level is not null and coalesce(m.cho_kiem_tra, false) then 'cho_kt' when m.level is not null then 'dat'
              when coalesce(m.introduced, false) then 'gioi_thieu' else 'chua' end
$$;

-- ---------------------------------------------------------------- bảng phân công theo ca
create or replace function public.app_dt_plan_board() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; all_open boolean;
begin
  a := public.app__need(null);
  all_open := coalesce(a.system_role = 'chu', false) or public.app__dt_is_ptc(a);
  if not all_open and not exists (select 1 from public.trainings t join public.employees e on e.id = t.employee_id
      where a.employee_id is not null and t.instructor_id = a.employee_id and e.status = 'Đang làm' and public.app__dt_status(t) <> 'hoan_thanh') then
    return jsonb_build_object('can_board', false, 'rows', '[]'::jsonb);
  end if;
  return jsonb_build_object('can_board', true, 'today', public.vn_now()::date::text,
    'trainers', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name, 'rank', e.rank,
        'branches', coalesce((select jsonb_agg(coalesce(b.display_code, b.code) order by b.sort_order) from public.employee_branches eb
                               join public.branches b on b.id = eb.branch_id where eb.employee_id = e.id), '[]'::jsonb)) order by e.rank desc, e.code)
      from public.employees e where e.status = 'Đang làm' and e.rank in ('Cấp 1', 'Quản lý')
        and exists (select 1 from public.accounts x where x.employee_id = e.id and x.locked = 0)), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(r order by r ->> 'start_date', (r ->> 'id')::bigint) from (
      select jsonb_build_object(
        'id', t.id, 'employee_id', t.employee_id, 'employee', e.code || ' – ' || e.name, 'program', pr.name,
        'start_date', t.start_date, 'due', (t.start_date::date + 12)::text,
        'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = t.branch_id),
        'instructor_id', t.instructor_id, 'instructor', (select h.code || ' – ' || h.name from public.employees h where h.id = t.instructor_id),
        'achieved', public.app__dt_achieved(t.id), 'total', public.app__dt_total(t.program_id), 'can_check', public.app__dt_can_check(a, t),
        'shifts', coalesce((select jsonb_agg(jsonb_build_object('date', s.d::text, 'branch_id', s.branch_id,
              'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = s.branch_id), 'shift', s.shift,
              'mates', public.app__dt_mates(s.d, s.shift, s.branch_id, t.employee_id))
            order by s.d, coalesce(array_position(public.app__shifts(), s.shift), 99))
          from public.app__dt_sched(t.employee_id, t.start_date::date) s), '[]'::jsonb),
        'items', coalesce((select jsonb_agg(jsonb_build_object('no', i.no, 'day', i.day, 'title', i.title,
              'state', public.app__dt_item_state(m), 'level', m.level, 'who_id', f.employee_id, 'date', f.work_date::text, 'shift', f.work_shift,
              'branch_id', f.branch_id, 'sub_by', f.sub_by,
              'pending_by', case when m.cho_kiem_tra and m.level is not null then public.app__acc_name(m.cho_by) end,
              'pending_at', case when m.cho_kiem_tra and m.level is not null then m.cho_at end) order by i.no)
          from public.training_items i
          left join public.training_marks m on m.training_id = t.id and m.item_no = i.no
          left join public.training_followups f on f.training_id = t.id and f.item_no = i.no
          where i.program_id = t.program_id), '[]'::jsonb)) r
      from public.trainings t
      join public.employees e on e.id = t.employee_id and e.status = 'Đang làm'
      join public.training_programs pr on pr.id = t.program_id
      where public.app__dt_status(t) <> 'hoan_thanh' and (all_open or t.instructor_id = a.employee_id)) x), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- giao các mục cho một người ở một ca
create or replace function public.app_dt_plan_assign(p_id bigint, p_date date, p_shift text, p_branch bigint, p_employee bigint, p_items integer[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; f public.training_followups; v integer; br bigint; n int := 0; moved int := 0; skipped int := 0;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not public.app__dt_can_assign(a, t) then
    raise exception 'Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.';
  end if;
  if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
  if p_employee is null then raise exception 'Chọn người dạy.'; end if;
  if p_date is null or p_date < public.vn_now()::date then raise exception 'Ngày đã qua không phân công lại được.'; end if;
  select s.branch_id into br from public.app__dt_sched(t.employee_id, t.start_date::date) s
   where s.d = p_date and s.shift = p_shift order by (s.branch_id = p_branch) desc limit 1;
  if br is null then raise exception 'Ca này không có trong lịch đã công bố của nhân viên.'; end if;
  perform set_config('app.dt_bulk', '1', true); perform set_config('app.dt_plan', '1', true);
  -- phần của người này ở ca này mà nay bỏ tích (chưa chấm) → trả về chưa xếp ca (người hướng dẫn chính)
  for f in select * from public.training_followups x where x.training_id = t.id and x.employee_id = p_employee
      and x.work_date = p_date and x.work_shift = p_shift and not (x.item_no = any(coalesce(p_items, '{}'))) loop
    continue when exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = f.item_no and mk.level is not null);
    perform public.app_dt_followup_save(t.id, f.item_no, null, null, false, null);
    update public.training_followups set work_date = null, work_shift = null, sub_by = null where training_id = t.id and item_no = f.item_no;
  end loop;
  foreach v in array coalesce(p_items, '{}') loop
    if exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = v and mk.level is not null) then
      skipped := skipped + 1; continue;
    end if;
    select * into f from public.training_followups where training_id = t.id and item_no = v;
    if f.work_date is not null and (f.work_date <> p_date or f.work_shift is distinct from p_shift) then moved := moved + 1; end if;
    perform public.app_dt_followup_save(t.id, v, p_employee, null, false, br);
    update public.training_followups set work_date = p_date, work_shift = p_shift, sub_by = null where training_id = t.id and item_no = v;
    n := n + 1;
  end loop;
  perform set_config('app.dt_bulk', '', true); perform set_config('app.dt_plan', '', true);
  if n > 0 and p_employee is distinct from a.employee_id then
    perform public.app__notify_emp(p_employee, 'Bạn được giao đào tạo',
      format('Ca %s %s · %s mục · %s', p_shift, to_char(p_date, 'DD/MM'), n, (select e.code || ' – ' || e.name from public.employees e where e.id = t.employee_id)),
      '/dao-tao/phan-cong');
  end if;
  perform public.app_log('dao_tao_phan_cong_ca', format('training=%s date=%s shift=%s employee=%s items=%s', p_id, p_date, p_shift, p_employee, p_items));
  return jsonb_build_object('n', n, 'moved', moved, 'skipped', skipped);
end $$;

-- ---------------------------------------------------------------- bỏ phần của một người ở một ca (mục chưa chấm)
create or replace function public.app_dt_plan_unassign(p_id bigint, p_date date, p_shift text, p_employee bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; f public.training_followups; n int := 0;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not public.app__dt_can_assign(a, t) then
    raise exception 'Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.';
  end if;
  if p_date is null or p_date < public.vn_now()::date then raise exception 'Ngày đã qua không phân công lại được.'; end if;
  perform set_config('app.dt_bulk', '1', true); perform set_config('app.dt_plan', '1', true);
  for f in select * from public.training_followups x where x.training_id = t.id and x.employee_id = p_employee
      and x.work_date = p_date and x.work_shift = p_shift loop
    continue when exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = f.item_no and mk.level is not null);
    perform public.app_dt_followup_save(t.id, f.item_no, null, null, false, null);
    update public.training_followups set work_date = null, work_shift = null, sub_by = null where training_id = t.id and item_no = f.item_no;
    n := n + 1;
  end loop;
  perform set_config('app.dt_bulk', '', true); perform set_config('app.dt_plan', '', true);
  perform public.app_log('dao_tao_bo_giao_ca', format('training=%s date=%s shift=%s employee=%s n=%s', p_id, p_date, p_shift, p_employee, n));
  return n;
end $$;

-- ---------------------------------------------------------------- quản lý giao lại phần của mình cho Cấp 1
create or replace function public.app__dt_sub_guard(a public.accounts, t public.trainings, p_date date, p_shift text) returns void
language plpgsql stable set search_path = public as $$
begin
  if a.employee_id is null or not exists (select 1 from public.employees e where e.id = a.employee_id and e.rank = 'Quản lý' and e.status = 'Đang làm') then
    raise exception 'Chỉ quản lý được giao lại cho Cấp 1.';
  end if;
  if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
  if p_date is null or p_date < public.vn_now()::date then raise exception 'Ngày đã qua không giao lại được.'; end if;
  if not exists (select 1 from public.training_followups f where f.training_id = t.id and f.work_date = p_date and f.work_shift = p_shift
      and ((f.employee_id = a.employee_id and f.sub_by is null) or f.sub_by = a.employee_id)) then
    raise exception 'Bạn không có phần dạy ở ca này.';
  end if;
end $$;

create or replace function public.app_dt_sub_assign(p_id bigint, p_date date, p_shift text, p_employee bigint, p_items integer[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; me bigint; n int := 0;
begin
  a := public.app__need(null); me := a.employee_id;
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  perform public.app__dt_sub_guard(a, t, p_date, p_shift);
  if not exists (select 1 from public.employees e join public.accounts x on x.employee_id = e.id
      where e.id = p_employee and e.rank = 'Cấp 1' and e.status = 'Đang làm' and x.locked = 0 and e.id <> t.employee_id) then
    raise exception 'Chỉ giao lại cho nhân viên Cấp 1 có tài khoản.';
  end if;
  if exists (select 1 from unnest(coalesce(p_items, '{}')) v(no) where not exists (
        select 1 from public.training_followups f where f.training_id = t.id and f.item_no = v.no and f.work_date = p_date and f.work_shift = p_shift
           and ((f.employee_id = me and f.sub_by is null) or f.sub_by = me))
      or exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = v.no and mk.level is not null)) then
    raise exception 'Chỉ giao lại được mục của bạn, chưa chấm.';
  end if;
  perform set_config('app.dt_plan', '1', true);
  -- mục người này đang giữ (do tôi giao) mà nay bỏ tích, chưa chấm → về tôi
  update public.training_followups f set employee_id = me, sub_by = null
   where f.training_id = t.id and f.work_date = p_date and f.work_shift = p_shift and f.employee_id = p_employee and f.sub_by = me
     and not (f.item_no = any(coalesce(p_items, '{}')))
     and not exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = f.item_no and mk.level is not null);
  update public.training_followups f set employee_id = p_employee, sub_by = me
   where f.training_id = t.id and f.item_no = any(coalesce(p_items, '{}')) and f.employee_id is distinct from p_employee;
  get diagnostics n = row_count;
  perform set_config('app.dt_plan', '', true);
  if n > 0 then
    perform public.app__notify_emp(p_employee, 'Bạn được giao đào tạo',
      format('%s giao lại · ca %s %s · %s mục · %s', (select e.code || ' – ' || e.name from public.employees e where e.id = me),
        p_shift, to_char(p_date, 'DD/MM'), n, (select e.code || ' – ' || e.name from public.employees e where e.id = t.employee_id)),
      '/hom-nay');
  end if;
  perform public.app_log('dao_tao_giao_lai', format('training=%s date=%s shift=%s cap1=%s items=%s', p_id, p_date, p_shift, p_employee, p_items));
  return jsonb_build_object('n', n);
end $$;

create or replace function public.app_dt_sub_take(p_id bigint, p_date date, p_shift text, p_employee bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; n int := 0;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  perform public.app__dt_sub_guard(a, t, p_date, p_shift);
  perform set_config('app.dt_plan', '1', true);
  update public.training_followups f set employee_id = a.employee_id, sub_by = null
   where f.training_id = t.id and f.work_date = p_date and f.work_shift = p_shift and f.employee_id = p_employee and f.sub_by = a.employee_id
     and not exists (select 1 from public.training_marks mk where mk.training_id = t.id and mk.item_no = f.item_no and mk.level is not null);
  get diagnostics n = row_count;
  perform set_config('app.dt_plan', '', true);
  perform public.app_log('dao_tao_lay_lai', format('training=%s date=%s shift=%s cap1=%s n=%s', p_id, p_date, p_shift, p_employee, n));
  return n;
end $$;

-- ---------------------------------------------------------------- Cấp 1 được giao lại ghi mức → báo quản lý đã giao lại
create or replace function public.app__dt_sub_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare acc bigint;
begin
  if new.cho_kiem_tra and new.level is not null and (tg_op = 'INSERT' or not coalesce(old.cho_kiem_tra, false)) then
    select x.id into acc from public.training_followups f join public.accounts x on x.employee_id = f.sub_by and x.locked = 0
     where f.training_id = new.training_id and f.item_no = new.item_no and f.sub_by is not null order by x.id limit 1;
    if acc is not null then
      perform public.app__dt_notify_once(acc, 'Hạng mục đào tạo chờ kiểm tra', 'Cấp 1 bạn giao lại đã ghi mức đạt — bấm Xác nhận đạt.', '/hom-nay');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists training_marks_sub_notify on public.training_marks;
create trigger training_marks_sub_notify after insert or update on public.training_marks
  for each row execute function public.app__dt_sub_notify();

-- ---------------------------------------------------------------- Xác nhận đạt: thêm quản lý đã giao lại mục đó (bản tệp 148 + 1 điều kiện)
create or replace function public.app_dt_check_ok(p_id bigint, p_no integer, p_level text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; m public.training_marks; lv text; old_status text; reviewer bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if not (public.app__dt_can_check(a, t) or exists (select 1 from public.training_followups f
      where f.training_id = t.id and f.item_no = p_no and a.employee_id is not null and f.sub_by = a.employee_id)) then
    raise exception 'Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc quản lý đã giao lại mục này được xác nhận đạt.';
  end if;
  if t.workflow_review_at is not null then raise exception 'Phiếu đã có nhận xét cuối.'; end if;
  select * into m from public.training_marks where training_id = t.id and item_no = p_no for update;
  if m.training_id is null or not m.cho_kiem_tra or m.level is null then raise exception 'Hạng mục này không chờ kiểm tra.'; end if;
  lv := coalesce(nullif(p_level, ''), m.level);
  if lv not in ('tb', 'kha', 'tot') then raise exception 'Mức đạt không hợp lệ.'; end if;
  old_status := public.app__dt_status(t);
  update public.training_marks set level = lv, cho_kiem_tra = false, checked_by = a.id, checked_at = public.vn_now_text()
   where training_id = t.id and item_no = p_no;
  update public.trainings set updated_at = public.vn_now_text() where id = t.id returning * into t;
  reviewer := public.app__dt_reviewer();
  if reviewer is not null and reviewer <> a.id and old_status <> 'cho_nhan_xet' and public.app__dt_status(t) = 'cho_nhan_xet' then
    perform public.app__notify(reviewer, 'Phiếu đào tạo chờ nhận xét', 'Đã hoàn thành các hạng mục', '/dao-tao/phieu?id=' || t.id);
  end if;
  perform public.app_log('dao_tao_xac_nhan_dat', format('training=%s item=%s level=%s', p_id, p_no, lv));
  return jsonb_build_object('achieved', public.app__dt_achieved(t.id), 'status', public.app__dt_status(t), 'level', lv);
end $$;

-- ---------------------------------------------------------------- việc đào tạo của tôi (Việc hôm nay)
create or replace function public.app_dt_my_plan() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; me bigint; today date := public.vn_now()::date;
begin
  a := public.app__need(null); me := a.employee_id;
  if me is null then return jsonb_build_object('today', today::text, 'shifts', '[]'::jsonb, 'checks', '[]'::jsonb, 'cap1', '[]'::jsonb); end if;
  return jsonb_build_object('today', today::text, 'me_id', me, 'me_rank', (select e.rank from public.employees e where e.id = me),
    'cap1', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name,
        'branches', coalesce((select jsonb_agg(coalesce(b.display_code, b.code) order by b.sort_order) from public.employee_branches eb
                               join public.branches b on b.id = eb.branch_id where eb.employee_id = e.id), '[]'::jsonb)) order by e.code)
      from public.employees e where e.rank = 'Cấp 1' and e.status = 'Đang làm' and exists (select 1 from public.accounts x where x.employee_id = e.id and x.locked = 0)), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(s order by s ->> 'date', (s ->> 'ord')::int, s ->> 'trainee') from (
      select jsonb_build_object('training_id', k.training_id, 'trainee', te.code || ' – ' || te.name, 'date', k.work_date::text, 'shift', k.work_shift,
          'ord', coalesce(array_position(public.app__shifts(), k.work_shift), 99),
          'branch', (select coalesce(b.display_code, b.code) from public.branches b where b.id = sb.branch_id),
          'day_no', (select count(distinct s2.d) from public.app__dt_sched(t.employee_id, t.start_date::date) s2 where s2.d <= k.work_date),
          'mates', case when sb.branch_id is null then '[]'::jsonb else public.app__dt_mates(k.work_date, k.work_shift, sb.branch_id, t.employee_id) end,
          'own', coalesce((select jsonb_agg(jsonb_build_object('no', f.item_no, 'title', i.title, 'state', public.app__dt_item_state(m), 'level', m.level) order by f.item_no)
              from public.training_followups f join public.training_items i on i.program_id = t.program_id and i.no = f.item_no
              left join public.training_marks m on m.training_id = f.training_id and m.item_no = f.item_no
             where f.training_id = k.training_id and f.work_date = k.work_date and f.work_shift = k.work_shift and f.employee_id = me), '[]'::jsonb),
          'subs', coalesce((select jsonb_agg(jsonb_build_object('who_id', g.employee_id, 'who', g.who, 'items', g.items) order by g.who) from (
              select f.employee_id, (select e.code || ' – ' || e.name from public.employees e where e.id = f.employee_id) who,
                     jsonb_agg(jsonb_build_object('no', f.item_no, 'title', i.title, 'state', public.app__dt_item_state(m), 'level', m.level) order by f.item_no) items
                from public.training_followups f join public.training_items i on i.program_id = t.program_id and i.no = f.item_no
                left join public.training_marks m on m.training_id = f.training_id and m.item_no = f.item_no
               where f.training_id = k.training_id and f.work_date = k.work_date and f.work_shift = k.work_shift and f.sub_by = me and f.employee_id is distinct from me
               group by f.employee_id) g), '[]'::jsonb),
          'by', (select e.code || ' – ' || e.name from public.training_followups f join public.employees e on e.id = f.sub_by
                  where f.training_id = k.training_id and f.work_date = k.work_date and f.work_shift = k.work_shift and f.employee_id = me
                  order by f.item_no limit 1)) s
        from (select distinct f.training_id, f.work_date, f.work_shift from public.training_followups f
               where f.work_date >= today - 1 and (f.employee_id = me or f.sub_by = me)) k
        join public.trainings t on t.id = k.training_id
        join public.employees te on te.id = t.employee_id
        left join lateral (select s1.branch_id from public.app__dt_sched(t.employee_id, k.work_date) s1
                            where s1.d = k.work_date and s1.shift = k.work_shift order by s1.branch_id limit 1) sb on true
       where public.app__dt_status(t) <> 'hoan_thanh') q), '[]'::jsonb),
    'checks', coalesce((select jsonb_agg(jsonb_build_object('training_id', t.id, 'trainee', te.code || ' – ' || te.name, 'no', m.item_no, 'title', i.title,
          'level', m.level, 'who', public.app__acc_name(m.cho_by), 'at', m.cho_at) order by m.cho_at, t.id, m.item_no)
      from public.training_followups f join public.training_marks m on m.training_id = f.training_id and m.item_no = f.item_no
      join public.trainings t on t.id = f.training_id join public.employees te on te.id = t.employee_id
      join public.training_items i on i.program_id = t.program_id and i.no = f.item_no
     where f.sub_by = me and m.cho_kiem_tra and m.level is not null and t.workflow_review_at is null), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- quyền: hàm nội bộ không cho web gọi; hàm app_* cho người đã đăng nhập
revoke all on function public.app__dt_followup_plan_clear(), public.app__dt_sched(bigint, date), public.app__dt_mates(date, text, bigint, bigint),
  public.app__dt_item_state(public.training_marks), public.app__dt_sub_guard(public.accounts, public.trainings, date, text), public.app__dt_sub_notify()
  from public, anon, authenticated;
revoke all on function public.app_dt_plan_board(), public.app_dt_plan_assign(bigint, date, text, bigint, bigint, integer[]),
  public.app_dt_plan_unassign(bigint, date, text, bigint), public.app_dt_sub_assign(bigint, date, text, bigint, integer[]),
  public.app_dt_sub_take(bigint, date, text, bigint), public.app_dt_check_ok(bigint, integer, text), public.app_dt_my_plan() from public, anon;
grant execute on function public.app_dt_plan_board(), public.app_dt_plan_assign(bigint, date, text, bigint, bigint, integer[]),
  public.app_dt_plan_unassign(bigint, date, text, bigint), public.app_dt_sub_assign(bigint, date, text, bigint, integer[]),
  public.app_dt_sub_take(bigint, date, text, bigint), public.app_dt_check_ok(bigint, integer, text), public.app_dt_my_plan() to authenticated;

insert into public.app_migrations(file) values ('174_phan_cong_dao_tao_theo_ca.sql') on conflict (file) do nothing;
