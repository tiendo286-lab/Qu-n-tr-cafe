# Đối soát Fabi + Chốt ca vĩnh viễn + Khoản treo (Sổ thu chi mới)

Ngày: 19/11/2026 · Người duyệt: anh Tiến (duyệt qua bản mẫu bấm thử, yêu cầu "đưa toàn bộ lên web") · Vùng khoá: anh Tiến mở bằng mật khẩu 19/11.
Bản mẫu cục bộ (không đưa lên GitHub): `mau-doi-soat-fabi-18.html`, dựng trên mẫu 18/11 (https://claude.ai/artifact/6L53uqto8BgLHgBSLh744E).
Thay mục 3.3 của `2026-11-18-so-thu-chi-moi-design.md`.

## 1. Vì sao
- Tab "Đối soát tiền" đang gộp 3 việc: so Fabi, xác định tiền thực nhận, và tính / xử lý chênh lệch. Anh Tiến muốn tách ra:
  - Phần Fabi chỉ dùng để xác định **phiếu đúng**, **tiền mặt thực nhận**, **chuyển khoản thực nhận**.
  - **Mọi việc chênh lệch** xử lý trong thu chi của ca.
- Cần thêm bước **Chốt ca khoá vĩnh viễn**: chốt xong không ai sửa được thu chi, phiếu chênh lệch, số Fabi của ca.
- Tiền còn chờ không được làm ca treo không chốt được. Phần đó tách thành **Khoản treo**.

## 2. Mục tiêu / không làm / thất bại nếu
- Mục tiêu: mỗi ca làm trên một màn theo thứ tự A · Fabi → B · Thu chi của ca → 🔒 Chốt ca. Ca đã chốt bị máy chủ chặn **mọi** đường sửa. Khoản treo xử lý về sau mà không đụng ca gốc.
- Không làm:
  - Chưa gỡ trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ, Đối soát ca phần tiền) — vẫn chạy song song.
  - Không đổi cách tính `app__ca_money`, `app__gap_rows`.
  - Không có nút mở lại Chốt ca.
- Thất bại nếu:
  - Ca đã chốt vẫn đổi số qua một đường nào đó: trang cũ, tải lại file Fabi, ghép.
  - Sổ quỹ không khớp tiền thật.
  - Ca không chốt được chỉ vì khách chưa chuyển tiền.

## 3. Đã chốt với anh Tiến (qua bản mẫu)

### 3.1 Tab "Đối soát Fabi" (đổi tên từ "Đối soát tiền", khoá đường dẫn `tab=doi-soat` giữ nguyên)
- Bảng ngày × ca như cũ. Trạng thái ô:
  - ⏳ Chờ kế toán
  - 🔴 Còn ô đỏ Fabi
  - 🟡 Chờ xác nhận Fabi
  - 🔵 Fabi ✓ · chưa chốt ca
  - 🔒 Đã chốt ca (thêm chữ "có khoản treo" nếu còn khoản treo mở)
- Ô đếm đầu trang: Ca đã chốt x/y · Fabi ✓ chưa chốt · Khoản treo · Chờ xác nhận Fabi · Còn ô đỏ · Chờ kế toán.
- Chọn ca thì khung ca mở **rộng hết trang** dưới bảng (bỏ cột phụ bên phải ở tab này). Khung gồm 3 phần dưới đây.

**A · Fabi**
- ① So phiếu nhân viên với máy Fabi: Tiền mở ca, Doanh thu, Nợ bill.
  - Mỗi ô ghi "Phiếu nhân viên ghi: X" / "Máy Fabi ghi: Y".
  - Nhãn: "Nhân viên ghi thiếu / thừa Z so với máy".
  - Nút **"Lấy số máy Fabi"** (đổi tên từ "Sửa theo Fabi"). Ô Nợ, nếu máy nhiều hơn: "(thêm báo nợ Z)".
  - Có nút Huỷ cho mỗi lần đã lấy số.
  - Tiền mở ca: khi máy khác số phải là thì chọn "Ca trước ghi sai" / "Ca này ghi sai" (luật cũ), có nút Huỷ chọn.
  - Mỗi ô ghi rõ có ảnh hưởng tới sổ hay không:
    - Lệch mở ca → dòng Chênh lệch tiền mặt của ca được chọn.
    - Doanh thu → phiếu thu không đổi, vì sổ luôn lấy doanh thu máy Fabi.
    - Báo nợ → thêm khách nợ ở Công nợ, không tạo phiếu chi.
  - Cảnh báo hoá đơn bị sửa / xoá trên Fabi nằm ở **khung vàng riêng** dưới ①, không gắn vào ô Doanh thu.
