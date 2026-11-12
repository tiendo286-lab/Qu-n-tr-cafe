-- =====================================================================
-- BƯỚC 53: SỬA LỖI BƯỚC 51 (12/11/2026). Chạy sau 52. Chạy lại không sao.
--  * Trigger tự đối soát (app__ca_auto_trg) đọc NEW.branch_id cho mọi bảng → lưu số dư ngân hàng / Chủ duyệt nghỉ & làm thay
--    báo lỗi "record new has no field branch_id". Tách theo từng bảng.
-- =====================================================================
create or replace function public.app__ca_auto_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  if TG_TABLE_NAME = 'fabi_shifts' then
    rid := NEW.report_id;
    if rid is null then
      select r.id into rid from public.shift_reports r where r.branch_id = NEW.branch_id and r.work_date = NEW.work_date and r.shift = NEW.shift;
    end if;
  elsif TG_TABLE_NAME = 'bank_account_balances' then
    if TG_OP = 'DELETE' then rid := OLD.report_id; else rid := NEW.report_id; end if;
  elsif TG_TABLE_NAME = 'shift_cover_reviews' then
    rid := NEW.report_id;
  end if;
  if rid is not null then perform public.app__ca_auto_green(rid); end if;
  return null;
end $$;
revoke execute on function public.app__ca_auto_trg() from public, anon, authenticated;
