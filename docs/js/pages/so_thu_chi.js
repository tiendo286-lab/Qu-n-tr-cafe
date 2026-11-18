// Sổ thu chi (mới) — đợt 1 CHỈ XEM, chạy song song trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ).
// 4 tab: Tổng · Đối soát tiền · Sổ thu · Sổ chi + Quỹ ngoài (chỉ Chủ). Mọi nút sửa đều tắt trong lúc chạy thử.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md · Hàm tính: ../so_thu_chi_tinh.js · Máy chủ: app_stc_month, app_stc_ext
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, fmt } from '../tien.js';
import { $, html, str } from '../ui.js';
import { ALERT, COLS, caChecks, caState, compareDays, dayChain, dayTree, fundSummary, sumItems } from '../so_thu_chi_tinh.js';

export const perm = 'chot_thang';
const TRIAL = 'Đang chạy thử — chưa sửa ở đây';
const PM = { tm: 'Tiền mặt', ck: 'Chuyển khoản' };
const TABS = [['tong', 'Tổng'], ['doi-soat', 'Đối soát tiền'], ['thu', 'Sổ thu'], ['chi', 'Sổ chi']];
const LS_BR = 'tcBranch';
const lsGet = () => { try { return localStorage.getItem(LS_BR); } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const monthLabel = (m) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 7); };
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const wd = (d) => WD[new Date(d + 'T00:00:00').getDay()];
const dm = (d) => dmy(d).slice(0, 5);
const sg = (book) => (book === 'thu' ? '+' : '−');
const colName = (book, k) => (COLS[book].find((c) => c[0] === k) || [k, k])[1];
const off = (label, cls = 'btn sm secondary') => html`<button type="button" class="${cls} stc-act" disabled title="${TRIAL}">${label}</button>`;

let CACHE = null;   // { key, at, D }
const OPEN_D = new Set(); const OPEN_C = new Set();
let P = {};         // tham số đang xem

async function load(cn, month) {
  const key = cn + '|' + month;
  if (CACHE && CACHE.key === key && Date.now() - CACHE.at < 60000) return CACHE.D;
  let D;
  if (cn === 'ngoai') {
    const E = await rpc('app_stc_ext', { p_month: month });
    D = { ...E, branch: { id: 'ngoai', code: 'Quỹ ngoài', name: 'Quỹ ngoài' }, cas: [], owner: true, open_debts: [], compare: { fund_days: [], gaps: [] }, ext: true };
  } else {
    D = await rpc('app_stc_month', { p_branch: Number(cn), p_month: month });
  }
  CACHE = { key, at: Date.now(), D };
  return D;
}

const q = (over = {}) => '#/quan-ly/so-thu-chi?' + new URLSearchParams(Object.entries({ ...P, ...over }).filter(([, v]) => v != null && v !== '')).toString();

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : vnToday().slice(0, 7);
  const cn = params.cn === 'ngoai' ? 'ngoai' : (params.cn || lsGet() || '1');
  const isExt = cn === 'ngoai';
  let tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'tong';
  if (isExt && tab === 'doi-soat') tab = 'tong';
  P = { tab, cn, thang: month, pm: params.pm === 'ck' ? 'ck' : 'tm', cot: params.cot || '' };
  let D;
  try { D = await load(cn, month); } catch (e) {
    return { title: 'Sổ thu chi (mới)', html: html`${STYLE}<div class="page-head"><h1>Sổ thu chi (mới)</h1></div><div class="alert warn">${e.message}</div>` };
  }
  if (!isExt) lsSet(D.branch.id);
  const head = html`<div class="page-head stc-head"><div><h1>Sổ thu chi (mới) · ${D.branch.code}</h1>
      <div class="st-meta"><span class="pill warn">${TRIAL}</span> Trang cũ vẫn dùng bình thường. Số liệu thật từ ${dmy(D.from)}.</div></div></div>
    <section class="card stc-bar">
      <div class="stc-month"><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a><strong>${monthLabel(month)}</strong><a class="btn sm secondary" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
      <nav class="branch-tabs" aria-label="Cơ sở">${(D.branches || []).map((b) => html`<a class="${String(cn) === String(b.id) ? 'on' : ''}" href="${q({ cn: b.id })}">${b.code}</a>`)}
        ${D.owner ? html`<a class="stc-qn ${isExt ? 'on' : ''}" href="${q({ cn: 'ngoai', tab: tab === 'doi-soat' ? 'tong' : tab })}">Quỹ ngoài</a>` : ''}</nav>
      <nav class="stc-tabs" aria-label="Tab">${TABS.filter((t) => !(isExt && t[0] === 'doi-soat')).map(([k, l]) => html`<a class="${tab === k ? 'on' : ''}" href="${q({ tab: k, cot: '' })}">${l}</a>`)}</nav>
    </section>`;
  const body = tab === 'thu' || tab === 'chi' ? bookPage(D, tab) : tab === 'tong' ? tongPage(D) : dsPage(D);
  return {
    title: `Sổ thu chi (mới) ${D.branch.code}`,
    html: html`${STYLE}<div id="stc-page">${head}${body}</div>`,
    mount() {
      const root = $('#stc-page'); if (!root) return;
      root.addEventListener('click', (ev) => {
        const t = ev.target.closest('[data-day],[data-ca],.stc-all,.stc-none'); if (!t || !root.contains(t)) return;
        if (t.dataset.day) { OPEN_D.has(t.dataset.day) ? OPEN_D.delete(t.dataset.day) : OPEN_D.add(t.dataset.day); }
        else if (t.dataset.ca) { OPEN_C.has(t.dataset.ca) ? OPEN_C.delete(t.dataset.ca) : OPEN_C.add(t.dataset.ca); }
        else if (t.classList.contains('stc-all')) { D.items.forEach((x) => { OPEN_D.add(x.date); if (x.ca_id) OPEN_C.add(String(x.ca_id)); }); (D.cas || []).forEach((c) => { OPEN_D.add(c.date); OPEN_C.add(String(c.id)); }); }
        else { OPEN_D.clear(); OPEN_C.clear(); }
        const b = $('#stc-book'); if (b && (P.tab === 'thu' || P.tab === 'chi')) b.innerHTML = str(bookCard(D, P.tab));
      });
    },
  };
}

