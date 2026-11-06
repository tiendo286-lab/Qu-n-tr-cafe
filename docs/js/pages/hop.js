// Họp: danh sách cuộc họp (lấy nội dung bàn giao ca chưa xong để giao việc)
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, go, html, showSaved } from '../ui.js';
import { STYLE } from './viec.js';

export const perm = 'hop_giao_viec';

export async function render() {
  const meetings = await rpc('app_viec_meetings');
  const today = vnToday();
  return {
    title: 'Họp',
    html: html`${STYLE}<div class="page-head"><div><h1>Họp</h1><div class="sub">Ghi cuộc họp, đưa nội dung bàn giao ca chưa xong vào để giao cho nhân viên. Theo dõi việc ở tab Giao việc.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card stack" style="gap:10px">
          <h2 style="margin:0">THÊM CUỘC HỌP</h2>
          <form id="new-meeting" class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input class="input sm" name="title" placeholder="Tên cuộc họp (vd: Họp quản lý tuần 46)" required style="flex:1 1 240px;min-width:0" aria-label="Tên cuộc họp">
            <input class="input sm" type="date" name="date" value="${today}" required aria-label="Ngày họp">
            <button class="btn sm" type="submit">+ Thêm cuộc họp</button></form>
          <div class="st-meta">Khi mở cuộc họp sẽ thấy các nội dung bàn giao ca chưa hoàn thành để đưa vào và giao cho nhân viên.</div></section>
        ${meetings.length ? html`<section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Ngày</th><th>Cuộc họp</th><th>Công việc</th><th>Người tạo</th></tr></thead>
          <tbody>${meetings.map((m) => html`<tr><td>${dmy(m.meeting_date)}</td><td><a href="#/quan-ly/hop/chi-tiet?id=${m.id}"><strong>${m.title}</strong></a></td>
            <td>${m.done}/${m.total} đã xử lý</td><td class="st-meta">${m.created_by}</td></tr>`)}</tbody></table></div></section>`
        : html`<div class="card">Chưa có cuộc họp nào.</div>`}
      </div>`,
    mount() {
      $('#new-meeting').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        try { const id = await rpc('app_viec_meeting_save', { p_id: null, p_title: f.title.value, p_date: f.date.value, p_note: null }); go(`/quan-ly/hop/chi-tiet?id=${id}`); }
        catch (e) { showSaved(e.message, true); }
      });
    },
  };
}
