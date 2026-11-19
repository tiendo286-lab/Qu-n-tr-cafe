# Đối soát Fabi + Chốt ca + Khoản treo — Kế hoạch làm

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (anh Tiến dặn dùng tiết kiệm: tự làm, duyệt 1 lần cuối). Steps dùng `- [ ]`.

**Goal:** Đưa tab "Đối soát Fabi" (A · Fabi → B · Thu chi của ca → 🔒 Chốt ca) và Khoản treo lên web thật, đúng như bản mẫu đã chốt.
**Architecture:** Máy chủ: tệp `supabase/135_doi_soat_fabi_chot_ca.sql` (bảng `stc_ca_finals`, `stc_treo`, trigger `stc_final_guard`, hàm `app_stc_ca_final`, `app_stc_finals`, `app_stc_treo_use`, `app_stc_treo_close`, sửa `app_stc_ds_close`). Giao diện: `docs/js/pages/so_thu_chi.js` (vẽ) + `docs/js/so_thu_chi_tinh.js` (hàm thuần). Trang hỏi thêm `app_stc_finals` cùng lúc với `app_stc_month`.
**Tech Stack:** JS thuần (ES modules, `html\`\``), Supabase plpgsql, bộ thử Chrome giả lập `kiem_tra/trinh_duyet/`.
**Spec:** `tai_lieu/superpowers/specs/2026-11-19-doi-soat-fabi-chot-ca-design.md`

## Global Constraints
- Chữ giao diện tiếng Việt như bản mẫu: "Đối soát Fabi", "Lấy số máy Fabi", "Xác nhận Fabi", "Mở lại xác nhận", "🔒 Chốt ca", "Chốt vĩnh viễn", "Khoản treo", "Đã về", "Ghép với ca thiếu", "Trừ tiền nhân viên", "Quán chịu".
- Hạn chờ tiền về **3 ngày**; tiền thừa giữ **tới hết tháng** rồi thành Thu khác.
- Chênh lệch: tiền mặt chỉ ở bảng Tiền mặt, chuyển khoản chỉ ở bảng Chuyển khoản; dư ghi Sổ thu, thiếu ghi Sổ chi; mỗi nguồn một dòng, không gộp.
- Không đụng mã vùng khoá ở `docs/js` (`can_recon`, `mEdit`, `LKF`…).
- Điện thoại 390px không tràn ngang.
- Không tên nhân viên thật trong bài thử / tệp đưa lên GitHub.

## Review Focus
1. Ca đã chốt mở ở trang cũ (Đối soát ca, Thu chi): không được lỗi khi xem; sửa thì báo "đã CHỐT CA".
2. Kế toán tải lại file Fabi / nhập số dư ngân hàng cho ngày có ca đã chốt: không lỗi, số ca chốt giữ nguyên.
3. Ca có mục tiền đã tự đối soát (khoá tự động): "Xác nhận Fabi" không báo lỗi khoá nếu kết quả trùng.
4. Quản lý cơ sở (không phải Chủ) quán chịu khoản treo quá hạn → chờ Chủ duyệt → Chủ duyệt vẫn ghi được lên ca gốc đã chốt.
5. Tháng đã CHỐT (khoá tháng): mọi nút chốt ca / khoản treo bị chặn với thông báo rõ.

---

### Task 1: Máy chủ 135 (VÙNG KHOÁ) — xong phần viết + thử tự hoàn tác
**Files:** Create `supabase/135_doi_soat_fabi_chot_ca.sql`, `kiem_tra/so_thu_chi_135.sql`
**Produces:** `app_stc_ca_final(p_report bigint) → {treo:[{id,item,kind,amount}]}`; `app_stc_finals(p_branch bigint, p_month text) → {finals:[{id,by,at}], treo:[{id,report_id,date,shift,pm,kind,amount,left,status,done_kind,done_note,done_at,days_left,over,thu_khac}]}`; `app_stc_treo_use(p_treo, p_report, p_amount, p_reason) → void`; `app_stc_treo_close(p_treo, p_kind 'tru'|'qc', p_people jsonb, p_reason) → 'ok'|'cho_duyet'`.
- [x] Viết tệp + bài thử; chạy 135 ×2 + bài thử trên máy chủ thật (tự hoàn tác) → REPORT đạt (a)…(f).
- [ ] Chạy thật (sau Task 6 đạt): DO-thử lần cuối → chạy tệp → `select file from app_migrations where file like '135%'`.

