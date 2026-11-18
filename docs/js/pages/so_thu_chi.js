// Sổ thu chi (mới) — đợt 1 CHỈ XEM, chạy song song trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ).
// 4 tab: Tổng · Đối soát tiền · Sổ thu · Sổ chi + Quỹ ngoài (chỉ Chủ). Mọi nút sửa đều tắt trong lúc chạy thử.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md · Hàm tính: ../so_thu_chi_tinh.js · Máy chủ: app_stc_month, app_stc_ext
import { render as rerender } from '../app.js';
import { vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, parseMoney } from '../tien.js';
import { $, dialog, html, showSaved, str } from '../ui.js';
import { ALERT, COLS, caChecks, caState, compareDays, dayChain, dayTree, fundSummary, gapMath, sumItems } from '../so_thu_chi_tinh.js';

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
    (D.items || []).forEach((x) => { if (String(x.id).startsWith('x:') && !x.void && !D.locked) x.can_edit = true; });
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
      if (P.tab === 'tong' && !D.ext) fillCounts(D);
      root.addEventListener('click', (ev) => {
        const f5 = ev.target.closest('.stc-qnadd,[data-qned],[data-qnok],.stc-lcadd,.stc-kq,[data-adj],.stc-xadd');
        if (f5 && root.contains(f5)) {
          if (f5.classList.contains('stc-qnadd')) qnDialog(D, null);
          else if (f5.dataset.qned) qnDialog(D, D.items.find((x) => x.id === 'w:' + f5.dataset.qned));
          else if (f5.dataset.qnok) qnConfirm(D, Number(f5.dataset.qnok));
          else if (f5.classList.contains('stc-lcadd')) addDialog(D, 'chi', 'lc');
          else if (f5.classList.contains('stc-kq')) countDialog(D);
          else if (f5.dataset.adj) adjDialog(D, Number(f5.dataset.adj));
          else extDialog(D, null);
          return;
        }
        const w = ev.target.closest('[data-ed],[data-unc],.stc-add,[data-col-debt],[data-addca],[data-gap]');
        if (w && root.contains(w)) {
          if (w.dataset.gap) { const it = D.items.find((x) => x.id === w.dataset.gap); if (it?.gap) gapDialog(D, it); }
          else if (w.dataset.addca) addCaDialog(D, w.dataset.addca, P.tab === 'thu' ? 'thu' : 'chi');
          else if (w.dataset.ed) editDialog(D, D.items.find((x) => x.id === w.dataset.ed));
          else if (w.dataset.unc) uncollectDialog(D, D.items.find((x) => x.id === w.dataset.unc));
          else if (w.dataset.colDebt) collectDialog(D, w.dataset.colDebt);
          else addDialog(D, P.tab === 'thu' ? 'thu' : 'chi');
          return;
        }
        const dw = ev.target.closest('[data-dsfabi],[data-dsblame],[data-dsunblame],[data-dsmode],[data-dscash],[data-dsclose],[data-dsreopen]');
        if (dw && root.contains(dw) && !dw.disabled) { dsAct(D, dw); return; }
        const ds = ev.target.closest('[data-dsca]');
        if (ds && root.contains(ds)) { DS_SEL = ds.dataset.dsca; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); return; }
        const t = ev.target.closest('[data-day],[data-ca],.stc-all,.stc-none'); if (!t || !root.contains(t)) return;
        if (t.dataset.day) { OPEN_D.has(t.dataset.day) ? OPEN_D.delete(t.dataset.day) : OPEN_D.add(t.dataset.day); }
        else if (t.dataset.ca) { OPEN_C.has(t.dataset.ca) ? OPEN_C.delete(t.dataset.ca) : OPEN_C.add(t.dataset.ca); }
        else if (t.classList.contains('stc-all')) { D.items.forEach((x) => { OPEN_D.add(x.date); OPEN_C.add(x.ca_id ? String(x.ca_id) : 'o:' + x.date); }); (D.cas || []).forEach((c) => { OPEN_D.add(c.date); OPEN_C.add(String(c.id)); }); }
        else { OPEN_D.clear(); OPEN_C.clear(); }
        const b = $('#stc-book'); if (b && (P.tab === 'thu' || P.tab === 'chi')) b.innerHTML = str(bookCard(D, P.tab));
      });
      root.addEventListener('change', (ev) => { const c = ev.target.closest('[data-person]'); if (c && root.contains(c)) personMark(D, c.dataset.person, c.checked); });
    },
  };
}

// ---------------- Sửa / thêm / xoá (đợt 2a: khoản ngoài ca) ----------------
let CATS = null;
const cats = async () => (CATS ||= rpc('app_fin_types').then((r) => r.cats || []).catch(() => []));
const idNum = (id) => Number(String(id).split(':')[1]);
const after = (msg) => { CACHE = null; showSaved(msg); rerender(); };
const err = (d, e) => { const b = d.querySelector('.stc-err'); if (b) b.innerHTML = str(html`<div class="alert error">${e.message || e}</div>`); };
const val = (d, n) => (d.querySelector(`[name=${n}]`)?.value || '').trim();
const money = (d, n) => parseMoney(val(d, n)) || 0;
function form(title, body, extra = '') {
  return html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">${title}</h2>${body}
    <label class="field"><span>Lý do ${extra ? '' : '(bắt buộc khi sửa / xoá)'}</span><input class="input" name="reason" placeholder="vd: hoá đơn đúng là …"></label>
    <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end">${extra}<button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`;
}
const pmSel = (name, cur) => html`<label class="field"><span>Tiền</span><select class="input" name="${name}"><option value="tien_mat" ${cur !== 'ck' ? 'selected' : ''}>Tiền mặt</option><option value="chuyen_khoan" ${cur === 'ck' ? 'selected' : ''}>Chuyển khoản</option></select></label>`;
const catSel = async (kind, curName) => { const cs = (await cats()).filter((c) => c.kind === kind && c.active !== false);
  return html`<label class="field"><span>Nhóm</span><select class="input" name="cat"><option value="">— Chọn nhóm —</option>${cs.map((c) => html`<option value="${c.id}" ${c.name === curName ? 'selected' : ''}>${c.name}</option>`)}</select></label>`; };
