// Kế toán · Hóa đơn giao hàng từ kho tổng (bước 31): tải file Excel phiếu xuất → ĐANG CHUYỂN; theo dõi nhận hàng, hồ sơ còn thiếu, tổng phải trả kho tổng
import { render as rerender } from '../app.js';
import { catalog, vnToday, addDays } from '../data.js';
import { rpc, sb } from '../sb.js';
import { compressImage, dmy, dt, fmt } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';
import { DOW, mondayOf } from './ke_toan_ck.js';

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

export async function render({ params }) {
  const { parseXuatExcel, guessBranch, stateLabel, titleOf, missChips, detailHtml, NH_CSS } = await import('../nhap_hang.js');
  const today = vnToday(); const view = params.xem === 'thang' ? 'thang' : 'tuan';
  const cat = await catalog(); const branches = cat.activeBranches;
  const bcode = (b) => b.display_code || b.code;
  const hasB = (v) => branches.some((b) => String(b.id) === String(v));
  const br = hasB(params.cn) ? Number(params.cn) : hasB(lsGet()) ? lsGet() : branches[0]?.id; if (br) lsSet(br);
  const BR = branches.find((b) => b.id === br) || {};
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : today;
  const mon = mondayOf(day); const days = [...Array(7)].map((_, i) => addDays(mon, i));
  const month = view === 'thang' ? (/^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : today.slice(0, 7)) : day.slice(0, 7);
  const months = view === 'thang' ? [month] : [...new Set([month, ...days.map((d) => d.slice(0, 7))])];
  const Ds = await Promise.all(months.map((m) => rpc('app_nh_list', { p_month: m, p_branch: br })));
  const D = Ds[0]; const st = params.tt || '';
  const seen = new Set(); const rowsAll = [];
  Ds.forEach((x) => (x.rows || []).forEach((r) => { if (!seen.has(r.id) && (!br || r.branch_id === br)) { seen.add(r.id); rowsAll.push(r); } }));
  const open = (D.open || []).filter((o) => !br || o.branch_id === br);
  const all = [...rowsAll, ...open.filter((o) => !seen.has(o.id))];
  const byId = (id) => all.find((x) => x.id === Number(id));
  const q = (o) => '#/ke-toan/hoa-don?' + Object.entries({ xem: view, cn: br, ngay: day, thang: view === 'thang' ? month : '', tt: view === 'thang' ? st : '', ...o })
    .filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => `${k}=${v}`).join('&');
  const shiftMonth = (k) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };
  const monthTotal = Number(((D.by_branch || []).find((b) => b.branch_id === br || b.code === bcode(BR)) || {}).total || 0);
  const monthRows = (Ds[0].rows || []).filter((r) => !br || r.branch_id === br);
  const mob = !!(window.matchMedia && window.matchMedia('(max-width: 700px)').matches);
  const dname = (d) => DOW[new Date(d + 'T00:00:00Z').getUTCDay()];

  // ---- thẻ 1 lần giao (tuần, điện thoại, còn thiếu hồ sơ)
  const acts = (d) => html`<span class="nhw-act"><button type="button" class="btn sm secondary nh-view">Xem</button>
      ${D.kt && d.state === 'cho_hoa_don' ? html`<button type="button" class="btn sm nh-merge">Ghép hóa đơn</button>` : ''}
      ${D.kt && d.state === 'dang_chuyen' ? html`<button type="button" class="btn sm secondary danger nh-del" aria-label="Xóa hóa đơn">×</button>` : ''}</span>`;
  const card = (d, withDay) => { const [lab, cls] = stateLabel(d);
    return html`<div class="nhw-c" data-id="${d.id}"><div class="nhw-t">${withDay ? html`<span class="st-meta">${dmy(d.work_date)} · </span>` : ''}${titleOf(d)}</div>
      ${D.money && d.total !== null && d.total !== undefined ? html`<div class="nhw-m">${fmt(d.total)}đ</div>` : ''}
      <div class="nhw-p"><span class="pill ${cls}">${lab}</span>${d.n_mismatch && d.state !== 'dang_chuyen' && d.state !== 'cho_hoa_don' ? html`<span class="pill off">${d.n_mismatch} món lệch</span>` : ''}${(d.missing || []).length ? missChips(d) : d.complete ? html`<span class="pill ok">Hồ sơ đủ</span>` : ''}</div>
      <div class="st-meta">${d.n_lines} món</div>${acts(d)}</div>`; };
  // ---- dòng bảng tháng (giữ như cũ)
  const row = (d) => { const [lab, cls] = stateLabel(d);
    return html`<tr data-id="${d.id}"><td data-label="Ngày">${dmy(d.work_date)}</td><td data-label="Hóa đơn">${titleOf(d)}</td>
      <td data-label="Trạng thái"><span class="pill ${cls}">${lab}</span></td><td class="r" data-label="Món">${d.n_lines}${d.n_mismatch && d.state !== 'dang_chuyen' && d.state !== 'cho_hoa_don' ? html` <span class="nh-red">(${d.n_mismatch} lệch)</span>` : ''}</td>
      ${D.money ? html`<td class="r" data-label="Tổng bill">${d.total !== null && d.total !== undefined ? fmt(d.total) : '—'}</td>` : ''}
      <td data-label="Hồ sơ">${(d.missing || []).length ? missChips(d) : d.complete ? html`<span class="pill ok">Đủ</span>` : '—'}</td><td>${acts(d)}</td></tr>`; };

  // ---- xem tuần
  const wk = rowsAll.filter((r) => days.includes(r.work_date));
  const byDay = days.map((d) => wk.filter((r) => r.work_date === d));
  const wkTotal = wk.reduce((t, r) => t + Number(r.total || 0), 0);
  const dayTag = (L) => { if (!L.length) return ['—', '']; const bad = L.some((d) => (d.missing || []).length || d.result === 'lech'); const go_ = L.some((d) => d.state === 'dang_chuyen' || d.state === 'cho_hoa_don');
    return bad ? [`${L.length} !`, 'no'] : go_ ? [`${L.length} đang`, 'go'] : [`${L.length} ✓`, 'ok']; };
  const ti = days.indexOf(today); const pick = ti >= 0 ? ti : Math.max(0, byDay.findIndex((L) => L.length));
  const weekDesk = html`<div class="nhw-grid">${days.map((d, i) => html`<div class="nhw-col ${d === today ? 'today' : ''}"><div class="nhw-dh">${dname(d)}<small>${dmy(d).slice(0, 5)}</small></div>
      ${byDay[i].length ? byDay[i].map((x) => card(x)) : html`<div class="nhw-empty">—</div>`}</div>`)}</div>`;
  const weekMob = html`<div class="nhw-days" role="tablist" aria-label="Chọn ngày">${days.map((d, i) => { const [t, c] = dayTag(byDay[i]);
      return html`<button type="button" class="nhw-d ${i === pick ? 'on' : ''} ${d === today ? 'today' : ''}" data-di="${i}" role="tab" aria-selected="${i === pick ? 'true' : 'false'}">${dname(d)}<b>${d.slice(8, 10)}</b><i class="${c}">${t}</i></button>`; })}</div>
    ${days.map((d, i) => html`<div class="nhw-day" data-dp="${i}" ${i === pick ? '' : 'hidden'}>${byDay[i].length ? byDay[i].map((x) => card(x)) : html`<div class="card st-meta">Không có lần giao nào ngày ${dname(d)} ${dmy(d)}.</div>`}</div>`)}`;
  // ---- xem tháng
  const match = (d) => !st || (st === 'thieu_ho_so' ? (d.missing || []).length : st === 'lech' ? d.result === 'lech' : d.state === st);
  const mRows = monthRows.filter(match);
  const monthView = html`<section class="card flush"><div class="card-head"><h2>Các lần giao tháng ${Number(month.slice(5))}/${month.slice(0, 4)} · ${bcode(BR)} (${mRows.length})</h2></div>
      ${mRows.length ? html`<div class="table-wrap"><table class="table rt nh-list"><thead><tr><th>Ngày</th><th>Hóa đơn</th><th>Trạng thái</th><th class="r">Món</th>${D.money ? html`<th class="r">Tổng bill</th>` : ''}<th>Hồ sơ</th><th></th></tr></thead>
        <tbody>${mRows.map(row)}</tbody></table></div>` : html`<div style="padding:16px" class="st-meta">Chưa có lần giao nào.</div>`}</section>`;

  const nav = view === 'tuan'
    ? (mob ? html`<div class="nhw-nav nhw-navm"><a class="btn sm secondary" href="${q({ ngay: addDays(mon, -7) })}" aria-label="Tuần trước">‹</a><strong>Tuần ${dmy(days[0]).slice(0, 5)} – ${dmy(days[6]).slice(0, 5)}</strong><a class="btn sm secondary" href="${q({ ngay: addDays(mon, 7) })}" aria-label="Tuần sau">›</a></div>`
      : html`<div class="nhw-nav"><a class="btn sm secondary" href="${q({ ngay: addDays(mon, -7) })}">‹ Tuần trước</a><strong>${dmy(days[0]).slice(0, 5)} – ${dmy(days[6])}</strong><a class="btn sm secondary" href="${q({ ngay: addDays(mon, 7) })}">Tuần sau ›</a>${mon !== mondayOf(today) ? html`<a class="btn sm secondary" href="${q({ ngay: today })}">Tuần này</a>` : ''}</div>`)
    : html`<div class="nhw-nav"><a class="btn sm secondary" href="${q({ thang: shiftMonth(-1) })}" aria-label="Tháng trước">‹</a><strong>Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(1) })}" aria-label="Tháng sau">›</a>
        <select class="input sm" id="nh-st" aria-label="Trạng thái">${[['', 'Mọi trạng thái'], ['dang_chuyen', 'Đang chuyển'], ['cho_hoa_don', 'Chờ hóa đơn'], ['da_nhan', 'Đã nhận'], ['lech', 'Nhận lệch hóa đơn'], ['thieu_ho_so', 'Còn thiếu hồ sơ']]
          .map(([v, l]) => html`<option value="${v}" ${st === v ? 'selected' : ''}>${l}</option>`)}</select></div>`;
  const tiles = html`<div class="nhw-sum">
      ${view === 'tuan' ? html`<div class="nhw-k"><span>${bcode(BR)} tuần này</span><b>${D.money ? fmt(wkTotal) + 'đ' : wk.length + ' lần'}</b><small>${wk.length} lần giao</small></div>` : html`<div class="nhw-k"><span>${bcode(BR)} tháng này</span><b>${monthRows.length} lần giao</b><small>tháng ${Number(month.slice(5))}</small></div>`}
      <div class="nhw-k ${open.length ? 'warn' : ''}"><span>Còn thiếu hồ sơ</span><b>${open.length} lần</b><small>${open.length ? 'xem danh sách bên dưới' : 'đã đủ'}</small></div>
      ${D.money ? html`<div class="nhw-k tot"><span>Phải trả kho tổng tháng ${Number(month.slice(5))} (${bcode(BR)})</span><b>${fmt(monthTotal)}đ</b><small>thanh toán 1 lần cuối tháng</small></div>` : ''}</div>`;

  return {
    title: 'Hóa đơn giao hàng',
    html: html`${HD_CSS}${NH_CSS}${NH_PAGE_CSS}<div class="page-head"><div><h1>Hóa đơn giao hàng (kho tổng)</h1>
        <div class="sub">${mob ? 'Kế toán tải phiếu xuất trước khi giao → nhân viên kiểm hàng trong phiếu chốt ca → quản lý đối soát.' : html`Kế toán tải file Excel phiếu xuất cho từng cơ sở <strong>trước khi giao</strong> → hàng ở trạng thái ĐANG CHUYỂN. Nhân viên kiểm từng món + chụp ảnh trong phiếu chốt ca; quản lý đối soát trong Đối soát ca.`}</div></div>
        <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div>
          ${D.kt ? html`<label class="btn">+ Tải phiếu xuất (Excel)<input type="file" id="nh-file" accept=".xlsx,.xls" hidden></label>` : ''}</div></div>
      <section class="card nhw-bar">
        <nav class="branch-tabs" aria-label="Cơ sở">${branches.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${bcode(b)}</a>`)}</nav>
        <nav class="nhw-view" aria-label="Cách xem"><a class="${view === 'tuan' ? 'on' : ''}" href="${q({ xem: 'tuan' })}">Tuần</a><a class="${view === 'thang' ? 'on' : ''}" href="${q({ xem: 'thang', thang: month })}">Tháng</a></nav>
        ${nav}</section>
      ${tiles}
      ${view === 'tuan' ? (mob ? weekMob : weekDesk) : monthView}
      ${open.length ? html`<section class="card stack" style="gap:8px;padding:14px;margin-top:12px"><h2 style="margin:0;font-size:17px">Hồ sơ nhận hàng còn thiếu · ${bcode(BR)} (${open.length})</h2>
        <div class="st-meta">Thiếu ảnh → nhân viên đã nhận bổ sung · thiếu hóa đơn → kế toán tải và ghép · chưa đối soát → quản lý đối soát trong phiếu ca. Web nhắc mỗi ngày tới khi đủ.</div>
        <div class="nhw-list">${open.map((x) => card(x, true))}</div></section>` : ''}`,
    mount() {
      $('#nh-st')?.addEventListener('change', (e) => { location.hash = q({ tt: e.target.value }); });
      $$('.nhw-d').forEach((b) => b.addEventListener('click', () => {
        $$('.nhw-d').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        $$('.nhw-day').forEach((pn) => { pn.hidden = pn.dataset.dp !== b.dataset.di; });
      }));
      const idOf = (b) => b.closest('[data-id]').dataset.id;
      $$('.nh-view').forEach((b) => b.addEventListener('click', () => {
        const d = byId(idOf(b)); const dl = dialog(detailHtml(d, D.money)); signLinks(dl);
        dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
      }));
      $$('.nh-del').forEach((b) => b.addEventListener('click', async () => {
        const d = byId(idOf(b));
        if (!confirm(`Xóa hóa đơn ${d.doc_no} (đang chuyển tới ${d.branch_code})?`)) return;
        try { const paths = await rpc('app_nh_delete', { p_id: d.id }); if (paths?.length) await sb.storage.from(BUCKET).remove(paths); flash('Đã xóa hóa đơn.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      const pick = (mergeId) => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls';
        inp.addEventListener('change', () => inp.files[0] && preview(inp.files[0], mergeId)); inp.click(); };
      $('#nh-file')?.addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) preview(f, null); });
      $$('.nh-merge').forEach((b) => b.addEventListener('click', () => pick(byId(idOf(b)).id)));

      async function preview(file, mergeId) {
        let P;
        try { P = await parseXuatExcel(file); } catch (e) { showSaved(e.message, true); return; }
        let map = {}; try { map = await rpc('app_nh_kho_map'); } catch (_) { /* bỏ qua */ }
        const target = mergeId ? byId(mergeId) : null;
        const guess = target ? target.branch_id : map[P.kho_code] || guessBranch(P.kho_name, branches);
        const waiting = (bid) => all.filter((x) => x.state === 'cho_hoa_don' && x.branch_id === Number(bid));
        const mOpts = (bid, sel) => html`<option value="">— Không ghép (hàng đang chuyển tới) —</option>${waiting(bid).map((x) => html`<option value="${x.id}" ${sel === x.id ? 'selected' : ''}>Phiếu nhận không hóa đơn ${dt(x.received_at)} · ${x.n_lines} món · ${x.received_by || ''}</option>`)}`;
        const diff = Math.abs(Number(P.total || 0) - Number(P.sum || 0)) > 1;
        const dl = dialog(html`<form class="stack nh-dlg" style="gap:10px"><h2 style="margin:0">${target ? 'Ghép hóa đơn vào phiếu nhận hàng' : 'Phiếu xuất kho tổng'} · ${P.doc_no || '(không có số đơn)'}</h2>
          <div class="kv"><div>Tệp</div><div>${P.file_name}</div><div>Thời gian xuất</div><div>${P.ship_at ? dt(P.ship_at) : html`<span class="nh-red">không đọc được</span>`}</div>
            <div>Kho nhập</div><div>${P.kho_name || '—'}${P.kho_code ? html` <span class="st-meta">(${P.kho_code})</span>` : ''}</div>${P.ref ? html`<div>Tham chiếu</div><div>${P.ref}</div>` : ''}${P.src_creator ? html`<div>Người tạo</div><div>${P.src_creator}</div>` : ''}</div>
          <label class="field"><span>Cơ sở nhận</span><select class="input" name="br" ${target ? 'disabled' : ''}><option value="">— Chọn cơ sở —</option>${branches.map((b) => html`<option value="${b.id}" ${String(guess) === String(b.id) ? 'selected' : ''}>${b.display_code || b.code} – ${b.name}</option>`)}</select>
            ${!target && !map[P.kho_code] ? html`<span class="st-meta">Lần đầu gặp kho này — kiểm tra cơ sở; lần sau web tự chọn.</span>` : ''}</label>
          <label class="field"><span>Ghép với phiếu nhận hàng không hóa đơn</span><select class="input" name="merge">${mOpts(guess, mergeId)}</select></label>
          <div class="table-wrap" style="max-height:38vh;overflow:auto"><table class="table nh-t"><thead><tr><th>#</th><th>Mã</th><th>Tên hàng</th><th>ĐVT</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead>
            <tbody>${P.lines.map((l, i) => html`<tr><td>${i + 1}</td><td>${l.code}</td><td>${l.name}</td><td>${l.unit}</td><td class="r">${Number(l.qty).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</td><td class="r">${l.price !== null ? fmt(l.price) : ''}</td><td class="r">${l.amount !== null ? fmt(l.amount) : ''}</td></tr>`)}</tbody></table></div>
          <div><strong>${P.lines.length} món · Tổng bill ${fmt(P.total)}đ</strong>${diff ? html` <span class="nh-red">(cộng các dòng = ${fmt(P.sum)}đ, khác dòng Tổng — kiểm tra lại file)</span>` : ''}</div>
          <input class="input sm" name="note" placeholder="Ghi chú cho cơ sở (không bắt buộc)">
          <div class="nh-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">${target ? 'Ghép hóa đơn' : 'Gửi — hàng ĐANG CHUYỂN'}</button></div></form>`);
        const f = dl.querySelector('form');
        f.br.addEventListener('change', () => { f.merge.innerHTML = str(mOpts(f.br.value, null)); });
        f.merge.addEventListener('change', () => { f.querySelector('button[type=submit]').textContent = f.merge.value ? 'Ghép hóa đơn' : 'Gửi — hàng ĐANG CHUYỂN'; });
        dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const bid = target ? target.branch_id : Number(f.br.value);
          const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
          try {
            const id = await rpc('app_nh_create', { p: { branch_id: bid || null, doc_no: P.doc_no, ship_at: P.ship_at, kho_code: P.kho_code, kho_name: P.kho_name, ref: P.ref, src_creator: P.src_creator,
              total: P.total, note: f.note.value, lines: P.lines, merge_id: f.merge.value ? Number(f.merge.value) : null } });
            try { await uploadFiles('hd' + id, [file], (path, ff, size, mime) => rpc('app_kt_invoice_file_add', { p_invoice: id, p_path: path, p_name: ff.name, p_mime: mime, p_size: size })); } catch (_) { /* tệp gốc không bắt buộc */ }
            dl.close(); flash(f.merge.value ? `Đã ghép hóa đơn ${P.doc_no}.` : `Đã gửi hóa đơn ${P.doc_no} — hàng ĐANG CHUYỂN tới cơ sở.`); rerender();
          } catch (e) { btn.disabled = false; dl.querySelector('.nh-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
        });
      }
    },
  };
}

const NH_PAGE_CSS = html`<style>
  .nh-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
  .nh-month { display: flex; align-items: center; gap: 10px; } .nh-month strong { min-width: 110px; text-align: center; font-size: 17px; }
  .nh-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .nh-k { background: var(--card); border-radius: 12px; box-shadow: var(--shadow); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; border-top: 4px solid var(--primary); min-width: 0; }
  .nh-k span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; } .nh-k b { font-size: 18px; overflow-wrap: anywhere; } .nh-k small { font-size: 12px; color: var(--ink-2); }
  .nh-k.tot { border-top-color: var(--ok-line); }
  .nhw-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: space-between; padding: 12px 14px; margin-bottom: 12px; }
  .nhw-view { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .nhw-view a { padding: 6px 14px; font-weight: 700; font-size: 14px; text-decoration: none; color: var(--ink-2); background: var(--card); } .nhw-view a + a { border-left: 1px solid var(--line); } .nhw-view a.on { background: var(--primary); color: #fff; }
  .nhw-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .nhw-nav select { width: auto; }
  .nhw-navm { width: 100%; justify-content: space-between; flex-wrap: nowrap; } .nhw-navm strong { flex: 1; text-align: center; } .nhw-navm .btn { width: auto; min-width: 40px; }
  .nhw-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .nhw-k { background: var(--card); border-radius: 12px; box-shadow: var(--shadow); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .nhw-k span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; } .nhw-k b { font-size: 18px; } .nhw-k small { font-size: 12px; color: var(--ink-2); }
  .nhw-k.warn b { color: #b45309; } .nhw-k.tot { background: #2f3e33; } .nhw-k.tot span, .nhw-k.tot small { color: #d9e2da; } .nhw-k.tot b { color: #fff; }
  .nhw-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
  .nhw-col { background: var(--card); border-radius: 12px; padding: 8px; min-height: 140px; display: flex; flex-direction: column; gap: 6px; min-width: 0; } .nhw-col.today { background: #fdf3d8; }
  .nhw-dh { text-align: center; font-weight: 800; font-size: 13px; } .nhw-dh small { display: block; font-weight: 500; color: var(--ink-2); }
  .nhw-empty { text-align: center; color: var(--ink-2); font-size: 12px; margin-top: 10px; }
  .nhw-c { border: 1px solid var(--line); border-radius: 10px; background: #fff; padding: 7px 8px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; min-width: 0; overflow-wrap: anywhere; }
  .nhw-m { font-weight: 800; font-variant-numeric: tabular-nums; } .nhw-p { display: flex; flex-wrap: wrap; gap: 3px; } .nhw-p .pill { font-size: 11px; }
  .nhw-act { display: flex; gap: 4px; flex-wrap: wrap; } .nhw-act .btn { width: auto; }
  .nhw-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
  .nhw-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin-bottom: 8px; }
  .nhw-d { border: 1.5px solid var(--line); background: var(--card); border-radius: 10px; padding: 5px 0 4px; font-size: 11px; line-height: 1.25; color: var(--ink-2); cursor: pointer; }
  .nhw-d b { display: block; font-size: 15px; color: var(--ink); } .nhw-d i { display: block; font-style: normal; font-size: 10px; font-weight: 700; min-height: 12px; }
  .nhw-d i.ok { color: var(--ok-ink); } .nhw-d i.no { color: #b45309; } .nhw-d i.go { color: #1d4f8a; } .nhw-d.today b { text-decoration: underline; } .nhw-d.on { border-color: var(--primary); background: #fde9b8; }
  .nhw-day { display: flex; flex-direction: column; gap: 8px; } .nhw-day[hidden] { display: none; } .nhw-day .nhw-c { font-size: 14px; padding: 10px 12px; }
  @media (max-width: 1000px) and (min-width: 701px) { .nhw-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>`;
