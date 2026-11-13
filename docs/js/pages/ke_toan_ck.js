// Kế toán · Chuyển khoản thực nhận
//  * Tài khoản nhận tiền: mỗi chi nhánh có thể nhiều tài khoản ngân hàng (thêm / sửa / ngừng dùng / xóa khi chưa có số dư).
//  * Theo từng phiếu ca: nhập số dư đầu / cuối / tiền chuyển ra cho TỪNG tài khoản của chi nhánh.
//    Tiền nhận trong ca = tổng các tài khoản (Số dư cuối − Số dư đầu + Tiền chuyển ra). Khóa khi quản lý HOÀN THÀNH ĐỐI SOÁT.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, signed, vnd } from '../tien.js';
import { $, $$, dialog, flash, hhmm, html, showSaved } from '../ui.js';
import { dayName } from './chot_ca.js';

export const perm = 'ke_toan';

const money = (cls, v, dis, extra = '') => html`<input class="input sm money ${cls}" inputmode="numeric" autocomplete="off" placeholder="0" value="${v === null || v === undefined ? '' : fmt(v)}" ${dis ? 'disabled' : ''} ${extra}>`;
export const accName = (a) => `${a.bank} ${a.account_no}${a.label ? ' · ' + a.label : ''}`;

// Bảng tuần: mỗi cơ sở 1 bảng, hàng = ca + tổng ngày, cột = 7 ngày + cả tuần; ô = tiền ngân hàng nhận và lệch so với CK theo phiếu
export const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const mondayOf = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };
const viewTabs = (day, wk) => html`<nav class="ck-view" aria-label="Cách xem"><a href="#/ke-toan/chuyen-khoan?ngay=${day}" class="${wk ? '' : 'on'}">Theo ngày</a><a href="#/ke-toan/chuyen-khoan?xem=tuan&ngay=${day}" class="${wk ? 'on' : ''}">Bảng tuần</a></nav>`;

