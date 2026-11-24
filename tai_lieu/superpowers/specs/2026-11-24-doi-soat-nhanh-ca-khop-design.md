# Đối soát nhanh cho ca khớp hết — bản thiết kế

- Ngày: 24/11/2026. Người yêu cầu: anh Tiến ("trang đối soát quản lý phải tích rất nhiều, mất rất nhiều thao tác").
- Trạng thái: **chờ anh Tiến duyệt**. Chưa làm gì trên web / máy chủ.
- Bản thử anh đã xem: https://claude.ai/artifact/8o6fFAeLDFWRFjxYzNJzGg (3 ca thật ở Hải Sơn 18–19/11, tên nhân viên đã đổi).
- Vùng khoá: **có đụng** (phần tiền đối soát). Mục 5.6 ghi rõ đổi gì — đây là lời báo trước theo CLAUDE.md.

## 1. Vì sao làm

Số liệu tháng 11 (tra 24/11):
- 271 ca đã chốt phiếu, mới 84 ca bấm Hoàn thành đối soát; còn ~187 ca (HS 66, LL 47, ĐK 38, LHP 36).
- Mỗi ca Hoàn thành, quản lý chỉ tích tay trung bình 2,9 mục (ảnh phiếu 79 lần, không sót thu 74, khoản chi có thật 37, két để lại 33, lý do lệch 25, thu nợ 15, khoản lớn 9, hoá đơn sửa 2). Nhưng tổng số lần bấm ~10 / ca: 2–3 lần "Duyệt & tiếp" ở phần việc, 5 bước tiền, Xác nhận Fabi, Hoàn thành; mỗi lần bấm trang tải lại (chiều 23/11, mỗi ca Hoàn thành kéo theo ~11 lần `app_ca_get`, ~12 lần bảng tuần, ~6 lần sổ tháng).
- 113 / 261 ca đủ số liệu (~43%) **khớp hết**: không lệch tiền quá 5.000, không sửa hoá đơn, không thu nợ, không khoản chi từ 300.000 — 73 ca loại này chưa Hoàn thành. 104 ca lệch tiền: những ca này thật sự cần xem kỹ.

Mục tiêu: ca khớp hết xong trong **1–2 lần bấm** mà quản lý vẫn **mở và nhìn** từng ca; ca có vấn đề giữ nguyên cách làm kỹ hiện nay.

## 2. Anh Tiến đã chốt (24/11)

- Chọn **phương án A** ("Ca khớp hết: một màn hình, một nút") kèm phần chung đã đề xuất (xong ca thì tự mở ca tiếp theo chưa xong). Đã xem bản thử, không yêu cầu sửa.
- "Làm chuẩn từng bước": thiết kế → anh duyệt → kế hoạch → làm → chạy thử đủ bộ → lên web.

## 3. Không làm / tuyệt đối tránh

- **Không** để web tự Hoàn thành ca mà không ai mở (giữ quyết định 20/11: ca chỉ thành "Đã đối soát" khi có người bấm; 21/11 đã trả 107 ca tự duyệt về cho quản lý xem).
- **Không** duyệt nhiều ca một lần (phương án B — bị loại vì gần như quay lại kiểu tự hoàn thành).
- **Không** bỏ hay nới bất kỳ điều kiện nào máy chủ đang kiểm khi Hoàn thành (`app__stc_ds_missing`, `app_stc_ds_close`, `app__ca_auto_finish` giữ nguyên).
- Nút nhanh **không bao giờ** tự tích các mục cần hỏi người: hoá đơn sửa / xoá (`hd`), thu nợ đúng khách (`tn`), khoản từ 300.000 (`lon`), lý do lệch (`ld`), Để sau (`sau_tm`, `sau_ck`).
- **Không** đổi quyền (ai đối soát được ca nào), **không** đổi cách tính tiền, **không** sửa dữ liệu cũ.
- **Không** đổi cấu trúc 3 thẻ / 5 bước cho ca có vấn đề (bản 6 bước đã chốt 21/11).

## 4. Các cách đã cân nhắc

