// Chốt tháng › Sổ quỹ: quỹ TIỀN MẶT (ngoài két) + TÀI KHOẢN của từng cơ sở
//  * Vào: nộp quỹ cuối ngày (tự động = đếm cuối ngày − 1.000.000đ, sửa được), chuyển khoản thực nhận, NV bù khoản âm, khoản thu quản lý tạo
//  * Ra: khoản chi quản lý tạo, phiếu rút (Chủ bấm "Đã nhận tiền" → khóa)
//  * Kiểm quỹ (so số thực tế với sổ), nhắc rút bớt khi quỹ tiền mặt vượt mức
//  * Bước 72: mỗi lần 1 cơ sở (bỏ "Tất cả"); 5 ô số; 2 cột (sổ chi tiết theo ngày | nộp quỹ, phiếu rút, luân chuyển, kiểm quỹ);
//    nộp quỹ cuối ngày tự động = đếm két ca cuối − 1.000.000; luân chuyển quỹ TM ↔ TK; kiểm quỹ lệch → Điều chỉnh; nhắc kiểm quỹ quá 7 ngày.
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, signed, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';

export const perm = 'chot_thang';
const M = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Tài khoản' };
const KIND = { giua_thang: 'Rút giữ hộ', cuoi_thang: 'Rút cuối tháng' };
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };
let LEDGER = 'tien_mat';
const LS_BR = 'tcBranch';
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };

