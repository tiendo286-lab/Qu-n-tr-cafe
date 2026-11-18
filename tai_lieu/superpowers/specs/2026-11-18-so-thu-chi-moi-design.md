# Sổ thu chi mới — thay Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ và phần tiền của Đối soát ca

Ngày: 18/11/2026 · Người chốt: anh Tiến (chủ hệ thống) · Mẫu bấm thử: https://claude.ai/artifact/6L53uqto8BgLHgBSLh744E (số giả)

## 1. Vì sao làm

Bây giờ tiền của mỗi cơ sở nằm rải ở 5 nơi: Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ và phần tiền của Đối soát ca. Anh Tiến muốn **một trang duy nhất**. Ở trang đó:
- mỗi đồng tiền vào hoặc ra hiện thành một dòng;
- với từng loại tiền (tiền mặt / chuyển khoản), **Tổng thu − Tổng chi = tiền thật vào quỹ**;
- tồn quỹ tự đúng, không cần sổ quỹ riêng.

**Thành công khi:**
- Chạy song song trang cũ một thời gian thì số khớp.
- Quản lý đối soát và sửa tiền ở đúng một chỗ.
- Sau đó gỡ được 4 trang cũ và phần tiền của Đối soát ca.

**Không làm:**
- Đổi phiếu chốt ca của nhân viên.
- Đổi cách tính Chốt tháng. Chỉ đổi nguồn: phiếu rút được thay bằng "Chuyển về Quỹ ngoài".
- Đổi phần việc của Đối soát ca (Ai làm ca, Nghỉ & làm thay, Bàn giao).

**Coi là thất bại dù vẫn chạy được, nếu:**
- Số tiền trang mới khác trang cũ mà không giải thích được.
- Quản lý phải nhập cùng một số ở hai nơi.
- Dữ liệu tháng 11 cũ bị đổi.

## 2. Nguyên tắc tiền

**Mỗi ca có 2 bảng: Tiền mặt và Chuyển khoản.**

```
Tổng thu = Doanh thu + Thu nợ + Thu khác + Luân chuyển (vào) + Chênh lệch dư
Tổng chi = Các khoản chi + Cho nợ + Luân chuyển (ra) + Chênh lệch thiếu
```

Chênh lệch được tính để hai vế cân nhau: **Thu − Chi của ca = tiền thực tế − tiền đầu ca**.

| Cột | Lấy số ở đâu |
|---|---|
| Doanh thu | Cột tiền mặt / chuyển khoản trên **file Fabi** của ca. Bill khách nợ không tính (chưa phải tiền). Ca chưa có file Fabi thì tạm lấy số trên phiếu nhân viên, ghi "chờ kế toán" |
| Thu nợ | Khách trả nợ: trong ca, quản lý ghi ở ca, hoặc "Đã thu" ngoài ca. **Ghi rõ từng khoản**: tên, số tiền, nợ từ ca nào, trả hết hay còn nợ |
| Thu khác | Khoản thu nhóm Thu khác (bán đồ cũ…), phiếu thu từ ca dư |
| Các khoản chi | Chi ở phiếu ca, lương trả tiền mặt, phiếu chi chuyển khoản, khoản quản lý tạo, điều chỉnh khi kiểm quỹ thiếu. Khoản nhóm **"Không tính"** (vd quản lý lấy tiền két) vẫn nằm ở đây, có nhãn "Không tính chi phí", và **không** cộng vào khung Chi theo loại |
| Cho nợ | Khách mượn tiền mặt (Nợ TM), nợ chuyển khoản (Nợ CK) |
| Luân chuyển | Đổi tiền mặt ↔ chuyển khoản (2 vế, bên này ra thì bên kia vào), chuyển quỹ tiền mặt ↔ tài khoản, **chuyển về Quỹ ngoài** |
| Chênh lệch | Tiền thực tế − phải có. Dư nằm ở Sổ thu, thiếu nằm ở Sổ chi. **Quán chịu chỉ ghi một lần ở đây**, không thêm khoản chi nữa (Chi theo loại vẫn tính quán chịu vào chi phí) |

