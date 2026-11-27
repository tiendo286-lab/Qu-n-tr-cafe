# Thiết kế: Bảng tiền chênh lệch (27/11/2026) — CHỜ ANH TIẾN DUYỆT

Hình mẫu (dữ liệu giả): https://claude.ai/artifact/3tT5iPsxVtdFuY9Cfcsx5o

## Anh Tiến nói gì

- "T muốn có giao diện bảng tiền chênh lệch này để sẽ đối soát cho chủ và quản lý."
- "Lên thiết kế trước khi sửa toàn bộ."

Anh chưa tả từng cột / từng nút. Mọi điểm dưới đây là **đề xuất của em**, anh chưa xác nhận.

## Vì sao cần

Tiền chênh lệch của ca (tiền thực tế khác tiền phải có) đang nằm rải ở 3 chỗ: trong từng ca (trang đối soát ca, bước Tiền), ở Sổ thu chi › Tổng › Việc cần làm (lẫn việc khác, mỗi lần một cơ sở, chỉ ca còn chờ), và Sổ chi lọc "Có trừ lương". Chủ và quản lý không có một chỗ nhìn hết chênh lệch của các ca, các cơ sở để soát.

## Mục tiêu

- Một trang dạng bảng: mỗi dòng là một chênh lệch của một ca (theo từng loại tiền: tiền mặt / chuyển khoản).
- Nhìn được cả tháng, một cơ sở hoặc mọi cơ sở; thấy ngay còn bao nhiêu chờ xử lý, bao nhiêu chờ Chủ duyệt, đã xử lý bằng cách nào.
- Từ một dòng đi thẳng tới chỗ xử lý.

## Không làm (ngoài phạm vi)

- Không đổi cách tính tiền phải có / thực tế / lệch — dùng đúng số của Sổ thu chi và trang đối soát ca.
- Không đổi luật ai được xử lý, ai được duyệt, lúc nào bị khoá.
- Không gộp khoản nợ khách, khoản chi thường vào bảng này.

## Điều phải tránh

- Số trên bảng khác số trong ca (dù chỉ một dòng) — bảng sẽ mất tin.
- Người không được xem tiền của cơ sở lại thấy qua bảng này.

## Trang trông thế nào

Vị trí: menu **Quản lý ca**, tên **Chênh lệch tiền**, cạnh Sổ thu chi. Ai vào được: người đang vào được Sổ thu chi (quyền đối soát, đúng các cơ sở được xem) và Chủ. Nhân viên không vào.

Từ trên xuống:

1. Chọn tháng; chọn cơ sở (Tất cả cơ sở / từng cơ sở).
2. Năm ô tổng: Tổng thiếu · Tổng dư · Còn chờ xử lý · Chờ Chủ duyệt · Đã xử lý xong (ghi rõ trừ lương, quán chịu, cách khác).
3. Nút lọc: Tất cả / Chờ xử lý / Chờ Chủ duyệt / Đã xử lý; Chỉ thiếu / Chỉ dư; Tiền mặt / Chuyển khoản.
4. Bảng, mỗi dòng: Ngày · ca — Cơ sở — Loại tiền — Phải có — Thực tế — Lệch (thiếu đỏ có dấu −, dư xanh có dấu +) — Người làm ca — Đã xử lý bằng (vd "Trừ lương A 40.000 · B 40.000", "Quán chịu 60.000 — chờ Chủ duyệt", "Ghép với ca …", "Gán nợ khách trả …", "Phiếu thu") — Còn lại — Trạng thái — nút **Mở ca ›**.
5. Dòng tổng của những dòng đang hiện.

Trạng thái một dòng: **Chờ xử lý** (còn tiền chưa có cách xử lý) · **Chờ Chủ duyệt** (đã chọn quán chịu / ghép ca, chờ Chủ) · **Đã xử lý** · **Lệch nhỏ** (dưới mức phải xử lý, chỉ để biết).

Điện thoại: không dùng bảng ngang; mỗi chênh lệch là một thẻ, đủ các thông tin trên.

## Các cách làm đã cân nhắc

- **A — Bảng chỉ xem, bấm "Mở ca" sang bước Tiền của trang đối soát ca để xử lý (em đề nghị làm trước).** Không đụng luật tiền / quyền nào; số lấy từ đúng nguồn đang chạy; làm nhanh, ít rủi ro. Nhược: muốn xử lý vẫn phải sang trang ca.
- **B — Xử lý ngay trên bảng.** Dòng "Chờ Chủ duyệt" có Duyệt / Từ chối cho Chủ; dòng "Chờ xử lý" mở phiếu chênh lệch ngay tại bảng (trừ lương, quán chịu, ghép ca, phiếu thu, gán nợ) bằng đúng hàm và luật đang chạy. Tiện hơn nhiều cho Chủ khi duyệt hàng loạt. Nhược: đụng vùng khoá tiền đối soát — phải báo anh từng điểm, thử kỹ bộ vùng khoá.
- **C — Bảng có luật xử lý riêng.** Loại: hai nơi hai luật thì số sẽ lệch nhau.

**Đề nghị:** làm A thành đợt 1 (anh dùng thử, chỉnh cột / lọc cho vừa ý), rồi B thành đợt 2 nếu anh muốn bấm duyệt ngay trên bảng. Anh chưa chọn.

## Câu cần anh trả lời trước khi làm

1. Đợt 1 chỉ xem + Mở ca (A), hay làm luôn cả duyệt / xử lý trên bảng (A + B)?
2. Bảng có hiện cả dòng "Lệch nhỏ" không, hay ẩn mặc định?
3. Ca chưa có đủ số (chờ kế toán, chưa xác nhận Fabi) thì lệch chưa chắc đúng — hiện kèm nhãn "số tạm" hay ẩn tới khi đủ số? (Em nghiêng: hiện, kèm nhãn "số tạm".)
4. Quản lý cơ sở thấy mọi cơ sở hay chỉ cơ sở mình được xem tiền? (Em nghiêng: theo đúng quyền xem tiền từng cơ sở như Sổ thu chi.)

## Để người làm tự quyết

- Lấy số từ hàm tháng của Sổ thu chi cho từng cơ sở hay viết một hàm đọc gọn riêng (chỉ đọc) — miễn số khớp từng ca với trang đối soát ca; phải có bài so trên dữ liệu thật như đã làm cho trang đối soát ca mới (271 ca khớp hết).
- Cách sắp xếp mặc định (đề nghị: chờ xử lý lên trước, rồi ngày mới nhất).
