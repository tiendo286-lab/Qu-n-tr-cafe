// Bước 70 / 85: khung CÔNG NỢ ở Thu chi (mọi cơ sở). Bước 85 (anh Tiến 13/11/2026): BỎ mục Người vay / Cho vay —
// mọi khoản người khác nợ quán là Nợ HĐ / Nợ TM / Nợ CK. Khoản cho vay cũ còn nợ đã chuyển thành Nợ TM / Nợ CK (gia đình).
// Quản lý: ghi "+ Nợ HĐ / + Nợ TM / + Nợ CK" (Nợ TM / Nợ CK có ô "tiền đưa từ quỹ" → Sổ quỹ trừ ra), đánh dấu / bỏ "Gia đình"
// (cuối tháng thu, phiếu chốt ca không nhắc), bấm "Đã thu" khi trả ngoài ca (Sổ quỹ cộng vào; trả một phần được; bỏ được nếu ghi nhầm).
import { rpc } from './sb.js';
import { bindMoneyInputs, dmy, fmt, noKind, parseMoney, vnd } from './tien.js';
import { dialog, html, showSaved, str } from './ui.js';

const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const payRadio = (sel = 'tien_mat') => html`<div class="pc-line" role="radiogroup" aria-label="Hình thức">${Object.entries(PAY).map(([k, l]) => html`<label class="radio-pill"><input type="radio" name="pay" value="${k}" ${sel === k ? 'checked' : ''}> ${l}</label>`)}</div>`;
const KIND_HELP = {
  bill: 'Nợ HĐ: khách chưa trả hóa đơn.',
  muon: 'Nợ TM: người đó cầm tiền mặt của quán (hoặc Fabi ghi tiền mặt mà chưa nhận tiền).',
  ck: 'Nợ CK: quán chuyển khoản cho người đó (hoặc Fabi ghi chuyển khoản mà khách chưa chuyển).',
};

export const LOAN_CSS = html`<style>
  .ln-sec { padding: 14px; margin-bottom: 12px; }
  .ln-h { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: center; }
  .ln-p { display: flex; flex-direction: column; gap: 6px; padding: 8px 4px; border-top: 1px solid var(--line); }
  .ln-p .grow { min-width: 0; overflow-wrap: anywhere; } .ln-owe { font-weight: 800; color: #b91c1c; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ln-p > .toolbar { display: flex; flex-direction: row; flex-wrap: wrap; justify-content: space-between; align-items: center; width: 100%; gap: 8px; } .ln-p > .toolbar .btn { width: auto; }
  .ln-dlg { width: min(480px, calc(100vw - 56px)); }
  .ln-act { flex-wrap: wrap; width: auto; justify-content: flex-end; } .ln-act .btn { width: auto; }
  .ln-g { font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
  .ln-btns { display: flex; gap: 6px; flex-wrap: wrap; } .ln-btns .btn { width: auto; }
  .ln-late { color: #b91c1c; font-weight: 700; }
  .ln-l { padding: 6px 4px; border-top: 1px solid var(--line-soft, var(--line)); font-size: 14px; } .ln-l .pc-line { flex-wrap: wrap; }
</style>`;

// Bước 85: đã bỏ "đổi khoản chi thành cho vay" — giữ hàm cho trang cũ gọi tới, chỉ báo
export async function toLoan() { showSaved('Đã bỏ mục Người vay — ghi Nợ TM / Nợ CK ở mục Công nợ.', true); }

// Khung Công nợ cho các cơ sở trong `branches`
export async function mountLoans(box, branches, onChange) {
  if (!box) return;
  const all = await Promise.all(branches.map((b) => rpc('app_cn_debts', { p_branch: b.id }).then((cn) => ({ b, cn })).catch(() => null)));
  const on = all.filter(Boolean);
  if (!on.length) { box.innerHTML = ''; return; }
  box.innerHTML = str(html`${LOAN_CSS}${on.map(({ b, cn }) => section(b, cn))}`);
  on.forEach(({ b, cn }) => bind(box.querySelector(`.ln-sec[data-b="${b.id}"]`), b, cn, onChange));
}

