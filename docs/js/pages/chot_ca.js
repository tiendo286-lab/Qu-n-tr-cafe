// Chốt ca: xem theo tuần, từng cơ sở (bước 76) — bảng ngày × ca, bấm ô để mở phiếu
import { isManager } from '../app.js';
import { WEEKDAYS, addDays, vnToday, weekStart } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, fmt, noKind, signed } from '../tien.js';
import { $, $$, go, html, showSaved } from '../ui.js';

export const perm = 'chot_ca';

export const STAFF_LABEL = { dang_chot: ['Đang chốt', 'warn'], hoan_thanh: ['Hoàn thành', 'ok'] };

// Bước 79: nhãn khách nợ / khách mượn trên ô ca (bảng tuần Chốt ca, Đối soát) — nợ phát sinh còn chưa trả / đã trả hết, nợ thu được trong ca
const nk = (n) => { const a = Math.abs(Number(n) || 0); return a >= 1e6 ? `${(a / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}tr` : a >= 1000 ? `${Math.round(a / 1000)}k` : `${a}`; };
export function debtBadges(x) {
  if (!x) return '';
  const tao = x.tao || []; const thu = x.thu || [];
  const open = tao.filter((d) => !d.paid); const sumA = (a) => a.reduce((t, d) => t + Number(d.amount || 0), 0);
  const who = (d) => `${noKind(d.kind)} ${d.name} ${nk(d.amount)}`;
  const word = () => 'Nợ';
  return html`${tao.length ? (open.length
      ? html`<span class="nb open" title="${tao.map((d) => `${who(d)} — ${d.paid ? `đã trả ${d.collect_kind === 'chuyen_khoan' ? 'CK' : 'TM'} ca ${d.paid_shift || ''} ${String(d.paid_date || '').slice(8, 10)}/${String(d.paid_date || '').slice(5, 7)}` : 'CHƯA TRẢ'}`).join('\n')}">${word(open)} ${nk(sumA(open))} chưa trả</span>`
      : html`<span class="nb ok" title="${tao.map((d) => `${who(d)} — đã trả ${d.collect_kind === 'chuyen_khoan' ? 'CK' : 'TM'} ca ${d.paid_shift || ''} ${String(d.paid_date || '').slice(8, 10)}/${String(d.paid_date || '').slice(5, 7)}`).join('\n')}">${word(tao)} ${nk(sumA(tao))} đã trả</span>`) : ''}
    ${thu.length ? html`<span class="nb thu" title="${thu.map((d) => `${who(d)} (từ ca ${d.from_shift || 'quản lý ghi'} ${String(d.from_date || '').slice(8, 10)}/${String(d.from_date || '').slice(5, 7)}) trả ${d.collect_kind === 'chuyen_khoan' ? 'CK' : 'TM'}`).join('\n')}">Thu nợ ${nk(sumA(thu))}</span>` : ''}`;
}

