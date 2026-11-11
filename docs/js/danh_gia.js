// Đánh giá nhân viên (chốt 11/11/2026): trừ điểm theo 20 tiêu chí của bộ Pha chế / Chạy bàn, tính theo tháng (đầu tháng 100 điểm).
// Dùng chung: trang Đánh giá nhân viên, bước Nhân sự của trang Đối soát ca, trang Điểm của tôi.
import { rpc, sb } from './sb.js';
import { compressImage, dmy, dt } from './tien.js';
import { $, $$, dialog, html, str } from './ui.js';

export const DG_BUCKET = 'phieu-ca';
export const RATINGS = [[91, 'Xuất sắc', 'ok'], [80, 'Tốt', 'ok'], [65, 'Khá', 'info'], [50, 'Trung bình', 'warn'], [0, 'Yếu', 'bad']];
export const rating = (s) => RATINGS.find(([m]) => Number(s) >= m) || RATINGS[RATINGS.length - 1];
export const ptsLabel = (p) => (Number(p) === 0 ? 'Nhắc nhở' : `−${p} điểm`);
export const monthLabel = (m) => (m ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : '');
const STATUS = { tru: '', hoan: 'Đã hoàn điểm' };

export const DG_CSS = html`<style>
  .pill.info { background: var(--info-bg); color: var(--info-ink); }
  .pill.bad { background: #fee2e2; color: #b91c1c; }
  .dg-score { font-size: 26px; font-weight: 800; line-height: 1.1; }
  .dg-mk { border: 1px solid var(--line-soft); border-left: 4px solid #f59e0b; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .dg-mk.warn0 { border-left-color: #94a3b8; }
  .dg-mk.hoan { opacity: .65; border-left-color: var(--ok-line); }
  .dg-mk.same { background: #fff7ed; border-color: #fdba74; }
  .dg-mk .top { display: flex; gap: 6px; flex-wrap: wrap; align-items: baseline; justify-content: space-between; }
  .dg-mk .pts { font-weight: 800; color: #b91c1c; white-space: nowrap; }
  .dg-mk.warn0 .pts { color: var(--ink-2); }
  .dg-rep { background: var(--line-soft); border-radius: 8px; padding: 6px 8px; font-size: 13px; }
  .dg-nth { font-size: 12px; font-weight: 700; color: #c2410c; }
  .dg-acts { display: flex; gap: 6px; flex-wrap: wrap; }
  .dg-pts { display: flex; gap: 6px; flex-wrap: wrap; }
  .dg-pts label { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .dg-pts label:has(input:checked) { border-color: var(--primary); background: var(--info-bg); color: var(--primary); }
  dialog.dg-dlg { width: calc(100vw - 16px); max-width: 720px; max-height: 92vh; padding: 0; border: 0; border-radius: 14px; overflow: hidden; }
  dialog.dg-dlg::backdrop { background: rgba(15, 23, 42, .55); }
  .dg-in { display: flex; flex-direction: column; max-height: 92vh; }
  .dg-in > header { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; background: var(--subtle, #f3f4f6); }
  .dg-in > .dg-scroll { overflow-y: auto; padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
  .dg-sum { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
  .dg-photo { max-width: 160px; border-radius: 8px; display: block; }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
</style>`;