const daysAgo = (d) => Math.max(0, Math.round((Date.parse(today()) - Date.parse(d)) / 864e5));
function section(b, cn) {
  const open = cn.open || []; const tot = open.reduce((t, x) => t + Number(x.amount), 0);
  const cus = open.filter((x) => !x.family); const fam = open.filter((x) => x.family);
  const ed = !!cn.can_edit;
  const row = (x) => { const n = daysAgo(x.date); return html`<div class="ln-p cn-row" data-id="${x.id}"><div class="grow"><span class="pill ${x.kind === 'muon' || x.kind === 'ck' ? 'warn' : 'info'}">${noKind(x.kind)}</span> <strong>${x.name}</strong>${x.phone ? html` · <span class="st-meta">${x.phone}</span>` : ''}
      <div class="st-meta">${dmy(x.date)} · <span class="${n > 7 && !x.family ? 'ln-late' : ''}">${n ? `${n} ngày` : 'hôm nay'}</span> · ${x.gap_report ? html`<a href="#/quan-ly/doi-soat/ca?id=${x.gap_report}">ghi nhận ở đối soát ca ${x.gap_ca || ''}</a>` : x.from_loan ? 'từ khoản cho vay cũ' : x.by_ql ? `quản lý ghi (${x.by || ''})` : html`<a href="#/ca/phieu?id=${x.report_id}">phiếu ca ${x.shift || ''}</a>`}${x.fund_out ? ' · tiền đưa từ quỹ' : ''}${x.paid_before ? ` · đã trả ${vnd(x.paid_before)}` : ''}${x.note ? ` · ${x.note}` : ''}</div></div>
      <span class="toolbar ln-act" style="gap:6px"><span class="ln-owe">${vnd(x.amount)}</span>${ed ? html`<button type="button" class="btn sm cn-thu">Đã thu</button><button type="button" class="btn sm secondary cn-fam" title="${x.family ? 'Bỏ khỏi công nợ gia đình' : 'Công nợ gia đình: cuối tháng thu, phiếu chốt ca không nhắc'}">${x.family ? 'Bỏ gia đình' : 'Gia đình'}</button>` : ''}${ed && x.by_ql && !x.split && !x.gap_report && !x.from_loan ? html`<button type="button" class="btn sm secondary cn-ed">Sửa</button><button type="button" class="btn sm secondary danger cn-del" aria-label="Xoá khoản nợ">×</button>` : ''}</span></div>`; };
  return html`<section class="card stack ln-sec" data-b="${b.id}" style="gap:8px">
    <div class="ln-h"><h2 style="margin:0">Công nợ — ${b.code}</h2><span class="st-meta">còn <b>${vnd(tot)}</b></span></div>
    ${ed ? html`<div class="ln-btns"><button type="button" class="btn sm secondary cn-new" data-k="bill">+ Nợ HĐ</button><button type="button" class="btn sm secondary cn-new" data-k="muon">+ Nợ TM</button><button type="button" class="btn sm secondary cn-new" data-k="ck">+ Nợ CK</button></div>` : ''}
    <div class="ln-g">Khách nợ <span class="st-meta">— phiếu chốt ca nhắc thu</span></div>
    ${cus.length ? cus.map(row) : html`<div class="st-meta">Không có khách nợ.</div>`}
    <div class="ln-g">Công nợ gia đình <span class="st-meta">— cuối tháng thu, phiếu chốt ca không nhắc</span></div>
    ${fam.length ? fam.map(row) : html`<div class="st-meta">Không có.</div>`}
    <div class="st-meta">Khách trả trong ca: nhân viên chọn ở phiếu chốt ca (trả một phần được). Trả ngoài ca (người nhà cuối tháng, chuyển khoản thẳng…): bấm <b>Đã thu</b> — Sổ quỹ cộng vào. Nhân viên không được vay / ứng tiền của quán.</div>
    ${(cn.thu || []).length ? html`<details><summary style="cursor:pointer;font-weight:600">Quản lý đã thu gần đây (${cn.thu.length})</summary>
      ${cn.thu.map((y) => html`<div class="ln-l"><div class="pc-line"><span class="grow">${dmy(y.date)} · ${noKind(y.kind)} <strong>${y.name}</strong> · <b>${vnd(y.amount)}</b> (${PAY[y.collect_kind]})${y.note && y.note !== 'Quản lý thu' ? ` · ${y.note}` : ''} <span class="st-meta">· ${y.by || ''}</span></span>
        ${ed && !y.locked ? html`<button type="button" class="btn sm secondary cn-unthu" data-id="${y.id}">Bỏ đã thu</button>` : y.locked ? html`<span class="st-meta">Tháng đã chốt</span>` : ''}</div></div>`)}</details>` : ''}
  </section>`;
}

