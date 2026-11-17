# Tăng tốc Sổ quỹ + Chốt tháng — thiết kế (17/11/2026, anh Tiến duyệt)

## Mục đích
Anh Tiến muốn web "chạy thật trơn chu, không giật lag". Sau bước 125 các trang hằng ngày đã nhanh (< 0,5s); còn **Chốt tháng ~29s** và **Sổ quỹ ~1,6s** (đo máy chủ thật, vai Chủ, tháng 11/2026). Mục tiêu: Chốt tháng ~2–4s, Sổ quỹ < 1s, và **không chậm dần** theo số ngày.

## Nguyên nhân (đã đo bằng `pg_stat_xact_user_functions`)
1. `app_fin_overview` dùng `cross join lateral (select app__fin_full(b.id, p_month) as j) c` rồi tham chiếu `c.j` 6 lần → máy chủ làm phẳng truy vấn con, gọi `app__fin_full` **6 lần mỗi cơ sở** (30 lần / 5 cơ sở).
2. Mỗi `app__fin_full` dựng sổ quỹ (`app__fund_rows`) 3 lần (1 lần trong tháng + `app__fund_balance` × 2 cho số cuối kỳ), thêm 2 lần cho số đầu kỳ khi tháng sau ngày bắt đầu quỹ. `app__fund_balance` mỗi lần dựng lại **từ ngày bắt đầu quỹ** (`app__fund_start`, hiện 01/11/2026).
3. `app_fund_overview` gọi `app__fund_balance` 2 lần mỗi cơ sở (tiền mặt, chuyển khoản) → dựng sổ 2 lần.

## Mục tiêu / không làm / không được xảy ra
- **Mục tiêu:** mỗi lần mở trang, mỗi cơ sở dựng sổ quỹ **1 lượt**; Chốt tháng gọi `app__fin_full` **1 lần mỗi cơ sở**.
- **Không làm lần này:** lưu số dư tháng đã chốt (chưa có tháng nào chốt — làm sau khi chốt tháng 11); không đổi giao diện; không đổi `app__fin_calc`.
- **Không được xảy ra:** bất kỳ số tiền nào khác bản cũ; lưu số dư vào bảng (dễ lệch nguồn).

## Các cách đã cân nhắc
- **Bảng số dư theo ngày cập nhật khi có thay đổi** — nhanh nhất nhưng sổ quỹ lấy từ > 10 nguồn (phiếu ca, bản đối soát, số dư ngân hàng, thu chi, rút quỹ, luân chuyển, cho vay, trả vay, công nợ, khoản âm, cài đặt) → sót 1 nguồn là sai âm thầm. **Bỏ.**
- **Dựng 1 lượt mỗi cơ sở mỗi lần mở trang + sửa lỗi gọi 6 lần** — không lưu gì, không thể lệch, kết quả giống hệt bằng cấu trúc. **Anh chọn (17/11).**
- **Lưu số dư cuối tháng đã chốt** — chặn chậm dần theo thời gian; để sau (chưa có tháng chốt).

## Cách làm (em quyết, anh duyệt)
- Không đổi `app__fund_rows` (nguồn duy nhất của các dòng sổ quỹ). Thêm hàm nội bộ `app__fund_sum(p_branch, p_upto, p_d0, p_d1)` gọi `app__fund_rows(p_branch, fund_start, p_upto)` **1 lần**, trả các tổng cần: số dư tiền mặt / chuyển khoản tại `p_upto` (cộng `fund_openings`), số dư tại `p_d0 − 1`, và tổng `bu_khoan_am` / `nop_quy` / `ck_ve` trong `[p_d0, p_d1]`.
- `app__fin_full`: thay 1 lần `fund_rows(d0,d1)` + 2–4 lần `fund_balance` bằng 1 lần `app__fund_sum`. Giữ nguyên: nếu `d0 <= fund_start` thì số đầu kỳ = tổng `fund_openings`.
- `app_fin_overview`: viết lại bằng vòng lặp plpgsql, gọi `app__fin_full` 1 lần/cơ sở, giữ nguyên khoá, thứ tự, điều kiện quyền.
- `app_fund_overview`: 1 lần `app__fund_sum` mỗi cơ sở cho `cash` / `bank`.
- Định nghĩa lại từ bản **đang chạy trên máy chủ** (`pg_get_functiondef`), không lấy từ tệp cũ. Kiểm các tệp máy chủ mới của phiên khác (110, 111…) xem có đụng các hàm này không.
- `app_fund_branch` và nơi khác gọi `app__fund_balance` giữ nguyên (đo lại, sửa nếu còn chậm đáng kể).

## Kiểm chứng
- Giao dịch tự hoàn tác: lưu kết quả bản cũ của `app_fin_overview`, `app__fin_full` (mọi cơ sở), `app_fund_overview`, `app_fund_branch` (mọi cơ sở) cho tháng 10, 11, 12/2026 → thay hàm → so `is distinct from` = 0 chỗ khác. Đo thời gian trước / sau.
- Chạy cả tệp 2 lần liên tiếp không lỗi.
- Không đổi giao diện nên không cần chạy thử trình duyệt; vẫn tăng phiên bản? **Không** — chỉ đổi máy chủ; ghi `app_releases` dòng mới.
