// Trang đối soát ca mới (#/ca/doi-soat-moi?id=<ca>), chạy song song trang cũ (#/ca/doi-soat?id=). Đợt 1: xem · đợt 2: sửa tại chỗ (luật mới máy chủ tệp 173 —
// sửa tự do tới khi Hoàn thành; rpc() tự đổi hàm sửa tiền sang app_ds2_*, xem ds2.js) · đợt 3: Hoàn thành gộp, Mở lại, Duyệt phần việc.
// Khối số máy Fabi / nợ của ca / tiền mặt đếm và mọi hộp thoại dùng lại của Sổ thu chi (stcMoi / stcPart / stcBind); lưu xong: tích / Để sau / chọn nhóm
// đổi tại chỗ, thao tác khác đọc lại dữ liệu của ca rồi vẽ lại riêng phần thân #dsm-body (không vẽ lại cả trang).
// Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md · Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-1.md
// 3 trang: ① Phần việc · ② Tiền (Số máy Fabi, Tiền mặt, Chuyển khoản — từng khoản thu / chi và tổng) · ③ Hoàn thành (còn thiếu, xác nhận).
// Đọc: app_ca_get, sổ tháng của Sổ thu chi (app_stc_month + app_stc_people), app_ca_ds_tuan một ngày, app_ca_ds_con; số tính bằng hàm của Sổ thu chi nên khớp trang cũ.
import { rpc } from '../sb.js';
import { $, $$, dialog, html, raw, showSaved, str } from '../ui.js';
import { fmt, parseMoney } from '../tien.js';
import { CV_CSS, mountCover } from '../nghi_thay.js?v=2026.11.24.3';
import { DG_CSS, mountReportEval } from '../danh_gia.js';
import { SHIFT_ORDER, caGaps, dsChecks, dsCtx } from '../so_thu_chi_tinh.js';
import { stcBind, stcCatSelect, stcGap, stcMoi, stcPart, stcStyle } from './so_thu_chi.js?v=2026.11.24.3';   // cùng bản với trang cũ (phieu_ca.js); số ?v= tăng khi phát hành
import { CHK_LABEL, WORK_LABEL, canStep, caBook, confirmKeys, confirmList, firstStep, mergeRecon, missingList, moneyLeftList, pageState, staffPayload, stepState, workParts } from '../doi_soat_moi_tinh.js';

export const perm = 'doi_soat';

const TABS = [['viec', '① Phần việc'], ['tien', '② Tiền'], ['xong', '③ Hoàn thành']];
const WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const dayName = (iso) => { const s = String(iso || ''); const d = new Date(s + 'T00:00:00'); return `${WD[d.getDay()] || ''} ${s.slice(8, 10)}/${s.slice(5, 7)}`; };
const rank = (s) => { const i = SHIFT_ORDER.indexOf(s); return i < 0 ? 99 : i; };
const money = (n) => fmt(n) || '0';
const signedM = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const HAND = { khop: 'Khớp', lech: 'Lệch', can_dem_lai: 'Lệch — cần đếm lại cùng người ca trước', cho_ca_truoc: 'Chờ ca trước gửi phiếu', chua_dem: 'Chưa đếm nhận két',
  khong_ca_truoc: 'Không có ca trước', rut_quy: 'Khớp (phần dư nộp quỹ khi giao ca)' };

const CSS = `<style>
.dsm{--dsm-thu-bg:#edf6e8;--dsm-thu-line:#8fbf7a;--dsm-thu-ink:#24502a;--dsm-chi-bg:#fdeeec;--dsm-chi-line:#e7a39b;--dsm-chi-ink:#8a2a22;display:grid;gap:12px;max-width:760px;margin:0 auto}
.dsm-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
.dsm-head h1{margin:0;font-size:22px;line-height:1.25;min-width:0}
.dsm-head h1 small{display:block;font-size:13px;font-weight:400;color:var(--muted)}
.dsm-tools{display:flex;gap:8px;flex-wrap:wrap}
.dsm-note{background:var(--warn-bg);border:1px solid var(--warn-line);color:var(--warn-ink);border-radius:12px;padding:9px 12px;font-size:14px}
.dsm-note a{color:var(--warn-ink);font-weight:700}
.dsm-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.dsm-tabs button{min-height:44px;border-radius:10px;border:1px solid var(--line-strong);background:var(--card);color:var(--ink-2);font:inherit;font-size:14px;font-weight:700;padding:4px 6px;cursor:pointer;line-height:1.2}
.dsm-tabs button[aria-selected="true"]{background:var(--forest);border-color:var(--forest);color:#fffdfa}
.dsm-tabs .mk{display:block;font-size:12px;font-weight:600}
.dsm-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;gap:8px;min-width:0}
.dsm-card h2{margin:0;font-size:15px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
.dsm-chip{display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;border-radius:999px;padding:2px 9px}
.dsm-chip.ok{background:var(--ok-bg);color:var(--ok-ink)}.dsm-chip.warn{background:var(--warn-bg);color:var(--warn-ink)}.dsm-chip.off{background:var(--off-bg);color:var(--off-ink)}.dsm-chip.kt{background:var(--subtle);color:var(--muted)}
.dsm-row{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
.dsm-row>span{min-width:0;color:var(--ink-2);overflow-wrap:anywhere}
.dsm-row>b{font-variant-numeric:tabular-nums;white-space:nowrap}
.dsm-sub{font-size:12.5px;color:var(--muted)}
.dsm-grp{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-top:4px}
.dsm-grp.thu{color:var(--dsm-thu-ink)}.dsm-grp.chi{color:var(--dsm-chi-ink)}
.dsm-it{border:1px solid var(--line-strong);border-radius:10px;padding:7px 10px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 10px}
.dsm-it.thu{background:var(--dsm-thu-bg);border-color:var(--dsm-thu-line)}.dsm-it.chi{background:var(--dsm-chi-bg);border-color:var(--dsm-chi-line)}
.dsm-it .k{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.dsm-it.thu .k,.dsm-it.thu .a{color:var(--dsm-thu-ink)}.dsm-it.chi .k,.dsm-it.chi .a{color:var(--dsm-chi-ink)}
.dsm-it .t{overflow-wrap:anywhere;color:var(--ink)}
.dsm-it .a{grid-row:1/span 2;grid-column:2;align-self:center;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.dsm-it .m{grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;gap:6px;flex-wrap:wrap}
.dsm-who{border:1px solid var(--line);border-radius:6px;padding:0 5px;background:var(--card)}
.dsm-tot{border-top:1px dashed var(--line-strong);padding-top:3px;font-weight:700}
.dsm-tot.thu span,.dsm-tot.thu b{color:var(--dsm-thu-ink)}.dsm-tot.chi span,.dsm-tot.chi b{color:var(--dsm-chi-ink)}
.dsm-must{border-top:1.5px solid var(--ink-2);padding-top:4px;font-weight:700}
.dsm-gap.bad b{color:var(--off-ink)}.dsm-gap.ok b{color:var(--ok-ink)}
.dsm-tick{display:flex;gap:7px;align-items:flex-start;font-size:13.5px}
.dsm-tick i{font-style:normal;width:18px;flex:none}
#dsm-missing{margin:0;padding-left:20px;display:grid;gap:4px}
#dsm-missing li{cursor:pointer;color:var(--off-ink)}
#dsm-missing li span{color:var(--muted);font-size:12.5px}
.dsm-confirm{background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:12px;padding:10px 12px;display:grid;gap:4px}
.dsm-confirm ol{margin:0;padding-left:20px}
.dsm-nav{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.dsm-tk{width:100%;text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--card);padding:7px 10px;font:inherit;cursor:pointer;color:var(--ink)}
.dsm-tk[aria-pressed="true"]{background:var(--ok-bg);color:var(--ok-ink)}
.dsm-tk:disabled{cursor:default;opacity:.7}
.dsm-it[data-ed]{cursor:pointer}.dsm-it[data-ed]:hover{filter:brightness(.97)}
.dsm-it .m select{max-width:100%;min-width:0}
.dsm-add{justify-self:start}
.dsm-gl{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;border:1px dashed var(--line-strong);border-radius:10px;padding:7px 10px}
.dsm-gl span{min-width:0;overflow-wrap:anywhere}
.dsm-old{min-width:0;overflow-wrap:anywhere}.dsm-old .stc-part{margin:0}
.stc-moi-hide{display:none!important}
.dsm-st{display:grid;gap:4px;border-bottom:1px dashed var(--line);padding-bottom:6px}.dsm-st:last-of-type{border-bottom:0}
.dsm-stb{justify-self:start}
.dsm-ho{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:10px;padding:7px 10px}
.dsm-ho>span:first-child{min-width:0;overflow-wrap:anywhere;flex:1 1 200px}.dsm-hoa{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dsm-err2:not(:empty){background:var(--off-bg);color:var(--off-ink);border:1px solid var(--off-line,var(--line));border-radius:10px;padding:9px 12px;white-space:pre-wrap}
.dsm-after{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsm-step{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:10px}
.dsm-step>.dsm-sub,.dsm-step>.dsm-left{flex-basis:100%}
.dsm-left ul{margin:4px 0 0;padding-left:20px}.dsm-left li{color:var(--off-ink)}
.dsm-tabs button[data-lock]{opacity:.55}
</style>`;

