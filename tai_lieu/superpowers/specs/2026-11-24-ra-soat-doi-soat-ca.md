# Rà soát trang đối soát ca (trước khi thiết kế lại) — 24/11/2026

Anh Tiến yêu cầu (24/11): *"trước khi thiết kế lại toàn bộ hãy rà soát toàn bộ tính năng và các yêu cầu đang có ở đối soát ca cũ vì tất cả yêu cầu ở đây đang đủ; mong muốn rút gọn toàn bộ các thao tác tích, lưu vì mỗi khi tích lưu đều đang tải lại trang mà không lưu trực tiếp; hạng mục nào gộp được thì ưu tiên gộp để tránh nhiều lần tải lại trang."*

Bản dễ đọc cho anh Tiến: https://claude.ai/artifact/92bwxDfX7tBVL6ja9c9PPR. Bản thiết kế "ca khớp hết một màn hình" (phương án A) **tạm dừng**, có thể thành một phần (G8) của bản thiết kế lại.

## 1. Cơ chế tải lại (nguyên nhân chính)

- Khối tiền (`docs/js/pages/so_thu_chi.js`): mọi thao tác lưu đi qua `run(...)` → `after(msg)` = `CACHE = null; showSaved(msg); rerender()` với `rerender` = `render` của `app.js` ⇒ **vẽ lại cả route** `#/ca/doi-soat?id=` (trang ca + khối tiền + nạp lại sổ tháng). Gồm: tích (`data-tick`, `data-dssau`), "tích hết" (`data-tickall`: gọi `app_stc_tick` lần lượt rồi `rerender()`), chọn nhóm chi (`setCat` → `app_tc_check` / `app_stc_entry_save` → `after`), Xác nhận Fabi, Hoàn thành, mọi hộp thêm / sửa / xoá phiếu, xử lý lệch.
- Trang ca (`docs/js/pages/phieu_ca.js`): "Duyệt & tiếp" (`#ds-next`) → `approveStep` (gọi `app_ca_get` rồi `app_ca_check` từng mục) → `rerender()`.
- **Không** tải lại: đổi bước trong khối tiền (`data-dsstep`, `data-dsprev`, `data-dsnext`, `data-dsbook`, `data-dspm` vẽ lại `#stc-ds` bằng `dsBody(D)`), đổi thẻ (`setTab`), mở ảnh (`photoDialog`), đánh giá nhân viên (`mountReportEval` tự vẽ lại phần mình).
- Một lần vẽ lại cả trang ≈ 15 lệnh (đếm nhật ký chiều 23/11, chia theo số ca Hoàn thành): `app_ca_get`, `app_ca_ds_tuan`, `app_ca_ds_con`, `app_ca_kt_state`, `app_ca_auto_locks`, `app_fabi_for_report`, `app_ca_employees`, `app_ca_parts`, `app_ca_overview`, `app_ca_recon`, `app_ca_debt_people`, `app_stc_month` (sổ cả tháng của cơ sở), `app_stc_people`… Mỗi ca Hoàn thành chiều 23/11 kéo theo ~11 lần `app_ca_get` (≈ 11 lần vẽ lại), ~6 lần `app_stc_month`.
- Ước tính ca khớp hết (có "tích hết"): Duyệt & tiếp ×2, tích bước 1, (tích két), Xác nhận Fabi, tích bước 3, tích bước 4, Hoàn thành ⇒ ~10 lần bấm, ~7 lần vẽ lại cả trang; mỗi khoản chi chưa có nhóm thêm 1 lần.

## 2. Toàn bộ việc hiện có (giữ đủ yêu cầu)

