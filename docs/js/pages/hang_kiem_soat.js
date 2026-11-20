// Hàng hoá › Kiểm soát (bước 104, anh Tiến chốt 15/11/2026) — kế toán kho theo dõi sau đối soát:
//  * Chờ giao bù: món nhận THIẾU so với phiếu xuất → kho giao bù ở lần sau (hoá đơn gốc giữ nguyên). Kế toán chỉ ra dòng hàng giao bù
//    trong phiếu xuất sau → dòng đó không tính tiền.
//  * Chờ hoá đơn bổ sung: món nhận THỪA → tính thêm tiền, kế toán lên hoá đơn bổ sung cho kho (ghi số hoá đơn + số tiền).
//  * Tiền tháng: tổng phiếu xuất − hàng giao bù (không tính tiền) + hoá đơn bổ sung = phải trả kho tổng.
import { render as rerender } from '../app.js';
import { catalog, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, fmt } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';
import { uploadFiles } from './ke_toan_hoa_don.js';
import { KINDS, LOC_CSS, coverRange, dateOf, locBar, locLabel, locQuery, locRemember, locTooLong, wireLoc } from '../loc_ngay.js';

export const perm = ['ke_toan', 'doi_soat'];
const LS_BR = 'ckBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const q3 = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));
const numOf = (v) => { const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const money = (n) => (n === null || n === undefined ? '' : `${fmt(n)}đ`);

export async function render({ params }) {
  const today = vnToday();
  // bước 167: lọc loại ngày + khoảng ngày chỉ áp cho DANH SÁCH; tiền tháng vẫn tính cả tháng (tháng của ngày "đến", hoặc ?thang= cũ)
  const KD = ['giao', 'nhan', 'ds'];
  const L = locRemember('ks', { params, kinds: KD, today });
  const month = L.month || L.to.slice(0, 7);
  const cat = await catalog();
  const brs = (cat.activeBranches || []).map((b) => ({ id: b.id, code: b.display_code || b.code }));
  const has = (v) => brs.some((b) => String(b.id) === String(v));
  const br = has(params.cn) ? Number(params.cn) : has(lsGet()) ? lsGet() : brs[0]?.id; if (br) lsSet(br);
  const BR = brs.find((b) => b.id === br) || {};
  const q = (o) => '#/hang-hoa/kiem-soat?' + Object.entries({ cn: br, ...locQuery(L), ...o }).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${v}`).join('&');
  // bước 174: khoảng ngày quá 400 ngày → không gọi máy chủ, hiện thanh lọc để chọn lại
  if (L.tooLong) return { title: 'Kiểm soát hàng hoá', html: html`${KS_CSS}${LOC_CSS}<div class="ks-wrap"><div class="page-head"><div><h1>Kiểm soát hàng hoá</h1></div></div>${locTooLong(L, KD, (o) => q(locQuery(o)))}</div>`,
    mount() { wireLoc($('.ks-wrap'), L, (o) => q(locQuery(o))); } };
  const [All, C] = await Promise.all([rpc('app_gh_control', { p_branch: null, p_month: month }), rpc('app_gh_control', { p_branch: br, p_month: month, p_from: L.from, p_to: L.to, p_kind: L.kind })]);
  const nOpen = (id) => (All.open || []).filter((f) => f.branch_id === id).length + (All.need_bu || []).filter((x) => x.branch_id === id).length;
  // mục chưa có ngày theo loại: thiếu hoá đơn giao (chưa đối soát) khi lọc Ngày đối soát → vẫn hiện; máy chủ cũ chưa trả ngày nhận / đối soát → vẫn hiện
  const inF = (f, na) => { const d = dateOf(f, L.kind); return d == null ? na || (L.kind !== 'giao' && f.received_date === undefined) : d >= L.from && d <= L.to; };
  const nbAll = C.need_bu || []; const nb = nbAll.filter((x) => inF(x, L.kind === 'ds'));
  const openAll = C.open || []; const openF = openAll.filter((f) => inF(f));
  const bu = openF.filter((f) => f.kind === 'bu'); const bs = openF.filter((f) => f.kind === 'hd_bs');
  const hidden = [...nbAll.filter((x) => !nb.includes(x)), ...openAll.filter((f) => !openF.includes(f))];
  const cover = hidden.length ? coverRange(hidden, L) : null;
  const done = (C.done || []).filter((f) => inF(f)); const M = C.money; const kt = !!C.kt;
  const from = (f) => html`<span class="st-meta">${f.doc_no ? `phiếu ${f.doc_no}` : 'lần giao'}${f.work_date ? ` · ${dmy(f.work_date).slice(0, 5)}` : ''}${f.days > 0 ? html` · <b class="${f.days >= 7 ? 'ks-old' : ''}">chờ ${f.days} ngày</b>` : ''}</span>`;
  const item = (f, btn) => html`<div class="ks-row" data-f="${f.id}"><div class="grow"><b>${f.name}</b>${f.extra ? html` <span class="pill off">ngoài phiếu</span>` : ''} · ${f.kind === 'bu' ? 'thiếu' : f.extra ? 'nhận' : 'thừa'} <b>${q3(f.qty)} ${f.unit || ''}</b>${f.extra ? html` · <b class="ks-old">chưa có giá</b>` : f.amount != null ? html` · <span class="st-meta">tạm tính ${money(f.amount)}</span>` : ''}<br>${from(f)}${f.note ? html`<span class="st-meta"> · ${f.note}</span>` : ''}</div>
      ${kt ? html`<span class="ks-act">${btn}<button type="button" class="btn sm secondary ks-cancel">Huỷ…</button></span>` : ''}</div>`;
  const doneRow = (f) => html`<div class="ks-row ks-done" data-f="${f.id}"><div class="grow"><span class="pill ${f.status === 'huy' ? 'mute' : 'ok'}">${f.status === 'huy' ? 'Đã huỷ' : f.kind === 'bu' ? 'Đã giao bù' : 'Đã có HĐ bổ sung'}</span>
      <b>${f.name}</b> · ${q3(f.qty)} ${f.unit || ''}<br><span class="st-meta">${f.status === 'huy' ? `Lý do: ${f.note || ''}` : f.kind === 'bu' ? `giao bù trong phiếu ${f.resolved_doc || '?'}${f.resolved_amount != null ? ` · không tính ${money(f.resolved_amount)}` : ''}` : `HĐ ${f.resolved_ref || ''}${f.resolved_amount != null ? ` · ${money(f.resolved_amount)}` : ''}`}${f.status !== 'huy' && f.note ? ` · ${f.note}` : ''} · ${f.resolved_by || ''} ${f.resolved_at ? dmy(String(f.resolved_at).slice(0, 10)).slice(0, 5) : ''}</span></div>
      ${kt ? html`<span class="ks-act"><button type="button" class="btn sm secondary ks-undo">Hoàn tác</button></span>` : ''}</div>`;
  return {
    title: 'Kiểm soát hàng hoá',
    html: html`${KS_CSS}${LOC_CSS}<div class="ks-wrap"><div class="page-head"><div><h1>Kiểm soát hàng hoá</h1><div class="sub">Sau khi quản lý đối soát: món <b>thiếu</b> chờ kho giao bù (hoá đơn giữ nguyên), món <b>thừa</b> chờ kế toán lên hoá đơn bổ sung. Cuối tháng xem tiền phải trả kho.</div></div></div>
      <section class="card ks-bar"><nav class="branch-tabs" aria-label="Cơ sở">${brs.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${q({ cn: b.id })}">${b.code}${nOpen(b.id) ? html` <span class="badge">${nOpen(b.id)}</span>` : ''}</a>`)}</nav>
        ${locBar(L, KD, (o) => q(locQuery(o)))}</section>
      ${hidden.length ? html`<div class="card loc-more" id="ks-hidden"><span>Còn <b>${hidden.length}</b> mục đang chờ ngoài khoảng ngày đang lọc.</span>${cover ? html`<a class="btn sm secondary" href="${q(locQuery(cover))}">Hiện cả</a>` : ''}</div>` : ''}
      ${M ? html`<section class="card ks-money"><b>Tiền hàng tháng ${Number(month.slice(5))}/${month.slice(0, 4)} · ${BR.code || ''}</b><span class="st-meta">Tính cả tháng (không theo khoảng ngày đang lọc).</span>
          <div class="ks-kv"><span>Phiếu xuất kho (${M.n_invoices} phiếu)</span><b>${money(M.invoices)}</b>
            <span>− Hàng giao bù (không tính tiền)</span><b>${M.bu ? '−' + money(M.bu) : '0đ'}</b>
            <span>+ Hoá đơn bổ sung (hàng thừa)</span><b>${M.hd_bs ? '+' + money(M.hd_bs) : '0đ'}</b>
            <span class="ks-tot">Phải trả kho tổng</span><b class="ks-tot">${money(M.payable)}</b></div>
          ${openAll.length ? html`<div class="st-meta">Còn ${openAll.length} món chưa xử lý — số trên có thể còn thay đổi.</div>` : ''}</section>` : ''}
      ${nb.length ? html`<section class="card ks-sec ks-nb"><div class="ks-h"><b>📄 Thiếu hoá đơn giao — cần tải hoá đơn bù</b><span class="pill off">${nb.length}</span></div>
        <div class="st-meta">Nhân viên nhận hàng mà tài xế không mang hoá đơn giao. Kế toán tải hoá đơn bù (ảnh / PDF) thì quản lý mới xác nhận đối soát xong.</div>
        ${nb.map((x) => html`<div class="ks-row" data-i="${x.id}"><div class="grow"><b>${x.doc_no || 'Chưa có phiếu xuất'}</b> · nhận ${x.received_at ? dmy(String(x.received_at).slice(0, 10)).slice(0, 5) : ''}${x.received_by ? ` · ${x.received_by}` : ''}<br><span class="st-meta">NV ghi: ${x.deliv_note || '—'}</span></div>
          ${kt ? html`<span class="ks-act"><label class="btn sm">Tải hoá đơn bù ›<input type="file" class="ks-bufile" accept="image/*,application/pdf" hidden></label></span>` : ''}</div>`)}</section>` : ''}
      <section class="card ks-sec"><div class="ks-h"><b>⏳ Chờ giao bù</b><span class="pill ${bu.length ? 'warn' : 'mute'}">${bu.length}</span></div>
        <div class="st-meta">Món nhận thiếu. Khi kho giao bù, bấm "Đã giao bù" và chọn dòng hàng đó trong phiếu xuất sau (dòng đó sẽ không tính tiền).</div>
        ${bu.length ? bu.map((f) => item(f, html`<button type="button" class="btn sm ks-bu">Đã giao bù ›</button>`)) : html`<div class="st-meta ks-empty">Không có món nào chờ giao bù.</div>`}</section>
      <section class="card ks-sec"><div class="ks-h"><b>🧾 Chờ hoá đơn bổ sung</b><span class="pill ${bs.length ? 'warn' : 'mute'}">${bs.length}</span></div>
        <div class="st-meta">Món nhận thừa → tính thêm tiền. Kế toán lên hoá đơn bổ sung cho kho rồi ghi số hoá đơn + số tiền.</div>
        ${bs.length ? bs.map((f) => item(f, html`<button type="button" class="btn sm ks-hd">Đã có hoá đơn ›</button>`)) : html`<div class="st-meta ks-empty">Không có món nào chờ hoá đơn bổ sung.</div>`}</section>
      <section class="card ks-sec"><div class="ks-h"><b>✓ Đã xử lý <span class="st-meta">· ${KINDS[L.kind].toLowerCase()} ${locLabel(L)}</span></b><span class="pill mute">${done.length}</span></div>
        ${done.length ? done.map(doneRow) : html`<div class="st-meta ks-empty">Chưa có.</div>`}</section>
      ${kt ? '' : html`<div class="st-meta">Chỉ kế toán bấm xử lý được; quản lý chỉ xem.</div>`}</div>`,
    mount() {
      wireLoc($('.ks-wrap'), L, (o) => q(locQuery(o)));
      const all = [...(C.open || []), ...done];
      const fOf = (b) => all.find((x) => x.id === Number(b.closest('[data-f]').dataset.f));
      const err = (dl, m) => { dl.querySelector('.ks-err').innerHTML = str(html`<div class="alert error">${m}</div>`); };
      $$('.ks-bu').forEach((b) => b.addEventListener('click', async () => {
        const f = fOf(b); let L = [];
        try { L = await rpc('app_gh_bu_lines', { p_followup: f.id }); } catch (e) { showSaved(e.message, true); return; }
        const dl = dialog(html`<form class="stack" style="gap:8px;width:min(480px, calc(100vw - 40px))"><h2 style="margin:0">Đã giao bù · ${f.name}</h2>
          <div class="st-meta">Thiếu ${q3(f.qty)} ${f.unit || ''} ở ${f.doc_no ? 'phiếu ' + f.doc_no : 'lần giao'}${f.work_date ? ' ' + dmy(f.work_date).slice(0, 5) : ''}. Chọn dòng hàng kho giao bù trong phiếu xuất sau của ${BR.code}:</div>
          <div class="ks-cands">${L.length ? L.map((l, i) => html`<label class="ks-cand ${l.same ? 'same' : ''}"><input type="radio" name="ln" value="${l.line_id}" ${i === 0 && l.same ? 'checked' : ''}><span><b>${l.name}</b> · ${q3(l.qty)} ${l.unit || ''}<br><span class="st-meta">phiếu ${l.doc_no} · ${dmy(l.work_date).slice(0, 5)}${l.amount != null ? ' · ' + money(l.amount) : ''}</span></span></label>`)
            : html`<div class="alert warn" style="margin:0">Chưa có phiếu xuất nào sau ngày thiếu hàng. Kế toán tải phiếu xuất giao bù ở tab Phiếu xuất trước (kho ghi riêng 1 dòng hàng giao bù).</div>`}</div>
          <input class="input sm" name="nt" placeholder="Ghi chú (không bắt buộc)"><div class="ks-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button>${L.length ? html`<button class="btn sm" type="submit">Lưu đã giao bù</button>` : ''}</div></form>`);
        const fm = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
        fm.addEventListener('submit', async (e) => { e.preventDefault(); const ln = fm.querySelector('input[name=ln]:checked');
          if (!ln) { err(dl, 'Chọn dòng hàng giao bù.'); return; }
          try { await rpc('app_gh_fu_resolve', { p_id: f.id, p_line: Number(ln.value), p_ref: null, p_amount: null, p_note: fm.nt.value }); dl.close(); flash('Đã ghi giao bù — dòng hàng đó không tính tiền.'); rerender(); }
          catch (er) { err(dl, er.message); } });
      }));
      $$('.ks-hd').forEach((b) => b.addEventListener('click', () => {
        const f = fOf(b);
        const dl = dialog(html`<form class="stack" style="gap:8px;width:min(420px, calc(100vw - 40px))"><h2 style="margin:0">Hoá đơn bổ sung · ${f.name}</h2>
          <div class="st-meta">Thừa ${q3(f.qty)} ${f.unit || ''} ở ${f.doc_no ? 'phiếu ' + f.doc_no : 'lần giao'}${f.amount != null ? ` · tạm tính ${money(f.amount)}` : ''}.</div>
          <label class="field"><span>Số hoá đơn bổ sung</span><input class="input" name="ref" autocomplete="off"></label>
          <label class="field"><span>Số tiền (đ)${f.extra ? ' — món ngoài phiếu, chưa có giá' : ''}</span><input class="input" name="amt" inputmode="numeric" autocomplete="off" value="${f.amount != null && !f.extra ? fmt(f.amount) : ''}"></label>
          <input class="input sm" name="nt" placeholder="Ghi chú (không bắt buộc)"><div class="ks-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        const fm = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
        fm.addEventListener('submit', async (e) => { e.preventDefault(); const amt = numOf(fm.amt.value);
          if (!fm.ref.value.trim()) { err(dl, 'Ghi số hoá đơn bổ sung.'); return; }
          if (amt === null || amt < 0) { err(dl, 'Nhập số tiền.'); return; }
          try { await rpc('app_gh_fu_resolve', { p_id: f.id, p_line: null, p_ref: fm.ref.value.trim(), p_amount: Math.round(amt), p_note: fm.nt.value }); dl.close(); flash('Đã ghi hoá đơn bổ sung.'); rerender(); }
          catch (er) { err(dl, er.message); } });
      }));
      $$('.ks-cancel').forEach((b) => b.addEventListener('click', () => {
        const f = fOf(b);
        const dl = dialog(html`<form class="stack" style="gap:8px;width:min(420px, calc(100vw - 40px))"><h2 style="margin:0">Huỷ theo dõi · ${f.name}</h2>
          <div class="st-meta">Dùng khi không cần giao bù / không lên hoá đơn bổ sung (vd: kho đã trừ tiền, nhân viên đếm nhầm…).</div>
          <label class="field"><span>Lý do (bắt buộc)</span><input class="input" name="rs" autocomplete="off"></label><div class="ks-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button><button class="btn sm" type="submit">Huỷ theo dõi</button></div></form>`);
        const fm = dl.querySelector('form'); dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
        fm.addEventListener('submit', async (e) => { e.preventDefault(); if (!fm.rs.value.trim()) { err(dl, 'Ghi lý do.'); return; }
          try { await rpc('app_gh_fu_cancel', { p_id: f.id, p_reason: fm.rs.value }); dl.close(); rerender(); } catch (er) { err(dl, er.message); } });
      }));
      $$('.ks-bufile').forEach((inp) => inp.addEventListener('change', async () => {
        const file = inp.files[0]; inp.value = ''; if (!file) return; const iid = Number(inp.closest('[data-i]').dataset.i);
        showSaved('Đang tải hoá đơn bù…');
        try { await uploadFiles('hd' + iid, [file], (path, ff) => rpc('app_gh_bu_file', { p_id: iid, p_path: path, p_name: ff.name })); flash('Đã tải hoá đơn bù — quản lý xác nhận đối soát xong được.'); rerender(); }
        catch (e) { showSaved(e.message, true); }
      }));
      $$('.ks-undo').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Hoàn tác — đưa món này về danh sách chờ xử lý?')) return;
        b.disabled = true;
        try { await rpc('app_gh_fu_undo', { p_id: fOf(b).id }); rerender(); } catch (e) { b.disabled = false; showSaved(e.message, true); }
      }));
    },
  };
}

