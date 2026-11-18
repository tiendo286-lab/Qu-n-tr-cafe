# Việc hôm nay chia nhóm — Kế hoạch làm (bước 142)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang Việc hôm nay chia việc theo nhóm Vận hành / Nhân sự / Khác, thu gọn / mở rộng được. Việc cùng loại gộp thành một dòng, mỗi dòng có tên người làm. Có mục "Đã xong hôm nay". Chủ có tab Mọi người, Quản lý thấy các hạng mục đào tạo đã giao cho người hướng dẫn.

**Architecture:**
- Một hàm máy chủ mới `app_today_more()` (tệp 124) trả: việc mình đã báo xong đang chờ kiểm tra, việc xong hôm nay, hạng mục đào tạo đã giao (Quản lý phụ trách).
- Phần gom / xếp loại là hàm thuần, thử bằng `jsc`:
  - `collectWork` ở `hom_nay_viec.js` gắn thêm nhóm, nhãn, loại gộp, người làm;
  - tệp mới `hom_nay_nhom.js` chia khối, gộp, lọc vai trò, lấy danh sách Đã xong.
- `hom_nay.js` chỉ vẽ trang và gắn sự kiện.
- Chủ hỏi thêm `app_pc_all()` (đã có), hỏi cùng lúc với các câu khác.

**Tech Stack:** JavaScript thuần (ES modules, mẫu `html\`\`` trong `docs/js/ui.js`), Supabase plpgsql, `jsc` cho bài thử hàm thuần, Chrome headless + `kiem_tra/trinh_duyet/` cho giao diện.

**Spec:** `tai_lieu/superpowers/specs/2026-11-18-viec-hom-nay-chia-nhom-design.md` (đọc mục 4, 5.1–5.8). Bản thử: `work/proposals/viec-hom-nay-chia-nhom-thu.html`.

## Global Constraints

