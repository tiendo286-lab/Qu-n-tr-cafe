// Bước 64: Cho vay (chỉ cơ sở bật trong cài đặt — mặc định LHP). Người vay khai báo ở Cài đặt › Người vay.
// Cho vay = tiền ra khỏi quỹ, trả nợ = tiền về quỹ — không tính chi phí / doanh thu.
// Bước 65: sửa khoản vay (người vay, ngày, số tiền, hình thức, ghi chú) và sửa lần trả; đổi khoản chi ở Thu chi thành cho vay (toLoan).
// Bước 70: khung CÔNG NỢ (mọi cơ sở) — Kho tổng (vay + trả hộ cộng chung), người vay khác, khách hàng nợ (quản lý ghi thêm: tên, SĐT; thu ở phiếu chốt ca).
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
  .ln-act { flex-wrap: nowrap; width: auto; } .ln-act .btn { width: auto; }
  .ln-g { font-size: 12px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }
  .ln-btns { display: flex; gap: 6px; flex-wrap: wrap; } .ln-btns .btn { width: auto; }
  .ln-late { color: #b91c1c; font-weight: 700; }
</style>`;

// Bước 65: đổi 1 khoản chi (quản lý tạo hoặc từ phiếu ca) thành khoản cho vay. item = { src, id | report_id+mkey, note, amount, date, pay, shift }
export async function toLoan(b, item, done) {
  let d; try { d = await rpc('app_loans', { p_branch: b.id }); } catch (e) { showSaved(e.message, true); return; }
  if (!d.enabled) { showSaved('Cơ sở này chưa bật mục Cho vay.', true); return; }
  const ppl = d.people.filter((p) => p.active);
  if (!ppl.length) { showSaved('Chưa có người vay — khai báo ở Cài đặt › Người vay.', true); return; }
  const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">Đổi thành cho vay — ${b.code}</h2>
    <div class="st-meta">${dmy(item.date)} · <b>${vnd(item.amount)}</b> (${PAY[item.pay] || 'Tiền mặt'}) · ${item.note}</div>
    <div class="alert warn">${item.src === 'ca'
      ? html`Khoản ở phiếu ca ${item.shift} thành <b>"Không tính"</b> (không còn là chi phí) và sang khung Cho vay. Sổ quỹ không trừ thêm vì tiền đã ra khỏi két trong ca. Xoá khoản vay thì khoản trở lại Thu chi.`
      : html`Khoản chi này <b>bỏ khỏi Thu chi</b> (không còn là chi phí) và sang khung Cho vay, giữ nguyên ngày, số tiền, hình thức.${item.bank_out ? html` Phiếu chi chuyển khoản ở Đối soát ca <b>giữ nguyên</b> — tiền chuyển ra của ca không đổi, không phải đối soát lại.` : ''}`}</div>
    <label class="field"><span>Người vay</span><select class="input" name="p">${ppl.map((p) => html`<option value="${p.id}">${p.name}${p.owe > 0 ? ` (đang nợ ${fmt(p.owe)})` : ''}</option>`)}</select></label>
    <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" value="${item.note || ''}"></label>
    <div class="ln-err"></div>
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Đổi thành cho vay</button></div></form>`);
  const f = dl.querySelector('form');
  dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await rpc('app_tc_to_loan', { p: item.src === 'ca' ? { src: 'ca', report_id: item.report_id, mkey: item.mkey } : { src: 'tay', id: item.id }, p_person: Number(f.p.value), p_note: f.note.value });
      dl.close(); done?.('Đã đổi thành khoản cho vay.');
    } catch (e) { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
  });
}

// Khung Cho vay cho các cơ sở trong `branches` (chỉ hiện cơ sở đã bật)
export async function mountLoans(box, branches, onChange) {
  if (!box) return;
  const all = await Promise.all(branches.map((b) => Promise.all([rpc('app_loans', { p_branch: b.id }), rpc('app_cn_debts', { p_branch: b.id }).catch(() => ({ open: [], can_edit: false }))])
    .then(([d, cn]) => ({ b, d: { ...d, cn } })).catch(() => null)));
  const on = all.filter((x) => x && x.d.enabled);
  if (!on.length) { box.innerHTML = ''; return; }
  box.innerHTML = str(html`${LOAN_CSS}${on.map(({ b, d }) => section(b, d))}`);
  on.forEach(({ b, d }) => bind(box.querySelector(`.ln-sec[data-b="${b.id}"]`), b, d, onChange));
}

