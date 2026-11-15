# Đồng bộ C02 chi tiết từng ca

Bản 0.2.0 thêm điều khiển tại Kế toán › File ca Fabi trên cùng Chrome đã cài tiện ích. Chỉ nhận đúng trang/route Milano và tài khoản có quyền Kế toán. Không nhận ngày, URL hay file từ trang gửi; chỉ trả trạng thái, tiến độ và lịch, không gồm token/file/số tiền. iPhone vẫn xem số liệu và nhập Excel thủ công, chưa điều khiển máy khác từ xa. Bộ thử hiện đạt 118 kiểm tra dữ liệu giả, gồm kiểm tra quyền, route và DTO.

Bản 0.1.1 đã được nạp trên Chrome máy làm việc, dùng cùng phạm vi quyền của bản 0.1.0. Đã xác nhận kết quả 12/12 ca và lịch 08:15 vẫn được giữ sau cập nhật. Cài mới mặc định tắt lịch. Trên máy này, anh Tiến đã cho tiếp tục nhập thật và bật lịch sau khi kiểm tra thành công.

Đã kiểm tra trên Chrome thật ngày 15/11/2026: đọc hai trang danh sách C02, lấy và kiểm tra thành công đủ 12/12 ca ngày 14/11/2026, gồm cả bốn cơ sở. Sau khi anh Tiến cho tiếp tục, đã nhập thật bộ file đó, đọc lại và đối chiếu số tiền/ngày giờ của từng ca; tiện ích xác nhận "Đã đồng bộ đủ 12/12 ca ngày 2026-11-14". Đã bật ô tự chạy từ 08:15. Đã quan sát lịch và kết quả được giữ sau khi đóng/mở cửa sổ tiện ích và nạp lại tiện ích. Chưa quan sát lần tự chạy theo lịch, máy ngủ/thức hay khởi động lại toàn bộ Chrome.

Bộ thử dữ liệu giả đạt 92 kiểm tra, bổ sung: trước 08:15 không chạy; thức muộn chạy bù; cùng ngày đã xong không nhập lại khi mở Chrome; hai lệnh đồng thời chỉ khởi tạo một lượt; Dừng khi chờ hoặc đang mở tab không bắt đầu nhập ca kế tiếp; mất bộ file sau khi nhập một phần thì báo lỗi, tải lại bỏ qua ca đã xác minh. Các tình huống này được thử bằng mô phỏng, không thay thế kiểm tra trên máy thật. Bản 0.1.1 sửa cách xử lý Dừng và khóa các lệnh khởi tạo đồng thời.

Tiện ích Chrome dùng phiên Fabi và phiên Milano trong cùng hồ sơ Chrome. Không lưu mật khẩu, cookie, khóa quản trị Supabase hay token đăng nhập. Không cần D05, Gmail hay thay đổi máy chủ. Máy và Chrome cần chạy, có mạng; lịch Chrome không đánh thức máy ngủ. Fabi cần tab đang hoạt động để tải dữ liệu, nên tiện ích chuyển qua lại giữa tab Fabi và Milano khi chạy.

## Cài và kiểm tra

1. Chrome → Quản lý tiện ích → Chế độ dành cho nhà phát triển → Tải tiện ích đã giải nén → chọn thư mục này.
2. Mở Fabi và Milano, đăng nhập tài khoản có quyền xuất C02 và quyền Kế toán. Chọn phạm vi đủ 4/4 cơ sở trên Fabi.
3. Bấm tiện ích → **Kiểm tra tải — chưa nhập**. Cần kiểm tra thành công tất cả trang và tất cả ca hôm qua. Bộ file được giữ tạm trong phiên Chrome, không ghi dữ liệu Milano. Fabi cũng yêu cầu tải file xuống như khi bấm thủ công; Chrome có thể hỏi quyền tải nhiều file. Việc Chrome lưu bản sao ra Downloads không phải điều kiện xác nhận tiện ích đã đọc được bộ file.
4. Khi bản thử thành công, bấm **Đồng bộ lên Milano**. Tiện ích dùng lại bộ file vừa kiểm tra nếu còn trong phiên. Trước khi ghi, phải kiểm tra đủ mọi ca và đủ cả 4 cơ sở. Hàm nhập hiện có sẽ cập nhật số đối soát theo Fabi và có thể mở lại ca/báo quản lý theo nghiệp vụ hiện hành.
5. Đọc kết quả từng ca và kiểm tra trên tab File ca Fabi. Chỉ sau một lượt đồng bộ thật thành công mới bật được **Tự chạy hằng ngày từ 08:15** (giờ Việt Nam).

