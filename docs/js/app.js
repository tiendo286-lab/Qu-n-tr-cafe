// Lõi trang web: phiên đăng nhập, menu theo quyền, chuyển trang (dùng #/duong-dan vì GitHub Pages là trang tĩnh).
import { focusWeek, notifyTick, unreadCount } from './data.js';
import { rpc, sb, viError } from './sb.js';
import { ROLE_LABELS, esc, go, html, str, takeFlash } from './ui.js';

// Menu quản lý: [nhóm, nhãn, đường dẫn, quyền cần, đã có ở bản mới chưa]
export const MENU = [
  ['QUẢN LÝ CA', 'Chốt ca', '/ca', 'chot_ca'],
  ['QUẢN LÝ CA', 'Đối soát', '/quan-ly/doi-soat', 'doi_soat'],
  ['XẾP LỊCH', 'Order lịch làm', '/quan-ly/order', 'xem_tat_ca'],
  ['XẾP LỊCH', 'Lịch cố định', '/quan-ly/lich-co-dinh', 'sua_danh_muc'],
  ['XẾP LỊCH', 'Xếp lịch làm tổng', '/quan-ly/lich-tong', 'bao_cao'],
  ['XẾP LỊCH', 'Lịch cơ sở', '/quan-ly/lich-co-so', 'xem_tat_ca'],
  ['XẾP LỊCH', 'Cảnh báo', '/quan-ly/canh-bao', 'xep_lich'],
  ['HOÀN TẤT', 'Chốt lịch & báo cáo', '/quan-ly/bao-cao', 'bao_cao'],
  ['THIẾT LẬP', 'Định biên', '/quan-ly/dinh-bien', 'sua_danh_muc'],
  ['THIẾT LẬP', 'Chi nhánh, ca & vai trò', '/quan-ly/chi-nhanh', 'sua_danh_muc'],
  ['THIẾT LẬP', 'Nhân viên', '/quan-ly/nhan-vien', 'quan_ly_nhan_vien'],
  ['THIẾT LẬP', 'Giờ order', '/quan-ly/gio-order', 'cai_gio_order'],
  ['THIẾT LẬP', 'Tài khoản đăng nhập', '/quan-ly/tai-khoan', 'quan_ly_nhan_vien'],
  ['THIẾT LẬP', 'Phân quyền', '/quan-ly/phan-quyen', 'phan_quyen'],
  ['THIẾT LẬP', 'Dữ liệu & sao lưu', '/quan-ly/du-lieu', 'du_lieu'],
  ['CÁ NHÂN', 'Order ca của tôi', '/order', 'order_ca'],
  ['CÁ NHÂN', 'Lịch của tôi', '/lich', 'xem_lich_minh'],
  ['CÁ NHÂN', 'Thông báo', '/thong-bao', 'xem_lich_minh'],
];

// Trang đã làm ở bản mới: đường dẫn → file trong js/pages
const PAGES = {
  '/dang-nhap': 'dang_nhap',
  '/doi-mat-khau': 'doi_mat_khau',
  '/': 'tong_quan',
  '/order': 'order_nv',
  '/lich': 'lich',
  '/thong-bao': 'thong_bao',
  '/ca': 'chot_ca',
  '/ca/phieu': 'phieu_ca',
  '/quan-ly/doi-soat': 'doi_soat',
  '/quan-ly/order': 'order_ql',
  '/quan-ly/lich-co-dinh': 'lich_co_dinh',
  '/quan-ly/lich-tong': 'lich_tong',
  '/quan-ly/lich-co-so': 'lich_co_so',
  '/quan-ly/canh-bao': 'canh_bao',
  '/quan-ly/bao-cao': 'bao_cao',
  '/quan-ly/dinh-bien': 'dinh_bien',
  '/quan-ly/chi-nhanh': 'chi_nhanh',
  '/quan-ly/nhan-vien': 'nhan_vien',
  '/quan-ly/gio-order': 'gio_order',
  '/quan-ly/tai-khoan': 'tai_khoan',
  '/quan-ly/phan-quyen': 'phan_quyen',
  '/quan-ly/du-lieu': 'du_lieu',
};

export const state = { me: null, unread: 0, warn: 0 };
const root = () => document.getElementById('root');

export function can(p) { return !!state.me?.perms?.[p]; }
export function isManager() { return ['chu', 'ql_tong', 'ql'].includes(state.me?.role); }

export async function loadMe() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { state.me = null; return null; }
  try {
    state.me = await rpc('app_me');
  } catch (e) {
    state.me = null;
  }
  if (!state.me) await sb.auth.signOut();
  return state.me;
}

export async function logout() {
  await sb.auth.signOut();
  state.me = null;
  go('/dang-nhap');
}

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function menuHtml(path) {
  const groups = [];
  for (const [g, label, href, perm] of MENU) {
    if (!can(perm)) continue;
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] });
    const badge = href === '/thong-bao' ? state.unread : href === '/quan-ly/canh-bao' ? state.warn : 0;
    groups[groups.length - 1].items.push({ label, href, badge, active: path.startsWith(href) });
  }
  return groups.map((g) => html`<div class="group">${g.name}</div>${g.items.map((it) => html`
    <a class="item ${it.active ? 'active' : ''}" href="#${it.href}">
      <span>${it.label}${it.badge ? html` <span class="badge">${it.badge}</span>` : ''}</span></a>`)}`);
}

