// Phiếu chốt ca: nhân viên chốt ca (tự động lưu) → Hoàn thành → quản lý đối soát trên BẢN ĐỐI SOÁT riêng (phiếu gốc giữ nguyên)
import { render as rerender, isManager, can } from '../app.js';
import { mountDeliveries, NH_CSS } from '../nhap_hang.js';
import { DT_CSS, tcList } from '../doi_soat_tc.js';
import { DG_CSS, mountReportEval } from '../danh_gia.js';
import { CV_CSS, mountCover } from '../nghi_thay.js';
import { rpc, sb } from '../sb.js';
import { bindMoneyInputs, compressImage, dmy, dt, fmt, fromLocalInput, noName, parseMoney, result, signed, toLocalInput, vnd } from '../tien.js';
import { $, $$, dialog, flash, go, hhmm, html, showSaved, str } from '../ui.js';
import { STAFF_LABEL, dayName } from './chot_ca.js';
import { catalog } from '../data.js';
import { renderNew } from '../chot_ca_moi.js';
import { ALL_FIELDS, DEN_CSS, ITEM_FIELDS, getDirect, mountLights } from '../doi_soat_den.js';
import { mountBankOuts, openBankOut } from '../phieu_chi_ck.js';
import { BUCKET as HD_BUCKET, HD_ACCEPT, HD_CSS, HD_STATUS, fileLinks, photoThumbs, receiptText, signLinks, uploadFiles } from './ke_toan_hoa_don.js';

export const perm = 'chot_ca';
const BUCKET = 'phieu-ca';
const CHECK_LABEL = {
  thoi_gian: 'Thời gian doanh thu', doanh_thu: 'Doanh thu & số cốc', tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản',
  thu_chi: 'Chi tiết thu chi', cong_no: 'Công nợ', nhan_su: 'Nhân viên trong ca', ban_giao: 'Bàn giao ca sau', nhap_hang: 'Nhập hàng',
};

const FIELD_LABEL = {
  rev_start: 'Bắt đầu doanh thu', rev_end: 'Kết thúc doanh thu', total_revenue: 'Mục 1 Tổng doanh thu', pos_cash: 'Mục 2 Tiền mặt POS',
  pos_transfer: 'Mục 3 Chuyển khoản POS', reported_transfer: 'Mục 4 Chuyển khoản thực tế', cash_counted: 'Mục 5 Tiền trong két',
  opening_cash: 'Tiền mặt đầu ca', cups: 'Số cốc', goods_status: 'Kết quả nhận hàng', goods_note: 'Ghi chú nhận hàng',
  moves: 'Chi tiết thu chi', staff: 'Nhân viên trong ca', goods: 'Mặt hàng thiếu',
  bank_opening: 'Số dư đầu', bank_closing: 'Số dư cuối', bank_transfers_out: 'Tiền chuyển ra', bank_note: 'Ghi chú kế toán',
  bank_late_in: 'Tiền về chậm (cộng vào ca này)', bank_late_out: 'Tiền về chậm của ca trước (trừ khỏi ca này)',
};
const LOG_ACTION = { sua: 'Sửa', mo_lai_doi_soat: 'Mở lại đối soát', hoan_thanh_doi_soat: 'Hoàn thành đối soát', lam_lai: 'Mở lại phiếu cho nhân viên sửa — bản đối soát làm lại từ đầu',
  ket_qua: 'Kết quả đối soát', bo_ket_qua: 'Bỏ kết quả đối soát', ke_toan: 'Kế toán', ql_tu_lam: 'Quản lý tự làm phần việc — tự đối soát',
  mo_lai_muc: 'Sửa lại mục', mo_khoa: 'Mở khoá mục', tu_duyet: 'Web tự đối soát', tu_bo_khoa: 'Web bỏ khoá', phieu_chi: 'Phiếu chi chuyển khoản', xoa_phieu_chi: 'Xoá phiếu chi' };
const RES = { khop: ['KHỚP', 'on'], thieu: ['THIẾU', 'bad'], thua: ['THỪA', 'warn'] };
const MONEY_ITEMS = ['tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no'];
export const KA_STATUS = { chua_xu_ly: ['Chưa xử lý', 'off'], da_bu: ['Đã bù', 'ok'], tru_luong: ['Trừ lương', 'info'], mien: ['Miễn', 'mute'], huy: ['Đã hủy', 'mute'] };
const resText = (x) => (x ? `${RES[x.result][0]}${x.amount ? ' ' + fmt(x.amount) + 'đ' : ''}` : 'CHƯA ĐỐI SOÁT');
const GOODS_LABEL = { khong: 'Không nhận hàng', du: 'ĐỦ', thieu: 'THIẾU' };
function showVal(k, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (Array.isArray(v)) return `${v.length} dòng`;
  if (k === 'rev_start' || k === 'rev_end') return dt(v);
  if (k === 'cups') return String(v);
  if (k === 'goods_status') return GOODS_LABEL[v] || v;
  if (typeof v === 'number') return vnd(v);
  if (typeof v === 'object' && v.result) return `${RES[v.result][0]}${v.amount ? ' ' + fmt(v.amount) + 'đ' : ''}${(v.people || []).length ? ` · ${v.people.length} nhân viên chịu` : ''}`;
  return String(v);
}
// Gộp bản đối soát vào dữ liệu phiếu để dùng chung giao diện
function mergeRecon(R0, RC) {
  const d = RC.data || {};
  return { ...R0, ...d, moves: d.moves || [], goods: d.goods || [],
    staff: (d.staff || []).map((x) => ({ ...x, worked: x.worked ? 1 : 0, ...(RC.employees[String(x.employee_id)] || {}) })) };
}

// ---------------------------------------------------------------- tính toán
// Công nợ (chốt 07/11): Mục 1 = Mục 2 + Mục 3 + nợ phát sinh; tiền thu nợ cộng vào tiền mặt / chuyển khoản của ca thu
export function debtSums(R, debtsNow) {
  const debtNew = (debtsNow || R.debts || []).filter((d) => !d.kind || d.kind === 'bill').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const loanOut = (R.debts || []).filter((d) => d.kind === 'muon').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const ckOut = (R.debts || []).filter((d) => d.kind === 'ck').reduce((s, d) => s + (Number(d.amount) || 0), 0);   // bước 84: Nợ CK
  const col = (k) => (R.open_debts || []).filter((d) => d.closed_report_id === R.id && d.collect_kind === k).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  return { debtNew, loanOut, ckOut, colTM: col('tien_mat'), colCK: col('chuyen_khoan') };
}
export function calc(v, x = {}) {
  const n = (y) => (y === null || y === undefined || y === '' ? null : Number(y));
  const [total, pc, pt, rt, cc, op] = [n(v.total_revenue), n(v.pos_cash), n(v.pos_transfer), n(v.reported_transfer), n(v.cash_counted), n(v.opening_cash)];
  const sum = (k) => (v.moves || []).filter((m) => m.kind === k).reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const debtNew = x.debtNew || 0; const colTM = x.colTM || 0; const colCK = x.colCK || 0; const loanOut = x.loanOut || 0; const ckOut = x.ckOut || 0;
  const ckDiff = rt !== null && pt !== null ? rt - pt : null;
  const tmDiff = cc !== null && op !== null && pc !== null ? cc - op - pc : null;
  const sal = (v.staff || []).filter((x) => x.worked !== false && x.worked !== 0 && Number(x.cash_paid) > 0).reduce((t, x) => t + Number(x.cash_paid), 0);
  const ckMoves = sum('chuyen_khoan'); const tmMoves = sum('tien_mat') - sal;
  return {
    sal,
    sumGap: total !== null && pc !== null && pt !== null ? total - pc - pt - debtNew : null,
    debtNew, loanOut, colTM, colCK, ckDiff, tmDiff, ckMoves, tmMoves,
    ckLeft: ckDiff === null ? null : ckDiff - ckMoves - colCK + ckOut,
    tmLeft: tmDiff === null ? null : tmDiff - tmMoves - colTM + loanOut,
  };
}

// Kết quả nhận két (phiếu ca NHẬN): đếm mù, đếm lại, so két ca trước
function handPill(h) {
  if (!h) return '';
  if (h.state === 'khop') return html`<span class="pill ok">KHỚP${h.gap ? ` (lệch ${signed(h.gap)}, trong mức cho qua ${fmt(h.tol)}đ)` : ''}</span>`;
  if (h.state === 'can_dem_lai') return html`<span class="pill off">LỆCH ${signed(h.gap)} — cần 2 người đếm lại</span>`;
  if (h.state === 'lech') return html`<span class="pill off">LỆCH ${signed(h.gap)} — tính cho ca ${h.prev_shift}</span>`;
  if (h.state === 'rut_quy') return html`<span class="pill ok">Mở ca với tiền gối đầu — ${fmt(h.rut)}đ nộp quỹ khi giao ca</span>`;
  if (h.state === 'cho_ca_truoc') return html`<span class="pill mute">Chờ ca ${h.prev_shift} hoàn thành phiếu</span>`;
  if (h.state === 'khong_ca_truoc') return html`<span class="pill mute">Không có phiếu ca trước để so</span>`;
  return html`<span class="pill mute">Chưa đếm nhận két</span>`;
}
function handInfo(h) {
  if (!h) return '';
  const has = h.counted !== null && h.counted !== undefined;
  return html`<div class="kv hand-kv">
    <div>Đếm nhận két</div><div>${has ? vnd(h.first_count ?? h.counted) : '—'}${h.counted_at ? html` <span class="st-meta">${h.counted_by || ''} · ${dt(h.counted_at)}</span>` : has && !h.blind ? html` <span class="st-meta">(nhập trước khi có đếm mù)</span>` : ''}</div>
    ${h.recount_at ? html`<div>2 người đếm lại</div><div>${vnd(h.counted)} <span class="st-meta">cùng ${h.giver || ''} · ${dt(h.recount_at)}</span></div>` : ''}
    <div>Két cuối ca ${h.prev_shift || 'trước'} khai</div><div>${h.prev_cash === null || h.prev_cash === undefined ? (h.hidden ? 'Hiện sau khi bạn đếm' : h.state === 'khong_ca_truoc' ? 'Không có phiếu ca trước' : 'Ca trước chưa hoàn thành') : vnd(h.prev_cash)}</div>
    <div><strong>Kết quả</strong></div><div>${handPill(h)}</div></div>`;
}

// Bản đối soát ca GIAO: ca sau đếm nhận két ra sao
function nextHandCard(n, shift) {
  return html`<div class="diff-card ${n.state === 'lech' || n.state === 'can_dem_lai' ? 'hand-bad' : ''}"><div class="pc-sub" style="margin:0">BÀN GIAO KÉT CHO CA ${String(n.shift || '').toUpperCase()}</div>
    <div class="kv"><div>Ca ${n.shift} đếm nhận két</div><div>${vnd(n.first_count ?? n.counted)}${n.counted_at ? html` <span class="st-meta">${n.counted_by || ''} · ${dt(n.counted_at)}</span>` : ''}</div>
      ${n.recount_at ? html`<div>2 người đếm lại</div><div>${vnd(n.counted)} <span class="st-meta">cùng ${n.giver || ''} · ${dt(n.recount_at)}</span></div>` : ''}
      <div>Lệch so với Mục 5 ca ${shift}</div><div>${signed(n.gap)} ${handPill({ ...n, prev_shift: shift, tol: 5000 })}</div></div>
    ${n.state === 'lech' || n.state === 'can_dem_lai' ? html`<div class="st-meta">Khoản lệch này đã được cộng vào <strong>Tiền mặt chưa giải trình</strong> của ca ${shift} (ca giao).</div>` : ''}</div>`;
}

