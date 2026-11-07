// Phiếu chốt ca: nhân viên chốt ca (tự động lưu) → Hoàn thành → quản lý đối soát trên BẢN ĐỐI SOÁT riêng (phiếu gốc giữ nguyên)
import { render as rerender, isManager } from '../app.js';
import { rpc, sb } from '../sb.js';
import { bindMoneyInputs, compressImage, dmy, dt, fmt, fromLocalInput, parseMoney, result, signed, toLocalInput, vnd } from '../tien.js';
import { $, $$, dialog, flash, go, hhmm, html, showSaved, str } from '../ui.js';
import { STAFF_LABEL, dayName } from './chot_ca.js';
import { catalog } from '../data.js';
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
};
const LOG_ACTION = { sua: 'Sửa', mo_lai_doi_soat: 'Mở lại đối soát', hoan_thanh_doi_soat: 'Hoàn thành đối soát', lam_lai: 'Mở lại phiếu cho nhân viên sửa — bản đối soát làm lại từ đầu' };
const GOODS_LABEL = { khong: 'Không nhận hàng', du: 'ĐỦ', thieu: 'THIẾU' };
function showVal(k, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (Array.isArray(v)) return `${v.length} dòng`;
  if (k === 'rev_start' || k === 'rev_end') return dt(v);
  if (k === 'cups') return String(v);
  if (k === 'goods_status') return GOODS_LABEL[v] || v;
  if (typeof v === 'number') return vnd(v);
  return String(v);
}
// Gộp bản đối soát vào dữ liệu phiếu để dùng chung giao diện
function mergeRecon(R0, RC) {
  const d = RC.data || {};
  return { ...R0, ...d, moves: d.moves || [], goods: d.goods || [],
    staff: (d.staff || []).map((x) => ({ ...x, worked: x.worked ? 1 : 0, ...(RC.employees[String(x.employee_id)] || {}) })) };
}

