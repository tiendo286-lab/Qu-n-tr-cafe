# Bước 152 — Xoá phần cũ: kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sổ thu chi thành chỗ làm tiền duy nhất. Có bộ lọc đầy đủ, quản lý cơ sở vào được. Xoá trang Thu chi / Lệch tiền ca / Sổ quỹ cũ và phần tiền ở Đối soát ca.

**Architecture:**
- Máy chủ: tệp mới `136_so_thu_chi_cho_ql.sql`. Vá bản đang chạy của `app_stc_month` / `app_stc_finals` bằng thay chuỗi, có kiểm chỗ chèn. Định nghĩa lại `app_stc_ds_close`.
- Web:
  - Thêm hàm lọc thuần trong `so_thu_chi_tinh.js`, thanh lọc trong `so_thu_chi.js`.
  - Tự chuyển đường dẫn cũ trong `app.js`, xoá 3 tệp trang.
  - Ngăn tiền ở Đối soát ca (`phieu_ca.js`) thay bằng thẻ dẫn sang Đối soát Fabi.

**Tech Stack:** JS thuần (ES modules, `html\`\``), Supabase plpgsql, bộ thử Chrome giả lập `kiem_tra/trinh_duyet/`, `jsc -m`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-xoa-phan-cu-design.md`

## Global Constraints
- Không xoá dữ liệu máy chủ. Hàm của trang cũ để nguyên.
- Tệp SQL mới chạy lại được nhiều lần, dòng cuối là `insert into public.app_migrations(file) values ('136_so_thu_chi_cho_ql.sql') on conflict (file) do nothing;`. Chạy thử tự hoàn tác trước khi chạy thật.
- Quỹ ngoài chỉ Chủ. Quán chịu / ghép của người không phải Chủ thì chờ Chủ duyệt. Quán chịu khoản treo chỉ Chủ.
- **Vùng khoá** (mã quyền "Mở để sửa" phần tiền trong `phieu_ca.js`, mục Vùng khoá của CLAUDE.md): xin anh Tiến gõ mật khẩu trước khi sửa. Sửa xong chạy `flow_ql_tu_ds` (ql + chu, máy tính + điện thoại).
- Màn 390px không tràn ngang. Phiên bản `2026.11.19.9`. Ghi `app_releases`.

## Review Focus
1. **QL cơ sở có 2 cơ sở mở Sổ thu chi:** chỉ thấy 2 cơ sở đó trong danh sách. Đổi `cn=` sang cơ sở khác thì máy chủ báo lỗi rõ, không trắng trang. → Task 1 (b), Task 2 bài thử QL.
2. **Đường dẫn cũ có `thang` / `cn` / `xem=khoan-am`:** mở đúng tháng / cơ sở / lọc trừ lương. → Task 3 bài thử chuyển đường dẫn.
3. **Ca đã chốt và lọc "Có trừ lương":** vẫn hiện phiếu trừ lương, không có nút Huỷ. → Task 2 bài thử lọc.
4. **Xác nhận Fabi khi phần việc chưa xong:** ghi đủ 4 kết quả tiền nhưng chưa "Hoàn thành đối soát". Xong phần việc thì tự hoàn thành. → Task 1 (c).
5. **Bộ lọc + bảng TM/CK + ô cột cùng lúc:** kết quả là giao của tất cả; "Bỏ lọc" xoá cả `loc` trên đường dẫn. → Task 2 bài thử hàm lọc.

---

### Task 1: Máy chủ 136 — quản lý cơ sở đọc Sổ thu chi, giải trình trong `tl`, Xác nhận Fabi ghi đủ 4 mục
**Files:** Create `supabase/136_so_thu_chi_cho_ql.sql`, test `kiem_tra/so_thu_chi_136.sql`.
**Interfaces:** Produces:
- `app_stc_month(p_branch, p_month)`: quyền theo `app__fin_can(p_branch)`. `branches` chỉ gồm cơ sở `app__fin_can` đúng. Mỗi phần tử `gap.tl[]` có thêm `reply`.
- `app_stc_finals(p_branch, p_month)`: quyền theo `app__fin_can(p_branch)`.
- `app_stc_ds_close`: như cũ, thêm kết quả `khop` cho `thu_chi` / `cong_no` nếu chưa có, rồi `app__ca_auto_finish(p_report, acc)`.

- [ ] Bài thử `so_thu_chi_136.sql`, gửi sau 136 ×2, kết thúc bằng `REPORT>>`:
  - (a) QL có cơ sở: `app_stc_month(cơ sở mình)` đọc được, số `branches` = số cơ sở được giao;
  - (b) `app_stc_month(cơ sở khác)` → lỗi "không được xem thu chi của cơ sở này";
  - (c) Chủ xác nhận Fabi một ca chưa xác nhận → đủ 4 dòng kết quả tiền; trạng thái đối soát đổi đúng theo phần việc;
  - (d) `gap.tl` có khoá `reply`;
  - (e) `app_stc_finals` với QL đọc được cơ sở mình.
- [ ] Viết 136. Vá bằng `pg_get_functiondef` + `replace`, `raise` nếu không thấy chỗ chèn:
  - câu chặn "Đang chạy thử: chỉ Chủ và Quản lý tổng xem được." → `if not coalesce(public.app__fin_can(p_branch), false) then raise exception 'Bạn không được xem thu chi của cơ sở này.'; end if;` (cả 2 hàm);
  - danh sách `branches`: thêm `and coalesce(public.app__fin_can(b.id), false)`;
  - `gap.tl`: thêm `'reply', <cột giải trình>` (xem tên cột thật của `shift_shortfalls` trước).
- [ ] Định nghĩa lại `app_stc_ds_close` (bản 135 + phần cuối).
- [ ] Chạy thử, đạt hết → chạy thật → `select file from app_migrations where file like '136%'`.
- [ ] Commit.

### Task 2: Sổ thu / Sổ chi có bộ lọc đầy đủ + "→ Trừ lương" + quản lý cơ sở vào được
**Files:** Modify `docs/js/so_thu_chi_tinh.js`, `docs/js/pages/so_thu_chi.js`, `docs/js/app.js` (menu). Test `kiem_tra/so_thu_chi_tinh_dot7.mjs`, `kiem_tra/trinh_duyet/flow_stc7.js`, `stc_gia.js` (role ql, `reply`, chuyển trừ lương).
**Interfaces:**
- `parseLoc(s: string) → {q, src, type, cat, st}`; `locStr(f) → string` (khoá `loc` trên đường dẫn, dạng `st:tl,src:ca,q:đá`).
- `filterItems(items, f, ctx:{fin:(caId)=>bool}) → item[]`:
  - `src`: `ca` (có ca_id) / `tay` (src entry, không ca) / `bu` (src shortfall) / `lech` (col lech);
  - `st`: `todo` (chi chưa có cat) / `cho` (status chứa "Chờ") / `tl` (col lech có gap.tl khác huỷ) / `void` / `fin` / `open`;
  - `type` / `cat` theo tên nhóm; `q` không dấu, tìm trong title + cat + meta + tên người trong gap.tl.
  - Đã xoá chỉ hiện khi `st=void`.

- [ ] Thử thuần (`dot7.mjs`): mỗi `src` / `st` / `q` không dấu ("da" khớp "Mua đá"), nhiều điều kiện là giao, `parseLoc(locStr(f))` giữ nguyên. `jsc -m` → hỏng.
- [ ] Viết hàm → `jsc -m` đạt.
- [ ] `so_thu_chi.js`:
  - Thanh lọc trên sổ: ô Tìm, Nguồn, Loại → Nhóm (từ `cats()`), Trạng thái, nút Bỏ lọc. Đổi giá trị thì cập nhật `loc` trên đường dẫn.
  - Có lọc → danh sách phẳng `itemRow` theo ngày · ca.
  - `st=tl` → dưới mỗi dòng lệch là từng phiếu: tên, số, trạng thái, giải trình, nút Huỷ (`app_stc_gap_undo('tl', id)`) khi ca chưa chốt; nút "Mở phiếu chênh lệch".
- [ ] Nút "→ Trừ lương" trên dòng chi `src=move` của ca đã xác nhận Fabi, chưa chốt:
  - hộp chọn người + số → `app_tc_move_to_ka(p_report, p_mkey, p_people, p_reason)`;
  - dòng đã chuyển có "Bỏ chuyển" → `app_tc_move_ka_undo` (xem đúng tham số trong `68_gop_am_tien_tru_luong.sql`).
- [ ] `app.js`: menu "Sổ thu chi (mới)" → "Sổ thu chi", quyền `doi_soat`; trang `so_thu_chi` `perm = 'doi_soat'`.
- [ ] Chrome `flow_stc7` (chu, qlt, ql; máy tính + điện thoại):
  - lọc tìm "đá", nguồn, nhóm, có trừ lương (thấy giải trình; ca đã chốt không có Huỷ);
  - Bỏ lọc;
  - QL chỉ thấy cơ sở mình, không thấy Quỹ ngoài;
  - không tràn ngang.
- [ ] Chạy lại `flow_stc1..6` → đạt. Commit.

### Task 3: Bỏ menu / xoá 3 trang cũ / tự chuyển đường dẫn
**Files:**
- Modify `docs/js/app.js` (HUBS, PAGES, đoạn chuyển hướng gần dòng 308), `docs/js/pages/chot_thang.js`, `docs/js/pages/phieu_ca.js` (dòng đường dẫn "Mở phiếu trừ lương trong Thu chi"), `docs/js/pages/doi_soat.js` (nút sang Thu chi / Lệch tiền).
- Delete `docs/js/pages/thu_chi.js`, `am_tien.js`, `so_quy.js` và bài thử Chrome chỉ thử 3 trang đó. Ghi lại README bộ thử.
- Test `kiem_tra/trinh_duyet/flow_cu152.js`.

- [ ] Bài thử `flow_cu152`:
  - mở 5 đường dẫn cũ → hash cuối đúng bảng trong spec (giữ `thang`, `cn`; `xem=khoan-am` → `loc=st:tl`);
  - menu không còn 3 mục;
  - không lỗi trang.
  Chạy → hỏng.
- [ ] Sửa `app.js` theo bảng spec; xoá PAGES của 3 trang; sửa đường dẫn ở `chot_thang.js`, `phieu_ca.js`, `doi_soat.js`.
- [ ] `grep -rn "pages/thu_chi\|pages/am_tien\|pages/so_quy\|/quan-ly/thu-chi\|/quan-ly/lech-tien\|/quan-ly/so-quy" docs/js` chỉ còn đoạn chuyển hướng.
- [ ] Chạy `flow_cu152` + bộ thử Sổ thu chi → đạt. Commit.

### Task 4: Đối soát ca bỏ phần tiền (VÙNG KHOÁ — xin mật khẩu trước)
**Files:** Modify `docs/js/pages/phieu_ca.js` (ngăn bước tiền của chế độ đối soát, tab "② Phần tiền", nút Mở để sửa / Lưu ở chân), `kiem_tra/trinh_duyet/flow_ql_tu_ds.js` (viết lại), `CLAUDE.md` (mục Vùng khoá), `tai_lieu/BAN_GIAO.md`, `TINH_NANG_DA_CHOT.md`.
**Interfaces:** Consumes `app_stc_ds_close` từ Task 1 (ghi đủ 4 kết quả tiền nên các bước tiền tự "✓ Xong").

- [ ] Viết lại `flow_ql_tu_ds` (ql + chu):
  - Đối soát ca không có nút "✎ Mở để sửa", không có ô sửa số tiền;
  - có thẻ "Phần tiền làm ở Sổ thu chi › Đối soát Fabi ›" trỏ `#/quan-ly/so-thu-chi?tab=doi-soat&cn=<cơ sở>&thang=<tháng>&ds=<id>`;
  - bấm thẻ → thấy khung Đối soát Fabi đúng ca;
  - không tràn ngang.
  Chạy → hỏng.
