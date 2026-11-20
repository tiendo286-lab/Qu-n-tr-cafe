# Đối soát thu chi 6 bước — Đợt A (khung 6 bước + mục kiểm tra + Hoàn thành) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở một ca ở Sổ thu chi › Đối soát Fabi thì đi 6 bước có mục quản lý phải kiểm tra; phải tích đủ mới bấm được "🔒 Hoàn thành đối soát ca"; ca chỉ thành "đã đối soát" sau nút đó.

**Architecture:** Làm lại ngay trong tab `doi-soat` của `docs/js/pages/so_thu_chi.js` (cách A của thiết kế). Phần "bước nào có mục gì, xong chưa" là hàm thuần trong `docs/js/so_thu_chi_tinh.js`. Máy chủ thêm 2 bảng (`stc_ca_ticks`, `stc_ca_done`) và 3 hàm; sửa 4 hàm đang có.

**Tech Stack:** JavaScript thuần (ES modules, `html\`\`` của `docs/js/ui.js`), Supabase Postgres (plpgsql), bài thử `jsc -m`, Playwright (`kiem_tra/trinh_duyet/chay_pw.py`), Postgres cục bộ (`kiem_tra/may_chu_cuc_bo/`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md` (mục 5, 6, 10, 12, 13, 14, 15, 16). Bản thử: `work/proposals/doi-soat-thu-chi-tung-buoc.html`.

**Thứ tự các đợt (đổi so với mục 17 của thiết kế, vì anh Tiến yêu cầu 20/11 "đẩy phần đối soát tiền của quản lý lên web" trước):** A = kế hoạch này · B = người nợ + phân loại nợ ở bước 1 (mục 8) · C = sửa số máy Fabi + Chủ duyệt (mục 7) · D = phiếu tạo trong ca tính vào ca (mục 9). Mỗi đợt một kế hoạch riêng, một lần lên web.

**Ngoài phạm vi đợt A:** mục `phanloai`, nút "Sai, sửa số", khoá ngày / ca và Cho nợ / Thu nợ / Luân chuyển trong khung + Thêm phiếu, danh sách người nợ, phiếu chốt ca của nhân viên.

## Global Constraints

- Kho mã công khai: không đưa mã `sbp_`, dữ liệu thật, tên nhân viên thật lên GitHub.
- Tệp SQL mới `supabase/150_doi_soat_6_buoc.sql` (kiểm `select max(file) from app_migrations` trước; hiện 149), chạy lại nhiều lần không lỗi, dòng cuối ghi `app_migrations`. Bảng mới không cấp quyền `anon` / `authenticated`.
- Vùng khoá (đã báo anh Tiến ở mục 12 của thiết kế): chỉ sửa `app_stc_ds_close`, `app__ca_auto_finish`, `app_stc_ds_reopen`, `app_stc_ds_blame`. Không sửa `app_can`, `role_permissions`, `app__stc_can`, `app__stc_need`.
- `app_stc_month` đang được vá bằng thay chuỗi (tệp 136, 139, 140): tệp 150 vá tiếp bằng thay chuỗi, không định nghĩa lại; giữ kiểm tra `app__stc_can`.
- Mức khoản lớn `BIG = 300000`. Lệch nhỏ ≤ 5.000 coi như khớp. Gối đầu `FLOAT = 1000000`.
- Tên nút: cuối bước 2 "Xác nhận Fabi"; bước 6 "🔒 Hoàn thành đối soát ca".
- Điện thoại 390px không tràn ngang. Trả lời / tài liệu bằng tiếng Việt đơn giản.
- Sau khi sửa phải chạy đạt: `flow_ql_tu_ds` (ql, chu; `index.html` + `test/phone.html`), `flow_stc6`, `flow_stc7` (chu / qlt / ql). Không tắt, không nới bài thử.
- Commit tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp `Co-Authored-By: Claude <noreply@anthropic.com>`. Nhánh `dot-a/doi-soat-6-buoc` từ `main`.

## Review Focus

1. Ca đã Xác nhận Fabi trước ngày phát hành phải vẫn là "đã đối soát" (chạy bù `stc_ca_done`), tiền không đổi → Task 2, bài so cũ / mới.
2. Ca quản lý tự chốt và các đường khác đang gọi `app__ca_auto_finish` (tệp 56, 71, 91, 92, 98, 104, 136, 137) không bị kẹt vĩnh viễn ở "chưa đối soát" → Task 2, bài thử từng đường.
3. Hai người cùng mở một ca: người thứ hai bấm Hoàn thành khi mục vừa bị bỏ tích → máy chủ từ chối, giao diện tải lại → Task 2 (máy chủ tự kiểm), Task 5.
4. Thu cuối ngày, ca sau chưa gửi phiếu: mục `ket` ở trạng thái chờ, không tính là xong, không báo đỏ → Task 1.
5. Tháng đã chốt / Quỹ ngoài / Xem như người khác: 6 bước chỉ xem, không có nút tích → Task 4, Task 5.

---

### Task 1: Hàm thuần — mục kiểm tra và trạng thái ca

**Files:**
- Modify: `docs/js/so_thu_chi_tinh.js`
- Test: `kiem_tra/so_thu_chi_tinh_dot12.mjs` (mới)

**Interfaces:**
- Produces:
  - `export const BIG = 300000;`
  - `export const DS_STEPS = ['Số máy Fabi', 'Tiền thực nhận', 'Khoản thu', 'Khoản chi', 'Chênh lệch', 'Hoàn thành'];`
  - `export const TICKS = ['hd', 'anh', 'goi', 'tn', 'sot', 'that', 'lon', 'ld', 'sau_tm', 'sau_ck'];` (mã mục tay + dấu Để sau)
  - `export function dsChecks(ca, { checks, items, gaps, next, last }) → Array<Array<{ k, auto: boolean, ok: boolean, wait?: boolean }>>` — 5 mảng cho bước 1–5. `ca.ticks` là mảng mã đã tích. `checks` = `caChecks(ca, link)`, `gaps` = `caGaps(items, ca.id)`, `next` = `{ sent: boolean, moOk: boolean } | null` (ca sau cùng ngày), `last` = ca cuối ngày.
  - `export function dsLeft(steps) → number[]` — số mục chưa xong từng bước.
  - `caStage(ca, checks, fin, treoOpen, gaps)` thêm: đã `recon_money_done` mà `!ca.done` → `{ k: 'xn', txt: '🔵 Đã xác nhận Fabi', cls: 'p-info' }`; `🟠` / `🟢` chỉ khi `ca.done`.
- Consumes: `caChecks`, `caGaps`, `fabiNeeds`, `sumItems`, `FLOAT` đang có.

Mục và điều kiện: đúng bảng mục 6 của thiết kế, **bỏ** `phanloai`; các mục `mo` / `dt` / `no` xong khi ô tương ứng của `caChecks` có `st === 'ok'`. `tm` / `ck5` xong khi không có gap của `pm` đó, hoặc gap `small`, hoặc `done`, hoặc `wait`, hoặc đã tích `sau_tm` / `sau_ck`.

- [ ] **Step 1:** Viết `kiem_tra/so_thu_chi_tinh_dot12.mjs` (kiểu các tệp `dot*.mjs` đang có) với các bài: ca Thu theo ca chưa nhập tiền → bước 2 có `cash` chưa xong, có `goi`, không có `ket`; Thu cuối ngày không phải ca cuối → có `ket`, không có `cash` / `goi`; `next.sent === false` → `ket.wait === true` và `ok === false`; ca cuối ngày Thu cuối ngày → có `cash`, `goi`; ca không có khoản chi → không có `that`, `lon`; có khoản chi 300.000 → có `lon`, 299.999 → không; ca không có thu nợ → không có `tn`; lệch −30.000 chưa xử lý → `tm` chưa xong, có `ld`; tích `sau_tm` → `tm` xong; lệch 5.000 → `tm` xong, không có `ld`; `caStage`: đã xác nhận, chưa `done` → `k === 'xn'`; `done` + còn gap → `'con'`; `done` + hết gap → `'xong'`.
- [ ] **Step 2:** Chạy `jsc -m kiem_tra/so_thu_chi_tinh_dot12.mjs` → hỏng vì chưa có `dsChecks`.
- [ ] **Step 3:** Viết `BIG`, `DS_STEPS`, `TICKS`, `dsChecks`, `dsLeft`, sửa `caStage` trong `docs/js/so_thu_chi_tinh.js`.
- [ ] **Step 4:** Chạy lại → đạt; chạy lại toàn bộ `kiem_tra/so_thu_chi_tinh_dot*.mjs` → đạt (sửa bài cũ nào đang khẳng định "đã xác nhận + hết lệch = xong" cho đúng luật mới bằng cách thêm `done: true` vào dữ liệu thử).
- [ ] **Step 5:** Commit.

### Task 2: Máy chủ — tệp 150

**Files:**
- Create: `supabase/150_doi_soat_6_buoc.sql`
- Test: `kiem_tra/doi_soat_6_buoc_150.sql` (mới), chạy bằng `kiem_tra/may_chu_cuc_bo/`

**Interfaces:**
- Produces (web gọi):
  - `app_stc_tick(p_report bigint, p_item text, p_on boolean) returns void` — `p_item` phải thuộc `hd anh goi tn sot that lon ld sau_tm sau_ck`; kiểm `app__stc_ds_need(p_report, false)`; từ chối khi tháng đã chốt.
  - `app_stc_ds_done(p_report bigint) returns void` — tự kiểm lại điều kiện rồi ghi `stc_ca_done` và gọi `app__ca_auto_finish`. Lỗi: `'Còn mục chưa kiểm tra: …'`.
  - `app_stc_ds_undone(p_report bigint) returns void`.
  - `app_stc_month`: mỗi phần tử `cas` thêm `'ticks'` (mảng text), `'done'` (`{by, at}` hoặc null); mỗi item của ca thêm `'by_role'` (`'nv' | 'ql'`).
- Sửa: `app_stc_ds_close` (bỏ lời gọi `app__ca_auto_finish`), `app__ca_auto_finish` (thêm điều kiện có `stc_ca_done`), `app_stc_ds_reopen` (xoá `stc_ca_done`), `app_stc_ds_blame` (bỏ chặn "ca trước Thu theo ca"; khi đó giảm `ql_counted` hiệu lực của ca trước trong bản đối soát đúng bằng `diff`, ghi `shift_recon_log` hành động `ca_sau_bao_lech_mo_ca`).
- Bỏ tích tự động: trigger trên các bảng / hàm ghi phiếu của ca (đọc tệp 130, 133 để lấy đúng tên) xoá `tn sot` khi phiếu thu đổi, `that lon` khi phiếu chi đổi, `goi` khi `ql_counted` / `cash_mode` đổi, `ld` khi tiền của ca đổi, `hd anh` khi `app__fabi_apply` chạy lại; và chặn thêm / sửa / xoá phiếu khi ca có `stc_ca_done` (`'Ca đã hoàn thành đối soát — bấm Mở lại trước.'`).

- [ ] **Step 1:** Dựng CSDL cục bộ tới tệp 149 + `seed.sql` (README của `kiem_tra/may_chu_cuc_bo/`).
- [ ] **Step 2:** Đọc mọi nơi gọi `app__ca_auto_finish` (tệp 56, 71, 91, 92, 98, 104, 136, 137) và ghi vào đầu tệp 150 (chú thích) đường nào còn sống sau bước 152. Quy tắc: ca có `shift_report_results` đủ mục tiền **không** qua `app_stc_ds_close` (quản lý tự chốt kiểu cũ) thì tệp 150 tự ghi `stc_ca_done` ngay tại đường đó, để không ca nào kẹt.
- [ ] **Step 3:** Viết `kiem_tra/doi_soat_6_buoc_150.sql` (khối `DO … RAISE EXCEPTION 'REPORT>> …'`): tích mã lạ → lỗi; tích / bỏ tích đúng; `ds_close` xong ca **chưa** `hoan_thanh`; `ds_done` thiếu mục → lỗi liệt kê mục; đủ mục → `recon_status = 'hoan_thanh'`; thêm phiếu chi sau khi done → lỗi "Mở lại trước"; `ds_undone` → về trạng thái đã xác nhận, mục tay giữ; thêm phiếu chi → `that`, `lon`, `ld` bị xoá, `tn` giữ; `ds_reopen` → `stc_ca_done` mất; blame ca trước Thu theo ca → được, ca trước lệch đúng `diff`; quản lý không được giao cơ sở → mọi hàm từ chối; tháng đã chốt → từ chối.
- [ ] **Step 4:** Chạy bài thử trên CSDL chưa có tệp 150 → hỏng (hàm chưa có).
- [ ] **Step 5:** Viết tệp 150. Chạy bù cuối tệp: `insert into stc_ca_done` cho mọi ca đang `recon_money_done` (xem `app_stc_month` tính `mdone` thế nào ở tệp 133) kèm `by = null`, `at = 'trước bước 171'`.
- [ ] **Step 6:** Chạy tệp 150 hai lần → không lỗi; chạy bài thử → `REPORT>> ĐẠT`.
- [ ] **Step 7:** So cũ / mới: trước và sau tệp 150, `app_stc_month` của tháng thử cho `items` và tiền từng ca giống hệt (chỉ thêm trường mới). Viết thành `kiem_tra/doi_soat_6_buoc_150_so.sql`.
- [ ] **Step 8:** Commit.

### Task 3: Bộ giả lập trình duyệt

**Files:**
- Modify: `kiem_tra/trinh_duyet/stc_gia.js`, `kiem_tra/trinh_duyet/stc_fixture.js`

**Interfaces:**
- Consumes: tên hàm và trường của Task 2.
- Produces: giả lập `app_stc_tick`, `app_stc_ds_done`, `app_stc_ds_undone`; `app_stc_month` giả trả `ticks`, `done`, `by_role`; ca thử đã xác nhận từ trước có `done`; `app_stc_ds_close` giả không còn làm ca thành hoàn thành; luật bỏ tích và khoá sau done giống Task 2.

- [ ] **Step 1:** Sửa giả lập theo Interfaces.
- [ ] **Step 2:** `chuan_bi.sh <thư mục tạm>` rồi chạy `flow_stc1`, `flow_stc13` (role chu) → vẫn đạt (chưa đổi giao diện).
- [ ] **Step 3:** Commit.

### Task 4: Giao diện 6 bước

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` (`dsPanel`, `partA`, `partB`, `dsBar`, `dsJump`, `dsAct`, đoạn bắt sự kiện tab `doi-soat`), `docs/assets/them.css` (hoặc tệp CSS đang chứa `.stc-*`), `docs/js/pages/phieu_ca.js` (chỉ thẻ "Phần tiền": chữ trạng thái + đường dẫn kèm bước)
- Modify: `docs/js/so_thu_chi_tinh.js` (`todoItems`: thêm "đã xác nhận Fabi, chưa hoàn thành")

**Interfaces:**
- Consumes: `dsChecks`, `dsLeft`, `DS_STEPS`, `BIG`, `caStage` (Task 1); RPC của Task 2.
- Produces (bài thử dựa vào): khung `.stc-dsp` có `nav.stc-steps > button[data-dsstep="0..5"]` (lớp `on` / `done` / `todo`); mỗi bước một `section.stc-step[data-step]`; khung mục kiểm tra `.stc-chk` gồm `button.stc-ci[data-tick="<mã>"]` (mục tay) và `.stc-ci.auto`; số mục cạnh chỗ cần xem `i.stc-mk[data-mk="<mã>"]`; nút `[data-dsclose]` (Xác nhận Fabi, cuối bước 2), `[data-dsdone]`, `[data-dsundone]` (bước 6); nút `[data-dssau="tm|ck"]` (Để sau); thanh đáy `.stc-dsbar` có `[data-dsprev]`, `[data-dsnext]`, chữ "Bước này còn N mục"; đường dẫn thêm tham số `b=<1..6>`.

Nội dung từng bước: mục 5 của thiết kế, trừ phần ngoài phạm vi đợt A. Bước 1 = phần ① của `partA` hiện nay (3 ô, danh sách nợ chỉ xem, cảnh báo hoá đơn, giờ chốt, ảnh) + ô Tiền mở ca ghi rõ ca chịu / dòng chênh lệch nằm ở đâu / ai chọn + lý do. Bước 2 = phần ② + khung "Số ở bước này sai thì sửa ở đâu" + nút Xác nhận Fabi. Bước 3 / 4 = `partB` tách theo sổ thu / sổ chi (cả hai bảng Tiền mặt và Chuyển khoản trong một bước), mỗi phiếu có nhãn Nhân viên ghi / Quản lý ghi, khoản chi ≥ `BIG` có nhãn Khoản lớn. Bước 5 = các dòng Chênh lệch + phiếu chênh lệch đang có + nút Để sau + dòng "lệch = thực nhận − phải có". Bước 6 = tóm tắt + Hoàn thành / Mở lại / Ca tiếp theo.

- [ ] **Step 1:** Viết `kiem_tra/trinh_duyet/flow_ds171.js` (kiểu `flow_ds168.js`): mở ca chưa xác nhận → thấy 6 nút bước, bước 3–5 hiện khoá; tích `anh` → gọi `app_stc_tick`; nhập tiền mặt → Xác nhận Fabi bấm được; sau xác nhận bước 3 mở, ca hiện "🔵"; bước 6 nút Hoàn thành mờ khi còn mục; tích đủ + chọn nhóm + Để sau → Hoàn thành bấm được → ca 🟠 hoặc 🟢; sau Hoàn thành nút + Thêm phiếu mờ; Mở lại → bấm được; thêm phiếu chi → mục `that` tự bỏ tích và có dòng báo; `role=ql` cơ sở không được giao → không thấy nút tích; khung 390px `scrollWidth <= innerWidth`.
- [ ] **Step 2:** Chạy `chay_pw.py <thư mục> "role=chu&script=flow_ds171"` → LỖI (giao diện chưa có).
- [ ] **Step 3:** Viết giao diện theo Interfaces. Giữ nguyên mọi `data-*` đang có của các nút bên trong (`data-dsfabi`, `data-dsblame`, `data-dsmode`, `data-dscash`, `data-dsreopen`, `data-dsbook`, `data-dspm`, `data-addca`…) để mã xử lý và bài thử cũ ít phải đổi.
- [ ] **Step 4:** Chạy `flow_ds171` với role chu / qlt / ql, máy tính + `--phone` → ĐẠT.
- [ ] **Step 5:** Commit.

### Task 5: Sửa các bài thử cũ theo giao diện mới

**Files:**
- Modify: `kiem_tra/trinh_duyet/flow_stc1.js`, `flow_stc4.js`, `flow_stc6.js`, `flow_stc7.js`, `flow_stc10.js`, `flow_stc11.js`, `flow_stc13.js`, `flow_ds156.js`, `flow_ds168.js`, `flow_gio162.js`, `flow_ql_tu_ds.js`; `kiem_tra/trinh_duyet/README.md` (thêm dòng bước 171)

- [ ] **Step 1:** Chạy từng bài (đủ role và 2 khung ghi trong README) → ghi lại bài nào LỖI.
- [ ] **Step 2:** Với mỗi bài LỖI: sửa bước đi (thêm bấm sang đúng bước) và chữ mong đợi theo luật mới; **không** bỏ khẳng định nào về tiền / quyền. Bài nào lỗi vì giao diện mới làm mất tính năng thì sửa giao diện (quay lại Task 4), không sửa bài.
- [ ] **Step 3:** Chạy lại toàn bộ → ĐẠT. Chạy thêm bài vùng khoá: `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6`, `flow_stc7` (chu / qlt / ql).
- [ ] **Step 4:** Commit.

### Task 6: Tài liệu và phát hành

**Files:**
- Modify: `docs/version.json` (→ `2026.11.20.3` hoặc ngày phát hành), `tai_lieu/TINH_NANG_DA_CHOT.md` (mục Sổ thu chi, thêm "Bước 171 — đợt A"), `tai_lieu/BAN_GIAO.md`

- [ ] **Step 1:** Cập nhật 3 tệp. Commit.
- [ ] **Step 2:** Chạy thử tệp 150 + bài thử trên Supabase thật trong khối `DO … RAISE EXCEPTION 'REPORT>> %'` (tự hoàn tác) → xem kết quả. Rồi chạy thật tệp 150. Kiểm `select max(file) from app_migrations` = `150_doi_soat_6_buoc.sql` và số dòng `stc_ca_done` chạy bù.
- [ ] **Step 3:** Gộp nhánh vào `main`, đẩy `main` (anh Tiến đã bảo đưa lên web 20/11). Ghi `app_releases` (version, `added` / `changed`, `released_by`, `released_at`).
- [ ] **Step 4:** Sau 5–7 phút mở web thật kiểm `version.json` mới; nhắc anh Tiến Revoke mã `sbp_` nếu đã dùng mã mới.
