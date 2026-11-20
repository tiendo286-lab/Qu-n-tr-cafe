// Bộ lọc ngày dùng chung cho Hàng hoá › Đối soát · Phiếu xuất · Kiểm soát (bước 167, anh Tiến giao 19/11/2026).
//  * Ô loại ngày (Ngày giao · Ngày nhận · Ngày đối soát — loại không áp dụng thì ẩn) + khoảng từ–đến + nút nhanh
//    Hôm nay · 7 ngày · Tháng này · Tháng trước. Thay cho nút chuyển tháng ‹ ›.
//  * Nhớ lựa chọn theo từng trang (localStorage, lỗi thì bỏ qua). Nút nhanh được nhớ theo tên (mai mở lại "Hôm nay" vẫn là hôm nay).
//  * Đường dẫn cũ có ?thang=YYYY-MM vẫn mở đúng tháng đó.
import { html } from './ui.js';

export const KINDS = { giao: 'Ngày giao', nhan: 'Ngày nhận', ds: 'Ngày đối soát' };
export const PRESETS = [['hom_nay', 'Hôm nay'], ['7_ngay', '7 ngày'], ['thang_nay', 'Tháng này'], ['thang_truoc', 'Tháng trước']];
const isD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));

export function addDays(d, n) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export function monthRange(m) { const [y, mo] = m.split('-').map(Number); return { from: `${m}-01`, to: new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10) }; }
const prevMonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7); };

export function presetRange(k, today) {
  if (k === 'hom_nay') return { from: today, to: today };
  if (k === '7_ngay') return { from: addDays(today, -6), to: today };
  if (k === 'thang_truoc') return monthRange(prevMonth(today.slice(0, 7)));
  return monthRange(today.slice(0, 7));   // thang_nay (cả tháng, để thấy cả phiếu xuất giao ngày sau)
}

// Ghép lựa chọn: đường dẫn (thang | nhanh | tu–den, loai) → đã nhớ → mặc định "Tháng này".
// kinds = các loại ngày áp dụng cho danh sách đang xem; loại đã chọn không áp dụng thì dùng loại đầu tiên (không ghi đè lựa chọn đã nhớ).
export function readLoc({ params = {}, saved = {}, kinds = ['giao'], today }) {
  const presetOk = (k) => PRESETS.some(([p]) => p === k);
  let want = { ...saved };
  if (isM(params.thang)) want = { ...want, nhanh: null, ...monthRange(params.thang), thang: params.thang };
  else if (presetOk(params.nhanh)) want = { ...want, nhanh: params.nhanh };
  else if (isD(params.tu) || isD(params.den)) want = { ...want, nhanh: null, from: isD(params.tu) ? params.tu : params.den, to: isD(params.den) ? params.den : params.tu };
  if (params.loai && KINDS[params.loai]) want.kind = params.loai;
  let r;
  if (presetOk(want.nhanh)) r = { preset: want.nhanh, ...presetRange(want.nhanh, today) };
  else if (isD(want.from) && isD(want.to)) r = { preset: null, from: want.from, to: want.to };
  else r = { preset: 'thang_nay', ...presetRange('thang_nay', today) };
  if (r.from > r.to) r = { ...r, from: r.to, to: r.from };
  const kind = kinds.includes(want.kind) ? want.kind : kinds[0];
  return { kind, from: r.from, to: r.to, preset: r.preset, wantKind: want.kind || kind, month: want.thang || null };
}
// phần cần nhớ (chỉ khi người dùng chọn — có tham số trên đường dẫn)
export function locToSave(L) { return L.preset ? { kind: L.wantKind, nhanh: L.preset } : { kind: L.wantKind, from: L.from, to: L.to }; }
export const hasLocParams = (p = {}) => ['loai', 'nhanh', 'tu', 'den', 'thang'].some((k) => p[k]);
export function locLoad(key) { try { return JSON.parse(localStorage.getItem('locNgay:' + key) || '{}') || {}; } catch (_) { return {}; } }
export function locSave(key, v) { try { localStorage.setItem('locNgay:' + key, JSON.stringify(v)); } catch (_) { /* bỏ qua */ } }

// tham số đường dẫn cho một lựa chọn (xoá các khoá cũ không dùng)
export function locQuery(o) {
  const q = { loai: o.kind || '', nhanh: '', tu: '', den: '', thang: '' };
  if (o.preset) q.nhanh = o.preset; else { q.tu = o.from || ''; q.den = o.to || ''; }
  return q;
}

