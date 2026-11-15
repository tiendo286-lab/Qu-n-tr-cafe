// Việc của tôi: việc được giao cho mình — Chờ nhận → Đang xử lý → Đã xử lý (+ phần hiển thị việc dùng chung)
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $$, flash, html, showSaved } from '../ui.js';
import { SOURCES, STATES, isSourceTask, sourceLabel, stateOf, validSourceLink } from '../cong_viec.js';

export const perm = 'nhan_viec';
export const taskNav = (active, count = null) => html`<nav class="cv-nav" aria-label="Trung tâm Công việc"><a class="${active === 'tasks' ? 'on' : ''}" href="#/quan-ly/giao-viec">Theo dõi công việc</a><a class="${active === 'rules' ? 'on' : ''}" href="#/quan-ly/giao-viec?tab=quy-tac">Phân công & tự động${count === null ? '' : html` <b>${count}</b>`}</a><a class="${active === 'mine' ? 'on' : ''}" href="#/viec">Việc của tôi</a></nav>`;

export const STATUS = {
  chua_phan_cong: ['Chưa giao', 'mute'], da_giao: ['Chờ nhận', 'warn'], dang_xu_ly: ['Đang xử lý', 'info'],
  cho_duyet: ['Chờ xác nhận', 'warn'], hoan_thanh: ['Hoàn thành', 'ok'],
};
// Mức độ công việc (dùng chung với tab Công việc)
export const PRI = { gap: { label: 'Gấp', cls: 'vp-gap' }, binh_thuong: { label: 'Bình thường', cls: 'vp-tb' }, thap: { label: 'Thấp', cls: 'vp-thap' } };
const PRI_RANK = { gap: 0, binh_thuong: 1, thap: 2 };
// Loại công việc + nhóm (chốt 07/11): Vận hành / Quản lý
export const CAT = { van_hanh: { label: 'Vận hành', cls: 'vk-vh' }, quan_ly: { label: 'Quản lý', cls: 'vk-ql' } };
export const TOPICS = {
  van_hanh: [['hong_hoc', 'Hỏng hóc, sửa chữa'], ['doi_soat_ca', 'Đối soát ca'], ['khoan_am', 'Khoản âm'], ['ban_giao', 'Bàn giao ca'], ['ve_sinh', 'Vệ sinh'], ['nhap_hang', 'Nhập hàng, kho'], ['khac_vh', 'Khác']],
  quan_ly: [['dao_tao', 'Đào tạo nhân viên'], ['noi_quy', 'Nội quy, quy trình'], ['cam_ket', 'Cam kết'], ['nhan_su', 'Nhân sự, lịch làm'], ['khac_ql', 'Khác']],
};
export const topicLabel = (t) => ([...TOPICS.van_hanh, ...TOPICS.quan_ly].find(([k]) => k === t) || [t, ''])[1];
export const catChip = (c, t) => (c ? html`<span class="vk ${CAT[c]?.cls || ''}">${CAT[c]?.label || c}${t ? html` · ${topicLabel(t)}` : ''}</span>` : '');
const ACTION = { tao: 'Tạo việc', giao: 'Giao việc', bat_dau: 'Nhận việc', bao_cao: 'Báo kết quả', duyet: 'Xác nhận hoàn thành', lam_lai: 'Yêu cầu làm lại', sua: 'Sửa', tu_giao: 'Tự giao theo quy tắc', nguon_xong: 'Hồ sơ gốc hoàn thành', nguon_mo_lai: 'Hồ sơ gốc mở lại', chuyen_du_phong: 'Chuyển dự phòng', huy: 'Hủy việc', khoi_phuc: 'Khôi phục công việc' };

export function dueText(t) {
  if (!t.due_date) return html`<span class="st-meta">Không đặt hạn</span>`;
  const today = vnToday();
  const open = !t.cancelled_at && t.status !== 'hoan_thanh';
  const late = open && t.due_date < today;
  const isToday = open && t.due_date === today;
  return html`<span class="${late ? 'due-late' : isToday ? 'due-today' : ''}">Hạn ${dmy(t.due_date)}${t.due_time ? ' · ' + t.due_time : ''}${late ? ' · QUÁ HẠN' : isToday ? ' · HÔM NAY' : ''}</span>`;
}

