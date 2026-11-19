# Bước 152 — Xoá phần cũ, Sổ thu chi thành chỗ làm duy nhất (thiết kế)

Ngày 19/11/2026. Anh Tiến chốt sau khi bước 151 (Đối soát Fabi + Chốt ca) lên web 2026.11.19.8.

## Ý định
- Gom việc tiền về **một chỗ: Sổ thu chi**, để quản lý không phải làm hai nơi và số không lệch giữa trang cũ với trang mới.
- Xoá 4 phần cũ: **phần tiền ở Đối soát ca**, **trang Thu chi cũ**, **trang Lệch tiền ca**, **trang Sổ quỹ**.
- **Mở Sổ thu chi cho quản lý cơ sở.** Mỗi người chỉ thấy cơ sở mình được giao.

## Đã chốt với anh Tiến
- Không làm tab "Khoản âm" riêng. **Sổ thu / Sổ chi có bộ lọc đầy đủ** như trang Thu chi cũ. Lọc "Trừ lương" ra hết phiếu trừ lương, xử lý ngay ở đó.
- Bỏ hết 4 việc chỉ Sổ quỹ cũ làm được:
  - sửa số nộp quỹ từng ngày;
  - đặt số dư đầu quỹ;
  - bảng tổng các cơ sở;
  - tiền hàng kho tổng ở Quỹ ngoài.
- Quản lý cơ sở được vào Sổ thu chi. Quỹ ngoài vẫn chỉ Chủ.

## Em tự chọn (anh chưa trả lời, chọn cách an toàn)
- **Chuyển một khoản chi thành trừ lương:** giữ. Nút "→ Trừ lương" nằm trên dòng chi của ca chưa chốt; dùng lại hàm máy chủ đang có `app_tc_move_to_ka` và `app_tc_move_ka_undo`.
- **Đánh dấu "đã kiểm" từng khoản:** bỏ. Đã chọn nhóm thì coi như đã kiểm.
- **Nút "Mở khoá" mục tự đối soát:** vẫn ở Đèn đối soát. Trang đó không bị xoá nên không cần chuyển.
- **Đường dẫn cũ tự chuyển sang trang mới**, để thông báo, việc trong Công việc và dấu trang cũ không hỏng. Đường dẫn trong máy chủ giữ nguyên.

## Cách làm
Chọn **làm một lần**, có tự chuyển đường dẫn. Không chia hai đợt vì anh dặn "xoá luôn".

### 1. Menu và đường dẫn
- **Menu Quản lý ca:**
  - bỏ "Thu chi" và "Lệch tiền ca";
  - "Sổ thu chi (mới)" đổi tên "Sổ thu chi", quyền `doi_soat` (trước là `chot_thang`).
- **Menu Sổ quỹ & chốt tháng:** bỏ "Sổ quỹ", giữ "Chốt tháng".
- **Tự chuyển:**

  | Đường dẫn cũ | Chuyển tới |
  |---|---|
  | `/quan-ly/thu-chi` | `/quan-ly/so-thu-chi?tab=chi` |
  | `/quan-ly/thu-chi` có `xem=khoan-am`, và `/quan-ly/khoan-am` | `/quan-ly/so-thu-chi?tab=chi&loc=tl` |
  | `/quan-ly/lech-tien`, `/quan-ly/am-tien` | `/quan-ly/so-thu-chi?tab=doi-soat` |
  | `/quan-ly/so-quy` | `/quan-ly/so-thu-chi?tab=tong` |
  | `/quan-ly/bao-cao-ca` | `/quan-ly/so-thu-chi?tab=chi` |

  Giữ tham số `thang` và `cn`.
- **Đổi đường dẫn trong web sang trang mới:**
  - Chốt tháng: "Mở phiếu trừ lương trong Thu chi", "Sổ quỹ ›".
  - Phiếu ca: "Mở phiếu trừ lương trong Thu chi".
  - Nút trong Đèn đối soát.
- **Xoá tệp:** `docs/js/pages/thu_chi.js`, `am_tien.js`, `so_quy.js`, và các bài thử Chrome chỉ thử 3 trang này.

### 2. Bộ lọc đầy đủ ở Sổ thu / Sổ chi
- **Thanh lọc trên sổ:**
  - ô **Tìm** (nội dung, nhóm, người, ca);
  - **Nguồn:** Từ phiếu ca / Quản lý tạo (ngoài ca) / Nộp bù khoản âm / Chênh lệch;
  - **Loại → Nhóm** (theo danh mục thu chi);
  - **Trạng thái:** Chưa phân loại / Chờ xử lý / **Có trừ lương** / Đã xoá / Ca đã chốt / Ca chưa chốt;
  - nút **Bỏ lọc**.
