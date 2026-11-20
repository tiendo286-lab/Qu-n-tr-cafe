# Đối soát thu chi của ca đi 6 bước — bản thiết kế đầy đủ (bước 171)

Ngày: 20/11/2026 · Người chốt: anh Tiến (qua bản chạy thử, 15 lần sửa trong ngày 20/11).
Bản chạy thử: `work/proposals/doi-soat-thu-chi-tung-buoc.html` · xem trực tiếp https://claude.ai/artifact/QyHZdbGbWA2VbF1fs3vajW
Bản thử là mẫu để nhìn và bấm, số liệu giả. **Không** chép mã bản thử vào web; làm lại bằng mã và kiểu dáng web đang có.

Mục lục: 1 Vì sao · 2 Hiện trạng · 3 Mục tiêu · 4 Cách làm · 5 Sáu bước · 6 Mục kiểm tra · 7 Sửa số máy Fabi, Chủ duyệt · 8 Người nợ · 9 Thêm phiếu trong ca · 10 Trạng thái ca · 11 Quyền · 12 Vùng khoá tiền · 13 Máy chủ · 14 Giao diện · 15 Trường hợp đặc biệt · 16 Kiểm tra · 17 Chia đợt, phát hành · 18 Em tự quyết · 19 Để người làm tự quyết

---

## 1. Vì sao làm

Phần tiền của một ca đang làm ở Sổ thu chi › Đối soát Fabi, trên một trang dài gồm phần A · Fabi và phần B · Thu chi của ca. Trang không nói rõ quản lý phải kiểm tra những gì nên dễ sót, và ca tự thành "đã đối soát" ngay khi bấm xác nhận dù chưa ai xem thu chi. Anh Tiến muốn:

- Đi từng bước, mỗi bước ghi ngay tại chỗ các mục quản lý phải kiểm tra.
- Kiểm tra đủ mới được hoàn thành.
- Số sai thì quản lý sửa được nhưng Chủ phải duyệt.
- Công nợ gọn: ai nợ thì chọn từ danh sách, quản lý xếp đúng nhóm công nợ lúc đối soát.

## 2. Hiện trạng (đã đọc mã ngày 20/11)

- Trang: `docs/js/pages/so_thu_chi.js`, tab `doi-soat`. Mở một ca: `dsBody` → `partA` (① so phiếu với máy: Tiền mở ca / Doanh thu / Nợ; ② tiền thực nhận) → `partB` (Sổ thu / Sổ chi của ca, bảng Tiền mặt / Chuyển khoản, dòng Chênh lệch) → thanh đáy `dsBar` có nút "🔒 Hoàn thành đối soát ca" (thực chất là Xác nhận Fabi, gọi `app_stc_ds_close`).
- Phần tính thuần: `docs/js/so_thu_chi_tinh.js` (`caChecks`, `fabiNeeds`, `dsTodo`, `caStage`, `caGaps`, `caMoney`, `dayChain`).
- Máy chủ: `app_stc_ds_close` (tệp 137) kiểm `app__stc_ds_state` rồi ghi kết quả tiền và gọi `app__ca_auto_finish` → ca tự "Hoàn thành đối soát" nếu phần việc đã xong. `app_stc_ds_reopen` mở lại, không bắt lý do (tệp 143).
- Sổ luôn lấy số máy Fabi. Nhân viên ghi sai thì "Lấy số máy Fabi". Không có cách nào sửa khi máy sai.
- **Người nợ chưa có danh sách riêng.** "Người nợ" chỉ là các tên đang xuất hiện trong bảng `shift_debts`; nút "+ Thêm người nợ" thực ra là ghi một khoản Cho nợ với tên mới. Phiếu nhân viên (`chot_ca_moi.js`, `debtWhoSel` trong `ca_chung.js`) chọn "Khách" rồi gõ tự do "Bàn / tên khách", hoặc chọn một tên thuộc nhóm ② Nợ kho tổng / ③ Nợ khác (`app_ca_debt_people`).
- Khung + Thêm phiếu (`addPanel`): Cho nợ / Thu nợ / Luân chuyển chỉ ghi ngoài ca; chỉ Thu khác / Khoản chi thêm được vào ca (`app_stc_move_save`, lý do bắt buộc).
- Đã có sẵn cách ghi nợ và thu nợ **trong ca** của quản lý: "+ Báo nợ" (tệp 99) và "khách đã trả trong ca" (tệp 86); và cặp khoản đổi tiền trong ca có `exchange_key` ("Khách CK rút tiền mặt").

## 3. Mục tiêu / không làm / tuyệt đối tránh

**Mục tiêu**
1. Mở một ca ở Đối soát Fabi thì đi 6 bước, mỗi lần một bước; máy tính và điện thoại giống nhau.
2. Mỗi bước có khung "Quản lý cần kiểm tra ở bước này". Web lưu ai tích, lúc nào.
3. Số máy Fabi sai thì quản lý sửa được; Chủ bắt buộc duyệt, được từ chối.
4. Phải tích đủ mới bấm được "Hoàn thành đối soát ca"; ca chỉ thành "đã đối soát" sau nút này.
5. Người nợ có danh sách thật; nhân viên và quản lý chỉ chọn từ danh sách; quản lý xếp đúng nhóm công nợ lúc đối soát.
6. Phiếu tạo trong ca thì luôn tính trong ca.

**Không làm lần này**
- Không đổi cách xử lý chênh lệch (phiếu chênh lệch: trừ lương, quán chịu, ghép, gán nợ, ghi Thu khác).
- Không đổi các tab Tổng, Sổ thu, Sổ chi, trừ: ô Người nợ của khung + Thêm phiếu, hộp 👥 Người nợ, và một dòng mới ở Việc cần làm.
- Không đổi lịch chọn ca của tab Đối soát Fabi.
- Không đổi trang Đối soát ca 4 bước phần việc.
- Không đổi Chốt tháng, không đổi ai được vào Sổ thu chi (`app__stc_can` / `app__stc_need`), không đổi `app_can` / `role_permissions`.
- Không sửa lại các khoản nợ cũ đã ghi bằng tên gõ tay.

