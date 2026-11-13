// Bước 54: phiếu chi chuyển khoản ngay ở trang Đối soát ca — chuyển khoản lệch vì tiền đi ra khỏi tài khoản
// (chi phí của quán → Thu chi; chủ / quản lý rút → Sổ quỹ). Số tiền tự cộng vào "tiền chuyển ra" của tài khoản ở ca đó.
import { rpc } from './sb.js';
import { bindMoneyInputs, fmt, parseMoney, signed, vnd } from './tien.js';
import { dialog, html, showSaved, str } from './ui.js';

const KIND = { chi_phi: 'Chi phí của quán', rut_quy: 'Chủ / quản lý rút tiền' };

// Hộp tạo phiếu chi. D = kết quả app_ca_bank_outs
export function openBankOut(reportId, D, onDone) {
  const gap = Number(D.ck_left);
  const acc = (D.accounts || []).filter((a) => a.entered);
  const d = dialog(html`<form class="stack pcc-dlg" style="gap:12px">
    <h2 style="margin:0">Tạo phiếu chi chuyển khoản</h2>
    ${gap < 0 ? html`<div class="diff-card"><strong>Chuyển khoản của ca đang thiếu ${vnd(-gap)}</strong><div class="st-meta">Tiền đã đi ra khỏi tài khoản thì ghi phiếu chi — số tiền tự cộng vào "tiền chuyển ra" của tài khoản ở ca này, ca hết lệch.</div></div>`
      : html`<div class="st-meta">Chuyển khoản của ca hiện lệch ${signed(gap)}. Phiếu chi làm phần "nhận trong ca" tăng thêm đúng số tiền phiếu.</div>`}
    <div class="pc-line" role="radiogroup" aria-label="Loại phiếu">${Object.entries(KIND).map(([k, l], i) => html`<label class="radio-pill"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}> ${l}</label>`)}</div>
    <div class="st-meta pcc-hint"></div>
    <label class="pc-f"><span>Tài khoản tiền đi ra</span><select class="input" name="acc">${acc.map((a) => html`<option value="${a.id}">${a.label}</option>`)}</select></label>
    ${acc.length ? '' : html`<div class="alert warn">Chưa tài khoản nào có số dư của ca này — kế toán nhập số dư trước.</div>`}
    <label class="pc-f"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off" value="${gap < 0 ? fmt(-gap) : ''}"></label>
    <label class="pc-f pcc-cat"><span>Nhóm chi</span><select class="input" name="cat"><option value="">— Chọn nhóm chi —</option>${(D.categories || []).map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></label>
    <label class="pc-f"><span>Nội dung</span><input class="input" name="note" placeholder="vd: trả tiền đá / anh Tùng rút" autocomplete="off"></label>
    <div class="pcc-err"></div>
    <div class="toolbar" style="justify-content:flex-end;gap:8px"><button type="button" class="btn sm secondary pcc-x">Huỷ</button><button class="btn sm" type="submit" ${acc.length ? '' : 'disabled'}>Lưu phiếu chi</button></div>
  </form>`);
  const f = d.querySelector('form'); bindMoneyInputs(f);
  const sync = () => {
    const k = f.kind.value;
    d.querySelector('.pcc-cat').hidden = k !== 'chi_phi';
    d.querySelector('.pcc-hint').textContent = k === 'chi_phi' ? 'Ghi vào Thu chi của tháng (hình thức chuyển khoản), tính là chi phí của cơ sở.'
      : 'Ghi vào Sổ quỹ là phiếu rút chuyển khoản (không tính chi phí). Phiếu chờ Chủ bấm "Đã nhận tiền" như phiếu rút thường.';
  };
  f.addEventListener('change', sync); sync();
  d.querySelector('.pcc-x').addEventListener('click', () => d.close());
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await rpc('app_ca_bank_out_save', { p_id: reportId, p: { kind: f.kind.value, account_id: Number(f.acc.value), amount: parseMoney(f.amt.value), category_id: f.kind.value === 'chi_phi' ? Number(f.cat.value) || null : null, note: f.note.value } });
      d.close(); showSaved('Đã lưu phiếu chi — chuyển khoản của ca đã tính lại.'); onDone?.();
    } catch (e) { d.querySelector('.pcc-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); btn.disabled = false; }
  });
}

// Danh sách phiếu chi của ca + nút tạo (đặt trong khung Chuyển khoản thực nhận)
export async function mountBankOuts(box, reportId, onChange) {
  if (!box) return;
  let D; try { D = await rpc('app_ca_bank_outs', { p_id: reportId }); } catch (_) { return; }
  const gap = Number(D.ck_left);
  box.innerHTML = str(html`<div class="pc-sub" style="margin:0">PHIẾU CHI CHUYỂN KHOẢN CỦA CA</div>
    ${(D.rows || []).length ? html`<div class="stack" style="gap:6px">${D.rows.map((o) => html`<div class="pc-line pcc-row"><div class="grow"><strong>${vnd(o.amount)}</strong> · ${KIND[o.kind]}${o.category ? ' · ' + o.category : ''} · ${o.note}${o.loan_person ? html` · <b>đã đổi thành cho vay – ${o.loan_person}</b>` : ''}
        <div class="st-meta">${o.account} · ${o.by || ''} ${o.at || ''}${o.kind === 'rut_quy' ? (o.fund_status === 'da_nhan' ? ' · Chủ đã nhận' : ' · chờ Chủ xác nhận ở Sổ quỹ') : ''}</div></div>
        ${D.can && !D.locked && o.fund_status !== 'da_nhan' ? html`<button type="button" class="btn sm secondary pcc-del" data-id="${o.id}">Xoá</button>` : ''}</div>`)}</div>` : html`<div class="st-meta">Chưa có phiếu chi.</div>`}
    ${D.can && !D.locked ? html`<div class="pc-line"><button type="button" class="btn sm ${gap < 0 ? '' : 'secondary'} pcc-add">+ Tạo phiếu chi chuyển khoản</button>
      ${gap < 0 ? html`<span class="st-meta">Chuyển khoản thiếu ${vnd(-gap)} — tiền đã chuyển đi thì ghi phiếu chi.</span>` : ''}</div>` : ''}`);
  box.querySelector('.pcc-add')?.addEventListener('click', () => openBankOut(reportId, D, onChange));
  box.querySelectorAll('.pcc-del').forEach((b) => b.addEventListener('click', async () => {
    const o = D.rows.find((x) => x.id === Number(b.dataset.id));
    if (!confirm(o?.loan_person ? 'Xoá phiếu chi này? Khoản cho vay đổi từ phiếu chi cũng bị xoá, tiền chuyển ra của tài khoản trừ lại.' : 'Xoá phiếu chi này? Khoản ở Thu chi / Sổ quỹ cũng bị xoá, tiền chuyển ra của tài khoản trừ lại.')) return;
    b.disabled = true;
    try { await rpc('app_ca_bank_out_delete', { p_out: Number(b.dataset.id) }); showSaved('Đã xoá phiếu chi.'); onChange?.(); }
    catch (e) { showSaved(e.message, true); b.disabled = false; }
  }));
}
