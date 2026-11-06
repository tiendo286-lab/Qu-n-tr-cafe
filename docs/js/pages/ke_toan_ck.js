// Kế toán · Chuyển khoản thực nhận: nhập số dư BIDV đầu/cuối ca + tiền chuyển ra theo từng phiếu ca
// Tiền nhận trong ca = Số dư cuối − Số dư đầu + Tiền chuyển ra. Khóa khi quản lý HOÀN THÀNH ĐỐI SOÁT.
import { addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, signed, vnd } from '../tien.js';
import { $, $$, hhmm, html, showSaved } from '../ui.js';
import { dayName } from './chot_ca.js';

export const perm = 'ke_toan';

const money = (cls, v, dis, extra = '') => html`<input class="input sm money ${cls}" inputmode="numeric" autocomplete="off" placeholder="0" value="${v === null || v === undefined ? '' : fmt(v)}" ${dis ? 'disabled' : ''} ${extra}>`;

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const rows = await rpc('app_kt_bank_day', { p_date: day });
  const byBranch = [];
  rows.forEach((r) => { let b = byBranch.find((x) => x.id === r.branch_id); if (!b) byBranch.push(b = { id: r.branch_id, code: r.branch_code, name: r.branch_name, shifts: [] }); b.shifts.push(r); });

  const shiftCard = (s) => {
    const r = s.row;
    if (!r) return html`<div class="ck-row ck-none"><strong>Ca ${s.shift}</strong> <span class="st-meta">Chưa có phiếu chốt ca — chưa nhập được (khoảng thời gian lấy từ phiếu).</span></div>`;
    const lock = r.locked;
    const prevC = r.prev ? r.prev.closing : null;
    const sgOpen = r.opening === null && prevC !== null; // gợi ý số dư đầu = cuối ca trước
    const mismatch = r.opening !== null && prevC !== null && Number(r.opening) !== Number(prevC);
    return html`<div class="ck-row" data-report="${r.report_id}" data-prev="${prevC ?? ''}" data-pt="${r.pos_transfer ?? ''}" data-rt="${r.reported_transfer ?? ''}">
      <div class="ck-head"><strong>Ca ${s.shift}</strong>
        <span class="st-meta">${r.rev_start ? dt(r.rev_start) : '?'} → ${r.rev_end ? dt(r.rev_end) : '?'}</span>
        ${lock ? html`<span class="pill ok">Đã đối soát — khóa</span>` : r.recon_status === 'mo_lai' ? html`<span class="pill warn">Đang đối soát lại</span>` : r.status !== 'hoan_thanh' ? html`<span class="pill mute">Nhân viên đang chốt</span>` : ''}
        <a class="st-meta" href="#/ca/phieu?id=${r.report_id}" style="margin-left:auto">Mở phiếu ca</a></div>
      <div class="ck-grid">
        <label class="pc-f"><span>Số dư đầu ca</span>${money('ck-open' + (sgOpen ? ' st-sg' : ''), sgOpen ? prevC : r.opening, lock, sgOpen ? 'title="Gợi ý = số dư cuối ca trước"' : '')}
          ${r.prev ? html`<span class="st-meta">Cuối ca trước (${r.prev.shift} ${dmy(r.prev.work_date)}): ${vnd(prevC)}</span>` : html`<span class="st-meta">Chưa có ca trước — nhập số dư ban đầu.</span>`}
          ${mismatch ? html`<span class="pill warn" style="align-self:flex-start">Khác số dư cuối ca trước ${signed(Number(r.opening) - Number(prevC))}</span>` : ''}</label>
        <label class="pc-f"><span>Số dư cuối ca</span>${money('ck-close', r.closing, lock)}</label>
        <label class="pc-f"><span>Tiền chuyển ra trong ca</span>${money('ck-out', r.transfers_out ?? 0, lock)}<span class="st-meta">Không có thì để 0.</span></label>
        <label class="pc-f"><span>Ghi chú</span><input class="input sm ck-note" value="${r.note || ''}" ${lock ? 'disabled' : ''} placeholder="Không bắt buộc"></label>
      </div>
      <div class="ck-res"></div>
      ${lock ? '' : html`<div class="toolbar"><button type="button" class="btn sm ck-save">Lưu ca ${s.shift}</button>${r.updated_at ? html`<span class="st-meta">Sửa lần cuối: ${r.updated_by || ''} · ${dt(r.updated_at)}</span>` : ''}</div>`}
    </div>`;
  };

  return {
    title: 'Chuyển khoản thực nhận',
    html: html`<style>
        .ck-row { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .ck-none { background: var(--line-soft); }
        .ck-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .ck-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
        .ck-res { font-size: 14px; }
        .st-sg { background: #fef9c3; }
        .pc-f { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
      </style>
      <div class="page-head"><div><h1>Chuyển khoản thực nhận</h1><div class="sub">Nhập số dư tài khoản BIDV của từng cơ sở theo đúng mốc giờ của phiếu ca. Tiền nhận trong ca = Số dư cuối − Số dư đầu + Tiền chuyển ra. Đây là tiền nhận trong ca, chưa mặc định là doanh thu.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card toolbar" style="padding:12px 14px;gap:8px">
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${addDays(day, -1)}">‹ Hôm trước</a>
          <input class="input sm" type="date" id="ck-day" value="${day}" aria-label="Ngày">
          <a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${addDays(day, 1)}">Hôm sau ›</a>
          <strong>${dayName(day)} ${dmy(day)}</strong></section>
        <div class="alert warn" style="font-size:13px">Đang chờ chủ hệ thống chốt: cách xử lý khi sửa số dư một ca cũ (ảnh hưởng các ca sau) và khi tiền về chậm. Web chỉ <strong>cảnh báo</strong> khi số dư đầu khác số dư cuối ca trước, không tự sửa ca nào.</div>
        ${byBranch.map((b) => html`<section class="card stack" style="gap:10px"><h2 style="margin:0">${b.code} – ${b.name}</h2>${b.shifts.map(shiftCard)}</section>`)}
      </div>`,
    mount() {
      $('#ck-day').addEventListener('change', (e) => { location.hash = '#/ke-toan/chuyen-khoan?ngay=' + e.target.value; });
      $$('.ck-row[data-report]').forEach((row) => {
        bindMoneyInputs(row);
        const calc = () => {
          const o = parseMoney(row.querySelector('.ck-open').value); const c = parseMoney(row.querySelector('.ck-close').value); const out = parseMoney(row.querySelector('.ck-out').value) || 0;
          const got = o === null || c === null ? null : c - o + out;
          const pt = row.dataset.pt === '' ? null : Number(row.dataset.pt); const rt = row.dataset.rt === '' ? null : Number(row.dataset.rt);
          row.querySelector('.ck-res').innerHTML = got === null ? '<span class="st-meta">Nhập số dư đầu và cuối để tính tiền nhận trong ca.</span>'
            : `<strong>Tiền nhận trong ca: ${fmt(got)}đ</strong>`
              + (pt !== null ? ` · <span class="st-meta">so với CK theo POS (${fmt(pt)}đ): ${signed(got - pt)}</span>` : '')
              + (rt !== null ? ` · <span class="st-meta">so với CK nhân viên cộng hotline (${fmt(rt)}đ): ${signed(got - rt)}</span>` : '');
        };
        row.addEventListener('input', (e) => { e.target.classList.remove('st-sg'); calc(); });
        calc();
        row.querySelector('.ck-save')?.addEventListener('click', async (ev) => {
          const v = (s) => parseMoney(row.querySelector(s).value);
          ev.target.disabled = true;
          try {
            await rpc('app_kt_bank_save', { p_report: Number(row.dataset.report), p_opening: v('.ck-open'), p_closing: v('.ck-close'), p_out: v('.ck-out') || 0, p_note: row.querySelector('.ck-note').value });
            showSaved('Đã lưu · ' + hhmm());
          } catch (e) { showSaved(e.message, true); }
          ev.target.disabled = false;
        });
      });
    },
  };
}
