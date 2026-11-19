# Khách trả nợ một lần + ghi rõ thời gian trả — thiết kế (19/11/2026)

## Vì sao
Anh Tiến muốn ở mọi chỗ có khách nợ đều ghi rõ **trả lúc nào**. Khi bàn cách ghi khoản trả nhiều lần, anh chốt luôn luật mới: **mỗi khoản nợ chỉ trả một lần, trả đủ cả khoản**. Như vậy mỗi khoản chỉ có một thời gian trả, sổ gọn, không có khoản bị tách lắt nhắt.

## Luật mới (anh chốt: cách 2 + A)
- Khách trả nợ thì trả **đủ cả khoản**. Web không còn tách một khoản thành phần đã trả và phần còn lại.
- **Khách đưa thiếu** (nợ 100.000, đưa 60.000): ghi khoản cũ **đã trả đủ 100.000**, đồng thời tạo **khoản nợ mới 40.000** cùng tên / SĐT, ghi chú "Còn thiếu khi trả nợ <ca gốc>". Web **hỏi trước** ("Khách đưa thiếu 40.000 — ghi phần còn thiếu thành nợ mới?"), không tự làm.
  - Trả bằng tiền mặt → nợ mới loại **TM** (trừ két / trừ quỹ). Trả chuyển khoản → nợ mới loại **CK**. Tiền két / quỹ vẫn đúng: +100.000 thu nợ, −40.000 cho nợ = +60.000 thực nhận.
  - Ở phiếu chốt ca: nợ mới nằm trong ca đó (hiện ở bước Khách nợ, ca sau được nhắc thu).
  - Ngoài ca (Công nợ, Sổ thu chi): nợ mới là khoản quản lý ghi, tiền đưa từ quỹ (như "Cho nợ" ngoài ca hiện nay).
- **Phiếu chênh lệch ca dư › gán nợ khách trả**: chỉ gán được khi két dư **đủ cả khoản**. Dư ít hơn thì vẫn là chênh lệch dư như thường.
- Dữ liệu thật hiện **chưa có khoản nào bị tách**, nên không phải sửa số cũ.

## Ghi thời gian trả (anh chọn cách A: ngày + ca)
Mỗi khoản đã trả ghi một dòng: `đã trả · 20/11 ca Sáng · tiền mặt`. Trả ngoài ca: `đã trả · 20/11 · quản lý thu · tiền mặt`. Hiện ở:

| Chỗ | Bây giờ | Sau |
|---|---|---|
| Sổ thu chi › Đối soát Fabi › phần A (danh sách nợ của ca) | "đã trả" | `đã trả · 20/11 ca Sáng · tiền mặt` |
| Sổ chi › dòng Cho nợ | "Đã thu hết" | `Đã thu · 20/11 ca Sáng · tiền mặt` |
| Phiếu chốt ca › bước Khách nợ (khoản báo nợ đã được trả ở ca sau) | "Đã thu" | `Đã thu 20/11 ca Sáng` |
| Công nợ | `Trả 20/11 · Tiền mặt · ca Sáng` | giữ, chỉ sắp lại cho giống: `Trả 20/11 ca Sáng · tiền mặt` |

Bỏ "còn nợ X" / "Đã thu X · còn nợ Y" (không còn trả một phần).

## Không làm
- Không đổi cách tính tiền két / quỹ, không đổi khoá Chốt ca hay quyền.
- Không sửa vùng khoá tiền đối soát. Phần phiếu chốt ca cần thêm ngày / ca trả vào danh sách nợ của `app_ca_get`, đây là phần danh sách nợ, không phải phần quyền. Nếu hook vẫn chặn thì dừng lại hỏi anh Tiến.

## Phần máy chủ (tệp 141, chạy lại nhiều lần không sao)
- **Chặn chung:** trigger trên `shift_debts` không cho thêm dòng có `split_from` (mọi đường tách nợ cũ đều bị chặn, kể cả đường cũ không còn nút). Lời báo: "Khách phải trả đủ cả khoản nợ — đưa thiếu thì ghi phần còn thiếu thành nợ mới."
- **Phiếu chốt ca** (`app_ca_debt_collect_part`): số trả < số nợ → đóng khoản cũ với đủ số tiền + thêm nợ mới vào chính phiếu (TM / CK theo cách trả), trả về id nợ mới để web thêm vào danh sách báo nợ (nếu không thì lúc lưu phiếu, web sẽ xoá dòng không có trong danh sách). Đổi kiểu trả về thì làm hàm mới.
- **Ngoài ca** (`app_cn_debt_collect`, và `app_cn_collect_many` gọi nó): số trả < số nợ → đóng đủ + nợ mới ngoài ca, tiền đưa từ quỹ (`fund_out`), ngày = ngày thu.
- **Gán nợ ở phiếu chênh lệch** (`app_stc_gap_debt`): số gán phải bằng số nợ.
- **Ngày / ca trả:** `app_stc_month` (`ca_debts` dòng `moi` + dòng Cho nợ) và `app_ca_get` (danh sách nợ của phiếu) trả thêm `paid_date`, `paid_shift` (null nếu quản lý thu), `pm`.

## Phần giao diện
- Phiếu chốt ca: khi số khách trả nhỏ hơn số nợ, hiện dòng "Còn thiếu X → ghi thành nợ mới"; bấm thì hỏi xác nhận, xong thì khoản mới hiện ở bước Khách nợ.
- Công nợ › Đã thu và Sổ thu chi › + Thêm phiếu › Thu nợ: cũng hỏi như trên.
- Phiếu chênh lệch: chỉ liệt kê nợ có số ≤ phần dư, số tiền cố định bằng số nợ.
- Các dòng hiển thị thời gian trả như bảng trên. Điện thoại 390px không tràn ngang.

## Kiểm tra
- Máy chủ (chạy thử tự hoàn tác): thêm dòng tách → bị chặn; trả thiếu ở phiếu / ngoài ca → khoản cũ đóng đủ + nợ mới đúng loại, đúng số; tiền két / quỹ của ca không đổi so với trước; gán nợ thiếu → báo lỗi; `ca_debts` có ngày / ca trả.
- Trình duyệt: bài thử mới cho 4 chỗ hiển thị + hộp hỏi khi trả thiếu (phiếu chốt ca, Công nợ, Sổ thu chi); chạy lại `flow_stc6/7/9/10`, `flow_cm84`, `flow_cn95`, và `flow_ql_tu_ds` (vì có đụng phiếu chốt ca).

## Để người làm tự quyết
Câu chữ cụ thể, ghi chú của nợ mới, cách hiện hộp hỏi.
