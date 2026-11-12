// Bảng công tháng (bước 39): số ca / giờ thực tế từ phiếu chốt ca, giờ x2 được cộng, giờ bị trừ (nghỉ nhờ quản lý tìm người), lương tiền mặt đã trả.
// Dùng để đối chiếu khi chốt lương trên HRM. Kèm danh sách nghỉ & làm thay trong tháng + xử lý khiếu nại.
import { render as rerender } from './app.js';
import { downloadXlsx } from './excel.js';
import { rpc } from './sb.js';
import { dmy, dt, fmt } from './tien.js';
import { $, $$, dialog, flash, go, html, str } from './ui.js';

const h2 = (n) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export async function renderBangCong(params, nav) {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : today;
  const D = await rpc('app_bang_cong', { p_month: month });
  const app = D.rows.filter((r) => !r.pay_cash); const cash = D.rows.filter((r) => r.pay_cash);
  const outs = D.covers.filter((c) => c.outsider);
  const ml = `${month.slice(5)}/${month.slice(0, 4)}`;
  const note = (r) => {
    const cs = D.covers.filter((c) => c.approved && (c.absent_id === r.employee_id || c.helper_id === r.employee_id));
    return cs.map((c) => (c.absent_id === r.employee_id ? `${dmy(c.date)} nghỉ (${c.reason_label})${Number(c.deduct_hours) > 0 ? ` −${h2(c.deduct_hours)}g` : ''}${Number(c.fine) > 0 ? ` phạt ${fmt(c.fine)}đ` : ''}` : `${dmy(c.date)} làm thay${c.x2 ? ` x2 +${h2(c.hours)}g` : ''}`)).join('; ');
  };
  const table = (rows, isCash) => html`<table class="table rt"><thead><tr><th>Nhân viên</th><th class="r">Ca</th><th class="r">Giờ thực tế</th><th class="r">Giờ x2 được cộng</th><th class="r">Giờ bị trừ</th><th class="r">Phạt</th>
      ${isCash ? html`<th class="r">Lương tiền mặt đã trả</th>` : ''}<th>Ghi chú</th></tr></thead>
    <tbody>${rows.length ? rows.map((r) => html`<tr><td data-label="Nhân viên"><strong>${r.code} – ${r.name}</strong>${r.status !== 'Đang làm' ? html` <span class="pill mute">${r.status}</span>` : ''}</td>
      <td class="r" data-label="Ca">${r.shifts}${r.pending ? html` <span class="st-meta">(${r.pending} chờ xác nhận)</span>` : ''}${r.absent ? html` <span class="st-meta">· nghỉ ${r.absent}</span>` : ''}</td>
      <td class="r" data-label="Giờ thực tế">${h2(r.hours)}</td>
      <td class="r" data-label="Giờ x2 được cộng">${Number(r.x2_hours) ? html`<strong style="color:#15803d">+${h2(r.x2_hours)}</strong>` : '—'}</td>
      <td class="r" data-label="Giờ bị trừ">${Number(r.deduct_hours) ? html`<strong style="color:#b91c1c">−${h2(r.deduct_hours)}</strong>` : '—'}</td>
      <td class="r" data-label="Phạt">${Number(r.fine) ? html`<strong style="color:#b91c1c">${fmt(r.fine)}đ</strong>` : '—'}</td>
      ${isCash ? html`<td class="r" data-label="Lương tiền mặt">${Number(r.cash_paid) ? fmt(r.cash_paid) + 'đ' : '—'}</td>` : ''}
      <td data-label="Ghi chú" style="font-size:13px">${note(r) || '—'}</td></tr>`) : html`<tr><td colspan="8">Không có dữ liệu.</td></tr>`}</tbody></table>`;
  const coverRow = (c) => html`<tr data-id="${c.id}"><td data-label="Ngày">${dmy(c.date)} · ${c.shift} ${c.branch}</td>
      <td data-label="Người nghỉ">${c.absent || '—'}</td><td data-label="Lý do">${c.reason_label}</td>
      <td data-label="Người làm thay">${c.helper || '—'}${c.outsider ? ' (ngoài quán)' : ''}${c.helper ? ` · ${h2(c.hours)}g` : ''}</td>
      <td data-label="Đãi ngộ">${c.helper ? (c.x2 ? html`<strong>x2</strong>` : 'thường') : '—'}${Number(c.deduct_hours) ? html` · <span style="color:#b91c1c">trừ ${h2(c.deduct_hours)}g</span>` : ''}${Number(c.fine) ? html` · <span style="color:#b91c1c">phạt ${fmt(c.fine)}đ</span>` : ''}</td>
      <td data-label="Trạng thái">${c.approved ? html`<span class="pill ok">Chủ đã duyệt</span>` : html`<span class="pill warn">Chờ duyệt</span>`}
        ${c.complaint_absent ? html`<div class="st-meta">KN người nghỉ: ${c.complaint_absent}</div>` : ''}${c.complaint_helper ? html`<div class="st-meta">KN người làm thay: ${c.complaint_helper}</div>` : ''}
        ${c.resolved_at ? html`<div class="st-meta">Đã xem ${dt(c.resolved_at)}${c.resolve_note ? ' · ' + c.resolve_note : ''}</div>` : ''}
        ${D.can_resolve && c.approved && c.open ? html`<button type="button" class="btn sm ${(c.complaint_absent || c.complaint_helper) && !c.resolved_at ? '' : 'secondary'} bc-fix">${(c.complaint_absent || c.complaint_helper) && !c.resolved_at ? 'Xem khiếu nại' : 'Sửa'}</button>` : ''}</td></tr>`;
  const pendingKN = D.covers.filter((c) => (c.complaint_absent || c.complaint_helper) && !c.resolved_at).length;
  return {
    title: 'Bảng công tháng',
    html: html`<div class="page-head"><div><h1>Chốt lịch &amp; báo cáo</h1></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>${nav}
      <section class="card stack" style="gap:10px">
        <div class="toolbar" style="justify-content:space-between;gap:8px"><div><h2 style="margin:0">Bảng công tháng ${ml}</h2>
          <div class="st-meta">Lấy từ phiếu chốt ca đã hoàn thành. "Chờ xác nhận" = quản lý chưa đối soát bước Nhân sự. Giờ x2 / giờ bị trừ chỉ tính dòng Chủ đã duyệt. Dùng để đối chiếu khi chốt lương trên HRM.</div></div>
          <div class="toolbar" style="gap:6px"><input class="input sm" type="month" id="bc-m" value="${month}" aria-label="Tháng"><button type="button" class="btn sm secondary" id="bc-xls">Tải Excel</button></div></div>
        ${pendingKN ? html`<div class="alert warn">Có ${pendingKN} khiếu nại nghỉ / làm thay chưa xem — xem ở bảng "Nghỉ & làm thay" bên dưới.</div>` : ''}
      </section>
      <section class="card flush"><div class="card-head"><h2>Nhân viên dùng HRM (${app.length})</h2></div><div class="table-wrap">${table(app, false)}</div></section>
      <section class="card flush"><div class="card-head"><h2>Trả lương tiền mặt (${cash.length})</h2></div><div class="table-wrap">${table(cash, true)}</div></section>
      <section class="card flush"><div class="card-head"><h2>Nghỉ & làm thay trong tháng (${D.covers.length})</h2></div><div class="table-wrap">
        <table class="table rt"><thead><tr><th>Ca</th><th>Người nghỉ</th><th>Lý do</th><th>Người làm thay</th><th>Đãi ngộ</th><th>Trạng thái</th></tr></thead>
        <tbody>${D.covers.length ? D.covers.map(coverRow) : html`<tr><td colspan="6">Không có.</td></tr>`}</tbody></table></div></section>
      ${outs.length ? html`<section class="card"><h2 style="margin-top:0">Người ngoài quán làm thay (ghi chú báo cáo lương)</h2>
        ${outs.map((c) => html`<div style="font-size:14px">${dmy(c.date)} · ca ${c.shift} ${c.branch}: <strong>${c.helper}</strong> làm thay ${c.absent || ''} · ${h2(c.hours)} giờ${c.x2 ? ' · x2' : ''}</div>`)}</section>` : ''}`,
    mount() {
      $('#bc-m').addEventListener('change', (ev) => { if (ev.target.value) go('/quan-ly/bao-cao?tab=bang-cong&thang=' + ev.target.value); });
      $('#bc-xls').addEventListener('click', () => downloadXlsx(`Bang_cong_${month}.xlsx`, [
        { name: 'BANG_CONG', rows: [['MÃ NV', 'TÊN', 'NHÓM', 'SỐ CA', 'GIỜ THỰC TẾ', 'CA CHỜ XÁC NHẬN', 'SỐ CA NGHỈ', 'GIỜ X2 ĐƯỢC CỘNG', 'GIỜ BỊ TRỪ', 'PHẠT', 'LƯƠNG TIỀN MẶT ĐÃ TRẢ', 'GHI CHÚ'],
          ...D.rows.map((r) => [r.code, r.name, r.pay_cash ? 'Tiền mặt' : 'HRM', r.shifts, Number(r.hours), r.pending, r.absent, Number(r.x2_hours), Number(r.deduct_hours), Number(r.fine || 0), Number(r.cash_paid), note(r)])] },
        { name: 'NGHI_LAM_THAY', rows: [['NGÀY', 'CA', 'CƠ SỞ', 'NGƯỜI NGHỈ', 'LÝ DO', 'NGƯỜI LÀM THAY', 'NGOÀI QUÁN', 'GIỜ', 'X2', 'GIỜ TRỪ', 'PHẠT', 'CHỦ DUYỆT'],
          ...D.covers.map((c) => [c.date, c.shift, c.branch, c.absent || '', c.reason_label, c.helper || '', c.outsider ? 'Có' : '', Number(c.hours), c.x2 ? 'x2' : '', Number(c.deduct_hours), Number(c.fine || 0), c.approved ? 'Đã duyệt' : 'Chờ'])] },
      ]));
      $$('.bc-fix').forEach((b) => b.addEventListener('click', () => {
        const c = D.covers.find((x) => String(x.id) === b.closest('tr').dataset.id); if (!c) return;
        const d = dialog(html`<form class="stack" style="gap:10px"><h2 style="margin:0">Nghỉ / làm thay ${dmy(c.date)} · ${c.shift} ${c.branch}</h2>
          <div>${c.absent ? html`<strong>${c.absent}</strong> nghỉ · ${c.reason_label}` : c.reason_label}${c.helper ? html` · làm thay: <strong>${c.helper}</strong> (${h2(c.hours)} giờ)` : ''}</div>
          ${c.complaint_absent ? html`<div class="alert warn">Người nghỉ khiếu nại: ${c.complaint_absent}</div>` : ''}
          ${c.complaint_helper ? html`<div class="alert warn">Người làm thay khiếu nại: ${c.complaint_helper}</div>` : ''}
          ${c.helper ? html`<label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" class="check" name="x2" ${c.x2 ? 'checked' : ''}> Người làm thay được x2</label>` : ''}
          ${c.absent ? html`<label class="field"><span>Giờ người nghỉ bị trừ</span><input class="input" type="number" name="ded" min="0" max="24" step="0.25" value="${c.deduct_hours}"></label>` : ''}
          <label class="field"><span>Trả lời (gửi cho cả 2 người)</span><input class="input" name="note" placeholder="vd: Giữ nguyên / đã sửa theo khiếu nại" autocomplete="off"></label>
          <div id="bc-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu & báo</button></div></form>`);
        d.querySelector('[data-x]').addEventListener('click', () => { d.close(); d.remove(); });
        d.querySelector('form').addEventListener('submit', async (ev) => {
          ev.preventDefault(); const f = ev.target;
          try {
            await rpc('app_cv_resolve', { p_cover: c.id, p_x2: f.x2 ? f.x2.checked : null, p_deduct: f.ded ? Number(f.ded.value) : null, p_note: f.note.value });
            d.close(); d.remove(); flash('Đã lưu và báo cho người nghỉ / người làm thay.'); rerender();
          } catch (e) { d.querySelector('#bc-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
        });
      }));
    },
  };
}
