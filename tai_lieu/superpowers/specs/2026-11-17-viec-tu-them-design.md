# Việc tự thêm theo lịch từng cơ sở — thiết kế (17/11/2026)

## Mục đích
Anh Tiến muốn **tự thêm việc** vào Bảng phân công (vd vệ sinh máy pha, kiểm kho, lau kính) và cài **riêng từng cơ sở**: người làm, chu kỳ, ngày làm, thời gian quá hạn cho phép, mức phạt. Đến ngày thì web tự tạo việc, quá hạn thì lên trang Quá hạn & phạt như các việc đang có. Có cài đặt **bắt buộc chụp ảnh khi báo xong** để kiểm tra.

## Mục tiêu
- Chủ bấm **+ Thêm việc** ở Bảng phân công, ghi tên + hướng dẫn, tick "Bắt buộc chụp ảnh khi báo xong", tick **"Có kiểm tra"** (anh chốt 17/11: tuỳ việc), điền bảng từng cơ sở.
- Tick "Có kiểm tra" → việc có thêm **giai đoạn 2: Kiểm tra**; bảng từng cơ sở hiện thêm 2 cột **Người kiểm tra** và **Hạn kiểm tra** (bao lâu từ lúc người làm báo xong) — anh chốt 17/11.
- Mỗi cơ sở: **Bật/tắt · Người làm · Chu kỳ (Hằng ngày / Hằng tuần / Hằng tháng) · Ngày làm (Thứ 2…CN, hoặc ngày 1…31) · Quá hạn cho phép · Mức phạt**.
- Việc tự thêm **sửa được mọi ô, tạm tắt, xoá** được.
- Người làm thấy việc ở **Việc của tôi**, nhận thông báo "Việc mới", bấm **Báo xong ✓** (ghi chú + ảnh; ảnh bắt buộc nếu bật).
- Quá hạn → **Quá hạn & phạt** với mức phạt **của cơ sở đó**; Chủ bấm Phạt / Bỏ qua (web không tự trừ — giữ quy định cũ).
- Chủ / Quản lý tổng xem lại được ảnh và ghi chú của lần đã xong.

## Không làm (lần này)
- Không đổi 12 việc tự động đang có (Đối soát ca, Lệch tiền…): vẫn 1 mức phạt chung, hạn như cũ. (Ý "chia cơ sở cho việc đang có" để sau nếu anh cần.)
- Không sửa chuyện nhắc phiếu chốt ca quá dày / báo quá hạn (mục riêng của bản kiểm tra Công việc).

## Không được để xảy ra
- Tạo dồn việc cho những ngày **trước** lúc cài đặt (giống quy định "tồn cũ không tạo việc, không phạt").
- Một ngày làm tạo **2 việc trùng** cho cùng cơ sở.
- Sửa cài đặt làm **mất lịch sử** việc đã tạo / phạt đã ghi.
- Người không phải Chủ sửa được cài đặt (QL tổng chỉ xem — giữ quy định Bảng phân công).

## Cách làm đã chọn: A — chạy chung Bảng phân công
Các cách đã cân nhắc:
- **A (anh chọn 17/11):** thêm việc vào bảng `pc_jobs`, lịch từng cơ sở ở bảng mới, phần tự tạo việc 5 phút/lần (`app__pc_tick`) tạo việc theo lịch. Dùng lại Việc của tôi, thông báo, Quá hạn & phạt. Phải thêm "báo xong kèm ảnh" cho việc trong bảng.
- B: đến ngày tạo Giao việc riêng — đủ ảnh / kiểm tra nhưng 5 bước quá nặng cho việc lặp lại, phạt chưa theo cơ sở, lẫn với việc giao tay.
- C: trang "Việc định kỳ" riêng — làm lại thông báo, quá hạn, phạt; thêm 1 trang.

## Quy tắc chi tiết
**Hạn mỗi lần làm** *(em quyết, anh chưa phản đối)*: việc hiện từ **00:00 ngày làm**; hạn = **23:59 ngày làm + quá hạn cho phép**. Vd ĐK Thứ Ba, cho phép 1 ngày → quá 23:59 Thứ Tư mà chưa xong thì tính quá hạn. Quá hạn cho phép chọn: 0 (xong trong ngày), 2 giờ, 4 giờ, 12 giờ, 1, 2, 3, 7 ngày.

**Chu kỳ:**
- Hằng ngày: mỗi ngày 1 việc.
- Hằng tuần: chọn 1 thứ (Thứ 2…CN).
- Hằng tháng: chọn ngày 1…31; tháng không có ngày đó (vd 31/2) thì làm **ngày cuối tháng** *(em quyết)*.

**Tạo việc:**
- Từ ngày lưu cài đặt cơ sở đó trở đi: tạo đúng lịch, quá hạn thì phạt.
- **Làm bổ sung (anh chốt 17/11):** vẫn hiện việc cho lần làm **gần nhất trước ngày cài đặt** để quản lý làm bổ sung (vd cài Thứ Tư, lịch Thứ Hai → hiện việc Thứ Hai tuần này) — *số lần hiện bổ sung: em quyết 1 lần gần nhất*. Việc bổ sung ghi rõ "Làm bổ sung", **không bao giờ phạt**.
- Lỡ máy chủ không chạy vài lần thì bù tối đa **7 ngày gần nhất** *(em quyết)*.
- Mỗi (việc, cơ sở, ngày làm) đúng 1 việc — khoá chống trùng trong CSDL.
- Lưu cài đặt đúng vào ngày làm thì **tạo luôn việc của hôm nay** *(em quyết)*.
- Thông báo "Việc mới" chỉ hiện trong app (không phải tin nhắn điện thoại), nên tạo lúc 00:00 không làm phiền ai.
- Tên việc hiện: "<Tên việc> · <Cơ sở> · <ngày làm dd/mm>".
- Cơ sở chưa có người làm: vẫn tạo, hiện "Chưa có người làm" như việc tự động hiện nay (Chủ / QL tổng thấy để giao).
- Nhiều người làm = ai làm trước cũng được (giống hiện nay); phạt khi quá hạn ghi cho **tất cả** người được giao, Chủ chọn (giống hiện nay).

