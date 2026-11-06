"""Kiểm tra tự động bước 1 trên một BẢN SAO dữ liệu (không đụng du_lieu/app.sqlite3).

Chạy:  .venv-mac/bin/python kiem_tra/kiem_tra_buoc1.py
"""
import os
import re
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
tmp = Path(tempfile.mkdtemp())
src = next((ROOT / "du_lieu").glob("ban_sao_offline_*.sqlite3"))
shutil.copy(src, tmp / "test.sqlite3")
os.environ["APP_DB"] = str(tmp / "test.sqlite3")
os.environ["APP_SECRET_KEY"] = "test-secret"
sys.path.insert(0, str(ROOT))

import app.db as dbmod  # noqa: E402

dbmod.DATA_DIR = tmp  # file mật khẩu Chủ ghi vào thư mục tạm
from fastapi.testclient import TestClient  # noqa: E402

from app import routes_auth  # noqa: E402
from app.main import app  # noqa: E402

sent = []
routes_auth.send_email = lambda to, subject, body: sent.append((to, body))
routes_auth.email_configured = lambda: True

ok_count = 0


def check(cond, label):
    global ok_count
    if not cond:
        print("SAI:", label)
        sys.exit(1)
    ok_count += 1
    print("  ✓", label)


def login(client, ma, pw):
    return client.post("/dang-nhap", data={"ma": ma, "mat_khau": pw}, follow_redirects=False)


con = sqlite3.connect(tmp / "test.sqlite3")
con.row_factory = sqlite3.Row

print("Tài khoản & dữ liệu")
n_emp = con.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
n_acc = con.execute("SELECT COUNT(*) FROM accounts WHERE employee_id IS NOT NULL").fetchone()[0]
check(n_emp == n_acc, f"mỗi nhân viên có 1 tài khoản ({n_acc}/{n_emp})")
check(con.execute("SELECT COUNT(*) FROM accounts WHERE system_role='ql'").fetchone()[0] == 4, "4 người cấp Quản lý → vai trò Quản lý")
owner_pw = re.search(r"Mật khẩu tạm: (\S+)", (tmp / "MAT_KHAU_CHU_LAN_DAU.txt").read_text(encoding="utf-8")).group(1)
check(con.execute("SELECT COUNT(*) FROM weekly_schedule_entries").fetchone()[0] > 5000, "dữ liệu lịch cũ vẫn nguyên")

print("Chủ đăng nhập lần đầu")
owner = TestClient(app)
r = owner.get("/", follow_redirects=False)
check(r.status_code == 303 and r.headers["location"] == "/dang-nhap", "chưa đăng nhập → về trang đăng nhập")
check(login(owner, "admin", "sai").status_code == 200, "sai mật khẩu bị từ chối")
r = login(owner, "admin", owner_pw)
check(r.headers["location"] == "/doi-mat-khau", "mật khẩu tạm → bắt đổi mật khẩu")
check(owner.get("/", follow_redirects=False).headers["location"] == "/doi-mat-khau", "chưa đổi thì không vào được trang khác")
r = owner.post("/doi-mat-khau", data={"mat_khau_moi": "123", "nhap_lai": "123"})
check("ít nhất 6" in r.text, "mật khẩu dưới 6 ký tự bị từ chối")
r = owner.post("/doi-mat-khau", data={"mat_khau_moi": "chu12345", "nhap_lai": "chu12345"}, follow_redirects=False)
check(r.status_code == 303, "đổi mật khẩu thành công")
check(owner.get("/").status_code == 200, "vào trang chủ")

print("Phân quyền")
r = owner.get("/quan-ly/phan-quyen")
check(r.status_code == 200 and "Quyền theo vai trò" in r.text, "Chủ mở được tab Phân quyền")
check(owner.post("/quan-ly/phan-quyen/quyen", json={"role": "nv", "perm": "xep_lich", "allowed": True}).status_code == 400,
      "không cấp được quyền xếp lịch cho Nhân viên")
check(owner.post("/quan-ly/phan-quyen/quyen", json={"role": "ql", "perm": "quan_ly_nhan_vien", "allowed": True}).json()["ok"],
      "bật quyền cho Quản lý")
owner.post("/quan-ly/phan-quyen/quyen", json={"role": "ql", "perm": "quan_ly_nhan_vien", "allowed": False})
tung = con.execute("SELECT a.id, e.id AS eid FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.code='NV01'").fetchone()
check(owner.post("/quan-ly/phan-quyen/vai-tro", json={"account_id": tung["id"], "role": "ql_tong"}).json()["ok"], "gán Quản lý tổng")
chu_id = con.execute("SELECT id FROM accounts WHERE system_role='chu'").fetchone()[0]
check(owner.post("/quan-ly/phan-quyen/vai-tro", json={"account_id": chu_id, "role": "nv"}).status_code == 400, "không đổi được vai trò Chủ")

