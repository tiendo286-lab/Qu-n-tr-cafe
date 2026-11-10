// Quản lý ca › Thu chi: mọi khoản thu / chi của cơ sở trong tháng
//  * Quản lý tự tạo → Đã đối soát.
//  * Từng dòng thu chi ở phiếu chốt ca → Chờ đối soát; quản lý chọn nhóm (hoặc "Không tính") rồi bấm Đối soát.
//  * Phần Khoản âm (thiếu tiền gán cho nhân viên) nằm ở nút chuyển "Khoản âm" ngay trên trang.
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, norm, showSaved, str } from '../ui.js';
import * as KA from './khoan_am.js';

export const perm = 'doi_soat';
const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const F = { st: '', kind: '', src: '', q: '' };
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };
const lastDay = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };

export function monthOf(params) {
  if (/^\d{4}-\d{2}$/.test(params.thang || '')) return params.thang;
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '')) return params.ngay.slice(0, 7);
  return vnToday().slice(0, 7);
}

// Nút chuyển giữa Thu chi và Khoản âm (dùng chung cho cả 2 phần)
export const switcher = (on, month) => html`<nav class="tc-switch" aria-label="Phần">
  <a class="${on === 'tc' ? 'on' : ''}" href="#/quan-ly/thu-chi?thang=${month}">Thu chi</a>
  <a class="${on === 'ka' ? 'on' : ''}" href="#/quan-ly/thu-chi?xem=khoan-am&thang=${month}">Khoản âm</a></nav>`;

