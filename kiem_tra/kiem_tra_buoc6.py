"""Kiểm tra tự động bước 6 (chức năng lấy từ bản offline + quản lý tài khoản) trên một BẢN SAO dữ liệu.

Chạy:  .venv-mac/bin/python kiem_tra/kiem_tra_buoc6.py
"""
import io
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import zipfile
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
from openpyxl import Workbook, load_workbook  # noqa: E402

from app.legacy.excel_io import create_order_template  # noqa: E402
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
one = lambda sql, *a: con.execute(sql, a).fetchone()[0]  # noqa: E731
fmt = lambda dt: dt.strftime("%Y-%m-%dT%H:%M")  # noqa: E731

owner_pw = re.search(r"Mật khẩu tạm: (\S+)", (tmp / "MAT_KHAU_CHU_LAN_DAU.txt").read_text(encoding="utf-8")).group(1)
c = TestClient(app)
c.post("/dang-nhap", data={"ma": "admin", "mat_khau": owner_pw})
c.post("/doi-mat-khau", data={"mat_khau_moi": "chu12345", "nhap_lai": "chu12345"})


def flash_of(r):
    m = re.search(r'class="alert (\w+)" role="status">([^<]+)', r.text)
    return (m.group(1), m.group(2).strip()) if m else ("", "")


