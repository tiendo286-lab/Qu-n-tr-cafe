// Xếp lịch làm tổng (bản offline): mỗi nhân viên một dòng × mọi ca trong tuần; chọn "cơ sở – vị trí" ngay trong ô
import { render as rerender, can, state } from '../app.js';
import { ASSIGNED, NONE, OFF, RANKS, ST_CHOT, ftShort, isFT, ST_SUA, ST_XEP, addDays, focusWeek, getWeek, hasPublished, parseWeekParam, statusLabel, vnToday, weekDays, weekLabel, weekStart } from '../data.js';
import { typed } from '../parts.js';
import { rpc, sel, selAll } from '../sb.js';
import { $, $$, flash, hhmm, html, norm, showSaved } from '../ui.js';
import { loadReport } from '../reports.js';

export const perm = 'bao_cao';
const abbr = (n) => String(n || '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();
const STATE_FILTERS = [['', 'Tất cả trạng thái'], ['unassigned', 'Chưa được xếp'], ['assigned', 'Đã được xếp'], ['off', 'Có ca nghỉ'], ['no_order', 'Chưa order'], ['fixed', 'Có lịch cố định'], ['manual', 'Quản lý đã sửa']];

export async function render({ params, me }) {
  let start = parseWeekParam(params.tuan);
  if (!start) { const fw = await focusWeek(); start = fw ? fw.start_date : weekStart(vnToday()); }
  const week = await getWeek(start);
  const days = weekDays(start);
  const nav = html`<div class="wk-nav">
    <a class="btn sm secondary" href="#/quan-ly/lich-tong?tuan=${addDays(start, -7)}">‹ Tuần trước</a><span class="wk-label">${weekLabel(start)}</span>
    <a class="btn sm secondary" href="#/quan-ly/lich-tong?tuan=${addDays(start, 7)}">Tuần sau ›</a>
    <input class="input sm" type="date" id="pick-week" value="${start}" aria-label="Chọn tuần theo ngày"></div>`;
  const headTxt = 'Mỗi nhân viên một dòng, mỗi cột là một ca trong tuần. Xếp tự động chỉ đưa trạng thái order và lịch cố định vào bảng. Mọi thao tác xếp tay được lưu ngay và đồng bộ với Lịch cơ sở.';
  const cl = week ? (await sel('schedule_closures', '*', (b) => b.eq('week_id', week.id)))[0] : null;
  const pickMount = () => $('#pick-week').addEventListener('change', (ev) => { location.hash = `/quan-ly/lich-tong?tuan=${ev.target.value}`; });
  if (!week || !cl) {
    return {
      title: 'Xếp lịch làm tổng',
      html: html`<div class="page-head"><div><h1>Xếp lịch làm tổng</h1><div class="sub">${headTxt}</div></div>${nav}</div>
        <div class="card">${!week ? html`Tuần này chưa được tạo. Vào <a href="#/quan-ly/order?tuan=${start}">Order lịch làm</a> để tạo tuần và cho nhân viên order.`
          : html`Tuần này chưa bắt đầu xếp lịch.${can('xep_lich') ? html`<div style="margin-top:12px"><button class="btn" type="button" id="auto-btn">Xếp theo order &amp; lịch cố định</button></div><div style="font-size:13px;color:var(--muted);margin-top:6px">Chỉ làm được sau giờ hết hạn order.</div>` : ''}`}</div>`,
      mount() {
        pickMount();
        $('#auto-btn')?.addEventListener('click', async () => {
          try { const n = await rpc('app_master_auto', { p_week: week.id }); flash(`Đã xếp theo order & lịch cố định: ${n} ca từ lịch cố định. Các ô khác để trống cho quản lý xếp tay.`); } catch (e) { flash(e.message, 'error'); }
          rerender();
        });
      },
    };
  }
  const editableSt = cl.status === ST_XEP || cl.status === ST_SUA;
  let lock = null; let holds = false;
  if (editableSt && can('xep_lich')) { const r = await rpc('app_schedule_lock', { p_week: week.id, p_force: false }); holds = !!r.ok; lock = r.ok ? null : r.lock; }
  const editable = editableSt && can('xep_lich') && holds;
  const [rep, eb, er, published] = await Promise.all([loadReport(week), selAll('employee_branches', '*'), selAll('employee_roles', '*'), hasPublished(week.id)]);
  const cat = rep.cat;
  const shifts = cat.mainShifts.map((s) => s.name);   // ca FULL TIME gộp vào ca chính
  const ftBy = new Map(cat.activeBranches.map((b) => [b.id, cat.ftOf(b.id).ft]));
  const ftOpts = (bid, s) => Object.values(ftBy.get(bid) || {}).filter((f) => f.parent === s);
  const roles = cat.activeRoles.map((r) => r.name);
  const ebm = {}; eb.forEach((r) => (ebm[r.employee_id] ||= []).push(r.branch_id));
  const erm = {}; er.forEach((r) => (erm[r.employee_id] ||= []).push(r.role));
  const matrix = new Map(rep.wse.map((r) => [`${r.employee_id}|${r.weekday}|${r.shift}`, r]));
  const sm = rep.summary(); const stats = rep.pageStats();
  const emps = rep.active.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const rowsHtml = emps.map((e) => {
    const options = cat.activeBranches.filter((b) => (ebm[e.id] || []).includes(b.id))
      .flatMap((b) => (erm[e.id] || []).filter((r) => roles.includes(r)).map((r) => ({ v: `${b.id}|${r}`, t: `${b.code} – ${abbr(r)}`, bid: b.id })));
    let total = 0; const flags = new Set();
    const cells = [];
    days.forEach((d) => shifts.forEach((s) => {
      // FULL TIME của nhân viên trong ngày: hiện ở ca chính "parent" (sửa được), các ca chồng giờ khác chỉ ghi chú
      const fts = rep.wse.filter((r) => r.employee_id === e.id && r.weekday === d.index && r.state === ASSIGNED && isFT(r.shift) && r.branch_id);
      const ftHere = fts.find((r) => ftBy.get(r.branch_id)?.[r.shift]?.parent === s);
      const ftAway = ftHere ? null : fts.find((r) => ftBy.get(r.branch_id)?.[r.shift]?.covers.includes(s));
      const main = matrix.get(`${e.id}|${d.index}|${s}`);
      const mainA = main && main.state === ASSIGNED;
      if (ftAway && !mainA) {
        cells.push(html`<td class="st-ok" title="${ftAway.shift}">${rep.bById.get(ftAway.branch_id)?.code} · ${ftShort(ftAway.shift)}</td>`); return;
      }
      const c = ftHere && !mainA ? ftHere : main;
      if (!c) { cells.push(html`<td class="st-none" data-d="${d.index}" data-s="${s}">—</td>`); return; }
      const isA = c.state === ASSIGNED; const base = c.base_status;
      if (isA) { total++; flags.add('assigned'); } if (base === OFF) flags.add('off'); if (base === NONE) flags.add('no_order');
      if (c.source === 'FIXED') flags.add('fixed'); if (c.is_manual) flags.add('manual');
      const warn = isA && (base === OFF || base === NONE);
      const bc = isA ? rep.bById.get(c.branch_id)?.code : '';
      const isF = isFT(c.shift);
      const text = isA ? `${bc} – ${abbr(c.role)}${isF ? ' · FT' : ''}${c.source === 'FIXED' ? ' CĐ' : ''}` : base === OFF ? 'Nghỉ' : base === NONE ? 'Chưa order' : 'Trống';
      const cls = isA ? (c.source === 'FIXED' ? 'st-fx' : 'st-ok') : base === OFF ? 'st-off' : base === NONE ? 'st-none' : 'st-free';
      const val = isA ? `${c.branch_id}|${c.role}${isF ? `|${c.shift}` : ''}` : '';
      const opts = options.filter((o) => cat.shiftEnabled(o.bid, s));
      options.forEach((o) => ftOpts(o.bid, s).forEach((f) => opts.push({ v: `${o.v}|${f.name}`, t: `${o.t} · FT`, bid: o.bid })));
      if (val && !opts.some((o) => o.v === val)) opts.push({ v: val, t: `${text} (!)` });
      const bft = Object.fromEntries(options.flatMap((o) => ftOpts(o.bid, s)).map((f) => [f.name, matrix.get(`${e.id}|${d.index}|${f.name}`)?.base_status || NONE]));
      const dot = c.is_manual ? html`<span style="color:#dc2626" title="Quản lý đã sửa">●</span>` : '';
      const mainBase = main?.base_status || NONE;
      cells.push(editable
        ? html`<td class="${cls} ${warn ? 'st-warn' : ''}" data-d="${d.index}" data-s="${s}" data-base="${mainBase}" data-bft="${JSON.stringify(bft)}"><select data-e="${e.id}" data-d="${d.index}" data-s="${s}" data-prev="${val}" aria-label="${e.name} ${d.short} ${s}">
            <option value="">${mainBase === OFF ? 'Nghỉ' : mainBase === NONE ? 'Chưa order' : 'Trống'}</option>${opts.map((o) => html`<option value="${o.v}" ${o.v === val ? 'selected' : ''}>${o.t}</option>`)}</select>${dot}</td>`
        : html`<td class="${cls} ${warn ? 'st-warn' : ''}">${text}${dot}</td>`);
    }));
    if (!flags.has('assigned')) flags.add('unassigned');
    return html`<tr data-search="${norm(`${e.code} ${e.name}`)}" data-rank="${e.rank}" data-br="|${(ebm[e.id] || []).map((id) => rep.bById.get(id)?.code).join('|')}|" data-roles="|${(erm[e.id] || []).join('|')}|" data-flags="|${[...flags].join('|')}|">
      <td class="nm"><strong>${e.code}</strong> – ${e.name}</td><td>${e.rank}</td><td class="tot"><strong>${total}</strong></td>${cells}</tr>`;
  });
  const sumRow = (label, getter) => html`<tr><td class="nm"><strong>${label}</strong></td>${days.map((d) => shifts.map((s) => {
    const c = getter(d.index, s);
    if (!c) return html`<td>—</td>`;
    const bg = c.actual === c.required ? 'var(--ok-bg)' : c.actual < c.required ? '#fee2e2' : '#fef3c7';
    const tip = c.roles ? Object.keys(c.roles).map((k) => `${k}: ${c.roles[k]}/${c.role_required[k]}`).join('\n') + `\nQL/Cấp 1: ${c.senior}` : '';
    return html`<td style="background:${bg}" title="${tip}">${c.actual}/${c.required}</td>`;
  }))}</tr>`;
  const lockBox = cl.status === ST_CHOT ? html`<div class="alert warn">Lịch tuần đã chốt — chỉ xem. Mở lại tuần ở <a href="#/quan-ly/bao-cao?tuan=${start}">Chốt lịch &amp; báo cáo</a> nếu cần sửa.</div>`
    : lock ? html`<div class="alert warn">Đang được <strong>${lock.who}</strong> xếp lịch từ ${(lock.acquired_at || '').slice(11, 16)} — bạn đang ở chế độ chỉ xem.</div>`
    : !editable ? html`<div class="alert warn">Bạn đang ở chế độ chỉ xem.</div>` : '';
  return {
    title: 'Xếp lịch làm tổng',
    html: html`
      <div class="page-head"><div><h1>Xếp lịch làm tổng <span class="pill warn">${statusLabel(cl.status, published)}</span></h1><div class="sub">${headTxt}</div></div>${nav}<div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="toolbar">
        ${can('xep_lich') && cl.status !== ST_CHOT ? html`
          <button class="btn sm" type="button" id="auto-btn">Xếp theo order &amp; lịch cố định</button>
          <button class="btn sm secondary" type="button" id="reapply-btn">Cập nhật order vào lịch</button>
          ${published ? '' : html`<button class="btn sm secondary danger" type="button" id="clear-btn">Xóa lịch tuần</button>`}` : ''}
        <a class="btn sm secondary" href="#/quan-ly/bao-cao?tuan=${start}">Chốt lịch &amp; báo cáo →</a></div>
      ${lockBox}
      <div class="tiles">
        <div class="tile" style="border-top-color:var(--primary)"><div class="n">${stats.active}</div><div class="l">Nhân viên đang làm</div></div>
        <div class="tile" style="border-top-color:var(--ok-line)"><div class="n">${stats.assigned_employees}</div><div class="l">Đã có ca</div></div>
        <div class="tile" style="border-top-color:var(--muted)"><div class="n">${stats.unassigned_employees}</div><div class="l">Chưa có ca</div></div>
        <div class="tile" style="border-top-color:#f59e0b"><div class="n">${stats.total_assignments}</div><div class="l">Tổng ca đã xếp</div></div>
        <div class="tile" style="border-top-color:#dc2626"><div class="n">${stats.shortage}</div><div class="l">Ca thiếu người</div></div></div>
      <section class="card flush">
        <div class="card-head"><h2>Tổng định biên</h2><div style="font-size:12px">Số = <strong>thực tế / định biên</strong> · <span class="pill ok">Xanh: đủ</span> <span class="pill off">Đỏ: thiếu</span> <span class="pill" style="background:#fef3c7;color:#92400e">Vàng: vượt</span></div></div>
        <div class="mtx-wrap" style="max-height:none"><table class="mtx">
          <thead><tr><th class="nm" rowspan="2">Cơ sở</th>${days.map((d) => html`<th colspan="${shifts.length}">${d.short} ${d.date}</th>`)}</tr>
            <tr>${days.map(() => shifts.map((s) => html`<th>${s}</th>`))}</tr></thead>
          <tbody>${sumRow('Toàn hệ thống', (d, s) => sm.chain.get(`${d}|${s}`))}
            ${cat.activeBranches.map((b) => sumRow(`${b.code} – ${b.name}`, (d, s) => sm.branches.get(`${b.code}|${d}|${s}`)))}</tbody></table></div>
      </section>
      <section class="card flush">
        <div class="filter-bar">
          <input class="input sm" type="search" id="f-q" placeholder="Tìm mã hoặc tên nhân viên" aria-label="Tìm nhân viên">
          <select class="input sm" id="f-cap" aria-label="Phân cấp"><option value="">Tất cả phân cấp</option>${RANKS.map((r) => html`<option>${r}</option>`)}</select>
          <select class="input sm" id="f-cn" aria-label="Cơ sở"><option value="">Tất cả cơ sở</option>${cat.activeBranches.map((b) => html`<option>${b.code}</option>`)}</select>
          <select class="input sm" id="f-vt" aria-label="Vị trí"><option value="">Tất cả vị trí</option>${roles.map((r) => html`<option>${r}</option>`)}</select>
          <select class="input sm" id="f-tt" aria-label="Trạng thái">${STATE_FILTERS.map(([v, t]) => html`<option value="${v}">${t}</option>`)}</select>
          <span style="font-size:13px" id="f-count"></span></div>
        <div style="padding:8px 20px;font-size:12px;display:flex;gap:10px;flex-wrap:wrap">
          <span class="mtx"><span class="st-free" style="padding:2px 6px">Xanh: đi làm được – chưa xếp</span></span><span class="mtx"><span class="st-off" style="padding:2px 6px">Đỏ: nghỉ</span></span>
          <span class="mtx"><span class="st-none" style="padding:2px 6px">Xám: chưa order</span></span><span class="mtx"><span class="st-ok" style="padding:2px 6px">Vàng: đã xếp</span></span>
          <span><strong>CĐ</strong>: lịch cố định</span> <span><span style="color:#dc2626">●</span> quản lý đã sửa</span><span style="color:#b91c1c">⚠ viền đỏ: xếp vào ca Nghỉ/Chưa order</span></div>
        <div class="mtx-wrap" style="border:0;border-top:1px solid var(--line);border-radius:0"><table class="mtx" id="master">
          <thead><tr><th class="nm" rowspan="2">Nhân viên</th><th rowspan="2">Cấp</th><th rowspan="2">Tổng</th>${days.map((d) => html`<th colspan="${shifts.length}">${d.short} ${d.date}</th>`)}</tr>
            <tr>${days.map(() => shifts.map((s) => html`<th>${s}</th>`))}</tr></thead>
          <tbody>${rowsHtml}</tbody></table></div>
      </section>`,
    mount() {
      pickMount();
      const rows = $$('#master tbody tr');
      const apply = () => {
        const q = norm($('#f-q').value.trim()), cap = $('#f-cap').value, cn = $('#f-cn').value, vt = $('#f-vt').value, tt = $('#f-tt').value;
        let n = 0;
        rows.forEach((tr) => {
          const show = (!q || tr.dataset.search.includes(q)) && (!cap || tr.dataset.rank === cap) && (!cn || tr.dataset.br.includes(`|${cn}|`))
            && (!vt || tr.dataset.roles.includes(`|${vt}|`)) && (!tt || tr.dataset.flags.includes(`|${tt}|`));
          tr.hidden = !show; if (show) n++;
        });
        $('#f-count').textContent = `Đang hiện ${n} nhân viên`;
      };
      ['#f-q', '#f-cap', '#f-cn', '#f-vt', '#f-tt'].forEach((s) => $(s).addEventListener('input', apply));
      apply();
      $$('#master select').forEach((s) => s.addEventListener('change', async () => {
        const td = s.closest('td');
        const [bid, role, ft] = s.value ? s.value.split('|') : [null, null, null];
        const pft = s.dataset.prev ? s.dataset.prev.split('|')[2] : null;
        const shift = ft || s.dataset.s; const prevShift = pft || s.dataset.s;
        const base = ft ? (JSON.parse(td.dataset.bft || '{}')[ft] || NONE) : td.dataset.base;
        if (s.value && (base === OFF || base === NONE) && !confirm(`Nhân viên ${base === OFF ? 'đã order NGHỈ' : 'CHƯA ORDER'} ${ft ? 'ca FULL TIME' : 'ca'} này. Vẫn xếp?`)) { s.value = s.dataset.prev; return; }
        const cell = (sh, b, r) => rpc('app_master_cell', { p_week: week.id, p_emp: Number(s.dataset.e), p_day: Number(s.dataset.d), p_shift: sh, p_branch: b ? Number(b) : null, p_role: r });
        try {
          if (s.dataset.prev && prevShift !== shift) await cell(prevShift, null, null);   // đổi ca thường ↔ FULL TIME
          await cell(shift, bid, role);
          s.dataset.prev = s.value;
          td.className = s.value ? `st-ok${base === OFF || base === NONE ? ' st-warn' : ''}` : base === OFF ? 'st-off' : base === NONE ? 'st-none' : 'st-free';
          const tr = s.closest('tr'); tr.querySelector('.tot strong').textContent = [...tr.querySelectorAll('select')].filter((x) => x.value).length;
          showSaved('Đã lưu · ' + hhmm());
          if (ft || pft) setTimeout(rerender, 400);   // cập nhật ô FULL TIME ở các ca chồng giờ
        } catch (e) { s.value = s.dataset.prev; showSaved(e.message, true); }
      }));
      $('#auto-btn')?.addEventListener('click', async () => {
        if (!confirm('Xếp lại từ đầu theo order và lịch cố định?\n\nMọi ca đã xếp tay của tuần này sẽ bị xóa.')) return;
        try { const n = await rpc('app_master_auto', { p_week: week.id }); flash(`Đã xếp theo order & lịch cố định: ${n} ca từ lịch cố định. Các ô khác để trống cho quản lý xếp tay.`); } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      $('#reapply-btn')?.addEventListener('click', async () => {
        if (!confirm('Đọc lại order mới nhất vào lịch? Các ca đã xếp được giữ nguyên.')) return;
        try {
          const r = await rpc('app_reapply_order', { p_week: week.id });
          flash(`Đã cập nhật order vào lịch: ${r.updated} ô cập nhật, ${r.inserted} ô mới, giữ nguyên ${r.assigned_preserved} ca đã xếp${r.conflicts ? `, ${r.conflicts} ca cần kiểm tra (order Nghỉ/Chưa order).` : '.'}`);
        } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      $('#clear-btn')?.addEventListener('click', async () => {
        if (!typed('Xóa toàn bộ lịch tuần này (order vẫn giữ)?', 'XOA')) return;
        try { await rpc('app_clear_schedule', { p_week: week.id }); flash('Đã xóa lịch tuần. Order vẫn giữ nguyên; bấm “Xếp theo order & lịch cố định” để xếp lại.'); } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      if (holds) return () => rpc('app_schedule_release', { p_week: week.id }).catch(() => {});
      return undefined;
    },
  };
}
