-- =====================================================================
-- BƯỚC 14: BỎ HỌP — TAB CÔNG VIỆC BẮT ĐẦU BẰNG "CẦN XỬ LÝ". Chạy sau 13. Chạy lại nhiều lần không sao.
--
--   Cần xử lý = nội dung bàn giao ca chưa xong (chưa giao cho ai) + việc Chủ tự ghi nhưng chưa chọn người.
--   Chủ chọn người nhận (+ hạn nếu muốn) → việc sang "Chờ nhận". Hoặc đánh dấu "Đã xong, không cần giao".
--   Bảng meetings giữ nguyên (không dùng nữa) để không mất dữ liệu cũ.
-- =====================================================================

-- Danh sách cần xử lý
create or replace function public.app_viec_pending() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('hop_giao_viec');
  return jsonb_build_object(
    'handover', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'content', h.content, 'report_id', r.id, 'branch', coalesce(b.display_code, b.code),
                     'work_date', r.work_date, 'shift', r.shift, 'by', public.app__acc_name(h.created_by), 'created_at', h.created_at)
                     order by r.work_date, b.sort_order, h.id)
                    from public.handover_items h join public.shift_reports r on r.id = h.report_id join public.branches b on b.id = h.branch_id
                   where h.done_at is null and h.task_id is null), '[]'),
    'tasks', coalesce((select jsonb_agg(public.app__viec_json(t) order by t.id) from public.tasks t where t.status = 'chua_phan_cong'), '[]'));
end $$;

-- Thêm việc (không cần cuộc họp). Chưa chọn người → nằm ở "Cần xử lý".
create or replace function public.app_viec_add(p_meeting bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; nid bigint; h public.handover_items; kind text := coalesce(p ->> 'kind', 'viec'); content text;
begin
  a := public.app__need('hop_giao_viec');
  if p_meeting is not null and not exists (select 1 from public.meetings where id = p_meeting) then raise exception 'Không tìm thấy cuộc họp.'; end if;
  content := trim(coalesce(p ->> 'content', ''));
  if (p ->> 'handover_item_id') is not null then
    select * into h from public.handover_items where id = (p ->> 'handover_item_id')::bigint for update;
    if h.id is null or h.done_at is not null then raise exception 'Nội dung bàn giao này đã xong hoặc không còn.'; end if;
    if h.task_id is not null then raise exception 'Nội dung bàn giao này đã được giao rồi.'; end if;
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

-- Nội dung bàn giao không cần giao ai: Chủ đánh dấu đã xong
create or replace function public.app_viec_handover_close(p_item bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need('hop_giao_viec');
  update public.handover_items set done_at = public.vn_now_text(), done_by = a.id
   where id = p_item and done_at is null and task_id is null;
  if not found then raise exception 'Nội dung này đã xong hoặc đã được giao.'; end if;
end $$;

-- Phiếu ca: câu báo khi nội dung đã được giao việc
create or replace function public.app_ca_handover_done(p_item bigint, p_report bigint, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; h public.handover_items;
begin
  a := public.app_account();
  perform public.app__ca_need_edit(p_report);
  select * into h from public.handover_items where id = p_item;
  if h.id is null then raise exception 'Không tìm thấy việc bàn giao.'; end if;
  if h.task_id is not null then raise exception 'Việc này đã được giao ở tab Công việc; chỉ xong khi người nhận báo Đã xử lý.'; end if;
  if p_done then
    update public.handover_items set done_at = public.vn_now_text(), done_by = a.id, done_report_id = p_report where id = p_item and done_at is null;
  else
    update public.handover_items set done_at = null, done_by = null, done_report_id = null where id = p_item and done_report_id = p_report;
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
    -- số mục "Cần xử lý" (huy hiệu cho người giao việc)
    'to_review', case when public.app_can('hop_giao_viec') then
        (select count(*) from public.handover_items where done_at is null and task_id is null)
      + (select count(*) from public.tasks where status = 'chua_phan_cong') else 0 end,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'content', t.content, 'due_date', t.due_date, 'status', t.status, 'kind', t.kind,
                         'group', case when t.due_date < today then 'overdue' when t.due_date = today then 'today' else 'open' end)
                         order by t.due_date nulls last, t.id)
                        from public.tasks t where t.assignee_id = a.id and t.status in ('da_giao', 'dang_xu_ly')), '[]'));
end $$;

revoke execute on function public.app_viec_pending(), public.app_viec_handover_close(bigint), public.app_viec_add(bigint, jsonb),
  public.app_ca_handover_done(bigint, bigint, boolean) from public, anon;
grant execute on function public.app_viec_pending(), public.app_viec_handover_close(bigint), public.app_viec_add(bigint, jsonb),
  public.app_ca_handover_done(bigint, bigint, boolean) to authenticated;
