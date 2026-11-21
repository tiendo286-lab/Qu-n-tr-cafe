-- Chặng 2 (anh Tiến chốt 21/11/2026, chọn "Trả về cho quản lý xem"): lúc lên bản Đối soát 6 bước (tệp 150, 19:39 ngày 20/11) mọi ca đã xác nhận Fabi
-- được ghi sẵn dấu Hoàn thành ('trước bước 171'). 107 ca trong số đó có kết quả tiền mặt + chuyển khoản do WEB tự ghi, không quản lý nào xem
-- (ĐK 29, HS 34, LHP 9, Lela 35 — ngày 01→17/11, đều khớp tiền). Trái điều anh dặn: ca không được hiện đã đối soát khi còn mục chưa kiểm tra.
--   • Bỏ dấu Hoàn thành của các ca đó → ca về 🔵 "Đã xác nhận Fabi, chưa hoàn thành"; quản lý mở, tích các mục, bấm Hoàn thành.
--   • KHÔNG đổi kết quả tiền, sổ tháng, nợ (nợ của các ca này vẫn coi như đã xếp từ tệp 151). Ca có người xác nhận / bấm Hoàn thành thật: giữ nguyên.
--   • Cất bản sao ở stc_ca_done_tra_ve. Quay lại cách cũ:
--       insert into public.stc_ca_done(report_id, by_account, at) select report_id, by_account, at from public.stc_ca_done_tra_ve on conflict do nothing;
-- VÙNG KHOÁ (dấu Hoàn thành phần tiền của ca) — anh Tiến chốt ở buổi chốt chặng 2. Bài thử: kiem_tra/tra_ve_158_cuc_bo.sql. Chạy lại nhiều lần không sao
-- (chỉ trả về MỘT LẦN, lúc tệp chưa có trong sổ tệp đã chạy).

create table if not exists public.stc_ca_done_tra_ve (
  report_id bigint primary key references public.shift_reports(id) on delete cascade,
  by_account bigint,
  at text,
  tra_ve_at text not null default public.vn_now_text(),
  ly_do text
);
alter table public.stc_ca_done_tra_ve enable row level security;
revoke all on public.stc_ca_done_tra_ve from anon, authenticated;

-- chuyển các ca đủ điều kiện sang bản sao rồi bỏ dấu Hoàn thành; trả về số ca đã trả
create or replace function public.app__stc_tra_ve_ca_web() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.stc_ca_done_tra_ve(report_id, by_account, at, ly_do)
  select d.report_id, d.by_account, d.at, 'Anh Tiến chốt 21/11: kết quả tiền do web tự ghi khi lên bản 6 bước — trả về chờ quản lý xem'
    from public.stc_ca_done d
   where d.at = 'trước bước 171'
     and exists (select 1 from public.shift_report_results s where s.report_id = d.report_id and s.item in ('tien_mat', 'chuyen_khoan'))
     and not exists (select 1 from public.shift_report_results s where s.report_id = d.report_id and s.item in ('tien_mat', 'chuyen_khoan') and s.by_account is not null)
  on conflict (report_id) do nothing;
  delete from public.stc_ca_done d using public.stc_ca_done_tra_ve t where t.report_id = d.report_id and d.at = 'trước bước 171';
  get diagnostics n = row_count;
  if n > 0 then perform public.app_log('stc_tra_ve_ca_web', n || ' ca về chờ quản lý xem (chặng 2, 21/11)'); end if;
  return n;
end $$;
revoke all on function public.app__stc_tra_ve_ca_web() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from public.app_migrations where file = '158_tra_ve_ca_web_tu_ghi.sql') then
    perform public.app__stc_tra_ve_ca_web();
  end if;
end $$;

insert into public.app_migrations(file) values ('158_tra_ve_ca_web_tu_ghi.sql') on conflict (file) do nothing;
