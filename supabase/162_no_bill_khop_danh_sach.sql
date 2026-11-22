-- Chặng 4 (anh Tiến chốt 22/11/2026):
--  1) "Báo đỏ và chặn" — số Nợ bill của ca phải bằng tổng danh sách khách nợ hoá đơn của ca (khoản nợ loại HĐ ghi ở ca, như phiếu chốt ca đếm;
--     không tính nợ gán cho chênh lệch / đổi từ khoản chi / tiền đưa từ quỹ). Trước đây ô Nợ chỉ so "nợ trên phiếu" với "nợ máy Fabi": bấm
--     "Lấy số máy Fabi" khi máy ghi 0 làm nợ trên phiếu về 0 mà khách nợ thật vẫn trong danh sách → ô xanh, lệch bị giấu (thật: LHP Chiều 01/11,
--     LHP Chiều 04/11). Nay: app__stc_ds_state 'no' thêm điều kiện khớp danh sách (chặn Xác nhận Fabi); "Lấy số máy Fabi" ô Nợ bị chặn khi máy
--     ghi ÍT hơn danh sách, máy ghi NHIỀU hơn thì bắt chọn người nợ phần chênh (phần chênh tính theo danh sách). Gỡ: "Sai, sửa số" (Chủ duyệt).
--     VÙNG KHOÁ (điều kiện xác nhận phần tiền của ca) — đã nói với anh Tiến trong câu hỏi chốt chặng 4. Vá bằng thay chuỗi trên bản đang chạy.
--  2) Tệp ca Fabi: app_fabi_list trả thêm cờ xn (ca đã Xác nhận Fabi) → trang không đếm ca đó vào "Cần quản lý xem" (anh chốt).
-- Bài thử: kiem_tra/no_bill_162_cuc_bo.sql (Postgres cục bộ). Chạy lại nhiều lần không sao.

create or replace function public.app__ca_bill_list(p_report bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(d.amount), 0)::bigint from public.shift_debts d
   where d.report_id = p_report and coalesce(d.kind, 'bill') = 'bill'
     and d.gap_report is null and d.mv_report is null and coalesce(d.fund_out, 0) = 0
$$;
revoke all on function public.app__ca_bill_list(bigint) from public, anon, authenticated;

do $$
declare d text; n text; o1 text; n1 text; o2 text; n2 text; o3 text; n3 text; o4 text; n4 text;
begin
  -- (a) app__stc_ds_state: ô Nợ khớp máy (hoặc số Chủ duyệt) VÀ khớp danh sách khách nợ HĐ; trả thêm bill_list cho giao diện / lấy số máy
  d := pg_get_functiondef('public.app__stc_ds_state(bigint)'::regprocedure);
  if position('app__ca_bill_list' in d) = 0 then
    o1 := $q$'no', f is null or coalesce((e ->> 'pos_debt')::bigint, 0) = coalesce((f ->> 'no')::bigint, 0) or public.app__stc_fix_ok(p_report, 'no', e),$q$;
    n1 := $q$'no', (f is null or coalesce((e ->> 'pos_debt')::bigint, 0) = coalesce((f ->> 'no')::bigint, 0) or public.app__stc_fix_ok(p_report, 'no', e))
            and coalesce((e ->> 'pos_debt')::bigint, 0) = public.app__ca_bill_list(p_report),   -- chặng 4: Nợ bill phải bằng danh sách khách nợ HĐ của ca
    'bill_list', public.app__ca_bill_list(p_report),$q$;
    if position(o1 in d) = 0 then raise exception 'Tệp 162: app__stc_ds_state đang chạy không có dòng ''no'' như dự kiến — dừng, không vá.'; end if;
    execute replace(d, o1, n1);
  end if;

  -- (b) app_stc_ds_fabi: "Lấy số máy Fabi" ô Nợ — máy ít hơn danh sách → chặn; nhiều hơn → bắt chọn người nợ phần chênh (tính theo danh sách)
  d := pg_get_functiondef('public.app_stc_ds_fabi(bigint,text,text,text)'::regprocedure);
  if position('ít hơn danh sách khách nợ' in d) = 0 then
    o2 := $q$  if p_field = 'mo' then fld := jsonb_build_object('ipos_opening', (s ->> 'fabi_open')::bigint, 'opening_cash', (s ->> 'fabi_open')::bigint);$q$;
    n2 := $q$  -- chặng 4 (22/11): Nợ bill phải bằng danh sách khách nợ hoá đơn của ca
  if p_field = 'no' and coalesce((s ->> 'fabi_debt')::bigint, 0) < coalesce((s ->> 'bill_list')::bigint, 0) then
    raise exception 'Máy Fabi ghi nợ % — ít hơn danh sách khách nợ hoá đơn của ca (%). Khách nợ thật thì giữ số nợ: bấm "Sai, sửa số", ghi Nợ bill = % để Chủ duyệt.',
      public.app__vnd(coalesce((s ->> 'fabi_debt')::bigint, 0)), public.app__vnd((s ->> 'bill_list')::bigint), public.app__vnd((s ->> 'bill_list')::bigint);
  end if;
  if p_field = 'mo' then fld := jsonb_build_object('ipos_opening', (s ->> 'fabi_open')::bigint, 'opening_cash', (s ->> 'fabi_open')::bigint);$q$;
    o3 := $q$    diff := (s ->> 'fabi_debt')::bigint - coalesce((e ->> 'pos_debt')::bigint, 0);$q$;
    n3 := $q$    diff := (s ->> 'fabi_debt')::bigint - coalesce((s ->> 'bill_list')::bigint, 0);   -- chặng 4: phần chênh so với danh sách khách nợ
    if diff > 0 and nullif(trim(coalesce(p_name, '')), '') is null then
      raise exception 'Máy Fabi ghi nợ nhiều hơn danh sách khách nợ hoá đơn % — chọn người nợ phần chênh để Nợ bill khớp danh sách.', public.app__vnd(diff);
    end if;$q$;
    if position(o2 in d) = 0 or position(o3 in d) = 0 then raise exception 'Tệp 162: app_stc_ds_fabi đang chạy khác dự kiến — dừng, không vá.'; end if;
    execute replace(replace(d, o2, n2), o3, n3);
  end if;

  -- (c) app_fabi_list: thêm cờ xn = ca đã Xác nhận Fabi (có kết quả tiền mặt + chuyển khoản)
  d := pg_get_functiondef('public.app_fabi_list(text,text)'::regprocedure);
  if position($q$'xn',$q$ in d) = 0 then
    o4 := $q$'diff', f.diff, 'fixed', f.fixed,$q$;
    n4 := $q$'diff', f.diff, 'fixed', f.fixed,
               'xn', exists (select 1 from public.shift_report_results x where x.report_id = f.report_id and x.item = 'tien_mat')
                     and exists (select 1 from public.shift_report_results x where x.report_id = f.report_id and x.item = 'chuyen_khoan'),$q$;
    if position(o4 in d) = 0 then raise exception 'Tệp 162: app_fabi_list đang chạy khác dự kiến — dừng, không vá.'; end if;
    execute replace(d, o4, n4);
  end if;
end $$;

insert into public.app_migrations(file) values ('162_no_bill_khop_danh_sach.sql') on conflict (file) do nothing;