**Tuyệt đối tránh**
- Quản lý tự đổi được doanh thu / tiền mở ca / nợ bill mà không qua Chủ.
- Ca hiện "đã đối soát" khi còn mục chưa kiểm tra.
- Nhân viên bị kẹt không gửi được phiếu chốt ca vì khách nợ chưa có tên.
- Mất tính năng đang có của phần A / phần B (danh sách ở mục 5).
- Tiền của các ca đã đối soát trước ngày phát hành bị đổi.

## 4. Các cách làm đã cân nhắc

| Cách | Mô tả | Được / mất |
|---|---|---|
| **A. Làm lại ngay trong tab Đối soát Fabi** (chọn) | Khung mở một ca đổi thành 6 bước; đường dẫn, lịch chọn ca, hàm máy chủ đang có giữ nguyên, chỉ thêm phần mới | Ít mã nhất, tiền vẫn làm ở một nơi. Mất: không so được cũ / mới cạnh nhau |
| B. Trang mới chạy song song | Thêm trang riêng, một tuần sau gỡ trang cũ | So được cũ / mới. Mất: hai nơi cùng sửa tiền một ca, gấp đôi bài thử |
| C. Đưa phần tiền về lại trang Đối soát ca | Một trang có cả phần việc lẫn phần tiền | Trái điều anh chốt ở bước 152: Sổ thu chi là chỗ làm tiền duy nhất |

Anh Tiến giao phần "làm thế nào" cho em. Em chọn **A**, và chia làm 4 đợt nhỏ (mục 17) để mỗi đợt thử và phát hành riêng.

## 5. Sáu bước

**Khung chung khi mở một ca**
- Đầu khung: tên ca, người làm ca, giờ gửi phiếu, "File Fabi ✓ / chờ", "Ngân hàng ✓ / chờ", trạng thái ca (mục 10).
- Thanh 6 bước: số + tên. Bước đã xong hiện ✓; bước đã đi qua mà còn thiếu viền vàng; bước đang xem tô đậm. Bấm để nhảy.
- Thanh đáy dính: ‹ Quay lại · "Bước này còn N mục chưa xong" hoặc "✓ Bước này đã xong" · Tiếp ›.
- Bước 3, 4, 5 khoá cho tới khi Xác nhận Fabi: hiện "🔒 Bước này mở sau khi Xác nhận Fabi ở bước 2" + nút "Về bước 2".
- Bước đang xem ghi trên đường dẫn (ví dụ thêm `b=3`) để các nút "Mở ›" / "Xử lý ›" ở Việc cần làm và thẻ dẫn từ trang Đối soát ca mở đúng ca, đúng bước.

### Bước 1 · Số máy Fabi
Hiện:
- Dòng giờ chốt ca + ✎ Sửa giờ chốt (`gio_chot.js`, giữ nguyên). Nút 📷 Ảnh phiếu Fabi.
- 3 ô so sánh, mỗi ô: Phiếu nhân viên / Máy Fabi (ô Tiền mở ca thêm "Ca trước để lại").
  - Giống nhau: xanh "✓ Khớp".
  - Nhân viên ghi khác máy: đỏ + nút **Lấy số máy Fabi** (như hiện nay).
  - Tiền mở ca khác số ca trước để lại: chọn **Ca trước ghi sai / Ca này ghi sai** (như hiện nay).
    - **Tiền giao ca sai thì sửa thế nào, ghi nhận ở đâu** (anh Tiến hỏi 20/11; đây là luật web đang có, bản mới chỉ bày rõ hơn): không sửa số. Quản lý ghi lý do (bắt buộc) rồi chọn ca chịu. Web tạo một dòng **Chênh lệch tiền mặt** đúng bằng số lệch cho ca chịu (thiếu vào Sổ chi, dư vào Sổ thu), hiện ở **bước 5 của ca chịu** để xử lý bằng phiếu chênh lệch. Ca trước chịu → ca này tính tiền từ số thật nhận; ca này chịu → tiền phải có của ca này vẫn tính từ số phải nhận nên bước 5 của ca này lệch thêm đúng số đó. Ô Tiền mở ca ghi rõ ba điều: ca nào chịu, dòng chênh lệch nằm ở đâu, ai chọn + lý do. Có **Huỷ chọn** khi chưa Xác nhận Fabi. Chưa chọn ca chịu thì chưa Xác nhận Fabi được.
    - Máy chủ đang làm (`app_stc_ds_blame`, tệp 133, giữ nguyên): **ca này chịu** → tiền mở ca của ca này trong bản đối soát đặt bằng số phải nhận; **ca trước chịu** → số đếm két của ca trước trong bản đối soát đổi đúng bằng số lệch, ghi nhật ký `ca_sau_bao_lech_mo_ca`. Hiện nay chỉ chọn được "Ca trước ghi sai" khi ca trước Thu cuối ngày.
    - **Đổi luật (anh Tiến chốt 20/11): ca trước Thu theo ca cũng chọn được "Ca trước ghi sai".** Khi đó số quản lý đếm két của ca trước trong bản đối soát giảm / tăng đúng bằng số lệch (ca trước thành thiếu / dư đúng số đó, hiện ở bước 5 của ca trước), ca này tính tiền từ số thật nhận, tiền nộp về quỹ của ca trước không đổi; ghi nhật ký như trường hợp Thu cuối ngày. Lỗi do quản lý đếm két thì ở phiếu chênh lệch của ca trước chọn Quán chịu thay vì trừ lương nhân viên. Chỉ ca đầu ngày (không có ca trước) mới bị khoá nút, ô ghi rõ lý do.
    - Em tự quyết: ca trước đã bấm Hoàn thành mà bị chọn chịu thì **không phải mở lại**, ca trước tự quay về 🟠 Còn lệch cho tới khi dòng chênh lệch mới được xử lý.
  - Mọi ô có thêm nút **Sai, sửa số** (mục 7).