// ngày theo loại của một lần giao (delivery_invoices) hoặc một mục Kiểm soát (delivery_followups có work_date / received_date / recon_date)
export function dateOf(r, kind) {
  if (!r) return null;
  if (kind === 'nhan') return r.received_date || (r.received_at ? String(r.received_at).slice(0, 10) : null);
  if (kind === 'ds') return r.recon_date || (r.recon_at ? String(r.recon_at).slice(0, 10) : null);
  return r.work_date || null;
}
export const inLoc = (r, L) => { const d = dateOf(r, L.kind); return !!d && d >= L.from && d <= L.to; };
// xếp theo ngày đang lọc: mới nhất trên (asc = true: cũ nhất trên — riêng Chờ đối soát)
export function sortLoc(rows, kind, asc = false) {
  const key = (r) => dateOf(r, kind) || '';
  const t = (r) => String((kind === 'nhan' ? r.received_at : kind === 'ds' ? r.recon_at : r.ship_at) || '');
  return [...rows].sort((a, b) => (asc ? 1 : -1) * (key(a).localeCompare(key(b)) || t(a).localeCompare(t(b)) || (a.id || 0) - (b.id || 0)));
}
// mục chờ bị ẩn vì nằm ngoài khoảng ngày → khoảng mới bao trọn cả các mục đó
export function coverRange(hidden, L) {
  const ds = hidden.map((r) => dateOf(r, L.kind)).filter(Boolean);
  if (!ds.length) return null;
  return { kind: L.kind, preset: null, from: [L.from, ...ds].sort()[0], to: [L.to, ...ds].sort().slice(-1)[0] };
}
const dm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export function locLabel(L) {
  if (L.from === L.to) return dm(L.from) + '/' + L.from.slice(0, 4);
  const mr = monthRange(L.from.slice(0, 7));
  if (L.from === mr.from && L.to === mr.to) return `tháng ${Number(L.from.slice(5, 7))}/${L.from.slice(0, 4)}`;
  return `${dm(L.from)} – ${dm(L.to)}${L.to.slice(0, 4) !== L.from.slice(0, 4) ? '/' + L.to.slice(0, 4) : ''}`;
}

// thanh lọc; href(o) = đường dẫn của trang cho lựa chọn o (dùng locQuery)
export function locBar(L, kinds, href) {
  return html`<div class="loc-ngay" data-loc>${kinds.length > 1
      ? html`<select class="input sm loc-k" data-loc-kind aria-label="Loại ngày">${kinds.map((k) => html`<option value="${k}" ${k === L.kind ? 'selected' : ''}>${KINDS[k]}</option>`)}</select>`
      : html`<span class="loc-k1">${KINDS[kinds[0]]}</span>`}
    <span class="loc-r"><input class="input sm" type="date" data-loc-from value="${L.from}" aria-label="Từ ngày"><span>–</span><input class="input sm" type="date" data-loc-to value="${L.to}" aria-label="Đến ngày"></span>
    <span class="loc-q">${PRESETS.map(([k, t]) => html`<a class="loc-p ${L.preset === k ? 'on' : ''}" data-nhanh="${k}" href="${href({ kind: L.kind, preset: k })}">${t}</a>`)}</span></div>`;
}
// đổi loại ngày / ngày → chuyển trang (go nhận đường dẫn mới)
export function wireLoc(root, L, href, go = (u) => { location.hash = u; }) {
  const box = root?.querySelector('[data-loc]'); if (!box) return;
  const k = box.querySelector('[data-loc-kind]'); const f = box.querySelector('[data-loc-from]'); const t = box.querySelector('[data-loc-to]');
  k?.addEventListener('change', () => go(href({ ...L, kind: k.value })));
  const dates = () => { const a = f.value; const b = t.value; if (!isD(a) || !isD(b)) return; go(href({ kind: L.kind, preset: null, from: a <= b ? a : b, to: a <= b ? b : a })); };
  f?.addEventListener('change', dates); t?.addEventListener('change', dates);
}

export const LOC_CSS = html`<style>
  .loc-ngay { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
  .loc-ngay .loc-k { width: auto; min-width: 0; } .loc-k1 { font-weight: 700; font-size: 13px; }
  .loc-r { display: inline-flex; align-items: center; gap: 4px; min-width: 0; } .loc-r input { width: 9.6em; min-width: 0; }
  .loc-q { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .loc-p { padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; font-size: 13px; text-decoration: none; color: inherit; white-space: nowrap; background: var(--card); }
  .loc-p.on { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 700; }
  .loc-more { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
  @media (max-width: 600px) { .loc-ngay { gap: 6px; } .loc-ngay .loc-k { flex: 1 1 100%; } .loc-r { flex: 1 1 100%; } .loc-r input { flex: 1 1 0; width: auto; } }
</style>`;
