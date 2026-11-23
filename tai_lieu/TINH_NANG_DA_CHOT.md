# Tính năng đã chốt — web quản lý Milano & Lela

Cập nhật: 07/11/2026 · Web: https://tiendo286-lab.github.io/Qu-n-tr-cafe/

Tên app: **Quản trị cafe**. Tông màu chủ đạo (anh Tiến chốt 07/11/2026): nâu espresso, caramel, nền kem, chữ tiêu đề kiểu có chân (Playfair Display) — định nghĩa ở cuối `docs/assets/them.css`.

Từ ngày 07/11/2026, **web là nơi duy nhất** lưu lịch, order và các dữ liệu khác. Trang web không còn chức năng nhập dữ liệu từ bản offline, nên **mọi việc sửa trên bản offline sẽ không lên web nữa**.

---

## 1. Menu của Chủ và Quản lý — phương án C: chia nhóm có tiêu đề (anh Tiến chọn 11/11/2026)

| Nhóm | Mục | Tab con | Ghi chú |
|---|---|---|---|
| — | **Tổng quan** | | **Tạm ẩn 11/11/2026** — đăng nhập vào thẳng tab đầu tiên (Quản lý ca › Chốt ca). Sẽ làm lại thành bảng "Việc cần xử lý" (phương án đã gửi: việc GẤP đỏ / CẦN LÀM vàng theo nhóm Vận hành · Tiền · Nhân sự, Số liệu nhanh cho Chủ + QL tổng) khi đủ tính năng — CHỜ CHỐT. |
| VẬN HÀNH | **Quản lý ca** | Chốt ca · Đối soát · Thu chi | Phiếu chốt ca theo ngày, đối soát 9 mục; Thu chi (gồm phiếu chi trừ lương = khoản âm). Tab Báo cáo đã bỏ (10/11/2026); phần Khoản âm riêng đã bỏ (11/11/2026). |
| | **Xếp lịch tuần** | Order · Lịch cơ sở · Lịch tổng · Cảnh báo · Chốt & báo cáo | Xem bảng chi tiết ở mục 2 |
| | **Công việc** | Công việc · Việc của tôi | Xem bảng chi tiết ở mục 3 |
| TIỀN | **Sổ quỹ & chốt tháng** | Sổ quỹ · Chốt tháng | Sổ quỹ có ô Quỹ ngoài (chỉ Chủ) — mục 5g |
| | **Kế toán** | Hóa đơn giao hàng · Chuyển khoản thực nhận | Chỉ Kế toán và Chủ |
| NHÂN SỰ | **Nhân viên & tài khoản** | Nhân viên · Phân quyền | Tài khoản đăng nhập nằm ngay trong danh sách nhân viên |
| | **Nội quy & quy trình** | Nội quy · Quy trình | Soạn, đăng; nhân viên bấm "Tôi đã đọc" |
| HỆ THỐNG | **Cài đặt xếp lịch** | Định biên · Chi nhánh, ca & vai trò · Giờ order · Lịch cố định | |
| | **Dữ liệu & LOG** | Dữ liệu & sao lưu · LOG hệ thống | Gộp 11/11/2026. Chỉ Chủ |
| | **Hỗ trợ** | Yêu cầu hỗ trợ | Nhắn qua lại giữa nhân viên và quản lý |
| — | **Của tôi** | Order ca · Lịch của tôi · Phiếu đào tạo · Khoản âm của tôi | |

Thanh dưới trên điện thoại của nhân viên có 6 nút: **Order ca · Lịch làm · Việc · Chốt ca · Nội quy · Hỗ trợ**.

---

## 2. Xếp lịch tuần

| Chức năng | Đã chốt |
|---|---|
| Trạng thái tuần | Đang order → Đang xếp → Đã chốt → (Mở lại) Đang chỉnh sửa. Tuần đã có ca xếp mà chưa ghi trạng thái thì tính là **Đang xếp**, giống bản offline. |
| Nút "Bắt đầu xếp lịch" | Không hiện và bị máy chủ chặn khi tuần đã có ca được xếp, để không xóa mất lịch. **Từ 09/11 (bước 26):** bấm được cả khi order chưa hết hạn — web hỏi lại, bấm xong thì **order của tuần đó đóng ngay** (muốn mở lại: "Quay lại order" rồi cài giờ hết hạn mới). |
| Nút "Xóa lịch tuần" (09/11) | Có ở trang Xếp lịch cơ sở (trước chỉ ở Lịch tổng). Xóa mọi ca đã xếp của tuần ở **tất cả cơ sở** (kể cả lịch cố định), order giữ nguyên, quay về bước "Bắt đầu xếp lịch". Phải gõ chữ XOA. Không hiện / bị chặn khi tuần đã chốt ít nhất một lần (nhân viên đã thấy lịch). |
| Quản lý sửa order | Lịch tự cập nhật theo các trường hợp ở dòng bên dưới. Cần quyền "Sửa order sau hạn" (mặc định Chủ, Quản lý tổng). |
| Ô đã xếp mà order đổi sang Nghỉ | Web **không tự gỡ** người khỏi ca. Ô hiện viền đỏ ⚠ và có tên trong tab Cảnh báo. |
| Tuần đã chốt | Nhân viên giữ bản đã chốt. Muốn đổi thì bấm "Mở lại tuần để sửa". Chốt lại thì nhân viên có ca thay đổi nhận thông báo. |
| Một người xếp một lúc | Ai đang mở trang xếp thì người khác chỉ được xem. Quyền tự nhả sau 15 phút. Chủ có nút "Giành quyền xếp". |
| Tài khoản chỉ có quyền xem | Trang hiện dòng vàng nói rõ lý do không xếp được. |
| Trang Order | **Đã bỏ:** Nhập câu trả lời Form, Tải file mẫu order, Khôi phục bản trước. **Còn:** Xóa order tuần (phải gõ chữ XOA), Xóa dữ liệu tuần (chỉ Chủ). |

---

## 3. Công việc

Đường đi của một việc: **Cần xử lý → chọn người nhận → Chờ nhận → Đang xử lý → Đã xử lý**

| Tab / bước | Đã chốt |
|---|---|
| **Cần xử lý** (tab đầu) | Gồm nội dung bàn giao ca chưa xong và việc Chủ tự ghi nhưng chưa giao. Chọn người nhận (hạn không bắt buộc) rồi bấm **Giao việc**. Bàn giao ca không cần giao ai thì bấm **"Đã xong, không cần giao"**. |
| Người nhận | Mọi nhân viên đang làm và có tài khoản: Quản lý tổng, Quản lý, Nhân viên. Không tự giao cho chính mình. |
| Chờ nhận → Đang xử lý | Nhân viên bấm **Nhận việc**, người giao nhận thông báo. |
| Đang xử lý → Đã xử lý | Nhân viên bấm **Đã xử lý**; ghi kết quả là không bắt buộc. Người giao nhận thông báo. Việc lấy từ bàn giao ca thì phiếu ca cũng tự ghi "Đã xử lý". |
| Duyệt | **Không còn bước duyệt.** Người giao có nút **Yêu cầu làm lại** (bắt buộc ghi lý do), việc quay về Đang xử lý. |
| Đổi người / Bỏ giao | Ở Chờ nhận và Đang xử lý đổi được người nhận và hạn. "Bỏ giao" đưa việc về Cần xử lý. |
| Họp | **Đã bỏ.** Đường dẫn cũ tự chuyển sang trang Công việc. |
| Nhắc việc | Mỗi lần mở app, người có việc chưa xong thấy hộp nhắc. Menu có số đếm việc. |
| Quyền giao việc | Quyền "Giao việc cho nhân viên". Mặc định chỉ Chủ; hiện Quản lý tổng **cũng đang được bật**. |
| Giao diện (07/11) | Dạng bảng: thanh trạng thái tô màu (Cần xử lý đỏ · Chờ nhận vàng · Đang xử lý xanh dương · Đã xử lý xanh lá) có số đếm + thanh tỉ lệ; ô tìm kiếm; bộ lọc người nhận / mức độ / hạn / nguồn; bấm một việc mở hộp chi tiết (giao, đổi người / hạn / mức độ, yêu cầu làm lại, xóa). |
| Loại công việc (07/11) | **Vận hành** (Hỏng hóc, Đối soát ca, Khoản âm, Bàn giao ca, Vệ sinh, Nhập hàng, Khác) và **Quản lý** (Đào tạo nhân viên, Nội quy & quy trình, Cam kết, Nhân sự & lịch, Khác). Thanh chọn loại ở đầu tab, lọc theo nhóm. Tệp `supabase/22_loai_cong_viec.sql`. |
| Việc tự sinh (07/11) | Hiện ở Cần xử lý, bấm Giao như việc thường (giữ đường dẫn tới trang liên quan): ca chờ đối soát, ca quá giờ chưa chốt (gộp theo ngày, 3 ngày gần nhất), khoản âm chưa xử lý, nhân viên chưa đọc bản mới nội quy/quy trình, chưa ký / chưa nộp cam kết, đào tạo quá 8 ngày. Đã giao (còn mở) thì không hiện lại; tình trạng hết thì tự mất. |
| Mức độ (07/11) | **Thấp / Bình thường / Gấp** (cột `tasks.priority`, tệp `supabase/20_muc_do_viec.sql`). Việc Gấp: thông báo ghi "Việc GẤP", xếp lên đầu ở Việc của tôi. |

---

### 3b. Trung tâm Công việc — chốt và triển khai 15/11/2026 (bước 108, máy chủ 94)

Thay giao diện mục 3 bằng **Theo dõi công việc · Phân công & tự động · Việc của tôi**; giữ đường dẫn cũ. Tông nâu, xanh rêu, nền kem; điện thoại dùng thẻ và biểu mẫu một cột.

- **+ Thêm việc:** việc một lần; chọn nhóm, cơ sở, tài khoản chính, dự phòng, người theo dõi, hạn ngày/giờ, mức độ. Giao được cho tài khoản Kế toán riêng, người được thêm quyền Kế toán và Chủ; không cần gắn hồ sơ nhân viên. Giao việc không cấp thêm quyền nguồn.
- **+ Quy tắc tự giao:** nguồn đối soát ca, đầu vào kế toán, đối soát hàng, thiếu ảnh/hóa đơn giao, giao bù/hóa đơn bổ sung, đọc và đôn đốc đọc tài liệu, cam kết, đào tạo; hoặc lịch ngày/tuần/tháng. Chọn tài khoản, quản lý được giao cơ sở, hoặc người thực hiện trên hồ sơ. Nếu nhiều quản lý cùng phụ trách thì dùng dự phòng hợp lệ hoặc Chờ phân công.
- **Xem trước trước khi bật:** xem số việc mới, hồ sơ đã có việc, người nhận hoặc lý do chưa giao. Mặc định không tự bật quy tắc và không giao dồn tồn cũ khi cài đặt. Muốn gồm tồn cũ phải chọn rõ. Đổi quy tắc giữ nguyên việc đã tạo; Chuyển người là thao tác riêng có danh sách xem trước và lý do.
- **Trạng thái:** Chờ phân công · Chờ nhận · Đang làm · Chờ đầu vào · Chờ xác nhận · Hoàn thành · Đã hủy. Việc thủ công có thể chọn người xác nhận khác người làm; để trống thì báo xong là hoàn thành như trước.
- **Việc nguồn:** mở đúng hồ sơ, tự xong khi nghiệp vụ thật xong; nguồn mở lại thì việc mở lại, giữ lịch sử. Ca thiếu dữ liệu kế toán ghi rõ đang chờ. Cam kết chỉ xong ở Đã ký và nộp. Đào tạo theo kết quả phiếu và hạn chương trình 8 ngày. Tài liệu tính đúng nhân viên/phiên bản; quy trình cũng có nút xác nhận đọc. Người đôn đốc xem tiến độ từng nhân viên.
- **Vận hành:** một khóa công việc cho mỗi nghĩa vụ/lượt lịch, chống trùng tại CSDL. Không cắt bỏ hồ sơ tồn theo số ngày nhìn lại. Người khóa/ngừng làm/mất quyền chuyển dự phòng hợp lệ hoặc chờ phân công; nhắc gộp mỗi ngày và báo người theo dõi khi quá hạn. Hủy/khôi phục có lý do, không xóa lịch sử.
- **Quyền:** người có quyền Giao việc quản trị trung tâm và quy tắc. Người nhận chỉ xem phần của mình; người theo dõi/xác nhận cần quyền Giao việc. Không tự tạo vai trò “admin” hoặc nâng quyền người được giao.

## 4. Nhân viên & tài khoản

| Chức năng | Đã chốt |
|---|---|
| Trang Nhân viên | Danh sách, bộ lọc, sửa nhanh cấp bậc, các cột Nội quy / Cam kết / Đào tạo, tạo phiếu đào tạo. **Đã bỏ:** Nhập file Excel, Tải file mẫu, Xuất danh sách cho Google Form. |
| Quyền Kế toán (chốt + ĐÃ LÀM 11/11/2026, `supabase/40_quyen_ke_toan.sql`) | Kế toán là **quyền cộng thêm cho từng người**: trang Phân quyền › cột "Thêm quyền Kế toán" (chỉ Chủ). Người được cấp giữ nguyên vai trò cũ (vẫn order, chốt ca, xem lịch…) và thêm tab Kế toán (Hóa đơn giao hàng, Chuyển khoản thực nhận) — phạm vi chỉ tab Kế toán. Vai trò hệ thống "Kế toán" (chỉ làm kế toán) vẫn giữ cho tài khoản riêng. |
| Tài khoản đăng nhập | **Gộp vào bảng Nhân viên**: cột Tài khoản (trạng thái, vai trò, lần đăng nhập cuối) + nút **Tài khoản ▾** (cấp mật khẩu tạm, khóa / mở khóa, đăng xuất mọi nơi). Nút **Cấp & in mật khẩu hàng loạt**. Cuối trang: **Tài khoản riêng** (kế toán, chủ thứ hai…). |
| Ngừng làm / Đi làm lại | Nút **Ngừng làm** ở cột cuối danh sách Nhân viên và ở trang sửa nhân viên (mục "Nghỉ việc"). Bấm thì web hỏi lại, sau đó tài khoản bị khóa ngay, người đó không còn hiện trong order và xếp lịch mới, lịch sử giữ nguyên. Nếu người đó còn ca đã xếp từ hôm nay trở đi thì web nhắc vào Xếp lịch thay người (không tự xóa ca). Người đã ngừng làm có nút **Đi làm lại** (tick "Hiện cả người ngừng làm"). Không tự chuyển chính mình, không chuyển Chủ; Quản lý tổng thì chỉ Chủ đổi được. (10/11/2026) |
| Phân quyền | Bật / tắt quyền theo vai trò: Quản lý tổng, Quản lý, Nhân viên. |

---

## 5. Dữ liệu & sao lưu

- Xem số liệu hiện có: nhân viên, tuần, ô order, ô lịch, phiếu chốt ca, công việc…
- Nút **Tải gói dữ liệu ZIP**: gói gồm toàn bộ dữ liệu (lịch, order, nhân viên… + phiếu chốt ca, công việc, nội quy, cam kết, đào tạo, hỗ trợ). Không gồm mật khẩu và ảnh. Nên tải hằng tuần và cất vào máy tính hoặc Google Drive.
- **Đã bỏ** phần nhập dữ liệu từ bản offline.

### Kế toán › Chuyển khoản thực nhận — tài khoản nhận tiền (07/11/2026)
- Kế toán / Chủ thêm, sửa, ngừng dùng tài khoản ngân hàng nhận tiền cho **từng chi nhánh** (một chi nhánh có thể nhiều tài khoản; mỗi tài khoản thuộc một chi nhánh).
- Mỗi ca: nhập số dư đầu / cuối / tiền chuyển ra cho **từng tài khoản**; tiền nhận trong ca = tổng các tài khoản. Số dư đầu gợi ý = số dư cuối của cùng tài khoản ở ca trước.
- Tài khoản đã có số dư: không xóa, không đổi số / ngân hàng / chi nhánh (chỉ **Ngừng dùng**) để giữ lịch sử. Bảng CSDL: `bank_accounts`, `bank_account_balances` (tệp `supabase/19_...`).

---

## 5b. Quản lý ca — chốt và ĐÃ LÀM 07/11/2026 (tệp supabase/21_quan_ly_ca_chot.sql)

| # | Điểm | Anh Tiến chốt |
|---|---|---|
| 1 | Kết quả đối soát | Các hạng mục tiền (Tiền mặt, Chuyển khoản, Thu chi, Công nợ) có kết quả **KHỚP / THIẾU / THỪA**: web tự tính số lệch, quản lý xác nhận; THIẾU / THỪA bắt buộc ghi lý do. |
| 2 | Khoản âm (thiếu tiền) | Khi đối soát ra âm, quản lý **gán luôn nhân viên** chịu khoản âm đó (chia tiền từng người); web **báo cho nhân viên bị âm**. Nhân viên: trang **Khoản âm của tôi** (Đã xem, giải trình). Quản lý: tab **Khoản âm** (Chưa xử lý / Đã bù / Trừ lương / Miễn — Miễn phải ghi lý do). Mở lại phiếu cho NV sửa → khoản chưa xử lý bị hủy + báo. **Bổ sung 11/11/2026 (`33_khoan_am_tru_luong.sql`):** web tích sẵn mọi nhân viên làm trong ca và **chia đều** số thiếu cho người được tích (bỏ tích / sửa số được); mỗi khoản **mặc định ghi Trừ lương** ngay (ghi "(mặc định)"), nhân viên vẫn giải trình được. Khoản mặc định vẫn tự đổi / hủy khi quản lý đổi kết quả hoặc mở lại phiếu; quản lý chọn tình trạng bằng tay thì thành chính thức. |
| 3 | Công nợ | Tính vào doanh thu, không nằm trong tiền mặt / chuyển khoản: Mục 1 = Mục 2 + Mục 3 + Công nợ phát sinh. Thu được nợ thì cộng vào tiền mặt / chuyển khoản của ca thu, ghi "thu nợ của ca X". |
| 4 | Tiền đầu ca lệch két cuối ca trước | Không cho hoàn thành phiếu nếu chưa ghi lý do lệch. |
| 5 | Số dư ngân hàng | Sửa ca cũ: web chỉ báo các ca sau lệch chuỗi, không tự sửa. Tiền về chậm: kế toán ghi "tiền về sau của ca X", web cộng bù vào đúng ca X. |
| 6 | Giờ bắt đầu ca Tối | Tự lấy giờ kết thúc ca Chiều (như ca Chiều lấy theo ca Sáng). |
| A | Bảng ca hôm nay | 5 cơ sở × 3 ca, ô tô màu theo trạng thái (chưa mở · đang chốt · chờ đối soát · đối soát xong · có lệch). |
| F | Phiếu ca từng bước trên điện thoại | Số liệu → Thu chi → Nhân sự → Bàn giao → Nhập hàng → Hoàn thành. |
| G | Báo cáo tuần / tháng | **Đã bỏ 10/11/2026** (thay bằng tab Thu chi, xem 5f). Doanh thu theo tháng xem ở Chốt tháng. |

## 5f. Tab Thu chi (Quản lý ca) — chốt và ĐÃ LÀM 10/11/2026 (tệp supabase/28_thu_chi.sql, trang #/quan-ly/thu-chi)

| Điểm | Anh Tiến chốt |
|---|---|
| Vị trí | Mục **Quản lý ca**: Chốt ca · Đối soát · **Thu chi**. Bỏ tab Báo cáo. **11/11/2026 (`34_phieu_chi_tru_luong.sql`): bỏ hẳn phần Khoản âm** — mỗi người chịu thiếu tiền (từ đối soát ca) là 1 **phiếu chi "Thiếu tiền ca – <nhân viên>"** ngay trong danh sách Thu chi (ô tổng "Trừ lương (khoản âm)", lọc "Phiếu trừ lương"). Không tính vào tổng chi của quán. Quản lý + Chủ bấm **Sửa** (người chịu, số tiền, Trừ lương / Đã bù / Miễn — Miễn phải ghi lý do) hoặc **×** xóa (thành Đã hủy, báo nhân viên) tới khi tháng bị chốt. Đường dẫn cũ #/quan-ly/khoan-am mở Thu chi lọc sẵn phiếu trừ lương. Nhân viên vẫn xem và giải trình ở **Khoản âm của tôi**. |
| Nguồn khoản thu chi | (1) **Quản lý tự tạo** (nút "+ Thêm khoản thu / chi": cơ sở, ngày, thu / chi, nhóm bắt buộc, nội dung, số tiền, tiền mặt / chuyển khoản) → **Đã đối soát**. (2) **Từng dòng thu chi ở phiếu chốt ca** đã hoàn thành → **Chờ đối soát**. |
| Đối soát 1 dòng | Quản lý chọn nhóm (hoặc "Không tính" nếu không phải thu / chi thật, vd giải trình lệch tiền) rồi bấm **Đối soát**. Có nút **Bỏ đối soát** để trả về chờ. Phiếu ca bị sửa dòng đó thì dòng mới lại chờ đối soát. Chọn nhóm ở trang Chốt tháng cũng tính là đã đối soát. |
| Ai dùng | Người có quyền Đối soát (mọi cơ sở) + quản lý được giao cơ sở ở Chốt tháng. |
| Trang | Theo tháng, lọc cơ sở (Tất cả / từng cơ sở), ô Tổng thu · Tổng chi · Thu − chi · Chờ đối soát (bấm để lọc); lọc trạng thái, thu / chi, nguồn, tìm chữ. Dùng chung dữ liệu với Chốt tháng (không tính 2 lần). |
| Chốt tháng | Phải đối soát hết khoản thu chi từ phiếu ca của tháng mới chốt được. Tháng đã chốt thì không sửa / đối soát được. |

## 5g. Sổ quỹ (Chốt tháng › Sổ quỹ) — anh Tiến chốt 11/11/2026