Lịch kiểm tra mỗi 15 phút. Nếu máy thức sau 08:15 thì chạy bù hôm qua trong ngày; không tự lấp các ngày máy tắt hẳn. Lỗi được thử lại tối đa 3 lần, đánh dấu ! và giữ vị trí xử lý. Đăng nhập lại rồi chạy Kiểm tra tải để bắt đầu lượt mới. Nếu Chrome khởi động lại làm mất bộ file tạm, phải kiểm tra tải lại. Tắt lịch bằng ô trong tiện ích, hoặc bấm **Dừng sau ca hiện tại và tắt lịch**.

## Kiểm tra bắt buộc trước khi gọi là đã hoàn tất

- Chạy trọn ngày có nhiều trang, đủ LHP/ĐK/HS/LL; ca đã đóng và giờ mở thuộc đúng ngày hôm qua.
- Thử một ca xuất thật: xác nhận bắt được Blob XLSX từ nút xuất hiện tại của Fabi. Nếu Fabi đổi cơ chế tải, tiện ích dừng với lỗi; không coi bấm nút là đã có tệp.
- Kiểm tra import mô-đun ứng dụng trong ngữ cảnh trang Milano trên phiên Chrome thực tế (có thể bị chính sách trang/trình duyệt chặn).
- Đối chiếu mã ca, ngày, giờ mở/đóng, cơ sở, tổng phương thức = NET, các tờ tiền và số đọc lại từ máy chủ.
- Chạy lại, thử thiếu quyền/hết phiên/đóng tab, lỗi mạng, Chrome khởi động lại giữa lượt, lịch lúc Mac ngủ/thức, thử ca không phát sinh món (hiện dừng để xem lại).
- Dữ liệu thật chỉ được lưu trong tài khoản web hoặc Downloads; không chép báo cáo/tên nhân viên vào kho mã hay bộ thử.

## Giới hạn bản đầu

Chỉ tự lấy ngày hôm qua. Ca thiếu món/tờ tiền hoặc giao diện Fabi đổi sẽ dừng để kiểm tra, không tự gán giá trị 0. Phần trả nợ/hóa đơn sửa không bắt buộc tồn tại nếu ca không phát sinh. Yêu cầu đủ 4/4 phạm vi và kết quả phải có đúng tên cả 4 cơ sở; không yêu cầu cố định 3 ca/cơ sở.

Chống nhập lặp dựa trên dữ liệu ca đã đọc, nên metadata XLSX đổi không làm nhập lại. Chỉ bỏ qua ca đã xác minh trước đó nếu số tiền, ngày/giờ, trả nợ và hóa đơn sửa đang lưu vẫn khớp. RPC danh sách chưa trả toàn bộ món/nhóm món, nên phần xác minh đọc lại có giới hạn. Nếu máy chủ nhận dữ liệu nhưng phản hồi bị mất trước khi lưu dấu xác minh, lần thử lại vẫn có thể gọi nhập cùng mã ca; máy chủ cập nhật theo mã ca, nhưng có thể lặp nhật ký/thông báo. Chưa bảo đảm mỗi ca chỉ gọi nhập đúng một lần khi mất mạng giữa thao tác.

Không tự xóa file tải xuống hay đóng tab của người dùng. Tiện ích chạy trên Chrome máy tính; iPhone dùng web Milano để xem kết quả, không chạy tiện ích này.

Kỹ thuật: Manifest V3, quyền `alarms`, `storage`, `scripting`, chỉ trên Fabi và đường dẫn Milano. Không cấp quyền Gmail/toàn bộ website. Lịch mặc định tắt. Trạng thái có thể lưu mã ca/thiết bị và giờ ca trên máy, không lưu dữ liệu khách hay số tiền.

Bộ thử cục bộ: `node cong_cu/fabi_c02_chrome/test.mjs` (Node 20+). Dùng dữ liệu giả, gồm mô phỏng hai trang/12 ca, đủ bốn cơ sở trước khi ghi, không ghi ở chế độ kiểm tra, dừng/lỗi, chuyển trang làm mất kết quả hàm, cùng dữ liệu xuất lại, số lưu bị thay đổi và ô số gốc bị trống/sai. Không thay thế phép thử Chrome và máy chủ thật.
