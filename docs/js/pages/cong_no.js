// Quản lý ca › Công nợ (bước 95, anh Tiến chốt 14/11/2026): tab riêng, theo từng cơ sở.
//  * 3 nhóm: ① Nợ khách hàng (Nợ HĐ + khách ngoài — phiếu chốt ca nhắc thu), ② Nợ kho tổng, ③ Nợ khác (thêm người được). Kho tổng / Nợ khác chỉ quản lý thu.
//  * Mỗi người 1 dòng tổng còn nợ; từng khoản "Nợ ngày … → Trả ngày …" (chưa trả: N ngày, quá 7 ngày ⚠; đã trả hết hiện mờ trong tháng).
//  * Ô tìm tên / SĐT, đếm khách nợ quá 7 ngày. Bấm vào người: còn nợ, thu gộp (trừ khoản cũ nhất trước), lịch sử đã trả, sửa tên / SĐT / nhóm.
//  * Đối soát ca › Thu chi: khoản chi "Thành nợ" (doi_soat_tc.js) → vào đây.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, noKind, parseMoney, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, str } from '../ui.js';
import { bindPeopleSelect, loadPeople, peopleSelect } from '../nguoi_no_chon.js';
import { DEBT_GRP, DEBT_GRP_SHORT, DEBT_GRPS } from '../ca_chung.js';

export const perm = 'doi_soat';
const LS_BR = 'tcBranch';
export const GRP = DEBT_GRP; export const GRP_SHORT = DEBT_GRP_SHORT;   // chặng 6.4: 4 nhóm
const GRP_HELP = { khach: 'gộp một dòng "Khách", mỗi khoản có ghi chú (khách / bàn…) — phiếu chốt ca nhắc thu', kho: 'chỉ quản lý thu',
  chu: 'nợ của anh Tiến — chỉ quản lý thu, không nhắc ở phiếu chốt ca', khac: 'người nhà, người quen… — chỉ quản lý thu' };
const PAY = { tien_mat: 'TM', chuyen_khoan: 'CK', gia_dinh: 'chuyển gia đình' };
const LATE = 7;
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const days = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 864e5));
export const dispName = (r) => `${(r.kind === 'bill' || !r.kind) && !r.by_ql && /^\s*\d+\s*$/.test(r.name || '') ? 'Bàn ' : ''}${(r.name || '').trim()}`;
const keyOf = (r) => (r.grp === 'khach' ? 'khach|khách' : `${r.grp}|${dispName(r).toLowerCase()}`);   // chặng 6.4: nợ khách gộp một dòng

function people(rows, today) {
  const M = new Map();
  rows.forEach((r) => { const k = keyOf(r); if (!M.has(k)) M.set(k, { key: k, grp: r.grp, name: r.grp === 'khach' ? 'Khách' : dispName(r), phone: null, rows: [] }); const p = M.get(k); p.rows.push(r); if (r.phone && r.grp !== 'khach') p.phone = r.phone; });
  return [...M.values()].map((p) => {
    const open = p.rows.filter((r) => !r.closed);
    return { ...p, open, owe: open.reduce((t, r) => t + Number(r.amount), 0), oldest: open.length ? Math.max(...open.map((r) => days(r.date, today))) : 0 };
  });
}

