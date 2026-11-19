# Sổ thu / Sổ chi gọn — Kế hoạch làm (KH4, lượt 3, bước 164)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (anh Tiến dặn dùng tiết kiệm — tự làm, duyệt 1 lần cuối). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Trạng thái:** chờ anh Tiến bảo "chạy" (anh bảo chạy = đồng ý bản thiết kế). Chỉ bắt đầu khi **KH2 và KH3 đã đẩy lên `main`**. Đọc trước `plans/2026-11-19-lo-trinh-4-ke-hoach.md`, nhất là mục "Bàn giao từ lượt trước".

**Goal:** Tab Sổ thu / Sổ chi (cả Quỹ ngoài) nhìn vào là thấy tổng tiền, các loại và việc cần xử lý: bỏ cột phải, ô số bấm được để xem riêng một loại, bảng ngày gọn, bộ lọc dễ đọc. **Không đổi tính năng.**

**Architecture:** Chỉ sửa giao diện trong `docs/js/pages/so_thu_chi.js` (+ CSS). Phần tính mới (cột bằng 0, dòng phụ của ô, chữ "Đang lọc") là hàm thuần trong `docs/js/so_thu_chi_tinh.js` để thử bằng `jsc`. Các thẻ của cột phải cũ (`bookSide`) được tách thành từng khung nhỏ và chỉ hiện khi bấm ô tương ứng. Không tách tệp mới (tránh nhập vòng giữa trang và phần vẽ dùng `itemRow`).

