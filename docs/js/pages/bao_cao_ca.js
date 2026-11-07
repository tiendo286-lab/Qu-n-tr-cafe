// Quản lý ca › Báo cáo: doanh thu, số cốc theo cơ sở / ca, so sánh kỳ trước, khoản âm theo nhân viên; tải Excel (Chủ, Quản lý tổng)
import { addDays, vnToday, weekStart } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, fmt, vnd } from '../tien.js';
import { $, html, showSaved } from '../ui.js';
import { KA_STATUS } from './phieu_ca.js';

export const perm = 'bao_cao_ca';

function period(kind, ref) {
  if (kind === 'thang') {
    const [y, m] = ref.slice(0, 7).split('-').map(Number);
    const from = `${ref.slice(0, 7)}-01`; const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const pm = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const nm = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    return { from, to, label: `Tháng ${m}/${y}`, prevRef: pm, nextRef: nm, prev: { from: pm, to: new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10) } };
  }
  const from = weekStart(ref); const to = addDays(from, 6);
  return { from, to, label: `Tuần ${dmy(from).slice(0, 5)} – ${dmy(to)}`, prevRef: addDays(from, -7), nextRef: addDays(from, 7), prev: { from: addDays(from, -7), to: addDays(from, -1) } };
}
const pct = (a, b) => (!b ? '' : `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}%`);