### Thẻ ① Phần việc (bước 86, 14/11: đi từng bước "Duyệt & tiếp")
| Bước | Việc | Thao tác / hàm | Tải lại |
|---|---|---|---|
| Ai làm ca | Xem người làm, giờ đến / về (`staffCmp`); sửa giờ / người (bắt buộc lý do) | `app_ca_recon_save` (qua `saveNow`) | theo lần lưu |
| | Duyệt & tiếp | `app_ca_get` + `app_ca_check(nhan_su)` | **cả trang** |
| Nghỉ & làm thay (chỉ khi có — `dsX2`) | QL cơ sở chỉ xem; QL tổng phân loại, Chủ duyệt x2 (`mountCover`, trang Duyệt nghỉ & làm thay chặng 6.2) | — | — |
| Bàn giao | Nhận két ca trước (khớp / lệch → đếm lại cùng người ca trước, lý do) | `app_ca_recon_handover_save`, `app_ca_cash_recount` | theo lần lưu |
| | Hàng kho tổng nhận trong ca (đối soát ở menu Hàng hoá từ 15/11) | `app_ca_check(nhap_hang)` chặn khi còn hàng chưa đối soát | — |
| | Đánh giá nhân viên (không bắt buộc) | `app_dg_report`, hộp nhân viên | không |
| | Duyệt & sang phần tiền | `app_ca_check(ban_giao, nhap_hang)` | **cả trang** |

### Thẻ ② Phần tiền (bước 171, 20/11; bản 6 bước chốt 21/11; về trang ca 23/11 — `caMoney` chế độ một ca)
| Bước | Web tự (mục `dsChecks`) | Quản lý tích (`app_stc_tick`) | Thao tác khác (hàm) — **đều tải lại cả trang** |
|---|---|---|---|
| 1 Số máy Fabi (`partA(…,1)`) | `mo` (2 tầng: NV ↔ Fabi ↔ tiền ca trước để lại), `dt`, `no` (= danh sách khách nợ HĐ, chặng 4), `phanloai` | `anh` (luôn), `hd` (khi có HĐ sửa / xoá) | Lấy số máy (`app_stc_ds_fabi`); Sai, sửa số (`app_stc_fix_request` / `_cancel`, Chủ `_decide`); ca chịu lệch mở ca (`app_stc_ds_blame` / `_undo`); nợ mới: Xếp (`app_stc_debt_sort`), Đổi nhóm, sửa / xoá / thêm nợ (`app_stc_ca_debt_save` / `_delete`); khách trả nợ cũ (`app_ca_recon_debt_collect`), Xoá lần trả (`app_ca_recon_debt_uncollect`) |
| 2 Tiền thực nhận (`partA(…,2)`) | `cash` (Thu theo ca đã nhập), `ck` (kế toán), `ket` (đóng = mở ca sau), `fabi` | `goi` (Thu theo ca hoặc ca cuối ngày) | Thu theo ca / ngày, nhập tiền mặt (`app_stc_ds_cash`); **Xác nhận Fabi** (`app_stc_ds_close`); Mở lại (`app_stc_ds_reopen`) |
| 3 Khoản thu (`partB('thu')`) | — | `tn` (khi có thu nợ), `sot` (luôn) | + Thêm phiếu: Thu khác (`app_stc_move_save`), Thu nợ (`app_ca_recon_debt_collect`), Cho nợ (`app_stc_ca_debt_save`), Luân chuyển (`app_stc_move_exchange`); sửa / xoá; Xoá luân chuyển (`app_stc_move_exchange_delete`) |
| 4 Khoản chi (`partB('chi')`) | `cat` (mọi khoản có nhóm) | `that` (khi có chi), `lon` (khi có khoản ≥ 300.000) | Chọn nhóm (`setCat` → `app_tc_check` / `app_stc_entry_save`); → Trừ lương (`app_tc_move_to_ka`); + Thêm phiếu chi; sửa / xoá |
| 5 Chênh lệch (`gapStep`) | `tm`, `ck5` (lệch ≤ 5.000 coi như khớp) | `ld` (lệch > 5.000), `sau_tm` / `sau_ck` (Để sau) | Phiếu chênh lệch: trừ lương (`app_stc_gap_tl`, chọn người bằng ô tích), quán chịu (`_qc`), gán nợ (`_debt`), ghép ca (`_match`), thu khác (`_thu`), Chủ duyệt (`_approve`), bỏ (`_undo`) |

