# Chuyển khoản phải nhận Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thống nhất và bắt buộc đúng công thức chuyển khoản phải nhận trong Phiếu chốt ca và Đối soát.

**Architecture:** `app__ca_money` tính và trả `ck_expected` cùng `ck_left`; frontend dùng giá trị máy chủ cho phiếu hoàn thành. RPC lưu kết quả đối soát tự đối chiếu lựa chọn với `ck_left` trước khi ghi.

**Tech Stack:** JavaScript ES modules, PostgreSQL/Supabase RPC, bộ trình duyệt giả lập hiện có.

**Spec:** `docs/superpowers/specs/2026-11-17-chuyen-khoan-phai-nhan-design.md`

## Global Constraints

- Không sửa migration cũ; tạo migration tiếp theo sau số hiện có.
- Không dùng dữ liệu thật trong bộ thử.
- Không áp dụng migration lên production hoặc triển khai web trong kế hoạch này.
- Kiểm tra cả máy tính và `test/phone.html` 390px.

## Review Focus

- Thu và chi chuyển khoản cùng xuất hiện: tổng đại số phải được giữ nguyên.
- Khách trả nợ CK: phải cộng vào phải nhận.
- Nợ CK mới: phải trừ khỏi phải nhận và cộng lại vào số chênh lệch.
- Kế toán chưa nhập đủ ngân hàng: dùng số nhân viên cộng nhưng cùng công thức.
- API nhận lựa chọn không khớp số tính: phải từ chối trước khi ghi kết quả hoặc khoản âm.

---

### Task 1: Khóa lỗi bằng bài kiểm tra

**Files:**
- Modify: `kiem_tra/trinh_duyet/flow_unified98.js`
- Create: `kiem_tra/chuyen_khoan_phai_nhan_101.sql`

**Interfaces:**
- Consumes: dữ liệu giả Phiếu chốt ca và RPC `app_ca_result_set`.
- Produces: kiểm tra hồi quy cho `money.ck_expected` và việc từ chối kết quả sai.

- [ ] Thêm ca giả có Fabi CK 300.000, thu nợ CK 100.000, thu CK 70.000, chi CK 20.000 và nợ CK mới 50.000; khẳng định phải nhận 400.000.
- [ ] Khẳng định thẻ tổng ngân hàng và phần chi tiết cùng hiện 400.000.
- [ ] Trong SQL tự hoàn tác, thử gửi KHỚP khi `ck_left` khác 0 và thử gửi sai số tiền THIẾU/THỪA; cả hai phải bị chặn.
- [ ] Chạy bài thử trước sửa và xác nhận nó thất bại đúng tại công thức/chặn API.

### Task 2: Thêm nguồn công thức chuẩn ở máy chủ

**Files:**
- Create: `supabase/101_chuyen_khoan_phai_nhan.sql`

**Interfaces:**
- Produces: `app__ca_money(p_id).ck_expected bigint`; `app_ca_result_set` chỉ nhận kết quả tương ứng dấu và trị tuyệt đối của `ck_left`.

- [ ] Bổ sung `ck_expected := pt + ck_mv + col_ck - ck_new` vào JSON của `app__ca_money` và giữ `ck_left = received - ck_expected` cho cả cơ sở nhân viên lẫn ngân hàng.
- [ ] Trước mọi thao tác xóa/tạo khoản âm, kiểm tra `p_result` và `p_amount` đúng với `comp`: 0→KHỚP, âm→THIẾU, dương→THỪA, số tiền bằng trị tuyệt đối.
- [ ] Chạy bài SQL trong giao dịch cục bộ/giả lập phù hợp; xác nhận mọi tình huống đạt và rollback.

### Task 3: Cho frontend dùng một nguồn duy nhất

**Files:**
- Modify: `docs/js/pages/phieu_ca.js`
- Modify: `kiem_tra/trinh_duyet/sb_gia.js` hoặc tệp giả lập chuyên trách nếu RPC nằm ở đó.

**Interfaces:**
- Consumes: `R.money.ck_expected` từ Task 2.

- [ ] Thay fallback `R.pos_transfer` trong thẻ ngân hàng bằng `R.money.ck_expected`; nếu dữ liệu cũ chưa có trường này thì tính bằng một helper duy nhất dùng đúng công thức đầy đủ.
- [ ] Dùng cùng giá trị chuẩn trong hộp kết quả chuyển khoản; không tự viết lại công thức rút gọn.
- [ ] Cập nhật giả lập trả `ck_expected` như máy chủ.
- [ ] Chạy `flow_unified98` và bài ngân hàng trên máy tính và điện thoại 390px.

### Task 4: Kiểm tra hồi quy và bàn giao

**Files:**
- Verify only.

- [ ] Chạy kiểm tra cú pháp các tệp JavaScript liên quan.
- [ ] Chạy các luồng chốt ca, Fabi và ngân hàng trên máy tính/điện thoại.
- [ ] Xem `git diff`, `git diff --check`, bảo đảm không có secret, dữ liệu thật hoặc thay đổi ngoài ý 1.
- [ ] Báo rõ migration mới chỉ nằm cục bộ và chưa được áp dụng production.

