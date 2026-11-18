# Việc hôm nay — chia nhóm Vận hành / Nhân sự / Khác (thiết kế)

Ngày: 18/11/2026 · Anh Tiến chốt qua bản thử bấm được: https://claude.ai/artifact/BkPG1cR8DLQGDLGRPrPhu4 (dữ liệu giả).
Làm **sau bước 141** (Nội quy / Cam kết vào Việc hôm nay — một phiên khác đang làm, cùng sửa `hom_nay.js`, `hom_nay_viec.js`).

## 1. Vì sao

Danh sách "Việc của tôi" ở Việc hôm nay (bước 138) chỉ xếp theo hạn. Việc tiền / chốt ca, việc nhân sự và việc lặt vặt nằm lẫn với nhau, nên khó biết bắt đầu từ đâu. Chủ cũng không xem được ai đang giữ việc gì. Anh Tiến muốn:
- việc chia theo **loại**: Vận hành, Nhân sự, Khác; mỗi nhóm thu gọn / mở rộng được;
- việc cùng loại gộp thành một dòng, mở ra được;
- mỗi dòng ghi **người phải thực hiện**;
- Chủ xem được việc của Quản lý tổng, Quản lý, Kế toán và việc khác;
- Quản lý xem được các hạng mục đào tạo đã giao cho người hướng dẫn.

## 2. Mục tiêu / không làm / thất bại nếu

**Mục tiêu:** như mục 1, cho cả 5 vai trò, trên máy tính và điện thoại 390px.

**Không làm:**
- Không đổi tab Công việc (Việc của tôi, Tất cả công việc, Bảng phân công).
- Không thêm ô "nhóm" khi Giao việc riêng (anh chọn **cách A**).
- Không chia theo mức Gấp / Bình thường / Thấp; mức độ chỉ dùng để xếp thứ tự trong nhóm.
- Nhân viên chỉ thấy việc của mình.

**Thất bại dù chạy được nếu:**
- Việc gấp hoặc quá hạn bị giấu khi nhóm đang thu gọn. Đầu nhóm và dòng gộp **luôn** phải hiện số gấp / quá hạn / hôm nay.
- Trang mở chậm thấy rõ. Chỉ thêm tối đa 1–2 lần hỏi máy chủ, hỏi cùng lúc với các câu sẵn có (`Promise.all`).
- Tràn ngang trên điện thoại.

## 3. Các cách đã cân nhắc

| Cách | Nội dung | Kết quả |
|---|---|---|
| **A** | Web tự xếp nhóm theo bảng luật. Giao việc riêng gõ tay → Khác. Việc từ Bàn giao ca → Vận hành. | **Anh chọn** |
| B | Như A, thêm ô chọn nhóm khi Giao việc riêng / tạo việc tự thêm (cần cột mới trên máy chủ). | Không chọn |
| — | Máy chủ tự tính nhóm cho mọi việc. | Bỏ: luật chỉ là một bảng xếp loại, để ở web dễ đổi hơn. |

## 4. Luật xếp nhóm (anh Tiến chốt)

> Liên quan **tiền, chốt ca, hàng hoá, số dư ngân hàng** → Vận hành. **Nghỉ & làm thay chờ, đào tạo, nội quy** → Nhân sự. Còn lại → Khác.

Theo khoá việc trong `collectWork` (`docs/js/hom_nay_viec.js`):

| Nguồn / khoá | Nhóm | Nhãn đầu dòng |
|---|---|---|
| `pc:` Bảng phân công, job 1 Đối soát ca, 2 Phân chia NV phát sinh, 3 File ca Fabi | Vận hành | Chốt ca |
| `pc:` job 4 Chuyển khoản thực nhận | Vận hành | Ngân hàng |
| `pc:` job 7 Lệch tiền ca, 8 Xem giải trình khoản trừ, 10 Kiểm quỹ | Vận hành | Tiền |
| `pc:` job 11–14 (nhận hàng, đối soát hàng, hoá đơn bù, giao bù) | Vận hành | Hàng hoá |
| `pc:` job ≥ 100 (việc tự thêm) | Khác | tên việc |
| `gv:` có `handover = true` (sinh từ **Bàn giao ca**, cả lúc chờ phân loại) | Vận hành | Bàn giao ca (+ `src`: ca nào) |
| `gv:` còn lại (Giao việc riêng gõ tay) | Khác | Giao việc riêng |
| `ka:` khoản âm của tôi | Vận hành | Tiền |
| `dt:` phiếu đào tạo | Nhân sự | Đào tạo |
| `nq`, `nqf:*` (đọc / nhắc đọc nội quy — bước 141) | Nhân sự | Nội quy |
| `ck`, `ckf` (ký / theo dõi cam kết — bước 141) | Nhân sự | Cam kết |
| `todo:` `cho_doi_soat`, `dang_sua`, `qua_ngay`, `thu_chi`, `thieu_fabi`, `thieu_nh`, `mon`, `phieu_rut` | Vận hành | Chốt ca / Tiền / Ngân hàng |
| `todo:` `nghi_thay`, `chu_duyet` | Nhân sự | Nghỉ & làm thay |
| `todo:` `sao_luu`, `qua_han_phat`, `cong_viec_quan_tri`, khoá lạ | Khác | — |