function layout(path, body, flashMsg) {
  const me = state.me;
  const alert = flashMsg ? html`<div class="alert ${flashMsg.kind}" role="status">${flashMsg.message}</div>` : '';
  if (!me) {
    return html`<div class="auth"><div class="auth-hero">
      <div class="logo" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 18h6"/></svg></div>
      <div class="name">Quản trị lịch làm</div><div class="tag">Milano Coffee · Lela Cafe</div></div>${alert}${body}</div>`;
  }
  if (isManager()) {
    return html`<div class="layout">
      <nav class="sidebar" aria-label="Menu">
        <div class="brand">Quản trị lịch làm</div>
        <div class="who">${me.code} – ${me.name} · ${ROLE_LABELS[me.role]}</div>
        <details class="navd" open><summary>☰ Menu</summary>
        <div class="nav">
          <a class="item ${path === '/' ? 'active' : ''}" href="#/">Tổng quan</a>
          ${me.must_change ? '' : menuHtml(path)}
        </div>
        <div class="bottom">
          <a href="#/doi-mat-khau">Đổi mật khẩu</a>
          <button type="button" data-logout>Đăng xuất</button>
        </div></details>
      </nav>
      <main class="main">${alert}${body}</main></div>`;
  }
  return html`<div class="mobile">
    <header class="appbar"><div class="row"><div>
      <div class="t1">${me.code} – ${me.name}</div><div class="t2">Lịch làm</div></div>
      <a class="bell" href="#/thong-bao" aria-label="Thông báo${state.unread ? `, ${state.unread} chưa đọc` : ''}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
        ${state.unread ? html`<span class="bell-n">${state.unread}</span>` : ''}</a></div></header>
    <div class="content">${alert}${body}
      <div class="m-foot"><a href="#/doi-mat-khau">Đổi mật khẩu</a><button type="button" data-logout>Đăng xuất</button></div>
    </div>
    <nav class="tabbar" aria-label="Menu nhân viên">
      <a class="${path === '/order' ? 'on' : ''}" href="#/order">Order ca</a>
      <a class="${path.startsWith('/lich') ? 'on' : ''}" href="#/lich">Lịch làm</a>
      ${can('chot_ca') ? html`<a class="${path.startsWith('/ca') ? 'on' : ''}" href="#/ca">Chốt ca</a>` : ''}
    </nav></div>`;
}

function notFound() {
  return { title: 'Không tìm thấy', html: html`<div class="card">Đường dẫn không đúng. <a href="#/">Về trang chủ</a></div>` };
}

// Số chưa đọc + số cảnh báo (tối đa 1 lần/phút)
let badgeAt = 0;
async function refreshBadges() {
  if (!state.me || state.me.must_change || Date.now() - badgeAt < 60000) return;
  badgeAt = Date.now();
  await notifyTick();
  try { state.unread = await unreadCount(state.me.account_id); } catch (_) { /* bỏ qua */ }
  if (can('xep_lich')) {
    try {
      const w = await focusWeek();
      if (w) { const { computeWarnings, warnTotal } = await import('./warnings.js'); state.warn = warnTotal(await computeWarnings(w)); } else state.warn = 0;
    } catch (_) { /* bỏ qua */ }
  }
}

let cleanup = null;
let renderSeq = 0;
export async function render() {
  const seq = ++renderSeq;
  const { path, params } = parseHash();
  const me = state.me;
  if (!me && path !== '/dang-nhap') return go('/dang-nhap');
  if (me && path === '/dang-nhap') return go('/');
  if (me && me.must_change && path !== '/doi-mat-khau') return go('/doi-mat-khau');
  if (path === '/' && me && !isManager()) return go('/order');
  if (cleanup) { try { cleanup(); } catch (_) { /* bỏ qua */ } cleanup = null; }
  if (me) await refreshBadges();

  let page;
  const mod = PAGES[path];
  try {
    if (mod) {
      const m = await import(`./pages/${mod}.js`);
      if (m.perm && !can(m.perm)) page = { title: 'Không có quyền', html: html`<div class="card">Bạn không có quyền vào trang này.</div>` };
      else page = await m.render({ params, me: state.me, can });
    } else {
      page = notFound();
    }
  } catch (e) {
    console.error(e);
    page = { title: 'Lỗi', html: html`<div class="alert error">${viError(e)}</div>` };
  }
  if (seq !== renderSeq) return; // người dùng đã chuyển trang khác
  document.title = `${page.title || 'Quản trị lịch làm'} · Lịch làm`;
  root().innerHTML = str(layout(path, page.html, takeFlash()));
  const nav = document.querySelector('details.navd');
  if (nav && window.matchMedia('(max-width: 900px)').matches) nav.open = false;
  document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', logout));
  if (page.mount) {
    try { const c = await page.mount(root()); if (typeof c === 'function') cleanup = c; } catch (e) { console.error(e); alert(viError(e)); }
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && state.me) { state.me = null; go('/dang-nhap'); }
});

(async () => {
  await loadMe();
  render();
})();

export { esc };
