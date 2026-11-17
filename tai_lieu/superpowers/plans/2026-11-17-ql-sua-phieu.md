# Quản lý sửa thẳng Phiếu chốt ca — Kế hoạch sửa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở bước Kiểm tra của Phiếu chốt ca, quản lý sửa thẳng được mọi số tiền và màn hình hiện đúng kết quả máy chủ.

**Architecture:** Giữ kiến trúc đang có: quản lý sửa trên bản kiểm tra `shift_report_recon` (qua `app_ca_recon_save` / `app_ca_recon_direct`), số dùng để tính = `app__ca_eff` (bản kiểm tra đè lên phiếu), kết quả tiền = `app__ca_money`. Mọi thay đổi máy chủ nằm trong 1 tệp mới `supabase/101_ql_sua_phieu.sql`; giao diện sửa `docs/js/pages/phieu_ca.js` và `docs/js/doi_soat_den.js`.

**Tech Stack:** PostgreSQL / Supabase (plpgsql, SECURITY DEFINER), JavaScript thuần (ES modules), bộ chạy thử `kiem_tra/trinh_duyet/` (Chrome headless + Supabase giả `sb_gia.js`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-17-ql-sua-phieu-design.md`

## Global Constraints

- Tệp máy chủ mới: `supabase/101_ql_sua_phieu.sql` (số lớn nhất đã chạy là 100 — kiểm lại `app_migrations` ngay trước khi chạy). Chạy lại nhiều lần không sao. Dòng cuối: `insert into public.app_migrations(file) values ('101_ql_sua_phieu.sql') on conflict (file) do nothing;`
- Mỗi hàm thay thế phải lấy **bản đang chạy trên máy chủ** (`select pg_get_functiondef('public.<tên>(<kiểu>)'::regprocedure)`) làm gốc rồi mới sửa — không lấy từ tệp cũ.
- Chạy thử trước trong `begin; … rollback;` (hoặc khối `DO … RAISE EXCEPTION 'REPORT>> %'`), xem kết quả rồi mới chạy thật. Đổi CSDL trước, đẩy giao diện sau.
- Không dùng `x IN (a, NULL)` / `= NULL` trong kiểm tra quyền; dùng `coalesce`.
- Tiền là số nguyên (bigint). `pos_diff` và `opening_cash` được âm; các ô tiền khác không âm.
- Mọi lần quản lý sửa số ghi `shift_recon_log` (field, before, after, reason, by_account). Phiếu nhân viên gốc (`shift_reports`) không bị quản lý ghi đè.
- Giao diện kiểm tra cả máy tính và khung điện thoại 390px, không tràn ngang.
- Kho mã công khai: không đưa mã `sbp_`, tên nhân viên thật, dữ liệu thật vào tệp.
- Commit tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp có dòng Co-Authored-By.

## Review Focus

1. Chủ "Sửa thẳng" làm đổi số lệch tiền mặt / chuyển khoản trên ca đã hoàn thành → phải bị từ chối (không để kết quả KHỚP cũ thành sai). Test ở Task 4.
2. Phiếu chưa có bản kiểm tra (`shift_report_recon` trống) vẫn hiện đúng 3 ô mới (lấy từ phiếu nhân viên qua `app__recon_snapshot`). Test ở Task 3.
3. Quản lý xoá trắng ô Tiền chênh lệch hoặc gõ số âm → âm được lưu, trống lưu `null`, không báo "không được âm". Test ở Task 3.
4. Phiếu cũ có bản kiểm tra tạo trước bước 101 (thiếu 3 khoá mới) → không lỗi, 3 ô lấy theo phiếu nhân viên. Test ở Task 3.
5. Mục đã được web tự đối soát (khoá tự động) vẫn khoá đúng như cũ khi Chủ chưa mở khoá. Test ở Task 4 (flow kiểm không làm hỏng `flow_auto51`).

---

### Task 1: Ô "Chuyển khoản ngân hàng" dùng số Phải nhận đúng

**Files:**
- Create: `supabase/101_ql_sua_phieu.sql` (phần 1)
- Modify: `docs/js/pages/phieu_ca.js:1300` (chỉ khi cần — xem Step 4)
- Test: `kiem_tra/audit_tien/t02_o_phai_nhan_chuyen_khoan.sql` (đã có, đang FAIL)

**Interfaces:**
- Produces: `public.app__ca_money(p_id bigint) returns jsonb` có thêm khoá `ck_expected bigint` = `pos_transfer + ck_moves + col_ck − ck_new` (cùng các số đã tính trong hàm). Bất biến: khi `bank_ok` thì `bank_received − ck_expected = ck_left_bank`. `app_ca_get` (khoá `money`) tự có khoá mới vì gọi `app__ca_money`.

- [ ] **Step 1: Chạy test hiện tại, thấy FAIL** — `bash $S/sbc.sh kiem_tra/audit_tien/t02_o_phai_nhan_chuyen_khoan.sql` → `"ket_qua" : "FAIL"`, `may_chu_co_ck_expected: false`, 17 ca.
- [ ] **Step 2: Viết phần 1 của tệp 101** — `create or replace function public.app__ca_money(p_id bigint)` từ bản đang chạy, thêm `'ck_expected', pt + ck_mv + col_ck - ck_new` vào `jsonb_build_object` trả về. Không đổi khoá nào khác.
- [ ] **Step 3: Chạy thử phần 1 trong `begin; … ; \i t02 nội dung; rollback;`** (gộp phần 1 + nội dung t02 vào một khối tự hoàn tác) → `PASS`, `so_ca_..._31_ngay: 0`.
- [ ] **Step 4: Giao diện** — `phieu_ca.js:1300` đang dùng `R.money?.ck_expected ?? R.pos_transfer`. Giữ dòng này; chỉ đổi phần dự phòng: khi `ck_expected` không có thì hiện "Chưa tính được số phải nhận" thay vì so với `pos_transfer`.
- [ ] **Step 5: Commit** — `git add supabase/101_ql_sua_phieu.sql docs/js/pages/phieu_ca.js` · "Bước 119: ô Chuyển khoản ngân hàng ở bước Kiểm tra dùng số Phải nhận của máy chủ".

### Task 2: Quản lý sửa không làm mất lương trả tiền mặt

**Files:**
- Modify: `supabase/101_ql_sua_phieu.sql` (phần 2)
- Test: `kiem_tra/audit_tien/t01_sua_mat_luong_tien_mat.sql` (đã có, đang FAIL: lương 200.000 → 0)

**Interfaces:**
- Produces: `public.app_ca_recon_save(p_id bigint, p jsonb, p_reason text) returns void` — nhánh `staff` giữ thêm khoá `'cash_paid', nullif(nullif(x ->> 'cash_paid', '')::bigint, 0)` (âm → `raise exception 'Số tiền lương đã trả không được âm.'`).

- [ ] **Step 1: Chạy t01, thấy FAIL** — `luong_tien_mat_sau_khi_sua: 0`.
- [ ] **Step 2: Viết phần 2** — thay `app_ca_recon_save` từ bản đang chạy, thêm `cash_paid` vào `jsonb_build_object` ở nhánh `k = 'staff'` (dòng tương ứng `98_chot_ca_doi_soat_chung.sql:211-214`).
- [ ] **Step 3: Chạy thử phần 1+2 cùng t01 trong khối tự hoàn tác** → `PASS`, lương trước = sau = 200000, lệch tiền mặt trước = sau.
- [ ] **Step 4: Commit** — "Bước 119: sửa ở bước Kiểm tra không còn xoá lương trả tiền mặt".

### Task 3: Ô Nợ, Tiền chênh lệch, Số dư đầu Fabi — Fabi tự sửa, quản lý sửa được

**Files:**
- Modify: `supabase/101_ql_sua_phieu.sql` (phần 3)
- Modify: `docs/js/doi_soat_den.js:12-14` (ITEM_FIELDS)
- Modify: `docs/js/pages/phieu_ca.js:327-331` (ô Fabi ở bước Kiểm tra), `:857-862` (`collect()`)
- Create: `kiem_tra/audit_tien/t03_ba_o_fabi.sql`
- (Bàn giao trong `flow_audit_ql_sua.js` vẫn FAIL tới Task 6 — bình thường.)

**Interfaces:**
- Produces (máy chủ):
  - `app__recon_fields()` thêm `'ipos_opening','pos_debt','pos_diff'`.
  - `app__recon_snapshot(p_id)` thêm 3 khoá đó (lấy từ `shift_reports`).
  - `app_ca_recon_save`: 3 khoá kiểm như số nguyên; `ipos_opening`, `pos_debt` không âm; `pos_diff` được âm; nếu bản kiểm tra cũ thiếu khoá thì `old -> k` là null (không lỗi).
  - `app__ca_item_fields('doanh_thu')` = `['total_revenue','pos_cash','pos_transfer','cups','opening_cash','ipos_opening','pos_debt','pos_diff']`.
  - `app__fabi_apply(p_ma text)`: vòng "bản đối soát phải theo Fabi" thêm `('pos_debt','Nợ',f.no)`, `('pos_diff','Tiền chênh lệch',f.tong - f.cuoi)`, `('ipos_opening','Số dư đầu (phiếu Fabi)',f.dau)`.
  - `app__ca_eff`: bản kiểm tra cũ thiếu 3 khoá → lấy từ snapshot (đè `snapshot || data`, không chỉ `data`).
- Produces (giao diện): ô `#pos_debt`, `#pos_diff` (có dấu −), `#ipos_opening` (hiện, không còn `type=hidden` ở bước Kiểm tra), `collect()` trả thêm `pos_debt`, `pos_diff`; hàm `parseSigned(s: string): number|null` trong `phieu_ca.js`.

- [ ] **Step 1: Viết test `t03_ba_o_fabi.sql`** (tự hoàn tác, in REPORT>>):
  - a) phiếu đã gửi, xoá bản kiểm tra, gọi `app_ca_recon_save(id, '{"pos_debt":50000,"pos_diff":-3000,"ipos_opening":1000000}', 'thử')` bằng Chủ → `app__ca_eff(id)` có đúng 3 số đó; `shift_recon_log` có 3 dòng `sua` với field tương ứng; `shift_reports.pos_debt` không đổi.
  - b) gửi `"pos_diff": null` → lưu null, không lỗi; gửi `"pos_debt": -1` → lỗi "không được âm".
  - c) bản kiểm tra cũ chỉ có các khoá trước bước 101 → `app__ca_eff(id) ->> 'pos_debt'` = `shift_reports.pos_debt`.
  - d) 1 dòng `fabi_shifts` có `report_id`: đặt `shift_reports.pos_debt = f.no + 1000` và `ipos_opening = f.dau + 1`, xoá bản kiểm tra, gọi `app__fabi_apply(ma_ca)` → `app__ca_eff` có `pos_debt = f.no`, `ipos_opening = f.dau`, `pos_diff = f.tong - f.cuoi`; log reason bắt đầu `Theo file Fabi`.
  - Kết quả `PASS` khi cả 4 ý đúng.
