// Chốt ca: chọn ngày → mỗi cơ sở 3 phiếu (Sáng, Chiều, Tối)
import { isManager } from '../app.js';
import { WEEKDAYS, addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, signed } from '../tien.js';
import { $$, go, html, showSaved } from '../ui.js';

export const perm = 'chot_ca';

export const STAFF_LABEL = { dang_chot: ['Đang chốt', 'warn'], hoan_thanh: ['Hoàn thành', 'ok'] };

export function dayName(iso) {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return WEEKDAYS[(d + 6) % 7];
}

export function datePicker(path, day, extra = '') {
  const today = vnToday();
  return html`<section class="card toolbar ca-date" style="padding:12px 14px;gap:8px">
    <a class="btn sm secondary" href="#${path}?ngay=${addDays(day, -1)}${extra}" aria-label="Ngày trước">‹</a>
    <div style="flex:1;text-align:center;min-width:140px"><div style="font-weight:700">${dayName(day)} ${dmy(day)}</div>
      ${day === today ? html`<div style="font-size:12px;color:var(--primary)">Hôm nay</div>` : html`<a href="#${path}?ngay=${today}${extra}" style="font-size:12px">Về hôm nay</a>`}</div>
    <a class="btn sm secondary" href="#${path}?ngay=${addDays(day, 1)}${extra}" aria-label="Ngày sau">›</a>
    <input class="input sm ca-date-input" type="date" value="${day}" aria-label="Chọn ngày" style="width:150px" data-path="${path}" data-extra="${extra}">
  </section>`;
}
export function bindDatePicker() {
  $$('.ca-date-input').forEach((i) => i.addEventListener('change', () => { if (i.value) go(`${i.dataset.path}?ngay=${i.value}${i.dataset.extra}`); }));
}

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const rows = await rpc('app_ca_overview', { p_date: day });
  const branches = [];
  for (const r of rows) {
    let b = branches.find((x) => x.id === r.branch_id);
    if (!b) { b = { id: r.branch_id, code: r.branch_code, name: r.branch_name, shifts: [] }; branches.push(b); }
    b.shifts.push(r);
  }
  const card = (s) => {
    const st = s.report_id ? STAFF_LABEL[s.status] : ['Chưa mở phiếu', 'mute'];
    const left = s.status === 'hoan_thanh' && s.cash_left !== null && s.cash_left !== undefined ? html`<div class="ca-diff">TM ${signed(s.cash_left)} · CK ${signed(s.transfer_left)}</div>` : '';
    return html`<button type="button" class="ca-shift" data-b="${s.branch_id}" data-s="${s.shift}" data-id="${s.report_id || ''}">
      <div class="ca-shift-top"><strong>Ca ${s.shift}</strong>${s.start_time ? html`<span class="ca-time">${s.start_time}–${s.end_time}</span>` : ''}</div>
      <div><span class="pill ${st[1]}">${st[0]}</span>
        ${s.status === 'hoan_thanh' ? html` <span class="pill ${s.recon_status === 'hoan_thanh' ? 'ok' : s.recon_status === 'mo_lai' ? 'warn' : 'off'}">${s.recon_status === 'hoan_thanh' ? 'Đã đối soát' : s.recon_status === 'mo_lai' ? 'Đang đối soát lại' : 'Chưa đối soát'}</span>` : ''}</div>
      ${s.completed_by ? html`<div class="ca-who">Chốt: ${s.completed_by}</div>` : s.created_by ? html`<div class="ca-who">Mở: ${s.created_by}</div>` : ''}
      ${left}</button>`;
  };
  const body = html`${STYLE}
    ${datePicker('/ca', day)}
    ${branches.length ? '' : html`<div class="card">Chưa có cơ sở nào bật ca làm việc.</div>`}
    ${branches.map((b) => html`<section class="card stack" style="gap:10px;padding:14px">
      <div style="font-weight:700">${b.code} – ${b.name}</div>
      <div class="ca-grid">${b.shifts.map(card)}</div></section>`)}
    <div style="font-size:12px;color:var(--muted);text-align:center">Bấm vào ca để mở phiếu chốt ca. TM/CK: tiền mặt / chuyển khoản còn chưa giải trình (âm = thiếu).</div>`;
  return {
    title: 'Chốt ca',
    html: isManager() ? html`<div class="page-head"><div><h1>Chốt ca</h1><div class="sub">Mỗi cơ sở 3 phiếu mỗi ngày: nhân viên chốt ca, quản lý đối soát.</div></div></div><div class="stack" style="max-width:820px;gap:12px">${body}</div>` : html`<div class="stack" style="gap:12px">${body}</div>`,
    mount() {
      bindDatePicker();
      $$('.ca-shift').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.id) return go(`/ca/phieu?id=${b.dataset.id}`);
        if (!confirm(`Mở phiếu chốt ca ${b.dataset.s} ngày ${dmy(day)}?`)) return;
        b.disabled = true;
        try { const id = await rpc('app_ca_open', { p_branch: Number(b.dataset.b), p_date: day, p_shift: b.dataset.s }); go(`/ca/phieu?id=${id}`); }
        catch (e) { b.disabled = false; showSaved(e.message, true); }
      }));
    },
  };
}

export const STYLE = html`<style>
  .ca-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  @media (max-width: 560px) { .ca-grid { grid-template-columns: minmax(0, 1fr); } }
  .ca-shift { text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; font: inherit; color: var(--ink); }
  .ca-shift:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  .ca-shift-top { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
  .ca-time, .ca-who { font-size: 12px; color: var(--muted); }
  .ca-diff { font-size: 12px; font-weight: 600; color: var(--ink-2); }
  .ca-date { display: grid !important; grid-template-columns: 48px minmax(0, 1fr) 48px auto; align-items: center; }
  .ca-date .btn { min-width: 44px; padding: 0; }
  @media (max-width: 560px) { .ca-date { grid-template-columns: 48px minmax(0, 1fr) 48px; } .ca-date .ca-date-input { grid-column: 1 / -1; width: 100% !important; } }
</style>`;
