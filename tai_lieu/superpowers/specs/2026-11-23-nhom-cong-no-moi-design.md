# Thiết kế: chia lại nhóm công nợ + nợ khách không cần tên (chặng 6.4)

Anh Tiến yêu cầu 23/11/2026 chiều ("hãy giúp tôi phân loại các loại nợ hiện tại", "tôi muốn bỏ tên khách gộp chung vào ghi chú (khách hoặc tên bàn) cho dễ, k phải tạo khách mới"). Mọi điểm dưới đây anh đã chọn qua các câu hỏi trong chat, trừ chỗ ghi **[em tự quyết]**.

> Kho mã công khai — tài liệu này không ghi tên thật người nợ; chỉ ghi mã khoản nợ / mã người nợ.

## 1. Vì sao

- Nhóm "③ Nợ khác" đang ~28,6 triệu, gần hết là nợ của chính anh Tiến, lẫn với nợ người nhà → không nhìn ra anh nợ quán bao nhiêu.
- Nợ khách lẻ: mỗi lần khách nợ, quản lý phải tạo một "người nợ" mới (Bàn 3, khách nợ bàn 5…) rồi bấm Xếp ở bước 1 → mất công, danh sách người nợ đầy tên rác.

## 2. Mục tiêu / không làm / tránh

- **Mục tiêu**
  - 4 nhóm công nợ: **① Khách hàng · ② Kho tổng · ③ Chủ (anh Tiến) · ④ Người nhà / người quen**. Nhóm Chủ hiện riêng ở **mọi trang có nợ** (Công nợ, phiếu chốt ca, trang đối soát ca, Sổ thu chi, chốt tháng).
  - Nợ khách hàng **không cần tên người nợ**: chỉ có ghi chú ("khách", "bàn 5"…), gộp chung một chỗ.
  - Nhân viên chốt ca chọn **Nợ khách** hoặc **Nợ khác**; Nợ khác thì quản lý phân loại ở bước 1.
- **Không làm**
  - Không thêm nhóm "Nợ khó đòi" (anh chọn không cần).
  - Không đổi quyền: ai đang xem được Công nợ thì thấy cả nhóm Chủ.
  - Không đổi cách tính tiền: nhóm chỉ ảnh hưởng hiển thị, nhắc thu, ai thu — Sổ quỹ, đối soát tiền không đổi.
- **Tránh (coi là hỏng dù chạy được)**
  - Nợ của anh bị coi là nợ khách → phiếu chốt ca nhắc nhân viên thu. (Máy chủ hiện **tự đổi nhóm lạ thành 'khach'** — mọi chỗ phải biết nhóm mới.)
  - Mất lịch sử: tên khách cũ biến mất hẳn, không biết khoản cũ là của ai.

## 3. Các cách đã cân nhắc

**Nhóm Chủ**
- **Cách 1 — nhóm thứ tư thật (giá trị `chu` trong cột nhóm)** — anh chọn ("Ở mọi trang có nợ"). Sửa mọi hàm máy chủ đang kiểm 3 nhóm (≈18 hàm) + ≈8 tệp web.
- Cách 2 — mục con trong Người nhà (máy chủ vẫn `khac`, thêm dấu "là chủ" ở người nợ): nhanh, không đụng vùng khoá, nhưng chỉ tách được ở trang Công nợ → không đúng ý anh.

**Nợ khách không tên** **[em tự quyết]**
- **Cách A — một người nợ chung "Khách" mỗi cơ sở** (giống người nợ đặc biệt "Kho tổng" đang có): mọi khoản nợ khách tự gắn vào người chung này, chữ nhân viên gõ thành ghi chú. Chọn cách này vì: đúng chữ anh nói "gộp chung"; các hàm máy chủ đang đòi khoản nợ phải có người trong danh sách vẫn chạy; trang Công nợ tự gom mọi khoản khách về một dòng "Khách" mở ra thấy từng khoản + ghi chú.
- Cách B — khoản nợ khách không có người (để trống): phải sửa thêm mọi hàm đang đòi có người; trang Công nợ phải viết riêng cách hiện. Bỏ.

## 4. Thiết kế (anh đã chốt)

### 4.1 Bốn nhóm
| Nhóm | Mã | Có tên người nợ | Phiếu chốt ca nhắc NV thu | Ai thu |
|---|---|---|---|---|
| ① Khách hàng | `khach` | Không — người chung "Khách" + ghi chú | Có (như nay) | NV ở ca / quản lý |
| ② Kho tổng | `kho` | Người "Kho tổng" (như nay) | Không | Quản lý |
| ③ Chủ (anh Tiến) | `chu` (mới) | Có | Không | Quản lý bấm "Đã thu" khi anh chuyển khoản / đưa tiền mặt lại |
| ④ Người nhà / người quen | `khac` (đổi tên hiển thị từ "Nợ khác") | Có | Không | Quản lý |

- Quyền xem / sửa: như nhóm Kho tổng hiện nay.
- Cột `family` tự đồng bộ: `chu` → 1 (như `kho`, `khac`).
- Thứ tự hiện ở mọi nơi: ① ② ③ ④ như bảng.

