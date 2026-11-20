# Sửa khoản nợ của ca ở bước 1 (Đối soát Fabi) — thiết kế ngắn

Ngày: 20/11/2026 · Gộp vào bước 172 đợt B (nhánh `dot-b/nguoi-no`) · Trạng thái: **anh Tiến duyệt 20/11** — làm sau khi phiên đang làm đợt B xong Task 6 (mục 10)

## 1. Vì sao

Từ bước 152 (19/11) phần tiền chuyển sang Sổ thu chi › Đối soát Fabi; trang Đối soát ca cũ không còn chỗ sửa khách nợ. Khoản nợ nhân viên ghi trong ca (vd "Khách mượn – khách nợ bàn 5", Nợ TM) hiện ở bước 1 chỉ xem được, và hiện lại ở bước 4 / Sổ chi thành một dòng khoá ghi "sửa ở phiếu ca" — chỗ đó quản lý không còn vào được. Kết quả: khoản nợ tiền mặt / chuyển khoản của ca ghi sai thì **không có chỗ nào sửa**. Anh Tiến phát hiện 20/11 (ca ĐK 1/11) và đồng ý cho sửa ở bước 1.

## 2. Anh Tiến đã chốt (20/11)

1. Sửa ở **bước 1**, khung Nợ của ca; gộp vào đợt B.
2. Cả 4 kiểu sai đều gặp thật: sai số tiền · sai loại nợ · không phải nợ · quên ghi.
3. Sửa được **tới khi bấm Hoàn thành** ở bước 6 (kể cả sau Xác nhận Fabi; số lệch bước 5 tự tính lại). Đã Hoàn thành thì phải Mở lại.
4. **Không cho sửa nợ hoá đơn (HĐ)**: số tiền, loại, xoá, thêm đều không. Nợ HĐ chỉ đổi người nợ + nhóm công nợ (việc "Xếp" của đợt B).
5. Quản lý sửa thẳng, **lý do bắt buộc** (như sửa khoản thu chi của ca), không qua Chủ duyệt.

## 3. Mục tiêu / ngoài phạm vi / tuyệt đối tránh

**Mục tiêu:** với khoản nợ **tiền mặt (TM, `muon`)** và **chuyển khoản (CK, `ck`)** ghi trong ca, người đối soát ca làm được ở bước 1:
- **Sửa** số tiền và loại (TM ↔ CK).
- **Xoá**.
- **Đổi thành Luân chuyển TM – CK** (chỉ khoản TM: thực ra khách chuyển khoản rồi rút tiền mặt).
- **Thêm** khoản nợ TM / CK nhân viên quên ghi.

**Ngoài phạm vi:** nợ HĐ (mục 2.4); phiếu chốt ca của nhân viên; "+ Thêm phiếu › Cho nợ trong ca" ở bước 4 (đợt D — đợt D dùng lại hàm thêm của bản này); dòng đổi tiền và khoản chi đã thành nợ (cũng đang ghi "sửa ở phiếu ca") — xem mục 9. Lương trả tiền mặt không sửa số ở đây (chỉ đổi chữ dòng khoá — mục 6).

**Tuyệt đối tránh:**
- Quản lý đổi được ô Nợ bill (tổng nợ HĐ) mà không qua Chủ.
- Sửa nợ làm sổ và công nợ nói hai số khác nhau (dòng bước 4 / Sổ chi phải tự đổi theo).
- Sửa được khoản nợ khách đã trả, ca đã Hoàn thành, ca đã 🔒 Chốt, tháng đã chốt.
- Mở thêm quyền cho người hiện không đối soát được ca.

## 4. Các cách đã cân nhắc

