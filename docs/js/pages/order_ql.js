// Quản lý: theo dõi & sửa order (giống màn ORDER LỊCH LÀM của bản offline)
import { render as rerender, can, state } from '../app.js';
import { CODE, LABEL, RANKS, ST_CHOT, addDays, closure, hasPublished, orderWindow, parseWeekParam, statusLabel, vnToday, weekDays, weekLabel, weekStart, getWeek } from '../data.js';
import { bindWeekPick, typed, weekBar } from '../parts.js';
import { rpc, sel, selAll } from '../sb.js';
import { $, $$, esc, flash, go, html, norm, showSaved, hhmm } from '../ui.js';

export const perm = 'xem_tat_ca';

const CSS = html`<style>
  .stats { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 760px) { .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .stat { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .stat .k { font-size: 12px; font-weight: 600; color: var(--muted); }
  .stat .v { font-size: 24px; font-weight: 700; }
  .grid-wrap { overflow: auto; max-height: calc(100vh - 160px); }
  .og th, .og td { padding: 0; }
  .og thead th { position: sticky; top: 0; z-index: 2; padding: 8px 6px; font-size: 12px; line-height: 1.35; border-left: 1px solid #2a4a9e; }
  .og .sticky { position: sticky; background: #fff; z-index: 1; padding: 8px 10px; }
  .og thead .sticky { z-index: 3; background: var(--header); }
  .og .c1 { left: 0; width: 46px; min-width: 46px; } .og .c2 { left: 46px; width: 76px; min-width: 76px; }
  .og .c3 { left: 122px; width: 190px; min-width: 190px; } .og .c4 { left: 312px; width: 90px; min-width: 90px; box-shadow: 2px 0 0 var(--line); }
  .oc { min-width: 100px; height: 40px; text-align: center; font-size: 12px; font-weight: 600; cursor: pointer; user-select: none; position: relative; border-left: 1px solid #fff; }
  .oc.ok { background: var(--ok-bg); color: var(--ok-ink); } .oc.off { background: var(--off-bg); color: var(--off-ink); } .oc.none { background: #eceef2; color: var(--muted); }
  .oc.ok::before { content: "ĐI LÀM ĐƯỢC"; } .oc.off::before { content: "NGHỈ"; } .oc.none::before { content: "CHƯA ORDER"; }
  .oc.manual::after { content: ""; position: absolute; top: 5px; right: 5px; width: 8px; height: 8px; border-radius: 4px; background: #dc2626; }
  .oc.sel { box-shadow: inset 0 0 0 3px var(--primary); }
  .og tr[hidden] { display: none; } .og .hidecol { display: none; }
</style>`;

function noteOf(log, who) {
  if (!log) return 'Quản lý đã sửa';
  const t = log.created_at;
  return `Sửa bởi ${who(log.account_id)} lúc ${t.slice(11, 16)} ${t.slice(8, 10)}/${t.slice(5, 7)}: ${LABEL[log.old_status] || log.old_status} → ${LABEL[log.new_status] || log.new_status}`;
}

