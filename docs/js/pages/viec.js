// Việc của tôi (quản lý nhận việc được giao qua tab Họp) + phần hiển thị việc dùng chung
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $$, flash, html, showSaved } from '../ui.js';

export const perm = 'nhan_viec';

export const STATUS = {
  chua_phan_cong: ['Chưa phân công', 'mute'], da_giao: ['Đã giao', 'info'], dang_xu_ly: ['Đang xử lý', 'info'],
  cho_duyet: ['Chờ duyệt', 'warn'], hoan_thanh: ['Hoàn thành', 'ok'],
};
const ACTION = { tao: 'Tạo việc', giao: 'Giao việc', bat_dau: 'Bắt đầu xử lý', bao_cao: 'Gửi báo cáo', duyet: 'Duyệt hoàn thành', lam_lai: 'Yêu cầu làm lại', sua: 'Sửa' };

export function dueText(t) {
  if (!t.due_date) return html`<span class="st-meta">Chưa có hạn</span>`;
  const today = vnToday();
  const late = t.status !== 'hoan_thanh' && t.status !== 'cho_duyet' && t.due_date < today;
  const isToday = t.status !== 'hoan_thanh' && t.due_date === today;
  return html`<span class="${late ? 'due-late' : isToday ? 'due-today' : ''}">Hạn ${dmy(t.due_date)}${late ? ' · QUÁ HẠN' : isToday ? ' · HÔM NAY' : ''}</span>`;
}

export function sourceText(t) {
  if (t.kind === 'dao_tao') return html`<span class="pill info">Đào tạo</span> ${t.employee || ''}`;
  if (t.source) return html`<a href="#/ca/phieu?id=${t.source.report_id}">Bàn giao ca ${t.source.shift} ${t.source.branch} ${dmy(t.source.work_date)}</a>`;
  return t.meeting_title ? html`Cuộc họp: ${t.meeting_title}` : '';
}

export function history(t) {
  if (!(t.events || []).length) return '';
  return html`<details class="tk-hist"><summary>Lịch sử (${t.events.length})</summary>
    ${t.events.map((e) => html`<div class="tk-ev"><span class="st-meta">${dt(e.at)} · ${e.by || ''}</span> <strong>${ACTION[e.action] || e.action}</strong>${e.note ? html`: ${e.note}` : ''}</div>`)}</details>`;
}

function card(t) {
  const st = STATUS[t.status];
  const canWork = t.status === 'da_giao' || t.status === 'dang_xu_ly';
  return html`<article class="card stack tk ${t.overdue ? 'tk-late' : ''}" style="gap:8px;padding:14px">
    <div class="tk-top"><span class="pill ${st[1]}">${st[0]}</span>${dueText(t)}</div>
    <div class="tk-content">${t.content}</div>
    <div class="st-meta">${sourceText(t)}${t.created_by_name ? html` · Người giao: ${t.created_by_name}` : ''}</div>
    ${t.status === 'dang_xu_ly' && t.review_note ? html`<div class="alert warn" style="font-size:13px"><strong>Yêu cầu làm lại:</strong> ${t.review_note}</div>` : ''}
    ${t.report && t.status !== 'dang_xu_ly' ? html`<div class="tk-report"><strong>Báo cáo:</strong> ${t.report}</div>` : ''}
    ${t.status === 'cho_duyet' ? html`<div class="st-meta">Đã gửi báo cáo ${dt(t.submitted_at)} — đang chờ chủ hệ thống duyệt.</div>` : ''}
    ${t.status === 'hoan_thanh' ? html`<div class="st-meta">Duyệt: ${t.approved_by_name} · ${dt(t.approved_at)}${t.review_note ? ' · ' + t.review_note : ''}</div>` : ''}
    ${canWork ? html`<div class="stack" style="gap:6px">
      ${t.status === 'da_giao' ? html`<div><button type="button" class="btn sm secondary tk-start" data-id="${t.id}">Bắt đầu xử lý</button></div>` : ''}
      <textarea class="input tk-rep" rows="3" placeholder="Báo cáo kết quả xử lý (đã làm gì, kết quả, chi phí nếu có)" aria-label="Báo cáo kết quả">${t.status === 'dang_xu_ly' && t.report ? t.report : ''}</textarea>
      <div><button type="button" class="btn sm tk-submit" data-id="${t.id}">Gửi báo cáo để duyệt</button></div></div>` : ''}
    ${history(t)}</article>`;
}

export async function render() {
  const list = await rpc('app_viec_mine');
  const today = vnToday();
  const open = list.filter((t) => t.status === 'da_giao' || t.status === 'dang_xu_ly');
  const groups = [
    ['Quá hạn', open.filter((t) => t.due_date && t.due_date < today), 'due-late'],
    ['Đến hạn hôm nay', open.filter((t) => t.due_date === today), 'due-today'],
    ['Việc còn lại chưa hoàn thành', open.filter((t) => !t.due_date || t.due_date > today), ''],
    ['Đã gửi báo cáo — chờ duyệt', list.filter((t) => t.status === 'cho_duyet'), ''],
    ['Đã hoàn thành (30 ngày gần đây)', list.filter((t) => t.status === 'hoan_thanh'), ''],
  ];
  return {
    title: 'Việc của tôi',
    html: html`${STYLE}<div class="page-head"><div><h1>Việc của tôi</h1><div class="sub">Công việc và nhiệm vụ đào tạo được giao cho bạn qua tab Họp. Làm xong thì gửi báo cáo để chủ hệ thống duyệt.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:760px;gap:14px">
        ${list.length ? '' : html`<div class="card">Chưa có việc nào được giao cho bạn.</div>`}
        ${groups.filter(([, items]) => items.length).map(([name, items, cls]) => html`<h2 class="tk-group ${cls}">${name} (${items.length})</h2>${items.map(card)}`)}
      </div>`,
    mount() {
      $$('.tk-start').forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_viec_start', { p_task: Number(b.dataset.id) }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-submit').forEach((b) => b.addEventListener('click', async () => {
        const rep = b.closest('.tk').querySelector('.tk-rep').value;
        if (!rep.trim()) { showSaved('Nhập báo cáo kết quả trước khi gửi.', true); return; }
        if (!confirm('Gửi báo cáo cho chủ hệ thống duyệt?')) return;
        try { await rpc('app_viec_submit', { p_task: Number(b.dataset.id), p_report: rep }); flash('Đã gửi báo cáo, đang chờ duyệt.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}

export const STYLE = html`<style>
  .pill.info { background: #dbeafe; color: #1e3a8a; }
  .tk-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; font-weight: 600; }
  .tk-content { font-size: 15px; font-weight: 600; white-space: pre-wrap; }
  .tk-late { border-left: 4px solid #dc2626; }
  .due-late { color: #b91c1c; font-weight: 700; }
  .due-today { color: #b45309; font-weight: 700; }
  h2.tk-group { margin: 6px 0 0; font-size: 16px; }
  .tk-report { font-size: 14px; background: #f7f8fb; border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; }
  .tk-hist summary { cursor: pointer; font-size: 12px; color: var(--muted); }
  .tk-ev { font-size: 13px; padding: 3px 0; }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
</style>`;
