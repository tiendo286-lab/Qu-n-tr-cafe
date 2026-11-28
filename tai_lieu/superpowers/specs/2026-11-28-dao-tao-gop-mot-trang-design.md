# Đào tạo gộp một trang — thiết kế (anh Tiến 28/11/2026)

## Vì sao
Hai mục "Đào tạo" và "Phân công đào tạo" trùng nhau nhiều (thẻ Phân công + Chờ kiểm tra kiểu cũ ↔ trang phân công theo ca làm 24/11). Anh Tiến muốn: một chỗ duy nhất, mở phiếu của nhân viên ngay tại trang, có bộ lọc.

Bản vẽ mẫu anh đã xem: https://claude.ai/artifact/A2Lt6sPKyWK1ervdYZPZvm

## Anh Tiến đã chốt
- Hai mục nằm ở nhóm **Nhân viên & tài khoản** (web 2026.11.28.6).
- Tiêu đề trang là "Đào tạo" (đã sửa, chưa lên web — lên cùng đợt này).
- **Giữ kiểu phân công theo ca (24/11)**; bỏ kiểu cũ (tích hạng mục theo Ngày 1…8 rồi giao một lần).
- Mở phiếu nhân viên ngay tại trang; thêm bộ lọc.

## Mục tiêu
- Menu còn một mục **Đào tạo** (`#/cong-viec/dao-tao`). Đường cũ `#/dao-tao/phan-cong` và `?tab=phan-cong|kiem-tra` tự chuyển về trang này.
- Trang là danh sách người đang có phiếu (cả Chạy bàn và Pha chế), mỗi người một dòng: tên · cơ sở · chương trình · trạng thái · ngày thứ mấy · đạt x/y · số mục chờ kiểm tra · số ca chưa giao.
- Bộ lọc: tìm tên / mã · cơ sở · chương trình · người hướng dẫn chính · nút trạng thái có số đếm · Bỏ lọc. Giữ lựa chọn khi trang vẽ lại.
- Bấm một dòng → xổ ra ngay bên dưới, có 3 nút: **Phiếu đào tạo** · **Phân công theo ca** · **Chờ kiểm tra (n)**. Bấm lần nữa gập lại. Trang vẽ lại (sau khi lưu) vẫn giữ người đang mở và nút đang chọn.
- Giữ ô lọc "một người dạy phải dạy gì trong một ngày" của trang theo ca.
- Giữ khung chọn **Người phụ trách chính** (chỉ Chủ thấy), để thu gọn ở đầu trang.

## Không làm / không được làm
- Không đổi quyền: ai đang thấy / làm được gì thì giữ nguyên (Chủ, người phụ trách chính, HD chính thấy đủ 3 nút; người khác chỉ thấy phiếu mình liên quan và chỉ có nút Phiếu). Không đụng vùng khoá tiền.
- Không bỏ trang phiếu riêng `#/dao-tao/phieu?id=` — cột Đào tạo ở trang Nhân viên, thông báo, Việc hôm nay vẫn dẫn tới đó.
- Không mất chức năng: mọi nút của hai thẻ cũ phải có chỗ tương ứng trước khi bỏ.

## Các cách đã cân nhắc
1. **Một trang, mỗi người một dòng, xổ tại chỗ (chọn).** Ít bấm, xem liên tiếp nhiều người, hợp điện thoại. Phải lo giữ trạng thái mở khi vẽ lại.
2. Phiếu trong khung nổi đè lên trang. Dễ làm hơn nhưng phiếu dài, trên điện thoại khung nổi khó cuộn; hộp thoại trong phiếu sẽ chồng hộp.
3. Giữ hai mục, chỉ bỏ hai thẻ cũ. Rẻ nhất nhưng không đạt ý "mở phiếu ở đây luôn".

## Điều đã dò được (28/11)
- Thẻ Chờ kiểm tra cũ có nút **Giao giai đoạn 2** và đổi mức trước khi xác nhận; trang theo ca chưa có nút Giao giai đoạn 2 → phải mang sang.
- Thẻ Phân công cũ có "Trả về HD chính", chọn cơ sở, ghi chú; trang theo ca có bỏ giao theo ca (`app_dt_plan_unassign`). Người làm kế hoạch dò tiếp từng nút, thiếu thì báo anh.
- Trang phiếu (`phieu_dao_tao.js`) trả `{html, mount}` và tự vẽ lại bằng `rerender` của app → nhúng được, cần nhớ người đang mở.
- Dữ liệu: `app_dt_work_list` (danh sách phiếu), `app_dt_plan_board` (bảng theo ca). Nếu danh sách thiếu cơ sở / mã để lọc thì thêm một tệp SQL chỉ bổ sung trường đọc, không đổi quyền.

## Em tự quyết (anh sửa được)
- Mặc định ẩn người **Đã hoàn thành**; bấm nút trạng thái "Đã hoàn thành" mới hiện.
- Phiếu chỉ tải khi bấm mở (không tải sẵn mọi phiếu) để trang nhanh.
- Thứ tự dòng: có mục chờ kiểm tra / ca chưa giao lên trước, rồi theo hạn.

## Kiểm tra
- Bài thử mới cho trang gộp (role chu, ql = HD chính, kt + người phụ trách chính, ql2, c1, nv; máy tính + điện thoại 390px, không tràn ngang).
- Sửa `flow_dt170`, `flow_pcdt`, `flow_dt137`, `flow_dt169`, `flow_hn142`, `menu_dt` theo đường mới; không bỏ câu kiểm tra nào về quyền.