- Trả lời / chữ trên giao diện: tiếng Việt đơn giản. Tên nhóm đúng chữ: **Vận hành**, **Nhân sự**, **Khác**, **Đã xong hôm nay**. Nút lọc của Chủ: **Tất cả · Quản lý tổng · Quản lý · Kế toán · Việc khác**.
- Giao việc riêng gõ tay → Khác (**cách A**, không thêm ô nhóm). `gv.handover = true` → Vận hành, nhãn "Bàn giao ca".
- Khoá việc chưa có trong bảng luật → **Khác**, không bao giờ bị mất.
- Đầu nhóm và dòng gộp luôn hiện số `gấp / quá hạn / hôm nay / cần kiểm tra / làm lại`, kể cả khi đang thu gọn.
- Không đổi tab Công việc. Không đổi `app_pc_mine`, `app_gv_*`.
- Máy chủ: tệp mới có số thứ tự (dự kiến `124_…`; kiểm `select max(file) from app_migrations` trước). Viết để chạy lại được, hàm `app_*` SECURITY DEFINER, `revoke … from public, anon` + `grant … to authenticated`. Dòng cuối là `insert into public.app_migrations(file) values ('124_viec_hom_nay_nhom.sql') on conflict (file) do nothing;`. Chạy thử trong khối `DO $$ … RAISE EXCEPTION 'REPORT>> %' … $$` trước khi chạy thật.
- Không dùng `x IN (a, NULL)` / `= NULL` trong điều kiện quyền; dùng `coalesce`.
- `localStorage` đọc / ghi bọc `try/catch`; khoá theo tài khoản: `hn-open:<me.id>`.
- Không tràn ngang ở khung 390px.
- Web mới: `2026.11.18.11` (`docs/version.json`, `ASSET_VERSION` trong `docs/js/app.js`, `?v=` trong `docs/index.html` và các dòng import có `?v=`). Ghi `app_releases` dòng `2026.11.18`. Commit tên `Tien Do <tiendo286@gmail.com>`, cuối có `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không đưa lên GitHub mã `sbp_`, khoá, dữ liệu thật, tên nhân viên thật (bài thử chỉ dùng tên giả).

## Review Focus

1. **Một nguồn lỗi** (vd `app_today_more` hoặc `app_pc_all` báo lỗi): các nhóm khác vẫn hiện. Mục Đã xong / tab Mọi người báo "Chưa tải được…", không làm hỏng cả khối. → Task 2 (`collectWork` với `more: null`), Task 4 (bài Chrome `hnfail=more`).
2. **Việc vừa là của mình vừa có người khác** (Đối soát ca giao 2 người): nhãn người làm có mình (xanh), ghi "Bạn + Quản lý tổng D (ai làm trước cũng được)". → Task 2.
3. **localStorage bị chặn** (cửa sổ ẩn danh): trang vẫn vẽ đúng mặc định (nhóm có việc mở, Đã xong thu gọn, dòng gộp thu gọn). → Task 4 (bài Chrome ghi đè `localStorage.getItem` ném lỗi).
4. **Gộp chỉ 1 việc cùng loại**: không thành dòng gộp, hiện như dòng thường. **Bàn giao ca chờ phân loại** cũng vào Vận hành. → Task 3.
5. **Chủ: việc chỉ có Chủ làm** không xuất hiện ở Mọi người. Việc **chưa có người nhận** vào "Việc khác". → Task 3.

---

### Task 1: Máy chủ `app_today_more()` (tệp 124)

**Files:**
- Create: `supabase/124_viec_hom_nay_nhom.sql`
- Test: `kiem_tra/viec_hom_nay_nhom_124.sql` (khối `DO` tự hoàn tác, dùng tên giả `ZZT124…`)

**Interfaces:**
- Produces: `public.app_today_more() returns jsonb` =
  ```
  { today: 'YYYY-MM-DD',
    review_wait: [app__gv_json(k.id) …],              -- tasks: cv_kind null, cancelled_at null, status='cho_duyet', assignee_id = a.id, coalesce(reviewer_id, giver_id, created_by) <> a.id
    done_today: [{ kind:'pc', id, job, title, code, at, who } |   -- pc_tasks: left(done_at,10)=today, a.id thuộc accounts của một bước bất kỳ; who = app__acc_name(done_by)
                 { kind:'gv', id, title, code, handover, at, by, who }],  -- tasks: status='hoan_thanh', cv_kind null, left(approved_at,10)=today, assignee_id = a.id hoặc approved_by = a.id; title=content; by=app__acc_name(approved_by); who=app__acc_name(assignee_id); at = done_at / approved_at
    followups: [{ training_id, employee:'MÃ – Tên', item_no, item: training_items.title, stage, level, is_extra, instructor: employees.name, due: (start_date::date+12)::text }] }
  ```
  `stage` ∈ `'chua_gioi_thieu' | 'da_gioi_thieu' | 'da_thuc_hanh' | 'giai_doan_2'` (từ `training_marks.introduced / practiced` và `f.is_extra`).
  Followups lấy từ: `trainings.manager_id = a.id`, `employees.status = 'Đang làm'`, `app__dt_status(t) <> 'hoan_thanh'`, `training_followups.employee_id is not null`, `finished_at is null`, `(f.is_extra or m.level is null)`; xếp theo `due, training_id, item_no`. `today` = `public.vn_now()::date`.

- [ ] **Step 1:** Viết bài thử `kiem_tra/viec_hom_nay_nhom_124.sql`. Mẫu khối giả lập đăng nhập: `kiem_tra/cong_viec_dao_tao_120_may_chu.sql`. Bài thử dựng: 1 việc giao riêng `cho_duyet` (người làm = tài khoản thử A, người kiểm tra = B); 1 việc `hoan_thanh` duyệt hôm nay; 1 việc `hoan_thanh` duyệt hôm qua; 1 phiếu đào tạo (manager = A) có 2 followups (1 xong, 1 chưa). Đăng nhập A, gọi `app_today_more()`. Kiểm:
  - `review_wait` có đúng 1 phần tử;
  - `done_today` có việc hôm nay, không có việc hôm qua;
  - `followups` có 1 dòng, `stage` đúng;
  - đăng nhập B thì `followups` rỗng và `review_wait` rỗng.

  In `RAISE EXCEPTION 'REPORT>> PASS …'`.
- [ ] **Step 2:** Chạy bài thử một mình (chưa có hàm). Kết quả mong đợi: lỗi `function app_today_more() does not exist`.
- [ ] **Step 3:** Viết `supabase/124_viec_hom_nay_nhom.sql` theo Interfaces. Gán `jsonb_agg` qua `offset 0` / CTE `materialized` nếu gọi `app__gv_json` (bài học tốc độ trong `BAN_GIAO.md`).
- [ ] **Step 4:** Ghép tệp 124 + bài thử, gửi một lần qua Management API. Kết quả mong đợi: `REPORT>> PASS` (tự hoàn tác). Sau đó chạy thật tệp 124. Kiểm `select file from app_migrations where file like '124%'` có 1 dòng.
- [ ] **Step 5:** Commit `Bước 142 (1/4): máy chủ 124 app_today_more — chờ kiểm tra, xong hôm nay, đào tạo đã giao (đã chạy)`.

### Task 2: `collectWork` gắn nhóm, nhãn, loại gộp, người làm, trạng thái kiểm tra

**Files:**
- Modify: `docs/js/hom_nay_viec.js`
- Test: `kiem_tra/hom_nay_viec_138.mjs` (giữ mọi kiểm tra cũ, thêm phần bước 142)

**Interfaces:**
- Consumes: `app_today_more()` (Task 1) qua tham số mới `more`.
- Produces: `collectWork({ now, pc, training, ka, todo, today, more }, helpers)`. Mỗi `item` có thêm:
  - `cat: 'vh'|'ns'|'kh'`;
  - `tag: string` (Chốt ca / Ngân hàng / Tiền / Hàng hoá / Bàn giao ca / Giao việc riêng / Đào tạo / Nội quy / Cam kết / Nghỉ & làm thay / tên việc tự thêm / '');
  - `kind: string|null` (khoá gộp: `'pc:<job>'`, `'dt'`, `'dtf'`, `'ka'`, `'bgc'`, `'nqf'`; null = không gộp);
  - `kindLabel: string`;
  - `who: { text: string, mine: boolean, none: boolean }`;
  - `gap: boolean` (`priority === 'gap'`);
  - `review: boolean` (gv `cho_duyet`, `reviewer_id === pc.me`);
  - `redo: string|null` (gv `dang_xu_ly` có `review_note`);
  - `failedMore: boolean` trên kết quả (`more == null`).

  `helpers` thêm `curStep(t)` (đã có trong `cv_chung.js`). Xuất thêm `export const CAT_OF_JOB` và `export function catOf(key, extra)`, để bài thử và Task 3 dùng chung bảng luật ở mục 4 bản thiết kế.

- [ ] **Step 1: Viết bài thử (nối vào cuối `kiem_tra/hom_nay_viec_138.mjs`, trước `print`)**
  ```js
  // bước 142: nhóm / nhãn / gộp / người làm / kiểm tra
  const H2 = { ...helpers, curStep: (t) => t.steps?.find((s) => !s.done_at) };
  const pc2 = { me: 7, tasks: [
      { id: 21, job: 1, code: 'LHP', due_at: '2026-11-18 20:00:00', steps: [{ accounts: [7, 6], names: ['Bạn A', 'QL tổng D'] }] },
      { id: 22, job: 4, code: 'ĐK', due_at: '2026-11-19 10:00:00', steps: [{ accounts: [7], names: ['Bạn A'] }] },
      { id: 23, job: 101, code: 'HS', steps: [{ accounts: [7], names: ['Bạn A'] }] }],
    gv: [{ id: 31, content: 'Máy xay kêu', handover: true, status: 'chua_phan_cong', classifiers: [{ id: 7, name: 'Bạn A' }] },
         { id: 32, content: 'Mua ống hút', handover: false, status: 'dang_xu_ly', assignee_id: 7, assignee: 'Bạn A', review_note: 'Chụp lại ảnh', priority: 'gap' },
         { id: 33, content: 'Thay đèn', handover: false, status: 'cho_duyet', assignee_id: 9, assignee: 'NV G', reviewer_id: 7 }], watch: [] };
  const more = { review_wait: [{ id: 34, content: 'Sắp kệ', handover: false, status: 'cho_duyet', assignee_id: 7, reviewer_id: 8, reviewer: 'QL H' }],
    done_today: [], followups: [{ training_id: 5, employee: 'HV1 – Học viên', item_no: 3, item: 'Mời nước', stage: 'chua_gioi_thieu', instructor: 'NV E', due: '2026-11-20' }] };
  const todo2 = [{ key: 'thieu_nh', label: 'Ca thiếu số dư', n: 2 }, { key: 'nghi_thay', label: 'Nghỉ & làm thay', n: 1 }, { key: 'sao_luu', label: 'Sao lưu', n: 3 }, { key: 'la_moi', label: 'Lạ', n: 1 }];
  const r3 = collectWork({ now, pc: pc2, training: null, ka, todo: todo2, today, more }, H2);
  const g = (k) => r3.items.find((i) => i.key === k);
  ok(g('pc:21').cat === 'vh' && g('pc:21').tag === 'Chốt ca' && g('pc:21').kind === 'pc:1', 'Đối soát ca → Vận hành, nhãn Chốt ca, gộp theo job');
  ok(g('pc:22').tag === 'Ngân hàng' && g('pc:23').cat === 'kh', 'Chuyển khoản → Ngân hàng; việc tự thêm → Khác');
  ok(g('pc:21').who.mine && /\+/.test(g('pc:21').who.text), 'việc 2 người có mình: nhãn xanh, ghi cả hai');
  ok(g('gv:31').cat === 'vh' && g('gv:31').tag === 'Bàn giao ca' && g('gv:31').kind === 'bgc', 'bàn giao ca chờ phân loại → Vận hành');
  ok(g('gv:32').cat === 'kh' && g('gv:32').kind === null && g('gv:32').redo === 'Chụp lại ảnh' && g('gv:32').gap, 'giao việc riêng gõ tay → Khác, không gộp, Làm lại, Gấp');
  ok(g('gv:33').review && !g('gv:33').who.mine && g('gv:33').who.text.includes('NV G'), 'chờ mình kiểm tra: review, người làm là NV G');
  ok(g('gv:34').group === 'waiting' && g('gv:34').waitingFor === 'QL H kiểm tra', 'mình báo xong: việc ở lại, đang chờ QL H');
  ok(g('dtf:5:3').cat === 'ns' && g('dtf:5:3').kind === 'dtf' && g('dtf:5:3').who.text === 'NV E', 'đào tạo đã giao người hướng dẫn → Nhân sự');
  ok(g('ka:8').cat === 'vh' && g('ka:8').tag === 'Tiền', 'khoản âm → Vận hành');
  ok(g('nq').cat === 'ns' && g('ck').cat === 'ns' && g('nqf:33:2').kind === 'nqf', 'nội quy / cam kết → Nhân sự');
  ok(g('todo:thieu_nh').cat === 'vh' && g('todo:nghi_thay').cat === 'ns' && g('todo:sao_luu').cat === 'kh' && g('todo:la_moi').cat === 'kh', 'hồ sơ tồn theo bảng luật, khoá lạ → Khác');
  ok(!r3.failedMore && collectWork({ now, pc: pc2, training: null, ka, todo: todo2, today, more: null }, H2).failedMore, 'app_today_more lỗi chỉ báo riêng');
  ```
- [ ] **Step 2:** `jsc -m kiem_tra/hom_nay_viec_138.mjs`. Mong đợi: `KIỂM TRA THẤT BẠI: Đối soát ca → Vận hành…`.
- [ ] **Step 3:** Sửa `collectWork` theo Interfaces và bảng luật mục 4 bản thiết kế:
  - Job → nhãn: 1, 2, 3 = Chốt ca; 4 = Ngân hàng; 7, 8, 10 = Tiền; 11–14 = Hàng hoá; ≥ 100 → Khác.
  - todo → nhóm: `cho_doi_soat`, `dang_sua`, `qua_ngay` = Chốt ca; `thu_chi`, `mon`, `phieu_rut` = Tiền; `thieu_fabi` = Chốt ca; `thieu_nh` = Ngân hàng; `nghi_thay`, `chu_duyet` = Nhân sự / Nghỉ & làm thay; `sao_luu`, `qua_han_phat`, `cong_viec_quan_tri` hoặc khoá lạ = Khác.
  - `more.review_wait` thêm dòng `gv:` với `waitingFor = '<reviewer> kiểm tra'`.
  - `more.followups` thêm dòng `dtf:<training_id>:<item_no>`, tiêu đề `'<tên học viên> · <item>'`, `sub` theo `stage` (Chưa giới thiệu / Đã giới thiệu, chưa thực hành có giám sát / Đã thực hành có giám sát, chờ chấm mức / Giai đoạn 2 · mức …), `due = due + ' 23:59:59'`, link `/dao-tao/phieu?id=<id>`.
  - Người làm: `pc` = `curStep(t).names` (có `pc.me` trong `accounts` → mine, thay tên mình bằng "Bạn"); `gv` chờ phân loại = `classifiers`, `cho_duyet` = người kiểm tra (nếu là mình thì `who` = người làm), còn lại = `assignee`; `dt` / `ka` / `nq` / `ck` / `todo` = "Bạn". Hai người trở lên: nối bằng " + " và thêm " (ai làm trước cũng được)" cho `pc`.
- [ ] **Step 4:** `jsc -m kiem_tra/hom_nay_viec_138.mjs`. Mong đợi: `ĐẠT <n> kiểm tra`, mọi kiểm tra cũ vẫn đạt.
- [ ] **Step 5:** Commit `Bước 142 (2/4a): collectWork gắn nhóm Vận hành / Nhân sự / Khác, gộp, người làm, kiểm tra`.

### Task 3: `hom_nay_nhom.js` — chia khối, gộp, Đã xong, Mọi người

**Files:**
- Create: `docs/js/hom_nay_nhom.js`
- Test: `kiem_tra/hom_nay_nhom_142.mjs` (`jsc -m`)

**Interfaces:**
- Consumes: item có `cat, kind, kindLabel, tag, group, due, gap, review, redo, who` (Task 2). `app_today_more().done_today` (Task 1). `app_pc_all()` có `tasks, gv, done, people` (`people[i] = { id, name, role, kt }`).
- Produces:
  - `export const CATS = [{ id: 'vh', name: 'Vận hành', hint: 'Tiền · Chốt ca · Hàng hoá · Ngân hàng' }, { id: 'ns', name: 'Nhân sự', hint: 'Nghỉ & làm thay · Đào tạo · Nội quy · Cam kết' }, { id: 'kh', name: 'Khác', hint: 'Việc còn lại' }]`
  - `export function buildSections(items) → [{ cat, entries, counts }]`. `entries` là item, hoặc `{ bundle: true, kind, label, tag, kids, counts, top }`. `counts = { n, gap, late, today, review, redo, waiting }`.
  - `export function doneRows(doneToday, today) → [{ tag, title, at: 'HH:MM', by|null, who }]`, xếp mới nhất trước.
  - `export const ROLE_TABS = ['Quản lý tổng', 'Quản lý', 'Kế toán', 'Việc khác']`
  - `export function roleOfPerson(p) → 'Quản lý tổng'|'Kế toán'|'Quản lý'|'Việc khác'`. Thứ tự xét: `ql_tong` → Quản lý tổng; `kt` → Kế toán; `ql` → Quản lý; còn lại → Việc khác.
  - `export function everyoneWork(pcAll, training, me, helpers) → { items, done }`. `items` dùng lại `collectWork` (bỏ việc chỉ có `me`; mỗi item thêm `roles: string[]`; không có người → `['Việc khác']`). `done` = `pcAll.done` có `done_at` hôm nay + `gv` `hoan_thanh` có `approved_at` hôm nay, mỗi dòng có `roles`.
  - `export function byRole(list, role) → list` (`role === ''` → giữ nguyên).

- [ ] **Step 1: Viết bài thử `kiem_tra/hom_nay_nhom_142.mjs`**, kiểm:
  - `buildSections` trả đúng 3 khối theo thứ tự `vh, ns, kh`, kể cả khi khối trống (`entries.length === 0`).
  - Hai item `kind: 'pc:1'` cùng `vh` → 1 dòng gộp `kids.length === 2`; một item `kind: 'pc:4'` duy nhất → không gộp.
  - Dòng gộp nằm ở vị trí kid gấp nhất (kid quá hạn đứng trước item hạn hôm nay khác loại).
  - Thứ tự trong khối: `review` / `redo` → `gap` → `late` → `today` → `soon` → `later` → `waiting`.
  - `counts` của khối và của dòng gộp đếm đúng `gap, late, today, review, redo, waiting`.
  - `roleOfPerson({ role: 'ql', kt: true }) === 'Kế toán'`, `roleOfPerson({ role: 'ql_tong', kt: true }) === 'Quản lý tổng'`, `roleOfPerson({ role: 'nv' }) === 'Việc khác'`.
  - `everyoneWork`: việc chỉ có `me` không có trong `items`; việc không người nhận có `roles = ['Việc khác']`; việc 2 người (QL B, QL tổng D) có cả hai vai.
  - `byRole(items, 'Kế toán')` chỉ còn việc của kế toán.
  - `doneRows` bỏ việc hôm qua, `at` là `'HH:MM'`, gv có `by`, pc có `by === null`.
- [ ] **Step 2:** `jsc -m kiem_tra/hom_nay_nhom_142.mjs`. Mong đợi: lỗi không tìm thấy module / hàm.
- [ ] **Step 3:** Viết `docs/js/hom_nay_nhom.js` theo Interfaces. Khoá xếp hạng `rank = review||redo ? 0 : gap ? 1 : 2`, rồi `ORDER` của `hom_nay_viec.js` (xuất thêm `ORDER` từ đó), rồi `due` tăng dần (không hạn đứng cuối).
- [ ] **Step 4:** `jsc -m kiem_tra/hom_nay_nhom_142.mjs` và `jsc -m kiem_tra/hom_nay_viec_138.mjs`. Mong đợi: cả hai `ĐẠT`.
- [ ] **Step 5:** Commit `Bước 142 (2/4b): hom_nay_nhom.js — chia khối, gộp, Đã xong hôm nay, Mọi người theo vai trò`.

### Task 4: Giao diện Việc hôm nay + ghi chú Giao việc riêng

**Files:**
- Modify: `docs/js/pages/hom_nay.js` (`render`, `viecBlock`, `theoDoiBlock`; thêm `sectionHtml`, `bundleHtml`, `doneHtml`, `whoHtml`)
- Modify: `docs/js/cv_chung.js` (`gvCreate`: một dòng ghi chú sau `giaoFields`)
- Modify: `kiem_tra/trinh_duyet/hn_gia.js` (giả lập `app_today_more`; `hnfail=more` ném lỗi)
- Create: `kiem_tra/trinh_duyet/flow_hn142.js`
- Modify: `kiem_tra/trinh_duyet/chuan_bi.sh` (chép `flow_hn142.js`), `kiem_tra/trinh_duyet/README.md` (một dòng bước 142)

**Interfaces:**
- Consumes: Task 2 `collectWork` (+ `curStep`), Task 3 `CATS, buildSections, doneRows, ROLE_TABS, everyoneWork, byRole`.
- Produces (cho bài Chrome): `#hn-viec` có `section.hn-grp[data-cat="vh|ns|kh|done"]`, nút đầu `.hn-gh[aria-expanded]`, dòng gộp `.hn-bundle[data-kind]` với nút `.hn-bh[aria-expanded]`, dòng việc `.hn-row[data-key]` (giữ như bước 138), nhãn `.hn-who`, nút `#hn-all-open` / `#hn-all-close`. Chủ: `#hn-tabs button[data-view="mine|all"]`, `#hn-roles button[data-role]`.

