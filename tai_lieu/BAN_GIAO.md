# Bàn giao trạng thái cho phiên AI mới

Cập nhật: 18/11/2026, sau bước 134. Phiên mới **không cần đọc lịch sử hội thoại cũ**. Đọc theo thứ tự:
1. `CLAUDE.md` (Codex đọc thêm `AGENTS.md`): quy tắc chung, bí mật, cách chạy máy chủ, ghi phát hành.
2. `tai_lieu/TINH_NANG_DA_CHOT.md`: mọi quyết định nghiệp vụ. Mục mới nhất ở cuối từng phần.
3. Tệp này: tình trạng hiện tại và việc còn mở.
4. `git log -10 --oneline` và trang LOG › Tệp máy chủ đã chạy (`select file from app_migrations`).

## Tình trạng lúc bàn giao
- Web: **2026.11.18.3** (`docs/version.json`, `ASSET_VERSION` trong `docs/js/app.js`, `?v=` trong `index.html` và các dòng import có `?v=`).
- Máy chủ: đã chạy tới tệp **118** (`118_tuan_da_chot.sql`).
- Hai phiên AI (Claude và Codex/ChatGPT) từng làm song song trên cùng kho mã. **Từ nay chỉ một phiên làm tại một thời điểm.**

## Việc còn mở
| Việc | Ghi chú |
|---|---|
| Lưu số dư cuối tháng đã chốt (Sổ quỹ / Chốt tháng) | Làm **sau khi chốt tháng 11**. Hiện `app__fund_rows` vẫn dựng sổ từ ngày bắt đầu quỹ (01/11), nên chậm dần theo số ngày. Tháng đã chốt bị khoá, có thể lưu số dư cuối tháng; khi Chủ mở lại tháng thì xoá số đã lưu. |
| Bài thử `flow_ds110` lỗi thời | Không còn nút `#add-rut2` (Khách CK rút tiền mặt) ở bước Tiền. Lỗi có từ trước bước 134. Cần viết lại theo giao diện hiện tại. |
| Trang còn hơn 0,5 giây phía máy chủ | Chốt tháng ~1,5s, Dữ liệu & sao lưu ~1,2s (tải 2,9 MB, ít dùng), Sổ quỹ ~0,8s. Còn lại < 0,4s. |
| Mở web lần đầu | Giữ cách cũ (số trên menu lấy xong mới vẽ trang), vì Thông báo / Tổng quan / Việc hôm nay đọc `state.unread`, `state.warn` lúc vẽ. Muốn vẽ song song thì phải sửa 3 trang đó trước. |

## Tốc độ: công cụ và bài học (bước 125–134)
- **Đo hàm máy chủ:** trong 1 giao dịch: `set track_functions = 'all'`, đăng nhập vai Chủ (`set_config('request.jwt.claims', …)`), gọi hàm, đọc `pg_stat_xact_user_functions` (số lần gọi, thời gian), rồi `RAISE EXCEPTION 'REPORT>> …'` để tự hoàn tác.
- **So kết quả cũ / mới trên máy chủ thật:** dùng `begin isolation level repeatable read`, vì nhân viên đang ghi dữ liệu làm lệch giả. Mẫu: `kiem_tra/toc_do/t01_so_quy_giong_het.sql`, `t02_thu_chi_lech_tien.sql`.
- **Lỗi hay gặp:** hàm SQL / truy vấn con / CTE có biểu thức gọi hàm đắt (`app__ca_eff`, `app__ca_money`, `app__kt_bank_json`, `app__fin_full`) bị máy chủ **chép ra mọi chỗ dùng**, nên mỗi ca bị tính 6–12 lần. Chặn bằng `offset 0`, `with … as materialized`, hoặc plpgsql gán biến 1 lần. Không gọi hàm đọc bảng trong WHERE / ORDER BY cho từng dòng.
- **Giới hạn 1.000 dòng mỗi lần hỏi** (PostgREST `max_rows`). Không tải cả bảng lớn từ web. Cần tổng hợp thì viết hàm `app_*`.
- **Phía trình duyệt:** mỗi lần hỏi máy chủ mất ~0,3s đi về. Câu nào không phụ thuộc nhau thì hỏi cùng lúc (`Promise.all`). Bài đo: `script=flow_tocdo&role=chu&tre=300` (xem `kiem_tra/trinh_duyet/README.md`).
- **`app_releases.version` là chữ:** `max(version)` cho `2026.11.17.9` lớn hơn `.12`. Sắp xếp bằng `split_part(version, '.', 4)::int`.

## Gợi ý chia việc cho các phiên mới
Mỗi phiên một nhóm việc, chỉ đọc tài liệu trên:
- Chốt ca và đối soát (`phieu_ca.js`, `chot_ca_moi.js`, `doi_soat*.js`, tệp máy chủ `app_ca_*`)
- Công việc và đào tạo (`cv_*.js`, `pc_*`, `dao_tao*`)
- Hàng hoá (`giao_hang.js`, `nhap_hang.js`, `ke_toan_hoa_don.js`)
- Kiểm tra và triển khai (bài thử `kiem_tra/`, phát hành, tốc độ)