- Khung **Nợ của ca** (chỉ khi ca có nợ mới): mỗi khoản một dòng — nhãn HĐ / TM / CK, người nợ, nội dung nhân viên ghi, số tiền; 3 nút nhóm công nợ **Nợ khách hàng / Nợ kho tổng / Nợ khác**; ô chọn **Người nợ** (mục 8). Dưới đó là "Khách trả nợ cũ trong ca" (chỉ xem, như hiện nay).
- Cảnh báo hoá đơn bị sửa / xoá trên máy (như hiện nay).
- Dòng "Chưa có file Fabi: …" khi chờ kế toán.

### Bước 2 · Tiền thực nhận
Hiện:
- Hai nút **Thu theo ca / Thu cuối ngày** (`app_ca_cash_mode`).
- Thu theo ca, hoặc ca cuối ngày của Thu cuối ngày: ô "Quản lý đếm két" + Lưu.
- Thu cuối ngày, không phải ca cuối: không có ô đếm; dòng "Két chuyển nguyên sang ca sau: tiền đóng ca này X · tiền mở ca sau Y" kèm "✓ Bằng nhau" hoặc đỏ "Lệch …".
- Bảng 3 dòng × 2 cột (Tiền mặt, Chuyển khoản): Phải có – Thực nhận – Lệch. Dòng giải thích phép tính "Phải có".
- Khung **"Số ở bước này sai thì sửa ở đâu"** (anh Tiến hỏi 20/11): "Phải có" sai → không sửa tay, sửa ở bước 1 / 3 / 4 (có nút nhảy tới), số tự tính lại; tiền mặt thực nhận sai → đếm lại, sửa ô đếm (đã Xác nhận Fabi thì Mở lại xác nhận trước); chuyển khoản thực nhận sai → kế toán nhập lại số ngân hàng, quản lý không sửa ở đây; chọn nhầm cách thu → bấm lại.
- Khung **Xác nhận Fabi**: nút + dòng "Còn thiếu: …" liệt kê từng điều kiện, bấm nhảy tới chỗ cần làm. Đã xác nhận: "✓ Đã xác nhận Fabi" + **Mở lại xác nhận** (không bắt lý do).

Điều kiện bấm Xác nhận Fabi = điều kiện hiện nay (không còn ô đỏ ở bước 1, có file Fabi và số ngân hàng, đã nhập tiền mặt nếu phải nhập) **cộng thêm**: không còn số sửa đang chờ Chủ hoặc bị Chủ từ chối.

### Bước 3 · Khoản thu
- Nút **+ Thêm phiếu thu** (mục 9).
- Hai dòng khoá "Bán hàng · tiền mặt" và "Bán hàng · chuyển khoản" (theo máy Fabi hoặc số Chủ đã duyệt).
- Từng phiếu thu của ca: nội dung, nhãn Tiền mặt / Chuyển khoản, nhãn **Nhân viên ghi** / **Quản lý ghi** (phiếu quản lý ghi kèm lý do), số tiền, các nút đang có (sửa, xoá, khôi phục, ghi chú sửa).
- Dòng tổng thu theo Tiền mặt / Chuyển khoản. Khung "Nợ bill của ca (chưa phải tiền)".

### Bước 4 · Khoản chi
- Nút **+ Thêm phiếu chi** (mục 9), nút Phiếu chi chuyển khoản.
- Từng phiếu chi: như bước 3, thêm hàng nút chọn **nhóm** (bấm một lần), nhãn đỏ "Chưa chọn nhóm", nhãn vàng **Khoản lớn** cho khoản từ 300.000, các nút Sửa / → Trừ lương / Xoá.
- Dòng tổng chi theo Tiền mặt / Chuyển khoản.

### Bước 5 · Chênh lệch
- Một khung cho Tiền mặt, một khung cho Chuyển khoản: "✓ Khớp" (kể cả lệch ≤ 5.000), hoặc "Thiếu / Thừa X" + nút mở **phiếu chênh lệch đang có** để chọn cách xử lý + nút **Để sau**.
- Thu cuối ngày, không phải ca cuối: khung Tiền mặt ghi "Tính ở ca cuối ngày".
- Số lệch ở bước này **luôn là số đã tính lại** theo dữ liệu mới nhất (số bước 1 kể cả số Chủ đã duyệt, tiền đếm két, mọi phiếu thu chi kể cả phiếu vừa thêm, nợ tiền mặt / chuyển khoản của ca); mỗi khung ghi rõ phép tính "lệch = thực nhận − phải có". **Số lệch đổi sau khi đã chọn cách xử lý** → báo rõ số cũ, số mới và bắt chọn lại (người làm kiểm tra trước web đang xử lý phiếu chênh lệch thế nào khi số lệch đổi, giữ đúng cách đó ở máy chủ; giao diện chỉ thêm dòng báo).
- Ô **Lý do thiếu / thừa** (khi có lệch > 5.000). Dòng "Gồm:" và Ghi chú đối soát như hiện nay.

### Bước 6 · Hoàn thành
- Bảng tóm tắt 5 bước: "xong" hoặc "còn N mục ›" (bấm nhảy tới).
- Nút **🔒 Hoàn thành đối soát ca**. Chưa đủ thì mờ, ghi "Còn N mục chưa kiểm tra".
- Đã hoàn thành: "🟢 Đã hoàn thành đối soát ca" hoặc "🟠 Đã đối soát, còn lệch chờ xử lý / chờ Chủ duyệt"; nút **Mở lại** và **Ca tiếp theo ›**.

