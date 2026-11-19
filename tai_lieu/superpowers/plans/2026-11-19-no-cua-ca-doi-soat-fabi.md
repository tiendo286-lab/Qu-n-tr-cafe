# Nợ của ca ở Đối soát Fabi — kế hoạch làm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (anh Tiến chọn tự làm trong phiên, duyệt một lần cuối). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở Sổ thu chi › Đối soát Fabi › phần A, ngay dưới ô Nợ bill, hiện danh sách nợ mới trong ca và khách trả nợ cũ trong ca, ngay khi nhân viên gửi phiếu.

**Architecture:** Máy chủ: tệp 140 vá bản đang chạy của `app_stc_month`, thêm khoá gốc `ca_debts` (lấy cả tháng một lần). Giao diện: `partA` trong `docs/js/pages/so_thu_chi.js` lọc `D.ca_debts` theo ca rồi vẽ danh sách.

**Tech Stack:** PostgreSQL (Supabase, Management API), JavaScript thuần (ES modules, `html``), bộ thử Chrome giả lập (`kiem_tra/trinh_duyet`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-no-cua-ca-doi-soat-fabi-design.md`

## Global Constraints
- Tệp SQL mới chạy lại nhiều lần không sao; dòng cuối: `insert into public.app_migrations(file) values ('140_no_cua_ca.sql') on conflict (file) do nothing;` (trước đó kiểm `max(file)`).
- Chạy thử trong `DO $$ … RAISE EXCEPTION 'REPORT>> %'` trước, xem kết quả rồi mới chạy thật.
- Không đụng vùng khoá tiền đối soát (danh sách ở CLAUDE.md). `app_stc_month` và `partA` không thuộc vùng khoá.
- Chỉ xem, không có nút thu / sửa nợ.
- Điện thoại 390px không tràn ngang.
- Đẩy lên `main`: tăng `docs/version.json` và `?v=` trong `docs/index.html`; ghi `app_releases`; commit tên `Tien Do <tiendo286@gmail.com>` + dòng Co-Authored-By.

## Review Focus
- Khách trả một phần (khoản bị tách 1–2 lần): dòng nợ gốc hiện **số ban đầu**, kèm "còn nợ X"; không hiện thành nhiều dòng.
- Nợ HĐ khách trả hết ở ca sau: ca gốc vẫn còn dòng, ghi "đã trả".
- Ca không có nợ: không hiện gì thêm (không có khung rỗng).
- Khách trả nợ cũ do quản lý gán ở phiếu chênh lệch (`closed_report_id` = ca): hiện ở "Khách trả nợ cũ".
- Máy chủ chưa cập nhật (thiếu khoá `ca_debts`): web không lỗi, coi như rỗng.

---

### Task 1: Máy chủ trả `ca_debts`

**Files:**
- Create: `supabase/140_no_cua_ca.sql`
- Test: `kiem_tra/so_thu_chi_140.sql`

**Interfaces:**
- Produces: `app_stc_month(p_branch, p_month) -> 'ca_debts'`: mảng, mỗi phần tử
  `{ report_id: bigint, t: 'moi' | 'tra', id: bigint, who: text, kind: 'bill'|'muon'|'ck', amount: bigint, left: bigint, pm: 'tien_mat'|'chuyen_khoan'|null, from: text|null }`.
  - `t='moi'`: dòng `shift_debts` gốc (`split_from is null`, `amount>0`) có `report_id` thuộc ca trong tháng. `amount` = tổng mọi dòng trong cây tách (gốc + con cháu qua `split_from`), `left` = tổng các dòng trong cây có `closed_at is null`.
  - `t='tra'`: dòng có `closed_report_id` thuộc ca trong tháng và `coalesce(report_id,0) <> closed_report_id`; `amount` = số trả, `pm` = `collect_kind`, `from` = `'ca <shift> DD/MM'` của ca gốc hoặc `'quản lý ghi'`.

- [ ] **Step 1: Viết bài thử** `kiem_tra/so_thu_chi_140.sql` theo mẫu `so_thu_chi_139.sql`: đăng nhập chủ, gọi `app_stc_month(1,'2026-11')`, báo `REPORT>>` gồm: có khoá `ca_debts`, số dòng `moi` / `tra`, số ca mà tổng `moi` loại `bill` khác `pos_debt` của phiếu, số dòng `moi` có `left < amount`.
- [ ] **Step 2: Chạy bài thử một mình** → `ca_debts: KHÔNG CÓ KHOÁ`.
- [ ] **Step 3: Viết tệp 140** theo mẫu tệp 139 (đọc `pg_get_functiondef`, chèn khối `'ca_debts', …` trước neo `'items', coalesce((select jsonb_agg(jsonb_build_object(''id'', v.id`; đã có khoá thì bỏ qua; không thấy neo thì dừng). Cây tách dùng `with recursive`. Lọc ca theo `x.branch_id = p_branch and x.work_date between d0 and d1`.
- [ ] **Step 4: Gửi 140 ×2 + bài thử trong một khối tự hoàn tác** → có khoá, số dòng hợp lý, tổng HĐ khớp `pos_debt` (ca lệch thì xem tay lý do). Đo thời gian `app_stc_month` trước / sau, không chậm hơn rõ rệt.
- [ ] **Step 5: Chạy thật tệp 140**, chạy lại bài thử → vẫn đúng; `select max(file) from app_migrations` = `140_no_cua_ca.sql`.
- [ ] **Step 6: Commit** `supabase/140_no_cua_ca.sql kiem_tra/so_thu_chi_140.sql`.

### Task 2: Giao diện danh sách nợ dưới ô Nợ bill

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` (hàm `partA`, ~dòng 993–1035; CSS `stc-*` của trang)
- Modify: `kiem_tra/trinh_duyet/stc_fixture.js` (thêm `ca_debts`)
- Create: `kiem_tra/trinh_duyet/flow_stc10.js`
- Modify: `kiem_tra/trinh_duyet/README.md` (một dòng bước 157)

**Interfaces:**
- Consumes: `D.ca_debts` (Task 1).
- Produces: hàm `debtList(D, c) -> html | ''` trong `so_thu_chi.js`; khung class `stc-cadebt`, mỗi dòng `stc-cdr` có `data-t="moi|tra"`.

- [ ] **Step 1: Thêm dữ liệu giả** vào `stc_fixture.js`: ca 182 (chưa xác nhận) có `moi` HĐ "Bàn 5" 120.000 (left 120.000), TM "Bàn 3" 85.000 (left 85.000), CK "Chị Lan" 60.000 (left 0), và `tra` "Chú Hùng" 200.000 `tien_mat` từ `ca Tối 15/11`; ca 181 (đã xác nhận) có `moi` HĐ "Bàn 9" 100.000 left 40.000; ca 183 không có nợ.
- [ ] **Step 2: Viết `flow_stc10.js`** (mẫu `flow_stc6/8`, mở `#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11&ds=<id>`), kiểm:
  - ca 182: `.stc-cadebt` có 4 dòng; có "bàn 5", "120.000", "chú hùng", "+200.000", "ca tối 15/11"; dòng Chị Lan có "đã trả".
  - ca 181 (đã xác nhận): có `.stc-cadebt`, dòng Bàn 9 có "còn nợ 40.000".
  - ca 183: không có `.stc-cadebt`.
  - Ở 390px: không tràn ngang.
- [ ] **Step 3: Chạy bài thử** (`chuan_bi.sh <thư mục>`, Chrome, role chu) → phải **hỏng** (chưa có `.stc-cadebt`).
- [ ] **Step 4: Viết `debtList(D, c)`** và gọi trong `partA` ngay dưới ô Nợ bill ở cả hai trạng thái (lưới ô ① khi chưa xác nhận; `stc-fsum` khi đã xác nhận). Nhóm "Nợ mới trong ca" rồi "Khách trả nợ cũ trong ca"; nhãn `HĐ / TM / CK / Trả` (`bill` → HĐ, `muon` → TM, `ck` → CK); `left = 0` → "đã trả", `0 < left < amount` → "còn nợ X"; TM ghi "két thiếu", CK ghi "hotline thiếu". `D.ca_debts` thiếu hoặc ca không có dòng → `''`.
- [ ] **Step 5: Chạy lại `flow_stc10`** role chu / qlt / ql, `index.html` và `test/phone.html` → đạt hết.
- [ ] **Step 6: Chạy lại `flow_stc6`, `flow_stc7`, `flow_stc9`** (role chu, máy tính + điện thoại) → không có dòng hỏng mới.
- [ ] **Step 7: Commit** các tệp trên.

### Task 3: Đưa lên web

**Files:**
- Modify: `docs/version.json`, `docs/index.html` (`?v=`), `tai_lieu/BAN_GIAO.md`, `tai_lieu/TINH_NANG_DA_CHOT.md` (một dòng)

- [ ] **Step 1:** Tăng phiên bản (`2026.11.19.15`) ở `version.json` và mọi `?v=` trong `index.html`.
- [ ] **Step 2:** Ghi `app_releases` dòng `2026.11.19` (gộp vào `added`): "Đối soát Fabi: ô Nợ bill hiện ngay danh sách nợ của ca (HĐ / TM / CK, đã trả / còn nợ) và khách trả nợ cũ trong ca, không cần chờ xác nhận Fabi".
- [ ] **Step 3:** Cập nhật `BAN_GIAO.md` (bước 157), commit, `git push origin main`; nhắc anh Revoke mã `sbp_`.