def xlsx(rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(list(r))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def login(code, pw):
    cl = TestClient(app)
    return cl, cl.post("/dang-nhap", data={"ma": code, "mat_khau": pw}, follow_redirects=False)


def login_emp(code, pw):
    eid = one("SELECT id FROM employees WHERE code=?", code)
    temp = c.post(f"/quan-ly/nhan-vien/{eid}/mat-khau-tam").json()["password"]
    cl, _ = login(code, temp)
    cl.post("/doi-mat-khau", data={"mat_khau_moi": pw, "nhap_lai": pw})
    return cl, eid


# ===========================================================================
print("Phân quyền chức năng mới")
for url in ("/quan-ly/danh-gia", "/quan-ly/bao-cao", "/quan-ly/lich-tong", "/quan-ly/du-lieu", "/quan-ly/tai-khoan"):
    check(c.get(url).status_code == 200, f"Chủ mở được {url}")
ql_code = q("SELECT e.code FROM employees e JOIN accounts a ON a.employee_id=e.id WHERE a.system_role='ql'"
            " AND e.status='Đang làm' LIMIT 1")
if ql_code:
    qlc, _ = login_emp(ql_code[0][0], "ql123456")
    for url in ("/quan-ly/danh-gia", "/quan-ly/bao-cao", "/quan-ly/du-lieu", "/quan-ly/tai-khoan"):
        check(qlc.get(url).status_code == 403, f"Quản lý (mặc định) không vào được {url}")
nvc, nv_id = login_emp("88", "nv888888")
for url in ("/quan-ly/danh-gia", "/quan-ly/lich-tong", "/quan-ly/du-lieu"):
    check(nvc.get(url, follow_redirects=False).status_code in (303, 403), f"Nhân viên không vào được {url}")
check(one("SELECT allowed FROM role_permissions WHERE role='ql_tong' AND perm='danh_gia'") == 1,
      "Quản lý tổng mặc định có quyền Đánh giá")

# ===========================================================================
print("Tài khoản đăng nhập")
r = c.get("/quan-ly/tai-khoan")
check("Chưa cấp mật khẩu" in r.text, "trang tài khoản hiện trạng thái")
acc88 = one("SELECT id FROM accounts WHERE employee_id=?", nv_id)
check(c.post(f"/quan-ly/tai-khoan/{acc88}/dang-xuat").json()["ok"], "buộc đăng xuất mọi nơi")
check(nvc.get("/order", follow_redirects=False).status_code == 303, "phiên cũ của nhân viên bị đăng xuất")
c.post(f"/quan-ly/tai-khoan/{acc88}/khoa")
_, r = login("88", "nv888888")
check("bị khóa" in r.text, "tài khoản bị khóa không đăng nhập được")
c.post(f"/quan-ly/tai-khoan/{acc88}/khoa")
nvc, r = login("88", "nv888888")
check(r.status_code == 303, "mở khóa → đăng nhập lại được")
me = one("SELECT id FROM accounts WHERE system_role='chu'")
check(c.post(f"/quan-ly/tai-khoan/{me}/khoa").status_code == 403, "không tự khóa chính mình")
n_no_pw = one("SELECT COUNT(*) FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.status='Đang làm'"
              " AND a.password_hash IS NULL")
r = c.post("/quan-ly/tai-khoan/hang-loat", data={"pham_vi": "chua_co"})
check(r.text.count('class="slip"') == n_no_pw and n_no_pw > 0, f"cấp mật khẩu hàng loạt cho {n_no_pw} người, in phiếu")
check(one("SELECT COUNT(*) FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.status='Đang làm'"
          " AND a.password_hash IS NULL") == 0, "không còn ai chưa có mật khẩu")
r = c.post("/quan-ly/tai-khoan/tao", data={"ten_dang_nhap": "ketoan", "ten": "Kế toán", "vai_tro": "ql"})
pw = re.search(r'temp-pass"[^>]*>(\w+)<', r.text).group(1)
kt, r = login("ketoan", pw)
check(r.headers["location"] == "/doi-mat-khau", "tài khoản riêng đăng nhập được, bắt đổi mật khẩu")
r = c.post("/quan-ly/tai-khoan/tao", data={"ten_dang_nhap": "107", "ten": "Trùng", "vai_tro": "ql"})
check("trùng" in r.text, "không tạo tài khoản trùng mã nhân viên")
kid = one("SELECT id FROM accounts WHERE login_name='ketoan'")
c.post(f"/quan-ly/tai-khoan/{kid}/xoa")
check(not q("SELECT 1 FROM accounts WHERE login_name='ketoan'"), "xóa tài khoản riêng")

# ===========================================================================
print("Đánh giá nhân viên")
d = (date.today() + timedelta(days=3)).isoformat()
r = c.post("/quan-ly/danh-gia/tao", data={"ngay": d})
rid = one("SELECT id FROM evaluation_rounds WHERE evaluation_date=?", d)
n_active = one("SELECT COUNT(*) FROM employees WHERE status='Đang làm'")
check(one("SELECT COUNT(*) FROM evaluation_round_employees WHERE round_id=?", rid) == n_active,
      "tạo lần đánh giá gồm toàn bộ nhân viên đang làm")
r = c.post("/quan-ly/danh-gia/tao", data={"ngay": d})
check("Mỗi ngày chỉ được tạo 1" in r.text, "không tạo trùng ngày")
c.post(f"/quan-ly/danh-gia/{rid}/sao-chep")
r = c.get(f"/quan-ly/danh-gia/{rid}/xuat-form", follow_redirects=False)
unassigned = one("SELECT COUNT(*) FROM evaluation_round_employees WHERE round_id=? AND COALESCE(role,'')=''", rid)
if unassigned:
    check(r.status_code == 303, "còn người chưa chọn bộ tiêu chí → không xuất Form")
for reid, in q("SELECT id FROM evaluation_round_employees WHERE round_id=? AND COALESCE(role,'')=''", rid):
    c.post(f"/quan-ly/danh-gia/{rid}/bo-tieu-chi", json={"id": reid, "role": "Chạy bàn"})
check(one("SELECT COUNT(*) FROM evaluation_round_employees WHERE round_id=? AND COALESCE(role,'')=''", rid) == 0,
      "chọn bộ tiêu chí cho mọi nhân viên")
r = c.get(f"/quan-ly/danh-gia/{rid}/xuat-form")
check(r.headers["content-type"].startswith("application/vnd.openxml") and
      "NHAN_VIEN" in load_workbook(io.BytesIO(r.content)).sheetnames, "xuất dữ liệu tạo Form (Excel)")
re1 = q("SELECT id, role FROM evaluation_round_employees WHERE round_id=? ORDER BY id LIMIT 2", rid)
crit = q("SELECT id, max_score FROM evaluation_round_criteria WHERE round_id=? AND role=?", rid, re1[0]["role"])
form = {f"s{x['id']}": str(x["max_score"]) for x in crit} | {"nguoi": "Tùng", "nhan_xet": "", "voucher": "3"}
r = c.post(f"/quan-ly/danh-gia/phieu/{re1[0]['id']}", data=form)
check("bắt buộc" in r.text, "phiếu thiếu nhận xét → báo lỗi")
form["nhan_xet"] = "Làm tốt"
form["next"] = str(re1[1]["id"])
r = c.post(f"/quan-ly/danh-gia/phieu/{re1[0]['id']}", data=form, follow_redirects=False)
check(r.headers["location"].endswith(f"/phieu/{re1[1]['id']}"), "Lưu & chuyển nhân viên tiếp theo")
row = q("SELECT * FROM evaluation_round_employees WHERE id=?", re1[0]["id"])[0]
check(row["status"] == "ĐÃ ĐÁNH GIÁ" and row["total_points"] == sum(x["max_score"] for x in crit)
      and row["voucher_count"] == 3, "lưu điểm, tổng điểm, voucher")
bad = dict(form, **{f"s{crit[0]['id']}": "99"})
bad.pop("next")
r = c.post(f"/quan-ly/danh-gia/phieu/{re1[0]['id']}", data=bad)
check("phải từ 0 đến" in r.text, "điểm vượt tối đa bị chặn")
r = c.get(f"/quan-ly/danh-gia/{rid}/in", follow_redirects=False)
check(r.status_code == 303, "chưa chốt → không in")
c.post(f"/quan-ly/danh-gia/{rid}/chot")
check(one("SELECT status FROM evaluation_rounds WHERE id=?", rid) == "ĐÃ CHỐT", "chốt lần đánh giá")
r = c.post(f"/quan-ly/danh-gia/phieu/{re1[0]['id']}", data=bad)
check("đã CHỐT" in r.text, "đã chốt → phiếu khóa")
r = c.get(f"/quan-ly/danh-gia/{rid}/in")
check("Chưa phân đủ mã Voucher" in r.text, "chưa phân voucher → chưa in")
few = xlsx([["Mã chương trình", "Tên chương trình", "Mã khuyến mãi", "Ngày bắt đầu", "Ngày kết thúc"], ["1", "VC", "AA1", "", ""]])
r = c.post(f"/quan-ly/danh-gia/{rid}/nhap-voucher", files={"file": ("v.xlsx", few)})
check("Không đủ Voucher" in r.text, "file voucher thiếu → không phân")
vrows = [["Mã chương trình", "Tên chương trình", "Mã khuyến mãi", "Ngày bắt đầu", "Ngày kết thúc"]]
vrows += [["9", "VOUCHER NHÂN VIÊN", f"TEST{i:03d}", "2026-11-10 00:00:00", "2026-12-31 23:59:59"] for i in range(5)]
r = c.post(f"/quan-ly/danh-gia/{rid}/nhap-voucher", files={"file": ("v.xlsx", xlsx(vrows))})
check(one("SELECT COUNT(*) FROM evaluation_voucher_allocations WHERE round_employee_id=?", re1[0]["id"]) == 3,
      "phân đúng 3 mã voucher cho nhân viên")
r = c.get(f"/quan-ly/danh-gia/{rid}/in")
check("PHIẾU ĐÁNH GIÁ NHÂN VIÊN" in r.text and "TEST000" in r.text and "VOUCHER NHÂN VIÊN ĐƯỢC NHẬN" in r.text,
      "trang in: mặt trước phiếu + mặt sau mã voucher")
r = c.get(f"/quan-ly/danh-gia/{rid}/xuat-voucher")
check(r.headers["content-type"].startswith("application/vnd.openxml"), "xuất Excel danh sách voucher")
for tab in ("tong-hop", "lich-su", "tieu-chi", "xep-loai"):
    check(c.get(f"/quan-ly/danh-gia?tab={tab}").status_code == 200, f"tab {tab}")
r = c.get(f"/quan-ly/danh-gia?tab=lich-su&nv={one('SELECT employee_id FROM evaluation_round_employees WHERE id=?', re1[0]['id'])}")
check("Làm tốt" in r.text, "lịch sử nhân viên có kết quả mới")
r = c.post("/quan-ly/danh-gia/xep-loai", data={"Xuất sắc": "50", "Tốt": "60", "Khá": "40", "Trung bình": "20", "Yếu": "0"})
check("giảm dần" in r.text, "ngưỡng xếp loại không giảm dần → báo lỗi")
cid = one("SELECT id FROM evaluation_criteria WHERE role='Pha chế' ORDER BY sort_order LIMIT 1")
c.post(f"/quan-ly/danh-gia/tieu-chi/{cid}/sua", data={"ten": "Đi làm đúng giờ (sửa)", "diem": "5"})
check(one("SELECT label FROM evaluation_criteria WHERE id=?", cid) == "Đi làm đúng giờ (sửa)", "sửa tiêu chí")
c.post(f"/quan-ly/danh-gia/{rid}/xoa", data={"xac_nhan": "sai"})
check(q("SELECT 1 FROM evaluation_rounds WHERE id=?", rid), "xóa cần gõ XOA")
c.post(f"/quan-ly/danh-gia/{rid}/xoa", data={"xac_nhan": "XOA"})
check(not q("SELECT 1 FROM evaluation_rounds WHERE id=?", rid), "xóa lần đánh giá")

# ===========================================================================
print("Order: nhập Form, xóa, khôi phục")
start = date.today() - timedelta(days=date.today().weekday()) + timedelta(days=14)
S = start.isoformat()
c.post("/quan-ly/order/tao-tuan", data={"tuan": S})
W = one("SELECT id FROM weeks WHERE start_date=?", S)
now = datetime.now()
c.post(f"/quan-ly/gio-order/tuan/{W}", data={"open_at": fmt(now - timedelta(days=2)), "close_at": fmt(now - timedelta(hours=1))})
shifts = [r[0] for r in q("SELECT name FROM shifts WHERE status='Đang sử dụng' ORDER BY sort_order, id")]
tpl = tmp / "mau.xlsx"
create_order_template(tpl, shifts)
head = [cell.value for cell in load_workbook(tpl).active[1]]
codes = [r[0] for r in q("SELECT code FROM employees WHERE status='Đang làm' ORDER BY id LIMIT 3")]
rows = [head]
for code in codes:
    rows.append([code, ""] + ["ĐI LÀM ĐƯỢC"] * (len(head) - 2))
rows.append([codes[2], ""] + ["NGHỈ"] * (len(head) - 2))  # gửi trùng
r = c.post(f"/quan-ly/order/nhap-form/{W}", files={"file": ("form.xlsx", xlsx(rows))})
check("nhập tự động 2" in r.text and "gửi trùng 1" in r.text, "nhập Form: 2 người nhập, 1 người gửi trùng")
check(one("SELECT COUNT(*) FROM order_submissions WHERE week_id=?", W) == 2, "web ghi nhận 2 người đã order")
c.post(f"/quan-ly/order/xoa-order/{W}")
check(one("SELECT COUNT(*) FROM order_entries WHERE week_id=?", W) == 0
      and one("SELECT COUNT(*) FROM order_submissions WHERE week_id=?", W) == 0, "xóa order tuần")
c.post(f"/quan-ly/order/khoi-phuc/{W}")
check(one("SELECT COUNT(DISTINCT employee_id) FROM order_entries WHERE week_id=?", W) == 2
      and one("SELECT COUNT(*) FROM order_submissions WHERE week_id=?", W) == 2, "khôi phục bản trước")

# ===========================================================================
print("Xếp lịch làm tổng")
r = c.get(f"/quan-ly/lich-tong?tuan={S}")
check("chưa bắt đầu xếp lịch" in r.text, "tuần chưa xếp → có nút xếp theo order & lịch cố định")
c.post(f"/quan-ly/lich-tong/tu-dong/{W}")
check(one("SELECT status FROM schedule_closures WHERE week_id=?", W) == "ĐANG XẾP", "xếp tự động → tuần Đang xếp")
e1 = one("SELECT id FROM employees WHERE code=?", codes[0])
br = q("SELECT eb.branch_id, er.role FROM employee_branches eb JOIN employee_roles er ON er.employee_id=eb.employee_id"
       " JOIN branches b ON b.id=eb.branch_id WHERE eb.employee_id=? AND b.status='Đang hoạt động' LIMIT 1", e1)[0]
sh = next(s for s in shifts if q("SELECT 1 FROM branch_shifts bs JOIN shifts s ON s.id=bs.shift_id WHERE bs.branch_id=?"
                                  " AND s.name=? AND bs.enabled=1", br["branch_id"], s))
r = c.post("/quan-ly/lich-tong/o", json={"week_id": W, "employee_id": e1, "weekday": 0, "shift": sh,
                                         "value": f"{br['branch_id']}|{br['role']}"})
check(r.json()["ok"], "xếp tay một ô trên lịch tổng")
check(q("SELECT 1 FROM weekly_schedule_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=? AND state='ĐÃ XẾP'",
        W, e1, sh), "ô đã xếp lưu vào lịch (đồng bộ lịch cơ sở)")
other = q("SELECT b.id FROM branches b WHERE b.id NOT IN (SELECT branch_id FROM employee_branches WHERE employee_id=?)", e1)
if other:
    r = c.post("/quan-ly/lich-tong/o", json={"week_id": W, "employee_id": e1, "weekday": 1, "shift": sh,
                                             "value": f"{other[0][0]}|{br['role']}"})
    check(r.status_code == 400, "không xếp vào cơ sở nhân viên không khai báo")
r = c.get(f"/quan-ly/lich-tong?tuan={S}")
check("Tổng định biên" in r.text and codes[0] in r.text, "trang lịch tổng hiển thị")
ql2 = q("SELECT e.code FROM employees e JOIN accounts a ON a.employee_id=e.id WHERE a.system_role='nv' AND e.status='Đang làm'"
        " AND e.code<>'88' LIMIT 1")[0][0]
con.execute("UPDATE accounts SET system_role='ql_tong' WHERE employee_id=(SELECT id FROM employees WHERE code=?)", (ql2,))
con.commit()
qt, _ = login_emp(ql2, "qt123456")
r = qt.post("/quan-ly/lich-tong/o", json={"week_id": W, "employee_id": e1, "weekday": 0, "shift": sh, "value": ""})
check(r.status_code == 409, "người khác đang giữ quyền xếp → bị chặn")
c.post(f"/quan-ly/lich-tong/cap-nhat-order/{W}")
check(q("SELECT 1 FROM weekly_schedule_entries WHERE week_id=? AND employee_id=? AND weekday=0 AND shift=? AND state='ĐÃ XẾP'",
        W, e1, sh), "cập nhật order vào lịch giữ nguyên ca đã xếp")

# ===========================================================================
print("Chốt lịch & báo cáo")
for tab in ("lich", "canh-bao", "dinh-bien", "nhan-vien", "order", "co-so", "lich-su"):
    check(c.get(f"/quan-ly/bao-cao?tuan={S}&tab={tab}").status_code == 200, f"tab {tab}")
r = c.get(f"/quan-ly/bao-cao?tuan={S}&che_do=cs&cn=LHP")
check("Tổng ca" in r.text, "xem lịch theo cơ sở")
r = c.get(f"/quan-ly/bao-cao/xuat?tuan={S}")
wb = load_workbook(io.BytesIO(r.content))
check(wb.sheetnames == ["TONG_QUAN", "CANH_BAO", "DINH_BIEN", "NHAN_VIEN", "ORDER", "CO_SO", "LICH_TONG_7_NGAY"],
      "xuất báo cáo Excel đủ 7 sheet như bản offline")
c.post(f"/quan-ly/lich/chot/{W}", headers={"referer": f"http://testserver/quan-ly/bao-cao?tuan={S}"})
check(one("SELECT status FROM schedule_closures WHERE week_id=?", W) == "ĐÃ CHỐT", "chốt lịch từ trang báo cáo")
r = c.post("/quan-ly/lich-tong/o", json={"week_id": W, "employee_id": e1, "weekday": 0, "shift": sh, "value": ""})
check(r.status_code == 409, "đã chốt → lịch tổng khóa")
r = c.post(f"/quan-ly/lich-tong/xoa/{W}", data={"xac_nhan": "XOA"})
check(q("SELECT 1 FROM weekly_schedule_entries WHERE week_id=?", W), "đã chốt → không xóa được lịch tuần")

# ===========================================================================
print("Nhân viên: Excel, xóa; cơ sở/ca: xóa")
check(c.get("/quan-ly/nhan-vien/file-mau").status_code == 200, "tải file mẫu nhân viên")
check(c.get("/quan-ly/nhan-vien/xuat-google-form").headers["content-type"].startswith("application/vnd.openxml"),
      "xuất danh sách cho Google Form")
emp_xlsx = xlsx([["Mã NV", "Tên nhân viên", "Phân cấp", "Trạng thái", "Cơ sở làm việc", "Vị trí đảm nhiệm"],
                 ["T901", "Nhân viên thử", "Thử việc", "Đang làm", "LHP", "Chạy bàn"]])
r = c.post("/quan-ly/nhan-vien/nhap-excel", files={"file": ("nv.xlsx", emp_xlsx)})
new_id = q("SELECT id FROM employees WHERE code='T901'")
check(new_id and q("SELECT 1 FROM accounts WHERE employee_id=?", new_id[0][0]), "nhập Excel → thêm nhân viên + tài khoản")
c.post(f"/quan-ly/nhan-vien/{new_id[0][0]}/xoa")
check(not q("SELECT 1 FROM employees WHERE code='T901'"), "xóa nhân viên chưa phát sinh dữ liệu")
c.post(f"/quan-ly/nhan-vien/{e1}/xoa")
check(q("SELECT 1 FROM employees WHERE id=?", e1), "nhân viên đã có order/lịch → không xóa được")
c.post("/quan-ly/chi-nhanh/them", data={"code": "TMP", "name": "Chi nhánh thử"})
bid = q("SELECT id FROM branches WHERE code='TMP'")
if bid:
    c.post(f"/quan-ly/chi-nhanh/{bid[0][0]}/xoa")
    check(not q("SELECT 1 FROM branches WHERE code='TMP'"), "xóa chi nhánh chưa có dữ liệu")
lhp = one("SELECT id FROM branches WHERE code='LHP'")
c.post(f"/quan-ly/chi-nhanh/{lhp}/xoa")
check(q("SELECT 1 FROM branches WHERE id=?", lhp), "chi nhánh đã có dữ liệu → không xóa")

# ===========================================================================
print("Dữ liệu: xuất / nhập ZIP")
r = c.get("/quan-ly/du-lieu/xuat")
z = zipfile.ZipFile(io.BytesIO(r.content))
check("xep_lich.sqlite3" in z.namelist() and "manifest.json" in z.namelist(), "xuất gói ZIP đúng định dạng bản offline")
c.post("/quan-ly/du-lieu/sao-luu")
check(any((tmp / "sao_luu").glob("*sao_luu_thu_cong.sqlite3")), "sao lưu ngay")
# Gói của bản offline (không có tài khoản web): tạo từ file gốc
off = tmp / "off.zip"
with zipfile.ZipFile(off, "w") as zf:
    zf.write(src, "xep_lich.sqlite3")
pw88 = one("SELECT password_hash FROM accounts WHERE employee_id=?", nv_id)
r = c.post("/quan-ly/du-lieu/nhap", data={"xac_nhan": "NHAP"}, files={"file": ("off.zip", off.read_bytes())})
check("Đã nhập dữ liệu" in r.text, "nhập gói ZIP của bản offline")
con.close()
con = sqlite3.connect(tmp / "test.sqlite3")
con.row_factory = sqlite3.Row
check(not q("SELECT 1 FROM weeks WHERE start_date=?", S), "dữ liệu được thay bằng gói ZIP")
check(one("SELECT password_hash FROM accounts a JOIN employees e ON e.id=a.employee_id WHERE e.code='88'") == pw88,
      "giữ nguyên mật khẩu nhân viên (khớp mã NV)")
check(one("SELECT COUNT(*) FROM accounts WHERE system_role='chu'") == 1, "giữ đúng một tài khoản Chủ")
check(c.get("/").status_code == 200, "Chủ vẫn đăng nhập sau khi nhập dữ liệu")
_, r = login("88", "nv888888")
check(r.status_code == 303, "nhân viên đăng nhập bằng mật khẩu cũ")

print(f"\nTẤT CẢ {ok_count} KIỂM TRA ĐỀU ĐẠT.")
