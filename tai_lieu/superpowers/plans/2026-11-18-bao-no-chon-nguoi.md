# Báo nợ chọn người · Thu/Chi → Báo nợ · Luân chuyển TM–CK · Quyền Kiểm tra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps dùng checkbox (`- [ ]`).

**Goal:** 4 việc anh chốt 17/11 (spec `tai_lieu/superpowers/specs/2026-11-17-bao-no-chon-nguoi-design.md`).
**Architecture:** 1 tệp máy chủ (117 hoặc số trống kế tiếp) + giao diện `ca_chung.js`, `chot_ca_moi.js`, `pages/phieu_ca.js`; giả lập `ca_gia.js`.
**Spec:** `tai_lieu/superpowers/specs/2026-11-17-bao-no-chon-nguoi-design.md`

## Global Constraints
- Nhóm nợ: `khach` (① nhắc thu) · `kho` (②) · `khac` (③). Người trong menu = tên đang có ở nhóm ②/③ của cơ sở + luôn có "Kho tổng" (②). Khách → gõ tên, `khach`.
- Thu/Chi → Báo nợ: TM → `muon`, CK → `ck`, số tiền = |số|; Kiểm tra: staged, Lưu 1 lần (`app_ca_recon_apply`: fields.moves bỏ dòng + debts set có `grp`, `from`).
- Luân chuyển TM–CK: tên "Luân chuyển tiền mặt – CK"; 2 chiều `tm_ck` (TM −, CK +) / `ck_tm` (TM +, CK −); máy chủ nhận cả 2 chiều, vẫn đòi 2 vế bằng nhau, 1 nội dung.
- Quyền Kiểm tra: chỉ Chủ, QL tổng, quản lý đối soát cơ sở (`app__ca_auto_ok`) — `app_ca_get.can_recon`, `app_ca_recon_apply`, `app_ca_recon_direct`, `app_ca_recon_finish`; câu: "Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này kiểm tra / sửa được phiếu này."
- Commit `Tien Do`, dòng cuối `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; chạy thử máy chủ tự hoàn tác trước; tăng `?v=` + version.json; ghi `app_releases`; 2 khung không tràn.

## Task 1: Máy chủ (t11 → tệp mới)
- [ ] Viết `kiem_tra/audit_tien/t11_bao_no_chon_nguoi.sql`: a) `app_ca_save` debts có `grp` kho/khac → lưu đúng nhóm; b) `app_ca_debt_people(branch)` có "Kho tổng" (kho) + tên nhóm ③; c) `app_ca_recon_apply` debts set `grp:'kho'`, `from:'Chi CK …'` + bỏ dòng thu chi → khoản vào ②, lịch sử có "đổi từ"; d) phiếu luân chuyển chiều CK→TM lưu được, 2 vế cùng dấu bị chặn; e) QL không phân công: `app_ca_get.can_recon=false` + `recon_note`, `app_ca_recon_apply` bị chặn kể cả phiếu không tự đối soát; QL được phân công lưu được.
- [ ] Chạy RED; viết tệp; chạy GREEN + t01–t10 + bài 104; commit.

## Task 2: Giao diện + giả lập
- [ ] `ca_chung.js`: collapse/expand giữ chiều (`dir`), hằng `EXCH_LABEL`.
- [ ] `chot_ca_moi.js`: dòng Báo nợ có menu Người nợ; dòng luân chuyển có [TM → CK][CK → TM]; đổi chữ.
- [ ] `phieu_ca.js`: menu Người nợ ở dòng Báo nợ (Kiểm tra); nút "→ Báo nợ" trên Thu/Chi khi Mở để sửa (staged, hộp Lưu ghi "Đổi … → Báo nợ …"); dòng luân chuyển 2 chiều; đổi chữ; QL không được phép → dòng "Chỉ quản lý đối soát cơ sở này sửa được".
- [ ] `ca_gia.js` theo máy chủ; bài thử `flow_bn133.js` (nv chốt ca + chu Kiểm tra + ql không phân công), 2 khung; chạy lại regress (unified98, audit_mo_luu, ds110, px105, pc109).

## Task 3: Lên web
- [ ] Chạy thử + chạy thật tệp; tài liệu; version; commit/push; `app_releases`.
