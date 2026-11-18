# Sổ thu chi mới — Đợt 3 (phiếu chênh lệch ngay trong sổ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Xử lý lệch tiền của ca ngay trong Sổ thu chi bằng **phiếu chênh lệch**:
- ca thiếu: Trừ lương / Quán chịu / Ghép với ca dư;
- ca dư: Ghép với ca thiếu / Tạo phiếu thu / Gán nợ khách trả.

Có các luật khoá và Chủ duyệt theo thiết kế mục 3.4.

**Architecture:** Hàm ghi `app_stc_gap_*` bọc hàm có sẵn của tab Lệch tiền ca (`app_gap_tl`, `app_gap_decide`, `app_gap_match`, `app_gap_match_approve`, `app_gap_decision_delete`, `app_gap_match_delete`, `app_ka_delete`) và thêm luật mới:
- Quán chịu / Ghép do người **không phải Chủ** bấm thì **chờ Chủ duyệt** (chỉ Chủ duyệt).
- Quán chịu chờ duyệt lưu ở bảng mới `stc_gap_requests`.
- Ghép chờ duyệt dùng `gap_matches.status = 'cho_duyet'` như cũ.
- Ca thiếu đã có phiếu trừ tiền thì **không ghép được**.
- Ca dư đã có phiếu thu thì **không gán nợ được**.

`app_stc_month` trả thêm chi tiết lệch cho từng khoản chênh lệch: còn lại, người làm ca, phiếu trừ tiền, quán chịu, thu khác, ghép (đã duyệt / chờ duyệt), ca ghép được.

**Spec:** `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md` mục 3.4. Đợt 2: `tai_lieu/superpowers/plans/2026-11-19-so-thu-chi-moi-dot2.md`.

## Global Constraints
- **Ai làm được:** Chủ, Quản lý tổng, Quản lý cơ sở được giao (`app__gap_role` khác null). **Chỉ Chủ duyệt**: lời từ chối khi người khác bấm duyệt là `'Chỉ Chủ duyệt.'`.
- **Khi nào làm được:** chỉ khi ca **đã chốt tiền** (đã đối soát Tiền mặt + Chuyển khoản) và tháng chưa chốt. Lý do bắt buộc.
- **Ca thiếu:**
  - Trừ lương: mặc định chia đều người làm ca, sửa được, tổng ≤ phần còn lại.
  - Quán chịu: Chủ bấm thì có hiệu lực ngay (tạo khoản "Âm tiền – quán chịu"); người khác bấm thì chờ Chủ duyệt.
  - Ghép với ca dư: chỉ ca dư cùng loại tiền, trong 3 ngày; Chủ thì có hiệu lực ngay, người khác thì chờ duyệt.
  - Đã có phiếu trừ tiền thì báo `'Đã tạo phiếu trừ tiền — huỷ phiếu trừ tiền trước khi ghép.'`.
- **Ca dư:**
  - Ghép với ca thiếu: cùng luật như trên.
  - Tạo phiếu thu: nhóm Thu khác, không đổi quỹ.
  - Gán nợ khách trả: Task 3, **vùng khoá**.
  - Đã có phiếu thu thì báo `'Đã tạo phiếu thu — huỷ phiếu thu trước khi gán nợ.'`.
- **Hiển thị:**
  - Sổ chỉ cộng **phần còn lại** của lệch sau khi ghép, theo phép tính "30.000 − 20.000 ghép = 10.000".
  - Trạng thái ghi rõ: "Chờ xử lý · chưa làm phiếu trừ tiền" / "chưa làm phiếu thu", "⏳ chờ Chủ duyệt", "Đã xử lý".
- **CSDL:** tệp `131_so_thu_chi_lech.sql` (bọc hàm + bảng `stc_gap_requests` + `app_stc_month` mới), `132_…` cho gán nợ (vùng khoá). Chạy lại được, ghi `app_migrations`, chạy thử tự hoàn tác trước. Bảng mới không cấp quyền `anon` / `authenticated`.
- **Phát hành:** mỗi lần đẩy `main` thì tăng phiên bản và ghi `app_releases`. Commit theo quy định.

## Review Focus
1. **Ghép từng phần:** ca dư lớn hơn ca thiếu thì ca dư còn phần dư, xử lý tiếp được.
2. **Chủ duyệt rồi huỷ / từ chối:** không còn bản ghi treo.
3. **Ca vừa có ghép chờ duyệt vừa muốn trừ lương phần còn lại:** chỉ cho trừ lương phần còn lại sau khi trừ cả số đang chờ.
4. **Trừ lương rồi huỷ một người:** phần đó trở lại "chờ xử lý"; ghép mở lại khi đã huỷ hết.
5. **Quản lý tổng bấm duyệt:** bị chặn (chỉ Chủ).

