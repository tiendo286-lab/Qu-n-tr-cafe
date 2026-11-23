# Đồng bộ C02 chi tiết từng ca

Bản 0.3.0 (23/11/2026) sửa theo giao diện Fabi mới (từ khoảng 18/11 tiện ích dừng ở lỗi "Fabi đổi bộ lọc ngày", nên 18–22/11 không có tệp ca):
- Trang báo cáo chuyển sang đường dẫn `/micro/report/revenue/revenue/shift` (vẫn nhận đường dẫn cũ). Ô ngày nay là ô nhập chữ ("23/11/2026 - 23/11/2026"); mở ra là lịch 2 tháng có nút "Hôm qua".
- Ngày hôm qua: vẫn bấm nút "Hôm qua". Ngày khác: bấm ngày trên lịch (bấm 2 lần cho ngày đầu và ngày cuối, tự lùi tháng nếu cần, có nút Áp dụng thì bấm). Trước khi đọc bảng luôn kiểm dòng "Báo cáo được tính từ <ngày> 00:00 - <ngày> 23:59" và mọi dòng trong bảng đúng ngày đó.
- Phân trang kiểu mới: bấm nút số trang, đọc dòng "Hiển thị a - b trên tổng số N". Số ca đọc được phải đúng bằng N, thiếu là dừng, chưa nhập gì (bản cũ có thể bỏ sót trang 2 mà không báo).
- Cửa sổ tiện ích có ô **Ngày cần lấy** (31 ngày gần nhất, mỗi ngày ghi đã đồng bộ bao nhiêu ca) để lấy bù: chọn ngày → 1. Kiểm tra tải → 2. Đồng bộ, mỗi lần một ngày. Lịch tự động và trang web (Kế toán › File ca Fabi) vẫn chỉ làm hôm qua; web không chọn được ngày và không nhập được bản kiểm tra của ngày lấy bù.
- Cửa sổ tiện ích ghi số bản Chrome đang chạy. Chrome chỉ đổi phần chạy nền khi nạp lại tiện ích, còn cửa sổ tiện ích đọc tệp mới mỗi lần mở (23/11 anh Tiến bấm Kiểm tra tải nhưng phần chạy nền vẫn là 0.2.0 nên báo lại lỗi cũ). Tệp trên máy khác bản đang chạy thì hiện khung đỏ + nút **Nạp bản mới ngay** (`chrome.runtime.reload()`), khỏi tìm nút ↻ (bị ẩn khi tắt chế độ nhà phát triển). Nạp bản mới thì lượt cũ đang báo lỗi đổi thành "đã dừng" kèm câu nhắc chạy lại.
- **Bản 0.3.2 — nút "3. Kiểm tra & bù ca thiếu cả tháng"** (anh Tiến chọn 23/11): xét từ ngày 1 của tháng chứa hôm qua tới hôm qua; từng ngày đọc đủ danh sách, từng ca tải lại file từ Fabi và so với file đang lưu trên web (cơ sở, ngày, tiền đầu ca, doanh thu, tổng, tiền mặt, chuyển khoản, nợ, chênh lệch, giờ mở/đóng, trả nợ, hoá đơn sửa — chưa so món vì danh sách máy chủ chưa trả món). Ca **chưa có file** → tự nhập; ca **khác Fabi** → giữ file tạm, liệt kê kèm phần khác, anh tích rồi bấm **Nhập đè** (có thể mở lại ca đã đối soát, báo quản lý); ca khớp → không ghi gì. Một ngày/ca lỗi 3 lần thì ghi lại và làm tiếp; lỗi liền 3 chỗ thì dừng hẳn. Ngày khớp hết thì ghi "đã đồng bộ". Không đổi mốc lịch hằng ngày. Khoảng 1–2 phút mỗi ngày.
- **Bản 0.3.4 — nút 3 hỏi web trước** (anh Tiến: "kiểm tra trên web ca nào lỗi mới tải lại"; chọn 2 loại lỗi): lệnh `suspects` đọc `app_fabi_list` cả tháng → ngày có **phiếu ca chưa có file Fabi** (`missing`) hoặc **file thiếu số** (trống tiền đầu ca / doanh thu / tổng / giờ đóng; 0.3.6 bỏ qua file chỉ trống tiền mặt / chuyển khoản — 28 file 01–13/11, anh chọn để sau). Chỉ những ngày đó mới mở Fabi; đọc đủ danh sách ngày (vẫn kiểm tổng số ca) rồi chỉ tải ca chưa có trên web (so 5 ký tự cuối mã ca) + ca có file thiếu số. Phiếu chưa có file mà Fabi không có ca nào thiếu → ghi lại để xem phiếu ca. Web không có lỗi → xong ngay. Không xét file lệch phiếu nhân viên / chưa ghép phiếu (anh không chọn).
- **Bản 0.3.7 — sáng nào cũng tự lấy bù** (anh Tiến chọn 23/11 "Sáng: hôm qua + tự bù ca lỗi cả tháng"): bật ô Tự chạy thì từ 08:15 đồng bộ hôm qua như cũ; lượt lịch kế tiếp (15 phút sau) tự chạy nút 3 một lần mỗi ngày (`lastAutoAudit`): hỏi web, chỉ tải ca lỗi, ca thiếu tự nhập, ca khác Fabi liệt kê chờ anh xem (danh sách tạo lại mỗi sáng vì file trên web vẫn thiếu số). Ô Tự chạy bật được khi đã từng đồng bộ thành công (`lastSuccess`), không bắt lần cuối phải là nút 2. Chạy thật 23/11 (0.3.6): web báo 48 phiếu chưa có file + 4 file thiếu doanh thu ở 7 ngày → tự nhập đủ 48 ca, 4 ca khác Fabi chờ anh xem, 0 lỗi.
- Câu báo lỗi kèm gợi ý cấu trúc trang (tên thẻ/lớp, số lưới lịch, dòng ngày đang hiện) để sửa nhanh nếu Fabi lại đổi; không kèm dữ liệu ca.
- Việc tiếp theo anh Tiến đã chọn ("Sáng nào cũng tự lấy bù"): mỗi sáng lấy hôm qua rồi tự lấy các ngày còn thiếu trong 7 ngày gần nhất — làm sau khi bản này chạy ổn trên Fabi thật.
- Chrome nạp tiện ích từ thư mục `cong_cu/fabi_c02_chrome` của thư mục làm việc chính ("Milano App", mã tiện ích `jeipbpnccocfgojbjdfabkbdeiknfeba` sinh từ đường dẫn này). Đổi nhánh ở thư mục đó rồi bấm nạp lại là đổi bản tiện ích đang chạy.

