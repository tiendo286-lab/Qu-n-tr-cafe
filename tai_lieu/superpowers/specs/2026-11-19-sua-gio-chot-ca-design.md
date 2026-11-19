# Sửa giờ chốt ca — thiết kế (19/11/2026)

Người chốt: anh Tiến (Chủ).

## Vì sao
Giờ doanh thu của ca có thể sai vì hai lý do: **phát hiện nhập nhầm**, hoặc **chốt ca bổ sung** (đã chốt trên Fabi rồi phải chốt thêm, nên giờ kết thúc lùi lại). Cả hai thường lộ ra **sau khi** nhân viên đã gửi phiếu, có khi sau cả 🔒 Chốt ca.
Từ bước 156, trang Đối soát ca không còn bước Tiền, nên **hiện không ai sửa được giờ doanh thu**, kể cả Chủ. "Xác nhận Fabi" (tệp 137) còn tự đánh dấu mục Thời gian doanh thu là đã duyệt, nên mục này bị khoá.

## Luật giờ (anh chốt)
- **Ca Sáng** luôn bắt đầu lúc 06:45, không sửa được.
- **Ca Chiều / Tối:** giờ bắt đầu **luôn bằng giờ chốt của ca trước**, không sửa riêng.
- **Chỉ sửa được giờ chốt (giờ kết thúc) của từng ca.** Sửa giờ chốt ca trước thì giờ bắt đầu ca sau **tự đổi theo**. Web báo rõ, ví dụ "Ca Chiều đổi giờ bắt đầu: 14:05 → 14:20".
- Ca sau đã 🔒 Chốt ca thì giờ bắt đầu của nó **vẫn đổi theo**: giờ không làm đổi số tiền đã chốt, và lịch sử của ca đó ghi lại việc đổi.

## Ai được sửa (anh chọn cách C)
| Trạng thái ca | Được sửa |
|---|---|
| Đã gửi phiếu, **chưa** 🔒 Chốt ca | Quản lý cơ sở (người được giao đối soát cơ sở đó), Quản lý tổng, Chủ |
| **Đã** 🔒 Chốt ca | Chỉ Quản lý tổng và Chủ |

- Lần sửa nào cũng **phải ghi lý do**.
- Lưu lịch sử: ai sửa, lúc nào, giờ cũ → giờ mới, lý do, ca sau có bị đổi theo không.

## Chỗ sửa (anh chọn cách 3: cả hai trang, dùng chung một ô sửa)
- **Sổ thu chi › Đối soát Fabi, đầu phần A:** dòng `Giờ doanh thu 14:05 → 21:30 · File Fabi: 21:45 ✗ khác · [✎ Sửa giờ chốt]`. Nếu kế toán đã tải file Fabi thì hiện giờ trong file để so.
- **Trang Đối soát ca:** nút `✎ Sửa giờ chốt` cạnh dòng "Giờ doanh thu".
- Hai nút mở **cùng một ô sửa**: giờ chốt mới (có ngày, qua nửa đêm thì chọn ngày hôm sau), lý do, và dòng báo trước ca sau sẽ đổi giờ bắt đầu thành bao nhiêu.
- Người không có quyền (ví dụ quản lý cơ sở khi ca đã chốt) **không thấy nút**. Máy chủ vẫn chặn lại nếu có ai gọi thẳng.

## Kiểm tra khi lưu (em đề xuất, anh chưa bác)
- Giờ chốt mới phải **sau giờ bắt đầu** của chính ca đó.
- Nếu ca sau đã có giờ chốt, giờ chốt mới phải **trước giờ chốt của ca sau**, để ca sau không bị độ dài âm.
- Tháng đã Chốt tháng thì không sửa được (giống các chỗ sửa khác).
- Sửa giờ **không** bỏ dấu "đã duyệt" của mục Thời gian doanh thu, và **không** phải Xác nhận Fabi lại.

## Cách làm phía máy chủ (chỉ có một cách hợp lý)
- Thêm một lệnh riêng "sửa giờ chốt" (tệp SQL mới). Lệnh này kiểm tra quyền theo bảng trên, bắt ghi lý do, ghi giờ mới vào bản dữ liệu ca đang dùng, đổi giờ bắt đầu của ca sau nếu ca sau đã gửi phiếu (chưa gửi thì ca sau tự lấy giờ mới khi mở phiếu), rồi ghi lịch sử.
- Không mở lại đường sửa phần tiền. Lệnh chỉ chạm hai giá trị giờ.
- **Vùng khoá:** việc này chạm khoá Chốt ca (`app__stc_final_guard`, tệp 135) và khoá mục đã duyệt (`app__ca_locked_fields`). Cụ thể là mở một lối riêng **chỉ cho giờ** trên ca đã chốt, giống lối riêng của Khoản treo (`set_config(..., true)`, chỉ trong giao dịch). Anh Tiến đã được báo trong lúc thiết kế.