**Tính năng đang có phải giữ:** ✎ Sửa giờ chốt, 📷 ảnh, Lấy số máy Fabi, Ca trước / Ca này ghi sai + Huỷ chọn, danh sách nợ của ca với ngày / ca trả, cảnh báo hoá đơn sửa / xoá, Thu theo ca / theo ngày, Mở lại xác nhận, + Thêm phiếu, sửa / xoá / khôi phục phiếu, ghi chú sửa (bước 120), → Trừ lương / Bỏ chuyển, Phiếu chi chuyển khoản, phiếu chênh lệch, dòng "Gồm:", Ghi chú đối soát; điện thoại không tự mở ca, thanh "‹ Chọn ca khác"; ca chờ kế toán; tháng đã chốt chỉ xem; Quỹ ngoài (`D.ext`) không có nút sửa; "Xem như người khác" chỉ xem.

## 6. Mục kiểm tra

"Tự" = web tự tích khi đủ điều kiện, quản lý không bấm được. "Tay" = quản lý bấm để tích / bỏ tích; web lưu ai, lúc nào. Mỗi mục có số thứ tự trong bước; số đó đặt cạnh đúng chỗ cần xem trên màn hình.

| Bước | Mã | Mục | Loại | Hiện khi | Xong khi |
|---|---|---|---|---|---|
| 1 | `mo` | Tiền mở ca khớp tiền ca trước để lại | tự | luôn | ô Tiền mở ca xanh và không có số sửa chưa duyệt |
| 1 | `dt` | Doanh thu trên phiếu khớp máy Fabi | tự | luôn | ô Doanh thu xanh và không có số sửa chưa duyệt |
| 1 | `no` | Nợ bill trên phiếu khớp máy Fabi | tự | luôn | ô Nợ bill xanh và không có số sửa chưa duyệt |
| 1 | `phanloai` | Mọi khoản nợ của ca đã xếp đúng nhóm công nợ | tự | ca có nợ mới | mọi khoản đã được quản lý chọn nhóm và không còn khoản đứng tên "Nợ khách (chung)" |
| 1 | `hd` | Đã hỏi về hoá đơn bị sửa / xoá trên máy | tay | ca có hoá đơn bị sửa / xoá | đã tích |
| 1 | `anh` | Ảnh phiếu Fabi in cuối ca đúng với số máy | tay | luôn (không có ảnh thì ghi "nhân viên không gửi ảnh") | đã tích |
| 2 | `cash` | Đã đếm két và nhập tiền mặt thực nhận | tự | Thu theo ca, hoặc ca cuối ngày | đã nhập |
| 2 | `ck` | Chuyển khoản đã có số ngân hàng | tự | luôn | kế toán đã nhập |
| 2 | `goi` | Két để lại đúng 1.000.000 cho ca sau | tay | Thu theo ca, hoặc ca cuối ngày | đã tích |
| 2 | `ket` | Tiền đóng ca này bằng tiền mở ca sau | tự | Thu cuối ngày, không phải ca cuối | hai số bằng nhau (ca sau chưa gửi phiếu thì chờ; lệch thì xử lý ở ô Tiền mở ca của ca sau) |
| 2 | `fabi` | Đã Xác nhận Fabi | tự | luôn | đã xác nhận |
| 3 | `tn` | Thu nợ đúng khách, đúng tiền mặt / chuyển khoản | tay | ca có thu nợ | đã tích |
| 3 | `sot` | Không sót khoản thu ngoài bán hàng | tay | luôn | đã tích |
| 4 | `cat` | Mọi khoản chi đã chọn nhóm | tự | luôn | không còn khoản chi chưa có nhóm |
| 4 | `that` | Khoản chi có thật, đúng số tiền | tay | ca có khoản chi | đã tích |
| 4 | `lon` | Đã xem kỹ khoản từ 300.000 trở lên | tay | ca có khoản chi ≥ 300.000 | đã tích |
| 5 | `tm` | Tiền mặt lệch đã chọn cách xử lý | tự | luôn | khớp, lệch ≤ 5.000, đã chọn cách xử lý, hoặc đã bấm Để sau |
| 5 | `ck5` | Chuyển khoản lệch đã chọn cách xử lý | tự | luôn | như trên |
| 5 | `ld` | Đã hỏi người làm ca lý do thiếu / thừa | tay | có lệch > 5.000 | đã tích |

**Mục tay tự bỏ tích khi dữ liệu đổi** (để dấu tích luôn đúng với thứ quản lý đã nhìn): thêm / sửa / xoá phiếu thu → bỏ `tn`, `sot`; phiếu chi → bỏ `that`, `lon`; đổi tiền mặt quản lý đếm hoặc cách thu → bỏ `goi`; số lệch đổi → bỏ `ld`; kế toán tải lại file Fabi → bỏ `hd`, `anh`.

## 7. Sửa số máy Fabi, Chủ duyệt

1. Phiếu giống máy → web tự tích, quản lý không làm gì.
2. Nhân viên ghi sai, máy đúng → **Lấy số máy Fabi** (như hiện nay, không cần Chủ).
3. Máy cũng sai → quản lý bấm **Sai, sửa số** ở ô đó: ghi số đúng + lý do (bắt buộc) → **Gửi Chủ duyệt**.
   - Ô Tiền mở ca: 1 số. Ô Nợ bill: 1 số. Ô Doanh thu: **2 số**, bán tiền mặt và bán chuyển khoản (doanh thu = tiền mặt + chuyển khoản + nợ bill).
