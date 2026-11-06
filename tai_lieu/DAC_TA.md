# Đặc tả web Quản trị lịch làm cafe (chép từ Project "Xây web quản lý nhân sự" ngày 06/11/2026)

# 1. Tài khoản và đăng nhập (chốt 01/10/2026)
- Đăng nhập bằng mã nhân viên + mật khẩu riêng.
- Mật khẩu lần đầu: quản lý tạo mật khẩu tạm cho từng NV, đưa tận tay; lần đầu đăng nhập bắt buộc đổi.
- Mật khẩu tối thiểu 6 ký tự, không bắt buộc chữ hoa/ký tự đặc biệt.
- Giữ đăng nhập 30 ngày trên thiết bị.
- Quên mật khẩu: NV tự lấy lại qua email (miễn phí). Email do quản lý nhập khi tạo/sửa NV.
  - Mã khôi phục 6 số, hiệu lực 15 phút, tối đa 5 lần yêu cầu/ngày.
  - NV không có email hoặc không nhận được mã: quản lý cấp lại mật khẩu tạm.
  - Có thể bổ sung kênh Zalo (ZNS) sau nếu quán có Zalo OA.
- NV chuyển "Ngừng làm": khóa tài khoản ngay, giữ nguyên lịch sử order và lịch làm.

# 2. Phân quyền (chốt 01/10/2026)
Vai trò hệ thống: Chủ, Quản lý tổng, Quản lý, Nhân viên.
- Có tab "Phân quyền", chỉ Chủ vào được.
- Phân quyền theo vai trò (không chỉnh riêng từng người): bảng chức năng × vai trò, Chủ tick bật/tắt.
- Chức năng trong bảng: Order ca; Xem lịch của mình; Xem order & lịch của mọi người; Xếp lịch (+ xem tab Cảnh báo); Chốt/mở lại tuần; Sửa order sau hạn; Thêm/sửa NV, email, mật khẩu tạm; Cài giờ order; Sửa định biên, giờ ca, lịch cố định.
- Nhân viên luôn có: Order ca, Xem lịch của mình.
- Cấp vai trò & sửa phân quyền, Xóa dữ liệu tuần: luôn chỉ Chủ (không có ô tick).
- Quyền xếp lịch: Chủ và Quản lý tổng. Quản lý thường KHÔNG có quyền xếp lịch.
- Quản lý tổng và Quản lý đều order ca và được xếp vào lịch làm như nhân viên bình thường.
- Quyền xem không giới hạn chi nhánh: Quản lý thường xem được cả 4 chi nhánh.
- Tab còn danh sách người dùng để Chủ gán vai trò cho từng người.
- Mặc định ban đầu: Quản lý tổng có mọi quyền vận hành; Quản lý: order ca, xem lịch mình, xem order & lịch mọi người.

# 3. Danh mục (chốt 01/10/2026)
## Chi nhánh
- Thêm/sửa được. Đóng cửa → "Ngừng hoạt động" (không xóa, giữ lịch sử).
- Hiện có: LHP, ĐK, HS (Milano Coffee), LL (Lela Cafe).
## Ca làm việc
- Thêm/sửa ca và giờ ca được. Ca tắt → không hiện trong lưới order.
- Mỗi chi nhánh 1 bộ giờ ca dùng cho cả tuần (không chia giờ cuối tuần).
- Order theo ca chung cho mọi NV; chi nhánh nào có ca nào xử lý lúc xếp lịch.
- Lưới order = 7 ngày × số ca đang dùng; NV phải chọn đủ mọi ô (thêm ca thứ 4 → 28 ô).
## Nhân viên
- Mã NV do quản lý đặt, sửa được; không trùng. Đăng nhập bằng mã mới sau khi đổi, mật khẩu giữ nguyên. Lịch sử liên kết qua ID nội bộ.
- Thông tin: mã, tên, cấp bậc, trạng thái, vai trò làm việc (nhiều), chi nhánh làm được (nhiều), email, số điện thoại, ngày bắt đầu vào làm.
- Cấp bậc cố định: Thử việc < Cấp 1 < Cấp 2 < Quản lý. Tạm thời không cần thêm/sửa danh sách cấp bậc.
- Cấp bậc ảnh hưởng xếp lịch (vd "mỗi ca ít nhất 1 người từ Cấp 2 trở lên").
- Vai trò làm việc (Chạy bàn, Pha chế…) thêm được vai trò mới.
- Vai trò làm việc ≠ vai trò hệ thống (Chủ/Quản lý tổng/Quản lý/Nhân viên).

