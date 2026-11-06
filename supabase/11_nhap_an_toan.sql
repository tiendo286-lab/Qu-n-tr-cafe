-- =====================================================================
-- BƯỚC 11: NHẬP DỮ LIỆU AN TOÀN (thay cho cách cũ "xóa sạch rồi nạp lại").
-- Chạy sau 10. Chạy lại nhiều lần không sao.
--
-- Cách cũ dùng TRUNCATE ... CASCADE trên nhân viên / chi nhánh / ca / phân quyền nên xóa lây sang
-- phiếu chốt ca, công việc, phiếu đào tạo, đọc nội quy, cam kết và làm mất các quyền mới.
-- Cách mới:
--   * THAY HẲN theo file: lịch tuần, order, chốt tuần, định biên, lịch cố định, chi nhánh/vai trò của nhân viên, đánh giá cũ.
--   * CẬP NHẬT theo file (có thì sửa, chưa có thì thêm, không xóa): cài đặt, chi nhánh, ca, giờ ca, vai trò, tuần, nhân viên.
--   * GIỮ NGUYÊN: tài khoản & mật khẩu, phân quyền, phiếu chốt ca, họp & công việc, nội quy, đào tạo, hỗ trợ, thông báo,
--     giờ order riêng từng tuần, lịch đã chốt mà nhân viên đang xem.
-- =====================================================================

-- Bảng "cập nhật theo file" (upsert theo khóa chính); các bảng còn lại trong danh sách nhập là "thay hẳn"
create or replace function public.app__import_upsert_tables() returns text[]
language sql immutable as $$ select array[
  'settings','branches','shifts','branch_shifts','work_roles','weeks','employees','employee_contacts',
  'week_order_windows','order_submissions','schedule_published','role_permissions'] $$;

create or replace function public.app_import_begin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được nhập dữ liệu.'; end if;
  -- chỉ xóa phần "thay hẳn"; dùng DELETE (không TRUNCATE CASCADE) để không xóa lây sang bảng khác
  delete from public.schedule_locks;
  delete from public.weekly_schedule_entries;
  delete from public.schedule_extra_rows;
  delete from public.schedule_closures;
  delete from public.order_entries;
  delete from public.order_import_batches;
  delete from public.order_snapshots;
  delete from public.order_edit_log;
  delete from public.staffing_requirements;
  delete from public.staffing_history;
  delete from public.fixed_schedule_entries;
  delete from public.fixed_schedule_members;
  delete from public.employee_branches;
  delete from public.employee_roles;
  delete from public.employee_work_plans;
  delete from public.evaluation_voucher_allocations;
  delete from public.evaluation_round_raw_submissions;
  delete from public.evaluation_round_import_batches;
  delete from public.evaluation_round_scores;
  delete from public.evaluation_round_criteria;
  delete from public.evaluation_round_employees;
  delete from public.evaluation_rounds;
  delete from public.evaluation_criteria;
end $$;

create or replace function public.app_import_rows(p_table text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare cols text; pk text; upd text; n integer; clash text;
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được nhập dữ liệu.'; end if;
  if not (p_table = any(public.app_import_tables())) then raise exception 'Bảng không hợp lệ: %', p_table; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then return 0; end if;
  select string_agg(quote_ident(c.column_name), ',' order by c.ordinal_position) into cols
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table
     and exists (select 1 from jsonb_object_keys(p_rows -> 0) k where k = c.column_name);
  if cols is null then return 0; end if;

  if p_table = any(public.app__import_upsert_tables()) then
    -- Tuần: tuần cùng ngày bắt đầu nhưng khác mã (tạo riêng trên web) → bỏ tuần web để dùng tuần trong file
    if p_table = 'weeks' then
      delete from public.weeks w using jsonb_to_recordset(p_rows) r(id bigint, start_date text)
       where w.start_date = r.start_date and w.id <> r.id;
    end if;
    -- Mã trùng với một bản ghi khác mã → báo rõ thay vì lỗi khó hiểu
    if p_table = 'employees' then
      select string_agg(e.code, ', ') into clash from public.employees e join jsonb_to_recordset(p_rows) r(id bigint, code text)
        on lower(e.code) = lower(r.code) and e.id <> r.id;
      if clash is not null then raise exception 'Mã nhân viên % trên web đang thuộc người khác với file. Hãy sửa mã trên web hoặc trong file rồi nhập lại.', clash; end if;
    end if;
    select string_agg(quote_ident(a.attname), ',') into pk
      from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = ('public.' || p_table)::regclass and i.indisprimary;
    select string_agg(format('%1$I = excluded.%1$I', c.column_name), ', ') into upd
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = p_table
       and exists (select 1 from jsonb_object_keys(p_rows -> 0) k where k = c.column_name)
       and not (c.column_name = any(string_to_array(replace(pk, '"', ''), ',')));
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict (%s) do %s',
                   p_table, cols, cols, p_table, pk, case when upd is null then 'nothing' else 'update set ' || upd end) using p_rows;
  else
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) on conflict do nothing',
                   p_table, cols, cols, p_table) using p_rows;
  end if;
  get diagnostics n = row_count;
  if p_table = 'employees' then
    insert into public.employee_contacts(employee_id, email, phone)
    select (r ->> 'id')::bigint, nullif(r ->> 'email', ''), nullif(r ->> 'phone', '')
      from jsonb_array_elements(p_rows) r
     where coalesce(r ->> 'email', '') <> '' or coalesce(r ->> 'phone', '') <> ''
    on conflict (employee_id) do update set email = excluded.email, phone = excluded.phone;
  end if;
  return n;
end $$;

revoke execute on function public.app__import_upsert_tables() from public, anon, authenticated;
revoke execute on function public.app_import_begin(), public.app_import_rows(text, jsonb) from public, anon;
grant execute on function public.app_import_begin(), public.app_import_rows(text, jsonb) to authenticated;