- Bảng Tiền mặt / Chuyển khoản và ô cột vẫn như hiện nay; lọc theo cột đã có.
- **Có lọc thì sổ hiện danh sách phẳng** (ngày · ca · nội dung · số tiền), dòng vẫn có đủ nút sửa / xoá / phiếu chênh lệch như trong cây ngày. Không lọc thì vẫn là cây ngày → ca.
- **Lọc "Có trừ lương":**
  - Hiện mọi dòng chênh lệch của tháng có phiếu trừ lương, kể cả ca đã chốt.
  - Dưới mỗi dòng là từng phiếu: người, số tiền, trạng thái (chờ trừ / đã nộp bù / huỷ), **giải trình của nhân viên** nếu có.
  - Nút **Huỷ** (ca chưa chốt) và **Mở phiếu chênh lệch**.
  - Máy chủ thêm `reply` (giải trình) vào chi tiết `tl` của `app_stc_month`.
- Bộ lọc giữ trên đường dẫn (`loc=…`) để đường dẫn cũ "khoản âm" mở đúng.

### 3. Đối soát ca: bỏ phần tiền (VÙNG KHOÁ, cần anh gõ mật khẩu)
- Trang Đối soát ca bỏ các bước tiền: Tiền mặt, Chuyển khoản, Thu chi, Công nợ, kèm nút ✎ Mở để sửa và ô sửa số.
- Thay bằng một dòng: "Phần tiền làm ở **Sổ thu chi › Đối soát Fabi** ›" (mở thẳng ca đó). Có trạng thái: chưa xác nhận Fabi / đã xác nhận / đã chốt ca.
- Giữ các bước việc: thời gian, nhân sự, bàn giao, nhập hàng, nghỉ / làm thay.
- **Máy chủ** phải cho đối soát việc xong được khi không còn bước tiền ở trang cũ:
  - "Xác nhận Fabi" (`app_stc_ds_close`) ghi thêm kết quả "khớp" cho mục **Thu chi** và **Công nợ** nếu chưa có. Tiền mặt / chuyển khoản đã ghi như hiện nay.
  - Sau đó gọi `app__ca_auto_finish`, để ca xong cả phần việc thì tự "Hoàn thành đối soát" và việc trong Công việc tự hết.
- **Bài thử vùng khoá `flow_ql_tu_ds` phải viết lại**, vì nút "Mở để sửa" không còn. Bài mới thử:
  - Đối soát ca không còn ô tiền / nút sửa, có đường dẫn sang Đối soát Fabi.
  - Quản lý cơ sở mở ca đó ở Đối soát Fabi, xác nhận Fabi được.
  - Chạy với role ql và chu, máy tính và điện thoại.
- Mục "Vùng khoá" trong `CLAUDE.md` sửa lại cho đúng thực tế mới. Anh đọc lại trước khi em đẩy lên.

### 4. Mở Sổ thu chi cho quản lý cơ sở
- **Máy chủ:**
  - `app_stc_month` và `app_stc_finals` đổi kiểm tra từ `app__fin_admin()` (chỉ Chủ / QLT) sang `app__fin_can(p_branch)`, giống các hàm ghi của Sổ thu chi đang dùng.
  - Danh sách cơ sở chỉ gồm cơ sở người đó được giao.
  - Vá thẳng bản đang chạy bằng thay chuỗi, có kiểm chỗ chèn như tệp 135.
- **Quyền làm việc** giữ như hàm hiện có:
  - Xác nhận Fabi / Chốt ca: `app__stc_ds_need`, tức quản lý đối soát của cơ sở.
  - Phiếu chênh lệch: `app__gap_role`.
  - Quán chịu và ghép do người không phải Chủ làm thì chờ Chủ duyệt.
  - Quán chịu khoản treo: chỉ Chủ.
- **Web:** quản lý cơ sở không thấy "Quỹ ngoài" (đã có); chọn cơ sở chỉ hiện cơ sở được giao.

### 5. Không làm (non-goals)
- Không xoá dữ liệu nào trên máy chủ. Hàm của trang cũ để nguyên (không còn nút gọi), dọn sau nếu anh muốn.
- Không đổi Chốt tháng, Công nợ, Đèn đối soát, Kế toán.

### 6. Thất bại nếu
- Quản lý cơ sở mất chỗ làm một việc tiền đang làm hằng ngày.
- Một đường dẫn cũ mở ra trang trắng hoặc báo lỗi.
- Ca đối soát xong việc nhưng không bao giờ "Hoàn thành đối soát" (Công việc nhắc mãi).
- Quản lý cơ sở thấy hoặc sửa được cơ sở không được giao.

## Kiểm tra
- **Máy chủ:** chạy thử ở chế độ tự hoàn tác, với tài khoản QL cơ sở và Chủ:
  - QL đọc được tháng cơ sở mình, bị chặn cơ sở khác.
  - Xác nhận Fabi ghi đủ 4 kết quả tiền và tự hoàn thành đối soát khi xong phần việc.
- **Chrome:**
  - Bộ thử Sổ thu chi chạy với role ql, qlt, chu, trên máy tính và điện thoại.
  - Bài mới cho bộ lọc: tìm chữ, nguồn, nhóm, có trừ lương + giải trình, bỏ lọc.
  - Tự chuyển 5 đường dẫn cũ.
  - Bài vùng khoá viết lại.
