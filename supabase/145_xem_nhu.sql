-- 145: Xem như người khác (bước 165, 19/11/2026) — chỉ Chủ, chỉ xem, tự hết hạn sau 30 phút.
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-19-xem-nhu-nguoi-khac-design.md · Kế hoạch: tai_lieu/superpowers/plans/2026-11-19-xem-nhu-nguoi-khac.md
-- VÙNG KHOÁ: app_account() là gốc của app_can / app_me → đổi kết quả quyền trong lúc Chủ đang xem như. Đã báo anh Tiến trước khi chạy.
-- - Gắn theo phiên đăng nhập (JWT session_id): máy / thẻ khác của Chủ không bị đổi.
-- - Trong lúc xem như: hàm chạy trước mọi yêu cầu (pgrst.db_pre_request) bật chế độ chỉ đọc của CSDL, trừ app_view_as_start / app_view_as_stop.
-- Chạy lại nhiều lần không sao.

create table if not exists public.view_as (
  session_id text primary key,
  owner_account_id bigint not null,
  target_account_id bigint not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.view_as enable row level security;
revoke all on table public.view_as from anon, authenticated;

-- Tài khoản THẬT đang đăng nhập (đúng thân app_account() cũ, tệp 02)
create or replace function public.app__real_account() returns public.accounts
language sql stable security definer set search_path = public as $$
  select a.* from public.accounts a
  left join public.employees e on e.id = a.employee_id
  where a.auth_user_id = auth.uid()
    and a.locked = 0
    and (a.employee_id is null or e.status = 'Đang làm')
  limit 1
$$;

-- Phiên xem như còn hạn của Chủ thật (null nếu không có). Người không phải Chủ: không tra gì thêm.
create or replace function public.app__view_as_row(r public.accounts) returns public.view_as
language plpgsql stable security definer set search_path = public as $$
declare sid text; v public.view_as;
begin
  if r.id is null or coalesce(r.system_role, '') <> 'chu' then return v; end if;
  begin sid := nullif(auth.jwt() ->> 'session_id', ''); exception when others then sid := null; end;
  if sid is null then return v; end if;
  select * into v from public.view_as x where x.session_id = sid and x.owner_account_id = r.id and x.expires_at > now();
  return v;
end $$;

-- Gốc của mọi kiểm tra quyền: Chủ đang xem như → tài khoản người được xem (còn làm, không khoá, không phải Chủ)
create or replace function public.app_account() returns public.accounts
language plpgsql stable security definer set search_path = public as $$
declare r public.accounts := public.app__real_account(); v public.view_as; t public.accounts;
begin
  if r.id is null or coalesce(r.system_role, '') <> 'chu' then return r; end if;
  v := public.app__view_as_row(r);
  if v.session_id is null then return r; end if;
  select a.* into t from public.accounts a left join public.employees e on e.id = a.employee_id
   where a.id = v.target_account_id and a.locked = 0 and (a.employee_id is null or e.status = 'Đang làm') and coalesce(a.system_role, '') <> 'chu';
  if t.id is not null then return t; end if;
  return r;
end $$;

-- Hàm chạy trước mọi yêu cầu của web: phiên đang xem như → chỉ đọc (trừ Bắt đầu / Thoát xem như). Lỗi gì cũng bỏ qua để không làm chết web.
-- KHÔNG đặt "set search_path" cho hàm này: hàm có SET … sẽ tự hoàn lại mọi set_config khi kết thúc → chỉ đọc không giữ được. Tên đều ghi đủ lược đồ.
create or replace function public.app__pre_request() returns void
language plpgsql security definer as $$
declare v public.view_as; p text; ro boolean := false;
begin
  begin   -- dò phiên xem như trong khối bắt lỗi (lỗi gì cũng bỏ qua)
    v := public.app__view_as_row(public.app__real_account());
    p := coalesce(pg_catalog.current_setting('request.path', true), '');
    ro := v.session_id is not null and p not in ('/rpc/app_view_as_start', '/rpc/app_view_as_stop');
  exception when others then ro := false;
  end;
  -- bật chỉ đọc NGOÀI khối bắt lỗi: transaction_read_only đặt trong khối con bị hoàn lại khi khối kết thúc
  if ro then perform pg_catalog.set_config('transaction_read_only', 'on', true); end if;
end $$;

-- Ghi nhật ký dưới tên Chủ THẬT (app_log dùng app_account() → sẽ ra tên người đang được xem)
create or replace function public.app__view_as_log(p_owner bigint, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log(account_id, action, detail) values (p_owner, 'xem_nhu', p_detail)
$$;

create or replace function public.app_view_as_people() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.accounts := public.app__real_account();
begin
  if r.id is null or coalesce(r.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ dùng được Xem như người khác.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('account_id', a.id, 'name', coalesce(e.name, a.display_name, a.login_name), 'code', coalesce(e.code, a.login_name),
      'role', a.system_role,
      'branches', coalesce((select jsonb_agg(coalesce(b.display_code, b.code) order by b.sort_order, b.id) from public.branches b
                             where a.system_role = 'ql' and a.id = any(coalesce(public.app__pc_who(1, 'branch', b.id), '{}'::bigint[]))), '[]'::jsonb),
      'ke_toan', exists (select 1 from public.account_perms x where x.account_id = a.id and x.perm = 'ke_toan'))
      order by array_position(array['ql_tong', 'ql', 'ke_toan', 'nv'], a.system_role), coalesce(e.name, a.display_name))
    from public.accounts a left join public.employees e on e.id = a.employee_id
   where a.locked = 0 and (a.employee_id is null or e.status = 'Đang làm') and coalesce(a.system_role, '') <> 'chu'), '[]'::jsonb);
