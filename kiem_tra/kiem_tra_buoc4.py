"""Kiểm tra tự động bước 4 (xếp lịch cơ sở, khóa, chốt tuần) trên một BẢN SAO dữ liệu.

Chạy:  .venv-mac/bin/python kiem_tra/kiem_tra_buoc4.py
"""
import json
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
payload = lambda html: json.loads(re.search(r"const P = (\{.*?\});\n", html, re.S).group(1))  # noqa: E731

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


now = datetime.now()
start = date.today() - timedelta(days=date.today().weekday()) + timedelta(days=7)
S = start.isoformat()
c.post("/quan-ly/order/tao-tuan", data={"tuan": S})
week = q("SELECT * FROM weeks WHERE start_date=?", S)[0]
W = week["id"]
LL = q("SELECT id FROM branches WHERE code='LL'")[0][0]
LHP = q("SELECT id FROM branches WHERE code='LHP'")[0][0]
HS = q("SELECT id FROM branches WHERE code='HS'")[0][0]
yen = q("SELECT id FROM employees WHERE code='12'")[0][0]  # LL, Chạy bàn + Pha chế, Quản lý, có lịch cố định


def set_window(o, cl):
    c.post(f"/quan-ly/gio-order/tuan/{W}", data={"open_at": fmt(o), "close_at": fmt(cl)})


# Order: Yến đi làm được cả tuần; 88 (LHP, ĐK) đi làm được cả tuần
set_window(now - timedelta(hours=1), now + timedelta(hours=1))
nv88, e88 = login_emp("88", "nv888888")
yenc, _ = login_emp("12", "yen12345")
shift_ids = [r["id"] for r in q("SELECT id FROM shifts WHERE status='Đang sử dụng' ORDER BY sort_order, id")]
allok = {f"c_{d}_{s}": "ok" for d in range(7) for s in shift_ids}
nv88.post("/order", data=allok)
yenc.post("/order", data=allok)

