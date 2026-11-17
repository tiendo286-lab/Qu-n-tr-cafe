// Hàng hoá › Phiếu xuất (trước là Kế toán › Hóa đơn giao hàng, bước 31; chuyển menu bước 104; thiết kế lại bước 107): kế toán tải + tra cứu phiếu xuất kho tổng
import { render as rerender } from '../app.js';
import { catalog, vnToday } from '../data.js';
import { rpc, sb } from '../sb.js';
import { compressImage, dmy, dt, fmt } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';
import { DOW } from './ke_toan_ck.js';

export const perm = ['ke_toan', 'doi_soat'];   // quản lý xem được (chỉ kế toán tải / ghép / xóa hóa đơn)
export const BUCKET = 'hoa-don';
export const HD_STATUS = { chua_nhan: ['Chưa nhận', 'off'], du: ['Đã nhận đủ', 'ok'], thieu: ['Báo thiếu', 'warn'] };
export const HD_ACCEPT = 'image/*,.pdf,.xls,.xlsx,.csv';

// Tải nhiều tệp lên kho; ảnh được nén cho nhẹ. prefix: 'hd<id>' (hóa đơn) hoặc 'nhan<id>' (ảnh hàng nhận)
export async function uploadFiles(prefix, files, onEach, status) {
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (status) status.textContent = `Đang tải ${i + 1}/${files.length}: ${f.name}`;
    const isImg = /^image\//.test(f.type);
    if (!isImg && f.size > 15 * 1024 * 1024) throw new Error(`Tệp ${f.name} lớn hơn 15MB.`);
    const blob = isImg ? await compressImage(f) : f;
    const ext = isImg ? 'jpg' : ((f.name.match(/\.([A-Za-z0-9]{1,5})$/) || [])[1] || 'bin').toLowerCase();
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: isImg ? 'image/jpeg' : (f.type || 'application/octet-stream') });
    if (error) throw new Error(error.message);
    await onEach(path, f, isImg ? blob.size : f.size, isImg ? 'image/jpeg' : f.type);
  }
  if (status) status.textContent = '';
}

// Gắn link tạm (1 giờ) cho các phần tử có data-path
export function signLinks(scope = document) {
  const els = [...scope.querySelectorAll('[data-path]')];
  if (!els.length) return;
  sb.storage.from(BUCKET).createSignedUrls(els.map((e) => e.dataset.path), 3600).then(({ data }) => {
    (data || []).forEach((d, i) => {
      if (!d.signedUrl) return;
      const el = els[i];
      if (el.tagName === 'IMG') el.src = d.signedUrl;
      const a = el.tagName === 'A' ? el : el.closest('a');
      if (a) a.href = d.signedUrl;
    });
  }).catch(() => {});
}

