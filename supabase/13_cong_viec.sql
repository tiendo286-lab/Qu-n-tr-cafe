-- =====================================================================
-- BƯỚC 13: CÔNG VIỆC — CHỦ GIAO VIỆC CHO NHÂN VIÊN, 3 TRẠNG THÁI. Chạy sau 12. Chạy lại nhiều lần không sao.
--
--   Chờ nhận (da_giao)  →  nhân viên bấm "Nhận việc"  →  Đang xử lý (dang_xu_ly)
--                       →  nhân viên bấm "Đã xử lý" (ghi kết quả, không bắt buộc)  →  Đã xử lý (hoan_thanh)
--   * Bỏ bước "chờ duyệt". Người giao vẫn "Yêu cầu làm lại" được → việc quay về Đang xử lý.
--   * Giao được cho mọi tài khoản đang làm: Quản lý tổng, Quản lý, Nhân viên. Hạn hoàn thành không bắt buộc.
--   * Giao thẳng ở tab Công việc (không cần cuộc họp). Cuộc họp vẫn giữ để lấy nội dung bàn giao ca;
--     việc trong họp chưa chọn người thì ở trạng thái nháp "Chưa giao" (chua_phan_cong).
-- =====================================================================

alter table public.tasks add column if not exists done_at text;

-- Việc đang chờ duyệt theo cách cũ → coi là đã xử lý
update public.tasks set status = 'hoan_thanh', done_at = coalesce(submitted_at, public.vn_now_text()) where status = 'cho_duyet';
update public.tasks set done_at = coalesce(approved_at, submitted_at, updated_at) where status = 'hoan_thanh' and done_at is null;
update public.handover_items h set done_at = coalesce(t.done_at, public.vn_now_text()), done_by = coalesce(t.approved_by, t.assignee_id)
  from public.tasks t where t.handover_item_id = h.id and t.status = 'hoan_thanh' and h.done_at is null;

-- ---------------------------------------------------------------- Quyền: mọi nhân viên có tài khoản đều nhận việc
create or replace function public.app_can(p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app_account();
  if a.id is null then return false; end if;
  if a.system_role = 'chu' then return true; end if;
  if p in ('phan_quyen', 'xoa_du_lieu_tuan', 'du_lieu') then return false; end if;
  if p = 'chot_ca' then return true; end if;                                    -- ai cũng chốt ca được
  if p = 'nhan_viec' then return true; end if;                                  -- ai cũng nhận việc được giao
  if p = 'xu_ly_ho_tro' then return a.system_role in ('ql_tong', 'ql'); end if;
  if a.system_role = 'nv' then
    if p in ('order_ca', 'xem_lich_minh') then return true; end if;
    if p <> 'xem_tat_ca' then return false; end if;
  end if;
  return coalesce((select r.allowed = 1 from public.role_permissions r where r.role = a.system_role and r.perm = p), false);
end $$;

-- ---------------------------------------------------------------- Hàm phụ
-- Người nhận việc được: tài khoản không khóa, gắn nhân viên đang làm (Chủ không nhận việc)
create or replace function public.app__viec_people() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', e.code || ' – ' || e.name, 'role', a.system_role)
                            order by case a.system_role when 'ql_tong' then 0 when 'ql' then 1 else 2 end, e.code), '[]')
    from public.accounts a join public.employees e on e.id = a.employee_id
   where a.locked = 0 and e.status = 'Đang làm' and a.system_role in ('ql_tong', 'ql', 'nv')
$$;

create or replace function public.app__viec_json(t public.tasks) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(t) || jsonb_build_object(
    'assignee_name', public.app__acc_name(t.assignee_id),
    'created_by_name', public.app__acc_name(t.created_by),
    'meeting_title', (select m.title from public.meetings m where m.id = t.meeting_id),
    'meeting_date', (select m.meeting_date from public.meetings m where m.id = t.meeting_id),
    'employee', (select e.code || ' – ' || e.name from public.employees e where e.id = t.employee_id),
    'source', (select jsonb_build_object('report_id', r.id, 'branch', coalesce(b.display_code, b.code), 'work_date', r.work_date, 'shift', r.shift,
                                         'content', h.content, 'by', public.app__acc_name(h.created_by))
                 from public.handover_items h join public.shift_reports r on r.id = h.report_id join public.branches b on b.id = h.branch_id
                where h.id = t.handover_item_id),
    'overdue', t.status in ('da_giao', 'dang_xu_ly') and t.due_date is not null and t.due_date < to_char(public.vn_now(), 'YYYY-MM-DD'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('at', ev.at, 'by', public.app__acc_name(ev.by_account), 'action', ev.action, 'note', ev.note) order by ev.id)
                          from public.task_events ev where ev.task_id = t.id), '[]'))
