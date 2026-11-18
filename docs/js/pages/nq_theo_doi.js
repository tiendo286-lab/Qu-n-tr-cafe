// Theo dõi đọc Nội quy & Cam kết (bước 141): Kế toán / người quản lý nhân viên xem ai chưa đọc bản nội quy đang áp dụng,
// ai chưa ký và nộp cam kết, hạn 12 ngày; cập nhật trạng thái cam kết khi nhận bản giấy.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, flash, html, showSaved } from '../ui.js';

export const perm = ['ke_toan', 'quan_ly_nhan_vien'];
const COMMIT = { chua_ky: 'Chưa ký', da_ky_chua_nop: 'Đã ký, chưa nộp', da_ky_nop: 'Đã ký và nộp' };
const LOC = { '': 'Tất cả', chua_doc: 'Chưa đọc đủ', chua_ky: 'Chưa nộp cam kết' };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export async function render({ params }) {
  const loc = Object.hasOwn(LOC, params.loc || '') ? params.loc || '' : '';
  const D = await rpc('app_tl_follow');
  const title = new Map(D.docs.map((d) => [d.id, d.title]));
  const total = D.docs.length;
  const fullRead = D.rows.filter((r) => !r.unread.length).length;
  const signed = D.rows.filter((r) => r.commit === 'da_ky_nop').length;
  const rows = D.rows.filter((r) => (loc === 'chua_doc' ? r.unread.length : loc === 'chua_ky' ? r.commit !== 'da_ky_nop' : true));
  const late = (r) => r.commit !== 'da_ky_nop' && r.commit_due < D.today;
  const unreadDue = (r) => r.unread.map((id) => D.docs.find((d) => d.id === id)?.due).filter(Boolean).sort()[0];
  const card = (r) => html`<article class="card nqf-r" data-id="${r.employee_id}" data-search="${norm(`${r.code} ${r.name}`)}">
    <div class="nqf-h"><strong>${r.code} – ${r.name}</strong><span class="st-meta">${r.rank || ''}${r.start_date ? ' · vào làm ' + dmy(String(r.start_date).slice(0, 10)) : ''}</span></div>
    <div class="nqf-g">
      <div><div class="st-meta">Nội quy</div>
        ${r.unread.length ? html`<div><span class="pill ${unreadDue(r) < D.today ? 'off' : 'warn'}">Đã đọc ${total - r.unread.length}/${total}</span> <span class="st-meta">hạn ${dmy(unreadDue(r))}</span></div>
          <div class="st-meta nqf-u">Chưa đọc: ${r.unread.map((id) => title.get(id)).join(' · ')}</div>` : html`<span class="pill ok">Đã đọc đủ ${total} bài</span>`}</div>
      <div><div class="st-meta">Cam kết</div>
        <select class="input sm nqf-ck" aria-label="Cam kết của ${r.name}">${Object.entries(COMMIT).map(([k, l]) => html`<option value="${k}" ${k === r.commit ? 'selected' : ''}>${l}</option>`)}</select>
        ${r.commit === 'da_ky_nop' ? html`<div class="st-meta">${r.commit_by ? r.commit_by + ' · ' : ''}${r.commit_at || ''}</div>`
          : html`<div class="st-meta" style="${late(r) ? 'color:#b91c1c;font-weight:600' : ''}">Hạn ${dmy(r.commit_due)}${late(r) ? ' · quá hạn' : ''}</div>`}</div>
    </div></article>`;
  return {
    title: 'Theo dõi đọc & cam kết',
    html: html`<style>
        .nqf-r { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; }
        .nqf-h { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; } .nqf-h strong { overflow-wrap: anywhere; }
        .nqf-g { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
        .nqf-u { overflow-wrap: anywhere; margin-top: 2px; }
        .nqf-docs { display: flex; flex-wrap: wrap; gap: 6px; }
      </style>
      <div class="page-head"><div><h1>Theo dõi đọc nội quy & cam kết</h1>
        <div class="sub">Nhân viên đọc bản nội quy đang áp dụng trong 12 ngày từ ngày đăng. Cam kết: nhận bản giấy đã ký, chụp ảnh đăng lên nhóm rồi chọn <b>Đã ký và nộp</b>; hạn 12 ngày từ ngày vào làm.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div id="nqf" class="stack" style="max-width:900px;gap:12px">
        <div class="card stack" style="gap:8px;padding:12px 14px">
          <div><b>${fullRead}/${D.rows.length}</b> nhân viên đã đọc đủ ${total} bài · <b>${signed}/${D.rows.length}</b> đã ký và nộp cam kết</div>
          <div class="nqf-docs">${D.docs.map((d) => { const n = D.rows.filter((r) => r.unread.includes(d.id)).length;
            return html`<span class="pill ${n ? (d.due < D.today ? 'off' : 'warn') : 'ok'}">${d.title} · bản ${d.version} · ${n ? `${n} chưa đọc · hạn ${dmy(d.due)}` : 'đủ'}</span>`; })}</div>
        </div>
        <div class="toolbar" style="gap:8px">
          <nav class="seg" aria-label="Lọc">${Object.entries(LOC).map(([k, l]) => html`<a class="${k === loc ? 'on' : ''}" href="#/theo-doi-noi-quy${k ? '?loc=' + k : ''}">${l}</a>`)}</nav>
          <input class="input" id="nqf-q" type="search" placeholder="Tìm mã hoặc tên" style="max-width:240px"></div>
        <div class="st-meta" id="nqf-count">${rows.length} nhân viên</div>
        ${rows.length ? rows.map(card) : html`<div class="card">Không có nhân viên nào trong mục này.</div>`}
      </div>`,
    mount(root) {
      $('#nqf-q', root).addEventListener('input', (ev) => {
        const q = norm(ev.target.value.trim()); let n = 0;
        $$('.nqf-r', root).forEach((c) => { c.hidden = !!q && !c.dataset.search.includes(q); if (!c.hidden) n++; });
        $('#nqf-count', root).textContent = `${n} nhân viên`;
      });
      $$('.nqf-ck', root).forEach((s) => s.addEventListener('change', async () => {
        s.disabled = true;
        try {
          await rpc('app_tl_set_commit', { p_employee: Number(s.closest('.nqf-r').dataset.id), p_status: s.value, p_note: null });
          flash('Đã lưu cam kết.');
          rerender();
        } catch (e) { showSaved(e.message, true); s.disabled = false; }
      }));
    },
  };
}