// ---------------- Sổ thu / Sổ chi ----------------
function itemRow(x, book) {
  const pills = [];
  if (x.from) pills.push(html`<span class="st-meta">Nợ từ ${x.from}</span>`);
  if (x.status) pills.push(html`<span class="pill ${x.recv === 'cho' || /Chờ/.test(x.status) ? 'warn' : /Đã/.test(x.status) ? 'ok' : 'mute'}">${x.status}</span>`);
  if (book === 'chi' && x.col === 'chi') {
    pills.push(x.cat ? html`<span class="pill mute">${x.cat}</span>` : html`<span class="pill warn">Chưa phân loại</span>`);
    if (x.no_cost) pills.push(html`<span class="pill stc-nc">Không tính chi phí</span>`);
  }
  if (x.chia) pills.push(html`<span class="pill info">${x.chia}</span>`);
  return html`<div class="stc-it"><span class="stc-tag t-${x.col}">${colName(book, x.col)}</span>
    <div class="stc-itb"><div class="stc-itt">${x.title}</div><div class="st-meta">${x.meta || ''}</div>${pills.length ? html`<div class="stc-pills">${pills}</div>` : ''}</div>
    <span class="stc-amt ${book}">${sg(book)}${fmt(x.amount)}</span></div>`;
}
function cells(byCol, book, totalV) {
  return html`${COLS[book].map(([k]) => html`<span class="stc-c ${byCol[k] ? '' : 'z'}">${byCol[k] ? fmt(byCol[k]) : '–'}</span>`)}<span class="stc-c tot">${fmt(totalV)}</span>
    <span class="stc-chips">${COLS[book].filter(([k]) => byCol[k]).map(([k, l]) => html`<span>${l} <b>${fmt(byCol[k])}</b></span>`)}</span>`;
}
function bookCard(D, book) {
  const days = dayTree(D, book, P.pm, P.cot || null);
  const n = COLS[book].length;
  const caLabel = (c) => (c.shift === 'Ngoài ca' ? 'Ngoài ca' : 'Ca ' + c.shift);
  const rows = days.map((d) => {
    const o = OPEN_D.has(d.date);
    const cas = [...d.cas, ...(d.outside.items.length ? [{ caId: 'o:' + d.date, shift: 'Ngoài ca', staff: 'Quản lý ghi', total: d.outside.total, byCol: d.outside.byCol, items: d.outside.items }] : [])];
    return html`<div class="stc-day ${o ? 'open' : ''}"><button type="button" class="stc-drow stc-g" style="--n:${n}" data-day="${d.date}" aria-expanded="${o}">
        <span class="stc-lab"><span class="stc-chev">›</span>${dm(d.date)} <small>${wd(d.date)}</small></span>${cells(d.byCol, book, d.total)}</button>
      ${o ? html`<div class="stc-cas">${cas.map((c) => { const co = OPEN_C.has(String(c.caId)); return html`<div class="stc-ca ${co ? 'open' : ''}">
          <button type="button" class="stc-crow stc-g" style="--n:${n}" data-ca="${c.caId}" aria-expanded="${co}"><span class="stc-lab"><span class="stc-chev">›</span>${caLabel(c)} <small>${c.staff || ''}</small></span>${cells(c.byCol, book, c.total)}</button>
          ${co ? html`<div class="stc-its">${c.items.length ? c.items.map((x) => itemRow(x, book)) : html`<div class="st-meta stc-empty">Không có khoản ${book === 'thu' ? 'thu' : 'chi'} ${PM[P.pm].toLowerCase()}.</div>`}
            <div class="stc-it add">${off(`+ Thêm phiếu ${book} vào ${caLabel(c).toLowerCase()}`, 'btn sm secondary')}</div></div>` : ''}</div>`; })}</div>` : ''}</div>`;
  });
  return html`<div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[P.pm]} <small>${P.cot ? `chỉ hiện ${colName(book, P.cot)}` : 'theo ngày · bấm ngày để xem từng ca'}</small></h2>
      <span class="stc-tools">${P.cot ? html`<a class="btn sm secondary" href="${q({ cot: '' })}">Bỏ lọc</a>` : ''}<button type="button" class="btn sm secondary stc-all">Mở hết</button><button type="button" class="btn sm secondary stc-none">Thu gọn</button>${off('+ Thêm phiếu', 'btn sm')}</span></div>
    <div class="stc-g stc-hdr" style="--n:${n}"><span>Ngày</span>${COLS[book].map(([k, l]) => html`<span class="${P.cot === k ? 'hl' : ''}">${l}</span>`)}<span>Tổng ${book}</span></div>
    ${rows.length ? rows : html`<div class="stc-empty">Tháng này chưa có khoản nào.</div>`}`;
}
function bookSide(D, book) {
  const its = D.items.filter((x) => !x.void);
  const card = (title, list, empty, note = '') => html`<section class="card stc-side"><h3>${title}</h3>${list.length ? list : html`<div class="st-meta">${empty}</div>`}${note ? html`<div class="st-meta stc-note">${note}</div>` : ''}</section>`;
  const li = (x, extra = '') => html`<div class="stc-si"><span><b>${x.title}</b> <span class="stc-tag t-${x.pm}">${x.pm === 'tm' ? 'TM' : 'CK'}</span><br><span class="st-meta">${dm(x.date)}${x.from ? ' · nợ từ ' + x.from : ''}${x.status ? ' · ' + x.status : ''}${extra}</span></span><b class="stc-amt ${x.book}">${sg(x.book)}${fmt(x.amount)}</b></div>`;
  if (book === 'thu') {
    const no = its.filter((x) => x.book === 'thu' && x.col === 'no');
    const du = its.filter((x) => x.book === 'thu' && x.col === 'lech');
    const today = vnToday();
    const debts = (D.open_debts || []).map((d) => { const days = Math.max(0, Math.round((new Date(today) - new Date(d.date)) / 864e5)); return html`<div class="stc-si"><span><b>${d.who}</b> ${d.no_remind ? html`<span class="pill ok">✓ không nhắc</span>` : ''}<br><span class="st-meta">${d.from} · <span class="${days > 7 ? 'stc-red' : ''}">${days} ngày</span></span></span><b>${fmt(d.left)}</b></div>`; });
    return html`${card(`Thu nợ tháng này · ${fmt(sumItems(no))}`, no.map((x) => li(x)), 'Chưa có khoản thu nợ.')}${card('Ca dư tiền', du.map((x) => li(x)), 'Không có ca dư.')}
      ${card('Khách đang nợ', debts, 'Không còn ai nợ.', 'Gồm cả nợ hoá đơn (chưa phải tiền nên không nằm trong sổ). Đỏ khi quá 7 ngày.')}`;
  }
  const th = its.filter((x) => x.book === 'chi' && x.col === 'lech');
  const cn = its.filter((x) => x.book === 'chi' && x.col === 'no');
  const todo = its.filter((x) => x.book === 'chi' && x.col === 'chi' && !x.cat);
  const cost = its.filter((x) => x.book === 'chi' && x.col === 'chi' && x.cat && !x.no_cost);
  const groups = [...new Set(cost.map((x) => x.cat))].map((c) => [c, sumItems(cost.filter((x) => x.cat === c))]).sort((a, b) => b[1] - a[1]);
  const totalCost = sumItems(cost);
  return html`${card('Ca thiếu tiền', th.map((x) => li(x)), 'Không có ca thiếu.')}${card(`Cho nợ tháng này · ${fmt(sumItems(cn))}`, cn.map((x) => li(x)), 'Chưa có khoản cho nợ.')}
    ${card(`Cần phân loại · ${todo.length} khoản`, todo.map((x) => li(x)), 'Đã phân loại hết.')}
    ${card(`Chi theo nhóm · ${fmt(totalCost)}`, groups.map(([c, v]) => html`<div class="stc-ty"><span>${c}</span><b>${fmt(v)}</b><i style="width:${totalCost ? Math.round(v / totalCost * 100) : 0}%"></i></div>`), 'Chưa có khoản chi.',
      `Không cộng ${fmt(sumItems(its.filter((x) => x.book === 'chi' && x.col === 'chi' && x.no_cost)))} của các khoản Không tính chi phí. Chi phí Quỹ ngoài và tiền hàng kho tổng xem ở Chốt tháng.`)}`;
}
function bookPage(D, book) {
  const its = D.items;
  const pays = ['tm', 'ck'].map((pm) => html`<a class="stc-pay ${P.pm === pm ? 'on' : ''}" href="${q({ pm })}"><span class="k">Bảng ${PM[pm]}</span><span class="v">${sg(book)}${fmt(sumItems(its, { book, pm }))}</span><span class="s">Tổng ${book} ${monthLabel(P.thang).toLowerCase()}</span></a>`);
  const tiles = COLS[book].map(([k, l]) => {
    const v = sumItems(its, { book, pm: P.pm, col: k });
    let s = '';
    if (book === 'chi' && k === 'chi') { const nc = sumItems(its.filter((x) => x.no_cost && x.col === 'chi' && x.book === 'chi' && x.pm === P.pm)); if (nc) s = `trong đó ${fmt(nc)} không tính chi phí`; }
    return html`<a class="stc-tile ${P.cot === k ? 'on' : ''}" data-col="${k}" href="${q({ cot: P.cot === k ? '' : k })}"><span class="stc-tag t-${k}">${l}</span><b>${fmt(v)}</b><small>${s}</small></a>`;
  });
  return html`<div class="stc-pays">${pays}</div>
    <div class="st-meta stc-formula"><b>Tổng ${book}</b> = ${COLS[book].map(([, l], i) => html`${i ? ' + ' : ''}<b>${l}</b>`)}</div>
    <div class="stc-tiles">${tiles}<div class="stc-tile tot"><span>Tổng ${book} · ${PM[P.pm]}</span><b>${fmt(sumItems(its, { book, pm: P.pm }))}</b><small>bấm ô để lọc sổ</small></div></div>
    <div class="stc-layout"><section class="card stc-book" id="stc-book">${bookCard(D, book)}</section><aside class="stc-aside">${bookSide(D, book)}</aside></div>`;
}

