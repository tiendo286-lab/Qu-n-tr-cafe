-- 185 — Dọn phần Công ty AI cũ (anh Tiến duyệt Đợt 3, 27/11/2026)
-- 1) Chìa khoá chỉ đọc ai_doc không còn đọc được ai_cai_dat (có bí mật gửi thông báo) và ai_thong_bao (đăng ký thiết bị).
-- 2) Tắt hẹn giờ kiểm tra nhịp tim máy Mac (người nhận việc trên Mac đã cho nghỉ, không báo "Mac đang tắt" nữa).
-- Không xoá dữ liệu, không đổi web, không đụng role_permissions / app_can. Chạy lại nhiều lần không lỗi.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'ai_doc') then
    if to_regclass('public.ai_cai_dat') is not null then
      revoke all on table public.ai_cai_dat from ai_doc;
    end if;
    if to_regclass('public.ai_thong_bao') is not null then
      revoke all on table public.ai_thong_bao from ai_doc;
    end if;
  end if;
end $$;

do $cron$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ai-nhip-tim';
  end if;
exception when others then
  raise notice 'Không tắt được hẹn giờ ai-nhip-tim: %', sqlerrm;
end $cron$;

insert into public.app_migrations(file) values ('185_ai_don_cong_ty_cu.sql') on conflict (file) do nothing;
