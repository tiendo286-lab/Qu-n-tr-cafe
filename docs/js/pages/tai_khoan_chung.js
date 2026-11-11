// Phần tài khoản đăng nhập dùng trong trang Nhân viên: trạng thái, menu thao tác từng người,
// cấp mật khẩu tạm hàng loạt + in, tài khoản riêng (không phải nhân viên).
import { render as rerender } from '../app.js';
import { adminFn, rpc, sel } from '../sb.js';
import { $, $$, ROLE_LABELS, dialog, flash, html, showSaved, str } from '../ui.js';

export const ACC_STATES = {
  chua_co: ['Chưa có mật khẩu', 'mute'],
  tam: ['Mật khẩu tạm', 'warn'],
  da_dat: ['Đã đặt mật khẩu', 'ok'],
  khoa: ['Đang bị khóa', 'off'],
};

export function accState(a, stopped) {
  if (!a || !a.id) return 'none';
  if (stopped) return 'ngung';
  if (a.locked) return 'khoa';
  if (!a.has_password) return 'chua_co';
  if (a.must_change) return 'tam';
  return 'da_dat';
}

// Ô "Tài khoản" trong bảng
export function accCell(state, a) {
  if (state === 'none') return html`<span class="st-meta">Không có tài khoản</span>`;
  if (state === 'ngung') return html`<span class="pill mute">Đã khóa (ngừng làm)</span>`;
  return html`<span class="pill ${ACC_STATES[state][1]}">${ACC_STATES[state][0]}</span>
    <div class="st-meta" style="font-size:11px;margin-top:2px">${ROLE_LABELS[a.system_role] || ''}${a.last_login_at ? ' · vào lần cuối ' + a.last_login_at.slice(0, 16) : ' · chưa đăng nhập'}</div>`;
}

// Được thao tác tài khoản này không (Quản lý tổng không đụng được tài khoản Chủ / Quản lý tổng khác)
export function canTouch(a, me, stopped) {
  return a && a.id && a.id !== me.account_id && !stopped && (me.role === 'chu' || !['chu', 'ql_tong'].includes(a.system_role));
}

// Nút "Tài khoản ▾" mở các thao tác
export function accMenu(a, label, extra = '') {
  return html`<details class="acc-menu"><summary class="btn sm secondary">Tài khoản ▾</summary><div class="acc-pop">
    <button type="button" class="act-temp" data-id="${a.id}" data-name="${label}">${a.has_password ? 'Cấp lại mật khẩu' : 'Cấp mật khẩu tạm'}</button>
    <button type="button" class="act-lock" data-id="${a.id}" data-locked="${a.locked ? 1 : 0}">${a.locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}</button>
    ${a.has_password ? html`<button type="button" class="act-out" data-id="${a.id}">Đăng xuất mọi nơi</button>` : ''}${extra}</div></details>`;
}

// Nút "Cấp lại mật khẩu" đứng riêng (trang Phân quyền, trang sửa nhân viên)
export function pwButton(a, label) {
  return html`<button type="button" class="btn sm secondary act-temp" data-id="${a.id}" data-name="${label}">${a.has_password ? 'Cấp lại mật khẩu' : 'Cấp mật khẩu'}</button>`;
}

