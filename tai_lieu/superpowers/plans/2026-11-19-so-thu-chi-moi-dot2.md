# Sổ thu chi mới — Đợt 2 (sửa / thêm / xoá phiếu, người nợ ✓) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bật sửa / thêm / xoá phiếu thu chi trong Sổ thu chi mới: phiếu cũ gạch ngang + phiếu bổ sung của quản lý; người nợ có dấu ✓; khung Khách đang nợ có nút Thu nợ. Phần 2a là khoản ngoài ca; phần 2b là khoản thu chi của ca (đụng vùng khoá).

**Architecture:** Bảng mới `stc_edits` lưu mỗi lần thêm / sửa / xoá kèm bản chụp khoản cũ / mới và lý do. Hàm ghi `app_stc_*` bọc các hàm có sẵn (`app_fin_entry_save/delete`, `app_fund_transfer_save/delete`, `app_cn_debt_save/delete`, `app_cn_debt_collect/uncollect`) rồi ghi `stc_edits`. `app_stc_month` đọc `stc_edits` để trả khoản cũ dạng gạch ngang (`void`) và đánh dấu khoản mới là phiếu bổ sung (`sup` / `add`). Phần 2b thêm hàm sửa khoản thu chi của ca trong bản đối soát — **làm sau khi anh Tiến gõ mật khẩu vùng khoá**.

**Tech Stack:** như đợt 1 (Supabase plpgsql, JS thuần, jsc, Chrome giả lập).

**Spec:** `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md` mục 3.2, 3.5, 5 "Đợt 2". Đợt 1: `tai_lieu/superpowers/plans/2026-11-18-so-thu-chi-moi-dot1.md`.

## Global Constraints

- **Ai sửa được:** Chủ, Quản lý tổng, Quản lý cơ sở được giao cơ sở đó (`app__fin_can(branch)`). Nhân viên, Kế toán không sửa được.
- **Tháng đã chốt:** khoá. Máy chủ chặn bằng `app__fin_locked(branch, ngày)`.
- **Lý do:**
  - Sửa / xoá **bắt buộc** lý do (`'Ghi lý do sửa / xoá.'`).
  - Thêm khoản **ngoài ca** thì lý do không bắt buộc.
  - Thêm khoản **vào ca** thì bắt buộc lý do (2b).
- **Phiếu cũ** vẫn hiện trong sổ: gạch ngang, không cộng vào tổng. **Phiếu bổ sung** ghi người sửa, giờ, số cũ → mới, lý do.
- **Người nợ ✓:**
  - ✓ nghĩa là `grp` thuộc (`kho`, `khac`), web không nhắc thu ở phiếu chốt ca.
  - Bỏ ✓ thì `grp = 'khach'`.
  - "Kho tổng" luôn ✓.
- **CSDL:**
  - Tệp `supabase/129_so_thu_chi_sua.sql` (2a) và `130_so_thu_chi_sua_ca.sql` (2b). Kiểm số trước khi đặt; chạy lại được; dòng cuối ghi `app_migrations`.
  - Bảng mới không cấp quyền `anon` / `authenticated`.
  - Chạy thử tự hoàn tác trước khi chạy thật.
- **Trang:** vẫn chỉ Chủ và Quản lý tổng thấy trong lúc chạy song song. Nút sửa của khoản ca vẫn tắt cho tới khi xong 2b.
- **2b đụng vùng khoá "Mở để sửa" đối soát** (xem `CLAUDE.md`):
  - Trước khi sửa: dừng lại, nói rõ định sửa gì, xin anh Tiến gõ mật khẩu.
  - Sửa xong: chạy `kiem_tra/trinh_duyet/flow_ql_tu_ds.js` (role ql + chu, máy tính + điện thoại).
