# Sổ thu chi mới — Đợt 1 (chỉ xem, dữ liệu thật) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang "Sổ thu chi (mới)" chỉ xem: 4 tab Tổng · Đối soát tiền · Sổ thu · Sổ chi và Quỹ ngoài, chạy trên toàn bộ dữ liệu thật từ 01/11/2026. Trang có khung "So với trang cũ" để anh Tiến kiểm tra trong lúc chạy song song.

**Architecture:**
- Máy chủ có 2 hàm đọc mới: `app_stc_month`, `app_stc_ext`. Hai hàm gom dữ liệu đang có thành một danh sách **khoản** chuẩn hoá (mỗi khoản 1 dòng: sổ, loại tiền, cột, số tiền) và một danh sách **ca**.
- Mọi phép cộng nằm trong mô-đun JS thuần `so_thu_chi_tinh.js` để thử được bằng `jsc`: sổ theo ngày, bảng tiền ca, tồn quỹ, 5 ô đối chiếu, so với trang cũ.
- Trang chỉ vẽ, không có nút ghi.

**Tech Stack:** Supabase Postgres (plpgsql, `SECURITY DEFINER`), JS thuần ES modules, mẫu `html\`\`` của `docs/js/ui.js`. Thử hàm thuần bằng `jsc -m`, thử giao diện bằng Supabase giả lập `kiem_tra/trinh_duyet/`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md` (mục 2, 3 và mục 5 "Đợt 1"). Mẫu giao diện: https://claude.ai/artifact/6L53uqto8BgLHgBSLh744E

## Global Constraints

- **Không ghi gì vào CSDL:** đợt 1 chỉ thêm hàm đọc. Mọi nút sửa / thêm / chốt / xử lý lệch hiện dạng tắt, kèm chữ "Đang chạy thử — chưa sửa ở đây".
- **Ai xem được:**
  - Trong lúc thử chỉ **Chủ và Quản lý tổng**. Máy chủ chặn vai khác bằng lỗi `'Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.'`.
  - Quỹ ngoài chỉ Chủ.
- **Hằng số:** ngày bắt đầu sổ `2026-11-01`. Gối đầu két `1000000`. Nhắc rút khi tiền mặt quá `20000000`.
- **Công thức (spec mục 2):**
  - `Tổng thu = Doanh thu + Thu nợ + Thu khác + Luân chuyển vào + Chênh lệch dư`
  - `Tổng chi = Các khoản chi + Cho nợ + Luân chuyển ra + Chênh lệch thiếu`
  - Với từng ca và từng loại tiền: `Thu − Chi = Thực tế − Tiền đầu ca`.
- **Thực tế:**
  - Tiền mặt = `ql_counted` nếu `cash_mode = 'ca'` và có số; ngược lại = `cash_counted` của bản đối soát.
  - Chuyển khoản = số ngân hàng kế toán nhập (`app__kt_bank_json(...).received` khi đủ tài khoản). Chưa đủ tài khoản thì coi là "chờ kế toán".
- **Doanh thu** = cột tiền mặt / chuyển khoản trên file Fabi (`fabi_shifts`). Ca chưa có file thì lấy `pos_cash` / `pos_transfer` của bản đối soát và gắn `fabi_missing = true`. Bill nợ không tính.
- **Tiền mở ca phải là:**
  - ca đầu ngày: `1000000`;
  - nếu ca liền trước có `cash_mode = 'ca'`: `1000000`;
  - ngược lại: thực tế tiền mặt của ca liền trước.
- **CSDL:**
  - Tệp `supabase/127_so_thu_chi_xem.sql`. Kiểm `select max(file) from app_migrations` trước; trùng thì lấy số kế tiếp.
  - Chạy lại được. Dòng cuối là `insert into public.app_migrations(file) values ('127_so_thu_chi_xem.sql') on conflict (file) do nothing;`.
  - `revoke all … from public, anon; grant execute … to authenticated;`.
- **Chạy trên máy chủ thật:** chạy thử trong `DO $$ … RAISE EXCEPTION 'REPORT>> %' … $$` trước khi chạy thật. Dùng lại mã `sbp_` cũ (bộ nhớ `dung-ma-cu`), xoá tệp mã sau khi dùng.
- **Tốc độ:** gọi `app__ca_eff` / `app__ca_money` **một lần mỗi phiếu** (`with … as materialized`), không gọi trong WHERE / ORDER BY. Mục tiêu dưới 1 giây cho 1 cơ sở / 1 tháng trên máy chủ thật.
- **CSS:** chèn qua `html\`\`` thì bị thoát ký tự, nên **không dùng `>` hay dấu nháy trong chuỗi CSS** (bài học 5z2).
- **Điện thoại:** không tràn ngang ở khung 390px (`test/phone.html`).
- **Kho mã công khai:** dữ liệu thử là số giả, không có tên thật.
- **Mỗi lần đẩy lên `main`:**
  - tăng `docs/version.json`, `ASSET_VERSION` trong `docs/js/app.js` và `?v=` ở `index.html`;
  - ghi `app_releases`;
  - commit tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp có dòng `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Vùng khoá:** không đụng vùng khoá "Mở để sửa" đối soát (danh sách trong `CLAUDE.md`). Đợt 1 chỉ đọc.

## Review Focus

1. **Ca thiếu file Fabi hoặc thiếu số ngân hàng:** sổ vẫn hiện (doanh thu tạm theo phiếu, ghi "chờ kế toán"), ô Chuyển khoản là `kt`, không báo lệch giả. → thử ở Task 1 (`caChecks` với `bank_ck = null`) và Task 2 (REPORT đếm ca chờ kế toán).
2. **Ngày thiếu ca** (chỉ có Sáng + Tối, hoặc có ca FULL TIME ở LHP): chuỗi tiền mở ca không vỡ. FULL TIME không nằm trong chuỗi két (5c) nhưng vẫn hiện trong sổ. → thử ở Task 1 (`dayChain` với ca thiếu và ca `FULL TIME`).
3. **Cặp đổi tiền mặt ↔ chuyển khoản (`exchange_key`) và luân chuyển quỹ:** luôn ra 2 khoản (1 thu + 1 chi, khác loại tiền), hai vế bằng nhau, không tính thu / chi của quán. → thử ở Task 1 (`sumItems` theo `col='lc'`) và Task 2 (REPORT: mọi `exchange_key` ra đúng 2 khoản).
4. **Tháng chưa có dữ liệu / cơ sở không có ca:** trang hiện trạng thái trống có chữ, không báo lỗi. → thử ở Task 5 (giả lập tháng 12).
5. **Tồn quỹ mới khác Sổ quỹ cũ:** liệt kê từng ngày khác kèm số cũ / số mới, không giấu. → thử ở Task 1 (`compareDays`) và Task 6 (khung "So với trang cũ" có dòng khác).

---

## Hợp đồng dữ liệu (dùng chung cho mọi task)

`app_stc_month(p_branch bigint, p_month text)` trả `jsonb`:

```json
{
  "branch": {"id": 1, "code": "LHP", "name": "…"},
  "branches": [{"id": 1, "code": "LHP"}],
  "owner": true,
  "month": "2026-11", "from": "2026-11-01", "to": "2026-11-30", "locked": false,
  "opening": {"tm": 0, "ck": 0},
  "cas": [{
    "id": 123, "date": "2026-11-18", "shift": "Tối", "staff": "Tú, Ngọc",
    "cash_mode": "ngay", "ql_counted": null, "nv_counted": 4482000,
    "nv": {"opening": 1000000, "revenue": 3750000, "debt": 0},
    "fabi": {"has": true, "opening": 1000000, "revenue": 3750000, "tm": 1540000, "ck": 2210000, "debt": 0, "edited_bills": 0},
    "bank_ck": 2210000, "kt_wait": false, "recon_money_done": true
  }],
  "items": [{
    "id": "m:991", "date": "2026-11-18", "ca_id": 123,
    "book": "chi", "pm": "tm", "col": "chi", "amount": 1000000,
    "title": "Quản lý lấy tiền két", "meta": "NV Ngọc ghi",
    "cat": "Không tính", "cat_type": null, "checked": true, "no_cost": true,
    "status": null, "status_cls": null, "from": null, "who": null, "to_qn": false, "recv": null, "src": "move"
  }],
  "open_debts": [{"id": "d:12", "who": "Bàn 5", "kind": "bill", "amount": 50000, "left": 50000, "date": "2026-11-16", "from": "ca Tối 16/11", "no_remind": false}],
  "compare": {
    "fund_days": [{"date": "2026-11-18", "tm": 8032000, "ck": 43625000}],
    "tc": {"thu": 0, "chi": 0},
    "gaps": [{"ca_id": 123, "pm": "tm", "lech": -30000}]
  }
}
```

- Giá trị các trường của `items[]`:
  - `col` ∈ `dt | no | khac | lc | lech | chi`;
  - `book` ∈ `thu | chi`;
  - `pm` ∈ `tm | ck`;
  - `amount` luôn > 0.
- `items[].id` có tiền tố theo nguồn:
  - `f:` doanh thu Fabi / phiếu;
  - `m:` khoản phiếu ca;
  - `e:` `fin_entries`;
  - `dn:` cho nợ (`shift_debts` muon / ck);
  - `dc:` thu nợ (`shift_debts.closed_report_id` / thu ngoài ca);
  - `l:` / `lp:` cho vay cũ / lần trả;
  - `g:` chênh lệch;
  - `t:` `fund_transfers`;
  - `w:` `fund_withdrawals`.
- Khoản ngoài ca có `ca_id = null`.
- `items[].status` là chữ hiển thị sẵn, ví dụ "Trả một phần · còn 50.000", "Chờ Chủ nhận", hoặc trạng thái lệch lấy từ `app__gap_rows.state`.

`app_stc_ext(p_month text)` (chỉ Chủ) trả `{month, opening:{tm,ck}, items:[…cùng dạng, ca_id null…], branches:[…]}`:
- Tiền cơ sở chuyển về: là `fund_withdrawals` → `book:'thu', col:'lc', recv:'cho'|'da', from: <mã cơ sở>`.
- Chi ngoài: là `ext_entries`, có trường `chia` (chữ cách chia).

---

### Task 1: Mô-đun tính toán thuần `so_thu_chi_tinh.js`

**Files:**
- Create: `docs/js/so_thu_chi_tinh.js`
- Test: `kiem_tra/so_thu_chi_tinh_dot1.mjs` (chạy `jsc -m`; máy không có jsc thì dùng `node`, xem bộ nhớ `chay-thu-trinh-duyet`)

**Interfaces:**
- Consumes: hợp đồng dữ liệu ở trên.
- Produces:
  - `export const START = '2026-11-01'`, `FLOAT = 1000000`, `ALERT = 20000000`, `SHIFT_ORDER = ['Sáng', 'Chiều', 'Tối']`
  - `export const COLS = { thu: [['dt','Doanh thu'],['no','Thu nợ'],['khac','Thu khác'],['lc','Luân chuyển'],['lech','Chênh lệch']], chi: [['chi','Các khoản chi'],['no','Cho nợ'],['lc','Luân chuyển'],['lech','Chênh lệch']] }`
  - `export function sumItems(items, { book, pm, col, date, caId } = {}) -> number`
  - `export function dayTree(data, book, pm, col = null) -> Array<{ date, total, byCol, cas: Array<{ caId, shift, staff, total, byCol, items }>, outside: { total, byCol, items } }>`. Ngày mới nhất đứng trước. Ca xếp theo `SHIFT_ORDER`; ca khác như FULL TIME đứng sau. Khi lọc `col` thì bỏ ca / ngày có tổng 0.
  - `export function caMoney(items, caId, startTm) -> { tm: Money, ck: Money }`, với `Money = { start, dt, no, khac, lc, chi, cn, must, du, th, real, gap }`:
    - `must = start + dt + no + khac + lc − chi − cn`;
    - `real = must + du − th`;
    - `gap = real − must`;
    - phần ck có `start = 0`.
  - `export function dayChain(data, date) -> Map<caId, { expOpen, money }>`: chỉ gồm Sáng / Chiều / Tối, theo quy tắc tiền mở ca ở Global Constraints.
  - `export function caChecks(ca, link) -> Array<{ k: 'mo'|'dt'|'no'|'tm'|'ck', name, st: 'ok'|'red'|'kt', a, b, txt }>`, với `link = dayChain(...).get(ca.id)`:
    - `mo` so `fabi.opening` (không có file thì `nv.opening`) với `link.expOpen`;
    - `dt` so `nv.revenue` với `fabi.revenue`;
    - `no` so `nv.debt` với `fabi.debt`;
    - `tm` lấy `link.money.tm.gap`;
    - `ck` là `kt` khi `ca.kt_wait` hoặc `bank_ck == null`.
  - `export function caState(ca, checks) -> { k: 'chot'|'lech'|'kt'|'cho', txt, cls }`: `chot` khi `ca.recon_money_done`. Chữ giống mẫu: "🔒 Đã chốt", "🔴 <tên ô>", "⏳ Chờ kế toán", "🔵 Chờ chốt".
  - `export function fundSummary(data) -> { tm: F, ck: F, daily: { tm: Day[], ck: Day[] }, toQN: Item[], waitQN: Item[] }`, với `F = { open, thu, chi, toQN, ton }`, `Day = { date, start, thu, chi, toQN, end }`. `chi` **không** gồm khoản `to_qn`.
  - `export function compareDays(data, summary) -> Array<{ date, pm, old, neu, diff }>`: chỉ trả dòng có `diff !== 0`.

- [ ] **Step 1: Viết bài thử thất bại** `kiem_tra/so_thu_chi_tinh_dot1.mjs`. Dữ liệu giả dựng ngay trong tệp: 1 cơ sở, 2 ngày, mỗi ngày Sáng / Chiều / Tối; thêm 1 ca FULL TIME, 1 cặp đổi tiền, 1 phiếu rút về Quỹ ngoài đang chờ nhận, 1 ca chờ kế toán. Các khẳng định:

```js
ok(sumItems(D.items, { book: 'thu', pm: 'tm', col: 'dt' }) === 1850000 + 2100000 + 1540000 + 1720000 + 1980000 + 1610000, 'doanh thu TM cộng đúng');
ok(sumItems(D.items, { book: 'thu', col: 'lc' }) === sumItems(D.items, { book: 'chi', col: 'lc', pm: 'tm' }) - TOQN_TM, 'cặp đổi tiền: vế vào = vế ra');
const m = caMoney(D.items, TOI_18, 1000000);
ok(m.tm.must === 1540000 && m.tm.real === 1510000 && m.tm.gap === -30000, 'ca Tối 18/11: phải có 1.540.000, thực tế 1.510.000, lệch −30.000');
ok((sumItems(D.items, { caId: TOI_18, pm: 'tm', book: 'thu' }) - sumItems(D.items, { caId: TOI_18, pm: 'tm', book: 'chi' })) === m.tm.real - m.tm.start, 'Thu − Chi = Thực tế − Đầu ca');
const ch = dayChain(D, '2026-11-18');
ok(ch.get(SANG_18).expOpen === 1000000 && ch.get(CHIEU_18).expOpen === 1000000, 'ca Sáng 1.000.000; ca trước thu theo ca → 1.000.000');
ok(ch.get(TOI_17).expOpen === ch.get(CHIEU_17).money.tm.real, 'thu theo ngày → bằng thực tế ca trước');
ok(!ch.has(FULLTIME_18) && dayTree(D, 'thu', 'tm')[0].cas.some((c) => c.caId === FULLTIME_18), 'FULL TIME ngoài chuỗi két nhưng vẫn trong sổ');
const ck = caChecks(D.cas.find((c) => c.id === CHO_KT), dayChain(D, '2026-11-17').get(CHO_KT));
ok(ck.find((c) => c.k === 'ck').st === 'kt', 'chờ kế toán: ô CK là kt, không đỏ');
ok(caState(D.cas.find((c) => c.id === CHIEU_18), caChecks(D.cas.find((c) => c.id === CHIEU_18), ch.get(CHIEU_18))).txt.startsWith('🔴'), 'mở ca sai → đỏ');
const F = fundSummary(D);
ok(F.tm.ton === D.opening.tm + F.tm.thu - F.tm.chi - F.tm.toQN, 'tồn quỹ = đầu + thu − chi − về Quỹ ngoài');
ok(F.daily.tm[0].end === F.tm.ton, 'cuối ngày mới nhất = tồn quỹ');
ok(F.waitQN.length === 1, '1 khoản chờ Chủ nhận');
ok(compareDays({ ...D, compare: { ...D.compare, fund_days: [{ date: '2026-11-18', tm: F.tm.ton + 20000, ck: F.ck.ton }] } }, F).length === 1, 'so trang cũ: 1 ngày khác');
ok(dayTree(D, 'chi', 'tm', 'lech').every((d) => d.total > 0), 'lọc cột bỏ ngày có tổng 0');
```

- [ ] **Step 2: Chạy, thấy thất bại.** `jsc -m kiem_tra/so_thu_chi_tinh_dot1.mjs` → lỗi không tìm thấy mô-đun.
- [ ] **Step 3: Viết `docs/js/so_thu_chi_tinh.js`** đúng các chữ ký ở Interfaces. Hàm thuần: không đọc DOM, không gọi máy chủ.
- [ ] **Step 4: Chạy, thấy đạt.** `jsc -m kiem_tra/so_thu_chi_tinh_dot1.mjs` → in `ĐẠT n kiểm tra`.
- [ ] **Step 5: Commit** `docs/js/so_thu_chi_tinh.js` và `kiem_tra/so_thu_chi_tinh_dot1.mjs`: "Sổ thu chi mới đợt 1: hàm tính sổ, tiền ca, tồn quỹ".

### Task 2: Hàm máy chủ `app_stc_month`

**Files:**
- Create: `supabase/127_so_thu_chi_xem.sql`
- Test: `kiem_tra/so_thu_chi_127.sql` (khối `DO`, đăng nhập vai Chủ bằng `set_config('request.jwt.claims', …)`, kết thúc bằng `RAISE EXCEPTION 'REPORT>> %'`)

**Interfaces:**
- Consumes:
  - các hàm `app__ca_eff(bigint)`, `app__ca_money(bigint)`, `app__kt_bank_json(shift_reports)`, `app__ca_kt_state`, `app__gap_rows(bigint, text, text)`, `app__fund_sum` (số Sổ quỹ cũ), `app_tc_summary` (tổng Thu chi cũ);
  - các bảng `fabi_shifts`, `shift_debts`, `fin_entries`, `fin_move_cats`, `fin_categories`, `fin_cat_types`, `branch_loans`, `branch_loan_payments`, `loan_people`, `fund_openings`, `fund_transfers`, `fund_withdrawals`.
- Produces: `public.app_stc_month(p_branch bigint, p_month text) returns jsonb`, đúng hợp đồng ở trên.

- [ ] **Step 1: Viết bài thử thất bại** `kiem_tra/so_thu_chi_127.sql`. Với mỗi cơ sở đang hoạt động, tháng `2026-11`, khối DO gọi hàm rồi gom vào REPORT:
  - (a) số ca, số khoản theo `col`;
  - (b) số ca mà `Σthu − Σchi` (tiền mặt, các khoản của ca) ≠ `thực tế − tiền mở ca` (phải bằng 0);
  - (c) số `exchange_key` không ra đúng 2 khoản;
  - (d) số ngày tồn quỹ mới khác `compare.fund_days`, kèm 5 ngày đầu (để anh xem, không bắt bằng 0);
  - (e) thời gian chạy mỗi cơ sở (`clock_timestamp()`);
  - (f) gọi bằng vai Quản lý cơ sở thì gặp lỗi "Đang chạy thử".
- [ ] **Step 2: Chạy bài thử trên máy chủ thật**, thấy lỗi "function app_stc_month does not exist".
- [ ] **Step 3: Viết `supabase/127_so_thu_chi_xem.sql`.** Hàm plpgsql `stable security definer set search_path = public`. Kiểm quyền: chỉ vai Chủ / Quản lý tổng (xác định vai theo cách `app_fund_overview` đang làm). Cách ghép từng nguồn:
  - **Doanh thu:** `fabi_shifts` của ca (tm, ck); không có file thì lấy `pos_cash` / `pos_transfer`.
  - **Khoản phiếu ca:** lấy từ `app__ca_eff(id)->'moves'`.
    - `amount` âm → `book:'chi'`; `kind` → `pm`.
    - Cặp `exchange_key` → `col:'lc'`.
    - Nhóm "Không tính" → `no_cost`.
    - Nhóm và trạng thái đối soát lấy từ `fin_move_cats`.
    - Khoản lương `cash_paid` là chi.
    - Dòng nợ tự sinh (khách mượn) thì bỏ, vì đã có ở cột cho nợ.
  - **`fin_entries`:**
    - `no_fund = false` → khoản ngoài ca (hoặc khoản của ca nếu có `report_id`);
    - `no_fund = true` (quán chịu / thu khác từ lệch) → **không** thành khoản; chỉ ghi vào `status` của khoản chênh lệch tương ứng.
  - **Nợ:**
    - Cho nợ: `shift_debts` kind `muon` → tm, kind `ck` → ck, ghi tại ca phát sinh.
    - Thu nợ: theo `closed_report_id` + `collect_kind`; thu ngoài ca → `ca_id null`.
    - Cho vay cũ `branch_loans` / `branch_loan_payments` → cho nợ / thu nợ ngoài ca.
  - **Chênh lệch:** từ `app__ca_money(id)` lấy `tm_left` (đã gồm lệch giao ca) và `ck_left_bank` (chỉ khi `bank_ok`). Dương → `book:'thu'`, âm → `book:'chi'`. `status` lấy theo `app__gap_rows.state`.
  - **Quỹ:** `fund_transfers` → 2 khoản `lc`. `fund_withdrawals` → `book:'chi', col:'lc', to_qn:true, recv:'cho'|'da'`.
  - **So với trang cũ:**
    - `compare.fund_days`: số dư từng ngày theo Sổ quỹ cũ (`app__fund_sum` / cách `app_fund_branch` dựng);
    - `compare.tc`: `app_tc_summary`;
    - `compare.gaps`: `app__gap_rows`.
  - Gọi `app__ca_eff` / `app__ca_money` một lần mỗi phiếu qua `with ca as materialized (…)`. Cuối tệp: `revoke` / `grant` và dòng `app_migrations`.
- [ ] **Step 4: Chạy thử** tệp 127 + bài thử trong cùng một lần gửi (khối DO tự hoàn tác). REPORT phải có (b) = 0, (c) = 0, (e) < 1000ms mỗi cơ sở, (f) đúng chữ lỗi. Dán REPORT vào thông điệp commit.
- [ ] **Step 5: Chạy thật** tệp 127 (không kèm bài thử). Kiểm `select file from app_migrations where file = '127_so_thu_chi_xem.sql'` có 1 dòng.
- [ ] **Step 6: Commit** hai tệp SQL: "Máy chủ 127: app_stc_month (Sổ thu chi mới, chỉ đọc)".

### Task 3: Hàm máy chủ `app_stc_ext` (Quỹ ngoài)

**Files:**
- Modify: `supabase/127_so_thu_chi_xem.sql`. Nếu tệp 127 đã chạy thật thì tạo `128_so_thu_chi_quy_ngoai.sql`.
- Test: `kiem_tra/so_thu_chi_127.sql` (thêm phần g)

**Interfaces:**
- Consumes: `ext_entries`, `ext_alloc_manual`, `ext_alloc_fixed`, `ext_openings`, `fund_withdrawals`.
- Produces: `public.app_stc_ext(p_month text) returns jsonb` theo hợp đồng.

- [ ] **Step 1: Thêm phần (g) vào bài thử:**
  - tổng các khoản thu `lc` của `app_stc_ext('2026-11')` = tổng `fund_withdrawals` tháng 11 của mọi cơ sở;
  - mỗi khoản `ext_entries` có `chia` khác rỗng;
  - gọi bằng vai Quản lý tổng thì gặp lỗi "chỉ Chủ".
- [ ] **Step 2: Chạy thử, thấy lỗi** function không tồn tại.
- [ ] **Step 3: Viết hàm.** `chia` là chữ theo cách chia đang lưu: chia đều / theo tỉ lệ doanh thu / 1 cơ sở: mã / tự nhập / không chia. Chữ giống mẫu.
- [ ] **Step 4: Chạy thử (tự hoàn tác) rồi chạy thật**, như Task 2 Step 4–5.
- [ ] **Step 5: Commit**: "Máy chủ: app_stc_ext (Quỹ ngoài trong Sổ thu chi mới)".

### Task 4: Giả lập cho bài thử trình duyệt

**Files:**
- Create: `kiem_tra/trinh_duyet/stc_gia.js`, `kiem_tra/trinh_duyet/stc_fixture.json` (số giả theo mẫu artifact: LHP + Quỹ ngoài, tháng 11; tháng 12 để trống)
- Modify: `kiem_tra/trinh_duyet/sb_gia.js` (đăng ký), `kiem_tra/trinh_duyet/chuan_bi.sh` (chép 2 tệp mới vào `test/`)

**Interfaces:**
- Produces: `export function makeStc(T, me) -> { app_stc_month(args), app_stc_ext(args) }`, cùng kiểu giả lập như `makeFund` trong `fund_gia.js`. Trả fixture; với vai không phải Chủ / Quản lý tổng thì ném lỗi giống máy chủ.

- [ ] **Step 1:** Viết `stc_fixture.json` đúng hợp đồng. Lấy dữ liệu của Task 1 làm gốc, thêm Quỹ ngoài.
- [ ] **Step 2:** Viết `stc_gia.js` và đăng ký trong `sb_gia.js`.
- [ ] **Step 3: Kiểm.** Chạy `bash kiem_tra/trinh_duyet/chuan_bi.sh <thư mục tạm>`, mở `index.html?role=chu` và gọi thử `rpc('app_stc_month', {p_branch:1, p_month:'2026-11'})` trong một bài flow nhỏ. Thấy trả `cas.length > 0`.
- [ ] **Step 4: Commit**: "Giả lập app_stc_* cho bài thử Sổ thu chi mới".

### Task 5: Trang — khung, chọn cơ sở / tháng, Sổ thu và Sổ chi

**Files:**
- Create: `docs/js/pages/so_thu_chi.js`
- Modify: `docs/js/app.js`: thêm `['Sổ thu chi (mới)', '/quan-ly/so-thu-chi', 'chot_thang']` vào nhóm "Quản lý ca" của `HUBS`; thêm `'/quan-ly/so-thu-chi': 'so_thu_chi'` vào `PAGES`.
- Test: `kiem_tra/trinh_duyet/flow_stc1.js` (thêm tên tệp vào `chuan_bi.sh`)

**Interfaces:**
- Consumes: `rpc('app_stc_month', { p_branch, p_month })`, `rpc('app_stc_ext', { p_month })` (chỉ gọi khi chọn Quỹ ngoài); `dayTree`, `sumItems`, `COLS` từ Task 1.
- Produces:
  - `export const perm = 'chot_thang'`, `export async function render({ params })`.
  - Tham số địa chỉ:
    - `tab`: `tong` | `doi-soat` | `thu` | `chi`, mặc định `tong`;
    - `cn`: id cơ sở hoặc `ngoai`; nhớ lần trước bằng khoá localStorage `tcBranch` như Thu chi / Sổ quỹ;
    - `thang`: `YYYY-MM`;
    - `pm`: `tm` | `ck`;
    - `cot`: lọc cột.

- [ ] **Step 1: Viết bài thử thất bại** `flow_stc1.js`: mở `#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11` với `role=chu`, kiểm:
  - (1) có 2 nút bảng Tiền mặt / Chuyển khoản, số tổng đúng fixture;
  - (2) hàng ô cột đúng `COLS.thu`; bấm "Thu nợ" thì chỉ còn khoản thu nợ;
  - (3) bấm ngày → hiện ca, bấm ca → hiện khoản; khoản thu nợ có "Nợ từ …";
  - (4) tab `chi`: khoản "Không tính" có nhãn "Không tính chi phí", và khung Chi theo loại không cộng khoản đó;
  - (5) **không có nút** "Sửa / Xoá" hay "+ Thêm phiếu" bấm được; có chữ "Đang chạy thử";
  - (6) `thang=2026-12` hiện "Tháng này chưa có khoản nào.";
  - (7) `role=ql` thấy thông báo "Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.";
  - (8) ở `test/phone.html` (390px): `document.documentElement.scrollWidth <= 390`.
