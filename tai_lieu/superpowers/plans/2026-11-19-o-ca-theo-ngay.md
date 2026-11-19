# Ô Ca theo Ngày — Kế hoạch làm (KH3, lượt 2, bước 163)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (anh Tiến dặn dùng tiết kiệm — tự làm, duyệt 1 lần cuối). Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Trạng thái:** chờ anh Tiến bảo "chạy". Chỉ bắt đầu khi **KH2 đã đẩy lên `main`**. Đọc trước `plans/2026-11-19-lo-trinh-4-ke-hoach.md`.

**Goal:** Trong khung "+ Thêm phiếu" của Sổ thu chi, ô Ca chỉ hiện ca của ngày đang chọn (Sáng → Chiều → Tối, kèm người làm); ca chưa thêm được thì mờ kèm lý do.

**Architecture:** Hàm thuần `caChoices` trong `docs/js/so_thu_chi_tinh.js` lọc + xếp + gắn lý do; `addPanel` trong `docs/js/pages/so_thu_chi.js` gọi nó mỗi khi đổi Ngày để vẽ lại `<select name="ca">`. Không đổi máy chủ.

**Tech Stack:** JavaScript thuần (`html\`\``), `jsc -m`, bộ giả lập `kiem_tra/trinh_duyet/`.

**Spec:** `tai_lieu/superpowers/specs/2026-11-19-o-ca-theo-ngay-design.md` (đã sửa theo bước 158: không còn lý do "đã chốt ca").

## Global Constraints
- Chữ: `Ca <Sáng|Chiều|Tối> · <người làm>`; lý do mờ `— chưa xác nhận Fabi` (ca `recon_money_done` false; cùng chữ web đang dùng ở Đối soát Fabi), `— tháng đã chốt`; nhắc khi không có ca chọn được: `Ngày DD/MM chưa có ca nào xác nhận Fabi`.
- Không dùng `isFin` / `D.finals` (mã chết sau bước 158).
- Không đụng vùng khoá (`can_recon`, `mEdit`, `app__stc_*` …), không đổi máy chủ (máy chủ `app_stc_move_save` vẫn chặn ca chưa chốt tiền).
- `app_releases` (lượt này): changed `["Thêm phiếu: ô Ca chỉ hiện ca của ngày đã chọn, xếp Sáng → Chiều → Tối kèm người làm; ca chưa xác nhận Fabi hiện mờ kèm lý do; ô Ngày không còn bị khoá khi chọn ca"]`.

## Review Focus
1. **Mở khung từ dòng ca (`caId`) của ngày khác hôm nay** — Ngày nhảy sang ngày của ca, ca được chọn sẵn, không về "Ngoài ca". (Task 2)
2. **Đổi Loại sang Cho nợ / Thu nợ / Luân chuyển rồi đổi lại Khoản chi** — ô Ca mở lại, danh sách vẫn theo ngày. (Task 2)
3. **Đổi Ngày khi đang chọn một ca** — ca về "Ngoài ca", Lý do về không bắt buộc; Lưu không gửi `app_stc_move_save` với ca cũ. (Task 2)
4. **Ô Ngày bị xoá trống** — `caChoices` nhận `''` trả mảng rỗng, không lỗi. (Task 1)
5. **Ca không có tên người làm** (`staff` null / rỗng) — hiện `Ca Tối`, không ra chữ "null". (Task 1)

---

### Task 1: Hàm thuần `caChoices` + bài thử

**Files:**
- Modify: `docs/js/so_thu_chi_tinh.js` (thêm export cạnh `SHIFT_ORDER`)
- Create: `kiem_tra/so_thu_chi_tinh_dot8.mjs`

**Interfaces:**
- Produces: `caChoices(cas, date, { locked = false } = {}) → Array<{ id, label, ok: boolean, why: string|null }>` — chỉ ca có `c.date === date`, xếp theo `SHIFT_ORDER`; `label` = `Ca ${shift}` + (` · ${staff}` nếu có); `why`: `locked` → `'tháng đã chốt'`, `!recon_money_done` → `'chưa xác nhận Fabi'`, còn lại `null`; `ok = !why`.

- [ ] **Step 1: Viết bài thử** (mẫu `ok()` như `dot7`). Dữ liệu: 3 ca ngày `2026-11-18` (Tối id 3 `recon_money_done:false`, Sáng id 1 staff `'Hà, Tú'`, Chiều id 2 staff `null`) + 1 ca `2026-11-17`. Khẳng định:
  - `caChoices(C,'2026-11-18').map(x=>x.id).join() === '1,2,3'`
  - `[0].label === 'Ca Sáng · Hà, Tú'`, `[0].ok === true`
  - `[1].label === 'Ca Chiều'`
  - `[2].ok === false`, `[2].why === 'chưa xác nhận Fabi'`
  - `caChoices(C,'2026-11-18',{locked:true}).every(x => x.why === 'tháng đã chốt')`
  - `caChoices(C,'').length === 0`, `caChoices(C,'2026-11-19').length === 0`, `caChoices(undefined,'2026-11-18').length === 0`
