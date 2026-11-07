// Kế toán · Chuyển khoản thực nhận
//  * Tài khoản nhận tiền: mỗi chi nhánh có thể nhiều tài khoản ngân hàng (thêm / sửa / ngừng dùng / xóa khi chưa có số dư).
//  * Theo từng phiếu ca: nhập số dư đầu / cuối / tiền chuyển ra cho TỪNG tài khoản của chi nhánh.
//    Tiền nhận trong ca = tổng các tài khoản (Số dư cuối − Số dư đầu + Tiền chuyển ra). Khóa khi quản lý HOÀN THÀNH ĐỐI SOÁT.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, signed, vnd } from '../tien.js';
import { $, $$, dialog, flash, hhmm, html, showSaved } from '../ui.js';
import { dayName } from './chot_ca.js';

export const perm = 'ke_toan';

const money = (cls, v, dis, extra = '') => html`<input class="input sm money ${cls}" inputmode="numeric" autocomplete="off" placeholder="0" value="${v === null || v === undefined ? '' : fmt(v)}" ${dis ? 'disabled' : ''} ${extra}>`;
export const accName = (a) => `${a.bank} ${a.account_no}${a.label ? ' · ' + a.label : ''}`;

function accountForm(branches, a = {}) {
  return html`<form class="ck-accf" autocomplete="off">
    <label class="pc-f"><span>Chi nhánh</span><select class="input sm" name="branch" required>
      <option value="">— Chọn —</option>${branches.map((b) => html`<option value="${b.id}" ${a.branch_id === b.id ? 'selected' : ''}>${b.code} – ${b.name}</option>`)}</select></label>
    <label class="pc-f"><span>Ngân hàng</span><input class="input sm" name="bank" value="${a.bank || 'BIDV'}" required list="ck-banks"></label>
    <label class="pc-f"><span>Số tài khoản</span><input class="input sm" name="no" value="${a.account_no || ''}" inputmode="numeric" required placeholder="Chỉ chữ số"></label>
    <label class="pc-f"><span>Chủ tài khoản</span><input class="input sm" name="holder" value="${a.holder || ''}" placeholder="Không bắt buộc"></label>
    <label class="pc-f"><span>Tên gọi / ghi chú</span><input class="input sm" name="label" value="${a.label || ''}" placeholder="vd: TK quét QR quầy"></label>
    <div class="pc-f" style="justify-content:flex-end"><button class="btn sm" type="submit">${a.id ? 'Lưu' : '+ Thêm tài khoản'}</button></div>
  </form>`;
}
const BANKS = html`<datalist id="ck-banks">${['BIDV', 'Vietcombank', 'VietinBank', 'Agribank', 'Techcombank', 'MB', 'ACB', 'VPBank', 'TPBank', 'Sacombank'].map((b) => html`<option value="${b}"></option>`)}</datalist>`;