- [ ] **Step 2: Chạy**, thấy thất bại (chưa có trang).
- [ ] **Step 3: Viết trang.**
  - Bố cục, chữ, màu theo mẫu artifact: bảng theo ngày → ca → khoản. Trên điện thoại, mỗi dòng ngày / ca chỉ hiện tổng và một dòng chữ nhỏ ghi các cột.
  - Khung phải của Sổ thu: Thu nợ tháng này, Ca dư tiền, Khách đang nợ (từ `open_debts`, có số ngày nợ, đỏ khi quá 7 ngày).
  - Khung phải của Sổ chi: Ca thiếu tiền, Người nợ, Cần phân loại, Chi theo loại (so tháng trước nếu dữ liệu có).
  - Mọi nút hành động là `<button disabled>` kèm `title="Đang chạy thử — chưa sửa ở đây"`.
- [ ] **Step 4: Chạy bài thử** ở `index.html?auto=1&role=chu&script=flow_stc1` và `test/phone.html?auto=1&role=chu&script=flow_stc1`, thấy đạt cả 8 mục.
- [ ] **Step 5: Commit**: "Sổ thu chi mới đợt 1: trang + Sổ thu / Sổ chi (chỉ xem)".

### Task 6: Tab Tổng, Quỹ ngoài, khung "So với trang cũ"

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js`
- Test: `kiem_tra/trinh_duyet/flow_stc1.js` (thêm mục 9–13)

**Interfaces:**
- Consumes: `fundSummary`, `compareDays` (Task 1); `app_stc_ext` (Task 3).

- [ ] **Step 1: Thêm bài thử:**
  - (9) tab Tổng có 3 ô lớn, cách tính Tiền mặt / Tài khoản đúng `fundSummary`; tiền mặt quá 20.000.000 thì ô đỏ;
  - (10) bảng Tồn quỹ theo ngày: số cuối ngày mới nhất = tồn quỹ;
  - (11) khung "So với trang cũ" liệt kê đúng ngày khác trong fixture (cài sẵn 1 ngày khác 20.000), ghi số cũ / số mới / chênh;
  - (12) `cn=ngoai` với `role=chu`: Quỹ ngoài có Tổng / Sổ thu / Sổ chi, không có tab Đối soát tiền, chi ngoài có nhãn cách chia. Với `role=ql_tong` thì không có nút Quỹ ngoài;
  - (13) danh sách "Chuyển về Quỹ ngoài" có khoản "Chờ Chủ nhận", nút Đã nhận tiền tắt.
- [ ] **Step 2: Chạy**, thấy thất bại.
- [ ] **Step 3: Viết tab Tổng và Quỹ ngoài** theo mẫu (spec mục 3.6, 3.7). Khung "So với trang cũ" đặt ở đầu tab Tổng, gồm:
  - tồn quỹ theo ngày (`compareDays`);
  - tổng thu / chi so với `compare.tc`;
  - lệch từng ca so với `compare.gaps`.

  Nếu khớp hết thì ghi "Khớp trang cũ ✓".
- [ ] **Step 4: Chạy bài thử** (máy tính + 390px), thấy đạt.
- [ ] **Step 5: Commit**: "Sổ thu chi mới đợt 1: tab Tổng, Quỹ ngoài, so với trang cũ".

### Task 7: Tab Đối soát tiền (chỉ xem)

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js`
- Test: `kiem_tra/trinh_duyet/flow_stc1.js` (thêm mục 14–17)

