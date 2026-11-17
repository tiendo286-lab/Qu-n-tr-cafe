-- Bước 127: nhắc việc gọn lại (anh chốt 17/11).
-- 1) Không nhắc nhân viên về phiếu chốt ca; phiếu chưa xong 2 giờ sau hết ca → báo 1 lần cho người đối soát của cơ sở (7–22 giờ).
-- 2) Mọi việc (Bảng phân công + Giao việc riêng): báo người đang giữ việc trước hạn 1 giờ và lúc vừa trễ, mỗi mốc 1 lần.
-- 3) Số đếm "Quá hạn & phạt" (phạt chờ xác nhận) cho người có quyền phan_cong. Chạy lại nhiều lần không sao.

-- 1) Phiếu chốt ca: không nhắc nhân viên nữa; chưa xong 2 giờ sau hết ca → báo 1 lần cho người đối soát của cơ sở (7–22 giờ)
drop function if exists public.app_ca_part_tick();
create or replace function public.app_ca_part_tick(p_now timestamp default null) returns integer
language plpgsql security definer set search_path = public as $$
declare now_ timestamp := coalesce(p_now, public.vn_now()); r public.shift_reports; e timestamp; k text; need text[]; lbls text; x bigint; n int := 0;
begin
  if extract(hour from now_) < 7 or extract(hour from now_) >= 22 then return 0; end if;   -- không báo ban đêm
  for r in select * from public.shift_reports
            where status = 'dang_chot' and work_date between to_char(now_::date - 1, 'YYYY-MM-DD') and to_char(now_::date, 'YYYY-MM-DD') loop
    e := public.app__ca_end_at(r);
    if e is null or now_ < e + interval '2 hours' or now_ > e + interval '24 hours' then continue; end if;
    k := 'ca_ql:' || r.id;
    insert into public.notification_events(event_key, created_at) values (k, public.vn_now_text()) on conflict do nothing;
    if not found then continue; end if;
    need := public.app__ca_parts_need(r.id);
    select string_agg(public.app__ca_part_label(u.p), ', ') into lbls from unnest(need) u(p)
     where not exists (select 1 from public.shift_report_parts pt where pt.report_id = r.id and pt.part = u.p and pt.done_at is not null);
    foreach x in array public.app__pc_who(1, 'branch', r.branch_id) loop
      perform public.app__notify(x, 'Phiếu chốt ca chưa xong · ' || public.app__ca_title(r),
        'Ca hết lúc ' || to_char(e, 'HH24:MI') || coalesce(', còn phần chưa xong: ' || lbls, '') || '. Nhắc nhân viên hoàn thành phiếu.', '/ca/phieu?id=' || r.id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.app_ca_part_tick(timestamp) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app__pc_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nw text := public.vn_now_text(); s record; qq record; sc record; d date; ex date; t public.pc_tasks; cs public.pc_steps; r public.pc_steps; a bigint; tid bigint; p record;
begin
  if not pg_try_advisory_xact_lock(950109) then return; end if;
  insert into public.settings(key, value) values ('pc_tick_at', nw) on conflict (key) do update set value = excluded.value;
  create temp table if not exists _pc_src (job int, key text, branch_id bigint, title text, link text, start_at text, step int) on commit drop;
  truncate _pc_src;
  insert into _pc_src select x.* from public.app__pc_sources() x join public.pc_jobs j on j.job = x.job and j.enabled;

  -- A. Việc từng hồ sơ (1, 2, 3, 4, 7, 8, 10)
  for s in select * from _pc_src where job not in (11, 12, 13, 14) loop
    select * into t from public.pc_tasks where key = s.job || ':' || s.key;
    if t.id is null and public.app__pc_off(s.job, s.branch_id) then continue; end if;   -- cơ sở đã tắt việc này: không tạo mới
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
              and coalesce((select max(step) from public.pc_steps where task_id = pt.id and done_at is null), 0) < public.app__pc_auto(pt.job)
              and not exists(select 1 from public.pc_steps r2 where r2.task_id = pt.id and r2.done_at is null and r2.redo) loop
    perform public.app__pc_advance_auto(t.id);
  end loop;

  -- B. Việc gộp (11, 12, 13, 14)
  for s in select * from _pc_src x where x.job in (11, 12, 13, 14)
             and not exists(select 1 from public.pc_items i where i.key = x.job || ':' || x.key and i.done_at is null)
             and not public.app__pc_off(x.job, x.branch_id) loop
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
            case when exists(select 1 from public.pc_sched sc where sc.job = s.job and sc.branch_id = s.branch_id)
                 then public.app__pc_add(coalesce(s.start_at, nw), (select sc.due_h from public.pc_sched sc where sc.job = s.job and sc.branch_id = s.branch_id) / 24.0)
                 else public.app__pc_add(coalesce(s.start_at, nw), nullif((select steps->0->>'d' from public.pc_jobs where job = s.job), '')::numeric) end);
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

  -- F. Việc làm bổ sung quá 7 ngày chưa ai làm → tự bỏ (không phạt)
  update public.pc_steps ps set done_at = nw from public.pc_tasks px
   where px.id = ps.task_id and px.extra and px.done_at is null and ps.done_at is null and px.created_at < to_char(nw::timestamp - interval '7 day', 'YYYY-MM-DD HH24:MI:SS');
  update public.pc_tasks set done_at = nw, done_note = 'Quá 7 ngày — bỏ làm bổ sung'
   where extra and done_at is null and created_at < to_char(nw::timestamp - interval '7 day', 'YYYY-MM-DD HH24:MI:SS');

  -- G. Báo hạn (bước 127): trước hạn 1 giờ + lúc vừa trễ (trong 2 giờ sau hạn), mỗi mốc báo 1 lần — việc Bảng phân công + Giao việc riêng
  for qq in select * from (
      select 'pc:' || st.id || ':' || st.due_at kk, st.accounts accs, t2.title ttl, st.name nm, st.due_at due
        from public.pc_steps st join public.pc_tasks t2 on t2.id = st.task_id
       where st.done_at is null and t2.done_at is null and not t2.extra and st.due_at is not null
      union all
      select 'gvw:' || k.id || ':' || k.due_date || coalesce(k.due_time, ''), array[k.assignee_id], k.content, 'Nhận & làm', k.due_date || ' ' || coalesce(k.due_time, '23:59') || ':00'
        from public.tasks k where k.status in ('da_giao', 'dang_xu_ly') and k.cancelled_at is null and k.cv_kind is null and k.assignee_id is not null and k.due_date is not null
      union all
      select 'gvr:' || k.id || ':' || k.submitted_at, array[coalesce(k.reviewer_id, k.giver_id, k.created_by)], k.content, 'Kiểm tra',
             public.app__pc_add(k.submitted_at, nullif((select steps->2->>'d' from public.pc_jobs where job = 24), '')::numeric)
        from public.tasks k where k.status = 'cho_duyet' and k.cancelled_at is null and k.cv_kind is null and k.submitted_at is not null
      union all
      select 'gvc:' || k.id, public.app__pc_who(24, 'branch', k.branch_id), k.content, 'Phân loại / giao',
             public.app__pc_add(k.created_at, nullif((select steps->0->>'d' from public.pc_jobs where job = 24), '')::numeric)
        from public.tasks k where k.status = 'chua_phan_cong' and k.handover_item_id is not null and k.cancelled_at is null
    ) z
   where z.due between to_char(nw::timestamp - interval '2 hour', 'YYYY-MM-DD HH24:MI:SS') and to_char(nw::timestamp + interval '1 hour', 'YYYY-MM-DD HH24:MI:SS')
     and cardinality(z.accs) > 0 loop
    insert into public.notification_events(event_key, created_at) values ((case when qq.due > nw then 'h1:' else 'h0:' end) || qq.kk, nw) on conflict do nothing;
    if found then
      foreach a in array qq.accs loop
        if a is null then continue; end if;
        if qq.due > nw then
          perform public.app__notify(a, 'Sắp hết hạn: ' || qq.ttl, qq.nm || ' · hạn ' || to_char(qq.due::timestamp, 'HH24:MI DD/MM') || ' — còn dưới 1 giờ', '/viec');
        else
          perform public.app__notify(a, 'Đã quá hạn: ' || qq.ttl, qq.nm || ' · hạn ' || to_char(qq.due::timestamp, 'HH24:MI DD/MM') || ' — làm ngay; quá hạn chờ Chủ xác nhận phạt', '/viec');
        end if;
      end loop;
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

