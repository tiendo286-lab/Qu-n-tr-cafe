-- =====================================================================
-- BƯỚC 15: SAO LƯU ĐẦY ĐỦ. Chạy sau 14. Chạy lại nhiều lần không sao.
-- Gói ZIP ở trang "Dữ liệu & sao lưu" trước đây chỉ có phần lịch / order / nhân viên (định dạng bản offline).
-- Hàm này trả về toàn bộ dữ liệu các tính năng mới để đưa thêm vào gói (chỉ Chủ gọi được):
-- phiếu chốt ca, bàn giao, công nợ, tiền cuối ngày, công việc, nội quy & quy trình, cam kết, đào tạo, hỗ trợ.
-- (Ảnh trong phiếu ca / tài liệu nằm ở kho ảnh, không nằm trong gói.)
-- =====================================================================

create or replace function public.app__backup_tables() returns text[]
language sql immutable as $$ select array[
  'shift_reports','shift_report_moves','shift_report_staff','handover_items','shift_report_goods','shift_report_photos',
  'shift_report_checks','shift_debts','daily_cash_closings',
  'meetings','tasks','task_events',
  'docs','doc_reads','employee_commitments',
  'training_programs','training_items','trainings','training_marks','training_days',
  'support_requests','support_messages','support_reads'] $$;

create or replace function public.app_backup_extra() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t text; out jsonb := '{}'::jsonb; rows jsonb;
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được tải bản sao lưu.'; end if;
  foreach t in array public.app__backup_tables() loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into rows;
    out := out || jsonb_build_object(t, rows);
  end loop;
  return out;
end $$;

-- Số dòng từng bảng (hiện ở trang Dữ liệu & sao lưu)
create or replace function public.app_backup_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t text; out jsonb := '{}'::jsonb; n bigint;
begin
  if not public.app_can('du_lieu') then raise exception 'Chỉ Chủ được xem.'; end if;
  foreach t in array public.app__backup_tables() loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I', t) into n;
    out := out || jsonb_build_object(t, n);
  end loop;
  return out;
end $$;

revoke execute on function public.app__backup_tables() from public, anon, authenticated;
revoke execute on function public.app_backup_extra(), public.app_backup_counts() from public, anon;
grant execute on function public.app_backup_extra(), public.app_backup_counts() to authenticated;
