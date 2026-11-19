// 👁 Xem như người khác (bước 165) — chỉ Chủ. Chọn một người → web hiện y như người đó thấy (menu, nút, cơ sở, số liệu), chỉ xem.
// Máy chủ (tệp 145): app_view_as_people / app_view_as_start / app_view_as_stop; phiên đang xem như thì CSDL chỉ đọc. Dải vàng + khung điện thoại ở app.js.
import { rpc } from '../sb.js';
import { ROLE_LABELS, dialog, html, once, showSaved } from '../ui.js';

export const perm = 'phan_quyen';   // chỉ Chủ có quyền này (app_can)
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const ORDER = ['ql_tong', 'ql', 'ke_toan', 'nv'];

function peopleList(people) {
  return ORDER.map((r) => { const ps = people.filter((p) => p.role === r); if (!ps.length) return '';
    return html`<section class="va-group"><h3>${ROLE_LABELS[r] || r} · ${ps.length}</h3>${ps.map((p) => html`<div class="va-row" data-q="${fold([p.name, p.code, ROLE_LABELS[p.role], ...(p.branches || []), p.ke_toan ? 'ke toan' : ''].join(' '))}">
      <span><b>${p.name}</b> <small class="st-meta">${p.code || ''}${(p.branches || []).length ? ' · ' + p.branches.join(', ') : ''}${p.ke_toan ? ' · có thêm quyền Kế toán' : ''}</small></span>
      <button type="button" class="btn sm" data-vapick="${p.account_id}">👁 Xem như</button></div>`)}</section>`; });
}

// Bắt đầu / đổi người → về Việc hôm nay của người đó, tải lại để mọi phần đọc lại quyền
async function start(id) { await rpc('app_view_as_start', { p_account: Number(id) }); try { localStorage.setItem('vaStamp', String(Date.now())); } catch (_) { /* bỏ qua */ } location.hash = '#/hom-nay'; location.reload(); }

function bind(el) {
  el.querySelector('.va-q')?.addEventListener('input', (e) => { const q = fold(e.target.value).trim(); el.querySelectorAll('.va-row').forEach((r) => { r.hidden = !!q && !r.dataset.q.includes(q); }); });
  el.addEventListener('click', once(async (ev) => { const b = ev.target.closest('[data-vapick]'); if (!b) return; try { await start(b.dataset.vapick); } catch (e) { showSaved(e.message || String(e), true); } }));
}

const body = (people) => html`<input class="input va-q" type="search" placeholder="Tìm tên, mã, vai, cơ sở… (gõ không dấu được)" aria-label="Tìm người">${peopleList(people)}`;

export async function render() {
  const people = await rpc('app_view_as_people');
  return {
    title: 'Xem như người khác',
    html: html`<div class="page-head"><h1>👁 Xem như người khác</h1></div>
      <div class="card stack va-page" style="gap:10px"><div class="st-meta">Chọn một người để thấy đúng màn hình của họ — menu, nút, cơ sở được giao, số liệu, trang "Của tôi". <b>Chỉ xem</b>: không lưu được gì. Tự thoát sau 30 phút. Đổi khung Máy tính / Điện thoại ở dải vàng trên cùng.</div>
        ${body(people)}</div>`,
    mount(root) { bind(root.querySelector('.va-page')); },
  };
}

// Nút "Đổi người" ở dải vàng (dùng được cả khi đang xem như — máy chủ cho phép riêng lệnh này)
export async function pickPerson() {
  let people;
  try { people = await rpc('app_view_as_people'); } catch (e) { showSaved(e.message || String(e), true); return; }
  const d = dialog(html`<div class="stack va-page" style="gap:10px"><h2 style="margin:0">👁 Đổi người đang xem như</h2>${body(people)}
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  bind(d.querySelector('.va-page'));
}
