-- Tệp 202 — Thêm người vào ca: nhân viên quán · nhân viên cũ · NGƯỜI NGOÀI (anh Tiến duyệt 28/11/2026).
--
-- Người ngoài = một hồ sơ gọn trong employees: is_outsider = true, trạng thái 'Ngừng làm' (không lịch, không đánh giá, không đào tạo),
--   cấp bậc 'Người ngoài', trả lương tiền mặt, KHÔNG có tài khoản. Nhờ vậy mọi hàm đang nối người làm của ca với hồ sơ nhân viên
--   (giờ đến / về, bảng công, tiền két) chạy nguyên — tệp này KHÔNG sửa hàm tính tiền, KHÔNG sửa quyền.
-- Trả công người ngoài: khoản Chi ra "Chi lương + tên" của ca như đang làm với người hỗ trợ; trả hôm khác thì ghi ở ca hôm trả.
--   Web không theo dõi nợ công (anh Tiến chọn cách 1).
-- Chạy lại nhiều lần không sao.

alter table public.employees add column if not exists is_outsider boolean not null default false;

-- Danh sách chọn người làm hộ: thêm nhóm 'outside'; nhóm 'former' không gồm người ngoài. Quyền như cũ (chot_ca — ai cũng có).
create or replace function public.app_ca_helpers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('chot_ca');
  return (
    with e as (
      select x.status, x.is_outsider, x.code,
             jsonb_build_object('id', x.id, 'code', x.code, 'name', x.name, 'rank', x.rank, 'pay_cash', x.pay_cash,
               'branches', coalesce((select jsonb_agg(eb.branch_id) from public.employee_branches eb where eb.employee_id = x.id), '[]'::jsonb)) j
        from public.employees x)
    select jsonb_build_object(
      'active',  coalesce((select jsonb_agg(j order by code) from e where status = 'Đang làm'), '[]'::jsonb),
      'former',  coalesce((select jsonb_agg(j order by code) from e where status <> 'Đang làm' and not is_outsider), '[]'::jsonb),
      'outside', coalesce((select jsonb_agg(j order by j ->> 'name') from e where status <> 'Đang làm' and is_outsider), '[]'::jsonb)));
end $$;
revoke execute on function public.app_ca_helpers() from public, anon;
grant execute on function public.app_ca_helpers() to authenticated;

-- Người chốt ca / đối soát tạo nhanh một người ngoài. Trùng tên (không kể hoa thường, dấu cách thừa) → trả hồ sơ cũ.
create or replace function public.app_ca_outsider_add(p_name text, p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
        ph text := nullif(btrim(coalesce(p_phone, '')), ''); eid bigint; n int := 1; v_code text; existed boolean := false;
begin
  perform public.app__need('chot_ca');
  if length(nm) < 2 or length(nm) > 60 then raise exception 'Tên người ngoài từ 2 đến 60 ký tự.'; end if;
  if ph is not null and ph !~ '^[0-9 +().-]{8,20}$' then raise exception 'Số điện thoại không hợp lệ.'; end if;
  perform pg_advisory_xact_lock(hashtext('app_ca_outsider_add'));
  select e.id into eid from public.employees e where e.is_outsider and lower(e.name) = lower(nm) order by e.id limit 1;
  if eid is not null then
    existed := true;
  else
    loop
      v_code := 'NG' || lpad(n::text, 2, '0');
      exit when not exists (select 1 from public.employees e where lower(e.code) = lower(v_code))
            and not exists (select 1 from public.accounts ac where lower(ac.login_name) = lower(v_code) or lower(ac.employee_code) = lower(v_code));
      n := n + 1;
    end loop;
    insert into public.employees(code, name, rank, status, pay_cash, is_outsider)
      values (v_code, nm, 'Người ngoài', 'Ngừng làm', true, true) returning id into eid;
    -- Thêm hồ sơ thì máy chủ tự tạo một tài khoản chưa có mật khẩu (trigger employee_account) — người ngoài không dùng app nên gỡ ngay.
    delete from public.accounts where employee_id = eid;
  end if;
  if ph is not null then
    insert into public.employee_contacts(employee_id, phone) values (eid, ph)
      on conflict (employee_id) do update set phone = excluded.phone where public.employee_contacts.phone is null;
  end if;
  return (select jsonb_build_object('id', e.id, 'code', e.code, 'name', e.name, 'rank', e.rank, 'pay_cash', e.pay_cash,
                                    'branches', '[]'::jsonb, 'existed', existed) from public.employees e where e.id = eid);
end $$;
revoke execute on function public.app_ca_outsider_add(text, text) from public, anon;
grant execute on function public.app_ca_outsider_add(text, text) to authenticated;

-- Người quản lý nhân viên sửa tên người ngoài (gõ sai). Chỉ sửa hồ sơ người ngoài.
create or replace function public.app_ca_outsider_rename(p_id bigint, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare nm text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  perform public.app__need('quan_ly_nhan_vien');
  if length(nm) < 2 or length(nm) > 60 then raise exception 'Tên người ngoài từ 2 đến 60 ký tự.'; end if;
  if exists (select 1 from public.employees e where e.is_outsider and lower(e.name) = lower(nm) and e.id <> p_id) then
    raise exception 'Đã có người ngoài tên "%".', nm;
  end if;
  update public.employees set name = nm, updated_at = public.vn_now_text() where id = p_id and is_outsider;
  if not found then raise exception 'Không tìm thấy người ngoài này.'; end if;
end $$;
revoke execute on function public.app_ca_outsider_rename(bigint, text) from public, anon;
grant execute on function public.app_ca_outsider_rename(bigint, text) to authenticated;

insert into public.app_migrations(file) values ('202_nguoi_ngoai_lam_ca.sql') on conflict (file) do nothing;
