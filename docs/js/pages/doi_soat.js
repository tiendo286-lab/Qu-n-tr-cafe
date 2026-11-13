// Đối soát (bước 35): Bảng ca theo ngày + VIỆC CHỜ ĐỐI SOÁT gom 1 chỗ (phiếu ca, dòng thu chi, hàng nhận, giải trình khoản âm)
// + đối soát tiền mặt cuối ngày theo cơ sở. Đối soát từng phiếu ca làm ở trang riêng #/quan-ly/doi-soat/ca.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';   // bước 77: Đối soát theo tuần, 1 cơ sở
import { DOW, WEEK_CSS, mondayOf } from './ke_toan_ck.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, result, signed, vnd } from '../tien.js';
import { $, $$, flash, html, showSaved } from '../ui.js';
import { DT_CSS, tcList } from '../doi_soat_tc.js';
import { KA_STATUS } from './phieu_ca.js';
import { NB_CSS, STAFF_LABEL, STYLE as CA_STYLE, bindDatePicker, datePicker, debtBadges } from './chot_ca.js';

export const perm = 'doi_soat';

// Bước 77 (anh Tiến chốt 13/11): Đối soát theo TUẦN, mỗi lần 1 cơ sở — bảng ① trạng thái đối soát (hàng ngày × cột ca + Cuối ngày),
// bảng ② tiền (TM / CK lệch từng ca + cộng cả ngày, cả tuần); "Việc chờ đối soát" của cơ sở đặt dưới. Xem theo ngày vẫn có (kiểm đếm cuối ngày).
const LS_BR = 'tcBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const kf = (n) => { const v = Number(n) || 0; const a = Math.abs(v); const s = v < 0 ? '−' : v > 0 ? '+' : ''; return a === 0 ? '0' : a >= 1e6 ? `${s}${(a / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}tr` : a >= 1000 ? `${s}${Math.round(a / 1000)}k` : `${s}${a}`; };
const dsTabs = (day, wk, cn) => html`<nav class="ck-view" aria-label="Cách xem"><a href="#/quan-ly/doi-soat?tuan=${day}${cn ? `&cn=${cn}` : ''}" class="${wk ? 'on' : ''}">Theo tuần</a><a href="#/quan-ly/doi-soat?xem=ngay&ngay=${day}" class="${wk ? '' : 'on'}">Theo ngày</a></nav>`;
const WST = { chua: ['Chưa mở', 'none'], tre: ['Thiếu phiếu', 'miss'], dang: ['Đang chốt', 'warn'], kt: ['Chờ kế toán', 'kt'], cho: ['Chờ đối soát', 'cho'], sua: ['Đang sửa', 'cho'], xong: ['Đã đối soát', 'ok'], am: ['Có khoản âm', 'miss'] };

async function weekData(day) {
  const mon = mondayOf(day); const days = [...Array(7)].map((_, i) => addDays(mon, i));
  let ovs; let cds; let KW;
  try { const W = await rpc('app_ds_week', { p_from: mon }); ovs = W.days.map((x) => x.ov || []); cds = W.days.map((x) => x.cd || []); KW = W.kt || []; }
  catch (_) {
    [ovs, cds, KW] = await Promise.all([Promise.all(days.map((d) => rpc('app_ca_overview', { p_date: d }))), Promise.all(days.map((d) => rpc('app_ca_day', { p_date: d }).catch(() => []))),
      rpc('app_ca_kt_wait').catch(() => [])]);
  }
  return { mon, days, ovs, cds, KW };
}