CREATE OR REPLACE FUNCTION public.app_viec_reminder()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app_account(); nw text := public.vn_now_text(); today text := left(public.vn_now_text(), 10); items jsonb;
begin
  if a.id is null then return null; end if;
  select coalesce(jsonb_agg(x), '[]') into items from (
    select jsonb_build_object('content', t.title || ' · ' || s.name, 'due_date', left(s.due_at, 10), 'kind', 'viec',
           'group', case when s.due_at < nw then 'overdue' when left(s.due_at, 10) = today then 'today' else 'open' end) x
      from public.pc_tasks t join public.pc_steps s on s.task_id = t.id and s.done_at is null
     where t.done_at is null and a.id = any(s.accounts) and t.job not in (11, 12, 13, 14)
    union all
    select jsonb_build_object('content', t.title, 'due_date', left(d.due, 10), 'kind', 'viec',
           'group', case when d.due < nw then 'overdue' when left(d.due, 10) = today then 'today' else 'open' end)
      from public.pc_tasks t join public.pc_steps s on s.task_id = t.id and s.done_at is null
      cross join lateral (select min(i.due_at) due from public.pc_items i where i.task_id = t.id and i.done_at is null) d
     where t.done_at is null and a.id = any(s.accounts) and t.job in (11, 12, 13, 14)
    union all
    select jsonb_build_object('content', k.content, 'due_date', k.due_date, 'kind', 'viec',
           'group', case when (k.due_date || ' ' || coalesce(k.due_time, '23:59')) < left(nw, 16) then 'overdue' when k.due_date = today then 'today' else 'open' end)
      from public.tasks k where k.assignee_id = a.id and k.status in ('da_giao', 'dang_xu_ly') and k.cancelled_at is null and k.cv_kind is null
    union all
    select jsonb_build_object('content', 'Phân loại bàn giao: ' || k.content, 'due_date', null, 'kind', 'viec', 'group', 'open')
      from public.tasks k where k.status = 'chua_phan_cong' and k.handover_item_id is not null and k.cancelled_at is null
       and a.id = any(public.app__pc_who(24, 'branch', k.branch_id))
  ) q;
  return jsonb_build_object('open', jsonb_array_length(items),
    'pen_wait', case when coalesce(public.app_can('phan_cong'), false) then (select count(*) from public.pc_penalties where status = 'cho') else 0 end,
    'overdue', (select count(*) from jsonb_array_elements(items) e where e->>'group' = 'overdue'),
    'to_review', (select count(*) from public.tasks k where k.cancelled_at is null and k.cv_kind is null and
                   ((k.status = 'cho_duyet' and coalesce(k.reviewer_id, k.giver_id, k.created_by) = a.id) or (k.ext_days is not null and coalesce(k.giver_id, k.created_by) = a.id))),
    'items', items);
end $function$
;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_pc\_%' or p.proname like 'app\_\_pc\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not like 'app\_\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
revoke execute on function public.app_viec_reminder() from public, anon;
grant execute on function public.app_viec_reminder() to authenticated;

insert into public.app_migrations(file) values ('111_nhac_viec_gon.sql') on conflict (file) do nothing;