export function sourceText(t) {
  if (t.kind === 'dao_tao') return html`<span class="pill info">Đào tạo</span> ${t.employee || ''}${t.training_id ? html` · <a href="#/dao-tao/phieu?id=${t.training_id}">Mở phiếu đào tạo</a>` : ''}`;
  if (t.source) return html`<a href="#/ca/phieu?id=${t.source.report_id}">Bàn giao ca ${t.source.shift} ${t.source.branch} ${dmy(t.source.work_date)}</a>`;
  return t.meeting_title ? html`Cuộc họp: ${t.meeting_title}` : '';
}

export function history(t) {
  if (!(t.events || []).length) return '';
  return html`<details class="tk-hist"><summary>Lịch sử (${t.events.length})</summary>
    ${t.events.map((e) => html`<div class="tk-ev"><span class="st-meta">${dt(e.at)} · ${e.by || ''}</span> <strong>${ACTION[e.action] || e.action}</strong>${e.note ? html`: ${e.note}` : ''}</div>`)}</details>`;
}

// Kết quả + thời điểm xử lý xong (dùng chung)
export function doneText(t) {
  if (t.status !== 'hoan_thanh' && t.status !== 'cho_duyet') return '';
  return html`<div class="tk-report">${t.report ? html`<strong>Kết quả:</strong> ${t.report}<br>` : ''}<span class="st-meta">${t.status === 'cho_duyet' ? 'Đã báo kết quả, chờ xác nhận' : 'Hoàn thành'} ${dt(t.done_at || t.submitted_at)}</span></div>`;
}

function card(t) {
  const st = STATES[stateOf(t)];
  const meta = [sourceText(t), t.created_by_name ? html`Người giao: ${t.created_by_name}` : '', t.link && !isSourceTask(t) ? html`<a href="#${t.link}">Mở trang liên quan</a>` : ''].filter(Boolean);
  return html`<article class="card stack tk ${t.overdue || t.priority === 'gap' ? 'tk-late' : ''}" style="gap:8px;padding:14px">
    <div class="tk-top"><span><span class="pill ${st[1]}">${st[0]}</span>${t.priority && t.priority !== 'binh_thuong' ? html` <span class="vp ${PRI[t.priority].cls}"><i></i>${PRI[t.priority].label}</span>` : ''}</span>${dueText(t)}</div>
    <div>${catChip(t.category, t.topic)} <span class="st-meta">${sourceLabel(t)}${t.branch ? ' · ' + t.branch : ''}${t.watching ? ' · Bạn theo dõi' : ''}</span></div>
    <div class="tk-content">${t.content}</div>
    ${t.source_state?.detail ? html`<div class="st-meta">${t.source_state.detail}</div>` : ''}
    ${t.source_state?.instructions ? html`<div class="tk-report">${t.source_state.instructions}</div>` : ''}
    ${t.source_state?.blocked && t.status !== 'hoan_thanh' ? html`<div class="alert warn">${t.source_state.blocked}</div>` : ''}
    ${isSourceTask(t) ? html`<div class="st-meta">Hoàn thành khi: ${SOURCES[t.cv_kind]?.[1]}. Trạng thái tự cập nhật theo hồ sơ.</div>` : ''}
    ${meta.length ? html`<div class="st-meta">${meta.map((m, i) => html`${i ? ' · ' : ''}${m}`)}</div>` : ''}
    ${t.status === 'dang_xu_ly' && t.review_note ? html`<div class="alert warn" style="font-size:13px"><strong>Yêu cầu làm lại:</strong> ${t.review_note}</div>` : ''}
    ${doneText(t)}
    ${!t.cancelled_at && !t.watching && t.status === 'da_giao' ? html`<div><button type="button" class="btn tk-start" data-id="${t.id}">Nhận việc</button></div>` : ''}
    ${validSourceLink(t.link) && isSourceTask(t) ? html`<div><a class="btn secondary" href="#${validSourceLink(t.link)}">Mở hồ sơ →</a></div>` : ''}
    ${!t.cancelled_at && !t.watching && t.status === 'dang_xu_ly' && !isSourceTask(t) ? html`<div class="stack" style="gap:6px">
      <textarea class="input tk-rep" rows="2" placeholder="${t.reviewer_id ? 'Ghi kết quả để xác nhận (bắt buộc)' : 'Kết quả xử lý (không bắt buộc)'}" aria-label="Kết quả xử lý"></textarea>
      <div><button type="button" class="btn tk-submit" data-id="${t.id}" style="background:var(--ok-line)">${t.reviewer_id ? 'Gửi kết quả để xác nhận' : 'Báo hoàn thành'}</button></div></div>` : ''}
    ${t.can_review && t.status === 'cho_duyet' ? html`<a href="#/quan-ly/giao-viec?viec=${t.id}" class="btn secondary">Mở Công việc để xác nhận</a>` : ''}
    ${history(t)}</article>`;
}

