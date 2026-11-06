"""Xếp lịch tuần: trạng thái tuần, bắt đầu xếp, xếp người, khóa, chốt, cảnh báo."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from . import catalog as cat
from . import order as od
from .db import now_str

ST_XEP, ST_CHOT, ST_SUA = "ĐANG XẾP", "ĐÃ CHỐT", "ĐANG CHỈNH SỬA"
ASSIGNED = "ĐÃ XẾP"
STATE_FROM_BASE = {od.OK: "TRỐNG", od.OFF: "NGHỈ", od.NONE: "CHƯA ORDER"}
LOCK_MINUTES = 15


class ScheduleError(Exception):
    pass


# ---------------------------------------------------------------------------
# Trạng thái tuần
# ---------------------------------------------------------------------------
def closure(con, week_id):
    return con.execute("SELECT * FROM schedule_closures WHERE week_id = ?", (week_id,)).fetchone()


def week_status(con, week_id):
    row = closure(con, week_id)
    return row["status"] if row else None


def status_label(con, week_id):
    st = week_status(con, week_id)
    if st is None:
        return "Đang order"
    if st == ST_SUA and not has_published(con, week_id):
        return "Đang xếp"
    return {ST_XEP: "Đang xếp", ST_CHOT: "Đã chốt", ST_SUA: "Đang chỉnh sửa"}.get(st, st)


def is_editable(con, week_id):
    return week_status(con, week_id) in (ST_XEP, ST_SUA)


def has_published(con, week_id):
    return bool(con.execute("SELECT 1 FROM schedule_published WHERE week_id = ? LIMIT 1", (week_id,)).fetchone())


def touch(con, week_id):
    con.execute("UPDATE schedule_closures SET updated_at = ? WHERE week_id = ?", (now_str(), week_id))


def version(con, week_id):
    row = closure(con, week_id)
    return row["updated_at"] if row else ""


def manual_assigned_count(con, week_id):
    return con.execute(
        "SELECT COUNT(*) FROM weekly_schedule_entries WHERE week_id = ? AND state = ? AND source = 'MANUAL'",
        (week_id, ASSIGNED),
    ).fetchone()[0]


# ---------------------------------------------------------------------------
# Bắt đầu xếp lịch / quay lại order
# ---------------------------------------------------------------------------
def start_scheduling(con, week, account_id):
    if week_status(con, week["id"]) is not None:
        raise ScheduleError("Tuần này đã bắt đầu xếp lịch.")
    win = od.window_state(con, week)
    if win["state"] != "da_dong":
        raise ScheduleError(f"Chỉ bắt đầu xếp lịch được sau giờ hết hạn order ({od.fmt_dt(win['close'])}).")
    shifts = od.order_shifts(con)
    emps = con.execute("SELECT id FROM employees WHERE status = 'Đang làm'").fetchall()
    orders = {
        (r["employee_id"], r["weekday"], r["shift"]): r["status"]
        for r in con.execute("SELECT employee_id, weekday, shift, status FROM order_entries WHERE week_id = ?", (week["id"],))
    }
    fixed = {
        (r["employee_id"], r["weekday"], r["shift"]): r
        for r in con.execute(
            "SELECT f.* FROM fixed_schedule_entries f JOIN fixed_schedule_members m ON m.employee_id = f.employee_id"
        )
    }
    active_branches = {b["id"] for b in cat.branches(con, active_only=True)}
    bs = cat.branch_shift_map(con)
    shift_ids = {s["name"]: s["id"] for s in shifts}
    emp_branches, emp_roles = {}, {}
    for r in con.execute("SELECT employee_id, branch_id FROM employee_branches"):
        emp_branches.setdefault(r[0], set()).add(r[1])
    for r in con.execute("SELECT employee_id, role FROM employee_roles"):
        emp_roles.setdefault(r[0], set()).add(r[1])
    now = now_str()
    con.execute("DELETE FROM weekly_schedule_entries WHERE week_id = ?", (week["id"],))
    n_fixed = 0
    for e in emps:
        eid = e["id"]
        for d in range(7):
            for s in shifts:
                base = orders.get((eid, d, s["name"]), od.NONE)
                if base not in STATE_FROM_BASE:
                    base = od.NONE
                state, branch, role, source = STATE_FROM_BASE[base], None, None, "ORDER"
                f = fixed.get((eid, d, s["name"]))
                if f and base == od.OK:
                    cfg = bs.get((f["branch_id"], shift_ids[s["name"]]))
                    if (f["branch_id"] in active_branches and cfg and cfg["enabled"]
                            and f["branch_id"] in emp_branches.get(eid, set()) and f["role"] in emp_roles.get(eid, set())):
                        state, branch, role, source = ASSIGNED, f["branch_id"], f["role"], "FIXED"
                        n_fixed += 1
                con.execute(
                    "INSERT INTO weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state,"
                    " branch_id, role, source, is_manual, updated_at) VALUES (?,?,?,?,?,?,?,?,?,0,?)",
                    (week["id"], eid, d, s["name"], base, state, branch, role, source, now),
                )
    con.execute(
        "INSERT INTO schedule_closures(week_id, status, updated_at) VALUES (?,?,?)"
        " ON CONFLICT(week_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
        (week["id"], ST_XEP, now),
    )
    return n_fixed


def back_to_order(con, week):
    if week_status(con, week["id"]) != ST_XEP or has_published(con, week["id"]):
        raise ScheduleError("Chỉ quay lại order được khi tuần đang xếp và chưa chốt lần nào.")
    if manual_assigned_count(con, week["id"]):
        raise ScheduleError("Đã xếp lịch, không thể quay lại order.")
    con.execute("DELETE FROM weekly_schedule_entries WHERE week_id = ?", (week["id"],))
    con.execute("DELETE FROM schedule_extra_rows WHERE week_id = ?", (week["id"],))
    con.execute("DELETE FROM schedule_locks WHERE week_id = ?", (week["id"],))
    con.execute("DELETE FROM schedule_closures WHERE week_id = ?", (week["id"],))


# ---------------------------------------------------------------------------
# Định biên của tuần (tuần đã chốt dùng bản lưu lúc chốt)
# ---------------------------------------------------------------------------
def requirements(con, week_id, branch_id=None):
    row = closure(con, week_id)
    if row and row["staffing_snapshot_json"]:
        try:
            snap = json.loads(row["staffing_snapshot_json"])
            out = {}
            for b, items in snap.items():
                if branch_id is None or int(b) == branch_id:
                    for d, shift, role, n in items:
                        out[(int(b), d, shift, role)] = n
            return out
        except (ValueError, TypeError):
            pass
    sql = "SELECT branch_id, weekday, shift, role, required_count FROM staffing_requirements"
    args = ()
    if branch_id is not None:
        sql += " WHERE branch_id = ?"
        args = (branch_id,)
    return {(r[0], r[1], r[2], r[3]): r[4] for r in con.execute(sql, args)}


def _snapshot_requirements(con):
    snap = {}
    for r in con.execute("SELECT branch_id, weekday, shift, role, required_count FROM staffing_requirements"):
        snap.setdefault(str(r[0]), []).append([r[1], r[2], r[3], r[4]])
    return json.dumps(snap, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Khóa xếp lịch: mỗi lúc một người
# ---------------------------------------------------------------------------
def lock_info(con, week_id):
    row = con.execute(
        """SELECT l.*, COALESCE(e.code || ' – ' || e.name, a.display_name, 'Chủ') AS who
           FROM schedule_locks l JOIN accounts a ON a.id = l.account_id LEFT JOIN employees e ON e.id = a.employee_id
           WHERE l.week_id = ?""",
        (week_id,),
    ).fetchone()
    if not row:
        return None
    if datetime.fromisoformat(row["last_seen"]) < datetime.now() - timedelta(minutes=LOCK_MINUTES):
        return None  # hết hạn
    return row


def try_lock(con, week_id, account_id, force=False):
    """Lấy/giữ quyền xếp. Trả về (được_giữ, thông_tin_khóa)."""
    info = lock_info(con, week_id)
    now = now_str()
    if info and info["account_id"] != account_id and not force:
        return False, info
    if info and info["account_id"] == account_id:
        con.execute("UPDATE schedule_locks SET last_seen = ? WHERE week_id = ?", (now, week_id))
    else:
        con.execute(
            "INSERT INTO schedule_locks(week_id, account_id, acquired_at, last_seen) VALUES (?,?,?,?)"
            " ON CONFLICT(week_id) DO UPDATE SET account_id = excluded.account_id, acquired_at = excluded.acquired_at,"
            " last_seen = excluded.last_seen",
            (week_id, account_id, now, now),
        )
    return True, lock_info(con, week_id)


def release_lock(con, week_id, account_id):
    con.execute("DELETE FROM schedule_locks WHERE week_id = ? AND account_id = ?", (week_id, account_id))


# ---------------------------------------------------------------------------
# Xếp người
# ---------------------------------------------------------------------------
def _entry(con, week_id, eid, d, shift):
    return con.execute(
        "SELECT * FROM weekly_schedule_entries WHERE week_id = ? AND employee_id = ? AND weekday = ? AND shift = ?",
        (week_id, eid, d, shift),
    ).fetchone()


def _base_for(con, week_id, eid, d, shift):
    e = _entry(con, week_id, eid, d, shift)
    if e:
        return e["base_status"]
    o = con.execute(
        "SELECT status FROM order_entries WHERE week_id = ? AND employee_id = ? AND weekday = ? AND shift = ?",
        (week_id, eid, d, shift),
    ).fetchone()
    return o["status"] if o and o["status"] in STATE_FROM_BASE else od.NONE


def unassign(con, week_id, eid, d, shift):
    e = _entry(con, week_id, eid, d, shift)
    if not e or e["state"] != ASSIGNED:
        return
    con.execute(
        "UPDATE weekly_schedule_entries SET state = ?, branch_id = NULL, role = NULL, slot = NULL, source = 'MANUAL',"
        " is_manual = 1, updated_at = ? WHERE id = ?",
        (STATE_FROM_BASE.get(e["base_status"], "CHƯA ORDER"), now_str(), e["id"]),
    )


def assign(con, week_id, eid, d, shift, branch_id, role, slot):
    emp = con.execute("SELECT status FROM employees WHERE id = ?", (eid,)).fetchone()
    if not emp or emp["status"] != "Đang làm":
        raise ScheduleError("Nhân viên không còn làm.")
    if not con.execute("SELECT 1 FROM employee_branches WHERE employee_id = ? AND branch_id = ?", (eid, branch_id)).fetchone():
        raise ScheduleError("Nhân viên không được khai báo làm ở chi nhánh này.")
    if not con.execute("SELECT 1 FROM employee_roles WHERE employee_id = ? AND role = ?", (eid, role)).fetchone():
        raise ScheduleError("Nhân viên không có vai trò này.")
    e = _entry(con, week_id, eid, d, shift)
    if e and e["state"] == ASSIGNED and not (e["branch_id"] == branch_id and e["role"] == role):
        b = con.execute("SELECT code FROM branches WHERE id = ?", (e["branch_id"],)).fetchone()
        raise ScheduleError(f"Nhân viên này đã được xếp ở {b['code'] if b else 'chi nhánh khác'} cùng ca.")
    now = now_str()
    if e:
        con.execute(
            "UPDATE weekly_schedule_entries SET state = ?, branch_id = ?, role = ?, slot = ?, source = 'MANUAL',"
            " is_manual = 1, updated_at = ? WHERE id = ?",
            (ASSIGNED, branch_id, role, slot, now, e["id"]),
        )
    else:
        con.execute(
            "INSERT INTO weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, branch_id,"
            " role, slot, source, is_manual, updated_at) VALUES (?,?,?,?,?,?,?,?,?,'MANUAL',1,?)",
            (week_id, eid, d, shift, _base_for(con, week_id, eid, d, shift), ASSIGNED, branch_id, role, slot, now),
        )


def sync_order_change(con, week_id, eid, d, shift, new_status):
    """Quản lý sửa order sau khi đã bắt đầu xếp (cách 3a): cập nhật trạng thái gốc, KHÔNG gỡ người khỏi lịch."""
    e = _entry(con, week_id, eid, d, shift)
    if not e:
        if week_status(con, week_id) is None:
            return
        con.execute(
            "INSERT INTO weekly_schedule_entries(week_id, employee_id, weekday, shift, base_status, state, source,"
            " is_manual, updated_at) VALUES (?,?,?,?,?,?,'ORDER',0,?)",
            (week_id, eid, d, shift, new_status, STATE_FROM_BASE[new_status], now_str()),
        )
    elif e["state"] == ASSIGNED:
        con.execute("UPDATE weekly_schedule_entries SET base_status = ?, updated_at = ? WHERE id = ?", (new_status, now_str(), e["id"]))
    else:
        con.execute(
            "UPDATE weekly_schedule_entries SET base_status = ?, state = ?, updated_at = ? WHERE id = ?",
            (new_status, STATE_FROM_BASE[new_status], now_str(), e["id"]),
        )
    touch(con, week_id)


# ---------------------------------------------------------------------------
# Dữ liệu cho màn hình lịch cơ sở
# ---------------------------------------------------------------------------
def branch_payload(con, week, branch):
    wid = week["id"]
    shifts = [
        {"name": s["name"], "start": s["start_time"], "end": s["end_time"]}
        for s in cat.enabled_shifts_for_branch(con, branch["id"])
    ]
    roles = [r["name"] for r in cat.work_roles(con, active_only=True)]
    req = {f"{d}|{s}|{r}": n for (b, d, s, r), n in requirements(con, wid, branch["id"]).items()}
    extra = {
        f"{r['shift']}|{r['role']}": r["count"]
        for r in con.execute("SELECT * FROM schedule_extra_rows WHERE week_id = ? AND branch_id = ?", (wid, branch["id"]))
    }
    emps = []
    eb, er = {}, {}
    for r in con.execute("SELECT employee_id, branch_id FROM employee_branches"):
        eb.setdefault(r[0], []).append(r[1])
    for r in con.execute("SELECT employee_id, role FROM employee_roles"):
        er.setdefault(r[0], []).append(r[1])
    for e in con.execute("SELECT id, code, name, rank FROM employees WHERE status = 'Đang làm' ORDER BY name COLLATE NOCASE"):
        emps.append({
            "id": e["id"], "code": e["code"], "name": e["name"], "rank": e["rank"],
            "rank_i": cat.RANKS.index(e["rank"]) if e["rank"] in cat.RANKS else 0,
            "senior": e["rank"] in cat.SENIOR_RANKS, "branches": eb.get(e["id"], []), "roles": er.get(e["id"], []),
        })
    base = {}
    for r in con.execute("SELECT employee_id, weekday, shift, status FROM order_entries WHERE week_id = ?", (wid,)):
        base[f"{r[0]}|{r[1]}|{r[2]}"] = od.CODE.get(r[3], "none")
    assign_list = []
    for r in con.execute("SELECT * FROM weekly_schedule_entries WHERE week_id = ? ORDER BY id", (wid,)):
        base[f"{r['employee_id']}|{r['weekday']}|{r['shift']}"] = od.CODE.get(r["base_status"], "none")
        if r["state"] == ASSIGNED and r["branch_id"]:
            assign_list.append({
                "eid": r["employee_id"], "d": r["weekday"], "s": r["shift"], "b": r["branch_id"], "r": r["role"],
                "slot": r["slot"], "fixed": r["source"] == "FIXED", "manual": bool(r["is_manual"]),
            })
    return {
        "week_id": wid, "branch": {"id": branch["id"], "code": branch["code"], "name": branch["name"]},
        "days": od.week_days(week), "shifts": shifts, "roles": roles, "req": req, "extra": extra,
        "employees": emps, "base": base, "assign": assign_list,
        "branch_codes": {b["id"]: b["code"] for b in cat.branches(con)},
        "version": version(con, wid),
    }


# ---------------------------------------------------------------------------
# Cảnh báo (dùng cho bảng xác nhận chốt và tab Cảnh báo)
# ---------------------------------------------------------------------------
def warnings(con, week):
    wid = week["id"]
    days = od.week_days(week)
    branches = cat.branches(con, active_only=True)
    req = requirements(con, wid)
    emps = {e["id"]: e for e in con.execute("SELECT id, code, name, rank FROM employees")}
    role_order = {r["name"]: i for i, r in enumerate(cat.work_roles(con))}
    rows = con.execute(
        "SELECT * FROM weekly_schedule_entries WHERE week_id = ? AND state = ? AND branch_id IS NOT NULL", (wid, ASSIGNED)
    ).fetchall()
    by_cell = {}
    for r in rows:
        by_cell.setdefault((r["branch_id"], r["weekday"], r["shift"]), []).append(r)
    out = {k: [] for k in ("thieu", "thieu_cap2", "xep_nghi", "xep_chua_order", "vuot", "thong_3_ca")}
    for b in branches:
        for s in cat.enabled_shifts_for_branch(con, b["id"]):
            for d in days:
                key = (b["id"], d["index"], s["name"])
                assigned = by_cell.get(key, [])
                need = sum(n for (bb, dd, ss, rr), n in req.items() if bb == b["id"] and dd == d["index"] and ss == s["name"])
                label = f"{b['code']} · {d['name']} {d['date']} · {s['name']}"
                ctx = {"branch_id": b["id"], "weekday": d["index"], "shift": s["name"], "label": label}
                need_r = {rr: n for (bb, dd, ss, rr), n in req.items() if bb == b["id"] and dd == d["index"] and ss == s["name"]}
                have_r = {}
                for a in assigned:
                    have_r[a["role"]] = have_r.get(a["role"], 0) + 1
                order = sorted(set(need_r) | set(have_r), key=lambda x: role_order.get(x, 99))
                if len(assigned) < need:
                    parts = [f"{r} {have_r.get(r, 0)}/{need_r.get(r, 0)}" for r in order if need_r.get(r, 0) > have_r.get(r, 0)]
                    out["thieu"].append({**ctx, "detail": f"Đã xếp {len(assigned)}/{need}" + (f" ({', '.join(parts)})" if parts else "")})
                if len(assigned) > need:
                    parts = [f"{r} {have_r.get(r, 0)}/{need_r.get(r, 0)}" for r in order if have_r.get(r, 0) > need_r.get(r, 0)]
                    out["vuot"].append({**ctx, "detail": f"Đã xếp {len(assigned)}/{need}" + (f" ({', '.join(parts)})" if parts else "")})
                if (need or assigned) and not any(emps[a["employee_id"]]["rank"] in cat.SENIOR_RANKS for a in assigned):
                    rk = {}
                    for a in assigned:
                        rk[emps[a["employee_id"]]["rank"]] = rk.get(emps[a["employee_id"]]["rank"], 0) + 1
                    have = ", ".join(f"{n} người {r}" for r, n in sorted(rk.items(), key=lambda x: cat.RANKS.index(x[0]) if x[0] in cat.RANKS else 9))
                    out["thieu_cap2"].append({**ctx, "detail": "Cấp 2+: 0" + (f" · đang có {have}" if have else "")})
    bcode = {b["id"]: b["code"] for b in cat.branches(con)}
    dname = {d["index"]: f"{d['name']} {d['date']}" for d in days}
    per_day = {}
    for r in rows:
        e = emps[r["employee_id"]]
        who = f"{e['code']} – {e['name']}"
        ctx = {"branch_id": r["branch_id"], "weekday": r["weekday"], "shift": r["shift"], "label": who,
               "detail": f"{bcode.get(r['branch_id'], '?')} · {dname[r['weekday']]} · {r['shift']} · {r['role']}"}
        if r["base_status"] == od.OFF:
            out["xep_nghi"].append(ctx)
        elif r["base_status"] not in (od.OK, od.OFF):
            out["xep_chua_order"].append(ctx)
        per_day.setdefault((r["employee_id"], r["weekday"]), []).append(r)
    for (eid, d), lst in per_day.items():
        if len(lst) >= 3:
            e = emps[eid]
            out["thong_3_ca"].append({
                "branch_id": lst[0]["branch_id"], "weekday": d, "shift": lst[0]["shift"],
                "label": f"{e['code']} – {e['name']} · {dname[d]}",
                "detail": " · ".join(f"{x['shift']} {bcode.get(x['branch_id'], '?')}" for x in lst),
            })
    counts = {}
    for r in rows:
        counts[r["employee_id"]] = counts.get(r["employee_id"], 0) + 1
    out["so_ca"] = sorted(
        [{"code": emps[k]["code"], "name": emps[k]["name"], "rank": emps[k]["rank"], "n": v} for k, v in counts.items()],
        key=lambda x: (-x["n"], x["name"]),
    )
    return out


# ---------------------------------------------------------------------------
# Chốt / mở lại tuần
# ---------------------------------------------------------------------------
def _notify(con, account_id, title, lines, link=None):
    con.execute(
        "INSERT INTO notifications(account_id, title, body, created_at, link) VALUES (?,?,?,?,?)",
        (account_id, title, "\n".join(lines), now_str(), link),
    )


def chot(con, week, account_id):
    wid = week["id"]
    st = week_status(con, wid)
    if st not in (ST_XEP, ST_SUA):
        raise ScheduleError("Tuần không ở trạng thái đang xếp.")
    now = now_str()
    old = {
        (r["employee_id"], r["weekday"], r["shift"]): (r["branch_id"], r["role"])
        for r in con.execute("SELECT * FROM schedule_published WHERE week_id = ?", (wid,))
    }
    old_marks = {
        (r["employee_id"], r["weekday"], r["shift"]): (r["note"], r["changed_at"])
        for r in con.execute("SELECT * FROM schedule_published WHERE week_id = ?", (wid,))
    }
    bcode0 = {b["id"]: b["code"] for b in cat.branches(con)}
    first = not old and not has_published(con, wid)
    new = {
        (r["employee_id"], r["weekday"], r["shift"]): (r["branch_id"], r["role"])
        for r in con.execute(
            "SELECT * FROM weekly_schedule_entries WHERE week_id = ? AND state = ? AND branch_id IS NOT NULL", (wid, ASSIGNED)
        )
    }
    con.execute("DELETE FROM schedule_published WHERE week_id = ?", (wid,))
    rows_ins = []
    for k, v in new.items():
        note, changed = None, None
        if not first:
            if k not in old:
                note, changed = "Ca mới được xếp thêm", now
            elif old[k] != v:
                note, changed = f"Đổi từ {bcode0.get(old[k][0], '?')} – {old[k][1]}", now
            else:
                note, changed = old_marks.get(k, (None, None))
        rows_ins.append((wid, k[0], k[1], k[2], v[0], v[1], now, note, changed))
    con.executemany(
        "INSERT INTO schedule_published(week_id, employee_id, weekday, shift, branch_id, role, published_at, note, changed_at)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        rows_ins,
    )
    row = closure(con, wid)
    snap = row["staffing_snapshot_json"] or _snapshot_requirements(con)
    con.execute(
        "UPDATE schedule_closures SET status = ?, closed_at = ?, staffing_snapshot_json = ?, updated_at = ? WHERE week_id = ?",
        (ST_CHOT, now, snap, now, wid),
    )
    con.execute("DELETE FROM schedule_locks WHERE week_id = ?", (wid,))
    # Thông báo
    label = od.week_label(week)
    link = f"/lich?tuan={week['start_date']}"
    accounts = {r[0]: r[1] for r in con.execute("SELECT employee_id, id FROM accounts WHERE employee_id IS NOT NULL")}
    bcode = {b["id"]: b["code"] for b in cat.branches(con)}
    dname = {d["index"]: f"{d['name']} {d['date']}" for d in od.week_days(week)}
    if first:
        for (eid,) in con.execute("SELECT id FROM employees WHERE status = 'Đang làm'").fetchall():
            if eid in accounts:
                _notify(con, accounts[eid], f"Lịch tuần {label} đã được chốt", ["Xem lịch của bạn trong mục Lịch làm."], link)
        return {"first": True, "changed": 0}
    changes = {}
    for k in set(old) | set(new):
        a, b = old.get(k), new.get(k)
        if a == b:
            continue
        eid, d, s = k
        if a and not b:
            line = f"{dname[d]} · {s}: ca ở {bcode.get(a[0], '?')} – {a[1]} đã bị hủy"
        elif b and not a:
            line = f"{dname[d]} · {s}: bạn được xếp thêm ca ở {bcode.get(b[0], '?')} – {b[1]}"
        else:
            line = f"{dname[d]} · {s}: đổi từ {bcode.get(a[0], '?')} – {a[1]} sang {bcode.get(b[0], '?')} – {b[1]}"
        changes.setdefault(eid, []).append((d, line))
    for eid, lines in changes.items():
        if eid in accounts:
            _notify(con, accounts[eid], f"Lịch tuần {label} của bạn đã thay đổi", [x[1] for x in sorted(lines)], link)
    return {"first": False, "changed": len(changes)}


def reopen(con, week):
    if week_status(con, week["id"]) != ST_CHOT:
        raise ScheduleError("Tuần chưa chốt.")
    con.execute("UPDATE schedule_closures SET status = ?, updated_at = ? WHERE week_id = ?", (ST_SUA, now_str(), week["id"]))


def focus_week(con):
    """Tuần cảnh báo mặc định: tuần tới nếu đã bắt đầu xếp, không thì tuần này."""
    from datetime import date, timedelta
    cur = od.week_start(date.today())
    for start in (cur + timedelta(days=7), cur):
        w = od.get_week(con, start)
        if w and week_status(con, w["id"]):
            return w
    return None


def warning_total(con) -> int:
    w = focus_week(con)
    if not w:
        return 0
    data = warnings(con, w)
    return sum(len(v) for k, v in data.items() if k != "so_ca")