// ---------------------------------------------------------------- tính toán
export function calc(v) {
  const n = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
  const [total, pc, pt, rt, cc, op] = [n(v.total_revenue), n(v.pos_cash), n(v.pos_transfer), n(v.reported_transfer), n(v.cash_counted), n(v.opening_cash)];
  const sum = (k) => (v.moves || []).filter((m) => m.kind === k).reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const ckDiff = rt !== null && pt !== null ? rt - pt : null;
  const tmDiff = cc !== null && op !== null && pc !== null ? cc - op - pc : null;
  const ckMoves = sum('chuyen_khoan'); const tmMoves = sum('tien_mat');
  return {
    sumGap: total !== null && pc !== null && pt !== null ? total - pc - pt : null,
    ckDiff, tmDiff, ckMoves, tmMoves,
    ckLeft: ckDiff === null ? null : ckDiff - ckMoves,
    tmLeft: tmDiff === null ? null : tmDiff - tmMoves,
  };
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
function debtRow(d, ed) {
  const lock = !ed || !!d.closed_at;
  return html`<div class="pc-line db-row" data-id="${d.id || ''}">
    <input class="input sm db-table" placeholder="Bàn" aria-label="Bàn" value="${d.table_name || ''}" style="width:90px" ${lock ? 'disabled' : ''}>
    <input class="input sm money db-amt" inputmode="numeric" placeholder="Số tiền" aria-label="Số tiền nợ" value="${fmt(d.amount)}" ${lock ? 'disabled' : ''}>
    <input class="input sm db-note grow" placeholder="Thông tin bàn giao (tên khách, SĐT, hẹn trả...)" aria-label="Ghi chú" value="${d.note || ''}" ${lock ? 'disabled' : ''}>
    ${d.closed_at ? html`<span class="pill ok">Đã thu ${dt(d.closed_at)}</span>` : ''}
    ${ed && !d.closed_at ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Xóa khoản nợ">×</button>` : ''}</div>`;
}
// SH = khung giờ của ca ở cơ sở này: người theo lịch chưa có giờ thì điền sẵn làm GỢI Ý (sửa được)
function staffRow(s, ed, SH) {
  const worked = s.worked === undefined ? true : !!s.worked;
  const hm = (x) => (x ? String(x).slice(0, 5) : '');
  const sgIn = ed && s.source === 'lich' && !s.time_in && SH ? hm(SH.start) : '';
  const sgOut = ed && s.source === 'lich' && !s.time_out && SH ? hm(SH.end) : '';
  return html`<div class="st-row" data-emp="${s.employee_id}" data-src="${s.source}" data-role="${s.role || ''}">
    <div class="st-head"><div><strong>${s.code} – ${s.name}</strong> <span class="st-meta">${s.rank || ''}${s.role ? ' · ' + s.role : ''}</span></div>
      <span class="pill ${s.source === 'lich' ? 'mute' : 'warn'}">${s.source === 'lich' ? 'Theo lịch' : 'Hỗ trợ phát sinh'}</span></div>
    <div class="pc-line">
      <select class="input sm st-worked" aria-label="Có làm hay nghỉ" ${ed ? '' : 'disabled'}>${opt('1', 'Có làm', worked ? '1' : '0')}${opt('0', 'Phát sinh nghỉ', worked ? '1' : '0')}</select>
      <span class="st-times" ${worked ? '' : 'hidden'}>
        <label>Đến <input class="input sm st-in ${sgIn ? 'st-sg' : ''}" type="time" value="${s.time_in || sgIn}" ${ed ? '' : 'disabled'} ${sgIn ? 'title="Gợi ý theo khung giờ ca — sửa theo thực tế"' : ''}></label>
        <label>Về <input class="input sm st-out ${sgOut ? 'st-sg' : ''}" type="time" value="${s.time_out || sgOut}" ${ed ? '' : 'disabled'} ${sgOut ? 'title="Gợi ý theo khung giờ ca — sửa theo thực tế"' : ''}></label></span>
      <input class="input sm st-reason grow" placeholder="Lý do nghỉ" aria-label="Lý do nghỉ" value="${s.absent_reason || ''}" ${worked ? 'hidden' : ''} ${ed ? '' : 'disabled'}>
      <input class="input sm st-note grow" placeholder="Ghi chú" aria-label="Ghi chú" value="${s.note || ''}" ${ed ? '' : 'disabled'}>
      ${ed && s.source !== 'lich' ? html`<button type="button" class="btn sm secondary danger pc-del" aria-label="Bỏ người hỗ trợ">×</button>` : ''}</div></div>`;
}
const hoRow = (h, ed) => html`<div class="pc-line ho-row" data-id="${h.id || ''}">
  <textarea class="input ho-text grow" rows="2" placeholder="Việc cần ca sau làm tiếp / thiết bị / vệ sinh / an toàn / sự cố" aria-label="Nội dung bàn giao" ${ed && !h.task_id ? '' : 'disabled'}>${h.content || ''}</textarea>
  ${h.done_at ? html`<span class="pill ok">Đã xong ${dt(h.done_at)}</span>` : h.task_id ? html`<span class="pill warn">Đã giao việc</span>` : ''}
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
  // Quản lý mở phiếu đã hoàn thành: mặc định xem BẢN ĐỐI SOÁT; ?ban=goc để xem phiếu nhân viên
  const RC = canRc && params.ban !== 'goc' ? await rpc('app_ca_recon', { p_id: id }).catch(() => null) : null;
  const isDs = !!RC;
  const R = isDs ? mergeRecon(R0, RC) : R0;
  const cat = await catalog().catch(() => null);
  const SH = cat ? cat.branchShifts(R.branch_id).find((x) => x.name === R.shift) || null : null;
  const ed = isDs ? !!RC.editable : !!R.can_edit;
  const edShared = isDs ? false : ed; // bàn giao, công nợ, ảnh dùng chung — chỉ sửa trên phiếu nhân viên
  const first = R.shift === R.first_shift;
  const C = calc(R);
  const prev = R.prev;

  const chip = (item) => {
    if (!done) return '';
    const c = R.checks[item];
    const label = c ? `ĐÃ ĐỐI SOÁT` : 'CHƯA ĐỐI SOÁT';
    const t = c ? `${c.by} · ${dt(c.at)}` : '';
    return R.can_recon && R0.recon_status !== 'hoan_thanh'
      ? html`<button type="button" class="rc-chip ${c ? 'on' : ''}" data-item="${item}" title="${t}" aria-pressed="${c ? 'true' : 'false'}">${c ? '✓ ' : ''}${CHECK_LABEL[item]}: ${label}</button>`
      : html`<span class="rc-chip ${c ? 'on' : ''}" title="${t}">${CHECK_LABEL[item]}: ${label}</span>`;
  };
  const sec = (title, items, inner, idAttr = '') => html`<section class="card stack pc-sec" ${idAttr ? html`id="${idAttr}"` : ''}>
    <div class="pc-sec-head"><h2>${title}</h2><div class="rc-chips">${items.map(chip)}</div></div>${inner}</section>`;

  // A. Thời gian
  const startBox = first && !isDs
    ? html`<div class="pc-fixed">06:45 ${dmy(R.work_date)} <span class="st-meta">(cố định cho ca ${R.shift})</span></div>`
    : R.forced_start && !isDs
      ? html`<div class="pc-fixed">${dt(R.forced_start)} <span class="st-meta">(= giờ kết thúc doanh thu ca ${R.first_shift})</span></div>`
      : html`<input class="input" type="datetime-local" id="rev_start" value="${toLocalInput(R.rev_start)}" ${ed ? '' : 'disabled'}>
        ${R.shift === R.second_shift && !isDs ? html`<div class="pc-hint warn">Ca ${R.first_shift} chưa hoàn thành nên tạm nhập tay. Khi ca ${R.first_shift} hoàn thành, giờ bắt đầu tự lấy theo giờ kết thúc của ca ${R.first_shift}.</div>` : ''}
        ${prev && prev.rev_end ? html`<div class="pc-hint">Ca ${prev.shift} kết thúc doanh thu lúc ${dt(prev.rev_end)}.</div>` : ''}`;
  const secTime = sec('1. Thời gian doanh thu', ['thoi_gian'], html`
    <div class="pc-grid">
      <label class="pc-f"><span>Bắt đầu doanh thu</span>${startBox}</label>
      <label class="pc-f"><span>Kết thúc doanh thu</span><input class="input" type="datetime-local" id="rev_end" value="${toLocalInput(R.rev_end)}" ${ed ? '' : 'disabled'}>
        <span class="pc-hint">Chọn giờ chốt doanh thu trên POS (không phải giờ bấm hoàn thành). Qua nửa đêm thì chọn ngày hôm sau.</span></label>
    </div>
    <div class="kv pc-meta">
      <div>Tạo phiếu</div><div>${dt(R.created_at)} · ${R.created_by_name || '—'}</div>
      <div>Hoàn thành</div><div>${R.completed_at ? html`${dt(R.completed_at)} · ${R.completed_by_name}` : 'Chưa'}</div>
      ${R.updated_by_name && ed ? html`<div>Sửa gần nhất</div><div>${dt(R.updated_at)} · ${R.updated_by_name}</div>` : ''}
    </div>`);

  // B. Doanh thu
  const prevCash = prev && prev.status === 'hoan_thanh' ? prev.cash_counted : null;
  const secMoney = sec('2. Doanh thu và tiền', ['doanh_thu'], html`
    <div class="pc-grid">
      <label class="pc-f"><span>Mục 1 · Tổng doanh thu</span>${money('total_revenue', R.total_revenue, !ed)}</label>
      <label class="pc-f"><span>Mục 2 · Doanh thu tiền mặt theo POS</span>${money('pos_cash', R.pos_cash, !ed)}</label>
      <label class="pc-f"><span>Mục 3 · Doanh thu chuyển khoản theo POS</span>${money('pos_transfer', R.pos_transfer, !ed)}</label>
      <div class="pc-f"><span>Kiểm tra Mục 1 = Mục 2 + Mục 3</span><div id="sum-check"></div></div>
      <label class="pc-f"><span>Mục 4 · Chuyển khoản thực tế (tự cộng hóa đơn trên hotline)</span>${money('reported_transfer', R.reported_transfer, !ed)}</label>
      <label class="pc-f"><span>Mục 5 · Tiền trong két thực đếm cuối ca</span>${money('cash_counted', R.cash_counted, !ed)}</label>
      <label class="pc-f"><span>Tiền mặt đầu ca</span>${first && !isDs ? html`<div class="pc-fixed">1.000.000đ <span class="st-meta">(tiền lẻ cố định ca ${R.shift})</span></div><input type="hidden" id="opening_cash" value="1000000">`
        : html`${money('opening_cash', R.opening_cash, !ed)}<span class="pc-hint">Số tiền thực nhận đầu ca, gồm cả tiền doanh thu các ca trước còn trong két.</span>`}</label>
      ${first ? '' : html`<div class="pc-f"><span>Đối chiếu với két cuối ca ${prev?.shift || 'trước'}</span><div id="open-check" data-prev="${prevCash ?? ''}"></div></div>`}
      <label class="pc-f"><span>Số cốc bán trong ca</span><input class="input" id="cups" inputmode="numeric" placeholder="0" value="${R.cups ?? ''}" ${ed ? '' : 'disabled'}></label>
    </div>`);

  // C. Chênh lệch, thu chi
  const secDiff = sec('3. Chênh lệch và chi tiết thu chi', ['tien_mat', 'chuyen_khoan', 'thu_chi'], html`
    <div class="pc-grid" id="diff-box"></div>
    ${isDs ? html`<div id="bank-box"></div>` : ''}
    <div class="pc-sub">CHI TIẾT THU CHI <span class="st-meta">— giải trình từng khoản làm tiền lệch (số âm = chi/thiếu, số dương = thu/thừa)</span></div>
    <div id="moves">${(R.moves || []).map((m) => moveRow(m, ed))}</div>
    ${ed ? html`<div><button type="button" class="btn sm secondary" id="add-move">+ Thêm dòng thu chi</button></div>` : ''}`);

  // D. Công nợ
  const secDebt = sec('4. Khách chưa thanh toán (công nợ)', ['cong_no'], html`
    <div class="alert warn" style="font-size:13px">Tạm thời chỉ ghi sổ. Cách tính công nợ vào doanh thu và đối soát đang chờ chủ hệ thống chốt, nên phiếu có công nợ <strong>không</strong> bị chặn bởi công thức Mục 1 = Mục 2 + Mục 3.</div>
    ${(R.open_debts || []).length ? html`<div class="pc-sub">NỢ TỪ CÁC CA TRƯỚC</div>${R.open_debts.map((d) => html`<div class="pc-line carried">
        <div class="grow"><strong>Bàn ${d.table_name}</strong> · ${vnd(d.amount)} <span class="st-meta">· ca ${d.from_shift} ${dmy(d.from_date)}${d.note ? ' · ' + d.note : ''}</span>
          ${d.closed_at ? html`<div class="st-meta">Đã thu: ${d.close_note || ''} · ${d.closed_by_name} ${dt(d.closed_at)}</div>` : ''}</div>
        ${edShared ? (d.closed_at ? html`<button type="button" class="btn sm secondary debt-close" data-id="${d.id}" data-undo="1">Bỏ đánh dấu</button>`
          : html`<button type="button" class="btn sm debt-close" data-id="${d.id}">Đã thu</button>`) : ''}</div>`)}` : ''}
    <div class="pc-sub">NỢ PHÁT SINH CA NÀY</div>
    <div id="debts">${(R.debts || []).map((d) => debtRow(d, edShared))}</div>
    ${edShared ? html`<div><button type="button" class="btn sm secondary" id="add-debt">+ Thêm bàn còn nợ</button></div>` : (R.debts || []).length ? '' : html`<div class="st-meta">Không có.</div>`}`);

  // E. Nhân viên
  const secStaff = sec('5. Nhân viên thực tế làm trong ca', ['nhan_su'], html`
    <div class="st-meta">Danh sách theo lịch đã xếp. Ghi nhận ở đây không sửa lịch đã xếp.</div>
    ${ed && SH && (R.staff || []).some((s) => s.source === 'lich' && (!s.time_in || !s.time_out)) ? html`<div class="st-meta" style="font-size:13px">Giờ đến/về của người theo lịch được <span class="st-sg" style="padding:0 4px;border-radius:4px">điền sẵn theo khung ca ${String(SH.start || '').slice(0, 5)}–${String(SH.end || '').slice(0, 5)}</span> để gợi ý — sửa lại theo giờ thực tế.</div>` : ''}
    <div id="staff" class="stack" style="gap:8px">${(R.staff || []).map((s) => staffRow(s, ed, SH))}</div>
    ${(R.staff || []).length ? '' : html`<div class="st-meta" id="staff-empty">Lịch chưa xếp ai cho ca này.</div>`}
    ${ed ? html`<div class="pc-line"><input class="input sm grow" id="helper" list="emp-list" placeholder="Gõ mã hoặc tên người hỗ trợ" aria-label="Người hỗ trợ"><datalist id="emp-list"></datalist>
      <button type="button" class="btn sm secondary" id="add-helper">+ Thêm người hỗ trợ</button></div>` : ''}
    <div><strong>Số người thực tế làm: <span id="staff-count"></span></strong></div>`);

  // F. Bàn giao
  const carried = R.carried || [];
  const secHand = sec('6. Nội dung bàn giao ca sau', ['ban_giao'], html`
    ${carried.length ? html`<div class="pc-sub">VIỆC CHƯA XONG TỪ CÁC CA TRƯỚC</div>${carried.map((h) => html`<div class="pc-line carried">
        <div class="grow">${h.content}<div class="st-meta">Ca ${h.from_shift} ${dmy(h.from_date)} · ${h.created_by_name || ''}${h.done_at ? ` · Xong: ${h.done_by_name} ${dt(h.done_at)}` : ''}</div></div>
        ${h.task_id ? (h.done_at ? html`<span class="pill ok">Đã xử lý</span>` : html`<span class="pill warn">Đã giao việc — chờ xử lý</span>`)
          : edShared ? (h.done_at ? html`<button type="button" class="btn sm secondary ho-done" data-id="${h.id}" data-undo="1">Bỏ đánh dấu</button>`
            : html`<button type="button" class="btn sm ho-done" data-id="${h.id}">Đã xong</button>`)
            : h.done_at ? html`<span class="pill ok">Đã xong</span>` : html`<span class="pill off">Chưa xong</span>`}</div>`)}` : ''}
    <div class="pc-sub">BÀN GIAO CỦA CA NÀY <span class="st-meta">— công việc, thiết bị, vệ sinh, an toàn, sự cố</span></div>
    <div id="handover" class="stack" style="gap:8px">${(R.handover || []).map((h) => hoRow(h, edShared))}</div>
    ${edShared ? html`<div><button type="button" class="btn sm secondary" id="add-ho">+ THÊM CÔNG VIỆC</button></div>` : (R.handover || []).length ? '' : html`<div class="st-meta">Không có.</div>`}`);

  // G. Nhập hàng
  const gs = R.goods_status || '';
  const secGoods = sec('7. Nhập hàng từ kho tổng', ['nhap_hang'], html`
    <div id="hd-box" class="stack" style="gap:10px"></div>
    <div class="seg" role="tablist"><a href="javascript:void 0" class="on" data-tab="photo" role="tab">Ảnh hàng & hóa đơn (${(R.photos || []).length})</a><a href="javascript:void 0" data-tab="report" role="tab">Báo cáo nhận hàng</a></div>
    <div data-pane="photo" class="stack" style="gap:10px">
      <div class="photos">${(R.photos || []).map((p) => html`<figure class="ph" data-path="${p.path}"><a target="_blank" rel="noopener"><img alt="Ảnh hàng nhận" loading="lazy"></a>
        ${edShared ? html`<button type="button" class="ph-del" data-id="${p.id}" aria-label="Xóa ảnh">×</button>` : ''}</figure>`)}</div>
      ${(R.photos || []).length || edShared ? '' : html`<div class="st-meta">Không có ảnh.</div>`}
      ${edShared ? html`<label class="btn sm secondary" style="align-self:flex-start">📷 Chụp / chọn ảnh<input type="file" id="photo-input" accept="image/*" multiple hidden></label><div id="photo-status" class="st-meta"></div>` : ''}
    </div>
    <div data-pane="report" class="stack" style="gap:10px" hidden>
      <div class="pc-line" role="radiogroup" aria-label="Kết quả nhận hàng">
        ${[['khong', 'Ca này không nhận hàng'], ['du', 'ĐỦ so với hóa đơn'], ['thieu', 'THIẾU so với hóa đơn']].map(([v, l]) => html`
          <label class="radio-pill"><input type="radio" name="goods" value="${v}" ${gs === v ? 'checked' : ''} ${ed ? '' : 'disabled'}> ${l}</label>`)}</div>
      <div id="goods-missing" ${gs === 'thieu' ? '' : 'hidden'}>
        <div class="pc-sub">MẶT HÀNG THIẾU</div>
        <div id="goods">${(R.goods || []).map((g) => goodRow(g, ed))}</div>
        ${ed ? html`<button type="button" class="btn sm secondary" id="add-good">+ Thêm mặt hàng thiếu</button>` : ''}</div>
      <label class="pc-f"><span>Ghi chú nhận hàng</span><textarea class="input" id="goods_note" rows="2" ${ed ? '' : 'disabled'}>${R.goods_note || ''}</textarea></label>
    </div>`);

  const nChecks = Object.keys(R.checks || {}).length; const nItems = (R.check_items || []).length;
  const head = html`<div class="page-head pc-head"><div>
      <h1>Chốt ca ${R.shift} · ${R.branch_code}</h1>
      <div class="sub">${dayName(R.work_date)} ${dmy(R.work_date)} · ${R.branch_name}</div>
      <div class="toolbar" style="gap:6px;margin-top:6px">
        <span class="pill ${STAFF_LABEL[R.status][1]}">Nhân viên: ${STAFF_LABEL[R.status][0]}</span>
        ${done ? html`<span class="pill ${R0.recon_status === 'hoan_thanh' ? 'ok' : R0.recon_status === 'mo_lai' ? 'warn' : 'off'}">${R0.recon_status === 'hoan_thanh' ? 'HOÀN THÀNH ĐỐI SOÁT' : R0.recon_status === 'mo_lai' ? `ĐANG ĐỐI SOÁT LẠI ${nChecks}/${nItems}` : `Đối soát ${nChecks}/${nItems}`}</span>` : ''}
      </div>
      ${canRc ? html`<nav class="seg pc-ban" aria-label="Chọn bản"><a href="#/ca/phieu?id=${R0.id}&ban=goc" class="${isDs ? '' : 'on'}">Phiếu nhân viên (gốc)</a><a href="#/ca/phieu?id=${R0.id}" class="${isDs ? 'on' : ''}">Bản đối soát</a></nav>` : ''}</div>
    <div class="toolbar"><a class="btn sm secondary" href="#${isManager() && done ? '/quan-ly/doi-soat' : '/ca'}?ngay=${R.work_date}">‹ Danh sách ca</a>
      <div id="saved-indicator" class="saved" role="status" hidden></div></div></div>`;

  const logRow = (l) => html`<div class="rc-log"><span class="st-meta">${dt(l.at)} · ${l.by || ''}</span> <strong>${LOG_ACTION[l.action] || l.action}</strong>${l.field ? html` ${FIELD_LABEL[l.field] || l.field}: ${showVal(l.field, l.before)} → <strong>${showVal(l.field, l.after)}</strong>` : ''}${l.reason ? html` <span class="st-meta">· Lý do: ${l.reason}</span>` : ''}</div>`;
  const dsFoot = isDs ? html`<section class="card stack" style="gap:10px">
      <h2 style="margin:0">Bản đối soát</h2>
      ${R0.recon_status === 'hoan_thanh' ? html`<div class="alert ok">HOÀN THÀNH ĐỐI SOÁT: ${R0.recon_by_name || ''} · ${dt(R0.recon_at)}. Số liệu trên đây là số chính thức của ca.</div>`
        : R0.recon_status === 'mo_lai' ? html`<div class="alert warn"><strong>ĐANG ĐỐI SOÁT LẠI</strong> — số liệu đang được sửa, chưa phải số chính thức. Sửa xong bấm “Hoàn thành đối soát lại”.</div>`
        : html`<div class="st-meta">Sửa trực tiếp trên bản này (phiếu nhân viên giữ nguyên). Ô nào khác phiếu nhân viên sẽ ghi “Phiếu NV: …”. Bấm từng hạng mục màu đỏ để xác nhận ĐÃ ĐỐI SOÁT; đủ ${nItems} hạng mục thì phiếu thành HOÀN THÀNH ĐỐI SOÁT.</div>`}
      ${ed ? html`<label class="pc-f"><span>Lý do sửa (không bắt buộc)</span><input class="input" id="rc-reason" placeholder="vd: nhân viên nhập nhầm số POS" autocomplete="off"></label>` : ''}
      <div class="toolbar" style="gap:8px">
        ${R0.recon_status === 'hoan_thanh' ? html`<button type="button" class="btn sm secondary" id="rc-reopen">Mở lại đối soát</button>` : ''}
        ${R0.recon_status === 'mo_lai' ? html`<button type="button" class="btn sm" id="rc-finish">Hoàn thành đối soát lại</button>` : ''}
        ${R0.can_reopen ? html`<button type="button" class="btn sm secondary danger" id="reopen">Mở lại phiếu cho nhân viên sửa</button>` : ''}</div>
      <details ${RC.log.length ? '' : 'hidden'}><summary style="cursor:pointer;font-weight:600">Lịch sử sửa (${RC.log.length})</summary><div class="stack" style="gap:4px;margin-top:6px">${RC.log.map(logRow)}</div></details>
    </section>` : '';

  const foot = isDs ? dsFoot : ed
    ? html`<section class="card pc-foot"><div class="st-meta">Phiếu tự động lưu. Bấm HOÀN THÀNH khi đã nhập đủ.</div><button type="button" class="btn" id="finish">HOÀN THÀNH</button></section>`
    : html`<section class="card stack" style="gap:8px">
        ${done && R.recon_status === 'hoan_thanh' ? html`<div class="alert ok">Hoàn thành đối soát: ${R.recon_by_name} · ${dt(R.recon_at)}</div>` : ''}
        ${canRc ? html`<div class="st-meta">Đây là phiếu nhân viên (bản gốc, giữ nguyên). Đối soát và sửa số liệu ở <a href="#/ca/phieu?id=${R0.id}">Bản đối soát</a>.</div>` : ''}
        ${R.can_reopen ? html`<div><button type="button" class="btn sm secondary danger" id="reopen">Mở lại phiếu cho nhân viên sửa</button></div>` : ''}</section>`;

  return {
    title: `Chốt ca ${R.shift} ${R.branch_code}`,
    html: html`${STYLE}${HD_CSS}${head}<form id="pc-form" class="stack pc" onsubmit="return false">${secTime}${secMoney}${secDiff}${secDebt}${secStaff}${secHand}${secGoods}${foot}</form>`,
    mount() { return mount(R, ed, C, { isDs, RC, R0 }); },
  };
}

