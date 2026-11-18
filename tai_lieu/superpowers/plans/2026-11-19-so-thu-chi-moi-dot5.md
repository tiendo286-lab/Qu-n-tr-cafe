# Sổ thu chi mới — Đợt 5 (tab Tổng đủ nút, Quỹ ngoài ghi được) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bật các nút còn tắt ở tab Tổng và Quỹ ngoài của Sổ thu chi mới, dùng lại hàm máy chủ của trang Sổ quỹ cũ:
- Chuyển về Quỹ ngoài.
- Đã nhận tiền.
- Luân chuyển tiền mặt ↔ tài khoản.
- Kiểm quỹ và Điều chỉnh.
- Thêm / sửa / xoá khoản chi / thu ngoài (có cách chia cho cơ sở).

**Architecture:** Chỉ đổi giao diện, không thêm tệp SQL. Các hàm máy chủ dùng lại:
- `app_fund_withdraw_save` / `_delete` / `_confirm`: phiếu rút, nay gọi là "Chuyển về Quỹ ngoài".
- `app_fund_count_save` / `app_fund_count_adjust`, `app_fund_balance`, `app_fund_branch`: lấy danh sách kiểm quỹ.
- `app_ext_month` / `app_ext_entry_save` / `app_ext_entry_delete`.

Quyền do máy chủ kiểm, giống trang cũ. Dữ liệu kiểm quỹ (`app_fund_branch`) chỉ tải khi mở tab Tổng của cơ sở, để không làm chậm sổ.

**Spec:** `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md` mục 3.6, 3.7, 5 (đợt 5).

## Global Constraints
- Chuyển về Quỹ ngoài: chọn tiền mặt / tài khoản, ngày (không quá hôm nay), số tiền (hiện số dư), ghi chú; loại `giua_thang` mặc định, có lựa chọn "cuối tháng" (điền sẵn số dư).
  - Còn chờ thì sửa / xoá được.
  - Chủ bấm "Đã nhận tiền" (hỏi xác nhận) thì khoá cả 2 bên.
- Kiểm quỹ: tiền mặt (đếm) / tài khoản (số dư app ngân hàng), ngày, số thực tế, so với sổ. Lý do bắt buộc khi lệch.
  - Lệch chưa điều chỉnh thì có nút "Điều chỉnh…", chọn nhóm bắt buộc, tạo khoản thu / chi.
- Ô "Kiểm quỹ lần cuối" ở tab Tổng.
- Quỹ ngoài (chỉ Chủ): nút "+ Thêm khoản ngoài"; khoản `x:` có Sửa / Xoá; cách chia gồm chia theo doanh thu / chia đều / 1 cơ sở / tự nhập (tổng phải bằng số tiền).
- **Chốt tháng:** không đổi. Chuyển về Quỹ ngoài chính là bảng `fund_withdrawals` mà Chốt tháng đang đối chiếu, nên Chốt tháng đã dùng đúng nguồn.
- Không tràn ngang 390px. Mỗi lần đẩy `main` thì tăng phiên bản và ghi `app_releases`.

## Review Focus
1. Phiếu đã nhận: không còn nút sửa / xoá; người không phải Chủ không thấy nút Đã nhận tiền.
2. Kiểm quỹ khớp: không hiện nút Điều chỉnh.
3. Tháng khác tháng hiện tại: kiểm quỹ / chuyển về Quỹ ngoài báo lỗi của máy chủ rõ ràng.

### Task 1: Tab Tổng + Quỹ ngoài ghi được
**Files:** `docs/js/pages/so_thu_chi.js`, `kiem_tra/trinh_duyet/stc_gia.js`, `stc_fixture.js`, `flow_stc5.js`.
- [ ] Viết bài thử `flow_stc5`:
  - tạo Chuyển về Quỹ ngoài → có ở danh sách "chờ Chủ nhận";
  - sửa / xoá được khi còn chờ;
  - Chủ bấm Đã nhận tiền → khoá;
  - Luân chuyển mở hộp thoại luân chuyển;
  - Kiểm quỹ lệch → có Điều chỉnh → tạo khoản;
  - ô Kiểm quỹ lần cuối;
  - Quỹ ngoài: thêm khoản chi chia đều → có trong Sổ chi Quỹ ngoài; sửa; xoá;
  - Quản lý tổng không thấy nút Đã nhận tiền;
  - không tràn 390px.
- [ ] Chạy thấy lỗi → viết → đạt (`flow_stc1/2/3` không vỡ) → commit.

### Task 2: Phát hành
- [ ] Phiên bản mới, tài liệu, đẩy `main`, `app_releases`.