**Interfaces:**
- Consumes: `dayChain`, `caChecks`, `caState`, `caMoney` (Task 1).

- [ ] **Step 1: Thêm bài thử:**
  - (14) bảng tuần: hàng = ngày, cột = Sáng / Chiều / Tối (không có cột Cuối ngày); mỗi ô ghi `caState().txt`;
  - (15) bấm ô ca → phiếu tiền 3 bước:
    - ① 3 ô Tiền mở ca / Doanh thu / Nợ;
    - ② tiền thực nhận (tiền mặt: `ql_counted` hoặc chữ "chưa nhập"; chuyển khoản: số kế toán hoặc "chờ kế toán");
    - ③ 2 ô Tiền mặt / Chuyển khoản;
  - (16) các nút "Chốt tiền ca", "Sửa theo Fabi", "Ca trước / Ca này ghi sai" đều tắt;
  - (17) ca chờ kế toán: ô Chuyển khoản là "⏳", không đỏ.
- [ ] **Step 2: Chạy**, thấy thất bại.
- [ ] **Step 3: Viết tab** theo mẫu (spec mục 3.3). Đợt 1 hiện "Đã chốt" cho ca có `recon_money_done`, và hiện cách thu theo `cash_mode` của từng ca. Bảng tiền chi tiết thu gọn trong `<details>`.
- [ ] **Step 4: Chạy bài thử** (máy tính + 390px), thấy đạt.
- [ ] **Step 5: Commit**: "Sổ thu chi mới đợt 1: tab Đối soát tiền (chỉ xem)".

