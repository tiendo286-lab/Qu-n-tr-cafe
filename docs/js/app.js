// Lõi trang web: phiên đăng nhập, menu theo quyền, chuyển trang (dùng #/duong-dan vì GitHub Pages là trang tĩnh).
import { addDays, focusWeek, notifyTick, unreadCount, vnToday, weekStart } from './data.js';
import { rpc, sb, viError } from './sb.js';
import { ROLE_LABELS, dialog, esc, go, html, str, takeFlash } from './ui.js';

// Menu quản lý (phương án C, 11/11/2026): các mục chia theo nhóm có tiêu đề (Vận hành · Tiền · Nhân sự · Hệ thống).
// [nhãn mục, [[tên tab, đường dẫn, quyền cần (null = ai cũng có; mảng = có 1 trong các quyền)], ...], tham số giữ lại khi chuyển tab, nhóm]
export const HUBS = [
  ['Quản lý ca', [['Chốt ca', '/ca', 'chot_ca'], ['Đối soát', '/quan-ly/doi-soat', 'doi_soat'], ['Thu chi', '/quan-ly/thu-chi', 'doi_soat']], 'ngay', 'Vận hành'],
  ['Xếp lịch tuần', [['Order', '/quan-ly/order', 'xem_tat_ca'], ['Lịch cơ sở', '/quan-ly/lich-co-so', 'xem_tat_ca'], ['Lịch tổng', '/quan-ly/lich-tong', 'bao_cao'],
    ['Cảnh báo', '/quan-ly/canh-bao', 'xep_lich'], ['Chốt & báo cáo', '/quan-ly/bao-cao', 'bao_cao']], 'tuan', 'Vận hành'],
  ['Công việc', [['Công việc', '/quan-ly/giao-viec', 'hop_giao_viec'], ['Việc của tôi', '/viec', 'nhan_viec']], null, 'Vận hành'],
  ['Sổ quỹ & chốt tháng', [['Sổ quỹ', '/quan-ly/so-quy', 'chot_thang'], ['Chốt tháng', '/quan-ly/chot-thang', 'chot_thang']], 'thang', 'Tiền'],
  ['Kế toán', [['Hóa đơn giao hàng', '/ke-toan/hoa-don', ['ke_toan', 'doi_soat']], ['Chuyển khoản thực nhận', '/ke-toan/chuyen-khoan', 'ke_toan']], null, 'Tiền'],
  ['Nhân viên & tài khoản', [['Nhân viên', '/quan-ly/nhan-vien', ['quan_ly_nhan_vien', 'dao_tao']], ['Đánh giá', '/quan-ly/danh-gia', 'doi_soat'], ['Phân quyền', '/quan-ly/phan-quyen', 'phan_quyen']], null, 'Nhân sự'],
  ['Nội quy & quy trình', [['Nội quy', '/noi-quy', null], ['Quy trình', '/quy-trinh', null]], null, 'Nhân sự'],
  ['Cài đặt xếp lịch', [['Định biên', '/quan-ly/dinh-bien', 'sua_danh_muc'], ['Chi nhánh, ca & vai trò', '/quan-ly/chi-nhanh', 'sua_danh_muc'],
    ['Giờ order', '/quan-ly/gio-order', 'cai_gio_order'], ['Lịch cố định', '/quan-ly/lich-co-dinh', 'sua_danh_muc']], null, 'Hệ thống'],
  ['Dữ liệu & LOG', [['Dữ liệu & sao lưu', '/quan-ly/du-lieu', 'du_lieu'], ['LOG hệ thống', '/quan-ly/log', 'phan_quyen']], null, 'Hệ thống'],
  ['Hỗ trợ', [['Yêu cầu hỗ trợ', '/ho-tro', null]], null, 'Hệ thống'],
  ['Của tôi', [['Order ca', '/order', 'order_ca'], ['Lịch của tôi', '/lich', 'xem_lich_minh'], ['Phiếu đào tạo', '/cua-toi/dao-tao', null], ['Công của tôi', '/cua-toi/cong', null], ['Điểm đánh giá', '/cua-toi/danh-gia', null], ['Khoản âm của tôi', '/cua-toi/khoan-am', null]], null, null],
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
  '/quan-ly/doi-soat/ca': 'doi_soat_ca',
  '/quan-ly/hop': 'giao_viec', // đường dẫn cũ (thông báo cũ) → Công việc
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
  '/quan-ly/tai-khoan': 'nhan_vien', // trang cũ đã gộp vào Nhân viên
  '/quan-ly/phan-quyen': 'phan_quyen',
  '/quan-ly/du-lieu': 'du_lieu',
  '/quan-ly/log': 'he_thong',
  '/ke-toan/hoa-don': 'ke_toan_hoa_don',
  '/ke-toan/chuyen-khoan': 'ke_toan_ck',
  '/quan-ly/thu-chi': 'thu_chi',
  '/cua-toi/khoan-am': 'khoan_am_toi',
  '/cua-toi/danh-gia': 'danh_gia_toi',
  '/cua-toi/cong': 'cong_toi',
  '/quan-ly/danh-gia': 'danh_gia',
  '/quan-ly/chot-thang': 'chot_thang',
  '/quan-ly/so-quy': 'so_quy',
};