function open(d, onSubmit, onDel) {
  d.querySelectorAll('[data-money]').forEach((i) => i.classList.add('money')); bindMoneyInputs(d);
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  d.querySelector('form').addEventListener('submit', async (ev) => { ev.preventDefault(); try { await onSubmit(); d.close(); } catch (e) { err(d, e); } });
  d.querySelector('.stc-del')?.addEventListener('click', async () => { try { await onDel(); d.close(); } catch (e) { err(d, e); } });
}
async function editDialog(D, x) {
  const br = D.branch.id;
  const del = html`<button type="button" class="btn sm secondary danger stc-del" style="margin-right:auto">Xoá phiếu</button>`;
  if (x.id.startsWith('e:')) {
    const kind = x.book === 'chi' ? 'chi' : 'thu';
    const d = dialog(form(`Sửa khoản ${kind} · ${dm(x.date)}`, html`<label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${x.date}"></label>
      <label class="field"><span>Nội dung</span><input class="input" name="note" value="${x.title}"></label>
      <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(x.amount)}"></label>
      ${pmSel('pay', x.pm)}${await catSel(kind, x.cat)}`, del));
    open(d, async () => { await rpc('app_stc_entry_save', { p_id: idNum(x.id), p: { entry_date: val(d, 'date'), kind, amount: money(d, 'amount'), note: val(d, 'note'), pay_method: val(d, 'pay'), category_id: val(d, 'cat') || null }, p_reason: val(d, 'reason') }); after('Đã sửa — phiếu cũ gạch ngang'); },
      async () => { await rpc('app_stc_entry_delete', { p_id: idNum(x.id), p_reason: val(d, 'reason') }); after('Đã xoá — phiếu vẫn hiện gạch ngang'); });
  } else if (x.id.startsWith('t:')) {
    const dir = (x.book === 'chi') === (x.pm === 'tm') ? 'tm_tk' : 'tk_tm';
    const note = x.title.includes(' · ') ? x.title.split(' · ').slice(1).join(' · ') : '';
    const d = dialog(form(`Sửa luân chuyển quỹ · ${dm(x.date)}`, html`<label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${x.date}"></label>
      <label class="field"><span>Chiều</span><select class="input" name="dir"><option value="tm_tk" ${dir === 'tm_tk' ? 'selected' : ''}>Tiền mặt → Tài khoản</option><option value="tk_tm" ${dir === 'tk_tm' ? 'selected' : ''}>Tài khoản → Tiền mặt</option></select></label>
      <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(x.amount)}"></label>
      <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${note}"></label>`, del));
    open(d, async () => { await rpc('app_stc_transfer_save', { p_id: idNum(x.id), p: { date: val(d, 'date'), direction: val(d, 'dir'), amount: money(d, 'amount'), note: val(d, 'note') }, p_reason: val(d, 'reason') }); after('Đã sửa luân chuyển'); },
      async () => { await rpc('app_stc_transfer_delete', { p_id: idNum(x.id), p_reason: val(d, 'reason') }); after('Đã xoá luân chuyển'); });
  } else if (x.id.startsWith('m:')) {
    const [, rid, ...mk] = x.id.split(':'); const kind = x.book === 'chi' ? 'chi' : 'thu';
    const ca = (D.cas || []).find((c) => c.id === Number(rid));
    const d = dialog(form(`Sửa khoản ${kind} · Ca ${ca?.shift || ''} ${dm(x.date)}`, html`<div class="st-meta">Sửa vào bản đối soát, phiếu nhân viên giữ nguyên. Mục tiền đã duyệt không bị mở lại.</div>
      <label class="field"><span>Nội dung</span><input class="input" name="note" value="${x.title}"></label>
      <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(x.amount)}"></label>
      ${pmSel('pay', x.pm)}${await catSel(kind, x.cat)}`, del));
    const sign = kind === 'chi' ? -1 : 1;
    open(d, async () => { await rpc('app_stc_move_save', { p_report: Number(rid), p_mkey: mk.join(':'), p: { kind: val(d, 'pay'), amount: sign * money(d, 'amount'), note: val(d, 'note'), category_id: val(d, 'cat') || null }, p_reason: val(d, 'reason') }); after('Đã sửa khoản của ca — phiếu cũ gạch ngang'); },
      async () => { await rpc('app_stc_move_save', { p_report: Number(rid), p_mkey: mk.join(':'), p: { delete: true }, p_reason: val(d, 'reason') }); after('Đã xoá khoản của ca'); });
  } else if (x.id.startsWith('x:')) { return extDialog(D, x);
  } else if (x.id.startsWith('dn:')) {
    const name = x.title.replace(/^Nợ (TM|CK): /, '');
    const d = dialog(form(`Sửa cho nợ · ${dm(x.date)}`, html`<label class="field"><span>Người nợ</span><input class="input" name="name" value="${name}"></label>
      <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(x.amount)}"></label>${pmSel('pay', x.pm)}`, del));
    open(d, async () => { await rpc('app_stc_debt_save', { p_id: idNum(x.id), p: { name: val(d, 'name'), amount: money(d, 'amount'), kind: val(d, 'pay') === 'chuyen_khoan' ? 'ck' : 'muon', date: x.date }, p_reason: val(d, 'reason') }); after('Đã sửa khoản cho nợ'); },
      async () => { await rpc('app_stc_debt_delete', { p_id: idNum(x.id), p_reason: val(d, 'reason') }); after('Đã xoá khoản cho nợ'); });
  }
}
async function addDialog(D, book, preset = null) {
  const br = D.branch.id; const today = vnToday();
  const kinds = book === 'chi' ? [['chi', 'Khoản chi'], ['no', 'Cho nợ'], ['lc', 'Luân chuyển quỹ']] : [['khac', 'Thu khác'], ['no', 'Thu nợ'], ['lc', 'Luân chuyển quỹ']];
  const debts = D.open_debts || [];
  const d = dialog(form(`+ Thêm phiếu ${book} · Ngoài ca`, html`<div class="st-meta">Phiếu thêm là phiếu bổ sung của quản lý. Thêm vào ca làm ở đợt sau.</div>
    <label class="field"><span>Loại</span><select class="input" name="kind">${kinds.map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select></label>
    <label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${today}"></label>
    <div data-show="chi khac no-chi">${pmSel('pay', P.pm)}</div>
    <div data-show="lc"><label class="field"><span>Chiều</span><select class="input" name="dir"><option value="tm_tk">Tiền mặt → Tài khoản</option><option value="tk_tm">Tài khoản → Tiền mặt</option></select></label></div>
    <div data-show="chi khac lc"><label class="field"><span>Nội dung</span><input class="input" name="note"></label></div>
    <div data-show="no-chi"><label class="field"><span>Người nợ</span><input class="input" name="name" list="stc-people"><datalist id="stc-people">${(D.people || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist></label></div>
    <div data-show="no-thu"><label class="field"><span>Khách trả nợ</span><select class="input" name="debt"><option value="">— Chọn khách đang nợ —</option>${debts.map((x) => html`<option value="${x.id}">${x.who} · còn nợ ${fmt(x.left)} · từ ${x.from}</option>`)}</select></label>${pmSel('pay2', P.pm)}</div>
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money></label>
    <div data-show="chi khac" class="stc-catbox">${await catSel(book === 'chi' ? 'chi' : 'thu')}</div>`, ' '));
  const kindOf = () => { const k = val(d, 'kind'); return k === 'no' ? `no-${book}` : k; };
  const sync = () => d.querySelectorAll('[data-show]').forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(kindOf()); });
  if (preset) d.querySelector('[name=kind]').value = preset;
  d.querySelector('[name=kind]').addEventListener('change', sync); sync();
  open(d, async () => {
    const k = val(d, 'kind'); const amount = money(d, 'amount'); const reason = val(d, 'reason') || null;
    if (k === 'chi' || k === 'khac') {
      if (!val(d, 'cat')) throw new Error('Chọn nhóm.');
      await rpc('app_stc_entry_save', { p_id: null, p: { branch_id: br, entry_date: val(d, 'date'), kind: book === 'chi' ? 'chi' : 'thu', amount, note: val(d, 'note'), pay_method: val(d, 'pay'), category_id: val(d, 'cat') }, p_reason: reason });
    } else if (k === 'lc') {
      await rpc('app_stc_transfer_save', { p_id: null, p: { branch_id: br, date: val(d, 'date'), direction: val(d, 'dir'), amount, note: val(d, 'note') }, p_reason: reason });
    } else if (book === 'chi') {
      await rpc('app_stc_debt_save', { p_id: null, p: { branch_id: br, name: val(d, 'name'), amount, kind: val(d, 'pay') === 'chuyen_khoan' ? 'ck' : 'muon', date: val(d, 'date') }, p_reason: reason });
    } else {
      if (!val(d, 'debt')) throw new Error('Chọn khách đang nợ.');
      await rpc('app_stc_collect', { p_debt: idNum(val(d, 'debt')), p: { date: val(d, 'date'), kind: val(d, 'pay2'), amount }, p_reason: reason });
    }
    after('Đã thêm phiếu');
  });
}
async function addCaDialog(D, caId, book) {
  const ca = (D.cas || []).find((c) => c.id === Number(caId)); if (!ca) return;
  const kind = book === 'chi' ? 'chi' : 'thu';
  const d = dialog(form(`+ Thêm phiếu ${kind} vào Ca ${ca.shift} ${dm(ca.date)}`, html`<div class="st-meta">Thêm vào bản đối soát của ca (phiếu bổ sung của quản lý). Lý do bắt buộc.</div>
    <label class="field"><span>Nội dung</span><input class="input" name="note"></label>
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money></label>${pmSel('pay', P.pm)}${await catSel(kind)}`, ' '));
  open(d, async () => {
    if (!val(d, 'reason')) throw new Error('Ghi lý do (thêm vào ca bắt buộc lý do).');
    await rpc('app_stc_move_save', { p_report: ca.id, p_mkey: null, p: { kind: val(d, 'pay'), amount: (kind === 'chi' ? -1 : 1) * money(d, 'amount'), note: val(d, 'note'), category_id: val(d, 'cat') || null }, p_reason: val(d, 'reason') });
    after('Đã thêm phiếu vào ca');
  });
}
function collectDialog(D, debtId) {
  const x = (D.open_debts || []).find((o) => o.id === debtId); if (!x) return;
  const d = dialog(form(`Thu nợ · ${x.who}`, html`<div class="st-meta">Còn nợ ${fmt(x.left)} · từ ${x.from}. Trả một phần được.</div>
    <label class="field"><span>Ngày thu</span><input class="input" type="date" name="date" value="${vnToday()}"></label>${pmSel('pay', P.pm)}
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(x.left)}"></label>`, ' '));
  open(d, async () => { await rpc('app_stc_collect', { p_debt: idNum(x.id), p: { date: val(d, 'date'), kind: val(d, 'pay'), amount: money(d, 'amount') }, p_reason: val(d, 'reason') || null }); after('Đã ghi thu nợ'); });
}
function uncollectDialog(D, x) {
  const d = dialog(form(`Huỷ thu nợ · ${x.title}`, html`<div class="st-meta">Dòng thu nợ ${fmt(x.amount)} sẽ gạch ngang, khoản nợ mở lại.</div>`, ' '));
  open(d, async () => { await rpc('app_stc_uncollect', { p_debt: idNum(x.id), p_reason: val(d, 'reason') }); after('Đã huỷ thu nợ'); });
}
async function personMark(D, name, on) {
  try { await rpc('app_stc_person_mark', { p_branch: D.branch.id, p_name: name, p_no_remind: on }); after(on ? `${name}: không nhắc ở phiếu chốt ca` : `${name}: phiếu chốt ca sẽ nhắc thu`); }
  catch (e) { showSaved(e.message, true); }
}