| Cách | Ca khớp hết | Đổi gì | Đánh đổi | Kết quả |
|---|---|---|---|---|
| A. Một màn hình, một nút | 1–2 lần bấm | Màn hình tóm tắt + 1 hàm máy chủ gói các bước có sẵn | Quản lý có thể bấm cho xong mà không nhìn kỹ (nút "tích hết" hiện nay cũng vậy) | **Anh chọn** |
| B. Duyệt nhiều ca một lần | < 1 lần / ca | Danh sách ca khớp, chọn nhiều ca → Hoàn thành | Đi ngược quyết định 20/11, khó nhìn ảnh từng ca | Loại |
| C. Giữ 5 bước, bớt mục tích | ~5–6 lần | Mở ảnh = tự tích, chọn nhóm chi = tự tích, bỏ qua bước trống | Tiết kiệm ít, một số mục thành "tự tích ngầm" | Loại |

Phần chung (đề xuất cho mọi cách): (1) xong ca thì tự mở ca tiếp theo chưa xong — **làm trong đợt này**; (2) tích / sang bước không tải lại cả trang và bảng tuần — **để đợt 2** (mục 5.5).

## 5. Thiết kế

### 5.1 Ca nào được màn hình nhanh ("khớp hết")

Tính ở web từ dữ liệu trang đã tải (`dsChecks(c, dsCtx(D, c))` của khối tiền + dữ liệu phần việc của `app_ca_get`), viết thành **một hàm thuần** ở `docs/js/so_thu_chi_tinh.js` (ví dụ `fastPlan(checks, work)` → `{ ok, items, why }`) để bài thử gọi được. Máy chủ kiểm lại khi bấm (5.3).

Được màn hình nhanh khi **đủ tất cả**:
1. Người xem có quyền đối soát cả phần việc lẫn phần tiền của cơ sở (như hiện nay); tháng chưa chốt; ca chưa Hoàn thành đối soát.
2. **Mọi mục web tự tích đều xanh**, trừ "Đã Xác nhận Fabi" (`fabi`) — nút nhanh sẽ làm mục này. Cụ thể: tiền mở ca, doanh thu, nợ bill khớp máy (`mo`, `dt`, `no`, không có số sửa đang chờ / bị Chủ từ chối); nợ khác đã phân loại (`phanloai`); đã nhập tiền mặt khi Thu theo ca (`cash`); có số ngân hàng — không chờ kế toán (`ck`); tiền đóng ca = tiền mở ca sau, không ở trạng thái "đang chờ ca sau gửi phiếu" (`ket`); mọi khoản chi đã có nhóm (`cat`); tiền mặt / chuyển khoản không còn lệch chờ xử lý (`tm`, `ck5` — lệch ≤ 5.000 coi như khớp).
3. **Mục quản lý tự tích còn thiếu chỉ nằm trong 4 mục cơ bản**: ảnh phiếu Fabi đúng số máy (`anh`), không sót khoản thu (`sot`), khoản chi có thật (`that`, khi ca có khoản chi), két để lại 1.000.000 (`goi`, khi Thu theo ca hoặc ca cuối ngày). Có bất kỳ mục cần hỏi người (`hd`, `tn`, `lon`, `ld`) → **không** nhanh.
4. Phần việc: ca **không có người nghỉ / làm thay** (`app__cv_state = 'khong_can'`); nhận két đầu ca không lệch (trạng thái `khop`, `khong_ca_truoc`, `rut_quy` hoặc ca đầu ngày); không có hàng kho tổng nhận trong ca còn chưa đối soát.

Thiếu một điều → trang mở như hiện nay (3 thẻ, 5 bước). Ở đầu trang ghi một dòng ngắn "Ca này cần xem kỹ: …" liệt kê lý do (`why`), để quản lý biết vì sao không có màn hình nhanh.

### 5.2 Màn hình nhanh

Trên trang đối soát của ca (`#/ca/doi-soat?id=`), khi ca được nhanh: hiện màn hình tóm tắt **thay cho 3 thẻ** (3 thẻ vẫn mở được bằng đường "Mở các bước như hiện nay", nhớ theo ca trong phiên). Giống bản thử:

