// Kế toán · Chuyển khoản thực nhận
//  Bước 100 (anh Tiến chốt 15/11/2026): BẢNG TUẦN CỦA 1 CƠ SỞ (bỏ cách xem theo ngày riêng).
//   * Chọn cơ sở + tuần. Cột = 7 ngày + Cả tuần; hàng = từng ca (dòng giờ đóng ca trên Fabi) → từng tài khoản (ô số dư lúc đóng ca) → Thực nhận ca;
//     dòng cuối Thực nhận cả ngày. Thực nhận = cuối − đầu + chuyển ra ± tiền về chậm. Không báo khớp / lệch (so ở Đối soát).
//   * KHÔNG thay đổi số đã kê khai: số dư đầu chỉ tự điền cho ca CHƯA nhập gì (= số dư lúc đóng ca trước); ca đã có số giữ nguyên, chỉ nhắc
//     "khác cuối ca trước". Tự lưu đúng phiếu ca vừa sửa, không lưu lan sang ca khác.
//   * Nút ⋯ từng ô: số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm. Khoá khi quản lý HOÀN THÀNH ĐỐI SOÁT ca.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, parseMoney, signed, vnd } from '../tien.js';
import { $, $$, dialog, flash, hhmm, html, showSaved, str } from '../ui.js';

export const perm = 'ke_toan';