export async function render({ params }) {
  const kind = params.kieu === 'thang' ? 'thang' : 'tuan';
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const P = period(kind, ref);
  const br = params.cn ? Number(params.cn) : null;
  const [cur, prv] = await Promise.all([rpc('app_ca_report', { p_from: P.from, p_to: P.to }), rpc('app_ca_report', { p_from: P.prev.from, p_to: P.prev.to })]);
  const pick = (rs) => rs.filter((r) => !br || r.branch_id === br);
  const R = pick(cur.reports); const RP = pick(prv.reports);
  const S = cur.shortfalls.filter((k) => !br || k.branch_id === br);
  const tot = (rs, k) => rs.reduce((s, r) => s + Number(r[k] || 0), 0);
  const rev = tot(R, 'revenue'); const cups = tot(R, 'cups'); const revP = tot(RP, 'revenue'); const cupsP = tot(RP, 'cups');
  const short = tot(R, 'short'); const shortP = tot(RP, 'short');
  const q = (o) => Object.entries({ kieu: kind, ngay: ref, cn: br || '', ...o }).filter(([, v]) => v !== '' && v !== null).map(([k, v]) => `${k}=${v}`).join('&');

  // theo ngày (biểu đồ cột)
  const days = []; for (let d = P.from; d <= P.to; d = addDays(d, 1)) days.push(d);
  const byDay = days.map((d) => ({ d, v: tot(R.filter((r) => r.work_date === d), 'revenue') }));
  const max = Math.max(1, ...byDay.map((x) => x.v));
  // theo cơ sở × ca
  const branches = cur.branches.filter((b) => !br || b.id === br);
  const shifts = cur.shifts;
  const cell = (bid, sh) => R.filter((r) => r.branch_id === bid && (!sh || r.shift === sh));
  // khoản âm theo nhân viên
  const emps = [...new Map(S.map((k) => [k.employee_id, k.employee])).entries()].map(([id, name]) => {
    const ks = S.filter((k) => k.employee_id === id); const s = (st) => ks.filter((k) => !st || k.status === st).reduce((t, k) => t + Number(k.amount), 0);
    return { name, n: ks.length, total: s(), open: s('chua_xu_ly'), bu: s('da_bu'), luong: s('tru_luong'), mien: s('mien') };
  }).sort((a, b) => b.total - a.total);

  const kpi = (label, v, prev, money = true, bad = false) => html`<div class="rp-k"><div class="st-meta">${label}</div><div class="rp-v">${money ? vnd(v) : fmt(v)}</div>
    <div class="rp-d ${prev === null ? '' : (v >= prev) !== bad ? 'up' : 'down'}">${prev === null || !prev ? 'kỳ trước: —' : `${pct(v, prev)} so với kỳ trước (${money ? vnd(prev) : fmt(prev)})`}</div></div>`;

  return {
    title: 'Báo cáo ca',
    html: html`<style>
        .rp-k { background: var(--card); border-radius: 16px; padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; }
        .rp-v { font-size: 22px; font-weight: 700; }
        .rp-d { font-size: 12px; color: var(--muted); } .rp-d.up { color: var(--ok-line); } .rp-d.down { color: #b91c1c; }
        .rp-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
        .rp-chart { display: flex; align-items: flex-end; gap: 3px; height: 180px; padding: 8px 4px 0; border-bottom: 1px solid var(--line); overflow-x: auto; }
        .rp-bar { flex: 1 1 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; min-width: 0; }
        .rp-bar i { display: block; width: 100%; max-width: 34px; background: var(--primary); border-radius: 6px 6px 0 0; min-height: 2px; }
        .rp-bar span { font-size: 10px; color: var(--muted); margin-top: 4px; white-space: nowrap; overflow: hidden; max-width: 100%; }
        @media (max-width: 640px) { .rp-many .rp-bar:nth-child(even) span { visibility: hidden; } }
        .rp-wrap { overflow-x: auto; }
        .rp-tool { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      </style>
      <div class="page-head"><div><h1>Báo cáo ca</h1><div class="sub">Số liệu lấy theo bản đối soát của từng ca (ca chưa đối soát thì lấy phiếu nhân viên). Chỉ tính ca nhân viên đã hoàn thành.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        <section class="card rp-tool" style="padding:12px 14px">
          <nav class="seg" style="min-width:200px"><a class="${kind === 'tuan' ? 'on' : ''}" href="#/quan-ly/bao-cao-ca?${q({ kieu: 'tuan' })}">Tuần</a><a class="${kind === 'thang' ? 'on' : ''}" href="#/quan-ly/bao-cao-ca?${q({ kieu: 'thang' })}">Tháng</a></nav>
          <a class="btn sm secondary" href="#/quan-ly/bao-cao-ca?${q({ ngay: P.prevRef })}">‹</a><strong>${P.label}</strong><a class="btn sm secondary" href="#/quan-ly/bao-cao-ca?${q({ ngay: P.nextRef })}">›</a>
          <select class="input sm" id="rp-br" aria-label="Cơ sở"><option value="">Tất cả cơ sở</option>${cur.branches.map((b) => html`<option value="${b.id}" ${br === b.id ? 'selected' : ''}>${b.code} – ${b.name}</option>`)}</select>
          <button type="button" class="btn sm" id="rp-xlsx" style="margin-left:auto">Tải Excel</button></section>
        <div class="rp-kpis">
          ${kpi('Doanh thu', rev, revP)}${kpi('Số cốc', cups, cupsP, false)}
          ${kpi('Trung bình / cốc', cups ? Math.round(rev / cups) : 0, cupsP ? Math.round(revP / cupsP) : null)}
          ${kpi('Số ca đã chốt', R.length, RP.length, false)}${kpi('Khoản thiếu khi đối soát', short, shortP, true, true)}
        </div>
        <section class="card stack" style="gap:8px;padding:16px"><h2 style="margin:0">Doanh thu theo ngày</h2>
          <div class="rp-chart ${byDay.length > 10 ? 'rp-many' : ''}" role="img" aria-label="Biểu đồ doanh thu theo ngày">${byDay.map((x) => html`<div class="rp-bar" title="${dmy(x.d)}: ${vnd(x.v)}"><i style="height:${Math.round((x.v / max) * 150)}px"></i><span>${x.d.slice(8, 10)}</span></div>`)}</div>
          <div class="st-meta">Rê chuột / chạm vào cột để xem số tiền. Cao nhất: ${vnd(Math.max(...byDay.map((x) => x.v)))}.</div></section>
        <section class="card flush rp-wrap"><div class="card-head"><h2>Theo cơ sở và ca</h2></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Cơ sở</th>${shifts.map((s) => html`<th>Ca ${s}</th>`)}<th>Tổng doanh thu</th><th>Số cốc</th><th>Tỉ trọng</th><th>So kỳ trước</th><th>Khoản thiếu</th></tr></thead>
          <tbody>${branches.map((b) => { const all = cell(b.id); const v = tot(all, 'revenue'); const vp = tot(RP.filter((r) => r.branch_id === b.id), 'revenue');
            return html`<tr><th scope="row">${b.code}</th>${shifts.map((s) => html`<td>${vnd(tot(cell(b.id, s), 'revenue'))}<div class="st-meta">${fmt(tot(cell(b.id, s), 'cups'))} cốc</div></td>`)}
              <td><strong>${vnd(v)}</strong></td><td>${fmt(tot(all, 'cups'))}</td><td>${rev ? Math.round((v / rev) * 100) + '%' : '—'}</td><td>${pct(v, vp) || '—'}</td><td style="color:#b91c1c">${tot(all, 'short') ? vnd(tot(all, 'short')) : '—'}</td></tr>`; })}
            <tr><th>Tổng</th>${shifts.map((s) => html`<td><strong>${vnd(tot(R.filter((r) => r.shift === s), 'revenue'))}</strong></td>`)}<td><strong>${vnd(rev)}</strong></td><td><strong>${fmt(cups)}</strong></td><td>100%</td><td>${pct(rev, revP) || '—'}</td><td>${short ? vnd(short) : '—'}</td></tr></tbody></table></div></section>
        <section class="card flush rp-wrap"><div class="card-head"><h2>Khoản âm theo nhân viên</h2><a class="btn sm secondary" href="#/quan-ly/khoan-am">Mở Khoản âm</a></div>
          ${emps.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Nhân viên</th><th>Số khoản</th><th>Tổng</th>${['chua_xu_ly', 'da_bu', 'tru_luong', 'mien'].map((s) => html`<th>${KA_STATUS[s][0]}</th>`)}</tr></thead>
            <tbody>${emps.map((e) => html`<tr><td>${e.name}</td><td>${e.n}</td><td><strong>${vnd(e.total)}</strong></td><td style="color:#b91c1c">${e.open ? vnd(e.open) : '—'}</td><td>${e.bu ? vnd(e.bu) : '—'}</td><td>${e.luong ? vnd(e.luong) : '—'}</td><td>${e.mien ? vnd(e.mien) : '—'}</td></tr>`)}</tbody></table></div>`
          : html`<div class="st-meta" style="padding:16px">Không có khoản âm trong kỳ này.</div>`}</section>
      </div>`,
    mount() {
      $('#rp-br').addEventListener('change', (e) => { location.hash = '#/quan-ly/bao-cao-ca?' + q({ cn: e.target.value }); });
      $('#rp-xlsx').addEventListener('click', async () => {
        try {
          const { downloadXlsx } = await import('../excel.js');
          await downloadXlsx(`bao_cao_ca_${P.from}_${P.to}.xlsx`, [
            { name: 'Theo ca', rows: [['Ngày', 'Cơ sở', 'Ca', 'Doanh thu', 'Số cốc', 'Tiền mặt POS', 'Chuyển khoản POS', 'Nợ phát sinh', 'Đối soát', 'Thiếu', 'Thừa'],
              ...R.map((r) => [dmy(r.work_date), r.branch, r.shift, r.revenue, r.cups, r.pos_cash, r.pos_transfer, r.debt_new, r.recon === 'hoan_thanh' ? 'Đã đối soát' : 'Chưa xong', r.short, r.over])] },
            { name: 'Theo cơ sở', rows: [['Cơ sở', ...shifts.map((s) => 'Ca ' + s), 'Tổng doanh thu', 'Số cốc', 'Kỳ trước', 'Khoản thiếu'],
              ...branches.map((b) => [b.code, ...shifts.map((s) => tot(cell(b.id, s), 'revenue')), tot(cell(b.id), 'revenue'), tot(cell(b.id), 'cups'), tot(RP.filter((r) => r.branch_id === b.id), 'revenue'), tot(cell(b.id), 'short')])] },
            { name: 'Khoản âm', rows: [['Nhân viên', 'Ngày', 'Cơ sở', 'Ca', 'Hạng mục', 'Số tiền', 'Lý do', 'Tình trạng', 'Giải trình'],
              ...S.map((k) => [k.employee, dmy(k.work_date), k.branch, k.shift, k.item_label, k.amount, k.reason || '', KA_STATUS[k.status][0], k.reply || ''])] },
          ]);
        } catch (e) { showSaved('Không tải được Excel: ' + e.message, true); }
      });
    },
  };
}
