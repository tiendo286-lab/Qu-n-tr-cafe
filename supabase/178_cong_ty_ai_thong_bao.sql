-- 178 — Công ty AI: thông báo về điện thoại (Web Push của trang Công ty AI; anh Tiến chọn 25/11/2026)
-- Gửi từ phía Supabase (không từ máy Mac) để báo được cả khi máy Mac tắt: trigger khi việc sang Chờ anh / Xong / Kẹt,
-- lịch pg_cron 5 phút kiểm tra nhịp tim máy Mac. Gửi qua hàm Edge ai-thong-bao bằng pg_net.
-- Địa chỉ hàm Edge + bí mật KHÔNG nằm trong tệp này: điền riêng vào bảng ai_cai_dat (khoá edge_url, edge_bi_mat).
-- Thiếu pg_net / pg_cron / cài đặt thì không gửi, không lỗi. Chạy sau 176–177. Chạy lại nhiều lần không lỗi.

create table if not exists public.ai_thong_bao (
  id bigserial primary key,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  tao_luc timestamptz not null default now()
);
create table if not exists public.ai_cai_dat (
  khoa text primary key,
  gia_tri text not null
);
alter table public.ai_thong_bao enable row level security;
alter table public.ai_cai_dat enable row level security;
revoke all on table public.ai_thong_bao, public.ai_cai_dat from anon, authenticated, public;
revoke all on sequence public.ai_thong_bao_id_seq from anon, authenticated, public;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Không bật được pg_net (thông báo tạm không gửi): %', sqlerrm;
end $$;

create or replace function public.app_ai_dang_ky_thong_bao(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ai_can_chu();
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Đăng ký thông báo không hợp lệ';
  end if;
  insert into public.ai_thong_bao(endpoint, p256dh, auth) values (p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, tao_luc = now();
end $$;

create or replace function public.app__ai_gui_thong_bao(p_tieu_de text, p_noi_dung text, p_url text) returns boolean
language plpgsql security definer set search_path = public as $$
declare u text; bm text; subs jsonb;
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'net' and p.proname = 'http_post') then
    return false;
  end if;
  select gia_tri into u from public.ai_cai_dat where khoa = 'edge_url';
  select gia_tri into bm from public.ai_cai_dat where khoa = 'edge_bi_mat';
  if u is null or bm is null then return false; end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)) into subs from public.ai_thong_bao;
  if subs is null then return false; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using u, jsonb_build_object('subs', subs, 'tieu_de', p_tieu_de, 'noi_dung', p_noi_dung, 'url', p_url),
          jsonb_build_object('Content-Type', 'application/json', 'x-ai-bi-mat', bm);
  return true;
exception when others then
  raise notice 'Không gửi được thông báo: %', sqlerrm;
  return false;
end $$;

create or replace function public.app__ai_viec_bao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__ai_gui_thong_bao(
    coalesce((select ten from public.ai_phong where ma = new.phong), new.phong) || ': '
      || case new.trang_thai when 'cho_anh' then 'Chờ anh' when 'xong' then 'Xong' else 'Kẹt' end,
    left(new.tieu_de, 120), '#trang-dau');
  return null;
end $$;
drop trigger if exists ai_viec_bao on public.ai_viec;
create trigger ai_viec_bao after update of trang_thai on public.ai_viec
  for each row when (new.trang_thai in ('cho_anh','xong','ket') and old.trang_thai = 'dang_lam')   -- kết quả của máy Mac; không báo khi anh tự bấm
  execute function public.app__ai_viec_bao();

create or replace function public.app__ai_kiem_nhip_tim() returns void
language plpgsql security definer set search_path = public as $$
declare m public.ai_mac;
begin
  select * into m from public.ai_mac where id = 1;
  if m.lan_cuoi is null then return; end if;
  if m.lan_cuoi < now() - interval '15 minutes' and not m.da_bao_mat then
    perform public.app__ai_gui_thong_bao('Công ty AI: Mac mất kết nối',
      'Máy Mac ở nhà không trả lời từ ' || to_char(m.lan_cuoi at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') || '. Việc anh giao vẫn nằm chờ.', '#trang-dau');
    update public.ai_mac set da_bao_mat = true where id = 1;
  elsif m.lan_cuoi >= now() - interval '15 minutes' and m.da_bao_mat then
    perform public.app__ai_gui_thong_bao('Công ty AI: Mac đã kết nối lại', 'Các phòng làm tiếp việc đang chờ.', '#trang-dau');
    update public.ai_mac set da_bao_mat = false where id = 1;
  end if;
end $$;

revoke execute on function public.app__ai_gui_thong_bao(text, text, text), public.app__ai_viec_bao(), public.app__ai_kiem_nhip_tim()
  from public, anon, authenticated;
revoke execute on function public.app_ai_dang_ky_thong_bao(text, text, text) from public, anon;
grant execute on function public.app_ai_dang_ky_thong_bao(text, text, text) to authenticated;

-- hẹn giờ kiểm tra nhịp tim máy Mac (5 phút một lần)
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'ai-nhip-tim';
  perform cron.schedule('ai-nhip-tim', '*/5 * * * *', 'select public.app__ai_kiem_nhip_tim()');
exception when others then
  raise notice 'Không bật được hẹn giờ pg_cron: %', sqlerrm;
end $cron$;

insert into public.app_migrations(file) values ('178_cong_ty_ai_thong_bao.sql') on conflict (file) do nothing;
