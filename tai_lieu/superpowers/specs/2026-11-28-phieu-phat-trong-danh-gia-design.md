# Phiếu phạt tiền trong Đánh giá nhân viên — thiết kế ngắn (28/11/2026)

## Vì sao
Anh Tiến: khi đánh giá nhân viên trong ca, nếu nhân viên mắc lỗi thì quản lý lên phiếu phạt luôn tại đó, không phải sang chỗ khác.

## Anh Tiến đã chốt (28/11)
- Phiếu phạt quản lý lập **có hiệu lực ngay**, không chờ Chủ duyệt.
- Phiếu phạt **đi kèm lần trừ điểm / nhắc nhở**: cửa sổ trừ điểm có thêm ô "Phạt tiền". Một lần ghi ra cả điểm lẫn phiếu phạt.

## Mục tiêu
- Cửa sổ "Trừ điểm / nhắc nhở" (dùng chung ở trang đối soát ca và trang Đánh giá) có ô **Phạt tiền (đồng)**, không bắt buộc. Để trống = không phạt.
- Lịch sử, dòng "Ca này: …", thông báo cho nhân viên đều ghi kèm số tiền, vd "Trừ 3 điểm · phạt 50.000đ".
- Nhân viên thấy phiếu phạt và tổng tiền phạt tháng ở trang Điểm đánh giá của mình; giải trình như lần trừ điểm.
- Bảng điểm tháng (trang Đánh giá) có thêm cột **Tiền phạt** của từng người để anh xem khi chốt lương.

## Không làm
- Web **không tự trừ tiền** vào đâu: không đụng Sổ thu chi, khoản âm, đối soát, bảng công. Chỉ ghi lại và cộng tổng.
- Không đổi quyền: ai trừ điểm được (quyền Đối soát) thì lập phiếu phạt được. Không thêm quyền mới.
- Không gộp với tiền phạt việc quá hạn / bỏ ca (hai phần đó giữ nguyên).
- Không có bảng mức phạt cố định theo lỗi.

## Em tự quyết (anh sửa được)
1. Số tiền quản lý tự gõ, số nguyên ≥ 0; trên 200.000đ thì web hỏi lại "Phạt … đồng, đúng không?" để tránh gõ nhầm số 0; tối đa 5.000.000đ một lần (máy chủ chặn).
2. Phạt tiền đi được với cả **Nhắc nhở** (0 điểm).
3. Sửa lần đánh giá thì sửa được số tiền; xoá thì phiếu phạt mất theo.
4. Sau giải trình: **Hoàn lại điểm = huỷ luôn tiền phạt**; Giữ nguyên = giữ cả hai. (Một lần ghi là một khối, không tách.)
5. Khoá theo tháng giống điểm: sửa / xoá / hoàn tới hết ngày 5 tháng sau; Chủ mở lại được.
6. Ô phạt tiền có ở cả hai chỗ mở cửa sổ (đối soát ca và trang Đánh giá) vì là cùng một cửa sổ.

## Cách làm
Đã cân nhắc:
- **A (chọn):** thêm một cột tiền phạt vào chính bảng lưu lần trừ điểm (`eval_marks.fine`). Mọi thứ sẵn có (giải trình, hoàn, xoá, khoá tháng, lịch sử, thông báo) tự áp dụng cho tiền phạt, ít mã mới nhất, khớp đúng điều anh chốt "đi kèm".
- B: bảng phiếu phạt riêng, nối sang lần trừ điểm. Linh hoạt hơn nếu sau này phạt không kèm đánh giá, nhưng phải làm lại giải trình / huỷ / khoá — chưa cần.
- C: ghi vào bảng tiền phạt việc quá hạn. Bảng đó cần Chủ xác nhận, trái với "có hiệu lực ngay".

Việc cụ thể:
- **Máy chủ** — một tệp SQL mới (số kế tiếp trong sổ tệp đã chạy), chạy lại nhiều lần không sao:
  - `eval_marks` thêm `fine bigint not null default 0 check (fine >= 0)`.
  - `app_dg_add`, `app_dg_edit` thêm tham số `p_fine` (mặc định 0, để web cũ vẫn gọi được; bỏ bản hàm cũ để không trùng tên).
  - `app__dg_json` trả thêm `fine`; `app_dg_board`, `app_dg_mine`, `app_dg_history` thêm tổng tiền phạt tháng (chỉ tính dòng `status = 'tru'`).
  - Thông báo cho nhân viên ghi kèm số tiền khi `fine > 0`.
  - Giữ nguyên kiểm tra quyền `app__dg_need` và khoá tháng `app__dg_open`.
- **Web** — `docs/js/danh_gia.js` (ô nhập, nhãn lịch sử, dòng "Ca này"), `docs/js/pages/danh_gia.js` (cột Tiền phạt), `docs/js/pages/danh_gia_toi.js` (tổng phạt tháng + từng phiếu).
- **Bài thử** — thêm vào `kiem_tra/trinh_duyet` (giả lập trả / nhận `fine`): lập phạt kèm trừ điểm, phạt kèm nhắc nhở, hoàn → mất tiền phạt, hỏi lại khi > 200.000đ; máy tính + điện thoại 390px.
- Thứ tự lên web: chạy SQL trước, rồi mới đẩy giao diện; tăng `version.json`, ghi `app_releases`, cập nhật mục 5j của `TINH_NANG_DA_CHOT.md`.

## Không thuộc vùng khoá tiền đối soát
Phần đánh giá (`app_dg_*`, `eval_marks`) không nằm trong danh sách vùng khoá; không sửa `app_can` hay `role_permissions`.
