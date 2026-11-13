-- =====================================================================
-- BƯỚC 61: LUẬT ĐỐI SOÁT THEO FILE FABI (anh Tiến chốt 13/11/2026). Chạy sau 60. Chạy lại không sao.
--  * Fabi có hóa đơn sửa / xóa trong ca → mục Doanh thu KHÔNG tự duyệt (quản lý xem rồi bấm "Đã xem — duyệt").
--  * Khách trả nợ cũ theo file Fabi (tiền mặt / chuyển khoản) phải bằng khoản "khách đã trả" nhân viên chọn trong ca;
--    lệch → mục Công nợ KHÔNG tự duyệt.
--  * Xét lại các phiếu chưa hoàn thành đối soát theo luật mới (phiếu đã hoàn thành giữ nguyên).
--  * "Bỏ ca": giữ chỉ phạt 200.000đ, không trừ giờ (đã chốt).
-- =====================================================================
create or replace function public.app__ca_green(p_id bigint) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare e jsonb := public.app__ca_eff(p_id); m jsonb := public.app__ca_money(p_id); g text[] := '{}'; debt_new bigint; fx boolean; h jsonb;
        sua boolean; f_tm bigint; f_ck bigint; c_tm bigint; c_ck bigint;
begin
  if nullif(e ->> 'rev_start', '') is not null and nullif(e ->> 'rev_end', '') is not null and (e ->> 'rev_end') > (e ->> 'rev_start') then g := g || 'thoi_gian'::text; end if;
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  fx := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and (jsonb_array_length(coalesce(f.diff, '[]')) > 0 or jsonb_array_length(coalesce(f.fixed, '[]')) > 0));
  h := public.app__ca_hand(p_id);
  -- bước 61: Fabi có hóa đơn sửa / xóa → Doanh thu để quản lý xem (không tự duyệt)
  sua := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and jsonb_array_length(coalesce(f.sua, '[]')) > 0);
  if (e ->> 'total_revenue')::bigint = coalesce((e ->> 'pos_cash')::bigint, 0) + coalesce((e ->> 'pos_transfer')::bigint, 0) + debt_new
     and nullif(e ->> 'cups', '') is not null and coalesce(h ->> 'state', '') <> 'lech' and not fx and not sua then g := g || 'doanh_thu'::text; end if;
  if (m ->> 'tm_left')::bigint = 0 then g := g || 'tien_mat'::text; end if;
  if (m ->> 'ck_left')::bigint = 0 then g := g || 'chuyen_khoan'::text; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(e -> 'moves', '[]')) x where x ->> 'auto' is null) then g := g || 'thu_chi'::text; end if;
  -- bước 61: khách trả nợ cũ theo file Fabi (tiền mặt / chuyển khoản) phải khớp khoản "khách đã trả" nhân viên chọn trong ca
  select coalesce(sum((t ->> 'amount')::bigint) filter (where lower(t ->> 'method') !~ '(chuyển|chuyen)'), 0),
         coalesce(sum((t ->> 'amount')::bigint) filter (where lower(t ->> 'method') ~ '(chuyển|chuyen)'), 0)
    into f_tm, f_ck from public.fabi_shifts f, jsonb_array_elements(coalesce(f.tra_no, '[]')) t where f.report_id = p_id;
  select coalesce(sum(amount) filter (where collect_kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where collect_kind = 'chuyen_khoan'), 0)
    into c_tm, c_ck from public.shift_debts where closed_report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  if f_tm = c_tm and f_ck = c_ck then g := g || 'cong_no'::text; end if;
  return g;
end $$;
revoke execute on function public.app__ca_green(bigint) from public, anon, authenticated;

-- Xét lại phiếu chưa hoàn thành đối soát theo luật mới
do $x$
declare r record;
begin
  for r in select id from public.shift_reports where status = 'hoan_thanh' and recon_status <> 'hoan_thanh' loop
    perform public.app__ca_auto_green(r.id);
  end loop;
end $x$;

insert into public.app_migrations(file) values ('61_luat_doi_soat_fabi.sql') on conflict (file) do nothing;
