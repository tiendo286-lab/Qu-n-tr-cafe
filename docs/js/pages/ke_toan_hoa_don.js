// Kế toán · Hóa đơn giao hàng từ kho tổng: tải hóa đơn (ảnh / PDF / Excel) theo cơ sở + ngày, theo dõi nhân viên báo nhận
import { render as rerender } from '../app.js';
import { catalog, vnToday, addDays } from '../data.js';
import { rpc, sb } from '../sb.js';
import { compressImage, dmy, dt } from '../tien.js';
import { $, $$, flash, html, showSaved } from '../ui.js';

export const perm = 'ke_toan';
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
  .hd-rec { font-size: 14px; background: #f7f8fb; border-radius: 8px; padding: 8px 10px; }
  .photos { display: flex; flex-wrap: wrap; gap: 8px; }
  .photos .ph { position: relative; margin: 0; width: 88px; height: 88px; border-radius: 8px; overflow: hidden; background: var(--line-soft); }
  .photos .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photos .ph-del { position: absolute; top: 2px; right: 2px; border: none; border-radius: 50%; width: 22px; height: 22px; background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
</style>`;

export async function render({ params }) {
  const today = vnToday();
  const from = params.tu || addDays(today, -7); const to = params.den || addDays(today, 3);
  const br = params.cn ? Number(params.cn) : null; const st = params.tt || '';
  const [cat, list] = await Promise.all([catalog(), rpc('app_kt_invoices', { p_from: from, p_to: to, p_branch: br })]);
  const shown = list.filter((i) => !st || i.status === st);
  const branches = cat.activeBranches;
  const bOpts = (sel, blank) => html`${blank ? html`<option value="">${blank}</option>` : ''}${branches.map((b) => html`<option value="${b.id}" ${String(b.id) === String(sel) ? 'selected' : ''}>${b.display_code || b.code} – ${b.name}</option>`)}`;
  const card = (i) => html`<article class="card stack hd" style="gap:8px;padding:14px" data-id="${i.id}">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
      <strong>${i.branch_code} · ${dmy(i.work_date)}</strong><span class="pill ${HD_STATUS[i.status][1]}">${HD_STATUS[i.status][0]}</span></div>
    ${i.note ? html`<div>${i.note}</div>` : ''}
    <div>${fileLinks(i.files, i.status === 'chua_nhan')}${i.files.length ? '' : html`<span class="st-meta">Chưa có tệp hóa đơn.</span>`}</div>
    ${i.status === 'chua_nhan' ? html`<div class="toolbar" style="gap:8px"><label class="btn sm secondary">+ Thêm tệp<input type="file" class="hd-add" accept="${HD_ACCEPT}" multiple hidden></label>
      <button type="button" class="btn sm secondary danger hd-del">Xóa hóa đơn</button><span class="st-meta hd-st"></span></div>` : ''}
    ${receiptText(i)}
    ${i.photos.length ? html`<div class="pc-sub" style="margin:0">ẢNH HÀNG NHÂN VIÊN NHẬN (${i.photos.length})</div>${photoThumbs(i.photos, false)}` : ''}
    <div class="st-meta">Tải lên: ${i.created_by_name || ''} · ${dt(i.created_at)}</div></article>`;
  return {
    title: 'Hóa đơn giao hàng',
    html: html`${HD_CSS}<div class="page-head"><div><h1>Hóa đơn giao hàng</h1><div class="sub">Tải hóa đơn kho tổng gửi cho từng cơ sở. Nhân viên ca nào trong ngày nhận hàng thì mở hóa đơn trong phiếu chốt ca, chụp ảnh hàng và báo ĐỦ / THIẾU.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:980px;gap:12px">
        <section class="card stack" style="gap:10px"><h2 style="margin:0">+ Thêm hóa đơn</h2>
          <form id="hd-new" class="stack" style="gap:8px">
            <div class="pc-line" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <select class="input sm" name="branch" required aria-label="Cơ sở nhận" style="flex:1 1 200px;min-width:0">${bOpts('', '— Chọn cơ sở nhận —')}</select>
              <label class="st-meta" style="display:flex;gap:6px;align-items:center">Ngày giao <input class="input sm" type="date" name="date" value="${today}" required></label></div>
            <input class="input sm" name="note" placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú">
            <label class="st-meta">Tệp hóa đơn (ảnh, PDF, Excel — chọn được nhiều tệp) <input class="input sm" type="file" name="files" accept="${HD_ACCEPT}" multiple required></label>
            <div class="toolbar"><button class="btn sm" type="submit">Tải lên và gửi cho cơ sở</button><span class="st-meta" id="hd-new-st"></span></div></form></section>
        <section class="card toolbar" style="padding:12px 14px;gap:8px">
          <label class="st-meta">Từ <input class="input sm" type="date" id="f-tu" value="${from}"></label>
          <label class="st-meta">đến <input class="input sm" type="date" id="f-den" value="${to}"></label>
          <select class="input sm" id="f-cn" aria-label="Cơ sở">${bOpts(br, 'Mọi cơ sở')}</select>
          <select class="input sm" id="f-tt" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(HD_STATUS).map(([k, [l]]) => html`<option value="${k}" ${k === st ? 'selected' : ''}>${l}</option>`)}</select>
          <span class="st-meta">${shown.length} hóa đơn · chưa nhận ${list.filter((i) => i.status === 'chua_nhan').length} · báo thiếu ${list.filter((i) => i.status === 'thieu').length}</span></section>
        ${shown.length ? shown.map(card) : html`<div class="card">Không có hóa đơn nào trong khoảng này.</div>`}
      </div>`,
    mount() {
      signLinks();
      const go2 = () => {
        const o = { tu: $('#f-tu').value, den: $('#f-den').value };
        if ($('#f-cn').value) o.cn = $('#f-cn').value;
        if ($('#f-tt').value) o.tt = $('#f-tt').value;
        location.hash = '#/ke-toan/hoa-don?' + new URLSearchParams(o).toString();
      };
      ['#f-tu', '#f-den', '#f-cn', '#f-tt'].forEach((s) => $(s).addEventListener('change', go2));
      $('#hd-new').addEventListener('submit', async (ev) => {
        ev.preventDefault(); const f = ev.target; const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          const id = await rpc('app_kt_invoice_save', { p_id: null, p_branch: Number(f.branch.value), p_date: f.date.value, p_note: f.note.value });
          await uploadFiles('hd' + id, [...f.files.files], (path, file, size, mime) => rpc('app_kt_invoice_file_add', { p_invoice: id, p_path: path, p_name: file.name, p_mime: mime, p_size: size }), $('#hd-new-st'));
          flash('Đã gửi hóa đơn cho cơ sở.'); rerender();
        } catch (e) { showSaved(e.message, true); btn.disabled = false; }
      });
      $$('.hd-add').forEach((inp) => inp.addEventListener('change', async () => {
        const c = inp.closest('.hd'); const id = Number(c.dataset.id);
        try { await uploadFiles('hd' + id, [...inp.files], (path, file, size, mime) => rpc('app_kt_invoice_file_add', { p_invoice: id, p_path: path, p_name: file.name, p_mime: mime, p_size: size }), c.querySelector('.hd-st')); rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
      $$('.hd-fdel').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa tệp này khỏi hóa đơn?')) return;
        try { const path = await rpc('app_kt_invoice_file_del', { p_file: Number(b.dataset.id) }); if (path) await sb.storage.from(BUCKET).remove([path]); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.hd-del').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa hóa đơn này (kể cả các tệp đã tải)?')) return;
        try { const paths = await rpc('app_kt_invoice_delete', { p_id: Number(b.closest('.hd').dataset.id) }); if (paths.length) await sb.storage.from(BUCKET).remove(paths); flash('Đã xóa hóa đơn.'); rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}