# 4. Order ca trên web (chốt 01/10/2026, cập nhật 02/10/2026)
Phạm vi đợt đầu: đăng nhập, danh mục/nhân viên, order ca, xếp lịch tuần. Tạm bỏ đánh giá và voucher.
## Tạo tuần mới
- Tuần KHÔNG tự tạo khi mở xem; chỉ tạo khi bấm "Tạo tuần mới" ở màn hình Order lịch làm.
- Tạo tuần → mọi nhân viên đang làm ở trạng thái "Chưa order".
- Tuần đã có thì KHÔNG tạo lại được; muốn làm lại dùng "Xóa dữ liệu tuần" (chỉ Chủ).
- Nhân viên chỉ order được khi tuần đã được tạo (và trong giờ mở order).
- Quyền tạo tuần gắn với quyền Xếp lịch (mặc định Chủ, Quản lý tổng).
## Màn hình order của nhân viên (ưu tiên điện thoại)
- Đăng nhập bằng mã NV + mật khẩu; nhân viên đăng nhập vào thẳng trang Order ca.
- Order cho tuần kế tiếp. Lưới 7 ngày × số ca đang dùng (hiện 21 ô); mỗi ô "Đi làm được" hoặc "Nghỉ".
- Bắt buộc chọn đủ mọi ô mới gửi được; ô chưa chọn tô đỏ. Không có nút chọn nhanh. Không có ô ghi chú.
- Trước giờ mở: chưa order được. Trước hạn: sửa thoải mái ("Cập nhật order"). Sau hạn: khóa, chỉ xem.
- NV thấy ô bị quản lý sửa, kèm dấu "QL đã sửa". NV đổi lại ô đó trước hạn → mất dấu; chọn giống → giữ dấu.
- Sau khi chốt tuần, NV xem được lịch của mình (ca, chi nhánh, vai trò).
## Quy tắc trạng thái
- "Chưa order" = chưa gửi; hết hạn vẫn giữ "Chưa order" (không tự chuyển Nghỉ).
- NV mới tạo sau giờ hết hạn: "Chưa order" cho tuần đó.
## Giờ order
- Quản lý cài giờ mở/hết hạn lặp lại hằng tuần, tính theo tuần liền trước (mặc định mở 08:00 thứ Hai, hết hạn 22:00 thứ Năm); sửa riêng được từng tuần đã tạo, có nút "Về mặc định".
- Quản lý sửa order (trước hoặc sau hạn) cần quyền "Sửa order sau hạn".
## Màn hình theo dõi order của quản lý (ưu tiên máy tính, theo bản offline 1.7.6)
- Giữ: chọn tuần (tuần trước/sau, chọn tuần theo ngày); bộ lọc (mã/tên, phân cấp, NV có/chưa order, ngày, ca, trạng thái, xóa lọc); ô thống kê (Tổng NV, Có order, Chưa có, Đi làm được, Nghỉ, Chưa order, Ô đã sửa); bảng NV × (thứ × ca) tô xanh/đỏ/xám, chấm đỏ ô quản lý sửa; sửa nhanh nhiều ô (kéo chuột, Cmd/Ctrl, nhấp đúp; Đi làm được/Nghỉ/Chưa order/Hoàn tác/Bỏ chọn); tự động lưu.
- Rê chuột vào chấm đỏ: hiện ai sửa, lúc nào, từ trạng thái gì sang gì.
- "Xóa dữ liệu tuần": chỉ Chủ, phải gõ XOA.
- BỎ: Nhập câu trả lời form; Lưu file mẫu order; Khôi phục bản trước; Ghi đè order vào lịch tổng.

