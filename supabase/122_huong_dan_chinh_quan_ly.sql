-- Người hướng dẫn chính của phiếu đào tạo chỉ là nhân viên cấp Quản lý; bắt buộc chọn khi tạo phiếu (chốt 18/11/2026).
-- Chặn ngay tại bảng nên áp dụng cho cả app_dt_create và app_dt_update. Phiếu cũ chỉ bị kiểm khi đổi người hướng dẫn.
-- Phân công riêng từng hạng mục (training_followups) không đổi: vẫn giao được cho nhân viên Cấp 1.
create or replace function public.app__dt_instructor_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.instructor_id is not distinct from old.instructor_id then return new; end if;
  if new.instructor_id is null then
    raise exception 'Chọn người hướng dẫn chính (nhân viên cấp Quản lý).';
  end if;
  if not exists (select 1 from public.employees e where e.id = new.instructor_id and e.rank = 'Quản lý' and e.status = 'Đang làm') then
    raise exception 'Người hướng dẫn chính phải là nhân viên cấp Quản lý đang làm.';
  end if;
  return new;
end $$;

drop trigger if exists training_instructor_guard on public.trainings;
create trigger training_instructor_guard
before insert or update of instructor_id on public.trainings
for each row execute function public.app__dt_instructor_guard();

revoke execute on function public.app__dt_instructor_guard() from public, anon, authenticated;

insert into public.app_migrations(file) values ('122_huong_dan_chinh_quan_ly.sql') on conflict (file) do nothing;
