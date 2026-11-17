# Bước Tiền: 1 nút Mở, 1 nút Lưu — Kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Phần tiền ở bước Kiểm tra mặc định chỉ xem; Mở để sửa; sửa không lưu ngay; Lưu 1 lần (hỏi lý do nếu có thay đổi), nguyên khối.
**Architecture:** Máy chủ `app_ca_recon_apply` (tệp `103_mo_luu_phan_tien.sql`) chạy cả gói thay đổi trong 1 giao dịch bằng các hàm sẵn có. Giao diện `phieu_ca.js`: cờ `moneyEdit`, tắt tự lưu khi đang sửa, gom thay đổi, thanh dưới + hộp lý do.
**Spec:** `tai_lieu/superpowers/specs/2026-11-17-mo-luu-phan-tien-design.md`

## Global Constraints
- Tệp `supabase/103_mo_luu_phan_tien.sql`, dòng cuối ghi `app_migrations`; hàm web cấp `authenticated`, revoke `public, anon`.
- Không đổi Phần việc. Máy tính + điện thoại 390px không tràn ngang.

## Review Focus
1. Lỗi ở thao tác thứ N của gói → không thay đổi nào được lưu (t08).
2. Lưu không có thay đổi → không gọi máy chủ, không hỏi lý do (flow).
3. Đang sửa mà tự lưu chạy ngầm → không được (flow: trước khi Lưu, máy chủ chưa đổi).
4. Ca đã hoàn thành / mục đã duyệt → Lưu mở lại mục tiền, phải Duyệt lại; quản lý không lưu được mục web tự đối soát (t08).
5. Rời trang khi còn thay đổi → hỏi lại (flow).

### Task 1: Máy chủ `app_ca_recon_apply`
- `app_ca_recon_apply(p_id bigint, p_changes jsonb, p_reason text) returns jsonb`. `p_changes`: `fields` (đối tượng như `app_ca_recon_save.p`), `debts` [`{op:'set', id|null, kind, name, amount, note}` | `{op:'remove', id}`], `paid` [`{op:'collect', debt, kind, amount}` | `{op:'update', debt, kind, amount}` | `{op:'uncollect', debt}`], `to_exchange` [debt id], `photos` [`{op:'add', path}` | `{op:'del', id}`]. Không thay đổi nào → `{changed:false}` (không cần lý do). Có → lý do bắt buộc; mở lại các mục tiền đã duyệt (`app__ca_item_reopen`; mục tự đối soát mà không phải Chủ → lỗi); rồi chạy lần lượt các hàm sẵn có với cùng lý do. Trả `{changed:true}`.
- t08: gói 1 (sửa số + thêm/xoá thu chi + thêm báo nợ) → đủ, có lịch sử cùng lý do; gói có thao tác hỏng ở cuối → không gì được lưu; thiếu lý do → lỗi; mục tiền đã duyệt → bị mở lại; gói rỗng → `changed:false`.

### Task 2: Giao diện
- Chỉ xem / Đang sửa / Lưu theo spec; bỏ các nút liệt kê ở spec mục 5; giả lập `ca_gia.js` có `app_ca_recon_apply`.
- `flow_audit_mo_luu.js`: Chỉ xem (ô khoá, có Mở), Mở → sửa Mua đá, xoá 1 dòng, thêm Thu, thêm báo nợ → trước Lưu máy chủ chưa đổi → Lưu: hộp liệt kê ≥ 3 thay đổi, lý do trống bị chặn → có lý do lưu được → về Chỉ xem có ghi chú; Huỷ bỏ thay đổi; Lưu khi không đổi gì không hỏi lý do. Máy tính + điện thoại.
- Sửa các flow cũ có sửa ở phần tiền cho hợp cách mới (bấm Mở, Lưu + lý do): audit_ba_o, audit_ql_sua, audit_muon_rut, audit_ghi_chu, audit_bg (phần ảnh), ds86, ds110, unified98, và các flow khác nếu hỏng.

### Task 3: Chạy thật, lên web
- 103 thật; t01–t08 PASS máy chủ thật; phiên bản `2026.11.17.3`; tài liệu (mục 121), README; push; `app_releases`; xoá `sbp_`.
