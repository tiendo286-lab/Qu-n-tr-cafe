# Giờ chốt ca theo file Fabi + sửa tay khi chưa có file — Kế hoạch làm (KH2, lượt 1, bước 162)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (anh Tiến dặn dùng tiết kiệm — tự làm, duyệt 1 lần cuối). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Trạng thái:** chờ anh Tiến bảo "chạy". Đọc trước `plans/2026-11-19-lo-trinh-4-ke-hoach.md` (luật chung, số bước, ai sở hữu tệp nào). Xong lượt này thì **dừng, chờ anh thử trên web thật** rồi mới sang KH3.

**Goal:** Giờ chốt (giờ kết thúc doanh thu) của ca **tự lấy theo file Fabi** khi kế toán đã tải file; chưa có file thì Quản lý cơ sở / Quản lý tổng / Chủ sửa tay được (bắt ghi lý do). Ca sau tự đổi giờ bắt đầu theo. Có lịch sử, không đổi số tiền, không bắt Xác nhận Fabi lại.

**Architecture:** Máy chủ (tệp 144): một hàm nội bộ đặt giờ chốt + kéo giờ bắt đầu ca sau (`app__ca_gio_set`), dùng chung cho 3 lối: (1) tự đồng bộ theo file Fabi mỗi khi file được áp vào ca (`app__ca_gio_fabi`, gọi từ chỗ áp file Fabi), (2) sửa tay `app_ca_gio_save` (bị chặn khi ca đã có file Fabi), (3) chạy bù một lần cho các ca tháng chưa Chốt tháng. Giờ ghi vào bản dữ liệu ca đang dùng (`shift_report_recon.data`, đọc qua `app__ca_eff`). Giao diện: một dòng giờ + ô sửa dùng chung (`docs/js/gio_chot.js`), hiện ở phần A của Đối soát Fabi và ở dòng "Giờ doanh thu" của Đối soát ca.

