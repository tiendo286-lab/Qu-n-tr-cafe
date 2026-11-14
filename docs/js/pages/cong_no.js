// Quản lý ca › Công nợ (bước 95, anh Tiến chốt 14/11/2026): tab riêng, theo từng cơ sở.
//  * 3 nhóm: ① Nợ khách hàng (Nợ HĐ + khách ngoài — phiếu chốt ca nhắc thu), ② Nợ kho tổng, ③ Nợ khác (thêm người được). Kho tổng / Nợ khác chỉ quản lý thu.
//  * Mỗi người 1 dòng tổng còn nợ; từng khoản "Nợ ngày … → Trả ngày …" (chưa trả: N ngày, quá 7 ngày ⚠; đã trả hết hiện mờ trong tháng).
//  * Ô tìm tên / SĐT, đếm khách nợ quá 7 ngày. Bấm vào người: còn nợ, thu gộp (trừ khoản cũ nhất trước), lịch sử đã trả, sửa tên / SĐT / nhóm.
//  * Đối soát ca › Thu chi: khoản chi "Thành nợ" (doi_soat_tc.js) → vào đây.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, noKind, parseMoney, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, str } from '../ui.js';

export const perm = 'doi_soat';
const LS_BR = 'tcBranch';
export const GRP = { khach: '① Nợ khách hàng', kho: '② Nợ kho tổng', khac: '③ Nợ khác' };
export const GRP_SHORT = { khach: 'Nợ khách hàng', kho: 'Nợ kho tổng', khac: 'Nợ khác' };
const GRP_HELP = { khach: 'Nợ HĐ và khách ngoài — phiếu chốt ca nhắc thu', kho: 'chỉ quản lý thu', khac: 'người quen, người nhà… — chỉ quản lý thu' };
const PAY = { tien_mat: 'TM', chuyen_khoan: 'CK', gia_dinh: 'chuyển gia đình' };
const LATE = 7;
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const days = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 864e5));
export const dispName = (r) => `${(r.kind === 'bill' || !r.kind) && !r.by_ql && /^\s*\d+\s*$/.test(r.name || '') ? 'Bàn ' : ''}${(r.name || '').trim()}`;
const keyOf = (r) => `${r.grp}|${dispName(r).toLowerCase()}`;

