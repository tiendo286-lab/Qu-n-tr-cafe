#!/bin/bash
# Bấm đúp file này trên Mac để chạy thử web.
cd "$(dirname "$0")" || exit 1

pause_exit() { echo; read -r -p "Bấm Enter để đóng..." _; exit "${1:-1}"; }

if ! command -v python3 >/dev/null 2>&1; then
  echo "Máy chưa có Python 3. Mở Terminal, gõ: xcode-select --install  rồi chạy lại file này."
  pause_exit 1
fi
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'; then
  echo "Cần Python 3.9 trở lên. Phiên bản hiện tại: $(python3 --version)"
  pause_exit 1
fi

if [ ! -x ".venv-mac/bin/python" ]; then
  echo "Lần đầu chạy: đang tạo môi trường Python..."
  python3 -m venv .venv-mac || pause_exit 1
fi
echo "Đang kiểm tra thư viện..."
./.venv-mac/bin/python -m pip install -q --upgrade pip >/dev/null 2>&1
./.venv-mac/bin/python -m pip install -q -r requirements.txt || { echo "Không cài được thư viện. Kiểm tra kết nối mạng."; pause_exit 1; }

mkdir -p du_lieu
if [ ! -f du_lieu/app.sqlite3 ]; then
  SRC="$HOME/Library/Application Support/QuanTriLichLamCafe/xep_lich.sqlite3"
  if [ -f "$SRC" ]; then
    echo "Sao chép dữ liệu từ bản offline (bản gốc không bị thay đổi)..."
    ./.venv-mac/bin/python - "$SRC" <<'PY' || pause_exit 1
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
dst = sqlite3.connect("du_lieu/app.sqlite3")
src.backup(dst)
dst.close(); src.close()
print("Đã sao chép xong.")
PY
  else
    echo "Không tìm thấy dữ liệu bản offline tại:"
    echo "  $SRC"
    echo "Hãy chép file xep_lich.sqlite3 vào thư mục du_lieu và đổi tên thành app.sqlite3."
    pause_exit 1
  fi
fi

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo
echo "==============================================================="
echo " Web đang chạy. Trên máy này mở:  http://127.0.0.1:8000"
if [ -n "$LAN_IP" ]; then
echo " Điện thoại cùng Wi-Fi mở:        http://$LAN_IP:8000"
fi
echo " Tài khoản Chủ lần đầu: xem file du_lieu/MAT_KHAU_CHU_LAN_DAU.txt"
echo " Muốn dừng web: đóng cửa sổ này (hoặc bấm Ctrl + C)."
echo "==============================================================="
( sleep 3; open "http://127.0.0.1:8000" ) &
./.venv-mac/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause_exit 0
