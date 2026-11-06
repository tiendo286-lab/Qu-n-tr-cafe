"""Kiểm tra tự động bước 2 (danh mục) trên một BẢN SAO dữ liệu.

Chạy:  .venv-mac/bin/python kiem_tra/kiem_tra_buoc2.py
"""
import json
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

owner_pw = re.search(r"Mật khẩu tạm: (\S+)", (tmp / "MAT_KHAU_CHU_LAN_DAU.txt").read_text(encoding="utf-8")).group(1)
c = TestClient(app)
c.post("/dang-nhap", data={"ma": "admin", "mat_khau": owner_pw})
c.post("/doi-mat-khau", data={"mat_khau_moi": "chu12345", "nhap_lai": "chu12345"})

print("Vai trò làm việc")
roles = [r["name"] for r in q("SELECT name FROM work_roles ORDER BY sort_order")]
check(roles == ["Pha chế", "Chạy bàn"], f"lấy vai trò từ dữ liệu cũ: {roles}")
check(c.get("/quan-ly/chi-nhanh").status_code == 200, "mở trang Chi nhánh, ca & vai trò")
c.post("/quan-ly/vai-tro-lam-viec/them", data={"name": "Thu ngân"})
check(q("SELECT 1 FROM work_roles WHERE name='Thu ngân'"), "thêm vai trò Thu ngân")
pc_id = q("SELECT id FROM work_roles WHERE name='Pha chế'")[0][0]
n_pc = q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE role='Pha chế'")[0][0]
check(c.post(f"/quan-ly/vai-tro-lam-viec/{pc_id}", json={"name": "Chạy bàn", "status": "Đang sử dụng"}).status_code == 400, "không đổi trùng tên vai trò")
c.post(f"/quan-ly/vai-tro-lam-viec/{pc_id}", json={"name": "Barista", "status": "Đang sử dụng"})
check(q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE role='Barista'")[0][0] == n_pc and n_pc > 0, "đổi tên vai trò → cập nhật cả lịch cũ")
check(q("SELECT COUNT(*) FROM employee_roles WHERE role='Pha chế'")[0][0] == 0, "đổi tên vai trò → cập nhật vai trò nhân viên")
c.post(f"/quan-ly/vai-tro-lam-viec/{pc_id}", json={"name": "Pha chế", "status": "Đang sử dụng"})

print("Chi nhánh")
lhp = q("SELECT * FROM branches WHERE code='LHP'")[0]
check(c.post(f"/quan-ly/chi-nhanh/{lhp['id']}", json={"code": "HS", "name": "x", "status": "Đang hoạt động"}).status_code == 400, "không trùng mã chi nhánh")
check(c.post(f"/quan-ly/chi-nhanh/{lhp['id']}", json={"code": "LHP", "name": "MILANO LHP", "status": "Đang hoạt động"}).json()["ok"], "sửa tên chi nhánh")
c.post("/quan-ly/chi-nhanh/them", data={"code": "TT", "name": "Chi nhánh thử"})
tt = q("SELECT * FROM branches WHERE code='TT'")[0]
check(len(q("SELECT * FROM branch_shifts WHERE branch_id=? AND enabled=1", tt["id"])) == 3, "chi nhánh mới chép sẵn giờ 3 ca")

print("Ca & giờ ca")
sang = q("SELECT * FROM shifts WHERE name='Sáng'")[0]
n_s = q("SELECT COUNT(*) FROM order_entries WHERE shift='Sáng'")[0][0]
c.post(f"/quan-ly/ca/{sang['id']}", json={"name": "Ca sáng", "code": "S", "status": "Đang sử dụng"})
check(q("SELECT COUNT(*) FROM order_entries WHERE shift='Ca sáng'")[0][0] == n_s, "đổi tên ca → cập nhật order cũ")
check(q("SELECT COUNT(*) FROM staffing_requirements WHERE shift='Sáng'")[0][0] == 0, "đổi tên ca → cập nhật định biên")
plans = [json.loads(r[0]) for r in q("SELECT shifts_json FROM employee_work_plans")]
check(not any("Sáng" in p for p in plans), "đổi tên ca → cập nhật kế hoạch làm việc")
c.post(f"/quan-ly/ca/{sang['id']}", json={"name": "Sáng", "code": "S", "status": "Đang sử dụng"})
check(c.post("/quan-ly/gio-ca", json={"branch_id": tt["id"], "shift_id": sang["id"], "enabled": True, "start_time": "6h", "end_time": "12:00"}).status_code == 400, "giờ sai định dạng bị từ chối")
check(c.post("/quan-ly/gio-ca", json={"branch_id": tt["id"], "shift_id": sang["id"], "enabled": True, "start_time": "07:00", "end_time": "12:00"}).json()["ok"], "sửa giờ ca")
c.post("/quan-ly/ca/them", data={"name": "Đêm", "code": "Đ"})
dem = q("SELECT * FROM shifts WHERE name='Đêm'")[0]
check(len(q("SELECT * FROM branch_shifts WHERE shift_id=? AND enabled=0", dem["id"])) == 5, "ca mới tắt sẵn ở mọi chi nhánh")

print("Nhân viên")
check(c.get("/quan-ly/nhan-vien/them").status_code == 200, "mở form thêm nhân viên")
base = {"code": "200", "name": "Nguyễn Thử", "rank": "Thử việc", "status": "Đang làm", "roles": ["Pha chế"], "branches": [str(lhp["id"])], "email": "", "phone": "", "start_date": "2026-10-01"}
r = c.post("/quan-ly/nhan-vien/them", data={**base, "code": "88"})
check("đã có người dùng" in r.text, "không thêm trùng mã")
r = c.post("/quan-ly/nhan-vien/them", data={**base, "roles": []})
check("ít nhất một vai trò" in r.text, "bắt buộc chọn vai trò")
r = c.post("/quan-ly/nhan-vien/them", data=base, follow_redirects=False)
check(r.status_code == 303, "thêm nhân viên mới")
new = q("SELECT * FROM employees WHERE code='200'")[0]
check(q("SELECT 1 FROM accounts WHERE employee_id=?", new["id"]), "nhân viên mới có tài khoản")
check(c.get(f"/quan-ly/nhan-vien/{new['id']}").status_code == 200, "mở form sửa")
emp88 = q("SELECT * FROM employees WHERE code='88'")[0]
temp = c.post(f"/quan-ly/nhan-vien/{emp88['id']}/mat-khau-tam").json()["password"]
nv = TestClient(app)
nv.post("/dang-nhap", data={"ma": "88", "mat_khau": temp})
nv.post("/doi-mat-khau", data={"mat_khau_moi": "nv888888", "nhap_lai": "nv888888"})
d88 = {"code": "88B", "name": emp88["name"], "rank": emp88["rank"], "status": "Đang làm", "roles": ["Pha chế"], "branches": [str(lhp["id"])]}
c.post(f"/quan-ly/nhan-vien/{emp88['id']}", data=d88)
check(TestClient(app).post("/dang-nhap", data={"ma": "88B", "mat_khau": "nv888888"}, follow_redirects=False).headers["location"] == "/", "đổi mã → đăng nhập bằng mã mới, mật khẩu cũ")
check(q("SELECT COUNT(*) FROM weekly_schedule_entries WHERE employee_id=?", emp88["id"])[0][0] > 0, "đổi mã → lịch sử vẫn gắn đúng người")
c.post(f"/quan-ly/nhan-vien/{emp88['id']}", data={**d88, "status": "Ngừng làm"})
check(nv.get("/", follow_redirects=False).status_code == 303, "chuyển Ngừng làm → bị đăng xuất ngay")

print("Định biên")
check(c.get(f"/quan-ly/dinh-bien?cn={lhp['id']}").status_code == 200, "mở trang định biên")
check(c.post("/quan-ly/dinh-bien", json={"branch_id": lhp["id"], "weekday": 0, "shift": "Sáng", "role": "Pha chế", "count": 99}).status_code == 400, "số người > 50 bị từ chối")
check(c.post("/quan-ly/dinh-bien", json={"branch_id": lhp["id"], "weekday": 0, "shift": "Đêm", "role": "Pha chế", "count": 1}).status_code == 400, "ca không bật ở chi nhánh bị từ chối")
c.post("/quan-ly/dinh-bien", json={"branch_id": lhp["id"], "weekday": 0, "shift": "Sáng", "role": "Pha chế", "count": 5})
check(q("SELECT required_count FROM staffing_requirements WHERE branch_id=? AND weekday=0 AND shift='Sáng' AND role='Pha chế'", lhp["id"])[0][0] == 5, "lưu định biên")

print("Lịch cố định")
check(c.get("/quan-ly/lich-co-dinh").status_code == 200, "mở trang lịch cố định")
yen = q("SELECT * FROM employees WHERE code='12'")[0]
ll = q("SELECT id FROM branches WHERE code='LL'")[0][0]
r = c.post("/quan-ly/lich-co-dinh/o", json={"employee_id": yen["id"], "weekday": 1, "shift_id": sang["id"], "value": f"{lhp['id']}|Pha chế"})
check(r.status_code == 400, "không chọn được chi nhánh nhân viên không làm")
c.post("/quan-ly/lich-co-dinh/o", json={"employee_id": yen["id"], "weekday": 6, "shift_id": sang["id"], "value": f"{ll}|Chạy bàn"})
check(q("SELECT role FROM fixed_schedule_entries WHERE employee_id=? AND weekday=6 AND shift='Sáng'", yen["id"])[0][0] == "Chạy bàn", "lưu ô lịch cố định")
c.post("/quan-ly/lich-co-dinh/them", data={"employee_id": new["id"]})
check(q("SELECT 1 FROM fixed_schedule_members WHERE employee_id=?", new["id"]), "thêm người vào lịch cố định")
c.post(f"/quan-ly/lich-co-dinh/{new['id']}/xoa")
check(not q("SELECT 1 FROM fixed_schedule_members WHERE employee_id=?", new["id"]), "xóa người khỏi lịch cố định")

print("Quyền")
ql = TestClient(app)
emp2 = q("SELECT id FROM employees WHERE code='2'")[0][0]
t2 = c.post(f"/quan-ly/nhan-vien/{emp2}/mat-khau-tam").json()["password"]
ql.post("/dang-nhap", data={"ma": "2", "mat_khau": t2})
ql.post("/doi-mat-khau", data={"mat_khau_moi": "ql222222", "nhap_lai": "ql222222"})
check(ql.get("/quan-ly/dinh-bien").status_code == 403, "Quản lý (mặc định) không sửa được định biên")
check(ql.get("/quan-ly/nhan-vien/them").status_code == 403, "Quản lý (mặc định) không thêm được nhân viên")

print(f"\nTẤT CẢ {ok_count} KIỂM TRA ĐỀU ĐẠT.")
shutil.rmtree(tmp, ignore_errors=True)
