# Kế hoạch 4 — Sổ thu / Sổ chi gọn, dễ nhìn (chỉ giao diện)

Ngày: 19/11/2026 · Anh Tiến duyệt bằng hình mẫu (phương án C, bản 3 + bộ lọc & phần mở ngày) · Trạng thái: **chờ anh bảo "chạy"** (bảo chạy = đồng ý bản viết này)

Viết cho: người làm (AI hoặc lập trình viên) sẽ sửa `docs/js/pages/so_thu_chi.js`, đã đọc CLAUDE.md.

## Mục đích
Trang Sổ thu chi › tab **Sổ thu** và **Sổ chi** đang rối mắt:
- Số bị lặp: thẻ lớn "Bảng tiền mặt" và ô "Tổng thu · Tiền mặt" ghi cùng một số. Trước khi tới sổ có 3 tầng: 2 thẻ lớn, dòng công thức, 6 ô.
- Bảng ngày đầy dấu "–", có cột cả tháng bằng 0 (ví dụ Luân chuyển).
- Cột phải dài ("Thu nợ tháng này" có hơn 20 dòng), nên các thẻ cần xử lý bị đẩy xuống tít dưới.
- Mỗi khoản của ca bị khoá lặp lại nút "Sửa / Xoá" mờ và dòng "🔒 …".

Mục tiêu: nhìn vào là thấy ngay tổng tiền, các loại và việc cần xử lý.

## Mục tiêu / không làm / tránh
- **Làm:** sắp xếp lại cách hiện của tab Sổ thu, Sổ chi (cả Quỹ ngoài) và phần bộ lọc, phần mở ngày.
- **Không làm:** **không đổi tính năng** (anh Tiến dặn "k sửa tính năng"). Không đổi máy chủ, không đổi hàm `app_*`, không đổi cách tính số. Tab Tổng và Đối soát Fabi giữ nguyên (chỉ sửa một câu chữ, xem mục 6).
- **Tránh:** mất một việc đang làm được. Mọi nút ở cột phải cũ phải còn chỗ bấm ở giao diện mới. Không chạm vùng khoá tiền đối soát (CLAUDE.md): chỉ đổi chỗ hiện, không đổi điều kiện ai sửa / khoá được gì.

## Các phương án đã cân nhắc
| | Cách | Được | Mất |
|---|---|---|---|
| A | Chỉ dọn phần đầu trang | Ít sửa | Bảng và cột phải vẫn rối |
| B | A + bảng gọn + cột phải: thẻ cần xử lý lên đầu, mỗi thẻ 5 dòng | Quen chỗ cũ | Cột phải vẫn chiếm chỗ |
| **C (anh chọn)** | B + **bỏ cột phải**. Bấm ô số để xem riêng loại đó, các thẻ cũ chuyển vào lúc bấm ô | Bảng rộng hết trang, gọn nhất | Phải bấm ô mới thấy danh sách |

Anh chọn C và bổ sung: bấm ô **Thu nợ** chỉ hiện các khoản thu nợ, giống ô Chênh lệch. Bỏ thẻ Ca dư tiền / Khách đang nợ khỏi màn hình. Sổ chi làm tương tự. Thêm nút **👥 Người nợ** ở Sổ chi (cách 1: chỉ gom việc đã có).

## Thiết kế

### 1. Phần đầu trang (cả Sổ thu và Sổ chi)
```
[ Tiền mặt +12.345.000 | Chuyển khoản +23.456.000 ]  [Doanh thu][Thu nợ][Thu khác][Luân chuyển][Chênh lệch]
Tổng thu tháng 11 = Doanh thu + Thu nợ + Thu khác + Luân chuyển + Chênh lệch · bấm một ô để chỉ xem khoản loại đó
```
- Hai thẻ lớn "Bảng tiền mặt / Bảng chuyển khoản" thành **một nút chuyển 2 nửa**, vẫn đổi `pm` như cũ.
- Bỏ ô "Tổng thu · Tiền mặt" (trùng số). Dòng công thức thành chữ nhỏ dưới hàng ô.
- Mỗi ô (một ô cho mỗi cột của `COLS[book]`): tên loại, số tiền. Dòng phụ chỉ hiện khi có việc: "9 ca chờ xử lý" (Chênh lệch), "+ 5 khách còn nợ" (Thu nợ), "3 khoản cần phân loại" (Các khoản chi), "3 người nợ" (Cho nợ), "trong đó … không tính chi phí".
- Ô có việc chờ (chênh lệch chờ xử lý, khoản chưa phân loại) thì **viền / nền vàng**. Ô bằng 0 thì mờ (trên điện thoại thì ẩn).
- Ô đang chọn: viền nâu, ghi "đang lọc ✕". Bấm lại thì bỏ chọn (vẫn là tham số `cot` như cũ).