- [ ] Ngăn tiền thay bằng thẻ dẫn + trạng thái (chưa xác nhận Fabi / đã xác nhận / đã chốt ca, từ kết quả tiền của ca). Giữ "Lịch sử sửa · mở lại phiếu". Bỏ nút Mở để sửa / Lưu phần tiền ở chân.
- [ ] Chạy `flow_ql_tu_ds` 4 lần (ql / chu × index / phone) → đạt. Sửa các bài thử Đối soát ca cũ còn kiểm tra phần tiền thành kiểm tra thẻ dẫn.
- [ ] CLAUDE.md: mục Vùng khoá ghi phần tiền đối soát nay ở Sổ thu chi › Đối soát Fabi; bài thử bắt buộc là `flow_ql_tu_ds` mới. Đưa anh Tiến đọc.
- [ ] Commit.

### Task 5: Phát hành
- [ ] Duyệt mã 1 lần (1 người duyệt độc lập) toàn bộ bước 152; sửa lỗi nghiêm trọng / quan trọng.
- [ ] Tăng phiên bản `2026.11.19.8` → `2026.11.19.9` mọi chỗ trong `docs`. Đẩy `main`. Ghi `app_releases`.
- [ ] Xoá `.sbp`, tắt máy chủ thử, nhắc anh thu hồi mã `sbp_`.
