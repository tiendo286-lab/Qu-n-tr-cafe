// Bước 41 — Chốt ca mới (anh Tiến chốt 12/11/2026): 1 người chốt chính, gõ số theo đúng thứ tự trên phiếu Fabi,
// web tự kiểm tra từng bước; người khác trong ca chỉ giúp phần nhận hàng. Máy chủ kiểm tra lại khi GỬI (app__ca_part_check).
import { render as rerender } from './app.js';
import { CV_CSS, mountCover } from './nghi_thay.js';
import { mountDeliveries, NH_CSS } from './nhap_hang.js';
import { rpc, sb } from './sb.js';
import { bindMoneyInputs, compressImage, dmy, dt, fmt, noKind, noName, parseMoney, signed } from './tien.js';
import { $, $$, flash, html, showSaved, str } from './ui.js';

const BUCKET = 'phieu-ca';
const GOI_DAU = 1000000;
// Nội dung từng bước theo mã (B[mã], stepError); thứ tự hiện ra theo ORDER — ghi hết các khoản tiền (Thu chi) TRƯỚC khi đối chiếu
// chuyển khoản hotline, để không phải lùi lại khi thu chi / khách trả tiền mượn bằng chuyển khoản làm lệch (anh Tiến chốt 12/11/2026)
const LABEL = ['Nhận chốt ca', 'Ai làm ca', 'Phiếu Fabi', 'Khách nợ trong ca', 'Chuyển khoản hotline', 'Thu chi trong ca', 'Số cốc', 'Kết quả tiền', 'Bàn giao & nhận hàng', 'Kết quả tiền & gửi phiếu'];
// Bước 77 (anh Tiến chốt 13/11): phiếu chia 2 phần — ① PHẦN VIỆC (Ai làm ca · Số cốc · Bàn giao & nhận hàng) làm trước,
// ② PHẦN TIỀN (Fabi · Khách nợ · Thu chi · Chuyển khoản · Kết quả tiền · Kiểm tra) mở khi xong phần việc. Nhận hàng không chặn phần tiền.
const ORDER_ALL = [0, 1, 6, 8, 2, 3, 5, 4, 9];   // bước 84: gộp Kết quả tiền (7) vào bước cuối (9)   // cơ sở dùng Fabi bỏ bước Số cốc (mã 6) — số cốc lấy theo file Fabi (bước 49)
const VIEC = [1, 6, 8]; const TIEN = [2, 3, 5, 4, 9];
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
  let fabiBranch = true; try { fabiBranch = !!(await rpc('app_ca_kt_state', { p_id: R0.id }))?.need; } catch (_) { /* chưa có bước 44 */ }
  const ORDER = fabiBranch ? ORDER_ALL.filter((k) => k !== 6) : ORDER_ALL;
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
    open: hm(R.rev_start ? R.rev_start.slice(11) : ''), close: hm(R.rev_end ? R.rev_end.slice(11) : ''),
    f: { ipos_opening: num(R.ipos_opening), total_revenue: num(R.total_revenue), pos_transfer: num(R.pos_transfer), pos_cash: num(R.pos_cash),
      pos_debt: num(R.pos_debt), cash_counted: num(R.cash_counted), pos_diff: num(R.pos_diff) },
    sign: Number(R.pos_diff) < 0 ? -1 : 1,
    opening_note: R.opening_note || '', debts: (R.debts || []).map((d) => ({ ...d })), reported_transfer: num(R.reported_transfer), transfer_note: R.transfer_note || '',
    moves: (R.moves || []).map((m) => ({ ...m })), noMoves: !!mem.noMoves, cups: num(R.cups), diff_note: R.diff_note || '',
    handover: (R.handover || []).map((h) => ({ ...h })), tried: false,
  };
  const photos = (R.photos || []).filter((p) => p.kind === 'ipos');
  // bước 77: phần việc xong (đã bấm "Xong phần việc", hoặc phiếu đã có số tiền) thì mới mở phần tiền
  V.viecDone = !!mem.viecDone || V.f.ipos_opening !== null || photos.length > 0;
  if (tienMine && !waiting && mem.code != null && ORDER.includes(Number(mem.code))) V.step = ORDER.indexOf(Number(mem.code));
  if (V.step >= firstTien && !V.viecDone) V.step = Math.min(1, V.step);
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
    const loanOut = sum(V.debts.filter(isLoan), (d) => d.amount); const ckOut = sum(V.debts.filter(isCK), (d) => d.amount);
    const sal = sum(V.staff.filter((s) => s.worked && s.pay_cash), (s) => parseMoney(s.cash_paid) || 0);
    const mvTM = sum(V.moves.filter((m) => m.kind === 'tien_mat'), (m) => m.amount); const mvCK = sum(V.moves.filter((m) => m.kind === 'chuyen_khoan'), (m) => m.amount);
    const op = first ? GOI_DAU : f.ipos_opening;
    const ok = (...k) => k.every((x) => f[x] !== null);
    return {
      colTM, colTMbill, colTMloan, loanOut, ckOut, colCK, sal, mvTM, mvCK,
      sumGap: ok('total_revenue', 'pos_cash', 'pos_transfer', 'pos_debt') ? f.pos_cash + f.pos_transfer + f.pos_debt - f.total_revenue : null,
      diffGap: ok('cash_counted', 'ipos_opening', 'pos_cash', 'pos_diff') ? f.cash_counted - f.ipos_opening - f.pos_cash - colTMbill - f.pos_diff : null,
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
      rev_start: R.forced_start || toDT(R.work_date, V.open), rev_end: toDT(R.work_date, V.close),
      total_revenue: V.f.total_revenue, pos_cash: V.f.pos_cash, pos_transfer: V.f.pos_transfer, cash_counted: V.f.cash_counted,
      ipos_opening: V.f.ipos_opening, opening_cash: V.f.ipos_opening, pos_debt: V.f.pos_debt, pos_diff: V.f.pos_diff,
      opening_note: V.opening_note.trim() || null, reported_transfer: V.reported_transfer, transfer_note: V.transfer_note.trim() || null,
      cups: V.cups, diff_note: V.diff_note.trim() || null,
      moves: V.moves.map((m) => ({ kind: m.kind, amount: m.amount, note: (m.note || '').trim() })),
      staff: V.staff.map((s) => ({ employee_id: s.employee_id, source: s.source, role: s.role || null, worked: !!s.worked, time_in: s.worked ? s.time_in || null : null,
        time_out: s.worked ? s.time_out || null : null, absent_reason: s.worked ? null : (s.absent_reason || '').trim() || null, note: s.note || null, cash_paid: s.pay_cash && s.worked ? parseMoney(s.cash_paid) : null })),
      handover: V.handover.filter((h) => !h.task_id).map((h) => ({ id: h.id || null, content: h.content || '' })),
      debts: V.debts.map((d) => ({ id: d.id || null, table_name: d.table_name || '', amount: d.amount, note: d.note || '', kind: d.kind || 'bill' })),
      goods: (R.goods || []).map((g) => ({ item: g.item, qty: g.qty })), goods_status: R.goods_status || null, goods_note: R.goods_note || null,
    };
  }
  async function save() {
    if (!tienMine || waiting) return;
    const r = await rpc('app_ca_save', { p_id: R.id, p: payload() });
    const ho = V.handover.filter((h) => !h.task_id); (r.handover_ids || []).forEach((id, i) => { if (ho[i] && id) ho[i].id = id; });
    (r.debt_ids || []).forEach((id, i) => { if (V.debts[i] && id) V.debts[i].id = id; });
    try { sessionStorage.setItem(key, JSON.stringify({ step: V.step, noMoves: V.noMoves, viecDone: V.viecDone })); } catch (_) { /* bỏ qua */ }
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
      const lhs = V.f.cash_counted - V.f.ipos_opening - V.f.pos_cash - c.colTMbill;
      if (c.diffGap === 0) out.push(html`<div>✅ Tổng tiền − Số dư đầu − Tiền mặt${c.colTMbill ? ' − khách trả nợ tiền mặt' : ''} = <b>${signed(lhs)}</b> = Tiền chênh lệch</div>`);
      else { bad = true; out.push(html`<div>🔴 Tổng tiền − Số dư đầu − Tiền mặt${c.colTMbill ? ' − khách trả nợ tiền mặt' : ''} = <b>${signed(lhs)}</b>, khác Tiền chênh lệch <b>${signed(V.f.pos_diff)}</b>.${(() => { const hit = oldBills().filter((d) => !d.closed_at && Number(d.amount) === c.diffGap);
          return hit.length ? html`<br>💡 Có thể khách <b>bàn ${hit.map((d) => d.table_name).join(' / ')}</b> (${fmt(c.diffGap)}) đã trả nợ tiền mặt — chọn "Trả bằng tiền mặt" ở mục <b>Khách trả nợ cũ</b> ngay bên dưới.`
            : oldBills().length ? ' Bạn gõ nhầm 1 số, hoặc có khách trả nợ cũ bằng tiền mặt (chọn ở mục Khách trả nợ cũ bên dưới).' : ' Bạn gõ nhầm 1 số, xem lại phiếu.'; })()}</div>`); }
    }
    return { h: out.length ? html`<div class="alert ${bad ? 'error' : c.startBad ? 'warn' : 'ok'} cm-checks">${out}</div>` : '', bad, all: Object.values(V.f).every((x) => x !== null) };
  }
  // Khung so sánh chuyển khoản hotline (vẽ lại riêng khi gõ)
  function ckBox() {   // bước 84: tính cả Nợ CK mới; lệch không bắt ghi lý do — quản lý kiểm tra khi đối soát
    const c = money(); const bad = c.ckLeft !== null && c.ckLeft !== 0;
    return html`<div class="alert ${V.reported_transfer === null ? 'info' : bad ? 'error' : 'ok'}">Phải thấy: chuyển khoản trên phiếu <b>${fmt(V.f.pos_transfer)}</b>${c.colCK ? html` + khách trả nợ chuyển khoản <b>${fmt(c.colCK)}</b>` : ''}${c.mvCK ? html` + thu chi chuyển khoản <b>${signed(c.mvCK)}</b>` : ''}${c.ckOut ? html` − Nợ CK mới <b>${fmt(c.ckOut)}</b>` : ''} = <b>${fmt(c.ckExp)}</b>
        ${V.reported_transfer === null ? '' : bad ? html`<br>🔴 Bạn nhập ${fmt(V.reported_transfer)}, lệch <b>${signed(c.ckLeft)}</b>` : html`<br>✅ Khớp`}</div>
      ${bad ? html`<div class="st-meta">Lệch thì cộng lại các giao dịch trên hotline. Quên ghi khoản thu / chi chuyển khoản? <button type="button" class="btn sm secondary" data-jump="5">Về bước Thu chi</button> · Khách ấn nhầm chuyển khoản mà chưa chuyển? <button type="button" class="btn sm secondary" data-jump="3">Về bước Khách nợ</button></div>
        <label class="pc-f"><span>Ghi chú (không bắt buộc — quản lý kiểm tra khi đối soát)</span><input class="input" id="cm-ck-note" value="${V.transfer_note}" placeholder="vd: 1 khách chuyển nhầm sang tài khoản khác"></label>` : ''}`;
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
    0: () => html`<div class="st-meta">Mỗi ca chỉ <strong>1 người chốt chính</strong>, chịu trách nhiệm cả phiếu. Người khác trong ca chỉ giúp phần nhận hàng.</div>
      <div class="kv"><div>Cơ sở</div><div>${R.branch_code || ''} ${R.branch_name || ''}</div><div>Ca</div><div>${R.shift} · ${dmy(R.work_date)}</div></div>
      ${tienOther ? html`<div class="alert info"><strong>${PT.tien.claimed_name}</strong> đang chốt ca này (nhận lúc ${dt(PT.tien.claimed_at)}). Bạn giúp được phần nhận hàng ở dưới.</div>
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
      <div class="st-meta">Có người nghỉ hoặc làm hộ thì quản lý tổng phân loại lý do khi đối soát.</div>`,
    2: () => {
      const ch = fabiChecks();
      return html`<div class="st-meta">Chụp phiếu chốt ca Fabi trước, rồi gõ <strong>lần lượt từ trên xuống</strong> đúng như trên phiếu.</div>
        <div class="cm-phrow"><div class="cm-photos">${photos.map((p) => html`<figure class="cm-thumb" data-path="${p.path}"><a target="_blank" rel="noopener" aria-label="Xem ảnh to"><img alt="Ảnh phiếu Fabi" loading="lazy"></a><button type="button" class="ph-del" data-id="${p.id}" aria-label="Xóa ảnh">×</button></figure>`)}</div>
          <div class="cm-phact">${photos.length ? html`<span class="pill ok">Đã có ${photos.length} ảnh ✓</span>` : ''}
            <label class="btn sm secondary">📷 ${photos.length ? 'Chụp thêm ảnh' : 'Chụp phiếu chốt ca Fabi'}<input type="file" id="cm-photo" accept="image/*" multiple hidden></label><span class="st-meta" id="cm-ph-st"></span></div></div>
        <div class="cm-fabi">
          ${R.forced_start ? '' : html`<div class="cm-lab">Mở ca<small>giờ trên phiếu</small></div><input class="input" type="time" id="cm-open" value="${V.open}" aria-label="Mở ca">`}
          <div class="cm-lab">Đóng ca (POS)<small>giờ trên phiếu</small></div><input class="input" type="time" id="cm-close" value="${V.close}" aria-label="Đóng ca">
          <div class="cm-lab">Số dư đầu</div>${moneyIn('ipos_opening', V.f.ipos_opening, 'Số dư đầu')}
          <div class="cm-lab">Doanh thu (NET)</div>${moneyIn('total_revenue', V.f.total_revenue, 'Doanh thu NET')}
          <div class="cm-lab">CHUYỂN KHOẢN<small>trong "Phương thức thanh toán"</small></div>${moneyIn('pos_transfer', V.f.pos_transfer, 'Chuyển khoản')}
          <div class="cm-lab">Tiền mặt<small>trong "Phương thức thanh toán"</small></div>${moneyIn('pos_cash', V.f.pos_cash, 'Tiền mặt')}
          <div class="cm-lab">Nợ<small>không có dòng này thì nhập 0</small></div>${moneyIn('pos_debt', V.f.pos_debt, 'Nợ')}
          <div class="cm-lab">Tổng tiền<small>cuối phiếu, "Số tiền thực tế trong két"</small></div>${moneyIn('cash_counted', V.f.cash_counted, 'Tổng tiền')}
          <div class="cm-lab">Tiền chênh lệch<small>dòng cuối phiếu, có dấu + hoặc −</small></div>
          <div class="cm-signed"><div class="cm-seg"><button type="button" data-sign="1" aria-pressed="${V.sign > 0}" aria-label="Dương">+</button><button type="button" data-sign="-1" aria-pressed="${V.sign < 0}" aria-label="Âm">−</button></div>${moneyIn('pos_diff', V.f.pos_diff, 'Tiền chênh lệch')}</div>
        </div>
        <div id="cm-checks">${ch.h}</div>
        ${(() => {   // bước 85: công nợ gia đình (cuối tháng thu) để trong mục thu gọn — người nhà trả trong ca thì vẫn chọn được
          const cus = oldAll().filter((d) => !d.family); const fam = oldAll().filter((d) => d.family);
          return cus.length || fam.length ? html`<h3 style="margin:8px 0 0">Khách trả nợ trong ca (Nợ HĐ / Nợ TM / Nợ CK)</h3>
          <div class="st-meta">Khoản nợ ở các ca trước — khách trả trong ca này thì chọn ở đây (trả thiếu thì sửa số tiền). Phiếu Fabi có mục <strong>PHIẾU THANH TOÁN NỢ</strong> là khách trả Nợ HĐ.</div>
          ${cus.map(debtPayRow)}
          ${fam.length ? html`<details ${fam.some((d) => d.closed_report_id === R.id) ? 'open' : ''}><summary style="cursor:pointer;font-weight:600">Công nợ gia đình (${fam.length}) — chỉ mở khi người nhà trả trong ca</summary><div class="stack" style="gap:8px;margin-top:8px">${fam.map(debtPayRow)}</div></details>` : ''}` : ''; })()}
        ${expStart ? html`<label class="pc-f" id="cm-open-wrap" ${money().startBad ? '' : 'hidden'}><span>Ghi chú số dư đầu khác ${expStart.src} (không bắt buộc)</span><input class="input" id="cm-open-note" value="${V.opening_note}" placeholder="vd: chủ rút 500.000 lúc 14:00"></label>` : ''}`;
    },
    3: () => {   // bước 84: gộp Nợ HĐ + Nợ TM + Nợ CK vào một bước
      const od = (R.open_debts || []).filter(isBill); const c = money(); const pd = V.f.pos_debt || 0;
      const seg = (d, i) => html`<div class="cm-seg cm-dkseg" role="group" aria-label="Loại nợ">${[['bill', 'HĐ'], ['muon', 'TM'], ['ck', 'CK']].map(([k, l]) => html`<button type="button" data-dk="${i}" data-v="${k}" aria-pressed="${(d.kind || '') === k}" ${d.closed_at ? 'disabled' : ''}>${l}</button>`)}</div>`;
      return html`<div class="st-meta">Ghi <b>mọi bàn / khách chưa trả tiền</b> trong ca. Mỗi khoản chọn đúng <b>Fabi đã ấn gì</b>:</div>
        <div class="cm-dkk"><div><b>HĐ</b> Fabi ghi <b>nợ</b> (chưa thanh toán) — ghi vào đây để <b>ca sau thu tiền</b>.</div>
          <div><b>TM</b> Đã lỡ ấn <b>"thanh toán tiền mặt"</b> trên Fabi (hoặc khách cầm tiền trong két) nhưng <b>chưa nhận tiền</b> — ghi vào đây để <b>ca sau thu tiền</b>. Web tự trừ khỏi tiền phải có trong két.</div>
          <div><b>CK</b> Đã lỡ ấn <b>"thanh toán chuyển khoản"</b> trên Fabi nhưng <b>khách chưa chuyển</b> — ghi vào đây để <b>ca sau thu tiền</b>. Web tự trừ khỏi tiền phải nhận trên hotline.</div></div>
        ${V.debts.map((d, i) => html`<div class="cm-person cm-debt"><div class="cm-line"><input class="input sm" data-db="${i}" data-k="table_name" value="${d.table_name || ''}" placeholder="Bàn / tên khách" ${d.closed_at ? 'disabled' : ''}>
          <input class="input sm money" data-db="${i}" data-k="amount" inputmode="numeric" value="${d.amount ? fmt(d.amount) : ''}" placeholder="Số tiền" ${d.closed_at ? 'disabled' : ''}>
          ${d.closed_at ? html`<span class="pill ok">Đã thu</span>` : html`<button type="button" class="btn sm secondary danger" data-dbx="${i}" aria-label="Xóa dòng">×</button>`}</div>
          <div class="cm-dk">${seg(d, i)}<input class="input sm" data-db="${i}" data-k="note" value="${d.note || ''}" placeholder="Tên khách, SĐT, hẹn trả…" ${d.closed_at ? 'disabled' : ''}></div></div>`)}
        <div class="pc-line"><button type="button" class="btn sm secondary" id="cm-add-debt">+ Thêm khoản nợ</button></div>
        <div class="alert ${billSum() === pd ? 'ok' : 'warn'}" id="cm-debt-sum" style="margin:0">${billSum() === pd ? '✅' : '⚠️'} Nợ HĐ đã ghi <b>${fmt(billSum())}</b> ${billSum() === pd ? '=' : '≠'} Nợ trên phiếu Fabi (${fmt(pd)})
          ${c.loanOut ? html`<br>Nợ TM <b>${fmt(c.loanOut)}</b> → trừ tiền két` : ''}${c.ckOut ? html`<br>Nợ CK <b>${fmt(c.ckOut)}</b> → trừ tiền hotline` : ''}</div>
        ${V.debts.length ? '' : html`<div class="st-meta">Không có khách nợ thì bấm Tiếp. Các ca sau sẽ được nhắc thu.</div>`}
        ${(() => { const paid = od.filter((d) => d.closed_report_id === R.id);   // đã chọn ở bước Phiếu Fabi — không ghi lại
          return paid.length ? html`<div class="st-meta" style="margin-top:6px">✓ Khách trả Nợ HĐ cũ (đã chọn ở bước Phiếu Fabi): ${paid.map((d) => `bàn ${d.table_name} ${fmt(d.amount)}đ · ${d.collect_kind === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'}`).join(', ')}</div>` : ''; })()}`;
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
  function nhanHang() {
    const p = PT.nhan_hang || {};
    return html`<h3 style="margin:6px 0 0">Nhận hàng kho tổng</h3>
      <div class="st-meta">${p.done_at ? `✓ ${p.done_name || ''} đã xong phần nhận hàng` : p.mine ? 'Bạn đang làm phần nhận hàng.' : p.claimed_by ? `${p.claimed_name} đang làm phần nhận hàng.` : 'Ca có hàng tới thì 1 người bấm nhận phần này rồi kiểm từng món.'}</div>
      ${!p.claimed_by && P.can_claim ? html`<button type="button" class="btn sm secondary" id="cm-nh-claim" style="align-self:flex-start">Tôi nhận phần nhận hàng</button>` : ''}
      ${p.mine && !p.done_at && !tienMine ? html`<button type="button" class="btn sm" id="cm-nh-done" style="align-self:flex-start">Xong phần nhận hàng</button>` : ''}
      ${NH_CSS}<div id="cm-hd" class="stack" style="gap:10px"><div class="st-meta">Đang tải hàng kho tổng…</div></div>`;
  }
  function stepError() {
    const c = money();
    switch (ORDER[V.step]) {
      case 1: {
        if (!V.staff.some((s) => s.worked)) return 'Phải có ít nhất 1 người làm.';
        const b = V.staff.find((s) => s.worked && (!s.time_in || !s.time_out)); if (b) return `Nhập giờ đến và giờ về của ${b.name}.`;
        const r = V.staff.find((s) => !s.worked && !(s.absent_reason || '').trim()); if (r) return `Ghi lý do nghỉ của ${r.name}.`;
        return '';
      }
      case 2: {
        if (!photos.length) return 'Chụp ảnh phiếu chốt ca Fabi trước.';
        if (!R.forced_start && !V.open) return 'Nhập giờ Mở ca trên phiếu.';
        if (!V.close) return 'Nhập giờ Đóng ca (POS) trên phiếu.';
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
        if (!V.moves.length && !V.noMoves) return 'Thêm khoản thu chi, hoặc tích "Ca này không có thu chi".';
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
    const pt = partOf(s); const idx = (p) => ORDER.map((_, i) => i).filter((i) => partOf(i) === p);
    const vI = idx('viec'); const tI = idx('tien');
    const partCard = (p, no, lbl, list, open) => { const cur = pt === p; const doneP = p === 'viec' ? V.viecDone : false; const k = list.filter((i) => i < s).length;
      return html`<button type="button" class="cm-part ${cur ? 'cur' : ''} ${doneP && !cur ? 'done' : ''} ${open ? '' : 'lock'}" data-part="${p}" ${open ? '' : 'aria-disabled="true"'}>
        <span class="cm-pn">${no} ${lbl}</span><span class="cm-ps">${!open ? '🔒 làm sau phần việc' : doneP && !cur ? '✓ Xong' : cur ? `bước ${list.indexOf(s) + 1}/${list.length}` : k ? `${k}/${list.length}` : 'chưa làm'}</span>
        <span class="cm-steps">${list.map((i) => html`<i class="${i < s || (p === 'viec' && V.viecDone) ? 'done' : i === s ? 'cur' : ''}"></i>`)}</span></button>`; };
    const parts = s > 0 ? html`<div class="cm-parts">${partCard('viec', '①', 'Phần việc', vI, true)}${partCard('tien', '②', 'Phần tiền', tI, V.viecDone)}</div>` : '';
    return html`${nhac}${parts}<div class="card cm-card" style="gap:8px"><div class="cm-sh"><span class="cm-n">${pt === 'viec' ? `① Phần việc · bước ${vI.indexOf(s) + 1}/${vI.length}` : pt === 'tien' ? `② Phần tiền · bước ${tI.indexOf(s) + 1}/${tI.length}` : `Bước ${s + 1}/${STEPS.length}`}</span><span class="st-meta">${R.shift} · ${dmy(R.work_date)}${tienMine ? ' · bạn là người chốt' : ''}</span></div>
        <h2 style="margin:0">${STEPS[s]}</h2></div>
      <div class="card stack cm-card" id="cm-body">${B[ORDER[s]]()}${s === 0 && tienOther ? nhanHang() : ''}</div>
      <div id="cm-err">${err ? html`<div class="alert error">${err}</div>` : ''}</div>
      ${s > 0 ? html`<div class="cm-nav"><button type="button" class="btn secondary" id="cm-back" ${s === 1 ? 'hidden' : ''}>‹ Quay lại</button><button type="button" class="btn" id="cm-next">${s === STEPS.length - 1 ? 'GỬI PHIẾU' : s === lastViec ? 'Xong phần việc ›' : 'Tiếp ›'}</button></div>` : ''}`;
  }

  return {
    title: `Chốt ca ${R.shift}`,
    html: html`${CM_CSS}<div class="page-head"><div><a href="#/ca?ngay=${R.work_date}" style="font-size:14px;font-weight:600">‹ Danh sách ca</a>
        <h1 style="margin-top:6px">Chốt ca ${R.shift} · ${R.branch_code || ''}</h1></div><div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="cm-col" id="cm-root">${shell()}</div>`,
    mount() {
      const root = $('#cm-root');
      const draw = (top) => { const y = window.scrollY; root.innerHTML = str(shell()); bind(); if (top) window.scrollTo(0, 0); else window.scrollTo(0, y); };
      const soft = () => {
        // bước 74: không vẽ lại cả bước khi đang gõ (trước đây ô Số dư đầu bị nhảy / mất số) — chỉ ẩn / hiện ô lý do tại chỗ
        if (ORDER[V.step] === 2) { $('#cm-checks').innerHTML = str(fabiChecks().h); const w = $('#cm-open-wrap'); if (w) w.hidden = !money().startBad; }
        if (V.tried) { const e = stepError(); $('#cm-err').innerHTML = e ? str(html`<div class="alert error">${e}</div>`) : ''; }
      };
      const busy = async (fn) => { try { await fn(); } catch (e) { showSaved(e.message, true); } };
      function bind() {
        bindMoneyInputs(root);
        loadPhotos();
        // bước 46: Chủ / Quản lý tổng tự chốt ca → phân loại (Chủ duyệt luôn) nghỉ / làm thay ngay tại đây
        const cvBox = $('#cm-cv');
        if (cvBox) {
          const cvCtx = { onChange: () => mountCover(cvBox, R, cvCtx) };
          rpc('app_cv_get', { p_id: R.id }).then((C) => { if (C && C.can_classify && C.state !== 'khong_can') { cvBox.hidden = false; mountCover(cvBox, R, cvCtx); } }).catch(() => {});
        }
        if ($('#cm-hd')) mountDeliveries($('#cm-hd'), R, { canRecv: !!PT.nhan_hang?.mine && !PT.nhan_hang?.done_at, canPhoto: true, canRecon: false, onRecon: () => rerender() });
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
        $('#cm-nh-claim')?.addEventListener('click', () => busy(async () => { await save(); await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'nhan_hang', p_force: false }); rerender(); }));
        $('#cm-nh-done')?.addEventListener('click', () => busy(async () => { const r = await rpc('app_ca_part_done', { p_id: R.id, p_part: 'nhan_hang', p_on: true }); flash(r.completed ? 'Phiếu đã hoàn thành.' : 'Đã xong phần nhận hàng.'); rerender(); }));
        $('#cm-undo')?.addEventListener('click', () => busy(async () => {
          await rpc('app_ca_part_done', { p_id: R.id, p_part: 'tien', p_on: false }); await rpc('app_ca_part_done', { p_id: R.id, p_part: 'nhan_su', p_on: false }).catch(() => {});
          try { sessionStorage.setItem(key, JSON.stringify({ step: STEPS.length - 1 })); } catch (_) { /* bỏ qua */ }
          rerender();
        }));
        const bindJump = () => $$('[data-jump]', root).forEach((b) => {
          if (b.dataset.bound) return; b.dataset.bound = '1';
          b.addEventListener('click', () => busy(async () => { await save(); V.step = ORDER.indexOf(Number(b.dataset.jump)); V.tried = false; draw(true); }));
        });
        bindJump();
        $$('.cm-part', root).forEach((b) => b.addEventListener('click', () => busy(async () => {
          if (b.dataset.part === 'tien' && !V.viecDone) { showSaved('Làm xong phần việc (Ai làm ca, bàn giao…) rồi mới tới phần tiền.', true); return; }
          if (partOf(V.step) === b.dataset.part) return;
          await save(); V.step = b.dataset.part === 'tien' ? firstTien : 1; V.tried = false; draw(true);
        })));
        $('#cm-back')?.addEventListener('click', () => busy(async () => { await save(); V.step--; V.tried = false; draw(true); }));
        $('#cm-next')?.addEventListener('click', () => busy(async () => {
          const e = stepError();
          if (e) { V.tried = true; $('#cm-err').innerHTML = str(html`<div class="alert error">${e}</div>`); $('#cm-err').scrollIntoView({ block: 'nearest' }); return; }
          V.tried = false;
          if (V.step === lastViec) V.viecDone = true;   // bước 77: xong phần việc → mở phần tiền
          if (V.step < STEPS.length - 1) { V.step++; try { await save(); } catch (er) { V.step--; throw er; } draw(true); showSaved(V.step === firstTien ? 'Đã xong phần việc — làm tiếp phần tiền' : 'Đã lưu'); return; }
          await save();
          await rpc('app_ca_part_done', { p_id: R.id, p_part: 'tien', p_on: true });
          let r = await rpc('app_ca_part_done', { p_id: R.id, p_part: 'nhan_su', p_on: true });
          const nh = PT.nhan_hang || {};
          if (!r.completed && (r.left || []).length && (nh.mine || !nh.claimed_by)) {
            if (!nh.claimed_by) await rpc('app_ca_part_claim', { p_id: R.id, p_part: 'nhan_hang', p_force: false });
            r = await rpc('app_ca_part_done', { p_id: R.id, p_part: 'nhan_hang', p_on: true });
          }
          try { sessionStorage.removeItem(key); } catch (_) { /* bỏ qua */ }
          flash(r.completed ? 'Đã gửi phiếu chốt ca. Quản lý sẽ đối soát.' : `Đã gửi. Phiếu chờ phần: ${(r.left || []).join(', ')}.`);
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
        // bước 5
        $('#cm-add-move')?.addEventListener('click', () => { V.moves.push({ kind: 'tien_mat', amount: null, note: '', sign: -1 }); V.noMoves = false; draw(); });
        $('#cm-add-ckmove')?.addEventListener('click', () => { V.moves.push({ kind: 'chuyen_khoan', amount: null, note: '', sign: -1 }); V.noMoves = false; draw(); });
        $('#cm-nomoves')?.addEventListener('change', (e) => { V.noMoves = e.target.checked; soft(); });
        $$('[data-mt]', root).forEach((b) => b.addEventListener('click', () => { const m = V.moves[b.dataset.mt]; m.sign = Number(b.dataset.v); m.amount = m.amount ? Math.abs(Number(m.amount)) * m.sign : null; draw(); }));
        $$('[data-mx]', root).forEach((b) => b.addEventListener('click', () => { V.moves.splice(Number(b.dataset.mx), 1); draw(); }));
        $$('[data-mv]', root).forEach((i) => i.addEventListener('input', () => {
          const m = V.moves[i.dataset.mv];
          if (i.dataset.k === 'note') m.note = i.value;
          else { const n = parseMoney(i.value); const sg = m.sign || (Number(m.amount) > 0 ? 1 : -1); m.amount = n === null ? null : n * sg; }
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
  @media (max-width: 420px) { .cm-fabi { grid-template-columns: minmax(0, 1fr) minmax(0, 140px); } .cm-line { grid-template-columns: minmax(0, 1fr) 105px auto; } .cm-line2 { grid-template-columns: minmax(0, 1fr) 110px; } }
</style>`;