// ---------------------------------------------------------------- tương tác
function collect() {
  const v = (sel) => ($(sel)?.value ?? '');
  return {
    rev_start: fromLocalInput(v('#rev_start')), rev_end: fromLocalInput(v('#rev_end')),
    total_revenue: parseMoney(v('#total_revenue')), pos_cash: parseMoney(v('#pos_cash')), pos_transfer: parseMoney(v('#pos_transfer')),
    reported_transfer: parseMoney(v('#reported_transfer')), cash_counted: parseMoney(v('#cash_counted')), opening_cash: parseMoney(v('#opening_cash')),
    cups: v('#cups').replace(/\D/g, '') === '' ? null : Number(v('#cups').replace(/\D/g, '')),
    goods_status: $('input[name=goods]:checked')?.value || null,
    goods_note: v('#goods_note').trim() || null,
    moves: $$('.mv-row').map((r) => ({ kind: r.querySelector('.mv-kind').value, amount: (parseMoney(r.querySelector('.mv-amt').value) || 0) * (r.querySelector('.mv-sign').value === '-' ? -1 : 1), note: r.querySelector('.mv-note').value.trim() })),
    staff: $$('.st-row').map((r) => ({ employee_id: Number(r.dataset.emp), source: r.dataset.src, role: r.dataset.role || null, worked: r.querySelector('.st-worked').value === '1',
      time_in: r.querySelector('.st-in').value || null, time_out: r.querySelector('.st-out').value || null, absent_reason: r.querySelector('.st-reason').value.trim() || null, note: r.querySelector('.st-note').value.trim() || null })),
    handover: $$('.ho-row').map((r) => ({ id: r.dataset.id ? Number(r.dataset.id) : null, content: r.querySelector('.ho-text').value })),
    goods: $$('.gd-row').map((r) => ({ item: r.querySelector('.gd-item').value.trim(), qty: r.querySelector('.gd-qty').value.trim() })),
    debts: $$('.db-row').filter((r) => !r.querySelector('.db-table').disabled || r.dataset.id).map((r) => ({ id: r.dataset.id ? Number(r.dataset.id) : null, table_name: r.querySelector('.db-table').value, amount: parseMoney(r.querySelector('.db-amt').value), note: r.querySelector('.db-note').value.trim() })),
  };
}

