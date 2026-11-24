# Trang đối soát ca mới — Đợt 2 + 3 (sửa tại chỗ + Hoàn thành mới) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang `#/ca/doi-soat-moi?id=` làm được mọi thao tác đối soát của một ca: sửa tại chỗ không tải lại trang, sửa tự do tới khi Hoàn thành (không còn "Mở lại xác nhận"), Hoàn thành gộp (bỏ nút Xác nhận Fabi), Mở lại, Duyệt phần việc, tự sang ca tiếp theo. Anh Tiến 24/11: "làm toàn bộ để thao tác toàn bộ rồi chỉnh ở đâu chúng ta chỉnh tiếp".

**Architecture:** Máy chủ thêm **luật mới bằng cờ giao dịch** `app.ds_moi` (cùng kiểu cờ `app.stc_treo` đang có): các chốt chặn đọc cờ — có cờ thì chỉ chặn khi ca đã Hoàn thành (`stc_ca_done`), tháng chốt, sai quyền, chờ kế toán (luật 17/11 giữ nguyên); không cờ thì y như cũ (trang cũ không đổi). Trang mới gọi các hàm bọc `app_ds2_*` (đặt cờ rồi gọi đúng hàm cũ — không chép luật). Web: `rpc()` của `sb.js` đổi tên hàm sang `app_ds2_*` khi đang ở đường dẫn `#/ca/doi-soat-moi` (một chỗ, mọi hộp thoại cũ tự dùng luật mới). Trang mới **dùng lại nguyên các hộp thoại + bộ bắt sự kiện của Sổ thu chi** (`bindPage` theo thuộc tính `data-*`) với một "móc" (hook) thay cho vẽ lại cả trang: lưu xong → đọc lại dữ liệu ca → vẽ lại riêng phần thân `#dsm-body`.

**Tech Stack:** JS thuần (ES modules, `html``` của `docs/js/ui.js`), Supabase `rpc`, Postgres plpgsql; thử máy chủ trên Postgres cục bộ (`kiem_tra/may_chu_cuc_bo`), thử giao diện bằng máy chủ giả (`kiem_tra/trinh_duyet`).

**Spec:** `tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md` (5.3–5.6, 9). Đợt 1: `tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-1.md`.

**Khác thiết kế (em quyết, ghi sổ):**
1. Không tách hàm cũ thành "lõi + kiểm" như 5.5 viết — dùng cờ giao dịch trong chốt chặn: ít đụng mã hơn, cùng kết quả (cũ = luật cũ, mới = luật mới, cùng phần ghi dữ liệu).
2. Sau mỗi lần lưu làm đổi tiền: trang **tự đọc lại** dữ liệu ca (sổ tháng + phiếu ca) và vẽ lại phần thân — số luôn đúng, không cần dòng "Số chưa tính lại". Tích / Để sau / chọn nhóm: đổi tại chỗ ngay. Chức năng "đọc riêng một ca" ở máy chủ để sau (tối ưu tốc độ).
3. Phần việc: làm tại trang mới nút **Duyệt phần việc** + trạng thái; sửa giờ người làm / đánh giá / đếm lại két / nghỉ & làm thay dẫn sang chỗ đang làm (trang cũ thẻ ①, trang Duyệt nghỉ & làm thay) — ghi vào "chỉnh tiếp".
4. Ca chờ kế toán vẫn khoá ghi như luật 17/11 (thiết kế 5.2 có câu "mục Tiền mặt vẫn sửa được trong lúc chờ" — trái chốt chặn đang có; chọn cách an toàn, hỏi anh).
5. Tệp máy chủ số **173** (172 thiết kế dành cho cách A đang tạm dừng).

## Global Constraints