4. Đang chờ: ô vàng "Quản lý sửa thành X · chờ Chủ duyệt", kèm lý do. Quản lý bấm **Bỏ sửa** được. Chủ nhận thông báo.
5. **Chủ duyệt** → ô xanh "✓ Chủ đã duyệt số X"; từ đó tiền của ca tính theo số này thay số máy. Màn hình luôn hiện cả số máy lẫn số đã duyệt.
6. **Chủ từ chối** (ghi được lý do) → ô đỏ "✗ Chủ từ chối số X". Quản lý nhận thông báo, chọn: **Sửa lại số** (gửi lần nữa) hoặc **Bỏ sửa, lấy số máy Fabi**.
7. Số sửa đang chờ hoặc bị từ chối → mục kiểm tra của ô đó chưa tích, **Xác nhận Fabi bị chặn**, bước 3, 4, 5 chưa mở.
8. Chủ tự sửa số → coi như đã duyệt ngay.
9. Chủ duyệt / từ chối ở hai nơi: ngay trong bước 1 của ca (chỉ Chủ thấy 2 nút), và dòng "Số sửa chờ Chủ duyệt" ở tab Tổng › Việc cần làm.
10. Chỉ sửa số được khi ca chưa Xác nhận Fabi. Đã xác nhận thì phải Mở lại xác nhận trước. Bỏ số Chủ đã duyệt: chỉ Chủ.
11. Mọi lần gửi / bỏ / duyệt / từ chối ghi vào lịch sử (ai, lúc nào, số cũ, số mới, lý do).

## 8. Người nợ

1. **Danh sách người nợ thật** cho từng cơ sở: tên, số điện thoại, nhóm (Nợ khách hàng / Nợ kho tổng / Nợ khác), còn dùng hay không. Hộp 👥 Người nợ ở Sổ chi đổi nút "+ Thêm người nợ" thành khung thêm người thật (tên, SĐT, nhóm) thay vì mở phiếu Cho nợ; sửa tên / SĐT / nhóm, ngừng dùng một người. "Kho tổng" luôn có.
2. Danh sách ban đầu lấy từ các tên đang có trong sổ: mọi tên nhóm kho tổng / nợ khác, và các tên nhóm khách hàng **đang còn nợ**.
3. **Mọi chỗ ghi nợ mới chỉ chọn người trong danh sách**, không gõ tên: phiếu chốt ca của nhân viên, "+ Báo nợ" của quản lý, + Thêm phiếu › Cho nợ. Ô chọn tìm được theo tên không dấu. Máy chủ từ chối tên không có trong danh sách.
4. **Khách chưa có tên**: nhân viên chọn **"Nợ khách (chung)"** và ghi nội dung để nhận ra khách. "Nợ khách (chung)" chỉ có trong ô chọn của nhân viên; quản lý ghi nợ thì phải chọn người thật.
5. **Phiếu chốt ca của nhân viên**: mỗi khoản nợ gồm loại TM / CK / HĐ (giữ như hiện nay, nên cách tính tiền của phiếu không đổi), số tiền, **khách** (chọn), **nội dung** (bắt buộc, thay cho ô "Bàn / tên khách" gõ tự do), ghi chú SĐT / hẹn trả (không bắt buộc). Nhân viên chỉ thấy tên, không thấy ai đang nợ bao nhiêu ngoài phần "nhắc thu nợ khách hàng" đang có.
6. **Quản lý phân loại đúng công nợ lúc đối soát** (khung Nợ của ca, bước 1): với từng khoản nợ mới của ca, quản lý chọn nhóm công nợ và, nếu cần, đổi người nợ sang đúng người trong danh sách (người chưa có thì thêm ở 👥 Người nợ trước). Web gợi ý nhóm đang có của người đó nhưng quản lý vẫn phải bấm chọn. Khoản đứng tên "Nợ khách (chung)" bắt buộc phải đổi sang người thật. Khoản đã trả thì không đổi được.
7. Phân loại nợ **không chặn Xác nhận Fabi** (nhóm nợ không đổi tiền của ca) nhưng chặn Hoàn thành qua mục `phanloai`.
8. Nợ cũ đã ghi bằng tên gõ tay giữ nguyên; tab Công nợ và Ai còn nợ vẫn gộp theo tên như hiện nay.

## 9. Thêm phiếu trong ca

1. Khung + Thêm phiếu ở bước 3 / bước 4 giữ đủ ô của web đang có: Loại · Tiền (hoặc Chiều với Luân chuyển) · Ngày · Ca · Nội dung (hoặc Người nợ / Khách trả nợ) · Số tiền · Nhóm · Lý do · Lưu phiếu · Huỷ.
2. **Ngày và Ca khoá sẵn đúng ca đang đối soát**, không đổi được.
3. **Phiếu tạo trong ca thì luôn tính trong ca**, kể cả Cho nợ / Thu nợ / Luân chuyển quỹ:
   - Cho nợ: tiền phải có của ca giảm (tiền mặt hoặc chuyển khoản theo ô Tiền).
   - Thu nợ: tiền phải có tăng. Chỉ hiện nợ phát sinh trước ca này (luật bước 168); không ghi quá số còn nợ; đưa thiếu thì phần còn thiếu thành nợ mới (luật bước 159).
   - Luân chuyển: một bên giảm, bên kia tăng đúng số đó.
4. Lý do **bắt buộc** với mọi loại. Phiếu chi ngoài loại Khoản chi không cần nhóm.
5. Phiếu thêm ở đây mang nhãn **Quản lý ghi** kèm lý do, có nút xoá theo quyền đang có.
6. Khung + Thêm phiếu ở tab Sổ thu / Sổ chi **giữ như hiện nay** (chọn ngày, ca; Cho nợ / Thu nợ / Luân chuyển ghi ngoài ca), chỉ đổi ô Người nợ thành ô chọn.

## 10. Trạng thái ca

| Trạng thái | Khi nào |
|---|---|
| ⏳ Chờ kế toán | chưa có file Fabi hoặc số ngân hàng |
| 🔴 tên ô còn đỏ | bước 1 còn ô đỏ |
| 🟠 Chờ Chủ duyệt số sửa | có số sửa đang chờ; hoặc "✗ Chủ từ chối" khi bị từ chối |
| 🟡 Chờ xác nhận Fabi | đủ điều kiện, chưa bấm |
| 🔵 Đã xác nhận Fabi · còn N mục | đã xác nhận, chưa bấm Hoàn thành |
| 🟠 Còn lệch / Chờ Chủ duyệt | đã bấm Hoàn thành, còn lệch chưa xử lý xong |
| 🟢 Hoàn thành | đã bấm Hoàn thành và hết lệch |