- [ ] **Step 1: Viết `flow_hn142.js`** (mẫu: `flow_hn138.js`). Kiểm, mỗi kiểm có câu báo lỗi tiếng Việt:
  - `role=ql`:
    - có 4 khối theo thứ tự `vh, ns, kh, done`;
    - `done` mặc định `aria-expanded="false"`;
    - bấm `.hn-gh` của `vh` thì thu lại; vẽ lại trang (`visit('#/hom-nay')`) vẫn thu;
    - có `.hn-bundle[data-kind="dtf"]`;
    - dòng `review` nằm đầu khối và có chữ "Cần bạn kiểm tra";
    - `.hn-who` có trên mọi `.hn-row`.
  - `role=nv`: dòng `redo` có "Làm lại" + "Lý do:"; dòng mình đã báo xong có "Chờ … kiểm tra".
  - `role=chu`:
    - `#hn-tabs` mặc định `all`;
    - đủ 5 nút lọc;
    - bấm `Kế toán` thì mọi `.hn-who` đều không có "Bạn";
    - bấm `mine` thì chuyển sang danh sách của mình.
  - `hnfail=more`: khối `done` có "Chưa tải được", các khối khác vẫn có dòng.
  - Chặn `localStorage` (ghi đè `Storage.prototype.getItem` ném lỗi, vẽ lại): vẫn vẽ đủ khối.
  - Mở hộp `+ Giao việc riêng` (`#/viec` → nút giao): có chữ "nhóm Khác".
  - `fits()` đúng ở `test/phone.html`.
