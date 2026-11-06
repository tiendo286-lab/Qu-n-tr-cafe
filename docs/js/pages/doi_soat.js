// Đối soát: từng ca theo ngày + đối soát tiền mặt cuối ngày theo cơ sở
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, result, signed, vnd } from '../tien.js';
import { $$, flash, html, showSaved } from '../ui.js';
import { STAFF_LABEL, STYLE as CA_STYLE, bindDatePicker, datePicker } from './chot_ca.js';

export const perm = 'doi_soat';

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const [rows, days] = await Promise.all([rpc('app_ca_overview', { p_date: day }), rpc('app_ca_day', { p_date: day })]);
  const total = rows.length;
  const staffDone = rows.filter((r) => r.status === 'hoan_thanh').length;
  const reconDone = rows.filter((r) => r.recon_status === 'hoan_thanh').length;

  const shiftCell = (s) => {
    const st = s.report_id ? STAFF_LABEL[s.status] : ['Chưa mở', 'mute'];
    return html`<td>
      ${s.report_id ? html`<a href="#/ca/phieu?id=${s.report_id}" class="ds-link">` : ''}
      <div><span class="pill ${st[1]}">NV: ${st[0]}</span></div>
      ${s.status === 'hoan_thanh' ? html`<div style="margin-top:4px"><span class="pill ${s.recon_status === 'hoan_thanh' ? 'ok' : 'off'}">${s.recon_status === 'hoan_thanh' ? 'ĐÃ ĐỐI SOÁT' : `CHƯA ĐỐI SOÁT ${s.checks}/9`}</span></div>
        <div class="ds-money">TM: ${result(s.cash_left)}</div><div class="ds-money">CK: ${result(s.transfer_left)}</div>
        ${s.has_debt ? html`<div class="ds-money"><span class="pill warn">Có công nợ</span></div>` : ''}` : ''}
      ${s.report_id ? html`</a>` : ''}</td>`;
  };
  const shifts = [...new Set(rows.map((r) => r.shift))];

  const dayCard = (d) => {
    const ready = d.done >= d.shifts && d.shifts > 0;
    const expected = d.opening === null || d.pos_cash === null ? null : Number(d.opening) + Number(d.pos_cash) + Number(d.moves_cash);
    const gap = d.counted === null || expected === null ? null : Number(d.counted) - expected;
    return html`<section class="card stack ds-day" style="gap:10px;padding:16px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${d.branch_code} – ${d.branch_name}</strong>
        ${d.done_at ? html`<span class="pill ok">Đã đối soát cuối ngày</span>` : ready ? html`<span class="pill off">Chưa đối soát cuối ngày</span>` : html`<span class="pill mute">Mới xong ${d.done}/${d.shifts} ca</span>`}</div>
      ${d.has_debt ? html`<div class="alert warn" style="font-size:13px">Ngày này có công nợ. Công thức cuối cùng khi có nợ đang chờ chốt — kết quả dưới đây chỉ để tham khảo.</div>` : ''}
      <div class="kv">
        <div>Tiền mặt đầu ngày</div><div>${vnd(d.opening)}</div>
        <div>Tổng tiền mặt POS ${d.done} ca</div><div>${vnd(d.pos_cash)}</div>
        <div>Thu/chi tiền mặt đã kê khai</div><div>${signed(d.moves_cash)}</div>
        <div><strong>Tiền mặt phải có</strong></div><div><strong>${vnd(expected)}</strong></div>
        <div>Tiền trong két cuối ca ${d.last_shift || ''} (NV đếm)</div><div>${vnd(d.last_counted)}</div>
        <div>Tiền quản lý kiểm đếm</div><div>${d.counted === null ? '—' : html`${vnd(d.counted)} <span class="st-meta">${d.done_by} · ${dt(d.done_at)}</span>`}</div>
        <div><strong>Kết quả</strong></div><div>${d.counted === null ? html`<span class="pill mute">Chưa kiểm đếm</span>` : html`${result(gap)} ${gap ? html`<span class="st-meta">(${signed(gap)})</span>` : ''}`}</div>
        ${d.note ? html`<div>Ghi chú</div><div>${d.note}</div>` : ''}
      </div>
      ${ready ? html`<form class="pc-line ds-form" data-b="${d.branch_id}">
        <input class="input sm money" name="counted" inputmode="numeric" placeholder="Tiền mặt cuối ngày đã đếm" value="${d.counted === null ? '' : fmt(d.counted)}" aria-label="Tiền mặt cuối ngày quản lý đếm" style="width:210px">
        <input class="input sm" name="note" placeholder="Ghi chú" value="${d.note || ''}" style="flex:1 1 160px;min-width:0" aria-label="Ghi chú">
        <button class="btn sm" type="submit">${d.counted === null ? 'Lưu đối soát' : 'Cập nhật'}</button></form>`
      : html`<div class="st-meta">Đối soát cuối ngày làm sau khi đủ các ca trong ngày đã hoàn thành.</div>`}
      <div class="st-meta">Tiền bàn giao giữa các ca không cộng lại thành doanh thu ngày. Phải có = đầu ngày + tiền mặt POS các ca + thu/chi tiền mặt đã kê khai.</div>
    </section>`;
  };

  return {
    title: 'Đối soát',
    html: html`${CA_STYLE}<style>
        .ds-link { display: block; text-decoration: none; color: inherit; }
        .ds-money { font-size: 12px; margin-top: 4px; }
        .ds-table td { vertical-align: top; min-width: 150px; }
      </style>
      <div class="page-head"><div><h1>Đối soát</h1><div class="sub">Kiểm tra từng phiếu chốt ca rồi đối soát tiền mặt cuối ngày theo cơ sở.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        ${datePicker('/quan-ly/doi-soat', day)}
        <div class="tiles">
          <div class="tile" style="border-top-color:#2563eb"><div class="n">${staffDone}/${total}</div><div class="l">Phiếu nhân viên đã hoàn thành</div></div>
          <div class="tile" style="border-top-color:#16a34a"><div class="n">${reconDone}/${total}</div><div class="l">Phiếu đã hoàn thành đối soát</div></div>
        </div>
        <section class="card flush"><div class="card-head"><h2>Phiếu chốt ca ngày ${dmy(day)}</h2><a class="btn sm secondary" href="#/ca?ngay=${day}">Mở trang Chốt ca</a></div>
          <div class="table-wrap"><table class="table ds-table"><thead><tr><th>Cơ sở</th>${shifts.map((s) => html`<th>Ca ${s}</th>`)}</tr></thead>
          <tbody>${[...new Set(rows.map((r) => r.branch_id))].map((bid) => {
            const rs = rows.filter((r) => r.branch_id === bid);
            return html`<tr><th scope="row">${rs[0].branch_code}</th>${shifts.map((s) => { const x = rs.find((r) => r.shift === s); return x ? shiftCell(x) : html`<td>—</td>`; })}</tr>`;
          })}</tbody></table></div>
          <div class="st-meta" style="padding:8px 16px 14px">TM/CK: tiền mặt / chuyển khoản còn chưa giải trình sau thu chi. Bấm vào ô để mở phiếu và đối soát từng hạng mục.</div></section>
        <h2 style="margin:8px 0 0">Đối soát tiền mặt cuối ngày</h2>
        <div class="grid2">${days.map(dayCard)}</div>
      </div>`,
    mount() {
      bindDatePicker();
      bindMoneyInputs(document);
      $$('.ds-form').forEach((f) => f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          await rpc('app_ca_day_save', { p_branch: Number(f.dataset.b), p_date: day, p_counted: parseMoney(f.counted.value), p_note: f.note.value });
          flash('Đã lưu đối soát cuối ngày.'); rerender();
        } catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}
