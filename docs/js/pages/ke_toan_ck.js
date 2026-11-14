// Kế toán · Chuyển khoản thực nhận
//  * Tài khoản nhận tiền: mỗi chi nhánh có thể nhiều tài khoản ngân hàng (thêm / sửa / ngừng dùng / xóa khi chưa có số dư).
//  * Theo từng phiếu ca: nhập số dư đầu / cuối / tiền chuyển ra cho TỪNG tài khoản của chi nhánh.
//    Tiền nhận trong ca = tổng các tài khoản (Số dư cuối − Số dư đầu + Tiền chuyển ra). Khóa khi quản lý HOÀN THÀNH ĐỐI SOÁT.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, signed, vnd } from '../tien.js';
import { $, $$, dialog, flash, hhmm, html, showSaved, str } from '../ui.js';
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

// Bước 99 (anh Tiến chốt 15/11/2026): Theo ngày = BẢNG — mỗi cơ sở 1 bảng, hàng = tài khoản, cột = ca (giờ đóng ca trên Fabi).
//  Kế toán chỉ gõ số dư lúc đóng ca → web tính Thực nhận (cuối − đầu + chuyển ra ± tiền về chậm), tự lưu. Không so khớp / lệch ở đây (để Đối soát).
//  Nút ⋯ từng ô: số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm.
export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  if (params.xem === 'tuan') return renderWeek(day);
  const [rows, accounts, FB] = await Promise.all([rpc('app_kt_bank_day', { p_date: day }), rpc('app_kt_accounts'),
    rpc('app_fabi_list', { p_from: day, p_to: day }).catch(() => null)]);
  const fbBy = new Map(((FB && FB.files) || []).filter((f) => f.report_id).map((f) => [f.report_id, f]));
  const byBranch = [];
  rows.forEach((r) => { let b = byBranch.find((x) => x.id === r.branch_id); if (!b) byBranch.push(b = { id: r.branch_id, code: r.branch_code, name: r.branch_name, shifts: [] }); b.shifts.push(r); });
  const noAcc = byBranch.filter((b) => !accounts.some((a) => a.branch_id === b.id && a.active));
  const hm = (s) => (s ? String(s).slice(11, 16) : '');
  const shiftNames = [...new Set(rows.map((x) => x.shift))];

  // trạng thái từng ô (phiếu ca × tài khoản)
  const S = new Map(); const ROW = new Map(); const NEXT = new Map();
  byBranch.forEach((b) => {
    const withRow = b.shifts.filter((s) => s.row);
    withRow.forEach((s, i) => { ROW.set(s.row.report_id, { ...s.row, shift: s.shift }); if (withRow[i + 1]) NEXT.set(s.row.report_id, withRow[i + 1].row.report_id); });
    withRow.forEach((s) => (s.row.accounts || []).forEach((a) => {
      const prevC = a.prev ? a.prev.closing : null;
      const auto = !s.row.locked && prevC !== null && (a.opening === null || Number(a.opening) === Number(prevC));   // số dư đầu tự = cuối ca trước
      S.set(`${s.row.report_id}|${a.account_id}`, { report: s.row.report_id, acc: a.account_id, a, opening: a.opening ?? (auto ? prevC : null), closing: a.closing,
        out: Number(a.transfers_out || 0), note: a.note || '', auto, prevC, prev: a.prev, late: Number(a.late_in || 0) - Number(a.late_out || 0), lock: !!s.row.locked });
    }));
  });
  const accsOf = (b) => { const m = new Map(); b.shifts.forEach((s) => (s.row?.accounts || []).forEach((a) => { if (!m.has(a.account_id)) m.set(a.account_id, a); })); return [...m.values()]; };

  const colHead = (s) => {
    const r = s.row; const f = r && fbBy.get(r.report_id);
    const t = f && f.close_at ? html`<span class="ckt-t">đóng <b>${hm(f.close_at)}</b></span><span class="ckt-s">Fabi ${hm(f.open_at)} → ${hm(f.close_at)}</span>`
      : r && r.rev_end ? html`<span class="ckt-t">đóng <b>${hm(r.rev_end)}</b></span><span class="ckt-s">(theo phiếu)</span>`
        : html`<span class="ckt-s">${r ? 'chưa có giờ đóng ca' : 'chưa có phiếu ca'}</span>`;
    return html`<th class="ckt-col"><span class="ckt-ca">${s.shift}</span>${t}${r?.locked ? html`<span class="ckt-s">đã đối soát · khoá</span>` : ''}</th>`;
  };
  const cell = (s, a) => {
    const st = s.row && S.get(`${s.row.report_id}|${a.account_id}`);
    if (!st) return html`<td class="ckt-na"><span class="st-meta">—</span></td>`;
    return html`<td class="ckt-c" data-k="${st.report}|${st.acc}"><div class="ckt-in">${money('ckt-close', st.closing, st.lock)}<button type="button" class="ckt-more" aria-label="Số dư đầu, chuyển ra, ghi chú, tiền về chậm" title="Số dư đầu, chuyển ra, ghi chú, tiền về chậm">⋯</button></div><div class="ckt-o"></div></td>`;
  };
  const table = (b) => {
    const A = accsOf(b);
    return html`<section class="card stack" style="gap:8px"><h2 style="margin:0">${b.code} – ${b.name}</h2>
      ${A.length ? html`<div class="ckt-wrap"><table class="ckt"><thead><tr><th class="ckt-h0">Số dư lúc đóng ca Fabi</th>${b.shifts.map(colHead)}</tr></thead>
        <tbody>${A.map((a) => html`<tr><th class="ckt-acc"><b>${a.bank} ${a.account_no}</b>${a.label ? html`<span class="st-meta">${a.label}</span>` : ''}</th>${b.shifts.map((s) => cell(s, a))}</tr>`)}
          <tr class="ckt-sum"><th>Thực nhận</th>${b.shifts.map((s) => html`<td class="ckt-tot" data-r="${s.row ? s.row.report_id : ''}"><span class="st-meta">—</span></td>`)}</tr></tbody></table></div>`
        : html`<div class="st-meta">Chưa có tài khoản nhận tiền — thêm ở <a href="#/cai-dat/tai-khoan">Cài đặt › Tài khoản ngân hàng</a>.</div>`}</section>`;
  };

  return {
    title: 'Chuyển khoản thực nhận',
    html: html`<style>${CKT_CSS}${WEEK_CSS}</style>
      <div class="page-head"><div><h1>Chuyển khoản thực nhận</h1><div class="sub">Gõ <b>số dư của từng tài khoản lúc đóng ca trên Fabi</b> — web tự tính tiền thực nhận và <b>tự lưu</b>. Số dư đầu ca tự bằng số dư lúc đóng ca trước. Bấm <b>⋯</b> để sửa số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        ${noAcc.length ? html`<div class="alert warn">${noAcc.map((b) => b.code).join(', ')} chưa có tài khoản nhận tiền — thêm ở <a href="#/cai-dat/tai-khoan">Cài đặt › Tài khoản ngân hàng</a>.</div>` : ''}
        <section class="card toolbar" style="padding:12px 14px;gap:8px">${viewTabs(day, false)}
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${addDays(day, -1)}">‹ Hôm trước</a>
          <input class="input sm" type="date" id="ck-day" value="${day}" aria-label="Ngày">
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${addDays(day, 1)}">Hôm sau ›</a>
          <strong>${dayName(day)} ${dmy(day)}</strong></section>
        ${byBranch.map(table)}
      </div>`,
    mount() {
      $('#ck-day').addEventListener('change', (e) => { location.hash = '#/ke-toan/chuyen-khoan?ngay=' + e.target.value; });
      bindMoneyInputs($('#root') || document.body);
      paint();
      $$('.ckt-c').forEach((td) => {
        const st = S.get(td.dataset.k); const inp = td.querySelector('.ckt-close');
        inp.setAttribute('aria-label', `Số dư ${st.a.bank} ${st.a.account_no} lúc đóng ca ${ROW.get(st.report).shift}`);
        inp.addEventListener('input', () => { st.closing = parseMoney(inp.value); chain(st); paint(); });
        inp.addEventListener('change', () => { st.closing = parseMoney(inp.value); const nx = chain(st); paint(); save(st.report); if (nx) save(nx); });
        td.querySelector('.ckt-more').addEventListener('click', () => more(st));
      });
    },
  };

  // số dư đầu ca sau (cùng tài khoản) tự theo số dư cuối ca này — trả về phiếu ca sau cần lưu lại (nếu đã có số)
  function chain(st) {
    const nx = NEXT.get(st.report); const ns = nx && S.get(`${nx}|${st.acc}`);
    if (!ns || !ns.auto || st.closing === null) return null;
    ns.opening = st.closing; ns.prevC = st.closing;
    return ns.closing !== null ? nx : null;
  }
  function paint() {
    $$('.ckt-c').forEach((td) => {
      const st = S.get(td.dataset.k);
      const mm = !st.auto && st.opening !== null && st.prevC !== null && Number(st.opening) !== Number(st.prevC);
      td.querySelector('.ckt-o').innerHTML = str(html`${st.opening === null ? html`<span class="ckt-warn">chưa có số dư đầu — bấm ⋯</span>` : html`đầu ${fmt(st.opening)}`}${st.out ? html` · ra ${fmt(st.out)}` : ''}${st.late ? html` · chậm ${signed(st.late)}` : ''}${mm ? html`<span class="ckt-warn">khác cuối ca trước (${fmt(st.prevC)})</span>` : ''}`);
      td.querySelector('.ckt-more').classList.toggle('dot', !!(st.out || st.note || st.late || mm));
    });
    $$('.ckt-tot').forEach((td) => {
      if (!td.dataset.r) return;
      const L = [...S.values()].filter((x) => String(x.report) === td.dataset.r); const got = L.filter((x) => x.closing !== null && x.opening !== null);
      if (!got.length) { td.innerHTML = '<span class="st-meta">chưa nhập</span>'; return; }
      const tot = got.reduce((t, x) => t + Number(x.closing) - Number(x.opening) + x.out + x.late, 0);
      td.innerHTML = str(html`<b>${fmt(tot)}</b>${got.length < L.length ? html`<span class="ckt-warn">còn ${L.length - got.length} tài khoản chưa nhập</span>` : ''}`);
    });
  }
  // tự lưu theo phiếu ca (lần lượt, không chồng nhau)
  function save(rid) {
    const r = ROW.get(rid); if (!r || r.locked) return Promise.resolve();
    r._q = (r._q || Promise.resolve()).then(async () => {
      const items = [...S.values()].filter((x) => x.report === rid).map((x) => ({ account_id: x.acc, opening: x.opening, closing: x.closing, transfers_out: x.out || 0, note: x.note }));
      try { await rpc('app_kt_bank_save_accounts', { p_report: rid, p_rows: items }); showSaved('Đã lưu · ' + hhmm()); } catch (e) { showSaved(`Ca ${r.shift}: ${e.message}`, true); }
    });
    return r._q;
  }
  // hộp ⋯: số dư đầu, chuyển ra, ghi chú, tiền về chậm
  function more(st) {
    const r = ROW.get(st.report); const a = st.a; const late = r.late || []; const lock = st.lock;
    const d = dialog(html`<form class="stack" style="gap:12px;width:min(460px, calc(100vw - 56px))"><h2 style="margin:0">${a.bank} ${a.account_no} · ca ${r.shift} ${dmy(day)}</h2>
      <label class="field"><span>Số dư đầu ca</span>${money('m-open', st.opening, lock)}
        <span class="st-meta">${st.prev ? `Số dư lúc đóng ca trước (${st.prev.shift} ${dmy(st.prev.work_date)}): ${vnd(st.prevC)}` : 'Chưa có ca trước — nhập số dư ban đầu.'}</span></label>
      <label class="field"><span>Tiền chuyển ra trong ca</span>${money('m-out', st.out, lock)}<span class="st-meta">Không có thì để 0.</span></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${st.note}" ${lock ? 'disabled' : ''} placeholder="Không bắt buộc" autocomplete="off"></label>
      <details class="ckt-late" ${late.length ? 'open' : ''}><summary>Tiền về chậm (${late.length})</summary><div class="stack" style="gap:6px;margin-top:6px">
        ${late.map((l) => html`<div class="pc-line"><span class="grow">${l.dir === 'in' ? html`<b>+${vnd(l.amount)}</b> của ca này, về ở <b>${l.other}</b>` : html`<b>−${vnd(l.amount)}</b> thuộc <b>${l.other}</b>, về trong ca này`} · ${l.account}${l.note ? ' · ' + l.note : ''}</span>
          ${lock ? '' : html`<button type="button" class="btn sm secondary danger m-ldel" data-id="${l.id}">Xoá</button>`}</div>`)}
        ${lock ? '' : html`<div class="st-meta">Tiền về tài khoản này trong ca ${r.shift} nhưng là của ca trước: ghi lại để cộng vào ca gốc và trừ khỏi ca này.</div>
          <div class="ckt-lf"><input class="input sm m-ldate" type="date" value="${addDays(day, -1)}" aria-label="Ngày của ca gốc"><select class="input sm m-lshift" aria-label="Ca gốc">${shiftNames.map((x) => html`<option>${x}</option>`)}</select>
            <input class="input sm money m-lamt" inputmode="numeric" placeholder="Số tiền" aria-label="Số tiền"><input class="input sm m-lnote" placeholder="Ghi chú" aria-label="Ghi chú">
            <button type="button" class="btn sm secondary m-ladd">+ Ghi tiền về chậm</button></div>`}</div></details>
      <div class="m-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button>${lock ? '' : html`<button class="btn sm" type="submit">Lưu</button>`}</div></form>`);
    bindMoneyInputs(d); const f = d.querySelector('form'); const err = (e) => { d.querySelector('.m-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); };
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      st.opening = parseMoney(f.querySelector('.m-open').value); st.auto = st.prevC !== null && st.opening === Number(st.prevC);
      st.out = parseMoney(f.querySelector('.m-out').value) || 0; st.note = f.note.value.trim();
      paint(); await save(st.report); d.close();
    });
    d.querySelector('.m-ladd')?.addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try {
        await rpc('app_kt_late_add', { p_arrived: st.report, p_account: st.acc, p_origin_date: f.querySelector('.m-ldate').value, p_origin_shift: f.querySelector('.m-lshift').value,
          p_amount: parseMoney(f.querySelector('.m-lamt').value), p_note: f.querySelector('.m-lnote').value });
        d.close(); flash('Đã ghi tiền về chậm: cộng vào ca gốc, trừ khỏi ca này.'); rerender();
      } catch (e) { ev.target.disabled = false; err(e); }
    });
    d.querySelectorAll('.m-ldel').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Xoá dòng tiền về chậm này?')) return;
      try { await rpc('app_kt_late_del', { p_id: Number(b.dataset.id) }); d.close(); flash('Đã xoá.'); rerender(); } catch (e) { err(e); }
    }));
  }
}