Khoá chưa có trong bảng thì vào **Khác**, để việc mới không bao giờ bị mất khỏi trang.

## 5. Giao diện

Bản thử là mẫu chuẩn về bố cục. Màu dùng biến sẵn có trong `docs/assets/style.css`.

**5.1 Ba nhóm** (trong khối "Việc của tôi")
- Đầu nhóm: mũi tên, biểu tượng, tên nhóm, (số việc), dòng gợi ý (vd "Tiền · Chốt ca · Hàng hoá · Ngân hàng"). Bên phải là nhãn: `N gấp` (đỏ đặc), `N quá hạn` (đỏ nhạt), `N hôm nay` (vàng); khi không có 3 nhãn đó mà có việc đang chờ thì hiện `N đang chờ`.
- Bấm đầu nhóm để thu / mở. Có thêm nút **Mở hết · Thu gọn hết**, áp dụng cho cả nhóm lẫn dòng gộp.
- Mặc định: nhóm có việc thì mở, nhóm trống thì thu (hiện "Không có việc trong nhóm này."). Trang nhớ trạng thái trong `localStorage` theo từng tài khoản; đọc / ghi đều bọc `try/catch`.
- Thứ tự trong nhóm: **Gấp** (`priority = 'gap'`) → quá hạn → hôm nay → trong 3 ngày → không hạn → đang chờ. Cùng mức thì hạn sớm lên trước. Vạch màu bên trái giữ như bước 138 (đỏ / cam / xanh / xám).

**5.2 Gộp việc cùng loại**
- Trong một nhóm, từ **2 việc cùng loại** trở lên thì gộp thành một dòng: nhãn, tên loại, ô số đếm, nhãn `N quá hạn` / `N hôm nay`, hạn của việc gấp nhất, và người làm (gộp tên, tối đa 3 tên + "+N").
- Dòng gộp đứng ở vị trí của việc gấp nhất trong loại. Mặc định thu gọn, nhớ trạng thái như nhóm.
- Mở ra thì thấy từng việc, thụt vào trong, có đường viền đứt bên trái.
- Loại để gộp: `pc` theo `job`; `dt`; `ka`; `gv` bàn giao ca; `nqf`. **Giao việc riêng gõ tay không gộp.** Các dòng `todo:` vốn đã là số tổng nên không gộp.

**5.3 Người phải thực hiện** — một nhãn tròn nhỏ dưới mỗi dòng: "Người làm: …"
- Màu xanh rêu nếu có mình. Màu tím nếu chỉ người khác làm. Màu vàng nếu "Chưa có người nhận".
- `pc`: người của bước hiện tại (`curStep(t).accounts`). Hai người thì ghi "A + B (ai làm trước cũng được)".
- `gv`: lúc chờ phân loại là người phân loại; lúc chờ kiểm tra là người kiểm tra; còn lại là người làm.
- `dt`: vai của mình trên phiếu (`my_duties`).
- `todo:` / `ka` / `nq` / `ck`: "Bạn".

