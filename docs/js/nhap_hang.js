// Nhập hàng từ kho tổng (bước 31): đọc phiếu xuất Excel, thẻ nhận hàng trong phiếu chốt ca, quản lý đối soát từng ảnh, chi tiết cho kế toán
import { rpc, sb } from './sb.js';
import { dmy, dt, fmt } from './tien.js';
import { $, $$, dialog, hhmm, html, showSaved, str } from './ui.js';
import { xlsx, normKey, normText } from './excel.js';
import { BUCKET, signLinks, uploadFiles } from './pages/ke_toan_hoa_don.js';

export const fq = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));
const pq = (s) => { const t = String(s ?? '').trim().replace(/\s/g, ''); if (t === '') return null; const v = Number(t.replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const DRAFT = new Map();   // số nhân viên đang gõ (giữ lại khi trang tải lại sau lúc chụp ảnh)
const same = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(Number(a) - Number(b)) < 0.0005;

export function stateLabel(d) {
  if (d.state === 'dang_chuyen') return ['Đang chuyển', 'info'];
  if (d.state === 'cho_hoa_don') return ['Chờ hóa đơn', 'warn'];
  if (d.complete) return ['Hoàn tất', 'ok'];
  return d.result === 'du' ? ['Đã nhận đủ', 'ok'] : ['Nhận lệch hóa đơn', 'off'];
}
export const titleOf = (d) => (d.doc_no ? html`Hóa đơn <strong>${d.doc_no}</strong>${d.kind === 'khong_hd' || d.matched_at ? ' (ghép phiếu nhận không hóa đơn)' : ''}` : html`<strong>Nhận hàng KHÔNG có hóa đơn</strong>`);
export const missChips = (d) => html`${(d.missing || []).map((m) => html`<span class="pill warn nh-miss">${m}</span>`)}`;

// ---------------------------------------------------------------- Đọc file Excel "Phiếu xuất điều chuyển"
const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
function parseDate(v, X) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') { const d = X.SSF.parse_date_code(v); if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')} ${String(d.H).padStart(2, '0')}:${String(d.M).padStart(2, '0')}`; }
  const m = String(v).match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}${m[4] ? ` ${m[4].padStart(2, '0')}:${m[5]}` : ' 00:00'}`;
  const iso = String(v).match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]} ${iso[4] || '00'}:${iso[5] || '00'}` : null;
}
export async function parseXuatExcel(file) {
  const X = await xlsx();
  let wb;
  try { wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: false }); } catch (e) { throw new Error('Không mở được file Excel: ' + e.message); }
  const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });
  const hi = rows.findIndex((r) => { const k = (r || []).map(normKey); return k.includes('TEN HANG') && k.includes('SO LUONG'); });
  if (hi < 0) throw new Error('Không thấy bảng hàng (cần cột "Tên hàng" và "Số lượng"). File có đúng là phiếu xuất kho tổng không?');
  const meta = {};
  rows.slice(0, hi).forEach((r) => {
    const cells = (r || []).filter((c) => c !== null && c !== '');
    if (!cells.length) return;
    let label; let value;
    if (cells.length === 1 && String(cells[0]).includes(':')) { const s = String(cells[0]); label = s.slice(0, s.indexOf(':')); value = s.slice(s.indexOf(':') + 1); }
    else { label = cells[0]; value = cells[1]; }
    meta[normKey(label)] = typeof value === 'string' ? normText(value) : value;
    if (!meta._title && cells.length === 1 && !String(cells[0]).includes(':')) meta._title = normText(cells[0]);
  });
  const H = rows[hi].map(normKey);
  const col = (...names) => names.map((n) => H.indexOf(n)).find((i) => i >= 0) ?? -1;
  const c = { code: col('MA HANG', 'MA SP', 'MA'), name: col('TEN HANG', 'TEN SAN PHAM'), unit: col('TEN DON VI TINH', 'DON VI TINH', 'DVT', 'MA DON VI TINH'),
    qty: col('SO LUONG', 'SL'), price: col('DON GIA', 'GIA'), amount: col('TONG', 'THANH TIEN', 'TONG TIEN') };
  const lines = []; let total = null;
  for (const r of rows.slice(hi + 1)) {
    if (!r || r.every((x) => x === null || x === '')) continue;
    const first = normKey(r.find((x) => x !== null && x !== '') ?? '');
    if (first.startsWith('TONG')) { total = parseNum(c.amount >= 0 ? r[c.amount] : null) ?? parseNum([...r].reverse().find((x) => parseNum(x) !== null)); break; }
    const name = normText(r[c.name]);
    if (!name) continue;
    lines.push({ code: c.code >= 0 ? normText(r[c.code]) : '', name, unit: c.unit >= 0 ? normText(r[c.unit]) : '',
      qty: parseNum(r[c.qty]) ?? 0, price: c.price >= 0 ? parseNum(r[c.price]) : null, amount: c.amount >= 0 ? parseNum(r[c.amount]) : null });
  }
  if (!lines.length) throw new Error('File không có dòng hàng nào.');
  const sum = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const kho = String(meta['KHO NHAP'] || '');
  const km = kho.match(/^(.*?)\s*\(([A-Za-z0-9]+)\)\s*$/);
  return { title: meta._title || '', doc_no: normText(meta['SO DON'] || meta['SO PHIEU'] || meta['MA PHIEU'] || ''),
    ship_at: parseDate(meta['THOI GIAN XUAT'] ?? meta['NGAY XUAT'] ?? meta['NGAY TAO'], X),
    kho_name: km ? km[1] : kho, kho_code: km ? km[2] : (kho ? normKey(kho).replace(/ /g, '_') : ''),
    kho_xuat: String(meta['KHO XUAT'] || ''), ref: String(meta['THAM CHIEU'] || ''), src_creator: String(meta['NGUOI TAO'] || ''),
    lines, total: total ?? sum, sum, file_name: file.name };
}
// Đoán cơ sở từ tên kho nhập: "Milano Coffee - Lê Hồng Phong" → chữ cái đầu "LHP"
export function guessBranch(khoName, branches) {
  const tail = String(khoName || '').split(' - ').pop();
  const ini = normKey(tail).split(' ').map((w) => w[0]).join('');
  const k = normKey(khoName);
  return (branches.find((b) => normKey(b.code) === ini || normKey(b.display_code || '') === ini)
    || branches.find((b) => k.includes(normKey(b.name)) || normKey(b.name).includes(normKey(tail))) || {}).id || null;
}

// ---------------------------------------------------------------- Bảng món (chỉ xem)
export function linesView(d, { money = false } = {}) {
  return html`<div class="table-wrap"><table class="table rt nh-t"><thead><tr><th>Món hàng</th><th class="r">Hóa đơn</th><th class="r">NV nhận</th><th class="r">QL xác nhận</th><th class="r">Ảnh</th>${money ? html`<th class="r">Thành tiền</th>` : ''}</tr></thead>
    <tbody>${d.lines.map((l) => { const off = d.state !== 'dang_chuyen' && !same(l.qty_invoice, l.qty) && !(l.qty_invoice === null && !Number(l.qty));
      return html`<tr class="${off ? 'nh-off' : ''}"><td data-label="Món"><strong>${l.name}</strong> <span class="st-meta">${[l.code, l.unit].filter(Boolean).join(' · ')}</span>${l.check_note ? html`<div class="st-meta">QL: ${l.check_note}</div>` : ''}</td>
        <td class="r" data-label="Hóa đơn">${l.qty_invoice === null ? html`<span class="st-meta">không có</span>` : fq(l.qty_invoice)}</td>
        <td class="r" data-label="NV nhận">${fq(l.qty_received)}</td>
        <td class="r" data-label="QL xác nhận">${l.checked_at ? html`${same(l.qty_checked, l.qty_received) ? '✓' : html`<strong class="nh-red">${fq(l.qty_checked)}</strong>`}` : '—'}</td>
        <td class="r" data-label="Ảnh">${l.photos ? `📷 ${l.photos}` : d.state === 'dang_chuyen' ? '' : html`<span class="nh-red">thiếu</span>`}</td>
        ${money ? html`<td class="r" data-label="Thành tiền">${l.amount ? fmt(l.amount) : ''}</td>` : ''}</tr>`; })}</tbody></table></div>`;
}
export const photoStrip = (d, { del = false, tag = false } = {}) => html`<div class="photos nh-photos">${d.photos.map((p) => html`<figure class="ph" data-ph="${p.id}">
    <a target="_blank" rel="noopener"><img alt="Ảnh hàng nhận" loading="lazy" data-path="${p.path}"></a>
    <figcaption class="${p.lines.length ? '' : 'nh-untag'}">${p.lines.length ? `${p.lines.length} món` : 'chưa gắn món'}</figcaption>
    ${tag ? html`<button type="button" class="nh-tag" data-ph="${p.id}" aria-label="Gắn món cho ảnh">✎</button>` : ''}
    ${del ? html`<button type="button" class="ph-del nh-pdel" data-ph="${p.id}" aria-label="Xóa ảnh">×</button>` : ''}</figure>`)}</div>`;

// Hộp chọn món có trong ảnh
function tagDialog(d, photo, url) {
  return new Promise((done) => {
    const sel = new Set(photo.lines);
    const lines = [...d.lines].sort((a, b) => (a.photos ? 1 : 0) - (b.photos ? 1 : 0) || a.sort - b.sort);
    const dl = dialog(html`<form class="stack nh-dlg" style="gap:10px"><h2 style="margin:0">Ảnh này có những món nào?</h2>
      ${url ? html`<img class="nh-big" src="${url}" alt="Ảnh hàng">` : ''}
      <div class="st-meta">Tick các món nhìn thấy đủ số lượng trong ảnh. Món chưa có ảnh nào xếp lên đầu.</div>
      <div class="nh-tags">${lines.map((l) => html`<label class="nh-tagrow ${l.photos ? '' : 'todo'}"><input type="checkbox" class="check" value="${l.id}" ${sel.has(l.id) ? 'checked' : ''}>
        <span><strong>${l.name}</strong> <span class="st-meta">${fq(l.qty_received ?? l.qty_invoice)} ${l.unit || ''}${l.photos ? ` · đã có ${l.photos} ảnh` : ' · chưa có ảnh'}</span></span></label>`)}</div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Để sau</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    dl.addEventListener('close', () => done(null));
    dl.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const ids = $$('input[type=checkbox]:checked', dl).map((i) => Number(i.value));
      try { await rpc('app_nh_photo_tag', { p_photo: photo.id, p_lines: ids }); dl.close(); done(ids); } catch (e) { showSaved(e.message, true); }
    });
  });
}
async function signedUrl(path) { try { const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600); return data?.signedUrl || null; } catch (_) { return null; } }

