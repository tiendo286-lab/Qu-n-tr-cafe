// Hàng hoá › Kiểm soát (bước 104, anh Tiến chốt 15/11/2026) — kế toán kho theo dõi sau đối soát:
//  * Chờ giao bù: món nhận THIẾU so với phiếu xuất → kho giao bù ở lần sau (hoá đơn gốc giữ nguyên). Kế toán chỉ ra dòng hàng giao bù
//    trong phiếu xuất sau → dòng đó không tính tiền.
//  * Chờ hoá đơn bổ sung: món nhận THỪA → tính thêm tiền, kế toán lên hoá đơn bổ sung cho kho (ghi số hoá đơn + số tiền).
//  * Tiền tháng: tổng phiếu xuất − hàng giao bù (không tính tiền) + hoá đơn bổ sung = phải trả kho tổng.
import { render as rerender } from '../app.js';
import { catalog, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, fmt } from '../tien.js';
import { $$, dialog, flash, html, showSaved, str } from '../ui.js';

export const perm = ['ke_toan', 'doi_soat'];
const LS_BR = 'ckBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const q3 = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));
const numOf = (v) => { const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const money = (n) => (n === null || n === undefined ? '' : `${fmt(n)}đ`);

export async function render({ params }) {
  const today = vnToday();
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : today.slice(0, 7);
  const cat = await catalog();
  const brs = (cat.activeBranches || []).map((b) => ({ id: b.id, code: b.display_code || b.code }));
  const has = (v) => brs.some((b) => String(b.id) === String(v));
  const br = has(params.cn) ? Number(params.cn) : has(lsGet()) ? lsGet() : brs[0]?.id; if (br) lsSet(br);
  const BR = brs.find((b) => b.id === br) || {};
  const [All, C] = await Promise.all([rpc('app_gh_control', { p_branch: null, p_month: month }), rpc('app_gh_control', { p_branch: br, p_month: month })]);
  const nOpen = (id) => (All.open || []).filter((f) => f.branch_id === id).length;
  const bu = (C.open || []).filter((f) => f.kind === 'bu'); const bs = (C.open || []).filter((f) => f.kind === 'hd_bs');
  const done = C.done || []; const M = C.money; const kt = !!C.kt;
  const q = (o) => '#/hang-hoa/kiem-soat?' + Object.entries({ cn: br, thang: month, ...o }).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${v}`).join('&');
  const shiftMonth = (k) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };
  const from = (f) => html`<span class="st-meta">${f.doc_no ? `phiếu ${f.doc_no}` : 'lần giao'}${f.work_date ? ` · ${dmy(f.work_date).slice(0, 5)}` : ''}${f.days > 0 ? html` · <b class="${f.days >= 7 ? 'ks-old' : ''}">chờ ${f.days} ngày</b>` : ''}</span>`;
  const item = (f, btn) => html`<div class="ks-row" data-f="${f.id}"><div class="grow"><b>${f.name}</b> · ${f.kind === 'bu' ? 'thiếu' : 'thừa'} <b>${q3(f.qty)} ${f.unit || ''}</b>${f.amount != null ? html` · <span class="st-meta">${money(f.amount)}</span>` : ''}<br>${from(f)}${f.note ? html`<span class="st-meta"> · ${f.note}</span>` : ''}</div>
      ${kt ? html`<span class="ks-act">${btn}<button type="button" class="btn sm secondary ks-cancel">Huỷ…</button></span>` : ''}</div>`;
  const doneRow = (f) => html`<div class="ks-row ks-done" data-f="${f.id}"><div class="grow"><span class="pill ${f.status === 'huy' ? 'mute' : 'ok'}">${f.status === 'huy' ? 'Đã huỷ' : f.kind === 'bu' ? 'Đã giao bù' : 'Đã có HĐ bổ sung'}</span>
      <b>${f.name}</b> · ${q3(f.qty)} ${f.unit || ''}<br><span class="st-meta">${f.status === 'huy' ? `Lý do: ${f.note || ''}` : f.kind === 'bu' ? `giao bù trong phiếu ${f.resolved_doc || '?'}${f.resolved_amount != null ? ` · không tính ${money(f.resolved_amount)}` : ''}` : `HĐ ${f.resolved_ref || ''}${f.resolved_amount != null ? ` · ${money(f.resolved_amount)}` : ''}`}${f.status !== 'huy' && f.note ? ` · ${f.note}` : ''} · ${f.resolved_by || ''} ${f.resolved_at ? dmy(String(f.resolved_at).slice(0, 10)).slice(0, 5) : ''}</span></div>
      ${kt ? html`<span class="ks-act"><button type="button" class="btn sm secondary ks-undo">Hoàn tác</button></span>` : ''}</div>`;
  return {
    title: 'Kiểm soát hàng hoá',
    html: html`${KS_CSS}<div class="ks-wrap"><div class="page-head"><div><h1>Kiểm soát hàng hoá</h1><div class="sub">Sau khi quản lý đối soát: món <b>thiếu</b> chờ kho giao bù (hoá đơn giữ nguyên), món <b>thừa</b> chờ kế toán lên hoá đơn bổ sung. Cuối tháng xem tiền phải trả kho.</div></div></div>
      <section class="card ks-bar"><nav class="branch-tabs" aria-label="Cơ sở">${brs.map((b) => html`<a class="${b.id === br ? 'on' : ''}" href="${q({ cn: b.id })}">${b.code}${nOpen(b.id) ? html` <span class="badge">${nOpen(b.id)}</span>` : ''}</a>`)}</nav>
        <div class="ks-mon"><a class="btn sm secondary" href="${q({ thang: shiftMonth(-1) })}" aria-label="Tháng trước">‹</a><strong>Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(1) })}" aria-label="Tháng sau">›</a></div></section>
      ${M ? html`<section class="card ks-money"><b>Tiền hàng tháng ${Number(month.slice(5))} · ${BR.code || ''}</b>
          <div class="ks-kv"><span>Phiếu xuất kho (${M.n_invoices} phiếu)</span><b>${money(M.invoices)}</b>
            <span>− Hàng giao bù (không tính tiền)</span><b>${M.bu ? '−' + money(M.bu) : '0đ'}</b>
            <span>+ Hoá đơn bổ sung (hàng thừa)</span><b>${M.hd_bs ? '+' + money(M.hd_bs) : '0đ'}</b>
            <span class="ks-tot">Phải trả kho tổng</span><b class="ks-tot">${money(M.payable)}</b></div>
          ${bu.length || bs.length ? html`<div class="st-meta">Còn ${bu.length + bs.length} món chưa xử lý — số trên có thể còn thay đổi.</div>` : ''}</section>` : ''}
      <section class="card ks-sec"><div class="ks-h"><b>⏳ Chờ giao bù</b><span class="pill ${bu.length ? 'warn' : 'mute'}">${bu.length}</span></div>
        <div class="st-meta">Món nhận thiếu. Khi kho giao bù, bấm "Đã giao bù" và chọn dòng hàng đó trong phiếu xuất sau (dòng đó sẽ không tính tiền).</div>
        ${bu.length ? bu.map((f) => item(f, html`<button type="button" class="btn sm ks-bu">Đã giao bù ›</button>`)) : html`<div class="st-meta ks-empty">Không có món nào chờ giao bù.</div>`}</section>
      <section class="card ks-sec"><div class="ks-h"><b>🧾 Chờ hoá đơn bổ sung</b><span class="pill ${bs.length ? 'warn' : 'mute'}">${bs.length}</span></div>
        <div class="st-meta">Món nhận thừa → tính thêm tiền. Kế toán lên hoá đơn bổ sung cho kho rồi ghi số hoá đơn + số tiền.</div>
        ${bs.length ? bs.map((f) => item(f, html`<button type="button" class="btn sm ks-hd">Đã có hoá đơn ›</button>`)) : html`<div class="st-meta ks-empty">Không có món nào chờ hoá đơn bổ sung.</div>`}</section>
      <section class="card ks-sec"><div class="ks-h"><b>✓ Đã xử lý tháng ${Number(month.slice(5))}</b><span class="pill mute">${done.length}</span></div>
        ${done.length ? done.map(doneRow) : html`<div class="st-meta ks-empty">Chưa có.</div>`}</section>
      ${kt ? '' : html`<div class="st-meta">Chỉ kế toán bấm xử lý được; quản lý chỉ xem.</div>`}</div>`,
    mount() {
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
          <label class="field"><span>Số tiền (đ)</span><input class="input" name="amt" inputmode="numeric" autocomplete="off" value="${f.amount != null ? fmt(f.amount) : ''}"></label>
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
  .ks-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; }
  .ks-mon { display: flex; align-items: center; gap: 8px; } .ks-mon .btn { width: auto; }
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