function weekTables(WD, cn, DEBT = new Map()) {
  const { days, ovs, cds, KW } = WD;
  const kt = new Set((KW || []).filter((k) => k.status === 'hoan_thanh').map((k) => k.id));
  const nowHm = new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16); const today = vnToday();
  const stOf = (s, d) => {
    if (!s.report_id) return d < today || (d === today && s.end_time && String(s.end_time).slice(0, 5) < nowHm) ? (d >= '2026-11-01' ? 'tre' : 'chua') : 'chua';
    if (s.status !== 'hoan_thanh') return 'dang';
    if (s.recon_status !== 'hoan_thanh') return kt.has(s.report_id) ? 'kt' : s.recon_status === 'mo_lai' ? 'sua' : 'cho';
    return Number(s.short_total) > 0 ? 'am' : 'xong';
  };
  const mine = ovs.map((rows) => (rows || []).filter((r) => r.branch_id === cn));
  const shifts = []; mine.flat().forEach((r) => { if (!shifts.includes(r.shift)) shifts.push(r.shift); });
  const get = (i, sh) => mine[i].find((r) => r.shift === sh) || null;
  const dname = (d, i) => html`<b>${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i]}</b><span>${dmy(d).slice(0, 5)}</span>`;
  const href = (s) => (!s.report_id ? null : s.status === 'hoan_thanh' ? `#/quan-ly/doi-soat/ca?id=${s.report_id}` : `#/ca/phieu?id=${s.report_id}`);
  const stCell = (s, d) => {
    if (!s) return html`<td class="dw-na">—</td>`;
    const st = stOf(s, d); const [lb, cls] = WST[st];
    const inner = html`<span class="dw-st">${lb}</span>${st === 'cho' || st === 'sua' ? html`<span class="dw-sub">${s.checks}/9 mục</span>` : ''}${st === 'am' ? html`<span class="dw-sub">−${fmt(s.short_total)}</span>` : ''}${s.report_id ? debtBadges(DEBT.get(s.report_id)) : ''}`;
    const h = href(s);
    return html`<td>${h ? html`<a class="dw-c ${cls}" href="${h}">${inner}</a>` : html`<span class="dw-c ${cls}">${inner}</span>`}</td>`;
  };
  const endCell = (c, d) => {
    if (!c || !c.shifts || (d > today && !c.done)) return html`<td class="dw-na">—</td>`;
    const ready = c.done >= c.shifts;
    const [lb, cls] = c.done_at ? ['✓ Đã kiểm đếm', 'ok'] : ready ? ['Chưa kiểm đếm', 'warn'] : [`Xong ${c.done}/${c.shifts} ca`, 'none'];
    return html`<td><a class="dw-c ${cls}" href="#/quan-ly/doi-soat?xem=ngay&ngay=${d}"><span class="dw-st">${lb}</span></a></td>`;
  };
  const all = days.flatMap((d, i) => shifts.map((sh) => [get(i, sh), d])).filter(([x]) => x);
  const n = (k) => all.filter(([x, d]) => stOf(x, d) === k).length;
  const done = (s) => s && s.status === 'hoan_thanh' && s.cash_left != null;
  const sumDay = (i, k) => shifts.reduce((t, sh) => { const s = get(i, sh); return t + (done(s) ? Number(s[k]) || 0 : 0); }, 0);
  const money = (tm, ck, strong) => html`<span class="dw-mn ${strong ? 'tot' : ''}"><span class="${tm < 0 ? 'neg' : tm > 0 ? 'pos' : ''}">TM ${kf(tm)}</span><span class="${ck < 0 ? 'neg' : ck > 0 ? 'pos' : ''}">CK ${kf(ck)}</span></span>`;
  const mnCell = (s) => (done(s) ? html`<td>${money(Number(s.cash_left) || 0, Number(s.transfer_left) || 0)}</td>` : html`<td class="dw-na">${s ? (s.report_id ? '…' : '—') : '—'}</td>`);
  const wkTM = days.reduce((t, _, i) => t + sumDay(i, 'cash_left'), 0); const wkCK = days.reduce((t, _, i) => t + sumDay(i, 'transfer_left'), 0);
  return html`
    <section class="card dw-card"><div class="dw-h"><h2>① Trạng thái đối soát</h2>
        <span class="st-meta">Đã đối soát <b>${n('xong') + n('am')}</b> · chờ <b>${n('cho') + n('sua')}</b>${n('kt') ? ` · chờ kế toán ${n('kt')}` : ''}${n('dang') ? ` · đang chốt ${n('dang')}` : ''}${n('tre') ? html` · <b class="neg">${n('tre')} thiếu phiếu</b>` : ''}</span></div>
      <div class="dw-wrap"><table class="dw-t"><thead><tr><th></th>${shifts.map((s) => html`<th>${s}</th>`)}<th>Cuối ngày</th></tr></thead>
        <tbody>${days.map((d, i) => html`<tr class="${d === today ? 'today' : ''}"><th>${dname(d, i)}</th>${shifts.map((sh) => stCell(get(i, sh), d))}${endCell((cds[i] || []).find((c) => c.branch_id === cn), d)}</tr>`)}</tbody></table></div>
      <div class="dw-lg">${['xong', 'cho', 'kt', 'dang', 'tre', 'am', 'chua'].map((k) => html`<span class="dw-c ${WST[k][1]}">${WST[k][0]}</span>`)}<span class="nb open">Nợ … chưa trả</span><span class="nb ok">Nợ … đã trả</span><span class="nb thu">Thu nợ …</span><span class="st-meta">Bấm ô để mở trang Đối soát ca; ô Cuối ngày mở trang kiểm đếm tiền mặt cuối ngày.</span></div></section>
    <section class="card dw-card"><div class="dw-h"><h2>② Tiền — lệch tiền mặt / chuyển khoản</h2><span class="st-meta">Cả tuần: ${money(wkTM, wkCK, true)}</span></div>
      <div class="dw-wrap"><table class="dw-t dw-m"><thead><tr><th></th>${shifts.map((s) => html`<th>${s}</th>`)}<th>Cả ngày</th></tr></thead>
        <tbody>${days.map((d, i) => html`<tr class="${d === today ? 'today' : ''}"><th>${dname(d, i)}</th>${shifts.map((sh) => mnCell(get(i, sh)))}<td class="dw-day">${shifts.some((sh) => done(get(i, sh))) ? money(sumDay(i, 'cash_left'), sumDay(i, 'transfer_left'), true) : html`<span class="st-meta">—</span>`}</td></tr>`)}
          <tr class="dw-wk"><th><b>Cả tuần</b></th>${shifts.map(() => html`<td></td>`)}<td>${money(wkTM, wkCK, true)}</td></tr></tbody></table></div>
      <div class="st-meta">Âm = thiếu, dương = dư (lệch ≤ 5.000 coi như khớp). Ca thiếu / dư xử lý ở <a href="#/quan-ly/am-tien">Quản lý ca › Âm tiền</a>.</div></section>`;
}

