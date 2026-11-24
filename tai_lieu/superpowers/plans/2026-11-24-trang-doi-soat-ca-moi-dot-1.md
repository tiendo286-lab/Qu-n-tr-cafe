# Trang đối soát ca mới — Đợt 1 (chỉ xem) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang đối soát ca mới ở `#/ca/doi-soat-moi?id=<ca>` — 3 trang (① Phần việc · ② Tiền · ③ Hoàn thành), **chỉ xem**, số tiền giống hệt trang cũ, nút Tính lại không vẽ lại cả trang; trang cũ có nút sang trang mới.

**Architecture:** Chỉ làm ở web, **không đổi máy chủ**. Trang mới đọc bằng các hàm đang có (`app_ca_get`, `app_stc_month`, `app_ca_ds_tuan` một ngày, `app_ca_ds_con`) rồi tính bằng các hàm thuần sẵn có của Sổ thu chi (`caMoney`, `caChecks`, `dsChecks`, `dsCtx`, `billListOf` trong `docs/js/so_thu_chi_tinh.js`). Phần sắp xếp riêng của trang mới (sổ tiền mặt / chuyển khoản, trạng thái 3 trang, danh sách còn thiếu) là hàm thuần ở tệp mới `docs/js/doi_soat_moi_tinh.js` để thử bằng `jsc`.