- [ ] **Step 2: Chạy t03 trên máy chủ hiện tại → FAIL** (ý a: khoá không được lưu).
- [ ] **Step 3: Viết phần 3 của tệp 101** theo Interfaces.
- [ ] **Step 4: Chạy thử phần 1+2+3 + t01 + t02 + t03 trong khối tự hoàn tác → cả 3 PASS.**
- [ ] **Step 5: Giao diện** — ở `unifiedFabi` thay 2 ô `disabled` bằng `money('pos_debt', R.pos_debt, !edT)` và ô có dấu `id="pos_diff"`; hiện ô `ipos_opening` có nhãn "Số dư đầu (phiếu Fabi)" ở bước Kiểm tra; `collect()` thêm `pos_debt: parseMoney(v('#pos_debt'))`, `pos_diff: parseSigned(v('#pos_diff'))`; `ITEM_FIELDS.doanh_thu` thêm 3 trường; danh sách so "Phiếu NV: …" (`phieu_ca.js` trong `mount`, mảng các khoá) thêm 3 khoá.
- [ ] **Step 6: Giả lập** — `kiem_tra/trinh_duyet/` (`ca_gia.js` / `sb_gia.js`): bản kiểm tra giả nhận 3 khoá mới giống máy chủ.
- [ ] **Step 7: Chạy `flow_audit_ql_sua` (role=chu, confirm=1, máy tính + `test/phone.html` 390px)** → không còn "Nợ trên phiếu Fabi", "Tiền chênh lệch trên phiếu Fabi" trong danh sách không sửa được; không tràn ngang.
- [ ] **Step 8: Commit** — "Bước 119: Nợ, Tiền chênh lệch, Số dư đầu Fabi — tự sửa theo file Fabi, quản lý sửa được ở bước Kiểm tra".

