// Việc hôm nay (bước 62, làm lại bước 138): trang đầu của cả 5 vai trò — ca của tôi hôm nay, việc của tôi, theo dõi, bảng lương của tôi.
// Mỗi nguồn dữ liệu hỏi cùng lúc; nguồn nào lỗi thì chỉ phần đó báo, các khối khác vẫn hiện.
// Bước 142: việc chia nhóm Vận hành / Nhân sự / Khác, gộp việc cùng loại, người làm, Đã xong hôm nay; Chủ có tab Mọi người.
import { render as rerender, state } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, vnd } from '../tien.js';
import { $, $$, ROLE_LABELS, html, raw, str } from '../ui.js';
import { curStep, gvDue, jobName, learnJobs, pcDue, rstate } from '../cv_chung.js?v=2026.11.29.3';
import { collectWork, dueText } from '../hom_nay_viec.js?v=2026.11.29.3';
import { ROLE_TABS, branchSummary, buildSections, byBranch, byFlag, byRole, doneRows, everyoneWork, isLate, isNone } from '../hom_nay_nhom.js?v=2026.11.29.3';
import { KA_STATUS } from './phieu_ca.js';
import { kaCaLink } from './khoan_am_toi.js?v=2026.11.29.3';   // khoản âm nối với ca: đường mở phiếu ca
import { mountMyPlan, myPlanHtml } from './pc_dao_tao_toi.js?v=2026.11.29.3';   // tệp 174: việc đào tạo của tôi

const h2 = (n) => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const soft = (p) => p.catch(() => null);
const REPORT = { hoan_thanh: 'Đã gửi phiếu chốt ca' };

function caBlock(T, can) {
  let body;
  if (T && !T.has_employee) return '';   // anh Tiến chốt 27/11: tài khoản không gắn nhân viên (Chủ, Kế toán riêng) thì ẩn thẻ này
  if (!T) body = html`<div class="alert warn">Chưa tải được ca hôm nay.</div>`;
  else if (!T.shifts.length) body = html`<div class="sub">Hôm nay bạn không có ca.</div>`;
  else {
    body = T.shifts.map((c) => {
      const st = !c.report_id ? 'Chưa mở phiếu' : (REPORT[c.report_status] || 'Đang chốt ca')
        + (c.report_status === 'hoan_thanh' ? (c.recon_status && c.recon_status !== 'chua' ? ' · đã đối soát' : ' · chờ đối soát') : '');
      return html`<div class="hn-ca">
        <div class="grow"><strong>Ca ${c.shift} · ${c.branch}</strong>
          <div class="sub">${c.start ? `${c.start}–${c.end || ''}` : 'Chưa cài giờ'}${c.role ? ' · ' + c.role : ''} · ${st}</div></div>
        ${can('chot_ca') ? html`<a class="btn sm" style="white-space:nowrap" href="#/ca">${!c.report_id ? 'Chốt ca' : c.report_status === 'hoan_thanh' ? 'Xem phiếu' : 'Chốt tiếp'}</a>` : ''}</div>`;
    });
  }
  return html`<section id="hn-ca" class="card stack" style="gap:8px"><h2 style="margin:0">Ca của tôi hôm nay</h2>${body}</section>`;
}

