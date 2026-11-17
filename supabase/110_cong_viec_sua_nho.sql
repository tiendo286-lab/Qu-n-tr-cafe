-- Bước 126: sửa nhỏ phần Công việc (từ bản kiểm tra 17/11 + việc tự thêm).
-- Tên việc Lệch tiền hiện "Tiền mặt" / "Chuyển khoản" thay mã máy; Giao việc riêng báo người giao khi báo xong / Đạt (người kiểm tra khác người giao)
-- và báo người làm cũ khi đổi người; mục Đã xong ghi rõ việc bị xoá / bỏ làm bổ sung; việc Làm bổ sung quá 7 ngày tự bỏ. Chạy lại nhiều lần không sao.

create or replace function public.app__pc_item_label(p_item text) returns text
language sql immutable as $$
  select case p_item when 'tien_mat' then 'Tiền mặt' when 'chuyen_khoan' then 'Chuyển khoản'
    else initcap(replace(coalesce(p_item, ''), '_', ' ')) end
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
select 7, 'gap:' || g.report_id || ':' || g.item, b.id, 'Lệch ' || public.app__pc_item_label(g.item) || ' · ' || public.app__ca_title(r) || ' · ' || public.app__vnd(abs(g.remain)),
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

  -- F. Việc làm bổ sung quá 7 ngày chưa ai làm → tự bỏ (không phạt)
  update public.pc_steps ps set done_at = nw from public.pc_tasks px
   where px.id = ps.task_id and px.extra and px.done_at is null and ps.done_at is null and px.created_at < to_char(nw::timestamp - interval '7 day', 'YYYY-MM-DD HH24:MI:SS');
  update public.pc_tasks set done_at = nw, done_note = 'Quá 7 ngày — bỏ làm bổ sung'
   where extra and done_at is null and created_at < to_char(nw::timestamp - interval '7 day', 'YYYY-MM-DD HH24:MI:SS');

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

