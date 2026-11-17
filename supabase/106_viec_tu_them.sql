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

-- ============ quyền gọi hàm (cuối tệp) ============
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_pc\_%' or p.proname like 'app\_\_pc\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not like 'app\_\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;

insert into public.app_migrations(file) values ('106_viec_tu_them.sql') on conflict (file) do nothing;