export async function render({ params }) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday();
  const [rows, accounts] = await Promise.all([rpc('app_kt_bank_day', { p_date: day }), rpc('app_kt_accounts')]);
  const byBranch = [];
  rows.forEach((r) => { let b = byBranch.find((x) => x.id === r.branch_id); if (!b) byBranch.push(b = { id: r.branch_id, code: r.branch_code, name: r.branch_name, shifts: [] }); b.shifts.push(r); });
  const activeOf = (bid) => accounts.filter((a) => a.branch_id === bid && a.active);
  const noAcc = byBranch.filter((b) => !activeOf(b.id).length);

  const accRow = (a, lock) => {
    const prevC = a.prev ? a.prev.closing : null;
    const sgOpen = a.opening === null && prevC !== null; // gợi ý số dư đầu = cuối ca trước của cùng tài khoản
    const mismatch = a.opening !== null && prevC !== null && Number(a.opening) !== Number(prevC);
    return html`<div class="ck-acc" data-acc="${a.account_id}">
      <div class="ck-accn"><strong>${a.bank} ${a.account_no}</strong>${a.label ? html` <span class="st-meta">· ${a.label}</span>` : ''}${a.active ? '' : html` <span class="pill mute">Ngừng dùng</span>`}</div>
      <div class="ck-grid">
        <label class="pc-f"><span>Số dư đầu ca</span>${money('ck-open' + (sgOpen ? ' st-sg' : ''), sgOpen ? prevC : a.opening, lock, sgOpen ? 'title="Gợi ý = số dư cuối ca trước"' : '')}
          ${a.prev ? html`<span class="st-meta">Cuối ca trước (${a.prev.shift} ${dmy(a.prev.work_date)}): ${vnd(prevC)}</span>` : html`<span class="st-meta">Chưa có ca trước — nhập số dư ban đầu.</span>`}
          ${mismatch ? html`<span class="pill warn" style="align-self:flex-start">Khác số dư cuối ca trước ${signed(Number(a.opening) - Number(prevC))}</span>` : ''}</label>
        <label class="pc-f"><span>Số dư cuối ca</span>${money('ck-close', a.closing, lock)}</label>
        <label class="pc-f"><span>Tiền chuyển ra trong ca</span>${money('ck-out', a.transfers_out ?? 0, lock)}<span class="st-meta">Không có thì để 0.</span></label>
        <label class="pc-f"><span>Ghi chú</span><input class="input sm ck-note" value="${a.note || ''}" ${lock ? 'disabled' : ''} placeholder="Không bắt buộc"></label>
      </div>
      <div class="ck-ares st-meta"></div>
    </div>`;
  };

  const shiftCard = (s) => {
    const r = s.row;
    if (!r) return html`<div class="ck-row ck-none"><strong>Ca ${s.shift}</strong> <span class="st-meta">Chưa có phiếu chốt ca — chưa nhập được (khoảng thời gian lấy từ phiếu).</span></div>`;
    const lock = r.locked;
    return html`<div class="ck-row" data-report="${r.report_id}" data-pt="${r.pos_transfer ?? ''}" data-rt="${r.reported_transfer ?? ''}">
      <div class="ck-head"><strong>Ca ${s.shift}</strong>
        <span class="st-meta">${r.rev_start ? dt(r.rev_start) : '?'} → ${r.rev_end ? dt(r.rev_end) : '?'}</span>
        ${lock ? html`<span class="pill ok">Đã đối soát — khóa</span>` : r.recon_status === 'mo_lai' ? html`<span class="pill warn">Đang đối soát lại</span>` : r.status !== 'hoan_thanh' ? html`<span class="pill mute">Nhân viên đang chốt</span>` : ''}
        <a class="st-meta" href="#/ca/phieu?id=${r.report_id}" style="margin-left:auto">Mở phiếu ca</a></div>
      ${r.accounts.length ? r.accounts.map((a) => accRow(a, lock)) : html`<div class="st-meta">Chi nhánh chưa có tài khoản nhận tiền — thêm ở mục <strong>Tài khoản nhận tiền</strong> phía trên.</div>`}
      <div class="ck-res"></div>
      ${lock || !r.accounts.length ? '' : html`<div class="toolbar"><button type="button" class="btn sm ck-save">Lưu ca ${s.shift}</button>${r.updated_at ? html`<span class="st-meta">Sửa lần cuối: ${r.updated_by || ''} · ${dt(r.updated_at)}</span>` : ''}</div>`}
    </div>`;
  };

  const accList = byBranch.map((b) => {
    const list = accounts.filter((a) => a.branch_id === b.id);
    return html`<div class="ck-ab"><div class="ck-abh">${b.code} – ${b.name}</div>
      ${list.length ? list.map((a) => html`<div class="ck-al ${a.active ? '' : 'off'}" data-id="${a.id}">
        <div class="ck-ali"><strong>${a.bank} ${a.account_no}</strong>
          <span class="st-meta">${[a.holder, a.label].filter(Boolean).join(' · ')}</span>
          ${a.active ? html`<span class="pill ok">Đang dùng</span>` : html`<span class="pill mute">Ngừng dùng</span>`}</div>
        <div class="ck-alb">
          <button type="button" class="btn sm secondary ck-edit">Sửa</button>
          <button type="button" class="btn sm secondary ck-toggle">${a.active ? 'Ngừng dùng' : 'Dùng lại'}</button>
          ${a.used ? '' : html`<button type="button" class="btn sm secondary ck-del" style="color:#b91c1c;border-color:#fca5a5">Xóa</button>`}</div></div>`)
        : html`<div class="st-meta">Chưa có tài khoản.</div>`}</div>`;
  });

  return {
    title: 'Chuyển khoản thực nhận',
    html: html`<style>
        .ck-row { border: 1px solid var(--line); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .ck-none { background: var(--line-soft); }
        .ck-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .ck-acc { background: #f6f7fb; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .ck-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
        .ck-res { font-size: 14px; }
        .st-sg { background: #fef9c3; }
        .pc-f { display: flex; flex-direction: column; gap: 4px; font-size: 14px; min-width: 0; }
        .ck-accf { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: end; }
        .ck-ab { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid var(--line-soft); }
        .ck-abh { font-weight: 700; }
        .ck-al { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 10px; background: #f6f7fb; border-radius: 12px; }
        .ck-al.off { opacity: .65; }
        .ck-ali { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
        .ck-alb { display: flex; gap: 6px; flex-wrap: wrap; }
        details.ck-accs > summary { cursor: pointer; font-weight: 700; font-size: 17px; }
      </style>${BANKS}
      <div class="page-head"><div><h1>Chuyển khoản thực nhận</h1><div class="sub">Nhập số dư từng tài khoản nhận tiền của cơ sở theo đúng mốc giờ của phiếu ca. Tiền nhận trong ca = tổng các tài khoản (Số dư cuối − Số dư đầu + Tiền chuyển ra). Đây là tiền nhận trong ca, chưa mặc định là doanh thu.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <details class="card ck-accs" ${noAcc.length || params.tk ? 'open' : ''}>
          <summary>Tài khoản nhận tiền (${accounts.filter((a) => a.active).length} đang dùng)${noAcc.length ? html` <span class="pill warn">${noAcc.map((b) => b.code).join(', ')} chưa có tài khoản</span>` : ''}</summary>
          <div class="stack" style="gap:10px;margin-top:12px">
            ${accountForm(byBranch)}
            <div class="st-meta">Một chi nhánh có thể có nhiều tài khoản. Tài khoản đã có số dư theo ca thì không xóa được (giữ lịch sử) — chọn <strong>Ngừng dùng</strong>.</div>
            <div id="ck-alist">${accList}</div>
          </div>
        </details>
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
      // ---- Tài khoản nhận tiền (sau khi đổi: mở lại trang, giữ mục tài khoản đang mở)
      const reload = () => { const h = '#/ke-toan/chuyen-khoan?ngay=' + day + '&tk=1'; if (location.hash === h) rerender(); else location.hash = h; };
      const saveAcc = async (f, a = {}) => {
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await rpc('app_kt_account_save', { p_id: a.id || null, p_branch: Number(f.branch.value) || null, p_bank: f.bank.value, p_no: f.no.value,
            p_holder: f.holder.value, p_label: f.label.value, p_active: a.id ? a.active : true });
          flash(a.id ? 'Đã lưu tài khoản.' : 'Đã thêm tài khoản nhận tiền.');
          reload();
          return true;
        } catch (e) { showSaved(e.message, true); btn.disabled = false; return false; }
      };
      $('.ck-accs .ck-accf').addEventListener('submit', (e) => { e.preventDefault(); saveAcc(e.target); });
      $$('.ck-al').forEach((el) => {
        const a = accounts.find((x) => x.id === Number(el.dataset.id));
        el.querySelector('.ck-edit').addEventListener('click', () => {
          const d = dialog(html`<div class="stack" style="gap:12px"><h2 style="margin:0">Sửa tài khoản</h2>
            ${a.used ? html`<div class="st-meta">Tài khoản đã có số dư theo ca: chỉ sửa được chủ tài khoản và tên gọi.</div>` : ''}
            ${accountForm(byBranch, a)}<div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
          if (a.used) ['branch', 'bank', 'no'].forEach((k) => { d.querySelector('form')[k].disabled = true; });
          d.querySelector('[data-x]').addEventListener('click', () => d.close());
          d.querySelector('form').addEventListener('submit', async (e) => {
            e.preventDefault(); const f = e.target;
            if (a.used) { f.branch.disabled = false; f.bank.disabled = false; f.no.disabled = false; }
            if (await saveAcc(f, a)) d.close();
          });
        });
        el.querySelector('.ck-toggle').addEventListener('click', async (ev) => {
          ev.target.disabled = true;
          try {
            await rpc('app_kt_account_save', { p_id: a.id, p_branch: a.branch_id, p_bank: a.bank, p_no: a.account_no, p_holder: a.holder, p_label: a.label, p_active: !a.active });
            flash(a.active ? 'Đã ngừng dùng tài khoản (vẫn giữ số dư các ca cũ).' : 'Đã dùng lại tài khoản.');
            reload();
          } catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
        });
        el.querySelector('.ck-del')?.addEventListener('click', async (ev) => {
          if (!confirm(`Xóa tài khoản ${a.bank} ${a.account_no}?`)) return;
          ev.target.disabled = true;
          try { await rpc('app_kt_account_delete', { p_id: a.id }); flash('Đã xóa tài khoản.'); reload(); }
          catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
        });
      });
      // ---- Số dư theo ca
      $$('.ck-row[data-report]').forEach((row) => {
        bindMoneyInputs(row);
        const calc = () => {
          let tot = 0; let any = false; let all = true;
          row.querySelectorAll('.ck-acc').forEach((acc) => {
            const o = parseMoney(acc.querySelector('.ck-open').value); const c = parseMoney(acc.querySelector('.ck-close').value); const out = parseMoney(acc.querySelector('.ck-out').value) || 0;
            const got = o === null || c === null ? null : c - o + out;
            acc.querySelector('.ck-ares').textContent = got === null ? 'Nhập số dư đầu và cuối để tính.' : `Nhận vào tài khoản này: ${fmt(got)}đ`;
            if (got === null) all = false; else { any = true; tot += got; }
          });
          const res = row.querySelector('.ck-res');
          if (!row.querySelector('.ck-acc')) { res.innerHTML = ''; return; }
          const pt = row.dataset.pt === '' ? null : Number(row.dataset.pt); const rt = row.dataset.rt === '' ? null : Number(row.dataset.rt);
          res.innerHTML = !any ? '<span class="st-meta">Nhập số dư đầu và cuối để tính tiền nhận trong ca.</span>'
            : `<strong>Tiền nhận trong ca: ${fmt(tot)}đ</strong>${all ? '' : ' <span class="pill warn">còn tài khoản chưa nhập</span>'}`
              + (pt !== null ? ` · <span class="st-meta">so với CK theo POS (${fmt(pt)}đ): ${signed(tot - pt)}</span>` : '')
              + (rt !== null ? ` · <span class="st-meta">so với CK nhân viên cộng hotline (${fmt(rt)}đ): ${signed(tot - rt)}</span>` : '');
        };
        row.addEventListener('input', (e) => { e.target.classList.remove('st-sg'); calc(); });
        calc();
        row.querySelector('.ck-save')?.addEventListener('click', async (ev) => {
          const items = [...row.querySelectorAll('.ck-acc')].map((acc) => ({
            account_id: Number(acc.dataset.acc), opening: parseMoney(acc.querySelector('.ck-open').value), closing: parseMoney(acc.querySelector('.ck-close').value),
            transfers_out: parseMoney(acc.querySelector('.ck-out').value) || 0, note: acc.querySelector('.ck-note').value }));
          ev.target.disabled = true;
          try {
            await rpc('app_kt_bank_save_accounts', { p_report: Number(row.dataset.report), p_rows: items });
            showSaved('Đã lưu · ' + hhmm());
          } catch (e) { showSaved(e.message, true); }
          ev.target.disabled = false;
        });
      });
    },
  };
}