### Task 4: Chủ "Sửa thẳng" sửa được Khách nợ, không khoá nhầm ô của mục chưa duyệt

**Files:**
- Modify: `supabase/101_ql_sua_phieu.sql` (phần 4)
- Modify: `docs/js/pages/phieu_ca.js:618` (`debtEd`), `:772` (`moneyOpen`), `:885-886` (`dirF` / `LKF`)
- Modify: `docs/js/doi_soat_den.js:12-14` (`ITEM_FIELDS.cong_no = ['debts']`)
- Create: `kiem_tra/audit_tien/t04_sua_thang.sql`
- Test: `kiem_tra/trinh_duyet/flow_audit_ql_sua.js` với `&che=direct`

**Interfaces:**
- Produces (máy chủ):
  - `app__ca_item_fields('cong_no')` = `['debts']` (để `app_ca_recon_direct` nhận mục Công nợ).
  - `app_ca_recon_save` nhánh Sửa thẳng: `lk := (app__ca_locked_fields(p_id)) − dir` thay cho "mọi trường trừ dir" → ô của mục chưa duyệt vẫn sửa được.
  - Hàm mới `public.app__ca_direct_guard(p_id bigint) returns void` (nội bộ, không cấp quyền web): nếu `recon_status = 'hoan_thanh'` mà `tm_left` / `ck_left` hiện tại khác `shift_report_results.computed` của mục đó → `raise exception 'Số lệch % đã đổi (% → %). Bấm "Mở lại phần tiền" rồi duyệt lại.'`. Gọi ở cuối `app_ca_recon_save` khi đang Sửa thẳng và ở cuối 7 hàm khách nợ bên dưới.
  - 7 hàm khách nợ ở bước Kiểm tra (`app_ca_recon_debt`, `_set`, `_remove`, `_update`, `_uncollect`, `_collect`, `_delete`): chỗ đang từ chối khi `recon_status = 'hoan_thanh'` → cho qua nếu `coalesce(a.system_role,'') = 'chu'`; lý do bắt buộc như cũ.
