-- Bước 123: Việc tự thêm theo lịch từng cơ sở (Bảng phân công).
-- Chủ thêm việc lặp lại (số ≥ 100): tên, hướng dẫn, bắt buộc ảnh, có kiểm tra; mỗi cơ sở: bật, người làm, chu kỳ, ngày làm,
-- quá hạn cho phép, mức phạt, người kiểm tra + hạn kiểm tra. Web tự tạo việc theo lịch (app__pc_tick phần E), báo xong kèm ảnh,
-- kiểm tra Đạt / Làm lại, phạt theo cơ sở. Việc có sẵn không đổi (lần 2 = tệp 107). Chạy lại nhiều lần không sao.

-- ============ PHẦN 1: bảng + lưu / xoá ============
alter table public.pc_jobs add column if not exists name text;
alter table public.pc_jobs add column if not exists guide text;
alter table public.pc_jobs add column if not exists need_photo boolean not null default false;
alter table public.pc_jobs add column if not exists need_check boolean not null default false;
alter table public.pc_jobs add column if not exists custom boolean not null default false;
alter table public.pc_jobs add column if not exists deleted_at text;
alter table public.pc_tasks add column if not exists extra boolean not null default false;
alter table public.pc_tasks add column if not exists run_date text;
alter table public.pc_steps add column if not exists note text;
alter table public.pc_steps add column if not exists photos text[] not null default '{}';
alter table public.pc_steps add column if not exists redo boolean not null default false;

create table if not exists public.pc_sched (
  job int not null references public.pc_jobs(job) on delete cascade,
  branch_id bigint not null references public.branches(id) on delete cascade,
  enabled boolean not null default true,
  cycle text check (cycle in ('ngay', 'tuan', 'thang')),
  day int,
  grace_h numeric not null default 24,
  fine bigint not null default 50000,
  checkers bigint[] not null default '{}',
  check_h numeric not null default 24,
  due_h numeric,
  from_date text,
  updated_by bigint, updated_at text not null default public.vn_now_text(),
  primary key (job, branch_id)
);
revoke all on public.pc_sched from anon, authenticated;

-- Việc tự thêm (≥ 100): không có bước tự xong theo hồ sơ
create or replace function public.app__pc_auto(p_job int) returns int
language sql immutable as $$ select case when p_job >= 100 then 0 when p_job = 2 then 2 when p_job = 24 then 3 else 1 end $$;