- [ ] **Step 2:** `jsc -m kiem_tra/so_thu_chi_tinh_dot8.mjs` → lỗi (chưa có `caChoices`).
- [ ] **Step 3:** Viết `caChoices`.
- [ ] **Step 4:** Chạy lại → đạt; chạy thêm `dot6`, `dot7` → vẫn đạt.

### Task 2: `addPanel` dùng `caChoices` + bài thử Chrome + phát hành

**Files:**
- Modify: `docs/js/pages/so_thu_chi.js` — hàm `addPanel` (dòng ~223–300): bỏ biến `cas` lọc cả tháng (dòng 229); thêm `fillCa()` vẽ lại `<option>` của `[name=ca]` từ `caChoices(D.cas || [], el('date').value, { locked: !!D.locked })` (dòng đầu luôn `Ngoài ca`; ca `ok=false` → `disabled`, chữ thêm ` — ${why}`); dòng nhắc `<div class="st-meta stc-canote">` dưới ô Ca khi không có ca nào `ok`.
- Modify: CSS chỉ khi cần cho `.stc-canote` (390px không tràn).
- Modify: `kiem_tra/trinh_duyet/stc_fixture.js` chỉ khi thiếu: một ngày có ≥2 ca (1 ca `recon_money_done:false`) và một ngày không có ca.
- Create: `kiem_tra/trinh_duyet/flow_stc11.js` (mẫu `flow_stc7.js`); thêm vào `chuan_bi.sh`.

**Interfaces:**
- Consumes: `caChoices` (Task 1).
- Produces: `fillCa()`, `.stc-canote`, ô Ngày không bị khoá (KH4 phải giữ — xem lộ trình).

Hành vi:
- Lúc mở: có `caId` → Ngày = ngày của ca đó (tìm trong `D.cas`), `fillCa()`, chọn `caId`; không có → Ngày = hôm nay.
- `date` change → `fillCa()`; ca đang chọn không còn trong danh sách → `''`; rồi `sync()`.
- `sync()`: bỏ `el('date').disabled = !!ca` và bỏ gán `el('date').value = ca.date` (dòng 265); giữ ẩn/hiện theo Loại, khoá ô Ca khi Loại không phải chi/khac, placeholder Lý do.
- Lưu: tìm ca trong `D.cas` theo `v('ca')`, **chỉ gửi vào ca nếu `ca.date === v('date')`** (chặn Review Focus 3).

- [ ] **Step 1: Viết `flow_stc11.js`** (role chu), kiểm:
  - Mở "+ Thêm phiếu" ở Sổ chi, đặt Ngày = ngày có 2+ ca → ô Ca = `Ngoài ca` + ca ngày đó theo Sáng → Chiều → Tối; không có ca ngày khác.
  - Ca chưa xác nhận Fabi → `option.disabled === true`, chữ chứa `chưa xác nhận Fabi`.
  - Ngày không có ca → 1 option, thấy `chưa có ca nào xác nhận Fabi`.
  - Chọn một ca rồi đổi Ngày → `ca.value === ''`, ô Ngày không `disabled`.
  - Loại → `Cho nợ` → ô Ca `disabled`; đổi lại `Khoản chi` → ô Ca mở, danh sách theo ngày.
  - Bấm `[data-addca]` trong dòng một ca cũ → Ngày = ngày ca, ô Ca chọn sẵn ca đó.
  - `test/phone.html`: `document.documentElement.scrollWidth <= 390`.
- [ ] **Step 2:** Chạy trên bản cũ → lỗi ở ý đầu.
- [ ] **Step 3:** Sửa `addPanel` như trên.
- [ ] **Step 4:** Chạy `flow_stc11` (index + phone) → đạt; chạy lại `flow_stc6`, `flow_stc7` (chu / qlt / ql), `flow_gio162` → đạt.
- [ ] **Step 5: Duyệt mã 1 lần**, sửa điều được chỉ ra.
- [ ] **Step 6: Phát hành** theo lộ trình; cập nhật `BAN_GIAO.md` (bỏ dòng Kế hoạch 3 ở Việc còn mở, ghi bước 163), `README.md` bài thử (dòng `flow_stc11`).