print("Cấp mật khẩu tạm")
emp = con.execute("SELECT id FROM employees WHERE code='88'").fetchone()
check(owner.get("/quan-ly/nhan-vien").status_code == 200, "mở trang Nhân viên")
temp88 = owner.post(f"/quan-ly/nhan-vien/{emp['id']}/mat-khau-tam").json()["password"]
check(len(temp88) == 8, "cấp mật khẩu tạm 8 ký tự")
check(owner.post(f"/quan-ly/nhan-vien/{emp['id']}/cap-bac", json={"rank": "Cấp 9"}).status_code == 400, "cấp bậc sai bị từ chối")
check(owner.post(f"/quan-ly/nhan-vien/{emp['id']}/cap-bac", json={"rank": "Cấp 2"}).json()["ok"], "sửa nhanh cấp bậc")
con.execute("UPDATE employees SET email='nv88@example.com' WHERE id=?", (emp["id"],)); con.commit()
temp_tung = owner.post(f"/quan-ly/nhan-vien/{tung['eid']}/mat-khau-tam").json()["password"]

print("Nhân viên đăng nhập")
nv = TestClient(app)
check(login(nv, "88", temp88).headers["location"] == "/doi-mat-khau", "nhân viên đăng nhập bằng mã + mật khẩu tạm")
nv.post("/doi-mat-khau", data={"mat_khau_moi": "nv888888", "nhap_lai": "nv888888"})
r = nv.get("/")
check(r.status_code == 200 and "Order ca" in r.text and "sidebar" not in r.text, "nhân viên thấy giao diện điện thoại")
check(nv.get("/quan-ly/phan-quyen").status_code == 403, "nhân viên không vào được Phân quyền")
check(nv.get("/quan-ly/nhan-vien").status_code == 403, "nhân viên không vào được trang Nhân viên")

print("Quản lý tổng")
qlt = TestClient(app)
login(qlt, "NV01", temp_tung)
qlt.post("/doi-mat-khau", data={"mat_khau_moi": "tung1234", "nhap_lai": "tung1234"})
check(qlt.get("/quan-ly/nhan-vien").status_code == 200, "Quản lý tổng mở được trang Nhân viên")
check(qlt.get("/quan-ly/phan-quyen").status_code == 403, "Quản lý tổng không vào được Phân quyền")
other = con.execute("SELECT a.id, e.id AS eid FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.code='2'").fetchone()
owner.post("/quan-ly/phan-quyen/vai-tro", json={"account_id": other["id"], "role": "ql_tong"})
check(qlt.post(f"/quan-ly/nhan-vien/{other['eid']}/mat-khau-tam").status_code == 403, "QL tổng không cấp mật khẩu cho QL tổng khác")
r = qlt.post(f"/quan-ly/nhan-vien/{emp['id']}/mat-khau-tam")
check(r.status_code == 200, "QL tổng cấp lại mật khẩu cho nhân viên")
check(nv.get("/", follow_redirects=False).status_code == 303, "cấp lại mật khẩu → nhân viên bị đăng xuất")

print("Quên mật khẩu qua email")
f = TestClient(app)
r = f.post("/quen-mat-khau/gui-ma", data={"ma": "88"})
check("n••8@example.com" in r.text and sent, "gửi mã tới email đã che")
code = re.search(r"là: (\d{6})", sent[-1][1]).group(1)
r = f.post("/quen-mat-khau/dat-lai", data={"ma": "88", "ma_khoi_phuc": "000000" if code != "000000" else "111111", "mat_khau_moi": "moi12345", "nhap_lai": "moi12345"})
check("không đúng" in r.text, "sai mã bị từ chối")
r = f.post("/quen-mat-khau/dat-lai", data={"ma": "88", "ma_khoi_phuc": code, "mat_khau_moi": "moi12345", "nhap_lai": "moi12345"}, follow_redirects=False)
check(r.status_code == 303, "đúng mã → đặt lại mật khẩu")
check(login(TestClient(app), "88", "moi12345").headers["location"] == "/", "đăng nhập bằng mật khẩu mới")
r = f.post("/quen-mat-khau/dat-lai", data={"ma": "88", "ma_khoi_phuc": code, "mat_khau_moi": "x123456", "nhap_lai": "x123456"})
check("hết hạn" in r.text, "mã đã dùng không dùng lại được")
nomail = con.execute("SELECT e.code FROM employees e WHERE e.status='Đang làm' AND (e.email IS NULL OR e.email='') AND e.code<>'88' LIMIT 1").fetchone()[0]
check("chưa có email" in f.post("/quen-mat-khau/gui-ma", data={"ma": nomail}).text, "không có email → hướng dẫn nhờ quản lý")

print("Khóa tài khoản và an toàn")
stopped = con.execute("SELECT e.code FROM employees e WHERE status='Ngừng làm' LIMIT 1").fetchone()[0]
check("ngừng làm" in login(TestClient(app), stopped, "x").text, "nhân viên Ngừng làm không đăng nhập được")
x = TestClient(app)
for _ in range(10):
    login(x, "88", "sai")
check("15 phút" in login(x, "88", "sai").text, "sai 10 lần → tạm khóa 15 phút")
r = owner.post("/quan-ly/phan-quyen/quyen", json={"role": "ql", "perm": "xep_lich", "allowed": True}, headers={"Origin": "https://trang-la.com"})
check(r.status_code == 403, "chặn yêu cầu gửi từ trang web khác")

print(f"\nTẤT CẢ {ok_count} KIỂM TRA ĐỀU ĐẠT.")
shutil.rmtree(tmp, ignore_errors=True)
