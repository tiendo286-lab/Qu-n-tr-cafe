-- Việc hôm nay đợt 2 (bước 141): việc đọc Nội quy / ký Cam kết, trang theo dõi cho Kế toán, Kế toán sửa được cam kết.
-- Chốt 18/11/2026: nội quy gộp 1 việc mỗi nhân viên, hạn 12 ngày từ ngày đăng bài / bản mới;
-- cam kết hạn 12 ngày từ ngày vào làm, nhân viên vào trước 18/11/2026 tính từ 18/11/2026 (hạn 30/11/2026).

create or replace function public.app__tl_commit_due(e public.employees) returns date
language sql stable set search_path = public as $$
  select greatest(
    case when coalesce(e.start_date, '') ~ '^\d{4}-\d{2}-\d{2}' then left(e.start_date, 10)::date end,
    date '2026-11-18') + 12
$$;

-- Kế toán phụ trách: tài khoản vai Kế toán hoặc được cấp riêng quyền Kế toán (Chủ không tính, tránh đầy việc)
create or replace function public.app__tl_owner(a public.accounts) returns boolean
language sql stable security definer set search_path = public as $$
  select a.system_role = 'ke_toan' or exists (select 1 from public.account_perms p where p.account_id = a.id and p.perm = 'ke_toan')
$$;

create or replace function public.app_today_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.accounts; me public.employees; me_emp bigint; today date := public.vn_now()::date;
  nxt public.weeks; ow jsonb; order_info jsonb; rules jsonb; commit_info jsonb; follow jsonb; st text;
begin
  a := public.app__need(null);
  me_emp := public.app_my_employee();
  select * into me from public.employees where id = me_emp;
  if me_emp is not null and coalesce(public.app_can('order_ca'), false) then
    select * into nxt from public.weeks where start_date::date = date_trunc('week', today)::date + 7;
    if nxt.id is not null then
      ow := public.app_order_window(nxt.id);
      if ow ->> 'state' = 'dang_mo' then
        order_info := jsonb_build_object('week_id', nxt.id, 'start_date', nxt.start_date, 'close_at', ow ->> 'close',
          'close_text', ow ->> 'close_text',
          'submitted', exists (select 1 from public.order_submissions s where s.week_id = nxt.id and s.employee_id = me_emp));
      end if;
    end if;
  end if;
  if me_emp is not null and me.status = 'Đang làm' then
    select case when count(*) filter (where r.doc_id is null) > 0 then jsonb_build_object(
        'total', count(*), 'read', count(*) filter (where r.doc_id is not null),
        'due', min(left(d.published_at, 10)::date) filter (where r.doc_id is null) + 12,
        'first_unread', (array_agg(d.id order by d.sort_order, d.id) filter (where r.doc_id is null))[1]) end
      into rules
      from public.docs d
      left join public.doc_reads r on r.doc_id = d.id and r.employee_id = me_emp and r.version = d.published_version
      where d.kind = 'noi_quy' and d.published_version > 0;
    select coalesce(c.status, 'chua_ky') into st from public.employees e left join public.employee_commitments c on c.employee_id = e.id where e.id = me_emp;
    if st <> 'da_ky_nop' then commit_info := jsonb_build_object('status', st, 'due', public.app__tl_commit_due(me)); end if;
  end if;
  if public.app__tl_owner(a) then
    follow := jsonb_build_object(
      'rules', coalesce((select jsonb_agg(jsonb_build_object('doc_id', d.id, 'title', coalesce(d.published_title, d.title), 'version', d.published_version,
          'due', left(d.published_at, 10)::date + 12, 'unread', x.n) order by d.published_at, d.sort_order, d.id)
        from public.docs d cross join lateral (select count(*) n from public.employees e
          where e.status = 'Đang làm' and not exists (select 1 from public.doc_reads r where r.doc_id = d.id and r.employee_id = e.id and r.version = d.published_version)) x
        where d.kind = 'noi_quy' and d.published_version > 0 and x.n > 0), '[]'::jsonb),
      'commit', (select jsonb_build_object('pending', count(*), 'overdue', count(*) filter (where public.app__tl_commit_due(e) < today),
          'due', min(public.app__tl_commit_due(e)))
        from public.employees e left join public.employee_commitments c on c.employee_id = e.id
        where e.status = 'Đang làm' and coalesce(c.status, 'chua_ky') <> 'da_ky_nop'));
  end if;
  return jsonb_build_object(
    'today', today, 'now', public.vn_now_text(), 'has_employee', me_emp is not null,
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'shift', sp.shift, 'branch_id', sp.branch_id, 'branch', coalesce(b.display_code, b.code), 'role', sp.role,
        'start', left(bs.start_time, 5), 'end', left(bs.end_time, 5),
        'report_id', r.id, 'report_status', r.status, 'recon_status', r.recon_status)
        order by bs.start_time nulls last, sh.sort_order, sp.shift)
      from public.schedule_published sp
      join public.weeks w on w.id = sp.week_id
      join public.branches b on b.id = sp.branch_id
      left join public.shifts sh on sh.name = sp.shift
      left join public.branch_shifts bs on bs.branch_id = sp.branch_id and bs.shift_id = sh.id
      left join lateral (select x.id, x.status, x.recon_status from public.shift_reports x
        where x.branch_id = sp.branch_id and x.work_date = today::text and x.shift = sp.shift order by x.id desc limit 1) r on true
      where me_emp is not null and sp.employee_id = me_emp
        and w.start_date::date <= today and today <= w.start_date::date + 6
        and sp.weekday = today - w.start_date::date
    ), '[]'::jsonb),
    'order', order_info, 'rules', rules, 'commit', commit_info, 'follow', follow);
