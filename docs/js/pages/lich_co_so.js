// Xếp lịch cơ sở: lưới ca – vị trí × 7 ngày, chọn người, vượt định biên, khóa 1 người xếp, chốt tuần
import { render as rerender, can, state } from '../app.js';
import { CODE, RANKS, SENIOR, ST_CHOT, ST_SUA, ST_XEP, addDays, catalog, closure, getWeek, hasPublished, orderWindow, parseWeekParam, requirements, statusLabel, vnToday, weekDays, weekLabel, weekStart } from '../data.js';
import { bindWeekPick } from '../parts.js';
import { rpc, sel, selAll } from '../sb.js';
import { $, esc, flash, go, html, raw, showSaved, hhmm } from '../ui.js';
import { computeWarnings } from '../warnings.js';

export const perm = 'xem_tat_ca';
const WARN_LABEL = { off: 'NGHỈ', none: 'CHƯA ORDER' };

const CSS = raw(`<style>
  .grid-wrap { overflow: auto; max-height: calc(100vh - 140px); }
  .sg { border-collapse: separate; border-spacing: 0; font-size: 12px; width: 100%; }
  .sg th, .sg td { padding: 0; border-bottom: 1px solid var(--line-soft); }
  .sg thead th { position: sticky; top: 0; z-index: 2; background: var(--header); color: #fff; padding: 10px 6px; font-size: 12px; text-align: center; }
  .sg .lab { position: sticky; left: 0; z-index: 1; min-width: 210px; padding: 8px 12px; font-weight: 600; text-align: left; white-space: nowrap; }
  .sg thead .lab { z-index: 3; }
  .sg tr.r-role .lab { background: var(--sage-bg); color: var(--forest); } .sg tr.r-role.alt .lab { background: var(--plum-bg); color: var(--plum-ink); }
  .sg tr.r-extra .lab { color: #9a3412; } .sg tr.r-total .lab, .sg tr.r-total td { background: var(--subtle); }
  .sg td.c { padding: 4px; min-width: 150px; }
  .cell { height: 36px; border-radius: 8px; display: flex; align-items: center; padding: 0 8px; font-weight: 600; font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; position: relative; border: 1px solid transparent; }
  .cell.sel { cursor: pointer; } .cell.sel:hover { outline: 2px solid var(--focus); }
  .cell.empty { background: #fff; border-color: var(--line-strong); color: var(--ink); } .cell.extra { background: #fff; border: 1px dashed var(--line-strong); color: var(--muted); font-weight: 500; }
  .cell.blocked { background: var(--line-soft); color: var(--muted); font-weight: 500; justify-content: center; }
  .cell.filled { background: #fef3c7; border-color: #f59e0b; color: #78350f; } .cell.warnc { border: 2px solid #dc2626; }
  .cell .tag { font-size: 10px; font-weight: 700; color: #b91c1c; margin-left: 6px; }
  .tot { height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; border-radius: 8px; }
  .tot.short { background: #fee2e2; color: #b91c1c; } .tot.ok { background: #a7e8bd; color: #0f4a26; } .tot.over { background: #fef3c7; color: #a16207; } .tot.zero { color: var(--muted); }
  .rm-extra { margin-left: 8px; padding: 0 6px; line-height: 1; border: none; background: none; color: #b91c1c; cursor: pointer; font-weight: 700; font-size: 14px; }
  .picker { position: absolute; z-index: 50; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 10px 30px rgba(15,27,61,.25); max-height: 420px; overflow: auto; width: 360px; padding: 6px; }
  .picker button { display: block; width: 100%; text-align: left; border: none; background: none; padding: 7px 10px; border-radius: 6px; font-size: 13px; cursor: pointer; color: var(--ink); }
  .picker button:hover, .picker button:focus { background: var(--caramel-soft); outline: none; }
  .picker .g-ok { background: var(--ok-bg); color: var(--ok-ink); } .picker .g-none { background: var(--subtle); color: var(--ink-2); } .picker .g-off { background: #fff1f2; color: #9f1239; }
  .picker .cur { font-weight: 700; } .picker .hd { font-size: 11px; font-weight: 700; color: var(--muted); padding: 8px 10px 2px; }
  .lg { padding: 2px 6px; border-radius: 6px; } .lg.empty { border: 1px solid var(--line-strong); } .lg.filled { background: #fef3c7; } .lg.warn { border: 2px solid #dc2626; }
  .m-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; padding: 10px; background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
  .m-day { position: relative; min-height: 52px; border-radius: 10px; border: 1px solid var(--line-strong); background: #fff; color: var(--ink); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-family: inherit; cursor: pointer; padding: 0; }
  .m-day b { font-size: 12px; } .m-day span { font-size: 11px; color: var(--muted); }
  .m-day.on { background: var(--navy); border-color: var(--navy); color: #fff; } .m-day.on span { color: #fff; }
  .m-dot { position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; border-radius: 4px; background: #dc2626; }
  .m-title { font-size: 15px; font-weight: 700; padding: 12px 12px 4px; } .m-pad { padding: 14px; }
  .m-shift { margin: 10px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: #fff; }
  .m-sh-h { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: var(--subtle); font-size: 15px; }
  .m-tot { min-width: 64px; height: 30px; } .m-role { font-size: 12px; font-weight: 700; color: var(--primary-dark); padding: 10px 14px 2px; text-transform: uppercase; }
  .m-row { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 14px; } .m-lab { width: 54px; font-size: 12px; font-weight: 600; color: var(--muted); flex-shrink: 0; }
  .m-row .cell { flex-grow: 1; min-width: 0; }
  .cell.m { height: auto; min-height: 46px; padding: 8px 10px; font-size: 14px; white-space: normal; line-height: 1.3; flex-wrap: wrap; }
  .sheet-t { position: sticky; top: -6px; background: #fff; padding: 10px 12px; font-size: 13px; color: var(--ink); }
  .show-m { display: none; } .wkbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 18px; } .wk-lab { font-weight: 700; padding: 0 6px; }
  @media (max-width: 760px) {
    .show-m { display: inline; } .wkbar { padding: 10px 12px; flex-wrap: nowrap; } .wkbar .btn { min-height: 44px; min-width: 44px; padding: 0 12px; }
    .wk-lab { flex-grow: 1; text-align: center; font-size: 15px; } .branch-nav { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .hide-m { display: none !important; } .grid-wrap { max-height: none; overflow: visible; }
    .picker { position: fixed !important; left: 0 !important; right: 0; top: auto !important; bottom: 0; width: auto; max-height: 72vh; border-radius: 16px 16px 0 0; padding: 4px 8px 16px; }
    .picker button { padding: 14px 12px; font-size: 15px; } .toolbar .btn { flex-grow: 1; }
  }
</style>`);

