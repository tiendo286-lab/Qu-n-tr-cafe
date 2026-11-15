// Bước 109 — phần dùng chung của Công việc (Bảng phân công Đợt 1): tên việc, thẻ việc tự động, thẻ Giao việc riêng, hộp thoại giao / báo xong / kiểm tra.
import { rpc, sb } from './sb.js';
import { compressImage } from './tien.js';
import { $, $$, dialog, html, raw, str } from './ui.js';

export const JOBS = {
  1: 'Đối soát ca', 2: 'Phân chia nhân viên phát sinh', 3: 'File ca Fabi', 4: 'Chuyển khoản thực nhận', 7: 'Lệch tiền ca', 8: 'Xem giải trình khoản trừ',
  10: 'Kiểm quỹ hằng tuần', 11: 'Nhận hàng quá ngày giao', 12: 'Đối soát hàng', 13: 'Hoá đơn bù & ghép phiếu xuất', 14: 'Giao bù & hoá đơn bổ sung', 24: 'Giao việc riêng',
};
export const ORDER = [1, 2, 7, 8, 10, 11, 12, 3, 4, 13, 14, 24];
export const GROUP = { 1: 'tien', 2: 'tien', 7: 'tien', 8: 'tien', 10: 'tien', 11: 'hang', 12: 'hang', 3: 'kt', 4: 'kt', 13: 'kt', 14: 'kt', 24: 'rieng' };
export const GROUPS = { tien: 'Đối soát tiền & ca (theo cơ sở)', hang: 'Hàng hoá (theo cơ sở)', kt: 'Kế toán (1 người, chung các cơ sở)', rieng: 'Giao việc riêng (bàn giao ca + mọi việc giao tay)' };
export const MERGED = [11, 12, 13, 14];
export const RST = ['Chờ giao', 'Chờ nhận', 'Đang làm', 'Chờ kiểm tra', 'Hoàn thành'];
const RST_KEY = { chua_phan_cong: 0, da_giao: 1, dang_xu_ly: 2, cho_duyet: 3, hoan_thanh: 4, bo: -1 };
export const rstate = (k) => RST_KEY[k.status] ?? 2;
export const PRI = { thap: 'Thấp', binh_thuong: 'Bình thường', gap: 'Gấp' };
export const ROLE = { chu: 'Chủ', ql_tong: 'QL tổng', ql: 'Quản lý', nv: 'Nhân viên' };
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const BUCKET = 'phieu-ca';

// ---- thời gian (chuỗi giờ VN 'YYYY-MM-DD HH:MM:SS') ----
export const ms = (s) => (s ? Date.parse(String(s).replace(' ', 'T')) : NaN);
export const fd = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}` : '');
export const fdw = (s) => (s ? `${WD[new Date(ms(s)).getDay()]} ${fd(s)}` : '');
export function dur(x) {
  const m = Math.round(Math.abs(x) / 60000); if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24), r = h % 24; return `${d} ngày${r ? ' ' + r + ' giờ' : ''}`;
}
export const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}đ`;
export const shortName = (s) => String(s || '').replace(/^[^–]*–\s*/, '');

// ---- trạng thái hạn ----
export function pcDue(t) {
  if (MERGED.includes(t.job)) { const ds = (t.items || []).filter((i) => !i.done_at && i.due_at).map((i) => i.due_at).sort(); return ds[0] || null; }
  return curStep(t)?.due_at || null;
}
export const curStep = (t) => (t.steps || []).filter((s) => !s.done_at).slice(-1)[0] || (t.steps || []).slice(-1)[0];
export function gvDue(k) { const s = rstate(k); return s === 0 ? k.cls_due : s === 3 ? k.review_due : (s === 1 || s === 2) ? k.due : null; }
export function tone(due, now, noOne) {
  if (noOne) return 'free'; if (!due) return 'none';
  const r = ms(due) - ms(now); return r < 0 ? 'late' : r < 6 * 3600e3 ? 'soon' : '';
}
export function dueBadge(due, now) {
  if (!due) return html`<span class="pc-due none">Không đặt hạn</span>`;
  const r = ms(due) - ms(now);
  if (r < 0) return html`<span class="pc-due late">Quá hạn ${dur(r)}</span>`;
  return html`<span class="pc-due ${r < 6 * 3600e3 ? 'soon' : 'ok'}">Còn ${dur(r)}</span>`;
}
const warnLine = (fine, due, now, who) => {
  if (!fine || !due) return '';
  return ms(due) < ms(now)
    ? html`<div class="pc-warn late">⚠ Đã quá hạn${who ? html` — ${who}` : ''} · chờ Chủ xác nhận phạt ${money(fine)}</div>`
    : html`<div class="pc-warn">⚠ Quá hạn sẽ bị phạt ${money(fine)} / lần</div>`;
};