**Tiền thực tế:**
- Tiền mặt: số quản lý nhập ở bước *Tiền thực nhận*. Chưa có thì lấy số két nhân viên đếm.
- Chuyển khoản: **luôn lấy số ngân hàng kế toán nhập**, quản lý không sửa. Số hotline nhân viên gõ chỉ để tham khảo.

**Không nằm trong sổ của cơ sở:** chi phí Quỹ ngoài chia cho cơ sở, tiền hàng kho tổng theo hoá đơn. Hai khoản này vẫn ở Chốt tháng như hiện nay.

## 3. Trang mới

**Menu:**
- Quản lý ca: Chốt ca · **Sổ thu chi**.
- Mục "Sổ quỹ & chốt tháng" chỉ còn Chốt tháng.

**Trang:**
- Mỗi lần xem **1 cơ sở**. Có thêm nút **Quỹ ngoài**, chỉ Chủ thấy.
- 4 tab: **Tổng · Đối soát tiền · Sổ thu · Sổ chi**.

Trong lúc chạy song song, trang có tên "Sổ thu chi (mới)". Đường dẫn cũ (`#/quan-ly/thu-chi`, `lech-tien`, `cong-no`, `so-quy`) chỉ chuyển sang trang mới khi gỡ trang cũ.

### 3.1 Sổ thu / Sổ chi
- Hai bảng **Tiền mặt / Chuyển khoản**. Hàng ô ở đầu trang ứng với từng cột của công thức; bấm một ô thì sổ chỉ hiện cột đó.
- Sổ xếp **theo ngày → bấm ra từng ca → bấm ra từng khoản**. Khoản ngoài ca nằm ở dòng "Ngoài ca / Quản lý ghi".
- **Khung bên phải:**
  - Sổ thu: Thu nợ tháng này, Ca dư tiền, **Khách đang nợ** (gồm cả Nợ HĐ, có số ngày nợ, đỏ khi quá 7 ngày; nút Thu nợ).
  - Sổ chi: Ca thiếu tiền, Người nợ, Cần phân loại, Chi theo loại (so tháng trước).
- Khoản chi có ô chọn nhóm và ô tích đối soát như trang Thu chi hiện nay. Chọn nhóm là đối soát luôn.

### 3.2 Sửa / thêm / xoá phiếu
- **Mọi phiếu thu chi** đều do Chủ, Quản lý tổng, Quản lý cơ sở (cơ sở của mình) sửa / thêm / xoá được.
- **Sửa:** phiếu cũ **gạch ngang nhưng vẫn hiện**, không cộng vào tổng. Ngay dưới là **phiếu bổ sung của quản lý**, ghi người sửa, giờ, số cũ → mới, lý do. Phiếu bổ sung cũng sửa tiếp được.
- **Xoá:** phiếu gạch ngang, ghi "Đã xoá", kèm người, giờ, lý do.
- **Thêm:** nút "+ Thêm phiếu" ở đầu sổ (chọn ngày + ca, hoặc Ngoài ca) và trong từng ca.
  - Các loại: Khoản chi (nhóm bắt buộc), Cho nợ (chọn người nợ), Thu khác, Thu nợ, Luân chuyển (2 vế; sửa / xoá thì đổi cả 2 vế).
  - **Thu nợ** chọn từ danh sách nợ đang mở: Cho nợ trong sổ + Nợ HĐ − phần đã thu. Chỉ hiện khoản nợ có trước hoặc cùng ngày thu, không cho thu quá số còn nợ.
  - Thêm vào ca thì **phải ghi lý do**.
- **Không sửa ở sổ:** doanh thu Fabi, chênh lệch (sửa ở phiếu chênh lệch).
- **Thu chi của ca chỉ sửa / thêm / xoá được sau khi ca đã "Chốt tiền"** (mục 3.3).
- Tháng đã chốt thì khoá như cũ.

