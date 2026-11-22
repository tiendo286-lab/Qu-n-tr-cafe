# Đưa Đối soát Fabi về lại Chốt ca — bản thiết kế

- Người đề xuất: anh Tiến, 22/11/2026 sáng (chặng 3). Khi em hỏi về 234 ca chưa hoàn thành đối soát, anh trả lời: "Tôi sẽ đưa đối soát fabi về lại chốt ca".
- Thứ tự: anh chốt "để sau cùng", làm sau mọi việc khác.
- 22/11 chiều anh giao: "Hỏi kỹ rồi bắt đầu làm". Em hỏi 2 lượt, anh chọn đủ 6 câu (mục 2).
- Vùng khoá tiền đối soát: có đụng.
  - Giao diện: khối sửa / xác nhận / hoàn thành phần tiền dời chỗ.
  - Máy chủ: luật không đổi; chỉ thêm hàm đọc.
  - Đã báo anh trong chat trước khi làm.

## 1. Vì sao làm

**Hiện nay một ca muốn "Đã đối soát" phải xong ở hai nơi:**
- **Phần tiền:** Sổ thu chi › tab Đối soát Fabi, 6 bước (Số máy Fabi → Tiền thực nhận + Xác nhận Fabi → Khoản thu → Khoản chi → Chênh lệch → Hoàn thành đối soát ca).
- **Phần việc:** trang Đối soát ca cũ `#/quan-ly/doi-soat/ca?id=` (Ai làm ca → Nghỉ & làm thay → Bàn giao + nhận hàng).
  - Trang này không có trong menu. Chỉ vào được từ khung Còn thiếu ở Chốt tháng, Tệp ca Fabi, vài liên kết trong Sổ thu chi, thông báo cũ.
- **Bảng tuần Chốt ca:** chỉ cho biết nhân viên chốt xong chưa + tiền lệch. Bấm ô chỉ mở phiếu nhân viên để xem.

**Lỗi đang có:** trang Đối soát ca cũ khoá **cả trang** khi kế toán chưa đủ file Fabi + số ngân hàng (`phieu_ca.js`: `if (wantDs && ktBlocked) return …`).
- Luật anh chốt 12/11 (TINH_NANG mục 5o): "Nhân sự, Bàn giao, Nhập hàng đối soát ngay khi nhân viên gửi (không cần số của kế toán)".
- Sáng 22/11 có 234 ca chưa hoàn thành; khoảng 205 ca chưa làm Nhân sự + Bàn giao.

**Mục tiêu:** quản lý mở một ca từ Chốt ca là làm xong cả ca ở một chỗ, không phải tìm trang ẩn hay sang Sổ thu chi.

## 2. Anh Tiến đã chốt (22/11 chiều)

1. Ai làm: **quản lý cơ sở**, thường **dồn vài ngày** làm một lượt.
2. Mở một ca: **hai phần, Hoàn thành ở cuối**.
   - ① Phần việc làm ngay khi nhân viên gửi phiếu, không chờ kế toán.
   - ② Phần tiền 6 bước như hiện nay, làm khi kế toán có số.
   - Xong cả hai thì bấm Hoàn thành.
3. **Bỏ tab "Đối soát Fabi" trong Sổ thu chi**, chỉ làm ở Chốt ca.
4. Ô bảng tuần Chốt ca hiện **hai dòng: Việc · Tiền**.
5. Có nút **"Ca tiếp theo chưa xong ›"**; đầu bảng tuần có dòng "Còn N ca chưa đối soát xong · Làm ca cũ nhất ›".
6. Quản lý bấm ô ca (nhân viên đã gửi phiếu) → **mở thẳng trang đối soát** của ca. Đầu trang có nút "Xem phiếu nhân viên".

Đã chốt từ trước, giữ nguyên:
- 6 bước tiền là bản chốt (Q-35, 21/11).
- Các mục kiểm tra phải tích, các nút Xác nhận Fabi / Sai sửa số / Đổi luân chuyển.
- Luật "ca không tự hoàn thành".

## 3. Không làm / tuyệt đối tránh

**Không làm:**
- Không đổi luật máy chủ:
  - không đổi điều kiện ca thành "Đã đối soát" (`app__ca_auto_finish`, `stc_ca_done`);
  - không đổi ai được xác nhận / hoàn thành / mở lại (`app__ca_auto_ok`, `app__stc_can`, `app__stc_need`, `app_can`, `role_permissions`);
  - không đổi cách tính tiền.
- Không đổi phiếu chốt ca của nhân viên.
- Không đổi Sổ thu / Sổ chi / Tổng (ngoài các nút dẫn đường).
- Không đổi Hàng hoá › Đối soát.

