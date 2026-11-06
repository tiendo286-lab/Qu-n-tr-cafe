"""Kiểm tra tự động bước 5 (cảnh báo, lịch nhân viên, thông báo) trên một BẢN SAO dữ liệu.

Chạy:  .venv-mac/bin/python kiem_tra/kiem_tra_buoc5.py
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


from app import notify  # noqa: E402

print("Cảnh báo")
check(q("SELECT version FROM web_schema_version")[0][0] >= 5, "đã nâng cấp dữ liệu lên bản 5")
ql, _ = login_emp("2", "ql222222")
check(nv88.get("/quan-ly/canh-bao").status_code == 403, "nhân viên không vào được tab Cảnh báo")
check(ql.get("/quan-ly/canh-bao").status_code == 403, "Quản lý (mặc định) không có quyền xếp lịch → không vào Cảnh báo")
r = c.get(f"/quan-ly/canh-bao?tuan={S}")
check(r.status_code == 200 and "chưa bắt đầu xếp lịch" in r.text, "tuần chưa xếp → báo chưa có cảnh báo")
set_window(now - timedelta(days=2), now - timedelta(hours=1))
c.post(f"/quan-ly/lich/bat-dau/{W}")
r = c.get(f"/quan-ly/canh-bao?tuan={S}")
for t in ("Ca thiếu người so với định biên", "Ca thiếu người Cấp 2 hoặc Quản lý", "Đã xếp người order Nghỉ", "Đã xếp người Chưa order",
          "Xếp vượt định biên", "Làm thông 3 ca", "Số ca mỗi người trong tuần"):
    check(t in r.text, f"Cảnh báo có nhóm: {t}")
check("Xem trên lịch" in r.text and "/quan-ly/lich-co-so?tuan=" in r.text, "mỗi cảnh báo có nút Xem trên lịch")
check("class=\"tile\"" in r.text and "badge" in r.text, "có ô tổng hợp trên đầu + số cảnh báo ở menu")
check("Đã xếp 0/" in r.text or "Đã xếp " in r.text, "chi tiết cảnh báo thiếu người nêu số đã xếp / cần")

print("Lịch nhân viên – chưa chốt")
sang = q("SELECT name FROM shifts WHERE id=?", shift_ids[0])[0][0]
xep = lambda cl, **k: cl.post("/quan-ly/lich/xep", json={"week_id": W, "slot": 0, "prev_employee_id": None, **k})  # noqa: E731
c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
check(xep(c, branch_id=LHP, weekday=1, shift=sang, role="Chạy bàn", employee_id=e88).json()["ok"], "xếp 88 vào LHP thứ 3")
r = nv88.get("/lich")
check(r.status_code == 200 and "Chưa có lịch tuần nào được chốt" in r.text, "chưa chốt → nhân viên không thấy lịch")
check("Chưa có lịch tuần nào được chốt" in nv88.get("/lich/co-so").text, "chưa chốt → không thấy lịch cơ sở")

print("Chốt → nhân viên xem lịch")
c.post(f"/quan-ly/lich/chot/{W}")
r = nv88.get(f"/lich?tuan={S}")
hours = q("SELECT bs.start_time, bs.end_time FROM branch_shifts bs JOIN shifts s ON s.id=bs.shift_id WHERE bs.branch_id=? AND s.name=?", LHP, sang)[0]
check("Đã chốt · 1 ca" in r.text and sang in r.text and "LHP" in r.text and "Chạy bàn" in r.text, "Lịch của tôi: hiện ca, chi nhánh, vị trí")
check(hours[0][:5] + "–" + hours[1][:5] in r.text, "Lịch của tôi: hiện giờ ca theo chi nhánh")
check("upd-banner" not in r.text and "chip-new" not in r.text, "lịch chốt lần đầu: không có khung Mới cập nhật")
r = yenc.get(f"/lich?tuan={S}")
check("Lịch của tôi" in r.text and r.status_code == 200, "nhân viên khác cũng xem được lịch của mình")
r = nv88.get(f"/lich/co-so?tuan={S}&cn={LHP}&ngay=1")
check(r.status_code == 200 and "LHP" in r.text and "grid7" in r.text, "Lịch cơ sở của nhân viên mở được (chọn chi nhánh + ngày)")
check("Bạn" in r.text and "me-chip" in r.text, "Lịch cơ sở: đánh dấu “Bạn” ở ca của mình")
check(all(x not in r.text for x in ("ĐỂ TRỐNG", "Ngoài định biên", "NGOÀI ĐỊNH BIÊN", "Tổng ca", "TỔNG CA", "CHƯA ORDER", "Chưa order")),
      "Lịch cơ sở nhân viên rút gọn: ẩn ô trống, ngoài định biên, tổng ca, nhãn order")
for b in ("ĐK", "HS", "LL"):
    check(nv88.get(f"/lich/co-so?tuan={S}&cn={q('SELECT id FROM branches WHERE code=?', b)[0][0]}").status_code == 200, f"xem được lịch cơ sở {b}")
name88 = q("SELECT name FROM employees WHERE id=?", e88)[0][0]
check(name88 in nv88.get(f"/lich/co-so?tuan={S}&cn={LHP}&ngay=1").text, "thấy tên người được xếp trong lịch cơ sở")
check(c.get("/lich").status_code == 200 and c.get("/lich/co-so").status_code == 200, "Chủ xem được lịch cơ sở (không có lịch cá nhân)")

print("Đang chỉnh sửa – vẫn thấy bản chốt cũ")
c.post(f"/quan-ly/lich/mo-lai/{W}")
c.get(f"/quan-ly/lich-co-so?tuan={S}&cn={LHP}")
xep(c, branch_id=LHP, weekday=1, shift=sang, role="Chạy bàn", employee_id=None, prev_employee_id=e88)
xep(c, branch_id=LHP, weekday=4, shift=sang, role="Chạy bàn", employee_id=e88)
r = nv88.get(f"/lich?tuan={S}")
check(sang in r.text and "bản đã chốt gần nhất" in r.text and "Thứ 3" in r.text and "Không có ca" in r.text, "đang chỉnh sửa: NV vẫn thấy bản cũ + ghi chú")
c.post(f"/quan-ly/lich/chot/{W}")
r = nv88.get(f"/lich?tuan={S}")
check("upd-banner" in r.text and "2 thay đổi" in r.text and "đã bị hủy" in r.text, "chốt lại: khung cập nhật nêu đủ 2 thay đổi, gồm ca bị hủy")
check("chip-new" in r.text and "Ca mới được xếp thêm" in r.text, "ca mới thêm được đánh dấu Mới cập nhật + ghi chú")
check("upd-banner" not in nv88.get(f"/lich?tuan={S}").text, "mở lần sau: khung cập nhật đã tắt")

print("Thông báo")
r = nv88.get("/thong-bao")
check(r.status_code == 200 and "đã được chốt" in r.text, "trang Thông báo liệt kê thông báo chốt")
check(q("SELECT COUNT(*) FROM notifications WHERE account_id=(SELECT id FROM accounts WHERE employee_id=?) AND read_at IS NULL", e88)[0][0] == 0, "mở trang → đánh dấu đã đọc")
ql_acc = q("SELECT a.id FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.code='2'")[0][0]
unread_ql = q("SELECT COUNT(*) FROM notifications WHERE account_id=? AND read_at IS NULL", ql_acc)[0][0]
r = ql.get("/")
check(unread_ql > 0 and f'class="badge">{unread_ql}<' in r.text, f"menu quản lý hiện số chưa đọc ({unread_ql})")
r = nv88.get("/order")
check('class="tabbar"' in r.text and "Lịch làm" in r.text and 'class="bell"' in r.text, "nhân viên có chuông Thông báo ở đầu + thanh Order ca / Lịch làm")
check("/thong-bao" in c.get("/").text, "quản lý có mục Thông báo trong menu")
check("chưa đọc" in ql.get("/thong-bao").text, "trang Thông báo hiện số chưa đọc")

print("Thông báo tự động")
S2 = (start + timedelta(days=7)).isoformat()
c.post("/quan-ly/order/tao-tuan", data={"tuan": S2})
W2 = q("SELECT id FROM weeks WHERE start_date=?", S2)[0][0]
c.post(f"/quan-ly/gio-order/tuan/{W2}", data={"open_at": fmt(now - timedelta(hours=1)), "close_at": fmt(now + timedelta(hours=2))})
n_acc = q("SELECT COUNT(*) FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.status='Đang làm'")[0][0]
con2 = dbmod.connect()
sent = notify.run_due(con2)
check(sent["mo"] == n_acc and n_acc > 0, f"order mở → báo cho mọi nhân viên ({n_acc})")
check(sent["sap_het_han"] == n_acc, "còn dưới 3 giờ → nhắc người chưa order")
sent2 = notify.run_due(con2)
check(sent2["mo"] == 0 and sent2["sap_het_han"] == 0, "chạy lại không gửi trùng")
nv88.post("/order", data=allok)  # tuần kế tiếp (S) – không phải S2; kiểm tra người đã order không bị nhắc ở tuần có order
c.post(f"/quan-ly/gio-order/tuan/{W2}", data={"open_at": fmt(now - timedelta(hours=1)), "close_at": fmt(now + timedelta(hours=10))})
sent3 = notify.run_due(con2)
check(sent3["mo"] == 0 and sent3["sap_het_han"] == 0, "hạn còn xa → chưa nhắc")
con2.execute("INSERT INTO notifications(account_id, title, body, created_at) SELECT id, 'cũ', '', ? FROM accounts LIMIT 1",
             ((now - timedelta(days=61)).strftime("%Y-%m-%d %H:%M:%S"),))
sent4 = notify.run_due(con2)
check(sent4["don"] >= 1 and not con2.execute("SELECT 1 FROM notifications WHERE title='cũ'").fetchone(), "thông báo quá 60 ngày tự xóa")
con2.close()

print(f"\nTẤT CẢ {ok_count} KIỂM TRA ĐỀU ĐẠT.")
shutil.rmtree(tmp, ignore_errors=True)