Lịch chọn ca, Việc cần làm ở tab Tổng, thẻ "Phần tiền" ở trang Đối soát ca dùng chung bảng này. Việc cần làm thêm: "Ca đã xác nhận Fabi, chưa hoàn thành" và "Số sửa chờ Chủ duyệt".

## 11. Quyền

| Việc | Ai làm được |
|---|---|
| Tích mục, phân loại nợ, thêm / sửa phiếu, Lấy số máy Fabi, gửi sửa số, bỏ sửa của mình, Xác nhận Fabi, Mở lại, Hoàn thành, thêm / sửa người nợ | người vào được Sổ thu chi của cơ sở đó (`app__stc_need`): Chủ, Quản lý tổng, quản lý được giao |
| Duyệt / từ chối số sửa; bỏ số đã duyệt | chỉ Chủ |
| Chọn khách nợ trên phiếu chốt ca | nhân viên có quyền `chot_ca` của cơ sở (chỉ đọc tên) |
| Xem như người khác | chỉ xem |
| Tháng đã chốt | mọi người chỉ xem |

Không thêm quyền mới vào `role_permissions`.

## 12. Phần đụng vùng khoá tiền đối soát — báo anh Tiến trước khi làm

| Sửa gì | Vì sao | Ảnh hưởng |
|---|---|---|
| `app_stc_ds_close`: thêm điều kiện không còn số sửa chờ / bị từ chối; bỏ lời gọi `app__ca_auto_finish` ở đây | mục 7.7, mục tiêu 4 | Xác nhận Fabi không còn làm ca "đã đối soát" |
| Số Chủ đã duyệt thay số máy Fabi khi tính tiền của ca (`app__stc_ds_state`, `app__ca_money`, `app_stc_month`) | mục 7.5 | **Đổi cách tính tiền**: trước giờ sổ luôn lấy số máy |
| Hàm duyệt số sửa chỉ Chủ gọi được | mục 7 | hàm mới |
| `app__ca_auto_finish` chỉ cho ca thành "Đã đối soát" khi đã bấm Hoàn thành ở bước 6 | mục tiêu 4 | Bảng tuần Đối soát, Việc hôm nay, thẻ Phần tiền thấy ca "chưa xong" lâu hơn |
| `app_stc_ds_blame`: bỏ chặn "ca trước Thu theo ca", cho chọn Ca trước ghi sai | mục 5, bước 1 | **Đổi luật tiền giao ca**: ca trước Thu theo ca có thể bị ghi thiếu / dư sau khi quản lý đã đếm |
| Cho nợ / Thu nợ / Luân chuyển tạo trong ca được tính vào tiền của ca | mục 9.3 | **Đổi cách tính tiền của ca** với phiếu mới; phải giữ khoá thứ tự thu nợ (tệp 147) và trả nợ một lần (tệp 142) |

Không sửa: `app_can`, `role_permissions`, `app__stc_can` / `app__stc_need`, `app__ca_auto_ok`, `app_ca_recon_apply`, `app_ca_auto_locks`, `app__ca_locked_items`, `app__ca_locked_fields`.

Sửa xong phải chạy đạt: `flow_ql_tu_ds` (ql và chu; `index.html` và `test/phone.html`), `flow_stc6`, `flow_stc7` (chu / qlt / ql). Đổi quyền ở máy chủ thì dò cả giao diện (bài học bước 129).

## 13. Máy chủ

Số thứ tự tệp: xem `select max(file) from app_migrations` (hiện tới 149). Mỗi đợt một tệp. Tệp viết chạy lại nhiều lần không lỗi, dòng cuối ghi `app_migrations`. Bảng mới không cấp quyền cho `anon` / `authenticated`. Chạy thử trong khối `DO … RAISE EXCEPTION 'REPORT>> %'` trước khi chạy thật.

**Bảng mới**
- `debt_people`: cơ sở, tên (không trùng trong một cơ sở, so không phân biệt hoa thường), SĐT, nhóm `khach | kho | khac`, còn dùng, người tạo, lúc tạo.
- `shift_debts` thêm: liên kết tới `debt_people` (trống = "Nợ khách (chung)" hoặc nợ cũ), nội dung, quản lý đã phân loại (ai, lúc nào).
- `stc_ca_ticks`: ca, mã mục, ai, lúc nào. Dùng cho các mục tay và dấu "Để sau" của lệch (`sau_tm`, `sau_ck`).
- `stc_fix_requests`: ca, ô `mo | dt | no`, số cũ, số mới (ô `dt` có 2 số), lý do, trạng thái `cho | duyet | tu_choi | bo`, người gửi, lúc gửi, người quyết, lúc quyết, lý do từ chối. Mỗi ô của một ca chỉ một yêu cầu `cho` hoặc `duyet` còn hiệu lực.
- `stc_ca_done`: ca, ai, lúc nào.

**Hàm mới** (đều kiểm `app__stc_need` của cơ sở, trừ khi ghi khác)
- Người nợ: lấy danh sách (mở rộng `app_ca_debt_people` trả cả nhóm khách hàng, kèm mã người); thêm / sửa / ngừng dùng; `app_stc_debt_sort(khoản nợ, người, nhóm)` đặt người + nhóm + dấu đã phân loại, chỉ với khoản chưa trả.
- `app_stc_tick(ca, mã mục, bật / tắt)`: chỉ nhận mã mục tay; từ chối khi tháng đã chốt.
- `app_stc_fix_request`, `app_stc_fix_cancel`, `app_stc_fix_decide` (chỉ Chủ). Gửi thông báo bằng `app__notify`, ghi `app_log`.
- `app_stc_ds_done(ca)`: máy chủ **tự kiểm lại đủ mọi điều kiện ở mục 6** (không tin giao diện) rồi ghi `stc_ca_done` và gọi `app__ca_auto_finish`. `app_stc_ds_undone(ca)`: bỏ dấu, đưa ca về "đã xác nhận Fabi".