export function bindPwButtons() {
  $$('.act-temp').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Cấp mật khẩu tạm mới cho ${b.dataset.name}? Mật khẩu cũ sẽ hết hiệu lực và người đó bị đăng xuất khỏi mọi thiết bị.`)) return;
    b.disabled = true;
    try { showPassword(await adminFn('temp_password', { account_id: Number(b.dataset.id) }), b.dataset.name); } catch (e) { showSaved(e.message, true); b.disabled = false; }
  }));
}

function showPassword(r, name) {
  const d = dialog(html`<h2>Mật khẩu tạm</h2><div style="margin-top:6px;color:var(--ink-2)">${name || `${r.login} – ${r.name}`}</div>
    <div class="temp-pass">${r.password}</div>
    <p style="font-size:14px;color:var(--ink-2)">Chỉ hiện <strong>một lần</strong>. Đưa tận tay; lần đầu đăng nhập phải đổi mật khẩu.</p>
    <form method="dialog"><button class="btn" type="submit">Đã ghi lại</button></form>`);
  d.addEventListener('close', () => rerender());
}

export function bindAccountActions() {
  $$('.acc-menu').forEach((m) => m.addEventListener('toggle', () => {
    if (!m.open) return;
    $$('.acc-menu[open]').forEach((o) => { if (o !== m) o.open = false; });
    // gần đáy bảng / màn hình thì bung lên trên để không bị che
    m.classList.remove('up');
    const pop = m.querySelector('.acc-pop').getBoundingClientRect();
    const box = (m.closest('.table-wrap') || document.documentElement).getBoundingClientRect();
    if (pop.bottom > Math.min(box.bottom, window.innerHeight)) m.classList.add('up');
  }));
  bindPwButtons();
  $$('.act-lock').forEach((b) => b.addEventListener('click', async () => {
    const locking = b.dataset.locked === '0';
    if (!confirm(locking ? 'Khóa tài khoản này? Người dùng sẽ bị đăng xuất và không đăng nhập được.' : 'Mở khóa tài khoản này?')) return;
    try { await adminFn('lock', { account_id: Number(b.dataset.id) }); flash(locking ? 'Đã khóa tài khoản.' : 'Đã mở khóa.'); rerender(); } catch (e) { showSaved(e.message, true); }
  }));
  $$('.act-out').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Buộc tài khoản này đăng xuất trên mọi điện thoại / máy tính?')) return;
    try { await adminFn('logout', { account_id: Number(b.dataset.id) }); showSaved('Đã đăng xuất mọi nơi'); b.closest('details').open = false; } catch (e) { showSaved(e.message, true); }
  }));
  $$('.act-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Xóa tài khoản ${b.dataset.name}?`)) return;
    try { await adminFn('delete_account', { account_id: Number(b.dataset.id) }); flash('Đã xóa tài khoản.'); rerender(); } catch (e) { showSaved(e.message, true); }
  }));
  const cf = $('#create-form');
  if (cf) cf.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(cf);
    const role = f.get('role');
    try {
      // Kế toán: tạo như Quản lý rồi đổi vai trò (máy chủ tạo tài khoản chưa nhận vai trò Kế toán trực tiếp)
      const r = await adminFn('create_account', { login: f.get('login'), name: f.get('name'), role: role === 'ke_toan' ? 'ql' : role });
      if (role === 'ke_toan') {
        const acc = (await sel('accounts', 'id, login_name', (b) => b.ilike('login_name', r.login)))[0];
        if (!acc) throw new Error('Đã tạo tài khoản nhưng chưa đổi được sang Kế toán — vào Phân quyền đổi vai trò.');
        await rpc('app_set_system_role', { p_account: acc.id, p_role: 'ke_toan' });
      }
      showPassword(r);
    } catch (e) { showSaved(e.message, true); }
  });
}

// Cấp mật khẩu tạm hàng loạt → trang in phiếu cắt
export function bulkButton(nNone, nTemp) {
  return html`<button class="btn sm" type="button" id="bulk-open">Cấp &amp; in mật khẩu hàng loạt</button>
    <dialog id="bulk-dialog"><div class="stack" style="gap:12px;max-width:460px"><h2 style="margin:0">Cấp mật khẩu tạm hàng loạt</h2>
      <div style="font-size:14px;color:var(--ink-2)">Tạo mật khẩu tạm cho nhiều nhân viên một lúc, rồi in danh sách cắt nhỏ phát tận tay từng người.</div>
      <select class="input" id="bulk-scope" aria-label="Phạm vi">
        <option value="chua_co">Người chưa có mật khẩu (${nNone})</option>
        <option value="chua_doi">Người chưa có + người chưa đổi mật khẩu tạm (${nNone + nTemp})</option></select>
      <div class="toolbar" style="justify-content:flex-end"><button class="btn secondary" type="button" id="bulk-cancel">Hủy</button><button class="btn" type="button" id="bulk-btn">Cấp &amp; in danh sách</button></div></div></dialog>`;
}

