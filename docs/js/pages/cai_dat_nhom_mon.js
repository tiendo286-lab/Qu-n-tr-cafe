// Cài đặt › Nhóm món Fabi (chuyển từ trang File ca Fabi 12/11/2026 — ít khi dùng):
// số cốc của ca = tổng số lượng các món, trừ nhóm Đồ ăn & thuốc lá và Topping. Món mới chọn nhóm 1 lần (web gợi ý theo tên).
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { fmt } from '../tien.js';
import { $, flash, html, showSaved } from '../ui.js';
import { guessGroup } from './ke_toan_fabi.js';

export const perm = 'ke_toan';

export async function render() {
  const MN = await rpc('app_fabi_menu').catch(() => ({ groups: [], items: [] }));
  const unk = MN.items.filter((x) => !x.grp); const known = MN.items.filter((x) => x.grp);
  const grpSel = (it, val) => html`<select class="input sm" data-mn="${it.name}" data-orig="${it.grp || ''}" aria-label="Nhóm của ${it.name}"><option value="">— Chọn nhóm —</option>${MN.groups.map((g) => html`<option value="${g}" ${g === val ? 'selected' : ''}>${g}</option>`)}</select>`;
  const mnRow = (it, val) => html`<div class="mn-r"><div><strong>${it.name}</strong><div class="st-meta">${fmt(it.qty)} phần · ${it.files} ca${it.grp ? (it.cup ? ' · tính cốc' : ' · không tính cốc') : ''}</div></div>${grpSel(it, val)}</div>`;
  return {
    title: 'Nhóm món Fabi',
    html: html`<style>.mn-list { display: flex; flex-direction: column; gap: 4px; } .mn-r { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 220px); gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); }
        .mn-r > div { min-width: 0; overflow-wrap: anywhere; } .mn-r select { width: 100%; } @media (max-width: 520px) { .mn-r { grid-template-columns: minmax(0, 1fr); } }</style>
      <div class="page-head"><div><h1>Nhóm món Fabi</h1><div class="sub">Số cốc của ca = tổng số lượng các món, <strong>trừ nhóm Đồ ăn & thuốc lá và Topping</strong>. Món mới chưa có nhóm: chọn nhóm <strong>1 lần</strong> (web đã gợi ý theo tên — xem lại), bấm Lưu; các ca có món đó tự tính lại số cốc.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card stack" style="gap:8px" id="fb-menu"><h2 style="margin:0">Món chưa có nhóm ${unk.length ? html`<span class="pill warn">${unk.length} món</span>` : MN.items.length ? html`<span class="pill ok">đủ nhóm</span>` : ''}</h2>
          ${unk.length ? html`<div class="mn-list">${unk.map((it) => mnRow(it, guessGroup(it.name, MN.groups)))}</div>` : MN.items.length ? html`<div class="st-meta">Mọi món đã có nhóm.</div>` : html`<div class="st-meta">Chưa có món nào — tải file Fabi ở Kế toán › File ca Fabi trước.</div>`}
          ${known.length ? html`<details><summary style="cursor:pointer;font-weight:600">Món đã có nhóm (${known.length}) — sửa nếu chọn nhầm</summary><div class="mn-list" style="margin-top:6px">${known.map((it) => mnRow(it, it.grp))}</div></details>` : ''}
          ${MN.items.length ? html`<div><button type="button" class="btn" id="fb-menu-save">Lưu nhóm món</button></div>` : ''}</section>
      </div>`,
    mount() {
      $('#fb-menu-save')?.addEventListener('click', async (ev) => {
        const items = [...document.querySelectorAll('[data-mn]')].filter((x) => x.value !== x.dataset.orig).map((x) => ({ name: x.dataset.mn, grp: x.value || null }));
        if (!items.length) { showSaved('Chưa đổi nhóm món nào.', true); return; }
        ev.target.disabled = true;
        try { const n = await rpc('app_fabi_menu_set', { p_items: items }); flash(`Đã lưu nhóm cho ${n} món — số cốc các ca có món đó đã tính lại.`, 'ok'); rerender(); }
        catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
      });
    },
  };
}