create or replace function public.app_pc_custom_save(p_job int, p jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app__need('phan_cong'); j public.pc_jobs; e jsonb; nw text := public.vn_now_text(); today text := to_char(public.vn_now(), 'YYYY-MM-DD');
        jid int; chk boolean := coalesce((p->>'need_check')::boolean, false); br bigint; bc text; acc bigint[]; ckr bigint[]; cy text; dy int; old public.pc_sched;
begin
  if a.system_role <> 'chu' then raise exception 'Chỉ tài khoản Chủ sửa được Bảng phân công.'; end if;
  if trim(coalesce(p->>'name', '')) = '' then raise exception 'Ghi tên việc.'; end if;
  if jsonb_typeof(p->'rows') <> 'array' or jsonb_array_length(p->'rows') = 0 then raise exception 'Chưa có cơ sở nào.'; end if;
  if p_job is not null then
    select * into j from public.pc_jobs where job = p_job for update;
    if j.job is null or not j.custom or j.deleted_at is not null then raise exception 'Không tìm thấy việc.'; end if;
  end if;
  -- kiểm từng cơ sở trước khi ghi
  for e in select * from jsonb_array_elements(p->'rows') loop
    br := (e->>'branch_id')::bigint;
    select coalesce(display_code, code) into bc from public.branches where id = br;
    if bc is null then raise exception 'Không tìm thấy cơ sở.'; end if;
    cy := e->>'cycle'; dy := nullif(e->>'day', '')::int;
    if coalesce(cy, '') not in ('ngay', 'tuan', 'thang') then raise exception 'Chọn chu kỳ cho %.', bc; end if;
    if (cy = 'tuan' and coalesce(dy, 0) not between 1 and 7) or (cy = 'thang' and coalesce(dy, 0) not between 1 and 31) then raise exception 'Chọn ngày làm cho %.', bc; end if;
    if coalesce((e->>'grace_h')::numeric, 0) < 0 or coalesce((e->>'fine')::bigint, 0) < 0 then raise exception 'Số ở % không hợp lệ.', bc; end if;
    if chk and coalesce((e->>'enabled')::boolean, true) then
      acc := array(select jsonb_array_elements_text(coalesce(e->'accounts', '[]'))::bigint);
      ckr := array(select jsonb_array_elements_text(coalesce(e->'checkers', '[]'))::bigint);
      if cardinality(ckr) = 0 then raise exception 'Chọn người kiểm tra cho %.', bc; end if;
      if ckr && acc then raise exception 'Người kiểm tra phải khác người làm.'; end if;
      if coalesce((e->>'check_h')::numeric, 0) <= 0 then raise exception 'Chọn hạn kiểm tra cho %.', bc; end if;
    end if;
  end loop;
  if p_job is null then
    select greatest(100, coalesce(max(job), 0) + 1) into jid from public.pc_jobs;
    insert into public.pc_jobs(job, enabled, fine, same_as_1, steps, custom, updated_by)
    values (jid, true, 0, false, '[]', true, a.id);
  else jid := p_job; end if;
  update public.pc_jobs set name = trim(p->>'name'), guide = nullif(trim(coalesce(p->>'guide', '')), ''),
         need_photo = coalesce((p->>'need_photo')::boolean, false), need_check = chk,
         enabled = coalesce((p->>'enabled')::boolean, enabled), fine = 0,
         steps = '[{"n":"Làm","who":"branch","d":null}]'::jsonb || case when chk then '[{"n":"Kiểm tra","who":"check","d":null}]'::jsonb else '[]'::jsonb end,
         updated_by = a.id, updated_at = nw
   where job = jid;
  for e in select * from jsonb_array_elements(p->'rows') loop
    br := (e->>'branch_id')::bigint; cy := e->>'cycle'; dy := case when cy = 'ngay' then null else nullif(e->>'day', '')::int end;
    acc := array(select distinct jsonb_array_elements_text(coalesce(e->'accounts', '[]'))::bigint);
    ckr := array(select distinct jsonb_array_elements_text(coalesce(e->'checkers', '[]'))::bigint);
    select * into old from public.pc_sched where job = jid and branch_id = br;
    insert into public.pc_sched(job, branch_id, enabled, cycle, day, grace_h, fine, checkers, check_h, from_date, updated_by, updated_at)
    values (jid, br, coalesce((e->>'enabled')::boolean, true), cy, dy, coalesce((e->>'grace_h')::numeric, 24), coalesce((e->>'fine')::bigint, 0),
            ckr, coalesce((e->>'check_h')::numeric, 24), today, a.id, nw)
    on conflict (job, branch_id) do update set enabled = excluded.enabled, cycle = excluded.cycle, day = excluded.day, grace_h = excluded.grace_h,
       fine = excluded.fine, checkers = excluded.checkers, check_h = excluded.check_h, updated_by = a.id, updated_at = nw,
       from_date = case when pc_sched.cycle is distinct from excluded.cycle or pc_sched.day is distinct from excluded.day
                         or (not pc_sched.enabled and excluded.enabled) then excluded.from_date else pc_sched.from_date end;
    insert into public.pc_assign(job, branch_id, accounts, updated_by) values (jid, br, acc, a.id)
    on conflict (job, branch_id) do update set accounts = excluded.accounts, updated_by = a.id, updated_at = nw;
    if coalesce((p->>'apply')::boolean, false) then
      update public.pc_steps s set accounts = case when s.name = 'Kiểm tra' then public.app__pc_who(jid, 'check', br) else public.app__pc_who(jid, 'branch', br) end
        from public.pc_tasks t where t.id = s.task_id and t.job = jid and t.branch_id = br and t.done_at is null and s.done_at is null;
    end if;
  end loop;
  if p_job is not null and not j.enabled and coalesce((p->>'enabled')::boolean, j.enabled) then   -- bật lại cả việc: không tạo dồn lúc tạm tắt
    update public.pc_sched set from_date = today where job = jid;
  end if;
  perform public.app_log('pc_custom_save', 'job=' || jid);
  return jid;
end $$;

create or replace function public.app_pc_custom_delete(p_job int) returns int
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app__need('phan_cong'); nw text := public.vn_now_text(); n int;
begin
  if a.system_role <> 'chu' then raise exception 'Chỉ tài khoản Chủ sửa được Bảng phân công.'; end if;
  if not exists(select 1 from public.pc_jobs where job = p_job and custom and deleted_at is null) then raise exception 'Chỉ xoá được việc tự thêm.'; end if;
  update public.pc_jobs set deleted_at = nw, enabled = false, updated_by = a.id, updated_at = nw where job = p_job;
  update public.pc_steps s set done_at = nw from public.pc_tasks t where t.id = s.task_id and t.job = p_job and t.done_at is null and s.done_at is null;
  update public.pc_tasks set done_at = nw, done_by = a.id, done_note = 'Việc đã bị xoá' where job = p_job and done_at is null;
  get diagnostics n = row_count;
  perform public.app_log('pc_custom_delete', 'job=' || p_job || ' huy=' || n);
  return n;
end $$;

create or replace function public.app_pc_board() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app__need('phan_cong');
begin
  return jsonb_build_object('can_edit', a.system_role = 'chu',
    'jobs', (select jsonb_agg(jsonb_build_object('job', job, 'enabled', enabled, 'fine', fine, 'same_as_1', same_as_1, 'steps', steps,
               'name', name, 'guide', guide, 'need_photo', need_photo, 'need_check', need_check, 'custom', custom) order by job)
             from public.pc_jobs where deleted_at is null),
    'assign', coalesce((select jsonb_agg(jsonb_build_object('job', job, 'branch_id', branch_id, 'accounts', to_jsonb(accounts))) from public.pc_assign), '[]'),
    'sched', coalesce((select jsonb_agg(jsonb_build_object('job', s.job, 'branch_id', s.branch_id, 'enabled', s.enabled, 'cycle', s.cycle, 'day', s.day,
               'grace_h', s.grace_h, 'fine', s.fine, 'checkers', to_jsonb(s.checkers), 'check_h', s.check_h, 'due_h', s.due_h, 'from_date', s.from_date))
             from public.pc_sched s join public.pc_jobs j on j.job = s.job and j.deleted_at is null), '[]'),
    'branches', (select jsonb_agg(jsonb_build_object('id', id, 'code', coalesce(display_code, code), 'fabi', exists(select 1 from public.fabi_stores f where f.branch_id = b.id)) order by sort_order)
                   from public.branches b where status = 'Đang hoạt động'),
    'people', public.app__pc_people(),
    'kt', (select value::bigint from public.settings where key = 'pc_kt' and value ~ '^\d+$'),
    'start', (select value from public.settings where key = 'pc_start'),
    'old_rule_on', exists(select 1 from public.task_rules where enabled));
end $$;

-- ============ PHẦN 2: tạo việc theo lịch, làm bổ sung, phạt theo cơ sở ============
create or replace function public.app__pc_runs(p_cycle text, p_day int, p_from date, p_to date) returns setof date
language sql immutable as $$
  select g::date from generate_series(p_from, p_to, interval '1 day') g
   where case p_cycle when 'ngay' then true
                      when 'tuan' then extract(isodow from g) = p_day
                      when 'thang' then extract(day from g) = least(p_day, extract(day from (date_trunc('month', g) + interval '1 month - 1 day')))
                      else false end
$$;

CREATE OR REPLACE FUNCTION public.app__pc_who(p_job integer, p_who text, p_branch bigint)
 RETURNS bigint[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select array(select distinct x from unnest(
    case when p_who in ('branch', 'branch+ql_tong') then
           coalesce((select pa.accounts from public.pc_assign pa
                      where pa.branch_id = p_branch and pa.job = case when coalesce((select same_as_1 from public.pc_jobs where job = p_job), false) then 1 else p_job end), '{}')
           || case when p_who = 'branch+ql_tong' then coalesce((select array_agg(id) from public.accounts where system_role = 'ql_tong' and coalesce(locked, 0) = 0), '{}') else '{}'::bigint[] end
         when p_who = 'check' then coalesce((select sc.checkers from public.pc_sched sc where sc.job = p_job and sc.branch_id = p_branch), '{}')
         when p_who = 'kt' then coalesce((select array[value::bigint] from public.settings where key = 'pc_kt' and value ~ '^\d+$'), '{}')
         when p_who ~ '^acc:\d+$' then array[substr(p_who, 5)::bigint]
         else '{}'::bigint[] end) x
    where exists(select 1 from public.accounts a where a.id = x and coalesce(a.locked, 0) = 0))
$function$
;

CREATE OR REPLACE FUNCTION public.app__pc_open_step(p_task bigint, p_step integer, p_start text)
 RETURNS pc_steps
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t public.pc_tasks; j public.pc_jobs; s jsonb; r public.pc_steps; n_at text := coalesce(p_start, public.vn_now_text());
begin
  select * into t from public.pc_tasks where id = p_task;
  select * into j from public.pc_jobs where job = t.job;
  s := j.steps->p_step;
  insert into public.pc_steps(task_id, step, name, accounts, start_at, due_at)
  values (p_task, p_step, coalesce(s->>'n', 'Bước ' || (p_step + 1)), public.app__pc_who(t.job, s->>'who', t.branch_id), n_at,
          case when j.job in (11, 12, 13, 14) then null
               when j.custom and s->>'who' = 'check' then public.app__pc_add(n_at, (select sc.check_h from public.pc_sched sc where sc.job = t.job and sc.branch_id = t.branch_id) / 24.0)
               when j.custom then case when t.extra or t.run_date is null then null
                 else to_char(t.run_date::date + time '23:59:59' + make_interval(secs => coalesce((select sc.grace_h from public.pc_sched sc where sc.job = t.job and sc.branch_id = t.branch_id), 0) * 3600), 'YYYY-MM-DD HH24:MI:SS') end
               else public.app__pc_add(n_at, nullif(s->>'d', '')::numeric) end)
  returning * into r;
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.app__pc_task_json(p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('id', t.id, 'job', t.job, 'branch_id', t.branch_id, 'code', public.app__pc_bcode(t.branch_id), 'title', t.title, 'link', t.link,
    'created_at', t.created_at, 'done_at', t.done_at, 'done_by', public.app__acc_name(t.done_by), 'done_note', t.done_note,
    'n_steps', jsonb_array_length(j.steps), 'auto', public.app__pc_auto(t.job), 'fine', coalesce(sc.fine, j.fine),
    'job_name', j.name, 'guide', j.guide, 'need_photo', j.need_photo, 'need_check', j.need_check, 'custom', j.custom, 'extra', t.extra, 'run_date', t.run_date,
    'steps', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'step', s.step, 'name', s.name, 'accounts', to_jsonb(s.accounts),
               'names', (select coalesce(jsonb_agg(public.app__acc_name(x)), '[]') from unnest(s.accounts) x),
               'start_at', s.start_at, 'due_at', s.due_at, 'done_at', s.done_at, 'done_by', public.app__acc_name(s.done_by),
               'note', s.note, 'photos', to_jsonb(s.photos), 'redo', s.redo, 'check', coalesce(j.steps->s.step->>'who', '') = 'check' and not s.redo) order by s.id)
             from public.pc_steps s where s.task_id = t.id), '[]'),
    'items', case when t.job in (11, 12, 13, 14) then coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'link', i.link, 'start_at', i.start_at,
               'due_at', i.due_at, 'done_at', i.done_at) order by i.due_at nulls last, i.id)
             from public.pc_items i where i.task_id = t.id and (i.done_at is null or t.done_at is not null)), '[]') end)
  from public.pc_tasks t join public.pc_jobs j on j.job = t.job
  left join public.pc_sched sc on sc.job = t.job and sc.branch_id = t.branch_id where t.id = p_id
