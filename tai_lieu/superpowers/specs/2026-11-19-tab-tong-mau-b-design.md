# Kế hoạch 5 — Tab Tổng (Sổ thu chi) xếp lại theo mẫu B + "Ai còn nợ" (chỉ giao diện)

Ngày: 19/11/2026 · Anh Tiến duyệt mẫu B (có thêm "Ai còn nợ", 2 khung đầu trang có giới hạn chiều cao) trong chat, chốt là **Kế hoạch 5**.
Mẫu bấm thử: https://claude.ai/artifact/F1Pee85W6bQsbM96Etvo5C (nút "Mẫu B").
Trạng thái: **ĐÃ LÀM — bước 166, web 2026.11.19.23** (anh bảo "làm đi" 19/11). Kế hoạch: `plans/2026-11-19-tab-tong-mau-b.md`. Thứ tự: sau KH2 → KH3 → KH4 → KH1, xem `plans/2026-11-19-lo-trinh-4-ke-hoach.md`.

## Vì sao
Tab Tổng hiện tại có nhiều thông tin nhưng khó thấy việc cần làm: khung "So với trang cũ" nằm trên cùng, 5 ô nhỏ phải đọc từng ô, còn danh sách việc nằm ở khung bên phải (trên điện thoại bị đẩy xuống cuối). Anh muốn vừa mở tab là biết **hôm nay phải làm gì** và **ai còn nợ**.

## Mục tiêu
- Đầu trang có 2 khung đặt cạnh nhau: **Việc cần làm** | **Ai còn nợ**. Trên điện thoại (390px) thì xếp chồng.
- **Hai khung cao bằng nhau và có giới hạn chiều cao** (anh dặn: "chỉ bằng đó thôi, không kéo dài xuống tận dưới"). Nhiều việc hoặc nhiều người nợ thì **cuộn bên trong khung**. Tiêu đề khung luôn ghi tổng số (vd "4 việc", "5 người · 3.105.000").
- Bên dưới giữ đủ số liệu như cũ, chỉ xếp lại thứ tự.

## Không làm
- Không đổi cách tính tồn quỹ, không đổi máy chủ (dữ liệu đã có sẵn: `open_debts`, danh sách ca, các khoản).
- Không đụng vùng khoá phần tiền đối soát. Nút "Mở ›" chỉ dẫn sang tab Đối soát Fabi như hiện nay.
- Không gộp nhiều cơ sở: tab Tổng vẫn chỉ xem 1 cơ sở.

## Các cách đã cân nhắc
- **A · Gọn**: gộp 5 ô nhỏ thành một dòng vàng "Cần làm". Thay đổi ít nhất, nhưng muốn xem chi tiết phải bấm thêm.
- **B · Việc lên đầu** (**anh chọn**, thêm "Ai còn nợ"): mở tab là thấy danh sách việc và người nợ, bấm đi xử lý luôn.
- **C · Chia 2 cột Tiền mặt | Tài khoản**: dễ so 2 quỹ, nhưng trên điện thoại dài và bảng ngày bị cắt còn 5 ngày.

## Thứ tự trên trang (cơ sở)
1. **Việc cần làm** | **Ai còn nợ** (cao bằng nhau, cuộn bên trong).
2. 3 số lớn: Tồn quỹ (Tiền mặt + Tài khoản) · Tiền mặt (quá 5 triệu thì báo nên chuyển về Quỹ ngoài) · Tài khoản.
3. Hai khung cách tính đặt cạnh nhau: **Tiền mặt** và **Tài khoản** (Tồn đầu tháng + Thu − Chi − Chuyển về Quỹ ngoài = Tồn quỹ, có link Sổ thu / Sổ chi).
4. Hàng nút: + Chuyển về Quỹ ngoài · + Luân chuyển TM ↔ TK · Kiểm quỹ.
5. Bảng **Tồn quỹ theo ngày** (nút chọn Tiền mặt / Tài khoản), đủ cả tháng.
6. Hai khung nhỏ: **Chuyển về Quỹ ngoài** (danh sách, Chờ Chủ nhận / Đã nhận, nút Đã nhận tiền / Sửa / Xoá như cũ) và **Kiểm quỹ** (lần cuối + nút).
7. **So với trang cũ** thu gọn thành một dòng ở cuối (bấm mới mở). Bỏ hẳn khi gỡ trang cũ.
- **Bỏ 5 ô nhỏ** (Chuyển về QN, Chờ Chủ nhận, Kiểm quỹ lần cuối, Ca chưa xác nhận Fabi, Chờ xử lý), vì nội dung đã nằm trong Việc cần làm và các khung bên dưới.

## Khung "Việc cần làm"
- Gồm: ca chưa xác nhận Fabi (chấm đỏ, làm trước, nút "Mở ›" sang Đối soát Fabi đúng ca), lệch chờ xử lý, khoản chi chưa phân loại, khoản Chuyển về Quỹ ngoài đang chờ Chủ nhận. Đây là những thứ khung "Chờ xử lý" và các ô nhỏ hiện đang đếm.
- Việc đỏ xếp trước, sau đó theo ngày cũ → mới.
- Hết việc thì hiện "Không còn gì 👍" và khung tự thấp lại.

## Khung "Ai còn nợ"
- Lấy từ `open_debts` (đã có, gồm cả nợ hoá đơn) của cơ sở đang xem.
- **Mỗi người là 1 dòng**: tên, tổng còn nợ, số khoản, khoản lâu nhất bao nhiêu ngày. Bấm vào dòng thì mở ra từng khoản (ca nào, bao nhiêu ngày, số tiền, nút **Thu nợ** dùng hộp thoại thu nợ đang có).
- Người nợ lâu nhất xếp lên đầu. **Quá 7 ngày thì chữ đỏ** (giống Sổ thu).
- Người có dấu ✓ (không nhắc thu: người nhà, Kho Tổng) gộp vào một dòng thu gọn ở cuối khung.
- Không có ai nợ thì hiện "Không còn ai nợ."

## Quỹ ngoài (chỉ Chủ)
Giữ như hiện nay theo thứ tự mới, không có khung Việc cần làm / Ai còn nợ.

## Để người làm tự quyết
- Chiều cao giới hạn của 2 khung: em đề xuất khoảng 6 dòng, cuộn bên trong. Trên điện thoại cũng giới hạn như vậy.
- Kiểu chữ, khoảng cách: theo `style.css` và lớp `stc-*` có sẵn.
- Khung "Khách đang nợ" ở Sổ thu vẫn giữ nguyên.

## Kiểm tra khi làm
- Bài thử giao diện `kiem_tra/trinh_duyet/` cho trang Sổ thu chi (role chu / qlt / ql), khung 390px không tràn ngang.
- Nút Thu nợ ở tab Tổng mở đúng hộp thoại và ghi đúng.
- Mỗi lần đẩy lên web: tăng `docs/version.json` và ghi `app_releases`.
