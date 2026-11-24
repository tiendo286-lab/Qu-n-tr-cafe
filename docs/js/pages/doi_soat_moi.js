// Trang đối soát ca mới — đợt 1: CHỈ XEM (#/ca/doi-soat-moi?id=<ca>). Chạy song song trang cũ (#/ca/doi-soat?id=), không ghi dữ liệu.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-24-trang-doi-soat-ca-moi-design.md · Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-1.md
// 3 trang: ① Phần việc · ② Tiền (Số máy Fabi, Tiền mặt, Chuyển khoản — từng khoản thu / chi và tổng) · ③ Hoàn thành (còn thiếu, xác nhận).
// Đọc bằng 4 lệnh có sẵn (app_ca_get, app_stc_month, app_ca_ds_tuan một ngày, app_ca_ds_con); số tính bằng hàm của Sổ thu chi nên khớp trang cũ.
// "Tính lại" chỉ đọc lại 4 lệnh đó và thay phần thân #dsm-body — không vẽ lại cả trang.
import { rpc, sb } from '../sb.js';
import { $, $$, dialog, html, raw, showSaved, str } from '../ui.js';
import { fmt } from '../tien.js';
import { SHIFT_ORDER, billListOf, caChecks, caGaps, dsChecks, dsCtx } from '../so_thu_chi_tinh.js';
import { CHK_LABEL, WORK_LABEL, caBook, confirmList, isClean, missingList, pageState } from '../doi_soat_moi_tinh.js';

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
.dsm-photos{display:flex;gap:8px;flex-wrap:wrap}
.dsm-photo{border:1px solid var(--line-strong);border-radius:8px;background:var(--subtle);width:84px;height:110px;padding:0;overflow:hidden;cursor:zoom-in;font-size:11px;color:var(--muted)}
.dsm-photo img{width:100%;height:100%;object-fit:cover;display:block}
#dsm-missing{margin:0;padding-left:20px;display:grid;gap:4px}
#dsm-missing li{cursor:pointer;color:var(--off-ink)}
#dsm-missing li span{color:var(--muted);font-size:12.5px}
.dsm-confirm{background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:12px;padding:10px 12px;display:grid;gap:4px}
.dsm-confirm ol{margin:0;padding-left:20px}
.dsm-nav{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
</style>`;

const tick = (on, text) => html`<div class="dsm-tick"><i>${on ? '✓' : '☐'}</i><span>${text}</span></div>`;

// ---------------- nạp dữ liệu (4 lệnh) ----------------
async function loadShift(id) {
  const R = await rpc('app_ca_get', { p_id: id });
  const [M, ds, con] = await Promise.all([
    rpc('app_stc_month', { p_branch: R.branch_id, p_month: String(R.work_date).slice(0, 7) }).then((D) => ({ D }), (e) => ({ err: e.message || String(e) })),
    rpc('app_ca_ds_tuan', { p_branch: R.branch_id, p_from: R.work_date, p_to: R.work_date }).catch(() => []),
    rpc('app_ca_ds_con', { p_branch: R.branch_id }).catch(() => []),
  ]);
  const D = M.D || null;
  if (D && Array.isArray(D.ca_debts)) (D.cas || []).forEach((c) => { c.bill_list = billListOf(D, c.id); });   // như load() của Sổ thu chi
  const ca = D ? (D.cas || []).find((c) => Number(c.id) === Number(id)) || null : null;
  const dsRow = (ds || []).find((x) => Number(x.id) === Number(id)) || null;
  const err = M.err || (D && !ca ? 'Chưa có số liệu phần tiền của ca này (ca chưa có trong sổ tháng của cơ sở).' : null);
  return { R, D, ca, dsRow, con: con || [], err, st: ca ? pageState(D, ca, R, dsRow) : null };
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
const tabMark = (S, k) => {
  if (k === 'viec') { const l = workMark(S); return l.length ? `⚠ ${l.length}` : '✓'; }
  if (k === 'tien') { if (!S.st) return '!'; if (S.st.tien.wait) return '⏳'; return S.st.tien.left ? `⚠ ${S.st.tien.left}` : '✓'; }
  return S.st && S.st.done ? '✓ xong' : '';
};

// ---------------- trang ① Phần việc ----------------
function viecPane(S) {
  const R = S.R; const staff = R.staff || [];
  const odd = staff.some((s) => s.worked === 0 || s.worked === false || (s.source && s.source !== 'lich'));
  const h = R.cash_hand;
  return html`<section class="dsm-card"><h2>Nhân viên <span class="dsm-sub">${staff.filter((s) => s.worked !== 0 && s.worked !== false).length} người làm</span></h2>
      ${staff.length ? staff.map((s) => { const nm = `${s.code ? s.code + ' – ' : ''}${s.name || 'NV ' + s.employee_id}`;
        return s.worked === 0 || s.worked === false ? html`<div class="dsm-row"><span>${nm}</span><b>Nghỉ${s.absent_reason ? ': ' + s.absent_reason : ''}</b></div>`
          : html`<div class="dsm-row"><span>${nm}${s.source && s.source !== 'lich' ? html` <span class="dsm-sub">(ngoài lịch)</span>` : ''}</span><b>${s.time_in || '—'} – ${s.time_out || '—'}</b></div>`; })
        : html`<div class="dsm-sub">Phiếu chưa có nhân viên.</div>`}
      ${odd ? html`<div class="dsm-sub">Ca có người nghỉ / làm thay / ca bổ sung: quản lý tổng phân loại, Chủ duyệt x2 (trang Duyệt nghỉ & làm thay).</div>` : html`<div class="dsm-sub">Không ai nghỉ / làm thay.</div>`}</section>
    <section class="dsm-card"><h2>Bàn giao ca</h2>
      ${!h ? html`<div class="dsm-row"><span>Nhận két ca trước</span><b>Ca đầu ngày</b></div>`
        : html`<div class="dsm-row"><span>Nhận két ca trước</span><b>${HAND[h.state] || h.state || '—'}</b></div>
          ${h.counted != null ? html`<div class="dsm-row"><span>Ca này đếm nhận</span><b>${money(h.counted)}</b></div>` : ''}
          ${h.prev_cash != null ? html`<div class="dsm-row"><span>Ca trước để lại</span><b>${money(h.prev_cash)}</b></div>` : ''}
          ${h.gap ? html`<div class="dsm-row"><span>Lệch khi giao két</span><b>${signedM(h.gap)}</b></div>` : ''}`}
      <div class="dsm-row"><span>Hàng kho tổng nhận trong ca</span><b>${R.goods_status === 'khong' || !R.goods_status ? 'không có' : R.goods_status}</b></div></section>
    <section class="dsm-card"><h2>Duyệt phần việc</h2>
      ${Object.keys(WORK_LABEL).map((k) => tick(!!(R.checks || {})[k], WORK_LABEL[k] + ((R.checks || {})[k] ? ' — đã duyệt' : ' — chưa duyệt')))}
      ${workMark(S).length ? html`<div class="dsm-sub">Còn: ${workMark(S).join(', ')}.</div>` : ''}
      <div class="dsm-sub">Đánh giá nhân viên (không bắt buộc) và nút duyệt: làm ở trang cũ trong đợt này.</div></section>`;
}

// ---------------- trang ② Tiền ----------------
function bookSec(b, ca, pm, ticks) {
  const isTm = pm === 'tm';
  const box = (x, cls) => html`<div class="dsm-it ${cls}"><span class="k">${x.kind}</span><span class="a">${cls === 'thu' ? '+' : '−'}${money(x.amount)}</span><span class="t">${x.title || '—'}</span>
    <span class="m"><span class="dsm-who">${x.who}</span>${cls === 'chi' && x.col === 'chi' ? (x.cat ? html`<span>Nhóm: ${x.cat}</span>` : html`<span style="color:var(--off-ink)">chưa chọn nhóm</span>`) : ''}</span></div>`;
  const realLabel = isTm ? (ca.cash_mode === 'ca' ? 'Quản lý đếm được' : 'Tiền mặt trong két') : 'Ngân hàng nhận (kế toán nhập)';
  return html`<section class="dsm-card dsm-sec" data-pm="${pm}"><h2>${isTm ? 'Tiền mặt' : 'Chuyển khoản'} ${gapChip(b)}</h2>
    ${isTm ? html`<div class="dsm-row"><span>Mở ca</span><b>${money(b.start)}</b></div>` : ''}
    <div class="dsm-row"><span>+ Bán ${isTm ? 'tiền mặt' : 'chuyển khoản'} (máy Fabi)</span><b>${money(b.ban)}</b></div>
    <div class="dsm-grp thu">Khoản thu</div>
    ${b.thu.length ? b.thu.map((x) => box(x, 'thu')) : html`<div class="dsm-sub">không có</div>`}
    <div class="dsm-row dsm-tot thu"><span>Tổng thu</span><b>${money(b.tongThu)}</b></div>
    <div class="dsm-grp chi">Khoản chi</div>
    ${b.chi.length ? b.chi.map((x) => box(x, 'chi')) : html`<div class="dsm-sub">không có</div>`}
    <div class="dsm-row dsm-tot chi"><span>Tổng chi</span><b>${money(b.tongChi)}</b></div>
    <div class="dsm-row dsm-must" data-pm="${pm}" data-v="${b.must}"><span>= ${isTm ? 'Phải có' : 'Phải nhận'}</span><b>${money(b.must)}</b></div>
    <div class="dsm-row"><span>${realLabel}</span><b>${b.real == null ? '⏳ chờ kế toán' : money(b.real)}</b></div>
    <div class="dsm-row dsm-gap ${b.real == null ? '' : Math.abs(b.gap) <= 5000 ? 'ok' : 'bad'}" data-pm="${pm}"><span>Lệch = thực nhận − ${isTm ? 'phải có' : 'phải nhận'}</span><b>${b.real == null ? '—' : b.gap === 0 ? '✓ khớp' : signedM(b.gap)}</b></div>
    ${ticks}</section>`;
}
function tienPane(S) {
  if (S.err) return html`<div class="alert warn dsm-err">${S.err}</div>`;
  const { D, ca, R } = S;
  const ctx = dsCtx(D, ca); const steps = dsChecks(ca, ctx); const all = steps.flat(); const has = (k) => all.find((x) => x.k === k);
  const mt = (k) => (has(k) ? tick(has(k).ok, CHK_LABEL[k]) : '');
  const cks = caChecks(ca, ctx.link).filter((x) => ['mo', 'dt', 'no'].includes(x.k));
  const book = caBook(D, ca);
  const photos = (R.photos || []).filter((p) => p.kind === 'ipos');
  const gaps = caGaps(D.items || [], ca.id);
  const gapTicks = (pm) => html`${gaps.some((g) => g.pm === pm && !g.small) ? mt('ld') : ''}${(ca.ticks || []).includes('sau_' + pm) ? tick(true, 'Để sau (xử lý lệch sau)') : ''}`;
  const debts = (D.ca_debts || []).filter((x) => Number(x.report_id) === Number(ca.id));
  const moi = debts.filter((x) => x.t === 'moi'); const tra = debts.filter((x) => x.t === 'tra');
  return html`<section class="dsm-card"><h2>Số máy Fabi ${cks.every((x) => x.st === 'ok') ? html`<span class="dsm-chip ok">✓ khớp phiếu</span>` : cks.some((x) => x.st === 'kt') ? html`<span class="dsm-chip kt">⏳ chờ file Fabi</span>` : html`<span class="dsm-chip off">⚠ lệch</span>`}</h2>
      ${cks.map((x) => html`<div class="dsm-row"><span>${x.name}: ${x.a} · ${x.b}</span><b>${x.txt}</b></div>`)}
      <div class="dsm-photos">${photos.length ? photos.map((p) => html`<button type="button" class="dsm-photo" data-path="${p.path}" aria-label="Phóng to ảnh phiếu">ảnh phiếu</button>`) : html`<span class="dsm-sub">Chưa có ảnh phiếu Fabi.</span>`}</div>
      ${mt('anh')}${mt('hd')}
      ${moi.length ? html`<div class="dsm-grp">Nợ mới trong ca</div>${moi.map((x) => html`<div class="dsm-row"><span>${x.who || 'Khách'}${x.content ? ' · ' + x.content : ''}${x.grp && x.grp !== 'khach' ? html` <span class="dsm-sub">${x.sorted ? '(đã xếp)' : '(chưa xếp)'}</span>` : ''}</span><b>${money(x.amount)}</b></div>`)}` : ''}
      ${has('phanloai') ? tick(has('phanloai').ok, CHK_LABEL.phanloai) : ''}
      ${tra.length ? html`<div class="dsm-grp">Khách trả nợ cũ trong ca</div>${tra.map((x) => html`<div class="dsm-row"><span>${x.who || 'Khách'} · ${x.from || ''}</span><b>${money(x.amount)}</b></div>`)}` : ''}
      ${mt('tn')}</section>
    ${bookSec(book.tm, ca, 'tm', html`${mt('cash')}${mt('goi')}${mt('ket')}${mt('sot')}${mt('cat')}${mt('that')}${mt('lon')}${mt('tm')}${gapTicks('tm')}`)}
    ${bookSec(book.ck, ca, 'ck', html`${mt('ck')}${mt('ck5')}${gapTicks('ck')}`)}`;
}

// ---------------- trang ③ Hoàn thành ----------------
function xongPane(S) {
  const { R } = S;
  const miss = S.ca ? missingList(S.D, S.ca, R, S.dsRow) : workMark(S).map((t) => ({ page: 'viec', k: 'viec', text: t }));
  const conf = S.ca ? confirmList(S.D, S.ca) : [];
  const book = S.ca ? caBook(S.D, S.ca) : null;
  const wl = workMark(S);
  return html`<section class="dsm-card"><h2>Tóm tắt ${S.st && S.st.done ? html`<span class="dsm-chip ok">✓ Đã hoàn thành đối soát</span>` : ''}</h2>
      <div class="dsm-row"><span>① Phần việc</span><b>${wl.length ? '⚠ còn ' + wl.join(', ') : '✓ đã duyệt'}</b></div>
      ${book ? html`<div class="dsm-row"><span>Tiền mặt</span>${gapChip(book.tm)}</div><div class="dsm-row"><span>Chuyển khoản</span>${gapChip(book.ck)}</div>` : html`<div class="dsm-sub">${S.err || ''}</div>`}</section>
    <section class="dsm-card"><h2>Còn thiếu</h2>
      ${miss.length ? html`<ul id="dsm-missing">${miss.map((x) => html`<li data-go="${x.page}">${x.text} <span>· ${x.page === 'viec' ? 'trang Phần việc' : 'trang Tiền'}</span></li>`)}</ul>` : html`<div class="dsm-sub">Không còn thiếu gì.</div>`}</section>
    ${conf.length ? html`<section class="dsm-confirm"><b>Bấm Hoàn thành là xác nhận đã:</b><ol>${conf.map((t) => html`<li>${t}</li>`)}</ol></section>` : ''}
    <button type="button" class="btn" id="dsm-done" disabled>Hoàn thành</button>
    <div class="dsm-sub">Đợt này trang mới chỉ xem: Hoàn thành ở <a href="#/ca/doi-soat?id=${R.id}&tab=xong">trang cũ ›</a></div>`;
}

// ---------------- khung trang ----------------
function body(S, active) {
  const R = S.R; const cas = S.D ? (S.D.cas || []).slice().sort((a, b) => (a.date === b.date ? rank(a.shift) - rank(b.shift) : a.date < b.date ? -1 : 1)) : [];
  const i = cas.findIndex((c) => Number(c.id) === Number(R.id)); const prev = i > 0 ? cas[i - 1] : null; const next = i >= 0 && i < cas.length - 1 ? cas[i + 1] : null;
  const nx = nextUnfinished(S.con, R);
  return html`<nav class="dsm-tabs" aria-label="Các trang đối soát">${TABS.map(([k, t]) => html`<button type="button" data-dsm-tab="${k}" aria-selected="${k === active ? 'true' : 'false'}">${t}<span class="mk">${tabMark(S, k)}</span></button>`)}</nav>
    <div data-dsm-pane="viec" class="dsm" ${active === 'viec' ? '' : raw('hidden')}>${viecPane(S)}</div>
    <div data-dsm-pane="tien" class="dsm" ${active === 'tien' ? '' : raw('hidden')}>${tienPane(S)}</div>
    <div data-dsm-pane="xong" class="dsm" ${active === 'xong' ? '' : raw('hidden')}>${xongPane(S)}</div>
    <div class="dsm-nav">${prev ? html`<a class="btn sm secondary" href="#/ca/doi-soat-moi?id=${prev.id}">‹ Ca trước</a>` : html`<span></span>`}
      ${nx ? html`<a class="btn sm" href="#/ca/doi-soat-moi?id=${nx.id}">Ca tiếp theo chưa xong ›</a>` : ''}
      ${next ? html`<a class="btn sm secondary" href="#/ca/doi-soat-moi?id=${next.id}">Ca sau ›</a>` : html`<span></span>`}</div>`;
}
const firstTab = (S) => {
  if (S.ca && isClean(S.D, S.ca, S.R, S.dsRow)) return 'xong';
  if (workMark(S).length) return 'viec';
  if (!S.st || !S.st.tien.ok || S.st.tien.wait) return 'tien';
  return 'xong';
};

export async function render({ params }) {
  const id = Number(params.id);
  if (!id) return { title: 'Đối soát ca', html: html`<div class="card">Thiếu mã ca.</div>` };
  let S = await loadShift(id);
  const R = S.R;
  let active = ['viec', 'tien', 'xong'].includes(params.tab) ? params.tab : firstTab(S);
  const title = `Ca ${R.shift} · ${dayName(R.work_date)} · ${R.branch_code || ''}`;
  return {
    title: `Đối soát ca mới · ${R.shift} ${String(R.work_date).slice(8, 10)}/${String(R.work_date).slice(5, 7)}`,
    html: html`${raw(CSS)}<div id="dsm" class="dsm">
      <div class="dsm-head"><h1>${title}<small>${R.branch_name || ''} · trang đối soát ca mới</small></h1>
        <div class="dsm-tools"><button type="button" class="btn sm" id="dsm-recalc">Tính lại</button><a class="btn sm secondary" id="dsm-old" href="#/ca/doi-soat?id=${id}">Về trang cũ</a></div></div>
      <div class="dsm-note">Bản xem thử — chưa sửa được ở đây. <a href="#/ca/doi-soat?id=${id}">Sửa ở trang cũ ›</a></div>
      <div id="dsm-body">${body(S, active)}</div></div>`,
    mount(root) {
      const bodyEl = () => $('#dsm-body', root);
      const show = (k) => {
        active = k;
        $$('[data-dsm-tab]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.dsmTab === k)));
        $$('[data-dsm-pane]', root).forEach((p) => { p.hidden = p.dataset.dsmPane !== k; });
        try { const [pth, qs] = location.hash.split('?'); const u = new URLSearchParams(qs || ''); u.set('tab', k); history.replaceState(null, '', pth + '?' + u.toString()); } catch (_) { /* bỏ qua */ }
      };
      const photos = async () => {
        const els = $$('.dsm-photo[data-path]', root); if (!els.length || !sb.storage) return;
        try {
          const { data } = await sb.storage.from('phieu-ca').createSignedUrls(els.map((e) => e.dataset.path), 3600);
          (data || []).forEach((d, i) => { if (d && d.signedUrl && els[i]) { els[i].dataset.url = d.signedUrl; els[i].innerHTML = str(html`<img src="${d.signedUrl}" alt="Ảnh phiếu Fabi">`); } });
        } catch (_) { /* không ký được ảnh: vẫn hiện nút chữ */ }
      };
      const bind = () => {
        $$('[data-dsm-tab]', root).forEach((b) => b.addEventListener('click', () => show(b.dataset.dsmTab)));
        $$('#dsm-missing li[data-go]', root).forEach((li) => li.addEventListener('click', () => { show(li.dataset.go); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
        $$('.dsm-photo', root).forEach((b) => b.addEventListener('click', () => {
          if (!b.dataset.url) return;
          const d = dialog(str(html`<div class="stack" style="gap:10px"><img src="${b.dataset.url}" alt="Ảnh phiếu Fabi" style="max-width:100%;border-radius:10px"><button type="button" class="btn secondary" data-close>Đóng</button></div>`));
          d.querySelector('[data-close]')?.addEventListener('click', () => d.close());
        }));
        photos();
      };
      bind();
      $('#dsm-recalc', root)?.addEventListener('click', async (ev) => {
        const b = ev.currentTarget; b.disabled = true;
        try { S = await loadShift(id); bodyEl().innerHTML = str(body(S, active)); bind(); showSaved('Đã tính lại'); }
        catch (e) { showSaved(e.message || String(e), true); }
        finally { b.disabled = false; }
      });
    },
  };
}
