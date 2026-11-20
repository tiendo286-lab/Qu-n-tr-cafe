# Đối soát thu chi 6 bước · đợt C: sửa số máy Fabi + Chủ duyệt / từ chối; "Ca trước ghi sai" khi ca trước Thu theo ca — kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (làm inline, theo lời anh Tiến "dùng tiết kiệm"). Steps use checkbox (`- [ ]`).

**Goal:** Máy Fabi ghi sai thì quản lý gửi số đúng + lý do, Chủ duyệt / từ chối; chưa duyệt thì không Xác nhận Fabi được; duyệt rồi thì tiền của ca theo số đã duyệt. Ca trước Thu theo ca cũng chọn được "Ca trước ghi sai".

**Spec:** `tai_lieu/superpowers/specs/2026-11-20-doi-soat-thu-chi-6-buoc-design.md` mục 7 (sửa số), mục 5 bước 1 (ca trước ghi sai), mục 10, 11, 12, 13, 15.

## Phát hiện khi đọc mã (20/11 khuya) — quyết định thiết kế

- **Tiền của ca KHÔNG lấy từ file Fabi**: `app__ca_money`, dòng Doanh thu ở Sổ thu (`app_stc_month` cột `dt` = `e.pos_cash`, `e.pos_transfer`) đều đọc số trên phiếu sau đối soát (`app__ca_eff`). File Fabi chỉ dùng để so → ô 🟢 / 🔴 ở bước 1 (`app__stc_ds_state`: `mo1` = tiền mở ca phiếu = `dau`; `dt` = `total_revenue` = `net`; `no` = `pos_debt` = `no`). Nút "Lấy số máy Fabi" (`app_stc_ds_fabi`) chép số máy vào phiếu bằng `app_ca_recon_apply(fields)`.
- **Ruling C1:** Chủ duyệt số sửa = ghi số đã duyệt vào phiếu bằng đúng đường `app_ca_recon_apply` (như "Lấy số máy Fabi"), và `app__stc_ds_state` coi ô đó khớp khi có yêu cầu `duyet` còn hiệu lực bằng đúng số trên phiếu. **Không đổi công thức tính tiền** (mục 12 thiết kế ghi "đổi cách tính tiền" — nay đạt được mà không sửa `app__ca_money`). Ô Doanh thu duyệt 2 số: `pos_cash` = TM, `pos_transfer` = CK, `total_revenue` = TM + CK + `pos_debt` hiện tại. Nếu sai: phải vá thêm `app__ca_money`.
- `app__fabi_apply` (kế toán tải lại file) ghi đè số đã đối soát khi file khác → phải bỏ qua ô có số Chủ đã duyệt (thiết kế mục 15).
- `app_stc_ds_blame` chặn `p.cash_mode = 'ca'`; ca Thu theo ca: tiền mặt thực nhận = `ql_counted` (`app__stc_real_tm`), không phải `cash_counted` → sửa `cash_counted` như nhánh cũ KHÔNG có tác dụng. Cần phân tích sổ quỹ (tiền nộp quỹ của ca trước phải không đổi — thiết kế mục 5) trước khi làm. `stc_cash_tick` (tệp 150) chặn đổi `ql_counted` khi ca đã Hoàn thành → nhánh này phải có lối riêng (thiết kế: ca trước đã Hoàn thành thì không phải Mở lại).

## Global Constraints

- Tệp SQL mới `supabase/153_sua_so_fabi.sql` (máy chủ đang ở 152), chạy lại nhiều lần không lỗi, dòng cuối ghi `app_migrations`; bảng mới bật RLS, thu hồi quyền.
- Vùng khoá: `app_stc_ds_close` (thêm điều kiện), `app_stc_ds_blame` — đã báo anh Tiến ở thiết kế mục 12. Sửa xong chạy `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6`, `flow_stc7` (chu / qlt / ql).
- Quyền: gửi / bỏ sửa = `app__stc_ds_need(<ca>, true)` (ca chưa Xác nhận Fabi); duyệt / từ chối / bỏ số đã duyệt = chỉ Chủ (`system_role = 'chu'`, kiểm bằng coalesce). Không sửa `app_can`, `role_permissions`, `app__stc_can`, `app__stc_need`.
- So sổ tháng cũ / mới trên máy chủ thật: `begin isolation level repeatable read;` đầu bó; so từng cơ sở, từng khoá (bài học 20/11).

## Tasks

### Task 1: Máy chủ — yêu cầu sửa số + Chủ duyệt (tệp 153 phần 1)
Bảng `stc_fix_requests(id, report_id, field mo|dt|no, old_val jsonb, new_val jsonb, reason, status cho|duyet|tu_choi|bo, created_by, created_at, decided_by, decided_at, decide_note)`, mỗi ô của một ca chỉ một yêu cầu `cho` hoặc `duyet` (chỉ mục duy nhất có điều kiện). Hàm `app_stc_fix_request(p_report, p_field, p jsonb, p_reason)` (Chủ gửi = duyệt ngay), `app_stc_fix_cancel(p_req)`, `app_stc_fix_decide(p_req, p_ok boolean, p_note)` (chỉ Chủ; duyệt → `app_ca_recon_apply` ghi số; ghi `shift_recon_log`, `app_log`, `app__notify` nếu có). `app__stc_ds_state`: ô khớp khi có `duyet` bằng số phiếu; trả thêm `fix` theo ô. `app_stc_ds_close` (vùng khoá): còn `cho` / `tu_choi` → chặn. `app_stc_month`: ca trả `fixes`. Bài thử cục bộ `kiem_tra/sua_so_fabi_153_cuc_bo.sql`: gửi / bỏ / duyệt / từ chối theo vai, chặn Xác nhận Fabi, tiền theo số đã duyệt (`app__ca_money`), chỉ một yêu cầu còn hiệu lực mỗi ô.

### Task 2: Máy chủ — tải lại file Fabi không xoá số đã duyệt
Vá `app__fabi_apply` bỏ qua ô có `duyet`. Bài thử: tải lại file khác số → số đã duyệt giữ nguyên.

### Task 3: Máy chủ — "Ca trước ghi sai" khi ca trước Thu theo ca
Phân tích `dayChain` / sổ quỹ trước (tiền nộp quỹ của ca trước không đổi); bỏ chặn trong `app_stc_ds_blame`, chỉnh tiền thực nhận ca trước đúng bằng số lệch, không bắt Mở lại ca trước đã Hoàn thành; `app_stc_ds_blame_undo` tương ứng. Bài thử: số lệch của ca trước đổi đúng bằng số lệch, tiền nộp quỹ không đổi.

### Task 4: Giao diện bước 1
Nút **Sai, sửa số** ở 3 ô (ô Doanh thu 2 số), ô vàng "chờ Chủ duyệt" + **Bỏ sửa**, Chủ thấy **Duyệt / Từ chối**, ô xanh "✓ Chủ đã duyệt số X" (hiện cả số máy), ô đỏ "✗ Chủ từ chối" + **Sửa lại số** / **Bỏ sửa, lấy số máy Fabi**; trạng thái ca 🟠 "Chờ Chủ duyệt số sửa"; Việc cần làm "Số sửa chờ Chủ duyệt". Nút "Ca trước ghi sai" bật cho ca trước Thu theo ca. Bài thử `flow_ds173` (3 vai × 2 khung) + hàm thuần (`fabiNeeds`, `caStage`, `todoItems`).

### Task 5: Tài liệu + phát hành
TINH_NANG_DA_CHOT (bước 173 · đợt C), BAN_GIAO, bó thử máy chủ thật, phát hành như đợt B.