// ---------------------------------------------------------------- Trong phiếu chốt ca
// opts: { canRecv (nhân viên đang chốt phiếu), canPhoto, canRecon (quản lý đối soát), onRecon (sau khi đối soát) }
export async function mountDeliveries(box, R, opts) {
  if (!box) return;
  let D;
  try { D = await rpc('app_nh_for_report', { p_report: R.id }); } catch (_) { return; }
  const rows = D.rows;
  const reload = () => mountDeliveries(box, R, opts);
  const cat = D.catalog || [];
  const card = (d) => {
    const [lab, cls] = stateLabel(d);
    const recvEd = opts.canRecv && (d.state === 'dang_chuyen' || (d.staff_edit && d.received_report_id === R.id)) && d.kind === 'hoa_don' && d.state !== 'cho_hoa_don';
    const rcEd = opts.canRecv && d.state === 'cho_hoa_don' && d.staff_edit;
    const photoEd = opts.canPhoto && d.state !== 'dang_chuyen';   // bổ sung ảnh sau khi đã báo nhận
    const head = html`<div class="nh-head"><div>${titleOf(d)}<div class="st-meta">${[d.doc_no ? `Giao ${dt(d.ship_at || d.work_date)}` : '', d.received_by ? `Nhận: ${d.received_by} ${dt(d.received_at)} (ca ${d.received_shift || '?'})` : '', d.recon_by ? `QL đối soát: ${d.recon_by}` : ''].filter(Boolean).join(' · ')}</div></div>
      <div class="nh-pills"><span class="pill ${cls}">${lab}</span>${missChips(d)}</div></div>`;
    let body;
    if (recvEd) {
      body = html`<div class="st-meta">Kiểm từng món: nhập số thực nhận (bấm <strong>Đủ</strong> nếu đúng như hóa đơn) và chụp ảnh thấy đủ số lượng — 1 ảnh có thể gồm nhiều món.</div>
        <div class="table-wrap"><table class="table rt nh-t"><thead><tr><th>Món hàng</th><th class="r">Hóa đơn</th><th>Thực nhận</th><th class="r">Ảnh</th></tr></thead>
        <tbody>${d.lines.map((l) => html`<tr data-line="${l.id}"><td data-label="Món"><strong>${l.name}</strong> <span class="st-meta">${[l.code, l.unit].filter(Boolean).join(' · ')}</span></td>
          <td class="r" data-label="Hóa đơn">${fq(l.qty_invoice)} ${l.unit || ''}</td>
          <td data-label="Thực nhận"><span class="nh-qbox"><input class="input sm nh-q" inputmode="decimal" data-inv="${l.qty_invoice ?? ''}" value="${DRAFT.has(l.id) ? DRAFT.get(l.id) : (l.qty_received ?? '')}" aria-label="Thực nhận ${l.name}"><button type="button" class="btn sm secondary nh-du">Đủ</button></span></td>
          <td class="r" data-label="Ảnh"><label class="nh-cam" title="Chụp ảnh riêng món này">📷 ${l.photos || ''}<input type="file" class="nh-cam-in" accept="image/*" capture="environment" hidden></label></td></tr>`)}</tbody></table></div>
        <div class="toolbar" style="gap:8px"><button type="button" class="btn sm secondary nh-duall">Đủ tất cả</button>
          <label class="btn sm secondary">📷 Chụp / chọn ảnh hàng<input type="file" class="nh-ph-in" accept="image/*" multiple hidden></label><span class="st-meta nh-st"></span></div>
        ${photoStrip(d, { del: true, tag: true })}
        <input class="input sm nh-note" placeholder="Ghi chú nhận hàng (không bắt buộc)" value="${d.receive_note || ''}">
        <div><button type="button" class="btn sm nh-send">${d.state === 'dang_chuyen' ? 'Gửi báo cáo nhận hàng' : 'Cập nhật báo cáo nhận hàng'}</button>
          ${d.state !== 'dang_chuyen' ? html`<span class="st-meta"> Sửa được tới hết ngày nhận.</span>` : ''}</div>`;
    } else if (rcEd) {
      body = rcEditor(d);
    } else {
      body = html`${d.state === 'dang_chuyen' ? html`<div class="st-meta">${d.n_lines} món đang chuyển tới. ${opts.canRecv ? '' : 'Nhân viên ca nhận hàng sẽ kiểm trong phiếu chốt ca.'}</div>` : ''}
        ${linesView(d)}
        ${d.photos.length || photoEd ? photoStrip(d, { tag: photoEd && !d.recon_at, del: photoEd && !d.recon_at }) : ''}
        ${photoEd && d.n_unphoto ? html`<div class="toolbar" style="gap:8px"><label class="btn sm secondary">📷 Bổ sung ảnh (${d.n_unphoto} món thiếu ảnh)<input type="file" class="nh-ph-in" accept="image/*" multiple hidden></label><span class="st-meta nh-st"></span></div>` : ''}
        ${d.receive_note ? html`<div class="st-meta">Ghi chú: ${d.receive_note}</div>` : ''}
        ${opts.canRecon && d.state !== 'dang_chuyen' ? html`<div><button type="button" class="btn sm nh-recon">${d.n_unchecked ? `Đối soát hàng (${d.n_lines - d.n_unchecked}/${d.n_lines} món)` : '✓ Đã đối soát hết · xem lại'}</button></div>` : ''}`;
    }
    return html`<article class="nh-card ${d.state === 'dang_chuyen' || d.n_unchecked || (d.missing || []).length ? 'todo' : ''}" data-id="${d.id}">${head}${body}</article>`;
  };
  const rcEditor = (d = { lines: [], photos: [] }) => html`
    <div class="st-meta">Ghi từng món đã nhận (gõ vài chữ để chọn tên món từng nhận), chụp ảnh thấy đủ số lượng. Kế toán sẽ tải hóa đơn và ghép vào phiếu này.</div>
    <div class="nh-rc">${(d.lines.length ? d.lines : [{}]).map((l) => rcRow(l))}</div>
    <div class="toolbar" style="gap:8px"><button type="button" class="btn sm secondary nh-rc-add">+ Thêm món</button>
      ${d.id ? html`<label class="btn sm secondary">📷 Chụp / chọn ảnh hàng<input type="file" class="nh-ph-in" accept="image/*" multiple hidden></label><span class="st-meta nh-st"></span>` : html`<span class="st-meta">Lưu phiếu rồi chụp ảnh.</span>`}</div>
    ${d.id ? photoStrip(d, { del: true, tag: true }) : ''}
    <input class="input sm nh-note" placeholder="Ghi chú (vd: tài xế giao, chưa có phiếu)" value="${d.receive_note || ''}">
    <div class="toolbar" style="gap:8px"><button type="button" class="btn sm nh-rc-save">${d.id ? 'Lưu phiếu nhận hàng' : 'Lưu phiếu nhận hàng (chờ hóa đơn)'}</button>${d.id ? '' : html`<button type="button" class="btn sm secondary nh-rc-cancel">Hủy</button>`}</div>`;
  const rcRow = (l = {}) => html`<div class="nh-rcrow" data-line="${l.id || ''}" data-code="${l.code || ''}">
    <input class="input sm nh-rc-name" list="nh-cat" placeholder="Tên món" value="${l.name || ''}" aria-label="Tên món">
    <input class="input sm nh-rc-unit" placeholder="ĐVT" value="${l.unit || ''}" aria-label="Đơn vị">
    <input class="input sm nh-rc-qty" inputmode="decimal" placeholder="SL" value="${l.qty_received ?? ''}" aria-label="Số lượng">
    <button type="button" class="btn sm secondary danger nh-rc-del" aria-label="Bỏ món">×</button></div>`;

  const newBtn = opts.canRecv ? html`<div><button type="button" class="btn sm secondary" id="nh-new">+ Nhận hàng KHÔNG có hóa đơn</button></div>` : '';
  box.innerHTML = str(html`<datalist id="nh-cat">${cat.map((c) => html`<option value="${c.name}">${[c.code, c.unit].filter(Boolean).join(' · ')}</option>`)}</datalist>
    ${rows.length ? rows.map(card) : html`<div class="st-meta">Không có hàng kho tổng đang chuyển tới cơ sở hoặc nhận trong ca này.</div>`}
    ${newBtn}<div id="nh-newbox"></div>`);
  signLinks(box);

  const byId = (id) => rows.find((x) => x.id === Number(id));
  const uploadFor = async (d, files, st, lineIds) => {
    const ids = [];
    await uploadFiles('nhan' + d.id, files, async (path) => { ids.push({ id: await rpc('app_nh_photo_add', { p_id: d.id, p_path: path, p_lines: lineIds || [] }), path }); }, st);
    return ids;
  };
  const bindRc = (c, d) => {
    const fillCat = (row) => { const nm = row.querySelector('.nh-rc-name').value.trim(); const hit = cat.find((x) => normKey(x.name) === normKey(nm));
      if (hit) { row.dataset.code = hit.code || ''; if (!row.querySelector('.nh-rc-unit').value) row.querySelector('.nh-rc-unit').value = hit.unit || ''; } };
    c.addEventListener('change', (ev) => { if (ev.target.classList.contains('nh-rc-name')) fillCat(ev.target.closest('.nh-rcrow')); });
    c.addEventListener('click', (ev) => { if (ev.target.classList.contains('nh-rc-del')) { const all = $$('.nh-rcrow', c); if (all.length > 1) ev.target.closest('.nh-rcrow').remove(); } });
    c.querySelector('.nh-rc-add')?.addEventListener('click', () => c.querySelector('.nh-rc').insertAdjacentHTML('beforeend', str(rcRow())));
    c.querySelector('.nh-rc-cancel')?.addEventListener('click', () => { c.innerHTML = ''; });
    c.querySelector('.nh-rc-save')?.addEventListener('click', async () => {
      const lines = $$('.nh-rcrow', c).map((r) => ({ id: r.dataset.line ? Number(r.dataset.line) : null, code: r.dataset.code || null, name: r.querySelector('.nh-rc-name').value.trim(),
        unit: r.querySelector('.nh-rc-unit').value.trim(), qty: pq(r.querySelector('.nh-rc-qty').value) })).filter((l) => l.name || l.qty !== null);
      if (lines.some((l) => !l.name || !(l.qty > 0))) { showSaved('Mỗi món cần tên và số lượng lớn hơn 0.', true); return; }
      try { await rpc('app_nh_receipt_save', { p_id: d?.id || null, p_report: R.id, p_lines: lines, p_note: c.querySelector('.nh-note').value });
        showSaved((d?.id ? 'Đã lưu phiếu nhận hàng' : 'Đã lưu — giờ chụp ảnh từng món') + ' · ' + hhmm()); reload(); } catch (e) { showSaved(e.message, true); }
    });
  };
  $('#nh-new', box)?.addEventListener('click', () => { const nb = $('#nh-newbox', box); nb.innerHTML = str(html`<article class="nh-card todo"><div class="nh-head"><strong>Nhận hàng KHÔNG có hóa đơn</strong></div>${rcEditor()}</article>`); bindRc(nb.firstElementChild, null); });

  $$('.nh-card[data-id]', box).forEach((c) => {
    const d = byId(c.dataset.id); const st = c.querySelector('.nh-st');
    if (d.state === 'cho_hoa_don') bindRc(c, d);
    const keep = (i) => DRAFT.set(Number(i.closest('tr').dataset.line), i.value);
    c.querySelectorAll('.nh-du').forEach((b) => b.addEventListener('click', () => { const i = b.parentElement.querySelector('.nh-q'); i.value = i.dataset.inv; i.classList.remove('nh-bad'); keep(i); }));
    c.querySelector('.nh-duall')?.addEventListener('click', () => c.querySelectorAll('.nh-q').forEach((i) => { if (i.value.trim() === '') { i.value = i.dataset.inv; keep(i); } }));
    c.querySelectorAll('.nh-q').forEach((i) => i.addEventListener('input', () => { keep(i); i.classList.toggle('nh-bad', i.value.trim() !== '' && !same(pq(i.value), i.dataset.inv)); }));
    c.querySelectorAll('.nh-q').forEach((i) => i.classList.toggle('nh-bad', i.value.trim() !== '' && !same(pq(i.value), i.dataset.inv)));
    c.querySelectorAll('.nh-cam-in').forEach((inp) => inp.addEventListener('change', async () => {
      try { await uploadFor(d, [...inp.files], st, [Number(inp.closest('tr').dataset.line)]); reload(); } catch (e) { showSaved('Không tải được ảnh: ' + e.message, true); }
    }));
    c.querySelectorAll('.nh-ph-in').forEach((inp) => inp.addEventListener('change', async () => {
      try {
        const added = await uploadFor(d, [...inp.files], st);
        for (const p of added) { const url = await signedUrl(p.path); await tagDialog(d, { id: p.id, lines: [] }, url); }
        reload();
      } catch (e) { showSaved('Không tải được ảnh: ' + e.message, true); }
    }));
    c.querySelectorAll('.nh-tag').forEach((b) => b.addEventListener('click', async () => {
      const p = d.photos.find((x) => x.id === Number(b.dataset.ph)); const r = await tagDialog(d, p, await signedUrl(p.path)); if (r) reload();
    }));
    c.querySelectorAll('.nh-pdel').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Xóa ảnh này?')) return;
      try { const path = await rpc('app_nh_photo_del', { p_photo: Number(b.dataset.ph) }); if (path) await sb.storage.from(BUCKET).remove([path]); reload(); } catch (e) { showSaved(e.message, true); }
    }));
    c.querySelector('.nh-send')?.addEventListener('click', async () => {
      const lines = $$('tr[data-line]', c).map((tr) => ({ id: Number(tr.dataset.line), qty: pq(tr.querySelector('.nh-q').value) }));
      const bad = lines.filter((l) => l.qty === null || Number.isNaN(l.qty) || l.qty < 0);
      if (bad.length) { showSaved(`Còn ${bad.length} món chưa nhập số thực nhận (bấm "Đủ" nếu nhận đủ).`, true); bad.forEach((l) => c.querySelector(`tr[data-line="${l.id}"] .nh-q`).classList.add('nh-bad')); return; }
      try {
        const r = await rpc('app_nh_receive', { p_id: d.id, p_report: R.id, p_lines: lines, p_note: c.querySelector('.nh-note').value });
        lines.forEach((l) => DRAFT.delete(l.id));
        showSaved(r.mismatch ? `Đã gửi — ${r.mismatch} món lệch hóa đơn, đã báo quản lý và kế toán` : `Đã gửi — nhận đủ · ${hhmm()}`);
        reload();
      } catch (e) { showSaved(e.message, true); }
    });
    c.querySelector('.nh-recon')?.addEventListener('click', () => reconDialog(d, () => { reload(); if (opts.onRecon) opts.onRecon(); }));
  });
}

