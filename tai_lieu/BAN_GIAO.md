# Bàn giao trạng thái cho phiên AI mới

Cập nhật: 19/11/2026, sau bước 149 (Sổ thu chi mới — xong đủ 5 đợt, đang chạy song song). Phiên mới **không cần đọc lịch sử hội thoại cũ**. Đọc theo thứ tự:
1. `CLAUDE.md` (Codex đọc thêm `AGENTS.md`): quy tắc chung, bí mật, cách chạy máy chủ, ghi phát hành.
2. `tai_lieu/TINH_NANG_DA_CHOT.md`: mọi quyết định nghiệp vụ. Mục mới nhất ở cuối từng phần.
3. Tệp này: tình trạng hiện tại và việc còn mở.
4. `git log -10 --oneline` và trang LOG › Tệp máy chủ đã chạy (`select file from app_migrations`).

## Tình trạng lúc bàn giao
- Web: **2026.11.19.6** (`docs/version.json`, `ASSET_VERSION` trong `docs/js/app.js`, `?v=` trong `index.html` và các dòng import có `?v=`).
- Máy chủ: đã chạy tới tệp **133** (`133_so_thu_chi_doi_soat.sql` Đối soát tiền 3 bước — vùng khoá, anh Tiến mở bằng mật khẩu 19/11). Trước đó **132** (`132_so_thu_chi_gan_no.sql` gán nợ khách trả cho ca dư — vùng khoá, anh Tiến mở bằng mật khẩu 19/11). Trước đó **131** (`131_so_thu_chi_lech.sql` phiếu chênh lệch: `app_stc_gap_*`, bảng `stc_gap_requests`). Trước đó **130** (`129_so_thu_chi_sua.sql` sửa / thêm / xoá ngoài ca + người nợ ✓; `130_so_thu_chi_sua_ca.sql` sửa khoản của ca — vùng khoá, anh Tiến mở bằng mật khẩu 19/11). Trước đó **128** (`127_so_thu_chi_xem.sql` = `app_stc_month`, `128_so_thu_chi_quy_ngoai.sql` = `app_stc_ext`, chỉ đọc). Trước đó: tệp **126** (`125_viec_hom_nay_sua.sql` sửa `app_today_more`; `126_sua_pc_tick_bi_danh.sql` sửa gấp `app__pc_tick`: bí danh bảng "sc" trùng biến record → Công việc lỗi mỗi khi có việc con hàng hoá mới, hỏng 15:18–15:36 ngày 18/11). **Bài học:** trong plpgsql không đặt bí danh bảng trùng tên biến.
- **Vùng khoá quyền "Mở để sửa" đối soát (18/11):** xem mục riêng trong `CLAUDE.md`. Claude trên máy anh Tiến bị hook chặn tới khi anh gõ mật khẩu (mở 30 phút). Bộ khoá và bài thử của nó (`kiem_tra_khoa.sh`) nằm ngoài kho mã, trong thư mục `milano` ở `~/.claude`. Đổi mật khẩu: ghi băm sha256 mới vào tệp băm ở đó (cách làm ghi ở đầu tệp khoá). Thiết kế / kế hoạch: `tai_lieu/superpowers/specs|plans/2026-11-18-khoa-quyen-doi-soat*`.
- **Bài học 18/11 (lỗi bước 129):** đổi quyền ở máy chủ thì phải dò cả giao diện tìm chỗ còn chặn theo vai (`grep -rn "is_chu\|can_unlock\|system_role" docs/js`). Bài thử phải dựng đúng tình huống được đổi (ở đây là phiếu **có mục web tự đối soát**, `app__test_auto_lock`), và phải thấy bài thử **báo lỗi trên bản cũ** trước khi sửa. Bước 129 chỉ sửa máy chủ, còn dòng `LK?.is_chu ? [] : …` của bước 121 trong `phieu_ca.js` vẫn khoá ô với người không phải Chủ. Lỗi lọt qua vì bài thử dùng phiếu không có mục tự đối soát.
- Hai phiên AI (Claude và Codex/ChatGPT) từng làm song song trên cùng kho mã. **Từ nay chỉ một phiên làm tại một thời điểm.**

## Sổ thu chi mới (bước 143, đợt 1 đã lên web — chỉ xem)

