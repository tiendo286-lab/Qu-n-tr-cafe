# Thiết kế: Bảng tiền chênh lệch (27/11/2026) — anh Tiến chọn "bảng để xem và xử lý luôn" (A + B), đã làm trên nhánh

Hình mẫu (dữ liệu giả): https://claude.ai/artifact/3tT5iPsxVtdFuY9Cfcsx5o

## Anh Tiến nói gì

- "T muốn có giao diện bảng tiền chênh lệch này để sẽ đối soát cho chủ và quản lý."
- "Lên thiết kế trước khi sửa toàn bộ."

Anh chưa tả từng cột / từng nút. Mọi điểm dưới đây là **đề xuất của em**, anh chưa xác nhận.

## Vì sao cần

Tiền chênh lệch của ca (tiền thực tế khác tiền phải có) đang nằm rải ở 3 chỗ: trong từng ca (trang đối soát ca, bước Tiền), ở Sổ thu chi › Tổng › Việc cần làm (lẫn việc khác, mỗi lần một cơ sở, chỉ ca còn chờ), và Sổ chi lọc "Có trừ lương". Chủ và quản lý không có một chỗ nhìn hết chênh lệch của các ca, các cơ sở để soát.

## Mục tiêu

- Một trang dạng bảng: mỗi dòng là một chênh lệch của một ca (theo từng loại tiền: tiền mặt / chuyển khoản).
- Nhìn được cả tháng, một cơ sở hoặc mọi cơ sở; thấy ngay còn bao nhiêu chờ xử lý, bao nhiêu chờ Chủ duyệt, đã xử lý bằng cách nào.
- Từ một dòng đi thẳng tới chỗ xử lý.

## Không làm (ngoài phạm vi)

- Không đổi cách tính tiền phải có / thực tế / lệch — dùng đúng số của Sổ thu chi và trang đối soát ca.
- Không đổi luật ai được xử lý, ai được duyệt, lúc nào bị khoá.
- Không gộp khoản nợ khách, khoản chi thường vào bảng này.

## Điều phải tránh

- Số trên bảng khác số trong ca (dù chỉ một dòng) — bảng sẽ mất tin.
- Người không được xem tiền của cơ sở lại thấy qua bảng này.

## Trang trông thế nào

Vị trí: menu **Quản lý ca**, tên **Chênh lệch tiền**, cạnh Sổ thu chi. Ai vào được: người đang vào được Sổ thu chi (quyền đối soát, đúng các cơ sở được xem) và Chủ. Nhân viên không vào.

Từ trên xuống:

1. Chọn tháng; chọn cơ sở (Tất cả cơ sở / từng cơ sở).
2. Năm ô tổng: Tổng thiếu · Tổng dư · Còn chờ xử lý · Chờ Chủ duyệt · Đã xử lý xong (ghi rõ trừ lương, quán chịu, cách khác).
3. Nút lọc: Tất cả / Chờ xử lý / Chờ Chủ duyệt / Đã xử lý; Chỉ thiếu / Chỉ dư; Tiền mặt / Chuyển khoản.
4. Bảng, mỗi dòng: Ngày · ca — Cơ sở — Loại tiền — Phải có — Thực tế — Lệch (thiếu đỏ có dấu −, dư xanh có dấu +) — Người làm ca — Đã xử lý bằng (vd "Trừ lương A 40.000 · B 40.000", "Quán chịu 60.000 — chờ Chủ duyệt", "Ghép với ca …", "Gán nợ khách trả …", "Phiếu thu") — Còn lại — Trạng thái — nút **Mở ca ›**.
5. Dòng tổng của những dòng đang hiện.

Trạng thái một dòng: **Chờ xử lý** (còn tiền chưa có cách xử lý) · **Chờ Chủ duyệt** (đã chọn quán chịu / ghép ca, chờ Chủ) · **Đã xử lý** · **Lệch nhỏ** (dưới mức phải xử lý, chỉ để biết).

