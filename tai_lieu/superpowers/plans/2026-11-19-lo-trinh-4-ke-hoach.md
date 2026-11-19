# Lộ trình 4 kế hoạch (KH2 → KH3 → KH4 → KH1)

Viết 19/11/2026 tối, sau bước 160 (web 2026.11.19.17, máy chủ tới tệp 143). Anh Tiến chốt thứ tự này trong chat 19/11.
Tệp này là **chỗ duy nhất** ghi thứ tự, số bước, số tệp SQL và luật tránh chồng chéo. Từng kế hoạch chỉ ghi phần việc của nó.

## Thứ tự và lý do

| Lượt | Kế hoạch | Bước | Tệp SQL | Vì sao ở lượt này |
|---|---|---|---|---|
| 1 | **KH2 — Sửa giờ chốt ca** · `plans/2026-11-19-sua-gio-chot-ca.md` | 162 | 144 | Lỗi đang có thật: từ bước 156 **không ai sửa được giờ doanh thu**. Chạm máy chủ + 2 trang. |
| 2 | **KH3 — Ô Ca theo Ngày** · `plans/2026-11-19-o-ca-theo-ngay.md` | 163 | — | Nhỏ, chỉ giao diện, chỉ sửa `addPanel`. Làm trước KH4 để KH4 xếp lại khung mà giữ nguyên luật mới. |
| 3 | **KH4 — Sổ thu / Sổ chi gọn** · `plans/2026-11-19-so-thu-chi-gon.md` | 164 | — | Sửa lớn nhất ở `so_thu_chi.js`. Làm sau KH2, KH3 để không phải sửa lại hai việc đó. |
| 4 | **KH1 — Xem như người khác** · `plans/2026-11-19-xem-nhu-nguoi-khac.md` | 165 | 145 | Rủi ro cao nhất (hàm chạy trước **mọi** lần gọi máy chủ). Tệp riêng, không đụng Sổ thu chi. Xong thì anh dùng nó để xem lại các màn hình mới dưới vai Quản lý / Nhân viên. |
| 5 | **KH5 — Tab Tổng mẫu B + Ai còn nợ** · `plans/2026-11-19-tab-tong-mau-b.md` (thiết kế `specs/2026-11-19-tab-tong-mau-b-design.md`) | 166 | — | **Đã làm 19/11 (web 2026.11.19.23).** Chỉ giao diện, chỉ sửa `tongPage` / `fillCounts` trong `so_thu_chi.js` + 2 hàm thuần. |

Số bước / số tệp là **dự kiến**. Mỗi lượt kiểm lại trước khi dùng: `git log -5`, `select max(file) from app_migrations` (so theo số: `order by split_part(file,'_',1)::int desc`).

## Luật chung cho cả 4 lượt