// ---------------------------------------------------------------- Quản lý đối soát: lần lượt từng ảnh, bấm Đối soát → ảnh tiếp
async function reconDialog(d0, onDone) {
  let d = d0; let changed = false;
  const urls = {};
  await Promise.all(d.photos.map(async (p) => { urls[p.id] = await signedUrl(p.path); }));
  const steps = () => { const s = d.photos.map((p) => ({ photo: p, lines: d.lines.filter((l) => p.lines.includes(l.id)) })).filter((x) => x.lines.length);
    const loose = d.lines.filter((l) => !d.photos.some((p) => p.lines.includes(l.id)));
    if (loose.length) s.push({ photo: null, lines: loose }); return s; };
  let idx = Math.max(0, steps().findIndex((s) => s.lines.some((l) => !l.checked_at)));
  const dl = dialog(html`<div class="stack nh-dlg nh-rcd" style="gap:10px"></div>`);
  const refresh = async () => { const D = await rpc('app_nh_for_report', { p_report: d.received_report_id }); d = D.rows.find((x) => x.id === d.id) || d; };
  const draw = () => {
    const S = steps(); if (!S.length) { dl.querySelector('.nh-rcd').innerHTML = str(html`<h2 style="margin:0">Đối soát hàng</h2><div class="st-meta">Không có món nào.</div><button type="button" class="btn sm" data-x>Đóng</button>`); return; }
    idx = Math.min(idx, S.length - 1); const s = S[idx];
    const done = d.lines.filter((l) => l.checked_at).length;
    dl.querySelector('.nh-rcd').innerHTML = str(html`
      <div class="nh-head"><h2 style="margin:0">Đối soát hàng · ${s.photo ? `Ảnh ${idx + 1}/${S.length - (S[S.length - 1].photo ? 0 : 1)}` : 'Món chưa có ảnh'}</h2><span class="st-meta">Đã đối soát ${done}/${d.lines.length} món</span></div>
      ${s.photo ? html`<a href="${urls[s.photo.id] || '#'}" target="_blank" rel="noopener"><img class="nh-big" src="${urls[s.photo.id] || ''}" alt="Ảnh hàng"></a><div class="st-meta">Chụp bởi ${s.photo.by || ''} · ${dt(s.photo.at)}</div>`
        : html`<div class="alert warn">Các món này nhân viên chưa chụp ảnh — vẫn đối soát được, nhưng hồ sơ còn ghi THIẾU ẢNH cho tới khi nhân viên bổ sung.</div>`}
      <div class="nh-rclist">${s.lines.map((l) => html`<div class="nh-rcl ${l.checked_at ? 'ok' : ''}" data-line="${l.id}">
          <div class="grow"><strong>${l.name}</strong> <span class="st-meta">${l.unit || ''}</span>
            <div class="st-meta">Hóa đơn: ${l.qty_invoice === null ? 'không có' : fq(l.qty_invoice)} · NV nhận: <strong>${fq(l.qty_received)}</strong>${l.checked_at ? html` · QL: <strong>${fq(l.qty_checked)}</strong>${l.check_note ? ` (${l.check_note})` : ''}` : ''}</div></div>
          ${l.checked_at ? html`<span class="pill ok">✓</span><button type="button" class="btn sm secondary nh-un">Bỏ</button>`
            : html`<button type="button" class="btn sm secondary nh-wrong">Sai số lượng</button>`}
          <div class="nh-fix" hidden><input class="input sm nh-fq" inputmode="decimal" placeholder="Số đúng"><input class="input sm nh-fn" placeholder="Ghi chú (bắt buộc)"><button type="button" class="btn sm nh-fsave">Lưu</button></div></div>`)}</div>
      <div class="toolbar" style="justify-content:space-between;gap:8px">
        <button type="button" class="btn sm secondary" data-prev ${idx === 0 ? 'disabled' : ''}>‹ Trước</button>
        <span class="toolbar" style="gap:8px"><button type="button" class="btn sm secondary" data-x>Đóng</button>
        ${s.lines.some((l) => !l.checked_at) ? html`<button type="button" class="btn sm" data-ok>✓ Đối soát${idx < S.length - 1 ? ' · ảnh tiếp ›' : ''}</button>`
          : idx < S.length - 1 ? html`<button type="button" class="btn sm" data-next>Ảnh tiếp ›</button>` : html`<button type="button" class="btn sm" data-x>Xong</button>`}</span></div>`);
  };
  dl.addEventListener('click', async (ev) => {
    const t = ev.target; const row = t.closest('.nh-rcl'); const S = steps(); const s = S[idx];
    try {
      if (t.matches('[data-x]')) { dl.close(); finish(); return; }
      if (t.matches('[data-prev]')) { idx -= 1; draw(); return; }
      if (t.matches('[data-next]')) { idx += 1; draw(); return; }
      if (t.matches('[data-ok]')) {
        t.disabled = true;
        for (const l of s.lines.filter((x) => !x.checked_at)) await rpc('app_nh_check', { p_line: l.id, p_qty: null, p_note: null });
        changed = true; await refresh(); if (idx < S.length - 1) idx += 1; draw(); return;
      }
      if (t.classList.contains('nh-wrong')) { row.querySelector('.nh-fix').hidden = false; row.querySelector('.nh-fq').focus(); return; }
      if (t.classList.contains('nh-fsave')) {
        const q = pq(row.querySelector('.nh-fq').value); const n = row.querySelector('.nh-fn').value.trim();
        if (q === null || Number.isNaN(q) || q < 0) { showSaved('Nhập số lượng đúng.', true); return; }
        if (!n) { showSaved('Ghi chú lý do sai số lượng.', true); return; }
        await rpc('app_nh_check', { p_line: Number(row.dataset.line), p_qty: q, p_note: n });
        changed = true; showSaved('Đã lưu — đã báo nhân viên kiểm kê sai'); await refresh(); draw(); return;
      }
      if (t.classList.contains('nh-un')) { await rpc('app_nh_uncheck', { p_line: Number(row.dataset.line) }); changed = true; await refresh(); draw(); }
    } catch (e) { t.disabled = false; showSaved(e.message, true); }
  });
  let fired = false;
  const finish = () => { if (fired) return; fired = true; if (changed) onDone(); };
  dl.addEventListener('close', finish);
  draw();
}