**Hàm đang có phải sửa**
- `app_stc_ds_close`, `app__ca_auto_finish`, `app__stc_ds_state`, `app__ca_money`: theo mục 12.
- `app_stc_ds_reopen`: bỏ luôn dấu Hoàn thành.
- `app_stc_month`: mỗi ca trả thêm mục đã tích, yêu cầu sửa số, dấu hoàn thành, khoản nợ kèm người / nhóm / nội dung / đã phân loại, và ai ghi từng phiếu. **Lưu ý:** hàm này đang được vá bằng thay chuỗi (tệp 136, 139, 140) — định nghĩa lại phải giữ kiểm tra `app__stc_can`.
- Các đường ghi nợ mới (lưu phiếu chốt ca, "+ Báo nợ" tệp 99, `app_stc_debt_save`): từ chối tên ngoài danh sách; nhận nội dung.
- Các hàm thêm / sửa / xoá phiếu của ca, đổi tiền mặt đếm, `app__fabi_apply`: bỏ tích các mục tay liên quan (mục 6); khi ca đã Hoàn thành thì từ chối thêm / sửa / xoá phiếu ("Mở lại trước"). `app__fabi_apply` phải giữ các đoạn "bước 162" và vá 135; tải lại file không xoá số Chủ đã duyệt.
- Cho nợ / Thu nợ / Luân chuyển trong ca: **ưu tiên dùng lại cách ghi trong ca đang có** — nợ mới trong ca kiểu mượn tiền mặt / nợ chuyển khoản (đường "+ Báo nợ", tệp 99), khách trả nợ trong ca (tệp 86), cặp khoản đổi tiền có `exchange_key` cho Luân chuyển — để `app__ca_money` không phải đổi công thức. Người làm phải đọc tệp 82, 86, 98, 99 xác nhận hướng này trước; nếu không dùng lại được mới thêm tham số ca cho `app_stc_debt_save` / `app_stc_collect` / `app_stc_transfer_save`.

**Chạy bù khi phát hành**
- `debt_people` điền từ tên đang có (mục 8.2).
- Ca đã xác nhận Fabi trước ngày phát hành: ghi sẵn `stc_ca_done`, coi mọi khoản nợ của các ca đó là đã phân loại.

## 14. Giao diện

- `docs/js/pages/so_thu_chi.js`: `dsBody`, `partA`, `partB`, `dsBar` viết lại thành 6 bước; `addPanel` nhận thêm chế độ "trong ca" (khoá ngày, ca; mọi loại vào ca); `peopleDialog` thêm khung người nợ thật.
- `docs/js/so_thu_chi_tinh.js`: thêm hàm thuần trả danh sách mục kiểm tra của một ca theo bảng mục 6 (đầu vào là dữ liệu ca, đầu ra từng bước có mục nào, xong chưa) để thử bằng `jsc`; `fabiNeeds` thêm điều kiện số sửa; `caStage` theo bảng mục 10; hằng `BIG = 300000` cạnh `FLOAT`.
- `docs/js/chot_ca_moi.js`, `docs/js/ca_chung.js` (`debtWhoSel`): ô chọn khách có tìm kiếm, mục "Nợ khách (chung)", ô Nội dung bắt buộc, dòng nhắc "Khách chưa có tên thì chọn Nợ khách (chung), quản lý sẽ xếp lại".
- `docs/js/doi_soat_tc.js` / chỗ "+ Báo nợ" của quản lý: ô chọn người nợ.
- Trang Đối soát ca (`phieu_ca.js`): thẻ "Phần tiền" hiện trạng thái mới và mở đúng bước. Không đổi gì khác trong tệp này.
- Màu, chữ, nút theo `docs/assets/style.css`. Mục kiểm tra: khung vàng (màu cảnh báo đang có), số trong chấm tròn, xong thì chấm xanh ✓.
- Điện thoại 390px không tràn ngang. Thanh 6 bước trên điện thoại chỉ hiện số, kèm tên bước đang xem. Khung + Thêm phiếu xếp nhiều hàng.
- Tăng `?v=` của các tệp JS đã sửa theo cách web đang làm.

## 15. Trường hợp đặc biệt

| Tình huống | Xử lý |
|---|---|
| Ca chờ kế toán | bước 1, 2 chỉ xem được số nhân viên; không Xác nhận Fabi; như hiện nay |
| Ca sau chưa gửi phiếu (Thu cuối ngày) | mục `ket` chờ; ca chưa Hoàn thành được |
| Kế toán tải lại file Fabi sau khi quản lý đã gửi sửa số | yêu cầu sửa giữ nguyên, màn hình hiện số máy mới; số Chủ đã duyệt vẫn có hiệu lực |
| Ca đã Hoàn thành, cần sửa phiếu | bấm Mở lại ở bước 6 (bỏ dấu Hoàn thành, giữ các mục đã tích trừ mục bị bỏ theo mục 6) |
| Ca đã Hoàn thành, còn lệch chờ | phiếu chênh lệch vẫn xử lý / Chủ vẫn duyệt được; xong thì ca tự chuyển 🟢 |
| Mở lại xác nhận Fabi | bỏ dấu Hoàn thành; giữ mục tay; số Chủ đã duyệt giữ nguyên |
| Ca không có nợ / không có khoản chi / không lệch | các mục liên quan không hiện |
| Khoản nợ đã trả | không đổi người / nhóm; coi như đã phân loại |
| Người nợ bị ngừng dùng | không còn trong ô chọn; nợ đang có vẫn hiện bình thường |
| Tháng đã chốt | mọi bước chỉ xem, không tích được |
| Quỹ ngoài | không áp dụng 6 bước sửa; như hiện nay |
| Hai người cùng mở một ca | máy chủ là chuẩn: thao tác sau bị từ chối nếu điều kiện không còn đúng, giao diện tải lại số mới |