**Báo xong:**
- Người được giao (hoặc Chủ) bấm Báo xong: ghi chú (không bắt buộc) + ảnh.
- Bật "Bắt buộc chụp ảnh" → máy chủ chặn nếu không có ít nhất 1 ảnh.
- Ảnh lưu kho ảnh sẵn có (`phieu-ca`, thư mục riêng cho việc này).
- Báo xong → việc đóng (hoặc sang Kiểm tra nếu có); trễ hạn rồi mới báo thì phạt chờ đã ghi vẫn giữ để Chủ quyết (giống hiện nay).

**Giai đoạn 2 — Kiểm tra (chỉ khi tick "Có kiểm tra"):**
- Người làm Báo xong → việc chuyển sang **Chờ kiểm tra**, người kiểm tra của cơ sở nhận thông báo "Việc chờ bạn kiểm tra".
- Người kiểm tra xem ghi chú + ảnh, bấm **Đạt ✓** (việc đóng) hoặc **Làm lại** (bắt buộc lý do + chọn hạn mới: 4 giờ, 12 giờ, 1, 2, 3 ngày; mặc định 1 ngày) → về lại người làm, người làm được báo.
- **Hạn kiểm tra cài từng cơ sở** (anh chốt 17/11): tính từ lúc người làm báo xong; chọn 2 giờ, 4 giờ, 12 giờ, 1, 2, 3 ngày (mặc định 1 ngày); quá hạn thì **người kiểm tra** vào Quá hạn & phạt cùng mức phạt cơ sở (đúng quy định "ai đang giữ việc ở bước nào thì bị tính bước đó").
- Người kiểm tra phải khác người làm; nhiều người kiểm tra = ai kiểm tra trước cũng được. **Bắt buộc chọn người kiểm tra** cho mọi cơ sở đang bật khi tick "Có kiểm tra" — chưa chọn thì không lưu được.
- Bỏ tick "Có kiểm tra" chỉ áp dụng cho lần tạo sau.

**Sửa / tắt / xoá:**
- Đổi cài đặt chỉ áp dụng cho lần tạo sau; việc đang mở giữ hạn và người cũ (giống quy định hiện nay). Đổi người làm có tick "chuyển luôn việc đang mở" như ô bảng hiện nay.
- **Tắt** (cả việc hoặc 1 cơ sở): không tạo lần mới; việc đang mở giữ nguyên.
- **Xoá** *(em quyết)*: việc biến khỏi bảng; các việc đang mở của nó **huỷ** (ghi "Việc đã bị xoá"); việc đã xong, phạt đã ghi vẫn giữ trong lịch sử. Web hỏi lại trước khi xoá.

**Quyền:** chỉ tài khoản Chủ thêm / sửa / xoá (quyền `phan_cong` + vai trò Chủ, như `app_pc_job_save`). Quản lý tổng xem. Chọn người làm: bất kỳ tài khoản đang làm (cả nhân viên).

## Giao diện
- **Bảng phân công:** thêm nhóm **"Việc tự thêm"** cuối bảng, nút **+ Thêm việc**. Mỗi ô cơ sở tóm tắt: người làm + "T2 hằng tuần · +1 ngày · 50.000đ" (tắt thì mờ). Bấm tên việc hoặc ô → hộp sửa cùng 1 bảng từng cơ sở. Điện thoại: thẻ, mỗi cơ sở 1 khối.
- **Việc của tôi / Tất cả công việc:** thẻ việc hiện tên việc tự thêm (lấy từ máy chủ, không cố định trong mã), hướng dẫn, "📷 Bắt buộc ảnh" nếu bật, nút **Báo xong ✓**. Việc đã xong: xem ghi chú + ảnh.
- **Quá hạn & phạt:** mức phạt gợi ý lấy theo cơ sở.
- Mẫu giao diện vẽ cho anh duyệt trước khi làm.

## Gợi ý cho người làm (không bắt buộc)
- `pc_jobs` thêm cột: `name`, `guide`, `need_photo`, `custom`, `deleted_at`; số việc tự thêm bắt đầu từ 100. Bước của việc tự thêm: bước "Làm" (người = `branch`) + bước "Kiểm tra" nếu bật (dùng `pc_assign` có sẵn cho người làm từng cơ sở).
- Bảng mới lịch từng cơ sở: (job, branch_id, enabled, cycle, day, grace_hours, fine, checkers bigint[], check_hours, from_date…). Việc bổ sung đánh dấu để phần phạt bỏ qua. Mặc định không cấp quyền anon/authenticated.
- `pc_steps` thêm ghi chú + ảnh khi báo xong; `app_pc_step_done` nhận thêm ghi chú/ảnh và kiểm ảnh bắt buộc.
- Phạt: điều kiện `j.fine > 0` và số tiền gợi ý cần lấy theo cơ sở cho việc tự thêm.
- Chỗ giao diện đang tra tên bằng `JOBS[t.job]` cần dùng tên từ máy chủ cho việc ≥ 100.
- Tệp SQL mới số tiếp theo sau 103, chạy thử trước (tự hoàn tác), dòng cuối ghi `app_migrations`.