// ---- thẻ việc tự động ----
export function pcCard(t, { ctx, me, now, mgr }) {
  const s = curStep(t), due = pcDue(t), merged = MERGED.includes(t.job);
  const accs = s?.accounts || [], names = (s?.names || []).map(shortName);
  const co = (s?.names || []).filter((_, i) => accs[i] !== me).map(shortName);
  const steps = t.n_steps > 1 ? html`<div class="pc-steps">${(t.steps || []).map((x) => html`<span class="pc-st ${x.done_at ? 'ok' : 'on'}">${x.step + 1}. ${x.name} · ${(x.names || []).map(shortName).join(', ') || 'chưa có người'}${x.done_at ? ' ✓' : ''}</span>`)}${t.n_steps > (t.steps || []).slice(-1)[0]?.step + 1 ? html`<span class="pc-st">… còn ${t.n_steps - (t.steps.slice(-1)[0].step + 1)} bước</span>` : ''}</div>` : '';
  const items = merged ? html`<ul class="pc-items">${(t.items || []).filter((i) => !i.done_at).map((i) => html`<li><a href="#${i.link || t.link}">${i.title}</a>${i.due_at ? html`<span class="md ${ms(i.due_at) < ms(now) ? 'late' : 'ok'}">${ms(i.due_at) < ms(now) ? 'quá ' + dur(ms(now) - ms(i.due_at)) : 'hạn ' + fd(i.due_at)}</span>` : ''}</li>`)}</ul>` : '';
  let who = '';
  if (!accs.length) who = html`<b class="red">Chưa có người làm</b> — ${mgr ? 'bấm "Giao người" hoặc điền ô trong Bảng phân công' : 'chờ quản lý giao'}`;
  else if (ctx === 'my') who = accs.length > 1 ? html`Giao cùng <b>${co.join(', ')}</b> — ai làm trước cũng được` : '';
  else who = html`Người làm: <b>${names.join(', ')}</b>${accs.length > 1 ? ' · ai làm trước cũng được' : ''}`;
  const line = merged ? `${(t.items || []).filter((i) => !i.done_at).length} mục đang chờ` : s?.due_at ? `${s.name} · hạn ${fdw(s.due_at)}` : `${s?.name || ''} · giao lúc ${fd(s?.start_at)}`;
  const manual = s && !s.done_at && s.step >= t.auto;
  const mine = accs.includes(me);
  return html`<article class="pc-task ${tone(due, now, !accs.length)}">
    <div class="pc-top">${ctx === 'my' ? '' : html`<span class="pc-jb">${JOBS[t.job]}</span>`}${t.code ? html`<span class="pc-br">${t.code}</span>` : ''}${dueBadge(due, now)}</div>
    <div class="pc-title">${merged ? (t.code ? 'Cơ sở ' + t.code : 'Các cơ sở') : t.title}</div>
    <div class="pc-sub">${line}</div>${steps}${items}
    ${who ? html`<div class="pc-who">${who}</div>` : ''}${warnLine(t.fine, due, now)}
    <div class="pc-act">${manual ? (mine || mgr ? html`<button class="btn sm" data-a="pc-step" data-id="${t.id}">Xong bước "${s.name}" ✓</button>` : '') : !merged && t.link ? html`<a class="btn sm" href="#${t.link}">${mine ? 'Làm ngay →' : 'Mở hồ sơ →'}</a>` : merged && t.link ? html`<a class="btn sm secondary" href="#${t.link}">Mở trang →</a>` : ''}
      ${mgr ? html`<button class="btn sm secondary" data-a="pc-reassign" data-id="${t.id}">${accs.length ? 'Đổi người' : 'Giao người'}</button>` : ''}</div>
  </article>`;
}

