# Người ngoài làm ca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ở mọi chỗ thêm người vào ca (chốt ca, đối soát ca, bảng Nghỉ & làm thay) chọn được 3 loại: nhân viên quán · nhân viên cũ · người ngoài.

**Architecture:** Người ngoài là một dòng `employees` gọn (`is_outsider = true`, `status = 'Ngừng làm'`, `rank = 'Người ngoài'`, `pay_cash = true`, không tài khoản) nên mọi hàm đang nối `shift_report_staff` với `employees` chạy nguyên. Không sửa hàm tính tiền / quyền nào. Giao diện dùng chung một mô-đun chọn người cho hai hộp thoại; chốt ca thêm nút thứ ba vào danh sách có sẵn.

**Tech Stack:** JS thuần (ES modules) trong `docs/js`, PL/pgSQL trong `supabase/`, bài thử Chrome với Supabase giả lập ở `kiem_tra/trinh_duyet`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-28-nguoi-ngoai-lam-ca-design.md`

## Global Constraints

- Không đổi cách tính tiền của ca, không đổi quyền sửa phần tiền (vùng khoá). Trả công người ngoài = khoản Chi ra "Chi lương + tên" như đang làm.
- Web không theo dõi nợ công (anh Tiến chốt cách 1).
- Tệp SQL chạy lại nhiều lần không lỗi; dòng cuối ghi `app_migrations`; hàm mới `revoke ... from public, anon`, `grant ... to authenticated`.
- Số tệp SQL: 200 nếu sổ tệp đã chạy chưa có 200 (xem lại ngay trước khi chạy thật).
- Không tràn ngang ở 390px. Chữ tiếng Việt, theo cách web đang viết.
- Chưa đẩy `main`, chưa chạy SQL thật khi anh Tiến chưa bảo.

## Review Focus

- Gõ lại tên người ngoài đã có (khác hoa / thường, thừa dấu cách) → dùng lại hồ sơ cũ, không tạo trùng.
- Tên trống / 1 ký tự / quá 60 ký tự → báo lỗi dễ hiểu, không tạo.
- Người ngoài đã có trong ca → không thêm lần hai.
- Người ngoài không hiện trong nhóm "Nhân viên cũ" và không hiện trong danh sách nhân viên đang làm.
- Máy chủ chưa chạy tệp 200 (web lên trước): nhóm Người ngoài rỗng, bấm thêm mới báo lỗi máy chủ, các nhóm khác vẫn chạy.

---

### Task 1: Máy chủ + bản giả lập

**Files:**
- Create: `supabase/200_nguoi_ngoai_lam_ca.sql`
- Modify: `kiem_tra/trinh_duyet/ca_gia.js` (`app_ca_helpers`, thêm 2 hàm)

**Interfaces — Produces:**
- `app_ca_helpers() → { active: Emp[], former: Emp[], outside: Emp[] }`, `Emp = { id, code, name, rank, pay_cash, branches: bigint[] }`; `former` không gồm người ngoài; `outside` = `is_outsider and status <> 'Đang làm'`.
- `app_ca_outsider_add(p_name text, p_phone text default null) → Emp & { existed: boolean }` — quyền `chot_ca`; tên 2–60 ký tự sau khi gọn dấu cách; sđt (nếu có) theo mẫu `^[0-9 +().-]{8,20}$`; trùng tên (`lower`, gọn dấu cách) trong người ngoài → trả hồ sơ cũ `existed = true`; mã `NG` + số nhỏ nhất chưa dùng (không trùng `employees.code` / `accounts.login_name`); khoá `pg_advisory_xact_lock` chống tạo đôi.
- `app_ca_outsider_rename(p_id bigint, p_name text) → void` — quyền `quan_ly_nhan_vien`; chỉ sửa dòng `is_outsider`.

- [ ] Viết tệp SQL (cột `is_outsider`, 3 hàm, quyền, dòng `app_migrations`).
- [ ] Bản giả lập trong `ca_gia.js` cùng giao kèo (kể cả lỗi tên ngắn, trùng tên).
- [ ] Commit.

### Task 2: Mô-đun chọn người dùng chung + hai hộp thoại

**Files:**
- Create: `docs/js/chon_nguoi_ca.js`
- Modify: `docs/js/pages/doi_soat_moi.js` (`staffAdd`), `docs/js/pages/duyet_x2.js` (`staffAdd`)

**Interfaces — Produces (`chon_nguoi_ca.js`):**
- `loadHelpers(): Promise<{active, former, outside}>` — gọi `app_ca_helpers` một lần, nhớ lại; lỗi thì ném ra.
- `pickerHtml(): html` — `select[name=loai]` (`in` Nhân viên trong quán · `old` Nhân viên cũ · `out` Người ngoài), `select[name=emp]`, và khối `[data-ngoai-moi]` gồm `input[name=ngoai_ten]`, `input[name=ngoai_sdt]` (chỉ hiện khi loại `out` và `emp` = `moi`).
- `wirePicker(form, helpers, have: Set<number>, branchId)` — đổ danh sách theo loại, bỏ người đã có trong ca, người của cơ sở lên trước; loại `out` có lựa chọn `moi` = "+ Người ngoài mới…".
- `pickedId(form): Promise<number>` — trả `employee_id`; với `moi` thì gọi `app_ca_outsider_add`; chưa chọn → ném "Chọn nhân viên."; tên trống → ném "Ghi tên người ngoài.".

- [ ] Viết mô-đun; thay ô chọn trong 2 hộp thoại; giữ nguyên phần giờ / ghi chú / lý do.
- [ ] Commit.

### Task 3: Chốt ca — nút thứ ba "Người ngoài"

**Files:** Modify `docs/js/chot_ca_moi.js`

- [ ] Thêm `data-hp="out"`; `HELP.outside`; danh sách một nhóm "Người ngoài đã từng làm"; ô lọc đồng thời là ô gõ tên mới; nút `#cm-out-new` "+ Thêm «tên» là người ngoài mới" hiện khi ô có ≥ 2 ký tự và không ai trùng đúng tên → gọi `app_ca_outsider_add`, thêm vào `HELP.outside` và vào ca.
- [ ] Sửa câu nhắc ở bước Tiền: "(người hỗ trợ, nhân viên cũ, người ngoài)".
- [ ] Commit.

