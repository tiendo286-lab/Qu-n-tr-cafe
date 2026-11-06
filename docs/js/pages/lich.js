// Lịch làm: Lịch của tôi (ca đã chốt) + Lịch cơ sở 4 chi nhánh (bản rút gọn cho nhân viên)
import { isManager } from '../app.js';
import { RANKS, SHIFT_COLORS, ST_SUA, WEEKDAYS, WD_SHORT, addDays, catalog, dm, parseWeekParam, vnToday, weekDays, weekLabel, weekStart, when } from '../data.js';
import { rpc, sel } from '../sb.js';
import { html } from '../ui.js';

export const perm = 'xem_lich_minh';
const hh = (t) => (t || '').slice(0, 5);

async function publishedWeeks() {
  const pub = await sel('schedule_published', 'week_id');
  const ids = [...new Set(pub.map((p) => p.week_id))];
  if (!ids.length) return [];
  return sel('weeks', '*', (b) => b.in('id', ids).order('start_date'));
}

function pickWeek(weeks, tuan) {
  if (!weeks.length) return {};
  let idx = weeks.findIndex((w) => w.start_date === parseWeekParam(tuan));
  if (idx < 0) {
    const cur = weekStart(vnToday());
    idx = weeks.findIndex((w) => w.start_date >= cur);
    if (idx < 0) idx = weeks.length - 1;
  }
  return { week: weeks[idx], prev: weeks[idx - 1]?.start_date, next: weeks[idx + 1]?.start_date };
}

function weeknav(base, w, prev, next, sub) {
  return html`<div class="wk2">
    ${prev ? html`<a class="circ" aria-label="Tuần trước" href="#${base}tuan=${prev}">‹</a>` : html`<span class="circ dis">‹</span>`}
    <div class="mid"><div class="a">Tuần ${weekLabel(w.start_date)}</div><div class="b">${sub}</div></div>
    ${next ? html`<a class="circ" aria-label="Tuần sau" href="#${base}tuan=${next}">›</a>` : html`<span class="circ dis">›</span>`}</div>`;
}