end $$;

create or replace function public.app_view_as_start(p_account bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.accounts := public.app__real_account(); sid text; t public.accounts; nm text;
begin
  if r.id is null or coalesce(r.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ dùng được Xem như người khác.'; end if;
  begin sid := nullif(auth.jwt() ->> 'session_id', ''); exception when others then sid := null; end;
  if sid is null then raise exception 'Phiên đăng nhập không hợp lệ, hãy đăng nhập lại.'; end if;
  select a.* into t from public.accounts a left join public.employees e on e.id = a.employee_id
   where a.id = p_account and a.locked = 0 and (a.employee_id is null or e.status = 'Đang làm');
  if t.id is null then raise exception 'Tài khoản này đang khoá hoặc đã nghỉ làm — không xem như được.'; end if;
  if coalesce(t.system_role, '') = 'chu' then raise exception 'Không xem như tài khoản Chủ.'; end if;
  delete from public.view_as where expires_at < now() - interval '1 day';
  insert into public.view_as(session_id, owner_account_id, target_account_id, started_at, expires_at)
  values (sid, r.id, t.id, now(), now() + interval '30 minutes')
  on conflict (session_id) do update set owner_account_id = excluded.owner_account_id, target_account_id = excluded.target_account_id,
    started_at = excluded.started_at, expires_at = excluded.expires_at;
  select coalesce(e.name, t.display_name, t.login_name) into nm from public.employees e where e.id = t.employee_id;
  perform public.app__view_as_log(r.id, 'bắt đầu xem như #' || t.id || ' ' || coalesce(nm, t.display_name, t.login_name, '') || ' (' || coalesce(t.system_role, '') || ')');
end $$;

create or replace function public.app_view_as_stop() returns void
language plpgsql security definer set search_path = public as $$
declare r public.accounts := public.app__real_account(); sid text; n int;
begin
  if r.id is null then return; end if;
  begin sid := nullif(auth.jwt() ->> 'session_id', ''); exception when others then sid := null; end;
  if sid is null then return; end if;
  delete from public.view_as where session_id = sid and owner_account_id = r.id;
  get diagnostics n = row_count;
  if n > 0 then perform public.app__view_as_log(r.id, 'thoát xem như'); end if;
end $$;

-- app_me: thêm view_as (dải vàng trên web). Giữ nguyên phần cũ (tệp 06).
create or replace function public.app_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; e public.employees; perms jsonb := '{}'::jsonb; p text; v public.view_as; va jsonb;
begin
  a := public.app_account();
  if a.id is null then return null; end if;
  select * into e from public.employees where id = a.employee_id;
  foreach p in array public.app__perm_keys() loop
    perms := perms || jsonb_build_object(p, public.app_can(p));
  end loop;
  v := public.app__view_as_row(public.app__real_account());   -- bước 165
  if v.session_id is not null and v.target_account_id = a.id then
    va := jsonb_build_object('account_id', a.id, 'name', coalesce(e.name, a.display_name, a.login_name), 'role', a.system_role,
      'branches', coalesce((select jsonb_agg(coalesce(b.display_code, b.code) order by b.sort_order, b.id) from public.branches b
                             where a.system_role = 'ql' and a.id = any(coalesce(public.app__pc_who(1, 'branch', b.id), '{}'::bigint[]))), '[]'::jsonb),
      'ke_toan', exists (select 1 from public.account_perms x where x.account_id = a.id and x.perm = 'ke_toan'),
      'expires_at', to_char(v.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  end if;
  return jsonb_build_object(
    'account_id', a.id, 'employee_id', a.employee_id, 'role', a.system_role, 'must_change', a.must_change = 1,
    'code', coalesce(e.code, a.login_name), 'name', coalesce(e.name, a.display_name, 'Chủ'), 'rank', e.rank,
    'perms', perms, 'view_as', va);
end $$;

-- Chính sách đọc bảng tài khoản: "dòng của mình" theo người đang được xem
drop policy if exists doc on public.accounts;
create policy doc on public.accounts for select to authenticated
  using ((auth_user_id = (select (public.app_account()).auth_user_id)) or (select public.app_can('quan_ly_nhan_vien')) or (select public.app_can('phan_quyen')));

-- Quyền
revoke all on function public.app__real_account(), public.app__view_as_row(public.accounts), public.app__view_as_log(bigint, text) from public, anon, authenticated;
revoke all on function public.app_view_as_people(), public.app_view_as_start(bigint), public.app_view_as_stop() from public, anon;
grant execute on function public.app_view_as_people(), public.app_view_as_start(bigint), public.app_view_as_stop(), public.app_account(), public.app_me() to authenticated;
-- PostgREST gọi hàm chạy trước dưới vai của yêu cầu (anon / authenticated) → PHẢI cấp, không thì mọi yêu cầu web đều lỗi.
-- Vô hại: chỉ bật chỉ đọc cho đúng phiên đang xem như của Chủ.
grant execute on function public.app__pre_request() to anon, authenticated;

-- Đăng ký hàm chạy trước mọi yêu cầu (PostgREST)
alter role authenticator set pgrst.db_pre_request to 'public.app__pre_request';
notify pgrst, 'reload config';

insert into public.app_migrations(file) values ('145_xem_nhu.sql') on conflict (file) do nothing;