Bản 0.2.0 thêm điều khiển tại Kế toán › File ca Fabi trên cùng Chrome đã cài tiện ích. Chỉ nhận đúng trang/route Milano và tài khoản có quyền Kế toán. Không nhận ngày, URL hay file từ trang gửi; chỉ trả trạng thái, tiến độ và lịch, không gồm token/file/số tiền. iPhone vẫn xem số liệu và nhập Excel thủ công, chưa điều khiển máy khác từ xa. Bộ thử hiện đạt 118 kiểm tra dữ liệu giả, gồm kiểm tra quyền, route và DTO.

Bản 0.1.1 đã được nạp trên Chrome máy làm việc, dùng cùng phạm vi quyền của bản 0.1.0. Đã xác nhận kết quả 12/12 ca và lịch 08:15 vẫn được giữ sau cập nhật. Cài mới mặc định tắt lịch. Trên máy này, anh Tiến đã cho tiếp tục nhập thật và bật lịch sau khi kiểm tra thành công.

Đã kiểm tra trên Chrome thật ngày 15/11/2026: đọc hai trang danh sách C02, lấy và kiểm tra thành công đủ 12/12 ca ngày 14/11/2026, gồm cả bốn cơ sở. Sau khi anh Tiến cho tiếp tục, đã nhập thật bộ file đó, đọc lại và đối chiếu số tiền/ngày giờ của từng ca; tiện ích xác nhận "Đã đồng bộ đủ 12/12 ca ngày 2026-11-14". Đã bật ô tự chạy từ 08:15. Đã quan sát lịch và kết quả được giữ sau khi đóng/mở cửa sổ tiện ích và nạp lại tiện ích. Chưa quan sát lần tự chạy theo lịch, máy ngủ/thức hay khởi động lại toàn bộ Chrome.

