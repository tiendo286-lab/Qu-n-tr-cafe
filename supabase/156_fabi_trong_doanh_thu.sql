-- Chặng 2 (anh Tiến chốt 21/11/2026): tệp Fabi của ca có nhưng KHÔNG có số doanh thu (net / tm / ck trống — 4 ca thật: LHP Chiều 04/11; Lela Sáng 04, 07, 13/11).
--   • "Lấy số máy Fabi" ở ô Doanh thu khi máy không có số → CHẶN. Trước đây hàm ghi doanh thu của phiếu thành trống, rồi ô so "trống = trống" thành khớp
--     → ca xác nhận Fabi được với doanh thu trống. Ô Tiền mở ca: máy không có số đầu ca cũng chặn.
--   • Quản lý ghi số theo phiếu máy in bằng "Sai, sửa số" → Chủ duyệt (tệp 153, không đổi). Giao diện: ô ghi "Fabi không có số doanh thu", ẩn nút lấy số.
-- VÙNG KHOÁ (đổi điều kiện sửa số tiền của ca) — đã nói với anh Tiến ở buổi chốt chặng 2. Vá bằng thay chuỗi trên bản đang chạy (bản của tệp 133), giữ mọi phần khác.
-- Bài thử: kiem_tra/fabi_trong_156_cuc_bo.sql (Postgres cục bộ). Chạy lại nhiều lần không sao.
do $$
declare d text; a1 text; b1 text;
begin
  d := pg_get_functiondef('public.app_stc_ds_fabi(bigint,text,text,text)'::regprocedure);
  if position('không có số doanh thu' in d) = 0 then
    a1 := $q$e := public.app__ca_eff(p_report);$q$;
    if length(d) - length(replace(d, a1, '')) <> length(a1) then raise exception 'app_stc_ds_fabi: không thấy đúng một chỗ vá (máy Fabi không có số).'; end if;
    b1 := $q$e := public.app__ca_eff(p_report);
  -- chặng 2 (21/11): máy Fabi không có số ở ô này → không lấy (trước đây ghi số trên phiếu thành trống); quản lý dùng "Sai, sửa số" để Chủ duyệt
  if p_field = 'dt' and (s ->> 'fabi_rev') is null then
    raise exception 'Máy Fabi không có số doanh thu ở ca này — bấm "Sai, sửa số", ghi số theo phiếu máy in để Chủ duyệt.';
  end if;
  if p_field = 'mo' and (s ->> 'fabi_open') is null then
    raise exception 'Máy Fabi không có số tiền đầu ca ở ca này — bấm "Sai, sửa số" để Chủ duyệt.';
  end if;$q$;
    execute replace(d, a1, b1);
  end if;
end $$;

insert into public.app_migrations(file) values ('156_fabi_trong_doanh_thu.sql') on conflict (file) do nothing;
