// Công việc (người giao): Cần xử lý → chọn người giao → Chờ nhận → Đang xử lý → Đã xử lý
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, flash, hhmm, html, norm, showSaved } from '../ui.js';
import { STATUS, STYLE, doneText, dueText, history, sourceText } from './viec.js';

export const perm = 'hop_giao_viec';

const TABS = [
  ['can-xu-ly', 'Cần xử lý'],
  ['cho-nhan', 'Chờ nhận', (t) => t.status === 'da_giao'],
  ['dang-xu-ly', 'Đang xử lý', (t) => t.status === 'dang_xu_ly'],
  ['da-xu-ly', 'Đã xử lý', (t) => t.status === 'hoan_thanh' || t.status === 'cho_duyet'],
];
const ROLE = { ql_tong: 'Quản lý tổng', ql: 'Quản lý', nv: 'Nhân viên' };

export async function render({ params }) {
  const [all, people, pending] = await Promise.all([rpc('app_viec_all'), rpc('app_viec_people'), rpc('app_viec_pending')]);
  const tab = TABS.find(([k]) => k === params.tab) || TABS[0];
  const nPending = pending.handover.length + pending.tasks.length;
  const count = ([k, , f]) => (k === 'can-xu-ly' ? nPending : all.filter(f).length);
  const groups = Object.entries(ROLE).map(([r, label]) => [label, people.filter((p) => p.role === r)]).filter(([, ps]) => ps.length);
  const personOpts = (sel, blank) => html`<option value="">${blank}</option>${groups.map(([label, ps]) => html`<optgroup label="${label}">${ps.map((p) => html`<option value="${p.id}" ${String(p.id) === String(sel) ? 'selected' : ''}>${p.name}</option>`)}</optgroup>`)}`;
  const assignBox = html`<div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select class="input sm as-who" aria-label="Người nhận" style="flex:1 1 200px;min-width:0">${personOpts('', '— Chọn người nhận —')}</select>
      <label class="st-meta" style="display:flex;gap:6px;align-items:center">Hạn <input class="input sm as-due" type="date" aria-label="Hạn hoàn thành (không bắt buộc)"></label>
      <button type="button" class="btn sm as-go">Giao việc</button></div>`;

  let body;
  if (tab[0] === 'can-xu-ly') {
    const hoCard = (h) => html`<article class="card stack tk pend" style="gap:8px;padding:14px" data-ho="${h.id}" data-search="${norm(h.content)}">
      <div class="tk-top"><span><span class="pill warn">Bàn giao ca</span> <a href="#/ca/phieu?id=${h.report_id}">Ca ${h.shift} ${h.branch} ${dmy(h.work_date)}</a></span><span class="st-meta">${h.by || ''}</span></div>
      <div class="tk-content">${h.content}</div>
      ${assignBox}
      <div><button type="button" class="btn sm secondary ho-close">Đã xong, không cần giao</button></div></article>`;
    const taskCard = (t) => html`<article class="card stack tk pend" style="gap:8px;padding:14px" data-id="${t.id}" data-search="${norm(t.content)}">
      <div class="tk-top"><span><span class="pill mute">Việc tự ghi</span> ${sourceText(t)}</span><span class="st-meta">${t.created_by_name || ''}</span></div>
      <div class="tk-content">${t.content}</div>
      ${assignBox}
      <div><button type="button" class="btn sm secondary danger tk-del">Xóa việc</button></div></article>`;
    body = html`<section class="card stack" style="gap:10px"><h2 style="margin:0">+ Thêm việc</h2>
        <form id="add-task" class="stack" style="gap:8px">
          <textarea class="input" name="content" rows="2" placeholder="Nội dung công việc" required aria-label="Nội dung công việc"></textarea>
          <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="input sm" name="assignee" aria-label="Người nhận" style="flex:1 1 220px;min-width:0">${personOpts('', '— Giao sau (để ở Cần xử lý) —')}</select>
            <label class="st-meta" style="display:flex;gap:6px;align-items:center">Hạn <input class="input sm" type="date" name="due" aria-label="Hạn hoàn thành (không bắt buộc)"></label>
            <button class="btn sm" type="submit">Lưu</button></div>
          <div class="st-meta">Chọn người nhận thì việc được giao ngay (người đó nhận thông báo). Chưa chọn thì việc nằm ở danh sách bên dưới để giao sau.</div></form></section>
      ${nPending ? html`<div class="st-meta">Nội dung bàn giao ca chưa xong và việc chưa giao. Chọn người nhận rồi bấm “Giao việc”.</div>
        ${pending.handover.map(hoCard)}${pending.tasks.map(taskCard)}` : html`<div class="card">Không còn việc nào cần xử lý.</div>`}`;
  } else {
    const list = all.filter(tab[2]);
    const assignees = [...new Map(list.filter((t) => t.assignee_id).map((t) => [t.assignee_id, t.assignee_name])).entries()];
    const open = (t) => t.status === 'da_giao' || t.status === 'dang_xu_ly';
    const card = (t) => html`<article class="card stack tk ${t.overdue ? 'tk-late' : ''}" style="gap:8px;padding:14px" data-id="${t.id}" data-search="${norm(t.content + ' ' + (t.assignee_name || ''))}" data-ass="${t.assignee_id || ''}">
      <div class="tk-top"><span><span class="pill ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span>${t.assignee_name ? html` · <strong>${t.assignee_name}</strong>` : ''}</span>${dueText(t)}</div>
      <div class="tk-content">${t.content}</div>
      <div class="st-meta">${sourceText(t)}</div>
      ${t.status === 'dang_xu_ly' && t.review_note ? html`<div class="st-meta">Đã yêu cầu làm lại: ${t.review_note}</div>` : ''}
      ${doneText(t)}
      ${open(t) ? html`<details class="tk-more"><summary>Đổi người nhận / hạn · Xóa</summary>
        <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <label class="st-meta">Người nhận <select class="input sm tk-edit" data-f="assignee_id" aria-label="Người nhận">${personOpts(t.assignee_id, '— Bỏ giao (về Cần xử lý) —')}</select></label>
          <label class="st-meta">Hạn <input class="input sm tk-edit" type="date" data-f="due_date" value="${t.due_date || ''}" aria-label="Hạn hoàn thành"></label>
          <button type="button" class="btn sm secondary danger tk-del" style="margin-left:auto">Xóa việc</button></div></details>`
      : html`<details class="tk-more"><summary>Yêu cầu làm lại</summary><div class="stack" style="gap:6px;margin-top:8px">
          <textarea class="input tk-note" rows="2" placeholder="Lý do (bắt buộc)" aria-label="Lý do yêu cầu làm lại"></textarea>
          <div><button type="button" class="btn sm secondary tk-reopen">Gửi yêu cầu làm lại</button></div></div></details>`}
      ${history(t)}</article>`;
    body = list.length ? html`<section class="card toolbar" style="padding:12px 14px;gap:8px">
        <input class="input sm" id="f-q" type="search" placeholder="Tìm nội dung / người" style="flex:1 1 200px;min-width:0" aria-label="Tìm">
        <select class="input sm" id="f-ass" aria-label="Người nhận"><option value="">Mọi người nhận</option>${assignees.map(([id, n]) => html`<option value="${id}">${n}</option>`)}</select>
        <span class="st-meta" id="f-count"></span></section>
      ${list.map(card)}${tab[0] === 'da-xu-ly' ? html`<div class="st-meta">Hiện việc xử lý xong trong 30 ngày gần đây.</div>` : ''}`
      : html`<div class="card">Không có việc nào ở mục này.</div>`;
  }

  return {
    title: 'Công việc',
    html: html`${STYLE}<div class="page-head"><div><h1>Công việc</h1><div class="sub">Cần xử lý → chọn người giao → Chờ nhận → Đang xử lý → Đã xử lý.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <nav class="tabs-nav" aria-label="Trạng thái">${TABS.map((t) => html`<a class="${t[0] === tab[0] ? 'on' : ''}" href="#/quan-ly/giao-viec?tab=${t[0]}">${t[1]} (${count(t)})</a>`)}</nav>
        ${body}
      </div>
      <style>.tk-more summary { cursor: pointer; font-size: 13px; color: var(--primary-dark); font-weight: 600; }</style>`,
    mount() {
      $('#add-task')?.addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        try {
          await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', content: f.content.value, assignee_id: f.assignee.value || null, due_date: f.due.value || null } });
          flash(f.assignee.value ? 'Đã giao việc. Người nhận đã được thông báo.' : 'Đã thêm vào Cần xử lý.'); rerender();
        } catch (e) { showSaved(e.message, true); }
      });
      // Giao một mục cần xử lý
      $$('.as-go').forEach((b) => b.addEventListener('click', async () => {
        const c = b.closest('.pend'); const who = c.querySelector('.as-who').value; const due = c.querySelector('.as-due').value || null;
        if (!who) { showSaved('Chọn người nhận trước.', true); return; }
        try {
          if (c.dataset.ho) await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', handover_item_id: Number(c.dataset.ho), assignee_id: who, due_date: due } });
          else await rpc('app_viec_update', { p_task: Number(c.dataset.id), p: { assignee_id: who, due_date: due } });
          flash('Đã giao việc. Người nhận đã được thông báo.'); rerender();
        } catch (e) { showSaved(e.message, true); }
      }));
      $$('.ho-close').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Đánh dấu nội dung bàn giao này đã xong, không cần giao ai?')) return;
        try { await rpc('app_viec_handover_close', { p_item: Number(b.closest('.pend').dataset.ho) }); flash('Đã đánh dấu xong.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-edit').forEach((el) => el.addEventListener('change', async () => {
        const id = Number(el.closest('.tk').dataset.id);
        try { await rpc('app_viec_update', { p_task: id, p: { [el.dataset.f]: el.value || null } }); showSaved('Đã lưu · ' + hhmm()); rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa công việc này? Nếu việc lấy từ bàn giao ca, nội dung đó trở lại Cần xử lý.')) return;
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
