// Soạn thảo nội quy / quy trình: lọc HTML an toàn + thanh công cụ (tiêu đề, đậm, nghiêng, danh sách, bảng, ảnh)
import { sb } from './sb.js';
import { compressImage } from './tien.js';

export const DOC_BUCKET = 'tai-lieu';

const ALLOWED = new Set(['H2', 'H3', 'H4', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'IMG', 'A', 'BLOCKQUOTE', 'HR', 'DIV', 'SPAN', 'SUB', 'SUP']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'HEAD', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO', 'NOSCRIPT', 'TEMPLATE']);
const MAP = { H1: 'H2', H5: 'H4', H6: 'H4', FONT: 'SPAN', SECTION: 'DIV', ARTICLE: 'DIV', CENTER: 'DIV', PRE: 'P', CODE: 'SPAN' };

// Chỉ giữ thẻ/thuộc tính an toàn. Ảnh chỉ giữ data-path (link tạm được gắn lại khi hiển thị).
export function sanitize(input) {
  const doc = new DOMParser().parseFromString(`<body>${input || ''}</body>`, 'text/html');
  const clean = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) { ch.remove(); return; }
      let tag = ch.tagName;
      if (DROP.has(tag)) { ch.remove(); return; }
      if (MAP[tag]) {
        const n = doc.createElement(MAP[tag]); while (ch.firstChild) n.appendChild(ch.firstChild); ch.replaceWith(n); ch = n; tag = n.tagName;
      }
      if (!ALLOWED.has(tag)) { clean(ch); ch.replaceWith(...ch.childNodes); return; }
      const keep = {};
      if (tag === 'IMG') { const p = ch.getAttribute('data-path'); if (!p || !/^[\w\-/.]+$/.test(p)) { ch.remove(); return; } keep['data-path'] = p; keep.alt = ch.getAttribute('alt') || ''; }
      if (tag === 'A') { const h = ch.getAttribute('href') || ''; if (/^(https?:\/\/|#\/)/i.test(h)) { keep.href = h; if (!h.startsWith('#')) { keep.target = '_blank'; keep.rel = 'noopener'; } } }
      if (tag === 'TD' || tag === 'TH') ['colspan', 'rowspan'].forEach((k) => { const v = ch.getAttribute(k); if (/^\d{1,2}$/.test(v || '')) keep[k] = v; });
      [...ch.attributes].forEach((a) => ch.removeAttribute(a.name));
      Object.entries(keep).forEach(([k, v]) => ch.setAttribute(k, v));
      clean(ch);
    });
  };
  clean(doc.body);
  // bỏ span rỗng thuộc tính
  doc.body.querySelectorAll('span').forEach((s) => s.replaceWith(...s.childNodes));
  return doc.body.innerHTML.trim();
}

// Gắn link tạm (1 giờ) cho ảnh trong vùng hiển thị
export async function fillImages(root) {
  const imgs = [...root.querySelectorAll('img[data-path]')];
  if (!imgs.length) return;
  const paths = [...new Set(imgs.map((i) => i.dataset.path))];
  try {
    const { data } = await sb.storage.from(DOC_BUCKET).createSignedUrls(paths, 3600);
    const url = new Map((data || []).map((d) => [d.path, d.signedUrl]));
    imgs.forEach((i) => { const u = url.get(i.dataset.path); if (u) i.src = u; });
  } catch (_) { /* bỏ qua */ }
}

// HTML để lưu: lọc + bỏ src tạm của ảnh
export const toStore = (el) => sanitize(el.innerHTML);

export const TOOLBAR = [
  ['h2', 'Tiêu đề lớn', 'H1'], ['h3', 'Tiêu đề nhỏ', 'H2'], ['p', 'Đoạn thường', '¶'],
  ['bold', 'Chữ đậm', 'B'], ['italic', 'Chữ nghiêng', 'I'], ['underline', 'Gạch chân', 'U'],
  ['ul', 'Danh sách chấm', '• Danh sách'], ['ol', 'Danh sách số', '1. Danh sách'],
  ['table', 'Chèn bảng', '▦ Bảng'], ['row', 'Thêm hàng vào bảng', '+ Hàng'], ['col', 'Thêm cột vào bảng', '+ Cột'], ['delrow', 'Xóa hàng đang chọn', '− Hàng'],
  ['img', 'Chèn ảnh', '🖼 Ảnh'], ['clear', 'Xóa định dạng', 'Xóa định dạng'], ['undo', 'Hoàn tác', '↶'], ['redo', 'Làm lại', '↷'],
];

