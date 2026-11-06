// Cảnh báo theo tuần (người có quyền xếp lịch)
import { RANKS, addDays, closure, focusWeek, getWeek, hasPublished, parseWeekParam, statusLabel, vnToday, weekLabel, weekStart } from '../data.js';
import { $, $$, html, norm } from '../ui.js';
import { WARN_GROUPS, computeWarnings, warnTotal } from '../warnings.js';

export const perm = 'xep_lich';

export async function render({ params }) {
  let start = parseWeekParam(params.tuan);
  if (!start) { const fw = await focusWeek(); start = fw ? fw.start_date : addDays(weekStart(vnToday()), 7); }
  const week = await getWeek(start);
  const nav = html`<div class="wk-nav">
    <a class="btn sm secondary" href="#/quan-ly/canh-bao?tuan=${addDays(start, -7)}">‹ Tuần trước</a>
    <span class="wk-label">${weekLabel(start)}</span>
    <a class="btn sm secondary" href="#/quan-ly/canh-bao?tuan=${addDays(start, 7)}">Tuần sau ›</a>`;
  const cl = week ? await closure(week.id) : null;
  if (!cl) {
    return { title: 'Cảnh báo', html: html`<div class="page-head"><div><h1>Cảnh báo</h1><div class="sub">Chỉ cảnh báo, không chặn việc xếp. Bấm “Xem trên lịch” để nhảy đến ô đó.</div></div>${nav}</div></div>
      <div class="card">Tuần này chưa bắt đầu xếp lịch nên chưa có cảnh báo. Cảnh báo xuất hiện sau khi quản lý bấm <strong>Bắt đầu xếp lịch</strong> ở trang Order lịch làm.</div>` };
  }
  const [w, published] = await Promise.all([computeWarnings(week, { closure: cl }), hasPublished(week.id)]);
  const total = warnTotal(w);
  const maxCa = Math.max(1, ...w.so_ca.map((x) => x.n));
  return {
    title: 'Cảnh báo',
    html: html`
      <div class="page-head"><div><h1>Cảnh báo</h1><div class="sub">Chỉ cảnh báo, không chặn việc xếp. Bấm “Xem trên lịch” để nhảy đến ô đó.</div></div>
        ${nav}<span class="pill warn">${statusLabel(cl.status, published)}</span></div></div>
      ${total === 0 ? html`<div class="alert ok">Không có cảnh báo nào. Lịch tuần này ổn.</div>` : ''}
      <div class="tiles">${WARN_GROUPS.map(([k, , tile, color]) => html`<a class="tile" href="#" data-g="g-${k}" style="border-top-color:${color}"><div class="n">${w[k].length}</div><div class="l">${tile}</div></a>`)}</div>
      <div style="display:flex;gap:8px"><button class="btn sm secondary" type="button" id="wg-open">Mở hết</button><button class="btn sm secondary" type="button" id="wg-close">Thu hết</button></div>
      <div class="warn-grid">${WARN_GROUPS.map(([k, title, , color], i) => html`
        <details class="card flush wg" id="g-${k}" open>
          <summary class="card-head"><span class="chev" aria-hidden="true">›</span>
            <h2 style="font-size:16px;flex-grow:1"><span class="dot" style="background:${color}"></span>${i + 1}. ${title}</h2><strong>${w[k].length}</strong></summary>
          ${w[k].length ? html`<ul class="warn-list">${w[k].map((it) => html`<li><div><div style="font-weight:600">${it.label}</div><div class="det">${it.detail}</div></div>
            <a class="go" href="#/quan-ly/lich-co-so?tuan=${start}&cn=${it.branch_id}">Xem trên lịch →</a></li>`)}</ul>`
          : html`<div style="padding:14px 20px;color:var(--muted);font-size:14px">Không có.</div>`}
        </details>`)}</div>
      <details class="card flush wg" open style="margin-top:16px">
        <summary class="card-head"><span class="chev" aria-hidden="true">›</span>
          <h2 style="font-size:16px;flex-grow:1"><span class="dot" style="background:#6b7280"></span>7. Số ca mỗi người trong tuần</h2><span class="det">Chỉ để xem · xếp từ nhiều đến ít</span></summary>
        ${w.so_ca.length ? html`<div class="filter-bar">
            <input class="input sm" type="search" id="ca-q" placeholder="Tìm theo mã hoặc tên nhân viên…" aria-label="Tìm nhân viên" autocomplete="off">
            <select class="input sm" id="ca-rank" aria-label="Lọc cấp bậc"><option value="">Mọi cấp bậc</option>${RANKS.map((r) => html`<option>${r}</option>`)}</select>
            <span class="det" id="ca-count"></span></div>
          <div class="table-wrap"><table class="table" id="ca-table"><thead><tr><th>Mã NV</th><th>Tên</th><th>Cấp bậc</th><th style="text-align:right">Số ca</th><th style="width:40%"></th></tr></thead><tbody>
            ${w.so_ca.map((p) => html`<tr data-rank="${p.rank}" data-search="${norm(`${p.code} ${p.name}`)}"><td>${p.code}</td><td>${p.name}</td><td>${p.rank}</td><td style="text-align:right"><strong>${p.n}</strong></td>
              <td><div class="bar"><i style="width:${Math.round((p.n * 100) / maxCa)}%"></i></div></td></tr>`)}</tbody></table></div>
          <div id="ca-empty" style="padding:14px 20px;color:var(--muted);font-size:14px" hidden>Không tìm thấy nhân viên nào.</div>`
        : html`<div style="padding:14px 20px;color:var(--muted);font-size:14px">Chưa xếp ai.</div>`}
      </details>`,
    mount() {
      $('#wg-open').addEventListener('click', () => $$('details.wg').forEach((d) => { d.open = true; }));
      $('#wg-close').addEventListener('click', () => $$('details.wg').forEach((d) => { d.open = false; }));
      $$('.tile').forEach((t) => t.addEventListener('click', (ev) => { ev.preventDefault(); const d = document.getElementById(t.dataset.g); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
      const q = $('#ca-q'); const rk = $('#ca-rank');
      if (!q) return;
      const rows = $$('#ca-table tbody tr');
      const apply = () => {
        const t = norm(q.value.trim()); const r = rk.value; let n = 0;
        rows.forEach((tr) => { const show = (!t || tr.dataset.search.includes(t)) && (!r || tr.dataset.rank === r); tr.hidden = !show; if (show) n++; });
        $('#ca-count').textContent = t || r ? `${n}/${rows.length} người` : '';
        $('#ca-empty').hidden = n > 0;
      };
      q.addEventListener('input', apply); rk.addEventListener('change', apply);
    },
  };
}
