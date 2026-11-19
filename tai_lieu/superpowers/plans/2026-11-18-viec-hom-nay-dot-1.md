# Việc hôm nay — đợt 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở tab Việc hôm nay cho cả 5 vai trò làm trang đầu sau đăng nhập, gồm Ca của tôi hôm nay (+ nhắc Order), Việc của tôi (gom từ hồ sơ có sẵn, xếp quá hạn → hôm nay → sắp tới → đang chờ), Theo dõi (người có phạm vi quản lý), Bảng lương của tôi (giờ, ghi chú, khoản âm).

**Architecture:** Một hàm máy chủ mới `app_today_me()` (tệp 121) trả ca hôm nay + đợt Order đang mở. Các khối khác dùng lại hàm sẵn có (`app_home_todo`, `app_pc_mine`, `app_dt_work_list`, `app_ka_mine`, `app_cong_mine`), hỏi cùng lúc bằng `Promise.all`, mỗi nguồn lỗi riêng không làm hỏng cả trang. Logic gom/xếp việc là hàm thuần trong `docs/js/hom_nay_viec.js` để thử bằng `jsc -m`.

**Tech Stack:** JS thuần ES modules (`html\`\`` trong `docs/js/ui.js`), Supabase PL/pgSQL, bộ thử Chrome + Supabase giả lập (`kiem_tra/trinh_duyet/`).

**Spec:** `work/proposals/phuong-an-viec-hom-nay.md` (mục Danh sách triển khai 1, 2, 3, 5, 6; một phần 4 và 7).

## Global Constraints

- Sau khi đăng nhập, cả năm vai trò (Nhân viên, Quản lý, Kế toán, Quản lý tổng, Chủ) vào **Việc hôm nay** trước.
- Nút **Order ca** hiện ngay đầu trang nếu đang mở đợt Order và nhân viên chưa gửi.
- Tải lỗi: **Chưa tải được công việc** + nút **Thử lại**. Trống: **Hôm nay bạn không có việc cần xử lý**.
- Một hồ sơ xuất hiện một lần trong danh sách cá nhân; việc đã xong rời danh sách.
- Bảng lương của tôi: giờ thực tế, phát sinh cộng/trừ giờ có ghi chú (ngày, ca, cơ sở, lý do), khoản âm; **không** có dòng tổng lương / tiền mặt đã trả. Nút **Xem chi tiết** mở Công của tôi, nơi có cả giờ làm, ghi chú và Khoản âm.
- Điện thoại 390px: một cột, Việc của tôi ngay sau Ca, không tràn ngang.
- Bảng mới không cấp quyền `anon`/`authenticated`; hàm `app_*` SECURITY DEFINER, `revoke … from public, anon`, `grant … to authenticated`; dòng cuối tệp SQL ghi `app_migrations`.
- Kiểm tra quyền dùng `coalesce`, không `x IN (a, NULL)`.

## Review Focus

- Tài khoản không gắn nhân viên (Chủ admin) → khối Ca hiện "Tài khoản này không có ca", không lỗi.
- Một nguồn dữ liệu lỗi (vd `app_dt_work_list`) → các khối khác vẫn hiện; chỉ khối Việc của tôi báo "Chưa tải được công việc" khi **mọi** nguồn việc lỗi.
- Nhân viên có 2 ca trong ngày (Sáng + Tối, hoặc FULL TIME) → hiện đủ, xếp theo giờ bắt đầu.
- Đợt Order đã đóng hoặc đã gửi → không hiện nút Order đầu trang.
- Nhân viên kiêm Kế toán ở màn nhân viên → vẫn vào Việc hôm nay, thấy cả việc Kế toán theo quyền.

---

### Task 1: Hàm máy chủ `app_today_me()` (tệp 121)

**Files:**
- Create: `supabase/121_viec_hom_nay.sql`
- Test: `kiem_tra/viec_hom_nay_121.sql` (ghép sau tệp 121, kết thúc `RAISE EXCEPTION 'REPORT>> %'`)