- Produces (giao diện): `debtEd` = cũ **hoặc** (`DIR` và `DIR.items` có `'cong_no'`); `moneyOpen` gồm `'cong_no'` khi đã duyệt; Sửa thẳng khoá `LKF = (LK.fields ∪ trường của mục đã duyệt) − dirF`.

- [ ] **Step 1: Viết test `t04_sua_thang.sql`** (tự hoàn tác, Chủ): a) ca hoàn thành, mục tiền mặt chưa có kết quả → Sửa thẳng mục `doanh_thu` vẫn lưu được `cash_counted`; b) Sửa thẳng `cong_no` → `app_ca_recon_debt_set` đổi số nợ thành công khi số lệch không đổi; c) Sửa thẳng làm `tm_left` khác kết quả đã ghi → lỗi "Số lệch … đã đổi"; d) tài khoản quản lý (không phải Chủ) gọi hàm khách nợ trên ca hoàn thành → vẫn bị từ chối như cũ.
- [ ] **Step 2: Chạy t04 → FAIL** (ý a, b).
- [ ] **Step 3: Viết phần 4 của tệp 101** theo Interfaces.
- [ ] **Step 4: Chạy thử toàn bộ tệp 101 + t01…t04 trong khối tự hoàn tác → 4 PASS.**
- [ ] **Step 5: Giao diện** theo Interfaces. Thêm: nút thêm (+ Thu, + Chi, + Báo nợ, + Thu nợ, + Khách CK rút tiền mặt) **hiện đúng theo trạng thái khoá** của mục — mục khoá thì ẩn, mục mở (kể cả Sửa thẳng) thì hiện. `flow_audit_ql_sua` kiểm: sau khi duyệt phần tiền không còn nút thêm nào hiện; khi Sửa thẳng có đủ 5 nút.
- [ ] **Step 6: Chạy `flow_audit_ql_sua&che=direct`, `flow_audit_ql_sua`, `flow_auto51`, `flow_ds86`, `flow_ds110`, `flow_unified98`, `flow_kt118` (máy tính + điện thoại)** → audit chỉ còn FAIL ở Bàn giao (làm ở Task 6), các flow cũ vẫn ✓ (flow_unified98 nếu đã FAIL từ trước bước này thì ghi rõ, không tính là do bước này).
- [ ] **Step 7: Commit** — "Bước 119: Chủ Sửa thẳng sửa được khách nợ; không khoá nhầm ô của mục chưa duyệt".

