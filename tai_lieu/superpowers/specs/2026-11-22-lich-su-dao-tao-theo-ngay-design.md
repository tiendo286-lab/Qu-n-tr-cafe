# Phiếu đào tạo: lịch sử theo ngày thật — bản thiết kế (đã chốt)

- Người đề xuất: anh Tiến, 20/11/2026 21:01–21:08 (lúc rà lại phần Đào tạo).
- Anh duyệt 8 điểm Claude đề xuất thêm: 21/11/2026 00:47 ("8 điểm được hết").
- Anh chốt làm (chặng 4, 22/11/2026):
  - "Làm luôn cả màn hình tab theo ngày".
  - Màn hình thì "Gửi ảnh, anh duyệt rồi lên": em gửi ảnh máy tính + điện thoại, anh duyệt xong mới đưa lên web.
- Bản nháp cũ: `work/thiet_ke_lich_su_dao_tao_theo_ngay.md` (không lưu git). Tệp này thay thế bản nháp đó.
- Chia hai đợt:
  - **Đợt 1 — máy chủ:** tệp `163_lich_su_dao_tao.sql`, lên cùng chặng 4 phần 1. Lưu sớm ngày nào thì có lịch sử từ ngày đó.
  - **Đợt 2 — màn hình phiếu:** `docs/js/pages/phieu_dao_tao.js`. Chỉ lên web sau khi anh duyệt ảnh.

## 1. Vì sao làm

Lời anh Tiến: "đào tạo 8 ngày là sườn nhưng trong quá trình thực tế sẽ có sự thay đổi nên dùng tab theo ngày thực tế sẽ chuẩn nhất".

Phiếu cũ chia theo ngày của giáo trình, nên thiếu ba thứ:
- không cho biết thực tế ngày nào dạy được gì, ai dạy;
- không giữ lại các lần đào tạo lại;
- `training_marks` chỉ có một dòng cho mỗi hạng mục, người và giờ bị ghi đè mỗi lần lưu.

## 2. Đã chốt

**Anh Tiến (20/11):**
1. Bấm vào phiếu thấy lịch sử theo ngày: Ngày 1 (ngày tháng) đào tạo được gì, Ngày 2, Ngày 3…; "Ngày tiếp theo" hiện toàn bộ hạng mục chưa đào tạo.
2. Mỗi ngày một **tab riêng**.
3. **Ai tích cũng lưu lịch sử, kể cả đào tạo lại.** Ai tích thì hiện tên người đó.
4. Ô nhận xét và hai lần xác nhận (người học, người hướng dẫn) **gắn theo ngày đào tạo thật**.
5. Tab theo ngày thật; 8 ngày giáo trình chỉ là sườn.

**Claude đề xuất, anh duyệt 21/11 00:47:**
1. Ngày không ai tích thì không có tab.
2. Lưu cả lần bỏ tích và đổi mức, không chỉ lần tích.
3. Đào tạo lại hiện ở cả ngày cũ lẫn ngày dạy lại.
4. Tab "Ngày tiếp theo" = hạng mục chưa có mức đạt. Mục chờ kiểm tra nằm ở tab ngày Cấp 1 đã ghi.
5. Giữ sườn 8 ngày làm gợi ý trong tab "Ngày tiếp theo".
6. Người học xem được lịch sử.
7. Xác nhận kiểu cũ trên phiếu dở dang giữ lại, chỉ xem.
8. Phiếu cũ chỉ có một dòng lịch sử cho mỗi hạng mục (lần ghi gần nhất).

**Không làm**
- Không đổi quyền: ai giao, ai ghi, ai xác nhận đạt vẫn theo luật bước 169.
- Không đổi cách tính số hạng mục đạt hay trạng thái phiếu.
- Không đổi tab Phân công / Chờ kiểm tra (bước 170), giáo trình, Việc của tôi.
- Không dựng lại lịch sử chi tiết cho phiếu cũ (không có dữ liệu).
- Không đụng vùng khoá tiền đối soát.

## 3. Máy chủ — tệp 163 (đợt 1)

**Sổ lịch sử `training_mark_log`**
- Cột: phiếu, số hạng mục, `at` (giờ VN), `day` (ngày VN của lúc ghi), người ghi, `kind`, `old` / `new` = {introduced, practiced, level}, `pending`, `gd2`, `note`.
- Các loại `kind`:
  - `gioi_thieu`, `thuc_hanh`, `muc`, `xac_nhan`, `bo_tich`, `dao_tao_lai`;
  - `ghi_cu` = dòng chạy bù cho phiếu có trước.
- Chỉ thêm dòng, không có hàm sửa / xoá. Bật RLS, thu hồi quyền; web đọc qua `app_dt_history`.