$function$
;

CREATE OR REPLACE FUNCTION public.app_pc_penalties(p_month text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app__need('phan_cong'); nw text := public.vn_now_text();
begin
  perform public.app__pc_tick_soon();
  return jsonb_build_object('can_edit', a.system_role = 'chu', 'now', nw, 'default_fine', 50000,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'job', p.job, 'code', public.app__pc_bcode(p.branch_id), 'account_id', p.account_id,
               'name', public.app__acc_name(p.account_id), 'role', (select system_role from public.accounts where id = p.account_id),
               'title', p.title, 'step', p.step_name, 'due_at', p.due_at, 'status', p.status, 'amount', p.amount, 'reason', p.reason,
               'decided_by', public.app__acc_name(p.decided_by), 'decided_at', p.decided_at,
               'fine', coalesce((select fine from public.pc_sched where job = p.job and branch_id = p.branch_id), (select fine from public.pc_jobs where job = p.job), 50000),
               'end_at', case p.src when 'pc' then (select done_at from public.pc_steps where id = split_part(p.key, ':', 2)::bigint)
                                    when 'pci' then (select done_at from public.pc_tasks where id = p.ref_id)
                                    else (select case when split_part(p.key, ':', 3) = 'cls' then coalesce(k.assigned_at, k.cancelled_at)
                                                      when split_part(p.key, ':', 3) = 'work' then k.submitted_at else k.approved_at end
                                            from public.tasks k where k.id = p.ref_id) end,
               'others', (select coalesce(jsonb_agg(public.app__acc_name(q.account_id)), '[]') from public.pc_penalties q
                           where q.id <> p.id and q.src = p.src and q.ref_id = p.ref_id and q.due_at = p.due_at)) order by p.due_at)
             from public.pc_penalties p where left(p.due_at, 7) = p_month), '[]'));