| Cách | Được | Mất | Chọn |
|---|---|---|---|
| **A. Hàm máy chủ `app_stc_ca_debt_*` mới + nút ở khung Nợ của ca (bước 1)** | Một chỗ sửa, đúng nơi khoản nợ hiện ra; gác bằng đúng luật của Đối soát Fabi (`app__stc_ds_need`, dấu Hoàn thành, Chốt ca) | Viết 3 hàm mới | ✅ anh Tiến chọn |
| B. Mở lại phần Khách nợ ở trang Đối soát ca cũ (hàm tệp 99 / 101) | Ít mã mới | Trái quyết định 19/11 (phần tiền chỉ ở một trang); hàm cũ gác theo luật trang cũ (`app__need('doi_soat')`, mục đã duyệt) | ✗ |
| C. Mở khoá nút Sửa / Xoá ngay trên dòng "Khách mượn" ở bước 4 | Sửa ngay chỗ thấy sai | Dòng đó là dòng web tự sinh từ khoản nợ; hai chỗ cùng sửa một thứ; nợ CK không có dòng `m:` | ✗ |

## 5. Luật (máy chủ gác, giao diện làm theo)

**Ai:** người qua được `app__stc_ds_need(<ca>, false)` — Chủ, Quản lý tổng, quản lý đối soát của cơ sở đó. Giống hàm `app_stc_debt_sort` của đợt B. Không đụng `app_can`, `role_permissions`, `app__stc_can`, `app__stc_need`, `app__ca_auto_ok`.

**Ca:** nhân viên đã gửi phiếu; **chưa Hoàn thành** (`stc_ca_done`) → lỗi "Ca đã hoàn thành đối soát — bấm Mở lại trước."; chưa 🔒 Chốt ca (trigger tệp 135 đã gác `shift_debts` — người làm xác minh, thiếu thì tự kiểm trong hàm); tháng chưa chốt (`app__fin_locked`). Trước và sau Xác nhận Fabi đều sửa được.

**Khoản nợ sửa / xoá / đổi được:** thuộc ca này (`report_id`), là khoản gốc (`split_from is null`), loại `muon` hoặc `ck`, **chưa thu đồng nào** (chưa đóng, không có khoản con). Đã thu (một phần hay hết, kể cả đã "→ Gia đình") → lỗi "Khách đã trả khoản này — Huỷ thu ở Sổ thu trước rồi mới sửa." Loại `bill` → lỗi "Nợ hoá đơn không sửa ở đây — số tiền đi theo ô Nợ bill."

**Sửa:** số tiền > 0; loại chỉ `muon` / `ck`; không đổi tên người (đổi người = "Xếp"). Không đổi gì → lỗi "Chưa đổi gì."
**Thêm:** loại `muon` / `ck`; người nợ **phải chọn trong danh sách** (`debt_people`, còn dùng) + nhóm công nợ; số tiền > 0; nội dung. Tạo xong coi như đã xếp (`person_id`, `grp`, `sorted_by`, `sorted_at`).
**Đổi thành Luân chuyển (chỉ `muon`):** xoá khoản nợ, thêm vào bản đối soát của ca một cặp đổi tiền cùng `exchange_key`: −TM và +CK, nội dung "Khách CK rút tiền mặt – <tên>" (đúng cách tệp 101 đang làm, kể cả `app__ca_validate_exchanges`, `app__ca_exchange_cats`). Khác tệp 101: khoản đã có khách trả thì **từ chối** (không tự gỡ khoản trả ở ca sau).
**Lý do:** bắt buộc cho cả 4 việc (`app__stc_reason`).

**Tiền của ca:** dòng "Khách mượn" (TM) và "Nợ CK" ở bước 4 / Sổ chi là dòng tính ra từ `shift_debts` nên tự đổi theo; tiền phải có và số lệch bước 5 tính lại theo dữ liệu mới. Người làm phải **xác minh trên máy chủ cục bộ** rằng sau Xác nhận Fabi, sửa nợ cho ra số lệch đúng bằng phần thay đổi — và làm **giống hệt cách `app_stc_move_save` đang xử lý** khi sửa khoản thu chi sau xác nhận (kể cả trường hợp chênh lệch của ca đã có phiếu chênh lệch, và các mục kiểm tra tay tự bỏ tích khi dữ liệu đổi theo mục 6 của thiết kế 6 bước). Khác biệt nào so với `app_stc_move_save` ghi vào "Em đã tự quyết".

