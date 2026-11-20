#!/bin/sh
# Chạy mọi bài thử hàm tính thuần của Sổ thu chi (máy không có node → dùng jsc có sẵn của macOS). Có bài hỏng thì trả mã lỗi.
J=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
cd "$(dirname "$0")/.." || exit 1
bad=0
for f in kiem_tra/so_thu_chi_tinh_dot*.mjs kiem_tra/gio_chot_tinh_162.mjs; do
  out=$("$J" -m "$f" 2>&1 | tail -1)
  case "$out" in ĐẠT*) echo "$f: $out" ;; *) echo "$f: HỎNG — $out"; bad=1 ;; esac
done
exit $bad
