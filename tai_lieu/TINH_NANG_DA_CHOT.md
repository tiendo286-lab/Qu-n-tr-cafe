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
- Anh chốt: bảng này **không báo khớp / lệch** (việc so để Đối soát). Nút ⋯ từng ô: số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm. Bỏ khung cảnh báo vàng cố định. Bảng tuần giữ nguyên.

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
