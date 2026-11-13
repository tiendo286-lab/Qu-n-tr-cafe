// Bước 64: Cho vay (chỉ cơ sở bật trong cài đặt — mặc định LHP). Người vay khai báo ở Cài đặt › Người vay.
// Cho vay = tiền ra khỏi quỹ, trả nợ = tiền về quỹ — không tính chi phí / doanh thu.
import { rpc } from './sb.js';
import { bindMoneyInputs, dmy, fmt, parseMoney, vnd } from './tien.js';
import { dialog, html, showSaved, str } from './ui.js';

const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const payRadio = (sel = 'tien_mat') => html`<div class="pc-line" role="radiogroup" aria-label="Hình thức">${Object.entries(PAY).map(([k, l]) => html`<label class="radio-pill"><input type="radio" name="pay" value="${k}" ${sel === k ? 'checked' : ''}> ${l}</label>`)}</div>`;

export const LOAN_CSS = html`<style>
  .ln-sec { padding: 14px; margin-bottom: 12px; }
  .ln-h { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: center; }
  .ln-p { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; padding: 8px 4px; border-top: 1px solid var(--line); }
  .ln-p .grow { min-width: 0; overflow-wrap: anywhere; } .ln-owe { font-weight: 800; color: #b91c1c; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ln-l { padding: 8px 4px; border-top: 1px solid var(--line-soft, var(--line)); font-size: 14px; }
  .ln-l .pc-line { flex-wrap: wrap; } .ln-pay { padding-left: 14px; }
  .ln-dlg { width: min(480px, calc(100vw - 56px)); }
</style>`;

// Khung Cho vay cho các cơ sở trong `branches` (chỉ hiện cơ sở đã bật)
export async function mountLoans(box, branches, onChange) {
  if (!box) return;
  const all = await Promise.all(branches.map((b) => rpc('app_loans', { p_branch: b.id }).then((d) => ({ b, d })).catch(() => null)));
  const on = all.filter((x) => x && x.d.enabled);
  if (!on.length) { box.innerHTML = ''; return; }
  box.innerHTML = str(html`${LOAN_CSS}${on.map(({ b, d }) => section(b, d))}`);
  on.forEach(({ b, d }) => bind(box.querySelector(`.ln-sec[data-b="${b.id}"]`), b, d, onChange));
}

function section(b, d) {
  const owing = d.people.filter((p) => p.owe > 0);
  const tot = owing.reduce((t, p) => t + p.owe, 0);
  return html`<section class="card stack ln-sec" data-b="${b.id}" style="gap:8px">
    <div class="ln-h"><h2 style="margin:0">Cho vay — ${b.code}</h2>
      <span class="toolbar" style="gap:8px"><span class="st-meta">Còn cho vay <b>${vnd(tot)}</b> · không tính chi phí, ra / vào quỹ</span>
        <button type="button" class="btn sm ln-new">+ Cho vay</button>${d.can_people ? html`<a class="btn sm secondary" href="#/cai-dat/nguoi-vay">Người vay</a>` : ''}</span></div>
    ${owing.length ? owing.map((p) => html`<div class="ln-p"><div class="grow"><strong>${p.name}</strong>${p.phone ? html` · <span class="st-meta">${p.phone}</span>` : ''}
        <div class="st-meta">Đã vay ${vnd(p.lent)} · đã trả ${vnd(p.paid)}</div></div>
        <span class="toolbar" style="gap:8px"><span class="ln-owe">còn nợ ${vnd(p.owe)}</span><button type="button" class="btn sm secondary ln-pay-btn" data-p="${p.id}">Ghi trả nợ</button></span></div>`)
      : html`<div class="st-meta">Không ai còn nợ.</div>`}
    ${d.loans.length ? html`<details><summary style="cursor:pointer;font-weight:600">Lịch sử cho vay (${d.loans.length} khoản)</summary>
      ${d.loans.map((l) => html`<div class="ln-l"><div class="pc-line"><span class="grow"><strong>${dmy(l.date)} · ${l.person}</strong> · cho vay <b>${vnd(l.amount)}</b> (${PAY[l.method]})${l.note ? ` · ${l.note}` : ''}
          <span class="st-meta"> · ${l.amount - l.paid > 0 ? `còn ${vnd(l.amount - l.paid)}` : 'đã trả hết'} · ${l.by || ''}</span></span>
          ${l.locked ? html`<span class="st-meta">Tháng đã chốt</span>` : !l.payments.length ? html`<button type="button" class="btn sm secondary danger ln-del" data-id="${l.id}" aria-label="Xoá khoản vay">×</button>` : ''}</div>
        ${l.payments.map((y) => html`<div class="pc-line ln-pay"><span class="grow">↳ ${dmy(y.date)} trả <b>${vnd(y.amount)}</b> (${PAY[y.method]})${y.note ? ` · ${y.note}` : ''} <span class="st-meta">· ${y.by || ''}</span></span>
          ${y.locked ? '' : html`<button type="button" class="btn sm secondary danger ln-pdel" data-id="${y.id}" aria-label="Xoá lần trả">×</button>`}</div>`)}</div>`)}</details>` : ''}
  </section>`;
}

