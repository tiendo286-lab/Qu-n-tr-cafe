# Khoá mã quyền "Mở để sửa" đối soát — kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI không sửa được mã quyền Mở để sửa / khoá ô / ai được Lưu (web + máy chủ) khi anh Tiến chưa gõ mật khẩu trong khung chat.

**Architecture:** Một tệp Python `~/.claude/milano/khoa.py` (ngoài kho mã) chạy 2 vai: `prompt` (hook UserPromptSubmit — thấy mật khẩu thì mở khoá phiên 30 phút) và `tool` (hook PreToolUse — nội dung sửa chứa từ khoá vùng khoá mà chưa mở khoá thì exit 2). Mật khẩu chỉ lưu dạng băm sha256 ở `~/.claude/milano/mat_khau.sha256`. Đăng ký ở `.claude/settings.local.json` (Git bỏ qua). Quy tắc bằng chữ ở `CLAUDE.md` + `AGENTS.md`.

**Tech Stack:** Python 3 hệ thống (chỉ thư viện chuẩn), hook Claude Code.

**Spec:** `tai_lieu/superpowers/specs/2026-11-18-khoa-quyen-doi-soat-design.md`

## Global Constraints
- Không đưa mật khẩu (kể cả dạng băm) lên GitHub; không ghi vào bộ nhớ AI.
- Mở khoá 30 phút cho đúng `session_id`.
- Từ khoá web (tệp `docs/js/**`): `can_recon`, `recon_note`, `is_chu`, `can_unlock`, `can_direct`, `mEdit`, `MONEY_EDIT`, `LKF`, `lkItem`, `ds-money-open`, `ds-money-save`, `app_ca_auto_locks`.
- Từ khoá máy chủ (SQL có `create or replace` / `update` / `insert into` / `delete from` / `alter`): `app__ca_auto_ok`, `app_ca_recon_apply`, `app_ca_auto_locks`, `app__ca_locked_items`, `app__ca_locked_fields`, `can_recon`, `recon_note`, `can_unlock`, `is_chu`, `role_permissions`, `function public.app_can(`, `function public.app_ca_get(`.
- Tự bảo vệ: sửa `milano/khoa`, `mat_khau.sha256`, `settings.local.json` cũng cần mở khoá.

## Review Focus
- Lệnh chỉ đọc (grep, select, chạy thử DO … REPORT không có create or replace) có từ khoá → **không** bị chặn.
- Sửa tài liệu `.md` nhắc tới từ khoá → không bị chặn.
- Tin nhắn có mật khẩu lẫn trong câu ("mk matkhauthu nhé" — bài thử dùng mật khẩu giả) → vẫn mở khoá.
- Hết 30 phút hoặc phiên khác → chặn lại.
- Hook lỗi đọc JSON → không chặn nhầm cả phiên (thoát 0), trừ khi chắc chắn là vùng khoá.

---

### Task 1: Tệp khoá + bài thử
**Files:** Create `~/.claude/milano/khoa.py`, `~/.claude/milano/mat_khau.sha256`, `~/.claude/milano/kiem_tra_khoa.sh`
- [ ] Viết `kiem_tra_khoa.sh`: đưa JSON giả vào `khoa.py tool|prompt` (thư mục trạng thái tạm qua biến `MILANO_KHOA_DIR`), kiểm mã thoát: Edit `docs/js/pages/phieu_ca.js` có `LKF` → 2; Edit `.md` có `LKF` → 0; Bash `grep -n can_recon` → 0; Bash heredoc `create or replace function public.app__ca_auto_ok` → 2; Write `supabase/127_x.sql` có `app_ca_recon_apply` → 2; prompt "mk matkhauthu nhé" (mật khẩu giả) rồi Edit trên → 0; phiên khác → 2; dấu thời gian cũ 31 phút → 2; Edit `settings.local.json` → 2.
- [ ] Chạy → hỏng (chưa có khoa.py).
- [ ] Viết `khoa.py` (stdin JSON; `tool`: gom text theo tool_name; `prompt`: so băm từng từ + cả câu).
- [ ] Chạy → đạt hết.

### Task 2: Đăng ký hook + quy tắc chữ
**Files:** Create `.claude/settings.local.json`; Modify `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `tai_lieu/BAN_GIAO.md`
- [ ] Ghi hook vào `.claude/settings.local.json`; thêm `.claude/settings.local.json` vào `.gitignore`.
- [ ] Thêm mục "Vùng khoá quyền đối soát" vào CLAUDE.md + AGENTS.md (không ghi mật khẩu), BAN_GIAO ghi cách đổi mật khẩu.
- [ ] Thử thật: Edit có `LKF` vào phieu_ca.js → phải bị chặn.
- [ ] Commit (không có tệp nào trong `~/.claude/milano`).