const daysAgo = (d) => Math.max(0, Math.round((Date.parse(today()) - Date.parse(d)) / 864e5));
function section(b, d) {
  const kt = d.kho_tong_id; const owing = d.people.filter((p) => p.owe > 0 && p.id !== kt);
  const K = d.people.find((p) => p.id === kt) || null; const kL = d.loans.filter((l) => l.person_id === kt);
  const kVay = kL.filter((l) => l.kind !== 'tra_ho').reduce((t, l) => t + l.amount, 0); const kTra = kL.filter((l) => l.kind === 'tra_ho').reduce((t, l) => t + l.amount, 0);
  const cus = d.cn?.open || []; const cusTot = cus.reduce((t, x) => t + Number(x.amount), 0);
  const tot = owing.reduce((t, p) => t + p.owe, 0) + (K?.owe || 0) + cusTot;
  const person = (p, sub) => html`<div class="ln-p"><div class="grow"><strong>${p.name}</strong>${p.phone ? html` · <span class="st-meta">${p.phone}</span>` : ''}
      <div class="st-meta">${sub}</div></div>
      <span class="toolbar" style="gap:8px"><span class="ln-owe">còn nợ ${vnd(p.owe)}</span>${p.owe > 0 ? html`<button type="button" class="btn sm secondary ln-pay-btn" data-p="${p.id}">Ghi trả nợ</button>` : ''}</span></div>`;
  return html`<section class="card stack ln-sec" data-b="${b.id}" style="gap:8px">
    <div class="ln-h"><h2 style="margin:0">Công nợ — ${b.code}</h2><span class="st-meta">còn <b>${vnd(tot)}</b></span></div>
    <div class="ln-btns"><button type="button" class="btn sm ln-new">+ Cho vay</button>${d.tra_ho_ok && kt ? html`<button type="button" class="btn sm secondary ln-traho">+ Trả hộ Kho tổng</button>` : ''}${d.cn?.can_edit ? html`<button type="button" class="btn sm secondary cn-new">+ Khách nợ</button>` : ''}${d.can_people ? html`<a class="btn sm secondary" href="#/cai-dat/nguoi-vay">Người vay</a>` : ''}</div>
    ${K && (K.owe > 0 || kL.length) ? html`<div class="ln-g">Kho tổng</div>${person(K, `vay ${vnd(kVay)} + trả hộ ${vnd(kTra)} · đã trả ${vnd(K.paid)}`)}` : ''}
    ${owing.length ? html`<div class="ln-g">Người vay</div>${owing.map((p) => person(p, `Đã vay ${vnd(p.lent)} · đã trả ${vnd(p.paid)}`))}` : ''}
    <div class="ln-g">Khách hàng nợ</div>
    ${cus.length ? cus.map((x) => { const n = daysAgo(x.date); return html`<div class="ln-p cn-row" data-id="${x.id}"><div class="grow"><strong>${x.name}</strong>${x.phone ? html` · <span class="st-meta">${x.phone}</span>` : ''}
        <div class="st-meta">${dmy(x.date)} · <span class="${n > 7 ? 'ln-late' : ''}">${n ? `${n} ngày` : 'hôm nay'}</span> · ${x.by_ql ? `quản lý ghi (${x.by || ''})` : html`<a href="#/ca/phieu?id=${x.report_id}">phiếu ca ${x.shift || ''}</a>`}${x.paid_before ? ` · đã trả ${vnd(x.paid_before)}` : ''}${x.note ? ` · ${x.note}` : ''}</div></div>
        <span class="toolbar ln-act" style="gap:6px"><span class="ln-owe">${vnd(x.amount)}</span>${x.by_ql && !x.split && d.cn?.can_edit ? html`<button type="button" class="btn sm secondary cn-ed">Sửa</button><button type="button" class="btn sm secondary danger cn-del" aria-label="Xoá khách nợ">×</button>` : ''}</span></div>`; })
      : html`<div class="st-meta">Không có khách nợ.</div>`}
    <div class="st-meta">Khách trả nợ: nhân viên bấm "Khách đã trả" ở phiếu chốt ca (trả một phần được). Nhân viên không được vay / ứng tiền của quán. Cho vay / trả hộ không tính chi phí.</div>
    ${d.loans.length ? html`<details><summary style="cursor:pointer;font-weight:600">Lịch sử vay / trả hộ (${d.loans.length} khoản)</summary>
      ${d.loans.map((l) => html`<div class="ln-l"><div class="pc-line"><span class="grow"><strong>${dmy(l.date)} · ${l.person}</strong> · ${l.kind === 'tra_ho' ? 'trả hộ' : 'cho vay'} <b>${vnd(l.amount)}</b> (${PAY[l.method]})${l.note ? ` · ${l.note}` : ''}${l.report_id ? html` · <a href="#/ca/phieu?id=${l.report_id}">từ phiếu ca ${l.shift || ''}</a>` : ''}${l.bank_out ? ' · từ phiếu chi chuyển khoản' : ''}
          <span class="st-meta"> · ${l.amount - l.paid > 0 ? `còn ${vnd(l.amount - l.paid)}` : 'đã trả hết'} · ${l.by || ''}</span></span>
          ${l.locked ? html`<span class="st-meta">Tháng đã chốt</span>` : html`<span class="toolbar ln-act" style="gap:6px"><button type="button" class="btn sm secondary ln-ed" data-id="${l.id}">Sửa</button>${!l.payments.length ? html`<button type="button" class="btn sm secondary danger ln-del" data-id="${l.id}" aria-label="Xoá khoản vay">×</button>` : ''}</span>`}</div>
        ${l.payments.map((y) => html`<div class="pc-line ln-pay"><span class="grow">↳ ${dmy(y.date)} trả <b>${vnd(y.amount)}</b> (${PAY[y.method]})${y.note ? ` · ${y.note}` : ''} <span class="st-meta">· ${y.by || ''}</span></span>
          ${y.locked ? '' : html`<span class="toolbar ln-act" style="gap:6px"><button type="button" class="btn sm secondary ln-ped" data-id="${y.id}" data-l="${l.id}">Sửa</button><button type="button" class="btn sm secondary danger ln-pdel" data-id="${y.id}" aria-label="Xoá lần trả">×</button></span>`}</div>`)}</div>`)}</details>` : ''}
  </section>`;
}