function bind(sec, b, d, onChange) {
  const done = (m) => { showSaved(m); onChange?.(); };
  sec.querySelector('.ln-new').addEventListener('click', () => {
    const ppl = d.people.filter((p) => p.active);
    if (!ppl.length) { showSaved('Chưa có người vay — khai báo ở Cài đặt › Người vay.', true); return; }
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">Cho vay — ${b.code}</h2>
      <div class="st-meta">Tiền ra khỏi quỹ, không tính chi phí. Người vay trả thì bấm "Ghi trả nợ".</div>
      <label class="field"><span>Người vay</span><select class="input" name="p">${ppl.map((p) => html`<option value="${p.id}">${p.name}${p.owe > 0 ? ` (đang nợ ${fmt(p.owe)})` : ''}</option>`)}</select></label>
      <label class="field"><span>Ngày</span><input class="input" type="date" name="d" value="${today()}"></label>
      <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off"></label>
      ${payRadio()}
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" placeholder="vd: vay mua hàng, hẹn trả cuối tháng"></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu khoản vay</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await rpc('app_loan_save', { p_id: null, p: { branch_id: b.id, person_id: Number(f.p.value), date: f.d.value, amount: parseMoney(f.amt.value), method: f.querySelector('[name=pay]:checked').value, note: f.note.value } });
        dl.close(); done('Đã ghi khoản cho vay.');
      } catch (e) { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  });
  sec.querySelectorAll('.ln-pay-btn').forEach((btn) => btn.addEventListener('click', () => {
    const p = d.people.find((x) => x.id === Number(btn.dataset.p));
    const open = d.loans.filter((l) => l.person_id === p.id && l.amount - l.paid > 0).sort((x, y) => x.date.localeCompare(y.date));
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">Ghi trả nợ — ${p.name}</h2>
      <div class="st-meta">Còn nợ ${vnd(p.owe)}. Tiền về quỹ, không tính doanh thu. Trả dần được.</div>
      <label class="field"><span>Trả cho khoản vay</span><select class="input" name="l">${open.map((l) => html`<option value="${l.id}" data-left="${l.amount - l.paid}">${dmy(l.date)} · vay ${fmt(l.amount)} · còn ${fmt(l.amount - l.paid)}</option>`)}</select></label>
      <label class="field"><span>Ngày trả</span><input class="input" type="date" name="d" value="${today()}"></label>
      <label class="field"><span>Số tiền trả</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${open.length ? fmt(open[0].amount - open[0].paid) : ''}"></label>
      ${payRadio()}
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off"></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu lần trả</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    f.l.addEventListener('change', () => { f.amt.value = fmt(Number(f.l.selectedOptions[0].dataset.left)); });
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await rpc('app_loan_pay', { p_loan: Number(f.l.value), p_date: f.d.value, p_amount: parseMoney(f.amt.value), p_method: f.querySelector('[name=pay]:checked').value, p_note: f.note.value });
        dl.close(); done('Đã ghi lần trả nợ.');
      } catch (e) { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }));
  sec.querySelectorAll('.ln-del').forEach((x) => x.addEventListener('click', async () => {
    if (!confirm('Xoá khoản cho vay này?')) return;
    try { await rpc('app_loan_delete', { p_id: Number(x.dataset.id) }); done('Đã xoá khoản vay.'); } catch (e) { showSaved(e.message, true); }
  }));
  sec.querySelectorAll('.ln-pdel').forEach((x) => x.addEventListener('click', async () => {
    if (!confirm('Xoá lần trả nợ này?')) return;
    try { await rpc('app_loan_pay_delete', { p_id: Number(x.dataset.id) }); done('Đã xoá lần trả.'); } catch (e) { showSaved(e.message, true); }
  }));
}
