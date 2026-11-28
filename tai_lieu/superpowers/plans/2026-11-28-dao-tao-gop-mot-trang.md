# Đào tạo gộp một trang — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một mục "Đào tạo" duy nhất: danh sách người có phiếu + bộ lọc, mở phiếu / phân công theo ca / chờ kiểm tra ngay trong thẻ từng người; bỏ hai thẻ Phân công + Chờ kiểm tra kiểu cũ.

**Architecture:** Trang gộp ở `#/cong-viec/dao-tao` (`cv_dao_tao.js` viết lại) ghép hai nguồn có sẵn: `app_dt_work_list` (mọi phiếu người dùng được thấy, có `branch`, `instructor`, `status`, `program`, `n_check`) và `app_dt_plan_board` (bảng theo ca, chỉ phiếu đang mở của người có quyền bảng), nối theo `id`. Phần theo ca của `pc_dao_tao.js` tách thành hàm dựng khối (`planUi`) để trang gộp gọi lại — không viết lại logic. Phiếu nhúng bằng chính `render` / `mount` của `phieu_dao_tao.js`; mỗi lúc chỉ nhúng một phiếu (phiếu dùng `id` cố định). Không có tệp SQL.

**Tech Stack:** JavaScript thuần ES modules, `html\`\`` của `docs/js/ui.js`; bài thử `kiem_tra/trinh_duyet` (Playwright `chay_pw.py`), hàm thuần chạy `jsc -m`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-28-dao-tao-gop-mot-trang-design.md`

## Global Constraints

- Không đổi quyền, không tệp SQL, không đụng vùng khoá tiền. Máy chủ vẫn là nơi chặn; web chỉ ẩn / hiện theo `can_board`, `can_check` máy chủ trả.
- Giữ nguyên các lớp / thuộc tính bài thử đang dùng: `details.pcd-card[data-id]`, `.pcd-sh[data-key]`, `.pcd-ktr[data-no] [data-ktok]`, `#pcd .pcd-sum`, `#pcd-who`, `#pcd-d`, `#pcd-fw-r`, `dialog.pcd-dlg`, `#pcd-mine`, `#dt-reviewer`.
- Trang phiếu riêng `#/dao-tao/phieu?id=` giữ nguyên.
- Đường cũ `#/dao-tao/phan-cong` → `go('/cong-viec/dao-tao')`; `?tab=` cũ bị bỏ qua; `?muc=pha_che|chay_ban` đặt sẵn bộ lọc chương trình.
- Tiếng Việt đơn giản trên giao diện; không tràn ngang ở 390px; nút ≥ 44px trên điện thoại theo cách web đang làm.
- Mỗi lần sửa tệp có `?v=` thì tăng `?v=` nơi import và `ASSET_VERSION` trong `docs/js/app.js`; `docs/version.json` = bản của `origin/main` + 1 (fetch ngay trước khi đặt).
- Commit tên `Tien Do <tiendo286@gmail.com>`, cuối có `Co-Authored-By`. Không đẩy `main` khi anh Tiến chưa bảo.

## Review Focus

1. Người không có quyền bảng (ql2, c1, nv): không thấy nút Phân công theo ca / Chờ kiểm tra, vẫn mở được phiếu của mình, vẫn thấy "Việc đào tạo của tôi" khi có việc → kiểm ở Task 4 (`flow_dtgop` role ql2 / c1 / nv).
2. Lưu trong phiếu nhúng (phiếu gọi `rerender` của app): trang vẽ lại phải còn đúng người đang mở, đúng nút Phiếu, không nhảy cuộn → Task 4 (`flow_dtgop` role ql: tích một mục rồi kiểm thẻ còn mở + phiếu còn).
3. Mở phiếu người thứ hai khi người thứ nhất đang mở phiếu: không trùng `id` trong trang (`#dt-tabs` chỉ có một) → Task 4.
4. Bộ lọc không khớp ai / danh sách rỗng / `app_dt_plan_board` lỗi (trả `can_board: false`): trang vẫn hiện danh sách phiếu, có dòng "Không có ai khớp bộ lọc" → Task 1 (hàm thuần) + Task 4.
5. Giao giai đoạn 2 khi mức đang chọn là Tốt: nút ẩn (giai đoạn 2 chỉ cho Trung bình / Khá) → Task 4.