export async function render(ctx) {
  const { params } = ctx;
  const month = monthOf(params);
  if (params.xem === 'khoan-am') {
    const p = await KA.render({ ...ctx, params: { ...params, thang: month } });
    return { ...p, html: html`${STYLE}${switcher('ka', month)}${p.html}` };
  }
  const cn = params.cn && params.cn !== 'all' ? Number(params.cn) : null;
  const D = await rpc('app_tc_list', { p_branch: cn, p_from: `${month}-01`, p_to: lastDay(month) });
  const brById = new Map(D.branches.map((b) => [b.id, b]));
  const cats = (kind) => D.categories.filter((c) => c.kind === kind && c.active);
  const q = (o) => '#/quan-ly/thu-chi?' + Object.entries({ thang: month, cn: cn || 'all', ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const rows = D.rows.map((r, i) => ({ ...r, i }));
  const counted = rows.filter((r) => !r.excluded);
  const sum = (a) => a.reduce((s, r) => s + Number(r.amount), 0);
  const thu = sum(counted.filter((r) => r.kind === 'thu')); const chi = sum(counted.filter((r) => r.kind === 'chi'));
  const pend = rows.filter((r) => r.status === 'cho');

  const catSel = (r) => { const v = r.status === 'cho' ? r.category_id || '' : r.excluded ? 'x' : r.category_id || '';
    return html`<select class="input sm tc-cat" aria-label="Nhóm">${v === '' ? html`<option value="">— Chọn nhóm —</option>` : ''}${cats(r.kind).map((c) => html`<option value="${c.id}" ${String(v) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}<option value="x" ${v === 'x' ? 'selected' : ''}>Không tính</option></select>`; };
  const row = (r) => {
    const br = brById.get(r.branch_id);
    const src = r.src === 'ca' ? html`<a href="#/ca/phieu?id=${r.report_id}">Phiếu ca ${r.shift}</a>${r.by ? ` (${r.by})` : ''}` : html`Quản lý tạo · ${r.by || ''}`;
    const act = r.locked ? html`<span class="st-meta">Tháng đã chốt</span>`
      : r.src === 'tay' ? html`<span class="toolbar" style="gap:6px"><button type="button" class="btn sm secondary tc-ed">Sửa</button><button type="button" class="btn sm secondary danger tc-del" aria-label="Xóa">×</button></span>`
      : r.status === 'cho' ? html`<span class="tc-do">${catSel(r)}<button type="button" class="btn sm tc-ok">Đối soát</button></span>`
      : html`<button type="button" class="btn sm secondary tc-undo">Bỏ đối soát</button>`;
    return html`<div class="tc-r ${r.status === 'cho' ? 'todo' : r.excluded ? 'off' : ''}" data-i="${r.i}" data-st="${r.status}" data-kind="${r.kind}" data-src="${r.src}" data-q="${norm(`${r.note} ${r.category || ''} ${br?.code || ''}`)}">
      <div class="tc-m"><strong>${r.note || '(không ghi nội dung)'}</strong>
        <div class="st-meta">${dmy(r.date)} · ${br?.code || ''} · ${src} · ${PAY[r.pay] || ''}${r.status === 'da' ? html` · ${r.excluded ? 'Không tính' : r.category || 'Chưa phân nhóm'}` : ''}</div></div>
      <div class="tc-a ${r.kind === 'chi' ? 'neg' : 'pos'}">${r.kind === 'chi' ? '−' : '+'}${fmt(r.amount)}đ</div>
      <div class="tc-s">${r.status === 'cho' ? html`<span class="pill warn">Chờ đối soát</span>` : html`<span class="pill ok">Đã đối soát</span>`}
        ${r.status === 'da' && r.src === 'ca' ? html`<div class="st-meta">${r.checked_by || ''} · ${dt(r.checked_at)}</div>` : ''}</div>
      <div class="tc-act">${act}</div></div>`;
  };

  return {
    title: 'Thu chi',
    html: html`${STYLE}${switcher('tc', month)}
      <div class="page-head"><div><h1>Thu chi</h1>
        <div class="sub">Khoản quản lý tự tạo thì đã đối soát. Khoản thu chi ghi ở phiếu chốt ca thì chờ đối soát: chọn nhóm (hoặc "Không tính") rồi bấm Đối soát. Phải đối soát hết thì mới chốt tháng được.</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div><button type="button" class="btn" id="tc-add">+ Thêm khoản thu / chi</button></div></div>
      <section class="card tc-bar">
        <div class="tc-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a>
          <strong>${monthLabel(month)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
        <nav class="branch-tabs" aria-label="Cơ sở"><a class="${!cn ? 'on' : ''}" href="${q({ cn: 'all' })}">Tất cả</a>
          ${D.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav></section>
      <div class="tc-kpis">
        <div class="tc-k pos"><span>Tổng thu</span><b>${vnd(thu)}</b></div>
        <div class="tc-k neg"><span>Tổng chi</span><b>${vnd(chi)}</b></div>
        <div class="tc-k"><span>Thu − chi</span><b class="${thu - chi < 0 ? 'neg' : ''}">${thu - chi < 0 ? '−' : ''}${vnd(Math.abs(thu - chi))}</b></div>
        <button type="button" class="tc-k warn" id="tc-pend"><span>Chờ đối soát</span><b>${pend.length} khoản</b><small>${pend.length ? vnd(sum(pend)) : 'Đã đối soát hết'}</small></button></div>
      <section class="card stack" style="padding:14px;gap:10px">
        <div class="toolbar" style="gap:8px">
          <select class="input sm" id="f-st" aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="cho" ${F.st === 'cho' ? 'selected' : ''}>Chờ đối soát</option><option value="da" ${F.st === 'da' ? 'selected' : ''}>Đã đối soát</option></select>
          <select class="input sm" id="f-kind" aria-label="Loại"><option value="">Thu và chi</option><option value="thu" ${F.kind === 'thu' ? 'selected' : ''}>Chỉ khoản thu</option><option value="chi" ${F.kind === 'chi' ? 'selected' : ''}>Chỉ khoản chi</option></select>
          <select class="input sm" id="f-src" aria-label="Nguồn"><option value="">Mọi nguồn</option><option value="ca" ${F.src === 'ca' ? 'selected' : ''}>Từ phiếu chốt ca</option><option value="tay" ${F.src === 'tay' ? 'selected' : ''}>Quản lý tạo</option></select>
          <input class="input sm" type="search" id="f-q" placeholder="Tìm nội dung, nhóm" value="${F.q}" style="flex:1 1 160px;min-width:0">
          <span class="st-meta" id="f-n"></span></div>
        <div id="tc-list">${rows.map(row)}</div>
        <div class="st-meta" id="tc-empty" hidden style="padding:12px 0">${rows.length ? 'Không có khoản nào khớp bộ lọc.' : 'Tháng này chưa có khoản thu chi nào.'}</div>
      </section>`,
    mount() {
      const apply = () => {
        const s = norm(F.q.trim()); let n = 0;
        $$('.tc-r').forEach((el) => {
          const ok = (!F.st || el.dataset.st === F.st) && (!F.kind || el.dataset.kind === F.kind) && (!F.src || el.dataset.src === F.src) && (!s || el.dataset.q.includes(s));
          el.hidden = !ok; if (ok) n++;
        });
        $('#f-n').textContent = `${n} khoản`; $('#tc-empty').hidden = n > 0;
      };
      [['#f-st', 'st'], ['#f-kind', 'kind'], ['#f-src', 'src']].forEach(([sl, k]) => $(sl).addEventListener('change', (e) => { F[k] = e.target.value; apply(); }));
      $('#f-q').addEventListener('input', (e) => { F.q = e.target.value; apply(); });
      $('#tc-pend').addEventListener('click', () => { F.st = F.st === 'cho' ? '' : 'cho'; $('#f-st').value = F.st; apply(); });
      apply();
      const rowOf = (b) => rows[Number(b.closest('.tc-r').dataset.i)];
      const check = async (b, r, catVal, ok) => {
        b.disabled = true;
        try {
          await rpc('app_tc_check', { p_report: r.report_id, p_mkey: r.mkey, p_category: catVal && catVal !== 'x' ? Number(catVal) : null, p_excluded: catVal === 'x', p_checked: ok });
          showSaved(ok ? 'Đã đối soát' : 'Đã chuyển về chờ đối soát'); rerender();
        } catch (e) { b.disabled = false; showSaved(e.message, true); }
      };
      $$('.tc-ok').forEach((b) => b.addEventListener('click', () => {
        const r = rowOf(b); const v = b.closest('.tc-r').querySelector('.tc-cat').value;
        if (!v) { showSaved('Chọn nhóm (hoặc "Không tính") trước khi đối soát.', true); b.closest('.tc-r').querySelector('.tc-cat').focus(); return; }
        check(b, r, v, true);
      }));
      $$('.tc-undo').forEach((b) => b.addEventListener('click', () => { const r = rowOf(b); check(b, r, r.excluded ? 'x' : r.category_id, false); }));
      $$('.tc-ed').forEach((b) => b.addEventListener('click', () => entryForm(rowOf(b))));
      $$('.tc-del').forEach((b) => b.addEventListener('click', async () => {
        const r = rowOf(b);
        if (!confirm(`Xóa khoản "${r.note}" (${vnd(r.amount)})?`)) return;
        try { await rpc('app_tc_entry_delete', { p_id: r.id }); flash('Đã xóa khoản.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $('#tc-add').addEventListener('click', () => entryForm({}));

      function entryForm(e) {
        const kind = e.kind || 'chi'; const br0 = e.branch_id || cn || (D.branches.length === 1 ? D.branches[0].id : '');
        const opts = (k, sel) => html`<option value="">— Chọn nhóm —</option>${cats(k).map((c) => html`<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}`;
        const d = dialog(html`<form class="stack tc-dlg" style="gap:12px"><h2 style="margin:0">${e.id ? 'Sửa khoản thu / chi' : 'Thêm khoản thu / chi'}</h2>
          <div class="st-meta">Khoản quản lý tạo được tính là <strong>đã đối soát</strong>.</div>
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
        f.addEventListener('change', (ev) => { if (ev.target.name === 'kind') f.cat.innerHTML = str(opts(ev.target.value, '')); });
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const p = { branch_id: f.br.value || null, entry_date: f.date.value, kind: f.querySelector('input[name=kind]:checked').value, category_id: f.cat.value || null,
            note: f.note.value, amount: parseMoney(f.amt.value), pay_method: f.querySelector('input[name=pay]:checked').value };
          try { await rpc('app_tc_entry_save', { p_id: e.id || null, p }); d.close(); flash(e.id ? 'Đã lưu khoản.' : 'Đã thêm khoản (đã đối soát).'); rerender(); }
          catch (err) { d.querySelector('#tc-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
        });
      }
    },
  };
}

const STYLE = html`<style>
  .tc-switch { display: inline-flex; gap: 4px; background: var(--card); border-radius: 999px; box-shadow: var(--shadow); padding: 4px; margin-bottom: 12px; max-width: 100%; }
  .tc-switch a { padding: 8px 18px; border-radius: 999px; font-weight: 700; font-size: 14px; text-decoration: none; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; }
  .tc-switch a.on { background: var(--primary); color: #fff; }
  .tc-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
  .tc-month { display: flex; align-items: center; gap: 10px; }
  .tc-month strong { font-size: 17px; min-width: 120px; text-align: center; }
  .tc-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
  .tc-k { background: var(--card); border: none; border-radius: 14px; box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; border-top: 4px solid var(--primary); min-width: 0; text-align: left; font: inherit; color: inherit; }
  .tc-k span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; }
  .tc-k b { font-size: 20px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .tc-k small { font-size: 13px; color: var(--ink-2); }
  .tc-k.pos { border-top-color: var(--ok-line); } .tc-k.pos b { color: var(--ok-ink); }
  .tc-k.neg { border-top-color: var(--off-line); } .tc-k.neg b, .tc-k b.neg { color: #b91c1c; }
  button.tc-k.warn { border-top-color: #f59e0b; cursor: pointer; }
  .tc-r { display: grid; grid-template-columns: minmax(0, 1fr) 120px 150px minmax(0, 300px); gap: 10px; align-items: center; padding: 10px 6px; border-top: 1px solid var(--line-soft, var(--line)); }
  .tc-r[hidden] { display: none; }
  .tc-r.todo { background: var(--warn-bg); border-radius: 8px; }
  .tc-r.off .tc-a, .tc-r.off strong { color: var(--muted); text-decoration: line-through; }
  .tc-m { min-width: 0; overflow-wrap: anywhere; }
  .tc-a { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tc-a.neg { color: #b91c1c; } .tc-a.pos { color: var(--ok-ink); }
  .tc-act { display: flex; justify-content: flex-end; min-width: 0; }
  .tc-do { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
  .tc-do select { width: 170px; max-width: 100%; }
  .tc-dlg { width: min(520px, calc(100vw - 56px)); }
  @media (max-width: 900px) { .tc-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 760px) {
    .tc-r { grid-template-columns: minmax(0, 1fr) auto; }
    .tc-s { grid-column: 1; } .tc-act { grid-column: 1 / -1; justify-content: flex-start; }
    .tc-do { justify-content: flex-start; } .tc-do select { flex: 1 1 160px; width: auto; }
    .tc-switch { display: flex; } .tc-switch a { flex: 1; text-align: center; padding: 8px 10px; }
  }
</style>`;