export async function render({ params }) {
  const cur = vnToday().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : cur;
  const O = await rpc('app_fund_overview', { p_month: month });
  if (!O.branches.length) return { title: 'Sổ quỹ', html: html`${STYLE}<div class="page-head"><div><h1>Sổ quỹ</h1></div></div><div class="card">Bạn chưa được giao cơ sở nào.</div>` };
  // bước 72: mỗi lần 1 cơ sở (bỏ "Tất cả") — địa chỉ, rồi cơ sở xem lần trước (chung với Thu chi), rồi cơ sở đầu
  const has = (v) => O.branches.some((b) => String(b.id) === String(v));
  const cn = params.cn === 'ngoai' && O.owner ? 'ngoai' : has(params.cn) ? Number(params.cn) : has(lsGet()) ? Number(lsGet()) : O.branches[0].id;
  if (cn !== 'ngoai') lsSet(cn);
  const q = (o) => '#/quan-ly/so-quy?' + Object.entries({ thang: month, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const bar = html`<section class="card sq-bar">
      <div class="sq-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a>
        <strong>${monthLabel(month)}</strong>${month === cur ? html`<span class="pill info">Tháng này</span>` : ''}
        <a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
      <nav class="branch-tabs" aria-label="Cơ sở">${O.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}
        ${O.owner ? html`<a class="sq-ext-tab ${cn === 'ngoai' ? 'on' : ''}" href="${q({ cn: 'ngoai' })}" title="Quỹ ngoài của Chủ">Quỹ ngoài</a>` : ''}</nav></section>`;
  const head = html`<div class="page-head"><div><h1>Sổ quỹ</h1>
      <div class="sub">Quỹ tiền mặt (ngoài két — 1.000.000đ gối đầu để nguyên trong két) và tài khoản của từng cơ sở. Cuối tháng rút hết về 0.</div></div>
      <div id="saved-indicator" class="saved" role="status" hidden></div></div>${bar}`;

  if (month < O.start.slice(0, 7)) return { title: 'Sổ quỹ', html: html`${STYLE}${head}<div class="card">Sổ quỹ bắt đầu từ ${dmy(O.start)}.</div>` };
  if (cn === 'ngoai') return renderExt(month, head);

  const D = await rpc('app_fund_branch', { p_branch: cn, p_month: month });
  const B = D.balance; const out = (m) => D.withdrawals.filter((w) => w.method === m && w.wdate >= D.from && w.wdate <= D.to).reduce((s, w) => s + Number(w.amount), 0);
  const pend = D.withdrawals.filter((w) => w.status === 'cho_nhan');
  const editable = !D.locked;
  const ba = D.bank_actual || {};
  const lastC = [D.last_count?.tien_mat, D.last_count?.chuyen_khoan].filter(Boolean).sort().pop() || null;
  const ago = lastC ? Math.round((Date.parse(vnToday()) - Date.parse(lastC)) / 864e5) : null;
  const countLate = month === cur && (ago === null || ago > 7);

  const dayHas = (d) => d.reports > 0 || d.cash_set != null || d.bank_set != null || d.cash_auto != null || d.bank_auto != null;
  const dayCell = (d, m) => {
    const set = m === 'tien_mat' ? d.cash_set : d.bank_set; const auto = m === 'tien_mat' ? d.cash_auto : d.bank_auto;
    const v = set ?? auto; const note = m === 'tien_mat' ? d.cash_note : d.bank_note;
    return html`<div class="sq-dc"><b>${v == null ? '—' : vnd(v)}</b>
      <span class="st-meta">${set != null ? 'QL sửa' + (note ? ` · ${note}` : '') : auto != null ? (m === 'tien_mat' ? `tự động (${d.counted_src || 'đếm'} ${fmt(d.counted)} − ${fmt(D.float)})` : 'tự động (kế toán)') : 'chưa có số'}</span>
      ${editable ? html`<button type="button" class="link-btn sq-day" data-d="${d.date}" data-m="${m}">${v == null ? 'Nhập' : 'Sửa'}</button>` : ''}</div>`;
  };
  const wRow = (w) => html`<div class="sq-it ${w.status === 'cho_nhan' ? 'todo' : ''}">
      <div class="grow"><strong>${KIND[w.kind]} · ${M[w.method]}</strong>${w.note ? html` — ${w.note}` : ''}
        <div class="st-meta">${dmy(w.wdate)} · ${w.by || ''} ${w.status === 'da_nhan' ? html`<span class="pill ok">Đã nhận · khoá</span>` : html`<span class="pill warn">Chờ Chủ nhận</span>`}</div></div>
      <div class="sq-amt">−${fmt(w.amount)}</div>
      <div class="sq-acts">${w.status === 'cho_nhan' && D.owner ? html`<button type="button" class="btn sm sq-ok" data-id="${w.id}">Đã nhận tiền</button>` : ''}
        ${!w.locked ? html`<button type="button" class="btn sm secondary sq-wed" data-id="${w.id}">Sửa</button><button type="button" class="btn sm secondary danger sq-wdel" data-id="${w.id}" aria-label="Xóa">×</button>` : ''}</div></div>`;
  const tRow = (t) => html`<div class="sq-it">
      <div class="grow"><strong>${t.direction === 'tm_tk' ? 'Tiền mặt → Tài khoản' : 'Tài khoản → Tiền mặt'}</strong>${t.note ? ` — ${t.note}` : ''}<div class="st-meta">${dmy(t.tdate)} · ${t.by || ''}</div></div>
      <div class="sq-amt mv">${fmt(t.amount)}</div>
      ${!t.locked && D.can_move ? html`<div class="sq-acts"><button type="button" class="btn sm secondary sq-ted" data-id="${t.id}">Sửa</button><button type="button" class="btn sm secondary danger sq-tdel" data-id="${t.id}" aria-label="Xóa">×</button></div>` : ''}</div>`;
  const cRow = (c) => html`<div class="sq-it">
      <div class="grow"><strong>${M[c.method]} · ${dmy(c.count_date)}</strong> <span>${c.counted === c.book ? html`<span class="pill ok">KHỚP</span>` : c.counted < c.book ? html`<span class="pill off">THIẾU ${fmt(c.book - c.counted)}</span>` : html`<span class="pill warn">THỪA ${fmt(c.counted - c.book)}</span>`}</span>
        <div class="st-meta">thực tế ${vnd(c.counted)} · sổ ${vnd(c.book)} · ${c.by || ''}${c.note ? ` · ${c.note}` : ''}</div>
        ${c.adj ? html`<div class="st-meta sq-adj">✓ Đã điều chỉnh: khoản ${c.adj.kind} ${vnd(c.adj.amount)} (${c.adj.category || ''}) ở Thu chi</div>` : ''}</div>
      ${c.counted !== c.book && !c.adj && editable && D.can_move ? html`<div class="sq-acts"><button type="button" class="btn sm sq-adjb" data-id="${c.id}">Điều chỉnh…</button></div>` : ''}</div>`;

  // sổ chi tiết theo ngày (mới nhất trên cùng), mỗi dòng ghi số còn sau khoản đó
  const TAG = { nop_quy: 'tự động', ck_ve: 'tự động', luan_chuyen: 'luân chuyển' };
  const ledger = (m) => {
    let bal = Number(D.open[m] || 0);
    const rows = D.rows.filter((r) => r.method === m).map((r) => { bal += Number(r.amount); return { ...r, bal }; });
    const days = []; [...rows].reverse().forEach((r) => { let d = days[days.length - 1]; if (!d || d.date !== r.date) days.push(d = { date: r.date, items: [] }); d.items.push(r); });
    return html`${days.map((d) => html`<div class="sq-lday"><div class="sq-dh">${dmy(d.date)}</div>${d.items.map((r) => html`<div class="sq-led ${r.type === 'luan_chuyen' ? 'mv' : ''}">
        <span class="grow"><b>${r.label}</b>${r.auto && TAG[r.type] ? html`<span class="sq-tag">${TAG[r.type]}</span>` : r.type === 'nop_quy' && !r.auto ? html`<span class="sq-tag ql">QL sửa</span>` : r.type === 'luan_chuyen' ? html`<span class="sq-tag mv">luân chuyển</span>` : ''}${r.ref?.note ? html` <span class="st-meta">· ${r.ref.note}</span>` : ''}</span>
        <span class="sq-a ${r.type === 'luan_chuyen' ? 'mv' : r.amount < 0 ? 'neg' : 'pos'}">${r.amount < 0 ? '−' : '+'}${fmt(Math.abs(r.amount))}</span>
        <span class="sq-bal">còn ${fmt(r.bal)}</span></div>`)}</div>`)}
      <div class="sq-lday"><div class="sq-dh">Đầu tháng</div><div class="sq-led"><span class="grow"><b>Số dư đầu tháng</b></span><span class="sq-a">${fmt(D.open[m] || 0)}</span><span class="sq-bal"></span></div></div>`;
  };

  return {
    title: `Sổ quỹ ${D.code}`,
    html: html`${STYLE}${head}
      ${D.locked ? html`<div class="alert ok">Tháng này đã chốt — sổ quỹ chỉ xem.</div>` : ''}
      ${B.tien_mat > D.alert ? html`<div class="alert error">Quỹ tiền mặt ${D.code} đang giữ <strong>${vnd(B.tien_mat)}</strong>, vượt ${vnd(D.alert)}. Nên rút bớt (tạo phiếu rút).</div>` : ''}
      ${countLate ? html`<div class="alert warn">${ago === null ? 'Chưa kiểm quỹ lần nào.' : html`Đã <strong>${ago} ngày</strong> chưa kiểm quỹ (lần cuối ${dmy(lastC)}).`} Mỗi tuần kiểm 1 lần — quản lý tự chọn ngày.</div>` : ''}
      <div class="sq-kpis k5">
        <div class="sq-k ${B.tien_mat > D.alert ? 'neg' : ''}"><span>Quỹ tiền mặt</span><b>${vnd(B.tien_mat)}</b><small>đến ${dmy(D.upto)}${B.tien_mat > D.alert ? ' · nên rút' : ''}</small></div>
        <div class="sq-k"><span>Tài khoản (sổ)</span><b>${vnd(B.chuyen_khoan)}</b><small>${ba.amount != null ? html`kế toán nhập ${vnd(ba.amount)} (${dmy(ba.at)})${Number(ba.amount) !== Number(B.chuyen_khoan) ? html` · <span class="sq-out">lệch ${signed(Number(ba.amount) - Number(B.chuyen_khoan))}</span>` : ' · khớp'}` : 'kế toán chưa nhập số dư'}</small></div>
        <div class="sq-k pos"><span>Đã rút tháng này</span><b>${vnd(out('tien_mat') + out('chuyen_khoan'))}</b><small>TM ${vnd(out('tien_mat'))} · CK ${vnd(out('chuyen_khoan'))}</small></div>
        <div class="sq-k ${pend.length ? 'warn' : ''}"><span>Phiếu chờ Chủ nhận</span><b>${pend.length}</b><small>${pend.length ? vnd(pend.reduce((s, w) => s + Number(w.amount), 0)) : 'Không có'}</small></div>
        <div class="sq-k ${countLate ? 'warn' : ''}"><span>Kiểm quỹ lần cuối</span><b>${ago === null ? 'Chưa có' : ago === 0 ? 'Hôm nay' : `${ago} ngày trước`}</b><small>${lastC ? dmy(lastC) : 'mỗi tuần 1 lần'}</small></div></div>
      ${editable ? html`<div class="toolbar sq-tb"><button type="button" class="btn" id="sq-new">+ Phiếu rút</button>${D.can_move ? html`<button type="button" class="btn secondary" id="sq-move">+ Luân chuyển quỹ</button>` : ''}<button type="button" class="btn secondary" id="sq-count">Kiểm quỹ</button>
        ${D.is_start_month ? html`<button type="button" class="btn secondary" id="sq-open">Số dư đầu ${dmy(D.start).slice(0, 5)}</button>` : ''}</div>` : ''}
      <div class="sq-cols">
        <section class="card stack sq-sec"><div class="sq-subhead"><h2>Sổ chi tiết</h2>
            <nav class="branch-tabs" aria-label="Quỹ">${Object.entries(M).map(([k, l]) => html`<a href="javascript:void 0" class="sq-lt ${LEDGER === k ? 'on' : ''}" data-m="${k}">${l}</a>`)}</nav></div>
          <div class="st-meta">Mới nhất trên cùng · mỗi dòng ghi số còn lại sau khoản đó.</div>
          <div id="sq-led">${ledger(LEDGER)}</div></section>
        <div class="sq-side">
          <section class="card stack sq-sec"><h2>Nộp quỹ cuối ngày <small>tự tính, QL sửa khi khác</small></h2>
            <div class="st-meta">Tiền mặt = số đếm két ca cuối (hoặc quản lý đếm cuối ngày) − ${vnd(D.float)} gối đầu. Chuyển khoản về lấy từ số dư kế toán nhập.</div>
            ${D.days.length ? [...D.days].reverse().filter(dayHas).map((d) => html`<div class="sq-dayv"><div class="sq-dvh"><b>${dmy(d.date).slice(0, 5)}</b><span class="st-meta">${d.reports} phiếu ca xong</span></div>
                <div class="sq-dvg"><span class="st-meta">TM</span>${dayCell(d, 'tien_mat')}<span class="st-meta">CK</span>${dayCell(d, 'chuyen_khoan')}</div></div>`)
              : html`<div class="st-meta">Chưa tới ngày nào.</div>`}
            ${D.days.some((d) => !dayHas(d)) ? html`<details class="sq-more"><summary>${D.days.filter((d) => !dayHas(d)).length} ngày chưa có phiếu ca / chưa có số — bấm để nhập</summary>
              ${[...D.days].reverse().filter((d) => !dayHas(d)).map((d) => html`<div class="sq-dayv"><div class="sq-dvh"><b>${dmy(d.date).slice(0, 5)}</b></div>
                <div class="sq-dvg"><span class="st-meta">TM</span>${dayCell(d, 'tien_mat')}<span class="st-meta">CK</span>${dayCell(d, 'chuyen_khoan')}</div></div>`)}</details>` : ''}</section>
          <section class="card stack sq-sec"><h2>Phiếu rút <small>Chủ xác nhận</small></h2>
            ${D.withdrawals.length ? D.withdrawals.map(wRow) : html`<div class="st-meta">Tháng này chưa có phiếu rút.</div>`}</section>
          <section class="card stack sq-sec"><h2>Luân chuyển quỹ <small>không tính thu / chi</small></h2>
            ${(D.transfers || []).length ? D.transfers.map(tRow) : html`<div class="st-meta">Chưa có. Nộp tiền mặt vào tài khoản hoặc rút tài khoản ra tiền mặt thì ghi ở đây.</div>`}</section>
          <section class="card stack sq-sec"><h2>Kiểm quỹ <small>mỗi tuần 1 lần</small></h2>
            ${D.counts.length ? D.counts.map(cRow) : html`<div class="st-meta">Tháng này chưa kiểm quỹ lần nào.</div>`}</section>
        </div>
      </div>`,

    mount() {
      $$('.sq-lt').forEach((a) => a.addEventListener('click', () => { LEDGER = a.dataset.m; $$('.sq-lt').forEach((x) => x.classList.toggle('on', x === a)); $('#sq-led').innerHTML = str(ledger(LEDGER)); }));
      const errBox = (d, e) => { d.querySelector('.sq-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); };
      const today = vnToday() < D.upto ? vnToday() : D.upto;

      $$('.sq-day').forEach((b) => b.addEventListener('click', () => {
        const day = D.days.find((x) => x.date === b.dataset.d); const m = b.dataset.m; const tm = m === 'tien_mat';
        const set = tm ? day.cash_set : day.bank_set; const auto = tm ? day.cash_auto : day.bank_auto;
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">${tm ? 'Nộp quỹ tiền mặt' : 'Chuyển khoản về'} · ${dmy(day.date)}</h2>
          <div class="st-meta">${auto != null ? html`Số tự động: <strong>${vnd(auto)}</strong> ${tm ? `(đếm ${vnd(day.counted)} − ${vnd(D.float)})` : '(kế toán nhập)'}` : 'Ngày này chưa có số tự động — nhập số thực tế.'}</div>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${set != null ? fmt(set) : auto != null ? fmt(auto) : ''}" autocomplete="off"></label>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${(tm ? day.cash_note : day.bank_note) || ''}" placeholder="vd: nhập bổ sung theo sổ tay" autocomplete="off"></label>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end">${set != null && auto != null ? html`<button type="button" class="btn sm secondary" data-auto>Dùng số tự động</button>` : ''}
            <button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d);
        const save = async (amt, note) => {
          try { await rpc('app_fund_day_set', { p_branch: cn, p_date: day.date, p_method: m, p_amount: amt, p_note: note }); d.close(); showSaved('Đã lưu'); rerender(); } catch (e) { errBox(d, e); }
        };
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        d.querySelector('[data-auto]')?.addEventListener('click', () => save(null, null));
        d.querySelector('form').addEventListener('submit', (ev) => { ev.preventDefault(); const f = ev.target; const v = parseMoney(f.amt.value); if (v == null) { errBox(d, new Error('Nhập số tiền (0 nếu không có).')); return; } save(v, f.note.value); });
      }));

      const wForm = (w = {}) => {
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">${w.id ? 'Sửa phiếu rút' : 'Phiếu rút tiền'} · ${D.code}</h2>
          <div class="pc-line" role="radiogroup" aria-label="Rút từ"><label class="radio-pill"><input type="radio" name="m" value="tien_mat" ${(w.method || 'tien_mat') === 'tien_mat' ? 'checked' : ''}> Tiền mặt</label><label class="radio-pill"><input type="radio" name="m" value="chuyen_khoan" ${w.method === 'chuyen_khoan' ? 'checked' : ''}> Chuyển khoản</label></div>
          <div class="pc-line" role="radiogroup" aria-label="Loại"><label class="radio-pill"><input type="radio" name="k" value="giua_thang" ${(w.kind || 'giua_thang') === 'giua_thang' ? 'checked' : ''}> Rút giữ hộ</label><label class="radio-pill"><input type="radio" name="k" value="cuoi_thang" ${w.kind === 'cuoi_thang' ? 'checked' : ''}> Rút cuối tháng (rút hết)</label></div>
          <label class="field"><span>Ngày rút</span><input class="input" type="date" name="d" value="${w.wdate || today}" min="${D.start}" max="${vnToday()}"></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${w.amount ? fmt(w.amount) : ''}" autocomplete="off"></label>
          <div class="st-meta" id="sq-bal"></div>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${w.note || ''}" placeholder="vd: QL Hà giao anh Tiến tại quán" autocomplete="off"></label>
          <div class="st-meta">${D.owner ? 'Anh nhận đủ tiền thì bấm "Đã nhận tiền" ở danh sách — phiếu sẽ bị khóa.' : 'Chủ sẽ được báo để xác nhận đã nhận tiền. Chủ xác nhận rồi thì phiếu bị khóa, không sửa được.'}</div>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu phiếu</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        const val = (n) => f.querySelector(`input[name=${n}]:checked`).value;
        const showBal = async (fill) => {
          try {
            const bal = await rpc('app_fund_balance', { p_branch: cn, p_method: val('m'), p_date: f.d.value });
            const own = w.id && w.method === val('m') && w.wdate <= f.d.value ? Number(w.amount) : 0; const avail = Number(bal) + own;
            $('#sq-bal', d).textContent = `Số dư ${M[val('m')].toLowerCase()} đến hết ${dmy(f.d.value)}: ${vnd(avail)}`;
            if (fill && val('k') === 'cuoi_thang') f.amt.value = avail > 0 ? fmt(avail) : '';
          } catch (_) { /* bỏ qua */ }
        };
        f.addEventListener('change', (ev) => { if (['m', 'k', 'd'].includes(ev.target.name)) showBal(true); });
        showBal(false);
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const p = { branch_id: cn, method: val('m'), kind: val('k'), wdate: f.d.value, amount: parseMoney(f.amt.value), note: f.note.value };
          try { await rpc('app_fund_withdraw_save', { p_id: w.id || null, p }); d.close(); flash(w.id ? 'Đã sửa phiếu rút.' : D.owner ? 'Đã tạo phiếu rút.' : 'Đã tạo phiếu rút, đã báo Chủ xác nhận.'); rerender(); } catch (e) { errBox(d, e); }
        });
      };
      $('#sq-new')?.addEventListener('click', () => wForm());
      $$('.sq-wed').forEach((b) => b.addEventListener('click', () => wForm(D.withdrawals.find((w) => w.id === Number(b.dataset.id)))));
      $$('.sq-wdel').forEach((b) => b.addEventListener('click', async () => {
        const w = D.withdrawals.find((x) => x.id === Number(b.dataset.id));
        if (!confirm(`Xóa phiếu rút ${vnd(w.amount)} ngày ${dmy(w.wdate)}?`)) return;
        try { await rpc('app_fund_withdraw_delete', { p_id: w.id }); flash('Đã xóa phiếu rút.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.sq-ok').forEach((b) => b.addEventListener('click', async () => {
        const w = D.withdrawals.find((x) => x.id === Number(b.dataset.id));
        if (!confirm(`Xác nhận anh ĐÃ NHẬN ĐỦ ${vnd(w.amount)} (${M[w.method].toLowerCase()}, ngày ${dmy(w.wdate)})?\n\nXác nhận xong phiếu bị khóa, không ai sửa hay xóa được nữa.`)) return;
        try { await rpc('app_fund_withdraw_confirm', { p_id: w.id }); flash('Đã xác nhận nhận tiền. Phiếu đã khóa.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));

      $('#sq-count')?.addEventListener('click', () => {
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">Kiểm quỹ · ${D.code}</h2>
          <div class="pc-line" role="radiogroup" aria-label="Quỹ"><label class="radio-pill"><input type="radio" name="m" value="tien_mat" checked> Tiền mặt (đếm)</label><label class="radio-pill"><input type="radio" name="m" value="chuyen_khoan"> Tài khoản (số dư app ngân hàng)</label></div>
          <label class="field"><span>Ngày kiểm</span><input class="input" type="date" name="d" value="${today}" min="${D.start}" max="${vnToday()}"></label>
          <label class="field"><span>Số tiền thực tế</span><input class="input money" name="amt" inputmode="numeric" autocomplete="off"></label>
          <div class="st-meta" id="sq-cmp"></div>
          <label class="field"><span>Lý do (bắt buộc khi lệch)</span><input class="input" name="note" autocomplete="off"></label>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form'); let book = null;
        const val = () => f.querySelector('input[name=m]:checked').value;
        const cmp = () => { const v = parseMoney(f.amt.value); $('#sq-cmp', d).textContent = book == null ? '' : `Sổ: ${vnd(book)}${v == null ? '' : v === book ? ' · KHỚP' : v < book ? ` · THIẾU ${fmt(book - v)}đ` : ` · THỪA ${fmt(v - book)}đ`}`; };
        const load = async () => { try { book = Number(await rpc('app_fund_balance', { p_branch: cn, p_method: val(), p_date: f.d.value })); } catch (_) { book = null; } cmp(); };
        f.addEventListener('change', (ev) => { if (['m', 'd'].includes(ev.target.name)) load(); });
        f.amt.addEventListener('input', cmp); load();
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try { const r = await rpc('app_fund_count_save', { p_branch: cn, p_method: val(), p_date: f.d.value, p_counted: parseMoney(f.amt.value), p_note: f.note.value }); d.close(); flash(r.diff ? `Đã lưu kiểm quỹ — lệch ${signed(r.diff)}.` : 'Đã lưu kiểm quỹ — KHỚP.', r.diff ? 'warn' : 'ok'); rerender(); }
          catch (e) { errBox(d, e); }
        });
      });

      $('#sq-open')?.addEventListener('click', () => {
        const o = D.openings || {};
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">Số dư đầu ngày ${dmy(D.start)} · ${D.code}</h2>
          <div class="st-meta">Tiền còn trong quỹ (ngoài 1.000.000đ trong két) và trong tài khoản lúc bắt đầu dùng sổ. Không còn thì để 0.</div>
          <label class="field"><span>Quỹ tiền mặt</span><input class="input money" name="tm" inputmode="numeric" value="${fmt(o.tien_mat?.amount || 0)}" autocomplete="off"></label>
          <label class="field"><span>Tài khoản</span><input class="input money" name="ck" inputmode="numeric" value="${fmt(o.chuyen_khoan?.amount || 0)}" autocomplete="off"></label>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${o.tien_mat?.note || ''}" autocomplete="off"></label>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            await rpc('app_fund_opening_set', { p_branch: cn, p_method: 'tien_mat', p_amount: parseMoney(f.tm.value) ?? 0, p_note: f.note.value });
            await rpc('app_fund_opening_set', { p_branch: cn, p_method: 'chuyen_khoan', p_amount: parseMoney(f.ck.value) ?? 0, p_note: f.note.value });
            d.close(); flash('Đã lưu số dư đầu.'); rerender();
          } catch (e) { errBox(d, e); }
        });
      });

      // bước 72: luân chuyển quỹ tiền mặt ↔ tài khoản (lưu là xong)
      const tForm = (t = {}) => {
        const dir0 = t.direction || 'tm_tk';
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">${t.id ? 'Sửa luân chuyển quỹ' : 'Luân chuyển quỹ'} · ${D.code}</h2>
          <div class="pc-line" role="radiogroup" aria-label="Chiều"><label class="radio-pill"><input type="radio" name="dir" value="tm_tk" ${dir0 === 'tm_tk' ? 'checked' : ''}> Tiền mặt → Tài khoản</label><label class="radio-pill"><input type="radio" name="dir" value="tk_tm" ${dir0 === 'tk_tm' ? 'checked' : ''}> Tài khoản → Tiền mặt</label></div>
          <label class="field"><span>Ngày</span><input class="input" type="date" name="d" value="${t.tdate || today}" min="${D.start}" max="${vnToday()}"></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${t.amount ? fmt(t.amount) : ''}" autocomplete="off"></label>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${t.note || ''}" placeholder="vd: gửi ngân hàng / rút ra trả lương" autocomplete="off"></label>
          <div class="st-meta">Quỹ này giảm, quỹ kia tăng cùng số. Không vào Thu chi, không tính lãi lỗ.</div>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try { await rpc('app_fund_transfer_save', { p_id: t.id || null, p: { branch_id: cn, date: f.d.value, direction: f.querySelector('[name=dir]:checked').value, amount: parseMoney(f.amt.value), note: f.note.value } });
            d.close(); flash(t.id ? 'Đã sửa phiếu luân chuyển.' : 'Đã ghi luân chuyển quỹ.'); rerender(); }
          catch (e) { errBox(d, e); }
        });
      };
      $('#sq-move')?.addEventListener('click', () => tForm());
      $$('.sq-ted').forEach((b) => b.addEventListener('click', () => tForm(D.transfers.find((x) => x.id === Number(b.dataset.id)))));
      $$('.sq-tdel').forEach((b) => b.addEventListener('click', async () => {
        const t = D.transfers.find((x) => x.id === Number(b.dataset.id));
        if (!confirm(`Xóa phiếu luân chuyển ${vnd(t.amount)} ngày ${dmy(t.tdate)}?`)) return;
        try { await rpc('app_fund_transfer_delete', { p_id: t.id }); flash('Đã xóa phiếu luân chuyển.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      // bước 72: kiểm quỹ lệch → điều chỉnh (khoản chi / thu ở Thu chi, nhóm bắt buộc)
      $$('.sq-adjb').forEach((b) => b.addEventListener('click', async () => {
        const c = D.counts.find((x) => x.id === Number(b.dataset.id)); const k = c.counted < c.book ? 'chi' : 'thu'; const diff = Math.abs(c.book - c.counted);
        let FT = { types: [], cats: [] }; try { FT = await rpc('app_fin_types'); } catch (_) { /* bỏ qua */ }
        const cats = (FT.cats || []).filter((x) => x.kind === k && x.active);
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">Điều chỉnh lệch quỹ · ${M[c.method]}</h2>
          <div class="st-meta">Kiểm ${dmy(c.count_date)}: thực tế ${vnd(c.counted)}, sổ ${vnd(c.book)} → ${k === 'chi' ? 'thiếu' : 'thừa'} <b>${vnd(diff)}</b>. Web tạo một khoản <b>${k}</b> ${vnd(diff)} ở Thu chi (ngày kiểm) để sổ khớp tiền thật.</div>
          <label class="field"><span>Nhóm (bắt buộc)</span><select class="input" name="cat"><option value="">— Chọn nhóm —</option>${cats.map((x) => html`<option value="${x.id}">${x.name}</option>`)}</select></label>
          <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${c.note || ''}" placeholder="vd: phí ngân hàng" autocomplete="off"></label>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Tạo khoản điều chỉnh</button></div></form>`);
        const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault(); if (!f.cat.value) { errBox(d, new Error('Chọn nhóm cho khoản điều chỉnh.')); return; }
          try { await rpc('app_fund_count_adjust', { p_count: c.id, p_category: Number(f.cat.value), p_note: f.note.value }); d.close(); flash('Đã tạo khoản điều chỉnh — sổ đã khớp tiền thật.'); rerender(); }
          catch (e) { errBox(d, e); }
        });
      }));
    },
  };
}

// ---------------------------------------------------------------- Quỹ ngoài (chỉ Chủ)
const MODE = { doanh_thu: 'Theo tỉ lệ doanh thu', deu: 'Chia đều', mot: 'Cho 1 cơ sở', tu_nhap: 'Tự nhập số' };
const MODE_ALL = { ...MODE, kho_tong: 'Thanh toán kho tổng (không chia — đã tính theo từng hóa đơn)' };
async function renderExt(month, head) {
  const [E, K] = await Promise.all([rpc('app_ext_month', { p_month: month }), rpc('app_ext_kho', { p_month: month }).catch(() => null)]);
  const cats = (k) => E.categories.filter((c) => c.kind === k && c.active);
  const sumK = (k) => E.entries.filter((e) => e.kind === k).reduce((s, e) => s + Number(e.amount), 0);
  const recv = E.rows.filter((r) => r.type === 'nhan').reduce((s, r) => s + Number(r.amount), 0);
  const bad = E.entries.filter((e) => !e.ok);
  const ledger = (m) => {
    let bal = Number(E.open[m] || 0);
    const rows = E.rows.filter((r) => r.method === m).map((r) => { bal += Number(r.amount); return { ...r, bal }; });
    return html`<div class="table-wrap"><table class="table rt sq-led"><thead><tr><th>Ngày</th><th>Nội dung</th><th class="r">Vào</th><th class="r">Ra</th><th class="r">Còn</th></tr></thead>
      <tbody><tr class="sq-total"><td data-label="Ngày">${dmy(E.from)}</td><td data-label="Nội dung">Số dư đầu tháng</td><td></td><td></td><td class="r" data-label="Còn">${vnd(E.open[m])}</td></tr>
      ${rows.map((r) => html`<tr><td data-label="Ngày">${dmy(r.date)}</td><td data-label="Nội dung">${r.label}</td>
        <td class="r sq-in" data-label="Vào">${r.amount > 0 ? fmt(r.amount) : ''}</td><td class="r sq-out" data-label="Ra">${r.amount < 0 ? fmt(-r.amount) : ''}</td><td class="r" data-label="Còn"><strong>${vnd(r.bal)}</strong></td></tr>`)}
      </tbody></table></div>`;
  };
  return {
    title: 'Quỹ ngoài',
    html: html`${STYLE}${head}
      <div class="alert info">Quỹ ngoài chỉ anh (Chủ) thấy. Tiền vào = các phiếu rút anh đã bấm "Đã nhận tiền". Khoản chi / thu ngoài được chia cho cơ sở và tính vào chi phí (thu) của cơ sở ở Chốt tháng.</div>
      ${E.locked ? html`<div class="alert ok">Tháng này đã có cơ sở chốt — các khoản ngoài và số chia của tháng đã cố định.</div>` : ''}
      ${bad.length ? html`<div class="alert warn">${bad.length} khoản chưa chia hết cho cơ sở — chưa chốt tháng được.</div>` : ''}
      <div class="sq-kpis">
        <div class="sq-k"><span>Quỹ ngoài · tiền mặt</span><b>${vnd(E.balance.tien_mat)}</b><small>đến ${dmy(E.upto)}</small></div>
        <div class="sq-k"><span>Quỹ ngoài · tài khoản</span><b>${vnd(E.balance.chuyen_khoan)}</b><small>đến ${dmy(E.upto)}</small></div>
        <div class="sq-k pos"><span>Nhận từ cơ sở trong tháng</span><b>${vnd(recv)}</b><small>${E.pending.length ? `${E.pending.length} phiếu chờ anh nhận` : 'Không có phiếu chờ'}</small></div>
        <div class="sq-k neg"><span>Chi ngoài trong tháng</span><b>${vnd(sumK('chi'))}</b><small>Thu ngoài ${vnd(sumK('thu'))}</small></div></div>
      ${E.locked ? '' : html`<div class="toolbar" style="margin-bottom:12px"><button type="button" class="btn" id="ex-add">+ Khoản chi / thu ngoài</button>
        ${K && K.total ? html`<button type="button" class="btn secondary" id="ex-kho">Thanh toán kho tổng (${vnd(K.total)}${K.paid ? ` · đã trả ${vnd(K.paid)}` : ''})</button>` : ''}
        ${E.is_start_month ? html`<button type="button" class="btn secondary" id="ex-open">Số dư đầu ${dmy(E.start).slice(0, 5)}</button>` : ''}</div>`}
      ${E.pending.length ? html`<section class="card stack sq-sec"><h2>Phiếu rút chờ anh xác nhận</h2>
        ${E.pending.map((w) => html`<div class="sq-w todo"><div class="grow"><strong>${w.code} · ${M[w.method]}</strong>${w.note ? ` — ${w.note}` : ''}<div class="st-meta">${dmy(w.wdate)} · ${w.by || ''}</div></div>
          <div class="sq-amt" style="color:var(--ok-ink)">+${fmt(w.amount)}đ</div><button type="button" class="btn sm ex-ok" data-id="${w.id}" data-a="${w.amount}">Đã nhận tiền</button></div>`)}</section>` : ''}
      <section class="card stack sq-sec"><h2>Khoản chi / thu ngoài · ${monthLabel(month)}</h2>
        <div class="st-meta">Doanh thu tháng để chia theo tỉ lệ: ${E.revenue.map((r) => `${r.code} ${vnd(r.revenue)}`).join(' · ')}</div>
        ${E.entries.length ? E.entries.map((e) => html`<div class="sq-w ${e.ok ? '' : 'todo'}">
            <div class="grow"><strong>${e.note}</strong> <span class="st-meta">· ${e.category || ''} · ${e.pay_method === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'} · ${dmy(e.entry_date)}</span>
              <div class="st-meta">${MODE_ALL[e.alloc_mode]}${e.fixed ? ' (đã cố định)' : ''}${e.alloc_mode === 'kho_tong' ? '' : `: ${e.alloc.length ? e.alloc.map((a) => `${a.code} ${fmt(a.amount)}đ`).join(' · ') : 'chưa chia'}`}${e.ok ? '' : html` · <strong class="sq-out">chưa chia hết</strong>`}</div></div>
            <div class="sq-amt ${e.kind === 'thu' ? 'sq-in' : ''}">${e.kind === 'chi' ? '−' : '+'}${fmt(e.amount)}đ</div>
            ${E.locked ? '' : html`<span class="toolbar" style="gap:6px"><button type="button" class="btn sm secondary ex-ed" data-id="${e.id}">Sửa</button><button type="button" class="btn sm secondary danger ex-del" data-id="${e.id}" aria-label="Xóa">×</button></span>`}</div>`)
          : html`<div class="st-meta">Tháng này chưa có khoản ngoài nào.</div>`}</section>
      <section class="card stack sq-sec"><div class="sq-subhead"><h2>Sổ Quỹ ngoài</h2>
          <nav class="branch-tabs" aria-label="Quỹ">${Object.entries(M).map(([k, l]) => html`<a href="javascript:void 0" class="sq-lt ${LEDGER === k ? 'on' : ''}" data-m="${k}">${l}</a>`)}</nav></div>
        <div id="sq-led">${ledger(LEDGER)}</div></section>`,
    mount() {
      $$('.sq-lt').forEach((a) => a.addEventListener('click', () => { LEDGER = a.dataset.m; $$('.sq-lt').forEach((x) => x.classList.toggle('on', x === a)); $('#sq-led').innerHTML = str(ledger(LEDGER)); }));
      const errBox = (d, e) => { d.querySelector('.sq-err').innerHTML = str(html`<div class="alert error">${e.message}</div>`); };
      $$('.ex-ok').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm(`Xác nhận anh ĐÃ NHẬN ĐỦ ${vnd(b.dataset.a)}?\n\nXác nhận xong phiếu bị khóa, không ai sửa hay xóa được nữa.`)) return;
        try { await rpc('app_fund_withdraw_confirm', { p_id: Number(b.dataset.id) }); flash('Đã xác nhận nhận tiền. Phiếu đã khóa.'); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.ex-del').forEach((b) => b.addEventListener('click', async () => {
        const e = E.entries.find((x) => x.id === Number(b.dataset.id));
        if (!confirm(`Xóa khoản "${e.note}" (${vnd(e.amount)})?`)) return;
        try { await rpc('app_ext_entry_delete', { p_id: e.id }); flash('Đã xóa khoản.'); rerender(); } catch (err) { showSaved(err.message, true); }
      }));
      const form = (e = {}) => {
        const kind = e.kind || 'chi'; const mode = e.alloc_mode || 'doanh_thu'; const man = e.manual || {};
        const opts = (k, sel) => html`<option value="">— Chọn nhóm —</option>${cats(k).map((c) => html`<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}`;
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">${e.id ? 'Sửa khoản ngoài' : 'Khoản chi / thu ngoài'}</h2>
          <div class="pc-line" role="radiogroup" aria-label="Loại"><label class="radio-pill"><input type="radio" name="kind" value="chi" ${kind === 'chi' ? 'checked' : ''}> Khoản chi</label><label class="radio-pill"><input type="radio" name="kind" value="thu" ${kind === 'thu' ? 'checked' : ''}> Khoản thu</label></div>
          <label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${e.entry_date || (vnToday().startsWith(month) ? vnToday() : month + '-01')}" min="${E.start}"></label>
          <label class="field"><span>Nhóm</span><select class="input" name="cat">${opts(kind, e.category_id || '')}</select></label>
          <label class="field"><span>Nội dung</span><input class="input" name="note" value="${e.note || ''}" placeholder="vd: Tiền nhà LHP tháng 11, lương quản lý…" autocomplete="off"></label>
          <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${e.amount ? fmt(e.amount) : ''}" autocomplete="off"></label>
          <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" ${(e.pay_method || 'tien_mat') === 'tien_mat' ? 'checked' : ''}> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan" ${e.pay_method === 'chuyen_khoan' ? 'checked' : ''}> Chuyển khoản</label></div>
          <label class="field"><span>Chia cho cơ sở</span><select class="input" name="mode">${Object.entries(mode === 'kho_tong' ? MODE_ALL : MODE).map(([k, l]) => html`<option value="${k}" ${mode === k ? 'selected' : ''}>${l}</option>`)}</select></label>
          <label class="field ex-one" ${mode === 'mot' ? '' : 'hidden'}><span>Cơ sở</span><select class="input" name="br"><option value="">— Chọn cơ sở —</option>${E.branches.map((b) => html`<option value="${b.id}" ${String(e.alloc_branch) === String(b.id) ? 'selected' : ''}>${b.code} – ${b.name}</option>`)}</select></label>
          <div class="ex-man stack" style="gap:6px" ${mode === 'tu_nhap' ? '' : 'hidden'}>${E.branches.map((b) => html`<label class="ex-mrow"><span>${b.code}</span><input class="input money ex-m" data-b="${b.id}" inputmode="numeric" value="${man[b.id] ? fmt(man[b.id]) : ''}" autocomplete="off"></label>`)}
            <div class="st-meta" id="ex-msum"></div></div>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        const msum = () => { const t = $$('.ex-m', d).reduce((s, i) => s + (parseMoney(i.value) || 0), 0); const a = parseMoney(f.amt.value) || 0;
          $('#ex-msum', d).textContent = `Tổng đã nhập ${vnd(t)} / ${vnd(a)}${t === a ? ' ✓' : ` — còn ${signed(a - t)}`}`; };
        f.addEventListener('input', (ev) => { if (ev.target.classList.contains('ex-m') || ev.target.name === 'amt') msum(); });
        f.addEventListener('change', (ev) => {
          if (ev.target.name === 'kind') f.cat.innerHTML = str(opts(ev.target.value, ''));
          if (ev.target.name === 'mode') { $('.ex-one', d).hidden = f.mode.value !== 'mot'; $('.ex-man', d).hidden = f.mode.value !== 'tu_nhap'; msum(); }
        });
        msum();
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const manual = {}; $$('.ex-m', d).forEach((i) => { const v = parseMoney(i.value); if (v) manual[i.dataset.b] = String(v); });
          const p = { entry_date: f.date.value, kind: f.querySelector('input[name=kind]:checked').value, category_id: f.cat.value || null, note: f.note.value, amount: parseMoney(f.amt.value),
            pay_method: f.querySelector('input[name=pay]:checked').value, alloc_mode: f.mode.value, alloc_branch: f.br.value || null, manual };
          try { await rpc('app_ext_entry_save', { p_id: e.id || null, p }); d.close(); flash('Đã lưu khoản ngoài.'); rerender(); } catch (err) { errBox(d, err); }
        });
      };
      $('#ex-add')?.addEventListener('click', () => form());
      $('#ex-kho')?.addEventListener('click', () => form({ kind: 'chi', amount: Math.max(0, K.total - (K.paid || 0)) || K.total, alloc_mode: 'kho_tong', pay_method: 'chuyen_khoan',
        entry_date: vnToday().startsWith(month) ? vnToday() : E.to, note: `Thanh toán kho tổng tháng ${month.slice(5)}/${month.slice(0, 4)}`,
        category_id: (E.categories.find((c) => c.kind === 'chi' && /kho tổng/i.test(c.name)) || {}).id }));
      $$('.ex-ed').forEach((b) => b.addEventListener('click', () => form(E.entries.find((x) => x.id === Number(b.dataset.id)))));
      $('#ex-open')?.addEventListener('click', () => {
        const o = E.openings || {};
        const d = dialog(html`<form class="stack sq-dlg" style="gap:12px"><h2 style="margin:0">Số dư đầu Quỹ ngoài · ${dmy(E.start)}</h2>
          <label class="field"><span>Tiền mặt</span><input class="input money" name="tm" inputmode="numeric" value="${fmt(o.tien_mat?.amount || 0)}" autocomplete="off"></label>
          <label class="field"><span>Tài khoản</span><input class="input money" name="ck" inputmode="numeric" value="${fmt(o.chuyen_khoan?.amount || 0)}" autocomplete="off"></label>
          <div class="sq-err"></div>
          <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
        bindMoneyInputs(d); const f = d.querySelector('form');
        d.querySelector('[data-x]').addEventListener('click', () => d.close());
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          try {
            await rpc('app_ext_opening_set', { p_method: 'tien_mat', p_amount: parseMoney(f.tm.value) ?? 0, p_note: null });
            await rpc('app_ext_opening_set', { p_method: 'chuyen_khoan', p_amount: parseMoney(f.ck.value) ?? 0, p_note: null });
            d.close(); flash('Đã lưu số dư đầu Quỹ ngoài.'); rerender();
          } catch (err) { errBox(d, err); }
        });
      });
    },
  };
}

