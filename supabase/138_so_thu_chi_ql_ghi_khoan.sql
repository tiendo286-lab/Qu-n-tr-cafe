-- Bước 152 (19/11/2026, sau duyệt mã): quản lý cơ sở được giao (app__stc_can) thêm / sửa / xoá / khôi phục khoản thu chi ngoài ca ở Sổ thu chi.
-- app_stc_entry_save / app_stc_entry_delete gọi app_fin_entry_save / app_fin_entry_delete — 2 hàm này đang chỉ cho quản lý quỹ (app__fin_need),
-- nên quản lý cơ sở bị báo "không được sửa chốt tháng". Trang Thu chi cũ (đã xoá) cho mọi quản lý đối soát làm việc này.
-- Bài thử: kiem_tra/so_thu_chi_138.sql (tự hoàn tác). Chạy lại nhiều lần không sao.
create or replace function public.app__stc_fin_need(p_branch bigint) returns public.accounts
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.app__stc_can(p_branch), false) then raise exception 'Bạn không được sửa thu chi của cơ sở này.'; end if;
  return public.app_account();
end $$;
revoke all on function public.app__stc_fin_need(bigint) from public, anon, authenticated;

do $$
declare f text; d text;
begin
  foreach f in array array['public.app_fin_entry_save(bigint,jsonb)', 'public.app_fin_entry_delete(bigint)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('app__stc_fin_need(' in d) = 0 then
      if position('public.app__fin_need(' in d) = 0 then raise exception '%: không thấy app__fin_need.', f; end if;
      d := replace(d, 'public.app__fin_need(', 'public.app__stc_fin_need(');
      execute d;
    end if;
  end loop;
end $$;

insert into public.app_migrations(file) values ('138_so_thu_chi_ql_ghi_khoan.sql') on conflict (file) do nothing;