CREATE OR REPLACE FUNCTION public.app_gv_submit(p_task bigint, p_result text, p_photo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app__need(null); k public.tasks;
begin
  if trim(coalesce(p_result, '')) = '' then raise exception 'Ghi kết quả.'; end if;
  if p_photo is null or p_photo !~ ('^cv' || p_task || '/') then raise exception 'Cần ảnh kết quả.'; end if;
  update public.tasks set status = 'cho_duyet', submitted_at = public.vn_now_text(), report = trim(p_result), result_photo = p_photo,
         ext_days = null, ext_reason = null, ext_at = null
   where id = p_task and assignee_id = a.id and status = 'dang_xu_ly' and cancelled_at is null returning * into k;
  if k.id is null then raise exception 'Chỉ người đang làm báo xong được.'; end if;
  perform public.app__gv_ev(p_task, a.id, 'bao_xong', 'Báo xong: ' || trim(p_result), p_photo);
  perform public.app__notify(coalesce(k.reviewer_id, k.giver_id, k.created_by), 'Việc chờ bạn kiểm tra', public.app__acc_name(a.id) || ': ' || k.content, '/viec');
  if k.giver_id is not null and k.giver_id <> coalesce(k.reviewer_id, k.giver_id) and k.giver_id <> a.id then   -- bước 126: người giao theo dõi
    perform public.app__notify(k.giver_id, 'Việc đã báo xong', public.app__acc_name(a.id) || ': ' || k.content || ' · chờ ' || public.app__acc_name(k.reviewer_id) || ' kiểm tra', '/viec');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.app_gv_review(p_task bigint, p_ok boolean, p_note text, p_days numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app__need(null); k public.tasks; nd text;
begin
  select * into k from public.tasks where id = p_task for update;
  if k.id is null or k.status <> 'cho_duyet' or k.cancelled_at is not null then raise exception 'Việc không ở bước chờ kiểm tra.'; end if;
  if not (a.id = coalesce(k.reviewer_id, k.giver_id, k.created_by) or a.system_role = 'chu') then raise exception 'Bạn không phải người kiểm tra việc này.'; end if;
  if p_ok then
    update public.tasks set status = 'hoan_thanh', approved_by = a.id, approved_at = public.vn_now_text(), review_note = nullif(trim(coalesce(p_note, '')), '') where id = p_task;
    update public.handover_items set done_at = public.vn_now_text(), done_by = k.assignee_id where id = k.handover_item_id and done_at is null;
    perform public.app__gv_ev(p_task, a.id, 'dat', 'Kiểm tra: Đạt — đóng việc' || coalesce(' · ' || nullif(trim(coalesce(p_note, '')), ''), ''), null);
    perform public.app__notify(k.assignee_id, 'Việc đã được xác nhận Đạt', k.content, '/viec');
    if k.giver_id is not null and k.giver_id not in (a.id, k.assignee_id) then   -- bước 126
      perform public.app__notify(k.giver_id, 'Việc đã được xác nhận Đạt', public.app__acc_name(a.id) || ' xác nhận: ' || k.content, '/viec');
    end if;
  else
    if trim(coalesce(p_note, '')) = '' then raise exception 'Ghi lý do làm lại.'; end if;
    nd := public.app__pc_add(public.vn_now_text(), greatest(coalesce(p_days, 1), 0.1));
    update public.tasks set status = 'dang_xu_ly', review_note = trim(p_note), submitted_at = null, due_date = left(nd, 10), due_time = substr(nd, 12, 5) where id = p_task;
    perform public.app__gv_ev(p_task, a.id, 'lam_lai', 'Kiểm tra: Làm lại — ' || trim(p_note) || ' · hạn mới ' || to_char(nd::timestamp, 'DD/MM HH24:MI'), null);
    perform public.app__notify(k.assignee_id, 'Việc phải làm lại', trim(p_note) || ' — ' || k.content, '/viec');
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.app_gv_reassign(p_task bigint, p_assignee bigint, p_reviewer bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app__need(null); k public.tasks;
begin
  select * into k from public.tasks where id = p_task for update;
  if k.id is null or k.cancelled_at is not null or k.status in ('hoan_thanh', 'chua_phan_cong') then raise exception 'Không đổi người được ở bước này.'; end if;
  if not (a.id = k.giver_id or a.system_role in ('chu', 'ql_tong')) then raise exception 'Chỉ người giao việc, Chủ hoặc Quản lý tổng đổi người.'; end if;
  if coalesce(p_reviewer, k.reviewer_id) = coalesce(p_assignee, k.assignee_id) then raise exception 'Người kiểm tra phải khác người làm.'; end if;
  update public.tasks set assignee_id = coalesce(p_assignee, assignee_id), reviewer_id = coalesce(p_reviewer, reviewer_id),
         status = case when p_assignee is not null and p_assignee <> k.assignee_id and status = 'dang_xu_ly' then 'da_giao' else status end
   where id = p_task;
  perform public.app__gv_ev(p_task, a.id, 'doi_nguoi', 'Đổi người · làm: ' || public.app__acc_name(coalesce(p_assignee, k.assignee_id)) || ' · kiểm tra: ' || public.app__acc_name(coalesce(p_reviewer, k.reviewer_id)), null);
  if p_assignee is not null and p_assignee <> k.assignee_id then
    perform public.app__notify(p_assignee, 'Việc được giao cho bạn', k.content, '/viec');
    if k.assignee_id is not null and k.assignee_id <> a.id then   -- bước 126: người làm cũ biết việc đã chuyển
      perform public.app__notify(k.assignee_id, 'Việc đã chuyển cho người khác', k.content || ' · giờ do ' || public.app__acc_name(p_assignee) || ' làm', '/viec');
    end if;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.app_pc_mine()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.accounts := public.app__need(null); my_br bigint[]; mon text := to_char(public.vn_now(), 'YYYY-MM');
begin
  perform public.app__pc_tick_soon();
  my_br := array(select branch_id from public.pc_assign where job = 1 and a.id = any(accounts));
  return jsonb_build_object('now', public.vn_now_text(), 'me', a.id, 'can_give', public.app__gv_can_give(),
    'tasks', coalesce((select jsonb_agg(public.app__pc_task_json(t.id)) from public.pc_tasks t
               where t.done_at is null and exists(select 1 from public.pc_steps s where s.task_id = t.id and s.done_at is null and a.id = any(s.accounts))), '[]'),
    'gv', coalesce((select jsonb_agg(public.app__gv_json(k.id)) from public.tasks k
               where k.cancelled_at is null and k.cv_kind is null and k.status <> 'hoan_thanh' and (
                 (k.status in ('da_giao', 'dang_xu_ly') and k.assignee_id = a.id)
                 or (k.status = 'cho_duyet' and coalesce(k.reviewer_id, k.giver_id, k.created_by) = a.id)
                 or (k.status = 'chua_phan_cong' and k.handover_item_id is not null and a.id = any(public.app__pc_who(24, 'branch', k.branch_id)))
                 or (k.ext_days is not null and coalesce(k.giver_id, k.created_by) = a.id))), '[]'),
    'watch', coalesce((select jsonb_agg(public.app__gv_json(k.id)) from public.tasks k
               where k.cancelled_at is null and k.cv_kind is null and k.status in ('da_giao', 'dang_xu_ly', 'cho_duyet') and k.giver_id = a.id
                 and k.assignee_id is distinct from a.id and coalesce(k.reviewer_id, k.giver_id) is distinct from a.id and k.ext_days is null), '[]'),
    'debts', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'branch_id', d.branch_id, 'code', public.app__pc_bcode(d.branch_id), 'kind', d.kind,
               'name', coalesce(nullif(d.table_name, ''), 'Khách'), 'note', d.note, 'amount', d.amount, 'at', d.created_at) order by d.created_at)
             from public.shift_debts d where d.closed_at is null and d.kind in ('bill', 'ck', 'muon') and d.branch_id = any(my_br)), '[]'),
    'done', coalesce((select jsonb_agg(x order by x->>'done_at' desc) from (
               select jsonb_build_object('kind', 'pc', 'title', t.title, 'code', public.app__pc_bcode(t.branch_id), 'job', t.job, 'done_at', t.done_at,
                      'drop', t.done_note in ('Việc đã bị xoá', 'Quá 7 ngày — bỏ làm bổ sung'), 'note', case t.done_note when 'Việc đã bị xoá' then 'Việc đã bị xoá' when 'Quá 7 ngày — bỏ làm bổ sung' then 'Bỏ làm bổ sung' end,
                      'late', exists(select 1 from public.pc_penalties p where p.ref_id = t.id and p.src in ('pc', 'pci') and p.account_id = a.id)) x
                 from public.pc_tasks t where t.done_at >= to_char(public.vn_now() - interval '7 day', 'YYYY-MM-DD')
                  and exists(select 1 from public.pc_steps s where s.task_id = t.id and a.id = any(s.accounts))
               union all
               select jsonb_build_object('kind', 'gv', 'title', k.content, 'code', public.app__pc_bcode(k.branch_id), 'job', 24, 'done_at', coalesce(k.approved_at, k.cancelled_at),
                      'late', exists(select 1 from public.pc_penalties p where p.ref_id = k.id and p.src = 'tk' and p.account_id = a.id), 'drop', k.cancelled_at is not null)
                 from public.tasks k where k.cv_kind is null and (k.status = 'hoan_thanh' or k.cancelled_at is not null)
                  and coalesce(k.approved_at, k.cancelled_at) >= to_char(public.vn_now() - interval '7 day', 'YYYY-MM-DD')
                  and a.id in (k.assignee_id, k.giver_id, k.reviewer_id)) q), '[]'),
    'fines', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'step', p.step_name, 'due_at', p.due_at, 'status', p.status, 'amount', p.amount, 'decided_at', p.decided_at) order by p.id desc)
             from public.pc_penalties p where p.account_id = a.id and p.status in ('cho', 'phat') and left(p.due_at, 7) = mon), '[]'),
    'people', case when public.app__gv_can_give() then public.app__pc_people() end,
    'branches', (select jsonb_agg(jsonb_build_object('id', id, 'code', coalesce(display_code, code)) order by sort_order) from public.branches where status = 'Đang hoạt động'));
end $function$
;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_pc\_%' or p.proname like 'app\_\_pc\_%' or p.proname like 'app\_gv\_%' or p.proname like 'app\_\_gv\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if f.proname not like 'app\_\_%' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;

insert into public.app_migrations(file) values ('110_cong_viec_sua_nho.sql') on conflict (file) do nothing;
