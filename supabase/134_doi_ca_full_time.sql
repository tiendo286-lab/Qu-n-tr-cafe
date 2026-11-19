-- Bước 134 (kiểm toán giao diện 19/11/2026, lỗi UI-32): đổi ca thường ↔ FULL TIME trong MỘT lệnh.
-- Trước đây web gửi 2 lệnh riêng (gỡ ở ca cũ rồi xếp ở ca mới); lệnh 2 lỗi thì người đó bị gỡ khỏi lịch.
-- Hai hàm dưới gọi lại đúng hàm cũ (app_assign / app_master_cell, giữ nguyên mọi kiểm tra quyền + khoá xếp lịch)
-- nhưng trong cùng một giao dịch: lỗi ở bước nào thì cả hai bước cùng hoàn tác.
-- Chạy lại nhiều lần không sao.

-- Lịch cơ sở: gỡ p_prev ở ca p_from_shift, xếp p_emp vào ca p_to_shift (cùng ô: ngày, vị trí, hàng)
create or replace function public.app_assign_doi_ca(p_week bigint, p_branch bigint, p_day int, p_from_shift text, p_to_shift text,
                                                    p_role text, p_slot int, p_emp bigint, p_prev bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_prev is not null then
    r := public.app_assign(p_week, p_branch, p_day, p_from_shift, p_role, p_slot, null, p_prev);
  end if;
  if p_emp is not null then
    r := public.app_assign(p_week, p_branch, p_day, p_to_shift, p_role, p_slot, p_emp, null);
  end if;
  if r is null then   -- không có gì để đổi: vẫn kiểm quyền như hàm cũ
    perform public.app__check_edit(p_week);
    r := jsonb_build_object('version', (select updated_at from public.schedule_closures where week_id = p_week));
  end if;
  return r;
end $$;

-- Lịch tổng: gỡ ô của nhân viên ở ca p_from_shift, rồi đặt ô ca p_shift (p_branch null = để trống)
create or replace function public.app_master_cell_doi_ca(p_week bigint, p_emp bigint, p_day int, p_from_shift text, p_shift text,
                                                         p_branch bigint, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.app_master_cell(p_week, p_emp, p_day, p_from_shift, null, null);
  perform public.app_master_cell(p_week, p_emp, p_day, p_shift, p_branch, p_role);
end $$;

revoke all on function public.app_assign_doi_ca(bigint, bigint, int, text, text, text, int, bigint, bigint),
  public.app_master_cell_doi_ca(bigint, bigint, int, text, text, bigint, text) from public, anon;
grant execute on function public.app_assign_doi_ca(bigint, bigint, int, text, text, text, int, bigint, bigint),
  public.app_master_cell_doi_ca(bigint, bigint, int, text, text, bigint, text) to authenticated;

insert into public.app_migrations(file) values ('134_doi_ca_full_time.sql') on conflict (file) do nothing;
