// Chặng 4 (anh Tiến chốt 22/11/2026): ô CHỌN người nợ dùng chung cho các hộp ghi nợ ngoài Sổ thu chi
// (Công nợ › Ghi nợ · "Thành nợ" khoản chi của phiếu ca · Đối soát ca › Ghi nhận nợ). Từ bước 172 máy chủ chỉ nhận tên có trong
// danh sách người nợ của cơ sở → chọn trong danh sách (chia nhóm như Sổ thu chi), chưa có thì "+ Thêm người nợ…" ngay trong hộp.
// Không lấy được danh sách (vd không có quyền Sổ thu chi) → loadPeople trả null, hộp dùng lại ô gõ tên như cũ (máy chủ vẫn kiểm tên).
import { rpc } from './sb.js';
import { dialog, html, str } from './ui.js';

export const GRP_NO = { khach: 'Nợ khách hàng', kho: 'Nợ kho tổng', khac: 'Nợ khác' };

export async function loadPeople(branchId) {
  try { const r = await rpc('app_stc_people', { p_branch: Number(branchId) }); return Array.isArray(r) ? r : null; } catch (_) { return null; }
}

const opts = (people, cur) => {
  const act = people.filter((p) => p.active !== 0);
  const known = !cur || act.some((p) => p.name === cur);
  return html`<option value="">— Chọn người nợ —</option>${known ? '' : html`<option value="${cur}" selected>${cur} (chưa có trong danh sách)</option>`}
    ${Object.entries(GRP_NO).map(([g, l]) => { const xs = act.filter((p) => (p.grp || 'khach') === g);
      return xs.length ? html`<optgroup label="${l}">${xs.map((p) => html`<option value="${p.name}" data-grp="${g}" ${p.name === cur ? 'selected' : ''}>${p.name}</option>`)}</optgroup>` : ''; })}
    <option value="__add">+ Thêm người nợ…</option>`;
};

export function peopleSelect(people, { name = 'name', cur = '' } = {}) {
  return html`<select class="input" name="${name}" data-nnsel="1" aria-label="Người nợ">${opts(people, cur)}</select>`;
}

// Gắn "+ Thêm người nợ…" cho mọi ô chọn trong root; onPick(tên, nhóm) khi chọn xong (thêm mới thì người mới được chọn sẵn)
export function bindPeopleSelect(root, people, branchId, { grp0 = () => 'khach', onPick = () => {} } = {}) {
  root.querySelectorAll('select[data-nnsel]').forEach((sel) => {
    let last = sel.value;
    sel.addEventListener('change', () => {
      if (sel.value !== '__add') { last = sel.value; onPick(sel.value, sel.selectedOptions[0]?.dataset.grp); return; }
      sel.value = last;
      addPersonDialog(branchId, grp0(), (p) => {
        people.push({ ...p, active: 1 }); sel.innerHTML = str(opts(people, p.name)); sel.value = p.name; last = p.name; onPick(p.name, p.grp);
      });
    });
  });
}

function addPersonDialog(branchId, grp, onDone) {
  const d = dialog(html`<form class="stack" style="gap:10px;width:min(420px, calc(100vw - 56px))"><h2 style="margin:0">Thêm người nợ</h2>
    <label class="field"><span>Tên người nợ</span><input class="input" name="pname" autocomplete="off" placeholder="vd: Anh Thắng xe ôm"></label>
    <label class="field"><span>Số điện thoại (không bắt buộc)</span><input class="input" name="pphone" inputmode="tel" autocomplete="off"></label>
    <label class="field"><span>Nhóm công nợ</span><select class="input" name="pgrp">${Object.entries(GRP_NO).map(([k, l]) => html`<option value="${k}" ${k === grp ? 'selected' : ''}>${l}</option>`)}</select></label>
    <div class="nn-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Thêm</button></div></form>`);
  const f = d.querySelector('form');
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = f.pname.value.trim(), phone = f.pphone.value.trim(), g = f.pgrp.value;
    try {
      if (!name) throw new Error('Nhập tên người nợ.');
      const id = await rpc('app_stc_person_save', { p_id: null, p: { branch_id: Number(branchId), name, phone, grp: g, active: true } });
      d.close(); onDone({ id, name, grp: g, phone: phone || null });
    } catch (e) { d.querySelector('.nn-err').innerHTML = str(html`<div class="alert error">${e.message || e}</div>`); }
  });
}
