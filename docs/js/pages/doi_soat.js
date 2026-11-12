// Đối soát (bước 35): Bảng ca theo ngày + VIỆC CHỜ ĐỐI SOÁT gom 1 chỗ (phiếu ca, dòng thu chi, hàng nhận, giải trình khoản âm)
// + đối soát tiền mặt cuối ngày theo cơ sở. Đối soát từng phiếu ca làm ở trang riêng #/quan-ly/doi-soat/ca.
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, result, signed, vnd } from '../tien.js';
import { $, $$, flash, html, showSaved } from '../ui.js';
import { DT_CSS, tcList } from '../doi_soat_tc.js';
import { KA_STATUS } from './phieu_ca.js';
import { STAFF_LABEL, STYLE as CA_STYLE, bindDatePicker, datePicker } from './chot_ca.js';

export const perm = 'doi_soat';

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const [rows, days, T, LO, KW] = await Promise.all([rpc('app_ca_overview', { p_date: day }), rpc('app_ca_day', { p_date: day }), rpc('app_ds_todo', { p_branch: null }),
    rpc('app_ca_loans_open').catch(() => []), rpc('app_ca_kt_wait').catch(() => [])]);
  // bước 44: phần tiền chờ kế toán (thiếu file chốt ca Fabi / chuyển khoản ngân hàng)
  const ktById = new Map((KW || []).filter((k) => k.status === 'hoan_thanh').map((k) => [k.id, k]));
  const repReady = (T.reports || []).filter((r) => !ktById.has(r.id));
  const repWait = (T.reports || []).filter((r) => ktById.has(r.id));
  const brById = new Map((T.branches || []).map((b) => [b.id, b]));
  const bcode = (id) => brById.get(id)?.code || '';
  const TB = { cn: '' };
  const total = rows.length;
  const staffDone = rows.filter((r) => r.status === 'hoan_thanh').length;
  const reconDone = rows.filter((r) => r.recon_status === 'hoan_thanh').length;

  // Bảng ca: mỗi ô tô màu theo trạng thái — chưa mở · đang chốt · chờ đối soát · đối soát xong · có khoản âm
  const nowHm = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);
  const stateOf = (s) => {
    if (!s.report_id) return day < vnToday() || (day === vnToday() && s.end_time && String(s.end_time).slice(0, 5) < nowHm) ? 'tre' : 'chua';
    if (s.status !== 'hoan_thanh') return 'dang';
    if (s.recon_status !== 'hoan_thanh') return ktById.has(s.report_id) ? 'kt' : 'cho';
    return Number(s.short_total) > 0 ? 'am' : 'xong';
  };
  const ST = { chua: ['Chưa mở', 'bc-chua'], tre: ['Quá giờ chưa chốt', 'bc-tre'], dang: ['Đang chốt', 'bc-dang'], kt: ['Chờ kế toán', 'bc-kt'], cho: ['Chờ đối soát', 'bc-cho'], xong: ['Đã đối soát', 'bc-xong'], am: ['Có khoản âm', 'bc-am'] };
  rows.forEach((r) => { r.st = stateOf(r); });
  const shiftCell = (s) => {
    const [label, cls] = ST[s.st];
    const inner = html`<div class="bc-top"><span class="bc-lbl">${s.st === 'cho' && s.recon_status === 'mo_lai' ? 'Đang đối soát lại' : label}</span>${s.st === 'cho' ? html`<span class="bc-n">${s.checks}/9</span>` : ''}</div>
      ${s.st === 'am' ? html`<div class="bc-big">−${fmt(s.short_total)}đ</div>` : ''}
      ${s.status === 'hoan_thanh' && s.revenue !== null && s.revenue !== undefined ? html`<div class="bc-rev">${fmt(s.revenue)}đ · ${s.cups ?? 0} cốc</div>` : ''}
      ${s.status === 'hoan_thanh' && s.st !== 'xong' && s.st !== 'am' ? html`<div class="bc-m">TM ${result(s.cash_left)}</div><div class="bc-m">CK ${result(s.transfer_left)}${s.ck_basis === 'nhan_vien' ? html` <span class="bc-tam">tạm</span>` : ''}</div>` : ''}
      ${s.hand_state === 'lech' || s.hand_state === 'can_dem_lai' ? html`<div class="bc-m bc-hand">⚠ Nhận két lệch ${signed(s.hand_gap)}${s.hand_state === 'can_dem_lai' ? ' · chờ đếm lại' : ''}</div>` : ''}
      ${s.status === 'dang_chot' && s.created_by ? html`<div class="bc-m">${s.created_by}</div>` : ''}
      ${s.has_debt ? html`<div class="bc-m">Có công nợ</div>` : ''}
      ${s.st === 'kt' ? html`<div class="bc-m">Thiếu: ${(ktById.get(s.report_id).missing || []).map((m) => (m.startsWith('file') ? 'file Fabi' : m.startsWith('chuyển') ? 'CK ngân hàng' : m)).join(', ')}</div>` : ''}`;
    const href = s.status === 'hoan_thanh' ? `#/quan-ly/doi-soat/ca?id=${s.report_id}` : `#/ca/phieu?id=${s.report_id}`;
    return s.report_id ? html`<a class="bc ${cls}" href="${href}">${inner}</a>` : html`<div class="bc ${cls}">${inner}</div>`;
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

  // ---------- VIỆC CHỜ ĐỐI SOÁT
  const sumAmt = (a) => a.reduce((x, r) => x + Number(r.amount || 0), 0);
  const repRow = (r) => html`<div class="td-r" data-br="${r.branch_id}">
      <div class="td-m"><strong>${dmy(r.date)} · ${bcode(r.branch_id)} · Ca ${r.shift}</strong>
        <div class="st-meta">${r.recon_status === 'mo_lai' ? 'Đang đối soát lại · ' : ''}${r.checks}/9 hạng mục · TM ${result(r.cash_left)} · CK ${result(r.transfer_left)}${r.ck_basis === 'nhan_vien' ? ' (tạm)' : ''}${r.completed_by ? ` · ${r.completed_by}` : ''}</div></div>
      <a class="btn sm" href="#/quan-ly/doi-soat/ca?id=${r.id}">Đối soát ›</a></div>`;
  const goodRow = (g) => html`<div class="td-r" data-br="${g.branch_id}">
      <div class="td-m"><strong>${g.kind === 'khong_hd' ? 'Nhận không hóa đơn' : `Hóa đơn ${g.doc_no || ''}`} · ${bcode(g.branch_id)}</strong>
        <div class="st-meta">Ca ${g.shift} ${dmy(g.date)} · ${g.received_by || ''} · còn ${g.n_unchecked}/${g.n_lines} món chưa đối soát</div></div>
      ${g.report_status === 'hoan_thanh' ? html`<a class="btn sm" href="#/quan-ly/doi-soat/ca?id=${g.report_id}&buoc=3">Đối soát hàng ›</a>`
        : html`<a class="btn sm secondary" href="#/ca/phieu?id=${g.report_id}">Phiếu ca chưa hoàn thành</a>`}</div>`;
  const kaRow = (k, i) => html`<div class="td-r" data-br="${k.branch_id}" data-i="${i}">
      <div class="td-m"><strong>${k.employee} · −${fmt(k.amount)}đ</strong> <span class="pill ${KA_STATUS[k.status][1]}">${KA_STATUS[k.status][0]}${k.auto_tru ? ' (mặc định)' : ''}</span>
        <div class="st-meta">Ca ${k.shift} ${k.branch} ${dmy(k.work_date)} · ${k.item_label}${k.reason ? ` · ${k.reason}` : ''}</div>
        <div class="td-rep">Giải trình ${dt(k.reply_at)}: ${k.reply}</div></div>
      <span class="toolbar" style="gap:6px"><button type="button" class="btn sm td-keep">Giữ trừ lương</button><a class="btn sm secondary" href="#/quan-ly/thu-chi?xem=khoan-am&thang=${String(k.work_date).slice(0, 7)}">Sửa / xóa</a></span></div>`;
  const loanRow = (d) => html`<div class="td-r" data-br="${d.branch_id}">
      <div class="td-m"><strong>${d.name} · ${fmt(d.amount)}đ</strong> ${d.days >= 3 ? html`<span class="pill off">${d.days} ngày</span>` : html`<span class="pill mute">${d.days} ngày</span>`}
        <div class="st-meta">${d.branch} · mượn ca ${d.shift} ${dmy(d.date)}${d.by ? ` · ${d.by} ghi` : ''}${d.note ? ` · ${d.note}` : ''}</div></div>
      <a class="btn sm secondary" href="#/ca/phieu?id=${d.report_id}">Xem phiếu ca</a></div>`;
  const todo = html`<section class="card stack td-card" id="td">
      <div class="bc-head"><h2 style="margin:0">Việc chờ đối soát</h2>
        <select class="input sm" id="td-br" aria-label="Cơ sở" style="margin-left:auto"><option value="">Mọi cơ sở</option>${(T.branches || []).map((b) => html`<option value="${b.id}">${b.code}</option>`)}</select></div>
      <div class="td-kpis">
        <button type="button" class="td-k" data-to="td-rep"><span>Phiếu ca chờ đối soát</span><b>${repReady.length}</b>${repWait.length ? html`<small>+ ${repWait.length} chờ kế toán</small>` : ''}</button>
        <button type="button" class="td-k" data-to="td-mv"><span>Dòng thu chi chờ</span><b>${T.moves.length}</b><small>${T.moves.length ? vnd(sumAmt(T.moves)) : ''}</small></button>
        <button type="button" class="td-k" data-to="td-hang"><span>Hàng chưa đối soát</span><b>${T.goods.length}</b></button>
        <button type="button" class="td-k" data-to="td-ka"><span>Giải trình khoản âm mới</span><b>${T.ka.length}</b></button></div>
      <div class="td-sec" id="td-rep"><h3>1. Phiếu ca chờ đối soát</h3>${repReady.length ? repReady.map(repRow) : html`<div class="st-meta">Không có phiếu nào chờ.</div>`}
        ${repWait.length ? html`<h3 style="margin-top:10px">Chờ kế toán — phần tiền chưa đối soát được <span class="st-meta">(Nhân sự, Bàn giao, Nhập hàng vẫn làm được)</span></h3>
          ${repWait.map((r) => html`<div class="td-r" data-br="${r.branch_id}"><div class="td-m"><strong>${dmy(r.date)} · ${bcode(r.branch_id)} · Ca ${r.shift}</strong>
            <div class="st-meta">Thiếu: ${(ktById.get(r.id).missing || []).join(', ')}</div></div>
            <a class="btn sm secondary" href="#/quan-ly/doi-soat/ca?id=${r.id}">Đối soát nhân sự / hàng ›</a></div>`)}` : ''}</div>
      <div class="td-sec" id="td-mv"><h3>2. Dòng thu chi ở phiếu ca chờ đối soát <span class="st-meta">(từ ${dmy(T.from)})</span></h3><div id="td-moves"></div></div>
      <div class="td-sec" id="td-hang"><h3>3. Hàng nhận chưa đối soát</h3>${T.goods.length ? T.goods.map(goodRow) : html`<div class="st-meta">Không có.</div>`}</div>
      <div class="td-sec" id="td-ka"><h3>4. Nhân viên giải trình khoản âm</h3>${T.ka.length ? T.ka.map(kaRow) : html`<div class="st-meta">Không có giải trình mới.</div>`}</div>
      <div class="td-sec" id="td-muon"><h3>5. Khách mượn tiền chưa trả</h3>${(LO || []).length ? LO.map(loanRow) : html`<div class="st-meta">Không có.</div>`}</div>
    </section>`;

  return {
    title: 'Đối soát',
    html: html`${CA_STYLE}${DT_CSS}<style>
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
        .bc-big { font-size: 17px; font-weight: 700; }
        .bc-rev { font-size: 12px; font-weight: 600; }
        .bc-m { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bc-hand { font-weight: 700; color: #b91c1c; background: #fff; border-radius: 6px; padding: 1px 5px; align-self: flex-start; }
        .bc-tam { font-size: 10px; font-weight: 700; background: #fff; border-radius: 6px; padding: 0 4px; }
        .bc-none { --bg: var(--line-soft); --c: var(--line); --fg: var(--muted); align-items: center; justify-content: center; }
        .bc-chua { --c: var(--muted); --bg: var(--line-soft); --fg: var(--ink-2); }
        .bc-tre { --c: #b91c1c; --bg: #fbefec; --fg: #7f1d1d; }
        .bc-dang { --c: #d97706; --bg: #fef3c7; --fg: #92400e; }
        .bc-cho { --c: var(--info-line); --bg: var(--info-bg); --fg: var(--info-ink); }
        .bc-kt { --c: var(--plum-ink); --bg: var(--plum-bg); --fg: var(--plum-ink); }
        .bc-xong { --c: var(--ok-line); --bg: var(--ok-bg); --fg: var(--ok-ink); }
        .bc-am { --c: #dc2626; --bg: #fee2e2; --fg: #991b1b; }
        .td-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
        .ds-day { min-width: 0; } .ds-day .kv { grid-template-columns: minmax(0, 1fr) minmax(0, auto); } .ds-day .kv > div { min-width: 0; overflow-wrap: anywhere; }
        .ds-form .input.money { max-width: 100%; }
        .td-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .td-k { font: inherit; text-align: left; border: none; cursor: pointer; background: var(--subtle, var(--line-soft)); border-radius: 12px; padding: 10px 12px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 2px; border-top: 4px solid var(--primary); min-width: 0; }
        .td-k span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; } .td-k b { font-size: 20px; } .td-k small { font-size: 12px; color: var(--ink-2); }
        .td-sec h3 { margin: 4px 0 6px; font-size: 15px; }
        .td-r { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 8px 4px; border-top: 1px solid var(--line-soft, var(--line)); }
        .td-r[hidden] { display: none; }
        .td-m { min-width: 0; flex: 1 1 240px; overflow-wrap: anywhere; }
        .td-rep { font-size: 13px; background: var(--warn-bg); border-radius: 6px; padding: 3px 6px; margin-top: 3px; }
        @media (max-width: 760px) { .td-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .bc-grid { gap: 5px; grid-template-columns: 40px repeat(3, minmax(0, 1fr)) !important; } .bc { padding: 7px; border-left-width: 4px; } .bc-lbl { font-size: 11.5px; } .bc-m, .bc-rev { font-size: 11px; } }
      </style>
      <div class="page-head"><div><h1>Đối soát</h1><div class="sub">Mọi việc chờ đối soát gom ở đây: phiếu ca, dòng thu chi, hàng nhận, giải trình khoản âm. Bấm vào để làm ngay.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        ${datePicker('/quan-ly/doi-soat', day)}
        <section class="card bc-card">
          <div class="bc-head"><h2 style="margin:0">Bảng ca ${day === vnToday() ? 'hôm nay' : 'ngày'} ${dmy(day)}</h2>
            <span class="st-meta">NV hoàn thành ${staffDone}/${total} · Đã đối soát ${reconDone}/${total}</span>
            <a class="btn sm secondary" href="#/ca?ngay=${day}" style="margin-left:auto">Mở trang Chốt ca</a></div>
          <div class="bc-legend">${['chua', 'tre', 'dang', 'kt', 'cho', 'xong', 'am'].map((k) => { const n = rows.filter((r) => r.st === k).length; return n || !['tre', 'kt'].includes(k) ? html`<span class="bc-lg ${ST[k][1]}"><i></i>${ST[k][0]} <b>${n}</b></span>` : ''; })}</div>
          <div class="bc-grid" style="grid-template-columns: 64px repeat(${shifts.length}, minmax(0, 1fr))">
            <div></div>${shifts.map((s) => html`<div class="bc-sh">Ca ${s}</div>`)}
            ${[...new Set(rows.map((r) => r.branch_id))].map((bid) => {
              const rs = rows.filter((r) => r.branch_id === bid);
              return html`<div class="bc-br">${rs[0].branch_code}</div>${shifts.map((s) => { const x = rs.find((r) => r.shift === s); return x ? shiftCell(x) : html`<div class="bc bc-none">—</div>`; })}`;
            })}
          </div>
          <div class="st-meta">TM / CK: tiền mặt / chuyển khoản còn chưa giải trình. “tạm”: kế toán chưa nhập đủ số dư ngân hàng. Bấm vào ô ca đã hoàn thành để mở trang Đối soát ca.</div></section>
        ${todo}
        <h2 style="margin:8px 0 0">Đối soát tiền mặt cuối ngày</h2>
        <div class="grid2">${days.map(dayCard)}</div>
      </div>`,
    mount() {
      bindDatePicker();
      $$('.td-k[data-to]').forEach((b) => b.addEventListener('click', () => document.getElementById(b.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
      const mvBox = $('#td-moves');
      const drawMv = () => tcList(mvBox, T.moves, { cats: T.categories || [], brById, onChange: () => rerender() });
      drawMv();
      $('#td-br').addEventListener('change', (e) => {
        TB.cn = e.target.value;
        $$('#td [data-br]').forEach((el) => { el.hidden = !!TB.cn && el.dataset.br !== TB.cn; });
      });
      $$('.td-keep').forEach((b) => b.addEventListener('click', async () => {
        const k = T.ka[Number(b.closest('.td-r').dataset.i)]; b.disabled = true;
        try { await rpc('app_ka_edit', { p_id: k.id, p_employee: k.employee_id, p_amount: k.amount, p_status: 'tru_luong', p_note: 'Đã xem giải trình — giữ trừ lương' }); flash('Đã giữ trừ lương. Nhân viên đã được báo.'); rerender(); }
        catch (e) { b.disabled = false; showSaved(e.message, true); }
      }));
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