```
✓ Khớp hết
Ca Sáng · Thứ Ba 18/11
Web đã so xong: phiếu = máy Fabi, tiền mặt khớp, chuyển khoản khớp ngân hàng, …
[Người làm ca]   2 người: … · Không ai nghỉ / làm thay · Nhận két ca trước: khớp
[Máy Fabi]       ảnh phiếu nhỏ (bấm phóng to) | Doanh thu · Tiền mặt · Chuyển khoản · Nợ
[Tiền thực nhận] Tiền mặt trong két ✓ (phải có = mở ca + tiền mặt bán − chi) · Ngân hàng nhận ✓
[Thu chi của ca] Thu ngoài bán hàng … · từng khoản chi + nhóm
[Khung vàng]     Bấm nút dưới là bạn xác nhận đã: 1… 2… 3… (đúng các mục ở 5.1 mục 3)
[ ✓ Đã xem — Hoàn thành ca này ]
Muốn xem kỹ từng bước? Mở các bước như hiện nay
```

- Ảnh phiếu: dùng ảnh và hộp xem ảnh sẵn có (`photoDialog`, nút 📷 hiện nay), hiện **nhỏ ngay cạnh số máy**; **không bắt** bấm mở ảnh mới cho bấm nút (em tự quyết — xem mục 9).
- Ca đã Xác nhận Fabi nhưng chưa Hoàn thành (🔵) cũng dùng màn hình này nếu đủ 5.1.
- Khung điện thoại 390px: một cột, không tràn ngang; máy tính: cùng khối, rộng tối đa như các khung hiện nay.

### 5.3 Nút "Đã xem — Hoàn thành ca này" → máy chủ (tệp `172_doi_soat_nhanh.sql`)

Một hàm mới `app_ca_ds_nhanh(p_report bigint, p_items text[]) returns jsonb` (SECURITY DEFINER), chạy **trong một giao dịch — hỏng ở đâu thì không lưu gì**:
1. `app__stc_ds_need(p_report, false)` (quyền phần tiền, tháng chưa chốt, phiếu đã gửi) và `app__need('doi_soat')` (quyền phần việc). Ca đã có dấu Hoàn thành (`stc_ca_done`) → báo lỗi.
2. `p_items` chỉ được nằm trong `{anh, sot, that, goi}`; có mục khác → báo lỗi.
3. Kiểm phần việc như 5.1 mục 4: `app__cv_state(p_report) = 'khong_can'`, `app__ca_hand(p_report)` không ở trạng thái lệch / cần đếm lại / chờ ca trước → khác thì báo "Ca này cần xem kỹ: … — mở các bước".
4. Duyệt phần việc: `app_ca_check(p_report, it, true)` cho `nhan_su`, `ban_giao`, `nhap_hang` chưa có dấu (`app_ca_check` tự chặn khi còn hàng nhận chưa đối soát).
5. Chưa đủ dấu 4 mục tiền → `app_stc_ds_close(p_report)` (Xác nhận Fabi — tự chặn khi chờ kế toán, ô đỏ, chưa nhập tiền mặt, số sửa đang chờ). Làm **trước** bước tích để không có việc "tự bỏ tích khi dữ liệu đổi" chen vào giữa.
6. Tích từng mục trong `p_items` bằng `app_stc_tick(p_report, it, true)` (máy chủ kiểm như bấm tay).
7. `app_stc_ds_done(p_report)` — **cửa kiểm cuối cùng có sẵn**: còn thiếu mục nào (kể cả mục cần hỏi người, lệch chưa xử lý, chi chưa nhóm…) thì báo "Còn mục chưa kiểm tra: …" và cả giao dịch hoàn lại. Đủ thì ghi Hoàn thành và `app__ca_auto_finish` đặt "Đã đối soát" như bấm tay.
8. Ghi `app_log('stc_doi_soat_nhanh', 'report=… items=…')`. Trả `{ recon_status, done: true }`.

Quyền gọi: `revoke all … from public, anon; grant execute … to authenticated` (như các hàm `app_*` khác). Hàm **chỉ gọi lại** các hàm có sẵn, không chép lại luật, nên luật nào đổi sau này nút nhanh tự theo.

