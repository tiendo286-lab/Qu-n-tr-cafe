# Tăng tốc Sổ quỹ + Chốt tháng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chốt tháng ~29s → ~2–4s, Sổ quỹ ~1,6s → < 1s, kết quả tiền giống hệt bản cũ.

**Architecture:** Thêm `app__fund_sum` dựng sổ quỹ 1 lượt/cơ sở và trả mọi tổng cần; `app__fin_full`, `app_fund_overview` dùng nó; `app_fin_overview` gọi `app__fin_full` 1 lần/cơ sở bằng vòng lặp plpgsql. Chỉ máy chủ, không đổi giao diện.

**Tech Stack:** Supabase Postgres plpgsql (SECURITY DEFINER), Management API, bài thử SQL tự hoàn tác.

**Spec:** `tai_lieu/superpowers/specs/2026-11-17-toc-do-so-quy-design.md`

## Global Constraints
- Tệp máy chủ mới `supabase/NNN_toc_do_so_quy.sql`, NNN = số kế tiếp sau `max` trong `app_migrations` **và** sau mọi tệp `supabase/1xx_*.sql` trên `origin/main` (phiên khác đang dùng 110, 111) — chọn ngay trước khi chạy thật. Dòng cuối `insert into public.app_migrations(file) values ('NNN_toc_do_so_quy.sql') on conflict (file) do nothing;`. Chạy lại nhiều lần không sao.
- Định nghĩa lại từ bản **đang chạy trên máy chủ** (`pg_get_functiondef`), không từ tệp cũ; kiểm tệp 110, 111 không đụng các hàm này.
- Hàm `app__*` mới: `revoke all … from public, anon, authenticated`.
- Không đổi `app__fund_rows`, `app__fin_calc`, `app__fund_balance` (nơi khác còn dùng).
- Commit `Tien Do <tiendo286@gmail.com>`, dòng cuối `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; ghi `app_releases`; không đổi `docs/version.json` (không đổi giao diện).

## Review Focus
1. Tháng có `d0 <= fund_start` (tháng 11/2026) → số đầu kỳ = tổng `fund_openings`, không tính từ sổ quỹ (t01 tháng 11).
2. Tháng sau ngày bắt đầu (12/2026) → số đầu kỳ = số dư ngày `d0 − 1` (t01 tháng 12).
3. Tháng trước ngày bắt đầu (10/2026) → `app__fund_rows` trả rỗng, số dư = `fund_openings` (t01 tháng 10).
4. Tài khoản không phải Chủ (QL tổng) gọi `app_fin_overview` → chỉ thấy cơ sở `app__fin_can` cho phép, như cũ (t01 so cả vai QL tổng nếu có tài khoản).
5. Cơ sở không có dòng sổ quỹ nào → số dư = `fund_openings` hoặc 0, không null (t01: so `is distinct from`).

---

### Task 1: Máy chủ — `app__fund_sum` + viết lại 3 hàm, so giống hệt

**Files:**
- Create: `supabase/NNN_toc_do_so_quy.sql`
- Test: `kiem_tra/toc_do/t01_so_quy_giong_het.sql`

**Interfaces — Produces:**
- `app__fund_sum(p_branch bigint, p_upto text, p_d0 text, p_d1 text) returns table(cash bigint, bank bigint, cash_before bigint, bank_before bigint, bu bigint, dep bigint, bin bigint)` — 1 lần `app__fund_rows(p_branch, app__fund_start(), p_upto)`; `cash`/`bank` = `fund_openings` theo method + tổng dòng `d <= p_upto`; `*_before` = `fund_openings` + tổng dòng `d < p_d0`; `bu`/`dep`/`bin` = tổng `typ` `bu_khoan_am`/`nop_quy`/`ck_ve` có `d` trong `[p_d0, p_d1]`. Mọi số `coalesce(…, 0)`.
- `app__fin_full(p_branch, p_month)`: gọi `app__fund_sum(p_branch, d1, d0, d1)` 1 lần thay cho `fund_rows(d0,d1)` + `fund_balance`; `op` = tổng `fund_openings` nếu `d0 <= st`, ngược lại `cash_before + bank_before`; `cl` = `cash + bank`.
- `app_fin_overview(p_month)`: vòng `for b in select … order by sort_order`, mỗi cơ sở 1 lần `app__fin_full`, dựng mảng cùng khoá.
- `app_fund_overview(p_month)`: `cash`/`bank` từ 1 lần `app__fund_sum(b.id, upto, upto, upto)`.

- [ ] **Step 1: Viết t01** — khối `begin … rollback`: đăng nhập Chủ; lưu vào bảng tạm kết quả **bản cũ** của `app_fin_overview(m)`, `app__fin_full(b, m)` mọi cơ sở, `app_fund_overview(m)`, `app_fund_branch(b, m)` mọi cơ sở, với `m` ∈ {2026-10, 2026-11, 2026-12}, kèm thời gian; nạp tệp NNN; tính lại; `RAISE 'REPORT>> khác=<số chỗ is distinct from> · thời gian cũ → mới'`. Đạt = `khác=0`.
- [ ] **Step 2: Chạy t01 chưa có NNN** (chỉ phần lưu + so với chính nó) → `khác=0`, ghi thời gian cũ.
- [ ] **Step 3: Viết NNN** theo Interfaces.
- [ ] **Step 4: Chạy t01 kèm NNN** → `khác=0`; Chốt tháng ≤ ~4s, Sổ quỹ < 1s. Chạy NNN 2 lần liên tiếp trong 1 giao dịch → không lỗi.
- [ ] **Step 5: Commit** `Bước 128: tăng tốc Sổ quỹ + Chốt tháng (máy chủ NNN, chưa chạy thật)`.

### Task 2: Chạy thật + ghi sổ
- [ ] Chọn lại NNN (Global Constraints), chạy t01 lần cuối trên máy chủ thật (tự hoàn tác) → `khác=0`; chạy thật NNN; kiểm `app_migrations` có tệp; đo lại 2 trang.
- [ ] `tai_lieu/TINH_NANG_DA_CHOT.md`: thêm dòng bước 128 dưới bước 125; ghi `app_releases` (phiên bản ngày hôm nay kế tiếp, mục `fixed`); commit, push `main`; nhắc anh Revoke mã.