**Tech Stack:** JavaScript thuần (`html\`\``), CSS trong `docs/css/` (`style.css` / `them.css`), `jsc -m`, bộ giả lập `kiem_tra/trinh_duyet/`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-ke-hoach-4-so-thu-chi-gon-design.md`

## Global Constraints
- Không đổi máy chủ, không đổi hàm `app_*`, không đổi cách tính số. Tab Tổng và Đối soát Fabi giữ nguyên, trừ đúng một câu (Task 5).
- Không chạm điều kiện ai sửa / khoá được gì (vùng khoá). Chỉ đổi chỗ hiện.
- Mọi nút ở cột phải cũ còn chỗ bấm: Thu nợ (`data-col-debt`), ô ✓ người nợ (`data-person`), chọn nhóm cho khoản chưa phân loại, Phiếu chênh lệch (`data-gap`), → Trừ lương.
- Giữ nguyên các móc mà bài thử đang dò khi ý nghĩa không đổi: `a.stc-pay`, `[data-col]` trên ô số, `data-col-debt`, `data-person`, `data-addca`, `data-gap`, `.stc-gio` / `[data-gio]` (KH2), `fillCa` / `.stc-canote` (KH3). Bỏ: `aside.stc-aside`, `section.stc-side` ở Sổ thu / Sổ chi (tab Tổng dùng `stc-tile` thì giữ).
- Tham số địa chỉ giữ như cũ: `pm`, `cot`, `loc`. Bấm ô = `cot`; bỏ chọn = `cot` rỗng.
- Chữ cố định: `Tổng thu tháng <M> = … · bấm một ô để chỉ xem khoản loại đó`; `đang lọc ✕`; `Đang ẩn cột <tên> (cả tháng bằng 0) · hiện lại`; `Đang lọc:` … `Bỏ hết`; `✕ Bỏ lọc`; `👥 Người nợ`; `+ Thêm người nợ`; Đối soát Fabi: `Khoản nợ nằm ở Sổ thu › bấm ô Thu nợ › Khách còn nợ`.
- Trạng thái ca chỉ có: `⏳ Chưa xác nhận Fabi` (`!recon_money_done`), `Đã xác nhận Fabi`, `🔒 Tháng đã chốt` (`D.locked`). Không dùng `isFin` / `D.finals`.
- `app_releases` (lượt này): changed `["Sổ thu / Sổ chi gọn: bỏ cột bên phải, bấm ô số để xem riêng từng loại (Thu nợ có danh sách khách còn nợ, Các khoản chi có chi theo loại và khoản cần phân loại, Cho nợ có danh sách người nợ), ẩn cột cả tháng bằng 0, bộ lọc ghi rõ đang lọc gì", "Sổ chi: thêm nút 👥 Người nợ"]`.

## Review Focus
1. **Lọc + bấm ô cùng lúc** (`loc` và `cot` đều có) — ra danh sách đã lọc chỉ của loại đó, dòng "Đang lọc" vẫn hiện, bỏ từng điều kiện không làm mất `cot`. (Task 4)
2. **Bấm ô của cột đang bị ẩn vì bằng 0** — không xảy ra ở pm này, nhưng đổi pm (TM → CK) mà `cot` là cột bằng 0 ở CK: danh sách rỗng hiện "Không có khoản nào", không lỗi, cột không bị ẩn khi đang chọn. (Task 1 + Task 2)
3. **Quỹ ngoài (`D.ext`)** — không có nút Thu nợ / ô ✓ / 👥 Người nợ ghi được (như cũ `D.ext` thì tắt), khung "Phần mỗi cơ sở chịu" vẫn có ở ô Các khoản chi. (Task 3)
4. **Tháng đã chốt (`D.locked`)** — dòng ca ghi `🔒 Tháng đã chốt` một lần, từng khoản không lặp nút mờ; khung "+ Thêm phiếu" vẫn theo luật cũ. (Task 5)
5. **Điện thoại 390px** — phần đầu (nút chuyển + 5 ô), dòng "Đang lọc", cửa sổ Người nợ không tràn ngang; ô bằng 0 ẩn trên điện thoại. (Task 6)

---

### Task 1: Hàm thuần cho phần đầu và dòng "Đang lọc"

**Files:**
- Modify: `docs/js/so_thu_chi_tinh.js`
- Create: `kiem_tra/so_thu_chi_tinh_dot9.mjs`

**Interfaces:**
- Produces:
  - `zeroCols(items, book, pm, keep = '') → string[]` — khoá cột của `COLS[book]` có tổng khoản không xoá (`!void`) theo `book` + `pm` bằng 0 cả tháng; không bao giờ trả `keep` (cột đang chọn).
  - `tileInfo(D, book, pm, k) → { v: number, sub: string, warn: boolean, zero: boolean }` — `sub` chỉ khi có việc: `lech` → `'<n> ca chờ xử lý'` (`/Chờ/` trong `status`, như dòng 854 hiện nay) và `warn = n > 0`; thu `no` → `'+ <n> khách còn nợ'` (`D.open_debts.length`); chi `chi` → `'<n> khoản cần phân loại'` (`!cat`, `warn = n > 0`), nếu không có thì `'trong đó <tiền> không tính chi phí'` khi có; chi `no` → `'<n> người nợ'` (`D.people` có `open > 0`). Còn lại `''`.
  - `locChips(f, names) → Array<{ k, label }>` — `names = { src: [[v,l]], st: [[v,l]], type: {id: tên} }`; nhãn: `Tìm "<q>"`, `Nguồn: <l>`, `Loại: <tên>`, `Nhóm: <cat>`, `Trạng thái: <l>`; chỉ điều kiện khác rỗng, đúng thứ tự q, src, type, cat, st.

- [ ] **Step 1: Viết bài thử** (mẫu `dot7`), dữ liệu nhỏ tự dựng: Sổ thu TM có `dt` + `no`, `lc` = 0, 1 khoản `lc` đã xoá; `lech` 2 khoản (1 `status:'Chờ xử lý'`). Khẳng định:
  - `zeroCols(I,'thu','tm')` chứa `'lc'`, `'khac'`, không chứa `'dt'`; `zeroCols(I,'thu','tm','lc')` không chứa `'lc'`
  - `tileInfo(D,'thu','tm','lech')` → `sub === '1 ca chờ xử lý'`, `warn === true`
  - `tileInfo(D,'thu','tm','no').sub === '+ 3 khách còn nợ'` (`D.open_debts` 3 dòng); `tileInfo(D,'thu','tm','lc').zero === true`
  - chi: 2 khoản `chi` không `cat` → `sub === '2 khoản cần phân loại'`, `warn === true`
  - `locChips({q:'bàn',src:'ca',type:'',cat:'',st:''}, names).map(c=>c.label)` = `['Tìm "bàn"','Nguồn: Từ phiếu ca']`; mọi rỗng → `[]`
- [ ] **Step 2:** `jsc -m kiem_tra/so_thu_chi_tinh_dot9.mjs` → lỗi.
- [ ] **Step 3:** Viết 3 hàm (chuyển `SRC_OPTS` / `ST_OPTS` không bắt buộc — truyền qua `names`).
- [ ] **Step 4:** Chạy lại → đạt; `dot6`, `dot7`, `dot8` vẫn đạt.

### Task 2: Phần đầu + bảng ngày, bỏ cột phải

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` — `bookPage` (dòng ~847), `bookCard` (~776), `cells` (~572); biến mô-đun `SHOW_ZERO = false` (cạnh `OPEN_D`).
- Modify: CSS Sổ thu chi.
- Create: `kiem_tra/trinh_duyet/flow_stc12.js` (mẫu `flow_stc7.js`), thêm vào `chuan_bi.sh`. Các task sau thêm câu kiểm vào cùng tệp.

