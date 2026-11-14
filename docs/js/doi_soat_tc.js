// Đối soát dòng thu chi ở phiếu chốt ca: chọn nhóm (hoặc "Không tính") rồi bấm Đối soát.
// Dùng chung cho trang Đối soát (gom việc) và bước Tiền của trang Đối soát ca.
import { rpc } from './sb.js';
import { dmy, dt, fmt } from './tien.js';
import { dialog, html, showSaved, str } from './ui.js';

const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const GRP_NO = { khach: 'Nợ khách hàng', kho: 'Nợ kho tổng', khac: 'Nợ khác' };   // bước 95

export const DT_CSS = html`<style>
  .dt-r { display: grid; grid-template-columns: minmax(0, 1fr) 110px minmax(0, 320px); gap: 10px; align-items: center; padding: 8px 4px; border-top: 1px solid var(--line-soft, var(--line)); }
  .dt-r[hidden] { display: none; }
  .dt-r.todo { background: var(--warn-bg); border-radius: 8px; }
  .dt-m { min-width: 0; overflow-wrap: anywhere; }
  .dt-a { font-weight: 700; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .dt-a.neg { color: #b91c1c; } .dt-a.pos { color: var(--ok-ink); }
  .dt-do { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; min-width: 0; }
  .dt-do select { width: 170px; max-width: 100%; }
  .dt-emp { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px; } .dt-emp select { width: auto; max-width: 100%; }
  @media (max-width: 760px) { .dt-r { grid-template-columns: minmax(0, 1fr) auto; } .dt-do, .dt-act { grid-column: 1 / -1; justify-content: flex-start; } .dt-do select { flex: 1 1 160px; width: auto; } }
</style>`;