### Task 5: Quản lý được "Sửa thẳng" như Chủ

**Files:**
- Modify: `supabase/101_ql_sua_phieu.sql` (phần 5)
- Modify: `docs/js/pages/phieu_ca.js:216` (`DIR` chỉ khi `LK?.is_chu`), hộp "Sửa phần tiền" (`:1565-1585`, nút Sửa thẳng chỉ khi `isChu`)
- Modify: `kiem_tra/audit_tien/t04_sua_thang.sql` (ý d đổi kỳ vọng)

**Interfaces:**
- Consumes: Task 4 (`app__ca_direct_guard`, 7 hàm khách nợ).
- Produces: `app_ca_recon_direct` bỏ điều kiện `system_role = 'chu'` (chỉ cần `app__need('doi_soat')`); nếu `p_items` có mục web **tự đối soát** (`shift_report_checks.auto = 1`) mà không phải Chủ → `raise exception 'Mục này web đã tự đối soát — chỉ Chủ mở khoá được.'`. 7 hàm khách nợ (Task 4) cho qua mọi tài khoản có `doi_soat` thay vì chỉ Chủ. `app_ca_auto_locks` thêm khoá `can_direct boolean` (= có `doi_soat`); giao diện dùng `LK.can_direct` thay `LK.is_chu` cho Sửa thẳng (giữ `is_chu` cho "Mở khoá" và "Mở lại cả phiếu").

- [ ] **Step 1:** Sửa t04 ý d thành: quản lý (không phải Chủ) Sửa thẳng mục `cong_no` → thành công; Sửa thẳng mục tự đối soát → lỗi "chỉ Chủ mở khoá". Chạy → FAIL.
- [ ] **Step 2:** Viết phần 5 theo Interfaces; chạy thử tệp 101 + t04 trong khối tự hoàn tác → PASS.
- [ ] **Step 3:** Giao diện theo Interfaces; giả lập `sb_gia.js` role `ql` thêm quyền `doi_soat` (để bộ chạy thử có quản lý thật); chạy `flow_audit_ql_sua&role=ql&che=direct` (máy tính + điện thoại) → không còn ô khoá (trừ mục tự đối soát).
- [ ] **Step 4: Commit** — "Bước 119: quản lý được Sửa thẳng như Chủ (trừ mục web tự đối soát)".

### Task 6: Quản lý sửa Bàn giao và ảnh phiếu Fabi ở bước Kiểm tra

**Files:**
- Modify: `supabase/101_ql_sua_phieu.sql` (phần 6)
- Modify: `docs/js/pages/phieu_ca.js:227` (`edSharedT` / `edSharedN` ở bước Kiểm tra), ô ảnh Fabi `:320-323`, khung Bàn giao
- Create: `kiem_tra/audit_tien/t05_ban_giao_anh.sql`
- Modify: `kiem_tra/trinh_duyet/flow_audit_ql_sua.js` (đưa "Bàn giao ca sau" lại vào danh sách bắt buộc; thêm "Ảnh phiếu Fabi" = có nút 📷)

**Interfaces:**
- Produces (máy chủ, hàm web mới, cấp `authenticated`):
  - `app_ca_recon_handover_save(p_id bigint, p_items jsonb, p_reason text) returns jsonb` — `p_items` = `[{id|null, content}]`, cùng quy tắc với nhánh `handover` của `app__ca_save_core` (`98_chot_ca_doi_soat_chung.sql:84-93`): xoá dòng không còn trong danh sách (chỉ dòng `task_id is null`), sửa nội dung, thêm mới; trả `{"ids": [...]}`. Cần `app__need('doi_soat')`, phiếu `hoan_thanh`, lý do bắt buộc khi có thay đổi; mỗi thay đổi ghi `shift_recon_log(action 'sua', field 'handover', before, after)`. Ca đã hoàn thành: quản lý (Sửa thẳng) cũng sửa được — không đổi số tiền nên không cần `app__ca_direct_guard`.
  - `app_ca_recon_photo_add(p_id bigint, p_path text, p_reason text) returns bigint` và `app_ca_recon_photo_del(p_photo bigint, p_reason text) returns void` — chỉ `kind = 'ipos'`, cần `doi_soat`, phiếu `hoan_thanh`, lý do bắt buộc, ghi `shift_recon_log` (field `photo_ipos`). Không cho xoá ảnh cuối cùng (phiếu luôn còn ít nhất 1 ảnh Fabi). Tải ảnh dùng kho `BUCKET` sẵn có (`app__storage_ca_upload` phải cho người có `doi_soat` ghi vào thư mục của phiếu — kiểm và sửa nếu cần).