**Interfaces:**
- Consumes: `zeroCols`, `tileInfo` (Task 1).
- Produces: `.stc-sw` chứa 2 `a.stc-pay`; `.stc-tiles` chứa `a.stc-tile[data-col]` (lớp `warn` khi `warn`, `zero` khi `zero`, `on` + chữ `đang lọc ✕` khi đang chọn); `.stc-hidecols` (dòng "Đang ẩn cột …" + nút `[data-showzero]`).

Hành vi theo spec mục 1, 2: bỏ ô "Tổng · Tiền mặt", dòng công thức thành chữ nhỏ dưới hàng ô; bỏ `aside.stc-aside`, sổ rộng hết trang; cột trong `zeroCols(…, P.cot)` ẩn khỏi tiêu đề + mọi dòng (`--n` theo số cột còn lại) trừ khi `SHOW_ZERO`; ô bằng 0 trong bảng để trống thay "–"; hàng xen màu, cột Tổng tô nền.

- [ ] **Step 1: Viết câu kiểm `flow_stc12` phần đầu** (role chu, Sổ thu TM): không có `.stc-aside`; có `.stc-sw a.stc-pay` ×2; số `.stc-tile[data-col]` = 5; không có ô "Tổng thu · Tiền mặt"; fixture có cột cả tháng bằng 0 → tiêu đề không có cột đó và thấy `Đang ẩn cột`; bấm `[data-showzero]` → cột hiện lại; ô bằng 0 trong dòng ngày là chuỗi rỗng.
- [ ] **Step 2:** Chạy trên bản cũ → lỗi ở `.stc-aside`.
- [ ] **Step 3:** Sửa `bookPage`, `bookCard`, `cells`, CSS.
- [ ] **Step 4:** Chạy `flow_stc12` → các câu của task này đạt.

