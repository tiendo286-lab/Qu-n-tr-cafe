-- BƯỚC 142 (sửa sau soát lỗi): app_today_more trả thêm who_id (so người làm bằng mã tài khoản — tên dạng "Mã – Tên")
-- và bỏ việc Bảng phân công bị xoá / tự bỏ khỏi "Đã xong hôm nay". Chạy lại nhiều lần không sao. Thay bản ở tệp 124.
create or replace function public.app_today_more() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; today date := public.vn_now()::date; d text;
begin
  a := public.app__need(null);
  d := today::text;
  return jsonb_build_object(
    'today', d,
    'review_wait', coalesce((select jsonb_agg(public.app__gv_json(x.id) order by x.submitted_at) from (
        select k.id, k.submitted_at from public.tasks k
         where k.cv_kind is null and k.cancelled_at is null and k.status = 'cho_duyet' and k.assignee_id = a.id
           and coalesce(k.reviewer_id, k.giver_id, k.created_by, 0) <> a.id
         offset 0) x), '[]'::jsonb),
    'done_today', coalesce((select jsonb_agg(y.j order by y.at desc) from (
        select t.done_at at, jsonb_build_object('kind', 'pc', 'id', t.id, 'job', t.job, 'title', t.title, 'code', public.app__pc_bcode(t.branch_id),
                 'at', t.done_at, 'who', public.app__acc_name(t.done_by), 'who_id', t.done_by) j
          from public.pc_tasks t
         where left(t.done_at, 10) = d and coalesce(t.done_note, '') not in ('Việc đã bị xoá', 'Quá 7 ngày — bỏ làm bổ sung') and exists (select 1 from public.pc_steps s where s.task_id = t.id and a.id = any(s.accounts))
        union all
        select k.approved_at, jsonb_build_object('kind', 'gv', 'id', k.id, 'title', k.content, 'code', public.app__pc_bcode(k.branch_id),
                 'handover', k.handover_item_id is not null, 'at', k.approved_at,
                 'by', public.app__acc_name(k.approved_by), 'who', public.app__acc_name(k.assignee_id), 'who_id', k.assignee_id)
          from public.tasks k
         where k.cv_kind is null and k.cancelled_at is null and k.status = 'hoan_thanh' and left(k.approved_at, 10) = d
           and (k.assignee_id = a.id or k.approved_by = a.id)
        offset 0) y), '[]'::jsonb),
    'followups', coalesce((select jsonb_agg(jsonb_build_object(
          'training_id', t.id, 'employee', e.code || ' – ' || e.name, 'item_no', f.item_no, 'item', i.title,
          'stage', case when f.is_extra then 'giai_doan_2' when coalesce(m.practiced, false) then 'da_thuc_hanh'
                        when coalesce(m.introduced, false) then 'da_gioi_thieu' else 'chua_gioi_thieu' end,
          'level', m.level, 'is_extra', f.is_extra, 'instructor', h.name, 'due', (t.start_date::date + 12)::text)
          order by t.start_date, t.id, f.item_no)
        from public.trainings t
        join public.employees e on e.id = t.employee_id and e.status = 'Đang làm'
        join public.training_followups f on f.training_id = t.id and f.employee_id is not null and f.finished_at is null
        join public.employees h on h.id = f.employee_id
        left join public.training_items i on i.program_id = t.program_id and i.no = f.item_no
        left join public.training_marks m on m.training_id = t.id and m.item_no = f.item_no
       where t.manager_id = a.id and (f.is_extra or m.level is null)
         and public.app__dt_status(t) <> 'hoan_thanh'), '[]'::jsonb));
end $$;

revoke execute on function public.app_today_more() from public, anon;
grant execute on function public.app_today_more() to authenticated;

insert into public.app_migrations(file) values ('125_viec_hom_nay_sua.sql') on conflict (file) do nothing;