### 3.3 Đối soát tiền (thay phần tiền của trang Đối soát ca)

**Bảng tuần:** hàng = ngày, cột = Sáng · Chiều · Tối. Mỗi ô ghi trạng thái: 🔒 Đã chốt (· lệch chờ xử lý), 🔴 tên ô đỏ, ⏳ Chờ kế toán, 🔵 Chờ chốt. **Không có ô Cuối ngày** (anh Tiến bỏ cho đỡ thao tác).

**Mỗi ngày chọn một cách thu:**
- **Thu theo ca:** ca nào cũng nhập tiền mặt thực nhận. Ca sau phải mở đúng 1.000.000.
- **Thu theo ngày:** chỉ **ca cuối ngày** nhập tiền mặt thực nhận (quản lý đếm két sau ca). Ca trước không nhập, két chuyển sang ca sau. Ca sau phải mở bằng tiền thực tế ca trước để lại. Lệch cả ngày nằm ở ca cuối.
- Ca Sáng luôn mở 1.000.000.

**Phiếu tiền của ca đi 3 bước:**

1. **So phiếu Fabi ↔ nhân viên ghi (Fabi là chuẩn):**
   - **Tiền mở ca, 2 tầng:**
     1. Nhân viên ghi khác Fabi → quản lý bấm **"Sửa theo Fabi"**.
     2. Fabi khác số phải là → quản lý chọn **"Ca trước ghi sai" / "Ca này ghi sai"**. Phần lệch thành phiếu chênh lệch của **ca được chọn** (ca nào ghi sai ca đó chịu).
   - **Doanh thu:** khác Fabi → "Sửa theo Fabi". Web hiện cờ hoá đơn bị sửa / xoá để quản lý kiểm tra (ô này dùng để phát hiện xoá bill giữ tiền).
   - **Nợ:** nợ HĐ nhân viên khai ↔ dòng Nợ trên Fabi. Khác thì "Sửa theo Fabi"; nếu Fabi nhiều hơn thì thêm báo nợ phần chênh (chọn người nợ).
   - Mỗi lần "Sửa theo Fabi" ghi lại số cũ → mới, người sửa. Nhân viên xem lại phiếu thì thấy (giống ghi chú sửa thu chi hiện có). Có nút Huỷ sửa.
2. **Tiền thực nhận:** quản lý nhập tiền mặt (thu theo ca, hoặc ca cuối của ngày thu theo ngày). Chuyển khoản lấy số kế toán.
3. **Kết quả & Chốt:** ô Tiền mặt (thực nhận ↔ phải có) và ô Chuyển khoản (ngân hàng ↔ phải nhận), kèm nút **Chốt tiền ca**.
   - Chốt được khi: hết ô đỏ ở bước 1, đã có tiền mặt thực nhận (nếu ca cần nhập), kế toán đã có file Fabi + ngân hàng.
   - Lệch ở bước 3 **không chặn chốt**. Lệch thành phiếu chênh lệch, xử lý sau trong sổ.
   - Sau khi chốt: số Fabi, số nhân viên ghi và tiền thực nhận đứng yên. Sửa thu chi trong sổ thì chênh lệch tự tính lại. Có nút **Mở lại chốt** (ghi lý do).

**Trang Đối soát ca** chỉ còn phần việc. Một ca coi là "hoàn thành đối soát" khi cả phần việc và phần tiền đều xong.

### 3.4 Phiếu chênh lệch (thay tab Lệch tiền ca)

Mở ngay trong sổ (cột Chênh lệch) hoặc từ tab Đối soát tiền. Phiếu ghi phải có, thực tế, lệch, người làm ca, lời nhân viên giải trình. Chỉ xử lý được khi ca đã chốt.