**Tech Stack:** PostgreSQL (Supabase, Management API), JavaScript thuần (`html\`\``), `jsc -m`, bộ giả lập `kiem_tra/trinh_duyet/`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-sua-gio-chot-ca-design.md` — đọc kèm 2 mục "Cập nhật" ở cuối tệp (bỏ Chốt ca; giờ theo file Fabi).

## Global Constraints
- **Có file Fabi của ca (`fabi_shifts.close_at` khác rỗng) → giờ chốt = giờ trong file**, không ai sửa tay (ô sửa khoá, ghi `theo file Fabi`). Chưa có file → sửa tay.
- Quyền sửa tay = đúng `app__stc_ds_need(p_report, false)` (tệp 133): Chủ, Quản lý tổng, quản lý đối soát của cơ sở; phiếu đã gửi; tháng chưa Chốt tháng. Không viết luật quyền mới, không đổi `app_can` / `role_permissions` / `app__stc_can`.
- Ca Sáng bắt đầu 06:45, không đổi (kể cả khi file Fabi ghi giờ mở khác). Ca Chiều / Tối: giờ bắt đầu = giờ chốt ca trước. Giờ mở trong file Fabi **không** dùng để đặt giờ bắt đầu.
- Giờ dạng `'YYYY-MM-DD HH:MM'`. Qua nửa đêm thì ngày hôm sau.
- Luật chặn (anh chốt), chữ báo lỗi đúng như sau:
  - lý do trống (sửa tay) → `Phải ghi lý do sửa giờ.`
  - giờ mới ≤ giờ bắt đầu ca → `Giờ chốt phải sau giờ bắt đầu ca (HH:MM).`
  - ca sau đã có giờ chốt và giờ mới ≥ giờ đó → `Giờ chốt phải trước giờ chốt ca <Ca> (HH:MM).`
  - tháng đã Chốt tháng → `Tháng này đã CHỐT.` (đã có sẵn trong `app__stc_ds_need`)
  - sửa tay khi đã có file Fabi → `Ca đã có file Fabi — giờ chốt lấy theo file.`
  - sai dạng → `Giờ chốt không hợp lệ.`
- **Giờ trong file Fabi phạm luật chặn** (≤ giờ bắt đầu, hoặc ≥ giờ chốt ca sau) → **không** tự áp, giữ giờ cũ, `app_ca_gio` trả `fabi_bad = true`; dòng giờ hiện `File Fabi: HH:MM — không hợp lệ, sửa tay` và **cho sửa tay** ca đó. (Mặc định AI đặt để không sinh ca âm giờ; đã báo anh 19/11.)
- Không bỏ dấu đã duyệt `thoi_gian` (`shift_report_checks`), **không** bắt Xác nhận Fabi lại, không đổi bất kỳ số tiền nào. Không gửi thông báo cho ai — chỉ lưu lịch sử.
- Chữ báo ca sau: `Ca <Ca> đổi giờ bắt đầu: HH:MM → HH:MM`. Nút: `✎ Sửa giờ chốt`.
- Lịch sử `shift_recon_log`: ca này `action = 'sua_gio'` (tay) hoặc `'gio_fabi'` (theo file, `reason = 'Theo file Fabi'`), `field = 'rev_end'`; ca sau `action = 'sua_gio_theo'`, `field = 'rev_start'`, `reason = 'Theo giờ chốt ca <Ca>'`. Sửa tay thêm một dòng `app_log`. Đặt giờ trùng giờ đang có thì không ghi gì.
- Tệp `144_sua_gio_chot.sql` (kiểm lại số). Báo anh Tiến 1 dòng trước khi chạy thật: "sắp thêm giờ chốt theo file Fabi + sửa tay, ghi vào mục Thời gian doanh thu đã duyệt (vùng khoá)".
- **Chạy bù ca cũ** (anh chốt): mọi ca của tháng **chưa Chốt tháng**, đã gửi phiếu, có file Fabi mà giờ chốt khác file. Gửi anh danh sách (cơ sở · ngày · ca · giờ cũ → giờ file · ca sau đổi giờ bắt đầu) **trước** khi chạy thật.
- `app_releases` (lượt này): added `["Giờ chốt ca tự lấy theo file Fabi khi kế toán đã tải file; ca sau tự đổi giờ bắt đầu", "Chưa có file Fabi: Quản lý cơ sở / Quản lý tổng / Chủ sửa giờ chốt ở Đối soát Fabi hoặc Đối soát ca, phải ghi lý do"]`, changed `["Đã sửa giờ chốt các ca tháng 11 theo file Fabi", "Bỏ mật khẩu vùng khoá — chỉ cần báo trước khi sửa"]`. Thay đổi `CLAUDE.md` đang chờ (bỏ mật khẩu) đi cùng commit đẩy lên của lượt này.

## Review Focus
1. **Nhân viên gửi phiếu SAU khi kế toán đã tải file Fabi** — giờ chốt phải thành giờ file ngay khi gửi, không giữ giờ nhân viên gõ. (Task 1 câu (k))
2. **Kế toán tải lại file Fabi với giờ khác** — giờ chốt đổi theo file mới, ca sau đổi theo, có thêm 1 dòng lịch sử `gio_fabi`; tải lại cùng giờ thì không thêm dòng. (Task 1 câu (l))
3. **Ca Tối qua nửa đêm** — giờ `ngày+1 00:30` (tay hoặc theo file) lưu được, hiện đúng; không có ca sau. (Task 1 câu (f), Task 2)
4. **Ca chưa có `shift_report_recon`** — tạo được bản dữ liệu mà không đổi trạng thái đối soát (`app__stc_ds_state` trước = sau). (Task 1 câu (a))
5. **Bấm Lưu 2 lần** — nút dùng `once()`; lần 2 không ghi thêm lịch sử. (Task 3)

---

### Task 1: Máy chủ — tệp 144 + bài thử

**Files:**
- Create: `supabase/144_sua_gio_chot.sql`
- Create: `kiem_tra/gio_chot_144.sql` (gửi cùng lần, sau nội dung 144 chạy 2 lần; kết thúc `RAISE EXCEPTION 'REPORT>> %'`)
- Create: `kiem_tra/gio_chot_144_danh_sach.sql` (chỉ đọc: liệt kê ca sẽ đổi khi chạy bù — dùng ở Step 5)

**Interfaces:**
- Produces:
  - `public.app__ca_gio_set(p_report bigint, p_end text, p_action text, p_reason text, p_by bigint) returns jsonb` — nội bộ. Kiểm dạng + luật "sau giờ bắt đầu" + "trước giờ chốt ca sau" (báo lỗi đúng chữ ở Global Constraints); trùng giờ hiện có → trả `{changed:false}`. Ca chưa có dòng `shift_report_recon` → tạo từ `app__recon_snapshot`. Ghi `data.rev_end` (+ `updated_by`, `updated_at`); ca sau đã gửi phiếu → ghi `data.rev_start` của ca sau. Ghi lịch sử. Trả `{changed:true, rev_end, next:{shift, from, to}|null}`. Không kiểm quyền (người gọi kiểm).
  - `public.app__ca_gio_fabi(p_report bigint) returns void` — nội bộ. Lấy `close_at` của file Fabi khớp ca (cùng cách `app_ca_get` tìm `fabi_shifts`); có thì gọi `app__ca_gio_set(…, 'gio_fabi', 'Theo file Fabi', null)` trong `begin … exception when others` (phạm luật → bỏ qua, không làm hỏng việc tải file). Ca chưa gửi phiếu → không làm gì.
  - Gắn `app__ca_gio_fabi` vào chỗ áp file Fabi lên từng ca: tìm hàm mà **cả** lúc kế toán tải file **lẫn** lúc nhân viên gửi phiếu đều đi qua (ứng viên: `app__fabi_apply_report` tệp 104 dòng ~213, được gọi từ `app__fabi_apply`; kiểm bằng `grep` + bài thử câu (k), (l)). Vá bằng `pg_get_functiondef` + thay chuỗi như tệp 135, **giữ** đoạn vá của 135; bản vá phải chạy lại được (không chèn 2 lần).
  - `public.app_ca_gio(p_report bigint) returns jsonb` → `{ id, shift, date, rev_start, rev_end, fabi_close, by_fabi: boolean, fabi_bad: boolean, next: {id, shift, submitted, rev_start, rev_end} | null, can_edit: boolean, log: [{at, by_name, action, before, after, reason}] }`. Ai đọc được Sổ thu chi của cơ sở (`app__stc_can(branch)`) thì đọc được. `by_fabi` = có `fabi_close` và không `fabi_bad`. `can_edit` = `not by_fabi` và `app__stc_ds_need(p_report,false)` không báo lỗi.
  - `public.app_ca_gio_save(p_report bigint, p_end text, p_reason text) returns jsonb` — `app__stc_ds_need(p_report,false)`; `by_fabi` → lỗi `Ca đã có file Fabi — giờ chốt lấy theo file.`; lý do trống → lỗi; gọi `app__ca_gio_set(…, 'sua_gio', reason, app_account().id)`; `app_log`.
  - `public.app__ca_gio_fabi_all(p_dry boolean) returns jsonb` — nội bộ; mọi ca tháng chưa Chốt tháng có file Fabi khác giờ: `p_dry` → chỉ trả danh sách `[{branch, date, shift, from, to, next_shift, next_from, next_to, bad}]`; không `p_dry` → gọi `app__ca_gio_fabi` từng ca theo thứ tự ngày, Sáng → Chiều → Tối. Tệp 144 **không** tự chạy hàm này.
  - `grant execute` `app_ca_gio`, `app_ca_gio_save` cho `authenticated`; `revoke` mọi hàm `app__ca_gio_*` khỏi `anon, authenticated, public`.

- [ ] **Step 1: Viết bài thử `kiem_tra/gio_chot_144.sql`.** Trên dữ liệu thật chọn một cơ sở, một ngày có Sáng + Chiều đã gửi phiếu; giả JWT bằng `set_config('request.jwt.claims', …, true)`; muốn ca "chưa có file Fabi" thì `delete` dòng `fabi_shifts` của ca đó trong khối (tự hoàn tác). Ghi vào `rep`:
  - (a) Ca Sáng không file, QL được giao: sửa tay (+10 phút) → `app__ca_eff(sang)->>'rev_end'` = mới; `app__ca_eff(chieu)->>'rev_start'` = mới; `app__ca_money` 2 ca trước = sau; `app__stc_ds_state` 2 ca trước = sau; trả `next.from/to` đúng.
  - (b) Ca đã Xác nhận Fabi, không file: sửa tay được; dòng `shift_report_checks` mục `thoi_gian` còn; `recon_money_done` vẫn true.
  - (c) QL cơ sở khác → lỗi `Chỉ Chủ, Quản lý tổng…`, `can_edit` = false. Nhân viên → lỗi.
  - (d) lý do `'  '` → `Phải ghi lý do sửa giờ.`
  - (e) giờ mới = giờ bắt đầu → `Giờ chốt phải sau giờ bắt đầu ca`.
  - (f) Sáng, giờ mới ≥ giờ chốt Chiều → `Giờ chốt phải trước giờ chốt ca Chiều`; Tối `ngày+1 00:30` → lưu được, `next` null.
  - (g) ca của tháng đã Chốt tháng (có thì dùng, không thì `insert` dòng chốt tháng trong khối) → `Tháng này đã CHỐT.`
  - (h) ca sau chưa gửi phiếu → không có log `sua_gio_theo`; `app__ca_forced_start(ca sau)` = giờ mới.
  - (i) Ca có file Fabi: `app_ca_gio` → `by_fabi = true`, `can_edit = false`; `app_ca_gio_save` → `Ca đã có file Fabi — giờ chốt lấy theo file.`
  - (j) `'abc'` → `Giờ chốt không hợp lệ.`
  - (k) Ca chưa gửi phiếu có file Fabi: giả lập nhân viên gửi phiếu với `rev_end` khác file (gọi đúng hàm gửi phiếu) → sau khi gửi, `app__ca_eff->>'rev_end'` = giờ file.
  - (l) `update fabi_shifts set close_at = <giờ khác>` rồi gọi lối kế toán áp file (`app__fabi_apply(<ma_ca>)`) → giờ chốt + giờ bắt đầu ca sau đổi theo, +1 dòng `gio_fabi`; gọi lại lần nữa → không thêm dòng.
  - (m) `close_at` của file ≥ giờ chốt ca sau → không áp, `fabi_bad = true`, `can_edit = true` (với QL được giao).
  - (n) `app__ca_gio_fabi_all(true)` trả mảng; mỗi phần tử có `from <> to`; không có ca của tháng đã chốt.
- [ ] **Step 2: Gửi riêng bài thử** → lỗi `function public.app_ca_gio_save(...) does not exist`.
- [ ] **Step 3: Viết `supabase/144_sua_gio_chot.sql`** theo Interfaces.
- [ ] **Step 4: Gửi 144 ×2 + bài thử một lần** → `REPORT>>` có (a)–(n) đúng như trên. Tự hoàn tác.
- [ ] **Step 5: Danh sách chạy bù:** gửi 144 + `select app__ca_gio_fabi_all(true)` trong khối tự hoàn tác → chép danh sách thành bảng tiếng Việt gửi anh Tiến (cơ sở · ngày · ca · giờ cũ → giờ file · ca sau đổi giờ bắt đầu · dòng "không hợp lệ" nếu có). **Chờ anh đồng ý.**
- [ ] **Step 6: Báo anh 1 dòng, chạy thật 144**, rồi chạy riêng `select public.app__ca_gio_fabi_all(false)`. Kiểm `app_migrations` có `144_sua_gio_chot.sql`; chạy lại `app__ca_gio_fabi_all(true)` → mảng rỗng (trừ ca "không hợp lệ").
- [ ] **Step 7: Commit** 3 tệp — "Máy chủ bước 162: giờ chốt theo file Fabi + sửa tay (144)".

### Task 2: Hàm thuần kiểm giờ + bài thử jsc

**Files:**
- Create: `docs/js/gio_chot_tinh.js` (không import gì, để `jsc` chạy được)
- Create: `kiem_tra/gio_chot_tinh_162.mjs`

**Interfaces:**
- Produces:
  - `gioCheck(g, newEnd, reason) → string | null` — `g` = kết quả `app_ca_gio`; cùng luật + đúng chữ lỗi như máy chủ (gồm `by_fabi`), `null` nếu được.
  - `gioPreview(g, newEnd) → string | null` — `'Ca Chiều đổi giờ bắt đầu: 14:05 → 14:20'`; `null` khi không có ca sau, ca sau chưa gửi phiếu, hoặc giờ không đổi.
  - `gioFabiNote(g) → { txt, cls } | null` — `by_fabi` → `{txt:'theo file Fabi', cls:'ok'}`; `fabi_bad` → `{txt:'File Fabi: HH:MM — không hợp lệ, sửa tay', cls:'off'}`; không có file → `null`.

- [ ] **Step 1: Viết bài thử** (mẫu `ok()` như `so_thu_chi_tinh_dot7.mjs`). `g = {shift:'Sáng', rev_start:'2026-11-18 06:45', rev_end:'2026-11-18 14:05', next:{shift:'Chiều', submitted:true, rev_start:'2026-11-18 14:05', rev_end:'2026-11-18 21:30'}, fabi_close:null, by_fabi:false, fabi_bad:false}`. Khẳng định:
  - `gioCheck(g,'2026-11-18 14:20','nhập nhầm') === null`
  - `gioCheck(g,'2026-11-18 14:20',' ') === 'Phải ghi lý do sửa giờ.'`
  - `gioCheck(g,'2026-11-18 06:45','x') === 'Giờ chốt phải sau giờ bắt đầu ca (06:45).'`
  - `gioCheck(g,'2026-11-18 21:30','x') === 'Giờ chốt phải trước giờ chốt ca Chiều (21:30).'`
  - `gioCheck(g,'','x') === 'Giờ chốt không hợp lệ.'`
  - `gioCheck({...g,by_fabi:true,fabi_close:'2026-11-18 14:20'},'2026-11-18 14:30','x') === 'Ca đã có file Fabi — giờ chốt lấy theo file.'`
  - `gioPreview(g,'2026-11-18 14:20') === 'Ca Chiều đổi giờ bắt đầu: 14:05 → 14:20'`; `gioPreview({...g,next:null},'2026-11-18 14:20') === null`; `gioPreview(g,'2026-11-18 14:05') === null`
  - Tối `{shift:'Tối', rev_start:'2026-11-18 21:30', rev_end:'2026-11-18 23:50', next:null, by_fabi:false}`: `gioCheck(t,'2026-11-19 00:30','x') === null`
  - `gioFabiNote({...g,by_fabi:true,fabi_close:'2026-11-18 14:20'}).txt === 'theo file Fabi'`; `gioFabiNote({...g,fabi_bad:true,fabi_close:'2026-11-18 22:00'}).txt === 'File Fabi: 22:00 — không hợp lệ, sửa tay'`; `gioFabiNote(g) === null`
- [ ] **Step 2:** `jsc -m kiem_tra/gio_chot_tinh_162.mjs` → lỗi (chưa có tệp).
- [ ] **Step 3:** Viết `docs/js/gio_chot_tinh.js`.
- [ ] **Step 4:** Chạy lại → đạt hết.

### Task 3: Dòng giờ + ô sửa dùng chung, gắn vào 2 trang + bài thử Chrome + phát hành

**Files:**
- Create: `docs/js/gio_chot.js` — `export function gioLine(g)` → html `Giờ doanh thu HH:MM → HH:MM · <gioFabiNote> · [✎ Sửa giờ chốt]` (nút chỉ khi `g.can_edit`, `data-gio="<id>"`); `export async function gioDialog(reportId, { onSaved })` (gọi `app_ca_gio`; ô `datetime-local` giờ chốt mới; ô Lý do; dòng `gioPreview` cập nhật khi gõ; lỗi `gioCheck` hiện ngay; lịch sử 3 lần gần nhất; nút Lưu bọc `once()` gọi `app_ca_gio_save`; lỗi máy chủ hiện trong ô).
- Modify: `docs/index.html` — 2 dòng importmap cho `gio_chot.js`, `gio_chot_tinh.js`.
- Modify: `docs/js/pages/so_thu_chi.js` — `partA` (dòng ~1009): đầu phần A (cả lúc đã / chưa xác nhận) thêm `<div class="stc-gio" data-gio-ca="${c.id}"></div>`; sau khi vẽ Đối soát Fabi, lấp các `.stc-gio` bằng `app_ca_gio` + `gioLine`; bắt `[data-gio]` → `gioDialog(id, { onSaved: () => after('Đã sửa giờ chốt') })`.
- Modify: `docs/js/pages/phieu_ca.js` — 2 dòng `ca-time` (dòng ~438 và ~559): khi `R.status === 'hoan_thanh'`, gọi `app_ca_gio(R.id)`, thay phần chữ giờ bằng `gioLine`; lưu xong tải lại phiếu. **Không** dùng `can_recon` / `mEdit` để quyết định nút.
- Modify: `kiem_tra/trinh_duyet/stc_gia.js`, `ca_gia.js` — RPC giả `app_ca_gio` (một ca có `by_fabi:true`, một ca `fabi_bad:true`, còn lại không file; `can_edit` theo vai: chu/qlt true; ql true ở LHP, false cơ sở khác; nv false; `by_fabi` → false), `app_ca_gio_save` (đổi giờ trong dữ liệu giả, trả `next`).
- Create: `kiem_tra/trinh_duyet/flow_gio162.js` (mẫu `flow_stc7.js`); thêm vào `chuan_bi.sh`.

**Interfaces:**
- Consumes: `app_ca_gio`, `app_ca_gio_save` (Task 1); `gioCheck`, `gioPreview`, `gioFabiNote` (Task 2).
- Produces: `.stc-gio[data-gio-ca]`, `[data-gio]` (KH4 phải giữ — xem lộ trình).

- [ ] **Step 1: Viết `flow_gio162.js`**, kiểm:
  - role chu, Đối soát Fabi, ca không file: thấy `Giờ doanh thu` + `✎ Sửa giờ chốt`; mở ô, đổi giờ +15 phút → thấy `Ca Chiều đổi giờ bắt đầu:`; Lưu khi Lý do trống → `Phải ghi lý do sửa giờ.`, không gọi `app_ca_gio_save`; điền lý do, bấm Lưu 2 lần nhanh → gọi đúng 1 lần, dòng giờ đổi.
  - ca có file Fabi: thấy `theo file Fabi`, **không** có `✎ Sửa giờ chốt`. Ca `fabi_bad`: thấy `không hợp lệ, sửa tay` và có nút.
  - role chu, Đối soát ca (`#/quan-ly/doi-soat/ca`, trang `doi_soat_ca.js` dùng phần vẽ của `phieu_ca.js` với `__ds=1`; người làm xác nhận đúng tham số mở một ca): có dòng giờ, nút mở cùng ô sửa.
  - role ql: cơ sở LHP có nút; cơ sở khác không. role qlt: có nút.
  - `test/phone.html`: ô sửa vừa 390px, `scrollWidth <= 390`.