**Ghi vết:** `shift_recon_log` (`bao_no_sua` / `bao_no_xoa` / `bao_no_them`, trước / sau, lý do có tiền tố "Sổ thu chi: ") + `app__stc_log` + `app_log`. `app_stc_month.ca_debts` trả thêm cho mỗi khoản: `edit` (việc, ai, lúc nào, số cũ, loại cũ, lý do) và các khoản đã xoá / đã đổi của ca (`t = 'xoa'`), lấy từ `shift_recon_log`.

## 6. Giao diện (khung Nợ của ca, bước 1)

```
Nợ mới trong ca · 2 khoản
[TM] khách nợ bàn 5 · két thiếu                 300.000   [Sửa / Xoá]
     Quản lý sửa · 500.000 → 300.000 · Hà · lý do: ghi nhầm
     (… ô Xếp người + nhóm của đợt B …)
[HĐ] Anh Vinh                                    120.000   🔒 Nợ hoá đơn — số tiền theo ô Nợ bill
[TM] Chị Hoa · đã trả 03/11 ca Tối · tiền mặt   128.000   🔒 Khách đã trả — Huỷ thu ở Sổ thu mới sửa được
̶[̶C̶K̶]̶ ̶K̶h̶o̶ ̶t̶ổ̶n̶g̶ ̶ ̶2̶0̶0̶.̶0̶0̶0̶   Đã xoá · Hà · 21:10 · lý do: ghi trùng
[+ Thêm khoản nợ quên ghi]
```

- **Sửa / Xoá** mở hộp: Số tiền · Tiền mặt / Chuyển khoản · Lý do (bắt buộc) · **Lưu** · **Xoá khoản nợ** · với khoản TM thêm **Đổi thành Luân chuyển TM – CK** (hỏi xác nhận).
- **+ Thêm khoản nợ quên ghi** mở hộp: Tiền mặt / Chuyển khoản · Người nợ (ô chọn `personSelect` của đợt B) · Nhóm công nợ · Số tiền · Nội dung · Lý do. Khung hiện cả khi ca chưa có khoản nợ nào (với người sửa được).
- Nút chỉ hiện khi người xem đối soát được ca, ca chưa Hoàn thành / chưa Chốt, tháng chưa chốt, không phải chế độ xem như người khác (`D.ext`). Còn lại: chỉ xem như hiện nay.
- Khoản quản lý thêm có nhãn **Quản lý ghi**.
- **Dòng khoá ở bước 4 và Sổ chi** của khoản khách mượn: đổi chữ thành "🔒 Khách mượn — sửa ở bước 1 · Nợ của ca"; trong tab Đối soát Fabi chữ "bước 1" là nút nhảy về bước 1 (`data-dsstep="0"`), ở tab Sổ chi là chữ thường "Đối soát Fabi › bước 1".
- **Dòng khoá "Lương trả tiền mặt"** (anh Tiến giải thích 20/11): số này lấy từ ô "Đã trả lương tiền mặt" của nhân viên hỗ trợ phát sinh có đánh dấu trả lương tiền mặt (thêm người qua danh sách gợi ý ở phần nhân sự của ca). Ô đó vẫn sửa được ở trang **Đối soát ca › bước Ai làm ca** (`staffRow`, `edFor('nhan_su')` trong `phieu_ca.js` — người làm bấm thử xác nhận lại). Đổi chữ dòng khoá thành "🔒 Lương tiền mặt — sửa ở Đối soát ca › Ai làm ca", có liên kết mở đúng ca ở trang Đối soát ca nếu dễ làm.
- Dòng đổi tiền và khoản chi đã thành nợ giữ chữ cũ (mục 9).
- Điện thoại 390px không tràn ngang.

## 7. Máy chủ