export const state = { me: null, unread: 0, warn: 0, tasks: 0, review: 0, remind: null, support: 0, ka: 0 };
const root = () => document.getElementById('root');

export function can(p) {
  // Chốt tháng: Chủ, Quản lý tổng, Quản lý (máy chủ chỉ cho cơ sở được giao)
  if (p === 'chot_thang') return ['chu', 'ql_tong', 'ql'].includes(state.me?.role);
  return !!state.me?.perms?.[p];
}
export function isManager() { return ['chu', 'ql_tong', 'ql', 'ke_toan'].includes(state.me?.role); }

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
const badges = () => ({ '/thong-bao': state.unread, '/quan-ly/canh-bao': state.warn, '/viec': state.tasks, '/quan-ly/giao-viec': state.review, '/ho-tro': state.support, '/cua-toi/khoan-am': state.ka });

// Trang mở đầu cho quản lý khi Tổng quan đang tạm ẩn: tab đầu tiên mình có quyền
function homePath() {
  for (const [, all] of HUBS) { const tabs = visibleTabs(all); if (tabs.length) return tabs[0][1]; }
  return '/order';
}

function menuHtml(path) {
  const b = badges();
  let grp;
  return HUBS.map(([label, all, , g]) => {
    const tabs = visibleTabs(all);
    if (!tabs.length) return '';
    const n = tabs.reduce((sum, [, href]) => sum + (b[href] || 0), 0);
    const active = tabs.some(([, href]) => onPath(path, href));
    const head = g !== grp ? (grp = g, g ? html`<div class="nav-grp" role="presentation">${g}</div>` : html`<div class="nav-grp sep" role="presentation"></div>`) : '';
    return html`${head}<a class="item ${active ? 'active' : ''}" href="#${tabs[0][1]}"><span>${label}${n ? html` <span class="badge">${n}</span>` : ''}</span></a>`;
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
      <div class="logo" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg></div>
      <div class="name">Quản trị cafe</div><div class="tag">Milano Coffee · Lela Cafe</div></div>${alert}${body}</div>`;
  }
  if (isManager()) {
    return html`<div class="layout">
      <nav class="sidebar" aria-label="Menu">
        <div class="brand-row"><div class="brand">Quản trị cafe</div>
          <a class="sb-bell ${path === '/thong-bao' ? 'on' : ''}" href="#/thong-bao" title="Thông báo" aria-label="Thông báo${state.unread ? `, ${state.unread} chưa đọc` : ''}">${BELL}${state.unread ? html`<span class="bell-n">${state.unread}</span>` : ''}</a></div>
        <div class="who">${me.code} – ${me.name} · ${ROLE_LABELS[me.role]}</div>
        <details class="navd" open><summary>☰ Menu</summary>
        <div class="nav">
          ${''/* Tổng quan tạm ẩn (11/11/2026) — anh Tiến chốt lại sau khi đủ tính năng; trang tong_quan.js vẫn giữ */}
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
    <header class="appbar hero"><div class="row"><div>
      <div class="t1">${greet()}</div><div class="t2">${me.name}</div></div>
      <a class="bell" href="#/thong-bao" aria-label="Thông báo${state.unread ? `, ${state.unread} chưa đọc` : ''}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
        ${state.unread ? html`<span class="bell-n">${state.unread}</span>` : ''}</a></div>
      ${weekStrip(path)}</header>
    <div class="content">${alert}${body}
      <div class="m-foot"><a href="#/cua-toi/khoan-am">Khoản âm${state.ka ? html` <span class="badge">${state.ka}</span>` : ''}</a><a href="#/cua-toi/dao-tao">Phiếu đào tạo</a><a href="#/quy-trinh">Quy trình</a><a href="#/doi-mat-khau">Đổi mật khẩu</a><button type="button" data-logout>Đăng xuất</button></div>
    </div>
    <nav class="tabbar pillbar" aria-label="Menu nhân viên">
      <div class="tb-side">
        ${tabItem(path.startsWith('/lich'), '#/lich', 'Lịch', ICONS.lich)}
        ${tabItem(path === '/viec', '#/viec', 'Việc', ICONS.viec, state.tasks)}
        ${can('chot_ca') ? tabItem(path.startsWith('/ca'), '#/ca', 'Chốt ca', ICONS.ca) : ''}
      </div>
      <a class="tb-plus ${path === '/order' ? 'on' : ''}" href="#/order"><i class="tb-c">${ICONS.plus}</i><span>Order ca</span></a>
      <div class="tb-side">
        ${tabItem(path === '/noi-quy' || path === '/quy-trinh', '#/noi-quy', 'Nội quy', ICONS.noiquy)}
        ${tabItem(path.startsWith('/ho-tro'), '#/ho-tro', 'Hỗ trợ', ICONS.hotro, state.support)}
      </div>
    </nav></div>`;
}

// ---------- Giao diện điện thoại nhân viên (mẫu: đầu trang xanh bo tròn, dải ngày, thanh dưới dạng viên thuốc) ----------
const svg = (inner) => html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  lich: svg(html`<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>`),
  viec: svg(html`<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>`),
  ca: svg(html`<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>`),
  noiquy: svg(html`<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`),
  hotro: svg(html`<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`),
  plus: html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  cal: html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
};
function tabItem(on, href, label, icon, badge) {
  return html`<a class="tb-it ${on ? 'on' : ''}" href="${href}">${icon}<span>${label}</span>${badge ? html`<b class="tb-n">${badge}</b>` : ''}</a>`;
}
function greet() {
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  return h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}
const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
function weekStrip(path) {
  const today = vnToday();
  const start = weekStart(today);
  const sel = path.startsWith('/lich') ? Number(parseHash().params.ngay) : NaN;
  return html`<div class="wstrip" role="group" aria-label="Tuần này">${WD.map((w, i) => {
    const d = addDays(start, i);
    const isToday = d === today;
    return html`<a class="ws-d ${isToday ? 'today' : ''} ${sel === i ? 'sel' : ''}" href="#/lich?tab=cua-toi&ngay=${i}" aria-label="${w} ${d.slice(8, 10)}/${d.slice(5, 7)}${isToday ? ' (hôm nay)' : ''}">
      ${isToday ? html`<i class="ws-ic">${ICONS.cal}</i>` : ''}<b>${Number(d.slice(8, 10))}</b><span>${w}</span>${isToday ? html`<em></em>` : ''}</a>`;
  })}</div>`;
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
  // Nhắc hồ sơ nhận hàng kho tổng còn thiếu (máy chủ chỉ gửi 1 lần mỗi ngày)
  if ((can('ke_toan') || can('doi_soat')) && sessionStorage.getItem('nh_tick') !== vnToday()) {
    try { sessionStorage.setItem('nh_tick', vnToday()); } catch (_) { /* bỏ qua */ }
    rpc('app_nh_tick').catch(() => {});
  }
  if (state.me.employee_id) { try { state.ka = (await rpc('app_ka_mine')).filter((k) => (k.status === 'chua_xu_ly' || k.auto_tru) && !k.seen_at).length; } catch (_) { /* bỏ qua */ } }
  if (can('nhan_viec') || can('hop_giao_viec')) {
    try { state.remind = await rpc('app_viec_reminder'); state.tasks = state.remind.open; state.review = state.remind.to_review; } catch (_) { /* bỏ qua */ }
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
  if (path === '/' && me && me.role === 'ke_toan') return go('/ke-toan/hoa-don');
  if (path === '/' && me && !me.must_change) return go(homePath());   // Tổng quan tạm ẩn: vào thẳng tab đầu tiên của menu
  // Khoản âm đã gộp vào Quản lý ca › Thu chi (giữ đường dẫn cũ trong thông báo); Báo cáo ca đã bỏ
  if (path === '/quan-ly/khoan-am') return go('/quan-ly/thu-chi?' + new URLSearchParams({ ...params, xem: 'khoan-am' }).toString());
  if (path === '/quan-ly/bao-cao-ca') return go('/quan-ly/thu-chi');
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
  document.title = `${page.title || 'Quản trị cafe'} · Quản trị cafe`;
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