end $function$
;

CREATE OR REPLACE FUNCTION public.app__pc_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nw text := public.vn_now_text(); s record; sc record; d date; ex date; t public.pc_tasks; cs public.pc_steps; r public.pc_steps; a bigint; tid bigint; p record;
begin
  if not pg_try_advisory_xact_lock(950109) then return; end if;
  insert into public.settings(key, value) values ('pc_tick_at', nw) on conflict (key) do update set value = excluded.value;
  create temp table if not exists _pc_src (job int, key text, branch_id bigint, title text, link text, start_at text, step int) on commit drop;
  truncate _pc_src;
  insert into _pc_src select x.* from public.app__pc_sources() x join public.pc_jobs j on j.job = x.job and j.enabled;

  -- A. Việc từng hồ sơ (1, 2, 3, 4, 7, 8, 10)
  for s in select * from _pc_src where job not in (11, 12, 13, 14) loop
    select * into t from public.pc_tasks where key = s.job || ':' || s.key;
    if t.id is null then
      insert into public.pc_tasks(job, key, branch_id, title, link) values (s.job, s.job || ':' || s.key, s.branch_id, s.title, s.link) returning * into t;
      r := public.app__pc_open_step(t.id, s.step, case when s.step > 0 then nw else coalesce(s.start_at, nw) end);
      foreach a in array r.accounts loop
        perform public.app__notify(a, 'Việc mới: ' || t.title, r.name || coalesce(' · hạn ' || to_char(r.due_at::timestamp, 'DD/MM HH24:MI'), ''), '/viec');
      end loop;
    else
      if t.done_at is not null then   -- hồ sơ mở lại → mở lại việc
        update public.pc_tasks set done_at = null, done_by = null, done_note = null where id = t.id;
        perform public.app__pc_open_step(t.id, s.step, nw);
      else
        update public.pc_tasks set title = s.title where id = t.id and title is distinct from s.title;
        select * into cs from public.pc_steps where task_id = t.id and done_at is null order by id desc limit 1;
        if cs.id is not null and cs.step < s.step then
          update public.pc_steps set done_at = nw where id = cs.id;
          r := public.app__pc_open_step(t.id, s.step, nw);
          foreach a in array r.accounts loop
            perform public.app__notify(a, 'Việc chờ bạn: ' || r.name, t.title, '/viec');
          end loop;
        end if;
      end if;
    end if;
  end loop;
  -- hồ sơ xong → xong các bước tự động (còn bước thêm tay thì mở bước đó)
  for t in select pt.* from public.pc_tasks pt
            where pt.done_at is null and pt.job not in (11, 12, 13, 14)
              and not exists(select 1 from _pc_src x where x.job || ':' || x.key = pt.key)
              and coalesce((select max(step) from public.pc_steps where task_id = pt.id and done_at is null), 0) < public.app__pc_auto(pt.job) loop
    perform public.app__pc_advance_auto(t.id);
  end loop;

  -- B. Việc gộp (11, 12, 13, 14)
  for s in select * from _pc_src x where x.job in (11, 12, 13, 14)
             and not exists(select 1 from public.pc_items i where i.key = x.job || ':' || x.key and i.done_at is null) loop
    select id into tid from public.pc_tasks where job = s.job and done_at is null and branch_id is not distinct from s.branch_id order by id limit 1;
    if tid is null then
      insert into public.pc_tasks(job, branch_id, title, link)
      values (s.job, s.branch_id, case s.job when 11 then 'Nhận hàng quá ngày giao' when 12 then 'Đối soát hàng' when 13 then 'Hoá đơn bù & ghép phiếu xuất' else 'Giao bù & hoá đơn bổ sung' end
                || coalesce(' · ' || public.app__pc_bcode(s.branch_id), ' · các cơ sở'),
              case s.job when 11 then '/hang-hoa/nhan' when 12 then '/hang-hoa/doi-soat' when 13 then '/hang-hoa/kiem-soat' else '/hang-hoa/kiem-soat' end)
      returning id into tid;
      r := public.app__pc_open_step(tid, 0, nw);
      foreach a in array r.accounts loop
        perform public.app__notify(a, 'Việc mới: ' || (select title from public.pc_tasks where id = tid), s.title, '/viec');
      end loop;
    end if;
    insert into public.pc_items(task_id, key, title, link, start_at, due_at)
    values (tid, s.job || ':' || s.key, s.title, s.link, coalesce(s.start_at, nw),
            public.app__pc_add(coalesce(s.start_at, nw), nullif((select steps->0->>'d' from public.pc_jobs where job = s.job), '')::numeric));
  end loop;
  update public.pc_items i set done_at = nw where i.done_at is null
     and not exists(select 1 from _pc_src x where x.job || ':' || x.key = i.key);
  for t in select pt.* from public.pc_tasks pt where pt.done_at is null and pt.job in (11, 12, 13, 14)
            and not exists(select 1 from public.pc_items i where i.task_id = pt.id and i.done_at is null) loop
    update public.pc_steps set done_at = nw where task_id = t.id and done_at is null;
    update public.pc_tasks set done_at = nw, done_note = 'Hồ sơ đã xong' where id = t.id;
  end loop;

  -- C. Giao việc riêng: mỗi nội dung bàn giao ca → 1 việc chờ giao
  if coalesce((select enabled from public.pc_jobs where job = 24), false) then
    for p in select h.* from public.handover_items h
              where h.done_at is null and h.task_id is null and h.created_at >= (select value from public.settings where key = 'pc_start')
                and not exists(select 1 from public.tasks k where k.handover_item_id = h.id) loop
      insert into public.tasks(kind, content, handover_item_id, branch_id, status, created_by, created_at)
      values ('viec', p.content, p.id, p.branch_id, 'chua_phan_cong', p.created_by, p.created_at) returning id into tid;
      update public.handover_items set task_id = tid where id = p.id;
      insert into public.task_events(task_id, by_account, action, note) values (tid, p.created_by, 'ban_giao', 'Ghi bàn giao ở phiếu ca: ' || p.content);
      foreach a in array public.app__pc_who(24, 'branch', p.branch_id) loop
        perform public.app__notify(a, 'Bàn giao ca cần phân loại / giao', p.content, '/viec');
      end loop;
    end loop;
  end if;

  -- E. Việc tự thêm theo lịch từng cơ sở (bước 123): đúng lịch từ from_date (bù tối đa 7 ngày) + 1 lần làm bổ sung trước from_date
  for sc in select s2.*, j2.name jname from public.pc_sched s2 join public.pc_jobs j2 on j2.job = s2.job
             where j2.custom and j2.deleted_at is null and j2.enabled and s2.enabled and s2.cycle is not null and s2.from_date is not null loop
    for d in select x from public.app__pc_runs(sc.cycle, sc.day, greatest(sc.from_date::date, nw::date - 7), nw::date) x loop
      if not exists(select 1 from public.pc_tasks where key = 'cu:' || sc.job || ':' || sc.branch_id || ':' || to_char(d, 'YYYY-MM-DD')) then
        insert into public.pc_tasks(job, key, branch_id, title, run_date)
        values (sc.job, 'cu:' || sc.job || ':' || sc.branch_id || ':' || to_char(d, 'YYYY-MM-DD'), sc.branch_id,
                sc.jname || ' · ' || coalesce(public.app__pc_bcode(sc.branch_id), '') || ' · ' || to_char(d, 'DD/MM'), to_char(d, 'YYYY-MM-DD'))
        returning id into tid;
        r := public.app__pc_open_step(tid, 0, to_char(d, 'YYYY-MM-DD') || ' 00:00:00');
        foreach a in array r.accounts loop
          perform public.app__notify(a, 'Việc mới: ' || (select title from public.pc_tasks where id = tid), r.name || coalesce(' · hạn ' || to_char(r.due_at::timestamp, 'DD/MM HH24:MI'), ''), '/viec');
        end loop;
      end if;
    end loop;
    if not exists(select 1 from public.pc_tasks where job = sc.job and branch_id = sc.branch_id and extra and created_at >= sc.from_date) then
      select max(x) into ex from public.app__pc_runs(sc.cycle, sc.day, sc.from_date::date - 31, sc.from_date::date - 1) x;
      if ex is not null and not exists(select 1 from public.pc_tasks where key = 'cu:' || sc.job || ':' || sc.branch_id || ':' || to_char(ex, 'YYYY-MM-DD')) then
        insert into public.pc_tasks(job, key, branch_id, title, run_date, extra)
        values (sc.job, 'cu:' || sc.job || ':' || sc.branch_id || ':' || to_char(ex, 'YYYY-MM-DD'), sc.branch_id,
                sc.jname || ' · ' || coalesce(public.app__pc_bcode(sc.branch_id), '') || ' · ' || to_char(ex, 'DD/MM'), to_char(ex, 'YYYY-MM-DD'), true)
        returning id into tid;
        r := public.app__pc_open_step(tid, 0, nw);
        foreach a in array r.accounts loop
          perform public.app__notify(a, 'Việc làm bổ sung: ' || (select title from public.pc_tasks where id = tid), 'Lần trước ngày cài đặt — làm bù khi tiện, không phạt', '/viec');
        end loop;
      end if;
    end if;
  end loop;

  -- D. Quá hạn → chờ Chủ xác nhận phạt
  insert into public.pc_penalties(key, src, ref_id, job, branch_id, account_id, title, step_name, due_at)
  select 'pc:' || st.id || ':' || x, 'pc', t2.id, t2.job, t2.branch_id, x, t2.title, st.name, st.due_at
    from public.pc_steps st join public.pc_tasks t2 on t2.id = st.task_id join public.pc_jobs j on j.job = t2.job left join public.pc_sched sc2 on sc2.job = t2.job and sc2.branch_id = t2.branch_id
    cross join unnest(st.accounts) x
   where st.done_at is null and t2.done_at is null and st.due_at is not null and st.due_at < nw
     and coalesce(sc2.fine, j.fine) > 0 and not t2.extra
  on conflict (key) do nothing;
  insert into public.pc_penalties(key, src, ref_id, job, branch_id, account_id, title, step_name, due_at)
  select 'pci:' || t2.id || ':' || x, 'pci', t2.id, t2.job, t2.branch_id, x, t2.title, st.name, d.due
    from public.pc_tasks t2 join public.pc_jobs j on j.job = t2.job left join public.pc_sched sc2 on sc2.job = t2.job and sc2.branch_id = t2.branch_id
    join lateral (select min(i.due_at) due from public.pc_items i where i.task_id = t2.id and i.done_at is null and i.due_at < nw) d on d.due is not null
    join lateral (select * from public.pc_steps s2 where s2.task_id = t2.id and s2.done_at is null order by s2.id desc limit 1) st on true
    cross join unnest(st.accounts) x
   where t2.done_at is null and t2.job in (11, 12, 13, 14) and coalesce(sc2.fine, j.fine) > 0 and not t2.extra
  on conflict (key) do nothing;
  insert into public.pc_penalties(key, src, ref_id, job, branch_id, account_id, title, step_name, due_at)
  select q.key, 'tk', q.id, 24, q.branch_id, q.acc, q.content, q.step, q.due
    from (
      select 'tk:' || k.id || ':cls:' || x key, k.id, k.branch_id, x acc, k.content, 'Phân loại / giao' step,
             public.app__pc_add(k.created_at, nullif((select steps->0->>'d' from public.pc_jobs where job = 24), '')::numeric) due
        from public.tasks k cross join unnest(public.app__pc_who(24, 'branch', k.branch_id)) x
       where k.status = 'chua_phan_cong' and k.handover_item_id is not null and k.cancelled_at is null
      union all
      select 'tk:' || k.id || ':work:' || k.due_date || coalesce(k.due_time, '') || ':' || k.assignee_id, k.id, k.branch_id, k.assignee_id, k.content, 'Nhận & làm',
             k.due_date || ' ' || coalesce(k.due_time, '23:59') || ':00'
        from public.tasks k
       where k.status in ('da_giao', 'dang_xu_ly') and k.cancelled_at is null and k.due_date is not null and k.assignee_id is not null and k.cv_kind is null
      union all
      select 'tk:' || k.id || ':rv:' || k.submitted_at || ':' || coalesce(k.reviewer_id, k.giver_id, k.created_by), k.id, k.branch_id, coalesce(k.reviewer_id, k.giver_id, k.created_by),
             k.content, 'Kiểm tra', public.app__pc_add(k.submitted_at, nullif((select steps->2->>'d' from public.pc_jobs where job = 24), '')::numeric)
        from public.tasks k
       where k.status = 'cho_duyet' and k.cancelled_at is null and k.submitted_at is not null and k.cv_kind is null
    ) q
   where q.due is not null and q.due < nw and q.acc is not null and coalesce((select fine from public.pc_jobs where job = 24), 0) > 0
  on conflict (key) do nothing;
