// Việc của tôi: việc được giao cho mình — Chờ nhận → Đang xử lý → Đã xử lý (+ phần hiển thị việc dùng chung)
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $$, flash, html, showSaved } from '../ui.js';

export const perm = 'nhan_viec';

export const STATUS = {
  chua_phan_cong: ['Chưa giao', 'mute'], da_giao: ['Chờ nhận', 'warn'], dang_xu_ly: ['Đang xử lý', 'info'],
  cho_duyet: ['Đã xử lý', 'ok'], hoan_thanh: ['Đã xử lý', 'ok'],
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
const ACTION = { tao: 'Tạo việc', giao: 'Giao việc', bat_dau: 'Nhận việc', bao_cao: 'Báo đã xử lý', duyet: 'Duyệt', lam_lai: 'Yêu cầu làm lại', sua: 'Sửa' };

export function dueText(t) {
  if (!t.due_date) return html`<span class="st-meta">Không đặt hạn</span>`;
  const today = vnToday();
  const open = t.status === 'da_giao' || t.status === 'dang_xu_ly';
  const late = open && t.due_date < today;
  const isToday = open && t.due_date === today;
  return html`<span class="${late ? 'due-late' : isToday ? 'due-today' : ''}">Hạn ${dmy(t.due_date)}${late ? ' · QUÁ HẠN' : isToday ? ' · HÔM NAY' : ''}</span>`;
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
  return html`<div class="tk-report">${t.report ? html`<strong>Kết quả:</strong> ${t.report}<br>` : ''}<span class="st-meta">Xử lý xong ${dt(t.done_at || t.submitted_at)}</span></div>`;
}

function card(t) {
  const st = STATUS[t.status];
  const meta = [sourceText(t), t.created_by_name ? html`Người giao: ${t.created_by_name}` : '', t.link ? html`<a href="#${t.link}">Mở trang liên quan</a>` : ''].filter(Boolean);
  return html`<article class="card stack tk ${t.overdue || t.priority === 'gap' ? 'tk-late' : ''}" style="gap:8px;padding:14px">
    <div class="tk-top"><span><span class="pill ${st[1]}">${st[0]}</span>${t.priority && t.priority !== 'binh_thuong' ? html` <span class="vp ${PRI[t.priority].cls}"><i></i>${PRI[t.priority].label}</span>` : ''}</span>${dueText(t)}</div>
    <div>${catChip(t.category, t.topic)}</div>
    <div class="tk-content">${t.content}</div>
    ${meta.length ? html`<div class="st-meta">${meta.map((m, i) => html`${i ? ' · ' : ''}${m}`)}</div>` : ''}
    ${t.status === 'dang_xu_ly' && t.review_note ? html`<div class="alert warn" style="font-size:13px"><strong>Yêu cầu làm lại:</strong> ${t.review_note}</div>` : ''}
    ${doneText(t)}
    ${t.status === 'da_giao' ? html`<div><button type="button" class="btn tk-start" data-id="${t.id}">Nhận việc</button></div>` : ''}
    ${t.status === 'dang_xu_ly' ? html`<div class="stack" style="gap:6px">
      <textarea class="input tk-rep" rows="2" placeholder="Kết quả xử lý (không bắt buộc)" aria-label="Kết quả xử lý"></textarea>
      <div><button type="button" class="btn tk-submit" data-id="${t.id}" style="background:var(--ok-line)">Đã xử lý</button></div></div>` : ''}
    ${history(t)}</article>`;
}

export async function render() {
  const list = (await rpc('app_viec_mine')).sort((a, b) => (PRI_RANK[a.priority] ?? 1) - (PRI_RANK[b.priority] ?? 1) || (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const by = (s) => list.filter((t) => t.status === s);
  const groups = [
    ['Chờ nhận', by('da_giao'), 'Bấm “Nhận việc” để báo cho người giao là bạn đã nhận.'],
    ['Đang xử lý', by('dang_xu_ly'), 'Làm xong bấm “Đã xử lý”.'],
    ['Đã xử lý (30 ngày gần đây)', list.filter((t) => t.status === 'hoan_thanh' || t.status === 'cho_duyet'), ''],
  ];
  return {
    title: 'Việc của tôi',
    html: html`${STYLE}<div class="page-head"><div><h1>Việc của tôi</h1><div class="sub">Việc được giao cho bạn: Chờ nhận → Đang xử lý → Đã xử lý.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:760px;gap:14px">
        ${list.length ? '' : html`<div class="card">Chưa có việc nào được giao cho bạn.</div>`}
        ${groups.filter(([, items]) => items.length).map(([name, items, hint]) => html`<h2 class="tk-group">${name} (${items.length})</h2>
          ${hint ? html`<div class="st-meta" style="margin-top:-8px">${hint}</div>` : ''}${items.map(card)}`)}
      </div>`,
    mount() {
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
  .tk-content { font-size: 15px; font-weight: 600; white-space: pre-wrap; }
  .tk-late { border-left: 4px solid #dc2626; }
  .due-late { color: #b91c1c; font-weight: 700; }
  .due-today { color: #b45309; font-weight: 700; }
  h2.tk-group { margin: 6px 0 0; font-size: 16px; }
  .tk-report { font-size: 14px; background: var(--subtle); border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; }
  .tk-hist summary { cursor: pointer; font-size: 12px; color: var(--muted); }
  .tk-ev { font-size: 13px; padding: 3px 0; }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
  .vp { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; white-space: nowrap; }
  .vp i { width: 10px; height: 10px; border-radius: 3px; background: currentColor; }
  .vp-gap { color: #dc2626; } .vp-tb { color: #8a6d55; } .vp-thap { color: #6b8f4e; }
  .vk { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
  .vk-vh { background: #e6ecdc; color: #2f3d31; } .vk-ql { background: #f6ead9; color: #7a431a; }
</style>`;