Web: bấm → khoá nút, gọi `app_ca_ds_nhanh` với đúng các mục đang hiện trong khung vàng. Lỗi → hiện lời báo của máy chủ và mở 3 thẻ như hiện nay (không lưu gì). Thành công → 5.4.

### 5.4 Xong ca thì tự mở ca tiếp theo chưa xong

- Sau khi nút nhanh **hoặc** nút Hoàn thành đối soát ở thẻ ③ (khối tiền chế độ một ca) chạy xong: báo "✓ Đã hoàn thành đối soát ca …", ~1,5 giây sau tự mở "Ca tiếp theo chưa xong" của cùng cơ sở (dữ liệu `app_ca_ds_con` trang đang dùng cho nút "Ca tiếp theo chưa xong ›"). Không còn ca nào → báo "Đã xong hết ca của cơ sở" và về bảng tuần.
- Có nút "Ở lại ca này" trong lời báo để không tự chuyển (khi quản lý muốn xem lại).

### 5.5 Đợt 2 (không làm trong đợt này)

Tích một mục / sang bước / Duyệt & tiếp không tải lại cả trang ca và bảng tuần nữa (hiện mỗi lần bấm gọi lại `app_ca_get`, `app_ca_ds_tuan`, `app_ca_ds_con`, sổ tháng…). Làm riêng sau khi đợt 1 chạy ổn, vì đụng nhiều chỗ của trang ca.

### 5.6 Vùng khoá — những gì đổi (báo trước anh Tiến)

- Máy chủ: **thêm** hàm `app_ca_ds_nhanh` (gói các hàm vùng khoá có sẵn: `app_ca_check`, `app_stc_tick`, `app_stc_ds_close`, `app_stc_ds_done`). **Không sửa** hàm nào có sẵn, không đổi bảng, không đổi `role_permissions`.
- Web: thêm màn hình nhanh trên trang đối soát ca (`phieu_ca.js` + khối tiền `so_thu_chi.js` chế độ một ca), hàm thuần `fastPlan` ở `so_thu_chi_tinh.js`, và bước "tự mở ca tiếp theo" sau Hoàn thành (`data-dsdone`).
- Sau khi làm: thêm vào danh sách vùng khoá trong `CLAUDE.md`: `app_ca_ds_nhanh`, `fastPlan`, `data-dsnhanh` (tên nút), phần tự chuyển ca sau Hoàn thành.

## 6. Kiểm tra

- **Hàm thuần** `fastPlan`: bài `kiem_tra/doi_soat_nhanh_tinh.mjs`, ≥ 12 trường hợp — ca khớp hết (có / không khoản chi; ca cuối ngày có `goi`; ca 🔵 đã xác nhận), lệch tiền > 5.000, lệch ≤ 5.000 (vẫn nhanh), hoá đơn sửa, thu nợ, khoản ≥ 300.000, chi chưa nhóm, Thu theo ca chưa nhập tiền, chờ kế toán, chờ ca sau gửi phiếu, có nghỉ / làm thay, nhận két lệch.
- **Máy chủ cục bộ** (Postgres giả lập như các bài `*_cuc_bo.sql`): `kiem_tra/doi_soat_nhanh_172_cuc_bo.sql` — xong được ca khớp (có dấu Hoàn thành, các tích, 4 mục tiền, "Đã đối soát"); mục ngoài 4 mục → lỗi; ca lệch / có mục cần hỏi → lỗi và **không lưu gì**; có nghỉ / làm thay → lỗi; nhân viên / quản lý cơ sở khác → lỗi; ca đã Hoàn thành → lỗi; tháng đã chốt → lỗi; chạy lại tệp 2 lần không lỗi.
- **Máy chủ thật, chạy thử tự hoàn tác** (khối `REPORT>>`): 5 ca khớp chưa xong (vai quản lý của cơ sở) → xong; 3 ca lệch → báo lỗi, không đổi gì; so sổ tháng các cơ sở trước / sau (phải giống hệt, trừ dấu Hoàn thành và tích của các ca thử).
- **Trình duyệt** (`kiem_tra/trinh_duyet`, máy chủ giả có thêm `app_ca_ds_nhanh`): bài mới `flow_nhanh` — vai chu / qlt / ql × `index.html` và `test/phone.html` (390px, không tràn ngang): ca khớp hiện màn hình nhanh, ca lệch không hiện và có dòng lý do; bấm nút → gọi đúng mục → tự sang ca tiếp theo; "Ở lại ca này"; "Mở các bước như hiện nay"; máy chủ báo lỗi → mở 3 thẻ, không chuyển ca; nhân viên không thấy.
- **Bộ vùng khoá bắt buộc** trước khi lên web: `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6`, `flow_stc7` (chu / qlt / ql), `flow_dsca`, cùng các bài khối tiền đang có (`flow_tick63`, `flow_stc17`).