// ---- thẻ Giao việc riêng ----
export function gvCard(k, { ctx, me, now, mgr }) {
  const st = rstate(k), due = gvDue(k), late = due && ms(due) < ms(now);
  const bar = html`<div class="pc-steps">${RST.map((n, i) => html`<span class="pc-st ${i < st ? 'ok' : i === st ? 'on' : ''}">${i < st ? '✓ ' : ''}${n}</span>`)}</div>`;
  const roles = st === 0 ? html`Người phân loại: <b>${(k.classifiers || []).map((x) => shortName(x.name)).join(', ') || 'chưa có người'}</b>`
    : html`Giao: <b>${shortName(k.giver) || '—'}</b> · Làm: <b>${shortName(k.assignee)}</b> · Kiểm tra: <b>${shortName(k.reviewer)}</b>`;
  const dueTxt = due ? `${['Hạn phân loại', 'Hạn làm', 'Hạn làm', 'Hạn kiểm tra'][st]} ${fdw(due)}` : '';
  const holder = st === 0 ? 'người phân loại' : st === 3 ? shortName(k.reviewer) : shortName(k.assignee);
  const B = (a, l, c = '') => html`<button class="btn sm ${c}" data-a="${a}" data-id="${k.id}">${l}</button>`;
  const acts = [];
  if (st === 0 && ((k.classifiers || []).some((x) => x.id === me) || mgr)) acts.push(B('gv-cls', 'Phân loại / giao →'));
  if (st === 1 && k.assignee_id === me) acts.push(B('gv-accept', 'Nhận việc'));
  if (st === 2 && k.assignee_id === me) { acts.push(B('gv-prog', 'Ghi tiến độ', 'secondary')); if (!k.ext) acts.push(B('gv-ext', 'Xin gia hạn', 'secondary')); acts.push(B('gv-done', 'Báo xong ✓', 'solid')); }
  if (st === 3 && k.reviewer_id === me) { acts.push(B('gv-ok', 'Đạt ✓', 'solid')); acts.push(B('gv-redo', 'Làm lại', 'danger')); }
  if (k.ext && k.giver_id === me) { acts.push(B('gv-extok', `Đồng ý gia hạn ${k.ext.days} ngày`, 'solid')); acts.push(B('gv-extno', 'Không đồng ý', 'secondary')); }
  acts.push(B('gv-detail', 'Chi tiết', 'secondary'));
  if ((mgr || k.giver_id === me) && (st === 1 || st === 2 || st === 3)) acts.push(B('gv-reassign', 'Đổi người', 'secondary'));
  return html`<article class="pc-task ${st === 4 ? '' : tone(due, now, false)}">
    <div class="pc-top">${ctx === 'my' ? '' : html`<span class="pc-jb">Giao việc riêng</span>`}${k.code ? html`<span class="pc-br">${k.code}</span>` : ''}<span class="pill pc-rs${st}">${st < 0 ? 'Không cần xử lý' : RST[st]}</span>${k.priority === 'gap' ? html`<span class="pill off">GẤP</span>` : ''}${st >= 0 && st < 4 ? dueBadge(due, now) : ''}</div>
    <div class="pc-title">${k.content}</div>
    <div class="pc-sub">${k.src}${dueTxt ? ' · ' + dueTxt : ''}</div>
    ${bar}<div class="pc-who">${roles}</div>
    ${k.last ? html`<div class="pc-last">🕒 ${fd(k.last.at)} · <b>${shortName(k.last.by) || 'Nhân viên'}</b>: ${k.last.note}${k.last.photo ? ' · 📷 có ảnh' : ''}</div>` : ''}
    ${k.ext ? html`<div class="pc-warn">⏳ ${shortName(k.assignee)} xin gia hạn thêm ${k.ext.days} ngày: ${k.ext.reason} — chờ ${shortName(k.giver)} duyệt</div>` : ''}
    ${st >= 0 && st < 4 ? (late ? html`<div class="pc-warn late">⚠ Quá hạn ở bước "${RST[st]}" — ${holder} · chờ Chủ xác nhận phạt ${money(k.fine)}</div>` : due && k.fine ? html`<div class="pc-warn">⚠ Quá hạn sẽ bị phạt ${money(k.fine)} / lần (người đang giữ việc)</div>` : '') : ''}
    <div class="pc-act">${acts}</div></article>`;
}

