-- 147 (bước 168, anh Tiến giao 19/11/2026): THU NỢ chỉ cho nợ phát sinh TRƯỚC ca / ngày ghi thu — chặn ở máy chủ cho MỌI đường ghi thu nợ
-- (phiếu chốt ca app_ca_debt_collect*, Sổ thu chi / Công nợ app_cn_debt_collect, gán nợ ở phiếu chênh lệch app_stc_gap_debt).
--  * Thu trong 1 ca (closed_report_id): nợ của ca trước theo thứ tự ca (nợ ca Sáng trả ca Chiều cùng ngày vẫn được); không trả trong chính ca phát sinh;
--    nợ quản lý ghi (không có ca): ghi trong ngày của ca hoặc trước.
--  * Thu ngoài ca: ngày thu (closed_at) từ ngày phát sinh nợ trở đi.
--  Chỉ thêm kiểm tra ngày — KHÔNG đổi cách tính tiền. Chỉ kiểm lúc ĐÓNG nợ (hoặc chuyển sang ca thu khác); bỏ trả / sửa khác không bị ảnh hưởng.
--  Chạy lại nhiều lần không lỗi.

create or replace function public.app__debt_order_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.shift_reports; x public.shift_reports; od text;
begin
  if NEW.closed_at is null then return NEW; end if;
  if OLD.closed_at is not null and NEW.closed_report_id is not distinct from OLD.closed_report_id then return NEW; end if;
  if NEW.report_id is not null then select * into o from public.shift_reports where id = NEW.report_id; end if;
  od := coalesce(o.work_date, left(NEW.created_at, 10));
  if NEW.closed_report_id is not null then
    if NEW.closed_report_id = coalesce(NEW.report_id, 0) then raise exception 'Đây là nợ phát sinh trong chính ca này — không ghi thu nợ trong cùng ca.'; end if;
    select * into x from public.shift_reports where id = NEW.closed_report_id;
    if x.id is null then return NEW; end if;
    if o.id is not null then
      if (o.work_date, coalesce(array_position(public.app__shifts(), o.shift), 99)) >= (x.work_date, coalesce(array_position(public.app__shifts(), x.shift), 99)) then
        raise exception 'Khoản nợ ghi ở ca % % — chỉ thu ở ca sau ca đó.', o.shift, to_char(o.work_date::date, 'DD/MM');
      end if;
    elsif od > x.work_date then
      raise exception 'Khoản nợ ghi ngày % — chỉ thu ở ca từ ngày đó trở đi.', to_char(od::date, 'DD/MM');
    end if;
  elsif od is not null and left(NEW.closed_at, 10) < od then
    raise exception 'Khoản nợ ghi ngày % — ngày thu phải từ ngày đó trở đi.', to_char(od::date, 'DD/MM');
  end if;
  return NEW;
end $$;
revoke all on function public.app__debt_order_guard() from public, anon, authenticated;

drop trigger if exists debt_order_guard on public.shift_debts;
create trigger debt_order_guard before update of closed_at, closed_report_id on public.shift_debts
  for each row execute function public.app__debt_order_guard();

insert into public.app_migrations(file) values ('147_thu_no_truoc_ca.sql') on conflict (file) do nothing;
