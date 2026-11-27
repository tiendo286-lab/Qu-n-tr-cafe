-- =====================================================================
-- BƯỚC 192: CÀI ĐẶT TRANG ORDER CA (anh Tiến chốt mẫu 27/11/2026)
-- Chủ có thẻ Cài đặt ở trang Xếp lịch tuần › Order để tự chỉnh trang Order ca của nhân viên:
--   lời nhắn đầu trang · nút chọn nhanh (cả ngày / giống tuần trước) · luật khi gửi (chọn đủ ô / sửa lại trước hạn).
-- Mặc định = đúng như web đang chạy (không lời nhắn, không nút chọn nhanh, phải chọn đủ, được sửa lại).
-- Chạy lại nhiều lần không sao. Bảng mới không cấp quyền cho web; web đọc / ghi qua hàm app_*.
-- =====================================================================

create table if not exists public.order_cfg (
  id int primary key default 1 check (id = 1),
  note text not null default '',
  quick_day boolean not null default false,
  quick_copy boolean not null default false,
  require_all boolean not null default true,
  edit_after boolean not null default true,
  updated_at text,
  updated_by bigint
);
alter table public.order_cfg enable row level security;
revoke all on public.order_cfg from public, anon, authenticated;
insert into public.order_cfg(id) values (1) on conflict (id) do nothing;

-- Đọc cài đặt: mọi người đã đăng nhập (trang Order ca của nhân viên cần)
create or replace function public.app_order_cfg() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.accounts; c public.order_cfg;
begin
  a := public.app__need(null);
  select * into c from public.order_cfg where id = 1;
  return jsonb_build_object(
    'note', coalesce(c.note, ''), 'quick_day', coalesce(c.quick_day, false), 'quick_copy', coalesce(c.quick_copy, false),
    'require_all', coalesce(c.require_all, true), 'edit_after', coalesce(c.edit_after, true),
    'can_edit', coalesce(a.system_role, '') = 'chu');
end $$;

-- Lưu cài đặt: CHỈ Chủ. Gồm cả giờ mở / hết hạn lặp lại hằng tuần (4 khoá order_* của bảng settings, như trang Giờ order).
create or replace function public.app_order_cfg_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.accounts; od int; cd int; ot text; ct text; nt text;
begin
  a := public.app__need(null);
  if coalesce(a.system_role, '') <> 'chu' then raise exception 'Chỉ Chủ mới đổi được cài đặt Order ca.'; end if;
  nt := btrim(coalesce(p ->> 'note', ''));
  if length(nt) > 300 then raise exception 'Lời nhắn dài quá 300 chữ.'; end if;
  if p ? 'open_dow' then
    od := (p ->> 'open_dow')::int; cd := (p ->> 'close_dow')::int;
    ot := coalesce(p ->> 'open_time', ''); ct := coalesce(p ->> 'close_time', '');
    if od is null or cd is null or od not between 0 and 6 or cd not between 0 and 6
       or ot !~ '^([01]\d|2[0-3]):[0-5]\d$' or ct !~ '^([01]\d|2[0-3]):[0-5]\d$' then
      raise exception 'Giờ không hợp lệ. Nhập dạng giờ:phút, ví dụ 08:00.';
    end if;
    if cd < od or (cd = od and ct <= ot) then raise exception 'Giờ hết hạn phải sau giờ mở.'; end if;
    insert into public.settings(key, value) values
      ('order_open_dow', od::text), ('order_open_time', ot), ('order_close_dow', cd::text), ('order_close_time', ct)
    on conflict (key) do update set value = excluded.value;
  end if;
  update public.order_cfg set note = nt,
    quick_day = coalesce((p ->> 'quick_day')::boolean, false), quick_copy = coalesce((p ->> 'quick_copy')::boolean, false),
    require_all = coalesce((p ->> 'require_all')::boolean, true), edit_after = coalesce((p ->> 'edit_after')::boolean, true),
    updated_at = public.vn_now_text(), updated_by = a.id
  where id = 1;
  perform public.app_log('sua_cai_dat_order', left(p::text, 400));
  return public.app_order_cfg();
end $$;

revoke all on function public.app_order_cfg(), public.app_order_cfg_save(jsonb) from public, anon;
grant execute on function public.app_order_cfg(), public.app_order_cfg_save(jsonb) to authenticated;

-- Vá hàm gửi order đang chạy (thay chuỗi, không chép lại cả hàm): theo 2 luật trong cài đặt.
-- Khoá "gửi một lần" chỉ tính lần nhân viên TỰ gửi (order_submissions); ô do quản lý nhập hộ không làm khoá.
do $$
declare d text := pg_get_functiondef('public.app_submit_order(bigint,jsonb)'::regprocedure);
  c1 text := 'if n_ok < n_need then';
  m1 text := 'if n_ok < n_need and coalesce((select require_all from public.order_cfg where id = 1), true) then';
  c2 text := 'first := not public.app__has_submitted(p_week, a.employee_id);';
  m2 text := 'first := not public.app__has_submitted(p_week, a.employee_id);
  if n_ok = 0 then raise exception ''Chưa chọn ô nào. Hãy chọn ít nhất một ca rồi gửi.''; end if;
  if exists (select 1 from public.order_submissions s where s.week_id = p_week and s.employee_id = a.employee_id)
     and not coalesce((select edit_after from public.order_cfg where id = 1), true) then
    raise exception ''Bạn đã gửi order tuần này rồi. Muốn đổi thì nhờ quản lý sửa giúp.'';
  end if;';
begin
  if position('public.order_cfg' in d) > 0 then return; end if;   -- đã vá
  if (length(d) - length(replace(d, c1, ''))) / length(c1) <> 1 or (length(d) - length(replace(d, c2, ''))) / length(c2) <> 1 then
    raise exception 'Tệp 192: app_submit_order không có đúng chỗ cần vá — dừng, không đổi gì.';
  end if;
  execute replace(replace(d, c1, m1), c2, m2);
end $$;

insert into public.app_migrations(file) values ('192_cai_dat_order_ca.sql') on conflict (file) do nothing;