// ---- hộp thoại ----
function modal(inner, wide) {
  const d = dialog(html`<div class="stack pc-dlg">${inner}<div class="alert error pc-err" hidden></div></div>`);
  if (wide) d.style.maxWidth = '640px';
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
  return d;
}
async function run(d, btn, fn) {
  btn.disabled = true; const er = $('.pc-err', d); er.hidden = true;
  try { await fn(); d.close(); } catch (e) { er.textContent = e.message || String(e); er.hidden = false; } finally { btn.disabled = false; }
}
const acts = (label, cls = '') => html`<div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" data-close>Đóng</button><button type="button" class="btn ${cls}" data-ok>${label}</button></div>`;
const fld = (l, inner) => html`<label class="pc-fld"><span>${l}</span>${inner}</label>`;
const pplOpts = (people, sel, blank) => html`${blank ? html`<option value="">${blank}</option>` : ''}${(people || []).map((p) => html`<option value="${p.id}" ${String(p.id) === String(sel ?? '') ? 'selected' : ''}>${shortName(p.name)} · ${ROLE[p.role] || p.role}</option>`)}`;
const DUES = [[4 / 24, '4 giờ'], [0.5, '12 giờ'], [1, '1 ngày'], [2, '2 ngày'], [3, '3 ngày'], [7, '7 ngày']];
const dueSel = (id, def = 1) => html`<select class="input" id="${id}">${DUES.map(([v, l]) => html`<option value="${v}" ${v === def ? 'selected' : ''}>${l}</option>`)}</select>`;
const vnNow = () => new Date(Date.now() + 7 * 3600e3);
const dueText = (days) => { const d = new Date(vnNow().getTime() + days * 86400e3); return d.toISOString().slice(0, 16).replace('T', ' '); };
const priSel = (id) => html`<select class="input" id="${id}">${Object.entries(PRI).map(([k, l]) => html`<option value="${k}" ${k === 'binh_thuong' ? 'selected' : ''}>${l}</option>`)}</select>`;
const photoIn = (id) => html`<label class="pc-photo">📷 Chụp / chọn ảnh <input type="file" accept="image/*" id="${id}"></label>`;
const giaoFields = (people, me) => html`<div class="pc-grid2">${fld('Người làm', html`<select class="input" id="g-who">${pplOpts(people, '', '— chọn người làm —')}</select>`)}${fld('Người kiểm tra', html`<select class="input" id="g-rv">${pplOpts(people, me, '— chọn người kiểm tra —')}</select>`)}${fld('Hạn làm', dueSel('g-due'))}${fld('Mức độ', priSel('g-pri'))}</div>`;

