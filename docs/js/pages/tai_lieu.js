// Nội quy / Quy trình: nhân viên đọc bản đã đăng (nội quy có nút "Tôi đã đọc"); người có quyền soạn thấy cả bản nháp
import { render as rerender, can, isManager } from '../app.js';
import { DOC_STYLE, fillImages, sanitize } from '../editor.js';
import { rpc } from '../sb.js';
import { dt } from '../tien.js';
import { $$, html, raw, showSaved } from '../ui.js';

export const KINDS = { noi_quy: ['Nội quy', '/noi-quy'], quy_trinh: ['Quy trình', '/quy-trinh'] };

export async function render({ params, me }) {
  const kind = location.hash.startsWith('#/quy-trinh') ? 'quy_trinh' : 'noi_quy';
  const [label] = KINDS[kind];
  const editor = can('soan_tai_lieu');
  const docs = await rpc('app_tl_list', { p_kind: kind });
  const focus = Number(params.id) || null;
  const shown = docs.filter((d) => d.published_version > 0 || editor);
  const seg = html`<div class="seg" role="tablist">${Object.entries(KINDS).map(([k, [l, p]]) => html`<a href="#${p}" class="${k === kind ? 'on' : ''}">${l}</a>`)}</div>`;

  const card = (d, i) => {
    const published = d.published_version > 0;
    const read = d.read_version && d.read_version === d.published_version;
    return html`<details class="card stack doc-card" style="gap:10px;padding:16px" ${focus ? (focus === d.id ? 'open' : '') : (shown.length <= 2 || i === 0 ? 'open' : '')} id="doc-${d.id}">
      <summary class="doc-sum"><span class="doc-title">${published ? d.published_title : d.title}</span>
        ${kind === 'noi_quy' && me.employee_id && published ? (read ? html`<span class="pill ok">Đã đọc</span>` : html`<span class="pill off">Chưa đọc</span>`) : ''}
        ${editor && !published ? html`<span class="pill mute">Chưa đăng</span>` : ''}
        ${editor && published && d.has_draft ? html`<span class="pill warn">Có sửa đổi chưa đăng</span>` : ''}</summary>
      ${published ? html`<div class="st-meta">Đăng ${dt(d.published_at)} · phiên bản ${d.published_version}${d.published_by ? ' · ' + d.published_by : ''}</div>
        <div class="doc">${raw(sanitize(d.published_html))}</div>` : html`<div class="st-meta">Tài liệu này chưa đăng nên nhân viên chưa thấy. Bấm Sửa để soạn và đăng.</div>`}
      ${kind === 'noi_quy' && me.employee_id && published ? (read ? html`<div class="alert ok">Bạn đã xác nhận đọc lúc ${dt(d.read_at)}.</div>`
        : html`<div><button type="button" class="btn read-btn" data-id="${d.id}">Tôi đã đọc và hiểu nội quy này</button></div>`) : ''}
      ${editor ? html`<div class="toolbar" style="gap:6px"><a class="btn sm secondary" href="#/tai-lieu/soan?id=${d.id}">Sửa</a>
        <button type="button" class="btn sm secondary mv" data-id="${d.id}" data-dir="-1" aria-label="Đưa lên">↑</button>
        <button type="button" class="btn sm secondary mv" data-id="${d.id}" data-dir="1" aria-label="Đưa xuống">↓</button>
        <span class="st-meta">Sửa gần nhất ${dt(d.updated_at)}${d.updated_by ? ' · ' + d.updated_by : ''}</span></div>` : ''}
    </details>`;
  };
  const unread = kind === 'noi_quy' && me.employee_id ? docs.filter((d) => d.published_version > 0 && d.read_version !== d.published_version).length : 0;
  const body = html`${raw(DOC_STYLE)}<style>
      .doc-sum { cursor: pointer; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; list-style: none; }
      .doc-sum::-webkit-details-marker { display: none; }
      .doc-sum::before { content: '▸'; color: var(--muted); } details[open] > .doc-sum::before { content: '▾'; }
      .doc-title { font-size: 17px; font-weight: 700; flex: 1 1 auto; }
      .st-meta { font-size: 12px; color: var(--muted); }
    </style>
    ${seg}
    ${editor ? html`<div class="toolbar"><a class="btn" href="#/tai-lieu/soan?loai=${kind}">+ Soạn ${label.toLowerCase()} mới</a></div>` : ''}
    ${unread ? html`<div class="alert warn">Bạn còn ${unread} nội quy chưa xác nhận đã đọc.</div>` : ''}
    ${shown.length ? shown.map(card) : html`<div class="card">Chưa có ${label.toLowerCase()} nào được đăng.</div>`}`;
  return {
    title: label,
    html: isManager()
      ? html`<div class="page-head"><div><h1>${label}</h1><div class="sub">${kind === 'noi_quy' ? 'Nhân viên đọc và bấm “Tôi đã đọc”. Trạng thái hiện ở cột Nội quy trong tab Nhân viên.' : 'Quy trình làm việc cho nhân viên xem.'}</div></div>
          <div id="saved-indicator" class="saved" role="status" hidden></div></div><div class="stack" style="max-width:860px;gap:12px">${body}</div>`
      : html`<div class="stack" style="gap:12px">${body}</div>`,
    async mount(root) {
      $$('.read-btn').forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_tl_read', { p_id: Number(b.dataset.id) }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.mv').forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_tl_move', { p_id: Number(b.dataset.id), p_dir: Number(b.dataset.dir) }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      if (focus) document.getElementById(`doc-${focus}`)?.scrollIntoView({ block: 'start' });
      await fillImages(root);
    },
  };
}