// ---------------------------------------------------------------- Chi tiết (kế toán / quản lý)
export function detailHtml(d, money) {
  const [lab, cls] = stateLabel(d);
  return html`<div class="stack nh-dlg" style="gap:10px">
    <div class="nh-head"><div>${titleOf(d)} · ${d.branch_code}<div class="st-meta">${d.doc_no ? `Giao ${dt(d.ship_at || d.work_date)} · tải: ${d.created_by || ''} ${dt(d.created_at)}` : `Nhân viên tạo ${dt(d.created_at)}`}${d.ref ? ` · tham chiếu ${d.ref}` : ''}</div>
      <div class="st-meta">${d.received_by ? `Nhận: ${d.received_by} · ca ${d.received_shift || '?'} · ${dt(d.received_at)}` : 'Chưa báo nhận'}${d.recon_by ? ` · QL đối soát: ${d.recon_by} ${dt(d.recon_at)}` : ''}</div></div>
      <div class="nh-pills"><span class="pill ${cls}">${lab}</span>${missChips(d)}</div></div>
    ${money && d.total !== null && d.total !== undefined ? html`<div><strong>Tổng bill: ${fmt(d.total)}đ</strong></div>` : ''}
    ${d.files?.length ? html`<div>${d.files.map((f) => html`<a class="hd-file" target="_blank" rel="noopener" data-path="${f.path}">📊 ${f.name}</a>`)}</div>` : ''}
    ${linesView(d, { money })}
    ${d.photos.length ? html`<div class="pc-sub" style="margin:0">ẢNH HÀNG (${d.photos.length})</div>${photoStrip(d)}` : ''}
    ${d.receive_note ? html`<div class="st-meta">Ghi chú nhận hàng: ${d.receive_note}</div>` : ''}
    ${d.received_report_id ? html`<a class="st-meta" href="#/ca/phieu?id=${d.received_report_id}">Mở phiếu chốt ca nhận hàng ›</a>` : ''}
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`;
}

