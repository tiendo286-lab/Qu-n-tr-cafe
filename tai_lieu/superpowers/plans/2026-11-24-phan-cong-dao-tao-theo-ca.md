# Phân công đào tạo theo ca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang mới "Phân công đào tạo" (`#/dao-tao/phan-cong`) giao hạng mục đào tạo theo từng ca đi làm của nhân viên mới, chạy song song trang cũ; quản lý giao lại phần của mình cho Cấp 1; người dạy thấy việc của mình trên Việc hôm nay.

**Architecture:** Mở rộng `training_followups` (một mục = một dòng) thêm `work_date`, `work_shift`, `sub_by`; hàm `app_dt_plan_*` / `app_dt_sub_*` / `app_dt_my_plan` gọi lại `app_dt_followup_save` để dùng chung kiểm tra quyền. Giao diện: một trang mới + một khối dùng chung "Việc đào tạo của tôi" + tệp hàm thuần (thử bằng `jsc`).

**Tech Stack:** Postgres (Supabase, plpgsql SECURITY DEFINER), JS thuần ES modules, mẫu `html` của `docs/js/ui.js`, Playwright + Supabase giả lập (`kiem_tra/trinh_duyet`), Postgres cục bộ (`kiem_tra/may_chu_cuc_bo`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-24-phan-cong-dao-tao-theo-ca-design.md`

## Global Constraints

- Kho công khai: không tên nhân viên thật trong mã / bài thử / tài liệu commit (dùng "PTC", "quản lý A", "Cấp 1 B").
- Tệp SQL `supabase/174_phan_cong_dao_tao_theo_ca.sql`: chạy lại nhiều lần không lỗi; dòng cuối `insert into public.app_migrations(file) values ('174_phan_cong_dao_tao_theo_ca.sql') on conflict (file) do nothing;`.
- Bảng / cột mới không cấp quyền `anon` / `authenticated`; web chỉ gọi `app_*`.
- Không dùng `x IN (a, NULL)` / `= NULL` trong kiểm tra quyền; dùng `coalesce`.
- Không đụng vùng khoá tiền, `app_can`, `role_permissions`, trang Đào tạo cũ (`cv_dao_tao.js`), phiếu (`phieu_dao_tao.js`).
- Chữ trên giao diện: tiếng Việt, không tràn ngang ở 390px.
- Commit theo tên / thư điện tử ghi trong `CLAUDE.md`, cuối thông điệp `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` từng tệp (không `-A`).

## Review Focus

1. Trang cũ giao đè một mục đã xếp ca → mục phải rời ca (ngày / ca / giao lại bởi xoá), trang mới hiện "đã giao, chưa xếp ca" — thử ở Task 1 (2c).
2. Nhân viên mới chưa có lịch công bố → thẻ vẫn hiện, ghi "Chưa có lịch đã công bố", không lỗi — thử ở Task 3 (`workDays` rỗng) và Task 4 (phiếu 2 không lịch).
3. Hai lần giao một mục cho hai ca → một mục chỉ ở một ca (dòng duy nhất, khoá `for update` của `app_dt_followup_save`) — thử ở Task 1 (2b).
4. Quản lý tự gọi hàm giao lại cho mục không phải của mình / người nhận không phải Cấp 1 / không phải quản lý → bị chặn rõ lời — thử ở Task 1 (5c–5e).
5. Mục đã chấm (đạt hoặc chờ kiểm tra) không bị chuyển / bỏ giao / lấy lại — thử ở Task 1 (2d, 6b).

---

### Task 1: Máy chủ — tệp 174 + bài thử cục bộ

**Files:**
- Create: `supabase/174_phan_cong_dao_tao_theo_ca.sql`
- Create: `kiem_tra/phan_cong_dao_tao_174_cuc_bo.sql`

**Interfaces:**
- Produces (dùng ở Task 2–6, hình dạng JSON phải đúng y):
  - `app_dt_plan_board() → jsonb` `{can_board bool, today 'YYYY-MM-DD', trainers:[{id, name:'MÃ – Tên', rank, branches:['LHP']}], rows:[{id, employee_id, employee, program, start_date, due, branch, instructor_id, instructor, achieved, total, can_check bool, shifts:[{date, branch_id, branch, shift, mates:[employee_id]}], items:[{no, day, title, state:'chua'|'gioi_thieu'|'cho_kt'|'dat', level, who_id, date, shift, branch_id, sub_by, pending_by, pending_at}]}]}`. `who_id` = `training_followups.employee_id` (null = HDC mặc định). `can_board=false, rows=[]` khi không phải Chủ / PTC / HDC của phiếu đang mở nào.
  - `app_dt_plan_assign(p_id bigint, p_date date, p_shift text, p_branch bigint, p_employee bigint, p_items int[]) → jsonb {n int, moved int, skipped int}`
  - `app_dt_plan_unassign(p_id bigint, p_date date, p_shift text, p_employee bigint) → int`
  - `app_dt_sub_assign(p_id bigint, p_date date, p_shift text, p_employee bigint, p_items int[]) → jsonb {n int}`
  - `app_dt_sub_take(p_id bigint, p_date date, p_shift text, p_employee bigint) → int`
  - `app_dt_my_plan() → jsonb` `{today, me_id, me_rank, cap1:[{id, name, branches}], shifts:[{training_id, trainee, date, branch, shift, day_no, mates:[employee_id], own:[{no,title,state,level}], subs:[{who_id, who, items:[{no,title,state,level}]}], by:'MÃ – Tên'|null}], checks:[{training_id, trainee, no, title, level, who, at}]}` — `shifts` = ca có `work_date >= today - 1` mà tôi là `employee_id` hoặc `sub_by`; `by` = người giao lại cho tôi; `checks` = mục `cho_kiem_tra` có `sub_by = tôi`.

- [ ] **Step 1: Dựng Postgres cục bộ** — `/usr/bin/python3 -m venv <scratchpad>/pgv && <pgv>/bin/pip install pgserver psycopg2-binary`; `PG_DIR=<scratchpad>/pg <pgv>/bin/python kiem_tra/may_chu_cuc_bo/dung_csdl.py supabase --fresh` rồi `chay.py kiem_tra/may_chu_cuc_bo/seed.sql`. Ghi lại số tệp lỗi (so với `main`).

- [ ] **Step 2: Viết bài thử `kiem_tra/phan_cong_dao_tao_174_cuc_bo.sql`** (khối `DO … RAISE EXCEPTION 'REPORT>> %'`, đăng nhập bằng `set_config('request.jwt.claims', …)` như `lich_su_dao_tao_163_cuc_bo.sql`). Dữ liệu: PTC = tài khoản Quản lý tổng (`training_review_config`), HDC = Quản lý 1, quản lý A = Quản lý 2, Cấp 1 B, NV thử việc; phiếu bắt đầu hôm qua; `weeks` + `schedule_published`: NV mới hôm qua Sáng, hôm nay Chiều, mai Sáng, ngày kia Tối; Cấp 1 B mai Sáng cùng cơ sở. Dòng thử:
  - (1a) PTC `app_dt_plan_board()` → `can_board`, có phiếu, 4 ca, ca mai có `mates` chứa Cấp 1 B; (1b) Cấp 1 B gọi → `can_board=false`.
  - (2a) PTC giao mục 1–8 cho quản lý A ca mai Sáng → 8 dòng có `work_date`=mai, `work_shift`='Sáng', `sub_by` null; quản lý A nhận đúng 1 thông báo. (2b) PTC giao mục 3–4 cho HDC ca ngày kia Tối → `moved`=2, mục 3–4 rời ca mai. (2c) gọi thẳng `app_dt_followup_save` (trang cũ) đổi mục 1 sang Cấp 1 B → `work_date` mục 1 null. (2d) HDC ghi mức mục 2 rồi PTC giao lại mục 2 → `skipped`=1, không đổi. (2e) ca không có trong lịch → lỗi chứa "lịch đã công bố"; hôm qua → lỗi chứa "Ngày đã qua". (2f) PTC giao lại phần quản lý A ca mai chỉ mục 5–8 → mục bỏ tích (không còn) về `employee_id` null, `work_date` null.
  - (3) `app_dt_plan_unassign` phần HDC ca ngày kia → trả 2, mục 3–4 hết ngày.
  - (4) chạy tệp 174 lần 2 → không lỗi, dữ liệu giữ nguyên.
  - (5a) quản lý A `app_dt_sub_assign(…, Cấp1B, [5,6])` → mục 5–6 `employee_id`=Cấp 1 B, `sub_by`=quản lý A; Cấp 1 B nhận 1 thông báo. (5b) gọi lại `[6,7]` → mục 5 về quản lý A, 7 sang Cấp 1 B. (5c) mục 9 (PTC giao HDC ca mai) → lỗi "Chỉ giao lại được mục của bạn". (5d) người nhận là Quản lý → lỗi chứa "Cấp 1". (5e) Cấp 1 B tự gọi → lỗi chứa "quản lý".
  - (6a) Cấp 1 B ghi mức mục 6 (`app_dt_mark`) → chờ kiểm tra, quản lý A nhận thông báo "chờ kiểm tra"; `app_dt_my_plan()` của quản lý A có `checks` mục 6. (6b) `app_dt_sub_take` → chỉ mục 7 về quản lý A (mục 6 giữ). (6c) quản lý A `app_dt_check_ok(…, 6, null)` → đạt; HDC khác người giao lại vẫn được (quyền cũ); Cấp 1 B gọi → lỗi.
  - (7) `app_dt_my_plan()` của Cấp 1 B (sau khi giao lại mục 8 cho B): 1 ca, `by` = tên quản lý A, `day_no` = 3.
  - (8) `has_table_privilege('authenticated', 'public.training_followups', 'select')` = false.

- [ ] **Step 3: Chạy bài thử, thấy hỏng** — `PG_DIR=… sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/phan_cong_dao_tao_174_cuc_bo.sql`. Kỳ vọng: lỗi "function … app_dt_plan_board() does not exist".

- [ ] **Step 4: Viết `supabase/174_phan_cong_dao_tao_theo_ca.sql`**
  - `alter table training_followups add column if not exists work_date date`, `work_shift text`, `sub_by bigint references employees(id) on delete set null`; chỉ mục `(training_id, work_date, work_shift)`.
  - Trigger `app__dt_followup_plan_clear` BEFORE UPDATE: `new.employee_id is distinct from old.employee_id and coalesce(current_setting('app.dt_plan', true), '') <> '1'` → xoá `work_date`, `work_shift`, `sub_by`.
  - `app_dt_plan_assign`: `app__need(null)`; `app__dt_can_assign(a, t)`; ngày `>= vn_now()::date` ("Ngày đã qua không phân công lại được."); ca phải có trong `schedule_published` của NV mới ("Ca này không có trong lịch đã công bố của nhân viên."); `set_config('app.dt_bulk','1',true)` + `set_config('app.dt_plan','1',true)`; mục đạt hoặc chờ kiểm tra → `skipped`; còn lại gọi `app_dt_followup_save(p_id, no, p_employee, null, false, p_branch)` rồi update `work_date/work_shift`, `sub_by=null` (đếm `moved` khi trước đó có ngày/ca khác); mục của `p_employee` ở ca này không có trong `p_items` và chưa có mức → `app_dt_followup_save(p_id, no, null, null, false, null)` + xoá ngày. Một thông báo gộp cho `p_employee` (khác người gọi): "Bạn được giao đào tạo ca <ca> <dd/mm>", link `/dao-tao/phan-cong`. Trả hai cờ về '' cuối hàm. `app_log('dao_tao_phan_cong_ca', …)`.
  - `app_dt_plan_unassign`: như trên, chỉ phần trả về.
  - `app_dt_sub_assign` / `app_dt_sub_take`: người gọi có `employees.rank = 'Quản lý'` ("Chỉ quản lý được giao lại cho Cấp 1."), đang giữ phần ở ca đó; người nhận rank 'Cấp 1', tài khoản không khoá, đang làm, khác NV mới ("Chỉ giao lại cho nhân viên Cấp 1 có tài khoản."); mục thuộc `(employee_id = tôi and sub_by is null) or sub_by = tôi`, chưa có mức ("Chỉ giao lại được mục của bạn, chưa chấm."); update trực tiếp với cờ `app.dt_plan`; phiếu chưa hoàn thành; ngày `>= hôm nay`. Một thông báo cho Cấp 1.
  - `app_dt_check_ok`: chép bản tệp 148, điều kiện quyền thành `public.app__dt_can_check(a, t) or exists (select 1 from training_followups f where f.training_id = t.id and f.item_no = p_no and f.sub_by = a.employee_id)`; lời lỗi thêm "hoặc quản lý đã giao lại mục này".
  - Trigger AFTER INSERT OR UPDATE trên `training_marks` `app__dt_sub_notify`: khi `new.cho_kiem_tra and not coalesce(old.cho_kiem_tra, false)` và followup có `sub_by` → `app__dt_notify_once(<tài khoản của sub_by>, 'Hạng mục đào tạo chờ kiểm tra', 'Cấp 1 bạn giao lại đã ghi mức đạt — bấm Xác nhận đạt.', '/dao-tao/phan-cong')`.
  - `app_dt_plan_board` (quyền và danh sách phiếu như `app_dt_assign_board` tệp 149, mọi chương trình) và `app_dt_my_plan` theo Interfaces. `day_no` = số ngày phân biệt trong lịch công bố của NV mới từ `start_date` tới ngày đó.
  - Mọi hàm mới: revoke / grant theo mẫu tệp 149.

- [ ] **Step 5: Chạy tệp 174 hai lần, chạy bài thử** — Kỳ vọng `KẾT QUẢ: ĐẠT <n> dòng, 0 hỏng`. Chạy lại `kiem_tra/dao_tao_tab_phan_cong_149.sql`, `dao_tao_phan_cong_148.sql`, `lich_su_dao_tao_163_cuc_bo.sql`: kết quả như trước khi có 174.

- [ ] **Step 6: Commit** — hai tệp; "Phân công đào tạo theo ca — máy chủ tệp 174 + bài thử cục bộ".

### Task 2: Giả lập trình duyệt cho các hàm mới

**Files:**
- Modify: `kiem_tra/trinh_duyet/dt_gia.js`
- Modify: `kiem_tra/trinh_duyet/chuan_bi.sh` (chép `flow_pcdt.js`; thêm `flow_pcdt` vào danh sách `workflow` trong `dt_gia.js`)

**Interfaces:**
- Consumes: hình dạng JSON Task 1.
- Produces: 6 hàm giả cùng tên Task 1; `app_dt_check_ok` giả cho phép `sub_by`; mục `extras` thêm `date`, `shift`, `sub_by`; `app_dt_assign_bulk` giả xoá `date/shift/sub_by` khi đổi người. `window.__DT_PLAN` = mảng `{fn, ...tham số}` mỗi lần gọi `app_dt_plan_assign` / `app_dt_sub_assign`.
- Lịch giả khi `script=flow_pcdt` (`today` = hôm nay giả lập): NV03 hôm kia Sáng TEST, hôm qua Sáng, hôm nay Chiều, mai Sáng, ngày kia Tối; NV07 (Cấp 1) hôm nay Chiều + mai Sáng; NV08 (Quản lý) mai Sáng. Phiếu 1 bắt đầu hôm kia; có sẵn mục 3–4 của NV05 ca hôm qua (mục 3 đã đạt, mục 4 đã giới thiệu), mục 10–12 giao NV08 ca mai, mục 13 NV07 do NV08 giao lại ca mai, đã chờ kiểm tra. Phiếu 2: NV mới id 4 'NV04 – Người học thứ hai', không có lịch.

- [ ] **Step 1:** Viết các hàm giả theo đúng kiểm tra quyền Task 1. Kiểm cú pháp bằng `jsc` (`checkSyntax`) — không lỗi.
- [ ] **Step 2: Commit** — "Phân công đào tạo theo ca — giả lập trình duyệt".

### Task 3: Hàm thuần của trang + bài thử jsc

**Files:**
- Create: `docs/js/pages/pc_dao_tao_tinh.js`
- Create: `kiem_tra/pc_dao_tao_tinh_174.mjs`

**Interfaces:**
- Consumes: `row` / `item` / `shift` của `app_dt_plan_board`.
- Produces:
  - `workDays(row) → string[]` ngày phân biệt đã sắp của `row.shifts`
  - `dayNo(row, date) → number|null`
  - `groupsOf(row, sh) → [{who_id, sub_by, items:item[]}]` (mục có `date===sh.date && shift===sh.shift`; `who_id` null thay bằng `row.instructor_id`), sắp theo mục nhỏ nhất
  - `shiftState(row, sh, today) → 'trong'|'chua'|'giao'|'ok'|'tre'` (không nhóm: ngày < hôm nay → 'trong', còn lại 'chua'; mọi mục 'dat'/'cho_kt' → 'ok'; ngày < hôm nay còn mục chưa chấm → 'tre'; còn lại 'giao')
  - `itemWhere(row, no) → {date, shift, who_id}|null`
  - `span(nos) → string` ("1–4, 7")
  - `shortfall(row, days) → number` (số ngày làm tới `row.due` thiếu so với `days`, ≥ 0)
  - `workOf(rows, whoId, date) → [{row, sh, items}]`
  - `cards(rows, today) → {n, tre, kt}`

- [ ] **Step 1: Viết bài thử** (import đường tuyệt đối như `doi_soat_moi_tinh_dot1.mjs`, in `ĐẠT`/`HỎNG` mỗi dòng): lịch 19, 20, 21, 23, 24/11 + 2 ca ngày 24 → `workDays` 5 ngày, `dayNo(row,'2026-11-24')===5`, `dayNo(row,'2026-11-22')===null`, `workDays({shifts:[]})` rỗng; `span([1,2,3,4,7])==='1–4, 7'`; `groupsOf` ca có mục `who_id` null + HDC 5 → 1 nhóm `who_id` 5; `shiftState` ca qua còn mục 'chua' → 'tre', ca không nhóm hôm qua → 'trong'; `shortfall` hạn có 6 ngày làm, `days`=8 → 2; `workOf(rows, 7, '2026-11-24')` đúng số ca + mục; `itemWhere` mục không ngày → null.
- [ ] **Step 2:** `jsc -m kiem_tra/pc_dao_tao_tinh_174.mjs` → hỏng (chưa có tệp).
- [ ] **Step 3:** Viết `docs/js/pages/pc_dao_tao_tinh.js` (không import).
- [ ] **Step 4:** Chạy lại → mọi dòng ĐẠT.
- [ ] **Step 5: Commit** — "Phân công đào tạo theo ca — hàm thuần + bài thử jsc".

### Task 4: Trang Phân công đào tạo

**Files:**
- Create: `docs/js/pages/pc_dao_tao.js` (`export const perm = null; export async function render({ me, can }) → {title, html, mount(root)}` theo mẫu `hom_nay.js`)
- Modify: `docs/js/app.js` — HUBS 'Công việc' thêm `['Phân công đào tạo', '/dao-tao/phan-cong', null]` ngay sau 'Đào tạo'; PAGES `'/dao-tao/phan-cong': 'pc_dao_tao'`
- Modify: `docs/assets/style.css` — lớp `.pcd-*` (theo trang mẫu)
- Create: `kiem_tra/trinh_duyet/flow_pcdt.js`

**Interfaces:**
- Consumes: Task 1 `app_dt_plan_board`, `app_dt_plan_assign`, `app_dt_plan_unassign`, `app_dt_check_ok`, `app_dt_get`, `app_dt_history`; Task 3 hàm thuần; Task 5 `myPlanHtml` / `mountMyPlan` (khi `can_board=false` trang hiện khối của tôi).
- Hành vi theo trang mẫu: ô tổng; ô lọc (`#pcd-who`, `#pcd-d` → danh sách ca + mục người đó dạy); thẻ `details.pcd-card[data-id]` mỗi NV mới (Đạt x/total, hạn, cảnh báo "Lịch tới hạn mới có N ngày làm, thiếu M ngày", khối Chờ kiểm tra trong thẻ: ô mức + `[data-ktok]` gọi `app_dt_check_ok` — chỉ khi `can_check`; danh sách ca `.pcd-sh[data-key]` có "Ngày N", trạng thái, nhóm "Tên · mục 1–4", "C (A giao lại)"); không lịch → "Chưa có lịch đã công bố". Bấm ca → bảng dưới: ca hôm nay có 2 nút Chi tiết ngày / Phân công; ca qua chỉ Chi tiết ngày; ca tới chỉ Phân công. Phân công: nút người cùng ca (`mates` ∩ `trainers`), ô "Hoặc chọn người khác" (Quản lý / Cấp 1 cơ sở này / Cấp 1 cơ sở khác), "Đã giao trong ca này" với Sửa / Bỏ (`app_dt_plan_unassign`), mục chưa đạt nhóm "Giáo trình ngày d" + "chọn cả ngày", mục đã giao ca khác có nhãn "Đã giao T5 26/11 · Tên", mục chờ kiểm tra khoá 🔒, `#pcd-go` "Phân công" → `app_dt_plan_assign` một lần. Chi tiết ngày: `app_dt_get` + `app_dt_history`, các mục của ca với dòng lịch sử ngày đó (giờ, việc, người) + "Hiện tại", nhận xét ngày + 2 xác nhận từ `history.notes` ngày đó.

- [ ] **Step 1: Viết `flow_pcdt.js`** (mẫu `flow_dt170.js`). Vai `chu` và `kt&dtptc=7`: menu có "Phân công đào tạo"; thẻ phiếu 1 có 5 ca, ca hôm nay ghi "Ngày 3"; thẻ phiếu 2 ghi "Chưa có lịch đã công bố"; Chờ kiểm tra trong thẻ có mục 13 ghi "giao lại"; bấm ca mai → nút người cùng ca có NV07 + NV08; mục 10 có nhãn đã giao; mục 13 khoá; chọn NV07, tích 20–22, Phân công → `__DT_PLAN.length===1`, đúng `p_items` / `p_employee` / `p_date`; tích mục 11 cho NV07 → nhóm NV08 còn 10, 12; ca hôm qua → Chi tiết ngày có "Đã giới thiệu" + "Hiện tại"; lọc NV08 + mai → 1 ca, 2 mục; vai `kt&dtptc=7` Xác nhận đạt mục 13 → Đạt +1; vai `chu` không có nút Xác nhận; không tràn ngang. Vai `ql` (HDC phiếu 1): thấy trang, chỉ phiếu 1. Vai `ql2` / `c1`: không có ô tổng, thấy "Việc đào tạo của tôi".
- [ ] **Step 2:** `chuan_bi.sh <tạm> --dao-tao-gia`; `chay_pw.py <tạm> "role=chu&script=flow_pcdt"` → hỏng.
- [ ] **Step 3:** Viết trang + app.js + style.css.
- [ ] **Step 4:** Chạy `flow_pcdt` với `role=chu`, `role=kt&dtptc=7`, `role=ql`, mỗi vai máy tính + `--phone` → ĐẠT.
- [ ] **Step 5: Commit** — "Phân công đào tạo theo ca — trang mới (chạy song song trang cũ)".

### Task 5: Khối "Việc đào tạo của tôi" + Việc hôm nay

**Files:**
- Create: `docs/js/pages/pc_dao_tao_toi.js` — `export function myPlanHtml(plan) → html`, `export function mountMyPlan(root, reload) → () => void`
- Modify: `docs/js/pages/hom_nay.js` — `soft(rpc('app_dt_my_plan'))` trong `Promise.all`; `${myPlanHtml(plan)}` đầu cột trái (chỉ khi có `shifts` hoặc `checks`); `mount` gọi `mountMyPlan(root, rerender)` và gỡ khi rời trang
- Modify: `kiem_tra/trinh_duyet/flow_pcdt.js`

**Interfaces:**
- Consumes: `app_dt_my_plan`, `app_dt_sub_assign`, `app_dt_sub_take`, `app_dt_check_ok`.
- Hành vi: `section#pcd-mine`; khung "⏳ Chờ bạn kiểm tra · N mục" (ô mức + Xác nhận đạt); mỗi ca một thẻ: "T5 26/11 · ĐK Tối · dạy <NV> · Ngày N", "Bạn dạy mục …", "→ B (Cấp 1) dạy mục …" + `[data-take]` Lấy lại (khi phần đó chưa có mục nào chấm), `[data-sub]` "Giao lại cho Cấp 1" chỉ khi `me_rank==='Quản lý'` và ca chưa qua; Cấp 1 được giao lại thấy "(<A> giao lại)". Hộp Giao lại: nút Cấp 1 làm cùng ca (`mates` ∩ `cap1`), ô chọn Cấp 1 khác, chỉ mục chưa chấm của phần tôi, "Mục bỏ tích sẽ quay về bạn dạy", nút "Giao lại cho <B>" gọi `app_dt_sub_assign` một lần.

- [ ] **Step 1: Thêm vào `flow_pcdt.js`**: vai `ql2` mở `#/hom-nay` → có `#pcd-mine`, ca mai "Bạn dạy" mục 10–12, nút Giao lại; mở hộp, nút NV07 có sẵn, tích 10 + 11, lưu → `__DT_PLAN` có lần `app_dt_sub_assign` đúng; thẻ hiện "NV07 … (Cấp 1) dạy" + Lấy lại; Lấy lại → mục về; Chờ bạn kiểm tra có mục 13, Xác nhận đạt chạy. Vai `c1` `#/hom-nay` → thấy ca mai "(… giao lại)", không có nút Giao lại. Vai `nv` → không có `#pcd-mine`. Không tràn ngang 390px.
- [ ] **Step 2:** Chạy → hỏng phần mới.
- [ ] **Step 3:** Viết `pc_dao_tao_toi.js` + sửa `hom_nay.js`.
- [ ] **Step 4:** Chạy `flow_pcdt` mọi vai (máy tính + `--phone`) + `flow_hn142` (`role=ql`, `role=nv`) + `flow_dt170` (`role=chu`) + `flow_dt_c4` (`role=chu`) → ĐẠT (trang cũ không đổi).
- [ ] **Step 5: Commit** — "Phân công đào tạo theo ca — Việc đào tạo của tôi trên Việc hôm nay".

### Task 6: Tài liệu, chạy máy chủ thật, lên web

**Files:**
- Modify: `kiem_tra/trinh_duyet/README.md` (cách chạy `flow_pcdt`, `pc_dao_tao_tinh_174.mjs`, bài thử 174)
- Modify: `tai_lieu/TINH_NANG_DA_CHOT.md` mục "Công việc đào tạo" (phân công theo ca, giao lại cho Cấp 1, xác nhận của quản lý giao lại, trang cũ giao đè xoá ca)
- Modify: `tai_lieu/BAN_GIAO.md` (mục mới đầu tệp)
- Modify: `docs/version.json`

- [ ] **Step 1:** Rà toàn nhánh (một người duyệt mới, superpowers:requesting-code-review); sửa điều đáng sửa, chạy lại bài thử liên quan.
- [ ] **Step 2: Chạy thử máy chủ thật (tự hoàn tác)** — Management API qua curl (mã ở `~/.milano_sbp`): tệp 174 ×2 + khối `DO $$ … RAISE EXCEPTION 'REPORT>> %' $$` đọc `app_dt_plan_board()` dưới tài khoản PTC thật (đếm phiếu, ca, mục). Kỳ vọng chỉ lỗi `REPORT>>` với số hợp lý; sau đó cột `work_date` chưa tồn tại (đã hoàn tác). Không chạy giờ cao điểm.
- [ ] **Step 3: Chạy thật tệp 174**; `select file from app_migrations where file like '174%'` có 1 dòng.
- [ ] **Step 4:** `git fetch`, gộp `origin/main` mới nhất, tăng `docs/version.json`, chạy lại `flow_pcdt` role chu; đẩy lên `main`; đợi `version.json` trên web đổi.
- [ ] **Step 5:** Ghi / gộp dòng `app_releases` bản trong ngày (added: "Trang Phân công đào tạo mới: giao theo ca đi làm, nhiều người dạy một ca, quản lý giao lại cho Cấp 1, việc đào tạo của tôi trên Việc hôm nay"; changed: "Quản lý giao lại cho Cấp 1 được xác nhận đạt mục đó").
- [ ] **Step 6: Commit** tài liệu + bàn giao.