function bind(sec, b, cn, onChange) {
  const done = (m) => { if (onChange) onChange(m); else showSaved(m); };
  const err = (dl, e) => { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); };
  const cnOf = (x) => (cn.open || []).find((y) => y.id === Number(x.closest('.cn-row').dataset.id));
  // ghi / sửa khoản nợ do quản lý ghi (không thuộc ca)
  const debtForm = (x, k0) => {
    const k = x ? x.kind : k0;
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">${x ? 'Sửa' : 'Ghi'} ${noKind(k)} — ${b.code}</h2>
      <div class="st-meta">${KIND_HELP[k] || KIND_HELP.bill} Khoản nợ hiện ở đầu phiếu chốt ca sau để nhân viên nhớ thu (trừ công nợ gia đình).</div>
      <label class="field"><span>Tên người nợ</span><input class="input" name="nm" autocomplete="off" value="${x ? x.name : ''}" placeholder="vd: Công ty B, chị Hoa bàn 5"></label>
      <label class="field"><span>Số điện thoại</span><input class="input" name="ph" inputmode="tel" autocomplete="off" value="${x ? x.phone || '' : ''}"></label>
      <label class="field"><span>Ngày nợ</span><input class="input" type="date" name="d" value="${x ? x.date : today()}" ${x ? 'disabled' : ''}></label>
      <label class="field"><span>Số tiền nợ</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${x ? fmt(x.amount) : ''}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" value="${x ? x.note || '' : ''}" placeholder="vd: hẹn trả cuối tuần"></label>
      ${k !== 'bill' ? html`<label class="pc-line" style="gap:6px"><input type="checkbox" name="fo" ${!x || x.fund_out ? 'checked' : ''}> <span><b>Tiền đưa từ quỹ</b> <span class="st-meta">— Sổ quỹ trừ ra (${k === 'ck' ? 'chuyển khoản' : 'tiền mặt'}). Bỏ tích nếu tiền đã ra khỏi két trong ca.</span></span></label>` : ''}
      <label class="pc-line" style="gap:6px"><input type="checkbox" name="fam" ${x && x.family ? 'checked' : ''}> <span><b>Công nợ gia đình</b> <span class="st-meta">— cuối tháng thu, phiếu chốt ca không nhắc</span></span></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await rpc('app_cn_debt_save', { p_id: x ? x.id : null, p: { branch_id: b.id, name: f.nm.value, phone: f.ph.value, date: f.d.value, amount: parseMoney(f.amt.value), note: f.note.value,
          kind: k, family: f.fam.checked, fund_out: !!f.fo?.checked } });
        dl.close(); done(x ? 'Đã sửa khoản nợ.' : `Đã ghi ${noKind(k)}.`);
      } catch (e) { err(dl, e); }
    });
  };
  sec.querySelectorAll('.cn-new').forEach((x) => x.addEventListener('click', () => debtForm(null, x.dataset.k)));
  sec.querySelectorAll('.cn-ed').forEach((x) => x.addEventListener('click', () => debtForm(cnOf(x))));
  sec.querySelectorAll('.cn-del').forEach((x) => x.addEventListener('click', async () => {
    const c = cnOf(x); if (!confirm(`Xoá khoản nợ "${c.name}" (${vnd(c.amount)})?`)) return;
    try { await rpc('app_cn_debt_delete', { p_id: c.id }); done('Đã xoá khoản nợ.'); } catch (e) { showSaved(e.message, true); }
  }));
  sec.querySelectorAll('.cn-fam').forEach((x) => x.addEventListener('click', async () => {
    const c = cnOf(x);
    try { await rpc('app_cn_debt_family', { p_id: c.id, p_on: !c.family }); done(c.family ? 'Đã bỏ khỏi công nợ gia đình.' : 'Đã chuyển vào công nợ gia đình.'); } catch (e) { showSaved(e.message, true); }
  }));
  // Đã thu (ngoài ca) — Sổ quỹ cộng vào
  sec.querySelectorAll('.cn-thu').forEach((x) => x.addEventListener('click', () => {
    const c = cnOf(x);
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">Đã thu — ${c.name}</h2>
      <div><span class="pill ${c.kind === 'muon' || c.kind === 'ck' ? 'warn' : 'info'}">${noKind(c.kind)}</span> · ${dmy(c.date)} · còn nợ <b>${vnd(c.amount)}</b></div>
      <div class="st-meta">Trả ngoài ca (người nhà cuối tháng, chuyển khoản thẳng vào tài khoản…). Tiền về quỹ, không tính doanh thu. Trả một phần thì phần còn lại vẫn nợ.</div>
      <label class="field"><span>Ngày thu</span><input class="input" type="date" name="d" value="${today()}" max="${today()}"></label>
      <label class="field"><span>Số tiền thu</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${fmt(c.amount)}"></label>
      ${payRadio(c.kind === 'ck' ? 'chuyen_khoan' : 'tien_mat')}
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" placeholder="vd: trả cuối tháng 11"></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu đã thu</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const bt = f.querySelector('[type=submit]'); bt.disabled = true;
      try {
        await rpc('app_cn_debt_collect', { p_id: c.id, p_date: f.d.value, p_kind: f.querySelector('[name=pay]:checked').value, p_amount: parseMoney(f.amt.value), p_note: f.note.value });
        dl.close(); done('Đã ghi thu nợ — Sổ quỹ đã cộng vào.');
      } catch (e) { err(dl, e); bt.disabled = false; }
    });
  }));
  sec.querySelectorAll('.cn-unthu').forEach((x) => x.addEventListener('click', async () => {
    if (!confirm('Bỏ lần thu này? Khoản nợ mở lại, Sổ quỹ bỏ khoản tiền về.')) return;
    try { await rpc('app_cn_debt_uncollect', { p_id: Number(x.dataset.id) }); done('Đã bỏ lần thu.'); } catch (e) { showSaved(e.message, true); }
  }));
}
