-- =====================================================================
-- BƯỚC 40: QUYỀN KẾ TOÁN CỘNG THÊM CHO TỪNG NHÂN VIÊN (anh Tiến chốt 11/11/2026). Chạy sau 39. Chạy lại nhiều lần không sao.
--  * Chủ bật "Kế toán" cho 1 tài khoản ở trang Phân quyền: người đó giữ nguyên vai trò (Nhân viên / Quản lý…),
--    được thêm tab Kế toán (Hóa đơn giao hàng, Chuyển khoản thực nhận). Vai trò Kế toán riêng (chỉ làm kế toán) vẫn giữ.
-- =====================================================================

create table if not exists public.account_perms (
  account_id bigint not null references public.accounts(id) on delete cascade,
  perm text not null check (perm in ('ke_toan')),
  granted_by bigint,
  granted_at text not null default public.vn_now_text(),
  primary key (account_id, perm)
);
alter table public.account_perms enable row level security;
revoke all on public.account_perms from anon, authenticated;

create or replace function public.app_can(p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts;
begin
  a := public.app_account();
  if a.id is null then return false; end if;
  if a.system_role = 'chu' then return true; end if;
  -- Quyền Kế toán cộng thêm cho từng tài khoản (bước 40): giữ vai trò cũ, thêm tab Kế toán
  if p = 'ke_toan' and coalesce(a.locked, 0) = 0 and exists (select 1 from public.account_perms x where x.account_id = a.id and x.perm = 'ke_toan') then return true; end if;
  if p in ('phan_quyen', 'xoa_du_lieu_tuan', 'du_lieu') then return false; end if;
  -- Kế toán: chỉ tab Kế toán (+ nhận việc được giao)
  if a.system_role = 'ke_toan' then return p in ('ke_toan', 'nhan_viec'); end if;
  if p = 'ke_toan' then return false; end if;
  if p = 'chot_ca' then return true; end if;                                    -- ai cũng chốt ca được
  if p = 'nhan_viec' then return true; end if;                                  -- ai cũng nhận việc được giao
  if p = 'xu_ly_ho_tro' then return a.system_role in ('ql_tong', 'ql'); end if;
  if a.system_role = 'nv' then
    if p in ('order_ca', 'xem_lich_minh') then return true; end if;
    if p <> 'xem_tat_ca' then return false; end if;
  end if;
  return coalesce((select r.allowed = 1 from public.role_permissions r where r.role = a.system_role and r.perm = p), false);
end $$;

-- Danh sách quyền cộng thêm (trang Phân quyền)
create or replace function public.app_account_perms() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('phan_quyen');
  return coalesce((select jsonb_agg(jsonb_build_object('account_id', x.account_id, 'perm', x.perm, 'granted_at', x.granted_at,
                     'granted_by', public.app__acc_name(x.granted_by))) from public.account_perms x), '[]');
end $$;

create or replace function public.app_set_account_perm(p_account bigint, p_perm text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts; t public.accounts;
begin
  a := public.app__need('phan_quyen');
  if p_perm not in ('ke_toan') then raise exception 'Quyền không hợp lệ.'; end if;
  select * into t from public.accounts where id = p_account;
  if t.id is null then raise exception 'Không tìm thấy tài khoản.'; end if;
  if t.system_role in ('chu', 'ke_toan') then raise exception 'Tài khoản này đã có sẵn quyền Kế toán.'; end if;
  if coalesce(p_on, false) then
    insert into public.account_perms(account_id, perm, granted_by) values (p_account, p_perm, a.id) on conflict do nothing;
    perform public.app__notify(p_account, 'Bạn được cấp quyền Kế toán', 'Bạn vào được tab Kế toán (Hóa đơn giao hàng, Chuyển khoản thực nhận). Các chức năng cũ giữ nguyên.', '/ke-toan/hoa-don');
  else
    delete from public.account_perms where account_id = p_account and perm = p_perm;
  end if;
  perform public.app_log('quyen_cong_them', 'account=' || p_account || ' ' || p_perm || '=' || coalesce(p_on, false));
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('app_can', 'app_account_perms', 'app_set_account_perm') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
