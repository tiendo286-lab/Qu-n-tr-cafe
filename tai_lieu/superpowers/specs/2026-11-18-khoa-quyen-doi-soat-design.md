# Khoá mã quyền "Mở để sửa" phần tiền đối soát — thiết kế ngắn (18/11/2026)

## Vì sao
Bước 129 anh Tiến chốt: Chủ, Quản lý tổng và quản lý đối soát cơ sở đều sửa được phiếu web đã tự đối soát. Lần đó AI chỉ sửa máy chủ, còn giao diện vẫn khoá ô với người không phải Chủ (sửa ngày 18/11, web 2026.11.18.12). Anh muốn từ nay **AI nào định sửa mã ảnh hưởng tới quyền này đều phải được anh gõ mật khẩu trực tiếp trong khung chat**, để không còn thay đổi âm thầm.

## Mục tiêu / không làm
- Có: chặn AI sửa mã quyết định nút ✎ Mở để sửa, ô nào bị khoá khi Đang sửa, ai được Lưu (cả web lẫn máy chủ), cho tới khi anh gõ mật khẩu.
- Không: không đổi gì trên web cho người dùng, không hỏi mật khẩu với nhân viên hay quản lý.
- Tránh: **không để mật khẩu lọt lên GitHub** (kho công khai). Không bắt anh gõ mật khẩu cho việc không đụng tới quyền (anh chọn phương án A).

## Phương án đã cân nhắc
- **A. Khoá đúng chỗ quyết định quyền (anh chọn)**: chỉ chặn khi nội dung sửa có chứa từ khoá về quyền. Anh ít phải gõ.
- B. Khoá cả tệp `phieu_ca.js` + `doi_soat_den.js`: chắc hơn nhưng việc chốt ca / đối soát nào cũng phải gõ.

## Cách làm
1. **Quy tắc bằng chữ** trong `CLAUDE.md` và `AGENTS.md` (không ghi mật khẩu): danh sách vùng khoá, phải xin anh gõ mật khẩu, đã sửa thì chạy bài thử `flow_ql_tu_ds` (role=ql và chu, 2 khung) trước khi đẩy lên web.
2. **Khoá thật trên máy anh (Claude Code)**, tệp nằm ngoài kho mã, ở `~/.claude/milano/`:
   - `mat_khau`: mật khẩu anh đặt.
   - Hook **UserPromptSubmit**: tin nhắn của anh có đúng mật khẩu → mở khoá cho phiên đó trong **30 phút** (AI tự quyết, anh đổi được).
   - Hook **PreToolUse** (Edit, Write, Bash): nếu nội dung sửa (old/new của Edit, nội dung Write, câu lệnh Bash) chứa từ khoá vùng khoá mà chưa mở khoá → chặn, báo AI "xin anh Tiến gõ mật khẩu".
   - Đăng ký hook trong `.claude/settings.local.json` của dự án (Git bỏ qua tệp này).
3. **Từ khoá vùng khoá** (AI tự chọn, sửa được về sau):
   - Web: `can_recon`, `recon_note`, `is_chu`, `can_unlock`, `can_direct`, `mEdit`, `MONEY_EDIT`, `LKF`, `lkItem`, `ds-money-open`, `ds-money-save`, `app_ca_auto_locks`.
   - Máy chủ: `app__ca_auto_ok`, `app_ca_recon_apply`, `app_ca_auto_locks`, `app__ca_locked_items`, `app__ca_locked_fields`, `'doi_soat'` (quyền), `function public.app_can(`, `function public.app_ca_get(`.

## Giới hạn (nói rõ với anh)
- Khoá thật chỉ chạy với Claude trên máy này. Codex hoặc phiên đám mây chỉ có quy tắc bằng chữ.
- Lệnh Bash sửa tệp mà câu lệnh không chứa từ khoá (ví dụ thay số phiên bản hàng loạt) thì không bị chặn. Cố ý vậy để việc thường ngày không phải gõ.

## Để lại cho người làm
Câu chữ thông báo chặn, cách ghi thời điểm mở khoá.