**Interfaces:**
- Produces: `app_today_me() returns jsonb` =
  `{ today: 'YYYY-MM-DD', now: 'YYYY-MM-DD HH24:MI:SS', has_employee: bool,
     shifts: [{ shift, branch_id, branch, role, start: 'HH:MM'|null, end: 'HH:MM'|null, report_id: bigint|null, report_status: text|null, recon_status: text|null }],
     order: null | { week_id, start_date, close_at, submitted: bool } }`
  - `shifts`: `schedule_published` của `app_my_employee()` trong tuần chứa hôm nay (`weekday = today - weeks.start_date`), giờ từ `branch_shifts` (nối `shifts.name = sp.shift`), phiếu từ `shift_reports(branch_id, work_date = today, shift)`. Xếp theo `start` rồi `shifts.sort_order`.
  - `order`: đợt có `week_order_windows.open_at <= now < close_at`, chỉ khi có nhân viên và `app_can('order_ca')`; `submitted` = có `order_submissions(week_id, employee_id)`.

- [ ] **Step 1:** Viết `kiem_tra/viec_hom_nay_121.sql`: lấy 1 nhân viên có lịch hôm nay (nếu có) + Chủ không gắn nhân viên; giả lập đăng nhập bằng `request.jwt.claims`; chèn tạm 1 dòng `schedule_published` cho nhân viên giả + `week_order_windows` mở; khẳng định: nhân viên thấy đúng ca, `order.submitted=false`, sau khi chèn `order_submissions` thì `true`; Chủ `has_employee=false`, `shifts=[]`; `anon` không gọi được.
- [ ] **Step 2:** Chạy thử trên máy chủ thật trước khi có tệp 121 → Expected: lỗi `function app_today_me() does not exist`.
- [ ] **Step 3:** Viết `supabase/121_viec_hom_nay.sql` (plpgsql, `stable security definer set search_path = public`, `app__need(null)`).
- [ ] **Step 4:** Ghép 121 + bài thử, chạy hai lần liền → Expected: `REPORT>>` với mọi khẳng định đạt.
- [ ] **Step 5:** Commit (chưa chạy thật).

### Task 2: Giả lập `app_today_me` cho bộ thử Chrome

**Files:**
- Create: `kiem_tra/trinh_duyet/hn_gia.js` (`export function makeHn(T, me)` → `{ app_today_me }`)
- Modify: `kiem_tra/trinh_duyet/sb_gia.js` (import + gộp như `makeDt`), `kiem_tra/trinh_duyet/chuan_bi.sh` (chép `hn_gia.js`, `flow_hn138.js`)

**Interfaces:**
- Produces: tham số URL `hnca=0|1|2` (số ca hôm nay, mặc định 1 với nhân viên), `hnorder=0|1|sent` (đợt Order: không có / mở chưa gửi / đã gửi), `hnfail=dt` (cho `app_dt_work_list` ném lỗi).

- [ ] **Step 1:** Viết giả lập trả đúng hình dạng Task 1; `hnfail=dt` bọc `app_dt_work_list` ném `Error('Lỗi thử')`.
- [ ] **Step 2:** Kiểm tra cú pháp: `jsc -m` nạp được module (không lỗi cú pháp).
- [ ] **Step 3:** Commit cùng Task 3.

### Task 3: Hàm thuần gom Việc của tôi

**Files:**
- Create: `docs/js/hom_nay_viec.js`
- Test: `kiem_tra/hom_nay_viec_138.mjs` (chạy `jsc -m`)