Làm 3 đợt. **Đợt 1 ĐÃ LÀM 11/11/2026** (tệp supabase/29_so_quy.sql, trang #/quan-ly/so-quy). **Đợt 2 + 3 ĐÃ LÀM 11/11/2026** (tệp supabase/30_quy_ngoai_doi_chieu.sql): Quỹ ngoài ở Sổ quỹ › ô "Quỹ ngoài" (chỉ Chủ thấy), bảng đối chiếu ở Chốt tháng mục 6.

| Điểm | Anh Tiến chốt |
|---|---|
| Hai quỹ mỗi cơ sở | **Tiền mặt** (ngoài két — 1.000.000đ đầu ca sáng để nguyên trong két) và **Tài khoản**. Hằng tháng rút hết về 0 (tài khoản chuyển hết). Sổ bắt đầu 01/11/2026; số dư đầu (nếu còn) quản lý nhập 1 lần. |
| Tiền vào | Tiền mặt: **nộp quỹ cuối ngày** tự tính = số đếm cuối ngày − 1.000.000đ (quản lý sửa / nhập tay được, nhập bổ sung các ngày tháng 11) + NV bù khoản âm. Tài khoản: chuyển khoản thực nhận theo số dư kế toán nhập (ngày chưa có thì quản lý nhập tay). |
| Thu chi | Mọi khoản thu chi quản lý tạo (tab Thu chi) đi qua sổ theo hình thức tiền mặt / chuyển khoản. Thu chi ghi trên phiếu chốt ca không tính lại (đã nằm trong số đếm két). |
| Phiếu rút | Quản lý hoặc Chủ tạo: tiền mặt / chuyển khoản, "Rút giữ hộ" (giữa tháng) hoặc "Rút cuối tháng" (tự điền toàn bộ số dư). Quản lý tạo thì Chủ được báo. **Chủ bấm "Đã nhận tiền" → khóa**, không ai sửa / xóa được. Tiền rút không phải chi phí. |
| Kiểm quỹ | Nhập số đếm / số dư app ngân hàng → KHỚP / THIẾU / THỪA so với sổ; lệch phải ghi lý do. Ô Tài khoản cũng so với số dư kế toán nhập ở ca gần nhất. |
| Nhắc rút bớt | Quỹ tiền mặt vượt **20.000.000đ** → báo Chủ, Quản lý tổng và quản lý của cơ sở (mỗi ngày tối đa 1 lần). |
| Ai dùng | Người có quyền Đối soát + quản lý được giao cơ sở. Tháng đã chốt thì sổ chỉ xem. |
| Quỹ ngoài (đợt 2) | Chỉ Chủ. Tiền vào = phiếu rút Chủ đã nhận (có danh sách phiếu chờ nhận ngay ở Quỹ ngoài); Chủ ghi thu chi ngoài (tiền nhà, lương, kho tổng…) tiền mặt / chuyển khoản; mỗi khoản chọn cách chia: theo tỉ lệ doanh thu tháng (mặc định) / chia đều / 1 cơ sở / tự nhập (tổng phải bằng số tiền). Phần chia tính vào chi phí (thu) của cơ sở ở Chốt tháng; quản lý chỉ thấy phần của cơ sở mình. Phải chia hết mới chốt tháng. Cơ sở đầu tiên chốt tháng thì số chia của tháng đó được giữ cố định và khoản ngoài tháng đó bị khóa; mở lại hết các cơ sở thì tính lại. |
| Đối chiếu (đợt 3) | Tiền phải rút về = Lãi tạm tính − khách nợ phát sinh + thu được nợ + chi phí chia từ quỹ ngoài (không lấy tiền quán) + thu chi phiếu ca "Không tính" − khoản âm NV + NV bù khoản âm + số dư quỹ đầu tháng. So với tiền đã rút (phiếu rút trong tháng) → KHỚP / LỆCH; web chỉ ra lệch do đâu (còn trong quỹ chưa rút, tiền mặt nộp quỹ chênh phiếu ca, chuyển khoản về chênh phiếu ca). Lệch thì phải ghi lý do mới chốt tháng. Bảng Tổng hợp Chốt tháng có cột "Đối chiếu tiền". |

## 5h. Nhập hàng từ kho tổng — anh Tiến chốt 11/11/2026, ĐÃ LÀM 11/11/2026 (tệp supabase/31_nhap_hang_kho_tong.sql, docs/js/nhap_hang.js, trang #/ke-toan/hoa-don)

Thay cho mục 7 phiếu ca hiện tại (đang có 2 cách song song: chọn Không nhận / Đủ / Thiếu cho mọi ca, và báo nhận theo hóa đơn kế toán). Phiếu cũ giữ nguyên để xem.

| Điểm | Anh Tiến chốt |
|---|---|
| Kế toán tải hóa đơn | **Trước khi giao** phải tải **file Excel** hóa đơn chuyển hàng cho từng cơ sở → trạng thái **ĐANG CHUYỂN**. Web **đọc Excel, tự lên danh sách hàng** (tên, đơn vị, số lượng) + tổng bill; kế toán soát / sửa rồi gửi. Đang chuyển thì kế toán còn sửa / hủy được; nhân viên đã báo nhận thì khóa. Một ngày có thể nhiều hóa đơn. Cơ sở được báo có hàng đang chuyển tới. |
| Nhân viên kiểm hàng | Mục 7 phiếu ca chỉ hiện khi có hóa đơn đang chuyển tới cơ sở (ca không có hàng không phải làm gì). Nhân viên **chỉ kiểm hàng, không thấy tiền**. Từng món: nhập **số lượng thực nhận** + **chụp ảnh thấy đủ số lượng** (thiếu ảnh vẫn gửi được nhưng bị ghi THIẾU HỒ SƠ — xem dòng "Hồ sơ nhận hàng phải đủ"). Nhận nhiều hơn hóa đơn thì cứ nhập đúng số đếm → báo **THỪA**. |
| Sửa báo cáo | Nhân viên **sửa được tới hết ngày giao**; sang ngày sau thì khóa. |
| Kết quả | Đủ hết → **ĐÃ NHẬN ĐỦ**. Có món thiếu / thừa → **NHẬN THIẾU / THỪA**: báo cáo (đúng số lượng nhận được) **đẩy về quản lý và kế toán**. Không có bước xử lý giao bù / trừ hóa đơn. |
| Nhận hàng KHÔNG có hóa đơn | Nhân viên bấm "Nhận hàng KHÔNG có hóa đơn": tự ghi từng món (tên + số lượng; gõ vài chữ web gợi ý tên món đã từng nhận) + chụp ảnh từng món đủ số lượng → **CHỜ HÓA ĐƠN**, báo ngay kế toán + quản lý. Kế toán tải hóa đơn Excel của cơ sở và **ghép với phiếu nhận** → web so từng món: khớp → ĐÃ NHẬN ĐỦ; lệch → THIẾU / THỪA, đẩy về quản lý + kế toán; món chỉ có một bên được tô màu. Chưa ghép hóa đơn thì **chưa tính tiền**. Hết ngày nhận mà chưa ghép → nhắc kế toán + quản lý (mỗi ngày còn chờ nhắc 1 lần). Hàng mua ngoài (chợ, siêu thị) không thuộc mục này — ghi ở Thu chi. **Áp dụng đúng quy tắc "Hồ sơ nhận hàng phải đủ"**: thiếu ảnh món nào → nhân viên bổ sung; chưa có / chưa ghép hóa đơn → kế toán; chưa đối soát → quản lý; nằm trong báo cáo thiếu hồ sơ và chỉ hoàn tất khi đủ ảnh + hóa đơn + đối soát. |
| Quản lý đối soát hàng (trong Đối soát ca) | Hạng mục "Nhập hàng" thay ô tick bằng **đối soát từng món**: mở ra là hiện **lần lượt từng ảnh hàng** nhân viên chụp + số lượng nhân viên ghi nhận. Đúng → bấm **Đối soát**, web **tự nhảy sang ảnh tiếp theo** cho tới hết. Sai → bấm "Sai số lượng", nhập số đúng + ghi chú rồi sang ảnh tiếp. Số chính thức = số quản lý xác nhận (số nhân viên báo vẫn giữ để xem). Web tính KHỚP / THIẾU / THỪA so với hóa đơn theo số chính thức. Phải đối soát hết hàng của ca mới Hoàn thành đối soát; ca không nhận hàng tự ghi "Không có hàng". Quản lý đối soát xong thì khóa báo cáo nhận hàng (nhân viên hết sửa). Phiếu không hóa đơn: đối soát số lượng + ảnh ngay, so với hóa đơn khi kế toán ghép. |
| Nhân viên kiểm kê sai | Không bắt nhân viên chịu tiền (không vào Khoản âm). Món quản lý sửa số → web **gửi báo cáo "kiểm kê sai"** cho nhân viên đã báo nhận (món, số báo, số đúng, ghi chú của quản lý). Hàng thiếu so với hóa đơn → báo quản lý + kế toán như trên. |
| Hồ sơ nhận hàng phải đủ | Mỗi lần nhận hàng phải đủ **ảnh từng món + hóa đơn**. Thiếu gì thì nằm trong **báo cáo "Hồ sơ nhận hàng còn thiếu"** cho đúng người bổ sung: thiếu ảnh món nào → nhân viên đã nhận (+ quản lý); thiếu hóa đơn / chưa ghép hóa đơn → kế toán; chưa đối soát hàng → quản lý. Nhân viên vẫn gửi được khi hàng tới gấp chưa chụp kịp, nhưng phiếu bị ghi **THIẾU HỒ SƠ**; nhân viên bổ sung ảnh được cả sau ngày giao (chỉ thêm ảnh, không đổi số lượng). Báo cáo hiện ở trang Kế toán và Đối soát, nhắc mỗi ngày tới khi đủ. Phiếu chỉ **hoàn tất** khi đủ ảnh + hóa đơn + quản lý đã đối soát. (Thay cho quy tắc cũ "chưa chụp ảnh thì không gửi được".) |
| Chưa báo nhận | **Không chặn** hoàn thành phiếu chốt ca (hàng có thể tới ca sau). Hết ngày giao mà hóa đơn chưa báo nhận đủ → đẩy về quản lý và kế toán. |
| Tiền hàng | Tiền hàng **cuối tháng thanh toán 1 lần**. Tổng bill các hóa đơn trong tháng của từng cơ sở → chi phí "Nguyên liệu (kho tổng)" của cơ sở đó ở Chốt tháng (không trừ quỹ cơ sở; bảng đối chiếu cộng lại như chi phí quỹ ngoài). Trang Kế toán có tổng phải trả kho tổng theo tháng / cơ sở. Cuối tháng ghi **một lần thanh toán** (ở Quỹ ngoài: khoản "Thanh toán kho tổng tháng X", điền sẵn tổng tiền, không chia lại cho cơ sở vì đã tính theo từng hóa đơn). |
| File Excel | Đọc "Phiếu xuất điều chuyển": các dòng đầu dạng "Nhãn: giá trị" (Số đơn, Ngày tạo, Người tạo, Kho xuất, Thời gian xuất, Kho nhập "Tên (MÃ KHO)", Tham chiếu) + bảng cột Mã hàng · Tên hàng · Tên đơn vị tính · Số lượng · Đơn giá · Tổng, dòng cuối "Tổng". Kho nhập tự nhận ra cơ sở (lần đầu đoán theo chữ cái đầu tên, kế toán xác nhận, lần sau nhớ). Trùng số đơn bị chặn. Đã làm theo đề xuất: 1 ảnh gắn được nhiều món (tick các món trong ảnh); mỗi món có nút "Đủ" điền sẵn số hóa đơn; số lượng cho phép số lẻ. Quản lý xem được trang Hóa đơn giao hàng (không tải / ghép / xóa). |

## 5i. Chia phiếu chốt ca thành phần việc — anh Tiến chốt 11/11/2026, ĐÃ LÀM 11/11/2026 (tệp `supabase/32_chia_phan_phieu_ca.sql`)

| Điểm | Anh Tiến chốt |
|---|---|
| 3 phần việc | **TIỀN** (mục 1 Thời gian, 2 Nhận két / doanh thu / ảnh iPOS, 3 Thu chi, 4 Công nợ) · **NHÂN SỰ & BÀN GIAO** (mục 5, 6) · **NHẬN HÀNG** (mục 7 — chỉ có khi ca nhận hàng kho tổng). |
| Nhận phần | Mỗi người bấm "Tôi nhận phần này". **Chỉ người nhận sửa được** phần đó; người khác chỉ xem, muốn làm thay bấm "Nhận lại phần này" (ghi lịch sử). |
| Xong phần | Người nhận bấm "Xong phần này" — web kiểm tra đúng các mục của phần. **Đủ các phần Xong → phiếu tự HOÀN THÀNH** (bỏ nút Hoàn thành riêng). |
| Chưa xong | Còn phần chưa xong → phiếu chưa hoàn thành và **treo nhắc nhân viên** (người nhận phần; phần chưa ai nhận thì nhắc cả nhân viên trong ca). |
| Giờ nhắc | Nhắc lần đầu **30 phút trước khi hết ca**; sau đó còn phần chưa xong thì nhắc lại mỗi giờ tới khi xong. |
| Ai được nhận phần | Nhân viên có tên trong ca đó + quản lý. |
| Quản lý tự làm thì khỏi đối soát | Phần nào do **người có quyền đối soát** (quản lý, quản lý tổng, chủ) nhận và bấm Xong thì các hạng mục đối soát của phần đó **tự tính là đã đối soát** (ghi "QL tự làm"): TIỀN → doanh thu / iPOS, công nợ, thu chi (từng dòng thu chi của phiếu thành đã đối soát); NHÂN SỰ & BÀN GIAO → nhân sự, bàn giao; NHẬN HÀNG → từng món hàng đã đối soát (số quản lý nhập là số chính thức). Phần do nhân viên làm vẫn phải đối soát như cũ. Nếu sau đó nhân viên "Nhận lại phần này" và sửa thì phần đó quay về chờ đối soát. (11/11/2026) |
| Cách làm trên web | Đầu mỗi phần có thanh "PHẦN 1 · TIỀN / PHẦN 2 · NHÂN SỰ & BÀN GIAO / PHẦN 3 · NHẬN HÀNG" với nút **Tôi nhận phần này** / **Bỏ nhận** / **Nhận lại phần này** / **Sửa lại**; ô của phần chưa nhận bị khóa. Cuối phần có nút **XONG PHẦN …** (phần TIỀN hiện bảng xác nhận tiền như trước). Điện thoại: 5 bước Tiền: số liệu · Tiền: thu chi · Nhân sự & bàn giao · Nhận hàng · Tiến độ (bước Tiến độ liệt kê chỗ còn thiếu của phần mình). Phiếu chưa có ai trong ca thì ai chốt ca cũng nhận được phần. Mở lại phiếu → các phần phải bấm Xong lại (người nhận giữ nguyên). |
| Nhắc trên máy chủ | Máy chủ tự chạy 5 phút/lần (hẹn giờ `nhac-phieu-ca`), gửi thông báo trong web; không nhắc từ 0h đến 6h; dừng sau 24 giờ kể từ hết ca. |
| Ghi chú | Dòng chi do quản lý tự làm đã tính "đã đối soát" nhưng vẫn phải chọn nhóm chi ở Thu chi / Chốt tháng. Ảnh hàng: máy chủ chưa khóa theo người nhận phần (giao diện đã ẩn nút với người không nhận phần). |

## 5j. Tách riêng phần đối soát + đánh giá nhân viên — anh Tiến chốt 11/11/2026. ĐÃ LÀM 11/11/2026 phần tách đối soát (`supabase/35_doi_soat_rieng.sql`, trang `#/quan-ly/doi-soat` và `#/quan-ly/doi-soat/ca?id=`). ĐÃ LÀM 11/11/2026 phần đánh giá nhân viên (`supabase/36_danh_gia_nhan_vien.sql`, `38_danh_gia_lich_su.sql`; trang `#/quan-ly/danh-gia`, `#/cua-toi/danh-gia`, phần đánh giá ở bước Nhân sự của Đối soát ca)

| Điểm | Anh Tiến chốt |
|---|---|
| Trang gom việc | Tab **Đối soát** (Quản lý ca) = nơi duy nhất quản lý vào đối soát. Đầu trang: chọn ngày/tháng, cơ sở; 4 ô đếm: Phiếu ca chờ đối soát · Dòng thu chi chờ · Hàng chưa đối soát · Giải trình khoản âm mới. 4 danh sách, mỗi dòng có nút làm ngay: (1) phiếu ca → mở trang Đối soát ca; (2) dòng thu chi từ phiếu ca → chọn nhóm + Đối soát tại chỗ; (3) hàng nhận chưa đối soát → hộp đối soát từng ảnh; (4) phiếu trừ lương có giải trình → Giữ trừ lương / Sửa / Xóa. Bảng ca hôm nay giữ ở đầu trang. |
| Thu chi | Chỉ còn là **sổ thu chi** (không còn nút Đối soát); dòng chờ ghi "Chờ đối soát" + đường dẫn sang trang Đối soát. |
| Trang Đối soát ca | Tách khỏi phiếu nhân viên. Phiếu nhân viên chỉ xem (bỏ các nút đỏ/xanh), quản lý có nút "Đối soát ca này". Trang đối soát ca: đầu trang ca, cơ sở, ai làm từng phần, phần nào quản lý tự làm (đã tự đối soát). **Bước 1 Tiền** (sửa số liệu như bản đối soát, giữ "Phiếu NV: …"; tiền mặt / chuyển khoản chưa giải trình, chuyển khoản kế toán nhập; KHỚP / THIẾU / THỪA — thiếu thì chia đều + mặc định trừ lương; chọn nhóm các dòng thu chi của ca) · **Bước 2 Nhân sự & bàn giao** · **Bước 3 Nhận hàng** (đối soát từng ảnh; không nhận hàng thì tự qua) · **Bước 4 Hoàn thành** (tóm tắt → HOÀN THÀNH ĐỐI SOÁT; Mở lại đối soát, Mở lại phiếu cho NV sửa ở đây). |
| Dòng thu chi của ca | Đối soát được ở **cả 2 chỗ** (bước Tiền và trang gom việc), làm ở đâu cũng tính. |
| Ai đối soát | Người có quyền Đối soát (quản lý, quản lý tổng, chủ) — như hiện nay. |
| Điện thoại / máy tính | Điện thoại: từng bước như phiếu nhân viên. Máy tính: hiện cả 4 bước trên 1 trang. |
| Đánh giá nhân viên (chốt 11/11/2026) | **Trừ điểm theo 20 tiêu chí đã có ở bản offline** (Pha chế 20 tiêu chí, Chạy bàn 20 tiêu chí, mỗi tiêu chí tối đa 5 điểm, tổng 100 — danh sách xem `app/legacy/constants.py` EVALUATION_CRITERIA). **Theo tháng**: đầu tháng mỗi nhân viên đủ 100 điểm; phạm lỗi thì quản lý trừ vào đúng tiêu chí, **chọn trừ 1–5 điểm**, bắt buộc ghi lỗi gì (kèm ảnh nếu có); mỗi tiêu chí không xuống dưới 0. Cuối tháng xếp loại theo ngưỡng cũ: Xuất sắc ≥ 91 · Tốt ≥ 80 · Khá ≥ 65 · Trung bình ≥ 50 · Yếu < 50; sang tháng mới đủ 100 lại. **Trừ ở 2 chỗ**: trong trang Đối soát ca (cho người làm ca đó, gắn với ca) và trang **Đánh giá nhân viên** riêng (trừ bất cứ lúc nào + bảng điểm tháng từng người). **Nhân viên** nhận thông báo, xem điểm của mình ở Của tôi, **gửi giải trình được**; quản lý / Chủ xem giải trình rồi **giữ hoặc hoàn lại điểm**. Không bắt buộc khi hoàn thành đối soát. **Bỏ voucher** (tạm thời). **Không chuyển dữ liệu đánh giá cũ** của bản offline lên web. |
| Đánh giá — chi tiết (anh xác nhận 11/11/2026) | (1) **Mỗi nhân viên được xếp một bộ tiêu chí cố định** (Pha chế hoặc Chạy bàn), giữ nguyên cho tới khi quản lý đổi; chọn ngay trên **bảng điểm** (ô Pha chế / Chạy bàn ở mỗi dòng; nút "Chọn theo gợi ý" cho người chưa chọn) hoặc ở đầu cửa sổ trừ điểm — chưa chọn bộ thì chưa trừ điểm được (anh Tiến 12/11/2026). (2) Người trừ điểm: người có quyền Đối soát (quản lý, quản lý tổng, Chủ). (3) Sửa / xóa / hoàn điểm được trong tháng đó và tới hết ngày 5 tháng sau, sau đó khóa; **Chủ mở lại được tháng đã khóa** để quản lý đánh giá tiếp, rồi Chủ khóa lại. (4) Chủ sửa được tên tiêu chí ở Cài đặt. |
| Đánh giá — lịch sử khi trừ điểm (anh Tiến chốt 11/11/2026) | Khi quản lý chọn nhân viên để trừ điểm, **hiện toàn bộ lịch sử bị trừ điểm / nhắc nhở** của người đó (từ trước tới nay, mới nhất ở trên) để quản lý chọn mức trừ hợp lý. Đầu danh sách tóm tắt tháng này bị trừ bao nhiêu điểm, mấy lần; lỗi cùng tiêu chí đang chọn được tô nổi (vd "lần thứ 3"). Thêm lựa chọn **Nhắc nhở** = ghi lỗi, 0 điểm, vẫn báo nhân viên và lưu lịch sử (nhân viên giải trình được như lần trừ điểm). **Không** hiện các lần trừ lương vì thiếu tiền ca. **Không** tự gợi ý mức trừ — quản lý tự xem và quyết. |
| Đánh giá — bộ tiêu chí Quản lý | **ĐỂ SAU** (anh Tiến 11/11/2026: anh tự làm sau). Bản offline không có bộ này. Em đã soạn nháp 20 tiêu chí QL001–QL020 (tác phong; điều hành ca; tiền & sổ sách; hàng hóa; nhân sự; báo cáo & đóng góp) để anh tham khảo. Chưa chốt: ai trừ điểm quản lý (đề xuất: chỉ Chủ, hoặc Chủ + quản lý tổng; quản lý không tự trừ mình) và ngưỡng xếp loại. Khi làm phần đánh giá, chỉ làm 2 bộ Pha chế + Chạy bàn trước, thiết kế để thêm bộ Quản lý sau. |

## 5k. Phiếu đào tạo: bấm hạng mục mở hướng dẫn — anh Tiến chốt 11/11/2026, ĐÃ LÀM 11/11/2026 (`supabase/37_so_tay_quy_trinh.sql`, công cụ `cong_cu/cap_nhat_quy_trinh.py`; 19 bài + 205 ảnh đã lên mục Quy trình, 80 đoạn hướng dẫn cho đủ 68 hạng mục, sửa số trang 51 hạng mục)

| Mục | Đã chốt |
|---|---|
| Nội dung | Lấy từ **các bài Quy trình** anh Tiến tự đưa lên web (mục Nội quy / Quy trình › Quy trình). Hiện mỗi hạng mục chỉ ghi số trang sổ tay (vd "SOP 01 – Bước 1 · Tr. 35"). |
| Nơi sửa quy trình (đổi lại 13/11/2026) | **Trang Quy trình trên web là bản chính như trước.** Người có quyền Soạn tài liệu có thể bấm **Sửa**, lưu nháp, đăng, gỡ đăng hoặc xóa mọi bài Quy trình trực tiếp trên web. Các bài từng nhập từ Word đã được chuyển thành bài web bình thường. Phần hướng dẫn trong phiếu đào tạo và ảnh phóng to vẫn giữ nguyên. |
| Cách mở | Bấm vào hạng mục → **cửa sổ nổi ngay trên phiếu**, đọc xong bấm Đóng là về đúng chỗ; có nút ‹ › sang hạng mục trước / sau. |
| Ai xem | Mọi người mở được phiếu (nhân viên học, người hướng dẫn, quản lý, Chủ). |
| Sổ tay gốc (anh đưa vào 11/11/2026) | 1 file Word "Sổ tay nhân viên chạy bàn" (~40MB, 205 ảnh): Phần 1 công việc theo ca (1.1–1.7 + sơ đồ bàn), Phần 2 – 9 SOP, Phần 3 ghi nhớ, Phần 4 chương trình đào tạo 8 ngày. Mỗi thẻ công việc / bước SOP có dòng **"◆ Đào tạo: Ngày X · STT Y"** → **ghép hạng mục đào tạo với hướng dẫn theo STT** (đủ cả 68 hạng mục; có hạng mục có 2–3 thẻ, vd việc làm ở nhiều ca thì hiện hết). Phần 4 trùng 68 hạng mục trên web (tên, ngày giống hệt), chỉ khác số trang ở 51 hạng mục. |
| Cập nhật về sau | Sửa và đăng trực tiếp tại **Nội quy & quy trình › Quy trình**. Công cụ đồng bộ Word cũ không còn cập nhật nội dung lên web để tránh ghi đè phần đã sửa trực tiếp. |
| Cấu trúc đang dùng | **Chia nhiều bài nhỏ** trong mục Quy trình (~18 bài: Cách đọc + sơ đồ bàn · 7 bài công việc theo ca 1.1–1.7 · 9 bài SOP · Ghi nhớ); ảnh thu nhỏ cho điện thoại; **không đưa Phần 4** (đã có phiếu đào tạo). **Giữ nguyên** mục tài khoản thu ngân Fabi POS (cả mật khẩu) như sổ tay — chỉ người đăng nhập mới đọc được. Cửa sổ hướng dẫn trong phiếu đào tạo vẫn hiện đúng thẻ của STT đó và có link mở cả bài. |

## 5l. Nhân sự thực tế từ phiếu chốt ca → lịch + bảng công; người trả lương tiền mặt; quy định x2 — anh Tiến chốt 11/11/2026, ĐÃ LÀM 11/11/2026 (`supabase/39_nhan_su_thuc_te.sql`; `docs/js/nghi_thay.js` ở bước Nhân sự của Đối soát ca, `docs/js/bang_cong.js` tab Bảng công tháng, `#/cua-toi/cong`, dấu thực tế trên Lịch cơ sở / Lịch tổng, ô "Trả lương tiền mặt" trong hồ sơ nhân viên)

| Mục | Đã chốt |
|---|---|
| Hiện trạng (em kiểm tra 11/11) | Lịch cơ sở / Lịch tổng chỉ đọc lịch đã xếp (`weekly_schedule_entries`), chưa lấy người làm thực tế từ phiếu chốt ca. Phiếu ca có mục "5. Nhân viên thực tế làm trong ca" (theo lịch + người hỗ trợ phát sinh, Có làm / Phát sinh nghỉ, giờ đến–về). Trang Đối soát ca: Tiền → Nhân sự & bàn giao → Nhận hàng → Hoàn thành; khoản âm chia đều cho người được tích trong ca. Mọi nhân viên trên web (59 đang làm + 54 đã nghỉ) đều có tài khoản; nhóm Lương đã có trong nhóm chi. |
| Hiện trên lịch | **Đánh dấu ngay trên ô lịch** ở Lịch cơ sở và Lịch tổng: ✓ đã làm (kèm giờ đến–về), ✗ phát sinh nghỉ, + người phát sinh thêm (hỗ trợ / người trả lương tiền mặt). Thêm **bảng công tháng** (mỗi người bao nhiêu ca / giờ thực tế) để anh đối chiếu khi chốt lương trên HRM. |
| Lúc nào | Nhân viên bấm hoàn thành phiếu → lịch hiện ngay kèm nhãn **"chờ quản lý xác nhận"**; quản lý đối soát xong bước Nhân sự → thành **số chính thức** (dùng cho bảng công và chia tiền âm). |
| Thứ tự đối soát của quản lý | **Nhân sự làm đầu tiên** (vì liên quan chia tiền âm, phải biết rõ tổng số người): Nhân sự & bàn giao → Tiền → Nhận hàng → Hoàn thành. Phiếu chốt ca của nhân viên giữ thứ tự cũ. |
| Nhân viên không dùng app | **Thêm vào danh sách Nhân viên**, đánh dấu **"trả lương tiền mặt"** (có mã, tên; không đăng nhập). Chọn vào ca như người hỗ trợ; hiện trên lịch như người phát sinh; bảng công tách riêng nhóm trả tiền mặt. |
| Chi lương tiền mặt | Ngay dòng người đó trong ca có ô **"Đã trả lương tiền mặt: … đ"** do người chốt ca nhập → web tự tạo khoản chi tiền mặt **"Chi lương – tên"** trong thu chi của ca (trừ vào tiền két, nhóm **Lương**); quản lý đối soát như khoản chi khác. |
| Đã đồng ý 11/11/2026 (trước là đề xuất) | (1) Bước Tiền chỉ cho chọn THIẾU (chia tiền âm) sau khi đã đối soát bước Nhân sự. (2) Người "trả lương tiền mặt" không bị trừ điểm đánh giá / không có phiếu đào tạo trừ khi quản lý tự thêm. (3) Bảng công tháng đặt trong Xếp lịch tuần › Chốt & báo cáo, tải được file Excel. |
| Quy định x2 (anh Tiến 11/11/2026) | Lịch tuần đã xếp xong mà nhân viên nghỉ: phải **tự tìm người thay** (nhờ đồng nghiệp làm hộ). Không tìm được, nhờ quản lý / Chủ tìm → **người được tìm hộ nhận x2 lương ngày hôm đó**, phần thêm **lấy từ lương người xin nghỉ**. Ngoại lệ anh nêu: ốm (có bằng chứng cụ thể), ma chay tứ thân phụ mẫu. |
| x2 — đã chốt | Ghi **theo giờ làm thực tế** của người làm thay (làm 6 giờ → người làm thay +6 giờ, người nghỉ −6 giờ). **Chỉ quản lý phân loại** ở bước Nhân sự khi đối soát ca (nhân viên không tự khai trên web). Xác nhận xong → **báo cho cả 2 người** (người bị trừ và người được x2), **cả 2 được khiếu nại**. Người làm thay **không phải nhân viên quán** → chỉ ghi chú ở báo cáo lương (bảng công tháng). |
| x2 — em đề xuất, chờ anh xác nhận | Bước Nhân sự: người "Phát sinh nghỉ" chọn lý do — *Tự tìm người thay* (không trừ) / *Nhờ quản lý tìm* (bị trừ giờ) / *Ốm có bằng chứng* (bắt buộc ảnh) / *Ma chay tứ thân phụ mẫu* / *Khác* (ghi chú). Người hỗ trợ chọn — *Làm hộ, lương thường* / *Quản lý tìm hộ – x2* + làm thay cho ai; người ngoài quán gõ tên. Bảng công tháng thêm cột Giờ x2 được cộng · Giờ bị trừ · Ghi chú. Khiếu nại xử lý như giải trình đánh giá (quản lý / Chủ giữ hoặc sửa). Sửa được tới hết ngày 5 tháng sau, Chủ mở lại được. Áp dụng từ ngày lên web. **Cần anh nói rõ**: ốm / ma chay mà quản lý vẫn phải tìm người thay thì người nghỉ có bị trừ không, người làm thay có x2 không. |
| x2 — chốt thêm (anh Tiến 11/11/2026) | **Bỏ "Ốm có bằng chứng"** (và bỏ "Khác"). **Quản lý tổng phân loại** ở bước Nhân sự, sau đó **Chủ duyệt trước khi phiếu hoàn thành đối soát**. Lý do: (1) **Tự tìm người thay** — không trừ, người làm hộ lương thường. (2) **Nhờ quản lý tìm** — người làm thay x2, người nghỉ bị trừ đúng số giờ đó. (3) **Ma chay tứ thân phụ mẫu** — quán chịu (người làm thay x2, người nghỉ không bị trừ). (4) **Quản lý không xếp được lịch** (phải gọi thêm người) — quán chịu (người làm thêm x2, không ai bị trừ). Em hiểu (3) và (4) đều x2, quán trả phần thêm — chờ anh xác nhận. Báo cho cả 2 người sau khi Chủ duyệt; khiếu nại → quản lý tổng / Chủ xem. |
| x2 — chốt lại (anh Tiến 11/11/2026, thay dòng trên ở phần người làm thay) | **Người nghỉ**: trường hợp (1) Tự tìm người thay và (3) Ma chay tứ thân phụ mẫu → **không bị trừ**; trường hợp (2) Nhờ quản lý tìm → **luôn bị trừ** đúng số giờ người thay làm. **Người làm thay**: đãi ngộ **do Chủ quyết khi duyệt** — có thể x2 hoặc không (Chủ tích "x2" cho từng người). (4) Quản lý không xếp được lịch: không có người nghỉ, người làm thêm x2 hay không cũng do Chủ quyết. |
| x2 — ai chọn đãi ngộ (anh Tiến 11/11/2026) | **Quản lý tổng** (người biết việc sắp xếp nhân sự) chọn lý do **và chọn đãi ngộ** người làm thay (x2 hay không); **Chủ duyệt** (sửa được) thì phiếu mới hoàn thành đối soát. |

## 5m. Làm lại chốt ca (nhân viên) + đối soát (quản lý) — CHỐT 12/11/2026. ĐỢT 1 ĐÃ LÀM 12/11/2026 (`supabase/41_chot_ca_moi.sql`, `docs/js/chot_ca_moi.js`); ĐỢT 2 ĐÃ LÀM 12/11/2026 (`supabase/42_fabi_ca.sql`, trang Kế toán › File ca Fabi `#/ke-toan/fabi`); ĐỢT 3 ĐÃ LÀM 12/11/2026 (`docs/js/doi_soat_den.js`, khung "Đèn đối soát" đầu trang Đối soát ca)

Mục tiêu anh Tiến đặt: **dễ hiểu, dễ làm, không bao giờ sai sót**.

| Điểm | Trạng thái |
|---|---|
| Đợt 1 (đã làm) | Phiếu đang chốt mở màn hình mới 10 bước: Nhận chốt ca (nhận cả phần TIỀN + NHÂN SỰ) · Ai làm ca · Phiếu Fabi (ảnh + Mở ca / Đóng ca / Số dư đầu / NET / Chuyển khoản / Tiền mặt / Nợ / Tổng tiền / Tiền chênh lệch, kiểm tra ngay) · Khách nợ (tổng bàn = Nợ; khách trả nợ cũ tiền mặt / chuyển khoản) · Chuyển khoản hotline · Thu chi trong ca · Số cốc · Kết quả tiền (0đ mới KHỚP) · Bàn giao & nhận hàng · Kiểm tra lần cuối → GỬI. Bỏ đếm mù; tiền đầu ca = Số dư đầu Fabi, so với Tổng tiền ca trước, mức cho qua = 0. Người khác trong ca chỉ nhận phần nhận hàng. Phiếu kiểu cũ còn xem được bằng `?cu=1`. Tiền quản lý rút khỏi két: ghi là khoản Chi ra (quản lý chọn nhóm "Không tính" khi đối soát). |
| Đợt 2 (đã làm) | Tab **Kế toán › File ca Fabi**: chọn nhiều file chi tiết ca một lần → web đọc trên trình duyệt, máy chủ ghép theo cửa hàng (bảng `fabi_stores`: LHP, Đông Khê, Hồ Sen, Lela Cafe) + ngày + ca theo giờ mở (<11h Sáng, <16h Chiều, còn lại Tối). Phiếu đã gửi mà khác số → ghi số Fabi vào bản đối soát (có lịch sử "Theo file Fabi"), báo quản lý; ca đã hoàn thành đối soát → tự mở lại; ca chưa có phiếu → báo quản lý; phiếu gửi sau khi đã có file → so ngay lúc gửi. Trang liệt kê "Phiếu trên web chưa có file Fabi". |
| Đợt 3 (đã làm) | Đầu trang Đối soát ca có khung **Đèn đối soát**: 9 hạng mục, web tự xét xanh / đỏ (Nhân sự: có người nghỉ / làm hộ → đỏ; Doanh thu: công thức, tiền đầu ca lệch ca trước, khác file Fabi → đỏ; Tiền mặt / Chuyển khoản: còn lệch → đỏ, kèm lý do nhân viên; Thu chi: có khoản → đỏ để chọn nhóm; Nhập hàng: chưa đối soát ảnh → đỏ) + dấu Fabi (chưa có file / khớp / đã sửa theo Fabi, khách trả nợ, hóa đơn sửa / xóa). Nút **Duyệt các mục xanh** (tiền: ghi KHỚP; mục khác: đánh dấu đã đối soát); mục đỏ có nút **Xử lý** nhảy tới bước tương ứng bên dưới. Đủ hạng mục → tự hoàn thành đối soát như trước. |
| Nguyên tắc | (em đề xuất) Nhân viên chỉ nhập / chụp / chọn, web tự tính và so khớp; mỗi màn hình 1 việc; điền sẵn tối đa (người làm + giờ từ lịch, két từ ca trước, hàng từ hóa đơn); thiếu / sai thì chỉ rõ và không cho gửi; màn hình "Kiểm tra lần cuối" trước khi GỬI. |
| Người chốt ca | **CHỐT: 1 người chốt chính** chịu trách nhiệm cả phiếu (bỏ chia phần Tiền / Nhân sự / Nhận hàng); người khác trong ca chỉ giúp phần nhận hàng. **CHỐT (a):** người đầu tiên trong ca bấm "Tôi chốt ca này" là người chốt chính; quản lý đổi người được. |
| Đếm tiền | **CHỐT: không đếm theo mệnh giá trên web** — tiền đã đếm trên **Fabi POS**. Web chỉ lấy số trên phiếu chốt ca Fabi + ảnh phiếu. Các ô nhập trùng tên / thứ tự với phiếu Fabi (anh đã gửi ảnh mẫu 12/11). **CHỐT (a): bỏ đếm mù khi nhận két** — nhân viên nhập "Số dư đầu" trên phiếu Fabi, web so với "Tổng tiền" thực tế trong két của ca trước; lệch → báo đỏ, bắt ghi lý do. |
| Phiếu Fabi (iPOS) có những dòng | Mở ca · Đóng ca (POS) · Số dư đầu · Doanh thu (Gross) · giảm giá / chiết khấu / phí / VAT / phiếu giảm giá · **Doanh thu (NET)** · Số hóa đơn · Phương thức thanh toán (**CHUYỂN KHOẢN**, **Tiền mặt**, …) · Tiền trong két: Số dư (= số dư đầu + tiền mặt) · Doanh thu theo nhân viên · Nhóm món · Số tiền thực tế trong két theo mệnh giá → **Tổng tiền** · **Tiền chênh lệch**. Fabi KHÔNG biết khoản chi / thu ngoài trong ca → chi từ két làm "Tiền chênh lệch" âm. |
| File Excel xuất từ Fabi (anh gửi 12/11) | (1) **list_shift_report.xlsx** — mỗi cơ sở 1 sheet (tên sheet "<mã cửa hàng>-<tên cơ sở>", dòng 1 "Báo cáo được tính từ … tại <cơ sở>"), mỗi ca 1 dòng: Mã ca · Nhân viên (tài khoản thu ngân) · Số dư đầu ca · **Số dư cuối ca** (= số dư đầu + tiền mặt POS, tức tiền PHẢI CÓ) · Doanh thu (net) · **Tổng tiền nhận** (= tiền ĐẾM THỰC TẾ theo tờ) · Tổng hoá đơn · Tổng số khách · Thời gian mở / đóng ca; dòng cuối "Tổng". Suy ra: tiền mặt POS = cuối − đầu; chuyển khoản = net − tiền mặt (khi chỉ có 2 phương thức); chênh lệch = nhận − cuối. Số dư đầu ca sau = Tổng tiền nhận ca trước; ca đầu ngày bắt đầu bằng tiền gối đầu cố định (chờ anh xác nhận số). (2) **shift_report_detail_<mã ca>.xlsx** — 1 ca: Mã ca / Mở / Đóng / NV · TIỀN TRONG KÉT (Số dư đầu ca, Số dư cuối ca) · CHỈ SỐ DOANH THU (… Doanh thu (net), Tổng số hoá đơn) · PHƯƠNG THỨC THANH TOÁN (CHUYỂN KHOẢN, Tiền mặt, TỔNG) · DOANH THU THEO THIẾT BỊ · MÓN · NHÓM MÓN · NGUỒN ĐƠN · CTKM · THÔNG TIN TỜ TIỀN (mệnh giá, số lượng, tổng). Chưa thấy phương thức "nợ". |
| Ai tải file Fabi | **CHỐT (anh Tiến 12/11/2026): Kế toán tải được file từ Fabi.** Em đề xuất: kế toán tải file "danh sách ca" lên web ở tab Kế toán (1 file / ngày cho mọi cơ sở) → web so từng ca với số nhân viên gõ theo ảnh phiếu (cách C). Đã thử đối chiếu 1 ca thật: ảnh phiếu in và file chi tiết khớp 100% mọi dòng tiền. |
| Màn hình tiền (em đề xuất) | Chụp phiếu trước → nhập lần lượt theo phiếu: Đóng ca (POS) · Số dư đầu · Doanh thu (NET) · Chuyển khoản · Tiền mặt · Tổng tiền · Tiền chênh lệch. Web kiểm tra gõ đúng: Chuyển khoản + Tiền mặt (+ phương thức khác) = NET; Tổng tiền − Số dư đầu − Tiền mặt = Tiền chênh lệch (sai → "gõ nhầm 1 số"). Sau đó: Tiền chênh lệch phải giải thích hết bằng thu / chi tiền mặt trong ca; còn lại khác 0 → LỆCH (ghi lý do). Còn hỏi: bỏ mục "Chuyển khoản thực tế" của nhân viên (kế toán đã nhập)? thay "Số cốc" bằng "Số hóa đơn"? khách nợ ghi trên Fabi thế nào? ca đầu ngày so số dư đầu với gì? |
| Khoản chi trong ca | **CHỐT: không cần ảnh hóa đơn chi.** |
| Lệch tiền | **CHỐT: không cho phép lệch** — lệch 1đ cũng là LỆCH (nhân viên ghi lý do, quản lý xử lý). |
| Chế độ tập dượt (phiếu giả cho NV mới) | **ĐỂ SAU.** |
| Chốt thêm (anh Tiến 12/11/2026) | (1) **Đồng ý cách C**: nhân viên gõ theo ảnh phiếu in → biết KHỚP / LỆCH ngay; kế toán tải file "danh sách ca" Fabi **ngày hôm sau hoặc sau nữa** → web so lại từng ca (gõ nhầm → sửa theo Fabi + tô đỏ; ca có trên Fabi mà thiếu phiếu web → báo). (2) **Ca sáng luôn bắt đầu bằng tiền gối đầu cố định** ở mọi cơ sở (số do Chủ cài). (3) **Lela Box (LLB) không dùng Fabi** — tính sau. (4) **Khách nợ**: phiếu Fabi có phương thức **"Nợ"**; Chuyển khoản + Tiền mặt + Nợ = Doanh thu (net). File danh sách ca không tách được chuyển khoản / nợ (chỉ kiểm được tổng 2 khoản). (5) **Giữ "Chuyển khoản thực tế"**: nhân viên tự cộng các giao dịch đã nhận trên hotline. (6) **Giữ "Số cốc"** (không thay bằng số hóa đơn). |
| Chốt thêm 2 (anh Tiến 12/11/2026) | **Quản lý không phải chờ file Fabi** mới hoàn thành đối soát; file về sau mà thấy lệch → web tự mở lại đối soát ca đó và báo quản lý. File chi tiết ca còn có: mục **PHIẾU THANH TOÁN NỢ** (khách trả nợ cũ trong ca, theo phương thức — vd trả bằng chuyển khoản thì cộng vào chuyển khoản thực nhận trên hotline, không vào két) và mục **HOÁ ĐƠN SỬA/XOÁ** (mã hóa đơn + số tiền) — file danh sách ca không có 2 mục này. |
| Chốt thêm 3 (anh Tiến 12/11/2026) | (1) **Kế toán: mỗi ngày tải 1 file danh sách ca**; **chỉ ca có lệch** mới tải thêm file chi tiết ca đó (web cho chọn nhiều file một lần). (2) **Khách trả nợ bằng tiền mặt: Fabi đã cộng vào tiền phải có trong két** → web không cộng lại; kết quả tiền = Tiền chênh lệch trên phiếu − (thu − chi tiền mặt trong ca). Khách trả nợ bằng chuyển khoản → cộng vào số chuyển khoản phải thấy trên hotline. |
| Đổi cách tải file (anh Tiến 12/11/2026, thay cho "Chốt thêm 3" mục 1) | **Bỏ file danh sách ca. Kế toán tải FILE CHI TIẾT CỦA TỪNG CA** (mỗi cơ sở 3 ca, ~12 file / ngày, chọn nhiều file một lần). Web ghép file với phiếu theo cơ sở + giờ mở ca (Sáng / Chiều / Tối), so đủ: số dư đầu, doanh thu, chuyển khoản, tiền mặt, nợ, tổng tiền đếm (cộng tờ tiền), chênh lệch, khách trả nợ, hóa đơn sửa / xóa. Web liệt kê "phiếu trên web chưa có file Fabi" để kế toán tải bổ sung. Bản bấm thử đã đổi theo. |
| Việc của kế toán (anh Tiến 12/11/2026) | **Kế toán chỉ có 2 việc: tải file Fabi và nhập số tiền chuyển khoản thực tế của ngân hàng** (tab Chuyển khoản thực nhận đã có). Kế toán không xem / xử lý lệch: web tự so, tự sửa theo Fabi, tô đỏ và **báo quản lý** (lệch, thiếu phiếu, ca bị mở lại). Web liệt kê sẵn "ca cần file chi tiết" để kế toán chỉ việc tải lên. |
| Quản lý đối soát | (em đề xuất, chờ duyệt) Đèn xanh / đỏ: Nhân sự (đúng lịch → xanh; nghỉ / làm hộ → đỏ, phân loại x2 như 5l) · Tiền (ảnh phiếu Fabi hiện cạnh số nhân viên nhập; khớp → xanh) · Thu chi (chọn nhóm) · Hàng (khớp hóa đơn + đủ ảnh → xanh). Nút "Duyệt các mục xanh"; hết đỏ mới HOÀN THÀNH. |
| Chống quên | (em đề xuất) Bảng ca hôm nay ghi rõ bằng chữ còn thiếu gì (vd "Còn thiếu: ảnh phiếu, giờ về của Lan"); giữ nhắc 30 phút trước hết ca rồi mỗi giờ. |

## 5m-bổ sung (12/11/2026). Khách trả nợ cũ chọn ngay ở bước Phiếu Fabi
- Fabi cộng tiền khách trả nợ (bill nợ ca trước) bằng tiền mặt vào tiền phải có, nên phải chọn khách đã trả **trước khi** kiểm tra số phiếu. Bước "Phiếu Fabi" có mục **"Khách trả nợ cũ trong ca"** (bước Khách nợ không hỏi lại, chỉ hiện dòng tóm tắt); số lệch đúng bằng 1 khoản nợ cũ thì web gợi ý tên bàn.

## 5m-bổ sung 2 (12/11/2026). Chọn người làm hộ (`supabase/48_chon_nguoi_lam_ho.sql`)
- Bước "Ai làm ca": 2 nút **Nhân viên trong quán** (đang làm; người của cơ sở này lên trước, rồi cơ sở khác) và **Nhân viên cũ** (đã ngừng làm). Bấm nút → hiện danh sách, bấm tên để thêm; có ô lọc theo tên / mã không cần dấu.

## 5m-bổ sung 3 (12/11/2026). Thứ tự bước chốt ca
1 Nhận chốt ca · 2 Ai làm ca · 3 Phiếu Fabi (+ khách trả nợ cũ) · 4 Khách nợ mới · **5 Thu chi trong ca** (+ khách mượn / khách trả tiền mượn) · **6 Số cốc** · **7 Chuyển khoản hotline** · 8 Kết quả tiền · 9 Bàn giao & nhận hàng · 10 Kiểm tra lần cuối. Ghi hết các khoản tiền trước rồi mới đối chiếu chuyển khoản / tiền mặt, không phải lùi lại; chuyển khoản lệch có nút "Về bước Thu chi" (`ORDER` trong `docs/js/chot_ca_moi.js`).

## 5n. Khách mượn tiền quán — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/43_khach_muon.sql`)
- Ở bước **Thu chi** của phiếu chốt ca có thêm mục **"Khách mượn tiền quán"**: khách mượn tiền mặt trong két (mua nước, chi việc riêng…). Ghi tên khách, số tiền, SĐT / hẹn trả.
- Chỉ dùng cho tiền mặt khách mượn. **Bill khách nợ vẫn bấm "Nợ" trên Fabi** và ghi ở bước Khách nợ như cũ (anh Tiến chọn).
- Tiền mượn coi như đã lấy ra khỏi két → két vẫn KHỚP. Không phải doanh thu, không phải chi phí: web tự thêm dòng thu chi "Khách mượn – tên" (tự ghi **Không tính**, đã đối soát); chốt tháng "nợ phát sinh" chỉ gồm bill nợ.
- Mọi **ca sau cùng cơ sở** thấy "Khách mượn chưa trả" ở bước Thu chi; khách **trả hết 1 lần** (không trả một phần): chọn "Đã trả bằng tiền mặt (bỏ vào két)" hoặc "chuyển khoản" → web cộng vào két / số hotline phải thấy. Fabi không biết khoản trả này nên Tiền chênh lệch trên phiếu Fabi sẽ dương đúng bằng số tiền trả.
- Quá **3 ngày** chưa trả → báo Chủ, Quản lý tổng, Quản lý (pg_cron `nhac-khach-muon` 9:00 sáng, mỗi khoản báo 1 lần).
- Trang **Đối soát** có mục "5. Khách mượn tiền chưa trả" (ai mượn, bao nhiêu, từ ca nào, bao nhiêu ngày).

## 5o. Đối soát chờ kế toán (file Fabi + CK ngân hàng) — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/44_doi_soat_cho_ke_toan.sql`: app__ca_kt_state, trigger ca_kt_guard chặn ghi kết quả phần tiền, app_ca_kt_wait, pg_cron `nhac-ke-toan` 10:00)
- **Phần tiền** của phiếu ca (Thời gian, Doanh thu, Tiền mặt, Chuyển khoản, Thu chi, Công nợ) chỉ đối soát được khi kế toán đã có **đủ 2 thứ**: file chốt ca Fabi của ca đó **và** tiền chuyển khoản thực nhận (số dư ngân hàng từng tài khoản của ca). Chưa đủ → phiếu ở trạng thái **"Chờ kế toán"** (Bảng ca có màu riêng, ghi thiếu file Fabi / thiếu CK ngân hàng), chưa vào "Phiếu ca chờ đối soát"; trang Đối soát có danh sách "Chờ kế toán".
- **Nhân sự, Bàn giao, Nhập hàng** đối soát ngay khi nhân viên gửi (không cần số của kế toán).
- Đủ 2 thứ → đèn tính theo **số chính thức**: Doanh thu theo file Fabi; Tiền mặt = Tổng tiền (file Fabi) so với số phải có; Chuyển khoản = tiền ngân hàng nhận thật so với CK trên file Fabi (± khách trả nợ / thu chi CK); số hotline nhân viên gõ chỉ để tham khảo (lệch ngân hàng thì báo).
- **Phiếu do Chủ / quản lý tự gửi cũng chờ kế toán rồi đối soát như thường** — bỏ kiểu tự ghi "đã đối soát" (app__ca_auto_recon).
- Kế toán: thêm danh sách "Ca còn thiếu"; **10:00 sáng hôm sau** web báo kế toán các ca hôm trước còn thiếu file Fabi / CK ngân hàng.
- File Fabi hoặc số ngân hàng sửa sau khi đã đối soát → tự mở lại đối soát (như hiện nay).
- **Lela Box (LLB)**: để sau — tạm đối soát như hiện nay (không chờ).

## 5p. Số dư đầu ca: web nhận cả 2 cách — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/45_so_du_dau_ca_2_cach.sql`)
- Ca sáng: Số dư đầu luôn 1.000.000 (khác thì ghi lý do — như cũ).
- Ca chiều / tối, **cách 1**: Số dư đầu = đúng tiền ca trước để lại trong két → KHỚP.
- Ca chiều / tối, **cách 2**: Số dư đầu = **1.000.000** (tiền gối đầu) trong khi ca trước để lại nhiều hơn → phần dư là **"Nộp quỹ khi giao ca"**: không bắt ghi lý do, không tính lệch cho ca nào; tự thành dòng nộp quỹ trong **Sổ quỹ tiền mặt**; Đối soát tiền mặt cuối ngày và Chốt tháng trừ khoản này khỏi tiền phải có trong két.
- Số dư đầu khác cả 2 cách → báo lệch, bắt ghi lý do (như cũ). Tiền nộp quỹ mà không thực sự vào quỹ sẽ lộ ra khi **kiểm quỹ** (Sổ quỹ).

## 5q. Nghỉ & làm thay (x2) gọn thao tác — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/46_nghi_thay_gon.sql`)
- **Chủ / Quản lý tổng tự chốt ca** → ở bước "Kiểm tra lần cuối" của phiếu hiện luôn khung **Nghỉ & làm thay**: chọn lý do nghỉ, người làm thay, x2; Chủ bấm **Duyệt** luôn (Quản lý tổng phân loại thì vẫn chờ Chủ duyệt). Nhân viên chốt ca không thấy khung này.
- Máy chủ cho phân loại / duyệt cả khi phiếu đang chốt (`app_cv_save`, `app_cv_approve`).
- Tab **Đối soát** có mục **"6. Nghỉ / làm thay (x2)"**: Chờ Quản lý tổng phân loại · Chờ Chủ duyệt (`app_cv_todo`), nút mở thẳng bước Nhân sự.

## 5r. Lý do nghỉ — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/47_ly_do_nghi.sql`)
- Lý do nghỉ: Tự tìm người thay (không trừ) · Nhờ quản lý tìm (trừ giờ người thay làm) · **Quản lý đồng ý cho nghỉ (không trừ lương)** (trước là "Ma chay tứ thân phụ mẫu", giữ mã `ma_chay`) · **Bỏ ca — phạt 200.000đ** (mới, `shift_covers.fine`; hiện ở Bảng công cột Phạt, Công của tôi, báo cho người nghỉ khi Chủ duyệt).
- Ô **x2** luôn hiện ở từng người nghỉ; tích x2 thì **bắt buộc chọn người được x2**. Ô chọn người gồm người hỗ trợ phát sinh **và người trong lịch có làm ở ca** (trước chỉ chọn được người hỗ trợ), hoặc người ngoài quán.

## 5s. Số cốc theo file Fabi — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/49_so_coc_fabi.sql`)
- File chi tiết ca Fabi có mục MÓN (số lượng từng món) và NHÓM MÓN (chỉ doanh thu). Web **tự học** nhóm của từng món (bảng `fabi_menu`): món mới chưa có nhóm → Kế toán › File ca Fabi › khung **"Nhóm món"** chọn nhóm 1 lần (web gợi ý theo tên món), bấm Lưu → các ca có món đó tự tính lại.
- **Số cốc của ca = tổng số lượng các món, trừ nhóm "Đồ ăn & thuốc lá" và "Topping".** Bảng file Fabi có cột Số cốc ("thiếu nhóm N món" khi chưa đủ).
- **Bỏ bước "Số cốc"** ở phiếu chốt ca các cơ sở dùng Fabi; số cốc tự điền vào phiếu khi ca đã gửi và file Fabi đủ nhóm món. Lela Box (không dùng Fabi) vẫn nhập tay.

## 5t. Số dư ngân hàng nhập sẵn — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/50_so_du_ngan_hang_nhap_san.sql`)
- Kế toán trước đây ghi số dư từng tài khoản sau mỗi ca trên Google Sheet "Bảng chốt doanh thu chuyển khoản". Anh Tiến chốt: **mang lên web 1 lần** (1–10/11/2026), từ nay kế toán gõ thẳng trên web (Kế toán › Chuyển khoản thực nhận); **giữ nguyên số như bảng** (ca LHP số dư giảm do rút tiền không ghi → đối soát báo lệch, kế toán sửa "tiền chuyển ra" nếu cần).
- Số dư giữ trong bảng `bank_balance_import` theo (tài khoản, ngày, ca); phiếu ca tạo (hoặc tạo lại) → tự điền vào phiếu, không ghi đè số kế toán đã nhập. Số liệu thật nạp riêng, không nằm trong kho mã.

## 5u. Tự đối soát theo file Fabi — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/51_tu_doi_soat_theo_fabi.sql`)
- Ca đã gửi + có file chốt ca Fabi + đủ số dư ngân hàng → web **tự xét** các hạng mục theo đúng quy tắc Đèn đối soát; **chỉ 6 mục tiền** (thời gian, doanh thu & số cốc, tiền mặt, chuyển khoản, thu chi, công nợ) xanh thì tự duyệt (mục tiền = KHỚP) và **khoá**: nhạt đi, không bỏ duyệt / đổi kết quả / sửa số liên quan được (máy chủ giữ nguyên số cũ). Nhân viên trong ca, Bàn giao, Nhập hàng do quản lý duyệt (file Fabi / ngân hàng không kiểm được) — bước 52 (`supabase/52_tu_doi_soat_chi_phan_tien.sql`) đổi lại sau khi anh Tiến thấy ca 1/11 Chiều tự duyệt Nhân viên.
- Mọi mục xong (phần tiền web tự duyệt, phần còn lại quản lý duyệt) + nghỉ & làm thay xong → **tự HOÀN THÀNH ĐỐI SOÁT**.
- Web xét lại sau mỗi lần: tải file Fabi, số dư ngân hàng đổi, Chủ duyệt nghỉ & làm thay. Mục tự duyệt không còn khớp (vd tải lại file khác số) → web tự bỏ khoá; ca đã hoàn thành thì MỞ LẠI.
- **Chỉ Chủ mở khoá** từng mục (nút "Mở khoá" ở Đèn đối soát, ghi lý do, lưu lịch sử). Mở lại phiếu cho nhân viên sửa vẫn xoá hết như cũ. Lela Box (không dùng Fabi) không tự đối soát.

## 5v. Phiếu chi chuyển khoản ở tab Đối soát — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/54_phieu_chi_chuyen_khoan.sql`)
- Chuyển khoản của ca lệch vì tiền đã đi ra khỏi tài khoản → trang Đối soát ca có nút **"Tạo phiếu chi"** (dòng Chuyển khoản đỏ ở Đèn đối soát) và khung **"Phiếu chi chuyển khoản của ca"** (dưới Chuyển khoản thực nhận).
- Chọn 1 trong 2: **Chi phí của quán** (chọn nhóm chi → Thu chi của tháng, hình thức chuyển khoản) hoặc **Chủ / quản lý rút tiền** (→ Sổ quỹ, phiếu rút chuyển khoản chờ Chủ xác nhận). Chọn tài khoản tiền đi ra, số tiền (gợi ý = phần thiếu), nội dung.
- Số tiền **tự cộng vào "tiền chuyển ra"** của tài khoản ở ca đó → web tự đối soát lại (hết lệch thì tự duyệt + khoá Chuyển khoản). Xoá phiếu thì trừ lại, xoá luôn khoản ở Thu chi / Sổ quỹ; không xoá được khi Chuyển khoản đã khoá hoặc Chủ đã nhận phiếu rút.
- Người tạo / xoá: Chủ, Quản lý tổng, Kế toán.
- Phiếu chốt ca, bước **Chuyển khoản hotline**: lệch thì có ô nội dung + nút **"Tạo phiếu chi / thu …đ"** → thêm 1 khoản thu chi chuyển khoản (số tiền = phần lệch) vào Thu chi của ca, hết lệch ngay (không phải quay lại bước Thu chi). Không tạo phiếu thì vẫn phải ghi lý do lệch.

## 5w. Công nợ đã thu hiện ở đúng ca thu — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/55_cong_no_theo_ca_thu.sql`)
- Tiền khách trả nợ vẫn tính vào ca thu (như cũ). Hiển thị ở tab Đối soát: **ca thu** có phần "Khách trả nợ trong ca này" (bàn, số tiền, tiền mặt / chuyển khoản, nợ từ ca nào); **ca nợ** ghi "Đã thu ở ca … · tiền mặt / chuyển khoản ›" (bấm mở ca thu); **Bảng ca**: ô ca thu ghi "Thu nợ …đ", ô ca nợ chỉ ghi "Có công nợ …đ" khi còn nợ chưa thu. Chỉ tính nợ bàn (khách mượn tiền ở Thu chi).
- Bước 53 (`supabase/53_sua_trigger_tu_doi_soat.sql`): sửa lỗi bước 51 làm lưu số dư ngân hàng / Chủ duyệt nghỉ & làm thay báo lỗi (khoảng 21:30–21:45 ngày 12/11).


## 5x. Đối soát — sửa từng mục — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/56_sua_tung_muc_doi_soat.sql`)
- Mục đã đối soát (quản lý duyệt hoặc web tự duyệt) **nhạt đi và khoá** ô nhập liên quan; trang chỉ còn mục chưa xong là sửa được.
- Muốn sửa: bấm **"Sửa"** ở đúng mục trong Đèn đối soát, ghi lý do → **chỉ mục đó mở lại** (các mục khác giữ nguyên). Ai có quyền đối soát làm được; mục web tự đối soát theo file Fabi vẫn chỉ Chủ sửa.
- Duyệt lại mục đó → phiếu **tự HOÀN THÀNH ĐỐI SOÁT**. Bỏ nút "Hoàn thành đối soát" và "Mở lại đối soát"; riêng **Chủ** có "Mở lại cả phiếu" (mở lại mọi mục, có lý do).
- Mục tiền có khoản âm: mở lại không huỷ khoản âm ngay, chọn lại kết quả thì thay danh sách; khoản âm đã xử lý (đã bù / trừ lương xác nhận / miễn) thì không mở lại được.

## 5y. Trang Đối soát ca — khung "Tiền của ca" — CHỐT và ĐÃ LÀM 12/11/2026 (chỉ giao diện, `docs/js/pages/phieu_ca.js`)
- Bước Tiền của trang Đối soát ca gộp phần 1 (thời gian), 2 (nhận két, doanh thu), 3 (chênh lệch, thu chi) thành **1 khung "Tiền của ca"**: 1 dòng giờ doanh thu; 3 dòng so khớp **Doanh thu / Tiền mặt / Chuyển khoản** (✓ khớp, 🔴 lệch kèm nút xử lý ngay: Tạo phiếu chi, Thêm thu chi, Chọn KHỚP / THIẾU / THỪA, Xem / sửa số liệu); dòng Thu chi; mục đã đối soát nhạt đi.
- **Thu chi của ca** chỉ còn 1 danh sách, chọn nhóm ngay trên dòng (bỏ mục "Phân nhóm thu chi của ca" riêng).
- Ô số liệu (mục 1–5, ảnh iPOS, nhận két, số dư ngân hàng, phiếu chi, sửa khoản thu chi) thu vào **"Xem / sửa số liệu"** (bấm mới mở). Phiếu chốt ca của nhân viên giữ nguyên.

## 5z. Trang Thu chi tách tiền mặt / chuyển khoản — ĐÃ LÀM 12/11/2026 (chỉ giao diện, `docs/js/pages/thu_chi.js`)
- 2 thẻ **Tiền mặt** và **Chuyển khoản** (thu, chi, thu − chi; bấm thẻ để lọc); "Chờ đối soát" và "Trừ lương" thành 2 nút nhỏ; nút lọc Tất cả / Tiền mặt / Chuyển khoản; mỗi dòng có nhãn TM / CK (phiếu trừ lương: TL, không tính vào 2 thẻ).

## 5z2. Bảng tuần ở Kế toán — ĐÃ LÀM 12/11/2026 (chỉ giao diện, `ke_toan_ck.js`, `ke_toan_fabi.js`)
- **Chuyển khoản thực nhận** và **File ca Fabi** có nút "Theo ngày / Danh sách | Bảng tuần". Bảng tuần: mỗi cơ sở 1 bảng, hàng = ca + Tổng ngày, cột = T2…CN + Cả tuần; tuần trước / sau.
- Chuyển khoản: ô = tiền ngân hàng nhận trong ca + lệch so với CK theo phiếu (đỏ khi lệch), "chưa nhập", "thiếu TK". File Fabi: ô = doanh thu NET, CK, số cốc, trạng thái so với phiếu (✓ khớp / ✗ đã sửa theo Fabi / chưa có phiếu), "chưa tải" khi có phiếu mà chưa có file. Bấm ô → mở ngày đó.
- **Tab Đối soát** cũng có "Theo ngày | Bảng tuần": ô = tình trạng đối soát của ca (Đã đối soát / Chờ đối soát n/9 / Chờ kế toán / Đang chốt / Quá giờ chưa chốt / Có khoản âm), doanh thu, TM / CK còn lệch; hàng "Cuối ngày" = đã kiểm đếm tiền mặt cuối ngày chưa.
- Lưu ý kỹ thuật: CSS chèn qua html`` bị thoát ký tự — không dùng `>` hay dấu nháy trong chuỗi CSS.

## 5z3. Mục Cài đặt — ĐÃ LÀM 12/11/2026 (chỉ giao diện)
- Mục menu "Cài đặt xếp lịch" đổi tên **"Cài đặt"**, thêm 2 tab (quyền Kế toán): **Tài khoản ngân hàng** (`/cai-dat/tai-khoan`, chuyển từ trang Chuyển khoản thực nhận) và **Nhóm món Fabi** (`/cai-dat/nhom-mon`, chuyển từ trang File ca Fabi) — vì rất ít khi dùng.
- Trang cũ chỉ còn dòng nhắc kèm link khi cần: cơ sở chưa có tài khoản / còn món chưa có nhóm (chưa tính được số cốc).

## 5z4. Loại thu chi (2 tầng Loại › Nhóm) — CHỐT và ĐÃ LÀM 12/11/2026 (`supabase/57_loai_thu_chi.sql`)
- Bảng `fin_cat_types`; mỗi nhóm (`fin_categories.type_id`) thuộc 1 loại. Tạo sẵn: **Chi phí cố định** (Lương, Mặt bằng, Điện nước) · **Chi phí bán hàng** (Nguyên liệu, Nguyên liệu (kho tổng), Vật dụng) · **Chi phí khác** (Sửa chữa & thiết bị, Internet, Khác) · **Thu khác**.
- Trang Thu chi: khung **Chi theo loại** (tổng từng loại + % + từng nhóm, bấm để lọc), ô lọc Loại / Nhóm, mỗi dòng ghi "Loại › Nhóm"; hộp thêm khoản xếp nhóm theo loại.
- **Cài đặt › Loại & nhóm thu chi**: thêm / đổi tên / ngừng dùng loại và nhóm, chuyển nhóm sang loại khác (Chủ / Quản lý tổng; người khác chỉ xem).
## 5c. Kiểm soát tiền từng ca (két gối đầu) — chốt và ĐÃ LÀM 07/11/2026 (tệp supabase/23_ban_giao_ket.sql)

Két gối đầu: ca sau nhận nguyên két của ca trước, cuối ngày mới rút. Ca đầu ngày nhận 1.000.000đ cố định. Máy POS là **iPOS**.

| # | Điểm | Anh Tiến chốt |
|---|---|---|
| 1 | Đếm mù khi nhận két | Ca sau tự đếm két và nhập số **trước khi thấy** số ca trước khai. Ca trước phải bấm Hoàn thành phiếu rồi ca sau mới đếm được. Số đếm lần đầu giữ nguyên, không sửa được. Phiếu ca trước đã hoàn thành: người khác (không phải người chốt, không có quyền đối soát) không thấy Mục 5 và ảnh phiếu iPOS cho tới khi ca sau đếm xong. |
| 2 | Lệch khi bàn giao | Lệch quá mức cho qua thì người nhận + 1 người ca trước **đếm lại cùng nhau**, nhập số đếm lại (1 lần). Vẫn lệch: web báo quản lý và người giao; khoản lệch **tính cho ca giao** (cộng vào Tiền mặt chưa giải trình của ca giao khi đối soát); người nhận phải ghi lý do. |
| 3 | Số dư đầu iPOS | Nhân viên nhập "Số dư đầu" trên phiếu iPOS; phải bằng tiền nhận két, khác thì bắt buộc ghi lý do. |
| 4 | Mức lệch cho qua | 5.000đ. |
| 5 | Khoản âm | Quản lý chọn nhân viên chịu khi đối soát (giữ như 5b mục 2). |
| 6 | Chi tiền mặt | Giữ như cũ. |
| 7 | Ảnh phiếu chốt ca iPOS | Bắt buộc mới hoàn thành được phiếu. |
| 8 | Giảm giá / chiết khấu | Giữ như cũ (không thêm ô). |
| 9–11 | Kiểm két đột xuất · cảnh báo tỉ lệ tiền mặt · rút bớt két | Không làm. |
| — | Ca FULL TIME (LHP) | Không nằm trong chuỗi bàn giao két; đối soát cuối ngày chỉ cần đủ ca Sáng / Chiều / Tối (sửa ở bước 24). |
| 12 | Lấy số liệu tự động từ iPOS | iPOS **không có cổng kết nối công khai**; chỉ mở cho đối tác. Anh Tiến hỏi iPOS về API / xuất Excel báo cáo ca rồi tính tiếp. |


## 5d. Chốt tháng — chốt và ĐÃ LÀM 07/11/2026 (tệp supabase/24_chot_thang.sql, trang #/quan-ly/chot-thang)

| Điểm | Anh Tiến chốt |
|---|---|
| Ai dùng | Chủ, Quản lý tổng: mọi cơ sở (có thêm ô **Tất cả** để so sánh). Quản lý cơ sở: chỉ cơ sở được Chủ giao (Chốt tháng › Cài đặt › Giao cơ sở cho quản lý). |
| Doanh thu | Lấy từ phiếu chốt ca (số đã đối soát): tổng doanh thu, tiền mặt / chuyển khoản POS, nợ, số cốc, số ca đã chốt / đối soát. |
| Tiền mặt | Theo từng ngày như Đối soát cuối ngày: phải có, quản lý đếm, lệch; tổng lệch tháng, ngày chưa đếm. |
| Chuyển khoản | Theo POS và thực nhận (kế toán nhập số dư). |
| Chi phí | Khoản CHI ghi ở phiếu chốt ca tự vào tháng (quản lý chọn nhóm hoặc "Không tính"); khoản thu (+) ở phiếu ca mặc định "Không tính". Quản lý nhập thêm (mặt bằng, lương, điện nước, nguyên liệu…). |
| Nhóm chi / thu | Mẫu: Nguyên liệu · Lương · Mặt bằng · Điện nước · Sửa chữa & thiết bị · Marketing · Vật dụng · Khác / Thu khác. Chủ, Quản lý tổng thêm / đổi tên / tắt. |
| Kết quả | Lãi tạm tính = Doanh thu + Thu khác − Chi phí. Khoản âm nhân viên chỉ hiển thị, không trừ vào lãi. |
| Chốt tháng | Chỉ sau khi hết tháng; phải hết phiếu đang chốt dở, đối soát xong mọi ca, phân nhóm hết khoản chi ở phiếu ca, **đối soát hết khoản thu chi từ phiếu ca** (thêm 10/11/2026). Chốt xong **khóa** phiếu ca, bản đối soát, kiểm đếm cuối ngày, chi phí của tháng đó. **Chỉ Chủ mở lại**, bắt buộc lý do, có lịch sử. |

---

## 5e. Ca FULL TIME (LHP) gộp vào ca chính — chốt và ĐÃ LÀM 09/11/2026 (tệp supabase/25_full_time.sql)

| Điểm | Anh Tiến chốt |
|---|---|
| Cách hiện | Không còn khối / cột ca FULL TIME riêng. Người **FT Sáng** (06:45–15:00) hiện trong ca Sáng, người **FT Tối** (15:00–23:00) hiện trong ca Tối, kèm nhãn tím "FT giờ–giờ". Ở ca Chiều họ hiện viền nét đứt. Ca chính nào của người FT được tính theo giờ: cùng giờ bắt đầu hoặc cùng giờ kết thúc. |
| Định biên | Người FT được tính cho **mọi ca chính chồng giờ**: FT Sáng tính cho Sáng + Chiều, FT Tối tính cho Chiều + Tối. Ca FT không có định biên riêng (ẩn ở trang Định biên). Cảnh báo "làm thông 3 ca" cũng tính theo cách này. |
| Thừa / thiếu theo giờ (09/11) | Ca có người FT: dòng TỔNG CA hiện **số người có mặt cùng lúc** (vd "3/3", "3–4/3") và ghi rõ "Thừa 1: 12:30–15:00" / "Thiếu 1: 15:00–17:30"; người FT vào / về giữa ca mà lúc nào cũng đủ thì ghi "Đủ người cả ca". Màu đủ / thiếu / thừa, cảnh báo, Lịch tổng, Báo cáo đều tính theo giờ có mặt. |
| Xếp người | Bấm ô ở ca Sáng / Tối → chọn "Ca Sáng" hay "FULL TIME" rồi chọn người. Lịch tổng: mỗi ngày 3 cột, ô ca chính có thêm lựa chọn "· FT". Máy chủ chặn xếp một người vào ca FT và ca khác trùng giờ trong cùng ngày. |
| Order | Tất cả nhân viên vẫn order ca FT (dòng con ngay dưới ca chính). Chọn FT "Đi làm được" → ca chính tự "Đi làm được". Chọn ca chính "Nghỉ" → FT tự "Nghỉ". Áp cho mọi cách nhập (nhân viên, quản lý sửa). |
| Phiếu chốt ca / Bảng ca | Ca FT không có phiếu riêng, không có ô ở Bảng ca, không báo "quá giờ chưa chốt". Mở phiếu ca chính thì người FT làm chồng giờ tự có trong danh sách nhân viên của phiếu. |

---

## 5r2. Rà soát toàn app 13/11/2026 — Giai đoạn 1 + 2 (`supabase/59_an_toan_nhe_may_chu.sql`, `60_tang_toc.sql`)
- **Sao lưu**: gói ZIP đủ mọi bảng (tự lấy danh sách); máy chủ tự sao lưu 02:30 hằng ngày, giữ 7 bản (gói Supabase Free không có sao lưu); Thứ Hai nhắc Chủ tải ZIP nếu 7 ngày chưa tải.
- **Bảo mật**: thu hồi quyền bảng không có luật cho phép (khách 0 quyền), bảng mới mặc định không cấp quyền; đóng hàm nhắc phiếu ca + hàm nội bộ.
- **Sổ tệp máy chủ đã chạy** `app_migrations` (LOG › Tệp máy chủ đã chạy); mỗi tệp SQL mới tự ghi (quy tắc trong CLAUDE.md).
- **Tốc độ**: thông báo đến hạn chạy bằng lịch máy chủ mỗi phút; Lịch cơ sở hỏi máy chủ 60 giây/lần, ngừng khi thẻ ẩn; chỉ mục cho mọi cột nối bảng; "Ca chờ kế toán" 117 ms → 6 ms; bảng tuần 1 lần gọi (`app_ds_week`, `app_kt_bank_week`).
- **Đúng số**: trang Đối soát ca hiện số tiền do máy chủ tính sau mỗi lần lưu (`app_ca_money`); máy chủ tự so 2 cách tính tiền mỗi đêm (02:45), lệch thì báo Chủ.
- **Bản mới**: `docs/version.json` — web đang mở hiện "Có bản cập nhật mới — Tải lại".
- **Giai đoạn 3** (`supabase/61_luat_doi_soat_fabi.sql`, `62_viec_hom_nay.sql`):
  - Kế toán **chỉ nhập số dư cuối ca**: số đầu tự lấy = số cuối ca trước (hiện chữ, có nút Sửa); gõ số cuối ca Sáng thì ca Chiều tự cập nhật; nút **Lưu cả ngày**.
  - **Việc hôm nay** (`/hom-nay`) là trang chủ của Chủ / Quản lý (có quyền đối soát) / Kế toán: chỉ hiện việc còn tồn theo vai trò (ca chờ đối soát, đang sửa, nghỉ & làm thay chờ, phiếu quá ngày chưa gửi, thu chi chờ nhóm; ca thiếu file Fabi / số dư, món chưa có nhóm; phiếu rút chờ xác nhận, nghỉ & làm thay chờ Chủ duyệt, số ngày chưa tải sao lưu). Nhân viên vẫn vào Order.
  - Luật đối soát theo Fabi (anh Tiến chốt): **hóa đơn sửa / xóa** trên Fabi → Doanh thu không tự duyệt; **khách trả nợ trên Fabi** phải khớp khoản "khách đã trả" chọn trong ca, lệch → Công nợ không tự duyệt. Đèn đối soát ghi rõ lý do và có nút **"Đã xem — duyệt"**.
  - **"Bỏ ca"**: chốt chỉ phạt 200.000đ, không trừ giờ. 5 ca LHP lệch do rút tiền: anh Tiến tự tạo phiếu rút ở từng ca.

## 5r3. Cho vay (LHP) — CHỐT và ĐÃ LÀM 13/11/2026 (`supabase/64_cho_vay.sql`)
- Chỉ cơ sở bật trong cài đặt `cho_vay_co_so` (hiện **LHP**). Người vay là **người ngoài khai báo sẵn** ở **Cài đặt › Người vay** (tên, sđt, ghi chú; Chủ / Quản lý tổng sửa). **Nhân viên không vay.**
- Trang **Thu chi** của LHP có khung **Cho vay**: nút Cho vay (người vay, ngày, số tiền, tiền mặt / chuyển khoản, ghi chú), danh sách người còn nợ, **Ghi trả nợ** (trả dần, không quá số còn nợ), lịch sử từng khoản + lần trả (xoá được khi tháng chưa chốt; khoản đã có lần trả phải xoá lần trả trước).
- Cho vay = **tiền ra khỏi quỹ**, trả nợ = **tiền về quỹ** (Sổ quỹ có dòng "Cho vay: …" / "Trả nợ vay: …"); **không tính chi phí / doanh thu** (chốt tháng không đổi).

## 5r4. Sửa thu chi linh hoạt — CHỐT và ĐÃ LÀM 13/11/2026 (`supabase/65_sua_thu_chi_linh_hoat.sql`)
- **Đổi nhóm ngay tại dòng** ở trang Thu chi: khoản từ phiếu ca chọn nhóm (hoặc "Không tính") là **đối soát xong**; khoản đã đối soát vẫn đổi lại được tới khi chốt tháng. Khoản quản lý tạo cũng đổi nhóm tại dòng.
- **Sửa khoản phiếu ca** (nút Sửa): thu / chi, nội dung, số tiền, tiền mặt / chuyển khoản, nhóm. Sửa vào **bản đối soát** (phiếu nhân viên giữ nguyên), nhóm đi theo khoản. Đổi số tiền / hình thức: **ghi lý do**. **Chủ / Quản lý tổng sửa thẳng** (anh Tiến chốt 13/11): không mở lại mục tiền, ca đã đối soát giữ nguyên (kể cả mục web tự duyệt, khoản âm đã xử lý), nhật ký đối soát ghi số cũ → số mới. Người có quyền Đối soát khác chỉ sửa số tiền khi mục Tiền mặt / Chuyển khoản liên quan của ca **chưa** đối soát. Quản lý cơ sở (không có quyền Đối soát) chỉ đổi nội dung + nhóm. Khoản tự động (chi lương, khách mượn) không sửa ở đây.
- **Đổi nhóm hàng loạt**: tích nhiều dòng (hoặc "Chọn tất cả khoản đang hiện") → chọn 1 nhóm → Đổi nhóm. Phải cùng là khoản chi (hoặc cùng là thu); "Không tính" chỉ cho khoản phiếu ca.
- Khoản tạo từ **phiếu chi chuyển khoản** (Đối soát ca): chỉ đổi nhóm / nội dung; số tiền, ngày, hình thức, xoá → làm ở Đối soát ca.
- **Cho vay**: nút **Sửa** khoản vay (người vay, ngày, số tiền ≥ số đã trả, hình thức, ghi chú) và **Sửa** lần trả (không quá số còn nợ).
- **Đổi khoản chi thành cho vay** (cơ sở bật Cho vay — LHP; nút "Đổi thành cho vay" trong hộp Sửa, chọn người vay): khoản **quản lý tạo** → bỏ khỏi Thu chi, thành khoản vay cùng ngày / số tiền / hình thức (Sổ quỹ trừ 1 lần ở dòng Cho vay). Khoản **phiếu ca** → thành "Không tính" + khoản vay ghi "từ phiếu ca" (Sổ quỹ không trừ thêm vì tiền đã ra khỏi két trong ca); khoản vay đó chỉ đổi người vay / ghi chú, xoá khoản vay thì khoản trở lại Thu chi (chờ đối soát).
- **Bước 66** (`66_doi_phieu_chi_ck_thanh_vay.sql`, anh chốt "làm giống tiền mặt"): khoản "(chuyển khoản từ …, ca …)" tạo bằng nút Phiếu chi ở Đối soát ca cũng **đổi thành cho vay** được. Phiếu chi giữ nguyên → tiền chuyển ra của ca, chuyển khoản của ca, Sổ quỹ không đổi (dòng Cho vay thay dòng Chi). Khoản vay chỉ đổi người vay / ghi chú; xoá khoản vay → khoản chi trở lại Thu chi (nhóm cũ); xoá phiếu chi → xoá luôn khoản vay (khi chưa có lần trả).
- Tháng đã chốt: không sửa được (máy chủ cũng chặn).

## 5r5. Chủ sửa thẳng ở Đối soát ca — CHỐT và ĐÃ LÀM 13/11/2026 (`supabase/67_chu_sua_thang_doi_soat.sql`)
- Mục đã đối soát (kể cả web tự đối soát, phiếu đã HOÀN THÀNH ĐỐI SOÁT): **Chủ** bấm "Sửa" → hộp chọn **Sửa thẳng** hoặc **Mở lại mục** (cả hai đều ghi lý do).
- Sửa thẳng: chỉ mở ô của đúng mục đó (các ô khác khoá), sửa xong bấm "Xong, khoá lại". Phiếu **giữ nguyên đối soát**, không duyệt lại; nhật ký ghi số cũ → số mới, lý do "Chủ sửa thẳng: …".
- Chỉ các mục có số liệu (Thời gian, Doanh thu, Tiền mặt, Chuyển khoản, Thu chi, Nhân viên, Nhập hàng); Bàn giao / Công nợ chỉ Mở lại mục. Người khác: như cũ (mở lại mục). Tháng đã chốt: không sửa được.

## 5r6. Gộp âm tiền và trừ lương ở Thu chi — CHỐT và ĐÃ LÀM 13/11/2026 (`supabase/68_gop_am_tien_tru_luong.sql`)
- Mỗi ca thiếu tiền = **1 dòng "Âm tiền – ca …"** (nhãn đỏ TL nếu có người trừ lương, ÂM nếu chưa); bấm **Chi tiết** thấy khoản nhân viên ghi + từng người chịu (Sửa / huỷ từng người). Không còn từng dòng TL riêng.
- Khoản chi nhân viên ghi "Âm tiền / thiếu tiền" trên phiếu ca (hoặc khoản chi bất kỳ qua nút "Đây là âm tiền…" trong hộp Sửa) → quản lý gán:
  **Trừ lương…** (chọn người chịu, mặc định chia đều theo nhân viên trong ca, tổng = khoản; khoản chi thành "Không tính", sinh khoản âm mục "Âm tiền (phiếu ca)", mặc định trừ lương, báo nhân viên) hoặc **Quán chịu** (nhóm chi "Âm tiền – quán chịu", tính chi phí). **Bỏ gán** / huỷ hết người chịu → khoản trở lại "Chờ gán".
- Khoản âm từ đối soát vẫn như cũ (chọn người chịu khi đối soát), hiện chung trong dòng Âm tiền của ca.

## 5r7. Thu chi giao diện mới — CHỐT 13/11/2026 (mẫu https://claude.ai/artifact/Nc6Kjkz434oJbbgpbHPAYs), bước 1 ĐÃ LÀM (`supabase/69_thu_chi_giao_dien_moi.sql`)
- **Mỗi lần 1 cơ sở** (bỏ "Tất cả"); mở trang không chọn thì lấy cơ sở xem lần trước.
- **6 ô đầu trang**: Thu, Chi (tách TM / CK), Nợ (khách nợ chưa thu), Cho vay (còn nợ), Đã đối soát (x / y khoản), Chênh lệch tiền (thiếu / dư của các ca đã chốt trong tháng, lệch ≤ 5.000 bỏ qua). Bấm ô để lọc sổ.
- **2 cột** (máy tính; điện thoại xếp chồng): trái **Sổ thu chi gộp theo ngày** (mỗi ngày ghi tổng thu / chi); phải **Cần phân loại** (chọn nhóm ngay) → **Chi theo loại** (so tháng trước ▲ đỏ / ▼ xanh) → **Cho vay**.
- Lọc nhanh Tất cả / Chi / Thu / TM / CK / Chưa đối soát + ô tìm + **Lọc thêm** (nguồn, loại, nhóm).
- Mỗi dòng: nội dung, ca + người ghi (hoặc "Quản lý tạo"), số tiền, **ô tích dưới số tiền** (✓ xanh = đã đối soát, ô vàng trống = chưa; tích khi đã có nhóm = đối soát luôn, chưa có nhóm thì mở khung chọn nhóm), nhóm, người đối soát + giờ.
- **Bấm dòng mở khung sửa** (không còn nút trên dòng). **Bỏ đổi nhóm hàng loạt.**
- **"+ Thêm khoản"**: chọn loại ngay (Chi / Thu / Cho vay), nhóm **bắt buộc**, ngày lùi được (tháng chưa chốt).
- **Bước 70 ĐÃ LÀM** (`70_cong_no.sql`): khung **Công nợ** thay khung Cho vay — nhóm **Kho tổng** (vay + **trả hộ** cộng chung, Kho tổng trả thì "Ghi trả nợ"; nút "+ Trả hộ Kho tổng" chỉ LHP, cài đặt `tra_ho_co_so`; Sổ quỹ ghi "Trả hộ Kho tổng"), **Người vay**, **Khách hàng nợ** (từ phiếu ca + quản lý ghi thêm: tên, SĐT, ngày, số ngày nợ — đỏ khi quá 7 ngày; quản lý sửa / xoá khoản mình ghi khi chưa thu). **Cho vay mở mọi cơ sở.** Quyền Công nợ: Chủ, QL tổng, QL cơ sở. Nhân viên không được vay / ứng (ghi chú).
- Phiếu chốt ca: **dòng nhắc "Khách đang nợ"** ở đầu phiếu; mục "Khách trả nợ cũ trong ca" có ô **số tiền khách trả** → **trả một phần** (phần đã thu cộng vào ca, phần còn lại vẫn nhắc ở ca sau; bỏ chọn thì gộp lại).

## 5r8. Tab Âm tiền — CHỐT 13/11/2026 (mẫu https://claude.ai/artifact/4rxfnB6uUJuHYUZtv5ENHo), ĐÃ LÀM (`supabase/71_am_tien.sql`, trang `#/quan-ly/am-tien`)
- Quản lý ca › **Âm tiền** (Chủ, QL tổng, QL cơ sở; kế toán không): mỗi lần 1 cơ sở, theo tháng. Ô Chênh lệch tiền ở Thu chi bấm sang đây.
- Mỗi ca đã chốt × tiền mặt / chuyển khoản có **lệch > 5.000** (≤ 5.000 coi như khớp — đối soát tự duyệt luôn): cột trái **ca thiếu** (Chờ tiền về = CK, Chờ gán = TM, Đã xử lý), cột phải **ca dư**. 4 ô số bấm để lọc.
- **Đối soát**: chọn THIẾU ở Tiền mặt / Chuyển khoản → mặc định **"Chờ tiền về"** (CK) / **"Để tab Âm tiền xử lý"** (TM): ca vẫn hoàn thành đối soát, chưa báo nhân viên; vẫn chọn được "Chọn người chịu ngay" như cũ.
- **Ghép** ca thiếu với ca dư cùng loại tiền (web gợi ý ca dư cùng cơ sở trong 3 ngày; ghép từng phần; lý do bắt buộc). Chủ / QL tổng ghép → có hiệu lực ngay; QL cơ sở ghép → **chờ Chủ / QL tổng duyệt**. Bỏ ghép được (trước chốt tháng). Ghép chỉ là bản ghi đối chiếu, **không sửa số của ca đã đối soát**. Ghép có hiệu lực → báo nhân viên ca thiếu; nếu đã trừ lương thì **tự huỷ / giảm** (đã nộp bù → huỷ = quán hoàn lại), báo từng người.
- Không có tiền về: **Trừ lương…** (mặc định chia đều người làm ca, sửa được; báo nhân viên, giải trình được) hoặc **Quán chịu** (chỉ Chủ / QL tổng; khoản chi nhóm "Âm tiền – quán chịu", tính chi phí, **không đổi quỹ**).
- Ca dư không ghép: **Thu khác** (khoản thu nhóm "Thu khác", không đổi quỹ). Khoản Quán chịu / Thu khác hiện ở Thu chi nhưng chỉ sửa / bỏ ở tab Âm tiền.
- Còn ca **Chờ tiền về / Chờ gán / ghép chờ duyệt** → **không cho chốt tháng**. Khoản âm tháng 11 đã trừ lương hiện ở "Đã xử lý" để xem lại (ghép được thì tự huỷ trừ lương).

## 5r9. Sổ quỹ giao diện mới — CHỐT 13/11/2026 (mẫu https://claude.ai/artifact/4nhoqEprUBM2nq3uz7aeww), ĐÃ LÀM (`supabase/72_so_quy.sql`)
- **Mỗi lần 1 cơ sở** (bỏ "Tất cả"; nút Quỹ ngoài giữ nguyên, chỉ Chủ). Web nhớ cơ sở xem lần trước (chung với Thu chi / Âm tiền).
- **5 ô**: Quỹ tiền mặt (đỏ + nhắc rút khi quá 20.000.000), Tài khoản (sổ, so với số kế toán nhập), Đã rút tháng này, Phiếu chờ Chủ nhận, Kiểm quỹ lần cuối.
- **2 cột**: trái **Sổ chi tiết** Tiền mặt / Tài khoản theo ngày (mới nhất trên cùng, mỗi dòng ghi số còn lại; nhãn "tự động", "QL sửa", "luân chuyển"); phải **Nộp quỹ cuối ngày** (ngày chưa có phiếu ca thu gọn) → **Phiếu rút** → **Luân chuyển quỹ** → **Kiểm quỹ**.
- **Nộp quỹ cuối ngày tự động** = số đếm két **ca cuối đã chốt** trong ngày (quản lý đếm cuối ngày thì lấy số quản lý) − 1.000.000 gối đầu; khác thì quản lý sửa.
- **Luân chuyển quỹ** tiền mặt ↔ tài khoản (Chủ, QL tổng, QL cơ sở; lưu là xong): quỹ này giảm, quỹ kia tăng cùng số; **không** tính thu / chi, **không hiện ở Thu chi**.
- **Kiểm quỹ** mỗi tuần 1 lần (quản lý tự chọn ngày), web nhắc khi quá 7 ngày. Kiểm lệch → **Điều chỉnh…**: tạo khoản chi (thiếu) / thu (thừa) ở Thu chi cùng ngày kiểm, nhóm bắt buộc, để sổ khớp tiền thật (mỗi lần kiểm điều chỉnh 1 lần).
- Số dư đầu 01/11 = 0 (giữ nút nhập số dư đầu của tháng bắt đầu sổ).

## 5r10. Phần nhân viên + Quỹ ngoài — CHỐT 13/11/2026, ĐÃ LÀM (chỉ giao diện)
- Phiếu chốt ca (bước Thu chi trong ca): nhân viên chỉ chọn **Thu / Chi** + nội dung + số tiền (quản lý phân loại sau). **Không cho ghi "âm / thiếu / hụt tiền" vào thu chi** — két thiếu thì đếm đúng số thực tế, web tự tính chênh lệch, quản lý xử lý ở Đối soát / tab Âm tiền. Bản phiếu ở trang quản lý cũng chặn như vậy.
- Quỹ ngoài: khoản chi / thu ngoài mặc định gợi ý **chia đều** cho các cơ sở (Chủ tự cân đối, đổi cách chia được).

## 5r11. Sửa sau khi dùng thử — CHỐT và ĐÃ LÀM 13/11/2026 (`supabase/74_ghi_nhan_no_gio_lich.sql`)
- **Giờ gợi ý khi chốt ca** (bước Ai làm ca): theo **Lịch tuần của từng người** (ca đã xếp, vd FULL TIME → giờ FULL TIME theo cài đặt ca của cơ sở). Người làm hộ (không có lịch ca này) **để trống**, nhân viên tự gõ giờ thật.
- **Ghi nhận nợ ở Đối soát ca** (tình huống mẫu: ĐK ca Sáng 01/11 — khách nợ nhưng nhân viên bấm thanh toán chuyển khoản trên Fabi): mục Công nợ của trang Đối soát có nút **"+ Ghi nhận nợ"** (tên / bàn, SĐT, số tiền, NV bấm nhầm Chuyển khoản hay Tiền mặt). Số tiền của ca **không đổi** (ca thiếu khoản đó); khoản nợ vào **Công nợ** + nhắc ở các ca sau; tab Âm tiền ghi ca **"Chờ khách trả nợ"** (nằm ở ô Chờ tiền về). Ca sau khách trả → nhân viên chọn "Khách trả nợ cũ" như thường (trả một phần được) → **web tự bù** phần thiếu của ca gốc. Còn chờ khách trả → **chưa chốt được tháng**. Khoản ghi nhận chỉ xoá được khi khách chưa trả.
- **Lỗi gõ ô Số dư đầu** (phiếu chốt ca): đang gõ không còn bị nhảy / mất số (ô lý do lệch hiện / ẩn tại chỗ, không vẽ lại cả bước).
- **Khung Công nợ** (cột phải Thu chi): mỗi người 2 tầng — tên + chi tiết / còn nợ + nút Ghi trả nợ (hết vỡ chữ).
- **Nhắc chung khách nợ + khách mượn** (bước 75, sau vụ LHP ca Chiều 07/11 "Anh thắng 128k" ghi nhầm vào Khách mượn nên ca Tối không thấy): dòng nhắc đầu phiếu chốt ca và danh sách "Khách trả nợ / trả tiền mượn trong ca" (bước Phiếu Fabi) hiện cả khách nợ lẫn khách mượn tiền két (ghi rõ "Khách mượn – …").

## 5r12. Tab Chốt ca xem theo tuần — CHỐT và ĐÃ LÀM 13/11/2026 (chỉ giao diện)
- Quản lý ca › **Chốt ca**: bảng **tuần** (hàng = ngày Thứ 2 → CN, cột = ca), **mỗi lần 1 cơ sở** (nút chọn cơ sở, web nhớ cơ sở xem lần trước, chung với Thu chi / Âm tiền / Sổ quỹ); nút ‹ › đổi tuần, "Về tuần này".
- Mỗi ô ca: màu + chữ ngắn — **Xong** (xanh), **Đang chốt** (vàng), **Chưa mở** (trắng), **Thiếu phiếu** (đỏ: ngày đã qua mà chưa mở phiếu, từ 01/11); phiếu xong ghi thêm **TM / CK lệch** (âm = thiếu). Bấm ô để mở phiếu (ô thiếu phiếu → mở phiếu bổ sung). Đường dẫn cũ `#/ca?ngay=…` mở đúng tuần của ngày đó.

## 5r13. Chốt ca / Đối soát tách 2 phần, tiền tách riêng — CHỐT và ĐÃ LÀM 13/11/2026 (chỉ giao diện)
- **Tab Chốt ca** (bảng tuần, 1 cơ sở): chỉ **trạng thái phiếu** (Xong / Đang chốt / Chưa mở / Thiếu phiếu) — tiền lệch xem ở tab Đối soát.
- **Tab Đối soát** mặc định **theo tuần, 1 cơ sở** (nút chọn cơ sở, ‹ › đổi tuần): bảng **① Trạng thái đối soát** (hàng ngày × cột ca + cột Cuối ngày: Đã đối soát / Chờ đối soát x/9 / Đang sửa / Chờ kế toán / Đang chốt / Thiếu phiếu / Có khoản âm; bấm ô mở Đối soát ca, ô Cuối ngày mở trang kiểm đếm theo ngày) và bảng **② Tiền** (TM / CK lệch từng ca + cột Cả ngày + hàng Cả tuần). **Việc chờ đối soát** của cơ sở đặt dưới 2 bảng. Kiểu **Theo ngày** vẫn giữ (kiểm đếm tiền mặt cuối ngày).
- **Phiếu chốt ca** (nhân viên) chia **2 phần**: **① Phần việc** (Ai làm ca · Số cốc · Bàn giao & nhận hàng) → nút **"Xong phần việc"**; **② Phần tiền** (Phiếu Fabi · Khách nợ · Thu chi · Chuyển khoản hotline · Kết quả tiền · Kiểm tra → GỬI PHIẾU) **chỉ mở khi xong phần việc**. Đầu phiếu có 2 khối phần (tiến độ riêng, bấm để chuyển phần). **Nhận hàng không chặn phần tiền.**
- Bước 78: **phiếu đã hoàn thành (xem lại)** và **trang Đối soát ca** cũng chia **① Phần việc** (Nhân sự & bàn giao, Nhận hàng) → **② Phần tiền**; các bước đối soát đổi thứ tự: 1 Nhân sự & bàn giao · 2 Nhận hàng · 3 Tiền · 4 Hoàn thành (link `buoc=2` = hàng, `buoc=3` = tiền).

## 5r14. Đối soát ca tách tab + nhãn khách nợ trên bảng ca — ĐÃ LÀM 13/11/2026 (`supabase/79_no_tren_bang_ca.sql`)
- Trang **Đối soát ca trên máy tính**: tab **① Phần việc / ② Phần tiền / ③ Hoàn thành**, mỗi lần 1 phần, tự mở phần còn việc (điện thoại vẫn từng bước).
- **Bảng tuần tab Chốt ca và tab Đối soát**: ô ca có nhãn **"Nợ … chưa trả"** (đỏ — còn khách nợ / khách mượn của ca chưa trả), **"Nợ … đã trả"** (xanh — trả hết), **"Thu nợ …"** (xanh dương — ca này thu được nợ ca trước); rê chuột / giữ vào nhãn để xem tên khách, trả ở ca nào, TM hay CK (`app_ca_debt_week`).

## 5r15. Bảng ca tuần gộp tiền + nợ — CHỐT và ĐÃ LÀM 13/11/2026 (chỉ giao diện)
- Vẫn **2 tab riêng** (Chốt ca, Đối soát), mỗi tab **1 bảng tuần** (tab Đối soát bỏ kiểu 2 bảng). Mỗi ô ca: trạng thái (phiếu / đối soát) → **TM / CK âm dương** → **từng khoản nợ**: "Nợ Bàn 9 50k · chưa trả" (đỏ) hoặc "· đã trả CK ca Chiều 12/11" (xanh); ca thu nợ ghi "Thu nợ … (nợ ca … ngày …)" (xanh dương). Tab Đối soát có cột **Cả ngày** (kiểm đếm cuối ngày + tổng tiền ngày), tổng cả tuần ở đầu bảng.
- **Dưới bảng ở cả 2 tab**: phần **"Khách nợ / khách mượn trong tuần"** — ngày, ca, khách, số tiền, "Chưa trả · x ngày" hoặc "✓ Đã trả TM/CK · ca … ngày …" (bấm mở phiếu). Tab Đối soát: phần nợ nằm trên "Việc chờ đối soát".
- **Sửa 13/11 (bước 81)**: ghi **số tiền đầy đủ** (128.000, không viết 128k); **bỏ các dòng tổng** (tổng cả tuần, tiền cả ngày, tổng tiền nợ chưa trả); ô và chữ to hơn (điện thoại vuốt ngang trong bảng). Cột cuối tab Đối soát đổi tên **Kiểm đếm** (chỉ trạng thái kiểm đếm cuối ngày).

## 5r16. Bỏ chữ "khách mượn" — Nợ TM / Nợ HĐ — CHỐT và ĐÃ LÀM 13/11/2026 (bước 82, máy chủ 80_no_tm_no_hd.sql)
- Mọi khoản đều là **NỢ**, chia 2 loại: **Nợ TM** (khách cầm tiền mặt của quán — trước gọi "khách mượn") và **Nợ HĐ** (khách chưa trả hóa đơn — trước gọi "khách nợ"). Cách tính tiền giữ nguyên (Nợ TM trừ vào tiền mặt trong két).
- Đổi chữ ở phiếu chốt ca (bước "Nợ HĐ", nút "+ Nợ TM", nhắc "Khách đang nợ"), phiếu xem lại, bảng tuần Chốt ca / Đối soát, Thu chi, Âm tiền.
- Thu chi › Công nợ và ô "Nợ" của Thu chi **tính cả Nợ TM** (trước chỉ Nợ HĐ); mỗi dòng có nhãn Nợ TM / Nợ HĐ.

## 5r17. Công nợ gia đình — CHỐT và ĐÃ LÀM 13/11/2026 (bước 83, máy chủ 81_cong_no_gia_dinh.sql)
- Cài đặt › Người vay: ô **Công nợ gia đình** (chỉ Chủ / Quản lý tổng tạo, sửa) — người nhà, cuối tháng mới thu, không nhắc khi chốt ca. Ở Công nợ, tên có nhãn "Gia đình".
- Thu chi › Công nợ › Khách hàng nợ: nút **"→ Gia đình"** (quản lý có quyền Thu chi cơ sở đó) — chọn người gia đình; khoản Nợ TM / Nợ HĐ thành khoản cho vay của người đó (giữ ngày, số tiền, ghi "từ phiếu ca"), khoản nợ ca đóng lại (phiếu chốt ca hết nhắc). **Sổ quỹ không trừ thêm** (tiền đã ra khỏi két trong ca). Không sửa số tiền được; **xoá khoản cho vay = hoàn tác**, khoản nợ ca mở lại.
- Bảng tuần Chốt ca / Đối soát: khoản đã chuyển ghi "→ công nợ gia đình".

## 5r18. Phiếu chốt ca phần tiền mới — Nợ CK, Khách nợ 1 bước, Thu chi 2 phần — CHỐT và ĐÃ LÀM 13/11/2026 (bước 84 · đợt 1, máy chủ 82_no_ck_chot_ca.sql)
- 3 loại nợ theo **Fabi đã ấn gì**: **Nợ HĐ** (Fabi ghi nợ, kind `bill`) · **Nợ TM** (đã lỡ ấn "thanh toán tiền mặt" / khách cầm tiền két, `muon`) · **Nợ CK** mới (đã lỡ ấn "thanh toán chuyển khoản" nhưng khách chưa chuyển, `ck`). Ca sau nhắc thu như nhau; khách trả nợ cũ chọn ở bước Phiếu Fabi.
- Phần tiền còn 5 bước: Phiếu Fabi → **Khách nợ trong ca** (gộp 3 loại, mỗi khoản bấm HĐ / TM / CK, có giải thích; tổng Nợ HĐ phải bằng dòng Nợ trên phiếu Fabi) → **Thu chi 2 phần** (Tiền mặt / Chuyển khoản; chi lương tiền mặt ghi như khoản Chi ra "Chi lương + tên", bỏ ô lương ở bước Ai làm ca — phiếu cũ đã có số vẫn tính) → Chuyển khoản hotline (phải thấy = CK Fabi + khách trả nợ CK ± thu chi CK − **Nợ CK mới**) → **Kết quả tiền & gửi phiếu** (gộp bước Kết quả + Kiểm tra lần cuối; bảng từng dòng ghi rõ số lấy từ bước nào).
- **Không bắt ghi lý do** khi lệch tiền mặt / chuyển khoản / số dư đầu (máy chủ cũng bỏ) — chỉ có ô ghi chú không bắt buộc; quản lý tự chốt khi đối soát.
- Máy chủ: `app__ca_money` trừ Nợ CK khỏi chuyển khoản phải nhận (đối soát, bảng tuần, tự tick); tự kiểm hằng đêm cộng Nợ CK.
- Đợt sau (đã chốt ý, chưa làm): bỏ mục Người vay (khoản cho vay cũ → Nợ TM / Nợ CK, QL đánh dấu Gia đình ở Công nợ); trang Đối soát từng ca đi từng bước như phiếu (Phần việc: Ai làm ca · Nghỉ & ca bổ sung x2 (QL tổng phân loại, Chủ duyệt) · Bàn giao & nhận hàng (giao thành việc); Phần tiền: Phiếu Fabi · Khách nợ · Thu chi (chọn nhóm, gán lương không bắt buộc) · Tiền thực nhận (thu theo ca / cuối ngày — cuối ngày bắt buộc kết ca trước = mở ca sau) · Xử lý lệch & hoàn thành (Quán chịu / Chia đều người làm ca / Đối soát lại sau; CK lệch xử lý như TM)); màu ô ca: xanh lá Đã đối soát · vàng **Hoàn thành 1 phần** · xanh dương Chờ đối soát · đỏ Thiếu phiếu.

## 5r19. Bỏ mục Người vay / Cho vay — CHỐT và ĐÃ LÀM 14/11/2026 (bước 85 · đợt 2, máy chủ 83_bo_nguoi_vay.sql)
- Mọi khoản người khác nợ quán là **Nợ HĐ / Nợ TM / Nợ CK**. 7 khoản cho vay còn nợ (đều người nhà, LHP) đã chuyển thành Nợ TM (vay tiền mặt) / Nợ CK (vay chuyển khoản), đánh dấu **Công nợ gia đình**, giữ tên, ngày, số còn nợ. Khoản cho vay cũ **giữ trong lịch sử** — Sổ quỹ các tháng trước không đổi (đã so trước / sau cả 5 cơ sở).
- Thu chi › Công nợ: nút **+ Nợ HĐ / + Nợ TM / + Nợ CK** (Nợ TM / Nợ CK có ô **"Tiền đưa từ quỹ"** → Sổ quỹ trừ ra, như cho vay trước đây); 2 nhóm **Khách nợ** (phiếu chốt ca nhắc thu) và **Công nợ gia đình** (cuối tháng thu, không nhắc); nút **Gia đình / Bỏ gia đình**; nút **Đã thu** khi trả ngoài ca (ngày, số tiền — trả một phần được, tiền mặt / chuyển khoản) → Sổ quỹ cộng vào; "Quản lý đã thu gần đây" có **Bỏ đã thu** (tháng chưa chốt).
- Phiếu chốt ca: khung nhắc đầu phiếu không nhắc công nợ gia đình; ở bước Phiếu Fabi các khoản gia đình nằm trong mục thu gọn "Công nợ gia đình (N)" — người nhà trả trong ca vẫn chọn được.
- Bỏ: Cài đặt › Người vay (khỏi menu), "+ Cho vay", "+ Trả hộ Kho tổng", "Đổi thành cho vay" ở Thu chi, nút "→ Gia đình" (bước 83). Máy chủ chặn tạo khoản cho vay mới.

## 5r20. Đối soát từng ca đi từng bước như phiếu chốt ca — CHỐT và ĐÃ LÀM 14/11/2026 (bước 86 · đợt 3, chỉ giao diện)
- Trang Đối soát ca (cả máy tính và điện thoại) đi **7 bước**, mỗi lần 1 bước, cùng thứ tự phiếu nhân viên: ① Ai làm ca (kèm phân loại Nghỉ & làm thay x2 — QL tổng phân loại, Chủ duyệt) · ① Bàn giao & nhận hàng · ② Phiếu Fabi · ② Khách nợ · ② Thu chi (chọn nhóm) · ② Tiền thực nhận · ② Xử lý lệch & hoàn thành.
- Nút **"✓ Duyệt & tiếp"** duyệt các hạng mục của bước (tiền mặt / chuyển khoản chỉ tự duyệt khi khớp). Đèn đối soát ở đầu trang vẫn giữ (nút "Xử lý" nhảy đúng bước).
- Bước cuối **Xử lý lệch** cho tiền mặt và chuyển khoản: **Quán chịu** (thừa: Ghi thu khác — Chủ / QL tổng) · **Chia đều người làm ca** (tích / bỏ tích, sửa số, tổng = lệch; thành khoản âm trừ lương) · **Đối soát lại sau** (mặc định).
- Bảng tuần tab Đối soát: ô ca đã duyệt một phần mà chưa hoàn thành → **vàng "Hoàn thành 1 phần"** (x/9 mục); xanh lá Đã đối soát; xanh dương Chờ đối soát; đỏ Thiếu phiếu.
- Bước 87 (14/11): thêm bước **Nghỉ & ca bổ sung (x2)** riêng — chỉ hiện khi ca có người nghỉ / làm hộ (QL tổng phân loại, Chủ duyệt; ca chỉ hoàn thành khi Chủ duyệt — web đã kiểm sẵn). Bàn giao có nút **"+ Giao thành việc"** (người nhận, mức độ, hạn → người nhận được thông báo, việc hiện ở Công việc, xong thì bàn giao tự "đã xử lý").
- Bước 88–89 (14/11, máy chủ 84_thu_tien_mat.sql): anh báo đối soát "như cũ" → làm lại phần bên trong cho giống ảnh mẫu: **Ai làm ca** (từng người Đúng lịch ✓ / đến muộn / về sớm / ngoài lịch), **Phiếu Fabi** (bảng NV ghi · file Fabi · ✓/✗, khách trả nợ cũ ghi cách kiểm), **Khách nợ** (quản lý bấm đổi HĐ / TM / CK — `app_ca_debt_kind`), **Tiền thực nhận** (chuyển khoản: phải nhận từng dòng, so NV cộng + sao kê; tiền mặt: phải có từng dòng, so NV đếm). Ô sửa số liệu cũ gom vào mục "Sửa số liệu…" thu gọn.
- **Thu theo ca / Thu cuối ngày** (mỗi ca, `app_ca_cash_mode`): thu theo ca → quản lý nhập số đếm thực nhận (`shift_reports.ql_counted`), web tính thu về quỹ (trừ gối đầu 1.000.000), lệch tiền mặt tính theo số quản lý đếm; thu cuối ngày → điều kiện tiền kết ca = tiền mở ca sau (lệch báo đỏ).
- Phiếu nhân viên › Chuyển khoản hotline ghi từng dòng như ảnh mẫu.
- Bước 90 (14/11, máy chủ 85_gan_chi_luong.sql): Thu chi ở đối soát chia 2 phần Tiền mặt / Chuyển khoản; khoản **Chi lương** tiền mặt có ô **Gán cho nhân viên** (không bắt buộc, `fin_move_cats.employee_id`, `app_tc_move_emp`) → Bảng công cộng vào "Lương tiền mặt đã trả". Quản lý **sửa số phải ghi lý do** (ô Lý do sửa trong từng mục "Sửa số liệu"; chưa có lý do thì web chưa lưu).

- Bước 91–94 (14/11): máy tính hiện phiếu chốt ca + đối soát ca như điện thoại (1 cột giữa, thanh ① Phần việc / ② Phần tiền, đèn chỉ ở bước đầu / cuối); bước cuối có **✓ Hoàn thành** + **Ca tiếp theo ›**; bước Thu chi có **+ Thêm thu chi tiền mặt / chuyển khoản** (lý do bắt buộc), bước Khách nợ có **+ Thêm khách nợ**; khoản nợ đã thu ghi rõ "Đã thu ở ca … ngày …"; bước Phiếu Fabi hiện **Khách còn nợ** — quản lý ghi khách đã trả TM / CK trong ca mà nhân viên không biết (lý do bắt buộc, trả một phần, bỏ được; máy chủ 86_ql_thu_no_doi_soat.sql).

## 5r21. Tab Công nợ riêng — CHỐT và ĐÃ LÀM 14/11/2026 (bước 95, máy chủ 87_tab_cong_no.sql)
- Menu **Quản lý ca › Công nợ**, theo từng cơ sở. 3 nhóm (`shift_debts.grp`): **① Nợ khách hàng** (Nợ HĐ + khách ngoài — phiếu chốt ca nhắc thu), **② Nợ kho tổng**, **③ Nợ khác** (thêm người nợ được). Bỏ nhãn "Gia đình": khoản gia đình cũ → Nợ khác; khoản tên "Kho tổng" / trả hộ Kho tổng → Nợ kho tổng. Cột `family` tự đồng bộ (= 1 khi không phải Nợ khách hàng).
- Mỗi người 1 dòng tổng còn nợ; từng khoản **"Nợ ngày … → Trả ngày …"** (chưa trả: N ngày, Nợ khách hàng quá 7 ngày ⚠; trả một phần: phần còn lại; đã trả hết hiện mờ trong tháng). Ô tìm tên / SĐT; ô đếm khách nợ quá 7 ngày (bấm để lọc).
- Bấm vào người: còn nợ, **Đã thu** gộp (trừ dần từ khoản cũ nhất — `app_cn_collect_many`), lịch sử đã trả (180 ngày), Bỏ đã thu (lần quản lý thu, tháng chưa chốt), **Sửa tên / SĐT / nhóm** cho mọi khoản của người đó (`app_cn_person_save`), + Ghi thêm nợ.
- Phiếu chốt ca nhân viên **chỉ nhắc / cho ghi trả Nợ khách hàng**; Nợ kho tổng / Nợ khác chỉ quản lý thu ở tab Công nợ (hoặc ở đối soát › Phiếu Fabi › Khách còn nợ).
- Nhân viên chỉ ghi thu chi bình thường; **Đối soát ca › Thu chi**: khoản chi có nút **Thành nợ** (chọn nhóm + người nợ; Nợ TM / Nợ CK theo hình thức chi; không tính chi phí, số tiền ca không đổi; Bỏ được khi chưa trả — `app_tc_move_to_debt` / `app_tc_move_undebt`). Chỉ một phần là nợ: tách 2 dòng ở "Sửa / thêm khoản thu chi" rồi đổi dòng nợ.
- Trang Thu chi bỏ khung Công nợ, còn 1 dòng "Công nợ … còn … — Mở tab Công nợ ›". Quyền như khung cũ: QL cơ sở (cơ sở mình), QL tổng + Chủ (mọi cơ sở); nhân viên không thấy tab.

## 5r22. Tắt "khách thanh toán nợ" trên Fabi POS từ ca 15/11/2026 — CHỐT và ĐÃ LÀM 14/11/2026 (bước 96, máy chủ 88_tat_tra_no_fabi.sql)
- Cuối ca, bàn chưa trả: nhân viên **bấm thanh toán TM hoặc CK trên Fabi**, rồi ghi khách nợ trên web loại **TM / CK** (như cũ — nợ TM trừ tiền két, nợ CK trừ tiền hotline). Dòng Nợ trên Fabi thường = 0; loại HĐ vẫn còn cho trường hợp Fabi để nợ.
- Khách trả nợ: Fabi **không ghi nữa**, chỉ ghi trên web (nhân viên chọn ở bước Phiếu Fabi; quản lý ghi ở Đối soát › Phiếu Fabi / Thu chi, hoặc tab Công nợ). Tiền khách trả vẫn cộng vào tiền phải có của ca.
- Từ ca 15/11 (`app__fabi_tra_no_on(work_date)` / `traNoFabi()` trong `tien.js`): phép kiểm phiếu Fabi **không trừ "khách trả nợ tiền mặt"** (Tổng tiền − Số dư đầu − Tiền mặt = Tiền chênh lệch); đèn tự đối soát **Công nợ không so với file Fabi**. Ca trước 15/11 giữ cách cũ.
- Đối soát ca › Thu chi (cùng ngày): nút **Xoá** khoản thu chi (bắt buộc lý do, chỉ bỏ ở bản đối soát) và mục **3. Khách trả nợ trong ca** (+ Khách trả nợ trong ca); không hiện lại dòng "Khách mượn – …" (nợ TM đã khai ở bước Khách nợ).
- **Trang Thu chi không hiện khoản nợ** (dòng tự thêm nợ TM của khách, khoản đã thành nợ, khoản cho vay cũ) — chỉ 1 dòng "n khoản nợ … xem ở tab Công nợ". Máy chủ 89 dọn dòng nợ cũ "chưa đối soát" → Không tính + đã đối soát. Bỏ thành nợ: ở Đối soát ca › Thu chi.

## 5r23. Sắp xếp lại tên và ô số — CHỐT và ĐÃ LÀM 15/11/2026 (bước 97, chỉ giao diện)
- Rà soát 15/11: anh **giữ đối soát ca đi từng bước** (không làm "duyệt nhanh").
- Tab **Âm tiền → "Lệch tiền ca"** (`#/quan-ly/lech-tien`; đường dẫn cũ `#/quan-ly/am-tien` vẫn mở). Chữ "Âm tiền" còn lại chỉ dùng cho **khoản âm tiền** nhân viên ghi ở thu chi và nhóm "Âm tiền – quán chịu".
- Trang Thu chi: 5 ô **Thu · Chi · Tiền về quỹ · Đã đối soát · Lệch tiền ca** (bỏ ô Công nợ / Nợ kho tổng). Tiền về quỹ = nộp quỹ TM + CK về trong tháng (Sổ quỹ), chỉ hiện với người xem được Sổ quỹ.
- Tab Công nợ: ô số đầu trang **Còn nợ · Đã thu tháng này · ① ② ③ từng nhóm**; bấm ô nhóm → chỉ hiện nhóm đó (`?g=`), bấm lại → cả 3.

## 5r24. Chuyển khoản thực nhận dạng bảng — CHỐT và ĐÃ LÀM 15/11/2026 (bước 99, chỉ giao diện)
- Theo ngày: mỗi cơ sở 1 bảng, hàng = tài khoản, cột = ca, tiêu đề cột là **giờ đóng ca trên Fabi** (chưa có Fabi thì giờ trên phiếu, ghi "(theo phiếu)").
- Kế toán chỉ gõ **số dư lúc đóng ca**; số dư đầu tự = cuối ca trước; hàng **Thực nhận** = cuối − đầu + chuyển ra ± tiền về chậm. **Tự lưu** khi rời ô.
- Anh chốt: bảng này **không báo khớp / lệch** (việc so để Đối soát). Nút ⋯ từng ô: số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm. Bỏ khung cảnh báo vàng cố định.
- **Bước 100 (cùng ngày):** chỉ còn **bảng tuần của 1 cơ sở** (chọn cơ sở + tuần; cột = 7 ngày + Cả tuần; hàng = ca → tài khoản → Thực nhận ca; dòng Thực nhận cả ngày), bỏ cách xem theo ngày và bảng tuần nhiều cơ sở cũ.
- **Bước 101 (cùng ngày) — điện thoại (≤ 700px), anh chọn cách A:** dải 7 ngày bấm chọn (✓ đủ / còn N ca / chưa), 3 ca của ngày xếp dọc, ô gõ to, cuối trang Cả ngày + Cả tuần. Mở trang chọn sẵn hôm nay (tuần khác: ngày đầu còn thiếu). Máy tính giữ bảng cả tuần.
- **Không thay đổi số đã kê khai:** số dư đầu chỉ tự điền cho ca chưa nhập gì; ca đã có số giữ nguyên, chỉ nhắc "khác cuối ca trước"; tự lưu đúng phiếu ca vừa sửa.

## 5r25. Hoá đơn giao hàng theo 1 cơ sở, xem Tuần | Tháng — CHỐT và ĐÃ LÀM 15/11/2026 (bước 102, chỉ giao diện)
- Thẻ chọn cơ sở (nhớ chung với Chuyển khoản thực nhận); nút **Tuần | Tháng** (anh chốt giữ cả hai).
- **Tuần:** máy tính = 7 cột ngày, mỗi ngày các lần giao (số phiếu, tiền, trạng thái, hồ sơ, Xem / Ghép / ×); điện thoại (≤ 700px) = dải 7 ngày (số lần giao · ✓ / đang / !) + thẻ từng lần giao.
- **Tháng:** danh sách mọi lần giao trong tháng của cơ sở, lọc trạng thái.
- Đầu trang luôn có 3 ô: tuần / tháng này, còn thiếu hồ sơ, **phải trả kho tổng cả tháng** của cơ sở. Danh sách "Hồ sơ nhận hàng còn thiếu" của cơ sở ở cuối trang.
- **File ca Fabi — bước 105 (15/11/2026):** một cơ sở, bảng tuần máy tính; điện thoại chọn trong 7 ngày và xem thẻ từng ca. Bỏ Danh sách cũ, giữ đường dẫn cũ mở đúng ngày. Ba ô kiểm soát: file đã có, phiếu thiếu file, ca khác phiếu/chưa có phiếu cần quản lý xem. Ca chưa có cả file lẫn phiếu ghi rõ chưa có dữ liệu.
- Đầu tab có **Kiểm tra tải · Đồng bộ lên web · Dừng và tắt lịch**, lịch **08:15**, tiến độ và ngày đồng bộ thành công. Nút điều khiển tiện ích Chrome trên cùng máy, luôn lấy **hôm qua · cả 4 cơ sở**, độc lập cơ sở đang xem. Tiện ích kiểm tra quyền Kế toán của trang gửi và chỉ trả trạng thái rút gọn, không truyền token/file/tiền qua cầu điều khiển. iPhone xem dữ liệu và nhập Excel thủ công, chưa điều khiển máy khác từ xa. Từ tiện ích bản 0.3.0 (23/11/2026, chặng 6): lấy bù ngày khác làm ở cửa sổ tiện ích (ô Ngày cần lấy); nút trên trang web vẫn chỉ hôm qua.
- Giữ **Chọn Excel thủ công**. Chi tiết tiền/mã ca thu gọn; bảng làm mới khi lượt đồng bộ mới hoàn tất.

## 5r26. Giao hàng kho tổng — trang riêng nhận hàng + đối soát — CHỐT 15/11/2026, ĐỢT 1 ĐÃ LÀM (bước 103, chỉ giao diện)
- Phạm vi (anh chốt): đặt hàng làm ở web riêng; web này chỉ **nhân viên nhận hàng + chụp ảnh → quản lý đối soát → kế toán kho kiểm soát → tính tiền cuối tháng**.
- **Trang Quản lý ca › Giao hàng** (`#/quan-ly/giao-hang`, quyền chot_ca / doi_soat / ke_toan). Trang Chốt ca (trang chủ nhân viên) có thẻ nổi **"🚚 Có hàng kho tổng đang chuyển tới — NHẬN HÀNG"**; nhận lúc nào cũng được, không cần ở trong phiếu chốt ca (web tự dùng phiếu ca đang mở hôm nay của cơ sở, tự nhận + xong phần "nhận hàng").
- **Nhân viên nhận (cách anh đề xuất):** chụp 1 nhóm hàng → chọn các món có trong ảnh (số tự điền = số phiếu; khác thì sửa, ô cam, **bắt buộc ghi chú**) → lặp tới hết món. Món kho quên giao: **"Không nhận được"** (số 0 + ghi chú). Món có số > 0 phải nằm trong ít nhất 1 ảnh; đủ hết mới hiện **GỬI BÁO NHẬN** (sửa được tới hết ngày). Ghi chú các món lệch gộp vào ghi chú nhận hàng.
- **Nhận hàng KHÔNG có hoá đơn** giữ nguyên chức năng, làm trên trang này: ghi tên + số lượng → chụp ảnh chọn món như thường → lưu phiếu (chờ kế toán ghép hoá đơn).
- **Quản lý đối soát theo từng ảnh** ngay trên trang (ảnh có món lệch hiện trước): **"✓ Đúng cả ảnh"** hoặc từng món **Đúng / Sai số…** (số đúng + ghi chú → báo nhân viên đếm sai). Bỏ khung nhận hàng khỏi **phiếu chốt ca** và **Đối soát ca** — chỉ còn dòng tóm tắt + link.
- Đợt 2 (chưa làm): **Chờ giao bù** (thiếu → kho giao bù, bill giữ nguyên; tick "giao bù" khi tải phiếu xuất sau, không tính tiền lần 2; quá 7 ngày nhắc kế toán), **Chờ hoá đơn bổ sung** (thừa → tính thêm tiền, kế toán lên hoá đơn cho kho rồi ghép), **Tiền tháng**, gộp trang Kế toán › Hoá đơn giao hàng vào trang Giao hàng. → **Đã làm ở 5r27.**

## 5r27. Menu Hàng hoá — tách hẳn khỏi chốt ca — CHỐT và ĐÃ LÀM 15/11/2026 (bước 104, máy chủ `91_hang_hoa_rieng.sql`)
- Anh chốt: "tách hẳn thành tab riêng **Hàng hoá**, ở đây nhận hàng, giao hàng, kiểm soát, đối soát hàng hoá" — **không liên quan đến chốt ca**.
- Menu **Hàng hoá** (nhóm Vận hành) có 4 tab: **Nhận hàng** (`#/hang-hoa/nhan`, chot_ca / doi_soat / ke_toan) · **Đối soát** (`#/hang-hoa/doi-soat`, doi_soat) · **Phiếu xuất** (`#/hang-hoa/phieu-xuat`, ke_toan / doi_soat — trang Hoá đơn giao hàng cũ, chuyển khỏi menu Kế toán) · **Kiểm soát** (`#/hang-hoa/kiem-soat`, ke_toan / doi_soat). Bỏ tab Giao hàng ở Quản lý ca; đường dẫn cũ (`#/quan-ly/giao-hang`, `#/ke-toan/hoa-don`) tự chuyển sang.
- **Nhận hàng không gắn phiếu chốt ca**: máy chủ dùng các hàm `app_gh_*` (lần giao có `received_report_id` = trống). Nhân viên chỉ thấy cơ sở mình làm (`employee_branches`). Nhận hàng không có hoá đơn cũng ở tab này và **làm tương tự** (anh chốt 15/11): chụp 1 nhóm hàng → ghi tên (gõ vài chữ chọn tên món từng nhận) + ĐVT + số lượng các món trong ảnh → lặp → **Xong — lưu phiếu nhận** (chờ kế toán ghép hoá đơn); phiếu tạo khi lưu ảnh đầu; xoá ảnh thì xoá luôn các món ghi trong ảnh. Sửa báo nhận được tới hết ngày nhận (quản lý: tới khi đối soát).
- Nhân viên: thẻ **"🚚 Có N lần hàng kho tổng đang tới — NHẬN HÀNG ›"** hiện đầu mọi trang (trừ trang Hàng hoá) + link **Nhận hàng** ở chân trang. Menu quản lý có số đếm ở tab Nhận hàng / Đối soát.
- **Phiếu chốt ca / Đối soát ca bỏ hẳn phần hàng**: bước 8 đổi tên "Bàn giao"; Đối soát ca bước 3 "Bàn giao". Ca cũ (trước 15/11) còn gắn hàng chưa đối soát thì hiện nhắc + link sang Hàng hoá › Đối soát; đối soát xong ở đó thì mục Nhập hàng của ca tự xong.
- **Đối soát xong** (đủ món, có phiếu xuất): món **thiếu** → "⏳ Chờ giao bù", món **thừa** → "🧾 Chờ hoá đơn bổ sung" (bảng `delivery_followups`). Bỏ đối soát lại thì mục còn chờ tự xoá.
- **Kiểm soát** (theo cơ sở + tháng): kế toán bấm **"Đã giao bù ›"** → chọn dòng hàng giao bù trong phiếu xuất sau của cùng cơ sở (≤ 45 ngày, dòng cùng tên lên đầu) → dòng đó **không tính tiền**; **"Đã có hoá đơn ›"** → ghi số hoá đơn bổ sung + số tiền (tự điền theo đơn giá); **Huỷ…** (bắt buộc lý do); **Hoàn tác**. Quản lý chỉ xem. Chờ ≥ 7 ngày tô đỏ.
- **Tiền tháng** = tổng phiếu xuất − hàng giao bù (không tính tiền) + hoá đơn bổ sung = **phải trả kho tổng** (`app__nh_month_total`). Chốt tháng vẫn lấy tổng phiếu xuất như cũ (chưa trừ / cộng phần giao bù, HĐ bổ sung) — để ngỏ, chờ anh quyết có đưa vào Chốt tháng không.

## 5r28. Hàng hoá — món ngoài phiếu, hoá đơn giao, đối soát, mở lại, nhắc — CHỐT 15/11/2026, mẫu giao diện đã duyệt, ĐÃ LÀM (bước 106, máy chủ `92_hang_hoa_hoa_don_giao.sql`)
- Anh dặn: **chốt tính năng trước, chưa thiết kế giao diện**.
- **Nhận hàng có phiếu xuất**: thêm **bước thêm món không có trong phiếu** (kho giao dư) — ghi tên + ĐVT + số lượng, gắn vào ảnh, giống nhận hàng không hoá đơn; món mang nhãn "Ngoài phiếu".
- **Bước cuối nhận hàng — chụp hoá đơn giao (BẮT BUỘC, cả nhận có phiếu và không hoá đơn)**: chụp hết hàng xong → chụp tờ hoá đơn giao giấy tài xế mang kèm → web hiện **danh sách món đã nhận (trên web) cạnh ảnh hoá đơn giao** để nhân viên so → nhân viên xác nhận **"Đã nhận đủ hàng hoá giống hoá đơn"** rồi mới gửi. Nhân viên **vẫn có** nút "Không có hoá đơn giao" (bắt buộc ghi chú). Anh chốt: **khi quản lý đối soát, mọi lần giao phải đủ hoá đơn + ảnh mới xác nhận xong được** — cần **ảnh hoá đơn giao giấy**; lần giao không có hoá đơn giao thì **kế toán phải tải file hoá đơn bù** lên (ở Phiếu xuất / Kiểm soát) rồi quản lý mới xác nhận xong (trước đó vẫn đối soát từng món được). Mọi món nhận được (số > 0) phải nằm trong ít nhất 1 ảnh. Anh chốt thêm: **không có trường hợp hoá đơn giao khác danh sách** → không có nút "Khác hoá đơn giao"; thấy khác thì nhân viên quay lại sửa số / thêm món cho đúng rồi mới xác nhận. **Nút xác nhận cuối** (anh đồng ý): nhận đủ → "Đã nhận đủ hàng hoá giống hoá đơn"; có lệch → web liệt kê món lệch (vd "Đường thiếu 1 kg · Ly nhựa thừa 1 cây") và nút đổi thành "Xác nhận số thực nhận: thiếu / thừa như trên" — quản lý thấy cảnh báo lệch khi đối soát.
- **Thiếu / thừa (anh xem lại và đồng ý)**: thiếu → NV sửa số + ghi chú (hoặc "Không nhận được") → QL đối soát → Chờ giao bù (hoá đơn giữ nguyên, dòng giao bù sau không tính tiền) · thừa món trong phiếu → NV sửa số + ghi chú → QL → Chờ hoá đơn bổ sung (tạm tính theo đơn giá) · thừa món ngoài phiếu → bước thêm món ngoài phiếu → QL → Chờ hoá đơn bổ sung (kế toán ghi số tiền). Quản lý xem ảnh khi đối soát; kế toán xem ở Phiếu xuất / Kiểm soát (giúp ghép hoá đơn).
- **Đối soát (quản lý)**: danh sách tất cả cơ sở, cũ nhất trước; món lệch + món ngoài phiếu xem trước; món khớp đối soát theo từng ảnh (Đúng cả ảnh / Sai số từng món); sửa số bắt buộc ghi chú, báo nhân viên; xác nhận xong → tự chuyển sang Kiểm soát.
- Sau đối soát: **thiếu** (kể cả không nhận được) → Chờ giao bù · **thừa** (món trong phiếu) → Chờ hoá đơn bổ sung theo đơn giá phiếu · **ngoài phiếu** → **Chờ hoá đơn bổ sung** (không có đơn giá, kế toán ghi số hoá đơn + số tiền).
- **Mở lại sau khi đối soát xong**: **quản lý** mở lại được khi kế toán **chưa xử lý** các món lệch ở Kiểm soát; đã xử lý thì kế toán Hoàn tác trước.
- **Nhắc việc chậm**: chỉ nhắc **phiếu xuất quá ngày giao mà chưa nhận** (nhắc quản lý cơ sở). Không nhắc chờ đối soát / chờ giao bù / chờ hoá đơn bổ sung.
- Cần máy chủ: hàm thêm món ngoài phiếu vào lần giao có phiếu (dòng `qty_invoice` trống), `app__nh_followups` tạo mục hd_bs cho dòng ngoài phiếu (giá trống), hàm mở lại đối soát kiểm tra mục Kiểm soát chưa xử lý, nhắc quá ngày giao.

## 5r29. Hàng hoá › Phiếu xuất thiết kế lại — CHỐT 15/11/2026, mẫu đã duyệt, ĐÃ LÀM (bước 107, máy chủ `93_phieu_xuat_tai_lai.sql`)
- **Phạm vi**: chỉ để kế toán **tải + tra cứu phiếu** (tải, ghép phiếu vào lần nhận chưa có phiếu xuất, xem / xoá / tải lại, xem ảnh hoá đơn giao). **Bỏ** phần "Hồ sơ nhận hàng còn thiếu" (đã có ở Đối soát / Kiểm soát) và ô "phải trả kho tổng" (tiền tháng chỉ xem ở Kiểm soát để không lệch số).
- **Tải nhiều file Excel 1 lần**: chọn cùng lúc nhiều file → web đọc hết, tự nhận cơ sở theo mã kho → bảng xem trước (file trùng số đơn / lỗi đọc / chưa rõ cơ sở để chọn) → "Lưu tất cả".
- **Cách xem**: mặc định **tất cả cơ sở, nhóm theo ngày giao** (mới nhất trên); lọc cơ sở + trạng thái + tìm số đơn; chọn tháng. (Bỏ cách xem Tuần | Tháng từng cơ sở của bước 102.)
- **Sửa / xoá**: phiếu **chưa nhận** thì xoá hoặc **tải file mới thay thế** (kho sửa phiếu); đã nhận thì không sửa — lệch xử lý bằng giao bù / hoá đơn bổ sung.
- Xem 1 phiếu: danh sách món (phiếu / NV nhận / QL sửa), ảnh hàng, **ảnh hoá đơn giao**, hoá đơn bù, file Excel gốc, trạng thái (đang chuyển → đã nhận → đối soát xong), đường dẫn sang Đối soát / Kiểm soát.
- Anh đồng ý thêm: **không cho tải file thay thế khi nhân viên đã bắt đầu chụp ảnh** theo phiếu (báo "Nhân viên đang nhận hàng theo phiếu này"); **lúc ghép phiếu xuất** vào lần nhận chưa có phiếu: hiện **ảnh hoá đơn giao** cạnh danh sách món để so.

## 5r29b. Hàng hoá — bộ lọc ngày ở Đối soát · Phiếu xuất · Kiểm soát — anh Tiến giao 19/11/2026, ĐÃ LÀM (bước 167, máy chủ `146_hang_hoa_loc_ngay.sql` đã chạy 20/11, lên web 2026.11.20.1)
- Thay nút chuyển tháng ‹ › bằng: **ô loại ngày** (Ngày giao · Ngày nhận · Ngày đối soát) + **khoảng từ–đến** + nút nhanh **Hôm nay · 7 ngày · Tháng này · Tháng trước** (Tháng này / Tháng trước = cả tháng). Mặc định Tháng này, Ngày giao. Dùng cùng lọc cơ sở như cũ.
- **Đối soát › Chờ đối soát LUÔN hiện tất cả** lần giao chưa đối soát (không có thanh lọc ngày), cũ nhất lên trước theo ngày nhận — anh Tiến chốt 20/11/2026. (Phiếu xuất › Chờ đối soát vẫn có lọc ngày như các tab khác.)
- **Loại ngày không áp dụng thì ẩn**: Chưa nhận chỉ có Ngày giao; Phiếu xuất › Chờ đối soát không có Ngày đối soát. Loại đã chọn bị ẩn thì tạm dùng Ngày giao (không mất lựa chọn đã nhớ).
- **Xếp theo loại ngày đang lọc, mới nhất trên; riêng Chờ đối soát cũ nhất lên trước.** Phiếu xuất nhóm theo ngày của loại đang lọc.
- **Nhớ lựa chọn** theo từng trang trên máy (localStorage); nút nhanh nhớ theo tên (mai mở "Hôm nay" vẫn là hôm nay). Đường dẫn cũ `?thang=YYYY-MM` vẫn mở đúng tháng.
- **Sửa bước 174 (lên web 2026.11.21.4, 21/11):** chọn khoảng ngày dài hơn 400 ngày (máy chủ tệp 146 từ chối) → web tự nhận ra, không gọi máy chủ, trang vẫn hiện thanh lọc + lời nhắc để chọn lại (trước đây trang chỉ còn ô báo lỗi); khoảng quá dài **không được nhớ**, máy nào lỡ nhớ từ trước thì tự về Tháng này. Bấm qua mục Chưa nhận (chỉ có Ngày giao) rồi quay lại **vẫn giữ loại ngày đã chọn**. Bài thử: `kiem_tra/loc_ngay_174.mjs` (17), `flow_ln174` (chu / qlt / kt × 2 khung).
- **Mục còn chờ nằm ngoài khoảng ngày** (Chưa nhận, các mục chờ ở Kiểm soát): hiện dòng "Còn N … ngoài khoảng ngày đang lọc" + nút **Hiện cả** (mở rộng khoảng ngày để thấy hết) — để không sót việc cũ.
- **Kiểm soát**: lọc chỉ áp cho danh sách; **tiền tháng vẫn tính cả tháng** (tháng của ngày "đến"), ghi rõ "Tính cả tháng". Mục "Thiếu hoá đơn giao" (chưa đối soát) khi lọc Ngày đối soát vẫn hiện.
- Máy chủ: `app_nh_list` và `app_gh_control` thêm 3 tham số có mặc định (`p_from`, `p_to`, `p_kind`); gọi kiểu cũ chạy như trước. Mục Kiểm soát có thêm ngày nhận / ngày đối soát. **Web mới cần chạy tệp 146 trước.**

## 5r30. Bảng phân công công việc chung (đối soát + vận hành) — CHỐT 15/11/2026 · **ĐỢT 1 ĐÃ LÀM (bước 109)**
Anh Tiến chốt từng việc. **Không ghi tên nhân viên ở đây** (kho mã công khai) — người cụ thể chọn trên web; "QL tổng" = quản lý tổng, "Chủ duyệt" = tài khoản vai trò Chủ được chọn, "người đối soát" = quản lý được phân công cơ sở (LHP 2 người, ĐK 1, LL 1, HS 2; LLB để sau).
- **Quy định chung:** giao việc ở tab **Công việc**, việc tự xong khi hồ sơ gốc xong · quá hạn → trang **Quá hạn & phạt**: anh bấm **Phạt** (mặc định **50.000đ / lần**, sửa được, lý do "Bị phạt do không hoàn thành công việc đúng hạn") hoặc **Bỏ qua** — web không tự phạt; **mỗi việc ghi cảnh báo** mức phạt khi quá hạn · cơ sở 2 người: giao cả 2, ai làm trước cũng được · không có người dự phòng · **quản lý chỉ thấy cơ sở mình được phân công**, QL tổng thấy hết · việc nhiều cấp duyệt **chia nhiều bước**, mỗi bước người + hạn riêng, thêm bước được.
- **Kế toán:** anh chọn **bất kỳ nhân viên nào** và gán chức năng kế toán; **gỡ quyền Kế toán cộng thêm của QL tổng** (làm khi bắt đầu đợt 1).

| # | Việc | Ai làm | Hạn | Tạo việc |
|---|---|---|---|---|
| 1 | Đối soát ca (gồm phiếu chi CK) | Người đối soát | 1 ngày từ khi kế toán có đủ file | Mỗi ca; phiếu có phát sinh nghỉ / làm thay vẫn hoàn thành 1 phần |
| 2 | Phân chia nhân viên phát sinh (nghỉ / làm thay / x2) | QL tổng phân loại → Chủ duyệt | Tổng 4 ngày: 2 + 2 | Mỗi ca có phát sinh |
| 3 | File ca Fabi | Kế toán (chung 4 cơ sở) | 1 ngày | Gộp mỗi ngày mỗi cơ sở |
| 4 | Chuyển khoản thực nhận | Kế toán | 1 ngày | Gộp mỗi ngày mỗi cơ sở |
| 6 | Kiểm đếm tiền mặt cuối ngày | Người đối soát | Không | **Không tạo việc**; lệch → chuyển sang Lệch tiền ca |
| 7 | Lệch tiền ca | Người đối soát — **mở quyền ghép / trừ lương / quán chịu cho quản lý cơ sở, không cần duyệt** | 5 ngày (CK chờ tiền về chưa tính) | Có |
| 8 | Xem giải trình trừ lương | Quản lý cơ sở + QL tổng | Không | Có; nhân viên có **3 ngày** giải trình, quá hạn giữ nguyên khoản trừ |
| 9 | Khách nợ | Người đối soát | Không, không phạt | **Hiện ưu tiên đầu phần Công việc ngay từ lúc ghi nợ** (+ thông báo Công nợ) |
| 10 | Kiểm quỹ hằng tuần | Người đối soát | 4 ngày | Mỗi tuần mỗi cơ sở; lệch → ghi **"Lệch kiểm quỹ"**, **quản lý cơ sở chịu** |
| 11 | Nhận hàng quá ngày giao | Người đối soát | 1 ngày | Gộp mỗi cơ sở 1 việc nhắc |
| 12 | Đối soát hàng | Người đối soát | 1 ngày từ khi NV báo nhận | Gộp mỗi cơ sở |
| 13 | Hoá đơn bù & ghép phiếu xuất | Kế toán | 2 ngày | Gộp |
| 14 | Giao bù & hoá đơn bổ sung | Kế toán | 2 ngày | Gộp |
| 16 | Xếp lịch tuần | QL tổng mở order (hạn **Thứ Hai**) + xếp lịch → Chủ chốt (hạn **23:59 Thứ Bảy**); đôn đốc order: **web nhắc mọi nhân viên chưa order** | | Mỗi tuần |
| 17 | Bảng công | QL tổng kiểm → Chủ duyệt | Ngày 3 tháng sau | Mỗi tháng |
| 18 | Đào tạo nhân viên mới | 1 quản lý chịu trách nhiệm chính, phân người hướng dẫn | **12 ngày** (phiếu đào tạo giữ 8 ngày, có thể chưa xong) | Mỗi NV mới |
| 19 | Đôn đốc đọc nội quy / quy trình | 1 nhân viên được giao (cho xem tiến độ đọc) | 12 ngày | Mỗi tài liệu mới 1 việc, có danh sách đã / chưa đọc |
| 20 | Cam kết | Cùng người việc 19 (nhận bản giấy) | 12 ngày | Mỗi NV mới |
| 23 | Hỗ trợ nhân viên | QL tổng phân công người giải đáp | 1 ngày | Mỗi yêu cầu |
| 24 | **Giao việc riêng** (bàn giao ca + mọi việc giao tay) | Bàn giao ca: người đối soát ca phân loại / giao; việc giao tay: người giao | Phân loại 1 ngày · làm: người giao chọn · kiểm tra 1 ngày | Mỗi nội dung 1 việc (xem dưới) |

- **Không đưa vào bảng:** đôn đốc ca thiếu phiếu (bỏ) · tải phiếu xuất (đã có trong việc 13) · sao lưu (Chủ quyết, giữ như cũ) · việc thỉnh thoảng / giao tay giữ như cũ.
- **Việc 24 · Giao việc riêng (chốt 15/11):** việc gì cũng đưa vào được (sửa chữa, mua đồ, vệ sinh, nội dung bàn giao ca…). Đi 5 bước **Chờ giao → Chờ nhận → Đang làm → Chờ kiểm tra → Hoàn thành**. ① Bàn giao ca: mỗi nội dung tự thành 1 việc cho người đối soát ca của cơ sở, hạn 1 ngày để chọn **Giao người khác** / **Tự làm** / **Không cần xử lý** (bắt buộc lý do). Người giao chọn **người làm + người kiểm tra** (phân công người kiểm tra) + hạn + mức độ. ② Người làm bấm **Nhận việc**, **ghi tiến độ** (chữ + ảnh), **xin gia hạn** (lý do → người giao đồng ý / không). ③ **Báo xong**: bắt buộc kết quả + ảnh. ④ Người kiểm tra (hạn **1 ngày**) bấm **Đạt** (đóng) hoặc **Làm lại** (lý do + hạn mới). Mỗi việc có **dòng thời gian**; người giao có mục **"Việc tôi đã giao — đang theo dõi"**; tab Tất cả công việc có ô đếm 5 bước. Quá hạn ở bước nào thì người đang giữ việc ở bước đó vào trang Quá hạn & phạt. Thay cho quy định 07/11 "không còn bước duyệt" — việc giao tay của Chủ / QL tổng cũng đi đúng 5 bước này.
- **Đã làm Đợt 1 (bước 109, tệp `95_bang_phan_cong.sql`, `96_quyen_phan_cong.sql`):** menu Công việc = Việc của tôi (chia theo hạng mục, khách nợ đầu trang, mục "Việc tôi đã giao") · Tất cả công việc · Bảng phân công · Quá hạn & phạt (quyền mới `phan_cong`: Chủ + QL tổng xem, chỉ Chủ sửa / xác nhận phạt). Web tự tạo việc 5 phút/lần (lịch `phan-cong-tu-dong`) **từ ngày 16/11/2026** (tồn cũ không tạo việc, không phạt). Phạt đã xác nhận: nhân viên được báo + thấy ở Việc của tôi; trừ lương khi làm Bảng công (đợt 3). Việc gộp quá hạn: phạt 1 lần cho cả việc; việc trễ nhiều ngày: 1 lần; cơ sở 2 người: hiện cả 2, Chủ chọn — theo bản thử, anh chưa đổi.
- **Phần Công việc của phiên khác (bước 108):** **tắt quy tắc tự giao "Đối soát ca" và đóng 44 việc** đang giao khi bắt đầu đợt 1.
- **Làm 3 đợt** (mỗi đợt vẽ mẫu duyệt trước): ① bảng phân công + việc 1–14 + trang Quá hạn & phạt · ② quản lý chỉ thấy cơ sở mình (cả máy chủ) · ③ việc 16–20, 23 + thay đổi nghiệp vụ (kiểm đếm lệch → Lệch tiền ca, Lệch kiểm quỹ, khách nợ ưu tiên, nhắc order, giải trình 3 ngày, quyền lệch tiền cho QL cơ sở).

## 5r31. Đối soát ca — phần tiền gộp 1 trang (bước 110, chốt + làm 15/11/2026)
- Anh chọn "cách A": **phần việc** (Ai làm ca, Nghỉ & ca bổ sung x2, Bàn giao) vẫn đi **từng bước**; **phần tiền** gộp **1 trang** (bước 4): 1 Phiếu Fabi · 2 Khách nợ · 3 Thu chi · **4 Tiền mặt** · **5 Chuyển khoản** (tách riêng, mỗi khung tự tính lệch) + ô tóm tắt 5 mục.
- 1 nút **"Duyệt phần tiền & hoàn thành"**: duyệt mọi mục khớp + lưu luôn cách xử lý lệch đã chọn trong khung (Quán chịu / Chia người làm ca); "Đối soát lại sau" → Hoàn thành 1 phần. Chờ kế toán thì báo rõ thiếu file gì. Thay quy định 14/11 "không duyệt nhanh" cho riêng phần tiền.
- Thu chi: nút **"+ Khách chuyển khoản rút tiền mặt"** ghi 2 dòng ghép đôi (tiền mặt −X, chuyển khoản +X), chọn nhóm "Không tính" — không vào chi phí. Chi / rút bằng chuyển khoản dùng phiếu chi chuyển khoản sẵn có (trong khung Chuyển khoản).
- **Bước 111 (làm lại theo phiếu thử 15/11, dữ liệu 03/11):** trang tiền còn 4 phần — ① **1 dòng kết luận** có màu (khớp / lệch ở đâu / chờ kế toán / đã duyệt) · ② **1 bảng chung 2 cột Tiền mặt | Chuyển khoản** (Số dư đầu ca, + Doanh thu theo Fabi, + Khách trả nợ cũ, − Khách mượn / nợ CK, ± Thu chi, − Lương trả TM, ± Khác → = Phải có / phải nhận → Thực tế → Lệch; dòng = 0 ẩn) · ③ Phiếu Fabi, Khách nợ mỗi mục 1 dòng (sai thì tự mở); **Thu chi luôn mở, chọn nhóm ngay từng khoản** (anh yêu cầu không ẩn), sửa số tiền / nội dung ngay bên dưới · ④ xử lý lệch (Quán chịu / Chia người làm ca / Để sau) + nút duyệt. Sửa số, phiếu chi / rút CK, lịch sử gom thành 3 nút nhỏ.
- **Bước 112 (chốt + làm 15/11):** khung Khách nợ và Thu chi gộp thành **1 danh sách "Các khoản tiền của ca"**, sửa thẳng trên dòng: thu / chi (ô Loại: Chi · Thu × tiền mặt / chuyển khoản, số tiền, nội dung, **ô Nhóm ngay trên dòng**), khách nợ hoá đơn / khách mượn tiền mặt / nợ chuyển khoản (đổi loại, số tiền, tên), khách trả nợ cũ (bỏ khoản quản lý ghi, + Khách trả nợ cũ), + Khách CK rút tiền mặt, + Ghi nhận nợ (NV bấm nhầm thanh toán). **Lý do sửa ghi 1 lần ở cuối trang** (chưa có lý do thì chưa lưu). Chỉ sửa bản đối soát, phiếu nhân viên giữ nguyên. **Tháng đã chốt: khoá, không sửa** (anh đồng ý) — muốn sửa thì mở lại chốt tháng. Gán lương cho nhân viên / chuyển khoản chi thành nợ để ở nút nhỏ.
- Nút "Khách CK rút tiền mặt" của nhân viên đã được chốt trong phương án chung bên dưới.


## 5r32. Chốt ca và đối soát dùng chung bố cục — CHỐT 16/11/2026

- Thứ tự chung: **Ai làm ca → Nghỉ & làm thay (chỉ khi phát sinh) → Bàn giao → Tiền**. Máy tính và điện thoại dùng cùng thứ tự, bảng tiền và cách nhập Phiếu Fabi.
- Tiền gồm thời gian doanh thu có ngày/giờ (qua nửa đêm chọn ngày hôm sau), Phiếu Fabi, bảng **Tiền mặt | Chuyển khoản**, danh sách Thu nợ / Thu / Chi / Báo nợ / Đổi tiền và chuyển khoản hotline. Ca sáng bắt đầu 06:45; các ca tiếp nối theo kết thúc ca trước.
- **Khách CK rút tiền mặt là một phiếu**: một số tiền và một nội dung; thêm bằng nút riêng hoặc tích trên khoản Thu / Chi. Tự giảm tiền mặt và tăng chuyển khoản bằng nhau; không tính thu nhập/chi phí của quán. Sửa/xoá cả phiếu, máy chủ chặn chỉ sửa một vế. Không tự suy đoán ghép các khoản cũ chỉ vì giống số tiền/nội dung.
- **Kiểm tra** trước khi gửi; sửa dữ liệu hoặc cách xử lý lệch phải kiểm tra lại. Thu nợ chọn khách còn nợ tại cơ sở, tìm không dấu và thu một phần bằng chức năng công nợ hiện có.
- **Quản lý tự chốt được hoàn thành đối soát ngay**, kể cả khi kế toán chưa có file Fabi/ngân hàng. Nghỉ/làm thay vẫn là việc riêng để quản lý tổng phân loại và Chủ duyệt sau; không chặn ca tự chốt. Quy định này thay điều kiện chờ kế toán/x2 cũ cho riêng quản lý tự chốt. Nhân viên gửi vẫn chờ quản lý đối soát.
- Quản lý chọn nhóm cho từng khoản Thu / Chi. Lệch tiền có lựa chọn **Để sau / Quán chịu (theo quyền hiện có) / Chia đều người có làm ca**. Để sau không tự trừ lương, số lệch vẫn theo dõi ở Lệch tiền ca. Chia đều báo rõ sẽ trừ lương trước khi gửi. Máy chủ lấy số thực tế và chặn gửi nếu số lệch khác số đã xem.
- Giữ số hotline để đối chiếu; khi đủ dữ liệu ngân hàng, đối soát dùng số ngân hàng. Bản đối soát giữ lịch sử, lý do sửa; phiếu nhân viên và ảnh cũ giữ nguyên; tháng đã chốt không sửa được.
- Tệp triển khai: `98_chot_ca_doi_soat_chung.sql`. Trạng thái: **đã áp dụng máy chủ và phát hành web 16/11/2026** (bản 2026.11.16.3).

## 5r34. Việc tự thêm theo lịch từng cơ sở — CHỐT 17/11/2026, ĐÃ LÀM (bước 123, máy chủ `106_viec_tu_them.sql`, web 2026.11.17.8)
- Thiết kế: `tai_lieu/superpowers/specs/2026-11-17-viec-tu-them-design.md` · mẫu https://claude.ai/artifact/XowQgnN7pt1WoSM4SLpSZb.
- Bảng phân công có nhóm **Việc tự thêm** + nút **+ Thêm việc** (chỉ Chủ; QL tổng xem): tên, hướng dẫn, **Bắt buộc chụp ảnh khi báo xong**, **Có kiểm tra** (giai đoạn 2). Mỗi cơ sở: Bật · Người làm · [Người kiểm tra · Hạn kiểm tra từ lúc báo xong] · Chu kỳ (hằng ngày / tuần / tháng) · Ngày làm · Quá hạn cho phép · Mức phạt. Có kiểm tra thì bắt buộc chọn người kiểm tra, khác người làm.
- Web tự tạo việc vào ngày làm (từ ngày lưu lịch, không tạo ngược; hằng tháng ngày 31 → ngày cuối tháng). Hạn = hết 23:59 ngày làm + quá hạn cho phép. Lần làm gần nhất trước ngày cài hiện thành việc **Làm bổ sung**, không phạt. Tạm tắt rồi bật lại không tạo dồn những ngày tắt.
- Người làm bấm **Báo xong ✓** (ghi chú + ảnh); có kiểm tra → người kiểm tra xem ảnh, **Đạt** hoặc **Làm lại** (lý do + hạn mới). Quá hạn ở bước nào thì người giữ bước đó vào Quá hạn & phạt, mức phạt theo cơ sở. Xoá việc: lần đang mở bị huỷ, lịch sử + phạt giữ.
- **Lần 2 — ĐÃ LÀM (bước 124, máy chủ `107_viec_co_san_tung_co_so.sql`, web 2026.11.17.9):** bấm tên 10 việc có sẵn (1, 3, 4, 7, 8, 10–14) mở hộp chung: hướng dẫn, **Có kiểm tra** (thay nút "+ Thêm bước"), mỗi cơ sở Bật · Người làm · [Người kiểm tra · Hạn kiểm tra] · Hạn làm · Mức phạt. **Kiểm quỹ** có Chu kỳ · Ngày làm · Quá hạn cho phép như việc tự thêm (đổi ngày giữa kỳ không đóng việc kỳ cũ). Việc có sẵn không đổi tên / không xoá / không có Bắt buộc ảnh. Hoá đơn bù, Giao bù: 1 dòng "Mọi cơ sở", không có kiểm tra. Phân chia nhân viên phát sinh và Giao việc riêng giữ hộp cũ. Cơ sở tắt chỉ chặn tạo việc mới. Lên bản đã chép hạn / phạt đang dùng sang từng cơ sở nên việc đang mở không đổi.

## 5r35. Công việc — sửa nhỏ sau bản kiểm tra 17/11 — ĐÃ LÀM (bước 126, máy chủ `110_cong_viec_sua_nho.sql`, web 2026.11.17.11)
- Tên việc / thông báo Lệch tiền ghi "Tiền mặt" / "Chuyển khoản" thay mã máy (`tien_mat`).
- Giao việc riêng: người kiểm tra khác người giao → **người giao được báo** khi việc báo xong và khi Đạt; **đổi người làm → người làm cũ được báo** "Việc đã chuyển cho người khác".
- Việc tự thêm bị xoá / việc Làm bổ sung quá **7 ngày** chưa ai làm (tự bỏ, không phạt): mục "Đã xong 7 ngày" ghi rõ, không hiện "✓ Xong".
- Nút Báo xong / Đạt / Làm lại / Xong bước chỉ hiện cho người được giao và Chủ (Quản lý tổng vẫn có Đổi người).
- **Bước 127 — nhắc việc gọn (anh chốt 17/11, máy chủ `111_nhac_viec_gon.sql`, web 2026.11.17.12):** **bỏ nhắc nhân viên** về phiếu chốt ca; phiếu chưa xong **2 giờ sau hết ca** → báo **1 lần** cho người đối soát của cơ sở (không báo 22–7 giờ). Mọi việc (Bảng phân công + Giao việc riêng): báo người đang giữ việc **trước hạn 1 giờ** và **lúc vừa trễ** (trong 2 giờ sau hạn), mỗi mốc 1 lần. Tab / menu **Quá hạn & phạt** có số đếm phạt chờ xác nhận (Chủ, QL tổng).

## 5r36. Quản lý sửa phiếu web đã tự đối soát — CHỐT 17/11/2026, ĐÃ LÀM (bước 129, máy chủ `113_ql_sua_phieu_tu_doi_soat.sql`, web 2026.11.17.13)
- Trước: phiếu có mục web tự đối soát (khớp file Fabi + ngân hàng) thì chỉ Chủ Lưu được ở bước Tiền — quản lý bấm Mở để sửa, gõ xong Lưu bị từ chối.
- Nay (anh chọn): **Chủ, Quản lý tổng và quản lý đối soát của cơ sở đó** (ô Đối soát ca trong Bảng phân công) đều Lưu / Sửa thẳng được; lý do bắt buộc, lịch sử như cũ; **Chủ nhận thông báo** "Quản lý sửa phiếu web đã tự đối soát" (ai, ca nào, lý do). Quản lý cơ sở khác vẫn bị chặn. Nút "Mở khoá" ở Đèn đối soát vẫn chỉ Chủ.
- **Sửa lỗi 18/11 (web 2026.11.18.12):** bước 129 mới sửa máy chủ; giao diện vẫn khoá ô thu chi / báo nợ / số Fabi của mục web tự đối soát với người không phải Chủ dù đã bấm ✎ Mở để sửa (anh Tùng — Quản lý tổng — gặp ở phiếu LHP Sáng 9/11). Nay ai bấm được Mở để sửa thì sửa được mọi ô như Chủ. Khoản báo nợ **đã thu** vẫn không sửa được (quy định cũ, với cả Chủ).
- Ghi chú: kho tổng / người nhà vay tiền của ca → **Báo nợ CK / TM** đúng tên rồi đánh dấu Gia đình ở Công nợ (không có mục Cho vay riêng — bỏ từ bước 85).

## 5r37. Chỉ đủ file Fabi + số dư ngân hàng mới đối soát — ĐÃ LÀM 17/11/2026 (bước 131, máy chủ `115_tra_ve_cho_ke_toan.sql`, chỉ máy chủ)
- Anh chốt: chỉ khi đủ file Fabi và số dư ngân hàng mới kiểm tra / đối soát được (giữ quy định bước 122).
- 8 phiếu quản lý tự chốt **trước** bước 122 đã bị ghi "hoàn thành đối soát" khi kế toán chưa có số liệu → **trả về Chờ kế toán** (bỏ mục đã duyệt + kết quả, ghi lịch sử "tra_ve_cho_ke_toan"): ĐK Tối 12/11, Chiều + Tối 13/11, Sáng 16/11, Sáng 17/11; LHP Chiều + Tối 16/11; LL Tối 16/11. Không phiếu nào có khoản âm / xử lý lệch.
- **Sửa lỗi** (từ tệp 104): kế toán nhập số dư ngân hàng cho phiếu đang Chờ kế toán bị chặn (dòng lịch sử "kế toán sửa" bị trigger khoá Kiểm tra chặn). Nay cho qua đúng dòng lịch sử kế toán; quản lý vẫn không kiểm tra được khi chưa đủ dữ liệu.

## 5r38. Ảnh nhận hàng tối đa 4 món — CHỐT và ĐÃ LÀM 18/11/2026 (bước 132, máy chủ `116_anh_nhan_hang_toi_da_4_mon.sql`, web 2026.11.18.1)
- Hàng hoá › Nhận hàng: mỗi ảnh chụp gắn **tối đa 4 món** (tính cả món trong phiếu, món ngoài phiếu, món ghi tay khi nhận không hoá đơn) để ảnh nào cũng nhìn rõ, đếm được.
- Đủ 4 món: ô còn lại mờ / khoá, ẩn "+ Thêm món", dòng nhắc "Mỗi ảnh tối đa 4 món — chụp ảnh khác cho các món còn lại"; nút Lưu ghi "n/4 món". Máy chủ cũng chặn (`app_gh_photo_add`). Ảnh cũ nhiều hơn 4 món giữ nguyên.

## 5r39. Báo nợ chọn người · Thu/Chi → Báo nợ · Luân chuyển TM–CK · quyền Kiểm tra — CHỐT 17/11, ĐÃ LÀM 18/11/2026 (bước 133, máy chủ `117_bao_no_chon_nguoi.sql`, web 2026.11.18.2)
- Thiết kế: `tai_lieu/superpowers/specs/2026-11-17-bao-no-chon-nguoi-design.md`.
- **Báo nợ có menu "Người nợ"** (phiếu chốt ca nhân viên + bước Kiểm tra): Khách (gõ tên → ① Nợ khách hàng, ca sau nhắc) · Kho tổng (② Nợ kho tổng) · người ở nhóm ③ của cơ sở (vd người nhà) → ③ Nợ khác; ②/③ ca sau không nhắc, quản lý thu ở tab Công nợ. Danh sách lấy từ tab Công nợ (`app_ca_debt_people`), người mới thêm ở tab Công nợ. Thay quy định bước 95 "nhân viên chỉ ghi nợ khách hàng" cho riêng việc ghi nợ.
- **Thu / Chi → Báo nợ**: phiếu chốt ca như bước 116; bước Kiểm tra (Mở để sửa) đổi trên dòng, Lưu 1 lần, ghi "✎ đổi từ …", hộp Lưu ghi "Đổi Chi CK … → Báo nợ CK · Kho tổng (② Nợ kho tổng)".
- **"Luân chuyển tiền mặt – CK"** thay "Khách CK rút tiền mặt", có 2 chiều **TM → CK** / **CK → TM** (máy chủ nhận cả 2 chiều, vẫn đòi 2 vế bằng nhau); bảng tiền ghi "± Luân chuyển TM – CK". Phiếu cũ giữ số.
- **Quyền Kiểm tra theo cơ sở** (anh chọn (b)): mọi phiếu chỉ **Chủ, Quản lý tổng, quản lý đối soát của cơ sở** (ô Đối soát ca, Bảng phân công) được vào Kiểm tra / Lưu / Sửa thẳng / Duyệt; quản lý khác thấy "🔒 Chỉ quản lý đối soát cơ sở này…". Muốn ai kiểm tra cơ sở nào thì thêm tên vào ô đó.

## 5r40. Số dư ngân hàng trên điện thoại tự lưu khi dừng gõ — SỬA LỖI 18/11/2026 (bước 135, chỉ giao diện, web 2026.11.18.4)
- Lỗi kế toán báo: gõ số dư ở **Kế toán › Chuyển khoản thực nhận** trên điện thoại không tự lưu. Nguyên nhân: trang chỉ lưu khi ô **mất chọn**; trên điện thoại ẩn bàn phím / bấm chỗ trống / chuyển sang app ngân hàng thì ô vẫn đang chọn → không lưu (máy chủ vẫn nhận bình thường).
- Nay: **dừng gõ ~1 giây là tự lưu**; trang bị ẩn (chuyển app, tắt màn hình) hoặc rời trang thì **lưu ngay** số vừa gõ. Trên điện thoại chữ **"Đã lưu ca … · giờ"** nổi ở cuối màn hình (trước nằm tít trên đầu trang, cuộn xuống không thấy).
- Bài thử: `flow_ck135` (role=nvkt; `index.html` và `test/phone.html`).

## 5r41. File ca Fabi — báo rõ ca lỗi + bảng so sánh nhân viên nhập / file Fabi — CHỐT và ĐÃ LÀM 18/11/2026 (bước 136, máy chủ `119_fabi_so_sanh_ql.sql`, web 2026.11.18.5)
- **Vì sao:** tab chỉ ghi "Cần quản lý xem"; lỗi gì phải mở mục thu gọn, chỉ thấy vài dòng "phiếu X → Fabi Y"; có ca bị báo mà không thấy dòng nào (số đối soát web đã sửa theo Fabi — mảng `fixed` — trước không hiện).
- **Ai xem:** Kế toán **và Quản lý (quyền Đối soát)**. Quản lý chỉ xem; khung Đồng bộ từ Fabi + nút "Chọn Excel thủ công" chỉ người có quyền Kế toán thấy (giống Hàng hoá › Phiếu xuất). Máy chủ: `app_fabi_list` cho `ke_toan` hoặc `doi_soat`; `app_fabi_upload` vẫn chỉ `ke_toan`.
- **Khung "Ca cần quản lý xem"** đầu tab (cơ sở + tuần đang xem): mỗi dòng ngày · ca · loại lỗi ("Nhân viên gõ khác Fabi: Tổng tiền, Tiền chênh lệch" / "Có file Fabi, chưa có phiếu nhân viên" / "Web đã sửa số đối soát theo Fabi") + nút Xem (nhảy tới ca đó ở chi tiết ngày).
- **Ô bảng tuần** ghi loại lỗi ngắn thay cho chỉ "Cần quản lý xem".
- **Thẻ ca có lỗi:** dòng LỖI bằng lời (vd "Tổng tiền nhân viên ghi thiếu 180.000đ so với Fabi"), người chốt phiếu, **bảng 7 mục** (Số dư đầu · Doanh thu NET · Chuyển khoản · Tiền mặt · Nợ · Tổng tiền · Tiền chênh lệch) × (Nhân viên nhập · File Fabi · Chênh), dòng khác tô đỏ, khớp ✓; dòng "Web đã sửa số đối soát theo Fabi: … → …"; nút **Mở đối soát ca** (chỉ quyền Đối soát). Bảng hiện sẵn, không thu gọn. Ca khớp giữ gọn như cũ.
- Máy chủ gửi thêm đủ 7 số nhân viên nhập (kể cả số khớp) + tên người chốt phiếu.
- Không làm: không đổi cách máy chủ so / tự sửa theo Fabi; hoá đơn sửa / xoá vẫn chỉ là dòng thông tin.

## 5r33. Đối soát giống hệt chốt ca — làm 16/11/2026 (bước 113, chỉ giao diện, máy chủ không đổi)

- Trang tiền của **đối soát** dùng đúng khung và thứ tự của **chốt ca**: Thời gian doanh thu → Phiếu Fabi → Bảng tiền của ca → Các khoản tiền của ca → Tiền thực tế → Xử lý lệch (chỉ khi lệch) → Lý do sửa → Duyệt. Bỏ nhãn "CHƯA ĐỐI SOÁT", bỏ Phiếu Fabi lặp 2 lần, bỏ tiêu đề "Bước 4 · ② Phần tiền". Quản lý thấy thêm 1 dòng so với file Fabi kế toán tải (giờ kết thúc, doanh thu, TM, CK) và ô nhóm của từng khoản Thu / Chi.
- Bỏ 2 thẻ "Phiếu nhân viên (gốc) / Đối soát ca này"; còn 1 liên kết nhỏ "Xem phiếu gốc nhân viên gửi".
- Các khoản tiền của ca (cả 2 trang): **Thu nợ đứng đầu** → Thu / Chi → Khách CK rút tiền mặt → Báo nợ. Nút cùng thứ tự: + Thu nợ · + Thu · + Chi · + Báo nợ · + Khách CK rút tiền mặt. Ở đối soát, + Thu nợ mở danh sách khách đang nợ; + Báo nợ = quản lý ghi nhận nợ (NV bấm nhầm thanh toán).
- Đổi Thu ↔ Chi, TM ↔ CK, loại nợ TM / CK / HĐ, khách trả TM / CK: **nút bấm 1 lần** thay ô chọn thả xuống.
- Báo nợ gọn 1 dòng (bỏ 3 đoạn giải thích dài); luôn có nút + Báo nợ. Hotline chỉ còn 1 dòng kết quả (phép tính đã có ở bảng tiền), bỏ chữ "bước Thu chi" và nút "Về bước…" của kiểu 10 bước cũ. Bấm Kiểm tra xong không vẽ lại bảng tiền lần 2.
- Phần ít dùng của đối soát gom cuối trang: phiếu chi / rút chuyển khoản · lịch sử sửa, mở lại phiếu · gán lương cho nhân viên.
- Bước 1–3 của đối soát (Ai làm ca, Nghỉ & làm thay, Bàn giao) giữ cách so sánh hiện có — chưa đổi lần này.
- **113b (16/11)**: phần tiền đã đối soát / quản lý tự chốt thì ô khoá — có nút **✎ Sửa phần tiền** ngay trang tiền (lý do → Mở lại phần tiền; Chủ chọn được Sửa thẳng).
- **113c (16/11, anh chọn theo mẫu thử cũ)**: trang tiền đối soát: dòng "Còn N khoản chưa phân loại" trên cùng → **Bảng tiền lên đầu** → Phiếu Fabi gọn 1 dòng "✓ khớp file · NET … ›" (bấm mở; gồm thời gian doanh thu) → Các khoản · N khoản → Tiền thực tế → Xử lý lệch → thanh Duyệt dính đáy. Dưới tên ca: Nhân viên gửi lúc · Fabi ✓ · ngân hàng ✓. Mỗi khoản 1 hàng [Thu|Chi][TM|CK] số tiền ✕ (cả chốt ca).
- **114 (16/11)**: bước Tiền của **chốt ca** xếp giống đối soát: dòng kết quả trên cùng (chưa đủ → "Còn thiếu: …"; Kiểm tra xong → khớp / thiếu / thừa) → Bảng tiền → Phiếu Fabi (chưa nhập thì mở sẵn; nhập đủ, đúng thì gọn 1 dòng "✓ Phiếu Fabi đã nhập · NET …", bấm mở lại; gồm thời gian doanh thu) → Các khoản · N khoản → Tiền thực tế → (quản lý tự chốt: xử lý lệch) → thanh Quay lại · Kiểm tra · Gửi ở đáy.
- **115–116 (16/11)**: đối soát chỉ còn 1 hàng nút ở đáy (‹ Quay lại · Duyệt phần tiền & hoàn thành; duyệt xong: Quay lại · Về danh sách · Ca tiếp theo). Dưới mỗi khoản Thu / Chi (cả 2 màn) có **Đổi thành: [Báo nợ] [Khách CK rút tiền mặt]**. Chốt ca: Báo nợ = bỏ khoản Thu / Chi, thêm 1 dòng Báo nợ cùng số tiền (TM → khách mượn TM, CK → nợ CK), tên khách lấy từ nội dung. Đối soát: chỉ khoản **Chi** đã lưu mới đổi thành nợ (hộp chọn nhóm nợ, tên, SĐT) — vào tab Công nợ, không tính chi phí, tiền của ca không đổi; dòng hiện "→ Báo nợ: tên" và nút Bỏ.
- **121 (17/11, máy chủ `103_mo_luu_phan_tien.sql`)** — Bước Tiền ở phần Kiểm tra: **1 nút Mở, 1 nút Lưu** (thiết kế `tai_lieu/superpowers/specs/2026-11-17-mo-luu-phan-tien-design.md`). Mặc định **Chỉ xem** (mọi ô khoá; thanh dưới: Quay lại · ✎ Mở để sửa · Duyệt nếu được). **Đang sửa**: sửa số Fabi, thu chi, báo nợ, khách trả nợ, đổi khách mượn, ảnh Fabi — chưa lưu lên máy chủ; ô đã sửa viền vàng; "N thay đổi chưa lưu"; thanh dưới chỉ còn Huỷ · 💾 Lưu (N thay đổi). **Lưu**: không đổi gì → về Chỉ xem; có thay đổi → hộp liệt kê + **Lý do sửa (bắt buộc)**, lưu cả gói 1 lần (`app_ca_recon_apply`, lỗi thì không lưu gì), mục tiền đã duyệt được mở lại → bấm **Duyệt** riêng như cũ; mục web tự đối soát chỉ Chủ lưu được. Bỏ: ô lý do cuối phần tiền, "Lưu sửa" từng dòng khách trả, "✎ Sửa phần tiền" + "Mở lại / Sửa thẳng" + "Xong, khoá lại", "Lưu cách xử lý" (lưu khi Duyệt). Rời trang khi còn thay đổi → hỏi lại.
- **122 (17/11, máy chủ `104_cho_du_fabi_ngan_hang.sql`)** — Phiếu nhân viên và phiếu do quản lý tự làm **vẫn chốt ca bình thường** khi thiếu file Fabi hoặc số liệu ngân hàng, nhưng chuyển sang **CHỜ KẾ TOÁN**. Khi đang chờ: không có nút Kiểm tra, mở đường dẫn trực tiếp cũng bị chặn, mọi cách ghi / sửa / xóa dữ liệu Kiểm tra (kể cả nút Lưu phần tiền của bước 121) đều bị máy chủ khóa. Đủ cả file Fabi và số liệu ngân hàng của ca thì nút Kiểm tra tự mở. Quy định này thay câu “quản lý tự chốt hoàn thành đối soát ngay khi thiếu nguồn” ở mục 5r32.
- **122b (17/11, máy chủ `105_chu_xoa_phieu_xuat.sql`)** — Hàng hoá › Phiếu xuất: chỉ tài khoản vai trò hệ thống **Chủ** thấy và dùng nút **Xóa**; Kế toán vẫn được **Tải lại** nhưng không được xóa. Chỉ xóa phiếu đang chuyển và nhân viên chưa bắt đầu nhận; phiếu đã bắt đầu nhận hoặc đã báo nhận bị khóa để tránh mất dữ liệu.
- **122c (17/11, máy chủ `108_chu_xoa_ca_phieu_da_nhan.sql`)** — Anh Tiến chốt: **Chủ xóa được cả phiếu xuất đã nhận** (thay câu khóa ở 122b). Nút **Xóa** hiện ở mọi phiếu cho Chủ; phiếu đã có nhân viên nhận thì hộp hỏi lại cảnh báo sẽ mất số lượng đã nhận, ảnh nhận hàng, hoá đơn giao / hoá đơn bù, ghi chú thiếu hàng — không khôi phục được. Việc trong Bảng phân công gắn với phiếu tự đóng. Kế toán vẫn không xóa được. Phiếu nhận hàng **không hoá đơn** (khung “Cần ghép phiếu xuất”) cũng có nút Xóa cho Chủ (2026.11.17.7).
- **125 (17/11, máy chủ `109_toc_do_tinh_phieu.sql`, web 2026.11.17.10) — Tăng tốc, không đổi cách tính tiền.** `app__ca_eff` tính bản dữ liệu phiếu 1 lần (trước bị chụp bản đối soát ~9 lần mỗi lần gọi); `app__kt_prev_closing_acc` lấy danh sách ca 1 lần. Đo máy chủ thật: Việc hôm nay 2,8s → 0,4s, Đối soát 3,8s → 0,4s, Công việc 1,8s → 0,16s, Sổ quỹ 14,2s → 1,6s, Chốt tháng quá hạn → 29s. Web: số trên menu hỏi máy chủ cùng lúc (trước lần lượt, chuyển trang khựng ~2 giây mỗi phút); số cảnh báo xếp lịch tính nền, hiện ở lần chuyển trang sau. **Còn chậm:** Chốt tháng (~29s) và Sổ quỹ (~1,6s) vì dựng lại sổ quỹ từ ngày đầu nhiều lần — cần đổi cách tính, chờ anh chốt.
- **128 (17/11, máy chủ `112_toc_do_so_quy.sql`) — Sổ quỹ + Chốt tháng nhanh, không đổi kết quả tiền.** `app__fund_sum` dựng sổ quỹ 1 lượt / cơ sở (trước 3–5 lượt, mỗi lượt từ ngày bắt đầu quỹ); `app_fin_overview` gọi `app__fin_full` 1 lần / cơ sở (trước 6 lần). Đo máy chủ thật: Chốt tháng 29,7s → 3,2s; Sổ quỹ 1,7s → 0,8s; Sổ quỹ từng cơ sở 0,56s → 0,27s. Sổ quỹ từng cơ sở: các dòng cùng ngày + cùng loại nay xếp cố định theo trình tự sổ (trước xếp tùy lúc). So cũ / mới: `kiem_tra/toc_do/t01_so_quy_giong_het.sql`. **Còn để sau:** lưu số dư tháng đã chốt để sổ không phải dựng lại từ ngày đầu (làm sau khi chốt tháng 11).
- **130 (17/11, máy chủ `114_toc_do_thu_chi_lech_tien.sql`) — Thu chi, Lệch tiền, Chốt tháng nhanh hơn, không đổi công thức.** `app_tc_summary`, `app__gap_rows`, `app__fin_calc` bị máy chủ chép biểu thức gọi hàm ra nhiều chỗ (mỗi ca tính 9–12 lần) → chặn bằng `offset 0` / `as materialized`. Đo máy chủ thật (cơ sở 1, tháng 11): Thu chi ~1,0s → < 0,16s; Lệch tiền ~1,4s → < 0,16s; Chốt tháng từng cơ sở 0,8s → 0,44s; Chốt tháng tổng quan 3,2s → 1,5s. So cũ / mới 60 mục: `kiem_tra/toc_do/t02_thu_chi_lech_tien.sql`.
- **134 (18/11, máy chủ `118_tuan_da_chot.sql`, web 2026.11.18.3) — Trang mở nhanh hơn: hỏi máy chủ cùng lúc thay vì lần lượt (mỗi lần hỏi ~0,3s từ VN).** Lịch làm: danh sách tuần đã chốt lấy bằng `app_published_weeks` (trước tải mọi dòng `schedule_published` — sẽ chạm giới hạn 1.000 dòng / lần hỏi sau ~4 tuần, trang Lịch có thể thiếu tuần mới nhất); trạng thái + danh mục + ca của tôi + thông báo hỏi cùng lúc. `focusWeek` hỏi tuần sau + tuần này cùng lúc, Báo cáo / Lịch tổng / Cảnh báo dùng lại tuần vừa tra. Đối soát: câu của ngày đang xem hỏi ngay, không chờ bảng tuần. Thu chi: danh sách + nhóm + tổng cùng lúc. Phiếu chốt ca đang chốt: phần việc + danh mục cùng lúc với phiếu; trạng thái kế toán + nhóm + người nợ cùng lúc. Đo bản giả lập (0,3s / câu): Lịch (nhân viên) 2,1s → 0,9s; Phiếu chốt ca đang chốt 1,2–1,5s → 0,6s; Đối soát 1,5s → 0,9s; Thu chi, Báo cáo, Lịch tổng, Cảnh báo 0,9s → 0,6s. Bài đo: `flow_tocdo` (`&tre=300`). Giữ nguyên phần mở web (Thông báo / Tổng quan / Việc hôm nay dùng số trên menu lúc vẽ trang).
- **120 (17/11, máy chủ `102_ghi_chu_sua_thu_chi.sql`)** — Ghi chú khi Chủ / quản lý **thêm · sửa · xoá khoản Thu / Chi** (thiết kế `tai_lieu/superpowers/specs/2026-11-17-ghi-chu-sua-thu-chi-design.md`, mẫu https://claude.ai/artifact/9KE994ycFF3EhLKxzoV44M). Hiện ở **bước Kiểm tra** và trên **phiếu nhân viên đã gửi** (chỉ xem): ✎ sửa (tím, "NV ghi / Bạn ghi: số cũ"), ＋ thêm (xanh), "đổi từ Khách mượn", ✗ xoá (đỏ, dòng vẫn hiện gạch ngang); kèm tên tài khoản, ngày giờ, lý do. Phiếu nhân viên có nhãn "Quản lý đã sửa N khoản thu chi" và hiện số hiện tại. Máy chủ `app__ca_move_notes` so thu chi phiếu nhân viên gửi với hiện tại (cặp đổi tiền = 1 dòng, bỏ dòng tự sinh), lấy người sửa / lý do từ `shift_recon_log`; `app_ca_get.move_notes`. Lần sửa trước đây cũng có ghi chú. Dòng Báo nợ giữ ghi chú riêng như cũ.
- **119 (17/11, máy chủ `101_ql_sua_phieu.sql`)** — Quản lý sửa thẳng Phiếu chốt ca ở bước Kiểm tra (thiết kế `tai_lieu/superpowers/specs/2026-11-17-ql-sua-phieu-design.md`). (1) Ô "Chuyển khoản ngân hàng" dùng **Phải nhận = CK Fabi + Thu/Chi CK + Khách trả nợ CK − Nợ CK** (máy chủ `app__ca_money.ck_expected`) — trước đây chỉ so CK Fabi, 17 ca trong 31 ngày báo KHỚP/LỆCH sai. (2) Quản lý lưu bất kỳ ô nào không còn xoá **lương trả tiền mặt**. (3) Ô **Nợ**, **Tiền chênh lệch**, **Số dư đầu phiếu Fabi**: tải file Fabi tự sửa theo file; quản lý sửa tay được (thuộc mục Doanh thu). (4) **"Sửa thẳng" cho cả Chủ và quản lý** (mục web tự đối soát vẫn chỉ Chủ mở khoá); sửa được khách nợ; ô của mục chưa duyệt không bị khoá nhầm; nút thêm hiện / ẩn theo đúng trạng thái khoá. Lần sửa làm đổi số lệch tiền mặt / chuyển khoản **đã duyệt** → máy chủ từ chối, nhắc "Mở lại phần tiền". (5) Quản lý sửa **Bàn giao** (khi mục Bàn giao chưa duyệt) và **thêm / xoá ảnh phiếu Fabi** (luôn còn ≥ 1 ảnh; xoá chỉ gỡ khỏi phiếu, tệp ảnh giữ trong kho). (6) Dòng **Khách mượn** có nút **"Đổi thành Khách CK rút tiền mặt"**: bỏ luôn khoản khách trả ở ca sau (nếu mục đó ở ca sau chưa duyệt), xoá nợ, ghi cặp đổi tiền; lịch sử ở cả 2 ca. Mọi lần sửa bắt buộc lý do, ghi `shift_recon_log`. Ca LHP 09/11 (Sáng ghi khách mượn 500.000 thay vì CK rút TM, Chiều ghi khách trả CK) anh Tiến tự sửa bằng nút này.
- **117 (16/11, máy chủ `100_so_du_dau_ngan_hang.sql`)** — Số dư ngân hàng kế toán nhập: **số dư đầu ca luôn = số dư cuối ca trước** của cùng tài khoản (tự lấy); kế toán chỉ nhập số dư cuối ca. Sửa số cuối 1 ca → số đầu ca sau tự đổi theo (trừ ca đã hoàn thành đối soát / tháng đã chốt). Chỉ khi tích "Số dư đầu khác số dư cuối ca trước" (hộp ⋯) mới giữ số tự nhập — ô báo đỏ. Lỗi cũ: trang điền sẵn số đầu theo số cuối gần nhất lúc mở trang rồi lưu luôn, số đầu bị kẹt số cũ (HS TK5 kẹt 78.237.000 từ 13–15/11, LHP TK7 kẹt 3.396.000 từ 11–13/11, ĐK 13/11, LL 13/11, ĐK 02/11) → đã sửa 18 dòng từ 01/11, ghi lịch sử "Sửa tự động (bước 117)". Còn lệch thật cần kế toán xem sao kê: LHP Chiều 12/11 +7.000.000, LHP Tối 12/11 −4.595.000, ĐK Sáng 13/11 +676.000.
- **116b (chốt 16/11, máy chủ `99_bao_no_doi_soat.sql`)** — Các khoản tiền của ca, chốt ca và đối soát **giống hệt**:
  - Thu / Chi: nhân viên và quản lý đều sửa được tới khi gửi phiếu / duyệt xong (duyệt xong thì khoá, bấm "Sửa phần tiền").
  - Dưới mỗi khoản Thu **hoặc** Chi: **Đổi thành [Thu nợ] [Báo nợ] [Khách CK rút tiền mặt]**.
    · Thu nợ: chọn khách đang nợ (số tiền điền sẵn), chọn trả TM / CK; khoản đó thành dòng Thu nợ; trả ít hơn nợ thì phần còn lại vẫn là nợ; khoản lớn hơn nợ thì phần dư giữ ở khoản cũ.
    · Báo nợ: thành dòng Báo nợ cùng số tiền (TM→TM, CK→CK), tên khách = nội dung; sửa được số tiền, tên, SĐT; tiền phải có tính lại ngay.
    · Khách CK rút tiền mặt: thành 1 phiếu riêng.
  - Đối soát: Báo nợ (kể cả của nhân viên) sửa / xoá được, nút + Báo nợ thêm dòng giống nhân viên; dòng đã đổi có "✎ quản lý đổi · nhân viên ghi: …"; lý do sửa ghi 1 lần ở cuối (giữ lại sau khi lưu). Máy chủ: `app_ca_recon_debt_set` / `app_ca_recon_debt_remove` (bắt lý do, ghi lịch sử bao_no_them / sua / xoa, ca đã hoàn thành đối soát hoặc tháng đã chốt thì chặn, khoản đã thu không sửa / xoá).
  - "Thành nợ" kho tổng / nợ khác vẫn ở mục Ít dùng cuối trang đối soát. Hộp "Ghi nhận nợ (NV bấm nhầm thanh toán)" cũ không còn nút mở; các khoản đã ghi trước đây vẫn hiện.

## 6. Đã bỏ hẳn

Đánh giá · Voucher · Họp · nhập dữ liệu từ bản offline · nhập câu trả lời Google Form · nhập Excel nhân viên · tải file mẫu · Khôi phục bản order trước.

---

## 7. Việc còn để ngỏ — làm cùng nhau

| # | Việc | Cần anh quyết |
|---|---|---|
| 1 | ~~Gói sao lưu ZIP chưa đủ~~ — **xong 07/11**: gói có thêm `du_lieu_tinh_nang_moi.json` (phiếu chốt ca, công việc, nội quy, cam kết, đào tạo, hỗ trợ). Chưa có ảnh. | — |
| 2 | **Cấp mật khẩu cho nhân viên**: 56 người đang làm chưa có mật khẩu, nên chưa nhận việc, chưa chốt ca, chưa đọc nội quy được trên web | Cấp lần lượt hay cấp một lượt rồi in danh sách? |
| 3 | **Quyền giao việc của Quản lý tổng** đang bật | Giữ hay tắt? |
| 4 | **Nhiệm vụ đào tạo** trong Công việc: trước đây giao từ trang Họp, nay chưa có chỗ giao riêng | Có cần không, hay giao như việc thường? |
| 5 | ~~Công nợ~~ — **đã chốt 07/11** (mục 5b, điểm 3), chờ làm | — |
| 6 | ~~Tab kế toán~~ — **xong 07/11** (Hóa đơn giao hàng, Chuyển khoản thực nhận theo tài khoản từng chi nhánh) | — |
| 7 | **Bài kiểm tra lý thuyết** đào tạo | Nội dung câu hỏi |
| 8 | **Tải ảnh minh chứng** bản cam kết đã ký | Có cần không? |
| 9 | **Bản offline**: từ nay không còn đồng bộ lên web | Có báo quản lý ngừng dùng bản offline không? |
| 10 | **Mã truy cập Supabase** `sbp_fc3797…` | Anh thu hồi (Revoke) ở https://supabase.com/dashboard/account/tokens |

Các giả định nhỏ khác đang dùng tạm xem ở [GIA_DINH_CHO_CHOT.md](GIA_DINH_CHO_CHOT.md).


## Quy trình chia nhiều bộ — chốt và cập nhật máy chủ 13/11/2026
- Mục Quy trình hiển thị danh sách các bộ; chọn một bộ mới thấy các bài bên trong.
- Toàn bộ bài hiện có thuộc **Quy trình nhân viên order**, giữ nguyên ID, ảnh, thứ tự và liên kết từ phiếu đào tạo.
- Người có quyền soạn có thể tạo quy trình khác bằng cách nhập tên bộ khi lưu bài đầu tiên, thêm bài hoặc chọn bộ có sẵn. Nhân viên chỉ thấy bài đã đăng; đổi tên bộ của bài nháp chỉ có hiệu lực với nhân viên sau khi đăng bài.
- Máy chủ đã chạy `78_nhieu_quy_trinh.sql`; đã thử tự hoàn tác trước khi áp dụng thật: giữ nguyên 19 bài cũ, kiểm tra quyền Chủ / Nhân viên và tách nhóm bản nháp / bản đăng. Giao diện phát hành phiên bản `2026.11.13.20`.
- Giao diện đọc quy trình (13/11/2026): danh sách bộ, ô tìm kiếm, mục lục bài trên máy tính và mục lục thu gọn trên điện thoại. Trong **Quy trình nhân viên order**, tài khoản nhân viên chạy bàn thấy tiến độ training thật, điểm đánh giá chạy bàn tháng hiện tại và đường dẫn mở phiếu chi tiết; không dùng số liệu mẫu. Phiên bản `2026.11.13.23`.
- Ô tìm kiếm Quy trình dò cả tên bộ, tên bài và toàn bộ chữ trong nội dung bài đã đăng (vd tìm “kéo rèm” ra đúng bài), áp dụng ở trang thư viện và trong mục lục. Phiên bản `2026.11.13.25`.


## Công việc đào tạo — chốt 18/11/2026

- Đào tạo có hai mục **Pha chế** và **Chạy bàn**. Mỗi mục dùng phiếu riêng. Phiếu Pha chế chờ danh sách hạng mục.

- Mỗi phiếu của nhân viên mới tương ứng một việc trên danh sách chung, không chia theo cơ sở. Đào tạo theo đầy đủ hạng mục trên phiếu. Chương trình giữ 8 ngày, hạn công việc là 12 ngày.
- Mỗi hạng mục hiện người hướng dẫn chính hoặc người được phân công riêng và cơ sở đào tạo. Có thể chọn cơ sở riêng cho từng hạng mục. Hạng mục chưa chọn riêng lấy cơ sở trên phiếu nếu đã có. Chủ, Quản lý tổng, Quản lý và tài khoản được Chủ chọn để nhận xét có thể phân công từng hạng mục, kể cả cho nhân viên cấp 1. Giữ kết quả đã đạt và ghi nhận kết quả bổ sung theo người phụ trách.
- Chủ chọn tài khoản kiểm tra tiến độ, nhắc người liên quan đúng hạn và ghi nhận xét cuối. Phiếu hoàn thành khi đủ các hạng mục và có nhận xét cuối. Các hạng mục đã thực hành ở mức Trung bình hoặc Khá có thể giao giai đoạn 2 để luyện thêm. Giữ mức đã ghi đến khi đánh giá lại. Mục đang luyện giai đoạn 2 phải được đánh giá lại trước khi đóng phiếu.
- Khi tích Thực hành, chọn Trung bình, Khá hoặc Tốt rồi hệ thống mới lưu thực hành và mức đạt cùng lúc.
- **Người hướng dẫn chính chỉ là nhân viên cấp Quản lý** (chốt 18/11/2026, bước 139). Bắt buộc chọn khi tạo phiếu; ô trên phiếu chỉ gợi ý Quản lý; máy chủ chặn chọn người khác hoặc xoá trống (`122_huong_dan_chinh_quan_ly.sql`). Phiếu cũ chưa có người hướng dẫn vẫn sửa được các ô khác. Phân công riêng từng hạng mục vẫn giao được cho nhân viên Cấp 1; người đào tạo tiếp vẫn chọn được mọi nhân viên. Phiên bản `2026.11.18.8`.
- Bộ lọc hạng mục trên phiếu có thêm **Thực hành · Trung bình / Khá / Tốt**: lọc theo mức đạt hiện tại của hạng mục (gồm cả mục đang luyện giai đoạn 2 vẫn giữ mức cũ). Phiên bản `2026.11.18.9`.
- Từ mốc 8 ngày kể từ ngày bắt đầu, người nhận xét thấy nút Hoàn thành. Chỉ hoàn thành khi đủ hạng mục và có nhận xét cuối. Hết ngày hạn 12 mà phiếu chưa xong thì hiện Quá hạn và vẫn tiếp tục xử lý trên phiếu.
- Phiếu đang mở hiện ở Công việc → Việc của tôi của người học, người hướng dẫn được giao, quản lý phụ trách và người nhận xét. Khi có phân công mới hoặc đến lượt nhận xét, thông báo mở đúng phiếu.
- **Quy tắc phân công — anh Tiến giao 19/11/2026 đêm (bước 169, máy chủ `148_dao_tao_phan_cong.sql` đã chạy 20/11, lên web 2026.11.20.1)** — thay các điểm cũ ở trên khi khác nhau:
  1. **Người phụ trách chính (PTC)** = tài khoản Chủ chọn ở Công việc › Đào tạo (trước gọi là "người nhận xét"). Không gắn cứng tên.
  2. **Chỉ PTC và Chủ** (anh Tiến chốt 20/11 — người có quyền Đào tạo không còn đổi được, máy chủ chặn cả đường sửa thông tin phiếu) **chọn / đổi Người hướng dẫn chính (HDC)** ngay trên phiếu. Lúc tạo phiếu vẫn chọn HDC như cũ. HDC phải là Quản lý đang làm **và có tài khoản đang hoạt động**.
  3. **Giao từng hạng mục (cả giai đoạn 2): chỉ HDC của phiếu + PTC + Chủ.** Quản lý khác, Quản lý tổng hết quyền giao (vẫn xem phiếu, vẫn ghi hạng mục nếu có quyền Đào tạo như cũ).
  4. **Nhân viên Cấp 1** ghi mức đạt (Giới thiệu + Thực hành + mức) → hạng mục **"Chờ kiểm tra"**, CHƯA tính đạt; báo HDC + PTC (mỗi người 1 thông báo chưa đọc cho mỗi phiếu, không dồn).
  5. HDC hoặc PTC bấm **"Xác nhận đạt"** (giữ hoặc sửa mức) mới tính đạt. HDC / PTC tự ghi thì khỏi kiểm. Phiếu chỉ sang Chờ nhận xét / Hoàn thành khi không còn "Chờ kiểm tra". Việc của tôi của HDC / PTC có dòng "Chờ bạn kiểm tra N hạng mục".
  6. **Bỏ ô "Quản lý phụ trách"** ở hộp tạo phiếu và trên phiếu; bỏ quyền / thông báo / Việc của tôi / Việc hôm nay dựa trên nó (đổi sang HDC). Cột `manager_id` vẫn giữ trong CSDL.
  7. Hạng mục Cấp 1 ghi trước đây: giữ là đạt.
  - **Sửa sót bước 174 (máy chủ `155_dao_tao_cua_toi.sql` chạy thật 22:11 21/11, web 2026.11.21.4):** trang "Đào tạo của tôi" (`app_dt_mine`) không còn hiện phiếu cho người từng là "Quản lý phụ trách" kiểu cũ — chỉ phiếu tôi học, tôi là HDC hoặc người đào tạo tiếp. Không đổi quyền mở phiếu, không đổi danh sách Đào tạo của quản lý. Bài thử máy chủ: `kiem_tra/dao_tao_cua_toi_155.sql` (6 dòng; bản cũ hỏng 3).
  - Sửa thêm: chỉ báo "được giao hướng dẫn" khi thật sự đổi người (đổi cơ sở / ghi chú thì không báo); "Đổi phân công" không làm mất dấu "Đã đánh giá giai đoạn 2".
- **Tab Phân công + Chờ kiểm tra — bước 170 (máy chủ `149_dao_tao_tab_phan_cong.sql`, chạy SAU 148; nhánh gộp SAU bước 169)**:
  - Công việc › Đào tạo có tab **Phiếu | Phân công (số chưa giao) | Chờ kiểm tra (số chờ)**; giữ nút Chạy bàn / Pha chế. Chủ + người phụ trách chính thấy mọi phiếu mở; HD chính thấy phiếu của mình; người khác không thấy 2 tab mới.
  - **Phân công** theo phiếu: khối thu gọn (tên NV mới, cơ sở, HD chính, x/tổng, hạn, số chưa giao / chờ kiểm tra, 1 dòng lịch "thứ · cơ sở · ca" hoặc "Chưa xếp lịch"). Mở khối: hạng mục CHƯA ĐẠT theo Ngày 1…8 (người đang dạy, cơ sở, trạng thái Chưa giao · Đang giao Cấp 1 · Chờ kiểm tra). Lọc theo trạng thái + người hướng dẫn.
  - **Giao hàng loạt**: tích hạng mục / "Chọn cả ngày" → thanh "Đã chọn N" → chọn người (đúng danh sách được phép), cơ sở, ghi chú → lưu 1 lần; mỗi người được giao nhận MỘT thông báo gộp. Nút **"Trả về HD chính"**. Dùng chung kiểm tra quyền với giao từng hạng mục (HD chính / người phụ trách chính / Chủ).
  - **Chờ kiểm tra**: gom theo phiếu; mỗi dòng Xác nhận đạt · đổi mức rồi xác nhận · Giao giai đoạn 2 (mức Trung bình / Khá: xác nhận mức rồi mở hộp giao người luyện thêm). KHÔNG có xác nhận hàng loạt.
  - **Gợi ý theo lịch** (máy chủ tính, trả kèm dữ liệu bảng trong 1 lần gọi `app_dt_assign_board`): chỉ lịch ĐÃ CÔNG BỐ (`schedule_published`) từ ngày bắt đầu → hạn 12 ngày. Ô cơ sở chọn sẵn nơi NV mới có nhiều ca nhất. Ô người chia nhóm "Cùng ca" (Cấp 1 cùng cơ sở + ngày + đúng ca, "trùng N ca", N giảm dần) → "Cấp 1 cơ sở <mã>" (`employee_branches`) → "Khác". Gợi ý chỉ sắp xếp, không đổi quyền.

## Việc hôm nay — đợt 1 (18/11/2026, bước 138)

- Sau khi đăng nhập, cả năm vai trò (Nhân viên, Quản lý, Kế toán, Quản lý tổng, Chủ) vào **Việc hôm nay** trước. Thanh dưới của nhân viên: tab **Hôm nay** thay tab Việc. Kế toán đổi màn qua lại cũng về Việc hôm nay.
- **Ca của tôi hôm nay**: ca đã chốt lịch của người đăng nhập trong ngày (giờ, cơ sở, vai trò, trạng thái phiếu chốt ca) và nút theo trạng thái phiếu: **Chốt ca** (chưa mở phiếu) / **Chốt tiếp** (đang chốt) / **Xem phiếu** (đã gửi) — đổi từ "Mở ca" 20/11 cho khỏi hiểu nhầm là mở ca bán hàng. Tài khoản không gắn nhân viên báo không có ca. Hạn của việc ghi kiểu "còn 3 giờ" / "trễ 2 giờ" / "ngày mai 18:00" / "hết hôm nay" (rê chuột thấy ngày giờ đầy đủ); trên điện thoại hạn nằm dòng dưới tên việc (20/11).
- Nút **Order ca** ở đầu trang khi đợt Order tuần sau đang mở mà nhân viên chưa gửi.
- **Việc của tôi** gom: việc theo Bảng phân công, Giao việc riêng, phiếu đào tạo theo trách nhiệm, khoản âm mới hoặc đang chờ quản lý xem giải trình, hồ sơ tồn theo quyền (đối soát, Fabi, chuyển khoản…). Xếp **Quá hạn → Hạn hôm nay → Sắp đến hạn (3 ngày) → Khác → Đang chờ** (ghi rõ đang chờ ai). Mỗi dòng mở đúng nơi xử lý. Nút **Xem tất cả công việc** mở Việc của tôi. Tải lỗi hiện **Chưa tải được công việc** + **Thử lại**; trống hiện **Hôm nay bạn không có việc cần xử lý**.
- **Theo dõi** (Quản lý, Quản lý tổng, Chủ, Kế toán): việc mình đã giao đang chờ người khác, lối tắt Tất cả công việc / Quá hạn & phạt / Đào tạo / Thông báo. Thu gọn được trên điện thoại.
- **Bảng lương của tôi**: số ca, giờ thực tế, giờ x2 cộng, giờ bị trừ, 3 ghi chú nghỉ / làm thay gần nhất và khoản âm trong tháng; không có tổng lương hay tiền mặt đã trả. **Xem chi tiết** mở Công của tôi — trang này có thêm mục **Khoản âm** của tháng (xem, Tôi đã xem, gửi giải trình).
- Máy chủ: `121_viec_hom_nay.sql` (`app_today_me`). Phiên bản web `2026.11.18.7`.
- Để đợt sau: việc Nội quy / Cam kết hạn 12 ngày, Theo dõi theo bộ phận / cơ sở có số quá hạn, khoản âm nối trạng thái Lệch tiền ca và nút Mở ca từng dòng, máy chủ chặn nhân viên mở / gửi phiếu ca không có tên mình.

## Việc hôm nay — đợt 2a: Nội quy & Cam kết (18/11/2026, bước 141)

- Nhân viên: **1 dòng "Đọc nội quy · Đã đọc x/y bài"** trên Việc hôm nay, bấm mở bài chưa đọc đầu tiên; hạn 12 ngày từ ngày đăng bài / bản mới (lấy bài chưa đọc đăng sớm nhất). Hết khi đã đọc đủ bản đang áp dụng.
- Nhân viên: dòng **"Ký cam kết"** (trạng thái + "ký bản giấy và nộp cho Kế toán") tới khi Đã ký và nộp. Hạn 12 ngày từ ngày vào làm; nhân viên vào trước 18/11/2026 tính từ 18/11/2026 (hạn 30/11/2026).
- **Kế toán phụ trách** (vai Kế toán hoặc được cấp quyền Kế toán; Chủ không tính): mỗi bài nội quy / bản mới còn người chưa đọc là 1 việc "Nhắc đọc nội quy", và 1 việc "Theo dõi cam kết" (số chưa ký và nộp, số quá hạn).
- Trang mới **Nội quy & quy trình › Theo dõi đọc & cam kết** (`#/theo-doi-noi-quy`, quyền Kế toán hoặc Quản lý nhân viên): lọc Tất cả / Chưa đọc đủ / Chưa nộp cam kết, tìm theo mã / tên, bài chưa đọc từng người, đổi trạng thái cam kết. **Kế toán được cập nhật cam kết** (trước chỉ Quản lý nhân viên).
- Bỏ cửa sổ "Việc được giao cho bạn" lúc đăng nhập (đã có trong Việc hôm nay).
- Máy chủ `123_noi_quy_cam_ket_viec.sql`. Phiên bản `2026.11.18.10`.

## Việc hôm nay — chia nhóm (18/11/2026, bước 142)

Thiết kế: `tai_lieu/superpowers/specs/2026-11-18-viec-hom-nay-chia-nhom-design.md`, bản thử anh Tiến đã bấm duyệt.
- "Việc của tôi" chia **Vận hành / Nhân sự / Khác**, thu gọn / mở rộng từng nhóm (nút Mở hết · Thu gọn hết). Trang nhớ trạng thái theo tài khoản. Đầu nhóm luôn hiện số cần kiểm tra / làm lại / gấp / quá hạn / hôm nay.
- **Luật nhóm** (anh chốt): tiền, chốt ca, hàng hoá, số dư ngân hàng → Vận hành (gồm khoản âm và việc sinh từ **Bàn giao ca**); nghỉ & làm thay, đào tạo, nội quy, cam kết → Nhân sự; còn lại → Khác. Giao việc riêng gõ tay → **Khác** (cách A, không có ô chọn nhóm; hộp Giao việc riêng có dòng ghi chú). Việc tự thêm trong Bảng phân công → Khác.
- Việc cùng loại (từ 2 việc) **gộp 1 dòng**, mở ra xem từng việc. Giao việc riêng gõ tay không gộp.
- Mỗi dòng ghi **"Người làm: …"** (xanh = có mình, tím = người khác, vàng = chưa có người nhận).
- **Kiểm tra việc:** người làm báo xong thì việc ở lại cuối nhóm, ghi "Chờ X kiểm tra". Người kiểm tra thấy việc ở đầu nhóm với nhãn "Cần bạn kiểm tra". Làm lại → việc lên đầu nhóm, nhãn đỏ, ghi lý do. Đạt → mục **Đã xong hôm nay** (nhóm thứ 4, thu sẵn, hết ngày tự xoá).
- **Chủ:** tab **Việc của tôi | Mọi người** (mở sẵn Mọi người), lọc **Tất cả · Quản lý tổng · Quản lý · Kế toán · Việc khác**. Tab Mọi người không có việc chỉ Chủ làm, cũng không có dòng hồ sơ tồn dạng số tổng. Phiếu đào tạo tính theo Quản lý phụ trách.
- **Quản lý:** dòng gộp **Đào tạo đã giao người hướng dẫn** (phiếu mình phụ trách): hạng mục, bước hiện tại, người hướng dẫn, hạn.
- Ô **Theo dõi** liệt kê từng việc mình đã giao, kèm người làm.
- Máy chủ `124_viec_hom_nay_nhom.sql` (`app_today_more`) + `125_viec_hom_nay_sua.sql` (trả `who_id`, bỏ việc bị xoá / tự bỏ khỏi Đã xong). Phiên bản `2026.11.18.11`.

## Sổ thu chi mới — chốt 18/11/2026, đợt 1 (chỉ xem) đã làm (bước 143)

Thiết kế đầy đủ: `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md` (anh Tiến duyệt 18/11). Kế hoạch đợt 1: `tai_lieu/superpowers/plans/2026-11-18-so-thu-chi-moi-dot1.md`. Mẫu: https://claude.ai/artifact/6L53uqto8BgLHgBSLh744E

- **Mục tiêu:** một trang **Sổ thu chi** thay 4 trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ) và phần tiền của Đối soát ca. Mỗi cơ sở 1 lần xem; 4 tab **Tổng · Đối soát tiền · Sổ thu · Sổ chi**; nút **Quỹ ngoài** (chỉ Chủ).
- **Công thức:** Tổng thu = Doanh thu + Thu nợ + Thu khác + Luân chuyển + Chênh lệch dư; Tổng chi = Các khoản chi + Cho nợ + Luân chuyển + Chênh lệch thiếu. Mỗi ca, mỗi loại tiền: Thu − Chi = Thực tế − Tiền đầu ca. Tồn quỹ = Tồn đầu tháng + Thu − Chi − Chuyển về Quỹ ngoài.
- **Đã chốt (làm ở đợt sau):** sửa / thêm / xoá mọi phiếu (Chủ, QL tổng, QL cơ sở) — phiếu cũ gạch ngang + phiếu bổ sung, chỉ sau khi **Chốt tiền ca**; phiếu chênh lệch xử lý ngay trong sổ (ghép / quán chịu chờ Chủ duyệt; đã tạo phiếu trừ tiền thì không ghép; đã tạo phiếu thu thì không gán nợ); người nợ có dấu ✓ (không nhắc ở phiếu chốt ca, thay Công nợ gia đình / Nợ kho tổng); Đối soát tiền 3 bước (so phiếu Fabi ↔ NV ghi, Fabi là chuẩn, "Sửa theo Fabi"; tiền thực nhận theo ca / theo ngày; Chốt tiền ca); ca nào ghi sai tiền mở ca ca đó chịu; chuyển khoản thực nhận luôn lấy số kế toán; bỏ ô Cuối ngày; Chuyển về Quỹ ngoài thay phiếu rút.
- **Đợt 1 (bước 143, máy chủ `127_so_thu_chi_xem.sql` + `128_so_thu_chi_quy_ngoai.sql`, web 2026.11.19):** trang `#/quan-ly/so-thu-chi` **chỉ xem**, chạy song song trang cũ, chỉ Chủ + Quản lý tổng xem (Quỹ ngoài chỉ Chủ). Dữ liệu thật từ 01/11. Mọi nút sửa tắt ("Đang chạy thử"). Tab Tổng có khung **So với trang cũ** (tồn quỹ từng ngày so Sổ quỹ cũ, lệch từng ca so Lệch tiền ca cũ).
- Kết quả chạy thử máy chủ 18/11: chênh lệch mọi ca khớp 100% cách tính cũ (4 cơ sở), luân chuyển cân, < 0,5 giây / cơ sở. Tồn quỹ khác Sổ quỹ cũ: ĐK −369.000 tiền mặt từ 15/11, HS +5.000 từ 07/11, ngày đang chạy (kế toán chưa nhập đủ) — xem khung So với trang cũ.
- Đợt 1 tạm hiểu: "Đã chốt tiền" = ca đã đối soát mục Tiền mặt + Chuyển khoản; doanh thu theo bản đối soát; phiếu chi chuyển khoản hiện ngoài ca.
- **Đợt 2 (19/11, máy chủ `129_so_thu_chi_sua.sql` + `130_so_thu_chi_sua_ca.sql`, web 2026.11.19.2)** — kế hoạch `tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot2.md`:
  - **2a:** sửa / thêm / xoá khoản **ngoài ca** (khoản quản lý tạo, luân chuyển quỹ, cho nợ ngoài ca, thu nợ ngoài ca — thu nợ chỉ Thêm / Huỷ thu). Phiếu cũ gạch ngang vẫn hiện, phiếu bổ sung ghi người sửa, giờ, số cũ → mới, lý do. Sửa / xoá bắt buộc lý do. Lịch sử ở bảng `stc_edits`. **Người nợ ✓** (khung Người nợ ở Sổ chi): ✓ = nhóm kho / khác (không nhắc ở phiếu chốt ca), bỏ ✓ = khách. Khung **Khách đang nợ** có nút Thu nợ (trả một phần được).
  - **2b (vùng khoá — anh Tiến gõ mật khẩu 19/11):** sửa / thêm / xoá **khoản thu chi của ca đã chốt tiền** (đã đối soát Tiền mặt + Chuyển khoản), Chủ / Quản lý tổng / Quản lý cơ sở được giao. Chỉ sửa bản đối soát (phiếu nhân viên giữ nguyên), **không mở lại** mục tiền đã duyệt, lý do bắt buộc, ghi nhật ký đối soát. Khoản tự động (chi lương, khách mượn), đổi tiền mặt ↔ CK, đã thành nợ / cho vay, đã gán âm tiền: sửa ở phiếu ca / Công nợ. Ca chưa chốt tiền: khoá ("Chốt tiền ca ở tab Đối soát tiền mới sửa được").
  - Trang vẫn chỉ Chủ + Quản lý tổng thấy (chạy song song); hàm ghi cho phép cả Quản lý cơ sở được giao.
- **Đợt 3 (19/11, máy chủ `131_so_thu_chi_lech.sql`, web 2026.11.19.3)** — kế hoạch `tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot3.md`: **phiếu chênh lệch** mở ngay trong sổ (nút "Phiếu chênh lệch" ở khoản Chênh lệch; ca chưa chốt tiền thì khoá).
  - Phiếu ghi Phải có / Thực tế / Lệch / Người làm ca, danh sách đã xử lý / đang chờ (mỗi dòng có nút Huỷ, lý do bắt buộc), "Còn xử lý được".
  - **Ca thiếu:** Trừ lương (mặc định chia đều người làm ca, sửa được) · Quán chịu · Ghép với ca dư (ca cùng loại tiền, cùng cơ sở, cách ≤ 3 ngày). Đã có phiếu trừ tiền → **không ghép** (huỷ phiếu trừ tiền trước).
  - **Ca dư:** Ghép với ca thiếu · Tạo phiếu thu (Thu khác) · **Gán nợ khách trả** (máy chủ `132_so_thu_chi_gan_no.sql`, web 2026.11.19.4 — vùng khoá, anh Tiến mở bằng mật khẩu 19/11): chọn khoản nợ đang mở ghi **trước** ca → nợ đóng vào ca (thành Thu nợ của ca, dòng ghi "Gán nợ khách trả (quản lý)"), phần dư tự giảm; không mở lại mục tiền đã duyệt; trả một phần thì phần nợ còn lại tách riêng. Huỷ ở phiếu chênh lệch hoặc nút Huỷ thu của dòng thu nợ → nợ mở lại (gộp phần đã tách). Đã có phiếu thu → không gán nợ.
  - **Quán chịu / Ghép** do Quản lý tổng / Quản lý cơ sở bấm → **⏳ chờ Chủ duyệt** (chỉ Chủ có nút Duyệt / Từ chối); Chủ bấm thì có hiệu lực ngay. Quán chịu chờ duyệt lưu ở bảng `stc_gap_requests`; ghép chờ duyệt dùng `gap_matches` như tab Lệch tiền ca cũ.
  - Sổ chỉ cộng **phần còn lại sau ghép đã duyệt**, hiện phép tính "30.000 − 20.000 ghép = 10.000"; tab Đối soát tiền vẫn tính tiền thật của ca bằng lệch gộp (trước ghép). Ca dư ghi "Chờ xử lý · chưa làm phiếu thu".
  - Hàm `app_stc_gap_*` bọc hàm cũ của tab Lệch tiền ca nên hai trang dùng chung dữ liệu trong lúc chạy song song.
- **Đợt 5 (19/11, web 2026.11.19.5, không thêm tệp SQL)** — kế hoạch `tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot5.md`. Bật các nút ở tab Tổng và Quỹ ngoài, dùng lại hàm Sổ quỹ cũ:
  - **Chuyển về Quỹ ngoài** (= phiếu rút cũ, bảng `fund_withdrawals`): tiền mặt / tài khoản, giữa tháng / cuối tháng (điền sẵn số dư), ngày, ghi chú. Còn chờ thì Sửa / Xoá; Chủ bấm **Đã nhận tiền** (ở tab Tổng cơ sở hoặc Quỹ ngoài) thì khoá cả 2 bên.
  - **Luân chuyển tiền mặt ↔ tài khoản** (mở sẵn hộp thoại luân chuyển của đợt 2).
  - **Kiểm quỹ** (so với sổ, lệch bắt lý do) + khung "Kiểm quỹ tháng này"; lệch chưa điều chỉnh có nút **Điều chỉnh…** (chọn nhóm, tạo khoản thu / chi). Ô **Kiểm quỹ lần cuối**.
  - **Quỹ ngoài:** "+ Thêm khoản ngoài" ở Sổ chi / Sổ thu, khoản ngoài có Sửa / Xoá, cách chia: theo doanh thu / chia đều / 1 cơ sở / tự nhập.
  - **Chốt tháng:** không đổi — Chuyển về Quỹ ngoài chính là bảng phiếu rút mà Chốt tháng đang đối chiếu.
- **Đợt 4 (19/11, máy chủ `133_so_thu_chi_doi_soat.sql`, web 2026.11.19.6 — vùng khoá, anh Tiến mở bằng mật khẩu 19/11):** tab **Đối soát tiền** làm thật, mỗi ca 3 bước — kế hoạch / ghi chép `tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot4.md`.
  - ① **Sửa theo Fabi** cho Tiền mở ca / Doanh thu / Nợ (sửa số nhân viên ghi trong bản đối soát, lưu số cũ → mới, người sửa; nợ Fabi nhiều hơn thì thêm báo nợ phần chênh nếu ghi tên). Tiền mở ca 2 tầng: NV ↔ Fabi, rồi Fabi ↔ số phải là → **"Ca trước ghi sai" / "Ca này ghi sai"** (ca nào ghi sai ca đó chịu, có Huỷ chọn; ca trước thu theo ca thì chỉ chọn được "Ca này").
  - ② **Thu theo ca / Thu theo ngày**: thu theo ca nhập tiền mặt quản lý đếm mỗi ca; thu theo ngày chỉ ca cuối nhập (đếm két sau ca). Chuyển khoản luôn số kế toán.
  - ③ **Chốt tiền ca**: cần hết ô đỏ ở ①, có file Fabi + ngân hàng, có tiền mặt thực nhận (thu theo ca). Lệch không chặn chốt — thành phiếu chênh lệch. **Mở lại chốt** bắt lý do.
  - Trang Đối soát ca cũ vẫn giữ phần tiền trong lúc chạy song song (anh dặn chưa bỏ trang cũ); hai trang dùng chung dữ liệu.
- **Bước 151 — Đối soát Fabi + Chốt ca vĩnh viễn + Khoản treo (19/11, máy chủ `135_doi_soat_fabi_chot_ca.sql` — vùng khoá, anh Tiến mở bằng mật khẩu 19/11; web 2026.11.19.8)** — thiết kế `tai_lieu/superpowers/specs/2026-11-19-doi-soat-fabi-chot-ca-design.md`, kế hoạch `tai_lieu/superpowers/plans/2026-11-19-doi-soat-fabi-chot-ca.md` (thay mục 3.3 của thiết kế Sổ thu chi):
  - Tab **"Đối soát Fabi"** (đổi tên từ "Đối soát tiền"). Chọn ca thì mở khung rộng hết trang gồm 3 phần: **A · Fabi** → **B · Thu chi của ca** → **🔒 Chốt ca**.
  - **A · Fabi** chỉ xác định phiếu đúng, tiền mặt và chuyển khoản thực nhận.
    - ① Mỗi ô ghi "Phiếu nhân viên ghi" / "Máy Fabi ghi", nhãn "Nhân viên ghi thiếu / thừa X so với máy", nút **Lấy số máy Fabi** (tên cũ "Sửa theo Fabi"). Mỗi ô ghi rõ ảnh hưởng tới sổ: lệch mở ca → dòng chênh lệch tiền mặt của ca chịu; doanh thu → phiếu thu không đổi; báo nợ → khách nợ ở Công nợ, không tạo phiếu chi.
    - Cảnh báo hoá đơn bị sửa / xoá trên Fabi nằm ở khung vàng riêng.
    - ② Tiền thực nhận như cũ.
    - Nút **Xác nhận Fabi** (= "Chốt tiền ca" cũ) và **Mở lại xác nhận** (không bấm được khi đã Chốt ca). Xác nhận xong phần A thu gọn thành 5 ô số.
  - **B · Thu chi của ca** giống Sổ thu / Sổ chi, chỉ lọc ca này: nút Sổ thu | Sổ chi, bảng Tiền mặt | Chuyển khoản, ô số theo cột, bảng Tiền của ca, Nợ bill của ca, + Thêm phiếu.
    - **Chênh lệch là khung riêng** theo đúng bảng và sổ: tiền mặt ở bảng Tiền mặt, chuyển khoản ở bảng Chuyển khoản; dư ghi Sổ thu, thiếu ghi Sổ chi.
    - Phần lệch tiền mở ca tách thành dòng "Gồm: …", không gộp chung.
    - Dòng nhắc "⚠ Ca còn chênh lệch ở …" để quản lý không bỏ sót.
  - **🔒 Chốt ca**: cần đã xác nhận Fabi, chi đã phân loại hết, không còn khoản chờ Chủ duyệt, tiền mặt thiếu đã xử lý (lệch ≤ 5.000 coi như khớp). **Khoá vĩnh viễn, không có nút mở lại.**
    - Máy chủ chặn bằng trigger `stc_final_guard` (giống khoá tháng), nên mọi trang cũ cũng không sửa được ca đã chốt.
    - File Fabi / số dư ngân hàng / bản đối soát do hệ thống tự ghi thì bỏ qua lặng lẽ, để kế toán tải file không bị lỗi.
  - **Khoản treo** (tạo khi Chốt ca, bảng `stc_treo`):
    - Chuyển khoản thiếu → **chờ tiền về**, hạn 3 ngày. "Đã về" = chọn ca có chuyển khoản dư (đã xác nhận, chưa chốt) để bù. Quá hạn thì Trừ tiền nhân viên / Quán chịu (ghi lên ca gốc qua lối riêng; không phải Chủ thì chờ Chủ duyệt).
    - Phần dư → **tiền thừa chờ ghép** tới hết tháng; "Ghép với ca thiếu". Hết tháng chưa ghép thì thành Thu khác.
    - Ca gốc không đổi một đồng. Khoản treo hiện ở tab Tổng (ô + khung).
  - Sửa lỗi đợt 4: "Xác nhận Fabi" không còn báo "mục đã tự đối soát nên KHOÁ" khi mục đó đã khớp (kết quả trùng, hoặc lệch ≤ 5.000).
  - Sổ chung: ca đã chốt ẩn mọi nút ("🔒 Ca đã chốt"); ca chưa chốt có đường dẫn "Xử lý & chốt ca này ở Đối soát Fabi ›".
  - Sửa sau duyệt mã (19/11, trước khi chạy thật):
    - Tải lại file Fabi bỏ qua ca đã chốt (status `da_chot_ca`).
    - Khách trả một phần nợ ghi từ ca đã chốt vẫn ghi được (tách / gộp dòng, tổng nợ ca giữ nguyên).
    - Huỷ "Đã về / Ghép" → khoản treo mở lại; khoản treo đã đóng bằng trừ tiền / quán chịu / thu khác thì không huỷ được.
    - Trừ tiền khoản treo phải đúng phần còn treo; **Quán chịu khoản treo chỉ Chủ**; tiền thừa hết tháng → nút **Ghi Thu khác**.
    - Chặn gán nợ / tiền về muộn / xử lý lệch trên ca đã chốt; dấu duyệt việc không phải tiền + gán lương nhân viên vẫn làm được; Công việc không nhắc lệch ca đã chốt.
    - **Chốt ca cần ca sau cùng ngày đã xong ô Tiền mở ca** (có Fabi, khớp hoặc đã chọn ca chịu) — để lệch giao ca không đổi số ca đã chốt.
    - Khôi phục phiếu: đã có phiếu y hệt thì ẩn nút (tránh thêm trùng).
- **Bước 152 — Xoá phần cũ, Sổ thu chi là chỗ làm tiền duy nhất (19/11, máy chủ 136 + 137, web 2026.11.19.9)** — thiết kế `tai_lieu/superpowers/specs/2026-11-19-xoa-phan-cu-design.md`, kế hoạch `tai_lieu/superpowers/plans/2026-11-19-xoa-phan-cu.md`:
  - **Đã xoá** trang Thu chi cũ, Lệch tiền ca, Sổ quỹ (cả 4 việc riêng của Sổ quỹ: sửa nộp quỹ từng ngày, số dư đầu, bảng tổng các cơ sở, tiền hàng kho tổng ở Quỹ ngoài — anh chốt bỏ). Đường dẫn cũ tự chuyển: Thu chi → Sổ chi; khoản âm → Sổ chi lọc Có trừ lương; Lệch tiền ca / Âm tiền → Đối soát Fabi; Sổ quỹ → Tổng (giữ tháng, cơ sở).
  - **Sổ thu / Sổ chi có bộ lọc đầy đủ** (anh chốt thay cho tab Khoản âm riêng): tìm không dấu (nội dung, nhóm, người, giải trình), Nguồn, Loại → Nhóm, Trạng thái (chưa phân loại, chờ xử lý, có trừ lương, đã xoá, ca đã chốt / chưa chốt), Bỏ lọc; giữ trên đường dẫn `loc=`. Lọc Có trừ lương hiện từng phiếu + giải trình nhân viên + Mở phiếu chênh lệch (Huỷ ở đó).
  - **Quản lý cơ sở vào Sổ thu chi** (menu Quản lý ca › Sổ thu chi, quyền `doi_soat`): chỉ cơ sở được giao — Chủ / QLT, quản lý quỹ cơ sở, hoặc quản lý được giao việc "Đối soát ca" của cơ sở (Phân công việc). Quỹ ngoài chỉ Chủ.
  - **Đối soát ca bỏ bước tiền**: thẻ "Phần tiền làm ở Sổ thu chi › Đối soát Fabi ›" mở đúng ca. Xác nhận Fabi ghi đủ kết quả Tiền mặt / Chuyển khoản / Thu chi / Công nợ + duyệt Thời gian doanh thu, Doanh thu → ca xong phần việc thì tự Hoàn thành đối soát.
  - Bỏ: nút "Thành nợ" trên khoản chi của ca (làm thay: xoá khoản chi rồi thêm "Cho nợ" vào ca); dấu tick "đã kiểm" (chọn nhóm = đã kiểm). Nút "Mở khoá" mục tự đối soát vẫn ở Đèn đối soát.
  - Sửa sau duyệt mã (web 2026.11.19.10, máy chủ 138): Đối soát ca lưu phần việc không gửi ô tiền rỗng; quản lý cơ sở thêm / sửa / xoá khoản ngoài ca được.
- **Bước 153 (19/11, máy chủ 139, web 2026.11.19.11)** — anh Tiến chọn sau duyệt mã:
  - Lọc **Có trừ lương** ở Sổ chi hiện MỌI phiếu trừ lương của tháng (cả loại không gắn dòng chênh lệch: Âm tiền từ khoản chi, thu chi, công nợ) với lý do, giải trình, nút **Sửa** (người, số tiền, Trừ lương / Đã nộp bù / Miễn — `app_ka_edit`) và **Xoá** (`app_ka_delete`); ca đã chốt thì khoá.
  - Nút **→ Trừ lương** trên khoản chi nhân viên ghi (ca đã xác nhận Fabi, chưa chốt): chọn tối đa 3 người, tổng đúng số khoản → khoản thành Không tính chi phí + phiếu trừ lương (`app_tc_move_to_ka`); **Bỏ chuyển** (`app_tc_move_ka_undo`).
  - Nút **Phiếu chi chuyển khoản** của ca ở Sổ chi · bảng Chuyển khoản (và phần B Đối soát Fabi): danh sách / tạo / xoá phiếu (`phieu_chi_ck.js`, quyền như cũ: Chủ, QLT, Kế toán).
- **Bước 166 (19/11, web 2026.11.19.23)** — anh Tiến (KH5, chọn mẫu B qua hình mẫu): **tab Tổng của Sổ thu chi** — đầu trang có 2 khung cạnh nhau **Việc cần làm** (ca chưa xác nhận Fabi chấm đỏ đứng trước + nút Mở ›, lệch chờ xử lý → Xử lý ›, chi chưa phân loại → Phân loại ›, Chuyển về Quỹ ngoài chờ Chủ nhận → Chủ bấm Đã nhận tiền) và **Ai còn nợ** (mỗi người 1 dòng: tổng còn nợ, số khoản, lâu nhất bao nhiêu ngày, quá 7 ngày đỏ; bấm tên thấy từng khoản + nút Thu nợ; người có ✓ gộp vào dòng "Người nhà / Kho Tổng" thu gọn). Hai khung **cao bằng nhau, có giới hạn chiều cao, nhiều thì cuộn bên trong** (anh dặn không kéo dài trang). Bỏ 5 ô nhỏ; Kiểm quỹ thành khung riêng (dòng "Lần cuối" + danh sách); "So với trang cũ" thu gọn ở cuối trang. Quỹ ngoài không có 2 khung đầu. Không đổi cách tính, không đổi máy chủ.
- **Bước 165 (19/11, web 2026.11.19.22, máy chủ 145)** — anh Tiến (KH1): **👁 Xem như người khác** — chỉ Chủ; chọn một người (Nhân viên / Quản lý / Quản lý tổng / Kế toán, ghi "có thêm quyền Kế toán") → web hiện y như người đó thấy (menu, nút, cơ sở, số liệu, trang Của tôi); **chỉ xem** (máy chủ chặn mọi thao tác ghi, web chặn tải / xoá ảnh); dải vàng trên cùng "Đang xem như … — chỉ xem · còn N phút" + Máy tính | Điện thoại (khung 390px) | Đổi người | Thoát; tự thoát sau **30 phút**; chỉ trình duyệt đang bật bị đổi (theo phiên đăng nhập); nhật ký LOG ghi Chủ nào xem như ai, lúc nào; không hỏi mật khẩu.
- **Bước 164 (19/11, web 2026.11.19.21)** — anh Tiến (KH4, phương án C theo hình mẫu): **Sổ thu / Sổ chi gọn, không đổi tính năng** — phần đầu 1 nút chuyển Tiền mặt | Chuyển khoản + 1 hàng ô số (dòng phụ chỉ khi có việc: "N ca chờ xử lý", "+ N khách còn nợ", "N khoản cần phân loại", "N người nợ"); bỏ cột bên phải; **bấm ô = chỉ xem khoản loại đó** (Thu nợ kèm Khách còn nợ + nút Thu nợ; Các khoản chi kèm Chi theo loại + Cần phân loại lên đầu; Cho nợ kèm Người nợ ✓; Quỹ ngoài kèm Phần mỗi cơ sở chịu), danh sách theo bảng tiền đang xem; cột cả tháng bằng 0 tạm ẩn (bấm "hiện lại"), ô 0 để trống; nút **👥 Người nợ** ở Sổ chi (xem, ✓ không nhắc, + Thêm người nợ — không đổi tên / gộp / xoá); bộ lọc ghi "Nguồn · …", dòng "Đang lọc: …" bỏ từng điều kiện, kết quả nhóm theo ngày + Cộng, điện thoại gom vào ⚙ Lọc; mở ngày: trạng thái ca ghi 1 lần, ca chưa xác nhận Fabi / tháng đã chốt chỉ 1 dòng ghi chú; "+ Thêm phiếu" xếp 2 hàng.
- **Bước 163 (19/11, web 2026.11.19.20)** — anh Tiến (KH3): khung **+ Thêm phiếu** của Sổ thu chi — ô **Ngày điền sẵn hôm nay**, ô **Ca chỉ hiện ca của ngày đó** (dòng đầu "Ngoài ca", rồi Sáng → Chiều → Tối, ghi người làm "Ca Sáng · Hà, Tú"). Ca chưa xác nhận Fabi hiện **mờ** "— chưa xác nhận Fabi" (tháng đã chốt: "— tháng đã chốt"). Ngày không có ca chọn được: dòng nhắc "Ngày DD/MM chưa có ca nào xác nhận Fabi". Ô Ngày không bị khoá khi chọn ca; đổi Ngày thì ca về "Ngoài ca". Bấm thêm từ dòng một ca: Ngày = ngày ca, chọn sẵn ca đó. Cho nợ / Thu nợ / Luân chuyển vẫn chỉ ngoài ca, thêm vào ca vẫn bắt lý do.
- **Bước 162 (19/11, web 2026.11.19.19, máy chủ 144)** — anh Tiến: **giờ chốt ca (giờ kết thúc doanh thu)**:
  - Kế toán đã tải file Fabi của ca → giờ chốt **tự lấy theo giờ đóng ca trong file** (nhiều file thì lấy giờ muộn nhất), không ai sửa tay. Tải lại file giờ khác thì đổi theo. Nhân viên gửi phiếu sau khi đã có file cũng lấy giờ file.
  - Chưa có file Fabi → **Quản lý cơ sở (được giao) / Quản lý tổng / Chủ** sửa tay tới khi Chốt tháng, bắt ghi lý do. Nút **✎ Sửa giờ chốt** ở Sổ thu chi › Đối soát Fabi (đầu phần A) và thẻ "Phần tiền" của trang Đối soát ca, cùng một ô sửa.
  - Ca sau (cùng ngày, Sáng → Chiều → Tối) đã gửi phiếu thì giờ bắt đầu tự đổi theo; chưa gửi thì khi mở phiếu tự lấy giờ mới. Ca Sáng luôn 06:45. Giờ mở trong file Fabi không dùng.
  - Chặn: giờ chốt phải sau giờ bắt đầu, phải trước giờ chốt ca sau, tháng đã chốt thì không sửa. Giờ trong file vô lý thì không tự áp, hiện "không hợp lệ, sửa tay" và cho sửa tay.
  - Không đổi tiền, không bỏ dấu đã duyệt Thời gian doanh thu, không phải Xác nhận Fabi lại, không gửi thông báo; lịch sử ở `shift_recon_log` (sua_gio / gio_fabi / sua_gio_theo) + LOG.
  - Đã sửa giờ chốt các ca cũ của tháng chưa chốt theo file Fabi (danh sách anh duyệt).
- **Bước 160 (19/11, web 2026.11.19.17)** — anh Tiến: nút **Mở lại xác nhận** Fabi **không bắt ghi lý do** (ô lý do không bắt buộc; không ghi thì nhật ký lưu "không ghi lý do"). Máy chủ tệp 143. Sửa 2 bài thử cũ `flow_cm84`, `flow_cn95`.
- **Bước 159 (19/11, web 2026.11.19.16)** — anh Tiến: **khách trả nợ một lần, đủ cả khoản** (cách 2 + A). Không còn tách khoản (trigger `debt_no_split` chặn mọi đường). Khách đưa thiếu: web hỏi trước, khoản cũ đóng đủ, phần còn thiếu thành nợ mới (`rest_of` = khoản cũ) — phiếu chốt ca: nợ mới trong chính ca (TM → Nợ TM trừ két, CK → Nợ CK trừ hotline); ngoài ca (Công nợ, Sổ thu chi): nợ quản lý ghi, tiền đưa từ quỹ (`fund_out`). Bỏ trả → nợ mới (chưa trả) tự xoá. Gán nợ ở phiếu chênh lệch: két dư phải đủ cả khoản. Ghi **ngày + ca trả** ("đã trả · 20/11 ca Sáng · tiền mặt"; ngoài ca "· quản lý thu ·") ở Đối soát Fabi phần A, Sổ chi › Cho nợ, phiếu chốt ca (bước Khách nợ), Công nợ. Máy chủ tệp 142 (`app_stc_month.debt_paid`, `app_ca_get` debts có `paid_date/paid_shift`).
- **Bước 158 (19/11, web 2026.11.19.16)** — anh Tiến: **bỏ hẳn "🔒 Chốt ca" vĩnh viễn** + Khoản treo; khoá cuối cùng là **Chốt tháng, chỉ Chủ mở lại**. "Mở lại xác nhận" Fabi (mở khoá chốt tiền của ca) cho Quản lý cơ sở / Quản lý tổng / Chủ (trước đó máy chủ chỉ cho Chủ khi ca đã đối soát xong hoặc có mục tự duyệt). Vùng khoá — đã báo anh trong chat. Máy chủ tệp 141 (bỏ trigger `stc_final_guard`, xoá 2 dòng `stc_ca_finals`, `app_stc_ca_final` báo đã bỏ, `app_stc_ds_reopen` tự mở lại).
- **Chặng 6 — Dọn ca tháng 11 để chốt tháng (anh Tiến chốt sáng 23/11, 5 câu). Phần 1: tiện ích Chrome Đồng bộ C02 bản 0.3.0 (không thuộc web; Chrome của anh nạp tiện ích từ thư mục làm việc trên máy)**
  - **Vì sao:** từ 18/11 tiện ích dừng ở lỗi "Fabi đổi bộ lọc ngày" → 18–22/11 không có tệp ca Fabi nào → 57 ca chờ kế toán. Fabi đổi giao diện: đường dẫn `/micro/…`, ô ngày là ô nhập chữ, lịch 2 tháng có nút Hôm qua, phân trang bằng nút số + "Hiển thị a - b trên tổng số N" (10 dòng/trang, ~12 ca/ngày → 2 trang).
  - **Anh chọn "Sửa + thêm ô chọn ngày":** tiện ích đọc được giao diện mới; đọc đủ mọi trang, số ca đọc được phải bằng N Fabi báo — thiếu là dừng, chưa nhập gì. Cửa sổ tiện ích có ô **Ngày cần lấy** (31 ngày gần nhất, ghi ngày nào tiện ích đã đồng bộ bao nhiêu ca); lấy bù mỗi lần một ngày: chọn ngày → 1. Kiểm tra tải → 2. Đồng bộ. Lịch 08:15 và nút trên trang Kế toán › File ca Fabi vẫn chỉ làm hôm qua (web không gửi được ngày, không nhập được bản kiểm tra của ngày lấy bù).
  - **Nút "3. Kiểm tra & bù ca thiếu cả tháng" (anh yêu cầu + chọn 4 câu, 23/11, tiện ích 0.3.2):** xét cả tháng đang mở (ngày 1 → hôm qua); "nghi sai" = file trên web khác file Fabi tải lại; ca chưa có file **tự nhập**, ca khác Fabi **liệt kê để anh xem rồi mới nhập đè** (có thể mở lại ca đã đối soát); nút ở cửa sổ tiện ích (không thêm trên web).
  - **Anh chọn "Sáng nào cũng tự lấy bù":** mỗi sáng lấy hôm qua rồi tự lấy các ngày còn thiếu trong 7 ngày gần nhất — **làm sau khi bản 0.3.0 chạy ổn trên Fabi thật** (đúng như câu anh chọn).
  - Hai việc còn lại của chặng 6 (anh chọn): **Trang duyệt x2 nhiều ca** (94 ca chưa phân loại + 14 ca chờ Chủ) và **nút "Đã xem — tích hết" ở mỗi bước** phần tiền — chưa làm, hỏi kỹ trước khi làm.
- **Chặng 5 — Đưa Đối soát Fabi về lại Chốt ca (anh Tiến chốt 22/11 chiều, thiết kế `tai_lieu/superpowers/specs/2026-11-22-doi-soat-ve-chot-ca-design.md`; duyệt ảnh tối 22/11 "Duyệt đưa lên web"; web 2026.11.23.1; máy chủ `164_doi_soat_ve_chot_ca.sql`)**
  - **Ai làm:** quản lý cơ sở (dòng "Đối soát ca" của Bảng phân công), Chủ, Quản lý tổng; dồn vài ngày làm một lần cũng được. Quyền, cách tính tiền, khoá Chốt tháng **không đổi**.
  - **Trang đối soát của ca** `#/ca/doi-soat?id=` — 3 thẻ: **① Phần việc** (Ai làm ca · Nghỉ & làm thay (chỉ hiện khi có) · Bàn giao; bước cuối "Duyệt & sang phần tiền") · **② Phần tiền** (5 bước của Đối soát Fabi cũ chuyển nguyên: Số máy Fabi · Tiền thực nhận · Khoản thu · Khoản chi · Chênh lệch) · **③ Hoàn thành** (tóm tắt phần việc + 5 bước tiền; nút "Hoàn thành đối soát ca" khoá khi còn phần việc, trừ khi chỉ còn chờ Chủ duyệt x2; Mở lại). Đầu trang: "Xem phiếu nhân viên" · "Ca tiếp theo chưa xong ›" (bỏ qua ca chờ kế toán). Đường dẫn nhớ thẻ; bước đang mở giữ khi trang vẽ lại.
  - **Bảng tuần Chốt ca** (người đối soát được cơ sở): ô ca đã gửi phiếu có 2 dòng **Việc** (✓ / –) · **Tiền** (⏳ chờ kế toán · 🔴 ô đỏ · 🔵 chờ xác nhận Fabi · 🟡 chưa bấm Hoàn thành · 🟠 đã Hoàn thành nhưng còn chênh lệch chờ xử lý / chờ Chủ duyệt — anh chốt 23/11, bấm ô mở bước Chênh lệch · ✓), ca xong cả hai → "✓ Đã đối soát"; rê chuột xem còn thiếu gì; đầu bảng "Còn N ca chưa đối soát xong (M chờ kế toán) · Làm ca cũ nhất ›"; bấm ô → thẳng trang đối soát của ca, đúng thẻ còn dở. Nhân viên / kế toán thấy bảng như cũ.
  - **Giữ luật 17/11** (anh chốt lại 22/11): ca chờ kế toán thì cả phần việc lẫn phần tiền đều chờ — trang chỉ báo còn thiếu gì (nút mở File ca Fabi / Chuyển khoản thực nhận).
  - **Sổ thu chi bỏ tab Đối soát Fabi** (còn Tổng · Sổ thu · Sổ chi). Đường cũ (`?tab=doi-soat&ds=&b=`, Lệch tiền ca, Âm tiền, thông báo cũ) tự chuyển sang trang đối soát của ca (có ca) hoặc bảng tuần Chốt ca (tháng này → tuần hiện tại). Chữ ở Sổ thu chi, Chốt tháng, Công nợ, Cho vay, Tệp ca Fabi chỉ đúng chỗ mới.
  - **Nhập hàng** (anh chọn tối 22/11 "Chỉ hiện khi còn hàng"): theo luật 15/11 nhập hàng làm ở menu Hàng hoá; dòng "Nhập hàng" ở bảng đèn / tóm tắt / bảng tuần chỉ hiện khi ca thật sự còn hàng kho tổng chưa đối soát (ca cũ trước 15/11). Trang đối soát mở bản kiểm tra trước khi đọc phiếu nên mục máy tự đánh dấu thấy ngay lần mở đầu (sửa lỗi lần đầu còn hiện "Nhập hàng" đỏ).
  - **Trừ tiền nhân viên chọn người bằng ô tích** (anh chốt tối 22/11, 3 câu): Phiếu chênh lệch → Trừ lương và → Trừ lương ở khoản chi hiện người làm ca có ô tích, **mặc định không ai được tích**; tích ai thì tự chia đều cho người được tích (làm tròn nghìn, phần lẻ người tích đầu), sửa tay được; hộp khoản chi còn 1 ô "Người ngoài ca". Chỉ giao diện.
  - **Máy chủ tệp 164**: 2 hàm đọc cho bảng tuần (`app_ca_ds_tuan`, `app_ca_ds_con`; quyền `app__stc_can`, không quyền → []); đổi **chữ** báo lỗi còn chỉ tab cũ / "bước 6" / "mục 7" (app_ca_recon_finish, app_fin_close, app_stc_move_exchange, app_ca_check) — không đổi điều kiện.
  - Bài thử: Postgres cục bộ `kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql` (16); trình duyệt `flow_dsca` (mới, 5 vai × 2 khung), vùng khoá `flow_ql_tu_ds` viết lại theo trang 3 thẻ + `flow_stc6` / `flow_stc7`; các bài phần tiền cũ đổi chỗ trỏ (`flow_stc1–18`, `flow_ds156/168/171/172/173`, `flow_gio162`, `flow_cu152`).
- **Chặng 4 (anh Tiến chốt trưa 22/11, 6 câu; phần 1 lên web 2026.11.22.2 lúc 12:31; máy chủ `162_no_bill_khop_danh_sach.sql`, `163_lich_su_dao_tao.sql` chạy thật 12:30; phần 2 — màn hình đào tạo theo tab ngày — lên web 2026.11.22.3 lúc 13:53)**
  - **Hàng hoá › Đối soát chỉ cho người có quyền Đối soát** (L-08): người không có quyền gõ thẳng địa chỉ trang thì được đưa về Hàng hoá › Nhận hàng (giữ cơ sở đang chọn). Chỉ giao diện.
  - **Tệp ca Fabi hết báo khi quản lý đã Xác nhận Fabi** (L-07, anh chọn "Xác nhận Fabi xong thì hết báo"): ca đã có kết quả Tiền mặt + Chuyển khoản (đã Xác nhận Fabi) không còn "Cần quản lý xem"; chỗ nhân viên gõ khác Fabi ghi nhỏ "Gõ khác Fabi: … · quản lý đã xác nhận Fabi". Máy chủ `app_fabi_list` trả thêm `xn` (tệp 162). Lúc lên: còn 7 ca cần quản lý xem (trước 13).
  - **3 hộp ghi nợ chọn người nợ trong danh sách** (L-11): Công nợ › Ghi nợ; hộp Sửa / Xoá khoản → Thành nợ; Đối soát ca › Ghi nhận nợ. Chọn người có sẵn hoặc "+ Thêm người nợ…" (tên, SĐT, nhóm công nợ — như Sổ chi › 👥 Người nợ); không còn ô gõ tay (máy chủ vốn từ chối tên lạ, tệp 151). Không tải được danh sách thì giữ ô gõ tay như cũ. `docs/js/nguoi_no_chon.js`.
  - **VÙNG KHOÁ — Nợ bill của ca phải bằng danh sách khách nợ hoá đơn của ca** (anh chọn "Báo đỏ và chặn"; đã báo anh trước khi sửa):
    - Ô Nợ ở bước 1 Đối soát Fabi đỏ "Nợ bill X khác danh sách khách nợ HĐ Y" khi số nợ của phiếu khác tổng danh sách nợ HĐ mới của ca (số gốc, kể cả khách đã trả sau) → chặn Xác nhận Fabi (máy chủ `app__stc_ds_state`).
    - Máy Fabi ghi **ít hơn** danh sách: không "Lấy số máy Fabi" được (khách nợ thật sẽ mất) — gỡ bằng "Sai, sửa số", Chủ duyệt.
    - Máy ghi **nhiều hơn**: "Lấy số máy Fabi" bắt chọn người nợ phần chênh (thêm vào danh sách); hộp Sửa số điền sẵn số danh sách.
    - Ca đã xác nhận mà lệch: dòng nhắc "muốn sửa: Mở lại xác nhận".
    - Lúc lên chỉ 2 ca đổi trạng thái: LHP ca Chiều 01/11 (đã xác nhận; danh sách 28.000) → dòng nhắc; LHP ca Chiều 04/11 (chưa xác nhận; danh sách 84.000, máy 0 — ca tệp Fabi thiếu số) → đỏ, quản lý bấm "Sai, sửa số" ghi nợ 84.000 (anh đã chốt khoản này có thật). 252 ca khác: 0 đổi tiền.
  - **Lịch sử đào tạo theo ngày thật — đợt 1 (máy chủ, tệp 163)**: từ 22/11 máy chủ ghi mọi lần tích / bỏ tích / chọn mức / Xác nhận đạt / đào tạo lại (ai, lúc nào, cũ → mới, ngày VN) bằng trigger; chạy bù phiếu cũ 289 dòng (192 hạng mục có số liệu + 97 xác nhận); nhận xét + 2 xác nhận theo ngày thật (`app_dt_dnote_comment` / `confirm`); xem `app_dt_history`. `app_dt_get` không đổi. **Đợt 2 — màn hình phiếu theo tab ngày thật: anh duyệt ảnh 22/11 ("Duyệt, đưa lên web"), lên web 2026.11.22.3 lúc 13:53.** Tab "Ngày 1 · dd/mm …" (ngày thật có lần tích) + "Ngày tiếp theo · còn N" (hạng mục chưa có mức, theo sườn 8 ngày); mỗi hạng mục 1 hàng để sửa (chưa có mức → Ngày tiếp theo; có mức → tab ngày gần nhất), ngày khác là thẻ chỉ xem có nút "Xem ở … ›"; dòng lịch sử giờ · việc · người; nút "↻ Đào tạo lại" (cùng mức vẫn ghi); nhận xét + 2 xác nhận theo ngày thật có tên; nhận xét theo ngày giáo trình cũ chỉ xem; chấm ở Ngày tiếp theo lưu tại chỗ (hàng không nhảy), mở tab ngày thì tải lại lịch sử. **Luật ai được tích giữ nguyên** (anh hỏi "1 ngày mấy người được tích" → không giới hạn số người: tích mọi hạng mục = Chủ, Quản lý tổng, quản lý cơ sở (vai có quyền Đào tạo), người hướng dẫn chính, người đào tạo tiếp; người được giao riêng chỉ tích hạng mục của mình, Cấp 1 ghi mức → Chờ kiểm tra; người học chỉ xác nhận ngày; anh chọn giữ nguyên, không siết). Thiết kế: `tai_lieu/superpowers/specs/2026-11-22-lich-su-dao-tao-theo-ngay-design.md`.
  - Bài thử: Postgres cục bộ `kiem_tra/no_bill_162_cuc_bo.sql` (6), `kiem_tra/lich_su_dao_tao_163_cuc_bo.sql` (13); `so_thu_chi_tinh_dot17.mjs` (11), `fabi_so_sanh_136.mjs` (29); trình duyệt `flow_stc18`, `flow_hh_c4`, `flow_dt_c4` (mới; 6 vai × 2 khung), `flow_fb136`, `flow_ds173` (theo quy tắc mới), `flow_dt169` / `flow_dt` (chỉ đổi chỗ trỏ khối ngày giáo trình đã bỏ), `flow_ds171` (dữ liệu thử ca 181 sửa cho khớp quy tắc mới — trước đó hỏng 4/40); bộ đầy đủ 2 khung (máy tính 104 lượt, điện thoại 103 lượt; vùng khoá `flow_ql_tu_ds` ql/chu + `flow_stc6/7` chu/qlt/ql); bó máy chủ thật (chụp trước → 162 / 163 ×2 → kiểm 8 dòng).
- **Chặng 3 — chuẩn bị chốt tháng 11 (anh Tiến chốt sáng 22/11, 8 câu; web 2026.11.22.1; máy chủ `159_chot_thang_con_thieu.sql`, `160_doi_luan_chuyen_trong_ca.sql`, `161_sua_no_ban5_test_cong_no.sql`)**
  - **Khung "Còn thiếu để chốt tháng"** (anh chọn "Thêm khung + sửa chữ"): đầu trang Chốt tháng. Trang **Tất cả**: mỗi cơ sở một dòng (phiếu đang chốt dở · ca chưa hoàn thành đối soát · khoản thu chi chưa chọn nhóm · ca có chênh lệch chờ xử lý · tiền rút về lệch), bấm tên cơ sở vào chi tiết; Quỹ ngoài chưa chia ghi 1 dòng chung. Trang **từng cơ sở**: thay dòng "Cần xử lý trước khi chốt" cũ; ca chưa hoàn thành đối soát chia theo chỗ kẹt (cùng thứ tự điều kiện tự hoàn thành): **chờ kế toán** (file Fabi / số dư ngân hàng, ghi rõ thiếu gì) · **chưa xác nhận Fabi** · **đã xác nhận, chưa bấm "Hoàn thành đối soát ca"** → ô ca mở đúng ca ở Sổ thu chi › Đối soát Fabi; **phần tiền xong, còn phần việc** (Nhân sự, Bàn giao, Nghỉ & làm thay… ghi rõ mục thiếu) · **đủ điều kiện, chờ ghi nhận** → mở ca ở trang Đối soát ca. Khoản chưa chọn nhóm → nút cuộn tới mục 4 hoặc Sổ thu chi › Sổ chi (lọc chưa phân loại); chênh lệch chờ → Đối soát Fabi / Tổng › Việc cần làm. Tiền rút về lệch: không chặn, nhắc ghi lý do khi chốt. Tháng đã chốt thì không hiện khung; hết việc thì "✓ Không còn việc nào chặn chốt". Số đếm **đúng điều kiện nút Chốt tháng chặn** (máy chủ `app_fin_missing`, cùng biểu thức `app_fin_close`).
  - **Câu báo lỗi khi bấm Chốt tháng** chỉ tới trang mới (trước chỉ tới Quản lý ca › Thu chi / Âm tiền, Sổ quỹ đã gỡ). **Không đổi điều kiện chặn** (vá đúng 5 câu chữ trên bản đang chạy).
  - **Khung tiền rút về giữ nguyên** (anh: "Có, cuối tháng rút về"): ghi tiền rút ở Sổ thu chi › Tổng › Chuyển về Quỹ ngoài là khung tự trừ (đã kiểm: ĐK 40,6 triệu, HS 21,2 triệu rút 19/11 đã trừ); chưa rút đủ thì khi chốt ghi lý do.
  - **Tiền hàng kho tổng ở Chốt tháng giữ tổng phiếu xuất** (anh: "Tôi sẽ tự làm phiếu" → xác nhận "giữ nguyên"); tháng 11 chưa có hàng giao bù / hoá đơn bổ sung nên bằng số "Phải trả kho tổng" (Q-15 đóng).
  - **9 mục đối soát giữ nguyên trong chặng 3.** Anh: "Tôi sẽ đưa đối soát Fabi về lại chốt ca" → **để sau chặng 3**; xong chặng 3 anh chốt lại: **làm sau cùng**, sau mọi việc khác (khi giao, hỏi kỹ trước rồi mới làm).
  - **Nút "Đổi thành Luân chuyển TM – CK"** (anh chọn "Làm nút đổi") trong hộp Sửa / Xoá khoản thu / chi của ca (Sổ chi, Sổ thu; ca đã xác nhận Fabi, chưa Hoàn thành): khách chuyển khoản để lấy tiền mặt (hoặc ngược lại) mà phiếu ghi thành thu / chi → giữ vế cũ, thêm vế ngược lại ở hình thức kia cùng số tiền, hai vế "Không tính" chi phí; bắt lý do, ghi lịch sử; quyền như sửa khoản của ca. Dùng cho LHP ca Sáng 09/11 (khoản chi tiền mặt 500.000 → hết dư chuyển khoản 500.000) — quản lý LHP tự bấm. Máy chủ `app_stc_move_exchange` (tệp 160).
  - **Sửa dữ liệu thật** (tệp 161, chạy 1 lần, chỉ sửa khi dữ liệu còn y như cũ, bằng đúng hàm web): **nợ bàn 5 ĐK ca Sáng 01/11** bị ghi 2 lần, cả 2 sai (khách mượn tiền mặt 28.000 — két thật không hụt; khoản chi chuyển khoản 26.000 "khách nợ" — nợ thành chi phí) → **một khoản nợ chuyển khoản 28.000** (anh chọn "Em sửa, nợ 28.000"); sau sửa ca thừa 11.000 tiền mặt + 2.000 chuyển khoản, quản lý xử lý ở bước Chênh lệch. **"Test công nợ" 73.000** (LHP ca Sáng 04/11, Fabi ghi nợ 101.000 = 73.000 + 28.000 → khoản nợ thật đặt nhầm tên) → **đổi tên "Khách không rõ (04/11)"**, giữ tiền (anh chọn "Giữ khoản, đổi tên").
  - Đã giải thích, không phải làm: tồn quỹ lệch (A-09) — ĐK nay đã khớp sổ cũ; HS dư 5.000 từ 07/11 do ca Chiều 07/11 nhân viên ghi tiền mở ca 1.650.000 còn máy Fabi 1.645.000 (ca chưa xác nhận Fabi → ô Tiền mở ca sẽ đỏ khi quản lý xác nhận). 5 ca LHP lệch chuyển khoản (A-16): anh đã tạo phiếu, coi như xong.
  - Bài thử: Postgres cục bộ `kiem_tra/chot_thang_159_cuc_bo.sql` (12), `kiem_tra/luan_chuyen_160_cuc_bo.sql` (8), `kiem_tra/sua_du_lieu_161_cuc_bo.sql` (7); trình duyệt `flow_ct` (khung ở Tất cả + cơ sở; sửa bước dựng dữ liệu cũ thiếu mục Nhập hàng nên trước đây tháng không chốt được), `flow_stc17` (chu / qlt / ql × 2 khung); bó máy chủ thật (chụp trước → 159 / 160 / 161 ×2 → kiểm 8 dòng: 250 ca khác 0 đổi, Chốt tháng các cơ sở khác giữ nguyên).
- **Chặng 2 sau buổi rà soát "Kiểm tra app lần 1" (anh Tiến chốt 21/11 tối, 6 câu; web 2026.11.21.5; máy chủ `156_fabi_trong_doanh_thu.sql`, `157_lech_ao_giao_ket.sql`, `158_tra_ve_ca_web_tu_ghi.sql`)**
  - **Tệp Fabi có nhưng máy không có số doanh thu** (net / tm / ck trống — 4 ca: LHP Chiều 04/11; Lela Sáng 04, 07, 13/11): ô Doanh thu ở bước 1 ghi **"Fabi không có số doanh thu"** (không còn "Fabi 0"), "Máy Fabi ghi: không có số"; **vẫn chặn Xác nhận Fabi**; không có nút "Lấy số máy Fabi" ở ô đó (máy chủ cũng chặn — trước đây nút này làm trống doanh thu của phiếu và ô so "trống = trống" thành khớp). Quản lý bấm **"Sai, sửa số"**, ghi bán tiền mặt + bán chuyển khoản **theo phiếu máy in** (hộp để trống, không điền sẵn 0) → **Chủ duyệt** (anh chốt: phải qua Chủ). Ô Nợ của ca đó có lời nhắc "tệp Fabi ca này thiếu số — nợ máy ghi chưa chắc đúng"; nợ thật khác thì "Máy ghi sai? Sửa số" (anh chốt khoản nợ 84.000 của ca LHP chiều 04/11 là có thật — quản lý ghi lại theo cách này, không sửa tay dữ liệu). Doanh thu = TM + CK + nợ bill: nợ sai thì sửa ô Nợ trước rồi mới sửa Doanh thu. Máy có số tiền đầu ca trống: ô Tiền mở ca cũng chặn lấy số.
  - **107 ca cũ trả về chờ quản lý xem** (anh chốt "Trả về cho quản lý xem"): ca có dấu Hoàn thành chạy bù lúc lên bản 6 bước mà kết quả tiền mặt + chuyển khoản do web tự ghi (ĐK 29, HS 34, LHP 9, Lela 35; 01→17/11; đều khớp tiền) → bỏ dấu Hoàn thành, ca về 🔵; quản lý mở từng ca, tích các mục, bấm Hoàn thành. Không đổi kết quả tiền, sổ tháng, nợ (nợ của các ca này vẫn coi như đã xếp từ bước 172). Bản sao ở bảng `stc_ca_done_tra_ve` (quay lại được). Ca có người xác nhận / bấm Hoàn thành thật: giữ nguyên. 3 ca Lela Fabi trống nằm trong số này → cũng nhập tay như trên.
  - **Lệch ảo khi giao két** (anh chốt "Sửa"): ca trước **Thu theo ca** mà ca sau đếm lệch tiền gối đầu → lệch = số ca sau đếm − gối đầu (trước đây so với cả két ca trước: thiếu 30.000 hiện thành 330.000). Ca sau mở đúng gối đầu: y như cũ ("rút quỹ" = két ca trước − gối đầu, khung So với trang cũ không đổi). Ca trước Thu cuối ngày: không đổi. Mức cho phép khi giao két vẫn là 0 (tệp 41).
  - **Cách thu tiền két** (anh chốt "Tuỳ ngày, quản lý tự chọn"): giữ nút Thu theo ca / Thu theo ngày ở từng ca, **không đổi mặc định** (chưa chọn = thu cuối ngày → ca giữa ngày không có ô đếm tiền mặt; muốn đếm thì bấm "Thu theo ca").
  - **Bản 6 bước đã chốt** (anh chốt 21/11): từ nay chỉ sửa lỗi, không đổi cấu trúc; phần thêm phiếu trong ca (đợt D) để sau chốt tháng 11. Sửa 2 lỗi nhỏ: "+ Thêm phiếu" giữ ca đã chọn khi đổi Loại qua lại (trước bị về "Ngoài ca"); dòng "Còn thiếu" của Xác nhận Fabi bấm được (ô đỏ / số sửa → bước 1; chưa nhập tiền mặt → tới ô nhập).
  - Bài thử: `kiem_tra/so_thu_chi_tinh_dot16.mjs` (15), `flow_stc15`, `flow_stc16` (chu / qlt / ql × 2 khung), Postgres cục bộ `kiem_tra/fabi_trong_156_cuc_bo.sql` (6), `kiem_tra/lech_ao_157_cuc_bo.sql` (6), `kiem_tra/tra_ve_158_cuc_bo.sql` (6); bó máy chủ thật `kiem_tra/chang2_156_158_truoc.sql` → 156 / 157 / 158 ×2 → `kiem_tra/chang2_156_158.sql` (sổ tháng 5/5, 251 ca 0 khác, 107/107 ca trả về).
- **Bước 173 · đợt C (phần 2) — lệch tiền khi giao ca: "Hai ca cùng chịu" (anh Tiến chốt 20/11 khuya; máy chủ `154_giao_ca_chia_doi.sql` — ĐÃ chạy thật 22:10 21/11, LÊN WEB 2026.11.21.3 lúc 22:28 21/11)**
  - Ô Tiền mở ca ở bước 1 đỏ vì **thiếu** so với số phải là → 3 nút: **Ca trước ghi sai** · **Hai ca cùng chịu** · **Ca này ghi sai**. Hai ca cùng chịu = chia đôi tiền thiếu, **số lẻ ca này chịu** (thiếu 25.001 → ca trước 12.500, ca này 12.501); mỗi ca có dòng Chênh lệch tiền mặt bằng phần của mình. **Thừa** thì vẫn chỉ chọn một ca (không có nút chia đôi). Lý do bắt buộc; Huỷ chọn để chọn lại.
  - **Ca trước Thu theo ca cũng chọn được** Ca trước ghi sai / Hai ca cùng chịu (trước bị chặn). Khi đó số quản lý đếm và tiền đã nộp quỹ của ca trước giữ nguyên; tiền thực nhận của ca trước = số quản lý đếm + phần ca trước chịu, phần thiếu thành dòng Chênh lệch tiền mặt của ca trước. Ca trước đã chốt ca thì không chọn được Ca trước ghi sai / Hai ca cùng chịu (như cũ).
  - **Một cách tính duy nhất:** trước đây trang Xác nhận Fabi còn tự cộng "lệch giao két" (ca sau đếm két lúc nhận lệch → tự tính cho ca trước) song song với nút chọn ai chịu → chọn xong bị trừ 2 lần. Từ tệp 154: ca sau đã chọn ai chịu (từ nay) thì chỉ tính theo lựa chọn đó, Xác nhận Fabi và sổ tháng ra cùng một số. Các lần chọn trước tệp 154 và ca chưa chọn: giữ nguyên cách cũ (không đổi số ca cũ).
  - Sửa kèm lỗi cũ: "Ca trước ghi sai" khi ca trước (Thu cuối ngày) chưa có bản đối soát → tiền của ca trước ra trống; nay giữ đủ phiếu.
  - Bài thử: `kiem_tra/giao_ca_154_cuc_bo.sql` (7 dòng, Postgres cục bộ), `kiem_tra/so_thu_chi_tinh_dot15.mjs` (12), `flow_stc14` (chu / qlt / ql × 2 khung); `flow_stc4` sửa theo luật mới (ca trước thu theo ca chọn được Ca trước ghi sai).
- **Bước 173 · đợt C (phần 1) — máy Fabi ghi sai: sửa số + Chủ duyệt (thiết kế 6 bước mục 7; ĐÃ LÊN WEB 2026.11.20.6 tối 20/11, máy chủ `153_sua_so_fabi.sql`)** — kế hoạch `tai_lieu/superpowers/plans/2026-11-20-doi-soat-6-buoc-dot-c.md`.
  - Ở bước 1, ô Tiền mở ca / Doanh thu / Nợ bill có **Sai, sửa số** (khi đỏ) hoặc **Máy ghi sai? Sửa số** (khi xanh): ghi số đúng + lý do (ô Doanh thu 2 số: bán tiền mặt, bán chuyển khoản; doanh thu = TM + CK + nợ bill). Quản lý gửi → ô vàng "chờ Chủ duyệt" + **Bỏ sửa**; Chủ thấy **Duyệt / Từ chối** (từ chối ghi lý do). **Chủ tự sửa = duyệt ngay.**
  - Duyệt → số đã duyệt ghi vào phiếu (giống "Lấy số máy Fabi"), ô xanh "✓ Chủ đã duyệt số X (máy ghi Y)"; tiền của ca tính theo số đó (tiền của ca vốn tính từ số trên phiếu, không từ file Fabi — không đổi công thức). Từ chối → ô đỏ "✗ Chủ từ chối" + **Sửa lại số** / **Bỏ sửa, lấy số máy Fabi**. Bỏ số đã duyệt: chỉ Chủ.
  - Đang chờ / bị từ chối → **chặn Xác nhận Fabi** (vùng khoá `app_stc_ds_close`), ca 🟠 "Chờ Chủ duyệt số sửa". Chỉ sửa khi ca chưa Xác nhận Fabi. Kế toán tải lại file Fabi không xoá số đã duyệt. Thông báo cho Chủ khi có số sửa mới, cho người gửi khi Chủ quyết.
  - Ô Nợ bill được duyệt chỉ đổi tổng nợ bill trên phiếu, **không** tự sửa danh sách khách nợ hoá đơn (còn để ngỏ).
  - ~~Chưa làm (chờ anh Tiến): "Ca trước ghi sai" khi ca trước Thu theo ca~~ — anh chốt 20/11 khuya, làm ở phần 2 (ngay trên).
- **Bước 172 · đợt B (phần quản lý) — người nợ thật + xếp nhóm công nợ (thiết kế mục 8, anh Tiến chốt 20/11; ĐÃ LÊN WEB bản 2026.11.20.5 khuya 20/11, máy chủ `151_nguoi_no.sql` + `152_sua_no_cua_ca.sql` đã chạy)** — kế hoạch `tai_lieu/superpowers/plans/2026-11-20-doi-soat-6-buoc-dot-b.md`.
  - Mỗi cơ sở có **danh sách người nợ thật**: tên, SĐT, nhóm (Nợ khách hàng / Nợ kho tổng / Nợ khác), còn dùng hay không. Sổ chi › 👥 Người nợ: thêm, sửa, ngừng dùng; **"Kho tổng" luôn có**, không đổi tên, không ngừng dùng. Danh sách ban đầu lấy từ tên đang có trong sổ (nhóm kho / khác lấy hết; nhóm khách chỉ tên còn nợ). Bỏ ô ✓ "không nhắc": Nợ khách hàng thì phiếu chốt ca nhắc thu, hai nhóm kia không nhắc.
  - **Nợ ghi NGOÀI phiếu ca chỉ nhận tên đang dùng trong danh sách** — máy chủ từ chối tên lạ kèm câu chỉ chỗ thêm người. Ở Sổ thu chi (Cho nợ, Sửa cho nợ, đổi người nợ, người nợ phần chênh khi Lấy số máy Fabi) là **ô chọn**, cuối ô có "+ Thêm người nợ…". Ba hộp ở trang khác (đổi khoản chi thành nợ, Công nợ › Ghi nợ, Đối soát ca › Ghi nhận nợ) còn là ô gõ có gợi ý + dòng nhắc — **việc còn lại của đợt B**.
  - **Quản lý xếp nợ ở bước 1 của ca**: mỗi khoản nợ mới còn tiền chưa thu phải chọn người trong danh sách + nhóm công nợ rồi bấm **Xếp** (tên khớp thì web gợi ý sẵn, vẫn phải bấm). Tên theo danh sách; chữ nhân viên gõ được giữ thành dòng "NV ghi: …". Mục "Nợ mới của ca đã xếp đúng người + nhóm công nợ" tự tích khi xếp hết. **Chưa xếp hết thì không Hoàn thành được; không chặn Xác nhận Fabi.** Khoản đã trả không cần xếp. Ca đã Hoàn thành thì khoá xếp (Mở lại trước). Nhân viên sửa lại tên khoản đã xếp → khoản đó về chưa xếp.
  - Nợ của các ca đã Hoàn thành trước ngày phát hành coi như đã xếp.
  - **Sửa khoản nợ của ca ở bước 1** (gộp vào đợt B, anh Tiến duyệt 20/11 khuya; máy chủ `152_sua_no_cua_ca.sql`): với khoản nợ **tiền mặt (khách mượn)** và **chuyển khoản** ghi trong ca, người đối soát được ca bấm **Sửa / Xoá**: sửa số tiền, đổi Tiền mặt ↔ Chuyển khoản, xoá, đổi khách mượn thành **Luân chuyển TM – CK** (khách chuyển khoản rồi rút tiền mặt); **+ Thêm khoản nợ quên ghi** (người nợ chọn trong danh sách, coi như đã xếp). Lý do bắt buộc, quản lý sửa thẳng không qua Chủ, sửa được tới khi Hoàn thành (trước và sau Xác nhận Fabi). **Không sửa nợ hoá đơn** (số theo ô Nợ bill) và khoản khách đã trả (Huỷ thu trước). Tiền phải có và số lệch bước 5 tự tính lại. Dòng hiện "Quản lý sửa · số cũ → số mới · ai · lý do" / "Quản lý ghi"; khoản đã xoá / đã đổi hiện gạch ngang. Dòng Khách mượn / Nợ CK ở bước 4 và Sổ chi chỉ về bước 1; dòng Lương trả tiền mặt chỉ sang Đối soát ca › Ai làm ca.
  - Tab Công nợ › đổi tên / nhóm cho cả các khoản của một người vẫn làm được như cũ: danh sách người nợ đổi theo (tên mới chưa có thì người đó được đổi tên, giữ nguyên; tên mới đã có thì các khoản về người đó).
  - **Chưa làm:** phiếu chốt ca của nhân viên (ô chọn khách, "Nợ khách (chung)", ô Nội dung bắt buộc) — chờ anh Tiến chốt bản mẫu phiếu chốt ca 8 bước; nhân viên vẫn gõ tên như cũ và máy chủ chưa chặn tên gõ tay trong phiếu ca.
  - Bài thử: `kiem_tra/nguoi_no_151_cuc_bo.sql` (22 dòng), bó máy chủ thật `kiem_tra/nguoi_no_151_truoc.sql` + `kiem_tra/nguoi_no_151.sql`, `kiem_tra/so_thu_chi_tinh_dot13.mjs`, `flow_ds172` (chu / qlt / ql, máy tính + điện thoại).
- **Bước 171 · đợt A — Đối soát thu chi của ca đi 6 bước (anh Tiến chốt 20/11 qua bản thử; ĐÃ LÊN WEB bản 2026.11.20.3 tối 20/11, máy chủ `150_doi_soat_6_buoc.sql` đã chạy)** — thiết kế `tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md`, kế hoạch `tai_lieu/superpowers/plans/2026-11-20-doi-soat-6-buoc-dot-a.md`, bản thử https://claude.ai/artifact/QyHZdbGbWA2VbF1fs3vajW. Thay cách bày A · Fabi / B · Thu chi của bước 151 / 168:
  - Mở một ca ở Đối soát Fabi đi **6 bước**: ① Số máy Fabi → ② Tiền thực nhận (cuối bước có nút **Xác nhận Fabi** — tên mới của nút "🔒 Hoàn thành đối soát ca" ở bước 168; điều kiện bấm không đổi) → ③ Khoản thu → ④ Khoản chi → ⑤ Chênh lệch → ⑥ **🔒 Hoàn thành đối soát ca**. Bước 3–5 khoá tới khi Xác nhận Fabi. Thanh đáy: ‹ Quay lại · "Bước này còn N mục" · Tiếp ›. Đường dẫn thêm `b=1..6` để mở đúng bước.
  - Mỗi bước có khung vàng **"Quản lý cần kiểm tra ở bước này"**; số của mục đặt cạnh chỗ cần xem. Mục web tự tích: ô Tiền mở ca / Doanh thu / Nợ bill khớp, đã nhập tiền mặt (Thu theo ca), có số ngân hàng, tiền đóng ca = tiền mở ca sau (Thu cuối ngày, không phải ca cuối), đã Xác nhận Fabi, mọi khoản chi có nhóm, lệch tiền mặt / chuyển khoản đã có cách xử lý. Mục quản lý bấm tích (web lưu ai, lúc nào): ảnh phiếu Fabi đúng số máy; đã hỏi về hoá đơn sửa / xoá (khi có); két để lại 1.000.000 (Thu theo ca hoặc ca cuối ngày); thu nợ đúng khách (khi có thu nợ); không sót khoản thu; khoản chi có thật (khi có khoản chi); đã xem khoản từ **300.000** (khi có); đã hỏi lý do lệch (khi lệch > 5.000). Lệch chưa xử lý ngay được: bấm **Để sau**.
  - **Bắt tích đủ mới Hoàn thành**; máy chủ tự kiểm lại. **Ca chỉ thành "Đã đối soát" sau nút Hoàn thành** (trước đây tự thành ngay khi Xác nhận Fabi) — áp cho mọi đường (kể cả ca web tự đối soát, quản lý tự chốt): ca đó hiện **🔵 Đã xác nhận Fabi** ở lịch, danh sách bên và Việc cần làm. Còn lệch chờ xử lý / chờ Chủ duyệt → 🟠; hết → 🟢. Ca đã xác nhận Fabi trước ngày phát hành được chạy bù coi như đã hoàn thành.
  - Ca **đã Hoàn thành thì khoá** thêm / sửa / xoá phiếu, tiền mặt đếm, cách thu (cả ở Sổ thu / Sổ chi); bấm **Mở lại** ở bước 6 (giữ các mục đã tích). Mở lại xác nhận Fabi cũng bỏ dấu Hoàn thành.
  - **Sổ thu / Sổ chi với ca đã Hoàn thành**: đầu ca có dòng "🔒 Ca đã hoàn thành đối soát: Mở lại ở bước 6 mới thêm / sửa được · Xử lý ca này ở Đối soát Fabi ›"; từng phiếu không có nút Sửa / Xoá, → Trừ lương, ô chọn nhóm; không có nút thêm phiếu vào ca. Khung **+ Thêm phiếu**: ca đã hoàn thành hiện mờ "đã hoàn thành đối soát, Mở lại mới thêm được" kèm nút "Ca …: Mở lại ở Đối soát Fabi ›" (mở thẳng bước 6). Đầu tab Đối soát Fabi thêm ô số / nhãn **🔵 Chưa hoàn thành** và danh sách bên "🔵 Đã xác nhận, chưa hoàn thành"; tab Tổng › Việc cần làm thêm dòng "Ca … đã xác nhận Fabi, chưa hoàn thành".
  - **Mục đã tích tự bỏ khi dữ liệu đổi**: phiếu thu đổi → bỏ thu nợ, không sót; phiếu chi đổi → bỏ khoản chi có thật, khoản lớn; tiền mặt đếm / cách thu đổi → bỏ gối đầu; tiền của ca đổi → bỏ lý do lệch + Để sau; kế toán tải lại file Fabi → bỏ ảnh, hoá đơn.
  - Bước 2 có khung **"Số ở bước này sai thì sửa ở đâu"** (phải có → bước 1 / 3 / 4; tiền giao ca → ô Tiền mở ca bước 1, ca nào ghi sai ca đó chịu; tiền mặt thực nhận → đếm lại; chuyển khoản → kế toán). Bước 3 / 4: mỗi phiếu ghi **Nhân viên ghi / Quản lý ghi**, khoản chi ≥ 300.000 có nhãn **Khoản lớn**. Bước 5 ghi "lệch = thực nhận − phải có".
  - Vùng khoá (đã báo anh Tiến ở mục 12 của thiết kế): vá `app_stc_ds_close`, `app__ca_auto_finish`, `app_stc_ds_reopen`; bảng mới `stc_ca_ticks`, `stc_ca_done`; hàm `app_stc_tick`, `app_stc_ds_done`, `app_stc_ds_undone`. Không đổi cách tính tiền.
  - **Bịt mọi đường tự thành "Đã đối soát"** (tìm ra khi rà mã 20/11): nút Hoàn thành ở trang Đối soát ca (`app_ca_recon_finish`) báo "Phần tiền chưa Hoàn thành: vào Sổ thu chi › Đối soát Fabi…" khi ca chưa có dấu; web tự hoàn thành khi mọi mục khớp (`app__ca_auto_green`) vẫn tự duyệt mục nhưng không tự đặt Đã đối soát. **Dấu Hoàn thành tự mất** khi kết quả Tiền mặt / Chuyển khoản của ca bị gỡ (mọi kiểu mở lại) hoặc khi số / danh sách hoá đơn sửa trong file Fabi của ca đổi (kế toán tải lại) — ca về 🔵, quản lý xem lại rồi bấm Hoàn thành lại.
  - **Chưa làm (đợt B, C, D):** danh sách người nợ + phân loại nợ; quản lý sửa số máy Fabi + Chủ duyệt; "Ca trước ghi sai" khi ca trước Thu theo ca; phiếu tạo trong ca tính vào ca. Mẫu phiếu chốt ca nhân viên 8 bước (https://claude.ai/artifact/UD59jRNyPYq22dvmzWG9KH) mới là bản mẫu, chưa chốt.
- **Bước 168 (anh Tiến giao 19/11 đêm, nhánh riêng — chờ gộp; máy chủ `147_thu_no_truoc_ca.sql` chờ chạy)** — Đối soát Fabi: chỉ đổi giao diện, **không đổi điều kiện khoá / cách tính tiền**.
  - **Điện thoại (≤ 600px)**: không tự mở ca. Chưa chọn ca: 5 ô số thành 1 hàng nhãn nhỏ, dòng giải thích gập vào "ⓘ Cách làm", các danh sách bên gập lại (tên + số đếm), lịch vẫn cả tháng. Chọn ca → phần xử lý ca lên đầu, lịch thành thanh "‹ Chọn ca khác". Máy tính giữ nguyên.
  - **Thanh cố định cuối màn hình khi mở 1 ca — nút "🔒 Hoàn thành đối soát ca"**: anh Tiến chốt 20/11 — nút **Xác nhận Fabi** đổi tên thành **"🔒 Hoàn thành đối soát ca"** và chuyển từ cuối phần A xuống thanh này (vẫn là bước xác nhận Fabi, mở phần B; trạng thái ca vẫn gọi "Đã / Chưa xác nhận Fabi"; điều kiện bấm y như cũ — `fabiNeeds` gom đúng 3 điều kiện cũ: còn ô đỏ ở ①, chờ kế toán, chưa nhập tiền mặt thực nhận). Chưa bấm được thì ghi rõ còn thiếu gì, bấm từng mục nhảy tới chỗ cần xử lý. Đã xác nhận mà còn lệch: liệt kê từng chênh lệch chưa xử lý, bấm mở đúng bảng ở phần B. Hết lệch: "🟢 Đã hoàn thành đối soát ca". (Nút "🔒 Chốt ca" đã bỏ từ bước 158 nên không có nút chốt riêng.)
  - **+ Thêm phiếu trong 1 ca**: Ngày + Ca điền sẵn đúng ca. Ca chưa xác nhận Fabi hiện mờ kèm lý do + nút "Ca …: Xác nhận Fabi ›" nhảy tới ca đó. Vẫn phải Xác nhận Fabi mới thêm vào ca được.
  - **Thu nợ chỉ nợ phát sinh TRƯỚC ca / ngày ghi thu** (nợ ca Sáng trả ca Chiều cùng ngày vẫn được; nợ quản lý ghi: trong ngày đó hoặc trước). Phiếu ngoài ca (+ Thêm phiếu thu › Thu nợ, nút Thu nợ ở Ai còn nợ): từ ngày của phiếu trở về trước. Gán nợ ở phiếu chênh lệch: theo thứ tự ca. Máy chủ chặn mọi đường ghi thu nợ (trigger `debt_order_guard` trên `shift_debts`, tệp 147) — chỉ thêm kiểm tra ngày.
- **Bước 157 (19/11, web 2026.11.19.15)** — anh Tiến: phần nợ trên phiếu Fabi phải hiện ngay ở Sổ thu chi › Đối soát Fabi (chọn cách B qua hình mẫu): ngay dưới ô **Nợ** của phần A có danh sách nợ của ca — nợ mới trong ca (HĐ / TM / CK, "đã trả" / "còn nợ X", số là số ban đầu kể cả khi bị tách) và khách trả nợ cũ trong ca. Hiện cả trước và sau Xác nhận Fabi; ca không nợ không có khung. Chỉ xem, không có nút thu. Máy chủ: tệp 140 (`app_stc_month` thêm `ca_debts`).
- **Bước 156 (19/11, web 2026.11.19.14)** — anh Tiến: trang Đối soát ca (quản lý) bỏ hẳn bước "Tiền": 4 bước nay là Ai làm ca · Nghỉ & làm thay · Bàn giao · Hoàn thành; bước Hoàn thành không còn hạng mục tiền, chỉ thẻ "Phần tiền · làm ở Sổ thu chi" (trạng thái Xác nhận Fabi, ảnh phiếu Fabi, đường dẫn) + lịch sử. Thanh bước tiến độ phiếu của nhân viên (Nhân viên · Bàn giao · Tiền · Kiểm tra) giữ nguyên.
- **Bước 154–155 (19/11, web 2026.11.19.12–13)** — anh Tiến: "giao diện / tính năng giống bản mẫu 18/11":
  - Xem lại ảnh phiếu Fabi chốt ca (mất từ bước 152): nút 📷 ở Đối soát Fabi phần A + ảnh trong thẻ Phần tiền của Đối soát ca.
  - Giao diện Sổ thu chi theo bản mẫu: dải đầu xanh rêu (tháng, cơ sở, tab hồ sơ), nút / tiêu đề chữ thường, dòng giải thích dưới ô, bảng sổ không cắt số.
  - Tính năng bản mẫu còn thiếu: chọn nhóm ngay trên dòng chi + ở Cần phân loại (ca chưa chốt; `app_tc_check` / `app_stc_entry_save`), Chi theo loại có nhóm con, ô Chênh lệch "N ca chờ xử lý", khung Ca thiếu / Ca dư bấm mở phiếu chênh lệch, dòng Cho nợ CK có Người nợ (+ Thêm người nợ…) + nhãn nhắc thu + "Đã thu · còn nợ", Quỹ ngoài "Phần mỗi cơ sở chịu" (tạm tính). Phiếu chênh lệch vẫn mở bằng hộp thoại (cùng chức năng với bản mẫu).
