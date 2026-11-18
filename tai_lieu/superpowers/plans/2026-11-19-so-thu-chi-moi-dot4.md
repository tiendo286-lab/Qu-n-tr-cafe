# Sổ thu chi mới — Đợt 4 (tab Đối soát tiền làm thật) — ghi lại sau khi làm

> Vùng khoá "Mở để sửa": anh Tiến gõ mật khẩu 19/11 trước khi sửa. Spec: `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md` mục 3.3.

**Goal:** mỗi ca đi 3 bước trong tab Đối soát tiền:
1. So phiếu Fabi ↔ nhân viên ghi.
2. Nhập tiền thực nhận.
3. Chốt tiền ca / Mở lại chốt.

**Máy chủ `133_so_thu_chi_doi_soat.sql`:** hàm `app_stc_ds_*` bọc hàm đối soát có sẵn, nên quyền và luật cũ vẫn áp dụng.
- **Ai làm được:** Chủ, Quản lý tổng, quản lý đối soát của cơ sở.
- `app_stc_ds_fabi(report, mo|dt|no, name, reason)`: sửa số nhân viên ghi theo Fabi, chỉ sửa vào bản đối soát.
  - Nợ: Fabi nhiều hơn và có tên người nợ → thêm báo nợ phần chênh.
- `app_stc_ds_blame(report, truoc|nay, reason)` / `app_stc_ds_blame_undo`: mở ca lệch số phải là thì ca nào ghi sai ca đó chịu. Lưu ở bảng `stc_open_blame`.
  - "Ca này": tiền đầu ca tính bằng số phải là.
  - "Ca trước": số đếm két ca trước cộng / trừ phần lệch. Không mở lại mục đã duyệt của ca trước. Ca trước thu theo ca thì không chọn được.
- `app_stc_ds_cash(report, ca|ngay, counted)`:
  - Thu theo ca: ghi số quản lý đếm của ca.
  - Thu theo ngày: ca cuối ghi số đếm két vào bản đối soát.
- `app_stc_ds_close(report)`: ghi kết quả Tiền mặt + Chuyển khoản theo số lệch (khớp / thiếu / thừa). Lệch không chặn chốt.
  - Chặn khi: còn ô đỏ ở bước ①, chờ kế toán, hoặc thu theo ca mà chưa nhập tiền mặt thực nhận.
- `app_stc_ds_reopen(report, reason)`: mở lại 2 mục tiền (và mở lại hoàn thành đối soát nếu có).
- `app_stc_month`: ô nhân viên ghi lấy theo bản đối soát (trường `nv`, thêm `nv_raw` là số gốc), kèm `blame`.

**Giao diện:**
- `caChecks`: ô Tiền mở ca 2 tầng.
  - Tầng 1: NV ghi ↔ Fabi → "Sửa theo Fabi".
  - Tầng 2: Fabi ↔ phải là → "Ca trước ghi sai" / "Ca này ghi sai".
  - Đã chọn ca chịu thì ô xanh "Ca này chịu ±x".
- Phiếu tiền có các nút: Sửa theo Fabi, Thu theo ca / Thu theo ngày, ô tiền mặt thực nhận, Chốt tiền ca, Mở lại chốt.

**Bài thử:**
- Máy chủ: `kiem_tra/so_thu_chi_133.sql` (tự tạo lệch giả, tự hoàn tác).
- Hàm thuần: `jsc -m kiem_tra/so_thu_chi_tinh_dot4.mjs`.
- Chrome: `flow_stc4` (máy tính + điện thoại) và `flow_ql_tu_ds` (ql + chu, máy tính + điện thoại).

**Còn để sau:** Fabi có cờ hoá đơn bị sửa / xoá thì mới chỉ hiện, chưa có nút. Trang Đối soát ca cũ vẫn giữ phần tiền trong lúc chạy song song (anh Tiến dặn chưa bỏ trang cũ).
