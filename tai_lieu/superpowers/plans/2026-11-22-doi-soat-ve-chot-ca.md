# Đưa Đối soát Fabi về lại Chốt ca — kế hoạch làm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quản lý đối soát trọn một ca ở một chỗ: trang `#/ca/doi-soat?id=` (3 tab ① Phần việc · ② Phần tiền · ③ Hoàn thành), mở từ bảng tuần Chốt ca (ô hai dòng Việc · Tiền). Bỏ tab Đối soát Fabi trong Sổ thu chi.

**Architecture:** Không viết lại phần tiền.
- `so_thu_chi.js` có thêm chế độ "một ca" (`caMoney`). Chế độ này dựng đúng khối 6 bước đang chạy: bước 1–5 vào tab ②, bước 6 vào tab ③. Trang đối soát ca (`phieu_ca.js`, chế độ `__ds`) nhúng khối đó.
- Máy chủ chỉ thêm 2 hàm đọc (tệp 164) cho bảng tuần và "Ca tiếp theo chưa xong". Không đổi luật.

**Tech Stack:**
- JavaScript thuần (ES modules, `html\`\`` ở `docs/js/ui.js`).
- Supabase Postgres (plpgsql SECURITY DEFINER).
- Bài thử: Postgres cục bộ (`kiem_tra/may_chu_cuc_bo`), Playwright (`kiem_tra/trinh_duyet/chay_pw.py`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-22-doi-soat-ve-chot-ca-design.md` (anh Tiến duyệt 22/11 chiều: "Duyệt, làm xong gửi ảnh rồi mới lên").

## Global Constraints

- Không đổi luật máy chủ:
  - `app__ca_auto_finish`, `stc_ca_done`;
  - `app__ca_auto_ok`, `app__stc_can`, `app__stc_need`, `app_can`, `role_permissions`;
  - cách tính tiền.
- Tệp 164 chỉ thêm hàm **đọc**:
  - SECURITY DEFINER, `revoke … from public, anon`, `grant execute … to authenticated`;
  - chạy lại nhiều lần không lỗi;
  - dòng cuối `insert into public.app_migrations(file) values ('164_doi_soat_ve_chot_ca.sql') on conflict (file) do nothing;`.
- Vùng khoá:
  - trước khi đẩy chạy `flow_ql_tu_ds` (role=ql, role=chu) + `flow_stc6` / `flow_stc7` (chu / qlt / ql), cả `index.html` và `test/phone.html`;
  - đổi quyền / giao diện tiền thì dò cả giao diện.
- 390px: trang không tràn ngang.
- Lên web:
  - tăng `docs/version.json` + mọi `?v=`; tệp mới trong `docs/js/` thêm vào importmap ở `docs/index.html`;
  - ghi `app_releases`;
  - **gửi ảnh, anh duyệt rồi mới đẩy**;
  - chạy tệp 164 trên máy chủ thật **trước** khi đẩy giao diện (cần mã `sbp_` mới của anh).
- Commit: `Tien Do <tiendo286@gmail.com>`, dòng cuối `Co-Authored-By: Claude <noreply@anthropic.com>`. Không đưa dữ liệu thật / tên thật lên kho.
- Chữ trên giao diện: tiếng Việt thường, theo cách web đang viết (ký hiệu ⏳ 🔴 🔵 🟡 ✓ như Đối soát Fabi).

## Review Focus

1. Đường dẫn cũ từ thông báo (`#/quan-ly/so-thu-chi?tab=doi-soat&ds=ID&b=4`) mở bởi quản lý không được giao cơ sở đó → trang ca báo "không có quyền", không vỡ khối tiền. Pin trong Task 6, `flow_dsca` role=ql2.
2. Mở `#/ca/doi-soat?id=` của ca nhân viên chưa gửi phiếu → câu "Nhân viên chưa hoàn thành phiếu…" như cũ. Pin trong Task 6, `flow_dsca`.
3. Tuần bắc qua 2 tháng (vd 24/11–30/11 sang 01/12) → bảng tuần vẫn đủ trạng thái. "Ca tiếp theo" qua ngày cuối tháng đúng thứ tự. Pin trong Task 1 (khoảng ngày khác tháng).
4. Ca đã bấm Hoàn thành ở phần tiền từ trước nhưng chưa xong phần việc → ③ ghi còn phần việc. Xong ① là ca tự thành "Đã đối soát", không phải bấm lại. Pin trong Task 1 (`app_ca_check` → auto_finish) + Task 6.
5. Điện thoại 390px: thanh 3 tab + thanh đáy của khối 6 bước + thanh tab dưới của web không đè nhau, không tràn. Pin trong Task 6, `flow_dsca --phone`.

---

### Task 1: Máy chủ — hàm đọc trạng thái đối soát cho bảng tuần (tệp 164)

**Files:**
- Create: `supabase/164_doi_soat_ve_chot_ca.sql`
- Test: `kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql`

**Interfaces:**
- Produces:
  - `app_ca_ds_tuan(p_branch bigint, p_from date, p_to date) returns jsonb` — mảng theo ngày + thứ tự ca. Mỗi phần tử: `{id, date, shift, recon, tab, viec: {xong boolean, thieu text[], x2 text}, tien: {st text, thieu text[]}}`.
    - Chỉ ca `status = 'hoan_thanh'`.
    - `tien.st`: một trong `kt` | `red` | `xn` | `ht` | `ok`, xét theo thứ tự:
      - `kt` = `app__ca_kt_state(id)->>'ready'` false;
      - `red` = chưa đủ kết quả tiền (`shift_report_results` < `app__ca_money_items()`) và `app__stc_ds_state(id)` có `mo1` / `mo2` / `dt` / `no` false;
      - `xn` = chưa đủ kết quả tiền;
      - `ht` = có kết quả nhưng chưa có `stc_ca_done`;
      - `ok` = có `stc_ca_done`.
    - `recon = 'hoan_thanh'` thì `tien.st = 'ok'`, `viec.xong = true`.
    - `viec.xong` = đủ dấu `nhan_su`, `ban_giao`, `nhap_hang` **và** x2 (`app__cv_state`, ca `self_reconciled` coi `khong_can`) ∈ {khong_can, da_duyet}.
    - `viec.thieu` = nhãn `app__ca_item_label` các mục thiếu (+ "Chờ Chủ duyệt x2" khi x2 chưa duyệt).
    - `tab`: `'viec'` nếu `not viec.xong`; `'tien'` nếu `tien.st` khác `ok`; còn lại `'xong'`.
  - `app_ca_ds_con(p_branch bigint) returns jsonb` — mảng `{id, date, shift, tab, st}` (`st` = trạng thái tiền nhẹ: `kt` | `xn` | `ht` | `ok`; `kt` = chờ kế toán → nút Ca tiếp theo bỏ qua).
    - Mọi ca `status='hoan_thanh'`, `recon_status` khác `'hoan_thanh'`, `work_date` từ `2026-11-01` tới hôm nay (giờ VN).
    - Xếp theo ngày rồi thứ tự ca của cơ sở (cùng cách `app_ca_overview` xếp ca).
  - Quyền cả hai: `app__stc_can(p_branch)` false → trả `'[]'::jsonb` (không raise).

- [ ] **Step 1: Viết bài thử cục bộ (hỏng vì chưa có hàm)**
  - Mẫu dựng ca, kế toán đủ, `fabi_shifts`, `bank_accounts` lấy từ `kiem_tra/no_bill_162_cuc_bo.sql` và `kiem_tra/doi_soat_6_buoc_150.sql`.
  - Các mục ĐẠT / HỎNG trong `REPORT>>`:
    1. Ca thiếu file Fabi → `tien.st='kt'`, `tab='viec'` khi chưa có dấu phần việc.
    2. Ca có Fabi lệch doanh thu, chưa xác nhận → `'red'`.
    3. Ca khớp, chưa xác nhận → `'xn'`.
    4. Đã `app_stc_ds_close` → `'ht'`.
    5. Thêm `stc_ca_done` → `'ok'`.
    6. Thiếu `ban_giao` → `viec.xong=false`, `viec.thieu` có "Bàn giao".
    7. Đủ 3 dấu + `stc_ca_done` qua `app_ca_check` → `recon='hoan_thanh'` (luật cũ vẫn chạy) và ca biến khỏi `app_ca_ds_con`.
    8. Chờ kế toán: `app_ca_check(…,'nhan_su',true)` bị chặn "Phiếu chờ kế toán…" (luật 17/11, anh chốt lại 22/11) và ca có `st='kt'` trong `app_ca_ds_con`.
    9. Quản lý không được giao cơ sở → `[]`; nhân viên → `[]`.
    10. `app_ca_ds_con` đúng thứ tự Sáng → Chiều → Tối, qua 2 ngày.
    11. Khoảng `p_from..p_to` bắc qua 2 tháng trả đủ ca của cả hai tháng.

- [ ] **Step 2: Chạy, thấy hỏng**
  - Run: `PG_DIR=<scratchpad>/pgc3 sh kiem_tra/may_chu_cuc_bo/dat.sh <pgv>/bin/python kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql`
  - Expected: lỗi `function public.app_ca_ds_tuan … does not exist`.

- [ ] **Step 3: Viết `supabase/164_doi_soat_ve_chot_ca.sql`** theo Interfaces.
  - Dùng lại `app__ca_kt_state`, `app__stc_ds_state`, `app__cv_state`, `app__ca_item_label`.
  - Không sửa hàm nào có sẵn.

- [ ] **Step 4: Chạy tệp 2 lần + bài thử, thấy đạt**
  - Run: `<pgv>/bin/python kiem_tra/may_chu_cuc_bo/chay.py supabase/164_doi_soat_ve_chot_ca.sql` (2 lần), rồi bài thử Step 2.
  - Expected: mọi dòng `ĐẠT`. Bài cũ `doi_soat_6_buoc_150.sql`, `no_bill_162_cuc_bo.sql` vẫn đạt.

- [ ] **Step 5: Commit** — `git add supabase/164_doi_soat_ve_chot_ca.sql kiem_tra/doi_soat_ve_chot_ca_164_cuc_bo.sql`.

### Task 2: Giả lập — ca thử phần tiền có phiếu chốt ca + 2 hàm mới

**Files:**
- Modify: `kiem_tra/trinh_duyet/stc_gia.js`
- Modify (nếu cần): `kiem_tra/trinh_duyet/ca_gia.js`

**Interfaces:**
- Consumes: hình dạng trả của Task 1.
- Produces:
  - Lúc `makeStc` chạy: mỗi ca trong `stc_fixture` (id 141–183, cơ sở 1) có một dòng `T.shift_reports` tối thiểu: `id`, `branch_id: 1`, `work_date`, `shift`, `status: 'hoan_thanh'`, `recon_status` theo `done`, người tạo / chốt = 1. Chỉ thêm khi chưa có id đó.
  - Kết quả: `app_ca_get` / `app_ca_check` / `app_ca_overview` của `ca_gia` chạy được với các ca này.
  - Giả lập `app_ca_ds_tuan`, `app_ca_ds_con` cùng hình dạng Task 1:
    - `tien.st` suy từ `st().cas` (kt: `kt_wait` hoặc `bank_ck == null`; red: ô mo / dt / no đỏ theo `caChecks`; xn: `!recon_money_done`; ht: `!done`; ok);
    - `viec` từ `T.shift_report_checks`;
    - `!me.perms.doi_soat` → `[]`.

- [ ] **Step 1:** Thêm phần dựng + 2 hàm.
- [ ] **Step 2:** Kiểm nhanh.
  - Dựng web thử (`chuan_bi.sh <thư mục mới>`), chạy `flow_stc1` role=chu.
  - Expected: vẫn ĐẠT (các ca thử phần tiền không đổi hành vi Sổ thu chi).
- [ ] **Step 3: Commit.**

### Task 3: Sổ thu chi — chế độ một ca, bỏ tab, chuyển đường cũ

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js`

**Interfaces:**
- Produces:
  - `export async function caMoney({ cn, thang, ds, b = null, workLeft = [], workSum = '' }) → Promise<{ html: string, mount: () => void }>`.
    - `html` gốc: `<div id="stc-page" class="stc-one" data-ds="${ds}">` chứa `<section data-tab-pane="tien"><div id="stc-ds">` (khối 6 bước, thanh bước chỉ bước 1–5) và `<section data-tab-pane="xong">${workSum}` (nội dung bước 6 `doneStep`).
    - Ca không có trong dữ liệu tháng → hộp "Chưa có số liệu phần tiền của ca này".
  - Nút `[data-dsdone]`:
    - khoá khi `workLeft` có mục khác "Chờ Chủ duyệt x2", ghi "Còn phần việc: …";
    - chỉ còn chờ x2 → cho bấm, ghi "ca tự thành Đã đối soát khi Chủ duyệt".
  - Sự kiện `window.dispatchEvent(new CustomEvent('stc-one-tab', { detail: { tab } }))`:
    - `tab='xong'` khi bấm "Tiếp ›" ở bước 5;
    - `tab='tien'` khi bấm dòng tóm tắt `[data-dsstep]` trong ③.
  - `mount` gắn đúng các bộ nghe hiện có vào `#stc-page`. `after()` vẫn `rerender()` cả trang (trang ca tự dựng lại khối).
  - `TABS` = Tổng · Sổ thu · Sổ chi.
  - `params.tab === 'doi-soat'`:
    - có `ds` → `go('/ca/doi-soat?id=' + ds + '&tab=tien' + (b ? '&b=' + b : ''))`;
    - không có → `go('/ca?cn=' + cn + '&tuan=' + <thứ Hai của ngày đầu tháng đang xem>)`.
  - Mọi liên kết `q({ tab: 'doi-soat', … })&ds=X` (Việc cần làm ở Tổng, "Xử lý ca này ở Đối soát Fabi ›", dòng khoá theo ca, `stc-calock`) → `#/ca/doi-soat?id=X&tab=tien` (bước 6 → `tab=xong`).

- [ ] **Step 1: Bài thử hỏng trước** — viết phần (e) (f) của `flow_dsca` (Task 6) cho đường cũ + không còn tab. Chạy trên web hiện tại → hỏng.
- [ ] **Step 2: Làm** theo Interfaces.
- [ ] **Step 3: Chạy lại `flow_stc1`, `flow_stc4`, `flow_ds171`** (role chu) trên web dựng mới → ghi lỗi do cấu trúc đổi (để Task 7 sửa). Không được có lỗi tính tiền.
- [ ] **Step 4: Commit.**

### Task 4: Trang đối soát ca 3 tab

**Files:**
- Modify: `docs/js/pages/phieu_ca.js` (nhánh `isDs`: dựng body, `mount` phần `if (isDs)`)
- Modify: `docs/js/pages/doi_soat_ca.js`
- Modify: `docs/js/app.js` (PAGES `'/ca/doi-soat': 'doi_soat_ca'`)

**Interfaces:**
- Consumes:
  - `caMoney` (Task 3);
  - `app_ca_ds_con` (Task 1) cho "Ca tiếp theo chưa xong".
- Produces:
  - Đường `#/ca/doi-soat?id=&tab=viec|tien|xong&buoc=&b=`. Đường cũ `#/quan-ly/doi-soat/ca?id=` và `#/ca/phieu?id=&__ds=1` dựng cùng trang.
  - Thanh tab `.ds-ptabs` (nút `.ds-pt[data-ptab=viec|tien|xong]`) hiện trên mọi khung.
  - Pane ① = các bước 0..2 hiện có (Ai làm ca, Nghỉ & làm thay khi có, Bàn giao + đánh giá + nhận hàng), giữ "Duyệt & tiếp".
    - Bước cuối của ① duyệt xong → sang ② (đã xong tiền thì ③).
  - Ca chờ kế toán (`ktBlocked`): giữ trang "Chờ kế toán" như hiện nay (luật 17/11), thêm 2 nút đầu trang (Xem phiếu nhân viên, Ca tiếp theo chưa xong).
  - ② / ③ = `caMoney(...).html`, chỉ khi `canRc`:
    - `workLeft` từ dấu `nhan_su` / `ban_giao` / `nhap_hang` + x2 chờ duyệt;
    - `workSum` là tóm tắt ① (từng bước ✓ / còn gì, nút sang bước).
  - Bỏ pane bước 3 cũ (`stcCard`, `#ds-need`). "Lịch sử sửa · mở lại phiếu" (`dsFoot`) đặt cuối trang.
  - Đầu trang: nút "Xem phiếu nhân viên" (`#/ca/phieu?id=`) và `#ds-nextca2` "Ca tiếp theo chưa xong ›":
    - ca kế sau ca đang mở trong `app_ca_ds_con` (bỏ ca `st='kt'`), hết thì quay về ca đầu danh sách (cũng bỏ `kt`);
    - không còn → nút khoá, chữ "✓ Hết ca chưa xong";
    - mở `#/ca/doi-soat?id=X&tab=<tab của ca đó>`.
  - ③ khi ca đã "Đã đối soát": thêm nút đó.
  - Chọn tab lúc mở:
    - `params.tab`;
    - không có thì `buoc` → ①, `b` 1–5 → ②, `b=6` → ③;
    - không có thì ① nếu phần việc chưa xong, ② nếu tiền chưa xong, còn lại ③.
  - Nghe `stc-one-tab` để đổi tab. Nhớ tab theo ca (`sessionStorage 'ds_part:'+id`) khi trang tự vẽ lại sau thao tác.

- [ ] **Step 1: Bài thử hỏng trước** — viết phần (c) (d) (g) của `flow_dsca`. Chạy → hỏng.
- [ ] **Step 2: Làm** theo Interfaces.
- [ ] **Step 3: Chạy `flow_dsca` (c)(d)(g)** → đạt.
- [ ] **Step 4: Viết lại `flow_ql_tu_ds` (bài vùng khoá)** theo cấu trúc mới, giữ đủ ý cũ:
  - không còn `#ds-money-open` / `#ds-money-save` / `.ds-editing` / `.ds-mlock`;
  - pane ① không có ô sửa số tiền;
  - tab ② có `#stc-page.stc-one[data-ds="<id>"]` (đúng ca);
  - sửa giờ / ghi chú người làm không gửi ô tiền rỗng (giữ nguyên đoạn kiểm `app_ca_recon_save`);
  - không tràn ngang.
  - Đầu bài ghi rõ ngày đổi + lý do (thiết kế 22/11).
- [ ] **Step 5: Commit.**

### Task 5: Bảng tuần Chốt ca hai dòng Việc · Tiền

**Files:**
- Modify: `docs/js/pages/chot_ca.js`

**Interfaces:**
- Consumes: `app_ca_ds_tuan`, `app_ca_ds_con` (Task 1).
- Produces:
  - Với cơ sở đang xem, gọi `app_ca_ds_tuan({ p_branch: cn, p_from: days[0], p_to: days[6] })` (lỗi → `[]`).
  - Ô ca có trong kết quả:
    - thay chữ "Xong" bằng `✓ Đã đối soát` (recon) hoặc hai dòng `<span class="cw-v">Việc ✓|–</span><span class="cw-t">Tiền ⏳|🔴|🔵|🟡|✓</span>`;
    - `title` ghi `viec.thieu` / `tien`;
    - giữ dòng TM / CK và khách nợ;
    - bấm → `go('/ca/doi-soat?id=' + id + '&tab=' + tab)`.
  - Ô không có trong kết quả: như cũ.
  - Chú thích ký hiệu dưới bảng (chỉ khi có dòng Việc · Tiền).
  - Đầu bảng: `app_ca_ds_con({ p_branch: cn })` không rỗng → `<div class="cw-con">Còn N ca chưa đối soát xong · <a href="#/ca/doi-soat?id=…&tab=…">Làm ca cũ nhất ›</a></div>`.

- [ ] **Step 1: Bài thử hỏng trước** — viết phần (a) (b) (h) của `flow_dsca`. Chạy → hỏng.
- [ ] **Step 2: Làm.**
- [ ] **Step 3: Chạy (a)(b)(h)** → đạt, cả `--phone`.
- [ ] **Step 4: Commit.**

### Task 6: Bài thử trình duyệt `flow_dsca` (đủ) + dẫn đường ở trang khác

**Files:**
- Create: `kiem_tra/trinh_duyet/flow_dsca.js`
- Modify:
  - `kiem_tra/trinh_duyet/chuan_bi.sh` (chép bài mới);
  - `docs/js/pages/chot_thang.js` (`href.ds` / `href.ca`);
  - `docs/js/pages/fabi_board.js`;
  - `docs/js/doi_soat_tc.js`;
  - `docs/js/cho_vay.js`;
  - `docs/js/pages/doi_soat.js` (liên kết);
  - `docs/js/app.js` (`OLD_TAB`: `/quan-ly/lech-tien`, `/quan-ly/am-tien` → `/ca`).

**Interfaces:**
- Consumes: Task 2–5.
- Produces: `flow_dsca` (kết quả `out.push({ dsca: { ok, fail } })`).
  - Vai: `role=chu|qlt|ql` đủ; `role=ql2` (phần h, i); `role=nv` (phần j).
  - Phần kiểm:
    - (a) bảng tuần tuần 16/11–22/11 cơ sở 1: ô 181 / 182 / 183 đúng ký hiệu theo `stc_fixture`;
    - (b) dòng "Còn N ca" → mở ca cũ nhất đúng tab;
    - (c) bấm ô 182 → `#/ca/doi-soat?id=182`, 3 tab, ② có 5 bước (không có bước 6 trên thanh bước);
    - (d) ③ nút `[data-dsdone]` khoá khi thiếu phần việc; tích đủ ① → mở;
    - (e) đường `#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11&ds=182&b=2` → trang ca tab ② bước 2;
    - (f) Sổ thu chi không còn tab "Đối soát Fabi";
    - (g) "Ca tiếp theo chưa xong ›" sang đúng ca kế;
    - (h) ql2 không được giao → ô như cũ, mở trang ca báo không có quyền (Review Focus 1);
    - (i) ca đang chốt mở bằng đường mới → câu "chưa hoàn thành phiếu" (Review Focus 2);
    - (j) nhân viên bấm ô → phiếu của mình;
    - (k) ca chờ kế toán: trang báo "Chờ kế toán", có nút Ca tiếp theo chưa xong (bỏ qua ca chờ kế toán);
    - (l) không tràn ngang.
  - Chốt tháng › khung Còn thiếu dẫn đúng tab (kt / fabi → `tien`, hoan_thanh / cho → `xong`, viec → `viec`).

- [ ] **Step 1:** Hoàn thiện bài (gộp các phần đã viết ở Task 3–5).
- [ ] **Step 2:** Sửa các liên kết.
- [ ] **Step 3:** Chạy `flow_dsca` 5 vai × 2 khung + `flow_ct` + `flow_fb136` → đạt.
- [ ] **Step 4: Commit.**

### Task 7: Bộ bài thử đầy đủ + sửa bài cũ theo cấu trúc mới

**Files:**
- Modify: các `kiem_tra/trinh_duyet/flow_stc*.js`, `flow_ds17*.js` hỏng vì cấu trúc (lưới ca của tab cũ, bước 6 nay ở ③). Chỉ đổi chỗ trỏ, **không đổi nội dung kiểm**.

- [ ] **Step 1:** Chạy bộ đầy đủ của chặng 4 (`chay_bo_c4.sh`, thêm `flow_dsca`) cả 2 khung.
  - Bỏ `flow_stc0`, `flow_stc3` / `flow_stc5` role=ql như bộ cũ.
- [ ] **Step 2:** Mỗi lượt hỏng:
  - so trên bản cũ;
  - hỏng do cấu trúc → sửa chỗ trỏ;
  - hỏng do hành vi → sửa mã (quay lại task tương ứng).
- [ ] **Step 3:** Chạy lại tới khi đạt hết.
  - Vùng khoá (`flow_ql_tu_ds` ql / chu, `flow_stc6` / `flow_stc7` chu / qlt / ql, 2 khung) bắt buộc đạt.
- [ ] **Step 4: Commit.**

### Task 8: Ảnh cho anh duyệt → lên web → tài liệu

- [ ] **Step 1:** Chụp ảnh máy tính + 390px:
  - bảng tuần Chốt ca;
  - trang ca ① / ② / ③;
  - ③ khoá + đã xong;
  - đường cũ.
  - Dữ liệu giả, đưa lên trang ảnh riêng (claude.ai, riêng tư).
  - Gửi anh. **Chờ anh duyệt.**
- [ ] **Step 2:** Anh duyệt + cấp mã mới:
  - chạy thử tệp 164 trên máy chủ thật trong khối tự hoàn tác. Kiểm: hàm trả đủ ca tháng 11 các cơ sở, tab / trạng thái khớp khung Còn thiếu (`app_fin_missing`), quyền đúng;
  - rồi chạy thật có chốt chặn.
- [ ] **Step 3:** Tăng bản, đẩy `main`, `kiem_web_that`, ghi `app_releases`.
- [ ] **Step 4:** Tài liệu:
  - `TINH_NANG_DA_CHOT.md` (mục mới);
  - `BAN_GIAO.md`;
  - `CLAUDE.md` mục Vùng khoá: chỗ làm tiền nay là trang đối soát ca trong Chốt ca; bài `flow_ql_tu_ds` kiểm cấu trúc mới — báo anh;
  - `kiem_tra_app_lan_1` (Đ-01 lần đổi 10 xong) + Word;
  - ghi chú nhớ `doi-soat-tung-buoc`.
- [ ] **Step 5:** Xoá trắng mã, nhắc anh thu hồi.
