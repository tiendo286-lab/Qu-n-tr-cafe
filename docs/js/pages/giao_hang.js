// Hàng hoá › Nhận hàng · Đối soát (bước 104, anh Tiến chốt 15/11/2026) — tách hẳn khỏi chốt ca / đối soát ca.
//  * Nhận hàng (/hang-hoa/nhan): nhân viên CHỤP 1 nhóm hàng → CHỌN các món có trong ảnh (số tự điền = số phiếu, khác thì sửa + ghi chú)
//    → lặp tới hết món → GỬI BÁO NHẬN. Món kho quên giao: "Không nhận được" (số 0 + ghi chú). Nhận hàng KHÔNG có hoá đơn cũng ở đây.
//    Không cần mở phiếu chốt ca (máy chủ: app_gh_*, không gắn phiếu ca).
//  * Đối soát (/hang-hoa/doi-soat): quản lý đối soát THEO TỪNG ẢNH (ảnh có món lệch hiện trước) — "✓ Đúng cả ảnh" hoặc "Sai số" từng món.
//    Đối soát xong: món thiếu → "Chờ giao bù", món thừa → "Chờ hoá đơn bổ sung" ở tab Kiểm soát.
import { addDays, catalog, vnToday } from '../data.js';
import { rpc, sb } from '../sb.js';
import { dmy, fmt } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';
import { BUCKET, signLinks, uploadFiles } from './ke_toan_hoa_don.js';

export const perm = ['chot_ca', 'doi_soat', 'ke_toan'];
const LS_BR = 'ckBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const draftGet = (id) => { try { return JSON.parse(localStorage.getItem('nhd:' + id) || '{}'); } catch (_) { return {}; } };
const draftSet = (id, v) => { try { localStorage.setItem('nhd:' + id, JSON.stringify(v)); } catch (_) { /* bỏ qua */ } };
const draftDel = (id) => { try { localStorage.removeItem('nhd:' + id); } catch (_) { /* bỏ qua */ } };
const q3 = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));
const noHd = (d) => d.state === 'cho_hoa_don';
const numOf = (v) => { const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const routePath = () => location.hash.slice(1).split('?')[0];
const NHAN = '#/hang-hoa/nhan'; const DS = '#/hang-hoa/doi-soat';
const qs = (base, o) => base + '?' + Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

const stTag = (d) => (d.state === 'dang_chuyen' ? html`<span class="pill info">Đang chuyển</span>`
  : d.state === 'cho_hoa_don' ? html`<span class="pill warn">Chờ hoá đơn</span>`
    : d.n_unchecked ? html`<span class="pill warn">Chờ đối soát ${d.n_unchecked} món</span>`
      : d.result === 'lech' ? html`<span class="pill off">Lệch ${d.n_mismatch} món</span>` : html`<span class="pill ok">Xong</span>`);

// cơ sở: nhân viên chỉ thấy cơ sở mình làm (employee_branches); quản lý / kế toán thấy tất cả
async function branchesFor(params, G, can) {
  const cat = await catalog().catch(() => ({ activeBranches: [] }));
  let brs = (cat.activeBranches || []).map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name }));
  const mine = new Set(G.my_branches || []);
  if (!can('doi_soat') && !can('ke_toan') && mine.size) brs = brs.filter((b) => mine.has(b.id));
  const has = (v) => brs.some((b) => String(b.id) === String(v));
  const br = has(params.cn) ? Number(params.cn) : has(lsGet()) ? lsGet() : (brs.find((b) => mine.has(b.id)) || brs[0])?.id;
  if (br) lsSet(br);
  return { brs, br, BR: brs.find((b) => b.id === br) || {} };
}

// ================================================================= TRANG
export async function render({ params, can }) {
  if (params.nhan) return receivePage(Number(params.nhan));
  if (params.ds || params.xem) return reconPage(Number(params.ds || params.xem), !!params.ds && can('doi_soat'));
  return routePath() === '/hang-hoa/doi-soat' ? listPage(params, can) : nhanList(params, can);
}