- ② Tiền thực nhận: thu theo ca / theo ngày; tiền mặt quản lý đếm; chuyển khoản = số ngân hàng kế toán nhập (như cũ).
- **"Xác nhận Fabi"** (đổi tên từ "Chốt tiền ca", vẫn là `app_stc_ds_close`). Xác nhận xong phần A thu gọn thành 5 ô số: tiền mở ca, doanh thu máy, nợ bill (kèm "gồm báo nợ thêm X"), tiền mặt thực nhận, chuyển khoản thực nhận.
- **"Mở lại xác nhận"** (`app_stc_ds_reopen`): không bấm được khi đã Chốt ca.

**B · Thu chi của ca** — chưa xác nhận Fabi thì khoá, như luật hiện nay.
- Giống tab Sổ thu / Sổ chi, chỉ lọc ca này:
  - Nút Sổ thu | Sổ chi.
  - Hai ô Bảng Tiền mặt | Bảng Chuyển khoản (tổng của ca).
  - Dòng công thức, ô số từng cột.
  - Bảng cột với một dòng ca luôn mở, từng khoản dùng đúng `itemRow` của sổ (Sửa / Xoá, phiếu bổ sung, nhóm chi, người nợ…).
  - "+ Thêm phiếu" (ngày + ca cố định theo ca đang đối soát, lý do bắt buộc).
- Bảng **Tiền của ca**: phải có / thực tế / lệch, TM | CK.
- Khung **Nợ bill của ca** (chưa phải tiền, không vào sổ): nhân viên khai + báo nợ thêm = nợ bill theo máy. Khoản nợ nằm ở "Khách đang nợ".
- **Chênh lệch là khung riêng dưới sổ**, theo đúng bảng và đúng sổ:
  - Tiền mặt chỉ ở bảng Tiền mặt, chuyển khoản chỉ ở bảng Chuyển khoản.
  - Dư (+) ghi Sổ thu, thiếu (−) ghi Sổ chi.
  - Mỗi nguồn lệch một dòng, **không gộp**: lệch đếm két / ngân hàng; lệch tiền mở ca; lệch phát sinh do sửa / xoá / thêm phiếu.
  - Đầu phần B có dòng nhắc "⚠ Ca còn chênh lệch ở: Sổ chi · Tiền mặt −X". Bấm vào thì chuyển sổ / bảng.
  - Phiếu chênh lệch mở tại chỗ (trừ lương / quán chịu / ghép / phiếu thu / gán nợ — hàm `app_stc_gap_*` có sẵn).
- Sửa / xoá / thêm phiếu thì **lệch tự tính lại**. Máy chủ đã làm vậy: tiền thực tế giữ nguyên, "phải có" đổi. Phần lệch mới hiện đúng dòng (xem 5.4).
- **Khôi phục**: phiếu đã xoá có nút "↺ Khôi phục phiếu"; phiếu đã sửa có "↺ Huỷ sửa (trả lại phiếu cũ)". Chỉ khi ca đã xác nhận Fabi và **chưa Chốt ca**. Ghi nhật ký.

**🔒 Chốt ca** ở cuối khung.
- Điều kiện, máy chủ kiểm lại:
  1. Đã xác nhận Fabi.
  2. Mọi khoản chi của ca đã phân loại.
  3. Không còn khoản chờ Chủ duyệt (quán chịu / ghép của ca).
  4. Tiền mặt thiếu còn lại = 0 (đã trừ lương / quán chịu / ghép).
- Hộp xác nhận liệt kê từng điều kiện, báo khoản nào sẽ thành Khoản treo, và cảnh báo "không sửa được nữa, không có nút mở lại".
- Chốt xong: khung xanh "🔒 Đã chốt ca · ai · lúc nào". Mọi nút sửa ẩn ở cả tab Đối soát Fabi lẫn Sổ thu / Sổ chi chung. Máy chủ chặn mọi đường sửa.

### 3.2 Khoản treo (tạo khi Chốt ca, từ phần lệch còn lại)
| Loại | Từ | Hạn | Xử lý |
|---|---|---|---|
| Chờ tiền về | CK thiếu còn lại (`cho_tien`) | **3 ngày** (sau đó đỏ "quá hạn") | **Đã về**: chọn ca đã xác nhận Fabi, chưa chốt, có CK dư → ghi quyết định "bù khoản treo" lên ca đó. **Quá hạn**: Trừ tiền nhân viên / Quán chịu (Chủ duyệt như cũ) |
| Tiền thừa chờ ghép | Phần dư còn lại (`du`, TM hoặc CK) | **hết tháng** | **Ghép với ca thiếu**: chọn ca thiếu (cùng loại tiền, đã xác nhận Fabi, chưa chốt) → quyết định "bù khoản treo" lên ca thiếu. Hết tháng chưa ghép → tự thành **Thu khác** (chỉ đổi tên gọi) |