| | Ca thiếu | Ca dư |
|---|---|---|
| Chưa xử lý | "Chờ xử lý · chưa làm phiếu trừ tiền" | "Chờ xử lý · chưa làm phiếu thu" |
| Cách xử lý | **Trừ lương** (chia đều người làm ca, sửa được, tổng phải bằng số lệch) · **Quán chịu** · **Ghép với ca dư** | **Gán nợ khách trả** (chọn khách đang nợ) · **Ghép với ca thiếu** · **Tạo phiếu thu** |
| Khoá | Đã tạo phiếu trừ tiền thì **không ghép được nữa** (phải huỷ phiếu trừ tiền trước) | Đã tạo phiếu thu thì **không gán nợ được nữa** |

- **Ghép:**
  - Chỉ ghép ca cùng loại tiền, trong vòng 3 ngày.
  - Hiện phép trừ "30.000 − 20.000 ghép = 10.000". Phần còn lại xử lý tiếp ngay trong phiếu.
  - Sổ chỉ cộng phần còn lại; ca được ghép hết thì hiện "= 0".
- **Ghép và Quán chịu:** quản lý cơ sở / Quản lý tổng bấm thì **chờ Chủ duyệt** (chỉ Chủ duyệt). Chủ bấm thì có hiệu lực ngay.
- **Trừ lương:** báo nhân viên; nhân viên giải trình ở "Khoản âm của tôi" như cũ.
- **Chặn chốt tháng** khi còn: phiếu chênh lệch chờ xử lý, phiếu chờ Chủ duyệt, ca chưa chốt tiền, khoản chi chưa phân loại.

### 3.5 Người nợ (thay tab Công nợ)
- Người nợ mặc định là **Khách**: phiếu chốt ca nhắc thu.
- Thêm được người nợ có tên ngay ở Sổ chi. Người có dấu **✓** thì phiếu chốt ca **không nhắc thu** (người nhà, Kho Tổng…). Tên thật nhập trên web, **không ghi trong kho mã**.
- Dấu ✓ **thay cho** "Công nợ gia đình" và nhóm "Nợ kho tổng" cũ. Khi chuyển dữ liệu, người thuộc hai nhóm đó được gắn ✓.
- Mỗi khoản Cho nợ hiện "Còn nợ … / Đã thu … · còn … / Đã thu hết".

### 3.6 Tab Tổng (thay Sổ quỹ)
- Mỗi lần **1 cơ sở**. Tiền mặt và Tài khoản: **Tồn đầu tháng + Tổng thu − Tổng chi − Chuyển về Quỹ ngoài = Tồn quỹ**. Tiền mặt gồm 1.000.000 gối đầu.
- Tồn quỹ theo ngày (Đầu ngày + Thu − Chi − Về Quỹ ngoài = Cuối ngày).
- **Ô nhắc:** Chuyển về Quỹ ngoài tháng này, Chờ Chủ nhận, Kiểm quỹ lần cuối, Chờ xử lý. Tiền mặt quá 20.000.000 thì đỏ và báo như cũ.
- **Chuyển về Quỹ ngoài (thay phiếu rút):**
  - Là phiếu luân chuyển tiền mặt / tài khoản → Quỹ ngoài.
  - Ghi ở Sổ chi của cơ sở (Luân chuyển) và Sổ thu của Quỹ ngoài.
  - Chủ bấm "Đã nhận tiền" thì khoá cả 2 bên. Khi còn chờ thì sửa / xoá được, và đổi cả 2 bên.
- **Kiểm quỹ** mỗi tuần như cũ. Lệch thì "Điều chỉnh…" tạo khoản thu / chi.
- Danh sách "Ca chưa chốt tiền" và "Chờ xử lý". Bấm vào thì mở đúng chỗ.

### 3.7 Quỹ ngoài (chỉ Chủ)
- Có đủ Tổng / Sổ thu / Sổ chi, không có Đối soát tiền.
- Sổ thu: tiền các cơ sở chuyển về (nút Đã nhận tiền), Thu khác.
- Sổ chi: chi ngoài, mỗi khoản có cách chia cho cơ sở (chia đều / theo tỉ lệ doanh thu / 1 cơ sở / không chia), như Quỹ ngoài hiện nay. Khung "Phần mỗi cơ sở chịu".
- Không có Cho nợ / Thu nợ.