// Lần đánh giá → HTML. opt: { nth: số lần cùng tiêu chí (tới lần này), same, acts: hiện nút quản lý, mine: trang nhân viên }
export function markCard(m, opt = {}) {
  const cls = m.status === 'hoan' ? 'hoan' : Number(m.points) === 0 ? 'warn0' : '';
  return html`<div class="dg-mk ${cls} ${opt.same ? 'same' : ''}" data-id="${m.id}" data-crit="${m.criterion}">
    <div class="top"><strong>${m.criterion_name}</strong><span class="pts">${ptsLabel(m.points)}</span></div>
    <div class="st-meta">${dmy(m.date)}${m.shift ? ` · ca ${m.shift}` : ''}${m.branch ? ` ${m.branch}` : ''} · ${m.created_by || ''}
      ${opt.nth ? html` · <span class="dg-nth">lần thứ ${opt.nth} ở tiêu chí này</span>` : ''}</div>
    <div>${m.note}</div>
    ${m.photo ? html`<img class="dg-photo" data-photo="${m.photo}" alt="Ảnh kèm lỗi">` : ''}
    ${m.reply ? html`<div class="dg-rep"><span class="st-meta">${opt.mine ? 'Bạn' : 'Nhân viên'} giải trình ${dt(m.reply_at)}:</span> ${m.reply}</div>` : ''}
    ${m.reviewed_at ? html`<div class="st-meta">${m.status === 'hoan' ? 'Đã hoàn điểm' : 'Giữ nguyên'} · ${m.reviewed_by || ''} ${dt(m.reviewed_at)}${m.review_note ? ` · ${m.review_note}` : ''}</div>`
      : m.status === 'hoan' ? html`<div class="st-meta">${STATUS.hoan}</div>` : ''}
    ${opt.acts && m.open ? html`<div class="dg-acts">
        ${m.pending ? html`<button type="button" class="btn sm dg-keep">Giữ điểm</button><button type="button" class="btn sm secondary dg-refund">Hoàn điểm</button>` : ''}
        ${m.status === 'tru' && !m.pending ? html`<button type="button" class="btn sm secondary dg-refund">Hoàn điểm</button>` : ''}
        <button type="button" class="btn sm secondary dg-edit">Sửa</button><button type="button" class="btn sm secondary danger dg-del">Xóa</button></div>`
      : opt.acts && !m.open ? html`<div class="st-meta">Tháng ${monthLabel(m.month)} đã khóa — nhờ Chủ mở lại nếu cần sửa.</div>` : ''}
  </div>`;
}

export async function fillPhotos(root) {
  const imgs = $$('img[data-photo]', root);
  if (!imgs.length) return;
  try {
    const { data } = await sb.storage.from(DG_BUCKET).createSignedUrls([...new Set(imgs.map((i) => i.dataset.photo))], 3600);
    const u = new Map((data || []).map((d) => [d.path, d.signedUrl]));
    imgs.forEach((i) => { if (u.get(i.dataset.photo)) i.src = u.get(i.dataset.photo); });
  } catch (_) { /* bỏ qua */ }
}

// Tính "lần thứ mấy" cùng tiêu chí (theo thời gian, không tính lần đã hoàn điểm)
function nthMap(marks) {
  const res = new Map(); const cnt = {};
  [...marks].filter((m) => m.status === 'tru').sort((a, b) => (a.date + String(a.id).padStart(9, '0')).localeCompare(b.date + String(b.id).padStart(9, '0')))
    .forEach((m) => { cnt[m.criterion] = (cnt[m.criterion] || 0) + 1; res.set(m.id, cnt[m.criterion]); });
  return res;
}

/**
 * Mở khung đánh giá 1 nhân viên: lịch sử toàn bộ (mới nhất ở trên) + form trừ điểm / nhắc nhở.
 * ctx: { report: {id, date, shift, branch} | null, month: 'YYYY-MM' (trang Đánh giá), onChange() }
 */
