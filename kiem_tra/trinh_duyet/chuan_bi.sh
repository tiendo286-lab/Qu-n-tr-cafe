#!/bin/bash
# Dựng bản web chạy thử trên Chrome với Supabase GIẢ LẬP (không đụng dữ liệu thật).
# Dùng: kiem_tra/trinh_duyet/chuan_bi.sh <thư mục tạm>   rồi mở http://127.0.0.1:8765/index.html?auto=1&routes=...
set -e
D="$(cd "$(dirname "$0")" && pwd)"; GOC="$D/../../docs"; W="${1:?cần thư mục tạm}"
mkdir -p "$W"; rsync -a --exclude test "$GOC/" "$W/"; mkdir -p "$W/test"
cp "$D/sb_gia.js" "$W/js/sb.js"; cp "$D"/{ca_gia.js,viec_gia.js,tl_gia.js,flow_tl.js,dt_gia.js,dt_program.json,flow_dt.js,ht_gia.js,flow_ht.js,flow_ca.js,flow_viec.js,kt_gia.js,flow_kt.js,fin_gia.js,fund_gia.js,nh_gia.js,flow_ct.js,flow_ft.js,flow_ds.js,flow_wz.js,flow_tk.js,flow_sl.js,flow_nl.js,flow_tc.js,flow_sq.js,flow_qn.js,flow_nh.js,flow_dsdt.js,dg_gia.js,flow_dg.js,flow_dlg.js,cv_gia.js,flow_cv.js,flow_pq.js,flow_cm.js,catch.js,driver.js,fuzz.js,flow.js,flow2.js,login.js,wide.js,phone.html} "$W/test/"
python3 -I "$D/dump_web.py" "$D/../../du_lieu/app.sqlite3" "$W/test/data.js"
python3 - "$W/index.html" <<'PY'
import sys; p=sys.argv[1]; s=open(p).read()
s=s.replace('<script type="module" src="js/app.js"></script>','<script src="test/catch.js"></script>\n<script type="module" src="js/app.js"></script>\n<script type="module" src="test/driver.js"></script>')
open(p,'w').write(s)
PY
echo "Xong. Chạy: (cd \"$W\" && python3 -m http.server 8765 --bind 127.0.0.1)"
