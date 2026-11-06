// Tiện ích tiền (VND), giờ, nén ảnh — dùng cho Quản lý ca
import { html } from './ui.js';

// 1250000 → "1.250.000"
export function fmt(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  const v = Math.round(Number(n));
  return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export const vnd = (n) => (n === null || n === undefined || n === '' ? '—' : fmt(n) + 'đ');
// Có dấu: +50.000đ / −20.000đ
export const signed = (n) => (Number(n) > 0 ? '+' : Number(n) < 0 ? '−' : '') + fmt(Math.abs(Number(n) || 0)) + 'đ';

// "1.250.000" → 1250000 ; rỗng → null
export function parseMoney(s) {
  const d = String(s ?? '').replace(/[^\d]/g, '');
  return d === '' ? null : Number(d);
}

// Kết quả: âm = THIẾU, dương = THỪA, 0 = KHỚP
export function result(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return html`<span class="pill mute">Chưa đủ số liệu</span>`;
  if (n < 0) return html`<span class="pill off">THIẾU ${fmt(-n)}đ</span>`;
  if (n > 0) return html`<span class="pill warn">THỪA ${fmt(n)}đ</span>`;
  return html`<span class="pill ok">KHỚP</span>`;
}

// Ô nhập tiền: gõ số, tự thêm dấu chấm
export function bindMoneyInputs(root) {
  root.querySelectorAll('input.money').forEach((i) => {
    if (i.dataset.bound) return;
    i.dataset.bound = '1';
    i.addEventListener('input', () => {
      const v = parseMoney(i.value);
      const pos = i.value.length - i.selectionStart;
      i.value = v === null ? '' : fmt(v);
      const p = Math.max(0, i.value.length - pos);
      try { i.setSelectionRange(p, p); } catch (_) { /* bỏ qua */ }
    });
  });
}

// 'YYYY-MM-DD HH:MM' ↔ giá trị ô datetime-local
export const toLocalInput = (t) => (t ? t.replace(' ', 'T').slice(0, 16) : '');
export const fromLocalInput = (v) => (v ? v.replace('T', ' ').slice(0, 16) : null);
// 'YYYY-MM-DD HH:MM' → 'HH:MM dd/mm'
export function dt(t) {
  if (!t) return '—';
  const [d, h] = t.split(' ');
  const [y, m, dd] = d.split('-');
  return `${(h || '').slice(0, 5)} ${dd}/${m}${y ? '/' + y : ''}`;
}
export const dmy = (d) => (d ? d.split('-').reverse().join('/') : '');

// Nén ảnh trước khi tải lên (cạnh dài tối đa 1600px, JPEG ~75%) để tiết kiệm dung lượng Supabase
export async function compressImage(file, maxSide = 1600, quality = 0.75) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Không đọc được ảnh ' + file.name)); i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob((b) => ok(b), 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}