## Các cách đã cân nhắc
- **Có sửa sau khi Chốt ca không:** A — khoá hẳn (đơn giản, nhưng phát hiện muộn thì không sửa được); B — cả 3 vai đều sửa được; **C — sau khi chốt chỉ Quản lý tổng và Chủ sửa (anh chọn)**.
- **Đặt nút ở đâu:** 1 — chỉ ở Đối soát Fabi (có giờ trong file Fabi để so); 2 — chỉ ở Đối soát ca (không có số Fabi để so); **3 — cả hai trang, chung một ô sửa (anh chọn)**: ô sửa chỉ làm một lần, sửa được ở bất cứ chỗ nào đang thấy giờ sai.

## Không làm
- Không cho sửa giờ bắt đầu riêng lẻ.
- Không đổi số tiền, file Fabi hay cách khớp chuyển khoản.
- Không sửa phiếu của nhân viên trước khi gửi (nhân viên vẫn tự nhập như cũ).

## Thất bại nếu
- Sửa giờ làm thay đổi bất kỳ số tiền nào của ca đã chốt.
- Hai ca liền nhau bị chồng giờ hoặc hở giờ sau khi sửa.
- Quản lý cơ sở sửa được ca đã chốt, hoặc sửa được cơ sở không được giao.
- Mở lối riêng cho giờ mà vô tình mở luôn đường sửa tiền trên ca đã chốt.

## Để người làm tự quyết
- Lịch sử hiện ở đâu trên trang (dùng lịch sử sẵn có của ca nếu được).
- Tên lệnh máy chủ và số tệp SQL (xem `max(file)` ở `app_migrations`).
- Bài thử: máy chủ (tự hoàn tác, thử đủ 3 vai × chưa chốt / đã chốt, ca sau đổi theo, chặn giờ sai); Chrome trên cả hai trang, máy tính và 390px. Sau đó chạy bài thử vùng khoá `flow_ql_tu_ds` (ql + chu), `flow_stc6`, `flow_stc7` (chu / qlt / ql).

## Cập nhật sau bước 158 (anh Tiến chốt 19/11 tối)
Bước 158 đã bỏ hẳn 🔒 Chốt ca vĩnh viễn, nên bảng "Ai được sửa" ở trên **thay bằng**:
- **Quản lý cơ sở (được giao đối soát cơ sở đó), Quản lý tổng, Chủ** sửa được giờ chốt của mọi ca đã gửi phiếu, đã hay chưa Xác nhận Fabi, **tới khi Chốt tháng**. Sau Chốt tháng không ai sửa (Chủ mở lại tháng thì sửa được). Đúng bằng quyền của `app__stc_ds_need` (tệp 133), giống quyền "Mở lại xác nhận" từ bước 158.
- Vẫn bắt ghi lý do, vẫn lưu lịch sử.
- Không cần "lối riêng cho giờ" qua `app__stc_final_guard` nữa (trigger đã bỏ ở tệp 141). Lệnh mới vẫn ghi vào mục **Thời gian doanh thu đã duyệt** (khái niệm vùng khoá `app__ca_locked_fields`), nên vẫn báo anh trước khi chạy và chạy bài thử vùng khoá.
- Các câu nhắc "đã Chốt ca" ở trên (Vì sao, Luật giờ, Thất bại nếu) hiểu là "đã Xác nhận Fabi".
- Kế hoạch làm: `tai_lieu/superpowers/plans/2026-11-19-sua-gio-chot-ca.md`.

## Cập nhật 2: giờ chốt theo file Fabi (anh Tiến chốt 19/11 tối)
- **Kế toán đã tải file Fabi của ca → giờ chốt tự lấy theo giờ trong file**, không ai sửa tay (ô sửa khoá, ghi "theo file Fabi"). Tải lại file với giờ khác thì đổi theo. Nhân viên gửi phiếu sau khi đã có file thì cũng lấy giờ file.
- **Chưa có file Fabi** → Quản lý cơ sở / Quản lý tổng / Chủ sửa tay như mục trên (bắt lý do).
- Ca sau tự đổi giờ bắt đầu theo giờ chốt mới (cả khi theo file). Ca Sáng vẫn 06:45. Giờ mở trong file Fabi không dùng.
- Luật chặn anh đồng ý: giờ chốt phải sau giờ bắt đầu; phải trước giờ chốt ca sau; tháng đã Chốt tháng thì không sửa. Giờ trong file phạm luật thì không tự áp, hiện "không hợp lệ, sửa tay" và cho sửa tay (AI đặt mặc định, báo anh khi bàn giao).
- **Không** bắt Xác nhận Fabi lại khi giờ đổi. **Không** gửi thông báo, chỉ lưu lịch sử.
- **Sửa cả ca cũ** của tháng chưa Chốt tháng: AI gửi anh danh sách ca sẽ đổi (giờ cũ → giờ file) trước khi chạy thật.
