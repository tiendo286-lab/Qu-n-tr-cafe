-- 175 — Chìa khoá CHỈ ĐỌC cho Công ty AI (anh Tiến duyệt 25/11/2026)
-- Vai ai_doc: đọc mọi bảng trong schema public, KHÔNG ghi / sửa / xoá, KHÔNG vào schema auth.
-- Không đổi web, không đổi hàm app_*, không đụng role_permissions / app_can.
-- Mật khẩu KHÔNG nằm trong tệp này: đặt riêng qua Management API (alter role ai_doc login password ...).
-- Chạy lại nhiều lần không lỗi.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_doc') then
    create role ai_doc nologin noinherit bypassrls connection limit 3;
  end if;
end $$;

alter role ai_doc set default_transaction_read_only = on;
alter role ai_doc set statement_timeout = '20s';
alter role ai_doc set idle_in_transaction_session_timeout = '60s';

grant usage on schema public to ai_doc;
grant select on all tables in schema public to ai_doc;
alter default privileges for role postgres in schema public grant select on tables to ai_doc;

insert into public.app_migrations(file) values ('175_ai_doc_chi_doc.sql') on conflict (file) do nothing;