- **Phát hành:**
  - Mỗi lần đẩy `main`: tăng phiên bản, ghi `app_releases`.
  - Commit tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp có dòng `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Không dùng `$$(` trong lệnh shell. Sửa tệp bằng công cụ Edit.

## Review Focus

1. **Sửa một khoản nhiều lần:** chỉ bản mới nhất được cộng; mọi bản cũ đều gạch ngang theo thứ tự. → bài thử máy chủ T1 (sửa 2 lần).
2. **Xoá khoản đã có phiếu bổ sung:** cả chuỗi gạch ngang, tổng không còn khoản đó. → T1.
3. **Sửa luân chuyển:** hai vế cùng đổi, vẫn cân. → T1.
4. **Thu nợ quá số còn nợ / huỷ thu nợ:** hàm có sẵn chặn; huỷ thu nợ thì gạch ngang dòng thu nợ, khoản nợ mở lại. → T1.
5. **Quản lý cơ sở sửa cơ sở khác / tháng đã chốt:** bị chặn đúng chữ lỗi. → T1.

---

### Task 1 (2a): Máy chủ — bảng `stc_edits`, hàm ghi ngoài ca, người nợ ✓, `app_stc_month` hiện gạch ngang

**Files:** Create `supabase/129_so_thu_chi_sua.sql`, `kiem_tra/so_thu_chi_129.sql`.

**Interfaces — Produces:**
- Bảng `public.stc_edits(id bigserial pk, branch_id bigint, kind text, ref text, action text, old jsonb, new jsonb, reason text, by_account bigint, at text)`:
  - `kind` ∈ `entry | transfer | debt | collect | move`;
  - `action` ∈ `them | sua | xoa`;
  - `ref` = mã khoản đúng như `items[].id` (vd `e:12`, `t:5`, `dn:7`, `dc:7`, `m:<report>:<mkey>`).
- `app_stc_entry_save(p_id bigint, p jsonb, p_reason text) returns bigint`, `app_stc_entry_delete(p_id bigint, p_reason text) returns void`. Dữ liệu `p` cùng dạng `app_fin_entry_save`.
- `app_stc_transfer_save(p_id bigint, p jsonb, p_reason text) returns bigint`, `app_stc_transfer_delete(p_id bigint, p_reason text) returns void`. Dữ liệu `p` cùng dạng `app_fund_transfer_save`.
- `app_stc_debt_save(p_id bigint, p jsonb, p_reason text) returns bigint`: cho nợ ngoài ca; buộc `fund_out = true`, kind `muon | ck`. Đi kèm `app_stc_debt_delete(p_id bigint, p_reason text) returns void`.
- `app_stc_collect(p_debt bigint, p jsonb, p_reason text) returns void` (thu nợ ngoài ca, qua `app_cn_debt_collect`) và `app_stc_uncollect(p_debt bigint, p_reason text) returns void`.
- `app_stc_person_mark(p_branch bigint, p_name text, p_no_remind boolean) returns int`: đổi `grp` mọi khoản **đang mở** cùng tên. Tên "Kho tổng" luôn `kho`.
- `app_stc_month` (thay bản 127):
  - thêm các khoản `void: true` lấy từ `stc_edits.old` (sửa / xoá) trong tháng, kèm `void_info {action, by, at, reason, to}`;
  - khoản hiện tại có lần sửa / thêm mới nhất thì kèm `edit {action, by, at, reason, old_amount}`;
  - `people: [{name, no_remind, open, n}]`;
  - mỗi khoản thêm `can_edit` (khoản ngoài ca có nguồn `entry | transfer | debt | collect`, tháng chưa chốt).

- [ ] **Step 1: Viết bài thử** `kiem_tra/so_thu_chi_129.sql` (DO, vai Chủ, LHP, tháng hiện tại; kết thúc REPORT tự hoàn tác):
  - (a) thêm khoản chi 100.000 → `app_stc_month` có khoản `edit.action = 'them'`;
  - (b) sửa thành 120.000 (lý do "thử") rồi 150.000 → đúng 2 khoản `void` + 1 khoản hiện tại 150.000; tổng chi tiền mặt tăng đúng 150.000 so với lúc đầu;
  - (c) xoá → 3 khoản `void`, tổng chi bằng lúc đầu;
  - (d) sửa không lý do → lỗi `Ghi lý do sửa / xoá.`;
  - (e) thêm luân chuyển 1.000.000 rồi sửa 2.000.000 → vế vào = vế ra, 2 khoản `void`;
  - (f) cho nợ ngoài ca 50.000 → thu 20.000 → huỷ thu → 1 khoản thu nợ `void`;
  - (g) `app_stc_person_mark(LHP, 'Khách thử', true)` → khoản đang mở của tên đó có `grp = 'khac'`; `people` có `no_remind = true`;
  - (h) vai Quản lý cơ sở sửa khoản của cơ sở **không được giao** → lỗi; vai Nhân viên → lỗi.
- [ ] **Step 2: Chạy thử**, thấy lỗi "function app_stc_entry_save does not exist".
- [ ] **Step 3: Viết `129_so_thu_chi_sua.sql`.**
  - Hàm kiểm quyền chung `app__stc_need(branch) returns accounts`: Chủ / Quản lý tổng, hoặc `app__fin_can(branch)`; tài khoản không khoá; không thì báo `'Bạn không được sửa thu chi của cơ sở này.'`.
  - Mỗi hàm ghi: chụp khoản cũ (dạng `items[]`) → gọi hàm có sẵn → chụp khoản mới → ghi `stc_edits`.
  - Bản chụp dùng hàm nội bộ `app__stc_snap(kind, id) returns jsonb`.
- [ ] **Step 4: Chạy thử** 129 + bài thử (tự hoàn tác). Mọi mục a–h đúng. Thời gian `app_stc_month` vẫn < 1s.
- [ ] **Step 5: Chạy thật** 129; commit hai tệp.

### Task 2 (2a): Giao diện — bật sửa / thêm / xoá khoản ngoài ca, người nợ ✓, Thu nợ

**Files:** Modify `docs/js/pages/so_thu_chi.js`, `kiem_tra/trinh_duyet/stc_gia.js`, `kiem_tra/trinh_duyet/stc_fixture.js`; Create `kiem_tra/trinh_duyet/flow_stc2.js`.

**Interfaces — Consumes:** các hàm của Task 1; `items[].void`, `void_info`, `edit`, `can_edit`, `people`.

- [ ] **Step 1: Viết bài thử** `flow_stc2.js` (role chu, máy tính + 390px):
  - (1) khoản ngoài ca có nút **Sửa / Xoá** bấm được; khoản của ca vẫn tắt, ghi "Đợt sau";
  - (2) sửa số tiền + lý do → dòng cũ gạch ngang (`.stc-it.void`), dòng mới có nhãn "Phiếu bổ sung của quản lý", tổng đổi đúng;
  - (3) xoá → gạch ngang + "Đã xoá · lý do";
  - (4) sửa không lý do → báo "Ghi lý do sửa / xoá.";
  - (5) "+ Thêm phiếu" Ngoài ca, loại Khoản chi (nhóm bắt buộc) → khoản mới "thêm";
  - (6) khung **Người nợ**: bấm ✓ / bỏ ✓ thì chữ "không nhắc ở phiếu chốt ca" đổi theo;
  - (7) **Khách đang nợ** › Thu nợ (một phần) → khoản thu nợ mới ở Sổ thu, số còn nợ giảm;
  - (8) không tràn ngang ở 390px.
- [ ] **Step 2: Chạy**, thấy thất bại.
- [ ] **Step 3: Viết.**
  - Hộp thoại sửa / thêm theo mẫu artifact.
  - Gọi `rpc('app_stc_*')`, xong thì xoá bộ nhớ đệm `CACHE` rồi vẽ lại.
  - Giả lập `stc_gia.js` làm đúng như máy chủ trên bản sao dữ liệu: ghi `void` / `edit`, đổi `grp`.
- [ ] **Step 4: Chạy** `flow_stc2` + `flow_stc1` (không vỡ) ở máy tính + điện thoại, thấy đạt.
- [ ] **Step 5: Commit.**

### Task 3 (2b — VÙNG KHOÁ): Máy chủ — sửa / thêm / xoá khoản thu chi của ca

**Dừng trước Task 3:** báo anh Tiến danh sách việc dưới đây và xin mật khẩu vùng khoá. Không có mật khẩu thì không làm.

**Files:** Create `supabase/130_so_thu_chi_sua_ca.sql`, `kiem_tra/so_thu_chi_130.sql`.

**Interfaces — Produces:** `app_stc_move_save(p_report bigint, p_mkey text, p jsonb, p_reason text) returns text` (trả mkey mới), với:
- `p_mkey null` = thêm;
- `p = {kind: 'tien_mat'|'chuyen_khoan', amount (âm = chi), note, category_id}`;
- `p.delete = true` = xoá.

Quy tắc:
- Ca đã đối soát xong mục Tiền mặt + Chuyển khoản ("đã chốt tiền");
- Chủ / Quản lý tổng / Quản lý cơ sở được giao;
- lý do bắt buộc;
- tháng chưa chốt;
- chỉ sửa **bản đối soát** (phiếu nhân viên giữ nguyên);
- **không mở lại** mục tiền đã duyệt (giống "Chủ sửa thẳng" 5r4, mở rộng cho Quản lý cơ sở);
- ghi `stc_edits` (`kind = 'move'`) và nhật ký đối soát.

`app_stc_month` trả thêm `can_edit` cho khoản ca đã chốt tiền và khoản `void` cho khoản ca đã sửa / xoá.

- [ ] **Step 1: Viết bài thử** `kiem_tra/so_thu_chi_130.sql`:
  - sửa khoản chi của một ca đã đối soát → bản đối soát đổi, phiếu nhân viên không đổi, chênh lệch tiền mặt của ca đổi đúng phần chênh;
  - ca chưa đối soát → lỗi "Ca chưa chốt tiền";
  - Quản lý cơ sở được giao → được;
  - Nhân viên → lỗi;
  - thêm / xoá đúng;
  - các mục tiền đã duyệt **vẫn ở trạng thái đã duyệt**.
- [ ] **Step 2–5:** chạy thử thấy lỗi → viết → chạy thử đạt → chạy thật, commit.

### Task 4 (2b): Giao diện — bật sửa khoản ca + bài thử vùng khoá

**Files:** Modify `docs/js/pages/so_thu_chi.js`, `stc_gia.js`, `flow_stc2.js`.

- [ ] **Step 1: Thêm bài thử vào `flow_stc2`:**
  - khoản ca đã chốt có Sửa / Xoá;
  - ca chưa chốt vẫn khoá, ghi "Chốt tiền ca ở tab Đối soát tiền mới sửa được";
  - "+ Thêm phiếu vào ca" bắt lý do.
- [ ] **Step 2–4:** thấy thất bại → viết → đạt.
- [ ] **Step 5: Chạy `flow_ql_tu_ds`** (role ql và chu, `index.html` + `test/phone.html`), thấy đạt như trước. Commit.

### Task 5: Phát hành

- [ ] Chạy lại toàn bộ: jsc, `so_thu_chi_127/129/130.sql`, `flow_stc1`, `flow_stc2`, `flow_ql_tu_ds`.
- [ ] Tăng phiên bản (`2026.11.19.2`), ghi `TINH_NANG_DA_CHOT.md`, `BAN_GIAO.md`, README bài thử.
- [ ] Commit, đẩy `main`, ghi `app_releases`, báo anh Tiến, nhắc Revoke mã `sbp_`.