end $$;

-- Trang "Theo dõi đọc & cam kết": nhân viên đang làm, bài nội quy chưa đọc bản hiện hành, trạng thái + hạn cam kết
create or replace function public.app_tl_follow() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need(null);
  if not (coalesce(public.app_can('ke_toan'), false) or coalesce(public.app_can('quan_ly_nhan_vien'), false)) then
    raise exception 'Bạn không có quyền xem theo dõi nội quy và cam kết.';
  end if;
  return jsonb_build_object('today', public.vn_now()::date,
    'can_edit', true,
    'docs', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', coalesce(d.published_title, d.title), 'version', d.published_version,
        'published_at', d.published_at, 'due', left(d.published_at, 10)::date + 12) order by d.sort_order, d.id)
      from public.docs d where d.kind = 'noi_quy' and d.published_version > 0), '[]'::jsonb),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('employee_id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'start_date', e.start_date,
        'unread', coalesce((select jsonb_agg(d.id order by d.sort_order, d.id) from public.docs d
          where d.kind = 'noi_quy' and d.published_version > 0
            and not exists (select 1 from public.doc_reads r where r.doc_id = d.id and r.employee_id = e.id and r.version = d.published_version)), '[]'::jsonb),
        'commit', coalesce(c.status, 'chua_ky'), 'commit_at', c.updated_at, 'commit_by', public.app__acc_name(c.updated_by),
        'commit_due', public.app__tl_commit_due(e)) order by e.code)
      from public.employees e left join public.employee_commitments c on c.employee_id = e.id
      where e.status = 'Đang làm'), '[]'::jsonb));
end $$;

-- Kế toán cũng cập nhật được cam kết (nhận bản giấy đã ký)
create or replace function public.app_tl_set_commit(p_employee bigint, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app__need(null);
  if not (coalesce(public.app_can('quan_ly_nhan_vien'), false) or coalesce(public.app_can('ke_toan'), false)) then
    raise exception 'Chỉ Kế toán hoặc người quản lý nhân viên được cập nhật cam kết.';
  end if;
  if p_status not in ('chua_ky', 'da_ky_chua_nop', 'da_ky_nop') then raise exception 'Trạng thái cam kết không hợp lệ.'; end if;
  insert into public.employee_commitments(employee_id, status, note, updated_by, updated_at)
  values (p_employee, p_status, nullif(trim(coalesce(p_note, '')), ''), a.id, public.vn_now_text())
  on conflict (employee_id) do update set status = excluded.status, note = coalesce(excluded.note, public.employee_commitments.note),
         updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform public.app_log('cam_ket', 'employee=' || p_employee || ':' || p_status);
end $$;

revoke execute on function public.app__tl_commit_due(public.employees), public.app__tl_owner(public.accounts) from public, anon, authenticated;
revoke execute on function public.app_today_me(), public.app_tl_follow(), public.app_tl_set_commit(bigint, text, text) from public, anon;
grant execute on function public.app_today_me(), public.app_tl_follow(), public.app_tl_set_commit(bigint, text, text) to authenticated;

insert into public.app_migrations(file) values ('123_noi_quy_cam_ket_viec.sql') on conflict (file) do nothing;