**Tuyệt đối tránh:**
- Mất hoặc đổi số tiền của ca nào.
- Ca đang dở bị mất dấu đã tích / đã xác nhận.
- Đường dẫn cũ (thông báo, dấu trang, nút ở trang khác) bấm vào ra trang trống hoặc lỗi.
- Người không có quyền thấy được phần tiền.

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Được / mất |
|---|---|---|
| **A. Dùng lại khối 6 bước đang chạy, đặt vào trang ca** (em chọn — anh để em lo cách làm) | `so_thu_chi.js` có thêm chế độ "một ca"; trang đối soát ca nhúng khối đó vào tab ② / ③ | Giữ nguyên mọi phép tính, nút, hộp thoại, bài thử phần tiền. Ít rủi ro sai tiền nhất. Mất: hai tệp mã gắn với nhau |
| B. Viết lại 6 bước ngay trong `phieu_ca.js` | Liền mạch hơn chút | Phải làm lại toàn bộ phần tiền và thử lại từ đầu, rủi ro sai tiền cao → bỏ |
| C. Giữ tab Sổ thu chi, chỉ thêm nút từ Chốt ca sang | Ít việc nhất | Trái câu 3 (bỏ tab) → bỏ |

## 5. Thiết kế

### 5.1 Trang đối soát của ca
Đường dẫn chính mới: `#/ca/doi-soat?id=<ca>`, thuộc Chốt ca (menu Chốt ca sáng khi đang ở trang này).
- Đường cũ `#/quan-ly/doi-soat/ca?id=` và `#/ca/phieu?id=&__ds=1` mở cùng trang này. Giữ tham số `buoc` (bước phần việc) và `b` (bước phần tiền 1–6).
- Tham số mới `tab=viec|tien|xong` chọn tab.

```
Ca Chiều 04/11 · LHP          [Xem phiếu nhân viên]  [Ca tiếp theo chưa xong ›]
[① Phần việc ✓] [② Phần tiền · còn 2 bước] [③ Hoàn thành]
```

**① Phần việc**
- Giữ nguyên các bước đang có trên trang Đối soát ca cũ, đi từng bước với nút "Duyệt & tiếp":
  1. Ai làm ca.
  2. Nghỉ & làm thay — chỉ khi ca có người nghỉ / làm hộ / ca bổ sung.
  3. Bàn giao + đánh giá nhân viên + nhận hàng.
- **Làm được ngay khi nhân viên đã gửi phiếu**, kể cả khi chờ kế toán. Bỏ chặn cả trang. Máy chủ chỉ chặn ghi kết quả phần tiền (`ca_kt_guard`); em kiểm lại bằng bài thử cục bộ.

**② Phần tiền**
- Là bước 1–5 của khối 6 bước hiện nay: Số máy Fabi → Tiền thực nhận (Xác nhận Fabi) → Khoản thu → Khoản chi → Chênh lệch.
- Giữ nguyên markup, mục kiểm tra, hộp thoại:
  - Sai, sửa số / Chủ duyệt;
  - phiếu chênh lệch, khoản nợ của ca, người nợ, đổi luân chuyển;
  - ảnh phiếu Fabi, giờ chốt.
- Chưa đủ số kế toán → tab này hiện hộp "CHỜ KẾ TOÁN" ghi thiếu gì (như hiện nay). Tab ① vẫn làm.
- Ghi "thiếu tiền" vẫn cần xác nhận Ai làm ca trước (luật máy chủ hiện có). Thông báo chỉ thẳng tới tab ①.

**③ Hoàn thành**
- Là bước 6 hiện nay, cộng thêm phần việc:
  - tóm tắt ① (từng bước ✓ / còn gì; Nghỉ & làm thay chờ Chủ duyệt thì ghi rõ);
  - tóm tắt ② (5 bước, bấm để tới).
- Nút **🔒 Hoàn thành đối soát ca** (cùng hàm `stc_ca_done` như hiện nay).
  - Chỉ bấm được khi ① xong (trừ việc chờ Chủ duyệt x2) và ② xong.
  - Còn thiếu thì nút khoá, ghi còn gì.
  - Chỉ chờ Chủ duyệt x2: cho bấm, ghi "ca tự thành Đã đối soát khi Chủ duyệt" (đúng luật máy chủ hiện nay).
- Đã hoàn thành: "✓ Đã đối soát · người · giờ" + nút Mở lại (như bước 6 hiện nay) + **Ca tiếp theo chưa xong ›**.

**Các phần khác**
- Lịch sử sửa / mở lại phiếu cho nhân viên: giữ, đặt cuối trang.
- Điện thoại 390px:
  - thanh 3 tab nằm trên, cuộn ngang nếu chật;
  - ① đi từng bước như hiện nay;
  - ② dùng thanh đáy của khối 6 bước (Quay lại · còn N mục · Tiếp ›); bước 5 bấm Tiếp → sang ③.