export async function render({ params, me }) {
  const start = parseWeekParam(params.tuan) || addDays(weekStart(vnToday()), 7);
  const cat = await catalog();
  const branches = cat.activeBranches;
  const branch = branches.find((b) => String(b.id) === params.cn) || branches[0];
  const week = await getWeek(start);
  const cnq = branch ? `&cn=${branch.id}` : '';
  const head = (sub) => html`<div class="page-head"><div><h1>Xếp lịch cơ sở ${branch ? branch.code : ''}</h1><div class="sub">Tuần ${weekLabel(start)}${sub}</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
    <section class="card wkbar">
      <strong class="hide-m" style="font-size:14px;color:var(--primary-dark)">Tuần làm việc</strong>
      <a class="btn sm secondary" href="#/quan-ly/lich-co-so?tuan=${addDays(start, -7)}${cnq}" aria-label="Tuần trước">‹<span class="hide-m">&nbsp;Tuần trước</span></a>
      <div class="wk-lab">${weekLabel(start)}</div>
      <a class="btn sm secondary" href="#/quan-ly/lich-co-so?tuan=${addDays(start, 7)}${cnq}" aria-label="Tuần sau"><span class="hide-m">Tuần sau&nbsp;</span>›</a>
      <form class="toolbar hide-m week-pick" data-path="/quan-ly/lich-co-so" data-extra="${cnq}" style="gap:8px;margin-left:auto">
        <input class="input sm" type="date" name="tuan" value="${start}" aria-label="Chọn ngày trong tuần" required>
        <button class="btn sm" type="submit" style="min-height:40px">Chọn tuần</button></form></section>
    <nav class="toolbar branch-nav" aria-label="Chọn chi nhánh">${branches.map((b) => html`<a class="btn sm ${branch && b.id === branch.id ? '' : 'secondary'}" href="#/quan-ly/lich-co-so?tuan=${start}&cn=${b.id}" style="min-height:44px"><span class="hide-m">${b.code} – ${b.name}</span><span class="show-m">${b.code}</span></a>`)}</nav>`;

  if (!week || !branch) {
    return { title: 'Lịch cơ sở', html: html`${head('')}<section class="card stack" style="max-width:640px"><h2>Tuần ${weekLabel(start)} chưa được tạo</h2>
      <div>Tạo tuần mới ở trang <a href="#/quan-ly/order?tuan=${start}">Order lịch làm</a>, chờ nhân viên order xong rồi bắt đầu xếp lịch.</div></section>${CSS}`, mount: () => bindWeekPick() };
  }
  const cl = await closure(week.id);
  const status = cl?.status || null;
  if (!status) {
    const win = await orderWindow(week.id);
    return {
      title: 'Lịch cơ sở',
      html: html`${head('')}<section class="card stack" style="max-width:680px"><h2>Chưa bắt đầu xếp lịch</h2>
        <div style="color:var(--ink-2);line-height:1.6">Kiểm tra và bổ sung order ở trang <a href="#/quan-ly/order?tuan=${start}">Order lịch làm</a>. Khi bấm “Bắt đầu xếp lịch”, web tự đưa lịch cố định vào các ô nhân viên order “Đi làm được”.</div>
        ${can('xep_lich') ? (win.state === 'da_dong' ? html`<div><button class="btn" type="button" id="start-btn">Bắt đầu xếp lịch</button></div>`
          : html`<div class="toolbar"><button class="btn" type="button" disabled>Bắt đầu xếp lịch</button><span style="font-size:14px;color:var(--muted)">Mở sau giờ hết hạn order: ${win.close_text}</span></div>`)
          : html`<div class="alert warn">Chỉ người có quyền xếp lịch mới bắt đầu được.</div>`}</section>${CSS}`,
      mount() {
        bindWeekPick();
        const b = $('#start-btn');
        if (b) b.addEventListener('click', async () => {
          try { const n = await rpc('app_start_scheduling', { p_week: week.id }); flash(`Đã bắt đầu xếp lịch tuần ${weekLabel(start)}. Đã đưa ${n} ca từ lịch cố định vào lịch.`); }
          catch (e) { flash(e.message, 'error'); }
          rerender();
        });
      },
    };
  }

  const editable = status === ST_XEP || status === ST_SUA;
  let holds = false; let lock = null;
  if (editable && can('xep_lich')) {
    const r = await rpc('app_schedule_lock', { p_week: week.id, p_force: false });
    holds = !!r.ok; lock = r.lock;
  } else if (editable) {
    const p = await rpc('app_schedule_poll', { p_week: week.id });
    lock = p.lock ? { who: p.lock, acquired_at: p.lock_since } : null;
  }
  const [req, extraRows, emps, eb, er, orders, wse, published] = await Promise.all([
    requirements(week.id, cl),
    sel('schedule_extra_rows', 'shift, role, count', (b) => b.eq('week_id', week.id).eq('branch_id', branch.id)),
    sel('employees', 'id, code, name, rank', (b) => b.eq('status', 'Đang làm')),
    selAll('employee_branches', 'employee_id, branch_id'),
    selAll('employee_roles', 'employee_id, role'),
    selAll('order_entries', 'employee_id, weekday, shift, status', (b) => b.eq('week_id', week.id)),
    selAll('weekly_schedule_entries', 'id, employee_id, weekday, shift, base_status, state, branch_id, role, slot, source, is_manual', (b) => b.eq('week_id', week.id).order('id')),
    hasPublished(week.id),
  ]);
  const ebMap = {}; eb.forEach((r) => (ebMap[r.employee_id] ||= []).push(r.branch_id));
  const erMap = {}; er.forEach((r) => (erMap[r.employee_id] ||= []).push(r.role));
  const base = {};
  orders.forEach((r) => { base[`${r.employee_id}|${r.weekday}|${r.shift}`] = CODE[r.status] || 'none'; });
  const assign = [];
  wse.forEach((r) => {
    base[`${r.employee_id}|${r.weekday}|${r.shift}`] = CODE[r.base_status] || 'none';
    if (r.state === 'ĐÃ XẾP' && r.branch_id) assign.push({ eid: r.employee_id, d: r.weekday, s: r.shift, b: r.branch_id, r: r.role, slot: r.slot, fixed: r.source === 'FIXED', manual: !!r.is_manual });
  });
  const P = {
    week_id: week.id, branch: { id: branch.id, code: branch.code, name: branch.name }, days: weekDays(week.start_date),
    shifts: cat.branchShifts(branch.id).map((s) => ({ name: s.name, start: s.start, end: s.end })),
    roles: cat.activeRoles.map((r) => r.name),
    req: Object.fromEntries(Object.entries(req).filter(([k]) => k.startsWith(`${branch.id}|`)).map(([k, n]) => [k.split('|').slice(1).join('|'), n])),
    extra: Object.fromEntries(extraRows.map((r) => [`${r.shift}|${r.role}`, r.count])),
    employees: emps.map((e) => ({ id: e.id, code: e.code, name: e.name, rank: e.rank, rank_i: Math.max(RANKS.indexOf(e.rank), 0), senior: SENIOR.has(e.rank), branches: ebMap[e.id] || [], roles: erMap[e.id] || [] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    base, assign, version: cl.updated_at, can_edit: editable && holds,
  };
  const canBack = status === ST_XEP && !published && !wse.some((r) => r.state === 'ĐÃ XẾP' && r.source === 'MANUAL');
  let lockBox = '';
  if (editable && !can('xep_lich')) {
    lockBox = html`<div class="alert warn" role="status">Tài khoản của bạn chỉ được <strong>xem</strong> lịch, chưa có quyền <strong>Xếp lịch</strong>. Chủ bật quyền này ở mục Nhân viên &amp; tài khoản → Phân quyền.</div>`;
  } else if (editable && !holds && lock) {
    lockBox = html`<div class="alert warn toolbar" role="status"><span>Đang được <strong>${lock.who}</strong> xếp lịch từ ${(lock.acquired_at || '').slice(11, 16)}. Bạn đang ở chế độ chỉ xem; màn hình tự cập nhật.</span>
      ${can('phan_quyen') ? html`<button class="btn sm" type="button" id="take-btn" style="margin-left:auto">Giành quyền xếp</button>` : ''}</div>`;
  } else if (!editable) {
    lockBox = html`<div class="alert ok toolbar" role="status"><span>Tuần đã chốt. Lịch đang khóa, nhân viên đã xem được lịch.</span>
      ${can('chot_tuan') ? html`<button class="btn sm secondary" type="button" id="reopen-btn" style="margin-left:auto">Mở lại tuần để sửa</button>` : ''}</div>`;
  } else if (status === ST_SUA && published) {
    lockBox = html`<div class="alert warn">Tuần đang được mở lại để sửa. Nhân viên vẫn xem bản chốt gần nhất cho tới khi bạn chốt lại.</div>`;
  }

  return {
    title: `Lịch cơ sở ${branch.code}`,
    html: html`${head(html` · <span class="pill ${status === ST_CHOT ? 'ok' : 'warn'}">${statusLabel(status, published)}</span>`)}
      ${lockBox}
      <section class="card toolbar" style="padding:12px 18px">
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600"><input type="checkbox" class="check" id="show-off"> Hiện cả nhân viên đã đăng ký nghỉ</label>
        ${P.can_edit ? html`<button class="btn sm" type="button" id="add-extra">Thêm vượt định biên</button>` : ''}
        <button class="btn sm secondary" type="button" id="refresh-btn">Làm mới</button>
        <div style="margin-left:auto" class="toolbar">
          ${canBack && can('xep_lich') && holds ? html`<button class="btn sm secondary" type="button" id="back-btn">Quay lại order</button>` : ''}
          ${editable && can('chot_tuan') ? html`<button class="btn sm" type="button" id="chot-btn" style="background:var(--ok-line)">Chốt tuần</button>` : ''}
        </div>
      </section>
      <div class="hide-m" style="font-size:13px;font-weight:600;line-height:1.8">
        Chú giải: <span class="lg empty">Trắng: chưa xếp</span> <span class="lg filled">Vàng: đã xếp ca</span> CĐ: lịch cố định ·
        <span style="color:#dc2626">•</span> quản lý đã xếp tay · <span class="lg warn">⚠ Viền đỏ: order Nghỉ / Chưa order</span> ·
        Tổng ca: <span style="color:#b91c1c">đỏ thiếu</span>, <span style="color:var(--ok-line)">xanh đủ</span>, <span style="color:#a16207">vàng vượt</span>, <strong>!</strong> thiếu người Cấp 2 hoặc Quản lý</div>
      <section class="card flush"><div class="grid-wrap" id="grid"></div></section>
      <div id="picker" class="picker" role="listbox" hidden></div>
      <dialog id="extra-dialog"><form class="stack" id="extra-form"><h2>Thêm vượt định biên</h2>
        <div style="color:var(--ink-2);font-size:14px">Thêm một hàng cho cả tuần này; định biên gốc không đổi. Ngày nào cần thì xếp người vào.</div>
        <div class="field"><label for="extra-shift">Ca</label><select class="input" id="extra-shift"></select></div>
        <div class="field"><label for="extra-role">Vai trò</label><select class="input" id="extra-role"></select></div>
        <div class="toolbar" style="justify-content:flex-end"><button class="btn secondary" type="button" data-close>Hủy</button><button class="btn" type="submit">Thêm hàng</button></div></form></dialog>
      <dialog id="chot-dialog"><div class="stack"><h2>Chốt lịch tuần ${weekLabel(start)}?</h2>
        <div id="chot-summary" style="line-height:1.7;color:var(--ink-2)">Đang kiểm tra…</div>
        <div style="font-size:13px;color:var(--muted)">Sau khi chốt, lịch bị khóa và nhân viên xem được lịch của mình.${published ? ' Nhân viên có ca thay đổi sẽ nhận thông báo.' : ''}</div>
        <div class="toolbar" style="justify-content:flex-end"><button class="btn secondary" type="button" data-close>Hủy</button><button class="btn" type="button" id="chot-go" style="background:var(--ok-line)">Chốt tuần</button></div></div></dialog>
      ${CSS}`,
    mount() { return mountGrid(P, { week, start, editable, holds }); },
  };
}

function mountGrid(P, { week, start, holds }) {
  bindWeekPick();
  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  const empById = new Map(P.employees.map((e) => [e.id, e]));
  const k3 = (e, d, s) => `${e}|${d}|${s}`;
  const baseOf = (e, d, s) => P.base[k3(e, d, s)] || 'none';
  const reqOf = (d, s, r) => P.req[`${d}|${s}|${r}`] || 0;
  const extraOf = (s, r) => P.extra[`${s}|${r}`] || 0;
  const maxReq = (s, r) => Math.max(0, ...P.days.map((d) => reqOf(d.index, s, r)));
  const groupOf = (d, s, r) => P.assign.filter((a) => a.b === P.branch.id && a.d === d && a.s === s && a.r === r);
  const rowsFor = (s, r) => Math.max(maxReq(s, r) + extraOf(s, r), ...P.days.map((d) => groupOf(d.index, s, r).length));
  function place(d, s, r, rows) {
    const arr = new Array(rows).fill(null);
    const list = groupOf(d, s, r).slice().sort((a, b) => (a.slot ?? 999) - (b.slot ?? 999));
    const rest = [];
    list.forEach((a) => { if (a.slot != null && a.slot < rows && !arr[a.slot]) arr[a.slot] = a; else rest.push(a); });
    rest.forEach((a) => { const i = arr.indexOf(null); if (i >= 0) arr[i] = a; });
    return arr;
  }
  const filledCell = (a, d, s, attrs, mobile) => {
    const e = empById.get(a.eid) || { code: '?', name: 'Ngừng làm' };
    const b = baseOf(a.eid, d, s); const warn = b !== 'ok';
    const title = `${e.code} – ${e.name} · ${e.rank || ''}${a.fixed ? ' · Lịch cố định' : ''}${a.manual ? ' · Quản lý xếp tay' : ''}${warn ? ` · Order: ${WARN_LABEL[b]}` : ''}`;
    return `<div class="cell filled ${mobile ? 'm ' : ''}${warn ? 'warnc ' : ''}${P.can_edit ? 'sel' : ''}"${attrs} data-e="${a.eid}" title="${esc(title)}">`
      + (a.fixed && !a.manual ? 'CĐ ' : (a.manual ? '<span style="color:#dc2626;margin-right:4px">•</span>' : '')) + esc(`${e.code} – ${e.name}`.toUpperCase())
      + (warn ? `<span class="tag">⚠ ${WARN_LABEL[b]}</span>` : '') + '</div>';
  };
  function shiftTotal(d, s) {
    const asg = P.assign.filter((a) => a.b === P.branch.id && a.d === d && a.s === s);
    const need = P.roles.reduce((t, r) => t + reqOf(d, s, r), 0);
    const senior = asg.filter((a) => (empById.get(a.eid) || {}).senior).length;
    const cls = !need && !asg.length ? 'zero' : asg.length < need ? 'short' : asg.length > need ? 'over' : 'ok';
    const tip = [`Tổng: ${asg.length}/${need}`].concat(P.roles.map((r) => `${r}: ${asg.filter((a) => a.r === r).length}/${reqOf(d, s, r)}`), [`Cấp 2+: ${senior}`]).join('\n');
    return { n: asg.length, need, cls, bang: (need || asg.length) && senior === 0, tip };
  }
  function renderGrid() {
    let h = '<table class="sg"><thead><tr><th class="lab">CA / VỊ TRÍ</th>';
    P.days.forEach((d) => { h += `<th>${esc(d.name.toUpperCase())}<br>${d.date}</th>`; });
    h += '</tr></thead><tbody>';
    if (!P.shifts.length) h += '<tr><td class="lab" colspan="8">Chi nhánh chưa bật ca nào.</td></tr>';
    P.shifts.forEach((s) => {
      P.roles.forEach((r, ri) => {
        const rows = rowsFor(s.name, r), mr = maxReq(s.name, r), places = {};
        P.days.forEach((d) => { places[d.index] = place(d.index, s.name, r, rows); });
        for (let i = 0; i < rows; i++) {
          const isExtra = i >= mr; const lastExtra = isExtra && i === rows - 1;
          h += `<tr class="r-role ${ri % 2 ? 'alt ' : ''}${isExtra ? 'r-extra' : ''}"><th class="lab">${esc(`${s.name.toUpperCase()} – ${r.toUpperCase()} ${i + 1}`)}${isExtra ? ' – VƯỢT ĐỊNH BIÊN' : ''}`
            + (lastExtra && P.can_edit ? `<button class="rm-extra" data-s="${esc(s.name)}" data-r="${esc(r)}" title="Xóa hàng vượt định biên" aria-label="Xóa hàng vượt định biên">×</button>` : '') + '</th>';
          P.days.forEach((d) => {
            const a = places[d.index][i];
            const attrs = ` data-d="${d.index}" data-s="${esc(s.name)}" data-r="${esc(r)}" data-i="${i}"`;
            if (a) h += `<td class="c">${filledCell(a, d.index, s.name, attrs, false)}</td>`;
            else if (i < reqOf(d.index, s.name, r)) h += `<td class="c"><div class="cell empty ${P.can_edit ? 'sel' : ''}"${attrs}>ĐỂ TRỐNG</div></td>`;
            else if (isExtra) h += `<td class="c"><div class="cell extra ${P.can_edit ? 'sel' : ''}"${attrs}>Ngoài định biên</div></td>`;
            else h += '<td class="c"><div class="cell blocked">— NGOÀI ĐỊNH BIÊN —</div></td>';
          });
          h += '</tr>';
        }
      });
      h += `<tr class="r-total"><th class="lab" style="text-align:center">TỔNG CA ${esc(s.name.toUpperCase())}</th>`;
      P.days.forEach((d) => { const t = shiftTotal(d.index, s.name); h += `<td class="c"><div class="tot ${t.cls}" title="${esc(t.tip)}">${t.n}/${t.need}${t.bang ? ' !' : ''}</div></td>`; });
      h += '</tr>';
    });
    $('#grid').innerHTML = h + '</tbody></table>';
  }
  const mq = window.matchMedia('(max-width: 760px)');
  let curDay = (() => { const d = Math.round((new Date(vnToday()) - new Date(start)) / 864e5); return d >= 0 && d <= 6 ? d : 0; })();
  function renderMobile() {
    const wd = P.days[curDay];
    let h = '<div class="m-days" role="group" aria-label="Chọn ngày">';
    P.days.forEach((d) => {
      const bad = P.shifts.some((s) => { const t = shiftTotal(d.index, s.name); return t.cls === 'short' || t.bang; });
      h += `<button type="button" class="m-day ${d.index === curDay ? 'on' : ''}" data-day="${d.index}"><b>${esc(d.short)}</b><span>${d.date}</span>${bad ? '<i class="m-dot"></i>' : ''}</button>`;
    });
    h += `</div><div class="m-title">${esc(`${P.branch.code} – ${P.branch.name}`)} · ${esc(`${wd.name} ${wd.date}`)}</div>`;
    if (!P.shifts.length) h += '<div class="m-pad">Chi nhánh chưa bật ca nào.</div>';
    P.shifts.forEach((s) => {
      const t = shiftTotal(curDay, s.name);
      h += `<section class="m-shift"><div class="m-sh-h"><div><strong>Ca ${esc(s.name)}</strong> <span class="det">${(s.start || '').slice(0, 5)}–${(s.end || '').slice(0, 5)}</span></div><span class="tot ${t.cls} m-tot">${t.n}/${t.need}${t.bang ? ' !' : ''}</span></div>`;
      P.roles.forEach((r) => {
        const rows = rowsFor(s.name, r), mr = maxReq(s.name, r), arr = place(curDay, s.name, r, rows);
        const lines = [];
        for (let i = 0; i < rows; i++) {
          const a = arr[i], isExtra = i >= mr;
          if (!a && !(i < reqOf(curDay, s.name, r)) && !isExtra) continue;
          const attrs = ` data-d="${curDay}" data-s="${esc(s.name)}" data-r="${esc(r)}" data-i="${i}"`;
          const cell = a ? filledCell(a, curDay, s.name, attrs, true)
            : i < reqOf(curDay, s.name, r) ? `<div class="cell empty m ${P.can_edit ? 'sel' : ''}"${attrs}>ĐỂ TRỐNG · bấm để chọn</div>`
            : `<div class="cell extra m ${P.can_edit ? 'sel' : ''}"${attrs}>Ngoài định biên</div>`;
          const lastExtra = isExtra && i === rows - 1 && P.can_edit;
          lines.push(`<div class="m-row"><div class="m-lab">${isExtra ? 'Vượt ĐB' : (i + 1)}${lastExtra ? `<button class="rm-extra" data-s="${esc(s.name)}" data-r="${esc(r)}" aria-label="Xóa hàng vượt định biên">×</button>` : ''}</div>${cell}</div>`);
        }
        if (lines.length) h += `<div class="m-role">${esc(r)}</div>${lines.join('')}`;
      });
      h += '</section>';
    });
    $('#grid').innerHTML = h;
  }
  const draw = () => (mq.matches ? renderMobile() : renderGrid());
  const onMq = () => { closePicker(); draw(); };
  mq.addEventListener('change', onMq);

  const picker = $('#picker');
  let pickCtx = null;
  function closePicker() { picker.hidden = true; pickCtx = null; }
  function openPicker(cell) {
    const d = +cell.dataset.d, s = cell.dataset.s, r = cell.dataset.r, i = +cell.dataset.i;
    const cur = cell.dataset.e ? +cell.dataset.e : null;
    const showOff = $('#show-off').checked;
    const busy = new Set(P.assign.filter((a) => a.d === d && a.s === s && a.eid !== cur).map((a) => a.eid));
    const cands = P.employees.filter((e) => e.branches.includes(P.branch.id) && e.roles.includes(r) && !busy.has(e.id));
    const groups = { ok: [], none: [], off: [] };
    cands.forEach((e) => groups[baseOf(e.id, d, s)].push(e));
    Object.values(groups).forEach((g) => g.sort((a, b) => b.rank_i - a.rank_i || a.name.localeCompare(b.name, 'vi')));
    const line = (e, g) => `<button type="button" class="g-${g}${e.id === cur ? ' cur' : ''}" data-pick="${e.id}">${e.id === cur ? '✓ ' : ''}${g === 'off' ? '⚠ ' : ''}${esc(`${e.code} – ${e.name} – ${e.rank}`)}${g === 'none' ? ' – CHƯA ORDER' : ''}</button>`;
    let h = '<button type="button" data-pick="">ĐỂ TRỐNG</button>';
    if (groups.ok.length) h += '<div class="hd">ĐI LÀM ĐƯỢC</div>' + groups.ok.map((e) => line(e, 'ok')).join('');
    if (groups.none.length) h += '<div class="hd">CHƯA ORDER</div>' + groups.none.map((e) => line(e, 'none')).join('');
    if (showOff && groups.off.length) h += '<div class="hd">ĐÃ ĐĂNG KÝ NGHỈ</div>' + groups.off.map((e) => line(e, 'off')).join('');
    if (!cands.length) h += '<div class="hd">Không còn ai phù hợp (đúng chi nhánh, vị trí, chưa xếp ca này).</div>';
    picker.innerHTML = h;
    if (mq.matches) { const wd = P.days[d]; picker.insertAdjacentHTML('afterbegin', `<div class="hd sheet-t">${esc(`${r} · Ca ${s} · ${wd.name} ${wd.date}`)}</div>`); }
    const rc = cell.getBoundingClientRect();
    picker.style.left = `${Math.min(window.scrollX + rc.left, window.scrollX + document.documentElement.clientWidth - 380)}px`;
    picker.style.top = `${window.scrollY + rc.bottom + 4}px`;
    picker.hidden = false;
    pickCtx = { d, s, r, i, cur };
    picker.querySelector('button')?.focus();
  }
  async function pick(eid) {
    const c = pickCtx; closePicker();
    if (!c || (eid || null) === c.cur) return;
    try {
      const res = await rpc('app_assign', { p_week: P.week_id, p_branch: P.branch.id, p_day: c.d, p_shift: c.s, p_role: c.r, p_slot: c.i, p_emp: eid || null, p_prev: c.cur });
      P.assign = P.assign.filter((a) => !(a.d === c.d && a.s === c.s && (a.eid === c.cur || a.eid === eid)));
      if (eid) P.assign.push({ eid, d: c.d, s: c.s, b: P.branch.id, r: c.r, slot: c.i, fixed: false, manual: true });
      P.version = res.version; draw(); showSaved('Đã lưu · ' + hhmm());
    } catch (e) { showSaved(e.message, true); if (/chế độ chỉ xem|tải lại/i.test(e.message)) setTimeout(rerender, 1500); }
  }
  async function extra(s, r, delta) {
    try {
      const res = await rpc('app_extra_row', { p_week: P.week_id, p_branch: P.branch.id, p_shift: s, p_role: r, p_delta: delta });
      P.extra[`${s}|${r}`] = res.count; P.version = res.version;
      if (delta < 0 && res.removed) { rerender(); return; }
      draw(); showSaved('Đã lưu · ' + hhmm());
    } catch (e) { showSaved(e.message, true); }
  }
  const grid = $('#grid');
  grid.addEventListener('click', (ev) => {
    const dayBtn = ev.target.closest('.m-day');
    if (dayBtn) { curDay = +dayBtn.dataset.day; closePicker(); draw(); return; }
    const rm = ev.target.closest('.rm-extra');
    if (rm) {
      const rows = rowsFor(rm.dataset.s, rm.dataset.r);
      const has = P.days.some((d) => place(d.index, rm.dataset.s, rm.dataset.r, rows)[rows - 1]);
      if (has && !confirm('Hàng này còn người được xếp. Xóa hàng sẽ bỏ xếp những người trong hàng. Vẫn xóa?')) return;
      extra(rm.dataset.s, rm.dataset.r, -1); return;
    }
    const cell = ev.target.closest('.cell.sel');
    if (cell && P.can_edit) { ev.stopPropagation(); openPicker(cell); }
  });
  picker.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-pick]'); if (b) pick(b.dataset.pick ? +b.dataset.pick : null); });
  const docClick = (ev) => { if (!picker.hidden && !picker.contains(ev.target)) closePicker(); };
  const docKey = (ev) => { if (ev.key === 'Escape') closePicker(); };
  document.addEventListener('click', docClick);
  document.addEventListener('keydown', docKey);
  $('#show-off').addEventListener('change', closePicker);
  $('#refresh-btn').addEventListener('click', () => rerender());

  const addBtn = $('#add-extra');
  if (addBtn) {
    const dlg = $('#extra-dialog');
    $('#extra-shift').innerHTML = P.shifts.map((s) => `<option>${esc(s.name)}</option>`).join('');
    $('#extra-role').innerHTML = P.roles.map((r) => `<option>${esc(r)}</option>`).join('');
    addBtn.addEventListener('click', () => dlg.showModal());
    $('#extra-form').addEventListener('submit', (ev) => { ev.preventDefault(); dlg.close(); extra($('#extra-shift').value, $('#extra-role').value, 1); });
  }
  const chotBtn = $('#chot-btn');
  if (chotBtn) {
    chotBtn.addEventListener('click', async () => {
      $('#chot-dialog').showModal();
      const box = $('#chot-summary');
      try {
        const w = await computeWarnings(week);
        const items = [['thieu', 'ca thiếu người so với định biên'], ['thieu_cap2', 'ca thiếu người Cấp 2 hoặc Quản lý'], ['xep_nghi', 'ô xếp người order Nghỉ'], ['xep_chua_order', 'ô xếp người Chưa order'], ['vuot', 'ca xếp vượt định biên'], ['thong_3_ca', 'người làm thông 3 ca']];
        const bad = items.filter(([k]) => w[k].length > 0);
        box.innerHTML = bad.length ? 'Còn: <ul style="margin:6px 0 0 18px">' + bad.map(([k, l]) => `<li><strong>${w[k].length}</strong> ${l}</li>`).join('') + '</ul>Vẫn chốt?' : 'Không có cảnh báo nào.';
      } catch (e) { box.textContent = 'Không lấy được tóm tắt cảnh báo.'; }
    });
    $('#chot-go').addEventListener('click', async () => {
      $('#chot-go').disabled = true;
      try {
        const r = await rpc('app_chot', { p_week: P.week_id });
        flash(r.first ? `Đã chốt lịch tuần ${weekLabel(start)}. Nhân viên đã xem được lịch.` : `Đã chốt lại lịch tuần ${weekLabel(start)}. Đã gửi thông báo cho ${r.changed} nhân viên có ca thay đổi.`);
      } catch (e) { flash(e.message, 'error'); }
      rerender();
    });
  }
  $('#reopen-btn')?.addEventListener('click', async () => {
    try { await rpc('app_reopen', { p_week: P.week_id }); flash('Đã mở lại tuần để chỉnh sửa. Nhân viên vẫn xem bản đã chốt gần nhất cho tới khi chốt lại.'); }
    catch (e) { flash(e.message, 'error'); }
    rerender();
  });
  $('#take-btn')?.addEventListener('click', async () => {
    try { await rpc('app_schedule_lock', { p_week: P.week_id, p_force: true }); flash('Bạn đã giành quyền xếp lịch. Người đang xếp sẽ chuyển sang chỉ xem.'); }
    catch (e) { flash(e.message, 'error'); }
    rerender();
  });
  $('#back-btn')?.addEventListener('click', async () => {
    if (!confirm('Quay lại giai đoạn order? Các ô lịch cố định đã điền sẽ được xóa.')) return;
    try { await rpc('app_back_to_order', { p_week: P.week_id }); flash('Đã quay lại giai đoạn order. Muốn nhân viên order tiếp, hãy cài giờ hết hạn mới ở Giờ order.'); go(`/quan-ly/order?tuan=${start}`); }
    catch (e) { flash(e.message, 'error'); rerender(); }
  });

  // Tự cập nhật (20 giây) & giữ quyền xếp
  const timer = setInterval(async () => {
    try {
      const r = await rpc('app_schedule_poll', { p_week: P.week_id });
      if (P.can_edit && !r.mine) { showSaved(`Quyền xếp lịch đã chuyển cho ${r.lock || 'người khác'}. Đang chuyển sang chỉ xem…`, true); setTimeout(rerender, 1500); }
      else if (P.can_edit) await rpc('app_schedule_lock', { p_week: P.week_id, p_force: false });
      else if (r.version !== P.version && picker.hidden) rerender();
    } catch (_) { /* mất mạng tạm thời */ }
  }, 20000);
  const release = () => { if (P.can_edit) rpc('app_schedule_release', { p_week: P.week_id }).catch(() => {}); };
  window.addEventListener('pagehide', release);
  draw();
  // Gỡ khi rời trang
  return () => {
    clearInterval(timer);
    document.removeEventListener('click', docClick);
    document.removeEventListener('keydown', docKey);
    window.removeEventListener('pagehide', release);
    mq.removeEventListener('change', onMq);
    if (holds) release();
  };
}