**Trigger `training_marks_log` sau mỗi lần thêm / sửa `training_marks`**
- Ghi một dòng cho mọi đường đổi: `app_dt_mark`, `app_dt_check_ok` và các hàm sau này.
- Lưu lại y nguyên (không đổi gì) → không ghi.
- Tích lúc 23:30 giờ VN thuộc đúng ngày đó.
- Xác nhận đạt (mục đang chờ kiểm tra được xác nhận) → `xac_nhan`, mang tên người xác nhận.

**Đào tạo lại**
- `app_dt_mark` nhận `p.relearn = true` → luôn ghi `dao_tao_lai`, kể cả khi ra đúng mức cũ.
- Người được giao giai đoạn 2 ghi lại mức (đã có mức cũ) → cũng là `dao_tao_lai`.

**Chạy bù `app__dt_log_backfill()`**
- Mỗi hạng mục đang có số liệu mà chưa có dòng nào → một dòng `ghi_cu` theo lần ghi gần nhất.
- Mục đã có Xác nhận đạt → thêm một dòng `xac_nhan`.
- Chạy lại không nhân đôi. Lúc chạy thử trên máy chủ thật: 290 dòng.

**Nhận xét + xác nhận theo ngày thật**
- Lưu ở `training_day_notes` (phiếu, ngày `YYYY-MM-DD`).
- Hàm `app_dt_dnote_comment` / `app_dt_dnote_confirm`, cùng quyền với `app_dt_day_comment` / `app_dt_day_confirm`:
  - người học xác nhận phần mình;
  - người hướng dẫn / người có quyền Đào tạo xác nhận phần người hướng dẫn.
- Chỉ nhận ngày đã có ít nhất một dòng lịch sử.
- Phiếu đã có nhận xét cuối thì khoá.
- `training_days` (theo ngày giáo trình) giữ nguyên, không ghi thêm.

**Xem: `app_dt_history(p_id)`**
- Trả `{log, notes}`, kèm tên người.
- Cùng điều kiện xem phiếu như `app_dt_get`, nên người học xem được.
- `app_dt_get` **không đổi**.

**Bài thử:** `kiem_tra/lich_su_dao_tao_163_cuc_bo.sql` (13 mục). Bài cũ 148 (28), 149 (16), 155 (6) vẫn đạt.

## 4. Màn hình phiếu (đợt 2)

Phần đầu phiếu, thanh tiến độ và phiếu đánh giá cuối khoá giữ nguyên. Các khối "Ngày 1…8 của giáo trình" được thay bằng:

**Thanh tab**
- Thứ tự: `Ngày 1 · dd/mm | Ngày 2 · dd/mm | … | Ngày tiếp theo · còn N`.
- Ngày 1, 2, 3… là các ngày thật có ít nhất một dòng lịch sử, đánh số theo thứ tự thời gian. Hôm nay có thêm chữ "· hôm nay".
- "còn N" = số hạng mục chưa có mức đạt, cập nhật ngay khi chấm.
- Điện thoại: thanh tab cuộn ngang trong khung, tab đang mở nằm giữa. Trang không tràn ngang.
- Mở phiếu: vào "Ngày tiếp theo" nếu còn hạng mục chưa có mức, không thì vào ngày gần nhất.

**Mỗi hạng mục chỉ có MỘT hàng để sửa (`.dt-item`)**
- Chưa có mức → hàng nằm ở tab "Ngày tiếp theo", xếp theo sườn ngày 1…8 (sườn chỉ là gợi ý).
- Đã có mức (kể cả đang chờ kiểm tra) → hàng nằm ở tab ngày gần nhất có hoạt động. Cuối hàng có các dòng lịch sử của ngày đó (giờ · việc · người).
- Ở các ngày khác, hạng mục là **thẻ chỉ xem** (`.dt-hcard`), gồm:
  - dòng lịch sử của ngày đó;
  - "Hiện tại: …";
  - "đào tạo lại ngày dd/mm" nếu đã dạy lại sau;
  - "→ … xác nhận đạt dd/mm" nếu được xác nhận vào ngày khác;
  - nút "Xem ở <tab> ›" để sang đúng hàng.
- Hàng đã có mức có nút **"↻ Đào tạo lại"**, theo quyền ghi hiện có:
  - hộp chọn mức (Trung bình / Khá / Tốt / Hủy);
  - giữ nguyên mức cũ cũng được — vẫn thành dòng "↻ Đào tạo lại" của hôm nay.
- Ô chọn mức vẫn đổi trực tiếp được (ghi "Mức đạt cũ → mới").

