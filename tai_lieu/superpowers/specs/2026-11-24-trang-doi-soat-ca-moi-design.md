# Trang đối soát ca mới — bản thiết kế

- Ngày: 24/11/2026. Người yêu cầu: anh Tiến. Trạng thái: **chờ anh Tiến duyệt**. Chưa làm gì trên web / máy chủ.
- Gốc: bản rà soát `2026-11-24-ra-soat-doi-soat-ca.md` (bản dễ đọc https://claude.ai/artifact/92bwxDfX7tBVL6ja9c9PPR). Thiết kế "ca khớp hết một màn hình" (`2026-11-24-doi-soat-nhanh-ca-khop-design.md`) tạm dừng, nay thành một phần của trang mới (mục 5.2).
- Vùng khoá: **có đụng** (phần tiền đối soát: luật khoá, Hoàn thành). Mục 5.5 ghi rõ đổi gì — lời báo trước theo CLAUDE.md.

## 1. Vì sao làm

- Trang đối soát ca hiện nay (`#/ca/doi-soat?id=`, 3 thẻ) **vẽ lại cả trang sau mọi lần lưu** (tích, chọn nhóm chi, Duyệt & tiếp, Xác nhận Fabi, Hoàn thành, sửa phiếu): mỗi lần ~15 lệnh lên máy chủ, gồm sổ thu chi cả tháng của cơ sở. Một ca khớp hết ~10 lần bấm, ~7 lần tải lại; ca có lệch 10–20 lần. Chiều 23/11 mỗi ca Hoàn thành kéo theo ~11 lần tải lại.
- Khoá theo bước gây thêm thao tác: đã Xác nhận Fabi thì muốn sửa bước 1 phải "Mở lại xác nhận" ở bước 2; bước 3–5 khoá tới khi Xác nhận Fabi.
- Tháng 11 còn ~187 ca chưa Hoàn thành; ~43% ca đủ số liệu là khớp hết.

## 2. Anh Tiến đã chốt (24/11)

1. Rà soát trước; **giữ đủ mọi yêu cầu** đang có ở đối soát ca.
2. **Lưu ngay, không tải lại trang** khi tích / lưu; hạng mục gộp được thì gộp.
3. **Quản lý sửa được mọi bước trước khi Hoàn thành** — không phải "Mở lại xác nhận" ở bước 2 mới sửa bước 1.
4. Có nút **"Tính lại"** tính lại số của riêng ca.
5. **Bỏ nút Xác nhận Fabi**: bấm Hoàn thành thì tự xác nhận Fabi rồi hoàn thành.
6. Đồng ý các đề xuất G1–G8 của bản rà soát.
7. Cách làm **B — viết lại trang đối soát ca mới, chạy song song trang cũ** tới khi xong.
8. Trang mới dùng cho **Chủ, quản lý tổng và quản lý** (mọi người đang đối soát được).

## 3. Không làm / tuyệt đối tránh

- Không bỏ yêu cầu nào trong bản rà soát (mọi mục web tự so, mọi mục cần hỏi người, mọi hộp xử lý).
- Không để ca thành "Đã đối soát" khi chưa có người bấm Hoàn thành (quyết định 20/11).
- Không đổi cách tính tiền, không đổi ai được đối soát ca nào, không sửa dữ liệu cũ.
- Trang cũ giữ nguyên luật và vẫn dùng được trong lúc chạy song song. Sổ thu chi, bảng tuần Chốt ca, Chốt tháng giữ nguyên.
- Nút Hoàn thành không bao giờ tự tích các mục cần hỏi người: hoá đơn sửa / xoá, thu nợ đúng khách, khoản từ 300.000, lý do lệch, Để sau.

## 4. Các cách đã cân nhắc

| Cách | Mô tả | Đánh đổi | Kết quả |
|---|---|---|---|
| A | Sửa dần trang hiện tại, 3 đợt | Ít rủi ro, có cái dùng sớm; mang theo cấu trúc cũ | Không chọn |
| **B** | **Viết lại trang mới, chạy song song** | Về sau gọn, nhanh; lâu hơn mới có cái dùng, rủi ro lớn hơn → chia đợt, trang cũ làm đường lui | **Anh chọn** |
| C | Gom mọi sửa thành một lần "Lưu & tính lại" | Ít lần hỏi máy chủ nhất; phải làm lại mọi hộp, dễ mất phần sửa nếu quên lưu | Không chọn |

## 5. Thiết kế

### 5.1 Đường vào, chạy song song

- Trang mới ở đường dẫn riêng (gợi ý `#/ca/doi-soat-moi?id=<ca>`). Trang cũ có nút **"Dùng trang mới ›"**; trang mới có **"Về trang cũ"**. Lựa chọn "luôn mở trang mới" nhớ theo từng máy; ô ca ở bảng tuần Chốt ca mở theo lựa chọn đó.
- Dùng được cho mọi người đang đối soát (Chủ, quản lý tổng, quản lý của cơ sở) — quyền như trang cũ. Nhân viên không thấy.
- Hai trang ghi **cùng một dữ liệu**: Hoàn thành ở trang nào cũng là Hoàn thành thật; ca đang làm dở ở trang cũ mở bằng trang mới vẫn tiếp tục được, và ngược lại.

### 5.2 Bố cục: một trang dọc cho một ca, làm cho điện thoại trước

```
Ca Sáng · Thứ Ba 18/11 · Hải Sơn          [Tính lại]
⚠ Số chưa tính lại (hiện khi vừa sửa khoản làm đổi tiền)
▸ Phần việc ............. ✓   [Duyệt phần việc]
▸ Số máy Fabi ........... ✓
▾ Tiền thực nhận ........ ⚠   (mở sẵn vì cần xử lý)
▸ Thu chi của ca ........ ✓   (thu + chi chung một mục)
▸ Chênh lệch ............ ✓
Hoàn thành: bấm là xác nhận đã xem ảnh phiếu, không sót thu, …
[ Hoàn thành ]          ‹ Ca trước · Ca tiếp theo ›
```

- **Không chia bước, không khoá theo bước.** Mỗi mục có đầu mục ghi trạng thái (✓ xong · ⚠ cần xử lý · ⏳ chờ kế toán / chờ ca sau). Mục ổn thu gọn, mục cần xử lý mở sẵn; bấm đầu mục để mở / gọn.
- **Ca khớp hết** (điều kiện như thiết kế A mục 5.1, bỏ phần Xác nhận Fabi): mở ra là màn hình tóm tắt + một nút Hoàn thành (bản thử https://claude.ai/artifact/8o6fFAeLDFWRFjxYzNJzGg); có "Xem chi tiết" để mở các mục như trên.
- Nội dung từng mục = **toàn bộ việc trong bản rà soát**, xếp lại:
  - **Phần việc**: người làm, giờ đến / về (sửa có lý do); Nghỉ & làm thay (quản lý cơ sở chỉ xem — quản lý tổng phân loại, Chủ duyệt x2); nhận két ca trước (khớp / lệch → đếm lại cùng người ca trước, lý do); hàng kho tổng nhận trong ca (nhắc, đối soát ở Hàng hoá); đánh giá nhân viên (không bắt buộc). Nút **"Duyệt phần việc"** duyệt cả Nhân sự, Bàn giao, Nhập hàng một lần.
  - **Số máy Fabi**: so tiền mở ca (2 tầng), doanh thu, nợ bill (= danh sách khách nợ hoá đơn); Lấy số máy; Sai, sửa số (Chủ duyệt); chọn ca chịu lệch mở ca; ảnh phiếu Fabi; nợ mới trong ca (xếp nợ khác vào nhóm + người, đổi nhóm, sửa / xoá / thêm nợ quên ghi); khách trả nợ cũ trong ca (+ / Xoá lần trả); ô tích "đã hỏi về hoá đơn sửa / xoá" (khi có).
  - **Tiền thực nhận**: Thu theo ca / theo ngày; tiền mặt quản lý đếm (thu theo ca); số ngân hàng (kế toán nhập; chưa có thì ⏳); tiền đóng ca = tiền mở ca sau.
  - **Thu chi của ca** (gộp bước Khoản thu + Khoản chi): phiếu thu và phiếu chi (nhân viên ghi / quản lý ghi); "+ Thêm phiếu" (Thu khác, Thu nợ, Cho nợ, Luân chuyển, Chi); sửa / xoá (lý do); Xoá luân chuyển; chọn nhóm từng khoản chi; → Trừ lương; ô tích "thu nợ đúng khách" (khi có thu nợ) và "đã xem kỹ khoản từ 300.000" (khi có).
  - **Chênh lệch**: phải có / thực nhận / lệch (≤ 5.000 coi như khớp); Phiếu chênh lệch (trừ lương chọn người bằng ô tích, quán chịu, gán khách trả nợ, ghép ca dư / thiếu, thu khác, chờ Chủ duyệt); Để sau; ô tích "đã hỏi lý do thiếu / thừa" (lệch > 5.000).
  - **Hoàn thành**: danh sách điều quản lý xác nhận khi bấm (ảnh phiếu đúng số máy; không sót khoản thu; khoản chi có thật — khi có chi; két để lại 1.000.000 — khi thu theo ca hoặc ca cuối ngày) + danh sách "Còn thiếu" (mục web tự so chưa xanh, mục cần hỏi chưa tích, lệch chưa xử lý…) bấm vào thì nhảy tới chỗ đó.

### 5.3 Lưu và Tính lại

- **Tích, Để sau, chọn nhóm chi**: lưu ngay, đổi ngay tại chỗ; không tải lại, không cần tính lại.
- **Thao tác làm đổi tiền** (thêm / sửa / xoá phiếu, nợ, khách trả nợ, tiền mặt đếm, Lấy số máy, ca chịu lệch, xử lý lệch…): lưu ngay; dòng / ô vừa sửa hiện ngay; hiện dòng vàng **"Số chưa tính lại"**. Bấm **"Tính lại"**: đọc lại dữ liệu của **riêng ca này** (không tải lại trang, không đọc lại bảng tuần / sổ cả tháng), cập nhật phải có, thực nhận, lệch, các mục web tự so.
- **Hoàn thành luôn tự tính lại** trước khi kiểm, nên quên bấm Tính lại cũng không sai.
- Lưu hỏng: báo ngay tại chỗ, phần khác không mất.

### 5.4 Hoàn thành — luật mới

Một lần bấm, **một giao dịch** trên máy chủ (hỏng ở đâu thì không lưu gì):
1. Kiểm quyền (như trang cũ), tháng chưa chốt, ca chưa Hoàn thành.
2. Tính lại số của ca từ dữ liệu hiện tại.
3. Điều kiện của Xác nhận Fabi cũ **vẫn phải đủ**: có file Fabi và số ngân hàng; tiền mở ca / doanh thu / nợ bill xanh (hoặc số sửa đã được Chủ duyệt); đã nhập tiền mặt khi thu theo ca; không còn số sửa chờ Chủ duyệt / bị từ chối. Thiếu thì báo rõ.
4. Ghi / cập nhật 4 mục tiền của ca theo số mới (như Xác nhận Fabi cũ làm — dùng phần ghi của `app_stc_ds_close` tách thành lõi dùng chung, vì bản cũ chặn khi ca đã xác nhận).
5. Duyệt phần việc (Nhân sự, Bàn giao, Nhập hàng) nếu chưa duyệt. Các việc còn thiếu của phần việc chặn Hoàn thành **như trang cũ** (nhận két lệch chưa xử lý, còn hàng chưa đối soát…), **trừ "Chờ Chủ duyệt x2"** — ca vẫn Hoàn thành được và thành "Đã đối soát" khi Chủ duyệt. Có việc chặn thì báo, quản lý xử lý rồi bấm lại.
6. Tích các ô cơ bản quản lý vừa xác nhận (ảnh phiếu, không sót thu, khoản chi có thật, két để lại — mục nào ca có).
7. Kiểm đủ mọi mục như Hoàn thành cũ (mục cần hỏi người, lệch chưa xử lý, chi chưa có nhóm, nợ khác chưa xếp…) — thiếu thì báo danh sách, không lưu gì.
8. Ghi Hoàn thành; "Đã đối soát" như cũ (khi Chủ đã duyệt x2 nếu có).

Sau Hoàn thành: tự mở ca tiếp theo chưa xong của cùng cơ sở sau ~1,5 giây (có nút "Ở lại ca này"); hết ca thì báo và về bảng tuần.

**Mở lại** (sau Hoàn thành, ghi lý do): bỏ dấu Hoàn thành và 4 mục tiền — ca về "chưa xong", sửa được tự do. Ca đang ở trạng thái "đã Xác nhận Fabi, chưa Hoàn thành" từ trang cũ: trang mới coi như chưa xong, sửa được luôn; Hoàn thành ghi lại 4 mục tiền theo số mới.

### 5.5 Máy chủ (vùng khoá — báo trước anh Tiến)

- **Đọc một ca** (chức năng mới, chỉ đọc): trả đủ dữ liệu một ca cho trang mới (phần việc + phần tiền + dữ liệu để tính các mục kiểm). Phải tính bằng **đúng logic của Sổ thu chi tháng** (`app_stc_month`), không chép lại luật: tách phần lõi thành phần dùng chung có lọc theo ca (ca đó + ca trước / sau cùng ngày để so tiền mở / đóng ca). `app_stc_month` cho kết quả **giống hệt** trước khi tách (bài so mọi cơ sở, mọi tháng, mọi vai). Mục tiêu: mở / tính lại một ca dưới ~0,3 giây ở máy chủ.
- **Sửa tự do trước Hoàn thành**: các chức năng sửa trang mới dùng chỉ chặn khi ca đã Hoàn thành, tháng đã chốt hoặc không đủ quyền. Hiện có hai nhóm phải xử lý:
  - chặn sau khi đã Xác nhận Fabi (`app__stc_ds_need(…, true)`): `app_stc_ds_fabi`, `app_stc_ds_cash`, `app_stc_ds_blame`, `app_stc_ds_blame_undo`, `app_stc_fix_request`, `app_stc_fix_cancel`, `app_stc_fix_decide`;
  - đòi đã Xác nhận Fabi mới làm được: xử lý chênh lệch (`app__stc_gap_need` → các `app_stc_gap_*`), `app_stc_move_exchange`, `app_stc_move_exchange_delete`; người làm rà thêm `app_stc_move_save`, `app__stc_ca_debt_gate`, `app_tc_check`, `app_stc_entry_save`, `app_ca_recon_debt_collect` / `_uncollect`.
  Trang cũ giữ luật cũ ⇒ trang mới dùng **bản theo luật mới** (tách lõi dùng chung: bản cũ = kiểm luật cũ + lõi; bản mới = kiểm luật mới + lõi). Không sửa cách ghi dữ liệu.
- **Hoàn thành mới** và **Mở lại mới**: chức năng mới gói các bước ở 5.4 trong một giao dịch, gọi lại các phần có sẵn (`app_stc_ds_close` phần ghi 4 mục tiền, `app_ca_check`, `app_stc_tick`, `app_stc_ds_done`, `app_stc_ds_reopen` / `app_stc_ds_undone`), không chép lại luật.
- Luật **"mục đã tích tự bỏ khi dữ liệu đổi"** đang nằm ở trigger cơ sở dữ liệu (`stc_fabi_tick`, `stc_debt_tick`, `stc_recon_tick`, `stc_cash_tick`, `stc_result_done`, `stc_treo_undo`) ⇒ áp cho cả hai trang, không làm lại.
- Mọi chức năng mới: `revoke` khỏi `public` / `anon`, `grant` cho `authenticated` như các hàm `app_*` khác; thêm tên vào danh sách vùng khoá trong `CLAUDE.md`.

### 5.6 Hộp thoại dùng lại

Dùng lại các hộp đang có (thêm phiếu, sửa / xoá có lý do, phiếu chênh lệch, sửa số máy, khách trả nợ, xếp nợ, trừ lương…) — đã quen tay, đã có bài thử. Chỉ đổi đoạn "lưu xong thì vẽ lại cả trang" thành "lưu xong thì báo trang mới cập nhật đúng chỗ đó" (gọi lại có tham số, trang cũ giữ cách cũ).

### 5.7 Các đợt (mỗi đợt có kế hoạch riêng, chạy thử đủ rồi mới lên web; phần máy chủ chạy lúc vắng)

1. **Đợt 1 — đọc một ca + trang mới chỉ xem**: tách lõi Sổ thu chi tháng + chức năng đọc một ca (so giống hệt); trang mới hiện đủ các mục, trạng thái, danh sách "Còn thiếu", nút Tính lại; nút qua lại trang cũ / mới (hiện cho mọi người đối soát). Chưa sửa được trên trang mới — đầu trang ghi rõ "Bản xem thử: sửa ở trang cũ".
2. **Đợt 2 — sửa tại chỗ**: tích, Để sau, chọn nhóm, mọi hộp sửa trên trang mới, không tải lại; máy chủ: luật sửa tự do trước Hoàn thành (bản mới của các chức năng ở 5.5).
3. **Đợt 3 — Hoàn thành mới**: Hoàn thành gộp (bỏ Xác nhận Fabi), Mở lại, tự sang ca tiếp theo, màn hình ca khớp hết, nút Duyệt phần việc.
4. **Đợt 4 — chuyển hẳn**: khi anh thấy ổn, trang mới thành mặc định; sau một thời gian bỏ trang cũ (dọn mã, bài thử).

## 6. Kiểm tra

- **So giống hệt** (máy chủ thật, tự hoàn tác): `app_stc_month` trước / sau khi tách lõi — mọi cơ sở, tháng 10–12, vai Chủ / quản lý tổng / từng quản lý (so `open_debts` theo tập hợp như bài t04); dữ liệu một ca của chức năng mới = phần của ca đó trong sổ tháng, mọi ca tháng 11.
- **Máy chủ cục bộ** (Postgres giả lập như các bài `*_cuc_bo.sql`): sửa tự do (được trước Hoàn thành; chặn sau Hoàn thành, tháng chốt, sai quyền, nhân viên); Hoàn thành mới (đủ → xong và "Đã đối soát"; thiếu → báo, không lưu gì; ca "đã xác nhận" từ trang cũ; không tự tích mục cần hỏi người; tích tự bỏ khi dữ liệu đổi vẫn chạy); Mở lại; chạy lại tệp 2 lần.
- **Trình duyệt** (`kiem_tra/trinh_duyet`, máy chủ giả thêm chức năng mới): trang mới — Chủ / quản lý tổng / quản lý × máy tính và điện thoại 390px (không tràn ngang): mở ca, sửa không vẽ lại cả trang (đếm số lần gọi máy chủ mỗi thao tác), dòng "Số chưa tính lại" + Tính lại, Hoàn thành, báo thiếu, tự sang ca, ca khớp hết, qua lại trang cũ.
- **Trang cũ không hỏng**: bộ vùng khoá `flow_ql_tu_ds` (ql, chu × 2 khung), `flow_stc6`, `flow_stc7` (chu / qlt / ql), `flow_dsca`, `flow_tick63`, `flow_stc17` vẫn đạt sau mỗi đợt.
- **Đo**: một ca khớp hết — số lần bấm (mục tiêu 1–2) và số lần gọi máy chủ (không vẽ lại cả trang); một ca có lệch — mỗi lần lưu không quá 1–2 lệnh.

## 7. Triển khai

- Tệp máy chủ mới đánh số tiếp theo khi làm (171 đang dành cho bản sửa Sổ thu chi hoãn, 172 dành cho thiết kế A tạm dừng — người làm xem `app_migrations` và thư mục `supabase/` trước khi đặt số).
- Chạy thử tự hoàn tác trước; chạy thật lúc vắng, cả tệp trong một `begin; … commit;`. Bộ kiểm an toàn trên máy anh Tiến có thể chặn lệnh chạy thật vào vùng tiền đối soát → nhờ anh cho phép hoặc dán vào SQL Editor.
- Máy chủ chạy xong mới đẩy web; tăng `docs/version.json`; ghi `app_releases`; cập nhật `TINH_NANG_DA_CHOT.md`, `CLAUDE.md` (vùng khoá), `BAN_GIAO.md`.
- Quay lại nếu cần: ẩn nút "Dùng trang mới" (trang cũ vẫn chạy luật cũ); chức năng máy chủ mới chỉ thêm, không ai gọi thì không ảnh hưởng.

## 8. Để người làm tự quyết

- Tên đường dẫn, tên tệp, cách chia mã trang mới; tên chức năng máy chủ mới (theo lệ `app_…` / `app__…`).
- Cách tách lõi `app_stc_month` (miễn so giống hệt) và cách lọc ca trước / sau.
- Cách cập nhật tại chỗ sau từng thao tác (sửa dữ liệu trong trang hay đọc lại một phần), miễn không vẽ lại cả trang và không đọc lại bảng tuần / sổ cả tháng.
- Chữ phụ, màu trạng thái, thời gian chờ trước khi tự sang ca.

## 9. Em tự quyết — anh xem có đúng ý không

1. **Một trang dọc, không chia bước** (thay 3 thẻ + 5 bước); mục ổn thu gọn, mục cần xử lý mở sẵn.
2. **Gộp 4 ô tích cơ bản vào nút Hoàn thành** (ảnh phiếu, không sót thu, khoản chi có thật, két để lại); 4 ô cần hỏi người vẫn tích riêng tại chỗ.
3. **Hoàn thành tự duyệt phần việc** khi không có vấn đề; vẫn có nút "Duyệt phần việc" để duyệt riêng.
4. **Tính lại bằng nút** + dòng vàng nhắc; Hoàn thành tự tính lại.
5. **Mở lại sau Hoàn thành bỏ luôn 4 mục tiền** (ca về "chưa xong").
6. **Dùng lại các hộp thoại sẵn có**, chỉ đổi cách cập nhật sau khi lưu.
7. **Nhớ lựa chọn "luôn mở trang mới" theo từng máy**; bảng tuần mở theo lựa chọn đó.
8. **Chia 4 đợt**; đợt 1 chỉ xem để kiểm số trước khi cho sửa.
