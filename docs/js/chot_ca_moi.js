// Bước 41 — Chốt ca mới (anh Tiến chốt 12/11/2026): 1 người chốt chính, gõ số theo đúng thứ tự trên phiếu Fabi,
// web tự kiểm tra từng bước; người khác trong ca chỉ giúp phần nhận hàng. Máy chủ kiểm tra lại khi GỬI (app__ca_part_check).
import { render as rerender, can } from './app.js';
import { CV_CSS, mountCover } from './nghi_thay.js?v=2026.11.19';
import { rpc, sb } from './sb.js';
import { bindMoneyInputs, compressImage, dmy, dt, fmt, noKind, noName, parseMoney, signed, traNoFabi } from './tien.js';
import { $, $$, dialog, flash, html, raw, showSaved, str } from './ui.js';

import { SHIFT_CSS, shiftFabiFields, shiftMoneyTable, collapseMoves, expandMoves, newExchangeKey, periodError, kindSeg, oneSeg, bindKindSeg, EXCH_LABEL, EXCH_DIRS, exchSigns, debtWhoSel } from './ca_chung.js?v=2026.11.19';

const BUCKET = 'phieu-ca';
const GOI_DAU = 1000000;
// Nội dung từng bước theo mã (B[mã], stepError); thứ tự hiện ra theo ORDER — ghi hết các khoản tiền (Thu chi) TRƯỚC khi đối chiếu
// chuyển khoản hotline, để không phải lùi lại khi thu chi / khách trả tiền mượn bằng chuyển khoản làm lệch (anh Tiến chốt 12/11/2026)
const LABEL = ['Nhận chốt ca', 'Ai làm ca', 'Phiếu Fabi', 'Khách nợ trong ca', 'Chuyển khoản hotline', 'Thu chi trong ca', 'Số cốc', 'Kết quả tiền', 'Bàn giao', 'Kết quả tiền & gửi phiếu'];
// Bước 77 (anh Tiến chốt 13/11): phiếu chia 2 phần — ① PHẦN VIỆC (Ai làm ca · Số cốc · Bàn giao & nhận hàng) làm trước,
// ② PHẦN TIỀN (Fabi · Khách nợ · Thu chi · Chuyển khoản · Kết quả tiền · Kiểm tra) mở khi xong phần việc. Nhận hàng không chặn phần tiền.
const ORDER_ALL = [0, 1, 6, 8, 2, 3, 5, 4, 9];   // bước 84: gộp Kết quả tiền (7) vào bước cuối (9)   // cơ sở dùng Fabi bỏ bước Số cốc (mã 6) — số cốc lấy theo file Fabi (bước 49)
const VIEC = [1, 8]; const TIEN = [11, 12];
const hm = (x) => (x ? String(x).slice(0, 5) : '');
const sum = (a, f) => (a || []).reduce((s, x) => s + (Number(f(x)) || 0), 0);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// Ghép giờ trên phiếu với ngày làm việc (qua nửa đêm → ngày hôm sau)
function toDT(date, time) {
  if (!time) return null;
  if (time >= '05:00') return `${date} ${time}`;
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)} ${time}`;
}

export async function renderNew(R0, P, SH) {
  const R = R0;
  const managerClose = can('doi_soat');
  // bước 134: 3 câu không phụ thuộc nhau → hỏi cùng lúc (trước: lần lượt)
  const [KTS, categories, debtPeople] = await Promise.all([
    rpc('app_ca_kt_state', { p_id: R0.id }).then((x) => ({ x }), () => null),   // lỗi = chưa có bước 44 → coi như cần Fabi
    managerClose ? rpc('app_fin_types') : [],
    rpc('app_ca_debt_people', { p_branch: R0.branch_id }).catch(() => []),   // bước 133: menu Người nợ
  ]);
  const fabiBranch = KTS ? !!KTS.x?.need : true;
  const ORDER = [0, 1, 8, 11, 12];
  LABEL[11] = 'Tiền'; LABEL[12] = 'Kiểm tra';
  const STEPS = ORDER.map((k) => LABEL[k]);
  const firstTien = ORDER.findIndex((k) => TIEN.includes(k)); const lastViec = firstTien - 1;
  const partOf = (i) => (VIEC.includes(ORDER[i]) ? 'viec' : TIEN.includes(ORDER[i]) ? 'tien' : '');
  const PT = Object.fromEntries((P.parts || []).map((p) => [p.part, p]));
  const first = R.shift === R.first_shift;
  const hand = R.cash_hand || null;
  const key = 'cm:' + R.id;
  let mem = {}; try { mem = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (_) { /* bỏ qua */ }
  const tienMine = !!PT.tien?.mine; const tienOther = PT.tien?.claimed_by && !PT.tien?.mine;
  const waiting = tienMine && PT.tien?.done_at;   // đã gửi, còn chờ phần nhận hàng của người khác

  // Dữ liệu đang sửa
  const V = {
    step: tienMine && !waiting ? Math.min(STEPS.length - 1, Math.max(1, Number(mem.step) || 1)) : 0,
    staff: (R.staff || []).map((s) => ({ ...s, worked: s.worked === undefined ? true : !!s.worked,
      // bước 74: gợi ý giờ theo LỊCH TUẦN của từng người (ca đã xếp, vd FULL TIME); người không có lịch ca này để trống
      time_in: s.time_in || (s.source === 'lich' ? (s.sched?.start ? hm(s.sched.start) : SH ? hm(SH.start) : null) : null),
      time_out: s.time_out || (s.source === 'lich' ? (s.sched?.end ? hm(s.sched.end) : SH ? hm(SH.end) : null) : null) })),
    open: (R.forced_start || R.rev_start || (first ? R.work_date + ' 06:45' : '')).replace(' ', 'T').slice(0, 16), close: (R.rev_end || '').replace(' ', 'T').slice(0, 16), checked: false,
    f: { ipos_opening: num(R.ipos_opening), total_revenue: num(R.total_revenue), pos_transfer: num(R.pos_transfer), pos_cash: num(R.pos_cash),
      pos_debt: num(R.pos_debt), cash_counted: num(R.cash_counted), pos_diff: num(R.pos_diff) },
    sign: Number(R.pos_diff) < 0 ? -1 : 1,
    opening_note: R.opening_note || '', debts: (R.debts || []).map((d) => ({ ...d })), reported_transfer: num(R.reported_transfer), transfer_note: R.transfer_note || '',
    moves: collapseMoves(R.moves || []).map((m, i) => { const saved = mem.categories?.[i]; return {...m, category: saved && saved.kind === m.kind && saved.amount === m.amount && saved.note === m.note ? saved.category : undefined}; }), noMoves: !!mem.noMoves, cups: num(R.cups), diff_note: R.diff_note || '',
    handover: (R.handover || []).map((h) => ({ ...h })), tried: false, gaps: {},
  };
  const photos = (R.photos || []).filter((p) => p.kind === 'ipos');
  // bước 77: phần việc xong (đã bấm "Xong phần việc", hoặc phiếu đã có số tiền) thì mới mở phần tiền
  V.viecDone = !!mem.viecDone || V.f.ipos_opening !== null || photos.length > 0;
  if (tienMine && !waiting && mem.code != null && ORDER.includes(Number(mem.code))) V.step = ORDER.indexOf(Number(mem.code));
  const HP = { tab: '', q: '' }; let HELP = null;   // bước 48: chọn người làm hộ — mục đang mở, chữ lọc, danh sách nhân viên
  const billSum = () => sum(V.debts.filter(isBill), (d) => d.amount);
  const prevCash = hand && hand.prev_cash !== null && hand.prev_cash !== undefined ? Number(hand.prev_cash) : null;
  const expStart = first ? { v: GOI_DAU, src: 'tiền gối đầu ca sáng' } : prevCash !== null ? { v: prevCash, src: `Tổng tiền ca ${hand.prev_shift} để lại` } : null;
  // khoản khách nợ: kind 'bill' (Nợ trên Fabi) hoặc 'muon' (bước 43: khách mượn tiền quán, ghi ở bước Thu chi)
  // bước 84: thêm Nợ CK (kind 'ck') — Fabi ghi chuyển khoản nhưng khách chưa chuyển → trừ khỏi tiền phải nhận trên hotline
  const isLoan = (d) => d.kind === 'muon'; const isCK = (d) => d.kind === 'ck'; const isBill = (d) => !d.kind || d.kind === 'bill';
  const col = (k, billOnly) => sum((R.open_debts || []).filter((d) => d.closed_report_id === R.id && d.collect_kind === k && (!billOnly || isBill(d))), (d) => d.amount);

  function money() {
    const f = V.f; const colTM = col('tien_mat'); const colTMbill = col('tien_mat', true); const colTMloan = colTM - colTMbill; const colCK = col('chuyen_khoan');
    const colTMfab = traNoFabi(R.work_date) ? colTMbill : 0;   // bước 96: từ 15/11 Fabi không cộng khách trả nợ → không trừ ra
    const loanOut = sum(V.debts.filter(isLoan), (d) => d.amount); const ckOut = sum(V.debts.filter(isCK), (d) => d.amount);
    const sal = sum(V.staff.filter((s) => s.worked && s.pay_cash), (s) => parseMoney(s.cash_paid) || 0);
    const mvTM = sum(expandMoves(V.moves).filter((m) => m.kind === 'tien_mat'), (m) => m.amount); const mvCK = sum(expandMoves(V.moves).filter((m) => m.kind === 'chuyen_khoan'), (m) => m.amount);
    const op = first ? GOI_DAU : f.ipos_opening;
    const ok = (...k) => k.every((x) => f[x] !== null);
    return {
      colTM, colTMbill, colTMfab, colTMloan, loanOut, ckOut, colCK, sal, mvTM, mvCK,
      sumGap: ok('total_revenue', 'pos_cash', 'pos_transfer', 'pos_debt') ? f.pos_cash + f.pos_transfer + f.pos_debt - f.total_revenue : null,
      diffGap: ok('cash_counted', 'ipos_opening', 'pos_cash', 'pos_diff') ? f.cash_counted - f.ipos_opening - f.pos_cash - colTMfab - f.pos_diff : null,
      tmLeft: ok('cash_counted', 'ipos_opening', 'pos_cash') ? f.cash_counted - op - f.pos_cash - (mvTM - sal - loanOut) - colTM : null,
      ckExp: (f.pos_transfer || 0) + mvCK + colCK - ckOut,
      ckLeft: V.reported_transfer === null || f.pos_transfer === null ? null : V.reported_transfer - f.pos_transfer - mvCK - colCK + ckOut,
      // bước 45: ca chiều / tối mở với tiền gối đầu 1.000.000 → phần dư ca trước để lại là "nộp quỹ khi giao ca" (không phải lệch)
      rutQuy: !first && prevCash !== null && f.ipos_opening === GOI_DAU && prevCash > GOI_DAU ? prevCash - GOI_DAU : 0,
      startBad: expStart && f.ipos_opening !== null && f.ipos_opening !== expStart.v && !(!first && prevCash !== null && f.ipos_opening === GOI_DAU && prevCash > GOI_DAU),
    };
  }

  function payload() {
    return {
      rev_start: R.forced_start || V.open.replace('T', ' '), rev_end: V.close.replace('T', ' '),
      total_revenue: V.f.total_revenue, pos_cash: V.f.pos_cash, pos_transfer: V.f.pos_transfer, cash_counted: V.f.cash_counted,
      ipos_opening: V.f.ipos_opening, opening_cash: V.f.ipos_opening, pos_debt: V.f.pos_debt, pos_diff: V.f.pos_diff,
      opening_note: V.opening_note.trim() || null, reported_transfer: V.reported_transfer, transfer_note: V.transfer_note.trim() || null,
      cups: V.cups, diff_note: V.diff_note.trim() || null,
      moves: expandMoves(V.moves).map((m) => ({ ...m, note: m.note.trim() })),
      staff: V.staff.map((s) => ({ employee_id: s.employee_id, source: s.source, role: s.role || null, worked: !!s.worked, time_in: s.worked ? s.time_in || null : null,
        time_out: s.worked ? s.time_out || null : null, absent_reason: s.worked ? null : (s.absent_reason || '').trim() || null, note: s.note || null, cash_paid: s.pay_cash && s.worked ? parseMoney(s.cash_paid) : null })),
      handover: V.handover.filter((h) => !h.task_id).map((h) => ({ id: h.id || null, content: h.content || '' })),
      debts: V.debts.map((d) => ({ id: d.id || null, table_name: d.table_name || '', amount: d.amount, note: d.note || '', kind: d.kind || 'bill', grp: d.grp || 'khach' })),
      goods: (R.goods || []).map((g) => ({ item: g.item, qty: g.qty })), goods_status: R.goods_status || null, goods_note: R.goods_note || null,
    };
  }
  async function save() {
    if (!tienMine || waiting) return;
    const r = await rpc('app_ca_save', { p_id: R.id, p: payload() });
    if (r.skipped) throw new Error('Bạn không còn nhận phần chốt ca này. Tải lại trang để kiểm tra.');
    const ho = V.handover.filter((h) => !h.task_id); (r.handover_ids || []).forEach((id, i) => { if (ho[i] && id) ho[i].id = id; });
    (r.debt_ids || []).forEach((id, i) => { if (V.debts[i] && id) V.debts[i].id = id; });
    try { sessionStorage.setItem(key, JSON.stringify({ step: V.step, noMoves: V.noMoves, viecDone: V.viecDone, categories: V.moves.map(({kind, amount, note, category}) => ({kind, amount, note, category})) })); } catch (_) { /* bỏ qua */ }
  }

  // ------------------------------------------------------------ các bước
  const moneyIn = (k, val, label) => html`<input class="input money cm-num" data-f="${k}" inputmode="numeric" autocomplete="off" placeholder="0" value="${val === null ? '' : fmt(Math.abs(val))}" aria-label="${label}">`;
  // Khách trả nợ cũ (bill nợ Fabi của ca trước) — chọn được ngay ở bước Phiếu Fabi vì Fabi đã cộng tiền trả nợ vào tiền phải có
  // bước 70: khách nợ quản lý ghi (tên, SĐT), số ngày nợ, trả một phần (ô số tiền)
  const dDays = (x) => { const n = Math.max(0, Math.round((Date.parse(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)) - Date.parse(x)) / 864e5)); return n ? `${n} ngày` : 'hôm nay'; };
  const debtPayRow = (d) => html`<div class="cm-person"><div><strong>${noName(d)}</strong>${d.phone ? ` · ${d.phone}` : ''} · ${fmt(d.amount)}đ <span class="st-meta">· ${d.by_ql ? `quản lý ghi ${dmy(d.from_date)}` : `ca ${d.from_shift} ${dmy(d.from_date)}`}${d.closed_at ? '' : ` · ${dDays(d.from_date)}`}${d.note ? ' · ' + d.note : ''}</span></div>
            ${d.closed_at && d.closed_report_id !== R.id ? html`<span class="pill ok">Đã thu ở ca khác</span>`
              : html`<span class="cm-pay">${d.closed_at ? '' : html`<input class="input sm money cm-paidamt" data-paidamt="${d.id}" inputmode="numeric" autocomplete="off" value="${fmt(d.amount)}" aria-label="Số tiền khách trả" title="Trả thiếu thì sửa số này — phần còn lại vẫn nhắc ở ca sau">`}<select class="input sm" data-paid="${d.id}" aria-label="Khách ${d.table_name} trả chưa"><option value="">Chưa trả</option>
                <option value="tien_mat" ${d.closed_at && d.collect_kind === 'tien_mat' ? 'selected' : ''}>Trả bằng tiền mặt</option><option value="chuyen_khoan" ${d.closed_at && d.collect_kind === 'chuyen_khoan' ? 'selected' : ''}>Trả bằng chuyển khoản</option></select></span>`}</div>`;
  // bước 113: khách đã trả nợ trong ca — 1 dòng như Thu / Chi, đứng đầu danh sách
  const paidRow = (d) => html`<div class="sc-row cm-paid"><span class="sc-kt"><b>Thu nợ</b>${oneSeg([['tien_mat', 'TM'], ['chuyen_khoan', 'CK']], d.collect_kind, false, 'Khách trả bằng')}<select data-paid="${d.id}" hidden aria-hidden="true"><option value="">Chưa trả</option><option value="tien_mat" ${d.collect_kind === 'tien_mat' ? 'selected' : ''}>TM</option><option value="chuyen_khoan" ${d.collect_kind === 'chuyen_khoan' ? 'selected' : ''}>CK</option></select></span>
    <input class="input money" value="${fmt(d.amount)}" disabled aria-label="Số tiền khách trả"><button type="button" class="btn secondary danger" data-unpay="${d.id}" aria-label="Bỏ khoản thu nợ">×</button>
    <span class="sc-full st-meta">${noName(d)} · ${d.by_ql ? `quản lý ghi ${dmy(d.from_date)}` : `nợ ca ${d.from_shift} ${dmy(d.from_date)}`}${d.note ? ' · ' + d.note : ''}</span></div>`;
  const oldBills = () => (R.open_debts || []).filter((d) => isBill(d) && !(d.closed_at && d.closed_report_id !== R.id));
  // bước 75: anh chốt "nhắc chung nợ + mượn" — danh sách khách trả ở bước Phiếu Fabi hiện cả khách mượn tiền két
  const oldAll = () => (R.open_debts || []).filter((d) => !(d.closed_at && d.closed_report_id !== R.id));
  function fabiChecks() {
    const c = money(); const out = []; let bad = false;
    if (V.f.ipos_opening !== null && expStart) {
      out.push(c.startBad ? html`<div>🔴 Số dư đầu <b>${fmt(V.f.ipos_opening)}</b> khác ${expStart.src} (<b>${fmt(expStart.v)}</b>), lệch <b>${signed(V.f.ipos_opening - expStart.v)}</b> — quản lý sẽ kiểm tra khi đối soát</div>`
        : c.rutQuy ? html`<div>✅ Số dư đầu <b>${fmt(GOI_DAU)}</b> (tiền gối đầu) — phần dư <b>${fmt(c.rutQuy)}</b> của ${expStart.src.toLowerCase()} tính là <b>nộp quỹ khi giao ca</b></div>`
        : html`<div>✅ Số dư đầu đúng bằng ${expStart.src} (<b>${fmt(expStart.v)}</b>)</div>`);
    } else if (V.f.ipos_opening !== null && hand && hand.state === 'cho_ca_truoc') out.push(html`<div>⏳ Ca ${hand.prev_shift} chưa gửi phiếu nên chưa so được số dư đầu — web sẽ so khi ca ${hand.prev_shift} gửi.</div>`);
    if (c.sumGap !== null) {
      if (c.sumGap === 0) out.push(html`<div>✅ Chuyển khoản + Tiền mặt + Nợ = <b>${fmt(V.f.total_revenue)}</b> = Doanh thu NET</div>`);
      else { bad = true; out.push(html`<div>🔴 Chuyển khoản + Tiền mặt + Nợ = <b>${fmt(V.f.total_revenue + c.sumGap)}</b>, khác Doanh thu NET <b>${fmt(V.f.total_revenue)}</b>. Bạn gõ nhầm 1 số, xem lại phiếu.</div>`); }
    }
    if (c.diffGap !== null) {
      const lhs = V.f.cash_counted - V.f.ipos_opening - V.f.pos_cash - c.colTMfab;
      if (c.diffGap === 0) out.push(html`<div>✅ Tổng tiền − Số dư đầu − Tiền mặt${c.colTMfab ? ' − khách trả nợ tiền mặt' : ''} = <b>${signed(lhs)}</b> = Tiền chênh lệch</div>`);
      else { bad = true; out.push(html`<div>🔴 Tổng tiền − Số dư đầu − Tiền mặt${c.colTMfab ? ' − khách trả nợ tiền mặt' : ''} = <b>${signed(lhs)}</b>, khác Tiền chênh lệch <b>${signed(V.f.pos_diff)}</b>.${!traNoFabi(R.work_date) ? ' Bạn gõ nhầm 1 số, xem lại phiếu.' : (() => { const hit = oldBills().filter((d) => !d.closed_at && Number(d.amount) === c.diffGap);
          return hit.length ? html`<br>💡 Có thể khách <b>bàn ${hit.map((d) => d.table_name).join(' / ')}</b> (${fmt(c.diffGap)}) đã trả nợ tiền mặt — chọn "Trả bằng tiền mặt" ở mục <b>Khách trả nợ cũ</b> ngay bên dưới.`
            : oldBills().length ? ' Bạn gõ nhầm 1 số, hoặc có khách trả nợ cũ bằng tiền mặt (chọn ở mục Khách trả nợ cũ bên dưới).' : ' Bạn gõ nhầm 1 số, xem lại phiếu.'; })()}</div>`); }
    }
    return { h: out.length ? html`<div class="alert ${bad ? 'error' : c.startBad ? 'warn' : 'ok'} cm-checks">${out}</div>` : '', bad, all: Object.values(V.f).every((x) => x !== null) };
  }
  // Khung so sánh chuyển khoản hotline (vẽ lại riêng khi gõ)
  function ckBox() {   // bước 113: gọn 1 dòng — phép tính đầy đủ nằm ở Bảng tiền của ca
    const c = money(); const bad = c.ckLeft !== null && c.ckLeft !== 0;
    if (V.reported_transfer === null) return html`<div class="st-meta">Phải thấy trên hotline: <b>${fmt(c.ckExp)}</b> (dòng "Phải có / phải nhận" của bảng tiền).</div>`;
    return html`<div class="alert ${bad ? 'error' : 'ok'}" style="margin:0">${bad ? html`🔴 Phải thấy trên hotline <b>${fmt(c.ckExp)}</b>, bạn nhập <b>${fmt(V.reported_transfer)}</b> — lệch <b>${signed(c.ckLeft)}</b>. Cộng lại các giao dịch trên hotline; quên khoản Thu / Chi chuyển khoản hoặc Báo nợ CK thì thêm ở mục Các khoản tiền của ca.` : html`✅ Khớp — phải thấy trên hotline <b>${fmt(c.ckExp)}</b>`}</div>
      ${bad ? html`<label class="pc-f"><span>Ghi chú (không bắt buộc)</span><input class="input" id="cm-ck-note" value="${V.transfer_note}" placeholder="vd: 1 khách chuyển nhầm sang tài khoản khác"></label>` : ''}`;
  }
  // bước 84: một dòng thu / chi (tiền mặt hoặc chuyển khoản)
  const mvRow = (m, i) => html`<div class="cm-person"><div class="cm-ph"><div class="cm-seg"><button type="button" data-mt="${i}" data-v="-1" aria-pressed="${(m.sign || (Number(m.amount) > 0 ? 1 : -1)) < 0}">Chi ra</button><button type="button" data-mt="${i}" data-v="1" aria-pressed="${(m.sign || (Number(m.amount) > 0 ? 1 : -1)) > 0}">Thu vào</button></div>
      <button type="button" class="btn sm secondary danger" data-mx="${i}">Xóa</button></div>
    <div class="cm-line2"><input class="input sm" data-mv="${i}" data-k="note" value="${m.note || ''}" placeholder="${m.kind === 'chuyen_khoan' ? 'Nội dung, vd: hoàn tiền khách huỷ đơn' : 'Nội dung, vd: mua đá'}"><input class="input sm money" data-mv="${i}" data-k="amount" inputmode="numeric" value="${m.amount ? fmt(Math.abs(m.amount)) : ''}" placeholder="Số tiền"></div></div>`;
  // bước 84: bảng tính chi tiết từng dòng (bước Kết quả tiền & gửi phiếu)
  function resultBox() {
    const c = money(); const op = first ? GOI_DAU : V.f.ipos_opening;
    const paidOld = (R.open_debts || []).filter((d) => d.closed_report_id === R.id);
    const tmIn = V.moves.filter((m) => m.kind === 'tien_mat' && Number(m.amount) > 0); const tmOut = V.moves.filter((m) => m.kind === 'tien_mat' && Number(m.amount) < 0);
    const ckIn = V.moves.filter((m) => m.kind === 'chuyen_khoan' && Number(m.amount) > 0); const ckOutMv = V.moves.filter((m) => m.kind === 'chuyen_khoan' && Number(m.amount) < 0);
    const salRows = V.staff.filter((s) => s.worked && s.pay_cash && parseMoney(s.cash_paid) > 0);
    const sg = (n) => (Number(n) < 0 ? '−' : Number(n) > 0 ? '+' : '') + fmt(Math.abs(Number(n) || 0));
    const row = (l, v, cls = '') => html`<div class="${cls}">${l}</div><div class="${cls}">${v}</div>`;
    const sub = (list) => list.map(([l, v]) => row(l, fmt(Math.abs(v)), 'cm-sub'));
    const tmChi = sum(tmOut, (m) => m.amount) - c.sal; const tmThu = sum(tmIn, (m) => m.amount);
    const ckChi = sum(ckOutMv, (m) => m.amount); const ckThu = sum(ckIn, (m) => m.amount);
    const tmMust = op + V.f.pos_cash + c.colTM + tmThu + tmChi - c.loanOut;
    const paidOf = (k) => paidOld.filter((d) => d.collect_kind === k).map((d) => [`${noName(d)} (${d.by_ql ? 'QL ghi' : 'ca ' + (d.from_shift || '')} ${dmy(d.from_date).slice(0, 5)})`, d.amount]);
    return html`<div class="cm-real">
      <div class="cm-rc"><div class="pc-sub" style="margin:0">TIỀN MẶT PHẢI CÓ TRONG KÉT</div><div class="st-meta" style="margin:2px 0 6px">= Số dư đầu + Doanh thu TM + Khách trả nợ TM + Thu TM − Chi TM − Nợ TM mới</div><div class="kv">
        ${row(first ? 'Số dư đầu ca (tiền gối đầu)' : 'Số dư đầu ca (Phiếu Fabi)', fmt(op))}
        ${row('+ Doanh thu tiền mặt (Phiếu Fabi)', fmt(V.f.pos_cash), 'cm-p')}
        ${row('+ Khách trả nợ tiền mặt (Phiếu Fabi)', fmt(c.colTM), 'cm-p')}${sub(paidOf('tien_mat'))}
        ${row('+ Thu tiền mặt (Thu chi)', fmt(tmThu), 'cm-p')}${sub(tmIn.map((m) => [m.note, m.amount]))}
        ${row('− Chi tiền mặt (Thu chi)', sg(tmChi), 'cm-m')}${sub(tmOut.map((m) => [m.note, m.amount]))}${sub(salRows.map((s) => [`Lương ${s.name} (trả tiền mặt)`, parseMoney(s.cash_paid)]))}
        ${row('− Nợ TM mới (Khách nợ)', sg(-c.loanOut), 'cm-m')}${sub(V.debts.filter(isLoan).map((d) => [d.table_name, d.amount]))}
        ${row('= PHẢI CÓ TRONG KÉT', fmt(tmMust), 'cm-t')}${row('Đếm thực tế (Tổng tiền)', fmt(V.f.cash_counted))}</div>
        <div class="alert ${c.tmLeft === 0 ? 'ok' : 'error'}" style="margin-top:6px"><b>${c.tmLeft === 0 ? 'Tiền mặt: KHỚP ✓' : 'Tiền mặt: LỆCH ' + signed(c.tmLeft)}</b></div></div>
      <div class="cm-rc"><div class="pc-sub" style="margin:0">CHUYỂN KHOẢN PHẢI NHẬN TRÊN HOTLINE</div><div class="st-meta" style="margin:2px 0 6px">= Doanh thu CK + Khách trả nợ CK + Thu CK − Chi CK − Nợ CK mới</div><div class="kv">
        ${row('+ Doanh thu chuyển khoản (Phiếu Fabi)', fmt(V.f.pos_transfer), 'cm-p')}
        ${row('+ Khách trả nợ chuyển khoản (Phiếu Fabi)', fmt(c.colCK), 'cm-p')}${sub(paidOf('chuyen_khoan'))}
        ${row('+ Thu chuyển khoản (Thu chi)', fmt(ckThu), 'cm-p')}${sub(ckIn.map((m) => [m.note, m.amount]))}
        ${row('− Chi chuyển khoản (Thu chi)', sg(ckChi), 'cm-m')}${sub(ckOutMv.map((m) => [m.note, m.amount]))}
        ${row('− Nợ CK mới (Khách nợ)', sg(-c.ckOut), 'cm-m')}${sub(V.debts.filter(isCK).map((d) => [d.table_name, d.amount]))}
        ${row('= PHẢI NHẬN TRÊN HOTLINE', fmt(c.ckExp), 'cm-t')}${row('Hotline nhân viên cộng', fmt(V.reported_transfer))}</div>
        <div class="alert ${c.ckLeft === 0 ? 'ok' : 'error'}" style="margin-top:6px"><b>${c.ckLeft === 0 ? 'Chuyển khoản: KHỚP ✓' : 'Chuyển khoản: LỆCH ' + signed(c.ckLeft)}</b></div></div>
      <div class="cm-rc cm-rt"><div class="kv">${row('Doanh thu NET (Phiếu Fabi)', fmt(V.f.total_revenue))}${row(`= Tiền mặt ${fmt(V.f.pos_cash)} + CK ${fmt(V.f.pos_transfer)} + Nợ HĐ ${fmt(V.f.pos_debt)}`, '', 'cm-sub')}</div></div></div>`;
  }
  const B = {
    0: () => html`<div class="st-meta">Mỗi ca chỉ <strong>1 người chốt chính</strong>, chịu trách nhiệm cả phiếu. Hàng kho tổng tới thì nhận ở menu <b>Hàng hoá › Nhận hàng</b> (không cần phiếu chốt ca).</div>
      <div class="kv"><div>Cơ sở</div><div>${R.branch_code || ''} ${R.branch_name || ''}</div><div>Ca</div><div>${R.shift} · ${dmy(R.work_date)}</div></div>
      ${tienOther ? html`<div class="alert info"><strong>${PT.tien.claimed_name}</strong> đang chốt ca này (nhận lúc ${dt(PT.tien.claimed_at)}). Hàng kho tổng tới thì nhận ở menu Hàng hoá › Nhận hàng.</div>
        ${P.can_claim ? html`<button type="button" class="btn secondary" id="cm-force">Nhận lại việc chốt ca này</button>` : ''}`
        : html`<button type="button" class="btn" id="cm-claim">Tôi chốt ca này</button>`}`,
    1: () => html`<div class="st-meta">Danh sách lấy sẵn từ lịch. Chỉ sửa chỗ khác thực tế.</div>
      ${V.staff.length ? '' : html`<div class="st-meta">Lịch chưa xếp ai cho ca này — thêm người làm bên dưới.</div>`}
      ${V.staff.map((s, i) => html`<div class="cm-person"><div class="cm-ph"><div><strong>${s.code} – ${s.name}</strong> <span class="st-meta">${s.role || ''}${s.source === 'lich' ? '' : ' · làm hộ / phát sinh'}</span>
          ${s.pay_cash && Number(s.cash_paid) > 0 ? html` <span class="pill info">Trả lương tiền mặt</span>` : ''}</div>
        <div class="cm-seg" role="group" aria-label="${s.name} có làm không"><button type="button" data-w="${i}" data-v="1" aria-pressed="${s.worked}">Có làm</button><button type="button" data-w="${i}" data-v="0" aria-pressed="${!s.worked}">Nghỉ</button></div></div>
        ${s.worked ? html`<div class="cm-times"><label>Đến <input class="input sm" type="time" data-t="${i}" data-k="time_in" value="${s.time_in || ''}"></label><label>Về <input class="input sm" type="time" data-t="${i}" data-k="time_out" value="${s.time_out || ''}"></label>
            ${s.pay_cash && Number(s.cash_paid) > 0 ? html`<label>Đã trả lương tiền mặt <input class="input sm money" data-cash="${i}" inputmode="numeric" placeholder="0" value="${s.cash_paid ? fmt(parseMoney(s.cash_paid)) : ''}" style="width:120px"></label>` : ''}
            ${s.source !== 'lich' ? html`<button type="button" class="btn sm secondary danger" data-rm="${i}">Bỏ</button>` : ''}</div>`
          : html`<input class="input sm" data-reason="${i}" placeholder="Lý do nghỉ (bắt buộc)" value="${s.absent_reason || ''}">`}</div>`)}
      <div class="cm-hp"><div class="pc-sub" style="margin:0">THÊM NGƯỜI LÀM HỘ</div>
        <div class="cm-seg cm-hp-tabs" role="group" aria-label="Chọn nhóm nhân viên"><button type="button" data-hp="in" aria-pressed="${HP.tab === 'in'}">Nhân viên trong quán</button><button type="button" data-hp="old" aria-pressed="${HP.tab === 'old'}">Nhân viên cũ</button></div>
        ${HP.tab ? html`<input class="input sm" id="cm-helper" placeholder="Lọc theo tên hoặc mã (không cần dấu)" aria-label="Lọc người làm hộ" value="${HP.q}" autocomplete="off">
          <div id="cm-help-list" class="cm-hlist"><span class="st-meta">Đang tải danh sách…</span></div>` : ''}</div>
      ${hasCover() ? html`<div class="alert info" style="margin:0"><b>Có nghỉ / làm thay trong ca.</b> Nội dung đã được ghi ngay trong bước Nhân viên; quản lý tổng tiếp tục phân loại sau.</div>` : html`<div class="st-meta">Không có người nghỉ hoặc làm thay trong ca.</div>`}`,
    2: () => {
      const ch = fabiChecks();
      return html`<div class="st-meta">Chụp phiếu chốt ca Fabi trước, rồi gõ <strong>lần lượt từ trên xuống</strong> đúng như trên phiếu.</div>
        <div class="cm-phrow"><div class="cm-photos">${photos.map((p) => html`<figure class="cm-thumb" data-path="${p.path}"><a target="_blank" rel="noopener" aria-label="Xem ảnh to"><img alt="Ảnh phiếu Fabi" loading="lazy"></a><button type="button" class="ph-del" data-id="${p.id}" aria-label="Xóa ảnh">×</button></figure>`)}</div>
          <div class="cm-phact">${photos.length ? html`<span class="pill ok">Đã có ${photos.length} ảnh ✓</span>` : ''}
            <label class="btn sm secondary">📷 ${photos.length ? 'Chụp thêm ảnh' : 'Chụp phiếu chốt ca Fabi'}<input type="file" id="cm-photo" accept="image/*" multiple hidden></label><span class="st-meta" id="cm-ph-st"></span></div></div>
        ${shiftFabiFields([
          ['Số dư đầu', moneyIn('ipos_opening', V.f.ipos_opening, 'Số dư đầu')],
          ['Doanh thu (NET)', moneyIn('total_revenue', V.f.total_revenue, 'Doanh thu NET')],
          ['Chuyển khoản', moneyIn('pos_transfer', V.f.pos_transfer, 'Chuyển khoản')],
          ['Tiền mặt', moneyIn('pos_cash', V.f.pos_cash, 'Tiền mặt')],
          ['Nợ trên phiếu', moneyIn('pos_debt', V.f.pos_debt, 'Nợ'), 'Không có dòng này thì nhập 0'],
          ['Tổng tiền thực đếm', moneyIn('cash_counted', V.f.cash_counted, 'Tổng tiền'), 'Số tiền thực tế trong két'],
          ['Tiền chênh lệch trên phiếu', html`<div class="cm-signed"><div class="cm-seg"><button type="button" data-sign="1" aria-pressed="${V.sign > 0}" aria-label="Dương">+</button><button type="button" data-sign="-1" aria-pressed="${V.sign < 0}" aria-label="Âm">−</button></div>${moneyIn('pos_diff', V.f.pos_diff, 'Tiền chênh lệch')}</div>`, 'Dòng cuối phiếu, có dấu + hoặc −'],
        ])}
        <div id="cm-checks">${ch.h}</div>
        ${expStart ? html`<label class="pc-f" id="cm-open-wrap" ${money().startBad ? '' : 'hidden'}><span>Ghi chú số dư đầu khác ${expStart.src} (không bắt buộc)</span><input class="input" id="cm-open-note" value="${V.opening_note}" placeholder="vd: chủ rút 500.000 lúc 14:00"></label>` : ''}`;
    },
    3: () => {   // bước 113: báo nợ gọn — mỗi khoản 1 dòng như Thu / Chi; TM / CK = bàn đã bấm thanh toán trên Fabi mà khách chưa trả
      const c = money(); const pd = V.f.pos_debt || 0;
      return html`${V.debts.map((d, i) => html`<div class="sc-row cm-debt"><span class="sc-kt"><b>Báo nợ</b><span class="sc-seg" role="group" aria-label="Loại nợ">${[['muon', 'TM'], ['ck', 'CK'], ['bill', 'HĐ']].map(([k, l]) => html`<button type="button" data-dk="${i}" data-v="${k}" class="${(d.kind || '') === k ? 'on' : ''}" aria-pressed="${(d.kind || '') === k}" ${d.closed_at ? 'disabled' : ''}>${l}</button>`)}</span></span>
          <input class="input money" data-db="${i}" data-k="amount" inputmode="numeric" value="${d.amount ? fmt(d.amount) : ''}" placeholder="Số tiền" aria-label="Số tiền nợ" ${d.closed_at ? 'disabled' : ''}>
          ${d.closed_at ? html`<span class="pill ok">Đã thu</span>` : html`<button type="button" class="btn secondary danger" data-dbx="${i}" aria-label="Xóa khoản nợ">×</button>`}
          <div class="sc-full sc-two">${raw(debtWhoSel(d, debtPeople, `data-dwho="${i}" ${d.closed_at ? 'disabled' : ''}`))}${d.grp && d.grp !== 'khach' ? '' : html`<input class="input" data-db="${i}" data-k="table_name" value="${d.table_name || ''}" placeholder="Bàn / tên khách" aria-label="Bàn hoặc tên khách" ${d.closed_at ? 'disabled' : ''}>`}<input class="input" data-db="${i}" data-k="note" value="${d.note || ''}" placeholder="SĐT, hẹn trả (không bắt buộc)" aria-label="Ghi chú nợ" ${d.closed_at ? 'disabled' : ''}></div>
          ${d.grp && d.grp !== 'khach' ? html`<span class="sc-full st-meta">Vào <b>${d.grp === 'kho' ? '② Nợ kho tổng' : '③ Nợ khác'}</b> · ca sau không nhắc · quản lý thu ở tab Công nợ</span>` : ''}</div>`)}
        ${V.debts.length ? html`<span class="st-meta"><b>TM / CK</b>: bàn đã bấm thanh toán tiền mặt / chuyển khoản trên Fabi mà khách chưa trả (hoặc khách mượn tiền mặt). <b>HĐ</b>: Fabi ghi nợ. Ca sau được nhắc thu.</span>` : ''}
        ${V.debts.length || pd ? html`<div class="alert ${billSum() === pd ? 'ok' : 'warn'}" id="cm-debt-sum" style="margin:0">${billSum() === pd ? '✅' : '⚠️'} Nợ HĐ đã ghi <b>${fmt(billSum())}</b> ${billSum() === pd ? '=' : '≠'} Nợ trên phiếu Fabi (${fmt(pd)})
          ${c.loanOut ? html`<br>Nợ TM <b>${fmt(c.loanOut)}</b> → trừ tiền két` : ''}${c.ckOut ? html`<br>Nợ CK <b>${fmt(c.ckOut)}</b> → trừ tiền hotline` : ''}</div>` : ''}`;
    },
    4: () => html`<div class="st-meta">Cộng các giao dịch chuyển khoản <strong>đã nhận trên hotline</strong> trong ca rồi nhập tổng.</div>
        <label class="pc-f"><span>Tổng chuyển khoản đã nhận trên hotline</span><input class="input money" id="cm-hot" inputmode="numeric" autocomplete="off" value="${V.reported_transfer === null ? '' : fmt(V.reported_transfer)}"></label>
        <div id="cm-ck-box">${ckBox()}</div>`,
    5: () => {   // bước 84: thu chi chia 2 phần — tiền mặt / chuyển khoản; Nợ TM / Nợ CK ghi ở bước Khách nợ
      const c = money(); const tm = V.moves.map((m, i) => [m, i]).filter(([m]) => m.kind !== 'chuyen_khoan'); const ck = V.moves.map((m, i) => [m, i]).filter(([m]) => m.kind === 'chuyen_khoan');
      return html`<div class="st-meta">Ghi các khoản <b>thu / chi trong ca</b> — chỉ chọn Thu / Chi và ghi nội dung, quản lý phân loại sau. Không cần ảnh hóa đơn. <b>Két thiếu tiền không ghi ở đây</b> (web tự tính chênh lệch).</div>
        <h3 style="margin:6px 0 0">1. Tiền mặt (trong két)</h3>
        <div class="st-meta">Tiền mặt lấy ra từ két để chi, hoặc bỏ thêm vào két (kể cả quản lý rút ra). Trả lương tiền mặt (người hỗ trợ, nhân viên cũ) thì ghi <b>Chi ra</b>, nội dung <b>"Chi lương + tên"</b>.</div>
        ${tm.map(([m, i]) => mvRow(m, i))}
        ${c.sal ? html`<div class="cm-person" style="background:var(--line-soft)"><div>Lương trả tiền mặt <span class="st-meta">(đã ghi ở bước Ai làm ca)</span></div><div class="st-meta">${fmt(c.sal)}đ</div></div>` : ''}
        <div class="pc-line"><button type="button" class="btn sm secondary" id="cm-add-move">+ Thêm khoản tiền mặt</button></div>
        <h3 style="margin:12px 0 0">2. Chuyển khoản (tài khoản hotline)</h3>
        <div class="st-meta">Tiền chuyển đi từ hotline (hoàn tiền khách huỷ đơn, trả tiền hàng…) hoặc tiền vào hotline không phải bán hàng.</div>
        ${ck.map(([m, i]) => mvRow(m, i))}
        <div class="pc-line"><button type="button" class="btn sm secondary" id="cm-add-ckmove">+ Thêm khoản chuyển khoản</button></div>
        ${V.moves.length ? '' : html`<label class="pc-line" style="gap:6px"><input type="checkbox" class="check" id="cm-nomoves" ${V.noMoves ? 'checked' : ''}> Ca này không có thu chi</label>`}
        <div class="st-meta">Nợ TM / Nợ CK <b>không ghi ở đây</b> — ghi ở bước "Khách nợ trong ca".</div>`;
    },
    6: () => html`<label class="pc-f"><span>Số cốc bán trong ca</span><input class="input" id="cm-cups" inputmode="numeric" value="${V.cups ?? ''}" placeholder="0"></label>`,
    8: () => html`${(R.carried || []).length ? html`<h3 style="margin:0">Việc chưa xong từ ca trước</h3>${R.carried.map((h) => html`<div class="cm-person"><div>${h.content}<div class="st-meta">Ca ${h.from_shift} ${dmy(h.from_date)}</div></div>
          ${h.task_id ? html`<span class="pill ${h.done_at ? 'ok' : 'warn'}">${h.done_at ? 'Đã xử lý' : 'Đã giao việc'}</span>` : html`<button type="button" class="btn sm ${h.done_at ? 'secondary' : ''}" data-hodone="${h.id}" data-undo="${h.done_at ? 1 : ''}">${h.done_at ? 'Bỏ đánh dấu' : 'Đã xong'}</button>`}</div>`)}` : ''}
      <h3 style="margin:0">Bàn giao cho ca sau <span class="st-meta">(không bắt buộc)</span></h3>
      ${V.handover.map((h, i) => html`<div class="cm-line2" style="grid-template-columns:minmax(0,1fr) auto"><textarea class="input" rows="2" data-ho="${i}" placeholder="Việc ca sau làm tiếp / thiết bị / vệ sinh / sự cố" ${h.task_id ? 'disabled' : ''}>${h.content || ''}</textarea>
        ${h.task_id ? html`<span class="pill warn">Đã giao việc</span>` : html`<button type="button" class="btn sm secondary danger" data-hox="${i}" aria-label="Xóa">×</button>`}</div>`)}
      <div><button type="button" class="btn sm secondary" id="cm-add-ho">+ Thêm việc bàn giao</button></div>
      ${nhanHang()}`,
    9: () => {   // bước 84: gộp Kết quả tiền + Kiểm tra lần cuối; lệch không bắt ghi lý do — quản lý tự chốt khi đối soát
      const w = V.staff.filter((s) => s.worked); const ho = V.handover.filter((h) => (h.content || '').trim());
      return html`${resultBox()}
        <label class="pc-f" style="display:flex;flex-direction:column;gap:4px;align-items:stretch"><span>Ghi chú cho quản lý (không bắt buộc)</span><textarea class="input" id="cm-diff-note" rows="2" placeholder="vd: thối nhầm cho khách bàn 3">${V.diff_note}</textarea></label>
        <div class="alert warn" style="margin:0">Lệch <b>không cần ghi lý do</b> — quản lý sẽ kiểm tra và chốt khi đối soát.</div>
        <div class="cm-person"><div>① Phần việc ✓ <span class="st-meta">· ${w.length} người làm (${w.map((s) => s.name).join(', ')})${ho.length ? ` · ${ho.length} việc bàn giao` : ''}</span></div></div>
        <div class="st-meta">Đọc lại một lượt rồi bấm <b>GỬI PHIẾU</b>.</div>
        ${CV_CSS}<section class="stack" id="cm-cv" style="gap:8px" hidden></section>`;
    },
  };
  const hasCover = () => V.staff.some((x) => !x.worked || x.source !== 'lich');
  const cats = () => Array.isArray(categories) ? categories : categories.cats || categories.categories || [];
  function ledgerRow(m, i) {
    const exchange = m.kind === 'doi_tien'; const positive = Number(m.amount) > 0 || m.sign === 1;
    return html`<div class="sc-row ${exchange ? 'sc-exchange' : ''}">
      ${exchange ? html`<span class="sc-kt"><strong>${EXCH_LABEL}</strong><span class="sc-seg" role="group" aria-label="Chiều luân chuyển">${EXCH_DIRS.map(([k, l]) => html`<button type="button" data-xdir="${i}" data-v="${k}" class="${(m.dir || 'tm_ck') === k ? 'on' : ''}" aria-pressed="${(m.dir || 'tm_ck') === k}">${l}</button>`)}</span></span>` : html`<span class="sc-kt">${kindSeg(positive ? 'thu' : 'chi', m.kind === 'chuyen_khoan' ? 'ck' : 'tm')}<select data-mkind="${i}" hidden aria-hidden="true"><option value="chi_tm" ${!positive && m.kind === 'tien_mat' ? 'selected' : ''}>Chi · tiền mặt</option><option value="chi_ck" ${!positive && m.kind === 'chuyen_khoan' ? 'selected' : ''}>Chi · chuyển khoản</option><option value="thu_tm" ${positive && m.kind === 'tien_mat' ? 'selected' : ''}>Thu · tiền mặt</option><option value="thu_ck" ${positive && m.kind === 'chuyen_khoan' ? 'selected' : ''}>Thu · chuyển khoản</option></select></span>`}
      <input class="input money" data-mv="${i}" data-k="amount" inputmode="numeric" aria-label="Số tiền khoản ${i + 1}" value="${m.amount ? fmt(Math.abs(m.amount)) : ''}" placeholder="Số tiền">
      <button type="button" class="btn secondary danger" data-mx="${i}" aria-label="Xóa khoản ${i + 1}">×</button>
      <input class="input sc-full" data-mv="${i}" data-k="note" value="${m.note || ''}" aria-label="Nội dung khoản ${i + 1}" placeholder="${exchange ? 'Nội dung luân chuyển (vd khách CK rút TM, rút tiền về két)' : 'Thu / chi việc gì'}">
      ${exchange ? html`<small class="sc-full">Tiền mặt ${exchSigns(m.dir).tm < 0 ? '−' : '+'}${fmt(Math.abs(m.amount || 0))} · chuyển khoản ${exchSigns(m.dir).ck < 0 ? '−' : '+'}${fmt(Math.abs(m.amount || 0))} · không tính thu chi của quán.</small>` : html`<div class="sc-full sc-conv"><span class="st-meta">Đổi thành:</span><button type="button" class="btn sm secondary" data-tothu="${i}">Thu nợ</button><button type="button" class="btn sm secondary" data-tono="${i}">Báo nợ</button><button type="button" class="btn sm secondary" data-exchange="${i}">Luân chuyển TM – CK</button></div>`}
      ${managerClose && !exchange ? html`<label class="sc-full">Nhóm <select class="input" data-mcat="${i}" aria-label="Nhóm khoản ${i + 1}"><option value="">— Chọn nhóm —</option>${cats().filter((c) => c.active && c.kind === (positive ? 'thu' : 'chi')).map((c) => html`<option value="${c.id}" ${String(m.category) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}<option value="x" ${m.category === 'x' ? 'selected' : ''}>Không tính</option></select></label>` : ''}
    </div>`;
  }
  function commonMoney() {
    const c = money(); const ex = sum(V.moves.filter((m) => m.kind === 'doi_tien'), (m) => exchSigns(m.dir).ck * Math.abs(Number(m.amount)));   // CK + (TM ngược dấu)
    const ordinary = (kind, positive) => sum(V.moves.filter((m) => m.kind === kind && (positive ? Number(m.amount) > 0 : Number(m.amount) < 0)), (m) => m.amount);
    return shiftMoneyTable({ rows: [['Số dư đầu ca', first ? GOI_DAU : V.f.ipos_opening, null, true], ['+ Doanh thu Fabi', V.f.pos_cash, V.f.pos_transfer], ['+ Thu nợ', c.colTM, c.colCK], ['+ Thu', ordinary('tien_mat', true), ordinary('chuyen_khoan', true)], ['− Chi', ordinary('tien_mat', false), ordinary('chuyen_khoan', false)], ['− Báo nợ', -c.loanOut, -c.ckOut], ['± Luân chuyển TM – CK', -ex, ex], ['− Lương tiền mặt', -c.sal, null]], expected: [c.tmLeft === null ? null : V.f.cash_counted - c.tmLeft, V.f.pos_transfer === null ? null : c.ckExp], actual: [V.f.cash_counted, V.reported_transfer], gap: [c.tmLeft, c.ckLeft] });
  }
  function gapChoices() {
    if (!managerClose) return '';
    const c = money();
    return html`${[['tien_mat', 'Tiền mặt', c.tmLeft], ['chuyen_khoan', 'Chuyển khoản', c.ckLeft]].filter(([, , g]) => g != null && g !== 0).map(([item, label, gap]) => {
      const choice = V.gaps[item]?.expected === gap ? V.gaps[item].action : 'sau';
      return html`<section class="sc-block"><h2>Xử lý lệch · ${label}</h2><strong>${signed(gap)}đ</strong><label>Cách xử lý<select class="input" data-gap-action="${item}">${[['sau','Để sau — theo dõi tại Lệch tiền ca'],['qc',gap < 0 ? 'Quán chịu (Chủ / Quản lý tổng)' : 'Ghi thu khác (quán giữ)'],...(gap < 0 ? [['chia','Chia đều tất cả người có làm ca — trừ lương']] : [])].map(([k,label]) => html`<option value="${k}" ${choice === k ? 'selected' : ''}>${label}</option>`)}</select></label><span class="st-meta">${choice === 'chia' ? 'Khoản thiếu sẽ chia cho: ' + V.staff.filter(s => s.worked).map(s => s.name).join(', ') + '. Mỗi người được báo khoản trừ lương khi gửi.' : 'Ca vẫn hoàn thành đối soát; khoản để sau được giữ riêng để xử lý.'}</span></section>`;
    })}`;
  }
  B[10] = () => html`<section class="sc-block"><h2>Nghỉ & làm thay</h2>${V.staff.filter((s) => !s.worked || s.source !== 'lich').map((s) => html`<div class="cm-person"><strong>${s.code} – ${s.name}</strong><span>${s.worked ? 'Làm hộ / hỗ trợ' : 'Nghỉ: ' + (s.absent_reason || 'chưa ghi lý do')}</span>${s.worked ? html`<span>${s.time_in || '—'} → ${s.time_out || '—'}</span>` : ''}</div>`)}<div class="alert info">Quản lý tổng phân loại và Chủ duyệt trong Công việc.${managerClose ? ' Việc này không chặn hoàn thành ca do quản lý tự chốt.' : ''}</div>${CV_CSS}<section class="stack" id="cm-cv" hidden></section></section>`;
  // bước 114: chốt ca xếp giống đối soát — kết quả trên cùng → bảng tiền → Phiếu Fabi (nhập đủ thì gọn 1 dòng) → các khoản → tiền thực tế
  const fabiDone = () => !stepError(2) && (fabiBranch || !stepError(6));
  const fabiSum = () => html`${fabiDone() ? html`<span class="sc-ic ok">✓</span><span>Phiếu Fabi đã nhập</span>` : html`<span class="sc-ic">!</span><span>Phiếu Fabi <small class="st-meta">chụp ảnh, ghi giờ và các số</small></span>`}<span class="sc-r">NET ${V.f.total_revenue === null ? '—' : fmt(V.f.total_revenue)} ›</span>`;
  function verdictBox() {
    const c = money();
    if (V.checked) {
      const gaps = [[c.tmLeft, 'Tiền mặt'], [c.ckLeft, 'Chuyển khoản']].filter(([g]) => g);
      return gaps.length ? html`<div class="sc-v bad">${gaps.map(([g, l]) => `${l} ${g < 0 ? 'thiếu' : 'thừa'} ${fmt(Math.abs(g))}đ`).join(' · ')}<small>Đếm lại tiền, xem lại các khoản. ${managerClose ? 'Chọn cách xử lý lệch ở cuối trang rồi bấm Gửi.' : 'Vẫn gửi được — số lệch giữ lại để quản lý xử lý.'}</small></div>`
        : html`<div class="sc-v ok">✓ Tiền mặt và chuyển khoản khớp<small>Đã ghi đủ — bấm ${managerClose ? 'Gửi & hoàn thành' : 'Gửi phiếu'}.</small></div>`;
    }
    const e = stepError(11);
    return e ? html`<div class="sc-v wait">Còn thiếu: ${e}<small>Ghi đủ rồi bấm Kiểm tra ở cuối trang.</small></div>` : html`<div class="sc-v ok">Đã ghi đủ các mục<small>Bấm Kiểm tra ở cuối trang rồi gửi phiếu.</small></div>`;
  }
  B[11] = () => html`<div id="cm-verdict">${verdictBox()}</div>
    <details class="sc-block sc-fabi" id="cm-fabi" ${(V.fabiOpen ?? !fabiDone()) ? 'open' : ''}><summary id="cm-fabi-sum">${fabiSum()}</summary>
      <h3 class="sc-h3">Thời gian doanh thu</h3><div class="sc-period"><label>Bắt đầu doanh thu<input class="input" type="datetime-local" id="cm-open" value="${V.open}" ${R.forced_start || first ? 'readonly' : ''}></label><label>Kết thúc doanh thu<input class="input" type="datetime-local" id="cm-close" value="${V.close}"></label></div><span class="st-meta">${first ? 'Ca sáng bắt đầu 06:45. ' : R.forced_start ? 'Bắt đầu theo kết thúc ca trước. ' : ''}Theo giờ trên phiếu POS, không phải giờ làm của nhân viên. Qua nửa đêm chọn ngày hôm sau.</span>
      <h3 class="sc-h3">Số trên phiếu</h3>${B[2]()}${fabiBranch ? '' : B[6]()}</details>
    <section class="sc-block"><h2>Các khoản tiền của ca${(() => { const n = (R.open_debts || []).filter((d) => d.closed_report_id === R.id).length + V.moves.length + V.debts.length; return n ? ` · ${n} khoản` : ''; })()}</h2><span class="st-meta">Ghi mỗi khoản một lần. Khách trả nợ cũ thì chọn Thu nợ.${managerClose ? '' : ' Không cần phân loại — quản lý phân loại sau.'}</span>
      ${(R.open_debts || []).filter((d) => d.closed_report_id === R.id).map(paidRow)}
      ${V.moves.map(ledgerRow)}
      ${B[3]()}
      <div class="sc-actions"><button type="button" class="btn secondary" id="cm-pick-debt">+ Thu nợ</button><button type="button" class="btn secondary" data-new-move="1">+ Thu</button><button type="button" class="btn secondary" data-new-move="-1">+ Chi</button><button type="button" class="btn secondary" id="cm-add-debt">+ Báo nợ</button><button type="button" class="btn secondary" id="cm-exchange">+ Luân chuyển TM – CK</button></div>
    </section>
    <section class="sc-block"><h2>Tiền thực tế</h2>${B[4]()}<span class="st-meta">Tiền mặt đếm được là ô Tổng tiền trên phiếu Fabi.</span><label>Ghi chú cho quản lý (không bắt buộc)<textarea class="input" id="cm-diff-note" rows="2">${V.diff_note}</textarea></label></section>
    <div id="cm-gap-choices">${gapChoices()}</div>
    <section class="sc-block" id="cm-money-table">${commonMoney()}</section>`;
  B[12] = () => {
    const worked = V.staff.filter((s) => s.worked);
    const handovers = V.handover.filter((h) => (h.content || '').trim());
    return html`<div id="cm-verdict">${verdictBox()}</div>
      <section class="sc-block"><h2>Kiểm tra trước khi gửi</h2>
        <div class="cm-review-row"><span>Nhân viên trong ca</span><b>${worked.length} người</b></div>
        <div class="cm-review-row"><span>Bàn giao ca</span><b>${handovers.length ? `${handovers.length} nội dung` : 'Không có'}</b></div>
        <div class="cm-review-row"><span>Phiếu Fabi</span><b>${fabiDone() ? 'Đã nhập đủ' : 'Chưa đủ'}</b></div>
        <div class="cm-review-row"><span>Các khoản tiền</span><b>${(R.open_debts || []).filter((d) => d.closed_report_id === R.id).length + V.moves.length + V.debts.length} khoản</b></div>
      </section>
      <div class="alert info" style="margin:0">Sau khi gửi, chính phiếu này chuyển sang <b>Chờ quản lý đối soát</b>. Số nhân viên đã gửi được giữ nguyên.</div>
      <section class="sc-block">${commonMoney()}</section>`;
  };
  // bước 104: nhận hàng đã tách hẳn sang menu Hàng hoá — chỉ còn nút cho phiếu cũ có người đã nhận phần "nhận hàng"
  function nhanHang() {
    const p = PT.nhan_hang || {};
    if (!p.claimed_by || p.done_at) return '';
    return html`<div class="st-meta" style="margin-top:6px">Phần nhận hàng (phiếu cũ): ${p.mine ? 'bạn' : p.claimed_name} đã nhận phần này. Nhận hàng kho tổng giờ làm ở menu Hàng hoá.</div>
      ${p.mine && !tienMine ? html`<button type="button" class="btn sm" id="cm-nh-done" style="align-self:flex-start">Xong phần nhận hàng</button>` : ''}`;
  }
  function stepError(code = ORDER[V.step]) {
    const c = money();
    switch (code) {
      case 11: {
        for (const k of [1, 2, 3, 4, 5, ...(fabiBranch ? [] : [6])]) { const e = stepError(k); if (e) return e; }
        if (managerClose && V.moves.some((m) => m.kind !== 'doi_tien' && !m.category)) return 'Chọn nhóm cho từng khoản Thu / Chi.';
        return '';
      }
      case 1: {
        if (!V.staff.some((s) => s.worked)) return 'Phải có ít nhất 1 người làm.';
        const b = V.staff.find((s) => s.worked && (!s.time_in || !s.time_out)); if (b) return `Nhập giờ đến và giờ về của ${b.name}.`;
        const r = V.staff.find((s) => !s.worked && !(s.absent_reason || '').trim()); if (r) return `Ghi lý do nghỉ của ${r.name}.`;
        return '';
      }
      case 2: {
        if (!photos.length) return 'Chụp ảnh phiếu chốt ca Fabi trước.';
        const pe = periodError(R.forced_start || V.open, V.close); if (pe) return pe;
        const ch = fabiChecks();
        if (!ch.all) return 'Còn ô chưa nhập. Không có dòng nào thì nhập 0.';
        if (ch.bad) return 'Các số chưa khớp nhau: có số gõ nhầm, xem lại phiếu.';
        return '';
      }
      case 3: {
        const nk = V.debts.find((d) => !['bill', 'muon', 'ck'].includes(d.kind)); if (nk) return `Chọn HĐ / TM / CK cho khoản nợ ${nk.table_name || 'mới'}.`;
        if (V.debts.some((d) => !(d.table_name || '').trim() || !(Number(d.amount) > 0))) return 'Khoản nợ nào cũng phải có bàn / tên khách và số tiền.';
        if (billSum() !== (V.f.pos_debt || 0)) return `Tổng Nợ HĐ (${fmt(billSum())}) phải bằng dòng Nợ trên phiếu Fabi (${fmt(V.f.pos_debt || 0)}).`;
        return '';
      }
      case 4:
        if (V.reported_transfer === null) return 'Nhập tổng chuyển khoản đã nhận trên hotline.';
        return '';
      case 5:

        if (V.moves.some((m) => !(m.note || '').trim() || !Number(m.amount))) return 'Khoản nào cũng phải có nội dung và số tiền.';
        // bước 73: tiền thiếu để thành chênh lệch — không ghi "âm / thiếu tiền" vào thu chi
        if (V.moves.some((m) => /(âm|thiếu|thieu|hụt|hut)\s*(tiền|tien|két|ket)/i.test(m.note || ''))) return 'Không ghi "âm / thiếu tiền" vào thu chi. Két thiếu thì cứ đếm đúng số thực tế — web tự tính chênh lệch, quản lý xử lý ở đối soát.';
        return '';
      case 6: return V.cups === null ? 'Nhập số cốc.' : '';
      default: return '';
    }
  }

  // ------------------------------------------------------------ khung
  function shell() {
    if (waiting) {
      return html`<div class="card stack cm-card"><h2 style="margin:0">Đã gửi phần chốt ca</h2>
        <div class="alert warn">Phiếu chờ <strong>${PT.nhan_hang?.claimed_name || 'người nhận hàng'}</strong> xong phần nhận hàng thì tự hoàn thành.</div>
        <button type="button" class="btn secondary" id="cm-undo" style="align-self:flex-start">Sửa lại phiếu</button>${nhanHang()}</div>`;
    }
    const s = V.step; const err = V.tried ? stepError() : '';
    const odOpen = (R.open_debts || []).filter((d) => !d.closed_at && !d.family);   // bước 75 / 85: khách nợ (không nhắc công nợ gia đình)
    const nhac = odOpen.length ? html`<div class="alert warn pc-nhac"><strong>Khách đang nợ: ${odOpen.length} khoản · ${fmt(sum(odOpen, (d) => d.amount))}đ</strong>
        <div class="st-meta">${odOpen.slice(0, 4).map((d) => `${noName(d)} ${fmt(d.amount)}`).join(' · ')}${odOpen.length > 4 ? ' · …' : ''} — khách trả thì chọn ở mục "Khách trả nợ trong ca" (② Phần tiền · ${LABEL[2]}).</div></div>` : '';
    const sc = ORDER[s] === 1 ? 0 : ORDER[s] === 8 ? 1 : ORDER[s] === 11 ? 2 : 3;
    const stepNav = html`<nav class="sc-steps cm-four-steps" aria-label="Các bước chốt ca">${['Nhân viên','Bàn giao','Tiền','Kiểm tra'].map((label,i) => html`<button type="button" data-shift-step="${i}" class="${i === sc ? 'on' : ''}" aria-current="${i === sc ? 'step' : 'false'}"><b>${i + 1}</b><span>${label}</span></button>`)}</nav>`;
    return html`${s ? stepNav : ''}${s === 0 ? nhac : ''}
      <div class="card stack cm-card" id="cm-body">${s === 1 || ORDER[s] === 8 ? html`<section class="sc-block"><h2>${STEPS[s]}</h2>${B[ORDER[s]]()}</section>` : B[ORDER[s]]()}${s === 0 && tienOther ? nhanHang() : ''}</div>
      <div id="cm-err" role="alert">${err ? html`<div class="alert error">${err}</div>` : ''}</div>
      ${s > 0 ? html`<div class="cm-nav"><button type="button" class="btn secondary" id="cm-back" ${s === 1 ? 'hidden' : ''}>‹ Quay lại</button><button type="button" class="btn" id="cm-next">${s === STEPS.length - 1 ? managerClose ? 'Gửi & hoàn thành' : 'Gửi phiếu' : ORDER[s] === 11 ? 'Kiểm tra & tiếp ›' : 'Lưu & tiếp tục ›'}</button></div>` : ''}`;
  }

  return {
    title: `Chốt ca ${R.shift}`,
    html: html`${CM_CSS}${SHIFT_CSS}<div class="ph-wrap sc-wrap"><div class="page-head cm-mobile-head"><div><a href="#/ca?ngay=${R.work_date}">‹ Danh sách ca</a><span class="cm-head-label">Phiếu chốt ca</span>
        <h1>Ca ${R.shift} · ${R.branch_code || ''}</h1><small>${dmy(R.work_date)} · ${managerClose ? 'Quản lý chốt và đối soát trên cùng phiếu' : 'Đang chốt · tự động lưu'}</small></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="cm-col" id="cm-root">${shell()}</div></div>`,
    mount() {
      const root = $('#cm-root'); bindKindSeg(root);
      root.addEventListener('click', (e) => { if (e.target.closest('#cm-fabi-sum')) { const d = $('#cm-fabi'); if (d) V.fabiOpen = !d.open; } });   // nhớ khi nhân viên tự bấm mở / gọn Phiếu Fabi
      const draw = (top, checked = false) => { V.checked = checked; const y = window.scrollY; root.innerHTML = str(shell()); bind(); if (top) window.scrollTo(0, 0); else window.scrollTo(0, y); };
      const soft = () => {
        V.checked = false;
        const mt = $('#cm-money-table'); if (mt) mt.innerHTML = str(commonMoney());
        const vb = $('#cm-verdict'); if (vb) vb.innerHTML = str(verdictBox()); const fs = $('#cm-fabi-sum'); if (fs) fs.innerHTML = str(fabiSum());
        const c = money(); for (const [item,gap] of [['tien_mat',c.tmLeft],['chuyen_khoan',c.ckLeft]]) { if (V.gaps[item]?.expected !== gap) delete V.gaps[item]; }
        const gaps = $('#cm-gap-choices'); if (gaps) gaps.innerHTML = str(gapChoices());
        // bước 74: không vẽ lại cả bước khi đang gõ (trước đây ô Số dư đầu bị nhảy / mất số) — chỉ ẩn / hiện ô lý do tại chỗ
        if (ORDER[V.step] === 11) { $('#cm-checks').innerHTML = str(fabiChecks().h); const w = $('#cm-open-wrap'); if (w) w.hidden = !money().startBad; }
        if (V.tried) { const e = stepError(); $('#cm-err').innerHTML = e ? str(html`<div class="alert error">${e}</div>`) : ''; }
      };
      let inFlight = false;
      const busy = async (fn) => { if (inFlight) return; inFlight = true; try { await fn(); } catch (e) { showSaved(e.message, true); } finally { inFlight = false; } };
      function bind() {
        $('#cm-check')?.addEventListener('click', () => { const e = stepError(11); if (e) { V.tried = true; $('#cm-err').innerHTML = str(html`<div class="alert error">${e}</div>`); $('#cm-err').scrollIntoView({block:'center'}); } else { draw(false, true); $('#cm-verdict')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
        $$('[data-shift-step]', root).forEach((b) => b.addEventListener('click', () => busy(async () => { await save(); V.step = [1, 2, 3, 4][Number(b.dataset.shiftStep)]; V.tried = false; draw(true); })));
        root.oninput = (ev) => { if (ev.target.matches('input,textarea,select') && !ev.target.matches('[data-gap-action]')) soft(); };
        bindMoneyInputs(root);
        loadPhotos();
        // bước 46: Chủ / Quản lý tổng tự chốt ca → phân loại (Chủ duyệt luôn) nghỉ / làm thay ngay tại đây
        const cvBox = $('#cm-cv');
        if (cvBox) {
          const cvCtx = { onChange: () => mountCover(cvBox, R, cvCtx) };
          rpc('app_cv_get', { p_id: R.id }).then((C) => { if (C && C.can_classify && C.state !== 'khong_can') { cvBox.hidden = false; mountCover(cvBox, R, cvCtx); } }).catch(() => {});
        }
        $('#cm-claim')?.addEventListener('click', () => busy(async () => {
          await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'tien', p_force: false });
          try { await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'nhan_su', p_force: false }); }
          catch (e) { if (!confirm(`${e.message}\n\nNhận luôn phần nhân sự để chốt cả phiếu?`)) throw e; await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'nhan_su', p_force: true }); }
          try { sessionStorage.setItem(key, JSON.stringify({ step: 1 })); } catch (_) { /* bỏ qua */ }
          flash('Bạn là người chốt ca này.'); rerender();
        }));
        $('#cm-force')?.addEventListener('click', () => busy(async () => {
          if (!confirm(`Nhận lại việc chốt ca từ ${PT.tien.claimed_name}? Người đó sẽ được báo và không sửa phiếu nữa.`)) return;
          await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'tien', p_force: true }); await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'nhan_su', p_force: true });
          try { sessionStorage.setItem(key, JSON.stringify({ step: 1 })); } catch (_) { /* bỏ qua */ }
          flash('Bạn đã nhận lại việc chốt ca này.'); rerender();
        }));
        $('#cm-nh-done')?.addEventListener('click', () => busy(async () => { const r = await rpc('app_ca_part_done', { p_id: R.id, p_part: 'nhan_hang', p_on: true }); flash(r.completed ? 'Phiếu đã hoàn thành.' : 'Đã xong phần nhận hàng.'); rerender(); }));
        $('#cm-undo')?.addEventListener('click', () => busy(async () => {
          await rpc('app_ca_part_done', { p_id: R.id, p_part: 'tien', p_on: false }); await rpc('app_ca_part_done', { p_id: R.id, p_part: 'nhan_su', p_on: false }).catch(() => {});
          try { sessionStorage.setItem(key, JSON.stringify({ step: STEPS.length - 1 })); } catch (_) { /* bỏ qua */ }
          rerender();
        }));
        const bindJump = () => $$('[data-jump]', root).forEach((b) => {
          if (b.dataset.bound) return; b.dataset.bound = '1';
          b.addEventListener('click', () => busy(async () => { await save(); V.step = ORDER.length - 1; V.tried = false; draw(true); }));
        });
        bindJump();
        $$('.cm-part', root).forEach((b) => b.addEventListener('click', () => busy(async () => {
          if (b.dataset.part === 'tien' && !V.viecDone) { showSaved('Làm xong phần việc (Ai làm ca, bàn giao…) rồi mới tới phần tiền.', true); return; }
          if (partOf(V.step) === b.dataset.part) return;
          await save(); V.step = b.dataset.part === 'tien' ? firstTien : 1; V.tried = false; draw(true);
        })));
        $('#cm-back')?.addEventListener('click', () => busy(async () => { await save(); V.step--; if (ORDER[V.step] === 10 && !hasCover()) V.step--; V.tried = false; draw(true); }));
        $('#cm-next')?.addEventListener('click', () => busy(async () => {
          const e = stepError();
          if (e) { V.tried = true; $('#cm-err').innerHTML = str(html`<div class="alert error">${e}</div>`); $('#cm-err').scrollIntoView({ block: 'nearest' }); return; }
          V.tried = false;
          if (V.step === lastViec) V.viecDone = true;   // bước 77: xong phần việc → mở phần tiền
          if (V.step < STEPS.length - 1) { const previousStep = V.step; if (ORDER[V.step] === 11) V.checked = true; V.step++; try { await save(); } catch (er) { V.step = previousStep; throw er; } draw(true, V.checked); showSaved(V.step === firstTien ? 'Đã xong phần việc — làm tiếp phần tiền' : 'Đã lưu'); return; }
          await save();
          if (!V.checked) throw new Error('Bấm Kiểm tra lại trước khi gửi phiếu.');
          const r = await rpc('app_ca_submit_unified', { p_id: R.id, p_gaps: V.gaps, p_categories: V.moves.filter((m) => m.kind !== 'doi_tien').map((m) => ({kind:m.kind,amount:m.amount,note:(m.note || '').trim(),category:m.category || null})) });
          try { sessionStorage.removeItem(key); } catch (_) { /* bỏ qua */ }
          flash(r.self_reconciled ? 'Đã gửi và hoàn thành đối soát. Nghỉ / làm thay tiếp tục nhắc trong Công việc.' : r.completed ? 'Đã gửi phiếu chốt ca. Quản lý sẽ đối soát.' : 'Đã gửi phần chốt ca.');
          rerender();
        }));
        // bước 1
        $$('[data-w]', root).forEach((b) => b.addEventListener('click', () => { V.staff[b.dataset.w].worked = b.dataset.v === '1'; draw(); }));
        $$('[data-t]', root).forEach((i) => i.addEventListener('input', () => { V.staff[i.dataset.t][i.dataset.k] = i.value || null; soft(); }));
        $$('[data-cash]', root).forEach((i) => i.addEventListener('input', () => { V.staff[i.dataset.cash].cash_paid = parseMoney(i.value); }));
        $$('[data-reason]', root).forEach((i) => i.addEventListener('input', () => { V.staff[i.dataset.reason].absent_reason = i.value; soft(); }));
        $$('[data-rm]', root).forEach((b) => b.addEventListener('click', () => { V.staff.splice(Number(b.dataset.rm), 1); draw(); }));
        // bước 48: người làm hộ — "Nhân viên trong quán" (người của cơ sở này lên trước) / "Nhân viên cũ" (đã ngừng làm); bấm tên để thêm
        $$('[data-hp]', root).forEach((b) => b.addEventListener('click', () => { HP.tab = HP.tab === b.dataset.hp ? '' : b.dataset.hp; HP.q = ''; draw(); }));
        if ($('#cm-help-list')) {
          const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
          const hit = (x, q) => !q || norm(x.code).startsWith(q) || norm(x.name).startsWith(q) || norm(x.name).split(/\s+/).some((y) => y.startsWith(q));
          const addEmp = (e) => {
            if (V.staff.some((st) => st.employee_id === e.id)) { showSaved('Người này đã có trong danh sách.', true); return; }
            V.staff.push({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank, source: 'ho_tro', worked: true, pay_cash: e.pay_cash, time_in: null, time_out: null });   // bước 74: người làm hộ để trống giờ
            showSaved(`Đã thêm ${e.code} – ${e.name}`); draw();
          };
          const showList = () => {
            const box = $('#cm-help-list'); if (!box || !HELP) return;
            const q = norm(HP.q); const free = (x) => !V.staff.some((st) => st.employee_id === x.id) && hit(x, q);
            const item = (x) => html`<button type="button" class="cm-hp-it" data-add-emp="${x.id}"><strong>${x.code} – ${x.name}</strong><span class="st-meta">${x.rank || ''}</span></button>`;
            const grp = (lbl, list) => (list.length ? html`<div class="cm-hp-g">${lbl} (${list.length})</div>${list.map(item)}` : '');
            const pool = HP.tab === 'old' ? HELP.former : HELP.active;
            const mine = pool.filter((x) => free(x) && (x.branches || []).includes(R.branch_id));
            const other = pool.filter((x) => free(x) && !(x.branches || []).includes(R.branch_id));
            box.innerHTML = str(mine.length + other.length
              ? html`${grp(HP.tab === 'old' ? `Từng làm ở ${R.branch_code || 'cơ sở này'}` : `Cơ sở ${R.branch_code || 'này'}`, mine)}${grp(HP.tab === 'old' ? 'Từng làm ở cơ sở khác' : 'Cơ sở khác', other)}`
              : html`<span class="st-meta">${q ? `Không thấy ai khớp "${HP.q}".` : 'Không còn ai để thêm.'}</span>`);
            const all = [...HELP.active, ...HELP.former];
            $$('[data-add-emp]', box).forEach((b) => b.addEventListener('click', () => addEmp(all.find((x) => String(x.id) === b.dataset.addEmp))));
          };
          $('#cm-helper').addEventListener('input', (e) => { HP.q = e.target.value; showList(); });
          if (HELP) showList();
          else rpc('app_ca_helpers').then((h) => { HELP = { active: h?.active || [], former: h?.former || [] }; showList(); }).catch((e) => { const b = $('#cm-help-list'); if (b) b.textContent = e.message; });
        }
        // bước 2
        $('#cm-photo')?.addEventListener('change', (ev) => busy(async () => {
          const files = [...ev.target.files]; if (!files.length) return;
          await save();
          for (let i = 0; i < files.length; i++) {
            $('#cm-ph-st').textContent = `Đang tải ảnh ${i + 1}/${files.length}…`;
            const blob = await compressImage(files[i]);
            const path = `r${R.id}/ipos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
            if (error) throw new Error(error.message);
            const id = await rpc('app_ca_photo_add', { p_id: R.id, p_path: path, p_kind: 'ipos' });
            photos.push({ id, path, kind: 'ipos' });
          }
          draw();
        }));
        $$('.cm-photos .ph-del', root).forEach((b) => b.addEventListener('click', () => busy(async () => {
          if (!confirm('Xóa ảnh này?')) return;
          const path = await rpc('app_ca_photo_del', { p_photo: Number(b.dataset.id) }); if (path) await sb.storage.from(BUCKET).remove([path]);
          photos.splice(photos.findIndex((p) => String(p.id) === b.dataset.id), 1); draw();
        })));
        $('#cm-open')?.addEventListener('input', (e) => { V.open = e.target.value; soft(); });
        $('#cm-close')?.addEventListener('input', (e) => { V.close = e.target.value; soft(); });
        $$('.cm-num', root).forEach((i) => i.addEventListener('input', () => { const k = i.dataset.f; const n = parseMoney(i.value); V.f[k] = n === null ? null : k === 'pos_diff' ? n * V.sign : n; soft(); }));
        $$('[data-sign]', root).forEach((b) => b.addEventListener('click', () => { V.sign = Number(b.dataset.sign); if (V.f.pos_diff !== null) V.f.pos_diff = Math.abs(V.f.pos_diff) * V.sign; draw(); }));
        $('#cm-open-note')?.addEventListener('input', (e) => { V.opening_note = e.target.value; soft(); });
        // bước 3
        $('#cm-add-debt')?.addEventListener('click', () => { V.debts.push({ table_name: '', amount: null, note: '', kind: '' }); draw(); });
        $$('[data-dk]', root).forEach((b) => b.addEventListener('click', () => { V.debts[b.dataset.dk].kind = b.dataset.v; draw(); }));
        $$('[data-db]', root).forEach((i) => i.addEventListener('input', () => {
          const d = V.debts[i.dataset.db]; d[i.dataset.k] = i.dataset.k === 'amount' ? parseMoney(i.value) : i.value;
          const s = $('#cm-debt-sum'); if (s && i.dataset.k === 'amount') { const c = money(); const ok = billSum() === (V.f.pos_debt || 0); s.className = `alert ${ok ? 'ok' : 'warn'}`;
            s.innerHTML = str(html`${ok ? '✅' : '⚠️'} Nợ HĐ đã ghi <b>${fmt(billSum())}</b> ${ok ? '=' : '≠'} Nợ trên phiếu Fabi (${fmt(V.f.pos_debt || 0)})${c.loanOut ? html`<br>Nợ TM <b>${fmt(c.loanOut)}</b> → trừ tiền két` : ''}${c.ckOut ? html`<br>Nợ CK <b>${fmt(c.ckOut)}</b> → trừ tiền hotline` : ''}`); }
          soft();
        }));
        $$('[data-dbx]', root).forEach((b) => b.addEventListener('click', () => { V.debts.splice(Number(b.dataset.dbx), 1); draw(); }));
        $$('[data-dwho]', root).forEach((sel) => sel.addEventListener('change', () => {   // bước 133: chọn người nợ → đúng nhóm Công nợ
          const d = V.debts[Number(sel.dataset.dwho)]; const o = sel.selectedOptions[0];
          if (!sel.value) { if (d.grp && d.grp !== 'khach') d.table_name = ''; d.grp = 'khach'; }
          else { if (!d.note && d.table_name && (!d.grp || d.grp === 'khach')) d.note = d.table_name; d.table_name = sel.value; d.grp = o.dataset.grp || 'khac'; }
          draw();
        }));
        $$('[data-unpay]', root).forEach((b) => b.addEventListener('click', () => { const sel = $(`[data-paid="${b.dataset.unpay}"]`, root); if (sel) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); } }));
        $$('[data-paid]', root).forEach((s) => s.addEventListener('change', () => busy(async () => {
          await save();
          const d = R.open_debts.find((x) => String(x.id) === s.dataset.paid); const am = $(`[data-paidamt="${s.dataset.paid}"]`, root);
          const amt = am ? parseMoney(am.value || '0') : Number(d.amount);
          if (s.value) {
            await rpc('app_ca_debt_collect_part', { p_debt: Number(s.dataset.paid), p_report: R.id, p_kind: s.value, p_amount: amt, p_note: null });
            if (amt < Number(d.amount)) { showSaved('Đã lưu — khách trả một phần, phần còn lại vẫn nhắc ở ca sau.'); rerender(); return; }
          } else await rpc('app_ca_debt_collect', { p_debt: Number(s.dataset.paid), p_report: R.id, p_kind: null, p_note: null });
          if (s.value) { d.closed_at = 'x'; d.closed_report_id = R.id; d.collect_kind = s.value; } else { d.closed_at = null; d.closed_report_id = null; d.collect_kind = null; }
          showSaved('Đã lưu'); soft();
        })));
        // bước 4
        // Ô tiền tự thêm dấu chấm khi gõ nên trình duyệt không phát 'change' → nghe 'input', chỉ vẽ lại khung so sánh (không mất cú bấm "Tiếp")
        const bindCkNote = () => $('#cm-ck-note')?.addEventListener('input', (e) => { V.transfer_note = e.target.value; soft(); });
        // lệch chuyển khoản → tạo phiếu chi / thu chuyển khoản ngay (thêm vào Thu chi của ca)
        const bindCkMv = () => $('#cm-ckmv')?.addEventListener('click', () => busy(async () => {
          const note = ($('#cm-ckmv-note')?.value || '').trim(); const gap = money().ckLeft;
          if (!note) { $('#cm-ckmv-err').innerHTML = str(html`<div class="alert error">Ghi nội dung phiếu (chi gì / thu gì).</div>`); return; }
          if (!gap) return;
          V.moves.push({ kind: 'chuyen_khoan', amount: gap, note }); V.noMoves = false;
          await save(); $('#cm-ck-box').innerHTML = str(ckBox()); bindCkNote(); bindJump(); bindCkMv(); soft();
          showSaved(`Đã tạo phiếu ${gap < 0 ? 'chi' : 'thu'} chuyển khoản ${fmt(Math.abs(gap))}đ`);
        }));
        $('#cm-hot')?.addEventListener('input', (e) => { V.reported_transfer = parseMoney(e.target.value); $('#cm-ck-box').innerHTML = str(ckBox()); bindCkNote(); bindJump(); bindCkMv(); soft(); });
        bindCkNote(); bindCkMv();
        // Thu / chi / đổi tiền dùng chung một danh sách.
        $$('[data-new-move]', root).forEach((b) => b.addEventListener('click', () => { V.moves.push({kind:'tien_mat',amount:null,note:'',sign:Number(b.dataset.newMove)}); draw(); }));
        $('#cm-exchange')?.addEventListener('click', () => { V.moves.push({kind:'doi_tien',amount:null,note:'',exchange_key:newExchangeKey(),dir:'tm_ck'}); draw(); });
        $$('[data-xdir]', root).forEach((b) => b.addEventListener('click', () => { V.moves[Number(b.dataset.xdir)].dir = b.dataset.v; draw(); }));
        $$('[data-tono]', root).forEach((x) => x.addEventListener('click', () => {   // bước 116: khoản Thu / Chi → Báo nợ (TM → khách mượn tiền mặt, CK → nợ chuyển khoản)
          const i = Number(x.dataset.tono); const m = V.moves[i];
          V.moves.splice(i, 1); V.debts.push({ table_name: (m.note || '').trim(), amount: m.amount ? Math.abs(Number(m.amount)) : null, note: '', kind: m.kind === 'chuyen_khoan' ? 'ck' : 'muon' });
          if (!V.moves.length) V.noMoves = false; draw(); showSaved('Đã đổi thành Báo nợ — kiểm tra tên khách và TM / CK.');
        }));
        $$('[data-exchange]', root).forEach((x) => x.addEventListener('click', () => { const m = V.moves[x.dataset.exchange]; m.dir = (m.kind === 'tien_mat') === (Number(m.amount) > 0) ? 'ck_tm' : 'tm_ck'; m.kind = 'doi_tien'; m.amount = Math.abs(m.amount || 0); m.exchange_key = newExchangeKey(); delete m.category; draw(); }));
        $$('[data-mkind]', root).forEach((x) => x.addEventListener('change', () => { const m = V.moves[x.dataset.mkind]; m.kind = x.value.endsWith('ck') ? 'chuyen_khoan' : 'tien_mat'; m.sign = x.value.startsWith('thu') ? 1 : -1; m.amount = m.amount == null ? null : Math.abs(m.amount) * m.sign; delete m.category; draw(); }));
        root.onchange = (e) => { const x = e.target.closest('[data-gap-action]'); if (x) { const c = money(); V.gaps[x.dataset.gapAction] = {action:x.value, expected:x.dataset.gapAction === 'tien_mat' ? c.tmLeft : c.ckLeft}; draw(); } };
        $$('[data-mcat]', root).forEach((x) => x.addEventListener('change', () => { V.moves[x.dataset.mcat].category = x.value; soft(); }));
        // bước 116: danh sách khách đang nợ — dùng cho "+ Thu nợ" và "Đổi thành Thu nợ" (conv = vị trí khoản Thu / Chi đang đổi)
        const pickDebt = (conv = null) => {
          const m0 = conv === null ? null : V.moves[conv]; const amt0 = m0 ? Math.abs(Number(m0.amount) || 0) : 0;
          const list = oldAll().filter((d) => !d.family && !d.closed_at);
          const d = dialog(html`<div class="stack" style="gap:12px"><h2>${m0 ? 'Đổi thành Thu nợ — khách nào trả?' : 'Khách nào trả nợ?'}</h2>${m0 ? html`<div class="st-meta">Khoản đang đổi: <b>${Number(m0.amount) > 0 || m0.sign === 1 ? 'Thu' : 'Chi'} ${m0.kind === 'chuyen_khoan' ? 'CK' : 'TM'} ${fmt(amt0)}</b> "${m0.note || ''}". Chọn khách, chọn trả TM / CK.</div>` : ''}<input class="input" id="cp-find" placeholder="Tìm tên khách / bàn" aria-label="Tìm khách nợ"><div id="cp-list" class="stack"></div><button class="btn secondary" id="cp-close">Đóng</button></div>`);
          const paint = () => { const q = d.querySelector('#cp-find').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase(); const rows = list.filter((x) => (x.table_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().includes(q));
            d.querySelector('#cp-list').innerHTML = str(html`${rows.length ? rows.map(debtPayRow) : html`<p>Không có khoản nợ phù hợp.</p>`}`);
            if (m0) d.querySelectorAll('[data-paidamt]').forEach((x) => { const debt = list.find((y) => String(y.id) === x.dataset.paidamt); x.value = fmt(Math.min(amt0, Number(debt.amount))); });
            d.querySelectorAll('[data-paid]').forEach((sel) => sel.addEventListener('change', async () => {
              if (!sel.value) return; sel.disabled = true; const keep = m0 ? V.moves.slice() : null;
              try {
                const debt = list.find((x) => String(x.id) === sel.dataset.paid); const amt = parseMoney(d.querySelector(`[data-paidamt="${sel.dataset.paid}"]`).value);
                if (m0) { const rest = amt0 - amt; if (rest > 0) m0.amount = (Number(m0.amount) < 0 ? -1 : 1) * rest; else V.moves.splice(conv, 1); }
                await save(); await rpc('app_ca_debt_collect_part', {p_debt:debt.id,p_report:R.id,p_kind:sel.value,p_amount:amt,p_note:null}); d.close(); rerender();
              } catch(e) { if (keep) { V.moves = keep; await save().catch(() => {}); } sel.disabled = false; showSaved(e.message,true); } })); bindMoneyInputs(d); };
          d.querySelector('#cp-find').addEventListener('input',paint); d.querySelector('#cp-close').onclick = () => d.close(); paint();
        };
        $('#cm-pick-debt')?.addEventListener('click', () => pickDebt());
        $$('[data-tothu]', root).forEach((x) => x.addEventListener('click', () => { const m = V.moves[Number(x.dataset.tothu)]; if (!Number(m.amount)) { showSaved('Ghi số tiền trước rồi mới đổi.', true); return; } pickDebt(Number(x.dataset.tothu)); }));
        // bước 5
        $('#cm-add-move')?.addEventListener('click', () => { V.moves.push({ kind: 'tien_mat', amount: null, note: '', sign: -1 }); V.noMoves = false; draw(); });
        $('#cm-add-ckmove')?.addEventListener('click', () => { V.moves.push({ kind: 'chuyen_khoan', amount: null, note: '', sign: -1 }); V.noMoves = false; draw(); });
        $('#cm-nomoves')?.addEventListener('change', (e) => { V.noMoves = e.target.checked; soft(); });
        $$('[data-mt]', root).forEach((b) => b.addEventListener('click', () => { const m = V.moves[b.dataset.mt]; m.sign = Number(b.dataset.v); m.amount = m.amount ? Math.abs(Number(m.amount)) * m.sign : null; draw(); }));
        $$('[data-mx]', root).forEach((b) => b.addEventListener('click', () => { V.moves.splice(Number(b.dataset.mx), 1); draw(); }));
        $$('[data-mv]', root).forEach((i) => i.addEventListener('input', () => {
          const m = V.moves[i.dataset.mv];
          if (i.dataset.k === 'note') m.note = i.value;
          else { const n = parseMoney(i.value); const sg = m.kind === 'doi_tien' ? 1 : m.sign || (Number(m.amount) > 0 ? 1 : -1); m.amount = n === null ? null : n * sg; }
          soft();
        }));
        // bước 6–8
        $('#cm-cups')?.addEventListener('input', (e) => { const d = e.target.value.replace(/\D/g, ''); V.cups = d === '' ? null : Number(d); soft(); });
        $('#cm-diff-note')?.addEventListener('input', (e) => { V.diff_note = e.target.value; soft(); });
        $('#cm-add-ho')?.addEventListener('click', () => { V.handover.push({ content: '' }); draw(); });
        $$('[data-ho]', root).forEach((t) => t.addEventListener('input', () => { V.handover[t.dataset.ho].content = t.value; }));
        $$('[data-hox]', root).forEach((b) => b.addEventListener('click', () => { V.handover.splice(Number(b.dataset.hox), 1); draw(); }));
        $$('[data-hodone]', root).forEach((b) => b.addEventListener('click', () => busy(async () => {
          await save(); await rpc('app_ca_handover_done', { p_item: Number(b.dataset.hodone), p_report: R.id, p_done: !b.dataset.undo });
          const h = R.carried.find((x) => String(x.id) === b.dataset.hodone); h.done_at = b.dataset.undo ? null : 'x'; draw();
        })));
      }
      async function loadPhotos() {
        const figs = $$('.cm-photos figure[data-path]', root); if (!figs.length) return;
        const { data } = await sb.storage.from(BUCKET).createSignedUrls(figs.map((f) => f.dataset.path), 3600);
        const u = new Map((data || []).map((x) => [x.path, x.signedUrl]));
        figs.forEach((f) => { const url = u.get(f.dataset.path); if (url) { f.querySelector('img').src = url; f.querySelector('a').href = url; } });
      }
      bind();
    },
  };
}

const CM_CSS = html`<style>
  .ph-wrap { max-width: 560px; margin: 0 auto; }   /* bước 91: máy tính hiện giống điện thoại — 1 cột hẹp ở giữa */
  .cm-col { max-width: 560px; display: flex; flex-direction: column; gap: 12px; }
  .cm-card { gap: 10px; }
  .cm-sh { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .cm-n { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
  .cm-steps { display: flex; gap: 3px; width: 100%; } .cm-steps i { flex: 1; height: 5px; border-radius: 3px; background: var(--line); }
  .cm-parts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cm-part { font: inherit; color: inherit; text-align: left; background: var(--card); border: 2px solid var(--line); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; min-width: 0; }
  .cm-part.cur { border-color: var(--primary); background: var(--caramel-soft); } .cm-part.done { border-color: var(--ok-line); background: var(--ok-bg); }
  .cm-part.lock { opacity: .6; cursor: not-allowed; }
  .cm-pn { font-weight: 800; font-size: 14px; } .cm-ps { font-size: 12px; color: var(--ink-2); }
  .cm-steps i.done { background: var(--ok-line); } .cm-steps i.cur { background: var(--primary); }
  .cm-nav { display: flex; gap: 8px; } .cm-nav .btn { flex: 1; min-height: 46px; }
  .cm-mobile-head { background: var(--forest); color: #fff; border-radius: 18px; padding: 16px 18px; margin-bottom: 12px; align-items: flex-start; }
  .cm-mobile-head a { color: inherit; font-size: 13px; font-weight: 600; opacity: .9; }
  .cm-mobile-head .cm-head-label { display: block; margin-top: 12px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .78; }
  .cm-mobile-head h1 { color: inherit; margin: 3px 0 0; font-size: 22px; }
  .cm-mobile-head small { display: block; margin-top: 5px; font-size: 12px; opacity: .82; }
  .cm-four-steps { grid-template-columns: repeat(4,minmax(0,1fr)); }
  .cm-review-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
  .cm-review-row:last-child { border-bottom: 0; }
  .cm-review-row b { text-align: right; }
  .cm-fabi { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 170px); gap: 8px 10px; align-items: center; }
  .cm-lab { font-size: 14px; font-weight: 600; } .cm-lab small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; }
  .cm-fabi .input.money { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cm-signed { display: flex; gap: 4px; min-width: 0; } .cm-signed .input { min-width: 0; flex: 1; }
  .cm-checks { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .cm-person { border: 1px solid var(--line); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .cm-pay { display: flex; gap: 6px; flex-wrap: wrap; } .cm-pay .cm-paidamt { flex: 0 1 130px; width: auto; min-width: 0; } .cm-pay select { flex: 1 1 160px; width: auto; min-width: 0; }
  .cm-ph { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; }
  .cm-times { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 13px; color: var(--muted); }
  .cm-times label { display: inline-flex; gap: 4px; align-items: center; } .cm-times input[type=time] { width: 110px; }
  .cm-seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 10px; overflow: hidden; flex: none; }
  .cm-seg button { border: 0; background: var(--card); color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; padding: 7px 12px; min-height: 38px; cursor: pointer; }
  .cm-seg button[aria-pressed="true"] { background: var(--forest); color: #fff; }
  .cm-line { display: grid; grid-template-columns: minmax(0, 1fr) 120px auto; gap: 6px; align-items: center; }
  .cm-line .cm-wide { grid-column: 1 / -1; grid-row: 2; }
  .cm-line2 { display: grid; grid-template-columns: minmax(0, 1fr) 130px; gap: 6px; align-items: center; }
  .cm-big { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .cm-ckkv { grid-template-columns: minmax(0, 1fr) auto; } .cm-ckkv > div:nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; } .cm-ckkv > .cm-ckt { border-top: 2px solid currentColor; padding-top: 4px; font-weight: 800; }
  .cm-dkk { display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.45; } .cm-dkk b:first-child { display: inline-block; min-width: 30px; }
  .cm-dk { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; } .cm-dk .input { flex: 1 1 150px; min-width: 0; width: auto; }
  .cm-debt .cm-line { grid-template-columns: minmax(0, 1fr) 120px auto; }
  .cm-real .kv > .cm-sub { padding-left: 14px; font-size: 13px; color: var(--ink-2); } .cm-real .kv > .cm-p { color: var(--ok-ink); } .cm-real .kv > .cm-m { color: #b91c1c; }
  .cm-real .kv > .cm-t { border-top: 2px solid currentColor; padding-top: 6px; margin-top: 4px; font-weight: 800; }
  .cm-ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  .cm-hp { display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--line); padding-top: 10px; }
  .cm-hp-tabs { align-self: flex-start; max-width: 100%; } .cm-hp-tabs button { white-space: nowrap; }
  .cm-hlist { display: flex; flex-direction: column; gap: 4px; max-height: 55vh; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; padding: 6px; }
  .cm-hp-g { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--muted); padding: 6px 4px 2px; }
  .cm-hp-it { display: flex; justify-content: space-between; gap: 8px; align-items: center; text-align: left; font: inherit; font-size: 14px; background: var(--card); color: var(--ink);
    border: 1px solid var(--line-soft, var(--line)); border-radius: 8px; padding: 9px 10px; cursor: pointer; min-height: 42px; }
  .cm-hp-it:active { background: var(--line-soft); } .cm-hp-it strong { min-width: 0; overflow-wrap: anywhere; }
  .cm-real { display: flex; flex-direction: column; gap: 10px; } .cm-rc { border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
  .cm-rc .kv { grid-template-columns: minmax(0, 1fr) auto; } .cm-rc .kv > div:nth-child(even) { text-align: right; font-variant-numeric: tabular-nums; } .cm-rt { background: var(--subtle, var(--line-soft)); }
  .cm-phrow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .cm-photos { display: flex; gap: 6px; flex-wrap: wrap; }
  .cm-thumb { position: relative; margin: 0; width: 76px; height: 76px; flex: none; background: var(--line-soft); border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  .cm-thumb a { display: block; width: 100%; height: 100%; }
  .cm-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cm-thumb .ph-del { position: absolute; top: 3px; right: 3px; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(0,0,0,.6); color: #fff; font-size: 15px; line-height: 1; cursor: pointer; padding: 0; }
  .cm-phact { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; min-width: 0; }
  @media (max-width: 420px) { .ph-wrap.sc-wrap { padding-inline: 0; } .cm-mobile-head { border-radius: 0 0 20px 20px; margin-inline: -12px; margin-top: -12px; } .cm-fabi { grid-template-columns: minmax(0, 1fr) minmax(0, 140px); } .cm-line { grid-template-columns: minmax(0, 1fr) 105px auto; } .cm-line2 { grid-template-columns: minmax(0, 1fr) 110px; } }
</style>`;
