# Ghi chú sửa thu chi trên Phiếu chốt ca — thiết kế ngắn

17/11/2026 · anh Tiến chốt (chọn a + b, duyệt ảnh mẫu https://claude.ai/artifact/9KE994ycFF3EhLKxzoV44M).

## Vì sao
Chủ / quản lý thêm, sửa, xoá khoản Thu / Chi ở bước Kiểm tra thì phải thấy ngay trên dòng: ai, lúc nào, lý do, nhân viên ghi gì lúc đầu. Nhân viên mở lại phiếu của mình cũng thấy, để lần sau ghi đúng. Hiện chỉ có nhãn chung "Đã sửa so với phiếu NV"; dòng bị xoá biến mất.

## Làm gì
- **Bước Kiểm tra** (quản lý / Chủ) và **phiếu nhân viên đã gửi** (chỉ xem): mỗi khoản Thu / Chi (kể cả "Khách CK rút tiền mặt", tính 1 dòng) có ghi chú khi khác phiếu nhân viên gửi:
  - **✎ sửa** (tím): cùng nội dung khác số tiền, hoặc cùng số tiền khác nội dung, hoặc đổi loại → "✎ <tên> sửa · <ngày giờ> · NV ghi / Bạn ghi: <số cũ hoặc nội dung cũ> · Lý do: …"
  - **＋ thêm** (xanh): "＋ <tên> thêm · <ngày giờ> · Lý do: …"; nếu là khoản đổi từ Khách mượn: "✎ <tên> đổi từ "Khách mượn <số>" · …"
  - **✗ xoá** (đỏ): dòng vẫn hiện, gạch ngang, mờ, không sửa được; "✗ <tên> xoá · <ngày giờ> · Lý do: …"
- Không ghi chú: dòng giữ nguyên; sửa rồi sửa lại về như cũ cũng không ghi chú.
- Phiếu nhân viên: nhãn vàng "Quản lý đã sửa N khoản thu chi" ở đầu; danh sách thu chi hiện **số hiện tại** + dòng đã xoá (thay cho số gốc).
- Không tính: dòng tự sinh (lương trả tiền mặt, khách mượn), dòng Báo nợ (đã có ghi chú riêng).

## Cách làm (đã chọn: 1)
1. **Máy chủ tính** (chọn): hàm `app__ca_move_notes(p_id)` so thu chi phiếu nhân viên gửi (`app__recon_snapshot`) với hiện tại (`app__ca_eff`, bỏ dòng tự sinh, gộp cặp đổi tiền), lấy tên / giờ / lý do từ `shift_recon_log` (field `moves`). `app_ca_get` trả thêm `move_notes` cho phiếu đã gửi → cả 2 màn dùng chung; lần sửa cũ cũng có ghi chú; nhân viên xem được (không cần quyền đối soát).
2. Trình duyệt tự tính từ lịch sử — loại: nhân viên không đọc được lịch sử đối soát.
3. Ghi chú dính vào dòng lúc lưu — loại: phải sửa mọi chỗ lưu, mất ghi chú các lần sửa cũ.

## Ràng buộc
Tệp máy chủ mới `supabase/102_ghi_chu_sua_thu_chi.sql` (chạy lại được, dòng cuối ghi `app_migrations`); chạy thử tự hoàn tác trước. Kiểm tra máy tính + điện thoại 390px. Không tên nhân viên thật trong tệp.

## Quyết định của em
- Tên người sửa = tên tài khoản (`app__acc_name`), không ghi "Chủ" / "Quản lý" chung chung như ảnh mẫu.
- Ghép "sửa": ưu tiên cùng loại + cùng nội dung → cùng loại + cùng số tiền → cùng nội dung + cùng số tiền (đổi loại); còn lại là thêm / xoá.