- Trang cũ (`#/ca/doi-soat?id=`, Sổ thu chi) giữ **luật cũ**; mọi hàm cũ gọi không cờ cho kết quả y như trước.
- Không đổi quyền (ai được làm), không đổi cách tính tiền, không đổi cách ghi dữ liệu của hàm cũ.
- Cờ `app.ds_moi` chỉ đặt bằng `set_config('app.ds_moi','1', true)` (hết khi hết giao dịch) trong các hàm `app_ds2_*`; web không tự đặt được.
- Hàm mới: `revoke all … from public, anon; grant execute … to authenticated`; tên thêm vào vùng khoá trong `CLAUDE.md`.
- Tệp SQL chạy lại nhiều lần không lỗi; dòng cuối `insert into public.app_migrations(file) values ('173_doi_soat_moi_sua_tu_do.sql') on conflict (file) do nothing;`.
- Hoàn thành mới: **một giao dịch** — hỏng ở đâu không lưu gì; chỉ tích các ô cơ bản và duyệt các phần việc mà web đã hiện cho quản lý xem (truyền lên trong tham số).
- Không vẽ lại cả trang (`render()` của `app.js`) sau khi lưu trên trang mới.
- Điện thoại 390px không tràn ngang; chữ tiếng Việt dễ hiểu; không tên nhân viên thật trong kho mã.
- Vùng khoá: sửa xong chạy `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6`, `flow_stc7`, `flow_dsca`, `flow_tick63`, `flow_stc17` (chu / qlt / ql × 2 khung) — phải đạt như trước.
- Commit `Tien Do <tiendo286@gmail.com>`, dòng cuối `Co-Authored-By: Claude <noreply@anthropic.com>`. Chạy thật máy chủ + đẩy web: hỏi anh Tiến một câu trước.

## Review Focus

- Cờ rò sang hàm cũ: gọi hàm cũ trong giao dịch khác (PostgREST mỗi lệnh một giao dịch) phải vẫn luật cũ — bài thử máy chủ gọi hàm cũ sau khi xoá cờ.
- Ca đã Hoàn thành: mọi hàm `app_ds2_*` sửa tiền phải báo "Ca đã hoàn thành đối soát — bấm Mở lại trước."
- Ca "đã Xác nhận Fabi" từ trang cũ rồi sửa ở trang mới: Hoàn thành mới ghi lại 4 mục tiền theo số mới (không bị chặn "Ca đã chốt tiền").
- Hoàn thành thiếu mục: báo danh sách, **không** lưu dấu tích / duyệt phần việc / xác nhận nào.
- Đổi đường dẫn khỏi trang mới: `rpc()` thôi đổi tên hàm (trang cũ, Sổ thu chi gọi hàm cũ).

---

### Task 1: Máy chủ — tệp `supabase/173_doi_soat_moi_sua_tu_do.sql`

**Files:** Create `supabase/173_doi_soat_moi_sua_tu_do.sql`, `kiem_tra/doi_soat_moi_173_cuc_bo.sql`; script tạo tệp ở scratchpad (lấy định nghĩa đang chạy trên máy chủ thật, thay đúng 1 chỗ mỗi hàm, kiểm số lần thay = 1).

**Interfaces — Produces:**
- `app__ds_moi() returns boolean` = `coalesce(current_setting('app.ds_moi', true), '') = '1'`.
- Chốt chặn có nhánh cờ: `app__stc_ds_need` (p_open + cờ → chỉ chặn khi có `stc_ca_done`: 'Ca đã hoàn thành đối soát — bấm Mở lại trước.'), `app__stc_gap_need` (cờ → bỏ điều kiện đã xác nhận, thêm chặn `stc_ca_done`), `app_stc_move_save` (cờ → bỏ 'Ca chưa chốt tiền'), `app_stc_move_exchange`, `app_stc_move_exchange_delete` (cờ → bỏ 'chưa xác nhận Fabi'), `app_ca_recon_debt_collect`, `app_ca_recon_debt_uncollect` ×2 (cờ → bỏ 'Mục … đã đối soát', vẫn chặn đã Hoàn thành).
- Hàm bọc (đặt cờ, gọi hàm cũ, cùng tham số / kiểu trả): tên = tên cũ đổi đầu `app_stc_` / `app_ca_recon_` thành `app_ds2_`: `ds_blame, ds_blame_undo, ds_cash, ds_fabi, fix_cancel, fix_decide, fix_request, move_save, move_exchange, move_exchange_delete, gap_debt, gap_match, gap_qc, gap_thu, gap_tl, gap_undo, debt_collect, debt_uncollect (2 bản)`.
- `app_ds2_work_ok(p_report bigint, p_parts text[]) returns void` — duyệt các phần việc trong `p_parts ∩ {nhan_su, ban_giao, nhap_hang}` chưa duyệt (`app_ca_check(…, true)`).
- `app_ds2_finish(p_report bigint, p_parts text[], p_ticks text[]) returns jsonb` — một giao dịch: đặt cờ; đã Hoàn thành thì trả luôn; duyệt `p_parts`; phần việc còn thiếu (trừ x2) → báo; `app_stc_ds_close` (ghi lại 4 mục tiền theo số hiện tại; cờ → không chặn ca đã xác nhận); tích `p_ticks ∩ {anh, sot, that, goi}` bằng `app_stc_tick`; `app_stc_ds_done` (thiếu → 'Còn mục chưa kiểm tra: …'). Trả `{done, recon_status}`.
- `app_ds2_reopen(p_report bigint, p_reason text) returns void` — `app_stc_ds_undone` rồi `app_stc_ds_reopen` (bỏ Hoàn thành + mục tiền, giữ duyệt phần việc).

