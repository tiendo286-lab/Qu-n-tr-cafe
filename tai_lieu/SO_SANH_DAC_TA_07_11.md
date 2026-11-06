# So sánh đặc tả (bản anh Tiến gửi 07/11/2026) với web hiện tại

Đặc tả yêu cầu: chỗ nào mã hiện tại khác đặc tả thì nêu rõ trước khi sửa; mục "chờ chốt" không tự làm. Tệp này là bản nêu rõ đó.

## A. Mâu thuẫn với quyết định anh đã chốt tối 06–07/11 — cần anh chọn bên nào đúng

| # | Đặc tả ghi | Web hiện tại (theo anh yêu cầu tối qua) |
|---|---|---|
| A1 | Tab **Họp và giao việc**, nút THÊM CUỘC HỌP (mục 5) | Đã **bỏ Họp**. Tab Công việc: Cần xử lý → Chờ nhận → Đang xử lý → Đã xử lý |
| A2 | Chỉ giao cho **quản lý**; luồng 5 bước có **Chờ duyệt**, Chủ duyệt / yêu cầu làm lại; quản lý không tự duyệt (mục 5) | Giao cho **mọi nhân viên**; **không còn duyệt**; nhân viên báo Đã xử lý là xong; Chủ có "Yêu cầu làm lại" |
| A3 | Việc bàn giao giao qua Họp phải được Chủ duyệt mới hoàn thành (mục 2.8) | Người nhận báo Đã xử lý là bàn giao gốc tự xong |
| A4 | **Giao đào tạo** gắn phiếu đào tạo (mục 5.1) | Mất chỗ giao riêng khi bỏ Họp |
| A5 | Nhắc việc chỉ cho **quản lý**, có nhóm "chờ duyệt" (mục 5.2) | Nhắc cho mọi người nhận việc; không còn "chờ duyệt" |
| A6 | Vai trò: Chủ, Quản lý, **Kế toán**, Nhân viên (mục 1) | Có: Chủ, **Quản lý tổng**, Quản lý, Nhân viên; **chưa có Kế toán** |

Ngoài ra tối qua anh đã cho bỏ một số chức năng cũ của Order / Nhân viên (nhập Form, tải mẫu, khôi phục order, nhập Excel nhân viên, nhập dữ liệu offline). Đặc tả mục 1 ghi "không tự thay đổi nghiệp vụ cũ khi chưa có yêu cầu"; các việc này đều làm theo yêu cầu của anh, nên chỉ ghi lại để anh biết.

## B. Đã có, khớp đặc tả

- 3 ca/ngày; phiếu gắn ngày, cơ sở, ca. Lưu người tạo, giờ tạo, người và giờ xác nhận hoàn thành, khoảng doanh thu có đủ ngày giờ.
- Ca Sáng bắt đầu 06:45 và 1.000.000đ đầu ca. Ca Chiều lấy giờ kết thúc của ca Sáng đã hoàn thành. Ca Tối tự chọn giờ.
- 7 số liệu nhập riêng, có số cốc. Kiểm tra Tổng = Tiền mặt POS + Chuyển khoản POS (ca có công nợ thì không áp, chờ chốt).
- Tiền đầu ca so với két cuối ca trước: khớp / lệch đỏ / chưa có số liệu. Hiện chỉ cảnh báo, không chặn (chờ chốt).
- Chênh lệch chuyển khoản và tiền mặt tách riêng; có CHI TIẾT THU CHI có dấu; tính số còn lại chưa giải trình.
- Hộp xác nhận có QUAY LẠI CHỈNH SỬA / XÁC NHẬN HOÀN THÀNH, hiện đủ số liệu và tiền âm/dương.
- Nhân viên thực tế: người theo lịch, nghỉ phát sinh kèm lý do, người hỗ trợ, giờ đến/về, đếm không trùng, không sửa lịch.
- Bàn giao: một mục gốc xuyên ca, giữ nguồn, lưu người và giờ hoàn thành.
- Công nợ: chỉ ghi sổ, không tính vào tiền (chờ chốt).
- Đối soát tiền mặt cuối ngày theo cơ sở.
- Nội quy / Quy trình; các cột Nội quy, Cam kết, Đào tạo (68 hạng mục, 4 trạng thái); Yêu cầu hỗ trợ.
- Quyền kiểm tra ở máy chủ; tiền là số nguyên; giờ Việt Nam; ô bỏ trống khác 0.

## C. Chưa đúng đặc tả — chỗ đã chốt, sửa được ngay

| # | Đặc tả | Hiện tại |
|---|---|---|
| C1 | Người theo lịch được **điền sẵn giờ đến/về theo khung giờ ca** ở cả 3 ca (2.7) | Đang để trống, nhân viên tự nhập |

