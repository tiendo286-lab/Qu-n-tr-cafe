// Báo cáo lịch tuần (chuyển từ database.py của bản offline 1.7.6: week_schedule_summary, schedule_warning_report,
// staffing_report_rows, employee_schedule_report, order_report_details, branch_schedule_report, ...)
import { ASSIGNED, WD_SHORT, WEEKDAYS, catalog, closure, requirements } from './data.js';
import { sel, selAll } from './sb.js';

const RANK_ORDER = { 'Quản lý': 0, 'Cấp 1': 1, 'Cấp 2': 2 };
const rankSort = (a, b) => (RANK_ORDER[a.rank] ?? 3) - (RANK_ORDER[b.rank] ?? 3) || String(a.name).localeCompare(String(b.name), 'vi');

export async function loadReport(week) {
  const [cat, cl, emps, wse, orders] = await Promise.all([
    catalog(), closure(week.id), sel('employees', 'id, code, name, rank, status'),
    selAll('weekly_schedule_entries', 'employee_id, weekday, shift, base_status, state, branch_id, role, source, is_manual', (b) => b.eq('week_id', week.id)),
    selAll('order_entries', 'employee_id, weekday, shift, status', (b) => b.eq('week_id', week.id)),
  ]);
  const req = await requirements(week.id, cl);
  return new Report(week, cat, cl, emps, wse, orders, req);
}

export class Report {
  constructor(week, cat, cl, emps, wse, orders, req) {
    Object.assign(this, { week, cat, cl, emps, wse, orders, req });
    this.em = new Map(emps.map((e) => [e.id, e]));
    this.active = emps.filter((e) => e.status === 'Đang làm');
    this.roles = cat.roles.map((r) => r.name);
    this.bById = new Map(cat.branches.map((b) => [b.id, b]));
    this.assigned = wse.filter((r) => r.state === ASSIGNED && r.branch_id);
    this.shiftNames = cat.shifts.map((s) => s.name);
  }

  summary() {
    if (this._summary) return this._summary;
    const actual = new Map();
    for (const r of this.assigned) {
      const b = this.bById.get(r.branch_id); if (!b) continue;
      const k = `${b.code}|${r.weekday}|${r.shift}`;
      if (!actual.has(k)) actual.set(k, { actual: 0, roles: {}, senior: 0 });
      const a = actual.get(k); a.actual++; a.roles[r.role] = (a.roles[r.role] || 0) + 1;
      if (['Quản lý', 'Cấp 1'].includes(this.em.get(r.employee_id)?.rank)) a.senior++;
    }
    const branches = new Map(); const chain = new Map();
    for (const b of this.cat.branches) for (let d = 0; d < 7; d++) for (const s of this.shiftNames) {
      const a = actual.get(`${b.code}|${d}|${s}`) || { actual: 0, roles: {}, senior: 0 };
      const roleReq = Object.fromEntries(this.roles.map((r) => [r, this.req[`${b.id}|${d}|${s}|${r}`] || 0]));
      const required = Object.values(roleReq).reduce((t, n) => t + n, 0);
      branches.set(`${b.code}|${d}|${s}`, { actual: a.actual, required, roles: Object.fromEntries(this.roles.map((r) => [r, a.roles[r] || 0])), role_required: roleReq, senior: a.senior });
      const c = chain.get(`${d}|${s}`) || { actual: 0, required: 0 }; c.actual += a.actual; c.required += required; chain.set(`${d}|${s}`, c);
    }
    this._summary = { branches, chain };
    return this._summary;
  }