## 4. Cách làm (đã chọn)

Có hai cách đã cân nhắc:
1. **Ghép số từ dữ liệu đang có (đã chọn).** Hàm `app_*` mới đọc các bảng hiện có rồi gom thành sổ. Phần thêm mới chỉ là chốt tiền ca, phiếu chênh lệch, phiếu bổ sung, dấu ✓, cách thu theo ngày. Ưu điểm: không đụng chốt ca và đối soát đang chạy tốt, dữ liệu cũ giữ nguyên, làm được từng đợt.
2. **Sổ cái mới** (mỗi thay đổi ghi một dòng vào bảng sổ). Không chọn, vì phải sửa nhiều chỗ đang chạy; sót một chỗ là sổ lệch với phiếu ca.

**Nguồn dữ liệu hiện có (người làm kiểm lại khi viết SQL):**

| Cần | Bảng / hàm hiện có |
|---|---|
| Phiếu ca, bản đối soát | `shift_reports`, `shift_report_moves`, `shift_report_recon`, `app__ca_eff`, `app__ca_money` |
| Fabi | `fabi_shifts` (có Số dư đầu ca, doanh thu, TM, CK, Nợ) |
| Ngân hàng | `bank_shift_balances`, `bank_account_balances`, `shift_bank_outs` (phiếu chi chuyển khoản) |
| Thu chi quản lý tạo, nhóm | `fin_entries` (có `no_fund`), `fin_move_cats`, `fin_categories`, `fin_cat_types` |
| Nợ | `shift_debts`, `branch_loans`, `branch_loan_payments`, `loan_people` (`family`), `app_cn_book` |
| Lệch tiền | `app__gap_rows`, `gap_matches`, `gap_decisions`, bảng khoản âm (`app_ka_*`) |
| Quỹ | `fund_openings`, `fund_day_values`, `fund_withdrawals`, `fund_transfers`, `fund_counts`, `app__fund_sum` |
| Quỹ ngoài | `ext_entries`, `ext_alloc_manual`, `ext_alloc_fixed`, `ext_openings` |
| Chốt tháng | `fin_month_closes`, `app_fin_overview` |

## 5. Chạy song song và các đợt

**Đợt 1 (để anh Tiến dùng thử với dữ liệu thật): chỉ xem.**
- Mục menu "Sổ thu chi (mới)", trong lúc thử chỉ Chủ và Quản lý tổng thấy.
- 4 tab và Quỹ ngoài hiện **toàn bộ dữ liệu thật từ 01/11** theo đúng cách tính ở mục 2.
- **Chưa có nút ghi** (sửa / thêm / chốt / xử lý lệch đều tắt, ghi "đang chạy thử"). Như vậy dùng thử không làm đổi dữ liệu thật.
- Các trạng thái chưa có trong dữ liệu cũ thì suy ra như sau:
  - "Đã chốt tiền" = ca đã đối soát xong phần tiền.
  - Cách thu = theo ngày.
  - Phiếu rút cũ hiện là "Chuyển về Quỹ ngoài".
  - Người nợ gia đình / kho tổng hiện có dấu ✓.
- Có khung **"So với trang cũ"** cho từng cơ sở, từng ngày: tồn quỹ mới ↔ Sổ quỹ cũ, tổng thu / chi mới ↔ Thu chi cũ, lệch mới ↔ Lệch tiền ca cũ. Ngày nào khác thì liệt kê ra để anh Tiến và người làm xem. Ví dụ khác dự kiến: những ngày quản lý từng sửa tay số nộp quỹ cuối ngày.