export async function render(ctx) {
  const { params } = ctx;
  let cn = Number(params.cn) || lsGet();
  let D = cn ? await rpc('app_cn_book', { p_branch: cn }).catch(() => null) : null;
  if (!D) {
    const L = await rpc('app_tc_list', { p_branch: null, p_from: '2000-01-01', p_to: '2000-01-01' }).catch(() => ({ branches: [] }));
    for (const b of L.branches || []) { D = await rpc('app_cn_book', { p_branch: b.id }).catch(() => null); if (D) { cn = b.id; break; } }
    if (!D) return { title: 'Công nợ', html: html`<div class="page-head"><h1>Công nợ</h1></div><div class="alert warn">Chỉ Chủ, Quản lý tổng, Quản lý cơ sở dùng tab Công nợ.</div>` };
  }
  lsSet(cn);
  const today = D.today; const month = today.slice(0, 7); const ed = !!D.can_edit;
  const BR = D.branches.find((b) => b.id === cn) || { code: '' };
  const q = (o = {}) => '#/quan-ly/cong-no?' + new URLSearchParams(Object.fromEntries(Object.entries({ cn, ...o }).filter(([, v]) => v !== null && v !== undefined && v !== ''))).toString();
  const P = people(D.rows, today);
  const late = (r) => r.grp === 'khach' && !r.closed && days(r.date, today) > LATE;
  const fromTxt = (r) => (r.report_id ? `ca ${r.shift || ''}` : r.mv_report ? `từ thu chi ca ${r.mv_ca || ''}` : r.gap_report ? `ghi ở đối soát ca ${r.gap_ca || ''}` : 'QL ghi');
  const paidTxt = (r) => `${dmy(r.paid_date).slice(0, 5)}${r.paid_report ? ` ca ${r.paid_shift || ''}` : ' · quản lý thu'} · ${({ tien_mat: 'tiền mặt', chuyen_khoan: 'chuyển khoản' })[r.paid_kind] || PAY[r.paid_kind] || ''}`;
  const line = (r, full = false) => html`<div class="cn-l ${r.closed ? 'done' : ''}">
      <div class="cn-l1"><span>${r.grp === 'khach' ? html`<b class="cn-who">${dispName(r)}</b> · ` : ''}Nợ <b>${dmy(r.date).slice(0, 5)}</b> · ${fromTxt(r)} · ${noKind(r.kind)}${r.split && !r.closed ? ' (phần còn lại)' : ''}</span><b class="cn-amt">${fmt(r.amount)}</b></div>
      <div class="cn-l2">→ ${r.closed ? html`<span class="cn-ok">Trả <b>${paidTxt(r)}</b> ✓</span>` : html`<span class="${late(r) ? 'cn-late' : ''}">chưa trả · ${days(r.date, today) ? `${days(r.date, today)} ngày` : 'hôm nay'}${late(r) ? ' ⚠' : ''}</span>`}
        ${full && r.note ? html`<span class="st-meta"> · ${r.note}</span>` : ''}${full && r.closed && r.paid_note && !['Đã thu', 'Quản lý thu'].includes(r.paid_note) ? html`<span class="st-meta"> · ${r.paid_note}</span>` : ''}
        ${full && r.closed && r.can_unthu && ed ? html` <button type="button" class="btn sm secondary cn-unthu" data-id="${r.id}">Bỏ đã thu</button>` : ''}${full && !r.closed && ed && r.grp === 'khach' ? html` <button type="button" class="btn sm cn-thu1" data-id="${r.id}">Đã thu</button> <button type="button" class="btn sm secondary cn-edit1" data-id="${r.id}">Sửa / đổi nhóm</button>` : ''}</div></div>`;

  // ---------- trang chi tiết 1 người
  if (params.p) {
    const p = P.find((x) => x.key === params.p);
    if (!p) return { title: 'Công nợ', html: html`${STYLE}<div class="page-head"><div><a href="${q()}">‹ Công nợ ${BR.code}</a><h1>Không còn người nợ này</h1></div></div>` };
    const paid = p.rows.filter((r) => r.closed).sort((a, b) => String(b.paid_date).localeCompare(String(a.paid_date)) || b.id - a.id);
    return {
      title: `Công nợ · ${p.name}`,
      html: html`${STYLE}<div class="cn-wrap"><div class="page-head"><div><a href="${q()}" style="font-weight:600">‹ Công nợ ${BR.code}</a>
          <h1 style="margin-top:6px">${p.name}</h1><div class="sub">${GRP_SHORT[p.grp]}${p.phone ? ` · ${p.phone}` : ''}</div></div></div>
        <section class="card stack cn-sum"><div class="cn-big">Còn nợ <b>${vnd(p.owe)}</b></div>
          ${p.open.length ? html`<div class="st-meta">${p.open.length} khoản · ${p.oldest ? `lâu nhất ${p.oldest} ngày` : 'ghi hôm nay'}${p.grp === 'khach' && p.oldest > LATE ? ' ⚠' : ''}</div>` : html`<div class="cn-ok">✓ Đã trả hết</div>`}
          ${ed && p.grp === 'khach' ? html`<div class="cn-btns"><button type="button" class="btn sm secondary" id="cn-more">+ Ghi nợ khách</button></div><div class="st-meta">Khách trả khoản nào thì bấm <b>Đã thu</b> ở đúng khoản đó.</div>` : ''}${ed && p.grp !== 'khach' ? html`<div class="cn-btns">${p.open.length ? html`<button type="button" class="btn sm" id="cn-thu">Đã thu</button>` : ''}<button type="button" class="btn sm secondary" id="cn-more">+ Ghi thêm nợ</button><button type="button" class="btn sm secondary" id="cn-edit">Sửa tên / SĐT / nhóm</button></div>` : ''}</section>
        <section class="card stack"><h2>Còn nợ (${p.open.length})</h2>${p.open.length ? p.open.map((r) => line(r, true)) : html`<div class="st-meta">Không còn khoản nào.</div>`}</section>
        <section class="card stack"><h2>Đã trả (${paid.length})</h2>${paid.length ? paid.map((r) => line(r, true)) : html`<div class="st-meta">Chưa có lần trả nào (180 ngày gần đây).</div>`}</section></div>`,
      mount() {
        bindUnthu();
        $('#cn-thu')?.addEventListener('click', () => collect(p));
        $('#cn-more')?.addEventListener('click', () => (p.grp === 'khach' ? newDebt('khach') : newDebt(p.grp, p)));
        const one = (id) => { const r = p.rows.find((x) => String(x.id) === String(id)); return r && { key: p.key, grp: 'khach', name: dispName(r), phone: r.phone || null, rows: [r], open: [r], owe: Number(r.amount) }; };
        $$('.cn-thu1').forEach((b) => b.addEventListener('click', () => { const o = one(b.dataset.id); if (o) collect(o); }));
        $$('.cn-edit1').forEach((b) => b.addEventListener('click', () => { const o = one(b.dataset.id); if (o) editPerson(o); }));
        $('#cn-edit')?.addEventListener('click', () => editPerson(p));
      },
    };
  }

  // ---------- trang chính (28/11, anh Tiến duyệt hình mẫu): dòng tổng + hàng nút nhóm vuốt ngang; mỗi khoản một dòng; nợ khách có nút Đã thu ngay trên dòng;
  //   khoản đã trả trong tháng gom vào "Đã trả tháng này" (bấm mới mở, có Bỏ đã thu); nhóm trống thu còn một dòng. CHỈ đổi cách bày — số tiền, hàm máy chủ, quyền giữ nguyên.
  const onlyLate = params.qua === '1';
  const gOn = DEBT_GRPS.includes(params.g) ? params.g : '';   // bước 97: bấm nút nhóm → chỉ hiện nhóm đó (?g=), bấm lại → cả 4 nhóm
  const sumOf = (rs) => rs.reduce((t, r) => t + Number(r.amount || 0), 0);
  const gSum = (g) => P.filter((p) => p.grp === g).reduce((t, p) => t + p.owe, 0);
  const inMonth = (r) => r.closed && String(r.paid_date).slice(0, 7) === month;
  const total = P.reduce((t, p) => t + p.owe, 0); const nOpen = D.rows.filter((r) => !r.closed).length;
  const lateRows = D.rows.filter(late); const paidM = D.rows.filter(inMonth);
  const CHIP = { khach: 'Khách', kho: 'Kho tổng', chu: 'Chủ', khac: 'Người nhà / quen' };
  const TITLE = { khach: 'Nợ khách hàng', kho: 'Nợ kho tổng', chu: 'Nợ của Chủ', khac: 'Người nhà / người quen' };
  const ADD = { khach: '+ Ghi nợ khách', kho: '+ Kho tổng nợ', chu: '+ Ghi nợ', khac: '+ Thêm người nợ' };
  const nameOf = (r) => dispName(r) || 'Khách';
  const chip = (g) => html`<a class="cn-k ${gOn === g ? 'on' : ''} ${gSum(g) ? '' : 'zero'}" href="${q({ g: gOn === g ? '' : g, qua: params.qua })}"><span class="k">${CHIP[g]}</span> <b>${fmt(gSum(g))}</b></a>`;
  const khRow = (r) => { const n = days(r.date, today);
    return html`<div class="cn-r" data-s="${nameOf(r).toLowerCase()}">
      <div class="who"><b>${nameOf(r)}</b><small>Nợ ${dmy(r.date).slice(0, 5)} · ${fromTxt(r)} · ${noKind(r.kind)}${r.split ? ' (phần còn lại)' : ''} · <span class="${late(r) ? 'cn-late' : ''}">${n ? `${n} ngày` : 'hôm nay'}${late(r) ? ' ⚠' : ''}</span></small></div>
      <b class="cn-amt">${fmt(r.amount)}</b>${ed ? html`<button type="button" class="btn sm cn-thu1" data-id="${r.id}">Đã thu</button>` : ''}</div>`; };
  const pRow = (p) => html`<div class="cn-p" data-s="${(p.name + ' ' + (p.phone || '')).toLowerCase()}"><a class="cn-ph cn-r" href="${q({ p: p.key })}">
      <span class="who"><b>${p.name}</b>${p.phone ? html` <span class="st-meta">${p.phone}</span>` : ''}<small>${p.open.length} khoản · ${p.oldest ? `lâu nhất ${p.oldest} ngày` : 'ghi hôm nay'}</small></span>
      <b class="cn-amt">${fmt(p.owe)}</b><span class="go">›</span></a></div>`;
  const paidRow = (r) => html`<div class="cn-r paid" data-s="${(nameOf(r) + ' ' + (r.phone || '')).toLowerCase()}">
      <div class="who"><span>${nameOf(r)}</span> <span class="st-meta">· nợ ${dmy(r.date).slice(0, 5)}</span><small class="cn-ok">✓ Trả ${paidTxt(r)}</small></div>
      <span class="cn-amt">${fmt(r.amount)}</span>${r.can_unthu && ed ? html`<button type="button" class="btn sm secondary cn-unthu" data-id="${r.id}">Bỏ đã thu</button>` : ''}</div>`;
  const group = (g) => {
    const rows = D.rows.filter((r) => r.grp === g);
    const open = g === 'khach' ? rows.filter((r) => !r.closed && (!onlyLate || late(r))).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id) : [];
    const ps = g === 'khach' ? [] : P.filter((p) => p.grp === g && p.owe > 0).sort((a, b) => b.oldest - a.oldest || b.owe - a.owe);
    const paid = onlyLate ? [] : rows.filter(inMonth).sort((a, b) => String(b.paid_date).localeCompare(String(a.paid_date)) || b.id - a.id);
    const lim = g === 'khach' ? 5 : paid.length;   // nợ khách: 5 khoản mới nhất, còn lại xem ở trang lịch sử
    const addBtn = ed && !onlyLate ? html`<button type="button" class="btn sm secondary cn-new" data-g="${g}">${ADD[g]}</button>` : '';
    const hist = g === 'khach' && rows.length ? html`<a href="${q({ p: 'khach|khách' })}">Sửa khoản nợ · xem lịch sử ›</a>` : '';
    if (!open.length && !ps.length && !paid.length) return html`<section class="cn-g cn-empty" data-g="${g}"><span><h2>${TITLE[g]}</h2> — ${onlyLate ? 'không có khoản quá hạn' : 'không có ai nợ'}</span><b class="cn-gsum" hidden>${fmt(gSum(g))}</b>${addBtn}</section>`;
    return html`<section class="card stack cn-g" data-g="${g}"><div class="cn-gh"><h2 title="${GRP_HELP[g]}">${TITLE[g]}</h2><b class="cn-gsum">${fmt(gSum(g))}</b></div>
      ${open.map(khRow)}${ps.map(pRow)}${open.length || ps.length ? '' : html`<div class="cn-none st-meta">Không còn ai nợ.</div>`}
      ${paid.length ? html`<details class="cn-paid"><summary>Đã trả tháng này (${paid.length} khoản · ${fmt(sumOf(paid))})</summary>${paid.slice(0, lim).map(paidRow)}${paid.length > lim ? html`<div class="st-meta cn-rest">… còn ${paid.length - lim} khoản nữa — bấm "xem lịch sử" bên dưới</div>` : ''}</details>` : ''}
      ${addBtn || hist ? html`<div class="cn-foot">${addBtn}${hist}</div>` : ''}</section>`; };
  return {
    title: `Công nợ ${BR.code}`,
    html: html`${STYLE}<div class="cn-wrap"><div class="page-head"><div><h1>Công nợ</h1></div></div>
      <nav class="branch-tabs" aria-label="Cơ sở">${D.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${'#/quan-ly/cong-no?cn=' + b.id}" title="${b.name}">${b.code}</a>`)}</nav>
      <div class="cn-top"><div class="cn-big">Còn nợ <b>${fmt(total)}</b> <span class="st-meta">· ${nOpen} khoản</span></div><div class="cn-paidm">Đã thu tháng này <b>${fmt(sumOf(paidM))}</b></div></div>
      <div class="cn-ks"><a class="cn-k tot ${gOn ? '' : 'on'}" href="${q({ qua: params.qua })}"><span class="k">Tất cả</span></a>${DEBT_GRPS.map(chip)}</div>
      ${lateRows.length ? html`<a class="cn-latebox ${onlyLate ? 'on' : ''}" href="${q({ qua: onlyLate ? '' : '1' })}">⚠ Khách nợ quá ${LATE} ngày: <b>${lateRows.length} khoản · ${fmt(sumOf(lateRows))}</b> ${onlyLate ? '— bấm để xem tất cả' : '— bấm để lọc'}</a>` : ''}
      <input class="input" id="cn-find" type="search" placeholder="Tìm tên / số điện thoại…" autocomplete="off">
      ${(onlyLate ? ['khach'] : DEBT_GRPS.filter((g) => !gOn || g === gOn)).map(group)}
      <div class="st-meta">Khách trả ngay trong ca thì nhân viên ghi ở phiếu chốt ca.</div></div>`,
    mount() {
      bindUnthu();
      $('#cn-find').addEventListener('input', (e) => { const s = e.target.value.trim().toLowerCase();
        $$('.cn-wrap [data-s]').forEach((x) => { x.hidden = !!s && !x.dataset.s.includes(s); });
        if (s) $$('.cn-paid').forEach((d) => { d.open = true; }); });
      $$('.cn-new').forEach((b) => b.addEventListener('click', () => newDebt(b.dataset.g)));
      $$('.cn-thu1').forEach((b) => b.addEventListener('click', () => { const r = D.rows.find((x) => String(x.id) === String(b.dataset.id));
        if (r) collect({ key: 'khach|khách', grp: 'khach', name: nameOf(r), phone: r.phone || null, rows: [r], open: [r], owe: Number(r.amount) }); }));
    },
  };

  // ---------- khung thao tác
  function err(dl, e) { dl.querySelector('.cn-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
  function namesOf(g) { return [...new Set(P.filter((p) => p.grp === g).map((p) => p.name))]; }
  function bindUnthu() {
    $$('.cn-unthu').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Bỏ lần thu này? Khoản nợ quay lại "chưa trả", Sổ thu chi bỏ khoản thu.')) return;
      b.disabled = true;
      try { await rpc('app_cn_debt_uncollect', { p_id: Number(b.dataset.id) }); flash('Đã bỏ lần thu.'); rerender(); } catch (e) { b.disabled = false; alert(e.message); }
    }));
  }
  async function newDebt(g, p = null) {
    const people = p ? null : await loadPeople(cn);   // chặng 4 (22/11): chọn người nợ trong danh sách (+ Thêm người nợ…); không lấy được thì giữ ô gõ tên
    const kind0 = g === 'khach' ? 'bill' : 'muon';
    const dl = dialog(html`<form class="stack cn-dlg" style="gap:12px"><h2 style="margin:0">${p ? `Ghi thêm nợ — ${p.name}` : `Ghi nợ — ${BR.code}`}</h2>
      ${p ? '' : html`<div class="pc-line" role="radiogroup" aria-label="Nhóm">${Object.entries(GRP_SHORT).map(([k, l]) => html`<label class="radio-pill"><input type="radio" name="grp" value="${k}" ${k === g ? 'checked' : ''}> ${l}</label>`)}</div>`}
      ${p ? '' : html`<label class="field cn-kh"><span>Khách / bàn (ghi chú)</span><input class="input" name="kname" autocomplete="off" placeholder="vd: khách, bàn 5, áo xanh"></label>`}
      <div class="stack cn-ppl" style="gap:12px">${p ? '' : people ? html`<label class="field"><span>Người nợ</span>${peopleSelect(people, { cur: g === 'kho' && people.some((q) => q.name === 'Kho tổng') ? 'Kho tổng' : '' })}</label>
        <label class="field"><span>Số điện thoại</span><input class="input" name="phone" inputmode="tel" autocomplete="off"></label>`
        : html`<label class="field"><span>Tên người nợ</span><input class="input" name="name" list="cn-names" autocomplete="off" value="${g === 'kho' ? 'Kho tổng' : ''}" placeholder="vd: Anh Thắng, Bàn 5"><datalist id="cn-names"></datalist></label>
        <label class="field"><span>Số điện thoại</span><input class="input" name="phone" inputmode="tel" autocomplete="off"></label>
        <div class="st-meta">Chỉ ghi được tên đã có trong danh sách người nợ của cơ sở. Chưa có thì thêm trước ở Sổ thu chi › Sổ chi › 👥 Người nợ.</div>`}</div>
      <div class="pc-line" role="radiogroup" aria-label="Loại nợ">${[['bill', 'Nợ HĐ', 'khách chưa trả hoá đơn'], ['muon', 'Nợ TM', 'cầm tiền mặt của quán'], ['ck', 'Nợ CK', 'quán chuyển khoản cho']].map(([k, l, t]) => html`<label class="radio-pill" title="${t}"><input type="radio" name="kind" value="${k}" ${k === kind0 ? 'checked' : ''}> ${l}</label>`)}</div>
      <label class="field"><span>Số tiền nợ</span><input class="input money" name="amount" inputmode="numeric" autocomplete="off"></label>
      <label class="field"><span>Ngày nợ</span><input class="input" type="date" name="date" value="${today}" max="${today}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" placeholder="vd: trả hộ tiền sữa, hẹn trả cuối tuần"></label>
      <label class="cn-fo"><input type="checkbox" name="fund_out"> <span>Tiền đưa từ <b>quỹ</b> (Nợ TM / Nợ CK) — Sổ thu chi trừ ra</span></label>
      <div class="cn-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi nợ</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    if (people) bindPeopleSelect(dl, people, cn, { grp0: () => f.grp.value, onPick: (n, gp) => { if (gp) { const r = f.querySelector(`[name=grp][value="${gp}"]`); if (r) r.checked = true; }
      const q = people.find((x) => x.name === n); if (q?.phone && !f.phone.value) f.phone.value = q.phone; } });
    const fill = () => { const gg = p ? p.grp : f.grp.value; const dlist = dl.querySelector('#cn-names'); if (dlist) dlist.innerHTML = str(html`${namesOf(gg).map((n) => html`<option value="${n}"></option>`)}`);
      const k = [...f.kind].find((x) => x.checked)?.value; f.fund_out.disabled = k === 'bill'; if (k === 'bill') f.fund_out.checked = false;
      const kh = gg === 'khach'; const a = dl.querySelector('.cn-kh'); if (a) a.hidden = !kh; dl.querySelector('.cn-ppl').hidden = kh && !p; };
    fill(); f.addEventListener('change', fill);
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      const gg = p ? p.grp : f.grp.value;
      try {
        if (!p && gg !== 'khach' && !f.name.value) throw new Error('Chọn người nợ.');
        await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: cn, grp: gg, name: p ? (p.rows.find((r) => r.by_ql)?.name || p.name) : gg === 'khach' ? f.kname.value.trim() : f.name.value, phone: p ? p.phone || '' : gg === 'khach' ? '' : f.phone.value,
          kind: [...f.kind].find((x) => x.checked).value, amount: parseMoney(f.amount.value), date: f.date.value, note: f.note.value, fund_out: f.fund_out.checked } });
        dl.close(); flash('Đã ghi nợ.'); rerender();
      } catch (e) { btn.disabled = false; err(dl, e); }
    });
  }
  function collect(p) {
    const dl = dialog(html`<form class="stack cn-dlg" style="gap:12px"><h2 style="margin:0">Đã thu — ${p.name}</h2>
      <div>Còn nợ <b>${vnd(p.owe)}</b> · ${p.open.length} khoản</div>
      <div class="st-meta">Web trừ dần từ <b>khoản cũ nhất</b>, mỗi khoản trả đủ một lần. Đưa thiếu thì khoản cuối ghi trả đủ, phần còn thiếu thành <b>nợ mới</b> (tiền đưa từ quỹ). Sổ thu chi cộng khoản thu vào.</div>
      <label class="field"><span>Số tiền người đó trả</span><input class="input money" name="amount" inputmode="numeric" autocomplete="off" value="${fmt(p.owe)}"></label>
      <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" checked> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan"> Chuyển khoản</label></div>
      <label class="field"><span>Ngày thu</span><input class="input" type="date" name="date" value="${today}" max="${today}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off"></label>
      <div class="cn-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi đã thu</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]');
      const amt = parseMoney(f.amount.value);
      if (amt > 0 && amt < p.owe && !confirm(`Khách đưa thiếu ${fmt(p.owe - amt)} so với tổng nợ ${fmt(p.owe)}. Các khoản cũ nhất ghi trả đủ; khoản cuối ghi trả đủ, phần còn thiếu thành nợ mới (tiền đưa từ quỹ). Đồng ý?`)) return;
      btn.disabled = true;
      try {
        const n = await rpc('app_cn_collect_many', { p_ids: p.open.map((r) => r.id), p_date: f.date.value, p_kind: [...f.pay].find((x) => x.checked).value, p_amount: parseMoney(f.amount.value), p_note: f.note.value });
        dl.close(); flash(`Đã ghi thu (${n} khoản).`); rerender();
      } catch (e) { btn.disabled = false; err(dl, e); }
    });
  }
  function editPerson(p) {
    const dl = dialog(html`<form class="stack cn-dlg" style="gap:12px"><h2 style="margin:0">Sửa người nợ</h2>
      <label class="field"><span>Tên</span><input class="input" name="name" autocomplete="off" value="${p.rows.find((r) => r.by_ql)?.name || p.name}"></label>
      <label class="field"><span>Số điện thoại</span><input class="input" name="phone" inputmode="tel" autocomplete="off" value="${p.phone || ''}"></label>
      <div class="pc-line" role="radiogroup" aria-label="Nhóm">${Object.entries(GRP_SHORT).map(([k, l]) => html`<label class="radio-pill"><input type="radio" name="grp" value="${k}" ${k === p.grp ? 'checked' : ''}> ${l}</label>`)}</div>
      <div class="st-meta">Đổi cho cả ${p.rows.length} khoản của người này. Nợ khách hàng mới được nhắc ở phiếu chốt ca.</div>
      <div class="cn-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const g = [...f.grp].find((x) => x.checked).value;
        await rpc('app_cn_person_save', { p_ids: p.rows.map((r) => r.id), p_name: f.name.value, p_phone: f.phone.value, p_grp: g });
        dl.close(); flash('Đã lưu.');
        location.hash = q({ p: g === 'khach' ? 'khach|khách' : `${g}|${dispName({ ...p.rows[0], name: f.name.value.trim() }).toLowerCase()}` });
      } catch (e) { btn.disabled = false; err(dl, e); }
    });
  }
}

