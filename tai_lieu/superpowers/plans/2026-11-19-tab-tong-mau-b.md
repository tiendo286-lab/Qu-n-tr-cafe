# Kế hoạch 5 — Tab Tổng mẫu B + Ai còn nợ · Kế hoạch làm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (anh Tiến chọn làm luôn trong phiên, duyệt mã 1 lần cuối). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xếp lại tab Tổng của Sổ thu chi theo mẫu B: đầu trang có 2 khung cao bằng nhau, có giới hạn chiều cao, là "Việc cần làm" và "Ai còn nợ"; bỏ 5 ô nhỏ; khung "So với trang cũ" thu gọn xuống cuối.

**Architecture:** Hai hàm thuần mới trong `docs/js/so_thu_chi_tinh.js` (gom việc, gom người nợ) có bài thử `jsc`. `tongPage` trong `docs/js/pages/so_thu_chi.js` dùng hai hàm này. Các nút dùng lại bộ bắt sự kiện có sẵn của trang (`data-col-debt`, `data-qnok`, `.stc-qnadd`, `.stc-lcadd`, `.stc-kq`). Không đổi máy chủ.

**Tech Stack:** JS thuần (ES modules), mẫu `html``…`` trong `ui.js`, bài thử Chrome qua Playwright với Supabase giả lập (`kiem_tra/trinh_duyet/`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-tab-tong-mau-b-design.md`

## Global Constraints
- Bước 166, không có tệp SQL. Web `2026.11.19.23` (kiểm lại `docs/version.json` trước khi tăng).
- Không đụng vùng khoá (CLAUDE.md). Nút "Mở ›" của ca chưa xác nhận Fabi chỉ là đường dẫn `tab=doi-soat&ds=<id>`, giống hiện nay.
- Quá 7 ngày thì đỏ (`days > 7`), giống `debtBox`.
- Khung có giới hạn chiều cao, cuộn bên trong. Điện thoại 390px không được tràn ngang.
- Quỹ ngoài (`D.ext`) không có khung Việc cần làm / Ai còn nợ.

## Review Focus
- Không có việc nào và không ai nợ: 2 khung hiện "Không còn gì 👍" / "Không còn ai nợ.", khung thấp lại, không để trống.
- Một người có nhiều khoản nợ, lẫn khoản có ✓ và không ✓: gom theo `who` + `no_remind`, không cộng lẫn hai loại.
- Người không phải Chủ: khoản chờ Chủ nhận không có nút "Đã nhận tiền".
- Danh sách dài (20 việc): khung không kéo dài trang (đo chiều cao ≤ giới hạn).
- Các bài thử cũ (`flow_stc1`, `flow_stc5`, `flow_stc6`) vẫn tìm thấy `.stc-big`, `.stc-tf`, `.stc-dd`, `.stc-cmpr`, `.stc-qnl`, `.stc-kqlast`, `#stc-kqbox .stc-kqr`.

---

### Task 1: Hàm thuần gom việc và gom người nợ

**Files:**
- Modify: `docs/js/so_thu_chi_tinh.js` (thêm cuối tệp)
- Test: `kiem_tra/so_thu_chi_tinh_dot10.mjs`

**Interfaces:**
- Produces: `todoItems(D, waitQN = [])` → mảng `{ kind: 'fabi'|'lech'|'cat'|'qn', red: boolean, date, text, amount|null, ref }`. `fabi`: ca có `!recon_money_done` (red, ref = id ca). `lech`: khoản `!void`, `col==='lech'`, `status` có "Chờ" (ref = khoản). `cat`: khoản `!void`, `book==='chi'`, `col==='chi'`, `!cat`. `qn`: từng khoản trong `waitQN`. Xếp: red trước, rồi theo ngày tăng dần.
- Produces: `debtGroups(debts, today)` → `{ main, fam, total, late }`. Mỗi nhóm `{ who, no_remind, total, n, maxDays, ks }`, trong đó `ks` là các khoản có thêm `days`. `main` gồm các nhóm `!no_remind`, xếp `maxDays` giảm dần. `fam` gồm các nhóm `no_remind`. `late` = số nhóm trong `main` có `maxDays > 7`. Chỉ tính khoản `left > 0`.

- [ ] **Step 1:** Viết `kiem_tra/so_thu_chi_tinh_dot10.mjs` với các kiểm tra: thứ tự red trước, ngày tăng dần; bỏ khoản `void`; 2 khoản cùng `who` gom thành 1 nhóm (`n=2`, `total` cộng, `maxDays` lớn nhất); cùng tên mà khác `no_remind` thì tách nhóm; `late` đếm đúng; danh sách rỗng ra `{main:[],fam:[],total:0,late:0}`.
- [ ] **Step 2:** Chạy `jsc -m kiem_tra/so_thu_chi_tinh_dot10.mjs`. Mong đợi: lỗi "does not provide an export".
- [ ] **Step 3:** Viết hai hàm.
- [ ] **Step 4:** Chạy lại bài dot10, rồi dot1, 3, 4, 6, 7, 8, 9. Mong đợi: tất cả đạt.
- [ ] **Step 5:** Commit.