async function upload(taskId, file) {
  const blob = await compressImage(file);
  const path = `cv${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}

export function gvCreate({ people, branches, me, done }) {
  const d = modal(html`<h2>+ Giao việc riêng</h2><div class="sub">Việc gì cũng giao được: sửa chữa, mua đồ, vệ sinh… Người làm nhận việc, ghi tiến độ, báo xong kèm ảnh; người kiểm tra bấm Đạt mới đóng.</div>
    ${fld('Nội dung việc', html`<textarea class="input" id="g-tt" rows="2" placeholder="vd: Gọi thợ sửa máy lạnh tầng 2"></textarea>`)}
    ${fld('Cơ sở', html`<select class="input" id="g-br"><option value="">Chung (không theo cơ sở)</option>${(branches || []).map((b) => html`<option value="${b.id}">${b.code}</option>`)}</select>`)}
    ${giaoFields(people, me)}${acts('Giao việc')}`, true);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => {
    await rpc('app_gv_create', { p: { content: $('#g-tt', d).value, branch_id: $('#g-br', d).value || null, assignee_id: $('#g-who', d).value || null, reviewer_id: $('#g-rv', d).value || null, due: dueText(+$('#g-due', d).value), priority: $('#g-pri', d).value } });
    done('Đã giao việc — người làm đã được báo');
  }));
}

export function gvClassify(k, { people, me, done }) {
  const d = modal(html`<h2>Phân loại / giao</h2><div class="pc-fake"><b>${k.content}</b><br><span class="sub">${k.src}</span></div>
    <div class="pc-grid3">${[['giao', 'Giao người khác'], ['tu', 'Tự làm'], ['bo', 'Không cần xử lý']].map(([v, l], i) => html`<label class="pc-ck"><input type="radio" name="g-mode" value="${v}" ${i === 0 ? 'checked' : ''}> ${l}</label>`)}</div>
    <div id="g-giao">${giaoFields(people, me)}</div>
    <div id="g-bo" hidden>${fld('Lý do không cần xử lý (bắt buộc)', html`<input class="input" id="g-why" placeholder="vd: ca sau đã làm xong, chỉ là ghi chú">`)}</div>
    ${acts('Lưu')}`, true);
  const sync = () => { const m = $('input[name=g-mode]:checked', d).value; $('#g-bo', d).hidden = m !== 'bo'; $('#g-giao', d).hidden = m === 'bo'; $('#g-who', d).closest('.pc-fld').hidden = m === 'tu'; if (m === 'tu' && $('#g-rv', d).value === String(me)) $('#g-rv', d).value = ''; };
  $$('input[name=g-mode]', d).forEach((r) => r.addEventListener('change', sync));
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => {
    const m = $('input[name=g-mode]:checked', d).value;
    await rpc('app_gv_classify', { p_task: k.id, p: { mode: m, assignee_id: m === 'tu' ? me : ($('#g-who', d).value || null), reviewer_id: $('#g-rv', d).value || null, due: dueText(+$('#g-due', d).value), priority: $('#g-pri', d).value, reason: $('#g-why', d).value } });
    done(m === 'bo' ? 'Đã đóng — không cần xử lý' : m === 'tu' ? 'Đã nhận tự làm' : 'Đã giao — người làm đã được báo');
  }));
}

export function gvProgress(k, { done }) {
  const d = modal(html`<h2>Ghi tiến độ</h2><div class="sub">${k.content}</div>${fld('Đã làm tới đâu', html`<textarea class="input" id="g-tx" rows="3" placeholder="vd: đã gọi thợ, hẹn 15h mai"></textarea>`)}${photoIn('g-ph')}<div class="sub">Ảnh không bắt buộc. Người giao và người kiểm tra xem được.</div>${acts('Lưu tiến độ')}`);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => {
    const f = $('#g-ph', d).files[0]; if (!$('#g-tx', d).value.trim()) throw new Error('Ghi vài chữ về tiến độ.');
    const path = f ? await upload(k.id, f) : null;
    await rpc('app_gv_progress', { p_task: k.id, p_note: $('#g-tx', d).value, p_photo: path }); done('Đã ghi tiến độ');
  }));
}

export function gvExt(k, { done }) {
  const d = modal(html`<h2>Xin gia hạn</h2><div class="sub">Hạn hiện tại: ${fdw(k.due)} · ${shortName(k.giver)} sẽ duyệt</div>${fld('Xin thêm', dueSel('g-xd'))}${fld('Lý do (bắt buộc)', html`<input class="input" id="g-xw" placeholder="vd: thợ hẹn sang thứ Hai">`)}${acts('Gửi xin gia hạn')}`);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => { await rpc('app_gv_ext', { p_task: k.id, p_days: +$('#g-xd', d).value, p_reason: $('#g-xw', d).value }); done('Đã gửi xin gia hạn'); }));
}

export function gvSubmit(k, { done }) {
  const d = modal(html`<h2>Báo xong</h2><div class="sub">${k.content}</div>${fld('Kết quả (bắt buộc)', html`<textarea class="input" id="g-rs" rows="3" placeholder="vd: thợ đã thay tụ, máy chạy êm"></textarea>`)}${photoIn('g-dp')}<div><b>Bắt buộc có ảnh</b> kết quả. Sau đó ${shortName(k.reviewer)} kiểm tra.</div>${acts('Báo xong', 'solid')}`);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => {
    if (!$('#g-rs', d).value.trim()) throw new Error('Ghi kết quả.');
    const f = $('#g-dp', d).files[0]; if (!f) throw new Error('Chưa có ảnh kết quả.');
    const path = await upload(k.id, f);
    await rpc('app_gv_submit', { p_task: k.id, p_result: $('#g-rs', d).value, p_photo: path }); done('Đã báo xong — chờ kiểm tra');
  }));
}

export function gvRedo(k, { done }) {
  const d = modal(html`<h2>Làm lại</h2><div class="sub">${k.content} · kết quả: ${k.result || ''}</div>${fld('Lý do (bắt buộc)', html`<input class="input" id="g-rw" placeholder="vd: vẫn còn rò nước">`)}${fld('Hạn làm lại', dueSel('g-rd'))}${acts('Trả về làm lại', 'danger')}`);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => { await rpc('app_gv_review', { p_task: k.id, p_ok: false, p_note: $('#g-rw', d).value, p_days: +$('#g-rd', d).value }); done('Đã trả về làm lại'); }));
}

export function gvReassign(k, { people, done }) {
  const d = modal(html`<h2>Đổi người</h2><div class="sub">${k.content}</div><div class="pc-grid2">${fld('Người làm', html`<select class="input" id="g-who">${pplOpts(people, k.assignee_id)}</select>`)}${fld('Người kiểm tra', html`<select class="input" id="g-rv">${pplOpts(people, k.reviewer_id)}</select>`)}</div>${acts('Lưu')}`);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => {
    await rpc('app_gv_reassign', { p_task: k.id, p_assignee: +$('#g-who', d).value || null, p_reviewer: +$('#g-rv', d).value || null }); done('Đã đổi người');
  }));
}

export async function gvDetail(id) {
  const k = await rpc('app_gv_detail', { p_task: id }); const st = rstate(k);
  const d = modal(html`<h2>${k.content}</h2>
    <div>${k.code ? html`<span class="pc-br">${k.code}</span> ` : ''}<span class="pill pc-rs${st}">${st < 0 ? 'Không cần xử lý' : RST[st]}</span> · ${k.src}</div>
    ${k.giver ? html`<div class="sub">Giao: <b>${shortName(k.giver)}</b> · Làm: <b>${shortName(k.assignee)}</b> · Kiểm tra: <b>${shortName(k.reviewer)}</b> · Mức độ: ${PRI[k.priority] || ''}</div>` : ''}
    <b>Dòng thời gian</b>
    <div class="pc-tl">${(k.events || []).map((e) => html`<div class="pc-tli"><span class="pc-tld"></span><div><div class="sub">${fdw(e.at)} · <b>${shortName(e.by) || 'Nhân viên'}</b></div><div>${e.note}</div>${e.photo ? html`<a target="_blank" rel="noopener" data-photo="${e.photo}"><img class="pc-img" alt="Ảnh" data-photo="${e.photo}"></a>` : ''}</div></div>`)}</div>
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn secondary" data-close>Đóng</button></div>`, true);
  const els = $$('img[data-photo]', d);
  if (els.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(els.map((x) => x.dataset.photo), 3600);
    (data || []).forEach((u, i) => { if (u.signedUrl) { els[i].src = u.signedUrl; els[i].closest('a').href = u.signedUrl; } });
  }
}

