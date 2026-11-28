// Quản lý ca › Chênh lệch tiền (anh Tiến 27/11/2026: "bảng tiền chênh lệch để đối soát cho chủ và quản lý", "bảng để xem và xử lý luôn").
//  * Mỗi dòng = một chênh lệch của một ca (tiền mặt / chuyển khoản). Số lấy NGUYÊN từ sổ tháng của Sổ thu chi (stcLoadFor → gapRows) — không tính lại.
//  * Xử lý ngay tại bảng bằng đúng Phiếu chênh lệch của Sổ thu chi (stcGapOpen) và đúng hàm Chủ duyệt (app_stc_gap_approve) — không có luật riêng.
//  * Ai vào: người có quyền đối soát; chỉ thấy cơ sở mà Sổ thu chi cho mình xem (cơ sở không được xem thì bỏ qua).
import { render as rerender } from '../app.js';
import { catalog, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { fmt } from '../tien.js';
import { $, flash, html, showSaved, str } from '../ui.js';
import { CL_ST, filterRows, gapRows, sortRows, summary, waitingCas } from '../chenh_lech_tinh.js?v=2026.11.28.14';
import { stcGapOpen, stcLoadFor, stcStyle } from './so_thu_chi.js?v=2026.11.28.14';   // cùng bản với trang Sổ thu chi; số ?v= tăng khi phát hành

export const perm = 'doi_soat';
const F = { st: '', dir: '', pm: '' };   // lọc (giữ trong phiên)
const PM = { tm: 'Tiền mặt', ck: 'Chuyển khoản' };
const dm = (d) => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;
const shiftMonth = (m, k) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + k, 1)); return d.toISOString().slice(0, 7); };
const signed = (v) => (v < 0 ? '−' : '+') + fmt(Math.abs(v));
const link = (o) => '#/quan-ly/chenh-lech?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : vnToday().slice(0, 7);
  const C = await catalog().catch(() => null);
  const all = (C?.activeBranches || []).map((b) => ({ id: b.id, code: b.display_code || b.code }));
  const want = params.cn && params.cn !== 'all' ? all.filter((b) => String(b.id) === String(params.cn)) : all;
  // nạp lần lượt từng cơ sở (không dồn máy chủ); cơ sở mình không được xem tiền thì bỏ qua
  const Ds = []; const hidden = []; let lastErr = '';
  for (const b of want) {
    try { Ds.push(await stcLoadFor(b.id, month)); } catch (e) { hidden.push(b.code); lastErr = e.message || String(e); }
  }
  const byBranch = new Map(Ds.map((D) => [String(D.branch.id), D]));
  const rowsAll = sortRows(Ds.flatMap((D) => gapRows(D)));
  const chuaXong = Ds.reduce((s, D) => s + waitingCas(D), 0);   // ca chưa đối soát xong đang có lệch — chưa vào bảng
  const owner = Ds.some((D) => D.owner);
  const cn = params.cn && params.cn !== 'all' ? String(params.cn) : 'all';
  const head = html`<div class="page-head"><div><h1>Chênh lệch tiền</h1>
      <div class="sub">Ca quản lý đã đối soát xong mà tiền thực tế khác tiền phải có — soát và xử lý ngay tại đây. Số lấy từ Sổ thu chi và trang đối soát ca.</div></div>
      <div id="saved-indicator" class="saved" role="status" hidden></div></div>
    <div class="cl-bar"><div class="cl-month"><a class="btn sm secondary" href="${link({ thang: shiftMonth(month, -1), cn: cn === 'all' ? '' : cn })}" aria-label="Tháng trước">‹</a>
        <strong>Tháng ${month.slice(5)}/${month.slice(0, 4)}</strong><a class="btn sm secondary" href="${link({ thang: shiftMonth(month, 1), cn: cn === 'all' ? '' : cn })}" aria-label="Tháng sau">›</a></div>
      <nav class="cl-chips cl-cn" aria-label="Cơ sở"><a class="${cn === 'all' ? 'on' : ''}" href="${link({ thang: month })}">Tất cả cơ sở</a>${all.map((b) => html`<a class="${cn === String(b.id) ? 'on' : ''}" href="${link({ thang: month, cn: b.id })}">${b.code}</a>`)}</nav></div>`;
  if (!Ds.length) return { title: 'Chênh lệch tiền', html: html`${STYLE}${head}<div class="alert warn">${lastErr || 'Không có cơ sở nào để xem.'}</div>` };

  const tile = (cls, k, v, sub) => html`<div class="cl-tile ${cls}"><span>${k}</span><b>${v}</b><small>${sub}</small></div>`;
  const tiles = (S) => html`<div class="cl-tiles" id="cl-tiles">
      ${tile('', 'Tổng thiếu', '−' + fmt(S.thieu.v), `${S.thieu.n} dòng`)}${tile('', 'Tổng dư', '+' + fmt(S.du.v), `${S.du.n} dòng`)}
      ${tile(S.cho.n ? 'warn' : '', 'Còn chênh lệch', fmt(S.cho.v), `${S.cho.n} dòng · chưa xử lý xong`)}
      ${tile(S.chu.n ? 'plum' : '', 'Chờ Chủ duyệt', fmt(S.chu.v), `${S.chu.n} khoản`)}
      ${tile('', 'Đã xử lý xong', fmt(S.xong.v), `Trừ lương ${fmt(S.xong.tl)} · Quán chịu ${fmt(S.xong.qc)}`)}</div>`;
  const cnt = (st) => rowsAll.filter((r) => (st === 'nho' ? r.small : !r.small && r.st === st)).length;
  const chip = (grp, v, label, n) => html`<button type="button" data-f="${grp}" data-v="${v}" aria-pressed="${String(F[grp] === v)}">${label}${n == null ? '' : html` <span>${n}</span>`}</button>`;
  const filters = () => html`<div class="cl-f" id="cl-f"><div class="cl-chips">${chip('st', '', 'Tất cả', rowsAll.length - cnt('nho'))}${chip('st', 'cho', 'Còn chênh lệch', cnt('cho'))}${chip('st', 'chu', 'Chờ Chủ duyệt', cnt('chu'))}
        ${chip('st', 'xong', 'Đã xử lý', cnt('xong'))}${cnt('tam') ? chip('st', 'tam', 'Số tạm', cnt('tam')) : ''}${cnt('nho') ? chip('st', 'nho', 'Lệch nhỏ', cnt('nho')) : ''}</div>
      <div class="cl-chips">${chip('dir', 'thieu', 'Chỉ thiếu')}${chip('dir', 'du', 'Chỉ dư')}${chip('pm', 'tm', 'Tiền mặt')}${chip('pm', 'ck', 'Chuyển khoản')}</div></div>`;
  const doneHtml = (r) => (r.handled.length ? r.handled.map((h) => html`<div class="cl-h ${h.wait ? 'wait' : ''}">${h.text} <b>${fmt(h.amount)}</b>${h.wait ? ' · chờ Chủ duyệt' : ''}</div>`)
    : html`<span class="st-meta">${r.st === 'nho' ? 'Lệch nhỏ — không cần xử lý' : r.st === 'tam' ? 'Ca chưa xác nhận xong phần tiền — số còn có thể đổi' : 'Chưa xử lý'}</span>`);
  const acts = (r) => html`<div class="cl-acts">
      ${owner && r.waits.length ? r.waits.map((w) => html`<button type="button" class="btn sm" data-ok="${w}" data-key="${r.key}">Duyệt</button><button type="button" class="btn sm secondary" data-no="${w}" data-key="${r.key}">Từ chối</button>`) : ''}
      ${r.can_open ? html`<button type="button" class="btn sm ${r.st === 'cho' ? '' : 'secondary'}" data-xl="${r.key}">${r.st === 'cho' ? 'Xử lý' : 'Xem / sửa'}</button>` : ''}
</div>`;
  const row = (r) => html`<tr class="cl-r ${r.st}" data-key="${r.key}">
      <td data-l="Ngày · ca"><b>${dm(r.date)} · ${r.shift}</b><br><a class="cl-xem" href="#/ca/doi-soat?id=${r.ca_id}&tab=tien&b=5">xem ca</a></td><td data-l="Cơ sở">${r.branch}</td><td data-l="Loại tiền">${PM[r.pm]}</td>
      <td data-l="Phải có" class="num">${r.must == null ? '–' : fmt(r.must)}</td><td data-l="Thực tế" class="num">${r.real == null ? '–' : fmt(r.real)}</td>
      <td data-l="Lệch" class="num cl-amt ${r.amt < 0 ? 'thieu' : 'du'}">${signed(r.amt)}</td>
      <td data-l="Người làm ca" class="cl-staff">${r.staff || '—'}</td><td data-l="Đã xử lý bằng" class="cl-done">${doneHtml(r)}</td>
      <td data-l="Còn lại" class="num"><b>${fmt(r.left)}</b></td><td data-l="Trạng thái" class="cl-stc"><span class="pill ${CL_ST[r.st][1]} cl-st">${CL_ST[r.st][0]}</span>${r.st === 'cho' && r.note && !/^Chờ xử lý/.test(r.note) ? html`<div class="st-meta">${r.note}</div>` : ''}${acts(r)}</td></tr>`;
  const table = () => { const rows = filterRows(rowsAll, F);
    return html`<div id="cl-box">${rows.length ? html`<div class="card cl-wrap"><table class="cl-t"><thead><tr><th>Ngày · ca</th><th>Cơ sở</th><th>Loại tiền</th><th class="num">Phải có</th><th class="num">Thực tế</th><th class="num">Lệch</th>
        <th>Người làm ca</th><th>Đã xử lý bằng</th><th class="num">Còn lại</th><th>Trạng thái · việc làm</th></tr></thead>
      <tbody>${rows.map(row)}</tbody>
      <tfoot><tr><td colspan="5">Tổng ${rows.length} dòng đang hiện</td><td class="num">${signed(rows.reduce((s, r) => s + r.amt, 0))}</td><td colspan="2"></td><td class="num">${fmt(rows.reduce((s, r) => s + r.left, 0))}</td><td></td></tr></tfoot></table></div>`
      : html`<div class="card cl-empty">${rowsAll.length ? 'Không có dòng nào khớp bộ lọc.' : 'Chưa có ca đã đối soát xong nào chênh lệch tiền trong tháng này.'}</div>`}</div>`; };
  const S = summary(rowsAll);
  return {
    title: 'Chênh lệch tiền',
    html: html`${stcStyle()}${STYLE}${head}
      <div id="cl-page" class="stack" style="gap:12px">
        ${hidden.length && cn === 'all' ? html`<div class="st-meta">Không gồm cơ sở bạn không được xem tiền: ${hidden.join(', ')}.</div>` : ''}
        ${chuaXong ? html`<div class="st-meta" id="cl-chua">Còn ${chuaXong} ca có lệch nhưng quản lý chưa đối soát xong — đối soát xong (bấm Hoàn thành ở ca) thì chênh lệch mới về bảng này. <a href="#/ca">Mở Chốt ca ›</a></div>` : ''}
        ${tiles(S)}${S.nho || S.tam.n ? html`<div class="st-meta">${S.tam.n ? `${S.tam.n} dòng là số tạm (ca chưa xác nhận xong phần tiền, ${fmt(S.tam.v)}). ` : ''}${S.nho ? `${S.nho} dòng lệch nhỏ (từ 5.000 trở xuống) đang ẩn — ${S.nhoAuto.n} dòng web đã tự tạo phiếu khi Hoàn thành ca (chi quán chịu ${fmt(S.nhoAuto.chi)}, thu khác ${fmt(S.nhoAuto.thu)}). Bấm "Lệch nhỏ" để xem.` : ''}</div>` : ''}
        ${filters()}${table()}
      </div>`,
    mount(root) {
      const page = $('#cl-page', root); if (!page) return;
      const find = (key) => rowsAll.find((r) => r.key === key);
      page.addEventListener('click', async (ev) => {
        const t = ev.target;
        const f = t.closest('#cl-f [data-f]');
        if (f) { const g = f.dataset.f, v = f.dataset.v; F[g] = g !== 'st' && F[g] === v ? '' : v;
          $('#cl-f', page).outerHTML = str(filters()); $('#cl-box', page).outerHTML = str(table()); return; }
        const xl = t.closest('[data-xl]');
        if (xl) { const r = find(xl.dataset.xl); const D = r && byBranch.get(String(r.branch_id));
          if (D) stcGapOpen(D, r.id, month, () => rerender()); return; }
        const ap = t.closest('[data-ok],[data-no]');
        if (ap) { const [kind, id] = (ap.dataset.ok || ap.dataset.no).split(':'); const ok = !!ap.dataset.ok; ap.disabled = true;
          try { await rpc('app_stc_gap_approve', { p_kind: kind, p_id: Number(id), p_ok: ok }); flash(ok ? 'Chủ đã duyệt.' : 'Đã từ chối.'); rerender(); }
          catch (e) { ap.disabled = false; showSaved(e.message, true); } }
      });
    },
  };
}