// rows: dòng dạng app_tc_list / app_ds_todo (src 'ca'); cats: danh mục nhóm; brById: Map id → {code}
export function tcList(box, rows, { cats = [], brById = null, showReport = true, onChange = () => {}, emps = null, toDebt = false, onDel = null } = {}) {
  const catsOf = (kind) => cats.filter((c) => c.kind === kind && c.active);
  const sel = (r) => {
    // "Chi lương – …" (người trả lương tiền mặt, bước 39): chọn sẵn nhóm Lương
    const luong = r.status === 'cho' && !r.category_id && /^Chi lương – /.test(r.note || '') ? (catsOf(r.kind).find((c) => c.name === 'Lương') || {}).id : null;
    const v = r.status === 'cho' ? r.category_id || luong || '' : r.excluded ? 'x' : r.category_id || '';
    return html`<select class="input sm dt-cat" aria-label="Nhóm">${v === '' ? html`<option value="">— Chọn nhóm —</option>` : ''}${catsOf(r.kind).map((c) => html`<option value="${c.id}" ${String(v) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}<option value="x" ${v === 'x' ? 'selected' : ''}>Không tính</option></select>`;
  };
  // bước 90: khoản chi lương tiền mặt → gán cho nhân viên (không bắt buộc) — Bảng công cộng vào "Lương tiền mặt đã trả"
  const isLuong = (r) => r.kind === 'chi' && r.pay === 'tien_mat' && (/lương/i.test(r.note || '') || r.category === 'Lương' || !!r.employee_id);
  const empSel = (r) => (emps && isLuong(r) ? html`<label class="dt-emp st-meta">Gán cho nhân viên <i>(không bắt buộc)</i> <select class="input sm dt-empsel" ${r.locked ? 'disabled' : ''}><option value="">— Không gán —</option>${emps.map((e) => html`<option value="${e.id}" ${String(e.id) === String(r.employee_id || '') ? 'selected' : ''}>${e.code} – ${e.name}</option>`)}</select></label>` : '');
  const row = (r, i) => {
    const br = brById ? brById.get(r.branch_id) : null;
    const canDebt = toDebt && r.src === 'ca' && r.kind === 'chi' && !r.auto && !r.locked && !r.ka_n;   // bước 95
    const debtBtn = canDebt ? html`<button type="button" class="btn sm secondary dt-2no">Thành nợ</button>` : '';
    // bước 96: đối soát ca — xoá khoản thu chi (bắt buộc lý do); không xoá dòng tự thêm / đã thành nợ / cho vay / đã chia âm tiền / tháng đã chốt
    const delBtn = onDel && r.src === 'ca' && !r.auto && !r.locked && !r.debt && !r.loan_id && !r.ka_n ? html`<button type="button" class="btn sm secondary danger dt-del">Xoá</button>` : '';
    const act = r.debt ? html`<span class="dt-do"><span class="pill warn">→ ${GRP_NO[r.debt.grp] || 'Nợ'}: ${r.debt.name}</span> <span class="st-meta">không tính chi phí</span>${!r.locked && !r.debt.closed ? html`<button type="button" class="btn sm secondary dt-undebt">Bỏ</button>` : ''}</span>`
      : r.locked ? html`<span class="st-meta">Tháng đã chốt</span>`
      : r.status === 'cho' ? html`<span class="dt-do">${sel(r)}<button type="button" class="btn sm dt-ok">Đối soát</button>${debtBtn}${delBtn}</span>`
      : html`<span class="dt-do"><span class="pill ok">Đã đối soát</span> <span class="st-meta">${r.excluded ? 'Không tính' : r.category || ''}</span><button type="button" class="btn sm secondary dt-undo">Bỏ đối soát</button>${debtBtn}${delBtn}</span>`;
    return html`<div class="dt-r ${r.status === 'cho' ? 'todo' : ''}" data-i="${i}" data-br="${r.branch_id}">
      <div class="dt-m"><strong>${r.note || '(không ghi nội dung)'}</strong>
        <div class="st-meta">${dmy(r.date)}${br ? ` · ${br.code}` : ''}${showReport ? html` · <a href="#/quan-ly/doi-soat/ca?id=${r.report_id}">Phiếu ca ${r.shift}</a>` : ''} · ${PAY[r.pay] || ''}${r.by ? ` · ${r.by}` : ''}${r.status === 'da' && r.checked_at ? ` · đối soát ${r.checked_by || ''} ${dt(r.checked_at)}` : ''}</div>
        ${empSel(r)}</div>
      <div class="dt-a ${r.kind === 'chi' ? 'neg' : 'pos'}">${r.kind === 'chi' ? '−' : '+'}${fmt(r.amount)}đ</div>
      <div class="dt-act">${act}</div></div>`;
  };
  box.innerHTML = str(rows.length ? html`${rows.map(row)}` : html`<div class="st-meta" style="padding:6px 0">Không có khoản thu chi nào.</div>`);
  const call = async (b, r, catVal, ok) => {
    b.disabled = true;
    try {
      await rpc('app_tc_check', { p_report: r.report_id, p_mkey: r.mkey, p_category: catVal && catVal !== 'x' ? Number(catVal) : null, p_excluded: catVal === 'x', p_checked: ok });
      showSaved(ok ? 'Đã đối soát khoản thu chi' : 'Đã chuyển về chờ đối soát'); onChange();
    } catch (e) { b.disabled = false; showSaved(e.message, true); }
  };
  box.querySelectorAll('.dt-ok').forEach((b) => b.addEventListener('click', () => {
    const el = b.closest('.dt-r'); const r = rows[Number(el.dataset.i)]; const s = el.querySelector('.dt-cat');
    if (!s.value) { showSaved('Chọn nhóm (hoặc "Không tính") trước khi đối soát.', true); s.focus(); return; }
    call(b, r, s.value, true);
  }));
  box.querySelectorAll('.dt-empsel').forEach((s) => s.addEventListener('change', async () => {
    const r = rows[Number(s.closest('.dt-r').dataset.i)]; s.disabled = true;
    try { await rpc('app_tc_move_emp', { p_report: r.report_id, p_mkey: r.mkey, p_emp: s.value ? Number(s.value) : null }); r.employee_id = s.value || null; showSaved(s.value ? 'Đã gán — Bảng công ghi lương tiền mặt đã trả' : 'Đã bỏ gán'); }
    catch (e) { showSaved(e.message, true); }
    s.disabled = false;
  }));
  // bước 95: khoản chi của ca → nợ (Nợ khách hàng / Nợ kho tổng / Nợ khác)
  box.querySelectorAll('.dt-2no').forEach((b) => b.addEventListener('click', async () => {
    const r = rows[Number(b.closest('.dt-r').dataset.i)];
    const g0 = /kho\s*t[ổo]ng/i.test(r.note || '') ? 'kho' : 'khac';
    let names = {}; try { const B = await rpc('app_cn_book', { p_branch: r.branch_id }); (B.rows || []).forEach((x) => { (names[x.grp] = names[x.grp] || new Set()).add(x.name); }); } catch (_) { /* bỏ qua */ }
    const d = dialog(html`<form class="stack" style="gap:12px;width:min(460px, calc(100vw - 56px))"><h2 style="margin:0">Thành nợ</h2>
      <div><strong>${r.note || '(không ghi nội dung)'}</strong> · chi ${PAY[r.pay] || ''} <b>${fmt(r.amount)}đ</b></div>
      <div class="pc-line" role="radiogroup" aria-label="Nhóm">${Object.entries(GRP_NO).map(([k, l]) => html`<label class="radio-pill"><input type="radio" name="grp" value="${k}" ${k === g0 ? 'checked' : ''}> ${l}</label>`)}</div>
      <label class="field"><span>Người nợ</span><input class="input" name="name" list="dt-no-names" autocomplete="off" value="${g0 === 'kho' ? 'Kho tổng' : ''}" placeholder="vd: Kho tổng, Anh Huy"><datalist id="dt-no-names"></datalist></label>
      <label class="field"><span>Số điện thoại</span><input class="input" name="phone" inputmode="tel" autocomplete="off"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" value="${r.note || ''}"></label>
      <div class="st-meta">Khoản chi này <b>không tính chi phí</b>, số tiền của ca không đổi; khoản nợ vào tab Công nợ (${r.pay === 'chuyen_khoan' ? 'Nợ CK' : 'Nợ TM'} ${fmt(r.amount)}đ). Chỉ một phần là nợ: tách thành 2 dòng ở mục <b>Sửa / thêm khoản thu chi</b> rồi đổi dòng nợ.</div>
      <div class="dt-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi thành nợ</button></div></form>`);
    const f = d.querySelector('form');
    const fill = () => { d.querySelector('#dt-no-names').innerHTML = str(html`${[...(names[f.grp.value] || [])].map((n) => html`<option value="${n}"></option>`)}`); };
    fill(); f.addEventListener('change', (e) => { if (e.target.name === 'grp') { fill(); if (f.grp.value === 'kho' && !f.name.value) f.name.value = 'Kho tổng'; } });
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try { await rpc('app_tc_move_to_debt', { p_report: r.report_id, p_mkey: r.mkey, p_grp: f.grp.value, p_name: f.name.value, p_phone: f.phone.value, p_note: f.note.value });
        d.close(); showSaved('Đã ghi thành nợ — xem ở tab Công nợ'); onChange(); }
      catch (e) { btn.disabled = false; d.querySelector('.dt-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }));
  box.querySelectorAll('.dt-undebt').forEach((b) => b.addEventListener('click', async () => {
    const r = rows[Number(b.closest('.dt-r').dataset.i)];
    if (!confirm(`Bỏ "thành nợ" cho khoản "${r.note || ''}"? Khoản nợ bị xoá, khoản chi quay lại chờ chọn nhóm.`)) return;
    b.disabled = true;
    try { await rpc('app_tc_move_undebt', { p_report: r.report_id, p_mkey: r.mkey }); showSaved('Đã bỏ thành nợ'); onChange(); } catch (e) { b.disabled = false; showSaved(e.message, true); }
  }));
  box.querySelectorAll('.dt-del').forEach((b) => b.addEventListener('click', () => onDel(rows[Number(b.closest('.dt-r').dataset.i)])));
  box.querySelectorAll('.dt-undo').forEach((b) => b.addEventListener('click', () => {
    const r = rows[Number(b.closest('.dt-r').dataset.i)]; call(b, r, r.excluded ? 'x' : r.category_id, false);
  }));
}
