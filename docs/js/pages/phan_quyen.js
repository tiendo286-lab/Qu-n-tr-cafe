import { rpc, sel, selAll } from '../sb.js';
import { $, $$, ROLE_LABELS, hhmm, html, norm, showSaved } from '../ui.js';

export const perm = 'phan_quyen';

const PERMISSIONS = [
  ['order_ca', 'Order ca'],
  ['xem_lich_minh', 'Xem lịch của mình'],
  ['xem_tat_ca', 'Xem order và lịch của mọi người'],
  ['xep_lich', 'Xếp lịch, xem tab Cảnh báo'],
  ['chot_tuan', 'Chốt tuần, mở lại tuần'],
  ['sua_order_sau_han', 'Sửa order sau hạn'],
  ['quan_ly_nhan_vien', 'Thêm/sửa nhân viên, email, mật khẩu tạm'],
  ['cai_gio_order', 'Cài giờ mở/hết hạn order'],
  ['sua_danh_muc', 'Sửa định biên, giờ ca, lịch cố định'],
  ['bao_cao', 'Xem báo cáo, xếp lịch tổng, xuất Excel'],
  ['doi_soat', 'Đối soát phiếu chốt ca, tiền mặt cuối ngày'],
  ['mo_lai_phieu_ca', 'Mở lại phiếu chốt ca đã hoàn thành'],
];
const OWNER_ONLY = ['Cấp vai trò, sửa phân quyền', 'Xóa dữ liệu tuần', 'Sao lưu, chuyển dữ liệu (ZIP), khôi phục'];
const NV_ALWAYS = ['order_ca', 'xem_lich_minh'];
const EVERYONE = ['Chốt ca (điền phiếu chốt ca)'];
const NV_EDITABLE = ['xem_tat_ca'];
const EDITABLE_ROLES = ['ql_tong', 'ql', 'nv'];
const ORDER = { chu: 0, ql_tong: 1, ql: 2, nv: 3 };