export async function render({ can = () => false } = {}) {
  const list = (await rpc('app_cv_mine')).sort((a, b) => (PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1) || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const by = (s) => list.filter((t) => !t.cancelled_at && t.status === s);
  const groups = [
    ['Chờ nhận', by('da_giao'), 'Bấm “Nhận việc” để báo cho người giao là bạn đã nhận.'],
    ['Đang làm', by('dang_xu_ly'), 'Mở hồ sơ để xử lý; việc thủ công báo kết quả ngay tại đây.'],
    ['Chờ xác nhận', by('cho_duyet'), 'Người được chọn xác nhận kết quả trước khi hoàn thành.'],
    ['Hoàn thành (30 ngày gần đây)', by('hoan_thanh'), ''],
    ['Đã hủy', list.filter((t) => t.cancelled_at), ''],
  ];
  return {
    title: 'Việc của tôi',
    hideHubTabs: can('hop_giao_viec'),
    html: html`${STYLE}<div class="page-head"><div><h1>Việc của tôi</h1><div class="sub">Việc bạn thực hiện, theo dõi hoặc cần xác nhận. Hồ sơ xong thì công việc tự cập nhật.</div></div><button class="btn secondary" id="tk-refresh">↻ Làm mới</button>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      ${can('hop_giao_viec') ? html`<link rel="stylesheet" href="assets/cong_viec.css?v=107.2">${taskNav('mine')}` : ''}
      <div class="stack" style="max-width:760px;gap:14px">
        ${list.length ? '' : html`<div class="card">Chưa có việc nào được giao cho bạn.</div>`}
        ${groups.filter(([, items]) => items.length).map(([name, items, hint]) => html`<h2 class="tk-group">${name} (${items.length})</h2>
          ${hint ? html`<div class="st-meta" style="margin-top:-8px">${hint}</div>` : ''}${items.map(card)}`)}
      </div>`,
    mount() {
      document.getElementById('tk-refresh').onclick = () => rerender();
      $$('.tk-start').forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_viec_start', { p_task: Number(b.dataset.id) }); flash('Đã nhận việc.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.tk-submit').forEach((b) => b.addEventListener('click', async () => {
        const rep = b.closest('.tk').querySelector('.tk-rep').value;
        if (!confirm('Báo việc này đã xử lý xong?')) return;
        try { await rpc('app_viec_submit', { p_task: Number(b.dataset.id), p_report: rep }); flash('Đã báo xử lý xong.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}

export const STYLE = html`<style>
  .pill.info { background: var(--info-bg); color: var(--info-ink); }
  .tk-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; font-weight: 600; }
  .tk-content { font-size: 15px; font-weight: 600; white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; }
  .tk-late { border-left: 4px solid #dc2626; }
  .due-late { color: #b91c1c; font-weight: 700; }
  .due-today { color: #b45309; font-weight: 700; }
  h2.tk-group { margin: 6px 0 0; font-size: 16px; }
  .tk-report { font-size: 14px; background: var(--subtle); border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .tk-hist summary { cursor: pointer; font-size: 12px; color: var(--muted); }
  .tk-ev { font-size: 13px; padding: 3px 0; }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
  .vp { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; white-space: nowrap; }
  .vp i { width: 10px; height: 10px; border-radius: 3px; background: currentColor; }
  .vp-gap { color: #dc2626; } .vp-tb { color: #8a6d55; } .vp-thap { color: #6b8f4e; }
  .vk { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
  .vk-vh { background: #e6ecdc; color: #2f3d31; } .vk-ql { background: #f6ead9; color: #7a431a; }
</style>`;