const DW_CSS = html`<style>
  .dw-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; }
  .dw-wk-nav { display: flex; align-items: center; gap: 8px; } .dw-wt { display: flex; flex-direction: column; align-items: center; min-width: 130px; font-size: 13px; }
  .dw-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .dw-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; } .dw-h h2 { margin: 0; font-size: 17px; }
  .dw-wrap { overflow-x: auto; }
  .dw-t { width: 100%; border-collapse: separate; border-spacing: 4px; table-layout: fixed; }
  .dw-t thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 700; }
  .dw-t thead th:first-child { width: 52px; }
  .dw-t tbody th { text-align: left; font-size: 13px; font-weight: 400; color: var(--ink-2); } .dw-t tbody th b { display: block; } .dw-t tbody th span { font-size: 11px; color: var(--muted); }
  .dw-t tr.today th, .dw-t tr.today th span { color: var(--primary); }
  .dw-t td { padding: 0; vertical-align: top; } .dw-na { text-align: center; color: var(--muted); padding-top: 8px !important; }
  .dw-c { display: flex; flex-direction: column; gap: 1px; min-height: 44px; border-radius: 10px; padding: 6px 8px; border: 1px solid var(--line); text-decoration: none; justify-content: center; }
  a.dw-c:hover { filter: brightness(.97); }
  .dw-c.ok { background: var(--ok-bg); border-color: #b7d8ab; color: var(--ok-ink); } .dw-c.warn { background: var(--warn-bg); border-color: #f6d58a; color: var(--warn-ink); }
  .dw-c.cho { background: var(--info-bg); border-color: #c4d3e2; color: var(--info-ink); } .dw-c.kt { background: var(--plum-bg); border-color: #dcc6d9; color: var(--plum-ink); }
  .dw-c.none { background: #fff; color: var(--muted); } .dw-c.miss { background: var(--off-bg); border-color: #f3b4ad; color: #991b1b; }
  .dw-st { font-size: 12.5px; font-weight: 800; } .dw-sub { font-size: 11px; font-weight: 600; }
  .dw-mn { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; padding: 6px 8px; background: var(--subtle); border-radius: 10px; min-height: 44px; justify-content: center; }
  .dw-mn.tot { background: transparent; padding: 0; min-height: 0; font-weight: 800; } .dw-day .dw-mn.tot { padding: 6px 8px; background: var(--caramel-soft); border-radius: 10px; min-height: 44px; }
  .dw-h .dw-mn.tot { display: inline-flex; flex-direction: row; gap: 8px; }
  .dw-mn .neg, .dw-h .neg { color: #b91c1c; } .dw-mn .pos { color: var(--ok-ink); }
  .dw-wk th, .dw-wk td { border-top: 2px solid var(--line); padding-top: 6px; }
  .dw-lg { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } .dw-lg .dw-c { min-height: 0; padding: 2px 8px; font-size: 12px; font-weight: 700; display: inline-flex; }
  @media (max-width: 560px) { .dw-t { border-spacing: 3px; } .dw-c, .dw-mn { padding: 5px 5px; } .dw-t thead th:first-child { width: 38px; } .dw-st { font-size: 11.5px; } .dw-mn { font-size: 11px; } }
</style>`;

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const wkMode = params.xem !== 'ngay';   // bước 77: mặc định xem theo tuần, 1 cơ sở
  const wkDay = /^\d{4}-\d{2}-\d{2}$/.test(params.tuan || '') ? params.tuan : day;
  let WD = null; let cn = null; const BRS = [];
  if (wkMode) {
    WD = await weekData(wkDay);
    WD.ovs.forEach((rows0) => (rows0 || []).forEach((r) => { if (!BRS.some((x) => x.id === r.branch_id)) BRS.push({ id: r.branch_id, code: r.branch_code, name: r.branch_name }); }));
    const has = (v) => BRS.some((x) => String(x.id) === String(v));
    cn = has(params.cn) ? Number(params.cn) : has(lsGet()) ? Number(lsGet()) : BRS[0]?.id || null;
    if (cn) lsSet(cn);
    if (cn) WD.debt = new Map(((await rpc('app_ca_debt_week', { p_branch: cn, p_from: WD.days[0], p_to: WD.days[6] }).catch(() => [])) || []).map((x) => [x.report_id, x]));   // bước 79
  }
  const [rows, days, T, LO, KW, CVT] = await Promise.all([rpc('app_ca_overview', { p_date: day }), rpc('app_ca_day', { p_date: day }), rpc('app_ds_todo', { p_branch: wkMode ? cn : null }),
    rpc('app_ca_loans_open').catch(() => []), rpc('app_ca_kt_wait').catch(() => []), rpc('app_cv_todo').catch(() => [])]);
  const DM = new Map(((await rpc('app_ca_debt_marks', { p_date: day }).catch(() => null)) || []).map((x) => [x.report_id, x]));   // bước 55
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
      ${(() => {   // bước 55: ô ca thu ghi "Thu nợ"; ô ca nợ chỉ ghi "Có công nợ" khi còn nợ chưa thu
        const dm = DM.get(s.report_id);
        if (!dm) return s.has_debt ? html`<div class="bc-m">Có công nợ</div>` : '';
        return html`${Number(dm.open_amt) > 0 ? html`<div class="bc-m">Có công nợ ${fmt(dm.open_amt)}đ</div>` : ''}${Number(dm.paid_amt) > 0 ? html`<div class="bc-m bc-paid">Thu nợ ${fmt(dm.paid_amt)}đ</div>` : ''}`;
      })()}
      ${s.st === 'kt' ? html`<div class="bc-m">Thiếu: ${(ktById.get(s.report_id).missing || []).map((m) => (m.startsWith('file') ? 'file Fabi' : m.startsWith('chuyển') ? 'CK ngân hàng' : m)).join(', ')}</div>` : ''}`;
    const href = s.status === 'hoan_thanh' ? `#/quan-ly/doi-soat/ca?id=${s.report_id}` : `#/ca/phieu?id=${s.report_id}`;
    return s.report_id ? html`<a class="bc ${cls}" href="${href}">${inner}</a>` : html`<div class="bc ${cls}">${inner}</div>`;
  };
  const shifts = [...new Set(rows.map((r) => r.shift))];

  const dayCard = (d) => {
    const ready = d.done >= d.shifts && d.shifts > 0;
    const expected = d.opening === null || d.pos_cash === null ? null : Number(d.opening) + Number(d.pos_cash) + Number(d.moves_cash) + Number(d.debt_cash || 0) - Number(d.rut_giao_ca || 0);
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
        ${Number(d.rut_giao_ca) ? html`<div>Nộp quỹ khi giao ca (ca sau mở với tiền gối đầu)</div><div>${signed(-d.rut_giao_ca)}</div>` : ''}
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
      ${g.report_status === 'hoan_thanh' ? html`<a class="btn sm" href="#/quan-ly/doi-soat/ca?id=${g.report_id}&buoc=2">Đối soát hàng ›</a>`
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
      <div class="td-sec" id="td-cv"><h3>6. Nghỉ / làm thay (x2)</h3>
        ${[['Chờ Quản lý tổng phân loại', (CVT || []).filter((c) => c.state !== 'cho_duyet')], ['Chờ Chủ duyệt', (CVT || []).filter((c) => c.state === 'cho_duyet')]].map(([lbl, list]) => html`
          <div class="st-meta" style="font-weight:700;margin-top:4px">${lbl} (${list.length})</div>
          ${list.length ? list.map((c) => html`<div class="td-r" data-br="${c.branch_id}"><div class="td-m"><strong>${dmy(c.date)} · ${c.branch} · Ca ${c.shift}</strong>${c.state === 'lech' ? html` <span class="pill off">nhân sự đã đổi — phân loại lại</span>` : ''}
              <div class="st-meta">${c.absent ? `Nghỉ: ${c.absent}` : ''}${c.absent && c.helper ? ' · ' : ''}${c.helper ? `Hỗ trợ: ${c.helper}` : ''}${c.x2 ? ` · x2: ${c.x2}` : ''}${c.set_by ? ` · phân loại: ${c.set_by}` : ''}</div></div>
            <a class="btn sm secondary" href="#/quan-ly/doi-soat/ca?id=${c.id}&buoc=1">Mở bước Nhân sự ›</a></div>`) : html`<div class="st-meta">Không có.</div>`}`)}</div>
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
      <style>${WEEK_CSS}</style>${DW_CSS}<div class="page-head"><div><h1>Đối soát</h1><div class="sub">${wkMode ? 'Theo tuần, từng cơ sở: ① trạng thái đối soát, ② tiền lệch; việc chờ đối soát ở dưới.' : 'Mọi việc chờ đối soát gom ở đây: phiếu ca, dòng thu chi, hàng nhận, giải trình khoản âm. Bấm vào để làm ngay.'}</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      ${wkMode ? html`<div class="stack" style="max-width:1100px;gap:12px">
        <section class="card dw-bar"><div class="toolbar" style="gap:8px">${dsTabs(wkDay, true, cn)}</div>
          <nav class="branch-tabs" aria-label="Cơ sở">${BRS.map((x) => html`<a class="${cn === x.id ? 'on' : ''}" href="#/quan-ly/doi-soat?tuan=${WD.mon}&cn=${x.id}" title="${x.name}">${x.code}</a>`)}</nav>
          <div class="dw-wk-nav"><a class="btn sm secondary" href="#/quan-ly/doi-soat?tuan=${addDays(WD.mon, -7)}&cn=${cn}" aria-label="Tuần trước">‹</a>
            <div class="dw-wt"><b>${dmy(WD.mon).slice(0, 5)} – ${dmy(WD.days[6])}</b>${vnToday() >= WD.mon && vnToday() <= WD.days[6] ? html`<span class="pill info">Tuần này</span>` : html`<a href="#/quan-ly/doi-soat?cn=${cn}">Về tuần này</a>`}</div>
            <a class="btn sm secondary" href="#/quan-ly/doi-soat?tuan=${addDays(WD.mon, 7)}&cn=${cn}" aria-label="Tuần sau">›</a></div></section>
        ${NB_CSS}${cn ? weekTables(WD, cn, WD.debt) : html`<div class="card">Chưa có cơ sở nào bật ca làm việc.</div>`}
        ${todo}
      </div>` : html`
      <div class="stack" style="max-width:1100px;gap:12px">
        <div class="toolbar" style="gap:8px">${dsTabs(day, false)}</div>
        ${datePicker('/quan-ly/doi-soat', day, '&xem=ngay')}
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
      </div>`}`,
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
      if (wkMode && cn) { const sel = $('#td-br'); sel.value = String(cn); sel.dispatchEvent(new Event('change')); sel.hidden = true; }   // bước 77
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