// ---------------- Tổng (Task 6) / Đối soát tiền (Task 7) ----------------
function tongPage(D) { return html`<section class="card stc-empty">Tab Tổng đang làm.</section>`; }
function dsPage(D) { return html`<section class="card stc-empty">Tab Đối soát tiền đang làm.</section>`; }

const STYLE = html`<style>
  .stc-bar { display: flex; flex-direction: column; gap: 10px; }
  .stc-month { display: flex; align-items: center; gap: 8px; }
  .stc-month strong { min-width: 110px; text-align: center; }
  .stc-qn { border-style: dashed !important; }
  .stc-tabs { display: flex; gap: 4px; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 8px; }
  .stc-tabs a { padding: 8px 14px; border-radius: 10px; font-weight: 700; color: var(--muted); text-decoration: none; }
  .stc-tabs a.on { background: var(--caramel-soft); color: var(--primary); }
  .stc-pays { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .stc-pay { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 16px; background: var(--card); border: 2px solid var(--line); text-decoration: none; color: var(--ink); }
  .stc-pay.on { border-color: var(--primary); background: var(--caramel-soft); }
  .stc-pay .k { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .stc-pay .v { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stc-pay .s { font-size: 12px; color: var(--muted); }
  .stc-formula { margin: 10px 2px; }
  .stc-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .stc-tile { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 14px; background: var(--card); border: 1px solid var(--line); text-decoration: none; color: var(--ink); }
  .stc-tile.on { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
  .stc-tile b { font-size: 17px; font-variant-numeric: tabular-nums; }
  .stc-tile small { color: var(--muted); font-size: 11.5px; }
  .stc-tile.tot { background: var(--subtle); }
  .stc-layout { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 14px; align-items: start; margin-top: 14px; }
  .stc-book { padding: 0; overflow: hidden; }
  .stc-ch { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 14px; border-bottom: 1px solid var(--line); }
  .stc-ch h2 { margin: 0; font-size: 16px; } .stc-ch small { color: var(--muted); font-weight: 500; font-size: 12.5px; }
  .stc-tools { display: flex; gap: 6px; flex-wrap: wrap; }
  .stc-g { display: grid; grid-template-columns: minmax(110px, 1.2fr) repeat(var(--n), minmax(0, 1fr)) minmax(0, 1.1fr); column-gap: 8px; align-items: center; }
  .stc-hdr { padding: 8px 14px; font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; border-bottom: 1px solid var(--line); }
  .stc-hdr span:not(:first-child) { text-align: right; } .stc-hdr .hl { color: var(--primary); }
  .stc-day { border-bottom: 1px solid var(--line-soft); }
  .stc-drow, .stc-crow { width: 100%; background: none; border: 0; padding: 11px 14px; text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .stc-crow { padding-left: 28px; }
  .stc-drow:hover, .stc-crow:hover { background: var(--subtle); }
  .stc-lab { display: flex; gap: 6px; align-items: center; font-weight: 700; min-width: 0; }
  .stc-lab small { color: var(--muted); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stc-chev { display: inline-block; width: 12px; color: var(--muted); transition: transform .15s; }
  .open > button .stc-chev { transform: rotate(90deg); }
  .stc-c { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stc-c.z { color: var(--line-strong); } .stc-c.tot { font-weight: 800; color: var(--ink); }
  .stc-chips { display: none; }
  .stc-cas { background: var(--subtle); padding: 2px 0 6px; }
  .stc-its { margin: 0 10px 8px 28px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  .stc-it { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 4px 10px; padding: 9px 12px; border-bottom: 1px solid var(--line-soft); align-items: start; }
  .stc-it:last-child { border-bottom: 0; } .stc-it.add { display: block; background: var(--subtle); }
  .stc-itt { font-weight: 600; }
  .stc-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
  .stc-amt { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .stc-amt.thu { color: var(--ok-ink); } .stc-amt.chi { color: var(--off-ink); }
  .stc-tag { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 8px; white-space: nowrap; justify-self: start; background: var(--line-soft); color: var(--ink-2); }
  .t-dt, .t-ck { background: var(--info-bg); color: var(--info-ink); } .t-no { background: var(--plum-bg); color: var(--plum-ink); }
  .t-khac { background: var(--ok-bg); color: var(--ok-ink); } .t-lech { background: var(--warn-bg); color: var(--warn-ink); } .t-chi { background: var(--off-bg); color: var(--off-ink); }
  .stc-nc { background: var(--line-soft); color: var(--muted); border: 1px dashed var(--line-strong); }
  .stc-empty { padding: 16px 14px; color: var(--muted); }
  .stc-aside { display: flex; flex-direction: column; gap: 12px; }
  .stc-side h3 { margin: 0 0 6px; font-size: 15px; }
  .stc-si { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line-soft); }
  .stc-si:last-of-type { border-bottom: 0; }
  .stc-note { margin-top: 8px; } .stc-red { color: var(--off-ink); font-weight: 700; }
  .stc-ty { position: relative; display: flex; justify-content: space-between; padding: 6px 0 9px; }
  .stc-ty i { position: absolute; left: 0; bottom: 2px; height: 4px; border-radius: 3px; background: var(--primary); }
  @media (max-width: 980px) { .stc-layout { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 720px) {
    .stc-hdr { display: none; }
    .stc-g { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 8px; }
    .stc-g .stc-c:not(.tot) { display: none; } .stc-c.tot { margin-left: auto; }
    .stc-lab { flex: 1 1 auto; }
    .stc-chips { display: flex; flex-wrap: wrap; gap: 2px 10px; flex-basis: 100%; font-size: 12px; color: var(--muted); padding-left: 18px; }
    .stc-crow { padding-left: 18px; } .stc-its { margin: 0 6px 8px 10px; }
    .stc-it { grid-template-columns: minmax(0, 1fr) auto; } .stc-it .stc-tag { grid-column: 1 / 3; }
    .stc-pay .v { font-size: 18px; }
  }
</style>`;