const STYLE = html`<style>
  .cn-wrap { max-width: 640px; width: 100%; min-width: 0; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  .cn-sum { gap: 8px; } .cn-big { font-size: 18px; } .cn-big b { font-size: 22px; color: #b91c1c; }
  .cn-top { display: flex; justify-content: space-between; gap: 2px 12px; align-items: baseline; flex-wrap: wrap; } .cn-paidm { color: var(--ink-2); font-size: 14px; } .cn-paidm b { color: var(--ok-ink); font-variant-numeric: tabular-nums; }
  .cn-ks { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px 0; } .cn-ks::-webkit-scrollbar { display: none; }
  .cn-k { flex: none; padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); font-size: 14px; white-space: nowrap; color: inherit; text-decoration: none; }
  .cn-k b { font-variant-numeric: tabular-nums; } .cn-k.zero { color: var(--ink-2); }
  .cn-k.on { background: var(--accent, #8b5a2b); border-color: var(--accent, #8b5a2b); color: #fff; font-weight: 600; }
  .cn-latebox { display: block; padding: 8px 10px; border-radius: 10px; background: var(--warn-bg); color: #92400e; text-decoration: none; font-size: 14px; }
  .cn-latebox.on { outline: 2px solid #d97706; }
  .card.cn-g { gap: 0; padding-top: 12px; padding-bottom: 10px; } .cn-gh { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; padding-bottom: 6px; }
  .cn-g h2 { margin: 0; font-family: inherit; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-2); } .cn-gsum { font-size: 17px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cn-empty { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 10px 14px; border: 1px dashed var(--line); border-radius: 12px; color: var(--ink-2); font-size: 14px; }
  .cn-empty h2 { display: inline; font-size: 14px; letter-spacing: 0; text-transform: none; color: inherit; } .cn-empty .btn { width: auto; flex: none; }
  .cn-r { display: flex; gap: 8px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); min-height: 44px; color: inherit; text-decoration: none; } .cn-r[hidden], .cn-p[hidden] { display: none; }
  .cn-r .who { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.3; } .cn-r .who small { display: block; color: var(--ink-2); font-size: 13px; } .cn-r .cn-late { white-space: nowrap; }
  .cn-r .btn { width: auto; flex: none; } .cn-r .go { color: var(--ink-2); font-size: 18px; font-weight: 400; text-decoration: none; }
  @media (min-width: 700px) { .cn-ks { flex-wrap: wrap; overflow: visible; } }
  .cn-paid { border-top: 1px solid var(--line); } .cn-paid summary { padding: 10px 0; color: var(--ink-2); font-size: 14px; font-weight: 400; text-transform: none; letter-spacing: 0; cursor: pointer; } .cn-paid[open] summary { color: inherit; font-weight: 600; }
  .cn-r.paid { border-top: 0; border-left: 3px solid var(--ok-line); padding: 5px 0 5px 10px; margin: 4px 0; min-height: 0; color: var(--ink-2); } .cn-r.paid .who small.cn-ok { color: var(--ok-ink); font-weight: 500; } .cn-rest { padding: 2px 0 8px; }
  .cn-wrap a.cn-ph, .cn-wrap a.cn-k, .cn-wrap a.cn-latebox { text-decoration: none; } .cn-top .cn-big .st-meta { font-size: 14px; }
  .cn-none { padding: 9px 0; border-top: 1px solid var(--line); }
  .cn-foot { display: flex; gap: 8px 14px; align-items: center; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid var(--line); font-size: 14px; } .cn-foot .btn { width: auto; }
  .cn-l { padding: 4px 0 4px 10px; border-left: 3px solid var(--line); margin: 4px 0; font-size: 14px; } .cn-l.done { opacity: .6; border-left-color: var(--ok-line); }
  .cn-l1 { display: flex; justify-content: space-between; gap: 8px; } .cn-l1 span { min-width: 0; } .cn-amt { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cn-l2 { color: var(--ink-2); } .cn-late { color: #b91c1c; font-weight: 700; } .cn-ok { color: var(--ok-ink); font-weight: 600; }
  .cn-btns { display: flex; gap: 8px; flex-wrap: wrap; } .cn-btns .btn { width: auto; }
  .cn-dlg { width: min(460px, calc(100vw - 56px)); } .cn-fo { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
</style>`;
