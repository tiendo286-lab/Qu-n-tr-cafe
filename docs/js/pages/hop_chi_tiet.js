// Chi tiết cuộc họp: đưa nội dung bàn giao chưa xong vào danh sách, giao việc / nhiệm vụ đào tạo cho quản lý
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, flash, go, hhmm, html, showSaved } from '../ui.js';
import { STATUS, STYLE, dueText, history, sourceText } from './viec.js';
import { bindReview, reviewBox } from './hop.js';

export const perm = 'hop_giao_viec';

export async function render({ params }) {
  const M = await rpc('app_viec_meeting_get', { p_id: Number(params.id) });
  const mgrOpts = (sel) => html`<option value="">— Chưa phân công —</option>${M.managers.map((m) => html`<option value="${m.id}" ${String(m.id) === String(sel) ? 'selected' : ''}>${m.name}${m.role === 'ql_tong' ? ' (QL tổng)' : ''}</option>`)}`;
  const editable = (t) => ['chua_phan_cong', 'da_giao', 'dang_xu_ly'].includes(t.status);

  const task = (t) => html`<article class="card stack tk ${t.overdue ? 'tk-late' : ''}" style="gap:8px;padding:14px" data-id="${t.id}">
    <div class="tk-top"><span class="pill ${STATUS[t.status][1]}">${STATUS[t.status][0]}</span>${dueText(t)}</div>
    ${editable(t) ? html`<textarea class="input tk-edit" data-f="content" rows="2" aria-label="Nội dung công việc">${t.content}</textarea>` : html`<div class="tk-content">${t.content}</div>`}
    <div class="st-meta">${sourceText(t)}</div>
    ${editable(t) ? html`<div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label class="st-meta">Quản lý phụ trách <select class="input sm tk-edit" data-f="assignee_id" aria-label="Quản lý phụ trách">${mgrOpts(t.assignee_id)}</select></label>
        <label class="st-meta">Hạn hoàn thành <input class="input sm tk-edit" type="date" data-f="due_date" value="${t.due_date || ''}" aria-label="Hạn hoàn thành"></label>
        <button type="button" class="btn sm secondary danger tk-del" style="margin-left:auto">Xóa việc</button></div>
        ${t.status === 'chua_phan_cong' ? html`<div class="st-meta">Chọn quản lý phụ trách và hạn → việc tự chuyển “Đã giao” và người đó nhận thông báo.</div>` : ''}
        ${t.status === 'dang_xu_ly' && t.review_note ? html`<div class="st-meta">Đã yêu cầu làm lại: ${t.review_note}</div>` : ''}`
    : html`<div class="st-meta">Phụ trách: ${t.assignee_name || '—'}</div>`}
    ${t.status === 'cho_duyet' ? reviewBox(t) : t.status === 'hoan_thanh' ? html`<div class="tk-report"><strong>Báo cáo:</strong> ${t.report}<div class="st-meta">Duyệt: ${t.approved_by_name} · ${dt(t.approved_at)}</div></div>` : ''}
    ${history(t)}</article>`;

  const empOpts = html`${M.employees.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}`;
  return {
    title: M.title,
    html: html`${STYLE}<div class="page-head"><div><h1>${M.title}</h1><div class="sub">Họp ngày ${dmy(M.meeting_date)} · tạo bởi ${M.created_by_name || '—'}</div></div>
        <div class="toolbar"><a class="btn sm secondary" href="#/quan-ly/hop">‹ Danh sách cuộc họp</a><div id="saved-indicator" class="saved" role="status" hidden></div></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card stack" style="gap:10px"><h2 style="margin:0">Thông tin cuộc họp</h2>
          <form id="m-form" class="stack" style="gap:8px">
            <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap">
              <input class="input sm" name="title" value="${M.title}" required style="flex:1 1 240px;min-width:0" aria-label="Tên cuộc họp">
              <input class="input sm" type="date" name="date" value="${M.meeting_date}" required aria-label="Ngày họp"></div>
            <textarea class="input" name="note" rows="3" placeholder="Ghi chú / biên bản ngắn" aria-label="Ghi chú">${M.note || ''}</textarea>
            <div class="toolbar" style="gap:8px"><button class="btn sm" type="submit">Lưu thông tin</button>
              ${M.tasks.length ? '' : html`<button type="button" class="btn sm secondary danger" id="m-del">Xóa cuộc họp</button>`}</div></form></section>

        <section class="card stack" style="gap:10px">
          <h2 style="margin:0">Nội dung bàn giao chưa hoàn thành (${M.open_handover.length})</h2>
          ${M.open_handover.length ? html`<div class="st-meta">Tick các nội dung cần xử lý rồi bấm “Đưa vào cuộc họp”. Sau khi đưa vào và giao, ca sau không tự đánh dấu xong được — chỉ hoàn thành khi bạn duyệt báo cáo xử lý.</div>
            <div class="stack" style="gap:6px">${M.open_handover.map((h) => html`<label class="ho-pick"><input type="checkbox" class="check ho-cb" value="${h.id}">
              <span><strong>${h.content}</strong><br><span class="st-meta"><a href="#/ca/phieu?id=${h.report_id}">Phiếu ca ${h.shift} ${h.branch} ${dmy(h.work_date)}</a> · ${h.by || ''}</span></span></label>`)}</div>
            <div><button type="button" class="btn sm" id="ho-add">Đưa các mục đã chọn vào cuộc họp</button></div>`
          : html`<div class="st-meta">Không có nội dung bàn giao nào đang tồn.</div>`}</section>

        <h2 style="margin:6px 0 0">Công việc của cuộc họp (${M.tasks.length})</h2>
        ${M.tasks.map(task)}

        <section class="card stack" style="gap:10px"><h2 style="margin:0">+ Thêm công việc</h2>
          <form id="add-task" class="stack" style="gap:8px">
            <textarea class="input" name="content" rows="2" placeholder="Nội dung công việc" required aria-label="Nội dung công việc"></textarea>
            <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select class="input sm" name="assignee" aria-label="Quản lý phụ trách">${mgrOpts('')}</select>
              <input class="input sm" type="date" name="due" aria-label="Hạn hoàn thành">
              <button class="btn sm" type="submit">Thêm việc</button></div></form></section>

        <section class="card stack" style="gap:10px"><h2 style="margin:0">+ Giao nhiệm vụ đào tạo</h2>
          <form id="add-train" class="stack" style="gap:8px">
            <input class="input sm" name="emp" list="emp-list" placeholder="Nhân viên cần đào tạo (gõ mã hoặc tên)" required aria-label="Nhân viên cần đào tạo"><datalist id="emp-list">${empOpts}</datalist>
            <textarea class="input" name="content" rows="2" placeholder="Nội dung còn thiếu (vd: SOP 05 thanh toán, đóng cửa ca tối)" required aria-label="Nội dung đào tạo còn thiếu"></textarea>
            <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select class="input sm" name="assignee" aria-label="Quản lý phụ trách">${mgrOpts('')}</select>
              <input class="input sm" type="date" name="due" aria-label="Hạn hoàn thành">
              <button class="btn sm" type="submit">Giao đào tạo</button></div>
            <div class="st-meta">Hoàn thành nhiệm vụ đào tạo không tự đánh dấu nhân viên đạt cả chương trình. Liên kết với phiếu đào tạo sẽ có ở phần Đào tạo.</div></form></section>
      </div>
      <style>.ho-pick { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--line-soft); border-radius: 10px; cursor: pointer; } .ho-pick input { margin-top: 3px; }</style>`,
    mount() {
      $('#m-form').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        try { await rpc('app_viec_meeting_save', { p_id: M.id, p_title: f.title.value, p_date: f.date.value, p_note: f.note.value }); showSaved('Đã lưu · ' + hhmm()); }
        catch (e) { showSaved(e.message, true); }
      });
      $('#m-del')?.addEventListener('click', async () => {
        if (!confirm('Xóa cuộc họp này?')) return;
        try { await rpc('app_viec_meeting_delete', { p_id: M.id }); flash('Đã xóa cuộc họp.'); go('/quan-ly/hop'); } catch (e) { showSaved(e.message, true); }
      });
      $('#ho-add')?.addEventListener('click', async () => {
        const ids = $$('.ho-cb:checked').map((c) => Number(c.value));
        if (!ids.length) { showSaved('Chưa chọn nội dung nào.', true); return; }
        try { for (const id of ids) await rpc('app_viec_add', { p_meeting: M.id, p: { handover_item_id: id } }); flash(`Đã đưa ${ids.length} nội dung vào cuộc họp. Hãy chọn người phụ trách và hạn.`); rerender(); }
        catch (e) { showSaved(e.message, true); rerender(); }
      });
      // sửa việc: lưu ngay khi đổi
      $$('.tk-edit').forEach((el) => el.addEventListener('change', async () => {
        const id = Number(el.closest('.tk').dataset.id);
        try { await rpc('app_viec_update', { p_task: id, p: { [el.dataset.f]: el.value || null } }); showSaved('Đã lưu · ' + hhmm()); if (el.dataset.f !== 'content') rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa công việc này? Nếu việc lấy từ nội dung bàn giao, nội dung đó sẽ trở lại danh sách chưa hoàn thành.')) return;
        try { await rpc('app_viec_delete', { p_task: Number(b.closest('.tk').dataset.id) }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $('#add-task').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        try { await rpc('app_viec_add', { p_meeting: M.id, p: { kind: 'viec', content: f.content.value, assignee_id: f.assignee.value || null, due_date: f.due.value || null } }); flash('Đã thêm việc.'); rerender(); }
        catch (e) { showSaved(e.message, true); }
      });
      $('#add-train').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target;
        const q = f.emp.value.trim().toLowerCase(); const code = q.split(/\s*[–-]\s*/)[0];
        const e = M.employees.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || M.employees.find((x) => String(x.code).toLowerCase() === code);
        if (!e) { showSaved('Không tìm thấy nhân viên. Chọn trong danh sách gợi ý.', true); return; }
        try { await rpc('app_viec_add', { p_meeting: M.id, p: { kind: 'dao_tao', employee_id: e.id, content: f.content.value, assignee_id: f.assignee.value || null, due_date: f.due.value || null } }); flash('Đã giao nhiệm vụ đào tạo.'); rerender(); }
        catch (err) { showSaved(err.message, true); }
      });
      bindReview();
    },
  };
}
