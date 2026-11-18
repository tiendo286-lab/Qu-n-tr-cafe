# Bàn giao trạng thái cho phiên AI mới

Cập nhật: 18/11/2026, sau bước 142 (Việc hôm nay chia nhóm Vận hành / Nhân sự / Khác). Phiên mới **không cần đọc lịch sử hội thoại cũ**. Đọc theo thứ tự:
1. `CLAUDE.md` (Codex đọc thêm `AGENTS.md`): quy tắc chung, bí mật, cách chạy máy chủ, ghi phát hành.
2. `tai_lieu/TINH_NANG_DA_CHOT.md`: mọi quyết định nghiệp vụ. Mục mới nhất ở cuối từng phần.
3. Tệp này: tình trạng hiện tại và việc còn mở.
4. `git log -10 --oneline` và trang LOG › Tệp máy chủ đã chạy (`select file from app_migrations`).

## Tình trạng lúc bàn giao
- Web: **2026.11.18.11** (`docs/version.json`, `ASSET_VERSION` trong `docs/js/app.js`, `?v=` trong `index.html` và các dòng import có `?v=`).
- Máy chủ: đã chạy tới tệp **124** (`124_viec_hom_nay_nhom.sql`).
- Hai phiên AI (Claude và Codex/ChatGPT) từng làm song song trên cùng kho mã. **Từ nay chỉ một phiên làm tại một thời điểm.**

## Đào tạo (bước 137, đã lên web)

- Đã chia **Pha chế** và **Chạy bàn** trên giao diện. Mới có chương trình Chạy bàn 68 hạng mục.

- Mục **Công việc › Đào tạo** lấy các phiếu đã tạo trong trang Nhân viên, dùng một danh sách chung. Trên phiếu mỗi hạng mục hiện người hướng dẫn và cơ sở đào tạo, có thể sửa riêng từng hạng mục. Phiếu đang mở có trong Việc của tôi của người liên quan. Có thông báo phân công, nhắc hạn và nhận xét cuối. Có thể giao giai đoạn 2 cho hạng mục thực hành ở mức Trung bình hoặc Khá.
- Máy chủ đã chạy `120_cong_viec_dao_tao.sql` (thử tự hoàn tác trước bằng `kiem_tra/cong_viec_dao_tao_120_may_chu.sql`). **Chủ chưa chọn tài khoản nhận xét**: vào Công việc › Đào tạo để chọn; chưa chọn thì không ai bấm được Hoàn thành / Nhắc hạn.

## Việc hôm nay (bước 138, đợt 1 đã lên web)

- Phương án: `work/proposals/phuong-an-viec-hom-nay.md` (tệp cục bộ, không có trên GitHub). Đợt 1 đã làm mục 1, 2, 3, 5 (bản gọn), 6 và một phần 4, 7 — chi tiết ở `TINH_NANG_DA_CHOT.md` mục "Việc hôm nay — đợt 1".
- Trang `docs/js/pages/hom_nay.js` hỏi cùng lúc 6 nguồn (`app_today_me`, `app_home_todo`, `app_pc_mine`, `app_dt_work_list`, `app_ka_mine`, `app_cong_mine`); gom / xếp việc ở `docs/js/hom_nay_viec.js` (thử: `jsc -m kiem_tra/hom_nay_viec_138.mjs`). Bộ thử Chrome: `flow_hn138` (xem README).
- Đợt 2a (Nội quy & Cam kết, bỏ cửa sổ nhắc) đã xong — bước 141.
- **Chia nhóm Vận hành / Nhân sự / Khác đã xong — bước 142** (thiết kế `tai_lieu/superpowers/specs/2026-11-18-viec-hom-nay-chia-nhom-design.md`, kế hoạch `tai_lieu/superpowers/plans/2026-11-18-viec-hom-nay-chia-nhom.md`). Trang hỏi thêm `app_today_more` (máy chủ 124); Chủ hỏi thêm `app_pc_all` + `app_dt_work_list(false)`. Luật nhóm ở `hom_nay_viec.js` (`jobCat`, `todoCat`); chia khối / gộp / Mọi người ở `docs/js/hom_nay_nhom.js` (thử: `jsc -m kiem_tra/hom_nay_nhom_142.mjs`). Bộ thử Chrome: `flow_hn142`. Khoá mới ở `collectWork` mà chưa có trong bảng luật sẽ vào **Khác**.
- **Việc tiếp theo:** khoản âm / lệch tiền ca theo trạng thái, rồi máy chủ chặn phiếu ca không có tên.
- **Đợt 2 còn lại:** Theo dõi theo bộ phận / cơ sở có số quá hạn và việc chưa có người nhận; khoản âm nối trạng thái Lệch tiền ca + nút Mở ca từng dòng; máy chủ chặn nhân viên mở chi tiết / gửi phiếu ca không có tên mình (mục 8).
- Các bài thử chỉ dùng dữ liệu giả. Cách chạy nằm trong `kiem_tra/trinh_duyet/README.md`.

## Việc còn mở
| Việc | Ghi chú |
|---|---|
| Lưu số dư cuối tháng đã chốt (Sổ quỹ / Chốt tháng) | Làm **sau khi chốt tháng 11**. Hiện `app__fund_rows` vẫn dựng sổ từ ngày bắt đầu quỹ (01/11), nên chậm dần theo số ngày. Tháng đã chốt bị khoá, có thể lưu số dư cuối tháng; khi Chủ mở lại tháng thì xoá số đã lưu. |
| Bài thử `flow_ds110` lỗi thời | Không còn nút `#add-rut2` (Khách CK rút tiền mặt) ở bước Tiền. Lỗi có từ trước bước 134. Cần viết lại theo giao diện hiện tại. |
| Trang còn hơn 0,5 giây phía máy chủ | Chốt tháng ~1,5s, Dữ liệu & sao lưu ~1,2s (tải 2,9 MB, ít dùng), Sổ quỹ ~0,8s. Còn lại < 0,4s. |
| File ca Fabi: mảng `fixed` cộng dồn | `app__fabi_apply` ghi nối `fixed` mỗi lần tải file, nên ca từng được web sửa theo Fabi vẫn hiện "Cần quản lý xem" mãi (bước 136 chỉ hiện rõ lý do). Nếu anh muốn ca tự hết báo sau khi quản lý xem, cần thêm nút "Đã xem" hoặc xoá `fixed` khi số đã khớp. |
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
