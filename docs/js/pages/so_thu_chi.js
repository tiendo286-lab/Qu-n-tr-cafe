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
        const ds = ev.target.closest('[data-dsca]');
        if (ds && root.contains(ds)) { DS_SEL = ds.dataset.dsca; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); return; }
        const t = ev.target.closest('[data-day],[data-ca],.stc-all,.stc-none'); if (!t || !root.contains(t)) return;
        if (t.dataset.day) { OPEN_D.has(t.dataset.day) ? OPEN_D.delete(t.dataset.day) : OPEN_D.add(t.dataset.day); }
        else if (t.dataset.ca) { OPEN_C.has(t.dataset.ca) ? OPEN_C.delete(t.dataset.ca) : OPEN_C.add(t.dataset.ca); }
        else if (t.classList.contains('stc-all')) { D.items.forEach((x) => { OPEN_D.add(x.date); OPEN_C.add(x.ca_id ? String(x.ca_id) : 'o:' + x.date); }); (D.cas || []).forEach((c) => { OPEN_D.add(c.date); OPEN_C.add(String(c.id)); }); }
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
function tongPage(D) {
  const F = fundSummary(D); const ext = !!D.ext; const name = ext ? 'Quỹ ngoài' : 'quỹ ' + D.branch.code;
  const hot = !ext && F.tm.ton > ALERT;
  const its = D.items.filter((x) => !x.void);
  // so với trang cũ: tồn quỹ theo ngày + lệch từng ca
  const cmpRows = [];
  if (!ext) {
    compareDays(D, F).forEach((r) => cmpRows.push(html`<div class="stc-cmpr"><span>${dm(r.date)} · ${r.pm === 'tm' ? 'Tiền mặt' : 'Tài khoản'}</span><span>cũ ${fmt(r.old)} → mới ${fmt(r.neu)}</span><b class="${r.diff < 0 ? 'stc-red' : ''}">${r.diff > 0 ? '+' : '−'}${fmt(Math.abs(r.diff))}</b></div>`));
    (D.compare?.gaps || []).forEach((g) => {
      const neu = its.filter((x) => x.col === 'lech' && x.ca_id === g.ca_id && x.pm === g.pm).reduce((a, x) => a + (x.book === 'thu' ? x.amount : -x.amount), 0);
      if (neu !== Number(g.lech)) { const c = (D.cas || []).find((x) => x.id === g.ca_id); cmpRows.push(html`<div class="stc-cmpr"><span>Lệch ca ${c ? c.shift + ' ' + dm(c.date) : g.ca_id} · ${g.pm === 'tm' ? 'TM' : 'CK'}</span><span>cũ ${g.lech < 0 ? '−' : ''}${fmt(Math.abs(g.lech))} → mới ${neu < 0 ? '−' : ''}${fmt(Math.abs(neu))}</span><b>${neu - g.lech > 0 ? '+' : '−'}${fmt(Math.abs(neu - g.lech))}</b></div>`); }
    });
  }
  const cmp = ext ? '' : html`<section class="card stc-cmp"><h3>So với trang cũ <small>(trong lúc chạy song song)</small></h3>
    ${cmpRows.length ? html`<div class="st-meta">Những chỗ trang mới khác Sổ quỹ / Lệch tiền ca cũ:</div>${cmpRows}` : html`<div class="pill ok">Khớp trang cũ ✓</div>`}
    <div class="st-meta stc-note">Khác dự kiến ở ngày quản lý từng sửa tay số nộp quỹ cuối ngày, và ngày hôm nay (kế toán chưa nhập đủ).</div></section>`;
  const big = (k, v, s, cls = '') => html`<div class="stc-big ${cls}"><span class="k">${k}</span><span class="v">${fmt(v)}</span><span class="s">${s}</span></div>`;
  const tf = (pm) => { const f = F[pm]; return html`<div class="stc-tf"><div class="h">${pm === 'tm' ? 'Tiền mặt' : 'Tài khoản'}</div>
      <div class="l"><span>Tồn đầu tháng</span><b>${fmt(f.open)}</b></div>
      <div class="l"><span>+ Tổng thu${ext ? ' (gồm tiền cơ sở chuyển về)' : ''} <a href="${q({ tab: 'thu', pm })}">Sổ thu ›</a></span><b class="stc-amt thu">+${fmt(f.thu)}</b></div>
      <div class="l"><span>− Tổng chi <a href="${q({ tab: 'chi', pm })}">Sổ chi ›</a></span><b class="stc-amt chi">−${fmt(f.chi)}</b></div>
      ${ext ? '' : html`<div class="l"><span>− Chuyển về Quỹ ngoài${F.waitQN.some((x) => x.pm === pm) ? html` <span class="pill warn">có khoản chờ Chủ nhận</span>` : ''}</span><b class="stc-amt chi">−${fmt(f.toQN)}</b></div>`}
      <div class="l t"><span>= Tồn quỹ</span><b class="${pm === 'tm' && hot ? 'stc-red' : ''}">${fmt(f.ton)}</b></div>
      ${pm === 'tm' && !ext ? html`<div class="st-meta">gồm 1.000.000 gối đầu trong két</div>` : ''}</div>`; };
  const daily = F.daily[P.pm];
  const incoming = ext ? its.filter((x) => x.src === 'withdrawal') : F.toQN;
  const waitN = (ext ? incoming.filter((x) => x.recv === 'cho') : F.waitQN).length;
  const notChot = (D.cas || []).filter((c) => !c.recon_money_done);
  const pend = its.filter((x) => x.col === 'lech' && x.status && /Chờ/.test(x.status));
  const todo = its.filter((x) => x.book === 'chi' && x.col === 'chi' && !x.cat);
  return html`${cmp}
    <div class="stc-bigs">${big(`Tồn ${name}`, F.tm.ton + F.ck.ton, `${ext ? 'Chỉ Chủ thấy · ' : ''}Tiền mặt + Tài khoản`)}
      ${big('Tiền mặt', F.tm.ton, hot ? `quá ${fmt(ALERT)} · nên chuyển về Quỹ ngoài` : ext ? 'Chủ giữ' : 'gồm 1.000.000 gối đầu trong két', hot ? 'hot' : '')}
      ${big('Tài khoản', F.ck.ton, 'theo sổ')}</div>
    <div class="st-meta stc-formula">${ext ? html`<b>Tồn Quỹ ngoài</b> = Tồn đầu tháng + Tổng thu (gồm tiền các cơ sở chuyển về) − Tổng chi (chi ngoài)`
      : html`<b>Tồn quỹ</b> = Tồn đầu tháng + Tổng thu − Tổng chi − Chuyển về Quỹ ngoài`}</div>
    <div class="stc-tiles">
      <div class="stc-tile"><span>${ext ? 'Các cơ sở chuyển về' : 'Chuyển về Quỹ ngoài'}</span><b>${fmt(sumItems(incoming))}</b><small>${incoming.length} lần</small></div>
      <div class="stc-tile ${waitN ? 'warn' : ''}"><span>Chờ Chủ nhận</span><b>${waitN}</b><small>khoản</small></div>
      ${ext ? '' : html`<div class="stc-tile ${notChot.length ? 'warn' : ''}"><span>Ca chưa chốt tiền</span><b>${notChot.length}</b><small>xem tab Đối soát tiền</small></div>
        <div class="stc-tile ${pend.length + todo.length ? 'warn' : ''}"><span>Chờ xử lý</span><b>${pend.length + todo.length}</b><small>lệch chờ xử lý + chi chưa phân loại</small></div>`}
    </div>
    <div class="stc-layout"><section class="card">
        <div class="stc-ch"><h2>Tồn ${name} <small>${monthLabel(P.thang)} · cách tính</small></h2></div>
        <div class="stc-tfs">${tf('tm')}${tf('ck')}</div>
        <div class="stc-tools stc-pad">${ext ? '' : off('+ Chuyển về Quỹ ngoài', 'btn sm')}${off('+ Luân chuyển tiền mặt ↔ tài khoản')}${off('Kiểm quỹ')}</div>
        <div class="stc-ch"><h2>Tồn quỹ theo ngày</h2><span class="stc-tools">${['tm', 'ck'].map((pm) => html`<a class="btn sm ${P.pm === pm ? '' : 'secondary'}" href="${q({ pm })}">${PM[pm]}</a>`)}</span></div>
        <div class="stc-dg stc-hdr"><span>Ngày</span><span>Đầu ngày</span><span>+ Thu</span><span>− Chi</span><span>${ext ? '' : '− Về Quỹ ngoài'}</span><span>Cuối ngày</span></div>
        ${daily.length ? daily.map((d) => html`<div class="stc-dg stc-dd"><span class="stc-lab">${dm(d.date)} <small>${wd(d.date)}</small></span><span class="stc-c">${fmt(d.start)}</span><span class="stc-c">${d.thu ? '+' + fmt(d.thu) : '–'}</span><span class="stc-c">${d.chi ? '−' + fmt(d.chi) : '–'}</span><span class="stc-c">${d.toQN ? '−' + fmt(d.toQN) : ''}</span><span class="stc-c tot end">${fmt(d.end)}</span></div>`)
          : html`<div class="stc-empty">Tháng này chưa có khoản nào.</div>`}
      </section>
      <aside class="stc-aside">
        <section class="card stc-side"><h3>${ext ? 'Tiền các cơ sở chuyển về' : 'Chuyển về Quỹ ngoài'} <small>${waitN} chờ Chủ nhận</small></h3>
          ${incoming.length ? incoming.map((x) => html`<div class="stc-si stc-qnl"><span><b>${ext ? (x.from || '') + ' · ' : ''}${x.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} · ${dm(x.date)}</b><br><span class="pill ${x.recv === 'cho' ? 'warn' : 'ok'}">${x.status || ''}</span> ${x.recv === 'cho' ? off('Đã nhận tiền') : ''}</span><b>${fmt(x.amount)}</b></div>`)
            : html`<div class="st-meta">Tháng này chưa có.</div>`}
          <div class="st-meta stc-note">Thay cho phiếu rút cũ. Chủ bấm "Đã nhận tiền" thì khoá cả 2 bên.</div></section>
        ${ext ? '' : html`<section class="card stc-side"><h3>Chờ xử lý</h3>
          ${notChot.map((c) => html`<div class="stc-si"><span>Ca ${c.shift} ${dm(c.date)} chưa chốt tiền</span><a href="${q({ tab: 'doi-soat' })}">Mở ›</a></div>`)}
          ${pend.map((x) => html`<div class="stc-si"><span>${x.title} · ${dm(x.date)}<br><span class="st-meta">${x.status}</span></span><b>${fmt(x.amount)}</b></div>`)}
          ${todo.map((x) => html`<div class="stc-si"><span>Chưa phân loại · ${x.title}</span><b>${fmt(x.amount)}</b></div>`)}
          ${notChot.length + pend.length + todo.length ? '' : html`<div class="st-meta">Không còn gì. 👍</div>`}</section>`}
      </aside></div>`;
}
let DS_SEL = null;   // ca đang mở ở tab Đối soát tiền
function dsInfo(D) {
  const dates = [...new Set((D.cas || []).map((c) => c.date))].sort();
  const chains = Object.fromEntries(dates.map((d) => [d, dayChain(D, d)]));
  const all = (D.cas || []).map((c) => { const link = chains[c.date].get(c.id); const cs = caChecks(c, link); return { c, link, cs, st: caState(c, cs) }; });
  return { dates, all };
}
function dsPanel(D, a) {
  const { c, link, cs, st } = a; const m = link ? link.money : null;
  const box = (x) => html`<div class="stc-c4 ${x.st}" data-k="${x.k}"><b>${x.name}</b><span class="st-meta">${x.a} · ${x.b}</span><span class="pill ${x.st === 'ok' ? 'ok' : x.st === 'red' ? 'off' : 'info'}">${x.txt}</span>
      ${x.st === 'red' && ['mo', 'dt', 'no'].includes(x.k) ? html`<span class="stc-tools">${off('Sửa theo Fabi')}${x.k === 'mo' ? html`${off('Ca trước ghi sai')}${off('Ca này ghi sai')}` : ''}</span>` : ''}</div>`;
  const s1 = cs.filter((x) => ['mo', 'dt', 'no'].includes(x.k)), s3 = cs.filter((x) => ['tm', 'ck'].includes(x.k));
  const kt = c.kt_wait || c.bank_ck == null; const byCa = c.cash_mode === 'ca';
  const its = D.items.filter((x) => x.ca_id === c.id && x.col !== 'dt' && !x.void);
  const r = (lab, a1, b1) => html`<div class="stc-mr"><span>${lab}</span><b>${a1}</b><b>${b1}</b></div>`;
  return html`<div class="stc-dsp"><div class="stc-dsh"><b>Phiếu tiền · Ca ${c.shift} ${dm(c.date)}</b> <span class="st-meta">${c.staff || ''}</span> <span class="pill ${st.cls.replace('p-', '')}">${st.txt}</span></div>
    <div class="stc-stp"><div class="h"><b>①</b> So phiếu Fabi ↔ nhân viên ghi <span class="st-meta">· Fabi là chuẩn</span></div><div class="stc-c4s">${s1.map(box)}</div>
      ${c.fabi && !c.fabi.has ? html`<div class="st-meta">Chưa có file Fabi: ${(c.kt_missing || []).join(', ') || 'chờ kế toán tải'}.</div>` : ''}</div>
    <div class="stc-stp"><div class="h"><b>②</b> Tiền thực nhận <span class="pill mute">${byCa ? 'Thu theo ca' : 'Thu theo ngày'}</span></div>
      <div class="stc-mt">${r('', 'Tiền mặt', 'Chuyển khoản')}
        ${r('Phải có / phải nhận', m ? fmt(m.tm.must) : '–', m ? fmt(m.ck.must) : '–')}
        ${r('Thực nhận', byCa ? (c.ql_counted != null ? fmt(c.ql_counted) + ' (quản lý thu)' : 'chưa nhập') : `NV đếm ${fmt(c.nv_counted ?? 0)}`, kt ? 'chờ kế toán' : fmt(c.bank_ck) + ' (kế toán)')}</div>
      ${byCa ? '' : html`<div class="st-meta">Thu theo ngày: tiền mặt thực nhận nhập ở ca cuối ngày (đợt sau).</div>`}</div>
    <div class="stc-stp"><div class="h"><b>③</b> Kết quả & chốt</div><div class="stc-c4s">${s3.map(box)}</div>
      <div class="stc-tools">${c.recon_money_done ? html`<span class="pill ok">🔒 Đã chốt (theo đối soát hiện nay)</span>` : off('Chốt tiền ca', 'btn sm')}<span class="st-meta">Chốt xong mới sửa được thu chi của ca.</span></div></div>
    <details class="stc-det"><summary>Bảng tiền chi tiết</summary>${m ? html`<div class="stc-mt">${r('', 'Tiền mặt', 'Chuyển khoản')}${r('Tiền đầu ca', fmt(m.tm.start), '–')}
      ${r('+ Doanh thu', fmt(m.tm.dt), fmt(m.ck.dt))}${r('+ Thu nợ / thu khác', fmt(m.tm.no + m.tm.khac), fmt(m.ck.no + m.ck.khac))}${r('± Luân chuyển', fmt(m.tm.lc), fmt(m.ck.lc))}
      ${r('− Chi / cho nợ', fmt(m.tm.chi + m.tm.cn), fmt(m.ck.chi + m.ck.cn))}${r('= Phải có', fmt(m.tm.must), fmt(m.ck.must))}${r('Thực tế', fmt(m.tm.real), kt ? '⏳' : fmt(m.ck.real))}</div>` : html`<div class="st-meta">Ca này không nằm trong chuỗi két (vd FULL TIME).</div>`}</details>
    <div class="stc-stp stc-kl"><div class="h">Các khoản thu chi của ca <span class="pill mute">🔒 chốt tiền ca mới sửa được</span></div>
      ${its.length ? its.map((x) => html`<div class="stc-si"><span><span class="stc-tag t-${x.col}">${x.book === 'thu' ? 'Thu' : 'Chi'} · ${x.pm === 'tm' ? 'TM' : 'CK'} · ${colName(x.book, x.col)}</span> ${x.title}</span><b class="stc-amt ${x.book}">${sg(x.book)}${fmt(x.amount)}</b></div>`) : html`<div class="st-meta">Không có khoản nào ngoài doanh thu.</div>`}</div></div>`;
}
function dsBody(D) {
  const { dates, all } = dsInfo(D);
  if (!all.length) return html`<section class="card stc-empty">Tháng này chưa có ca nào.</section>`;
  const extra = [...new Set(all.map((a) => a.c.shift).filter((s) => !['Sáng', 'Chiều', 'Tối'].includes(s)))];
  const cols = ['Sáng', 'Chiều', 'Tối', ...extra];
  if (!all.some((a) => String(a.c.id) === String(DS_SEL))) DS_SEL = (all.find((a) => a.st.k !== 'chot') || all[all.length - 1]).c.id;
  const sel = all.find((a) => String(a.c.id) === String(DS_SEL));
  const cell = (d, s) => { const a = all.find((x) => x.c.date === d && x.c.shift === s); if (!a) return html`<span class="st-meta">–</span>`;
    return html`<button type="button" class="stc-dsc ${String(a.c.id) === String(DS_SEL) ? 'on' : ''}" data-dsca="${a.c.id}"><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></button>`; };
  const side = (title, list, empty) => html`<section class="card stc-side"><h3>${title} <small>${list.length}</small></h3>${list.length ? list.map((a) => html`<button type="button" class="stc-si stc-go" data-dsca="${a.c.id}"><span>Ca ${a.c.shift} ${dm(a.c.date)}</span><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></button>`) : html`<div class="st-meta">${empty}</div>`}</section>`;
  return html`<div class="stc-tiles">
      <div class="stc-tile"><span>Ca đã chốt tiền</span><b>${all.filter((a) => a.st.k === 'chot').length} / ${all.length}</b><small>theo đối soát hiện nay</small></div>
      <div class="stc-tile ${all.some((a) => a.st.k === 'lech') ? 'warn' : ''}"><span>Ca có ô đỏ</span><b>${all.filter((a) => a.st.k === 'lech').length}</b><small>mở ca / doanh thu / nợ</small></div>
      <div class="stc-tile ${all.some((a) => a.st.k === 'kt') ? 'warn' : ''}"><span>Chờ kế toán</span><b>${all.filter((a) => a.st.k === 'kt').length}</b><small>thiếu file Fabi / ngân hàng</small></div></div>
    <div class="st-meta stc-formula">Mỗi ca: ① so phiếu Fabi ↔ nhân viên ghi → ② tiền thực nhận → ③ <b>Chốt tiền ca</b>; chốt xong mới sửa được thu chi của ca.</div>
    <div class="stc-layout"><section class="card stc-book">
        <div class="stc-wk"><div class="stc-wr stc-hdr" style="--k:${cols.length}"><span>Ngày</span>${cols.map((s) => html`<span>${s}</span>`)}</div>
          ${[...dates].reverse().map((d) => html`<div class="stc-wr" style="--k:${cols.length}"><span class="stc-lab">${dm(d)} <small>${wd(d)}</small></span>${cols.map((s) => cell(d, s))}</div>`)}</div>
        ${sel ? dsPanel(D, sel) : ''}</section>
      <aside class="stc-aside">${side('Ca chưa chốt', all.filter((a) => ['cho', 'lech'].includes(a.st.k)), 'Đã chốt hết. 👍')}${side('Chờ kế toán', all.filter((a) => a.st.k === 'kt'), 'Không có.')}</aside></div>`;
}
function dsPage(D) { return html`<div id="stc-ds">${dsBody(D)}</div>`; }

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
  .stc-bigs { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 10px; margin-top: 12px; }
  .stc-big { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 16px; background: var(--card); border: 2px solid var(--line); }
  .stc-big:first-child { border-color: var(--primary); background: var(--caramel-soft); }
  .stc-big.hot { border-color: var(--off-line); background: var(--off-bg); }
  .stc-big .k { font-size: 12px; font-weight: 700; color: var(--muted); }
  .stc-big .v { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stc-big .s { font-size: 12px; color: var(--muted); }
  .stc-tile.warn { border-color: var(--warn-line); background: var(--warn-bg); }
  .stc-cmp { margin-top: 12px; border-left: 4px solid var(--info-line); }
  .stc-cmp h3 { margin: 0 0 6px; font-size: 15px; } .stc-cmp small { color: var(--muted); font-weight: 400; }
  .stc-cmpr { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--line-soft); font-variant-numeric: tabular-nums; }
  .stc-tfs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 14px; }
  .stc-tf { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
  .stc-tf .h { font-weight: 800; font-size: 12px; color: var(--primary); text-transform: uppercase; }
  .stc-tf .l { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 13px; }
  .stc-tf .l b { font-variant-numeric: tabular-nums; } .stc-tf .t { border-top: 1px solid var(--line-strong); padding-top: 4px; font-weight: 800; }
  .stc-pad { padding: 0 14px 12px; }
  .stc-dg { display: grid; grid-template-columns: minmax(90px, 1.1fr) repeat(5, minmax(0, 1fr)); gap: 8px; align-items: center; padding: 9px 14px; }
  .stc-dg.stc-hdr span:not(:first-child) { text-align: right; }
  .stc-dd { border-bottom: 1px solid var(--line-soft); }
  .stc-wk { padding: 8px 12px; overflow-x: auto; }
  .stc-wr { display: grid; grid-template-columns: minmax(80px, 1fr) repeat(var(--k), minmax(110px, 1.3fr)); gap: 6px; align-items: center; padding: 3px 0; min-width: 440px; }
  .stc-wr.stc-hdr { padding: 6px 0; border: 0; }
  .stc-dsc { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 5px; text-align: left; cursor: pointer; font: inherit; }
  .stc-dsc .pill { white-space: normal; } .stc-dsc.on { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
  .stc-dsp { margin: 6px 12px 14px; border: 1px solid var(--line-strong); border-radius: 14px; background: var(--subtle); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .stc-dsh { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .stc-stp { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .stc-stp .h { font-weight: 700; } .stc-stp .h b { color: var(--primary); }
  .stc-c4s { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
  .stc-c4 { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .stc-c4.red { border-color: var(--off-line); } .stc-c4 .pill { white-space: normal; }
  .stc-mt { display: flex; flex-direction: column; overflow-x: auto; }
  .stc-mr { display: grid; grid-template-columns: minmax(130px, 1.5fr) minmax(90px, 1fr) minmax(90px, 1fr); gap: 8px; padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--line-soft); }
  .stc-mr b { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .stc-det summary { cursor: pointer; font-weight: 600; font-size: 13px; }
  .stc-go { width: 100%; background: none; border: 0; border-bottom: 1px solid var(--line-soft); text-align: left; cursor: pointer; font: inherit; color: inherit; }
  @media (max-width: 980px) { .stc-layout { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 720px) {
    .stc-bigs { grid-template-columns: 1fr 1fr; } .stc-big:first-child { grid-column: 1 / -1; }
    .stc-tfs { grid-template-columns: minmax(0, 1fr); }
    .stc-dg { grid-template-columns: minmax(70px, 1fr) repeat(3, minmax(0, 1fr)); font-size: 12.5px; }
    .stc-dg span:nth-child(2), .stc-dg span:nth-child(5) { display: none; }
    .stc-cmpr { grid-template-columns: minmax(0, 1fr) auto; } .stc-cmpr span:nth-child(2) { grid-column: 1 / -1; order: 3; color: var(--muted); font-size: 12px; }
  }
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