# 5. Định biên và lịch cố định (chốt 01/10/2026)
## Định biên (giữ như bản offline)
- Tab theo chi nhánh; mỗi ca đang bật một khối; hàng = ca – vai trò, cột = Thứ 2 → Chủ nhật; ô = số người cần; dòng tổng ca tự tính; tự động lưu.
- Áp dụng liên tục cho mọi tuần chưa chốt; tuần đã chốt giữ nguyên.
- Không có định biên riêng theo tuần (lễ/Tết sửa trực tiếp).
- Người Thử việc tính bình thường vào định biên.
## Quy tắc cấp bậc
- Mỗi chi nhánh × ca cần ít nhất 1 người từ Cấp 2 trở lên (không phân biệt vai trò).
- Chỉ cảnh báo, không chặn.
- Hiển thị: dấu chấm than (!) tại dòng "Tổng ca" của ca thiếu trên màn hình xếp lịch/lịch cơ sở.
## Lịch cố định (giao diện như bản offline)
- Danh sách NV có lịch lặp lại hằng tuần; mỗi ô thứ × ca chọn "chi nhánh – vị trí" hoặc "Để trống"; chỉ chọn được chi nhánh/vị trí đã khai báo cho NV; ô thống kê (số NV cố định, tổng ca, theo vai trò).
- Chỉ là gợi ý hỗ trợ xếp nhanh. Người có lịch cố định vẫn order đủ lưới như NV thường.
- Order ưu tiên hơn lịch cố định khi xếp:
  - Đi làm được + có lịch cố định → tự điền chi nhánh/vị trí theo lịch cố định (quản lý sửa được).
  - Nghỉ + có lịch cố định → không xếp; ghi chú "Lịch cố định nhưng order Nghỉ".
  - Chưa order + có lịch cố định → không xếp (giữ Chưa order).
  - Đi làm được, không có lịch cố định → để trống cho quản lý xếp tay.
- Sửa lịch cố định không thay đổi lịch các tuần đã xếp.

# 6. Xếp lịch tuần (chốt 01/10/2026)
## Nguyên tắc chung
- Order tự động chảy sang xếp lịch (không có nút "Ghi đè order vào lịch tổng").
- BỎ màn hình "Xếp lịch làm tổng". Xếp lịch chỉ làm trên màn hình Xếp lịch cơ sở của từng chi nhánh.
- Người được xếp lịch: Chủ và Quản lý tổng (theo tab Phân quyền).
- Dấu "!" ở dòng Tổng ca = ca thiếu người Cấp 2 hoặc Quản lý (theo chi nhánh × ca). Khung chi tiết ghi "Cấp 2+: x".
## Màn hình Xếp lịch cơ sở (theo bản offline 1.7.6)
- Chọn tuần (tuần trước/sau, chọn/tạo tuần).
- Thanh công cụ: tick "Hiện cả nhân viên đã đăng ký nghỉ"; nút "Thêm vượt định biên"; Làm mới; nhãn Đã lưu. Tự động lưu.
- Hàng = ca – vai trò – số thứ tự vị trí; số hàng theo ngày cần nhiều nhất; ô thừa ghi "— Ngoài định biên —".
- Màu: trắng = Để trống; vàng = đã xếp; "CĐ" = từ lịch cố định; chấm đỏ = quản lý sửa; nhãn cảnh báo cho Chưa order; viền đỏ ⚠ = Nghỉ hoặc dữ liệu cần kiểm tra.
- Dòng Tổng ca: đã xếp/cần (vd 2/1 là vượt); đỏ khi thiếu, xanh khi đủ; "!" khi thiếu Cấp 2+; rê chuột hiện chi tiết theo vai trò và Cấp 2+.
- Danh sách chọn người khi bấm ô: "Để trống" + 3 nhóm: xanh = Đi làm được; xám = Chưa order; đỏ ⚠ = Nghỉ (chỉ hiện khi tick). Mỗi dòng: mã – tên – cấp bậc. Chỉ NV đang làm, khai báo ở chi nhánh đó và đúng vị trí.
- Người đã xếp ở chi nhánh khác trong cùng ca: ẨN khỏi danh sách.
## Thêm vượt định biên
- Chỉ áp dụng cho tuần đang xếp; KHÔNG sửa định biên gốc.
- Bấm nút → chọn ca + vai trò → thêm 1 hàng "… – Vượt định biên" cho cả tuần; mặc định các ô là "Ngoài định biên".
- Ca có người ở hàng vượt → hiện trong tab Cảnh báo nhóm "Xếp vượt định biên".
## Khóa xếp lịch (mỗi lúc chỉ 1 người xếp)
- Người vào trước giữ quyền sửa; người sau chỉ xem, thấy "Đang được [tên] xếp lịch từ hh:mm".
- Tự nhả khi thoát màn hình xếp lịch hoặc 15 phút không thao tác.
- Chủ có nút "Giành quyền xếp"; người đang xếp nhận thông báo, chuyển sang chỉ xem.
- Khóa áp dụng cho cả tuần (cả 4 chi nhánh).
## Tab Cảnh báo (theo tuần)
- Ai xem: người có quyền xếp lịch. Bấm một dòng → nhảy đến ô đó trên lịch cơ sở. Chỉ cảnh báo, không chặn.
- 7 nhóm: 1) Ca thiếu người so với định biên; 2) Ca thiếu người Cấp 2 hoặc Quản lý; 3) Đã xếp người order Nghỉ; 4) Đã xếp người Chưa order; 5) Xếp vượt định biên; 6) Làm thông 3 ca (≥3 ca/ngày, kể cả khác chi nhánh); 7) Số ca mỗi người trong tuần (chỉ bảng xem).
- Đã bỏ: "Đi làm được nhưng chưa xếp", "Lịch cố định nhưng order Nghỉ", "Nhân viên chưa order".
## Ghi chú triển khai (02/10/2026)
- Cảnh báo: 6 ô tóm tắt trên đầu, các nhóm đánh số 1–7, thu gọn/mở rộng từng nhóm, mỗi dòng có "Xem trên lịch →". Chi tiết thiếu người theo vai trò, vd "Đã xếp 0/2 (Pha chế 0/1, Chạy bàn 0/1)"; thiếu Cấp 2+ ghi "Cấp 2+: 0 · đang có 2 người Thử việc". Huy hiệu đỏ số cảnh báo trên menu.
- Nhóm 7: lọc theo mã/tên và cấp bậc, có đếm số người đang hiện.
- Xóa hàng vượt định biên: nút × trên hàng; xóa được cả hàng đã có người (hỏi xác nhận, gỡ người khỏi ô).
- Màu "Đi làm được" trong danh sách chọn người làm đậm hơn.
- Điện thoại: Lịch cơ sở hiện theo từng ngày (chọn T2…CN, mỗi ca một khối, chạm ô → bảng chọn người trượt từ dưới). Máy tính giữ lưới cả tuần.

