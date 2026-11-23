# Hướng dẫn cho Claude — web quản lý Milano & Lela

## Người dùng
- Chủ hệ thống: anh Tiến, chủ quán cafe ở Hải Phòng (Milano Coffee: LHP, ĐK, HS; Lela: LL, LLB). **Không phải lập trình viên.**
- Luôn trả lời bằng **tiếng Việt đơn giản**, tránh thuật ngữ; nói rõ đã làm gì, đã kiểm tra gì, anh cần làm gì tiếp.

## Kiến trúc
- Web tĩnh trong `docs/` chạy trên GitHub Pages: https://tiendo286-lab.github.io/Qu-n-tr-cafe/ (đẩy lên `main` là tự triển khai, mất ~5–7 phút).
- JavaScript thuần (ES modules, định tuyến bằng `#/...`), mẫu HTML qua `html\`\`` trong `docs/js/ui.js` (tự thoát ký tự). Menu ở `HUBS` và trang ở `PAGES` trong `docs/js/app.js`.
- Máy chủ: Supabase (dự án `krndtaskjhjpnqauoqiw`, vùng Singapore). Mọi bảng bật RLS và thu hồi quyền; web chỉ gọi hàm `app_*` (SECURITY DEFINER). Hàm nội bộ `app__*` không cho gọi từ web. Quyền kiểm tra bằng `app_can('<quyền>')`.
- Thay đổi CSDL = **thêm tệp mới có số thứ tự** trong `supabase/` (vd `15_....sql`), viết để chạy lại nhiều lần không sao. Tệp đã chạy thì không sửa lại.
- Tính năng đã chốt và việc còn để ngỏ: `tai_lieu/TINH_NANG_DA_CHOT.md` — tệp rất dài, **KHÔNG đọc cả tệp**, tìm đọc đúng mục liên quan (vd `grep -n "^#" tai_lieu/TINH_NANG_DA_CHOT.md` rồi đọc mục cần). Giả định tạm: `tai_lieu/GIA_DINH_CHO_CHOT.md`.
- Bàn giao trạng thái giữa các phiên AI (tình trạng hiện tại, việc còn mở, bài học tốc độ): `tai_lieu/BAN_GIAO.md` — phiên mới đọc tệp này thay cho lịch sử hội thoại cũ; cuối phiên cập nhật lại.
- Kế hoạch / thiết kế superpowers lưu ở `tai_lieu/superpowers/` (plans, specs) — **không** để trong `docs/` vì mọi tệp trong `docs/` đều công khai trên web.