// ---- Bước 142: Việc của tôi chia nhóm Vận hành / Nhân sự / Khác + Đã xong hôm nay; Chủ có tab Mọi người ----
const short = (s) => String(s || '').replace(/^[^–]*–\s*/, '');
const chev = raw('<svg class="hn-chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M7 4l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
const ICO = { vh: 'VH', ns: 'NS', kh: 'K', done: '✓' };
let VIEW = null, ROLE = '', BR = null, FLAG = '', VIEW_OF = null;   // tab Mọi người (giữ trong phiên): vai trò · cơ sở (null = mọi cơ sở) · chỉ quá hạn / chưa có người nhận
const openKey = (me) => 'hn-open:' + (me.account_id ?? me.id ?? '');
function loadOpen(me) { try { return JSON.parse(localStorage.getItem(openKey(me)) || '{}') || {}; } catch { return {}; } }
function saveOpen(me, o) { try { localStorage.setItem(openKey(me), JSON.stringify(o)); } catch { /* bộ nhớ bị chặn: chỉ không nhớ */ } }

const flagsHtml = (c) => html`<span class="hn-flags">${c.review ? html`<span class="pill hn-p-review">${c.review} cần kiểm tra</span>` : ''}${c.redo ? html`<span class="pill hn-p-redo">${c.redo} làm lại</span>` : ''}${c.gap ? html`<span class="pill hn-p-gap">${c.gap} gấp</span>` : ''}${c.late ? html`<span class="pill hn-p-late">${c.late} quá hạn</span>` : ''}${c.today ? html`<span class="pill hn-p-today">${c.today} hôm nay</span>` : ''}${!c.review && !c.late && !c.today && c.waiting ? html`<span class="pill mute">${c.waiting} đang chờ</span>` : ''}</span>`;
const whoHtml = (w) => html`<span class="hn-who ${w.none ? 'none' : w.mine ? '' : 'other'}">Người làm: ${w.text}</span>`;
let NOW = '';   // giờ máy chủ lúc tải trang — để ghi hạn theo kiểu còn bao lâu / trễ bao lâu (rà soát 20/11)
const dueFull = (d) => `${dmy(d.slice(0, 10))} ${d.slice(11, 16) === '23:59' ? '' : d.slice(11, 16)}`.trim();
const dueHtml = (d) => (d ? html`<span class="hn-due" title="Hạn ${dueFull(d)}">${dueText(d, NOW) || dueFull(d)}</span>` : '');
const rowCls = (i) => (i.review ? 'review' : i.redo ? 'redo' : i.group);
const tagHtml = (tag, title) => (tag && !String(title || '').startsWith(tag) ? html`<span class="hn-tag">${tag}</span>` : '');   // nhãn trùng tên việc thì bỏ
function rowHtml(i) {
  return html`<a class="hn-row ${rowCls(i)}" data-key="${i.key}" href="#${i.link}">
    <div class="grow"><div>${tagHtml(i.tag, i.title)}<strong>${i.title}</strong>${i.gap ? html` <span class="pill hn-p-gap">GẤP</span>` : ''}${i.review ? html` <span class="pill hn-p-review">Cần bạn kiểm tra</span>` : ''}${i.redo ? html` <span class="pill hn-p-redo">Làm lại</span>` : ''}</div>
      ${i.sub ? html`<div class="sub">${i.sub}</div>` : ''}${i.redo ? html`<div class="hn-why">Lý do: ${i.redo}</div>` : ''}
      ${i.waitingFor ? html`<div><span class="pill mute">Chờ ${i.waitingFor}</span></div>` : ''}${whoHtml(i.who)}</div>
    ${dueHtml(i.due)}<i>›</i></a>`;
}
function bundleWho(kids) {
  const names = [...new Set(kids.flatMap((k) => k.who.text.replace(' (ai làm cũng được)', '').split(' + ')))];
  return { text: names.length > 3 ? names.slice(0, 3).join(', ') + ` +${names.length - 3}` : names.join(', '), mine: kids.some((k) => k.who.mine), none: kids.every((k) => k.who.none) };
}
function bundleHtml(b, key, open) {
  return html`<div class="hn-bundle ${open ? 'open' : ''}" data-kind="${b.kind}" data-b="${key}">
    <button type="button" class="hn-row hn-bh ${rowCls(b.top)}" aria-expanded="${String(open)}">${chev}
      <div class="grow"><div>${tagHtml(b.tag, b.label)}<strong>${b.label}</strong><span class="hn-count">${b.kids.length}</span></div>
        <div>${flagsHtml(b.counts)}</div>${whoHtml(bundleWho(b.kids))}</div>${dueHtml(b.top.due)}</button>
    <div class="hn-bkids">${b.kids.map(rowHtml)}</div></div>`;
}
function sectionHtml(s, O, view) {
  const k = 'cat:' + s.cat.id; const open = k in O ? !!O[k] : s.counts.n > 0;
  return html`<section class="hn-grp hn-${s.cat.id} ${open ? 'open' : ''}" data-cat="${s.cat.id}">
    <button type="button" class="hn-gh" aria-expanded="${String(open)}">${chev}<span class="hn-ico">${ICO[s.cat.id]}</span>
      <span class="grow"><b>${s.cat.name}</b> <span class="sub">(${s.counts.n})</span><span class="hn-hint">${s.cat.hint}</span></span>${flagsHtml(s.counts)}</button>
    <div class="hn-gbody">${s.entries.length ? s.entries.map((e) => (e.bundle ? bundleHtml(e, `${view}:${s.cat.id}:${e.kind}`, !!O['b:' + `${view}:${s.cat.id}:${e.kind}`]) : rowHtml(e)))
      : html`<div class="sub hn-empty">Không có việc trong nhóm này.</div>`}</div></section>`;
}
function doneHtml(rows, O) {
  const open = !!O['cat:done'];
  return html`<section class="hn-grp hn-done ${open ? 'open' : ''}" data-cat="done">
    <button type="button" class="hn-gh" aria-expanded="${String(open)}">${chev}<span class="hn-ico">${ICO.done}</span>
      <span class="grow"><b>Đã xong hôm nay</b> <span class="sub">(${rows ? rows.length : '…'})</span><span class="hn-hint">Việc đã kiểm tra Đạt hoặc làm xong trong ngày · hết ngày tự xoá</span></span></button>
    <div class="hn-gbody">${rows == null ? html`<div class="sub hn-empty">Chưa tải được việc đã xong.</div>`
      : rows.length ? rows.map((d) => html`<div class="hn-row hn-ok"><span class="hn-tick">✓</span><div class="grow"><div>${d.tag ? html`<span class="hn-tag">${d.tag}</span>` : ''}<strong>${d.title}</strong></div>
        <div class="sub">${d.by ? html`<span class="pill ok">Đạt</span> · ${short(d.by)} kiểm tra` : html`<span class="pill ok">Xong</span>`} · ${d.at}</div>${whoHtml({ text: d.who === 'Bạn' ? 'Bạn' : short(d.who) || '—', mine: d.who === 'Bạn', none: false })}</div></div>`)
      : html`<div class="sub hn-empty">Hôm nay chưa có việc xong.</div>`}</div></section>`;
}
// V = { W, E, done, isChu, me }
function viecBlock(V) {
  const O = loadOpen(V.me);
  const all = V.canAll && VIEW === 'all';
  let body;
  if (all && V.E.failed) body = html`<div class="alert warn" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Chưa tải được việc của mọi người <button type="button" class="btn sm secondary" id="hn-retry">Thử lại</button></div>`;
  else if (!all && V.W.failed) body = html`<div class="alert warn" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">Chưa tải được công việc <button type="button" class="btn sm secondary" id="hn-retry">Thử lại</button></div>`;
  else {
    const items = all ? byFlag(byBranch(byRole(V.E.items, ROLE), BR), FLAG) : V.W.items;
    const done = all ? byRole(V.E.done, ROLE) : V.done;
    // đang lọc theo cơ sở / quá hạn / chưa có người nhận thì không hiện "Đã xong hôm nay" (mục đó không chia theo cơ sở)
    body = html`${buildSections(items).map((s) => sectionHtml(s, O, all ? 'all' : 'mine'))}${all && (BR != null || FLAG) ? '' : doneHtml(done, O)}`;
  }
  const tabs = V.canAll ? html`<div class="hn-tabs" id="hn-tabs" role="group" aria-label="Xem việc">
      <button type="button" data-view="mine" aria-pressed="${String(!all)}">Việc của tôi (${V.W.items.length})</button>
      <button type="button" data-view="all" aria-pressed="${String(all)}">Mọi người (${V.E.items.length})</button></div>` : '';
  const roles = all && !V.E.failed ? html`<div class="hn-roles" id="hn-roles" aria-label="Lọc theo vai trò người làm">
      <button type="button" data-role="" aria-pressed="${String(!ROLE)}">Tất cả <span>${V.E.items.length}</span></button>${ROLE_TABS.map((r) => html`<button type="button" data-role="${r}" aria-pressed="${String(ROLE === r)}">${r} <span>${byRole(V.E.items, r).length}</span></button>`)}</div>
      <div class="sub" style="font-size:12px">Việc khác: việc của nhân viên và việc chưa có người nhận.</div>${brFilter(V)}` : '';
  return html`<section id="hn-viec" class="card stack" style="gap:8px">
    <div class="hn-top"><h2 style="margin:0">${all ? 'Việc của mọi người' : 'Việc của tôi'}</h2>
      <span><button type="button" class="hn-link" id="hn-all-open">Mở hết</button> · <button type="button" class="hn-link" id="hn-all-close">Thu gọn hết</button></span></div>
    ${tabs}${roles}${body}
    <div style="margin-top:6px"><a class="btn sm secondary" href="#/viec">Xem tất cả công việc</a></div></section>`;
}

// Đợt 2: lọc thẻ Mọi người theo cơ sở + chỉ quá hạn / chỉ chưa có người nhận (số đếm theo vai trò đang chọn)
function brFilter(V) {
  const base = byRole(V.E.items, ROLE); const S = branchSummary(base, V.codes); const cur = byBranch(base, BR);
  const nLate = cur.filter(isLate).length, nNone = cur.filter(isNone).length;
  return html`<div class="hn-roles hn-brs" id="hn-brs" aria-label="Lọc theo cơ sở">
      <button type="button" data-br="*" aria-pressed="${String(BR == null)}">Mọi cơ sở <span>${base.length}</span></button>${S.map((b) => html`<button type="button" data-br="${b.code}" aria-pressed="${String(BR === b.code)}">${b.name} <span>${b.n}</span>${b.late ? html`<em>${b.late} trễ</em>` : ''}</button>`)}</div>
    <div class="hn-roles hn-fl" id="hn-fl" aria-label="Chỉ xem">
      <button type="button" data-flag="late" aria-pressed="${String(FLAG === 'late')}">Chỉ việc quá hạn <span>${nLate}</span></button>
      <button type="button" data-flag="none" aria-pressed="${String(FLAG === 'none')}">Chỉ việc chưa có người nhận <span>${nNone}</span></button></div>`;
}
// Đợt 2: bảng "Theo cơ sở" trong ô Theo dõi — mỗi cơ sở: số việc đang mở · quá hạn · chưa có người nhận; bấm để xem ngay ở thẻ Mọi người
function coSoBlock(V) {
  if (!V.canAll) return '';
  if (V.E.failed) return html`<div class="sub">Theo cơ sở: chưa tải được việc của mọi người.</div>`;
  const S = branchSummary(V.E.items, V.codes);
  return html`<div class="stack" id="hn-coso" style="gap:6px"><div class="sub">Theo cơ sở — việc của mọi người đang mở (${V.E.items.length})</div>
    ${S.map((b) => html`<button type="button" class="hn-cs" data-br="${b.code}"><b>${b.name}</b><span class="hn-cs-n">${b.n} việc</span>
      <span class="hn-cs-f">${b.late ? html`<span class="pill hn-p-late">${b.late} quá hạn</span>` : ''}${b.none ? html`<span class="pill hn-p-today">${b.none} chưa có người nhận</span>` : ''}${!b.late && !b.none ? html`<span class="pill ok">${b.n ? 'Không trễ' : 'Không có việc'}</span>` : ''}</span><i>›</i></button>`)}</div>`;
}

function theoDoiBlock(pc, can, V) {
  const watch = pc?.watch || [];
  const w = (k) => html`<a class="hn-row ${rstate(k) === 3 ? 'waiting' : ''}" href="#/viec"><div class="grow"><div><span class="hn-tag">${k.handover ? 'Bàn giao ca' : 'Giao việc riêng'}</span><strong>${k.content}${k.code ? ' · ' + k.code : ''}</strong></div>
    ${rstate(k) === 3 ? html`<div><span class="pill mute">Chờ ${short(k.reviewer) || 'người kiểm tra'} kiểm tra</span></div>` : ''}${whoHtml({ text: short(k.assignee) || 'Chưa có người nhận', mine: false, none: !k.assignee })}</div>${dueHtml(k.due)}<i>›</i></a>`;
  return html`<details id="hn-theo-doi" class="card" ${innerWidth > 700 ? 'open' : ''}><summary><h2 style="margin:0;display:inline">Theo dõi</h2></summary>
    <div class="stack" style="gap:8px;margin-top:8px">
      ${coSoBlock(V)}
      ${watch.length ? html`<div class="sub">Việc bạn đã giao, chưa xong (${watch.length})</div>${watch.map(w)}`
        : html`<div class="sub">Không có việc bạn giao đang chờ người khác.</div>`}
      <div class="toolbar" style="gap:8px">
        ${can('hop_giao_viec') ? html`<a class="btn sm secondary" href="#/quan-ly/giao-viec">Tất cả công việc</a>` : ''}
        ${can('phan_cong') ? html`<a class="btn sm secondary" href="#/cong-viec/qua-han">Quá hạn & phạt</a>` : ''}
        <a class="btn sm secondary" href="#/cong-viec/dao-tao">Đào tạo</a>
        <a class="btn sm secondary" href="#/thong-bao">Thông báo${state.unread ? ` (${state.unread})` : ''}</a></div>
    </div></details>`;
}

function luongBlock(cong, ka) {
  if (!cong) return html`<section id="hn-luong" class="card stack" style="gap:8px"><h2 style="margin:0">Bảng lương của tôi</h2>
    <div class="alert warn">Chưa tải được giờ làm.</div><div><a id="hn-luong-more" class="btn sm secondary" href="#/cua-toi/cong">Xem chi tiết</a></div></section>`;
  const worked = cong.shifts.filter((x) => x.worked);
  const hours = worked.reduce((t, x) => t + Number(x.hours || 0), 0);
  const plus = cong.covers.filter((c) => !c.me_absent && c.x2).reduce((t, c) => t + Number(c.hours || 0), 0);
  const minus = cong.covers.filter((c) => c.me_absent).reduce((t, c) => t + Number(c.deduct_hours || 0), 0);
  const ml = `${cong.month.slice(5)}/${cong.month.slice(0, 4)}`;
  const kaM = (ka || []).filter((k) => k.status !== 'huy' && String(k.work_date || '').startsWith(cong.month));
  const notes = cong.covers.slice(0, 3);
  return html`<section id="hn-luong" class="card stack" style="gap:10px"><h2 style="margin:0">Bảng lương của tôi · tháng ${ml}</h2>
    <div class="hn-k"><div><span>Số ca</span><b>${worked.length}</b></div><div><span>Giờ thực tế</span><b>${h2(hours)}</b></div>
      <div><span>Giờ x2 cộng</span><b style="color:#15803d">${plus ? '+' + h2(plus) : '0'}</b></div><div><span>Giờ bị trừ</span><b style="color:#b91c1c">${minus ? '−' + h2(minus) : '0'}</b></div></div>
    ${notes.length ? html`<div class="stack" style="gap:4px"><strong>Ghi chú nghỉ / làm thay</strong>${notes.map((c) => html`<div class="sub">${dmy(c.date)} · ca ${c.shift} ${c.branch} · ${c.me_absent
      ? `nghỉ (${c.reason_label})${Number(c.deduct_hours) ? ` · trừ ${h2(c.deduct_hours)} giờ` : ''}` : `làm thay${c.absent ? ' ' + c.absent : ''} · ${h2(c.hours)} giờ${c.x2 ? ' · x2' : ''}`}</div>`)}</div>` : ''}
    <div class="stack" style="gap:4px"><strong>Khoản âm tháng này</strong>
      ${ka === null ? html`<div class="sub">Chưa tải được khoản âm.</div>` : kaM.length ? kaM.map((k) => html`<div class="hn-ka"><span>${dmy(k.work_date)} · ca ${k.shift} ${k.branch}</span>
        <b>−${vnd(k.amount)}</b><span class="pill ${KA_STATUS[k.status]?.[1] || 'mute'}">${KA_STATUS[k.status]?.[0] || k.status}${k.auto_tru ? ' (mặc định)' : ''}</span>
        ${kaCaLink(k) ? html`<a class="hn-link hn-ka-ca" href="${kaCaLink(k)}">Xem ca ›</a>` : ''}</div>`)
        : html`<div class="sub">Không có khoản âm.</div>`}</div>
    <div><a id="hn-luong-more" class="btn sm secondary" href="#/cua-toi/cong">Xem chi tiết</a></div></section>`;
}

export async function render({ me, can }) {
  const emp = !!me.employee_id;
  const isChu = me.role === 'chu';
  // Đợt 2 (27/11): thẻ Mọi người + Theo cơ sở mở cho ai có quyền xem Tất cả công việc (hop_giao_viec) — cùng dữ liệu với trang đó, không mở thêm quyền
  const canAll = isChu || can('hop_giao_viec');
  if (VIEW_OF !== me.account_id) { VIEW_OF = me.account_id; VIEW = isChu ? 'all' : 'mine'; ROLE = ''; BR = null; FLAG = ''; }
  const [T, todo, pc, training, ka, cong, more, pcAll, dtAll, plan] = await Promise.all([
    soft(rpc('app_today_me')),
    soft(rpc('app_home_todo')),
    can('nhan_viec') ? soft(rpc('app_pc_mine')) : Promise.resolve({ tasks: [], gv: [], watch: [] }),
    soft(rpc('app_dt_work_list', { p_mine: true })),
    emp ? soft(rpc('app_ka_mine')) : Promise.resolve([]),
    emp ? soft(rpc('app_cong_mine', { p_month: null })) : Promise.resolve(null),
    soft(rpc('app_today_more')),
    canAll ? soft(rpc('app_pc_all')) : Promise.resolve(null),
    canAll ? soft(rpc('app_dt_work_list', { p_mine: false })) : Promise.resolve(null),
    emp ? soft(rpc('app_dt_my_plan')) : Promise.resolve(null),
  ]);
  const hasPlan = !!(plan && ((plan.shifts || []).length || (plan.checks || []).length));
  if (pc) learnJobs(pc.tasks);
  if (pcAll) learnJobs(pcAll.tasks);
  const H = { jobName, pcDue, gvDue, rstate, curStep };
  const now = T?.now || pc?.now || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  NOW = now;
  const W = collectWork({ now, pc, training, ka, todo: todo ? todo.items || [] : null, today: T, more }, H);
  const today0 = T?.today || now.slice(0, 10);
  const V = { W, E: canAll ? everyoneWork(pcAll, dtAll, me.account_id, H) : null, done: more ? doneRows(more.done_today, today0, me.account_id) : null, isChu, canAll, me,
    codes: (pcAll?.branches || []).map((b) => b.code) };
  const order = T?.order && !T.order.submitted ? T.order : null;
  const watcher = ['chu', 'ql_tong', 'ql', 'ke_toan'].includes(me.role) || can('doi_soat') || can('ke_toan');
  const today = T?.today || now.slice(0, 10);
  return {
    title: 'Việc hôm nay',
    html: html`<style>
        .hn-wrap { max-width: 1000px; gap: 14px; }
        .hn-ca, .hn-row { display: flex; gap: 10px; align-items: center; min-width: 0; }
        .hn-ca { padding: 8px 0; border-top: 1px solid var(--line-soft); } .hn-ca:first-of-type { border-top: 0; }
        .hn-row { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-soft); border-left: 4px solid var(--line-strong); text-decoration: none; color: inherit; }
        .hn-row.late { border-left-color: #dc2626; } .hn-row.today { border-left-color: #f59e0b; } .hn-row.soon { border-left-color: #2563eb; } .hn-row.waiting { border-left-color: #94a3b8; }
        .hn-row .grow, .hn-ca .grow { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; } .hn-row i { font-style: normal; color: var(--muted); font-size: 20px; }
        .hn-due { font-size: 13px; color: var(--ink-2); white-space: nowrap; } .hn-row.late .hn-due { color: #b91c1c; font-weight: 600; }
        /* rà soát 20/11: trên điện thoại hạn xuống dòng dưới, tên việc chiếm hết bề ngang */
        @media (max-width: 600px) { .hn-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 8px; row-gap: 2px; } .hn-row > .grow { grid-column: 1; grid-row: 1; } .hn-row > i { grid-column: 2; grid-row: 1 / span 2; } .hn-row > .hn-due { grid-column: 1; grid-row: 2; }
          .hn-row.hn-bh { grid-template-columns: auto minmax(0, 1fr); } .hn-row.hn-bh > .hn-chev { grid-column: 1; grid-row: 1; } .hn-row.hn-bh > .grow { grid-column: 2; } .hn-row.hn-bh > .hn-due { grid-column: 2; } }
        .hn-top { display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
        .hn-link { border: 0; background: none; color: var(--primary); font-weight: 600; font-size: 13px; cursor: pointer; padding: 4px 2px; font-family: inherit; }
        .hn-grp { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--card); }
        .hn-gh { width: 100%; display: flex; align-items: center; gap: 10px; border: 0; background: var(--subtle); padding: 11px 12px; cursor: pointer; text-align: left; color: var(--ink); font: inherit; }
        .hn-gh:hover { background: var(--caramel-soft); } .hn-gh .grow { flex: 1 1 auto; min-width: 0; } .hn-gh b { font-size: 15px; }
        .hn-hint { display: block; font-size: 12px; color: var(--muted); }
        .hn-chev { width: 16px; height: 16px; flex: none; color: var(--muted); transition: transform .15s; }
        .hn-grp.open > .hn-gh .hn-chev, .hn-bundle.open > .hn-bh .hn-chev { transform: rotate(90deg); }
        .hn-ico { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex: none; font-size: 12px; font-weight: 700; background: var(--caramel-soft); color: var(--primary-dark); }
        .hn-ns .hn-ico { background: var(--sage-bg); color: var(--sage-ink); } .hn-kh .hn-ico { background: var(--info-bg); color: var(--info-ink); } .hn-done .hn-ico { background: var(--ok-bg); color: var(--ok-ink); }
        .hn-flags { display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; } .hn-gh > .hn-flags { margin-left: auto; max-width: 45%; }
        .hn-p-gap { background: #dc2626; color: #fff; } .hn-p-late { background: var(--off-bg); color: var(--off-ink); } .hn-p-today { background: var(--warn-bg); color: var(--warn-ink); }
        .hn-p-review { background: #b45309; color: #fff; }   /* UI-19: cam đậm, chữ trắng đọc được */ .hn-p-redo { background: #dc2626; color: #fff; }
        .hn-gbody { display: none; flex-direction: column; gap: 6px; padding: 8px; } .hn-grp.open > .hn-gbody { display: flex; }
        .hn-tag { display: inline-block; white-space: nowrap; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 6px; background: var(--line-soft); color: var(--ink-2); margin-right: 5px; }
        .hn-who { display: inline-block; font-size: 12px; font-weight: 600; color: var(--sage-ink); background: var(--sage-bg); border-radius: 999px; padding: 1px 8px; margin-top: 4px; max-width: 100%; overflow-wrap: anywhere; }
        .hn-who.other { color: var(--plum-ink); background: var(--plum-bg); } .hn-who.none { color: var(--warn-ink); background: var(--warn-bg); }
        .hn-row.review { border-left-color: #f59e0b; background: var(--warn-bg); } .hn-row.redo { border-left-color: #dc2626; background: var(--off-bg); }
        .hn-why { font-size: 12.5px; color: var(--off-ink); margin-top: 2px; }
        .hn-bundle { display: flex; flex-direction: column; gap: 6px; }
        .hn-bh { width: 100%; background: var(--card); cursor: pointer; text-align: left; font: inherit; } .hn-bh .hn-flags { justify-content: flex-start; margin-top: 2px; }
        .hn-count { display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--forest); color: #f5efe6; font-size: 12px; font-weight: 700; margin-left: 6px; }
        .hn-bkids { display: none; flex-direction: column; gap: 6px; margin-left: 12px; padding-left: 8px; border-left: 2px dashed var(--line-strong); } .hn-bundle.open > .hn-bkids { display: flex; }
        .hn-ok { border-left-color: #4f8a3c; } .hn-tick { width: 22px; height: 22px; border-radius: 50%; background: var(--ok-bg); color: var(--ok-ink); display: grid; place-items: center; flex: none; font-weight: 700; font-size: 13px; }
        .hn-tabs, .hn-roles { display: flex; gap: 6px; flex-wrap: wrap; }
        .hn-tabs { background: var(--line-soft); border-radius: 10px; padding: 3px; align-self: flex-start; }
        .hn-tabs button { border: 0; background: transparent; padding: 6px 10px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .hn-tabs button[aria-pressed="true"] { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(60,40,20,.12); }
        .hn-roles button { border: 1px solid var(--line-strong); background: var(--card); color: var(--ink-2); border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .hn-roles button span { color: var(--muted); font-weight: 500; } .hn-roles button[aria-pressed="true"] { background: var(--plum-ink); border-color: var(--plum-ink); color: #fff; } .hn-roles button[aria-pressed="true"] span { color: #f1e6ef; }
        @media (max-width: 520px) { .hn-gh { flex-wrap: wrap; } .hn-gh > .hn-flags { max-width: 100%; margin-left: 42px; justify-content: flex-start; } }
        .hn-k { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; } .hn-k div { border: 1px solid var(--line-soft); border-radius: 10px; padding: 8px 10px; }
        .hn-k span { display: block; font-size: 12px; color: var(--ink-2); } .hn-k b { font-size: 20px; }
        .hn-ka { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 14px; } .hn-ka span:first-child { flex: 1 1 160px; } .hn-ka b { color: #b91c1c; }
        .hn-order { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; } .hn-order small { font-weight: 400; opacity: .9; }
        #hn-theo-doi summary { cursor: pointer; list-style-position: inside; }
        .hn-brs button em { font-style: normal; font-size: 11px; font-weight: 700; color: #b91c1c; margin-left: 4px; } .hn-brs button[aria-pressed="true"] em { color: #fecaca; }
        .hn-fl button[aria-pressed="true"] { background: #b91c1c; border-color: #b91c1c; }
        .hn-cs { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; width: 100%; text-align: left; border: 1px solid var(--line-soft); border-radius: 12px; padding: 8px 10px; background: var(--card); color: inherit; font: inherit; cursor: pointer; }
        .hn-cs:hover { background: var(--caramel-soft); } .hn-cs b { min-width: 44px; } .hn-cs-n { font-size: 13px; color: var(--ink-2); } .hn-cs-f { display: flex; flex-wrap: wrap; gap: 4px; flex: 1 1 auto; justify-content: flex-end; min-width: 0; }
        .hn-cs i { font-style: normal; color: var(--muted); font-size: 18px; }
        .hn-cols { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 900px) { .hn-cols { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); align-items: start; } }
      </style>
      <div class="page-head"><div><h1>Việc hôm nay</h1><div class="sub">Xin chào, ${me.name} · ${ROLE_LABELS[me.role] || ''} · ${dmy(today)}</div></div>
        ${order ? html`<a id="hn-order" class="btn hn-order" href="#/order">Order ca tuần ${dmy(order.start_date)}<small>Hạn ${order.close_text || order.close_at}</small></a>` : ''}</div>
      <div class="stack hn-wrap">
        ${caBlock(T, can)}
        <div class="hn-cols">
          <div class="stack" style="gap:14px">${hasPlan ? myPlanHtml(plan) : ''}${viecBlock(V)}</div>
          <div class="stack" style="gap:14px">${watcher || canAll ? theoDoiBlock(pc, can, V) : ''}${emp ? luongBlock(cong, ka) : ''}</div>
        </div>
      </div>`,
    mount(root) {
      const O = loadOpen(me);
      const setOpen = (el, btn, key, open) => { el.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); O[key] = open; };
      const onClick = (e) => {
        const t = e.target;
        if (t.closest('#hn-retry')) { rerender(); return; }
        const gh = t.closest('.hn-gh');
        if (gh) { const s = gh.closest('.hn-grp'); setOpen(s, gh, 'cat:' + s.dataset.cat, !s.classList.contains('open')); saveOpen(me, O); return; }
        const bh = t.closest('.hn-bh');
        if (bh) { const b = bh.closest('.hn-bundle'); setOpen(b, bh, 'b:' + b.dataset.b, !b.classList.contains('open')); saveOpen(me, O); return; }
        if (t.closest('#hn-all-open, #hn-all-close')) {
          const open = !!t.closest('#hn-all-open');
          $$('#hn-viec .hn-grp', root).forEach((x) => setOpen(x, x.querySelector('.hn-gh'), 'cat:' + x.dataset.cat, open));
          $$('#hn-viec .hn-bundle', root).forEach((x) => setOpen(x, x.querySelector('.hn-bh'), 'b:' + x.dataset.b, open));
          saveOpen(me, O); return;
        }
        const tv = t.closest('#hn-tabs [data-view]'); const tr = t.closest('#hn-roles [data-role]');
        const tb = t.closest('#hn-brs [data-br]'); const tf = t.closest('#hn-fl [data-flag]'); const cs = t.closest('#hn-coso [data-br]');
        if (tv || tr || tb || tf || cs) {
          if (tv) { VIEW = tv.dataset.view; ROLE = ''; BR = null; FLAG = ''; }
          else if (tr) ROLE = tr.dataset.role;
          else if (tb) BR = tb.dataset.br === '*' ? null : tb.dataset.br;
          else if (tf) FLAG = FLAG === tf.dataset.flag ? '' : tf.dataset.flag;
          else { VIEW = 'all'; ROLE = ''; FLAG = ''; BR = cs.dataset.br; }   // bấm một cơ sở ở ô Theo dõi → thẻ Mọi người, lọc đúng cơ sở đó
          $('#hn-viec', root).outerHTML = str(viecBlock(V));
          if (cs) $('#hn-viec', root).scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      };
      root.addEventListener('click', onClick);   // #root dùng chung mọi trang → gỡ khi rời trang
      const offPlan = hasPlan ? mountMyPlan(root, plan, rerender) : () => {};
      return () => { root.removeEventListener('click', onClick); offPlan(); };
    },
  };
}
