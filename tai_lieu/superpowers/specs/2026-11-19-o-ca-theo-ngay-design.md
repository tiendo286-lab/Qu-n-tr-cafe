# Ô Ca trong "+ Thêm phiếu" đi theo ô Ngày — thiết kế (Kế hoạch 3, 19/11/2026)

## Vì sao
Anh Tiến gửi ảnh khung **+ Thêm phiếu** (Sổ thu chi): ô Ngày là 19/11 nhưng bấm ô Ca lại ra một danh sách dài lẫn lộn — Ca Chiều 17/11, Ca Tối 16/11, Ca Sáng 15/11, 13/11, 11/11… — thiếu ca 18/11, 19/11 mà không biết vì sao. Người ghi phiếu khó tìm đúng ca, dễ gắn nhầm phiếu vào ca khác ngày. Anh bảo "chốt kế hoạch 3" mà không nêu chi tiết, nên phần dưới là **đề xuất của AI**; anh sửa trước khi bảo "chạy kế hoạch 3".

## Hiện nay (`docs/js/pages/so_thu_chi.js`, hàm `addPanel`)
- Danh sách ca = mọi ca trong tháng đã đối soát xong tiền (`recon_money_done`), chưa 🔒 Chốt ca (`isFin`), tháng chưa chốt; mới nhất lên đầu. Không lọc theo ô Ngày.
- Ca chưa đối soát xong tiền **bị ẩn** (máy chủ `app_stc_move_save` cũng chặn: "Ca chưa chốt tiền").
- Chọn ca → ô Ngày nhảy sang ngày của ca và **bị khoá**; Lý do bắt buộc.
- Chỉ Khoản chi / Thu khác gắn được vào ca.

## Sau khi sửa
1. **Chọn Ngày trước, ô Ca chỉ hiện ca của ngày đó**, đúng thứ tự Sáng → Chiều → Tối, dòng đầu luôn là "Ngoài ca".
2. Mỗi ca ghi kèm người làm: `Ca Sáng · Hà, Tú`.
3. **Ca chưa thêm được thì vẫn hiện nhưng mờ, không chọn được**, kèm lý do ngắn:
   - `Ca Tối · Bình — chưa xác nhận Fabi`
4. Ngày không có ca nào: chỉ còn "Ngoài ca", dưới ô có dòng nhỏ `Ngày 19/11 chưa có ca nào xác nhận Fabi` (và `— tháng đã chốt` khi tháng đã chốt).
5. **Ô Ngày không còn bị khoá** khi chọn ca. Đổi Ngày → danh sách ca vẽ lại; nếu ca đang chọn không thuộc ngày mới thì về "Ngoài ca".
6. Mở khung từ một ca (nút thêm trong dòng ca, `caId`): Ngày = ngày của ca, Ca chọn sẵn ca đó (như nay).
7. Giữ nguyên: Cho nợ / Thu nợ / Luân chuyển chỉ ghi ngoài ca; thêm vào ca bắt buộc Lý do; tháng đã chốt thì mọi ca đều mờ.

Phác thảo:
```
Ngày [19/11/2026]   Ca [ Ngoài ca            ▾]
                        Ngoài ca
                        Ca Sáng · Hà, Tú
                        Ca Chiều · An        — chưa xác nhận Fabi   (mờ)
```

## Cách làm (đã cân nhắc)
- **A — Ô Ca lọc theo Ngày (chọn).** Ít thao tác nhất, khớp cách quản lý nghĩ ("hôm qua ca tối mua thiếu đá"), chặn gắn nhầm ngày. Chỉ sửa giao diện.
- B — Giữ danh sách cả tháng, chia nhóm theo ngày. Vẫn dài, cuối tháng ~90 dòng; không giải quyết việc gắn nhầm.
- C — Bỏ ô Ca, chỉ thêm phiếu vào ca từ nút trong dòng ca. Mất đường nhanh khi đang ở trên cùng sổ.

## Không làm
- Không đổi máy chủ, không đổi quyền, không đụng vùng khoá tiền đối soát (`addPanel` không nằm trong danh sách vùng khoá).
- Không cho thêm phiếu vào ca chưa đối soát tiền (máy chủ vẫn chặn).

## Để người làm tự quyết
- Tên lớp CSS, chữ chính xác của dòng nhắc, hàm thuần đặt trong `so_thu_chi_tinh.js`.

## Cập nhật 19/11 tối
- Bước 158 đã bỏ Chốt ca vĩnh viễn → không còn lý do "đã chốt ca". Lý do mờ dùng đúng chữ web đang dùng: "chưa xác nhận Fabi" (ca chưa `recon_money_done`), "tháng đã chốt".
- Làm ở lượt 2 (sau KH2), trước KH4. Kế hoạch: `tai_lieu/superpowers/plans/2026-11-19-o-ca-theo-ngay.md`.