- Khách nợ không cần khoản treo: đã ở Công nợ.
- Tab **Tổng**: ô "Khoản treo (n · tổng · số quá hạn)" và khung "Khoản treo" bên phải (ca gốc bấm được). Khoản đã xử lý ghi kết quả.

### 3.3 Sổ thu / Sổ chi chung
- Ca chưa xác nhận Fabi: "🔒 Chưa xác nhận Fabi — Xác nhận & chốt ca này ở Đối soát Fabi ›".
- Ca đã xác nhận, chưa chốt: thêm nút "Xử lý & chốt ca này ở Đối soát Fabi ›".
- Ca đã chốt: "🔒 Ca đã chốt" thay cho mọi nút.
- Sổ thu bên phải đã có "Khách đang nợ" (giữ).
- Các chữ "Chốt tiền ca ở tab Đối soát tiền…" đổi thành "Xác nhận Fabi ở tab Đối soát Fabi…".

## 4. Các hướng đã cân nhắc
**Khoá ca vĩnh viễn**
- (a) Thêm kiểm tra vào từng hàm sửa: nhiều hàm cũ và mới, dễ sót.
- (b) **Trigger trên bảng, giống khoá tháng `fin_guard`** ← chọn. Có tiền lệ từ bước 24 / 29; chặn được cả trang cũ lẫn tải lại Fabi.
- (c) Chụp số lúc chốt: nặng, và vẫn phải chặn sửa.

**Khoản treo không đụng ca gốc**
- (a) Ghép thẳng (`gap_matches`) với ca gốc: loại, vì làm đổi số chênh lệch của ca đã khoá.
- (b) **Ghi quyết định lên ca đang mở** (`gap_decisions.kind = 'treo'`) ← chọn. Cả tháng cộng lại vẫn đúng, ca gốc không đổi.
- Trừ lương / quán chịu cho khoản treo quá hạn ghi lên ca gốc qua một **đường được phép riêng** (cờ phiên `app.stc_treo`). Việc này chỉ đổi trạng thái, không đổi số chênh lệch trong sổ.

## 5. Máy chủ (tệp mới, số = `max(app_migrations)+1`, hiện dự kiến `135_doi_soat_fabi_chot_ca.sql`) — VÙNG KHOÁ
1. Bảng `stc_ca_finals(report_id pk, by_account, at)` và bảng `stc_treo(id, report_id, item, kind 'tien'|'thua', amount, created_at, created_by, status 'mo'|'xong', done_kind, done_note, done_at, done_by)`. RLS bật, thu hồi quyền.
2. `gap_decisions`:
   - Thêm cột `treo_id`; ràng buộc kind thêm `'treo'`.
   - Dò mọi chỗ đọc `gap_decisions.kind`: `app__gap_rows` cộng `dcs` mọi kind (đúng), trang Lệch tiền ca cũ, Chốt tháng, `app_stc_month`. Kind `treo` không tạo `fin_entries`, không tính chi phí.
3. Hàm `app__stc_final(p_report) → boolean` và trigger `stc_final_guard` (BEFORE INSERT/UPDATE/DELETE):
   - Chặn trên các bảng tiền gắn `report_id`. Danh sách chốt khi lập kế hoạch bằng cách dò mọi bảng có cột `report_id` mà sổ / đối soát đọc.
   - Với `shift_reports`: chặn UPDATE khi ca đã chốt, trừ cột không phải tiền (dò khi lập kế hoạch).
   - Với `gap_matches`: kiểm cả `short_report` và `over_report`.
   - Bỏ qua khi `current_setting('app.stc_treo', true) = '1'`, nhưng chỉ cho `shift_shortfalls`, `stc_gap_requests`, `gap_decisions` (đường khoản treo quá hạn).
4. `app_stc_ca_final(p_report)`:
   - Quyền như `app__stc_ds_need` (Chủ / QL tổng / QL đối soát cơ sở), tháng chưa chốt, phiếu đã gửi.
   - Kiểm 4 điều kiện ở 3.1 từ `app__gap_rows` / `stc_gap_requests` / `gap_matches cho_duyet` / khoản chi chưa nhóm.
   - Tạo `stc_treo` cho mỗi dòng gap còn `remain > 5000` mà state là `cho_tien` hoặc `du`. State `cho_gan` (TM thiếu) thì chặn chốt.
   - Ghi `stc_ca_finals`, nhật ký.
