# Trang đối soát ca mới — Đợt 4 (chuyển hẳn, hoạt động độc lập) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anh Tiến 24/11 (sau khi dùng thử trên điện thoại): "Đổi toàn bộ tính năng sang thẻ mới luôn đối soát ca mới hoạt động độc lập" — mọi chỗ mở đối soát ca đều ra trang mới; trang mới tự làm được mọi việc của phần việc (không còn dẫn sang trang cũ).

**Architecture:** Đổi định tuyến `'/ca/doi-soat'` → trang mới (`doi_soat_moi`); trang cũ giữ ở `'/ca/doi-soat-cu'` (dự phòng, chỉ một đường dẫn nhỏ). `ds2.js` coi cả `#/ca/doi-soat` và `#/ca/doi-soat-moi` là trang mới (luật mới tệp 173), `#/ca/doi-soat-cu` giữ luật cũ. Phần việc làm tại trang mới bằng các chức năng máy chủ đang có: `app_ca_recon_save` (gửi riêng khoá `staff`, đủ danh sách người làm; máy chủ giữ nguyên khoá khác), `app_ca_check` (bỏ duyệt Nhân sự trước khi sửa người làm — máy chủ khoá trường của mục đã duyệt), `app_ca_recon_handover_save` (công việc bàn giao), `app_viec_add` (giao thành việc), khối có sẵn `mountReportEval` (đánh giá) và `mountCover` (nghỉ & làm thay). Không đổi máy chủ.

**Spec:** `tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md` (5.2 trang ①, 5.7 đợt 4). Đợt 2 + 3: `tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-2-3.md`.

**Em quyết (ghi sổ):** giữ trang cũ ở đường dẫn dự phòng một thời gian (an toàn, quay lại được) thay vì xoá ngay; xoá hẳn mã + bài thử cũ khi anh thấy ổn.

## Global Constraints

- Không tệp SQL mới; không đổi quyền, không đổi cách tính tiền.
- Mọi đường dẫn cũ `#/ca/doi-soat?id=…&tab=viec|tien|xong` mở trang mới đúng ca, đúng trang.
- Trang mới không còn nút / chữ dẫn sang trang cũ, trừ một đường dẫn nhỏ "Trang cũ (dự phòng)".
- Sửa người làm: bắt lý do (máy chủ đòi); gửi đủ danh sách người làm (thiếu người là mất người).
- Điện thoại 390px không tràn ngang; không tên nhân viên thật trong kho mã.
- Bộ vùng khoá (trên trang cũ ở `#/ca/doi-soat-cu`) + `flow_dsm1/2/3/4` đạt; tăng bản đủ luật khi đẩy web; hỏi anh trước khi đẩy.

---

### Task 1: `ds2.js` — trang mới ở cả hai đường dẫn
- [ ] Bài jsc trước: `ds2Name(x, '#/ca/doi-soat?id=5')` → `app_ds2_*`; `'#/ca/doi-soat-cu?id=5'` → giữ tên cũ. RED → sửa `onPage` → GREEN.

### Task 2: Đổi định tuyến + bỏ dẫn sang trang cũ
- `app.js`: `'/ca/doi-soat': 'doi_soat_moi'`, `'/ca/doi-soat-moi': 'doi_soat_moi'`, `'/ca/doi-soat-cu': 'doi_soat_ca'`.
- Trang mới: bỏ nút "Về trang cũ" và dòng nhắc trang cũ; thêm "Xem phiếu nhân viên ›" (`#/ca/phieu?id=`) và đường dẫn nhỏ "Trang cũ (dự phòng)" (`#/ca/doi-soat-cu?id=`); điều hướng ca trước / sau / tiếp theo dùng `#/ca/doi-soat?id=`.
- Trang cũ (`phieu_ca.js`): nút `#ds-newpage` thành "Sang trang đối soát mới ›" (`#/ca/doi-soat?id=`).

### Task 3: Trang ① làm đủ phần việc
- Người làm: mỗi dòng nút "Sửa" (hộp: Có làm / Nghỉ, giờ đến, giờ về, lý do nghỉ, ghi chú, đã trả lương tiền mặt khi người đó trả lương tiền mặt, lý do sửa bắt buộc); "+ Thêm người hỗ trợ" (chọn từ `app_ca_employees`); bỏ người hỗ trợ (chỉ người không theo lịch). Lưu: Nhân sự đã duyệt thì `app_ca_check(nhan_su, false)` trước, rồi `app_ca_recon_save({ staff: đủ danh sách }, lý do)`, đọc lại.
- Đánh giá nhân viên: `mountReportEval`; Nghỉ & làm thay: `mountCover` (onChange → đọc lại). Gắn khi mở trang ①, giữ khi vẽ lại tại chỗ.
- Công việc bàn giao cho ca sau: danh sách, thêm / sửa / xoá (`app_ca_recon_handover_save`, đủ danh sách `{id, content}`, lý do), "+ Giao thành việc" (`app_viec_people`, `app_viec_add`).
- [ ] Bài thử trước `flow_dsm4` (RED), rồi làm → GREEN chu / qlt / ql × 2 khung.

### Task 4: Bài thử cũ theo đường dẫn mới
- Bài trang cũ (bộ vùng khoá và các bài mở thẳng trang cũ) đổi `#/ca/doi-soat?` → `#/ca/doi-soat-cu?`; bài đi từ bảng tuần / liên kết trong web sang trang đối soát: sửa theo trang mới. `flow_dsm1` (nút ở trang cũ), `flow_dsm2` (luật cũ ở trang cũ) theo đường dẫn mới.
- [ ] Bộ vùng khoá + `flow_dsm1..4` đạt.

### Task 5: Tài liệu + phát hành (hỏi anh)
- `TINH_NANG_DA_CHOT.md`, `BAN_GIAO.md`, `CLAUDE.md` (đường dẫn trang đối soát + bài thử); tăng bản đủ luật; đẩy `main`; `app_releases`; kiểm web thật.