- Produces (giao diện): ở bước Kiểm tra, khung Bàn giao sửa được (ô nội dung, + thêm, xoá) và lưu bằng `app_ca_recon_handover_save` với lý do ở ô `#rc-reason`; ô ảnh Fabi có nút 📷 thêm ảnh + nút xoá từng ảnh, gọi 2 hàm ảnh mới.

- [ ] **Step 1: Viết `t05_ban_giao_anh.sql`** (tự hoàn tác, quản lý): a) sửa nội dung 1 dòng bàn giao + thêm 1 dòng → `handover_items` đúng, log 1 dòng `handover`; b) không lý do → lỗi; c) dòng đã giao thành việc (`task_id` có) không bị xoá; d) thêm ảnh rồi xoá ảnh vừa thêm → thành công, log 2 dòng; xoá ảnh Fabi cuối cùng → lỗi. Chạy → FAIL (hàm chưa có).
- [ ] **Step 2:** Viết phần 6; chạy thử tệp 101 + t01…t05 trong khối tự hoàn tác → PASS.
- [ ] **Step 3:** Giao diện + giả lập (`ca_gia.js`) 3 hàm mới; chạy `flow_audit_ql_sua` (chu và ql, máy tính + điện thoại) → PASS hết, không tràn ngang.
- [ ] **Step 4: Commit** — "Bước 119: quản lý sửa Bàn giao và ảnh phiếu Fabi ở bước Kiểm tra".

### Task 7: "Đổi thành Khách CK rút tiền mặt" cho dòng Khách mượn / Nợ tiền mặt

**Files:**
- Modify: `supabase/101_ql_sua_phieu.sql` (phần 7)
- Modify: `docs/js/pages/phieu_ca.js` (dòng nợ `debtRowDs` — nút mới cho `kind = 'muon'`; xử lý bấm)
- Create: `kiem_tra/audit_tien/t06_muon_thanh_rut_tm.sql`
- Modify: `kiem_tra/trinh_duyet/flow_audit_ql_sua.js` hoặc tạo `flow_audit_muon_rut.js`

**Interfaces:**
- Consumes: Task 4/5 (`app__ca_direct_guard`, quyền khách nợ của quản lý), cách ghi cặp đổi tiền đang có (`exchange_key` uuid, 2 dòng `tien_mat −x` / `chuyen_khoan +x` cùng note; `app__ca_validate_exchanges`, `app__ca_exchange_cats`).
- Produces: `app_ca_recon_debt_to_exchange(p_report bigint, p_debt bigint, p_reason text) returns void` (cấp `authenticated`):
  - Cần `doi_soat`, lý do bắt buộc, tháng chưa chốt; khoản nợ phải thuộc phiếu này (`report_id = p_report`) và `kind = 'muon'`.
  - Nếu khoản đã được thu ở ca khác (`closed_report_id` có): mục `tien_mat` / `chuyen_khoan` (theo `collect_kind`) của ca đó **đã duyệt** → từ chối "Ca … đã duyệt <mục> — mở lại mục đó trước"; chưa duyệt → bỏ khoản thu (như `app_ca_recon_debt_uncollect`), ghi `shift_recon_log` ở ca đó (`field 'debts'`, lý do).
  - Xoá khoản nợ (gộp phần tách `split_from` nếu có), thêm cặp đổi tiền vào `moves` của bản kiểm tra ca này (tạo bản kiểm tra từ `app__recon_snapshot` nếu chưa có), note `'Khách CK rút tiền mặt – ' || table_name`, gọi `app__ca_exchange_cats`, ghi `shift_recon_log` ở ca này.
  - Mục `cong_no` / `thu_chi` ca này đang khoá (đã duyệt hoặc web tự đối soát) → theo đúng quy tắc khoá hiện có (quản lý: Mở lại phần tiền hoặc Sửa thẳng; mục tự đối soát: Chủ mở khoá trước). Gọi `app__ca_direct_guard` cho ca này.