// Bước 80 (anh Tiến 13/11): trong ô ca ghi từng khoản nợ + "đã trả ca … ngày …"; dưới bảng có phần Nợ của tuần
const dmS = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}` : '');
const pk = (k) => (k === 'chuyen_khoan' ? 'CK' : 'TM');
const nf = (n) => fmt(Math.abs(Number(n) || 0));   // bước 81: số đầy đủ
export function debtLines(x) {
  if (!x) return '';
  const tao = x.tao || []; const thu = x.thu || [];
  const one = (d) => html`<span class="nl ${d.paid ? 'ok' : 'open'}">${noKind(d.kind)} ${d.name} ${nf(d.amount)} · ${d.collect_kind === 'gia_dinh' ? '→ công nợ gia đình' : d.paid ? `đã trả ${pk(d.collect_kind)} ca ${d.paid_shift || ''} ${dmS(d.paid_date)}` : 'chưa trả'}</span>`;
  const two = (d) => html`<span class="nl thu">Thu ${noKind(d.kind)} ${d.name} ${nf(d.amount)} (${pk(d.collect_kind)}, nợ ca ${d.from_shift || 'QL ghi'} ${dmS(d.from_date)})</span>`;
  return html`${tao.map(one)}${thu.map(two)}`;
}
// reps: [{ report_id, day, shift }] theo thứ tự bảng
export function debtSection(DEBT, reps) {
  const rows = []; reps.forEach((r) => { const x = DEBT.get(r.report_id); (x?.tao || []).forEach((d) => rows.push({ ...d, day: r.day, shift: r.shift, report_id: r.report_id })); });
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const days = (d) => Math.max(0, Math.round((Date.parse(today) - Date.parse(d)) / 864e5));
  const open = rows.filter((d) => !d.paid);
  return html`<section class="card nd-card"><div class="nd-h"><h2>Khách nợ trong tuần</h2><span class="st-meta">${rows.length ? html`${rows.length} khoản · <b class="${open.length ? 'neg' : ''}">còn ${open.length} chưa trả</b>` : 'Không có'}</span></div>
    ${rows.length ? html`<div class="nd-list">${rows.map((d) => html`<a class="nd-r ${d.paid ? 'ok' : 'open'}" href="#/ca/phieu?id=${d.report_id}">
        <span class="nd-w"><b>${dmS(d.day)}</b> · ca ${d.shift}</span>
        <span class="nd-n"><b>${d.name}</b> <span class="st-meta">${noKind(d.kind)}</span></span>
        <span class="nd-a">${nf(d.amount)}</span>
        <span class="nd-s">${d.collect_kind === 'gia_dinh' ? '→ Chuyển công nợ gia đình' : d.paid ? `✓ Đã trả ${pk(d.collect_kind)} · ca ${d.paid_shift || ''} ${dmS(d.paid_date)}` : `Chưa trả · ${days(d.day)} ngày`}</span></a>`)}</div>` : ''}
    <div class="st-meta">Khoản nợ còn từ các tuần trước: quản lý xem ở Quản lý ca › Công nợ.</div></section>`;
}
export const ND_CSS = html`<style>
  .nl { display: block; font-size: 12.5px; font-weight: 700; border-radius: 6px; padding: 2px 6px; margin-top: 3px; line-height: 1.4; overflow-wrap: anywhere; }
  .nl.open { background: #fee2e2; color: #991b1b; } .nl.ok { background: #fff; color: var(--ok-ink); border: 1px solid #b7d8ab; } .nl.thu { background: var(--info-bg); color: var(--info-ink); }
  .nd-card { padding: 14px; display: flex; flex-direction: column; gap: 8px; } .nd-h { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline; } .nd-h h2 { margin: 0; font-size: 17px; }
  .nd-h .neg { color: #b91c1c; }
  .nd-list { display: flex; flex-direction: column; }
  .nd-r { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto minmax(0, 220px); gap: 4px 10px; align-items: center; padding: 8px 6px; border-top: 1px solid var(--line-soft); text-decoration: none; color: inherit; font-size: 14px; }
  .nd-r:hover { background: var(--subtle); } .nd-a { font-weight: 800; font-variant-numeric: tabular-nums; }
  .nd-r.open .nd-s { color: #991b1b; font-weight: 700; } .nd-r.ok .nd-s { color: var(--ok-ink); font-weight: 600; }
  @media (max-width: 640px) { .nd-r { grid-template-columns: minmax(0, 1fr) auto; } .nd-w { grid-column: 1 / -1; font-size: 12px; color: var(--muted); } .nd-s { grid-column: 1 / -1; font-size: 13px; } }
</style>`;

export const NB_CSS = html`<style>
  .nb { display: inline-block; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 0 5px; margin-top: 2px; line-height: 1.5; white-space: nowrap; }
  .nb.open { background: #fee2e2; color: #991b1b; } .nb.ok { background: var(--ok-bg); color: var(--ok-ink); } .nb.thu { background: var(--info-bg); color: var(--info-ink); }
</style>`;


export function dayName(iso) {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return WEEKDAYS[(d + 6) % 7];
}

export function datePicker(path, day, extra = '') {
  const today = vnToday();
  return html`<section class="card toolbar ca-date" style="padding:12px 14px;gap:8px">
    <a class="btn sm secondary" href="#${path}?ngay=${addDays(day, -1)}${extra}" aria-label="Ngày trước">‹</a>
    <div style="flex:1;text-align:center;min-width:140px"><div style="font-weight:700">${dayName(day)} ${dmy(day)}</div>
      ${day === today ? html`<div style="font-size:12px;color:var(--primary)">Hôm nay</div>` : html`<a href="#${path}?ngay=${today}${extra}" style="font-size:12px">Về hôm nay</a>`}</div>
    <a class="btn sm secondary" href="#${path}?ngay=${addDays(day, 1)}${extra}" aria-label="Ngày sau">›</a>
    <input class="input sm ca-date-input" type="date" value="${day}" aria-label="Chọn ngày" style="width:150px" data-path="${path}" data-extra="${extra}">
  </section>`;
}
export function bindDatePicker() {
  $$('.ca-date-input').forEach((i) => i.addEventListener('change', () => { if (i.value) go(`${i.dataset.path}?ngay=${i.value}${i.dataset.extra}`); }));
}

// Bước 76 (anh Tiến chốt 13/11): xem theo TUẦN, mỗi lần 1 cơ sở — hàng = ngày (Thứ 2 → CN), cột = ca;
// ô ca: màu + chữ ngắn (Xong / Đang chốt / Chưa mở / Thiếu phiếu) + tiền mặt / chuyển khoản lệch; ngày đã qua chưa mở phiếu → đỏ "Thiếu phiếu", bấm để mở bù.
const LS_BR = 'tcBranch';
const START = '2026-11-01';   // ngày bắt đầu dùng web — trước ngày này không báo "Thiếu phiếu"
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const kfmt = (n) => { const v = Number(n) || 0; return (v < 0 ? '−' : v > 0 ? '+' : '') + fmt(Math.abs(v)); };   // bước 81: ghi số đầy đủ

export async function render({ params }) {
  const today = vnToday();
  const wk = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(params.tuan || '') ? params.tuan : /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : today);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(wk, i));
  const all = await Promise.all(days.map((d) => rpc('app_ca_overview', { p_date: d }).then((rows) => rows.map((r) => ({ ...r, day: d })))));
  const branches = [];
  all.flat().forEach((r) => { if (!branches.some((b) => b.id === r.branch_id)) branches.push({ id: r.branch_id, code: r.branch_code, name: r.branch_name }); });
  const has = (v) => branches.some((b) => String(b.id) === String(v));
  const cn = has(params.cn) ? Number(params.cn) : has(lsGet()) ? Number(lsGet()) : branches[0]?.id;
  if (cn) lsSet(cn);
  const BR = branches.find((b) => b.id === cn) || { code: '', name: '' };
  const mine = all.map((rows) => rows.filter((r) => r.branch_id === cn));
  // Đối soát về Chốt ca (thiết kế 22/11, tệp 164): trạng thái Việc · Tiền từng ca + ca chưa xong — chỉ người đối soát được cơ sở này (không quyền → [])
  const [DW, DSL, CON] = cn ? await Promise.all([rpc('app_ca_debt_week', { p_branch: cn, p_from: days[0], p_to: days[6] }).catch(() => []),
    rpc('app_ca_ds_tuan', { p_branch: cn, p_from: days[0], p_to: days[6] }).catch(() => []), rpc('app_ca_ds_con', { p_branch: cn }).catch(() => [])]) : [[], [], []];
  const DEBT = new Map((DW || []).map((x) => [x.report_id, x]));   // bước 79
  const DSW = new Map((DSL || []).map((x) => [Number(x.id), x]));
  const conOk = (CON || []).filter((x) => x.st !== 'kt');
  const nKt = (CON || []).length - conOk.length;
  const shifts = []; mine.flat().forEach((r) => { if (!shifts.includes(r.shift)) shifts.push(r.shift); });
  const q = (o) => '#/ca?' + Object.entries({ tuan: wk, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const nDone = mine.flat().filter((s) => s.status === 'hoan_thanh').length;
  const nMiss = mine.flat().filter((s) => !s.report_id && s.day < today && s.day >= START).length;
  const cell = (s, d) => {
    if (!s) return html`<td class="cw-na">—</td>`;
    const miss = !s.report_id && d < today && d >= START;
    const [cls, lb] = s.status === 'hoan_thanh' ? ['ok', 'Xong'] : s.report_id ? ['warn', 'Đang chốt'] : miss ? ['miss', 'Thiếu phiếu'] : ['none', 'Chưa mở'];
    // bước 80: hiện lại tiền mặt / chuyển khoản âm dương dưới trạng thái
    const money = s.status === 'hoan_thanh' && s.cash_left != null ? html`<span class="cw-m"><span class="${Number(s.cash_left) < 0 ? 'neg' : Number(s.cash_left) > 0 ? 'pos' : ''}">TM ${kfmt(s.cash_left)}</span><span class="${Number(s.transfer_left) < 0 ? 'neg' : Number(s.transfer_left) > 0 ? 'pos' : ''}">CK ${kfmt(s.transfer_left)}</span></span>` : '';
    const x = s.report_id ? DSW.get(Number(s.report_id)) : null;   // người đối soát: thay "Xong" bằng Việc · Tiền
    const k = x ? dsKind(x) : null;   // anh Tiến 28/11: màu ô theo đối soát — xong hẳn / quản lý đã làm, đang chờ / quản lý còn việc / chờ kế toán
    const st = x ? (k.k === 'done' ? html`<span class="cw-st">✓ Đã đối soát xong</span>`
      : html`<span class="cw-st">${DSLB[k.k]}</span>${k.why.map((w) => html`<span class="cw-why">${w}</span>`)}<span class="cw-vt"><span class="cw-dv">Việc ${x.viec?.xong ? '✓' : '–'}</span><span class="cw-dt">Tiền ${TSYM[x.tien?.st] || '…'}</span></span>`) : html`<span class="cw-st">${lb}</span>`;
    const tip = x && x.recon !== 'hoan_thanh' ? ` · Việc: ${x.viec?.xong ? 'xong' : 'còn ' + (x.viec?.thieu || []).join(', ')} · Tiền: ${TTXT[x.tien?.st] || ''}${(x.tien?.thieu || []).length ? ' (thiếu ' + x.tien.thieu.join(', ') + ')' : ''}` : '';
    return html`<td><button type="button" class="ca-shift cw-c ${cls} ${k ? 'ds-' + k.k : ''} ${x && x.recon === 'hoan_thanh' ? 'dsok' : ''}" ${k ? html`data-dsk="${k.k}"` : ''} data-b="${s.branch_id}" data-s="${s.shift}" data-d="${d}" data-id="${s.report_id || ''}" ${x ? html`data-ds="1" data-tab="${x.tab || 'viec'}"` : ''} title="Ca ${s.shift} ${dmy(d)}${s.completed_by ? ' · chốt: ' + s.completed_by : ''}${tip}">
      ${st}${money}${s.report_id ? debtLines(DEBT.get(s.report_id)) : ''}</button></td>`;
  };
  const body = html`${STYLE}${WSTYLE}${NB_CSS}${ND_CSS}
    <section class="card cw-bar">
      <nav class="branch-tabs" aria-label="Cơ sở">${branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav>
      <div class="cw-wk"><a class="btn sm secondary" href="${q({ tuan: addDays(wk, -7) })}" aria-label="Tuần trước">‹</a>
        <div class="cw-wt"><b>${dmy(days[0]).slice(0, 5)} – ${dmy(days[6])}</b>${today >= days[0] && today <= days[6] ? html`<span class="pill info">Tuần này</span>` : html`<a href="${q({ tuan: weekStart(today) })}">Về tuần này</a>`}</div>
        <a class="btn sm secondary" href="${q({ tuan: addDays(wk, 7) })}" aria-label="Tuần sau">›</a></div></section>
    ${!branches.length ? html`<div class="card">Chưa có cơ sở nào bật ca làm việc.</div>` : html`
    <section class="card cw-card"><div class="cw-h"><h2>${BR.code} – ${BR.name}</h2><span class="st-meta">${nDone} phiếu xong${nMiss ? html` · <b class="neg">${nMiss} thiếu phiếu</b>` : ''}</span></div>
      ${(CON || []).length ? html`<div class="cw-con">Còn <b>${CON.length} ca chưa đối soát xong</b>${nKt ? ` (${nKt} ca chờ kế toán)` : ''}${conOk.length
        ? html` · <a href="#/ca/doi-soat?id=${conOk[0].id}&tab=${conOk[0].tab || 'viec'}">Làm ca cũ nhất ›</a>` : ' · các ca còn lại đều chờ kế toán'}</div>` : ''}
      ${DSW.size ? html`<div class="cw-sum">${dsSum([...DSW.values()])}</div>` : ''}
      <div class="cw-wrap"><table class="cw-t"><thead><tr><th></th>${shifts.map((s) => html`<th>${s}</th>`)}</tr></thead>
        <tbody>${days.map((d, i) => html`<tr class="${d === today ? 'today' : ''}"><th><b>${WEEKDAYS[i].replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</b><span>${dmy(d).slice(0, 5)}</span></th>
          ${shifts.map((sh) => cell(mine[i].find((r) => r.shift === sh), d))}</tr>`)}</tbody></table></div>
      ${DSW.size ? html`<div class="cw-lg"><span class="cw-c ds-done">Đã đối soát xong</span><span class="cw-c ds-hold">QL đã bấm Hoàn thành, còn thiếu dấu / chờ Chủ duyệt</span><span class="cw-c ds-wait">QL chưa đối soát xong</span><span class="cw-c ds-kt">Chờ kế toán</span></div>` : ''}
      <div class="cw-lg">${DSW.size ? '' : html`<span class="cw-c ok">Xong</span>`}<span class="cw-c warn">Đang chốt</span><span class="cw-c none">Chưa mở</span><span class="cw-c miss">Thiếu phiếu</span><span class="st-meta">TM / CK: tiền mặt / chuyển khoản lệch (âm = thiếu, dương = dư). Đỏ: khách nợ chưa trả · xanh: đã trả (ghi ca trả) · xanh dương: ca thu nợ. Bấm ô để mở phiếu.</span></div>
      ${DSW.size ? html`<div class="cw-lg cw-lgds st-meta"><b>Đối soát:</b> Việc ✓ xong · – còn việc &nbsp;|&nbsp; Tiền ⏳ chờ kế toán · 🔴 ô đỏ (mở ca / doanh thu / nợ) · 🔵 chờ xác nhận Fabi · 🟡 chưa bấm Hoàn thành · 🟠 còn chênh lệch chờ xử lý · ✓ xong. Bấm ô để đối soát ca đó.</div>` : ''}</section>
    ${debtSection(DEBT, days.flatMap((d, i) => shifts.map((sh) => mine[i].find((r) => r.shift === sh)).filter((s) => s && s.report_id).map((s) => ({ report_id: s.report_id, day: d, shift: s.shift }))))}`}`;
  return {
    title: 'Chốt ca',
    html: isManager() ? html`<div class="page-head"><div><h1>Chốt ca</h1><div class="sub">Xem theo tuần, từng cơ sở: nhân viên chốt ca, quản lý đối soát. Ô đỏ là ngày đã qua mà chưa có phiếu.</div></div></div><div class="stack" style="max-width:1200px;gap:12px">${body}</div>`
      : html`<div class="stack" style="gap:12px">${body}</div>`,
    mount() {
      $$('.cw-c[data-b]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.id) return go(b.dataset.ds ? `/ca/doi-soat?id=${b.dataset.id}&tab=${b.dataset.tab || 'viec'}` : `/ca/phieu?id=${b.dataset.id}`);   // người đối soát → trang đối soát của ca
        const d = b.dataset.d;
        if (!confirm(`Mở phiếu chốt ca ${b.dataset.s} ngày ${dmy(d)}${d < vnToday() ? ' (phiếu bổ sung)' : ''}?`)) return;
        b.disabled = true;
        try { const id = await rpc('app_ca_open', { p_branch: Number(b.dataset.b), p_date: d, p_shift: b.dataset.s }); go(`/ca/phieu?id=${id}`); }
        catch (e) { b.disabled = false; showSaved(e.message, true); }
      }));
    },
  };
}

// Đối soát về Chốt ca: ký hiệu dòng Tiền (giống Đối soát Fabi)
const TSYM = { kt: '⏳', red: '🔴', xn: '🔵', ht: '🟡', lech: '🟠', ok: '✓' };   // 🟠: anh Tiến chốt 23/11
const TTXT = { kt: 'chờ kế toán', red: 'còn ô đỏ (mở ca / doanh thu / nợ)', xn: 'chờ xác nhận Fabi', ht: 'chưa bấm Hoàn thành', lech: 'còn chênh lệch chờ xử lý / chờ Chủ duyệt', ok: 'xong' };
// Anh Tiến 28/11: xếp loại ô ca theo AI đang giữ việc (chỉ hiển thị — đọc đúng trạng thái máy chủ trả, không đổi luật).
//   done = đã đối soát xong · kt = chờ kế toán · wait = quản lý còn việc (dấu phần việc, ô đỏ, xác nhận Fabi, bấm Hoàn thành)
//   hold = quản lý đã bấm Hoàn thành, còn: mục tiền thiếu dấu (🟠), Chủ duyệt x2
const DSLB = { hold: 'QL đã đối soát', wait: 'QL chưa đối soát', kt: 'Chờ kế toán' };
const X2 = 'Chờ Chủ duyệt x2';
export function dsKind(x) {
  if (x.recon === 'hoan_thanh') return { k: 'done', why: [] };
  const t = x.tien?.st, thieu = x.viec?.thieu || [];
  if (t === 'kt') return { k: 'kt', why: [] };
  if (thieu.some((v) => v !== X2) || (!x.viec?.xong && !thieu.length) || !['lech', 'ok'].includes(t)) return { k: 'wait', why: [] };
  const why = [];
  if (t === 'lech') why.push((x.tien?.thieu || []).length ? 'Thiếu dấu: ' + x.tien.thieu.join(', ') : 'Còn mục tiền chưa có dấu');   // 28/11: ghi đúng dấu đang thiếu (không ca nào "chờ tiền về")
  if (thieu.includes(X2)) why.push(X2);
  return { k: 'hold', why: why.length ? why : ['Chờ hoàn tất'] };
}
function dsSum(list) {
  const n = { done: 0, hold: 0, wait: 0, kt: 0 }; list.forEach((x) => { n[dsKind(x).k] += 1; });
  return html`Tuần này: <b class="s-done">${n.done} ca xong</b> · <b class="s-hold">${n.hold} ca QL đã bấm Hoàn thành, còn thiếu dấu / chờ duyệt</b> · <b class="s-wait">${n.wait} ca QL chưa đối soát</b>${n.kt ? html` · <b class="s-kt">${n.kt} ca chờ kế toán</b>` : ''}`;
}
const WSTYLE = html`<style>
  .cw-c.cw-c.ds-done { background: #1f8a4c; border-color: #1f8a4c; color: #fff; } .cw-c.cw-c.ds-done .cw-st, .cw-c.cw-c.ds-done .cw-m, .cw-c.cw-c.ds-done .cw-m span { color: #fff; } .cw-c.cw-c.ds-done .cw-m .neg { color: #ffd9d4; }
  .cw-c.cw-c.ds-hold { background: #dbe9fb; border-color: #7fa9e3; color: #123f7a; }
  .cw-c.cw-c.ds-wait { background: #fff1c7; border-color: #e6bd4a; color: #6b4a00; }
  .cw-c.cw-c.ds-kt { background: #ece4f7; border-color: #b79ee0; color: #47307a; }
  .cw-why { display: block; font-size: 12px; font-weight: 700; line-height: 1.3; } .cw-vt { display: flex; flex-wrap: wrap; gap: 0 8px; opacity: .85; }
  .cw-sum { font-size: 14px; overflow-wrap: anywhere; } .cw-sum .s-done { color: #166534; } .cw-sum .s-hold { color: #123f7a; } .cw-sum .s-wait { color: #8a5a00; } .cw-sum .s-kt { color: #47307a; }
  .cw-dv, .cw-dt { font-size: 12px; font-weight: 600; line-height: 1.35; }
  .cw-con { font-size: 14px; padding: 8px 10px; border-radius: 8px; background: var(--warn-bg, #fff7e6); border: 1px solid var(--warn-line, #f3d19c); overflow-wrap: anywhere; }
  .cw-lgds { font-size: 12px; }
  .cw-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; }
  .cw-wk { display: flex; align-items: center; gap: 8px; } .cw-wt { display: flex; flex-direction: column; align-items: center; min-width: 130px; font-size: 13px; }
  .cw-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .cw-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; } .cw-h h2 { margin: 0; font-size: 17px; }
  .cw-wrap { overflow-x: auto; }
  .cw-t { width: 100%; min-width: 620px; border-collapse: separate; border-spacing: 5px; table-layout: fixed; }
  .cw-t thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 700; }
  .cw-t thead th:first-child { width: 58px; }
  .cw-t tbody th { text-align: left; font-size: 13px; font-weight: 400; color: var(--ink-2); }
  .cw-t tbody th b { display: block; } .cw-t tbody th span { font-size: 11px; color: var(--muted); }
  .cw-t tr.today th { color: var(--primary); } .cw-t tr.today th span { color: var(--primary); }
  .cw-t td { padding: 0; vertical-align: top; height: 1px; } .cw-na { text-align: center; color: var(--muted); }
  .cw-c { width: 100%; height: 100%; min-height: 56px; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; align-items: stretch; justify-content: flex-start; font: inherit; cursor: pointer; border: 1px solid var(--line); text-align: left; }
  .cw-c.ok { background: var(--ok-bg); border-color: #b7d8ab; color: var(--ok-ink); } .cw-c.warn { background: var(--warn-bg); border-color: #f6d58a; color: var(--warn-ink); }
  .cw-c.none { background: #fff; color: var(--muted); } .cw-c.miss { background: var(--off-bg); border-color: #f3b4ad; color: #991b1b; }
  .cw-st { font-size: 14px; font-weight: 800; } .cw-m { display: flex; flex-direction: column; font-size: 13px; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; line-height: 1.3; }
  .cw-m .neg, .cw-h .neg { color: #b91c1c; } .cw-m .pos { color: var(--ok-ink); }
  .cw-lg { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } .cw-lg .cw-c { width: auto; height: auto; min-height: 0; padding: 2px 8px; font-size: 12px; font-weight: 700; cursor: default; }
  /* rà soát 20/11: điện thoại thấy đủ 3 ca, không phải vuốt ngang */
  @media (max-width: 560px) { .cw-t { border-spacing: 3px; min-width: 0; } .cw-c { padding: 6px 5px; overflow-wrap: anywhere; } .cw-t thead th:first-child { width: 42px; } .cw-st { font-size: 12.5px; } .cw-m { font-size: 11.5px; } }
</style>`;

export const STYLE = html`<style>
  .ca-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  @media (max-width: 560px) { .ca-grid { grid-template-columns: minmax(0, 1fr); } }
  .ca-shift { text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; font: inherit; color: var(--ink); }
  .ca-shift:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  .ca-shift-top { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
  .ca-time, .ca-who { font-size: 12px; color: var(--muted); }
  .ca-diff { font-size: 12px; font-weight: 600; color: var(--ink-2); }
  .ca-date { display: grid !important; grid-template-columns: 48px minmax(0, 1fr) 48px auto; align-items: center; }
  .ca-date .btn { min-width: 44px; padding: 0; }
  @media (max-width: 560px) { .ca-date { grid-template-columns: 48px minmax(0, 1fr) 48px; } .ca-date .ca-date-input { grid-column: 1 / -1; width: 100% !important; } }
</style>`;
