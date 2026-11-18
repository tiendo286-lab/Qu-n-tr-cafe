import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, flash, html } from '../ui.js';
import { DT_STATUS, dtLabel } from './dao_tao.js?v=2026.11.19.6';

const PROGRAMS = [['chay_ban', 'Chạy bàn'], ['pha_che', 'Pha chế']];

export async function render({ params }) {
  const program = params.muc === 'pha_che' ? 'pha_che' : 'chay_ban';
  const D = await rpc('app_dt_work_list');
  const cards = D.rows.filter((t) => t.program === program).map((t) => {
    const late = t.status !== 'hoan_thanh' && t.due < D.today;
    return html`<a class="card stack" style="color:inherit;text-decoration:none;gap:6px" href="#/dao-tao/phieu?id=${t.id}">
      <strong>${t.employee}</strong>
      <div class="toolbar"><span class="pill ${DT_STATUS[t.status][1]}">${dtLabel(t)}</span>
        ${late ? html`<span class="pill off">Quá hạn</span>` : ''}</div>
      <div class="sub">${t.achieved}/${t.total} hạng mục · Hạn ${dmy(t.due)}</div>
      ${t.instructor ? html`<div>Hướng dẫn: ${t.instructor}</div>` : ''}
      ${t.my_followups ? html`<div>Bạn phụ trách ${t.my_followups} hạng mục bổ sung</div>` : ''}
    </a>`;
  });
  return {
    title: 'Công việc đào tạo',
    html: html`<div class="page-head"><h1>Công việc đào tạo</h1><a class="btn secondary" href="#/viec">Việc của tôi</a></div>
      <div id="dt-work" class="stack" style="max-width:760px;gap:12px">
        <nav class="toolbar" aria-label="Mục đào tạo">
          ${PROGRAMS.map(([key, label]) => html`<a class="btn ${program === key ? '' : 'secondary'}"
            href="#/cong-viec/dao-tao?muc=${key}" aria-current="${program === key ? 'page' : 'false'}">${label}</a>`)}
        </nav>
        ${D.accounts ? html`<form id="dt-reviewer" class="card stack" style="gap:8px">
          <label class="stack" style="gap:4px">Người kiểm tra, nhắc hạn và nhận xét cuối
            <select class="input" name="reviewer" required>
              <option value="">Chọn tài khoản</option>
              ${D.accounts.map((a) => html`<option value="${a.id}" ${a.id === D.reviewer_id ? 'selected' : ''}>${a.name}</option>`)}
            </select>
          </label><div><button class="btn secondary">Lưu người phụ trách</button></div>
          <div id="dt-reviewer-error" role="alert"></div>
        </form>` : ''}
        ${D.reviewer ? html`<div class="sub">Người nhận xét cuối: ${D.reviewer}</div>` : ''}
        ${cards.length ? cards : html`<div class="card">${program === 'pha_che' ? 'Chưa có phiếu đào tạo Pha chế.' : 'Chưa có phiếu đào tạo Chạy bàn.'}</div>`}
      </div>`,
    mount(root) {
      const form = $('#dt-reviewer', root);
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        try {
          await rpc('app_dt_reviewer_save', { p_account: Number(form.elements.reviewer.value) });
          flash('Đã lưu người phụ trách đào tạo.');
          rerender();
        } catch (error) {
          $('#dt-reviewer-error', form).textContent = error.message;
          button.disabled = false;
        }
      });
    },
  };
}
