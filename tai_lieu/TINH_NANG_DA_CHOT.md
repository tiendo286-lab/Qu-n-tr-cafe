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
| Bản gốc quy trình (chốt 11/11/2026) | Anh Tiến viết quy trình bằng **Word (.docx)**, để trong thư mục **`quy_trinh_goc/`** cạnh code web trên máy anh. Thư mục này **KHÔNG đưa lên GitHub** (đã chặn trong `.gitignore`, kho mã công khai). Khi anh nhắn **"cập nhật quy trình"**, em xem file nào mới / đã sửa, chuyển sang trang web (giữ tiêu đề, đậm/nghiêng, danh sách, bảng, ảnh) và đưa vào mục **Quy trình** trên web (Supabase, phải đăng nhập mới đọc được) thành phiên bản mới, rồi báo anh bài nào đã thay. **File trên máy là bản gốc**: các bài đi từ thư mục chỉ để đọc trên web, không sửa trên web (Nội quy và bài khác vẫn soạn trên web như cũ). Ghép với phiếu đào tạo theo dòng "◆ Đào tạo: Ngày X · STT Y" có sẵn trong sổ tay. |
| Cách mở | Bấm vào hạng mục → **cửa sổ nổi ngay trên phiếu**, đọc xong bấm Đóng là về đúng chỗ; có nút ‹ › sang hạng mục trước / sau. |
| Ai xem | Mọi người mở được phiếu (nhân viên học, người hướng dẫn, quản lý, Chủ). |
| Sổ tay gốc (anh đưa vào 11/11/2026) | 1 file Word "Sổ tay nhân viên chạy bàn" (~40MB, 205 ảnh): Phần 1 công việc theo ca (1.1–1.7 + sơ đồ bàn), Phần 2 – 9 SOP, Phần 3 ghi nhớ, Phần 4 chương trình đào tạo 8 ngày. Mỗi thẻ công việc / bước SOP có dòng **"◆ Đào tạo: Ngày X · STT Y"** → **ghép hạng mục đào tạo với hướng dẫn theo STT** (đủ cả 68 hạng mục; có hạng mục có 2–3 thẻ, vd việc làm ở nhiều ca thì hiện hết). Phần 4 trùng 68 hạng mục trên web (tên, ngày giống hệt), chỉ khác số trang ở 51 hạng mục. |
| Cập nhật về sau | Anh sửa / thay file Word trong `quy_trinh_goc/` rồi nhắn "cập nhật quy trình" → Claude chạy `python3 -I cong_cu/cap_nhat_quy_trinh.py --xem <thư mục tạm>` (xem thử) rồi `--gui --ma <file mã sbp_>`. Chỉ bài có nội dung đổi mới lên phiên bản mới và báo cho mọi người 1 lần; ảnh đã có không tải lại. Nếu cấu trúc sổ tay đổi (thêm phần mới, đổi tiêu đề phần) công cụ sẽ báo để sửa. |
| Cách đưa lên web (chốt 11/11/2026) | **Chia nhiều bài nhỏ** trong mục Quy trình (~18 bài: Cách đọc + sơ đồ bàn · 7 bài công việc theo ca 1.1–1.7 · 9 bài SOP · Ghi nhớ); ảnh thu nhỏ cho điện thoại; **không đưa Phần 4** (đã có phiếu đào tạo). **Giữ nguyên** mục tài khoản thu ngân Fabi POS (cả mật khẩu) như sổ tay — chỉ người đăng nhập mới đọc được. **Cập nhật số trang** của hạng mục đào tạo theo sổ tay mới; mỗi lần "cập nhật quy trình" em tự so và sửa số trang. Cửa sổ hướng dẫn trong phiếu đào tạo hiện đúng thẻ của STT đó, có link mở cả bài. |

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

## 5m. Làm lại chốt ca (nhân viên) + đối soát (quản lý) — ĐANG CHỐT 12/11/2026, CHƯA LÀM (anh Tiến: "chưa viết code")

Mục tiêu anh Tiến đặt: **dễ hiểu, dễ làm, không bao giờ sai sót**.