## Quy tắc bắt buộc
- Kho mã này **công khai**. **Không bao giờ** đưa lên GitHub: mã `sbp_`, khóa `service_role`/`sb_secret`, mật khẩu CSDL, token GitHub; dữ liệu thật (`du_lieu/`, `*.sqlite3`), tên nhân viên thật.
- Cập nhật Supabase: dùng Management API (`https://api.supabase.com/v1/projects/krndtaskjhjpnqauoqiw/database/query`) với mã `sbp_` anh Tiến cấp. **Chạy thử trước** trong khối `DO $$ ... RAISE EXCEPTION 'REPORT>> %' ... $$` (tự hoàn tác), xem kết quả rồi mới chạy thật. Dùng xong nhắc anh **Revoke** mã ở https://supabase.com/dashboard/account/tokens.
- Không dùng `x IN (a, NULL)` / `= NULL` trong kiểm tra quyền (ra NULL → bỏ qua kiểm tra); dùng `coalesce`.
- **Mỗi lần cập nhật web** (đẩy lên `main`), ghi/cập nhật một dòng trong bảng `app_releases` trên Supabase: `version` = ngày phát hành `YYYY.MM.DD` (nhiều lần trong ngày thì gộp vào dòng của ngày, hoặc `.2`, `.3`), các mảng `added` / `changed` / `fixed` / `removed` viết tiếng Việt dễ hiểu, `released_by`. Trang LOG hệ thống đọc bảng này.
- Commit với tên `Tien Do <tiendo286@gmail.com>`, cuối thông điệp có dòng `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Khi làm trên đám mây: làm trên nhánh riêng và mở PR; anh Tiến gộp (merge) vào `main` để lên web. Đổi CSDL thì phải cập nhật Supabase **trước** khi gộp giao diện cần nó.
- **Sổ tệp đã chạy** (từ bước 59): mỗi tệp SQL mới, dòng cuối cùng là `insert into public.app_migrations(file) values ('NN_ten_tep.sql') on conflict (file) do nothing;`. Trước khi đặt số thứ tự mới, xem `select max(file) from app_migrations` (trang LOG › Tệp máy chủ đã chạy) để không trùng số.
- **Mỗi lần đẩy giao diện lên `main`**: tăng số trong `docs/version.json` (vd `2026.11.13.2`) — web đang mở sẽ hiện "Có bản mới — Tải lại".
- Bảng mới: mặc định không cấp quyền cho `anon` / `authenticated` (bước 59); web đọc / ghi qua hàm `app_*`. Sao lưu tự lấy mọi bảng (`app__backup_tables`), không cần thêm tay.
- **Chỉ một phiên AI làm việc trên dự án tại một thời điểm** (tránh sửa trùng tệp / trùng số thứ tự SQL). Bắt đầu phiên: `git pull`, xem `git log -5` và sổ tệp đã chạy.

## Khi làm một mình (anh Tiến không có mặt)
- Bắt đầu: `git pull`, `git log -5`, đọc `CLAUDE.md`, `tai_lieu/BAN_GIAO.md`. `TINH_NANG_DA_CHOT.md` chỉ tìm đọc mục liên quan.
- Không dùng quy trình brainstorm / hỏi từng câu. Không dừng lại chờ.
- Không đẩy lên `main`. Không chạy SQL lên Supabase thật, không cần mã `sbp_`, không đụng dữ liệu thật. Chạy thử bằng Supabase giả lập. Mỗi phần việc một nhánh riêng từ `main` + một PR riêng.
- Tệp SQL mới: viết chạy lại nhiều lần không lỗi; dòng cuối ghi `app_migrations` như quy định.
- Bài thử trong `kiem_tra/trinh_duyet`: máy tính + điện thoại 390px. Hỏng thì sửa đến khi đạt; không tắt / sửa bài thử cho qua.
- Cập nhật `TINH_NANG_DA_CHOT.md` (đúng mục) theo quy tắc mới.
- Khi không hiểu / cần hỏi:
  - **A.** Chuyện nhỏ (chữ, nút, bố cục): theo cách web đang làm, ghi vào "Em đã tự quyết".
  - **B.** Nghiệp vụ có 2 cách hiểu: chọn cách an toàn hơn (ít đổi, không đổi tiền, không mở thêm quyền), ghi vào "Cần anh quyết" kèm 2 lựa chọn.
  - **C.** Đụng vùng khoá tiền đối soát, cách tính tiền, quyền, xoá dữ liệu mà việc được giao chưa nói rõ: KHÔNG làm, ghi vào "Chưa làm, chờ anh".
  - **D.** Kẹt quá 3 lần thử: dừng phần đó, ghi đã thử gì, sang phần sau.
- Mỗi PR bàn giao bằng tiếng Việt đơn giản, đủ 5 mục: **Đã làm gì & đã kiểm tra gì** · **Em đã tự quyết** · **Cần anh quyết** · **Chưa làm, chờ anh** · **Anh cần làm gì tiếp** (tệp SQL nào cần chạy, thứ tự gộp). Cuối buổi cập nhật `tai_lieu/BAN_GIAO.md` và viết 1 bảng tổng: phần nào xong / dở / chưa làm.

## Vùng khoá: quyền sửa phần tiền đối soát (anh Tiến chốt 18/11/2026, cập nhật 19/11 bước 152, 23/11 chặng 5)
- **Từ 23/11 (chặng 5), phần tiền đối soát làm ở trang đối soát của ca trong Chốt ca** (`#/ca/doi-soat?id=`): tab ② Phần tiền (5 bước, khối tiền của Sổ thu chi ở chế độ một ca — `caMoney` trong `so_thu_chi.js`), tab ③ Hoàn thành (nút Hoàn thành đối soát ca, Mở lại). Sổ thu chi không còn tab Đối soát Fabi; đường cũ `?tab=doi-soat` tự chuyển sang. Trang Đối soát ca cũ (`doi_soat.js`) chỉ còn dẫn đường.
- Vùng khoá là mã quyết định **ai sửa / xác nhận / chốt được phần tiền của ca, mục nào bị khoá** (cả web lẫn máy chủ). Gồm:
  - Ở `docs/js`: các chỗ dùng `can_recon`, `recon_note`, `is_chu`, `can_unlock`, `can_direct`, `mEdit`, `MONEY_EDIT`, `LKF`, `lkItem`, `ds-money-open`, `ds-money-save`, `app_ca_auto_locks` (mã cũ còn sót trong `phieu_ca.js`, không còn nút gọi); chặng 5: `caMoney` / `ONE` (chế độ một ca) và khoá nút Hoàn thành theo phần việc (`ONE.workLeft` trong `doneStep`); chặng 6.3: nút tích hết mỗi bước (`tickAll`, `data-tickall`) và Xoá lần trả (`traUi`, `traDelDialog`, `data-traxoa`); chặng 6.3c: Khách trả nợ cũ trong ca (`traAddDialog`, `data-traadd`); chặng 6.3d: `addPanel` (`caFix` — phiếu trang ca luôn trong ca, Thu nợ tự Mở lại) và `addBtn` (Sổ thu chi luôn ngoài ca); tệp 170: nút Xoá luân chuyển của ca (`stc-lcdel`, hộp xoá trong `editDialog`); chặng 6.4: `sortUi` ở bước 1 (nợ khách không cần Xếp, Đổi nhóm) và mục `phanloai` trong `so_thu_chi_tinh.js` (chỉ đếm nợ khác).
  - Ở máy chủ: các hàm `app__ca_auto_ok`, `app_ca_recon_apply`, `app_ca_auto_locks`, `app__ca_locked_items`, `app__ca_locked_fields`; phần `can_recon` / `recon_note` của `app_ca_get`; `app_can`; bảng `role_permissions`; khoá Chốt ca `app__stc_final_guard` (tệp 135); quyền Sổ thu chi `app__stc_can` / `app__stc_need` (tệp 136); phần đếm "nợ chưa xếp" của `app__stc_ds_missing` (tệp 166 — bỏ qua nợ khách hàng); xoá phiếu Luân chuyển TM – CK của ca `app_stc_move_exchange_delete` (tệp 170 — cùng điều kiện với `app_stc_move_exchange`); điều kiện "đã Xác nhận Fabi" = đủ dấu 4 mục tiền ở `app__stc_ds_state` / `app_stc_month` (`mdone`) và phần tự Hoàn thành trong `app_stc_ds_close` (tệp 167).