- [ ] **Step 2:** `chuan_bi.sh <tạm> --dao-tao-gia`. Chạy `script=flow_hn142&role=ql` (Chrome headless thời gian thật, xem README). Mong đợi: `KIỂM TRA THẤT BẠI` (chưa có `.hn-grp`).
- [ ] **Step 3:** Thêm giả lập `app_today_more` vào `hn_gia.js`: tên giả, 1 `review_wait`, 2 `done_today`, 2 `followups` khi `me.role` là `ql` / `chu`. `pc_gia.js` đã có gv `handover` và `app_pc_all`.
- [ ] **Step 4:** Sửa `hom_nay.js`:
  - `render` hỏi thêm `soft(rpc('app_today_more'))`, và `soft(rpc('app_pc_all'))` khi `me.role === 'chu'`, trong cùng `Promise.all`;
  - truyền `more` và `curStep` vào `collectWork`;
  - vẽ theo bản thử: khối, dòng gộp, nhãn người làm, Đã xong, tab Chủ, nút lọc;
  - ô Theo dõi liệt kê `pc.watch` từng dòng có người làm;
  - thu / mở bằng sự kiện trên `root`, lưu `hn-open:<me.id>` (`try/catch`);
  - `#hn-retry` giữ nguyên;
  - CSS dùng biến trong `style.css`, theo bản thử; khung 390px không tràn.