const money = (id, val, dis, extra = '') => html`<input class="input money" id="${id}" inputmode="numeric" autocomplete="off" placeholder="0" value="${fmt(val)}" ${dis ? 'disabled' : ''} ${extra}>`;
const opt = (v, label, cur) => html`<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;

function moveRow(m, ed) {
  const neg = m.amount === null || m.amount === undefined ? true : Number(m.amount) < 0;
  return html`<div class="pc-line mv-row">
    <select class="input sm mv-kind" aria-label="Loại" ${ed ? '' : 'disabled'}>${opt('tien_mat', 'Tiền mặt', m.kind)}${opt('chuyen_khoan', 'Chuyển khoản', m.kind)}</select>
    <select class="input sm mv-sign" aria-label="Dấu" ${ed ? '' : 'disabled'}>${opt('-', '− Chi / thiếu', neg ? '-' : '+')}${opt('+', '+ Thu / thừa', neg ? '-' : '+')}</select>
    <input class="input sm money mv-amt" inputmode="numeric" placeholder="Số tiền" aria-label="Số tiền" value="${fmt(Math.abs(Number(m.amount) || 0) || '')}" ${ed ? '' : 'disabled'}>
    <input class="input sm mv-note grow" placeholder="Nội dung (vd: chi tiền đá)" aria-label="Nội dung" value="${m.note || ''}" ${ed ? '' : 'disabled'}>
    ${ed ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Xóa dòng">×</button>` : ''}</div>`;
}
const debtDays = (d) => { const n = Math.max(0, Math.round((Date.parse(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)) - Date.parse(d)) / 864e5)); return n ? `${n} ngày` : 'hôm nay'; };
function debtRow(d, ed) {
  const lock = !ed || !!d.closed_at;
  return html`<div class="pc-line db-row" data-id="${d.id || ''}">
    <input class="input sm db-table" placeholder="Bàn" aria-label="Bàn" value="${d.table_name || ''}" style="width:90px" ${lock ? 'disabled' : ''}>
    <input class="input sm money db-amt" inputmode="numeric" placeholder="Số tiền" aria-label="Số tiền nợ" value="${fmt(d.amount)}" ${lock ? 'disabled' : ''}>
    <input class="input sm db-note grow" placeholder="Thông tin bàn giao (tên khách, SĐT, hẹn trả...)" aria-label="Ghi chú" value="${d.note || ''}" ${lock ? 'disabled' : ''}>
    ${d.closed_at ? html`<span class="pill ok db-paid" data-debt="${d.id}">Đã thu</span>` : ''}
    ${ed && !d.closed_at ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Xóa khoản nợ">×</button>` : ''}</div>`;
}
// SH = khung giờ của ca ở cơ sở này: người theo lịch chưa có giờ thì điền sẵn làm GỢI Ý (sửa được)
function staffRow(s, ed, SH) {
  const worked = s.worked === undefined ? true : !!s.worked;
  const hm = (x) => (x ? String(x).slice(0, 5) : '');
  const sgIn = ed && s.source === 'lich' && !s.time_in ? (s.sched?.start ? hm(s.sched.start) : SH ? hm(SH.start) : '') : '';   // bước 74: theo lịch tuần của người đó
  const sgOut = ed && s.source === 'lich' && !s.time_out ? (s.sched?.end ? hm(s.sched.end) : SH ? hm(SH.end) : '') : '';
  return html`<div class="st-row" data-emp="${s.employee_id}" data-src="${s.source}" data-role="${s.role || ''}">
    <div class="st-head"><div><strong>${s.code} – ${s.name}</strong> <span class="st-meta">${s.rank || ''}${s.role ? ' · ' + s.role : ''}</span></div>
      <span>${s.pay_cash ? html`<span class="pill info">Trả lương tiền mặt</span> ` : ''}<span class="pill ${s.source === 'lich' ? 'mute' : 'warn'}">${s.source === 'lich' ? 'Theo lịch' : 'Hỗ trợ phát sinh'}</span></span></div>
    <div class="pc-line">
      <select class="input sm st-worked" aria-label="Có làm hay nghỉ" ${ed ? '' : 'disabled'}>${opt('1', 'Có làm', worked ? '1' : '0')}${opt('0', 'Phát sinh nghỉ', worked ? '1' : '0')}</select>
      <span class="st-times" ${worked ? '' : 'hidden'}>
        <label>Đến <input class="input sm st-in ${sgIn ? 'st-sg' : ''}" type="time" value="${s.time_in || sgIn}" ${ed ? '' : 'disabled'} ${sgIn ? 'title="Gợi ý theo khung giờ ca — sửa theo thực tế"' : ''}></label>
        <label>Về <input class="input sm st-out ${sgOut ? 'st-sg' : ''}" type="time" value="${s.time_out || sgOut}" ${ed ? '' : 'disabled'} ${sgOut ? 'title="Gợi ý theo khung giờ ca — sửa theo thực tế"' : ''}></label>
        ${s.pay_cash ? html`<label>Đã trả lương tiền mặt <input class="input sm money st-cash" inputmode="numeric" placeholder="0" value="${s.cash_paid ? fmt(s.cash_paid) : ''}" style="width:120px" ${ed ? '' : 'disabled'}> đ</label>` : ''}</span>
      <input class="input sm st-reason grow" placeholder="Lý do nghỉ" aria-label="Lý do nghỉ" value="${s.absent_reason || ''}" ${worked ? 'hidden' : ''} ${ed ? '' : 'disabled'}>
      <input class="input sm st-note grow" placeholder="Ghi chú" aria-label="Ghi chú" value="${s.note || ''}" ${ed ? '' : 'disabled'}>
      ${ed && s.source !== 'lich' ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Bỏ người hỗ trợ">×</button>` : ''}</div></div>`;
}
const hoRow = (h, ed, giao) => html`<div class="pc-line ho-row" data-id="${h.id || ''}">
  <textarea class="input ho-text grow" rows="2" placeholder="Việc cần ca sau làm tiếp / thiết bị / vệ sinh / an toàn / sự cố" aria-label="Nội dung bàn giao" ${ed && !h.task_id ? '' : 'disabled'}>${h.content || ''}</textarea>
  ${h.done_at ? html`<span class="pill ok">Đã xong ${dt(h.done_at)}</span>` : h.task_id ? html`<span class="pill warn">Đã giao việc${h.task_assignee ? ` cho ${h.task_assignee}` : ''}</span>` : ''}
  ${giao ? html`<button type="button" class="btn sm secondary ho-giao" data-id="${h.id}">+ Giao thành việc</button>` : ''}
  ${ed && !h.task_id && !h.done_at ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Xóa việc">×</button>` : ''}</div>`;
const goodRow = (g, ed) => html`<div class="pc-line gd-row">
  <input class="input sm gd-item grow" placeholder="Mặt hàng" aria-label="Mặt hàng thiếu" value="${g.item || ''}" ${ed ? '' : 'disabled'}>
  <input class="input sm gd-qty" placeholder="Số lượng thiếu" aria-label="Số lượng thiếu" value="${g.qty || ''}" style="width:130px" ${ed ? '' : 'disabled'}>
  ${ed ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Xóa mặt hàng">×</button>` : ''}</div>`;

export async function render({ params }) {
  const id = Number(params.id);
  if (!id) return { title: 'Phiếu chốt ca', html: html`<div class="card">Thiếu mã phiếu. <a href="#/ca">Về danh sách ca</a></div>` };
  const R0 = await rpc('app_ca_get', { p_id: id });
  const done = R0.status === 'hoan_thanh';
  const canRc = !!R0.can_recon && done;
  // Bước 35: bản đối soát chỉ mở ở trang riêng #/quan-ly/doi-soat/ca (từng bước); #/ca/phieu luôn là phiếu nhân viên (chỉ xem khi đã hoàn thành)
  const wantDs = String(params.__ds || '') === '1';
  if (wantDs && !canRc) {
    return { title: 'Đối soát ca', html: html`<div class="card stack" style="gap:10px;max-width:640px"><h1 style="margin:0">Đối soát ca ${R0.shift}</h1>
      <div>${done ? 'Bạn không có quyền đối soát phiếu này.' : `Nhân viên chưa hoàn thành phiếu chốt ca ${R0.shift} nên chưa đối soát được.`}</div>
      <div class="toolbar"><a class="btn sm secondary" href="#/ca/phieu?id=${id}">Mở phiếu chốt ca</a><a class="btn sm secondary" href="#/quan-ly/doi-soat">‹ Về trang Đối soát</a></div></div>` };
  }
  // Bước 41: phiếu đang chốt → màn hình chốt ca mới theo phiếu Fabi (?cu=1 để xem phiếu kiểu cũ)
  if (!wantDs && R0.status === 'dang_chot' && R0.can_edit && String(params.cu || '') !== '1') {
    const [P41, cat41] = await Promise.all([rpc('app_ca_parts', { p_id: id }), catalog().catch(() => null)]);
    const SH41 = cat41 ? cat41.branchShifts(R0.branch_id).find((x) => x.name === R0.shift) || null : null;
    return renderNew(R0, P41, SH41);
  }
  const RC = canRc && wantDs ? await rpc('app_ca_recon', { p_id: id }).catch(() => null) : null;
  const isDs = !!RC;
  const R = isDs ? mergeRecon(R0, RC) : R0;
  const cat = await catalog().catch(() => null);
  const SH = cat ? cat.branchShifts(R.branch_id).find((x) => x.name === R.shift) || null : null;
  // bước 51: mục web tự đối soát (khớp file Fabi + ngân hàng) → nhạt đi, khoá
  const LK = isDs ? await rpc('app_ca_auto_locks', { p_id: id }).catch(() => null) : null;
  const DIR = isDs && LK?.is_chu ? getDirect(id) : null;   // bước 67: Chủ sửa thẳng mục đã đối soát
  const ed = isDs ? !!RC.editable || !!DIR : !!R.can_edit;
  // Bước 32: phiếu chia 3 phần việc — chỉ người nhận phần (chưa bấm Xong) được sửa phần đó
  const P = !isDs && R0.status === 'dang_chot' ? await rpc('app_ca_parts', { p_id: id }).catch(() => null) : null;
  const PD = isDs ? await rpc('app_ca_parts', { p_id: id }).catch(() => null) : null;   // ai làm từng phần (trang đối soát)
  const lkItem = (it) => !!LK && (LK.items || []).includes(it);
  const KT = isDs ? await rpc('app_ca_kt_state', { p_id: id }).catch(() => null) : null;
  const FB = isDs ? await rpc('app_fabi_for_report', { p_id: id }).catch(() => null) : null;   // bước 89: bảng NV ghi · file Fabi   // bước 57: phần tiền chờ kế toán?
  const PT = P ? Object.fromEntries((P.parts || []).map((p) => [p.part, p])) : {};
  const edFor = (k) => (P ? ed && !!PT[k]?.mine && !PT[k]?.done_at : ed && isDs);
  const edT = edFor('tien'); const edN = edFor('nhan_su'); const edH = edFor('nhan_hang');
  const edSharedT = isDs ? false : edT; const edSharedN = isDs ? false : edN; // bàn giao, công nợ, ảnh dùng chung — chỉ sửa trên phiếu nhân viên
  const first = R.shift === R.first_shift;
  const C = calc(R, debtSums(R));
  const rcEdit = R.can_recon && R0.recon_status !== 'hoan_thanh';
  const prev = R.prev;

  const chip = (item) => {
    if (!done || !isDs) return '';   // phiếu nhân viên chỉ xem: không còn nút đối soát
    if (lkItem(item)) return html`<span class="rc-chip on rc-auto" title="Web tự đối soát: khớp file Fabi và ngân hàng. Chỉ Chủ mở khoá được (Đèn đối soát).">🔒 ${CHECK_LABEL[item]}: WEB TỰ ĐỐI SOÁT</span>`;
    if (MONEY_ITEMS.includes(item)) {
      const x = (R.results || {})[item]; const cls = x ? RES[x.result][1] : '';
      const t = x ? `${x.by || ''} · ${dt(x.at)}${x.reason ? ' · ' + x.reason : ''}` : 'Bấm để chọn KHỚP / THIẾU / THỪA';
      return rcEdit && !x
        ? html`<button type="button" class="rc-chip rc-res ${cls}" data-item="${item}" title="${t}">${x ? '✓ ' : ''}${CHECK_LABEL[item]}: ${resText(x)}</button>`
        : html`<span class="rc-chip ${cls}" title="${t}">${CHECK_LABEL[item]}: ${resText(x)}</span>`;
    }
    const c = R.checks[item];
    const label = c ? `ĐÃ ĐỐI SOÁT` : 'CHƯA ĐỐI SOÁT';
    const t = c ? `${c.by} · ${dt(c.at)}` : '';
    return R.can_recon && R0.recon_status !== 'hoan_thanh' && !c
      ? html`<button type="button" class="rc-chip ${c ? 'on' : ''}" data-item="${item}" title="${t}" aria-pressed="${c ? 'true' : 'false'}">${c ? '✓ ' : ''}${CHECK_LABEL[item]}: ${label}</button>`
      : html`<span class="rc-chip ${c ? 'on' : ''}" title="${t}">${CHECK_LABEL[item]}: ${label}</span>`;
  };
  const doneItem = (it) => lkItem(it) || !!(R.checks || {})[it];   // bước 56: mục đã đối soát → nhạt + khoá, sửa bằng nút "Sửa"
  const sec = (title, items, inner, idAttr = '') => html`<section class="card stack pc-sec ${isDs && items.length && items.every(doneItem) && !(DIR && items.some((i) => DIR.items.includes(i))) ? 'pc-auto' : ''}" ${idAttr ? html`id="${idAttr}"` : ''}>
    <div class="pc-sec-head"><h2>${title}</h2><div class="rc-chips">${items.map(chip)}</div></div>${inner}</section>`;

  // A. Thời gian
  const startBox = first && !isDs
    ? html`<div class="pc-fixed">06:45 ${dmy(R.work_date)} <span class="st-meta">(cố định cho ca ${R.shift})</span></div>`
    : R.forced_start && !isDs
      ? html`<div class="pc-fixed">${dt(R.forced_start)} <span class="st-meta">(= giờ kết thúc doanh thu ca ${prev?.shift || R.first_shift})</span></div>`
      : html`<input class="input" type="datetime-local" id="rev_start" value="${toLocalInput(R.rev_start)}" ${edT ? '' : 'disabled'}>
        ${!first && !isDs && prev ? html`<div class="pc-hint warn">Ca ${prev.shift} chưa hoàn thành nên tạm nhập tay. Khi ca ${prev.shift} hoàn thành, giờ bắt đầu tự lấy theo giờ kết thúc của ca ${prev.shift}.</div>` : ''}
        ${prev && prev.rev_end ? html`<div class="pc-hint">Ca ${prev.shift} kết thúc doanh thu lúc ${dt(prev.rev_end)}.</div>` : ''}`;
  const secTime = sec('1. Thời gian doanh thu', ['thoi_gian'], html`
    <div class="pc-grid">
      <label class="pc-f"><span>Bắt đầu doanh thu</span>${startBox}</label>
      <label class="pc-f"><span>Kết thúc doanh thu</span><input class="input" type="datetime-local" id="rev_end" value="${toLocalInput(R.rev_end)}" ${edT ? '' : 'disabled'}>
        <span class="pc-hint">Chọn giờ chốt doanh thu trên POS (không phải giờ bấm hoàn thành). Qua nửa đêm thì chọn ngày hôm sau.</span></label>
    </div>
    <div class="kv pc-meta">
      <div>Tạo phiếu</div><div>${dt(R.created_at)} · ${R.created_by_name || '—'}</div>
      <div>Hoàn thành</div><div>${R.completed_at ? html`${dt(R.completed_at)} · ${R.completed_by_name}` : 'Chưa'}</div>
      ${R.updated_by_name && edT ? html`<div>Sửa gần nhất</div><div>${dt(R.updated_at)} · ${R.updated_by_name}</div>` : ''}
    </div>`);

  // B. Nhận két đầu ca (chốt 07/11): đếm mù → so két ca trước → lệch thì 2 người đếm lại (1 lần); Số dư đầu iPOS; ảnh phiếu iPOS
  const H = R.cash_hand || null;
  const staffEd = edT && !isDs;
  const iposPhotos = (R.photos || []).filter((p) => p.kind === 'ipos');
  const goodsPhotos = (R.photos || []).filter((p) => p.kind !== 'ipos');
  const phFig = (p, alt, del = edSharedT) => html`<figure class="ph" data-path="${p.path}"><a target="_blank" rel="noopener"><img alt="${alt}" loading="lazy"></a>
    ${del ? html`<button type="button" class="ph-del" data-id="${p.id}" aria-label="Xóa ảnh">×</button>` : ''}</figure>`;
  const counted = H && H.counted !== null && H.counted !== undefined;
  let openBox;
  if (first) {
    openBox = isDs ? money('opening_cash', R.opening_cash, !edT)
      : html`<div class="pc-fixed">1.000.000đ <span class="st-meta">(tiền lẻ cố định ca ${R.shift})</span></div><input type="hidden" id="opening_cash" value="1000000">`;
  } else if (isDs || !H) { // ca không nằm trong chuỗi két (FULL TIME): nhập tiền đầu ca trực tiếp như cũ
    openBox = html`${money('opening_cash', R.opening_cash, !edT)}${handInfo(H)}`;
  } else if (staffEd && !counted) {
    openBox = H && H.state === 'cho_ca_truoc'
      ? html`<div class="alert warn hand-wait">Ca ${H.prev_shift} chưa bấm <strong>HOÀN THÀNH</strong> phiếu chốt ca. Chờ người ca ${H.prev_shift} đếm két và hoàn thành phiếu, rồi bấm <button type="button" class="btn sm secondary" id="hand-reload">Tải lại</button></div>`
      : html`<div class="hand-blind"><div class="st-meta" style="font-size:13px">Tự đếm <strong>toàn bộ</strong> tiền trong két rồi nhập số. Số két ca trước khai chỉ hiện <strong>sau khi</strong> bạn xác nhận. Đã xác nhận thì không sửa được.</div>
        <div class="pc-line"><input class="input money" id="hand-count" inputmode="numeric" placeholder="Số tiền đếm được" autocomplete="off" aria-label="Số tiền đếm được khi nhận két" style="max-width:220px"><button type="button" class="btn" id="hand-ok">Xác nhận số đếm</button></div></div>`;
    openBox = html`${openBox}<input type="hidden" id="opening_cash" value="">`;
  } else {
    openBox = html`${handInfo(H)}
      ${staffEd && H.state === 'can_dem_lai' ? html`<div class="alert error">Lệch <strong>${signed(H.gap)}</strong> so với két ca ${H.prev_shift} khai. Gọi 1 người ca ${H.prev_shift} cùng đếm lại toàn bộ két, rồi nhập số đếm lại (chỉ nhập 1 lần).</div>
        <div class="pc-line"><select class="input sm" id="hand-giver" aria-label="Người ca trước cùng đếm lại"><option value="">— Người ca ${H.prev_shift} cùng đếm —</option>${(H.prev_staff || []).map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select>
          <input class="input sm money" id="hand-recount" inputmode="numeric" placeholder="Số đếm lại" autocomplete="off" aria-label="Số tiền 2 người đếm lại" style="width:150px"><button type="button" class="btn sm" id="hand-re">Lưu số đếm lại</button></div>` : ''}
      ${H && H.state === 'lech' ? html`<div class="alert error">Đã đếm lại${H.giver ? ` cùng ${H.giver}` : ''} nhưng vẫn lệch <strong>${signed(H.gap)}</strong>. Quản lý đã được báo; khoản lệch tính cho ca ${H.prev_shift}. Ghi lý do ở ô bên dưới.</div>` : ''}
      ${staffEd ? html`<input type="hidden" id="opening_cash" value="${R.opening_cash ?? ''}">` : ''}`;
  }
  const secMoney = sec('2. Nhận két, doanh thu và tiền', ['doanh_thu'], html`
    <div class="pc-sub" style="margin:0">NHẬN KÉT ĐẦU CA</div>
    <div class="pc-grid">
      <div class="pc-f"><span>Tiền nhận két đầu ca</span>${openBox}</div>
      <div class="pc-f"><span>Số dư đầu trên phiếu iPOS</span>${money('ipos_opening', R.ipos_opening, !staffEd)}
        <span class="pc-hint">Lúc mở ca trên iPOS, nhập Số dư đầu đúng bằng tiền nhận két (không để sẵn 1.000.000 nếu két có nhiều hơn).</span><div id="ipos-check"></div></div>
      <label class="pc-f" id="open-note-box" ${R.opening_note ? '' : 'hidden'}><span>Lý do lệch tiền đầu ca (bắt buộc khi lệch)</span><input class="input" id="opening_note" value="${R.opening_note || ''}" placeholder="vd: chủ rút 500.000đ lúc 14:00" autocomplete="off" ${staffEd ? '' : 'disabled'}></label>
    </div>
    <div class="pc-sub">DOANH THU VÀ TIỀN CUỐI CA <span class="st-meta">— lấy theo phiếu chốt ca iPOS</span></div>
    <div class="pc-grid">
      <label class="pc-f"><span>Mục 1 · Tổng doanh thu</span>${money('total_revenue', R.total_revenue, !edT)}</label>
      <label class="pc-f"><span>Mục 2 · Doanh thu tiền mặt theo POS</span>${money('pos_cash', R.pos_cash, !edT)}</label>
      <label class="pc-f"><span>Mục 3 · Doanh thu chuyển khoản theo POS</span>${money('pos_transfer', R.pos_transfer, !edT)}</label>
      <div class="pc-f"><span>Kiểm tra Mục 1 = Mục 2 + Mục 3 + Nợ phát sinh</span><div id="sum-check"></div></div>
      <label class="pc-f"><span>Mục 4 · Chuyển khoản thực tế (tự cộng hóa đơn trên hotline)</span>${money('reported_transfer', R.reported_transfer, !edT)}</label>
      <label class="pc-f"><span>Mục 5 · Tiền trong két thực đếm cuối ca</span>${R.cash_hidden ? html`<div class="pc-fixed st-meta">Ẩn tới khi ca sau đếm nhận két</div>` : money('cash_counted', R.cash_counted, !edT)}</label>
      <label class="pc-f"><span>Số cốc bán trong ca</span><input class="input" id="cups" inputmode="numeric" placeholder="0" value="${R.cups ?? ''}" ${edT ? '' : 'disabled'}></label>
    </div>
    <div class="pc-f"><span>Ảnh phiếu chốt ca iPOS (bắt buộc)</span>
      <div class="photos">${iposPhotos.map((p) => phFig(p, 'Ảnh phiếu chốt ca iPOS'))}</div>
      ${iposPhotos.length ? '' : R.cash_hidden ? html`<div class="st-meta">Ẩn tới khi ca sau đếm nhận két.</div>` : edSharedT ? '' : html`<div class="st-meta">Chưa có ảnh.</div>`}
      ${edSharedT ? html`<label class="btn sm secondary" style="align-self:flex-start">📷 Chụp phiếu chốt ca iPOS<input type="file" class="ph-input" data-kind="ipos" id="ipos-input" accept="image/*" multiple hidden></label><div class="st-meta ph-status"></div>` : ''}</div>`);

  // C. Chênh lệch, thu chi
  const secDiff = sec('3. Chênh lệch và chi tiết thu chi', ['tien_mat', 'chuyen_khoan', 'thu_chi'], html`
    <div class="pc-grid" id="diff-box"></div>
    ${isDs && R0.money && R0.money.next_hand ? nextHandCard(R0.money.next_hand, R.shift) : ''}
    ${isDs ? html`<div id="bank-box"></div><div id="bank-outs" class="diff-card"></div>` : ''}
    ${done && (R.shortfalls || []).length ? html`<div class="ka-box"><div class="pc-sub" style="margin:0">KHOẢN ÂM ĐÃ GÁN CHO NHÂN VIÊN</div>
      ${R.shortfalls.map((k) => html`<div class="pc-line"><strong>${k.employee}</strong> · ${CHECK_LABEL[k.item]} · ${vnd(k.amount)} <span class="pill ${KA_STATUS[k.status][1]}">${KA_STATUS[k.status][0]}</span>${k.seen_at ? html`<span class="st-meta">đã xem</span>` : ''}${k.reply ? html`<span class="st-meta">· giải trình: ${k.reply}</span>` : ''}</div>`)}
      <a class="st-meta" href="#/quan-ly/thu-chi?xem=khoan-am">Mở phiếu trừ lương trong Thu chi</a></div>` : ''}
    <div class="pc-sub">CHI TIẾT THU CHI <span class="st-meta">— giải trình từng khoản làm tiền lệch (số âm = chi/thiếu, số dương = thu/thừa)</span></div>
    <div id="moves">${(R.moves || []).map((m) => moveRow(m, edT))}</div>
    ${(R.debts || []).filter((d) => d.kind === 'muon').map((d) => html`<div class="pc-line carried"><div class="grow"><strong>Nợ TM – ${d.table_name}</strong> · ${vnd(-d.amount)} · tiền mặt
        <div class="st-meta">Tiền ra khỏi két, không tính chi phí; các ca sau thấy để đòi${d.note ? ' · ' + d.note : ''}${d.closed_at ? ` · đã trả ${dt(d.closed_at)}` : ''}</div></div></div>`)}
    ${(R.debts || []).filter((d) => d.kind === 'ck').map((d) => html`<div class="pc-line carried"><div class="grow"><strong>Nợ CK – ${d.table_name}</strong> · ${vnd(-d.amount)} · chuyển khoản
        <div class="st-meta">Fabi ghi chuyển khoản nhưng khách chưa chuyển — trừ khỏi tiền phải nhận trên hotline${d.note ? ' · ' + d.note : ''}${d.closed_at ? ` · đã trả ${dt(d.closed_at)}` : ''}</div></div></div>`)}
    ${(R.open_debts || []).filter((d) => d.kind === 'muon' && d.closed_report_id === R.id).map((d) => html`<div class="pc-line carried"><div class="grow"><strong>Khách trả Nợ TM – ${d.table_name}</strong> · +${vnd(d.amount)} · ${d.collect_kind === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'}
        <div class="st-meta">Nợ ca ${d.from_shift} ${dmy(d.from_date)}</div></div></div>`)}
    ${edT ? html`<div><button type="button" class="btn sm secondary" id="add-move">+ Thêm dòng thu chi</button></div>` : ''}`);

  // D. Công nợ
  const secDebt = sec('4. Khách chưa thanh toán (công nợ)', ['cong_no'], html`
    <div class="st-meta" style="font-size:13px">Nợ phát sinh được tính vào doanh thu: <strong>Mục 1 = Mục 2 + Mục 3 + Nợ phát sinh</strong>. Khách trả nợ của ca trước thì bấm <strong>Khách đã trả</strong> và chọn tiền mặt hay chuyển khoản — tiền đó được cộng vào ca này.</div>
    ${(() => {   // khách trả nợ: hiện ở đúng ca thu tiền; nợ cũ chưa thu để riêng
      const od = (R.open_debts || []).filter((d) => !d.kind || d.kind === 'bill');
      const paid = od.filter((d) => d.closed_at); const open = od.filter((d) => !d.closed_at);
      const row = (d) => html`<div class="pc-line carried">
        <div class="grow"><strong>${d.by_ql ? d.table_name : `Bàn ${d.table_name}`}</strong>${d.phone ? html` · <span class="st-meta">${d.phone}</span>` : ''} · ${vnd(d.amount)} <span class="st-meta">· ${d.by_ql ? `quản lý ghi ${dmy(d.from_date)}` : `nợ từ ca ${d.from_shift} ${dmy(d.from_date)}`}${!d.closed_at ? ` · ${debtDays(d.from_date)}` : ''}${d.note ? ' · ' + d.note : ''}</span>
          ${d.closed_at ? html`<div class="st-meta">Trả bằng <strong>${d.collect_kind === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'}</strong> trong ca này${d.close_note && d.close_note !== 'Đã thu' ? ' · ' + d.close_note : ''} · ${d.closed_by_name || ''} ghi</div>` : ''}</div>
        ${edSharedT ? (d.closed_at ? html`<button type="button" class="btn sm secondary debt-close" data-id="${d.id}" data-undo="1">Bỏ đánh dấu</button>`
          : html`<button type="button" class="btn sm debt-close" data-id="${d.id}" data-amt="${d.amount}" data-table="${d.by_ql ? d.table_name : `bàn ${d.table_name}`}">Khách đã trả</button>`) : ''}</div>`;
      return html`${paid.length ? html`<div class="pc-sub">KHÁCH TRẢ NỢ TRONG CA NÀY <span class="st-meta">— ${vnd(paid.reduce((t, d) => t + Number(d.amount || 0), 0))}, đã cộng vào tiền của ca</span></div>${paid.map(row)}` : ''}
        ${open.length ? html`<div class="pc-sub">NỢ TỪ CÁC CA TRƯỚC CHƯA THU</div>${open.map(row)}` : ''}`;
    })()}
    ${isDs ? html`<div class="pc-sub">GHI NHẬN NỢ KHI ĐỐI SOÁT <span class="st-meta">— khách nợ nhưng nhân viên bấm nhầm thanh toán chuyển khoản / tiền mặt trên Fabi</span></div>
      ${(R.recon_debts || []).map((d) => html`<div class="pc-line carried"><div class="grow"><strong>${d.name}</strong>${d.phone ? html` · <span class="st-meta">${d.phone}</span>` : ''} · ${vnd(d.amount)}
          <span class="st-meta">· NV bấm nhầm ${d.item === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'} · ${d.closed ? `khách đã trả (${d.collect_kind === 'chuyen_khoan' ? 'CK' : 'TM'}) — đã bù ca này` : 'chờ khách trả'} · ${d.by || ''}</span></div>
        ${!d.closed ? html`<button type="button" class="btn sm secondary danger rd-del" data-id="${d.id}" aria-label="Xoá khoản ghi nhận">×</button>` : ''}</div>`)}
      <div><button type="button" class="btn sm secondary" id="rd-add">+ Ghi nhận nợ</button></div>` : ''}
    <div class="pc-sub">NỢ PHÁT SINH CA NÀY</div>
    <div id="debts">${(R.debts || []).filter((d) => !d.kind || d.kind === 'bill').map((d) => debtRow(d, edSharedT))}</div>
    ${edSharedT ? html`<div><button type="button" class="btn sm secondary" id="add-debt">+ Thêm bàn còn nợ</button></div>` : (R.debts || []).some((d) => !d.kind || d.kind === 'bill') ? '' : html`<div class="st-meta">Không có.</div>`}`);

  // Bước 57: trang Đối soát — khung "Tiền của ca" gộp phần 1–3 (thời gian, nhận két / doanh thu, chênh lệch / thu chi)
  const hm = (t) => (t ? String(t).slice(11, 16) : '—');
  const timeOk = !!(R.rev_start && R.rev_end && R.rev_end > R.rev_start);
  const secCa = isDs ? html`<section class="card stack pc-sec ca-sec" style="gap:10px">
    <div class="pc-sec-head"><h2>Tiền của ca</h2><span class="st-meta">so theo file Fabi + ngân hàng</span></div>
    <div class="ca-time">Giờ doanh thu <strong>${hm(R.rev_start)} → ${hm(R.rev_end)}</strong> ${(R.checks || {}).thoi_gian ? html`<span class="pill ok">✓ đã đối soát</span>` : timeOk ? html`<span class="pill ok">✓</span>` : html`<span class="pill off">chưa đúng — sửa ở "Xem / sửa số liệu"</span>`}</div>
    <div id="ca-box" class="stack" style="gap:8px"></div>
    <div class="pc-sub" style="margin:4px 0 0">THU CHI CỦA CA <span class="st-meta">— chọn nhóm (hoặc "Không tính") ngay trên từng dòng</span></div>
    <div id="ds-tc"><div class="st-meta">Đang tải…</div></div>
    <details class="ca-more" id="ca-more"><summary>Xem / sửa số liệu <span class="st-meta">(mục 1–5, ảnh iPOS, nhận két, số dư ngân hàng, phiếu chi, sửa khoản thu chi)</span></summary>
      <div class="stack" style="gap:12px;margin-top:10px">${secTime}${secMoney}${secDiff}</div></details>
  </section>` : '';

  // bước 89: các khung đối chiếu giống ảnh mẫu (anh Tiến duyệt 13/11)
  const t5 = (x) => (x ? String(x).slice(0, 5) : '');
  const mins = (a) => { const [h, m] = String(a).split(':').map(Number); return h * 60 + (m || 0); };
  const g4 = (rows) => html`<div class="fb-g"><div class="h">Mục</div><div class="h n">NV ghi</div><div class="h n">Đối chiếu</div><div></div>${rows.map(([l, a, b, ok]) => html`<div>${l}</div><div class="n">${a === null || a === undefined ? '—' : typeof a === 'number' ? fmt(a) : a}</div><div class="n">${b === null || b === undefined ? '—' : typeof b === 'number' ? fmt(b) : b}</div><div class="${ok === null ? '' : ok ? 'fb-ok' : 'fb-bad'}">${ok === null ? '' : ok ? '✓' : '✗'}</div>`)}</div>`;
  const kvl = (rows) => html`<div class="kv fb-kv">${rows.map(([l, v, c]) => html`<div class="${c || ''}">${l}</div><div class="${c || ''}">${v}</div>`)}</div>`;
  const sg = (n) => (Number(n) < 0 ? '−' : Number(n) > 0 ? '+' : '') + fmt(Math.abs(Number(n) || 0));
  // Ai làm ca: so với lịch
  const schedOf = (s) => { const o = (R0.staff || []).find((x) => x.employee_id === s.employee_id) || {}; const sc = s.sched || o.sched || null; return sc && sc.start ? sc : (s.source === 'lich' && SH ? { start: SH.start, end: SH.end } : null); };
  const staffCmp = (() => {
    if (!isDs) return '';
    let diff = 0; const st = R.staff || [];
    const rows = st.map((s) => {
      const sc = schedOf(s); const nm = `${s.code ? s.code + ' – ' : ''}${s.name || 'NV ' + s.employee_id}`;
      if (!s.worked) { diff++; return html`<div class="fb-row"><div class="pc-line"><strong class="grow">${nm}</strong><span class="pill warn">Nghỉ</span></div><div class="st-meta">${sc ? `Lịch ${t5(sc.start)}–${t5(sc.end)} · ` : ''}lý do: ${s.absent_reason || '—'}</div></div>`; }
      const notes = [];
      if (sc && s.time_in && s.time_out) { const a = mins(t5(s.time_in)) - mins(t5(sc.start)); const b = mins(t5(s.time_out)) - mins(t5(sc.end)); if (a > 0) notes.push(`đến muộn ${a} phút`); if (a < 0) notes.push(`đến sớm ${-a} phút`); if (b < 0) notes.push(`về sớm ${-b} phút`); if (b > 0) notes.push(`về muộn ${b} phút`); }
      if (!sc || notes.length) diff++;
      return html`<div class="fb-row"><div class="pc-line"><strong class="grow">${nm}</strong>${!sc ? html`<span class="pill warn">Ngoài lịch</span>` : notes.length ? html`<span class="pill warn">${notes.join(' · ')}</span>` : html`<span class="pill ok">Đúng lịch ✓</span>`}</div>
        <div class="st-meta">${sc ? `Lịch ${t5(sc.start)}–${t5(sc.end)} · ` : ''}NV ghi ${t5(s.time_in) || '?'}–${t5(s.time_out) || '?'}${Number(s.cash_paid) > 0 ? ` · lương TM ${fmt(s.cash_paid)}` : ''}</div></div>`;
    });
    const w = st.filter((s) => s.worked).length; const off = st.length - w;
    return html`<section class="card stack pc-sec" style="gap:8px"><div class="pc-sec-head"><h2>Ai làm ca</h2><div class="rc-chips">${chip('nhan_su')}</div></div>
      <div class="st-meta">So với <b>lịch đã xếp</b>. Nhân viên ghi sai thì sửa ở mục <b>"Sửa giờ / người làm"</b> bên dưới, ghi lý do sửa ở cuối trang — mọi lần sửa được lưu lịch sử.</div>
      ${rows.length ? rows : html`<div class="st-meta">Phiếu chưa có người làm.</div>`}
      <div class="alert ${diff ? 'warn' : 'ok'}" style="margin:0">${w} người làm${off ? ` · ${off} nghỉ` : ''}${diff ? html` · <b>${diff} chỗ khác lịch</b> — kiểm tra rồi duyệt` : ' · đúng lịch ✓'}</div></section>`;
  })();
  // Phiếu Fabi: NV ghi · file Fabi
  const fabiCmp = (() => {
    if (!isDs) return '';
    const f = FB || {}; const has = !!FB; const eq = (a, b) => (has && b !== null && b !== undefined ? Number(a) === Number(b) : null);
    const rows = [['Số dư đầu', R.ipos_opening, f.dau], ['Doanh thu (NET)', R.total_revenue, f.net], ['Chuyển khoản', R.pos_transfer, f.ck], ['Tiền mặt', R.pos_cash, f.tm], ['Nợ', R.pos_debt, f.no], ['Tổng tiền', R.cash_counted, f.tong], ['Tiền chênh lệch', R.pos_diff, f.chenh]]
      .map(([l, a, b]) => [l, a === null || a === undefined ? null : Number(a), b === null || b === undefined ? null : Number(b), eq(a, b)]);
    const bad = rows.filter((x) => x[3] === false).length; const okN = rows.filter((x) => x[3] === true).length;
    const paid = (R.open_debts || []).filter((d) => d.closed_report_id === R.id);
    const how = (d) => ((!d.kind || d.kind === 'bill') ? html`<span class="fb-ok">✓</span> so với file Fabi (phiếu thanh toán nợ)`
      : d.collect_kind === 'chuyen_khoan' ? html`→ đã cộng vào <b>tiền phải nhận trên hotline</b> — chưa chuyển thật thì bước Tiền thực nhận báo lệch`
        : html`→ đã cộng vào <b>tiền phải có trong két</b> — không trả thật thì bước Tiền thực nhận báo lệch`);
    return html`<section class="card stack pc-sec" style="gap:8px"><div class="pc-sec-head"><h2>Phiếu Fabi</h2><div class="rc-chips">${chip('thoi_gian')}${chip('doanh_thu')}</div></div>
      <div class="pc-line" style="gap:8px;flex-wrap:wrap">${has ? html`<span class="pill ok">File Fabi: đã có ✓</span>` : html`<span class="pill off">Chưa có file Fabi — kế toán tải ở Kế toán › File ca Fabi</span>`}<span class="st-meta">Giờ doanh thu ${R.rev_start ? String(R.rev_start).slice(11, 16) : '—'} → ${R.rev_end ? String(R.rev_end).slice(11, 16) : '—'}</span></div>
      ${g4(rows)}
      ${paid.length ? html`<h3 style="margin:6px 0 0">Khách trả nợ cũ trong ca</h3>${paid.map((d) => html`<div class="fb-row"><div class="pc-line"><strong class="grow">${noName(d)} · ${d.collect_kind === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'}</strong><b>${fmt(d.amount)}</b></div><div class="st-meta">${how(d)}</div></div>`)}` : ''}
      ${has ? html`<div class="alert ${bad ? 'warn' : 'ok'}" style="margin:0">${bad ? html`⚠️ Lệch file Fabi <b>${bad}</b> dòng — sửa ở mục "Sửa số liệu phiếu Fabi" bên dưới` : html`✅ Khớp file Fabi <b>${okN}/${rows.length}</b> dòng.`}</div>` : ''}</section>`;
  })();
  // Khách nợ trong ca: HĐ / TM / CK — quản lý đổi được loại
  const canKind = isDs && !!R.can_recon && R0.recon_status !== 'hoan_thanh';
  const debtCmp = (() => {
    if (!isDs) return '';
    const ds = (R0.debts || []);
    const billS = ds.filter((d) => !d.kind || d.kind === 'bill').reduce((t, d) => t + Number(d.amount || 0), 0);
    const tmS = ds.filter((d) => d.kind === 'muon').reduce((t, d) => t + Number(d.amount || 0), 0); const ckS = ds.filter((d) => d.kind === 'ck').reduce((t, d) => t + Number(d.amount || 0), 0);
    const fno = FB ? Number(FB.no) : Number(R.pos_debt || 0);
    return html`<section class="card stack pc-sec" style="gap:8px"><div class="pc-sec-head"><h2>Khách nợ trong ca</h2><div class="rc-chips">${chip('cong_no')}</div></div>
      <div class="st-meta">Kiểm tra loại nợ nhân viên chọn. Sai thì bấm đổi. (Công nợ gia đình phân loại ở <b>Thu chi › Công nợ</b>, không làm ở đây.)</div>
      ${ds.length ? ds.map((d) => html`<div class="fb-row"><div class="pc-line" style="gap:8px;flex-wrap:wrap"><strong class="grow">${(!d.kind || d.kind === 'bill') ? 'Bàn ' : ''}${d.table_name} · ${fmt(d.amount)}</strong>
          <span class="seg cm88-seg">${[['bill', 'HĐ'], ['muon', 'TM'], ['ck', 'CK']].map(([k, l]) => html`<button type="button" class="${(d.kind || 'bill') === k ? 'on' : ''}" data-dkind="${k}" data-debt="${d.id}" ${canKind && !d.closed_at ? '' : 'disabled'}>${l}</button>`)}</span></div>
          <div class="st-meta">${d.note || ''}${d.note && d.closed_at ? ' · ' : ''}${d.closed_at ? html`<span class="db-paid" data-debt="${d.id}">Đã thu ngày ${dmy(String(d.closed_at).slice(0, 10))}${d.collect_kind === 'chuyen_khoan' ? ' · chuyển khoản' : d.collect_kind === 'tien_mat' ? ' · tiền mặt' : ''}${d.closed_report_id ? '' : ' (quản lý thu, không qua ca)'}</span>` : (d.note ? '' : 'Chưa thu')}</div></div>`) : html`<div class="st-meta">Ca này không có khách nợ mới.</div>`}
      <div class="alert ${billS === fno ? 'ok' : 'warn'}" style="margin:0">${billS === fno ? '✅' : '⚠️'} Nợ HĐ <b>${fmt(billS)}</b> ${billS === fno ? '=' : '≠'} Nợ trên ${FB ? 'file Fabi' : 'phiếu Fabi'} (${fmt(fno)})${tmS ? html`<br>Nợ TM ${fmt(tmS)} → trừ tiền két` : ''}${ckS ? html`<br>Nợ CK ${fmt(ckS)} → trừ tiền hotline` : ''}</div>
      <div class="lx-err" id="dk-err"></div></section>`;
  })();
  // Tiền thực nhận: chuyển khoản (phải nhận · NV cộng · sao kê) và tiền mặt (phải có · NV đếm · cách thu)
  function thucCmp() {
    const M = (R0 && R0.money) || {}; const DS = debtSums(R);
    const mv = (k, sgn) => (R.moves || []).filter((m) => m.kind === k && !m.auto && (sgn > 0 ? Number(m.amount) > 0 : Number(m.amount) < 0)).reduce((t, m) => t + Number(m.amount || 0), 0);
    const ckThu = mv('chuyen_khoan', 1); const ckChi = mv('chuyen_khoan', -1); const tmThu = mv('tien_mat', 1); const tmChi = mv('tien_mat', -1);
    const sal = (R.staff || []).filter((x) => x.worked && Number(x.cash_paid) > 0).reduce((t, x) => t + Number(x.cash_paid), 0);
    const ckMust = Number(R.pos_transfer || 0) + DS.colCK + ckThu + ckChi - DS.ckOut;
    const op = Number(R.opening_cash ?? R.ipos_opening ?? 0);
    const tmMust = op + Number(R.pos_cash || 0) + DS.colTM + tmThu + tmChi - sal - DS.loanOut;
    const ccUse = R0.cash_mode === 'ca' && R0.ql_counted !== null && R0.ql_counted !== undefined ? Number(R0.ql_counted) : Number(R.cash_counted);
    const okv = (a, b) => (a === null || a === undefined || Number.isNaN(Number(a)) ? null : Number(a) === Number(b));
    return html`<div class="cm-rc fb-blk"><div class="pc-sub" style="margin:0">1. CHUYỂN KHOẢN THỰC NHẬN</div>
        ${kvl([['CK trên phiếu Fabi', fmt(R.pos_transfer)], ['+ Khách trả nợ CK', fmt(DS.colCK), 'fb-p'], ['+ Thu CK / − Chi CK', sg(ckThu + ckChi)], ['− Nợ CK mới', sg(-DS.ckOut), 'fb-m'], ['= Phải nhận', fmt(ckMust), 'fb-t']])}
        ${g4([['Nhân viên cộng hotline', R.reported_transfer === null || R.reported_transfer === undefined ? null : Number(R.reported_transfer), ckMust, okv(R.reported_transfer, ckMust)], ['Sao kê ngân hàng (kế toán)', null, M.bank_ok ? Number(M.bank_received) : 'chưa nhập', M.bank_ok ? Number(M.bank_received) === ckMust : null]])}
        <div class="alert ${Number(M.ck_left) === 0 ? 'ok' : 'error'}" style="margin-top:6px"><b>Chuyển khoản: ${Number(M.ck_left) === 0 ? 'KHỚP ✓' : 'LỆCH ' + signed(M.ck_left)}</b>${M.bank_ok ? '' : html` <span class="st-meta">(tạm theo số nhân viên cộng — kế toán chưa nhập sao kê)</span>`}</div></div>
      <div class="cm-rc fb-blk"><div class="pc-sub" style="margin:0">2. TIỀN MẶT THỰC NHẬN</div>
        ${kvl([['Số dư đầu ca', fmt(op)], ['+ Doanh thu TM (Fabi)', fmt(R.pos_cash), 'fb-p'], ['+ Khách trả nợ TM', fmt(DS.colTM), 'fb-p'], ['+ Thu TM', fmt(tmThu), 'fb-p'], ['− Chi TM (gồm chi lương)', sg(tmChi - sal), 'fb-m'], ['− Nợ TM mới', sg(-DS.loanOut), 'fb-m'], ['= Phải có trong két', fmt(tmMust), 'fb-t']])}
        ${g4([['Nhân viên đếm cuối ca', Number(R.cash_counted), tmMust, okv(R.cash_counted, tmMust)]])}
        ${cashMode()}
        <div class="alert ${Number(M.tm_left) === 0 ? 'ok' : 'error'}" style="margin-top:6px"><b>Tiền mặt: ${Number(M.tm_left) === 0 ? 'KHỚP ✓' : 'LỆCH ' + signed(M.tm_left)}</b>${Number(M.tm_left) !== 0 ? ' — xử lý ở bước cuối' : ''}${ccUse !== Number(R.cash_counted) ? html` <span class="st-meta">(theo số quản lý đếm ${fmt(ccUse)})</span>` : ''}</div></div>`;
  }
  // Bước 86: khung riêng cho từng bước tiền
  const caTime = isDs ? html`<section class="card stack pc-sec" style="gap:6px"><div class="ca-time">Giờ doanh thu <strong>${hm(R.rev_start)} → ${hm(R.rev_end)}</strong> ${(R.checks || {}).thoi_gian ? html`<span class="pill ok">✓ đã đối soát</span>` : timeOk ? html`<span class="pill ok">✓</span>` : html`<span class="pill off">chưa đúng — sửa ở mục 1 bên dưới</span>`}</div>
    <div class="st-meta">So số nhân viên ghi với phiếu Fabi (ảnh, file Fabi kế toán tải). Sai thì sửa ngay ở các ô dưới — ghi lý do ở cuối trang.</div></section>` : '';
  const secTc = isDs ? html`<section class="card stack pc-sec" style="gap:8px"><div class="pc-sec-head"><h2>Thu chi của ca</h2><div class="rc-chips">${chip('thu_chi')}</div></div>
    <div class="st-meta">Chọn <b>nhóm</b> cho từng khoản (vào Sổ quỹ / báo cáo); khoản quản lý rút thì chọn "Không tính". Chi lương tiền mặt chọn nhóm Lương, <b>gán cho nhân viên</b> nếu muốn Bảng công ghi đã trả.</div>
    <div id="ds-tc"><div class="st-meta">Đang tải…</div></div></section>` : '';
  const secThuc = isDs ? html`<section class="card stack pc-sec ca-sec" style="gap:10px"><div class="pc-sec-head"><h2>Tiền thực nhận</h2><div class="rc-chips">${chip('tien_mat')}${chip('chuyen_khoan')}</div></div>
    <div class="st-meta">So <b>tiền phải có</b> với <b>tiền thực nhận</b>: chuyển khoản theo sao kê ngân hàng (kế toán nhập), tiền mặt theo số đếm. Lệch thì xử lý ở bước cuối.</div>
    ${thucCmp()}</section>` : '';
  const rcWhy = isDs && ed && !DIR ? html`<label class="pc-f"><span>Lý do sửa <b>(bắt buộc khi sửa số)</b></span><input class="input rc-why" placeholder="vd: nhân viên nhập nhầm số POS" autocomplete="off"></label><div class="alert error rc-need" style="margin:0" hidden>Ghi lý do sửa ở ô trên — chưa có lý do thì web chưa lưu số vừa sửa.</div>` : '';
  const caBoxSec = isDs ? html`<section class="card stack pc-sec" style="gap:8px"><div class="pc-sec-head"><h2>Tiền của ca <span class="st-meta">— máy chủ tính, phiếu chi chuyển khoản</span></h2></div><div id="ca-box" class="stack" style="gap:8px"></div></section>` : '';
  const M86 = (R0 && R0.money) || {};
  // bước 88: tiền mặt thực nhận — Thu theo ca (quản lý đếm & thu ngay, lệch theo số quản lý đếm) / Thu cuối ngày (bắt buộc tiền kết ca = tiền mở ca sau)
  function cashMode() {
    const mode = R0.cash_mode || 'ngay'; const nh = ((R0 && R0.money) || {}).next_hand; const can88 = !!R.can_recon && R0.recon_status !== 'hoan_thanh';
    const qc = R0.ql_counted; const goi = 1000000;
    return html`<div class="cm88 stack" style="gap:6px;border:1px solid var(--line);border-radius:12px;padding:10px">
      <div class="pc-line" style="gap:8px;flex-wrap:wrap"><b>Tiền mặt — cách thu:</b><span class="seg cm88-seg">${[['ca', 'Thu theo ca'], ['ngay', 'Thu cuối ngày']].map(([k, l]) => html`<button type="button" class="${mode === k ? 'on' : ''}" data-cmode="${k}" ${can88 ? '' : 'disabled'}>${l}</button>`)}</span></div>
      ${mode === 'ca' ? html`<div class="st-meta">Quản lý <b>đếm và thu tiền ngay khi ca kết thúc</b>. Ca sau mở két bằng tiền gối đầu ${fmt(goi)}.</div>
        <div class="pc-line" style="gap:8px;flex-wrap:wrap"><span>Nhân viên đếm <b>${vnd(R.cash_counted)}</b> · Quản lý đếm thực nhận</span><input class="input sm money" id="ql-count" inputmode="numeric" value="${qc !== null && qc !== undefined ? fmt(qc) : ''}" style="width:140px" ${can88 ? '' : 'disabled'}>${can88 ? html`<button type="button" class="btn sm" id="ql-save">Lưu</button>` : ''}</div>
        ${qc !== null && qc !== undefined ? html`<div class="st-meta">Thu về quỹ <b>${vnd(Math.max(0, Number(qc) - goi))}</b> · để lại gối đầu ${vnd(Math.min(goi, Number(qc)))}. Lệch tiền mặt tính theo số quản lý đếm.</div>` : html`<div class="st-meta">Chưa nhập số quản lý đếm — lệch tạm tính theo số nhân viên đếm.</div>`}`
      : html`<div class="st-meta">Tiền <b>để lại trong két cho ca sau</b>; quản lý đếm một lần <b>cuối ngày</b> (cột Kiểm đếm ở bảng tuần).</div>
        <div class="pc-line"><b class="grow">Điều kiện: tiền kết ca này = tiền mở ca sau</b>${nh ? (Number(nh.gap) === 0 ? html`<span class="pill ok">✓ ${vnd(nh.counted)}</span>` : html`<span class="pill warn">✗ ca ${nh.shift} nhận ${vnd(nh.counted)} · lệch ${signed(nh.gap)}</span>`) : html`<span class="st-meta">chờ ca sau mở két (ca cuối ngày: kiểm đếm cuối ngày)</span>`}</div>
        ${nh && Number(nh.gap) !== 0 ? html`<div class="alert error" style="margin:0">Tiền hụt khi giao ca — kiểm lại trước khi duyệt (khoản lệch đã tính vào tiền mặt của ca này).</div>` : ''}`}
      <div class="lx-err" id="cm88-err"></div></div>`;
  }
  const lxBox = (item) => {
    const x = (R.results || {})[item]; const g = item === 'tien_mat' ? M86.tm_left : M86.ck_left; const lbl = item === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản';
    if (x) return html`<div class="pc-line"><strong class="grow">${lbl}</strong><span class="rc-chip ${RES[x.result][1]}">${resText(x)}</span></div>`;
    if (lkItem(item)) return html`<div class="pc-line"><strong class="grow">${lbl}</strong><span class="pill ok">🔒 Web tự đối soát</span></div>`;
    if (g === null || g === undefined) return html`<div class="pc-line"><strong class="grow">${lbl}</strong><span class="st-meta">Chưa đủ số liệu (chờ kế toán / ngân hàng)</span></div>`;
    if (Number(g) === 0) return html`<div class="pc-line"><strong class="grow">${lbl}</strong><span class="pill ok">KHỚP ✓</span></div>`;
    const ppl = (R.staff || []).filter((s2) => s2.worked);
    return html`<div class="lx-box stack" data-item="${item}" data-gap="${g}" style="gap:6px;border:1px solid var(--line);border-radius:12px;padding:10px">
      <div class="pc-line"><strong class="grow">${lbl}: ${Number(g) < 0 ? 'THIẾU' : 'THỪA'} ${signed(g)}</strong></div>
      <label class="radio-pill"><input type="radio" name="lx-${item}" value="qc"> ${Number(g) < 0 ? 'Quán chịu' : 'Ghi thu khác (quán giữ)'} <span class="st-meta">(Chủ / Quản lý tổng)</span></label>
      ${Number(g) < 0 ? html`<label class="radio-pill"><input type="radio" name="lx-${item}" value="chia"> Chia đều người làm ca <span class="st-meta">(khoản âm, trừ lương)</span></label>` : ''}
      <label class="radio-pill"><input type="radio" name="lx-${item}" value="sau" checked> Đối soát lại sau</label>
      <div class="lx-people stack" style="gap:4px" hidden>${ppl.length ? ppl.map((p2) => html`<div class="pc-line lx-p" data-emp="${p2.employee_id}"><label class="grow" style="display:flex;gap:8px;align-items:center"><input type="checkbox" checked> ${p2.code ? p2.code + ' – ' : ''}${p2.name || 'NV ' + p2.employee_id}</label><input class="input sm money lx-pa" inputmode="numeric" style="width:120px" aria-label="Số tiền"></div>`) : html`<div class="st-meta">Ca chưa có người làm.</div>`}<div class="st-meta lx-sum"></div></div>
      <input class="input sm lx-why" placeholder="Ghi chú của quản lý (không bắt buộc)">
      <div class="lx-err"></div>
      <div><button type="button" class="btn sm lx-save">Lưu cách xử lý</button></div></div>`;
  };
  const secLech = isDs ? html`<style>.lx-people[hidden] { display: none !important; }</style><section class="card stack pc-sec" style="gap:8px"><div class="pc-sec-head"><h2>Xử lý lệch</h2></div>
    ${lxBox('tien_mat')}${lxBox('chuyen_khoan')}
    <div class="st-meta">"Đối soát lại sau": ca thành <b>Hoàn thành 1 phần</b> (màu vàng ở bảng tuần) — mở lại lúc nào cũng được. Ca có bước Nghỉ & làm thay (x2) chỉ hoàn thành khi Chủ đã duyệt.</div></section>` : '';

  // E. Nhân viên
  const secStaff = sec('5. Nhân viên thực tế làm trong ca', ['nhan_su'], html`
    <div class="st-meta">Danh sách theo lịch đã xếp. Ghi nhận ở đây không sửa lịch đã xếp.</div>
    ${edN && SH && (R.staff || []).some((s) => s.source === 'lich' && (!s.time_in || !s.time_out)) ? html`<div class="st-meta" style="font-size:13px">Giờ đến/về của người theo lịch được <span class="st-sg" style="padding:0 4px;border-radius:4px">điền sẵn theo khung ca ${String(SH.start || '').slice(0, 5)}–${String(SH.end || '').slice(0, 5)}</span> để gợi ý — sửa lại theo giờ thực tế.</div>` : ''}
    <div id="staff" class="stack" style="gap:8px">${(R.staff || []).map((s) => staffRow(s, edN, SH))}</div>
    ${(R.staff || []).length ? '' : html`<div class="st-meta" id="staff-empty">Lịch chưa xếp ai cho ca này.</div>`}
    ${edN ? html`<div class="pc-line"><input class="input sm grow" id="helper" list="emp-list" placeholder="Gõ mã hoặc tên người hỗ trợ" aria-label="Người hỗ trợ"><datalist id="emp-list"></datalist>
      <button type="button" class="btn sm secondary" id="add-helper">+ Thêm người hỗ trợ</button></div>` : ''}
    <div><strong>Số người thực tế làm: <span id="staff-count"></span></strong></div>`);

  // F. Bàn giao
  const carried = R.carried || [];
  const secHand = sec('6. Nội dung bàn giao ca sau', ['ban_giao'], html`
    ${carried.length ? html`<div class="pc-sub">VIỆC CHƯA XONG TỪ CÁC CA TRƯỚC</div>${carried.map((h) => html`<div class="pc-line carried">
        <div class="grow">${h.content}<div class="st-meta">Ca ${h.from_shift} ${dmy(h.from_date)} · ${h.created_by_name || ''}${h.done_at ? ` · Xong: ${h.done_by_name} ${dt(h.done_at)}` : ''}</div></div>
        ${h.task_id ? (h.done_at ? html`<span class="pill ok">Đã xử lý</span>` : html`<span class="pill warn">Đã giao việc — chờ xử lý</span>`)
          : edSharedN ? (h.done_at ? html`<button type="button" class="btn sm secondary ho-done" data-id="${h.id}" data-undo="1">Bỏ đánh dấu</button>`
            : html`<button type="button" class="btn sm ho-done" data-id="${h.id}">Đã xong</button>`)
            : h.done_at ? html`<span class="pill ok">Đã xong</span>` : html`<span class="pill off">Chưa xong</span>`}</div>`)}` : ''}
    <div class="pc-sub">BÀN GIAO CỦA CA NÀY <span class="st-meta">— công việc, thiết bị, vệ sinh, an toàn, sự cố</span></div>
    <div id="handover" class="stack" style="gap:8px">${(R.handover || []).map((h) => hoRow(h, edSharedN, isDs && !!R.can_recon && !!h.id && !h.task_id && !h.done_at))}</div>
    ${edSharedN ? html`<div><button type="button" class="btn sm secondary" id="add-ho">+ THÊM CÔNG VIỆC</button></div>` : (R.handover || []).length ? '' : html`<div class="st-meta">Không có.</div>`}`);

  // G. Nhập hàng từ kho tổng (bước 31): hóa đơn kế toán gửi → nhân viên kiểm từng món + ảnh; quản lý đối soát từng ảnh
  const legacyGoods = ['du', 'thieu'].includes(R.goods_status) || goodsPhotos.length > 0 || (R.goods || []).length > 0;
  const secGoods = sec('7. Nhập hàng từ kho tổng', ['nhap_hang'], html`${NH_CSS}
    <div id="hd-box" class="stack" style="gap:10px"><div class="st-meta">Đang tải hàng kho tổng…</div></div>
    <input type="hidden" id="goods-keep" value="${R.goods_status || ''}">
    ${legacyGoods ? html`<details class="pc-legacy"><summary>Ghi nhận nhập hàng kiểu cũ (trước 11/11/2026)</summary>
      <div class="stack" style="gap:8px;margin-top:8px"><div>Kết quả: <strong>${GOODS_LABEL[R.goods_status] || '—'}</strong></div>
        ${(R.goods || []).length ? html`<div class="pc-sub" style="margin:0">MẶT HÀNG THIẾU</div><div id="goods">${R.goods.map((g) => goodRow(g, false))}</div>` : ''}
        ${R.goods_note ? html`<div class="st-meta">Ghi chú: ${R.goods_note}</div>` : ''}
        ${goodsPhotos.length ? html`<div class="photos">${goodsPhotos.map((p) => phFig(p, 'Ảnh hàng nhận', false))}</div>` : ''}</div></details>` : ''}`);

  // Thanh phần việc (đầu mỗi phần) + nút Xong (cuối mỗi phần)
  const PART_NO = { tien: 1, nhan_su: 2, nhan_hang: 3 };
  const PART_SUB = { tien: 'mục 1–4', nhan_su: 'mục 5, 6', nhan_hang: 'mục 7' };
  const partBar = (k) => {
    if (!P) return '';
    const p = PT[k] || {}; let who; let btn = '';
    if (p.done_at) {
      who = html`<span class="pill ok">✓ ĐÃ XONG</span> ${p.done_name || ''} · ${dt(p.done_at)}${p.done_ql ? html` <span class="st-meta">· quản lý tự làm — tự đối soát khi phiếu hoàn thành</span>` : ''}`;
      btn = p.mine ? html`<button type="button" class="btn sm secondary pt-undo" data-part="${k}">Sửa lại</button>`
        : P.can_claim ? html`<button type="button" class="btn sm secondary pt-force" data-part="${k}" data-name="${p.claimed_name || ''}">Nhận lại phần này</button>` : '';
    } else if (p.mine) {
      who = html`<span class="pill warn">BẠN ĐANG LÀM</span>${p.prev_name ? html` <span class="st-meta">(nhận lại từ ${p.prev_name})</span>` : ''}`;
      btn = html`<button type="button" class="btn sm secondary pt-release" data-part="${k}">Bỏ nhận</button>`;
    } else if (p.claimed_by) {
      who = html`<span class="pill info">${p.claimed_name || 'Người khác'} đang làm</span> <span class="st-meta">nhận lúc ${dt(p.claimed_at)} · bạn chỉ xem được</span>`;
      btn = P.can_claim ? html`<button type="button" class="btn sm secondary pt-force" data-part="${k}" data-name="${p.claimed_name || ''}">Nhận lại phần này</button>` : '';
    } else {
      who = p.need ? html`<span class="pill off">CHƯA CÓ AI NHẬN</span>` : html`<span class="pill mute">Chỉ cần khi ca có nhận hàng kho tổng</span>`;
      btn = P.can_claim ? html`<button type="button" class="btn sm pt-claim" data-part="${k}">Tôi nhận phần này</button>`
        : html`<span class="st-meta">Chỉ nhân viên có tên trong ca và quản lý được nhận phần.</span>`;
    }
    return html`<section class="card pt-bar ${p.done_at ? 'ok' : p.mine ? 'mine' : ''}" data-part="${k}">
      <div class="pt-title">PHẦN ${PART_NO[k]} · ${p.label || k} <span class="st-meta">${PART_SUB[k]}</span></div>
      <div class="pt-row"><div class="pt-who">${who}</div><div class="toolbar" style="gap:6px">${btn}</div></div><div class="pt-err"></div></section>`;
  };
  const partDone = (k) => (P && PT[k]?.mine && !PT[k]?.done_at
    ? html`<section class="card pt-end" data-part="${k}"><button type="button" class="btn pt-done" data-part="${k}">XONG PHẦN ${PT[k].label}</button>
        <span class="st-meta">Web kiểm tra các mục của phần này. Đủ các phần Xong thì phiếu tự HOÀN THÀNH.</span><div class="pt-err"></div></section>` : '');
  const partPanel = P ? html`<section class="card stack pt-panel" style="gap:8px"><h2 style="margin:0;font-size:17px">Tiến độ phiếu</h2><div class="pt-prog"></div></section>`
    : ed && !isDs ? html`<div class="alert error">Không tải được các phần việc của phiếu. Tải lại trang.</div>` : '';

  const nChecks = Object.keys(R.checks || {}).length; const nItems = (R.check_items || []).length;
  const head = html`<div class="page-head pc-head"><div>
      <h1>${isDs ? 'Đối soát ca' : 'Chốt ca'} ${R.shift} · ${R.branch_code}</h1>
      <div class="sub">${dayName(R.work_date)} ${dmy(R.work_date)} · ${R.branch_name}</div>
      <div class="toolbar" style="gap:6px;margin-top:6px">
        <span class="pill ${STAFF_LABEL[R.status][1]}">Nhân viên: ${STAFF_LABEL[R.status][0]}</span>
        ${done ? html`<span class="pill ${R0.recon_status === 'hoan_thanh' ? 'ok' : R0.recon_status === 'mo_lai' ? 'warn' : 'off'}">${R0.recon_status === 'hoan_thanh' ? 'HOÀN THÀNH ĐỐI SOÁT' : R0.recon_status === 'mo_lai' ? `ĐANG ĐỐI SOÁT LẠI ${nChecks}/${nItems}` : `Đối soát ${nChecks}/${nItems}`}</span>` : ''}
      </div>
      ${canRc ? html`<nav class="seg pc-ban" aria-label="Chọn bản"><a href="#/ca/phieu?id=${R0.id}" class="${isDs ? '' : 'on'}">Phiếu nhân viên (gốc)</a><a href="#/quan-ly/doi-soat/ca?id=${R0.id}" class="${isDs ? 'on' : ''}">Đối soát ca này</a></nav>` : ''}</div>
    <div class="toolbar"><a class="btn sm secondary" href="#${isDs || (isManager() && done) ? '/quan-ly/doi-soat' : '/ca'}?ngay=${R.work_date}">${isDs ? '‹ Về trang Đối soát' : '‹ Danh sách ca'}</a>
      <div id="saved-indicator" class="saved" role="status" hidden></div></div></div>`;

  const logRow = (l) => html`<div class="rc-log"><span class="st-meta">${dt(l.at)} · ${l.by || ''}</span> <strong>${LOG_ACTION[l.action] || l.action}</strong>${['ket_qua', 'bo_ket_qua', 'mo_lai_muc', 'mo_khoa'].includes(l.action) ? html` ${CHECK_LABEL[l.field] || l.field}${l.after ? html`: <strong>${showVal(l.field, l.after)}</strong>` : ''}` : l.field ? html` ${FIELD_LABEL[l.field] || l.field}: ${showVal(l.field, l.before)} → <strong>${showVal(l.field, l.after)}</strong>` : ''}${l.reason ? html` <span class="st-meta">· Lý do: ${l.reason}</span>` : ''}</div>`;
  const dsFoot = isDs ? html`<section class="card stack" style="gap:10px">
      <h2 style="margin:0">Bản đối soát</h2>
      ${R0.recon_status === 'hoan_thanh' ? html`<div class="alert ok">HOÀN THÀNH ĐỐI SOÁT: ${R0.recon_by_name || ''} · ${dt(R0.recon_at)}. Số liệu trên đây là số chính thức của ca.</div>`
        : R0.recon_status === 'mo_lai' ? html`<div class="alert warn"><strong>ĐANG SỬA</strong>: ${(R.check_items || []).filter((it) => !(R.checks || {})[it]).map((it) => CHECK_LABEL[it]).join(', ')} — duyệt lại ${(R.check_items || []).filter((it) => !(R.checks || {})[it]).length > 1 ? 'các mục này' : 'mục này'} là phiếu tự hoàn thành đối soát.</div>`
        : html`<div class="st-meta">Sửa trực tiếp trên bản này (phiếu nhân viên giữ nguyên). Mục đã đối soát nhạt đi và khoá; muốn sửa bấm “Sửa” ở mục đó (Đèn đối soát). Đủ ${nItems} hạng mục thì phiếu tự HOÀN THÀNH ĐỐI SOÁT.</div>`}
      ${ed ? html`<label class="pc-f"><span>Lý do sửa (bắt buộc khi sửa số)</span><input class="input" id="rc-reason" placeholder="vd: nhân viên nhập nhầm số POS" autocomplete="off"></label>` : ''}
      <div class="toolbar" style="gap:8px">
        ${LK?.is_chu && (LK.done || []).length ? html`<button type="button" class="btn sm secondary" id="rc-reopen">Mở lại cả phiếu</button>` : ''}
        ${R0.can_reopen ? html`<button type="button" class="btn sm secondary danger" id="reopen">Mở lại phiếu cho nhân viên sửa</button>` : ''}</div>
      <details ${RC.log.length ? '' : 'hidden'}><summary style="cursor:pointer;font-weight:600">Lịch sử sửa (${RC.log.length})</summary><div class="stack" style="gap:4px;margin-top:6px">${RC.log.map(logRow)}</div></details>
    </section>` : '';

  const foot = isDs ? dsFoot : ed
    ? partPanel
    : html`<section class="card stack" style="gap:8px">
        ${done && R.recon_status === 'hoan_thanh' ? html`<div class="alert ok">Hoàn thành đối soát: ${R.recon_by_name} · ${dt(R.recon_at)}</div>` : ''}
        ${canRc ? html`<div class="pc-line"><span class="st-meta grow">Đây là phiếu nhân viên (bản gốc, chỉ xem). Đối soát và sửa số liệu ở trang Đối soát ca.</span><a class="btn sm" href="#/quan-ly/doi-soat/ca?id=${R0.id}">Đối soát ca này ›</a></div>` : ''}
        ${R.can_reopen ? html`<div><button type="button" class="btn sm secondary danger" id="reopen">Mở lại phiếu cho nhân viên sửa</button></div>` : ''}</section>`;

  // Trang Đối soát ca (bước 35): 4 bước — điện thoại xem từng bước, máy tính hiện cả 4 bước
  const dsLeft = (i) => (DS_ITEMS[i] || []).filter((it) => !(R.checks || {})[it] && !(R.results || {})[it] && !lkItem(it));
  const dsHd = (i) => html`<div class="ds-hd"><span>BƯỚC ${i + 1 - (!dsX2 && i > DS_X2 ? 1 : 0)} · ${DS_PART[i] ? DS_PART[i].toUpperCase() + ' · ' : ''}${DS_STEPS[i].toUpperCase()}</span>${i < DS_LAST
    ? (dsLeft(i).length ? html`<span class="pill off">Còn ${dsLeft(i).length}/${DS_ITEMS[i].length} hạng mục</span>` : html`<span class="pill ok">✓ Đã đối soát</span>`) : ''}</div>`;
  const PDT = PD ? Object.fromEntries((PD.parts || []).map((p) => [p.part, p])) : {};
  const whoPart = (k) => { const p = PDT[k]; if (!p || !p.done_at) return ''; return html`<div class="st-meta ds-who">Phần ${p.label}: ${p.done_name || p.claimed_name || ''}${p.done_ql ? html` · <strong>quản lý tự làm — đã tự đối soát</strong>` : ''}</div>`; };
  const dsSum = isDs ? html`<section class="card stack pc-sec"><div class="pc-sec-head"><h2>Tóm tắt đối soát</h2></div>
      ${DS_ITEMS.map((_, i) => (i === DS_X2 ? '' : html`<div class="pc-line ds-sum"><strong class="grow">Bước ${i + 1} · ${DS_STEPS[i]}</strong>${dsLeft(i).length
        ? html`<span class="st-meta">Còn: ${dsLeft(i).map((it) => CHECK_LABEL[it]).join(', ')}</span><button type="button" class="btn sm secondary" data-ds-go="${i}">Làm bước ${i + 1}</button>`
        : html`<span class="pill ok">✓ Xong</span>`}</div>`))}
      <div id="ds-cv-sum"></div>
      <div class="st-meta">Đủ ${nItems} hạng mục thì phiếu tự thành HOÀN THÀNH ĐỐI SOÁT.</div></section>` : '';
  const dsPhone = isDs;   // bước 86: đối soát đi từng bước (cả máy tính)
  const dsX2 = isDs && (R.staff || []).some((s2) => !s2.worked || (s2.source && s2.source !== 'lich'));   // bước 87: có người nghỉ / làm hộ / ca bổ sung
  const dsBody = isDs ? html`${DEN_CSS}<div id="ds-parts" class="dsp" data-left="${JSON.stringify(DS_ITEMS.map((_, i) => dsLeft(i).length))}" data-x2="${dsX2 ? 1 : 0}"></div><section class="card stack pc-sec" id="ds-lights" style="gap:10px"><div class="st-meta">Đang xét các hạng mục…</div></section>${dsPhone ? html`<nav class="wz-steps ds-steps" hidden aria-label="Các bước đối soát">${DS_STEPS.map((t, i) => html`<button type="button" class="wz-st ds-st" data-ds-go="${i}" ${i === DS_X2 && !dsX2 ? 'hidden' : ''}><b>${i + 1 - (!dsX2 && i > DS_X2 ? 1 : 0)}</b><span>${t}</span><i class="wz-dot" ${i < DS_LAST && dsLeft(i).length ? '' : 'hidden'}></i></button>`)}</nav>` : ''}
      ${!dsPhone ? html`<nav class="ds-ptabs" role="tablist" aria-label="Phần đối soát">${[['viec', '① Phần việc', dsLeft(0).length + dsLeft(1).length], ['tien', '② Phần tiền', dsLeft(2).length], ['xong', '③ Hoàn thành', -1]].map(([k, l, n]) => html`<button type="button" class="ds-pt" role="tab" data-ptab="${k}" data-left="${n}">${l}${n > 0 ? html`<span class="ds-ptn">còn ${n}</span>` : n === 0 ? html`<span class="ds-pto">✓</span>` : ''}</button>`)}</nav>` : ''}
      <div class="ds-pane stack" data-ds="0">${dsHd(0)}${whoPart('nhan_su')}${staffCmp}<details class="ca-more ds-edit"><summary>Sửa giờ / người làm <span class="st-meta">(bắt buộc ghi lý do)</span></summary><div class="stack" style="gap:10px;margin-top:8px">${rcWhy}${secStaff}</div></details></div>
      <div class="ds-pane stack" data-ds="1" ${dsX2 ? '' : 'data-skip="1"'}>${dsHd(1)}<section class="card stack pc-sec" style="gap:6px"><div class="st-meta">Ca có <b>người nghỉ, người làm thay hoặc ca bổ sung</b>. Quản lý cơ sở chỉ xem — <b>Quản lý tổng</b> phân loại, <b>Chủ</b> duyệt theo mức lương x2 đã chốt. Phần tiền vẫn đối soát được trong lúc chờ; ca chỉ hoàn thành khi Chủ đã duyệt.</div></section>${can('doi_soat') ? html`${CV_CSS}<section class="card stack pc-sec" id="ds-cv" style="gap:8px"></section>` : ''}</div>
      <div class="ds-pane stack" data-ds="2">${dsHd(2)}${secHand}${can('doi_soat') ? html`${DG_CSS}<section class="card stack pc-sec" id="ds-dg" style="gap:8px"></section>` : ''}${whoPart('nhan_hang')}${secGoods}</div>
      <div class="ds-pane stack" data-ds="3">${dsHd(3)}${whoPart('tien')}${fabiCmp}<details class="ca-more ds-edit"><summary>Sửa số liệu phiếu Fabi <span class="st-meta">(giờ, số tiền, ảnh)</span></summary><div class="stack" style="gap:10px;margin-top:8px">${rcWhy}${secTime}${secMoney}</div></details></div>
      <div class="ds-pane stack" data-ds="4">${dsHd(4)}${debtCmp}<details class="ca-more ds-edit"><summary>Chi tiết công nợ <span class="st-meta">(khách trả nợ cũ, ghi nhận nợ khi đối soát)</span></summary><div class="stack" style="gap:10px;margin-top:8px">${rcWhy}${secDebt}</div></details></div>
      <div class="ds-pane stack" data-ds="5">${dsHd(5)}${secTc}</div>
      <div class="ds-pane stack" data-ds="6">${dsHd(6)}${secThuc}<details class="ca-more ds-edit"><summary>Chi tiết / sửa <span class="st-meta">(phiếu chi chuyển khoản, số dư ngân hàng, khoản thu chi)</span></summary><div class="stack" style="gap:10px;margin-top:8px">${rcWhy}${caBoxSec}${secDiff}</div></details></div>
      <div class="ds-pane stack" data-ds="7">${dsHd(7)}${secLech}${dsSum}${dsFoot}</div>
      ${dsPhone ? html`<section class="card wz-foot"><button type="button" class="btn secondary" id="ds-prev">‹ Quay lại</button><span class="st-meta" id="ds-pos"></span><button type="button" class="btn" id="ds-next">Duyệt & tiếp ›</button></section>` : ''}` : '';

  // Phiếu từng bước (điện thoại / nhân viên): 5 bước, bước cuối kiểm tra những chỗ còn thiếu rồi HOÀN THÀNH
  const wizard = !isDs && ed && (!isManager() || window.matchMedia('(max-width: 760px)').matches);
  const body = isDs ? dsBody : wizard
    ? html`<nav class="wz-steps" aria-label="Các bước">${WZ_STEPS.map((t, i) => html`<button type="button" class="wz-st" data-go="${i}"><b>${i + 1}</b><span>${t}</span><i class="wz-dot" hidden></i></button>`)}</nav>
      <div class="wz-pane" data-step="0">${partBar('tien')}${secTime}${secMoney}</div>
      <div class="wz-pane" data-step="1" hidden>${partBar('tien')}${secDiff}${secDebt}${partDone('tien')}</div>
      <div class="wz-pane" data-step="2" hidden>${partBar('nhan_su')}${secStaff}${secHand}${partDone('nhan_su')}</div>
      <div class="wz-pane" data-step="3" hidden>${partBar('nhan_hang')}${secGoods}${partDone('nhan_hang')}</div>
      <div class="wz-pane" data-step="4" hidden>${partPanel}</div>
      <section class="card wz-foot"><button type="button" class="btn secondary" id="wz-prev">‹ Quay lại</button><span class="st-meta" id="wz-pos"></span>
        <button type="button" class="btn" id="wz-next">Tiếp ›</button></section>`
    : html`<div class="pc-part-h">① Phần việc</div>${partBar('nhan_su')}${secStaff}${secHand}${partDone('nhan_su')}${partBar('nhan_hang')}${secGoods}${partDone('nhan_hang')}
      <div class="pc-part-h">② Phần tiền</div>${partBar('tien')}${secTime}${secMoney}${secDiff}${secDebt}${partDone('tien')}${foot}`;   // bước 78
  // bước 70: nhắc khách đang nợ ở đầu phiếu chốt ca (nhân viên nhớ thu)
  const odOpen = (R.open_debts || []).filter((d) => !d.closed_at && !d.family);   // bước 75 / 85: không nhắc công nợ gia đình
  const nhacNo = !isDs && ed && odOpen.length ? html`<div class="alert warn pc-nhac"><strong>Khách đang nợ ${R.branch_code}: ${odOpen.length} khoản · ${vnd(odOpen.reduce((t, d) => t + Number(d.amount || 0), 0))}</strong>
      <div class="st-meta">${odOpen.slice(0, 4).map((d) => `${noName(d)} ${fmt(d.amount)}`).join(' · ')}${odOpen.length > 4 ? ' · …' : ''} — khách trả thì bấm "Khách đã trả" ở mục 4 (${wizard ? 'bước Tiền: thu chi' : 'Khách chưa thanh toán'}).</div></div>` : '';
  return {
    title: `Chốt ca ${R.shift} ${R.branch_code}`,
    html: html`${STYLE}${HD_CSS}${DT_CSS}<div class="${isDs ? 'ph-wrap' : ''}">${head}${nhacNo}<form id="pc-form" class="stack pc ${wizard ? 'wz' : ''} ${isDs ? 'ds' : ''}" onsubmit="return false">${body}</form></div>`,
    mount() { return mount(R, ed, C, { isDs, RC, R0, wizard, P, PT, edH, dsPhone, dsStep: Number(params.buoc) || 0, LK, KT, DIR }); },
  };
}

const WZ_STEPS = ['Tiền: số liệu', 'Tiền: thu chi', 'Nhân sự & bàn giao', 'Nhận hàng', 'Tiến độ'];
const STEP_PART = ['tien', 'tien', 'nhan_su'];
// 11/11/2026: nhân sự trước (biết đủ người để chia tiền âm). Bước 78 (13/11): ① Phần việc (nhân sự & bàn giao, nhận hàng) → ② Phần tiền
// Bước 86 (anh Tiến 14/11): đối soát đi từng bước như phiếu chốt ca — mỗi bước "Duyệt & tiếp"; bước cuối xử lý lệch & hoàn thành
// bước 87: bước "Nghỉ & ca bổ sung (x2)" (QL tổng phân loại, Chủ duyệt) chỉ hiện khi ca có người nghỉ / làm hộ
const DS_STEPS = ['Ai làm ca', 'Nghỉ & ca bổ sung (x2)', 'Bàn giao & nhận hàng', 'Phiếu Fabi', 'Khách nợ', 'Thu chi', 'Tiền thực nhận', 'Xử lý lệch & hoàn thành'];
const DS_ITEMS = [['nhan_su'], [], ['ban_giao', 'nhap_hang'], ['thoi_gian', 'doanh_thu'], ['cong_no'], ['thu_chi'], ['tien_mat', 'chuyen_khoan']];
const DS_PART = ['① Phần việc', '① Phần việc', '① Phần việc', '② Phần tiền', '② Phần tiền', '② Phần tiền', '② Phần tiền', '② Phần tiền'];
const DS_X2 = 1;
const DS_LAST = DS_STEPS.length - 1;
// Những chỗ còn thiếu / sai trước khi hoàn thành (giống kiểm tra trên máy chủ) — [bước, nội dung]
function missingList(v, c, R) {
  const out = []; const m = (step, t) => out.push([step, t]);
  const empty = (x) => x === null || x === undefined || x === '';
  const H = R.cash_hand;
  if (R.shift !== R.first_shift && empty(v.opening_cash)) m(0, 'Đếm nhận két đầu ca');
  if (H && H.state === 'can_dem_lai') m(0, 'Nhận két lệch: cùng người ca trước đếm lại');
  if (empty(v.ipos_opening)) m(0, 'Số dư đầu trên phiếu iPOS');
  if ($('#rev_start') && !v.rev_start) m(0, 'Giờ bắt đầu doanh thu');
  if (!v.rev_end) m(0, 'Giờ kết thúc doanh thu');
  [['total_revenue', 'Mục 1 Tổng doanh thu'], ['pos_cash', 'Mục 2 Tiền mặt POS'], ['pos_transfer', 'Mục 3 Chuyển khoản POS'], ['reported_transfer', 'Mục 4 Chuyển khoản thực tế'],
    ['cash_counted', 'Mục 5 Tiền trong két'], ['cups', 'Số cốc bán']].forEach(([k, t]) => { if (empty(v[k])) m(0, t); });
  if (c.sumGap !== null && c.sumGap !== 0) m(0, `Mục 1 lệch ${signed(c.sumGap)} so với Mục 2 + Mục 3 + Nợ phát sinh`);
  const ipDiff = !empty(v.ipos_opening) && !empty(v.opening_cash) && Number(v.ipos_opening) !== Number(v.opening_cash);
  if (((H && H.state === 'lech') || ipDiff) && !(v.opening_note || '').trim()) m(0, 'Ghi lý do lệch tiền đầu ca');
  if (!(R.photos || []).some((p) => p.kind === 'ipos')) m(0, 'Ảnh phiếu chốt ca iPOS');
  if (v.moves.some((x) => !x.amount || !x.note)) m(1, 'Dòng thu chi thiếu số tiền hoặc nội dung');
  if (v.moves.some((x) => !x.auto && /(âm|thiếu|thieu|hụt|hut)\s*(tiền|tien|két|ket)/i.test(x.note || ''))) m(1, 'Không ghi "âm / thiếu tiền" vào thu chi — két thiếu thì đếm đúng số thực tế, web tự tính chênh lệch');   // bước 73
  if (v.debts.some((d) => (d.table_name || '').trim() && !(Number(d.amount) > 0))) m(1, 'Bàn còn nợ thiếu số tiền');
  v.staff.forEach((x) => {
    const row = $(`.st-row[data-emp="${x.employee_id}"] strong`); const nm = row ? row.textContent : 'nhân viên';
    if (x.worked && (!x.time_in || !x.time_out)) m(2, `Giờ đến / về của ${nm}`);
    if (!x.worked && !x.absent_reason) m(2, `Lý do nghỉ của ${nm}`);
  });
  return out;
}

// ---------------------------------------------------------------- tương tác
function collect() {
  const v = (sel) => ($(sel)?.value ?? '');
  return {
    rev_start: fromLocalInput(v('#rev_start')), rev_end: fromLocalInput(v('#rev_end')),
    total_revenue: parseMoney(v('#total_revenue')), pos_cash: parseMoney(v('#pos_cash')), pos_transfer: parseMoney(v('#pos_transfer')),
    reported_transfer: parseMoney(v('#reported_transfer')), cash_counted: parseMoney(v('#cash_counted')), opening_cash: parseMoney(v('#opening_cash')),
    ipos_opening: parseMoney(v('#ipos_opening')),
    cups: v('#cups').replace(/\D/g, '') === '' ? null : Number(v('#cups').replace(/\D/g, '')),
    opening_note: v('#opening_note').trim() || null,
    goods_status: $('input[name=goods]:checked')?.value || $('#goods-keep')?.value || null,
    goods_note: v('#goods_note').trim() || null,
    moves: $$('.mv-row').map((r) => ({ kind: r.querySelector('.mv-kind').value, amount: (parseMoney(r.querySelector('.mv-amt').value) || 0) * (r.querySelector('.mv-sign').value === '-' ? -1 : 1), note: r.querySelector('.mv-note').value.trim() })),
    staff: $$('.st-row').map((r) => ({ employee_id: Number(r.dataset.emp), source: r.dataset.src, role: r.dataset.role || null, worked: r.querySelector('.st-worked').value === '1',
      time_in: r.querySelector('.st-in').value || null, time_out: r.querySelector('.st-out').value || null, absent_reason: r.querySelector('.st-reason').value.trim() || null, note: r.querySelector('.st-note').value.trim() || null,
      cash_paid: r.querySelector('.st-cash') ? (parseMoney(r.querySelector('.st-cash').value) || null) : null })),
    handover: $$('.ho-row').map((r) => ({ id: r.dataset.id ? Number(r.dataset.id) : null, content: r.querySelector('.ho-text').value })),
    goods: $$('.gd-row').map((r) => ({ item: r.querySelector('.gd-item').value.trim(), qty: r.querySelector('.gd-qty').value.trim() })),
    debts: $$('.db-row').filter((r) => !r.querySelector('.db-table').disabled || r.dataset.id).map((r) => ({ id: r.dataset.id ? Number(r.dataset.id) : null, table_name: r.querySelector('.db-table').value, amount: parseMoney(r.querySelector('.db-amt').value), note: r.querySelector('.db-note').value.trim() })),
  };
}

function mount(R, ed, C0, ctx = {}) {
  const { isDs, RC, R0, wizard, P, PT = {}, edH, dsPhone, dsStep, LK, KT, DIR } = ctx;
  let saveNow = null;
  const rcWhyVal = () => [...$$('.rc-why'), $('#rc-reason')].map((x) => (x?.value || '').trim()).find(Boolean) || '';
  // bước 51: trường thuộc mục web đã tự đối soát → không sửa được (máy chủ cũng giữ nguyên số cũ)
  // bước 67: Chủ sửa thẳng → chỉ mở trường của mục đang sửa, khoá mọi trường khác
  const dirF = DIR ? DIR.items.flatMap((i) => ITEM_FIELDS[i] || []) : null;
  const LKF = dirF ? ALL_FIELDS.filter((f) => !dirF.includes(f)) : (LK?.fields || []);
  if (isDs && LKF.length) {
    const lock = (el) => { if (!el) return; el.disabled = true; el.closest('.pc-f')?.classList.add('pc-lk'); };
    LKF.forEach((f) => {
      if (f === 'moves') { $$('#moves input, #moves select, #moves button').forEach(lock); $('#add-move')?.remove(); }
      else if (f === 'staff') { $$('#staff input, #staff select, #staff button').forEach(lock); $('#helper')?.closest('.pc-line')?.remove(); }
      else if (f === 'goods') { $$('#goods input, #goods button').forEach(lock); $('#add-good')?.remove(); }
      else lock($('#' + f));
    });
  }
  // khung Nghỉ & làm thay: trước khi lưu phân loại thì lưu danh sách nhân viên đang sửa; danh sách đổi thì vẽ lại khung
  const cvCtx = { sum: $('#ds-cv-sum'), onChange: () => rerender(), flush: () => (saveNow ? saveNow() : null) };
  if (isDs) { mountLights($('#ds-lights'), R0, R); mountReportEval($('#ds-dg'), R); mountCover($('#ds-cv'), R, cvCtx); }
  const form = $('#pc-form');
  bindMoneyInputs(form);
  // Bản đối soát: ghi "Phiếu NV: …" ở ô khác phiếu nhân viên
  if (isDs) {
    ['rev_start', 'rev_end', 'total_revenue', 'pos_cash', 'pos_transfer', 'reported_transfer', 'cash_counted', 'opening_cash', 'cups', 'goods_note'].forEach((k) => {
      const a = RC.original[k]; const b = RC.data[k];
      if ((a ?? null) === (b ?? null)) return;
      const el = $('#' + k); const box = el?.closest('.pc-f'); if (!box) return;
      box.insertAdjacentHTML('beforeend', str(html`<span class="pc-orig">Phiếu NV: ${showVal(k, a)}</span>`));
    });
    [['moves', '#moves'], ['staff', '#staff'], ['goods', '#goods'], ['goods_status', '#goods']].forEach(([k, sel]) => {
      if (JSON.stringify(RC.original[k] ?? null) === JSON.stringify(RC.data[k] ?? null)) return;
      const h = $(sel)?.closest('.pc-sec')?.querySelector('.pc-sec-head h2');
      if (h && !h.querySelector('.pc-orig-b')) h.insertAdjacentHTML('beforeend', ' <span class="pill warn pc-orig-b" style="font-size:11px">Đã sửa so với phiếu NV</span>');
    });
  }
  // giờ gợi ý: sửa rồi thì bỏ tô vàng
  $$('input.st-sg').forEach((el) => el.addEventListener('input', () => el.classList.remove('st-sg')));

  // Tab nhập hàng
  $$('[data-tab]').forEach((a) => a.addEventListener('click', () => {
    $$('[data-tab]').forEach((x) => x.classList.toggle('on', x === a));
    $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== a.dataset.tab; });
  }));
  if (R.goods_status === 'thieu' && !(R.photos || []).length) $('[data-tab="report"]')?.click();

  // Ảnh: link tạm có hạn 1 giờ
  const figs = $$('.ph');
  if (figs.length) {
    sb.storage.from(BUCKET).createSignedUrls(figs.map((f) => f.dataset.path), 3600).then(({ data }) => {
      (data || []).forEach((d, i) => { if (d.signedUrl) { figs[i].querySelector('img').src = d.signedUrl; figs[i].querySelector('a').href = d.signedUrl; } });
    }).catch(() => {});
  }

  // Tiến độ các phần việc (bước cuối / cuối trang)
  const progHtml = (miss, c) => html`${(P.parts || []).filter((p) => p.need || p.claimed_by).map((p) => {
    const mm = miss.filter(([st]) => STEP_PART[st] === p.part);
    const st = p.done_at ? html`<span class="pill ok">✓ Xong</span> <span class="st-meta">${p.done_name || ''}</span>`
      : p.claimed_by ? html`<span class="pill warn">Đang làm</span> <span class="st-meta">${p.mine ? 'bạn' : p.claimed_name || ''}</span>` : html`<span class="pill off">Chưa ai nhận</span>`;
    return html`<div class="pt-item"><div class="pc-line"><strong class="grow">${p.label}</strong>${st}</div>
      ${p.mine && !p.done_at ? html`${mm.length ? html`<div class="st-meta">Còn ${mm.length} chỗ cần bổ sung:</div>${mm.map(([s2, t]) => html`<div class="pc-line wz-miss"><span class="grow">${t}</span>${wizard ? html`<button type="button" class="btn sm secondary" data-go="${s2}">Sửa ở bước ${s2 + 1}</button>` : ''}</div>`)}` : ''}
        <div class="pc-line"><button type="button" class="btn sm pt-done" data-part="${p.part}">Xong phần ${p.label}</button></div><div class="pt-err"></div>` : ''}
      ${!p.claimed_by && P.can_claim ? html`<div><button type="button" class="btn sm secondary pt-claim" data-part="${p.part}">Tôi nhận phần này</button></div><div class="pt-err"></div>` : ''}</div>`;
  })}
    <div class="kv" style="margin-top:4px"><div>Tiền mặt chưa giải trình</div><div>${result(c.tmLeft)}</div><div>Chuyển khoản chưa giải trình</div><div>${result(c.ckLeft)}</div></div>
    ${P.remind_at ? html`<div class="st-meta">Phần nào chưa Xong, web nhắc lúc ${P.remind_at.slice(11)} (30 phút trước khi hết ca), sau đó mỗi giờ.</div>` : ''}
    <div class="st-meta">Đủ các phần Xong thì phiếu tự HOÀN THÀNH — không cần bấm thêm nút nào.</div>`;
  // bước 57: 3 dòng so khớp của khung "Tiền của ca"; bước 60: số do máy chủ tính (srvFresh) — đang sửa chưa lưu thì tạm tính trên trình duyệt
  let srvFresh = true;
  const caRows = (c, v) => {
    const M = (R0 || R).money || {}; const hg = Number(M.handover_gap || 0);
    const res = R.results || {}; const chk = R.checks || {};
    const wait = !!(KT && KT.need && !KT.ready);
    const can = !!R.can_recon && (R0 || R).recon_status !== 'hoan_thanh';
    const n = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
    const row = (item, title, sub2, left, acts) => {
      const done = !!chk[item] || !!res[item]; const x = res[item];
      const badge = done ? html`<span class="pill ok">✓ ${x ? `${RES[x.result][0]}${x.amount ? ' ' + fmt(x.amount) : ''}` : 'đã đối soát'}</span>`
        : wait ? html`<span class="pill mute">⏳ chờ kế toán</span>`
        : left === 'tc' ? html`<span class="pill warn">chờ chọn nhóm</span>` : left === null ? html`<span class="pill mute">chưa đủ số</span>` : left === 0 ? html`<span class="pill ok">✓ khớp</span>` : html`<span class="pill off">🔴 ${signed(left)}</span>`;
      const show = !done && can && left !== 0 && left !== null && left !== 'tc';
      return html`<div class="ca-row ${done ? 'done' : !wait && left && left !== 'tc' ? 'bad' : ''}"><div class="ca-l"><strong>${title}</strong><span class="st-meta">${sub2}</span></div><div class="ca-r">${badge}</div>
        ${show && acts.length ? html`<div class="ca-act">${acts}</div>` : ''}</div>`;
    };
    const btn = (k, label, item, main) => html`<button type="button" class="btn sm ${main ? '' : 'secondary'}" data-ca="${k}" ${item ? html`data-item="${item}"` : ''}>${label}</button>`;
    const pc = n(v.pos_cash); const pt = n(v.pos_transfer); const cc = n(v.cash_counted); const tot = n(v.total_revenue);
    const SV = srvFresh && M.tm_left !== undefined && M.tm_left !== null;
    const tmLeft = SV ? Number(M.tm_left) : c.tmLeft === null ? null : c.tmLeft + hg;
    const bankOk = !!M.bank_ok; const got = n(M.bank_received);
    const ckLeft = SV && M.ck_left !== null && M.ck_left !== undefined ? Number(M.ck_left) : bankOk && pt !== null ? got - pt - c.ckMoves - c.colCK : c.ckLeft;
    if (SV && M.sum_gap !== null && M.sum_gap !== undefined) c = { ...c, sumGap: Number(M.sum_gap) };
    const mv = (v.moves || []).filter((m) => !m.auto); const mvSum = mv.reduce((t, m) => t + (Number(m.amount) || 0), 0);
    const paid = (R.open_debts || []).filter((d) => (!d.kind || d.kind === 'bill') && d.closed_report_id === R.id);
    return html`
      ${row('doanh_thu', 'Doanh thu', `${fmt(tot)} = TM ${fmt(pc)} + CK ${fmt(pt)}${c.debtNew ? ` + nợ ${fmt(c.debtNew)}` : ''}${v.cups != null ? ` · ${v.cups} cốc` : ''}`, c.sumGap, [btn('more', 'Xem / sửa số liệu', null, true)])}
      ${row('tien_mat', 'Tiền mặt', `phải có ${tmLeft === null || cc === null ? '—' : fmt(cc - tmLeft)} · két đếm ${cc === null ? '—' : fmt(cc)}`, tmLeft,
        [btn('mv', 'Thêm thu chi'), btn('res', 'Chọn KHỚP / THIẾU / THỪA', 'tien_mat', true)])}
      ${row('chuyen_khoan', 'Chuyển khoản', `phải nhận ${pt === null ? '—' : fmt(pt + c.ckMoves + c.colCK)} · ${bankOk ? `ngân hàng nhận ${fmt(got)}` : `nhân viên báo ${fmt(v.reported_transfer)} (tạm — kế toán chưa nhập ngân hàng)`}`, ckLeft,
        [...(ckLeft < 0 ? [btn('pc', 'Tạo phiếu chi', null, true)] : []), btn('res', 'Chọn KHỚP / THIẾU / THỪA', 'chuyen_khoan', ckLeft >= 0)])}
      ${row('thu_chi', 'Thu chi', mv.length ? `${mv.length} khoản · ${signed(mvSum)} — chọn nhóm ở danh sách dưới` : 'không có khoản nào', mv.length ? 'tc' : 0, [])}
      ${paid.length ? html`<div class="st-meta ca-paid">Khách trả nợ trong ca: ${paid.map((d) => `bàn ${d.table_name} ${fmt(d.amount)} (${d.collect_kind === 'chuyen_khoan' ? 'CK' : 'TM'})`).join(', ')} — đã tính vào tiền mặt / chuyển khoản ở trên.</div>` : ''}`;
  };
  const recalc = () => {
    const v = ed ? collect() : R;
    const c = calc(v, debtSums(R, ed ? v.debts : null));
    const sc = $('#sum-check');
    if (sc) {
      sc.innerHTML = str(c.sumGap === null ? html`<span class="pill mute">Nhập đủ Mục 1, 2, 3</span>`
        : c.sumGap === 0 ? html`<span class="pill ok">Khớp</span>${c.debtNew ? html` <span class="st-meta">gồm nợ phát sinh ${vnd(c.debtNew)}</span>` : ''}`
        : html`<span class="pill off">Lệch ${signed(c.sumGap)} — phải sửa trước khi hoàn thành</span>${c.debtNew ? html` <span class="st-meta">(đã tính nợ phát sinh ${vnd(c.debtNew)})</span>` : ''}`);
    }
    {
      const nn = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
      const op = nn(v.opening_cash); const ip = nn(v.ipos_opening);
      const ipDiff = ip !== null && op !== null && ip !== op;
      const ic = $('#ipos-check');
      if (ic) ic.innerHTML = str(ip === null || op === null ? '' : ipDiff ? html`<span class="pill off">Khác tiền nhận két ${signed(ip - op)} — ghi lý do bên dưới</span>` : html`<span class="pill ok">Khớp tiền nhận két</span>`);
      const H = R.cash_hand;
      const nb = $('#open-note-box');
      if (nb) nb.hidden = !((H && H.state === 'lech') || ipDiff) && !(v.opening_note || R.opening_note);
    }
    const M = isDs ? (R0 || R).money || null : null;
    const hg = M ? Number(M.handover_gap || 0) : 0;
    const box = (label, init, moves, col, left, formula, hand = 0, sal = 0, loan = 0) => html`<div class="diff-card"><div class="pc-sub" style="margin:0">${label}</div>
      <div class="kv"><div>Chênh lệch ban đầu</div><div>${init === null ? '—' : signed(init)} <span class="st-meta">${formula}</span></div>
        <div>Đã kê khai thu chi</div><div>${signed(moves)}${sal ? html`<div class="st-meta">gồm chi lương tiền mặt ${signed(-sal)} (mục Nhân viên)</div>` : ''}${loan ? html`<div class="st-meta">gồm Nợ TM ${signed(-loan)}</div>` : ''}</div>
        ${col ? html`<div>Khách trả nợ ca trước</div><div>${signed(col)}</div>` : ''}
        ${hand ? html`<div>Ca sau nhận két lệch</div><div>${signed(hand)}</div>` : ''}
        <div><strong>Chưa giải trình</strong></div><div><strong>${left === null ? '—' : signed(left)}</strong></div>
        <div>Kết quả</div><div>${result(left)}</div></div></div>`;
    const db = $('#diff-box');
    if (db) db.innerHTML = str(html`${box('TIỀN MẶT', c.tmDiff, c.tmMoves - (c.loanOut || 0), c.colTM, c.tmLeft === null ? null : c.tmLeft + hg, '(Mục 5 − đầu ca − Mục 2)', hg, c.sal, c.loanOut || 0)}${box('CHUYỂN KHOẢN', c.ckDiff, c.ckMoves, c.colCK, c.ckLeft, '(Mục 4 − Mục 3)')}`);
    const cab = $('#ca-box'); if (cab) cab.innerHTML = str(caRows(c, v));
    const sc2 = $('#staff-count');
    if (sc2) sc2.textContent = new Set($$('.st-row').filter((r) => r.querySelector('.st-worked').value === '1').map((r) => r.dataset.emp)).size;
    $('#goods-missing') && ($('#goods-missing').hidden = (ed ? collect().goods_status : R.goods_status) !== 'thieu');
    if (P) {
      const miss = missingList(v, c, R);
      const open = (k) => PT[k]?.mine && !PT[k]?.done_at;
      if (wizard) $$('.wz-st').forEach((b) => { const st = Number(b.dataset.go); b.querySelector('.wz-dot').hidden = st === 4 || !miss.some(([s2]) => s2 === st && open(STEP_PART[s2])); });
      const prog = $('.pt-prog'); if (prog) prog.innerHTML = str(progHtml(miss, c));
    }
  };
  recalc();
  $('#ca-box')?.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-ca]'); if (!b) return;
    const k = b.dataset.ca;
    if (k === 'res') { openResult(b.dataset.item); return; }
    if (k === 'more' || k === 'mv') {
      const d = $('#diff-box')?.closest('.pc-sec') || $('#ca-more'); if (d && d.tagName === 'DETAILS') d.open = true;   // bước 86: mục sửa số liệu đã hiện sẵn ở bước Tiền thực nhận
      if (k === 'mv' && $('#add-move')) { $('#add-move').click(); $('#moves')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else d?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (k === 'pc') {
      try { const D = await rpc('app_ca_bank_outs', { p_id: R.id }); if (!D.can) { showSaved('Chỉ Chủ, Quản lý tổng, Kế toán tạo phiếu chi.', true); return; } openBankOut(R.id, D, () => rerender()); }
      catch (e) { showSaved(e.message, true); }
    }
  });
  // ---------- phiếu từng bước
  if (wizard) {
    let step = 0;
    const show = (i) => {
      step = Math.max(0, Math.min(4, i));
      $$('.wz-pane').forEach((p) => { p.hidden = Number(p.dataset.step) !== step; });
      $$('.wz-st').forEach((b) => { const k = Number(b.dataset.go); b.classList.toggle('on', k === step); b.classList.toggle('past', k < step); });
      $('#wz-prev').disabled = step === 0;
      $('#wz-next').hidden = step === 4;
      $('#wz-pos').textContent = `Bước ${step + 1}/5`;
      recalc(); window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    form.addEventListener('click', (ev) => { const g = ev.target.closest('[data-go]'); if (g) show(Number(g.dataset.go)); });
    $('#wz-prev').addEventListener('click', () => show(step - 1));
    $('#wz-next').addEventListener('click', () => show(step + 1));
    show(0);
  }

  // ---------- Nhập hàng kho tổng (bước 31)
  mountDeliveries($('#hd-box'), R0 || R, {
    canRecv: !isDs && !!(R0 || R).can_edit && (P ? !!edH : true),
    canPhoto: can('chot_ca') || can('doi_soat'),
    canRecon: !!isDs && !!R.can_recon && (R0 || R).recon_status !== 'hoan_thanh' && (R0 || R).status === 'hoan_thanh',
    onRecon: () => rerender(),
  });
  // ---------- Trang Đối soát ca: các bước + phân nhóm thu chi của ca
  if (isDs) {
    const key = 'ds_step:' + R.id;
    const go = (i) => {
      let st = Math.max(0, Math.min(DS_LAST, i));
      if (st === DS_X2 && $('.ds-pane[data-skip]')) st = goDir < 0 ? 0 : DS_X2 + 1;   // bước 87: không có người nghỉ / làm hộ → bỏ qua bước x2
      try { sessionStorage.setItem(key, String(st)); } catch (_) { /* bỏ qua */ }
      if (!dsPhone) { showPart(PART(st)); $(`.ds-pane[data-ds="${st}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      $$('.ds-pane').forEach((p) => { p.hidden = Number(p.dataset.ds) !== st; });
      $$('.ds-st').forEach((b) => { const k = Number(b.dataset.dsGo); b.classList.toggle('on', k === st); b.classList.toggle('past', k < st); });
      $('#ds-prev').disabled = st === 0; $('#ds-next').hidden = st === DS_LAST; const sk = $('.ds-pane[data-skip]') ? 1 : 0; $('#ds-pos').textContent = `Bước ${st + 1 - (sk && st > DS_X2 ? 1 : 0)}/${DS_LAST + 1 - sk}`;
      $('#ds-next').textContent = canApprove ? 'Duyệt & tiếp ›' : 'Tiếp ›';
      paintParts(st);
      { const lg = $('#ds-lights'); if (lg) lg.hidden = !(st === 0 || st === DS_LAST); }   // bước 91: đèn tổng chỉ hiện ở bước đầu và bước cuối — các bước giữa gọn như phiếu chốt ca
      window.scrollTo({ top: 0 });
    };
    // bước 79: máy tính — tab ① Phần việc / ② Phần tiền / ③ Hoàn thành, mỗi lần 1 phần
    function PART(st) { return st <= 1 ? 'viec' : st < DS_LAST ? 'tien' : 'xong'; }
    // bước 91: thanh ① Phần việc / ② Phần tiền giống phiếu chốt ca
    function paintParts(st) {
      const box = $('#ds-parts'); if (!box) return;
      const left = JSON.parse(box.dataset.left || '[]'); const x2 = box.dataset.x2 === '1';
      const viec = [0, 1, 2].filter((i) => i !== DS_X2 || x2); const tien = [3, 4, 5, 6, 7];
      const card = (no, lbl, list) => { const cur = list.includes(st); const done = list.every((i) => i === DS_LAST || !left[i]);
        const pos = cur ? `bước ${list.indexOf(st) + 1}/${list.length}` : done ? '✓ Đã duyệt' : `còn ${list.filter((i) => i !== DS_LAST && left[i]).length} bước`;
        return `<button type="button" class="dsp-c ${cur ? 'cur' : ''} ${done && !cur ? 'done' : ''}" data-ds-go="${cur ? st : (list.find((i) => i !== DS_LAST && left[i]) ?? list[0])}"><span class="dsp-n">${no} ${lbl}</span><span class="dsp-s">${pos}</span><span class="dsp-b">${list.map((i) => `<i class="${i === st ? 'cur' : (i !== DS_LAST && !left[i]) ? 'done' : ''}"></i>`).join('')}</span></button>`; };
      box.innerHTML = card('①', 'Phần việc', viec) + card('②', 'Phần tiền', tien);
    }
    const canApprove = !!R.can_recon && (R0 || R).recon_status !== 'hoan_thanh';
    // bước 86: "Duyệt & tiếp" — duyệt các hạng mục của bước (tiền mặt / chuyển khoản chỉ tự duyệt khi khớp; lệch xử lý ở bước cuối)
    async function approveStep(i) {
      if (!canApprove) return 0;
      const M = (R0 || R).money || {}; let n = 0;
      if (saveNow) await saveNow().catch(() => {});
      for (const it of DS_ITEMS[i] || []) {
        if ((R.checks || {})[it] || (R.results || {})[it] || (LK && (LK.items || []).includes(it))) continue;
        if (it === 'tien_mat' || it === 'chuyen_khoan') { const g = it === 'tien_mat' ? M.tm_left : M.ck_left; if (g === null || g === undefined || Number(g) !== 0) continue; }
        if (MONEY_ITEMS.includes(it)) await rpc('app_ca_result_set', { p_id: R.id, p_item: it, p_result: 'khop', p_amount: null, p_reason: '', p_people: null });
        else await rpc('app_ca_check', { p_id: R.id, p_item: it, p_on: true });
        n++;
      }
      return n;
    }
    function showPart(pt) {
      if (dsPhone) return;
      $$('.ds-pane').forEach((p) => { p.hidden = PART(Number(p.dataset.ds)) !== pt; });
      $$('.ds-pt').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ptab === pt)));
      try { sessionStorage.setItem('ds_part:' + R.id, pt); } catch (_) { /* bỏ qua */ }
    }
    let goDir = 1;
    let cur = 0; try { cur = Number(sessionStorage.getItem(key)) || 0; } catch (_) { /* bỏ qua */ }
    if (dsStep) cur = dsStep - 1;
    if (!dsPhone) {
      let pt0 = null; try { pt0 = sessionStorage.getItem('ds_part:' + R.id); } catch (_) { /* bỏ qua */ }
      if (dsStep) pt0 = PART(cur);
      if (!pt0) { const t = $$('.ds-pt').find((b) => Number(b.dataset.left) > 0); pt0 = t ? t.dataset.ptab : 'xong'; }
      showPart(pt0);
      $$('.ds-pt').forEach((b) => b.addEventListener('click', () => { showPart(b.dataset.ptab); window.scrollTo({ top: Math.max(0, ($('.ds-ptabs')?.getBoundingClientRect().top || 0) + window.scrollY - 70), behavior: 'smooth' }); }));
    }
    form.addEventListener('click', (ev) => { const g = ev.target.closest('[data-ds-go]'); if (g) { cur = Number(g.dataset.dsGo); go(cur); } });
    if (dsPhone) {
      $('#ds-prev').addEventListener('click', () => { goDir = -1; cur = Math.max(0, cur - 1); if (cur === DS_X2 && $('.ds-pane[data-skip]')) cur = 0; go(cur); goDir = 1; });
      $('#ds-next').addEventListener('click', async () => {
        const b = $('#ds-next'); b.disabled = true;
        let n = 0; try { n = await approveStep(cur); } catch (e) { showSaved(e.message, true); b.disabled = false; return; }
        b.disabled = false; cur = Math.min(DS_LAST, cur + 1); if (cur === DS_X2 && $('.ds-pane[data-skip]')) cur = DS_X2 + 1;
        if (n) { try { sessionStorage.setItem(key, String(cur)); } catch (_) { /* bỏ qua */ } flash(`Đã duyệt bước ${cur}.`); rerender(); return; }
        go(cur);
      });
      // bước 86: xử lý lệch — Quán chịu / Chia đều người làm ca / Đối soát lại sau
      $$('.lx-box').forEach((box) => {
        const item = box.dataset.item; const gap = Number(box.dataset.gap); const amt = Math.abs(gap);
        const rows = () => [...box.querySelectorAll('.lx-p')];
        const split = () => { const on = rows().filter((r2) => r2.querySelector('input[type=checkbox]').checked); const each = on.length ? Math.floor(amt / on.length / 1000) * 1000 : 0;
          rows().forEach((r2) => { r2.querySelector('.lx-pa').value = ''; }); on.forEach((r2, k) => { r2.querySelector('.lx-pa').value = fmt(k === on.length - 1 ? amt - each * (on.length - 1) : each); }); sum2(); };
        const sum2 = () => { const got = rows().filter((r2) => r2.querySelector('input[type=checkbox]').checked).reduce((t, r2) => t + (parseMoney(r2.querySelector('.lx-pa').value) || 0), 0);
          box.querySelector('.lx-sum').textContent = `Đã chia ${fmt(got)}đ / ${fmt(amt)}đ${got !== amt ? ' — chưa khớp' : ''}`; return got; };
        bindMoneyInputs(box);
        box.addEventListener('change', (e) => { if (e.target.name === `lx-${item}`) { box.querySelector('.lx-people').hidden = e.target.value !== 'chia'; if (e.target.value === 'chia') split(); } if (e.target.type === 'checkbox') split(); });
        box.querySelectorAll('.lx-pa').forEach((x) => x.addEventListener('input', sum2));
        box.querySelector('.lx-save').addEventListener('click', async () => {
          const how = box.querySelector(`input[name="lx-${item}"]:checked`)?.value; const why = box.querySelector('.lx-why').value.trim(); const err = box.querySelector('.lx-err'); err.innerHTML = '';
          if (how === 'sau') { flash('Để đối soát lại sau — ca hiện "Hoàn thành 1 phần" ở bảng tuần.'); return; }
          const btn = box.querySelector('.lx-save'); btn.disabled = true;
          try {
            if (saveNow) await saveNow().catch(() => {});
            if (how === 'qc') {
              const res = gap < 0 ? 'thieu' : 'thua';
              await rpc('app_ca_result_set', { p_id: R.id, p_item: item, p_result: res, p_amount: amt, p_reason: why || (res === 'thieu' ? 'Quán chịu' : 'Thu khác'), p_people: [] });
              try { await rpc('app_gap_decide', { p_report: R.id, p_item: item, p_kind: res === 'thieu' ? 'quan_chiu' : 'thu_khac', p_amount: amt, p_reason: why || (res === 'thieu' ? 'Quán chịu' : 'Thu khác') }); }
              catch (e2) { await rpc('app_ca_result_clear', { p_id: R.id, p_item: item }).catch(() => {}); throw e2; }
              flash(res === 'thieu' ? 'Đã ghi Quán chịu.' : 'Đã ghi Thu khác.');
            } else {
              const people = rows().filter((r2) => r2.querySelector('input[type=checkbox]').checked).map((r2) => ({ employee_id: Number(r2.dataset.emp), amount: parseMoney(r2.querySelector('.lx-pa').value) || 0 }));
              if (!people.length) throw new Error('Tích ít nhất 1 người chịu.');
              if (sum2() !== amt) throw new Error('Tổng chia phải bằng số lệch.');
              await rpc('app_ca_result_set', { p_id: R.id, p_item: item, p_result: 'thieu', p_amount: amt, p_reason: why || 'Chia người làm ca', p_people: people });
              flash(`Đã chia cho ${people.length} người — mỗi người nhận thông báo khoản âm.`);
            }
            rerender();
          } catch (e) { btn.disabled = false; err.innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
        });
      });
      go(cur);
    } else if (dsStep) setTimeout(() => go(cur), 300);
    // bước 89: quản lý đổi loại nợ HĐ / TM / CK
    $$('[data-dkind]').forEach((b) => b.addEventListener('click', async () => {
      if (b.classList.contains('on')) return;
      try { await rpc('app_ca_debt_kind', { p_debt: Number(b.dataset.debt), p_kind: b.dataset.dkind }); flash('Đã đổi loại nợ.'); rerender(); }
      catch (e) { const el = $('#dk-err'); if (el) el.innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    }));
    // bước 88: chọn cách thu tiền mặt, lưu số quản lý đếm
    const saveMode = async (mode, counted) => {
      try { await rpc('app_ca_cash_mode', { p_id: R.id, p_mode: mode, p_counted: counted }); flash(mode === 'ca' ? 'Đã lưu: thu theo ca.' : 'Đã lưu: thu cuối ngày.'); rerender(); }
      catch (e) { const el = $('#cm88-err'); if (el) el.innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    };
    $$('[data-cmode]').forEach((b) => b.addEventListener('click', () => { if (!b.classList.contains('on')) saveMode(b.dataset.cmode, b.dataset.cmode === 'ca' ? (R0.ql_counted ?? null) : null); }));
    if ($('#ql-count')) bindMoneyInputs($('.cm88'));
    $('#ql-save')?.addEventListener('click', () => { const v = parseMoney($('#ql-count').value); if (v === null) { $('#cm88-err').innerHTML = str(html`<div class="alert error">Nhập số quản lý đếm.</div>`); return; } saveMode('ca', v); });
    // bước 87: bàn giao → giao thành việc (người nhận được thông báo, việc hiện ở Công việc; làm xong thì bàn giao tự "đã xử lý")
    $$('.ho-giao').forEach((b) => b.addEventListener('click', async () => {
      const h = (R.handover || []).find((x) => String(x.id) === b.dataset.id); if (!h) return;
      let people = []; try { people = await rpc('app_viec_people'); } catch (e) { showSaved(e.message, true); return; }
      const d = dialog(html`<form class="stack" style="gap:12px;max-width:460px"><h2 style="margin:0">Giao thành việc</h2>
        <div class="st-meta">Từ bàn giao ca ${R.shift} ${dmy(R.work_date)} · ${R.branch_code}</div>
        <div class="pc-line carried"><div class="grow">${h.content}</div></div>
        <label class="pc-f"><span>Người nhận</span><select class="input" name="who"><option value="">— Chọn người nhận —</option>${people.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></label>
        <div class="pc-line" style="gap:8px"><label class="pc-f grow"><span>Mức độ</span><select class="input" name="pri"><option value="gap">Gấp</option><option value="binh_thuong" selected>Bình thường</option><option value="thap">Thấp</option></select></label>
          <label class="pc-f grow"><span>Hạn (không bắt buộc)</span><input class="input" type="date" name="due"></label></div>
        <div class="st-meta">Người nhận được <b>thông báo</b>; việc hiện ở <b>Công việc</b>. Làm xong thì bàn giao này tự ghi "đã xử lý".</div>
        <div id="hg-err"></div>
        <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Giao việc</button></div></form>`);
      const f = d.querySelector('form'); d.querySelector('[data-x]').addEventListener('click', () => d.close());
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault(); const btn = f.querySelector('[type=submit]');
        if (!f.who.value) { d.querySelector('#hg-err').innerHTML = str(html`<div class="alert error">Chọn người nhận.</div>`); return; }
        btn.disabled = true;
        try { await rpc('app_viec_add', { p_meeting: null, p: { kind: 'viec', handover_item_id: h.id, assignee_id: f.who.value, due_date: f.due.value || null, priority: f.pri.value } }); d.close(); flash('Đã giao việc — người nhận đã được thông báo.'); rerender(); }
        catch (e) { btn.disabled = false; d.querySelector('#hg-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
      });
    }));
    let EMPS = null;
    const loadTc = () => Promise.all([rpc('app_tc_list', { p_branch: R.branch_id, p_from: R.work_date, p_to: R.work_date }), EMPS ? Promise.resolve(EMPS) : rpc('app_ca_employees').catch(() => [])]).then(([D, em]) => {
      EMPS = em || []; const box = $('#ds-tc'); if (!box) return;
      const rows = (D.rows || []).filter((x) => x.src === 'ca' && x.report_id === R.id);
      // bước 90: chia 2 phần như phiếu nhân viên — tiền mặt / chuyển khoản
      box.innerHTML = '<h3 style="margin:4px 0 0">1. Tiền mặt</h3><div id="ds-tc-tm"></div><h3 style="margin:10px 0 0">2. Chuyển khoản</h3><div id="ds-tc-ck"></div>';
      const opt = { cats: D.categories || [], showReport: false, onChange: loadTc, emps: EMPS };
      tcList($('#ds-tc-tm'), rows.filter((x) => x.pay !== 'chuyen_khoan'), opt);
      tcList($('#ds-tc-ck'), rows.filter((x) => x.pay === 'chuyen_khoan'), opt);
    }).catch((e) => { const box = $('#ds-tc'); if (box) box.textContent = 'Không tải được thu chi: ' + e.message; });
    loadTc();
  }
  // ---------- Bản đối soát: chuyển khoản thực nhận do kế toán nhập
  if (isDs) mountBankOuts($('#bank-outs'), R.id, () => rerender());   // bước 54: phiếu chi chuyển khoản
  // bước 55: nợ của ca này đã thu ở ca nào → ghi rõ ca thu, bấm mở ca đó
  if ($$('.db-paid').length) {
    rpc('app_ca_debts_paid', { p_id: R.id }).then((L) => (L || []).forEach((x) => {
      const el = $(`.db-paid[data-debt="${x.id}"]`); if (!el) return;
      const href = isDs && x.status === 'hoan_thanh' ? `#/quan-ly/doi-soat/ca?id=${x.report_id}` : `#/ca/phieu?id=${x.report_id}`;
      el.innerHTML = str(html`<a href="${href}" style="color:inherit">Đã thu ở ca ${x.shift} ${dmy(x.work_date)} · ${x.kind === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'} ›</a>`);
    })).catch(() => {});
  }
  if (isDs && $('#bank-box')) {
    rpc('app_kt_bank_get', { p_report: R.id }).then((b) => {
      const got = b.received; const ck = R.pos_transfer; const rt = R.reported_transfer;
      $('#bank-box').innerHTML = str(html`<div class="diff-card"><div class="pc-sub" style="margin:0">CHUYỂN KHOẢN THỰC NHẬN (KẾ TOÁN NHẬP)</div>
        ${got === null || got === undefined ? html`<div class="st-meta">Kế toán chưa nhập số dư cho ca này.</div>`
          : html`<div class="kv">${(b.accounts || []).map((a) => html`<div>${a.bank} ${a.account_no}${a.label ? ' · ' + a.label : ''}</div><div>${a.received === null || a.received === undefined ? 'chưa nhập' : html`${vnd(a.opening)} → ${vnd(a.closing)}${a.transfers_out ? ` · chuyển ra ${vnd(a.transfers_out)}` : ''} = <strong>${vnd(a.received)}</strong>`}${a.note ? html`<br><span class="st-meta">${a.note}</span>` : ''}</div>`)}
            <div><strong>Tiền nhận trong ca</strong></div><div><strong>${vnd(got)}</strong>${b.entered < b.account_count ? html` <span class="pill warn">còn ${b.account_count - b.entered} tài khoản chưa nhập</span>` : ''}</div>
            <div>So với CK theo POS</div><div>${ck === null || ck === undefined ? '—' : signed(got - ck)}</div>
            <div>So với CK nhân viên báo</div><div>${rt === null || rt === undefined ? '—' : signed(got - rt)}</div></div>
            <div class="st-meta">Nhập bởi ${b.updated_by || ''} · ${dt(b.updated_at)}${b.locked ? ' · đã khóa theo đối soát' : ''}</div>`}</div>`);
    }).catch(() => {});
  }

  if (R.can_recon && (R0 || R).recon_status !== 'hoan_thanh') {
    $$('.rc-res').forEach((b) => b.addEventListener('click', () => openResult(b.dataset.item)));
    $$('.rc-chip[data-item]:not(.rc-res)').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await rpc('app_ca_check', { p_id: R.id, p_item: b.dataset.item, p_on: !b.classList.contains('on') }); rerender(); }
      catch (e) { b.disabled = false; showSaved(e.message, true); }
    }));
  }
  // Hộp chọn KHỚP / THIẾU / THỪA cho một hạng mục tiền
  function openResult(item) {
    const v = ed ? collect() : R; const c = calc(v, debtSums(R, ed ? v.debts : null));
    const M = (R0 || R).money || {};
    let comp = null; let basis = '';
    if (item === 'tien_mat') {
      const hg = Number(M.handover_gap || 0);
      comp = c.tmLeft === null ? null : c.tmLeft + hg;
      basis = `Tiền mặt chưa giải trình (Mục 5 − đầu ca − Mục 2 − thu chi − thu nợ${hg ? ` ${hg < 0 ? '−' : '+'} ${fmt(Math.abs(hg))}đ ca sau nhận két lệch` : ''})`;
    }
    if (item === 'chuyen_khoan') {
      if (M.bank_ok) { comp = Number(M.bank_received) - Number(v.pos_transfer || 0) - c.ckMoves - c.colCK; basis = `Theo tiền thực nhận kế toán nhập (${vnd(M.bank_received)}) − Mục 3 − thu chi − thu nợ`; }
      else { comp = c.ckLeft; basis = 'TẠM theo Mục 4 nhân viên báo (kế toán chưa nhập đủ số dư) − Mục 3 − thu chi − thu nợ'; }
    }
    const cur = (R.results || {})[item];
    const sug = cur ? cur.result : comp === null || comp === 0 ? 'khop' : comp < 0 ? 'thieu' : 'thua';
    const amt0 = cur ? cur.amount : comp ? Math.abs(comp) : '';
    const staff = (v.staff || []).filter((x) => x.worked).map((x) => ({ id: x.employee_id, name: ($(`.st-row[data-emp="${x.employee_id}"] strong`)?.textContent) || ((R.staff || []).find((y) => y.employee_id === x.employee_id) || {}).name || ('NV ' + x.employee_id) }));
    const had = (R.shortfalls || []).filter((k) => k.item === item);
    const MONEY_DEFER = item === 'tien_mat' || item === 'chuyen_khoan';   // bước 71: thiếu tiền để tab Âm tiền xử lý
    const d = dialog(html`<form class="stack rs-dlg" style="gap:12px">
      <h2 style="margin:0">Đối soát: ${CHECK_LABEL[item]}</h2>
      ${comp !== null ? html`<div class="diff-card"><div><strong>Web tính: ${signed(comp)}</strong> ${result(comp)}</div><div class="st-meta">${basis}</div></div>` : html`<div class="st-meta">Kiểm tra chứng từ của hạng mục rồi chọn kết quả.</div>`}
      <div class="pc-line" role="radiogroup" aria-label="Kết quả">${['khop', 'thieu', 'thua'].map((k) => html`<label class="radio-pill rs-${k}"><input type="radio" name="res" value="${k}" ${sug === k ? 'checked' : ''}> ${RES[k][0]}</label>`)}</div>
      <div class="rs-more" ${sug === 'khop' ? 'hidden' : ''}>
        <label class="pc-f"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${amt0 ? fmt(amt0) : ''}" autocomplete="off"></label>
        <label class="pc-f"><span>Lý do (bắt buộc)</span><input class="input" name="why" value="${cur?.reason || ''}" placeholder="vd: thiếu tiền két, chưa rõ nguyên nhân" autocomplete="off"></label>
      </div>
      ${MONEY_DEFER ? html`<div class="rs-who" ${sug === 'thieu' ? '' : 'hidden'}><div class="pc-line" role="radiogroup" aria-label="Xử lý khoản thiếu">
          <label class="radio-pill"><input type="radio" name="who" value="tab" ${had.length ? '' : 'checked'}> ${item === 'chuyen_khoan' ? 'Chờ tiền về' : 'Để tab Âm tiền xử lý'}</label>
          <label class="radio-pill"><input type="radio" name="who" value="now" ${had.length ? 'checked' : ''}> Chọn người chịu ngay</label></div>
        <div class="st-meta">${item === 'chuyen_khoan' ? 'Khách chuyển khoản có thể về hôm sau: ca vẫn hoàn thành đối soát, chưa báo nhân viên. Xử lý (ghép tiền về / trừ lương / quán chịu) ở Quản lý ca › Âm tiền.' : 'Ca vẫn hoàn thành đối soát, chưa báo nhân viên. Chọn người chịu / quán chịu ở Quản lý ca › Âm tiền.'}</div></div>` : ''}
      <div class="rs-people" ${sug === 'thieu' && (!MONEY_DEFER || had.length) ? '' : 'hidden'}>
        <div class="pc-sub">NHÂN VIÊN CHỊU KHOẢN THIẾU <span class="st-meta">— web chia đều cho người được tích (sửa được số từng người); mặc định ghi <strong>TRỪ LƯƠNG</strong>, mỗi người nhận thông báo</span></div>
        ${staff.length ? staff.map((p) => { const h = had.find((k) => k.employee_id === p.id); return html`<div class="pc-line rs-p" data-emp="${p.id}"><label class="grow" style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${h ? 'checked' : ''}> ${p.name}</label>
          <input class="input sm money rs-pa" inputmode="numeric" value="${h ? fmt(h.amount) : ''}" style="width:130px" aria-label="Số tiền của ${p.name}"></div>`; })
          : html`<div class="st-meta">Phiếu chưa có nhân viên làm trong ca.</div>`}
        <div class="st-meta" id="rs-sum"></div>
      </div>
      <div id="rs-err"></div>
      <div class="toolbar" style="justify-content:space-between">
        <span>${cur ? html`<button type="button" class="btn sm secondary danger" id="rs-clear">Bỏ kết quả</button>` : ''}</span>
        <span class="toolbar"><button type="button" class="btn sm secondary" id="rs-x">Hủy</button><button class="btn sm" type="submit">Lưu kết quả</button></span></div></form>`);
    bindMoneyInputs(d);
    const f = d.querySelector('form');
    const val = () => f.querySelector('input[name=res]:checked')?.value;
    const who = () => f.querySelector('input[name=who]:checked')?.value || 'now';
    const split = () => {
      const tot = parseMoney(f.amt.value) || 0; const on = [...d.querySelectorAll('.rs-p')].filter((r) => r.querySelector('input[type=checkbox]').checked);
      if (on.length) { const each = Math.floor(tot / on.length / 1000) * 1000; on.forEach((r, i) => { r.querySelector('.rs-pa').value = fmt(i === on.length - 1 ? tot - each * (on.length - 1) : each); }); }
      d.querySelectorAll('.rs-p').forEach((r) => { if (!r.querySelector('input[type=checkbox]').checked) r.querySelector('.rs-pa').value = ''; });
      sumTxt();
    };
    const sumTxt = () => {
      const tot = parseMoney(f.amt.value) || 0; const got = [...d.querySelectorAll('.rs-p')].filter((r) => r.querySelector('input[type=checkbox]').checked).reduce((s2, r) => s2 + (parseMoney(r.querySelector('.rs-pa').value) || 0), 0);
      const el = d.querySelector('#rs-sum'); if (el) el.textContent = `Đã chia ${fmt(got)}đ / ${fmt(tot)}đ${got !== tot ? ' — chưa khớp' : ''}`;
    };
    f.addEventListener('change', (e) => {
      if (e.target.name === 'res') {
        d.querySelector('.rs-more').hidden = val() === 'khop'; const rw = d.querySelector('.rs-who'); if (rw) rw.hidden = val() !== 'thieu';
        d.querySelector('.rs-people').hidden = val() !== 'thieu' || (MONEY_DEFER && who() !== 'now');
        if (!d.querySelector('.rs-people').hidden && !d.querySelector('.rs-p input[type=checkbox]:checked')) tickAll();
      }
      if (e.target.name === 'who') { d.querySelector('.rs-people').hidden = who() !== 'now'; if (who() === 'now' && !d.querySelector('.rs-p input[type=checkbox]:checked')) tickAll(); }
      if (e.target.type === 'checkbox') split();
    });
    f.amt.addEventListener('input', split);
    d.querySelectorAll('.rs-pa').forEach((x) => x.addEventListener('input', sumTxt));
    // mặc định tích hết nhân viên làm trong ca rồi chia đều
    function tickAll() { d.querySelectorAll('.rs-p input[type=checkbox]').forEach((x) => { x.checked = true; }); split(); }
    if (sug === 'thieu' && !had.length && staff.length) tickAll(); else sumTxt();
    d.querySelector('#rs-x').addEventListener('click', () => d.close());
    d.querySelector('#rs-clear')?.addEventListener('click', async () => {
      try { await rpc('app_ca_result_clear', { p_id: R.id, p_item: item }); d.close(); flash('Đã bỏ kết quả.'); rerender(); }
      catch (e) { d.querySelector('#rs-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const res = val(); const people = res === 'thieu' && MONEY_DEFER && who() === 'tab' ? [] : res === 'thieu' ? [...d.querySelectorAll('.rs-p')].filter((r) => r.querySelector('input[type=checkbox]').checked).map((r) => ({ employee_id: Number(r.dataset.emp), amount: parseMoney(r.querySelector('.rs-pa').value) || 0 })) : null;
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      try {
        if (saveNow) await saveNow().catch(() => {});
        await rpc('app_ca_result_set', { p_id: R.id, p_item: item, p_result: res, p_amount: res === 'khop' ? null : parseMoney(f.amt.value), p_reason: f.why.value, p_people: people });
        d.close(); flash(res === 'thieu' && people?.length ? `Đã lưu. ${people.length} nhân viên đã được báo khoản âm — mặc định trừ lương.` : res === 'thieu' && MONEY_DEFER ? `Đã lưu THIẾU — ${item === 'chuyen_khoan' ? 'chờ tiền về' : 'chờ gán'} ở Quản lý ca › Âm tiền.` : 'Đã lưu kết quả đối soát.'); rerender();
      } catch (e) { btn.disabled = false; d.querySelector('#rs-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }
  // bước 74: Ghi nhận nợ ở đối soát — số tiền ca không đổi; nợ vào Công nợ; khách trả ở ca sau thì tự bù ca này
  $('#rd-add')?.addEventListener('click', () => {
    const d = dialog(html`<form class="stack" style="gap:12px;max-width:460px"><h2 style="margin:0">Ghi nhận nợ · ca ${R.shift} ${dmy(R.work_date)}</h2>
      <div class="st-meta">Khách nợ nhưng nhân viên đã bấm thanh toán trên Fabi. Số tiền của ca <b>không đổi</b> (ca hiện thiếu khoản này — tab Âm tiền ghi "Chờ khách trả nợ"). Khoản nợ vào Công nợ và nhắc ở các ca sau; khách trả ở ca sau thì web tự bù cho ca này.</div>
      <div class="pc-line" role="radiogroup" aria-label="Nhân viên đã bấm"><label class="radio-pill"><input type="radio" name="it" value="chuyen_khoan" checked> NV bấm Chuyển khoản</label><label class="radio-pill"><input type="radio" name="it" value="tien_mat"> NV bấm Tiền mặt</label></div>
      <label class="field"><span>Tên / bàn khách</span><input class="input" name="nm" autocomplete="off" placeholder="vd: Bàn 5, chị Hoa"></label>
      <label class="field"><span>Số điện thoại</span><input class="input" name="ph" inputmode="tel" autocomplete="off"></label>
      <label class="field"><span>Số tiền nợ</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" placeholder="vd: hẹn trả cuối tuần"></label>
      <div id="rd-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Ghi nhận nợ</button></div></form>`);
    bindMoneyInputs(d); const f = d.querySelector('form');
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await rpc('app_ca_recon_debt', { p_report: R.id, p_item: f.querySelector('[name=it]:checked').value, p_name: f.nm.value, p_phone: f.ph.value, p_amount: parseMoney(f.amt.value), p_note: f.note.value });
        d.close(); flash('Đã ghi nhận nợ — khoản nợ vào Công nợ, nhắc ở các ca sau.'); rerender(); }
      catch (e) { d.querySelector('#rd-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  });
  $$('.rd-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Xoá khoản nợ ghi nhận này?')) return;
    try { await rpc('app_ca_recon_debt_delete', { p_id: Number(b.dataset.id) }); flash('Đã xoá khoản nợ ghi nhận.'); rerender(); } catch (e) { showSaved(e.message, true); }
  }));
  $('#rc-reopen')?.addEventListener('click', async () => {
    const why = prompt('Mở lại CẢ PHIẾU: mọi mục trở lại chờ đối soát (muốn sửa 1 mục thì bấm “Sửa” ở mục đó).\nLý do:', '');
    if (why === null) return;
    try { await rpc('app_ca_recon_reopen', { p_id: R.id, p_reason: why }); flash('Đã mở lại đối soát.'); rerender(); } catch (e) { showSaved(e.message, true); }
  });
  $('#rc-finish')?.addEventListener('click', async () => {
    try { if (saveNow) await saveNow(); } catch (_) { /* bỏ qua */ }
    try { await rpc('app_ca_recon_finish', { p_id: R.id }); flash('Đã hoàn thành đối soát lại.'); rerender(); } catch (e) { showSaved(e.message, true); }
  });
  $('#reopen')?.addEventListener('click', async () => {
    if (!confirm('Mở lại phiếu cho nhân viên sửa phiếu gốc? Bản đối soát và các hạng mục đã đối soát sẽ làm lại từ đầu (lịch sử sửa vẫn giữ).')) return;
    try { await rpc('app_ca_reopen', { p_id: R.id }); flash('Đã mở lại phiếu.'); rerender(); } catch (e) { showSaved(e.message, true); }
  });
  if (!ed) return undefined;

  // ---------- tự động lưu
  let timer = null; let saving = null; let dirty = false;
  let staffKey = JSON.stringify(collect().staff);
  saveNow = async () => {
    clearTimeout(timer);
    if (saving) { await saving; if (!dirty) return; }
    if (!dirty) return;
    if (isDs && !DIR && !rcWhyVal()) {   // bước 90: quản lý sửa số phải ghi lý do
      $$('.rc-need').forEach((x) => { x.hidden = false; }); showSaved('Ghi lý do sửa (bắt buộc) — web chưa lưu.', true); return;
    }
    $$('.rc-need').forEach((x) => { x.hidden = true; });
    dirty = false;
    const hoRows = $$('.ho-row'); const dbRows = $$('.db-row').filter((r) => !r.querySelector('.db-table').disabled || r.dataset.id);
    const payload = collect();
    payload.debts = (payload.debts || []).concat((R.debts || []).filter((d) => d.kind === 'muon' || d.kind === 'ck').map((d) => ({ id: d.id, table_name: d.table_name, amount: d.amount, note: d.note || '', kind: d.kind })));
    const call = isDs ? (DIR ? rpc('app_ca_recon_direct', { p_id: R.id, p: payload, p_reason: DIR.why, p_items: DIR.items })
      : rpc('app_ca_recon_save', { p_id: R.id, p: payload, p_reason: rcWhyVal() || null })) : rpc('app_ca_save', { p_id: R.id, p: payload });
    saving = call.then((res) => {
      if (!isDs) {
        (res.handover_ids || []).forEach((nid, i) => { if (nid && hoRows[i]) hoRows[i].dataset.id = nid; });
        (res.debt_ids || []).forEach((nid, i) => { if (nid && dbRows[i]) dbRows[i].dataset.id = nid; });
      }
      if (!res?.skipped) showSaved((isDs ? 'Đã lưu bản đối soát · ' : 'Đã lưu · ') + hhmm());
      if (isDs && R0) rpc('app_ca_money', { p_id: R.id }).then((m) => { if (m && !dirty) { R0.money = m; srvFresh = true; recalc(); } }).catch(() => {});
      const sk = JSON.stringify(payload.staff);
      if (sk !== staffKey) { staffKey = sk; if (isDs) mountCover($('#ds-cv'), R, cvCtx); }
    }).catch((e) => { dirty = true; showSaved('Chưa lưu được: ' + e.message, true); throw e; }).finally(() => { saving = null; });
    return saving;
  };
  const changed = () => { dirty = true; srvFresh = false; recalc(); clearTimeout(timer); timer = setTimeout(() => saveNow().catch(() => {}), 1200); };
  // bước 90: ô lý do sửa không tính là sửa số; các khung tự lưu riêng (cách thu, xử lý lệch, thu chi, nghỉ & làm thay…) không chạy lưu phiếu
  const noSave = (t) => !!t.closest('.cm88, .lx-box, #ds-tc, #ds-cv, #ds-dg, #ds-lights, dialog');
  const isWhy = (t) => t.matches('.rc-why, #rc-reason');
  form.addEventListener('input', (ev) => {
    if (isWhy(ev.target)) { $$('.rc-why, #rc-reason').forEach((x) => { if (x !== ev.target) x.value = ev.target.value; }); if (dirty) { clearTimeout(timer); timer = setTimeout(() => saveNow().catch(() => {}), 900); } return; }
    if (noSave(ev.target)) return;
    changed();
  });
  form.addEventListener('change', (ev) => {
    if (isWhy(ev.target) || noSave(ev.target)) return;
    if (ev.target.classList.contains('st-worked')) {
      const row = ev.target.closest('.st-row'); const w = ev.target.value === '1';
      row.querySelector('.st-times').hidden = !w; row.querySelector('.st-reason').hidden = w;
    }
    changed();
  });
  form.addEventListener('click', (ev) => {
    const del = ev.target.closest('.pc-del');
    if (del) { del.closest('.mv-row, .db-row, .st-row, .ho-row, .gd-row').remove(); changed(); }
  });
  const add = (sel, rowHtml, focusSel) => {
    const box = $(sel); box.insertAdjacentHTML('beforeend', str(rowHtml)); bindMoneyInputs(box);
    box.lastElementChild.querySelector(focusSel)?.focus(); changed();
  };
  $('#add-move')?.addEventListener('click', () => add('#moves', moveRow({ kind: 'tien_mat', amount: null, note: '' }, true), '.mv-amt'));
  $('#add-debt')?.addEventListener('click', () => add('#debts', debtRow({}, true), '.db-table'));
  $('#add-ho')?.addEventListener('click', () => add('#handover', hoRow({}, true), '.ho-text'));
  $('#add-good')?.addEventListener('click', () => add('#goods', goodRow({}, true), '.gd-item'));

  // người hỗ trợ
  let emps = [];
  rpc('app_ca_employees').then((list) => {
    emps = list || [];
    $('#emp-list').innerHTML = str(html`${emps.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}`);
  }).catch(() => {});
  $('#add-helper')?.addEventListener('click', () => {
    const q = $('#helper').value.trim().toLowerCase();
    const code = q.split(/\s*[–-]\s*/)[0];
    const e = emps.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || emps.find((x) => x.code.toLowerCase() === code);
    if (!e) { showSaved('Không tìm thấy nhân viên. Chọn trong danh sách gợi ý.', true); return; }
    if ($$('.st-row').some((r) => Number(r.dataset.emp) === e.id)) { showSaved('Người này đã có trong danh sách.', true); return; }
    $('#staff-empty')?.remove();
    add('#staff', staffRow({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank, source: 'ho_tro', worked: 1, pay_cash: e.pay_cash }, true), '.st-in');
    bindMoneyInputs($('#staff'));
    $('#helper').value = '';
  });

  // việc bàn giao / nợ từ ca trước
  $$('.ho-done').forEach((b) => b.addEventListener('click', async () => {
    try { await saveNow(); await rpc('app_ca_handover_done', { p_item: Number(b.dataset.id), p_report: R.id, p_done: !b.dataset.undo }); rerender(); }
    catch (e) { showSaved(e.message, true); }
  }));
  $$('.debt-close').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.undo) {
      try { await saveNow(); await rpc('app_ca_debt_collect', { p_debt: Number(b.dataset.id), p_report: R.id, p_kind: null, p_note: null }); rerender(); } catch (e) { showSaved(e.message, true); }
      return;
    }
    const d = dialog(html`<form class="stack" style="gap:12px;max-width:440px"><h2 style="margin:0">Khách trả nợ ${b.dataset.table}</h2>
      <div>Còn nợ: <strong>${vnd(b.dataset.amt)}</strong>. Số khách trả được cộng vào tiền của ca này; trả thiếu thì phần còn lại vẫn nhắc ở các ca sau.</div>
      <label class="field"><span>Số tiền khách trả</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${fmt(b.dataset.amt)}"></label>
      <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="kind" value="tien_mat"> Tiền mặt (vào két)</label><label class="radio-pill"><input type="radio" name="kind" value="chuyen_khoan"> Chuyển khoản</label></div>
      <input class="input" name="note" placeholder="Ghi chú (không bắt buộc)" autocomplete="off"><div id="dc-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Xác nhận đã thu</button></div></form>`);
    bindMoneyInputs(d);
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    d.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target; const kind = f.querySelector('input[name=kind]:checked')?.value;
      if (!kind) { d.querySelector('#dc-err').innerHTML = str(html`<div class="alert error">Chọn tiền mặt hay chuyển khoản.</div>`); return; }
      const amt = parseMoney(f.amt.value || '0');
      try { await saveNow(); await rpc('app_ca_debt_collect_part', { p_debt: Number(b.dataset.id), p_report: R.id, p_kind: kind, p_amount: amt, p_note: f.note.value }); d.close(); rerender(); }
      catch (e) { d.querySelector('#dc-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }));

  // ảnh
  $$('.ph-input').forEach((inp) => inp.addEventListener('change', async (ev) => {
    const files = [...ev.target.files]; if (!files.length) return;
    const st = inp.closest('.pc-f, [data-pane]')?.querySelector('.ph-status') || $('#photo-status');
    try {
      await saveNow();
      for (let i = 0; i < files.length; i++) {
        if (st) st.textContent = `Đang tải ảnh ${i + 1}/${files.length}…`;
        const blob = await compressImage(files[i]);
        const kind = inp.dataset.kind || 'hang';
        const path = `r${R.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw new Error(error.message);
        await rpc('app_ca_photo_add', { p_id: R.id, p_path: path, p_kind: kind });
      }
      rerender();
    } catch (e) { if (st) st.textContent = ''; showSaved('Không tải được ảnh: ' + e.message, true); }
  }));

  // nhận két: đếm mù (1 lần) → lệch thì 2 người đếm lại (1 lần)
  $('#hand-reload')?.addEventListener('click', () => rerender());
  $('#hand-ok')?.addEventListener('click', async () => {
    const amt = parseMoney($('#hand-count').value);
    if (amt === null) { showSaved('Nhập số tiền đếm được trong két.', true); $('#hand-count').focus(); return; }
    if (!confirm(`Xác nhận bạn đếm được ${fmt(amt)}đ trong két?\nSau khi xác nhận không sửa được.`)) return;
    try { await saveNow(); const h = await rpc('app_ca_cash_receive', { p_id: R.id, p_amount: amt });
      flash(h && h.state === 'can_dem_lai' ? `Lệch ${signed(h.gap)} so với két ca ${h.prev_shift} khai — hãy cùng người ca ${h.prev_shift} đếm lại.` : 'Đã ghi số đếm nhận két.'); rerender(); }
    catch (e) { showSaved(e.message, true); }
  });
  if ($('#hand-giver') && !$('#hand-giver').options[1]) {
    rpc('app_ca_employees').then((list) => { $('#hand-giver')?.insertAdjacentHTML('beforeend', str(html`${(list || []).map((e) => html`<option value="${e.id}">${e.code} – ${e.name}</option>`)}`)); }).catch(() => {});
  }
  $('#hand-re')?.addEventListener('click', async () => {
    const amt = parseMoney($('#hand-recount').value); const giver = Number($('#hand-giver').value) || null;
    if (!giver) { showSaved('Chọn người ca trước cùng đếm lại.', true); return; }
    if (amt === null) { showSaved('Nhập số tiền 2 người cùng đếm lại.', true); return; }
    if (!confirm(`Lưu số 2 người cùng đếm lại: ${fmt(amt)}đ?\nChỉ nhập được 1 lần.`)) return;
    try { await saveNow(); const h = await rpc('app_ca_cash_recount', { p_id: R.id, p_amount: amt, p_giver: giver });
      flash(h && h.state === 'lech' ? 'Vẫn lệch — đã báo quản lý. Ghi lý do lệch tiền đầu ca.' : 'Đếm lại đã khớp két ca trước.'); rerender(); }
    catch (e) { showSaved(e.message, true); }
  });
  $$('.ph-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Xóa ảnh này?')) return;
    try { await saveNow(); const path = await rpc('app_ca_photo_del', { p_photo: Number(b.dataset.id) }); if (path) await sb.storage.from(BUCKET).remove([path]); rerender(); }
    catch (e) { showSaved(e.message, true); }
  }));

  // Phần việc: nhận / nhận lại / bỏ nhận / sửa lại / xong
  const doneMsg = (r, k) => (r.completed ? `Đủ các phần — phiếu chốt ca ${R.shift} đã HOÀN THÀNH.`
    : `Đã xong phần ${PT[k]?.label || k}.${(r.left || []).length ? ' Còn phần: ' + r.left.join(', ') + '.' : ''}`);
  form.addEventListener('click', async (ev) => {
    const b = ev.target.closest('.pt-claim, .pt-force, .pt-release, .pt-undo, .pt-done'); if (!b) return;
    const k = b.dataset.part; const lbl = PT[k]?.label || k;
    const err = (m) => { const box = b.closest('.pt-end, .pt-item, .pt-bar')?.querySelector('.pt-err'); if (box) box.innerHTML = str(html`<div class="alert error">${m}</div>`); else showSaved(m, true); };
    b.disabled = true;
    try {
      if (b.classList.contains('pt-claim')) { await rpc('app_ca_part_claim', { p_id: R.id, p_part: k, p_force: false }); flash(`Bạn đã nhận phần ${lbl}.`); rerender(); return; }
      if (b.classList.contains('pt-force')) {
        if (!confirm(`Nhận lại phần ${lbl} từ ${b.dataset.name || 'người đang làm'}? Người đó sẽ không sửa được phần này nữa (web báo cho họ).`)) { b.disabled = false; return; }
        await rpc('app_ca_part_claim', { p_id: R.id, p_part: k, p_force: true }); flash(`Bạn đã nhận lại phần ${lbl}.`); rerender(); return;
      }
      if (dirty) await saveNow();
      if (b.classList.contains('pt-release')) { await rpc('app_ca_part_release', { p_id: R.id, p_part: k }); flash(`Đã bỏ nhận phần ${lbl}.`); rerender(); return; }
      if (b.classList.contains('pt-undo')) { await rpc('app_ca_part_done', { p_id: R.id, p_part: k, p_on: false }); flash(`Phần ${lbl} đã mở lại để sửa.`); rerender(); return; }
      dirty = true; await saveNow();
      if (k === 'tien') { b.disabled = false; confirmMoney(k); return; }
      const r = await rpc('app_ca_part_done', { p_id: R.id, p_part: k, p_on: true }); dirty = false; flash(doneMsg(r, k)); rerender();
    } catch (e) { b.disabled = false; err(e.message); }
  });
  // Xong phần TIỀN: bảng xác nhận số tiền như trước
  const confirmMoney = (k) => {
    const v = collect(); const c = calc(v, debtSums(R, v.debts));
    const total = (c.tmLeft || 0) + (c.ckLeft || 0);
    const question = c.tmLeft === null || c.ckLeft === null ? 'Chưa đủ số liệu tiền.'
      : total < 0 ? `Bạn có xác nhận tiền âm của ca này là ${signed(total)} không?`
      : total > 0 ? `Bạn có xác nhận tiền thừa của ca này là ${signed(total)} không?`
      : (c.tmLeft || c.ckLeft) ? 'Tổng bằng 0 nhưng tiền mặt và chuyển khoản đang lệch bù nhau. Bạn có xác nhận không?'
      : 'Tiền của ca khớp. Bạn có xác nhận xong phần TIỀN không?';
    const startTxt = $('#rev_start') ? dt(v.rev_start) : $('.pc-fixed')?.textContent.trim().slice(0, 17);
    const d = dialog(html`<div class="stack" style="gap:10px;max-width:520px">
      <h2 style="margin:0">Xác nhận xong phần TIỀN · chốt ca ${R.shift}</h2>
      <div class="kv">
        <div>Doanh thu từ</div><div>${startTxt || '—'} → ${dt(v.rev_end)}</div>
        <div>Mục 1 Tổng doanh thu</div><div>${vnd(v.total_revenue)}</div>
        <div>Mục 2 Tiền mặt POS</div><div>${vnd(v.pos_cash)}</div>
        <div>Mục 3 Chuyển khoản POS</div><div>${vnd(v.pos_transfer)}</div>
        <div>Mục 4 Chuyển khoản thực tế</div><div>${vnd(v.reported_transfer)}</div>
        <div>Mục 5 Tiền trong két</div><div>${vnd(v.cash_counted)}</div>
        <div>Tiền nhận két đầu ca</div><div>${vnd(v.opening_cash)}</div>
        <div>Số dư đầu iPOS</div><div>${vnd(v.ipos_opening)}</div>
        <div>Ảnh phiếu iPOS</div><div>${(R.photos || []).filter((p) => p.kind === 'ipos').length} ảnh</div>
        <div>Số cốc</div><div>${v.cups ?? '—'}</div>
        <div>Số người thực tế làm</div><div>${$('#staff-count')?.textContent}</div>
        ${c.debtNew ? html`<div>Nợ phát sinh ca này</div><div>${vnd(c.debtNew)}</div>` : ''}
        ${c.colTM || c.colCK ? html`<div>Khách trả nợ ca trước</div><div>TM ${signed(c.colTM)} · CK ${signed(c.colCK)}</div>` : ''}
        <div>Chênh lệch ban đầu</div><div>TM ${signed(c.tmDiff)} · CK ${signed(c.ckDiff)}</div>
      </div>
      ${v.moves.length ? html`<div><strong>Thu chi đã kê khai:</strong>${v.moves.map((m) => html`<div class="st-meta">${m.kind === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'} ${signed(m.amount)} — ${m.note}</div>`)}</div>` : ''}
      <div class="kv"><div>Chưa giải trình TM</div><div>${result(c.tmLeft)}</div><div>Chưa giải trình CK</div><div>${result(c.ckLeft)}</div>
        <div><strong>Tổng còn lại</strong></div><div><strong>${signed(total)}</strong></div></div>
      <div class="alert ${total < 0 ? 'error' : total > 0 ? 'warn' : 'ok'}" style="font-weight:600">${question}</div>
      <div id="finish-err"></div>
      <div class="toolbar" style="justify-content:flex-end">
        <button type="button" class="btn secondary" id="back">QUAY LẠI CHỈNH SỬA</button>
        <button type="button" class="btn" id="confirm-finish">XÁC NHẬN XONG PHẦN TIỀN</button></div></div>`);
    d.querySelector('#back').addEventListener('click', () => d.close());
    d.querySelector('#confirm-finish').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { const r = await rpc('app_ca_part_done', { p_id: R.id, p_part: k, p_on: true }); dirty = false; d.close(); flash(doneMsg(r, k)); rerender(); }
      catch (err) { e.target.disabled = false; d.querySelector('#finish-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
    });
  };

  return () => { if (dirty) saveNow().catch(() => {}); };
}

const STYLE = html`<style>
  .ds-ptabs { display: flex; gap: 6px; flex-wrap: wrap; position: sticky; top: 0; z-index: 4; background: var(--ground, #f5efe6); padding: 6px 0; }   /* bước 79 */
  .ds-pt { font: inherit; font-weight: 800; font-size: 15px; padding: 10px 16px; border-radius: 12px; border: 2px solid var(--line-strong); background: var(--card); cursor: pointer; display: inline-flex; gap: 8px; align-items: center; color: var(--ink); }
  .ds-pt[aria-selected="true"] { border-color: var(--primary); background: var(--primary); color: #fff; }
  .ds-ptn { font-size: 12px; font-weight: 700; background: var(--warn-bg); color: var(--warn-ink); border-radius: 999px; padding: 1px 8px; } .ds-pto { font-size: 12px; color: var(--ok-ink); background: var(--ok-bg); border-radius: 999px; padding: 1px 8px; }
  .pc-part-h { font-size: 15px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--primary); padding: 8px 2px 0; border-top: 2px solid var(--caramel-line); margin-top: 4px; }   /* bước 78 */
  .pc { max-width: 860px; gap: 12px; }
  .pc-sec { gap: 12px; padding: 16px; }
  .pc-sec-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
  .pc-sec h2 { margin: 0; font-size: 17px; }
  .pc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
  @media (max-width: 640px) { .pc-grid { grid-template-columns: minmax(0, 1fr); } }
  .pc-f { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .st-sg { background: #fef9c3; }
  .hd-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .hd-card.todo { border-color: #f59e0b; background: #fffbeb; }
  .pc-orig { font-size: 12px; color: #9a3412; background: #ffedd5; border-radius: 6px; padding: 2px 6px; align-self: flex-start; }
  .pc-ban { margin-top: 8px; }
  .rc-log { font-size: 13px; padding: 3px 0; border-bottom: 1px dashed var(--line-soft); }
  .pc-f > span:first-child { font-weight: 600; color: var(--ink-2); font-size: 13px; }
  .pc-fixed { min-height: 48px; display: flex; align-items: center; gap: 6px; font-weight: 600; flex-wrap: wrap; }
  .pc-hint { font-size: 12px; color: var(--muted); line-height: 1.4; }
  .pc-hint.warn { color: #9a3412; }
  .pc-sub { font-size: 12px; font-weight: 700; letter-spacing: .03em; color: var(--ink-2); margin-top: 4px; }
  .pc-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pc-line .grow { flex: 1 1 180px; min-width: 0; }
  .pc-line.carried { padding: 8px 10px; background: var(--subtle); border-radius: 10px; }
  .mv-row, .db-row, .gd-row { padding: 6px 0; border-bottom: 1px dashed var(--line-soft); }
  .mv-row .mv-amt, .db-row .db-amt { width: 140px; }
  .st-row { border: 1px solid var(--line-soft); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .st-head { display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
  .st-times { display: inline-flex; gap: 8px; flex-wrap: wrap; max-width: 100%; min-width: 0; }
  .st-times[hidden] { display: none; }
  .st-times label { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; }
  .st-times input { width: 110px; }
  .diff-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .rc-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .rc-chip { font: inherit; font-size: 12px; font-weight: 700; padding: 5px 9px; border-radius: 8px; border: 1px solid #fca5a5; background: #fef2f2; color: #b91c1c; }
  .rc-chip.on { border-color: #b8d9ab; background: var(--ok-bg); color: var(--ok-ink); }
  button.rc-chip { cursor: pointer; }
  .rc-chip.rc-auto { opacity: .75; }
  .ca-time { font-size: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .ca-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
  .ca-row.bad { border-color: var(--off-line); } .ca-row.done { opacity: .55; }
  .ca-l { display: flex; flex-direction: column; min-width: 0; } .ca-l .st-meta { overflow-wrap: anywhere; }
  .ca-act { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; }
  .ca-paid { padding: 0 2px; }
  .ca-more > summary { cursor: pointer; font-weight: 700; padding: 8px 0; }
  .pc-sec.pc-auto > :not(.pc-sec-head) { opacity: .5; pointer-events: none; user-select: none; }
  .pc-f.pc-lk { opacity: .5; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .ph { position: relative; margin: 0; aspect-ratio: 1; background: var(--line-soft); border-radius: 10px; overflow: hidden; }
  .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph-del { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(0,0,0,.6); color: #fff; font-size: 16px; cursor: pointer; }
  .radio-pill { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; font-size: 14px; cursor: pointer; }
  .radio-pill:has(input:checked) { border-color: var(--primary); background: var(--caramel-soft); font-weight: 600; }
  .pc-foot { position: sticky; bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; box-shadow: 0 4px 16px rgba(0,0,0,.1); padding: 12px 16px; }
  .pc-foot .btn { min-width: 180px; }
  @media (max-width: 760px) { .pc-foot { padding: 8px 10px; bottom: 6px; } .pc-foot .st-meta { display: none; } .pc-foot .btn { width: 100%; min-height: 44px; } }
  .mobile .pc-foot, .mobile .wz-foot { bottom: 92px; }
  .rc-chip.bad { border-color: #dc2626; background: #dc2626; color: #fff; }
  .rc-chip.warn { border-color: #f59e0b; background: #fef3c7; color: #92400e; }
  .ka-box { border: 1px solid #fca5a5; background: #fef2f2; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .rs-dlg { width: min(520px, calc(100vw - 56px)); }
  .rs-more { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .rs-more { grid-template-columns: 1fr; } }
  .rs-people { display: flex; flex-direction: column; gap: 6px; }
  .radio-pill.rs-khop:has(input:checked) { border-color: var(--ok-line); background: var(--ok-bg); }
  .radio-pill.rs-thieu:has(input:checked) { border-color: #dc2626; background: #fee2e2; }
  .radio-pill.rs-thua:has(input:checked) { border-color: #f59e0b; background: #fef3c7; }
  .wz-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; position: sticky; top: 0; z-index: 4; background: var(--ground); padding: 6px 0; }
  .wz-st { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; border: none; background: none; font: inherit; cursor: pointer; padding: 4px 0; color: var(--muted); min-width: 0; }
  .wz-st b { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #fff; border: 2px solid var(--line); font-size: 13px; }
  .wz-st span { font-size: 10.5px; font-weight: 600; text-align: center; line-height: 1.2; }
  .wz-st.on { color: var(--ink); } .wz-st.on b { background: var(--primary); border-color: var(--primary); color: #fff; }
  .wz-st.past b { background: var(--sage-bg, #e6ecdc); border-color: var(--forest, #2f3d31); color: var(--forest, #2f3d31); }
  .wz-dot { position: absolute; top: 2px; left: calc(50% + 8px); width: 9px; height: 9px; border-radius: 50%; background: #dc2626; }
  .wz-foot { position: sticky; bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; box-shadow: 0 4px 16px rgba(0,0,0,.12); z-index: 4; }
  .wz-foot .btn { min-height: 44px; white-space: nowrap; padding: 0 14px; flex: 1 1 0; min-width: 0; font-size: 15px; }
  .wz-foot #wz-pos { flex: 0 0 auto; }
  .wz-foot [hidden], .wz-pane[hidden], .ds-pane[hidden] { display: none !important; }
  .ds-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ds-pane { gap: 12px; }
  .ph-wrap { max-width: 560px; margin: 0 auto; }   /* bước 91: máy tính hiện giống điện thoại */
  #ds-lights[hidden], .ds-steps[hidden] { display: none !important; }
  .dsp { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .dsp-c { font: inherit; color: inherit; text-align: left; background: var(--card); border: 2px solid var(--line); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; min-width: 0; }
  .dsp-c.cur { border-color: var(--primary); background: var(--caramel-soft); } .dsp-c.done { border-color: var(--ok-line); background: var(--ok-bg); }
  .dsp-n { font-weight: 800; font-size: 14px; } .dsp-s { font-size: 12px; color: var(--ink-2); }
  .dsp-b { display: flex; gap: 3px; width: 100%; } .dsp-b i { flex: 1; height: 5px; border-radius: 3px; background: var(--line); } .dsp-b i.done { background: var(--ok-line); } .dsp-b i.cur { background: var(--primary); }
  .fb-g { display: grid; grid-template-columns: minmax(0, 1fr) auto auto 18px; gap: 6px 10px; font-size: 13.5px; align-items: center; font-variant-numeric: tabular-nums; }
  .fb-g .h { font-size: 11.5px; font-weight: 800; color: var(--muted); text-transform: uppercase; } .fb-g .n { text-align: right; } .fb-ok { color: var(--ok-ink); font-weight: 900; } .fb-bad { color: #b91c1c; font-weight: 900; }
  .fb-row { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .fb-kv { grid-template-columns: minmax(0, 1fr) auto; } .fb-kv > div:nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; } .fb-kv > .fb-p { color: var(--ok-ink); } .fb-kv > .fb-m { color: #b91c1c; } .fb-kv > .fb-t { border-top: 2px solid currentColor; padding-top: 4px; font-weight: 800; }
  .fb-blk { display: flex; flex-direction: column; gap: 6px; } .ds-edit > summary { color: var(--primary); }
  .cm88-seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 10px; overflow: hidden; } .cm88-seg button { border: 0; background: var(--card); font: inherit; font-weight: 700; padding: 6px 12px; cursor: pointer; } .cm88-seg button.on { background: var(--forest); color: #fff; }
  .ds-hd { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; font-weight: 800; letter-spacing: .03em; padding: 10px 14px; border-radius: 12px; background: var(--caramel-soft, #f6ead9); }
  .pc.ds:not(.wz) .ds-pane + .ds-pane { margin-top: 10px; }
  .ds-who { padding: 0 4px; }
  .ds-sum { padding: 6px 0; border-bottom: 1px dashed var(--line-soft); }
  .wz-miss { padding: 6px 0; border-bottom: 1px dashed var(--line-soft); }
  .hand-blind { display: flex; flex-direction: column; gap: 8px; border: 2px dashed var(--caramel, #b07a4a); border-radius: 12px; padding: 10px 12px; background: var(--caramel-soft, #f6ead9); }
  .hand-kv, .diff-card .kv { font-size: 14px; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); }
  .hand-kv > div, .diff-card .kv > div { min-width: 0; overflow-wrap: anywhere; }
  @media (max-width: 560px) { .hand-kv { grid-template-columns: minmax(0, 1fr); gap: 2px; } .hand-kv > div:nth-child(odd) { color: var(--muted); font-size: 12px; margin-top: 4px; } }
  .hand-wait .btn { margin-left: 4px; }
  .diff-card.hand-bad { border-color: #fca5a5; background: #fef2f2; }
  .radio-pill:has(input:checked) { background: var(--caramel-soft, #f6ead9); }
  dialog { max-width: calc(100vw - 24px); }
  .pt-bar { padding: 10px 14px; gap: 6px; display: flex; flex-direction: column; border-left: 4px solid #f59e0b; }
  .pt-bar.mine { border-left-color: var(--primary); background: var(--caramel-soft, #f6ead9); }
  .pt-bar.ok { border-left-color: var(--ok-line, #4d7c0f); }
  .pt-title { font-size: 13px; font-weight: 800; letter-spacing: .03em; }
  .pt-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; }
  .pt-who { min-width: 0; overflow-wrap: anywhere; }
  .pt-end { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; }
  .pt-end .btn { min-height: 44px; }
  .pt-item { border: 1px solid var(--line-soft); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
</style>`;