**Tech Stack:** JavaScript thuần (ES modules, `html``\`` của `docs/js/ui.js`), Supabase (gọi `rpc` của `docs/js/sb.js`), bài thử hàm thuần `jsc -m` (`/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`), bài thử trình duyệt `kiem_tra/trinh_duyet` (Playwright: `chuan_bi.sh` + `chay_pw.py`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md` (mục 5.1–5.3, 5.7 đợt 1). Gốc rà soát: `tai_lieu/superpowers/specs/2026-11-24-ra-soat-doi-soat-ca.md`.

**Khác thiết kế (em quyết, báo anh Tiến):** thiết kế ghi đợt 1 có "tách lõi Sổ thu chi tháng + chức năng đọc một ca" trên máy chủ. Đợt 1 **không làm phần máy chủ** — trang mới đọc sổ tháng bằng `app_stc_month` có sẵn (đúng logic cũ, không đụng vùng khoá, không phải chạy SQL). Tính lại vì vậy vẫn đọc lại sổ tháng của cơ sở (một lệnh) — chậm hơn mục tiêu ~0,3 giây một chút nhưng không vẽ lại cả trang. Chức năng đọc một ca trên máy chủ chuyển sang đợt 2 (trước khi cho sửa). Cũng để sang đợt 2–3 (khi trang mới sửa được): nhớ lựa chọn "luôn mở trang mới" theo từng máy và cho ô ca ở bảng tuần mở theo lựa chọn đó; dòng vàng "Số chưa tính lại" (chỉ cần khi có sửa).

## Global Constraints

- Không tệp SQL mới, không sửa hàm máy chủ nào.
- Trang mới **không có nút ghi dữ liệu** nào (đợt 1 chỉ xem). Đầu trang ghi: "Bản xem thử — chưa sửa được ở đây. Sửa ở trang cũ ›" (đường dẫn `#/ca/doi-soat?id=<ca>`).
- Trang cũ chỉ thêm đúng một nút "Xem trang mới (thử) ›"; Sổ thu chi, bảng tuần Chốt ca không đổi.
- Quyền vào trang: `export const perm = 'doi_soat'` (như `docs/js/pages/doi_soat_ca.js`); phần tiền theo quyền của `app_stc_month`.
- Số tiền phải bằng `caMoney(D.items, ca.id, ca.start_tm)` của trang cũ (`must`) cho cả tiền mặt và chuyển khoản.
- Thu và chi hai màu: khung khoản thu xanh lá nhạt, khung khoản chi đỏ nhạt (tiêu đề nhóm và dòng tổng cùng màu); mỗi khoản một khung.
- Tính lại: không gọi `render()` của `app.js`, không đọc lại gì ngoài 4 lệnh ở trên.
- Điện thoại 390px không tràn ngang.
- Chữ trên trang bằng tiếng Việt dễ hiểu; dữ liệu thử chỉ dùng dữ liệu giả của `kiem_tra/trinh_duyet` (không tên nhân viên thật trong kho mã). Dữ liệu thật để so số chỉ để ở `kiem_tra/_tam/` (đã bỏ qua trong git).
- Commit với tên `Tien Do <tiendo286@gmail.com>`, dòng cuối `Co-Authored-By: Claude <noreply@anthropic.com>`. Đẩy `main`: tăng `docs/version.json`, ghi `app_releases`.

## Review Focus

- Ca chờ kế toán / chưa có số ngân hàng (`kt_wait` hoặc `bank_ck == null`): mục Chuyển khoản hiện "⏳ chờ kế toán", không hiện 0 hay `NaN`; nút trang ② có dấu ⏳. → Task 1 (hàm) + Task 4 (trình duyệt).
- Luân chuyển tiền mặt ↔ chuyển khoản (`col: 'lc'`): hiện ở cả hai mục (chi ở mục này, thu ở mục kia), tổng mỗi mục vẫn bằng `caMoney`. → Task 1.
- Quản lý không được xem tiền cơ sở đó (`app_stc_month` báo lỗi): trang ② ghi rõ lời báo, trang ① vẫn hiện. → Task 4.
- Khoản đã bị sửa / xoá (`void: true`) và dòng chênh lệch (`col: 'lech'`): không có trong danh sách thu / chi, không cộng vào tổng. → Task 1.
- Tên khoản rất dài, nhiều khoản trên điện thoại: chữ xuống dòng, không tràn ngang. → Task 4.

---

### Task 1: Hàm thuần của trang mới

**Files:**
- Create: `docs/js/doi_soat_moi_tinh.js`
- Test: `kiem_tra/doi_soat_moi_tinh_dot1.mjs` (chạy: `jsc -m kiem_tra/doi_soat_moi_tinh_dot1.mjs`, dòng cuối `ĐẠT n kiểm tra`); thêm tệp này vào vòng lặp của `kiem_tra/chay_tinh.sh`.

**Interfaces:**
- Consumes (từ `docs/js/so_thu_chi_tinh.js`): `caMoney(items, caId, startTm)`, `dsChecks(ca, ctx)`, `dsCtx(D, ca)`, `SHIFT_ORDER`.
- Produces:
  - `caBook(D, ca) -> { tm: Book, ck: Book }` với `Book = { pm: 'tm'|'ck', start: number, ban: number, thu: Line[], tongThu: number, chi: Line[], tongChi: number, must: number, real: number|null, gap: number|null }`, `Line = { id, kind, title, amount, cat, who, col }`.
  - `pageState(D, ca, R, dsRow) -> { viec: { ok: boolean, left: string[] }, tien: { ok: boolean, left: number, wait: boolean }, done: boolean }`.
  - `missingList(D, ca, R, dsRow) -> Array<{ page: 'viec'|'tien', k: string, text: string }>`.
  - `confirmList(D, ca) -> string[]`.
  - `isClean(D, ca, R, dsRow) -> boolean`.
  - `CHK_LABEL` (đối tượng `k → chữ`), `WORK_LABEL = { nhan_su: 'Nhân sự', ban_giao: 'Bàn giao', nhap_hang: 'Nhập hàng' }`.

Quy tắc (từ thiết kế 5.2 và hàm `caMoney`):
- Dòng của một mục = `D.items` không `void`, `ca_id === ca.id`, `pm` đúng mục. `ban` = tổng `col: 'dt'`. `thu` = `book: 'thu'` với `col` thuộc `khac | no | lc`; `chi` = `book: 'chi'` với `col` thuộc `chi | no | lc`. Bỏ `col: 'lech'`.
- `start`: tiền mặt = `Number(ca.start_tm)`, chuyển khoản = 0. `must = start + ban + tongThu − tongChi`.
- `real`: tiền mặt = `ca.real_tm ?? null`; chuyển khoản = `null` khi `ca.kt_wait || ca.bank_ck == null`, ngược lại `ca.bank_ck`. `gap = real == null ? null : real − must`.
- `kind`: thu `khac → 'Thu khác'`, `no → 'Khách trả nợ'`, `lc → 'Luân chuyển vào'`; chi `chi → 'Chi'`, `no → 'Cho nợ'`, `lc → 'Luân chuyển ra'`; `meta === 'Lương trả tiền mặt'` → `'Lương'`. `who`: theo đúng cách bước 3 / 4 của trang cũ ghi "Nhân viên ghi / Quản lý ghi" (`partB` trong `docs/js/pages/so_thu_chi.js`), rút gọn `'NV ghi'` / `'QL ghi'`.
- `pageState.tien.left` = số mục `ok: false` trong `dsChecks(ca, dsCtx(D, ca))`, **bỏ** mục `fabi` (Hoàn thành mới sẽ tự xác nhận) và **bỏ** 4 mục cơ bản `anh`, `sot`, `that`, `goi` (xác nhận khi Hoàn thành). `wait` = `!!ca.kt_wait || ca.bank_ck == null`.
- `pageState.viec.left` = `dsRow?.viec?.thieu` nếu có, không thì các mục `nhan_su`, `ban_giao`, `nhap_hang` chưa có trong `R.checks`, đổi sang chữ bằng `WORK_LABEL`.
- `missingList`: mục tiền chưa xong (cùng tập với `tien.left`) dùng `CHK_LABEL[k]` (chép chữ đầu của `CHK` trong `docs/js/pages/so_thu_chi.js`), rồi việc phần việc (`page: 'viec'`).
- `confirmList`: chữ của 4 mục cơ bản đang có trong `dsChecks` và chưa tích, theo thứ tự `anh, sot, that, goi`.
- `isClean` = `viec.ok && tien.ok && !tien.wait`.

- [ ] **Step 1: Viết bài thử `kiem_tra/doi_soat_moi_tinh_dot1.mjs`** với dữ liệu giả tự dựng (không dùng dữ liệu thật). Tối thiểu các khẳng định:
  - `1a` sổ tiền mặt có `dt` 770.000, thu khác 20.000, khách trả nợ 55.000, chi 70.000 + 30.000, mở ca 1.000.000 → `ban 770000`, `tongThu 75000`, `tongChi 100000`, `must 1745000`, bằng `caMoney(...).tm.must`.
  - `1b` khoản `void: true` và dòng `col: 'lech'` không có trong `thu` / `chi`, không đổi `must`.
  - `1c` luân chuyển: một cặp `lc` (chi tiền mặt 200.000 + thu chuyển khoản 200.000) → có ở `tm.chi` và `ck.thu`; `tm.must`, `ck.must` đều bằng `caMoney`.
  - `1d` `kt_wait: true` → `ck.real === null`, `ck.gap === null`; `bank_ck: 1676000`, phải nhận 1.414.000 → `ck.gap === 262000`.
  - `1e` `real_tm 1496000` → `tm.gap === -249000`.
  - `1f` `pageState`: thiếu `ban_giao` trong `R.checks`, không `dsRow` → `viec.left` chứa `'Bàn giao'`, `viec.ok === false`.
  - `1g` `missingList` không có mục `fabi`, `anh`, `sot`, `that`, `goi`; có `ld` khi có lệch > 5.000 chưa tích.
  - `1h` `confirmList` ca Thu theo ca có chi → `[ảnh phiếu, không sót, khoản chi có thật, két để lại]` (đúng 4 chữ trong `CHK_LABEL`).
  - `1i` `isClean` đúng với ca khớp hết; sai khi có lệch tiền mặt 249.000; sai khi `kt_wait`; sai khi `fabi.edited_bills > 0` chưa tích `hd`.
- [ ] **Step 2: Chạy** `jsc -m kiem_tra/doi_soat_moi_tinh_dot1.mjs` → báo lỗi vì chưa có tệp `docs/js/doi_soat_moi_tinh.js`.
- [ ] **Step 3: Viết `docs/js/doi_soat_moi_tinh.js`** theo Interfaces + quy tắc trên.
- [ ] **Step 4: Chạy lại** → `ĐẠT …`; chạy `sh kiem_tra/chay_tinh.sh` (sau khi thêm tệp mới vào vòng lặp) → mọi bài ĐẠT.
- [ ] **Step 5: Commit** `docs/js/doi_soat_moi_tinh.js`, `kiem_tra/doi_soat_moi_tinh_dot1.mjs`, `kiem_tra/chay_tinh.sh`.

### Task 2: So số trên dữ liệu thật (không lưu dữ liệu vào git)

**Files:**
- Create: `kiem_tra/doi_soat_moi_so_that.mjs` (đọc `kiem_tra/_tam/stc_month_that.json` bằng `read()` của jsc; tệp JSON không vào git).

**Interfaces:**
- Consumes: `caBook` (Task 1), `caMoney`, `billListOf`.
- Produces: không.

- [ ] **Step 1: Lấy dữ liệu thật vào `kiem_tra/_tam/stc_month_that.json`**: mảng kết quả `app_stc_month(<cơ sở>, '2026-11')` của mọi cơ sở đang hoạt động, gọi trong giao dịch chỉ đọc với vai Chủ (Management API, như các bài đo trước) — làm lúc vắng, một lần.
- [ ] **Step 2: Viết `kiem_tra/doi_soat_moi_so_that.mjs`**: với mỗi ca của mỗi cơ sở (gán `bill_list` như `load()` của Sổ thu chi), kiểm `caBook(D, ca)[pm].must === caMoney(D.items, ca.id, ca.start_tm)[pm].must` cho `tm` và `ck`, và `tm.real === ca.real_tm`; in `ĐẠT <số ca> ca` hoặc danh sách ca lệch.
- [ ] **Step 3: Chạy** `jsc -m kiem_tra/doi_soat_moi_so_that.mjs` → `ĐẠT 271 ca` (hoặc đúng số ca tháng 11 lúc lấy).
- [ ] **Step 4: Commit** chỉ `kiem_tra/doi_soat_moi_so_that.mjs`.

### Task 3: Trang mới `#/ca/doi-soat-moi` (chỉ xem) + nút trên trang cũ

**Files:**
- Create: `docs/js/pages/doi_soat_moi.js`
- Modify: `docs/js/app.js` (thêm `'/ca/doi-soat-moi': 'doi_soat_moi'` vào `PAGES`, cạnh `'/ca/doi-soat'`)
- Modify: `docs/js/pages/phieu_ca.js` (trong `dsTopOf`: thêm `<a class="btn sm secondary" id="ds-newpage" href="#/ca/doi-soat-moi?id=${id}">Xem trang mới (thử) ›</a>`)

**Interfaces:**
- Consumes: Task 1 (`caBook`, `pageState`, `missingList`, `confirmList`, `isClean`, `CHK_LABEL`, `WORK_LABEL`); `caChecks`, `dsCtx`, `billListOf`, `SHIFT_ORDER` (`so_thu_chi_tinh.js`); `rpc`, `sb` (`sb.js`); `html`, `raw`, `str`, `$`, `$$`, `dialog`, `showSaved` (`ui.js`); `fmt`, `dmy` (`tien.js`).
- Produces: `export const perm = 'doi_soat'`; `export async function render({ params }) -> { title, html, mount }`. Trong trang: gốc `#dsm`, thân `#dsm-body`, nút trang `[data-dsm-tab="viec|tien|xong"]` có `aria-selected`, nút `#dsm-recalc`, đường về trang cũ `#dsm-old`, khung khoản `.dsm-it.thu` / `.dsm-it.chi`, dòng tổng `.dsm-tot`, ô phải có `.dsm-must[data-pm]` (số trong `data-v`), ô lệch `.dsm-gap[data-pm]`, danh sách còn thiếu `#dsm-missing li`.

Cách làm:
- Nạp: `app_ca_get({ p_id })` → `R`; rồi song song `app_stc_month({ p_branch: R.branch_id, p_month: R.work_date.slice(0, 7) })`, `app_ca_ds_tuan({ p_branch, p_from: R.work_date, p_to: R.work_date })` (lấy dòng có `id` = ca), `app_ca_ds_con({ p_branch })`. Sổ tháng: gán `c.bill_list = billListOf(D, c.id)` cho mọi ca như `load()` của Sổ thu chi. Lỗi sổ tháng → giữ lời báo, trang ② hiện lời báo đó.
- Mở trang: `params.tab` nếu là `viec|tien|xong`; không có thì `isClean` → `xong`, không thì trang đầu còn việc theo thứ tự `viec → tien → xong`. Đổi trang tại chỗ (ẩn / hiện), giữ `tab=` trên đường dẫn bằng `history.replaceState`.
- Trang ①: Nhân viên (`R.staff`: mã – tên, giờ đến – về, nghỉ + lý do; có nghỉ / làm thay thì ghi "Quản lý tổng phân loại, Chủ duyệt x2"); Bàn giao ca (`R.cash_hand`: khớp / lệch + số; `null` → "Ca đầu ngày"; `R.goods_status`); dấu đã duyệt từng mục theo `R.checks`.
- Trang ②: Số máy Fabi (`caChecks(ca, dsCtx(D, ca).link)`: tiền mở ca, doanh thu, nợ bill + trạng thái chữ như trang cũ; ảnh phiếu `R.photos` loại `ipos` ký bằng `sb.storage.from('phieu-ca').createSignedUrls(paths, 3600)`, ảnh nhỏ, bấm mở `dialog` ảnh to); mục Tiền mặt và Chuyển khoản vẽ từ `caBook` đúng thứ tự thiết kế (mở ca → bán → khoản thu từng khung + tổng thu → khoản chi từng khung + tổng chi → phải có → thực nhận → lệch); khung có loại, nội dung, ai ghi, số tiền, nhóm (chữ, chưa chọn được); ô tích hiện trạng thái (✓ / ☐), không bấm được.
- Trang ③: tóm tắt trạng thái trang ① và từng mục trang ②; `#dsm-missing` từ `missingList` (bấm dòng → sang trang tương ứng); "Bấm Hoàn thành là xác nhận đã: …" từ `confirmList`; nút Hoàn thành **mờ**, chữ "Hoàn thành làm ở trang cũ trong đợt này ›".
- Thanh trên: tên ca · thứ ngày · cơ sở, nút `#dsm-recalc` "Tính lại", `#dsm-old` "Về trang cũ", ba nút trang có dấu `✓` / `⚠ n` / `⏳`. Dưới cùng: ca trước / ca sau cùng cơ sở (theo `D.cas` xếp ngày + `SHIFT_ORDER`), "Ca tiếp theo chưa xong ›" (như `nextUnfinished` trong `phieu_ca.js`).
- Tính lại: gọi lại đúng 4 lệnh nạp, thay `#dsm-body`, giữ trang đang mở, `showSaved('Đã tính lại')`; không gọi `render()` của `app.js`.
- CSS: một hằng chuỗi `<style>` trong tệp, lớp bắt đầu `dsm-`, dùng biến màu của `docs/assets/style.css` (`--ok-*`, `--off-*`, `--warn-*`, `--line`…) và hai màu nhạt thu / chi.

- [ ] **Step 1:** Thêm đường dẫn vào `PAGES` và tệp trang với `render` trả khung trang + 3 trang theo cách làm trên.
- [ ] **Step 2:** Thêm nút `#ds-newpage` trên trang cũ.
- [ ] **Step 3:** Mở thử bằng bộ máy chủ giả (`chuan_bi.sh`, `index.html?auto=1&role=chu`, `#/ca/doi-soat-moi?id=182`) — trang hiện đủ 3 trang, không lỗi trong console.
- [ ] **Step 4: Commit** `docs/js/pages/doi_soat_moi.js`, `docs/js/app.js`, `docs/js/pages/phieu_ca.js`.

### Task 4: Bài thử trình duyệt `flow_dsm1`

**Files:**
- Create: `kiem_tra/trinh_duyet/flow_dsm1.js`
- Modify: `kiem_tra/trinh_duyet/README.md` (một dòng: cách chạy, vai, các điều kiểm)
- Modify (nếu cần dữ liệu): `kiem_tra/trinh_duyet/stc_gia.js` — chỉ thêm ca giả có luân chuyển / chờ kế toán nếu dữ liệu giả hiện chưa có.

**Interfaces:**
- Consumes: các chọn lọc của Task 3 (`#dsm`, `[data-dsm-tab]`, `#dsm-recalc`, `.dsm-it.thu`, `.dsm-it.chi`, `.dsm-must[data-pm]`, `#dsm-missing li`, `#ds-newpage`); `rpc`, `sb` (`../js/sb.js`); `caMoney`, `billListOf` (`../js/so_thu_chi_tinh.js`).
- Produces: không.

Các điều kiểm (theo nếp `flow_tick63.js`: `ok(điều kiện, chữ)`, in ĐẠT / LỖI):
- `role=chu|qlt|ql` × `index.html` và `test/phone.html`; `role=nv` không vào được trang (quyền `doi_soat`).
- Trang cũ `#/ca/doi-soat?id=182` có `#ds-newpage` trỏ đúng `#/ca/doi-soat-moi?id=182`.
- Trang mới ca 182: có dòng "Bản xem thử", 3 nút trang, `#dsm-old` trỏ trang cũ; trang ① có tên nhân viên của ca giả; trang ② có khung `.dsm-it.thu` và `.dsm-it.chi` (màu nền khác nhau — so `getComputedStyle(...).backgroundColor`); `data-v` của `.dsm-must[data-pm="tm"]` và `[data-pm="ck"]` bằng `caMoney` tính từ `rpc('app_stc_month')` của cùng dữ liệu giả.
- Ca chờ kế toán: mục Chuyển khoản có "⏳", không có chữ `NaN`.
- Trang ③: số dòng `#dsm-missing li` bằng `missingList` tính lại trong bài; nút Hoàn thành bị khoá.
- Tính lại: đếm số lần gọi bằng cách bọc `sb.rpc` trong bài thử; bấm `#dsm-recalc` → ≤ 4 lần gọi; một phần tử đánh dấu đặt sẵn ngoài `#dsm-body` vẫn còn (trang không vẽ lại cả route).
- Quản lý không được xem tiền (giả lập `app_stc_month` ném lỗi bằng cách bọc `sb.rpc` trong bài): trang ② hiện lời báo, trang ① vẫn hiện.
- Điện thoại: `document.documentElement.scrollWidth <= clientWidth + 1` ở cả 3 trang.

- [ ] **Step 1: Viết `flow_dsm1.js`** với các điều kiểm trên.
- [ ] **Step 2: Chạy** `chay_pw.py <thư mục tạm> "role=chu&script=flow_dsm1"` (và `--phone`, `role=qlt`, `role=ql`, `role=nv`) → mọi vai ĐẠT. Hỏng thì sửa trang (Task 3) tới khi ĐẠT; không sửa bài cho qua.
- [ ] **Step 3: Chạy bộ vùng khoá** (vì `phieu_ca.js` có thay đổi): `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6`, `flow_stc7` (chu / qlt / ql), `flow_dsca`, `flow_tick63`, `flow_stc17` → ĐẠT như trước.
- [ ] **Step 4: Commit** `flow_dsm1.js`, `README.md`, (và `stc_gia.js` nếu có sửa).

### Task 5: Phát hành đợt 1

**Files:**
- Modify: `docs/version.json` (bản mới của ngày, ví dụ `2026.11.24.1`)
- Modify: `tai_lieu/TINH_NANG_DA_CHOT.md` (mục mới đầu phần đối soát: "Trang đối soát ca mới — đợt 1 (chỉ xem)", ghi các quyết định 1–13 của thiết kế, đường dẫn trang, đợt 2–4 còn lại)
- Modify: `tai_lieu/BAN_GIAO.md` (dòng Cập nhật + bảng Việc còn mở: đợt 2–4)

- [ ] **Step 1:** Chạy lại toàn bộ: `sh kiem_tra/chay_tinh.sh`, `jsc -m kiem_tra/doi_soat_moi_so_that.mjs`, `flow_dsm1` 4 vai × 2 khung, bộ vùng khoá → đều ĐẠT.
- [ ] **Step 2:** Hỏi anh Tiến một câu trước khi đẩy lên web; được đồng ý thì tăng `docs/version.json`, commit, `git fetch` rồi đẩy `main` (kiểm `main` chưa bị phiên khác đổi).
- [ ] **Step 3:** Ghi `app_releases` (Management API, chạy thử `REPORT>>` trước): `version` đúng bản ở `docs/version.json`, `added` 1 dòng tiếng Việt ("Trang đối soát ca mới — bản xem thử: 3 trang Phần việc · Tiền · Hoàn thành, tiền mặt và chuyển khoản tách riêng, từng khoản thu / chi và tổng; vào từ nút 'Xem trang mới (thử)' ở trang đối soát ca"), `released_by`.
- [ ] **Step 4:** Mở trang trên web (sau ~5–7 phút) kiểm một ca thật bằng vai Chủ: số phải có / thực nhận / lệch giống trang cũ.
