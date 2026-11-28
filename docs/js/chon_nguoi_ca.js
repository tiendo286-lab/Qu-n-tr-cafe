// Chọn người thêm vào ca (tệp 202, anh Tiến duyệt 28/11/2026): 3 loại — Nhân viên trong quán · Nhân viên cũ · Người ngoài.
// Dùng chung cho hộp "Thêm người hỗ trợ" (trang đối soát ca) và "Thêm người vào ca" (bảng Nghỉ & làm thay).
// Người ngoài là hồ sơ gọn (không tài khoản); "+ Người ngoài mới…" tạo ngay khi bấm Lưu.
import { rpc } from './sb.js';
import { html, str } from './ui.js';

let HELP = null;
// Danh sách 3 nhóm; nhớ lại trong phiên. Máy chủ cũ chưa có nhóm người ngoài → coi như rỗng.
export async function loadHelpers() {
  if (!HELP) { const h = (await rpc('app_ca_helpers')) || {}; HELP = { active: h.active || [], former: h.former || [], outside: h.outside || [] }; }
  return HELP;
}
export async function addOutsider(name, phone) {
  const e = await rpc('app_ca_outsider_add', { p_name: name, p_phone: phone || null });
  if (HELP && !HELP.outside.some((x) => Number(x.id) === Number(e.id))) HELP.outside.push(e);
  return e;
}

export const pickerHtml = () => html`<label class="field"><span>Loại người</span><select class="input" name="loai">
    <option value="in">Nhân viên trong quán</option><option value="old">Nhân viên cũ</option><option value="out">Người ngoài</option></select></label>
  <label class="field"><span>Người làm</span><select class="input" name="emp"></select></label>
  <div data-ngoai-moi hidden><label class="field"><span>Tên người ngoài</span><input class="input" name="ngoai_ten" maxlength="60" autocomplete="off" placeholder="vd: Anh Nam (bạn của quản lý)"></label>
    <label class="field"><span>Số điện thoại (không bắt buộc)</span><input class="input" name="ngoai_sdt" inputmode="tel" maxlength="20" autocomplete="off"></label></div>`;

// have: mã người đã có trong ca (không hiện lại); branchId: người của cơ sở này xếp lên trước.
export function wirePicker(form, helpers, have, branchId) {
  const loai = form.elements.loai, emp = form.elements.emp, box = form.querySelector('[data-ngoai-moi]');
  const opt = (e) => html`<option value="${e.id}">${e.code ? e.code + ' – ' : ''}${e.name || ''}</option>`;
  const fill = () => {
    const pool = (loai.value === 'old' ? helpers.former : loai.value === 'out' ? helpers.outside : helpers.active).filter((e) => !have.has(Number(e.id)));
    const mine = pool.filter((e) => (e.branches || []).includes(branchId)), other = pool.filter((e) => !(e.branches || []).includes(branchId));
    emp.innerHTML = str(html`<option value="">${pool.length || loai.value === 'out' ? '— Chọn —' : '— Không còn ai để thêm —'}</option>
      ${loai.value === 'out' ? html`<option value="moi">+ Người ngoài mới…</option>` : ''}${[...mine, ...other].map(opt)}`);
    if (loai.value === 'out' && !pool.length) emp.value = 'moi';
    sync();
  };
  const sync = () => { box.hidden = !(loai.value === 'out' && emp.value === 'moi'); };
  loai.addEventListener('change', fill); emp.addEventListener('change', sync);
  fill();
}

// Mã người được chọn; "+ Người ngoài mới…" thì tạo (hoặc dùng lại người trùng tên) rồi trả mã.
export async function pickedId(form, have) {
  const v = form.elements.emp.value;
  if (!v) throw new Error('Chọn người làm.');
  if (v !== 'moi') return Number(v);
  const name = form.elements.ngoai_ten.value.trim();
  if (!name) throw new Error('Ghi tên người ngoài.');
  const e = await addOutsider(name, form.elements.ngoai_sdt.value.trim());
  if (have && have.has(Number(e.id))) throw new Error(`${e.name} đã có trong ca này.`);
  return Number(e.id);
}
