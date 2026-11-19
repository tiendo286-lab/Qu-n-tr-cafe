# Xem như người khác — Kế hoạch làm (KH1, lượt 4, bước 165)

> **Trạng thái: CHỜ anh Tiến bảo "chạy".** Chưa làm bước nào. Làm **cuối cùng**, chỉ khi KH2, KH3, KH4 đã đẩy lên `main`. Đọc trước `plans/2026-11-19-lo-trinh-4-ke-hoach.md` (luật chung, số bước, số tệp SQL).
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (anh Tiến dặn dùng tiết kiệm — tự làm, duyệt 1 lần cuối) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ chọn một người cụ thể → web (máy tính + khung điện thoại 390px) hiện đúng y màn hình và dữ liệu người đó thấy, chỉ xem, máy chủ chặn mọi thao tác ghi.

**Architecture:** Máy chủ: `app_account()` (gốc của mọi `app_can` / `app_me`) trả tài khoản người được xem khi phiên đăng nhập của Chủ có dòng `view_as` còn hạn; một hàm chạy trước mọi yêu cầu (`pgrst.db_pre_request`) bật chế độ chỉ đọc cho phiên đó. Giao diện: `app_me` trả thêm `view_as` → web vẽ dải vàng + nút Máy tính / Điện thoại / Đổi người / Thoát.

