#!/bin/sh
# Chạy 1 bài thử SQL kiểu "REPORT>>" trên Postgres cục bộ và trả mã lỗi nếu có dòng HỎNG hoặc không ra báo cáo.
# Dùng: sh kiem_tra/may_chu_cuc_bo/dat.sh <đường dẫn python của venv pgserver> <bài thử .sql>     (biến PG_DIR như README)
py="${1:?cần đường dẫn python của venv pgserver}"; f="${2:?cần tệp bài thử .sql}"
cd "$(dirname "$0")/../.." || exit 1
out=$("$py" kiem_tra/may_chu_cuc_bo/chay.py "$f" 2>&1 | grep -v '^NOTICE')
echo "$out"
echo "$out" | grep -q 'REPORT>>' || { echo "KẾT QUẢ: HỎNG — bài thử không chạy tới báo cáo"; exit 1; }
if echo "$out" | grep -q 'HỎNG'; then echo "KẾT QUẢ: HỎNG — $(echo "$out" | grep -c 'HỎNG') dòng hỏng"; exit 1; fi
echo "KẾT QUẢ: ĐẠT $(echo "$out" | grep -c '^ĐẠT') dòng, 0 hỏng"
