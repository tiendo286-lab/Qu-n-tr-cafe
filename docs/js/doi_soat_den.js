// Bước 43 — Đối soát ca kiểu đèn xanh / đỏ (anh Tiến chốt 12/11/2026): web tự xét từng hạng mục;
// mục xanh bấm "Duyệt các mục xanh" là xong, quản lý chỉ xử lý mục đỏ (làm ở các bước bên dưới).
// Bước 44 (tài liệu 5o): PHẦN TIỀN chờ kế toán đủ file chốt ca Fabi + chuyển khoản ngân hàng; Nhân sự, Bàn giao, Nhập hàng làm ngay.
import { render as rerender } from './app.js';
import { rpc } from './sb.js';
import { fmt, signed } from './tien.js';
import { $, html, showSaved, str } from './ui.js';
import { openBankOut } from './phieu_chi_ck.js';

const MONEY = ['tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no'];
const LBL = { nhan_su: 'Nhân viên trong ca', ban_giao: 'Bàn giao ca sau', thoi_gian: 'Thời gian doanh thu', doanh_thu: 'Doanh thu & số cốc', tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', thu_chi: 'Thu chi', cong_no: 'Công nợ', nhap_hang: 'Nhập hàng' };
const KT_ITEMS = ['thoi_gian', 'doanh_thu', 'tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no'];
const STEP = { nhan_su: 0, ban_giao: 0, thoi_gian: 1, doanh_thu: 1, tien_mat: 1, chuyen_khoan: 1, thu_chi: 1, cong_no: 1, nhap_hang: 2 };

// Xét từng hạng mục: { item, ok (xanh), why (vì sao đỏ), done (đã đối soát) }
export function judge(R0, R, fabi, kt) {
  const m = R0.money || {}; const checks = R.checks || {}; const res = R.results || {};
  const staff = R.staff || []; const moves = (R.moves || []).filter((x) => !x.auto);
  const debtNew = (R0.debts || []).filter((d) => d.kind !== 'muon').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const fx = fabi && ((fabi.diff || []).length || (fabi.fixed || []).length);
  const h = R0.cash_hand;
  const out = [];
  const wait = !!(kt && kt.need && !kt.ready);   // phần tiền chờ kế toán
  const add = (item, ok, why, manual) => { const w = wait && KT_ITEMS.includes(item); out.push({ item, ok: ok && !w, wait: w, why: ok || w ? '' : why, manual: !!manual && !ok && !w, done: !!checks[item] || !!res[item] }); };
  const nsIssue = staff.filter((s) => !s.worked || s.source !== 'lich');
  add('nhan_su', !nsIssue.length, `Có người nghỉ / làm hộ (${nsIssue.map((s) => s.name || s.code).join(', ')}) — quản lý tổng phân loại, Chủ duyệt`);
  add('ban_giao', true, '');
  add('thoi_gian', !!(R.rev_start && R.rev_end && R.rev_end > R.rev_start), 'Giờ doanh thu chưa đúng');
  const sumOk = Number(R.total_revenue) === Number(R.pos_cash) + Number(R.pos_transfer) + debtNew;
  const startBad = h && h.state === 'lech';
  // bước 61: Fabi có hóa đơn sửa / xóa → quản lý xem rồi duyệt
  const sua = (fabi?.sua || []);
  const suaOnly = sumOk && R.cups != null && !startBad && !fx && sua.length > 0;
  add('doanh_thu', sumOk && R.cups != null && !startBad && !fx && !sua.length,
    suaOnly ? `Fabi có ${sua.length} hóa đơn sửa / xóa (${sua.map((x) => fmt(x.amount)).join(', ')}) — xem lại rồi bấm "Đã xem — duyệt"` :
    !sumOk ? 'Doanh thu ≠ tiền mặt + chuyển khoản + nợ' : startBad ? `Tiền đầu ca lệch ${signed(h.gap)} so với ca ${h.prev_shift}${R0.opening_note ? ' · lý do NV: ' + R0.opening_note : ''}` : fx ? 'Số trên phiếu khác file Fabi (đã sửa theo Fabi) — xem lại' : kt && kt.need ? 'Chưa có số cốc — file Fabi còn món chưa chọn nhóm (Kế toán › File ca Fabi › Nhóm món)' : 'Thiếu số cốc');
  if (suaOnly) out[out.length - 1].manual = true;
  add('tien_mat', Number(m.tm_left) === 0, `Tiền mặt còn lệch ${signed(m.tm_left)}${R0.diff_note ? ' · lý do NV: ' + R0.diff_note : ''}`);
  add('chuyen_khoan', Number(m.ck_left) === 0, `Chuyển khoản còn lệch ${signed(m.ck_left)}${R0.transfer_note ? ' · lý do NV: ' + R0.transfer_note : ''}`);
  add('thu_chi', !moves.length, `${moves.length} khoản thu chi — xem từng khoản và chọn nhóm (tiền quản lý rút: chọn "Không tính")`);
  // bước 61: khách trả nợ cũ theo Fabi phải khớp khoản "khách đã trả" chọn trong ca
  const isCk = (x) => /chuy[eể]n/i.test(x.method || '');
  const fTm = (fabi?.tra_no || []).filter((x) => !isCk(x)).reduce((t, x) => t + Number(x.amount || 0), 0);
  const fCk = (fabi?.tra_no || []).filter(isCk).reduce((t, x) => t + Number(x.amount || 0), 0);
  const paid = (R0.open_debts || []).filter((d) => d.kind !== 'muon' && d.closed_report_id === R0.id);
  const cTm = paid.filter((d) => d.collect_kind !== 'chuyen_khoan').reduce((t, d) => t + Number(d.amount || 0), 0);
  const cCk = paid.filter((d) => d.collect_kind === 'chuyen_khoan').reduce((t, d) => t + Number(d.amount || 0), 0);
  const noOk = !fabi || (fTm === cTm && fCk === cCk);
  add('cong_no', noOk, `Fabi ghi khách trả nợ TM ${fmt(fTm)} · CK ${fmt(fCk)}, phiếu ghi TM ${fmt(cTm)} · CK ${fmt(cCk)} — sửa "Khách đã trả" ở mục Công nợ, hoặc xem lại rồi bấm "Đã xem — duyệt"`, true);
  add('nhap_hang', !!checks.nhap_hang, 'Còn hàng nhận chưa đối soát từng ảnh');
  return out;
}

export async function mountLights(box, R0, R) {
  if (!box) return;
  let fabi = null; try { fabi = await rpc('app_fabi_for_report', { p_id: R0.id }); } catch (_) { /* chưa có bước 42 */ }
  let kt = null; try { kt = await rpc('app_ca_kt_state', { p_id: R0.id }); } catch (_) { /* chưa có bước 44 */ }
  let LK = null; try { LK = await rpc('app_ca_auto_locks', { p_id: R0.id }); } catch (_) { /* chưa có bước 51 */ }
  const lk = new Set(LK?.items || []);
  const J = judge(R0, R, fabi, kt);
  const green = J.filter((x) => x.ok && !x.done);
  const red = J.filter((x) => !x.ok && !x.wait && !x.done);
  const waitN = J.filter((x) => x.wait && !x.done).length;
  const locked = R0.recon_status === 'hoan_thanh';
  const fb = !fabi ? html`<span class="pill mute">Chưa có file Fabi</span>`
    : (fabi.diff || []).length || (fabi.fixed || []).length ? html`<span class="pill off">Fabi ✗ đã sửa theo Fabi</span> <span class="st-meta">${[...(fabi.fixed || []).map((x) => `${x.label}: ${fmt(x.before)} → ${fmt(x.fabi)}`), ...(fabi.diff || []).filter((d) => !(fabi.fixed || []).some((x) => x.label === d.label)).map((x) => `${x.label}: NV ${fmt(x.nv)} → Fabi ${fmt(x.fabi)}`)].join(' · ')}</span>`
      : html`<span class="pill ok">Fabi ✓ khớp phiếu</span>`;
  const extra = fabi ? [(fabi.tra_no || []).length ? `khách trả nợ ${fabi.tra_no.map((t) => t.method + ' ' + fmt(t.amount)).join(', ')}` : '', (fabi.sua || []).length ? `⚠️ ${fabi.sua.length} hóa đơn sửa / xóa trên Fabi: ${fabi.sua.map((s) => fmt(s.amount)).join(', ')}` : ''].filter(Boolean) : [];
  box.innerHTML = str(html`<div class="pc-sec-head"><h2>Đèn đối soát</h2><div>${fb}</div></div>
    ${kt && kt.need && !kt.ready && waitN ? html`<div class="alert info"><strong>Phần tiền chờ kế toán</strong> — còn thiếu: ${(kt.missing || []).join(', ')}. Nhân sự, Bàn giao, Nhập hàng đối soát được ngay.</div>`
      : kt && kt.need && kt.ready ? html`<div class="st-meta">✓ Kế toán đã đủ file Fabi và chuyển khoản ngân hàng — phần tiền tính theo số chính thức.</div>` : ''}
    ${extra.length ? html`<div class="alert warn">${extra.join(' · ')}</div>` : ''}
    ${lk.size ? html`<div class="st-meta">🔒 ${lk.size} mục web đã <strong>tự đối soát</strong> (khớp file Fabi và ngân hàng) — đã khoá.${LK.can_unlock ? ' Chủ bấm "Sửa" ở mục đó nếu thật sự cần sửa.' : ' Chỉ Chủ sửa được.'}</div>` : ''}
    <div class="den-list">${J.map((x) => html`<div class="den-row ${lk.has(x.item) ? 'done auto' : x.done ? 'done' : x.wait ? 'w' : x.ok ? 'g' : 'r'}"><i class="den-dot"></i><div class="den-t"><strong>${lk.has(x.item) ? '🔒 ' : ''}${LBL[x.item]}</strong>
        <span class="st-meta">${lk.has(x.item) ? '✓ web tự đối soát — đã khoá' : x.done ? '✓ đã đối soát' : x.wait ? 'chờ kế toán' : x.ok ? 'xanh — chờ duyệt' : x.why}</span></div>
        ${lk.has(x.item) || x.done ? (!lk.has(x.item) || LK?.can_unlock ? html`<button type="button" class="btn sm secondary den-edit" data-item="${x.item}">Sửa</button>` : '')
          : !x.done && !x.ok && !x.wait && !locked ? html`<span class="den-acts">${x.manual ? html`<button type="button" class="btn sm den-man" data-item="${x.item}">Đã xem — duyệt</button>` : ''}${x.item === 'chuyen_khoan' && Number((R0.money || {}).ck_left) < 0 ? html`<button type="button" class="btn sm den-pc">Tạo phiếu chi</button>` : ''}<button type="button" class="btn sm secondary" data-ds-go="${STEP[x.item]}">Xử lý</button></span>` : ''}</div>`)}</div>
    ${locked ? '' : html`<div class="toolbar" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="den-ok" ${green.length ? '' : 'disabled'}>Duyệt các mục xanh${green.length ? ` (${green.length})` : ''}</button>
      <span class="st-meta">${red.length ? `Còn ${red.length} mục đỏ cần xử lý — bấm "Xử lý" để tới đúng chỗ.` : waitN ? `${waitN} mục tiền chờ kế toán.` : green.length ? 'Không còn mục đỏ. Duyệt xong là hoàn thành đối soát.' : ''}</span></div>`}`);
  $('#den-ok', box)?.addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    try {
      for (const x of green) {
        if (MONEY.includes(x.item)) await rpc('app_ca_result_set', { p_id: R0.id, p_item: x.item, p_result: 'khop', p_amount: null, p_reason: 'Duyệt mục xanh', p_people: [] });
        else await rpc('app_ca_check', { p_id: R0.id, p_item: x.item, p_on: true });
      }
      showSaved(`Đã duyệt ${green.length} mục xanh`); rerender();
    } catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
  });
  $('.den-pc', box)?.addEventListener('click', async () => {
    try { const D = await rpc('app_ca_bank_outs', { p_id: R0.id }); if (!D.can) { showSaved('Chỉ Chủ, Quản lý tổng, Kế toán tạo phiếu chi.', true); return; } openBankOut(R0.id, D, () => rerender()); }
    catch (e) { showSaved(e.message, true); }
  });
  // bước 61: mục đỏ cần quản lý xem (hóa đơn sửa / xóa, khách trả nợ lệch Fabi) → "Đã xem — duyệt"
  box.querySelectorAll('.den-man').forEach((b) => b.addEventListener('click', async () => {
    const it = b.dataset.item; b.disabled = true;
    try {
      if (MONEY.includes(it)) await rpc('app_ca_result_set', { p_id: R0.id, p_item: it, p_result: 'khop', p_amount: null, p_reason: 'Quản lý đã xem — duyệt', p_people: [] });
      else await rpc('app_ca_check', { p_id: R0.id, p_item: it, p_on: true });
      showSaved(`Đã duyệt mục ${LBL[it]}`); rerender();
    } catch (e) { showSaved(e.message, true); b.disabled = false; }
  }));
  // bước 56: sửa 1 mục đã đối soát → chỉ mục đó mở lại; duyệt lại là phiếu tự hoàn thành
  box.querySelectorAll('.den-edit').forEach((b) => b.addEventListener('click', async () => {
    const why = prompt(`Sửa mục "${LBL[b.dataset.item]}": chỉ mục này mở lại, các mục khác giữ nguyên. Duyệt lại mục này là phiếu tự hoàn thành.\nLý do sửa:`, '');
    if (why === null) return;
    if (!why.trim()) { showSaved('Ghi lý do sửa.', true); return; }
    b.disabled = true;
    try { await rpc('app_ca_item_reopen', { p_id: R0.id, p_item: b.dataset.item, p_reason: why }); showSaved(`Đã mở mục ${LBL[b.dataset.item]} để sửa.`); rerender(); }
    catch (e) { showSaved(e.message, true); b.disabled = false; }
  }));
}

export const DEN_CSS = html`<style>
  .den-list { display: flex; flex-direction: column; gap: 6px; }
  .den-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; }
  .den-row.done > :not(.den-edit) { opacity: .5; }
  .den-acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .den-row.r { border-color: var(--off-line); } .den-row.g { border-color: var(--ok-line); } .den-row.w { border-style: dashed; opacity: .8; }
  .den-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; background: var(--line-strong); }
  .den-row.g .den-dot, .den-row.done .den-dot { background: var(--ok-line); } .den-row.r .den-dot { background: var(--off-line); }
  .den-t { display: flex; flex-direction: column; min-width: 0; } .den-t .st-meta { overflow-wrap: anywhere; }
</style>`;
