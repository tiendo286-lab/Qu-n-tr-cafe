-- =====================================================================
-- BƯỚC 20: MỨC ĐỘ CÔNG VIỆC (Thấp / Bình thường / Gấp). Chạy sau 19. Chạy lại nhiều lần không sao.
--  * tasks.priority: 'thap' | 'binh_thuong' (mặc định) | 'gap'.
--  * Người giao chọn mức độ khi thêm / giao việc và đổi được khi việc chưa xử lý xong.
--  * app__viec_json trả to_jsonb(t) nên tự có trường priority.
-- =====================================================================

alter table public.tasks add column if not exists priority text not null default 'binh_thuong';
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks add constraint tasks_priority_check check (priority in ('thap', 'binh_thuong', 'gap'));

create or replace function public.app__viec_pri_label(p text) returns text
language sql immutable as $$ select case p when 'thap' then 'Thấp' when 'gap' then 'Gấp' else 'Bình thường' end $$;

create or replace function public.app_viec_update(p_task bigint, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.tasks; new_ass bigint; new_due text; new_content text; new_pri text; changed_ass boolean; notes text[] := '{}';
begin
  a := public.app__need('hop_giao_viec');
  select * into t from public.tasks where id = p_task for update;
  if t.id is null then raise exception 'Không tìm thấy công việc.'; end if;
  if t.status = 'hoan_thanh' then raise exception 'Việc đã xử lý xong. Muốn sửa hãy bấm "Yêu cầu làm lại".'; end if;
  new_ass := case when p ? 'assignee_id' then nullif(p ->> 'assignee_id', '')::bigint else t.assignee_id end;
  new_due := case when p ? 'due_date' then nullif(p ->> 'due_date', '') else t.due_date end;
  new_content := case when p ? 'content' and trim(coalesce(p ->> 'content', '')) <> '' then trim(p ->> 'content') else t.content end;
  new_pri := case when p ? 'priority' then coalesce(nullif(p ->> 'priority', ''), 'binh_thuong') else t.priority end;
  if new_pri not in ('thap', 'binh_thuong', 'gap') then raise exception 'Mức độ không hợp lệ.'; end if;
  if new_due is not null and new_due !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Hạn hoàn thành không hợp lệ.'; end if;
  if new_ass is not null and not exists (select 1 from jsonb_array_elements(public.app__viec_people()) x where (x ->> 'id')::bigint = new_ass) then
    raise exception 'Người nhận phải là nhân viên đang làm và có tài khoản.';
  end if;
  if new_ass is not null and new_ass = a.id then raise exception 'Không tự giao việc cho chính mình.'; end if;
  changed_ass := new_ass is not null and new_ass is distinct from t.assignee_id;
  update public.tasks set assignee_id = new_ass, due_date = new_due, content = new_content, priority = new_pri, updated_at = public.vn_now_text(),
         status = case when new_ass is null then 'chua_phan_cong' when changed_ass then 'da_giao' else t.status end,
         assigned_at = case when changed_ass then public.vn_now_text() else t.assigned_at end,
         started_at = case when changed_ass or new_ass is null then null else t.started_at end
   where id = t.id;
  if changed_ass then
    perform public.app__viec_event(t.id, 'giao', public.app__acc_name(new_ass) || coalesce(' · hạn ' || to_char(new_due::date, 'DD/MM/YYYY'), '')
                                                 || case when new_pri <> 'binh_thuong' then ' · mức độ ' || public.app__viec_pri_label(new_pri) else '' end);
    perform public.app__notify(new_ass, case when new_pri = 'gap' then 'Việc GẤP mới được giao' else 'Việc mới được giao' end,
      new_content || coalesce(E'\nHạn: ' || to_char(new_due::date, 'DD/MM/YYYY'), '') || E'\nMức độ: ' || public.app__viec_pri_label(new_pri)
      || E'\nNgười giao: ' || public.app__acc_name(a.id), '/viec');
  else
    if new_due is distinct from t.due_date then notes := notes || ('Đổi hạn: ' || coalesce(to_char(new_due::date, 'DD/MM/YYYY'), 'không hạn')); end if;
    if new_pri is distinct from t.priority then notes := notes || ('Mức độ: ' || public.app__viec_pri_label(new_pri)); end if;
    if new_content is distinct from t.content then notes := notes || 'Sửa nội dung'::text; end if;
    if array_length(notes, 1) > 0 then perform public.app__viec_event(t.id, 'sua', array_to_string(notes, ' · ')); end if;
    if new_pri = 'gap' and t.priority <> 'gap' and new_ass is not null then
      perform public.app__notify(new_ass, 'Việc chuyển sang GẤP', new_content || E'\nNgười giao: ' || public.app__acc_name(a.id), '/viec');
    end if;
  end if;
end $$;

-- Thêm việc: lưu luôn mức độ
create or replace function public.app_viec_add(p_meeting bigint, p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare a public.accounts; nid bigint; h public.handover_items; kind text := coalesce(p ->> 'kind', 'viec'); content text;
        pri text := coalesce(nullif(p ->> 'priority', ''), 'binh_thuong');
begin
  a := public.app__need('hop_giao_viec');
  if p_meeting is not null and not exists (select 1 from public.meetings where id = p_meeting) then raise exception 'Không tìm thấy cuộc họp.'; end if;
  if pri not in ('thap', 'binh_thuong', 'gap') then raise exception 'Mức độ không hợp lệ.'; end if;
  content := trim(coalesce(p ->> 'content', ''));
  if (p ->> 'handover_item_id') is not null then
    select * into h from public.handover_items where id = (p ->> 'handover_item_id')::bigint for update;
    if h.id is null or h.done_at is not null then raise exception 'Nội dung bàn giao này đã xong hoặc không còn.'; end if;
    if h.task_id is not null then raise exception 'Nội dung bàn giao này đã được giao rồi.'; end if;
    if content = '' then content := h.content; end if;
  end if;
  if content = '' then raise exception 'Nhập nội dung công việc.'; end if;
  if kind = 'dao_tao' and (p ->> 'employee_id') is null then raise exception 'Chọn nhân viên cần đào tạo.'; end if;
  insert into public.tasks(meeting_id, kind, content, handover_item_id, employee_id, created_by, priority)
  values (p_meeting, kind, content, h.id, case when kind = 'dao_tao' then (p ->> 'employee_id')::bigint end, a.id, pri)
  returning id into nid;
  if h.id is not null then update public.handover_items set task_id = nid where id = h.id; end if;
  perform public.app__viec_event(nid, 'tao', case when pri <> 'binh_thuong' then 'Mức độ: ' || public.app__viec_pri_label(pri) end);
  if nullif(p ->> 'assignee_id', '') is not null or nullif(p ->> 'due_date', '') is not null then
    perform public.app_viec_update(nid, p - 'priority');
  end if;
  return nid;
end $$;

revoke execute on function public.app__viec_pri_label(text) from public, anon, authenticated;
revoke execute on function public.app_viec_update(bigint, jsonb), public.app_viec_add(bigint, jsonb) from public, anon;
grant execute on function public.app_viec_update(bigint, jsonb), public.app_viec_add(bigint, jsonb) to authenticated;