---

### Task 1: Hàm thuần lọc + xếp danh sách

**Files:**
- Create: `docs/js/pages/dao_tao_loc.js`
- Test: `kiem_tra/dao_tao_loc_tinh.mjs` (chạy `jsc -m`, in `ĐẠT n/n` hoặc dòng `HỎNG:`)

**Interfaces — Produces:**
- `norm(s: string): string` — bỏ dấu, chữ thường.
- `matchRow(row, F, skipSt = false): boolean` — `F = { q, cs, prog, hd, st }` (chuỗi rỗng = không lọc). `q` so trên `row.employee` không dấu; `cs` = `row.branch`; `prog` = `row.program` (mã `chay_ban` | `pha_che`); `hd` = `row.instructor`; `st` = `row.status`. Khi `F.st` rỗng: **ẩn** `row.status === 'hoan_thanh'`. `skipSt` = bỏ qua cả hai luật trạng thái (để đếm cho nút).
- `chipCounts(rows, F): { [status]: number }` — đếm theo `status` trên các dòng khớp phần còn lại của bộ lọc.
- `sortRows(rows): row[]` — không sửa mảng gốc; thứ tự: `need > 0` trước (`need` = `n_check` + `n_todo`, thiếu thì coi 0), rồi `hoan_thanh` cuối, rồi `due` tăng, rồi `id`.
- `optionsOf(rows, key): string[]` — giá trị khác rỗng, không trùng, xếp theo `localeCompare('vi')`.

- [ ] **Step 1:** Viết `kiem_tra/dao_tao_loc_tinh.mjs` với 5 dòng mẫu (2 cơ sở, 2 chương trình, 1 `hoan_thanh`, 1 có `n_check: 2`): `matchRow` mặc định ẩn hoàn thành; `st: 'hoan_thanh'` chỉ ra người hoàn thành; `q: 'nguoi hoc'` khớp "NV03 – Người học thử"; `cs` + `prog` kết hợp; `chipCounts` không bị `st` làm đổi số; `sortRows` đưa dòng `n_check: 2` lên đầu, hoàn thành xuống cuối, mảng gốc không đổi; `optionsOf` bỏ `null`.
- [ ] **Step 2:** Chạy `jsc -m kiem_tra/dao_tao_loc_tinh.mjs` → hỏng vì chưa có module.
- [ ] **Step 3:** Viết `docs/js/pages/dao_tao_loc.js` theo Interfaces.
- [ ] **Step 4:** Chạy lại → `ĐẠT`.
- [ ] **Step 5:** Commit.

### Task 2: Tách phần theo ca thành `planUi`

**Files:**
- Modify: `docs/js/pages/pc_dao_tao.js` (bỏ `render`, `perm`; giữ nguyên chữ, lớp, lệnh máy chủ)

**Interfaces — Produces:**
- `planUi(B, { keepOpen(id: number): void, reload(): Promise<void> })` → `{ rows, today, C, trainers, pills(r), warnHtml(r), ktHtml(r), shiftsHtml(r), fwSection(), handleClick(e, root): boolean, handleChange(e, root): boolean, nTodo(r): number }`
  - `pills(r)`: các nhãn hiện có (chờ kiểm tra, ca chưa chấm, thiếu ngày làm) **+ mới** `<span class="pill off">{n} ca chưa giao</span>` khi `nTodo(r) > 0`.
  - `nTodo(r)` = số ca trong `allShifts(r)` có `shiftState(r, sh, today) === 'chua'`.
  - `ktHtml(r)`: khối `.pcd-kt` hiện có; khi `r.can_check` thêm nút `<button class="btn sm secondary" data-ktp2>Giao giai đoạn 2</button>` sau "Xác nhận đạt", `hidden` khi mức đang chọn là `tot`. Không có mục chờ → `<div class="pcd-meta">Không có mục nào chờ kiểm tra.</div>`.
  - `shiftsHtml(r)`: dòng "mục đã giao ở trang cũ" + `.pcd-shs` / `.pcd-nosched` hiện có.
  - `handleClick`: xử lý `.pcd-sh`, `[data-open]`, `[data-ktok]`, `[data-ktp2]`; trả `true` nếu đã xử lý. Thẻ tìm bằng `closest('.pcd-card').dataset.id`. Sau khi lưu gọi `keepOpen(id)` rồi `reload()` (thay cho `OPEN.add` + `rerender`).
  - `[data-ktp2]`: gọi `app_dt_check_ok` với mức đang chọn, rồi `openItemGuide(T, item, null, reload, true)` (từ `dt_cong_viec.js`) với `T = { id, instructor, instructor_id, branch, item_branches: <cơ sở đang hoạt động từ catalog(): {id, code}>, helpers: B.trainers → {id, name} }`.
  - `handleChange`: `#pcd-who`, `#pcd-d` (vẽ lại `#pcd-fw-r`) và ẩn / hiện `[data-ktp2]` khi đổi `.pcd-kt-lv`.