## D. Khác lớn — cần làm mới (có câu hỏi trước khi làm)

| # | Đặc tả | Hiện tại |
|---|---|---|
| D1 | **Phiếu nhân viên giữ nguyên**; quản lý sửa trên **bản đối soát riêng**; lưu trước/sau, người, giờ, **lý do**; so sánh 2 bản; mở lại = mở lại **đối soát** (2.1, 3) | Chỉ có **một bản phiếu**. Quản lý chỉ tick 9 hạng mục, không sửa số. "Mở lại" trả **chính phiếu gốc** cho nhân viên sửa và xóa hết dấu đối soát |
| D2 | Mỗi hạng mục: CHƯA / ĐÃ ĐỐI SOÁT **và** kết quả tiền THIẾU / THỪA / KHỚP kèm số tiền, không lẫn "đã đối soát" với "khớp" (3) | Chỉ có tick đã / chưa đối soát |
| D3 | **Nhập hàng từ kho tổng**: kế toán tải hóa đơn theo cơ sở; nhân viên mở hóa đơn, chụp ảnh hàng, báo ĐỦ / THIẾU từng món; kế toán xem trạng thái (2.9) | Nhân viên tự chọn Không nhận / ĐỦ / THIẾU và tự chụp ảnh trong phiếu ca |
| D4 | **Tab Kế toán**: hóa đơn giao hàng + chuyển khoản thực nhận theo số dư BIDV từng ca; kế thừa số dư; khóa sau đối soát, mở khi mở lại (4) | Chưa có |
| D5 | **Tab LOG** (chỉ Chủ): tài nguyên, phiên bản, lịch sử phát hành, lịch sử thao tác có trước/sau, lọc; không sửa / xóa được (9) | Có ghi nhật ký đơn giản (ai, làm gì, mô tả chữ), **chưa có trang xem**, không có giá trị trước/sau |

## Đã làm theo câu trả lời của anh (07/11)

- **C1** ✅ Giờ đến/về người theo lịch điền sẵn theo khung ca (tô vàng = gợi ý, sửa được).
- **D1** ✅ Bản đối soát riêng: quản lý sửa toàn bộ (số liệu, giờ doanh thu, thu chi, nhân viên, nhập hàng); phiếu nhân viên giữ nguyên;
  ô khác phiếu gốc ghi "Phiếu NV: …"; lịch sử sửa (trước → sau, người, giờ, lý do không bắt buộc); khóa khi HOÀN THÀNH ĐỐI SOÁT;
  "Mở lại đối soát" → ĐANG ĐỐI SOÁT LẠI → "Hoàn thành đối soát lại". "Mở lại phiếu cho nhân viên sửa" vẫn giữ (bản đối soát làm lại).
  Trang Đối soát và tiền cuối ngày dùng số của bản đối soát, ghi rõ ca chưa xong / đang đối soát lại.
- **D2** ⏸ Kết quả THIẾU/THỪA/KHỚP từng hạng mục: anh chốt sau.
- **A6 / D3 / D4** ✅ Vai trò **Kế toán** (chỉ vào tab Kế toán; tạo ở "Tài khoản riêng" hoặc đổi vai trò ở Phân quyền).
  Tab Kế toán: **Hóa đơn giao hàng** (ảnh / PDF / Excel, nhiều tệp, theo cơ sở + ngày; trạng thái Chưa nhận / Đã nhận đủ / Báo thiếu)
  và **Chuyển khoản thực nhận** (số dư đầu / cuối / chuyển ra theo từng phiếu ca; tiền nhận = cuối − đầu + chuyển ra; số dư đầu gợi ý
  = cuối ca trước; khóa khi HOÀN THÀNH ĐỐI SOÁT; lịch sử sửa ghi chung với lịch sử phiếu). Nhân viên báo nhận trong mục 7 của phiếu
  chốt ca (ít nhất 1 ảnh; THIẾU phải ghi món). Phần nhập hàng cũ giữ nguyên. Bản đối soát hiện số chuyển khoản thực nhận để so.
- ⏸ Chuỗi số dư khi sửa ca cũ, tiền về chậm: chờ chốt — web chỉ cảnh báo khi số dư đầu ≠ cuối ca trước.
- **D5** ✅ Tab **LOG hệ thống** (chỉ Chủ): tài nguyên (CSDL, ảnh & tài liệu theo gói Free; RAM / lưu lượng: "Không có số liệu"),
  phiên bản hiện tại (theo ngày phát hành), lịch sử cập nhật web (Thêm / Thay đổi / Sửa lỗi / Loại bỏ, người cập nhật),
  lịch sử thao tác (thời gian, người, thao tác, đối tượng có link, cơ sở, trước → sau; lọc ngày / người / cơ sở / loại; chỉ xem).