### 2. Bảng ngày (khi chưa bấm ô nào)
- Bỏ cột phải (`stc-aside`). Sổ chiếm hết bề ngang.
- **Cột cả tháng bằng 0 thì tạm ẩn** (tính theo `pm` đang xem). Có dòng nhỏ "Đang ẩn cột Luân chuyển (cả tháng bằng 0) · hiện lại". Bấm "hiện lại" thì hiện đủ cột cho tới khi tải lại trang.
- Ô bằng 0 để **trống** thay cho "–". Hàng xen màu nhạt. Cột Tổng thu / Tổng chi tô nền, chữ đậm.
- Nút "Mở hết / Thu gọn / + Thêm phiếu" giữ nguyên. Ô "+ Thêm phiếu" khi mở **xếp gọn còn 2 hàng**: (Loại · Tiền · Ngày · Ca · Số tiền) / (Nội dung · Lý do · Lưu · Huỷ). Giữ đủ các ô và luật cũ, chỉ đổi cách xếp.

### 3. Bấm một ô → chỉ xem khoản loại đó
Bảng ngày đổi thành **danh sách từng khoản** của loại đó (ngày · ca · nội dung · nút · số tiền), cuối có dòng **Cộng**. Tiêu đề: "Sổ thu · Tiền mặt · chỉ hiện [Thu nợ] · 5 khoản · 365.000", có nút **✕ Bỏ lọc**. Mỗi dòng dùng lại `itemRow` (đủ nút như trong ca).

Các thẻ của cột phải cũ chuyển vào lúc bấm ô tương ứng:

| Sổ | Bấm ô | Hiện thêm trên đầu danh sách (lấy từ thẻ cũ) |
|---|---|---|
| Thu | Thu nợ | Khung vàng **"Khách còn nợ"** (`open_debts`): tên, ca, số ngày (đỏ khi quá 7), số còn nợ, nút **Thu nợ** (`data-col-debt`). Rồi tới "Đã thu nợ tháng này". |
| Thu | Chênh lệch | Không cần. Mỗi dòng đã có nút **Phiếu chênh lệch** (thay thẻ "Ca dư tiền"). |
| Chi | Các khoản chi | Khung **Chi theo loại · TM + CK** (thanh dài ngắn, nhóm con như thẻ cũ). Rồi tới mục **⚠ Cần phân loại** (các khoản chưa có nhóm, đưa lên đầu, ô chọn nhóm trên dòng). Rồi tới **Đã phân loại**. Ở Quỹ ngoài thêm khung **Phần mỗi cơ sở chịu** (`qnShare`). |
| Chi | Cho nợ | Khung **Người nợ** (ô ✓ "không nhắc ở phiếu chốt ca", `data-person`). Rồi tới các khoản cho nợ, chọn người nợ trên dòng. |
| Chi | Chênh lệch | Không cần. Mỗi dòng đã có **Phiếu chênh lệch** / **→ Trừ lương** (thay thẻ "Ca thiếu tiền"). |

Danh sách theo `pm` đang xem (Tiền mặt hoặc Chuyển khoản), giống bảng. Thẻ cũ "Thu nợ tháng này" gộp cả TM + CK, giờ muốn xem CK thì bấm nửa "Chuyển khoản" (AI quyết, vì để giống bảng cho dễ hiểu).

Khung "Khách còn nợ" giữ lại vì nút **Thu nợ** hiện chỉ có ở thẻ "Khách đang nợ". Anh Tiến thấy trên hình mẫu và không bỏ.

### 4. Nút 👥 Người nợ (Sổ chi)
Nằm cạnh "+ Thêm phiếu" ở Sổ chi (cả lúc bình thường lẫn lúc bấm ô). Bấm vào mở **cửa sổ nhỏ** gồm: danh sách người nợ (`D.people`), số khoản, số còn nợ, ô ✓ không nhắc (gọi `app_stc_person_mark` như cũ), nút **+ Thêm người nợ** (cùng hộp thoại đang dùng ở `setWho` '__add'), nút Đóng. **Không** có đổi tên / gộp / xoá (để kế hoạch sau nếu anh muốn).

### 5. Bộ lọc
Vẫn đủ: ô tìm, Nguồn, Loại, Nhóm, Trạng thái (`SRC_OPTS`, `ST_OPTS`, danh mục từ `app_fin_types`). Chỉ đổi cách hiện:
- Mỗi ô chọn ghi tên trước giá trị: "Nguồn · Tất cả ▾". Ô đang chọn khác "Tất cả" thì tô nâu.
- Lựa chọn Trạng thái có dòng giải thích ngắn (ví dụ "Chờ xử lý: ca dư / thiếu chưa xử lý"; "Có trừ lương: hiện danh sách phiếu trừ lương"). Dùng ô chọn tự vẽ hay `<select>` (chữ phụ trong `<option>`) là việc của người làm.
- Khi đang lọc, có dòng **"Đang lọc: [Tìm "bàn" ✕] [Nguồn: Từ phiếu ca ✕] [Bỏ hết]"**, bên phải là **số khoản · tổng tiền**. Bấm ✕ bỏ từng điều kiện.
- Kết quả: nhóm theo ngày (dòng tiêu đề ngày), mỗi khoản ghi ca trong dòng phụ, cuối có dòng Cộng.
- **Điện thoại:** ô tìm + nút **⚙ Lọc (n)**, bấm mới mở 4 ô chọn. Dòng "Đang lọc" vẫn hiện.
- Bấm ô số ở phần đầu (mục 3) và bộ lọc dùng **cùng lúc** được, như hiện nay (`cot` + `loc`).

