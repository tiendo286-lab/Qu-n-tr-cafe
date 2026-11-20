# Đối soát thu chi 6 bước · đợt B (phần quản lý): người nợ thật + xếp nhóm công nợ — kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi cơ sở có danh sách người nợ thật; quản lý ghi nợ chỉ chọn người trong danh sách; ở bước 1 của ca, quản lý xếp từng khoản nợ mới vào đúng người + nhóm công nợ, chưa xếp hết thì không Hoàn thành đối soát ca được.

**Architecture:** Bảng mới `debt_people` + 4 cột ở `shift_debts`; một trigger gác tên trên `shift_debts` (thay cho vá từng hàm ghi nợ); 3 hàm `app_stc_*` mới; `app__stc_ds_missing` (của tệp 150) định nghĩa lại có thêm mục; `app_stc_month.ca_debts` thêm 4 khoá bằng vá đúng 1 dòng. Giao diện: `so_thu_chi.js` + hàm thuần `dsChecks`, `doi_soat_tc.js`, `cong_no.js`.

**Tech Stack:** Postgres (hàm `app_*` SECURITY DEFINER), JS thuần ES modules, bài thử `jsc -m`, Playwright (`chay_pw.py`), Postgres cục bộ (`kiem_tra/may_chu_cuc_bo/`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md` mục 8, 11, 13, 14, 16. Khảo sát hiện trạng: `work/dot_b_khao_sat.md` (không lưu git).

## Global Constraints

- Tệp SQL mới: `supabase/151_nguoi_no.sql` (xem lại `select max(file) from app_migrations` trước khi phát hành; 20/11 tối là 150). Chạy lại nhiều lần không lỗi; dòng cuối ghi `app_migrations`. Bảng mới bật RLS, thu hồi quyền `anon` / `authenticated`.
- Không dùng `x IN (a, NULL)` / `= NULL` trong kiểm tra quyền; dùng `coalesce`.
- Quyền: mọi hàm mới kiểm `app__stc_need(<cơ sở>)` (mục 11 thiết kế). Không thêm quyền vào `role_permissions`, không sửa `app_can`, `app__stc_can`, `app__stc_need`.
- Không đổi cách tính tiền. Sổ tháng (`app_stc_month`) trước / sau tệp 151 phải giống hệt, trừ 4 khoá mới trong `ca_debts`.
- Nhóm công nợ: `khach` (Nợ khách hàng) · `kho` (Nợ kho tổng) · `khac` (Nợ khác). "Kho tổng" luôn có, không đổi tên, không ngừng dùng.
- Chữ trên giao diện tiếng Việt, theo `docs/assets/style.css`; điện thoại 390px không tràn ngang.
- Bài thử phải hỏng trên bản cũ trước khi sửa. Không tắt / nới bài thử cũ.
- Sau cùng chạy đạt: `sh kiem_tra/chay_tinh.sh`; `flow_ds171`, `flow_ds172` (mới), `flow_stc6`, `flow_stc7` (chu / qlt / ql × máy tính + điện thoại); `flow_ql_tu_ds` (ql, chu × 2 khung); `flow_stc9`, `flow_stc12`, `flow_cn95` (`&confirm=1`), `flow_cm84`.
- **Ngoài phạm vi (Ruling R1):** phiếu chốt ca của nhân viên (ô chọn khách, "Nợ khách (chung)", ô Nội dung bắt buộc — mục 8.4, 8.5). Nhân viên vẫn gõ tên như hiện nay; máy chủ CHƯA chặn tên gõ tay của nợ ghi trong phiếu ca. Lý do: phần này dính bản mẫu phiếu chốt ca 8 bước anh Tiến chưa chốt. Nếu sai: phải làm thêm một đợt cho phiếu nhân viên.

## Review Focus

1. Khoản nợ cũ gõ tay (không có người trong danh sách) bị tách khi khách trả thiếu → khoản con vẫn phải tạo được (trigger miễn cho `split_from` / `rest_of` / `from_loan`).
2. Đổi tên một người nợ → mọi khoản chưa thu của người đó đổi `table_name` theo, tab Công nợ vẫn gộp đúng.
3. Nhân viên sửa lại tên khoản nợ sau khi quản lý đã xếp → khoản đó phải về "chưa xếp".
4. Khoản nợ đã trả hết không bị đòi xếp; khoản trả một phần (còn khoản con chưa thu) vẫn phải xếp.
5. Hai tên chỉ khác hoa / thường hoặc khoảng trắng đầu cuối là một người.

---

### Task 1: Máy chủ — danh sách người nợ + trigger gác tên

**Files:**
- Create: `supabase/151_nguoi_no.sql`
- Test: `kiem_tra/nguoi_no_151_cuc_bo.sql` (kiểu `REPORT>>`, tự dựng dữ liệu giả, tự hoàn tác; chạy bằng `kiem_tra/may_chu_cuc_bo/dat.sh`)

**Interfaces — Produces:**
- Bảng `public.debt_people(id bigserial pk, branch_id bigint not null → branches, name text not null, phone text, grp text not null default 'khach' check in ('khach','kho','khac'), active int not null default 1, created_by bigint → accounts, created_at text default vn_now_text())`; chỉ mục duy nhất `(branch_id, lower(btrim(name)))`.
- `shift_debts` thêm: `person_id bigint → debt_people`, `content text`, `sorted_by bigint → accounts`, `sorted_at text`.
- `app_stc_people(p_branch bigint) returns jsonb` → `[{id, name, phone, grp, active, open, n}]` (mọi người của cơ sở, kể cả đã ngừng dùng; `open` / `n` = tổng tiền / số khoản chưa thu theo `person_id`), xếp `active desc, grp, name`.
- `app_stc_person_save(p_id bigint, p jsonb) returns bigint` — `p = {branch_id, name, phone, grp, active}`; `p_id` null = thêm. Lỗi: `'Nhập tên người nợ.'`, `'Chọn nhóm công nợ.'`, `'Đã có người nợ tên này.'`, `'Kho tổng luôn có — không đổi tên / ngừng dùng được.'`. Đổi tên → `update shift_debts set table_name = <tên mới> where person_id = id and closed_at is null`; đổi nhóm → cập nhật `grp` của các khoản chưa thu của người đó. Ghi `app_log('stc_nguoi_no_luu', …)`.
- Trigger `stc_debt_person` (`before insert or update of table_name on shift_debts`, hàm `app__debt_person_guard()`):
  - khoản có `split_from` / `rest_of` / `from_loan`: lúc thêm thì thừa hưởng `person_id`, `sorted_by`, `sorted_at`, `content` của khoản gốc; cho qua.
  - sửa mà tên không đổi (so `lower(btrim())`): cho qua.
  - tên khớp một người **đang dùng** của cơ sở: đặt `person_id`, chuẩn `table_name` theo tên trong danh sách.
  - không khớp + `report_id` có giá trị (nợ ghi trong phiếu ca): cho qua, `person_id := null`.
  - không khớp + `report_id` trống: `raise exception 'Người nợ "%" chưa có trong danh sách. Thêm ở Sổ thu chi › Sổ chi › 👥 Người nợ trước.'`.
  - tên đổi mà lần sửa đó không tự đặt `sorted_at` → `sorted_at := null, sorted_by := null`.
- `app_ca_debt_people(p_branch)` định nghĩa lại: đọc `debt_people` đang dùng nhóm `kho` / `khac`, vẫn trả `[{name, grp}]` + luôn có "Kho tổng" (phiếu nhân viên không đổi).
- Chạy bù MỘT LẦN (khi tệp chưa có trong `app_migrations`): thêm người từ tên đang có (nhóm `kho` / `khac` lấy hết; nhóm `khach` chỉ tên còn khoản chưa thu; nhóm + SĐT lấy theo khoản mới nhất); thêm "Kho tổng" cho mọi cơ sở; gắn `person_id` cho khoản khớp tên; khoản thuộc ca đã có `stc_ca_done` → `sorted_at = 'trước bước 172'`.

- [ ] **Step 1: Viết bài thử hỏng** — `kiem_tra/nguoi_no_151_cuc_bo.sql`, mỗi mục một dòng `ĐẠT/HỎNG (n) …`:
  (1) sau tệp 151 có "Kho tổng" ở mọi cơ sở; (2) chạy bù: tên nhóm `kho`/`khac` có trong danh sách, tên `khach` đã thu hết thì không; (3) `app_stc_person_save` thêm người → có trong `app_stc_people`; thêm trùng tên khác hoa thường → lỗi "Đã có người nợ tên này."; (4) đổi tên → khoản chưa thu đổi `table_name`, khoản đã thu giữ nguyên; (5) ngừng dùng → `active = 0`, tên đó không còn nhận ở Cho nợ; (6) đổi tên / ngừng dùng "Kho tổng" → lỗi; (7) `app_cn_debt_save` (nợ ngoài ca) tên lạ → lỗi "chưa có trong danh sách"; tên có sẵn viết khác hoa thường → nhận, `person_id` đúng, `table_name` chuẩn lại; (8) nợ trong phiếu ca tên lạ → vẫn thêm được, `person_id` null; (9) khoản con `split_from` của nợ cũ gõ tay → thêm được; (10) nhân viên (không vào được Sổ thu chi) gọi `app_stc_people` / `app_stc_person_save` → lỗi quyền; (11) chạy tệp 151 lần hai không lỗi, không nhân đôi người.
- [ ] **Step 2: Chạy, thấy hỏng** — `PG_DIR=<pg> sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/nguoi_no_151_cuc_bo.sql` → Expected: lỗi "function app_stc_people does not exist" (chưa có tệp 151).
- [ ] **Step 3: Viết `supabase/151_nguoi_no.sql`** phần Task 1 theo Interfaces.
- [ ] **Step 4: Chạy tệp 151 hai lần trên Postgres cục bộ rồi chạy bài thử** → Expected: `KẾT QUẢ: ĐẠT 11 dòng, 0 hỏng`.
- [ ] **Step 5: Commit** `Bước 172 đợt B (1/7): máy chủ tệp 151 — danh sách người nợ, trigger gác tên; bài thử cục bộ`.

### Task 2: Máy chủ — xếp nhóm công nợ + mục `phanloai`

**Files:**
- Modify: `supabase/151_nguoi_no.sql` (thêm phần 2)
- Modify: `kiem_tra/nguoi_no_151_cuc_bo.sql`
- Create: `kiem_tra/nguoi_no_151_truoc.sql`, `kiem_tra/nguoi_no_151.sql` (bó gửi máy chủ thật, tự hoàn tác, như cặp tệp của 150)

**Interfaces:**
- Consumes: `debt_people`, 4 cột mới (Task 1); `app__stc_ds_need`, `stc_ca_done`, `app__stc_ds_missing` (tệp 150).
- Produces:
  - `app_stc_debt_sort(p_debt bigint, p_person bigint, p_grp text) returns void` — quyền `app__stc_ds_need(<ca của khoản nợ>, false)` nếu khoản có `report_id`, ngược lại `app__stc_need(<cơ sở>)`. Lỗi: `'Không tìm thấy khoản nợ.'`, `'Khoản nợ đã thu — không đổi được.'` (khoản gốc và mọi khoản con đều đã thu), `'Chọn người nợ trong danh sách.'` (người lạ / khác cơ sở / đã ngừng dùng), `'Chọn nhóm công nợ.'`, `'Ca đã hoàn thành đối soát — bấm Mở lại trước.'`, tháng đã chốt. Việc làm: `content := coalesce(content, <tên cũ>)` khi tên cũ khác tên người; `table_name := <tên người>`, `person_id`, `grp := p_grp`, `sorted_by`, `sorted_at := vn_now_text()`; áp cho cả các khoản con chưa thu (`split_from` đệ quy). Ghi `shift_recon_log` (`action = 'xep_no'`) khi có `report_id`, và `app_log('stc_xep_no', …)`.
  - `app__stc_ds_missing(p_report)` định nghĩa lại nguyên thân của tệp 150 + thêm sau các mục bước 1: đếm khoản gốc của ca (`report_id = p_report`, `split_from is null`, `amount > 0`) còn tiền chưa thu trong cây tách và `sorted_at is null` → `format('Còn %s khoản nợ mới chưa xếp người + nhóm công nợ', n)`.
  - `app_stc_month`: vá 1 dòng — neo `'amount', s.amt, 'left', s.lft, 'pm', null, 'from', null) z, g.report_id rid, 'moi' t` thay `'from', null)` bằng `'from', null, 'grp', g.grp, 'person_id', g.person_id, 'sorted', g.sorted_at is not null, 'content', g.content)`; không thấy neo và chưa có `'sorted'` thì `raise exception`.

- [ ] **Step 1: Thêm mục hỏng vào bài thử cục bộ:** (12) `app__stc_ds_missing` của ca đã xác nhận có 1 nợ mới chưa xếp → có dòng "chưa xếp người + nhóm công nợ"; (13) nhân viên gọi `app_stc_debt_sort` → lỗi quyền; (14) xếp với người đã ngừng dùng → lỗi; (15) xếp đúng → `person_id`, `grp`, `sorted_at` có, `table_name` = tên người, `content` = tên nhân viên gõ; dòng thiếu biến mất; (16) nhân viên sửa lại tên khoản đó (update `table_name`) → `sorted_at` về null; (17) khoản đã thu hết → không bị đòi xếp, xếp thì lỗi "đã thu"; (17b) khoản trả một phần (khoản gốc đã thu, còn khoản con `split_from` chưa thu) → vẫn bị đòi xếp, xếp thì khoản con cũng nhận người + nhóm; (18) ca đã Hoàn thành → xếp bị chặn "Mở lại trước"; (19) `app_stc_month` → dòng `ca_debts` kiểu `moi` có đủ 4 khoá mới.
- [ ] **Step 2: Chạy, thấy hỏng ở (12)–(19)** (hàm chưa có).
- [ ] **Step 3: Viết phần 2 của tệp 151.**
- [ ] **Step 4: Chạy lại tệp 151 (2 lần) + bài thử** → Expected: `KẾT QUẢ: ĐẠT 19 dòng, 0 hỏng`. Chạy thêm bài của đợt A `kiem_tra/doi_soat_6_buoc_150_cuc_bo.sql` → vẫn `ĐẠT 28 dòng`.
- [ ] **Step 5: Viết bó máy chủ thật:** `nguoi_no_151_truoc.sql` chụp `app_stc_month` của tháng hiện tại mọi cơ sở vào bảng tạm; `nguoi_no_151.sql` so lại (bỏ 4 khoá mới) + (a) số người chạy bù theo cơ sở, (b) mọi cơ sở có "Kho tổng", (c) mọi khoản của ca đã `stc_ca_done` có `sorted_at`, (d) thử xếp 1 khoản nợ thật chưa thu rồi kiểm, (e) nhân viên bị từ chối. Chạy thử trọn bó trên Postgres cục bộ → toàn ĐẠT.
- [ ] **Step 6: Commit** `Bước 172 đợt B (2/7): máy chủ — xếp nhóm công nợ, mục phanloai chặn Hoàn thành; bó thử máy chủ thật`.

### Task 3: Hàm thuần — mục `phanloai`

**Files:**
- Modify: `docs/js/so_thu_chi_tinh.js` (`dsChecks`, `dsCtx`)
- Create: `kiem_tra/so_thu_chi_tinh_dot13.mjs`; Modify: `kiem_tra/chay_tinh.sh` không cần (đã quét `dot*.mjs`)

**Interfaces:**
- `dsChecks(ca, { checks, items, gaps, next, last, debts = [] })`: bước 1 thêm mục `{ k: 'phanloai', auto: true, ok: <không còn khoản chưa xếp>, txt: 'Nợ mới của ca đã xếp đúng người + nhóm công nợ' }` — chỉ hiện khi ca có khoản nợ mới còn tiền chưa thu (`t === 'moi' && Number(left) > 0`); `ok` khi mọi khoản đó `sorted === true`. Đứng sau mục `no`, trước `hd`.
- `dsCtx(D, ca)` trả thêm `debts: (D.ca_debts || []).filter((x) => Number(x.report_id) === Number(ca.id) && x.t === 'moi')`.

- [ ] **Step 1: Bài thử hỏng** `so_thu_chi_tinh_dot13.mjs`: (a) ca không có nợ mới → bước 1 không có `phanloai`; (b) 2 nợ mới, 1 chưa xếp → có `phanloai`, `ok === false`, `dsLeft` bước 1 tăng 1; (c) xếp hết → `ok === true`; (d) nợ mới đã trả hết (`left: 0`) chưa xếp → không tính; (e) `dsCtx` lấy đúng khoản của ca, bỏ dòng `t: 'tra'`.
- [ ] **Step 2:** `sh kiem_tra/chay_tinh.sh` → Expected: `dot13` HỎNG, các tệp khác ĐẠT.
- [ ] **Step 3:** Sửa `dsChecks`, `dsCtx`.
- [ ] **Step 4:** `sh kiem_tra/chay_tinh.sh` → Expected: 12 tệp ĐẠT.
- [ ] **Step 5: Commit** `Bước 172 đợt B (3/7): mục kiểm tra phanloai (hàm thuần + bài thử)`.

### Task 4: Giao diện — 👥 Người nợ là danh sách thật

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` (tải dữ liệu dòng ~44, `peopleBox`, `peopleDialog`, `addPersonDialog`, bắt sự kiện `data-person` / `data-padd`)
- Modify: `kiem_tra/trinh_duyet/stc_gia.js`, `stc_fixture.js` (người nợ có `id, phone, grp, active`; thêm `app_stc_people`, `app_stc_person_save`)
- Create: `kiem_tra/trinh_duyet/flow_ds172.js`; Modify: `flow_stc9.js`, `flow_stc12.js` (đang bấm ô ✓ không nhắc / + Thêm người nợ), `README.md`