### Task 8: Phát hành và ghi tài liệu

**Files:**
- Modify:
  - `docs/version.json`, `docs/js/app.js` (`ASSET_VERSION`), `docs/index.html` (`?v=`);
  - `tai_lieu/TINH_NANG_DA_CHOT.md` (mục mới "Sổ thu chi mới — đợt 1");
  - `tai_lieu/BAN_GIAO.md` (tình trạng; việc tiếp theo = đợt 2);
  - `kiem_tra/trinh_duyet/README.md` (cách chạy `flow_stc1`, `so_thu_chi_tinh_dot1.mjs`, `so_thu_chi_127.sql`).

- [ ] **Step 1: Chạy lại toàn bộ bài thử**, tất cả phải đạt:
  - `jsc -m kiem_tra/so_thu_chi_tinh_dot1.mjs`;
  - `flow_stc1` (chu, máy tính + 390px);
  - `flow_tocdo&role=chu&tre=300`: trang mới mở dưới 1 giây ở giả lập.
- [ ] **Step 2: Tăng phiên bản** (vd `2026.11.19`) ở 3 chỗ và ghi tài liệu.
- [ ] **Step 3: Commit và đẩy lên `main`.** Đợi GitHub Pages (~5–7 phút). Mở web thật bằng tài khoản Chủ, vào `#/quan-ly/so-thu-chi`: thấy số của LHP tháng 11; so 3 ngày bất kỳ với Sổ quỹ cũ.
- [ ] **Step 4: Ghi `app_releases`:** version theo ngày; `added`: "Trang Sổ thu chi (mới) — chạy thử, chỉ xem: Tổng, Đối soát tiền, Sổ thu, Sổ chi, Quỹ ngoài; so với trang cũ"; `released_by`.
- [ ] **Step 5: Báo anh Tiến:**
  - đường dẫn trang;
  - danh sách ngày "So với trang cũ" còn khác, kèm lý do dự đoán;
  - nhắc Revoke mã `sbp_`.
