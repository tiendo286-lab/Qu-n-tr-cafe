import { isManager, state } from '../app.js';
import { when } from '../data.js';
import { rpc, sel } from '../sb.js';
import { html } from '../ui.js';

export const perm = 'xem_lich_minh';
const KIND = [
  ['thay đổi', '!', '#ffedd5', '#9a3412'],
  ['Sắp hết hạn', '!', '#fee2e2', '#991b1b'],
  ['Đã mở order', '+', '#dbeafe', '#1e3a8a'],
  ['đã được chốt', '✓', '#dcfce7', '#14532d'],
  ['giành quyền', '!', '#ffedd5', '#9a3412'],
  ['Việc mới', '+', '#dbeafe', '#1e3a8a'],
  ['chờ duyệt', '!', '#ffedd5', '#9a3412'],
  ['duyệt hoàn thành', '✓', '#dcfce7', '#14532d'],
  ['làm lại', '!', '#fee2e2', '#991b1b'],
];

export async function render({ me }) {
  const rows = await sel('notifications', '*', (b) => b.eq('account_id', me.account_id).order('id', { ascending: false }).limit(100));
  const nUnread = rows.filter((r) => !r.read_at).length;
  if (nUnread) { await rpc('app_notifications_read').catch(() => {}); state.unread = 0; }
  const items = rows.map((r) => {
    const k = KIND.find(([key]) => r.title.includes(key)) || [null, '•', '#e6e9ef', '#3b4454'];
    return html`<article class="card ntf">
      <div class="ico" style="background:${k[2]};color:${k[3]}" aria-hidden="true">${k[1]}</div>
      <div class="ntf-body">
        <div class="n-head"><div class="ttl">${r.title}</div>${r.read_at ? '' : html`<span class="dot-unread" aria-label="Chưa đọc"></span>`}</div>
        ${(r.body || '').split('\n').filter(Boolean).map((l) => html`<div class="n-line">${l}</div>`)}
        <div class="when">${when(r.created_at)}${r.link ? html` · <a href="#${r.link}">Xem</a>` : ''}</div>
      </div></article>`;
  });
  const body = html`${rows.length ? '' : html`<div class="card">Chưa có thông báo nào.</div>`}${items}
    <div class="det" style="text-align:center;padding-top:4px">Thông báo tự xóa sau 60 ngày.</div>`;
  return {
    title: 'Thông báo',
    html: isManager()
      ? html`<div class="page-head"><div><h1>Thông báo</h1><div class="sub">${nUnread ? `${nUnread} chưa đọc · ` : ''}Thông báo cũ hơn 60 ngày tự xóa.</div></div></div><div class="stack" style="max-width:640px;gap:12px">${body}</div>`
      : body,
  };
}
