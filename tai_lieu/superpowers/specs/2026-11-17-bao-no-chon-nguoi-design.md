# Báo nợ chọn người nợ + mọi khoản tiền trong ca đổi được thành nợ — thiết kế (17/11/2026)

## Mục đích
Kho tổng / người nhà cầm tiền của ca (tiền mặt hoặc chuyển khoản ra khỏi tài khoản) phải ghi đúng là **công nợ** của đúng người, vào đúng nhóm ở tab Công nợ, ngay lúc chốt ca hoặc kiểm tra — không phải sang tab Công nợ đổi nhóm, và phiếu ca sau không nhắc thu nhầm.

## Anh chốt (17/11)
- Dòng **Báo nợ** có menu **Người nợ**: **Khách** (gõ tên khách) + những người nợ khác (vd Tiến, Phương Anh, Kho Tổng).
- **Nhân viên cũng chọn được** khi chốt ca (đổi quy định bước 95 "nhân viên chỉ ghi nợ khách hàng").
- **Mọi khoản tiền trong ca** (Thu / Chi) **sửa được thành công nợ** — ở phiếu chốt ca và ở bước Kiểm tra.

## Cách làm
1. **Danh sách người trong menu** = Khách + những người đang có ở nhóm **② Nợ kho tổng** và **③ Nợ khác** của tab Công nợ, cơ sở đó (luôn có "Kho tổng") — *em quyết*: trang Cài đặt › Người vay đã bỏ từ bước 85; tên người không ghi vào mã nguồn (kho công khai). Người mới: quản lý thêm ở tab Công nợ ("+ Thêm người nợ"), lần sau có trong menu.
2. **Chọn người** → khoản nợ lưu đúng tên + đúng nhóm (Kho tổng → ②, người khác → ③, Khách → ①). Nhóm ②/③ không nhắc thu ở phiếu ca sau (giữ quy định bước 95); chỉ quản lý thu ở tab Công nợ.
3. **Thu / Chi → Báo nợ** (nút "→ Báo nợ" trên từng dòng):
   - Phiếu chốt ca: như bước 116 (dòng thu chi thành dòng Báo nợ cùng số tiền, TM/CK theo hình thức), thêm menu Người nợ.
   - Bước Kiểm tra: có ở **mọi dòng Thu / Chi** khi **✎ Mở để sửa**; đổi trên màn hình, **Lưu 1 lần** cùng các sửa khác (hỏi lý do như hiện nay, có ghi chú "đổi thu chi thành nợ").
   - Đổi thành nợ: không tính thu nhập / chi phí; bảng tiền của ca giữ đúng (TM trừ két, CK trừ chuyển khoản phải nhận).
4. Nút "Thành nợ" cũ trong mục gập "Ít dùng" và ở trang Thu chi giữ nguyên (dùng sau khi đã đối soát).
   **Giữ nguyên** (anh hỏi 17/11): nút "+ Khách CK rút tiền mặt", ô tick trên dòng Thu / Chi, nút "Đổi thành: Khách CK rút tiền mặt" ở dòng Báo nợ TM. Dòng Khách CK rút tiền mặt **không có** "→ Báo nợ" (chỉ là đổi tiền, không ai nợ) — *em quyết*.
5. Khoản nợ đã ghi trước đây giữ nguyên.

## Luân chuyển tiền mặt – CK (anh chốt 17/11, làm cùng đợt)
- Đổi tên **"Khách CK rút tiền mặt"** thành **"Luân chuyển tiền mặt – CK"** ở mọi chỗ (nút, ô tick trên dòng Thu / Chi, dòng trong danh sách, nút "Đổi thành…" ở dòng Báo nợ TM, bảng tuần, Thu chi, hộp Lưu).
- Có **2 chiều**, chọn trên dòng:
  - **TM → CK**: tiền mặt trong két giảm, chuyển khoản tăng (như khách chuyển khoản rút tiền mặt hiện nay).
  - **CK → TM**: chuyển khoản giảm, tiền mặt tăng (rút từ tài khoản về két).
- Cả 2 chiều: một số tiền, một nội dung; không tính thu nhập / chi phí; sửa / xoá cả phiếu (máy chủ chặn sửa một vế) — giữ quy tắc cũ.
- Các phiếu đã ghi trước đây giữ nguyên số liệu, chỉ đổi chữ hiển thị.

## Quyền Mở để sửa ở bước Kiểm tra (anh chọn (b) 17/11, làm cùng đợt)
- **Một quy tắc cho mọi phiếu** (đã / chưa web tự đối soát): chỉ **Chủ, Quản lý tổng, quản lý đối soát của cơ sở đó** (ô Đối soát ca trong Bảng phân công) được **✎ Mở để sửa → Lưu** phần tiền và Sửa thẳng. Quản lý khác: không hiện nút Mở, thay bằng dòng "Chỉ quản lý đối soát cơ sở này sửa được"; máy chủ cũng chặn.
- Giữ: lý do bắt buộc, lịch sử, Chủ được báo khi người khác sửa phiếu web đã tự đối soát; nút "Mở khoá" (Đèn đối soát) chỉ Chủ; tháng đã chốt không ai sửa; "Mở lại phiếu ca" cho nhân viên theo quyền riêng như cũ.
- Việc mới đợt này ở bước Kiểm tra (→ Báo nợ, chọn người nợ, luân chuyển) theo đúng quyền này.

## Không làm
- Không thêm lại mục Cho vay / Người vay.
- Không đổi cách thu nợ (nhân viên vẫn chỉ được ghi trả **nợ khách hàng** trong ca).

## Kiểm tra
- Máy chủ: nhân viên / quản lý ghi Báo nợ chọn "Kho tổng" → nhóm ②; "Tiến" → nhóm ③; Khách → ①; phiếu ca sau không nhắc ②/③; Kiểm tra đổi 1 dòng Chi CK thành nợ Kho tổng → Lưu 1 lần, bảng tiền không đổi, khoản vào ②.
- Giao diện: menu có đủ người, 2 khung (máy tính + điện thoại 390px) không tràn.
