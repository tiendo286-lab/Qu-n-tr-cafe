-- Công việc đào tạo dùng chung. Tài khoản nhận xét do Chủ chọn trên web.
alter table public.trainings add column if not exists workflow_review text;
alter table public.trainings add column if not exists workflow_review_by bigint references public.accounts(id) on delete set null;
alter table public.trainings add column if not exists workflow_review_at text;
alter table public.trainings add column if not exists workflow_legacy_done boolean;

update public.trainings t set workflow_legacy_done =
  public.app__dt_total(t.program_id) > 0
  and public.app__dt_achieved(t.id) >= public.app__dt_total(t.program_id)
where workflow_legacy_done is null;
alter table public.trainings alter column workflow_legacy_done set default false;
alter table public.trainings alter column workflow_legacy_done set not null;

create table if not exists public.training_followups (
  training_id bigint not null references public.trainings(id) on delete cascade,
  item_no integer not null,
  employee_id bigint references public.employees(id) on delete set null,
  note text,
  finished_at text,
  primary key (training_id, item_no)
);
alter table public.training_followups add column if not exists is_extra boolean not null default true;
alter table public.training_followups add column if not exists branch_id bigint references public.branches(id) on delete set null;
create index if not exists training_followups_employee_idx on public.training_followups(employee_id);
alter table public.training_followups enable row level security;
revoke all on public.training_followups from public, anon, authenticated;

create table if not exists public.training_review_config (
  singleton boolean primary key default true check (singleton),
  account_id bigint not null references public.accounts(id) on delete cascade
);
alter table public.training_review_config enable row level security;
revoke all on public.training_review_config from public, anon, authenticated;

create or replace function public.app__dt_reviewer() returns bigint
language sql stable set search_path = public as $$
  select a.id from public.training_review_config s
  join public.accounts a on a.id = s.account_id
  left join public.employees e on e.id = a.employee_id
  where s.singleton and a.locked = 0
    and (a.employee_id is null or e.status = 'Đang làm')
$$;

create or replace function public.app__dt_status(t public.trainings) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.training_followups f where f.training_id = t.id and f.is_extra and f.finished_at is null)
      then 'dao_tao_bo_sung'
    when public.app__dt_total(t.program_id) > 0
      and public.app__dt_achieved(t.id) >= public.app__dt_total(t.program_id)
      then case when t.workflow_legacy_done or t.workflow_review_at is not null
        then 'hoan_thanh' else 'cho_nhan_xet' end
    when public.vn_now()::date >= t.start_date::date + 8 or t.cont_trainer_kind is not null
      then 'dao_tao_tiep'
    else 'dang_dao_tao' end
$$;

create or replace function public.app_dt_work_list(p_mine boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; reviewer bigint; see_all boolean;
begin
  a := public.app__need(null);
  reviewer := public.app__dt_reviewer();
  see_all := a.system_role in ('chu', 'ql_tong', 'ql')
    or coalesce(a.id = reviewer, false) or coalesce(public.app_can('dao_tao'), false);
  return jsonb_build_object(
    'today', public.vn_now()::date, 'reviewer', public.app__acc_name(reviewer), 'reviewer_id', reviewer,
    'accounts', case when not p_mine and a.system_role = 'chu' then coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', public.app__acc_name(x.id)) order by public.app__acc_name(x.id))
      from public.accounts x left join public.employees e on e.id = x.employee_id
      where x.locked = 0 and (x.employee_id is null or e.status = 'Đang làm')
    ), '[]') end,
    'rows', coalesce((select jsonb_agg(public.app__dt_summary(t) || jsonb_build_object(
      'employee', e.code || ' – ' || e.name, 'program', pr.code, 'due', t.start_date::date + 12,
      'my_duties', duties.roles,
      'my_followups', (select count(*) from public.training_followups f
        where f.training_id = t.id and f.employee_id = a.employee_id and f.is_extra and f.finished_at is null)
    ) order by (public.app__dt_status(t) = 'hoan_thanh'), t.start_date, t.id)
    from public.trainings t join public.employees e on e.id = t.employee_id
    join public.training_programs pr on pr.id = t.program_id
    cross join lateral (select array_remove(array[
      case when t.manager_id = a.id then 'Quản lý phụ trách' end,
      case when a.id = reviewer then 'Kiểm tra và nhận xét' end,
      case when a.employee_id in (t.instructor_id, t.cont_trainer_id) then 'Hướng dẫn' end,
      case when a.employee_id = t.employee_id then 'Bạn được đào tạo' end,
      case when exists (select 1 from public.training_followups f
        left join public.training_marks m on m.training_id = f.training_id and m.item_no = f.item_no
        where f.training_id = t.id and f.employee_id = a.employee_id and f.finished_at is null
          and (f.is_extra or m.level is null)) then 'Hướng dẫn hạng mục được giao' end
    ], null) as roles) duties
    where e.status = 'Đang làm' and (
      (p_mine and cardinality(duties.roles) > 0 and public.app__dt_status(t) <> 'hoan_thanh')
      or (not p_mine and (see_all or cardinality(duties.roles) > 0
        or exists (select 1 from public.training_followups f where f.training_id = t.id and f.employee_id = a.employee_id)))
    )), '[]'));