const CKT_CSS = `
  .ckt-wrap { overflow-x: auto; }
  .ckt { border-collapse: collapse; width: 100%; min-width: 540px; font-variant-numeric: tabular-nums; font-size: 14px; }
  .ckt th, .ckt td { border: 1px solid var(--line); padding: 8px; vertical-align: top; }
  .ckt thead th { background: var(--subtle); text-align: left; font-weight: 600; }
  .ckt .ckt-h0, .ckt .ckt-acc, .ckt-sum th { position: sticky; left: 0; z-index: 1; background: var(--subtle); text-align: left; min-width: 120px; }
  .ckt-h0 { font-size: 12px; color: var(--ink-2); }
  .ckt-acc b { display: block; } .ckt-acc .st-meta { display: block; font-size: 12px; }
  .ckt-ca { display: block; font-weight: 800; text-transform: uppercase; } .ckt-t { display: block; font-size: 13px; } .ckt-s { display: block; font-size: 11px; color: var(--ink-2); font-weight: 500; }
  .ckt-c { min-width: 150px; } .ckt-in { display: flex; gap: 2px; align-items: center; } .ckt-in .input { flex: 1 1 auto; min-width: 0; text-align: right; }
  .ckt-more { position: relative; border: 0; background: transparent; font-size: 20px; line-height: 1; padding: 4px 6px; cursor: pointer; color: var(--ink-2); border-radius: 8px; }
  .ckt-more:hover { background: var(--line-soft); }
  .ckt-more.dot::after { content: ''; position: absolute; top: 3px; right: 2px; width: 7px; height: 7px; border-radius: 50%; background: var(--primary); }
  .ckt-o { font-size: 12px; color: var(--ink-2); margin-top: 4px; text-align: right; }
  .ckt-warn { display: block; color: #b45309; font-size: 12px; }
  .ckt-na { background: var(--line-soft); text-align: center; }
  .ckt-sum th, .ckt-sum td { background: var(--subtle); font-weight: 700; } .ckt-tot { text-align: right; } .ckt-tot b { font-size: 16px; }
  details.ckt-late > summary { cursor: pointer; font-size: 14px; font-weight: 600; color: var(--primary); }
  .ckt-lf { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; }
`;