### 5.2 Bảng tuần Chốt ca (`chot_ca.js`)
Chỉ người đối soát được cơ sở đó mới thấy dòng Việc · Tiền. Đó là Chủ, Quản lý tổng, quản lý có tên ở dòng "Đối soát ca" của cơ sở (`app__stc_can`). Người khác (nhân viên, quản lý không được giao) thấy bảng như cũ.

**Ô ca nhân viên đã gửi phiếu, thay chữ "Xong":**
- `✓ Đã đối soát` khi ca hoàn thành.
- Khi chưa hoàn thành, hai dòng:
  - **Việc ✓** / **Việc –** (rê chuột / giữ lâu: còn thiếu gì).
  - **Tiền**: ⏳ chờ kế toán · 🔴 ô đỏ (mở ca / doanh thu / nợ chưa khớp) · 🔵 chờ xác nhận Fabi · 🟡 chưa bấm Hoàn thành · ✓.
- Các dòng tiền mặt / chuyển khoản lệch và khách nợ trong ô: giữ như cũ.
- Chú thích ký hiệu dưới bảng.

**Bấm ô:**
- Người đối soát được → trang đối soát của ca. Mở tab đầu tiên còn việc: ① nếu phần việc chưa xong; không thì ②; xong cả hai thì ③.
- Người khác → phiếu nhân viên như cũ.
- Ô chưa có phiếu / đang chốt: như cũ.

**Đầu bảng:** "Còn N ca chưa đối soát xong · Làm ca cũ nhất ›".
- Tính từ 01/11 (ngày bắt đầu dùng web) tới hôm nay, chỉ ca nhân viên đã gửi phiếu.

### 5.3 Ca tiếp theo chưa xong
- Ca kế tiếp **sau** ca đang mở, theo ngày rồi thứ tự ca của cơ sở (Sáng → Chiều → Tối), cùng cơ sở, nhân viên đã gửi phiếu, chưa "Đã đối soát".
- Hết ca phía sau thì quay về ca chưa xong cũ nhất. Không còn ca nào thì nút ghi "✓ Hết ca chưa xong".
- Mở thẳng tab đầu tiên còn việc của ca đó.
- Nút hiện ở đầu trang ca và ở ③ sau khi Hoàn thành.

### 5.4 Sổ thu chi (`so_thu_chi.js`)
- Bỏ tab "Đối soát Fabi". Còn 3 tab: Tổng · Sổ thu · Sổ chi.
- `tab=doi-soat`:
  - có `ds` → chuyển sang trang đối soát ca (giữ `b`);
  - không có → bảng tuần Chốt ca của cơ sở, tuần của tháng đang xem.
- Mọi nút trong Sổ thu chi đang trỏ tới tab đó chuyển sang trang đối soát ca:
  - Việc cần làm ở Tổng;
  - "Xử lý ca này ở Đối soát Fabi ›";
  - "🔒 Ca đã hoàn thành đối soát — Mở lại ở bước 6";
  - khoản bị khoá theo ca.
- Thêm hàm xuất ra cho trang ca dùng: dựng khối tiền của **một ca** (tải dữ liệu tháng như hiện nay, không vẽ đầu trang / tab / lưới ca). Gắn sự kiện vào hộp chứa của nó.

### 5.5 Các trang khác dẫn đường
- **Chốt tháng › khung Còn thiếu:**
  - nhóm "chờ kế toán", "chưa xác nhận Fabi" → tab ②;
  - "chưa bấm Hoàn thành", "đủ điều kiện, chờ ghi nhận" → tab ③;
  - "còn phần việc" → tab ①.
- **Tệp ca Fabi**, Công nợ (Ghi nhận nợ), Cho vay, trang Đối soát cũ (`#/quan-ly/doi-soat`, không có trong menu): liên kết tới trang đối soát ca.
- **`app.js`:**
  - đường cũ Lệch tiền ca / Âm tiền đang chuyển về tab Đối soát Fabi → chuyển về bảng tuần Chốt ca;
  - thêm định tuyến `#/ca/doi-soat`.

### 5.6 Máy chủ — tệp 164 (chỉ thêm hàm đọc, không đổi luật)
- `app_ca_ds_tuan(p_branch bigint, p_from date, p_to date) returns jsonb`
  - Mỗi ca đã gửi phiếu trong khoảng: `{id, date, shift, recon, viec: {xong, thieu: [nhãn], x2}, tien: {st, thieu: [..]}}`.
  - `tien.st` theo đúng thứ tự điều kiện của `app__ca_auto_finish` / khung Còn thiếu (tệp 159):
    - `kt` (`app__ca_kt_state` chưa đủ);
    - `red` (chưa đủ kết quả tiền và `app__stc_ds_state` có mo1/mo2/dt/no sai);
    - `xn` (chờ xác nhận Fabi);
    - `ht` (đã xác nhận, chưa có `stc_ca_done`);
    - `ok`.
  - `viec.xong` = đủ 3 dấu nhan_su / ban_giao / nhap_hang và x2 (`app__cv_state`) là khong_can / da_duyet (ca quản lý tự chốt: khong_can).
  - Quyền: `app__stc_can(p_branch)`. Không có quyền → trả `[]` (không báo lỗi để bảng tuần vẫn vẽ được).