### Task 1: Máy chủ 131 — bọc hàm lệch tiền + chi tiết lệch trong `app_stc_month`
**Files:** `supabase/131_so_thu_chi_lech.sql`, `kiem_tra/so_thu_chi_131.sql`.

**Produces:**
- `app_stc_gap_tl(p_report bigint, p_item text, p_people jsonb, p_reason text)`
- `app_stc_gap_qc(p_report bigint, p_item text, p_amount bigint, p_reason text) returns text` (`'ok' | 'cho_duyet'`)
- `app_stc_gap_match(p_short bigint, p_over bigint, p_item text, p_amount bigint, p_reason text) returns text`
- `app_stc_gap_thu(p_report bigint, p_item text, p_amount bigint, p_reason text)`
- `app_stc_gap_approve(p_kind text, p_id bigint, p_ok boolean)` (`p_kind` ∈ `match | qc`)
- `app_stc_gap_undo(p_kind text, p_id bigint, p_reason text)` (`p_kind` ∈ `tl | decision | match | qc`)
- `app_stc_month`: mỗi khoản `col = 'lech'` thêm `gap: {item, kind, total, remain, avail, people:[{id,name}], tl:[{id,name,amount,status}], decisions:[{id,kind,amount}], matches:[{id,with,amount,status,side}], qc_wait:[{id,amount,by}], cands:[{report,label,amount}], has_tl, has_thu}`; số tiền của khoản lệch = phần còn lại sau khi trừ ghép đã duyệt.

Các bước:
- [ ] Viết bài thử: trên một ca thiếu và một ca dư cùng loại tiền, cùng cơ sở, cách nhau ≤ 3 ngày.
  - (a) Chủ ghép → đã duyệt, sổ trừ đúng phần ghép.
  - (b) Trừ lương phần còn lại → `has_tl`; ghép thêm thì bị chặn đúng chữ lỗi.
  - (c) Huỷ phiếu trừ tiền → ghép được lại.
  - (d) Quản lý tổng bấm quán chịu → `cho_duyet`; Quản lý tổng bấm duyệt → `'Chỉ Chủ duyệt.'`; Chủ duyệt → có khoản quán chịu.
  - (e) Phiếu thu cho ca dư → `has_thu`.
  - (f) Ca chưa chốt tiền → bị chặn; nhân viên → bị chặn.
- [ ] Chạy thử thấy lỗi → viết 131 → chạy thử đạt → chạy thật → commit.

### Task 2: Giao diện — phiếu chênh lệch trong sổ
**Files:** `docs/js/pages/so_thu_chi.js`, `stc_gia.js`, `stc_fixture.js`, `flow_stc3.js`.

- [ ] Viết bài thử `flow_stc3`:
  - bấm khoản chênh lệch thì mở phiếu (phải có / thực tế / lệch / người làm ca);
  - ca thiếu có 3 cách xử lý: trừ lương chia đều sửa được, quán chịu, ghép (ca gợi ý trong 3 ngày);
  - ca dư có ghép / phiếu thu;
  - phiếu thu → hiện khoá gán nợ;
  - trừ lương → khoá ghép;
  - ghép hiện "30.000 − 20.000 = 10.000" và xử lý tiếp phần còn lại;
  - Chủ thấy nút Duyệt cho khoản chờ duyệt;
  - không tràn ngang 390px.
- [ ] Chạy thấy lỗi → viết → đạt (`flow_stc1`, `flow_stc2` không vỡ) → commit.

### Task 3 (VÙNG KHOÁ): Gán nợ khách trả cho ca dư
**Dừng trước Task 3, xin anh Tiến mật khẩu.**
- Hàm `app_stc_gap_debt(p_report bigint, p_item text, p_debt bigint, p_amount bigint, p_reason text)`: ghi khách trả nợ **trong ca đã chốt tiền** (nợ của ca trước, chưa thu), không mở lại mục đã duyệt.
- Bị chặn khi ca dư đã có phiếu thu.
- Sau khi sửa: chạy `flow_ql_tu_ds`.

### Task 4: Phát hành
- [ ] Chạy lại toàn bộ bài thử.
- [ ] Phiên bản `2026.11.19.3`.
- [ ] Ghi tài liệu.
- [ ] Đẩy `main`, ghi `app_releases`, báo anh Tiến.