### Task 2: Vẽ lại tab Tổng

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js`: `tongPage`, `fillCounts`, `STYLE`

**Interfaces:**
- Consumes: `todoItems`, `debtGroups` (Task 1).
- Produces (bài thử dựa vào): `.stc-top2` chứa `section.stc-todo` và `section.stc-debts` (mỗi khung có `.stc-scroll`); dòng việc `.stc-ti[data-kind]`; nhóm nợ `details.stc-dp` (trong `.stc-fam` nếu có ✓); `.stc-kqlast` là dòng chữ trong khung Kiểm quỹ; `details.stc-cmp` chứa các `.stc-cmpr`.

- [ ] **Step 1:** Cơ sở: `.stc-top2`, rồi `.stc-bigs` (giữ), rồi `.stc-tfs` (giữ `tf`), rồi hàng nút (giữ class), rồi bảng ngày (giữ), rồi `.stc-two` gồm khung Chuyển về Quỹ ngoài (giữ `.stc-qnl`) và khung Kiểm quỹ (`.stc-kqlast` + `#stc-kqbox`), rồi `details.stc-cmp`. Bỏ `.stc-tiles`, `.stc-layout`, `.stc-aside` khỏi tab Tổng.
- [ ] **Step 2:** Nút của từng việc. `fabi`: liên kết "Mở ›" tới `q({tab:'doi-soat',cot:''})&ds=id`. `lech`: "Xử lý ›" tới `q({tab:x.book,pm:x.pm,cot:'lech'})`. `cat`: "Phân loại ›" tới `q({tab:'chi',pm:x.pm,cot:'chi'})`. `qn`: Chủ có nút `data-qnok`, người khác thấy chữ "chờ Chủ".
- [ ] **Step 3:** Người nợ: `<details class="stc-dp">`, phần `summary` gồm tên, số khoản, số ngày lâu nhất (đỏ khi > 7) và tổng tiền. Mở ra là từng khoản: `from`, số ngày, tiền, nút `data-col-debt`.
- [ ] **Step 4:** `fillCounts` ghi `.stc-kqlast` thành "Lần cuối: tiền mặt dd/mm · tài khoản dd/mm|chưa" và ghi danh sách vào `#stc-kqbox` (không còn `h3` bên trong).
- [ ] **Step 5:** CSS: `.stc-top2` là lưới 2 cột (≤720px thì 1 cột). Mỗi khung `display:flex; flex-direction:column; max-height:340px`; `.stc-scroll{overflow-y:auto;min-height:0;flex:1}`.
- [ ] **Step 6:** Quỹ ngoài: giữ `.stc-bigs`, `.stc-tfs`, ghi chú, bảng ngày, khung tiền các cơ sở chuyển về. Không có `.stc-top2`, không có Kiểm quỹ.

### Task 3: Bài thử Chrome

**Files:**
- Create: `kiem_tra/trinh_duyet/flow_stc13.js`
- Modify: `kiem_tra/trinh_duyet/flow_stc6.js:64` (ô "Ca chưa xác nhận Fabi" → dòng `.stc-ti[data-kind=fabi]`), `kiem_tra/trinh_duyet/README.md`

- [ ] **Step 1:** `flow_stc13` kiểm: có 2 khung, không còn ô `.stc-tile`; khung việc có đủ việc `fabi` của các ca chưa xác nhận (đếm theo `stc_fixture`), red đứng trước; dòng `fabi` dẫn đúng `ds=`; khung nợ: tiêu đề ghi đúng số người + tổng, Kho Tổng nằm trong `.stc-fam`, Cô Lan Anh (10/11) đỏ, bấm Thu nợ mở hộp thoại; cả hai khung cao ≤ 340px; khi bơm thêm 25 việc giả qua `D` (`&stcmany=1` không cần, đo trên dữ liệu thật của giả lập là đủ); Quỹ ngoài không có `.stc-top2`; điện thoại không tràn ngang; role ql không có nút `data-qnok`.
- [ ] **Step 2:** Chạy `flow_stc13`, `flow_stc1`, `flow_stc5`, `flow_stc6` (role chu / qlt / ql, máy tính + `test/phone.html`) và `flow_stc12` (vì cùng tệp). Mong đợi: hỏng 0.
- [ ] **Step 3:** Commit.

### Task 4: Phát hành
- [ ] Duyệt mã 1 lần (superpowers:requesting-code-review).
- [ ] Tăng `docs/version.json`, `ASSET_VERSION` (`docs/js/app.js`) và mọi `?v=` trong `docs/index.html`.
- [ ] Cập nhật `BAN_GIAO.md` (KH5 xong, bước 166), `TINH_NANG_DA_CHOT.md` (dòng tab Tổng), lộ trình, spec (trạng thái: đã làm).
- [ ] Commit, đẩy lên `main`, ghi dòng `app_releases` cho `2026.11.19` (gộp vào dòng của ngày).
