// Lõi trang web: phiên đăng nhập, menu theo quyền, chuyển trang (dùng #/duong-dan vì GitHub Pages là trang tĩnh).
import { focusWeek, notifyTick, unreadCount } from './data.js';
import { rpc, sb, viError } from './sb.js';
import { ROLE_LABELS, dialog, esc, go, html, str, takeFlash } from './ui.js';

// Menu quản lý (phương án A): mỗi mục là 1 trang có các tab con.
// [nhãn mục, [[tên tab, đường dẫn, quyền cần (null = ai cũng có; mảng = có 1 trong các quyền)], ...], tham số giữ lại khi chuyển tab]
export const HUBS = [
  ['Quản lý ca', [['Chốt ca', '/ca', 'chot_ca'], ['Đối soát', '/quan-ly/doi-soat', 'doi_soat']], 'ngay'],
  ['Xếp lịch tuần', [['Order', '/quan-ly/order', 'xem_tat_ca'], ['Lịch cơ sở', '/quan-ly/lich-co-so', 'xem_tat_ca'], ['Lịch tổng', '/quan-ly/lich-tong', 'bao_cao'],
    ['Cảnh báo', '/quan-ly/canh-bao', 'xep_lich'], ['Chốt & báo cáo', '/quan-ly/bao-cao', 'bao_cao']], 'tuan'],
  ['Công việc', [['Giao việc', '/quan-ly/giao-viec', 'hop_giao_viec'], ['Việc của tôi', '/viec', 'nhan_viec'], ['Họp', '/quan-ly/hop', 'hop_giao_viec']]],
  ['Nhân viên', [['Nhân viên', '/quan-ly/nhan-vien', ['quan_ly_nhan_vien', 'dao_tao']]]],
  ['Nội quy & quy trình', [['Nội quy', '/noi-quy', null], ['Quy trình', '/quy-trinh', null]]],
  ['Hỗ trợ', [['Yêu cầu hỗ trợ', '/ho-tro', null]]],
  ['Cài đặt xếp lịch', [['Định biên', '/quan-ly/dinh-bien', 'sua_danh_muc'], ['Chi nhánh, ca & vai trò', '/quan-ly/chi-nhanh', 'sua_danh_muc'],
    ['Giờ order', '/quan-ly/gio-order', 'cai_gio_order'], ['Lịch cố định', '/quan-ly/lich-co-dinh', 'sua_danh_muc']]],
  ['Tài khoản & phân quyền', [['Tài khoản đăng nhập', '/quan-ly/tai-khoan', 'quan_ly_nhan_vien'], ['Phân quyền', '/quan-ly/phan-quyen', 'phan_quyen']]],
  ['Dữ liệu & sao lưu', [['Dữ liệu & sao lưu', '/quan-ly/du-lieu', 'du_lieu']]],
  ['Của tôi', [['Order ca', '/order', 'order_ca'], ['Lịch của tôi', '/lich', 'xem_lich_minh'], ['Phiếu đào tạo', '/cua-toi/dao-tao', null]]],
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
  '/quan-ly/hop': 'hop',
  '/quan-ly/hop/chi-tiet': 'hop_chi_tiet',
  '/viec': 'viec',
  '/quan-ly/giao-viec': 'giao_viec',
  '/noi-quy': 'tai_lieu',
  '/quy-trinh': 'tai_lieu',
  '/tai-lieu/soan': 'soan_tai_lieu',
  '/dao-tao/phieu': 'phieu_dao_tao',
  '/cua-toi/dao-tao': 'dao_tao_cua_toi',
  '/ho-tro': 'ho_tro',
  '/ho-tro/chi-tiet': 'ho_tro_chi_tiet',
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

export const state = { me: null, unread: 0, warn: 0, tasks: 0, review: 0, remind: null, support: 0 };
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
  state.me = null; state.remind = null; state.tasks = 0; state.review = 0; state.support = 0; badgeAt = 0;
  try { sessionStorage.removeItem('nhac_viec'); } catch (_) { /* bỏ qua */ }
  go('/dang-nhap');
}

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

const allowedTab = (perm, href) => (!perm || [].concat(perm).some((p) => can(p))) && !(href === '/viec' && state.me?.role === 'chu'); // Chủ là người giao việc
const onPath = (path, href) => path === href || path.startsWith(href + '/');
const visibleTabs = (tabs) => tabs.filter(([, href, perm]) => allowedTab(perm, href));
const badges = () => ({ '/thong-bao': state.unread, '/quan-ly/canh-bao': state.warn, '/viec': state.tasks, '/ho-tro': state.support });

function menuHtml(path) {
  const b = badges();
  return HUBS.map(([label, all]) => {
    const tabs = visibleTabs(all);
    if (!tabs.length) return '';
    const n = tabs.reduce((sum, [, href]) => sum + (b[href] || 0), 0);
    const active = tabs.some(([, href]) => onPath(path, href));
    return html`<a class="item ${active ? 'active' : ''}" href="#${tabs[0][1]}"><span>${label}${n ? html` <span class="badge">${n}</span>` : ''}</span></a>`;
  });
}