export function bindBulk() {
  const open = $('#bulk-open'); if (!open) return;
  const d = $('#bulk-dialog');
  open.addEventListener('click', () => d.showModal());
  $('#bulk-cancel').addEventListener('click', () => d.close());
  $('#bulk-btn').addEventListener('click', async () => {
    if (!confirm('Cấp mật khẩu tạm mới cho các tài khoản đã chọn? Mật khẩu tạm cũ (nếu có) sẽ hết hiệu lực.')) return;
    const btn = $('#bulk-btn'); btn.disabled = true; btn.textContent = 'Đang cấp… (có thể mất vài chục giây)';
    try {
      const r = await adminFn('bulk', { scope: $('#bulk-scope').value });
      d.close();
      if (!r.rows.length) { alert('Không có tài khoản nào cần cấp mật khẩu.'); rerender(); return; }
      const at = new Date().toLocaleString('vi-VN');
      document.querySelector('.main').innerHTML = str(html`
        <div class="page-head"><div><h1>Danh sách mật khẩu tạm (${r.rows.length} người)</h1>
          <div class="sub">Tạo lúc ${at}. Danh sách <strong>chỉ hiện một lần</strong> — hãy in hoặc ghi lại ngay. Cắt theo đường đứt và đưa tận tay từng người.</div></div>
          <div class="noprint toolbar"><button class="btn" type="button" onclick="window.print()">In danh sách</button><a class="btn secondary" href="#/quan-ly/nhan-vien" id="bulk-done">Xong</a></div></div>
        <div class="slips">${r.rows.map((x) => html`<div class="slip"><div><strong>${x.name}</strong></div>
          <div>Mã đăng nhập: <strong>${x.login}</strong></div><div>Mật khẩu tạm: <span class="pw">${x.password}</span></div>
          <div style="font-size:12px;color:#475569">Vào web ${location.origin + location.pathname}, đăng nhập rồi đổi mật khẩu mới (ít nhất 6 ký tự).</div></div>`)}</div>`);
      $('#bulk-done').addEventListener('click', (e) => { e.preventDefault(); rerender(); });
    } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = 'Cấp & in danh sách'; }
  });
}

// Tài khoản riêng: không gắn nhân viên (kế toán, chủ thứ hai…)
export function standaloneSection(items, me, canPerm) {
  if (!items.length && !canPerm) return '';
  return html`<section class="card stack" style="gap:10px">
    <h2 style="margin:0">Tài khoản riêng (không phải nhân viên)</h2>
    <div class="st-meta" style="font-size:13px">Cho người không có trong danh sách nhân viên (vd kế toán, chủ thứ hai). Nhân viên thì đã có sẵn tài khoản — đăng nhập bằng mã nhân viên.</div>
    ${items.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Đăng nhập bằng</th><th>Tên</th><th>Tài khoản</th><th></th></tr></thead><tbody>
      ${items.map((a) => { const st = accState(a, false); return html`<tr><td><strong>${a.login_name || '—'}</strong></td><td>${a.display_name || '—'}</td><td>${accCell(st, a)}</td>
        <td>${canTouch(a, me, false) ? accMenu(a, `${a.login_name} – ${a.display_name || ''}`, canPerm ? html`<button type="button" class="act-del danger" data-id="${a.id}" data-name="${a.login_name}">Xóa tài khoản</button>` : '')
          : a.id === me.account_id ? html`<span class="st-meta">Tài khoản của bạn</span>` : ''}</td></tr>`; })}</tbody></table></div>` : ''}
    ${canPerm ? html`<form class="toolbar" id="create-form">
      <input class="input sm" name="login" placeholder="Tên đăng nhập (vd ketoan)" required pattern="[A-Za-z0-9._\\-]{3,30}" aria-label="Tên đăng nhập">
      <input class="input sm" name="name" placeholder="Tên hiển thị" required maxlength="60" aria-label="Tên hiển thị">
      <select class="input sm" name="role" aria-label="Vai trò"><option value="ke_toan" selected>Kế toán</option><option value="ql">Quản lý</option><option value="ql_tong">Quản lý tổng</option><option value="chu">Chủ</option></select>
      <button class="btn sm" type="submit">+ Tạo tài khoản riêng</button></form>` : ''}</section>`;
}

export const ACC_CSS = html`<style>
  .acc-menu { position: relative; display: inline-block; }
  .acc-menu > summary { list-style: none; cursor: pointer; white-space: nowrap; }
  .acc-menu > summary::-webkit-details-marker { display: none; }
  .acc-pop { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; background: #fff; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.12); padding: 6px; min-width: 190px; display: flex; flex-direction: column; }
  .acc-pop button { text-align: left; border: none; background: none; padding: 9px 10px; border-radius: 6px; font: inherit; font-size: 14px; cursor: pointer; color: var(--ink); }
  .acc-pop button:hover { background: var(--line-soft); }
  .acc-pop button.danger { color: #b91c1c; }
  .acc-menu.up .acc-pop { top: auto; bottom: calc(100% + 4px); }
  .acc-cell { display: flex; align-items: center; gap: 8px; justify-content: space-between; min-width: 220px; }
  .acc-cell .acc-pop { right: 0; }
</style>`;