**5.4 Chủ — hai tab trong khối việc: "Việc của tôi (n)" | "Mọi người (m)"**
- Mặc định mở tab **Mọi người**.
- Tab Mọi người gồm việc đang mở của cả hệ thống, **trừ** việc chỉ có Chủ làm. Vẫn chia 3 nhóm, vẫn gộp, có tên người làm.
- Hàng nút lọc: **Tất cả · Quản lý tổng · Quản lý · Kế toán · Việc khác**, mỗi nút kèm số việc. Ghi chú: "Việc khác: việc của nhân viên và việc chưa có người nhận".
- Xếp vai trò theo `app__pc_people()` (`role`, `kt`): `ql_tong` → Quản lý tổng; có quyền kế toán (`kt`) → Kế toán; `ql` → Quản lý; còn lại hoặc chưa có người → Việc khác. Việc có nhiều người thuộc nhiều vai thì hiện ở nhiều nút lọc.
- Dữ liệu: `app_pc_all()` (đã có, quyền `hop_giao_viec`; gồm `tasks`, `gv`, `people`) + `app_dt_work_list(false)` cho phiếu đào tạo đang mở (người hướng dẫn chính / quản lý phụ trách). Hỏi cùng lúc với các câu khác khi người dùng là Chủ. Không cần hàm máy chủ mới.

**5.5 Quản lý — "Đào tạo đã giao người hướng dẫn"** (nhóm Nhân sự, là một dòng gộp)
- Mỗi dòng con: "Học viên · hạng mục", bước hiện tại (Chưa giới thiệu / Đã giới thiệu / Đã thực hành có giám sát / Giai đoạn 2 · mức …), người hướng dẫn, hạn của phiếu (`start_date + 12`). Bấm dòng mở phiếu đào tạo tại hạng mục đó.
- Phạm vi: các phiếu có `manager_id` = mình (Quản lý phụ trách), hạng mục có `training_followups.employee_id` và `finished_at is null`.
- **Cần thêm máy chủ:** `app_dt_work_list` chưa trả chi tiết hạng mục đã giao. Thêm một tệp SQL mới (số thứ tự lấy theo `select max(file) from app_migrations` lúc làm; bước 141 đang giữ 123) với một trong hai cách: thêm khoá `followups` vào `app_today_me`, hoặc viết hàm mới `app_dt_followups_managed()`. Hàm theo mẫu `app_*` SECURITY DEFINER, có `revoke` / `grant` như tệp 120. Dòng cuối ghi `app_migrations`.

**5.6 Giao việc riêng (cách A)** — hộp `gvCreate` trong `docs/js/cv_chung.js` giữ nguyên các ô. Thêm một dòng ghi chú xanh nhạt dưới các ô: "Việc này hiện trong nhóm **Khác** ở trang Việc hôm nay của người làm, người kiểm tra và ô Theo dõi của bạn."

**5.7 Ô Theo dõi** (Quản lý, Quản lý tổng, Chủ, Kế toán) — thay dòng tóm tắt "Việc tôi đã giao đang theo dõi" bằng **danh sách từng việc** mình đã giao (lấy từ `pc.watch`), mỗi dòng có tên người làm. Các nút lối tắt giữ nguyên.

**5.8 Kiểm tra việc và "Đã xong hôm nay"** (anh Tiến chọn cách 1)

Áp dụng cho Giao việc riêng, kể cả việc từ Bàn giao ca. Quy trình trên máy chủ giữ nguyên (`app_gv_submit`, `app_gv_review`): Chờ nhận → Đang làm → Báo xong + ảnh → Chờ kiểm tra → **Đạt** (đóng việc) / **Làm lại** (bắt buộc lý do, có hạn mới).

| Lúc | Người làm thấy | Người kiểm tra thấy |
|---|---|---|
| Báo xong (`cho_duyet`) | Việc **ở lại** trong nhóm, xuống cuối nhóm, nhãn xám "Chờ <người kiểm tra> kiểm tra" | Việc lên **đầu nhóm**, nền vàng, nhãn cam **"Cần bạn kiểm tra"**. Đầu nhóm có nhãn `N cần kiểm tra` |
| Đạt (`hoan_thanh`) | Việc sang mục **Đã xong hôm nay** | Như người làm |
| Làm lại (`dang_xu_ly` + `review_note`) | Việc lên **đầu nhóm**, nền đỏ nhạt, nhãn đỏ "Làm lại", dòng "Lý do: …", hạn mới. Đầu nhóm có nhãn `N làm lại` | Việc rời khỏi danh sách của mình |