export async function render() {
  const [rp, accounts, emps] = await Promise.all([
    sel('role_permissions', 'role, perm, allowed'),
    selAll('accounts', 'id, employee_id, login_name, display_name, system_role'),
    selAll('employees', 'id, code, name, rank, status'),
  ]);
  const allowed = new Map(rp.map((r) => [`${r.role}.${r.perm}`, r.allowed === 1]));
  const empById = new Map(emps.map((e) => [e.id, e]));
  const users = accounts.map((a) => {
    const e = a.employee_id ? empById.get(a.employee_id) : null;
    return { ...a, code: e ? e.code : a.login_name, name: e ? e.name : (a.display_name || 'Chủ'), rank: e?.rank, stopped: !!(e && e.status !== 'Đang làm') || (!e && !a.login_name) };
  }).sort((x, y) => (ORDER[x.system_role] - ORDER[y.system_role]) || (x.stopped - y.stopped) || String(x.name).localeCompare(String(y.name), 'vi'));

  const cell = (role, key, label) => {
    if (role === 'nv' && NV_ALWAYS.includes(key)) return html`<span style="color:var(--muted);font-size:13px">Luôn có</span>`;
    if (role === 'nv' && !NV_EDITABLE.includes(key)) return html`<span style="color:#8a93a3">—</span>`;
    return html`<input type="checkbox" class="check perm-box" data-role="${role}" data-perm="${key}" ${allowed.get(`${role}.${key}`) ? 'checked' : ''} aria-label="${label} – ${ROLE_LABELS[role]}">`;
  };

  return {
    title: 'Phân quyền',
    html: html`
      <div class="page-head"><div><h1>Phân quyền</h1>
        <div class="sub">Chỉ Chủ vào được. Quyền áp dụng theo vai trò; mỗi thay đổi được lưu ngay.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <section class="card flush">
        <div class="card-head"><h2>Quyền theo vai trò</h2></div>
        <div class="table-wrap"><table class="table rt-fx" aria-label="Quyền theo vai trò">
          <thead class="dark"><tr><th scope="col">Chức năng</th><th scope="col" class="center">Chủ</th><th scope="col" class="center">Quản lý tổng</th><th scope="col" class="center">Quản lý</th><th scope="col" class="center">Nhân viên</th></tr></thead>
          <tbody>
            ${PERMISSIONS.map(([key, label]) => html`<tr>
              <th scope="row" style="background:none;font-weight:500;color:var(--ink)">${label}</th>
              <td class="center" style="color:var(--muted);font-size:13px">Luôn có</td>
              ${EDITABLE_ROLES.map((role) => html`<td class="center">${cell(role, key, label)}</td>`)}</tr>`)}
            ${EVERYONE.map((label) => html`<tr class="locked">
              <th scope="row" style="background:#f7f8fb;font-weight:500;color:var(--ink)">${label}</th>
              <td class="center" colspan="4" style="color:var(--muted);font-size:13px">Luôn có cho mọi người (kể cả Nhân viên)</td></tr>`)}
            ${OWNER_ONLY.map((label) => html`<tr class="locked">
              <th scope="row" style="background:#f7f8fb;font-weight:500;color:var(--ink)">${label}</th>
              <td class="center" style="color:var(--muted);font-size:13px">Luôn có</td>
              <td class="center" colspan="3" style="color:var(--muted);font-size:13px">Chỉ Chủ — không cấp được cho vai trò khác</td></tr>`)}
          </tbody></table></div>
      </section>
      <section class="card flush">
        <div class="card-head"><h2>Người dùng</h2>
          <div class="toolbar">
            <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="show-stopped" class="check"> Hiện cả người ngừng làm</label>
            <input class="input sm" id="user-search" type="search" placeholder="Tìm mã hoặc tên" aria-label="Tìm người dùng" style="width:240px">
          </div></div>
        <div class="table-wrap"><table class="table" aria-label="Người dùng">
          <thead><tr><th>Mã NV</th><th>Tên</th><th>Cấp bậc</th><th>Vai trò hệ thống</th><th>Trạng thái</th></tr></thead>
          <tbody>${users.map((u) => html`
            <tr class="user-row ${u.stopped ? 'muted stopped' : ''}" data-search="${norm(u.code + ' ' + u.name)}" ${u.stopped ? 'hidden' : ''}>
              <td style="font-weight:600">${u.code || '—'}</td><td>${u.name}</td><td>${u.rank || '—'}</td>
              <td>${u.system_role === 'chu' ? html`<span style="font-weight:600;color:var(--primary-dark)">Chủ (cố định)</span>` : html`
                <select class="input sm role-select" data-account="${u.id}" aria-label="Vai trò của ${u.name}" style="width:180px">
                  ${EDITABLE_ROLES.map((r) => html`<option value="${r}" ${r === u.system_role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`)}</select>`}</td>
              <td>${u.stopped ? html`<span class="pill mute">Ngừng làm</span>` : html`<span class="pill ok">${u.system_role === 'chu' ? 'Đang dùng' : 'Đang làm'}</span>`}</td></tr>`)}
          </tbody></table></div>
      </section>`,
    mount() {
      $$('.perm-box').forEach((box) => box.addEventListener('change', async () => {
        try { await rpc('app_set_perm', { p_role: box.dataset.role, p_perm: box.dataset.perm, p_allowed: box.checked }); showSaved('Đã lưu · ' + hhmm()); }
        catch (e) { box.checked = !box.checked; showSaved(e.message, true); }
      }));
      $$('.role-select').forEach((s) => {
        let prev = s.value;
        s.addEventListener('change', async () => {
          try { await rpc('app_set_system_role', { p_account: Number(s.dataset.account), p_role: s.value }); prev = s.value; showSaved('Đã lưu · ' + hhmm()); }
          catch (e) { s.value = prev; showSaved(e.message, true); }
        });
      });
      const stopped = $('#show-stopped'); const search = $('#user-search');
      const apply = () => {
        const q = norm(search.value.trim());
        $$('.user-row').forEach((row) => {
          row.hidden = (row.classList.contains('stopped') && !stopped.checked) || (q && !row.dataset.search.includes(q));
        });
      };
      stopped.addEventListener('change', apply); search.addEventListener('input', apply);
    },
  };
}