Bộ thử dữ liệu giả đạt 92 kiểm tra, bổ sung: trước 08:15 không chạy; thức muộn chạy bù; cùng ngày đã xong không nhập lại khi mở Chrome; hai lệnh đồng thời chỉ khởi tạo một lượt; Dừng khi chờ hoặc đang mở tab không bắt đầu nhập ca kế tiếp; mất bộ file sau khi nhập một phần thì báo lỗi, tải lại bỏ qua ca đã xác minh. Các tình huống này được thử bằng mô phỏng, không thay thế kiểm tra trên máy thật. Bản 0.1.1 sửa cách xử lý Dừng và khóa các lệnh khởi tạo đồng thời.

Tiện ích Chrome dùng phiên Fabi và phiên Milano trong cùng hồ sơ Chrome. Không lưu mật khẩu, cookie, khóa quản trị Supabase hay token đăng nhập. Không cần D05, Gmail hay thay đổi máy chủ. Máy và Chrome cần chạy, có mạng; lịch Chrome không đánh thức máy ngủ. Fabi cần tab đang hoạt động để tải dữ liệu, nên tiện ích chuyển qua lại giữa tab Fabi và Milano khi chạy.

## Cài và kiểm tra

1. Chrome → Quản lý tiện ích → Chế độ dành cho nhà phát triển → Tải tiện ích đã giải nén → chọn thư mục này.
2. Mở Fabi và Milano, đăng nhập tài khoản có quyền xuất C02 và quyền Kế toán. Chọn phạm vi đủ 4/4 cơ sở trên Fabi.
3. Bấm tiện ích → chọn **Ngày cần lấy** (mặc định hôm qua) → **Kiểm tra tải — chưa nhập**. Cần kiểm tra thành công tất cả trang và tất cả ca của ngày đó. Bộ file được giữ tạm trong phiên Chrome, không ghi dữ liệu Milano. Fabi cũng yêu cầu tải file xuống như khi bấm thủ công; Chrome có thể hỏi quyền tải nhiều file. Việc Chrome lưu bản sao ra Downloads không phải điều kiện xác nhận tiện ích đã đọc được bộ file.
4. Khi bản thử thành công, bấm **Đồng bộ lên Milano**. Tiện ích dùng lại bộ file vừa kiểm tra nếu còn trong phiên. Trước khi ghi, phải kiểm tra đủ mọi ca và đủ cả 4 cơ sở. Hàm nhập hiện có sẽ cập nhật số đối soát theo Fabi và có thể mở lại ca/báo quản lý theo nghiệp vụ hiện hành.
5. Đọc kết quả từng ca và kiểm tra trên tab File ca Fabi. Chỉ sau một lượt đồng bộ thật thành công mới bật được **Tự chạy hằng ngày từ 08:15** (giờ Việt Nam).

Lịch kiểm tra mỗi 15 phút. Nếu máy thức sau 08:15 thì chạy bù hôm qua trong ngày; chưa tự lấp các ngày máy tắt hẳn (lấy bù bằng ô Ngày cần lấy). Lỗi được thử lại tối đa 3 lần, đánh dấu ! và giữ vị trí xử lý. Đăng nhập lại rồi chạy Kiểm tra tải để bắt đầu lượt mới. Nếu Chrome khởi động lại làm mất bộ file tạm, phải kiểm tra tải lại. Tắt lịch bằng ô trong tiện ích, hoặc bấm **Dừng sau ca hiện tại và tắt lịch**.

## Kiểm tra bắt buộc trước khi gọi là đã hoàn tất

- Chạy trọn ngày có nhiều trang, đủ LHP/ĐK/HS/LL; ca đã đóng và giờ mở thuộc đúng ngày hôm qua.
- Thử một ca xuất thật: xác nhận bắt được Blob XLSX từ nút xuất hiện tại của Fabi. Nếu Fabi đổi cơ chế tải, tiện ích dừng với lỗi; không coi bấm nút là đã có tệp.
- Kiểm tra import mô-đun ứng dụng trong ngữ cảnh trang Milano trên phiên Chrome thực tế (có thể bị chính sách trang/trình duyệt chặn).
- Đối chiếu mã ca, ngày, giờ mở/đóng, cơ sở, tổng phương thức = NET, các tờ tiền và số đọc lại từ máy chủ.
- Chạy lại, thử thiếu quyền/hết phiên/đóng tab, lỗi mạng, Chrome khởi động lại giữa lượt, lịch lúc Mac ngủ/thức, thử ca không phát sinh món (hiện dừng để xem lại).
- Dữ liệu thật chỉ được lưu trong tài khoản web hoặc Downloads; không chép báo cáo/tên nhân viên vào kho mã hay bộ thử.

