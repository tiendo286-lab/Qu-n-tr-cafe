// Quản lý ca › Khoản âm: các khoản thiếu tiền đã gán cho nhân viên khi đối soát — lọc, tổng theo người, đánh dấu Đã bù / Trừ lương / Miễn
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, dt, fmt, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, norm, str } from '../ui.js';
import { KA_STATUS } from './phieu_ca.js';

export const perm = 'doi_soat';
const F = { st: 'chua_xu_ly', emp: '', br: '', q: '' };

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : vnToday().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const shift = (k) => { const d = new Date(Date.UTC(y, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };
  const all = await rpc('app_ka_all', { p_from: month + '-01', p_to: last });
  const emps = [...new Map(all.map((k) => [String(k.employee_id), k.employee])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const brs = [...new Map(all.map((k) => [String(k.branch_id), k.branch])).entries()];
  const byEmp = emps.map(([id, name]) => {
    const ks = all.filter((k) => String(k.employee_id) === id);
    const s = (st) => ks.filter((k) => !st || k.status === st).reduce((t, k) => t + Number(k.amount), 0);
    return { id, name, n: ks.length, total: s(), open: s('chua_xu_ly'), bu: s('da_bu'), luong: s('tru_luong'), mien: s('mien') };
  }).sort((a, b) => b.total - a.total);

  const row = (k) => html`<div class="ka-r" data-id="${k.id}" data-st="${k.status}" data-emp="${k.employee_id}" data-br="${k.branch_id}" data-q="${norm(k.employee + ' ' + (k.reason || '') + ' ' + (k.reply || ''))}">
    <div class="ka-m"><strong>${k.employee}</strong><div class="st-meta"><a href="#/ca/phieu?id=${k.report_id}">Ca ${k.shift} ${k.branch} ${dmy(k.work_date)}</a> · ${k.item_label}${k.reason ? ` · ${k.reason}` : ''}</div>
      ${k.reply ? html`<div class="ka-rep">Giải trình: ${k.reply} <span class="st-meta">${dt(k.reply_at)}</span></div>` : ''}
      ${k.status_note ? html`<div class="st-meta">Ghi chú: ${k.status_note}</div>` : ''}</div>
    <div class="ka-a">−${fmt(k.amount)}đ</div>
    <div class="ka-s"><span class="pill ${KA_STATUS[k.status][1]}">${KA_STATUS[k.status][0]}</span><div class="st-meta">${k.seen_at ? 'NV đã xem' : 'NV chưa xem'}</div></div>
    <div><button type="button" class="btn sm secondary ka-set">Xử lý</button></div></div>`;

  return {
    title: 'Khoản âm',
    html: html`<style>
        .ka-sum { overflow-x: auto; }
        .ka-r { display: grid; grid-template-columns: minmax(0, 1fr) 110px 110px 80px; gap: 10px; align-items: center; padding: 10px 4px; border-top: 1px solid var(--line-soft); }
        .ka-a { font-weight: 700; color: #b91c1c; text-align: right; }
        .ka-rep { font-size: 13px; background: #fff7ed; border-radius: 8px; padding: 4px 8px; margin-top: 4px; }
        .ka-r[hidden] { display: none; }
        @media (max-width: 640px) { .ka-r { grid-template-columns: minmax(0, 1fr) auto; } .ka-s { grid-column: 1; } }
      </style>
      <div class="page-head"><div><h1>Khoản âm</h1><div class="sub">Khoản thiếu tiền quản lý đã gán cho nhân viên khi đối soát ca. Nhân viên được báo và có thể giải trình.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1000px;gap:12px">
        <section class="card toolbar" style="padding:12px 14px;gap:8px">
          <a class="btn sm secondary" href="#/quan-ly/khoan-am?thang=${shift(-1)}">‹ Tháng trước</a><strong>Tháng ${m}/${y}</strong>
          <a class="btn sm secondary" href="#/quan-ly/khoan-am?thang=${shift(1)}">Tháng sau ›</a></section>
        <section class="card flush ka-sum"><div class="card-head"><h2>Tổng theo nhân viên</h2></div>
          ${byEmp.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Nhân viên</th><th>Số khoản</th><th>Tổng</th><th>Chưa xử lý</th><th>Đã bù</th><th>Trừ lương</th><th>Miễn</th></tr></thead>
            <tbody>${byEmp.map((e) => html`<tr><td>${e.name}</td><td>${e.n}</td><td><strong>${vnd(e.total)}</strong></td><td style="color:#b91c1c">${e.open ? vnd(e.open) : '—'}</td><td>${e.bu ? vnd(e.bu) : '—'}</td><td>${e.luong ? vnd(e.luong) : '—'}</td><td>${e.mien ? vnd(e.mien) : '—'}</td></tr>`)}</tbody></table></div>`
          : html`<div style="padding:16px" class="st-meta">Tháng này chưa có khoản âm nào.</div>`}</section>
        <section class="card" style="padding:14px">
          <div class="toolbar" style="gap:8px">
            <select class="input sm" id="f-st">${[['', 'Mọi tình trạng'], ...Object.entries(KA_STATUS).filter(([k]) => k !== 'huy').map(([k, v]) => [k, v[0]])].map(([v, l]) => html`<option value="${v}" ${F.st === v ? 'selected' : ''}>${l}</option>`)}</select>
            <select class="input sm" id="f-emp"><option value="">Mọi nhân viên</option>${emps.map(([id, n]) => html`<option value="${id}" ${F.emp === id ? 'selected' : ''}>${n}</option>`)}</select>
            <select class="input sm" id="f-br"><option value="">Mọi cơ sở</option>${brs.map(([id, n]) => html`<option value="${id}" ${F.br === id ? 'selected' : ''}>${n}</option>`)}</select>
            <input class="input sm" type="search" id="f-q" placeholder="Tìm tên, lý do" value="${F.q}" style="flex:1 1 160px;min-width:0">
            <span class="st-meta" id="f-n"></span></div>
          <div id="ka-list">${all.map(row)}</div>
          <div class="st-meta" id="ka-empty" hidden style="padding:12px 0">Không có khoản nào khớp bộ lọc.</div>
        </section>
      </div>`,
    mount() {
      const apply = () => {
        const q = norm(F.q.trim()); let n = 0; let tot = 0;
        $$('.ka-r').forEach((r) => {
          const ok = (!F.st || r.dataset.st === F.st) && (!F.emp || r.dataset.emp === F.emp) && (!F.br || r.dataset.br === F.br) && (!q || r.dataset.q.includes(q));
          r.hidden = !ok; if (ok) { n++; tot += Number(all.find((k) => String(k.id) === r.dataset.id).amount); }
        });
        $('#f-n').textContent = `${n} khoản · ${fmt(tot)}đ`; $('#ka-empty').hidden = n > 0;
      };
      [['#f-st', 'st'], ['#f-emp', 'emp'], ['#f-br', 'br']].forEach(([s, k]) => $(s).addEventListener('change', (e) => { F[k] = e.target.value; apply(); }));
      $('#f-q').addEventListener('input', (e) => { F.q = e.target.value; apply(); });
      apply();
      $$('.ka-set').forEach((b) => b.addEventListener('click', () => {
        const k = all.find((x) => String(x.id) === b.closest('.ka-r').dataset.id);
        const d = dialog(html`<form class="stack" style="gap:12px;width:min(460px, calc(100vw - 56px))"><h2 style="margin:0">Xử lý khoản âm</h2>
          <div><strong>${k.employee}</strong> · −${vnd(k.amount)}<div class="st-meta">Ca ${k.shift} ${k.branch} ${dmy(k.work_date)} · ${k.item_label}</div></div>
          ${k.reply ? html`<div class="ka-rep">Giải trình: ${k.reply}</div>` : ''}
          <div class="pc-line" role="radiogroup">${['chua_xu_ly', 'da_bu', 'tru_luong', 'mien'].map((s) => html`<label class="radio-pill"><input type="radio" name="st" value="${s}" ${k.status === s ? 'checked' : ''}> ${KA_STATUS[s][0]}</label>`)}</div>
          <input class="input" name="note" placeholder="Ghi chú (bắt buộc khi Miễn)" value="${k.status_note || ''}"><div id="ka-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        d.querySelector('form').addEventListener('submit', async (ev) => {
          ev.preventDefault(); const f = ev.target;
          try { await rpc('app_ka_set_status', { p_id: k.id, p_status: f.querySelector('input[name=st]:checked').value, p_note: f.note.value }); d.close(); flash('Đã lưu. Nhân viên đã được báo.'); rerender(); }
          catch (e) { d.querySelector('#ka-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
        });
      }));
    },
  };
}
