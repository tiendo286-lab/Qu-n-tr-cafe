// Chốt tháng: doanh thu (từ phiếu chốt ca), tiền mặt, chuyển khoản, chi phí & thu khác, khoản âm, lãi tạm tính → Chốt tháng (khóa)
// Chủ, Quản lý tổng: mọi cơ sở · Quản lý: cơ sở Chủ giao (máy chủ kiểm tra)
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, dt, fmt, parseMoney, result, signed, vnd } from '../tien.js';
import { $, $$, dialog, flash, html, showSaved, str } from '../ui.js';

export const perm = 'chot_thang';

const KA = [['chua_xu_ly', 'Chưa xử lý'], ['da_bu', 'Đã bù'], ['tru_luong', 'Trừ lương'], ['mien', 'Miễn']];
const PAY = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản' };
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + k, 1)); return d.toISOString().slice(0, 7); };
const sum = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);

export async function render({ params }) {
  const cur = vnToday().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : cur;
  const B = await rpc('app_fin_branches');
  if (!B.branches.length) {
    return { title: 'Chốt tháng', html: html`${STYLE}<div class="page-head"><div><h1>Chốt tháng</h1></div></div>
      <div class="card">Chủ chưa giao cơ sở nào cho bạn. Nhờ anh chủ vào <strong>Chốt tháng › Cài đặt › Giao cơ sở cho quản lý</strong>.</div>` };
  }
  const cn = params.cn === 'all' && B.admin ? 'all' : B.branches.some((b) => String(b.id) === params.cn) ? Number(params.cn) : B.admin ? 'all' : B.branches[0].id;
  const q = (o) => '#/quan-ly/chot-thang?' + Object.entries({ thang: month, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const head = html`<div class="page-head"><div><h1>Chốt tháng</h1>
      <div class="sub">Doanh thu lấy từ phiếu chốt ca (số đã đối soát). Chi phí: khoản chi ở phiếu ca + khoản nhập thêm. Chốt tháng xong thì số liệu tháng đó bị khóa.</div></div>
      <div class="toolbar"><div id="saved-indicator" class="saved" role="status" hidden></div>
      ${B.admin ? html`<button type="button" class="btn sm secondary" id="ct-set">⚙ Cài đặt</button>` : ''}</div></div>
    <section class="card ct-bar">
      <div class="ct-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a>
        <strong>${monthLabel(month)}</strong>${month === cur ? html`<span class="pill info">Tháng này</span>` : ''}
        <a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
      <nav class="branch-tabs" aria-label="Cơ sở">${B.admin ? html`<a class="${cn === 'all' ? 'on' : ''}" href="${q({ cn: 'all' })}">Tất cả</a>` : ''}
        ${B.branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav>
    </section>`;

  if (cn === 'all') {
    const rows = await rpc('app_fin_overview', { p_month: month });
    const T = (k) => sum(rows, (r) => r.totals[k]);
    const body = html`<section class="card flush"><div class="card-head"><h2>Tổng hợp ${monthLabel(month)}</h2><span class="st-meta">Bấm tên cơ sở để xem chi tiết và chốt</span></div>
      <div class="table-wrap"><table class="table rt ct-ov">
        <thead><tr><th>Cơ sở</th><th class="r">Doanh thu</th><th class="r">Chi phí</th><th class="r">Thu khác</th><th class="r">Lãi tạm tính</th><th class="r">Lệch tiền mặt</th><th class="r">Khoản âm</th><th title="Ca đã chốt / số ca dự kiến · ĐS = đã đối soát">Phiếu ca</th><th>Trạng thái</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr>
          <th scope="row"><a href="${q({ cn: r.branch_id })}" title="${r.name}">${r.code}</a></th>
          <td class="r" data-label="Doanh thu">${vnd(r.totals.revenue)}</td><td class="r" data-label="Chi phí">${vnd(r.totals.chi)}</td>
          <td class="r" data-label="Thu khác">${vnd(r.totals.thu)}</td>
          <td class="r ${r.totals.profit < 0 ? 'ct-neg' : 'ct-pos'}" data-label="Lãi tạm tính"><strong>${signed(r.totals.profit)}</strong></td>
          <td class="r" data-label="Lệch tiền mặt">${r.cash.gap ? signed(r.cash.gap) : '0đ'}</td>
          <td class="r" data-label="Khoản âm">${vnd(r.shortfalls.total)}</td>
          <td data-label="Phiếu ca">${r.revenue.done}/${r.revenue.expect} · ĐS ${r.revenue.recon}</td>
          <td data-label="Trạng thái">${r.closed ? html`<span class="pill ok">Đã chốt</span>` : html`<span class="pill mute">Chưa chốt</span>`}</td></tr>`)}
          <tr class="ct-total"><th scope="row">Tổng</th><td class="r" data-label="Doanh thu">${vnd(T('revenue'))}</td><td class="r" data-label="Chi phí">${vnd(T('chi'))}</td>
            <td class="r" data-label="Thu khác">${vnd(T('thu'))}</td><td class="r" data-label="Lãi tạm tính"><strong>${signed(T('profit'))}</strong></td>
            <td class="r" data-label="Lệch tiền mặt">${signed(sum(rows, (r) => r.cash.gap))}</td><td class="r" data-label="Khoản âm">${vnd(sum(rows, (r) => r.shortfalls.total))}</td><td></td>
            <td data-label="Đã chốt">${rows.filter((r) => r.closed).length}/${rows.length}</td></tr></tbody></table></div></section>`;
    return { title: 'Chốt tháng', html: html`${STYLE}${head}${body}`, mount: () => mountSettings(B) };
  }

  const D = await rpc('app_fin_month', { p_branch: cn, p_month: month });
  const R = D.revenue; const Tt = D.totals; const locked = !!D.closed;
  const cats = (k) => D.categories.filter((c) => c.kind === k && c.active);
  const warn = [];
  if (R.in_progress) warn.push(`${R.in_progress} phiếu chốt ca đang chốt dở`);
  if (R.recon < R.done) warn.push(`${R.done - R.recon} ca chưa hoàn thành đối soát`);
  if (Tt.uncat) warn.push(`${Tt.uncat} khoản chi ở phiếu ca chưa phân nhóm`);
  const note = R.done < R.expect ? `Mới có ${R.done}/${R.expect} ca có phiếu chốt ca hoàn thành (tính tới hôm nay) — kiểm tra ngày nào thiếu phiếu.` : '';
  const dayRows = D.days.map((d) => { const gap = d.counted !== null && d.expected !== null ? d.counted - d.expected : null; return { ...d, gap }; });

  const kpi = html`<section class="ct-kpis">
    <div class="ct-k"><span>Doanh thu</span><b>${vnd(Tt.revenue)}</b></div>
    <div class="ct-k"><span>Chi phí</span><b>${vnd(Tt.chi)}</b></div>
    <div class="ct-k"><span>Thu khác</span><b>${vnd(Tt.thu)}</b></div>
    <div class="ct-k ${Tt.profit < 0 ? 'ct-neg' : 'ct-pos'}"><span>Lãi tạm tính</span><b>${signed(Tt.profit)}</b></div></section>`;
  const status = html`<section class="card ct-status ${locked ? 'done' : ''}">
    <div><strong>${D.branch_code} – ${D.branch_name} · ${monthLabel(month)}</strong>
      ${locked ? html`<div class="st-meta">ĐÃ CHỐT bởi ${D.closed.by} · ${dt(D.closed.at)}${D.closed.note ? ' · ' + D.closed.note : ''}. Số liệu tháng này đã khóa.</div>`
        : html`<div class="st-meta">Chưa chốt. Kiểm tra từng phần bên dưới rồi bấm <strong>Chốt tháng</strong> (sau khi hết tháng).</div>`}</div>
    ${locked ? html`<span class="pill ok">ĐÃ CHỐT</span>` : html`<span class="pill mute">Chưa chốt</span>`}
    ${warn.length && !locked ? html`<div class="alert warn ct-warn">Cần xử lý trước khi chốt: ${warn.join(' · ')}</div>` : ''}
    ${note && !locked ? html`<div class="st-meta ct-warn">Lưu ý: ${note}</div>` : ''}</section>`;

  const secRev = html`<section class="card stack ct-sec"><h2>1. Doanh thu (từ phiếu chốt ca)</h2>
    <div class="kv">
      <div>Tổng doanh thu</div><div><strong>${vnd(R.total_revenue)}</strong></div>
      <div>Tiền mặt theo POS</div><div>${vnd(R.pos_cash)}</div>
      <div>Chuyển khoản theo POS</div><div>${vnd(R.pos_transfer)}</div>
      ${R.debt_new ? html`<div>Nợ phát sinh (chưa thu)</div><div>${vnd(R.debt_new)}</div>` : ''}
      ${R.debt_col_tm || R.debt_col_ck ? html`<div>Khách trả nợ</div><div>TM ${vnd(R.debt_col_tm)} · CK ${vnd(R.debt_col_ck)}</div>` : ''}
      <div>Số cốc</div><div>${fmt(R.cups)}</div>
      <div>Phiếu chốt ca</div><div>${R.done}/${R.expect} ca đã chốt · ${R.recon} ca đã đối soát${R.in_progress ? ` · ${R.in_progress} đang chốt` : ''}</div></div>
    <a class="st-meta" href="#/quan-ly/bao-cao-ca?kieu=thang&ngay=${month}-01&cn=${cn}">Xem biểu đồ doanh thu theo ngày ›</a></section>`;

  const C = D.cash;
  const secCash = html`<section class="card stack ct-sec"><h2>2. Tiền mặt</h2>
    <div class="kv">
      <div>Tiền mặt theo POS</div><div>${vnd(C.pos_cash)}</div>
      <div>Thu / chi tiền mặt tại ca</div><div>${signed(C.moves_cash)}</div>
      ${C.debt_cash ? html`<div>Khách trả nợ bằng tiền mặt</div><div>${signed(C.debt_cash)}</div>` : ''}
      <div><strong>Tiền mặt thu ròng trong tháng</strong></div><div><strong>${vnd(Number(C.pos_cash) + Number(C.moves_cash) + Number(C.debt_cash))}</strong></div>
      <div>Lệch khi quản lý đếm cuối ngày</div><div>${result(C.gap)} ${C.gap ? html`<span class="st-meta">(${signed(C.gap)})</span>` : ''}</div>
      <div>Số ngày đã đếm cuối ngày</div><div>${C.days_counted}/${C.days_open} ngày có bán${C.days_counted < C.days_open ? html` <span class="pill warn">${C.days_open - C.days_counted} ngày chưa đếm</span>` : ''}</div></div>
    ${dayRows.length ? html`<details><summary>Chi tiết từng ngày (${dayRows.length})</summary><div class="table-wrap"><table class="table rt ct-days">
      <thead><tr><th>Ngày</th><th class="r">Ca xong</th><th class="r">Đầu ngày</th><th class="r">TM POS</th><th class="r">Thu chi TM</th><th class="r">Phải có</th><th class="r">QL đếm</th><th class="r">Lệch</th></tr></thead>
      <tbody>${dayRows.map((d) => html`<tr><th scope="row"><a href="#/quan-ly/doi-soat?ngay=${d.date}">${dmy(d.date)}</a></th>
        <td class="r" data-label="Ca xong">${d.done}</td><td class="r" data-label="Đầu ngày">${vnd(d.opening)}</td><td class="r" data-label="TM POS">${vnd(d.pos_cash)}</td>
        <td class="r" data-label="Thu chi TM">${signed(d.moves_cash)}</td><td class="r" data-label="Phải có">${vnd(d.expected)}</td>
        <td class="r" data-label="QL đếm">${d.counted === null ? html`<span class="st-meta">chưa đếm</span>` : vnd(d.counted)}</td>
        <td class="r ${d.gap < 0 ? 'ct-neg' : ''}" data-label="Lệch">${d.gap === null ? '—' : d.gap ? signed(d.gap) : 'Khớp'}</td></tr>`)}</tbody></table></div></details>` : html`<div class="st-meta">Chưa có ngày nào có phiếu ca hoàn thành.</div>`}</section>`;

  const K = D.bank;
  const secBank = html`<section class="card stack ct-sec"><h2>3. Chuyển khoản</h2>
    <div class="kv">
      <div>Chuyển khoản theo POS</div><div>${vnd(K.pos_transfer)}</div>
      <div>Thực nhận (kế toán nhập số dư)</div><div>${K.shifts_ok ? vnd(K.received) : '—'} <span class="st-meta">${K.shifts_ok}/${K.shifts} ca đã nhập đủ tài khoản</span></div>
      ${K.shifts_ok ? html`<div>Chênh lệch (các ca đã nhập)</div><div>${result(K.received - K.pos_transfer_ok)} <span class="st-meta">(${signed(K.received - K.pos_transfer_ok)})</span></div>` : ''}</div>
    ${K.shifts_ok < K.shifts ? html`<div class="st-meta">Còn ${K.shifts - K.shifts_ok} ca kế toán chưa nhập đủ số dư ngân hàng (tab Kế toán › Chuyển khoản thực nhận).</div>` : ''}</section>`;

  const catOpts = (kind, sel, withNone) => html`${withNone ? html`<option value="">— Chưa phân nhóm —</option>` : ''}${cats(kind).map((c) => html`<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}`;
  const byChi = D.by_cat.filter((x) => x.kind === 'chi'); const byThu = D.by_cat.filter((x) => x.kind === 'thu');
  const secCost = html`<section class="card stack ct-sec"><h2>4. Chi phí và thu khác</h2>
    <div class="ct-cats">
      <div><div class="pc-sub">CHI PHÍ THEO NHÓM</div>${byChi.length ? html`<div class="kv">${byChi.map((x) => html`<div>${x.name}</div><div>${vnd(x.amount)}</div>`)}<div><strong>Tổng chi</strong></div><div><strong>${vnd(Tt.chi)}</strong></div></div>` : html`<div class="st-meta">Chưa có khoản chi.</div>`}</div>
      <div><div class="pc-sub">THU KHÁC THEO NHÓM</div>${byThu.length ? html`<div class="kv">${byThu.map((x) => html`<div>${x.name}</div><div>${vnd(x.amount)}</div>`)}<div><strong>Tổng thu khác</strong></div><div><strong>${vnd(Tt.thu)}</strong></div></div>` : html`<div class="st-meta">Chưa có khoản thu khác.</div>`}</div></div>

    <div class="pc-sub">KHOẢN THU CHI GHI Ở PHIẾU CHỐT CA (${D.moves.length}) <span class="st-meta">— khoản chi (−) tự tính vào chi phí; chọn nhóm, hoặc "Không tính" nếu không phải chi phí (vd: giải trình lệch tiền)</span></div>
    ${D.moves.length ? html`<div class="ct-list">${D.moves.map((m) => { const k = m.amount < 0 ? 'chi' : 'thu'; const v = m.excluded ? 'x' : m.category_id || '';
      return html`<div class="ct-row ${!m.excluded && !m.category_id ? 'todo' : ''} ${m.excluded ? 'off' : ''}">
        <div class="grow"><strong>${m.note || '(không ghi nội dung)'}</strong><div class="st-meta"><a href="#/ca/phieu?id=${m.report_id}">Ca ${m.shift} ${dmy(m.date)}</a> · ${PAY[m.kind]}</div></div>
        <div class="ct-amt ${m.amount < 0 ? 'ct-neg' : ''}">${signed(m.amount)}</div>
        <select class="input sm ct-mv" data-r="${m.report_id}" data-k="${m.mkey}" aria-label="Nhóm" ${locked ? 'disabled' : ''}>${catOpts(k, v, true)}<option value="x" ${v === 'x' ? 'selected' : ''}>Không tính</option></select></div>`; })}</div>`
      : html`<div class="st-meta">Không có khoản thu chi nào ở phiếu ca.</div>`}

    <div class="ct-subhead"><div class="pc-sub" style="margin:0">KHOẢN NHẬP THÊM (${D.entries.length}) <span class="st-meta">— mặt bằng, lương, điện nước, nguyên liệu kho tổng…</span></div>
      ${locked ? '' : html`<button type="button" class="btn sm" id="ct-add">+ Thêm khoản chi / thu</button>`}</div>
    ${D.entries.length ? html`<div class="ct-list">${D.entries.map((e) => html`<div class="ct-row">
        <div class="grow"><strong>${e.note}</strong><div class="st-meta">${dmy(e.entry_date)} · ${e.kind === 'chi' ? 'Chi' : 'Thu'} · ${e.category || 'Chưa phân nhóm'} · ${PAY[e.pay_method]} · ${e.by || ''}</div></div>
        <div class="ct-amt ${e.kind === 'chi' ? 'ct-neg' : ''}">${e.kind === 'chi' ? '−' : '+'}${vnd(e.amount)}</div>
        ${locked ? '' : html`<span class="toolbar" style="gap:6px"><button type="button" class="btn sm secondary ct-ed" data-id="${e.id}">Sửa</button><button type="button" class="btn sm secondary danger ct-del" data-id="${e.id}" aria-label="Xóa">×</button></span>`}</div>`)}</div>`
      : html`<div class="st-meta">Chưa nhập khoản nào.</div>`}</section>`;

  const S = D.shortfalls;
  const secKa = html`<section class="card stack ct-sec"><h2>5. Khoản âm của nhân viên</h2>
    ${S.count ? html`<div class="kv"><div><strong>Tổng khoản âm (${S.count})</strong></div><div><strong>${vnd(S.total)}</strong></div>${KA.map(([k, l]) => html`<div>${l}</div><div>${vnd(S[k])}</div>`)}</div>
      <a class="st-meta" href="#/quan-ly/khoan-am">Mở danh sách khoản âm ›</a>` : html`<div class="st-meta">Không có khoản âm trong tháng.</div>`}</section>`;

  const secEnd = html`<section class="card stack ct-sec"><h2>6. Kết quả và chốt tháng</h2>
    <div class="kv">
      <div>Doanh thu</div><div>${vnd(Tt.revenue)}</div>
      <div>+ Thu khác</div><div>${vnd(Tt.thu)}</div>
      <div>− Chi phí</div><div>${vnd(Tt.chi)} <span class="st-meta">(ở phiếu ca ${vnd(Tt.chi_ca)} · nhập thêm ${vnd(Tt.chi_tay)})</span></div>
      <div><strong>Lãi tạm tính</strong></div><div class="${Tt.profit < 0 ? 'ct-neg' : 'ct-pos'}"><strong>${signed(Tt.profit)}</strong></div></div>
    <div class="st-meta">"Tạm tính" vì chỉ gồm các khoản đã nhập. Khoản âm của nhân viên không trừ vào lãi (đã nằm trong tiền thiếu của ca).</div>
    <div class="toolbar">
      ${locked ? (D.can_reopen ? html`<button type="button" class="btn secondary danger" id="ct-reopen">Mở lại tháng (Chủ)</button>` : '')
        : month >= cur ? html`<button type="button" class="btn" disabled title="Chỉ chốt được tháng đã kết thúc">Chốt tháng (sau khi hết tháng)</button>`
        : html`<button type="button" class="btn" id="ct-close">CHỐT ${monthLabel(month).toUpperCase()}</button>`}</div>
    ${D.log.length ? html`<details><summary>Lịch sử chốt / mở lại (${D.log.length})</summary>${D.log.map((l) => html`<div class="rc-log">${dt(l.at)} · ${l.by} · <strong>${l.action === 'chot' ? 'Chốt tháng' : 'Mở lại tháng'}</strong>${l.reason ? ` · ${l.reason}` : ''}</div>`)}</details>` : ''}</section>`;

  return {
    title: `Chốt tháng ${D.branch_code}`,
    html: html`${STYLE}${head}${status}${kpi}<div class="ct-grid">${secRev}${secCash}${secBank}${secKa}</div>${secCost}${secEnd}`,
    mount() { mountSettings(B); mountBranch(D, cn, month, cats, catOpts); },
  };
}

function mountBranch(D, cn, month, cats, catOpts) {
  $$('.ct-mv').forEach((s) => s.addEventListener('change', async () => {
    s.disabled = true;
    try { await rpc('app_fin_move_set', { p_report: Number(s.dataset.r), p_mkey: s.dataset.k, p_category: s.value && s.value !== 'x' ? Number(s.value) : null, p_excluded: s.value === 'x' }); rerender(); }
    catch (e) { s.disabled = false; showSaved(e.message, true); }
  }));
  const entryForm = (e = {}) => {
    const kind = e.kind || 'chi';
    const d = dialog(html`<form class="stack ct-dlg" style="gap:12px"><h2 style="margin:0">${e.id ? 'Sửa khoản' : 'Thêm khoản chi / thu'}</h2>
      <div class="pc-line" role="radiogroup" aria-label="Loại"><label class="radio-pill"><input type="radio" name="kind" value="chi" ${kind === 'chi' ? 'checked' : ''}> Chi phí</label><label class="radio-pill"><input type="radio" name="kind" value="thu" ${kind === 'thu' ? 'checked' : ''}> Thu khác</label></div>
      <label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${e.entry_date || (vnToday().startsWith(month) ? vnToday() : month + '-01')}" min="${month}-01" max="${D.to}"></label>
      <label class="field"><span>Nhóm</span><select class="input" name="cat">${catOpts(kind, e.category_id || '', true)}</select></label>
      <label class="field"><span>Nội dung</span><input class="input" name="note" value="${e.note || ''}" placeholder="vd: Tiền nhà tháng ${Number(month.slice(5))}" autocomplete="off"></label>
      <label class="field"><span>Số tiền</span><input class="input money" name="amt" inputmode="numeric" value="${e.amount ? fmt(e.amount) : ''}" autocomplete="off"></label>
      <div class="pc-line" role="radiogroup" aria-label="Hình thức"><label class="radio-pill"><input type="radio" name="pay" value="tien_mat" ${(e.pay_method || 'tien_mat') === 'tien_mat' ? 'checked' : ''}> Tiền mặt</label><label class="radio-pill"><input type="radio" name="pay" value="chuyen_khoan" ${e.pay_method === 'chuyen_khoan' ? 'checked' : ''}> Chuyển khoản</label></div>
      <div id="ct-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Hủy</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    bindMoneyInputs(d);
    const f = d.querySelector('form');
    f.addEventListener('change', (ev) => { if (ev.target.name === 'kind') f.cat.innerHTML = str(catOpts(ev.target.value, '', true)); });
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const p = { branch_id: cn, entry_date: f.date.value, kind: f.querySelector('input[name=kind]:checked').value, category_id: f.cat.value || null, note: f.note.value, amount: parseMoney(f.amt.value), pay_method: f.querySelector('input[name=pay]:checked').value };
      try { await rpc('app_fin_entry_save', { p_id: e.id || null, p }); d.close(); flash('Đã lưu.'); rerender(); }
      catch (err) { d.querySelector('#ct-err').innerHTML = str(html`<div class="alert error">${err.message}</div>`); }
    });
  };
  $('#ct-add')?.addEventListener('click', () => entryForm());
  $$('.ct-ed').forEach((b) => b.addEventListener('click', () => entryForm(D.entries.find((x) => x.id === Number(b.dataset.id)))));
  $$('.ct-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Xóa khoản này?')) return;
    try { await rpc('app_fin_entry_delete', { p_id: Number(b.dataset.id) }); rerender(); } catch (e) { showSaved(e.message, true); }
  }));
  $('#ct-close')?.addEventListener('click', async () => {
    const note = prompt(`Chốt ${D.branch_code} tháng ${month.slice(5)}/${month.slice(0, 4)}?\nSau khi chốt, phiếu ca, đối soát, kiểm đếm cuối ngày và chi phí của tháng này bị khóa.\nGhi chú (không bắt buộc):`, '');
    if (note === null) return;
    try { await rpc('app_fin_close', { p_branch: cn, p_month: month, p_note: note }); flash('Đã chốt tháng.'); rerender(); } catch (e) { showSaved(e.message, true); }
  });
  $('#ct-reopen')?.addEventListener('click', async () => {
    const why = prompt('Mở lại tháng đã chốt để sửa. Lý do (bắt buộc):', '');
    if (why === null) return;
    try { await rpc('app_fin_reopen', { p_branch: cn, p_month: month, p_reason: why }); flash('Đã mở lại tháng.'); rerender(); } catch (e) { showSaved(e.message, true); }
  });
}

// Cài đặt (Chủ / Quản lý tổng): nhóm chi / thu; Chủ: giao cơ sở cho quản lý
function mountSettings(B) {
  $('#ct-set')?.addEventListener('click', async () => {
    const D = await rpc('app_fin_month', { p_branch: B.branches[0].id, p_month: vnToday().slice(0, 7) });
    const M = B.owner ? await rpc('app_fin_managers').catch(() => []) : [];
    const catRow = (c) => html`<div class="pc-line ct-cat" data-id="${c.id}"><span class="pill ${c.kind === 'chi' ? 'warn' : 'ok'}">${c.kind === 'chi' ? 'Chi' : 'Thu'}</span>
      <input class="input sm grow" value="${c.name}" aria-label="Tên nhóm"><label class="st-meta" style="display:flex;gap:4px;align-items:center"><input type="checkbox" ${c.active ? 'checked' : ''}> Dùng</label></div>`;
    const d = dialog(html`<div class="stack ct-dlg" style="gap:14px"><h2 style="margin:0">Cài đặt chốt tháng</h2>
      <div class="pc-sub" style="margin:0">NHÓM CHI / THU</div>
      <div class="stack" style="gap:6px" id="ct-cats">${D.categories.map(catRow)}</div>
      <div class="pc-line"><select class="input sm" id="ct-nk" aria-label="Loại nhóm mới"><option value="chi">Chi</option><option value="thu">Thu</option></select><input class="input sm grow" id="ct-nn" placeholder="Tên nhóm mới" autocomplete="off"><button type="button" class="btn sm secondary" id="ct-na">+ Thêm</button></div>
      ${B.owner ? html`<div class="pc-sub" style="margin:0">GIAO CƠ SỞ CHO QUẢN LÝ <span class="st-meta">— quản lý chỉ xem / chốt cơ sở được giao</span></div>
        ${M.length ? M.map((m) => html`<div class="ct-mgr" data-acc="${m.account_id}"><strong>${m.name}</strong><div class="pc-line">${B.branches.map((b) => html`<label class="radio-pill"><input type="checkbox" value="${b.id}" ${m.branches.includes(b.id) ? 'checked' : ''}> ${b.code}</label>`)}</div></div>`)
          : html`<div class="st-meta">Chưa có tài khoản vai trò Quản lý.</div>`}` : ''}
      <div id="ct-err"></div>
      <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button><button type="button" class="btn sm" id="ct-save">Lưu</button></div></div>`);
    d.querySelector('[data-x]').addEventListener('click', () => d.close());
    const err = (m) => { d.querySelector('#ct-err').innerHTML = str(html`<div class="alert error">${m}</div>`); };
    d.querySelector('#ct-na').addEventListener('click', async () => {
      const name = d.querySelector('#ct-nn').value.trim(); if (!name) return;
      try { await rpc('app_fin_category_save', { p_id: null, p_kind: d.querySelector('#ct-nk').value, p_name: name, p_sort: 50, p_active: true }); d.close(); flash('Đã thêm nhóm.'); rerender(); } catch (e) { err(e.message); }
    });
    d.querySelector('#ct-save').addEventListener('click', async () => {
      try {
        for (const r of d.querySelectorAll('.ct-cat')) {
          const c = D.categories.find((x) => x.id === Number(r.dataset.id)); const name = r.querySelector('input.input').value.trim(); const on = r.querySelector('input[type=checkbox]').checked;
          if (c && (c.name !== name || !!c.active !== on)) await rpc('app_fin_category_save', { p_id: c.id, p_kind: c.kind, p_name: name, p_sort: c.sort_order, p_active: on });
        }
        for (const r of d.querySelectorAll('.ct-mgr')) {
          const ids = [...r.querySelectorAll('input:checked')].map((x) => Number(x.value)); const m = M.find((x) => x.account_id === Number(r.dataset.acc));
          if (JSON.stringify([...m.branches].sort()) !== JSON.stringify([...ids].sort())) await rpc('app_fin_manager_set', { p_account: m.account_id, p_branches: ids });
        }
        d.close(); flash('Đã lưu cài đặt.'); rerender();
      } catch (e) { err(e.message); }
    });
  });
}

const STYLE = html`<style>
  .ct-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; }
  .ct-month { display: flex; align-items: center; gap: 10px; }
  .ct-month strong { font-size: 17px; min-width: 120px; text-align: center; }
  .ct-status { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px 16px; }
  .ct-status.done { border-left: 5px solid var(--ok-line); }
  .ct-warn { flex-basis: 100%; }
  .ct-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .ct-k { background: var(--card); border-radius: 14px; box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; border-top: 4px solid var(--primary); min-width: 0; }
  .ct-k span { font-size: 12px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .03em; }
  .ct-k b { font-size: 20px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .ct-k.ct-pos { border-top-color: var(--ok-line); } .ct-k.ct-neg { border-top-color: var(--off-line); }
  .ct-neg, .ct-neg b, .ct-neg strong { color: #b91c1c; } .ct-pos b, .ct-pos strong { color: var(--ok-ink); }
  .ct-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .ct-sec { gap: 12px; padding: 16px; min-width: 0; }
  .ct-sec h2 { font-size: 17px; }
  .ct-sec .kv { grid-template-columns: minmax(0, max-content) minmax(0, 1fr); }
  .ct-sec .kv > div { min-width: 0; overflow-wrap: anywhere; }
  .ct-sec .pill { white-space: normal; }
  .ct-cats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .ct-list { display: flex; flex-direction: column; }
  .ct-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--line); flex-wrap: wrap; }
  .ct-row .grow { flex: 1 1 200px; min-width: 0; }
  .ct-row.todo { background: var(--warn-bg); border-radius: 8px; padding: 8px; }
  .ct-row.off .ct-amt, .ct-row.off strong { color: var(--muted); text-decoration: line-through; }
  .ct-amt { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ct-row select { width: 190px; max-width: 100%; }
  .ct-subhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
  .table .r { text-align: right; }
  .ct-ov th, .ct-ov td { padding-left: 10px; padding-right: 10px; } .ct-ov tbody th { background: none; } .ct-total th, .ct-total td { background: var(--sage-bg); font-weight: 700; }
  .ct-dlg { width: min(520px, calc(100vw - 56px)); }
  .ct-mgr { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
  .pc-sub { font-size: 12px; font-weight: 700; letter-spacing: .03em; color: var(--ink-2); }
  .pc-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pc-line .grow { flex: 1 1 160px; min-width: 0; }
  .radio-pill { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--line-strong); border-radius: 10px; padding: 8px 12px; font-size: 14px; cursor: pointer; }
  .radio-pill:has(input:checked) { border-color: var(--primary); background: var(--caramel-soft); font-weight: 600; }
  .rc-log { font-size: 13px; padding: 3px 0; border-bottom: 1px dashed var(--line-soft); }
  details > summary { cursor: pointer; font-weight: 600; }
  @media (max-width: 900px) { .ct-grid, .ct-cats { grid-template-columns: minmax(0, 1fr); } .ct-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 760px) { .ct-k b { font-size: 17px; } .ct-row select { width: 100%; } }
</style>`;
