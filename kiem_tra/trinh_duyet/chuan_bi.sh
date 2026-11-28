#!/bin/bash
# Dựng bản web chạy thử trên Chrome với Supabase GIẢ LẬP (không đụng dữ liệu thật).
# Dùng: kiem_tra/trinh_duyet/chuan_bi.sh <thư mục tạm>   rồi mở http://127.0.0.1:8765/index.html?auto=1&routes=...
set -e
D="$(cd "$(dirname "$0")" && pwd)"; GOC="$D/../../docs"; W="${1:?cần thư mục tạm}"
mkdir -p "$W"; rsync -a --exclude test "$GOC/" "$W/"; mkdir -p "$W/test"
cp "$D/sb_gia.js" "$W/js/sb.js"; cp "$D"/{ca_gia.js,viec_gia.js,tl_gia.js,flow_tl.js,dt_gia.js,dt_program.json,flow_dt.js,ht_gia.js,flow_ht.js,flow_viec.js,kt_gia.js,flow_kt.js,fin_gia.js,fund_gia.js,nh_gia.js,flow_ct.js,flow_ft.js,flow_tk.js,flow_sl.js,flow_nl.js,flow_nh.js,flow_dsdt.js,dg_gia.js,flow_dg.js,flow_dlg.js,cv_gia.js,flow_cv.js,flow_pq.js,flow_cm.js,fb_gia.js,flow_fb.js,flow_den.js,flow_cv46.js,flow_od48.js,flow_hl49.js,flow_cv50.js,flow_auto51.js,flow_pc54.js,flow_no55.js,flow_sua56.js,flow_ca57.js,flow_ck59.js,flow_ds60.js,flow_fabi61.js,flow_ck62.js,flow_nhw.js,flow_hh104.js,flow_hh106.js,flow_hhnv.js,flow_ghs.js,flow_hn62.js,flow_sua67.js,flow_fix74.js,flow_cw76.js,flow_cm84.js,flow_ds86.js,flow_ds93.js,flow_cn95.js,pc_gia.js,flow_pc109.js,flow_pcshot.js,flow_ck117.js,flow_kt118.js,flow_audit_ck_box.js,flow_audit_bg.js,flow_audit_ghi_chu.js,catch.js,driver.js,fuzz.js,flow.js,flow2.js,login.js,wide.js,phone.html} "$W/test/"
cp "$D/flow_x2p.js" "$D/flow_tick63.js" "$D/flow_thuno63c.js" "$D/flow_phieu63d.js" "$D/flow_nhom64.js" "$W/test/" 2>/dev/null || true   # chặng 6.2 trang Duyệt nghỉ & làm thay · 6.3 tích hết mỗi bước
cp "$D/flow_ds168.js" "$D/flow_ds171.js" "$D/flow_ds172.js" "$D/flow_ds173.js" "$D/flow_dsgate.js" "$W/test/"
cp "$D/flow_px105.js" "$D/flow_ql_tu_ds.js" "$D/flow_vt106.js" "$D/flow_vt107.js" "$D/flow_gh4.js" "$D/flow_bn133.js" "$D/flow_tocdo.js" "$D/flow_ck135.js" "$D/flow_fb136.js" "$W/test/"
if [ "${2:-}" = "--dao-tao-gia" ]; then
  cp "$D/dt_fixture.js" "$W/test/data.js"
else
  python3 -I "$D/dump_web.py" "$D/../../du_lieu/app.sqlite3" "$W/test/data.js"
fi
cp "$D/stc_gia.js" "$D/stc_fixture.js" "$D"/flow_stc*.js "$D/flow_cu152.js" "$D/flow_ds156.js" "$D/flow_gio162.js" "$D/flow_xn165.js" "$D/flow_xn165_quet.js" "$D/flow_ln167.js" "$W/test/" 2>/dev/null || true
cp "$D/flow_dt137.js" "$D/hn_gia.js" "$D/flow_hn138.js" "$D/flow_hd139.js" "$D/flow_nq141.js" "$D/flow_hn142.js" "$W/test/"
python3 - "$W/index.html" <<'PY'
import re,sys; p=sys.argv[1]; s=open(p).read()
s=re.sub(r'(<script type="module" src="js/app\.js(?:\?v=[^"]+)?"></script>)',r'<script src="test/catch.js"></script>\n\1\n<script type="module" src="test/driver.js"></script>',s,count=1)
open(p,'w').write(s)
PY
cp "$D/flow_dt169.js" "$D/flow_dtgop.js" "$D/menu_dt.js" "$W/test/"   # 28/11: trang Đào tạo gộp (flow_dt170 bỏ cùng thẻ Phân công / Chờ kiểm tra kiểu cũ)
cp "$D/flow_ln174.js" "$W/test/"
cp "$D/flow_hh_c4.js" "$W/test/"   # chặng 4
cp "$D/flow_dt_c4.js" "$W/test/"   # chặng 4: phiếu đào tạo theo tab ngày thật
cp "$D/flow_dsca.js" "$W/test/"   # đưa Đối soát Fabi về lại Chốt ca
cp "$D/flow_dsm1.js" "$W/test/"   # trang đối soát ca mới — đợt 1 (chỉ xem)
cp "$D/flow_dsm2.js" "$W/test/"   # trang đối soát ca mới — đợt 2 (sửa tại chỗ)
cp "$D/flow_dsm3.js" "$W/test/" 2>/dev/null || true   # đợt 3 (Hoàn thành mới)
cp "$D/flow_dsm4.js" "$W/test/" 2>/dev/null || true   # đợt 4 (chuyển hẳn, độc lập)
cp "$D/flow_pcdt.js" "$W/test/" 2>/dev/null || true   # tệp 174: phân công đào tạo theo ca
cp "$D/flow_bg8.js" "$W/test/"   # việc #8 (tệp 183): việc bàn giao chưa xong luôn hiện cho ca sau
cp "$D/flow_cm182.js" "$W/test/"   # tệp 182: chốt ca ngoài lịch (việc #11)
cp "$D/flow_hn_coso.js" "$W/test/"   # Việc hôm nay đợt 2: Theo dõi theo cơ sở
cp "$D/flow_v2711.js" "$W/test/"   # các việc anh chốt 27/11: thẻ ca, đầu trang điện thoại, số cảnh báo, IN HOA, tệp 188
cp "$D/flow_ck189.js" "$W/test/"   # tệp 189: ảnh bản cam kết đã ký
cp "$D/flow_ka_ca.js" "$W/test/"   # khoản âm nối với ca (cần web đủ dữ liệu)
cp "$D/flow_cl.js" "$W/test/"   # bảng Chênh lệch tiền (cần web đủ dữ liệu)
echo "Xong. Chạy: (cd \"$W\" && python3 -m http.server 8765 --bind 127.0.0.1)"
cp "$D/flow_ocfg.js" "$W/test/"   # cài đặt trang Order ca (tệp 192)
cp "$D/flow_dg193.js" "$W/test/"   # tệp 193: phiếu phạt tiền trong đánh giá
cp "$D/flow_nn200.js" "$W/test/"   # tệp 200: người ngoài làm ca