const KS_CSS = html`<style>
  .ks-wrap { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  .ks-bar { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; }
  .ks-money { display: flex; flex-direction: column; gap: 6px; }
  .ks-kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; font-size: 14px; } .ks-kv b { text-align: right; white-space: nowrap; }
  .ks-tot { border-top: 1px solid var(--line); padding-top: 5px; font-weight: 800; font-size: 15px; }
  .ks-sec { display: flex; flex-direction: column; gap: 4px; } .ks-h { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
  .ks-row { display: flex; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); } .ks-row .grow { min-width: 0; flex: 1 1 auto; overflow-wrap: anywhere; }
  .ks-act { display: flex; gap: 4px; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; } .ks-act .btn { width: auto; white-space: nowrap; }
  .ks-done { opacity: .85; } .ks-done .pill { margin-right: 4px; } .ks-old { color: #b91c1c; } .ks-empty { padding: 6px 0; }
  .ks-cands { display: flex; flex-direction: column; gap: 4px; max-height: 50vh; overflow: auto; }
  .ks-cand { display: flex; gap: 8px; align-items: flex-start; padding: 6px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; } .ks-cand.same { border-color: var(--primary); }
  .ks-cand input { margin-top: 3px; width: 18px; height: 18px; flex: 0 0 auto; }
  @media (max-width: 560px) { .ks-row { flex-direction: column; align-items: stretch; } .ks-act { justify-content: flex-start; } }
</style>`;