// ô tích: k = mã mục quản lý tự tích → nút bấm được (bộ bắt sự kiện của Sổ thu chi gọi app_stc_tick); không k → chỉ hiện trạng thái
const tick = (on, text, k = null, ro = false) => (k ? html`<button type="button" class="dsm-tick dsm-tk" data-tick="${k}" aria-pressed="${on ? 'true' : 'false'}" ${ro ? raw('disabled') : ''}><i>${on ? '✓' : '☐'}</i><span>${text}</span></button>`
  : html`<div class="dsm-tick"><i>${on ? '✓' : '☐'}</i><span>${text}</span></div>`);

// ---------------- nạp dữ liệu ----------------
let REFRESH = null;   // móc Sổ thu chi gọi sau mỗi lần lưu (đặt khi mount)
async function loadShift(id) {
  const R0 = await rpc('app_ca_get', { p_id: id });
  const R = R0;
  const [M, ds, con, RC] = await Promise.all([
    stcMoi({ cn: R.branch_id, thang: String(R.work_date).slice(0, 7), ds: id, hook: (msg, info) => (REFRESH ? REFRESH(msg, info) : null) })
      .then((x) => x, (e) => ({ err: e.message || String(e) })),
    rpc('app_ca_ds_tuan', { p_branch: R.branch_id, p_from: R.work_date, p_to: R.work_date }).catch(() => []),
    rpc('app_ca_ds_con', { p_branch: R.branch_id }).catch(() => []),
    rpc('app_ca_recon', { p_id: id }).catch(() => null),   // đợt 4: phần việc theo bản đối soát (quản lý đã sửa), như trang cũ
  ]);
  const D = M.D || null; const a = M.a || null;
  const ca = a ? a.c : D ? (D.cas || []).find((c) => Number(c.id) === Number(id)) || null : null;
  const dsRow = (ds || []).find((x) => Number(x.id) === Number(id)) || null;
  const err = M.err || (D && !ca ? 'Chưa có số liệu phần tiền của ca này (ca chưa có trong sổ tháng của cơ sở).' : null);
  const RR = mergeRecon(R0, RC);
  return { R: RR, D, a, ca, dsRow, con: con || [], err, st: ca ? pageState(D, ca, RR, dsRow) : null };
}

function nextUnfinished(con, R) {   // như trang cũ (phieu_ca.js)
  const ok = (x) => x.st !== 'kt' && Number(x.id) !== Number(R.id);
  const i = con.findIndex((x) => Number(x.id) === Number(R.id));
  if (i >= 0) return [...con.slice(i + 1), ...con.slice(0, i)].find(ok) || null;
  const key = (x) => `${x.date || x.work_date}|${rank(x.shift)}`; const me = key(R);
  return con.filter(ok).find((x) => key(x) > me) || con.find(ok) || null;
}

// ---------------- trạng thái từng phần ----------------
const workMark = (S) => { const left = S.st ? S.st.viec.left : Object.keys(WORK_LABEL).filter((k) => !(S.R.checks || {})[k]).map((k) => WORK_LABEL[k]); return left; };
const gapChip = (b) => (b.real == null ? html`<span class="dsm-chip kt">⏳ chờ kế toán</span>`
  : Math.abs(b.gap) <= 5000 ? html`<span class="dsm-chip ok">✓ khớp${b.gap ? ' (lệch nhỏ ' + signedM(b.gap) + ')' : ''}</span>`
  : html`<span class="dsm-chip ${b.gap < 0 ? 'off' : 'warn'}">⚠ ${b.gap < 0 ? 'thiếu' : 'dư'} ${fmt(Math.abs(b.gap))}</span>`);
// đi lần lượt 3 bước (anh Tiến 24/11): bước sau khoá 🔒 tới khi xong bước trước
const stepOf = (S) => stepState(S.D, S.ca, S.R, S.dsRow);
const tabMark = (S, k) => {
  const st = stepOf(S); if (!canStep(st, k)) return '🔒';
  if (k === 'viec') { if (st.viec) return '✓'; const l = workMark(S); return l.length ? `⚠ ${l.length}` : '⚠'; }
  if (k === 'tien') { if (!S.st) return '!'; if (st.wait) return '⏳'; return st.tien ? '✓' : `⚠ ${S.st.tien.left}`; }
  return st.xong ? '✓ xong' : '';
};