function bind(sec, b, d, onChange) {
  const done = (m) => { if (onChange) onChange(m); else showSaved(m); };
  // l = khoản đang sửa (không có = cho vay mới)
  const loanForm = (l, kind0) => {
    const kind = l ? l.kind || 'vay' : kind0 || 'vay'; const th = kind === 'tra_ho';
    const ppl = th ? d.people.filter((p) => p.id === d.kho_tong_id) : d.people.filter((p) => p.active || (l && p.id === l.person_id));
    if (!ppl.length) { showSaved('Chưa có người vay — khai báo ở Cài đặt › Người vay.', true); return; }
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">${th ? (l ? 'Sửa khoản trả hộ Kho tổng' : 'Trả hộ Kho tổng') : l ? 'Sửa khoản cho vay' : 'Cho vay'} — ${b.code}</h2>
      ${th ? html`<div class="st-meta">Tiền ${b.code} trả thay Kho tổng (tiền ga, ship…): cộng vào nợ của Kho tổng, không tính chi phí. Kho tổng trả thì bấm "Ghi trả nợ".</div>` : ''}
      ${l && (l.report_id || l.bank_out) ? html`<div class="alert warn">Khoản vay ghi từ ${l.report_id ? `phiếu ca ${l.shift || ''}` : 'phiếu chi chuyển khoản'}: chỉ đổi người vay / ghi chú. Sai số tiền thì xoá khoản vay (khoản trở lại Thu chi) rồi sửa.</div>` : ''}
      <div class="st-meta">${l ? (l.paid > 0 ? `Đã trả ${vnd(l.paid)} — số tiền vay không được nhỏ hơn số đã trả.` : 'Sửa người vay, ngày, số tiền, hình thức, ghi chú.') : 'Tiền ra khỏi quỹ, không tính chi phí. Người vay trả thì bấm "Ghi trả nợ".'}</div>
      <label class="field" ${th ? 'hidden' : ''}><span>Người vay</span><select class="input" name="p">${ppl.map((p) => html`<option value="${p.id}" ${l && p.id === l.person_id ? 'selected' : ''}>${p.name}${p.owe > 0 ? ` (đang nợ ${fmt(p.owe)})` : ''}</option>`)}</select></label>
      <label class="field"><span>Ngày</span><input class="input" type="date" name="d" value="${l ? l.date : today()}"></label>
      <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${l ? fmt(l.amount) : ''}"></label>
      ${payRadio(l ? l.method : 'tien_mat')}
      <label class="field"><span>${th ? 'Nội dung (bắt buộc)' : 'Ghi chú'}</span><input class="input" name="note" autocomplete="off" value="${l ? l.note || '' : ''}" placeholder="${th ? 'vd: tiền ga, ship hàng Kho tổng' : 'vd: vay mua hàng, hẹn trả cuối tháng'}"></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">${l ? 'Lưu' : 'Lưu khoản vay'}</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    if (l && (l.report_id || l.bank_out)) f.querySelectorAll('[name=d], [name=amt], [name=pay]').forEach((x) => { x.disabled = true; });
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await rpc('app_loan_save', { p_id: l ? l.id : null, p: { branch_id: b.id, kind, person_id: Number(f.p.value), date: f.d.value, amount: parseMoney(f.amt.value), method: f.querySelector('[name=pay]:checked').value, note: f.note.value } });
        dl.close(); done(th ? (l ? 'Đã sửa khoản trả hộ.' : 'Đã ghi trả hộ Kho tổng.') : l ? 'Đã sửa khoản cho vay.' : 'Đã ghi khoản cho vay.');
      } catch (e) { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  };
  sec.querySelector('.ln-new').addEventListener('click', () => loanForm(null));
  sec.querySelector('.ln-traho')?.addEventListener('click', () => loanForm(null, 'tra_ho'));
  // bước 70: khách nợ do quản lý ghi (không thuộc ca)
  const debtForm = (x) => {
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">${x ? 'Sửa khách nợ' : 'Ghi khách nợ'} — ${b.code}</h2>
      <div class="st-meta">Khách nợ hiện ở đầu mọi phiếu chốt ca sau để nhân viên nhớ thu (trả một phần được).</div>
      <label class="field"><span>Tên khách</span><input class="input" name="nm" autocomplete="off" value="${x ? x.name : ''}" placeholder="vd: Công ty B, chị Hoa bàn 5"></label>
      <label class="field"><span>Số điện thoại</span><input class="input" name="ph" inputmode="tel" autocomplete="off" value="${x ? x.phone || '' : ''}"></label>
      <label class="field"><span>Ngày nợ</span><input class="input" type="date" name="d" value="${x ? x.date : today()}" ${x ? 'disabled' : ''}></label>
      <label class="field"><span>Số tiền nợ</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${x ? fmt(x.amount) : ''}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" value="${x ? x.note || '' : ''}" placeholder="vd: hẹn trả cuối tuần"></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await rpc('app_cn_debt_save', { p_id: x ? x.id : null, p: { branch_id: b.id, name: f.nm.value, phone: f.ph.value, date: f.d.value, amount: parseMoney(f.amt.value), note: f.note.value } });
        dl.close(); done(x ? 'Đã sửa khách nợ.' : 'Đã ghi khách nợ.'); }
      catch (e) { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  };
  sec.querySelector('.cn-new')?.addEventListener('click', () => debtForm(null));
  const cnOf = (x) => (d.cn?.open || []).find((y) => y.id === Number(x.closest('.cn-row').dataset.id));
  sec.querySelectorAll('.cn-ed').forEach((x) => x.addEventListener('click', () => debtForm(cnOf(x))));
  sec.querySelectorAll('.cn-del').forEach((x) => x.addEventListener('click', async () => {
    const c = cnOf(x); if (!confirm(`Xoá khách nợ "${c.name}" (${vnd(c.amount)})?`)) return;
    try { await rpc('app_cn_debt_delete', { p_id: c.id }); done('Đã xoá khách nợ.'); } catch (e) { showSaved(e.message, true); }
  }));
  sec.querySelectorAll('.ln-ed').forEach((x) => x.addEventListener('click', () => loanForm(d.loans.find((l) => l.id === Number(x.dataset.id)))));
  sec.querySelectorAll('.ln-ped').forEach((x) => x.addEventListener('click', () => {
    const l = d.loans.find((z) => z.id === Number(x.dataset.l)); const y = l.payments.find((z) => z.id === Number(x.dataset.id));
    const left = l.amount - l.paid + y.amount;
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">Sửa lần trả — ${l.person}</h2>
      <div class="st-meta">Khoản vay ${dmy(l.date)} · ${vnd(l.amount)}. Lần trả này tối đa ${vnd(left)}.</div>
      <label class="field"><span>Ngày trả</span><input class="input" type="date" name="d" value="${y.date}"></label>
      <label class="field"><span>Số tiền trả</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${fmt(y.amount)}"></label>
      ${payRadio(y.method)}
      <label class="field"><span>Ghi chú</span><input class="input" name="note" autocomplete="off" value="${y.note || ''}"></label>
      <div class="ln-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    bindMoneyInputs(dl); const f = dl.querySelector('form');
    dl.querySelector('[data-x]').addEventListener('click', () => dl.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await rpc('app_loan_pay_save', { p_id: y.id, p_date: f.d.value, p_amount: parseMoney(f.amt.value), p_method: f.querySelector('[name=pay]:checked').value, p_note: f.note.value });
        dl.close(); done('Đã sửa lần trả.');
      } catch (e) { dl.querySelector('.ln-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); }
    });
  }));
  sec.querySelectorAll('.ln-pay-btn').forEach((btn) => btn.addEventListener('click', () => {
    const p = d.people.find((x) => x.id === Number(btn.dataset.p));
    const open = d.loans.filter((l) => l.person_id === p.id && l.amount - l.paid > 0).sort((x, y) => x.date.localeCompare(y.date));
    const lbl = (l) => `${dmy(l.date)} · ${l.kind === 'tra_ho' ? 'trả hộ' : 'vay'} ${fmt(l.amount)}${l.note ? ` (${l.note})` : ''} · còn ${fmt(l.amount - l.paid)}`;
    const dl = dialog(html`<form class="stack ln-dlg" style="gap:12px"><h2 style="margin:0">Ghi trả nợ — ${p.name}</h2>
      <div class="st-meta">Còn nợ ${vnd(p.owe)}. Tiền về quỹ, không tính doanh thu. Trả dần được.</div>
      <label class="field"><span>Trả cho khoản vay</span><select class="input" name="l">${open.map((l) => html`<option value="${l.id}" data-left="${l.amount - l.paid}">${lbl(l)}</option>`)}</select></label>
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
    const l = d.loans.find((z) => z.id === Number(x.dataset.id));
    if (!confirm(l?.report_id ? 'Xoá khoản cho vay này? Khoản chi ở phiếu ca sẽ trở lại Thu chi (chờ đối soát).' : l?.bank_out ? 'Xoá khoản cho vay này? Khoản chi chuyển khoản sẽ trở lại Thu chi (phiếu chi ở Đối soát ca giữ nguyên).' : 'Xoá khoản cho vay này?')) return;
    try { await rpc('app_loan_delete', { p_id: Number(x.dataset.id) }); done('Đã xoá khoản vay.'); } catch (e) { showSaved(e.message, true); }
  }));
  sec.querySelectorAll('.ln-pdel').forEach((x) => x.addEventListener('click', async () => {
    if (!confirm('Xoá lần trả nợ này?')) return;
    try { await rpc('app_loan_pay_delete', { p_id: Number(x.dataset.id) }); done('Đã xoá lần trả.'); } catch (e) { showSaved(e.message, true); }
  }));
}
