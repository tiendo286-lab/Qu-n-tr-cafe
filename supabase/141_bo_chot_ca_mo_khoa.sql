-- Bước 158 (19/11/2026, VÙNG KHOÁ — anh Tiến chốt trong chat, đã bỏ mật khẩu): BỎ HẲN "Chốt ca" vĩnh viễn (tệp 135);
-- khoá cuối cùng là Chốt tháng (chỉ Chủ mở lại — app_fin_reopen không đổi). "Mở lại xác nhận" Fabi (mở khoá chốt tiền của ca)
-- cho Quản lý cơ sở / Quản lý tổng / Chủ: không gọi app_ca_recon_reopen / app_ca_item_reopen (hai hàm chỉ cho Chủ) nữa.
-- Thiết kế: tai_lieu/superpowers/specs/2026-11-19-bo-chot-ca-mo-khoa-design.md. Bài thử: kiem_tra/bo_chot_ca_141.sql. Chạy lại nhiều lần không sao.

-- 1. Bỏ khoá Chốt ca trên mọi bảng
do $$
declare t regclass;
begin
  for t in select tgrelid::regclass from pg_trigger where tgname = 'stc_final_guard' loop
    execute format('drop trigger if exists stc_final_guard on %s', t);
  end loop;
end $$;
delete from public.stc_ca_finals;   -- giữ bảng (sao lưu cũ còn), không còn ca nào bị khoá

create or replace function public.app_stc_ca_final(p_report bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Đã bỏ Chốt ca (19/11/2026) — khoá cuối cùng là Chốt tháng. Tải lại trang để dùng bản mới.';
end $$;

create or replace function public.app_stc_finals(p_branch bigint, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.app_account() is null or (public.app_account()).id is null then raise exception 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.'; end if;
  return jsonb_build_object('finals', '[]'::jsonb, 'treo', '[]'::jsonb);
end $$;

-- 2. Mở lại xác nhận Fabi: ai được (Chủ / Quản lý tổng / quản lý đối soát cơ sở, tháng chưa chốt) do app__stc_ds_need quyết
create or replace function public.app_stc_ds_reopen(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; rs text := public.app__stc_reason(p_reason);
  why text; it text; skip text[] := '{}';
begin
  r := public.app__stc_ds_need(p_report, false);
  why := 'Mở lại chốt tiền ca: ' || rs;
  perform 1 from public.shift_reports where id = p_report for update;
  if r.recon_status = 'hoan_thanh' then   -- ca đối soát xong theo cách cũ: mở lại mọi mục như "Mở lại cả phiếu" (bỏ qua mục có khoản âm đã xử lý)
    for it in select item from public.shift_report_checks where report_id = p_report and item not in ('tien_mat', 'chuyen_khoan') loop
      begin
        perform public.app__ca_item_reopen(p_report, it, a.id, why);
      exception when others then skip := skip || it;
      end;
    end loop;
    update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = p_report and recon_status = 'hoan_thanh';
    insert into public.shift_recon_log(report_id, action, reason, by_account)
    values (p_report, 'mo_lai_doi_soat', why || case when cardinality(skip) > 0
      then ' (giữ: ' || (select string_agg(public.app__ca_item_label(x), ', ') from unnest(skip) x) || ')' else '' end, a.id);
  end if;
  -- mục tiền: báo lỗi rõ nếu có khoản âm đã xử lý (như cũ)
  foreach it in array array['tien_mat', 'chuyen_khoan'] loop
    if exists (select 1 from public.shift_report_checks c where c.report_id = p_report and c.item = it) then
      perform public.app__ca_item_reopen(p_report, it, a.id, why);
    end if;
  end loop;
  perform public.app_log('stc_mo_lai_chot', 'report=' || p_report || ' · ' || rs);
end $$;
revoke all on function public.app_stc_ds_reopen(bigint, text) from public, anon;
grant execute on function public.app_stc_ds_reopen(bigint, text) to authenticated;

insert into public.app_migrations(file) values ('141_bo_chot_ca_mo_khoa.sql') on conflict (file) do nothing;