end $$;

create or replace function public.app__dt_notify_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
declare recipient bigint; link text; is_new boolean;
begin
  is_new := tg_op = 'INSERT';
  if new.workflow_legacy_done or new.workflow_review_at is not null then return new; end if;
  link := '/dao-tao/phieu?id=' || new.id;
  for recipient in
    select distinct x.id from public.accounts x where x.locked = 0 and (
      (x.id = new.manager_id and (is_new or new.manager_id is distinct from old.manager_id))
      or (x.employee_id = new.instructor_id and (is_new or new.instructor_id is distinct from old.instructor_id))
      or (x.employee_id = new.cont_trainer_id and (is_new or new.cont_trainer_id is distinct from old.cont_trainer_id))
    )
  loop
    perform public.app__notify(recipient, 'Bạn được phân công đào tạo', 'Xem phiếu để biết nhiệm vụ và hạn hoàn thành.', link);
  end loop;
  return new;
end $$;

drop trigger if exists training_notify_assignment on public.trainings;
create trigger training_notify_assignment
after insert or update of manager_id, instructor_id, cont_trainer_id on public.trainings
for each row execute function public.app__dt_notify_assignment();

create or replace function public.app_dt_reviewer_save(p_account bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; previous bigint;
begin
  a := public.app__need(null);
  if a.system_role is distinct from 'chu' then raise exception 'Chỉ Chủ được chọn người nhận xét.'; end if;
  if not exists (select 1 from public.accounts x left join public.employees e on e.id = x.employee_id
      where x.id = p_account and x.locked = 0 and (x.employee_id is null or e.status = 'Đang làm')) then
    raise exception 'Chọn một tài khoản đang hoạt động.';
  end if;
  select account_id into previous from public.training_review_config where singleton for update;
  insert into public.training_review_config(singleton, account_id) values (true, p_account)
  on conflict (singleton) do update set account_id = excluded.account_id;
  if previous is distinct from p_account then
    perform public.app__notify(p_account, 'Bạn phụ trách kiểm tra đào tạo',
      'Xem các phiếu cần theo dõi và nhận xét trong Việc của tôi.', '/viec');
  end if;
  perform public.app_log('dao_tao_chon_nguoi_nhan_xet', p_account::text);
end $$;

create or replace function public.app__dt_can_assign(a public.accounts, t public.trainings) returns boolean
language sql stable set search_path = public as $$
  select a.system_role in ('chu', 'ql_tong', 'ql') or coalesce(public.app_can('dao_tao'), false)
    or coalesce(t.manager_id = a.id, false) or coalesce(a.id = public.app__dt_reviewer(), false)
$$;

create or replace function public.app_dt_followup_save(
  p_id bigint, p_no integer, p_employee bigint, p_note text, p_extra boolean default true, p_branch bigint default null
) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; item_title text; link text; item_branch bigint; notify_emp bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if p_extra is null then raise exception 'Chọn loại phân công.'; end if;
  if p_branch is not null and not exists (
    select 1 from public.branches where id = p_branch and status = 'Đang hoạt động'
  ) then raise exception 'Chọn cơ sở đang hoạt động.'; end if;
  if p_employee is null and p_extra then
    if a.id is distinct from public.app__dt_reviewer() then raise exception 'Chỉ người nhận xét được yêu cầu luyện thêm.'; end if;
    if nullif(btrim(p_note), '') is null then raise exception 'Nhập nội dung cần luyện thêm.'; end if;
  else
    if not public.app__dt_can_assign(a, t) then
      raise exception 'Bạn không có quyền phân công phiếu này.';
    end if;
    if p_employee is null and exists (
      select 1 from public.training_followups f where f.training_id = t.id and f.item_no = p_no
        and f.is_extra and f.finished_at is null
    ) then
      p_employee := t.instructor_id;
      if p_employee is null then raise exception 'Chọn người hướng dẫn hạng mục bổ sung.'; end if;
    end if;
    if p_employee is not null and not exists (select 1 from public.employees e join public.accounts x on x.employee_id = e.id
        where e.id = p_employee and x.locked = 0 and e.status = 'Đang làm'
          and e.id <> t.employee_id and (e.id = t.instructor_id or e.rank in ('Cấp 1', 'Quản lý'))) then
      raise exception 'Chọn người hướng dẫn chính, quản lý hoặc nhân viên cấp 1 có tài khoản hoạt động.';
    end if;
  end if;
  if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
  select title into item_title from public.training_items where program_id = t.program_id and no = p_no;
  if not found then raise exception 'Hạng mục không hợp lệ.'; end if;
  insert into public.training_followups(training_id, item_no, employee_id, note, is_extra, branch_id)
    values (t.id, p_no, p_employee, nullif(btrim(p_note), ''), p_extra, p_branch)
  on conflict (training_id, item_no) do update set employee_id = excluded.employee_id,
    note = coalesce(excluded.note, training_followups.note), finished_at = null,
    is_extra = excluded.is_extra or (training_followups.is_extra and training_followups.finished_at is null),
    branch_id = case when excluded.is_extra then coalesce(excluded.branch_id, training_followups.branch_id)
      else excluded.branch_id end
  returning is_extra, branch_id into p_extra, item_branch;
  link := '/dao-tao/phieu?id=' || t.id;
  notify_emp := coalesce(p_employee, case when not p_extra then t.instructor_id end);
  if notify_emp is not null then
    perform public.app__notify_emp(notify_emp, case when p_extra then 'Bạn được giao đào tạo bổ sung' else 'Bạn được giao hướng dẫn hạng mục' end, item_title, link);
  end if;
  if t.manager_id is not null and t.manager_id <> a.id and not exists (
    select 1 from public.accounts x where x.id = t.manager_id and x.employee_id = notify_emp
  ) then
    perform public.app__notify(t.manager_id,
      case when p_extra and p_employee is null then 'Cần phân người đào tạo bổ sung' else 'Hạng mục đào tạo có phân công mới' end,
      item_title, link);
  end if;
  perform public.app_log(case when p_extra then 'dao_tao_bo_sung' else 'dao_tao_phan_cong_huong_dan' end, format('training=%s item=%s employee=%s branch=%s', p_id, p_no, p_employee, item_branch));
end $$;

create or replace function public.app_dt_work_action(p_id bigint, p_action text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; recipient bigint; link text;
begin
  a := public.app__need(null);
  if a.id is distinct from public.app__dt_reviewer() then raise exception 'Chỉ người được giao nhận xét có quyền.'; end if;
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if p_action = 'review' then
    if public.vn_now()::date < t.start_date::date + 8 then
      raise exception 'Chưa đến mốc 8 ngày để hoàn thành phiếu.';
    end if;
    if public.app__dt_status(t) <> 'cho_nhan_xet' then raise exception 'Cần hoàn thành đủ hạng mục trước khi nhận xét cuối.'; end if;
    if nullif(btrim(p_note), '') is null then raise exception 'Nhập nhận xét cuối.'; end if;
    update public.trainings set workflow_review = btrim(p_note), workflow_review_by = a.id,
      workflow_review_at = public.vn_now_text() where id = p_id;
  elsif p_action = 'remind' then
    if public.app__dt_status(t) = 'hoan_thanh' then raise exception 'Phiếu đã hoàn thành.'; end if;
    link := '/dao-tao/phieu?id=' || p_id;
    for recipient in
      select x.id from public.accounts x where x.locked = 0 and x.id <> a.id and (
        x.id = t.manager_id or x.employee_id in (t.employee_id, t.instructor_id, t.cont_trainer_id)
        or exists (select 1 from public.training_followups f where f.training_id = t.id
          and f.employee_id = x.employee_id and f.finished_at is null))
    loop
      perform public.app__notify(recipient, 'Nhắc hoàn thành đào tạo',
        'Hạn ' || to_char(t.start_date::date + 12, 'DD/MM/YYYY') || coalesce(' · ' || nullif(btrim(p_note), ''), ''), link);
    end loop;
    if not found then
      raise exception 'Chưa có tài khoản phù hợp để nhận nhắc nhở.';
    end if;
  else
    raise exception 'Thao tác không hợp lệ.';
  end if;
  perform public.app_log('dao_tao_' || p_action, 'training=' || p_id);
end $$;

create or replace function public.app_dt_get(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t public.trainings; a public.accounts; me_emp bigint; pr public.training_programs;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id;
  if t.id is null then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  me_emp := public.app_my_employee();
  if not (public.app_can('dao_tao') or public.app_can('quan_ly_nhan_vien')
          or coalesce(me_emp = any(array_remove(array[t.employee_id, t.instructor_id, t.cont_trainer_id], null)), false)
          or public.app__dt_can_assign(a, t)
          or exists (select 1 from public.training_followups f where f.training_id = t.id and f.employee_id = me_emp)) then
    raise exception 'Bạn không xem được phiếu đào tạo này.';
  end if;
  select * into pr from public.training_programs where id = t.program_id;
  return to_jsonb(t) || public.app__dt_summary(t) || jsonb_build_object(
    'program', jsonb_build_object('code', pr.code, 'name', pr.name, 'days', pr.days),
    'employee', (select jsonb_build_object('code', e.code, 'name', e.name, 'rank', e.rank) from public.employees e where e.id = t.employee_id),
    'cont_trainer', (select e.code || ' – ' || e.name from public.employees e where e.id = t.cont_trainer_id),
    'items', (select jsonb_agg(jsonb_build_object('no', i.no, 'day', i.day, 'title', i.title, 'page', i.page,
                 'introduced', coalesce(m.introduced, false), 'practiced', coalesce(m.practiced, false), 'level', m.level,
                 'by', public.app__acc_name(m.by_account), 'at', m.at) order by i.no)
                from public.training_items i left join public.training_marks m on m.training_id = t.id and m.item_no = i.no where i.program_id = t.program_id),
    'days_log', coalesce((select jsonb_object_agg(d.day, jsonb_build_object('comment', d.comment, 'trainee_at', d.trainee_at, 'instructor_at', d.instructor_at,
                 'instructor_by', public.app__acc_name(d.instructor_by))) from public.training_days d where d.training_id = t.id), '{}'),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'content', k.content, 'status', k.status, 'due_date', k.due_date, 'assignee', public.app__acc_name(k.assignee_id)) order by k.id)
                         from public.tasks k where k.training_id = t.id), '[]'),
    'can_edit', public.app__dt_can_edit(t),
    'can_review', coalesce(a.id = public.app__dt_reviewer(), false),
    'can_assign', public.app__dt_can_assign(a, t),
    'due', t.start_date::date + 12, 'today', public.vn_now()::date,
    'review_from', t.start_date::date + 8,
    'item_branches', case when public.app__dt_can_assign(a, t) then coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'code', coalesce(b.display_code, b.code)) order by b.sort_order, b.id)
      from public.branches b where b.status = 'Đang hoạt động'
    ), '[]') end,
    'followups', coalesce((select jsonb_agg(jsonb_build_object(
      'no', f.item_no, 'employee_id', f.employee_id, 'name', e.name, 'note', f.note,
      'branch_id', f.branch_id, 'branch', coalesce(b.display_code, b.code),
      'finished_at', f.finished_at, 'is_extra', f.is_extra, 'mine', coalesce(f.employee_id = me_emp, false)
    ) order by f.item_no) from public.training_followups f
      left join public.employees e on e.id = f.employee_id
      left join public.branches b on b.id = f.branch_id where f.training_id = t.id), '[]'),
    'helpers', case when public.app__dt_can_assign(a, t)
      then coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.code || ' – ' || e.name) order by e.code)
        from public.employees e join public.accounts x on x.employee_id = e.id
        where x.locked = 0 and e.status = 'Đang làm' and e.id <> t.employee_id
          and (e.id = t.instructor_id or e.rank in ('Cấp 1', 'Quản lý'))), '[]') end,
    'can_admin', public.app_can('dao_tao'),
    'is_trainee', coalesce(me_emp = t.employee_id, false));