end $function$
;

-- ============ PHẦN 3: báo xong kèm ảnh, kiểm tra Đạt / Làm lại ============
create or replace function public.app_pc_report_done(p_task bigint, p_note text, p_photos text[]) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app__need(null); t public.pc_tasks; j public.pc_jobs; s public.pc_steps; nw text := public.vn_now_text();
        r public.pc_steps; x bigint; ci int; ph text[] := array_remove(coalesce(p_photos, '{}'), '');
begin
  select * into t from public.pc_tasks where id = p_task for update;
  select * into s from public.pc_steps where task_id = p_task and done_at is null order by id desc limit 1;
  if t.id is null or t.done_at is not null or s.id is null then raise exception 'Việc đã xong.'; end if;
  select * into j from public.pc_jobs where job = t.job;
  if not ((j.custom and s.step = 0) or s.redo) then raise exception 'Việc này tự xong khi làm xong hồ sơ.'; end if;
  if not (a.id = any(s.accounts) or a.system_role = 'chu') then raise exception 'Bước này không giao cho bạn.'; end if;
  if j.need_photo and cardinality(ph) = 0 then raise exception 'Cần ít nhất 1 ảnh mới báo xong được.'; end if;
  update public.pc_steps set note = nullif(trim(coalesce(p_note, '')), ''), photos = ph, done_at = nw, done_by = a.id where id = s.id;
  select (o - 1)::int into ci from jsonb_array_elements(j.steps) with ordinality e(v, o) where v->>'who' = 'check' limit 1;
  if ci is not null then
    r := public.app__pc_open_step(p_task, ci, nw);
    foreach x in array r.accounts loop
      perform public.app__notify(x, 'Việc chờ bạn kiểm tra', t.title || coalesce(' · hạn ' || to_char(r.due_at::timestamp, 'DD/MM HH24:MI'), ''), '/viec');
    end loop;
  else
    update public.pc_tasks set done_at = nw, done_by = a.id, done_note = 'Đã báo xong' where id = p_task;
  end if;
