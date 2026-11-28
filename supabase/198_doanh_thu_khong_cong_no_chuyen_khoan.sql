-- 198 (anh Tiến duyệt 28/11/2026: "sửa luật, chạy thử rồi chạy thật"): LUẬT TỰ ĐỐI SOÁT — DOANH THU KHÔNG CỘNG NỢ CHUYỂN KHOẢN.
--  app__ca_green coi Doanh thu khớp khi doanh thu = tiền mặt + chuyển khoản + nợ mới của ca. Luật viết khi chỉ có nợ hoá đơn; từ khi có nợ loại
--  'ck' (bước 159: khách đã bấm chuyển khoản trên máy nhưng tiền chưa về — đã nằm trong pos_transfer) thì cộng nhầm lần nữa → mọi ca có nợ
--  chuyển khoản bị coi là "Doanh thu không khớp": không tự đóng dấu, và lần xét lại 27/11 gỡ dấu tự động + mở lại ca (LHP Tối 17/11, Chiều 19/11).
--  Kiểm trên số thật 28/11: cả 12 ca có nợ 'ck' đều có doanh thu = tiền mặt + chuyển khoản (+ nợ hoá đơn), app__stc_ds_state ('dt') đã coi là khớp.
--  Sửa: chỉ cộng nợ loại hoá đơn (kind 'bill' / trống). Chỉ đổi đúng một điều kiện; phần còn lại giữ nguyên bản đang chạy (pg_get_functiondef 28/11).
--  Sau đó xét lại (app__ca_auto_green) các ca có nợ 'ck' đang thiếu dấu Doanh thu và chưa "Đã đối soát" — bỏ qua ca mà lần xét lại sẽ gỡ dấu
--  (ca quản lý đang làm dở sau khi Mở lại).
--  Vùng khoá tiền đối soát (đã báo anh Tiến trong chat 28/11). Không đổi số tiền / phiếu nào. Chạy lại nhiều lần không sao.

CREATE OR REPLACE FUNCTION public.app__ca_green(p_id bigint)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb := public.app__ca_eff(p_id); m jsonb := public.app__ca_money(p_id); g text[] := '{}'; debt_new bigint; fx boolean; h jsonb;
        sua boolean; f_tm bigint; f_ck bigint; c_tm bigint; c_ck bigint;
begin
  if nullif(e ->> 'rev_start', '') is not null and nullif(e ->> 'rev_end', '') is not null and (e ->> 'rev_end') > (e ->> 'rev_start') then g := g || 'thoi_gian'::text; end if;
  -- tệp 198: chỉ nợ HOÁ ĐƠN mới là doanh thu chưa thu tiền; nợ chuyển khoản / tiền mặt (khách đã bấm trả trên máy, tiền chưa về) đã nằm trong
  --   pos_transfer / pos_cash → không cộng thêm (trước đây cộng nhầm nên ca có nợ chuyển khoản luôn bị coi là Doanh thu không khớp)
  select coalesce(sum(amount), 0) into debt_new from public.shift_debts where report_id = p_id and coalesce(kind, 'bill') = 'bill';
  fx := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and (jsonb_array_length(coalesce(f.diff, '[]')) > 0 or jsonb_array_length(coalesce(f.fixed, '[]')) > 0));
  h := public.app__ca_hand(p_id);
  -- bước 61: Fabi có hóa đơn sửa / xóa → Doanh thu để quản lý xem (không tự duyệt)
  sua := exists (select 1 from public.fabi_shifts f where f.report_id = p_id and jsonb_array_length(coalesce(f.sua, '[]')) > 0);
  if (e ->> 'total_revenue')::bigint = coalesce((e ->> 'pos_cash')::bigint, 0) + coalesce((e ->> 'pos_transfer')::bigint, 0) + debt_new
     and nullif(e ->> 'cups', '') is not null and coalesce(h ->> 'state', '') <> 'lech' and not fx and not sua then g := g || 'doanh_thu'::text; end if;
  if abs((m ->> 'tm_left')::bigint) <= 5000 then g := g || 'tien_mat'::text; end if;
  if abs((m ->> 'ck_left')::bigint) <= 5000 then g := g || 'chuyen_khoan'::text; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(e -> 'moves', '[]')) x where x ->> 'auto' is null) then g := g || 'thu_chi'::text; end if;
  -- bước 61: khách trả nợ cũ theo file Fabi (tiền mặt / chuyển khoản) phải khớp khoản "khách đã trả" nhân viên chọn trong ca
  select coalesce(sum((t ->> 'amount')::bigint) filter (where lower(t ->> 'method') !~ '(chuyển|chuyen)'), 0),
         coalesce(sum((t ->> 'amount')::bigint) filter (where lower(t ->> 'method') ~ '(chuyển|chuyen)'), 0)
    into f_tm, f_ck from public.fabi_shifts f, jsonb_array_elements(coalesce(f.tra_no, '[]')) t where f.report_id = p_id;
  select coalesce(sum(amount) filter (where collect_kind = 'tien_mat'), 0), coalesce(sum(amount) filter (where collect_kind = 'chuyen_khoan'), 0)
    into c_tm, c_ck from public.shift_debts where closed_report_id = p_id and coalesce(kind, 'bill') <> 'muon';
  -- bước 96: từ ca 15/11/2026 Fabi không ghi khách trả nợ → không so với file Fabi
  if not public.app__fabi_tra_no_on((select work_date from public.shift_reports where id = p_id)) or (f_tm = c_tm and f_ck = c_ck) then g := g || 'cong_no'::text; end if;
  return g;
end $function$;

do $$
declare x record; rep text := ''; t0 text; t1 text;
begin
  for x in
    select r.id from public.shift_reports r
     where r.status = 'hoan_thanh' and r.recon_status is distinct from 'hoan_thanh' and r.work_date >= '2026-11-01'
       and exists (select 1 from public.shift_debts sd where sd.report_id = r.id and coalesce(sd.kind, 'bill') not in ('bill', 'muon'))
       and not exists (select 1 from public.shift_report_checks c where c.report_id = r.id and c.item = 'doanh_thu')
       and not public.app__fin_locked(r.branch_id, r.work_date)
     order by r.work_date, r.id
  loop
    -- chỉ xét lại ca mà lần xét này KHÔNG gỡ dấu nào (vd ca quản lý vừa Mở lại đang làm dở, dấu Thu chi tự động sẽ bị gỡ) — ca đó để quản lý Hoàn thành
    continue when exists (select 1 from public.shift_report_checks c where c.report_id = x.id and c.auto = 1 and not (c.item = any(public.app__ca_green(x.id)))
                             and not (c.item = 'thu_chi' and exists (select 1 from public.stc_ca_done dn where dn.report_id = x.id)));
    t0 := (select recon_status || ' [' || coalesce((select string_agg(c.item, ',' order by c.item) from public.shift_report_checks c where c.report_id = x.id), '') || ']' from public.shift_reports where id = x.id);
    rep := rep || ' | ca ' || x.id || ': ' || public.app__ca_auto_green(x.id);
    t1 := (select recon_status || ' [' || coalesce((select string_agg(c.item, ',' order by c.item) from public.shift_report_checks c where c.report_id = x.id), '') || ']' from public.shift_reports where id = x.id);
    rep := rep || ' ' || t0 || ' → ' || t1;
  end loop;
  if rep <> '' then perform public.app_log('xet_lai_doanh_thu_198', left(rep, 900)); end if;
  --@@REPORT@@
end $$;

insert into public.app_migrations(file) values ('198_doanh_thu_khong_cong_no_chuyen_khoan.sql') on conflict (file) do nothing;