### 4.2 Nhân viên ghi nợ lúc chốt ca
- Mỗi khoản nợ mới có 2 nút chọn: **Nợ khách** · **Nợ khác**.
  - Nợ khách: ô ghi chú bắt buộc ("khách", "bàn 5", SĐT…). Lưu → nhóm `khach`, người chung "Khách", **đã xếp sẵn**.
  - Nợ khác: ô ghi chú bắt buộc (vd "anh Tiến lấy 100k"); nhóm chờ quản lý phân loại. **[em tự quyết]** Ô chọn tên người có sẵn (người nhà / chủ / kho tổng) giữ như nay để nhân viên chọn nếu biết; quản lý vẫn phải bấm Xếp xác nhận.
- Ca sau: phiếu chốt ca chỉ nhắc nợ nhóm ① (như nay).

### 4.3 Bước 1 trang đối soát ca (VÙNG KHOÁ — đã báo anh 23/11)
- Khoản **Nợ khách**: không cần bấm Xếp; hiện "✓ Khách hàng · <ghi chú>". Có nút **Đổi nhóm** (nhân viên chọn nhầm) → chọn nhóm ②③④ + người → Xếp.
- Khoản **Nợ khác** chưa phân loại: chọn nhóm (Chủ / Người nhà / Kho tổng) + người trong danh sách → **Xếp**. Chưa phân loại hết → **chặn Hoàn thành** (như nay), không chặn Xác nhận Fabi.
- Đổi từ nhóm ②③④ về Khách hàng: được (gắn lại người chung "Khách", tên cũ thành ghi chú).
- Mục việc "Nợ mới của ca đã xếp đúng người + nhóm" chỉ đếm khoản không phải Nợ khách.

### 4.4 Trang Công nợ, Sổ thu chi, chốt tháng
- Công nợ: 4 ô tổng ①②③④; nhóm ① là một dòng "Khách" mở ra từng khoản (ngày, ca, ghi chú, số tiền, Đã thu); ②③④ theo từng người như nay.
- Danh sách người nợ (Sổ chi › Người nợ, "+ Thêm người nợ…"): chỉ chọn nhóm ②③④; người chung "Khách" không sửa / không ngừng dùng được (như "Kho tổng").
- Sổ thu chi, trang đối soát ca, phiếu chốt ca: chỗ nào ghi tên nhóm / cộng theo nhóm thì thêm ③ Chủ, đổi "Nợ khác" → "Người nhà / người quen".
- Chốt tháng: nếu có cộng nợ theo nhóm thì thêm ③.

### 4.5 Chuyển dữ liệu cũ (một tệp máy chủ, chạy lại được)
1. Mỗi cơ sở có một người nợ chung "Khách" nhóm `khach` (tạo nếu chưa có; LHP đã có người tên "Khách" thì dùng lại).
2. Mọi khoản nợ nhóm `khach` (cả đã thu): gắn người chung "Khách"; tên cũ (nếu khác "Khách") đưa vào ghi chú — **không mất chữ cũ**.
3. Người nợ nhóm `khach` khác người chung → **ngừng dùng** (không xoá — giữ lịch sử). **[em tự quyết — an toàn hơn xoá]**
4. Người nợ là anh Tiến (mã người 17, LHP) → nhóm `chu`; 4 khoản đang nợ của anh (mã 74, 84, 312, 313) và mọi khoản cũ của người này → `chu`.
5. Khoản 26 và 29 (đang ở nhóm Khách hàng, là người nhà) → nhóm `khac`, gắn người nhà tương ứng đã có trong danh sách (mã người của khoản 69 / 330); người nợ cũ của 2 khoản này ngừng dùng.
6. Khoản 42 (500k, chưa có người) không đụng — anh tự đổi thành Luân chuyển.
- Chạy thử trong khối tự hoàn tác, đếm trước / sau: tổng tiền mỗi cơ sở không đổi, chỉ đổi nhóm.

## 5. Ràng buộc
- Vùng khoá: hàm xác nhận phần tiền của ca (`app_ca_recon_apply`) chỉ thêm `chu` vào danh sách nhóm hợp lệ; khoá Hoàn thành theo phần việc ở web (`ONE.workLeft`, mục `phanloai`) đổi cách đếm như 4.3. Không đổi ai sửa được / mục nào bị khoá.
- Tệp máy chủ mới: số tiếp theo sau 165 (xem sổ tệp đã chạy trước khi đặt số), viết chạy lại được, dòng cuối ghi `app_migrations`.
- Trigger đồng bộ nhóm: nhận `chu`; nhóm lạ vẫn về `khach` như cũ nhưng phải có bài thử chứng minh `chu` không bị đổi.
- Thử: bài thử mới cho 4.2–4.5 (máy tính + điện thoại 390px) + bộ vùng khoá (`flow_ql_tu_ds` ql/chu, `flow_stc6`, `flow_stc7` chu/qlt/ql, `flow_dsca`) + các bài Công nợ / người nợ đang có. Chạy SQL thử trên Postgres cục bộ trước.
- Lên web: máy chủ trước, giao diện sau; gửi ảnh (tên giả) cho anh duyệt trước khi đưa lên.

## 6. Để người làm tự quyết
- Lưu ghi chú nợ khách ở cột nào (`note` / `content`), miễn mọi trang hiện được.
- Chữ trên nút, màu nhãn nhóm ③ (theo kiểu nhãn đang có).
- Cách tìm và sửa từng hàm trong ≈18 hàm (sao chép bản đang chạy rồi sửa, như các tệp trước).