export async function openEmployee(empId, ctx = {}) {
  let H;
  try { H = await rpc('app_dg_history', { p_employee: empId }); } catch (e) { alert(e.message); return; }
  const d = dialog(html`<div class="dg-in"></div>`);
  d.classList.add('dg-dlg');
  let editing = null; let changed = false;
  let done = false;
  const finish = () => { if (done) return; done = true; if (d.open) d.close(); d.remove(); if (changed) ctx.onChange?.(); };
  d.addEventListener('close', finish);      // phím Esc
  const openMonth = (mo) => {
    if ((H.open_months || []).includes(mo)) return true;
    const [y, m] = mo.split('-').map(Number); const nx = new Date(Date.UTC(y, m, 5)).toISOString().slice(0, 10);
    return H.today <= nx;
  };
  const defDate = () => {
    if (ctx.month && ctx.month !== H.today.slice(0, 7)) { const [y, m] = ctx.month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
    return H.today;
  };

  function draw(keepForm) {
    const E = H.employee; const marks = H.marks; const nth = nthMap(marks);
    const old = keepForm ? collect() : null;
    const set = E.set_saved ? E.set_code : '';
    const crits = H.criteria.filter((c) => c.set_code === set);
    const mon = (old?.date || (ctx.report ? ctx.report.date : defDate())).slice(0, 7);
    const used = {}; marks.filter((m) => m.status === 'tru' && m.month === mon && (!editing || m.id !== editing.id)).forEach((m) => { used[m.criterion] = (used[m.criterion] || 0) + Number(m.points); });
    const score = 100 - Object.values(used).reduce((s, v) => s + Math.min(5, v), 0);
    const inMon = marks.filter((m) => m.month === H.month && m.status === 'tru');
    const sel = old?.crit || editing?.criterion || '';
    const r = rating(H.score);
    const ed = editing;
    const pts = old?.pts ?? (ed ? String(ed.points) : '');
    $('.dg-in', d).innerHTML = str(html`<header><div><div class="st-meta">Đánh giá nhân viên</div><strong style="font-size:17px">${E.code} – ${E.name}</strong>
        <div class="st-meta">${E.rank || ''}</div></div><button type="button" class="btn sm secondary dg-x" aria-label="Đóng">✕</button></header>
      <div class="dg-scroll">
        <div class="dg-sum"><div><div class="st-meta">Tháng ${monthLabel(H.month)}</div><span class="dg-score">${H.score}</span><span class="st-meta">/100</span></div>
          <span class="pill ${r[2]}">${r[1]}</span>
          <span class="st-meta">${inMon.filter((m) => m.points > 0).length} lần trừ · ${inMon.filter((m) => Number(m.points) === 0).length} nhắc nhở trong tháng · ${marks.length} lần từ trước tới nay</span></div>
        ${E.is_me ? html`<div class="alert warn">Bạn không tự trừ điểm của mình được.</div>` : html`<form class="card stack dg-form" style="gap:10px;padding:12px">
          <strong>${ed ? `Sửa lần đánh giá ngày ${dmy(ed.date)}` : 'Trừ điểm / nhắc nhở'}</strong>
          ${ed ? '' : html`<label class="field"><span>Bộ tiêu chí của nhân viên <span class="st-meta">(mỗi người một bộ, chọn một lần — đổi ở đây là đổi luôn)</span></span>
            <select class="input dg-setsel" name="set">${E.set_saved ? '' : html`<option value="" selected>— Chọn Pha chế hoặc Chạy bàn${E.set_code ? ` (gợi ý: ${(H.sets.find((s) => s.code === E.set_code) || {}).name})` : ''} —</option>`}${H.sets.map((s) => html`<option value="${s.code}" ${s.code === set ? 'selected' : ''}>${s.name}</option>`)}</select></label>`}
          ${ed || ctx.report ? html`<div class="st-meta">${ed ? `Ngày ${dmy(ed.date)}` : `Ca ${ctx.report.shift} ${ctx.report.branch || ''} · ${dmy(ctx.report.date)}`}</div>`
            : html`<label class="field"><span>Ngày phạm lỗi</span><input class="input" type="date" name="date" value="${old?.date || defDate()}" max="${H.today}"></label>`}
          <label class="field"><span>Tiêu chí</span><select class="input" name="crit" ${!ed && !set ? 'disabled' : ''}><option value="">${!ed && !set ? '— Chọn bộ tiêu chí ở trên trước —' : '— Chọn tiêu chí —'}</option>
            ${(ed ? H.criteria.filter((c) => c.set_code === H.criteria.find((x) => x.code === ed.criterion)?.set_code) : crits).map((c) => html`<option value="${c.code}" ${c.code === sel ? 'selected' : ''}>${c.name} (còn ${Math.max(0, 5 - (used[c.code] || 0))}/5)</option>`)}</select></label>
          <div class="field"><span>Mức</span><div class="dg-pts" role="radiogroup" aria-label="Mức trừ">${['0', '1', '2', '3', '4', '5'].map((v) => html`<label><input type="radio" name="pts" value="${v}" ${pts === v ? 'checked' : ''}> ${v === '0' ? 'Nhắc nhở' : '−' + v}</label>`)}</div></div>
          <label class="field"><span>Lỗi gì (bắt buộc)</span><textarea class="input" name="note" rows="2" placeholder="vd: Đi muộn 15 phút, không báo trước">${old?.note ?? (ed ? ed.note : '')}</textarea></label>
          ${ed ? '' : html`<label class="field"><span>Ảnh (không bắt buộc)</span><input class="input" type="file" name="photo" accept="image/*"></label>`}
          <div class="st-meta">Điểm tháng ${monthLabel(mon)} hiện ${score}/100. Mỗi tiêu chí trừ tối đa 5 điểm.</div>
          <div id="dg-err"></div>
          <div class="toolbar" style="justify-content:flex-end;gap:6px">${ed ? html`<button type="button" class="btn sm secondary dg-cancel">Hủy sửa</button>` : ''}<button class="btn sm" type="submit">${ed ? 'Lưu sửa' : 'Ghi đánh giá'}</button></div>
        </form>`}
        <div class="stack" style="gap:8px"><strong>Lịch sử trừ điểm / nhắc nhở (${marks.length})</strong>
          ${marks.length ? marks.map((m) => markCard(m, { nth: m.status === 'tru' ? nth.get(m.id) : 0, same: sel && m.criterion === sel, acts: true }))
            : html`<div class="st-meta">Chưa bị trừ điểm hay nhắc nhở lần nào.</div>`}</div>
      </div>`);
    fillPhotos(d);
  }
  function collect() {
    const f = $('.dg-form', d); if (!f) return null;
    return { set: f.set?.value, date: f.date?.value, crit: f.crit?.value, pts: f.querySelector('input[name=pts]:checked')?.value, note: f.note?.value };
  }
  async function reload() { H = await rpc('app_dg_history', { p_employee: empId }); changed = true; }
  const err = (m) => { const x = $('#dg-err', d); if (x) x.innerHTML = str(html`<div class="alert error">${m}</div>`); };

  d.addEventListener('change', async (ev) => {
    if (ev.target.name === 'set') {
      if (!ev.target.value) return;
      ev.target.disabled = true;
      try { await rpc('app_dg_set', { p_employee: empId, p_set: ev.target.value }); await reload(); draw(true); }
      catch (e2) { err(e2.message); ev.target.disabled = false; }
      return;
    }
    if (ev.target.name === 'crit' || ev.target.name === 'date') draw(true);
  });
  d.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('.dg-x')) { finish(); return; }
    if (t.closest('.dg-cancel')) { editing = null; draw(false); return; }
    const card = t.closest('.dg-mk'); if (!card) return;
    const m = H.marks.find((x) => String(x.id) === card.dataset.id); if (!m) return;
    try {
      if (t.closest('.dg-edit')) { editing = m; draw(false); $('.dg-form', d)?.scrollIntoView({ block: 'start' }); return; }
      if (t.closest('.dg-del')) { if (!confirm('Xóa lần đánh giá này? Nhân viên sẽ được báo.')) return; await rpc('app_dg_delete', { p_id: m.id, p_note: null }); }
      else if (t.closest('.dg-keep')) { const n = prompt('Giữ nguyên điểm. Ghi chú cho nhân viên (không bắt buộc):', ''); if (n === null) return; await rpc('app_dg_resolve', { p_id: m.id, p_keep: true, p_note: n }); }
      else if (t.closest('.dg-refund')) { const n = prompt('Hoàn lại điểm cho nhân viên. Ghi chú (không bắt buộc):', ''); if (n === null) return; await rpc('app_dg_resolve', { p_id: m.id, p_keep: false, p_note: n }); }
      else return;
      editing = null; await reload(); draw(false);
    } catch (e2) { alert(e2.message); }
  });
  d.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target; const v = collect();
    if (!editing && !H.employee.set_saved) { err('Chọn bộ tiêu chí (Pha chế hoặc Chạy bàn) cho nhân viên trước.'); return; }
    if (!v.pts) { err('Chọn Nhắc nhở hoặc mức trừ 1–5 điểm.'); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (editing) {
        await rpc('app_dg_edit', { p_id: editing.id, p_criterion: v.crit, p_points: Number(v.pts), p_note: v.note });
      } else {
        const date = ctx.report ? ctx.report.date : v.date;
        if (!openMonth(String(date || '').slice(0, 7))) { err(`Tháng ${monthLabel(String(date).slice(0, 7))} đã khóa đánh giá. Nhờ Chủ mở lại.`); btn.disabled = false; return; }
        let photo = null; const file = f.photo?.files?.[0];
        if (file) {
          const blob = await compressImage(file, 1280, 0.75);
          photo = `dg/${empId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const { error } = await sb.storage.from(DG_BUCKET).upload(photo, blob, { contentType: 'image/jpeg' });
          if (error) throw new Error('Không tải được ảnh: ' + error.message);
        }
        await rpc('app_dg_add', { p_employee: empId, p_date: date, p_criterion: v.crit, p_points: Number(v.pts), p_note: v.note, p_photo: photo,
          p_report: ctx.report ? ctx.report.id : null, p_branch: ctx.report ? null : (ctx.branch || null), p_set: null });
      }
      editing = null; await reload(); draw(false);
      const top = $('.dg-scroll', d); if (top) top.scrollTop = 0;
      const ok = document.createElement('div'); ok.className = 'alert ok'; ok.textContent = 'Đã ghi. Nhân viên đã được báo.'; $('.dg-scroll', d)?.prepend(ok);
    } catch (e) { err(e.message); btn.disabled = false; }
  });
  draw(false);
}

// Bước Nhân sự của trang Đối soát ca: đánh giá người làm ca (không bắt buộc)
export async function mountReportEval(box, R) {
  if (!box) return;
  const staff = (R.staff || []).filter((s) => (s.worked === undefined || s.worked) && !s.pay_cash);   // người trả lương tiền mặt không đánh giá
  const draw = async () => {
    let marks = []; try { marks = (await rpc('app_dg_report', { p_report: R.id })) || []; } catch (_) { /* bỏ qua */ }
    box.innerHTML = str(html`<div class="pc-sec-head"><h2>Đánh giá nhân viên trong ca <span class="st-meta">(không bắt buộc)</span></h2></div>
      <div class="st-meta">Nhân viên phạm lỗi thì trừ điểm vào đúng tiêu chí (1–5 điểm) hoặc nhắc nhở. Bấm tên để xem toàn bộ lịch sử trước khi chọn mức.</div>
      ${staff.length ? staff.map((s) => { const mk = marks.filter((m) => m.employee_id === s.employee_id); return html`<div class="pc-line" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div><strong>${s.code || ''}${s.code ? ' – ' : ''}${s.name || 'NV ' + s.employee_id}</strong>
            ${mk.length ? html`<div class="st-meta">Ca này: ${mk.map((m) => `${ptsLabel(m.points)} · ${m.criterion_name}`).join('; ')}</div>` : ''}</div>
          <button type="button" class="btn sm secondary dg-open" data-emp="${s.employee_id}">Trừ điểm / nhắc nhở</button></div>`; })
        : html`<div class="st-meta">Ca này chưa có nhân viên.</div>`}`);
    $$('.dg-open', box).forEach((b) => b.addEventListener('click', () => openEmployee(Number(b.dataset.emp), {
      report: { id: R.id, date: R.work_date, shift: R.shift, branch: R.branch_code || R.branch || '' }, onChange: draw })));
  };
  await draw();
}