// ---------------------------------------------------------------- Nhận hàng: hàng đang chuyển tới cơ sở
async function nhanList(params, can) {
  const G = await rpc('app_gh_inbox', { p_branch: null });
  const { brs, br, BR } = await branchesFor(params, G, can);
  const rows = (G.rows || []).filter((d) => d.branch_id === br && (d.state === 'dang_chuyen' || d.staff_edit));
  const nWait = (id) => (G.rows || []).filter((d) => d.branch_id === id && d.state === 'dang_chuyen').length;
  const nDs = (G.rows || []).filter((d) => d.branch_id === br && d.state !== 'dang_chuyen').length;
  return {
    title: 'Nhận hàng',
    html: html`${GH_CSS}<div class="gh-wrap"><div class="page-head"><div><h1>Nhận hàng kho tổng</h1><div class="sub">Hàng tới thì bấm Nhận hàng: chụp từng nhóm hàng → chọn các món có trong ảnh → hết món thì Gửi. Không cần mở phiếu chốt ca.</div></div></div>
      ${brs.length > 1 ? html`<nav class="branch-tabs" aria-label="Cơ sở">${brs.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${qs(NHAN, { cn: b.id })}">${b.code}${nWait(b.id) ? html` <span class="badge">${nWait(b.id)}</span>` : ''}</a>`)}</nav>` : ''}
      ${rows.length ? rows.map((d) => html`<div class="card gh-hero ${d.state === 'dang_chuyen' ? '' : 'gh-hero2'}"><div class="gh-hero-t">${d.state === 'dang_chuyen' ? '🚚 Đang chuyển tới' : noHd(d) ? '🧾 Nhận không hoá đơn — chờ kế toán ghép hoá đơn ·' : '✓ Đã báo nhận — còn sửa được hôm nay ·'} ${d.branch_code}</div>
            <div class="st-meta">${d.doc_no ? `Phiếu ${d.doc_no}` : 'Nhận hàng không hoá đơn'} · ${d.n_lines} món${d.ship_at ? ` · kho xuất ${String(d.ship_at).slice(11, 16)} ${dmy(d.ship_at.slice(0, 10)).slice(0, 5)}` : ''}${d.received_by ? ` · ${d.received_by}` : ''}</div>
            ${G.can_recv ? html`<a class="btn gh-big ${d.state === 'dang_chuyen' ? '' : 'secondary'}" href="${qs(NHAN, { nhan: d.id })}">${d.state === 'dang_chuyen' ? 'NHẬN HÀNG ›' : 'XEM / SỬA ›'}</a>` : ''}</div>`)
        : html`<div class="card st-meta">Không có hàng kho tổng nào đang chuyển tới ${BR.code || ''}.</div>`}
      ${G.can_recv && br ? html`<div class="toolbar"><button type="button" class="btn secondary gh-nohd">+ Nhận hàng KHÔNG có hoá đơn · ${BR.code}</button></div>` : ''}
      ${can('doi_soat') && nDs ? html`<a class="card gh-link" href="${qs(DS, { cn: br })}">✔ ${nDs} lần giao của ${BR.code} chờ đối soát ›</a>` : ''}</div>`,
    mount() { $('.gh-nohd')?.addEventListener('click', () => noHdDialog(BR, G.catalog || [])); },
  };
}

// ---------------------------------------------------------------- nhận hàng KHÔNG có hoá đơn: ghi tên + số lượng → chụp ảnh như thường
function noHdDialog(BR, cat) {
  const row = () => html`<div class="gh-nr"><input class="input sm gh-nn" list="gh-cat" placeholder="Tên món" aria-label="Tên món"><input class="input sm gh-nu" placeholder="ĐVT" aria-label="Đơn vị"><input class="input sm gh-nq" inputmode="decimal" placeholder="SL" aria-label="Số lượng"></div>`;
  const dl = dialog(html`<form class="stack" style="gap:8px;width:min(480px, calc(100vw - 40px))"><h2 style="margin:0">Nhận hàng KHÔNG có hoá đơn · ${BR.code}</h2>
    <div class="st-meta">Hàng tới mà kế toán chưa gửi phiếu xuất: ghi từng món (gõ vài chữ để chọn tên món từng nhận) + số lượng, lưu rồi chụp ảnh như thường. Kế toán sẽ ghép hoá đơn sau.</div>
    <datalist id="gh-cat">${cat.map((c) => html`<option value="${c.name}">${c.unit || ''}</option>`)}</datalist>
    <div class="gh-nrs">${row()}${row()}</div><button type="button" class="btn sm secondary" id="gh-nadd" style="align-self:flex-start">+ Thêm món</button>
    <input class="input sm" name="note" placeholder="Ghi chú (vd: tài xế giao, chưa có phiếu)"><div class="gh-err"></div>
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu → chụp ảnh</button></div></form>`);
  const f = dl.querySelector('form');
  dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
  dl.querySelector('#gh-nadd').addEventListener('click', () => dl.querySelector('.gh-nrs').insertAdjacentHTML('beforeend', str(row())));
  f.addEventListener('change', (e) => { if (e.target.classList.contains('gh-nn')) { const hit = cat.find((c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase()); const u = e.target.closest('.gh-nr').querySelector('.gh-nu'); if (hit && !u.value) u.value = hit.unit || ''; } });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lines = $$('.gh-nr', dl).map((r) => { const nm = r.querySelector('.gh-nn').value.trim(); const hit = cat.find((c) => c.name.toLowerCase() === nm.toLowerCase());
      return { code: hit ? hit.code : null, name: nm, unit: r.querySelector('.gh-nu').value.trim(), qty: numOf(r.querySelector('.gh-nq').value) }; }).filter((l) => l.name || l.qty !== null);
    const err = (m) => { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${m}</div>`); };
    if (!lines.length) { err('Ghi ít nhất 1 món.'); return; }
    if (lines.some((l) => !l.name || !(l.qty > 0))) { err('Mỗi món cần tên và số lượng lớn hơn 0.'); return; }
    try {
      const nid = await rpc('app_gh_receipt_save', { p_id: null, p_branch: BR.id, p_lines: lines, p_note: f.note.value });
      dl.close(); flash('Đã lưu phiếu nhận không hoá đơn — giờ chụp ảnh và chọn món.'); location.hash = qs(NHAN, { nhan: nid });
    } catch (er) { err(er.message); }
  });
}

