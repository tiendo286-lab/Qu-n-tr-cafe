// Giao việc: Chủ (hoặc người có quyền) giao việc cho nhân viên và theo dõi 3 trạng thái Chờ nhận / Đang xử lý / Đã xử lý
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, flash, go, hhmm, html, norm, showSaved } from '../ui.js';
import { STATUS, STYLE, doneText, dueText, history, sourceText } from './viec.js';

export const perm = 'hop_giao_viec';

const TABS = [
  ['cho-nhan', 'Chờ nhận', (t) => t.status === 'da_giao'],
  ['dang-xu-ly', 'Đang xử lý', (t) => t.status === 'dang_xu_ly'],
  ['da-xu-ly', 'Đã xử lý', (t) => t.status === 'hoan_thanh' || t.status === 'cho_duyet'],
  ['chua-giao', 'Chưa giao', (t) => t.status === 'chua_phan_cong'],
];
const ROLE = { ql_tong: 'Quản lý tổng', ql: 'Quản lý', nv: 'Nhân viên' };

export async function render({ params }) {
  const [all, people] = await Promise.all([rpc('app_viec_all'), rpc('app_viec_people')]);
  const tabs = TABS.filter(([k, , f]) => k !== 'chua-giao' || all.some(f));
  const tab = tabs.find(([k]) => k === params.tab) || tabs[0];
  const list = all.filter(tab[2]);
  const groups = Object.entries(ROLE).map(([r, label]) => [label, people.filter((p) => p.role === r)]).filter(([, ps]) => ps.length);
  const personOpts = (sel, blank) => html`${blank ? html`<option value="">${blank}</option>` : ''}${groups.map(([label, ps]) => html`<optgroup label="${label}">${ps.map((p) => html`<option value="${p.id}" ${String(p.id) === String(sel) ? 'selected' : ''}>${p.name}</option>`)}</optgroup>`)}`;
  const assignees = [...new Map(list.filter((t) => t.assignee_id).map((t) => [t.assignee_id, t.assignee_name])).entries()];
  const open = (t) => t.status === 'da_giao' || t.status === 'dang_xu_ly' || t.status === 'chua_phan_cong';

  const card = (t) => html`<article class="card stack tk ${t.overdue ? 'tk-late' : ''}" style="gap:8px;padding:14px" data-id="${t.id}" data-search="${norm(t.content + ' ' + (t.assignee_name || ''))}" data-ass="${t.assignee_id || ''}">
    <div class="tk-top"><span><span class="pill ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span>${t.assignee_name ? html` · <strong>${t.assignee_name}</strong>` : ''}</span>${dueText(t)}</div>
    <div class="tk-content">${t.content}</div>
    <div class="st-meta">${sourceText(t)}${t.meeting_id ? html` · <a href="#/quan-ly/hop/chi-tiet?id=${t.meeting_id}">Họp ${dmy(t.meeting_date)}</a>` : ''}</div>
    ${t.status === 'dang_xu_ly' && t.review_note ? html`<div class="st-meta">Đã yêu cầu làm lại: ${t.review_note}</div>` : ''}
    ${doneText(t)}
    ${open(t) ? html`<details class="tk-more"><summary>Đổi người nhận / hạn · Xóa</summary>
      <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
        <label class="st-meta">Người nhận <select class="input sm tk-edit" data-f="assignee_id" aria-label="Người nhận">${personOpts(t.assignee_id, '— Chưa giao —')}</select></label>
        <label class="st-meta">Hạn <input class="input sm tk-edit" type="date" data-f="due_date" value="${t.due_date || ''}" aria-label="Hạn hoàn thành"></label>
        <button type="button" class="btn sm secondary danger tk-del" style="margin-left:auto">Xóa việc</button></div></details>`
    : html`<details class="tk-more"><summary>Yêu cầu làm lại</summary><div class="stack" style="gap:6px;margin-top:8px">
        <textarea class="input tk-note" rows="2" placeholder="Lý do (bắt buộc)" aria-label="Lý do yêu cầu làm lại"></textarea>
        <div><button type="button" class="btn sm secondary tk-reopen">Gửi yêu cầu làm lại</button></div></div></details>`}
    ${history(t)}</article>`;

  return {
    title: 'Giao việc',
    html: html`${STYLE}<div class="page-head"><div><h1>Giao việc</h1><div class="sub">Giao việc cho nhân viên và theo dõi: Chờ nhận → Đang xử lý → Đã xử lý.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card stack" style="gap:10px"><h2 style="margin:0">+ Giao việc mới</h2>
          <form id="add-task" class="stack" style="gap:8px">
            <textarea class="input" name="content" rows="2" placeholder="Nội dung công việc" required aria-label="Nội dung công việc"></textarea>
            <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select class="input sm" name="assignee" required aria-label="Người nhận" style="flex:1 1 220px;min-width:0">${personOpts('', '— Chọn người nhận —')}</select>
              <label class="st-meta" style="display:flex;gap:6px;align-items:center">Hạn <input class="input sm" type="date" name="due" aria-label="Hạn hoàn thành (không bắt buộc)"></label>
              <button class="btn sm" type="submit">Giao việc</button></div>
            <div class="st-meta">Người nhận được thông báo ngay. Hạn không bắt buộc.</div></form></section>
        <nav class="tabs-nav" aria-label="Trạng thái">${tabs.map(([k, l, f]) => html`<a class="${k === tab[0] ? 'on' : ''}" href="#/quan-ly/giao-viec?tab=${k}">${l} (${all.filter(f).length})</a>`)}</nav>
        ${list.length ? html`<section class="card toolbar" style="padding:12px 14px;gap:8px">
            <input class="input sm" id="f-q" type="search" placeholder="Tìm nội dung / người" style="flex:1 1 200px;min-width:0" aria-label="Tìm">
            <select class="input sm" id="f-ass" aria-label="Người nhận"><option value="">Mọi người nhận</option>${assignees.map(([id, n]) => html`<option value="${id}">${n}</option>`)}</select>
            <span class="st-meta" id="f-count"></span></section>
          ${list.map(card)}` : html`<div class="card">Không có việc nào ở mục này.</div>`}
        ${tab[0] === 'da-xu-ly' ? html`<div class="st-meta">Hiện việc xử lý xong trong 30 ngày gần đây.</div>` : ''}
      </div>
      <style>.tk-more summary { cursor: pointer; font-size: 13px; color: var(--primary-dark); font-weight: 600; }</style>`,
    mount() {
      $('#add-task').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        try {
          await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', content: f.content.value, assignee_id: f.assignee.value || null, due_date: f.due.value || null } });
          flash('Đã giao việc. Người nhận đã được thông báo.'); go('/quan-ly/giao-viec?tab=cho-nhan');
        } catch (e) { showSaved(e.message, true); }
      });
      $$('.tk-edit').forEach((el) => el.addEventListener('change', async () => {
        const id = Number(el.closest('.tk').dataset.id);
        try { await rpc('app_viec_update', { p_task: id, p: { [el.dataset.f]: el.value || null } }); showSaved('Đã lưu · ' + hhmm()); rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa công việc này?')) return;
        try { await rpc('app_viec_delete', { p_task: Number(b.closest('.tk').dataset.id) }); flash('Đã xóa việc.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-reopen').forEach((b) => b.addEventListener('click', async () => {
        const card = b.closest('.tk'); const note = card.querySelector('.tk-note').value;
        if (!note.trim()) { showSaved('Ghi lý do yêu cầu làm lại.', true); return; }
        try { await rpc('app_viec_reopen', { p_task: Number(card.dataset.id), p_note: note }); flash('Đã gửi yêu cầu làm lại. Việc chuyển về Đang xử lý.'); rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
      const q = $('#f-q');
      if (q) {
        const apply = () => {
          const s = norm(q.value.trim()); const as = $('#f-ass').value; let n = 0;
          $$('.tk').forEach((c) => { const show = (!s || c.dataset.search.includes(s)) && (!as || c.dataset.ass === as); c.hidden = !show; if (show) n++; });
          $('#f-count').textContent = `${n} việc`;
        };
        [q, $('#f-ass')].forEach((el) => el.addEventListener('input', apply)); apply();
      }
    },
  };
}