## 16. Kiểm tra

- **Máy chủ** (`kiem_tra/*.sql`, chạy trên Supabase giả lập): người nợ (thêm, trùng tên, từ chối tên ngoài danh sách, Nợ khách chung); tích mục (đúng mã, tự bỏ khi dữ liệu đổi); sửa số (gửi, bỏ, duyệt, từ chối, theo vai; chặn Xác nhận Fabi; tiền tính theo số đã duyệt); hoàn thành (thiếu mục thì từ chối, đủ thì ghi, mở lại); phiếu trong ca (Cho nợ / Thu nợ / Luân chuyển đổi đúng tiền phải có).
- **So cũ / mới:** với các ca đã đối soát của tháng đang mở, tiền phải có / thực nhận / lệch trước và sau khi chạy tệp SQL phải giống hệt (cách so như `kiem_tra/toc_do/t01…`, dùng repeatable read).
- **Tính thuần:** bài `jsc -m` mới cho hàm mục kiểm tra (Thu theo ca / Thu cuối ngày / ca cuối ngày; có và không có nợ, chi, lệch) và `caStage`.
- **Trình duyệt** (máy tính + điện thoại 390px), bài mới `flow_ds171`: đi hết 6 bước với vai ql, qlt, chu; tích đủ mới hoàn thành; quản lý sửa số → bị chặn → Chủ từ chối → sửa lại → Chủ duyệt → đi tiếp; Thu cuối ngày tự so; thêm phiếu đủ 6 loại và tiền đổi đúng; phân loại nợ, Nợ khách (chung).
- **Sửa cho đúng giao diện mới, không tắt, không nới:** `flow_stc1`, `flow_stc4`, `flow_stc6`, `flow_stc7`, `flow_ds156`, `flow_ds168`, `flow_gio162`, `flow_ql_tu_ds`, `flow_cm84`, `flow_cn95`. Bộ giả lập `stc_gia.js`, `stc_fixture.js`, `ca_gia.js`, `fin_gia.js` thêm dữ liệu và hàm mới.
- Bài thử phải **báo lỗi trên bản cũ** trước khi sửa (bài học bước 129).

## 17. Chia đợt và phát hành

Mỗi đợt: một nhánh, một tệp SQL, bài thử riêng, một lần phát hành. Thứ tự:

| Đợt | Nội dung | Đụng vùng khoá |
|---|---|---|
| 1 | Người nợ: danh sách thật, chỉ chọn tên có sẵn, Nợ khách (chung), ô Nội dung trên phiếu nhân viên (mục 8.1–8.5) | không |
| 2 | 6 bước + mục kiểm tra + nhãn ai ghi + khoản lớn + Thu cuối ngày tự so + phân loại nợ ở bước 1 + nút Hoàn thành bắt tích đủ (mục 5, 6, 8.6, 10) | có: `app_stc_ds_close`, `app__ca_auto_finish`, `app_stc_ds_blame` |
| 3 | Sửa số máy Fabi + Chủ duyệt / từ chối (mục 7) | có: đổi cách tính tiền theo số đã duyệt |
| 4 | Thêm phiếu trong ca: khoá ngày, ca; Cho nợ / Thu nợ / Luân chuyển tính vào ca (mục 9) | có: tiền của ca |

Mỗi lần phát hành: chạy SQL lên Supabase trước (thử rồi chạy thật) → tăng `docs/version.json` → anh Tiến đẩy `main` → ghi `app_releases` → cập nhật `TINH_NANG_DA_CHOT.md` (mục Sổ thu chi, bước 171) và `BAN_GIAO.md`.

## 18. Em tự quyết (anh xem, sai thì sửa)

1. Sửa Doanh thu ghi 2 số: bán tiền mặt, bán chuyển khoản (mục 7.3).
2. Chủ tự sửa số thì không cần duyệt lại (mục 7.8). Chỉ Chủ bỏ được số đã duyệt.
3. Chủ duyệt ở bước 1 của ca và ở Việc cần làm (mục 7.9).
4. Mục tay chỉ hiện khi có việc để kiểm (cột "Hiện khi" ở mục 6).
5. Mục tay tự bỏ tích khi dữ liệu liên quan đổi (cuối mục 6).
6. Lệch chưa xử lý xong vẫn Hoàn thành được nếu đã chọn cách xử lý hoặc bấm Để sau; ca 🟠 tới khi xong.
7. Ca đã Hoàn thành thì khoá thêm / sửa / xoá phiếu; muốn sửa bấm Mở lại.
8. Mức khoản lớn 300.000.
9. Ca đã xác nhận Fabi trước ngày phát hành coi như đã hoàn thành.
10. Danh sách người nợ ban đầu: nhóm kho tổng / nợ khác lấy hết; nhóm khách hàng chỉ lấy tên đang còn nợ.
11. Phân loại nợ không chặn Xác nhận Fabi, chỉ chặn Hoàn thành.
12. Làm thành 4 đợt theo thứ tự ở mục 17.

## 19. Để người làm tự quyết

Tên cột, kiểu dữ liệu, tên hàm cụ thể; số đã duyệt thay số máy bằng ghi đè có lưu số gốc hay tính chồng lúc đọc; nội dung khoản nợ dùng cột mới hay cột `note` đang có; cách ô chọn khách tìm kiếm trên điện thoại; chữ cụ thể của từng dòng hướng dẫn (theo bản thử); tên tham số bước trên đường dẫn.