end $$;

create or replace function public.app_pc_check(p_task bigint, p_ok boolean, p_note text, p_hours numeric) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app__need(null); t public.pc_tasks; j public.pc_jobs; s public.pc_steps; w public.pc_steps; nw text := public.vn_now_text();
        r public.pc_steps; x bigint;
begin
  select * into t from public.pc_tasks where id = p_task for update;
  select * into s from public.pc_steps where task_id = p_task and done_at is null order by id desc limit 1;
  if t.id is null or t.done_at is not null or s.id is null then raise exception 'Việc đã xong.'; end if;
  select * into j from public.pc_jobs where job = t.job;
  if coalesce(j.steps->s.step->>'who', '') <> 'check' or s.redo then raise exception 'Việc này chưa tới bước kiểm tra.'; end if;
  if not (a.id = any(s.accounts) or a.system_role = 'chu') then raise exception 'Bước này không giao cho bạn.'; end if;
  select * into w from public.pc_steps where task_id = p_task and id <> s.id and done_at is not null order by id desc limit 1;   -- lần làm vừa báo xong
  if coalesce(p_ok, false) then
    update public.pc_steps set done_at = nw, done_by = a.id, note = nullif(trim(coalesce(p_note, '')), '') where id = s.id;
    update public.pc_tasks set done_at = nw, done_by = a.id, done_note = 'Đạt' where id = p_task;
    if w.done_by is not null and w.done_by <> a.id then perform public.app__notify(w.done_by, 'Việc đã Đạt', t.title, '/viec'); end if;
  else
    if trim(coalesce(p_note, '')) = '' then raise exception 'Ghi lý do làm lại.'; end if;
    if p_hours is null or p_hours not in (4, 12, 24, 48, 72) then raise exception 'Chọn hạn làm lại.'; end if;
    update public.pc_steps set done_at = nw, done_by = a.id, note = trim(p_note) where id = s.id;
    insert into public.pc_steps(task_id, step, name, accounts, start_at, due_at, redo)
    values (p_task, coalesce(w.step, 0), coalesce(w.name, 'Làm'), coalesce(w.accounts, '{}'), nw, public.app__pc_add(nw, p_hours / 24.0), true)
    returning * into r;
    foreach x in array r.accounts loop
      perform public.app__notify(x, 'Việc cần làm lại', t.title || ': ' || trim(p_note), '/viec');
    end loop;
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.app_pc_step_done(p_task bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app__need(null); s public.pc_steps; t public.pc_tasks;
begin
  select * into t from public.pc_tasks where id = p_task for update;
  select * into s from public.pc_steps where task_id = p_task and done_at is null order by id desc limit 1;
  if s.id is null or t.done_at is not null then raise exception 'Việc đã xong.'; end if;
  if coalesce((select custom from public.pc_jobs where job = t.job), false) or s.redo then raise exception 'Bấm Báo xong ở thẻ việc.'; end if;
  if (select steps->s.step->>'who' from public.pc_jobs where job = t.job) = 'check' then raise exception 'Bấm Đạt / Làm lại ở thẻ việc.'; end if;
  if s.step < public.app__pc_auto(t.job) then raise exception 'Bước này tự xong khi làm xong hồ sơ — bấm "Làm ngay" để mở hồ sơ.'; end if;
  if not (a.id = any(s.accounts) or a.system_role = 'chu') then raise exception 'Bước này không giao cho bạn.'; end if;
  perform public.app__pc_advance(p_task, a.id, 'Xong bước ' || s.name);
end $function$
;

-- ============ quyền gọi hàm (cuối tệp) ============
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_pc\_%' or p.proname like 'app\_\_pc\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not like 'app\_\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;

insert into public.app_migrations(file) values ('106_viec_tu_them.sql') on conflict (file) do nothing;
