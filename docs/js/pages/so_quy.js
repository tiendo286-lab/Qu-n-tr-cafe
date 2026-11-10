// Chốt tháng › Sổ quỹ: quỹ TIỀN MẶT (ngoài két) + TÀI KHOẢN của từng cơ sở
//  * Vào: nộp quỹ cuối ngày (tự động = đếm cuối ngày − 1.000.000đ, sửa được), chuyển khoản thực nhận, NV bù khoản âm, khoản thu quản lý tạo
//  * Ra: khoản chi quản lý tạo, phiếu rút (Chủ bấm "Đã nhận tiền" → khóa)
//  * Kiểm quỹ (so số thực tế với sổ), nhắc rút bớt khi quỹ tiền mặt vượt mức
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

export async function render({ params }) {
  const cur = vnToday().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : cur;
  const O = await rpc('app_fund_overview', { p_month: month });
  if (!O.branches.length) return { title: 'Sổ quỹ', html: html`${STYLE}<div class="page-head"><div><h1>Sổ quỹ</h1></div></div><div class="card">Bạn chưa được giao cơ sở nào.</div>` };
  const many = O.branches.length > 1;
  const cn = params.cn && params.cn !== 'all' && O.branches.some((b) => String(b.id) === params.cn) ? Number(params.cn) : many ? 'all' : O.branches[0].id;
  const q = (o) => '#/quan-ly/so-quy?' + Object.entries({ thang: month, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const head = html`<div class="page-head"><div><h1>Sổ quỹ</h1>
      <div class="sub">Quỹ tiền mặt (ngoài két — 1.000.000đ đầu ca sáng để nguyên trong két) và tài khoản của từng cơ sở. Cuối tháng rút hết về 0. Phiếu rút Chủ đã bấm "Đã nhận tiền" thì bị khóa.</div></div>
      <div id="saved-indicator" class="saved" role="status" hidden></div></div>
    <section class="card sq-bar">
      <div class="sq-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a>
        <strong>${monthLabel(month)}</strong>${month === cur ? html`<span class="pill info">Tháng này</span>` : ''}
        <a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
      <nav class="branch-tabs" aria-label="Cơ sở">${many ? html`<a class="${cn === 'all' ? 'on' : ''}" href="${q({ cn: 'all' })}">Tất cả</a>` : ''}
        ${O.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav></section>`;

  if (month < O.start.slice(0, 7)) return { title: 'Sổ quỹ', html: html`${STYLE}${head}<div class="card">Sổ quỹ bắt đầu từ ${dmy(O.start)}.</div>` };

  if (cn === 'all') {
    const tot = (k) => O.branches.reduce((s, b) => s + Number(b[k] || 0), 0);
    return {
      title: 'Sổ quỹ',
      html: html`${STYLE}${head}
        <section class="card flush"><div class="card-head"><h2>Số dư các cơ sở</h2><span class="st-meta">Nhắc rút bớt khi quỹ tiền mặt vượt ${vnd(O.alert)}</span></div>
          <div class="table-wrap"><table class="table rt sq-ov"><thead><tr><th>Cơ sở</th><th class="r">Quỹ tiền mặt</th><th class="r">Tài khoản (sổ)</th><th class="r">Tài khoản (kế toán nhập)</th><th class="r">Đã rút TM</th><th class="r">Đã rút CK</th><th>Phiếu chờ nhận</th></tr></thead>
          <tbody>${O.branches.map((b) => html`<tr>
            <td data-label="Cơ sở"><a href="${q({ cn: b.id })}"><strong>${b.code}</strong></a> <span class="st-meta">${b.name}</span>${b.closed ? html` <span class="pill ok">Đã chốt</span>` : ''}</td>
            <td class="r" data-label="Quỹ tiền mặt">${b.cash > O.alert ? html`<span class="pill off">${vnd(b.cash)} · nên rút</span>` : vnd(b.cash)}</td>
            <td class="r" data-label="Tài khoản (sổ)">${vnd(b.bank)}</td>
            <td class="r" data-label="TK kế toán nhập">${b.bank_actual?.amount != null ? html`${vnd(b.bank_actual.amount)} <span class="st-meta">${dmy(b.bank_actual.at)}</span>` : '—'}</td>
            <td class="r" data-label="Đã rút TM">${vnd(b.out_cash)}</td><td class="r" data-label="Đã rút CK">${vnd(b.out_bank)}</td>
            <td data-label="Phiếu chờ nhận">${b.pending ? html`<span class="pill warn">${b.pending} phiếu</span>` : '—'}</td></tr>`)}
            <tr class="sq-total"><td data-label="">Tổng</td><td class="r" data-label="Quỹ tiền mặt">${vnd(tot('cash'))}</td><td class="r" data-label="Tài khoản (sổ)">${vnd(tot('bank'))}</td><td></td>
              <td class="r" data-label="Đã rút TM">${vnd(tot('out_cash'))}</td><td class="r" data-label="Đã rút CK">${vnd(tot('out_bank'))}</td><td data-label="Phiếu chờ">${tot('pending') || '—'}</td></tr></tbody></table></div></section>`,
    };
  }

  const D = await rpc('app_fund_branch', { p_branch: cn, p_month: month });
  const B = D.balance; const out = (m) => D.withdrawals.filter((w) => w.method === m && w.wdate >= D.from && w.wdate <= D.to).reduce((s, w) => s + Number(w.amount), 0);
  const pend = D.withdrawals.filter((w) => w.status === 'cho_nhan');
  const editable = !D.locked;
  const ba = D.bank_actual || {};

  const dayCell = (d, m) => {
    const set = m === 'tien_mat' ? d.cash_set : d.bank_set; const auto = m === 'tien_mat' ? d.cash_auto : d.bank_auto;
    const v = set ?? auto; const note = m === 'tien_mat' ? d.cash_note : d.bank_note;
    return html`<div class="sq-dc"><span>${v == null ? '—' : vnd(v)}</span>
      <span class="st-meta">${set != null ? 'QL nhập' + (note ? ` · ${note}` : '') : auto != null ? 'tự động' : 'chưa có'}</span>
      ${editable ? html`<button type="button" class="link-btn sq-day" data-d="${d.date}" data-m="${m}">${v == null ? 'Nhập' : 'Sửa'}</button>` : ''}</div>`;
  };
  const wRow = (w) => html`<div class="sq-w ${w.status === 'cho_nhan' ? 'todo' : ''}">
      <div class="grow"><strong>${KIND[w.kind]} · ${M[w.method]}</strong>${w.note ? html` — ${w.note}` : ''}
        <div class="st-meta">${dmy(w.wdate)} · tạo bởi ${w.by || ''}${w.status === 'da_nhan' ? html` · <strong>Chủ đã nhận</strong> ${dt(w.received_at)}` : ''}</div></div>
      <div class="sq-amt">−${fmt(w.amount)}đ</div>
      <div>${w.status === 'da_nhan' ? html`<span class="pill ok">Đã nhận · khóa</span>` : html`<span class="pill warn">Chờ Chủ nhận</span>`}</div>
      <div class="toolbar" style="gap:6px">${w.status === 'cho_nhan' && D.owner ? html`<button type="button" class="btn sm sq-ok" data-id="${w.id}">Đã nhận tiền</button>` : ''}
        ${!w.locked ? html`<button type="button" class="btn sm secondary sq-wed" data-id="${w.id}">Sửa</button><button type="button" class="btn sm secondary danger sq-wdel" data-id="${w.id}" aria-label="Xóa">×</button>` : ''}</div></div>`;

  const ledger = (m) => {
    let bal = Number(D.open[m] || 0);
    const rows = D.rows.filter((r) => r.method === m).map((r) => { bal += Number(r.amount); return { ...r, bal }; });
    return html`<div class="table-wrap"><table class="table rt sq-led"><thead><tr><th>Ngày</th><th>Nội dung</th><th class="r">Vào</th><th class="r">Ra</th><th class="r">Còn</th></tr></thead>
      <tbody><tr class="sq-total"><td data-label="Ngày">${dmy(D.from)}</td><td data-label="Nội dung">Số dư đầu tháng</td><td></td><td></td><td class="r" data-label="Còn">${vnd(D.open[m])}</td></tr>
      ${rows.map((r) => html`<tr><td data-label="Ngày">${dmy(r.date)}</td><td data-label="Nội dung">${r.label}${r.ref?.note ? html` <span class="st-meta">· ${r.ref.note}</span>` : ''}</td>
        <td class="r sq-in" data-label="Vào">${r.amount > 0 ? fmt(r.amount) : ''}</td><td class="r sq-out" data-label="Ra">${r.amount < 0 ? fmt(-r.amount) : ''}</td><td class="r" data-label="Còn"><strong>${vnd(r.bal)}</strong></td></tr>`)}
      </tbody></table></div>`;
  };

  return {
    title: `Sổ quỹ ${D.code}`,
    html: html`${STYLE}${head}
      ${D.locked ? html`<div class="alert ok">Tháng này đã chốt — sổ quỹ chỉ xem.</div>` : ''}
      ${B.tien_mat > D.alert ? html`<div class="alert warn">Quỹ tiền mặt ${D.code} đang giữ <strong>${vnd(B.tien_mat)}</strong>, vượt mức ${vnd(D.alert)}. Nên rút bớt về (tạo phiếu rút).</div>` : ''}
      <div class="sq-kpis">
        <div class="sq-k ${B.tien_mat > D.alert ? 'neg' : ''}"><span>Quỹ tiền mặt</span><b>${vnd(B.tien_mat)}</b><small>đến ${dmy(D.upto)}</small></div>
        <div class="sq-k"><span>Tài khoản (sổ)</span><b>${vnd(B.chuyen_khoan)}</b><small>${ba.amount != null ? html`Kế toán nhập: ${vnd(ba.amount)} (${dmy(ba.at)})${Number(ba.amount) !== Number(B.chuyen_khoan) ? html` · <span class="sq-out">lệch ${signed(ba.amount - B.chuyen_khoan)}</span>` : ' · khớp'}` : 'Kế toán chưa nhập số dư'}</small></div>
        <div class="sq-k pos"><span>Đã rút trong tháng</span><b>${vnd(out('tien_mat') + out('chuyen_khoan'))}</b><small>TM ${vnd(out('tien_mat'))} · CK ${vnd(out('chuyen_khoan'))}</small></div>
        <div class="sq-k ${pend.length ? 'warn' : ''}"><span>Phiếu chờ Chủ nhận</span><b>${pend.length}</b><small>${pend.length ? vnd(pend.reduce((s, w) => s + Number(w.amount), 0)) : 'Không có'}</small></div></div>
      ${editable ? html`<div class="toolbar" style="margin-bottom:12px"><button type="button" class="btn" id="sq-new">+ Phiếu rút</button><button type="button" class="btn secondary" id="sq-count">Kiểm quỹ</button>
        ${D.is_start_month ? html`<button type="button" class="btn secondary" id="sq-open">Số dư đầu ${dmy(D.start).slice(0, 5)}</button>` : ''}</div>` : ''}

      <section class="card stack sq-sec"><h2>Phiếu rút</h2>
        ${D.withdrawals.length ? html`<div>${D.withdrawals.map(wRow)}</div>` : html`<div class="st-meta">Tháng này chưa có phiếu rút.</div>`}</section>

      <section class="card stack sq-sec"><h2>Theo ngày: nộp quỹ và tiền về</h2>
        <div class="st-meta">Nộp quỹ tiền mặt tự tính = số quản lý đếm cuối ngày − ${vnd(D.float)} để lại cho ca sáng. Chuyển khoản về lấy từ số dư kế toán nhập. Ngày chưa có số thì bấm <strong>Nhập</strong> (nhập bổ sung các ngày đã qua).</div>
        ${D.days.length ? html`<div class="table-wrap"><table class="table rt sq-days"><thead><tr><th>Ngày</th><th class="r">Phiếu ca xong</th><th class="r">Đếm cuối ngày</th><th>Nộp quỹ tiền mặt</th><th>Chuyển khoản về</th></tr></thead>
          <tbody>${[...D.days].reverse().map((d) => html`<tr><td data-label="Ngày"><strong>${dmy(d.date)}</strong></td><td class="r" data-label="Phiếu ca xong">${d.reports}</td>
            <td class="r" data-label="Đếm cuối ngày">${d.counted == null ? '—' : vnd(d.counted)}</td><td data-label="Nộp quỹ TM">${dayCell(d, 'tien_mat')}</td><td data-label="CK về">${dayCell(d, 'chuyen_khoan')}</td></tr>`)}</tbody></table></div>`
          : html`<div class="st-meta">Chưa tới ngày nào.</div>`}</section>

      <section class="card stack sq-sec"><div class="sq-subhead"><h2>Sổ chi tiết</h2>
          <nav class="branch-tabs" aria-label="Quỹ">${Object.entries(M).map(([k, l]) => html`<a href="javascript:void 0" class="sq-lt ${LEDGER === k ? 'on' : ''}" data-m="${k}">${l}</a>`)}</nav></div>
        <div id="sq-led">${ledger(LEDGER)}</div></section>

      <section class="card stack sq-sec"><h2>Kiểm quỹ</h2>
        ${D.counts.length ? D.counts.map((c) => html`<div class="sq-w"><div class="grow"><strong>${M[c.method]} · ${dmy(c.count_date)}</strong> — thực tế ${vnd(c.counted)}, sổ ${vnd(c.book)}
            <div class="st-meta">${c.by || ''} · ${dt(c.created_at)}${c.note ? ` · ${c.note}` : ''}</div></div>
            <div>${c.counted === c.book ? html`<span class="pill ok">KHỚP</span>` : c.counted < c.book ? html`<span class="pill off">THIẾU ${fmt(c.book - c.counted)}đ</span>` : html`<span class="pill warn">THỪA ${fmt(c.counted - c.book)}đ</span>`}</div></div>`)
          : html`<div class="st-meta">Tháng này chưa kiểm quỹ lần nào.</div>`}</section>`,
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
    },
  };
}

const STYLE = html`<style>
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
  @media (max-width: 900px) { .sq-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 760px) { .table.rt td.r { text-align: left; } }
</style>`;
