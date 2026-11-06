// Lõi trang web: phiên đăng nhập, menu theo quyền, chuyển trang (dùng #/duong-dan vì GitHub Pages là trang tĩnh).
import { rpc, sb, viError } from './sb.js';
import { ROLE_LABELS, esc, go, html, str, takeFlash } from './ui.js';

// Menu quản lý: [nhóm, nhãn, đường dẫn, quyền cần, đã có ở bản mới chưa]
export const MENU = [
  ['XẾP LỊCH', 'Order lịch làm', '/quan-ly/order', 'xem_tat_ca', false],
  ['XẾP LỊCH', 'Lịch cố định', '/quan-ly/lich-co-dinh', 'sua_danh_muc', false],
  ['XẾP LỊCH', 'Xếp lịch làm tổng', '/quan-ly/lich-tong', 'bao_cao', false],
  ['XẾP LỊCH', 'Lịch cơ sở', '/quan-ly/lich-co-so', 'xem_tat_ca', false],
  ['XẾP LỊCH', 'Cảnh báo', '/quan-ly/canh-bao', 'xep_lich', false],
  ['HOÀN TẤT', 'Chốt lịch & báo cáo', '/quan-ly/bao-cao', 'bao_cao', false],
  ['NHÂN SỰ', 'Đánh giá nhân viên', '/quan-ly/danh-gia', 'danh_gia', false],
  ['THIẾT LẬP', 'Định biên', '/quan-ly/dinh-bien', 'sua_danh_muc', false],
  ['THIẾT LẬP', 'Chi nhánh, ca & vai trò', '/quan-ly/chi-nhanh', 'sua_danh_muc', false],
  ['THIẾT LẬP', 'Nhân viên', '/quan-ly/nhan-vien', 'quan_ly_nhan_vien', false],
  ['THIẾT LẬP', 'Giờ order', '/quan-ly/gio-order', 'cai_gio_order', false],
  ['THIẾT LẬP', 'Tài khoản đăng nhập', '/quan-ly/tai-khoan', 'quan_ly_nhan_vien', true],
  ['THIẾT LẬP', 'Phân quyền', '/quan-ly/phan-quyen', 'phan_quyen', true],
  ['THIẾT LẬP', 'Dữ liệu & sao lưu', '/quan-ly/du-lieu', 'du_lieu', true],
  ['CÁ NHÂN', 'Order ca của tôi', '/order', 'order_ca', false],
  ['CÁ NHÂN', 'Lịch của tôi', '/lich', 'xem_lich_minh', false],
  ['CÁ NHÂN', 'Thông báo', '/thong-bao', 'xem_lich_minh', false],
];

// Trang đã làm ở bản mới: đường dẫn → file trong js/pages
const PAGES = {
  '/dang-nhap': 'dang_nhap',
  '/doi-mat-khau': 'doi_mat_khau',
  '/': 'tong_quan',
  '/quan-ly/tai-khoan': 'tai_khoan',
  '/quan-ly/phan-quyen': 'phan_quyen',
  '/quan-ly/du-lieu': 'du_lieu',
};

export const state = { me: null };
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
  for (const [g, label, href, perm, ready] of MENU) {
    if (!can(perm)) continue;
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] });
    groups[groups.length - 1].items.push({ label, href, ready, active: path.startsWith(href) });
  }
  return groups.map((g) => html`<div class="group">${g.name}</div>${g.items.map((it) => html`
    <a class="item ${it.active ? 'active' : ''} ${it.ready ? '' : 'notready'}" href="#${it.href}">
      <span>${it.label}</span>${it.ready ? '' : html`<span class="soon">sắp có</span>`}</a>`)}`);
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
      <div class="t1">${me.code} – ${me.name}</div><div class="t2">Lịch làm</div></div></div></header>
    <div class="content">${alert}${body}
      <div class="m-foot"><a href="#/doi-mat-khau">Đổi mật khẩu</a><button type="button" data-logout>Đăng xuất</button></div>
    </div>
    <nav class="tabbar" aria-label="Menu nhân viên">
      <a class="${path === '/order' ? 'on' : ''}" href="#/order">Order ca</a>
      <a class="${path.startsWith('/lich') ? 'on' : ''}" href="#/lich">Lịch làm</a>
    </nav></div>`;
}

function soonPage(path) {
  const item = MENU.find((m) => m[2] === path);
  return {
    title: item ? item[1] : 'Không tìm thấy',
    html: html`<div class="page-head"><div><h1>${item ? item[1] : 'Không tìm thấy trang'}</h1></div></div>
      <div class="card">${item
        ? 'Màn hình này đang được chuyển sang bản web mới (GitHub Pages + Supabase) và sẽ có ở các bước tiếp theo. Trong lúc chờ, vẫn dùng được bản cũ chạy trên máy tính.'
        : 'Đường dẫn không đúng.'} <a href="#/">Về Tổng quan</a></div>`,
  };
}

let renderSeq = 0;
export async function render() {
  const seq = ++renderSeq;
  const { path, params } = parseHash();
  const me = state.me;
  if (!me && path !== '/dang-nhap') return go('/dang-nhap');
  if (me && path === '/dang-nhap') return go('/');
  if (me && me.must_change && path !== '/doi-mat-khau') return go('/doi-mat-khau');

  let page;
  const mod = PAGES[path];
  try {
    if (mod) {
      const m = await import(`./pages/${mod}.js`);
      if (m.perm && !can(m.perm)) page = { title: 'Không có quyền', html: html`<div class="card">Bạn không có quyền vào trang này.</div>` };
      else page = await m.render({ params, me: state.me, can });
    } else {
      page = soonPage(path);
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
    try { await page.mount(root()); } catch (e) { console.error(e); alert(viError(e)); }
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