### Task 3: Bấm ô → danh sách một loại + các khung chuyển từ cột phải

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` — thêm `colView(D, book, col)`; tách `bookSide` thành `debtBox(D)` (Khách còn nợ), `catBox(D)` (Chi theo loại · TM + CK), `todoRows(D)` (⚠ Cần phân loại, dùng `catSelect`), `peopleBox(D)` (Người nợ, ô ✓); giữ `qnShare(D)`; **xoá** `bookSide`. `bookCard` gọi `colView` khi có `P.cot` và không có `loc`.

**Interfaces:**
- Consumes: Task 2.
- Produces: `colView` (tiêu đề `<Sổ> · <Tiền> · chỉ hiện [<loại>] · <n> khoản · <tiền>` + `a` `✕ Bỏ lọc` về `cot` rỗng; danh sách `itemRow` mỗi dòng có ngày · ca; dòng `Cộng`); `debtBox`, `catBox`, `todoRows`, `peopleBox` (Task 4 dùng lại `peopleBox` trong cửa sổ).

Bảng chỗ hiện (spec mục 3): Thu·`no` → `debtBox` rồi "Đã thu nợ tháng này"; Chi·`chi` → `qnShare` (chỉ `D.ext`) + `catBox` + `todoRows` đưa lên đầu rồi "Đã phân loại"; Chi·`no` → `peopleBox` rồi các khoản cho nợ; `lech` (cả 2 sổ) → không thêm khung. Danh sách theo `P.pm`.

- [ ] **Step 1: Thêm câu kiểm `flow_stc12`:** Sổ thu, bấm `[data-col=no]` → có chữ `Khách còn nợ`, có `[data-col-debt]`, có dòng `Cộng`, có `✕ Bỏ lọc`; bấm `✕ Bỏ lọc` → về bảng ngày. Sổ chi, bấm `[data-col=chi]` → có `Chi theo loại`, `Cần phân loại` đứng trước `Đã phân loại`, có ô chọn nhóm; bấm `[data-col=no]` → có `[data-person]`. Bấm `[data-col=lech]` ở Sổ chi → mỗi dòng có `[data-gap]` (khi ca đã xác nhận Fabi). Quỹ ngoài (`cn=ngoai`) → bấm `[data-col=chi]` có `Phần mỗi cơ sở chịu`, `[data-person]` bị `disabled`.
- [ ] **Step 2:** Chạy → các câu mới lỗi.
- [ ] **Step 3:** Làm `colView` + tách khung.
- [ ] **Step 4:** Chạy → đạt.

### Task 4: Nút 👥 Người nợ + bộ lọc dễ đọc

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` — `peopleDialog(D)` (cửa sổ: `peopleBox(D)` + `+ Thêm người nợ` dùng chung hộp thoại của `setWho` nhánh `'__add'` — tách phần đó thành `addPersonDialog(D, onName)`; nút Đóng); nút `[data-people]` cạnh "+ Thêm phiếu" ở Sổ chi (bảng ngày lẫn `colView`), ẩn khi `D.ext`. `filterBar` (~727): mỗi ô chọn ghi `Nguồn · <giá trị>`, ô khác "Tất cả" thêm lớp `on`; Trạng thái có chữ giải thích trong `<option>`; dòng `.stc-chips-loc` dùng `locChips` với nút `[data-unloc="<k>"]` và `Bỏ hết`, bên phải `<n> khoản · <tiền>`; điện thoại: ô tìm + nút `⚙ Lọc (n)` mở 4 ô chọn. `bookFlat` (~762): nhóm theo ngày (dòng tiêu đề ngày), ca ghi ở dòng phụ, cuối có dòng `Cộng`.

**Interfaces:**
- Consumes: `locChips` (Task 1), `peopleBox` (Task 3).

- [ ] **Step 1: Thêm câu kiểm `flow_stc12`:** Sổ chi có `[data-people]`; bấm → cửa sổ có `[data-person]` và `+ Thêm người nợ`; bấm ✓ → gọi `app_stc_person_mark` 1 lần. Gõ tìm `bàn` + chọn Nguồn `Từ phiếu ca` → thấy `Đang lọc:` với 2 nút; bấm ✕ của Tìm → còn 1, địa chỉ vẫn giữ `cot` nếu có (Review Focus 1); `Bỏ hết` → không còn dòng "Đang lọc". Kết quả lọc có dòng tiêu đề ngày và `Cộng`. `test/phone.html`: có `⚙ Lọc`, 4 ô chọn ẩn tới khi bấm.
- [ ] **Step 2:** Chạy → lỗi.
- [ ] **Step 3:** Làm như trên.
- [ ] **Step 4:** Chạy → đạt.

