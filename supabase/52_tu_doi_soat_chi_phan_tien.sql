-- =====================================================================
-- BƯỚC 52: TỰ ĐỐI SOÁT CHỈ PHẦN TIỀN (anh Tiến chốt 12/11/2026). Chạy sau 51. Chạy lại không sao.
--  * File Fabi + ngân hàng không có thông tin nhân viên → web chỉ tự duyệt 6 mục tiền (thời gian, doanh thu & số cốc,
--    tiền mặt, chuyển khoản, thu chi, công nợ). Nhân viên trong ca, Bàn giao, Nhập hàng do quản lý duyệt
--    (nút "Duyệt các mục xanh" vẫn duyệt 1 lần). Quản lý duyệt xong mục cuối → phiếu tự hoàn thành như cũ.
--  * Bỏ khoá mục Nhân viên / Bàn giao web đã tự duyệt ở bước 51 (trở lại chờ quản lý duyệt).
-- =====================================================================

-- Thay bản 51: chỉ xét các mục tiền
create or replace function public.app__ca_green(p_id bigint) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare e jsonb := public.app__ca_eff(p_id); m jsonb := public.app__ca_money(p_id); g text[] := '{}'; debt_new bigint; fx boolean; h jsonb;
begin
  if nullif(e ->> 'rev_start', '') is not null and nullif(e ->> 'rev_end', '') is not null and (e ->> 'rev_end') > (e ->> 'rev_start') then g := g || 'thoi_gian'::text; end if;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  fx := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and (jsonb_array_length(coalesce(f.diff, '[]')) > 0 or jsonb_array_length(coalesce(f.fixed, '[]')) > 0));
  h := public.app__ca_hand(p_id);
  if (e ->> 'total_revenue')::bigint = coalesce((e ->> 'pos_cash')::bigint, 0) + coalesce((e ->> 'pos_transfer')::bigint, 0) + debt_new
     and nullif(e ->> 'cups', '') is not null and coalesce(h ->> 'state', '') <> 'lech' and not fx then g := g || 'doanh_thu'::text; end if;
  if (m ->> 'tm_left')::bigint = 0 then g := g || 'tien_mat'::text; end if;
  if (m ->> 'ck_left')::bigint = 0 then g := g || 'chuyen_khoan'::text; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(e -> 'moves', '[]')) x where x ->> 'auto' is null) then g := g || 'thu_chi'::text; end if;
  g := g || 'cong_no'::text;
  return g;
end $$;
revoke execute on function public.app__ca_green(bigint) from public, anon, authenticated;

-- Bỏ khoá Nhân viên / Bàn giao web đã tự duyệt (bước 51)
do $$
declare x record;
begin
  perform set_config('app.ca_auto', '1', true);
  for x in select c.report_id, c.item, r.recon_status from public.shift_report_checks c join public.shift_reports r on r.id = c.report_id
            where c.auto = 1 and c.item in ('nhan_su', 'ban_giao') loop
    delete from public.shift_report_checks where report_id = x.report_id and item = x.item;
    insert into public.shift_recon_log(report_id, action, field, reason, by_account)
    values (x.report_id, 'mo_khoa', x.item, 'Web chỉ tự đối soát phần tiền — mục này quản lý duyệt', null);
    if x.recon_status = 'hoan_thanh' then
      update public.shift_reports set recon_status = 'mo_lai', recon_by = null, recon_at = null where id = x.report_id and recon_status = 'hoan_thanh';
      insert into public.shift_recon_log(report_id, action, reason, by_account) values (x.report_id, 'mo_lai_doi_soat', 'Web chỉ tự đối soát phần tiền — chờ quản lý duyệt Nhân viên / Bàn giao', null);
    end if;
  end loop;
  perform set_config('app.ca_auto', '', true);
end $$;