- [ ] Bài thử cục bộ viết trước (REPORT>>): (a) ca đã xác nhận: `app_stc_ds_cash` báo 'Ca đã chốt tiền', `app_ds2_ds_cash` được; (b) ca chưa xác nhận: `app_stc_move_save` báo 'Ca chưa chốt tiền', `app_ds2_move_save` được; (c) có `stc_ca_done`: `app_ds2_ds_cash`, `app_ds2_move_save` báo 'Ca đã hoàn thành đối soát'; (d) xoá cờ rồi gọi hàm cũ → luật cũ; (e) `app_ds2_finish` thiếu ô tích → báo, không có dòng `stc_ca_ticks` / `stc_ca_done` mới; đủ `p_ticks` → có `stc_ca_done`; (f) `app_ds2_reopen` → hết `stc_ca_done`, hết kết quả `tien_mat` / `chuyen_khoan`, còn dấu duyệt `nhan_su`; (g) chạy tệp 2 lần.
- [ ] Chạy trên CSDL cục bộ trước khi có tệp → LỖI (hàm chưa có).
- [ ] Viết tệp 173; chạy 2 lần trên cục bộ; bài thử ĐẠT.
- [ ] Chạy thử trên máy chủ thật **tự hoàn tác** (cả tệp + vài lệnh kiểm trên một ca thật, RAISE cuối) → không lỗi.
- [ ] Commit.

### Task 2: Web — đổi tên hàm theo đường dẫn + móc của Sổ thu chi

**Files:** Modify `docs/js/sb.js` (bảng `DS2` + `rpc()`), `kiem_tra/trinh_duyet/sb_gia.js` (cùng bảng), `docs/js/pages/so_thu_chi.js` (móc), `kiem_tra/trinh_duyet/stc_gia.js` (máy chủ giả: `app_ds2_*` + luật mới theo cờ).

**Interfaces — Produces:**
- `sb.js`: `export const DS2 = new Set([...18 tên cũ])`; `rpc(name)` gọi `name.replace(/^app_(stc|ca_recon)_/, 'app_ds2_')` khi `name ∈ DS2` và `location.hash` bắt đầu bằng `#/ca/doi-soat-moi`.
- `so_thu_chi.js`: `export async function stcMoi({ cn, thang, ds, hook })` → `{ D, a }` (đặt `P`, `ONE = { moi: true, workLeft: [] }`, `DS_SEL`, `HOOK`; nạp bằng `load()` đã xoá `CACHE`); `export function stcBind(root, D)` (gắn đúng các bộ bắt sự kiện của `bindPage` lên `root`); `after()` và mọi chỗ gọi `rerender()` trực tiếp: có `HOOK` thì gọi `HOOK(msg)`; `render()` / `caMoney()` đặt `HOOK = null`. Xuất thêm để vẽ: `personSelect`, `catOptions` (nếu cần) — chỉ xuất, không đổi.
- [ ] Bài thử trước: `flow_dsm2` phần A (đường dẫn trang mới gọi `app_ds2_ds_cash`, trang cũ gọi `app_stc_ds_cash` — đếm trong `window.__LOG`).
- [ ] Làm; bài thử A ĐẠT; bộ vùng khoá trang cũ ĐẠT.
- [ ] Commit.

### Task 3: Trang mới — trang ② Tiền sửa tại chỗ

**Files:** Modify `docs/js/pages/doi_soat_moi.js`.