$$;

create or replace function public.app__viec_recent(t public.tasks) returns boolean
language sql stable as $$
  select t.status <> 'hoan_thanh' or coalesce(t.done_at, t.updated_at) >= to_char(public.vn_now() - interval '30 days', 'YYYY-MM-DD')
$$;

-- ---------------------------------------------------------------- Người giao
create or replace function public.app_viec_people() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('hop_giao_viec');
  return public.app__viec_people();
end $$;

create or replace function public.app_viec_meetings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('hop_giao_viec');
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'meeting_date', m.meeting_date, 'note', m.note,
      'created_by', public.app__acc_name(m.created_by),
      'total', (select count(*) from public.tasks t where t.meeting_id = m.id),
      'done', (select count(*) from public.tasks t where t.meeting_id = m.id and t.status = 'hoan_thanh'),
      'waiting', 0)
    order by m.meeting_date desc, m.id desc) from public.meetings m), '[]');
end $$;

create or replace function public.app_viec_meeting_get(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.meetings;
begin
  perform public.app__need('hop_giao_viec');
  select * into m from public.meetings where id = p_id;
  if m.id is null then raise exception 'Không tìm thấy cuộc họp.'; end if;
  return to_jsonb(m) || jsonb_build_object(
    'created_by_name', public.app__acc_name(m.created_by),
    'tasks', coalesce((select jsonb_agg(public.app__viec_json(t) order by t.id) from public.tasks t where t.meeting_id = m.id), '[]'),
    'open_handover', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'content', h.content, 'report_id', r.id, 'branch', coalesce(b.display_code, b.code),
                        'work_date', r.work_date, 'shift', r.shift, 'by', public.app__acc_name(h.created_by)) order by r.work_date, b.sort_order, h.id)
                       from public.handover_items h join public.shift_reports r on r.id = h.report_id join public.branches b on b.id = h.branch_id
                      where h.done_at is null and h.task_id is null), '[]'),
    'managers', public.app__viec_people(),
    'employees', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank) order by e.code)
                            from public.employees e where e.status = 'Đang làm'), '[]'));
end $$;