- **Bỏ mật khẩu (anh Tiến chốt 19/11/2026):** không còn hook / mật khẩu. Trước khi sửa vùng này chỉ cần nói cho anh Tiến biết định sửa gì và vì sao (trong thiết kế hoặc trong chat).
- Sửa xong phải chạy bài thử `kiem_tra/trinh_duyet/flow_ql_tu_ds.js` (role=ql và role=chu, ở `index.html` và `test/phone.html`) và thấy đạt, trước khi đẩy lên web. Từ chặng 5 bài này kiểm tra trang đối soát ca 3 thẻ: thẻ ① không có ô sửa tiền, thẻ ② là khối tiền của đúng ca (`#stc-page.stc-one[data-ds]`); chạy thêm `flow_stc6` + `flow_stc7` (role chu / qlt / ql) và `flow_dsca` cho phần tiền. Đổi quyền ở máy chủ thì phải dò cả giao diện (bài học lỗi bước 129, xem `tai_lieu/BAN_GIAO.md`).

## Kiểm tra
- Giao diện chạy thử với Supabase giả lập: `kiem_tra/trinh_duyet/` (xem README ở đó). Không có dữ liệu thật thì bỏ qua bước dựng dữ liệu, chỉ kiểm tra cú pháp + logic.
- Sau khi đổi giao diện, kiểm tra cả khung điện thoại (390px) không bị tràn ngang.
