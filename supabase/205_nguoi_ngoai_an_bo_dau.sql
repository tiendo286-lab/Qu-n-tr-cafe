-- Tệp 205 — Người ngoài làm ca, 3 điểm làm nốt (anh Tiến bảo 28/11/2026 "làm nốt 3 điểm chưa làm"):
--   1. Ẩn người ngoài không còn dùng: cột outsider_hidden; danh sách chọn người (nhóm 'outside') bỏ người đã ẩn.
--      Gõ lại đúng tên người đã ẩn → dùng lại hồ sơ cũ và tự hiện lại. Lịch sử ca, bảng công của người đã ẩn giữ nguyên.
--   2. So trùng tên CÓ bỏ dấu: "Anh Nam" = "anh nam" = "Anh Năm" (hàm app__khong_dau).
--   3. Bảng công: web cần biết ai là người ngoài (kể cả đã ẩn) → app_ca_helpers trả thêm nhóm 'outside_hidden'.
-- Không sửa hàm tính tiền, không sửa quyền. Chạy lại nhiều lần không sao.

alter table public.employees add column if not exists outsider_hidden boolean not null default false;

-- Bỏ dấu tiếng Việt + chữ thường + gọn dấu cách (để so tên).
create or replace function public.app__khong_dau(p text) returns text
language sql immutable set search_path = public as $$
  select lower(regexp_replace(regexp_replace(normalize(replace(replace(btrim(coalesce(p, '')), 'đ', 'd'), 'Đ', 'D'), NFD),
                                             '[' || chr(768) || '-' || chr(879) || ']', '', 'g'), '\s+', ' ', 'g'))
$$;
revoke all on function public.app__khong_dau(text) from public, anon, authenticated;

create or replace function public.app_ca_helpers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.app__need('chot_ca');
  return (
    with e as (
      select x.status, x.is_outsider, x.outsider_hidden, x.code,
             jsonb_build_object('id', x.id, 'code', x.code, 'name', x.name, 'rank', x.rank, 'pay_cash', x.pay_cash,
               'branches', coalesce((select jsonb_agg(eb.branch_id) from public.employee_branches eb where eb.employee_id = x.id), '[]'::jsonb)) j
        from public.employees x)
    select jsonb_build_object(
      'active',  coalesce((select jsonb_agg(j order by code) from e where status = 'Đang làm'), '[]'::jsonb),
      'former',  coalesce((select jsonb_agg(j order by code) from e where status <> 'Đang làm' and not is_outsider), '[]'::jsonb),
      'outside', coalesce((select jsonb_agg(j order by j ->> 'name') from e where status <> 'Đang làm' and is_outsider and not outsider_hidden), '[]'::jsonb),
      'outside_hidden', coalesce((select jsonb_agg(j order by j ->> 'name') from e where status <> 'Đang làm' and is_outsider and outsider_hidden), '[]'::jsonb)));
end $$;
revoke execute on function public.app_ca_helpers() from public, anon;
grant execute on function public.app_ca_helpers() to authenticated;

create or replace function public.app_ca_outsider_add(p_name text, p_phone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
        ph text := nullif(btrim(coalesce(p_phone, '')), ''); eid bigint; n int := 1; v_code text; existed boolean := false;
begin
  perform public.app__need('chot_ca');
  if length(nm) < 2 or length(nm) > 60 then raise exception 'Tên người ngoài từ 2 đến 60 ký tự.'; end if;
  if ph is not null and ph !~ '^[0-9 +().-]{8,20}$' then raise exception 'Số điện thoại không hợp lệ.'; end if;
  perform pg_advisory_xact_lock(hashtext('app_ca_outsider_add'));
  select e.id into eid from public.employees e
   where e.is_outsider and public.app__khong_dau(e.name) = public.app__khong_dau(nm) order by e.outsider_hidden, e.id limit 1;
  if eid is not null then
    existed := true;
    update public.employees set outsider_hidden = false, updated_at = public.vn_now_text() where id = eid and outsider_hidden;   -- đã ẩn → hiện lại
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

create or replace function public.app_ca_outsider_rename(p_id bigint, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare nm text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  perform public.app__need('quan_ly_nhan_vien');
  if length(nm) < 2 or length(nm) > 60 then raise exception 'Tên người ngoài từ 2 đến 60 ký tự.'; end if;
  if exists (select 1 from public.employees e where e.is_outsider and public.app__khong_dau(e.name) = public.app__khong_dau(nm) and e.id <> p_id) then
    raise exception 'Đã có người ngoài tên "%".', nm;
  end if;
  update public.employees set name = nm, updated_at = public.vn_now_text() where id = p_id and is_outsider;
  if not found then raise exception 'Không tìm thấy người ngoài này.'; end if;
end $$;
revoke execute on function public.app_ca_outsider_rename(bigint, text) from public, anon;
grant execute on function public.app_ca_outsider_rename(bigint, text) to authenticated;

-- Ẩn / hiện lại người ngoài trong danh sách chọn người (người quản lý nhân viên). Không xoá gì.
create or replace function public.app_ca_outsider_hide(p_id bigint, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app__need('quan_ly_nhan_vien');
  update public.employees set outsider_hidden = coalesce(p_hidden, false), updated_at = public.vn_now_text() where id = p_id and is_outsider;
  if not found then raise exception 'Không tìm thấy người ngoài này.'; end if;
end $$;
revoke execute on function public.app_ca_outsider_hide(bigint, boolean) from public, anon;
grant execute on function public.app_ca_outsider_hide(bigint, boolean) to authenticated;

insert into public.app_migrations(file) values ('205_nguoi_ngoai_an_bo_dau.sql') on conflict (file) do nothing;