-- Thêm việc. p_meeting = null → giao thẳng ở tab Công việc (bắt buộc chọn người nhận).
create or replace function public.app_viec_add(p_meeting bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; nid bigint; h public.handover_items; kind text := coalesce(p ->> 'kind', 'viec'); content text;
begin
  a := public.app__need('hop_giao_viec');
  if p_meeting is not null and not exists (select 1 from public.meetings where id = p_meeting) then raise exception 'Không tìm thấy cuộc họp.'; end if;
  if p_meeting is null and nullif(p ->> 'assignee_id', '') is null then raise exception 'Chọn người nhận việc.'; end if;
  content := trim(coalesce(p ->> 'content', ''));
  if (p ->> 'handover_item_id') is not null then
    select * into h from public.handover_items where id = (p ->> 'handover_item_id')::bigint for update;
    if h.id is null or h.done_at is not null then raise exception 'Nội dung bàn giao này đã xong hoặc không còn.'; end if;
    if h.task_id is not null then raise exception 'Nội dung bàn giao này đã được đưa vào một công việc khác.'; end if;
    if content = '' then content := h.content; end if;
  end if;
  if content = '' then raise exception 'Nhập nội dung công việc.'; end if;
  if kind = 'dao_tao' and (p ->> 'employee_id') is null then raise exception 'Chọn nhân viên cần đào tạo.'; end if;
  insert into public.tasks(meeting_id, kind, content, handover_item_id, employee_id, created_by)
  values (p_meeting, kind, content, h.id, case when kind = 'dao_tao' then (p ->> 'employee_id')::bigint end, a.id)
  returning id into nid;
  if h.id is not null then update public.handover_items set task_id = nid where id = h.id; end if;
  perform public.app__viec_event(nid, 'tao', null);
  if nullif(p ->> 'assignee_id', '') is not null or nullif(p ->> 'due_date', '') is not null then
    perform public.app_viec_update(nid, p);
  end if;
  return nid;
end $$;

-- Sửa nội dung / người nhận / hạn. Chọn người nhận → "Chờ nhận" và người đó nhận thông báo.
create or replace function public.app_viec_update(p_task bigint, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.tasks; new_ass bigint; new_due text; new_content text; changed_ass boolean;
begin
  a := public.app__need('hop_giao_viec');
  select * into t from public.tasks where id = p_task for update;
  if t.id is null then raise exception 'Không tìm thấy công việc.'; end if;
  if t.status = 'hoan_thanh' then raise exception 'Việc đã xử lý xong. Muốn sửa hãy bấm "Yêu cầu làm lại".'; end if;
  new_ass := case when p ? 'assignee_id' then nullif(p ->> 'assignee_id', '')::bigint else t.assignee_id end;
  new_due := case when p ? 'due_date' then nullif(p ->> 'due_date', '') else t.due_date end;
  new_content := case when p ? 'content' and trim(coalesce(p ->> 'content', '')) <> '' then trim(p ->> 'content') else t.content end;
  if new_due is not null and new_due !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Hạn hoàn thành không hợp lệ.'; end if;
  if new_ass is not null and not exists (select 1 from jsonb_array_elements(public.app__viec_people()) x where (x ->> 'id')::bigint = new_ass) then
    raise exception 'Người nhận phải là nhân viên đang làm và có tài khoản.';
  end if;
  if new_ass is not null and new_ass = a.id then raise exception 'Không tự giao việc cho chính mình.'; end if;
  changed_ass := new_ass is not null and new_ass is distinct from t.assignee_id;
  update public.tasks set assignee_id = new_ass, due_date = new_due, content = new_content, updated_at = public.vn_now_text(),
         status = case when new_ass is null then 'chua_phan_cong' when changed_ass then 'da_giao' else t.status end,
         assigned_at = case when changed_ass then public.vn_now_text() else t.assigned_at end,
         started_at = case when changed_ass or new_ass is null then null else t.started_at end
   where id = t.id;
  if changed_ass then
    perform public.app__viec_event(t.id, 'giao', public.app__acc_name(new_ass) || coalesce(' · hạn ' || to_char(new_due::date, 'DD/MM/YYYY'), ''));
    perform public.app__notify(new_ass, 'Việc mới được giao',
      new_content || coalesce(E'\nHạn: ' || to_char(new_due::date, 'DD/MM/YYYY'), '') || E'\nNgười giao: ' || public.app__acc_name(a.id), '/viec');
  elsif new_due is distinct from t.due_date or new_content is distinct from t.content then
    perform public.app__viec_event(t.id, 'sua', case when new_due is distinct from t.due_date then 'Đổi hạn: ' || coalesce(to_char(new_due::date, 'DD/MM/YYYY'), 'không hạn') end);
  end if;
end $$;

create or replace function public.app_viec_delete(p_task bigint) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  perform public.app__need('hop_giao_viec');
  select * into t from public.tasks where id = p_task;
  if t.id is null then return; end if;
  update public.handover_items set task_id = null where task_id = t.id;
  delete from public.tasks where id = t.id;
  perform public.app_log('xoa_cong_viec', 'task=' || t.id);
end $$;

create or replace function public.app_viec_all() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('hop_giao_viec');
  return coalesce((select jsonb_agg(public.app__viec_json(t) order by t.due_date nulls last, t.id)
                     from public.tasks t where public.app__viec_recent(t)), '[]');
end $$;

-- Việc đã xử lý → người giao yêu cầu làm lại (bắt buộc ghi lý do)
create or replace function public.app_viec_reopen(p_task bigint, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  perform public.app__need('hop_giao_viec');
  if trim(coalesce(p_note, '')) = '' then raise exception 'Ghi lý do yêu cầu làm lại.'; end if;
  update public.tasks set status = 'dang_xu_ly', review_note = trim(p_note), done_at = null, updated_at = public.vn_now_text()
   where id = p_task and status = 'hoan_thanh' returning * into t;
  if t.id is null then raise exception 'Chỉ yêu cầu làm lại được việc đã xử lý.'; end if;
  update public.handover_items set done_at = null, done_by = null where id = t.handover_item_id;
  perform public.app__viec_event(t.id, 'lam_lai', trim(p_note));
  perform public.app__notify(t.assignee_id, 'Yêu cầu làm lại', t.content || E'\nLý do: ' || trim(p_note), '/viec');
end $$;

-- ---------------------------------------------------------------- Người nhận việc
create or replace function public.app_viec_mine() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need('nhan_viec');
  return coalesce((select jsonb_agg(public.app__viec_json(t) order by t.due_date nulls last, t.id)
                     from public.tasks t where t.assignee_id = a.id and t.status in ('da_giao', 'dang_xu_ly', 'hoan_thanh')
                      and public.app__viec_recent(t)), '[]');
end $$;

-- Nhận việc: Chờ nhận → Đang xử lý
create or replace function public.app_viec_start(p_task bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.tasks;
begin
  a := public.app__need('nhan_viec');
  update public.tasks set status = 'dang_xu_ly', started_at = public.vn_now_text(), updated_at = public.vn_now_text()
   where id = p_task and assignee_id = a.id and status = 'da_giao' returning * into t;
  if t.id is null then raise exception 'Việc này không còn ở trạng thái Chờ nhận.'; end if;
  perform public.app__viec_event(p_task, 'bat_dau', null);
  if t.created_by is not null and t.created_by <> a.id then
    perform public.app__notify(t.created_by, 'Đã nhận việc', public.app__acc_name(a.id) || ': ' || t.content, '/quan-ly/giao-viec');
  end if;
end $$;

-- Báo đã xử lý (kết quả không bắt buộc): Chờ nhận / Đang xử lý → Đã xử lý
create or replace function public.app_viec_submit(p_task bigint, p_report text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.tasks; now_ text := public.vn_now_text();
begin
  a := public.app__need('nhan_viec');
  update public.tasks set status = 'hoan_thanh', report = nullif(trim(coalesce(p_report, '')), ''), submitted_at = now_, done_at = now_,
         started_at = coalesce(started_at, now_), review_note = null, updated_at = now_
   where id = p_task and assignee_id = a.id and status in ('da_giao', 'dang_xu_ly')
  returning * into t;
  if t.id is null then raise exception 'Chỉ người được giao mới báo đã xử lý, và việc phải đang Chờ nhận / Đang xử lý.'; end if;
  update public.handover_items set done_at = now_, done_by = a.id where id = t.handover_item_id and done_at is null;
  perform public.app__viec_event(t.id, 'bao_cao', t.report);
  if t.created_by is not null and t.created_by <> a.id then
    perform public.app__notify(t.created_by, 'Việc đã xử lý', public.app__acc_name(a.id) || ': ' || t.content
      || coalesce(E'\nKết quả: ' || t.report, ''), '/quan-ly/giao-viec');
  end if;
end $$;

-- Nhắc việc khi mở app
create or replace function public.app_viec_reminder() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; today text := to_char(public.vn_now(), 'YYYY-MM-DD');
begin
  a := public.app_account();
  if a.id is null then return null; end if;
  return jsonb_build_object(
    'overdue', (select count(*) from public.tasks where assignee_id = a.id and status in ('da_giao', 'dang_xu_ly') and due_date < today),
    'today', (select count(*) from public.tasks where assignee_id = a.id and status in ('da_giao', 'dang_xu_ly') and due_date = today),
    'open', (select count(*) from public.tasks where assignee_id = a.id and status in ('da_giao', 'dang_xu_ly')),
    'new', (select count(*) from public.tasks where assignee_id = a.id and status = 'da_giao'),
    'waiting', 0,
    'to_review', 0,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'content', t.content, 'due_date', t.due_date, 'status', t.status, 'kind', t.kind,
                         'group', case when t.due_date < today then 'overdue' when t.due_date = today then 'today' else 'open' end)
                         order by t.due_date nulls last, t.id)
                        from public.tasks t where t.assignee_id = a.id and t.status in ('da_giao', 'dang_xu_ly')), '[]'));
end $$;

-- ---------------------------------------------------------------- Cấp quyền gọi hàm
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and (p.proname like 'app\_viec\_%' or p.proname like 'app\_\_viec\_%' or p.proname = 'app_can') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