- [ ] **Step 5:** `cv_chung.js` `gvCreate`: sau `${giaoFields(people, me)}` thêm `<div class="pc-note">Việc này hiện trong nhóm <b>Khác</b> ở trang Việc hôm nay của người làm, người kiểm tra và ô Theo dõi của bạn.</div>`. `.pc-note` thêm vào `docs/assets/cong_viec.css` (nền `--info-bg`, chữ `--info-ink`, bo 12px).
- [ ] **Step 6:** Chạy `flow_hn142` với `role=ql|nv|chu|kt`, `hnfail=more`, cả `index.html` và `test/phone.html`. Chạy lại `flow_hn138` (`role=nv|ql|kt|chu`) và `flow_pc109&role=chu`. Mong đợi: tất cả `ĐẠT …`.
- [ ] **Step 7:** Commit `Bước 142 (3/4): Việc hôm nay chia nhóm — thu gọn / mở rộng, gộp, người làm, Đã xong hôm nay, Mọi người của Chủ`.

### Task 5: Phát hành và tài liệu

**Files:**
- Modify: `docs/version.json`, `docs/js/app.js` (`ASSET_VERSION`), `docs/index.html`, các dòng import `?v=2026.11.18.10` trong `docs/js` → `2026.11.18.11`
- Modify: `tai_lieu/TINH_NANG_DA_CHOT.md` (mục mới "Việc hôm nay — chia nhóm (bước 142)"), `tai_lieu/BAN_GIAO.md`