### Task 2: Hàm thuần trong `so_thu_chi_tinh.js`
**Files:** Modify `docs/js/so_thu_chi_tinh.js`; Test `kiem_tra/so_thu_chi_tinh_dot6.mjs`
**Produces:**
- `caStage(c, cs, fin) → {k:'kt'|'lech'|'cho'|'fab'|'fin', txt, cls}`.
- `finalNeeds(c, items, gaps) → {need:string[], treo:[{pm,kind,amount}]}`, cùng luật với máy chủ: chưa xác nhận Fabi; chi chưa nhóm; chờ Chủ duyệt; TM thiếu còn > 5.000.
- `treoView(t) → {label, cls, over}`.
- [ ] Test (jsc): ca chưa xác nhận → need có "Chưa xác nhận Fabi"; ca có chi không nhóm → "Còn khoản chi chưa phân loại"; CK thiếu 98.000 chưa xử lý → treo `{pm:'ck',kind:'tien',amount:98000}`; TM thiếu 20.000 → need "Tiền mặt thiếu 20.000…"; dư 46.000 → treo thua; treo `days_left −2` loại tien → over, nhãn "quá hạn 2 ngày".
- [ ] Viết hàm, chạy `jsc -m kiem_tra/so_thu_chi_tinh_dot6.mjs` → ĐẠT; chạy lại `dot1/dot3/dot4` → ĐẠT.

### Task 3: Giả lập cho bộ thử Chrome
**Files:** Modify `kiem_tra/trinh_duyet/stc_gia.js`, `stc_fixture.js`
- [ ] Thêm `app_stc_finals`, `app_stc_ca_final`, `app_stc_treo_use`, `app_stc_treo_close` theo đúng Produces Task 1; sửa giả lập (`app_stc_move_save`, `app_stc_gap_*`, `app_stc_ds_*`) báo "Ca này đã CHỐT CA…" khi ca đã chốt.

### Task 4: Tab "Đối soát Fabi" (`so_thu_chi.js`)
- [ ] `TABS` nhãn "Đối soát Fabi"; `load()` hỏi `app_stc_finals` cùng lúc `app_stc_month` (`Promise.all`), gắn `D.finals`, `D.treo`.
- [ ] `dsBody`: ô đếm theo `caStage`; bảng ngày × ca; khung ca rộng hết trang = `partA` + `partB` + `partFinal`.
- [ ] `partA`: 3 ô ① với chữ mới + dòng "ảnh hưởng sổ"; khung vàng hoá đơn sửa / xoá; ② như cũ; nút Xác nhận Fabi / Mở lại xác nhận (ẩn khi đã chốt); thu gọn 5 ô số khi đã xác nhận.
- [ ] `partB`: Sổ thu | Sổ chi + TM | CK riêng của tab; ô số; Tiền của ca; Nợ bill của ca; sổ của ca (`itemRow`, `addBtn`); khung Chênh lệch theo bảng + sổ, dòng nhắc "Ca còn chênh lệch ở…".
- [ ] `partFinal`: nút 🔒 Chốt ca (điều kiện `finalNeeds`), hộp xác nhận, gọi `app_stc_ca_final`; đã chốt → khung xanh.

### Task 5: Tab Tổng — Khoản treo; Sổ chung
- [ ] Ô "Khoản treo" + khung bên phải (Đã về / Ghép → hộp chọn ca nhận từ `D.cas` đã xác nhận, chưa chốt, có dư / thiếu cùng loại; quá hạn → Trừ tiền nhân viên / Quán chịu).
- [ ] Sổ chung + phiếu chênh lệch: ca đã chốt ẩn nút, hiện "🔒 Ca đã chốt"; đổi chữ "Chốt tiền ca ở tab Đối soát tiền…"; đường dẫn "Xử lý & chốt ca này ở Đối soát Fabi ›".

### Task 6: Bộ thử Chrome + chạy lại cũ
- [ ] `kiem_tra/trinh_duyet/flow_stc6.js`: Xác nhận Fabi → khung chênh lệch đúng bảng / sổ → Chốt ca bị chặn khi chi chưa nhóm → nhóm xong → Chốt vĩnh viễn → nút ẩn → tab Tổng có khoản treo → Đã về; role chu + qlt; `index.html` + `test/phone.html`; tràn ngang = 0.
- [ ] Chạy lại `flow_stc1…5`, `flow_ql_tu_ds` (ql + chu, 2 khung) → ĐẠT.

### Task 7: Lên web
- [ ] Chạy SQL thật (Task 1). Tăng `docs/version.json`, `ASSET_VERSION`, `?v=`; commit; push `main`; ghi `app_releases`; cập nhật `BAN_GIAO.md`, `TINH_NANG_DA_CHOT.md`, README bộ thử; nhắc anh Revoke mã `sbp_`.