### 6. Mở ngày (ngày › ca › từng khoản)
- Giữ 3 lớp và cách mở / gập (`OPEN_D`, `OPEN_C`).
- Lớp ca thụt vào và có **vạch màu bên trái**. Lớp khoản thụt thêm, vạch đứt. Ngày đang mở tô nền.
- Dòng ca: tên ca, người làm, **trạng thái của ca ghi một lần** (ví dụ ⏳ Chưa xác nhận Fabi / Đã xác nhận Fabi / 🔒 tháng đã chốt, theo các trạng thái có trong mã lúc làm, vì bước 158 vừa bỏ Chốt ca vĩnh viễn).
- Ca bị khoá: **một dòng ghi chú** đầu danh sách khoản (ví dụ "⏳ Chưa xác nhận Fabi: chưa thêm / sửa được · Xử lý ca này ở Đối soát Fabi ›"). Từng khoản **không lặp lại** nút "Sửa / Xoá" mờ và dòng 🔒. Lý do chi tiết vẫn xem được (ví dụ chữ khi rê chuột trên dòng ghi chú).
- Khoản sửa được thì vẫn có đủ nút như cũ (Sửa / Xoá, Huỷ thu, Phiếu chênh lệch, → Trừ lương, Khôi phục…).
- Cuối ca: "+ Thêm phiếu … vào ca …", "Xử lý ca này ở Đối soát Fabi ›", "Phiếu chi chuyển khoản" như cũ.
- Điện thoại: dòng ngày / ca chỉ hiện tên + Tổng, các loại có số hiện thành chữ nhỏ bên dưới (như `stc-chips` hiện nay).

### 7. Câu chữ chỗ khác
- Đối soát Fabi (`so_thu_chi.js`, câu "Khoản nợ nằm ở "Khách đang nợ" (Sổ thu, khung bên phải)") đổi thành: "… nằm ở Sổ thu › bấm ô Thu nợ › Khách còn nợ".

## Kiểm tra
- Các bài thử Chrome đang dò cột phải / ô cũ phải sửa theo giao diện mới: `flow_stc1`–`flow_stc6`, `flow_stc9`, `flow_stc10` (đang dùng `stc-aside`, `stc-side`, `data-col-debt`, `data-person`, `stc-tile`, `stc-pay`). Chạy lại cả bộ `flow_stc*`, `flow_ql_tu_ds` (role chu / qlt / ql, `index.html` và `test/phone.html`), vì trang này nằm cạnh vùng khoá.
- Thêm kiểm tra: bấm ô Thu nợ thấy khung Khách còn nợ + nút Thu nợ. Bấm ô Cho nợ thấy Người nợ + ô ✓. Bấm ô Các khoản chi thấy Chi theo loại + Cần phân loại. Nút 👥 Người nợ mở được cửa sổ. Cột bằng 0 bị ẩn và "hiện lại" được. Dòng "Đang lọc" bỏ từng điều kiện được.
- Khung 390px không tràn ngang.

## Để người làm tự quyết
- Tên lớp CSS, cách chia hàm (khuyên tách phần vẽ mới ra tệp riêng nếu `so_thu_chi.js` quá dài).
- Ô chọn tự vẽ hay `<select>`, miễn đủ thông tin như trên.
- Chi tiết màu sắc theo bảng màu đang có của trang.

## Việc phải làm trước
- Bước 158–160 đã đẩy lên (19/11). Theo lộ trình `tai_lieu/superpowers/plans/2026-11-19-lo-trinh-4-ke-hoach.md`, KH4 làm ở lượt 3: **sau KH2** (thêm dòng giờ ở Đối soát Fabi phần A) **và KH3** (ô Ca theo Ngày trong "+ Thêm phiếu"). KH4 phải giữ nguyên phần của hai kế hoạch đó. Kế hoạch làm: `tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-gon.md`.

## Hình mẫu
Các tệp hình mẫu (có số liệu thật, **không đưa vào kho mã**) chỉ nằm ở máy anh, trong thư mục tạm của phiên này: `ke-hoach-4-c-ban3.html`, `ke-hoach-4-loc-va-ngay.html`. Thư mục tạm có thể bị xoá, nên bản viết này đã đủ để làm mà không cần tới hình mẫu.
