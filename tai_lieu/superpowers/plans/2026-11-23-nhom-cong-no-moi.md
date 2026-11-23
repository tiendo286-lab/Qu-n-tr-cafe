# Chặng 6.4 — 4 nhóm công nợ + nợ khách không cần tên — Kế hoạch làm

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (anh Tiến chọn tự làm inline, tiết kiệm). Steps use checkbox (`- [ ]`).

**Goal:** Thêm nhóm công nợ `chu` (Chủ — anh Tiến), đổi tên hiển thị `khac` → "Người nhà / người quen", nợ khách hàng gắn người chung "Khách" + ghi chú, không cần quản lý Xếp; chuyển dữ liệu cũ.

**Architecture:** Một tệp máy chủ `166_nhom_cong_no_chu.sql` (sinh bằng kịch bản lấy bản hàm đang chạy rồi thay chữ có kiểm số lần khớp, như các tệp trước) + sửa web (một nguồn tên nhóm chung ở `docs/js/ca_chung.js`) + máy chủ giả trong `kiem_tra/trinh_duyet` + bài thử mới.

**Tech Stack:** Postgres plpgsql (Supabase), JS thuần ES modules, Playwright (`scratchpad/pwv`) chạy `kiem_tra/trinh_duyet/chay_pw.py`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-23-nhom-cong-no-moi-design.md`

## Global Constraints
- Mã nhóm: `khach` · `kho` · `chu` · `khac`; thứ tự hiện ① Khách hàng ② Kho tổng ③ Chủ (anh Tiến) ④ Người nhà / người quen.
- Nhãn dài: `① Nợ khách hàng`, `② Nợ kho tổng`, `③ Nợ của Chủ (anh Tiến)`, `④ Người nhà / người quen`; nhãn ngắn: `Nợ khách hàng`, `Nợ kho tổng`, `Chủ (anh Tiến)`, `Người nhà / người quen`.
- `family` = 0 chỉ khi `khach`; nhóm lạ vẫn về `khach` (giữ an toàn cũ) nhưng `chu` phải được nhận ở MỌI chỗ đang kiểm danh sách nhóm.
- Không đổi quyền, không đổi cách tính tiền / Sổ quỹ. Vùng khoá: `app_ca_recon_apply` chỉ thêm `'chu'` vào danh sách; `app__stc_ds_missing` + web mục `phanloai` bỏ qua khoản `khach`.
- Tệp máy chủ: chạy lại nhiều lần không lỗi; dòng cuối `insert into public.app_migrations(file) values ('166_nhom_cong_no_chu.sql') on conflict (file) do nothing;`. Bảng mới: không có.
- Tài liệu / SQL / bài thử công khai: không ghi tên thật người nợ (chỉ mã). Ảnh gửi anh: tên giả.
- Không đẩy `main`, không chạy thật máy chủ cho tới khi anh duyệt ảnh.

## Review Focus
1. Khoản nợ nhóm `chu` bị trigger / hàm nào đó đổi về `khach` → phiếu chốt ca nhắc nhân viên thu nợ của anh. (Task 1 bài thử C2, C3.)
2. Khoản nợ khách do quản lý ghi ngoài ca (Công nợ › + Ghi nợ khách, tên "bàn 5") bị máy chủ từ chối "chưa có trong danh sách". (Task 1 bài thử C5.)
3. Khoản khách trả một phần → khoản còn lại (rest_of) mất người chung / thành chưa xếp → chặn Hoàn thành. (Task 1 bài thử C7.)
4. Người chung "Khách" bị ngừng dùng / đổi nhóm / đổi tên ở Sổ chi › Người nợ. (Task 1 bài thử C8.)
5. Chạy tệp 166 lần hai làm lặp ghi chú hoặc tạo thêm người "Khách". (Task 1 bài thử C9.)

---

### Task 1: Tệp máy chủ 166 + bài thử chạy thử tự hoàn tác

**Files:**
- Create: `scratchpad/sinh_166.py` (kịch bản sinh tệp, không lưu git), `supabase/166_nhom_cong_no_chu.sql`, `kiem_tra/nhom_cong_no_166.sql`, `scratchpad/buoc_166.py` (chạy thử / chạy thật như `buoc_165.py`).

**Interfaces — Produces:**
- `public.app__khach_person(p_branch bigint) returns bigint` — id người nợ chung "Khách" nhóm `khach` của cơ sở (tạo nếu chưa có; dùng lại người tên "Khách" đang có, bật active=1). Không cấp quyền web.
- `app_stc_month` → mỗi khoản nợ của ca có `sorted = sorted_at is not null or grp = 'khach'`.
- `app_stc_people` / `app_ca_debt_people` trả thêm người nhóm `chu`; `app_stc_people` thêm cờ `'shared': true` cho người chung "Khách" (web khoá sửa như "Kho tổng").

- [ ] **Step 1: Viết bài thử `kiem_tra/nhom_cong_no_166.sql`** (khối `DO $test$ … RAISE EXCEPTION 'REPORT>> ĐẠT %'` như tệp 165; dựng cơ sở thử riêng). Các tình huống:
  - C1 `app__khach_person(br)` gọi 2 lần → cùng id, `grp='khach'`, `name='Khách'`.
  - C2 insert nợ `grp='chu'` → còn `chu`, `family=1`; update `family` 1→1 không đổi nhóm.
  - C3 `app_stc_debt_sort(d, người_chu, 'chu')` thành công; `app_cn_person_save`, `app_stc_person_save`, `app_tc_move_to_debt`, `app_stc_ca_debt_save`, `app_cn_debt_save` nhận `'chu'` (không lỗi "Chọn nhóm").
  - C4 nợ phiếu ca `grp='khach'`, `table_name='bàn 5'` → `person_id = app__khach_person(br)`, `table_name` vẫn `'bàn 5'`.
  - C5 `app_cn_debt_save` (ngoài ca) `grp='khach'`, name `'bàn 7'` → không lỗi, gắn người chung.
  - C6 `app__stc_ds_missing(rid)` không còn dòng "chưa xếp" khi ca chỉ có nợ `khach`; có khi có nợ `khac` chưa xếp.
  - C7 khách trả một phần (`app_ca_debt_collect_part` hoặc `app_cn_debt_collect`) → khoản còn lại cùng `person_id` chung, vẫn `khach`.
  - C8 `app_stc_person_save` đổi tên / ngừng dùng / đổi nhóm người chung "Khách" → lỗi; tạo người mới nhóm `khach` → lỗi "Nợ khách hàng không cần tên".
  - C9 chạy lại phần chuyển dữ liệu lần 2 → số người "Khách" mỗi cơ sở = 1, ghi chú không lặp.
- [ ] **Step 2: Chạy thử bài thử khi chưa có tệp 166** (`python3 scratchpad/buoc_166.py thu` với hàm rỗng) → Expected: FAIL ở C1 (`app__khach_person` không tồn tại).
- [ ] **Step 3: Viết `sinh_166.py`** lấy `pg_get_functiondef` các hàm đang chạy, thay chữ (mỗi lần thay `assert count == 1`), ghép thành tệp 166 gồm:
  - `app__khach_person` mới (security definer, `revoke all … from public, anon, authenticated`).
  - `'khach', 'kho', 'khac'` → `'khach', 'kho', 'chu', 'khac'` trong: `app__debt_grp_sync`, `app__ca_save_core` (2 chỗ), `app_ca_recon_apply`, `app_cn_debt_save`, `app_cn_person_save`, `app_stc_ca_debt_save`, `app_stc_debt_sort`, `app_stc_person_save`, `app_tc_move_to_debt`; `app_stc_people` thứ tự `array['khach','kho','chu','khac']`; `app_ca_debt_people` `p.grp in ('kho','chu','khac')`.
  - `app__debt_person_guard`: nhánh mới trước tra tên — `if coalesce(new.grp,'khach') = 'khach' then new.person_id := app__khach_person(new.branch_id); new.table_name := coalesce(nullif(nm,''),'Khách'); (giữ luật sorted cũ) return new; end if;`.
  - `app__stc_ds_missing`: thêm `and coalesce(g.grp,'khach') <> 'khach'` vào điều kiện đếm chưa xếp.
  - `app_stc_month`: `'sorted', g.sorted_at is not null or g.grp = 'khach'`.
  - `app_stc_debt_sort`: `p_grp = 'khach'` → bỏ qua `p_person`, dùng người chung, `table_name` giữ chữ cũ (không đè bằng tên người).
  - `app_stc_person_save`: chặn người chung (như "Kho tổng"); tạo / đổi sang nhóm `khach` cho người khác → `raise 'Nợ khách hàng không cần tên — ghi chú ở khoản nợ.'`.
  - Chuyển dữ liệu (chạy lại được): (1) gọi `app__khach_person` mọi cơ sở; (2) mọi khoản `grp='khach'` → `person_id` = người chung, `table_name` giữ; (3) người nợ `grp='khach'` ≠ người chung → `active=0`; (4) người mã 17 → `grp='chu'`, `update shift_debts set grp='chu' where person_id=17`; (5) khoản 26, 29 → `grp='khac'`, `person_id`/`table_name` = người của khoản 69, ghi `content` = tên cũ nếu trống. Mọi `update` có `where … is distinct from` để chạy lại không đổi gì.
  - Dòng cuối ghi `app_migrations`.
- [ ] **Step 4: Chạy thử trên máy chủ (tự hoàn tác)** `python3 scratchpad/buoc_166.py thu` → Expected: `REPORT>> ĐẠT 9/9`, kèm đếm trước / sau: tổng tiền nợ mở mỗi cơ sở không đổi; nhóm `chu` = 4 khoản 27.909.000; nhóm `khach` không còn khoản nào thiếu người.
- [ ] **Step 5: Commit** `supabase/166_nhom_cong_no_chu.sql`, `kiem_tra/nhom_cong_no_166.sql`.

### Task 2: Tên nhóm chung + trang Công nợ + Sổ chi › Người nợ

**Files:** Modify `docs/js/ca_chung.js:19`, `docs/js/nguoi_no_chon.js:8`, `docs/js/doi_soat_tc.js:9,88`, `docs/js/pages/cong_no.js` (14–16, 23, 86–113, 135–160, 194), `docs/js/pages/so_thu_chi.js` (870–908, 1130–1137).

**Interfaces — Produces:** trong `ca_chung.js`: `export const DEBT_GRP` (nhãn dài 4 nhóm), `export const DEBT_GRP_SHORT` (nhãn ngắn), `export const DEBT_GRPS = ['khach','kho','chu','khac']`. Các tệp khác import thay bản sao riêng (`GRP`, `GRP_SHORT`, `GRP_NO` thành bí danh của 2 hằng này).

- [ ] Step 1: Bài thử `kiem_tra/trinh_duyet/flow_nhom64.js` phần A (viết trước, chạy thấy hỏng): Công nợ có 4 ô tổng đúng thứ tự + nhãn; nhóm ① chỉ một dòng "Khách" mở ra thấy từng khoản kèm ghi chú (`bàn 5`…); "+ Ghi nợ khách" không có ô chọn người, có ô ghi chú bắt buộc; Sổ chi › Người nợ: ô nhóm không có "Nợ khách hàng", người chung "Khách" không có nút Sửa.
- [ ] Step 2: Sửa web: `keyOf` gom mọi khoản `khach` vào một khoá `khach|khách` tên "Khách"; dòng chi tiết hiện `r.name` làm ghi chú; hộp Ghi nợ nhóm `khach` → ô "Ghi chú (khách / bàn…)" gửi làm `name`; `GRP_HELP.chu = 'nợ của anh Tiến — chỉ quản lý thu, không nhắc ở phiếu chốt ca'`.
- [ ] Step 3: Máy chủ giả (`stc_gia.js` 624/641/661, `ca_gia.js`, `stc_fixture.js`): nhận `chu`, có người chung "Khách" (`shared`), khoản `khach` `sorted: true`. Chạy `flow_nhom64` A máy tính + `--phone` → ĐẠT.
- [ ] Step 4: Commit.

### Task 3: Phiếu chốt ca — nút Nợ khách / Nợ khác

**Files:** Modify `docs/js/chot_ca_moi.js` (115, 255–256, 394, 567, 578–579), nhãn ở `docs/js/pages/phieu_ca.js` (185, 542, 1573, 1827, 2022).

- [ ] Step 1: `flow_nhom64` phần B (viết trước, thấy hỏng): mỗi khoản nợ mới có 2 nút `Nợ khách` / `Nợ khác` (aria-pressed); Nợ khách: ô "Khách / bàn…" bắt buộc, lưu gửi `grp:'khach'`; Nợ khác: ô chọn người (Kho tổng, Chủ, người nhà) không bắt buộc + ô ghi chú bắt buộc, lưu gửi `grp:'khac'` (hoặc nhóm của người đã chọn); thiếu ghi chú → báo "Khoản nợ nào cũng phải có ghi chú (khách / bàn / ai nợ) và số tiền."
- [ ] Step 2: Sửa `chot_ca_moi.js` (dòng mới mặc định Nợ khách); nhãn phieu_ca.js dùng `DEBT_GRP`.
- [ ] Step 3: Chạy `flow_nhom64` B (role nv + ql, máy tính + điện thoại) → ĐẠT; chạy lại các bài phiếu chốt ca đang có trong bộ (`flow_unified98`, `flow_bn133`, `flow_hn142`) → ĐẠT.
- [ ] Step 4: Commit.

### Task 4: Bước 1 trang đối soát ca (VÙNG KHOÁ)

**Files:** Modify `docs/js/pages/so_thu_chi.js` (112–152 handler, 1355–1380 `rowMoi`/`sortUi`, 1436, 1602 `phanloai`).

- [ ] Step 1: `flow_nhom64` phần C (viết trước, thấy hỏng): ca có 1 nợ khách + 1 nợ khác chưa xếp → khoản khách hiện `✓ Nợ khách hàng · bàn 5` + nút `Đổi nhóm`, không có nút Xếp; khoản khác có ô nhóm chỉ ②③④ + người + Xếp; mục `phanloai` chưa tích; Xếp khoản khác vào `chu` → mục `phanloai` tích, Hoàn thành mở; `Đổi nhóm` khoản khách → chọn ③ + người → Xếp → khoản thành `chu`; đổi ngược về ① không cần chọn người.
- [ ] Step 2: Sửa `sortUi`: `x.grp==='khach' && x.sorted` → nhãn + `Đổi nhóm` (dùng lại `data-dsortedit`); ô nhóm khi xếp: ②③④ (+ ① khi đang đổi nhóm); chọn ① ẩn ô người, gửi `p_person` = null. Mục `phanloai` chữ: `'Nợ khác của ca đã phân loại (Chủ / Người nhà / Kho tổng)'`.
- [ ] Step 3: Chạy `flow_nhom64` C (chu / qlt / ql × máy tính, chu điện thoại) → ĐẠT; chạy bộ vùng khoá: `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6` (chu ×2, qlt, ql), `flow_stc7` (chu/qlt/ql + chu điện thoại), `flow_dsca` (chu ×2, ql), cùng `flow_ds172`, `flow_ds168`, `flow_phieu63d`, `flow_thuno63c`, `flow_stc2`, `flow_stc12` → tất cả ĐẠT (runner `chay_nhom64.sh` kiểu `chay_khoa63d.sh`).
- [ ] Step 4: Commit.

### Task 5: Tài liệu + ảnh cho anh

- [ ] Cập nhật `TINH_NANG_DA_CHOT.md` (mục Công nợ / chặng 6), `BAN_GIAO.md`, `kiem_tra/trinh_duyet/README.md`, CLAUDE.md vùng khoá (thêm `app__stc_ds_missing` phần nợ khách, `sortUi` Đổi nhóm).
- [ ] Chụp ảnh (tên giả): Công nợ 4 ô, phiếu chốt ca 2 nút, bước 1 Đổi nhóm / Xếp → trang artifact gửi anh duyệt.
- [ ] Commit + đẩy nhánh `chang6-nhom-cong-no` (không đẩy main).

### Sau khi anh duyệt ảnh (không thuộc kế hoạch tự làm)
Chạy thật tệp 166 (`buoc_166.py that`, có chốt chặn) → kiểm lại → tăng bản web → đẩy main → `app_releases` → xem web thật.