**Interfaces:**
- Produces:
  - `collectWork({ now, pc, training, ka, todo }) -> { items: Item[], failed: boolean }` với `Item = { key, title, sub, due: string|null, link, group: 'late'|'today'|'soon'|'later'|'waiting', waitingFor: string|null }`.
    - `pc` = kết quả `app_pc_mine` (hoặc `null` nếu lỗi): mỗi `tasks[]` → 1 item (`key 'pc:'+id`, `title jobName(job)`, due `pcDue`, link `/viec`); mỗi `gv[]` → `key 'gv:'+id`, due `gvDue`, `waitingFor` khi `rstate(k)===3` và mình không phải người kiểm tra.
    - `training` = `app_dt_work_list({p_mine:true})` hoặc `null`: mỗi row → `key 'dt:'+id`, title `Đào tạo · <employee>`, sub `my_duties.join(' · ')`, due `due+' 23:59:59'`, link `/dao-tao/phieu?id=<id>`.
    - `ka` = `app_ka_mine` hoặc `null`: khoản `chua_xu_ly` chưa `seen_at` hoặc còn giải trình được mà chưa giải trình → `key 'ka:'+id`, title `Khoản âm ca <shift> <branch> · <dmy>`, link `/cua-toi/khoan-am`, due null.
    - `todo` = `app_home_todo().items` hoặc `null`: item `n>0` (trừ `key==='cong_viec_cua_toi'` vì trùng với `pc`) → `key 'todo:'+key`, title `label`, sub `n + ' hồ sơ'`, link, due null.
    - `group`: `waitingFor` → `waiting`; due < now → `late`; cùng ngày `now` → `today`; trong 3 ngày → `soon`; còn lại (gồm due null) → `later`. Thứ tự trả về: late, today, soon, later, waiting; trong nhóm theo due tăng dần, null cuối.
    - `failed` = mọi nguồn đều `null`.
  - `GROUP_LABEL = { late: 'Quá hạn', today: 'Hạn hôm nay', soon: 'Sắp đến hạn', later: 'Khác', waiting: 'Đang chờ' }`.

- [ ] **Step 1:** Viết bài thử: (a) task quá hạn đứng trước việc hạn hôm nay; (b) `cong_viec_cua_toi` bị bỏ; (c) cùng `id` không lặp; (d) `pc=null,training=null,ka=null,todo=null` → `failed=true`; (e) chỉ `training=null` → `failed=false`; (f) khoản âm đã xem + đã giải trình → không có item.
- [ ] **Step 2:** `jsc -m kiem_tra/hom_nay_viec_138.mjs` → Expected: lỗi không tìm thấy module.
- [ ] **Step 3:** Viết `docs/js/hom_nay_viec.js` (nhập `jobName, pcDue, gvDue, rstate` từ `./cv_chung.js?v=<phiên bản>`; nếu `cv_chung.js` kéo theo DOM không chạy được trong jsc thì nhận các hàm này qua tham số `helpers`).
- [ ] **Step 4:** Chạy lại → Expected: `ĐẠT 6 kiểm tra`.
- [ ] **Step 5:** Commit.

### Task 4: Trang Việc hôm nay + điều hướng

**Files:**
- Modify: `docs/js/pages/hom_nay.js` (viết lại), `docs/js/app.js` (HUBS dòng `Việc hôm nay` quyền `null`; `render()`: `/` → `/hom-nay` cho mọi vai trò đã đổi mật khẩu; thanh dưới nhân viên: tab `Việc` → `Hôm nay` trỏ `#/hom-nay`, sáng khi ở `/hom-nay` hoặc `/viec`)
- Modify: `docs/js/pages/khoan_am_toi.js` (xuất `kaCard(k)` + `bindKa(root)` để dùng lại), `docs/js/pages/cong_toi.js` (thêm mục **Khoản âm của tôi** dưới các ca, dùng `kaCard`)
- Test: `kiem_tra/trinh_duyet/flow_hn138.js`