// ---------------------------------------------------------------- nhân viên: nhận 1 lần giao (chụp → chọn món → lặp → gửi)
async function receivePage(id) {
  const G = await rpc('app_gh_inbox', { p_branch: null });
  const d = (G.rows || []).find((y) => y.id === id);
  const back = d ? qs(NHAN, { cn: d.branch_id }) : NHAN;
  const why = !d ? 'Không tìm thấy lần giao này (quản lý đã đối soát xong, hoặc kế toán đã xoá phiếu).'
    : !G.can_recv ? 'Tài khoản của bạn không có quyền nhận hàng.'
      : d.state !== 'dang_chuyen' && !d.staff_edit && !G.can_recon ? 'Báo nhận hàng chỉ sửa được trong ngày nhận.' : '';
  if (why) return { title: 'Nhận hàng', html: html`${GH_CSS}<div class="gh-wrap"><div class="page-head"><h1>Nhận hàng</h1></div><div class="alert warn">${why} <a href="${back}">‹ Về Nhận hàng</a></div></div>` };
  const dr = draftGet(id);
  const Q = {}; const N = {};   // số thực nhận / ghi chú từng món
  d.lines.forEach((l) => { Q[l.id] = dr.q && dr.q[l.id] !== undefined ? dr.q[l.id] : d.state !== 'dang_chuyen' && l.qty_received !== null && l.qty_received !== undefined ? Number(l.qty_received) : null; N[l.id] = (dr.n && dr.n[l.id]) || ''; });
  const save = () => draftSet(id, { q: Q, n: N });
  const covered = () => { const s = new Set(); d.photos.forEach((p) => (p.lines || []).forEach((x) => s.add(x))); return s; };
  const done = (l) => Q[l.id] !== null && Q[l.id] !== undefined && (Q[l.id] === 0 || covered().has(l.id));
  const base = (l) => Number((noHd(d) ? l.qty_received : l.qty_invoice) ?? 0);   // số để so: phiếu xuất / số đã ghi (không hoá đơn)
  const lab = noHd(d) ? 'đã ghi' : 'phiếu';
  const lech = (l) => Q[l.id] !== null && Q[l.id] !== undefined && Number(Q[l.id]) !== base(l);

  return {
    title: 'Nhận hàng',
    html: html`${GH_CSS}<div class="gh-wrap" id="gh-recv"></div>`,
    mount() { draw(); },
  };

  function draw() {
    const L = d.lines; const nDone = L.filter(done).length; const left = L.filter((l) => !done(l));
    const box = $('#gh-recv'); if (!box) return;
    box.innerHTML = str(html`<div class="page-head"><div><a href="${back}" class="st-meta">‹ Nhận hàng</a><h1>Nhận hàng · ${d.doc_no || 'không hoá đơn'}</h1>
        <div class="sub">${d.branch_code} · ${dmy(G.today || vnToday())}${d.state !== 'dang_chuyen' ? ' · đã báo nhận, sửa được tới hết hôm nay' : ''}</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="gh-prog"><b>Đã nhận ${nDone} / ${L.length} món</b><span class="pill ${L.some(lech) ? 'warn' : 'mute'}">${d.photos.length} ảnh${L.some(lech) ? ` · ${L.filter(lech).length} lệch` : ''}</span></div>
      <div class="gh-bar"><i style="width:${L.length ? Math.round((nDone / L.length) * 100) : 0}%"></i></div>
      ${left.length ? html`<label class="gh-cam"><input type="file" accept="image/*" capture="environment" id="gh-shot" hidden><span class="gh-shot"></span><b>📷 ${d.photos.length ? `Chụp nhóm tiếp — còn ${left.length} món` : 'CHỤP 1 NHÓM HÀNG'}</b>
          <span class="st-meta">Bày 1 nhóm hàng ra → chụp → chọn các món có trong ảnh</span></label>`
        : html`<div class="alert ok" style="margin:0"><b>✓ Đã nhận đủ ${L.length} / ${L.length} món · ${d.photos.length} ảnh</b></div>`}
      <div id="gh-pick"></div>
      ${d.photos.length ? html`<section class="card stack" style="gap:6px"><b>Đã chụp</b><div class="gh-thumbs">${d.photos.map((p, i) => html`<button type="button" class="gh-th ${(p.lines || []).some((x) => { const l = L.find((y) => y.id === x); return l && lech(l); }) ? 'warn' : ''}" data-ph="${p.id}"><img data-path="${p.path}" alt="Ảnh ${i + 1}"><span>ảnh ${i + 1} · ${(p.lines || []).length} món</span></button>`)}</div></section>` : ''}
      ${left.length ? html`<section class="card stack" style="gap:2px"><b>Chưa nhận (${left.length})</b>${left.map((l) => html`<div class="gh-li"><div class="grow"><b>${l.name}</b><span class="st-meta">${lab} ${q3(base(l))} ${l.unit || ''}${Q[l.id] !== null && Q[l.id] !== undefined && Q[l.id] > 0 ? ' · đã đếm, chưa có ảnh' : ''}</span></div>
          ${noHd(d) ? '' : html`<button type="button" class="btn sm secondary gh-none" data-l="${l.id}">Không nhận được</button>`}</div>`)}</section>` : ''}
      ${L.some(lech) ? html`<section class="card stack" style="gap:2px"><b>Món lệch phiếu</b>${L.filter(lech).map((l) => html`<div class="gh-li"><div class="grow"><b>${l.name}</b><span class="st-meta">${lab} ${q3(base(l))} · nhận <b>${q3(Q[l.id])}</b> ${l.unit || ''} · ${Number(Q[l.id]) < base(l) ? 'thiếu' : 'thừa'} ${q3(Math.abs(Number(Q[l.id]) - base(l)))}${N[l.id] ? ' · ' + N[l.id] : ''}</span></div></div>`)}</section>` : ''}
      ${!left.length ? html`<section class="card stack" style="gap:8px"><div class="gh-kv"><span>Khớp phiếu</span><b>${L.filter((l) => !lech(l)).length}</b><span>Lệch</span><b>${L.filter(lech).length}</b><span>Ảnh</span><b>${d.photos.length}</b></div>
          <button type="button" class="btn gh-big gh-ok" id="gh-send">${noHd(d) ? 'LƯU PHIẾU NHẬN (CHỜ HOÁ ĐƠN)' : d.state === 'dang_chuyen' ? 'GỬI BÁO NHẬN' : 'GỬI LẠI BÁO NHẬN'}</button></section>` : ''}`);
    signLinks(box);
    $('#gh-shot')?.addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) pick(f); });
    $$('.gh-none', box).forEach((b) => b.addEventListener('click', () => none(L.find((l) => l.id === Number(b.dataset.l)))));
    $$('.gh-th', box).forEach((b) => b.addEventListener('click', () => photoBox(d.photos.find((p) => p.id === Number(b.dataset.ph)))));
    $('#gh-send')?.addEventListener('click', send);
  }

  // chọn các món có trong ảnh vừa chụp
  function pick(file) {
    const cov = covered(); const L = d.lines.filter((l) => !cov.has(l.id) && Q[l.id] !== 0);
    const url = URL.createObjectURL(file);
    const box = $('#gh-pick');
    box.innerHTML = str(html`<section class="card stack gh-pickc" style="gap:8px"><img class="gh-prev" src="${url}" alt="Ảnh vừa chụp">
      <b>Món có trong ảnh này?</b><span class="st-meta">Tick món → số tự điền bằng số phiếu. Đếm khác thì sửa số và ghi chú.</span>
      <div>${L.map((l) => html`<div class="gh-sel" data-l="${l.id}"><label class="gh-chk"><input type="checkbox" class="gh-c"><span><b>${l.name}</b><span class="st-meta">${lab} ${q3(base(l))} ${l.unit || ''}</span></span></label>
          <input class="input sm gh-q" inputmode="decimal" autocomplete="off" disabled aria-label="Số thực nhận ${l.name}"></div><div class="gh-note" data-n="${l.id}" hidden><input class="input sm" placeholder="Ghi chú (bắt buộc): vd thiếu 1 bao…" aria-label="Ghi chú ${l.name}"></div>`)}</div>
      <div class="gh-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" id="gh-pc">Huỷ ảnh</button><button type="button" class="btn sm gh-ok" id="gh-ps">✓ Lưu ảnh</button></div></section>`);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const upd = () => {
      let n = 0;
      $$('.gh-sel', box).forEach((row) => {
        const l = d.lines.find((x) => x.id === Number(row.dataset.l)); const c = row.querySelector('.gh-c'); const qi = row.querySelector('.gh-q'); const nb = box.querySelector(`.gh-note[data-n="${l.id}"]`);
        qi.disabled = !c.checked; if (c.checked && qi.value === '') qi.value = q3(base(l)); if (!c.checked) qi.value = '';
        const diff = c.checked && numOf(qi.value) !== null && numOf(qi.value) !== base(l);
        qi.classList.toggle('gh-w', diff); nb.hidden = !diff; if (c.checked) n++;
      });
      $('#gh-ps').textContent = n ? `✓ Lưu ảnh · ${n} món` : '✓ Lưu ảnh';
    };
    box.addEventListener('change', upd); box.addEventListener('input', upd);
    $('#gh-pc').addEventListener('click', () => { box.innerHTML = ''; URL.revokeObjectURL(url); });
    $('#gh-ps').addEventListener('click', async (ev) => {
      const picked = $$('.gh-sel', box).filter((row) => row.querySelector('.gh-c').checked).map((row) => {
        const l = d.lines.find((x) => x.id === Number(row.dataset.l)); const qv = numOf(row.querySelector('.gh-q').value); const nt = box.querySelector(`.gh-note[data-n="${l.id}"] input`).value.trim();
        return { l, qv, nt };
      });
      const err = (m) => { box.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${m}</div>`); };
      if (!picked.length) { err('Tick ít nhất 1 món có trong ảnh.'); return; }
      const bad = picked.find((x) => x.qv === null || x.qv < 0); if (bad) { err(`Nhập số thực nhận cho ${bad.l.name}.`); return; }
      const zero = picked.find((x) => x.qv === 0); if (zero) { err(`${zero.l.name}: số 0 thì không chọn trong ảnh — bấm "Không nhận được".`); return; }
      const noN = picked.find((x) => x.qv !== base(x.l) && !x.nt); if (noN) { err(`Ghi chú cho ${noN.l.name} (số khác phiếu).`); return; }
      ev.target.disabled = true; ev.target.textContent = 'Đang tải ảnh…';
      try {
        await uploadFiles(`gh${d.id}`, [file], async (path) => {
          const pid = await rpc('app_gh_photo_add', { p_id: d.id, p_path: path, p_lines: picked.map((x) => x.l.id) });
          d.photos.push({ id: pid, path, lines: picked.map((x) => x.l.id) });
        });
        picked.forEach((x) => { Q[x.l.id] = x.qv; N[x.l.id] = x.nt; }); save();
        URL.revokeObjectURL(url); showSaved(`Đã lưu ảnh ${d.photos.length} · ${picked.length} món`); draw();
      } catch (e) { ev.target.disabled = false; ev.target.textContent = '✓ Lưu ảnh'; err(e.message); }
    });
    upd();
  }
  // món không có trong thùng hàng
  function none(l) {
    const dl = dialog(html`<form class="stack" style="gap:10px;width:min(420px, calc(100vw - 56px))"><h2 style="margin:0">Không nhận được</h2>
      <div><b>${l.name}</b> · phiếu ${q3(l.qty_invoice)} ${l.unit || ''} → ghi nhận <b>0</b></div>
      <label class="field"><span>Ghi chú (bắt buộc)</span><input class="input" name="nt" placeholder="vd: không có trong thùng hàng" autocomplete="off"></label><div class="gh-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi số 0</button></div></form>`);
    const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', (e) => { e.preventDefault(); if (!f.nt.value.trim()) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Ghi chú lý do.</div>`); return; }
      Q[l.id] = 0; N[l.id] = f.nt.value.trim(); save(); dl.close(); draw(); });
  }
  // xem / sửa 1 ảnh đã chụp
  function photoBox(p) {
    const L = d.lines.filter((l) => (p.lines || []).includes(l.id));
    const dl = dialog(html`<form class="stack" style="gap:8px;width:min(460px, calc(100vw - 40px))"><img class="gh-prev" data-path="${p.path}" alt="Ảnh đã chụp">
      <b>Các món trong ảnh</b>${L.map((l) => html`<div class="gh-sel" data-l="${l.id}"><span class="grow"><b>${l.name}</b><span class="st-meta">${lab} ${q3(base(l))} ${l.unit || ''}</span></span><input class="input sm gh-q" inputmode="decimal" value="${q3(Q[l.id])}" aria-label="Số thực nhận ${l.name}"></div>
        <div class="gh-note" data-n="${l.id}"><input class="input sm" value="${N[l.id] || ''}" placeholder="Ghi chú khi số khác phiếu"></div>`)}
      <div class="gh-err"></div>
      <div class="toolbar" style="justify-content:space-between"><button type="button" class="btn sm secondary danger" id="gh-pdel">Xoá ảnh</button><span><button type="button" class="btn sm secondary" data-x>Đóng</button> <button class="btn sm" type="submit">Lưu</button></span></div></form>`);
    signLinks(dl);
    const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', (e) => { e.preventDefault();
      for (const l of L) { const qv = numOf(f.querySelector(`.gh-sel[data-l="${l.id}"] .gh-q`).value); const nt = f.querySelector(`.gh-note[data-n="${l.id}"] input`).value.trim();
        if (qv === null || qv <= 0) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${l.name}: nhập số lớn hơn 0 (không có hàng thì xoá ảnh, chọn "Không nhận được").</div>`); return; }
        if (qv !== base(l) && !nt) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Ghi chú cho ${l.name} (số khác phiếu).</div>`); return; }
        Q[l.id] = qv; N[l.id] = nt; }
      save(); dl.close(); draw(); });
    dl.querySelector('#gh-pdel').addEventListener('click', async () => {
      if (!confirm('Xoá ảnh này? Các món trong ảnh quay lại "chưa nhận".')) return;
      try { const path = await rpc('app_gh_photo_del', { p_photo: p.id }); if (path) await sb.storage.from(BUCKET).remove([path]); d.photos = d.photos.filter((x) => x.id !== p.id); dl.close(); draw(); }
      catch (e) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }
  async function send(ev) {
    const L = d.lines;
    if (L.some((l) => !done(l))) { showSaved('Còn món chưa nhận.', true); return; }
    const notes = L.filter((l) => lech(l) || (Q[l.id] === 0 && N[l.id])).map((l) => `${l.name}: phiếu ${q3(l.qty_invoice)}, nhận ${q3(Q[l.id])}${N[l.id] ? ' — ' + N[l.id] : ''}`);
    ev.target.disabled = true;
    try {
      const r = noHd(d)
        ? (await rpc('app_gh_receipt_save', { p_id: d.id, p_branch: d.branch_id, p_lines: L.map((l) => ({ id: l.id, code: l.code, name: l.name, unit: l.unit, qty: Q[l.id] })), p_note: [d.receive_note, ...notes].filter(Boolean).join('; ') }), { mismatch: 0, nohd: true })
        : await rpc('app_gh_receive', { p_id: d.id, p_lines: L.map((l) => ({ id: l.id, qty: Q[l.id] })), p_note: notes.join('; ') });
      draftDel(id);
      flash(r.nohd ? 'Đã lưu phiếu nhận hàng không hoá đơn — chờ kế toán ghép hoá đơn.' : r.mismatch ? `Đã gửi báo nhận — ${r.mismatch} món lệch phiếu, đã báo quản lý.` : 'Đã gửi báo nhận — nhận đủ.', r.mismatch ? 'warn' : 'ok');
      location.hash = back;
    } catch (e) { ev.target.disabled = false; showSaved(e.message, true); }
  }
}