- **Mỗi lượt một lần đẩy lên `main`**. Lượt sau chỉ bắt đầu khi lượt trước đã đẩy xong và bài thử đạt. Không làm hai lượt song song.
- **Anh Tiến chốt 19/11: xong mỗi lượt thì DỪNG**, nhắn anh thử trên web thật; anh báo ổn mới làm lượt sau. **KH5 chưa làm trong đợt này** (giữ dòng trong bảng, chờ anh bảo). Chỉ một phiên AI sửa mã trong lúc chạy lộ trình.
- Bắt đầu lượt: `git pull`, đọc lại kế hoạch của lượt đó + mục "Bàn giao từ lượt trước" bên dưới.
- Đẩy lên: tăng `docs/version.json` + `ASSET_VERSION` (`docs/js/app.js`) + mọi `?v=` trong `docs/index.html` (CSS, importmap, import). Thêm tệp mới trong `docs/js/` (không phải `pages/`) thì thêm một dòng importmap.
- `app_releases`: một dòng cho ngày đẩy (`YYYY.MM.DD`, trùng ngày thì `.2`, `.3`), viết tiếng Việt dễ hiểu.
- Commit: `Tien Do <tiendo286@gmail.com>`, cuối có `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Máy chủ: chạy thử trong khối tự hoàn tác (`RAISE EXCEPTION 'REPORT>> %'`) → xem → chạy thật → **rồi** mới đẩy giao diện. Dòng cuối tệp SQL ghi `app_migrations`.
- Vùng khoá (CLAUDE.md): KH2 và KH1 có chạm. Báo anh Tiến một dòng trước khi chạy SQL thật. Sau khi sửa chạy `flow_ql_tu_ds` (ql + chu, `index.html` + `test/phone.html`), `flow_stc6`, `flow_stc7` (chu / qlt / ql).
- Mỗi lượt kết thúc bằng một lần duyệt mã (superpowers:requesting-code-review, một người duyệt), rồi cập nhật `tai_lieu/BAN_GIAO.md` + `tai_lieu/TINH_NANG_DA_CHOT.md`.
- Tệp cục bộ không đưa lên GitHub: `UI_AUDIT_REPORT.md`, `work/`, `.claude/`. `AGENTS.md` chỉ đưa lên nếu anh Tiến muốn (hiện chưa có trong kho).

## Ai sở hữu tệp nào (tránh sửa trùng)

| Tệp | KH2 | KH3 | KH4 | KH1 |
|---|---|---|---|---|
| `supabase/` | 144 | — | — | 145 |
| `docs/js/pages/so_thu_chi.js` | `partA` (thêm dòng giờ) + bắt nút `data-gio` | chỉ `addPanel` | Sổ thu / Sổ chi / bộ lọc / mở ngày; **giữ** phần của KH2, KH3 | — |
| `docs/js/so_thu_chi_tinh.js` | — | thêm `caChoices` | thêm hàm vẽ-số mới | — |
| `docs/js/pages/phieu_ca.js` | nút ✎ cạnh "Giờ doanh thu" | — | — | chỉ khi Task 4 bắt được chỗ tự ghi |
| tệp mới `docs/js/gio_chot.js`, `gio_chot_tinh.js` | tạo | — | — | — |
| `docs/js/app.js`, `docs/js/sb.js` | — | — | — | dải vàng, trang mới, báo lỗi chỉ đọc |
| Giả lập `stc_gia.js` / `stc_fixture.js` | thêm RPC giờ | thêm ca theo ngày nếu thiếu | — | — |
| Giả lập `ca_gia.js` | thêm RPC giờ | — | — | — |
| Giả lập `sb_gia.js` | — | — | — | Xem như |
| Bài thử Chrome | `flow_gio162` | `flow_stc11` | sửa `flow_stc1–10` + **cả `flow_gio162`, `flow_stc11`** nếu dò chỗ bị đổi; thêm `flow_stc12` | `flow_xn165`, `flow_xn164_quet` |

## Bàn giao từ lượt trước (người làm lượt sau đọc)

- **KH2 → KH3, KH4:** phần A của Đối soát Fabi có `<div class="stc-gio" data-gio-ca="<id>">` (dòng giờ) và nút `[data-gio]`. KH4 không được bỏ hai thứ này.
- **KH3 → KH4:** `addPanel` có hàm `fillCa()`, dòng nhắc `.stc-canote`, ô Ngày không còn bị khoá khi chọn ca. KH4 chỉ đổi **cách xếp** khung "+ Thêm phiếu" (2 hàng), sau đó `flow_stc11` vẫn phải đạt.
- **KH4 → KH1:** KH1 Task 4 dò mọi trang trong menu, nên dò luôn Sổ thu chi mới. Không có gì khác phải giữ.
- **Mã chết sau bước 158:** `isFin`, `D.finals`, `treoOf`, `D.treo` vẫn còn trong `so_thu_chi.js` nhưng luôn rỗng / false. Không lượt nào được dựa vào chúng cho luật mới. KH4 xoá được nếu chạm tới (không bắt buộc).
