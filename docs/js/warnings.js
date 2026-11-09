// Cảnh báo của một tuần (chuyển từ schedule.warnings của bản Python)
import { ASSIGNED, OFF, OK, RANKS, SENIOR, catalog, closure, isFT, requirements, weekDays } from './data.js';
import { sel, selAll } from './sb.js';

export const WARN_GROUPS = [
  ['thieu', 'Ca thiếu người so với định biên', 'Ca thiếu người', '#dc2626'],
  ['thieu_cap2', 'Ca thiếu người Cấp 2 hoặc Quản lý', 'Thiếu Cấp 2+', '#ea580c'],
  ['xep_nghi', 'Đã xếp người order Nghỉ', 'Xếp người Nghỉ', '#b91c1c'],
  ['xep_chua_order', 'Đã xếp người Chưa order', 'Xếp người Chưa order', 'var(--muted)'],
  ['vuot', 'Xếp vượt định biên', 'Vượt định biên', '#ca8a04'],
  ['thong_3_ca', 'Làm thông 3 ca trong ngày', 'Làm thông 3 ca', '#8a5a83'],
];

export async function computeWarnings(week, ctx = {}) {
  const cat = ctx.cat || await catalog();
  const cl = ctx.closure !== undefined ? ctx.closure : await closure(week.id);
  const [req, emps, rows] = await Promise.all([
    ctx.req || requirements(week.id, cl),
    ctx.emps || sel('employees', 'id, code, name, rank'),
    ctx.rows || selAll('weekly_schedule_entries', '*', (b) => b.eq('week_id', week.id).eq('state', ASSIGNED).not('branch_id', 'is', null)),
  ]);
  const days = weekDays(week.start_date);
  const em = new Map(emps.map((e) => [e.id, e]));
  const roleOrder = new Map(cat.roles.map((r, i) => [r.name, i]));
  const byCell = new Map();
  // Người FULL TIME tính cho mọi ca chính chồng giờ
  const counted = cat.expandFT(rows);
  counted.forEach((r) => { const k = `${r.branch_id}|${r.weekday}|${r.shift}`; if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(r); });
  const out = { thieu: [], thieu_cap2: [], xep_nghi: [], xep_chua_order: [], vuot: [], thong_3_ca: [] };
  for (const b of cat.activeBranches) {
    for (const s of cat.branchShifts(b.id).filter((x) => !isFT(x.name))) {
      for (const d of days) {
        const assigned = byCell.get(`${b.id}|${d.index}|${s.name}`) || [];
        const needR = {};
        for (const [k, n] of Object.entries(req)) {
          const [bb, dd, ss, rr] = k.split('|');
          if (Number(bb) === b.id && Number(dd) === d.index && ss === s.name && n) needR[rr] = n;
        }
        const need = Object.values(needR).reduce((t, n) => t + n, 0);
        const haveR = {};
        assigned.forEach((a) => { haveR[a.role] = (haveR[a.role] || 0) + 1; });
        const order = [...new Set([...Object.keys(needR), ...Object.keys(haveR)])].sort((x, y) => (roleOrder.get(x) ?? 99) - (roleOrder.get(y) ?? 99));
        const ctxW = { branch_id: b.id, weekday: d.index, shift: s.name, label: `${b.code} · ${d.name} ${d.date} · ${s.name}` };
        if (assigned.length < need) {
          const parts = order.filter((r) => (needR[r] || 0) > (haveR[r] || 0)).map((r) => `${r} ${haveR[r] || 0}/${needR[r] || 0}`);
          out.thieu.push({ ...ctxW, detail: `Đã xếp ${assigned.length}/${need}${parts.length ? ` (${parts.join(', ')})` : ''}` });
        }
        if (assigned.length > need) {
          const parts = order.filter((r) => (haveR[r] || 0) > (needR[r] || 0)).map((r) => `${r} ${haveR[r] || 0}/${needR[r] || 0}`);
          out.vuot.push({ ...ctxW, detail: `Đã xếp ${assigned.length}/${need}${parts.length ? ` (${parts.join(', ')})` : ''}` });
        }
        if ((need || assigned.length) && !assigned.some((a) => SENIOR.has(em.get(a.employee_id)?.rank))) {
          const rk = {};
          assigned.forEach((a) => { const r = em.get(a.employee_id)?.rank; rk[r] = (rk[r] || 0) + 1; });
          const have = Object.entries(rk).sort((x, y) => RANKS.indexOf(x[0]) - RANKS.indexOf(y[0])).map(([r, n]) => `${n} người ${r}`).join(', ');
          out.thieu_cap2.push({ ...ctxW, detail: `Cấp 2+: 0${have ? ` · đang có ${have}` : ''}` });
        }
      }
    }
  }
  const bcode = new Map(cat.branches.map((b) => [b.id, b.code]));
  const dname = Object.fromEntries(days.map((d) => [d.index, `${d.name} ${d.date}`]));
  const perDay = new Map();
  for (const r of rows) {
    const e = em.get(r.employee_id) || { code: '?', name: '?' };
    const c = { branch_id: r.branch_id, weekday: r.weekday, shift: r.shift, label: `${e.code} – ${e.name}`,
      detail: `${bcode.get(r.branch_id) || '?'} · ${dname[r.weekday]} · ${r.shift} · ${r.role}` };
    if (r.base_status === OFF) out.xep_nghi.push(c);
    else if (r.base_status !== OK) out.xep_chua_order.push(c);
    const k = `${r.employee_id}|${r.weekday}`;
    if (!perDay.has(k)) perDay.set(k, []);
    perDay.get(k).push(r);
  }
  for (const [k, lst] of perDay) {
    // làm thông 3 ca: tính theo ca chính (FULL TIME Sáng = Sáng + Chiều)
    if (new Set(cat.expandFT(lst).map((x) => x.shift)).size < 3) continue;
    const [eid, d] = k.split('|').map(Number);
    const e = em.get(eid) || {};
    out.thong_3_ca.push({ branch_id: lst[0].branch_id, weekday: d, shift: lst[0].shift, label: `${e.code} – ${e.name} · ${dname[d]}`,
      detail: lst.map((x) => `${x.shift} ${bcode.get(x.branch_id) || '?'}`).join(' · ') });
  }
  const counts = new Map();
  rows.forEach((r) => counts.set(r.employee_id, (counts.get(r.employee_id) || 0) + 1));
  out.so_ca = [...counts].map(([k, n]) => ({ code: em.get(k)?.code, name: em.get(k)?.name, rank: em.get(k)?.rank, n }))
    .sort((a, b) => b.n - a.n || String(a.name).localeCompare(String(b.name), 'vi'));
  return out;
}

export const warnTotal = (w) => WARN_GROUPS.reduce((t, [k]) => t + w[k].length, 0);
