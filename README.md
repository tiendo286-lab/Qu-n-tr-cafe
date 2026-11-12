# Quản trị cafe – Milano Coffee & Lela Cafe

Web quản trị vận hành, nhân sự, lịch làm và tài chính nội bộ cho chuỗi Milano Coffee & Lela Cafe.

- **Nhân viên** (điện thoại): đăng nhập bằng mã NV, order ca, xem lịch làm, nhận thông báo.
- **Quản lý**: xếp lịch, chốt và đối soát ca, thu chi, sổ quỹ, giao việc, đào tạo, đánh giá và quản lý nhân viên.
- **Kế toán**: hóa đơn giao hàng, file ca Fabi và chuyển khoản thực nhận.

## Kiến trúc hiện tại

- `docs/`: web tĩnh JavaScript ES modules, triển khai bằng GitHub Pages.
- `supabase/`: cơ sở dữ liệu PostgreSQL, RLS, hàm nghiệp vụ và Edge Function quản trị tài khoản.
- `kiem_tra/trinh_duyet/`: Supabase giả lập và các luồng kiểm tra Chrome, không đụng dữ liệu thật.
- `app/`: bản FastAPI/SQLite cũ, chỉ giữ để tham khảo và kiểm tra tương thích.
- `tai_lieu/`: đặc tả, quyết định đã chốt và hướng dẫn Supabase.

Web đang chạy tại: https://tiendo286-lab.github.io/Qu-n-tr-cafe/

Quy tắc phát triển nằm trong [CLAUDE.md](CLAUDE.md). Tính năng đã chốt nằm trong [tai_lieu/TINH_NANG_DA_CHOT.md](tai_lieu/TINH_NANG_DA_CHOT.md).

## Kiểm tra giao diện

Các bài Chrome dùng bản sao `docs/` và Supabase giả lập trong bộ nhớ. Cách dựng và danh sách luồng nằm trong [kiem_tra/trinh_duyet/README.md](kiem_tra/trinh_duyet/README.md). Sau khi đổi giao diện, cần kiểm tra cả khung điện thoại 390px.

Dữ liệu thật trong `du_lieu/`, mã quản trị Supabase và các khóa bí mật không được đưa lên GitHub.
