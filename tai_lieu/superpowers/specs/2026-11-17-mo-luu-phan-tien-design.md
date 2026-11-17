# Bước Tiền ở phần Kiểm tra: 1 nút Mở, 1 nút Lưu — thiết kế

17/11/2026 · anh Tiến chốt ("làm cho tôi") sau khi xem ảnh mẫu điện thoại + máy tính (scratchpad `mau_mo_luu.png`, `mau_mo_luu_web.png`).

## Vì sao
Bước Tiền (mục 3) của phần Kiểm tra có quá nhiều cách lưu / sửa chồng nhau (gõ là tự lưu nhưng phải điền lý do ở cuối trang trước; "Lưu sửa" từng dòng khách trả; "Lưu cách xử lý"; "✎ Sửa phần tiền" → chọn "Mở lại phần tiền" / "Sửa thẳng" → "Xong, khoá lại"; mỗi nút Đổi thành… đòi lý do riêng). Anh muốn: **1 nút Mở, 1 nút Lưu; Lưu có thay đổi thì hỏi lý do một lần.**

## Làm gì (cả điện thoại và máy tính)
1. **Chỉ xem** (mặc định khi mở bước Tiền, kể cả khi chưa duyệt): mọi ô của phần tiền khoá. Thanh dưới: `‹ Quay lại` · `✎ Mở để sửa` · `✓ Duyệt phần tiền & hoàn thành` (chỉ khi được duyệt như hiện nay).
2. **Đang sửa** (sau khi bấm Mở): sửa được số Phiếu Fabi, thu chi (+ Thu / + Chi / × / Đổi thành…), Báo nợ (+ / sửa / × / đổi loại), Khách trả nợ cũ (+ Thu nợ / sửa / ×), Khách mượn → Khách CK rút tiền mặt, ảnh phiếu Fabi. **Không lưu gì lên máy chủ** cho tới khi bấm Lưu; bảng tiền tự tính lại ngay khi gõ; ô đã sửa viền vàng; nhãn "N thay đổi chưa lưu". Thanh dưới chỉ còn `Huỷ` · `💾 Lưu (N thay đổi)`. Rời trang khi còn thay đổi → hỏi lại.
3. **Bấm Lưu**: không có thay đổi → về Chỉ xem. Có thay đổi → hộp liệt kê thay đổi + ô **Lý do sửa (bắt buộc)** + `Quay lại sửa` · `💾 Lưu`. Lưu **tất cả trong 1 lần, lỗi thì không lưu gì**, cùng 1 lý do; xong về Chỉ xem, các dòng có ghi chú ✎ / ＋ / ✗ (bước 120).
4. **Duyệt vẫn là nút riêng.** Lưu khi phần tiền đã duyệt (kể cả ca đã hoàn thành) → các mục tiền đã duyệt được mở lại, phải bấm Duyệt lại (Duyệt = quyết định cuối). Mục web tự đối soát: chỉ Chủ lưu được (như cũ).
5. **Bỏ**: ô "Lý do sửa" cuối trang của phần tiền, nút "Lưu sửa" từng dòng khách trả, nút "✎ Sửa phần tiền" + hộp "Mở lại / Sửa thẳng" + "Xong, khoá lại", nút "Lưu cách xử lý" (cách xử lý lệch lưu khi bấm Duyệt).

## Không đổi
Phần việc (Nhân viên, Nghỉ & làm thay, Bàn giao) giữ như cũ. Chọn nhóm thu chi, phiếu chi chuyển khoản, cách thu tiền mặt (theo ca / cuối ngày), xử lý lệch: thao tác như cũ ở chế độ Chỉ xem (không phải "sửa số").

## Cách làm (chọn)
- **Máy chủ 1 hàm lưu cả gói** `app_ca_recon_apply(p_id, p_changes, p_reason)` (chọn): nhận toàn bộ thay đổi, chạy trong 1 giao dịch các hàm sẵn có (bản kiểm tra, khách nợ, khách trả, đổi khách mượn, ảnh) → lỗi giữa chừng thì không lưu gì; mở lại mục tiền đã duyệt khi có thay đổi.
- Loại: giao diện gọi lần lượt từng hàm khi Lưu (lỗi giữa chừng → lưu nửa vời); giữ tự lưu nhưng ẩn nút (không đúng ý "1 nút Lưu").

## Quyết định của em
- Lưu làm mở lại mục tiền đã duyệt (thay cho "Sửa thẳng" giữ nguyên đã duyệt) — đơn giản, Duyệt luôn là bước cuối.
- Ảnh mới tải lên kho ngay khi chọn (cần tệp), chỉ gắn vào phiếu khi Lưu; Huỷ thì không gắn.
- Chỉ xem là mặc định mỗi lần mở trang (không nhớ trạng thái Đang sửa qua lần tải lại; tải lại khi đang sửa → hỏi lại trước).