- Thiết kế (anh Tiến duyệt): `tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md`. Kế hoạch đợt 1: `tai_lieu/superpowers/plans/2026-11-18-so-thu-chi-moi-dot1.md`. Mẫu bấm thử: https://claude.ai/artifact/6L53uqto8BgLHgBSLh744E. Tóm tắt điểm chốt: `TINH_NANG_DA_CHOT.md` mục "Sổ thu chi mới".
- Trang `docs/js/pages/so_thu_chi.js` (`#/quan-ly/so-thu-chi`, menu Quản lý ca › "Sổ thu chi (mới)"), hàm tính thuần `docs/js/so_thu_chi_tinh.js` (thử: `jsc -m kiem_tra/so_thu_chi_tinh_dot1.mjs`). Máy chủ thử: `kiem_tra/so_thu_chi_127.sql` (tự hoàn tác, báo lệch so với cách cũ). Bộ thử Chrome: `flow_stc1` (role chu / qlt / ql, `index.html` + `test/phone.html`), giả lập `stc_gia.js` + `stc_fixture.js`.
- **Đợt 2 đã xong (19/11):** sửa / thêm / xoá phiếu (gạch ngang + phiếu bổ sung, bảng `stc_edits`), người nợ ✓, Thu nợ; khoản của ca chỉ sửa khi ca đã chốt tiền (hàm `app_stc_move_save`, không mở lại mục đã duyệt). Bài thử: `kiem_tra/so_thu_chi_129.sql`, `so_thu_chi_130.sql`, `flow_stc2`.
- **Đợt 3 đã xong (19/11):** phiếu chênh lệch trong sổ (trừ lương / quán chịu / ghép / phiếu thu; quán chịu + ghép của người không phải Chủ chờ Chủ duyệt; trừ lương khoá ghép, phiếu thu khoá gán nợ). Bài thử: `kiem_tra/so_thu_chi_131.sql`, `jsc -m kiem_tra/so_thu_chi_tinh_dot3.mjs`, `flow_stc3`. Gán nợ khách trả cho ca dư (`app_stc_gap_debt`, tệp 132, vùng khoá) cũng đã xong; bài thử `kiem_tra/so_thu_chi_132.sql`, `flow_ql_tu_ds` đạt.
- **Đợt 5 đã xong (19/11, web 2026.11.19.5):** tab Tổng đủ nút (Chuyển về Quỹ ngoài, Đã nhận tiền, Luân chuyển, Kiểm quỹ + Điều chỉnh), Quỹ ngoài thêm / sửa / xoá khoản ngoài — dùng lại hàm Sổ quỹ cũ, không thêm SQL. Chốt tháng không cần đổi (Chuyển về Quỹ ngoài chính là bảng `fund_withdrawals` Chốt tháng đang đối chiếu). Bài thử `flow_stc5` (giả lập gọi hàm `fund_gia.js` để trang Sổ quỹ cũ vẫn đúng — `flow_qn` cho kết quả y như trước).
- **Đang chạy song song 1 tuần**, sau đó gỡ 4 trang cũ + phần tiền của Đối soát ca (anh Tiến dặn 19/11: **chưa bỏ trang cũ**).
- **Đợt 4 đã xong (19/11, web 2026.11.19.6):** tab Đối soát tiền 3 bước (hàm `app_stc_ds_*`, bảng `stc_open_blame`). Bài thử `kiem_tra/so_thu_chi_133.sql`, `jsc -m kiem_tra/so_thu_chi_tinh_dot4.mjs`, `flow_stc4`, `flow_ql_tu_ds`.
- **Việc tiếp theo:** chạy song song 1 tuần; anh Tiến xác nhận số khớp rồi mới gỡ trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ, phần tiền của Đối soát ca) và đổi Việc hôm nay / thông báo sang trang mới. Còn để sau: cờ hoá đơn Fabi bị sửa / xoá mới chỉ hiện; ca gợi ý ghép chỉ trong tháng đang xem; QL tổng huỷ được ghép Chủ đã duyệt.
- Tồn quỹ mới khác Sổ quỹ cũ ở vài ngày (ĐK −369.000 TM từ 15/11; HS +5.000 từ 07/11) — cần anh Tiến xem khung "So với trang cũ" và quyết định.

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