async function renderWeek(day) {
  const mon = mondayOf(day); const days = [...Array(7)].map((_, i) => addDays(mon, i));
  let all;
  try { all = (await rpc('app_kt_bank_week', { p_from: mon })).map((x) => x.rows || []); }
  catch (_) { all = await Promise.all(days.map((d) => rpc('app_kt_bank_day', { p_date: d }))); }   // máy chủ chưa có bước 60
  const branches = []; const shifts = [];
  all.forEach((rows) => rows.forEach((r) => { if (!branches.some((b) => b.id === r.branch_id)) branches.push({ id: r.branch_id, code: r.branch_code, name: r.branch_name }); if (!shifts.includes(r.shift)) shifts.push(r.shift); }));
  const get = (bid, i, sh) => (all[i] || []).find((r) => r.branch_id === bid && r.shift === sh)?.row || null;
  // ô 1 ca: tiền nhận + lệch; trả về số để cộng dồn
  const val = (row) => {
    if (!row) return { st: 'none' };
    const n = Number(row.account_count || 0); const e = Number(row.entered || 0);
    if (!n) return { st: 'noacc' };
    if (!e) return { st: 'empty' };
    const got = Number(row.received || 0); const pt = row.pos_transfer === null || row.pos_transfer === undefined ? null : Number(row.pos_transfer);
    return { st: e < n ? 'part' : 'ok', got, pt, gap: pt === null ? null : got - pt, lock: row.locked };
  };
  const cell = (v, href) => {
    const body = v.st === 'none' ? html`<span class="st-meta">—</span>` : v.st === 'noacc' ? html`<span class="st-meta">chưa có TK</span>` : v.st === 'empty' ? html`<span class="ck-w-miss">chưa nhập</span>`
      : html`<b>${fmt(v.got)}</b>${v.gap === null ? '' : v.gap === 0 ? html`<span class="ck-w-ok">✓ khớp</span>` : html`<span class="ck-w-bad">${signed(v.gap)}</span>`}${v.st === 'part' ? html`<span class="ck-w-miss">thiếu TK</span>` : ''}`;
    return html`<td class="ck-w-c ${v.st} ${v.gap ? 'bad' : ''}">${href ? html`<a href="${href}">${body}</a>` : body}</td>`;
  };
  const sumOf = (vs) => { const ok = vs.filter((v) => v.st === 'ok' || v.st === 'part'); if (!ok.length) return { st: vs.some((v) => v.st === 'empty' || v.st === 'part') ? 'empty' : 'none' };
    const got = ok.reduce((t, v) => t + v.got, 0); const hasPt = ok.every((v) => v.pt !== null); const pt = ok.reduce((t, v) => t + (v.pt || 0), 0);
    return { st: vs.some((v) => v.st === 'empty' || v.st === 'part') ? 'part' : 'ok', got, pt, gap: hasPt ? got - pt : null }; };
  const table = (b) => {
    const V = shifts.map((sh) => days.map((d, i) => val(get(b.id, i, sh))));
    const dayTot = days.map((d, i) => sumOf(V.map((row) => row[i])));
    const shTot = V.map((row) => sumOf(row)); const wk = sumOf(dayTot);
    const missing = V.flat().filter((v) => v.st === 'empty' || v.st === 'part').length;
    return html`<section class="card stack" style="gap:8px"><div class="ck-w-h"><h2 style="margin:0">${b.code} – ${b.name}</h2>
        ${wk.st === 'none' ? '' : html`<span class="st-meta">Cả tuần nhận <b>${fmt(wk.got)}đ</b>${wk.gap === null ? '' : wk.gap === 0 ? ' · ✓ khớp CK theo phiếu' : html` · lệch <b class="${wk.gap < 0 ? 'neg' : ''}">${signed(wk.gap)}</b>`}${missing ? html` · <span class="ck-w-miss">${missing} ca chưa nhập đủ</span>` : ''}</span>`}</div>
      <div class="table-wrap ck-w-wrap"><table class="ck-w">
        <thead><tr><th>Ca</th>${days.map((d) => html`<th class="${d === vnToday() ? 'today' : ''}"><a href="#/ke-toan/chuyen-khoan?ngay=${d}">${DOW[new Date(d + 'T00:00:00Z').getUTCDay()]}<br><span>${dmy(d).slice(0, 5)}</span></a></th>`)}<th>Cả tuần</th></tr></thead>
        <tbody>${shifts.map((sh, k) => html`<tr><th>${sh}</th>${V[k].map((v, i) => cell(v, `#/ke-toan/chuyen-khoan?ngay=${days[i]}`))}${cell(shTot[k])}</tr>`)}
          <tr class="ck-w-tot"><th>Tổng ngày</th>${dayTot.map((v) => cell(v))}${cell(wk)}</tr></tbody></table></div></section>`;
  };
  return {
    title: 'Chuyển khoản thực nhận',
    html: html`<style>${WEEK_CSS}</style>
      <div class="page-head"><div><h1>Chuyển khoản thực nhận</h1><div class="sub">Bảng tuần: mỗi ô là tiền ngân hàng nhận trong ca (tổng các tài khoản) và lệch so với chuyển khoản theo phiếu (POS). Bấm vào ô để mở ngày đó và nhập / sửa số dư.</div></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        <section class="card toolbar" style="padding:12px 14px;gap:8px">${viewTabs(day, true)}
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?xem=tuan&ngay=${addDays(mon, -7)}">‹ Tuần trước</a>
          <input class="input sm" type="date" id="ck-wday" value="${day}" aria-label="Ngày trong tuần">
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?xem=tuan&ngay=${addDays(mon, 7)}">Tuần sau ›</a>
          <strong>${dmy(mon)} – ${dmy(days[6])}</strong></section>
        <div class="ck-w-legend st-meta"><span class="ck-w-ok">✓ khớp</span> · <span class="ck-w-bad">−50.000</span> lệch (âm = ngân hàng nhận ít hơn phiếu) · <span class="ck-w-miss">chưa nhập</span> · — chưa có phiếu ca</div>
        ${branches.map(table)}
      </div>`,
    mount() { $('#ck-wday').addEventListener('change', (e) => { location.hash = '#/ke-toan/chuyen-khoan?xem=tuan&ngay=' + e.target.value; }); },
  };
}
export const WEEK_CSS = `
  .ck-view { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .ck-view a { padding: 6px 12px; font-weight: 700; font-size: 14px; text-decoration: none; color: var(--ink-2); background: var(--card); }
  .ck-view a + a { border-left: 1px solid var(--line); } .ck-view a.on { background: var(--primary); color: #fff; }
  @media (max-width: 760px) { .ck-view { display: flex; width: 100%; } .ck-view a { flex: 1 1 0; text-align: center; } }
  .ck-w-h { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline; }
  .ck-w-wrap { overflow-x: auto; }
  .ck-w { border-collapse: collapse; width: 100%; min-width: 760px; font-size: 13px; font-variant-numeric: tabular-nums; }
  .ck-w th, .ck-w td { border: 1px solid var(--line); padding: 6px; text-align: right; vertical-align: top; }
  .ck-w thead th { background: var(--subtle); text-align: center; font-weight: 700; } .ck-w thead th span { font-weight: 500; color: var(--ink-2); }
  .ck-w thead th.today { background: #fef3c7; } .ck-w thead a { color: inherit; text-decoration: none; }
  .ck-w tbody th { text-align: left; background: var(--subtle); white-space: nowrap; position: sticky; left: 0; z-index: 1; }
  .ck-w td a { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; color: inherit; text-decoration: none; }
  .ck-w td { min-width: 92px; } .ck-w td b { font-size: 13px; }
  .ck-w td.bad { background: #fef2f2; }
  .ck-w-ok { color: var(--ok-ink); font-size: 12px; } .ck-w-bad { color: #b91c1c; font-weight: 700; font-size: 12px; } .ck-w-miss { color: #b45309; font-size: 12px; }
  .ck-w-tot th, .ck-w-tot td { background: var(--subtle); font-weight: 700; } .ck-w-tot td.bad { background: #fee2e2; }
  .ck-w td span, .ck-w td b { display: block; }
  b.neg { color: #b91c1c; }
`;

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  if (params.xem === 'tuan') return renderWeek(day);
  const [rows, accounts] = await Promise.all([rpc('app_kt_bank_day', { p_date: day }), rpc('app_kt_accounts')]);
  const byBranch = [];
  rows.forEach((r) => { let b = byBranch.find((x) => x.id === r.branch_id); if (!b) byBranch.push(b = { id: r.branch_id, code: r.branch_code, name: r.branch_name, shifts: [] }); b.shifts.push(r); });
  const activeOf = (bid) => accounts.filter((a) => a.branch_id === bid && a.active);
  const noAcc = byBranch.filter((b) => !activeOf(b.id).length);

  const accRow = (a, lock) => {
    const prevC = a.prev ? a.prev.closing : null;
    const sgOpen = a.opening === null && prevC !== null; // gợi ý số dư đầu = cuối ca trước của cùng tài khoản
    const mismatch = a.opening !== null && prevC !== null && Number(a.opening) !== Number(prevC);
    const late = Number(a.late_in || 0) - Number(a.late_out || 0);
    const autoOpen = !lock && prevC !== null && (a.opening === null || Number(a.opening) === Number(prevC));   // bước 62: chỉ cần nhập số dư cuối
    return html`<div class="ck-acc" data-acc="${a.account_id}" data-late="${late}">
      <div class="ck-accn"><strong>${a.bank} ${a.account_no}</strong>${a.label ? html` <span class="st-meta">· ${a.label}</span>` : ''}${a.active ? '' : html` <span class="pill mute">Ngừng dùng</span>`}</div>
      <div class="ck-grid">
        ${autoOpen ? html`<div class="pc-f"><span>Số dư đầu ca</span><div class="ck-oa"><b class="ck-ov">${vnd(prevC)}</b> <button type="button" class="btn sm secondary ck-oe">Sửa</button></div>
          <input class="input sm money ck-open" inputmode="numeric" autocomplete="off" value="${fmt(prevC)}" data-auto="1" hidden aria-label="Số dư đầu ca">
          <span class="st-meta ck-osrc">= số dư cuối ca trước (${a.prev.shift} ${dmy(a.prev.work_date)})</span></div>`
        : html`<label class="pc-f"><span>Số dư đầu ca</span>${money('ck-open' + (sgOpen ? ' st-sg' : ''), sgOpen ? prevC : a.opening, lock, sgOpen ? 'title="Gợi ý = số dư cuối ca trước"' : '')}
          ${a.prev ? html`<span class="st-meta">Cuối ca trước (${a.prev.shift} ${dmy(a.prev.work_date)}): ${vnd(prevC)}</span>` : html`<span class="st-meta">Chưa có ca trước — nhập số dư ban đầu.</span>`}
          ${mismatch ? html`<span class="pill warn" style="align-self:flex-start">Khác số dư cuối ca trước ${signed(Number(a.opening) - Number(prevC))}</span>` : ''}</label>`}
        <label class="pc-f"><span>Số dư cuối ca</span>${money('ck-close', a.closing, lock)}</label>
        <label class="pc-f"><span>Tiền chuyển ra trong ca</span>${money('ck-out', a.transfers_out ?? 0, lock)}<span class="st-meta">Không có thì để 0.</span></label>
        <label class="pc-f"><span>Ghi chú</span><input class="input sm ck-note" value="${a.note || ''}" ${lock ? 'disabled' : ''} placeholder="Không bắt buộc"></label>
      </div>
      ${late ? html`<div class="st-meta">Tiền về chậm: ${a.late_in ? html`+${vnd(a.late_in)} (của ca này, về sau) ` : ''}${a.late_out ? html`−${vnd(a.late_out)} (của ca trước, về trong ca này)` : ''}</div>` : ''}
      <div class="ck-ares st-meta"></div>
    </div>`;
  };
  const shiftNames = [...new Set(rows.map((x) => x.shift))];
  const lateBox = (r, s) => html`<details class="ck-late" ${(r.late || []).length ? 'open' : ''}><summary>Tiền về chậm${(r.late || []).length ? ` (${r.late.length})` : ''}</summary>
    <div class="stack" style="gap:6px;margin-top:6px">
      ${(r.late || []).map((l) => html`<div class="pc-line"><span class="grow">${l.dir === 'in' ? html`<strong>+${vnd(l.amount)}</strong> của ca này, tiền về ở <strong>${l.other}</strong>` : html`<strong>−${vnd(l.amount)}</strong> thuộc <strong>${l.other}</strong>, tiền về trong ca này`} · ${l.account}${l.note ? ` · ${l.note}` : ''} <span class="st-meta">${l.by || ''}</span></span>
        ${r.locked ? '' : html`<button type="button" class="btn sm secondary danger ck-late-del" data-id="${l.id}">Xóa</button>`}</div>`)}
      ${r.locked ? '' : html`<div class="st-meta">Tiền về tài khoản trong ca ${s.shift} này nhưng là của ca trước: ghi lại để cộng vào ca gốc và trừ khỏi ca này.</div>
        <div class="ck-lf"><select class="input sm ck-l-acc" aria-label="Tài khoản">${r.accounts.map((a) => html`<option value="${a.account_id}">${a.bank} ${a.account_no}</option>`)}</select>
          <input class="input sm ck-l-date" type="date" value="${addDays(day, -1)}" aria-label="Ngày của ca gốc">
          <select class="input sm ck-l-shift" aria-label="Ca gốc">${shiftNames.map((x) => html`<option>${x}</option>`)}</select>
          <input class="input sm money ck-l-amt" inputmode="numeric" placeholder="Số tiền" aria-label="Số tiền">
          <input class="input sm ck-l-note" placeholder="Ghi chú" aria-label="Ghi chú">
          <button type="button" class="btn sm secondary ck-late-add">+ Ghi tiền về chậm</button></div>`}
    </div></details>`;

  const shiftCard = (s) => {
    const r = s.row;
    if (!r) return html`<div class="ck-row ck-none"><strong>Ca ${s.shift}</strong> <span class="st-meta">Chưa có phiếu chốt ca — chưa nhập được (khoảng thời gian lấy từ phiếu).</span></div>`;
    const lock = r.locked;
    return html`<div class="ck-row" data-report="${r.report_id}" data-pt="${r.pos_transfer ?? ''}" data-rt="${r.reported_transfer ?? ''}">
      <div class="ck-head"><strong>Ca ${s.shift}</strong>
        <span class="st-meta">${r.rev_start ? dt(r.rev_start) : '?'} → ${r.rev_end ? dt(r.rev_end) : '?'}</span>
        ${lock ? html`<span class="pill ok">Đã đối soát — khóa</span>` : r.recon_status === 'mo_lai' ? html`<span class="pill warn">Đang đối soát lại</span>` : r.status !== 'hoan_thanh' ? html`<span class="pill mute">Nhân viên đang chốt</span>` : ''}
        <a class="st-meta" href="#/ca/phieu?id=${r.report_id}" style="margin-left:auto">Mở phiếu ca</a></div>
      ${r.accounts.length ? r.accounts.map((a) => accRow(a, lock)) : html`<div class="st-meta">Chi nhánh chưa có tài khoản nhận tiền — thêm ở <a href="#/cai-dat/tai-khoan">Cài đặt › Tài khoản ngân hàng</a>.</div>`}
      ${r.accounts.length ? lateBox(r, s) : ''}
      <div class="ck-res"></div>
      ${lock || !r.accounts.length ? '' : html`<div class="toolbar"><button type="button" class="btn sm ck-save">Lưu ca ${s.shift}</button>${r.updated_at ? html`<span class="st-meta">Sửa lần cuối: ${r.updated_by || ''} · ${dt(r.updated_at)}</span>` : ''}</div>`}
    </div>`;
  };

  return {
    title: 'Chuyển khoản thực nhận',
    html: html`<style>
        .ck-row { border: 1px solid var(--line); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .ck-none { background: var(--line-soft); }
        .ck-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .ck-acc { background: var(--subtle); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .ck-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
        .ck-res { font-size: 14px; }
        .st-sg { background: #fef9c3; }
        .pc-f { display: flex; flex-direction: column; gap: 4px; font-size: 14px; min-width: 0; }
        details.ck-late > summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--primary); }
        .ck-oa { display: flex; gap: 8px; align-items: center; min-height: 34px; } .ck-ov { font-size: 15px; font-variant-numeric: tabular-nums; }
        .ck-lf { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; }
      ${WEEK_CSS}</style>
      <div class="page-head"><div><h1>Chuyển khoản thực nhận</h1><div class="sub"><strong>Chỉ cần nhập Số dư cuối ca</strong> của từng tài khoản — số dư đầu tự lấy bằng số dư cuối ca trước (gõ số cuối ca Sáng là ca Chiều tự cập nhật). Nhập xong cả ngày bấm <strong>Lưu cả ngày</strong>. Tiền nhận trong ca = Số dư cuối − Số dư đầu + Tiền chuyển ra.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        ${noAcc.length ? html`<div class="alert warn">${noAcc.map((b) => b.code).join(', ')} chưa có tài khoản nhận tiền — thêm ở <a href="#/cai-dat/tai-khoan">Cài đặt › Tài khoản ngân hàng</a>.</div>` : ''}
        <section class="card toolbar" style="padding:12px 14px;gap:8px">${viewTabs(day, false)}
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${addDays(day, -1)}">‹ Hôm trước</a>
          <input class="input sm" type="date" id="ck-day" value="${day}" aria-label="Ngày">
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${addDays(day, 1)}">Hôm sau ›</a>
          <strong>${dayName(day)} ${dmy(day)}</strong>
          <button type="button" class="btn sm" id="ck-save-all" style="margin-left:auto">Lưu cả ngày</button><span class="st-meta" id="ck-dirty"></span></section>
        <div class="alert warn" style="font-size:13px">Đang chờ chủ hệ thống chốt: cách xử lý khi sửa số dư một ca cũ (ảnh hưởng các ca sau) và khi tiền về chậm. Web chỉ <strong>cảnh báo</strong> khi số dư đầu khác số dư cuối ca trước, không tự sửa ca nào.</div>
        ${byBranch.map((b) => html`<section class="card stack" style="gap:10px"><h2 style="margin:0">${b.code} – ${b.name}</h2>${b.shifts.map(shiftCard)}</section>`)}
      </div>`,
    mount() {
      $('#ck-day').addEventListener('change', (e) => { location.hash = '#/ke-toan/chuyen-khoan?ngay=' + e.target.value; });
      // ---- Tiền về chậm
      $$('.ck-late-add').forEach((b) => b.addEventListener('click', async () => {
        const row = b.closest('.ck-row'); const f = b.closest('.ck-lf');
        b.disabled = true;
        try {
          await rpc('app_kt_late_add', { p_arrived: Number(row.dataset.report), p_account: Number(f.querySelector('.ck-l-acc').value), p_origin_date: f.querySelector('.ck-l-date').value,
            p_origin_shift: f.querySelector('.ck-l-shift').value, p_amount: parseMoney(f.querySelector('.ck-l-amt').value), p_note: f.querySelector('.ck-l-note').value });
          flash('Đã ghi tiền về chậm: cộng vào ca gốc, trừ khỏi ca này.'); rerender();
        } catch (e) { showSaved(e.message, true); b.disabled = false; }
      }));
      $$('.ck-late-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa dòng tiền về chậm này?')) return;
        try { await rpc('app_kt_late_del', { p_id: Number(b.dataset.id) }); flash('Đã xóa.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      // ---- Số dư theo ca
      $$('.ck-row[data-report]').forEach((row) => {
        bindMoneyInputs(row);
        const calc = () => {
          let tot = 0; let any = false; let all = true;
          row.querySelectorAll('.ck-acc').forEach((acc) => {
            const o = parseMoney(acc.querySelector('.ck-open').value); const c = parseMoney(acc.querySelector('.ck-close').value); const out = parseMoney(acc.querySelector('.ck-out').value) || 0;
            const got = o === null || c === null ? null : c - o + out + Number(acc.dataset.late || 0);
            acc.querySelector('.ck-ares').textContent = got === null ? 'Nhập số dư đầu và cuối để tính.' : `Nhận vào tài khoản này: ${fmt(got)}đ`;
            if (got === null) all = false; else { any = true; tot += got; }
          });
          const res = row.querySelector('.ck-res');
          if (!row.querySelector('.ck-acc')) { res.innerHTML = ''; return; }
          const pt = row.dataset.pt === '' ? null : Number(row.dataset.pt); const rt = row.dataset.rt === '' ? null : Number(row.dataset.rt);
          res.innerHTML = !any ? '<span class="st-meta">Nhập số dư đầu và cuối để tính tiền nhận trong ca.</span>'
            : `<strong>Tiền nhận trong ca: ${fmt(tot)}đ</strong>${all ? '' : ' <span class="pill warn">còn tài khoản chưa nhập</span>'}`
              + (pt !== null ? ` · <span class="st-meta">so với CK theo POS (${fmt(pt)}đ): ${signed(tot - pt)}</span>` : '')
              + (rt !== null ? ` · <span class="st-meta">so với CK nhân viên cộng hotline (${fmt(rt)}đ): ${signed(tot - rt)}</span>` : '');
        };
        row._calc = calc;
        row.addEventListener('input', (e) => {
          e.target.classList.remove('st-sg'); calc(); markDirty(row);
          if (e.target.classList.contains('ck-close')) chainNext(row, e.target.closest('.ck-acc'));
        });
        calc();
        row.querySelectorAll('.ck-oe').forEach((b) => b.addEventListener('click', () => {
          const acc = b.closest('.ck-acc'); const inp = acc.querySelector('.ck-open');
          inp.hidden = false; inp.dataset.auto = '0'; b.closest('.ck-oa').hidden = true; acc.querySelector('.ck-osrc').hidden = true; inp.focus();
        }));
        row.querySelector('.ck-save')?.addEventListener('click', async (ev) => {
          ev.target.disabled = true;
          try { await saveRow(row); showSaved('Đã lưu · ' + hhmm()); } catch (e) { showSaved(e.message, true); }
          ev.target.disabled = false;
        });
      });
      // ---- bước 62: số dư đầu ca sau tự theo số dư cuối ca trước (cùng tài khoản, cùng cơ sở); lưu cả ngày
      function markDirty(row) { if (row) row.dataset.dirty = '1'; const n = $$('.ck-row[data-dirty="1"]').length; $('#ck-dirty').textContent = n ? `${n} ca chưa lưu` : ''; }
      function chainNext(row, acc) {
        const rows = [...row.closest('section').querySelectorAll('.ck-row[data-report]')]; const nx = rows[rows.indexOf(row) + 1]; if (!nx) return;
        const inp = nx.querySelector(`.ck-acc[data-acc="${acc.dataset.acc}"] .ck-open[data-auto="1"]`); if (!inp) return;
        const v = parseMoney(acc.querySelector('.ck-close').value); if (v === null) return;
        inp.value = fmt(v); const ov = inp.closest('.ck-acc').querySelector('.ck-ov'); if (ov) ov.textContent = fmt(v) + 'đ';
        const src = inp.closest('.ck-acc').querySelector('.ck-osrc'); if (src) src.textContent = '= số dư cuối ca trước (vừa nhập)';
        nx._calc?.(); markDirty(nx);
      }
      async function saveRow(row) {
        const items = [...row.querySelectorAll('.ck-acc')].map((acc) => ({
          account_id: Number(acc.dataset.acc), opening: parseMoney(acc.querySelector('.ck-open').value), closing: parseMoney(acc.querySelector('.ck-close').value),
          transfers_out: parseMoney(acc.querySelector('.ck-out').value) || 0, note: acc.querySelector('.ck-note').value }));
        await rpc('app_kt_bank_save_accounts', { p_report: Number(row.dataset.report), p_rows: items });
        delete row.dataset.dirty; markDirty(null);
      }
      $('#ck-save-all').addEventListener('click', async (ev) => {
        const rows = $$('.ck-row[data-dirty="1"]').filter((r) => r.querySelector('.ck-save'));
        if (!rows.length) { showSaved('Chưa có ca nào sửa.', true); return; }
        ev.target.disabled = true; let ok = 0; const bad = [];
        for (const r of rows) { try { await saveRow(r); ok++; } catch (e) { bad.push(`${r.querySelector('.ck-head strong').innerText}: ${e.message}`); } }
        ev.target.disabled = false;
        if (bad.length) showSaved(`Đã lưu ${ok} ca · lỗi: ${bad.join(' | ')}`, true); else showSaved(`Đã lưu cả ngày (${ok} ca) · ${hhmm()}`);
      });
    },
  };
}
