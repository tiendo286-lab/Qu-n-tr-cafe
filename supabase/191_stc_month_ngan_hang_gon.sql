-- 191 (27/11/2026, anh Tiến: "chạy luôn bây giờ") — thay cho tệp 171 (viết 24/11, CHƯA BAO GIỜ chạy): Sổ thu chi tháng nhanh hơn.
-- Tệp 171 chép nguyên định nghĩa app_stc_month ngày 24/11; từ đó hàm đã được vá thêm (tệp 190 thêm 'auto') nên KHÔNG chạy được 171 nữa
-- (chạy sẽ làm mất các bản vá sau). Tệp này làm đúng MỘT việc của 171 bằng cách thay chuỗi trên bản ĐANG CHẠY:
--   cột "b" của mỗi ca lấy bằng app__kt_bank_sum (tệp 169, bản gọn) thay cho app__kt_bank_json.
-- Trong app_stc_month, r.b chỉ dùng 3 khoá received / entered / account_count để tính chuyển khoản ngân hàng nhận của ca;
-- app__kt_bank_sum trả đúng 3 khoá đó giống hệt (đã so 24/11: 275/275 phiếu; so lại lúc chạy: kết quả hàm trước / sau giống hệt).
-- KHÔNG đổi cách tính tiền, quyền, dấu xác nhận; không sửa dữ liệu. Vùng khoá (đã báo anh Tiến 24/11 và 27/11).
-- Đã vá rồi thì bỏ qua; không thấy đúng một chỗ cần vá thì DỪNG. Chạy lại nhiều lần không lỗi.
do $$
declare d text := pg_get_functiondef('public.app_stc_month(bigint,text)'::regprocedure);
  cu text := 'public.app__kt_bank_json(x) b'; moi text := 'public.app__kt_bank_sum(x) b';
begin
  if position(moi in d) > 0 and position(cu in d) = 0 then return; end if;
  if (length(d) - length(replace(d, cu, ''))) / length(cu) <> 1 then raise exception 'Tệp 191: app_stc_month không có đúng một chỗ cần vá — dừng, không đổi gì.'; end if;
  execute replace(d, cu, moi);
end $$;

insert into public.app_migrations(file) values ('191_stc_month_ngan_hang_gon.sql') on conflict (file) do nothing;
