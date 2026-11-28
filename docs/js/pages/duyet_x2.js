// Chặng 6.2 (anh Tiến duyệt hình mẫu 23/11/2026): trang "Duyệt nghỉ & làm thay" — nhiều ca trên một trang.
// 3 thẻ: Chờ phân loại (Quản lý tổng) · Chờ Chủ duyệt · Đã duyệt (theo tháng; Chủ Sửa → Duyệt lại).
// Mỗi ca một dòng, sửa tại chỗ như khung "Nghỉ & làm thay" trong từng ca (nghi_thay.js). Áp hàng loạt chỉ điền sẵn, chưa lưu.
// Lưu / duyệt từng ca bằng app_cv_save / app_cv_approve sẵn có (quyền, cách tính x2 / trừ giờ ở máy chủ không đổi).
// 27/11: ca 1 người nghỉ + 1 người hỗ trợ tự ghép sẵn thành một khung (không có nút Lưu người này).
// 27/11: nút riêng từng ca (Lưu ca này / Duyệt ca này); ca nhiều người có nút Lưu người này (app_cv_save_one, tệp 186).
// 28/11 (anh Tiến): hai ca là một lần ĐỔI CA (A nghỉ ca mình và làm thay ở ca của B, B ngược lại) → gộp một khung,
//   ghép sẵn người làm thay, một nút Lưu cả 2 ca / Duyệt cả 2 ca. Lý do, x2 vẫn chọn tay từng lần. Chỉ ở giao diện.
// 28/11 (tệp 194): lý do "Đổi ca (lịch chưa sửa)" + nút bấm nhanh Đổi ca ở từng người nghỉ — ca toàn Đổi ca lưu xong là xong luôn, khỏi Chủ duyệt.
// Danh sách: app_cv_todo (chờ) + app_cv_done (đã duyệt, tệp 165); chi tiết từng ca: app_cv_get.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, flash, go, html, str } from '../ui.js';
import { CV_CSS, REASONS } from '../nghi_thay.js';

export const perm = 'doi_soat';

const hrs = (h) => (Number(h) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const TABS = [['cho', 'Chờ phân loại'], ['duyet', 'Chờ Chủ duyệt'], ['xong', 'Đã duyệt']];
const STYLE = html`<style>
  .x2p-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .x2p-tab { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 6px 12px; font: inherit; font-weight: 600; color: var(--ink); cursor: pointer; }
  .x2p-tab[aria-selected="true"] { background: var(--primary); border-color: var(--primary); color: #fff; }
  .x2p-bulk { background: var(--caramel-soft); border: 1px solid var(--caramel-line); border-radius: 10px; padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .x2p-bulk select.input { flex: 1 1 240px; width: auto; max-width: 100%; }
  .x2p-list { display: flex; flex-direction: column; gap: 8px; }
  .x2p-ca { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; }
  .x2p-ca > .x2p-pick { margin-top: 3px; width: 18px; height: 18px; }
  .x2p-ca.bad { border-left-color: var(--off-line, #dc2626); }
  .x2p-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .x2p-t { font-weight: 700; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .x2p-err { color: var(--off-line, #dc2626); font-weight: 600; font-size: 13px; }
  .x2p-foot { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; align-items: center; }
  .x2p-foot .st-meta { margin-right: auto; }
  .x2p-pair { border: 2px dashed var(--caramel-line); background: var(--caramel-soft); border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .x2p-pair .x2p-ca { background: var(--card); }
  .x2p-pt { font-weight: 700; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
  .x2p-p1 { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 4px; }
</style>`;

// Chạy song song có giới hạn để mở trang nhanh mà không dồn máy chủ.
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch((e) => ({ error: e.message })); } }));
  return out;
}

