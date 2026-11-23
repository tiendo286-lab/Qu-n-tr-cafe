// Cùng bố cục cho chốt ca và đối soát. Hai vế đổi tiền chỉ là bút toán của một phiếu.
import { html } from './ui.js';
import { fmt } from './tien.js';

// bước 156: bỏ bước Tiền. Đối soát về Chốt ca (22/11): bỏ bước Hoàn thành — trang đối soát ca có tab ② Phần tiền / ③ Hoàn thành riêng
export const SHIFT_STEPS = ['Ai làm ca', 'Nghỉ & làm thay', 'Bàn giao'];
export function shiftSteps(active, cover, attr = 'data-shift-step') {
  return html`<nav class="sc-steps" aria-label="Các bước chốt ca và đối soát">${SHIFT_STEPS.map((label, i) => i === 1 && !cover ? '' : html`<button type="button" ${attr === 'data-ds-go' ? html`data-ds-go="${i}"` : html`data-shift-step="${i}"`} class="${i === active ? 'on' : ''}" aria-current="${i === active ? 'step' : 'false'}"><b>${i + 1 - (!cover && i > 1 ? 1 : 0)}</b><span>${label}</span></button>`)}</nav>`;
}
export function shiftFabiFields(fields) {
  return html`<div class="sc-fabi-grid">${fields.map(([label, control, help]) => html`<label class="pc-f"><span>${label}</span>${control}${help ? html`<small class="st-meta">${help}</small>` : ''}</label>`)}</div>`;
}
export function newExchangeKey() { return crypto.randomUUID(); }
// bước 133: "Luân chuyển tiền mặt – CK" (trước: Khách CK rút tiền mặt) — 2 chiều: tm_ck (TM −, CK +) · ck_tm (TM +, CK −)
export const EXCH_LABEL = 'Luân chuyển tiền mặt – CK';
export const EXCH_DIRS = [['tm_ck', 'TM → CK'], ['ck_tm', 'CK → TM']];
export const exchSigns = (dir) => (dir === 'ck_tm' ? { tm: 1, ck: -1 } : { tm: -1, ck: 1 });
// chặng 6.4 (anh Tiến chốt 23/11): 4 nhóm công nợ — một nguồn tên chung cho mọi trang (Công nợ, Sổ thu chi, phiếu chốt ca, đối soát ca)
export const DEBT_GRPS = ['khach', 'kho', 'chu', 'khac'];
export const DEBT_GRP = { khach: '① Nợ khách hàng', kho: '② Nợ kho tổng', chu: '③ Nợ của Chủ (anh Tiến)', khac: '④ Người nhà / người quen' };
export const DEBT_GRP_SHORT = { khach: 'Nợ khách hàng', kho: 'Nợ kho tổng', chu: 'Chủ (anh Tiến)', khac: 'Người nhà / người quen' };
export function debtWhoSel(d, people, attrs = '') {
  const cur = d.grp && d.grp !== 'khach' ? d.table_name : '';
  const opts = [['', 'Khách', 'khach'], ...(people || []).map((p) => [p.name, p.name, p.grp])];
  if (cur && !opts.some((o) => o[0] === cur)) opts.push([cur, cur, d.grp]);
  return `<select class="input debt-who" ${attrs} aria-label="Người nợ">${opts.map(([v, l, g]) => `<option value="${String(v).replace(/"/g, '&quot;')}" data-grp="${g}" ${v === cur ? 'selected' : ''}>Người nợ: ${String(l).replace(/</g, '&lt;')}${g === 'kho' ? ' (②)' : g === 'khac' ? ' (③)' : ''}</option>`).join('')}</select>`;
}
export function collapseMoves(moves = []) {
  const seen = new Set();
  return moves.flatMap((m) => {
    if (!m.exchange_key) return [{ ...m }];
    if (seen.has(m.exchange_key)) return [];
    const pair = moves.filter((x) => x.exchange_key === m.exchange_key);
    // Không gộp dữ liệu hỏng hoặc hai khoản chỉ tình cờ giống nhau.
    if (pair.length !== 2 || !pair.some((x) => x.kind === 'tien_mat') || !pair.some((x) => x.kind === 'chuyen_khoan') || Number(pair[0].amount) + Number(pair[1].amount) !== 0 || pair[0].note !== pair[1].note) return [{ ...m }];
    seen.add(m.exchange_key);
    const tm = pair.find((x) => x.kind === 'tien_mat');
    return [{ ...m, kind: 'doi_tien', amount: Math.abs(Number(m.amount)), dir: Number(tm.amount) > 0 ? 'ck_tm' : 'tm_ck' }];
  });
}
export function expandMoves(moves = []) {
  return moves.flatMap((m) => m.kind === 'doi_tien' ? [
    { kind: 'tien_mat', amount: exchSigns(m.dir).tm * Math.abs(Number(m.amount) || 0), note: m.note || '', exchange_key: m.exchange_key },
    { kind: 'chuyen_khoan', amount: exchSigns(m.dir).ck * Math.abs(Number(m.amount) || 0), note: m.note || '', exchange_key: m.exchange_key },
  ] : [{ kind: m.kind, amount: m.amount, note: m.note || '', ...(m.exchange_key ? { exchange_key: m.exchange_key } : {}) }]);
}
export function periodError(start, end) {
  if (!start || !end) return 'Nhập đủ thời gian bắt đầu và kết thúc doanh thu.';
  const a = Date.parse(start.replace(' ', 'T')), b = Date.parse(end.replace(' ', 'T'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Thời gian doanh thu chưa hợp lệ.';
  return b <= a ? 'Kết thúc doanh thu phải sau bắt đầu. Qua nửa đêm thì chọn ngày hôm sau.' : '';
}
export function shiftMoneyTable({ rows = [], expected = [], actual = [], gap = [], actualLabel = 'NV đếm · hotline', waitBank = false }) {
  const val = (n, sign = false) => n == null ? '—' : (sign && Number(n) > 0 ? '+' : '') + fmt(Number(n));
  return html`<table class="mt sc-money"><caption>Bảng tiền của ca</caption><thead><tr><th scope="col">Khoản</th><th scope="col">Tiền mặt</th><th scope="col">Chuyển khoản</th></tr></thead><tbody>
    ${rows.filter(([, a, b]) => Number(a || 0) || Number(b || 0)).map(([label, a, b, plain]) => html`<tr><th scope="row">${label}</th><td>${val(a, !plain)}</td><td>${val(b, !plain)}</td></tr>`)}
    <tr class="mt-must"><th scope="row">= Phải có / phải nhận</th>${expected.map((n) => html`<td>${val(n)}</td>`)}</tr>
    <tr class="mt-real"><th scope="row">Thực tế <small>${actualLabel}</small></th>${actual.map((n) => html`<td>${val(n)}</td>`)}</tr>
    <tr class="mt-gap"><th scope="row">Lệch</th>${gap.map((n, i) => html`<td class="${n == null ? '' : Number(n) === 0 ? 'sc-ok' : 'sc-bad'}">${i === 1 && waitBank ? 'Chờ ngân hàng' : n == null ? '—' : Number(n) === 0 ? '✓ Khớp' : val(n, true)}</td>`)}</tr></tbody></table>`;
}
// Nút bấm 1 lần thay ô chọn: Thu | Chi · TM | CK (hoặc 1 nhóm bất kỳ). Ô <select> ẩn bên cạnh giữ giá trị và sự kiện "change" như cũ.
// dir: 'thu' | 'chi'; pay: 'tm' | 'ck'. Giá trị ô chọn có dạng "chi_tm".
export function kindSeg(dir, pay, dis = false) {
  const b = (g, v, label, on) => html`<button type="button" data-tg="${g}" data-v="${v}" class="${on ? 'on ' + v : ''}" aria-pressed="${on ? 'true' : 'false'}" ${dis ? 'disabled' : ''}>${label}</button>`;
  return html`<span class="sc-seg" role="group" aria-label="Thu hay chi">${b('dir', 'thu', 'Thu', dir === 'thu')}${b('dir', 'chi', 'Chi', dir === 'chi')}</span><span class="sc-seg" role="group" aria-label="Tiền mặt hay chuyển khoản">${b('pay', 'tm', 'TM', pay === 'tm')}${b('pay', 'ck', 'CK', pay === 'ck')}</span>`;
}
export function oneSeg(items, cur, dis = false, label = 'Chọn') {
  return html`<span class="sc-seg" role="group" aria-label="${label}">${items.map(([v, l]) => html`<button type="button" data-tg="one" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" aria-pressed="${String(cur) === String(v) ? 'true' : 'false'}" ${dis ? 'disabled' : ''}>${l}</button>`)}</span>`;
}
export function bindKindSeg(root) {
  if (!root || root.dataset.ksb) return; root.dataset.ksb = '1';
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tg]'); if (!b || b.disabled) return;
    const box = b.closest('.sc-kt'); const sel = box && box.querySelector('select'); if (!sel || sel.disabled) return;
    let nv;
    if (b.dataset.tg === 'one') nv = b.dataset.v;
    else { let [d, p] = String(sel.value || 'chi_tm').split('_'); if (b.dataset.tg === 'dir') d = b.dataset.v; else p = b.dataset.v; nv = `${d}_${p}`; }
    if (nv === sel.value) return;
    sel.value = nv;
    const [d2, p2] = nv.split('_');
    box.querySelectorAll('[data-tg]').forEach((x) => { const on = x.dataset.tg === 'one' ? x.dataset.v === nv : x.dataset.v === (x.dataset.tg === 'dir' ? d2 : p2); x.className = on ? 'on ' + x.dataset.v : ''; x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
export const SHIFT_CSS = html`<style>
.sc-kt{display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-width:0}.sc-kt>b{font-size:14px}.sc-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;flex:none}.sc-seg button{font:inherit;font-size:14px;font-weight:600;border:0;background:var(--card);color:var(--ink);padding:0 12px;min-height:40px;cursor:pointer}.sc-seg button+button{border-left:1px solid var(--line)}.sc-seg button.on{background:var(--forest,#2f3d31);color:#fff}.sc-seg button.on.thu{background:#2f6b3a}.sc-seg button.on.chi{background:#9a3412}.sc-seg button:disabled{cursor:default;opacity:.75}.sc-row label.sc-full{display:flex;gap:8px;align-items:center}.sc-block>.pc-f,.sc-block>label.pc-f{display:flex;flex-direction:column;align-items:stretch;gap:4px}.sc-block textarea{width:100%;box-sizing:border-box}.sc-v{border-radius:16px;padding:12px 14px;font-size:17px;font-weight:700}.sc-v small{display:block;font-size:13px;font-weight:500;margin-top:2px;opacity:.85}.sc-v.ok{background:var(--ok-bg,#e8f3e4);color:var(--ok-ink,#24502a)}.sc-v.bad{background:var(--off-bg,#fdecea);color:var(--off-ink,#9b1c1c)}.sc-v.wait{background:var(--warn-bg,#fff6e0);color:var(--warn-ink,#7a4b00)}.sc-fabi>summary{display:flex;gap:10px;align-items:center;cursor:pointer;list-style:none;font-weight:600;font-size:15px;text-transform:none;letter-spacing:normal}.sc-fabi>summary::-webkit-details-marker{display:none}.sc-fabi>summary .sc-r{margin-left:auto;color:var(--muted);font-size:12px;font-weight:500;white-space:nowrap}.sc-ic{width:24px;height:24px;border-radius:50%;display:grid;place-content:center;font-size:13px;flex:none;background:var(--warn-bg,#fff6e0);color:var(--warn-ink,#7a4b00)}.sc-ic.ok{background:var(--ok-bg,#e8f3e4);color:var(--ok-ink,#24502a)}.sc-h3{margin:4px 0 0;font-size:15px}.sc-conv{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.sc-conv .btn{min-height:34px!important;font-size:12px;padding:0 10px;text-transform:none}.sc-h{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}.sc-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
.sc-wrap,.ph-wrap:has(.sc-steps){max-width:720px;margin:0 auto;width:100%;min-width:0;box-sizing:border-box}.sc-wrap input,.sc-wrap select,.sc-wrap textarea{max-width:100%;min-width:0}.sc-steps{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;margin:0 0 12px}.sc-steps:has(button:nth-child(3):last-child){grid-template-columns:repeat(3,minmax(0,1fr))}.sc-steps button{font:inherit;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:12px;min-height:60px;padding:8px 4px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}.sc-steps button.on{background:var(--forest,#2f3d31);color:white;border-color:var(--forest)}.sc-steps b{border:1px solid currentColor;border-radius:50%;width:23px;height:23px;display:grid;place-content:center;flex:none}.sc-steps span{font-size:13px;font-weight:600}.sc-block{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}.sc-block h2{margin:0;font-size:18px}.sc-money{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;font-variant-numeric:tabular-nums}.sc-money caption{text-align:left;font-weight:700;font-size:18px;margin-bottom:12px}.sc-money th,.sc-money td{padding:9px 6px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.sc-money th:first-child{width:43%;text-align:left}.sc-money td,.sc-money thead th:not(:first-child){text-align:right}.sc-money tbody th{font-weight:400}.sc-money small{display:block;color:var(--muted);font-size:11px}.sc-money .mt-must{background:var(--caramel-soft,#f5ebdf);font-weight:700}.sc-money .mt-gap{font-weight:700}.sc-ok{color:var(--ok-ink,#24502a)}.sc-bad{color:#b91c1c}.sc-period{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sc-period label{min-width:0}.sc-period input{width:100%;min-width:0;box-sizing:border-box}.sc-exchange{border-left:4px solid var(--primary);background:var(--caramel-soft,#f5ebdf)}.sc-exchange small{display:block;color:var(--muted)}.sc-row{border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--card)}.sc-row>.sc-kt,.sc-row>strong{flex:0 1 auto;min-width:0}.sc-row>input.money,.sc-row>.mv-amt,.sc-row>.db-amt,.sc-row>.paid-amount{flex:1 1 90px;max-width:140px;min-width:0;width:auto;margin-left:auto;text-align:right}.sc-row>.btn.danger,.sc-row>.pill{flex:none}.sc-row>.btn.danger{min-width:44px;padding-inline:0}.sc-row>span:empty{display:none}.sc-row .sc-full{flex:1 1 100%;grid-column:1/-1}.sc-row input,.sc-row select{min-width:0}.sc-actions{display:flex;gap:8px;flex-wrap:wrap}.sc-wrap .btn,.sc-wrap input,.sc-wrap select,.sc-wrap .cm-seg button,.ph-wrap:has(.sc-steps) .btn{min-height:44px}.sc-wrap .input{font-size:16px}.sc-wrap .cm-col{max-width:none}.sc-wrap .cm-card{padding:0;border:0;background:none;box-shadow:none}.sc-wrap .cm-nav{position:sticky;bottom:0;background:var(--ground);padding:10px 0;z-index:3}.sc-wrap .cm-nav .btn{flex:1}.sc-wrap .sc-staff{border:1px solid var(--line);padding:12px;border-radius:12px}.sc-wrap .sc-staff .cm-person{background:var(--card)}
.ph-wrap:has(.sc-steps) .pc-sec.pc-auto > :not(.pc-sec-head){opacity:1}.ph-wrap:has(.sc-steps) input:disabled{opacity:1;color:var(--ink-2);background:var(--ground)}.sc-fabi-grid .pc-f:last-child:nth-child(odd){grid-column:1/-1}.sc-wrap .cm-nav .btn{font-size:14px;text-transform:none;padding:10px 6px;line-height:1.3}.sc-fabi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sc-fabi-grid .pc-f{min-width:0}.uv-row.sc-exchange small,.uv-row .sc-full{flex-basis:100%;grid-column:1/-1}.ph-wrap:has(.sc-steps) .input{font-size:16px}.ph-wrap:has(.sc-steps) .pc-sec-head h2{font-size:18px}@media(max-width:480px){.sc-two{grid-template-columns:1fr}.sc-seg button{padding:0 7px;font-size:13px}.sc-kt{gap:4px}.sc-kt>b{font-size:12px}.sc-row{padding:8px;gap:6px}.sc-row>input.money,.sc-row>.mv-amt,.sc-row>.db-amt,.sc-row>.paid-amount{flex-basis:84px;max-width:124px;padding-inline:8px}.sc-row>.btn.danger{min-width:40px}.sc-steps{gap:4px}.sc-steps button{flex-direction:column;gap:4px}.sc-steps span{font-size:11px}.sc-period{grid-template-columns:1fr}.sc-money{font-size:12px}.sc-money th,.sc-money td{padding:9px 4px}.sc-row .sc-note{grid-column:1/-1}.sc-block{padding:12px}.sc-wrap .cm-fabi{grid-template-columns:minmax(0,1fr) 120px}.sc-wrap .cm-person .cm-line{grid-template-columns:minmax(0,1fr) 100px auto}}
</style>`;
