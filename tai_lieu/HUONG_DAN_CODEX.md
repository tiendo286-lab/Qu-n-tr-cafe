# Dùng Codex để code Milano App

## Bắt đầu

1. Mở đúng thư mục `/Users/dotien/Milano App` trong ứng dụng hoặc IDE đang dùng Codex.
2. Tạo cuộc trò chuyện mới để Codex nạp `AGENTS.md` của dự án.
3. Giao việc bằng tiếng Việt, mô tả trang nào, thao tác nào và kết quả mong muốn. Codex sẽ đọc thêm `CLAUDE.md` và tài liệu nghiệp vụ theo hướng dẫn dự án.

Ví dụ:

> Sửa trang Thu chi: khi chọn cơ sở LHP thì chỉ hiện khoản của LHP. Hãy đọc quy tắc dự án, tìm nguyên nhân, sửa và kiểm tra trên máy tính lẫn điện thoại. Làm cục bộ trước.

> Kiểm tra thay đổi hiện tại trước khi đưa lên web. Tìm lỗi quyền truy cập, tính tiền và hiển thị trên điện thoại. Báo lỗi kèm vị trí trong mã.

> Tiếp tục phần Đối soát theo tài liệu đã chốt. Đọc mã hiện tại trước, chỉ hỏi tôi nếu còn quyết định nghiệp vụ chưa rõ.

## Khi làm cùng Claude Code

- Dùng lần lượt từng công cụ trên kho mã; kết thúc phiên đang sửa trước khi chuyển công cụ.
- Quy tắc nghiệp vụ chung ở `CLAUDE.md`; cách Codex đọc và thực hiện nằm trong `AGENTS.md`.
- Khi chuyển công cụ, yêu cầu đọc trạng thái Git và phần thay đổi chưa commit trước khi sửa tiếp.

## Phạm vi thiết lập

Codex đã có trên máy. Thiết lập này bổ sung hướng dẫn cho riêng Milano App, không thay đổi model, tài khoản, quyền hệ thống hoặc cấu hình Codex của các dự án khác. Công cụ kết nối riêng của Claude không tự chuyển sang Codex.

Không cần khóa API mới chỉ để dùng các hướng dẫn dự án này. Nếu một công việc cụ thể cần kết nối máy chủ, Codex sẽ kiểm tra công cụ và quyền truy cập thực tế trước khi thực hiện.

Tài liệu chính thức về hướng dẫn dự án: https://learn.chatgpt.com/docs/agent-configuration/agents-md