// ---------------- Tab Tổng + Quỹ ngoài (đợt 5) — dùng lại hàm Sổ quỹ cũ ----------------
const MM = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Tài khoản' };
let FUND = null;   // app_fund_branch của cơ sở đang xem (kiểm quỹ), tải sau khi vẽ tab Tổng
function qnDialog(D, x) {
  const today = vnToday(); const br = D.branch.id;
  const note = x && x.title.includes(' · ') ? x.title.split(' · ').slice(1).join(' · ') : '';
  const kind = x && /cuối tháng/.test(x.meta || '') ? 'cuoi_thang' : 'giua_thang';
  const del = x ? html`<button type="button" class="btn sm secondary danger stc-del" style="margin-right:auto">Xoá</button>` : '';
  const d = dialog(html`<form class="stack stc-dlg stc-qnd" style="gap:10px"><h2 style="margin:0">${x ? 'Sửa' : '+'} Chuyển về Quỹ ngoài · ${D.branch.code}</h2>
    <label class="field"><span>Tiền</span><select class="input" name="m"><option value="tien_mat" ${x?.pm === 'ck' ? '' : 'selected'}>Tiền mặt</option><option value="chuyen_khoan" ${x?.pm === 'ck' ? 'selected' : ''}>Tài khoản</option></select></label>
    <label class="field"><span>Loại</span><select class="input" name="k"><option value="giua_thang" ${kind === 'giua_thang' ? 'selected' : ''}>Giữa tháng (giữ hộ)</option><option value="cuoi_thang" ${kind === 'cuoi_thang' ? 'selected' : ''}>Cuối tháng (rút hết số dư)</option></select></label>
    <label class="field"><span>Ngày</span><input class="input" type="date" name="d" value="${x?.date || today}" max="${today}"></label>
    <div class="st-meta stc-bal"></div>
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${x ? fmt(x.amount) : ''}"></label>
    <label class="field"><span>Ghi chú</span><input class="input" name="note" value="${note}" placeholder="vd: QL giao Chủ tại quán"></label>
    <div class="st-meta">${D.owner ? 'Anh nhận đủ tiền thì bấm "Đã nhận tiền" — khoá cả 2 bên.' : 'Chủ sẽ được báo để xác nhận đã nhận tiền.'}</div>
    <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end">${del}<button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
  const bal = async (fill) => {
    try {
      const m = val(d, 'm'); const b = Number(await rpc('app_fund_balance', { p_branch: br, p_method: m, p_date: val(d, 'd') }));
      const own = x && pmOf(m) === x.pm && x.date <= val(d, 'd') ? Number(x.amount) : 0; const av = b + own;
      d.querySelector('.stc-bal').textContent = `Số dư ${MM[m].toLowerCase()} đến hết ${dm(val(d, 'd'))}: ${fmt(av)}`;
      if (fill && val(d, 'k') === 'cuoi_thang') d.querySelector('[name=amount]').value = av > 0 ? fmt(av) : '';
    } catch (_) { /* bỏ qua */ }
  };
  d.addEventListener('change', (ev) => { if (['m', 'k', 'd'].includes(ev.target.name)) bal(true); }); bal(false);
  const p = () => ({ branch_id: br, method: val(d, 'm'), kind: val(d, 'k'), wdate: val(d, 'd'), amount: money(d, 'amount'), note: val(d, 'note') });
  open(d, async () => { await rpc('app_fund_withdraw_save', { p_id: x ? idNum(x.id) : null, p: p() }); after(x ? 'Đã sửa' : D.owner ? 'Đã tạo Chuyển về Quỹ ngoài' : 'Đã tạo — đã báo Chủ xác nhận'); },
    async () => { await rpc('app_fund_withdraw_delete', { p_id: idNum(x.id) }); after('Đã xoá'); });
}
const pmOf = (m) => (m === 'chuyen_khoan' ? 'ck' : 'tm');
async function qnConfirm(D, id) {
  const x = D.items.find((i) => i.id === 'w:' + id); if (!x) return;
  if (!confirm(`Xác nhận anh ĐÃ NHẬN ĐỦ ${fmt(x.amount)} (${PM[x.pm].toLowerCase()}, ngày ${dm(x.date)})?\n\nXác nhận xong phiếu bị khoá cả 2 bên.`)) return;
  try { await rpc('app_fund_withdraw_confirm', { p_id: id }); after('Đã nhận tiền — đã khoá'); } catch (e) { showSaved(e.message, true); }
}
function countDialog(D) {
  const today = vnToday(); const br = D.branch.id; let book = null;
  const d = dialog(html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">Kiểm quỹ · ${D.branch.code}</h2>
    <label class="field"><span>Quỹ</span><select class="input" name="m"><option value="tien_mat">Tiền mặt (đếm)</option><option value="chuyen_khoan">Tài khoản (số dư app ngân hàng)</option></select></label>
    <label class="field"><span>Ngày kiểm</span><input class="input" type="date" name="d" value="${today}" max="${today}"></label>
    <label class="field"><span>Số tiền thực tế</span><input class="input" name="amount" inputmode="numeric" data-money></label>
    <div class="st-meta stc-cmp"></div>
    <label class="field"><span>Lý do (bắt buộc khi lệch)</span><input class="input" name="note"></label>
    <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
  const cmp = () => { const v = parseMoney(val(d, 'amount')); d.querySelector('.stc-cmp').textContent = book == null ? '' : `Sổ: ${fmt(book)}${v == null ? '' : v === book ? ' · KHỚP' : v < book ? ` · THIẾU ${fmt(book - v)}` : ` · THỪA ${fmt(v - book)}`}`; };
  const load = async () => { try { book = Number(await rpc('app_fund_balance', { p_branch: br, p_method: val(d, 'm'), p_date: val(d, 'd') })); } catch (_) { book = null; } cmp(); };
  d.addEventListener('change', (ev) => { if (['m', 'd'].includes(ev.target.name)) load(); });
  d.querySelector('[name=amount]').addEventListener('input', cmp); load();
  open(d, async () => {
    const r = await rpc('app_fund_count_save', { p_branch: br, p_method: val(d, 'm'), p_date: val(d, 'd'), p_counted: parseMoney(val(d, 'amount')), p_note: val(d, 'note') });
    after(r?.diff ? `Đã lưu kiểm quỹ — lệch ${fmt(Math.abs(r.diff))}` : 'Đã lưu kiểm quỹ — KHỚP');
  });
}
async function adjDialog(D, id) {
  const c = (FUND?.counts || []).find((x) => x.id === id); if (!c) return;
  const k = c.counted < c.book ? 'chi' : 'thu'; const diff = Math.abs(c.book - c.counted);
  const d = dialog(html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">Điều chỉnh lệch quỹ · ${MM[c.method]}</h2>
    <div class="st-meta">Kiểm ${dm(c.count_date)}: thực tế ${fmt(c.counted)}, sổ ${fmt(c.book)} → ${k === 'chi' ? 'thiếu' : 'thừa'} <b>${fmt(diff)}</b>. Web tạo một khoản ${k} ${fmt(diff)} (ngày kiểm) để sổ khớp tiền thật.</div>
    ${await catSel(k)}<label class="field"><span>Ghi chú</span><input class="input" name="note" value="${c.note || ''}"></label>
    <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Tạo khoản điều chỉnh</button></div></form>`);
  open(d, async () => { if (!val(d, 'cat')) throw new Error('Chọn nhóm cho khoản điều chỉnh.'); await rpc('app_fund_count_adjust', { p_count: c.id, p_category: Number(val(d, 'cat')), p_note: val(d, 'note') }); after('Đã tạo khoản điều chỉnh — sổ khớp tiền thật'); });
}
async function fillCounts(D) {
  const box = document.getElementById('stc-kqbox'); const tile = document.querySelector('.stc-kqlast'); if (!box) return;
  try { FUND = await rpc('app_fund_branch', { p_branch: D.branch.id, p_month: P.thang }); } catch (e) { box.innerHTML = str(html`<h3>Kiểm quỹ tháng này</h3><div class="st-meta">${e.message}</div>`); return; }
  const lc = FUND.last_count || {};
  if (tile) tile.innerHTML = str(html`<span>Kiểm quỹ lần cuối</span><b>${lc.tien_mat ? dm(lc.tien_mat) : '—'}</b><small>tiền mặt · tài khoản ${lc.chuyen_khoan ? dm(lc.chuyen_khoan) : 'chưa'}</small>`);
  const cs = FUND.counts || [];
  box.innerHTML = str(html`<h3>Kiểm quỹ tháng này <small>${cs.length}</small></h3>${cs.length ? cs.map((c) => { const df = Number(c.counted) - Number(c.book);
    return html`<div class="stc-si stc-kqr"><span><b>${MM[c.method]} · ${dm(c.count_date)}</b><br><span class="st-meta">thực tế ${fmt(c.counted)} · sổ ${fmt(c.book)}${c.note ? ' · ' + c.note : ''}</span><br>
      ${df === 0 ? html`<span class="pill ok">Khớp</span>` : c.adj || c.adj_entry_id ? html`<span class="pill ok">Lệch ${df > 0 ? '+' : '−'}${fmt(Math.abs(df))} · đã điều chỉnh</span>`
        : html`<span class="pill warn">Lệch ${df > 0 ? '+' : '−'}${fmt(Math.abs(df))}</span> <button type="button" class="btn sm secondary" data-adj="${c.id}">Điều chỉnh…</button>`}</span></div>`; })
    : html`<div class="st-meta">Tháng này chưa kiểm quỹ.</div>`}`);
}
async function extDialog(D, x) {
  let E = null; try { E = await rpc('app_ext_month', { p_month: P.thang }); } catch (e) { showSaved(e.message, true); return; }
  const e = x ? (E.entries || []).find((i) => 'x:' + i.id === x.id) || {} : {};
  const kind = e.kind || (x ? (x.book === 'chi' ? 'chi' : 'thu') : P.tab === 'thu' ? 'thu' : 'chi');
  const cats = (k) => (E.categories || []).filter((c) => c.kind === k && c.active !== false);
  const opts = (k, sel) => html`<option value="">— Chọn nhóm —</option>${cats(k).map((c) => html`<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${c.name}</option>`)}`;
  const MODE = { doanh_thu: 'Theo tỉ lệ doanh thu tháng', deu: 'Chia đều', mot: 'Một cơ sở', tu_nhap: 'Tự nhập' };
  const mode = e.alloc_mode || 'doanh_thu'; const man = e.manual || {};
  const del = x ? html`<button type="button" class="btn sm secondary danger stc-del" style="margin-right:auto">Xoá</button>` : '';
  const d = dialog(html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">${x ? 'Sửa khoản ngoài' : '+ Khoản chi / thu ngoài'}</h2>
    <label class="field"><span>Loại</span><select class="input" name="kind"><option value="chi" ${kind === 'chi' ? 'selected' : ''}>Khoản chi</option><option value="thu" ${kind === 'thu' ? 'selected' : ''}>Khoản thu</option></select></label>
    <label class="field"><span>Ngày</span><input class="input" type="date" name="date" value="${e.entry_date || x?.date || (vnToday().startsWith(P.thang) ? vnToday() : P.thang + '-01')}"></label>
    <label class="field"><span>Nhóm</span><select class="input" name="cat">${opts(kind, e.category_id || '')}</select></label>
    <label class="field"><span>Nội dung</span><input class="input" name="note" value="${e.note || x?.title || ''}"></label>
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${e.amount || x?.amount ? fmt(e.amount || x.amount) : ''}"></label>
    ${pmSel('pay', x?.pm || (e.pay_method === 'chuyen_khoan' ? 'ck' : 'tm'))}
    <label class="field"><span>Chia cho cơ sở</span><select class="input" name="mode">${Object.entries(MODE).map(([k, l]) => html`<option value="${k}" ${mode === k ? 'selected' : ''}>${l}</option>`)}</select></label>
    <label class="field stc-xone" ${mode === 'mot' ? '' : 'hidden'}><span>Cơ sở</span><select class="input" name="br"><option value="">— Chọn cơ sở —</option>${(E.branches || []).map((b) => html`<option value="${b.id}" ${String(e.alloc_branch) === String(b.id) ? 'selected' : ''}>${b.code}</option>`)}</select></label>
    <div class="stc-xman stack" style="gap:6px" ${mode === 'tu_nhap' ? '' : 'hidden'}>${(E.branches || []).map((b) => html`<label class="field"><span>${b.code}</span><input class="input stc-xm" data-b="${b.id}" inputmode="numeric" data-money value="${man[b.id] ? fmt(man[b.id]) : ''}"></label>`)}</div>
    <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end">${del}<button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
  d.addEventListener('change', (ev) => {
    if (ev.target.name === 'kind') d.querySelector('[name=cat]').innerHTML = str(opts(ev.target.value, ''));
    if (ev.target.name === 'mode') { d.querySelector('.stc-xone').hidden = val(d, 'mode') !== 'mot'; d.querySelector('.stc-xman').hidden = val(d, 'mode') !== 'tu_nhap'; }
  });
  open(d, async () => {
    const manual = {}; d.querySelectorAll('.stc-xm').forEach((i) => { const v = parseMoney(i.value); if (v) manual[i.dataset.b] = String(v); });
    const p = { entry_date: val(d, 'date'), kind: val(d, 'kind'), category_id: val(d, 'cat') || null, note: val(d, 'note'), amount: money(d, 'amount'),
      pay_method: val(d, 'pay'), alloc_mode: val(d, 'mode'), alloc_branch: val(d, 'br') || null, manual };
    await rpc('app_ext_entry_save', { p_id: x ? idNum(x.id) : null, p }); after(x ? 'Đã sửa khoản ngoài' : 'Đã thêm khoản ngoài');
  }, async () => { if (!confirm(`Xoá khoản ${x.title} ${fmt(x.amount)}?`)) throw new Error('Đã huỷ xoá.'); await rpc('app_ext_entry_delete', { p_id: idNum(x.id) }); after('Đã xoá khoản ngoài'); });
}

// ---------------- Phiếu chênh lệch (đợt 3) ----------------
// Ca thiếu: Trừ lương / Quán chịu / Ghép · Ca dư: Ghép / Phiếu thu / Gán nợ khách trả. Quán chịu, Ghép của người không phải Chủ → chờ Chủ duyệt.
const gapStatus = (s) => String(s || '').replace('Chờ xử lý (dư)', 'Chờ xử lý · chưa làm phiếu thu');
function gapDialog(D, x) {
  const g = x.gap; const thieu = g.kind === 'thieu'; const ca = (D.cas || []).find((c) => c.id === x.ca_id) || {};
  const mm = dayChain(D, x.date).get(ca.id)?.money?.[x.pm] || {}; const gross = Number(x.gross ?? x.amount);
  const avail = Number(g.avail || 0); const people = g.people || [];
  const split = (i) => { const n = people.length || 1; const b = Math.floor(avail / n / 1000) * 1000; return i === 0 ? avail - b * (n - 1) : b; };
  const ghepLock = thieu && g.has_tl ? 'Đã tạo phiếu trừ tiền — huỷ phiếu trừ tiền trước khi ghép.' : '';
  const noLock = !thieu && g.has_thu ? 'Đã tạo phiếu thu — huỷ phiếu thu trước khi gán nợ.' : '';
  const debts = (D.open_debts || []).filter((o) => o.date <= x.date && Number(o.left) > 0);   // chỉ nợ ghi trước ca (máy chủ kiểm lại)
  const acts = thieu ? [['tl', 'Trừ lương', ''], ['qc', 'Quán chịu', ''], ['match', 'Ghép với ca dư', ghepLock]]
    : [['match', 'Ghép với ca thiếu', ''], ['thu', 'Tạo phiếu thu', ''], ['no', 'Gán nợ khách trả', noLock]];
  const first = acts.find((a) => !a[2])?.[0];
  const bU = (ref) => html`<button type="button" class="btn sm secondary" data-undo="${ref}">Huỷ</button>`;
  const bOk = (ref) => html`<button type="button" class="btn sm" data-ok="${ref}">Duyệt</button><button type="button" class="btn sm secondary" data-no="${ref}">Từ chối</button>`;
  const owner = !!D.owner;
  const done = [
    ...(g.tl || []).map((t) => html`<div class="stc-gd"><span>Trừ lương ${t.name}</span><b>${fmt(t.amount)}</b>${bU(`tl:${t.id}`)}</div>`),
    ...(g.decisions || []).map((d) => html`<div class="stc-gd"><span>${d.kind === 'quan_chiu' ? 'Quán chịu' : d.kind === 'thu_khac' ? 'Phiếu thu (Thu khác)' : d.kind}</span><b>${fmt(d.amount)}</b>${bU(`decision:${d.id}`)}</div>`),
    ...(g.debts || []).map((o) => html`<div class="stc-gd"><span>Gán nợ khách trả · ${o.who}</span><b>${fmt(o.amount)}</b>${bU(`debt:${o.id}`)}</div>`),
    ...(g.matches || []).map((m) => html`<div class="stc-gd"><span>Ghép với ${m.with}${m.status === 'cho_duyet' ? ' · ⏳ chờ Chủ duyệt' : ''}</span><b>${fmt(m.amount)}</b>
      ${m.status === 'cho_duyet' && owner ? bOk(`match:${m.id}`) : ''}${bU(`match:${m.id}`)}</div>`),
    ...(g.qc_wait || []).map((q) => html`<div class="stc-gd"><span>Quán chịu · ${q.by || ''} · ⏳ chờ Chủ duyệt</span><b>${fmt(q.amount)}</b>
      ${owner ? bOk(`qc:${q.id}`) : ''}${bU(`qc:${q.id}`)}</div>`),
  ];
  const cands = (g.cands || []).filter((c) => Number(c.amount) > 0);
  const pane = (k, body) => html`<div class="stc-gp" data-pane="${k}" ${k === first ? '' : 'hidden'}>${body}</div>`;
  const lockNote = (m) => html`<div class="st-meta">🔒 ${m}</div>`;
  const panes = {
    tl: () => pane('tl', html`<div class="st-meta">Mặc định chia đều người làm ca, sửa được. Tổng không quá ${fmt(avail)}.</div>
      ${people.map((p, i) => html`<label class="field stc-tlp"><span>${p.name}</span><input class="input" name="tl_${p.id}" inputmode="numeric" data-money value="${fmt(split(i))}"></label>`)}`),
    qc: () => pane('qc', html`<label class="field"><span>Số tiền quán chịu</span><input class="input" name="qc_amount" inputmode="numeric" data-money value="${fmt(avail)}"></label>
      ${owner ? '' : html`<div class="st-meta">⏳ Quán chịu cần Chủ duyệt.</div>`}`),
    match: () => pane('match', ghepLock ? lockNote(ghepLock) : cands.length ? html`<label class="field"><span>Ghép với</span><select class="input" name="cand">${cands.map((c) => html`<option value="${c.report}" data-amt="${c.amount}">${c.label} · còn ${fmt(c.amount)}</option>`)}</select></label>
      <label class="field"><span>Số tiền ghép</span><input class="input" name="match_amount" inputmode="numeric" data-money value="${fmt(Math.min(avail, Number(cands[0].amount)))}"></label>
      ${owner ? '' : html`<div class="st-meta">⏳ Ghép cần Chủ duyệt.</div>`}` : html`<div class="st-meta">Không có ca ${thieu ? 'dư' : 'thiếu'} cùng loại tiền trong 3 ngày để ghép.</div>`),
    thu: () => pane('thu', html`<label class="field"><span>Số tiền ghi Thu khác</span><input class="input" name="thu_amount" inputmode="numeric" data-money value="${fmt(avail)}"></label>`),
    no: () => pane('no', noLock ? lockNote(noLock) : debts.length ? html`<div class="st-meta">Ca dư vì khách trả nợ cũ: chọn khoản nợ, phần dư thành Thu nợ của ca này.</div>
      <label class="field"><span>Khách trả nợ</span><select class="input" name="debt">${debts.map((o) => html`<option value="${o.id}" data-amt="${o.left}">${o.who} · còn ${fmt(o.left)} · ${o.from || dm(o.date)}</option>`)}</select></label>
      <label class="field"><span>Số tiền khách trả</span><input class="input" name="debt_amount" inputmode="numeric" data-money value="${fmt(Math.min(avail, Number(debts[0].left)))}"></label>`
      : html`<div class="st-meta">Không có khách đang nợ ghi trước ca này.</div>`),
  };
  const d = dialog(html`<form class="stack stc-dlg stc-gapd" style="gap:10px"><h2 style="margin:0">Phiếu chênh lệch · Ca ${ca.shift || ''} ${dm(x.date)} · ${PM[x.pm]}</h2>
    <div class="stc-gnum"><div><span>Phải có</span><b>${fmt(mm.must ?? 0)}</b></div><div><span>Thực tế</span><b>${fmt(mm.real ?? 0)}</b></div>
      <div><span>Lệch</span><b class="${thieu ? 'stc-red' : ''}">${thieu ? '−' : '+'}${fmt(gross)}</b></div><div><span>Người làm ca</span><b>${people.map((p) => p.name).join(', ') || ca.staff || '—'}</b></div></div>
    ${gapMath(x) ? html`<div class="pill info">${gapMath(x)}</div>` : ''}
    ${done.length ? html`<div class="stc-gdl"><div class="st-meta">Đã xử lý / đang chờ</div>${done}</div>` : ''}
    <div class="stc-avail">Còn xử lý được: <b>${fmt(avail)}</b></div>
    <div class="stc-gacts">${acts.map(([k, l, lock]) => html`<button type="button" class="btn sm ${k === first && avail > 0 ? '' : 'secondary'}" data-act="${k}" ${lock || avail <= 0 ? 'disabled' : ''} title="${lock || (avail <= 0 ? 'Đã xử lý hết' : '')}">${l}</button>`)}</div>
    ${avail > 0 ? acts.map(([k]) => panes[k]()) : ''}${acts.filter((a) => a[2]).map((a) => lockNote(a[2]))}
    <label class="field"><span>Lý do (bắt buộc)</span><input class="input" name="reason" placeholder="vd: khách quỵt / nhân viên đưa nhầm tiền thối"></label>
    <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button>${avail > 0 && first ? html`<button class="btn sm" type="submit">Lưu</button>` : ''}</div></form>`);
  let cur = first;
  d.querySelectorAll('[data-money]').forEach((i) => i.classList.add('money')); bindMoneyInputs(d);
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  const cs = d.querySelector('[name=cand]');
  cs?.addEventListener('change', () => { const a = Number(cs.selectedOptions[0]?.dataset.amt || 0); d.querySelector('[name=match_amount]').value = fmt(Math.min(avail, a)); });
  const dsl = d.querySelector('[name=debt]');
  dsl?.addEventListener('change', () => { const a = Number(dsl.selectedOptions[0]?.dataset.amt || 0); d.querySelector('[name=debt_amount]').value = fmt(Math.min(avail, a)); });
  const run = async (fn, msg) => { try { const m = await fn(); d.close(); after(m || msg); } catch (e) { err(d, e); } };
  const need = () => { const r = val(d, 'reason'); if (!r) throw new Error('Ghi lý do.'); return r; };
  const item = g.item;
  d.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-act]');
    if (a && !a.disabled) { cur = a.dataset.act; d.querySelectorAll('[data-act]').forEach((b) => b.classList.toggle('secondary', b !== a)); d.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== cur; }); return; }
    const u = ev.target.closest('[data-undo],[data-ok],[data-no]'); if (!u) return;
    const [kind, id] = (u.dataset.undo || u.dataset.ok || u.dataset.no).split(':');
    if (u.dataset.undo) run(async () => { await rpc('app_stc_gap_undo', { p_kind: kind, p_id: Number(id), p_reason: need() }); }, 'Đã huỷ');
    else run(async () => { await rpc('app_stc_gap_approve', { p_kind: kind, p_id: Number(id), p_ok: !!u.dataset.ok }); }, u.dataset.ok ? 'Chủ đã duyệt' : 'Đã từ chối');
  });
  d.querySelector('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    run(async () => {
      const r = need(); let res = 'ok';
      if (cur === 'tl') {
        const ps = people.map((p) => ({ employee_id: p.id, amount: money(d, 'tl_' + p.id) })).filter((p) => p.amount > 0);
        if (!ps.length) throw new Error('Nhập số tiền trừ lương.');
        await rpc('app_stc_gap_tl', { p_report: ca.id, p_item: item, p_people: ps, p_reason: r });
      } else if (cur === 'qc') res = await rpc('app_stc_gap_qc', { p_report: ca.id, p_item: item, p_amount: money(d, 'qc_amount'), p_reason: r });
      else if (cur === 'match') {
        if (!cs) throw new Error('Không có ca để ghép.');
        const o = Number(cs.value);
        res = await rpc('app_stc_gap_match', { p_short: thieu ? ca.id : o, p_over: thieu ? o : ca.id, p_item: item, p_amount: money(d, 'match_amount'), p_reason: r });
      } else if (cur === 'thu') await rpc('app_stc_gap_thu', { p_report: ca.id, p_item: item, p_amount: money(d, 'thu_amount'), p_reason: r });
      else {
        if (!dsl) throw new Error(noLock || 'Không có khách đang nợ để gán.');
        await rpc('app_stc_gap_debt', { p_report: ca.id, p_item: item, p_debt: idNum(dsl.value), p_amount: money(d, 'debt_amount'), p_reason: r });
        return 'Đã gán nợ khách trả';
      }
      return res === 'cho_duyet' ? 'Đã gửi — chờ Chủ duyệt' : null;
    }, 'Đã lưu phiếu chênh lệch');
  });
}

