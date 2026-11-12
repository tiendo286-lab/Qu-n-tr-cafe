// Một yêu cầu hỗ trợ: các tin nhắn (người gửi, thời gian) + ô nhắn; tự làm mới mỗi 15 giây
import { render as rerender, isManager } from '../app.js';
import { rpc } from '../sb.js';
import { dt } from '../tien.js';
import { $, html, showSaved, str } from '../ui.js';
import { HT_STATUS } from './ho_tro.js';

const bubbles = (R) => html`${R.messages.map((m) => html`<div class="msg ${m.me ? 'me' : ''} ${m.from_requester ? '' : 'staff'}">
  <div class="msg-by">${m.me ? 'Bạn' : m.by}${!m.from_requester ? html` <span class="pill info" style="font-size:10px;padding:1px 6px">Quản lý</span>` : ''} · ${dt(m.at)}</div>
  <div class="msg-body">${m.body}</div></div>`)}`;

export async function render({ params }) {
  const R = await rpc('app_ht_get', { p_id: Number(params.id) });
  const body = html`<style>
      .msgs { display: flex; flex-direction: column; gap: 10px; }
      .msg { max-width: 85%; align-self: flex-start; background: #fff; border: 1px solid var(--line); border-radius: 14px 14px 14px 4px; padding: 8px 12px; }
      .msg.me { align-self: flex-end; background: var(--caramel-soft); border-color: var(--caramel-line); border-radius: 14px 14px 4px 14px; }
      .msg-by { font-size: 12px; color: var(--muted); margin-bottom: 2px; }
      .msg-body { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; }
      .pill.info { background: var(--info-bg); color: var(--info-ink); }
      .ht-send { position: sticky; bottom: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
      .mobile .ht-send { bottom: 58px; }
    </style>
    <section class="card stack" style="gap:6px;padding:14px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline"><strong style="font-size:17px">${R.title}</strong>
        <span class="pill ${HT_STATUS[R.status][1]}">${HT_STATUS[R.status][0]}</span></div>
      <div style="font-size:12px;color:var(--muted)">Người gửi: ${R.from} · tạo ${dt(R.created_at)}${R.closed_at ? ` · xong ${dt(R.closed_at)} (${R.closed_by_name})` : ''}</div>
      <div class="toolbar" style="gap:8px"><a class="btn sm secondary" href="#/ho-tro">‹ Danh sách</a>
        <button type="button" class="btn sm secondary" id="ht-toggle">${R.status === 'mo' ? 'Đánh dấu đã xong' : 'Mở lại'}</button></div></section>
    <div class="msgs" id="msgs">${bubbles(R)}</div>
    <form class="card stack ht-send" id="ht-form" style="gap:8px;padding:12px">
      <textarea class="input" name="body" rows="2" maxlength="5000" placeholder="${R.mine ? 'Nhắn thêm cho quản lý…' : 'Trả lời nhân viên…'}" required aria-label="Tin nhắn"></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:12px;color:var(--muted)">Tự làm mới mỗi 15 giây.</span><button class="btn sm" type="submit">Gửi</button></div></form>`;
  return {
    title: R.title,
    html: isManager() ? html`<div class="page-head"><h1>Yêu cầu hỗ trợ</h1><div id="saved-indicator" class="saved" role="status" hidden></div></div><div class="stack" style="max-width:760px;gap:10px">${body}</div>`
      : html`<div class="stack" style="gap:10px">${body}</div>`,
    mount() {
      let count = R.messages.length;
      const scroll = () => { const last = $('#msgs').lastElementChild; if (last) last.scrollIntoView({ block: 'end' }); };
      scroll();
      const refresh = async () => {
        if (document.hidden) return;
        try { const N = await rpc('app_ht_get', { p_id: R.id }); if (N.messages.length !== count) { count = N.messages.length; $('#msgs').innerHTML = str(bubbles(N)); scroll(); } } catch (_) { /* bỏ qua */ }
      };
      const timer = setInterval(refresh, 15000);
      $('#ht-form').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target; const b = f.querySelector('button'); b.disabled = true;
        try { await rpc('app_ht_send', { p_id: R.id, p_body: f.body.value }); f.body.value = ''; if (R.status !== 'mo') rerender(); else await refresh(); }
        catch (e) { showSaved(e.message, true); }
        b.disabled = false;
      });
      $('#ht-toggle').addEventListener('click', async () => {
        try { await rpc('app_ht_status', { p_id: R.id, p_done: R.status === 'mo' }); rerender(); } catch (e) { showSaved(e.message, true); }
      });
      return () => clearInterval(timer);
    },
  };
}