- `myPlanBlock()` không đổi: trang gộp tự gọi `app_dt_my_plan` + `myPlanHtml` / `mountMyPlan` từ `pc_dao_tao_toi.js`.

- [ ] **Step 1:** Tách như trên; `openShift` giữ nguyên thân, chỉ đổi hai chỗ `OPEN.add(r.id); … rerender()` thành `keepOpen(r.id); … reload()`.
- [ ] **Step 2:** Kiểm cú pháp: `jsc -m` một tệp nhỏ import module không chạy được (phụ thuộc DOM) → thay bằng kiểm ở Task 4; ở đây chỉ `git diff --stat` + đọc lại diff. (Bài thử `flow_pcdt` chạy ở Task 4 là chốt cho task này.)

### Task 3: Trang gộp + menu + đường dẫn cũ

**Files:**
- Rewrite: `docs/js/pages/cv_dao_tao.js`
- Modify: `docs/js/app.js` (HUBS bỏ `['Phân công đào tạo', '/dao-tao/phan-cong', null]`; PAGES bỏ `'/dao-tao/phan-cong'`; thêm `if (path === '/dao-tao/phan-cong') return go('/cong-viec/dao-tao');` cạnh các đường cũ khác; `ASSET_VERSION`)
- Modify: `docs/js/pages/pc_dao_tao_toi.js` chỉ khi cần CSS (thêm vào `PCD_CSS`)

**Trạng thái giữ trong module (sống qua các lần vẽ lại):** `F = { q, cs, prog, hd, st }`, `OPEN: Set<id>`, `TAB: Map<id, 'phieu'|'ca'|'kt'>` (mặc định `'phieu'`), `PH: number|null` (phiếu đang nhúng).

**Dựng trang (`render({ params })`):**
- Gọi song song `app_dt_work_list`, `app_dt_plan_board` (lỗi → `{ can_board: false, rows: [] }`); khi `!can_board` gọi thêm `app_dt_my_plan` (lỗi → `null`).
- Nếu `PH` có trong danh sách và thẻ đó đang mở với nút Phiếu: `await` `render({ params: { id: PH } })` của `phieu_dao_tao.js` **trong** `render` (để phiếu có ngay khi trang vẽ lại, giữ chỗ cuộn); lỗi → khối báo lỗi trong thẻ, không làm hỏng trang.
- Dòng = `sortRows(D.rows + n_todo từ planUi.nTodo)`; mỗi dòng một `<details class="card pcd-card" data-id data-st data-cs data-prog data-hd data-search>`; có dữ liệu bảng → `summary` thêm nhãn trạng thái (`DT_STATUS` / `dtLabel`), cơ sở, và `planUi.pills(r)`; thân có 3 nút `button[data-dtab="phieu|ca|kt"]` (lớp `dtg-tab`, `aria-pressed`) + 3 khối `[data-dpane]` (khối không chọn mang `hidden`). Không có dữ liệu bảng → chỉ khối phiếu, không có nút.
- Khối phiếu: `<div class="dtg-ph" data-ph="{id}">` — chứa phiếu nếu `PH === id`, ngược lại nút `button[data-phload]` "Mở phiếu ở đây".
- Đầu trang: `h1` "Đào tạo" + nút "Việc của tôi"; khung Người phụ trách chính (`#dt-reviewer`, chỉ khi `D.accounts`) trong `<details class="card">` tóm tắt "Người phụ trách chính: {tên | chưa chọn}"; người khác thấy dòng `Người phụ trách chính: …`; bộ lọc `#dtg-f` (ô `#dtg-q`, `#dtg-cs`, `#dtg-prog`, `#dtg-hd`, nút trạng thái `button.dtg-chip[data-st]` có số, `#dtg-count` "Đang hiện x / y người", `#dtg-clear`); có quyền bảng: `#pcd .pcd-sum` + `planUi.fwSection()`; không có quyền bảng và `P` có `checks` hoặc `shifts`: `myPlanHtml(P)`; `#dtg-empty` "Không có ai khớp bộ lọc." (`hidden` khi có người).
- Lọc **không gọi lại máy chủ**: `applyFilter(root)` đặt `hidden` trên thẻ theo `matchRow`, cập nhật số ở nút trạng thái (`chipCounts`), `#dtg-count`, `#dtg-empty`.