const icon = (f) => (/^image\//.test(f.mime || '') ? '🖼' : /pdf/.test(f.mime || '') || /\.pdf$/i.test(f.name) ? '📄' : /\.(xlsx?|csv)$/i.test(f.name) ? '📊' : '📎');
export const fileLinks = (files, del) => html`${files.map((f) => html`<span class="hd-file"><a target="_blank" rel="noopener" data-path="${f.path}">${icon(f)} ${f.name}</a>${del ? html`<button type="button" class="hd-fdel" data-id="${f.id}" aria-label="Xóa tệp ${f.name}">×</button>` : ''}</span>`)}`;
export const photoThumbs = (photos, del) => html`<div class="photos">${photos.map((p) => html`<figure class="ph"><a target="_blank" rel="noopener"><img alt="Ảnh hàng nhận" loading="lazy" data-path="${p.path}"></a>${del ? html`<button type="button" class="ph-del hd-pdel" data-id="${p.id}" aria-label="Xóa ảnh">×</button>` : ''}</figure>`)}</div>`;
export function receiptText(i) {
  if (i.status === 'chua_nhan') return html`<div class="st-meta">Nhân viên chưa báo nhận.</div>`;
  return html`<div class="hd-rec"><strong>${i.status === 'du' ? 'Nhận ĐỦ' : 'Báo THIẾU'}</strong> · ${i.received_by_name || ''} · ca ${i.received_shift || '?'} · ${dt(i.received_at)}
    ${i.items.length ? html`<ul style="margin:4px 0 0;padding-left:18px">${i.items.map((x) => html`<li>${x.item}${x.qty ? ` — ${x.qty}` : ''}</li>`)}</ul>` : ''}
    ${i.receive_note ? html`<div class="st-meta">Ghi chú: ${i.receive_note}</div>` : ''}</div>`;
}
export const HD_CSS = html`<style>
  .hd-file { display: inline-flex; align-items: center; gap: 2px; margin: 2px 8px 2px 0; font-size: 14px; }
  .hd-fdel { border: none; background: none; color: #b91c1c; font-weight: 700; cursor: pointer; font-size: 15px; }
  .hd-rec { font-size: 14px; background: var(--subtle); border-radius: 8px; padding: 8px 10px; }
  .photos { display: flex; flex-wrap: wrap; gap: 8px; }
  .photos .ph { position: relative; margin: 0; width: 88px; height: 88px; border-radius: 8px; overflow: hidden; background: var(--line-soft); }
  .photos .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photos .ph-del { position: absolute; top: 2px; right: 2px; border: none; border-radius: 50%; width: 22px; height: 22px; background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
</style>`;

// Bước 102 (anh Tiến chốt 15/11/2026): chọn 1 CƠ SỞ; 2 cách xem TUẦN (mặc định) | THÁNG.
//  Tuần: máy tính = 7 cột ngày, mỗi ngày các lần giao; điện thoại (≤ 700px) = dải 7 ngày bấm chọn, thẻ từng lần giao.
//  Tháng: danh sách mọi lần giao trong tháng của cơ sở (lọc trạng thái). Đầu trang luôn có ô Phải trả kho tổng cả tháng.
const LS_BR = 'ckBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };

// ================================================================= TRANG (bước 107, anh Tiến chốt 15/11/2026)
// Phiếu xuất = kế toán TẢI + TRA CỨU phiếu: tải nhiều file Excel 1 lần (bảng xem trước) · danh sách tất cả cơ sở nhóm theo ngày giao (lọc cơ sở / trạng thái / tìm số đơn / tháng)
// · khung "Cần ghép phiếu xuất" (lần nhận chưa có phiếu xuất — có ảnh hoá đơn giao để so) · xem 1 phiếu · phiếu chưa nhận: xoá / tải lại (chặn khi nhân viên đang nhận).
// Tiền tháng xem ở tab Kiểm soát (không để 2 con số khác nhau).
const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const q3 = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));
const started = (d) => (d.photos || []).length > 0 || !!d.deliv_path || !!d.deliv_note || (d.lines || []).some((l) => l.qty_invoice == null || l.qty_received != null);