export async function render({ me, params }) {
  const tab = params.tab === 'co-so' ? 'co_so' : 'cua_toi';
  const weeks = await publishedWeeks();
  const { week, prev, next } = pickWeek(weeks, params.tuan);
  const tq = week ? `&tuan=${week.start_date}` : '';
  const tabs = html`<div class="seg" style="max-width:560px">
    <a class="${tab === 'cua_toi' ? 'on' : ''}" href="#/lich?tab=cua-toi${tq}">Lịch của tôi</a>
    <a class="${tab === 'co_so' ? 'on' : ''}" href="#/lich?tab=co-so${tq}">Lịch cơ sở</a></div>`;
  let body;
  if (!week) {
    body = html`<div class="card">Chưa có lịch tuần nào được chốt. Khi quản lý chốt lịch, bạn sẽ thấy ca của mình ở đây.</div>`;
  } else {
    const cl = (await sel('schedule_closures', 'status', (b) => b.eq('week_id', week.id)))[0];
    const editing = cl?.status === ST_SUA;
    const cat = await catalog();
    const shiftIdx = new Map(cat.shifts.map((s, i) => [s.name, i]));
    if (tab === 'cua_toi') {
      if (!me.employee_id) {
        body = html`<div class="card">Tài khoản này không gắn với nhân viên nên không có lịch cá nhân. Xem <a href="#/lich?tab=co-so">Lịch cơ sở</a>.</div>`;
      } else {
        const rows = await sel('schedule_published', '*', (b) => b.eq('week_id', week.id).eq('employee_id', me.employee_id));
        const link = `/lich?tuan=${week.start_date}`;
        const unread = await sel('notifications', 'id, title, body, created_at', (b) => b.eq('account_id', me.account_id).is('read_at', null).eq('link', link).order('id'));
        const changes = unread.filter((n) => n.title.includes('thay đổi'));
        const since = changes.length ? changes[0].created_at : null;
        const bmap = new Map(cat.branches.map((b) => [b.id, b]));
        const byDay = {};
        rows.sort((a, b) => a.weekday - b.weekday || (shiftIdx.get(a.shift) ?? 99) - (shiftIdx.get(b.shift) ?? 99));
        for (const r of rows) {
          const br = bmap.get(r.branch_id) || {};
          const sh = cat.shifts.find((s) => s.name === r.shift);
          const cfg = sh ? cat.bsMap.get(`${r.branch_id}|${sh.id}`) : null;
          const upd = !!(since && r.changed_at && r.changed_at >= since.slice(0, 17));
          (byDay[r.weekday] ||= []).push({
            shift: r.shift, role: r.role, branch: br.code, branchName: br.name,
            hours: cfg?.start_time ? `${hh(cfg.start_time)}–${hh(cfg.end_time)}` : '',
            color: SHIFT_COLORS[(shiftIdx.get(r.shift) || 0) % SHIFT_COLORS.length], updated: upd, note: upd ? r.note : '',
          });
        }
        const lines = changes.flatMap((n) => (n.body || '').split('\n').filter(Boolean));
        if (unread.length) rpc('app_notifications_read_link', { p_link: link }).catch(() => {});
        body = html`${weeknav('/lich?tab=cua-toi&', week, prev, next, editing ? 'Đang chỉnh sửa · bản đã chốt gần nhất' : `Đã chốt · ${rows.length} ca`)}
          ${changes.length ? html`<div class="upd-banner" role="status">Lịch tuần này vừa được cập nhật ${when(changes[changes.length - 1].created_at).toLowerCase()}: <strong>${lines.length} thay đổi</strong>, ca bị đổi hoặc thêm được đánh dấu “Mới cập nhật” bên dưới.
            ${lines.map((l) => html`<div class="bl">${l}</div>`)}</div>` : ''}
          ${weekDays(week.start_date).map((d) => html`<section class="dcard"><div class="dl">${d.name} · ${d.date}</div>
            ${(byDay[d.index] || []).length ? '' : html`<div class="det">Không có ca</div>`}
            ${(byDay[d.index] || []).map((s) => html`<div class="srow"><div class="bar" style="background:${s.color}"></div>
              <div class="sb"><div class="s1"><span>${s.shift}${s.hours ? ` · ${s.hours}` : ''}</span>${s.updated ? html`<span class="chip-new">Mới cập nhật</span>` : ''}</div>
                <div class="s2">${s.branch} – ${s.branchName} · ${s.role}</div>${s.note ? html`<div class="s3">${s.note}</div>` : ''}</div></div>`)}
          </section>`)}`;
      }
    } else {
      const branches = cat.activeBranches;
      const branch = branches.find((b) => String(b.id) === params.cn) || branches[0];
      let ngay = Number.isInteger(Number(params.ngay)) && params.ngay !== undefined ? Number(params.ngay) : null;
      if (ngay === null || ngay < 0 || ngay > 6) {
        const delta = Math.round((new Date(vnToday()) - new Date(week.start_date)) / 864e5);
        ngay = delta >= 0 && delta <= 6 ? delta : 0;
      }
      const [rows, emps] = await Promise.all([
        sel('schedule_published', 'shift, role, employee_id', (b) => b.eq('week_id', week.id).eq('branch_id', branch.id).eq('weekday', ngay)),
        sel('employees', 'id, code, name, rank'),
      ]);
      const ebyId = new Map(emps.map((e) => [e.id, e]));
      const roleOrder = new Map(cat.roles.map((r, i) => [r.name, i]));
      const blocks = cat.branchShifts(branch.id).map((s) => ({
        shift: s.name, hours: `${hh(s.start)} – ${hh(s.end)}`,
        people: rows.filter((r) => r.shift === s.name).map((r) => ({ ...r, e: ebyId.get(r.employee_id) || {} }))
          .sort((a, b) => (roleOrder.get(a.role) ?? 99) - (roleOrder.get(b.role) ?? 99) || RANKS.indexOf(b.e.rank) - RANKS.indexOf(a.e.rank) || String(a.e.name).localeCompare(String(b.e.name), 'vi')),
      }));
      const base = `/lich?tab=co-so&cn=${branch.id}&ngay=${ngay}&`;
      body = html`${weeknav(base, week, prev, next, editing ? 'Đang chỉnh sửa · bản đã chốt gần nhất' : 'Đã chốt')}
        <div class="grid4" role="group" aria-label="Chi nhánh">${branches.map((b) => html`<a class="pick ${b.id === branch.id ? 'on' : ''}" href="#/lich?tab=co-so&tuan=${week.start_date}&cn=${b.id}&ngay=${ngay}">${b.code}</a>`)}</div>
        <div class="grid7" role="group" aria-label="Ngày">${WD_SHORT.map((w, i) => html`<a class="dpick ${i === ngay ? 'on' : ''}" href="#/lich?tab=co-so&tuan=${week.start_date}&cn=${branch.id}&ngay=${i}"><b>${w}</b><span>${dm(addDays(week.start_date, i))}</span></a>`)}</div>
        <div style="font-size:16px;font-weight:700">${branch.code} – ${branch.name} · ${WEEKDAYS[ngay]} ${dm(addDays(week.start_date, ngay))}</div>
        ${blocks.map((b) => html`<section class="card flush"><div class="shift-h"><strong>Ca ${b.shift}</strong><span class="det">${b.hours}</span></div>
          ${b.people.length ? b.people.map((p) => html`<div class="prow"><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:500">${p.e.code} – ${p.e.name}</span>${p.employee_id === me.employee_id ? html`<span class="me-chip">Bạn</span>` : ''}</div><span class="role-chip">${p.role}</span></div>`) : html`<div class="prow det">Chưa có ai</div>`}
        </section>`)}
        <div class="det" style="line-height:1.5">Chỉ hiện ai làm ca nào, vị trí nào. Không hiện ô trống, định biên hay trạng thái order.</div>`;
    }
  }
  return {
    title: 'Lịch làm',
    html: isManager()
      ? html`<div class="page-head"><div><h1>Lịch làm</h1></div></div>${tabs}<div class="stack" style="max-width:560px;gap:12px">${body}</div>`
      : html`${tabs}${body}`,
  };
}