**Hành vi (`mount(root)`, trả hàm dọn):**
- `toggle` thẻ: cập nhật `OPEN`; mở thẻ có nút Phiếu đang chọn (hoặc thẻ không có nút) mà `PH !== id` → nạp phiếu tại chỗ.
- Nạp phiếu tại chỗ (`loadPhieu(id)`): dọn phiếu cũ (gọi hàm dọn, trả khối cũ về nút "Mở phiếu ở đây"), đặt `PH = id`, `render` + `mount` phiếu vào `.dtg-ph` của thẻ; không vẽ lại cả trang.
- Bấm `[data-dtab]`: đổi `TAB`, đổi `hidden` / `aria-pressed` tại chỗ; chọn Phiếu mà chưa nạp → `loadPhieu`.
- `reload()` dùng cho planUi và khung người phụ trách: nhớ `scrollY` → `rerender()` của app → `scrollTo`.
- Phiếu nhúng tự gọi `rerender` của app khi lưu → `render` ở trên dựng lại đúng thẻ nhờ `OPEN` / `TAB` / `PH`.
- `?muc=` trong đường dẫn: lần đầu vào đặt `F.prog`.

- [ ] **Step 1:** Viết lại `cv_dao_tao.js` theo trên; CSS mới đặt trong tệp (`.dtg-*`), điện thoại: bộ lọc xếp dọc, nút trạng thái tự xuống dòng, `.dtg-ph .page-head h1 { font-size: 18px }`.
- [ ] **Step 2:** Sửa `app.js`.
- [ ] **Step 3:** Dựng web thử (`chuan_bi.sh … --dao-tao-gia`), mở tay bằng Playwright chụp 2 ảnh (máy tính, 390px) để nhìn bố cục trước khi viết bài thử.
- [ ] **Step 4:** Commit.

### Task 4: Bài thử

**Files:**
- Create: `kiem_tra/trinh_duyet/flow_dtgop.js`; thêm vào `chuan_bi.sh` (cùng dòng với `flow_dt170`), chép kèm `flow_pcdt.js`, `menu_dt.js`.
- Modify: `flow_pcdt.js` (đường `#/cong-viec/dao-tao`; trước khi đo dòng ca / chờ kiểm tra thì bấm nút tương ứng; câu "menu có mục Phân công đào tạo" → "đường cũ tự chuyển về Đào tạo"), `flow_dt137.js` (hai đường `?muc=` → ô lọc chương trình), `menu_dt.js` (chỉ còn mục Đào tạo; thứ tự Chủ `Nhân viên | Đào tạo | Đánh giá | Phân quyền`), `flow_dt169.js` / `flow_hn142.js` / `flow_dt_c4.js` nếu có chỗ dựa vào thẻ cũ.
- Delete: `flow_dt170.js` (thẻ Phân công / Chờ kiểm tra kiểu cũ đã bỏ theo anh Tiến 28/11) — các câu về quyền (ql2, c1 không thấy bảng) chuyển sang `flow_dtgop`.
- Modify: `kiem_tra/trinh_duyet/dt_gia.js` chỉ khi giả lập thiếu trường máy chủ thật có (`branch`, `instructor`, `status`, `n_check` của `app_dt_work_list`) — đối chiếu tệp 148 trước khi thêm.

