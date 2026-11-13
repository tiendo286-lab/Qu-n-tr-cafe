// Cài đặt › Người vay (bước 64): danh sách người ngoài được cho vay (nhân viên không vay). Chủ / Quản lý tổng sửa.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { $, $$, flash, html, showSaved } from '../ui.js';

export const perm = ['doi_soat', 'chot_thang'];

export async function render() {
  const D = await rpc('app_loan_people');
  const ed = !!D.can_edit; const dis = ed ? '' : 'disabled';
  const row = (p) => html`<div class="lp-r" data-id="${p.id}">
      <input class="input sm lp-n" value="${p.name}" aria-label="Tên" ${dis}><input class="input sm lp-ph" value="${p.phone || ''}" placeholder="Số điện thoại" aria-label="Số điện thoại" ${dis}>
      <input class="input sm lp-no" value="${p.note || ''}" placeholder="Ghi chú" aria-label="Ghi chú" ${dis}>
      <label class="st-meta lp-on"><input type="checkbox" class="lp-a" ${p.active ? 'checked' : ''} ${dis}> Dùng</label></div>`;
  return {
    title: 'Người vay',
    html: html`<style>
        .lp-r { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.4fr) auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); }
        .lp-on { display: inline-flex; gap: 4px; align-items: center; white-space: nowrap; }
        .lp-add { display: flex; gap: 8px; flex-wrap: wrap; } .lp-add input { flex: 1 1 160px; min-width: 0; }
        @media (max-width: 560px) { .lp-r { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
      </style>
      <div class="page-head"><div><h1>Người vay</h1><div class="sub">Người ngoài được cơ sở cho vay (nhân viên không vay). Ghi khoản vay / trả nợ ở trang <a href="#/quan-ly/thu-chi">Thu chi</a> của cơ sở bật mục Cho vay (hiện là LHP).${ed ? '' : ' Chỉ Chủ và Quản lý tổng sửa được.'}</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:860px;gap:12px">
        ${ed ? html`<section class="card stack" style="gap:8px"><h2 style="margin:0">Thêm người vay</h2>
          <div class="lp-add"><input class="input sm" id="lp-nn" placeholder="Tên người vay" autocomplete="off"><input class="input sm" id="lp-np" placeholder="Số điện thoại" autocomplete="off">
            <input class="input sm" id="lp-nt" placeholder="Ghi chú (vd: nhà cung cấp đá)" autocomplete="off"><button type="button" class="btn sm" id="lp-add">+ Thêm</button></div></section>` : ''}
        <section class="card stack" style="gap:4px"><h2 style="margin:0">Danh sách (${D.people.length})</h2>
          ${D.people.length ? D.people.map(row) : html`<div class="st-meta">Chưa có người vay nào.</div>`}
          ${ed && D.people.length ? html`<div style="margin-top:8px"><button type="button" class="btn" id="lp-save">Lưu thay đổi</button></div>` : ''}</section>
      </div>`,
    mount() {
      if (!ed) return;
      $('#lp-add').addEventListener('click', async () => {
        const name = $('#lp-nn').value.trim(); if (!name) { showSaved('Nhập tên người vay.', true); return; }
        try { await rpc('app_loan_person_save', { p_id: null, p_name: name, p_phone: $('#lp-np').value, p_note: $('#lp-nt').value, p_active: true }); flash('Đã thêm người vay.'); rerender(); }
        catch (e) { showSaved(e.message, true); }
      });
      $('#lp-save')?.addEventListener('click', async (ev) => {
        ev.target.disabled = true; let n = 0;
        try {
          for (const el of $$('.lp-r')) {
            const p = D.people.find((x) => x.id === Number(el.dataset.id));
            const v = { name: el.querySelector('.lp-n').value.trim(), phone: el.querySelector('.lp-ph').value.trim(), note: el.querySelector('.lp-no').value.trim(), active: el.querySelector('.lp-a').checked };
            if (v.name !== p.name || v.phone !== (p.phone || '') || v.note !== (p.note || '') || v.active !== p.active) {
              await rpc('app_loan_person_save', { p_id: p.id, p_name: v.name, p_phone: v.phone, p_note: v.note, p_active: v.active }); n++;
            }
          }
          flash(n ? `Đã lưu ${n} người vay.` : 'Không có gì thay đổi.'); rerender();
        } catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
      });
    },
  };
}
