// Chặng 6.2 (anh Tiến duyệt hình mẫu 23/11/2026): trang "Duyệt nghỉ & làm thay" — nhiều ca trên một trang.
// 3 thẻ: Chờ phân loại (Quản lý tổng) · Chờ Chủ duyệt · Đã duyệt (theo tháng; Chủ Sửa → Duyệt lại).
// Mỗi ca một dòng, sửa tại chỗ như khung "Nghỉ & làm thay" trong từng ca (nghi_thay.js). Áp hàng loạt chỉ điền sẵn, chưa lưu.
// Lưu / duyệt từng ca bằng app_cv_save / app_cv_approve sẵn có (quyền, cách tính x2 / trừ giờ ở máy chủ không đổi).
// 27/11: ca 1 người nghỉ + 1 người hỗ trợ tự ghép sẵn thành một khung (không có nút Lưu người này).
// 27/11: nút riêng từng ca (Lưu ca này / Duyệt ca này); ca nhiều người có nút Lưu người này (app_cv_save_one, tệp 186).
// 28/11 (anh Tiến): hai ca là một lần ĐỔI CA (A nghỉ ca mình và làm thay ở ca của B, B ngược lại) → gộp một khung,
//   ghép sẵn người làm thay, một nút Lưu cả 2 ca / Duyệt cả 2 ca. Lý do, x2 vẫn chọn tay từng lần. Chỉ ở giao diện.
// 28/11 (tệp 194): lý do "Đổi ca (lịch chưa sửa)" + nút bấm nhanh Đổi ca ở từng người nghỉ — ca toàn Đổi ca lưu xong là xong luôn, khỏi Chủ duyệt.
// 28/11 tối (anh Tiến: "thay hẳn danh sách bằng bảng này"): bảng theo ca là MẶC ĐỊNH ở hai thẻ chờ; danh sách cũ còn ở ?kieu=ds (dự phòng, đường nhỏ cuối trang).
// 29/11 (phần 2, anh Tiến chốt "có" bắt ghi lý do): sửa NHÂN SỰ của ca ngay trên bảng — nút Sửa ở từng dòng tên (có làm / nghỉ, giờ đến – về, bỏ người ngoài lịch)
//   và "+ Thêm người" cuối cột. Dùng đúng đường của trang đối soát ca: app_ca_recon_save({staff}) + lý do bắt buộc; Nhân sự đã duyệt thì bỏ duyệt trước (app_ca_check).
// 28/11 khuya (anh Tiến: "sửa trực tiếp tại bảng này luôn" — phần 1): ở bảng theo ca, ô lý do / người làm thay / x2 / Đổi ca nằm NGAY DƯỚI DÒNG TÊN của từng người
//   (bấm dòng tên để thu gọn / mở), không còn khung riêng cuối cột. Vẫn là app_cv_save / app_cv_approve của cả ca.
// 28/11 (anh Tiến): "bảng theo ca": mỗi lần một buổi (ngày + ca), mỗi cơ sở một cột hiện đủ lịch của ca
//   (✓ có làm · ✗ có lịch nhưng nghỉ · + làm ngoài lịch), người nghỉ ở cơ sở này mà làm ở cơ sở khác được tô màu; khung lưu / duyệt nằm ngay dưới cột.
//   Lịch lấy từ app_lich_thuc_te (không có quyền thì chỉ hiện các ca đang chờ). Mặc định vẫn là danh sách.
// Danh sách: app_cv_todo (chờ) + app_cv_done (đã duyệt, tệp 165); chi tiết từng ca: app_cv_get.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, dialog, flash, go, html, raw, str } from '../ui.js';
import { mergeRecon, staffPayload } from '../doi_soat_moi_tinh.js';
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
  .x2p-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; align-items: start; }
  .x2p-col { border: 1px solid var(--line); border-radius: 12px; background: var(--card); padding: 8px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .x2p-col h3 { margin: 0; font-size: 15px; display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
  .x2p-pp { display: flex; gap: 6px; align-items: baseline; padding: 2px 6px; border-radius: 6px; font-size: 14px; flex-wrap: wrap; }
  /* 28/11 (anh Tiến): XANH = quản lý đã tích có làm, hoặc nghỉ / làm thêm đã duyệt xong; ĐỎ = còn phải xử lý */
  .x2p-pp.g { background: #dcfce7; color: #166534; }
  .x2p-pp.r { background: #fee2e2; color: #b91c1c; font-weight: 600; }
  .x2p-pp .st-meta { color: inherit; opacity: .85; }
  .x2p-pp.mv { outline: 2px dashed #f59e0b; }
  .x2p-col.done .x2p-pp { background: #dcfce7; color: #166534; font-weight: 400; }
  .x2p-col h3 .pill { font-size: 12px; }
  .x2p-ic { width: 14px; text-align: center; font-weight: 700; }
  .x2p-gnav { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .x2p-gnav select.input { flex: 1 1 200px; width: auto; max-width: 320px; }
  .x2p-col .x2p-ca { grid-template-columns: minmax(0, 1fr); }
  .x2p-col .x2p-ca > span:first-child { display: none; }
  .x2p-col .x2p-ca.x2p-in { border: 0; padding: 0; background: none; }
  .x2p-in .x2p-body { gap: 4px; }
  .x2p-in .cv-a, .x2p-in .cv-e { margin: 0 0 6px 14px; padding: 6px 8px; border-left: 3px solid #f59e0b; background: #fffbeb; border-radius: 0 8px 8px 0; display: flex; flex-direction: column; gap: 6px; }
  .x2p-in .cv-a > .cv-grid:first-child > strong, .x2p-in .cv-a > .cv-grid:first-child > .pill, .x2p-in .cv-e > .cv-grid:first-child > strong, .x2p-in .cv-e > .cv-grid:first-child > .pill { display: none; }
  .x2p-in [hidden] { display: none !important; }   /* ô "hỗ trợ" tự ẩn khi người đó đã được chọn làm người thay */
  .x2p-pp[data-tg] { cursor: pointer; position: relative; padding-right: 20px; }
  .x2p-pp[data-tg]::after { content: '▾'; position: absolute; right: 6px; top: 3px; opacity: .7; }
  .x2p-fold { display: none !important; }
  .x2p-ed { margin-left: auto; border: 0; background: none; padding: 0 2px; font: inherit; font-size: 12px; text-decoration: underline; color: inherit; cursor: pointer; font-weight: 400; }
  .x2p-colfoot { display: flex; justify-content: flex-start; }
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
  const board = params.kieu !== 'ds' && tab !== 'xong';   // bảng theo ca (mặc định); ?kieu=ds = danh sách cũ
  const cn = params.cn && !board ? Number(params.cn) : null;
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
  const nav = (p) => go('/quan-ly/nghi-lam-thay?' + new URLSearchParams(Object.entries({ tab, cn: cn || '', thang: tab === 'xong' ? month : '', kieu: params.kieu === 'ds' ? 'ds' : '', ...p }).filter(([, v]) => v !== '' && v != null)).toString());
  const ticked = new Set(tab === 'duyet' ? rows.filter((r) => r.C && !r.C.error).map((r) => r.id) : []);
  const editing = new Set();

  // ---- một ca ----
  const caTitle = (r) => `${dmy(r.date)} · ${r.branch} · Ca ${r.shift}`;
  const editable = (r) => r.C && !r.C.error && r.C.open && (tab !== 'xong' ? canClassify : isOwner && editing.has(r.id));
  const editor = (r) => {
    const hd = (id, tg) => (board && r._ctx ? r._ctx.head(id, tg) : '');   // bảng theo ca: dòng tên đứng ngay trên ô xử lý của người đó
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
        return html`${hd(a.employee_id, true)}<div class="cv-a" data-absent="${a.employee_id}" ${r.swap?.[a.employee_id] != null ? 'data-swap' : ''}>
          <div class="cv-grid"><strong>${a.code} – ${a.name}</strong> <span class="pill off">Nghỉ</span>
            <select class="input sm cv-reason" aria-label="Lý do nghỉ của ${a.code}"><option value="">— Chọn lý do —</option>${REASONS.map(([k, l]) => html`<option value="${k}" ${x.reason === k ? 'selected' : ''}>${l}</option>`)}</select>
            <button type="button" class="btn sm secondary" data-dc title="Thực tế là đổi ca, lịch trên app chưa sửa: không trừ, không x2, khỏi duyệt">Đổi ca</button></div>
          <div class="cv-grid"><span class="st-meta">Người làm thay</span><select class="input sm cv-helper" aria-label="Người làm thay cho ${a.code}">${opts(hs)}</select>
            <input class="input sm cv-on" placeholder="Tên người ngoài quán" value="${x.outsider ? x.helper_name || x.helper || '' : ''}" ${hs === 'ngoai' ? '' : 'hidden'} aria-label="Tên người ngoài quán">
            <label class="cv-hl" ${hs ? '' : 'hidden'}>Giờ <input class="input sm cv-h" type="number" min="0" max="24" step="0.25" value="${x.hours ?? (au ? au.hours : '') ?? ''}"></label>
            <label class="cv-x2"><input type="checkbox" class="check cv-x" ${x.x2 ? 'checked' : ''}> x2</label></div>${p1(!!x.reason)}</div>`; })}
      ${helpers.filter((h) => !used.has(String(h.employee_id))).map((h) => { const x = extraOf(h.employee_id) || {};
        return html`${hd(h.employee_id, true)}<div class="cv-e" data-helper="${h.employee_id}"><div class="cv-grid"><strong>${h.code} – ${h.name}</strong> <span class="pill warn">Hỗ trợ</span> · ${hrs(h.hours)} giờ
          <label class="cv-x2"><input type="checkbox" class="check cv-x" ${x.x2 ? 'checked' : ''}> x2</label></div>
          <div class="st-meta">Không làm thay ai → tính là Quản lý không xếp đủ lịch (không ai bị trừ). Chọn người này làm người thay ở trên thì dòng này tự bỏ.</div>${p1(!!x.reason)}</div>`; })}
      ${helpers.filter((h) => used.has(String(h.employee_id))).map((h) => hd(h.employee_id, false))}${board && r._ctx ? r._ctx.post : ''}
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
  // Bảng theo ca: nhóm các ca theo buổi (ngày + ca). Cặp đổi ca chỉ đi chung một nút khi hai ca nằm cùng buổi đang xem.
  const gkey = (r) => `${r.date}|${r.shift}`;
  const gorder = [...new Set(allRows.map(gkey))];
  const mateOf = (r) => r.mate || rows.find((q) => q.mate === r) || null;
  const together = (r) => !!r.swap && (!board || (!!mateOf(r) && gkey(mateOf(r)) === gkey(r)));
  let gcur = gorder.includes(params.ca) ? params.ca : '';
  const rosterBy = {};   // ngày → dòng app_lich_thuc_te (null = không đọc được)
  const loadRoster = async (d) => { if (d && !(d in rosterBy)) rosterBy[d] = await rpc('app_lich_thuc_te', { p_from: d, p_to: d, p_branch: null }).catch(() => null); };
  const gkeys = () => gorder.filter((k) => rows.some((r) => gkey(r) === k));
  if (board) { if (!gkeys().includes(gcur)) gcur = gkeys()[0] || ''; await loadRoster(gcur.split('|')[0]); }
  const caHtml = (r) => {
    if (!r.C || r.C.error) return html`<div class="cv-row x2p-ca" data-id="${r.id}"><span></span><div class="x2p-body"><div class="x2p-t">${caTitle(r)}</div><div class="x2p-err">Không đọc được ca: ${r.C?.error || ''}</div></div></div>`;
    const C = r.C, ed = editable(r);
    const pill = tab === 'xong' ? html`<span class="pill ok">${String(C.ok_note || '').startsWith('Đổi ca') ? 'Đổi ca — không cần duyệt' : 'Chủ đã duyệt'}</span>${r.complaint ? html` <span class="pill off">Có khiếu nại</span>` : ''}`
      : C.state === 'lech' ? html`<span class="pill off">Nhân sự đã đổi — phân loại lại</span>` : C.state === 'cho_duyet' ? html`<span class="pill warn">Chờ Chủ duyệt</span>` : html`<span class="pill warn">Chưa phân loại</span>`;
    const pick = tab !== 'xong' && ed && !board ? html`<input type="checkbox" class="check x2p-pick" ${ticked.has(r.id) ? 'checked' : ''} aria-label="Chọn ca ${caTitle(r)}">` : html`<span></span>`;
    const inl = board && ed && !!r._ctx;   // sửa ngay tại dòng tên trong bảng theo ca
    return html`<div class="cv-row x2p-ca ${tab === 'xong' ? 'ok' : ''} ${inl ? 'x2p-in' : ''}" data-id="${r.id}">${pick}<div class="x2p-body">
      ${inl ? html`${r._ctx.pre}<div class="x2p-t">${pill} <a class="st-meta" href="#/ca/doi-soat?id=${r.id}">Mở ca</a></div>` : html`<div class="x2p-t"><a href="#/ca/doi-soat?id=${r.id}">${caTitle(r)}</a> ${pill}</div>`}
      ${ed ? editor(r) : readOnly(r)}
      ${C.set_at ? html`<div class="st-meta">Phân loại: ${C.set_by || ''} ${dt(C.set_at)}${C.ok_at ? html` · Chủ duyệt: ${C.ok_by || ''} ${dt(C.ok_at)}` : ''}</div>` : ''}
      ${!C.open ? html`<div class="st-meta">Tháng đã chốt — chỉ xem.</div>` : ''}
      ${tab === 'xong' && isOwner && C.open ? (editing.has(r.id)
        ? html`<div class="x2p-foot"><button type="button" class="btn sm secondary" data-undo="${r.id}">Huỷ</button><button type="button" class="btn sm" data-reok="${r.id}">Duyệt lại</button></div>`
        : html`<div class="x2p-foot"><button type="button" class="btn sm secondary" data-edit="${r.id}">Sửa</button></div>`) : ''}
      ${tab !== 'xong' && ed && !together(r) ? html`<div class="x2p-foot"><button type="button" class="btn sm" data-one="${tab === 'duyet' && isOwner ? 'ok' : 'save'}">${tab === 'duyet' && isOwner ? 'Duyệt ca này' : 'Lưu ca này'}</button></div>` : ''}
      <div class="x2p-err" hidden></div></div></div>`;
  };

  const counts = { cho: lists.cho.length, duyet: lists.duyet.length, xong: done ? done.length : '–' };
  const bulk = tab === 'cho' && canClassify && rows.length && !board ? html`<div class="x2p-bulk"><strong>Áp cho các ca đã tích:</strong>
      <select class="input sm" id="x2p-reason" aria-label="Lý do áp hàng loạt"><option value="">— Chọn lý do —</option>${REASONS.map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
      <label class="cv-x2"><input type="checkbox" class="check" id="x2p-x"> x2</label>
      <button type="button" class="btn sm secondary" id="x2p-apply">Áp cho ca đã tích</button>
      <span class="st-meta">Chỉ điền sẵn, chưa lưu. Ca 1 người nghỉ + 1 người hỗ trợ tự ghép người làm thay.</span></div>` : '';
  const monthBar = tab === 'xong' ? html`<div class="x2p-bulk"><label class="field" style="margin:0"><span>Tháng</span><input class="input sm" type="month" id="x2p-m" value="${month}"></label>
      <span class="st-meta">Ca còn khiếu nại chưa xem hiện lên đầu.${isOwner ? ' Bấm Sửa để sửa rồi Duyệt lại.' : ' Chỉ Chủ sửa / duyệt lại được.'}</span></div>` : '';
  const foot = tab === 'xong' || !rows.length || board ? '' : html`<div class="x2p-foot"><span class="st-meta" id="x2p-count"></span>
      ${tab === 'cho' && canClassify ? html`<button type="button" class="btn" id="x2p-save">Lưu phân loại các ca đã tích</button>` : ''}
      ${tab === 'duyet' && canClassify && !isOwner ? html`<button type="button" class="btn" id="x2p-save">Lưu các ca đã tích</button>` : ''}
      ${tab === 'duyet' && isOwner ? html`<button type="button" class="btn" id="x2p-ok">Duyệt các ca đã tích</button>` : ''}</div>`;
  const pairHtml = (r) => { const kind = tab === 'duyet' && isOwner ? 'ok' : 'save';
    return html`<div class="x2p-pair"><div class="x2p-pt"><span>Đổi ca: ${r.swapTitle}</span><span class="st-meta">Hai ca này là một lần đổi ca — ${kind === 'ok' ? 'duyệt' : 'lưu'} một lần cho cả hai.</span></div>
      ${caHtml(r)}${caHtml(r.mate)}
      ${editable(r) || editable(r.mate) ? html`<div class="x2p-foot"><button type="button" class="btn sm" data-pairgo="${kind}">${kind === 'ok' ? 'Duyệt cả 2 ca' : 'Lưu cả 2 ca'}</button></div>` : ''}</div>`; };
  const bname = (id) => (branches.find(([b]) => b === id) || [])[1] || `Cơ sở ${id}`;
  const boardHtml = () => {
    const keys = gkeys(); if (!keys.includes(gcur)) gcur = keys[0] || '';
    const [date, shift] = gcur.split('|'), rs = rows.filter((r) => gkey(r) === gcur), i = keys.indexOf(gcur);
    const ros = (rosterBy[date] || []).filter((x) => x.shift === shift);
    const bids = [...new Set([...ros.map((x) => x.branch_id), ...rs.map((r) => r.branch_id)])].sort((a, b) => a - b);
    const peopleOf = (bid) => { const L = ros.filter((x) => x.branch_id === bid);
      if (L.length) return L.map((x) => ({ id: x.employee_id, label: `${x.code} – ${x.name}`, k: !x.worked ? 'x' : x.source === 'lich' ? 'v' : 'p', hours: x.hours, reason: x.reason, x2: x.x2, rid: x.report_id }));
      const r = rs.find((q) => q.branch_id === bid); if (!r?.C || r.C.error) return [];
      return [...(r.C.workers || []).map((w) => ({ id: w.employee_id, label: `${w.code} – ${w.name}`, k: 'v', hours: w.hours, rid: r.id })),
        ...r.C.people.map((p) => ({ id: p.employee_id, label: `${p.code} – ${p.name}`, k: p.kind === 'nghi' ? 'x' : 'p', hours: p.hours, rid: r.id }))]; };
    const cols = bids.map((bid) => ({ bid, name: bname(bid), P: peopleOf(bid).sort((a, b) => 'vxp'.indexOf(a.k) - 'vxp'.indexOf(b.k)), r: rs.filter((q) => q.branch_id === bid) }));
    const at = (id, bid, ks) => cols.find((c) => c.bid !== bid && c.P.some((p) => p.id === id && ks.includes(p.k)));
    const other = (bid) => todo.find((c) => c.date === date && c.shift === shift && c.branch_id === bid && !rs.some((r) => r.id === c.id));
    // Xanh: có làm theo lịch (quản lý đã tích), hoặc ca đó đã duyệt xong nghỉ / làm thay. Đỏ: ca còn chờ phân loại / chờ Chủ duyệt.
    const pending = (bid) => rs.some((r) => r.branch_id === bid) || !!other(bid);
    const ppHtml = (p, bid, tg) => { const o = p.k === 'x' ? at(p.id, bid, ['v', 'p']) : p.k === 'p' ? at(p.id, bid, ['x']) : null;
      const green = p.k === 'v' || !pending(bid), why = green && p.k !== 'v' && p.reason ? ` · ${p.reason}${p.x2 ? ' · x2' : ''}` : '';
      return html`<div class="x2p-pp ${p.k} ${green ? 'g' : 'r'} ${o ? 'mv' : ''}" ${tg ? 'data-tg' : ''}><span class="x2p-ic">${p.k === 'v' ? '✓' : p.k === 'x' ? '✗' : '+'}</span><span>${p.label}</span>
        <span class="st-meta">${p.k === 'x' ? (o ? `nghỉ → đang làm ở ${o.name}` : 'nghỉ') : p.k === 'p' ? `làm ngoài lịch · ${hrs(p.hours)} giờ${o ? ` ← có lịch ở ${o.name}` : ''}` : `${hrs(p.hours)} giờ`}${why}</span>${canClassify && p.rid ? html`<button type="button" class="x2p-ed" data-st="${p.rid}:${p.id}" data-d="${date}">Sửa</button>` : ''}</div>`; };
    // Ca sửa được: người có làm (✓) đứng trên, mỗi người nghỉ / làm ngoài lịch có dòng tên + ô xử lý ngay dưới.
    const ctxOf = (c, r) => { const ids = new Set(r.C.people.map((p) => p.employee_id));
      return { pre: c.P.filter((p) => p.k === 'v').map((p) => ppHtml(p, c.bid)), post: c.P.filter((p) => p.k !== 'v' && !ids.has(p.id)).map((p) => ppHtml(p, c.bid)),
        head: (id, tg) => { let p = c.P.find((q) => q.id === id && q.k !== 'v');
          if (!p) { const q = r.C.people.find((z) => z.employee_id === id); p = q ? { id, label: `${q.code} – ${q.name}`, k: q.kind === 'nghi' ? 'x' : 'p', hours: q.hours, rid: r.id } : null; }
          return p ? ppHtml(p, c.bid, tg) : ''; } }; };
    const ridOf = (c) => (c.r[0] && c.r[0].id) || (c.P.find((p) => p.rid) || {}).rid || null;   // mã ca của cột (để thêm người)
    const kind = tab === 'duyet' && isOwner ? 'ok' : 'save';
    const bars = rs.filter((r) => r.mate && rs.includes(r.mate));
    return html`<div class="x2p-gnav">
        <button type="button" class="btn sm secondary" data-g="${keys[i - 1] || ''}" ${i > 0 ? '' : 'disabled'} aria-label="Buổi trước">◀</button>
        <select class="input sm" id="x2p-g" aria-label="Chọn buổi">${keys.map((k) => { const [d, s] = k.split('|'); return html`<option value="${k}" ${k === gcur ? 'selected' : ''}>${dmy(d)} · Ca ${s} (${rows.filter((r) => gkey(r) === k).length} ca)</option>`; })}</select>
        <button type="button" class="btn sm secondary" data-g="${keys[i + 1] || ''}" ${i < keys.length - 1 ? '' : 'disabled'} aria-label="Buổi sau">▶</button>
        <span class="st-meta">Buổi ${i + 1} / ${keys.length} · <span class="x2p-pp g" style="display:inline">xanh</span> có làm / đã duyệt xong · <span class="x2p-pp r" style="display:inline">đỏ</span> còn phải xử lý · ✓ có làm · ✗ có lịch nhưng nghỉ · + làm ngoài lịch · viền vàng: nghỉ ở cơ sở này nhưng làm ở cơ sở khác cùng ca</span></div>
      ${rosterBy[date] === null ? html`<div class="alert warn">Chưa đọc được lịch đầy đủ của các cơ sở — chỉ hiện các ca đang chờ.</div>` : ''}
      <div class="x2p-board">${cols.map((c) => html`<div class="x2p-col" data-col="${c.bid}"><h3>${c.name}
          ${c.r.length ? html`<span class="pill off">Cần xử lý</span>` : other(c.bid) ? html`<span class="pill off">${other(c.bid).state === 'cho_duyet' ? 'Đang ở thẻ Chờ Chủ duyệt' : 'Đang ở thẻ Chờ phân loại'}</span>`
            : html`<span class="pill ok">${c.P.some((p) => p.k !== 'v') ? 'Đã xử lý xong' : 'Đủ người theo lịch'}</span>`}</h3>
          ${c.r.some(editable) ? '' : c.P.length ? c.P.map((p) => ppHtml(p, c.bid)) : html`<div class="st-meta">Chưa có danh sách nhân sự.</div>`}
          ${c.r.map((r) => { r._ctx = editable(r) ? ctxOf(c, r) : null; return caHtml(r); })}
          ${canClassify && ridOf(c) ? html`<div class="x2p-colfoot"><button type="button" class="btn sm secondary" data-stadd="${ridOf(c)}" data-d="${date}">+ Thêm người</button></div>` : ''}</div>`)}</div>
      ${bars.map((r) => html`<div class="x2p-pair x2p-bar"><div class="x2p-pt"><span>Đổi ca: ${r.swapTitle}</span><span class="st-meta">Hai ca ${bname(r.branch_id)} và ${bname(r.mate.branch_id)} là một lần đổi ca — ${kind === 'ok' ? 'duyệt' : 'lưu'} một lần cho cả hai.</span></div>
        <div class="x2p-foot"><button type="button" class="btn sm" data-pairgo="${kind}" data-ids="${r.id} ${r.mate.id}">${kind === 'ok' ? 'Duyệt cả 2 ca' : 'Lưu cả 2 ca'}</button></div></div>`)}`;
  };
  const body = () => html`${board && rows.length ? boardHtml() : rows.length ? rows.filter((r) => !r.tail).map((r) => (r.mate ? pairHtml(r) : caHtml(r))) : html`<div class="card st-meta">${tab === 'xong' && doneErr ? `Chưa đọc được danh sách đã duyệt: ${doneErr}` : 'Không có ca nào.'}</div>`}`;

  return {
    title: 'Duyệt nghỉ & làm thay',
    html: html`${CV_CSS}${STYLE}
      <div class="page-head"><div><h1>Duyệt nghỉ & làm thay</h1><div class="sub">Quản lý tổng phân loại lý do nghỉ và đãi ngộ người làm thay (x2 hay lương thường); Chủ duyệt. Nhờ quản lý tìm người thì người nghỉ bị trừ đúng số giờ người thay làm.</div></div></div>
      <div class="stack" style="max-width:${board ? 1500 : 1000}px;gap:12px">
        <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:center">
          <div class="x2p-tabs" role="tablist">${TABS.map(([k, l]) => html`<button type="button" class="x2p-tab" role="tab" aria-selected="${k === tab}" data-tab="${k}">${l} <strong>${counts[k]}</strong></button>`)}</div>
          <select class="input sm" id="x2p-cn" aria-label="Cơ sở" style="width:auto" ${board ? 'hidden' : ''}><option value="">Tất cả cơ sở</option>${branches.map(([id, name]) => html`<option value="${id}" ${id === cn ? 'selected' : ''}>${name}</option>`)}</select>
        </div>
        ${bulk}${monthBar}
        <div class="x2p-list" id="x2p-list">${body()}</div>
        ${foot}
        ${tab !== 'xong' ? html`<div class="st-meta" style="text-align:right"><button type="button" class="btn sm secondary" id="x2p-kieu">${board ? 'Xem dạng danh sách cũ' : 'Về bảng theo ca'}</button></div>` : ''}
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
        $$('.x2p-pp[data-tg]', el).forEach((h) => h.addEventListener('click', (e) => { if (e.target.closest('[data-st]')) return; h.nextElementSibling?.classList.toggle('x2p-fold'); }));   // bấm dòng tên: thu gọn / mở ô xử lý
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
        const bar = wrap ? wrap.querySelector('[data-pairgo]') : list.querySelector(`[data-pairgo][data-ids~="${r.id}"]`);   // bảng theo ca: nút cặp nằm dưới bảng
        if (bar && box.hasAttribute('data-swap')) (wrap ? $$('.cv-a[data-swap]', wrap) : bar.dataset.ids.split(' ').flatMap((id) => $$('.cv-a[data-swap]', card(id) || document.createElement('div')))).forEach(set);
        const go = bar || el.querySelector('[data-one]');
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
        const els = btn.dataset.ids ? btn.dataset.ids.split(' ').map((id) => card(id)).filter(Boolean) : $$('.x2p-ca', wrap);
        const rs = els.filter((el) => el.querySelector('.cv-a, .cv-e')).map((el) => rowById(el.dataset.id)).filter(Boolean);
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
        { const col = el?.closest('.x2p-col'); if (col) $$('.x2p-pp', el).forEach((p) => { p.removeAttribute('data-tg'); col.appendChild(p); });   // giữ lại các dòng tên trong cột
          if (col && kind === 'ok') { col.classList.add('done'); const p = col.querySelector('h3 .pill'); if (p) { p.className = 'pill ok'; p.textContent = 'Đã xử lý xong'; } }   // bảng theo ca: duyệt xong → cả cột xanh
          else if (col) { const p = col.querySelector('h3 .pill'); if (p) p.textContent = 'Đang ở thẻ Chờ Chủ duyệt'; } }
        ticked.delete(r.id); rows.splice(rows.indexOf(r), 1); el?.remove(); count();
        if (wrap && !wrap.querySelector('.x2p-ca')) wrap.remove();
        bump(tab, -1); bump(kind === 'ok' ? 'xong' : 'duyet', 1);
        if (!rows.length) { list.innerHTML = str(body()); return; }
        if (board) {
          $$('[data-ids]', list).forEach((b) => { if (!b.dataset.ids.split(' ').some((id) => card(id))) b.closest('.x2p-bar')?.remove(); });
          if (!list.querySelector('.x2p-ca')) { const keys = gkeys(); gcur = keys.find((k) => gorder.indexOf(k) > gorder.indexOf(gcur)) || keys[0] || ''; drawBoard(); }   // buổi này xong → sang buổi kế
        }
      }
      async function drawBoard() { await loadRoster(gcur.split('|')[0]); list.innerHTML = str(body()); $$('.x2p-ca', list).forEach(bindCa); }
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
      $('#x2p-kieu', root)?.addEventListener('click', () => nav({ kieu: board ? 'ds' : '', cn: '' }));
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b && b.dataset.g) { gcur = b.dataset.g; drawBoard(); } });
      list.addEventListener('change', (e) => { if (e.target.id === 'x2p-g') { gcur = e.target.value; drawBoard(); } });
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
      // ---- 29/11 phần 2: sửa nhân sự của ca ngay trên bảng (đường của trang đối soát ca, lý do bắt buộc) ----
      const hm = (x) => (x ? String(x).slice(0, 5) : '');
      const isW = (z) => !(z.worked === 0 || z.worked === false);
      // Phải đọc được BẢN ĐỐI SOÁT của ca (nhân sự quản lý đã sửa). Không đọc được (vd ca đang chờ kế toán) thì KHÔNG cho sửa ở đây —
      // nếu lấy tạm phiếu gốc rồi lưu sẽ ghi đè mất các chỗ quản lý đã sửa.
      const loadCa = async (rid) => { const [R0, RC] = await Promise.all([rpc('app_ca_get', { p_id: rid }), rpc('app_ca_recon', { p_id: rid })]); return mergeRecon(R0, RC); };
      const stForm = (title, inner, extra = '') => {
        const d = dialog(str(html`<form class="stack" style="gap:10px;max-width:460px"><h2 style="margin:0">${title}</h2>${inner}
          <label class="field"><span>Lý do sửa (bắt buộc)</span><input class="input" name="reason" autocomplete="off"></label><div class="x2p-err x2p-derr"></div>
          <div class="toolbar" style="justify-content:flex-end;flex-wrap:wrap">${extra}<button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`));
        d.querySelector('[data-x]')?.addEventListener('click', () => d.close());
        return d;
      };
      const stRun = async (d, fn) => { const b = d.querySelector('[type=submit]'); if (b) b.disabled = true; try { await fn(); d.close(); } catch (e) { if (b) b.disabled = false; d.querySelector('.x2p-derr').textContent = e.message || String(e); } };
      const stReason = (f) => { const v = (f.reason?.value || '').trim(); if (!v) throw new Error('Ghi lý do sửa (bắt buộc).'); return v; };
      const stSave = async (R, listNew, reason, date) => {
        if ((R.checks || {}).nhan_su) await rpc('app_ca_check', { p_id: R.id, p_item: 'nhan_su', p_on: false });   // Nhân sự đã duyệt → bỏ duyệt trước, như trang đối soát ca
        await rpc('app_ca_recon_save', { p_id: R.id, p: { staff: listNew }, p_reason: reason });
        await refreshCa(R.id, date);
        flashNow(`Đã lưu nhân sự của ca.${(R.checks || {}).nhan_su ? ' Phần Nhân sự của ca đã bị bỏ duyệt — duyệt lại ở trang của ca.' : ''}`, 'info');
      };
      const stOpen = async (rid) => { let R; try { R = await loadCa(rid); } catch (e) { flashNow(`Chưa sửa được nhân sự của ca này tại bảng: ${e.message || String(e)}`, 'error'); return null; }
        if (R.recon_status === 'hoan_thanh') { flashNow('Ca này đã Hoàn thành đối soát — vào trang của ca bấm Mở lại rồi mới sửa nhân sự.', 'error'); return null; }
        return R; };
      const stNote = (R) => ((R.checks || {}).nhan_su ? html`<div class="st-meta">Nhân sự của ca này đã được duyệt — sửa thì web tự bỏ duyệt Nhân sự, cần duyệt lại ở trang của ca.</div>` : '');
      async function staffEdit(rid, eid, date) {
        const R = await stOpen(rid); if (!R) return;
        const i = (R.staff || []).findIndex((z) => Number(z.employee_id) === Number(eid)); if (i < 0) { flashNow('Không thấy người này trong ca (tải lại trang).', 'error'); return; }
        const z = R.staff[i], w = isW(z), ref = (R.staff || []).find((q) => isW(q) && q.time_in && q.time_out) || {};
        const d = stForm(`${z.code ? z.code + ' – ' : ''}${z.name || 'NV ' + z.employee_id}`, html`
          <label class="field"><span>Đi làm</span><select class="input" name="worked"><option value="1" ${w ? raw('selected') : ''}>Có làm</option><option value="0" ${w ? '' : raw('selected')}>Phát sinh nghỉ</option></select></label>
          <div class="cv-grid" data-w="1"><label class="field" style="flex:1"><span>Giờ đến</span><input class="input" type="time" name="in" value="${hm(z.time_in) || hm(ref.time_in)}"></label><label class="field" style="flex:1"><span>Giờ về</span><input class="input" type="time" name="out" value="${hm(z.time_out) || hm(ref.time_out)}"></label></div>
          <label class="field" data-w="0"><span>Lý do nghỉ</span><input class="input" name="absent" value="${z.absent_reason || ''}"></label>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${z.note || ''}"></label>${stNote(R)}`,
          z.source && z.source !== 'lich' ? html`<button type="button" class="btn sm secondary danger" data-del style="margin-right:auto">Bỏ người này</button>` : '');
        const f = d.querySelector('form'), L = () => (R.staff || []).map(staffPayload);
        const sync = () => { const on = f.worked.value === '1'; f.querySelectorAll('[data-w]').forEach((x) => { x.hidden = x.dataset.w !== (on ? '1' : '0'); }); };
        f.worked.addEventListener('change', sync); sync();
        d.querySelector('[data-del]')?.addEventListener('click', () => stRun(d, async () => { const why = stReason(f); await stSave(R, L().filter((_, k) => k !== i), why, date); }));
        f.addEventListener('submit', (ev) => { ev.preventDefault(); stRun(d, async () => {
          const why = stReason(f), on = f.worked.value === '1';
          if (on && (!f.elements.in.value || !f.elements.out.value)) throw new Error('Nhập giờ đến và giờ về.');
          if (!on && !f.absent.value.trim()) throw new Error('Ghi lý do nghỉ.');
          const N = L();
          N[i] = { ...N[i], worked: on, time_in: on ? f.elements.in.value : null, time_out: on ? f.elements.out.value : null, absent_reason: on ? null : f.absent.value.trim(), note: f.note.value.trim() || null, cash_paid: on ? N[i].cash_paid : null };
          await stSave(R, N, why, date); }); });
      }
      async function staffAdd(rid, date) {
        const R = await stOpen(rid); if (!R) return;
        let emps = []; try { emps = (await rpc('app_ca_employees')) || []; } catch (e) { flashNow(e.message || String(e), 'error'); return; }
        const have = new Set((R.staff || []).map((z) => Number(z.employee_id))), ref = (R.staff || []).find((q) => isW(q) && q.time_in && q.time_out) || {};
        const d = stForm('Thêm người vào ca', html`<label class="field"><span>Nhân viên</span><select class="input" name="emp"><option value="">— Chọn nhân viên —</option>${emps.filter((e) => !have.has(Number(e.id))).map((e) => html`<option value="${e.id}">${e.code ? e.code + ' – ' : ''}${e.name || ''}</option>`)}</select></label>
          <div class="cv-grid"><label class="field" style="flex:1"><span>Giờ đến</span><input class="input" type="time" name="in" value="${hm(ref.time_in)}"></label><label class="field" style="flex:1"><span>Giờ về</span><input class="input" type="time" name="out" value="${hm(ref.time_out)}"></label></div>
          <label class="field"><span>Ghi chú</span><input class="input" name="note"></label><div class="st-meta">Người thêm ở đây tính là người hỗ trợ / làm ngoài lịch của ca.</div>${stNote(R)}`);
        const f = d.querySelector('form');
        f.addEventListener('submit', (ev) => { ev.preventDefault(); stRun(d, async () => {
          if (!f.emp.value) throw new Error('Chọn nhân viên.'); if (!f.elements.in.value || !f.elements.out.value) throw new Error('Nhập giờ đến và giờ về.');
          const why = stReason(f);
          await stSave(R, [...(R.staff || []).map(staffPayload), staffPayload({ employee_id: f.emp.value, source: 'ho_tro', worked: 1, time_in: f.elements.in.value, time_out: f.elements.out.value, note: f.note.value })], why, date); }); });
      }
      // Sau khi sửa nhân sự: đọc lại danh sách chờ + chi tiết ca đó + lịch của ngày, rồi vẽ lại bảng (không tải lại cả trang).
      async function refreshCa(id, date) {
        const [td, C] = await Promise.all([rpc('app_cv_todo').catch(() => null), rpc('app_cv_get', { p_id: id }).catch((e) => ({ error: e.message }))]);
        delete rosterBy[date];
        if (td) { todo.splice(0, todo.length, ...td);
          const setN = (k, v) => { const n = root.querySelector(`[data-tab="${k}"] strong`); if (n) n.textContent = String(v); };
          setN('cho', td.filter((c) => c.state !== 'cho_duyet').length); setN('duyet', td.filter((c) => c.state === 'cho_duyet').length); }
        const t = todo.find((c) => c.id === id), i = rows.findIndex((q) => q.id === id), inTab = t && (tab === 'duyet') === (t.state === 'cho_duyet');
        if (inTab) { if (i >= 0) Object.assign(rows[i], t, { C }); else { rows.push({ ...t, C }); if (!gorder.includes(gkey(t))) gorder.push(gkey(t)); } }
        else if (i >= 0) rows.splice(i, 1);
        await drawBoard();
      }
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'), a = e.target.closest('[data-stadd]');
        if (b) { const [rid, eid] = b.dataset.st.split(':').map(Number); staffEdit(rid, eid, b.dataset.d); } else if (a) staffAdd(Number(a.dataset.stadd), a.dataset.d); });
      $('#x2p-save', root)?.addEventListener('click', () => run('save'));
      $('#x2p-ok', root)?.addEventListener('click', () => run('ok'));
      $$('.x2p-ca', list).forEach(bindCa);
      count();
    },
  };
}