export const NH_CSS = html`<style>
  .nh-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: var(--card); }
  .nh-card.todo { border-color: var(--warn-line, #f59e0b); background: var(--warn-bg); }
  .nh-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
  .nh-pills { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
  .nh-t td, .nh-t th { padding: 6px 8px; } .table .r { text-align: right; }
  .nh-t tr.nh-off td { background: var(--off-bg); }
  .nh-red { color: #b91c1c; font-weight: 700; }
  .nh-qbox { display: inline-flex; gap: 4px; align-items: center; }
  .nh-q { width: 90px; text-align: right; } .nh-q.nh-bad { border-color: #b91c1c; background: #fff1f2; }
  .nh-cam { cursor: pointer; white-space: nowrap; font-size: 15px; }
  .nh-photos .ph figcaption { position: absolute; left: 0; right: 0; bottom: 0; font-size: 11px; background: rgba(0,0,0,.55); color: #fff; text-align: center; padding: 1px 2px; }
  .nh-photos .ph figcaption.nh-untag { background: #b91c1c; }
  .nh-tag { position: absolute; top: 2px; left: 2px; border: none; border-radius: 50%; width: 22px; height: 22px; background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
  .nh-dlg { width: min(640px, calc(100vw - 48px)); max-height: calc(100vh - 80px); overflow: auto; }
  .nh-big { width: 100%; max-height: 52vh; object-fit: contain; background: #111; border-radius: 10px; display: block; }
  .nh-tags { display: flex; flex-direction: column; gap: 4px; max-height: 40vh; overflow: auto; }
  .nh-tagrow { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line-soft, var(--line)); }
  .nh-tagrow.todo { background: var(--warn-bg); }
  .nh-rcrow { display: grid; grid-template-columns: minmax(0, 1fr) 80px 80px auto; gap: 6px; margin-bottom: 6px; }
  .nh-rcl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border-radius: 8px; border: 1px solid var(--line-soft, var(--line)); }
  .nh-rcl.ok { background: var(--ok-bg); } .nh-rcl .grow { flex: 1 1 220px; min-width: 0; }
  .nh-fix { display: flex; gap: 6px; flex-wrap: wrap; flex-basis: 100%; } .nh-fq { width: 100px; } .nh-fn { flex: 1 1 160px; }
  .nh-miss { white-space: normal; }
  @media (max-width: 760px) { .nh-rcrow { grid-template-columns: minmax(0, 1fr) 64px 64px auto; } .table.rt td.r { text-align: left; } }
</style>`;