export async function render({ params }) {
  const tab = TABS.some(([k]) => k === params.tab) ? params.tab : 'cho';
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
  const cn = params.cn ? Number(params.cn) : null;
  const todo = await rpc('app_cv_todo').catch(() => []);
  let done = null, doneErr = '';
  try { done = await rpc('app_cv_done', { p_month: month }); } catch (e) { doneErr = e.message; }
  const lists = { cho: todo.filter((c) => c.state !== 'cho_duyet'), duyet: todo.filter((c) => c.state === 'cho_duyet'), xong: done || [] };
  const branches = [...new Map([...todo, ...(done || [])].map((c) => [c.branch_id, c.branch])).entries()];
  const inCn = (c) => !cn || c.branch_id === cn;
  // Thẻ chờ: đọc cả các cơ sở khác để nhận ra cặp đổi ca giữa hai cơ sở (lọc cơ sở vẫn thấy đủ cặp).
  const shown = lists[tab].filter((c) => tab !== 'xong' || inCn(c))
    .sort((a, b) => (tab === 'xong' ? (b.complaint ? 1 : 0) - (a.complaint ? 1 : 0) : 0));   // Đã duyệt: ca còn khiếu nại lên đầu
  const details = await pool(shown, 6, (c) => rpc('app_cv_get', { p_id: c.id }));
  const allRows = shown.map((c, i) => ({ ...c, C: details[i] }));
  // Cặp đổi ca: A nghỉ ở ca X và là người hỗ trợ ở ca Y; B nghỉ ở ca Y và là người hỗ trợ ở ca X (cách nhau không quá 7 ngày).
  if (tab !== 'xong') {
    const ppl = (r, k) => (r.C && !r.C.error ? r.C.people.filter((p) => p.kind === k) : []);
    const has = (r, k, id) => ppl(r, k).some((p) => p.employee_id === id);
    const gap = (a, b) => Math.abs(new Date(a.date) - new Date(b.date)) / 864e5;
    const nm = (p) => `${p.code} – ${p.name}`;
    for (const x of allRows) {
      if (x.swap) continue; let best = null;
      for (const y of allRows) {
        if (y === x || y.swap || !(gap(x, y) <= 7)) continue;
        const a = ppl(x, 'nghi').find((p) => has(y, 'ho_tro', p.employee_id));
        const b = a && ppl(y, 'nghi').find((p) => p.employee_id !== a.employee_id && has(x, 'ho_tro', p.employee_id));
        if (a && b && (!best || gap(x, y) < best.d)) best = { y, a, b, d: gap(x, y) };
      }
      if (best) { x.swap = { [best.a.employee_id]: best.b.employee_id }; best.y.swap = { [best.b.employee_id]: best.a.employee_id };
        x.mate = best.y; best.y.tail = true; x.swapTitle = `${nm(best.a)} ↔ ${nm(best.b)}`; }
    }
  }
  const rows = [];
  for (const r of allRows) { if (r.tail) continue; if (inCn(r) || (r.mate && inCn(r.mate))) { rows.push(r); if (r.mate) rows.push(r.mate); } }
  const anyC = rows.find((r) => r.C && !r.C.error)?.C;
  const canClassify = !!anyC?.can_classify, isOwner = !!anyC?.is_owner;
  const nav = (p) => go('/quan-ly/nghi-lam-thay?' + new URLSearchParams(Object.entries({ tab, cn: cn || '', thang: tab === 'xong' ? month : '', ...p }).filter(([, v]) => v !== '' && v != null)).toString());
  const ticked = new Set(tab === 'duyet' ? rows.filter((r) => r.C && !r.C.error).map((r) => r.id) : []);
  const editing = new Set();

  // ---- một ca ----
  const caTitle = (r) => `${dmy(r.date)} · ${r.branch} · Ca ${r.shift}`;
  const editable = (r) => r.C && !r.C.error && r.C.open && (tab !== 'xong' ? canClassify : isOwner && editing.has(r.id));
  const editor = (r) => {
    // tệp 186: ca đang lưu dở từng người (vẫn "Chưa phân loại" nhưng đã có dòng) → điền sẵn dòng đã lưu
    const C = r.C, part = C.state === 'chua_phan_loai' && C.rows.length > 0, valid = C.state === 'cho_duyet' || C.state === 'da_duyet' || part;
    const absents = C.people.filter((p) => p.kind === 'nghi'), helpers = C.people.filter((p) => p.kind === 'ho_tro'), workers = C.workers || [];
    const rowOf = (id) => (valid ? C.rows.find((x) => x.absent_id === id) : null);
    const extraOf = (hid) => (valid ? C.rows.find((x) => x.absent_id === null && x.helper_id === hid) : null);
    const used = new Set(absents.map((a) => String(rowOf(a.employee_id)?.helper_id || '')).filter(Boolean));
    // 27/11 (cách 2): ca có từ 2 người trở lên → mỗi người một nút Lưu riêng (chỉ ở thẻ Chờ phân loại)
    // 27/11 (anh Tiến): ca đúng 1 người nghỉ + 1 người hỗ trợ, chưa lưu gì → ghép sẵn người hỗ trợ làm người thay,
    // cả ca chỉ còn một khung, một nút Lưu ca này (không phải làm 2 lần cho người nghỉ và người được nhờ).
    const pair11 = absents.length === 1 && helpers.length === 1;
    const auto = pair11 && !rowOf(absents[0].employee_id) && !extraOf(helpers[0].employee_id) ? helpers[0] : null;
    const multi = tab === 'cho' && absents.length + helpers.length > 1 && !pair11 && !r.swap;
    // 28/11: ca thuộc cặp đổi ca → người nghỉ được ghép sẵn với người đổi ca với mình (nếu chưa lưu gì)
    const autoOf = (aid) => { const hid = r.swap?.[aid]; return (hid != null && !rowOf(aid) && helpers.find((h) => h.employee_id === hid)) || auto; };
    const p1 = (saved) => (multi ? html`<div class="x2p-p1"><span class="pill ok x2p-saved" ${part && saved ? '' : 'hidden'}>Đã lưu</span><button type="button" class="btn sm secondary" data-p1>Lưu người này</button></div>` : '');
    const opts = (sel) => html`<option value="">— Không có người làm thay —</option>
      ${helpers.length ? html`<optgroup label="Người hỗ trợ phát sinh">${helpers.map((h) => html`<option value="${h.employee_id}" ${String(sel) === String(h.employee_id) ? 'selected' : ''}>${h.code} – ${h.name} (${hrs(h.hours)} giờ)</option>`)}</optgroup>` : ''}
      ${workers.length ? html`<optgroup label="Người trong lịch có làm">${workers.map((w) => html`<option value="${w.employee_id}" ${String(sel) === String(w.employee_id) ? 'selected' : ''}>${w.code} – ${w.name} (${hrs(w.hours)} giờ)</option>`)}</optgroup>` : ''}
      <option value="ngoai" ${sel === 'ngoai' ? 'selected' : ''}>Người ngoài quán…</option>`;
    return html`${absents.map((a) => { const x = rowOf(a.employee_id) || {}; const au = autoOf(a.employee_id); const hs = x.helper_id || (x.outsider ? 'ngoai' : '') || (au ? au.employee_id : '');
        return html`<div class="cv-a" data-absent="${a.employee_id}" ${r.swap?.[a.employee_id] != null ? 'data-swap' : ''}>
          <div class="cv-grid"><strong>${a.code} – ${a.name}</strong> <span class="pill off">Nghỉ</span>
            <select class="input sm cv-reason" aria-label="Lý do nghỉ của ${a.code}"><option value="">— Chọn lý do —</option>${REASONS.map(([k, l]) => html`<option value="${k}" ${x.reason === k ? 'selected' : ''}>${l}</option>`)}</select>
            <button type="button" class="btn sm secondary" data-dc title="Thực tế là đổi ca, lịch trên app chưa sửa: không trừ, không x2, khỏi duyệt">Đổi ca</button></div>
          <div class="cv-grid"><span class="st-meta">Người làm thay</span><select class="input sm cv-helper" aria-label="Người làm thay cho ${a.code}">${opts(hs)}</select>
            <input class="input sm cv-on" placeholder="Tên người ngoài quán" value="${x.outsider ? x.helper_name || x.helper || '' : ''}" ${hs === 'ngoai' ? '' : 'hidden'} aria-label="Tên người ngoài quán">
            <label class="cv-hl" ${hs ? '' : 'hidden'}>Giờ <input class="input sm cv-h" type="number" min="0" max="24" step="0.25" value="${x.hours ?? (au ? au.hours : '') ?? ''}"></label>
            <label class="cv-x2"><input type="checkbox" class="check cv-x" ${x.x2 ? 'checked' : ''}> x2</label></div>${p1(!!x.reason)}</div>`; })}
      ${helpers.filter((h) => !used.has(String(h.employee_id))).map((h) => { const x = extraOf(h.employee_id) || {};
        return html`<div class="cv-e" data-helper="${h.employee_id}"><div class="cv-grid"><strong>${h.code} – ${h.name}</strong> <span class="pill warn">Hỗ trợ</span> · ${hrs(h.hours)} giờ
          <label class="cv-x2"><input type="checkbox" class="check cv-x" ${x.x2 ? 'checked' : ''}> x2</label></div>
          <div class="st-meta">Không làm thay ai → tính là Quản lý không xếp đủ lịch (không ai bị trừ). Chọn người này làm người thay ở trên thì dòng này tự bỏ.</div>${p1(!!x.reason)}</div>`; })}
      ${absents.length > 1 ? html`<div class="st-meta">Ca có ${absents.length} người nghỉ — chọn tay người làm thay cho từng người.</div>` : ''}`;
  };
  const readOnly = (r) => html`${r.C.rows.map((x) => html`<div>
      ${x.absent ? html`<strong>${x.absent}</strong> nghỉ · ${x.reason_label}` : html`<strong>${x.helper}</strong> làm thêm · ${x.reason_label}`}
      ${x.absent && x.helper ? html`<div>Người làm thay: <strong>${x.helper}</strong>${x.outsider ? ' (người ngoài quán)' : ''} · ${hrs(x.hours)} giờ</div>` : ''}
      <div>${x.helper ? html`Đãi ngộ: <strong>${x.x2 ? 'x2 lương' : 'lương thường'}</strong>` : ''}${Number(x.deduct_hours) > 0 ? html` · <span class="x2p-err">${x.absent} bị trừ ${hrs(x.deduct_hours)} giờ</span>` : ''}</div>
      ${x.complaint_absent ? html`<div class="st-meta">Khiếu nại của người nghỉ: ${x.complaint_absent}</div>` : ''}
      ${x.complaint_helper ? html`<div class="st-meta">Khiếu nại của người làm thay: ${x.complaint_helper}</div>` : ''}
      ${x.resolved_at ? html`<div class="st-meta">Đã xem khiếu nại · ${x.resolved_by_name || ''} ${dt(x.resolved_at)}</div>` : ''}</div>`)}
    ${!r.C.rows.length ? html`<div class="st-meta">${r.absent ? `Nghỉ: ${r.absent}` : ''}${r.absent && r.helper ? ' · ' : ''}${r.helper ? `Hỗ trợ: ${r.helper}` : ''}</div>` : ''}`;
  const caHtml = (r) => {
    if (!r.C || r.C.error) return html`<div class="cv-row x2p-ca" data-id="${r.id}"><span></span><div class="x2p-body"><div class="x2p-t">${caTitle(r)}</div><div class="x2p-err">Không đọc được ca: ${r.C?.error || ''}</div></div></div>`;
    const C = r.C, ed = editable(r);
    const pill = tab === 'xong' ? html`<span class="pill ok">${String(C.ok_note || '').startsWith('Đổi ca') ? 'Đổi ca — không cần duyệt' : 'Chủ đã duyệt'}</span>${r.complaint ? html` <span class="pill off">Có khiếu nại</span>` : ''}`
      : C.state === 'lech' ? html`<span class="pill off">Nhân sự đã đổi — phân loại lại</span>` : C.state === 'cho_duyet' ? html`<span class="pill warn">Chờ Chủ duyệt</span>` : html`<span class="pill warn">Chưa phân loại</span>`;
    const pick = tab !== 'xong' && ed ? html`<input type="checkbox" class="check x2p-pick" ${ticked.has(r.id) ? 'checked' : ''} aria-label="Chọn ca ${caTitle(r)}">` : html`<span></span>`;
    return html`<div class="cv-row x2p-ca ${tab === 'xong' ? 'ok' : ''}" data-id="${r.id}">${pick}<div class="x2p-body">
      <div class="x2p-t"><a href="#/ca/doi-soat?id=${r.id}">${caTitle(r)}</a> ${pill}</div>
      ${ed ? editor(r) : readOnly(r)}
      ${C.set_at ? html`<div class="st-meta">Phân loại: ${C.set_by || ''} ${dt(C.set_at)}${C.ok_at ? html` · Chủ duyệt: ${C.ok_by || ''} ${dt(C.ok_at)}` : ''}</div>` : ''}
      ${!C.open ? html`<div class="st-meta">Tháng đã chốt — chỉ xem.</div>` : ''}
      ${tab === 'xong' && isOwner && C.open ? (editing.has(r.id)
        ? html`<div class="x2p-foot"><button type="button" class="btn sm secondary" data-undo="${r.id}">Huỷ</button><button type="button" class="btn sm" data-reok="${r.id}">Duyệt lại</button></div>`
        : html`<div class="x2p-foot"><button type="button" class="btn sm secondary" data-edit="${r.id}">Sửa</button></div>`) : ''}
      ${tab !== 'xong' && ed && !r.swap ? html`<div class="x2p-foot"><button type="button" class="btn sm" data-one="${tab === 'duyet' && isOwner ? 'ok' : 'save'}">${tab === 'duyet' && isOwner ? 'Duyệt ca này' : 'Lưu ca này'}</button></div>` : ''}
      <div class="x2p-err" hidden></div></div></div>`;
  };

  const counts = { cho: lists.cho.length, duyet: lists.duyet.length, xong: done ? done.length : '–' };
  const bulk = tab === 'cho' && canClassify && rows.length ? html`<div class="x2p-bulk"><strong>Áp cho các ca đã tích:</strong>
      <select class="input sm" id="x2p-reason" aria-label="Lý do áp hàng loạt"><option value="">— Chọn lý do —</option>${REASONS.map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
      <label class="cv-x2"><input type="checkbox" class="check" id="x2p-x"> x2</label>
      <button type="button" class="btn sm secondary" id="x2p-apply">Áp cho ca đã tích</button>
      <span class="st-meta">Chỉ điền sẵn, chưa lưu. Ca 1 người nghỉ + 1 người hỗ trợ tự ghép người làm thay.</span></div>` : '';
  const monthBar = tab === 'xong' ? html`<div class="x2p-bulk"><label class="field" style="margin:0"><span>Tháng</span><input class="input sm" type="month" id="x2p-m" value="${month}"></label>
      <span class="st-meta">Ca còn khiếu nại chưa xem hiện lên đầu.${isOwner ? ' Bấm Sửa để sửa rồi Duyệt lại.' : ' Chỉ Chủ sửa / duyệt lại được.'}</span></div>` : '';
  const foot = tab === 'xong' || !rows.length ? '' : html`<div class="x2p-foot"><span class="st-meta" id="x2p-count"></span>
      ${tab === 'cho' && canClassify ? html`<button type="button" class="btn" id="x2p-save">Lưu phân loại các ca đã tích</button>` : ''}
      ${tab === 'duyet' && canClassify && !isOwner ? html`<button type="button" class="btn" id="x2p-save">Lưu các ca đã tích</button>` : ''}
      ${tab === 'duyet' && isOwner ? html`<button type="button" class="btn" id="x2p-ok">Duyệt các ca đã tích</button>` : ''}</div>`;
  const pairHtml = (r) => { const kind = tab === 'duyet' && isOwner ? 'ok' : 'save';
    return html`<div class="x2p-pair"><div class="x2p-pt"><span>Đổi ca: ${r.swapTitle}</span><span class="st-meta">Hai ca này là một lần đổi ca — ${kind === 'ok' ? 'duyệt' : 'lưu'} một lần cho cả hai.</span></div>
      ${caHtml(r)}${caHtml(r.mate)}
      ${editable(r) || editable(r.mate) ? html`<div class="x2p-foot"><button type="button" class="btn sm" data-pairgo="${kind}">${kind === 'ok' ? 'Duyệt cả 2 ca' : 'Lưu cả 2 ca'}</button></div>` : ''}</div>`; };
  const body = () => html`${rows.length ? rows.filter((r) => !r.tail).map((r) => (r.mate ? pairHtml(r) : caHtml(r))) : html`<div class="card st-meta">${tab === 'xong' && doneErr ? `Chưa đọc được danh sách đã duyệt: ${doneErr}` : 'Không có ca nào.'}</div>`}`;

  return {
    title: 'Duyệt nghỉ & làm thay',
    html: html`${CV_CSS}${STYLE}
      <div class="page-head"><div><h1>Duyệt nghỉ & làm thay</h1><div class="sub">Quản lý tổng phân loại lý do nghỉ và đãi ngộ người làm thay (x2 hay lương thường); Chủ duyệt. Nhờ quản lý tìm người thì người nghỉ bị trừ đúng số giờ người thay làm.</div></div></div>
      <div class="stack" style="max-width:1000px;gap:12px">
        <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:center">
          <div class="x2p-tabs" role="tablist">${TABS.map(([k, l]) => html`<button type="button" class="x2p-tab" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l} <strong>${counts[k]}</strong></button>`)}</div>
          <select class="input sm" id="x2p-cn" aria-label="Cơ sở" style="width:auto"><option value="">Tất cả cơ sở</option>${branches.map(([id, name]) => html`<option value="${id}" ${id === cn ? 'selected' : ''}>${name}</option>`)}</select>
        </div>
        ${bulk}${monthBar}
        <div class="x2p-list" id="x2p-list">${body()}</div>
        ${foot}
      </div>`,
    mount(root) {
      const list = $('#x2p-list', root);
      const card = (id) => list.querySelector(`.x2p-ca[data-id="${id}"]`);
      const rowById = (id) => rows.find((r) => r.id === Number(id));
      const count = () => { const c = $('#x2p-count', root); if (c) c.textContent = `Đã tích ${ticked.size} ca`; };
      const redrawCa = (r) => { const el = card(r.id); if (el) { el.outerHTML = str(caHtml(r)); bindCa(card(r.id)); } };
      // Người làm thay đổi → hiện ô tên / giờ, giờ tự điền theo người được chọn; dòng "hỗ trợ" của người đó tự ẩn.
      function bindCa(el) {
        if (!el) return;
        const r = rowById(el.dataset.id);
        el.querySelector('.x2p-pick')?.addEventListener('change', (e) => { if (e.target.checked) ticked.add(r.id); else ticked.delete(r.id); count(); });
        $$('.cv-helper', el).forEach((s) => s.addEventListener('change', () => syncHelper(el, r, s)));
        el.querySelector('[data-edit]')?.addEventListener('click', () => { editing.add(r.id); redrawCa(r); });
        el.querySelector('[data-undo]')?.addEventListener('click', () => { editing.delete(r.id); redrawCa(r); });
        el.querySelector('[data-reok]')?.addEventListener('click', () => approveOne(r));
        el.querySelector('[data-one]')?.addEventListener('click', (e) => oneCa(r, e.currentTarget));
        $$('[data-p1]', el).forEach((b) => b.addEventListener('click', () => onePerson(r, b)));
        $$('[data-dc]', el).forEach((b) => b.addEventListener('click', () => quickSwap(r, b)));
        // Đổi ca thì không có x2 (máy chủ cũng bỏ) → khoá ô x2 của người đó
        const lockX = (box) => { const c = box.querySelector('.cv-x'), dc = box.querySelector('.cv-reason').value === 'doi_ca'; if (dc) c.checked = false; c.disabled = dc; };
        $$('.cv-a', el).forEach((box) => { lockX(box); box.querySelector('.cv-reason').addEventListener('change', () => lockX(box)); });
        // sửa lại ô của người đã lưu → bỏ nhãn "Đã lưu" (chưa lưu lại)
        $$('.cv-a, .cv-e', el).forEach((box) => box.addEventListener('change', () => { const p = box.querySelector('.x2p-saved'); if (p) p.hidden = true; }));
        const usedNow = new Set($$('.cv-a .cv-helper', el).map((x) => x.value));
        $$('.cv-e', el).forEach((e) => { e.hidden = usedNow.has(e.dataset.helper); });
      }
      function syncHelper(el, r, s) {
        const box = s.closest('.cv-a'), v = s.value;
        box.querySelector('.cv-on').hidden = v !== 'ngoai'; box.querySelector('.cv-hl').hidden = !v;
        const p = [...r.C.people, ...(r.C.workers || [])].find((x) => String(x.employee_id) === v);
        if (p?.hours != null) box.querySelector('.cv-h').value = p.hours;
        const usedNow = new Set($$('.cv-a .cv-helper', el).map((x) => x.value));
        $$('.cv-e', el).forEach((e) => { e.hidden = usedNow.has(e.dataset.helper); });
      }
      // Một người = một khung: .cv-a (người nghỉ) hoặc .cv-e (người hỗ trợ không làm thay ai)
      const itemOf = (b) => { if (b.classList.contains('cv-e')) return { absent_id: null, reason: 'thieu_lich', helper_id: Number(b.dataset.helper), x2: b.querySelector('.cv-x').checked };
        const hv = b.querySelector('.cv-helper').value;
        return { absent_id: Number(b.dataset.absent), reason: b.querySelector('.cv-reason').value, helper_id: hv && hv !== 'ngoai' ? Number(hv) : null,
          helper_name: hv === 'ngoai' ? b.querySelector('.cv-on').value.trim() : null, hours: hv ? b.querySelector('.cv-h').value : null, x2: hv ? b.querySelector('.cv-x').checked : false }; };
      const items = (el) => [...$$('.cv-a', el), ...$$('.cv-e', el).filter((e) => !e.hidden)].map(itemOf);
      // Thiếu gì thì báo ngay dòng đó (máy chủ vẫn kiểm lại).
      const problemOf = (b) => {
        if (b.classList.contains('cv-e')) return '';
        const hv = b.querySelector('.cv-helper').value;
        if (!b.querySelector('.cv-reason').value) return 'Chưa chọn lý do nghỉ.';
        if (b.querySelector('.cv-x').checked && !hv) return 'Tích x2 thì chọn người làm thay.';
        if (hv === 'ngoai' && !b.querySelector('.cv-on').value.trim()) return 'Ghi tên người ngoài quán.';
        return '';
      };
      const problem = (el) => { for (const b of $$('.cv-a', el)) { const m = problemOf(b); if (m) return m; } return ''; };
      const mark = (el, msg) => { el.classList.toggle('bad', !!msg); const e = el.querySelector('.x2p-err'); e.hidden = !msg; e.textContent = msg || ''; };
      async function run(kind) {
        const ids = [...ticked]; if (!ids.length) { flashNow('Chưa tích ca nào.', 'error'); return; }
        let ok = 0, fail = 0;
        for (const id of ids) {
          const el = card(id); if (!el) continue;
          const msg = problem(el); if (msg) { mark(el, msg + ' Ca này chưa lưu.'); fail++; continue; }
          try {
            if (kind === 'ok') await rpc('app_cv_approve', { p_id: id, p_items: items(el), p_note: '' });
            else await rpc('app_cv_save', { p_id: id, p_items: items(el) });
            ok++; mark(el, '');
          } catch (e) { mark(el, e.message); fail++; }
        }
        if (!fail) { flash(`Đã ${kind === 'ok' ? 'duyệt' : 'lưu'} ${ok} ca.${kind === 'ok' ? ' Người nghỉ và người làm thay đã được báo.' : ''}`); rerender(); return; }
        flashNow(`Đã ${kind === 'ok' ? 'duyệt' : 'lưu'} ${ok} ca · ${fail} ca báo đỏ cần sửa (xem dòng đỏ). Tải lại trang để thấy danh sách mới.`, ok ? 'warn' : 'error');
      }
      // 27/11 (anh Tiến): lưu / duyệt riêng một ca ngay tại khung của ca, không tải lại trang để các ca đang điền dở không mất.
      const bump = (k, d) => { const n = root.querySelector(`[data-tab="${k}"] strong`); if (n && /^\d+$/.test(n.textContent)) n.textContent = String(Math.max(0, Number(n.textContent) + d)); };
      // Lưu / duyệt một ca; trả về true khi máy chủ nhận. Ca rời danh sách (hoặc vẽ lại nếu vẫn ở Chờ Chủ duyệt).
      async function doCa(r, kind) {
        const el = card(r.id), msg = problem(el);
        if (msg) { mark(el, msg + ' Ca này chưa lưu.'); return false; }
        let st;
        try {
          if (kind === 'ok') st = await rpc('app_cv_approve', { p_id: r.id, p_items: items(el), p_note: '' });
          else st = await rpc('app_cv_save', { p_id: r.id, p_items: items(el) });
        } catch (e) { mark(el, e.message); return false; }
        const auto = kind === 'save' && st === 'da_duyet';   // tệp 194: ca toàn Đổi ca → xong luôn, khỏi Chủ duyệt
        if (kind === 'save' && tab === 'duyet' && !auto) {   // vẫn ở Chờ Chủ duyệt → chỉ vẽ lại khung ca
          const C = await rpc('app_cv_get', { p_id: r.id }).catch(() => null); if (C) { r.C = C; redrawCa(r); } else mark(el, '');
          return 'luu';
        }
        leave(r, auto ? 'ok' : kind); return auto ? 'doi_ca' : 'roi';
      }
      // 28/11 (anh Tiến: "đổi nhanh ở bước duyệt x2"): bấm Đổi ca ở một người → đặt lý do Đổi ca, bỏ x2, rồi lưu ca luôn.
      // Trong khung cặp đổi ca: đặt cho cả hai người đổi ca rồi lưu cả 2 ca.
      function quickSwap(r, btn) {
        const el = card(r.id), box = btn.closest('.cv-a'), wrap = el.closest('.x2p-pair');
        const set = (b) => { const s = b.querySelector('.cv-reason'); s.value = 'doi_ca'; s.dispatchEvent(new Event('change', { bubbles: true })); };
        set(box);
        if (wrap && box.hasAttribute('data-swap')) $$('.cv-a[data-swap]', wrap).forEach(set);
        const go = wrap ? wrap.querySelector('[data-pairgo]') : el.querySelector('[data-one]');
        if (go) { if (go.dataset.pairgo || go.dataset.one) go.dataset.force = 'save'; go.click(); }
      }
      // Nút nhanh Đổi ca luôn đi đường Lưu (máy chủ tự xong nếu cả ca là Đổi ca), kể cả khi nút của khung đang là Duyệt.
      const kindOf = (btn, k) => { const f = btn.dataset.force; delete btn.dataset.force; return f || k; };
      async function oneCa(r, btn) {
        const kind = kindOf(btn, btn.dataset.one); btn.disabled = true;
        const done = await doCa(r, kind); if (btn.isConnected) btn.disabled = false;
        if (!done) return;
        flashNow(done === 'doi_ca' ? `Đã ghi Đổi ca cho ca ${caTitle(r)} — xong, không cần Chủ duyệt.` : done === 'luu' ? `Đã lưu ca ${caTitle(r)}.` : kind === 'ok' ? `Đã duyệt ca ${caTitle(r)}. Người nghỉ và người làm thay đã được báo.` : `Đã lưu ca ${caTitle(r)} — chuyển sang Chờ Chủ duyệt.`, 'info');
      }
      // 28/11: cặp đổi ca — một nút cho cả hai ca. Thiếu gì ở ca nào thì báo đỏ ca đó và chưa lưu ca nào.
      async function pairGo(btn) {
        const wrap = btn.closest('.x2p-pair'), kind = kindOf(btn, btn.dataset.pairgo);
        const rs = $$('.x2p-ca', wrap).filter((el) => el.querySelector('.cv-a, .cv-e')).map((el) => rowById(el.dataset.id)).filter(Boolean);
        let bad = 0; for (const r of rs) { const el = card(r.id), msg = problem(el); mark(el, msg ? msg + ' Chưa lưu ca nào trong cặp.' : ''); if (msg) bad++; }
        if (bad || !rs.length) return;
        btn.disabled = true; let n = 0, dc = 0;
        for (const r of rs) { const d = await doCa(r, kind); if (d) n++; if (d === 'doi_ca') dc++; }
        if (btn.isConnected) btn.disabled = false;
        const verb = kind === 'ok' ? 'duyệt' : 'lưu';
        if (dc && dc === rs.length) flashNow(`Đã ghi Đổi ca cho ${dc} ca — xong, không cần Chủ duyệt.`, 'info');
        else if (n === rs.length) flashNow(`Đã ${verb} ${n} ca của lần đổi ca.${kind === 'ok' ? ' Người nghỉ và người làm thay đã được báo.' : tab === 'cho' ? ' Chuyển sang Chờ Chủ duyệt.' : ''}`, 'info');
        else flashNow(`Đã ${verb} ${n} ca · ${rs.length - n} ca báo đỏ cần sửa (xem dòng đỏ).`, n ? 'warn' : 'error');
      }
      // Ca đã lưu / duyệt xong rời danh sách của thẻ đang xem, số trên các thẻ đổi theo.
      function leave(r, kind) {
        const el = card(r.id), wrap = el?.closest('.x2p-pair');
        ticked.delete(r.id); rows.splice(rows.indexOf(r), 1); el?.remove(); count();
        if (wrap && !wrap.querySelector('.x2p-ca')) wrap.remove();
        bump(tab, -1); bump(kind === 'ok' ? 'xong' : 'duyet', 1);
        if (!rows.length) list.innerHTML = str(body());
      }
      // 27/11 (cách 2, tệp 186): lưu riêng 1 người trong ca nhiều người. Đủ người thì ca tự sang Chờ Chủ duyệt.
      async function onePerson(r, btn) {
        const el = card(r.id), box = btn.closest('.cv-a, .cv-e'), msg = problemOf(box);
        const who = box.querySelector('strong')?.textContent || 'người này';
        if (msg) { mark(el, `${who}: ${msg} Chưa lưu.`); return; }
        btn.disabled = true; let st;
        try { st = await rpc('app_cv_save_one', { p_id: r.id, p_item: itemOf(box) }); } catch (e) { mark(el, `${who}: ${e.message}`); btn.disabled = false; return; }
        btn.disabled = false; mark(el, '');
        if (st === 'da_duyet') { leave(r, 'ok'); flashNow(`Đã ghi Đổi ca cho ${who}. Ca ${caTitle(r)} xong, không cần Chủ duyệt.`, 'info'); return; }   // tệp 194
        if (st === 'cho_duyet') { leave(r, 'save'); flashNow(`Đã lưu ${who}. Ca ${caTitle(r)} đủ người — chuyển sang Chờ Chủ duyệt.`, 'info'); return; }
        const p = box.querySelector('.x2p-saved'); if (p) p.hidden = false;
        const C = await rpc('app_cv_get', { p_id: r.id }).catch(() => null);
        let left = '';
        if (C && !C.error) { r.C = C;
          const n = C.people.filter((x) => (x.kind === 'nghi' ? !C.rows.some((y) => y.absent_id === x.employee_id) : !C.rows.some((y) => y.helper_id === x.employee_id))).length;
          left = n ? ` Ca còn ${n} người chưa lưu — ca vẫn ở Chờ phân loại.` : ''; }
        flashNow(`Đã lưu ${who}.${left}`, 'info');
      }
      async function approveOne(r) {
        const el = card(r.id), msg = problem(el); if (msg) { mark(el, msg); return; }
        try { await rpc('app_cv_approve', { p_id: r.id, p_items: items(el), p_note: '' }); flash('Đã duyệt lại 1 ca. Người nghỉ và người làm thay được báo lại.'); rerender(); } catch (e) { mark(el, e.message); }
      }
      const flashNow = (m, kind) => { let n = $('#x2p-msg', root); if (!n) { n = document.createElement('div'); n.id = 'x2p-msg'; list.before(n); } n.className = `alert ${kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : 'info'}`; n.setAttribute('role', 'alert'); n.textContent = m; n.scrollIntoView({ block: 'nearest' }); };
      $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => nav({ tab: b.dataset.tab })));
      $('#x2p-cn', root)?.addEventListener('change', (e) => nav({ cn: e.target.value }));
      $('#x2p-m', root)?.addEventListener('change', (e) => nav({ thang: e.target.value }));
      $('#x2p-apply', root)?.addEventListener('click', () => {
        const reason = $('#x2p-reason', root).value, x2 = $('#x2p-x', root).checked;
        if (!reason) { flashNow('Chọn lý do trước khi áp.', 'error'); return; }
        if (!ticked.size) { flashNow('Tích các ca muốn áp trước.', 'error'); return; }
        let n = 0;
        for (const id of ticked) {
          const el = card(id), r = rowById(id); if (!el || !r?.C) continue;
          const abs = $$('.cv-a', el), helpers = r.C.people.filter((p) => p.kind === 'ho_tro');
          abs.forEach((b) => { b.querySelector('.cv-reason').value = reason; });
          if (abs.length === 1 && helpers.length === 1) { const s = abs[0].querySelector('.cv-helper'); if (!s.value) { s.value = String(helpers[0].employee_id); syncHelper(el, r, s); } }
          abs.forEach((b) => { b.querySelector('.cv-x').checked = x2 && !!b.querySelector('.cv-helper').value; });
          if (!abs.length) $$('.cv-e .cv-x', el).forEach((c) => { c.checked = x2; });
          mark(el, ''); n++;
        }
        flashNow(`Đã điền sẵn cho ${n} ca (chưa lưu). Kiểm tra lại rồi bấm Lưu phân loại.`, 'info');
      });
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-pairgo]'); if (b) pairGo(b); });
      // Cặp đổi ca: chọn lý do cho một người thì người kia (đang để trống) điền theo — vẫn sửa riêng được.
      list.addEventListener('change', (e) => { const w = e.target.matches?.('.cv-a[data-swap] .cv-reason') && e.target.closest('.x2p-pair');
        if (w) $$('.cv-a[data-swap] .cv-reason', w).forEach((s) => { if (!s.value) s.value = e.target.value; }); });
      $('#x2p-save', root)?.addEventListener('click', () => run('save'));
      $('#x2p-ok', root)?.addEventListener('click', () => run('ok'));
      $$('.x2p-ca', list).forEach(bindCa);
      count();
    },
  };
}
