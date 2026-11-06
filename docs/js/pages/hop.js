// Họp & giao việc: danh sách cuộc họp, báo cáo chờ duyệt, tất cả công việc
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, flash, go, html, norm, showSaved } from '../ui.js';
import { STATUS, STYLE, dueText, history, sourceText } from './viec.js';

export const perm = 'hop_giao_viec';

// Ô duyệt / yêu cầu làm lại (dùng cả ở trang chi tiết cuộc họp)
export const reviewBox = (t) => html`<div class="stack rv" style="gap:6px">
  <div class="tk-report"><strong>Báo cáo của ${t.assignee_name}</strong> <span class="st-meta">${dt(t.submitted_at)}</span><br>${t.report}</div>
  <textarea class="input rv-note" rows="2" placeholder="Ý kiến (bắt buộc khi yêu cầu làm lại)" aria-label="Ý kiến duyệt"></textarea>
  <div class="toolbar" style="gap:8px"><button type="button" class="btn sm rv-ok" data-id="${t.id}">Duyệt hoàn thành</button>
    <button type="button" class="btn sm secondary danger rv-no" data-id="${t.id}">Yêu cầu làm lại</button></div></div>`;

export function bindReview(after = rerender) {
  $$('.rv-ok, .rv-no').forEach((b) => b.addEventListener('click', async () => {
    const ok = b.classList.contains('rv-ok');
    const note = b.closest('.rv').querySelector('.rv-note').value;
    if (!ok && !note.trim()) { showSaved('Ghi ý kiến khi yêu cầu làm lại.', true); return; }
    if (!confirm(ok ? 'Duyệt hoàn thành việc này?' : 'Trả việc về cho quản lý làm lại?')) return;
    try { await rpc('app_viec_review', { p_task: Number(b.dataset.id), p_ok: ok, p_note: note }); flash(ok ? 'Đã duyệt hoàn thành.' : 'Đã yêu cầu làm lại.'); after(); }
    catch (e) { showSaved(e.message, true); }
  }));
}

const taskRow = (t, review) => html`<article class="card stack tk ${t.overdue ? 'tk-late' : ''}" style="gap:6px;padding:14px" data-search="${norm(t.content + ' ' + (t.assignee_name || ''))}" data-status="${t.status}" data-ass="${t.assignee_id || ''}">
  <div class="tk-top"><span><span class="pill ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span> ${t.assignee_name ? html`· <strong>${t.assignee_name}</strong>` : ''}</span>${dueText(t)}</div>
  <div class="tk-content">${t.content}</div>
  <div class="st-meta">${sourceText(t)}${t.meeting_id ? html` · <a href="#/quan-ly/hop/chi-tiet?id=${t.meeting_id}">Họp ${dmy(t.meeting_date)}</a>` : ''}</div>
  ${review && t.status === 'cho_duyet' ? reviewBox(t) : t.report ? html`<div class="tk-report"><strong>Báo cáo:</strong> ${t.report}</div>` : ''}
  ${history(t)}</article>`;

