import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, dialog, html, showSaved } from '../ui.js';

export function trainingWork(T) {
  if (!T.due) return '';
  const active = T.status !== 'hoan_thanh';
  const reviewOpen = T.today >= T.review_from;
  const canFinish = T.status === 'cho_nhan_xet';
  return html`<section class="card stack" style="gap:12px">
    <h2 style="margin:0">Công việc đào tạo</h2>
    <div class="toolbar">Hạn hoàn thành: <strong>${dmy(T.due)}</strong>
      ${active && T.today > T.due ? html`<span class="pill off" id="dt-overdue">Quá hạn</span>` : ''}</div>
    ${T.workflow_review_at ? html`<div><strong>Nhận xét cuối</strong> · ${dt(T.workflow_review_at)}<div style="overflow-wrap:anywhere">${T.workflow_review}</div></div>` : ''}
    ${active && T.can_review ? html`<form id="dt-remind"><button class="btn secondary">Nhắc hoàn thành đúng hạn</button></form>` : ''}
    ${active && T.can_review && !reviewOpen ? html`<div class="sub">Có thể hoàn thành từ ${dmy(T.review_from)} (mốc 8 ngày).</div>` : ''}
    ${active && T.can_review && reviewOpen ? (canFinish ? html`<form id="dt-review" class="stack" style="gap:8px">
      <label class="pc-f"><span>Nhận xét cuối</span><textarea class="input" name="note" rows="3" required></textarea></label>
      <div><button id="dt-finish" class="btn">Hoàn thành</button></div>
    </form>` : html`<div class="stack" style="gap:6px">
      <div><button id="dt-finish" class="btn" type="button" disabled>Hoàn thành</button></div>
      <span class="sub">Cần hoàn thành đủ các hạng mục trên phiếu.</span>
    </div>`) : ''}
  </section>`;
}

export function bindTrainingWork(root, T, rerender) {
  const bind = (id, name, payload, success, reload = true) => {
    const form = $(id, root);
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        await rpc(name, { p_id: T.id, ...payload(form.elements) });
        if (reload) rerender();
        else showSaved(success);
      } catch (error) { showSaved(error.message, true); }
      finally { button.disabled = false; }
    });
  };
  bind('#dt-review', 'app_dt_work_action', (f) => ({ p_action: 'review', p_note: f.note.value }));
  bind('#dt-remind', 'app_dt_work_action', () => ({ p_action: 'remind', p_note: null }), 'Đã gửi lời nhắc.', false);
}

export function openItemGuide(T, item, assignment, rerender, stageTwo) {
  const d = dialog(html`<div class="d-head"><h3>${stageTwo ? 'Giao giai đoạn 2' : 'Phân công hạng mục'}</h3></div>
    <form id="dt-guide-person-form" class="d-body stack" style="gap:10px">
      <strong>${item.no}. ${item.title}</strong>
      <label class="pc-f"><span>Người hướng dẫn</span>
        <select name="person" class="input" ${stageTwo ? 'required' : ''}>
          <option value="">${stageTwo ? 'Chọn người hướng dẫn' : 'Người hướng dẫn chính' + (T.instructor ? ' · ' + T.instructor : '')}</option>
          ${(T.helpers || []).map((p) => html`<option value="${p.id}" ${p.id === (assignment?.employee_id ?? (stageTwo ? T.instructor_id : null)) ? 'selected' : ''}>${p.name}</option>`)}
        </select>
      </label>
      <label class="pc-f"><span>Cơ sở đào tạo</span>
        <select name="branch" class="input">
          <option value="">${T.branch ? 'Theo phiếu · ' + T.branch : 'Chưa chọn'}</option>
          ${(T.item_branches || []).map((b) => html`<option value="${b.id}" ${b.id === assignment?.branch_id ? 'selected' : ''}>${b.code}</option>`)}
        </select>
      </label>
      ${stageTwo ? html`<label class="pc-f"><span>Nội dung cần luyện thêm</span>
        <textarea class="input" name="note" rows="2">${assignment?.note || ''}</textarea>
      </label>` : ''}
      <div role="alert" class="sub" data-error></div>
      <div class="toolbar">
        <button class="btn secondary" type="button" data-close>Hủy</button>
        <button class="btn" type="submit">Lưu phân công</button>
      </div>
    </form>`);
  $('[data-close]', d).onclick = () => d.close();
  const form = $('#dt-guide-person-form', d);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      await rpc('app_dt_followup_save', { p_id: T.id, p_no: item.no,
        p_employee: Number(form.elements.person.value) || null, p_note: form.elements.note?.value || null, p_extra: stageTwo,
        p_branch: Number(form.elements.branch.value) || null });
      d.close();
      rerender();
    } catch (error) {
      $('[data-error]', form).textContent = error.message;
      button.disabled = false;
    }
  };
}