function people(rows, today) {
  const M = new Map();
  rows.forEach((r) => { const k = keyOf(r); if (!M.has(k)) M.set(k, { key: k, grp: r.grp, name: dispName(r), phone: null, rows: [] }); const p = M.get(k); p.rows.push(r); if (r.phone) p.phone = r.phone; });
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
  const paidTxt = (r) => `${dmy(r.paid_date).slice(0, 5)} · ${PAY[r.paid_kind] || ''} · ${r.paid_report ? `ca ${r.paid_shift || ''}` : 'QL thu'}`;
  const line = (r, full = false) => html`<div class="cn-l ${r.closed ? 'done' : ''}">
      <div class="cn-l1"><span>Nợ <b>${dmy(r.date).slice(0, 5)}</b> · ${fromTxt(r)} · ${noKind(r.kind)}${r.split && !r.closed ? ' (phần còn lại)' : ''}</span><b class="cn-amt">${fmt(r.amount)}</b></div>
      <div class="cn-l2">→ ${r.closed ? html`<span class="cn-ok">Trả <b>${paidTxt(r)}</b> ✓</span>` : html`<span class="${late(r) ? 'cn-late' : ''}">chưa trả · ${days(r.date, today) ? `${days(r.date, today)} ngày` : 'hôm nay'}${late(r) ? ' ⚠' : ''}</span>`}
        ${full && r.note ? html`<span class="st-meta"> · ${r.note}</span>` : ''}${full && r.closed && r.paid_note && !['Đã thu', 'Quản lý thu'].includes(r.paid_note) ? html`<span class="st-meta"> · ${r.paid_note}</span>` : ''}
        ${full && r.closed && r.can_unthu && ed ? html` <button type="button" class="btn sm secondary cn-unthu" data-id="${r.id}">Bỏ đã thu</button>` : ''}</div></div>`;

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
          ${p.oldest ? html`<div class="st-meta">${p.open.length} khoản · lâu nhất ${p.oldest} ngày${p.grp === 'khach' && p.oldest > LATE ? ' ⚠' : ''}</div>` : html`<div class="cn-ok">✓ Đã trả hết</div>`}
          ${ed ? html`<div class="cn-btns">${p.open.length ? html`<button type="button" class="btn sm" id="cn-thu">Đã thu</button>` : ''}<button type="button" class="btn sm secondary" id="cn-more">+ Ghi thêm nợ</button><button type="button" class="btn sm secondary" id="cn-edit">Sửa tên / SĐT / nhóm</button></div>` : ''}</section>
        <section class="card stack"><h2>Còn nợ (${p.open.length})</h2>${p.open.length ? p.open.map((r) => line(r, true)) : html`<div class="st-meta">Không còn khoản nào.</div>`}</section>
        <section class="card stack"><h2>Đã trả (${paid.length})</h2>${paid.length ? paid.map((r) => line(r, true)) : html`<div class="st-meta">Chưa có lần trả nào (180 ngày gần đây).</div>`}</section></div>`,
      mount() {
        bindUnthu();
        $('#cn-thu')?.addEventListener('click', () => collect(p));
        $('#cn-more')?.addEventListener('click', () => newDebt(p.grp, p));
        $('#cn-edit')?.addEventListener('click', () => editPerson(p));
      },
    };
  }

  // ---------- trang chính
  const lateP = P.filter((p) => p.grp === 'khach' && p.open.some(late));
  const onlyLate = params.qua === '1';
  const shown = (p) => (p.owe > 0 || p.rows.some((r) => r.closed && String(r.paid_date).slice(0, 7) === month)) && (!onlyLate || lateP.includes(p));
  const total = P.reduce((t, p) => t + p.owe, 0); const nOwe = P.filter((p) => p.owe > 0).length;
  // bước 97: ô số đầu trang; bấm ô nhóm → chỉ hiện nhóm đó (?g=), bấm lại → cả 3 nhóm
  const gOn = ['khach', 'kho', 'khac'].includes(params.g) ? params.g : '';
  const gSum = (g) => P.filter((p) => p.grp === g).reduce((t, p) => t + p.owe, 0); const gN = (g) => P.filter((p) => p.grp === g && p.owe > 0).length;
  const paidM = D.rows.filter((r) => r.closed && String(r.paid_date).slice(0, 7) === month);
  const tile = (g) => html`<a class="cn-k ${gOn === g ? 'on' : ''}" href="${q({ g: gOn === g ? '' : g, qua: params.qua })}"><span class="k">${GRP[g]}</span><b>${fmt(gSum(g))}</b><small>${gN(g)} người${gOn === g ? ' · đang lọc — bấm bỏ lọc' : ''}</small></a>`;
  const card = (p) => { const rs = p.rows.filter((r) => !r.closed || String(r.paid_date).slice(0, 7) === month);
    return html`<div class="cn-p ${p.owe ? '' : 'done'}" data-s="${(p.name + ' ' + (p.phone || '')).toLowerCase()}">
      <a class="cn-ph" href="${q({ p: p.key })}"><span class="grow"><b>${p.name}</b>${p.phone ? html` <span class="st-meta">${p.phone}</span>` : ''}</span>
        ${p.owe ? html`<span class="cn-owe">còn ${fmt(p.owe)}</span>` : html`<span class="cn-ok">✓ đã trả hết</span>`} ›</a>
      ${rs.map((r) => line(r))}</div>`; };
  const group = (g) => { const ps = P.filter((p) => p.grp === g && shown(p)).sort((a, b) => (b.owe > 0) - (a.owe > 0) || b.oldest - a.oldest || b.owe - a.owe);
    const sum = P.filter((p) => p.grp === g).reduce((t, p) => t + p.owe, 0);
    const add = { khach: '+ Ghi nợ khách', kho: '+ Kho tổng nợ', khac: '+ Thêm người nợ' }[g];
    return html`<section class="card stack cn-g" data-g="${g}"><div class="cn-gh"><div><h2>${GRP[g]}</h2><div class="st-meta">${GRP_HELP[g]}</div></div><b class="cn-gsum">${fmt(sum)}</b></div>
      ${ps.length ? ps.map(card) : html`<div class="st-meta">${onlyLate ? 'Không có.' : 'Không có ai nợ.'}</div>`}
      ${ed && !onlyLate ? html`<div><button type="button" class="btn sm secondary cn-new" data-g="${g}">${add}</button></div>` : ''}</section>`; };
  return {
    title: `Công nợ ${BR.code}`,
    html: html`${STYLE}<div class="cn-wrap"><div class="page-head"><div><h1>Công nợ</h1><div class="sub">Người nợ quán theo từng cơ sở</div></div></div>
      <nav class="branch-tabs" aria-label="Cơ sở">${D.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${'#/quan-ly/cong-no?cn=' + b.id}" title="${b.name}">${b.code}</a>`)}</nav>
      <div class="cn-ks">
        <a class="cn-k tot ${gOn ? '' : 'on'}" href="${q({ qua: params.qua })}"><span class="k">Còn nợ</span><b>${fmt(total)}</b><small>${nOwe} người${gOn ? ' · bấm xem cả 3 nhóm' : ''}</small></a>
        <div class="cn-k paid"><span class="k">Đã thu tháng này</span><b>${fmt(paidM.reduce((t, r) => t + Number(r.amount || 0), 0))}</b><small>${paidM.length} khoản</small></div>
        ${['khach', 'kho', 'khac'].map(tile)}</div>
      <section class="card stack cn-sum">
        ${lateP.length ? html`<a class="cn-latebox ${onlyLate ? 'on' : ''}" href="${q({ qua: onlyLate ? '' : '1' })}">⚠ Khách nợ quá ${LATE} ngày: <b>${lateP.length} khách · ${fmt(lateP.reduce((t, p) => t + p.open.filter(late).reduce((s, r) => s + Number(r.amount), 0), 0))}</b> ${onlyLate ? '— bấm để xem tất cả' : '— bấm để lọc'}</a>` : html`<div class="st-meta">Không có khách nợ quá ${LATE} ngày.</div>`}
        <input class="input" id="cn-find" type="search" placeholder="Tìm tên / số điện thoại…" autocomplete="off"></section>
      ${['khach', 'kho', 'khac'].filter((g) => !gOn || g === gOn).map(group)}
      <div class="st-meta">Khách trả trong ca: nhân viên chọn ở phiếu chốt ca (chỉ Nợ khách hàng). Trả ngoài ca: bấm vào người → <b>Đã thu</b> (Sổ quỹ cộng vào). Khoản chi của ca thành nợ: Đối soát ca › Thu chi › <b>Thành nợ</b>.</div></div>`,
    mount() {
      $('#cn-find').addEventListener('input', (e) => { const s = e.target.value.trim().toLowerCase();
        $$('.cn-p').forEach((x) => { x.hidden = !!s && !x.dataset.s.includes(s); }); });
      $$('.cn-new').forEach((b) => b.addEventListener('click', () => newDebt(b.dataset.g)));
    },
  };

  // ---------- khung thao tác
  function err(dl, e) { dl.querySelector('.cn-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
  function namesOf(g) { return [...new Set(P.filter((p) => p.grp === g).map((p) => p.name))]; }
  function bindUnthu() {
    $$('.cn-unthu').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Bỏ lần thu này? Khoản nợ quay lại "chưa trả", Sổ quỹ bỏ khoản thu.')) return;
      b.disabled = true;
      try { await rpc('app_cn_debt_uncollect', { p_id: Number(b.dataset.id) }); flash('Đã bỏ lần thu.'); rerender(); } catch (e) { b.disabled = false; alert(e.message); }
    }));
  }
  function newDebt(g, p = null) {
    const kind0 = g === 'khach' ? 'bill' : 'muon';
    const dl = dialog(html`<form class="stack cn-dlg" style="gap:12px"><h2 style="margin:0">${p ? `Ghi thêm nợ — ${p.name}` : `Ghi nợ — ${BR.code}`}</h2>
      ${p ? '' : html`<div class="pc-line" role="radiogroup" aria-label="Nhóm">${Object.entries(GRP_SHORT).map(([k, l]) => html`<label class="radio-pill"><input type="radio" name="grp" value="${k}" ${k === g ? 'checked' : ''}> ${l}</label>`)}</div>`}
      ${p ? '' : html`<label class="field"><span>Tên người nợ</span><input class="input" name="name" list="cn-names" autocomplete="off" value="${g === 'kho' ? 'Kho tổng' : ''}" placeholder="vd: Anh Thắng, Bàn 5"><datalist id="cn-names"></datalist></label>
        <label class="field"><span>Số điện thoại</span><input class="input" name="phone" inputmode="tel" autocomplete="off"></label>`}
      <div class="pc-line" role="radiogroup" aria-label="Loại nợ">${[['bill', 'Nợ HĐ', 'khách chưa trả hoá đơn'], ['muon', 'Nợ TM', 'cầm tiền mặt của quán'], ['ck', 'Nợ CK', 'quán chuyển khoản cho']].map(([k, l, t]) => html`<label class="radio-pill" title="${t}"><input type="radio" name="kind" value="${k}" ${k === kind0 ? 'checked' : ''}> ${l}</label>`)}</div>
      <label class="field"><span>Số tiền nợ</span><input class="input money" name="amount" inputmode="numeric" autocomplete="off"></label>
      <label class="field"><span>Ngày nợ</span><input class="input" type="date" name="date" value="${today}" max="${today}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" placeholder="vd: trả hộ tiền sữa, hẹn trả cuối tuần"></label>
      <label class="cn-fo"><input type="checkbox" name="fund_out"> <span>Tiền đưa từ <b>quỹ</b> (Nợ TM / Nợ CK) — Sổ quỹ trừ ra</span></label>
      <div class="cn-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi nợ</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    const fill = () => { const gg = p ? p.grp : f.grp.value; const dlist = dl.querySelector('#cn-names'); if (dlist) dlist.innerHTML = str(html`${namesOf(gg).map((n) => html`<option value="${n}"></option>`)}`);
      const k = [...f.kind].find((x) => x.checked)?.value; f.fund_out.disabled = k === 'bill'; if (k === 'bill') f.fund_out.checked = false; };
    fill(); f.addEventListener('change', fill);
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      const gg = p ? p.grp : f.grp.value;
      try {
        await rpc('app_cn_debt_save', { p_id: null, p: { branch_id: cn, grp: gg, name: p ? (p.rows.find((r) => r.by_ql)?.name || p.name) : f.name.value, phone: p ? p.phone || '' : f.phone.value,
          kind: [...f.kind].find((x) => x.checked).value, amount: parseMoney(f.amount.value), date: f.date.value, note: f.note.value, fund_out: f.fund_out.checked } });
        dl.close(); flash('Đã ghi nợ.'); rerender();
      } catch (e) { btn.disabled = false; err(dl, e); }
    });
  }
  function collect(p) {
    const dl = dialog(html`<form class="stack cn-dlg" style="gap:12px"><h2 style="margin:0">Đã thu — ${p.name}</h2>
      <div>Còn nợ <b>${vnd(p.owe)}</b> · ${p.open.length} khoản</div>
      <div class="st-meta">Web trừ dần từ <b>khoản cũ nhất</b>. Trả một phần thì phần còn lại vẫn là nợ. Sổ quỹ cộng khoản thu vào.</div>
      <label class="field"><span>Số tiền người đó trả</span><input class="input money" name="amount" inputmode="numeric" autocomplete="off" value="${fmt(p.owe)}"></label>
      <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" checked> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan"> Chuyển khoản</label></div>
      <label class="field"><span>Ngày thu</span><input class="input" type="date" name="date" value="${today}" max="${today}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off"></label>
      <div class="cn-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi đã thu</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
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
        location.hash = q({ p: `${g}|${dispName({ ...p.rows[0], name: f.name.value.trim() }).toLowerCase()}` });
      } catch (e) { btn.disabled = false; err(dl, e); }
    });
  }
}

const STYLE = html`<style>
  .cn-wrap { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  .cn-sum { gap: 8px; } .cn-big { font-size: 18px; } .cn-big b { font-size: 22px; color: #b91c1c; }
  .cn-ks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .cn-k { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); color: inherit; text-decoration: none; min-width: 0; }
  .cn-k .k { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--ink-2); } .cn-k b { font-size: 19px; font-variant-numeric: tabular-nums; } .cn-k small { color: var(--ink-2); font-size: 12px; }
  .cn-k.on { border-color: var(--accent, #8b5a2b); box-shadow: 0 0 0 2px var(--accent, #8b5a2b) inset; } .cn-k.tot b { color: #b91c1c; } .cn-k.paid b { color: var(--ok-ink); }
  .cn-latebox { display: block; padding: 8px 10px; border-radius: 10px; background: var(--warn-bg); color: #92400e; text-decoration: none; }
  .cn-latebox.on { outline: 2px solid #d97706; }
  .cn-g { gap: 8px; } .cn-gh { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; } .cn-gh h2 { margin: 0; } .cn-gsum { font-size: 17px; white-space: nowrap; }
  .cn-p { border-top: 1px solid var(--line); padding: 8px 0 4px; } .cn-p.done { opacity: .55; } .cn-p[hidden] { display: none; }
  .cn-ph { display: flex; gap: 8px; align-items: baseline; color: inherit; text-decoration: none; padding: 2px 0 4px; } .cn-ph .grow { min-width: 0; overflow-wrap: anywhere; }
  .cn-owe { font-weight: 800; color: #b91c1c; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cn-l { padding: 4px 0 4px 10px; border-left: 3px solid var(--line); margin: 4px 0; font-size: 14px; } .cn-l.done { opacity: .6; border-left-color: var(--ok-line); }
  .cn-l1 { display: flex; justify-content: space-between; gap: 8px; } .cn-l1 span { min-width: 0; } .cn-amt { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cn-l2 { color: var(--ink-2); } .cn-late { color: #b91c1c; font-weight: 700; } .cn-ok { color: var(--ok-ink); font-weight: 600; }
  .cn-btns { display: flex; gap: 8px; flex-wrap: wrap; } .cn-btns .btn { width: auto; }
  .cn-dlg { width: min(460px, calc(100vw - 56px)); } .cn-fo { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
</style>`;