Điện thoại: không dùng bảng ngang; mỗi chênh lệch là một thẻ, đủ các thông tin trên.

## Các cách làm đã cân nhắc

- **A — Bảng chỉ xem, bấm "Mở ca" sang bước Tiền của trang đối soát ca để xử lý (em đề nghị làm trước).** Không đụng luật tiền / quyền nào; số lấy từ đúng nguồn đang chạy; làm nhanh, ít rủi ro. Nhược: muốn xử lý vẫn phải sang trang ca.
- **B — Xử lý ngay trên bảng.** Dòng "Chờ Chủ duyệt" có Duyệt / Từ chối cho Chủ; dòng "Chờ xử lý" mở phiếu chênh lệch ngay tại bảng (trừ lương, quán chịu, ghép ca, phiếu thu, gán nợ) bằng đúng hàm và luật đang chạy. Tiện hơn nhiều cho Chủ khi duyệt hàng loạt. Nhược: đụng vùng khoá tiền đối soát — phải báo anh từng điểm, thử kỹ bộ vùng khoá.
- **C — Bảng có luật xử lý riêng.** Loại: hai nơi hai luật thì số sẽ lệch nhau.

**Đề nghị:** làm A thành đợt 1 (anh dùng thử, chỉnh cột / lọc cho vừa ý), rồi B thành đợt 2 nếu anh muốn bấm duyệt ngay trên bảng. Anh chưa chọn.

## Câu cần anh trả lời trước khi làm

1. Đợt 1 chỉ xem + Mở ca (A), hay làm luôn cả duyệt / xử lý trên bảng (A + B)?
2. Bảng có hiện cả dòng "Lệch nhỏ" không, hay ẩn mặc định?
3. Ca chưa có đủ số (chờ kế toán, chưa xác nhận Fabi) thì lệch chưa chắc đúng — hiện kèm nhãn "số tạm" hay ẩn tới khi đủ số? (Em nghiêng: hiện, kèm nhãn "số tạm".)
4. Quản lý cơ sở thấy mọi cơ sở hay chỉ cơ sở mình được xem tiền? (Em nghiêng: theo đúng quyền xem tiền từng cơ sở như Sổ thu chi.)

## Để người làm tự quyết

- Lấy số từ hàm tháng của Sổ thu chi cho từng cơ sở hay viết một hàm đọc gọn riêng (chỉ đọc) — miễn số khớp từng ca với trang đối soát ca; phải có bài so trên dữ liệu thật như đã làm cho trang đối soát ca mới (271 ca khớp hết).
- Cách sắp xếp mặc định (đề nghị: chờ xử lý lên trước, rồi ngày mới nhất).

## Anh Tiến trả lời 27/11 và những điều em tự quyết khi làm

- **Câu 1 — anh chọn: "bảng để xem và xử lý luôn"** → làm cả A và B trong một đợt.
- Câu 2, 3, 4 anh chưa trả lời — em làm theo hướng em nghiêng, **chưa xác nhận**:
  - Lệch nhỏ (máy chủ ghi "Lệch nhỏ ≤ 5.000"): **ẩn sẵn**, có nút lọc "Lệch nhỏ" để xem; không tính vào ô tổng thiếu / dư.
  - Ca chưa có dòng xử lý lệch ở máy chủ (chưa xác nhận xong phần tiền): hiện nhãn **"Số tạm"**, chỉ có nút Mở ca.
  - Ai thấy cơ sở nào: đúng theo quyền xem tiền của Sổ thu chi; cơ sở không được xem thì bỏ qua và ghi tên ở đầu bảng.
- Cách làm: trang `docs/js/pages/chenh_lech.js` + hàm thuần `docs/js/chenh_lech_tinh.js`. **Không có máy chủ mới, không có luật mới:**
  nạp sổ tháng từng cơ sở bằng `app_stc_month` (qua `stcLoadFor`), dòng lấy từ `caGaps`, số phải có / thực tế từ `dayChain`;
  nút Xử lý mở đúng `gapDialog` của Sổ thu chi (qua `stcGapOpen`); Duyệt / Từ chối gọi `app_stc_gap_approve` như trong phiếu.
