// Công của tôi (bước 39): các ca đã làm trong tháng theo phiếu chốt ca, các lần nghỉ / làm thay Chủ đã duyệt (bị trừ giờ / được x2), gửi khiếu nại
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, flash, go, html, showSaved } from '../ui.js';

const h2 = (n) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : '';
  const D = await rpc('app_cong_mine', { p_month: month || null });
  const worked = D.shifts.filter((x) => x.worked);
  const hours = worked.reduce((t, x) => t + Number(x.hours || 0), 0);
  const plus = D.covers.filter((c) => !c.me_absent && c.x2).reduce((t, c) => t + Number(c.hours || 0), 0);
  const minus = D.covers.filter((c) => c.me_absent).reduce((t, c) => t + Number(c.deduct_hours || 0), 0);
  const fine = D.covers.filter((c) => c.me_absent).reduce((t, c) => t + Number(c.fine || 0), 0);   // bước 47: bỏ ca bị phạt
  const ml = `${D.month.slice(5)}/${D.month.slice(0, 4)}`;
  const myKN = (c) => (c.me_absent ? c.complaint_absent : c.complaint_helper);
  return {
    title: 'Công của tôi',
    html: html`<style>.cg-k { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; } .cg-k .card { padding: 10px 12px; } .cg-k strong { font-size: 20px; }
        .cg-c { border: 1px solid var(--line-soft); border-left: 4px solid #6366f1; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
        .cg-c.minus { border-left-color: #dc2626; } .cg-s { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; padding: 6px 0; border-top: 1px solid var(--line-soft); }</style>
      <div class="page-head"><div><h1>Công của tôi</h1><div class="sub">Các ca bạn làm theo phiếu chốt ca. Nghỉ mà nhờ quản lý tìm người thay thì bị trừ đúng số giờ người thay làm; làm thay có thể được x2 (Chủ quyết). Không đồng ý thì gửi khiếu nại.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:680px;gap:12px">
        <label class="field" style="max-width:220px"><span>Tháng</span><input class="input" type="month" id="cg-m" value="${D.month}"></label>
        <div class="cg-k"><div class="card"><div class="st-meta">Số ca tháng ${ml}</div><strong>${worked.length}</strong></div>
          <div class="card"><div class="st-meta">Giờ thực tế</div><strong>${h2(hours)}</strong></div>
          <div class="card"><div class="st-meta">Giờ x2 được cộng</div><strong style="color:#15803d">${plus ? '+' + h2(plus) : '0'}</strong></div>
          <div class="card"><div class="st-meta">Giờ bị trừ</div><strong style="color:#b91c1c">${minus ? '−' + h2(minus) : '0'}</strong></div>
          ${fine ? html`<div class="card"><div class="st-meta">Tiền phạt</div><strong style="color:#b91c1c">${fine.toLocaleString('vi-VN')}đ</strong></div>` : ''}</div>
        ${D.covers.length ? html`<strong>Nghỉ & làm thay (Chủ đã duyệt)</strong>${D.covers.map((c) => html`<div class="cg-c ${c.me_absent ? 'minus' : ''}" data-id="${c.id}">
            <div><strong>${dmy(c.date)} · ca ${c.shift} ${c.branch}</strong></div>
            <div>${c.me_absent ? html`Bạn nghỉ · ${c.reason_label}${c.helper ? ` · người làm thay: ${c.helper}` : ''}` : html`Bạn ${c.absent ? `làm thay ${c.absent}` : 'làm thêm (quản lý không xếp đủ lịch)'} · ${h2(c.hours)} giờ`}</div>
            <div>${c.me_absent ? (Number(c.fine) ? html`<strong style="color:#b91c1c">Bỏ ca — bị phạt ${Number(c.fine).toLocaleString('vi-VN')}đ</strong>` : Number(c.deduct_hours) ? html`<strong style="color:#b91c1c">Bị trừ ${h2(c.deduct_hours)} giờ</strong>` : 'Không bị trừ') : c.x2 ? html`<strong style="color:#15803d">Được x2 lương (+${h2(c.hours)} giờ)</strong>` : 'Lương thường'}</div>
            ${myKN(c) ? html`<div class="st-meta">Bạn đã khiếu nại: ${myKN(c)}</div>` : ''}
            ${c.resolved_at ? html`<div class="st-meta">Đã được xem ${dt(c.resolved_at)}${c.resolve_note ? ' · ' + c.resolve_note : ''}</div>` : ''}
            <details><summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary)">${myKN(c) ? 'Sửa khiếu nại' : 'Không đồng ý? Gửi khiếu nại'}</summary>
              <div class="stack" style="gap:6px;margin-top:6px"><textarea class="input cg-t" rows="2" placeholder="Giải thích cho quản lý tổng / Chủ">${myKN(c) || ''}</textarea>
              <div><button type="button" class="btn sm secondary cg-send">Gửi khiếu nại</button></div></div></details></div>`)}` : ''}
        <strong>Các ca trong tháng (${D.shifts.length})</strong>
        <div class="card" style="padding:4px 14px">${D.shifts.length ? D.shifts.map((x) => html`<div class="cg-s"><span>${dmy(x.date)} · ca ${x.shift} ${x.branch}${x.source === 'ho_tro' ? ' · hỗ trợ' : ''}</span>
            <span>${x.worked ? html`${x.time_in ? `${String(x.time_in).slice(0, 5)}–${String(x.time_out || '').slice(0, 5)} · ` : ''}<strong>${h2(x.hours)} giờ</strong>` : html`<span style="color:#b91c1c">Nghỉ</span>`}
              ${x.official ? '' : html` <span class="pill warn">chờ xác nhận</span>`}</span></div>`) : html`<div class="st-meta" style="padding:8px 0">Chưa có ca nào trong tháng này.</div>`}</div>
      </div>`,
    mount() {
      $('#cg-m').addEventListener('change', (ev) => { if (ev.target.value) go('/cua-toi/cong?thang=' + ev.target.value); });
      $$('.cg-send').forEach((b) => b.addEventListener('click', async () => {
        const c = b.closest('.cg-c');
        try { await rpc('app_cv_complain', { p_cover: Number(c.dataset.id), p_text: c.querySelector('.cg-t').value }); flash('Đã gửi khiếu nại cho quản lý tổng / Chủ.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}