## Giới hạn bản đầu

Lịch tự động chỉ lấy ngày hôm qua; ngày khác chọn tay ở cửa sổ tiện ích (tối đa 31 ngày trước hôm nay, không lấy hôm nay). Ca thiếu món/tờ tiền hoặc giao diện Fabi đổi sẽ dừng để kiểm tra, không tự gán giá trị 0. Phần trả nợ/hóa đơn sửa không bắt buộc tồn tại nếu ca không phát sinh. Yêu cầu đủ 4/4 phạm vi và kết quả phải có đúng tên cả 4 cơ sở; không yêu cầu cố định 3 ca/cơ sở.

Chống nhập lặp dựa trên dữ liệu ca đã đọc, nên metadata XLSX đổi không làm nhập lại. Chỉ bỏ qua ca đã xác minh trước đó nếu số tiền, ngày/giờ, trả nợ và hóa đơn sửa đang lưu vẫn khớp. RPC danh sách chưa trả toàn bộ món/nhóm món, nên phần xác minh đọc lại có giới hạn. Nếu máy chủ nhận dữ liệu nhưng phản hồi bị mất trước khi lưu dấu xác minh, lần thử lại vẫn có thể gọi nhập cùng mã ca; máy chủ cập nhật theo mã ca, nhưng có thể lặp nhật ký/thông báo. Chưa bảo đảm mỗi ca chỉ gọi nhập đúng một lần khi mất mạng giữa thao tác.

Không tự xóa file tải xuống hay đóng tab của người dùng. Tiện ích chạy trên Chrome máy tính; iPhone dùng web Milano để xem kết quả, không chạy tiện ích này.

Kỹ thuật: Manifest V3, quyền `alarms`, `storage`, `scripting`, chỉ trên Fabi và đường dẫn Milano. Không cấp quyền Gmail/toàn bộ website. Lịch mặc định tắt. Trạng thái có thể lưu mã ca/thiết bị và giờ ca trên máy, không lưu dữ liệu khách hay số tiền.

Bộ thử trang Fabi giả (0.3.0): `<python có playwright> cong_cu/fabi_c02_chrome/thu_dom/thu_dom.py` — mở `thu_dom/fabi_gia.html` (dựng theo ảnh chụp Fabi mới, 4 kiểu lịch vì chưa biết chắc cấu trúc thật) trên Chrome thật, chạy đúng `fabi_page.js`: nút Hôm qua, bấm ngày lấy bù, lùi tháng, nút Áp dụng, 2 trang, ngày rỗng, mở chi tiết (SPA và tải lại trang), xuất file, dòng trống ẩn trong bảng, lịch không có nhãn tháng. Đạt 125 kiểm tra (5 kiểu lịch, thêm kiểu chỉ gõ được ngày); bản 0.2.0 hỏng ngay bước đầu với đúng lỗi "Fabi đổi bộ lọc ngày".

Bộ thử cục bộ: `node cong_cu/fabi_c02_chrome/test.mjs` (Node 20+; nay chạy được cả khi đường dẫn có dấu cách). Đạt 219 kiểm tra (không có `node` trên máy: chạy bằng `ELECTRON_RUN_AS_NODE=1 "/Applications/Visual Studio Code.app/Contents/MacOS/Code" test.mjs`). Dùng dữ liệu giả, gồm mô phỏng hai trang/12 ca, đủ bốn cơ sở trước khi ghi, không ghi ở chế độ kiểm tra, dừng/lỗi, chuyển trang làm mất kết quả hàm, cùng dữ liệu xuất lại, số lưu bị thay đổi và ô số gốc bị trống/sai. Không thay thế phép thử Chrome và máy chủ thật.
