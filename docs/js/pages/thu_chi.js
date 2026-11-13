// Quản lý ca › Thu chi: mọi khoản thu / chi của MỘT cơ sở trong tháng
//  * Quản lý tự tạo → Đã đối soát. Từng dòng thu chi ở phiếu chốt ca → Chờ đối soát; chọn nhóm (hoặc "Không tính") là đối soát.
//  * Bước 65: sửa khoản phiếu ca (số tiền / nội dung / TM–CK, vào bản đối soát); đổi khoản chi thành cho vay.
//  * Bước 68: mỗi ca thiếu tiền = 1 dòng "Âm tiền" (khoản âm TL + khoản chi "Âm tiền" nhân viên ghi), gán Trừ lương / Quán chịu.
//  * Bước 69 (anh Tiến chốt 13/11): giao diện mới — mỗi lần 1 cơ sở (bỏ "Tất cả"); 6 ô số đầu trang; 2 cột (sổ gộp theo ngày bên trái;
//    Cần phân loại → Chi theo loại (so tháng trước) → Cho vay bên phải); lọc nhanh + "Lọc thêm"; bấm dòng mở khung sửa;
//    ô tích dưới số tiền = đối soát; bỏ đổi nhóm hàng loạt; "+ Thêm khoản" chọn loại ngay (Chi / Thu / Cho vay / Trả hộ Kho tổng / Khách nợ).
//  * Bước 70: khung Công nợ (Kho tổng vay + trả hộ, người vay, khách hàng nợ) — cho_vay.js.
import { render as rerender } from '../app.js';
import { DOW_LABELS, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, norm, showSaved, str } from '../ui.js';
import { KA_STATUS } from './phieu_ca.js';
import { mountLoans, toLoan } from '../cho_vay.js';
const ntm = (s) => String(s || '').replace(/^Khách mượn – /, 'Nợ TM – ');   // bước 82: bỏ chữ "khách mượn" (ghi chú tự động cũ từ máy chủ)