const money = (cls, v, dis) => html`<input class="input sm money ${cls}" inputmode="numeric" autocomplete="off" placeholder="gõ số dư" value="${v === null || v === undefined ? '' : fmt(v)}" ${dis ? 'disabled' : ''}>`;
export const accName = (a) => `${a.bank} ${a.account_no}${a.label ? ' · ' + a.label : ''}`;
export const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const mondayOf = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, w === 0 ? -6 : 1 - w); };
const LS = 'ckBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS, String(v)); } catch (_) { /* bỏ qua */ } };
const hm = (s) => (s ? String(s).slice(11, 16) : '');

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const mon = mondayOf(day); const days = [...Array(7)].map((_, i) => addDays(mon, i));
  const [all, FB] = await Promise.all([Promise.all(days.map((d) => rpc('app_kt_bank_day', { p_date: d }))),
    rpc('app_fabi_list', { p_from: days[0], p_to: days[6] }).catch(() => null)]);
  const branches = []; all.forEach((rows) => rows.forEach((r) => { if (!branches.some((b) => b.id === r.branch_id)) branches.push({ id: r.branch_id, code: r.branch_code, name: r.branch_name }); }));
  if (!branches.length) return { title: 'Chuyển khoản thực nhận', html: html`<div class="page-head"><h1>Chuyển khoản thực nhận</h1></div><div class="card">Chưa có cơ sở nào.</div>` };
  const has = (v) => branches.some((b) => String(b.id) === String(v));
  const cn = has(params.cn) ? Number(params.cn) : has(lsGet()) ? lsGet() : branches[0].id; lsSet(cn);
  const BR = branches.find((b) => b.id === cn);
  const fbBy = new Map(((FB && FB.files) || []).filter((f) => f.report_id).map((f) => [f.report_id, f]));
  const shifts = []; all.forEach((rows) => rows.filter((r) => r.branch_id === cn).forEach((r) => { if (!shifts.includes(r.shift)) shifts.push(r.shift); }));
  const get = (i, sh) => (all[i] || []).find((r) => r.branch_id === cn && r.shift === sh) || null;
  const q = (o) => '#/ke-toan/chuyen-khoan?' + Object.entries({ cn, ngay: day, ...o }).map(([k, v]) => `${k}=${v}`).join('&');

  // trạng thái từng ô (phiếu ca × tài khoản); ORDER = các phiếu ca theo thời gian (để điền số dư đầu cho ca sau)
  const S = new Map(); const ROW = new Map(); const ORDER = []; const accMap = new Map();
  days.forEach((d, i) => shifts.forEach((sh) => {
    const x = get(i, sh); const r = x && x.row; if (!r) return;
    ROW.set(r.report_id, { ...r, shift: sh, work_date: d }); ORDER.push(r.report_id);
    (r.accounts || []).forEach((a) => {
      if (!accMap.has(a.account_id)) accMap.set(a.account_id, a);
      const prevC = a.prev ? a.prev.closing : null; const saved = a.opening !== null || a.closing !== null;
      S.set(`${r.report_id}|${a.account_id}`, { report: r.report_id, acc: a.account_id, a, saved, opening: a.opening ?? (!saved && prevC !== null ? prevC : null), closing: a.closing,
        out: Number(a.transfers_out || 0), note: a.note || '', prevC, prev: a.prev, late: Number(a.late_in || 0) - Number(a.late_out || 0), lock: !!r.locked });
    });
  }));
  const ACC = [...accMap.values()];
  const tot = (rid) => { const L = [...S.values()].filter((x) => x.report === rid); const g = L.filter((x) => x.closing !== null && x.opening !== null);
    return { n: L.length, got: g.length, v: g.reduce((t, x) => t + Number(x.closing) - Number(x.opening) + x.out + x.late, 0) }; };

  const today = vnToday();
  const headDays = html`${days.map((d) => html`<th class="ckw-d ${d === today ? 'today' : ''}">${DOW[new Date(d + 'T00:00:00Z').getUTCDay()]}<small>${dmy(d).slice(0, 5)}${d === today ? ' · hôm nay' : ''}</small></th>`)}<th class="ckw-d">Cả tuần</th>`;
  const caRow = (sh) => html`<tr class="ckw-ca"><th class="ckw-l">Ca ${sh}</th>${days.map((d, i) => {
    const x = get(i, sh); const r = x && x.row; const f = r && fbBy.get(r.report_id);
    return html`<td>${!r ? '—' : f && f.close_at ? html`đóng <b>${hm(f.close_at)}</b>` : r.rev_end ? html`đóng ${hm(r.rev_end)} <span class="ckw-tp">(phiếu)</span>` : 'chưa có giờ'}${r && r.locked ? html`<span class="ckw-tp">🔒 đã đối soát</span>` : ''}</td>`; })}<td></td></tr>`;
  const accRow = (sh, a) => html`<tr><th class="ckw-l ckw-acc"><b>${a.bank} …${String(a.account_no).slice(-4)}</b>${a.label ? html`<span>${a.label}</span>` : ''}</th>${days.map((d, i) => {
    const x = get(i, sh); const st = x && x.row && S.get(`${x.row.report_id}|${a.account_id}`);
    if (!st) return html`<td class="ckw-na">${x && x.row ? '—' : 'chưa có ca'}</td>`;
    return html`<td class="ckw-c" data-k="${st.report}|${st.acc}"><div class="ckw-in">${money('ckw-close', st.closing, st.lock)}<button type="button" class="ckw-more" aria-label="Số dư đầu, chuyển ra, ghi chú, tiền về chậm" title="Số dư đầu, chuyển ra, ghi chú, tiền về chậm">⋯</button></div><div class="ckw-o"></div></td>`; })}<td></td></tr>`;
  const sumRow = (sh) => html`<tr class="ckw-tn"><th class="ckw-l">Thực nhận ca ${sh}</th>${days.map((d, i) => { const x = get(i, sh); return html`<td class="ckw-t" data-r="${x && x.row ? x.row.report_id : ''}" data-sh="${sh}" data-i="${i}">—</td>`; })}<td class="ckw-t ckw-wk" data-sh="${sh}">—</td></tr>`;

  return {
    title: `Chuyển khoản thực nhận ${BR.code}`,
    html: html`<style>${CKW_CSS}</style>
      <div class="page-head"><div><h1>Chuyển khoản thực nhận</h1><div class="sub">Chọn cơ sở · gõ <b>số dư của từng tài khoản lúc đóng ca trên Fabi</b> · web tự tính <b>Thực nhận</b> từng ca, từng ngày, cả tuần và <b>tự lưu</b>. Số dư đầu ca tự điền bằng số dư lúc đóng ca trước (chỉ với ca chưa nhập). Bấm <b>⋯</b> để sửa số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <section class="card ckw-bar">
        <nav class="branch-tabs" aria-label="Cơ sở">${branches.map((b) => html`<a class="${b.id === cn ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav>
        <div class="ckw-nav"><a class="btn sm secondary" href="${q({ ngay: addDays(mon, -7) })}">‹ Tuần trước</a><strong>${dmy(days[0]).slice(0, 5)} – ${dmy(days[6])}</strong>
          <a class="btn sm secondary" href="${q({ ngay: addDays(mon, 7) })}">Tuần sau ›</a>${mon !== mondayOf(today) ? html`<a class="btn sm secondary" href="${q({ ngay: today })}">Tuần này</a>` : ''}</div></section>
      <section class="card stack" style="gap:8px"><h2 style="margin:0">${BR.code} – ${BR.name}</h2>
        ${ACC.length ? html`<div class="ckw-wrap"><table class="ckw"><thead><tr><th class="ckw-l">${BR.code} · Tài khoản</th>${headDays}</tr></thead>
          <tbody>${shifts.map((sh) => html`${caRow(sh)}${ACC.map((a) => accRow(sh, a))}${sumRow(sh)}`)}
            <tr class="ckw-all"><th class="ckw-l">Thực nhận cả ngày</th>${days.map((d, i) => html`<td class="ckw-t" data-day="${i}">—</td>`)}<td class="ckw-t" data-day="wk">—</td></tr></tbody></table></div>
          <div class="st-meta">⋯ trong ô: số dư đầu, tiền chuyển ra, ghi chú, tiền về chậm (chấm cam = có dùng). Bảng không báo khớp / lệch — quản lý so ở Đối soát ca.</div>`
        : html`<div class="st-meta">Cơ sở này chưa có tài khoản nhận tiền (hoặc tuần này chưa có phiếu ca) — thêm tài khoản ở <a href="#/cai-dat/tai-khoan">Cài đặt › Tài khoản ngân hàng</a>.</div>`}</section>`,
    mount() {
      bindMoneyInputs($('#root') || document.body);
      paint();
      $$('.ckw-c').forEach((td) => {
        const st = S.get(td.dataset.k); const inp = td.querySelector('.ckw-close'); const r = ROW.get(st.report);
        inp.setAttribute('aria-label', `Số dư ${st.a.bank} ${st.a.account_no} lúc đóng ca ${r.shift} ${dmy(r.work_date)}`);
        inp.addEventListener('input', () => { st.closing = parseMoney(inp.value); fillNext(st); paint(); });
        inp.addEventListener('change', () => { st.closing = parseMoney(inp.value); fillNext(st); paint(); save(st.report); });
        td.querySelector('.ckw-more').addEventListener('click', () => more(st));
      });
    },
  };

  // số dư đầu ca sau (cùng tài khoản) chỉ tự điền khi ca sau CHƯA kê khai gì — không đổi số đã nhập, không lưu ca sau
  function fillNext(st) {
    const nx = ORDER[ORDER.indexOf(st.report) + 1]; const ns = nx && S.get(`${nx}|${st.acc}`);
    if (!ns) return;
    ns.prevC = st.closing;   // ca đã kê khai: chỉ để nhắc "khác cuối ca trước", không đổi số
    if (!ns.saved) ns.opening = st.closing;
  }
  function paint() {
    $$('.ckw-c').forEach((td) => {
      const st = S.get(td.dataset.k);
      const mm = st.saved && st.opening !== null && st.prevC !== null && Number(st.opening) !== Number(st.prevC);
      td.querySelector('.ckw-o').innerHTML = str(html`${st.opening === null ? html`<span class="ckw-warn">chưa có số dư đầu — bấm ⋯</span>` : html`đầu ${fmt(st.opening)}`}${st.out ? html` · ra ${fmt(st.out)}` : ''}${st.late ? html` · chậm ${signed(st.late)}` : ''}${mm ? html`<span class="ckw-warn">khác cuối ca trước (${fmt(st.prevC)})</span>` : ''}`);
      td.querySelector('.ckw-more').classList.toggle('dot', !!(st.out || st.note || st.late || mm));
    });
    const dayT = days.map(() => ({ v: 0, any: false })); const wk = { v: 0, any: false }; const shT = {};
    $$('.ckw-t[data-r]').forEach((td) => {
      const sh = td.dataset.sh; shT[sh] = shT[sh] || { v: 0, any: false };
      if (!td.dataset.r) { td.innerHTML = '<span class="st-meta">—</span>'; return; }
      const t = tot(Number(td.dataset.r));
      if (!t.got) { td.innerHTML = t.n ? '<span class="ckw-tag">chưa nhập</span>' : '<span class="st-meta">—</span>'; return; }
      td.innerHTML = str(html`<b>${fmt(t.v)}</b>${t.got < t.n ? html`<span class="ckw-warn">còn ${t.n - t.got} TK</span>` : ''}`);
      const i = Number(td.dataset.i); dayT[i].v += t.v; dayT[i].any = true; shT[sh].v += t.v; shT[sh].any = true; wk.v += t.v; wk.any = true;
    });
    $$('.ckw-wk[data-sh]').forEach((td) => { const x = shT[td.dataset.sh]; td.innerHTML = x && x.any ? str(html`<b>${fmt(x.v)}</b>`) : '<span class="st-meta">—</span>'; });
    $$('.ckw-t[data-day]').forEach((td) => { const x = td.dataset.day === 'wk' ? wk : dayT[Number(td.dataset.day)]; td.innerHTML = x.any ? str(html`<b>${fmt(x.v)}</b>`) : '—'; });
  }
  // tự lưu đúng phiếu ca vừa sửa (lần lượt, không chồng nhau)
  function save(rid) {
    const r = ROW.get(rid); if (!r || r.locked) return Promise.resolve();
    r._q = (r._q || Promise.resolve()).then(async () => {
      const L = [...S.values()].filter((x) => x.report === rid);
      const items = L.map((x) => ({ account_id: x.acc, opening: x.opening, closing: x.closing, transfers_out: x.out || 0, note: x.note }));
      try { await rpc('app_kt_bank_save_accounts', { p_report: rid, p_rows: items }); L.forEach((x) => { if (x.opening !== null || x.closing !== null) x.saved = true; }); showSaved(`Đã lưu ca ${r.shift} ${dmy(r.work_date).slice(0, 5)} · ${hhmm()}`); }
      catch (e) { showSaved(`Ca ${r.shift} ${dmy(r.work_date).slice(0, 5)}: ${e.message}`, true); }
    });
    return r._q;
  }
  // hộp ⋯: số dư đầu, chuyển ra, ghi chú, tiền về chậm
  function more(st) {
    const r = ROW.get(st.report); const a = st.a; const late = r.late || []; const lock = st.lock;
    const d = dialog(html`<form class="stack" style="gap:12px;width:min(460px, calc(100vw - 56px))"><h2 style="margin:0">${a.bank} ${a.account_no} · ca ${r.shift} ${dmy(r.work_date)}</h2>
      <label class="field"><span>Số dư đầu ca</span>${money('m-open', st.opening, lock)}
        <span class="st-meta">${st.prev ? `Số dư lúc đóng ca trước (${st.prev.shift} ${dmy(st.prev.work_date)}): ${vnd(st.prev.closing)}` : 'Chưa có ca trước — nhập số dư ban đầu.'}</span></label>
      <label class="field"><span>Tiền chuyển ra trong ca</span>${money('m-out', st.out, lock)}<span class="st-meta">Không có thì để 0.</span></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${st.note}" ${lock ? 'disabled' : ''} placeholder="Không bắt buộc" autocomplete="off"></label>
      <details class="ckw-late" ${late.length ? 'open' : ''}><summary>Tiền về chậm (${late.length})</summary><div class="stack" style="gap:6px;margin-top:6px">
        ${late.map((l) => html`<div class="pc-line"><span class="grow">${l.dir === 'in' ? html`<b>+${vnd(l.amount)}</b> của ca này, về ở <b>${l.other}</b>` : html`<b>−${vnd(l.amount)}</b> thuộc <b>${l.other}</b>, về trong ca này`} · ${l.account}${l.note ? ' · ' + l.note : ''}</span>
          ${lock ? '' : html`<button type="button" class="btn sm secondary danger m-ldel" data-id="${l.id}">Xoá</button>`}</div>`)}
        ${lock ? '' : html`<div class="st-meta">Tiền về tài khoản này trong ca ${r.shift} nhưng là của ca trước: ghi lại để cộng vào ca gốc và trừ khỏi ca này.</div>
          <div class="ckw-lf"><input class="input sm m-ldate" type="date" value="${addDays(r.work_date, -1)}" aria-label="Ngày của ca gốc"><select class="input sm m-lshift" aria-label="Ca gốc">${shifts.map((x) => html`<option>${x}</option>`)}</select>
            <input class="input sm money m-lamt" inputmode="numeric" placeholder="Số tiền" aria-label="Số tiền"><input class="input sm m-lnote" placeholder="Ghi chú" aria-label="Ghi chú">
            <button type="button" class="btn sm secondary m-ladd">+ Ghi tiền về chậm</button></div>`}</div></details>
      <div class="m-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button>${lock ? '' : html`<button class="btn sm" type="submit">Lưu</button>`}</div></form>`);
    bindMoneyInputs(d); const f = d.querySelector('form'); const err = (e) => { d.querySelector('.m-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); };
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      st.opening = parseMoney(f.querySelector('.m-open').value); st.out = parseMoney(f.querySelector('.m-out').value) || 0; st.note = f.note.value.trim();
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

const CKW_CSS = `
  .ckw-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: space-between; padding: 12px 14px; }
  .ckw-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .ckw-wrap { overflow-x: auto; }
  .ckw { border-collapse: collapse; width: 100%; min-width: 880px; font-variant-numeric: tabular-nums; font-size: 12.5px; }
  .ckw th, .ckw td { border: 1px solid var(--line); padding: 5px 4px; vertical-align: top; }
  .ckw thead th { background: var(--subtle); text-align: center; }
  .ckw-d small { display: block; font-weight: 500; color: var(--ink-2); } .ckw thead th.today { background: #fde9b8; }
  .ckw .ckw-l { text-align: left; background: var(--subtle); white-space: nowrap; position: sticky; left: 0; z-index: 1; min-width: 104px; }
  .ckw-acc b { display: block; } .ckw-acc span { display: block; font-size: 11px; color: var(--ink-2); font-weight: 500; }
  .ckw-ca .ckw-l { background: #2f3e33; color: #fff; text-transform: uppercase; letter-spacing: .4px; }
  .ckw-ca td { background: #e8eee8; text-align: center; font-size: 12px; color: #44564a; }
  .ckw-tp { display: block; font-size: 11px; color: var(--ink-2); }
  .ckw-c { min-width: 96px; } .ckw-in { display: flex; gap: 1px; align-items: center; } .ckw-in .input { flex: 1 1 auto; min-width: 0; text-align: right; padding-left: 6px; padding-right: 6px; }
  .ckw-more { position: relative; border: 0; background: transparent; font-size: 18px; line-height: 1; padding: 4px 3px; cursor: pointer; color: var(--ink-2); border-radius: 6px; }
  .ckw-more:hover { background: var(--line-soft); }
  .ckw-more.dot::after { content: ''; position: absolute; top: 2px; right: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
  .ckw-o { font-size: 11px; color: var(--ink-2); margin-top: 3px; text-align: right; }
  .ckw-warn { display: block; color: #b45309; font-size: 11px; }
  .ckw-na { background: var(--line-soft); text-align: center; color: var(--ink-2); font-size: 12px; }
  .ckw-tn .ckw-l, .ckw-tn td { background: #f6efe5; font-weight: 800; } .ckw-t { text-align: right; } .ckw-t b { font-size: 14px; }
  .ckw-all .ckw-l, .ckw-all td { background: #2f3e33; color: #fff; font-weight: 800; } .ckw-all td b { color: #fff; }
  .ckw-tag { display: inline-block; background: #fde9b8; color: #7a4a12; border-radius: 6px; padding: 1px 6px; font-size: 11px; font-weight: 700; }
  details.ckw-late > summary { cursor: pointer; font-size: 14px; font-weight: 600; color: var(--primary); }
  .ckw-lf { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; }
`;

// dùng chung với Đối soát › Bảng tuần và Kế toán › File ca Fabi
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