export async function render({ params }) {
  const tab = ['cho-duyet', 'tat-ca'].includes(params.tab) ? params.tab : 'cuoc-hop';
  const [meetings, all] = await Promise.all([rpc('app_viec_meetings'), rpc('app_viec_all')]);
  const waiting = all.filter((t) => t.status === 'cho_duyet');
  const today = vnToday();
  const assignees = [...new Map(all.filter((t) => t.assignee_id).map((t) => [t.assignee_id, t.assignee_name])).entries()];
  const tabs = html`<nav class="tabs-nav" aria-label="Họp & giao việc">
    <a class="${tab === 'cuoc-hop' ? 'on' : ''}" href="#/quan-ly/hop">Cuộc họp (${meetings.length})</a>
    <a class="${tab === 'cho-duyet' ? 'on' : ''}" href="#/quan-ly/hop?tab=cho-duyet">Chờ duyệt (${waiting.length})</a>
    <a class="${tab === 'tat-ca' ? 'on' : ''}" href="#/quan-ly/hop?tab=tat-ca">Tất cả công việc (${all.filter((t) => t.status !== 'hoan_thanh').length})</a></nav>`;

  let body;
  if (tab === 'cuoc-hop') {
    body = html`<section class="card stack" style="gap:10px">
        <h2 style="margin:0">THÊM CUỘC HỌP</h2>
        <form id="new-meeting" class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input class="input sm" name="title" placeholder="Tên cuộc họp (vd: Họp quản lý tuần 46)" required style="flex:1 1 240px;min-width:0" aria-label="Tên cuộc họp">
          <input class="input sm" type="date" name="date" value="${today}" required aria-label="Ngày họp">
          <button class="btn sm" type="submit">+ Thêm cuộc họp</button></form>
        <div class="st-meta">Khi mở cuộc họp sẽ thấy các nội dung bàn giao ca chưa hoàn thành để đưa vào danh sách cần xử lý và giao cho quản lý.</div></section>
      ${meetings.length ? html`<section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Ngày</th><th>Cuộc họp</th><th>Công việc</th><th>Chờ duyệt</th><th>Người tạo</th></tr></thead>
        <tbody>${meetings.map((m) => html`<tr><td>${dmy(m.meeting_date)}</td><td><a href="#/quan-ly/hop/chi-tiet?id=${m.id}"><strong>${m.title}</strong></a></td>
          <td>${m.done}/${m.total} hoàn thành</td><td>${m.waiting ? html`<span class="pill warn">${m.waiting}</span>` : '—'}</td><td class="st-meta">${m.created_by}</td></tr>`)}</tbody></table></div></section>`
      : html`<div class="card">Chưa có cuộc họp nào.</div>`}`;
  } else if (tab === 'cho-duyet') {
    body = waiting.length ? html`${waiting.map((t) => taskRow(t, true))}` : html`<div class="card">Không có báo cáo nào chờ duyệt.</div>`;
  } else {
    body = html`<section class="card toolbar" style="padding:12px 14px;gap:8px">
        <input class="input sm" id="f-q" type="search" placeholder="Tìm nội dung / người" style="flex:1 1 200px;min-width:0" aria-label="Tìm">
        <select class="input sm" id="f-st" aria-label="Trạng thái"><option value="">Chưa hoàn thành</option>${Object.entries(STATUS).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}<option value="*">Tất cả</option></select>
        <select class="input sm" id="f-ass" aria-label="Người phụ trách"><option value="">Mọi người phụ trách</option>${assignees.map(([id, n]) => html`<option value="${id}">${n}</option>`)}</select>
        <span class="st-meta" id="f-count"></span></section>
      ${all.map((t) => taskRow(t, true))}`;
  }
  return {
    title: 'Họp & giao việc',
    html: html`${STYLE}<div class="page-head"><div><h1>Họp &amp; giao việc</h1><div class="sub">Giao việc cho quản lý, theo dõi tiến độ và duyệt báo cáo xử lý.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">${tabs}${body}</div>`,
    mount() {
      $('#new-meeting')?.addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        try { const id = await rpc('app_viec_meeting_save', { p_id: null, p_title: f.title.value, p_date: f.date.value, p_note: null }); go(`/quan-ly/hop/chi-tiet?id=${id}`); }
        catch (e) { showSaved(e.message, true); }
      });
      bindReview();
      const q = $('#f-q');
      if (q) {
        const apply = () => {
          const s = norm(q.value.trim()); const st = $('#f-st').value; const as = $('#f-ass').value; let n = 0;
          $$('.tk').forEach((c) => {
            const show = (!s || c.dataset.search.includes(s)) && (st === '*' || (st ? c.dataset.status === st : c.dataset.status !== 'hoan_thanh')) && (!as || c.dataset.ass === as);
            c.hidden = !show; if (show) n++;
          });
          $('#f-count').textContent = `${n} việc`;
        };
        [q, $('#f-st'), $('#f-ass')].forEach((el) => el.addEventListener('input', apply)); apply();
      }
    },
  };
}