**Các đợt sau** (mỗi đợt một lần lên web, ghi `app_releases`, tăng `version.json`):
- **Đợt 2:** sửa / thêm / xoá phiếu (gạch ngang + phiếu bổ sung), dấu ✓ người nợ, khung Khách đang nợ.
- **Đợt 3:** phiếu chênh lệch (trừ lương / quán chịu / ghép / gán nợ / phiếu thu, chờ Chủ duyệt, các khoá).
- **Đợt 4:** Đối soát tiền 3 bước + Chốt tiền ca + thu theo ca / theo ngày + Sửa theo Fabi. **Đụng vùng khoá** (mục 6).
- **Đợt 5:** Tab Tổng (chuyển về Quỹ ngoài, kiểm quỹ), Quỹ ngoài, Chốt tháng dùng nguồn mới.
- **Gỡ trang cũ:**
  - Sau khi chạy song song **1 tuần** và anh Tiến xác nhận số khớp.
  - Gỡ 4 trang cũ + phần tiền của Đối soát ca khỏi menu; đường dẫn cũ chuyển sang trang mới.
  - Đổi Việc hôm nay, thông báo, số trên menu sang trang mới.
  - Hàm máy chủ cũ giữ thêm một thời gian rồi mới xoá.

## 6. Ràng buộc

- Thay đổi CSDL = tệp mới có số thứ tự trong `supabase/`, bắt đầu từ **127** (xem `select max(file) from app_migrations` trước khi đặt số). Viết để chạy lại được, dòng cuối ghi `app_migrations`. Bảng mới không cấp quyền `anon` / `authenticated`; web chỉ gọi hàm `app_*`.
- Chạy thử trên máy chủ thật bằng khối `DO … RAISE EXCEPTION 'REPORT>> …'` (tự hoàn tác) trước khi chạy thật. So số cũ / mới dùng `repeatable read` (xem `kiem_tra/toc_do/`).
- **Tốc độ:**
  - Không gọi hàm đắt cho từng dòng trong WHERE / ORDER BY.
  - Chặn máy chủ chép biểu thức bằng `offset 0` / `materialized`.
  - Mỗi lần hỏi tối đa 1.000 dòng, nên phải gom ở máy chủ.
  - Câu hỏi độc lập thì hỏi cùng lúc.
- **Vùng khoá "Mở để sửa" đối soát** (xem `CLAUDE.md`): đợt 4 chuyển phần tiền của Đối soát ca sang trang mới, nên sẽ đụng `can_recon`, `app_ca_recon_apply`, `app_ca_auto_locks`, `app__ca_locked_*`, `app_can`, `role_permissions`. Trước khi sửa phải dừng lại, nói rõ định sửa gì, xin anh Tiến gõ mật khẩu. Sửa xong chạy `kiem_tra/trinh_duyet/flow_ql_tu_ds.js` (ql + chu, máy tính + điện thoại).
- Kho mã công khai: không đưa tên thật người nợ / nhân viên, không đưa dữ liệu thật.
- Giao diện phải không tràn ngang ở khung 390px.

## 7. Để người làm tự quyết

- Tên hàm, cấu trúc JSON trả về, cách chia tệp JS (gợi ý `docs/js/pages/so_thu_chi.js` + các tệp con).
- Lưu "phiếu bổ sung": dùng lại `shift_recon_log` / ghi chú sửa thu chi (bước 120) hay thêm bảng mới.
- Lưu chốt tiền ca, cách thu theo ngày, "Sửa theo Fabi", người chịu lệch mở ca.
- Cách suy trạng thái cũ ở đợt 1 nếu dữ liệu thiếu. Ghi rõ trong khung "So với trang cũ".

## 8. Các điểm người viết tài liệu tự quyết (anh Tiến xem lại)

- Thêm cột **Thu khác** vào Sổ thu, để sổ khớp với quỹ.
- Quỹ ngoài không có Cho nợ / Thu nợ.
- Khung "Khách đang nợ" (gồm Nợ HĐ) đặt ở Sổ thu.
- Trong lúc chạy thử, chỉ Chủ và Quản lý tổng thấy trang mới.
- Nhầm tiền mặt ↔ chuyển khoản trong cùng ca: **chưa làm tự ghép** (anh Tiến chưa chốt). Quản lý ghép bằng tay như lệch thường.