**Interfaces:**
- Consumes: `app_stc_people`, `app_stc_person_save` (Task 1).
- Produces: `D.people = [{id, name, phone, grp, active, open, n, no_remind}]` (`no_remind = grp !== 'khach'`, giữ cho mã cũ); `personSelect(D, { name, id, attrs })` trả `<select>` các người **đang dùng**, nhóm theo `<optgroup>` 3 nhóm, kèm ô tìm không dấu `[data-pfind]` phía trên khi quá 8 người; `personDialog(D, person | null, onDone)` (Tên · SĐT · Nhóm · với người đang có thêm nút "Ngừng dùng" / "Dùng lại").
- Hộp 👥 Người nợ: mỗi dòng `[data-prow="<id>"]` hiện tên, SĐT, nhãn nhóm, số khoản + tiền còn nợ, nút `[data-pedit="<id>"]`; người ngừng dùng xếp cuối, chữ mờ. Nút `[data-padd]` mở `personDialog(D, null)` (không còn mở phiếu Cho nợ). Bỏ ô tích ✓ không nhắc; dòng chú thích: "Nợ khách hàng: phiếu chốt ca nhắc thu. Nợ kho tổng / Nợ khác: không nhắc."

- [ ] **Step 1: Bài thử hỏng** `flow_ds172.js` phần 1 (vai chu): mở Sổ chi › 👥 Người nợ → thấy `[data-prow]` đủ người của dữ liệu giả, có nhãn nhóm; bấm `[data-padd]` → điền tên + SĐT + nhóm Nợ khác → lưu → dòng mới hiện; thêm trùng tên → báo "Đã có người nợ tên này."; `[data-pedit]` đổi nhóm → nhãn đổi; Ngừng dùng → dòng mờ; "Kho Tổng" không có nút Ngừng dùng; khung 390px không tràn ngang.
- [ ] **Step 2:** chạy `flow_ds172` vai chu → Expected: HỎNG (chưa có `[data-prow]`).
- [ ] **Step 3:** sửa giả lập + giao diện.
- [ ] **Step 4:** `flow_ds172` chu / qlt / ql × 2 khung ĐẠT; sửa `flow_stc9`, `flow_stc12` theo giao diện mới (giữ nguyên các khẳng định về tiền) → ĐẠT.
- [ ] **Step 5: Commit** `Bước 172 đợt B (4/7): 👥 Người nợ là danh sách thật — thêm / sửa / ngừng dùng`.