export async function render({ params, me }) {
  const start = parseWeekParam(params.tuan) || addDays(weekStart(vnToday()), 7);
  const week = await getWeek(start);
  const head = html`<div class="page-head"><div><h1>Order lịch làm</h1><div class="sub" id="ol-sub">Tuần ${weekLabel(start)}</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>`;
  if (!week) {
    const n = (await sel('employees', 'id', (b) => b.eq('status', 'Đang làm'))).length;
    return {
      title: 'Order lịch làm',
      html: html`${head}${weekBar('/quan-ly/order', start)}
        <section class="card stack" style="max-width:640px"><h2>Tuần ${weekLabel(start)} chưa được tạo</h2>
          <div style="color:var(--ink-2);line-height:1.6">Khi tạo tuần, cả ${n} nhân viên đang làm sẽ ở trạng thái <strong>Chưa order</strong>. Nhân viên chỉ order được sau khi tuần đã được tạo và trong giờ mở order.</div>
          ${can('xep_lich') ? html`<div><button class="btn" type="button" id="create-week">Tạo tuần mới</button></div>` : html`<div class="alert warn">Chỉ người có quyền xếp lịch mới tạo được tuần mới.</div>`}
        </section>`,
      mount() {
        bindWeekPick();
        const b = $('#create-week');
        if (b) b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const id = await rpc('app_create_week', { p_date: start });
            const win = await orderWindow(id);
            flash(`Đã tạo tuần ${weekLabel(start)}. Tất cả nhân viên đang ở trạng thái Chưa order. Nhân viên order từ ${win.open_text} đến ${win.close_text}.`);
          } catch (e) { flash(e.message, 'error'); }
          rerender();
        });
      },
    };
  }
  const [win, shifts, emps, entries, subs, logs, cl, published] = await Promise.all([
    orderWindow(week.id),
    sel('shifts', 'id, name', (b) => b.eq('status', 'Đang sử dụng').order('sort_order').order('id')),
    sel('employees', 'id, code, name, rank', (b) => b.eq('status', 'Đang làm')),
    selAll('order_entries', 'employee_id, weekday, shift, status, is_manual', (b) => b.eq('week_id', week.id)),
    sel('order_submissions', 'employee_id', (b) => b.eq('week_id', week.id)),
    selAll('order_edit_log', 'id, employee_id, weekday, shift, old_status, new_status, account_id, created_at', (b) => b.eq('week_id', week.id).order('id')),
    closure(week.id), hasPublished(week.id),
  ]);
  emps.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  // Tên người sửa (nếu được xem tài khoản)
  const accs = await sel('accounts', 'id, employee_id, display_name').catch(() => []);
  const empAll = new Map((await sel('employees', 'id, code, name')).map((e) => [e.id, e]));
  const accName = new Map(accs.map((a) => [a.id, a.employee_id ? `${empAll.get(a.employee_id)?.code} – ${empAll.get(a.employee_id)?.name}` : (a.display_name || 'Chủ')]));
  const who = (id) => (id === me.account_id ? `${me.code} – ${me.name}` : accName.get(id) || 'Quản lý');
  const lastLog = new Map(); logs.forEach((l) => lastLog.set(`${l.employee_id}|${l.weekday}|${l.shift}`, l));
  const ent = new Map(entries.map((e) => [`${e.employee_id}|${e.weekday}|${e.shift}`, e]));
  const submitted = new Set(subs.map((s) => s.employee_id));
  const days = weekDays(week.start_date);
  const st = cl?.status || null;
  const canEdit = can('sua_order_sau_han');
  const canStart = can('xep_lich');
  const shiftNames = shifts.map((s) => s.name);

  const rows = emps.map((e, ri) => {
    let has = submitted.has(e.id);
    const cells = [];
    days.forEach((d) => shifts.forEach((s) => {
      const r = ent.get(`${e.id}|${d.index}|${s.name}`);
      const code = r ? CODE[r.status] || 'none' : 'none';
      if (code !== 'none') has = true;
      cells.push({ d: d.index, s: s.name, code, manual: !!(r && r.is_manual), note: r && r.is_manual ? noteOf(lastLog.get(`${e.id}|${d.index}|${s.name}`), who) : '' });
    }));
    return html`<tr class="og-row" data-rank="${e.rank}" data-search="${norm(e.code + ' ' + e.name)}" data-has="${has ? 1 : 0}">
      <td class="sticky c1 rownum">${ri + 1}</td><td class="sticky c2" style="font-weight:600">${e.code}</td>
      <td class="sticky c3">${e.name}</td><td class="sticky c4">${e.rank}</td>
      ${cells.map((c, ci) => html`<td class="oc ${c.code} ${c.manual ? 'manual' : ''}" data-e="${e.id}" data-d="${c.d}" data-s="${c.s}" data-st="${c.code}" data-r="${ri}" data-c="${ci}" ${c.note ? html`title="${c.note}"` : ''}></td>`)}
    </tr>`;
  });

  const stepBox = st === null
    ? html`<strong style="font-size:14px">Bước tiếp theo:</strong>
      ${canStart ? (win.state === 'da_dong'
        ? html`<button class="btn sm" type="button" id="start-btn" style="min-height:40px">Bắt đầu xếp lịch</button><span style="font-size:13px;color:var(--muted)">Kiểm tra, bổ sung order xong rồi bấm.</span>`
        : html`<button class="btn sm" type="button" disabled style="min-height:40px">Bắt đầu xếp lịch</button><span style="font-size:13px;color:var(--muted)">Mở sau giờ hết hạn order: ${win.close_text}</span>`)
      : html`<span style="font-size:13px;color:var(--muted)">Chờ người có quyền xếp lịch bắt đầu xếp.</span>`}`
    : html`<span class="pill ${st === ST_CHOT ? 'ok' : 'warn'}">${statusLabel(st, published)}</span>
      <span style="font-size:14px">Tuần này đã bắt đầu xếp lịch. Sửa order vẫn được; ô đã xếp mà đổi sang Nghỉ sẽ có cảnh báo trên lịch.</span>
      <a class="btn sm" href="#/quan-ly/lich-co-so?tuan=${start}" style="min-height:40px;margin-left:auto">Mở lịch cơ sở</a>`;

  return {
    title: 'Order lịch làm',
    html: html`
      <div class="page-head"><div><h1>Order lịch làm</h1><div class="sub">Tuần ${weekLabel(start)} ·
        ${win.state === 'dang_mo' ? html`<span class="pill ok">Đang mở order</span> hết hạn ${win.close_text}`
          : win.state === 'chua_mo' ? html`<span class="pill mute">Chưa mở</span> mở lúc ${win.open_text}`
          : html`<span class="pill off">Đã hết hạn</span> lúc ${win.close_text}`}</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      ${weekBar('/quan-ly/order', start)}
      <section class="card toolbar" style="padding:14px 18px">${stepBox}</section>
      ${canEdit ? html`<section class="card stack d-only" style="padding:14px 18px;gap:10px">
        <div style="font-size:13px;color:var(--muted)">Bấm một ô để chọn; giữ <strong>Command</strong> (Mac) / <strong>Ctrl</strong> (Windows) để chọn thêm; kéo chuột qua nhiều ô liền nhau; nhấp đúp để đổi nhanh một ô. Mọi thay đổi tự lưu và đánh dấu chấm đỏ.</div>
        <div class="toolbar">
          <strong style="font-size:14px">Sửa nhanh các ô đang chọn (<span id="sel-count">0</span>):</strong>
          <button class="btn sm qb" type="button" data-set="ok" style="background:var(--ok-bg);color:var(--ok-ink);border:1px solid #4ade80">Đi làm được</button>
          <button class="btn sm qb" type="button" data-set="off" style="background:var(--off-bg);color:var(--off-ink);border:1px solid #fca5a5">Nghỉ</button>
          <button class="btn sm qb" type="button" data-set="none" style="background:#e5e7eb;color:var(--ink-2);border:1px solid #cbd2dc">Chưa order</button>
          <button class="btn sm secondary" type="button" id="undo-btn" disabled>Hoàn tác</button>
          <button class="btn sm secondary" type="button" id="clear-sel">Bỏ chọn</button>
        </div>
        <div class="toolbar">
          <strong style="font-size:14px">Cả tuần:</strong>
          <button class="btn sm secondary" type="button" id="restore-btn">Khôi phục bản trước</button>
          <button class="btn sm secondary danger" type="button" id="clear-btn">Xóa order tuần</button>
          ${can('xoa_du_lieu_tuan') ? html`<button class="btn sm secondary danger" type="button" id="del-week" style="margin-left:auto">Xóa dữ liệu tuần</button>` : ''}
        </div></section>` : html`<div class="alert warn">Bạn chỉ có quyền xem order. Muốn sửa cần quyền “Sửa order sau hạn”.</div>`}
      <section class="card stack" style="padding:14px 18px;gap:10px">
        <div class="toolbar">
          <input class="input sm" id="f-search" type="search" placeholder="Tìm theo mã hoặc tên" aria-label="Tìm nhân viên" style="width:220px">
          <select class="input sm" id="f-rank" aria-label="Lọc phân cấp" style="width:150px"><option value="">Tất cả phân cấp</option>${RANKS.map((r) => html`<option>${r}</option>`)}</select>
          <select class="input sm" id="f-has" aria-label="Lọc nhân viên" style="width:170px"><option value="">Tất cả nhân viên</option><option value="1">Đã có order</option><option value="0">Chưa có order</option></select>
          <select class="input sm d-only" id="f-day" aria-label="Lọc ngày" style="width:140px"><option value="">Tất cả ngày</option>${days.map((d) => html`<option value="${d.index}">${d.name} ${d.date}</option>`)}</select>
          <select class="input sm d-only" id="f-shift" aria-label="Lọc ca" style="width:120px"><option value="">Tất cả ca</option>${shiftNames.map((s) => html`<option>${s}</option>`)}</select>
          <select class="input sm" id="f-status" aria-label="Lọc trạng thái" style="width:160px"><option value="">Tất cả trạng thái</option><option value="ok">Đi làm được</option><option value="off">Nghỉ</option><option value="none">Chưa order</option></select>
          <button class="btn sm secondary" type="button" id="f-clear">Xóa bộ lọc</button>
        </div>
        <div class="d-only" style="font-size:13px;font-weight:600">Chú giải: <span style="color:var(--ok-ink)">Xanh: Đi làm được</span> · <span style="color:var(--off-ink)">Đỏ: Nghỉ</span> · <span style="color:var(--muted)">Xám: Chưa order</span> · <span style="color:#dc2626">● Chấm đỏ: quản lý đã sửa (rê chuột để xem ai sửa)</span></div>
      </section>
      <div class="stats">
        ${[['st-total', 'Tổng NV', ''], ['st-has', 'Có order', ''], ['st-hasnot', 'Chưa có', 'color:var(--off-ink)'], ['st-ok', 'Đi làm được', 'color:var(--ok-ink)'], ['st-off', 'Nghỉ', ''], ['st-none', 'Chưa order', ''], ['st-manual', 'Ô đã sửa', '']]
          .map(([id, k, s]) => html`<div class="stat"><div class="k">${k}</div><div class="v" id="${id}" style="${s}">0</div></div>`)}
      </div>
      <section class="card flush m-only" id="m-order"><div class="mo-days" id="mo-days" role="group" aria-label="Chọn ngày"></div><div id="mo-list"></div></section>
      <section class="card flush d-only"><div class="grid-wrap">
        <table class="table og" id="order-grid" aria-label="Bảng order tuần ${weekLabel(start)}">
          <thead><tr><th class="sticky c1">STT</th><th class="sticky c2">Mã NV</th><th class="sticky c3">Tên nhân viên</th><th class="sticky c4">Phân cấp</th>
            ${days.map((d) => shifts.map((s) => html`<th class="center col-h" data-d="${d.index}" data-s="${s.name}">${d.name}<br>${d.date}<br>${s.name}</th>`))}</tr></thead>
          <tbody>${rows}</tbody></table></div></section>${CSS}`,
    mount() {
      bindWeekPick();
      const sb = $('#start-btn');
      if (sb) sb.addEventListener('click', async () => {
        if (!confirm(`Bắt đầu xếp lịch tuần ${weekLabel(start)}? Web sẽ đưa lịch cố định vào các ô nhân viên order Đi làm được.`)) return;
        try { const n = await rpc('app_start_scheduling', { p_week: week.id }); flash(`Đã bắt đầu xếp lịch tuần ${weekLabel(start)}. Đã đưa ${n} ca từ lịch cố định vào lịch.`); go(`/quan-ly/lich-co-so?tuan=${start}`); }
        catch (e) { flash(e.message, 'error'); rerender(); }
      });
      mountGrid({ week, me, days, shiftNames, canEdit, who });
      if (!canEdit) return;
      $('#restore-btn').addEventListener('click', async () => {
        if (!confirm('Khôi phục bản order trước lần nhập/xóa gần nhất?')) return;
        try {
          const r = await rpc('app_order_restore', { p_week: week.id });
          flash(r.ok ? 'Đã khôi phục bản order trước lần nhập/xóa gần nhất.' + (r.synced ? ' Lịch đang xếp đã được cập nhật.' : '') : 'Chưa có bản order trước đó để khôi phục.', r.ok ? 'ok' : 'error');
        } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      $('#clear-btn').addEventListener('click', async () => {
        if (!confirm('Xóa toàn bộ order của tuần đang chọn? Web sẽ lưu bản trước để có thể khôi phục.')) return;
        try { const s = await rpc('app_order_clear', { p_week: week.id }); flash('Đã xóa toàn bộ order của tuần (đã lưu bản trước để khôi phục).' + (s ? ' Lịch đang xếp đã được cập nhật.' : '')); }
        catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      const del = $('#del-week');
      if (del) del.addEventListener('click', async () => {
        if (!typed(`Xóa toàn bộ order tuần ${weekLabel(start)}? Mọi order của tuần này (kể cả nhân viên tự gửi) sẽ bị xóa và không khôi phục được. Lịch đã xếp không bị ảnh hưởng.`, 'XOA')) return;
        try { const n = await rpc('app_delete_week_orders', { p_week: week.id }); flash(`Đã xóa toàn bộ order tuần ${weekLabel(start)} (${n} ô).`); }
        catch (e) { flash(e.message, 'error'); }
        rerender();
      });
    },
  };
}

function mountGrid({ week, me, days, shiftNames, canEdit }) {
  const cells = $$('.oc');
  const byKey = new Map(cells.map((c) => [`${c.dataset.e}|${c.dataset.d}|${c.dataset.s}`, c]));
  const selected = new Set();
  const undoStack = [];
  const visible = (c) => !c.closest('tr').hidden && !c.classList.contains('hidecol');
  const LAB = { ok: 'Đi làm được', off: 'Nghỉ', none: 'Chưa order' };
  let curDay = 0;

  const stats = () => {
    let ok = 0, off = 0, none = 0, manual = 0, has = 0, total = 0;
    $$('.og-row').forEach((row) => {
      total++;
      let rowHas = row.dataset.has === '1';
      row.querySelectorAll('.oc').forEach((c) => {
        const s = c.dataset.st;
        if (s === 'ok') ok++; else if (s === 'off') off++; else none++;
        if (s !== 'none') rowHas = true;
        if (c.classList.contains('manual')) manual++;
      });
      if (rowHas) has++;
    });
    const set = (id, v) => { $('#' + id).textContent = v; };
    set('st-total', total); set('st-has', has); set('st-hasnot', total - has); set('st-ok', ok); set('st-off', off); set('st-none', none); set('st-manual', manual);
    renderM();
  };
  const paintSel = () => { cells.forEach((c) => c.classList.toggle('sel', selected.has(c))); const el = $('#sel-count'); if (el) el.textContent = selected.size; };
  const setCell = (c, s, note) => { c.classList.remove('ok', 'off', 'none'); c.classList.add(s, 'manual'); c.dataset.st = s; if (note) c.title = note; };

  async function send(changes, remember) {
    if (!changes.length) return;
    const prev = changes.map((x) => ({ ...x, status: byKey.get(`${x.employee_id}|${x.weekday}|${x.shift}`).dataset.st }));
    try {
      await rpc('app_manager_set_orders', { p_week: week.id, p_cells: changes.map((x) => ({ ...x, employee_id: Number(x.employee_id), weekday: Number(x.weekday) })) });
      const t = new Date(Date.now() + 7 * 3600e3).toISOString();
      changes.forEach((x) => {
        const c = byKey.get(`${x.employee_id}|${x.weekday}|${x.shift}`);
        setCell(c, x.status, `Sửa bởi ${me.code} – ${me.name} lúc ${t.slice(11, 16)} ${t.slice(8, 10)}/${t.slice(5, 7)}: ${LAB[c.dataset.st]} → ${LAB[x.status]}`);
      });
      if (remember) { undoStack.push(prev); $('#undo-btn').disabled = false; }
      showSaved(`Đã lưu ${changes.length} ô · ${hhmm()}`);
      stats();
    } catch (e) { showSaved(e.message, true); }
  }
  function applyStatus(s) {
    if (!selected.size) { showSaved('Chưa chọn ô nào.', true); return; }
    const changes = [...selected].filter((c) => c.dataset.st !== s).map((c) => ({ employee_id: c.dataset.e, weekday: c.dataset.d, shift: c.dataset.s, status: s }));
    if (!changes.length) { showSaved('Các ô đã ở trạng thái này.'); return; }
    send(changes, true);
  }
  if (canEdit) {
    let dragging = false, anchor = null, base = new Set();
    const rect = (a, b) => {
      const r1 = Math.min(+a.dataset.r, +b.dataset.r), r2 = Math.max(+a.dataset.r, +b.dataset.r);
      const c1 = Math.min(+a.dataset.c, +b.dataset.c), c2 = Math.max(+a.dataset.c, +b.dataset.c);
      return cells.filter((c) => visible(c) && +c.dataset.r >= r1 && +c.dataset.r <= r2 && +c.dataset.c >= c1 && +c.dataset.c <= c2);
    };
    cells.forEach((c) => {
      c.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        if (ev.metaKey || ev.ctrlKey) { if (selected.has(c)) selected.delete(c); else selected.add(c); anchor = c; paintSel(); return; }
        if (ev.shiftKey && anchor) { base = new Set(selected); rect(anchor, c).forEach((x) => selected.add(x)); paintSel(); return; }
        selected.clear(); selected.add(c); anchor = c; base = new Set(); dragging = true; paintSel();
      });
      c.addEventListener('mouseenter', () => { if (!dragging) return; selected.clear(); base.forEach((x) => selected.add(x)); rect(anchor, c).forEach((x) => selected.add(x)); paintSel(); });
      c.addEventListener('dblclick', () => send([{ employee_id: c.dataset.e, weekday: c.dataset.d, shift: c.dataset.s, status: { ok: 'off', off: 'none', none: 'ok' }[c.dataset.st] }], true));
    });
    document.addEventListener('mouseup', () => { dragging = false; });
    $$('.qb').forEach((b) => b.addEventListener('click', () => applyStatus(b.dataset.set)));
    $('#clear-sel').addEventListener('click', () => { selected.clear(); paintSel(); });
    $('#undo-btn').addEventListener('click', async () => {
      const prev = undoStack.pop(); if (!prev) return;
      await send(prev, false);
      $('#undo-btn').disabled = undoStack.length === 0;
    });
  }
  const f = (id) => $('#' + id);
  function applyFilters() {
    const q = norm(f('f-search').value.trim()), rank = f('f-rank').value, hasF = f('f-has').value;
    const day = f('f-day').value, shift = f('f-shift').value, s = f('f-status').value;
    $$('.col-h').forEach((th) => th.classList.toggle('hidecol', (day && th.dataset.d !== day) || (shift && th.dataset.s !== shift)));
    cells.forEach((c) => c.classList.toggle('hidecol', (day && c.dataset.d !== day) || (shift && c.dataset.s !== shift)));
    let n = 0;
    $$('.og-row').forEach((row) => {
      const tds = [...row.querySelectorAll('.oc')];
      const rowHas = row.dataset.has === '1' || tds.some((c) => c.dataset.st !== 'none');
      let show = (!q || row.dataset.search.includes(q)) && (!rank || row.dataset.rank === rank) && (!hasF || String(+rowHas) === hasF);
      if (show && s) show = tds.some((c) => !c.classList.contains('hidecol') && c.dataset.st === s);
      row.hidden = !show;
      if (show) row.querySelector('.rownum').textContent = ++n;
    });
    renderM();
  }
  ['f-search', 'f-rank', 'f-has', 'f-day', 'f-shift', 'f-status'].forEach((id) => f(id).addEventListener(id === 'f-search' ? 'input' : 'change', applyFilters));
  f('f-clear').addEventListener('click', () => { ['f-search', 'f-rank', 'f-has', 'f-day', 'f-shift', 'f-status'].forEach((id) => { f(id).value = ''; }); applyFilters(); });

  // Điện thoại: xem theo ngày, chạm một ca để đổi
  function renderM() {
    const box = $('#mo-list'); if (!box) return;
    $('#mo-days').innerHTML = days.map((d) => `<button type="button" class="mo-day ${d.index === curDay ? 'on' : ''}" data-day="${d.index}"><b>${esc(d.short)}</b><span>${esc(d.date)}</span></button>`).join('');
    let h = '';
    $$('.og-row').forEach((row) => {
      if (row.hidden) return;
      const tds = row.querySelectorAll('.oc'); if (!tds.length) return;
      const e = tds[0].dataset.e;
      h += `<div class="mo-row"><div class="who"><strong>${esc(row.children[2].textContent)}</strong><span>${esc(row.children[1].textContent)} · ${esc(row.dataset.rank)}</span></div><div class="mo-chips">`;
      shiftNames.forEach((sn) => {
        const c = byKey.get(`${e}|${curDay}|${sn}`); if (!c) return;
        h += `<button type="button" class="mo-chip ${c.dataset.st}" data-e="${e}" data-s="${esc(sn)}">${esc(sn)}<small>${LAB[c.dataset.st]}</small>${c.classList.contains('manual') ? '<i></i>' : ''}</button>`;
      });
      h += '</div></div>';
    });
    box.innerHTML = h || '<div style="padding:16px;color:var(--muted)">Không có nhân viên phù hợp bộ lọc.</div>';
  }
  function openSheet(e, sn, name) {
    const c = byKey.get(`${e}|${curDay}|${sn}`); const wd = days[curDay];
    const bg = document.createElement('div'); bg.className = 'mo-sheet-bg';
    bg.innerHTML = `<div class="mo-sheet" role="dialog"><div class="t">${esc(`${name} · Ca ${sn} · ${wd.name} ${wd.date}`)}</div>`
      + ['ok', 'off', 'none'].map((k) => `<button type="button" class="${k}${c.dataset.st === k ? ' cur' : ''}" data-k="${k}">${LAB[k]}</button>`).join('')
      + '<button type="button" data-k="">Đóng</button></div>';
    bg.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (ev.target === bg || (b && b.dataset.k === '')) { bg.remove(); return; }
      if (!b) return;
      bg.remove();
      if (b.dataset.k !== c.dataset.st) send([{ employee_id: e, weekday: String(curDay), shift: sn, status: b.dataset.k }], false);
    });
    document.body.appendChild(bg);
  }
  const mo = $('#m-order');
  if (mo) mo.addEventListener('click', (ev) => {
    const d = ev.target.closest('.mo-day');
    if (d) { curDay = +d.dataset.day; renderM(); return; }
    const ch = ev.target.closest('.mo-chip');
    if (ch && canEdit) openSheet(ch.dataset.e, ch.dataset.s, ch.closest('.mo-row').querySelector('strong').textContent);
  });
  stats();
}
