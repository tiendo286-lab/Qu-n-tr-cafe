# Các giả định tạm — chờ chủ hệ thống chốt

Bản web đang chạy theo các giả định dưới đây cho những điểm đặc tả **chưa chốt** (mục 8 của đặc tả). Anh chốt điểm nào thì báo để sửa.

## Quản lý ca
1. **Công nợ**: mới chỉ ghi sổ (bàn, số tiền, thông tin bàn giao, đánh dấu đã thu kèm ghi chú). Chưa đưa vào công thức doanh thu / tiền. Phiếu có công nợ phát sinh thì **không bị chặn** bởi công thức Mục 1 = Mục 2 + Mục 3.
2. **Tab kế toán nhập chuyển khoản**: chưa làm.
3. **Giờ bắt đầu ca Tối**: nhân viên tự chọn (phiếu có hiện giờ kết thúc ca Chiều để tham khảo). Ca Chiều chưa hoàn thành ca Sáng thì tạm nhập tay.
4. **Tiền đầu ca lệch ca trước / ca trước chưa chốt**: chỉ báo đỏ hoặc báo "chưa có số liệu", vẫn cho hoàn thành.
5. **Sửa / mở lại phiếu**: phiếu đã hoàn thành thì khóa. Quyền "Mở lại phiếu chốt ca" (mặc định Chủ, Quản lý tổng). Mở lại thì phải đối soát lại từ đầu.
6. **Việc bàn giao không qua tab Họp**: người chốt ca sau bấm "Đã xong" (lưu người, giờ).
7. **Ai chốt ca**: ai đăng nhập cũng mở và điền phiếu được; "người chốt ca" là người bấm Xác nhận hoàn thành.
8. **Nhập hàng**: thêm lựa chọn "Ca này không nhận hàng".
9. **Tiền mặt cuối ngày phải có** = 1.000.000đ đầu ngày + tiền mặt POS các ca + thu/chi tiền mặt đã kê khai. Ngày có công nợ thì ghi chú "chỉ để tham khảo".

## Họp & giao việc
10. **Cuộc họp** chỉ gồm tên, ngày, ghi chú ngắn (mục 8.10 chưa chốt chi tiết).
11. **Giao việc, duyệt báo cáo**: quyền "Họp & giao việc" (mặc định chỉ Chủ). Người duyệt không được là người nhận việc.
12. **Người nhận việc**: Quản lý tổng, Quản lý. Chọn người + hạn thì việc tự chuyển "Đã giao" và báo cho người đó.

## Nội quy, Quy trình, Cam kết
13. **Soạn / đăng**: quyền "Soạn nội quy, quy trình" (mặc định chỉ Chủ).
14. **Đã đọc nội quy**: nhân viên tự bấm "Tôi đã đọc"; quản lý đánh dấu thay được ở tab Nhân viên. Đăng bản sửa mới → mọi người phải đọc lại.
15. **Cam kết**: quản lý chọn Chưa ký / Đã ký, chưa nộp / Đã ký và nộp. Chưa có tải minh chứng.

## Đào tạo
16. **Quyền**: "Đào tạo" (mặc định Quản lý tổng, Quản lý) tạo và sửa mọi phiếu; người hướng dẫn chính / người đào tạo tiếp sửa phiếu mình phụ trách; nhân viên chỉ xem phiếu của mình và bấm xác nhận cuối ngày.
17. **Xác nhận thay chữ ký**: hệ thống lưu người và giờ bấm.
18. **Đào tạo tiếp**: tự chuyển khi quá 8 ngày kể từ ngày bắt đầu mà chưa đạt 68/68 (hoặc khi đã chọn người đào tạo tiếp).
19. **Bài kiểm tra lý thuyết**: chờ bổ sung.

## Yêu cầu hỗ trợ
20. **Thông báo**: trong web (chuông). Yêu cầu mới / nhân viên nhắn → mọi quản lý; quản lý trả lời → người gửi.
21. **Trạng thái**: Đang mở / Đã xong; nhắn vào yêu cầu đã xong thì tự mở lại.

## Ma trận quyền
22. Chưa có vai trò **Kế toán** (mục 8.11). Các quyền mới đều chỉnh được ở tab Phân quyền, trừ các quyền "luôn có" ghi rõ trong bảng.