### Task 4: Trang Nhân viên + bảng công

**Files:** Modify `docs/js/pages/nhan_vien.js`; xem `docs/js/bang_cong.js`

- [ ] Dòng `is_outsider`: nhãn "Người ngoài"; nút "Đổi tên" (gọi `app_ca_outsider_rename`) cho người có quyền `quan_ly_nhan_vien`.
- [ ] Bảng công: nếu dữ liệu có cấp bậc thì thêm chữ "(người ngoài)"; nếu không có thì ghi lại là chưa làm.
- [ ] Commit.

### Task 5: Bài thử + tài liệu

**Files:** Create `kiem_tra/trinh_duyet/flow_nn200.js`; Modify `kiem_tra/trinh_duyet/README.md`, `tai_lieu/TINH_NANG_DA_CHOT.md` (mục 5m-bổ sung 2), `docs/version.json`

- [ ] `flow_nn200`: chốt ca → 3 nút → Người ngoài → gõ tên mới → thêm → số người +1; gõ lại tên đó (khác hoa thường) → không tạo trùng, báo đã có trong ca; tên 1 ký tự → không có nút thêm; nhóm Nhân viên cũ không chứa người vừa tạo; trang đối soát ca → Thêm người hỗ trợ → loại Người ngoài → mới → lưu → có trong danh sách; không tràn ngang.
- [ ] Chạy `flow_nn200` + `flow_hl49` + `flow_dsm1` + bộ vùng khoá (`flow_ql_tu_ds` ql / chu, `flow_stc6`, `flow_stc7`, `flow_dsca`), máy tính + điện thoại.
- [ ] Ghi tài liệu, tăng số bản, commit.