- Tệp mới `supabase/152_sua_no_cua_ca.sql` (xem lại số lớn nhất trong `app_migrations` lúc phát hành), chạy lại nhiều lần không lỗi, dòng cuối ghi `app_migrations`.
- `app_stc_ca_debt_save(p_report bigint, p_debt bigint, p jsonb, p_reason text) returns bigint` — `p_debt` trống = thêm.
- `app_stc_ca_debt_delete(p_report bigint, p_debt bigint, p_reason text)`.
- `app_stc_ca_debt_to_exchange(p_report bigint, p_debt bigint, p_reason text)`.
- `app_stc_month`: vá `ca_debts` thêm `edit` + các khoản `t = 'xoa'` (vá đúng chỗ như tệp 140 / 151). Sổ tháng trước / sau tệp này giống hệt, trừ các khoá mới.
- Không sửa các hàm cũ `app_ca_recon_debt_*`, không sửa `app_stc_move_save`.
- Trigger gác tên của tệp 151 vẫn áp dụng cho khoản thêm mới.

## 8. Kiểm tra

- **Máy chủ cục bộ** (`kiem_tra/may_chu_cuc_bo/`): mỗi việc × (trước / sau Xác nhận Fabi) cho ra tiền phải có và số lệch đổi đúng bằng phần thay đổi; từ chối khi: ca Hoàn thành, ca Chốt, tháng chốt, khoản đã thu / đã tách, khoản HĐ, khoản của ca khác, thiếu lý do, người không đối soát được ca (nhân viên, quản lý cơ sở khác); thêm với tên ngoài danh sách bị từ chối; đổi thành Luân chuyển tạo đúng một cặp −TM / +CK. Không sửa gì thì sổ tháng giống hệt bản trước.
- **Trình duyệt** `flow_ds172` (thêm phần): sửa số tiền → dòng bước 4 đổi theo, bước 5 tính lại; đổi TM → CK; xoá → hiện dòng gạch ngang; đổi thành Luân chuyển → bước 4 có cặp Luân chuyển; thêm khoản quên ghi; HĐ và khoản đã trả không có nút; vai nhân viên không thấy nút; ca Hoàn thành không có nút, Mở lại thì có; dòng khoá bước 4 nhảy về bước 1; 390px.
- Bài phải **hỏng trên bản cũ** trước khi sửa. Chạy đủ bộ của đợt B + **vùng khoá**: `flow_ql_tu_ds` (ql, chu × `index.html`, `test/phone.html`), `flow_stc6`, `flow_stc7` (chu / qlt / ql).

## 9. Để ngỏ — cần anh quyết sau (không chặn việc này)

1. **Đổi tiền, khoản chi đã thành nợ** cũng đang ghi "sửa ở phiếu ca", có thể cũng không còn chỗ sửa — chưa xem kỹ, chưa làm trong đợt này. (Lương trả tiền mặt: không hổng, sửa ở Đối soát ca › Ai làm ca — mục 6.)
2. **Nợ hoá đơn quên ghi / ghi sai**: chờ đợt C (nút "Sai, sửa số" ở ô Nợ bill, Chủ duyệt). Khi đó cần chốt thêm: đổi ô Nợ bill rồi thì danh sách khách nợ HĐ sửa theo thế nào.

## 10. Thứ tự làm

Khung Nợ của ca cũng là chỗ Task 6 của kế hoạch đợt B sửa (`debtList`), nên làm **sau Task 6**, thành các việc 6b (máy chủ) · 6c (giao diện) trước Task 7 (tài liệu + phát hành chung). 20/11 21:04 đang có một phiên AI khác làm dở đợt B ngay trong thư mục này (vừa lưu việc 4/7, đang sửa việc 5) — không sửa mã song song.

## 11. Em tự quyết (anh xem, sai thì sửa)

1. Khoản khách đã trả: từ chối, phải Huỷ thu trước (không tự gỡ khoản trả như tệp 101) — an toàn hơn.
2. Đổi loại chỉ giữa TM ↔ CK; không đổi sang / từ HĐ (vì làm đổi tổng Nợ bill).
3. Khoản quên ghi thêm ngay ở bước 1, người nợ bắt buộc chọn từ danh sách.
4. Khoản đã xoá vẫn hiện gạch ngang kèm ai xoá + lý do.
5. Tệp máy chủ riêng 152, không sửa tệp 151.
