// Bước 41 — Chốt ca mới (anh Tiến chốt 12/11/2026): 1 người chốt chính, gõ số theo đúng thứ tự trên phiếu Fabi,
// web tự kiểm tra từng bước; người khác trong ca chỉ giúp phần nhận hàng. Máy chủ kiểm tra lại khi GỬI (app__ca_part_check).
import { render as rerender } from './app.js';
import { mountDeliveries, NH_CSS } from './nhap_hang.js';
import { rpc, sb } from './sb.js';
import { bindMoneyInputs, compressImage, dmy, dt, fmt, parseMoney, signed } from './tien.js';
import { $, $$, flash, html, showSaved, str } from './ui.js';

const BUCKET = 'phieu-ca';
const GOI_DAU = 1000000;
const STEPS = ['Nhận chốt ca', 'Ai làm ca', 'Phiếu Fabi', 'Khách nợ', 'Chuyển khoản hotline', 'Thu chi trong ca', 'Số cốc', 'Kết quả tiền', 'Bàn giao & nhận hàng', 'Kiểm tra lần cuối'];
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
  const PT = Object.fromEntries((P.parts || []).map((p) => [p.part, p]));
  const first = R.shift === R.first_shift;
  const hand = R.cash_hand || null;
  const key = 'cm:' + R.id;
  let mem = {}; try { mem = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (_) { /* bỏ qua */ }
  const tienMine = !!PT.tien?.mine; const tienOther = PT.tien?.claimed_by && !PT.tien?.mine;
  const waiting = tienMine && PT.tien?.done_at;   // đã gửi, còn chờ phần nhận hàng của người khác

  // Dữ liệu đang sửa
  const V = {
    step: tienMine && !waiting ? Math.max(1, Number(mem.step) || 1) : 0,
    staff: (R.staff || []).map((s) => ({ ...s, worked: s.worked === undefined ? true : !!s.worked,
      time_in: s.time_in || (s.source === 'lich' && SH ? hm(SH.start) : null), time_out: s.time_out || (s.source === 'lich' && SH ? hm(SH.end) : null) })),
    open: hm(R.rev_start ? R.rev_start.slice(11) : ''), close: hm(R.rev_end ? R.rev_end.slice(11) : ''),
    f: { ipos_opening: num(R.ipos_opening), total_revenue: num(R.total_revenue), pos_transfer: num(R.pos_transfer), pos_cash: num(R.pos_cash),
      pos_debt: num(R.pos_debt), cash_counted: num(R.cash_counted), pos_diff: num(R.pos_diff) },
    sign: Number(R.pos_diff) < 0 ? -1 : 1,
    opening_note: R.opening_note || '', debts: (R.debts || []).map((d) => ({ ...d })), reported_transfer: num(R.reported_transfer), transfer_note: R.transfer_note || '',
    moves: (R.moves || []).map((m) => ({ ...m })), noMoves: !!mem.noMoves, cups: num(R.cups), diff_note: R.diff_note || '',
    handover: (R.handover || []).map((h) => ({ ...h })), tried: false,
  };
  const photos = (R.photos || []).filter((p) => p.kind === 'ipos');
  const prevCash = hand && hand.prev_cash !== null && hand.prev_cash !== undefined ? Number(hand.prev_cash) : null;
  const expStart = first ? { v: GOI_DAU, src: 'tiền gối đầu ca sáng' } : prevCash !== null ? { v: prevCash, src: `Tổng tiền ca ${hand.prev_shift} để lại` } : null;
  const col = (k) => sum((R.open_debts || []).filter((d) => d.closed_report_id === R.id && d.collect_kind === k), (d) => d.amount);

  function money() {
    const f = V.f; const colTM = col('tien_mat'); const colCK = col('chuyen_khoan');
    const sal = sum(V.staff.filter((s) => s.worked && s.pay_cash), (s) => parseMoney(s.cash_paid) || 0);
    const mvTM = sum(V.moves.filter((m) => m.kind === 'tien_mat'), (m) => m.amount); const mvCK = sum(V.moves.filter((m) => m.kind === 'chuyen_khoan'), (m) => m.amount);
    const op = first ? GOI_DAU : f.ipos_opening;
    const ok = (...k) => k.every((x) => f[x] !== null);
    return {
      colTM, colCK, sal, mvTM, mvCK,
      sumGap: ok('total_revenue', 'pos_cash', 'pos_transfer', 'pos_debt') ? f.pos_cash + f.pos_transfer + f.pos_debt - f.total_revenue : null,
      diffGap: ok('cash_counted', 'ipos_opening', 'pos_cash', 'pos_diff') ? f.cash_counted - f.ipos_opening - f.pos_cash - colTM - f.pos_diff : null,
      tmLeft: ok('cash_counted', 'ipos_opening', 'pos_cash') ? f.cash_counted - op - f.pos_cash - (mvTM - sal) - colTM : null,
      ckExp: (f.pos_transfer || 0) + mvCK + colCK,
      ckLeft: V.reported_transfer === null || f.pos_transfer === null ? null : V.reported_transfer - f.pos_transfer - mvCK - colCK,
      startBad: expStart && f.ipos_opening !== null && f.ipos_opening !== expStart.v,
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
      debts: V.debts.map((d) => ({ id: d.id || null, table_name: d.table_name || '', amount: d.amount, note: d.note || '' })),
      goods: (R.goods || []).map((g) => ({ item: g.item, qty: g.qty })), goods_status: R.goods_status || null, goods_note: R.goods_note || null,
    };
  }
  async function save() {
    if (!tienMine || waiting) return;
    const r = await rpc('app_ca_save', { p_id: R.id, p: payload() });
    const ho = V.handover.filter((h) => !h.task_id); (r.handover_ids || []).forEach((id, i) => { if (ho[i] && id) ho[i].id = id; });
    (r.debt_ids || []).forEach((id, i) => { if (V.debts[i] && id) V.debts[i].id = id; });
    try { sessionStorage.setItem(key, JSON.stringify({ step: V.step, noMoves: V.noMoves })); } catch (_) { /* bỏ qua */ }
  }

  // ------------------------------------------------------------ các bước
  const moneyIn = (k, val, label) => html`<input class="input money cm-num" data-f="${k}" inputmode="numeric" autocomplete="off" placeholder="0" value="${val === null ? '' : fmt(Math.abs(val))}" aria-label="${label}">`;
  function fabiChecks() {
    const c = money(); const out = []; let bad = false;
    if (V.f.ipos_opening !== null && expStart) {
      out.push(c.startBad ? html`<div>🔴 Số dư đầu <b>${fmt(V.f.ipos_opening)}</b> khác ${expStart.src} (<b>${fmt(expStart.v)}</b>), lệch <b>${signed(V.f.ipos_opening - expStart.v)}</b> — ghi lý do bên dưới</div>`
        : html`<div>✅ Số dư đầu đúng bằng ${expStart.src} (<b>${fmt(expStart.v)}</b>)</div>`);
    } else if (V.f.ipos_opening !== null && hand && hand.state === 'cho_ca_truoc') out.push(html`<div>⏳ Ca ${hand.prev_shift} chưa gửi phiếu nên chưa so được số dư đầu — web sẽ so khi ca ${hand.prev_shift} gửi.</div>`);
    if (c.sumGap !== null) {
      if (c.sumGap === 0) out.push(html`<div>✅ Chuyển khoản + Tiền mặt + Nợ = <b>${fmt(V.f.total_revenue)}</b> = Doanh thu NET</div>`);
      else { bad = true; out.push(html`<div>🔴 Chuyển khoản + Tiền mặt + Nợ = <b>${fmt(V.f.total_revenue + c.sumGap)}</b>, khác Doanh thu NET <b>${fmt(V.f.total_revenue)}</b>. Bạn gõ nhầm 1 số, xem lại phiếu.</div>`); }
    }
    if (c.diffGap !== null) {
      const lhs = V.f.cash_counted - V.f.ipos_opening - V.f.pos_cash - c.colTM;
      if (c.diffGap === 0) out.push(html`<div>✅ Tổng tiền − Số dư đầu − Tiền mặt${c.colTM ? ' − khách trả nợ tiền mặt' : ''} = <b>${signed(lhs)}</b> = Tiền chênh lệch</div>`);
      else { bad = true; out.push(html`<div>🔴 Tổng tiền − Số dư đầu − Tiền mặt${c.colTM ? ' − khách trả nợ tiền mặt' : ''} = <b>${signed(lhs)}</b>, khác Tiền chênh lệch <b>${signed(V.f.pos_diff)}</b>. Bạn gõ nhầm 1 số, xem lại phiếu (có khách trả nợ cũ bằng tiền mặt thì chọn ở bước Khách nợ).</div>`); }
    }
    return { h: out.length ? html`<div class="alert ${bad ? 'error' : c.startBad ? 'warn' : 'ok'} cm-checks">${out}</div>` : '', bad, all: Object.values(V.f).every((x) => x !== null) };
  }
  // Khung so sánh chuyển khoản hotline (vẽ lại riêng khi gõ)
  function ckBox() {
    const c = money(); const bad = c.ckLeft !== null && c.ckLeft !== 0;
    return html`<div class="alert ${V.reported_transfer === null ? 'info' : bad ? 'error' : 'ok'}">Phải thấy: chuyển khoản trên phiếu <b>${fmt(V.f.pos_transfer)}</b>${c.colCK ? html` + khách trả nợ chuyển khoản <b>${fmt(c.colCK)}</b>` : ''}${c.mvCK ? html` + thu chi chuyển khoản <b>${signed(c.mvCK)}</b>` : ''} = <b>${fmt(c.ckExp)}</b>
        ${V.reported_transfer === null ? '' : bad ? html`<br>🔴 Bạn nhập ${fmt(V.reported_transfer)}, lệch <b>${signed(c.ckLeft)}</b>` : html`<br>✅ Khớp`}</div>
      ${bad ? html`<label class="pc-f"><span>Lý do lệch chuyển khoản (bắt buộc)</span><input class="input" id="cm-ck-note" value="${V.transfer_note}" placeholder="vd: 1 khách chuyển nhầm sang tài khoản khác"></label>` : ''}`;
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
          ${s.pay_cash ? html` <span class="pill info">Trả lương tiền mặt</span>` : ''}</div>
        <div class="cm-seg" role="group" aria-label="${s.name} có làm không"><button type="button" data-w="${i}" data-v="1" aria-pressed="${s.worked}">Có làm</button><button type="button" data-w="${i}" data-v="0" aria-pressed="${!s.worked}">Nghỉ</button></div></div>
        ${s.worked ? html`<div class="cm-times"><label>Đến <input class="input sm" type="time" data-t="${i}" data-k="time_in" value="${s.time_in || ''}"></label><label>Về <input class="input sm" type="time" data-t="${i}" data-k="time_out" value="${s.time_out || ''}"></label>
            ${s.pay_cash ? html`<label>Đã trả lương tiền mặt <input class="input sm money" data-cash="${i}" inputmode="numeric" placeholder="0" value="${s.cash_paid ? fmt(parseMoney(s.cash_paid)) : ''}" style="width:120px"></label>` : ''}
            ${s.source !== 'lich' ? html`<button type="button" class="btn sm secondary danger" data-rm="${i}">Bỏ</button>` : ''}</div>`
          : html`<input class="input sm" data-reason="${i}" placeholder="Lý do nghỉ (bắt buộc)" value="${s.absent_reason || ''}">`}</div>`)}
      <div class="pc-line"><input class="input sm grow" id="cm-helper" list="cm-emps" placeholder="Gõ mã hoặc tên người làm hộ" aria-label="Người làm hộ"><datalist id="cm-emps"></datalist>
        <button type="button" class="btn sm secondary" id="cm-add-helper">+ Thêm</button></div>
      <div class="st-meta">Có người nghỉ hoặc làm hộ thì quản lý tổng phân loại lý do khi đối soát.</div>`,
    2: () => {
      const ch = fabiChecks();
      return html`<div class="st-meta">Chụp phiếu chốt ca Fabi trước, rồi gõ <strong>lần lượt từ trên xuống</strong> đúng như trên phiếu.</div>
        <div class="cm-phrow"><div class="cm-photos">${photos.map((p) => html`<figure class="cm-ph" data-path="${p.path}"><a target="_blank" rel="noopener" aria-label="Xem ảnh to"><img alt="Ảnh phiếu Fabi" loading="lazy"></a><button type="button" class="ph-del" data-id="${p.id}" aria-label="Xóa ảnh">×</button></figure>`)}</div>
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
        ${money().startBad ? html`<label class="pc-f"><span>Lý do số dư đầu khác ${expStart.src} (bắt buộc)</span><input class="input" id="cm-open-note" value="${V.opening_note}" placeholder="vd: chủ rút 500.000 lúc 14:00"></label>` : ''}`;
    },
    3: () => {
      const od = R.open_debts || [];
      return html`<div class="st-meta">Phiếu ghi <strong>Nợ ${fmt(V.f.pos_debt || 0)}</strong>. ${V.f.pos_debt ? 'Ghi từng bàn / khách nợ, tổng phải bằng số này.' : 'Ca này không có khách nợ mới.'}</div>
        ${V.debts.map((d, i) => html`<div class="cm-line"><input class="input sm" data-db="${i}" data-k="table_name" value="${d.table_name || ''}" placeholder="Bàn / tên khách" ${d.closed_at ? 'disabled' : ''}>
          <input class="input sm money" data-db="${i}" data-k="amount" inputmode="numeric" value="${d.amount ? fmt(d.amount) : ''}" placeholder="Số tiền" ${d.closed_at ? 'disabled' : ''}>
          <input class="input sm cm-wide" data-db="${i}" data-k="note" value="${d.note || ''}" placeholder="Tên khách, SĐT, hẹn trả…" ${d.closed_at ? 'disabled' : ''}>
          ${d.closed_at ? html`<span class="pill ok">Đã thu</span>` : html`<button type="button" class="btn sm secondary danger" data-dbx="${i}" aria-label="Xóa dòng">×</button>`}</div>`)}
        ${V.f.pos_debt ? html`<div class="pc-line"><button type="button" class="btn sm secondary" id="cm-add-debt">+ Thêm bàn nợ</button><span class="st-meta" id="cm-debt-sum">Đã ghi ${fmt(sum(V.debts, (d) => d.amount))} / ${fmt(V.f.pos_debt)}</span></div>` : ''}
        <h3 style="margin:8px 0 0">Khách trả nợ cũ trong ca</h3>
        ${od.length ? od.map((d) => html`<div class="cm-person"><div><strong>Bàn ${d.table_name}</strong> · ${fmt(d.amount)}đ <span class="st-meta">· ca ${d.from_shift} ${dmy(d.from_date)}${d.note ? ' · ' + d.note : ''}</span></div>
            ${d.closed_at && d.closed_report_id !== R.id ? html`<span class="pill ok">Đã thu ở ca khác</span>`
              : html`<select class="input sm" data-paid="${d.id}" aria-label="Khách bàn ${d.table_name} trả chưa"><option value="">Chưa trả</option>
                <option value="tien_mat" ${d.closed_at && d.collect_kind === 'tien_mat' ? 'selected' : ''}>Trả bằng tiền mặt</option><option value="chuyen_khoan" ${d.closed_at && d.collect_kind === 'chuyen_khoan' ? 'selected' : ''}>Trả bằng chuyển khoản</option></select>`}</div>`)
          : html`<div class="st-meta">Không có khoản nợ cũ nào đang chờ trả.</div>`}
        <div class="st-meta">Trả tiền mặt: Fabi đã cộng vào tiền phải có trong két. Trả chuyển khoản: web cộng vào số phải thấy trên hotline.</div>`;
    },
    4: () => html`<div class="st-meta">Cộng các giao dịch chuyển khoản <strong>đã nhận trên hotline</strong> trong ca rồi nhập tổng.</div>
        <label class="pc-f"><span>Tổng chuyển khoản đã nhận trên hotline</span><input class="input money" id="cm-hot" inputmode="numeric" autocomplete="off" value="${V.reported_transfer === null ? '' : fmt(V.reported_transfer)}"></label>
        <div id="cm-ck-box">${ckBox()}</div>`,
    5: () => html`<div class="st-meta">Tiền mặt lấy ra từ két để chi, hoặc tiền bỏ thêm vào két (kể cả tiền quản lý rút ra). Không cần ảnh hóa đơn.</div>
      ${V.moves.map((m, i) => html`<div class="cm-person"><div class="cm-ph">${m.kind === 'chuyen_khoan' ? html`<span class="pill info">Chuyển khoản</span>` : html`<div class="cm-seg"><button type="button" data-mt="${i}" data-v="-1" aria-pressed="${(m.sign || (Number(m.amount) > 0 ? 1 : -1)) < 0}">Chi ra</button><button type="button" data-mt="${i}" data-v="1" aria-pressed="${(m.sign || (Number(m.amount) > 0 ? 1 : -1)) > 0}">Thu vào</button></div>`}
          <button type="button" class="btn sm secondary danger" data-mx="${i}">Xóa</button></div>
        <div class="cm-line2"><input class="input sm" data-mv="${i}" data-k="note" value="${m.note || ''}" placeholder="Nội dung, vd: mua đá"><input class="input sm money" data-mv="${i}" data-k="amount" inputmode="numeric" value="${m.amount ? fmt(Math.abs(m.amount)) : ''}" placeholder="Số tiền"></div></div>`)}
      <div class="pc-line"><button type="button" class="btn sm secondary" id="cm-add-move">+ Thêm khoản</button>
        ${V.moves.length ? '' : html`<label class="pc-line" style="gap:6px"><input type="checkbox" class="check" id="cm-nomoves" ${V.noMoves ? 'checked' : ''}> Ca này không có thu chi</label>`}</div>`,
    6: () => html`<label class="pc-f"><span>Số cốc bán trong ca</span><input class="input" id="cm-cups" inputmode="numeric" value="${V.cups ?? ''}" placeholder="0"></label>`,
    7: () => {
      const c = money(); const ok = c.tmLeft === 0;
      return html`<div class="kv"><div>Tiền chênh lệch trên phiếu Fabi</div><div><b>${signed(V.f.pos_diff)}</b></div>
          ${first && V.f.ipos_opening !== GOI_DAU ? html`<div>Số dư đầu khác tiền gối đầu</div><div><b>${signed(V.f.ipos_opening - GOI_DAU)}</b></div>` : ''}
          <div>Thu vào / chi ra trong ca</div><div><b>${signed(c.mvTM - c.sal)}</b></div>${c.sal ? html`<div>· trong đó chi lương tiền mặt</div><div>${signed(-c.sal)}</div>` : ''}</div>
        <div class="alert ${ok ? 'ok' : 'error'}"><div class="st-meta">Còn lệch</div><div class="cm-big">${ok ? 'KHỚP ✓' : 'LỆCH ' + signed(c.tmLeft)}</div>${ok ? 'Két đúng đến từng đồng.' : 'Lệch dù chỉ 1 đồng cũng phải ghi lý do. Quên ghi khoản thu / chi thì quay lại bước "Thu chi trong ca".'}</div>
        ${ok ? '' : html`<label class="pc-f"><span>Lý do lệch (bắt buộc)</span><textarea class="input" id="cm-diff-note" rows="2" placeholder="vd: thối nhầm cho khách bàn 3">${V.diff_note}</textarea></label>`}`;
    },
    8: () => html`${(R.carried || []).length ? html`<h3 style="margin:0">Việc chưa xong từ ca trước</h3>${R.carried.map((h) => html`<div class="cm-person"><div>${h.content}<div class="st-meta">Ca ${h.from_shift} ${dmy(h.from_date)}</div></div>
          ${h.task_id ? html`<span class="pill ${h.done_at ? 'ok' : 'warn'}">${h.done_at ? 'Đã xử lý' : 'Đã giao việc'}</span>` : html`<button type="button" class="btn sm ${h.done_at ? 'secondary' : ''}" data-hodone="${h.id}" data-undo="${h.done_at ? 1 : ''}">${h.done_at ? 'Bỏ đánh dấu' : 'Đã xong'}</button>`}</div>`)}` : ''}
      <h3 style="margin:0">Bàn giao cho ca sau <span class="st-meta">(không bắt buộc)</span></h3>
      ${V.handover.map((h, i) => html`<div class="cm-line2" style="grid-template-columns:minmax(0,1fr) auto"><textarea class="input" rows="2" data-ho="${i}" placeholder="Việc ca sau làm tiếp / thiết bị / vệ sinh / sự cố" ${h.task_id ? 'disabled' : ''}>${h.content || ''}</textarea>
        ${h.task_id ? html`<span class="pill warn">Đã giao việc</span>` : html`<button type="button" class="btn sm secondary danger" data-hox="${i}" aria-label="Xóa">×</button>`}</div>`)}
      <div><button type="button" class="btn sm secondary" id="cm-add-ho">+ Thêm việc bàn giao</button></div>
      ${nhanHang()}`,
    9: () => {
      const c = money(); const w = V.staff.filter((s) => s.worked); const off = V.staff.filter((s) => !s.worked);
      return html`<div class="st-meta">Đọc lại một lượt rồi bấm GỬI.</div>
        <ul class="cm-ul"><li>Người làm: <b>${w.length}</b> (${w.map((s) => s.name).join(', ')})${off.length ? html` · nghỉ: ${off.map((s) => s.name).join(', ')}` : ''}</li>
          <li>Doanh thu <b>${fmt(V.f.total_revenue)}</b>: chuyển khoản ${fmt(V.f.pos_transfer)} · tiền mặt ${fmt(V.f.pos_cash)} · nợ ${fmt(V.f.pos_debt)}</li>
          <li>Két: số dư đầu ${fmt(V.f.ipos_opening)} → đếm cuối ca <b>${fmt(V.f.cash_counted)}</b> (chênh lệch trên phiếu ${signed(V.f.pos_diff)})</li>
          <li>${V.debts.length ? `Khách nợ: ${V.debts.map((d) => `${d.table_name} ${fmt(d.amount)}`).join(', ')}` : 'Không có khách nợ mới'}</li>
          <li>Chuyển khoản hotline ${fmt(V.reported_transfer)} ${c.ckLeft ? '(lệch, đã ghi lý do)' : '✓'}</li>
          <li>${V.moves.length ? `${V.moves.length} khoản thu chi` : 'Không có thu chi'} · ${V.cups} cốc</li></ul>
        <div class="alert ${c.tmLeft === 0 ? 'ok' : 'error'}"><b>${c.tmLeft === 0 ? 'Tiền: KHỚP ✓' : 'Tiền: LỆCH ' + signed(c.tmLeft)}</b>${c.tmLeft ? ' · lý do: ' + V.diff_note : ''}</div>`;
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
    switch (V.step) {
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
        if (c.startBad && !V.opening_note.trim()) return 'Ghi lý do số dư đầu bị lệch.';
        return '';
      }
      case 3:
        if (V.debts.some((d) => !(d.table_name || '').trim() || !(Number(d.amount) > 0))) return 'Dòng nợ nào cũng phải có bàn / tên khách và số tiền.';
        if (sum(V.debts, (d) => d.amount) !== (V.f.pos_debt || 0)) return `Tổng các bàn nợ (${fmt(sum(V.debts, (d) => d.amount))}) phải bằng dòng Nợ trên phiếu (${fmt(V.f.pos_debt || 0)}).`;
        return '';
      case 4:
        if (V.reported_transfer === null) return 'Nhập tổng chuyển khoản đã nhận trên hotline.';
        if (c.ckLeft !== 0 && !V.transfer_note.trim()) return 'Ghi lý do lệch chuyển khoản.';
        return '';
      case 5:
        if (!V.moves.length && !V.noMoves) return 'Thêm khoản thu chi, hoặc tích "Ca này không có thu chi".';
        if (V.moves.some((m) => !(m.note || '').trim() || !Number(m.amount))) return 'Khoản nào cũng phải có nội dung và số tiền.';
        return '';
      case 6: return V.cups === null ? 'Nhập số cốc.' : '';
      case 7: return c.tmLeft !== 0 && !V.diff_note.trim() ? 'Ghi lý do lệch tiền.' : '';
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
    return html`<div class="card cm-card" style="gap:8px"><div class="cm-sh"><span class="cm-n">Bước ${s + 1}/${STEPS.length}</span><span class="st-meta">${R.shift} · ${dmy(R.work_date)}${tienMine ? ' · bạn là người chốt' : ''}</span></div>
        <div class="cm-steps">${STEPS.map((_, i) => html`<i class="${i < s ? 'done' : i === s ? 'cur' : ''}"></i>`)}</div><h2 style="margin:0">${STEPS[s]}</h2></div>
      <div class="card stack cm-card" id="cm-body">${B[s]()}${s === 0 && tienOther ? nhanHang() : ''}</div>
      <div id="cm-err">${err ? html`<div class="alert error">${err}</div>` : ''}</div>
      ${s > 0 ? html`<div class="cm-nav"><button type="button" class="btn secondary" id="cm-back" ${s === 1 ? 'hidden' : ''}>‹ Quay lại</button><button type="button" class="btn" id="cm-next">${s === STEPS.length - 1 ? 'GỬI PHIẾU' : 'Tiếp ›'}</button></div>` : ''}`;
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
        if (V.step === 2) { $('#cm-checks').innerHTML = str(fabiChecks().h); if (!!$('#cm-open-note') !== !!money().startBad) draw(); }
        if (V.tried) { const e = stepError(); $('#cm-err').innerHTML = e ? str(html`<div class="alert error">${e}</div>`) : ''; }
      };
      const busy = async (fn) => { try { await fn(); } catch (e) { showSaved(e.message, true); } };
      function bind() {
        bindMoneyInputs(root);
        loadPhotos();
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
          try { sessionStorage.setItem(key, JSON.stringify({ step: 9 })); } catch (_) { /* bỏ qua */ }
          rerender();
        }));
        $('#cm-back')?.addEventListener('click', () => busy(async () => { await save(); V.step--; V.tried = false; draw(true); }));
        $('#cm-next')?.addEventListener('click', () => busy(async () => {
          const e = stepError();
          if (e) { V.tried = true; $('#cm-err').innerHTML = str(html`<div class="alert error">${e}</div>`); $('#cm-err').scrollIntoView({ block: 'nearest' }); return; }
          V.tried = false;
          if (V.step < STEPS.length - 1) { V.step++; try { await save(); } catch (er) { V.step--; throw er; } draw(true); showSaved('Đã lưu'); return; }
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
        if ($('#cm-emps')) {
          rpc('app_ca_employees').then((list) => { emps = list || []; $('#cm-emps').innerHTML = str(html`${emps.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}`); }).catch(() => {});
          $('#cm-add-helper').addEventListener('click', () => {
            const q = $('#cm-helper').value.trim().toLowerCase(); const code = q.split(/\s*[–-]\s*/)[0];
            const e = emps.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || emps.find((x) => x.code.toLowerCase() === code);
            if (!e) { showSaved('Không tìm thấy nhân viên. Chọn trong danh sách gợi ý.', true); return; }
            if (V.staff.some((s) => s.employee_id === e.id)) { showSaved('Người này đã có trong danh sách.', true); return; }
            V.staff.push({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank, source: 'ho_tro', worked: true, pay_cash: e.pay_cash, time_in: SH ? hm(SH.start) : null, time_out: SH ? hm(SH.end) : null });
            draw();
          });
        }
        // bước 2
        $('#cm-photo')?.addEventListener('change', (ev) => busy(async () => {
          const files = [...ev.target.files]; if (!files.length) return;
          await save();
          for (let i = 0; i < files.length; i++) {
            $('#cm-ph-st').textContent = `Đang tải ảnh ${i + 1}/${files.length}…`;
            const blob = await compressImage(files[i]);
            const path = `r${R.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
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
        $('#cm-add-debt')?.addEventListener('click', () => { V.debts.push({ table_name: '', amount: null, note: '' }); draw(); });
        $$('[data-db]', root).forEach((i) => i.addEventListener('input', () => {
          const d = V.debts[i.dataset.db]; d[i.dataset.k] = i.dataset.k === 'amount' ? parseMoney(i.value) : i.value;
          const s = $('#cm-debt-sum'); if (s) s.textContent = `Đã ghi ${fmt(sum(V.debts, (x) => x.amount))} / ${fmt(V.f.pos_debt)}`; soft();
        }));
        $$('[data-dbx]', root).forEach((b) => b.addEventListener('click', () => { V.debts.splice(Number(b.dataset.dbx), 1); draw(); }));
        $$('[data-paid]', root).forEach((s) => s.addEventListener('change', () => busy(async () => {
          await save();
          await rpc('app_ca_debt_collect', { p_debt: Number(s.dataset.paid), p_report: R.id, p_kind: s.value || null, p_note: null });
          const d = R.open_debts.find((x) => String(x.id) === s.dataset.paid);
          if (s.value) { d.closed_at = 'x'; d.closed_report_id = R.id; d.collect_kind = s.value; } else { d.closed_at = null; d.closed_report_id = null; d.collect_kind = null; }
          showSaved('Đã lưu'); soft();
        })));
        // bước 4
        // Ô tiền tự thêm dấu chấm khi gõ nên trình duyệt không phát 'change' → nghe 'input', chỉ vẽ lại khung so sánh (không mất cú bấm "Tiếp")
        const bindCkNote = () => $('#cm-ck-note')?.addEventListener('input', (e) => { V.transfer_note = e.target.value; soft(); });
        $('#cm-hot')?.addEventListener('input', (e) => { V.reported_transfer = parseMoney(e.target.value); $('#cm-ck-box').innerHTML = str(ckBox()); bindCkNote(); soft(); });
        bindCkNote();
        // bước 5
        $('#cm-add-move')?.addEventListener('click', () => { V.moves.push({ kind: 'tien_mat', amount: null, note: '' }); V.noMoves = false; draw(); });
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
      let emps = [];
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
  .cm-steps { display: flex; gap: 3px; } .cm-steps i { flex: 1; height: 5px; border-radius: 3px; background: var(--line); }
  .cm-steps i.done { background: var(--ok-line); } .cm-steps i.cur { background: var(--primary); }
  .cm-nav { display: flex; gap: 8px; } .cm-nav .btn { flex: 1; min-height: 46px; }
  .cm-fabi { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 170px); gap: 8px 10px; align-items: center; }
  .cm-lab { font-size: 14px; font-weight: 600; } .cm-lab small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; }
  .cm-fabi .input.money { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cm-signed { display: flex; gap: 4px; min-width: 0; } .cm-signed .input { min-width: 0; flex: 1; }
  .cm-checks { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .cm-person { border: 1px solid var(--line); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
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
  .cm-ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  .cm-phrow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .cm-photos { display: flex; gap: 6px; flex-wrap: wrap; }
  .cm-ph { position: relative; margin: 0; width: 76px; height: 76px; flex: none; background: var(--line-soft); border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  .cm-ph a { display: block; width: 100%; height: 100%; }
  .cm-ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cm-ph .ph-del { position: absolute; top: 3px; right: 3px; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(0,0,0,.6); color: #fff; font-size: 15px; line-height: 1; cursor: pointer; padding: 0; }
  .cm-phact { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; min-width: 0; }
  @media (max-width: 420px) { .cm-fabi { grid-template-columns: minmax(0, 1fr) minmax(0, 140px); } .cm-line { grid-template-columns: minmax(0, 1fr) 105px auto; } .cm-line2 { grid-template-columns: minmax(0, 1fr) 110px; } }
</style>`;