function mount(R, ed, C0, ctx = {}) {
  const { isDs, RC, R0 } = ctx;
  let saveNow = null;
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

  const recalc = () => {
    const v = ed ? collect() : R;
    const c = calc(v);
    const debts = ed ? collect().debts.length : (R.debts || []).length;
    const sc = $('#sum-check');
    if (sc) {
      sc.innerHTML = str(c.sumGap === null ? html`<span class="pill mute">Nhập đủ Mục 1, 2, 3</span>`
        : debts ? html`<span class="pill warn">Có công nợ — chưa áp dụng công thức (chờ chốt)</span>${c.sumGap ? html` <span class="st-meta">lệch ${signed(c.sumGap)}</span>` : ''}`
        : c.sumGap === 0 ? html`<span class="pill ok">Khớp</span>`
        : html`<span class="pill off">Lệch ${signed(c.sumGap)} — phải sửa trước khi hoàn thành</span>`);
    }
    const oc = $('#open-check');
    if (oc) {
      const pv = oc.dataset.prev === '' ? null : Number(oc.dataset.prev);
      const op = v.opening_cash === null || v.opening_cash === undefined ? null : Number(v.opening_cash);
      oc.innerHTML = str(pv === null ? html`<span class="pill mute">Ca trước chưa chốt — chưa có số liệu để đối chiếu</span>`
        : op === null ? html`<span class="st-meta">Két cuối ca trước: ${vnd(pv)}</span>`
        : op === pv ? html`<span class="pill ok">Khớp két cuối ca trước (${vnd(pv)})</span>`
        : html`<span class="pill off">${op < pv ? 'THIẾU' : 'THỪA'} ${fmt(Math.abs(op - pv))}đ so với két cuối ca trước (${vnd(pv)}) — hãy kiểm tra</span>`);
    }
    const box = (label, init, moves, left, formula) => html`<div class="diff-card"><div class="pc-sub" style="margin:0">${label}</div>
      <div class="kv"><div>Chênh lệch ban đầu</div><div>${init === null ? '—' : signed(init)} <span class="st-meta">${formula}</span></div>
        <div>Đã kê khai thu chi</div><div>${signed(moves)}</div>
        <div><strong>Chưa giải trình</strong></div><div><strong>${left === null ? '—' : signed(left)}</strong></div>
        <div>Kết quả</div><div>${result(left)}</div></div></div>`;
    const db = $('#diff-box');
    if (db) db.innerHTML = str(html`${box('TIỀN MẶT', c.tmDiff, c.tmMoves, c.tmLeft, '(Mục 5 − đầu ca − Mục 2)')}${box('CHUYỂN KHOẢN', c.ckDiff, c.ckMoves, c.ckLeft, '(Mục 4 − Mục 3)')}`);
    const sc2 = $('#staff-count');
    if (sc2) sc2.textContent = new Set($$('.st-row').filter((r) => r.querySelector('.st-worked').value === '1').map((r) => r.dataset.emp)).size;
    $('#goods-missing') && ($('#goods-missing').hidden = (ed ? collect().goods_status : R.goods_status) !== 'thieu');
  };
  recalc();

  // ---------- Hóa đơn kế toán gửi (nhân viên báo nhận khi phiếu đang chốt)
  const canRecv = !isDs && !!(R0 || R).can_edit;
  const hdCard = (i) => html`<div class="hd-card ${i.status === 'chua_nhan' ? 'todo' : ''}" data-id="${i.id}">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>Hóa đơn kế toán gửi · ngày ${dmy(i.work_date)}</strong><span class="pill ${HD_STATUS[i.status][1]}">${HD_STATUS[i.status][0]}</span></div>
    ${i.note ? html`<div style="font-size:14px">${i.note}</div>` : ''}
    <div>${fileLinks(i.files, false)}</div>
    <div class="pc-sub" style="margin:0">ẢNH HÀNG THỰC NHẬN (${i.photos.length})</div>
    ${photoThumbs(i.photos, canRecv)}
    ${canRecv ? html`<label class="btn sm secondary" style="align-self:flex-start">📷 Chụp / chọn ảnh hàng<input type="file" class="hd-ph-in" accept="image/*" multiple hidden></label><span class="st-meta hd-ph-st"></span>
      <div class="pc-line" role="radiogroup" aria-label="Kết quả nhận hàng">
        ${[['du', 'ĐỦ so với hóa đơn'], ['thieu', 'THIẾU so với hóa đơn']].map(([v, l]) => html`<label class="radio-pill"><input type="radio" name="hd-res-${i.id}" value="${v}" ${i.result === v ? 'checked' : ''}> ${l}</label>`)}</div>
      <div class="hd-miss" ${i.result === 'thieu' ? '' : 'hidden'}><div class="pc-sub">MẶT HÀNG THIẾU</div>
        <div class="hd-items">${(i.items.length ? i.items : [{}]).map((x) => html`<div class="pc-line hd-it"><input class="input sm grow hd-it-name" placeholder="Mặt hàng" value="${x.item || ''}"><input class="input sm hd-it-qty" placeholder="Số lượng thiếu" value="${x.qty || ''}" style="width:140px"></div>`)}</div>
        <button type="button" class="btn sm secondary hd-it-add">+ Thêm mặt hàng thiếu</button></div>
      <input class="input sm hd-note" placeholder="Ghi chú nhận hàng (không bắt buộc)" value="${i.receive_note || ''}">
      <div><button type="button" class="btn sm hd-send">${i.status === 'chua_nhan' ? 'Gửi báo cáo nhận hàng' : 'Cập nhật báo cáo nhận hàng'}</button></div>` : ''}
    ${i.status !== 'chua_nhan' ? receiptText(i) : ''}</div>`;
  const loadHd = async () => {
    const box = $('#hd-box'); if (!box) return;
    let list = [];
    try { list = await rpc('app_hd_for_report', { p_report: R.id }); } catch (_) { return; }
    box.innerHTML = list.length ? str(html`<div class="pc-sub" style="margin:0">HÓA ĐƠN KẾ TOÁN GỬI (${list.length})</div>${list.map(hdCard)}<div class="pc-sub" style="margin:4px 0 0">TỰ GHI NHẬN NHẬP HÀNG CỦA CA</div>`) : '';
    signLinks(box);
    box.querySelectorAll('.hd-card').forEach((c) => {
      const id = Number(c.dataset.id);
      c.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { c.querySelector('.hd-miss').hidden = r.value !== 'thieu' || !r.checked; }));
      c.querySelector('.hd-it-add')?.addEventListener('click', () => c.querySelector('.hd-items').insertAdjacentHTML('beforeend', '<div class="pc-line hd-it"><input class="input sm grow hd-it-name" placeholder="Mặt hàng"><input class="input sm hd-it-qty" placeholder="Số lượng thiếu" style="width:140px"></div>'));
      c.querySelector('.hd-ph-in')?.addEventListener('change', async (ev) => {
        try { await uploadFiles('nhan' + id, [...ev.target.files], (path) => rpc('app_hd_photo_add', { p_invoice: id, p_path: path }), c.querySelector('.hd-ph-st')); loadHd(); }
        catch (e) { showSaved('Không tải được ảnh: ' + e.message, true); }
      });
      c.querySelectorAll('.hd-pdel').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('Xóa ảnh này?')) return;
        try { const path = await rpc('app_hd_photo_del', { p_photo: Number(b.dataset.id) }); if (path) await sb.storage.from(HD_BUCKET).remove([path]); loadHd(); } catch (e) { showSaved(e.message, true); }
      }));
      c.querySelector('.hd-send')?.addEventListener('click', async () => {
        const res = c.querySelector('input[type=radio]:checked')?.value;
        if (!res) { showSaved('Chọn ĐỦ hoặc THIẾU.', true); return; }
        const items = [...c.querySelectorAll('.hd-it')].map((x) => ({ item: x.querySelector('.hd-it-name').value.trim(), qty: x.querySelector('.hd-it-qty').value.trim() })).filter((x) => x.item);
        try { await rpc('app_hd_receive', { p_invoice: id, p_report: R.id, p_result: res, p_note: c.querySelector('.hd-note').value, p_items: items }); showSaved('Đã gửi báo cáo nhận hàng · ' + hhmm()); loadHd(); }
        catch (e) { showSaved(e.message, true); }
      });
    });
  };
  loadHd();
  // ---------- Bản đối soát: chuyển khoản thực nhận do kế toán nhập
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
    $$('.rc-chip[data-item]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await rpc('app_ca_check', { p_id: R.id, p_item: b.dataset.item, p_on: !b.classList.contains('on') }); rerender(); }
      catch (e) { b.disabled = false; showSaved(e.message, true); }
    }));
  }
  $('#rc-reopen')?.addEventListener('click', async () => {
    const why = prompt('Mở lại đối soát để sửa? Phiếu sẽ ở trạng thái ĐANG ĐỐI SOÁT LẠI cho tới khi bấm hoàn thành lại.\nLý do (không bắt buộc):', '');
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
  saveNow = async () => {
    clearTimeout(timer);
    if (saving) { await saving; if (!dirty) return; }
    if (!dirty) return;
    dirty = false;
    const hoRows = $$('.ho-row'); const dbRows = $$('.db-row').filter((r) => !r.querySelector('.db-table').disabled || r.dataset.id);
    const payload = collect();
    const call = isDs ? rpc('app_ca_recon_save', { p_id: R.id, p: payload, p_reason: $('#rc-reason')?.value || null }) : rpc('app_ca_save', { p_id: R.id, p: payload });
    saving = call.then((res) => {
      if (!isDs) {
        (res.handover_ids || []).forEach((nid, i) => { if (nid && hoRows[i]) hoRows[i].dataset.id = nid; });
        (res.debt_ids || []).forEach((nid, i) => { if (nid && dbRows[i]) dbRows[i].dataset.id = nid; });
      }
      showSaved((isDs ? 'Đã lưu bản đối soát · ' : 'Đã lưu · ') + hhmm());
    }).catch((e) => { dirty = true; showSaved('Chưa lưu được: ' + e.message, true); throw e; }).finally(() => { saving = null; });
    return saving;
  };
  const changed = () => { dirty = true; recalc(); clearTimeout(timer); timer = setTimeout(() => saveNow().catch(() => {}), 1200); };
  form.addEventListener('input', changed);
  form.addEventListener('change', (ev) => {
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
    add('#staff', staffRow({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank, source: 'ho_tro', worked: 1 }, true), '.st-in');
    $('#helper').value = '';
  });

  // việc bàn giao / nợ từ ca trước
  $$('.ho-done').forEach((b) => b.addEventListener('click', async () => {
    try { await saveNow(); await rpc('app_ca_handover_done', { p_item: Number(b.dataset.id), p_report: R.id, p_done: !b.dataset.undo }); rerender(); }
    catch (e) { showSaved(e.message, true); }
  }));
  $$('.debt-close').forEach((b) => b.addEventListener('click', async () => {
    let note = null;
    if (!b.dataset.undo) { note = prompt('Ghi chú thu nợ (vd: khách trả tiền mặt 50.000đ lúc 15:00):'); if (note === null) return; }
    try { await saveNow(); await rpc('app_ca_debt_close', { p_debt: Number(b.dataset.id), p_report: R.id, p_note: b.dataset.undo ? null : (note.trim() || 'Đã thu') }); rerender(); }
    catch (e) { showSaved(e.message, true); }
  }));

  // ảnh
  $('#photo-input')?.addEventListener('change', async (ev) => {
    const files = [...ev.target.files]; if (!files.length) return;
    const st = $('#photo-status');
    try {
      await saveNow();
      for (let i = 0; i < files.length; i++) {
        st.textContent = `Đang tải ảnh ${i + 1}/${files.length}…`;
        const blob = await compressImage(files[i]);
        const path = `r${R.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw new Error(error.message);
        await rpc('app_ca_photo_add', { p_id: R.id, p_path: path });
      }
      rerender();
    } catch (e) { st.textContent = ''; showSaved('Không tải được ảnh: ' + e.message, true); }
  });
  $$('.ph-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Xóa ảnh này?')) return;
    try { await saveNow(); const path = await rpc('app_ca_photo_del', { p_photo: Number(b.dataset.id) }); if (path) await sb.storage.from(BUCKET).remove([path]); rerender(); }
    catch (e) { showSaved(e.message, true); }
  }));

  // HOÀN THÀNH: lưu → bảng xác nhận → app_ca_complete
  $('#finish')?.addEventListener('click', async () => {
    dirty = true;
    try { await saveNow(); } catch (_) { return; }
    const v = collect(); const c = calc(v);
    const total = (c.tmLeft || 0) + (c.ckLeft || 0);
    const question = c.tmLeft === null || c.ckLeft === null ? 'Chưa đủ số liệu tiền.'
      : total < 0 ? `Bạn có xác nhận tiền âm của ca này là ${signed(total)} không?`
      : total > 0 ? `Bạn có xác nhận tiền thừa của ca này là ${signed(total)} không?`
      : (c.tmLeft || c.ckLeft) ? 'Tổng bằng 0 nhưng tiền mặt và chuyển khoản đang lệch bù nhau. Bạn có xác nhận không?'
      : 'Tiền của ca khớp. Bạn có xác nhận hoàn thành không?';
    const startTxt = $('#rev_start') ? dt(v.rev_start) : $('.pc-fixed')?.textContent.trim().slice(0, 17);
    const d = dialog(html`<div class="stack" style="gap:10px;max-width:520px">
      <h2 style="margin:0">Xác nhận hoàn thành chốt ca ${R.shift}</h2>
      <div class="kv">
        <div>Doanh thu từ</div><div>${startTxt || '—'} → ${dt(v.rev_end)}</div>
        <div>Mục 1 Tổng doanh thu</div><div>${vnd(v.total_revenue)}</div>
        <div>Mục 2 Tiền mặt POS</div><div>${vnd(v.pos_cash)}</div>
        <div>Mục 3 Chuyển khoản POS</div><div>${vnd(v.pos_transfer)}</div>
        <div>Mục 4 Chuyển khoản thực tế</div><div>${vnd(v.reported_transfer)}</div>
        <div>Mục 5 Tiền trong két</div><div>${vnd(v.cash_counted)}</div>
        <div>Tiền mặt đầu ca</div><div>${vnd(v.opening_cash)}</div>
        <div>Số cốc</div><div>${v.cups ?? '—'}</div>
        <div>Số người thực tế làm</div><div>${$('#staff-count')?.textContent}</div>
        <div>Chênh lệch ban đầu</div><div>TM ${signed(c.tmDiff)} · CK ${signed(c.ckDiff)}</div>
      </div>
      ${v.moves.length ? html`<div><strong>Thu chi đã kê khai:</strong>${v.moves.map((m) => html`<div class="st-meta">${m.kind === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'} ${signed(m.amount)} — ${m.note}</div>`)}</div>` : ''}
      <div class="kv"><div>Chưa giải trình TM</div><div>${result(c.tmLeft)}</div><div>Chưa giải trình CK</div><div>${result(c.ckLeft)}</div>
        <div><strong>Tổng còn lại</strong></div><div><strong>${signed(total)}</strong></div></div>
      <div class="alert ${total < 0 ? 'error' : total > 0 ? 'warn' : 'ok'}" style="font-weight:600">${question}</div>
      <div id="finish-err"></div>
      <div class="toolbar" style="justify-content:flex-end">
        <button type="button" class="btn secondary" id="back">QUAY LẠI CHỈNH SỬA</button>
        <button type="button" class="btn" id="confirm-finish">XÁC NHẬN HOÀN THÀNH</button></div></div>`);
    d.querySelector('#back').addEventListener('click', () => d.close());
    d.querySelector('#confirm-finish').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await rpc('app_ca_complete', { p_id: R.id }); d.close(); flash(`Đã hoàn thành chốt ca ${R.shift}.`); rerender(); }
      catch (err) { e.target.disabled = false; d.querySelector('#finish-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
    });
  });

  return () => { if (dirty) saveNow().catch(() => {}); };
}

const STYLE = html`<style>
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
  .pc-line.carried { padding: 8px 10px; background: #f7f8fb; border-radius: 10px; }
  .mv-row, .db-row, .gd-row { padding: 6px 0; border-bottom: 1px dashed var(--line-soft); }
  .mv-row .mv-amt, .db-row .db-amt { width: 140px; }
  .st-row { border: 1px solid var(--line-soft); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .st-head { display: flex; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
  .st-times { display: inline-flex; gap: 8px; }
  .st-times label { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; }
  .st-times input { width: 110px; }
  .diff-card { border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .rc-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .rc-chip { font: inherit; font-size: 12px; font-weight: 700; padding: 5px 9px; border-radius: 8px; border: 1px solid #fca5a5; background: #fef2f2; color: #b91c1c; }
  .rc-chip.on { border-color: #86efac; background: #dcfce7; color: #166534; }
  button.rc-chip { cursor: pointer; }
  .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .ph { position: relative; margin: 0; aspect-ratio: 1; background: var(--line-soft); border-radius: 10px; overflow: hidden; }
  .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ph-del { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(0,0,0,.6); color: #fff; font-size: 16px; cursor: pointer; }
  .radio-pill { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; font-size: 14px; cursor: pointer; }
  .radio-pill:has(input:checked) { border-color: var(--primary); background: #eff6ff; font-weight: 600; }
  .pc-foot { position: sticky; bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; box-shadow: 0 4px 16px rgba(0,0,0,.1); padding: 12px 16px; }
  .pc-foot .btn { min-width: 180px; }
  @media (max-width: 760px) { .pc-foot { padding: 8px 10px; bottom: 6px; } .pc-foot .st-meta { display: none; } .pc-foot .btn { width: 100%; min-height: 44px; } }
  .mobile .pc-foot { bottom: 58px; }
  dialog { max-width: calc(100vw - 24px); }
</style>`;