## 7. Triển khai

1. Tệp `supabase/172_doi_soat_nhanh.sql` (chạy lại nhiều lần được; dòng cuối ghi `app_migrations`). Số 171 đã dành cho bản sửa Sổ thu chi đang hoãn ("thử sau").
2. Chạy thử trên máy chủ thật (tự hoàn tác) → chạy thật **lúc vắng (đêm)**, cả tệp trong một `begin; … commit;` (chạy tệp làm mới kết nối web, giờ đông sẽ chậm vài phút). Lưu ý: 24/11 bộ kiểm an toàn trên máy anh đã chặn lệnh chạy thật vào vùng tiền đối soát → có thể phải nhờ anh bấm cho phép, hoặc anh dán tệp vào SQL Editor của Supabase.
3. Máy chủ chạy xong mới đẩy web lên `main`; tăng `docs/version.json`; ghi `app_releases`; cập nhật `TINH_NANG_DA_CHOT.md`, `CLAUDE.md` (vùng khoá), `BAN_GIAO.md`.
4. Quay lại nếu cần: ẩn màn hình nhanh ở web (một chỗ); hàm máy chủ chỉ thêm, không ai gọi thì không ảnh hưởng.

## 8. Để người làm tự quyết

- Cách nối màn hình nhanh vào trang ca. Gợi ý: `caMoney` (khối tiền chế độ một ca) đã nhận `workLeft` từ trang ca — cho nhận thêm thông tin phần việc (có bước Nghỉ & làm thay không — `dsX2`; trạng thái nhận két `R.cash_hand.state`; hàng nhận trong ca còn chưa đối soát không), tự gọi `fastPlan` và vẽ màn hình nhanh, gắn cờ `data-nhanh` lên `#stc-page`; trang ca thấy cờ thì ẩn 3 thẻ. Sau khi Hoàn thành phải lấy lại danh sách ca chưa xong (`app_ca_ds_con`) để chọn đúng ca tiếp theo.
- Tên lớp CSS, chữ phụ.
- Lấy ảnh phiếu nhỏ từ nguồn ảnh sẵn có của hộp xem ảnh; ca không có ảnh thì ghi "chưa có ảnh" (khi đó vẫn nhanh được nếu `anh` là mục quản lý tích — như bấm tay hiện nay).
- Thời gian chờ trước khi tự chuyển ca (1–2 giây).

## 9. Em đã tự quyết (anh xem, sai thì sửa)

1. **Không bắt mở ảnh** mới cho bấm nút; ảnh hiện nhỏ ngay cạnh số máy. (Muốn chắc chắn hơn: bắt bấm mở ảnh trước — thêm 1 lần bấm mỗi ca.)
2. Ca có **người nghỉ / làm thay** không dùng màn hình nhanh (bước đó cần quản lý tổng phân loại, Chủ duyệt).
3. Lệch tiền **≤ 5.000** vẫn coi là khớp (đúng luật hiện nay).
4. Tự chuyển ca áp cho **cả** nút Hoàn thành thường ở thẻ ③, không chỉ nút nhanh.
5. Phần "bớt tải lại" để **đợt 2**.
6. Ca không được nhanh có thêm **một dòng ngắn ở đầu trang** "Ca này cần xem kỹ: …" ghi lý do (lệch tiền, hoá đơn sửa, thu nợ…), để quản lý biết vì sao phải đi các bước.
