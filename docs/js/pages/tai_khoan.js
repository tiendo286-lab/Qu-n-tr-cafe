import { render as rerender } from '../app.js';
import { adminFn, sel, selAll } from '../sb.js';
import { $, $$, ROLE_LABELS, dialog, flash, html, norm, showSaved, str } from '../ui.js';

export const perm = 'quan_ly_nhan_vien';

const STATES = {
  dang_dung: ['Đang dùng', 'ok', '#16a34a'],
  tam: ['Mật khẩu tạm – chờ đổi', 'warn', '#f59e0b'],
  chua_co: ['Chưa cấp mật khẩu', 'mute', '#9ca3af'],
  khoa: ['Đang bị khóa', 'off', '#dc2626'],
  ngung: ['Khóa – NV ngừng làm', 'off', '#dc2626'],
};
const ORDER = { chu: 0, ql_tong: 1, ql: 2, nv: 3 };

function stateOf(a) {
  if (a.emp && a.emp.status !== 'Đang làm') return 'ngung';
  if (a.employee_id == null && a.employee_code) return 'ngung'; // NV không còn trong dữ liệu
  if (a.locked) return 'khoa';
  if (!a.has_password) return 'chua_co';
  if (a.must_change) return 'tam';
  return 'dang_dung';
}

export async function render({ me, can, params }) {
  const [accounts, emps, eb, branches] = await Promise.all([
    selAll('accounts', 'id, employee_id, employee_code, login_name, display_name, system_role, has_password, must_change, locked, last_login_at'),
    selAll('employees', 'id, code, name, rank, status'),
    selAll('employee_branches', 'employee_id, branch_id'),
    sel('branches', 'id, code, sort_order', (b) => b.order('sort_order')),
  ]);
  const empById = new Map(emps.map((e) => [e.id, e]));
  const bcode = new Map(branches.map((b) => [b.id, b.code]));
  const bOf = new Map();
  eb.forEach((r) => { if (!bOf.has(r.employee_id)) bOf.set(r.employee_id, []); bOf.get(r.employee_id).push(bcode.get(r.branch_id)); });
  const items = accounts.map((a) => {
    const emp = a.employee_id ? empById.get(a.employee_id) : null;
    const it = { ...a, emp };
    it.state = stateOf(it);
    it.login = emp ? emp.code : (a.login_name || a.employee_code || '—');
    it.who = emp ? emp.name : (a.display_name || '—');
    it.branches = emp ? (bOf.get(emp.id) || []).join(', ') : '';
    return it;
  }).sort((x, y) => (ORDER[x.system_role] - ORDER[y.system_role])
    || ((x.state === 'ngung') - (y.state === 'ngung')) || x.who.localeCompare(y.who, 'vi'));
  const counts = Object.fromEntries(Object.keys(STATES).map((k) => [k, items.filter((i) => i.state === k).length]));
  const tt = params.tt || '';

  const rowHtml = (a) => {
    const self = a.id === me.account_id;
    const allowed = !self && a.state !== 'ngung' && (me.role === 'chu' || !['chu', 'ql_tong'].includes(a.system_role));
    const standalone = !a.employee_id && !a.employee_code;
    return html`<tr data-search="${norm(a.login + ' ' + a.who)}" data-state="${a.state}" data-role="${a.system_role}">
      <td><strong>${a.login}</strong></td>
      <td>${a.who}${standalone ? html` <span class="pill mute">tài khoản riêng</span>` : ''}</td>
      <td>${ROLE_LABELS[a.system_role]}</td>
      <td style="font-size:13px">${a.branches || '—'}</td>
      <td><span class="pill ${STATES[a.state][1]}">${STATES[a.state][0]}</span></td>
      <td style="font-size:13px">${a.last_login_at || 'Chưa đăng nhập'}</td>
      <td style="white-space:nowrap">
        ${allowed ? html`
          <button class="btn sm act-temp" type="button" data-id="${a.id}" data-name="${a.who}">Cấp mật khẩu tạm</button>
          <button class="btn sm secondary act-lock" type="button" data-id="${a.id}" data-locked="${a.locked ? 1 : 0}">${a.locked ? 'Mở khóa' : 'Khóa'}</button>
          ${a.has_password ? html`<button class="btn sm secondary act-out" type="button" data-id="${a.id}" title="Buộc đăng xuất trên mọi điện thoại/máy tính">Đăng xuất mọi nơi</button>` : ''}
          ${standalone && can('phan_quyen') ? html`<button class="btn sm secondary danger act-del" type="button" data-id="${a.id}" data-name="${a.login}">Xóa</button>` : ''}`
        : (self ? html`<span style="font-size:13px;color:var(--muted)">Tài khoản của bạn</span>` : '')}
      </td></tr>`;
  };

  return {
    title: 'Tài khoản đăng nhập',
    html: html`
      <div class="page-head"><div><h1>Tài khoản đăng nhập</h1>
        <div class="sub">Mỗi nhân viên có sẵn một tài khoản, đăng nhập bằng <strong>mã nhân viên</strong>. Cấp mật khẩu tạm và đưa tận tay; lần đầu đăng nhập nhân viên bắt buộc đổi mật khẩu. Vai trò và quyền chỉnh ở <a href="#/quan-ly/phan-quyen">Phân quyền</a>.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="tiles">${Object.entries(STATES).map(([k, [label, , color]]) => html`
        <a class="tile" href="#/quan-ly/tai-khoan?tt=${k}" style="border-top-color:${color}"><div class="n">${counts[k]}</div><div class="l">${label}</div></a>`)}</div>
      <div class="grid2">
        <section class="card stack">
          <h2 style="margin:0">Cấp mật khẩu tạm hàng loạt</h2>
          <p style="margin:0;font-size:14px;color:var(--ink-2)">Tạo mật khẩu tạm cho nhiều nhân viên một lúc, rồi in danh sách cắt nhỏ phát cho từng người.</p>
          <div class="toolbar">
            <select class="input sm" id="bulk-scope" aria-label="Phạm vi">
              <option value="chua_co">Người chưa có mật khẩu (${counts.chua_co})</option>
              <option value="chua_doi">Người chưa có + người chưa đổi mật khẩu tạm (${counts.chua_co + counts.tam})</option>
            </select>
            <button class="btn sm" type="button" id="bulk-btn">Cấp &amp; in danh sách</button>
          </div>
        </section>
        ${can('phan_quyen') ? html`<section class="card stack">
          <h2 style="margin:0">Tạo tài khoản riêng</h2>
          <p style="margin:0;font-size:14px;color:var(--ink-2)">Cho người không có trong danh sách nhân viên (vd kế toán, chủ thứ hai). Nhân viên thì không cần tạo — đã có sẵn.</p>
          <form class="toolbar" id="create-form">
            <input class="input sm" name="login" placeholder="Tên đăng nhập (vd ketoan)" required pattern="[A-Za-z0-9._\\-]{3,30}" aria-label="Tên đăng nhập">
            <input class="input sm" name="name" placeholder="Tên hiển thị" required maxlength="60" aria-label="Tên hiển thị">
            <select class="input sm" name="role" aria-label="Vai trò"><option value="ql" selected>Quản lý</option><option value="ql_tong">Quản lý tổng</option><option value="chu">Chủ</option></select>
            <button class="btn sm" type="submit">+ Tạo</button>
          </form></section>` : ''}
      </div>
      <section class="card flush">
        <div class="filter-bar">
          <input class="input sm" type="search" id="f-q" placeholder="Tìm mã / tên" aria-label="Tìm">
          <select class="input sm" id="f-tt" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option>${Object.entries(STATES).map(([k, [label]]) => html`<option value="${k}" ${k === tt ? 'selected' : ''}>${label}</option>`)}</select>
          <select class="input sm" id="f-vt" aria-label="Vai trò"><option value="">Tất cả vai trò</option>${Object.entries(ROLE_LABELS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
          <span style="font-size:13px" id="f-count"></span>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Đăng nhập bằng</th><th>Họ tên</th><th>Vai trò</th><th>Cơ sở</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr></thead>
          <tbody id="acc-rows">${items.map(rowHtml)}</tbody></table></div>
      </section>`,
    mount() {
      const apply = () => {
        const q = norm($('#f-q').value.trim()); const st = $('#f-tt').value; const vt = $('#f-vt').value;
        let n = 0;
        $$('#acc-rows tr').forEach((tr) => {
          const show = (!q || tr.dataset.search.includes(q)) && (!st || tr.dataset.state === st) && (!vt || tr.dataset.role === vt);
          tr.hidden = !show; if (show) n++;
        });
        $('#f-count').textContent = `${n} tài khoản`;
      };
      ['#f-q', '#f-tt', '#f-vt'].forEach((s) => $(s).addEventListener('input', apply));
      apply();

      const showPassword = (r) => {
        const d = dialog(html`<h2>Mật khẩu tạm</h2><div style="margin-top:6px;color:var(--ink-2)">${r.login} – ${r.name}</div>
          <div class="temp-pass">${r.password}</div>
          <p style="font-size:14px;color:var(--ink-2)">Chỉ hiện một lần. Đưa tận tay; lần đầu đăng nhập phải đổi mật khẩu.</p>
          <form method="dialog"><button class="btn" type="submit">Đã ghi lại</button></form>`);
        d.addEventListener('close', () => rerender());
      };
      $$('.act-temp').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Cấp mật khẩu tạm mới cho ${b.dataset.name}? Mật khẩu cũ sẽ hết hiệu lực.`)) return;
        b.disabled = true;
        try { showPassword(await adminFn('temp_password', { account_id: Number(b.dataset.id) })); } catch (e) { alert(e.message); b.disabled = false; }
      }));
      $$('.act-lock').forEach((b) => b.addEventListener('click', async () => {
        const locking = b.dataset.locked === '0';
        if (!confirm(locking ? 'Khóa tài khoản này? Người dùng sẽ bị đăng xuất và không đăng nhập được.' : 'Mở khóa tài khoản này?')) return;
        try { await adminFn('lock', { account_id: Number(b.dataset.id) }); flash(locking ? 'Đã khóa tài khoản.' : 'Đã mở khóa.'); rerender(); } catch (e) { alert(e.message); }
      }));
      $$('.act-out').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Buộc tài khoản này đăng xuất trên mọi thiết bị?')) return;
        try { await adminFn('logout', { account_id: Number(b.dataset.id) }); showSaved('Đã đăng xuất mọi nơi'); } catch (e) { alert(e.message); }
      }));
      $$('.act-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Xóa tài khoản ${b.dataset.name}?`)) return;
        try { await adminFn('delete_account', { account_id: Number(b.dataset.id) }); flash('Đã xóa tài khoản.'); rerender(); } catch (e) { alert(e.message); }
      }));
      const cf = $('#create-form');
      if (cf) cf.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(cf);
        try { showPassword(await adminFn('create_account', { login: f.get('login'), name: f.get('name'), role: f.get('role') })); } catch (e) { alert(e.message); }
      });
      $('#bulk-btn').addEventListener('click', async () => {
        if (!confirm('Cấp mật khẩu tạm mới cho các tài khoản đã chọn? Mật khẩu tạm cũ (nếu có) sẽ hết hiệu lực.')) return;
        const btn = $('#bulk-btn'); btn.disabled = true; btn.textContent = 'Đang cấp… (có thể mất vài chục giây)';
        try {
          const r = await adminFn('bulk', { scope: $('#bulk-scope').value });
          if (!r.rows.length) { alert('Không có tài khoản nào cần cấp mật khẩu.'); btn.disabled = false; btn.textContent = 'Cấp & in danh sách'; return; }
          const at = new Date().toLocaleString('vi-VN');
          document.querySelector('.main').innerHTML = str(html`
            <div class="page-head"><div><h1>Danh sách mật khẩu tạm (${r.rows.length} người)</h1>
              <div class="sub">Tạo lúc ${at}. Danh sách <strong>chỉ hiện một lần</strong> — hãy in hoặc ghi lại ngay. Cắt theo đường đứt và đưa tận tay từng người.</div></div>
              <div class="noprint toolbar"><button class="btn" type="button" onclick="window.print()">In danh sách</button><a class="btn secondary" href="#/quan-ly/tai-khoan" id="bulk-done">Xong</a></div></div>
            <div class="slips">${r.rows.map((x) => html`<div class="slip"><div><strong>${x.name}</strong></div>
              <div>Mã đăng nhập: <strong>${x.login}</strong></div><div>Mật khẩu tạm: <span class="pw">${x.password}</span></div>
              <div style="font-size:12px;color:#475569">Vào web ${location.origin + location.pathname}, đăng nhập rồi đổi mật khẩu mới (ít nhất 6 ký tự).</div></div>`)}</div>`);
          $('#bulk-done').addEventListener('click', (e) => { e.preventDefault(); rerender(); });
        } catch (e) { alert(e.message); btn.disabled = false; btn.textContent = 'Cấp & in danh sách'; }
      });
    },
  };
}
