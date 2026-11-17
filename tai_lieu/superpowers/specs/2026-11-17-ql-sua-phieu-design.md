# Quản lý sửa thẳng số trên Phiếu chốt ca (bước Kiểm tra) — thiết kế ngắn

Ngày 17/11/2026. Anh Tiến duyệt ("được, gộp vào kế hoạch sửa").

## Vì sao
Anh Tiến muốn: khi quản lý mở bước Kiểm tra (hoặc mở lại), sửa thẳng được toàn bộ số tiền trên phiếu, và số trên màn Kiểm tra phải đúng với kết quả chính thức của máy chủ. Kiểm tra ngày 17/11 thấy 2 lỗi tính tiền + 4 chỗ không sửa được (bài thử: `kiem_tra/audit_tien/t01*`, `t02*`, `kiem_tra/trinh_duyet/flow_audit_ql_sua.js` — đều đang FAIL).

## Mục tiêu
1. Ô "Chuyển khoản ngân hàng" ở bước Kiểm tra dùng **Phải nhận = CK Fabi + Thu/Chi CK + Khách trả nợ CK − Nợ CK mới**; KHỚP/LỆCH trùng `ck_left_bank` của máy chủ (17 ca thật trong 31 ngày đang báo sai).
2. Quản lý sửa bất kỳ ô nào ở bước Kiểm tra **không làm mất lương trả tiền mặt** (`cash_paid`).
3. Ô **Nợ**, **Tiền chênh lệch**, **Số dư đầu (bản ghi Fabi, `ipos_opening`)**: tải file Fabi thì tự sửa theo file (có lịch sử "Theo file Fabi"); quản lý sửa tay được ở bước Kiểm tra (bắt buộc lý do, có lịch sử).
4. Chủ "Sửa thẳng" (sau khi đã duyệt phần tiền): sửa được **Khách nợ**; ô của mục **chưa duyệt** vẫn mở như trước khi bấm Sửa thẳng.

5. Quản lý sửa được **Bàn giao ca sau** (sửa nội dung, thêm, xoá dòng chưa giao thành việc) và **thêm / xoá ảnh phiếu Fabi** ở bước Kiểm tra — anh Tiến chốt 17/11 ("2 ý đều sửa được"). Bắt buộc lý do, ghi lịch sử.
6. **Quản lý (có quyền đối soát) được "Sửa thẳng" như Chủ** — anh Tiến chốt 17/11.

7. Ở bước Kiểm tra, dòng **Khách mượn / Nợ tiền mặt** có nút **"Đổi thành Khách CK rút tiền mặt"** — anh Tiến chốt 17/11, sau ca LHP Sáng 09/11 (nhân viên ghi 500.000 CK rút TM thành "Khách mượn", ca Chiều lại chọn "khách trả nợ CK" → Sáng thừa CK +500.000, Chiều thiếu thêm 500.000). Bấm 1 lần: bỏ khoản trả nợ ở ca sau (nếu có), xoá khoản nợ, ghi cặp "Khách CK rút tiền mặt" (tiền mặt −, chuyển khoản +) vào ca này; lịch sử ghi ở cả 2 phiếu. **Anh Tiến tự sửa 2 phiếu 09/11 sau khi web có nút này** — em không sửa dữ liệu.

## Không làm
- Mục web **tự đối soát** (khoá tự động theo file Fabi + ngân hàng) vẫn **chỉ Chủ mở khoá** như đã chốt ở 5u — Sửa thẳng của quản lý không mở được mục này (quyết định của em, anh xem lại).

## Ràng buộc
- Đổi CSDL = tệp mới `supabase/101_ql_sua_phieu.sql`, chạy lại nhiều lần không sao, dòng cuối ghi `app_migrations`. Chạy thử trong khối tự hoàn tác trước.
- Phiếu nhân viên gốc giữ nguyên; quản lý sửa trên bản kiểm tra (`shift_report_recon`); mọi lần sửa ghi `shift_recon_log` (ai, lúc nào, cũ → mới, lý do).
- Tháng đã chốt: không sửa (trigger `fin_guard` đã có).
- Tiền là số nguyên VND.

## Cách làm (đã chọn)
Chỉ một cách hợp lý: vá đúng chỗ gây lỗi, theo kiến trúc đang có (bản kiểm tra + `app__ca_eff` + `app__ca_money`). Cách khác (bỏ bản kiểm tra, sửa thẳng phiếu nhân viên) bị loại vì mất phiếu gốc và lịch sử, trái nguyên tắc đã chốt.

## Quyết định của em (anh xem lại)
- Mục 3: 3 ô mới thuộc nhóm **Doanh thu** (khoá cùng mục Doanh thu, mở cùng mục Doanh thu).
- Mục 4: Chủ Sửa thẳng **làm đổi số lệch** tiền mặt / chuyển khoản so với kết quả đã ghi → máy chủ **từ chối** và nhắc bấm "Mở lại phần tiền" (để kết quả KHỚP đã ghi không thành sai).
- Mục 4: hàm sửa khách nợ cho phép Chủ khi đang Sửa thẳng (ca vẫn "hoàn thành"), ghi lý do vào lịch sử.
