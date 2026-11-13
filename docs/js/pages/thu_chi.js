// Quản lý ca › Thu chi: mọi khoản thu / chi của cơ sở trong tháng
//  * Quản lý tự tạo → Đã đối soát.
//  * Từng dòng thu chi ở phiếu chốt ca → Chờ đối soát; quản lý chọn nhóm (hoặc "Không tính") rồi bấm Đối soát.
//  * Khoản âm (bước 34): mỗi người chịu thiếu tiền = 1 phiếu chi "Thiếu tiền ca – trừ lương" trong danh sách; không tính vào chi phí quán.
//    Quản lý + Chủ sửa (người chịu, số tiền, Trừ lương / Đã bù / Miễn) hoặc xóa được tới khi chốt tháng.
//  * Bước 65: đổi nhóm ngay tại dòng (chọn nhóm = đã đối soát), sửa khoản phiếu ca (số tiền / nội dung / TM–CK, vào bản đối soát),
//    tích nhiều dòng → đổi nhóm hàng loạt.
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, norm, showSaved, str } from '../ui.js';
import { KA_STATUS } from './phieu_ca.js';
import { mountLoans } from '../cho_vay.js';

export const perm = 'doi_soat';
const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const F = { st: '', kind: '', src: '', q: '', pay: '', type: '', cat: '' };
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };
const lastDay = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };

export function monthOf(params) {
  if (/^\d{4}-\d{2}$/.test(params.thang || '')) return params.thang;
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '')) return params.ngay.slice(0, 7);
  return vnToday().slice(0, 7);
}