Nút / ô dùng đúng thuộc tính của trang cũ (bộ bắt của `bindPage` xử lý): số máy `data-dsfabi`, `data-dsfix` + `data-ca`, `data-dsfixok|no|cancel|fabi`; ca chịu lệch mở ca `data-dsblame` / `data-dsunblame`; ảnh `data-dsphoto`; tiền mặt quản lý đếm `.stc-dsp [name=ds_tm]` + `data-dscash`, `data-dsmode`; nợ mới `data-dedit`, `data-dadd`, xếp nợ `data-dsort` (`data-dgrp`, `data-dperson`, `data-dsortok`); khách trả nợ cũ `data-traadd`, `data-traxoa`; khung thu / chi `data-ed` (bấm khung → hộp Sửa / Xoá), chọn nhóm `select[data-catx]`; "+ Thêm phiếu" `data-addca` + `data-book`; lệch `data-gap`, Để sau `data-dssau`; ô tích `data-tick`; phiếu chi chuyển khoản `data-bankout`; giờ chốt `watchGio`.
Móc sau khi lưu: tích / Để sau / chọn nhóm → sửa dữ liệu trong trang + vẽ lại phần thân (không gọi máy chủ); thao tác khác → đọc lại (sổ tháng + `app_ca_get` + một ngày bảng tuần + ca chưa xong) rồi vẽ lại phần thân, giữ trang đang mở và vị trí cuộn.
- [ ] Bài thử trước `flow_dsm2` phần B: tích một ô → ✓ ngay, không vẽ lại cả trang (phần tử đánh dấu ngoài `#dsm-body` còn), ≤ 1 lệnh; chọn nhóm khoản chi → lưu 1 lệnh; bấm khung chi → hộp sửa mở; lưu → số phải có cập nhật; ca đã xác nhận: "Lấy số máy" vẫn làm được (gọi `app_ds2_ds_fabi`); không tràn ngang.
- [ ] Làm; ĐẠT chu / qlt / ql × 2 khung.
- [ ] Commit.

### Task 4: Trang mới — ① Duyệt phần việc, ③ Hoàn thành mới / Mở lại / tự sang ca

**Files:** Modify `docs/js/pages/doi_soat_moi.js`, `docs/js/doi_soat_moi_tinh.js` (hàm `workParts(R, dsRow)`, `finishArgs(D, ca, R, dsRow)`), `kiem_tra/doi_soat_moi_tinh_dot2.mjs`.

- `workParts` → các phần việc chưa duyệt sẽ duyệt (`nhan_su`, `ban_giao`, `nhap_hang` khi có hàng), bỏ `ban_giao` khi `cash_hand.state === 'can_dem_lai'` (báo "Nhận két lệch: cùng người ca trước đếm lại").
- `finishArgs` → `{ parts, ticks }` (ticks = khoá của `confirmList`).
- Trang ①: nút `#dsm-workok` "Duyệt phần việc" (gọi `app_ds2_work_ok`), dẫn sang trang cũ thẻ ① để sửa giờ / đánh giá / đếm lại két, sang trang Duyệt nghỉ & làm thay.
- Trang ③: nút `#dsm-done` "Hoàn thành" → hộp xác nhận (liệt kê `confirmList` + phần việc sẽ duyệt) → `app_ds2_finish`; lỗi → hiện chữ máy chủ trong `#dsm-finerr`; xong → "Đã hoàn thành" + sau 1,5 giây mở "Ca tiếp theo chưa xong" (nút `#dsm-stay` "Ở lại ca này"); hết ca → về bảng tuần. Ca đã Hoàn thành: nút `#dsm-reopen` "Mở lại" (lý do không bắt buộc) → `app_ds2_reopen`.
- Bỏ dòng "Bản xem thử"; đầu trang ghi "Trang mới — sửa được tại đây; trang cũ vẫn dùng được".
- [ ] Bài thử hàm thuần trước (`doi_soat_moi_tinh_dot2.mjs`), rồi `flow_dsm3`: Hoàn thành thiếu → báo, không đổi trạng thái; Hoàn thành đủ → ca Hoàn thành, tự sang ca; Ở lại; Mở lại; nv không vào được.
- [ ] Làm; ĐẠT; `flow_dsm1` sửa theo luật mới (không còn "Bản xem thử", nút Hoàn thành mở).
- [ ] Commit.

### Task 5: Kiểm tra toàn bộ + tài liệu + phát hành

- [ ] `chay_tinh.sh`, so số thật, `flow_dsm1/2/3` 4 vai × 2 khung, bộ vùng khoá → ĐẠT.
- [ ] `CLAUDE.md` vùng khoá thêm các hàm mới + chỗ móc trong `so_thu_chi.js` / `sb.js`; `TINH_NANG_DA_CHOT.md`, `BAN_GIAO.md`.
- [ ] Hỏi anh Tiến; được thì: chạy thật tệp 173 (lúc vắng) → tăng `docs/version.json` → đẩy `main` → `app_releases` → kiểm web thật.
