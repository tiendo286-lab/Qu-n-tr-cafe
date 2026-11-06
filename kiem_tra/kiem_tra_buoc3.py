"""Kiểm tra tự động bước 3 (order ca) trên một BẢN SAO dữ liệu.

Chạy:  .venv-mac/bin/python kiem_tra/kiem_tra_buoc3.py
"""
import os
import re
import shutil
import sqlite3
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
tmp = Path(tempfile.mkdtemp())
src = next((ROOT / "du_lieu").glob("ban_sao_offline_*.sqlite3"))
shutil.copy(src, tmp / "test.sqlite3")
os.environ["APP_DB"] = str(tmp / "test.sqlite3")
os.environ["APP_SECRET_KEY"] = "test-secret"
sys.path.insert(0, str(ROOT))

import app.db as dbmod  # noqa: E402

dbmod.DATA_DIR = tmp
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

ok_count = 0


def check(cond, label):
    global ok_count
    if not cond:
        print("SAI:", label)
        sys.exit(1)
    ok_count += 1
    print("  ✓", label)


con = sqlite3.connect(tmp / "test.sqlite3")
con.row_factory = sqlite3.Row
q = lambda sql, *a: con.execute(sql, a).fetchall()  # noqa: E731
fmt = lambda dt: dt.strftime("%Y-%m-%dT%H:%M")  # noqa: E731

owner_pw = re.search(r"Mật khẩu tạm: (\S+)", (tmp / "MAT_KHAU_CHU_LAN_DAU.txt").read_text(encoding="utf-8")).group(1)
c = TestClient(app)
c.post("/dang-nhap", data={"ma": "admin", "mat_khau": owner_pw})
c.post("/doi-mat-khau", data={"mat_khau_moi": "chu12345", "nhap_lai": "chu12345"})


def login_emp(code, pw):
    eid = q("SELECT id FROM employees WHERE code=?", code)[0][0]
    temp = c.post(f"/quan-ly/nhan-vien/{eid}/mat-khau-tam").json()["password"]
    cl = TestClient(app)
    cl.post("/dang-nhap", data={"ma": code, "mat_khau": temp})
    cl.post("/doi-mat-khau", data={"mat_khau_moi": pw, "nhap_lai": pw})
    return cl, eid


print("Giờ order")
check(c.get("/quan-ly/gio-order").status_code == 200, "mở trang Giờ order")
c.post("/quan-ly/gio-order", data={"open_dow": "3", "open_time": "08:00", "close_dow": "0", "close_time": "22:00"})
check(q("SELECT value FROM settings WHERE key='order_close_dow'")[0][0] == "3", "hết hạn trước giờ mở bị từ chối")
c.post("/quan-ly/gio-order", data={"open_dow": "0", "open_time": "09:00", "close_dow": "3", "close_time": "21:30"})
check(q("SELECT value FROM settings WHERE key='order_close_time'")[0][0] == "21:30", "lưu giờ lặp lại hằng tuần")
next_start = date.today() - timedelta(days=date.today().weekday()) + timedelta(days=7)
nv, eid = login_emp("88", "nv888888")

print("Tạo tuần mới")
c.get("/quan-ly/gio-order")
r = c.get(f"/quan-ly/order?tuan={next_start.isoformat()}")
check(not q("SELECT 1 FROM weeks WHERE start_date=?", next_start.isoformat()), "xem tuần chưa có thì KHÔNG tự tạo")
check("chưa được tạo" in r.text and "Tạo tuần mới" in r.text, "hiện nút Tạo tuần mới")
check(next_start.strftime("%d/%m") + " –" not in c.get("/quan-ly/gio-order").text, "tab Giờ order ẩn tuần chưa tạo")
check("chưa mở tuần mới" in nv.get("/order").text, "tuần chưa tạo → nhân viên chưa order được")
c.post("/quan-ly/order/tao-tuan", data={"tuan": next_start.isoformat()})
week = q("SELECT * FROM weeks WHERE start_date=?", next_start.isoformat())[0]
check(week is not None, "bấm Tạo tuần mới → tạo tuần")
check(next_start.strftime("%d/%m") + " –" in c.get("/quan-ly/gio-order").text, "tuần đã tạo hiện trong tab Giờ order")
check(q("SELECT COUNT(*) FROM order_entries WHERE week_id=?", week["id"])[0][0] == 0, "tuần mới: mọi nhân viên Chưa order")
r = c.post("/quan-ly/order/tao-tuan", data={"tuan": next_start.isoformat()})
check("không thể tạo lại" in r.text, "tạo lại tuần đã có bị từ chối")
now = datetime.now()