- [ ] **Step 2:** Chạy trên bản cũ → báo thiếu `Giờ doanh thu` ở Đối soát Fabi.
- [ ] **Step 3:** Làm các tệp ở trên.
- [ ] **Step 4:** Chạy `flow_gio162` (chu / qlt / ql × `index.html` + `test/phone.html`) → đạt. Vùng khoá: `flow_ql_tu_ds` (ql + chu × 2 khung), `flow_stc6`, `flow_stc7` (chu / qlt / ql) → đạt.
- [ ] **Step 5: Duyệt mã 1 lần** (superpowers:requesting-code-review), sửa điều được chỉ ra.
- [ ] **Step 6: Phát hành** theo lộ trình (kèm `CLAUDE.md`), ghi `app_releases` như Global Constraints. Cập nhật `BAN_GIAO.md` (máy chủ tới 144; lưu ý: ai định nghĩa lại hàm áp file Fabi phải giữ lời gọi `app__ca_gio_fabi`; ghi bước 162), `TINH_NANG_DA_CHOT.md` (luật giờ chốt), `kiem_tra/trinh_duyet/README.md` (`flow_gio162`).
- [ ] **Step 7: Dừng, nhờ anh Tiến thử trên web thật** (~5–7 phút sau): một ca có file Fabi thấy "theo file Fabi"; một ca chưa có file → ✎ Sửa giờ chốt → thấy báo ca sau đổi giờ → Lưu. Anh báo ổn mới sang KH3.