export async function render(ctx) {
  const { params } = ctx;
  const month = monthOf(params);
  if (params.xem === 'khoan-am') F.src = 'ka';   // đường dẫn cũ "Khoản âm" → lọc phiếu trừ lương
  const cn = params.cn && params.cn !== 'all' ? Number(params.cn) : null;
  const [D, FT] = await Promise.all([rpc('app_tc_list', { p_branch: cn, p_from: `${month}-01`, p_to: lastDay(month) }), rpc('app_fin_types').catch(() => ({ types: [], cats: [] }))]);
  // bước 57: loại (tầng trên nhóm)
  const typeById = new Map(FT.types.map((t) => [t.id, t])); const catById = new Map(FT.cats.map((c) => [c.id, c]));
  const typeOf = (r) => (r.category_id ? typeById.get(catById.get(r.category_id)?.type_id) || null : null);
  const path = (r) => { const t = typeOf(r); return `${t ? t.name + ' › ' : ''}${r.category || 'Chưa phân nhóm'}`; };
  const brById = new Map(D.branches.map((b) => [b.id, b]));
  const cats = (kind) => D.categories.filter((c) => c.kind === kind && c.active);
  const q = (o) => '#/quan-ly/thu-chi?' + Object.entries({ thang: month, cn: cn || 'all', ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const rows = D.rows.map((r, i) => ({ ...r, i }));
  const counted = rows.filter((r) => !r.excluded);
  const sum = (a) => a.reduce((s, r) => s + Number(r.amount), 0);
  const thu = sum(counted.filter((r) => r.kind === 'thu')); const chi = sum(counted.filter((r) => r.kind === 'chi'));
  const pend = rows.filter((r) => r.status === 'cho');
  const kaRows = rows.filter((r) => r.src === 'ka'); const luong = sum(kaRows.filter((r) => r.ka_status === 'tru_luong'));
  // tách tiền mặt / chuyển khoản (phiếu trừ lương không phải tiền thật ra khỏi quỹ → không tính vào 2 thẻ)
  const byPay = (pm) => { const a = counted.filter((r) => r.src !== 'ka' && (r.pay || 'tien_mat') === pm); const t = sum(a.filter((r) => r.kind === 'thu')); const c = sum(a.filter((r) => r.kind === 'chi')); return { thu: t, chi: c, n: a.length }; };
  const PM = { tien_mat: byPay('tien_mat'), chuyen_khoan: byPay('chuyen_khoan') };
  const chiRows = counted.filter((r) => r.kind === 'chi' && r.src !== 'ka');
  const byType = []; chiRows.forEach((r) => {
    const t = typeOf(r); const tk = t ? t.id : 0; let g = byType.find((x) => x.id === tk);
    if (!g) byType.push(g = { id: tk, name: t ? t.name : (r.category_id ? 'Chưa có loại' : 'Chưa phân nhóm (chờ đối soát)'), sort: t ? t.sort_order : 999, sum: 0, cats: [] });
    g.sum += Number(r.amount); const ck = r.category_id || 0; let c = g.cats.find((x) => x.id === ck);
    if (!c) g.cats.push(c = { id: ck, name: r.category || '—', sum: 0, n: 0 }); c.sum += Number(r.amount); c.n += 1;
  });
  byType.sort((a, b) => a.sort - b.sort); byType.forEach((g) => g.cats.sort((a, b) => b.sum - a.sum));
  const chiTot = byType.reduce((t, g) => t + g.sum, 0);
  const pct = (v) => (chiTot ? Math.round((v / chiTot) * 100) : 0);
  const pmTag = (r) => (r.src === 'ka' ? html`<span class="tc-pm ka" title="Phiếu trừ lương">TL</span>` : (r.pay || 'tien_mat') === 'chuyen_khoan' ? html`<span class="tc-pm ck" title="Chuyển khoản">CK</span>` : html`<span class="tc-pm tm" title="Tiền mặt">TM</span>`);

  // nhóm theo loại (bước 57); withX = thêm "Không tính" (chỉ khoản phiếu ca)
  const catOpts = (k, sel, withX, blank = true) => { const cs = cats(k); const ts = FT.types.filter((t) => t.kind === k); const loose = cs.filter((c) => !ts.some((t) => t.id === catById.get(c.id)?.type_id));
    const o = (c) => html`<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${c.name}</option>`;
    return html`${blank ? html`<option value="">— Chọn nhóm —</option>` : ''}${ts.map((t) => { const g = cs.filter((c) => catById.get(c.id)?.type_id === t.id); return g.length ? html`<optgroup label="${t.name}">${g.map(o)}</optgroup>` : ''; })}${loose.map(o)}${withX ? html`<option value="x" ${sel === 'x' ? 'selected' : ''}>Không tính</option>` : ''}`; };
  const catSel = (r) => { const v = r.status === 'cho' ? r.category_id || '' : r.excluded ? 'x' : r.category_id || '';
    return html`<select class="input sm tc-cat" aria-label="Nhóm" title="Chọn nhóm là đối soát luôn">${catOpts(r.kind, v, r.src === 'ca', v === '')}</select>`; };
  const lead = (r, pick) => html`<span class="tc-lead">${pick && !r.locked ? html`<input type="checkbox" class="tc-pick" aria-label="Chọn khoản">` : html`<span class="tc-pick0"></span>`}${pmTag(r)}</span>`;
  const kaRow = (r) => {
    const br = brById.get(r.branch_id); const st = KA_STATUS[r.ka_status] || [r.ka_status, 'mute'];
    const act = r.locked ? html`<span class="st-meta">Tháng đã chốt</span>`
      : html`<span class="toolbar" style="gap:6px"><button type="button" class="btn sm secondary ka-ed">Sửa</button><button type="button" class="btn sm secondary danger ka-del" aria-label="Xóa phiếu">×</button></span>`;
    return html`<div class="tc-r ka" data-i="${r.i}" data-st="da" data-kind="chi" data-src="ka" data-pay="ka" data-type="" data-cat="" data-q="${norm(`${r.note} ${r.reason || ''} ${br?.code || ''} tru luong khoan am`)}">
      ${lead(r, false)}<div class="tc-m"><strong>${r.note}</strong>
        <div class="st-meta">${dmy(r.date)} · ${br?.code || ''} · <a href="#/ca/phieu?id=${r.report_id}">Phiếu ca ${r.shift}</a> · ${r.item_label}${r.reason ? ` · ${r.reason}` : ''}</div>
        ${r.reply ? html`<div class="st-meta ka-rep">Nhân viên giải trình: ${r.reply}</div>` : ''}
        ${r.status_note && !r.auto_tru ? html`<div class="st-meta">Ghi chú: ${r.status_note}</div>` : ''}</div>
      <div class="tc-a neg">−${fmt(r.amount)}đ</div>
      <div class="tc-s"><span class="pill ${st[1]}">${st[0]}${r.auto_tru ? ' (mặc định)' : ''}</span><div class="st-meta">${r.seen_at ? 'NV đã xem' : 'NV chưa xem'} · không tính chi phí quán</div></div>
      <div class="tc-act">${act}</div></div>`;
  };
  const row = (r) => {
    if (r.src === 'ka') return kaRow(r);
    const br = brById.get(r.branch_id);
    const src = r.src === 'ca' ? html`<a href="#/ca/phieu?id=${r.report_id}">Phiếu ca ${r.shift}</a>${r.by ? ` (${r.by})` : ''}` : html`Quản lý tạo · ${r.by || ''}`;
    const act = r.locked ? html`<span class="st-meta">Tháng đã chốt</span>`
      : html`<span class="tc-do">${catSel(r)}${r.src === 'ca' && r.status === 'cho' && r.category_id ? html`<button type="button" class="btn sm tc-okc" title="Đối soát với nhóm đang chọn">✓</button>` : ''}
          ${r.src === 'tay' ? html`<button type="button" class="btn sm secondary tc-ed">Sửa</button>${r.bank_out ? '' : html`<button type="button" class="btn sm secondary danger tc-del" aria-label="Xóa">×</button>`}`
            : r.auto ? '' : html`<button type="button" class="btn sm secondary tc-med">Sửa</button>`}</span>`;
    return html`<div class="tc-r ${r.status === 'cho' ? 'todo' : r.excluded ? 'off' : ''}" data-i="${r.i}" data-st="${r.status}" data-kind="${r.kind}" data-src="${r.src}" data-pay="${r.pay || 'tien_mat'}" data-type="${typeOf(r)?.id || ''}" data-cat="${r.category_id || ''}" data-q="${norm(`${r.note} ${r.category || ''} ${typeOf(r)?.name || ''} ${br?.code || ''} ${PAY[r.pay] || ''}`)}">
      ${lead(r, true)}<div class="tc-m"><strong>${r.note || '(không ghi nội dung)'}</strong>
        <div class="st-meta">${dmy(r.date)} · ${br?.code || ''} · ${src}${r.status === 'da' ? html` · <b>${r.excluded ? 'Không tính' : path(r)}</b>` : ''}${r.auto ? ' · khoản tự động' : ''}${r.bank_out ? ' · từ phiếu chi chuyển khoản (Đối soát ca)' : ''}</div></div>
      <div class="tc-a ${r.kind === 'chi' ? 'neg' : 'pos'}">${r.kind === 'chi' ? '−' : '+'}${fmt(r.amount)}đ</div>
      <div class="tc-s">${r.status === 'cho' ? html`<span class="pill warn">Chờ đối soát</span>` : html`<span class="pill ok" title="${r.src === 'ca' ? `${r.checked_by || ''} · ${dt(r.checked_at)}` : ''}">✓ Đã đối soát</span>`}
        ${r.src === 'ca' ? html`<div><a class="st-meta" href="#/quan-ly/doi-soat/ca?id=${r.report_id}">Đối soát ca ›</a></div>` : ''}</div>
      <div class="tc-act">${act}</div></div>`;
  };

  return {
    title: 'Thu chi',
    html: html`${STYLE}
      <div class="page-head"><div><h1>Thu chi</h1>
        <div class="sub">Khoản quản lý tạo: đã đối soát. Khoản từ phiếu chốt ca: <b>chọn nhóm ngay ở dòng là đối soát xong</b>, đổi lại lúc nào cũng được tới khi chốt tháng. Tích nhiều dòng để đổi nhóm một lần.</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div><button type="button" class="btn" id="tc-add">+ Thêm khoản thu / chi</button></div></div>
      <section class="card tc-bar">
        <div class="tc-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a>
          <strong>${monthLabel(month)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
        <nav class="branch-tabs" aria-label="Cơ sở"><a class="${!cn ? 'on' : ''}" href="${q({ cn: 'all' })}">Tất cả</a>
          ${D.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav></section>
      <div class="tc-pays">${[['tien_mat', 'Tiền mặt', 'tm'], ['chuyen_khoan', 'Chuyển khoản', 'ck']].map(([k, l, c]) => { const x = PM[k]; const left = x.thu - x.chi;
        return html`<button type="button" class="tc-pk ${c}" data-pay="${k}" aria-pressed="${F.pay === k}"><span class="tc-pk-h"><span class="tc-pm ${c}">${c.toUpperCase()}</span> ${l}<small>${x.n} khoản</small></span>
          <span class="tc-pk-g"><span>Thu</span><b class="pos">+${fmt(x.thu)}</b><span>Chi</span><b class="neg">−${fmt(x.chi)}</b><span>Thu − chi</span><b class="${left < 0 ? 'neg' : ''}">${left < 0 ? '−' : ''}${fmt(Math.abs(left))}đ</b></span></button>`; })}</div>
      <div class="tc-chips">
        <button type="button" class="tc-chip warn" id="tc-pend">Chờ đối soát: <b>${pend.length} khoản</b>${pend.length ? ` · ${vnd(sum(pend))}` : ' · đã hết'}</button>
        <button type="button" class="tc-chip neg" id="tc-ka">Trừ lương: <b>${vnd(luong)}</b> · ${kaRows.length} phiếu</button>
        <span class="st-meta">Tổng cả 2: thu ${vnd(thu)} · chi ${vnd(chi)}</span></div>
      ${byType.length ? html`<section class="card stack tc-types" style="gap:8px"><div class="tc-ty-h"><h2 style="margin:0">Chi theo loại</h2><span class="st-meta">${vnd(chiTot)} · bấm để lọc · <a href="#/cai-dat/thu-chi">Sửa loại & nhóm</a></span></div>
        ${byType.map((g) => html`<div class="tc-ty"><button type="button" class="tc-tyb" data-ft="${g.id || ''}" aria-pressed="${String(F.type) === String(g.id || '') && !!g.id}"><span class="grow"><b>${g.name}</b></span><span class="tc-meter"><i style="width:${pct(g.sum)}%"></i></span><b class="tc-tys">${fmt(g.sum)}</b><span class="st-meta">${pct(g.sum)}%</span></button>
          <div class="tc-tyc">${g.cats.map((c) => html`<button type="button" class="tc-cb" data-fc="${c.id || ''}" aria-pressed="${String(F.cat) === String(c.id || '') && !!c.id}"><span class="grow">${c.name} <span class="st-meta">· ${c.n} khoản</span></span><span>${fmt(c.sum)}</span></button>`)}</div></div>`)}</section>` : ''}
      <div id="tc-loans"></div>
      <section class="card stack" style="padding:14px;gap:10px">
        <div class="tc-seg" role="group" aria-label="Hình thức">${[['', 'Tất cả'], ['tien_mat', 'Tiền mặt'], ['chuyen_khoan', 'Chuyển khoản']].map(([k, l]) => html`<button type="button" data-fpay="${k}" aria-pressed="${F.pay === k}">${l}</button>`)}</div>
        <div class="toolbar" style="gap:8px">
          <select class="input sm" id="f-st" aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="cho" ${F.st === 'cho' ? 'selected' : ''}>Chờ đối soát</option><option value="da" ${F.st === 'da' ? 'selected' : ''}>Đã đối soát</option></select>
          <select class="input sm" id="f-kind" aria-label="Loại"><option value="">Thu và chi</option><option value="thu" ${F.kind === 'thu' ? 'selected' : ''}>Chỉ khoản thu</option><option value="chi" ${F.kind === 'chi' ? 'selected' : ''}>Chỉ khoản chi</option></select>
          <select class="input sm" id="f-src" aria-label="Nguồn"><option value="">Mọi nguồn</option><option value="ca" ${F.src === 'ca' ? 'selected' : ''}>Từ phiếu chốt ca</option><option value="tay" ${F.src === 'tay' ? 'selected' : ''}>Quản lý tạo</option><option value="ka" ${F.src === 'ka' ? 'selected' : ''}>Phiếu trừ lương (khoản âm)</option></select>
          <select class="input sm" id="f-type" aria-label="Loại"><option value="">Mọi loại</option>${FT.types.filter((t) => t.active).map((t) => html`<option value="${t.id}" ${String(F.type) === String(t.id) ? 'selected' : ''}>${t.kind === 'chi' ? 'Chi' : 'Thu'} · ${t.name}</option>`)}</select>
          <select class="input sm" id="f-cat" aria-label="Nhóm"><option value="">Mọi nhóm</option>${FT.cats.filter((c) => c.active).map((c) => html`<option value="${c.id}" data-t="${c.type_id || ''}" ${String(F.cat) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}</select>
          <input class="input sm" type="search" id="f-q" placeholder="Tìm nội dung, nhóm" value="${F.q}" style="flex:1 1 160px;min-width:0">
          <span class="st-meta" id="f-n"></span></div>
        <label class="st-meta tc-allw"><input type="checkbox" id="tc-all"> Chọn tất cả khoản đang hiện</label>
        <div id="tc-list">${rows.map(row)}</div>
        <div class="tc-bulk" id="tc-bulk" hidden><span>Đã chọn <b id="tc-bn">0</b> khoản</span>
          <select class="input sm" id="tc-bcat" aria-label="Nhóm cho các khoản đã chọn"></select>
          <button type="button" class="btn sm" id="tc-bgo">Đổi nhóm</button><button type="button" class="btn sm secondary" id="tc-bclr">Bỏ chọn</button>
          <span class="st-meta" id="tc-bmsg"></span></div>
        <div class="st-meta" id="tc-empty" hidden style="padding:12px 0">${rows.length ? 'Không có khoản nào khớp bộ lọc.' : 'Tháng này chưa có khoản thu chi nào.'}</div>
      </section>`,
    async mount() {
      const again = async (m) => { const y = window.scrollY; if (m) flash(m); await rerender(); window.scrollTo(0, y); };
      const apply = () => {
        const s = norm(F.q.trim()); let n = 0;
        $$('.tc-r').forEach((el) => {
          const ok = (!F.st || el.dataset.st === F.st) && (!F.kind || el.dataset.kind === F.kind) && (!F.src || el.dataset.src === F.src) && (!F.pay || el.dataset.pay === F.pay) && (!F.type || el.dataset.type === String(F.type)) && (!F.cat || el.dataset.cat === String(F.cat)) && (!s || el.dataset.q.includes(s));
          el.hidden = !ok; if (ok) n++;
          if (!ok) { const c = el.querySelector('.tc-pick'); if (c) c.checked = false; }
        });
        bulk?.();
        $('#f-n').textContent = `${n} khoản`; $('#tc-empty').hidden = n > 0;
        $$('[data-fpay]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fpay === F.pay)));
        $$('.tc-pk').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pay === F.pay)));
        $$('[data-ft]').forEach((b) => b.setAttribute('aria-pressed', String(!!F.type && b.dataset.ft === String(F.type))));
        $$('[data-fc]').forEach((b) => b.setAttribute('aria-pressed', String(!!F.cat && b.dataset.fc === String(F.cat))));
        $('#f-type').value = F.type; $('#f-cat').value = F.cat;
        [...$('#f-cat').options].forEach((o) => { o.hidden = !!F.type && !!o.value && o.dataset.t !== String(F.type); });
      };
      [['#f-st', 'st'], ['#f-kind', 'kind'], ['#f-src', 'src']].forEach(([sl, k]) => $(sl).addEventListener('change', (e) => { F[k] = e.target.value; apply(); }));
      $('#f-q').addEventListener('input', (e) => { F.q = e.target.value; apply(); });
      $('#f-type').addEventListener('change', (e) => { F.type = e.target.value; F.cat = ''; apply(); });
      $('#f-cat').addEventListener('change', (e) => { F.cat = e.target.value; apply(); });
      $$('[data-ft]').forEach((b) => b.addEventListener('click', () => { if (!b.dataset.ft) return; F.type = F.type === b.dataset.ft ? '' : b.dataset.ft; F.cat = ''; F.kind = ''; $('#f-kind').value = ''; apply(); }));
      $$('[data-fc]').forEach((b) => b.addEventListener('click', () => { if (!b.dataset.fc) return; F.cat = F.cat === b.dataset.fc ? '' : b.dataset.fc; F.type = ''; apply(); }));
      $$('[data-fpay]').forEach((b) => b.addEventListener('click', () => { F.pay = b.dataset.fpay; apply(); }));
      $$('.tc-pk').forEach((b) => b.addEventListener('click', () => { F.pay = F.pay === b.dataset.pay ? '' : b.dataset.pay; apply(); }));
      $('#tc-pend').addEventListener('click', () => { F.st = F.st === 'cho' ? '' : 'cho'; $('#f-st').value = F.st; apply(); });
      const rowOf = (b) => rows[Number(b.closest('.tc-r').dataset.i)];
      // bước 65: đổi nhóm hàng loạt
      let bsig = '';
      function bulk() {
        const P = $$('.tc-r:not([hidden]) .tc-pick:checked').map(rowOf);
        $('#tc-bulk').hidden = !P.length; $('#tc-bn').textContent = P.length;
        const vis = $$('.tc-r:not([hidden]) .tc-pick'); $('#tc-all').checked = !!vis.length && vis.every((c) => c.checked);
        const kinds = [...new Set(P.map((r) => r.kind))]; const allCa = P.every((r) => r.src === 'ca');
        const sig = kinds.join() + '|' + allCa; if (sig === bsig) return; bsig = sig;
        const mixed = kinds.length > 1; $('#tc-bcat').disabled = mixed; $('#tc-bgo').disabled = mixed;
        $('#tc-bmsg').textContent = mixed ? 'Đang chọn cả khoản thu và khoản chi — chọn riêng từng loại.' : '';
        $('#tc-bcat').innerHTML = mixed || !kinds.length ? '' : str(catOpts(kinds[0], '', allCa));
      }
      apply();
      $$('.tc-pick').forEach((c) => c.addEventListener('change', bulk));
      $('#tc-all').addEventListener('change', (e) => { $$('.tc-r:not([hidden]) .tc-pick').forEach((c) => { c.checked = e.target.checked; }); bulk(); });
      $('#tc-bclr').addEventListener('click', () => { $$('.tc-pick').forEach((c) => { c.checked = false; }); bulk(); });
      $('#tc-bgo').addEventListener('click', async (ev) => {
        const P = $$('.tc-r:not([hidden]) .tc-pick:checked').map(rowOf); const v = $('#tc-bcat').value;
        if (!v) { showSaved('Chọn nhóm cho các khoản đã chọn.', true); return; }
        ev.target.disabled = true;
        try {
          const n = await rpc('app_tc_bulk_cat', { p_items: P.map((r) => (r.src === 'ca' ? { src: 'ca', report_id: r.report_id, mkey: r.mkey } : { src: 'tay', id: r.id })), p_category: v === 'x' ? null : Number(v), p_excluded: v === 'x' });
          await again(`Đã đổi nhóm ${n} khoản.`);
        } catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
      });
      // đổi nhóm ngay tại dòng
      const setCat = async (r, v) => {
        if (r.src === 'ca') await rpc('app_tc_check', { p_report: r.report_id, p_mkey: r.mkey, p_category: v === 'x' ? null : Number(v), p_excluded: v === 'x', p_checked: true });
        else await rpc('app_tc_entry_save', { p_id: r.id, p: { branch_id: r.branch_id, entry_date: r.date, kind: r.kind, category_id: Number(v), note: r.note, amount: r.amount, pay_method: r.pay } });
      };
      $$('.tc-cat').forEach((s) => s.addEventListener('change', async () => {
        if (!s.value) return; s.disabled = true;
        try { await setCat(rowOf(s), s.value); await again(rowOf(s).status === 'cho' ? 'Đã đối soát khoản.' : 'Đã đổi nhóm.'); } catch (e) { showSaved(e.message, true); s.disabled = false; }
      }));
      $$('.tc-okc').forEach((b) => b.addEventListener('click', async () => {
        const s = b.closest('.tc-r').querySelector('.tc-cat'); b.disabled = true;
        try { await setCat(rowOf(b), s.value); await again('Đã đối soát khoản.'); } catch (e) { showSaved(e.message, true); b.disabled = false; }
      }));
      $$('.tc-med').forEach((b) => b.addEventListener('click', () => moveForm(rowOf(b))));
      $$('.tc-ed').forEach((b) => b.addEventListener('click', () => entryForm(rowOf(b))));
      $$('.tc-del').forEach((b) => b.addEventListener('click', async () => {
        const r = rowOf(b);
        if (!confirm(`Xóa khoản "${r.note}" (${vnd(r.amount)})?`)) return;
        try { await rpc('app_tc_entry_delete', { p_id: r.id }); await again('Đã xóa khoản.'); } catch (e) { showSaved(e.message, true); }
      }));
      $('#tc-add').addEventListener('click', () => entryForm({}));
      $('#tc-ka').addEventListener('click', () => { F.src = F.src === 'ka' ? '' : 'ka'; $('#f-src').value = F.src; apply(); });
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

      function entryForm(e) {
        const kind = e.kind || 'chi'; const br0 = e.branch_id || cn || (D.branches.length === 1 ? D.branches[0].id : '');
        const opts = (k, sel) => catOpts(k, sel, false);
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">${e.id ? 'Sửa khoản thu / chi' : 'Thêm khoản thu / chi'}</h2>
          <div class="st-meta">Khoản quản lý tạo được tính là <strong>đã đối soát</strong>.</div>
          ${e.bank_out ? html`<div class="alert warn">Khoản này tạo từ phiếu chi chuyển khoản ở Đối soát ca: chỉ đổi nhóm / nội dung ở đây. Sai số tiền thì xoá phiếu chi ở Đối soát ca rồi tạo lại.</div>` : ''}
          <div class="pc-line" role="radiogroup" aria-label="Loại"><label class="radio-pill"><input type="radio" name="kind" value="chi" ${kind === 'chi' ? 'checked' : ''}> Khoản chi</label><label class="radio-pill"><input type="radio" name="kind" value="thu" ${kind === 'thu' ? 'checked' : ''}> Khoản thu</label></div>
          <label class="field"><span>Cơ sở</span><select class="input" name="br">${br0 ? '' : html`<option value="">— Chọn cơ sở —</option>`}${D.branches.map((b) => html`<option value="${b.id}" ${String(br0) === String(b.id) ? 'selected' : ''}>${b.code} – ${b.name}</option>`)}</select></label>
          <label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${e.date || (vnToday().startsWith(month) ? vnToday() : month + '-01')}"></label>
          <label class="field"><span>Nhóm</span><select class="input" name="cat">${opts(kind, e.category_id || '')}</select></label>
          <label class="field"><span>Nội dung</span><input class="input" name="note" value="${e.note || ''}" placeholder="vd: Mua đá, tiền điện, bán bã cafe…" autocomplete="off"></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${e.amount ? fmt(e.amount) : ''}" autocomplete="off"></label>
          <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" ${(e.pay || 'tien_mat') === 'tien_mat' ? 'checked' : ''}> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan" ${e.pay === 'chuyen_khoan' ? 'checked' : ''}> Chuyển khoản</label></div>
          <div id="tc-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d);
        const f = d.querySelector('form');
        if (e.bank_out) f.querySelectorAll('[name=kind], [name=br], [name=date], [name=amt], [name=pay]').forEach((x) => { x.disabled = true; });
        f.addEventListener('change', (ev) => { if (ev.target.name === 'kind') f.cat.innerHTML = str(opts(ev.target.value, '')); });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const p = { branch_id: f.br.value || null, entry_date: f.date.value, kind: f.querySelector('input[name=kind]:checked').value, category_id: f.cat.value || null,
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
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d);
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

      await mountLoans($('#tc-loans'), cn ? D.branches.filter((b) => b.id === cn) : D.branches, (m) => again(m));   // bước 64: Cho vay
    },
  };
}

const STYLE = html`<style>
  .tc-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
  .tc-month { display: flex; align-items: center; gap: 10px; }
  .tc-month strong { font-size: 17px; min-width: 120px; text-align: center; }
  .tc-pays { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 10px; }
  .tc-pk { background: var(--card); border: 2px solid transparent; border-radius: 14px; box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; text-align: left; font: inherit; color: inherit; cursor: pointer; min-width: 0; }
  .tc-pk.tm { border-top: 4px solid #d97706; } .tc-pk.ck { border-top: 4px solid #2563eb; }
  .tc-pk[aria-pressed="true"].tm { border-color: #d97706; } .tc-pk[aria-pressed="true"].ck { border-color: #2563eb; }
  .tc-pk-h { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 15px; } .tc-pk-h small { margin-left: auto; font-weight: 500; color: var(--ink-2); font-size: 12px; }
  .tc-pk-g { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 12px; font-size: 14px; }
  .tc-pk-g b { justify-self: end; text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; } .tc-pk-g b.pos { color: var(--ok-ink); } .tc-pk-g b.neg { color: #b91c1c; }
  .tc-chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
  .tc-chip { font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); cursor: pointer; color: inherit; }
  .tc-chip.warn { border-color: #f59e0b; background: var(--warn-bg); } .tc-chip.neg { border-color: #fca5a5; }
  .tc-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; align-self: flex-start; max-width: 100%; }
  .tc-seg button { font: inherit; font-size: 14px; font-weight: 700; padding: 7px 12px; border: none; background: var(--card); color: var(--ink-2); cursor: pointer; }
  .tc-seg button + button { border-left: 1px solid var(--line); }
  .tc-seg button[aria-pressed="true"] { background: var(--primary); color: #fff; }
  .tc-types { padding: 14px; margin-bottom: 12px; }
  .tc-ty-h { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline; }
  .tc-ty { border-top: 1px solid var(--line); padding-top: 6px; }
  .tc-tyb, .tc-cb { display: flex; gap: 10px; align-items: center; width: 100%; font: inherit; color: inherit; background: none; border: 1px solid transparent; border-radius: 8px; padding: 6px 8px; cursor: pointer; text-align: left; }
  .tc-tyb[aria-pressed="true"], .tc-cb[aria-pressed="true"] { border-color: var(--primary); background: var(--subtle); }
  .tc-tyb .grow, .tc-cb .grow { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
  .tc-meter { flex: 0 0 90px; height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; } .tc-meter i { display: block; height: 100%; background: #b91c1c; opacity: .7; }
  .tc-tys { font-variant-numeric: tabular-nums; min-width: 96px; text-align: right; }
  .tc-tyc { display: flex; flex-direction: column; padding-left: 14px; font-size: 14px; } .tc-cb span:last-child { font-variant-numeric: tabular-nums; }
  @media (max-width: 560px) { .tc-meter { display: none; } .tc-tys { min-width: 0; } }
  .tc-pm { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 22px; padding: 0 5px; border-radius: 6px; font-size: 11px; font-weight: 800; letter-spacing: .03em; }
  .tc-pm.tm { background: #fef3c7; color: #92400e; } .tc-pm.ck { background: #dbeafe; color: #1e40af; } .tc-pm.ka { background: #fee2e2; color: #991b1b; }
  .tc-r.ka { border-left: 3px solid #fca5a5; }
  .ka-rep { background: var(--line-soft); border-radius: 6px; padding: 3px 6px; margin-top: 3px; }
  .tc-lead { display: inline-flex; align-items: center; gap: 6px; } .tc-pick { width: 18px; height: 18px; margin: 0; } .tc-pick0 { width: 18px; }
  .tc-allw { display: inline-flex; gap: 6px; align-items: center; align-self: flex-start; cursor: pointer; }
  .tc-bulk { position: sticky; bottom: 8px; z-index: 5; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 12px; border-radius: 12px; background: var(--card); border: 2px solid var(--primary); box-shadow: var(--shadow); }
  .tc-bulk[hidden] { display: none; } .tc-bulk select { flex: 1 1 180px; min-width: 0; width: auto; }
  .tc-r { display: grid; grid-template-columns: auto minmax(0, 1fr) 120px 140px minmax(0, 300px); gap: 10px; align-items: center; padding: 9px 6px; border-top: 1px solid var(--line-soft, var(--line)); }
  .tc-r[hidden] { display: none; }
  .tc-r.todo { background: var(--warn-bg); border-radius: 8px; }
  .tc-r.off .tc-a, .tc-r.off strong { color: var(--muted); text-decoration: line-through; }
  .tc-m { min-width: 0; overflow-wrap: anywhere; }
  .tc-a { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tc-a.neg { color: #b91c1c; } .tc-a.pos { color: var(--ok-ink); }
  .tc-act { display: flex; justify-content: flex-end; min-width: 0; }
  .tc-act .toolbar { flex-direction: row; flex-wrap: nowrap; width: auto; } .tc-act .toolbar .btn { width: auto; }
  .tc-do { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
  .tc-do select { width: 170px; max-width: 100%; }
  .tc-dlg { width: min(520px, calc(100vw - 56px)); }
  @media (max-width: 760px) {
    .tc-pays { gap: 8px; } .tc-pk { padding: 10px; } .tc-pk-g { font-size: 13px; gap: 2px 6px; }
    .tc-pk-h { font-size: 14px; gap: 6px; white-space: nowrap; } .tc-pk-h small { display: none; }
    .tc-r { grid-template-columns: auto minmax(0, 1fr) auto; row-gap: 4px; }
    .tc-s { grid-column: 2; } .tc-act { grid-column: 2 / -1; justify-content: flex-start; }
    .tc-do { justify-content: flex-start; flex-wrap: nowrap; width: 100%; } .tc-do select { flex: 1 1 auto; width: auto; min-width: 0; }
  }
</style>`;
