# Tính năng đã chốt — web quản lý Milano & Lela

Cập nhật: 07/11/2026 · Web: https://tiendo286-lab.github.io/Qu-n-tr-cafe/

Tên app: **Quản trị cafe**. Tông màu chủ đạo (anh Tiến chốt 07/11/2026): nâu espresso, caramel, nền kem, chữ tiêu đề kiểu có chân (Playfair Display) — định nghĩa ở cuối `docs/assets/them.css`.

Từ ngày 07/11/2026, **web là nơi duy nhất** lưu lịch, order và các dữ liệu khác. Trang web không còn chức năng nhập dữ liệu từ bản offline, nên **mọi việc sửa trên bản offline sẽ không lên web nữa**.

---

## 1. Menu của Chủ và Quản lý (10 mục)

| Mục | Tab con | Ghi chú |
|---|---|---|
| **Quản lý ca** | Chốt ca · Đối soát | Phiếu chốt ca theo ngày, đối soát 9 mục |
| **Xếp lịch tuần** | Order · Lịch cơ sở · Lịch tổng · Cảnh báo · Chốt & báo cáo | Xem bảng chi tiết ở mục 2 |
| **Công việc** | Công việc · Việc của tôi | Xem bảng chi tiết ở mục 3 |
| **Nhân viên & tài khoản** | Nhân viên · Phân quyền | Tài khoản đăng nhập nằm ngay trong danh sách nhân viên |
| **Nội quy & quy trình** | Nội quy · Quy trình | Soạn, đăng; nhân viên bấm "Tôi đã đọc" |
| **Hỗ trợ** | Yêu cầu hỗ trợ | Nhắn qua lại giữa nhân viên và quản lý |
| **Cài đặt xếp lịch** | Định biên · Chi nhánh, ca & vai trò · Giờ order · Lịch cố định | |
| **Dữ liệu & sao lưu** | — | Chỉ Chủ: xem số liệu, tải gói sao lưu ZIP |
| **Kế toán** | Hóa đơn giao hàng · Chuyển khoản thực nhận | Chỉ Kế toán và Chủ |
| **LOG hệ thống** | Tổng quan · Lịch sử cập nhật web · Lịch sử thao tác | Chỉ Chủ |
| **Của tôi** | Order ca · Lịch của tôi · Phiếu đào tạo | |

Thanh dưới trên điện thoại của nhân viên có 6 nút: **Order ca · Lịch làm · Việc · Chốt ca · Nội quy · Hỗ trợ**.

---

## 2. Xếp lịch tuần

| Chức năng | Đã chốt |
|---|---|
| Trạng thái tuần | Đang order → Đang xếp → Đã chốt → (Mở lại) Đang chỉnh sửa. Tuần đã có ca xếp mà chưa ghi trạng thái thì tính là **Đang xếp**, giống bản offline. |
| Nút "Bắt đầu xếp lịch" | Không hiện và bị máy chủ chặn khi tuần đã có ca được xếp, để không xóa mất lịch. |
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
| Tài khoản đăng nhập | **Gộp vào bảng Nhân viên**: cột Tài khoản (trạng thái, vai trò, lần đăng nhập cuối) + nút **Tài khoản ▾** (cấp mật khẩu tạm, khóa / mở khóa, đăng xuất mọi nơi). Nút **Cấp & in mật khẩu hàng loạt**. Cuối trang: **Tài khoản riêng** (kế toán, chủ thứ hai…). |
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
| 2 | Khoản âm (thiếu tiền) | Khi đối soát ra âm, quản lý **gán luôn nhân viên** chịu khoản âm đó (chia tiền từng người); web **báo cho nhân viên bị âm**. Nhân viên: trang **Khoản âm của tôi** (Đã xem, giải trình). Quản lý: tab **Khoản âm** (Chưa xử lý / Đã bù / Trừ lương / Miễn — Miễn phải ghi lý do). Mở lại phiếu cho NV sửa → khoản chưa xử lý bị hủy + báo. |
| 3 | Công nợ | Tính vào doanh thu, không nằm trong tiền mặt / chuyển khoản: Mục 1 = Mục 2 + Mục 3 + Công nợ phát sinh. Thu được nợ thì cộng vào tiền mặt / chuyển khoản của ca thu, ghi "thu nợ của ca X". |
| 4 | Tiền đầu ca lệch két cuối ca trước | Không cho hoàn thành phiếu nếu chưa ghi lý do lệch. |
| 5 | Số dư ngân hàng | Sửa ca cũ: web chỉ báo các ca sau lệch chuỗi, không tự sửa. Tiền về chậm: kế toán ghi "tiền về sau của ca X", web cộng bù vào đúng ca X. |
| 6 | Giờ bắt đầu ca Tối | Tự lấy giờ kết thúc ca Chiều (như ca Chiều lấy theo ca Sáng). |
| A | Bảng ca hôm nay | 5 cơ sở × 3 ca, ô tô màu theo trạng thái (chưa mở · đang chốt · chờ đối soát · đối soát xong · có lệch). |
| F | Phiếu ca từng bước trên điện thoại | Số liệu → Thu chi → Nhân sự → Bàn giao → Nhập hàng → Hoàn thành. |
| G | Báo cáo tuần / tháng | Doanh thu, số cốc theo cơ sở / ca, tổng khoản âm theo nhân viên, so sánh cơ sở. |

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
| Chốt tháng | Chỉ sau khi hết tháng; phải hết phiếu đang chốt dở, đối soát xong mọi ca, phân nhóm hết khoản chi ở phiếu ca. Chốt xong **khóa** phiếu ca, bản đối soát, kiểm đếm cuối ngày, chi phí của tháng đó. **Chỉ Chủ mở lại**, bắt buộc lý do, có lịch sử. |

---

## 5e. Ca FULL TIME (LHP) gộp vào ca chính — chốt và ĐÃ LÀM 09/11/2026 (tệp supabase/25_full_time.sql)

| Điểm | Anh Tiến chốt |
|---|---|
| Cách hiện | Không còn khối / cột ca FULL TIME riêng. Người **FT Sáng** (06:45–15:00) hiện trong ca Sáng, người **FT Tối** (15:00–23:00) hiện trong ca Tối, kèm nhãn tím "FT giờ–giờ". Ở ca Chiều họ hiện viền nét đứt. Ca chính nào của người FT được tính theo giờ: cùng giờ bắt đầu hoặc cùng giờ kết thúc. |
| Định biên | Người FT được tính cho **mọi ca chính chồng giờ**: FT Sáng tính cho Sáng + Chiều, FT Tối tính cho Chiều + Tối. Ca FT không có định biên riêng (ẩn ở trang Định biên). Cảnh báo "làm thông 3 ca" cũng tính theo cách này. |
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