// ---------------------------------------------------------------- Đối soát: các lần giao của cơ sở (chờ đối soát / đang chuyển / lệch / xong)
async function listPage(params, can) {
  const today = vnToday();
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : today.slice(0, 7);
  const G = await rpc('app_gh_inbox', { p_branch: null });
  const { brs, br } = await branchesFor(params, G, can);
  const Dm = await rpc('app_nh_list', { p_month: month, p_branch: br || null });
  const seen = new Set(); const rows = [];
  [...(G.rows || []), ...(Dm.rows || [])].forEach((r) => { if (r.branch_id === br && !seen.has(r.id)) { seen.add(r.id); rows.push(r); } });
  const tab = ['dang', 'cho', 'lech', 'xong'].includes(params.tt) ? params.tt : null;
  const grp = (d) => (d.state === 'dang_chuyen' ? 'dang' : d.state === 'cho_hoa_don' || d.n_unchecked ? 'cho' : d.result === 'lech' ? 'lech' : 'xong');
  const cnt = (k) => rows.filter((d) => grp(d) === k).length;
  const def = tab || (cnt('cho') ? 'cho' : cnt('dang') ? 'dang' : 'xong');
  const list = rows.filter((d) => grp(d) === def).sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || b.id - a.id);
  const nCho = (id) => (G.rows || []).filter((d) => d.branch_id === id && d.state !== 'dang_chuyen').length;
  const q = (o) => qs(DS, { cn: br, thang: month, tt: def, ...o });
  const shiftMonth = (k) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };
  const life = (d) => { const step = d.state === 'dang_chuyen' ? 1 : d.n_unchecked || d.state === 'cho_hoa_don' ? 2 : 3;
    return html`<div class="gh-life"><span class="on">Xuất</span><i></i><span class="${step >= 2 ? 'on' : ''}">Nhận</span><i></i><span class="${step >= 3 ? 'on' : ''}">Đối soát</span><i></i><span class="${step >= 3 ? (d.result === 'lech' ? 'x' : 'on') : ''}">${step >= 3 && d.result === 'lech' ? `Lệch ${d.n_mismatch}` : 'Xong'}</span></div>`; };
  const card = (d) => html`<div class="card gh-card"><div class="gh-ch"><b>${d.doc_no || 'Nhận hàng không hoá đơn'} · ${dmy(d.work_date).slice(0, 5)}</b>${stTag(d)}</div>${life(d)}
      <div class="st-meta">${d.n_lines} món${d.received_by ? ` · ${d.received_by}` : ''}${d.photos ? ` · ${d.photos.length} ảnh` : ''}${Dm.money && d.total != null ? ` · ${fmt(d.total)}đ` : ''}</div>
      <div class="toolbar" style="gap:6px">${grp(d) === 'cho' && can('doi_soat') ? html`<a class="btn sm" href="${qs(DS, { ds: d.id })}">ĐỐI SOÁT ›</a>` : ''}
        ${d.state === 'dang_chuyen' && G.can_recv ? html`<a class="btn sm" href="${qs(NHAN, { nhan: d.id })}">Nhận hàng ›</a>` : ''}
        ${d.state !== 'dang_chuyen' ? html`<a class="btn sm secondary" href="${qs(DS, { xem: d.id })}">Xem</a>` : ''}</div></div>`;
  return {
    title: 'Đối soát hàng',
    html: html`${GH_CSS}<div class="gh-wrap gh-wide"><div class="page-head"><div><h1>Đối soát hàng kho tổng</h1><div class="sub">Đối soát theo từng ảnh nhân viên chụp. Đối soát xong: món thiếu sang "Chờ giao bù", món thừa sang "Chờ hoá đơn bổ sung" ở tab Kiểm soát.</div></div></div>
      <section class="card gh-bar2"><nav class="branch-tabs" aria-label="Cơ sở">${brs.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${q({ cn: b.id, tt: '' })}">${b.code}${nCho(b.id) ? html` <span class="badge">${nCho(b.id)}</span>` : ''}</a>`)}</nav>
        <div class="gh-mon"><a class="btn sm secondary" href="${q({ thang: shiftMonth(-1) })}" aria-label="Tháng trước">‹</a><strong>Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(1) })}" aria-label="Tháng sau">›</a></div></section>
      <nav class="gh-tabs" aria-label="Lọc">${[['cho', '✔ Chờ đối soát'], ['dang', '🚚 Đang chuyển'], ['lech', '⚠ Lệch'], ['xong', '✓ Xong']].map(([k, l]) => html`<a class="${def === k ? 'on' : ''}" href="${q({ tt: k })}">${l} <b>${cnt(k)}</b></a>`)}</nav>
      <div class="gh-grid">${list.length ? list.map(card) : html`<div class="card st-meta">Không có lần giao nào ở mục này.</div>`}</div></div>`,
  };
}

// ---------------------------------------------------------------- quản lý: đối soát theo từng ảnh (ds) / xem (xem)
async function reconPage(id, editable) {
  let d = null;
  const find = async () => {
    const G = await rpc('app_gh_inbox', { p_branch: null }).catch(() => null);
    const x0 = G && (G.rows || []).find((r) => r.id === id); if (x0) return x0;
    const today = vnToday();
    for (const m of [today.slice(0, 7), addDays(today.slice(0, 7) + '-01', -1).slice(0, 7), addDays(addDays(today.slice(0, 7) + '-01', -1).slice(0, 7) + '-01', -1).slice(0, 7)]) {
      const D = await rpc('app_nh_list', { p_month: m, p_branch: null }).catch(() => null);
      const x = D && [...(D.rows || []), ...(D.open || [])].find((r) => r.id === id); if (x) return x;
    }
    return null;
  };
  d = await find();
  if (!d) return { title: 'Đối soát hàng', html: html`${GH_CSS}<div class="gh-wrap"><div class="page-head"><h1>Đối soát hàng</h1></div><div class="alert warn">Không tìm thấy lần giao này. <a href="${DS}">‹ Về Đối soát hàng</a></div></div>` };
  return { title: 'Đối soát hàng', html: html`${GH_CSS}<div class="gh-wrap" id="gh-ds"></div>`, mount() { draw(); } };

  function draw() {
    const box = $('#gh-ds'); if (!box) return;
    const L = d.lines; const byId = new Map(L.map((l) => [l.id, l]));
    const isLech = (l) => l.qty_invoice != null && Number(l.qty_received ?? 0) !== Number(l.qty_invoice ?? 0);   // không hoá đơn: chưa có số để so
    const photos = [...d.photos].sort((a, b) => Number((b.lines || []).some((x) => byId.get(x) && isLech(byId.get(x)))) - Number((a.lines || []).some((x) => byId.get(x) && isLech(byId.get(x)))));
    const inPhoto = new Set(d.photos.flatMap((p) => p.lines || []));
    const noPhoto = L.filter((l) => !inPhoto.has(l.id));
    const nChk = L.filter((l) => l.checked_at).length;
    const can = editable && d.state !== 'dang_chuyen';
    const row = (l) => { const q = l.qty_checked ?? l.qty_received; const diff = l.qty_invoice != null && Number(q ?? 0) !== Number(l.qty_invoice ?? 0);
      return html`<div class="gh-dl ${l.checked_at ? 'done' : ''}" data-l="${l.id}"><div class="grow"><b>${l.name}</b>
          <span class="st-meta">${l.qty_invoice != null ? `phiếu ${q3(l.qty_invoice)} · ` : 'chưa có hoá đơn · '}NV ${q3(l.qty_received)}${l.qty_checked != null && Number(l.qty_checked) !== Number(l.qty_received) ? html` · <b>QL sửa ${q3(l.qty_checked)}</b>` : ''} ${l.unit || ''}${diff ? html` <span class="pill ${Number(q ?? 0) < Number(l.qty_invoice ?? 0) ? 'warn' : 'info'}">${Number(q ?? 0) < Number(l.qty_invoice ?? 0) ? 'thiếu' : 'thừa'} ${q3(Math.abs(Number(q ?? 0) - Number(l.qty_invoice ?? 0)))}</span>` : ''}${l.check_note ? ' · ' + l.check_note : ''}</span></div>
        <span class="gh-act">${l.checked_at ? html`<span class="pill ok">✓</span>${can ? html`<button type="button" class="btn sm secondary gh-un">Bỏ</button>` : ''}` : can ? html`<button type="button" class="btn sm gh-ok gh-one">Đúng</button><button type="button" class="btn sm secondary gh-fix">Sai số…</button>` : ''}</span></div>`; };
    box.innerHTML = str(html`<div class="page-head"><div><a href="${qs(DS, { cn: d.branch_id })}" class="st-meta">‹ Đối soát hàng</a><h1>${editable ? 'Đối soát' : 'Lần giao'} · ${d.doc_no || 'không hoá đơn'}</h1>
        <div class="sub">${d.branch_code} · ${dmy(d.work_date)}${d.received_by ? ` · nhận: ${d.received_by} ca ${d.received_shift || '?'}` : ''} · ${stTag(d)}</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
      ${d.receive_note ? html`<div class="alert warn" style="margin:0">Ghi chú nhân viên: ${d.receive_note}</div>` : ''}
      <div class="gh-prog"><b>Đã đối soát ${nChk} / ${L.length} món</b><span class="pill mute">${d.photos.length} ảnh</span></div><div class="gh-bar"><i style="width:${L.length ? Math.round((nChk / L.length) * 100) : 0}%"></i></div>
      ${nChk === L.length && d.state !== 'dang_chuyen' ? html`<div class="alert ok" style="margin:0"><b>✓ Đã đối soát ${L.length}/${L.length} món.</b> Khớp ${L.filter((l) => Number(l.qty_checked ?? l.qty_received ?? 0) === Number(l.qty_invoice ?? 0)).length} · lệch ${L.filter((l) => Number(l.qty_checked ?? l.qty_received ?? 0) !== Number(l.qty_invoice ?? 0)).length}${L.some((l) => l.qty_checked != null && Number(l.qty_checked) !== Number(l.qty_received)) ? ' · món quản lý sửa số đã báo nhân viên' : ''}${L.some((l) => Number(l.qty_checked ?? l.qty_received ?? 0) !== Number(l.qty_invoice ?? 0)) && d.doc_no ? ' · món lệch đã chuyển sang Kiểm soát (giao bù / hoá đơn bổ sung)' : ''}. <a href="${qs(DS, { cn: d.branch_id })}">‹ Về Đối soát hàng</a></div>` : ''}
      ${photos.map((p, i) => { const PL = (p.lines || []).map((x) => byId.get(x)).filter(Boolean); const open = PL.filter((l) => !l.checked_at).length;
        return html`<section class="card gh-pc" data-ph="${p.id}"><a target="_blank" rel="noopener"><img class="gh-prev" data-path="${p.path}" alt="Ảnh ${i + 1}"></a>
          <div class="gh-ch"><b>Ảnh ${i + 1} · ${PL.length} món</b>${can && open > 1 ? html`<button type="button" class="btn sm gh-ok gh-all">✓ Đúng cả ảnh (${open} món)</button>` : ''}</div>${PL.map(row)}</section>`; })}
      ${noPhoto.length ? html`<section class="card gh-pc"><b>Món không có ảnh (nhân viên ghi không nhận được)</b>${noPhoto.map(row)}</section>` : ''}`);
    signLinks(box);
    const act = async (b, fn) => { b.disabled = true; try { await fn(); } catch (e) { showSaved(e.message, true); } b.disabled = false; };
    const setL = (lid, res) => { const l = byId.get(lid); l.qty_checked = res.qty; l.checked_at = new Date().toISOString(); };
    $$('.gh-one', box).forEach((b) => b.addEventListener('click', () => act(b, async () => { const lid = Number(b.closest('[data-l]').dataset.l); setL(lid, await rpc('app_nh_check', { p_line: lid, p_qty: null, p_note: null })); draw(); })));
    $$('.gh-all', box).forEach((b) => b.addEventListener('click', () => act(b, async () => {
      const p = d.photos.find((x) => x.id === Number(b.closest('[data-ph]').dataset.ph));
      for (const lid of (p.lines || [])) { const l = byId.get(lid); if (l && !l.checked_at) setL(lid, await rpc('app_nh_check', { p_line: lid, p_qty: null, p_note: null })); }
      showSaved('Đã đối soát cả ảnh'); draw();
    })));
    $$('.gh-un', box).forEach((b) => b.addEventListener('click', () => act(b, async () => { const lid = Number(b.closest('[data-l]').dataset.l); await rpc('app_nh_uncheck', { p_line: lid }); const l = byId.get(lid); l.checked_at = null; l.qty_checked = null; l.check_note = null; draw(); })));
    $$('.gh-fix', box).forEach((b) => b.addEventListener('click', () => {
      const l = byId.get(Number(b.closest('[data-l]').dataset.l));
      const dl = dialog(html`<form class="stack" style="gap:10px;width:min(420px, calc(100vw - 56px))"><h2 style="margin:0">Sai số lượng</h2>
        <div><b>${l.name}</b> · phiếu ${q3(l.qty_invoice)} · NV đếm ${q3(l.qty_received)} ${l.unit || ''}</div>
        <label class="field"><span>Số đúng (quản lý đếm)</span><input class="input" name="q" inputmode="decimal" autocomplete="off"></label>
        <label class="field"><span>Ghi chú (bắt buộc)</span><input class="input" name="nt" autocomplete="off" placeholder="vd: đếm lại thấy 5 bao"></label><div class="gh-err"></div>
        <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu số đúng</button></div></form>`);
      const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
      f.addEventListener('submit', async (e) => { e.preventDefault(); const qv = numOf(f.q.value);
        if (qv === null || qv < 0) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Nhập số đúng.</div>`); return; }
        try { const res = await rpc('app_nh_check', { p_line: l.id, p_qty: qv, p_note: f.nt.value }); setL(l.id, res); l.check_note = f.nt.value.trim() || null; dl.close(); draw(); }
        catch (er) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${er.message}</div>`); } });
    }));
  }
}

export const GH_CSS = html`<style>
  .gh-wrap { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; } .gh-wrap.gh-wide { max-width: 1000px; }
  .gh-hero { background: #fde9b8; border: 2px solid #d99a3a; display: flex; flex-direction: column; gap: 6px; } .gh-hero-t { font-weight: 800; font-size: 16px; } .gh-hero2 { background: var(--card); border-color: var(--line); }
  .gh-link { display: block; text-decoration: none; font-weight: 700; color: var(--primary); }
  .gh-big { display: block; text-align: center; font-size: 16px; padding: 12px; width: 100%; } .gh-ok { background: #2f7a3e !important; border-color: #2f7a3e !important; color: #fff !important; }
  .gh-prog { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
  .gh-bar { height: 7px; background: var(--line-soft); border-radius: 4px; overflow: hidden; } .gh-bar i { display: block; height: 100%; background: var(--primary); }
  .gh-cam { display: flex; flex-direction: column; align-items: center; gap: 6px; background: #1f2622; color: #e8efe9; border-radius: 14px; padding: 18px 12px; cursor: pointer; text-align: center; }
  .gh-cam .st-meta { color: #b9c6bd; } .gh-shot { width: 58px; height: 58px; border-radius: 50%; border: 4px solid #fff; background: var(--primary); }
  .gh-prev { width: 100%; max-height: 300px; object-fit: contain; border-radius: 10px; background: #1f2622; display: block; }
  .gh-sel { display: grid; grid-template-columns: minmax(0, 1fr) 84px; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); }
  .gh-chk { display: flex; gap: 8px; align-items: center; cursor: pointer; min-width: 0; } .gh-chk input { width: 22px; height: 22px; flex: 0 0 auto; } .gh-chk b, .gh-sel b { display: block; overflow-wrap: anywhere; }
  .gh-sel .st-meta { display: block; } .gh-q { text-align: center; font-size: 17px !important; font-weight: 800; } .gh-w { border-color: #d97706 !important; background: #fff7e6 !important; }
  .gh-note { padding: 0 0 6px; } .gh-note[hidden] { display: none; } .gh-note input { width: 100%; }
  .gh-thumbs { display: flex; gap: 6px; flex-wrap: wrap; } .gh-th { border: 2px solid var(--line); border-radius: 10px; padding: 0; background: var(--card); width: 84px; overflow: hidden; cursor: pointer; }
  .gh-th img { width: 100%; height: 64px; object-fit: cover; display: block; background: var(--line-soft); } .gh-th span { display: block; font-size: 11px; padding: 2px; } .gh-th.warn { border-color: #d97706; }
  .gh-li { display: flex; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); } .gh-li .st-meta { display: block; } .gh-li .btn { width: auto; white-space: nowrap; font-size: 11px; padding: 6px 8px; flex: 0 0 auto; } .gh-li .grow { min-width: 0; }
  .gh-kv { display: grid; grid-template-columns: 1fr auto; gap: 3px 10px; }
  .gh-bar2 { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; }
  .gh-mon { display: flex; align-items: center; gap: 8px; } .gh-mon .btn { width: auto; }
  .gh-tabs { display: flex; gap: 6px; flex-wrap: wrap; } .gh-tabs a { border: 1.5px solid var(--primary); color: var(--primary); border-radius: 10px; padding: 6px 10px; font-weight: 700; font-size: 13px; text-decoration: none; background: var(--card); }
  .gh-tabs a.on { background: var(--primary); color: #fff; }
  .gh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
  .gh-card { display: flex; flex-direction: column; gap: 6px; } .gh-card .btn { width: auto; } .gh-ch { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; } .gh-ch .btn { width: auto; }
  .gh-life { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; font-size: 11px; } .gh-life span { padding: 2px 7px; border-radius: 999px; background: var(--line-soft); color: var(--ink-2); font-weight: 700; }
  .gh-life span.on { background: #2f3e33; color: #fff; } .gh-life span.x { background: #fde2e2; color: #b91c1c; } .gh-life i { width: 8px; height: 2px; background: var(--line); }
  .gh-pc { display: flex; flex-direction: column; gap: 6px; }
  .gh-dl { display: flex; gap: 6px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); } .gh-dl .grow { min-width: 0; flex: 1 1 auto; } .gh-act { display: flex; gap: 4px; flex: 0 0 auto; align-items: center; } .gh-dl .st-meta { display: block; } .gh-dl .btn { width: auto; }
  .gh-dl.done { opacity: .75; }
  .gh-nr { display: grid; grid-template-columns: minmax(0, 1fr) 70px 70px; gap: 6px; } .gh-nrs { display: flex; flex-direction: column; gap: 6px; }
</style>`;