export async function render({ params, can }) {
  const { parseXuatExcel, guessBranch } = await import('../nhap_hang.js');
  const today = vnToday();
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : today.slice(0, 7);
  const cat = await catalog(); const branches = cat.activeBranches;
  const bcode = (b) => b.display_code || b.code;
  const br = branches.some((b) => String(b.id) === String(params.cn)) ? Number(params.cn) : null;   // null = tất cả cơ sở
  const tt = ['dang', 'cho', 'xong'].includes(params.tt) ? params.tt : '';
  const [D, ME] = await Promise.all([rpc('app_nh_list', { p_month: month, p_branch: br }), rpc('app_me')]);
  const kt = !!D.kt; const owner = ME?.role === 'chu'; const money = !!D.money;
  const seen = new Set(); const all = [];
  [...(D.rows || []), ...(D.open || [])].forEach((r) => { if (!seen.has(r.id) && (br === null || r.branch_id === br)) { seen.add(r.id); all.push(r); } });
  const byId = (id) => all.find((x) => x.id === Number(id));
  const needMerge = all.filter((d) => d.state === 'cho_hoa_don').sort((a, b) => String(a.received_at || '').localeCompare(String(b.received_at || '')));
  const grp = (d) => (d.state === 'dang_chuyen' ? 'dang' : d.recon_at ? 'xong' : 'cho');
  const rows = (D.rows || []).filter((d) => (br === null || d.branch_id === br) && d.state !== 'cho_hoa_don' && d.doc_no);
  const cnt = (k) => rows.filter((d) => grp(d) === k).length;
  const list = rows.filter((d) => !tt || grp(d) === tt).sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || String(b.ship_at || '').localeCompare(String(a.ship_at || '')) || b.id - a.id);
  const days = [...new Set(list.map((d) => d.work_date))];
  const q = (o) => '#/hang-hoa/phieu-xuat?' + Object.entries({ cn: br ?? '', tt, thang: month, ...o }).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${v}`).join('&');
  const shiftMonth = (k) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };
  const dname = (d) => DOW[new Date(d + 'T00:00:00Z').getUTCDay()];
  const lechN = (d) => (d.lines || []).filter((l) => (l.qty_invoice == null ? Number(l.qty_checked ?? l.qty_received ?? 0) > 0 : Number(l.qty_checked ?? l.qty_received ?? 0) !== Number(l.qty_invoice))).length;
  const stPills = (d) => { const g = grp(d); const n = g === 'dang' ? 0 : lechN(d);
    return g === 'dang' ? html`<span class="pill mute">🚚 Chưa nhận</span>${started(d) ? html`<span class="pill warn">NV đang nhận</span>` : d.work_date < today ? html`<span class="pill off">quá ngày giao</span>` : ''}`
      : g === 'cho' ? html`<span class="pill info">Chờ đối soát</span>${n ? html`<span class="pill warn">${n} lệch</span>` : ''}`
        : html`<span class="pill ok">✓ Đối soát xong</span>${n ? html`<span class="pill warn">${n} lệch → Kiểm soát</span>` : ''}`; };
  const docPill = (d) => (d.deliv_path ? html`<span class="pill ok">📄 có</span>` : d.bu_path ? html`<span class="pill ok">📄 hoá đơn bù</span>`
    : d.state === 'dang_chuyen' ? html`<span class="st-meta">—</span>` : html`<span class="pill off">thiếu → chờ HĐ bù</span>`);
  const acts = (d) => html`<span class="px-act"><button type="button" class="btn sm secondary px-view">Xem</button>${d.state === 'dang_chuyen' && started(d) && kt && !owner ? html`<span class="st-meta">đang nhận — không tải lại</span>` : ''}
    ${kt && d.state === 'dang_chuyen' && !started(d) ? html`<button type="button" class="btn sm secondary px-re">Tải lại</button>` : ''}
    ${owner ? html`<button type="button" class="btn sm secondary danger px-del">Xóa</button>` : ''}</span>`;
  const row = (d) => html`<div class="px-row" data-id="${d.id}" data-doc="${normName(d.doc_no)}"><b class="px-br">${d.branch_code}</b><span class="px-doc">${d.doc_no}</span><span class="px-n">${d.n_lines} món</span>
      ${money ? html`<b class="px-tot">${d.total != null ? fmt(d.total) : '—'}</b>` : ''}<span class="px-st">${stPills(d)}</span><span class="px-hd">${docPill(d)}</span>${acts(d)}</div>`;
  return {
    title: 'Phiếu xuất kho tổng',
    html: html`${HD_CSS}${PX_CSS}<div class="px-wrap"><div class="page-head"><div><h1>Phiếu xuất kho tổng</h1><div class="sub">Kế toán tải phiếu xuất trước khi giao · tra cứu phiếu. Tiền hàng tháng xem ở tab <a href="#/hang-hoa/kiem-soat">Kiểm soát</a>.</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div>${kt ? html`<label class="btn">+ Tải phiếu xuất (chọn nhiều file)<input type="file" id="px-files" accept=".xlsx,.xls" multiple hidden></label>` : ''}</div></div>
      <section class="card px-bar"><nav class="branch-tabs" aria-label="Cơ sở"><a class="${br === null ? 'on' : ''}" href="${q({ cn: '' })}">Tất cả</a>${branches.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${bcode(b)}</a>`)}</nav>
        <div class="px-f"><nav class="gh-tabs px-tt"><a class="${!tt ? 'on' : ''}" href="${q({ tt: '' })}">Mọi trạng thái</a><a class="${tt === 'dang' ? 'on' : ''}" href="${q({ tt: 'dang' })}">🚚 Chưa nhận <b>${cnt('dang')}</b></a><a class="${tt === 'cho' ? 'on' : ''}" href="${q({ tt: 'cho' })}">Đã nhận · chờ đối soát <b>${cnt('cho')}</b></a><a class="${tt === 'xong' ? 'on' : ''}" href="${q({ tt: 'xong' })}">✓ Đối soát xong <b>${cnt('xong')}</b></a></nav>
          <input class="input sm px-q" id="px-q" type="search" placeholder="🔍 Tìm số đơn…" aria-label="Tìm số đơn">
          <span class="px-mon"><a class="btn sm secondary" href="${q({ thang: shiftMonth(-1) })}" aria-label="Tháng trước">‹</a><strong>Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(1) })}" aria-label="Tháng sau">›</a></span></div></section>
      ${needMerge.length ? html`<section class="card px-need"><b>🔗 Cần ghép phiếu xuất (${needMerge.length})</b> <span class="st-meta">— nhân viên đã nhận hàng nhưng chưa có phiếu xuất trên web</span>
        ${needMerge.map((d) => html`<div class="px-nrow" data-id="${d.id}"><b>${d.branch_code}</b><span class="grow">Nhận ${d.received_at ? `${dmy(String(d.received_at).slice(0, 10)).slice(0, 5)} ${String(d.received_at).slice(11, 16)}` : ''}${d.received_by ? ` · ${d.received_by}` : ''} · ${d.n_lines} món · ${d.deliv_path ? html`<span class="pill ok">📄 có ảnh HĐ giao</span>` : html`<span class="pill off">không có HĐ giao</span>`}</span>
          <span class="px-act"><button type="button" class="btn sm secondary px-view">Xem</button>${kt ? html`<button type="button" class="btn sm px-merge">Ghép phiếu xuất ›</button>` : ''}${owner ? html`<button type="button" class="btn sm secondary danger px-del">Xóa</button>` : ''}</span></div>`)}</section>` : ''}
      <div id="px-list">${days.length ? days.map((day) => { const L = list.filter((d) => d.work_date === day);
          return html`<div class="px-day" data-day="${day}"><div class="px-dh"><span>${dname(day)} ${dmy(day).slice(0, 5)} · ${L.length} phiếu</span>${money ? html`<span>${fmt(L.reduce((t, d) => t + Number(d.total || 0), 0))}đ</span>` : ''}</div>
            <div class="card px-rows">${L.map(row)}</div></div>`; }) : html`<div class="card st-meta">Không có phiếu xuất nào${tt ? ' ở mục này' : ''} trong tháng ${Number(month.slice(5))}/${month.slice(0, 4)}.</div>`}
        <div class="card st-meta px-none" hidden>Không tìm thấy số đơn này trong tháng.</div></div></div>`,
    mount() {
      const idOf = (b) => b.closest('[data-id]').dataset.id;
      $('#px-q')?.addEventListener('input', (e) => { const v = normName(e.target.value); let any = false;
        $$('.px-day').forEach((dy) => { let n = 0; $$('.px-row', dy).forEach((r) => { const ok = !v || r.dataset.doc.includes(v); r.hidden = !ok; if (ok) n++; }); dy.hidden = !n; if (n) any = true; });
        const none = $('.px-none'); if (none) none.hidden = any || !v; });
      $$('.px-view').forEach((b) => b.addEventListener('click', () => viewBox(byId(idOf(b)))));
      $$('.px-del').forEach((b) => b.addEventListener('click', async () => {
        const d = byId(idOf(b)); const got = d.state !== 'dang_chuyen' || started(d);
        if (!confirm(`${d.doc_no ? `Xóa phiếu xuất ${d.doc_no}` : 'Xóa phiếu nhận hàng KHÔNG HOÁ ĐƠN'} của ${d.branch_code}?\n\n${got ? 'Phiếu này ĐÃ CÓ NHÂN VIÊN NHẬN HÀNG. Xóa sẽ mất luôn số lượng đã nhận, ảnh nhận hàng, hoá đơn giao / hoá đơn bù và ghi chú thiếu hàng. Không khôi phục được.' : 'Phiếu chưa có nhân viên nhận. Xóa sẽ mất luôn file phiếu xuất đã tải lên.'}`)) return;
        try { const paths = await rpc('app_nh_delete', { p_id: d.id }); if (paths?.length) await sb.storage.from(BUCKET).remove(paths); flash(d.doc_no ? `Đã xóa phiếu ${d.doc_no}.` : `Đã xóa phiếu nhận không hoá đơn của ${d.branch_code}.`); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      const pickOne = (fn) => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls'; inp.addEventListener('change', () => inp.files[0] && fn(inp.files[0])); inp.click(); };
      $$('.px-re').forEach((b) => b.addEventListener('click', () => pickOne((f) => replaceBox(byId(idOf(b)), f))));
      $$('.px-merge').forEach((b) => b.addEventListener('click', () => pickOne((f) => mergeBox(byId(idOf(b)), f))));
      $('#px-files')?.addEventListener('change', (e) => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) multiBox(fs); });
    },
  };

  // ---- xem 1 phiếu
  function viewBox(d) {
    const g = grp(d);
    const dl = dialog(html`<div class="stack px-dlg" style="gap:8px"><div><b style="font-size:17px">${d.doc_no || 'Chưa có phiếu xuất'} · ${d.branch_code}</b> <span class="st-meta">${d.ship_at ? `· kho xuất ${dt(d.ship_at)}` : d.received_at ? `· nhận ${dt(d.received_at)}` : ''}${money && d.total != null ? ` · ${fmt(d.total)}đ` : ''}</span></div>
      <div class="px-tl"><span class="on">Xuất</span><i></i><span class="${g !== 'dang' ? 'on' : ''}">${d.received_at ? `Đã nhận ${String(d.received_at).slice(11, 16)}` : 'Chưa nhận'}</span><i></i><span class="${g === 'xong' ? 'on' : ''}">Đối soát${d.recon_at ? ' xong' : ''}</span></div>
      ${d.received_by ? html`<div class="st-meta">Nhận: ${d.received_by}${d.recon_by ? ` · đối soát: ${d.recon_by}` : ''}</div>` : ''}
      <div class="table-wrap"><table class="table px-t"><thead><tr><th>Món</th><th class="r">Phiếu</th><th class="r">NV</th><th class="r">QL</th></tr></thead>
        <tbody>${(d.lines || []).map((l) => { const qv = l.qty_received; const inv = l.qty_invoice; const bad = qv != null && (inv == null ? Number(qv) > 0 : Number(qv) !== Number(inv));
          return html`<tr><td>${l.name}${inv == null && d.doc_no ? html` <span class="pill off">ngoài phiếu</span>` : ''} <span class="st-meta">${l.unit || ''}</span></td><td class="r">${q3(inv)}</td><td class="r ${bad ? 'px-bad' : ''}">${q3(qv)}</td><td class="r">${l.qty_checked != null && Number(l.qty_checked) !== Number(l.qty_received) ? html`<b>${q3(l.qty_checked)}</b>` : '—'}</td></tr>`; })}</tbody></table></div>
      <div class="px-media">${d.deliv_path ? html`<div><div class="st-meta">📄 Hoá đơn giao</div><a target="_blank" rel="noopener"><img data-path="${d.deliv_path}" alt="Hoá đơn giao"></a></div>` : d.deliv_note ? html`<div class="st-meta">📄 Không có hoá đơn giao: ${d.deliv_note}</div>` : ''}
        ${(d.photos || []).length ? html`<div><div class="st-meta">Ảnh hàng (${d.photos.length})</div><div class="px-ph">${d.photos.map((p) => html`<a target="_blank" rel="noopener"><img data-path="${p.path}" alt="Ảnh hàng"></a>`)}</div></div>` : ''}</div>
      ${d.bu_path ? html`<a class="hd-file" target="_blank" rel="noopener" data-path="${d.bu_path}">📎 Hoá đơn bù: ${d.bu_name || 'tệp'}</a>` : ''}
      ${(d.files || []).map((f) => html`<a class="hd-file" target="_blank" rel="noopener" data-path="${f.path}">📊 File gốc: ${f.name}</a>`)}
      ${d.receive_note ? html`<div class="st-meta">Ghi chú nhận hàng: ${d.receive_note}</div>` : ''}
      <div class="toolbar" style="gap:6px;flex-wrap:wrap">${d.state !== 'dang_chuyen' ? html`<a class="btn sm secondary" href="#/hang-hoa/doi-soat?${can('doi_soat') && !d.recon_at ? 'ds' : 'xem'}=${d.id}">Mở Đối soát ›</a>` : ''}<a class="btn sm secondary" href="#/hang-hoa/kiem-soat?cn=${d.branch_id}">Kiểm soát ›</a><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
    signLinks(dl); dl.querySelector('[data-x]').addEventListener('click', () => dl.close()); $$('a[href^="#"]', dl).forEach((a) => a.addEventListener('click', () => dl.close()));
  }

  // ---- tải nhiều file 1 lần: bảng xem trước → Lưu tất cả
  async function multiBox(files) {
    showSaved(`Đang đọc ${files.length} file…`);
    let map = {}; try { map = await rpc('app_nh_kho_map'); } catch (_) { /* bỏ qua */ }
    const known = new Set(all.map((d) => String(d.doc_no || '').toUpperCase()).filter(Boolean));
    const R = [];
    for (const f of files) {
      try { const P = await parseXuatExcel(f); const dup = !P.doc_no ? null : known.has(P.doc_no.toUpperCase()) || R.some((x) => x.P && x.P.doc_no.toUpperCase() === P.doc_no.toUpperCase());
        R.push({ f, P, br: map[P.kho_code] || guessBranch(P.kho_name, branches) || '', auto: !!map[P.kho_code], dup, merge: '' }); }
      catch (e) { R.push({ f, err: e.message }); }
    }
    const waiting = (bid) => needMerge.filter((x) => String(x.branch_id) === String(bid));
    const res = (x) => (x.done ? html`<span class="pill ok">✓ đã lưu</span>` : x.fail ? html`<span class="pill off">✗ ${x.fail}</span>` : x.err ? html`<span class="pill off">✗ không đọc được</span>`
      : x.dup ? html`<span class="pill mute">trùng — bỏ qua</span>` : !x.P.doc_no || !x.P.ship_at ? html`<span class="pill off">✗ thiếu số đơn / ngày</span>` : !x.br ? html`<span class="pill warn">? chọn cơ sở</span>`
        : waiting(x.br).length && !x.merge ? html`<span class="pill info">🔗 có lần nhận chưa có phiếu</span>` : html`<span class="pill ok">✓ sẵn sàng</span>`);
    const okRow = (x) => x.P && !x.dup && !x.done && x.P.doc_no && x.P.ship_at && x.br;
    const dl = dialog(html`<div class="stack px-dlg px-wide" style="gap:8px"><div><b style="font-size:17px">Tải phiếu xuất · ${files.length} file</b> <span class="st-meta">— kiểm tra rồi bấm Lưu</span></div><div id="px-mt"></div>
      <div class="px-err"></div><div class="toolbar" style="justify-content:flex-end;gap:6px"><button type="button" class="btn sm secondary" data-x>Đóng</button><button type="button" class="btn sm" id="px-save">Lưu</button></div></div>`);
    const draw = () => {
      const n = R.filter(okRow).length;
      dl.querySelector('#px-mt').innerHTML = str(html`<div class="px-mrows">${R.map((x, i) => html`<div class="px-mr" data-i="${i}"><span class="px-fn" title="${x.f.name}">${x.f.name}</span>
          ${x.P ? html`<b>${x.P.doc_no || '—'}</b><span>${x.done || x.dup ? html`<b>${bcode(branches.find((b) => String(b.id) === String(x.br)) || {}) || '—'}</b>` : html`<select class="input sm px-sb"><option value="">— Chọn cơ sở —</option>${branches.map((b) => html`<option value="${b.id}" ${String(x.br) === String(b.id) ? 'selected' : ''}>${bcode(b)}</option>`)}</select>`}${x.auto && !x.done ? html` <span class="st-meta">(mã kho)</span>` : ''}</span>
            <span>${x.P.ship_at ? dmy(x.P.ship_at.slice(0, 10)).slice(0, 5) : '—'}</span><span class="r">${x.P.lines.length} món</span><span class="r">${fmt(x.P.total)}${Math.abs(Number(x.P.total || 0) - Number(x.P.sum || 0)) > 1 ? html` <span class="pill warn">tổng khác</span>` : ''}</span>` : html`<span></span><span></span><span></span><span></span><span></span>`}
          <span>${res(x)}${x.P && !x.dup && !x.done && x.br && waiting(x.br).length ? html`<select class="input sm px-mg"><option value="">Không ghép (hàng đang chuyển tới)</option>${waiting(x.br).map((w) => html`<option value="${w.id}" ${String(x.merge) === String(w.id) ? 'selected' : ''}>Ghép vào lần nhận ${w.received_at ? dmy(String(w.received_at).slice(0, 10)).slice(0, 5) : ''} (${w.n_lines} món)</option>`)}</select>` : ''}</span></div>`)}</div>`);
      const sv = dl.querySelector('#px-save'); sv.textContent = n ? `Lưu ${n} phiếu` : 'Lưu'; sv.disabled = !n;
      $$('.px-sb', dl).forEach((s) => s.addEventListener('change', () => { const x = R[Number(s.closest('[data-i]').dataset.i)]; x.br = s.value; x.merge = ''; draw(); }));
      $$('.px-mg', dl).forEach((s) => s.addEventListener('change', () => { R[Number(s.closest('[data-i]').dataset.i)].merge = s.value; draw(); }));
    };
    draw(); showSaved('');
    let saved = 0;
    dl.querySelector('[data-x]').addEventListener('click', () => { dl.close(); if (saved) rerender(); });
    dl.querySelector('#px-save').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      for (const x of R.filter(okRow)) {
        try {
          const P = x.P; const id = await rpc('app_nh_create', { p: { branch_id: Number(x.br), doc_no: P.doc_no, ship_at: P.ship_at, kho_code: P.kho_code, kho_name: P.kho_name, ref: P.ref, src_creator: P.src_creator,
            total: P.total, lines: P.lines, merge_id: x.merge ? Number(x.merge) : null } });
          try { await uploadFiles('hd' + id, [x.f], (path, ff, size, mime) => rpc('app_kt_invoice_file_add', { p_invoice: id, p_path: path, p_name: ff.name, p_mime: mime, p_size: size })); } catch (_) { /* tệp gốc không bắt buộc */ }
          x.done = true; saved++;
        } catch (e) { x.fail = e.message; }
        draw();
      }
      flash(`Đã lưu ${saved} phiếu xuất${R.some((x) => x.fail) ? ' — còn file lỗi, xem bảng' : ''}.`, R.some((x) => x.fail) ? 'warn' : 'ok');
      if (!R.some((x) => x.fail)) { dl.close(); rerender(); }
    });
  }

  // ---- tải lại (thay phiếu) khi chưa nhận
  async function replaceBox(d, file) {
    let P; try { P = await parseXuatExcel(file); } catch (e) { showSaved(e.message, true); return; }
    const dl = dialog(html`<form class="stack px-dlg" style="gap:8px"><b style="font-size:16px">Tải lại phiếu ${d.doc_no} · ${d.branch_code}</b>
      <div class="st-meta">Kho sửa phiếu → thay toàn bộ món bằng file mới. Chỉ làm được khi nhân viên chưa bắt đầu nhận.</div>
      <div class="kv"><div>Cũ</div><div>${d.doc_no} · ${d.n_lines} món${money && d.total != null ? ` · ${fmt(d.total)}đ` : ''}</div><div>Mới</div><div><b>${P.doc_no || '(không có số đơn)'}</b> · ${P.lines.length} món · ${fmt(P.total)}đ · ${P.ship_at ? dmy(P.ship_at.slice(0, 10)) : 'không đọc được ngày'}</div></div>
      <div class="px-err"></div><div class="toolbar" style="justify-content:flex-end;gap:6px"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Thay phiếu</button></div></form>`);
    const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (e) => { e.preventDefault(); const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const old = await rpc('app_nh_replace', { p_id: d.id, p: { doc_no: P.doc_no, ship_at: P.ship_at, kho_code: P.kho_code, kho_name: P.kho_name, ref: P.ref, src_creator: P.src_creator, total: P.total, lines: P.lines } });
        if (old?.length) sb.storage.from(BUCKET).remove(old).catch(() => {});
        try { await uploadFiles('hd' + d.id, [file], (path, ff, size, mime) => rpc('app_kt_invoice_file_add', { p_invoice: d.id, p_path: path, p_name: ff.name, p_mime: mime, p_size: size })); } catch (_) { /* tệp gốc không bắt buộc */ }
        dl.close(); flash(`Đã thay phiếu ${P.doc_no}.`); rerender();
      } catch (er) { btn.disabled = false; dl.querySelector('.px-err').innerHTML = str(html`<div class="alert error">${er.message}</div>`); } });
  }

  // ---- ghép phiếu xuất vào lần nhận chưa có phiếu: ảnh hoá đơn giao + so món
  async function mergeBox(t, file) {
    let P; try { P = await parseXuatExcel(file); } catch (e) { showSaved(e.message, true); return; }
    const used = new Set();
    const pairs = (t.lines || []).map((l) => { const i = P.lines.findIndex((x, k) => !used.has(k) && ((x.code && l.code && String(x.code).toUpperCase() === String(l.code).toUpperCase()) || normName(x.name) === normName(l.name)));
      if (i >= 0) used.add(i); return { l, x: i >= 0 ? P.lines[i] : null }; });
    const rest = P.lines.filter((_, k) => !used.has(k));
    const dl = dialog(html`<form class="stack px-dlg" style="gap:8px"><b style="font-size:16px">Ghép ${P.doc_no || '(không có số đơn)'} vào lần nhận ${t.branch_code} · ${t.received_at ? dmy(String(t.received_at).slice(0, 10)).slice(0, 5) : ''}</b>
      ${t.deliv_path ? html`<a target="_blank" rel="noopener" class="px-inv"><img data-path="${t.deliv_path}" alt="Ảnh hoá đơn giao NV chụp"><span>📄 ảnh hoá đơn giao NV chụp · bấm để phóng to</span></a>` : html`<div class="alert warn" style="margin:0">Không có ảnh hoá đơn giao${t.deliv_note ? ` — ${t.deliv_note}` : ''}.</div>`}
      <div class="table-wrap"><table class="table px-t"><thead><tr><th>NV ghi</th><th>Phiếu xuất</th><th></th></tr></thead><tbody>
        ${pairs.map(({ l, x }) => html`<tr><td>${l.name} <b>${q3(l.qty_received)}</b></td><td>${x ? html`${x.name} <b>${q3(x.qty)}</b>` : '—'}</td><td>${!x ? html`<span class="pill off">ngoài phiếu</span>` : Number(x.qty) === Number(l.qty_received) ? html`<span class="pill ok">khớp</span>` : html`<span class="pill warn">${Number(l.qty_received) < Number(x.qty) ? 'thiếu' : 'thừa'} ${q3(Math.abs(Number(x.qty) - Number(l.qty_received)))}</span>`}</td></tr>`)}
        ${rest.map((x) => html`<tr><td>—</td><td>${x.name} <b>${q3(x.qty)}</b></td><td><span class="pill warn">NV chưa ghi (nhận 0)</span></td></tr>`)}</tbody></table></div>
      <div class="st-meta">${P.lines.length} món · ${fmt(P.total)}đ · ngày xuất ${P.ship_at ? dmy(P.ship_at.slice(0, 10)) : '?'}</div>
      <div class="px-err"></div><div class="toolbar" style="justify-content:flex-end;gap:6px"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghép phiếu</button></div></form>`);
    signLinks(dl);
    const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (e) => { e.preventDefault(); const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const id = await rpc('app_nh_create', { p: { branch_id: t.branch_id, doc_no: P.doc_no, ship_at: P.ship_at, kho_code: P.kho_code, kho_name: P.kho_name, ref: P.ref, src_creator: P.src_creator, total: P.total, lines: P.lines, merge_id: t.id } });
        try { await uploadFiles('hd' + id, [file], (path, ff, size, mime) => rpc('app_kt_invoice_file_add', { p_invoice: id, p_path: path, p_name: ff.name, p_mime: mime, p_size: size })); } catch (_) { /* tệp gốc không bắt buộc */ }
        dl.close(); flash(`Đã ghép phiếu ${P.doc_no}.`); rerender();
      } catch (er) { btn.disabled = false; dl.querySelector('.px-err').innerHTML = str(html`<div class="alert error">${er.message}</div>`); } });
  }
}

const PX_CSS = html`<style>
  .px-wrap { max-width: 1100px; display: flex; flex-direction: column; gap: 10px; }
  .px-bar { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; } .px-f { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .px-q { flex: 1 1 180px; min-width: 0; max-width: 320px; } .px-mon { display: flex; align-items: center; gap: 6px; margin-left: auto; } .px-mon .btn { width: auto; }
  .gh-tabs { display: flex; gap: 6px; flex-wrap: wrap; } .gh-tabs a { border: 1.5px solid var(--primary); color: var(--primary); border-radius: 10px; padding: 6px 10px; font-weight: 700; font-size: 13px; text-decoration: none; background: var(--card); } .gh-tabs a.on { background: var(--primary); color: #fff; }
  .px-need { border: 2px solid #d99a3a; background: #fff8ea; display: flex; flex-direction: column; gap: 4px; }
  .px-nrow { display: flex; gap: 10px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); flex-wrap: wrap; } .px-nrow .grow { flex: 1 1 240px; min-width: 0; }
  .px-day[hidden], .px-row[hidden] { display: none; }
  .px-dh { display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; color: var(--ink-2); margin: 6px 4px 4px; }
  .px-rows { padding: 2px 12px; }
  .px-row { display: grid; grid-template-columns: 48px 120px 64px 100px minmax(0, 1fr) 130px 250px; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
  .px-row:first-child { border-top: none; } .px-tot, .px-n { text-align: right; font-variant-numeric: tabular-nums; } .px-st { display: flex; gap: 3px; flex-wrap: wrap; }
  .px-act { display: flex; gap: 4px; align-items: center; justify-content: flex-end; flex-wrap: wrap; } .px-act .btn { width: auto; } .px-act .st-meta { font-size: 11.5px; }
  .px-dlg { width: min(560px, calc(100vw - 40px)); max-height: calc(100vh - 80px); overflow: auto; } .px-dlg.px-wide { width: min(980px, calc(100vw - 32px)); }
  .px-tl { display: flex; align-items: center; gap: 4px; font-size: 11.5px; } .px-tl span { padding: 3px 9px; border-radius: 99px; background: var(--line-soft); color: var(--ink-2); font-weight: 800; } .px-tl span.on { background: #2f3e33; color: #fff; } .px-tl i { width: 10px; height: 2px; background: var(--line); }
  .px-t td, .px-t th { padding: 6px 8px; } .px-t .r { text-align: right; } .px-bad { color: #b45309; font-weight: 800; }
  .px-media { display: flex; gap: 12px; flex-wrap: wrap; } .px-media img { width: 120px; height: 90px; object-fit: cover; border-radius: 8px; background: var(--line-soft); display: block; }
  .px-ph { display: flex; gap: 4px; flex-wrap: wrap; } .px-ph img { width: 64px; height: 48px; }
  .px-inv { display: block; position: relative; } .px-inv img { width: 100%; max-height: 260px; object-fit: contain; background: #1f2622; border-radius: 10px; display: block; } .px-inv span { position: absolute; left: 6px; bottom: 6px; background: rgba(0,0,0,.6); color: #fff; font-size: 11px; border-radius: 5px; padding: 1px 6px; }
  .px-mrows { display: flex; flex-direction: column; } .px-mr { display: grid; grid-template-columns: minmax(0, 1.3fr) 90px 150px 54px 64px 120px minmax(170px, 1.6fr); gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); font-size: 13px; }
  .px-mr .r { text-align: right; } .px-fn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .px-mr select { width: auto; max-width: 100%; margin-top: 3px; } .px-mr .px-sb { width: 110px; }
  @media (max-width: 760px) {
    .px-row { grid-template-columns: max-content minmax(0, 1fr) max-content; grid-template-areas: "br doc tot" "st st st" "hd act act"; }
    .px-row .px-br { grid-area: br; } .px-row .px-doc { grid-area: doc; font-weight: 800; }
    .px-row .px-n { display: none; } .px-row .px-tot { grid-area: tot; } .px-row .px-st { grid-area: st; } .px-row .px-hd { grid-area: hd; } .px-row .px-act { grid-area: act; }
    .px-mon { margin-left: 0; } .px-q { max-width: none; }
    .px-mr { grid-template-columns: 1fr 1fr; } .px-mr .px-fn { grid-column: 1 / -1; font-weight: 700; } .px-mr > span:last-child { grid-column: 1 / -1; }
  }
</style>`;