- [ ] **Step 1:** `grep -rn "2026.11.18.10" docs` → đổi hết sang `2026.11.18.11`. `grep` lại, mong đợi 0 dòng cũ.
- [ ] **Step 2:** Chạy lại `jsc` hai bài + `flow_hn142&role=chu` sau khi đổi số phiên bản. Mong đợi: `ĐẠT`.
- [ ] **Step 3:** Cập nhật `TINH_NANG_DA_CHOT.md` và `BAN_GIAO.md` (web `2026.11.18.11`, máy chủ đã chạy tới 124; bỏ dòng "Việc tiếp theo: chia nhóm"). Xoá `work/proposals/cho-lam-viec-hom-nay-chia-nhom.md` khỏi danh sách chờ.
- [ ] **Step 4:** Commit `Bước 142 (4/4): web 2026.11.18.11 — Việc hôm nay chia nhóm (máy chủ 124 đã chạy)` rồi `git push origin main`.
- [ ] **Step 5:** Ghi `app_releases` (gộp vào dòng `2026.11.18`).
  - `added`: "Việc hôm nay chia 3 nhóm Vận hành / Nhân sự / Khác, thu gọn / mở rộng"; "Việc cùng loại gộp 1 dòng"; "Tên người làm trên từng việc"; "Mục Đã xong hôm nay"; "Chủ: tab Mọi người lọc theo vai trò"; "Quản lý: hạng mục đào tạo đã giao người hướng dẫn".
  - `changed`: "Việc đã báo xong vẫn hiện, chờ kiểm tra"; "Ô Theo dõi liệt kê từng việc đã giao".

  Nhắc anh Tiến Revoke mã `sbp_` nếu đã dùng.