# 7. Chốt tuần và nhân viên xem lịch (chốt 01/10/2026)
## Chốt tuần
- 3 trạng thái: Đang xếp → Đã chốt (khóa lịch, NV thấy lịch) → Đang chỉnh sửa (mở lại; NV vẫn xem bản đã chốt gần nhất) → chốt lại.
- Chốt khi còn cảnh báo: vẫn cho chốt, hiện bảng xác nhận tóm tắt (vd "Còn 3 ca thiếu người, 2 ca thiếu Cấp 2+. Vẫn chốt?").
- Sửa sau khi chốt: phải "Mở lại tuần", sửa, rồi chốt lại. Quyền chốt/mở lại theo tab Phân quyền.
## Nhân viên xem lịch
- Xem được: lịch của bản thân + lịch cơ sở của cả 4 chi nhánh.
- Lịch của bản thân: ngày, ca, giờ ca theo chi nhánh, chi nhánh, vị trí.
- Lịch cơ sở bản NV: chỉ xem, rút gọn — ai làm ca nào, vị trí nào. Ẩn: ô Để trống, Ngoài định biên, dòng Tổng ca, dấu "!", nhãn Chưa order/Nghỉ, chấm đỏ.
- Chỉ thấy lịch tuần đã chốt.
- Khi lịch đã chốt bị sửa và chốt lại: gửi thông báo cho từng NV bị ảnh hưởng (phần 8).
## Ghi chú triển khai (02/10/2026)
- Mỗi lần chốt lưu ảnh chụp lịch đã chốt (lịch NV nhìn thấy). Mỗi ca có ghi chú thay đổi so với bản chốt trước: "Ca mới được xếp thêm" hoặc "Đổi từ {ca} – {vai trò}". Lần chốt đầu không đánh dấu.
- Màn hình NV (điện thoại): thanh trên có chuông thông báo; thanh dưới 2 tab Order ca | Lịch làm; Đổi mật khẩu/Đăng xuất ở cuối trang.
  - Lịch của tôi: chọn tuần; thẻ cam "Mới cập nhật" khi lịch bị sửa sau chốt; ca mới/đổi gắn nhãn "Mới cập nhật" + ghi chú.
  - Lịch cơ sở: chọn chi nhánh (4 nút) và ngày (7 nút); mỗi ca liệt kê người + vai trò, dòng của mình có nhãn "Bạn".
- Quản lý cũng có menu "Lịch của tôi" và "Thông báo".