const STYLE = html`<style>
  .sq-ext-tab { border-style: dashed !important; }
  .alert.info { background: var(--info-bg, #eef4fb); color: var(--info-ink, #1e3a5f); }
  .ex-mrow { display: grid; grid-template-columns: 60px minmax(0, 1fr); align-items: center; gap: 8px; font-weight: 600; }
  .sq-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 12px; }
  .sq-month { display: flex; align-items: center; gap: 10px; }
  .sq-month strong { font-size: 17px; min-width: 120px; text-align: center; }
  .sq-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
  .sq-k { background: var(--card); border-radius: 14px; box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; border-top: 4px solid var(--primary); min-width: 0; }
  .sq-k span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; }
  .sq-k b { font-size: 20px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .sq-k small { font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; }
  .sq-k.pos { border-top-color: var(--ok-line); } .sq-k.neg { border-top-color: var(--off-line); } .sq-k.neg b { color: #b91c1c; } .sq-k.warn { border-top-color: #f59e0b; }
  .sq-sec { padding: 16px; gap: 10px; margin-bottom: 12px; min-width: 0; }
  .sq-sec h2 { font-size: 17px; margin: 0; }
  .sq-subhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sq-w { display: flex; align-items: center; gap: 10px; padding: 10px 6px; border-top: 1px solid var(--line-soft, var(--line)); flex-wrap: wrap; }
  .sq-w .grow { flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
  .sq-w.todo { background: var(--warn-bg); border-radius: 8px; }
  .sq-amt { font-weight: 700; color: #b91c1c; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sq-in { color: var(--ok-ink); font-weight: 600; } .sq-out { color: #b91c1c; font-weight: 600; }
  .sq-dc { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
  .sq-dc .link-btn { padding: 0; min-height: 0; }
  .table .r { text-align: right; }
  .sq-total td { background: var(--sage-bg); font-weight: 700; }
  .sq-dlg { width: min(520px, calc(100vw - 56px)); }
  .sq-tb { margin-bottom: 12px; flex-wrap: wrap; }
  .sq-cols { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 12px; align-items: start; }
  .sq-side { display: flex; flex-direction: column; min-width: 0; }
  .sq-sec h2 small { font-weight: 500; color: var(--muted); font-size: 13px; margin-left: 4px; }
  .sq-kpis.k5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .sq-lday { display: flex; flex-direction: column; }
  .sq-dh { padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--ink-2); }
  .sq-led { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1px 10px; padding: 7px 4px; border-bottom: 1px solid var(--line-soft); font-size: 14px; }
  .sq-led .grow { min-width: 0; overflow-wrap: anywhere; } .sq-led b { font-weight: 600; }
  .sq-led.mv { background: var(--plum-bg); }
  .sq-a { font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; } .sq-a.neg { color: #b91c1c; } .sq-a.pos { color: var(--ok-ink); } .sq-a.mv { color: var(--plum-ink); }
  .sq-bal { grid-column: 1 / -1; text-align: right; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .sq-tag { font-size: 11px; font-weight: 700; border-radius: 6px; padding: 0 6px; margin-left: 6px; background: var(--info-bg); color: var(--info-ink); } .sq-tag.ql { background: var(--warn-bg); color: var(--warn-ink); } .sq-tag.mv { background: var(--plum-bg); color: var(--plum-ink); }
  .sq-it { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; padding: 8px 2px; border-top: 1px solid var(--line-soft); }
  .sq-it .grow { min-width: 0; overflow-wrap: anywhere; } .sq-it.todo { background: var(--warn-bg); border-radius: 8px; padding: 8px; }
  .sq-acts { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; } .sq-acts .btn { width: auto; }
  .sq-amt.mv { color: var(--plum-ink); } .sq-adj { color: var(--ok-ink); }
  .sq-dayv { border-top: 1px solid var(--line-soft); padding: 6px 2px; display: flex; flex-direction: column; gap: 4px; }
  .sq-more summary { cursor: pointer; font-size: 13px; color: var(--primary); font-weight: 600; padding: 6px 0; }
  .sq-dvh { display: flex; justify-content: space-between; gap: 8px; } .sq-dvg { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 2px 8px; align-items: baseline; }
  @media (max-width: 1100px) { .sq-kpis.k5 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 900px) { .sq-cols { grid-template-columns: minmax(0, 1fr); } .sq-kpis.k5 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 900px) { .sq-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 760px) { .table.rt td.r { text-align: left; } }
</style>`;