### Task 5: Giao diện — ghi nợ chỉ chọn tên có sẵn

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` (`:239` Sửa cho nợ, `:272` + `:331` Thêm phiếu › Cho nợ, `debtPills` / `setWho`)
- Modify: `docs/js/doi_soat_tc.js` (`:92–104` đổi khoản chi thành nợ), `docs/js/pages/cong_no.js` (`:134` thêm nợ, `:183` sửa tên người), `docs/js/pages/phieu_ca.js` (CHỈ hộp "+ Báo nợ" gọi `app_ca_recon_debt` ở `:1566`, và chỉ khi còn nút mở hộp này; mã chết thì để nguyên — Ruling R2: mục 8.3 thiết kế đòi "+ Báo nợ" chọn tên có sẵn, thắng ghi chú "không đổi gì khác trong tệp này" ở mục 14)
- Modify: `kiem_tra/trinh_duyet/flow_ds172.js`, `stc_gia.js` (từ chối tên lạ ở `app_stc_debt_save`), bài của Công nợ nếu hỏng (`flow_cn95`)

**Interfaces:**
- Consumes: `personSelect`, `personDialog` (Task 4); trigger gác tên (Task 1).
- Mọi ô "Người nợ" gõ tay ở 5 chỗ trên thành `personSelect` + lựa chọn cuối `+ Thêm người nợ…` (mở `personDialog`, lưu xong chọn luôn người mới). Gửi lên máy chủ vẫn là `name` (tên người) + `grp` (nhóm của người) như các hàm đang nhận — không đổi chữ ký hàm.
- `doi_soat_tc.js` và `cong_no.js` lấy danh sách bằng `app_stc_people`; gọi lỗi (người không vào được Sổ thu chi) thì dùng `app_ca_debt_people` như cũ và để máy chủ báo lỗi tên lạ.
- `cong_no.js:183` (đổi tên người ở Công nợ): bỏ ô sửa tên, thay bằng dòng dẫn "Đổi tên / nhóm ở Sổ thu chi › Sổ chi › 👥 Người nợ".

- [ ] **Step 1: Bài thử hỏng** `flow_ds172.js` phần 2: + Thêm phiếu › Cho nợ không còn `input[name=name]`, có `select[name=person]`; chọn "Kho Tổng" lưu được, phiếu hiện đúng tên; chọn `+ Thêm người nợ…` → thêm → được chọn sẵn; dòng Cho nợ đổi người chỉ có tên đang dùng.
- [ ] **Step 2:** chạy → HỎNG (còn ô gõ).
- [ ] **Step 3:** sửa 3 tệp giao diện + giả lập.
- [ ] **Step 4:** `flow_ds172` (3 vai × 2 khung), `flow_stc9`, `flow_stc12`, `flow_cn95&confirm=1`, `flow_ql_tu_ds` ĐẠT.
- [ ] **Step 5: Commit** `Bước 172 đợt B (5/7): Cho nợ / đổi khoản chi thành nợ / Công nợ chỉ chọn người có sẵn`.

### Task 6: Giao diện — bước 1 xếp nhóm công nợ

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` (`debtList` ~`:1101`, `dsAct`, chuỗi CSS trong tệp)
- Modify: `kiem_tra/trinh_duyet/flow_ds172.js`, `flow_ds171.js` (ca thử Hoàn thành nay có nợ mới phải xếp trước, hoặc dùng ca không nợ), `stc_gia.js` (`app_stc_debt_sort`, `ca_debts` có 4 khoá, `app_stc_ds_done` kiểm `phanloai`), `stc_fixture.js`