// ---------------- trang ① Phần việc ----------------
// Đợt 4: làm đủ phần việc ngay tại trang (không dẫn sang trang cũ): sửa / thêm / bỏ người làm (bản đối soát), nghỉ & làm thay, đánh giá,
// công việc bàn giao cho ca sau (giao thành việc), Duyệt phần việc. Đã đối soát (recon_status hoàn thành): máy chủ chặn sửa → chỉ xem.
const hm = (x) => (x ? String(x).slice(0, 5) : '');
const isW = (s) => !(s.worked === 0 || s.worked === false);
function viecPane(S) {
  const R = S.R; const staff = R.staff || []; const ho = R.handover || [];
  const ro = R.recon_status === 'hoan_thanh';
  const odd = staff.some((s) => !isW(s) || (s.source && s.source !== 'lich'));
  const h = R.cash_hand; const wp = workParts(R); const done = !!(S.ca && S.ca.done);
  return html`<section class="dsm-card"><h2>Nhân viên <span class="dsm-sub">${staff.filter(isW).length} người làm</span></h2>
      ${staff.length ? staff.map((s, i) => { const nm = `${s.code ? s.code + ' – ' : ''}${s.name || 'NV ' + s.employee_id}`;
        return html`<div class="dsm-st"><div class="dsm-row"><span>${nm}${s.source && s.source !== 'lich' ? html` <span class="dsm-sub">(hỗ trợ / ngoài lịch)</span>` : ''}${s.pay_cash ? html` <span class="dsm-sub">· trả lương tiền mặt${s.cash_paid ? ' ' + money(s.cash_paid) : ''}</span>` : ''}</span>
          <b>${isW(s) ? `${hm(s.time_in) || '—'} – ${hm(s.time_out) || '—'}` : 'Nghỉ' + (s.absent_reason ? ': ' + s.absent_reason : '')}</b></div>
          ${s.note ? html`<div class="dsm-sub">Ghi chú: ${s.note}</div>` : ''}
          ${ro ? '' : html`<button type="button" class="btn sm secondary dsm-stb" data-dsmst="${i}">Sửa</button>`}</div>`; })
        : html`<div class="dsm-sub">Phiếu chưa có nhân viên.</div>`}
      ${ro ? '' : html`<button type="button" class="btn sm secondary dsm-add" id="dsm-staffadd">+ Thêm người hỗ trợ</button>`}
      ${(R.checks || {}).nhan_su && !ro ? html`<div class="dsm-sub">Nhân sự đã duyệt — sửa người làm thì web tự bỏ duyệt Nhân sự, duyệt lại ở nút Duyệt phần việc.</div>` : ''}</section>
    <section class="dsm-card"><h2>Nghỉ & làm thay ${odd ? '' : html`<span class="dsm-sub">không ai nghỉ / làm thay</span>`}</h2><div id="dsm-cv-sum"></div><div id="dsm-cv"></div></section>
    <section class="dsm-card"><div id="dsm-dg"></div></section>
    <section class="dsm-card"><h2>Bàn giao ca</h2>
      ${!h ? html`<div class="dsm-row"><span>Nhận két ca trước</span><b>Ca đầu ngày</b></div>`
        : html`<div class="dsm-row"><span>Nhận két ca trước</span><b>${HAND[h.state] || h.state || '—'}</b></div>
          ${h.counted != null ? html`<div class="dsm-row"><span>Ca này đếm nhận</span><b>${money(h.counted)}</b></div>` : ''}
          ${h.prev_cash != null ? html`<div class="dsm-row"><span>Ca trước để lại</span><b>${money(h.prev_cash)}</b></div>` : ''}
          ${h.gap ? html`<div class="dsm-row"><span>Lệch khi giao két</span><b>${signedM(h.gap)}</b></div>` : ''}`}
      <div class="dsm-row"><span>Hàng kho tổng nhận trong ca</span><b>${R.goods_status === 'khong' || !R.goods_status ? 'không có' : R.goods_status}</b></div></section>
    <section class="dsm-card"><h2>Công việc bàn giao cho ca sau <span class="dsm-sub">${ho.length} việc</span></h2>
      ${ho.length ? ho.map((x, i) => html`<div class="dsm-ho"><span>${x.content || ''}</span><span class="dsm-hoa">${x.done_at ? html`<span class="dsm-chip ok">Đã xong</span>` : x.task_id ? html`<span class="dsm-chip warn">Đã giao việc${x.task_assignee ? ' cho ' + x.task_assignee : ''}</span>` : ''}
          ${!ro && !x.task_id && !x.done_at ? html`<button type="button" class="btn sm secondary" data-dsmho="${i}">Sửa</button>` : ''}
          ${!ro && R.can_recon && x.id && !x.task_id && !x.done_at ? html`<button type="button" class="btn sm secondary" data-dsmgiao="${x.id}">+ Giao thành việc</button>` : ''}</span></div>`)
        : html`<div class="dsm-sub">Không có việc bàn giao.</div>`}
      ${ro ? '' : html`<button type="button" class="btn sm secondary dsm-add" id="dsm-hoadd">+ Thêm việc bàn giao</button>`}</section>
    <section class="dsm-card"><h2>Duyệt phần việc</h2>
      ${Object.keys(WORK_LABEL).map((k) => tick(!!(R.checks || {})[k], WORK_LABEL[k] + ((R.checks || {})[k] ? ' — đã duyệt' : ' — chưa duyệt')))}
      ${workMark(S).length ? html`<div class="dsm-sub">Còn: ${workMark(S).join(', ')}.</div>` : ''}
      ${wp.blocked.map((t) => html`<div class="alert warn">⚠ ${t} — nhân viên ca này cùng người ca trước đếm lại ở <a href="#/ca/phieu?id=${R.id}">phiếu chốt ca ›</a></div>`)}
      </section>
    <div class="dsm-step">${wp.parts.length && !done && !ro && !wp.blocked.length
        ? html`<button type="button" class="btn" id="dsm-next1">✓ Duyệt phần việc (${wp.parts.map((k) => WORK_LABEL[k]).join(', ')}), sang bước 2: Tiền ›</button>`
        : html`<button type="button" class="btn" id="dsm-next1" ${wp.blocked.length && !done ? raw('disabled') : ''}>Sang bước 2: Tiền ›</button>`}
      ${wp.blocked.length && !done ? html`<div class="dsm-sub">Chưa sang bước 2 được: ${wp.blocked.join(', ')}.</div>` : ''}</div>`;
}

// ---------------- trang ② Tiền ----------------
// khoản của ca sửa / xoá được ở trang mới: như máy chủ cho (can_edit) + luật mới — phiếu ca thu khác / chi và luân chuyển, khi ca chưa Hoàn thành
const canEd = (D, ca, it) => !!it && !it.void && !D.locked && !D.ext && !ca.done
  && (it.can_edit || (it.src === 'move' && it.meta === 'Phiếu ca' && ['chi', 'khac'].includes(it.col)) || (it.src === 'move' && it.col === 'lc'));
