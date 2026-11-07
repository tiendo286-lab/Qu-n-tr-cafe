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

  // Bảng ca: mỗi ô tô màu theo trạng thái — chưa mở · đang chốt · chờ đối soát · đối soát xong · có khoản âm
  const nowHm = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
  const stateOf = (s) => {
    if (!s.report_id) return day < vnToday() || (day === vnToday() && s.end_time && String(s.end_time).slice(0, 5) < nowHm) ? 'tre' : 'chua';
    if (s.status !== 'hoan_thanh') return 'dang';
    if (s.recon_status !== 'hoan_thanh') return 'cho';
    return Number(s.short_total) > 0 ? 'am' : 'xong';
  };
  const ST = { chua: ['Chưa mở', 'bc-chua'], tre: ['Quá giờ chưa chốt', 'bc-tre'], dang: ['Đang chốt', 'bc-dang'], cho: ['Chờ đối soát', 'bc-cho'], xong: ['Đã đối soát', 'bc-xong'], am: ['Có khoản âm', 'bc-am'] };
  rows.forEach((r) => { r.st = stateOf(r); });
  const shiftCell = (s) => {
    const [label, cls] = ST[s.st];
    const inner = html`<div class="bc-top"><span class="bc-lbl">${s.st === 'cho' && s.recon_status === 'mo_lai' ? 'Đang đối soát lại' : label}</span>${s.st === 'cho' ? html`<span class="bc-n">${s.checks}/9</span>` : ''}</div>
      ${s.st === 'am' ? html`<div class="bc-big">−${fmt(s.short_total)}đ</div>` : ''}
      ${s.status === 'hoan_thanh' && s.revenue !== null && s.revenue !== undefined ? html`<div class="bc-rev">${fmt(s.revenue)}đ · ${s.cups ?? 0} cốc</div>` : ''}
      ${s.status === 'hoan_thanh' && s.st !== 'xong' && s.st !== 'am' ? html`<div class="bc-m">TM ${result(s.cash_left)}</div><div class="bc-m">CK ${result(s.transfer_left)}${s.ck_basis === 'nhan_vien' ? html` <span class="bc-tam">tạm</span>` : ''}</div>` : ''}
      ${s.status === 'dang_chot' && s.created_by ? html`<div class="bc-m">${s.created_by}</div>` : ''}
      ${s.has_debt ? html`<div class="bc-m">Có công nợ</div>` : ''}`;
    return s.report_id ? html`<a class="bc ${cls}" href="#/ca/phieu?id=${s.report_id}">${inner}</a>` : html`<div class="bc ${cls}">${inner}</div>`;
  };
  const shifts = [...new Set(rows.map((r) => r.shift))];

  const dayCard = (d) => {
    const ready = d.done >= d.shifts && d.shifts > 0;
    const expected = d.opening === null || d.pos_cash === null ? null : Number(d.opening) + Number(d.pos_cash) + Number(d.moves_cash) + Number(d.debt_cash || 0);
    const gap = d.counted === null || expected === null ? null : Number(d.counted) - expected;
    return html`<section class="card stack ds-day" style="gap:10px;padding:16px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${d.branch_code} – ${d.branch_name}</strong>
        ${d.done_at ? html`<span class="pill ok">Đã đối soát cuối ngày</span>` : ready ? html`<span class="pill off">Chưa đối soát cuối ngày</span>` : html`<span class="pill mute">Mới xong ${d.done}/${d.shifts} ca</span>`}</div>
      <div class="st-meta" style="font-size:13px">Số liệu lấy theo <strong>bản đối soát</strong> của từng ca (ca chưa có bản đối soát thì lấy phiếu nhân viên). Đã hoàn thành đối soát ${d.recon_done ?? 0}/${d.shifts} ca.</div>
      ${d.recon_reopen ? html`<div class="alert warn" style="font-size:13px">${d.recon_reopen} ca đang ĐỐI SOÁT LẠI — số liệu đang được sửa, chưa phải số chính thức.</div>` : d.done && (d.recon_done ?? 0) < d.done ? html`<div class="alert warn" style="font-size:13px">Còn ${d.done - (d.recon_done ?? 0)} ca chưa hoàn thành đối soát — số dưới đây chưa phải số chính thức.</div>` : ''}
      <div class="kv">
        <div>Tiền mặt đầu ngày</div><div>${vnd(d.opening)}</div>
        <div>Tổng tiền mặt POS ${d.done} ca</div><div>${vnd(d.pos_cash)}</div>
        <div>Thu/chi tiền mặt đã kê khai</div><div>${signed(d.moves_cash)}</div>
        ${Number(d.debt_cash) ? html`<div>Khách trả nợ bằng tiền mặt</div><div>${signed(d.debt_cash)}</div>` : ''}
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
      <div class="st-meta">Tiền bàn giao giữa các ca không cộng lại thành doanh thu ngày. Phải có = đầu ngày + tiền mặt POS các ca + thu/chi tiền mặt + khách trả nợ bằng tiền mặt.</div>
    </section>`;
  };

  return {
    title: 'Đối soát',
    html: html`${CA_STYLE}<style>
        .ds-link { display: block; text-decoration: none; color: inherit; }
        .ds-money { font-size: 12px; margin-top: 4px; }
        .ds-table td { vertical-align: top; min-width: 150px; }
        .bc-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
        .bc-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .bc-legend { display: flex; gap: 6px; flex-wrap: wrap; }
        .bc-lg { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 16px; background: var(--bg); color: var(--fg); }
        .bc-lg i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
        .bc-grid { display: grid; gap: 8px; align-items: stretch; }
        .bc-sh { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; text-align: center; }
        .bc-br { font-weight: 700; display: flex; align-items: center; }
        .bc { display: flex; flex-direction: column; gap: 3px; padding: 10px; border-radius: 14px; background: var(--bg); color: var(--fg); text-decoration: none; border-left: 5px solid var(--c); min-height: 74px; min-width: 0; }
        a.bc:hover { filter: brightness(.97); color: var(--fg); }
        .bc-top { display: flex; justify-content: space-between; gap: 4px; align-items: center; }
        .bc-lbl { font-weight: 700; font-size: 13px; }
        .bc-n { font-size: 12px; font-weight: 700; }
        .bc-big { font-size: 17px; font-weight: 800; }
        .bc-rev { font-size: 12px; font-weight: 600; }
        .bc-m { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bc-tam { font-size: 10px; font-weight: 700; background: #fff; border-radius: 6px; padding: 0 4px; }
        .bc-none { --bg: var(--line-soft); --c: var(--line); --fg: var(--muted); align-items: center; justify-content: center; }
        .bc-chua { --c: #9ca3af; --bg: #f3f4f6; --fg: #4b5563; }
        .bc-tre { --c: #b91c1c; --bg: #f5f5f4; --fg: #7f1d1d; }
        .bc-dang { --c: #d97706; --bg: #fef3c7; --fg: #92400e; }
        .bc-cho { --c: #2563eb; --bg: #dbeafe; --fg: #1e40af; }
        .bc-xong { --c: #16a34a; --bg: #dcfce7; --fg: #166534; }
        .bc-am { --c: #dc2626; --bg: #fee2e2; --fg: #991b1b; }
        @media (max-width: 640px) { .bc-grid { gap: 5px; grid-template-columns: 40px repeat(3, minmax(0, 1fr)) !important; } .bc { padding: 7px; border-left-width: 4px; } .bc-lbl { font-size: 11.5px; } .bc-m, .bc-rev { font-size: 11px; } }
      </style>
      <div class="page-head"><div><h1>Đối soát</h1><div class="sub">Kiểm tra từng phiếu chốt ca rồi đối soát tiền mặt cuối ngày theo cơ sở.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        ${datePicker('/quan-ly/doi-soat', day)}
        <section class="card bc-card">
          <div class="bc-head"><h2 style="margin:0">Bảng ca ${day === vnToday() ? 'hôm nay' : 'ngày'} ${dmy(day)}</h2>
            <span class="st-meta">NV hoàn thành ${staffDone}/${total} · Đã đối soát ${reconDone}/${total}</span>
            <a class="btn sm secondary" href="#/ca?ngay=${day}" style="margin-left:auto">Mở trang Chốt ca</a></div>
          <div class="bc-legend">${['chua', 'tre', 'dang', 'cho', 'xong', 'am'].map((k) => { const n = rows.filter((r) => r.st === k).length; return n || k !== 'tre' ? html`<span class="bc-lg ${ST[k][1]}"><i></i>${ST[k][0]} <b>${n}</b></span>` : ''; })}</div>
          <div class="bc-grid" style="grid-template-columns: 64px repeat(${shifts.length}, minmax(0, 1fr))">
            <div></div>${shifts.map((s) => html`<div class="bc-sh">Ca ${s}</div>`)}
            ${[...new Set(rows.map((r) => r.branch_id))].map((bid) => {
              const rs = rows.filter((r) => r.branch_id === bid);
              return html`<div class="bc-br">${rs[0].branch_code}</div>${shifts.map((s) => { const x = rs.find((r) => r.shift === s); return x ? shiftCell(x) : html`<div class="bc bc-none">—</div>`; })}`;
            })}
          </div>
          <div class="st-meta">TM / CK: tiền mặt / chuyển khoản còn chưa giải trình. “tạm”: kế toán chưa nhập đủ số dư ngân hàng. Bấm vào ô để mở phiếu và đối soát.</div></section>
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
