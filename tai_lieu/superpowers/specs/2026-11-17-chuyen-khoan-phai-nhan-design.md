# Thiết kế thống nhất chuyển khoản phải nhận

## Mục tiêu

Mọi chỗ trong Phiếu chốt ca và Đối soát dùng cùng một số “Phải nhận chuyển khoản”, để quản lý không thể bị hướng dẫn chọn KHỚP, THIẾU hoặc THỪA theo một công thức thiếu thành phần.

## Công thức duy nhất

`Phải nhận = Chuyển khoản Fabi + Thu/Chi chuyển khoản + Khách trả nợ chuyển khoản - Nợ chuyển khoản mới`.

Máy chủ là nguồn kết quả chính. `app__ca_money` trả thêm `ck_expected`; giao diện chỉ trình bày giá trị đó khi xem phiếu đã hoàn thành. Khi đang sửa phiếu, giao diện có thể tính tạm bằng đúng công thức trên để phản hồi tức thời.

## Phạm vi

- Sửa thẻ tổng ngân hàng và gợi ý kết quả đối soát chuyển khoản.
- Máy chủ kiểm tra kết quả quản lý gửi khớp với số tính được; không chấp nhận KHỚP/THIẾU/THỪA hoặc số tiền trái với số thực tế.
- Thêm migration mới, không sửa migration đã chạy.
- Thêm bài thử cho: chỉ Fabi, thu/chi CK, thu nợ CK, nợ CK mới và tổ hợp tất cả.
- Kiểm tra giao diện máy tính và điện thoại 390px.

## Ngoài phạm vi

- Không sửa các lỗi audit khác.
- Không thay đổi dữ liệu thật và chưa triển khai production trong lượt sửa cục bộ này.
- Không đổi bố cục hay thuật ngữ của Phiếu chốt ca.

## Cách đã cân nhắc

1. Chỉ sửa JavaScript: nhanh nhưng tiếp tục có nhiều bản sao công thức và không ngăn API nhận kết quả sai.
2. Máy chủ làm nguồn duy nhất, frontend chỉ hiển thị: được chọn vì số liệu tiền cần kiểm soát cả giao diện lẫn API.