function bookSec(S, b, pm, ticks) {
  const { D, ca } = S; const isTm = pm === 'tm'; const ro = !!D.locked || !!ca.done;
  const item = (x) => (D.items || []).find((i) => i.id === x.id);
  const box = (x, cls) => { const it = item(x); const ed = canEd(D, ca, it); const sel = cls === 'chi' && x.col === 'chi' && it ? stcCatSelect(D, it) : null;
    return html`<div class="dsm-it ${cls}" ${ed ? raw(`data-ed="${String(x.id).replace(/["<>&]/g, '')}" role="button" tabindex="0"`) : ''}><span class="k">${x.kind}</span><span class="a">${cls === 'thu' ? '+' : '−'}${money(x.amount)}</span><span class="t">${x.title || '—'}</span>
    <span class="m"><span class="dsm-who">${x.who}</span>${sel || (cls === 'chi' && x.col === 'chi' ? (x.cat ? html`<span>Nhóm: ${x.cat}</span>` : html`<span style="color:var(--off-ink)">chưa chọn nhóm</span>`) : '')}${ed ? html`<span>· bấm để sửa / xoá</span>` : ''}</span></div>`; };
  const addBtn = (book) => (ro ? '' : html`<button type="button" class="btn sm secondary dsm-add" data-addca="${ca.id}" data-book="${book}">+ Thêm khoản ${book === 'thu' ? 'thu' : 'chi'}</button>`);
  const realLabel = isTm ? (ca.cash_mode === 'ca' ? 'Quản lý đếm được' : 'Tiền mặt trong két') : 'Ngân hàng nhận (kế toán nhập)';
  const gl = (D.items || []).filter((x) => x.ca_id === ca.id && x.col === 'lech' && !x.void && x.pm === pm);
  const pend = caGaps(D.items || [], ca.id).some((g) => g.pm === pm && !(g.small || g.done || g.wait));
  const sau = (ca.ticks || []).includes('sau_' + pm);
  return html`<section class="dsm-card dsm-sec" data-pm="${pm}"><h2>${isTm ? 'Tiền mặt' : 'Chuyển khoản'} ${gapChip(b)}</h2>
    ${isTm ? html`<div class="dsm-row"><span>Mở ca</span><b>${money(b.start)}</b></div>` : ''}
    <div class="dsm-row"><span>+ Bán ${isTm ? 'tiền mặt' : 'chuyển khoản'} (máy Fabi)</span><b>${money(b.ban)}</b></div>
    <div class="dsm-grp thu">Khoản thu</div>
    ${b.thu.length ? b.thu.map((x) => box(x, 'thu')) : html`<div class="dsm-sub">không có</div>`}
    ${addBtn('thu')}
    <div class="dsm-row dsm-tot thu"><span>Tổng thu</span><b>${money(b.tongThu)}</b></div>
    <div class="dsm-grp chi">Khoản chi</div>
    ${b.chi.length ? b.chi.map((x) => box(x, 'chi')) : html`<div class="dsm-sub">không có</div>`}
    ${addBtn('chi')}
    <div class="dsm-row dsm-tot chi"><span>Tổng chi</span><b>${money(b.tongChi)}</b></div>
    <div class="dsm-row dsm-must" data-pm="${pm}" data-v="${b.must}"><span>= ${isTm ? 'Phải có' : 'Phải nhận'}</span><b>${money(b.must)}</b></div>
    <div class="dsm-row"><span>${realLabel}</span><b>${b.real == null ? '⏳ chờ kế toán' : money(b.real)}</b></div>
    <div class="dsm-row dsm-gap ${b.real == null ? '' : Math.abs(b.gap) <= 5000 ? 'ok' : 'bad'}" data-pm="${pm}"><span>Lệch = thực nhận − ${isTm ? 'phải có' : 'phải nhận'}</span><b>${b.real == null ? '—' : b.gap === 0 ? '✓ khớp' : signedM(b.gap)}</b></div>
    ${gl.map((x) => html`<div class="dsm-gl"><span>${x.title || 'Chênh lệch'} <b>${money(x.amount)}</b>${x.status ? html` · <span class="dsm-sub">${x.status}</span>` : ''}</span>${x.gap && !D.locked ? html`<button type="button" class="btn sm" data-dsmgap="${x.id}">Xử lý lệch</button>` : ''}</div>`)}
    ${pend && !ro ? html`<button type="button" class="dsm-tick dsm-tk" data-dssau="${pm}" aria-pressed="${sau ? 'true' : 'false'}"><i>${sau ? '✓' : '☐'}</i><span>Để sau (xử lý lệch sau — ca hiện 🟠 tới khi xong)</span></button>` : ''}
    ${ticks}</section>`;
}
function tienPane(S) {
  if (S.err) return html`<div class="alert warn dsm-err">${S.err}</div><div class="dsm-step"><button type="button" class="btn secondary" id="dsm-back1">‹ Bước 1</button></div>`;
  const { D, ca, a } = S; const ro = !!D.locked || !!ca.done;
  const st = stepOf(S); const left = st.tien ? [] : moneyLeftList(D, ca);
  const all = dsChecks(ca, dsCtx(D, ca)).flat(); const has = (k) => all.find((x) => x.k === k);
  const mt = (k) => { const x = has(k); return x ? tick(x.ok, CHK_LABEL[k], x.auto ? null : k, ro) : ''; };
  const mk = (k) => { const x = has(k); return !x ? '' : html`<i class="stc-mk ${x.ok ? 'ok' : ''}">${x.ok ? '✓' : '!'}</i>`; };
  const gaps = caGaps(D.items || [], ca.id);
  const gapTicks = (pm) => html`${gaps.some((g) => g.pm === pm && !g.small) ? mt('ld') : ''}`;
  const book = caBook(D, ca);
  return html`<div class="stc-dsp dsm-old">${a ? stcPart(D, a, 1, mk) : ''}</div>
    <section class="dsm-card"><h2>Quản lý kiểm tra (số máy Fabi, nợ)</h2>${mt('anh')}${mt('hd')}${mt('phanloai')}${mt('tn')}</section>
    <div class="stc-dsp dsm-old">${a ? stcPart(D, a, 2, mk) : ''}</div>
    ${bookSec(S, book.tm, 'tm', html`${mt('cash')}${mt('goi')}${mt('ket')}${mt('sot')}${mt('cat')}${mt('that')}${mt('lon')}${mt('tm')}${gapTicks('tm')}`)}
    ${bookSec(S, book.ck, 'ck', html`${mt('ck')}${mt('ck5')}${gapTicks('ck')}`)}
    <div class="dsm-step"><button type="button" class="btn secondary" id="dsm-back1">‹ Bước 1</button><button type="button" class="btn" id="dsm-next2" ${st.tien ? '' : raw('disabled')}>Xong tiền, sang bước 3: Hoàn thành ›</button>
      ${st.tien ? '' : st.wait ? html`<div class="dsm-sub">⏳ Chờ kế toán (file Fabi / số ngân hàng) — chưa sang Hoàn thành được.</div>`
        : html`<div class="dsm-left"><b>Còn ${left.length} mục ở bước này:</b><ul>${left.map((t) => html`<li>${t}</li>`)}</ul></div>`}</div>`;
}

// ---------------- trang ③ Hoàn thành ----------------
function xongPane(S) {
  const { R } = S;
  const miss = S.ca ? missingList(S.D, S.ca, R, S.dsRow) : workMark(S).map((t) => ({ page: 'viec', k: 'viec', text: t }));
  const conf = S.ca ? confirmList(S.D, S.ca) : [];
  const book = S.ca ? caBook(S.D, S.ca) : null;
  const wl = workMark(S); const wp = workParts(R); const done = !!(S.ca && S.ca.done); const ro = !S.D || !!S.D.locked || !S.ca;
  return html`<section class="dsm-card"><h2>Tóm tắt ${done ? html`<span class="dsm-chip ok">✓ Đã hoàn thành đối soát</span>` : ''}</h2>
      <div class="dsm-row"><span>① Phần việc</span><b>${wl.length ? '⚠ còn ' + wl.join(', ') : '✓ đã duyệt'}</b></div>
      ${book ? html`<div class="dsm-row"><span>Tiền mặt</span>${gapChip(book.tm)}</div><div class="dsm-row"><span>Chuyển khoản</span>${gapChip(book.ck)}</div>` : html`<div class="dsm-sub">${S.err || ''}</div>`}</section>
    ${done ? html`<section class="dsm-card"><h2>Đã hoàn thành đối soát ca</h2>
        <div class="dsm-sub">Muốn sửa: bấm Mở lại — bỏ dấu Hoàn thành và mục tiền (ca về "chưa xong", sửa được ngay), dấu duyệt phần việc giữ nguyên.</div>
        ${ro ? '' : html`<button type="button" class="btn secondary" id="dsm-reopen">Mở lại</button>`}</section>`
      : html`${miss.length ? html`<section class="dsm-card"><h2>Còn thiếu</h2>
      <ul id="dsm-missing">${miss.map((x) => html`<li data-go="${x.page}">${x.text} <span>· ${x.page === 'viec' ? 'bước 1' : 'bước 2'}</span></li>`)}</ul></section>` : ''}
    ${conf.length || wp.parts.length ? html`<section class="dsm-confirm"><b>Bấm Hoàn thành là xác nhận đã:</b><ol>${conf.map((t) => html`<li>${t}</li>`)}${wp.parts.length ? html`<li>Duyệt phần việc: ${wp.parts.map((k) => WORK_LABEL[k]).join(', ')}</li>` : ''}</ol>
      <div class="dsm-sub">Web cũng tự xác nhận số Fabi (không còn nút Xác nhận Fabi). Thiếu gì thì báo, không lưu gì.</div></section>` : ''}
    <div id="dsm-finerr" class="dsm-err2" role="alert"></div>
    ${ro ? '' : html`<button type="button" class="btn" id="dsm-done">Hoàn thành</button>`}`}
    <div id="dsm-after"></div>
    <div class="dsm-step"><button type="button" class="btn secondary" id="dsm-back2">‹ Bước 2</button></div>`;
}

// ---------------- khung trang ----------------
function body(S, active) {
  const R = S.R; const cas = S.D ? (S.D.cas || []).slice().sort((a, b) => (a.date === b.date ? rank(a.shift) - rank(b.shift) : a.date < b.date ? -1 : 1)) : [];
  const i = cas.findIndex((c) => Number(c.id) === Number(R.id)); const prev = i > 0 ? cas[i - 1] : null; const next = i >= 0 && i < cas.length - 1 ? cas[i + 1] : null;
  const nx = nextUnfinished(S.con, R);
  return html`<nav class="dsm-tabs" aria-label="Các trang đối soát">${TABS.map(([k, t]) => html`<button type="button" data-dsm-tab="${k}" aria-selected="${k === active ? 'true' : 'false'}" ${canStep(stepOf(S), k) ? '' : raw('data-lock="1"')}>${t}<span class="mk">${tabMark(S, k)}</span></button>`)}</nav>
    <div data-dsm-pane="viec" class="dsm" ${active === 'viec' ? '' : raw('hidden')}>${viecPane(S)}</div>
    <div data-dsm-pane="tien" class="dsm" ${active === 'tien' ? '' : raw('hidden')}>${tienPane(S)}</div>
    <div data-dsm-pane="xong" class="dsm" ${active === 'xong' ? '' : raw('hidden')}>${xongPane(S)}</div>
    <div class="dsm-nav">${prev ? html`<a class="btn sm secondary" href="#/ca/doi-soat?id=${prev.id}">‹ Ca trước</a>` : html`<span></span>`}
      ${nx ? html`<a class="btn sm" href="#/ca/doi-soat?id=${nx.id}">Ca tiếp theo chưa xong ›</a>` : ''}
      ${next ? html`<a class="btn sm secondary" href="#/ca/doi-soat?id=${next.id}">Ca sau ›</a>` : html`<span></span>`}</div>`;
}
// mở ca: vào bước đầu còn việc (ca đã Hoàn thành / xong cả 2 bước → bước 3)
const firstTab = (S) => firstStep(stepOf(S));

export async function render({ params }) {
  const id = Number(params.id);
  if (!id) return { title: 'Đối soát ca', html: html`<div class="card">Thiếu mã ca.</div>` };
  let S = await loadShift(id);
  const R = S.R;
  let active = ['viec', 'tien', 'xong'].includes(params.tab) && canStep(stepOf(S), params.tab) ? params.tab : firstTab(S);
  const title = `Ca ${R.shift} · ${dayName(R.work_date)} · ${R.branch_code || ''}`;
  return {
    title: `Đối soát ca mới · ${R.shift} ${String(R.work_date).slice(8, 10)}/${String(R.work_date).slice(5, 7)}`,
    html: html`${raw(CSS)}${stcStyle()}${CV_CSS}${DG_CSS}<div id="dsm" class="dsm">
      <div class="dsm-head"><h1>${title}<small>${R.branch_name || ''} · trang đối soát ca mới</small></h1>
        <div class="dsm-tools"><button type="button" class="btn sm" id="dsm-recalc">Tính lại</button><a class="btn sm secondary" id="dsm-phieu" href="#/ca/phieu?id=${id}">Xem phiếu nhân viên</a></div></div>
      <div class="dsm-sub dsm-hint">Sửa ngay tại đây — lưu xong số tự tính lại, không phải Mở lại xác nhận. <a id="dsm-old" href="#/ca/doi-soat-cu?id=${id}">Trang cũ (dự phòng)</a></div>
      <div id="dsm-body">${body(S, active)}</div></div>`,
    mount(root) {
      const show = (k) => {
        if (!canStep(stepOf(S), k)) { showSaved(k === 'tien' ? 'Làm xong bước 1: Phần việc (Duyệt phần việc) rồi mới sang bước 2.' : 'Làm xong bước 2: Tiền rồi mới sang bước 3: Hoàn thành.', true); return false; }
        active = k; if (k === 'viec') mountWork($('#dsm-body', root));
        $$('[data-dsm-tab]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.dsmTab === k)));
        $$('[data-dsm-pane]', root).forEach((p) => { p.hidden = p.dataset.dsmPane !== k; });
        try { const [pth, qs] = location.hash.split('?'); const u = new URLSearchParams(qs || ''); u.set('tab', k); history.replaceState(null, '', pth + '?' + u.toString()); } catch (_) { /* bỏ qua */ }
        return true;
      };
      const top = () => { try { window.scrollTo({ top: 0 }); } catch (_) { /* bỏ qua */ } };
      // vẽ lại phần thân: thay hẳn phần tử #dsm-body (bộ bắt sự kiện cũ đi theo phần tử cũ), gắn lại bộ bắt của Sổ thu chi với dữ liệu mới
      const bind = (el) => {
        if (!el) return;
        $$('[data-dsm-tab]', el).forEach((b) => b.addEventListener('click', () => show(b.dataset.dsmTab)));
        $$('#dsm-missing li[data-go]', el).forEach((li) => li.addEventListener('click', () => { show(li.dataset.go); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
        $$('select[data-catx]', el).forEach((x) => x.addEventListener('click', (e) => e.stopPropagation()));   // chọn nhóm trong khung: không mở hộp Sửa
        $$('.dsm-it[data-ed]', el).forEach((b) => b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } }));
        $$('[data-dsmgap]', el).forEach((b) => b.addEventListener('click', () => gapOpen(b.dataset.dsmgap, b)));
        $('#dsm-next1', el)?.addEventListener('click', (ev) => next1(ev.currentTarget));
        $('#dsm-back1', el)?.addEventListener('click', () => { if (show('viec')) top(); });
        $('#dsm-next2', el)?.addEventListener('click', () => { if (show('xong')) top(); });
        $('#dsm-back2', el)?.addEventListener('click', () => { if (show('tien')) top(); });
        $('#dsm-done', el)?.addEventListener('click', (ev) => finish(ev.currentTarget));
        $('#dsm-reopen', el)?.addEventListener('click', () => reopen());
        $$('[data-dsmst]', el).forEach((b) => b.addEventListener('click', () => staffDialog(Number(b.dataset.dsmst))));
        $('#dsm-staffadd', el)?.addEventListener('click', () => staffAdd());
        $$('[data-dsmho]', el).forEach((b) => b.addEventListener('click', () => hoDialog(Number(b.dataset.dsmho))));
        $('#dsm-hoadd', el)?.addEventListener('click', () => hoDialog(null));
        $$('[data-dsmgiao]', el).forEach((b) => b.addEventListener('click', () => hoGiao(b.dataset.dsmgiao)));
        mountWork(el);
        if (S.D) stcBind(el, S.D);
      };
      // keep: chỉ đổi tại chỗ (tích / Để sau / chọn nhóm) — giữ dòng giờ chốt đã lấy, khỏi hỏi lại máy chủ
      const draw = (keep = false) => {
        const old = $('#dsm-body', root); if (!old) return;
        if (!canStep(stepOf(S), active)) active = firstTab(S);   // bước đang mở bị khoá lại (vd sửa người làm → bỏ duyệt Nhân sự)
        const nb = document.createElement('div'); nb.id = 'dsm-body'; nb.innerHTML = str(body(S, active));
        if (keep) old.querySelectorAll('.stc-gio[data-gio-state="done"]').forEach((g) => {
          const t = nb.querySelector(`.stc-gio[data-gio-ca="${g.dataset.gioCa}"]`); if (t) { t.innerHTML = g.innerHTML; t.dataset.gioState = 'done'; } });
        if (keep && workMounted === old) { ['#dsm-cv', '#dsm-cv-sum', '#dsm-dg'].forEach((sel) => { const o = $(sel, old); const t = $(sel, nb); if (o && t) t.replaceWith(o); }); workMounted = nb; }
        old.replaceWith(nb); bind(nb);
      };
      const reload = async () => { const y = window.scrollY; S = await loadShift(id); draw(); try { window.scrollTo(0, y); } catch (_) { /* bỏ qua */ } };
      // xử lý lệch: số phải chốt trước — ca chưa đủ 4 mục tiền thì tự xác nhận (app_ds2_confirm: kiểm file Fabi, ngân hàng, ô đỏ, tiền mặt đếm) rồi mở hộp
      const gapOpen = async (gid, b) => {
        try {
          if (!S.ca?.recon_money_done) { b.disabled = true; await rpc('app_ds2_confirm', { p_report: id }); await reload(); }
          if (!stcGap(S.D, gid)) showSaved('Không tìm thấy dòng chênh lệch — bấm Tính lại.', true);
        } catch (e) { b.disabled = false; showSaved(e.message || String(e), true); }
      };
      // bước 1 → 2: còn phần việc chưa duyệt thì duyệt (app_ds2_work_ok) rồi sang bước 2
      const next1 = async (b) => {
        const parts = workParts(S.R).parts;
        if (parts.length && !(S.ca && S.ca.done) && S.R.recon_status !== 'hoan_thanh') {
          b.disabled = true;
          try { await rpc('app_ds2_work_ok', { p_report: id, p_parts: parts }); await reload(); showSaved('Đã duyệt phần việc'); }
          catch (e) { b.disabled = false; showSaved(e.message || String(e), true); return; }
        }
        if (show('tien')) top();
      };
      // Hoàn thành gộp (máy chủ app_ds2_finish — một giao dịch): duyệt phần việc web hiện, xác nhận số Fabi, tích ô cơ bản, Hoàn thành; thiếu thì báo, không lưu gì.
      // Xong: sau 1,5 giây tự mở ca tiếp theo chưa xong của cơ sở (nút "Ở lại ca này"); hết ca thì báo và về bảng tuần Chốt ca.
      let timer = null;
      const finish = async (b) => {
        const err = $('#dsm-finerr', root); if (err) err.textContent = '';
        b.disabled = true; b.textContent = 'Đang hoàn thành…';
        try {
          await rpc('app_ds2_finish', { p_report: id, p_parts: workParts(S.R).parts, p_ticks: S.ca ? confirmKeys(S.D, S.ca) : [] });
          await reload(); showSaved('Đã hoàn thành đối soát ca');
          const nx = nextUnfinished(S.con, S.R); const box = $('#dsm-after', root); if (!box) return;
          box.className = 'dsm-after';
          box.innerHTML = str(nx ? html`<span>✓ Đã hoàn thành. Sang ca tiếp theo chưa xong (${nx.shift || ''} ${String(nx.date || nx.work_date || '').slice(8, 10)}/${String(nx.date || nx.work_date || '').slice(5, 7)}) sau 1,5 giây…</span><button type="button" class="btn sm secondary" id="dsm-stay">Ở lại ca này</button>`
            : html`<span>✓ Đã hoàn thành. Hết ca chưa xong của cơ sở — về bảng tuần Chốt ca sau 1,5 giây…</span><button type="button" class="btn sm secondary" id="dsm-stay">Ở lại ca này</button>`);
          $('#dsm-stay', root)?.addEventListener('click', () => { clearTimeout(timer); timer = null; box.innerHTML = str(html`<span class="dsm-sub">Ở lại ca này.</span>`); });
          timer = setTimeout(() => { if (!root.isConnected) return; location.hash = nx ? `#/ca/doi-soat?id=${nx.id}` : `#/ca?cn=${S.R.branch_id}`; }, 1500);
        } catch (e) {
          b.disabled = false; b.textContent = 'Hoàn thành';
          if (err) err.textContent = e.message || String(e); else showSaved(e.message || String(e), true);
        }
      };
      const reopen = () => {
        const d = dialog(str(html`<form class="stack" style="gap:10px"><h2 style="margin:0">Mở lại đối soát ca</h2>
          <div class="dsm-sub">Bỏ dấu Hoàn thành và mục tiền — ca về "chưa xong", sửa được ngay. Dấu duyệt phần việc giữ nguyên.</div>
          <label class="field"><span>Lý do (không bắt buộc)</span><input class="input" name="reason"></label><div class="dsm-err2"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Mở lại</button></div></form>`));
        d.querySelector('[data-x]')?.addEventListener('click', () => d.close());
        d.querySelector('form')?.addEventListener('submit', async (ev) => {
          ev.preventDefault(); const sb = ev.currentTarget.querySelector('[type=submit]'); sb.disabled = true;
          try { await rpc('app_ds2_reopen', { p_report: id, p_reason: (d.querySelector('[name=reason]')?.value || '').trim() || null }); d.close(); await reload(); showSaved('Đã mở lại — sửa xong bấm Hoàn thành lần nữa'); }
          catch (e) { sb.disabled = false; const x = d.querySelector('.dsm-err2'); if (x) x.textContent = e.message || String(e); }
        });
      };
      // ---- đợt 4: phần việc làm ngay tại trang ----
      const err2 = (d, e) => { const x = d.querySelector('.dsm-err2'); if (x) x.textContent = e.message || String(e); };
      const form = (title, inner, extra = '') => {
        const d = dialog(str(html`<form class="stack" style="gap:10px;max-width:460px"><h2 style="margin:0">${title}</h2>${inner}
          <label class="field"><span>Lý do sửa (bắt buộc)</span><input class="input" name="reason" autocomplete="off"></label><div class="dsm-err2"></div>
          <div class="toolbar" style="justify-content:flex-end;flex-wrap:wrap">${extra}<button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`));
        d.querySelector('[data-x]')?.addEventListener('click', () => d.close());
        return d;
      };
      const run2 = async (d, fn) => { const b = d.querySelector('[type=submit]'); if (b) b.disabled = true; try { await fn(); d.close(); } catch (e) { if (b) b.disabled = false; err2(d, e); } };
      const reasonOf = (f) => { const r = (f.reason?.value || '').trim(); if (!r) throw new Error('Ghi lý do sửa (bắt buộc).'); return r; };
      // người làm: gửi ĐỦ danh sách vào bản đối soát (máy chủ giữ nguyên khoá khác); Nhân sự đã duyệt thì bỏ duyệt trước (máy chủ khoá trường của mục đã duyệt)
      const staffList = () => (S.R.staff || []).map(staffPayload);
      const saveStaff = async (list, reason) => {
        if ((S.R.checks || {}).nhan_su) await rpc('app_ca_check', { p_id: id, p_item: 'nhan_su', p_on: false });
        await rpc('app_ca_recon_save', { p_id: id, p: { staff: list }, p_reason: reason });
        await reload(); showSaved('Đã lưu người làm');
      };
      const staffDialog = (i) => {
        const s = (S.R.staff || [])[i]; if (!s) return; const w = isW(s);
        const d = form(`${s.code ? s.code + ' – ' : ''}${s.name || 'NV ' + s.employee_id}`, html`
          <label class="field"><span>Đi làm</span><select class="input" name="worked"><option value="1" ${w ? raw('selected') : ''}>Có làm</option><option value="0" ${w ? '' : raw('selected')}>Phát sinh nghỉ</option></select></label>
          <div class="pc-line" data-w="1" style="gap:8px"><label class="field grow"><span>Giờ đến</span><input class="input" type="time" name="in" value="${hm(s.time_in)}"></label><label class="field grow"><span>Giờ về</span><input class="input" type="time" name="out" value="${hm(s.time_out)}"></label></div>
          ${s.pay_cash ? html`<label class="field" data-w="1"><span>Đã trả lương tiền mặt (đ)</span><input class="input" name="cash" inputmode="numeric" value="${s.cash_paid ? fmt(s.cash_paid) : ''}"></label>` : ''}
          <label class="field" data-w="0"><span>Lý do nghỉ</span><input class="input" name="absent" value="${s.absent_reason || ''}"></label>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${s.note || ''}"></label>`,
          s.source && s.source !== 'lich' ? html`<button type="button" class="btn sm secondary danger" data-del style="margin-right:auto">Bỏ người này</button>` : '');
        const f = d.querySelector('form');
        const sync = () => { const on = f.worked.value === '1'; f.querySelectorAll('[data-w]').forEach((x) => { x.hidden = x.dataset.w !== (on ? '1' : '0'); }); };
        f.worked.addEventListener('change', sync); sync();
        d.querySelector('[data-del]')?.addEventListener('click', () => run2(d, async () => { const r = reasonOf(f); await saveStaff(staffList().filter((_, k) => k !== i), r); }));
        f.addEventListener('submit', (ev) => { ev.preventDefault(); run2(d, async () => {
          const r = reasonOf(f); const on = f.worked.value === '1';
          if (on && (!f.elements.in.value || !f.elements.out.value)) throw new Error('Nhập giờ đến và giờ về.');
          if (!on && !f.absent.value.trim()) throw new Error('Ghi lý do nghỉ.');
          const L = staffList();
          L[i] = { ...L[i], worked: on, time_in: on ? f.elements.in.value : null, time_out: on ? f.elements.out.value : null, absent_reason: on ? null : f.absent.value.trim(),
            note: f.note.value.trim() || null, cash_paid: on ? (f.cash ? parseMoney(f.cash.value) || null : L[i].cash_paid) : null };
          await saveStaff(L, r); }); });
      };
      const staffAdd = async () => {
        let emps = []; try { emps = (await rpc('app_ca_employees')) || []; } catch (e) { showSaved(e.message || String(e), true); return; }
        const have = new Set((S.R.staff || []).map((s) => Number(s.employee_id)));
        const d = form('Thêm người hỗ trợ', html`<label class="field"><span>Nhân viên</span><select class="input" name="emp"><option value="">— Chọn nhân viên —</option>${emps.filter((e) => !have.has(Number(e.id))).map((e) => html`<option value="${e.id}">${e.code ? e.code + ' – ' : ''}${e.name || ''}</option>`)}</select></label>
          <div class="pc-line" style="gap:8px"><label class="field grow"><span>Giờ đến</span><input class="input" type="time" name="in"></label><label class="field grow"><span>Giờ về</span><input class="input" type="time" name="out"></label></div>
          <label class="field"><span>Ghi chú</span><input class="input" name="note"></label>`);
        const f = d.querySelector('form');
        f.addEventListener('submit', (ev) => { ev.preventDefault(); run2(d, async () => {
          if (!f.emp.value) throw new Error('Chọn nhân viên.'); if (!f.elements.in.value || !f.elements.out.value) throw new Error('Nhập giờ đến và giờ về.');
          const r = reasonOf(f);
          await saveStaff([...staffList(), staffPayload({ employee_id: f.emp.value, source: 'ho_tro', worked: 1, time_in: f.elements.in.value, time_out: f.elements.out.value, note: f.note.value })], r); }); });
      };
      // công việc bàn giao cho ca sau: gửi đủ danh sách {id, content} (như trang cũ); giao thành việc như trang cũ (bước 87)
      const hoList = () => (S.R.handover || []).map((x) => ({ id: x.id || null, content: x.content || '' }));
      const saveHo = async (items, reason) => { await rpc('app_ca_recon_handover_save', { p_id: id, p_items: items, p_reason: reason }); await reload(); showSaved('Đã lưu công việc bàn giao'); };
      const hoDialog = (i) => {
        const x = i == null ? null : (S.R.handover || [])[i];
        const d = form(x ? 'Sửa việc bàn giao' : 'Thêm việc bàn giao', html`<label class="field"><span>Nội dung</span><textarea class="input" name="content" rows="3" placeholder="Việc cần ca sau làm tiếp / thiết bị / vệ sinh / an toàn / sự cố">${x ? x.content || '' : ''}</textarea></label>`,
          x ? html`<button type="button" class="btn sm secondary danger" data-del style="margin-right:auto">Xoá việc</button>` : '');
        const f = d.querySelector('form');
        d.querySelector('[data-del]')?.addEventListener('click', () => run2(d, async () => { const r = reasonOf(f); await saveHo(hoList().filter((_, k) => k !== i), r); }));
        f.addEventListener('submit', (ev) => { ev.preventDefault(); run2(d, async () => {
          const c = f.content.value.trim(); if (!c) throw new Error('Ghi nội dung việc bàn giao.'); const r = reasonOf(f);
          const L = hoList(); if (x) L[i] = { ...L[i], content: c }; else L.push({ id: null, content: c });
          await saveHo(L, r); }); });
      };
      const hoGiao = async (hid) => {
        const h = (S.R.handover || []).find((x) => String(x.id) === String(hid)); if (!h) return;
        let people = []; try { people = (await rpc('app_viec_people')) || []; } catch (e) { showSaved(e.message || String(e), true); return; }
        const d = dialog(str(html`<form class="stack" style="gap:12px;max-width:460px"><h2 style="margin:0">Giao thành việc</h2>
          <div class="dsm-sub">Từ bàn giao ca ${S.R.shift} ${String(S.R.work_date).slice(8, 10)}/${String(S.R.work_date).slice(5, 7)} · ${S.R.branch_code || ''}</div>
          <div class="dsm-ho"><span>${h.content || ''}</span></div>
          <label class="field"><span>Người nhận</span><select class="input" name="who"><option value="">— Chọn người nhận —</option>${people.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></label>
          <div class="pc-line" style="gap:8px"><label class="field grow"><span>Mức độ</span><select class="input" name="pri"><option value="gap">Gấp</option><option value="binh_thuong" selected>Bình thường</option><option value="thap">Thấp</option></select></label>
            <label class="field grow"><span>Hạn (không bắt buộc)</span><input class="input" type="date" name="due"></label></div>
          <div class="dsm-sub">Người nhận được thông báo; việc hiện ở Công việc. Làm xong thì bàn giao này tự ghi "đã xử lý".</div><div class="dsm-err2"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Giao việc</button></div></form>`));
        d.querySelector('[data-x]')?.addEventListener('click', () => d.close());
        const f = d.querySelector('form');
        f.addEventListener('submit', (ev) => { ev.preventDefault(); run2(d, async () => {
          if (!f.who.value) throw new Error('Chọn người nhận.');
          await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', handover_item_id: h.id, assignee_id: f.who.value, due_date: f.due.value || null, priority: f.pri.value } });
          await reload(); showSaved('Đã giao việc — người nhận được thông báo'); }); });
      };
      // khối nghỉ & làm thay + đánh giá: gắn khi mở trang ① (mỗi khối tự đọc dữ liệu), giữ nguyên khi chỉ vẽ lại tại chỗ
      let workMounted = null;
      const mountWork = (el) => {
        if (active !== 'viec' || !el || workMounted === el) return;
        workMounted = el;
        const cv = $('#dsm-cv', el); const dg = $('#dsm-dg', el);
        if (cv) mountCover(cv, S.R, { sum: $('#dsm-cv-sum', el), onChange: () => reload(), flush: () => null });
        if (dg) mountReportEval(dg, S.R);
      };
      REFRESH = async (msg, info) => {
        if (!root.isConnected) { REFRESH = null; return; }   // đã rời trang
        try {
          if (info && info.kind === 'tick' && S.ca) {
            const t = new Set(S.ca.ticks || []); if (info.on) t.add(info.key); else t.delete(info.key); S.ca.ticks = [...t];
            S.st = pageState(S.D, S.ca, S.R, S.dsRow); draw(true); return;
          }
          if (info && info.kind === 'cat' && S.D) {
            const it = (S.D.items || []).find((x) => x.id === info.id); if (it) { it.cat = info.cat; it.no_cost = !!info.no_cost; }
            if (S.ca) S.st = pageState(S.D, S.ca, S.R, S.dsRow); draw(true); return;
          }
          if (info && info.kind === 'ui') { draw(true); return; }
          await reload();
        } catch (e) { showSaved(e.message || String(e), true); }
      };
      bind($('#dsm-body', root));
      $('#dsm-recalc', root)?.addEventListener('click', async (ev) => {
        const b = ev.currentTarget; b.disabled = true;
        try { await reload(); showSaved('Đã tính lại'); }
        catch (e) { showSaved(e.message || String(e), true); }
        finally { b.disabled = false; }
      });
    },
  };
}