- Produces (giao diện): dòng nợ "Khách mượn" ở bước Kiểm tra có nút "Đổi thành Khách CK rút tiền mặt" (dùng lý do ở `#rc-reason`, hỏi xác nhận trong trang nếu khoản đã được thu ở ca khác: "Khoản này đã ghi khách trả CK ở ca …, web sẽ bỏ khoản trả đó").

- [ ] **Step 1: Viết `t06_muon_thanh_rut_tm.sql`** (tự hoàn tác, dựng tình huống giống LHP 09/11: ca A có nợ `muon` 500.000, ca B thu khoản đó bằng CK): sau khi gọi hàm → ca A `tm_left` không đổi, `ck_left` giảm 500.000; ca B `col_ck` giảm 500.000; `shift_debts` không còn khoản; ca A có đúng 1 cặp `exchange_key`; log ở cả 2 ca. Thêm: ca B đã duyệt mục chuyển khoản → lỗi; không lý do → lỗi. Chạy → FAIL (hàm chưa có).
- [ ] **Step 2:** Viết phần 7; chạy thử tệp 101 + t01…t06 trong khối tự hoàn tác → PASS.
- [ ] **Step 3:** Giao diện + giả lập; flow bấm nút trên ca có nợ "Khách mượn" (máy tính + điện thoại) → dòng nợ biến mất, thấy dòng "Khách CK rút tiền mặt", bảng tiền đổi đúng.
- [ ] **Step 4: Commit** — "Bước 119: đổi Khách mượn thành Khách CK rút tiền mặt ngay ở bước Kiểm tra".
- [ ] **Step 5: Sửa nút "Bỏ" khoản khách trả** (`phieu_ca.js:1411-1417`, nút `data-qlno-undo` vẽ ở `:441` và `:1253`): đang gọi `app_ca_recon_debt_uncollect` **thiếu `p_reason`** → máy chủ luôn từ chối. Đổi sang lấy lý do `rcWhyVal()` (thiếu thì hiện ô lý do như `paidDebtDelete`). Flow bấm "Bỏ" có lý do → khoản nợ quay lại "còn nợ".
- Dòng nợ "đã thu" giữ link "Đã thu ở ca … ›" (`phieu_ca.js:1291-1295`) để quản lý tìm tới phiếu đã thu mà huỷ (anh Tiến đồng ý cách này 17/11).
- **Không sửa dữ liệu LHP 09/11** — anh Tiến tự sửa sau khi lên web.

### Task 8: Chạy thật, đưa lên web, ghi sổ

**Files:**
- Modify: `docs/version.json`, `docs/js/app.js` (ASSET_VERSION), `docs/index.html` (importmap + script), các `?v=` trong `docs/js/chot_ca_moi.js`, `docs/js/pages/phieu_ca.js`
- Modify: `tai_lieu/TINH_NANG_DA_CHOT.md` (mục 119), `kiem_tra/trinh_duyet/README.md` (dòng `flow_audit_ql_sua`, `kiem_tra/audit_tien/`)

- [ ] **Step 1:** Xem lại `app_migrations` (không có 101 của ai khác) → chạy thật `supabase/101_ql_sua_phieu.sql`.
- [ ] **Step 2:** Chạy lại t01…t06 trên máy chủ thật → 6 PASS (t02: `so_ca_..._31_ngay: 0`).
- [ ] **Step 3:** Tăng phiên bản ở mọi chỗ `?v=` cùng một số (`2026.11.17.1` hoặc số kế tiếp), chạy `flow_kt118`, `flow_audit_ql_sua` lần cuối.
- [ ] **Step 4:** Commit + push `main`; ghi `app_releases` (version ngày 17/11, `added`/`changed`/`fixed` tiếng Việt, `released_at now()`, `released_by 'Tien Do'`) — chạy thử trong khối tự hoàn tác trước.
- [ ] **Step 5:** Xoá mã `sbp_` khỏi máy, nhắc anh Revoke.