end $$;

create or replace function public.app_dt_mark(p_id bigint, p_no integer, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.trainings; m public.training_marks; intro boolean; prac boolean; lv text; old_status text; reviewer bigint;
begin
  a := public.app__need(null);
  select * into t from public.trainings where id = p_id for update;
  if not found then raise exception 'Không tìm thấy phiếu đào tạo.'; end if;
  if t.workflow_review_at is not null then raise exception 'Phiếu đã có nhận xét cuối.'; end if;
  if not (public.app__dt_can_edit(t) or exists (select 1 from public.training_followups f
      where f.training_id = t.id and f.item_no = p_no and f.employee_id = a.employee_id and (not f.is_extra or f.finished_at is null))) then
    raise exception 'Bạn chỉ được cập nhật hạng mục được giao.';
  end if;
  if not exists (select 1 from public.training_items where program_id = t.program_id and no = p_no) then raise exception 'Hạng mục không hợp lệ.'; end if;
  old_status := public.app__dt_status(t);
  select * into m from public.training_marks where training_id = t.id and item_no = p_no;
  intro := case when p ? 'introduced' then (p ->> 'introduced')::boolean else coalesce(m.introduced, false) end;
  prac := case when p ? 'practiced' then (p ->> 'practiced')::boolean else coalesce(m.practiced, false) end;
  lv := case when p ? 'level' then nullif(p ->> 'level', '') else m.level end;
  if prac and lv is null and (not coalesce(m.practiced, false) or m.level is not null) then
    raise exception 'Chọn mức đạt khi đánh dấu đã thực hành.';
  end if;
  if prac and not intro then raise exception 'Hạng mục % phải “Đã giới thiệu” trước khi “Đã thực hành”.', p_no; end if;
  if lv is not null and not (intro and prac) then raise exception 'Hạng mục % phải đủ “Đã giới thiệu” và “Đã thực hành có giám sát” rồi mới đánh giá mức đạt.', p_no; end if;
  if lv is not null and lv not in ('tb', 'kha', 'tot') then raise exception 'Mức đạt không hợp lệ.'; end if;
  insert into public.training_marks(training_id, item_no, introduced, practiced, level, by_account, at)
  values (t.id, p_no, intro, prac, lv, a.id, public.vn_now_text())
  on conflict (training_id, item_no) do update set introduced = excluded.introduced, practiced = excluded.practiced, level = excluded.level,
         by_account = excluded.by_account, at = excluded.at;
  update public.training_followups
    set finished_at = case when lv is not null then public.vn_now_text() end
    where training_id = t.id and item_no = p_no and employee_id is not null
      and (employee_id = a.employee_id or public.app_can('dao_tao') or t.manager_id = a.id)
      and (p ? 'level' or lv is null);
  update public.trainings set updated_at = public.vn_now_text(),
    workflow_legacy_done = workflow_legacy_done and lv is not null
    where id = t.id returning * into t;
  reviewer := public.app__dt_reviewer();
  if reviewer is not null and old_status <> 'cho_nhan_xet' and public.app__dt_status(t) = 'cho_nhan_xet' then
    perform public.app__notify(reviewer, 'Phiếu đào tạo chờ nhận xét',
      'Đã hoàn thành các hạng mục', '/dao-tao/phieu?id=' || t.id);
  end if;
  return jsonb_build_object('by', public.app__acc_name(a.id), 'at', public.vn_now_text(), 'achieved', public.app__dt_achieved(t.id), 'status', public.app__dt_status(t));
end $$;

revoke execute on function public.app__dt_notify_assignment(), public.app__dt_reviewer(), public.app__dt_can_assign(public.accounts, public.trainings) from public, anon, authenticated;
revoke execute on function public.app_dt_work_list(boolean), public.app_dt_reviewer_save(bigint),
  public.app_dt_followup_save(bigint, integer, bigint, text, boolean, bigint), public.app_dt_work_action(bigint, text, text) from public, anon;
grant execute on function public.app_dt_work_list(boolean), public.app_dt_reviewer_save(bigint),
  public.app_dt_followup_save(bigint, integer, bigint, text, boolean, bigint), public.app_dt_work_action(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('120_cong_viec_dao_tao.sql') on conflict (file) do nothing;