const STYLE = html`<style>
  .cl-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .cl-month { display: flex; gap: 8px; align-items: center; } .cl-month strong { min-width: 118px; text-align: center; }
  .cl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .cl-chips button, .cl-chips a { border: 1px solid var(--line-strong); background: var(--card); color: var(--ink-2); border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; min-height: 34px; display: inline-flex; align-items: center; gap: 5px; }
  .cl-chips button span { color: var(--muted); font-weight: 500; }
  .cl-chips button[aria-pressed="true"] { background: var(--primary-dark, #7a431a); border-color: var(--primary-dark, #7a431a); color: #fff; } .cl-chips button[aria-pressed="true"] span { color: #f3e3d3; }
  .cl-cn a.on { background: var(--forest, #2f3e33); border-color: var(--forest, #2f3e33); color: #fff; }
  .cl-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .cl-tile { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .cl-tile span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; } .cl-tile b { font-size: 21px; font-variant-numeric: tabular-nums; } .cl-tile small { font-size: 12.5px; color: var(--ink-2); overflow-wrap: anywhere; }
  .cl-tile.warn { background: var(--warn-bg); border-color: #d9a441; } .cl-tile.plum { background: var(--plum-bg); border-color: var(--plum-ink); }
  .cl-f { display: flex; flex-direction: column; gap: 6px; }
  .pill.plum { background: var(--plum-bg); color: var(--plum-ink); }
  .cl-wrap { padding: 0; overflow-x: auto; } .cl-t { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .cl-t th { text-align: left; font-size: 11.5px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; padding: 10px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .cl-t td:first-child { white-space: nowrap; } .cl-stc { min-width: 168px; } .cl-stc .btn.sm { padding: 6px 9px; font-size: 12px; }
  .cl-t td { padding: 10px 8px; border-bottom: 1px solid var(--line-soft); vertical-align: top; } .cl-t .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .cl-t tfoot td { font-weight: 700; background: var(--subtle); border-bottom: 0; }
  .cl-amt { font-weight: 700; } .cl-amt.thieu { color: #a61b1b; } .cl-amt.du { color: #1d5fa8; }
  .cl-staff { color: var(--ink-2); max-width: 120px; overflow-wrap: anywhere; } .cl-done { min-width: 130px; max-width: 220px; overflow-wrap: anywhere; }
  .cl-h { font-size: 13px; } .cl-h.wait { color: var(--plum-ink); font-weight: 600; }
  .cl-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; } .cl-acts .btn { white-space: nowrap; }
  .cl-empty { padding: 18px; color: var(--ink-2); } .cl-xem { font-size: 12px; font-weight: 400; }
  @media (max-width: 860px) {   /* điện thoại: mỗi chênh lệch một thẻ */
    .cl-wrap { border: 0; background: transparent; overflow: visible; box-shadow: none; } .cl-t thead { display: none; } .cl-t, .cl-t tbody, .cl-t tfoot { display: block; }
    .cl-t tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 10px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
    .cl-t td { padding: 0; border: 0; text-align: left !important; white-space: normal !important; max-width: none; min-width: 0; }
    .cl-t td[data-l]::before { content: attr(data-l); display: block; font-size: 11px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; }
    .cl-t td.cl-staff, .cl-t td.cl-done, .cl-t td.cl-stc { grid-column: 1 / -1; } .cl-acts .btn { min-height: 40px; }
    .cl-t tfoot tr { display: flex; flex-wrap: wrap; gap: 6px 14px; } .cl-t tfoot td:empty { display: none; }
  }
</style>`;