def set_window(o, cl):
    c.post(f"/quan-ly/gio-order/tuan/{week['id']}", data={"open_at": fmt(o), "close_at": fmt(cl)})


set_window(now - timedelta(hours=1), now + timedelta(hours=2))
check(q("SELECT 1 FROM week_order_windows WHERE week_id=?", week["id"]), "cài giờ riêng cho một tuần")

print("Nhân viên order")
r = nv.get("/", follow_redirects=False)
check(r.headers.get("location") == "/order", "nhân viên vào thẳng màn hình Order ca")
page = nv.get("/order").text
check(page.count('type="radio"') == 42 and "Đang mở" in page, "lưới 21 ô, mỗi ô 2 lựa chọn, đang mở")
shift_ids = [r["id"] for r in q("SELECT id FROM shifts WHERE status='Đang sử dụng' ORDER BY sort_order, id")]
full = {f"c_{d}_{s}": ("ok" if (d + s) % 2 else "off") for d in range(7) for s in shift_ids}
partial = dict(list(full.items())[:18])
r_partial = nv.post("/order", data=partial)
check(not q("SELECT 1 FROM order_submissions WHERE week_id=? AND employee_id=?", week["id"], eid), "thiếu ô thì không gửi được")
check("Còn 3 ô" in r_partial.text, "báo còn 3 ô chưa chọn")
nv.post("/order", data=full)
check(q("SELECT 1 FROM order_submissions WHERE week_id=? AND employee_id=?", week["id"], eid), "đủ 21 ô → gửi được")
check(q("SELECT COUNT(*) FROM order_entries WHERE week_id=? AND employee_id=?", week["id"], eid)[0][0] == 21, "lưu đủ 21 ô")
check("Cập nhật order" in nv.get("/order").text, "đã gửi → nút thành Cập nhật order")

print("Quản lý theo dõi & sửa")
r = c.get(f"/quan-ly/order?tuan={next_start.isoformat()}")
check(r.status_code == 200 and "Ô đã sửa" in r.text, "mở màn hình theo dõi order")
sang = q("SELECT name FROM shifts WHERE id=?", shift_ids[0])[0][0]
old = q("SELECT status FROM order_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=?", week["id"], eid, sang)[0][0]
newc = "ok" if old == "NGHỈ" else "off"
r = c.post("/quan-ly/order/sua", json={"week_id": week["id"], "cells": [{"employee_id": eid, "weekday": 0, "shift": sang, "status": newc}]})
check(r.json()["ok"] and "Sửa bởi" in r.json()["cells"][0]["note"], "sửa một ô, có ghi ai sửa")
row = q("SELECT status, is_manual FROM order_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=?", week["id"], eid, sang)[0]
check(row["is_manual"] == 1, "ô bị sửa được đánh dấu chấm đỏ")
check(q("SELECT COUNT(*) FROM order_edit_log WHERE week_id=?", week["id"])[0][0] == 1, "ghi lịch sử sửa")
check("QL đã sửa" in nv.get("/order").text, "nhân viên thấy dấu QL đã sửa")
other = q("SELECT id FROM employees WHERE status='Đang làm' AND id<>? LIMIT 3", eid)
cells = [{"employee_id": o[0], "weekday": d, "shift": sang, "status": "off"} for o in other for d in range(7)]
check(len(c.post("/quan-ly/order/sua", json={"week_id": week["id"], "cells": cells}).json()["cells"]) == 21, "sửa nhanh nhiều ô một lần")
check(c.post("/quan-ly/order/sua", json={"week_id": week["id"], "cells": [{"employee_id": eid, "weekday": 9, "shift": sang, "status": "ok"}]}).status_code == 400, "ô không hợp lệ bị từ chối")
full2 = dict(full)
full2[f"c_0_{shift_ids[0]}"] = newc
nv.post("/order", data=full2)
check(q("SELECT is_manual FROM order_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=?", week["id"], eid, sang)[0][0] == 1, "nhân viên gửi lại giống ô QL sửa → giữ dấu")
nv.post("/order", data=full)
check(q("SELECT is_manual FROM order_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=?", week["id"], eid, sang)[0][0] == 0, "nhân viên đổi ô trước hạn → bỏ dấu QL")