// Gắn thanh công cụ cho vùng soạn thảo. getDocId(): Promise<id> (lưu nháp trước để có chỗ chứa ảnh)
export function bindEditor({ toolbar, area, getDocId, onChange, onError }) {
  const cell = () => { const s = getSelection(); const n = s && s.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); return el && area.contains(el) ? el.closest('td, th') : null; };
  const exec = (cmd, val = null) => { area.focus(); document.execCommand(cmd, false, val); onChange(); };
  toolbar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); }); // giữ vùng chọn
  toolbar.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-cmd]'); if (!b) return;
    const c = b.dataset.cmd;
    if (c === 'h2' || c === 'h3' || c === 'p') return exec('formatBlock', c.toUpperCase());
    if (c === 'bold' || c === 'italic' || c === 'underline' || c === 'undo' || c === 'redo') return exec(c);
    if (c === 'ul') return exec('insertUnorderedList');
    if (c === 'ol') return exec('insertOrderedList');
    if (c === 'clear') { exec('removeFormat'); return exec('formatBlock', 'P'); }
    if (c === 'table') {
      const v = prompt('Số hàng x số cột (vd: 4x3):', '4x3'); if (!v) return;
      const [r, k] = v.toLowerCase().split(/[x×*, ]+/).map(Number);
      if (!(r > 0 && r <= 50 && k > 0 && k <= 10)) { onError('Nhập dạng hàng x cột, tối đa 50 x 10.'); return; }
      const head = `<tr>${'<th>Tiêu đề</th>'.repeat(k)}</tr>`; const body = `<tr>${'<td><br></td>'.repeat(k)}</tr>`.repeat(Math.max(1, r - 1));
      return exec('insertHTML', `<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
    }
    if (c === 'row' || c === 'col' || c === 'delrow') {
      const td = cell(); if (!td) { onError('Đặt con trỏ vào trong bảng trước.'); return; }
      const tr = td.parentElement; const table = td.closest('table');
      if (c === 'row') {
        const n = document.createElement('tr');
        [...tr.children].forEach(() => { const d = document.createElement('td'); d.innerHTML = '<br>'; n.appendChild(d); });
        if (tr.closest('thead')) { let tb = table.querySelector('tbody'); if (!tb) { tb = document.createElement('tbody'); table.appendChild(tb); } tb.insertBefore(n, tb.firstChild); }
        else tr.after(n);
      }
      if (c === 'col') { const i = [...tr.children].indexOf(td); table.querySelectorAll('tr').forEach((row) => { const ref = row.children[i]; const n = document.createElement(ref?.tagName === 'TH' ? 'th' : 'td'); n.innerHTML = '<br>'; ref ? ref.after(n) : row.appendChild(n); }); }
      if (c === 'delrow') { if (table.querySelectorAll('tr').length <= 1) table.remove(); else tr.remove(); }
      onChange(); return;
    }
    if (c === 'img') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      const sel = getSelection(); const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      inp.addEventListener('change', async () => {
        try {
          const id = await getDocId();
          for (const f of inp.files) {
            const blob = await compressImage(f, 1600, 0.8);
            const path = `d${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error } = await sb.storage.from(DOC_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
            if (error) throw new Error(error.message);
            area.focus(); if (range && area.contains(range.startContainer)) { sel.removeAllRanges(); sel.addRange(range); }
            document.execCommand('insertHTML', false, `<p><img data-path="${path}" alt=""></p>`);
          }
          await fillImages(area); onChange();
        } catch (err) { onError('Không tải được ảnh: ' + err.message); }
      });
      inp.click();
    }
  });
  // Dán từ Word / Google Docs: lọc định dạng lạ
  area.addEventListener('paste', (e) => {
    const h = e.clipboardData?.getData('text/html');
    if (!h) return;
    e.preventDefault();
    document.execCommand('insertHTML', false, sanitize(h.replace(/<img[^>]*>/gi, '')));
    onChange();
  });
  area.addEventListener('input', onChange);
}

export const DOC_STYLE = `<style>
  .doc { font-size: 15px; line-height: 1.65; color: var(--ink); overflow-wrap: anywhere; }
  .doc h2 { font-size: 20px; margin: 18px 0 8px; } .doc h3 { font-size: 17px; margin: 14px 0 6px; } .doc h4 { font-size: 15px; margin: 12px 0 4px; }
  .doc p { margin: 6px 0; } .doc ul, .doc ol { padding-left: 22px; margin: 6px 0; }
  .doc table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 14px; display: block; overflow-x: auto; }
  .doc th, .doc td { border: 1px solid var(--line); padding: 6px 8px; vertical-align: top; min-width: 60px; }
  .doc th { background: var(--subtle); text-align: left; }
  .doc img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 8px 0; background: var(--line-soft); min-height: 40px; }
  .doc blockquote { border-left: 4px solid var(--line); margin: 8px 0; padding: 4px 12px; color: var(--ink-2); }
  .ed-area { min-height: 360px; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: #fff; outline: none; }
  .ed-area:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--info-bg); }
  .ed-tools { display: flex; flex-wrap: wrap; gap: 4px; position: sticky; top: 0; z-index: 5; background: var(--bg, var(--subtle)); padding: 6px 0; }
  .ed-tools button { font: inherit; font-size: 13px; font-weight: 600; min-height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line); background: #fff; cursor: pointer; color: var(--ink); }
  .ed-tools button:hover { border-color: var(--primary); color: var(--primary); }
</style>`;