### Task 5: Mở ngày gọn, trạng thái ca một lần, khung "+ Thêm phiếu" 2 hàng, câu chữ Đối soát Fabi

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` — dòng ca trong `bookCard`: thêm trạng thái ca (Global Constraints); ca bị khoá (`!recon_money_done` hoặc `D.locked`) → một dòng `.stc-calock` đầu danh sách khoản, ví dụ `⏳ Chưa xác nhận Fabi: chưa thêm / sửa được · Xử lý ca này ở Đối soát Fabi ›` (lý do chi tiết ở `title`); `itemRow(x, book, D, { quiet = false } = {})` — `quiet` thì bỏ nút "Sửa / Xoá" mờ và dòng 🔒 (nhánh dòng ~563–567), mọi nút sửa được vẫn giữ; `addBtn` không lặp lại dòng khoá khi đã có `.stc-calock`. `addPanel`: chỉ đổi cách xếp thành 2 hàng (Loại · Tiền · Ngày · Ca · Số tiền / Nội dung · Lý do · Lưu · Huỷ), **giữ** `fillCa`, `.stc-canote`, ô Ngày không khoá (KH3). `partB` dòng ~1080: thay câu "Khoản nợ nằm ở …" bằng chữ ở Global Constraints. CSS vạch trái lớp ca / lớp khoản, ngày đang mở tô nền; điện thoại dòng ngày / ca chỉ tên + Tổng, các loại thành chữ nhỏ (như `stc-chips`).

- [ ] **Step 1: Thêm câu kiểm `flow_stc12`:** mở một ngày + một ca chưa xác nhận Fabi → có đúng 1 `.stc-calock`, không có `button.stc-act[disabled]` trong ca đó; ca đã xác nhận Fabi có khoản sửa được → còn `.stc-ed`. Mở "+ Thêm phiếu" → các ô cũ vẫn đủ (`[name=ca]`, `[name=date]`, Lý do…). Đối soát Fabi có chữ `bấm ô Thu nợ › Khách còn nợ`.
- [ ] **Step 2:** Chạy → lỗi.
- [ ] **Step 3:** Làm như trên.
- [ ] **Step 4:** Chạy `flow_stc12` → đạt; `flow_stc11` (KH3) và `flow_gio162` (KH2) → vẫn đạt.

### Task 6: Sửa bài thử cũ, chạy hết, phát hành

**Files:**
- Modify: `kiem_tra/trinh_duyet/flow_stc1.js` … `flow_stc10.js` — chỗ dò `stc-aside`, `stc-side`, ô "Tổng · …", thẻ cột phải: đổi sang bấm ô tương ứng rồi dò trong `colView` (giữ nguyên ý kiểm, chỉ đổi đường đi). Nếu `flow_stc11` / `flow_gio162` hỏng vì đường đi thì sửa tương tự.
- Modify: `kiem_tra/trinh_duyet/README.md` (dòng `flow_stc12`), `tai_lieu/BAN_GIAO.md`, `tai_lieu/TINH_NANG_DA_CHOT.md`.

- [ ] **Step 1:** Chạy cả bộ `flow_stc0`–`flow_stc12` + `flow_gio162` (role chu / qlt / ql × `index.html` + `test/phone.html`) → ghi những bài lỗi.
- [ ] **Step 2:** Sửa từng bài lỗi **chỉ khi lỗi do đổi chỗ hiện**; lỗi do mất chức năng thì sửa mã trang. Chạy lại → đạt hết.
- [ ] **Step 3:** Vùng khoá: `flow_ql_tu_ds` (ql + chu × 2 khung), `flow_stc6`, `flow_stc7` → đạt. Kiểm 390px mọi tab Sổ thu / Sổ chi / Quỹ ngoài: `scrollWidth <= 390`.
- [ ] **Step 4: Duyệt mã 1 lần**, sửa điều được chỉ ra.
- [ ] **Step 5: Phát hành** theo lộ trình; cập nhật tài liệu (BAN_GIAO: bước 164, tên hàm mới; TINH_NANG_DA_CHOT: mục Sổ thu chi gọn).
- [ ] **Step 6: Nhờ anh Tiến xem trên web thật**: Sổ thu › bấm ô Thu nợ, Sổ chi › bấm ô Các khoản chi, 👥 Người nợ, thử lọc.