  warningReport() {
    const sm = this.summary(); const lines = [];
    const counts = { shortage: 0, overstaff: 0, role_mismatch: 0, missing_senior: 0, assigned_off: 0, assigned_no_order: 0, unassigned: 0, three_shifts: 0 };
    for (const [k, d] of sm.branches) {
      const [code, wd, shift] = k.split('|'); const label = `${code} – ${WD_SHORT[wd]} – ${shift}`;
      if (d.actual < d.required) { counts.shortage++; lines.push(`THIẾU TỔNG: ${label}: ${d.actual}/${d.required}`); }
      else if (d.actual > d.required) { counts.overstaff++; lines.push(`THỪA TỔNG: ${label}: ${d.actual}/${d.required}`); }
      const parts = this.roles.filter((r) => d.roles[r] !== d.role_required[r]).map((r) => `${r} ${d.roles[r]}/${d.role_required[r]}`);
      if (parts.length) { counts.role_mismatch++; lines.push(`LỆCH VỊ TRÍ: ${label}: ${parts.join(', ')}`); }
      if (d.actual > 0 && d.senior === 0) { counts.missing_senior++; lines.push(`THIẾU CẤP 1+: ${label}`); }
    }
    const special = this.assigned.filter((r) => ['NGHỈ', 'CHƯA ORDER'].includes(r.base_status))
      .sort((a, b) => String(this.em.get(a.employee_id)?.name).localeCompare(String(this.em.get(b.employee_id)?.name), 'vi') || a.weekday - b.weekday);
    for (const r of special) {
      const e = this.em.get(r.employee_id) || {};
      const text = `${e.code} – ${e.name} – ${WD_SHORT[r.weekday]} ${r.shift} – ${this.bById.get(r.branch_id)?.code} ${r.role}`;
      if (r.base_status === 'NGHỈ') { counts.assigned_off++; lines.push('XẾP CA ĐÃ NGHỈ: ' + text); }
      else { counts.assigned_no_order++; lines.push('XẾP KHI CHƯA ORDER: ' + text); }
    }
    const g = new Map();
    this.wse.filter((r) => r.state === ASSIGNED).forEach((r) => { const k = `${r.employee_id}|${r.weekday}`; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    for (const [k, rows] of g) {
      if (new Set(rows.map((r) => r.shift)).size < 3) continue;
      counts.three_shifts++;
      const [eid, wd] = k.split('|').map(Number); const e = this.em.get(eid) || {};
      rows.sort((a, b) => this.shiftNames.indexOf(a.shift) - this.shiftNames.indexOf(b.shift));
      lines.push(`LÀM THÔNG 3 CA: ${e.code} – ${e.name} – ${WD_SHORT[wd]}: ${rows.map((r) => `${r.shift} ${this.bById.get(r.branch_id)?.code || '—'} ${r.role || ''}`.trim()).join(' + ')}`);
    }
    const has = new Set(this.wse.filter((r) => r.state === ASSIGNED).map((r) => r.employee_id));
    const un = this.active.filter((e) => !has.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    counts.unassigned = un.length;
    un.forEach((e) => lines.push(`CHƯA CÓ CA: ${e.code} – ${e.name}`));
    return { counts, lines };
  }

  staffingRows() {
    const sm = this.summary(); const out = [];
    const [r1, r2] = [this.roles.includes('Pha chế') ? 'Pha chế' : this.roles[0], this.roles.includes('Chạy bàn') ? 'Chạy bàn' : this.roles[1]];
    for (const b of this.cat.branches) for (let d = 0; d < 7; d++) for (const s of this.shiftNames) {
      const x = sm.branches.get(`${b.code}|${d}|${s}`); const issues = [];
      if (x.actual < x.required) issues.push('THIẾU'); else if (x.actual > x.required) issues.push('THỪA');
      if (this.roles.some((r) => x.roles[r] !== x.role_required[r])) issues.push('LỆCH VỊ TRÍ');
      if (x.actual > 0 && x.senior === 0) issues.push('THIẾU CẤP 1+');
      out.push({ branch_code: b.code, branch_name: b.name, weekday: d, day: WEEKDAYS[d], shift: s, actual: x.actual, required: x.required,
        bar_actual: x.roles[r1] || 0, bar_required: x.role_required[r1] || 0, floor_actual: x.roles[r2] || 0, floor_required: x.role_required[r2] || 0,
        senior: x.senior, status: issues.length ? issues.join(' • ') : 'ĐỦ' });
    }
    return out;
  }

  employeeReport() {
    return this.active.map((e) => {
      const mine = this.assigned.filter((r) => r.employee_id === e.id);
      const sc = {}; mine.forEach((r) => { sc[r.shift] = (sc[r.shift] || 0) + 1; });
      const brs = [...new Set(mine.map((r) => this.bById.get(r.branch_id)))].filter(Boolean).sort((a, b) => a.sort_order - b.sort_order).map((b) => b.display_code || b.code);
      return { employee_id: e.id, code: e.code, name: e.name, rank: e.rank, total: mine.length, shift_counts: sc, branches: brs.join(', ') };
    }).sort(rankSort);
  }

  orderDetails() {
    const activeIds = new Set(this.active.map((e) => e.id));
    const ord = this.orders.filter((o) => activeIds.has(o.employee_id));
    const withData = new Set(ord.filter((o) => o.status !== 'CHƯA ORDER').map((o) => o.employee_id)).size;
    const summary = { active: this.active.length, with_data: withData, without_data: Math.max(0, this.active.length - withData),
      available: ord.filter((o) => o.status === 'ĐI LÀM ĐƯỢC').length, off: ord.filter((o) => o.status === 'NGHỈ').length };
    const exceptions = this.assigned.filter((r) => ['NGHỈ', 'CHƯA ORDER'].includes(r.base_status))
      .map((r) => { const e = this.em.get(r.employee_id) || {}; return { category: r.base_status === 'NGHỈ' ? 'XẾP CA ĐÃ NGHỈ' : 'XẾP KHI CHƯA ORDER', detail: `${e.code} – ${e.name} – ${WD_SHORT[r.weekday]} ${r.shift} – ${this.bById.get(r.branch_id)?.code} ${r.role}` }; });
    const hasOrder = new Set(this.orders.map((o) => o.employee_id));
    this.active.filter((e) => !hasOrder.has(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .forEach((e) => exceptions.push({ category: 'CHƯA CÓ ORDER', detail: `${e.code} – ${e.name}` }));
    return { summary, exceptions };
  }

  branchReport() {
    const rows = this.staffingRows();
    return this.cat.branches.map((b) => {
      const s = rows.filter((r) => r.branch_code === b.code);
      return { branch_code: b.code, branch_name: b.name, total_assignments: s.reduce((t, r) => t + r.actual, 0),
        exact: s.filter((r) => r.actual === r.required).length, shortage: s.filter((r) => r.actual < r.required).length,
        overstaff: s.filter((r) => r.actual > r.required).length,
        role_mismatch: s.filter((r) => r.bar_actual !== r.bar_required || r.floor_actual !== r.floor_required).length,
        missing_senior: s.filter((r) => r.actual > 0 && r.senior === 0).length };
    });
  }

  // Lịch tuần theo nhân viên: mỗi ngày một ô gom các ca
  employeeGrid() {
    return this.active.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi')).map((e) => {
      const days = {};
      for (let d = 0; d < 7; d++) {
        days[d] = this.assigned.filter((r) => r.employee_id === e.id && r.weekday === d)
          .sort((a, b) => this.shiftNames.indexOf(a.shift) - this.shiftNames.indexOf(b.shift))
          .map((r) => ({ shift: r.shift, role: r.role, branch_code: this.bById.get(r.branch_id)?.code, branch_name: this.bById.get(r.branch_id)?.name }));
      }
      return { employee_id: e.id, code: e.code, name: e.name, rank: e.rank, days, total: Object.values(days).reduce((t, x) => t + x.length, 0) };
    });
  }

  // Lịch cơ sở dạng gọn: mỗi ca/vị trí một dòng, không tạo dòng trống thừa
  branchCompact(branch) {
    const rows = [];
    for (const s of this.shiftNames) for (const r of this.roles) {
      const required = WEEKDAYS.map((_, d) => this.req[`${branch.id}|${d}|${s}|${r}`] || 0);
      const days = WEEKDAYS.map((_, d) => this.assigned.filter((x) => x.branch_id === branch.id && x.weekday === d && x.shift === s && x.role === r)
        .map((x) => ({ ...x, ...(this.em.get(x.employee_id) || {}) })).sort(rankSort));
      if (Math.max(...required) === 0 && !days.some((x) => x.length)) continue;
      rows.push({ shift: s, role: r, required, days });
    }
    return rows;
  }

  pageStats() {
    const sm = this.summary();
    const assignedEmp = new Set(this.wse.filter((r) => r.state === ASSIGNED).map((r) => r.employee_id)).size;
    let shortage = 0; let missingSenior = 0;
    for (const d of sm.branches.values()) { if (d.actual < d.required) shortage++; if (d.actual > 0 && d.senior === 0) missingSenior++; }
    return { active: this.active.length, assigned_employees: assignedEmp, unassigned_employees: Math.max(0, this.active.length - assignedEmp),
      total_assignments: this.wse.filter((r) => r.state === ASSIGNED).length, shortage, missing_senior: missingSenior };
  }
}