5. `app_stc_treo_ve(p_treo, p_report, p_amount)` / `app_stc_treo_ghep(...)`:
   - Ca nhận: cùng cơ sở, đã xác nhận Fabi, chưa chốt, cùng item.
   - Số ≤ phần còn của khoản treo và ≤ `app__stc_gap_avail` của ca nhận.
   - Insert `gap_decisions(kind 'treo', treo_id)`; khoản treo hết thì `status = 'xong'`.
6. `app_stc_treo_tru(p_treo, p_people, p_reason)` / `app_stc_treo_qc(p_treo, p_reason)`:
   - Chỉ cho loại `tien` đã quá 3 ngày.
   - Bật cờ phiên, gọi `app_stc_gap_tl` / `app_stc_gap_qc` trên ca gốc; `app__stc_gap_need` phải cho qua khi cờ bật.
7. `app_stc_restore(p_edit_id, p_reason)` (khôi phục phiếu đã xoá / huỷ phiếu bổ sung, dựa trên `stc_edits` của đợt 2): ca chưa chốt, đã xác nhận Fabi, ghi nhật ký. Cách hoàn tác chính xác dò theo bảng `stc_edits` khi lập kế hoạch.
8. `app_stc_month`:
   - Thêm `final {by, at}` cho mỗi ca.
   - Thêm `treo[]` (của cơ sở; còn mở mọi tháng + đã xong trong tháng), có `left`, `over`, `thu_khac` (tháng gốc đã qua và còn tiền thừa).
   - Thêm `debts` báo nợ để hiện "Nợ bill của ca", nếu chưa có.
9. Bài thử `kiem_tra/so_thu_chi_135.sql` (tự hoàn tác, REPORT>>):
   - Chốt bị chặn đúng 4 điều kiện.
   - Tạo đúng khoản treo.
   - Sau chốt, mọi bảng / hàm sửa bị chặn (gồm `app_ca_recon_apply`, `app_stc_move_save`, `app_stc_gap_*`, Fabi tải lại).
   - Đã về / Ghép đúng.
   - Quá hạn mới trừ / quán chịu.
   - Thu khác khi sang tháng.
   - Khôi phục.
   - Chạy lại tệp lần 2 không lỗi.

## 6. Giao diện (`docs/js/pages/so_thu_chi.js`, `docs/js/so_thu_chi_tinh.js`)
- Đổi nhãn tab, trạng thái ca (`caState`) và điều kiện chốt: hàm thuần trong `so_thu_chi_tinh.js` để thử bằng `jsc`.
- `dsBody` / `dsPanel` viết lại thành `dsPanel = partA + partB + partFinal`.
- Phần B dùng lại `itemRow`, `cells`, `addBtn`, các hộp sửa / thêm / phiếu chênh lệch sẵn có, lọc theo ca, có nút Sổ thu | Sổ chi và TM | CK riêng của tab.
- Tab Tổng: ô + khung Khoản treo; hộp chọn ca nhận khi Đã về / Ghép.
- Sổ chung: chữ khoá và đường dẫn theo 3.3; ca chốt ẩn mọi nút.
- Không đụng mã vùng khoá ở `docs/js` (trang Sổ thu chi không dùng `can_recon`, `mEdit`…).

## 7. Kiểm tra trước khi lên web
1. SQL: `kiem_tra/so_thu_chi_135.sql` trên máy chủ thật, chế độ tự hoàn tác → đạt.
2. Hàm thuần: `jsc -m kiem_tra/so_thu_chi_tinh_dot6.mjs` → đạt.
3. Chrome (giả lập `stc_gia.js` thêm hàm mới): `flow_stc6` role chu + qlt ở `index.html` và `test/phone.html` (390px), theo đúng luồng của mẫu, không tràn ngang.
4. Chạy lại `flow_stc1…5` và **`flow_ql_tu_ds`** (role ql + chu, 2 khung) → đạt.
5. Chạy SQL thật → đẩy giao diện → tăng `version.json` / `ASSET_VERSION` / `?v=` → ghi `app_releases` → cập nhật `BAN_GIAO.md`, `TINH_NANG_DA_CHOT.md`.

## 8. Để người làm tự quyết
- Tên hàm phụ, chia nhỏ hàm vẽ.
- Danh sách bảng chính xác cho trigger, nhưng phải dò hết.
- Gợi ý ca nhận khi Đã về / Ghép (ca gần nhất có phần vừa đủ).