export function pcReassign(t, { people, done }) {
  const s = curStep(t);
  const d = modal(html`<h2>${s?.accounts?.length ? 'Đổi người' : 'Giao người'}: ${JOBS[t.job]}${t.code ? ' · ' + t.code : ''}</h2><div class="sub">${t.title} · bước "${s?.name}". Chỉ đổi cho việc này — muốn đổi cho việc sau thì sửa Bảng phân công. Chọn 2 người = ai làm trước cũng được.</div>
    <div class="pc-grid2">${(people || []).map((p) => html`<label class="pc-ck"><input type="checkbox" value="${p.id}" ${(s?.accounts || []).includes(p.id) ? 'checked' : ''}> ${shortName(p.name)} <span class="sub">${ROLE[p.role] || ''}</span></label>`)}</div>${acts('Lưu')}`, true);
  $('[data-ok]', d).addEventListener('click', (e) => run(d, e.target, async () => {
    await rpc('app_pc_reassign', { p_task: t.id, p_accounts: $$('.pc-grid2 input:checked', d).map((i) => +i.value) }); done('Đã giao — người làm đã được báo');
  }));
}

// Gắn hành động chung (thẻ việc + Giao việc riêng) — reload(message) tải lại dữ liệu
export function bindActions(root, ctx) {
  root.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a, id = +el.dataset.id; const D = ctx.data();
    const k = (D.gv || []).concat(D.watch || []).find((x) => x.id === id), t = (D.tasks || []).find((x) => x.id === id);
    const opt = { people: D.people, branches: D.branches, me: D.me, done: ctx.reload };
    const quick = async (fn, msg) => { el.disabled = true; try { await fn(); await ctx.reload(msg); } catch (e) { alert(e.message || e); el.disabled = false; } };
    if (a === 'gv-new') gvCreate(opt);
    else if (a === 'gv-cls') gvClassify(k, opt);
    else if (a === 'gv-accept') quick(() => rpc('app_gv_accept', { p_task: id }), 'Đã nhận việc');
    else if (a === 'gv-prog') gvProgress(k, opt);
    else if (a === 'gv-ext') gvExt(k, opt);
    else if (a === 'gv-extok') quick(() => rpc('app_gv_ext_decide', { p_task: id, p_ok: true }), 'Đã đồng ý gia hạn');
    else if (a === 'gv-extno') quick(() => rpc('app_gv_ext_decide', { p_task: id, p_ok: false }), 'Đã từ chối gia hạn');
    else if (a === 'gv-done') gvSubmit(k, opt);
    else if (a === 'gv-ok') { if (confirm('Xác nhận việc ĐẠT và đóng việc?')) quick(() => rpc('app_gv_review', { p_task: id, p_ok: true, p_note: null, p_days: null }), 'Đạt — việc đã hoàn thành'); }
    else if (a === 'gv-redo') gvRedo(k, opt);
    else if (a === 'gv-detail') gvDetail(id).catch((e) => alert(e.message || e));
    else if (a === 'gv-reassign') gvReassign(k, opt);
    else if (a === 'pc-reassign') pcReassign(t, opt);
    else if (a === 'pc-step') { if (confirm('Xác nhận xong bước này?')) quick(() => rpc('app_pc_step_done', { p_task: id }), 'Đã xong bước'); }
  });
}

