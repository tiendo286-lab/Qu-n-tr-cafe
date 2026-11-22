// Hàng hoá › Nhận hàng · Đối soát (bước 104; bước 106 thêm món ngoài phiếu, hoá đơn giao, xác nhận đối soát xong — anh Tiến chốt 15/11/2026).
//  * Nhận hàng (/hang-hoa/nhan): nhân viên CHỤP 1 nhóm hàng → CHỌN các món có trong ảnh (số tự điền = số phiếu, khác thì sửa + ghi chú)
//    → lặp tới hết món → GỬI BÁO NHẬN. Món kho quên giao: "Không nhận được" (số 0 + ghi chú). Nhận hàng KHÔNG có hoá đơn cũng ở đây.
//    Không cần mở phiếu chốt ca (máy chủ: app_gh_*, không gắn phiếu ca).
//  * Đối soát (/hang-hoa/doi-soat): quản lý đối soát THEO TỪNG ẢNH (ảnh có món lệch hiện trước) — "✓ Đúng cả ảnh" hoặc "Sai số" từng món.
//    Đối soát xong: món thiếu → "Chờ giao bù", món thừa → "Chờ hoá đơn bổ sung" ở tab Kiểm soát.
import { addDays, catalog, vnToday } from '../data.js';
import { rpc, sb } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';
import { BUCKET, signLinks, uploadFiles } from './ke_toan_hoa_don.js';
import { KINDS, LOC_CSS, coverRange, inLoc, locBar, locLabel, locQuery, locRemember, locTooLong, sortLoc, wireLoc } from '../loc_ngay.js';
const MAX_PER_PHOTO = 4;   // bước 132: mỗi ảnh nhận hàng tối đa 4 món (máy chủ cũng chặn)

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
  if (params.nhan) return receivePage(params.nhan === 'moi' ? 'moi' : Number(params.nhan), params, can);
  if (params.ds || params.xem) return reconPage(Number(params.ds || params.xem), !!params.ds && can('doi_soat'), can);
  // chặng 4 (anh Tiến chốt 22/11): danh sách Đối soát hàng chỉ dành cho người có quyền Đối soát (menu cũng chỉ hiện cho họ); người khác gõ địa chỉ
  // thì về Nhận hàng. Máy chủ vốn đã chặn mọi nút đối soát (app__need('doi_soat')) và không trả tiền hàng; ?xem= (xem một lần giao) vẫn mở như cũ.
  if (routePath() === '/hang-hoa/doi-soat' && !can('doi_soat')) {
    try { history.replaceState(null, '', NHAN + (params.cn ? `?cn=${encodeURIComponent(params.cn)}` : '')); } catch (_) { /* giữ địa chỉ cũ */ }
    return nhanList(params, can);
  }
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
    html: html`${GH_CSS}<div class="gh-wrap"><div class="page-head"><div><h1>Nhận hàng kho tổng</h1><div class="sub">Hàng tới thì bấm Nhận hàng: chụp từng nhóm hàng → chọn món trong ảnh → chụp hoá đơn giao → xác nhận. Không cần mở phiếu chốt ca.</div></div></div>
      ${brs.length > 1 ? html`<nav class="branch-tabs" aria-label="Cơ sở">${brs.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${qs(NHAN, { cn: b.id })}">${b.code}${nWait(b.id) ? html` <span class="badge">${nWait(b.id)}</span>` : ''}</a>`)}</nav>` : ''}
      ${rows.length ? rows.map((d) => html`<div class="card gh-hero ${d.state === 'dang_chuyen' ? '' : 'gh-hero2'}"><div class="gh-hero-t">${d.state === 'dang_chuyen' ? '🚚 Đang chuyển tới' : noHd(d) ? '🧾 Chưa có phiếu xuất — chờ kế toán ghép ·' : '✓ Đã báo nhận — còn sửa được hôm nay ·'} ${d.branch_code}</div>
            <div class="st-meta">${d.doc_no ? `Phiếu ${d.doc_no}` : 'Chưa có phiếu xuất'} · ${d.n_lines} món${d.ship_at ? ` · kho xuất ${String(d.ship_at).slice(11, 16)} ${dmy(d.ship_at.slice(0, 10)).slice(0, 5)}` : ''}${d.received_by ? ` · ${d.received_by}` : ''}</div>
            ${G.can_recv ? html`<a class="btn gh-big ${d.state === 'dang_chuyen' ? '' : 'secondary'}" href="${qs(NHAN, { nhan: d.id })}">${d.state === 'dang_chuyen' ? 'NHẬN HÀNG ›' : 'XEM / SỬA ›'}</a>` : ''}</div>`)
        : html`<div class="card st-meta">Không có hàng kho tổng nào đang chuyển tới ${BR.code || ''}.</div>`}
      ${G.can_recv && br ? html`<div class="toolbar"><a class="btn secondary gh-nohd" href="${qs(NHAN, { nhan: 'moi', cn: br })}">+ Nhận hàng chưa có phiếu xuất · ${BR.code}</a></div>` : ''}
      ${can('doi_soat') && nDs ? html`<a class="card gh-link" href="${qs(DS, { cn: br })}">✔ ${nDs} lần giao của ${BR.code} chờ đối soát ›</a>` : ''}</div>`,
  };
}

// ---------------------------------------------------------------- nhân viên: nhận 1 lần giao — 3 bước (bước 106, anh Tiến chốt 15/11/2026)
//  1. Chụp hàng: chụp 1 nhóm → chọn món trong phiếu có trong ảnh (khác số thì sửa + ghi chú) + "Món KHÔNG có trong phiếu" (kho giao dư) → lặp tới hết.
//     Không hoá đơn (chưa có phiếu xuất trên web): chụp → ghi tên + số lượng → lặp (id = 'moi': phiếu tạo khi lưu ảnh đầu).
//  2. Hoá đơn giao: chụp tờ hoá đơn tài xế mang kèm (bắt buộc) — hoặc "Tài xế không mang hoá đơn giao" + ghi chú.
//  3. Xác nhận: ảnh hoá đơn giao + danh sách đã nhận trên web để so → "Đã nhận đủ hàng hoá giống hoá đơn" / "Xác nhận số thực nhận: thiếu / thừa như trên".
async function receivePage(id, params = {}, can = () => false) {
  const G = await rpc('app_gh_inbox', { p_branch: null });
  let d = null;
  if (id === 'moi') {
    const { BR } = await branchesFor({ cn: params.cn }, G, can);
    if (BR.id) d = { id: null, state: 'cho_hoa_don', kind: 'khong_hd', branch_id: BR.id, branch_code: BR.code, lines: [], photos: [], staff_edit: true, receive_note: null };
  } else d = (G.rows || []).find((y) => y.id === id);
  const cat = G.catalog || [];
  const back = d ? qs(NHAN, { cn: d.branch_id }) : NHAN;
  const why = !d ? 'Không tìm thấy lần giao này (quản lý đã đối soát xong, hoặc kế toán đã xoá phiếu).'
    : !G.can_recv ? 'Tài khoản của bạn không có quyền nhận hàng.'
      : d.state !== 'dang_chuyen' && !d.staff_edit && !G.can_recon ? 'Báo nhận hàng chỉ sửa được trong ngày nhận.' : '';
  if (why) return { title: 'Nhận hàng', html: html`${GH_CSS}<div class="gh-wrap"><div class="page-head"><h1>Nhận hàng</h1></div><div class="alert warn">${why} <a href="${back}">‹ Về Nhận hàng</a></div></div>` };
  const dr = draftGet(id);
  const Q = {}; const N = {};   // số thực nhận / ghi chú từng món
  d.lines.forEach((l) => { Q[l.id] = dr.q && dr.q[l.id] !== undefined ? dr.q[l.id] : d.state !== 'dang_chuyen' && l.qty_received !== null && l.qty_received !== undefined ? Number(l.qty_received) : null; N[l.id] = (dr.n && dr.n[l.id]) || ''; });
  const save = () => draftSet(d.id || id, { q: Q, n: N });
  const nh = noHd(d);
  const isEx = (l) => !nh && (l.qty_invoice === null || l.qty_invoice === undefined);   // món ngoài phiếu
  const has = (l) => Q[l.id] !== null && Q[l.id] !== undefined;
  const covered = () => { const s = new Set(); d.photos.forEach((p) => (p.lines || []).forEach((x) => s.add(x))); return s; };
  const done = (l) => has(l) && (Q[l.id] === 0 || covered().has(l.id));
  const base = (l) => Number((nh ? l.qty_received : l.qty_invoice) ?? 0);   // số để so: phiếu xuất / số đã ghi (không hoá đơn)
  const lab = nh ? 'đã ghi' : 'phiếu';
  const lech = (l) => !nh && has(l) && (isEx(l) ? Number(Q[l.id]) > 0 : Number(Q[l.id]) !== base(l));
  const lechTag = (l) => (isEx(l) ? html`<span class="pill off">ngoài phiếu</span>` : Number(Q[l.id]) === 0 ? html`<span class="pill warn">không nhận</span>`
    : Number(Q[l.id]) < base(l) ? html`<span class="pill warn">thiếu ${q3(base(l) - Number(Q[l.id]))}</span>` : html`<span class="pill info">thừa ${q3(Number(Q[l.id]) - base(l))}</span>`);
  const lechTxt = (l) => (isEx(l) ? `${l.name} ngoài phiếu ${q3(Q[l.id])} ${l.unit || ''}` : Number(Q[l.id]) === 0 ? `${l.name} không nhận ${q3(base(l))} ${l.unit || ''}`
    : `${l.name} ${Number(Q[l.id]) < base(l) ? 'thiếu' : 'thừa'} ${q3(Math.abs(Number(Q[l.id]) - base(l)))} ${l.unit || ''}`).trim();
  const payload = () => d.lines.map((l) => ({ id: l.id, code: l.code, name: l.name, unit: l.unit, qty: Q[l.id] ?? l.qty_received }));
  const refetch = async () => { const f = ((await rpc('app_gh_inbox', { p_branch: d.branch_id })).rows || []).find((x) => x.id === d.id); if (!f) throw new Error('Đã lưu nhưng không tải lại được phiếu — tải lại trang.'); return f; };

  return {
    title: 'Nhận hàng',
    html: html`${GH_CSS}<div class="gh-wrap" id="gh-recv"></div>`,
    mount() { draw(); },
  };

  function draw() {
    const L = d.lines; const nDone = L.filter(done).length; const left = L.filter((l) => !done(l));
    const s1 = L.length > 0 && !left.length; const hasDeliv = !!(d.deliv_path || d.deliv_note);
    const lechs = L.filter(lech);
    const box = $('#gh-recv'); if (!box) return;
    box.innerHTML = str(html`<div class="page-head"><div><a href="${back}" class="st-meta">‹ Nhận hàng</a><h1>Nhận hàng · ${d.doc_no || 'chưa có phiếu xuất'}</h1>
        <div class="sub">${d.branch_code} · ${dmy(G.today || vnToday())}${!d.id ? ' · chụp nhóm hàng đầu tiên rồi ghi tên + số lượng' : d.state !== 'dang_chuyen' ? ' · đã báo nhận, sửa được tới hết hôm nay' : ''}</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <nav class="gh-steps" aria-label="Các bước"><span class="${s1 ? 'ok' : 'on'}">1. Chụp hàng${s1 ? ' ✓' : ''}</span><span class="${hasDeliv && s1 ? 'ok' : s1 ? 'on' : ''}">2. Hoá đơn giao${hasDeliv && s1 ? ' ✓' : ''}</span><span class="${s1 && hasDeliv ? 'on' : ''}">3. Xác nhận</span></nav>
      <div class="gh-prog"><b>${nh ? `Đã ghi ${L.length} món` : `Đã nhận ${nDone} / ${L.length} món`}</b><span class="pill ${lechs.length ? 'warn' : 'mute'}">${d.photos.length} ảnh${lechs.length ? ` · ${lechs.length} khác phiếu` : ''}</span></div>
      <div class="gh-bar"><i style="width:${L.length ? Math.round((nDone / L.length) * 100) : 0}%"></i></div>
      ${nh || left.length || !L.length ? html`<label class="gh-cam"><input type="file" accept="image/*" capture="environment" id="gh-shot" hidden><span class="gh-shot"></span><b>📷 ${!d.photos.length ? 'CHỤP 1 NHÓM HÀNG' : nh || !left.length ? 'Chụp nhóm tiếp' : `Chụp nhóm tiếp — còn ${left.length} món`}</b>
          <span class="st-meta">${nh ? 'Bày 1 nhóm hàng ra → chụp → ghi tên + số lượng các món trong ảnh' : 'Bày 1 nhóm hàng ra → chụp → chọn các món có trong ảnh'}</span></label>`
        : html`<label class="gh-more"><input type="file" accept="image/*" capture="environment" id="gh-shot" hidden>✓ Đã chụp hết ${L.length} món · <u>còn món ngoài phiếu? chụp thêm</u></label>`}
      <div id="gh-pick"></div>
      ${d.photos.length ? html`<section class="card stack" style="gap:6px"><b>Đã chụp <span class="st-meta">— bấm ảnh để xem / sửa số</span></b><div class="gh-thumbs">${d.photos.map((p, i) => html`<button type="button" class="gh-th ${(p.lines || []).some((x) => { const l = L.find((y) => y.id === x); return l && lech(l); }) ? 'warn' : ''}" data-ph="${p.id}"><img data-path="${p.path}" alt="Ảnh ${i + 1}"><span>ảnh ${i + 1} · ${(p.lines || []).length} món</span></button>`)}</div></section>` : ''}
      ${left.length ? html`<section class="card stack" style="gap:2px"><b>${nh ? 'Đã ghi, chưa có ảnh' : 'Chưa nhận'} (${left.length})</b>${left.map((l) => html`<div class="gh-li"><div class="grow"><b>${l.name}</b><span class="st-meta">${lab} ${q3(base(l))} ${l.unit || ''}${has(l) && Q[l.id] > 0 ? ' · đã đếm, chưa có ảnh' : ''}</span></div>
          ${nh || isEx(l) ? '' : html`<button type="button" class="btn sm secondary gh-none" data-l="${l.id}">Không nhận được</button>`}</div>`)}</section>` : ''}
      ${s1 && !hasDeliv ? html`<label class="gh-cam gh-cam2"><input type="file" accept="image/*" capture="environment" id="gh-dshot" hidden><span class="gh-shot"></span><b>📄 CHỤP HOÁ ĐƠN GIAO</b>
          <span class="st-meta">Tờ hoá đơn tài xế mang kèm hàng — chụp rõ cả tờ</span></label>
        <div style="text-align:center"><button type="button" class="btn secondary" id="gh-dnone">Tài xế không mang hoá đơn giao</button></div>` : ''}
      ${s1 && hasDeliv ? html`<section class="card stack" style="gap:8px" id="gh-step3"><div class="gh-ch"><b>Hoá đơn giao</b>
            <span><label class="btn sm secondary">${d.deliv_path ? 'Chụp lại' : 'Chụp hoá đơn'}<input type="file" accept="image/*" capture="environment" id="gh-dshot" hidden></label>${d.deliv_path ? '' : html` <button type="button" class="btn sm secondary" id="gh-dnone">Sửa ghi chú</button>`}</span></div>
          ${d.deliv_path ? html`<a target="_blank" rel="noopener" class="gh-inv"><img class="gh-prev" data-path="${d.deliv_path}" alt="Ảnh hoá đơn giao"><span>🔍 bấm để phóng to</span></a>`
            : html`<div class="alert warn" style="margin:0">Tài xế không mang hoá đơn giao: ${d.deliv_note}<br><span class="st-meta">Kế toán sẽ tải hoá đơn bù thì quản lý mới đối soát xong.</span></div>`}
        </section>
        <section class="card stack" style="gap:6px"><b>Danh sách đã nhận trên web <span class="st-meta">— so từng dòng với hoá đơn giao</span></b>
          <div>${L.map((l) => html`<div class="gh-cmp"><span class="grow">${l.name}${isEx(l) ? '' : ''}</span><b>${q3(Q[l.id])} ${l.unit || ''}</b>${lech(l) ? lechTag(l) : ''}</div>`)}</div>
          <div class="st-meta">Ghi sai? Bấm vào ảnh đã chụp ở trên để sửa số, hoặc chụp thêm món.</div></section>
        ${nh ? html`<input class="input sm" id="gh-anote" value="${d.receive_note || ''}" placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú">` : ''}
        ${lechs.length ? html`<div class="gh-warnbox"><b>Có ${lechs.length} món khác hoá đơn:</b><br>${lechs.map(lechTxt).join(' · ')}</div>`
          : html`<div class="gh-okbox"><b>✓ ${nh ? `${L.length} món đã ghi` : `Khớp hoá đơn — ${L.length}/${L.length} món`}</b></div>`}
        <button type="button" class="btn gh-big gh-ok" id="gh-send">${lechs.length ? 'XÁC NHẬN SỐ THỰC NHẬN: THIẾU / THỪA NHƯ TRÊN' : 'ĐÃ NHẬN ĐỦ HÀNG HOÁ GIỐNG HOÁ ĐƠN'}</button>` : ''}`);
    signLinks(box);
    $('#gh-shot')?.addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) pick(f); });
    $('#gh-dshot')?.addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) delivShot(f); });
    $('#gh-dnone')?.addEventListener('click', delivNone);
    $$('.gh-none', box).forEach((b) => b.addEventListener('click', () => none(L.find((l) => l.id === Number(b.dataset.l)))));
    $$('.gh-th', box).forEach((b) => b.addEventListener('click', () => photoBox(d.photos.find((p) => p.id === Number(b.dataset.ph)))));
    $('#gh-send')?.addEventListener('click', send);
  }

  // bước 2: ảnh hoá đơn giao / không có hoá đơn giao
  async function delivShot(file) {
    showSaved('Đang tải ảnh hoá đơn giao…');
    try {
      await uploadFiles(`gh${d.id}`, [file], async (path) => {
        const old = await rpc('app_gh_deliv', { p_id: d.id, p_path: path, p_note: null });
        if (old) sb.storage.from(BUCKET).remove([old]).catch(() => {});
        d.deliv_path = path; d.deliv_note = null;
      });
      showSaved('Đã lưu ảnh hoá đơn giao'); draw(); $('#gh-step3')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { showSaved(e.message, true); }
  }
  function delivNone() {
    const dl = dialog(html`<form class="stack" style="gap:10px;width:min(420px, calc(100vw - 56px))"><h2 style="margin:0">Tài xế không mang hoá đơn giao</h2>
      <div class="st-meta">Vẫn gửi được. Kế toán sẽ phải tải <b>hoá đơn bù</b> thì quản lý mới đối soát xong.</div>
      <label class="field"><span>Ghi chú (bắt buộc)</span><input class="input" name="nt" value="${d.deliv_note || ''}" placeholder="vd: tài xế quên phiếu" autocomplete="off"></label><div class="gh-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (e) => { e.preventDefault(); const nt = f.nt.value.trim();
      if (!nt) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Ghi chú vì sao không có hoá đơn giao.</div>`); return; }
      try { const old = await rpc('app_gh_deliv', { p_id: d.id, p_path: null, p_note: nt }); if (old) sb.storage.from(BUCKET).remove([old]).catch(() => {});
        d.deliv_path = null; d.deliv_note = nt; dl.close(); draw(); }
      catch (er) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${er.message}</div>`); } });
  }

  // bước 1: chọn các món có trong ảnh vừa chụp (+ món ngoài phiếu / món ghi tay khi chưa có phiếu xuất)
  function pick(file) {
    const cov = covered(); const L = d.lines.filter((l) => !cov.has(l.id) && Q[l.id] !== 0);
    const url = URL.createObjectURL(file);
    const box = $('#gh-pick');
    box.innerHTML = str(html`<section class="card stack gh-pickc" style="gap:8px"><img class="gh-prev" src="${url}" alt="Ảnh vừa chụp">
      <datalist id="gh-cat">${cat.map((c) => html`<option value="${c.name}">${c.unit || ''}</option>`)}</datalist>
      ${nh ? html`<b>Món có trong ảnh này</b><span class="st-meta">Gõ vài chữ để chọn tên món từng nhận, ghi số lượng. Ảnh có nhiều món thì bấm "+ Thêm món".</span>
        <div class="gh-nrs">${nrow()}</div><button type="button" class="btn sm secondary gh-nadd" style="align-self:flex-start">+ Thêm món</button>
        ${L.length ? html`<b>Hoặc tick món đã ghi trước (chưa có ảnh)</b>` : ''}`
      : html`<b>Món trong phiếu có trong ảnh này?</b><span class="st-meta">Tick món → số tự điền bằng số phiếu. Đếm khác thì sửa số và ghi chú.</span>`}
      <div>${L.map((l) => html`<div class="gh-sel" data-l="${l.id}"><label class="gh-chk"><input type="checkbox" class="gh-c"><span><b>${l.name}</b><span class="st-meta">${lab} ${q3(base(l))} ${l.unit || ''}</span></span></label>
          <input class="input sm gh-q" inputmode="decimal" autocomplete="off" disabled aria-label="Số thực nhận ${l.name}"></div><div class="gh-note" data-n="${l.id}" hidden><input class="input sm" placeholder="Ghi chú (bắt buộc): vd thiếu 1 bao…" aria-label="Ghi chú ${l.name}"></div>`)}</div>
      ${!nh ? html`<div class="gh-extra"><b>+ Món KHÔNG có trong phiếu</b><span class="st-meta">Kho giao dư món ngoài phiếu thì ghi ở đây (tên + ĐVT + số lượng).</span>
        <div class="gh-nrs"></div><button type="button" class="btn sm secondary gh-nadd" style="align-self:flex-start">+ Thêm món ngoài phiếu</button></div>` : ''}
      <div class="gh-max st-meta" hidden>Mỗi ảnh tối đa ${MAX_PER_PHOTO} món — chụp ảnh khác cho các món còn lại.</div>
      <div class="gh-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" id="gh-pc">Huỷ ảnh</button><button type="button" class="btn sm gh-ok" id="gh-ps">✓ Lưu ảnh</button></div></section>`);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const freeRows = () => $$('.gh-nr', box).map((r) => { const nm = r.querySelector('.gh-nn').value.trim(); const hit = cat.find((c) => c.name.toLowerCase() === nm.toLowerCase());
      return { code: hit ? hit.code : null, name: nm, unit: r.querySelector('.gh-nu').value.trim(), qty: numOf(r.querySelector('.gh-nq').value) }; }).filter((l) => l.name || l.qty !== null);
    const upd = () => {
      let n = 0;
      $$('.gh-sel', box).forEach((row) => {
        const l = d.lines.find((x) => x.id === Number(row.dataset.l)); const c = row.querySelector('.gh-c'); const qi = row.querySelector('.gh-q'); const nb = box.querySelector(`.gh-note[data-n="${l.id}"]`);
        qi.disabled = !c.checked; if (c.checked && qi.value === '') qi.value = q3(base(l)); if (!c.checked) qi.value = '';
        const diff = !nh && c.checked && numOf(qi.value) !== null && numOf(qi.value) !== base(l);
        qi.classList.toggle('gh-w', diff); nb.hidden = !diff; if (c.checked) n++;
      });
      n += freeRows().length;
      // bước 132: mỗi ảnh tối đa 4 món — đủ thì khoá ô còn lại, ẩn "+ Thêm món"
      const full = n >= MAX_PER_PHOTO;
      $$('.gh-sel .gh-c', box).forEach((c) => { c.disabled = full && !c.checked; c.closest('.gh-sel').classList.toggle('gh-off', c.disabled); });
      $$('.gh-nadd', box).forEach((b) => { b.style.display = full ? 'none' : ''; });
      box.querySelector('.gh-max').hidden = !full;
      $('#gh-ps').textContent = n ? `✓ Lưu ảnh · ${n}/${MAX_PER_PHOTO} món` : '✓ Lưu ảnh';
    };
    $$('.gh-nadd', box).forEach((b) => b.addEventListener('click', () => { b.previousElementSibling.insertAdjacentHTML('beforeend', str(nrow())); b.previousElementSibling.lastElementChild.querySelector('input')?.focus(); upd(); }));
    box.addEventListener('change', (e) => { if (e.target.classList.contains('gh-nn')) { const hit = cat.find((c) => c.name.toLowerCase() === e.target.value.trim().toLowerCase()); const u = e.target.closest('.gh-nr').querySelector('.gh-nu'); if (hit && !u.value) u.value = hit.unit || ''; } });
    box.addEventListener('change', upd); box.addEventListener('input', upd);
    $('#gh-pc').addEventListener('click', () => { box.innerHTML = ''; URL.revokeObjectURL(url); });
    $('#gh-ps').addEventListener('click', async (ev) => {
      const picked = $$('.gh-sel', box).filter((row) => row.querySelector('.gh-c').checked).map((row) => {
        const l = d.lines.find((x) => x.id === Number(row.dataset.l)); const qv = numOf(row.querySelector('.gh-q').value); const nt = box.querySelector(`.gh-note[data-n="${l.id}"] input`).value.trim();
        return { l, qv, nt };
      });
      const err = (m) => { box.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${m}</div>`); };
      const free = freeRows();
      if (!picked.length && !free.length) { err(nh ? 'Ghi ít nhất 1 món có trong ảnh (tên + số lượng).' : 'Tick ít nhất 1 món có trong ảnh (hoặc ghi món ngoài phiếu).'); return; }
      if (free.some((l) => !l.name || !(l.qty > 0))) { err('Mỗi món cần tên và số lượng lớn hơn 0.'); return; }
      if (picked.length + free.length > MAX_PER_PHOTO) { err(`Mỗi ảnh tối đa ${MAX_PER_PHOTO} món — chụp ảnh khác cho các món còn lại.`); return; }
      const bad = picked.find((x) => x.qv === null || x.qv < 0); if (bad) { err(`Nhập số thực nhận cho ${bad.l.name}.`); return; }
      const zero = picked.find((x) => x.qv === 0); if (zero) { err(`${zero.l.name}: số 0 thì không chọn trong ảnh — bấm "Không nhận được".`); return; }
      const noN = picked.find((x) => !nh && x.qv !== base(x.l) && !x.nt); if (noN) { err(`Ghi chú cho ${noN.l.name} (số khác phiếu).`); return; }
      ev.target.disabled = true; ev.target.textContent = 'Đang tải ảnh…';
      try {
        let newIds = [];
        if (free.length && nh) {   // chưa có phiếu xuất: lưu món mới trước (tạo phiếu ở ảnh đầu) để có mã món gắn vào ảnh
          const before = new Set(d.lines.map((l) => l.id)); const pl = payload();
          picked.forEach((x) => { const y = pl.find((z) => z.id === x.l.id); if (y) y.qty = x.qv; });
          const nid = await rpc('app_gh_receipt_save', { p_id: d.id, p_branch: d.branch_id, p_lines: [...pl, ...free], p_note: d.receive_note || null });
          if (!d.id) { d.id = nid; try { history.replaceState(null, '', qs(NHAN, { nhan: nid })); } catch (_) { /* bỏ qua */ } }
          const fresh = await refetch();
          d.lines = fresh.lines; newIds = fresh.lines.filter((l) => !before.has(l.id)).map((l) => l.id);
        } else if (free.length) {   // có phiếu xuất: món ngoài phiếu
          newIds = ((await rpc('app_gh_extra_add', { p_id: d.id, p_lines: free })) || []).map(Number);
          d.lines = (await refetch()).lines;
        }
        d.lines.forEach((l) => { if (newIds.includes(l.id)) { Q[l.id] = Number(l.qty_received); N[l.id] = ''; } });
        const ids = [...picked.map((x) => x.l.id), ...newIds];
        await uploadFiles(`gh${d.id}`, [file], async (path) => {
          const pid = await rpc('app_gh_photo_add', { p_id: d.id, p_path: path, p_lines: ids });
          d.photos.push({ id: pid, path, lines: ids });
        });
        picked.forEach((x) => { Q[x.l.id] = x.qv; N[x.l.id] = x.nt; }); save();
        URL.revokeObjectURL(url); showSaved(`Đã lưu ảnh ${d.photos.length} · ${ids.length} món`); draw();
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
    const dl = dialog(html`<form class="stack" style="gap:8px;width:min(460px, calc(100vw - 40px))"><a target="_blank" rel="noopener"><img class="gh-prev" data-path="${p.path}" alt="Ảnh đã chụp"></a>
      <b>Các món trong ảnh</b>${L.map((l) => html`<div class="gh-sel" data-l="${l.id}"><span class="grow"><b>${l.name}</b><span class="st-meta">${isEx(l) ? 'ngoài phiếu' : `${lab} ${q3(base(l))}`} ${l.unit || ''}</span></span><input class="input sm gh-q" inputmode="decimal" value="${q3(Q[l.id])}" aria-label="Số thực nhận ${l.name}"></div>
        <div class="gh-note" data-n="${l.id}" ${nh || isEx(l) ? 'hidden' : ''}><input class="input sm" value="${N[l.id] || ''}" placeholder="Ghi chú khi số khác phiếu"></div>`)}
      <div class="gh-err"></div>
      <div class="toolbar" style="justify-content:space-between"><button type="button" class="btn sm secondary danger" id="gh-pdel">Xoá ảnh</button><span><button type="button" class="btn sm secondary" data-x>Đóng</button> <button class="btn sm" type="submit">Lưu</button></span></div></form>`);
    signLinks(dl);
    const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', (e) => { e.preventDefault();
      for (const l of L) { const qv = numOf(f.querySelector(`.gh-sel[data-l="${l.id}"] .gh-q`).value); const nt = f.querySelector(`.gh-note[data-n="${l.id}"] input`).value.trim();
        if (qv === null || qv <= 0) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${l.name}: nhập số lớn hơn 0 (không có hàng thì xoá ảnh, chọn "Không nhận được").</div>`); return; }
        if (!nh && !isEx(l) && qv !== base(l) && !nt) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Ghi chú cho ${l.name} (số khác phiếu).</div>`); return; }
        Q[l.id] = qv; N[l.id] = nt; }
      save(); dl.close(); draw(); });
    dl.querySelector('#gh-pdel').addEventListener('click', async () => {
      const others = new Set(d.photos.filter((x) => x.id !== p.id).flatMap((x) => x.lines || []));
      const gone = d.lines.filter((l) => (p.lines || []).includes(l.id) && (nh || isEx(l)) && !others.has(l.id));   // món ghi tay chỉ có trong ảnh này → xoá theo ảnh
      const rest = d.lines.filter((l) => !gone.includes(l));
      if (nh && !rest.length) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Phiếu cần ít nhất 1 món — chụp nhóm khác trước rồi mới xoá ảnh này.</div>`); return; }
      if (!confirm(gone.length ? `Xoá ảnh này và ${gone.length} món ghi trong ảnh (${gone.map((l) => l.name).join(', ')})?` : 'Xoá ảnh này? Các món trong ảnh quay lại "chưa nhận".')) return;
      try {
        const path = await rpc('app_gh_photo_del', { p_photo: p.id }); if (path) await sb.storage.from(BUCKET).remove([path]); d.photos = d.photos.filter((x) => x.id !== p.id);
        if (nh) { d.lines = rest; await rpc('app_gh_receipt_save', { p_id: d.id, p_branch: d.branch_id, p_lines: payload(), p_note: d.receive_note || null }); }
        else { for (const l of gone) await rpc('app_gh_extra_del', { p_line: l.id }); d.lines = rest; }
        dl.close(); draw();
      }
      catch (e) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }
  function nrow() { return html`<div class="gh-nr"><input class="input sm gh-nn" list="gh-cat" placeholder="Tên món" aria-label="Tên món"><input class="input sm gh-nu" placeholder="ĐVT" aria-label="Đơn vị"><input class="input sm gh-nq" inputmode="decimal" placeholder="SL" aria-label="Số lượng"></div>`; }
  async function send(ev) {
    const L = d.lines;
    if (L.some((l) => !done(l))) { showSaved('Còn món chưa nhận.', true); return; }
    if (!d.deliv_path && !d.deliv_note) { showSaved('Chụp hoá đơn giao trước khi gửi.', true); return; }
    const notes = L.filter((l) => lech(l) || (Q[l.id] === 0 && N[l.id])).map((l) => (isEx(l) ? `${l.name}: ngoài phiếu, nhận ${q3(Q[l.id])}` : `${l.name}: phiếu ${q3(l.qty_invoice)}, nhận ${q3(Q[l.id])}${N[l.id] ? ' — ' + N[l.id] : ''}`));
    ev.target.disabled = true;
    try {
      const r = nh
        ? (await rpc('app_gh_receipt_save', { p_id: d.id, p_branch: d.branch_id, p_lines: payload(), p_note: ($('#gh-anote')?.value ?? d.receive_note ?? '').trim() || null }), { mismatch: 0, nohd: true })
        : await rpc('app_gh_receive', { p_id: d.id, p_lines: L.map((l) => ({ id: l.id, qty: Q[l.id] })), p_note: notes.join('; ') });
      draftDel(d.id || id);
      flash(r.nohd ? 'Đã lưu phiếu nhận hàng — chờ kế toán ghép phiếu xuất.' : r.mismatch ? `Đã gửi báo nhận — ${r.mismatch} món khác phiếu, đã báo quản lý.` : 'Đã gửi báo nhận — nhận đủ hàng giống hoá đơn.', r.mismatch ? 'warn' : 'ok');
      location.hash = back;
    } catch (e) { ev.target.disabled = false; showSaved(e.message, true); }
  }
}

// ---------------------------------------------------------------- Đối soát: danh sách (bước 106) — tất cả cơ sở, cũ nhất trước; Chờ đối soát · Chưa nhận · Đã xong
async function listPage(params, can) {
  const today = vnToday();
  const tab = ['cho', 'dang', 'xong'].includes(params.tt) ? params.tt : 'cho';
  // bước 167: lọc theo loại ngày + khoảng ngày (thay nút chuyển tháng). Loại không áp dụng thì ẩn: Chưa nhận chỉ có ngày giao.
  // Anh Tiến chốt 20/11: tab Chờ đối soát LUÔN hiện tất cả (không lọc ngày, không có thanh lọc), cũ nhất lên trước theo ngày nhận.
  const KOF = { cho: ['giao', 'nhan'], dang: ['giao'], xong: ['giao', 'nhan', 'ds'] };
  const L = locRemember('ds', { params, kinds: KOF.xong, kindsShown: KOF[tab], today });
  const Lof = (t) => ({ ...L, kind: KOF[t].includes(L.wantKind) ? L.wantKind : KOF[t][0] });
  const G = await rpc('app_gh_inbox', { p_branch: null });
  const cat = await catalog().catch(() => ({ activeBranches: [] }));
  const brs = (cat.activeBranches || []).map((b) => ({ id: b.id, code: b.display_code || b.code }));
  const br = brs.some((b) => String(b.id) === String(params.cn)) ? Number(params.cn) : null;   // null = tất cả cơ sở
  const q = (o) => qs(DS, { cn: br ?? '', tt: tab, ...locQuery(L), ...o });
  // bước 174: khoảng ngày quá 400 ngày (mục có thanh lọc) → không lọc / không gọi máy chủ, hiện thanh lọc để chọn lại. Chờ đối soát không lọc ngày nên vẫn hiện bình thường.
  if (L.tooLong && tab !== 'cho') return { title: 'Đối soát hàng', html: html`${GH_CSS}${LOC_CSS}<div class="gh-wrap gh-wide"><div class="page-head"><div><h1>Đối soát hàng kho tổng</h1></div></div>
      <nav class="gh-tabs" aria-label="Lọc"><a href="${q({ tt: 'cho' })}">✔ Chờ đối soát</a><a class="${tab === 'dang' ? 'on' : ''}" href="${q({ tt: 'dang' })}">🚚 Chưa nhận</a><a class="${tab === 'xong' ? 'on' : ''}" href="${q({ tt: 'xong' })}">✓ Đã xong</a></nav>
      ${locTooLong(L, KOF[tab], (o) => q(locQuery(o)))}</div>`,
    mount() { wireLoc($('.gh-wrap'), L, (o) => q(locQuery(o))); } };
  const open = (G.rows || []).filter((d) => br === null || d.branch_id === br);
  const choAll = open.filter((d) => d.state !== 'dang_chuyen'); const dangAll = open.filter((d) => d.state === 'dang_chuyen');
  const cho = sortLoc(choAll, 'nhan', true);   // Chờ đối soát: tất cả, cũ nhất lên trước
  const dang = sortLoc(dangAll.filter((d) => inLoc(d, Lof('dang'))), 'giao');
  let xong = [];
  if (tab === 'xong') {
    const Dm = await rpc('app_nh_list', { p_month: null, p_branch: br, p_from: L.from, p_to: L.to, p_kind: L.kind });
    xong = sortLoc((Dm.rows || []).filter((d) => d.recon_at && inLoc(d, L)), L.kind);
  }
  const hidden = tab === 'dang' ? dangAll.filter((d) => !dang.includes(d)) : [];
  const cover = hidden.length ? coverRange(hidden, L) : null;
  const nCho = (id) => (G.rows || []).filter((d) => (id === null || d.branch_id === id) && d.state !== 'dang_chuyen').length;
  const days = (d) => (d.received_date ? Math.round((Date.parse(today) - Date.parse(d.received_date)) / 864e5) : 0);
  const thumbs = (d) => html`<div class="ql-th">${(d.photos || []).slice(0, 3).map((p) => html`<img data-path="${p.path}" alt="">`)}</div>`;
  const cnts = (d) => { const doc = !!d.doc_no; const L = d.lines || [];
    const ex = doc ? L.filter((l) => l.qty_invoice == null && Number(l.qty_received ?? 0) > 0).length : 0;
    const le = doc ? L.filter((l) => l.qty_invoice != null && Number(l.qty_received ?? 0) !== Number(l.qty_invoice)).length : 0;
    return doc ? html`<span class="pill ok">${L.length - ex - le} khớp</span>${le ? html`<span class="pill warn">${le} lệch</span>` : ''}${ex ? html`<span class="pill off">${ex} ngoài phiếu</span>` : ''}`
      : html`<span class="pill info">${L.length} món NV ghi · chưa có phiếu xuất</span>`; };
  const docTag = (d) => (d.deliv_path ? html`<span class="pill ok">📄 có HĐ giao</span>` : d.bu_path ? html`<span class="pill ok">📄 có hoá đơn bù</span>`
    : d.state === 'dang_chuyen' ? '' : html`<span class="pill off">📄 thiếu HĐ giao — chờ hoá đơn bù</span>`);
  const card = (d) => html`<div class="card ql-card">${thumbs(d)}<div class="grow"><b class="ql-t">${d.branch_code} · ${d.doc_no || 'Chưa có phiếu xuất'}</b>
      <span class="st-meta"> · nhận ${d.received_at ? `${dmy(String(d.received_at).slice(0, 10)).slice(0, 5)} ${String(d.received_at).slice(11, 16)}` : ''}${d.received_by ? ` · ${d.received_by}` : ''}</span>
      <div class="ql-p">${cnts(d)}${docTag(d)}${d.n_unchecked < d.n_lines ? html`<span class="pill mute">đã soát ${d.n_lines - d.n_unchecked}/${d.n_lines}</span>` : ''}</div></div>
      <span class="ql-r">${days(d) > 0 ? html`<span class="${days(d) >= 1 ? 'neg' : ''}">chờ ${days(d)} ngày</span>` : html`<span class="st-meta">hôm nay</span>`}
        <a class="btn sm" href="${qs(DS, { [can('doi_soat') ? 'ds' : 'xem']: d.id })}">${can('doi_soat') ? 'ĐỐI SOÁT ›' : 'Xem ›'}</a></span></div>`;
  const dcard = (d) => html`<div class="card ql-card"><div class="grow"><b class="ql-t">${d.branch_code} · ${d.doc_no || ''}</b><span class="st-meta"> · ${d.n_lines} món${d.ship_at ? ` · kho xuất ${String(d.ship_at).slice(11, 16)} ${dmy(String(d.ship_at).slice(0, 10)).slice(0, 5)}` : ''}</span>
      <div class="ql-p">${d.work_date < today ? html`<span class="pill off">quá ngày giao ${dmy(d.work_date).slice(0, 5)} — chưa nhận</span>` : html`<span class="pill info">đang chuyển</span>`}</div></div>
      ${G.can_recv ? html`<a class="btn sm secondary" href="${qs(NHAN, { nhan: d.id })}">Nhận hàng ›</a>` : ''}</div>`;
  const xcard = (d) => html`<div class="card ql-card ql-done"><div class="grow"><b class="ql-t">✓ ${d.branch_code} · ${d.doc_no || 'Chưa có phiếu xuất'}</b>
      <span class="st-meta"> · xong ${dmy(String(d.recon_at).slice(0, 10)).slice(0, 5)}${d.recon_by ? ` · ${d.recon_by}` : ''}</span>
      <div class="st-meta">${d.n_mismatch ? `${d.n_mismatch} món lệch đã sang Kiểm soát${d.n_fu_done ? ' · kế toán đã xử lý' : ' · kế toán chưa xử lý'}` : 'Nhận đủ, không lệch'}</div></div>
      <span class="ql-r"><a class="btn sm secondary" href="${qs(DS, { xem: d.id })}">Xem</a>${can('doi_soat') ? (d.n_fu_done ? html`<button type="button" class="btn sm secondary" disabled title="Kế toán đã xử lý — kế toán Hoàn tác ở Kiểm soát trước">Mở lại</button>`
        : html`<button type="button" class="btn sm secondary ql-reopen" data-id="${d.id}">Mở lại đối soát</button>`) : ''}</span></div>`;
  const list = tab === 'cho' ? cho : tab === 'dang' ? dang : xong;
  return {
    title: 'Đối soát hàng',
    html: html`${GH_CSS}${LOC_CSS}<div class="gh-wrap gh-wide"><div class="page-head"><div><h1>Đối soát hàng kho tổng</h1><div class="sub">Lần giao nhân viên đã nhận — món lệch xem trước, món khớp theo từng ảnh, rồi Xác nhận xong. Chờ đối soát: cũ nhất lên trước.</div></div></div>
      <section class="card stack" style="gap:8px;padding:12px 14px"><nav class="branch-tabs" aria-label="Cơ sở"><a class="${br === null ? 'on' : ''}" href="${q({ cn: 'all' })}">Tất cả${nCho(null) ? html` <span class="badge">${nCho(null)}</span>` : ''}</a>${brs.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${q({ cn: b.id })}">${b.code}${nCho(b.id) ? html` <span class="badge">${nCho(b.id)}</span>` : ''}</a>`)}</nav>
        <nav class="gh-tabs" aria-label="Lọc"><a class="${tab === 'cho' ? 'on' : ''}" href="${q({ tt: 'cho' })}">✔ Chờ đối soát <b>${cho.length}</b></a><a class="${tab === 'dang' ? 'on' : ''}" href="${q({ tt: 'dang' })}">🚚 Chưa nhận <b>${dang.length}</b></a><a class="${tab === 'xong' ? 'on' : ''}" href="${q({ tt: 'xong' })}">✓ Đã xong</a></nav>
        ${tab === 'cho' ? html`<div class="st-meta" id="gh-all">Chờ đối soát luôn hiện <b>tất cả</b> lần giao chưa đối soát — cũ nhất lên trước.</div>` : locBar(L, KOF[tab], (o) => q(locQuery(o)))}</section>
      ${hidden.length ? html`<div class="card loc-more" id="gh-hidden"><span>Còn <b>${hidden.length}</b> lần giao chưa nhận ngoài khoảng ngày đang lọc.</span>${cover ? html`<a class="btn sm secondary" href="${q(locQuery(cover))}">Hiện cả</a>` : ''}</div>` : ''}
      ${list.length ? list.map(tab === 'cho' ? card : tab === 'dang' ? dcard : xcard) : html`<div class="card st-meta">${tab === 'cho' ? 'Không có lần giao nào chờ đối soát.' : tab === 'dang' ? `Không có phiếu xuất nào đang chuyển${hidden.length ? ' trong khoảng ngày này' : ''}.` : `Chưa có lần giao nào đối soát xong (${KINDS[L.kind].toLowerCase()} ${locLabel(L)}).`}</div>`}</div>`,
    mount() {
      signLinks($('.gh-wrap'));
      wireLoc($('.gh-wrap'), L, (o) => q(locQuery(o)));
      $$('.ql-reopen').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Mở lại đối soát lần giao này? Các món lệch đang chờ ở Kiểm soát sẽ gỡ ra cho tới khi xác nhận xong lại.')) return;
        b.disabled = true;
        try { await rpc('app_gh_recon_reopen', { p_id: Number(b.dataset.id) }); flash('Đã mở lại đối soát.'); location.hash = qs(DS, { ds: b.dataset.id }); }
        catch (e) { b.disabled = false; showSaved(e.message, true); }
      }));
    },
  };
}

// ---------------------------------------------------------------- Đối soát 1 lần giao (bước 106): ① món lệch + ngoài phiếu xem trước · ② món khớp theo ảnh · ③ Xác nhận xong
async function reconPage(id, editable0, can) {
  let d = null;
  const find = async () => {
    const G = await rpc('app_gh_inbox', { p_branch: null }).catch(() => null);
    const x0 = G && (G.rows || []).find((r) => r.id === id); if (x0) return x0;
    let m = vnToday().slice(0, 7);
    for (let k = 0; k < 3; k++) {
      const D = await rpc('app_nh_list', { p_month: m, p_branch: null }).catch(() => null);
      const x = D && [...(D.rows || []), ...(D.open || [])].find((r) => r.id === id); if (x) return x;
      m = addDays(m + '-01', -1).slice(0, 7);
    }
    return null;
  };
  d = await find();
  if (!d) return { title: 'Đối soát hàng', html: html`${GH_CSS}<div class="gh-wrap"><div class="page-head"><h1>Đối soát hàng</h1></div><div class="alert warn">Không tìm thấy lần giao này. <a href="${DS}">‹ Về Đối soát hàng</a></div></div>` };
  let editable = editable0;
  return { title: 'Đối soát hàng', html: html`${GH_CSS}<div class="gh-wrap gh-wide" id="gh-ds"></div>`, mount() { draw(); } };

  function draw() {
    const box = $('#gh-ds'); if (!box) return;
    const L = d.lines; const byId = new Map(L.map((l) => [l.id, l])); const doc = !!d.doc_no;
    const can2 = editable && !d.recon_at && d.state !== 'dang_chuyen';
    const qOf = (l) => Number(l.qty_checked ?? l.qty_received ?? 0);
    const isEx = (l) => doc && (l.qty_invoice === null || l.qty_invoice === undefined);
    const isLech = (l) => doc && (isEx(l) ? Number(l.qty_received ?? 0) > 0 || qOf(l) > 0 : Number(l.qty_received ?? 0) !== Number(l.qty_invoice) || qOf(l) !== Number(l.qty_invoice));
    const S1 = L.filter(isLech); const S2 = L.filter((l) => !isLech(l));
    const photoOf = (l) => d.photos.find((p) => (p.lines || []).includes(l.id));
    const nvNote = (l) => { const seg = String(d.receive_note || '').split('; ').find((s) => s.startsWith(l.name + ':')); return seg && seg.includes(' — ') ? seg.split(' — ').slice(1).join(' — ') : ''; };
    const diff = (l) => { const qv = qOf(l); if (isEx(l)) return html`<b class="ds-x">ngoài phiếu</b>`; const inv = Number(l.qty_invoice);
      return qv === inv ? html`<b class="ds-ok">khớp</b>` : qv === 0 ? html`<b class="ds-w">không nhận</b>` : qv < inv ? html`<b class="ds-w">thiếu ${q3(inv - qv)}</b>` : html`<b class="ds-i">thừa ${q3(qv - inv)}</b>`; };
    const nUn = L.filter((l) => !l.checked_at).length;
    const ok1 = S1.every((l) => l.checked_at); const ok2 = S2.every((l) => l.checked_at);
    const act = (l, big) => (l.checked_at ? html`<span class="pill ok">✓ ${l.qty_checked != null && Number(l.qty_checked) !== Number(l.qty_received) ? `QL sửa ${q3(l.qty_checked)}` : 'đúng'}</span>${can2 ? html`<button type="button" class="btn sm secondary gh-un">Bỏ</button>` : ''}`
      : can2 ? html`${big ? html`<button type="button" class="btn sm gh-ok gh-one">✓ Đúng như NV</button>` : ''}<button type="button" class="btn sm secondary gh-fix">${big ? 'Sửa số…' : 'Sai số…'}</button>` : html`<span class="pill mute">chưa soát</span>`);
    const thumb = (l) => { const p = photoOf(l); return p ? html`<a target="_blank" rel="noopener" class="ds-thumb"><img data-path="${p.path}" alt="Ảnh ${l.name}"></a>` : html`<span class="ds-thumb ds-noph">không có ảnh</span>`; };
    const bu = doc ? L.filter((l) => !isEx(l) && qOf(l) < Number(l.qty_invoice)) : []; const bs = doc ? L.filter((l) => isEx(l) ? qOf(l) > 0 : qOf(l) > Number(l.qty_invoice)) : [];
    const amt = (l) => (isEx(l) ? `${q3(qOf(l))} ${l.unit || ''}` : `${q3(Math.abs(qOf(l) - Number(l.qty_invoice)))} ${l.unit || ''}`).trim();
    const photos = d.photos.map((p, i) => ({ p, i, ls: (p.lines || []).map((x) => byId.get(x)).filter((l) => l && !isLech(l)) })).filter((x) => x.ls.length);
    const noPh = S2.filter((l) => !photoOf(l));
    box.innerHTML = str(html`<div class="page-head"><div><a href="${qs(DS, { cn: d.branch_id })}" class="st-meta">‹ Đối soát hàng</a><h1>${can2 ? 'Đối soát' : 'Lần giao'} · ${d.doc_no || 'chưa có phiếu xuất'}</h1>
        <div class="sub">${d.branch_code}${d.received_at ? ` · nhận ${dmy(String(d.received_at).slice(0, 10)).slice(0, 5)} ${String(d.received_at).slice(11, 16)}` : ''}${d.received_by ? ` · ${d.received_by}` : ''} · ${L.length} món · ${d.photos.length} ảnh</div></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
      ${d.recon_at ? html`<div class="alert ok" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="grow"><b>✓ Đã xác nhận đối soát xong</b> · ${d.recon_by || ''} ${dmy(String(d.recon_at).slice(0, 10)).slice(0, 5)}${d.n_mismatch ? ` · món lệch đã sang Kiểm soát${d.n_fu_done ? ' (kế toán đã xử lý)' : ''}` : ''}</span>
          ${can('doi_soat') ? (d.n_fu_done ? html`<span class="st-meta">Kế toán đã xử lý — muốn mở lại thì kế toán Hoàn tác ở Kiểm soát trước.</span>` : html`<button type="button" class="btn sm secondary" id="gh-reopen">Mở lại đối soát</button>`) : ''}</div>` : ''}
      ${d.state === 'dang_chuyen' ? html`<div class="alert warn" style="margin:0">Nhân viên chưa báo nhận hàng này.</div>` : ''}
      <nav class="gh-steps"><span class="${ok1 ? 'ok' : 'on'}">1. Món lệch &amp; ngoài phiếu (${S1.length})${ok1 ? ' ✓' : ''}</span><span class="${ok2 ? 'ok' : ok1 ? 'on' : ''}">2. Món khớp theo ảnh (${S2.length})${ok2 ? ' ✓' : ''}</span><span class="${d.recon_at ? 'ok' : ok1 && ok2 ? 'on' : ''}">3. Xác nhận xong${d.recon_at ? ' ✓' : ''}</span></nav>
      <section class="card ds-top"><div class="ds-doc"><b>📄 Hoá đơn giao</b>
          ${d.deliv_path ? html`<a target="_blank" rel="noopener"><img class="gh-prev" data-path="${d.deliv_path}" alt="Ảnh hoá đơn giao"></a><span class="st-meta">bấm để phóng to</span>`
            : html`<div class="ds-lock">Nhân viên: tài xế không mang hoá đơn giao${d.deliv_note ? ` — ${d.deliv_note}` : ''}.</div>`}
          ${d.bu_path ? html`<a class="btn sm secondary" target="_blank" rel="noopener" data-path="${d.bu_path}">📎 Hoá đơn bù: ${d.bu_name || 'tệp'}</a>` : !d.deliv_path ? html`<span class="pill off">Chờ kế toán tải hoá đơn bù</span>` : ''}</div>
        <div class="ds-main"><div><b>NV xác nhận:</b> ${S1.length ? html`<span class="pill warn">Số thực nhận khác hoá đơn</span>` : html`<span class="pill ok">Đã nhận đủ giống hoá đơn</span>`}
            ${!doc ? html`<span class="pill info">chưa có phiếu xuất trên web</span>` : ''}</div>
          ${S1.length ? html`<div class="st-meta">${S1.map((l) => `${l.name} ${isEx(l) ? 'ngoài phiếu ' + q3(l.qty_received) : Number(l.qty_received) === 0 ? 'không nhận' : Number(l.qty_received) < Number(l.qty_invoice) ? 'thiếu ' + q3(Number(l.qty_invoice) - Number(l.qty_received)) : 'thừa ' + q3(Number(l.qty_received) - Number(l.qty_invoice))} ${l.unit || ''}`).join(' · ')}</div>` : ''}
          ${d.receive_note && !S1.length ? html`<div class="ds-nt">Ghi chú NV: ${d.receive_note}</div>` : ''}
          ${S1.length ? html`<h3 class="ds-h">⚠ Món lệch &amp; ngoài phiếu — xem trước</h3>${S1.map((l) => html`<div class="ds-lech ${isEx(l) ? 'ex' : ''} ${l.checked_at ? 'done' : ''}" data-l="${l.id}">${thumb(l)}
              <div class="grow"><b>${l.name}</b>${isEx(l) ? html` <span class="pill off">ngoài phiếu</span>` : ''}
                <div class="ds-cmp"><span>Phiếu</span><span>NV đếm</span><span>${l.qty_checked != null && Number(l.qty_checked) !== Number(l.qty_received) ? 'QL sửa' : 'Lệch'}</span>
                  <b>${isEx(l) ? '—' : `${q3(l.qty_invoice)} ${l.unit || ''}`}</b><b>${q3(l.qty_received)} ${l.unit || ''}</b><span>${l.qty_checked != null && Number(l.qty_checked) !== Number(l.qty_received) ? html`<b>${q3(l.qty_checked)}</b> · ` : ''}${diff(l)}</span></div>
                ${nvNote(l) ? html`<div class="ds-nt">NV: ${nvNote(l)}</div>` : ''}${l.check_note ? html`<div class="ds-nt">QL: ${l.check_note}</div>` : ''}</div>
              <span class="ds-act">${act(l, true)}</span></div>`)}` : ''}</div></section>
      ${S2.length ? html`<section class="card stack" style="gap:10px"><h3 class="ds-h">✓ Món khớp — theo từng ảnh</h3>
        ${photos.map(({ p, i, ls }) => { const open = ls.filter((l) => !l.checked_at); return html`<div class="ds-split" data-ph="${p.id}"><a target="_blank" rel="noopener"><img class="gh-prev" data-path="${p.path}" alt="Ảnh ${i + 1}"></a>
          <div><div class="gh-ch"><b>Ảnh ${i + 1} <span class="st-meta">· ${ls.length} món khớp</span></b>${can2 && open.length ? html`<button type="button" class="btn sm gh-ok gh-all">✓ Đúng cả ảnh (${open.length} món)</button>` : ''}</div>
            ${ls.map((l) => html`<div class="gh-dl ${l.checked_at ? 'done' : ''}" data-l="${l.id}"><div class="grow">${l.name}<span class="st-meta">${doc ? `phiếu ${q3(l.qty_invoice)} · ` : ''}NV ${q3(l.qty_received)} ${l.unit || ''}</span></div><span class="gh-act">${act(l, false)}</span></div>`)}</div></div>`; })}
        ${noPh.length ? html`<div><b>Món không có ảnh</b>${noPh.map((l) => html`<div class="gh-dl ${l.checked_at ? 'done' : ''}" data-l="${l.id}"><div class="grow">${l.name}<span class="st-meta">NV ${q3(l.qty_received)} ${l.unit || ''}</span></div><span class="gh-act">${act(l, true)}</span></div>`)}</div>` : ''}</section>` : ''}
      ${!d.recon_at && d.state !== 'dang_chuyen' ? html`<section class="ds-sum"><b>3. Xác nhận đối soát xong</b>
          ${nUn ? html`<div class="st-meta2">Còn ${nUn} món chưa đối soát.</div>` : ''}
          ${!d.has_doc ? html`<div class="ds-lock">🔒 Chờ kế toán tải <b>hoá đơn bù</b> (nhân viên không có hoá đơn giao) — vẫn đối soát từng món được, chưa xác nhận xong được.</div>` : ''}
          ${doc ? html`<div class="st-meta2">${bu.length ? html`→ Chờ giao bù: ${bu.map((l) => `${l.name} ${amt(l)}`).join(', ')}<br>` : ''}${bs.length ? html`→ Chờ hoá đơn bổ sung: ${bs.map((l) => `${l.name} ${amt(l)}${isEx(l) ? ' (ngoài phiếu)' : ''}`).join(', ')}` : ''}${!bu.length && !bs.length ? 'Nhận đủ — không có món chuyển sang Kiểm soát.' : ''}</div>`
            : html`<div class="st-meta2">Chưa có phiếu xuất trên web — món lệch sẽ tự sang Kiểm soát khi kế toán ghép phiếu xuất.</div>`}
          ${can2 ? html`<button type="button" class="btn gh-ok" id="gh-done" ${nUn || !d.has_doc ? 'disabled' : ''}>XÁC NHẬN XONG · sang lần giao tiếp ›</button>` : ''}</section>` : ''}`);
    signLinks(box);
    const busy = async (b, fn) => { b.disabled = true; try { await fn(); } catch (e) { showSaved(e.message, true); } b.disabled = false; };
    const setL = (lid, res) => { const l = byId.get(lid); l.qty_checked = res.qty; l.checked_at = new Date().toISOString(); };
    const lidOf = (b) => Number(b.closest('[data-l]').dataset.l);
    $$('.gh-one', box).forEach((b) => b.addEventListener('click', () => busy(b, async () => { const lid = lidOf(b); setL(lid, await rpc('app_nh_check', { p_line: lid, p_qty: null, p_note: null })); draw(); })));
    $$('.gh-all', box).forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      const p = d.photos.find((x) => x.id === Number(b.closest('[data-ph]').dataset.ph));
      for (const lid of (p.lines || [])) { const l = byId.get(lid); if (l && !l.checked_at && !isLech(l)) setL(lid, await rpc('app_nh_check', { p_line: lid, p_qty: null, p_note: null })); }
      showSaved('Đã đối soát cả ảnh'); draw();
    })));
    $$('.gh-un', box).forEach((b) => b.addEventListener('click', () => busy(b, async () => { const lid = lidOf(b); await rpc('app_nh_uncheck', { p_line: lid }); const l = byId.get(lid); l.checked_at = null; l.qty_checked = null; l.check_note = null; draw(); })));
    $$('.gh-fix', box).forEach((b) => b.addEventListener('click', () => {
      const l = byId.get(lidOf(b));
      const dl = dialog(html`<form class="stack" style="gap:10px;width:min(420px, calc(100vw - 56px))"><h2 style="margin:0">Sửa số lượng</h2>
        <div><b>${l.name}</b> · ${isEx(l) ? 'ngoài phiếu' : `phiếu ${q3(l.qty_invoice)}`} · NV đếm ${q3(l.qty_received)} ${l.unit || ''}</div>
        <label class="field"><span>Số đúng (quản lý đếm)</span><input class="input" name="q" inputmode="decimal" autocomplete="off"></label>
        <label class="field"><span>Ghi chú (bắt buộc)</span><input class="input" name="nt" autocomplete="off" placeholder="vd: đếm lại thấy 5 bao"></label><div class="gh-err"></div>
        <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu số đúng</button></div></form>`);
      const f = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
      f.addEventListener('submit', async (e) => { e.preventDefault(); const qv = numOf(f.q.value);
        if (qv === null || qv < 0) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">Nhập số đúng.</div>`); return; }
        try { const res = await rpc('app_nh_check', { p_line: l.id, p_qty: qv, p_note: f.nt.value }); setL(l.id, res); l.check_note = f.nt.value.trim() || null; dl.close(); draw(); }
        catch (er) { dl.querySelector('.gh-err').innerHTML = str(html`<div class="alert error">${er.message}</div>`); } });
    }));
    $('#gh-done')?.addEventListener('click', (ev) => busy(ev.target, async () => {
      const r = await rpc('app_gh_recon_done', { p_id: d.id });
      const G = await rpc('app_gh_inbox', { p_branch: null }).catch(() => ({ rows: [] }));
      const nx = (G.rows || []).filter((x) => x.state !== 'dang_chuyen' && x.id !== d.id).sort((a, b) => String(a.received_at || '').localeCompare(String(b.received_at || '')))[0];
      flash(`Đã xác nhận đối soát xong ${d.doc_no || ''}${r.bu || r.hd_bs ? ` — ${r.bu ? r.bu + ' món chờ giao bù' : ''}${r.bu && r.hd_bs ? ', ' : ''}${r.hd_bs ? r.hd_bs + ' món chờ hoá đơn bổ sung' : ''}` : ''}.${nx ? ' Sang lần giao tiếp theo.' : ''}`);
      location.hash = nx ? qs(DS, { ds: nx.id }) : DS;
    }));
    $('#gh-reopen')?.addEventListener('click', (ev) => busy(ev.target, async () => {
      if (!confirm('Mở lại đối soát lần giao này? Các món lệch đang chờ ở Kiểm soát sẽ gỡ ra cho tới khi xác nhận xong lại.')) return;
      await rpc('app_gh_recon_reopen', { p_id: d.id }); d.recon_at = null; d.recon_by = null; editable = can('doi_soat');
      try { history.replaceState(null, '', qs(DS, { ds: d.id })); } catch (_) { /* bỏ qua */ }
      showSaved('Đã mở lại đối soát'); draw();
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
  .gh-sel.gh-off { opacity: .45; } .gh-max { color: var(--warn-ink, #78350f); background: var(--warn-bg, #fef3c7); border-radius: 8px; padding: 6px 10px; }
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
  .gh-steps { display: flex; gap: 5px; } .gh-steps span { flex: 1; text-align: center; font-size: 12px; font-weight: 800; padding: 7px 4px; border-radius: 9px; background: var(--card); border: 1px solid var(--line); color: var(--ink-2); }
  .gh-steps span.on { background: var(--primary); color: #fff; border-color: var(--primary); } .gh-steps span.ok { background: var(--ok-bg); color: var(--ok-ink); border-color: #b7d8ab; }
  .gh-cam2 { background: #3a2f22; } .gh-more { display: block; text-align: center; font-size: 13px; color: var(--ok-ink); background: var(--ok-bg); border-radius: 10px; padding: 9px; cursor: pointer; }
  .gh-inv { display: block; position: relative; } .gh-inv span { position: absolute; right: 6px; bottom: 6px; background: rgba(0,0,0,.6); color: #fff; font-size: 11px; border-radius: 5px; padding: 1px 6px; }
  .gh-cmp { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 14px; } .gh-cmp .grow { min-width: 0; overflow-wrap: anywhere; } .gh-cmp b { white-space: nowrap; }
  .gh-warnbox { background: #fff7e6; border: 2px solid #e9b44c; border-radius: 12px; padding: 10px 12px; font-size: 14px; } .gh-okbox { background: var(--ok-bg); border: 2px solid #b7d8ab; border-radius: 12px; padding: 10px 12px; color: var(--ok-ink); }
  .gh-big { white-space: normal; } .gh-extra { border: 2px dashed var(--primary); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .ql-card { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; } .ql-card .grow { min-width: 0; flex: 1 1 260px; } .ql-t { font-size: 15px; } .ql-p { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
  .ql-th { display: flex; gap: 4px; } .ql-th img { width: 52px; height: 40px; object-fit: cover; border-radius: 6px; background: var(--line-soft); }
  .ql-r { display: flex; gap: 8px; align-items: center; margin-left: auto; font-size: 12.5px; } .ql-r .btn { width: auto; } .ql-r .neg { color: #b91c1c; font-weight: 700; } .ql-done { opacity: .9; }
  .ds-top { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 14px; align-items: start; } .ds-doc { display: flex; flex-direction: column; gap: 6px; } .ds-doc .btn { width: auto; }
  .ds-main { display: flex; flex-direction: column; gap: 8px; min-width: 0; } .ds-h { margin: 6px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: .03em; }
  .ds-lech { display: flex; gap: 10px; align-items: center; border: 2px solid #e9b44c; background: #fffaf0; border-radius: 12px; padding: 9px 10px; } .ds-lech.ex { border-color: #e3a3a3; background: #fff6f5; } .ds-lech.done { opacity: .75; }
  .ds-lech .grow { min-width: 0; flex: 1 1 auto; } .ds-thumb { width: 92px; height: 68px; flex: 0 0 auto; border-radius: 8px; overflow: hidden; background: var(--line-soft); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--muted); }
  .ds-thumb img { width: 100%; height: 100%; object-fit: cover; } .ds-cmp { display: grid; grid-template-columns: repeat(3, auto); justify-content: start; gap: 0 16px; font-size: 12px; color: var(--ink-2); margin: 3px 0; } .ds-cmp b { font-size: 14px; color: var(--ink); }
  .ds-w { color: #b45309 !important; } .ds-i { color: #2c5578 !important; } .ds-x { color: #b91c1c !important; } .ds-ok { color: var(--ok-ink) !important; }
  .ds-nt { background: #fff; border-left: 3px solid #e9b44c; padding: 3px 8px; font-size: 12.5px; border-radius: 4px; margin-top: 3px; }
  .ds-act { display: flex; flex-direction: column; gap: 5px; flex: 0 0 auto; align-items: stretch; } .ds-act .btn { width: auto; }
  .ds-split { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 12px; align-items: start; } .ds-split .gh-prev { max-height: 200px; }
  .ds-sum { background: #1f2622; color: #eef3ef; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; } .st-meta2 { font-size: 13px; color: #c9d4cc; }
  .ds-sum .btn { align-self: flex-start; width: auto; } .ds-sum .btn[disabled] { background: #777 !important; border-color: #777 !important; opacity: .7; }
  .ds-lock { background: #fde2e2; color: #7f1d1d; border-radius: 9px; padding: 7px 10px; font-size: 13px; }
  @media (max-width: 700px) { .ds-top, .ds-split { grid-template-columns: minmax(0, 1fr); } .ds-lech { flex-wrap: wrap; } .ds-act { flex-direction: row; } .ql-r { margin-left: 0; } }
  .gh-nr { display: grid; grid-template-columns: minmax(0, 1fr) 70px 70px; gap: 6px; } .gh-nrs { display: flex; flex-direction: column; gap: 6px; }
</style>`;
