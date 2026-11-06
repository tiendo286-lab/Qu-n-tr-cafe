// Yêu cầu hỗ trợ: nhân viên tạo yêu cầu, quản lý xem mọi yêu cầu
import { isManager } from '../app.js';
import { rpc } from '../sb.js';
import { dt } from '../tien.js';
import { $, $$, go, html, norm, showSaved } from '../ui.js';

export const HT_STATUS = { mo: ['Đang mở', 'warn'], da_xong: ['Đã xong', 'ok'] };

export async function render() {
  const list = await rpc('app_ht_list');
  const mgr = isManager();
  const card = (r) => html`<a class="card ht-item ${r.unread ? 'ht-unread' : ''}" href="#/ho-tro/chi-tiet?id=${r.id}" data-search="${norm(r.title + ' ' + r.from)}" data-st="${r.status}">
    <div class="ht-top"><strong>${r.title}</strong><span class="pill ${HT_STATUS[r.status][1]}">${HT_STATUS[r.status][0]}</span></div>
    ${mgr ? html`<div class="st-meta">Người gửi: ${r.from}</div>` : ''}
    ${r.last ? html`<div class="ht-last">${r.last.by}: ${r.last.body}</div>` : ''}
    <div class="st-meta">${r.messages} tin nhắn · cập nhật ${dt(r.last_message_at)}${r.unread ? html` · <strong style="color:#b91c1c">${r.unread} tin mới</strong>` : ''}</div></a>`;
  const body = html`<style>
      .ht-item { display: flex; flex-direction: column; gap: 4px; padding: 14px; text-decoration: none; color: inherit; }
      .ht-item:hover { border-color: var(--primary); }
      .ht-unread { border-left: 4px solid #dc2626; }
      .ht-top { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
      .ht-last { font-size: 14px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .st-meta { font-size: 12px; color: var(--muted); }
    </style>
    <details class="card" ${list.length ? '' : 'open'} id="new-box"><summary style="cursor:pointer;font-weight:700">+ Tạo yêu cầu hỗ trợ</summary>
      <form id="ht-new" class="stack" style="gap:8px;margin-top:10px">
        <input class="input" name="title" maxlength="200" placeholder="Tiêu đề (vd: Máy POS bị treo, xin đổi ca, hỏi lương...)" required aria-label="Tiêu đề">
        <textarea class="input" name="body" rows="4" maxlength="5000" placeholder="Nội dung cần hỗ trợ" required aria-label="Nội dung"></textarea>
        <div><button class="btn" type="submit">Gửi yêu cầu</button></div>
        <div class="st-meta">${mgr ? 'Yêu cầu sẽ được gửi tới các quản lý.' : 'Chỉ bạn và các quản lý xem được yêu cầu này.'}</div></form></details>
    ${mgr && list.length ? html`<div class="toolbar" style="gap:8px"><input class="input sm" id="ht-q" type="search" placeholder="Tìm tiêu đề / người gửi" style="flex:1 1 200px;min-width:0" aria-label="Tìm">
      <select class="input sm" id="ht-st" aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="mo">Đang mở</option><option value="da_xong">Đã xong</option></select></div>` : ''}
    ${list.length ? list.map(card) : html`<div class="card">Chưa có yêu cầu hỗ trợ nào.</div>`}`;
  return {
    title: 'Yêu cầu hỗ trợ',
    html: mgr ? html`<div class="page-head"><div><h1>Yêu cầu hỗ trợ</h1><div class="sub">Nhân viên gửi yêu cầu và nhắn trao đổi; mọi quản lý xem và trả lời được.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div><div class="stack" style="max-width:820px;gap:10px">${body}</div>`
      : html`<div class="stack" style="gap:10px"><h2 style="margin:0">Yêu cầu hỗ trợ</h2>${body}</div>`,
    mount() {
      $('#ht-new').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target; const b = f.querySelector('button'); b.disabled = true;
        try { const id = await rpc('app_ht_create', { p_title: f.title.value, p_body: f.body.value }); go(`/ho-tro/chi-tiet?id=${id}`); }
        catch (e) { b.disabled = false; showSaved(e.message, true); }
      });
      const q = $('#ht-q');
      if (q) {
        const apply = () => { const s = norm(q.value.trim()); const st = $('#ht-st').value; $$('.ht-item').forEach((c) => { c.hidden = !((!s || c.dataset.search.includes(s)) && (!st || c.dataset.st === st)); }); };
        q.addEventListener('input', apply); $('#ht-st').addEventListener('input', apply);
      }
    },
  };
}
