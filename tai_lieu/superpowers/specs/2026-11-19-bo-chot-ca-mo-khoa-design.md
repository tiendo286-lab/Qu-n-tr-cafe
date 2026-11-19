# Bỏ "Chốt ca" vĩnh viễn + mở khoá chốt tiền cho Quản lý — thiết kế (19/11/2026)

## Anh Tiến chốt
- "Không có nút khoá vĩnh viễn, bỏ hẳn." Khoá cuối cùng là **Chốt tháng**, chỉ **Chủ** mở lại được.
- Mở khoá chốt tiền của ca (nút **Mở lại xác nhận** Fabi ở Sổ thu chi › Đối soát Fabi) cho **Quản lý cơ sở (cơ sở mình), Quản lý tổng, Chủ**.

## Vùng khoá (đã báo anh Tiến trong chat 19/11)
Sửa khoá Chốt ca (`app__stc_final_guard`, tệp 135) và quyền mở lại mục tiền của ca (`app_stc_ds_reopen` gọi `app_ca_recon_reopen` / `app_ca_item_reopen`, hai hàm này chỉ cho Chủ). Không đổi `app_can`, `role_permissions`, `app__stc_can/need`.

## Máy chủ (tệp 141)
- Bỏ trigger `stc_final_guard` trên mọi bảng; xoá các dòng `stc_ca_finals` (lúc làm có 2 ca); `app_stc_ca_final` báo "Đã bỏ Chốt ca"; `app_stc_finals` trả rỗng. Giữ bảng để sao lưu còn dữ liệu cũ. Khoản treo đang có 0 dòng, giữ bảng, không sinh thêm.
- `app_stc_ds_reopen`: tự mở lại mục tiền (và cả phiếu nếu đã đối soát xong theo cách cũ), không gọi hai hàm chỉ-Chủ. Người được gọi vẫn theo `app__stc_ds_need` (Chủ / Quản lý tổng / quản lý đối soát của cơ sở; tháng đã chốt thì không được). Vẫn bắt lý do, ghi `shift_recon_log` + `app_log`.
- Chốt tháng: `app_fin_reopen` đã chỉ cho Chủ (kiểm lại trên máy chủ thật 19/11), nút "Mở lại tháng (Chủ)" chỉ hiện khi `can_reopen`. Không đổi.

## Giao diện
- Sổ thu chi: bỏ nút / khung 🔒 Chốt ca, bỏ ô và khung Khoản treo ở tab Tổng, bỏ danh sách "chưa chốt ca", đổi nhãn "Fabi ✓ · chưa chốt ca" thành "Fabi ✓ · đã xác nhận", bỏ chữ "→ 🔒 Chốt ca" trong dòng giải thích. Không gọi `app_stc_finals` nữa.

## Kiểm tra
- Máy chủ: bài thử tự hoàn tác — Quản lý tổng / Quản lý mở lại xác nhận ca đã đối soát xong được; người không có quyền bị chặn; tháng đã chốt bị chặn; sửa thu chi ca từng chốt không còn bị trigger chặn.
- Trình duyệt: `flow_ql_tu_ds` (ql, chu × máy tính + điện thoại), `flow_stc6`, `flow_stc7` (chu / qlt / ql) — sửa các bài này cho khớp việc bỏ Chốt ca.
