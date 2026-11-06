// Mảnh giao diện dùng chung cho các trang quản lý
import { addDays, weekLabel } from './data.js';
import { $, go, html } from './ui.js';

// Thanh chọn tuần: ‹ Tuần trước · nhãn · Tuần sau › · chọn theo ngày. path ví dụ '/quan-ly/order', extra: '&cn=1'
export function weekBar(path, start, extra = '', right = '') {
  return html`<section class="card toolbar" style="padding:12px 18px">
    <strong style="font-size:14px;color:var(--primary-dark)">Tuần làm việc</strong>
    <a class="btn sm secondary" href="#${path}?tuan=${addDays(start, -7)}${extra}" style="min-height:40px">‹ Tuần trước</a>
    <div style="font-weight:700;padding:0 6px">${weekLabel(start)}</div>
    <a class="btn sm secondary" href="#${path}?tuan=${addDays(start, 7)}${extra}" style="min-height:40px">Tuần sau ›</a>
    ${right}
    <form class="toolbar week-pick" data-path="${path}" data-extra="${extra}" style="gap:8px;margin-left:auto">
      <input class="input sm" type="date" name="tuan" value="${start}" aria-label="Chọn ngày trong tuần" required>
      <button class="btn sm" type="submit" style="min-height:40px">Chọn tuần</button>
    </form></section>`;
}

export function bindWeekPick(root = document) {
  root.querySelectorAll('.week-pick').forEach((f) => f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    go(`${f.dataset.path}?tuan=${f.querySelector('input').value}${f.dataset.extra || ''}`);
  }));
}

// Hộp xác nhận phải gõ chữ (XOA, NHAP...). Trả về true nếu gõ đúng.
export function typed(question, word) {
  const v = prompt(`${question}\nGõ ${word} để xác nhận:`);
  if (v === null) return false;
  if (v.trim().toUpperCase() !== word) { alert(`Chưa thực hiện: cần gõ đúng chữ ${word}.`); return false; }
  return true;
}

export function fileInput(accept, onFile) {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = accept;
  i.addEventListener('change', () => { if (i.files[0]) onFile(i.files[0]); });
  i.click();
}

export { $ };
