-- =====================================================================
-- BƯỚC 50: SỐ DƯ NGÂN HÀNG NHẬP SẴN THEO NGÀY / CA. Chạy sau 49. Chạy lại không sao.
--  * Số dư tài khoản nhận tiền (bank_account_balances) gắn với phiếu chốt ca. Khi mang số liệu cũ lên
--    (vd bảng "chốt doanh thu chuyển khoản" kế toán ghi trên Google Sheet) mà phiếu ca chưa có,
--    số dư được giữ trong bảng bank_balance_import theo (tài khoản, ngày, ca).
--  * Phiếu ca được tạo (hoặc tạo lại sau khi xoá nháp) → tự điền số dư nhập sẵn vào phiếu.
--    Không ghi đè số kế toán đã nhập trên web.
--  * Số liệu thật KHÔNG nằm trong tệp này (kho mã công khai) — nạp riêng bằng lệnh chạy một lần.
-- =====================================================================

create table if not exists public.bank_balance_import (
  account_id bigint not null references public.bank_accounts(id),
  work_date text not null,
  shift text not null,
  opening bigint, closing bigint, transfers_out bigint not null default 0, note text,
  source text,
  created_at text not null default public.vn_now_text(),
  primary key (account_id, work_date, shift)
);
alter table public.bank_balance_import enable row level security;
revoke all on public.bank_balance_import from anon, authenticated;

-- Điền số dư nhập sẵn vào một phiếu ca (bỏ qua tài khoản phiếu đã có số)
create or replace function public.app__bank_import_apply(p_report bigint) returns int
language plpgsql security definer set search_path = public as $$
declare r public.shift_reports; n int;
begin
  select * into r from public.shift_reports where id = p_report;
  if r.id is null or r.recon_status = 'hoan_thanh' then return 0; end if;
  insert into public.bank_account_balances(report_id, account_id, opening, closing, transfers_out, note, updated_by, updated_at)
  select r.id, i.account_id, i.opening, i.closing, i.transfers_out,
         coalesce(i.note || ' · ', '') || 'lấy từ ' || coalesce(i.source, 'số liệu nhập sẵn'), null, public.vn_now_text()
    from public.bank_balance_import i join public.bank_accounts k on k.id = i.account_id
   where k.branch_id = r.branch_id and i.work_date = r.work_date and i.shift = r.shift
  on conflict (report_id, account_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.app__bank_import_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__bank_import_apply(new.id);
  return new;
end $$;
drop trigger if exists bank_import_fill on public.shift_reports;
create trigger bank_import_fill after insert on public.shift_reports for each row execute function public.app__bank_import_trg();

-- ---------------------------------------------------------------- Sao lưu: thêm bảng số dư nhập sẵn
create or replace function public.app__backup_tables() returns text[]
language sql immutable as $$ select array[
  'shift_reports','shift_report_moves','shift_report_staff','handover_items','shift_report_goods','shift_report_photos',
  'shift_report_checks','shift_debts','daily_cash_closings','shift_report_recon','shift_recon_log',
  'shift_report_results','shift_shortfalls',
  'delivery_invoices','delivery_invoice_files','delivery_receipt_photos','delivery_receipt_items','bank_shift_balances',
  'bank_accounts','bank_account_balances','bank_late_receipts','bank_balance_import',
  'meetings','tasks','task_events',
  'docs','doc_reads','employee_commitments',
  'training_programs','training_items','trainings','training_marks','training_days',
  'support_requests','support_messages','support_reads',
  'fin_categories','fin_branch_managers','fin_entries','fin_move_cats','fin_month_closes','fin_close_log',
  'shift_report_parts'] $$;

revoke execute on function public.app__bank_import_apply(bigint), public.app__bank_import_trg(), public.app__backup_tables() from public, anon, authenticated;
