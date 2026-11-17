-- Bước 124: việc có sẵn của web dùng chung hộp cài đặt từng cơ sở (lần 2 của "việc tự thêm").
-- Mỗi cơ sở: bật/tắt, hạn làm, mức phạt, Có kiểm tra (người + hạn kiểm tra); Kiểm quỹ có chu kỳ + ngày làm + quá hạn cho phép.
-- Lên bản: chép hạn / phạt đang dùng sang từng cơ sở nên không đổi việc đang mở. Việc 2 và 24 giữ cách cũ; 13, 14 cài chung.
-- Chạy lại nhiều lần không sao.

-- Lịch từng cơ sở cho việc có sẵn: chép giá trị đang dùng (hạn bước 1, mức phạt) để lên bản mới không đổi gì
insert into public.pc_sched(job, branch_id, enabled, cycle, day, grace_h, fine, checkers, check_h, due_h, from_date)
select j.job, b.id, true, case when j.job = 10 then 'tuan' end, case when j.job = 10 then 1 end, 72, j.fine, '{}', 24,
       nullif(j.steps->0->>'d', '')::numeric * 24, (select value from public.settings where key = 'pc_start')
  from public.pc_jobs j cross join public.branches b
 where j.job in (1, 3, 4, 7, 8, 10, 11, 12) and b.status = 'Đang hoạt động'
on conflict (job, branch_id) do nothing;

create or replace function public.app__pc_off(p_job int, p_branch bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.pc_sched sc where sc.job = p_job and sc.branch_id = p_branch and not sc.enabled)
$$;