**Interfaces:**
- Consumes: `app_today_me` (Task 1/2), `collectWork`, `GROUP_LABEL` (Task 3).
- Bố cục (một cột trên điện thoại, máy tính tối đa 1000px):
  1. Đầu trang: lời chào + ngày; nếu `order && !order.submitted` → nút `#hn-order` **Order ca** (link `#/order`, kèm "hạn <close_at>").
  2. `#hn-ca` **Ca của tôi hôm nay**: mỗi ca "Ca <shift> · <branch> · <start>–<end>" + trạng thái phiếu (`report_status` null → "Chưa mở phiếu") + nút **Mở ca** (`#/ca`, chỉ khi `can('chot_ca')`). Không có ca → "Hôm nay bạn không có ca."; không gắn nhân viên → "Tài khoản này không gắn nhân viên nên không có ca."
  3. `#hn-viec` **Việc của tôi**: nhóm theo `GROUP_LABEL`, mỗi dòng `a.hn-row[data-key]` (tiêu đề, phụ đề, hạn, "Đang chờ: …"). `failed` → "Chưa tải được công việc" + nút `#hn-retry` **Thử lại** (gọi lại `render`). Trống → "Hôm nay bạn không có việc cần xử lý". Cuối khối: link **Xem tất cả công việc** (`#/viec`).
  4. `#hn-theo-doi` **Theo dõi** — chỉ khi vai trò thuộc `ql, ql_tong, chu, ke_toan` hoặc `can('doi_soat')`/`can('ke_toan')`: các ô đếm `app_home_todo` (nhóm theo `group`, giữ kiểu ô `.hn-i` cũ) + "Việc tôi đã giao" (`pc.watch.length`, link `#/viec`). Trên điện thoại khối này là `<details>` thu gọn được (mặc định mở trên máy tính).
  5. `#hn-luong` **Bảng lương của tôi** — chỉ khi có `employee_id`: tháng hiện tại từ `app_cong_mine`: số ca, giờ thực tế, giờ +x2, giờ bị trừ; tối đa 3 ghi chú nghỉ/làm thay gần nhất (ngày, ca, cơ sở, lý do); khoản âm tháng này (`app_ka_mine` lọc `work_date` cùng tháng, bỏ `huy`): mỗi dòng ngày · ca · cơ sở · số tiền · trạng thái; nút `#hn-luong-more` **Xem chi tiết** → `#/cua-toi/cong`.

- [ ] **Step 1:** Viết `flow_hn138.js`: kiểm tra theo `role` (chu | nv | ql | kt): có `#hn-ca`, `#hn-viec`; `nv` + `hnorder=1` có `#hn-order`, `hnorder=sent` không có; `nv` có `#hn-luong` và `#hn-luong-more[href="#/cua-toi/cong"]`; `nv` không có `#hn-theo-doi`; `chu` có `#hn-theo-doi`; `hnfail=dt` vẫn hiện các khối khác; vào `#/` chuyển tới `#/hom-nay` (cả `nv`); mở `#/cua-toi/cong` có mục Khoản âm; `scrollWidth <= innerWidth + 1`. Ghi `ĐẠT …` hoặc `KIỂM TRA THẤT BẠI: …`.
- [ ] **Step 2:** Chạy (thời gian thật, xem README) → Expected: `KIỂM TRA THẤT BẠI` (chưa có khối mới).
- [ ] **Step 3:** Làm `app.js`, `hom_nay.js`, `khoan_am_toi.js`, `cong_toi.js`.
- [ ] **Step 4:** Chạy `flow_hn138` cho 4 vai trò ở `index.html` và `test/phone.html` → Expected: `ĐẠT` cả 8 lần; `script=wide` cho `#/hom-nay,#/cua-toi/cong` không tràn trang.
- [ ] **Step 5:** Chạy lại `flow_dt137` (máy tính) → Expected: `ĐẠT`.
- [ ] **Step 6:** Commit.

### Task 5: Phát hành

- [ ] Chạy thật `121_viec_hom_nay.sql` (sau khi bài thử Task 1 đạt), kiểm `app_migrations`.
- [ ] Tăng phiên bản `2026.11.18.7` → `2026.11.18.7` ở mọi chỗ (`docs/version.json`, `ASSET_VERSION`, `index.html`, các import `?v=`).
- [ ] Cập nhật `tai_lieu/TINH_NANG_DA_CHOT.md` (mục Việc hôm nay đợt 1), `tai_lieu/BAN_GIAO.md` (web, máy chủ 121, việc còn lại đợt 2), README bộ thử (`flow_hn138`).
- [ ] Commit, push `main`, thêm dòng `app_releases` `2026.11.18.7`.

## Để đợt 2 (ngoài kế hoạch này)

- Việc Nội quy (đọc bản mới, hạn 12 ngày) và Cam kết (Kế toán cập nhật Đã ký và nộp) — cần bảng theo dõi mới.
- Theo dõi nhóm theo bộ phận/cơ sở có số quá hạn, việc chưa có người nhận.
- Khoản âm nối trạng thái Lệch tiền ca (chờ tiền về, chờ gán, khách trả nợ) và nút Mở ca trên từng dòng.
- Máy chủ chặn nhân viên mở chi tiết / gửi phiếu ca không có tên mình (mục 8).