export const toast = (msg) => {
  let el = document.getElementById('pc-toast');
  if (!el) { el = document.createElement('div'); el.id = 'pc-toast'; el.className = 'pc-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3500);
};

export const STYLE = raw(`<style>
.pc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.pc-stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.pc-stat span{font-size:13px;color:var(--muted)}.pc-stat strong{display:block;font-size:24px}
.pc-stat.late strong{color:var(--off-line)}.pc-stat.soon strong{color:#b45309}
.pc-sec{font-size:13px;font-weight:700;color:var(--ink-2);margin:18px 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;text-transform:uppercase;letter-spacing:.4px}
.pc-cat{border-bottom:2px solid var(--line);padding-bottom:6px;text-transform:none;font-size:16px;color:var(--ink);letter-spacing:0}
.pc-cat small{font-weight:400;color:var(--muted);font-size:12px}
.pc-ic{width:10px;height:10px;border-radius:3px;background:var(--primary);display:inline-block}.pc-ic.hang{background:#3f5a36}.pc-ic.kt{background:#6b3d63}.pc-ic.rieng{background:#6f8fae}.pc-ic.debt{background:#f59e0b}
.pc-cnt{background:var(--line-strong);color:var(--ink);border-radius:999px;font-size:11px;padding:1px 7px;font-weight:700}.pc-cnt.red{background:var(--off-line);color:#fff}
.pc-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.pc-task{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--sage-bg,#e6ecdc);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:7px;min-width:0}
.pc-task.late{border-left-color:var(--off-line);background:#fffaf9}.pc-task.soon{border-left-color:#f59e0b}.pc-task.none{border-left-color:#6f8fae}.pc-task.free{border-left-color:var(--line-strong);border-style:dashed}
.pc-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pc-jb{font-size:12px;font-weight:700;color:var(--primary);background:var(--caramel-soft,#f6ead9);border-radius:6px;padding:2px 8px}
.pc-br{font-size:12px;font-weight:700;background:#e6ecdc;color:#3f5a36;border-radius:6px;padding:2px 8px}
.pc-due{margin-left:auto;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;white-space:nowrap}
.pc-due.late{background:var(--off-bg);color:var(--off-ink)}.pc-due.soon{background:var(--warn-bg);color:var(--warn-ink)}.pc-due.ok{background:var(--ok-bg);color:var(--ok-ink)}.pc-due.none{background:#e3eaf1;color:#2d4a66}
.pc-title{font-weight:700;font-size:15px;overflow-wrap:anywhere}.pc-sub{font-size:13px;color:var(--muted)}
.pc-steps{display:flex;flex-wrap:wrap;gap:4px;font-size:12px}
.pc-st{border:1px solid var(--line-strong);border-radius:999px;padding:2px 9px;color:var(--muted)}.pc-st.on{border-color:var(--primary);color:var(--primary);font-weight:700;background:var(--caramel-soft,#f6ead9)}.pc-st.ok{border-color:var(--ok-line);color:var(--ok-ink);background:var(--ok-bg)}
.pc-items{margin:0;padding:0;list-style:none;border:1px solid var(--line-soft);border-radius:10px;font-size:13px}
.pc-items li{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border-top:1px solid var(--line-soft)}.pc-items li:first-child{border-top:0}
.pc-items .md{font-size:12px;white-space:nowrap;font-weight:600}.md.late{color:var(--off-line)}.md.ok{color:var(--ok-ink)}
.pc-who{font-size:13px;color:var(--ink-2)}.red{color:var(--off-line)}
.pc-warn{font-size:12px;color:var(--warn-ink);background:var(--warn-bg);border-radius:8px;padding:5px 9px}.pc-warn.late{color:var(--off-ink);background:var(--off-bg);font-weight:600}
.pc-last{font-size:12px;color:var(--ink-2);background:var(--subtle);border-radius:8px;padding:6px 9px}
.pc-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
.pill.pc-rs0{background:var(--off-bg);color:var(--off-ink)}.pill.pc-rs1{background:var(--warn-bg);color:var(--warn-ink)}.pill.pc-rs2{background:#e3eaf1;color:#2d4a66}.pill.pc-rs3{background:#efe5ee;color:#6b3d63}.pill.pc-rs4{background:var(--ok-bg);color:var(--ok-ink)}.pill.pc-rs-1{background:var(--line-soft);color:var(--muted)}
.pc-debt{background:#fff8e6;border:1px solid #f3d27a;border-left:5px solid #f59e0b;border-radius:14px;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pc-debt .amt{font-weight:700;font-size:17px;color:var(--warn-ink)}.pc-debt .grow{flex:1;min-width:160px}
.pc-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.pc-chip{border:1px solid var(--line-strong);background:var(--card);border-radius:999px;padding:5px 12px;font-size:13px;cursor:pointer;color:var(--ink)}
.pc-chip.on{background:var(--navy,#2f3d31);color:#fff;border-color:var(--navy,#2f3d31)}.pc-chip.on .pc-cnt{background:#fff;color:var(--ink)}
.pc-info{background:#e3eaf1;color:#2d4a66;border:1px solid #c3d1de;border-radius:12px;padding:10px 14px;font-size:13px}
.pc-done{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-top:1px solid var(--line-soft);font-size:13px}.pc-done:first-child{border-top:0}
.pc-tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px}
.pc-tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;color:var(--ink)}
.pc-tile span{font-size:12px;color:var(--muted)}.pc-tile strong{display:block;font-size:20px}.pc-tile.on{border-color:var(--primary);background:var(--caramel-soft,#f6ead9)}
.pc-tbl{width:100%;border-collapse:collapse}.pc-tbl th,.pc-tbl td{padding:8px 10px;border-top:1px solid var(--line-soft);text-align:left;font-size:14px}.pc-tbl th{font-size:12px;color:var(--muted);border-top:0}.pc-tbl .n{text-align:right}
.pc-dlg{gap:12px}.pc-fld{display:flex;flex-direction:column;gap:4px;font-size:13px}.pc-fld>span{color:var(--muted)}
.pc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pc-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.pc-ck{display:flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px;cursor:pointer;font-size:14px}
.pc-fake{border:2px dashed var(--caramel-line,#e8cfb0);border-radius:12px;padding:10px 12px;background:var(--subtle)}
.pc-photo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;border:1px dashed var(--caramel-line,#e8cfb0);border-radius:10px;padding:8px 12px;font-size:13px;background:var(--subtle)}.pc-photo input{max-width:100%;font-size:12px}
.pc-tl{display:flex;flex-direction:column;border-left:2px solid var(--line);margin-left:6px}.pc-tli{display:flex;gap:10px;padding:6px 0 10px;font-size:14px}
.pc-tld{width:12px;height:12px;border-radius:50%;background:var(--primary);margin-left:-7px;margin-top:4px;flex-shrink:0}.pc-img{max-width:220px;max-height:160px;border-radius:8px;margin-top:6px;display:block}
.pc-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--navy,#2f3d31);color:#fff;padding:11px 18px;border-radius:12px;font-size:14px;z-index:60;max-width:calc(100% - 32px);opacity:0;transition:opacity .2s;pointer-events:none}.pc-toast.show{opacity:1}
@media (max-width:760px){.pc-stats{grid-template-columns:repeat(2,1fr)}.pc-list{grid-template-columns:1fr}.pc-tiles{grid-template-columns:repeat(2,1fr)}.pc-grid2{grid-template-columns:1fr}}
</style>`);
export { str };