**Lưu tại chỗ, hàng không nhảy dưới tay**
- Chấm ở tab "Ngày tiếp theo": lưu ngay tại hàng như cũ. Hàng vẫn nằm ở tab đó tới lần mở phiếu sau, kể cả khi đã có mức, để danh sách không xô lệch khi đang bấm.
- Chấm lần đầu trong một ngày chưa có tab → thêm tab tạm "Ngày K · dd/mm · hôm nay".
- Bấm sang một tab ngày sau khi đã chấm → phiếu tải lại lịch sử, giữ chỗ cuộn và giữ các hàng của "Ngày tiếp theo".
- Sửa ở một tab ngày (đào tạo lại, đổi mức, bỏ tích), Xác nhận đạt, đổi phân công, xác nhận ngày → phiếu vẽ lại ngay, giữ tab và chỗ cuộn.
- Nếu lần dạy thuộc ngày khác với tab đang xem, báo "hạng mục chuyển sang tab của ngày đó".

**Bộ lọc hạng mục** (giữ nguyên các lựa chọn)
- Đang lọc: ẩn thanh tab, hiện mọi hàng khớp, xếp theo ngày, kèm số đếm "N/68 hạng mục".
- Chọn "Tất cả" → về lại tab đang xem.

**Cuối mỗi tab ngày thật**
- Ô "Nhận xét của người hướng dẫn · dd/mm/yyyy", ghi tên người viết.
- Hai nút "Nhân viên xác nhận" / "Người hướng dẫn xác nhận". Đã xác nhận thì hiện tên + giờ.

**Ngày 8 của sườn** (ca làm độc lập, ngày, hạng mục ôn lại): tách thành một thẻ riêng dưới thanh tab.

**Nhận xét / xác nhận theo ngày giáo trình đã ghi trước khi đổi:** một khối thu gọn, chỉ xem.

**Không tải được lịch sử:** báo vàng "Chưa tải được lịch sử theo ngày — phiếu vẫn chấm được". Hạng mục có số liệu mà sổ chưa có dòng nào hiện một dòng "Ghi trước khi có sổ" theo lần ghi gần nhất.

## 5. Kiểm tra

- **Máy chủ:** `kiem_tra/lich_su_dao_tao_163_cuc_bo.sql` (13) trên Postgres cục bộ. Chạy thử trên máy chủ thật trong khối tự hoàn tác: 6 phiếu, `app_dt_get` không đổi, quyền + sổ tệp đúng.
- **Trình duyệt:** `flow_dt_c4` (mới), 6 vai × máy tính + 390px:
  - vai: Chủ, HD chính, Cấp 1, người học, người phụ trách chính, Quản lý khác;
  - hỏng trên bản cũ;
  - kiểm: tab đúng ngày, 1 hàng / hạng mục, thẻ chỉ xem + "Xem ở …", lọc, chấm tại chỗ, tải lại khi mở tab ngày, đào tạo lại cùng mức vẫn ghi, nhận xét + xác nhận theo ngày thật có tên, Cấp 1 ghi → "chờ kiểm tra", Xác nhận đạt, phiếu mới → tab tạm của hôm nay, nhận xét kiểu cũ chỉ xem, không tràn ngang.
- **Bài cũ chạy lại:**
  - Chỉ sửa chỗ trỏ vào khối ngày giáo trình đã bỏ, không sửa nội dung kiểm: `flow_dt169` (5 vai), `flow_dt`.
  - Chạy lại không sửa: `flow_dt137`, `flow_dt170`, `flow_hn142`, `flow_dg`, `flow_dlg`.
- **Giả lập:** `dt_gia.js` ghi sổ giống trigger. `app__test_dt_demo` dựng phiếu mẫu 3 ngày để chụp ảnh.

## 6. Em đã tự quyết (anh muốn khác thì bảo)

1. Ghi sổ bằng trigger trên `training_marks` (không sót đường nào), không ghi trong từng hàm.
2. Báo "đào tạo lại" xuống máy chủ bằng `p.relearn` trong `app_dt_mark`.
3. Nhận xét theo ngày thật dùng bảng mới `training_day_notes`; bảng cũ `training_days` giữ nguyên.
4. Hàng vừa có mức ở tab "Ngày tiếp theo" ở yên tại chỗ tới lần mở phiếu sau (tránh bấm nhầm hạng mục khi danh sách xô lên).
5. Lịch sử của tab ngày chỉ tải lại khi bấm sang tab đó (đang chấm ở "Ngày tiếp theo" thì không vẽ lại cả trang).
6. Đang lọc thì ẩn thanh tab và hiện danh sách phẳng theo ngày; bỏ lọc thì về tab cũ.
7. Ô Ngày 8 của sườn tách thành thẻ riêng (không còn khối ngày 8 để đặt vào).
8. Hạng mục có số liệu mà không rõ ngày ghi (không tải được sổ, hoặc thiếu giờ) → tab "Trước khi có sổ".
9. Không ghi tab đang xem lên đường dẫn: mở lại phiếu thì theo luật mặc định ở mục 4.