- Thứ tự trong nhóm, sửa lại mục 5.1: **Cần bạn kiểm tra / Làm lại** → Gấp → quá hạn → hôm nay → trong 3 ngày → không hạn → đang chờ.
- Bấm dòng: mở đúng hộp sẵn có ở tab Công việc (kiểm tra = Đạt / Làm lại; báo xong). Có thể gọi lại hộp của `cv_chung.js` ngay trên trang, hoặc dẫn sang `/viec`; người làm tự chọn, miễn không phải tìm lại việc.
- **Mục "Đã xong hôm nay"** là nhóm thứ 4, ở cuối khối việc, **mặc định thu gọn**, nhớ trạng thái như các nhóm khác.
  - Mỗi dòng: dấu ✓ xanh, nhãn loại, tên việc, "**Đạt** · <người kiểm tra> kiểm tra · giờ" (Giao việc riêng) hoặc "**Xong** · giờ" (Bảng phân công), cùng nhãn người làm.
  - Chỉ việc xong **trong ngày hôm nay** (giờ VN), sang ngày mới tự hết. Không có nút thao tác.
  - Tab Mọi người của Chủ: Đã xong hôm nay của cả hệ thống, theo cùng bộ lọc vai trò.
- **Cần thêm máy chủ** (gộp vào tệp mới ở 5.5):
  - `app_pc_mine.gv` thêm việc `cho_duyet` có `assignee_id` = mình (hiện chỉ trả cho người kiểm tra, nên người làm báo xong là việc biến mất).
  - Trả danh sách xong hôm nay của mình: `pc_tasks.done_at` hôm nay (đã có `done` 7 ngày, chỉ cần lọc) + `tasks.approved_at` hôm nay có `assignee_id` hoặc `reviewer_id` = mình, kèm người kiểm tra.
  - Chủ: `app_pc_all.gv` đã gồm việc xong trong 7 ngày (`approved_at`), `done` có `by`; web lọc lấy hôm nay.
- `collectWork` hiện có dòng `waitingFor` cho `st === 3` nhưng chưa bao giờ nhận được việc đó (vì máy chủ không trả). Sau khi sửa máy chủ, dòng này dùng được.

**Giữ nguyên:** Ca của tôi hôm nay, nút Order ca, Bảng lương của tôi, cách báo lỗi tải ("Chưa tải được công việc" + Thử lại).

## 6. Kiểm tra

- Thử hàm thuần bằng `jsc`: mở rộng `kiem_tra/hom_nay_viec_138.mjs` (hoặc tệp mới) cho luật xếp nhóm (đủ các khoá ở mục 4, khoá lạ → Khác), gộp (1 việc không gộp, 2+ thì gộp, vị trí theo việc gấp nhất), xếp thứ tự (Gấp lên đầu) và lọc vai trò của Chủ.
- Bộ thử Chrome giả lập (`kiem_tra/trinh_duyet/`): thu / mở nhóm và dòng gộp, nhớ trạng thái sau khi tải lại, tab Mọi người + lọc, phần đào tạo đã giao của Quản lý, khung 390px không tràn ngang.
- Tệp SQL: chạy thử tự hoàn tác (`RAISE EXCEPTION 'REPORT>> …'`) trước khi chạy thật.

## 7. Triển khai

1. Chờ bước 141 xong và đã đẩy lên `main`. Sau đó `git pull`, đọc lại `hom_nay_viec.js`.
2. Máy chủ: tệp đào tạo đã giao (5.5) → chạy thử → chạy thật.
3. Giao diện → thử → tăng `docs/version.json` và `?v=` → đẩy lên `main` → ghi `app_releases` → cập nhật `TINH_NANG_DA_CHOT.md` và `BAN_GIAO.md`.

## 8. Các quyết định do người viết thiết kế đặt (anh xem lại)

- Cam kết vào nhóm Nhân sự (đi cùng Nội quy).
- Phần "Đào tạo đã giao người hướng dẫn" chỉ hiện cho **Quản lý phụ trách** phiếu đó.
- Chủ mở trang thì thấy tab Mọi người trước.
- Người vừa là Quản lý vừa có quyền kế toán thì tính là Kế toán.
- Việc tự thêm (job ≥ 100) vào Khác.
- Tab Mọi người **không** có các dòng hồ sơ tồn dạng số tổng (ca chờ đối soát, thu chi chờ nhóm…). Những dòng này tính theo quyền, không gắn người. Việc theo Bảng phân công cùng loại (Đối soát ca, File ca Fabi…) đã có tên người làm nên vẫn hiện.

## 9. Để người làm tự quyết

Tên biến / CSS, chia tệp (có thể tách phần vẽ nhóm ra `hom_nay_nhom.js`), khoá `localStorage`, và việc dùng `<details>` hay nút tự viết (miễn có `aria-expanded`).