// ---------------- Sổ thu / Sổ chi ----------------
function itemRow(x, book, D = null) {
  const pills = [];
  if (x.void) {
    const v = x.void_info || {};
    pills.push(v.action === 'xoa' ? html`<span class="pill off">Đã xoá · ${v.by || ''} · ${v.at || ''}</span><span class="st-meta">Lý do: ${v.reason || ''}</span>`
      : html`<span class="pill mute">Đã sửa · ${v.by || ''} · ${v.at || ''} · xem phiếu bổ sung</span>`);
    return html`<div class="stc-it void"><span class="stc-tag t-${x.col}">${colName(book, x.col)}</span>
      <div class="stc-itb"><div class="stc-itt">${x.title}</div><div class="st-meta">${x.meta || ''}</div><div class="stc-pills">${pills}</div></div>
      <span class="stc-amt ${book}">${sg(book)}${fmt(x.amount)}</span></div>`;
  }
  if (x.edit) {
    const e = x.edit;
    pills.push(html`<span class="pill info">Phiếu bổ sung của quản lý${e.action === 'them' ? ' · thêm' : ''}</span><span class="st-meta">${e.by || ''} · ${e.at || ''}${e.action === 'sua' && e.old_amount != null && Number(e.old_amount) !== Number(x.amount) ? ` · số cũ ${fmt(e.old_amount)} → ${fmt(x.amount)}` : ''}${e.reason ? ' · lý do: ' + e.reason : ''}</span>`);
  }
  if (x.from) pills.push(html`<span class="st-meta">Nợ từ ${x.from}</span>`);
  if (x.status) { const st = x.col === 'lech' ? gapStatus(x.status) : x.status; pills.push(html`<span class="pill ${x.recv === 'cho' || /Chờ/.test(st) ? 'warn' : /Đã/.test(st) ? 'ok' : 'mute'}">${st}</span>`); }
  if (x.col === 'lech' && gapMath(x)) pills.push(html`<span class="pill info">${gapMath(x)}</span>`);
  if (x.col === 'lech' && x.gap && D && !D.ext) {
    const ca = (D.cas || []).find((c) => c.id === x.ca_id);
    pills.push(ca?.recon_money_done ? html`<button type="button" class="btn sm secondary stc-gapb" data-gap="${x.id}">Phiếu chênh lệch</button>`
      : html`<button type="button" class="btn sm secondary stc-act" data-gap="${x.id}" disabled>Phiếu chênh lệch</button><span class="st-meta">🔒 Chốt tiền ca ở tab Đối soát tiền mới xử lý được</span>`);
  }
  if (book === 'chi' && x.col === 'chi') {
    pills.push(x.cat ? html`<span class="pill mute">${x.cat}</span>` : html`<span class="pill warn">Chưa phân loại</span>`);
    if (x.no_cost) pills.push(html`<span class="pill stc-nc">Không tính chi phí</span>`);
  }
  if (x.chia) pills.push(html`<span class="pill info">${x.chia}</span>`);
  if (x.can_edit) pills.push(x.id.startsWith('dc:') ? html`<button type="button" class="btn sm secondary stc-unc" data-unc="${x.id}">Huỷ thu</button>`
    : html`<button type="button" class="btn sm secondary stc-ed" data-ed="${x.id}">Sửa / Xoá</button>`);
  else if (!['dt', 'lech'].includes(x.col) && !x.to_qn) {
    const ca = x.ca_id ? (D?.cas || []).find((c) => c.id === x.ca_id) : null;
    const why = ca && !ca.recon_money_done ? 'Chốt tiền ca ở tab Đối soát tiền mới sửa được' : ca ? 'Khoản tự động / đổi tiền / đã thành nợ — sửa ở phiếu ca' : 'Sửa ở trang cũ';
    pills.push(html`<button type="button" class="btn sm secondary stc-act" disabled title="${why}">Sửa / Xoá</button><span class="st-meta">🔒 ${why}</span>`);
  }
  return html`<div class="stc-it"><span class="stc-tag t-${x.col}">${colName(book, x.col)}</span>
    <div class="stc-itb"><div class="stc-itt">${x.title}</div><div class="st-meta">${x.meta || ''}</div>${pills.length ? html`<div class="stc-pills">${pills}</div>` : ''}</div>
    <span class="stc-amt ${book}">${sg(book)}${fmt(x.amount)}</span></div>`;
}
function cells(byCol, book, totalV) {
  return html`${COLS[book].map(([k]) => html`<span class="stc-c ${byCol[k] ? '' : 'z'}">${byCol[k] ? fmt(byCol[k]) : '–'}</span>`)}<span class="stc-c tot">${fmt(totalV)}</span>
    <span class="stc-chips">${COLS[book].filter(([k]) => byCol[k]).map(([k, l]) => html`<span>${l} <b>${fmt(byCol[k])}</b></span>`)}</span>`;
}
function addBtn(D, c, book, label) {
  if (D.ext) return D.locked ? off(`+ Thêm khoản ngoài`, 'btn sm secondary') : html`<button type="button" class="btn sm secondary stc-xadd">+ Thêm khoản ngoài</button>`;
  if (String(c.caId).startsWith('o:')) return html`<button type="button" class="btn sm secondary stc-add">+ Thêm phiếu ${book} ngoài ca</button>`;
  const ca = (D.cas || []).find((x) => x.id === c.caId);
  return ca?.recon_money_done ? html`<button type="button" class="btn sm secondary stc-addca" data-addca="${c.caId}">+ Thêm phiếu ${book} vào ${label.toLowerCase()}</button>`
    : html`<button type="button" class="btn sm secondary stc-addca" disabled title="Chốt tiền ca ở tab Đối soát tiền mới thêm được">+ Thêm phiếu ${book} vào ${label.toLowerCase()}</button><span class="st-meta"> 🔒 chốt tiền ca mới thêm được</span>`;
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
          ${co ? html`<div class="stc-its">${c.items.length ? c.items.map((x) => itemRow(x, book, D)) : html`<div class="st-meta stc-empty">Không có khoản ${book === 'thu' ? 'thu' : 'chi'} ${PM[P.pm].toLowerCase()}.</div>`}
            <div class="stc-it add">${addBtn(D, c, book, caLabel(c))}</div></div>` : ''}</div>`; })}</div>` : ''}</div>`;
  });
  return html`<div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[P.pm]} <small>${P.cot ? `chỉ hiện ${colName(book, P.cot)}` : 'theo ngày · bấm ngày để xem từng ca'}</small></h2>
      <span class="stc-tools">${P.cot ? html`<a class="btn sm secondary" href="${q({ cot: '' })}">Bỏ lọc</a>` : ''}<button type="button" class="btn sm secondary stc-all">Mở hết</button><button type="button" class="btn sm secondary stc-none">Thu gọn</button>${D.ext ? off('+ Thêm phiếu', 'btn sm') : html`<button type="button" class="btn sm stc-add">+ Thêm phiếu</button>`}</span></div>
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
    const debts = (D.open_debts || []).map((d) => { const days = Math.max(0, Math.round((new Date(today) - new Date(d.date)) / 864e5)); return html`<div class="stc-si stc-kd"><span><b>${d.who}</b> ${d.no_remind ? html`<span class="pill ok">✓ không nhắc</span>` : ''}<br><span class="st-meta">${d.from} · <span class="${days > 7 ? 'stc-red' : ''}">${days} ngày</span></span></span><span class="stc-r"><b>${fmt(d.left)}</b>${D.ext ? '' : html`<button type="button" class="btn sm secondary stc-col" data-col-debt="${d.id}">Thu nợ</button>`}</span></div>`; });
    return html`${card(`Thu nợ tháng này · ${fmt(sumItems(no))}`, no.map((x) => li(x)), 'Chưa có khoản thu nợ.')}${card('Ca dư tiền', du.map((x) => li(x)), 'Không có ca dư.')}
      ${card('Khách đang nợ', debts, 'Không còn ai nợ.', 'Gồm cả nợ hoá đơn (chưa phải tiền nên không nằm trong sổ). Đỏ khi quá 7 ngày.')}`;
  }
  const th = its.filter((x) => x.book === 'chi' && x.col === 'lech');
  const cn = its.filter((x) => x.book === 'chi' && x.col === 'no');
  const todo = its.filter((x) => x.book === 'chi' && x.col === 'chi' && !x.cat);
  const cost = its.filter((x) => x.book === 'chi' && x.col === 'chi' && x.cat && !x.no_cost);
  const groups = [...new Set(cost.map((x) => x.cat))].map((c) => [c, sumItems(cost.filter((x) => x.cat === c))]).sort((a, b) => b[1] - a[1]);
  const totalCost = sumItems(cost);
  const people = (D.people || []).map((p) => html`<label class="stc-si stc-pp"><span><input type="checkbox" data-person="${p.name}" ${p.no_remind ? 'checked' : ''} ${D.ext ? 'disabled' : ''}> <b>${p.name}</b><br>
      <span class="st-meta">${p.n ? `${p.n} khoản còn nợ · ` : ''}${p.no_remind ? '✓ không nhắc ở phiếu chốt ca' : 'phiếu chốt ca nhắc thu'}</span></span><b>${p.open ? fmt(p.open) : ''}</b></label>`);
  return html`${card('Ca thiếu tiền', th.map((x) => li(x)), 'Không có ca thiếu.')}${card(`Cho nợ tháng này · ${fmt(sumItems(cn))}`, cn.map((x) => li(x)), 'Chưa có khoản cho nợ.')}
    ${card('Người nợ', people, 'Chưa có người nợ có tên.', 'Có dấu ✓: phiếu chốt ca không nhắc thu người này (thay "Công nợ gia đình" và "Nợ kho tổng"). Khách luôn được nhắc. Thêm người nợ mới bằng "+ Thêm phiếu" › Cho nợ.')}
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
      ${ext ? '' : html`<div class="stc-tile stc-kqlast"><span>Kiểm quỹ lần cuối</span><b>…</b><small>đang tải</small></div>`}
      ${ext ? '' : html`<div class="stc-tile ${notChot.length ? 'warn' : ''}"><span>Ca chưa chốt tiền</span><b>${notChot.length}</b><small>xem tab Đối soát tiền</small></div>
        <div class="stc-tile ${pend.length + todo.length ? 'warn' : ''}"><span>Chờ xử lý</span><b>${pend.length + todo.length}</b><small>lệch chờ xử lý + chi chưa phân loại</small></div>`}
    </div>
    <div class="stc-layout"><section class="card">
        <div class="stc-ch"><h2>Tồn ${name} <small>${monthLabel(P.thang)} · cách tính</small></h2></div>
        <div class="stc-tfs">${tf('tm')}${tf('ck')}</div>
        <div class="stc-tools stc-pad">${ext ? html`<span class="st-meta">Thêm khoản chi / thu ngoài ở tab Sổ chi / Sổ thu.</span>` : html`<button type="button" class="btn sm stc-qnadd">+ Chuyển về Quỹ ngoài</button><button type="button" class="btn sm secondary stc-lcadd">+ Luân chuyển tiền mặt ↔ tài khoản</button><button type="button" class="btn sm secondary stc-kq">Kiểm quỹ</button>`}</div>
        <div class="stc-ch"><h2>Tồn quỹ theo ngày</h2><span class="stc-tools">${['tm', 'ck'].map((pm) => html`<a class="btn sm ${P.pm === pm ? '' : 'secondary'}" href="${q({ pm })}">${PM[pm]}</a>`)}</span></div>
        <div class="stc-dg stc-hdr"><span>Ngày</span><span>Đầu ngày</span><span>+ Thu</span><span>− Chi</span><span>${ext ? '' : '− Về Quỹ ngoài'}</span><span>Cuối ngày</span></div>
        ${daily.length ? daily.map((d) => html`<div class="stc-dg stc-dd"><span class="stc-lab">${dm(d.date)} <small>${wd(d.date)}</small></span><span class="stc-c">${fmt(d.start)}</span><span class="stc-c">${d.thu ? '+' + fmt(d.thu) : '–'}</span><span class="stc-c">${d.chi ? '−' + fmt(d.chi) : '–'}</span><span class="stc-c">${d.toQN ? '−' + fmt(d.toQN) : ''}</span><span class="stc-c tot end">${fmt(d.end)}</span></div>`)
          : html`<div class="stc-empty">Tháng này chưa có khoản nào.</div>`}
      </section>
      <aside class="stc-aside">
        <section class="card stc-side"><h3>${ext ? 'Tiền các cơ sở chuyển về' : 'Chuyển về Quỹ ngoài'} <small>${waitN} chờ Chủ nhận</small></h3>
          ${incoming.length ? incoming.map((x) => html`<div class="stc-si stc-qnl"><span><b>${ext ? (x.from || '') + ' · ' : ''}${x.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} · ${dm(x.date)}</b><br>${x.title.includes(' · ') ? html`<span class="st-meta">${x.title.split(' · ').slice(1).join(' · ')}</span><br>` : ''}<span class="pill ${x.recv === 'cho' ? 'warn' : 'ok'}">${x.status || ''}</span>
            ${x.recv === 'cho' ? html`${D.owner ? html` <button type="button" class="btn sm" data-qnok="${idNum(x.id)}">Đã nhận tiền</button>` : ''}${ext ? '' : html` <button type="button" class="btn sm secondary" data-qned="${idNum(x.id)}">Sửa / Xoá</button>`}` : html` <span class="st-meta">🔒</span>`}</span><b>${fmt(x.amount)}</b></div>`)
            : html`<div class="st-meta">Tháng này chưa có.</div>`}
          <div class="st-meta stc-note">Thay cho phiếu rút cũ. Chủ bấm "Đã nhận tiền" thì khoá cả 2 bên.</div></section>
        ${ext ? '' : html`<section class="card stc-side" id="stc-kqbox"><h3>Kiểm quỹ tháng này</h3><div class="st-meta">Đang tải…</div></section>`}
        ${ext ? '' : html`<section class="card stc-side"><h3>Chờ xử lý</h3>
          ${notChot.map((c) => html`<div class="stc-si"><span>Ca ${c.shift} ${dm(c.date)} chưa chốt tiền</span><a href="${q({ tab: 'doi-soat' })}">Mở ›</a></div>`)}
          ${pend.map((x) => html`<div class="stc-si"><span>${x.title} · ${dm(x.date)}<br><span class="st-meta">${x.status}</span></span><b>${fmt(x.amount)}</b></div>`)}
          ${todo.map((x) => html`<div class="stc-si"><span>Chưa phân loại · ${x.title}</span><b>${fmt(x.amount)}</b></div>`)}
          ${notChot.length + pend.length + todo.length ? '' : html`<div class="st-meta">Không còn gì. 👍</div>`}</section>`}
      </aside></div>`;
}
let DS_SEL = null;   // ca đang mở ở tab Đối soát tiền
// đợt 4: các nút của phiếu tiền (gọi app_stc_ds_* — máy chủ kiểm quyền và luật)
function dsAct(D, b) {
  const c = (D.cas || []).find((x) => String(x.id) === String(DS_SEL)); if (!c) return;
  const title = `Ca ${c.shift} ${dm(c.date)}`;
  const ask = (h, body, needReason, fn, msg) => {
    const d = dialog(html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">${h} · ${title}</h2>${body}
      <label class="field"><span>Lý do${needReason ? ' (bắt buộc)' : ' (không bắt buộc)'}</span><input class="input" name="reason"></label>
      <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    open(d, async () => { if (needReason && !val(d, 'reason')) throw new Error('Ghi lý do.'); await fn(d); after(msg); });
  };
  const run = async (fn, msg) => { try { await fn(); after(msg); } catch (e) { showSaved(e.message, true); } };
  const f = c.fabi || {}, nv = c.nv || {};
  if (b.dataset.dsfabi) {
    const k = b.dataset.dsfabi; const L = { mo: ['Tiền mở ca', nv.opening, f.opening], dt: ['Doanh thu', nv.revenue, f.revenue], no: ['Nợ', nv.debt, f.debt] }[k];
    const more = k === 'no' && Number(f.debt) > Number(nv.debt);
    ask('Sửa theo Fabi', html`<div class="st-meta">${L[0]}: nhân viên ghi ${fmt(L[1] ?? 0)} → Fabi ${fmt(L[2] ?? 0)}. Web sửa số nhân viên ghi theo Fabi, lưu số cũ → mới và người sửa.</div>
      ${more ? html`<label class="field"><span>Người nợ phần chênh ${fmt(Number(f.debt) - Number(nv.debt))} (để trống nếu không thêm báo nợ)</span><input class="input" name="name" list="stc-people"><datalist id="stc-people">${(D.people || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist></label>` : ''}`,
      false, (d) => rpc('app_stc_ds_fabi', { p_report: c.id, p_field: k, p_name: more ? val(d, 'name') || null : null, p_reason: val(d, 'reason') || null }), 'Đã sửa theo Fabi');
  } else if (b.dataset.dsblame) {
    const who = b.dataset.dsblame;
    ask(who === 'nay' ? 'Ca này ghi sai tiền mở ca' : 'Ca trước ghi sai', html`<div class="st-meta">${who === 'nay' ? 'Tiền đầu ca của ca này tính bằng số phải là — phần lệch thành phiếu chênh lệch của ca này.'
      : 'Tiền thực tế ca trước để lại tính bằng số mở ca của ca này — phần lệch thành phiếu chênh lệch của ca trước.'}</div>`, true,
      (d) => rpc('app_stc_ds_blame', { p_report: c.id, p_who: who, p_reason: val(d, 'reason') }), 'Đã chọn ca chịu lệch mở ca');
  } else if (b.dataset.dsunblame) {
    ask('Huỷ chọn ca chịu lệch mở ca', html`<div class="st-meta">Tiền mở ca trở lại như trước khi chọn.</div>`, true, (d) => rpc('app_stc_ds_blame_undo', { p_report: c.id, p_reason: val(d, 'reason') }), 'Đã huỷ chọn');
  } else if (b.dataset.dsmode) {
    run(() => rpc('app_stc_ds_cash', { p_report: c.id, p_mode: b.dataset.dsmode, p_counted: b.dataset.dsmode === 'ca' ? c.ql_counted ?? null : null }), b.dataset.dsmode === 'ca' ? 'Thu theo ca' : 'Thu theo ngày');
  } else if (b.dataset.dscash) {
    const v = parseMoney(document.querySelector('.stc-dsp [name=ds_tm]')?.value || ''); if (v == null) { showSaved('Nhập tiền mặt thực nhận.', true); return; }
    run(() => rpc('app_stc_ds_cash', { p_report: c.id, p_mode: c.cash_mode === 'ca' ? 'ca' : 'ngay', p_counted: v }), 'Đã lưu tiền mặt thực nhận');
  } else if (b.dataset.dsclose) {
    run(() => rpc('app_stc_ds_close', { p_report: c.id }), 'Đã chốt tiền ca');
  } else if (b.dataset.dsreopen) {
    ask('Mở lại chốt tiền ca', html`<div class="st-meta">Mở lại để sửa số Fabi / nhân viên ghi / tiền thực nhận. Khoản thu chi của ca sẽ khoá sửa tới khi chốt lại.</div>`, true,
      (d) => rpc('app_stc_ds_reopen', { p_report: c.id, p_reason: val(d, 'reason') }), 'Đã mở lại chốt');
  }
}
function dsInfo(D) {
  const dates = [...new Set((D.cas || []).map((c) => c.date))].sort();
  const chains = Object.fromEntries(dates.map((d) => [d, dayChain(D, d)]));
  const all = (D.cas || []).map((c) => { const link = chains[c.date].get(c.id); const cs = caChecks(c, link); return { c, link, cs, st: caState(c, cs) }; });
  return { dates, all };
}
function dsPanel(D, a) {
  const { c, link, cs, st } = a; const m = link ? link.money : null;
  const box = (x) => html`<div class="stc-c4 ${x.st}" data-k="${x.k}"><b>${x.name}</b><span class="st-meta">${x.a} · ${x.b}</span><span class="pill ${x.st === 'ok' ? 'ok' : x.st === 'red' ? 'off' : 'info'}">${x.txt}</span>
      ${c.recon_money_done || D.ext ? '' : x.fix === 'fabi' ? html`<span class="stc-tools"><button type="button" class="btn sm secondary" data-dsfabi="${x.k}">Sửa theo Fabi</button></span>`
        : x.fix === 'blame' ? html`<span class="stc-tools"><button type="button" class="btn sm secondary" data-dsblame="truoc">Ca trước ghi sai</button><button type="button" class="btn sm secondary" data-dsblame="nay">Ca này ghi sai</button></span>`
        : x.blame ? html`<span class="stc-tools"><span class="st-meta">${x.blame.by || ''}${x.blame.reason ? ' · ' + x.blame.reason : ''}</span><button type="button" class="btn sm secondary" data-dsunblame="1">Huỷ chọn</button></span>` : ''}</div>`;
  const s1 = cs.filter((x) => ['mo', 'dt', 'no'].includes(x.k)), s3 = cs.filter((x) => ['tm', 'ck'].includes(x.k));
  const kt = c.kt_wait || c.bank_ck == null; const byCa = c.cash_mode === 'ca';
  const last = !(D.cas || []).some((o) => o.date === c.date && ['Sáng', 'Chiều', 'Tối'].indexOf(o.shift) > ['Sáng', 'Chiều', 'Tối'].indexOf(c.shift));
  const red1 = s1.some((x) => x.st === 'red'); const canClose = !red1 && !kt && c.fabi?.has && (!byCa || c.ql_counted != null);
  const lockMsg = red1 ? 'còn ô đỏ ở bước ①' : kt || !c.fabi?.has ? 'chờ kế toán' : 'chưa nhập tiền mặt thực nhận';
  const done = c.recon_money_done;
  const its = D.items.filter((x) => x.ca_id === c.id && x.col !== 'dt' && !x.void);
  const r = (lab, a1, b1) => html`<div class="stc-mr"><span>${lab}</span><b>${a1}</b><b>${b1}</b></div>`;
  return html`<div class="stc-dsp"><div class="stc-dsh"><b>Phiếu tiền · Ca ${c.shift} ${dm(c.date)}</b> <span class="st-meta">${c.staff || ''}</span> <span class="pill ${st.cls.replace('p-', '')}">${st.txt}</span></div>
    <div class="stc-stp"><div class="h"><b>①</b> So phiếu Fabi ↔ nhân viên ghi <span class="st-meta">· Fabi là chuẩn</span></div><div class="stc-c4s">${s1.map(box)}</div>
      ${c.fabi && !c.fabi.has ? html`<div class="st-meta">Chưa có file Fabi: ${(c.kt_missing || []).join(', ') || 'chờ kế toán tải'}.</div>` : ''}</div>
    <div class="stc-stp"><div class="h"><b>②</b> Tiền thực nhận ${done ? html`<span class="pill mute">${byCa ? 'Thu theo ca' : 'Thu theo ngày'}</span>`
      : html`<span class="stc-tools"><button type="button" class="btn sm ${byCa ? '' : 'secondary'}" data-dsmode="ca">Thu theo ca</button><button type="button" class="btn sm ${byCa ? 'secondary' : ''}" data-dsmode="ngay">Thu theo ngày</button></span>`}</div>
      <div class="stc-mt">${r('', 'Tiền mặt', 'Chuyển khoản')}
        ${r('Phải có / phải nhận', m ? fmt(m.tm.must) : '–', m ? fmt(m.ck.must) : '–')}
        ${r('Thực nhận', byCa ? (c.ql_counted != null ? fmt(c.ql_counted) + ' (quản lý thu)' : 'chưa nhập') : `NV đếm ${fmt(c.nv_counted ?? 0)}`, kt ? 'chờ kế toán' : fmt(c.bank_ck) + ' (kế toán)')}</div>
      ${done ? '' : byCa || last ? html`<div class="stc-cash"><label class="field"><span>Tiền mặt thực nhận${byCa ? ' (quản lý đếm két ca này)' : ' (quản lý đếm két sau ca cuối ngày)'}</span>
          <input class="input money" name="ds_tm" inputmode="numeric" value="${byCa && c.ql_counted != null ? fmt(c.ql_counted) : ''}"></label><button type="button" class="btn sm" data-dscash="1">Lưu</button></div>`
        : html`<div class="st-meta">Thu theo ngày: ca này không nhập, két chuyển sang ca sau; tiền mặt thực nhận nhập ở ca cuối ngày.</div>`}
      <div class="st-meta">Chuyển khoản luôn lấy số ngân hàng kế toán nhập.</div></div>
    <div class="stc-stp"><div class="h"><b>③</b> Kết quả & chốt</div><div class="stc-c4s">${s3.map(box)}</div>
      <div class="stc-tools">${done ? html`<span class="pill ok">🔒 Đã chốt</span><button type="button" class="btn sm secondary" data-dsreopen="1">Mở lại chốt</button>`
        : html`<button type="button" class="btn sm" data-dsclose="1" ${canClose ? '' : 'disabled'} title="${canClose ? '' : lockMsg}">Chốt tiền ca</button>${canClose ? '' : html`<span class="st-meta">🔒 ${lockMsg}</span>`}`}
        <span class="st-meta">Lệch ở bước ③ không chặn chốt — thành phiếu chênh lệch, xử lý ở Sổ thu / Sổ chi. Chốt xong mới sửa được thu chi của ca.</span></div></div>
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
  .stc-it.void { background: var(--subtle); }
  .stc-it.void .stc-itt, .stc-it.void .stc-amt { text-decoration: line-through; text-decoration-thickness: 2px; color: var(--muted); }
  .stc-r { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .stc-pp { cursor: pointer; } .stc-pp input { width: 16px; height: 16px; vertical-align: -2px; }
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
  .stc-gnum { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; } .stc-gnum div { display: flex; flex-direction: column; min-width: 0; }
  .stc-gnum span { font-size: 12px; color: var(--muted); } .stc-gnum b { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .stc-gd { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 5px 0; border-bottom: 1px solid var(--line-soft); } .stc-gd span { flex: 1 1 140px; min-width: 0; } .stc-gd b { font-variant-numeric: tabular-nums; }
  .stc-gacts { display: flex; flex-wrap: wrap; gap: 6px; } .stc-avail b { font-variant-numeric: tabular-nums; }
  .stc-cash { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; } .stc-cash .field { flex: 1 1 200px; min-width: 0; }
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