print("Bắt đầu xếp lịch")
r = c.get(f"/quan-ly/order?tuan={S}")
check("Mở sau giờ hết hạn order" in r.text, "chưa hết hạn → nút Bắt đầu xếp lịch bị khóa")
c.post(f"/quan-ly/lich/bat-dau/{W}")
check(not q("SELECT 1 FROM schedule_closures WHERE week_id=?", W), "chưa hết hạn → không bắt đầu được")
set_window(now - timedelta(days=2), now - timedelta(hours=1))
c.post(f"/quan-ly/lich/bat-dau/{W}")
check(q("SELECT status FROM schedule_closures WHERE week_id=?", W)[0][0] == "ĐANG XẾP", "hết hạn → bắt đầu xếp lịch")
n_active = q("SELECT COUNT(*) FROM employees WHERE status='Đang làm'")[0][0]
check(q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id=?", W)[0][0] == n_active * 21, "tạo ô lịch cho mọi nhân viên")
n_fixed_yen = q("SELECT COUNT(*) FROM fixed_schedule_entries WHERE employee_id=?", yen)[0][0]
fx = q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id=? AND employee_id=? AND source='FIXED' AND state='ĐÃ XẾP'", W, yen)[0][0]
check(fx == n_fixed_yen and fx > 0, f"tự đưa lịch cố định vào ({fx} ca của Yến)")
others_fixed = q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id=? AND source='FIXED' AND employee_id<>?", W, yen)[0][0]
check(others_fixed == 0, "người có lịch cố định nhưng Chưa order → không tự xếp")
check("Mở lịch cơ sở" in c.get(f"/quan-ly/order?tuan={S}").text, "trang order hiện trạng thái đang xếp")

print("Quay lại order")
c.post(f"/quan-ly/lich/quay-lai/{W}")
check(not q("SELECT 1 FROM schedule_closures WHERE week_id=?", W), "chưa xếp tay → quay lại order được")
check(q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id=?", W)[0][0] == 0, "quay lại → xóa ô lịch cố định đã điền")
c.post(f"/quan-ly/lich/bat-dau/{W}")

print("Màn hình lịch cơ sở")
r = c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
P = payload(r.text)
check(r.status_code == 200 and P["can_edit"], "Chủ mở lịch cơ sở, giữ quyền xếp")
check(len(P["shifts"]) == 3 and P["req"], "có ca và định biên của chi nhánh")
sang = q("SELECT name FROM shifts WHERE id=?", shift_ids[0])[0][0]
xep = lambda cl, **k: cl.post("/quan-ly/lich/xep", json={"week_id": W, "slot": 0, "prev_employee_id": None, **k})  # noqa: E731
r = xep(c, branch_id=LHP, weekday=0, shift=sang, role="Pha chế", employee_id=yen)
check(r.status_code == 400 and "chi nhánh" in r.json()["message"], "không xếp người không khai báo ở chi nhánh")
r = xep(c, branch_id=LHP, weekday=0, shift=sang, role="Chạy bàn", employee_id=e88)
check(r.json()["ok"], "xếp 88 vào LHP Sáng thứ 2")
r = xep(c, branch_id=q("SELECT id FROM branches WHERE code='ĐK'")[0][0], weekday=0, shift=sang, role="Chạy bàn", employee_id=e88)
check(r.status_code == 400 and "đã được xếp" in r.json()["message"], "không xếp một người 2 nơi cùng ca")
check(q("SELECT source FROM weekly_schedule_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=?", W, e88, sang)[0][0] == "MANUAL", "ô xếp tay ghi nguồn MANUAL")
c.post(f"/quan-ly/lich/quay-lai/{W}")
check(q("SELECT 1 FROM schedule_closures WHERE week_id=?", W), "đã xếp tay → không quay lại order được")

print("Vượt định biên")
r = c.post("/quan-ly/lich/vuot", json={"week_id": W, "branch_id": LHP, "shift": sang, "role": "Pha chế", "delta": 1})
check(r.json()["count"] == 1, "thêm hàng vượt định biên")
r = c.post("/quan-ly/lich/vuot", json={"week_id": W, "branch_id": LHP, "shift": sang, "role": "Pha chế", "delta": -1})
check(r.json()["count"] == 0, "xóa hàng vượt định biên trống")

# xóa hàng vượt định biên còn người → bỏ xếp người trong hàng
r = c.post("/quan-ly/lich/vuot", json={"week_id": W, "branch_id": LHP, "shift": sang, "role": "Pha chế", "delta": 1})
mr = max(payload(c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}").text)["req"].get(f"{d}|{sang}|Pha chế", 0) for d in range(7))
pc = q("SELECT e.id FROM employees e JOIN employee_branches b ON b.employee_id=e.id AND b.branch_id=? JOIN employee_roles r ON r.employee_id=e.id AND r.role='Pha chế' WHERE e.status='Đang làm' LIMIT 1", LHP)[0][0]
r = xep(c, branch_id=LHP, weekday=6, shift=sang, role="Pha chế", employee_id=pc, slot=mr)
check(r.json()["ok"], "xếp người vào hàng vượt định biên")
r = c.post("/quan-ly/lich/vuot", json={"week_id": W, "branch_id": LHP, "shift": sang, "role": "Pha chế", "delta": -1})
check(r.json()["count"] == 0 and r.json()["removed"] == 1, "xóa hàng vượt định biên còn người vẫn được")
check(not q("SELECT 1 FROM weekly_schedule_entries WHERE week_id=? AND employee_id=? AND weekday=6 AND shift=? AND state='ĐÃ XẾP' AND role='Pha chế' AND branch_id=?", W, pc, sang, LHP), "người trong hàng bị xóa được bỏ xếp")

print("Khóa xếp lịch")
qlt, _ = login_emp("NV01", "tung1234")
tung_acc = q("SELECT a.id FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.code='NV01'")[0][0]
c.post("/quan-ly/phan-quyen/vai-tro", json={"account_id": tung_acc, "role": "ql_tong"})
r = qlt.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
check(not payload(r.text)["can_edit"] and "đang ở chế độ chỉ xem" in r.text, "người thứ hai chỉ xem, thấy ai đang xếp")
r = xep(qlt, branch_id=LHP, weekday=1, shift=sang, role="Chạy bàn", employee_id=e88)
check(r.status_code == 409, "người thứ hai không xếp được")
c.post(f"/quan-ly/lich/nha-khoa/{W}")
r = qlt.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
check(payload(r.text)["can_edit"], "người đầu nhả quyền → người sau được xếp")
r = c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
check("Giành quyền xếp" in r.text, "Chủ thấy nút Giành quyền xếp")
c.post(f"/quan-ly/lich/gianh-quyen/{W}")
check(xep(qlt, branch_id=LHP, weekday=1, shift=sang, role="Chạy bàn", employee_id=e88).status_code == 409, "bị giành quyền → không xếp được nữa")
check(qlt.get(f"/quan-ly/lich/phien-ban/{W}").json()["mine"] is False, "màn hình người bị giành biết mất quyền")
q("UPDATE schedule_locks SET last_seen=? WHERE week_id=?", (now - timedelta(minutes=20)).strftime("%Y-%m-%d %H:%M:%S"), W)
con.commit()
check(xep(qlt, branch_id=LHP, weekday=1, shift=sang, role="Chạy bàn", employee_id=e88).json()["ok"], "15 phút không thao tác → quyền tự nhả")
qlt.post(f"/quan-ly/lich/nha-khoa/{W}")
c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")

print("Sửa order sau khi đã xếp (3a)")
c.post("/quan-ly/order/sua", json={"week_id": W, "cells": [{"employee_id": e88, "weekday": 0, "shift": sang, "status": "off"}]})
row = q("SELECT state, base_status, branch_id FROM weekly_schedule_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=?", W, e88, sang)[0]
check(row["state"] == "ĐÃ XẾP" and row["base_status"] == "NGHỈ", "order đổi sang Nghỉ → vẫn giữ trên lịch, ghi trạng thái gốc Nghỉ")
summ = c.get(f"/quan-ly/lich/tom-tat/{W}").json()
check(summ["xep_nghi"] == 1, "cảnh báo: đã xếp người order Nghỉ")
check(summ["thieu"] > 0 and summ["thieu_cap2"] > 0, "có cảnh báo thiếu người / thiếu Cấp 2+")

print("Chốt tuần")
ql, _ = login_emp("2", "ql222222")
check(ql.post(f"/quan-ly/lich/chot/{W}").status_code == 403, "Quản lý (mặc định) không chốt được")
r = ql.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
check(r.status_code == 200 and not payload(r.text)["can_edit"], "Quản lý xem được lịch cơ sở, không sửa")
c.post(f"/quan-ly/lich/chot/{W}")
check(q("SELECT status FROM schedule_closures WHERE week_id=?", W)[0][0] == "ĐÃ CHỐT", "chốt tuần")
pub = q("SELECT COUNT(*) FROM schedule_published WHERE week_id=?", W)[0][0]
asg = q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id=? AND state='ĐÃ XẾP'", W)[0][0]
check(pub == asg and pub > 0, f"lưu bản chốt cho nhân viên xem ({pub} ca)")
n_notif = q("SELECT COUNT(*) FROM notifications WHERE title LIKE 'Lịch tuần % đã được chốt'")[0][0]
check(n_notif == n_active, "gửi thông báo 'đã được chốt' cho mọi nhân viên")
check(xep(c, branch_id=LHP, weekday=2, shift=sang, role="Chạy bàn", employee_id=e88).status_code == 409, "đã chốt → không xếp được")
check(not payload(c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}").text)["can_edit"], "đã chốt → lịch chỉ xem")
req_before = q("SELECT staffing_snapshot_json FROM schedule_closures WHERE week_id=?", W)[0][0]
q("UPDATE staffing_requirements SET required_count=9 WHERE branch_id=?", LHP)
con.commit()
P = payload(c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}").text)
check(req_before and 9 not in P["req"].values(), "đã chốt → giữ định biên lúc chốt")

print("Mở lại và chốt lại")
c.post(f"/quan-ly/lich/mo-lai/{W}")
check(q("SELECT status FROM schedule_closures WHERE week_id=?", W)[0][0] == "ĐANG CHỈNH SỬA", "mở lại tuần")
c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
xep(c, branch_id=LHP, weekday=0, shift=sang, role="Chạy bàn", employee_id=None, prev_employee_id=e88)
xep(c, branch_id=LHP, weekday=3, shift=sang, role="Chạy bàn", employee_id=e88)
check(q("SELECT COUNT(*) FROM schedule_published WHERE week_id=? AND employee_id=? AND weekday=0", W, e88)[0][0] == 1, "đang sửa → nhân viên vẫn thấy bản chốt cũ")
c.post(f"/quan-ly/lich/chot/{W}")
acc88 = q("SELECT id FROM accounts WHERE employee_id=?", e88)[0][0]
n = q("SELECT body FROM notifications WHERE account_id=? AND title LIKE '%đã thay đổi'", acc88)
check(len(n) == 1 and "đã bị hủy" in n[0][0] and "xếp thêm" in n[0][0], "chốt lại → báo đúng người có ca thay đổi (hủy + thêm)")
check(q("SELECT COUNT(*) FROM notifications WHERE title LIKE '%đã thay đổi'")[0][0] == 1, "người không đổi ca không nhận thông báo")

print("Dữ liệu cũ")
old = q("SELECT start_date FROM weeks WHERE id=72")[0][0]
r = c.get(f"/quan-ly/lich-co-so?tuan={old}&cn={LL}")
P = payload(r.text)
check(r.status_code == 200 and len(P["assign"]) > 100, f"mở được lịch đã xếp ở bản offline ({len(P['assign'])} ca)")

print(f"\nTẤT CẢ {ok_count} KIỂM TRA ĐỀU ĐẠT.")
shutil.rmtree(tmp, ignore_errors=True)
