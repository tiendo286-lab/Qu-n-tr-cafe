# Ghi chú sửa thu chi — Kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mỗi khoản Thu / Chi bị Chủ / quản lý thêm, sửa, xoá có ghi chú trên bước Kiểm tra và trên phiếu nhân viên.
**Architecture:** Máy chủ tính danh sách dòng + ghi chú (`app__ca_move_notes`), `app_ca_get` trả `move_notes`; giao diện `phieu_ca.js` vẽ ghi chú.
**Tech Stack:** plpgsql (Supabase), JS thuần, bộ chạy thử `kiem_tra/trinh_duyet/`.
**Spec:** `tai_lieu/superpowers/specs/2026-11-17-ghi-chu-sua-thu-chi-design.md`

## Global Constraints
- Tệp `supabase/102_ghi_chu_sua_thu_chi.sql`, hàm thay thế lấy từ bản đang chạy (`pg_get_functiondef`), dòng cuối `insert into public.app_migrations(file) values ('102_ghi_chu_sua_thu_chi.sql') on conflict (file) do nothing;`.
- Hàm nội bộ `app__…` revoke khỏi `public, anon, authenticated`.
- Máy tính + điện thoại 390px không tràn ngang. Commit `Tien Do`, Co-Authored-By.

## Review Focus
1. Cặp "Khách CK rút tiền mặt" (2 bút toán) phải là 1 dòng, không thành 2 dòng thêm/xoá. Test: t07.
2. Sửa rồi sửa lại về như cũ → không ghi chú. Test: t07.
3. Hai dòng giống hệt nhau (cùng loại, số, nội dung), xoá 1 → còn 1 giữ, 1 xoá. Test: t07.
4. Phiếu chưa có bản kiểm tra → `move_notes` toàn "giu" / rỗng, phiếu nhân viên hiện như cũ. Test: t07.
5. Phiếu đang chốt (chưa gửi) → không có `move_notes`. Test: t07.

### Task 1: Máy chủ — `app__ca_move_notes` + `app_ca_get.move_notes`
**Files:** Create `supabase/102_ghi_chu_sua_thu_chi.sql`, `kiem_tra/audit_tien/t07_ghi_chu_thu_chi.sql`.
**Interfaces — Produces:**
- `app__ca_move_lines(p jsonb) returns jsonb` — mảng `{kind, amount, note}` theo thứ tự; bỏ dòng có `auto`; cặp cùng `exchange_key` → 1 dòng `{kind:'doi_tien', amount: |x|, note}`.
- `app__ca_move_notes(p_id bigint) returns jsonb` — `[]` khi chưa có bản kiểm tra; ngược lại mảng dòng theo thứ tự hiện tại rồi tới dòng xoá: `{type:'giu'|'sua'|'them'|'doi'|'xoa', kind, amount, note, before?:{kind,amount,note}|{kind:'muon',amount,table_name}, by, at, reason}`.
- `app_ca_get(p_id)` thêm khoá `move_notes` (= `app__ca_move_notes`) khi `status = 'hoan_thanh'`, `null` khi chưa gửi.
- [ ] t07 (tự hoàn tác, Chủ): dựng phiếu đã gửi có moves gốc [Chi TM −150.000 "Mua đá", Chi TM −30.000 "Mua giấy", Chi TM −30.000 "Mua giấy", Chi TM −20.000 "Mua chanh", cặp đổi tiền 200.000 "Khách A"], lưu bản kiểm tra (app_ca_recon_save, lý do "gõ nhầm") thành [−100.000 "Mua đá", −30.000 "Mua giấy" (1 dòng), −20.000 "Mua chanh", cặp đổi tiền giữ nguyên, Thu CK +50.000 "Hoàn tiền"] → kỳ vọng: Mua đá `sua` (before.amount −150000, reason "gõ nhầm", by không rỗng), Mua giấy 1 `giu` + 1 `xoa`, Mua chanh `giu`, đổi tiền 1 dòng `giu`, Hoàn tiền `them`; lưu lại Mua đá về −150.000 → Mua đá `giu`; phiếu không có bản kiểm tra → `[]`; `app_ca_get(id) ? 'move_notes'`.
- [ ] Chạy t07 → FAIL (hàm chưa có). Viết 102. Chạy 102 + t07 tự hoàn tác → PASS; t01–t06 vẫn PASS.
- [ ] Commit.

### Task 2: Giao diện + giả lập
**Files:** `docs/js/pages/phieu_ca.js` (bước Kiểm tra: ghi chú dưới dòng `#moves`, dòng xoá sau `#moves`, đếm "· N đã sửa"; phiếu nhân viên đã gửi: danh sách từ `move_notes` thay `#moves`, nhãn "Quản lý đã sửa N khoản thu chi"), CSS ghi chú (tím `.ds-ed` sẵn có; xanh, đỏ mới), `kiem_tra/trinh_duyet/ca_gia.js` (`app_ca_get.move_notes` giả lập theo cùng quy tắc), Create `kiem_tra/trinh_duyet/flow_audit_ghi_chu.js`.
**Interfaces — Consumes:** `R.move_notes` (Task 1). Hàm vẽ `moveNoteLine(n, staff: boolean)` trong `phieu_ca.js`.
- [ ] flow (Chủ): phiếu đã gửi, quản lý sửa Mua đá 150.000 → 100.000 (lý do), xoá 1 dòng, thêm 1 dòng → bước Kiểm tra có ghi chú ✎ / ✗ / ＋ đúng dòng; mở phiếu nhân viên (không `__ds`) → nhãn "Quản lý đã sửa 3 khoản thu chi", "Bạn ghi: 150.000", dòng xoá gạch ngang; không tràn ngang (máy tính + điện thoại). Chạy → FAIL.
- [ ] Làm giao diện + giả lập → PASS; chạy lại flow cũ (auto51, den, sua56, ds86, ds110, cn95, unified98, kt118, ck117, audit_*) → không hỏng.
- [ ] Commit.

### Task 3: Chạy thật, lên web, ghi sổ
- [ ] Kiểm `app_migrations` → chạy 102 thật → t07 trên máy chủ thật PASS.
- [ ] Tăng phiên bản (`2026.11.17.2`) mọi chỗ `?v=`; tài liệu `TINH_NANG_DA_CHOT.md` (mục 120), README; commit, push `main`, `app_releases`; xoá mã `sbp_`.