export const perm = 'doi_soat';
const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const F = { st: '', kind: '', src: '', q: '', pay: '', type: '', cat: '' };
const OPEN = new Set();   // dòng Âm tiền đang mở (giữ qua lần vẽ lại)
let MORE = false;         // "Lọc thêm" đang mở
const AM_RE = /(âm|thiếu)\s*tiền/i;
const LS_BR = 'tcBranch';
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };
const lastDay = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const dayLabel = (d) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return `${dmy(d)} · ${DOW_LABELS[(w + 6) % 7]}`; };
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const short = (n) => { const a = Math.abs(n); return a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '').replace('.', ',')}tr` : a >= 1000 ? `${Math.round(a / 1000)}k` : fmt(a); };

export function monthOf(params) {
  if (/^\d{4}-\d{2}$/.test(params.thang || '')) return params.thang;
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '')) return params.ngay.slice(0, 7);
  return vnToday().slice(0, 7);
}

export async function render(ctx) {
  const { params } = ctx;
  const month = monthOf(params);
  if (params.xem === 'khoan-am') F.src = 'ka';   // đường dẫn cũ "Khoản âm" → lọc âm tiền
  // bước 69: luôn 1 cơ sở — lấy từ địa chỉ, rồi cơ sở xem lần trước, rồi cơ sở đầu tiên được xem
  let cn = Number(params.cn) || lsGet();
  const range = { p_from: `${month}-01`, p_to: lastDay(month) };
  let D = cn ? await rpc('app_tc_list', { p_branch: cn, ...range }).catch(() => null) : null;
  if (!D) {
    const t = vnToday(); const L = await rpc('app_tc_list', { p_branch: null, p_from: t, p_to: t });
    if (!L.branches.length) return { title: 'Thu chi', html: html`<div class="page-head"><h1>Thu chi</h1></div><div class="alert warn">Bạn chưa được xem thu chi cơ sở nào.</div>` };
    cn = L.branches[0].id; D = await rpc('app_tc_list', { p_branch: cn, ...range });
  }
  lsSet(cn);
  const [FT, SM] = await Promise.all([rpc('app_fin_types').catch(() => ({ types: [], cats: [] })), rpc('app_tc_summary', { p_branch: cn, ...range }).catch(() => null)]);
  const typeById = new Map(FT.types.map((t) => [t.id, t])); const catById = new Map(FT.cats.map((c) => [c.id, c]));
  const typeOf = (r) => (r.category_id ? typeById.get(catById.get(r.category_id)?.type_id) || null : null);
  const path = (r) => { const t = typeOf(r); return `${t ? t.name + ' › ' : ''}${r.category || 'Chưa phân nhóm'}`; };
  const brById = new Map(D.branches.map((b) => [b.id, b])); const BR = brById.get(cn) || { id: cn, code: '' };
  const cats = (kind) => D.categories.filter((c) => c.kind === kind && c.active);
  const q = (o) => '#/quan-ly/thu-chi?' + Object.entries({ thang: month, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const rows = D.rows.map((r, i) => ({ ...r, i }));
  const counted = rows.filter((r) => !r.excluded && r.src !== 'ka');
  const sum = (a) => a.reduce((s, r) => s + Number(r.amount), 0);
  const thuR = counted.filter((r) => r.kind === 'thu'); const chiR = counted.filter((r) => r.kind === 'chi');
  const thu = sum(thuR); const chi = sum(chiR);
  const byPm = (a, pm) => sum(a.filter((r) => (r.pay || 'tien_mat') === pm));
  const real = rows.filter((r) => r.src !== 'ka');
  const pend = real.filter((r) => r.status === 'cho');
  const pmTag = (r) => (r.src === 'ka' ? html`<span class="tc-pm ka" title="Phiếu trừ lương">TL</span>` : (r.pay || 'tien_mat') === 'chuyen_khoan' ? html`<span class="tc-pm ck" title="Chuyển khoản">CK</span>` : html`<span class="tc-pm tm" title="Tiền mặt">TM</span>`);

  // Chi theo loại + so tháng trước (bước 69)
  const prev = SM?.prev_chi || {};
  const byType = []; chiR.forEach((r) => {
    const t = typeOf(r); const tk = t ? t.id : 0; let g = byType.find((x) => x.id === tk);
    if (!g) byType.push(g = { id: tk, name: t ? t.name : (r.category_id ? 'Chưa có loại' : 'Chưa phân nhóm (chờ đối soát)'), sort: t ? t.sort_order : 999, sum: 0, prev: 0, cats: [] });
    g.sum += Number(r.amount); const ck = r.category_id || 0; let c = g.cats.find((x) => x.id === ck);
    if (!c) g.cats.push(c = { id: ck, name: r.category || '—', sum: 0, n: 0 }); c.sum += Number(r.amount); c.n += 1;
  });
  Object.entries(prev).forEach(([k, v]) => {
    const t = Number(k) ? typeById.get(catById.get(Number(k))?.type_id) : null; const tk = t ? t.id : 0; let g = byType.find((x) => x.id === tk);
    if (!g) byType.push(g = { id: tk, name: t ? t.name : 'Chưa phân nhóm (chờ đối soát)', sort: t ? t.sort_order : 999, sum: 0, prev: 0, cats: [] });
    g.prev += Number(v);
  });
  byType.sort((a, b) => a.sort - b.sort); byType.forEach((g) => g.cats.sort((a, b) => b.sum - a.sum));
  const maxT = Math.max(1, ...byType.map((g) => g.sum));
  const cmp = (g) => { if (!g.prev && !g.sum) return ''; if (!g.prev) return html`<span class="tc-cmp up" title="Tháng trước: 0">mới</span>`;
    const p = Math.round(((g.sum - g.prev) / g.prev) * 100);
    return html`<span class="tc-cmp ${p > 0 ? 'up' : p < 0 ? 'dn' : ''}" title="Tháng trước: ${vnd(g.prev)}">${p > 0 ? `▲${p}%` : p < 0 ? `▼${-p}%` : '='}</span>`; };

  const catOpts = (k, sel, withX, blank = true) => { const cs = cats(k); const ts = FT.types.filter((t) => t.kind === k); const loose = cs.filter((c) => !ts.some((t) => t.id === catById.get(c.id)?.type_id));
    const o = (c) => html`<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${c.name}</option>`;
    return html`${blank ? html`<option value="">— Chọn nhóm —</option>` : ''}${ts.map((t) => { const g = cs.filter((c) => catById.get(c.id)?.type_id === t.id); return g.length ? html`<optgroup label="${t.name}">${g.map(o)}</optgroup>` : ''; })}${loose.map(o)}${withX ? html`<option value="x" ${sel === 'x' ? 'selected' : ''}>Không tính</option>` : ''}`; };
  const catSel = (r) => { const v = r.status === 'cho' ? r.category_id || '' : r.excluded ? 'x' : r.category_id || '';
    return html`<select class="input sm tc-cat" aria-label="Nhóm" title="Chọn nhóm là đối soát luôn">${catOpts(r.kind, v, r.src === 'ca', v === '')}</select>`; };
  const loanOn = (b) => (D.loan_branches || []).includes(b);

  // bước 68: gộp âm tiền theo ca
  const qcCat = D.categories.find((c) => c.kind === 'chi' && c.name === 'Âm tiền – quán chịu');
  const isAm = (r) => r.src === 'ca' && r.kind === 'chi' && !r.auto && !r.loan_id && (Number(r.ka_n) > 0 || AM_RE.test(r.note || ''));
  const AMG = new Map();
  rows.forEach((r) => {
    if (r.src !== 'ka' && !isAm(r)) return;
    let g = AMG.get(r.report_id);
    if (!g) AMG.set(r.report_id, g = { report_id: r.report_id, branch_id: r.branch_id, date: r.date, shift: r.shift, moves: [], ka: [] });
    (r.src === 'ka' ? g.ka : g.moves).push(r);
  });
  const kaLine = (k) => { const st = KA_STATUS[k.ka_status] || [k.ka_status, 'mute'];
    return html`<div class="tc-aml" data-i="${k.i}"><div class="grow"><b>${k.employee}</b> chịu <b>${fmt(k.amount)}đ</b> <span class="pill ${st[1]}">${st[0]}${k.auto_tru ? ' (mặc định)' : ''}</span>
        <div class="st-meta">${k.move_mkey ? '' : `Đối soát ${k.item_label}${k.reason ? ' · ' + k.reason : ''} · `}${k.seen_at ? 'NV đã xem' : 'NV chưa xem'}${k.status_note && !k.auto_tru ? ' · ' + k.status_note : ''}</div>
        ${k.reply ? html`<div class="st-meta ka-rep">Nhân viên giải trình: ${k.reply}</div>` : ''}</div>
      ${k.locked ? '' : html`<span class="toolbar tc-amb"><button type="button" class="btn sm secondary ka-ed">Sửa</button><button type="button" class="btn sm secondary danger ka-del" aria-label="Huỷ khoản">×</button></span>`}</div>`; };
  const moveLine = (m, g) => { const tl = g.ka.filter((k) => k.move_mkey === m.mkey);
    const state = tl.length ? 'trừ lương' : m.status === 'cho' ? 'chờ gán' : m.excluded ? 'không tính' : `quán chịu (${m.category || 'chưa nhóm'})`;
    return html`<div class="tc-amm" data-i="${m.i}"><div class="tc-aml"><div class="grow">Nhân viên ghi khoản chi “${m.note}” <b>${fmt(m.amount)}đ</b> (${PAY[m.pay] || ''}) → <b>${state}</b></div>
        ${m.locked ? '' : tl.length ? html`<span class="toolbar tc-amb"><button type="button" class="btn sm secondary tc-amundo">Bỏ gán</button></span>`
          : html`<span class="toolbar tc-amb"><button type="button" class="btn sm tc-amtl">Trừ lương…</button>${m.status === 'cho' || !qcCat || m.category_id !== qcCat.id ? html`<button type="button" class="btn sm secondary tc-amqc">Quán chịu</button>` : ''}</span>`}</div>
      ${tl.map(kaLine)}</div>`; };
  const amRow = (g) => {
    const tot = sum(g.moves) + sum(g.ka.filter((k) => !k.move_mkey));
    const wait = g.moves.some((m) => m.status === 'cho' && !g.ka.some((k) => k.move_mkey === m.mkey));
    const tlN = new Set(g.ka.filter((k) => k.ka_status === 'tru_luong').map((k) => k.employee_id)).size;
    const qc = g.moves.some((m) => m.status === 'da' && !m.excluded && !g.ka.some((k) => k.move_mkey === m.mkey));
    const what = wait ? 'chờ gán: trừ lương hay quán chịu' : [tlN ? `trừ lương ${tlN} người` : '', g.ka.some((k) => k.ka_status === 'da_bu') ? 'có người đã bù' : '',
      g.ka.some((k) => k.ka_status === 'mien') ? 'có khoản miễn' : '', qc ? 'quán chịu' : ''].filter(Boolean).join(' · ');
    const open = OPEN.has(g.report_id);
    return html`<div class="tc-r am ${wait ? 'todo' : ''}" data-g="${g.report_id}" data-st="${wait ? 'cho' : 'da'}" data-kind="chi" data-src="ka" data-pay="ka" data-type="" data-cat=""
        data-q="${norm(`am tien tru luong khoan am thieu tien ${g.ka.map((k) => `${k.employee} ${k.reason || ''}`).join(' ')} ${g.moves.map((m) => m.note).join(' ')}`)}">
      <span class="tc-pm ka" title="Âm tiền / trừ lương">${tlN ? 'TL' : 'ÂM'}</span>
      <div class="tc-m"><strong>Âm tiền – ca ${g.shift}</strong><div class="st-meta"><a href="#/ca/phieu?id=${g.report_id}">Phiếu ca ${g.shift}</a> · ${what}</div></div>
      <div class="tc-rt"><span class="tc-a neg">−${fmt(tot)}</span><button type="button" class="tc-ok ${wait ? 'n' : 'y'} tc-amx" aria-expanded="${open}" aria-label="${wait ? 'Chờ gán — mở chi tiết' : 'Đã xử lý — mở chi tiết'}">${wait ? '' : '✓'}</button></div>
      <div class="tc-x"><span class="tc-c ${wait ? 'need' : ''}">${wait ? 'Chờ gán' : 'Đã xử lý'}</span><button type="button" class="link-btn tc-amx2">${open ? 'Thu gọn' : 'Chi tiết'}</button></div>
      <div class="tc-amd" ${open ? '' : 'hidden'}>${g.moves.map((m) => moveLine(m, g))}${g.ka.filter((k) => !k.move_mkey).map(kaLine)}</div></div>`;
  };
  function row(r) {
    const src = r.src === 'ca' ? html`<a href="#/ca/phieu?id=${r.report_id}">Ca ${r.shift}</a> · ghi: ${r.by || '—'}` : html`Quản lý tạo · ${r.by || ''}`;
    const ok = r.status === 'da';
    const catTxt = r.loan_id ? 'Đã đổi thành cho vay' : r.status === 'cho' ? (r.category_id ? `${path(r)} (chưa xác nhận)` : 'Chưa phân loại') : r.excluded ? 'Không tính' : path(r);
    const catCls = r.loan_id ? 'loan' : r.status === 'cho' ? 'need' : r.excluded ? 'off' : '';
    const who = r.src === 'ca' ? [r.checked_by, dt(r.checked_at)].filter(Boolean).join(' · ') : 'quản lý tạo';
    return html`<div class="tc-r ${ok ? (r.excluded ? 'off' : '') : 'todo'}" data-i="${r.i}" role="button" tabindex="0" data-st="${r.status}" data-kind="${r.kind}" data-src="${r.src}" data-pay="${r.pay || 'tien_mat'}" data-type="${typeOf(r)?.id || ''}" data-cat="${r.category_id || ''}" data-q="${norm(`${r.note} ${r.category || ''} ${typeOf(r)?.name || ''} ${r.by || ''} ${r.checked_by || ''} ${PAY[r.pay] || ''} ca ${r.shift || ''}`)}">
      ${pmTag(r)}<div class="tc-m"><strong>${ntm(r.note) || '(không ghi nội dung)'}</strong>
        <div class="st-meta">${src}${r.auto ? ' · khoản tự động' : ''}${r.bank_out ? ' · từ phiếu chi chuyển khoản' : ''}${r.locked ? ' · tháng đã chốt' : ''}</div></div>
      <div class="tc-rt"><span class="tc-a ${r.kind === 'chi' ? 'neg' : 'pos'}">${r.kind === 'chi' ? '−' : '+'}${fmt(r.amount)}</span>
        <button type="button" class="tc-ok ${ok ? 'y' : 'n'}" aria-pressed="${ok}" aria-label="${ok ? 'Đã đối soát' : 'Tích để đối soát'}" title="${ok ? 'Đã đối soát' : 'Tích để đối soát'}">${ok ? '✓' : ''}</button></div>
      <div class="tc-x"><span class="tc-c ${catCls}">${catTxt}</span>${ok ? html`<span>đối soát: ${who}</span>` : html`<span class="tc-wait">Chưa đối soát</span>`}</div></div>`;
  }
  // sổ gộp theo ngày (bước 69)
  const days = []; const seenG = new Set();
  rows.forEach((r) => {
    let d = days[days.length - 1]; if (!d || d.date !== r.date) days.push(d = { date: r.date, items: [], thu: 0, chi: 0 });
    if (!r.excluded && r.src !== 'ka') { if (r.kind === 'thu') d.thu += Number(r.amount); else d.chi += Number(r.amount); }
    const g = r.src === 'ka' || isAm(r) ? AMG.get(r.report_id) : null;
    if (!g) { d.items.push(row(r)); return; }
    if (seenG.has(g.report_id)) return; seenG.add(g.report_id); d.items.push(amRow(g));
  });
  const listHtml = days.map((d) => html`<div class="tc-day"><div class="tc-dh"><span>${dayLabel(d.date)}</span><span class="st-meta">thu +${fmt(d.thu)} · chi −${fmt(d.chi)}</span></div>${d.items}</div>`);

  const ca = SM?.ca || {}; const lech = Number(ca.short || 0) + Number(ca.over || 0);
  const nChk = real.length - pend.length;
  const kpi = (id, cls, k, v, s) => html`<button type="button" class="tc-kpi ${cls}" id="${id}"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></button>`;
  const quick = [['all', 'Tất cả'], ['chi', 'Chi'], ['thu', 'Thu'], ['tm', 'TM'], ['ck', 'CK'], ['cho', 'Chưa đối soát']];
  const todo = pend.filter((r) => !isAm(r)).slice(0, 5);

  return {
    title: `Thu chi ${BR.code}`,
    html: html`${STYLE}
      <div class="page-head"><div><h1>Thu chi · ${BR.code}</h1>
        <div class="sub">Tích ô dưới số tiền (hoặc chọn nhóm) là đối soát, đổi lại được tới khi chốt tháng. Bấm vào một dòng để sửa.</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div><button type="button" class="btn" id="tc-add">+ Thêm khoản</button></div></div>
      <section class="card tc-bar">
        <div class="tc-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a>
          <strong>${monthLabel(month)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
        <nav class="branch-tabs" aria-label="Cơ sở">${D.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav></section>
      <div class="tc-kpis">
        ${kpi('k-thu', 'thu', 'Thu', `+${fmt(thu)}`, `TM ${short(byPm(thuR, 'tien_mat'))} · CK ${short(byPm(thuR, 'chuyen_khoan'))}`)}
        ${kpi('k-chi', 'chi', 'Chi', `−${fmt(chi)}`, `TM ${short(byPm(chiR, 'tien_mat'))} · CK ${short(byPm(chiR, 'chuyen_khoan'))}`)}
        ${kpi('k-no', '', 'Nợ', fmt(SM?.debts?.sum || 0), `Nợ TM + Nợ HĐ chưa thu · ${SM?.debts?.n || 0} khoản`)}
        ${kpi('k-vay', '', 'Cho vay', fmt(SM?.loans_left || 0), 'còn nợ (vay + trả hộ − đã trả)')}
        ${kpi('k-ds', pend.length ? 'warn' : '', 'Đã đối soát', `${nChk} / ${real.length}`, pend.length ? `còn ${pend.length} khoản chờ` : 'đã hết')}
        ${kpi('k-lech', ca.n_short ? 'lech' : '', 'Chênh lệch tiền', `${lech < 0 ? '−' : lech > 0 ? '+' : ''}${fmt(lech)}`, `${ca.n_short || 0} ca thiếu ${short(ca.short || 0)} · ${ca.n_over || 0} ca dư ${short(ca.over || 0)} ›`)}
      </div>
      <div class="tc-cols">
        <section class="card tc-book"><div class="tc-bh"><h2>Sổ thu chi</h2><span class="st-meta" id="f-n"></span></div>
          <div class="tc-qf">${quick.map(([v, l]) => html`<button type="button" class="tc-chip" data-q="${v}">${l}</button>`)}
            <input class="input sm tc-search" type="search" id="f-q" placeholder="Tìm nội dung, nhóm, người…" value="${F.q}" aria-label="Tìm">
            <button type="button" class="tc-chip more" id="tc-more" aria-expanded="${MORE}">Lọc thêm ${MORE ? '▴' : '▾'}</button></div>
          <div class="tc-morebox" id="tc-morebox" ${MORE ? '' : 'hidden'}>
            <select class="input sm" id="f-src" aria-label="Nguồn"><option value="">Mọi nguồn</option><option value="ca" ${F.src === 'ca' ? 'selected' : ''}>Từ phiếu chốt ca</option><option value="tay" ${F.src === 'tay' ? 'selected' : ''}>Quản lý tạo</option><option value="ka" ${F.src === 'ka' ? 'selected' : ''}>Âm tiền / trừ lương</option></select>
            <select class="input sm" id="f-type" aria-label="Loại"><option value="">Mọi loại</option>${FT.types.filter((t) => t.active).map((t) => html`<option value="${t.id}" ${String(F.type) === String(t.id) ? 'selected' : ''}>${t.kind === 'chi' ? 'Chi' : 'Thu'} · ${t.name}</option>`)}</select>
            <select class="input sm" id="f-cat" aria-label="Nhóm"><option value="">Mọi nhóm</option>${FT.cats.filter((c) => c.active).map((c) => html`<option value="${c.id}" data-t="${c.type_id || ''}" ${String(F.cat) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}</select></div>
          <div class="tc-legend"><span><span class="tc-ok y">✓</span>Đã đối soát</span><span><span class="tc-ok n"></span>Chưa — tích ô dưới số tiền để đối soát</span></div>
          <div id="tc-list">${listHtml}</div>
          <div class="st-meta" id="tc-empty" hidden style="padding:12px 0">${rows.length ? 'Không có khoản nào khớp bộ lọc.' : 'Tháng này chưa có khoản thu chi nào.'}</div>
        </section>
        <div class="tc-side">
          <section class="card tc-sc"><h2>Cần phân loại <small>${pend.length} khoản</small></h2>
            ${todo.length ? html`${todo.map((r) => html`<div class="tc-td" data-i="${r.i}"><div class="tc-tdh"><b>${ntm(r.note) || '(không ghi)'}</b><span class="tc-a ${r.kind === 'chi' ? 'neg' : 'pos'}">${r.kind === 'chi' ? '−' : '+'}${fmt(r.amount)}</span></div>
                <div class="st-meta">${dmy(r.date)} · Ca ${r.shift || ''} · ${r.by || ''} · ${(r.pay || 'tien_mat') === 'chuyen_khoan' ? 'CK' : 'TM'}</div>${r.locked ? '' : catSel(r)}</div>`)}
              ${pend.length > todo.length ? html`<button type="button" class="tc-chip" id="tc-allpend">Xem cả ${pend.length} khoản trong sổ ›</button>` : ''}`
              : html`<div class="st-meta">Đã phân loại hết. 👍</div>`}</section>
          <section class="card tc-sc"><h2>Chi theo loại <small>−${fmt(chi)}${SM ? ` · so tháng ${Number(SM.prev_from.slice(5, 7))}` : ''}</small></h2>
            ${byType.length ? byType.map((g) => html`<div class="tc-ty"><button type="button" class="tc-tyb" data-ft="${g.id || ''}" aria-pressed="${String(F.type) === String(g.id || '') && !!g.id}">
                <span class="grow">${g.name}</span><span class="tc-meter"><i style="width:${Math.round((g.sum / maxT) * 100)}%"></i></span><b class="tc-tys">${fmt(g.sum)}</b>${cmp(g)}</button>
              ${g.cats.length ? html`<div class="tc-tyc">${g.cats.map((c) => html`<button type="button" class="tc-cb" data-fc="${c.id || ''}" aria-pressed="${String(F.cat) === String(c.id || '') && !!c.id}"><span class="grow">${c.name} <span class="st-meta">· ${c.n}</span></span><span>${fmt(c.sum)}</span></button>`)}</div>` : ''}</div>`)
              : html`<div class="st-meta">Tháng này chưa có khoản chi.</div>`}
            <div class="st-meta">Không tính vào chi: cho vay, trả hộ Kho tổng, khoản "Không tính". Bấm một loại / nhóm để lọc sổ. <a href="#/cai-dat/thu-chi">Sửa loại & nhóm</a></div></section>
          <div id="tc-loans"></div>
        </div>
      </div>`,
    async mount() {
      const again = async (m) => { const y = window.scrollY; if (m) flash(m); await rerender(); window.scrollTo(0, y); };
      const apply = () => {
        const s = norm(F.q.trim()); let n = 0;
        $$('.tc-r').forEach((el) => {
          const ok = (!F.st || el.dataset.st === F.st) && (!F.kind || el.dataset.kind === F.kind) && (!F.src || el.dataset.src === F.src) && (!F.pay || el.dataset.pay === F.pay) && (!F.type || el.dataset.type === String(F.type)) && (!F.cat || el.dataset.cat === String(F.cat)) && (!s || el.dataset.q.includes(s));
          el.hidden = !ok; if (ok) n++;
        });
        $$('.tc-day').forEach((d) => { d.hidden = !d.querySelector('.tc-r:not([hidden])'); });
        $('#f-n').textContent = `${n} khoản`; $('#tc-empty').hidden = n > 0;
        const on = { all: !F.st && !F.kind && !F.pay && !F.src && !F.type && !F.cat && !F.q, chi: F.kind === 'chi', thu: F.kind === 'thu', tm: F.pay === 'tien_mat', ck: F.pay === 'chuyen_khoan', cho: F.st === 'cho' };
        $$('[data-q].tc-chip').forEach((b) => b.setAttribute('aria-pressed', String(!!on[b.dataset.q])));
        $$('[data-ft]').forEach((b) => b.setAttribute('aria-pressed', String(!!F.type && b.dataset.ft === String(F.type))));
        $$('[data-fc]').forEach((b) => b.setAttribute('aria-pressed', String(!!F.cat && b.dataset.fc === String(F.cat))));
        $('#f-src').value = F.src; $('#f-type').value = F.type; $('#f-cat').value = F.cat;
        [...$('#f-cat').options].forEach((o) => { o.hidden = !!F.type && !!o.value && o.dataset.t !== String(F.type); });
      };
      const quickSet = (v) => {
        if (v === 'all') Object.assign(F, { st: '', kind: '', pay: '', src: '', type: '', cat: '', q: '' }), ($('#f-q').value = '');
        else if (v === 'chi' || v === 'thu') F.kind = F.kind === v ? '' : v;
        else if (v === 'tm' || v === 'ck') { const p = v === 'tm' ? 'tien_mat' : 'chuyen_khoan'; F.pay = F.pay === p ? '' : p; }
        else if (v === 'cho') F.st = F.st === 'cho' ? '' : 'cho';
        apply();
      };
      $$('[data-q].tc-chip').forEach((b) => b.addEventListener('click', () => quickSet(b.dataset.q)));
      $('#f-q').addEventListener('input', (e) => { F.q = e.target.value; apply(); });
      $('#tc-more').addEventListener('click', (e) => { MORE = !MORE; $('#tc-morebox').hidden = !MORE; e.currentTarget.setAttribute('aria-expanded', String(MORE)); e.currentTarget.textContent = `Lọc thêm ${MORE ? '▴' : '▾'}`; });
      $('#f-src').addEventListener('change', (e) => { F.src = e.target.value; apply(); });
      $('#f-type').addEventListener('change', (e) => { F.type = e.target.value; F.cat = ''; apply(); });
      $('#f-cat').addEventListener('change', (e) => { F.cat = e.target.value; apply(); });
      $$('[data-ft]').forEach((b) => b.addEventListener('click', () => { if (!b.dataset.ft) return; F.type = F.type === b.dataset.ft ? '' : b.dataset.ft; F.cat = ''; F.kind = ''; apply(); }));
      $$('[data-fc]').forEach((b) => b.addEventListener('click', () => { if (!b.dataset.fc) return; F.cat = F.cat === b.dataset.fc ? '' : b.dataset.fc; F.type = ''; apply(); }));
      const toBook = () => $('.tc-book').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#k-thu').addEventListener('click', () => { F.kind = F.kind === 'thu' ? '' : 'thu'; apply(); toBook(); });
      $('#k-chi').addEventListener('click', () => { F.kind = F.kind === 'chi' ? '' : 'chi'; apply(); toBook(); });
      $('#k-ds').addEventListener('click', () => { F.st = F.st === 'cho' ? '' : 'cho'; apply(); toBook(); });
      $('#k-lech').addEventListener('click', () => { location.hash = `#/quan-ly/am-tien?thang=${month}&cn=${cn}`; });   // bước 71: sang tab Âm tiền
      $('#k-vay').addEventListener('click', () => $('#tc-loans').scrollIntoView({ behavior: 'smooth', block: 'start' }));
      $('#k-no').addEventListener('click', () => $('#tc-loans').scrollIntoView({ behavior: 'smooth', block: 'start' }));
      $('#tc-allpend')?.addEventListener('click', () => { F.st = 'cho'; apply(); toBook(); });
      apply();
      const rowOf = (b) => rows[Number(b.closest('[data-i]').dataset.i)];

      // bước 68: dòng Âm tiền — mở / gán trừ lương / quán chịu / bỏ gán
      const amToggle = (el) => { const d = el.querySelector('.tc-amd'); const g = Number(el.dataset.g); d.hidden = !d.hidden;
        el.querySelector('.tc-amx2').textContent = d.hidden ? 'Chi tiết' : 'Thu gọn'; el.querySelector('.tc-amx').setAttribute('aria-expanded', String(!d.hidden));
        if (d.hidden) OPEN.delete(g); else OPEN.add(g); };
      $$('.tc-amx, .tc-amx2').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); amToggle(b.closest('.tc-r')); }));
      $$('.tc-amtl').forEach((b) => b.addEventListener('click', () => amForm(rowOf(b))));
      $$('.tc-amqc').forEach((b) => b.addEventListener('click', async () => {
        const m = rowOf(b); if (!qcCat) { showSaved('Chưa có nhóm "Âm tiền – quán chịu". Tải lại trang.', true); return; }
        b.disabled = true;
        try { await rpc('app_tc_check', { p_report: m.report_id, p_mkey: m.mkey, p_category: qcCat.id, p_excluded: false, p_checked: true }); OPEN.add(m.report_id); await again('Đã gán: quán chịu (không trừ lương).'); }
        catch (e) { showSaved(e.message, true); b.disabled = false; }
      }));
      $$('.tc-amundo').forEach((b) => b.addEventListener('click', async () => {
        const m = rowOf(b); if (!confirm('Bỏ gán trừ lương khoản này? Các nhân viên được báo khoản âm đã huỷ, khoản trở lại "chờ gán".')) return;
        b.disabled = true;
        try { await rpc('app_tc_move_ka_undo', { p_report: m.report_id, p_mkey: m.mkey }); OPEN.add(m.report_id); await again('Đã bỏ gán — khoản chờ gán lại.'); }
        catch (e) { showSaved(e.message, true); b.disabled = false; }
      }));

      // đổi nhóm (= đối soát)
      const setCat = async (r, v) => {
        if (r.src === 'ca') await rpc('app_tc_check', { p_report: r.report_id, p_mkey: r.mkey, p_category: v === 'x' ? null : Number(v), p_excluded: v === 'x', p_checked: true });
        else await rpc('app_tc_entry_save', { p_id: r.id, p: { branch_id: r.branch_id, entry_date: r.date, kind: r.kind, category_id: Number(v), note: r.note, amount: r.amount, pay_method: r.pay } });
      };
      $$('.tc-cat').forEach((s) => s.addEventListener('change', async () => {
        if (!s.value) return; s.disabled = true;
        try { await setCat(rowOf(s), s.value); await again('Đã đối soát khoản.'); } catch (e) { showSaved(e.message, true); s.disabled = false; }
      }));
      // bấm dòng → khung sửa; ô tích → đối soát
      const openRow = (r) => {
        if (r.locked) { showSaved('Tháng đã chốt — khoản này chỉ xem.'); return; }
        if (r.loan_id) { showSaved('Khoản đã đổi thành cho vay — xem ở khung Cho vay (xoá khoản vay thì khoản trở lại Thu chi).'); return; }
        if (r.src === 'tay') entryForm(r); else if (r.auto) catForm(r); else moveForm(r);
      };
      $$('.tc-r[data-i]').forEach((el) => {
        el.addEventListener('click', (e) => { if (e.target.closest('a, button, select, input')) return; openRow(rowOf(el)); });
        el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); openRow(rowOf(el)); } });
      });
      $$('.tc-r[data-i] .tc-ok').forEach((b) => b.addEventListener('click', async () => {
        const r = rowOf(b);
        if (r.status === 'da' || r.locked || r.loan_id) { openRow(r); return; }
        if (!r.category_id) { catForm(r); return; }
        b.disabled = true;
        try { await setCat(r, r.category_id); await again('Đã đối soát khoản.'); } catch (e) { showSaved(e.message, true); b.disabled = false; }
      }));
      $('#tc-add').addEventListener('click', () => entryForm({}));
      $$('.ka-ed').forEach((b) => b.addEventListener('click', () => kaForm(rowOf(b))));
      $$('.ka-del').forEach((b) => b.addEventListener('click', async () => {
        const r = rowOf(b);
        const why = prompt(`Xóa phiếu "${r.note}" (${vnd(r.amount)})? Nhân viên sẽ được báo khoản này đã hủy.\nLý do (không bắt buộc):`, '');
        if (why === null) return;
        try { await rpc('app_ka_delete', { p_id: r.id, p_note: why }); flash('Đã xóa phiếu. Nhân viên đã được báo.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));

      // Sửa phiếu chi trừ lương: người chịu, số tiền, tình trạng
      async function kaForm(r) {
        let emps = []; try { emps = (await rpc('app_ca_employees')) || []; } catch (_) { /* bỏ qua */ }
        if (!emps.some((e) => e.id === r.employee_id)) emps.unshift({ id: r.employee_id, code: '', name: r.employee || '' });
        const cur = ['da_bu', 'mien'].includes(r.ka_status) ? r.ka_status : 'tru_luong';
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">Sửa phiếu chi trừ lương</h2>
          <div class="st-meta">${dmy(r.date)} · Phiếu ca ${r.shift} · ${r.item_label}${r.reason ? ` · ${r.reason}` : ''}</div>
          ${r.reply ? html`<div class="alert warn">Nhân viên giải trình: ${r.reply}</div>` : ''}
          <label class="field"><span>Người chịu</span><select class="input" name="emp">${emps.map((e) => html`<option value="${e.id}" ${e.id === r.employee_id ? 'selected' : ''}>${e.code ? `${e.code} – ` : ''}${e.name}</option>`)}</select></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${fmt(r.amount)}" autocomplete="off"></label>
          <div class="pc-line" role="radiogroup" aria-label="Tình trạng">${[['tru_luong', 'Trừ lương'], ['da_bu', 'Đã bù (nộp tiền)'], ['mien', 'Miễn']].map(([v, l]) => html`<label class="radio-pill"><input type="radio" name="st" value="${v}" ${cur === v ? 'checked' : ''}> ${l}</label>`)}</div>
          <label class="field"><span>Ghi chú (bắt buộc khi Miễn)</span><input class="input" name="note" value="${r.auto_tru ? '' : r.status_note || ''}" autocomplete="off"></label>
          <div id="tc-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d);
        const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            await rpc('app_ka_edit', { p_id: r.id, p_employee: Number(f.emp.value), p_amount: parseMoney(f.amt.value), p_status: f.querySelector('input[name=st]:checked').value, p_note: f.note.value });
            d.close(); flash('Đã lưu phiếu. Nhân viên đã được báo.'); rerender();
          } catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
      }

      // bước 69: chỉ chọn nhóm (khoản tự động, hoặc tích ô đối soát khi chưa có nhóm)
      function catForm(r) {
        const v0 = r.status === 'cho' ? r.category_id || '' : r.excluded ? 'x' : r.category_id || '';
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">Đối soát khoản</h2>
          <div class="st-meta">${dmy(r.date)} · ${r.src === 'ca' ? `Ca ${r.shift}${r.by ? ` · ghi: ${r.by}` : ''}` : 'Quản lý tạo'} · “${r.note}” <b>${r.kind === 'chi' ? '−' : '+'}${vnd(r.amount)}</b> (${PAY[r.pay] || ''})</div>
          <label class="field"><span>Nhóm (chọn là đối soát)</span><select class="input" name="cat">${catOpts(r.kind, v0, r.src === 'ca')}</select></label>
          ${r.auto ? html`<div class="st-meta">Khoản tự động (chi lương / Nợ TM) — sửa số tiền ở phiếu ca.</div>` : ''}
          <div id="tc-err"></div>
          <div class="toolbar" style="justify-content:flex-end">${r.src === 'ca' && !r.auto ? html`<button type="button" class="btn sm secondary tc-full" style="margin-right:auto">Sửa số tiền / nội dung…</button>` : ''}<button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Đối soát</button></div></form>`);
        const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        d.querySelector('.tc-full')?.addEventListener('click', () => { d.close(); moveForm(r); });
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault(); if (!f.cat.value) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">Chọn nhóm (hoặc "Không tính").</div>`); return; }
          try { await setCat(r, f.cat.value); d.close(); await again('Đã đối soát khoản.'); }
          catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
      }

      // bước 69: "+ Thêm khoản" chọn loại ngay — Chi / Thu / Cho vay; nhóm bắt buộc; ngày lùi được (tháng chưa chốt)
      function entryForm(e) {
        const kind = e.kind || 'chi'; const br0 = e.branch_id || cn;
        const opts = (k, sel) => catOpts(k, sel, false);
        const canLoan = !e.id && loanOn(br0); const canTra = !e.id && !!$('#tc-loans .ln-traho'); const canNo = !e.id && !!$('#tc-loans .cn-new');
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">${e.id ? 'Sửa khoản thu / chi' : 'Thêm khoản'} · ${brById.get(br0)?.code || ''}</h2>
          ${e.id ? html`<div class="st-meta">Quản lý tạo · ${e.by || ''} — khoản quản lý tạo là <strong>đã đối soát</strong>.</div>` : ''}
          ${e.bank_out ? html`<div class="alert warn">Khoản này tạo từ phiếu chi chuyển khoản ở Đối soát ca: chỉ đổi nhóm / nội dung${loanOn(e.branch_id) ? ' hoặc đổi thành cho vay' : ''} ở đây. Sai số tiền thì xoá phiếu chi ở Đối soát ca rồi tạo lại.</div>` : ''}
          <div class="tc-kinds" role="radiogroup" aria-label="Loại khoản"><label class="radio-pill"><input type="radio" name="kind" value="chi" ${kind === 'chi' ? 'checked' : ''}> Chi</label><label class="radio-pill"><input type="radio" name="kind" value="thu" ${kind === 'thu' ? 'checked' : ''}> Thu</label>${canLoan ? html`<label class="radio-pill"><input type="radio" name="kind" value="vay"> Cho vay</label>` : ''}${canTra ? html`<label class="radio-pill"><input type="radio" name="kind" value="traho"> Trả hộ Kho tổng</label>` : ''}${canNo ? html`<label class="radio-pill"><input type="radio" name="kind" value="no"> Nợ HĐ</label>` : ''}</div>
          <input type="hidden" name="br" value="${br0}">
          <label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${e.date || (vnToday().startsWith(month) ? vnToday() : month + '-01')}"></label>
          <label class="field"><span>Nhóm (bắt buộc)</span><select class="input" name="cat">${opts(kind, e.category_id || '')}</select></label>
          <label class="field"><span>Nội dung</span><input class="input" name="note" value="${e.note || ''}" placeholder="vd: Mua đá, tiền điện, bán bã cafe…" autocomplete="off"></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${e.amount ? fmt(e.amount) : ''}" autocomplete="off"></label>
          <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" ${(e.pay || 'tien_mat') === 'tien_mat' ? 'checked' : ''}> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan" ${e.pay === 'chuyen_khoan' ? 'checked' : ''}> Chuyển khoản</label></div>
          <div id="tc-err"></div>
          <div class="toolbar" style="justify-content:flex-end;flex-wrap:wrap">${e.id && e.kind === 'chi' && loanOn(e.branch_id) ? html`<button type="button" class="btn sm secondary tc-2loan" style="margin-right:auto">Đổi thành cho vay</button>` : ''}${e.id && !e.bank_out ? html`<button type="button" class="btn sm secondary danger tc-del">Xoá</button>` : ''}<button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d);
        const f = d.querySelector('form');
        d.querySelector('.tc-2loan')?.addEventListener('click', () => { d.close(); toLoan(brById.get(e.branch_id), e, again); });
        d.querySelector('.tc-del')?.addEventListener('click', async () => {
          if (!confirm(`Xóa khoản "${e.note}" (${vnd(e.amount)})?`)) return;
          try { await rpc('app_tc_entry_delete', { p_id: e.id }); d.close(); await again('Đã xóa khoản.'); } catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
        if (e.bank_out) f.querySelectorAll('[name=kind], [name=date], [name=amt], [name=pay]').forEach((x) => { x.disabled = true; });
        f.addEventListener('change', (ev) => {
          if (ev.target.name !== 'kind') return;
          const go = { vay: '.ln-new', traho: '.ln-traho', no: '.cn-new' }[ev.target.value];
          if (go) { d.close(); const nb = $(`#tc-loans ${go}`); if (nb) nb.click(); else showSaved('Cơ sở này chưa bật mục này.', true); return; }
          f.cat.innerHTML = str(opts(ev.target.value, ''));
        });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          if (!f.cat.value) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">Chọn nhóm cho khoản.</div>`); return; }
          const p = { branch_id: Number(f.br.value), entry_date: f.date.value, kind: f.querySelector('input[name=kind]:checked').value, category_id: f.cat.value || null,
            note: f.note.value, amount: parseMoney(f.amt.value), pay_method: f.querySelector('input[name=pay]:checked').value };
          try { await rpc('app_tc_entry_save', { p_id: e.id || null, p }); d.close(); await again(e.id ? 'Đã lưu khoản.' : 'Đã thêm khoản (đã đối soát).'); }
          catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
      }

      // Bước 65: sửa khoản ở phiếu ca — sửa vào bản đối soát (phiếu nhân viên giữ nguyên)
      function moveForm(r) {
        const br = brById.get(r.branch_id); const cm = !!D.can_money; const dis = cm ? '' : 'disabled';
        const v0 = r.status === 'cho' ? r.category_id || '' : r.excluded ? 'x' : r.category_id || '';
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">Sửa khoản ở phiếu ca</h2>
          <div class="st-meta">${dmy(r.date)} · ${br?.code || ''} · Phiếu ca ${r.shift}${r.by ? ` (${r.by})` : ''}. Sửa vào bản đối soát — phiếu nhân viên ghi giữ nguyên.</div>
          <div class="pc-line" role="radiogroup" aria-label="Loại"><label class="radio-pill"><input type="radio" name="kind" value="chi" ${r.kind === 'chi' ? 'checked' : ''} ${dis}> Khoản chi</label><label class="radio-pill"><input type="radio" name="kind" value="thu" ${r.kind === 'thu' ? 'checked' : ''} ${dis}> Khoản thu</label></div>
          <label class="field"><span>Nội dung</span><input class="input" name="note" value="${r.note}" autocomplete="off"></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${fmt(r.amount)}" autocomplete="off" ${dis}></label>
          <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" ${r.pay !== 'chuyen_khoan' ? 'checked' : ''} ${dis}> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan" ${r.pay === 'chuyen_khoan' ? 'checked' : ''} ${dis}> Chuyển khoản</label></div>
          <label class="field"><span>Nhóm</span><select class="input" name="cat">${catOpts(r.kind, v0, true)}</select></label>
          ${cm ? '' : html`<div class="st-meta">Bạn đổi được nội dung và nhóm. Sửa số tiền / hình thức cần quyền Đối soát.</div>`}
          <div class="alert warn tc-mw" hidden>${D.can_direct ? html`Bạn là Chủ / Quản lý tổng: <b>sửa thẳng</b> — ca đã đối soát giữ nguyên, không phải duyệt lại; web ghi nhật ký số cũ → số mới.`
            : html`Đổi số tiền / hình thức chỉ được khi mục <b>Tiền mặt / Chuyển khoản</b> của ca chưa đối soát. Ca đã đối soát thì nhờ Chủ / Quản lý tổng sửa.`}</div>
          <label class="field tc-why" hidden><span>Lý do sửa số tiền / hình thức (bắt buộc)</span><input class="input" name="why" autocomplete="off" placeholder="vd: nhân viên ghi nhầm 50.000 thành 500.000"></label>
          <div id="tc-err"></div>
          <div class="toolbar" style="justify-content:flex-end;flex-wrap:wrap">${r.kind === 'chi' ? html`<button type="button" class="btn sm secondary tc-2am">Đây là âm tiền…</button>` : ''}${r.kind === 'chi' && loanOn(r.branch_id) ? html`<button type="button" class="btn sm secondary tc-2loan" style="margin-right:auto">Đổi thành cho vay</button>` : ''}<button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d);
        d.querySelector('.tc-2loan')?.addEventListener('click', () => { d.close(); toLoan(br, r, again); });
        d.querySelector('.tc-2am')?.addEventListener('click', () => { d.close(); amForm(r); });
        const f = d.querySelector('form'); const val = () => ({ kind: f.querySelector('[name=kind]:checked').value, amt: parseMoney(f.amt.value), pay: f.querySelector('[name=pay]:checked').value });
        const sync = () => { const x = val(); const ch = x.kind !== r.kind || x.amt !== Number(r.amount) || x.pay !== (r.pay || 'tien_mat'); d.querySelector('.tc-mw').hidden = !ch; d.querySelector('.tc-why').hidden = !ch; return ch; };
        f.addEventListener('input', sync);
        f.addEventListener('change', (ev) => { if (ev.target.name === 'kind') f.cat.innerHTML = str(catOpts(ev.target.value, '', true)); sync(); });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault(); const x = val(); const c = f.cat.value;
          try {
            const res = await rpc('app_tc_move_edit', { p_report: r.report_id, p_mkey: r.mkey, p: { kind: x.kind, amount: x.amt, pay: x.pay, note: f.note.value, category_id: c && c !== 'x' ? Number(c) : null, excluded: c === 'x', reason: sync() ? f.why.value : '' } });
            d.close();
            await again(res?.direct ? 'Đã sửa thẳng khoản (ca giữ nguyên đối soát, đã ghi nhật ký).' : res?.money ? 'Đã sửa số tiền khoản.' : 'Đã lưu khoản.');
          } catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
      }

      // Bước 68: gán khoản "Âm tiền" ở phiếu ca thành trừ lương — chọn người chịu, mặc định chia đều
      async function amForm(m) {
        let R = null; let emps = [];
        try { [R, emps] = await Promise.all([rpc('app_ca_get', { p_id: m.report_id }), rpc('app_ca_employees').then((x) => x || []).catch(() => [])]); } catch (e) { showSaved(e.message, true); return; }
        const staff = (R?.staff || []).filter((s) => s.worked !== false && s.worked !== 0);
        const inCa = new Set(staff.map((s) => s.employee_id));
        const pRow = (id, label, on) => html`<div class="tc-pp" data-e="${id}"><label class="tc-ppl"><input type="checkbox" class="tc-pon" ${on ? 'checked' : ''}> <span>${label}</span></label><input class="input sm money tc-pamt" inputmode="numeric" autocomplete="off" aria-label="Số tiền ${label}"></div>`;
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">Âm tiền → trừ lương</h2>
          <div class="st-meta">${dmy(m.date)} · Phiếu ca ${m.shift} · “${m.note}” <b>${vnd(m.amount)}</b>. Khoản chi thành “Không tính” (không còn là chi phí quán); mỗi người được báo, mặc định trừ lương, giải trình được.</div>
          <div class="tc-ppw">${staff.length ? staff.map((s) => pRow(s.employee_id, `${s.code || ''} – ${s.name || ''}`, true)) : html`<div class="st-meta">Phiếu ca không có danh sách nhân viên — chọn người ở dưới.</div>`}</div>
          <label class="field"><span>Thêm người khác</span><select class="input" id="tc-addp"><option value="">— Chọn —</option>${emps.filter((e) => !inCa.has(e.id)).map((e) => html`<option value="${e.id}">${e.code} – ${e.name}</option>`)}</select></label>
          <div class="st-meta" id="tc-psum"></div>
          <label class="field"><span>Lý do</span><input class="input" name="why" value="${m.note}" autocomplete="off"></label>
          <div id="tc-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Gán trừ lương</button></div></form>`);
        bindMoneyInputs(d);
        const total = Number(m.amount); let manual = false;
        const on = () => $$('.tc-pp', d).filter((x) => x.querySelector('.tc-pon').checked);
        const show = () => { const s = on().reduce((t, x) => t + parseMoney(x.querySelector('.tc-pamt').value || '0'), 0);
          d.querySelector('#tc-psum').textContent = `Tổng người chịu: ${fmt(s)}đ / cần ${fmt(total)}đ${s === total ? ' ✓' : ''}`; };
        const split = () => { const L = on(); $$('.tc-pp', d).forEach((x) => { if (!x.querySelector('.tc-pon').checked) x.querySelector('.tc-pamt').value = ''; });
          if (L.length) { const base = Math.floor(total / L.length / 1000) * 1000; L.forEach((x, i) => { x.querySelector('.tc-pamt').value = fmt(i === 0 ? total - base * (L.length - 1) : base); }); } show(); };
        split();
        d.addEventListener('change', (ev) => { if (ev.target.classList.contains('tc-pon') && !manual) split(); else show(); });
        d.addEventListener('input', (ev) => { if (ev.target.classList.contains('tc-pamt')) { manual = true; const x = ev.target.closest('.tc-pp'); if (x) x.querySelector('.tc-pon').checked = true; show(); } });
        d.querySelector('#tc-addp').addEventListener('change', (ev) => {
          const o = ev.target.selectedOptions[0]; if (!o.value) return;
          d.querySelector('.tc-ppw').insertAdjacentHTML('beforeend', str(pRow(Number(o.value), o.text, true))); bindMoneyInputs(d.querySelector('.tc-ppw').lastElementChild);
          o.remove(); ev.target.value = ''; if (!manual) split(); else show();
        });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        d.querySelector('form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const people = on().map((x) => ({ employee_id: Number(x.dataset.e), amount: parseMoney(x.querySelector('.tc-pamt').value || '0') })).filter((x) => x.amount > 0);
          try { await rpc('app_tc_move_to_ka', { p_report: m.report_id, p_mkey: m.mkey, p_people: people, p_reason: d.querySelector('[name=why]').value });
            d.close(); OPEN.add(m.report_id); await again(`Đã gán trừ lương ${people.length} người. Nhân viên đã được báo.`); }
          catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
      }

      await mountLoans($('#tc-loans'), D.branches.filter((b) => b.id === cn), (m) => again(m));   // bước 64 + 70: Công nợ
    },
  };
}