| Điểm | Trạng thái |
|---|---|
| Nguyên tắc | (em đề xuất) Nhân viên chỉ nhập / chụp / chọn, web tự tính và so khớp; mỗi màn hình 1 việc; điền sẵn tối đa (người làm + giờ từ lịch, két từ ca trước, hàng từ hóa đơn); thiếu / sai thì chỉ rõ và không cho gửi; màn hình "Kiểm tra lần cuối" trước khi GỬI. |
| Người chốt ca | **CHỐT: 1 người chốt chính** chịu trách nhiệm cả phiếu (bỏ chia phần Tiền / Nhân sự / Nhận hàng); người khác trong ca chỉ giúp phần nhận hàng. **CHỐT (a):** người đầu tiên trong ca bấm "Tôi chốt ca này" là người chốt chính; quản lý đổi người được. |
| Đếm tiền | **CHỐT: không đếm theo mệnh giá trên web** — tiền đã đếm trên **Fabi POS**. Web chỉ lấy số trên phiếu chốt ca Fabi + ảnh phiếu. Các ô nhập trùng tên / thứ tự với phiếu Fabi (anh đã gửi ảnh mẫu 12/11). **CHỐT (a): bỏ đếm mù khi nhận két** — nhân viên nhập "Số dư đầu" trên phiếu Fabi, web so với "Tổng tiền" thực tế trong két của ca trước; lệch → báo đỏ, bắt ghi lý do. |
| Phiếu Fabi (iPOS) có những dòng | Mở ca · Đóng ca (POS) · Số dư đầu · Doanh thu (Gross) · giảm giá / chiết khấu / phí / VAT / phiếu giảm giá · **Doanh thu (NET)** · Số hóa đơn · Phương thức thanh toán (**CHUYỂN KHOẢN**, **Tiền mặt**, …) · Tiền trong két: Số dư (= số dư đầu + tiền mặt) · Doanh thu theo nhân viên · Nhóm món · Số tiền thực tế trong két theo mệnh giá → **Tổng tiền** · **Tiền chênh lệch**. Fabi KHÔNG biết khoản chi / thu ngoài trong ca → chi từ két làm "Tiền chênh lệch" âm. |
| File Excel xuất từ Fabi (anh gửi 12/11) | (1) **list_shift_report.xlsx** — mỗi cơ sở 1 sheet (tên sheet "<mã cửa hàng>-<tên cơ sở>", dòng 1 "Báo cáo được tính từ … tại <cơ sở>"), mỗi ca 1 dòng: Mã ca · Nhân viên (tài khoản thu ngân) · Số dư đầu ca · **Số dư cuối ca** (= số dư đầu + tiền mặt POS, tức tiền PHẢI CÓ) · Doanh thu (net) · **Tổng tiền nhận** (= tiền ĐẾM THỰC TẾ theo tờ) · Tổng hoá đơn · Tổng số khách · Thời gian mở / đóng ca; dòng cuối "Tổng". Suy ra: tiền mặt POS = cuối − đầu; chuyển khoản = net − tiền mặt (khi chỉ có 2 phương thức); chênh lệch = nhận − cuối. Số dư đầu ca sau = Tổng tiền nhận ca trước; ca đầu ngày cả 4 cơ sở = 1.000.000 (ngày 11/11). (2) **shift_report_detail_<mã ca>.xlsx** — 1 ca: Mã ca / Mở / Đóng / NV · TIỀN TRONG KÉT (Số dư đầu ca, Số dư cuối ca) · CHỈ SỐ DOANH THU (… Doanh thu (net), Tổng số hoá đơn) · PHƯƠNG THỨC THANH TOÁN (CHUYỂN KHOẢN, Tiền mặt, TỔNG) · DOANH THU THEO THIẾT BỊ · MÓN · NHÓM MÓN · NGUỒN ĐƠN · CTKM · THÔNG TIN TỜ TIỀN (mệnh giá, số lượng, tổng). Chưa thấy phương thức "nợ". |
| Màn hình tiền (em đề xuất) | Chụp phiếu trước → nhập lần lượt theo phiếu: Đóng ca (POS) · Số dư đầu · Doanh thu (NET) · Chuyển khoản · Tiền mặt · Tổng tiền · Tiền chênh lệch. Web kiểm tra gõ đúng: Chuyển khoản + Tiền mặt (+ phương thức khác) = NET; Tổng tiền − Số dư đầu − Tiền mặt = Tiền chênh lệch (sai → "gõ nhầm 1 số"). Sau đó: Tiền chênh lệch phải giải thích hết bằng thu / chi tiền mặt trong ca; còn lại khác 0 → LỆCH (ghi lý do). Còn hỏi: bỏ mục "Chuyển khoản thực tế" của nhân viên (kế toán đã nhập)? thay "Số cốc" bằng "Số hóa đơn"? khách nợ ghi trên Fabi thế nào? ca đầu ngày so số dư đầu với gì? |
| Khoản chi trong ca | **CHỐT: không cần ảnh hóa đơn chi.** |
| Lệch tiền | **CHỐT: không cho phép lệch** — lệch 1đ cũng là LỆCH (nhân viên ghi lý do, quản lý xử lý). |
| Chế độ tập dượt (phiếu giả cho NV mới) | **ĐỂ SAU.** |
| Quản lý đối soát | (em đề xuất, chờ duyệt) Đèn xanh / đỏ: Nhân sự (đúng lịch → xanh; nghỉ / làm hộ → đỏ, phân loại x2 như 5l) · Tiền (ảnh phiếu Fabi hiện cạnh số nhân viên nhập; khớp → xanh) · Thu chi (chọn nhóm) · Hàng (khớp hóa đơn + đủ ảnh → xanh). Nút "Duyệt các mục xanh"; hết đỏ mới HOÀN THÀNH. |
| Chống quên | (em đề xuất) Bảng ca hôm nay ghi rõ bằng chữ còn thiếu gì (vd "Còn thiếu: ảnh phiếu, giờ về của Lan"); giữ nhắc 30 phút trước hết ca rồi mỗi giờ. |

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
