-- Bước 160 (19/11/2026, anh Tiến chốt trong chat — vùng khoá, đã báo): "Mở lại xác nhận" Fabi KHÔNG bắt ghi lý do nữa
-- (ghi thì lưu, không ghi thì lưu "không ghi lý do"). Người được mở vẫn như bước 158 (Chủ / Quản lý tổng / quản lý đối soát cơ sở, tháng chưa chốt).
-- Bài thử: kiem_tra/mo_lai_khong_ly_do_143.sql. Chạy lại nhiều lần không sao.
create or replace function public.app_stc_ds_reopen(p_report bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.accounts := public.app_account(); r public.shift_reports; rs text := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'không ghi lý do');
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

insert into public.app_migrations(file) values ('143_mo_lai_khong_ly_do.sql') on conflict (file) do nothing;
