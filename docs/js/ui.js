// Tiện ích giao diện dùng chung
export const ROLE_LABELS = { chu: 'Chủ', ql_tong: 'Quản lý tổng', ql: 'Quản lý', nv: 'Nhân viên', ke_toan: 'Kế toán' };

// Thoát ký tự HTML
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Tagged template: html`<b>${x}</b>` tự thoát giá trị; dùng raw(...) cho đoạn HTML đã an toàn
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (Array.isArray(v)) out += v.flat(Infinity).map((x) => (x && x[RAW] !== undefined ? x[RAW] : (x === false || x === null || x === undefined ? '' : esc(x)))).join('');
      else if (v && v[RAW] !== undefined) out += v[RAW];
      else if (v === false || v === null || v === undefined) out += '';
      else out += esc(v);
    }
  });
  return raw(out);
}
export const str = (h) => (h && h[RAW] !== undefined ? h[RAW] : String(h ?? ''));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Bỏ dấu để tìm kiếm
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Thông báo nhanh, giữ qua một lần chuyển trang
export function flash(message, kind = 'ok') { sessionStorage.setItem('flash', JSON.stringify({ message, kind })); }
export function takeFlash() {
  const v = sessionStorage.getItem('flash');
  sessionStorage.removeItem('flash');
  return v ? JSON.parse(v) : null;
}

// UI-25: nút ghi dữ liệu chạy một lần tại một thời điểm — bấm nhanh 2 lần (hoặc bấm lại ngay sau hộp xác nhận) không gửi 2 lệnh.
// Dùng: el.addEventListener('click', once(async (ev) => { ... }))
export function once(fn) {
  let busy = false;
  return async function (ev) {
    if (busy) return undefined;
    busy = true;
    const b = ev && ev.currentTarget && 'disabled' in ev.currentTarget ? ev.currentTarget : null;
    if (b) b.disabled = true;
    // mở lại sau một nhịp: phần lớn nút gọi rerender() (không chờ) — để trang kịp vẽ lại trước khi nút cũ bấm được lần nữa
    try { return await fn.call(this, ev); } finally { setTimeout(() => { busy = false; if (b && b.isConnected) b.disabled = false; }, 800); }
  };
}

export function showSaved(text, isError) {
  const el = document.getElementById('saved-indicator');
  if (!el) { if (isError) alert(text); return; }
  el.textContent = text;
  el.classList.toggle('err', !!isError);
  el.hidden = false;
}

export const hhmm = () => new Date().toTimeString().slice(0, 5);

export function go(path) {
  if (location.hash === '#' + path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}

// Tải thư viện ngoài (dạng <script>) một lần
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Không tải được thư viện ' + src));
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

export function dialog(innerHtml) {
  const d = document.createElement('dialog');
  d.innerHTML = str(innerHtml);
  document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}