**Tech Stack:** PostgreSQL (Supabase, chạy qua Management API), JavaScript thuần (ES modules, `html\`\``), bộ giả lập `kiem_tra/trinh_duyet/`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-xem-nhu-nguoi-khac-design.md`

## Global Constraints
- Chỉ **Chủ thật** (`system_role = 'chu'`, `locked = 0`) bật được; không xem như Chủ khác; người bị khoá / nghỉ việc không chọn được.
- Gắn theo **phiên đăng nhập** (`auth.jwt() ->> 'session_id'`), không theo tài khoản — máy khác của Chủ không bị đổi.
- Tự hết hạn sau **30 phút** (`expires_at = now() + interval '30 minutes'`).
- **Không ghi gì** dưới tên người được xem; ngoại lệ duy nhất: `app_view_as_start`, `app_view_as_stop` (tự kiểm tra Chủ thật).
- Bật không hỏi mật khẩu. Vùng khoá (`app_can` qua `app_account`) — anh Tiến đã bỏ mật khẩu 19/11; trước khi chạy tệp SQL thật, báo anh 1 dòng "sắp đổi app_account như mục 5 bản thiết kế".
- Tệp SQL mới: số thứ tự = số lớn nhất trong `app_migrations` + 1 (so theo số, xem lộ trình — `max(file)` so theo chữ nên "99_" lớn hơn "145_") (dự kiến **145** sau KH2 dùng 144, kiểm lại khi chạy); chạy lại được; dòng cuối `insert into public.app_migrations(file) values ('145_xem_nhu.sql') on conflict (file) do nothing;`. Bảng mới không cấp quyền cho `anon` / `authenticated`.
- Chạy thử trong khối `DO $$ … RAISE EXCEPTION 'REPORT>> %' … $$` trước, rồi mới chạy thật. Supabase cập nhật **trước** khi đẩy giao diện.
- Chữ trên web: tiếng Việt dễ hiểu. Dải vàng: `Đang xem như <Tên> · <Vai> · <Cơ sở> — chỉ xem · còn <N> phút`. Lỗi ghi: `Đang xem như người khác — chỉ xem, không lưu được.`
- Đẩy lên `main`: tăng `docs/version.json`, ghi `app_releases`, commit tên `Tien Do <tiendo286@gmail.com>` + dòng Co-Authored-By.

## Review Focus
1. **Hàm chạy trước mọi yêu cầu bị lỗi → cả web chết.** Thân hàm bọc `exception when others then null` (riêng phần tra `view_as`); bài thử SQL gọi nó khi không có JWT, JWT không có `session_id`, JWT người thường — đều không lỗi. (Task 1)
2. **Chủ đang xem mở thêm tab / bấm Đổi người / Thoát** — phải chạy được dù phiên đang chỉ đọc. Bài thử SQL: đang xem như A → `app_view_as_start(B)` được, `app_view_as_stop()` được. (Task 1)
3. **Hết 30 phút giữa chừng** — máy chủ tự về Chủ; web phải tải lại, không để dải vàng nói sai. Bài thử trình duyệt: `expires_at` trong quá khứ 1 giây → trang tự tải lại thành Chủ. (Task 3)
4. **Trang tự ghi khi mở** (đánh dấu đã đọc, tự tạo việc…) hiện hộp lỗi đỏ ở chế độ xem. Bài thử đi hết mọi mục menu của nv / ql / ql_tong / ke_toan và đếm hộp lỗi. (Task 4)
5. **Người không phải Chủ có dòng `view_as` giả** (vd tài khoản bị hạ vai sau khi bật) — `app_account()` phải bỏ qua. Bài thử SQL: chèn tay dòng `view_as` cho QL → `app_account()` vẫn là QL. (Task 1)

---

### Task 1: Máy chủ — tệp `145_xem_nhu.sql` + bài thử

**Files:**
- Create: `supabase/145_xem_nhu.sql`
- Create: `kiem_tra/xem_nhu_145.sql` (gửi CÙNG LẦN, sau nội dung tệp 145 chạy 2 lần; kết thúc `RAISE EXCEPTION 'REPORT>> %'`)

**Interfaces:**
- Produces:
  - bảng `public.view_as(session_id text primary key, owner_account_id bigint not null, target_account_id bigint not null, started_at timestamptz not null default now(), expires_at timestamptz not null)`
  - `public.app__real_account() returns public.accounts` — đúng thân `app_account()` cũ (tệp `02_bao_mat.sql` dòng 12–20). Không cấp cho web.
  - `public.app_account()` — viết lại plpgsql stable: `r := app__real_account()`; chỉ khi `r.system_role = 'chu'` mới tra `view_as` theo `session_id` + `owner_account_id = r.id` + `expires_at > now()`; tìm thấy và người đích còn `locked = 0` + đang làm → trả tài khoản đích; còn lại trả `r`. (Người thường không tốn thêm truy vấn.)
  - `public.app_view_as_people() returns jsonb` — mảng `{account_id, name, code, role, branches:[tên cơ sở], ke_toan:boolean}` mọi tài khoản đang làm, trừ vai `chu`, sắp theo vai rồi tên. Kiểm tra bằng `app__real_account()`.
  - `public.app_view_as_start(p_account bigint) returns void` — Chủ thật; đích hợp lệ; upsert theo `session_id`; `app_log('xem_nhu', 'bắt đầu xem như #<id> <tên>')`. Không có `session_id` → lỗi `Phiên đăng nhập không hợp lệ, hãy đăng nhập lại.`
  - `public.app_view_as_stop() returns void` — xoá dòng của phiên; `app_log('xem_nhu', 'thoát')`.
  - `app_me()` (tệp 06, dòng 188) — thêm khoá `view_as`: `null` hoặc `{account_id, name, role, branches, expires_at}` (dùng cho dải vàng; thay cho hàm `app_view_as_state` trong bản thiết kế — bớt 1 lần gọi).
  - `public.app__pre_request() returns void` — nếu phiên có `view_as` còn hạn của Chủ thật và `current_setting('request.path', true)` không thuộc `/rpc/app_view_as_start`, `/rpc/app_view_as_stop` → `perform set_config('transaction_read_only', 'on', true)`. Đăng ký: `alter role authenticator set pgrst.db_pre_request to 'public.app__pre_request'; notify pgrst, 'reload config';`
  - Thay `auth.uid()` bằng `(public.app_account()).auth_user_id` ở chính sách đọc `accounts` (02, dòng 130) và các chính sách kho ảnh so `owner_id` (lấy định nghĩa **mới nhất** — tệp 91 dòng ~369, đối chiếu 58) để Chủ đang xem thấy đúng ảnh của người đó. `app_touch_login` / `app_password_changed` giữ nguyên (đã bị chế độ chỉ đọc chặn). Tải ảnh lên kho không đi qua hàm chạy trước — chấp nhận: ảnh lẻ không gắn phiếu vô hại vì lưu phiếu bị chặn.
  - Quyền: `grant execute` 4 hàm `app_view_as_*` + `app_account` cho `authenticated`; `revoke` `app__real_account`, `app__pre_request` khỏi `anon, authenticated, public`.

- [ ] **Step 1: Viết bài thử `kiem_tra/xem_nhu_145.sql`** — giả JWT bằng `set_config('request.jwt.claims', json_build_object('sub', <auth_user_id>, 'role','authenticated','session_id', <chuỗi>)::text, true)`. Ghi vào `rep` từng câu (a)–(j):
  - (a) Chủ, chưa xem: `app_account().system_role = 'chu'`.
  - (b) Chủ `app_view_as_start(<id QL có cơ sở>)` → `app_account().id = QL`, `app_me()->>'role' = 'ql'`, `app_me()->'view_as'->>'account_id' = QL`, `app_can('phan_quyen') = false`, `app__stc_can(<cơ sở không giao>) = false`.
  - (c) Cùng Chủ, `session_id` khác → vẫn là Chủ.
  - (d) Trong khối `begin … exception`: `perform app__pre_request()` rồi `perform app_log('thu','x')` → lỗi chứa `read-only`.
  - (e) Đặt `request.path = '/rpc/app_view_as_stop'`, gọi `app__pre_request()` rồi `app_view_as_stop()` → được; `app_account()` lại là Chủ.
  - (f) Đang xem như A → `app_view_as_start(B)` → `app_account().id = B`.
  - (g) `update view_as set expires_at = now() - interval '1 second'` → `app_account()` là Chủ.
  - (h) QL gọi `app_view_as_start(<nv>)` → lỗi; chèn tay dòng `view_as` cho phiên QL → `app_account()` vẫn là QL.
  - (i) `app_view_as_start(<id Chủ khác hoặc chính Chủ>)` và `<tài khoản locked>` → lỗi.
  - (j) `app__pre_request()` khi `request.jwt.claims` rỗng / không có `session_id` → không lỗi.
- [ ] **Step 2: Gửi riêng bài thử (chưa có tệp 145)** qua Management API → mong đợi lỗi "function … does not exist" (chứng tỏ bài thử chạy được và chưa có hàm).
- [ ] **Step 3: Viết `supabase/145_xem_nhu.sql`** theo Interfaces ở trên.
- [ ] **Step 4: Gửi `145` ×2 + bài thử trong một lần** → mong đợi `REPORT>>` với (a)–(j) đều đúng như mô tả, không câu nào "LỖI" ngoài ý muốn. Tự hoàn tác.
- [ ] **Step 5: Báo anh Tiến 1 dòng rồi chạy thật `145`** (không kèm bài thử). Kiểm `select 1 from app_migrations where file = '145_xem_nhu.sql'` có dòng; mở web thật bằng tài khoản bất kỳ đã đăng nhập → vẫn vào được (hàm chạy trước không làm chết web).
- [ ] **Step 6: Commit** `supabase/145_xem_nhu.sql`, `kiem_tra/xem_nhu_145.sql` — "Máy chủ bước 165: Xem như người khác (145)".

### Task 2: Giả lập + bài thử trình duyệt (viết trước, phải hỏng)

**Files:**
- Modify: `kiem_tra/trinh_duyet/sb_gia.js` (dòng 28 `role`, 79–89 `ME`, 109–114 `rpc`)
- Create: `kiem_tra/trinh_duyet/flow_xn165.js`
- Modify: `kiem_tra/trinh_duyet/chuan_bi.sh` (thêm `flow_xn165.js` vào dòng chép tệp thử, như dòng 15)

**Interfaces:**
- Consumes: hình dạng `app_me().view_as`, `app_view_as_people()` ở Task 1.
- Produces: giả lập `localStorage.test_viewas` = `'nv' | 'ql' | 'qlt' | 'kt' | 'nvkt'` (khi `role=chu`) → `ME` = ME của vai đó + `view_as {account_id, name, role, branches:['LHP'], expires_at: now+30'}`; `test_viewas_exp=past` → `expires_at` đã qua. RPC giả: `app_view_as_people` (5 người, mỗi vai 1), `app_view_as_start` (đặt `test_viewas`), `app_view_as_stop` (xoá). Khi đang xem: RPC có tên khớp `/_(save|set|add|del|delete|mark|seen|ack|create|update|upsert|send|done|confirm|apply|close|open|claim)(_|$)/` ném `Error('cannot execute UPDATE in a read-only transaction')`.

- [ ] **Step 1: Viết `flow_xn165.js`** theo mẫu `flow_cu152.js`, kết quả `out.push({ xn165: { ok, fail } })`. Câu kiểm:
  - Chủ chưa xem: menu có mục `#/he-thong/xem-nhu`; trang có danh sách chia theo vai, có ô tìm (gõ không dấu "quan ly" ra Quản lý thử).
  - Bấm "Xem như" ở Quản lý thử → gọi `app_view_as_start` với `p_account = 5` → tải lại → `#va-bar` có chữ `Đang xem như Quản lý thử · Quản lý · LHP — chỉ xem`; menu **không** còn `#/quan-ly/log`, `#/he-thong/xem-nhu`.
  - Bấm `Điện thoại` → có `iframe#va-frame` rộng 390px; `Máy tính` → hết iframe. Chọn được nhớ sau tải lại.
  - Mở một trang có nút lưu, bấm lưu → thông báo đúng chữ `Đang xem như người khác — chỉ xem, không lưu được.`
  - `Đổi người` → hộp chọn người (không cần quyền `phan_quyen`) → chọn Nhân viên thử → dải vàng đổi tên.
  - `Thoát` → gọi `app_view_as_stop` → không còn `#va-bar`, menu lại có LOG hệ thống.
  - `test_viewas_exp=past` → trong 3 giây trang tự tải lại thành Chủ.
  - `role=ql` (không phải Chủ): không có mục Xem như, vào thẳng `#/he-thong/xem-nhu` bị báo không có quyền.
  - Không tràn ngang ở `test/phone.html` (`document.documentElement.scrollWidth <= 390`), không lỗi trang.
- [ ] **Step 2: Sửa `sb_gia.js`** theo Interfaces.
- [ ] **Step 3: Chạy** `chuan_bi.sh <thư mục tạm>` rồi `index.html?auto=1&role=chu&script=flow_xn165` → mong đợi **KIỂM TRA THẤT BẠI** (chưa có trang / dải vàng).
- [ ] **Step 4: Commit** — "Bài thử bước 165 (chưa đạt)".

### Task 3: Giao diện — trang Xem như + dải vàng + khung điện thoại

**Files:**
- Create: `docs/js/pages/xem_nhu.js` — `export default` theo mẫu các trang khác trong `docs/js/pages/`; danh sách người + ô tìm (dùng `norm` ở `ui.js` cho tìm không dấu); `export function pickPerson()` mở hộp chọn (dùng `dialog` ở `ui.js`) — dùng lại cho nút Đổi người.
- Modify: `docs/js/app.js` — `HUBS` dòng 29 nhóm "Dữ liệu & LOG" thêm `['Xem như người khác', '/he-thong/xem-nhu', 'phan_quyen']`; `PAGES` (dòng 35) thêm `'/he-thong/xem-nhu': 'xem_nhu'`; sau `loadMe()` nếu `state.me.view_as` → vẽ `#va-bar` (ngoài `#root`, không bị menu theo vai làm ẩn), hẹn giờ tải lại lúc `expires_at`, đếm ngược phút; chế độ Điện thoại: nội dung trang thay bằng `iframe#va-frame` (390×844, giữa màn) nạp cùng địa chỉ + `vaframe=1`; trong iframe (`vaframe=1`) không vẽ `#va-bar` / khung lồng.
- Modify: `docs/js/sb.js:13` `viError` — `/read-only transaction/i` → `Đang xem như người khác — chỉ xem, không lưu được.`
- Modify: `docs/js/sb.js` — **chặn tải ảnh ở web khi đang xem như** (anh Tiến chốt 19/11): khi `state.me.view_as`, `sb.storage.from(...)` trả bản bọc có `upload()` ném đúng chữ trên (đọc / xem ảnh vẫn được). Các chỗ tải ảnh hiện có: `chot_ca_moi.js:549`, `editor.js:124`, `cv_chung.js:165` (và chỗ nào khác `grep "\.upload("` thấy) — không sửa từng chỗ, chỉ bọc ở `sb.js`. Bài thử `flow_xn165` thêm câu: đang xem như, gọi tải ảnh → báo chữ trên, không có yêu cầu tải lên.
- Modify: CSS chung (`docs/css/style.css`, cạnh kiểu `.alert`) — `#va-bar` cố định trên cùng, nền vàng, xuống dòng gọn ở 390px.

**Interfaces:**
- Consumes: `app_me().view_as`, `app_view_as_people`, `app_view_as_start(p_account)`, `app_view_as_stop()` (Task 1); giả lập (Task 2).
- Produces: `#va-bar` có các nút `[data-va=desk]`, `[data-va=phone]`, `[data-va=swap]`, `[data-va=exit]`; chế độ nhớ ở `localStorage.vaMode` (`'desk' | 'phone'`, bọc try/catch).

- [ ] **Step 1: Làm `sb.js` + `xem_nhu.js` + phần `app.js` + CSS** theo trên.
- [ ] **Step 2: Chạy `flow_xn165`** ở `index.html` và `test/phone.html` (role chu và ql) → mong đợi **ĐẠT** mọi câu.
- [ ] **Step 3: Commit** — "Web bước 165: trang Xem như + dải vàng + khung điện thoại".

### Task 4: Dò trang tự ghi khi mở

**Files:**
- Create: `kiem_tra/trinh_duyet/flow_xn164_quet.js` — với `test_viewas` = `nv | ql | qlt | kt | nvkt`: lấy mọi `a[href^="#/"]` trong menu, mở lần lượt, chờ 1,5 giây, ghi lại mục nào hiện `.alert.error` / hộp lỗi hoặc gọi RPC ghi (đọc `window.__LOG`).
- Modify: các trang bị bắt (chưa biết trước) — chỗ gọi RPC ghi **khi mở trang** thì bỏ qua khi `state.me?.view_as` (không gọi), không mở cửa ghi ở máy chủ.

- [ ] **Step 1: Viết + chạy `flow_xn164_quet`** → danh sách trang gọi RPC ghi khi mở (mong đợi: có thể rỗng).
- [ ] **Step 2: Sửa từng trang trong danh sách**; chạy lại → mong đợi danh sách rỗng, không hộp lỗi.
- [ ] **Step 3: Commit** — "Xem như: trang không tự ghi khi đang xem".

### Task 5: Kiểm vùng khoá, phát hành

**Files:**
- Modify: `docs/version.json`, `kiem_tra/trinh_duyet/README.md` (thêm dòng bước 165), `tai_lieu/BAN_GIAO.md` (máy chủ tới 145, xoá dòng "Kế hoạch 1 chờ chạy"), `tai_lieu/TINH_NANG_DA_CHOT.md` (thêm dòng tính năng Xem như).

- [ ] **Step 1: Chạy bài vùng khoá** `flow_ql_tu_ds` (role ql + chu, `index.html` + `test/phone.html`), `flow_stc6` + `flow_stc7` (role chu / qlt / ql) → mong đợi **ĐẠT**.
- [ ] **Step 2: Duyệt mã 1 lần cuối** (superpowers:requesting-code-review, một người duyệt) — sửa điều được chỉ ra.
- [ ] **Step 3: Tăng phiên bản theo lộ trình** + cập nhật README / BAN_GIAO / TINH_NANG_DA_CHOT; commit; **push `main`**.
- [ ] **Step 4: Ghi `app_releases`** dòng ngày chạy: added `["Trang Xem như người khác (chỉ Chủ): chọn một người để thấy đúng màn hình của họ trên máy tính và điện thoại, chỉ xem, tự thoát sau 30 phút"]`.
- [ ] **Step 5: Nhờ anh Tiến thử trên web thật** (sau ~5–7 phút): Hệ thống › Xem như → chọn 1 quản lý → thấy dải vàng, đúng cơ sở; bấm thử 1 nút lưu → báo chỉ xem; bấm Điện thoại; Thoát. Nhắc anh Revoke mã `sbp_` nếu đã cấp mã mới.
