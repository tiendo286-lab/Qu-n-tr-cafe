# Việc tự thêm theo lịch + việc có sẵn chia cơ sở — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ tự thêm việc lặp lại vào Bảng phân công, cài riêng từng cơ sở (người làm, chu kỳ, ngày làm, quá hạn cho phép, mức phạt, người + hạn kiểm tra, bắt buộc ảnh); sau đó 10 việc có sẵn dùng chung hộp cài đặt từng cơ sở.

**Architecture:** Chạy trên hệ Bảng phân công (`pc_*`, bước 109). Việc tự thêm = dòng `pc_jobs` số ≥ 100 (`custom = true`); lịch từng cơ sở ở bảng mới `pc_sched`; `app__pc_tick` (5 phút/lần) thêm phần E tạo việc theo lịch. Báo xong / kiểm tra là 2 hàm mới. Lần 2 dùng lại `pc_sched` cho việc có sẵn (hạn, phạt, kiểm tra, riêng Kiểm quỹ có lịch).

**Tech Stack:** Supabase Postgres (plpgsql SECURITY DEFINER `app_*`), web tĩnh ES modules (`docs/js`), giả lập `kiem_tra/trinh_duyet/pc_gia.js`, bài thử trình duyệt `flow_*.js`, bài thử SQL tự hoàn tác.

**Spec:** `tai_lieu/superpowers/specs/2026-11-17-viec-tu-them-design.md` · mẫu https://claude.ai/artifact/XowQgnN7pt1WoSM4SLpSZb