# 8. Thông báo (chốt 01/10/2026)
- Mỗi người dùng có mục Thông báo trên web (chuông + số chưa đọc). Chỉ trong web, KHÔNG gửi email.
- Sự kiện: 1) Mở order tuần mới; 2) Sắp hết hạn order (3 tiếng trước) — chỉ gửi người chưa order; 3) Lịch tuần đã được chốt; 4) Lịch đã chốt bị sửa — chỉ gửi người có ca bị thêm/bỏ/đổi, nội dung cụ thể (vd "Bạn được xếp thêm ca Tối HS – Thứ 5 08/10"; "Ca Sáng LHP – Thứ 3 06/10 đã bị hủy"; "Ca Chiều Thứ 4 đổi từ LHP – Chạy bàn sang ĐK – Pha chế"). Gửi lúc chốt lại, gom thành 1 thông báo/người.
- Không có thông báo thủ công. Thông báo cũ tự xóa sau 60 ngày. Email chỉ dùng khôi phục mật khẩu.
## Ghi chú triển khai (02/10/2026)
- Chuông + số chưa đọc ở thanh trên (NV) và huy hiệu trên menu Thông báo (quản lý). Mở trang Thông báo/Lịch của tôi → đánh dấu đã đọc.
- Mỗi thông báo có đường dẫn tới tuần liên quan (`/lich?tuan=…`), biểu tượng theo loại, thời gian dạng "x phút trước".
- Chống gửi trùng bằng khóa sự kiện (vd `order_mo:{tuần}:{lần mở}`, `sap_het_han:{tuần}:{giờ hết hạn}`).
- Hiện tại web kiểm tra sự kiện đến hạn khi có người mở trang (tối đa 1 lần/60 giây). Khi lên VPS cần thêm tiến trình nền.

# 9. Giao diện điện thoại cho quản lý (02/10/2026)
Giao diện máy tính giữ nguyên; chỉ màn hình hẹp (≤ 760px) mới đổi. Menu quản lý trên điện thoại thu gọn thành nút "☰ Menu".
- Lịch cơ sở: chọn ngày T2…CN; mỗi ca một khối; chạm ô → bảng chọn người trượt từ dưới.
- Order lịch làm: chọn ngày; mỗi NV 3 ô ca tô màu; chạm ô → Đi làm được / Nghỉ / Chưa order; tự lưu, chấm đỏ khi quản lý sửa; giữ bộ lọc tên, phân cấp, đã/chưa order, trạng thái.
- Nhân viên, Phân quyền, Định biên, Chi nhánh/ca/vai trò, Giờ order: bảng nhiều cột → từng thẻ, mỗi dòng có nhãn cột; vẫn sửa trực tiếp.
- Lịch cố định: mỗi NV một thẻ: thông tin + 7 ngày × các ca.
- Cảnh báo: nhóm thu gọn, không tràn ngang.
- Chỉ có trên máy tính: chọn nhiều ô, kéo chọn, Hoàn tác/Bỏ chọn ở Order lịch làm; nút "Xóa dữ liệu tuần".
- Màn hình nhân viên luôn dùng bố cục điện thoại.

# Phụ lục: Database bản offline 1.7.6 (xep_lich.sqlite3, 33 bảng)
- Danh mục: branches (4), shifts (3), branch_shifts (giờ ca từng chi nhánh: LHP 06:45–12:30–17:30–23:00, CN khác 06:30–12:00–18:00–23:00), employees (80; 47 đang làm), employee_roles, employee_branches, settings.
- Xếp lịch: weeks (T2→CN); order_entries + order_import_batches + order_snapshots (ĐI LÀM ĐƯỢC / NGHỈ / CHƯA ORDER); staffing_requirements + staffing_history; fixed_schedule_members + fixed_schedule_entries; employee_work_plans; weekly_schedule_entries (base_status → state ĐÃ XẾP/TRỐNG/NGHỈ/CHƯA ORDER, nguồn ORDER/FIXED/MANUAL); schedule_closures.
- Đánh giá theo đợt: evaluation_criteria (20 tiêu chí/vai trò CB001–CB020, PC001–PC020, tối đa 5 điểm → 100), evaluation_rounds (ngưỡng: Xuất sắc ≥91, Tốt ≥80, Khá ≥65, Trung bình ≥50, Yếu), evaluation_round_criteria, evaluation_round_employees, evaluation_round_scores, evaluation_round_import_batches + raw_submissions.
- Bảng cũ trống, bỏ được: evaluation_periods, evaluation_records, evaluation_scores, evaluation_import_batches, evaluation_raw_submissions.
- Voucher: evaluation_voucher_allocations.
