// Cài đặt › Loại & nhóm thu chi (bước 57): 2 tầng Loại › Nhóm. Chủ / Quản lý tổng sửa; người khác chỉ xem.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { $, $$, flash, html, showSaved } from '../ui.js';

export const perm = ['doi_soat', 'chot_thang'];

export async function render() {
  const D = await rpc('app_fin_types');
  const ed = !!D.can_edit; const dis = ed ? '' : 'disabled';
  const typesOf = (k) => D.types.filter((t) => t.kind === k);
  const typeSel = (c) => html`<select class="input sm tc-ct" aria-label="Loại của nhóm ${c.name}" ${dis}><option value="">— Chưa có loại —</option>${typesOf(c.kind).map((t) => html`<option value="${t.id}" ${t.id === c.type_id ? 'selected' : ''}>${t.name}</option>`)}</select>`;
  const catRow = (c) => html`<div class="tc-cr" data-cat="${c.id}"><input class="input sm tc-cn" value="${c.name}" aria-label="Tên nhóm" ${dis}>${typeSel(c)}
      <label class="st-meta tc-on"><input type="checkbox" class="tc-ca" ${c.active ? 'checked' : ''} ${dis}> Dùng</label></div>`;
  const block = (k, label) => {
    const groups = [...typesOf(k).map((t) => ({ t, cats: D.cats.filter((c) => c.type_id === t.id) })), { t: null, cats: D.cats.filter((c) => c.kind === k && !typesOf(k).some((t) => t.id === c.type_id)) }];
    return html`<section class="card stack" style="gap:10px"><h2 style="margin:0">${label}</h2>
      ${groups.filter((g) => g.t || g.cats.length).map((g) => html`<div class="tc-tb" ${g.t ? html`data-type="${g.t.id}"` : ''}>
        <div class="tc-th">${g.t ? html`<input class="input sm tc-tn" value="${g.t.name}" aria-label="Tên loại" ${dis}><label class="st-meta tc-on"><input type="checkbox" class="tc-ta" ${g.t.active ? 'checked' : ''} ${dis}> Dùng</label>` : html`<strong>Chưa có loại</strong>`}
          <span class="st-meta">${g.cats.length} nhóm</span></div>
        ${g.cats.length ? g.cats.map(catRow) : html`<div class="st-meta" style="padding:4px 0">Chưa có nhóm — thêm ở dưới.</div>`}</div>`)}
      ${ed ? html`<div class="tc-add"><input class="input sm" data-nt="${k}" placeholder="Tên loại ${label.toLowerCase()} mới" autocomplete="off"><button type="button" class="btn sm secondary" data-at="${k}">+ Thêm loại</button></div>
        <div class="tc-add"><input class="input sm" data-nc="${k}" placeholder="Tên nhóm mới" autocomplete="off"><select class="input sm" data-nct="${k}" aria-label="Loại của nhóm mới">${typesOf(k).map((t) => html`<option value="${t.id}">${t.name}</option>`)}</select><button type="button" class="btn sm secondary" data-ac="${k}">+ Thêm nhóm</button></div>` : ''}
    </section>`;
  };
  return {
    title: 'Loại & nhóm thu chi',
    html: html`<style>
        .tc-tb { border: 1px solid var(--line); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .tc-th { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .tc-th .tc-tn { font-weight: 700; flex: 1 1 200px; min-width: 0; }
        .tc-cr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 200px) auto; gap: 8px; align-items: center; padding-left: 14px; }
        .tc-on { display: inline-flex; gap: 4px; align-items: center; white-space: nowrap; }
        .tc-add { display: flex; gap: 8px; flex-wrap: wrap; } .tc-add input { flex: 1 1 200px; min-width: 0; }
        @media (max-width: 560px) { .tc-cr { grid-template-columns: minmax(0, 1fr) auto; padding-left: 6px; } .tc-cr select { grid-column: 1 / -1; grid-row: 2; } }
      </style>
      <div class="page-head"><div><h1>Loại & nhóm thu chi</h1><div class="sub">Mỗi khoản thu / chi chọn 1 <strong>nhóm</strong>; mỗi nhóm thuộc 1 <strong>loại</strong> (vd Chi phí cố định › Mặt bằng). Trang Thu chi tổng hợp và lọc theo loại / nhóm.${ed ? '' : ' Chỉ Chủ và Quản lý tổng sửa được.'}</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:860px;gap:12px">
        ${block('chi', 'Chi')}${block('thu', 'Thu')}
        ${ed ? html`<div><button type="button" class="btn" id="tc-save">Lưu thay đổi</button></div>` : ''}
      </div>`,
    mount() {
      if (!ed) return;
      $$('[data-at]').forEach((b) => b.addEventListener('click', async () => {
        const k = b.dataset.at; const name = $(`[data-nt="${k}"]`).value.trim(); if (!name) return;
        try { await rpc('app_fin_type_save', { p_id: null, p_kind: k, p_name: name, p_sort: 50, p_active: true }); flash('Đã thêm loại.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('[data-ac]').forEach((b) => b.addEventListener('click', async () => {
        const k = b.dataset.ac; const name = $(`[data-nc="${k}"]`).value.trim(); if (!name) return;
        try {
          const id = await rpc('app_fin_category_save', { p_id: null, p_kind: k, p_name: name, p_sort: 50, p_active: true });
          const t = Number($(`[data-nct="${k}"]`).value) || null; if (t) await rpc('app_fin_category_type_set', { p_cat: id, p_type: t });
          flash('Đã thêm nhóm.'); rerender();
        } catch (e) { showSaved(e.message, true); }
      }));
      $('#tc-save').addEventListener('click', async (ev) => {
        ev.target.disabled = true; let n = 0;
        try {
          for (const el of $$('[data-type]')) {
            const t = D.types.find((x) => x.id === Number(el.dataset.type)); const name = el.querySelector('.tc-tn').value.trim(); const on = el.querySelector('.tc-ta').checked;
            if (t.name !== name || t.active !== on) { await rpc('app_fin_type_save', { p_id: t.id, p_kind: t.kind, p_name: name, p_sort: t.sort_order, p_active: on }); n++; }
          }
          for (const el of $$('[data-cat]')) {
            const c = D.cats.find((x) => x.id === Number(el.dataset.cat)); const name = el.querySelector('.tc-cn').value.trim(); const on = el.querySelector('.tc-ca').checked;
            const t = Number(el.querySelector('.tc-ct').value) || null;
            if (c.name !== name || c.active !== on) { await rpc('app_fin_category_save', { p_id: c.id, p_kind: c.kind, p_name: name, p_sort: c.sort_order, p_active: on }); n++; }
            if ((c.type_id || null) !== t) { await rpc('app_fin_category_type_set', { p_cat: c.id, p_type: t }); n++; }
          }
          flash(n ? 'Đã lưu loại & nhóm thu chi.' : 'Không có gì thay đổi.'); rerender();
        } catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
      });
    },
  };
}