## Global Constraints
- Lần 1 = `supabase/106_viec_tu_them.sql` (không đụng việc có sẵn); lần 2 = `supabase/107_viec_co_san_tung_co_so.sql`. Mỗi tệp chạy lại nhiều lần không sao, dòng cuối `insert into public.app_migrations(file) values ('NN_….sql') on conflict (file) do nothing;`.
- Bảng mới: `revoke all … from anon, authenticated`; web chỉ gọi hàm `app_*`; hàm `app__*` thu hồi quyền gọi từ web.
- Kiểm quyền bằng `coalesce`, không `x IN (a, NULL)`.
- Chỉ tài khoản Chủ thêm / sửa / xoá (`app__need('phan_cong')` + `system_role = 'chu'`, câu lỗi "Chỉ tài khoản Chủ sửa được Bảng phân công."). QL tổng xem.
- Hạn việc theo lịch = `ngày làm 23:59:59 + quá hạn cho phép`. Quá hạn cho phép (giờ): 0, 2, 4, 12, 24, 48, 72, 168. Hạn kiểm tra (giờ): 2, 4, 12, 24, 48, 72 (mặc định 24). Hạn làm lại (giờ): 4, 12, 24, 48, 72 (mặc định 24).
- Hằng tháng ngày lớn hơn số ngày của tháng → ngày cuối tháng. Hằng tuần `day` = 1 (Thứ Hai) … 7 (Chủ nhật).
- Không tạo ngược trước ngày lưu lịch (`from_date`); bù tối đa 7 ngày nếu máy chủ lỡ chạy; khoá trùng `pc_tasks.key = 'cu:<job>:<branch>:<YYYY-MM-DD>'`.
- Làm bổ sung: đúng 1 việc cho lần làm gần nhất trước `from_date` (trong 31 ngày), `pc_tasks.extra = true`, **không bao giờ phạt**, không đặt hạn.
- Có kiểm tra: bắt buộc chọn người kiểm tra cho mọi cơ sở đang bật ("Chọn người kiểm tra cho <cơ sở>."); người kiểm tra khác người làm ("Người kiểm tra phải khác người làm."). Quá hạn kiểm tra → người kiểm tra vào Quá hạn & phạt, cùng mức phạt cơ sở.
- Bắt buộc ảnh: thiếu ảnh → "Cần ít nhất 1 ảnh mới báo xong được." Ảnh lưu kho `phieu-ca`, thư mục `pc<task_id>/`.
- Xoá việc tự thêm: việc đang mở huỷ (`done_note = 'Việc đã bị xoá'`), lịch sử + phạt giữ. Việc có sẵn không xoá.
- Mỗi lần đẩy giao diện: tăng `?v=` (các tệp nhập + `app.js` ASSET_VERSION + `index.html`) và `docs/version.json`; ghi `app_releases`; chạy thử máy chủ (tự hoàn tác) trước khi chạy thật; cập nhật Supabase **trước** khi đẩy giao diện cần nó.
- Commit `Tien Do <tiendo286@gmail.com>`, dòng cuối `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không đưa mã `sbp_`, tên nhân viên thật lên GitHub.
- Kiểm tra giao diện cả `index.html` và `test/phone.html` (390px), không tràn ngang.

## Review Focus
1. Tick chạy nhiều lần trong ngày / qua nửa đêm → không tạo trùng (t02).
2. Tháng 2 + lịch ngày 31 → làm ngày 28/29 (t02).
3. Lưu lịch cơ sở 2 lần trong ngày → vẫn 1 việc bổ sung, không tạo thêm (t02).
4. Người kiểm tra bị khoá tài khoản → bước Kiểm tra "chưa có người", Chủ vẫn bấm Đạt được (t03).
5. Lần 2 vừa chạy xong: việc đang mở, hạn, mức phạt của việc có sẵn **không đổi** (t04).

---

## LẦN 1 — Việc tự thêm (106)

### Task 1: Máy chủ — bảng + lưu / xoá việc tự thêm

**Files:**
- Create: `supabase/106_viec_tu_them.sql` (phần 1)
- Test: `kiem_tra/viec_tu_them/t01_luu_viec.sql`

**Interfaces — Produces:**
- `pc_jobs` thêm cột `name text, guide text, need_photo boolean default false, need_check boolean default false, custom boolean default false, deleted_at text`.
- `pc_sched(job int, branch_id bigint, enabled boolean default true, cycle text check (cycle in ('ngay','tuan','thang')), day int, grace_h numeric default 24, fine bigint default 50000, checkers bigint[] default '{}', check_h numeric default 24, due_h numeric, from_date text, updated_by bigint, updated_at text, primary key (job, branch_id))` (`due_h` dùng ở lần 2).
- `pc_tasks` thêm `extra boolean default false, run_date text`; `pc_steps` thêm `note text, photos text[] default '{}', redo boolean default false`.
- `app_pc_custom_save(p_job int, p jsonb) returns int` — `p_job null` = thêm mới (số = greatest(100, max+1)). `p = {name, guide, need_photo, need_check, enabled, apply, rows:[{branch_id, enabled, accounts:[], cycle, day, grace_h, fine, checkers:[], check_h}]}`. Ghi `pc_jobs` (steps `[{"n":"Làm","who":"branch","d":null}]` + `{"n":"Kiểm tra","who":"check","d":null}` nếu `need_check`), `pc_assign` (người làm), `pc_sched`; `from_date` = hôm nay khi dòng mới hoặc đổi `cycle/day`. `apply = true` chuyển người cho bước Làm đang mở. Trả số việc.
- `app_pc_custom_delete(p_job int) returns int` — trả số việc đang mở bị huỷ.
- `app_pc_board()` trả thêm: mỗi job có `name, guide, need_photo, need_check, custom`; khoá `sched` = các dòng `pc_sched`; bỏ job đã xoá.

- [ ] **Step 1: Viết t01** (khối `begin … rollback`, in `REPORT>> PASS/FAIL` từng ý, mẫu `kiem_tra/audit_tien/t08_luu_ca_goi.sql`): a) Chủ lưu việc mới 2 cơ sở (1 tắt) → trả số ≥ 100, `pc_sched` 2 dòng, `pc_assign` có người làm, steps 1 bước; b) thiếu tên → "Ghi tên việc."; c) `need_check` mà cơ sở bật chưa có người kiểm tra → "Chọn người kiểm tra cho <mã cơ sở>."; d) người kiểm tra trùng người làm → "Người kiểm tra phải khác người làm."; e) QL tổng gọi → "Chỉ tài khoản Chủ sửa được Bảng phân công."; f) lưu lại đổi `day` → `from_date` = hôm nay, không đổi `day` → giữ `from_date`; g) xoá khi có 1 việc đang mở → trả 1, việc có `done_note = 'Việc đã bị xoá'`, `app_pc_board` không còn việc đó; h) `app_pc_custom_delete(1)` → "Chỉ xoá được việc tự thêm.".
- [ ] **Step 2: Chạy t01 (chưa có 106)** — `bash $S/run_t.sh kiem_tra/viec_tu_them/t01_luu_viec.sql` → lỗi "function app_pc_custom_save does not exist".
- [ ] **Step 3: Viết phần 1 của 106** theo Interfaces (định nghĩa lại `app_pc_board` từ bản đang chạy trên máy chủ, chỉ thêm khoá).
- [ ] **Step 4: Chạy t01 kèm 106** (ghép 106 vào đầu cùng giao dịch) → mọi ý PASS.
- [ ] **Step 5: Commit** `106 (1/3): bảng + lưu / xoá việc tự thêm (chưa chạy thật)`.

### Task 2: Máy chủ — tạo việc theo lịch, làm bổ sung, phạt theo cơ sở

**Files:** Modify `supabase/106_viec_tu_them.sql` (phần 2) · Test `kiem_tra/viec_tu_them/t02_tao_viec.sql`

**Interfaces:**
- Consumes: Task 1 bảng/cột.
- Produces: `app__pc_runs(p_cycle text, p_day int, p_from date, p_to date) returns setof date` (ngày làm trong khoảng, hằng tháng kẹp ngày cuối tháng); `app__pc_tick()` thêm phần E (sau C, trước D); `app__pc_who(job, 'check', branch)` = `pc_sched.checkers`; `app__pc_open_step` tính hạn việc tự thêm: bước 0 = `run_date 23:59:59 + grace_h giờ` (việc `extra` → null), bước Kiểm tra = `start + check_h giờ`; phạt (phần D) dùng `coalesce(pc_sched.fine, pc_jobs.fine)` theo (job, branch) và bỏ `pc_tasks.extra`; `app_pc_penalties` trả `fine` theo cơ sở; `app__pc_task_json` thêm `job_name, guide, need_photo, need_check, custom, extra, run_date, fine` (theo cơ sở) và mỗi bước `note, photos, redo`.
- Tên việc: `<name> · <mã cơ sở> · <dd/mm>`; thông báo "Việc mới: <tên>" như hiện nay.

- [ ] **Step 1: Viết t02:** a) lịch tuần `day` = thứ hôm nay, `from_date` hôm nay → 1 việc, hạn = hôm nay 23:59:59 + grace; b) gọi tick 2 lần → vẫn 1 việc (key `cu:…`); c) `app__pc_runs('thang',31,'2027-02-01','2027-02-28')` = `2027-02-28`, tháng 4 → `30/04`; d) lịch tuần `day` = hôm qua → có 1 việc `extra = true`, hạn null; lưu lại lịch lần 2 trong ngày → vẫn 1 việc extra; e) đẩy hạn việc thường về quá khứ (replica) + tick → 1 dòng `pc_penalties` mức gợi ý = `fine` cơ sở; việc extra không có dòng phạt; f) cơ sở tắt → không có việc; g) việc tắt cả (`enabled=false`) → không có việc.
- [ ] **Step 2: Chạy t02 kèm 106 phần 1** → FAIL (chưa có `app__pc_runs` / phần E).
- [ ] **Step 3: Viết phần 2** (định nghĩa lại `app__pc_tick`, `app__pc_who`, `app__pc_open_step`, `app_pc_penalties`, `app__pc_task_json` từ bản đang chạy trên máy chủ — lấy bằng `pg_get_functiondef`, không lấy từ tệp 95 cũ).
- [ ] **Step 4: Chạy t01 + t02 kèm 106** → PASS hết.
- [ ] **Step 5: Commit** `106 (2/3): tạo việc theo lịch, làm bổ sung, phạt theo cơ sở`.

### Task 3: Máy chủ — báo xong + kiểm tra

**Files:** Modify `supabase/106_viec_tu_them.sql` (phần 3) · Test `kiem_tra/viec_tu_them/t03_bao_xong.sql`

**Interfaces — Produces:**
- `app_pc_report_done(p_task bigint, p_note text, p_photos text[]) returns void` — bước đang mở phải là bước Làm của việc `custom` hoặc bước `redo = true`; người trong `accounts` hoặc Chủ; `need_photo` mà không ảnh → lỗi chuẩn; ghi `note, photos`; có kiểm tra → mở bước Kiểm tra, báo người kiểm tra "Việc chờ bạn kiểm tra"; không → đóng việc.
- `app_pc_check(p_task bigint, p_ok boolean, p_note text, p_hours numeric) returns void` — bước đang mở là Kiểm tra; người trong `accounts` hoặc Chủ; Đạt → đóng việc, báo người làm "Việc đã Đạt"; Làm lại → bắt buộc lý do ("Ghi lý do làm lại."), `p_hours` trong danh sách cho phép, đóng bước Kiểm tra (ghi `note`), mở lại bước 0 với người làm cũ, `redo = true`, hạn = now + p_hours, báo "Việc cần làm lại".
- `app_pc_step_done` từ chối việc `custom` ("Bấm Báo xong ở thẻ việc.").

- [ ] **Step 1: Viết t03:** a) `need_photo` + không ảnh → lỗi chuẩn; có ảnh → không có kiểm tra thì việc đóng, bước có `photos`; b) có kiểm tra → mở bước 1, `accounts` = checkers, hạn = now + check_h; c) người làm gọi `app_pc_check` → "Bước này không giao cho bạn."; d) Làm lại thiếu lý do → lỗi; đủ → bước 0 mới `redo`, hạn now+24h, người làm cũ; báo xong lần 2 → lại sang Kiểm tra; Đạt → đóng; e) người kiểm tra bị khoá → `accounts` rỗng, Chủ Đạt được; f) quá hạn kiểm tra → dòng phạt cho người kiểm tra, bước "Kiểm tra".
- [ ] **Step 2: Chạy t03 kèm 106 phần 1–2** → FAIL.
- [ ] **Step 3: Viết phần 3** (+ định nghĩa lại `app_pc_step_done`); revoke/grant như các hàm `app_*` khác.
- [ ] **Step 4: Chạy t01–t03 kèm 106** → PASS hết; chạy thử cả tệp 106 hai lần liên tiếp trong 1 giao dịch → không lỗi.
- [ ] **Step 5: Commit** `106 (3/3): báo xong kèm ảnh, kiểm tra Đạt / Làm lại`.

### Task 4: Giao diện — Bảng phân công: nhóm "Việc tự thêm" + hộp thêm / sửa

**Files:**
- Create: `docs/js/pc_hop_viec.js` — hộp cài đặt dùng chung (lần 2 dùng lại): `openJobDialog({ D, job, mode, done })`, `mode` = `'custom'` (lần 1) / `'web'` (lần 2).
- Modify: `docs/js/pages/cv_phan_cong.js` (nhóm mới, ô tóm tắt, nút + Thêm việc), `docs/js/cv_chung.js` (`jobName(t, D)`: tên từ máy chủ khi job ≥ 100, còn lại `JOBS`), `kiem_tra/trinh_duyet/pc_gia.js` (dữ liệu thử 1 việc tự thêm + `app_pc_custom_save/delete` kiểm như máy chủ), `kiem_tra/trinh_duyet/chuan_bi.sh` nếu cần chép tệp mới.
- Test: `kiem_tra/trinh_duyet/flow_vt106.js`

**Interfaces:** Consumes `app_pc_board` (Task 1), `app_pc_custom_save/delete`.

- [ ] **Step 1: Viết flow_vt106 phần Bảng:** Chủ: nhóm "Việc tự thêm" có nút "+ Thêm việc"; mở hộp, chưa tick Có kiểm tra → không có cột "Người kiểm tra"; tick → có cột "Người kiểm tra" + "Hạn kiểm tra"; đổi Chu kỳ "Hằng tháng" → ô Ngày làm có "Ngày 31"; lưu thiếu người kiểm tra → hiện lỗi chuẩn; điền đủ → dòng mới có tóm tắt "Thứ … hằng tuần · +1 ngày · 50.000đ"; Xoá → hiện câu hỏi lại trong hộp (không dùng `confirm()`), "Xoá việc" → dòng biến mất. QL tổng: không có nút "+ Thêm việc". Cả 2 khung: `scrollWidth <= clientWidth`.
- [ ] **Step 2: Chạy** `bash $S/h86.sh "auto=1&role=chu&confirm=1&script=flow_vt106"` → FAIL (không thấy nhóm).
- [ ] **Step 3: Viết `pc_hop_viec.js` + sửa `cv_phan_cong.js`, `pc_gia.js`** theo mẫu mục 1–2 (máy tính bảng; dưới 720px mỗi cơ sở 1 khối).
- [ ] **Step 4: Chạy flow_vt106 trên `index.html` và `PAGE=test/phone.html`** → ĐẠT; chạy lại `flow_pc109` (chu) cả 2 khung → vẫn ĐẠT.
- [ ] **Step 5: Commit** `Bước 123 (1/2): Bảng phân công — thêm / sửa / xoá việc tự thêm`.

### Task 5: Giao diện — thẻ việc: Báo xong kèm ảnh, Kiểm tra, Làm bổ sung, phạt theo cơ sở

**Files:** Modify `docs/js/cv_chung.js` (`pcCard` cho việc custom: nhãn "Việc tự thêm", hướng dẫn, "📷 Bắt buộc chụp ảnh khi báo xong", bước 1/2, nhãn "Làm bổ sung" + dòng "không phạt", nút "Báo xong ✓" → hộp ghi chú + ảnh; bước Kiểm tra: ghi chú + ảnh (link ký 1 giờ như `gvDetail`), "Đạt ✓" / "Làm lại" → hộp lý do + hạn mới), `docs/js/pages/cv_qua_han.js` (mức gợi ý = `row.fine`), `kiem_tra/trinh_duyet/pc_gia.js` (`app_pc_report_done`, `app_pc_check`, việc thử: 1 việc hôm nay cần ảnh có kiểm tra, 1 việc bổ sung, 1 việc chờ kiểm tra) · Test: `flow_vt106.js` phần thẻ.

**Interfaces:** Consumes `app__pc_task_json` khoá mới (Task 2), `app_pc_report_done`, `app_pc_check` (Task 3).

- [ ] **Step 1: Thêm phần thẻ vào flow_vt106:** thẻ việc tự thêm có hướng dẫn + "Bắt buộc chụp ảnh"; Báo xong không ảnh → nút Báo xong trong hộp bị khoá / lỗi chuẩn; có ảnh → toast "Đã báo xong", thẻ chuyển "Chờ kiểm tra"; thẻ chờ kiểm tra: Làm lại thiếu lý do → lỗi; Đạt → toast "Đã Đạt"; thẻ "Làm bổ sung" không có dòng "Quá hạn sẽ bị phạt"; trang Quá hạn & phạt hiện mức theo cơ sở. role=nv chỉ thấy việc của mình. 2 khung không tràn.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Viết** theo mẫu mục 3–4.
- [ ] **Step 4: Chạy flow_vt106 (chu, nv) + flow_pc109 (chu, ql, nv) trên 2 khung** → ĐẠT.
- [ ] **Step 5: Commit** `Bước 123 (2/2): thẻ việc tự thêm — báo xong kèm ảnh, kiểm tra, làm bổ sung`.

### Task 6: Lên web lần 1

- [ ] Chạy thử 106 trên máy chủ thật trong `begin … rollback` (t01–t03 PASS); chạy thật 106; kiểm `app_migrations` có `106_viec_tu_them.sql`, tick tiếp theo không lỗi (`select public.app__pc_tick()` trong giao dịch tự hoàn tác).
- [ ] Tăng `?v=` + `docs/version.json` (ngày `2026.11.17.N` tiếp theo); `tai_lieu/TINH_NANG_DA_CHOT.md` mục 5r30 thêm "Việc tự thêm (bước 123)"; `kiem_tra/trinh_duyet/README.md` dòng flow_vt106 + `kiem_tra/viec_tu_them/`.
- [ ] Chạy lại `regress.sh` (các flow chính, 2 khung) → không lỗi mới (flow_tg113 đã hỏng từ trước — ghi rõ).
- [ ] Commit, push `main`; ghi `app_releases`; nhắc anh Revoke mã.

## LẦN 2 — Việc có sẵn dùng chung hộp (107)

### Task 7: Máy chủ — cài đặt từng cơ sở cho việc có sẵn

**Files:** Create `supabase/107_viec_co_san_tung_co_so.sql` · Test `kiem_tra/viec_tu_them/t04_viec_co_san.sql`

**Interfaces — Produces:**
- Dữ liệu ban đầu: với mỗi việc 1, 3, 4, 7, 8, 10, 11, 12 × mỗi cơ sở đang hoạt động, chèn `pc_sched(enabled = true, due_h = steps[0].d * 24, fine = pc_jobs.fine, from_date = pc_start)` nếu chưa có (`on conflict do nothing`); việc 10 thêm `cycle = 'tuan', day = 1, grace_h = 72` (giữ nguyên hạn 4 ngày tính từ 00:00 Thứ Hai = 23:59 Thứ Hai + 72 giờ). Việc 13, 14 giữ cài đặt cấp việc (`pc_jobs`).
- `app__pc_open_step`: bước 0 việc có sẵn dùng `pc_sched.due_h` của (job, branch) nếu có, không thì `steps[0].d`; mục gộp 11/12 cũng vậy.
- `app__pc_tick` phần A/B: bỏ hồ sơ của cơ sở có `pc_sched.enabled = false`.
- `app__pc_sources` việc 10: theo `app__pc_runs(cycle, day, …)` từng cơ sở, khoá `kq:<branch>:<run_date>`; còn mở tới khi có phiếu kiểm quỹ từ `run_date` đến trước lần làm kế tiếp.
- `app__pc_advance_auto`: `need_check` → mở bước Kiểm tra (người = `pc_sched.checkers`, hạn = `check_h`); Làm lại dùng `app_pc_check` (Task 3) — bước 0 mở lại có `redo = true`, đóng bằng `app_pc_report_done`.
- `app_pc_job_save(p_job, p)` nhận thêm `guide, need_check, rows:[{branch_id, enabled, due_h, fine, checkers, check_h, cycle?, day?, grace_h?}]`; bỏ nhận bước thêm tay (steps chỉ còn bước tự động + Kiểm tra nếu bật); việc 2 và 24 giữ đường cũ.

- [ ] **Step 1: Viết t04:** a) sau 107: mọi việc đang mở giữ `due_at`, mức phạt gợi ý của dòng phạt cũ không đổi; `pc_sched` có đủ dòng với `due_h`/`fine` bằng giá trị cũ; b) cơ sở X tắt việc 7 → khoản lệch cơ sở X không tạo việc; c) đổi phạt việc 1 ở cơ sở X = 30000 → dòng phạt mới cơ sở X gợi ý 30000; d) việc 10 ĐK `day = 2` → việc kiểm quỹ tạo vào Thứ Ba, hạn 23:59 Thứ Ba + grace; e) việc 1 `need_check` → hồ sơ xong mở bước Kiểm tra; Làm lại → bước `redo`, `app_pc_report_done` đóng được; f) `app_pc_job_save` nhận mảng bước có bước thêm tay → lỗi "Việc này không thêm bước được — dùng Có kiểm tra.".
- [ ] **Step 2: Chạy t04 kèm 106 + 107 (106 đã chạy thật thì chỉ 107)** → FAIL trước khi viết 107.
- [ ] **Step 3: Viết 107** (định nghĩa lại từ bản đang chạy trên máy chủ).
- [ ] **Step 4: Chạy t01–t04** → PASS hết; chạy 107 hai lần liên tiếp → không lỗi, không chèn trùng.
- [ ] **Step 5: Commit** `107: việc có sẵn cài đặt từng cơ sở (chưa chạy thật)`.

### Task 8: Giao diện — hộp chung cho việc có sẵn

**Files:** Modify `docs/js/pc_hop_viec.js` (`mode: 'web'`: tên khoá + nhãn "Việc có sẵn · tên không đổi được", dòng "Web tạo việc khi … · Tự xong khi …" (lấy từ `FROM`), không có ô Bắt buộc ảnh, không nút Xoá, cột Chu kỳ / ngày làm "Theo sự việc" trừ việc 10, việc 3/4 người làm khoá = Kế toán, việc 13/14 1 dòng "Mọi cơ sở"), `docs/js/pages/cv_phan_cong.js` (bấm tên việc 1, 3, 4, 7, 8, 10–14 mở hộp chung; 2 và 24 giữ hộp cũ; ô tóm tắt hạn + phạt theo cơ sở), `pc_gia.js` (`app_pc_job_save` nhận `rows`) · Test `kiem_tra/trinh_duyet/flow_vt107.js`.

- [ ] **Step 1: Viết flow_vt107:** bấm "1. Đối soát ca" → hộp có "Việc có sẵn", không có "Bắt buộc chụp ảnh", không có "Xoá việc", cột "Theo sự việc"; đổi phạt ĐK 30000 + tick Có kiểm tra thiếu người kiểm tra → lỗi; đủ → lưu, ô ĐK tóm tắt "30.000đ"; bấm "10. Kiểm quỹ" → có Chu kỳ / Ngày làm chọn được; bấm "2. Phân chia…" → hộp cũ; 2 khung không tràn.
- [ ] **Step 2: Chạy** → FAIL.
- [ ] **Step 3: Viết** theo mẫu mục 2b.
- [ ] **Step 4: Chạy flow_vt107 + flow_vt106 + flow_pc109 trên 2 khung** → ĐẠT.
- [ ] **Step 5: Commit** `Bước 124: việc có sẵn dùng chung hộp cài đặt từng cơ sở`.

### Task 9: Lên web lần 2
- [ ] Như Task 6 với tệp 107 và bài t04, flow_vt107; tài liệu mục 5r30 thêm "Việc có sẵn chia cơ sở (bước 124)"; `app_releases`; nhắc Revoke mã.