CREATE OR REPLACE FUNCTION public.app__pc_sources()
 RETURNS TABLE(job integer, key text, branch_id bigint, title text, link text, start_at text, step integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with st as (select coalesce((select value from public.settings where key = 'pc_start'), '2099-01-01') d,
                   to_char(public.vn_now(), 'YYYY-MM-DD') today)
-- 1 Đối soát ca: phiếu đã gửi + kế toán đủ file; xong phần quản lý (chỉ còn chờ duyệt nghỉ / làm thay) cũng tính là xong
select 1, 'ca:' || r.id, r.branch_id, 'Đối soát ' || public.app__ca_title(r), '/quan-ly/doi-soat/ca?id=' || r.id, null::text, 0
  from public.shift_reports r cross join st
 where r.work_date >= st.d and r.status = 'hoan_thanh' and r.recon_status <> 'hoan_thanh'
   and coalesce((public.app__ca_kt_state(r.id)->>'ready')::boolean, false)
   and not ((select count(*) from public.shift_report_checks c where c.report_id = r.id) >= array_length(public.app__ca_check_items(), 1) - 1
            and exists(select 1 from public.shift_cover_reviews v where v.report_id = r.id and v.ok_at is null))
union all
-- 2 Phân chia nhân viên phát sinh: bước 0 phân loại, bước 1 duyệt
select 2, 'cv:' || r.id, r.branch_id, 'Nghỉ / làm thay · ' || public.app__ca_title(r), '/quan-ly/doi-soat/ca?id=' || r.id,
       coalesce(r.completed_at, public.vn_now_text()), case when v.set_at is null then 0 else 1 end
  from public.shift_reports r cross join st left join public.shift_cover_reviews v on v.report_id = r.id
 where r.work_date >= st.d and r.status = 'hoan_thanh' and v.ok_at is null
   and exists(select 1 from public.app__cv_people(r.id))
union all
-- 3 File ca Fabi · 4 Chuyển khoản: gộp mỗi ngày mỗi cơ sở (chỉ cơ sở dùng Fabi)
select x.j, 'kt' || x.j || ':' || x.branch_id || ':' || x.work_date, x.branch_id,
       case x.j when 3 then 'File ca Fabi' else 'Chuyển khoản thực nhận' end || ' · ngày ' || to_char(x.work_date::date, 'DD/MM'),
       case x.j when 3 then '/ke-toan/fabi' else '/ke-toan/chuyen-khoan' end,
       to_char(x.work_date::date + 1, 'YYYY-MM-DD') || ' 00:00:00', 0
  from (select r.branch_id, r.work_date, j.j
          from public.shift_reports r cross join st cross join (values (3), (4)) j(j)
         where r.work_date >= st.d and r.status = 'hoan_thanh' and exists(select 1 from public.fabi_stores f where f.branch_id = r.branch_id)
           and not coalesce((public.app__ca_kt_state(r.id)->>(case j.j when 3 then 'fabi' else 'bank' end))::boolean, false)
         group by 1, 2, 3) x
union all
-- 7 Lệch tiền ca chờ xử lý (chờ ghép / dư); lệch chờ tiền về chưa tính
select 7, 'gap:' || g.report_id || ':' || g.item, b.id, 'Lệch ' || g.item || ' · ' || public.app__ca_title(r) || ' · ' || public.app__vnd(abs(g.remain)),
       '/quan-ly/lech-tien', coalesce(r.completed_at, public.vn_now_text()), 0
  from public.branches b cross join st
  cross join lateral public.app__gap_rows(b.id, st.d, st.today) g
  join public.shift_reports r on r.id = g.report_id
 where b.status = 'Đang hoạt động' and g.state in ('cho_gan', 'du') and g.work_date >= st.d
union all
-- 8 Giải trình khoản trừ chưa được xem
select 8, 'gt:' || s.id, r.branch_id, 'Giải trình · ' || coalesce(e.code || ' – ', '') || e.name || ' · ' || public.app__vnd(s.amount),
       '/quan-ly/khoan-am', s.reply_at, 0
  from public.shift_shortfalls s join public.shift_reports r on r.id = s.report_id join public.employees e on e.id = s.employee_id cross join st
 where s.reply_at is not null and s.reply_at >= st.d and s.status <> 'huy' and (s.status_at is null or s.status_at < s.reply_at)
union all
-- 10 Kiểm quỹ theo lịch từng cơ sở (bước 124; mặc định Thứ Hai hằng tuần): còn mở tới khi có phiếu kiểm quỹ trước lần làm kế tiếp
select 10, 'kq:' || b.id || ':' || to_char(w.d, 'YYYY-MM-DD'), b.id,
       'Kiểm quỹ ' || case when coalesce(sc.cycle, 'tuan') = 'tuan' then 'tuần ' || to_char(w.d, 'DD/MM') || ' – ' || to_char(w.e, 'DD/MM')
                          when sc.cycle = 'thang' then 'tháng ' || to_char(w.d, 'MM/YYYY') || ' (ngày ' || to_char(w.d, 'DD/MM') || ')'
                          else 'ngày ' || to_char(w.d, 'DD/MM') end,
       '/quan-ly/so-quy', to_char(w.d, 'YYYY-MM-DD') || ' 00:00:00', 0
  from public.branches b cross join st
  left join public.pc_sched sc on sc.job = 10 and sc.branch_id = b.id
  cross join lateral (select x d, coalesce((select min(y) from public.app__pc_runs(coalesce(sc.cycle, 'tuan'), coalesce(sc.day, 1), x + 1, x + 92) y) - 1, x + 30) e
                        from public.app__pc_runs(coalesce(sc.cycle, 'tuan'), coalesce(sc.day, 1), greatest(st.d, coalesce(sc.from_date, st.d))::date, st.today::date) x) w
 where b.status = 'Đang hoạt động'
   and not exists(select 1 from public.fund_counts f where f.branch_id = b.id and f.count_date between to_char(w.d, 'YYYY-MM-DD') and to_char(w.e, 'YYYY-MM-DD'))
union all
-- 10 việc kiểm quỹ kỳ cũ còn mở (đổi lịch giữa kỳ): giữ tới khi có phiếu kiểm quỹ từ ngày làm của việc đó
select 10, substr(t.key, 4), t.branch_id, t.title, t.link, null::text, 0
  from public.pc_tasks t
 where t.job = 10 and t.done_at is null and t.key ~ '^10:kq:\d+:\d{4}-\d{2}-\d{2}$'
   and not exists(select 1 from public.fund_counts f where f.branch_id = t.branch_id and f.count_date >= split_part(t.key, ':', 4))
union all
-- 11 Phiếu xuất quá ngày giao mà chưa nhận
select 11, 'nh:' || i.id, i.branch_id, coalesce(i.doc_no, 'Lần giao #' || i.id) || ' · giao ngày ' || to_char(i.work_date::date, 'DD/MM'),
       '/hang-hoa/nhan?cn=' || i.branch_id, to_char(i.work_date::date + 1, 'YYYY-MM-DD') || ' 00:00:00', 0
  from public.delivery_invoices i cross join st
 where i.state = 'dang_chuyen' and i.work_date < st.today and i.work_date >= st.d
union all
-- 12 Đối soát hàng (đã nhận, có hoá đơn giao / hoá đơn bù, có phiếu xuất)
select 12, 'ds:' || i.id, i.branch_id, coalesce(i.doc_no, 'Lần giao #' || i.id) || ' · nhận ' || to_char(coalesce(i.received_at, i.work_date)::timestamp, 'DD/MM HH24:MI'),
       '/hang-hoa/doi-soat?ds=' || i.id, coalesce(i.received_at, i.work_date || ' 00:00:00'), 0
  from public.delivery_invoices i cross join st
 where i.state <> 'dang_chuyen' and i.recon_at is null and i.doc_no is not null and (i.deliv_path is not null or i.bu_path is not null)
   and coalesce(i.received_date, i.work_date) >= st.d
union all
-- 13 Hoá đơn bù & ghép phiếu xuất (kế toán, gộp chung)
select 13, 'hd:' || i.id, null::bigint,
       case when i.doc_no is null then 'Ghép phiếu xuất · ' || public.app__pc_bcode(i.branch_id) || ' · lần nhận #' || i.id
            else 'Hoá đơn bù · ' || public.app__pc_bcode(i.branch_id) || ' · ' || i.doc_no end,
       case when i.doc_no is null then '/hang-hoa/phieu-xuat' else '/hang-hoa/kiem-soat?cn=' || i.branch_id end,
       coalesce(i.received_at, i.work_date || ' 00:00:00'), 0
  from public.delivery_invoices i cross join st
 where i.state <> 'dang_chuyen' and coalesce(i.received_date, i.work_date) >= st.d
   and (i.doc_no is null or (i.deliv_path is null and i.bu_path is null))
union all
-- 14 Giao bù & hoá đơn bổ sung (kế toán, gộp chung)
select 14, 'fu:' || f.id, null::bigint,
       case f.kind when 'bu' then 'Giao bù · ' else 'Hoá đơn bổ sung · ' end || public.app__pc_bcode(f.branch_id) || ' · ' || f.name,
       '/hang-hoa/kiem-soat?cn=' || f.branch_id, f.created_at, 0
  from public.delivery_followups f cross join st
 where f.status = 'cho' and f.created_at >= st.d
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
               when s->>'who' = 'check' then public.app__pc_add(n_at, (select sc.check_h from public.pc_sched sc where sc.job = t.job and sc.branch_id = t.branch_id) / 24.0)
               when j.custom then case when t.extra or t.run_date is null then null
                 else to_char(t.run_date::date + time '23:59:59' + make_interval(secs => coalesce((select sc.grace_h from public.pc_sched sc where sc.job = t.job and sc.branch_id = t.branch_id), 0) * 3600), 'YYYY-MM-DD HH24:MI:SS') end
               when j.job = 10 and exists(select 1 from public.pc_sched sc where sc.job = 10 and sc.branch_id = t.branch_id) then
                 to_char(n_at::date + time '23:59:59' + make_interval(secs => coalesce((select sc.grace_h from public.pc_sched sc where sc.job = 10 and sc.branch_id = t.branch_id), 0) * 3600), 'YYYY-MM-DD HH24:MI:SS')
               when p_step = 0 and exists(select 1 from public.pc_sched sc where sc.job = t.job and sc.branch_id = t.branch_id) then
                 public.app__pc_add(n_at, (select sc.due_h from public.pc_sched sc where sc.job = t.job and sc.branch_id = t.branch_id) / 24.0)
               else public.app__pc_add(n_at, nullif(s->>'d', '')::numeric) end)
  returning * into r;
  return r;
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

