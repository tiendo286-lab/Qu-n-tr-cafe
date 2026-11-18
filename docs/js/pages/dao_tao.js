// Đào tạo: phần dùng chung (nhãn trạng thái + hộp tạo phiếu). Theo dõi đào tạo nằm ở danh sách Nhân viên (cột Đào tạo).
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dialog, go, html } from '../ui.js';

export const DT_STATUS = {
  chua_dao_tao: ['Chưa đào tạo', 'mute'], dang_dao_tao: ['Đang đào tạo', 'info'], dao_tao_tiep: ['Đào tạo tiếp', 'warn'], hoan_thanh: ['Đã hoàn thành', 'ok'],
  dao_tao_bo_sung: ['Đang đào tạo giai đoạn 2', 'warn'], cho_nhan_xet: ['Chờ nhận xét cuối', 'info'],
};
export const dtLabel = (t) => (!t ? 'Chưa đào tạo' : t.status === 'dang_dao_tao' ? `Đang đào tạo — ${t.achieved}/${t.total}` : t.status === 'dao_tao_tiep' ? `Đào tạo tiếp — ${t.achieved}/${t.total}` : DT_STATUS[t.status][0]);

// Hộp "Tạo phiếu đào tạo chạy bàn" cho 1 nhân viên: emp = { id, name, branch } (branch = mã cơ sở gợi ý)
export async function openCreateDialog(emp) {
  const opt = await rpc('app_dt_options');
  const brId = opt.branches.find((x) => x.code === emp.branch)?.id || '';
  const mgrs = opt.employees.filter((e) => e.rank === 'Quản lý');   // bước 139: người hướng dẫn chính chỉ là Quản lý
  const d = dialog(html`<form class="stack" style="gap:10px" id="dt-new">
    <h2 style="margin:0">Tạo phiếu đào tạo chạy bàn</h2><div><strong>${emp.name}</strong></div>
    <label class="stack" style="gap:4px">Cơ sở<select class="input" name="branch"><option value="">—</option>${opt.branches.map((x) => html`<option value="${x.id}" ${String(x.id) === String(brId) ? 'selected' : ''}>${x.code}</option>`)}</select></label>
    <label class="stack" style="gap:4px">Ngày bắt đầu<input class="input" type="date" name="start" value="${vnToday()}" required></label>
    <label class="stack" style="gap:4px">Người hướng dẫn chính (Quản lý)<input class="input" name="hd" list="dt-emps" placeholder="Gõ mã hoặc tên quản lý" required><datalist id="dt-emps">${mgrs.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}</datalist></label>
    <label class="stack" style="gap:4px">Quản lý phụ trách<select class="input" name="ql"><option value="">—</option>${opt.managers.map((m) => html`<option value="${m.id}">${m.name}</option>`)}</select></label>
    <div id="dt-err"></div>
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" id="dt-cancel">Hủy</button><button class="btn" type="submit">Tạo phiếu</button></div></form>`);
  const err = (m) => { const box = d.querySelector('#dt-err'); box.innerHTML = ''; box.append(Object.assign(document.createElement('div'), { className: 'alert error', textContent: m })); };
  d.querySelector('#dt-cancel').addEventListener('click', () => d.close());
  d.querySelector('#dt-new').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = ev.target;
    const q = f.hd.value.trim().toLowerCase(); const code = q.split(/\s*[–-]\s*/)[0];
    const hd = q ? (mgrs.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || mgrs.find((x) => String(x.code).toLowerCase() === code)) : null;
    if (!q) { err('Chọn người hướng dẫn chính (nhân viên cấp Quản lý).'); return; }
    if (!hd) { err('Người hướng dẫn chính phải là nhân viên cấp Quản lý. Chọn trong danh sách gợi ý.'); return; }
    try {
      const id = await rpc('app_dt_create', { p_employee: emp.id, p: { branch_id: f.branch.value || null, start_date: f.start.value, instructor_id: hd?.id || null, manager_id: f.ql.value || null } });
      d.close(); go(`/dao-tao/phieu?id=${id}`);
    } catch (e) { err(e.message); }
  });
}