**Interfaces:**
- Consumes: `app_stc_debt_sort` (Task 2), `dsChecks` có `phanloai` (Task 3), `personSelect` (Task 4).
- Mỗi dòng "Nợ mới trong ca" còn tiền chưa thu, khi người xem được đối soát ca và ca chưa Hoàn thành: `[data-dsort="<id>"]` gồm `personSelect` (chọn sẵn người khớp `person_id`, hoặc khớp tên), `select[data-dgrp]` 3 nhóm (chọn sẵn nhóm của người), nút `[data-dsortok="<id>"]` "Xếp". Đã xếp: nhãn `.pill.ok` "✓ <tên> · <nhóm>" + nút nhỏ `[data-dsortedit="<id>"]` "Đổi". Tên nhân viên gõ (`content` hoặc `who` khi chưa xếp) hiện dòng phụ "NV ghi: …". Khoản đã trả: không có điều khiển.
- Khung "Quản lý cần kiểm tra" của bước 1 có mục `phanloai` (tự tích khi xếp hết). Nút Hoàn thành ở bước 6 vẫn theo `dsLeft`.

- [ ] **Step 1: Bài thử hỏng** `flow_ds172.js` phần 3: mở ca đã xác nhận có 2 nợ mới (1 tên có trong danh sách, 1 tên lạ) → bước 1 có mục `phanloai` chưa tích, số còn lại của bước 1 ≥ 1; bước 6 nút Hoàn thành bị khoá; xếp khoản 1 bằng 1 lần bấm "Xếp" (gợi ý sẵn); khoản 2 chọn người + nhóm → Xếp → mục `phanloai` tích ✓; tích nốt các mục tay → Hoàn thành được; Mở lại → vẫn giữ đã xếp; vai nhân viên không thấy `[data-dsort]`; 390px không tràn ngang.
- [ ] **Step 2:** chạy → HỎNG (chưa có `[data-dsort]`).
- [ ] **Step 3:** sửa giao diện + giả lập.
- [ ] **Step 4:** chạy cả bộ ở Global Constraints → ĐẠT hết.
- [ ] **Step 5: Commit** `Bước 172 đợt B (6/7): bước 1 — quản lý xếp người + nhóm công nợ cho nợ mới của ca`.

### Task 7: Tài liệu + phát hành

**Files:** `tai_lieu/TINH_NANG_DA_CHOT.md` (mục Sổ thu chi, thêm "Bước 172 · đợt B"), `tai_lieu/BAN_GIAO.md`, spec mục 17 (ghi tách phần phiếu nhân viên), `docs/version.json` + mọi `?v=`.

- [ ] **Step 1:** cập nhật 3 tài liệu; commit.
- [ ] **Step 2:** rà cả nhánh (tự rà hoặc một trợ lý rà độc lập nếu anh Tiến yêu cầu); sửa phát hiện Critical / Important theo TDD.
- [ ] **Step 3:** phát hành theo đúng trình tự đợt A (xem `BAN_GIAO.md` mục 20/11 tối): bước 1 chạy thử bó trên máy chủ thật → toàn ĐẠT → bước 2 chạy thật (kiểm trước, cất bản cũ của `app__stc_ds_missing`, `app_ca_debt_people`, `app_stc_month`) → tăng phiên bản → đẩy `main` → kiểm web → ghi `app_releases` → nhắc anh Tiến Revoke mã.