print("Hết hạn / chưa mở")
set_window(now - timedelta(days=2), now - timedelta(hours=1))
nv.post("/order", data={k: "off" for k in full})
check(q("SELECT COUNT(*) FROM order_entries WHERE week_id=? AND employee_id=? AND status='NGHỈ'", week["id"], eid)[0][0] < 21, "sau hạn nhân viên không sửa được")
check("Đã hết hạn" in nv.get("/order").text, "báo đã hết hạn")
check(c.post("/quan-ly/order/sua", json={"week_id": week["id"], "cells": [{"employee_id": eid, "weekday": 1, "shift": sang, "status": "none"}]}).json()["ok"], "sau hạn quản lý vẫn sửa được")
set_window(now + timedelta(hours=5), now + timedelta(days=1))
check("Chưa mở" in nv.get("/order").text, "trước giờ mở báo Chưa mở")
c.post(f"/quan-ly/gio-order/tuan/{week['id']}", data={"reset": "1"})
check(not q("SELECT 1 FROM week_order_windows WHERE week_id=?", week["id"]), "về giờ mặc định")

print("Quyền")
ql, _ = login_emp("2", "ql222222")
check(ql.post("/quan-ly/order/tao-tuan", data={"tuan": (next_start + timedelta(days=14)).isoformat()}).status_code == 403, "Quản lý (mặc định) không tạo được tuần")
r = ql.get(f"/quan-ly/order?tuan={next_start.isoformat()}")
check(r.status_code == 200 and "chỉ có quyền xem" in r.text, "Quản lý (mặc định) chỉ xem order")
check(ql.post("/quan-ly/order/sua", json={"week_id": week["id"], "cells": []}).status_code == 403, "Quản lý (mặc định) không sửa được")
check(nv.get("/quan-ly/order").status_code == 403, "nhân viên không xem được order người khác")
check(ql.post(f"/quan-ly/order/xoa-tuan/{week['id']}", data={"xac_nhan": "XOA"}).status_code == 403, "chỉ Chủ xóa được dữ liệu tuần")

print("Xóa dữ liệu tuần")
c.post(f"/quan-ly/order/xoa-tuan/{week['id']}", data={"xac_nhan": "xoá"})
check(q("SELECT COUNT(*) FROM order_entries WHERE week_id=?", week["id"])[0][0] > 0, "gõ sai xác nhận → không xóa")
c.post(f"/quan-ly/order/xoa-tuan/{week['id']}", data={"xac_nhan": "XOA"})
check(q("SELECT COUNT(*) FROM order_entries WHERE week_id=?", week["id"])[0][0] == 0, "gõ XOA → xóa order tuần")
check(q("SELECT COUNT(*) FROM weekly_schedule_entries")[0][0] > 5000, "lịch đã xếp không bị ảnh hưởng")

print("Thêm ca")
c.post("/quan-ly/ca/them", data={"name": "Đêm", "code": "Đ"})
set_window(now - timedelta(hours=1), now + timedelta(hours=2))
check(nv.get("/order").text.count('type="radio"') == 56, "thêm ca thứ 4 → lưới 28 ô")
nv.post("/order", data=full)
check(not q("SELECT 1 FROM order_submissions WHERE week_id=? AND employee_id=?", week["id"], eid), "chỉ chọn 21/28 ô → không gửi được")

print("Dữ liệu cũ")
old_week = q("SELECT start_date FROM weeks WHERE id=72")[0][0]
r = c.get(f"/quan-ly/order?tuan={old_week}")
check(r.status_code == 200 and r.text.count('class="oc ') == 47 * 28, "xem được order cũ từ bản offline")

print(f"\nTẤT CẢ {ok_count} KIỂM TRA ĐỀU ĐẠT.")
shutil.rmtree(tmp, ignore_errors=True)