- `app_ca_ds_con(p_branch bigint) returns jsonb`
  - Danh sách ca chưa "Đã đối soát" (nhân viên đã gửi phiếu, từ 01/11 tới hôm nay) theo ngày + thứ tự ca: `{id, date, shift}`.
  - Dùng cho dòng "Còn N ca" và nút "Ca tiếp theo chưa xong". Cùng quyền.
- Bật SECURITY DEFINER, thu hồi `anon`. Dòng cuối ghi `app_migrations`. Chạy lại nhiều lần không sao.
- Cần mã `sbp_` mới của anh Tiến (mã cũ đã xoá, anh thu hồi) để chạy thử (tự hoàn tác) rồi chạy thật **trước** khi đưa giao diện lên.

## 6. Kiểm tra

**Máy chủ cục bộ** — `kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql`:
- trạng thái đúng cho từng chỗ kẹt (kt / red / xn / ht / ok; việc thiếu từng mục; x2 chờ duyệt; ca tự chốt);
- quyền (quản lý không được giao → `[]`; nhân viên → `[]`);
- "ca tiếp theo" đúng thứ tự;
- phần việc ghi được khi chờ kế toán.

**Trình duyệt** — bài mới `flow_dsca` (Chủ / Quản lý tổng / Quản lý cơ sở × máy tính + 390px):
- ô bảng tuần hai dòng;
- bấm ô mở đúng tab;
- ① làm được khi chờ kế toán;
- ② đủ 5 bước;
- ③ khoá khi còn việc, Hoàn thành được khi đủ;
- Ca tiếp theo chưa xong;
- đường cũ chuyển đúng;
- nhân viên vẫn mở phiếu của mình;
- không tràn ngang.

**Bài cũ phải đạt:**
- Phần tiền: `flow_stc1–18`, `flow_ds171–173`, `flow_fb136`, `flow_ct`, `flow_cu152`.
  - Mở qua đường `tab=doi-soat&ds=` cũ, nay tự chuyển.
  - Chỉ sửa chỗ trỏ cấu trúc đã đổi (lưới ca của tab cũ, bước 6 nay ở tab ③). Không sửa nội dung kiểm.
- **Vùng khoá:** `flow_ql_tu_ds` (ql / chu) + `flow_stc6` / `flow_stc7` (chu / qlt / ql), cả 2 khung.

**Ảnh cho anh duyệt** trước khi lên web (máy tính + điện thoại), như phiếu đào tạo.

## 7. Tự soát trước khi làm (đọc mã máy chủ, 22/11)

1. Phần việc ghi được khi chờ kế toán.
   - `app_ca_check` (bản mới nhất ở tệp 31) chỉ cần quyền `doi_soat` + phiếu đã gửi + chưa "Đã đối soát". Không xét kế toán.
   - Chỉ giao diện đang chặn cả trang → bỏ chặn là đủ, không đổi luật.
2. 6 mục tiền được tích khi Xác nhận Fabi.
   - `app_stc_ds_close` (tệp 137) ghi Thời gian + Doanh thu bằng `app_ca_check`.
   - Tiền mặt / Chuyển khoản / Thu chi / Công nợ ghi bằng `app_ca_result_set`. Hàm này (tệp 39) ghi cả kết quả lẫn dấu tích.
   - Còn lại 3 dấu phần việc: nhan_su / ban_giao / nhap_hang.
3. Xong phần việc sau khi đã bấm Hoàn thành ở phần tiền: `app_ca_check` gọi `app__ca_auto_finish` → ca tự thành "Đã đối soát" (cần `stc_ca_done`, tệp 150). Không cần bấm lại.
4. `nhap_hang` vẫn đòi hàng nhận trong ca đã đối soát ở Hàng hoá › Đối soát (luật hiện có). Tab ① giữ dòng nhắc + liên kết.

## 8. Để người làm tự quyết
- Tên hàm / tệp, cách xuất khối tiền một ca từ `so_thu_chi.js`.
- Chữ trên nút / chú thích nhỏ, màu ký hiệu (theo màu Đối soát Fabi đang dùng).
- Trang Đối soát cũ `#/quan-ly/doi-soat`: giữ nguyên (không có trong menu), chỉ sửa liên kết.