**`flow_dtgop` kiểm (kết quả `out[].dtgop = { ok, fail }`), máy tính + `test/phone.html`:**
- chu / ql / kt&dtptc=7: không còn `a[href="#/dao-tao/phan-cong"]`; `#/dao-tao/phan-cong` → hash thành `#/cong-viec/dao-tao`; có `#dtg-f` đủ 4 ô + nút trạng thái có số; mặc định không hiện người `hoan_thanh`, bấm nút "Đã hoàn thành" thì hiện; gõ tên không dấu → `#dtg-count` đổi, gõ chuỗi không khớp → `#dtg-empty` hiện, `#dtg-clear` trả lại; mở thẻ 1 → phiếu hiện trong thẻ (`[data-ph="1"] #dt-tabs`), hash không đổi; bấm "Phân công theo ca" → `.pcd-sh` nhìn thấy; bấm "Chờ kiểm tra" → `.pcd-ktr` nhìn thấy; mở thêm phiếu thẻ 2 → cả trang chỉ một `#dt-tabs`, thẻ 1 còn nút "Mở phiếu ở đây"; lọc xong vẽ lại (gọi `rerender` qua một lần Xác nhận đạt ở role ql / kt) → bộ lọc, thẻ mở, nút đang chọn còn nguyên; role ql / kt: đổi mức về Tốt → `[data-ktp2]` ẩn, mức Khá → hiện, bấm → hộp "Giao giai đoạn 2" mở; role chu: không có `[data-ktok]`; không tràn ngang.
- ql2 / c1 / nv: không có `[data-dtab]`, không có `#pcd .pcd-sum`; phiếu mình liên quan mở được trong thẻ; ql2 / c1 có `#pcd-mine` khi có việc; nv không có thẻ nào → dòng trống; không tràn ngang.

- [ ] **Step 1:** Viết `flow_dtgop.js`, chạy role chu → xem hỏng chỗ nào là do trang (sửa trang) hay do bài (sửa bài).
- [ ] **Step 2:** Sửa các bài cũ; chạy đủ: `flow_dtgop` (chu, ql, kt&dtptc=7, ql2, c1, nv), `flow_pcdt` (chu, kt&dtptc=7, ql, ql2, c1, nv), `flow_dt137` (chu), `flow_dt169` (chu, ql, c1, ql2, kt&dtptc=7), `flow_dt_c4`, `flow_hn142` (ql, nv, kt, chu), `menu_dt` (chu, ql, qlt, kt, nv; web đủ dữ liệu), `flow_tk` (chu) — máy tính + `--phone`; `jsc -m kiem_tra/dao_tao_loc_tinh.mjs`, `pc_dao_tao_tinh_174.mjs`, `pc_dao_tao_tinh_187.mjs`.
- [ ] **Step 3:** So "bản cũ có hỏng không" cho mọi dòng hỏng còn lại trước khi kết luận.
- [ ] **Step 4:** Commit.

### Task 5: Tài liệu + bản web

**Files:** `tai_lieu/TINH_NANG_DA_CHOT.md` (đúng mục Đào tạo), `tai_lieu/BAN_GIAO.md`, `kiem_tra/trinh_duyet/README.md`, `docs/version.json`.

- [ ] **Step 1:** Ghi các điểm anh chốt 28/11 + 3 điểm em tự quyết (ẩn hoàn thành, xếp việc cần làm lên đầu, phiếu xổ tại chỗ một phiếu một lúc).
- [ ] **Step 2:** `git fetch`; `version.json` = bản `origin/main` + 1; rebase; chạy lại `flow_dtgop` chu + `menu_dt` chu.
- [ ] **Step 3:** Commit; báo anh Tiến; chờ anh bảo đẩy. Sau khi đẩy: ghi `app_releases`, kiểm web thật.
