// Đối soát dòng thu chi ở phiếu chốt ca: chọn nhóm (hoặc "Không tính") rồi bấm Đối soát.
// Dùng chung cho trang Đối soát (gom việc) và bước Tiền của trang Đối soát ca.
import { rpc } from './sb.js';
import { dmy, dt, fmt } from './tien.js';
import { html, showSaved, str } from './ui.js';

const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };

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
  @media (max-width: 760px) { .dt-r { grid-template-columns: minmax(0, 1fr) auto; } .dt-do { grid-column: 1 / -1; justify-content: flex-start; } .dt-do select { flex: 1 1 160px; width: auto; } }
</style>`;

// rows: dòng dạng app_tc_list / app_ds_todo (src 'ca'); cats: danh mục nhóm; brById: Map id → {code}
export function tcList(box, rows, { cats = [], brById = null, showReport = true, onChange = () => {}, emps = null } = {}) {
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
    const act = r.locked ? html`<span class="st-meta">Tháng đã chốt</span>`
      : r.status === 'cho' ? html`<span class="dt-do">${sel(r)}<button type="button" class="btn sm dt-ok">Đối soát</button></span>`
      : html`<span class="dt-do"><span class="pill ok">Đã đối soát</span> <span class="st-meta">${r.excluded ? 'Không tính' : r.category || ''}</span><button type="button" class="btn sm secondary dt-undo">Bỏ đối soát</button></span>`;
    return html`<div class="dt-r ${r.status === 'cho' ? 'todo' : ''}" data-i="${i}" data-br="${r.branch_id}">
      <div class="dt-m"><strong>${r.note || '(không ghi nội dung)'}</strong>
        <div class="st-meta">${dmy(r.date)}${br ? ` · ${br.code}` : ''}${showReport ? html` · <a href="#/quan-ly/doi-soat/ca?id=${r.report_id}">Phiếu ca ${r.shift}</a>` : ''} · ${PAY[r.pay] || ''}${r.by ? ` · ${r.by}` : ''}${r.status === 'da' && r.checked_at ? ` · đối soát ${r.checked_by || ''} ${dt(r.checked_at)}` : ''}</div></div>
      ${empSel(r)}</div>
      <div class="dt-a ${r.kind === 'chi' ? 'neg' : 'pos'}">${r.kind === 'chi' ? '−' : '+'}${fmt(r.amount)}đ</div>
      <div>${act}</div></div>`;
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
  box.querySelectorAll('.dt-undo').forEach((b) => b.addEventListener('click', () => {
    const r = rows[Number(b.closest('.dt-r').dataset.i)]; call(b, r, r.excluded ? 'x' : r.category_id, false);
  }));
}