// Thanh tab con ở đầu trang (chỉ hiện khi mục có từ 2 tab trở lên)
function hubTabs(path, params) {
  for (const [label, all, keepKey] of HUBS) {
    const tabs = visibleTabs(all);
    if (!tabs.some(([, href]) => onPath(path, href))) continue;
    if (tabs.length < 2) return '';
    const keep = keepKey && params[keepKey] ? `?${keepKey}=${encodeURIComponent(params[keepKey])}` : '';
    const b = badges();
    return html`<nav class="hub-tabs" aria-label="${label}">${tabs.map(([l, href]) => html`<a class="${onPath(path, href) ? 'on' : ''}" href="#${href}${keep}">${l}${b[href] ? html` <span class="badge">${b[href]}</span>` : ''}</a>`)}</nav>`;
  }
  return '';
}

const BELL = html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>`;

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
        <div class="brand-row"><div class="brand">Quản trị lịch làm</div>
          <a class="sb-bell ${path === '/thong-bao' ? 'on' : ''}" href="#/thong-bao" title="Thông báo" aria-label="Thông báo${state.unread ? `, ${state.unread} chưa đọc` : ''}">${BELL}${state.unread ? html`<span class="bell-n">${state.unread}</span>` : ''}</a></div>
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
      <div class="m-foot"><a href="#/cua-toi/dao-tao">Phiếu đào tạo</a><a href="#/quy-trinh">Quy trình</a><a href="#/doi-mat-khau">Đổi mật khẩu</a><button type="button" data-logout>Đăng xuất</button></div>
    </div>
    <nav class="tabbar" aria-label="Menu nhân viên">
      <a class="${path === '/order' ? 'on' : ''}" href="#/order">Order ca</a>
      <a class="${path.startsWith('/lich') ? 'on' : ''}" href="#/lich">Lịch làm</a>
      <a class="${path === '/viec' ? 'on' : ''}" href="#/viec">Việc${state.tasks ? html` <span class="badge">${state.tasks}</span>` : ''}</a>
      ${can('chot_ca') ? html`<a class="${path.startsWith('/ca') ? 'on' : ''}" href="#/ca">Chốt ca</a>` : ''}
      <a class="${path === '/noi-quy' || path === '/quy-trinh' ? 'on' : ''}" href="#/noi-quy">Nội quy</a>
      <a class="${path.startsWith('/ho-tro') ? 'on' : ''}" href="#/ho-tro">Hỗ trợ${state.support ? html` <span class="badge">${state.support}</span>` : ''}</a>
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
  try { state.support = await rpc('app_ht_unread'); } catch (_) { /* bỏ qua */ }
  if (can('nhan_viec') || can('hop_giao_viec')) {
    try { state.remind = await rpc('app_viec_reminder'); state.tasks = state.remind.open; } catch (_) { /* bỏ qua */ }
  }
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
      if (m.perm && ![].concat(m.perm).some((p) => can(p))) page = { title: 'Không có quyền', html: html`<div class="card">Bạn không có quyền vào trang này.</div>` };
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
  const tabsBar = state.me && isManager() && !state.me.must_change ? hubTabs(path, params) : '';
  root().innerHTML = str(layout(path, html`${tabsBar}${page.html}`, takeFlash()));
  const nav = document.querySelector('details.navd');
  if (nav && window.matchMedia('(max-width: 900px)').matches) nav.open = false;
  document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', logout));
  if (page.mount) {
    try { const c = await page.mount(root()); if (typeof c === 'function') cleanup = c; } catch (e) { console.error(e); alert(viError(e)); }
  }
  window.scrollTo(0, 0);
  // điện thoại: cuộn thanh tab con để thấy tab đang mở
  const onTab = document.querySelector('.hub-tabs a.on');
  if (onTab) { const bar = onTab.parentElement; bar.scrollLeft = onTab.offsetLeft - (bar.clientWidth - onTab.offsetWidth) / 2; }
  remindOnce(path);
}

// Nhắc việc mỗi khi mở app (một lần mỗi phiên): quá hạn → hôm nay → còn lại
function remindOnce(path) {
  const r = state.remind;
  if (!r || !['ql_tong', 'ql', 'nv'].includes(state.me?.role) || path === '/viec' || path === '/doi-mat-khau') return;
  try { if (sessionStorage.getItem('nhac_viec')) return; sessionStorage.setItem('nhac_viec', '1'); } catch (_) { return; }
  if (!r.items.length) return;
  const g = (k) => r.items.filter((t) => t.group === k);
  const dd = (d) => (d ? d.split('-').reverse().slice(0, 2).join('/') : 'chưa có hạn');
  const list = (items, color) => html`${items.map((t) => html`<li style="color:${color}">${t.kind === 'dao_tao' ? '[Đào tạo] ' : ''}${t.content} <span style="font-size:12px;color:var(--muted)">· ${t.due_date ? 'hạn ' + dd(t.due_date) : 'không đặt hạn'}</span></li>`)}`;
  const sec = (title, items, color) => (items.length ? html`<div><strong style="color:${color}">${title} (${items.length})</strong><ul style="margin:4px 0 0;padding-left:20px">${list(items, color)}</ul></div>` : '');
  const d = dialog(html`<div class="stack" style="gap:10px;max-width:520px">
    <h2 style="margin:0">Việc được giao cho bạn</h2>
    ${sec('Quá hạn', g('overdue'), '#b91c1c')}${sec('Đến hạn hôm nay', g('today'), '#b45309')}${sec('Việc còn lại chưa xử lý xong', g('open'), 'var(--ink)')}
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" id="rm-close">Để sau</button><a class="btn" href="#/viec" id="rm-go">Mở Việc của tôi</a></div></div>`);
  d.querySelector('#rm-close').addEventListener('click', () => d.close());
  d.querySelector('#rm-go').addEventListener('click', () => d.close());
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