- Vùng khoá: `so_thu_chi.js` chỉ thêm 2 hàm xuất `stcLoadFor`, `stcGapOpen` (lối vào), không đổi dòng luật nào.
- "Tất cả cơ sở" nạp lần lượt từng cơ sở (5 lần hỏi sổ tháng, vài giây). Nếu chậm khi dùng thật: viết một hàm đọc gọn riêng ở máy chủ (việc sau).
- Nút "Mở ca ›" tới `#/ca/doi-soat?id=…&tab=tien&b=5`.

## Anh Tiến chốt thêm sau khi xem thiết kế (27/11)

- **Anh Tiến chốt thêm 27/11 (sau khi xem thiết kế):**
  - "Quản lý khi đối soát xong sẽ có trạng thái chênh lệch hoặc đã xử lý mới về bảng chênh lệch này" → **chỉ ca đã bấm Hoàn thành đối soát mới vào bảng** (`gapRows` bỏ ca chưa `done`); trạng thái gọi là **Còn chênh lệch** / **Đã xử lý** (+ Chờ Chủ duyệt). Đầu bảng có dòng nhắc "Còn N ca có lệch nhưng quản lý chưa đối soát xong".
  - "Xử lý tại tab luôn, không cần chuyển về ca" → **bỏ nút Mở ca**, chỉ còn chữ nhỏ "xem ca" dưới ngày · ca (anh chọn).
  - "Lệch nhỏ 5k sẽ tự động tạo phiếu chi hoặc phiếu thu luôn" → máy chủ **`190_lech_nho_tu_tao_phieu.sql`**, anh chọn 4 câu: ca **thiếu** → phiếu chi **Quán chịu** (không trừ lương, không cần Chủ duyệt); ca **dư** → phiếu thu **Thu khác**; tạo **khi quản lý bấm Hoàn thành đối soát ca**; **tạo bù cho cả tháng 11**. Mở lại Hoàn thành thì phiếu tự tạo tự huỷ, Hoàn thành lại thì tạo lại. Không tạo khi tháng đã chốt hoặc mục đó đã có cách xử lý. Trên bảng: dòng lệch nhỏ ẩn sẵn (nút "Lệch nhỏ" để xem), ghi "Quán chịu · lệch nhỏ, web tự tạo phiếu".
  - Cách làm ở máy chủ: trigger trên bảng dấu Hoàn thành (`stc_ca_done`) nên mọi đường Hoàn thành / Mở lại đều qua; phiếu = `fin_entries` (không vào quỹ) + `gap_decisions.auto`; `app__gap_rows` nhận thêm lệch nhỏ ĐÃ có phiếu (trạng thái xong); `app_stc_month` trả `auto`. Tạo bù bằng `app__gap_auto_backfill()` (chạy riêng).
  - Chạy thử trên máy chủ thật 27/11 14:22 (tự hoàn tác): tạo bù 127 phiếu ở 112 ca (35 phiếu chi quán chịu = 92.000; 92 phiếu thu khác = 222.700; 0 lỗi; chạy lại không thêm); **Sổ thu chi tổng thu / tổng chi / số dòng, số chênh lệch chờ, số ca đã đối soát của cả 5 cơ sở KHÔNG đổi**; chỉ kết quả tháng có thêm chi quán chịu và thu khác đúng bằng các số đó. Còn 24 dòng "lệch nhỏ" là của ca chưa Hoàn thành.
  - Bài thử: cục bộ `kiem_tra/lech_nho_190_cuc_bo.sql` (14 dòng); `jsc -m kiem_tra/chenh_lech_tinh.mjs` (25); `flow_cl` chu / ql 19 (điện thoại 20), nv 1.