create or replace function public.app_pc_job_save(p_job int, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app__need('phan_cong'); j public.pc_jobs; st jsonb := p->'steps'; e jsonb; i int := 0; au int; nw text := public.vn_now_text();
        today text := to_char(public.vn_now(), 'YYYY-MM-DD'); chk boolean; br bigint; bc text; ckr bigint[]; cy text; dy int; w text;
begin
  if a.system_role <> 'chu' then raise exception 'Chỉ tài khoản Chủ sửa được Bảng phân công.'; end if;
  select * into j from public.pc_jobs where job = p_job for update;
  if j.job is null or j.custom then raise exception 'Không tìm thấy việc.'; end if;
  au := public.app__pc_auto(p_job);
  if p_job = 24 then   -- các bước cố định, chỉ đổi hạn phân loại / kiểm tra
    st := jsonb_set(jsonb_set(j.steps, '{0,d}', to_jsonb(greatest(coalesce((p->>'d0')::numeric, 1), 0.25))), '{2,d}', to_jsonb(greatest(coalesce((p->>'d2')::numeric, 1), 0.25)));
  elsif p_job = 2 then   -- giữ cách cũ: sửa các bước
    if jsonb_typeof(st) <> 'array' or jsonb_array_length(st) < au or jsonb_array_length(st) > 6 then raise exception 'Việc này cần từ % đến 6 bước.', au; end if;
    for e in select * from jsonb_array_elements(st) loop
      if trim(coalesce(e->>'n', '')) = '' then raise exception 'Bước % chưa có tên.', i + 1; end if;
      if coalesce(e->>'who', '') !~ '^(branch|branch\+ql_tong|kt|acc:\d+)$' then raise exception 'Bước % chưa chọn người làm.', i + 1; end if;
      if e->>'d' is not null and (e->>'d')::numeric <= 0 then raise exception 'Hạn bước % phải lớn hơn 0.', i + 1; end if;
      i := i + 1;
    end loop;
  else   -- bước 124: việc có sẵn — bước tự động giữ nguyên, thêm bước Kiểm tra nếu bật
    if jsonb_typeof(st) = 'array' and jsonb_array_length(st) > au then raise exception 'Việc này không thêm bước được — dùng Có kiểm tra.'; end if;
    chk := coalesce((p->>'need_check')::boolean, false) and p_job not in (13, 14);
    st := (select jsonb_agg(v order by o) from jsonb_array_elements(j.steps) with ordinality x(v, o) where o <= au);
    if p ? 'due_d' then st := jsonb_set(st, '{0,d}', coalesce(to_jsonb(nullif((p->>'due_d')::numeric, 0)), 'null'::jsonb)); end if;
    if chk then st := st || '[{"n":"Kiểm tra","who":"check","d":null}]'::jsonb; end if;
    w := st->0->>'who';
    for e in select * from jsonb_array_elements(coalesce(p->'rows', '[]')) loop
      br := (e->>'branch_id')::bigint;
      select coalesce(display_code, code) into bc from public.branches where id = br;
      if bc is null then raise exception 'Không tìm thấy cơ sở.'; end if;
      cy := case when p_job = 10 then coalesce(e->>'cycle', 'tuan') end;
      dy := case when p_job = 10 and cy <> 'ngay' then coalesce(nullif(e->>'day', '')::int, 1) end;
      if p_job = 10 and ((cy = 'tuan' and dy not between 1 and 7) or (cy = 'thang' and dy not between 1 and 31) or cy not in ('ngay', 'tuan', 'thang')) then raise exception 'Chọn ngày làm cho %.', bc; end if;
      ckr := array(select distinct jsonb_array_elements_text(coalesce(e->'checkers', '[]'))::bigint);
      insert into public.pc_sched(job, branch_id, enabled, cycle, day, grace_h, fine, checkers, check_h, due_h, from_date, updated_by, updated_at)
      values (p_job, br, coalesce((e->>'enabled')::boolean, true), cy, dy, coalesce((e->>'grace_h')::numeric, 72), greatest(coalesce((e->>'fine')::bigint, 0), 0),
              case when chk then ckr else '{}' end, coalesce(nullif((e->>'check_h')::numeric, 0), 24), nullif((e->>'due_h')::numeric, 0), today, a.id, nw)
      on conflict (job, branch_id) do update set enabled = excluded.enabled, cycle = excluded.cycle, day = excluded.day, grace_h = excluded.grace_h,
         fine = excluded.fine, checkers = excluded.checkers, check_h = excluded.check_h, due_h = excluded.due_h, updated_by = a.id, updated_at = nw,
         from_date = case when pc_sched.cycle is distinct from excluded.cycle or pc_sched.day is distinct from excluded.day then excluded.from_date else pc_sched.from_date end;
    end loop;
    if chk then
      select coalesce(display_code, code) into bc from public.pc_sched sc join public.branches b on b.id = sc.branch_id
       where sc.job = p_job and sc.enabled and b.status = 'Đang hoạt động' and cardinality(sc.checkers) = 0 order by b.sort_order limit 1;
      if bc is not null then raise exception 'Chọn người kiểm tra cho %.', bc; end if;
      if exists(select 1 from public.pc_sched sc where sc.job = p_job and sc.enabled and sc.checkers && public.app__pc_who(p_job, w, sc.branch_id)) then
        raise exception 'Người kiểm tra phải khác người làm.'; end if;
    end if;
  end if;
  update public.pc_jobs set enabled = coalesce((p->>'enabled')::boolean, enabled), fine = greatest(coalesce((p->>'fine')::bigint, fine), 0), steps = st,
         guide = case when p ? 'guide' then nullif(trim(coalesce(p->>'guide', '')), '') else guide end,
         need_check = coalesce(chk, need_check), updated_by = a.id, updated_at = nw where job = p_job;
  perform public.app_log('pc_job_save', 'job=' || p_job);
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_pc\_%' or p.proname like 'app\_\_pc\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not like 'app\_\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;

insert into public.app_migrations(file) values ('107_viec_co_san_tung_co_so.sql') on conflict (file) do nothing;