const STYLE = html`<style>
  .tc-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
  .tc-month { display: flex; align-items: center; gap: 10px; }
  .tc-month strong { font-size: 17px; min-width: 120px; text-align: center; }
  .tc-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
  .tc-kpi { font: inherit; color: inherit; text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; cursor: pointer; }
  .tc-kpi:hover { border-color: var(--caramel-line); }
  .tc-kpi .k { font-size: 12px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .tc-kpi .v { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .tc-kpi .s { font-size: 12px; color: var(--muted); }
  .tc-kpi.thu .v { color: var(--ok-ink); } .tc-kpi.chi .v { color: #b91c1c; }
  .tc-kpi.warn { background: var(--warn-bg); border-color: #f6d58a; } .tc-kpi.warn .v { color: var(--warn-ink); }
  .tc-kpi.lech { background: var(--off-bg); border-color: #f3b4ad; } .tc-kpi.lech .v { color: #b91c1c; }
  .tc-cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; align-items: start; }
  .tc-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .tc-book { display: flex; flex-direction: column; gap: 10px; padding: 14px; min-width: 0; }
  .tc-bh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; } .tc-bh h2, .tc-sc h2 { margin: 0; font-size: 17px; }
  .tc-sc { display: flex; flex-direction: column; gap: 8px; padding: 14px; min-width: 0; }
  .tc-sc h2 small { font-weight: 500; color: var(--muted); font-size: 13px; margin-left: 4px; }
  .tc-qf { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .tc-chip { font: inherit; font-size: 13px; font-weight: 600; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line-strong); background: #fff; cursor: pointer; color: inherit; }
  .tc-chip[aria-pressed="true"] { background: var(--forest); border-color: var(--forest); color: #fff; }
  .tc-chip.more { border-style: dashed; }
  .tc-search { flex: 1 1 150px; min-width: 0; width: auto; height: 34px; border-radius: 999px; }
  .tc-morebox { display: flex; gap: 6px; flex-wrap: wrap; padding: 8px; background: var(--subtle); border-radius: 10px; } .tc-morebox select { flex: 1 1 150px; width: auto; min-width: 0; }
  .tc-morebox[hidden] { display: none; }
  .tc-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); align-items: center; }
  .tc-legend .tc-ok { width: 16px; height: 16px; font-size: 11px; vertical-align: -3px; margin-right: 4px; cursor: default; }
  .tc-day[hidden] { display: none; }
  .tc-dh { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 8px 4px 6px; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--ink-2); }
  .tc-pm { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 22px; padding: 0 5px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: .03em; margin-top: 1px; }
  .tc-pm.tm { background: var(--ok-bg); color: var(--ok-ink); } .tc-pm.ck { background: var(--info-bg); color: var(--info-ink); } .tc-pm.ka { background: #fee2e2; color: #991b1b; }
  .tc-r { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 2px 10px; align-items: start; padding: 9px 4px; border-bottom: 1px solid var(--line-soft); cursor: pointer; }
  .tc-r:hover { background: var(--subtle); } .tc-r:focus-visible { outline: 3px solid var(--focus); outline-offset: -2px; }
  .tc-r[hidden] { display: none; }
  .tc-r.todo { background: #fffaeb; } .tc-r.todo:hover { background: var(--warn-bg); }
  .tc-r.am { border-left: 3px solid #fca5a5; cursor: default; }
  .tc-r.off .tc-a, .tc-r.off strong { color: var(--muted); text-decoration: line-through; }
  .tc-m { min-width: 0; overflow-wrap: anywhere; } .tc-m strong { font-weight: 600; }
  .tc-rt { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .tc-a { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tc-a.neg { color: #b91c1c; } .tc-a.pos { color: var(--ok-ink); }
  .tc-ok { width: 26px; height: 26px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; padding: 0; cursor: pointer; font-family: inherit; }
  .tc-ok.y { background: var(--ok-ink); color: #fff; border: 0; } .tc-ok.n { background: #fff; border: 2px solid var(--warn-line); }
  .tc-ok:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; }
  .tc-x { grid-column: 2 / 4; display: flex; gap: 6px 10px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--muted); }
  .tc-c { border-radius: 8px; padding: 1px 8px; background: var(--subtle); border: 1px solid var(--line); color: var(--ink-2); overflow-wrap: anywhere; }
  .tc-c.need { background: var(--warn-bg); border-color: var(--warn-line); color: var(--warn-ink); font-weight: 600; } .tc-c.off { font-style: italic; } .tc-c.loan { background: var(--plum-bg); color: var(--plum-ink); border-color: #dcc6d9; }
  .tc-wait { color: var(--warn-ink); font-weight: 600; }
  .tc-amd { grid-column: 1 / -1; border-top: 1px dashed var(--line); padding: 8px 0 2px 40px; display: flex; flex-direction: column; gap: 8px; cursor: auto; }
  .tc-amd[hidden] { display: none; }
  .tc-aml { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; font-size: 14px; } .tc-aml .grow { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
  .tc-amm { display: flex; flex-direction: column; gap: 6px; } .tc-amm > .tc-aml + .tc-aml { padding-left: 16px; border-left: 2px solid var(--line); }
  .tc-amb { flex-wrap: nowrap; width: auto; gap: 6px; } .tc-amb .btn { width: auto; }
  .tc-ppw { display: flex; flex-direction: column; gap: 6px; } .tc-pp { display: flex; gap: 8px; align-items: center; } .tc-ppl { flex: 1 1 auto; min-width: 0; display: flex; gap: 6px; align-items: center; }
  .tc-pp .tc-pamt { width: 130px; flex: 0 0 auto; }
  .ka-rep { background: var(--line-soft); border-radius: 6px; padding: 3px 6px; margin-top: 3px; }
  .tc-td { display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; border-bottom: 1px solid var(--line-soft); }
  .tc-tdh { display: flex; justify-content: space-between; gap: 8px; } .tc-tdh b { min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
  .tc-td .tc-cat { width: 100%; border-color: var(--warn-line); background: var(--warn-bg); }
  .tc-ty { border-top: 1px solid var(--line-soft); padding-top: 4px; }
  .tc-tyb, .tc-cb { display: flex; gap: 8px; align-items: center; width: 100%; font: inherit; color: inherit; background: none; border: 1px solid transparent; border-radius: 8px; padding: 5px 6px; cursor: pointer; text-align: left; }
  .tc-tyb[aria-pressed="true"], .tc-cb[aria-pressed="true"] { border-color: var(--primary); background: var(--subtle); }
  .tc-tyb .grow, .tc-cb .grow { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; } .tc-tyb .grow { font-weight: 600; }
  .tc-meter { flex: 0 0 64px; height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; } .tc-meter i { display: block; height: 100%; background: var(--primary); }
  .tc-tys { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .tc-cmp { flex: 0 0 46px; font-size: 11px; font-weight: 700; color: var(--muted); text-align: right; white-space: nowrap; } .tc-cmp.up { color: #b91c1c; } .tc-cmp.dn { color: var(--ok-ink); }
  .tc-tyc { display: flex; flex-direction: column; padding-left: 12px; font-size: 13px; } .tc-cb span:last-child { font-variant-numeric: tabular-nums; }
  .tc-kinds { display: flex; gap: 6px; flex-wrap: wrap; }
  .tc-dlg { width: min(520px, calc(100vw - 56px)); }
  @media (max-width: 1100px) { .tc-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px) { .tc-cols { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 560px) { .tc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tc-kpi .v { font-size: 17px; } .tc-amd { padding-left: 0; } }
</style>`;