Nút "✓ Đã xem — tích hết N mục" (chặng 6.3) ở mỗi bước: tích lần lượt rồi vẽ lại cả trang 1 lần.

### Thẻ ③ Hoàn thành (`doneStep`)
Hoàn thành đối soát ca (`app_stc_ds_done` — máy chủ kiểm `app__stc_ds_missing`; khoá khi còn phần việc `ONE.workLeft`, trừ "Chờ Chủ duyệt x2"); Mở lại (`app_stc_ds_undone`); "Ca tiếp theo chưa xong ›" (`app_ca_ds_con`).

### Luật chung
Mục đã tích tự bỏ khi dữ liệu đổi (bước 171); ca chờ kế toán thì chờ (17/11); tháng đã chốt khoá; Chủ "xem như" chỉ đọc; quyền đối soát: Chủ / QL tổng / QL cơ sở (`app__ca_auto_ok`, `app__need('doi_soat')`); máy chủ kiểm lại khi Xác nhận Fabi (`app_stc_ds_close`) và Hoàn thành (`app_stc_ds_done` → `app__ca_auto_finish`).

## 3. Đề xuất rút gọn (giữ đủ yêu cầu) — chờ anh Tiến chọn

| Mã | Đề xuất | Ghi chú kỹ thuật |
|---|---|---|
| G1 | Tích = lưu ngay, không tải lại | Sau `app_stc_tick` thành công: sửa `c.ticks` trong `D`, vẽ lại `#stc-ds` (`dsBody(D)`) + thanh bước; không `load()` / `render()`. Tích không đổi số tiền nên không cần nạp lại. |
| G2 | Chọn nhóm chi = lưu ngay, chỉ đổi dòng đó | Sau `setCat`: sửa `x.cat` trong `D.items`, vẽ lại `#stc-ds`; mục `cat` tự tính lại. |
| G3 | Phần việc một nút "Duyệt phần việc" | Khi không `dsX2`, nhận két khớp: duyệt `nhan_su`, `ban_giao`, `nhap_hang` một lần (một hàm máy chủ hoặc gọi liền), không `rerender()`. |
| G4 | Xác nhận Fabi kiêm các ô tích bước 1–2 | Nút Xác nhận gửi kèm `anh` / `goi` đang hiện; máy chủ tích rồi xác nhận trong một giao dịch. |
| G5 | Bước 3 + 4 thành một màn hình "Thu chi của ca", một nút "Đã xem thu chi" | Tích `sot` + `that` khi không có `tn`, `lon`. |
| G6 | Hoàn thành xong tự mở ca tiếp theo | Như thiết kế A mục 5.4 (lấy lại `app_ca_ds_con`). |
| G7 | Thao tác đổi tiền chỉ nạp lại số của đúng ca | Cần hàm đọc một ca cùng dạng dữ liệu `app_stc_month` cho ca đó (vùng khoá — so cũ / mới giống hệt); khối tiền thay phần của ca trong `D`; không vẽ lại trang ca, bảng tuần. |
| G8 | Ca khớp hết một màn hình, một nút | Thiết kế A (`2026-11-24-doi-soat-nhanh-ca-khop-design.md`). |

Không gộp: `hd`, `tn`, `lon`, `ld` + phiếu chênh lệch, sửa số máy (Chủ duyệt), xếp nợ khác.

Dự kiến: ca khớp hết ~10 lần bấm / ~7 lần tải lại → ~4 lần bấm, không tải lại cả trang (G1–G7), 1–2 lần bấm (thêm G8); ca có vấn đề giữ việc như cũ nhưng không chờ tải lại.
