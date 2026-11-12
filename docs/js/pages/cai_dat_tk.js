// Cài đặt › Tài khoản ngân hàng (chuyển từ trang Chuyển khoản thực nhận 12/11/2026 — ít khi dùng):
// mỗi chi nhánh có thể nhiều tài khoản nhận tiền; thêm / sửa / ngừng dùng / xóa khi chưa có số dư.
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { $, $$, dialog, flash, html, showSaved } from '../ui.js';

export const perm = 'ke_toan';

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

export async function render() {
  const [rows, accounts] = await Promise.all([rpc('app_kt_bank_day', { p_date: vnToday() }), rpc('app_kt_accounts')]);
  const branches = [];
  rows.forEach((r) => { if (!branches.some((b) => b.id === r.branch_id)) branches.push({ id: r.branch_id, code: r.branch_code, name: r.branch_name }); });
  const accList = branches.map((b) => {
    const list = accounts.filter((a) => a.branch_id === b.id);
    return html`<div class="ck-ab"><div class="ck-abh">${b.code} – ${b.name}${list.some((a) => a.active) ? '' : html` <span class="pill warn">chưa có tài khoản đang dùng</span>`}</div>
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
    title: 'Tài khoản ngân hàng',
    html: html`<style>
        .pc-f { display: flex; flex-direction: column; gap: 4px; font-size: 14px; min-width: 0; }
        .ck-accf { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; align-items: end; }
        .ck-ab { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-top: 1px solid var(--line-soft); }
        .ck-abh { font-weight: 700; }
        .ck-al { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 10px; background: var(--subtle); border-radius: 12px; }
        .ck-al.off { opacity: .65; }
        .ck-ali { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
        .ck-alb { display: flex; gap: 6px; flex-wrap: wrap; }
      </style>${BANKS}
      <div class="page-head"><div><h1>Tài khoản ngân hàng</h1><div class="sub">Tài khoản nhận tiền của từng cơ sở — dùng ở Kế toán › Chuyển khoản thực nhận (nhập số dư từng ca). Một cơ sở có thể nhiều tài khoản. Tài khoản đã có số dư theo ca thì không xóa được (giữ lịch sử) — chọn <strong>Ngừng dùng</strong>.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card stack" style="gap:10px"><h2 style="margin:0">Thêm tài khoản</h2>${accountForm(branches)}</section>
        <section class="card stack" style="gap:4px"><h2 style="margin:0">Tài khoản theo cơ sở (${accounts.filter((a) => a.active).length} đang dùng)</h2><div id="ck-alist">${accList}</div></section>
      </div>`,
    mount() {
      const saveAcc = async (f, a = {}) => {
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await rpc('app_kt_account_save', { p_id: a.id || null, p_branch: Number(f.branch.value) || null, p_bank: f.bank.value, p_no: f.no.value,
            p_holder: f.holder.value, p_label: f.label.value, p_active: a.id ? a.active : true });
          flash(a.id ? 'Đã lưu tài khoản.' : 'Đã thêm tài khoản nhận tiền.'); rerender(); return true;
        } catch (e) { showSaved(e.message, true); btn.disabled = false; return false; }
      };
      $('.ck-accf').addEventListener('submit', (e) => { e.preventDefault(); saveAcc(e.target); });
      $$('.ck-al').forEach((el) => {
        const a = accounts.find((x) => x.id === Number(el.dataset.id));
        el.querySelector('.ck-edit').addEventListener('click', () => {
          const d = dialog(html`<div class="stack" style="gap:12px"><h2 style="margin:0">Sửa tài khoản</h2>
            ${a.used ? html`<div class="st-meta">Tài khoản đã có số dư theo ca: chỉ sửa được chủ tài khoản và tên gọi.</div>` : ''}
            ${accountForm(branches, a)}<div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
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
            flash(a.active ? 'Đã ngừng dùng tài khoản (vẫn giữ số dư các ca cũ).' : 'Đã dùng lại tài khoản.'); rerender();
          } catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
        });
        el.querySelector('.ck-del')?.addEventListener('click', async (ev) => {
          if (!confirm(`Xóa tài khoản ${a.bank} ${a.account_no}?`)) return;
          ev.target.disabled = true;
          try { await rpc('app_kt_account_delete', { p_id: a.id }); flash('Đã xóa tài khoản.'); rerender(); }
          catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
        });
      });
    },
  };
}
