// Sổ thu chi (mới) — đợt 1 CHỈ XEM, chạy song song trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ).
// 4 tab: Tổng · Đối soát Fabi · Sổ thu · Sổ chi + Quỹ ngoài (chỉ Chủ). Bước 151: tab Đối soát Fabi = A · Fabi → B · Thu chi của ca → 🔒 Chốt ca (khoá vĩnh viễn) + Khoản treo ở tab Tổng.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md · Hàm tính: ../so_thu_chi_tinh.js · Máy chủ: app_stc_month, app_stc_ext
import { render as rerender } from '../app.js';
import { catalog, vnToday } from '../data.js';
import { rpc, sb } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, parseMoney } from '../tien.js';
import { $, dialog, html, showSaved, str } from '../ui.js';
import { mountBankOuts } from '../phieu_chi_ck.js';
import { watchGio } from '../gio_chot.js';
import { ALERT, COLS, LOC_EMPTY, SHIFT_ORDER, todoItems, debtGroups, caChecks, caChoices, debtBefore, dsTodo, fabiNeeds, tileInfo, zeroCols, locChips, caGaps, caStage, compareDays, dayChain, dayTree, filterItems, finalNeeds, fold, fundSummary, gapMath, gapParts, gapShort, locStr, parseLoc, sumItems, treoView, dsChecks, dsCtx, dsLeft, DS_STEPS, BIG } from '../so_thu_chi_tinh.js';

export const perm = 'doi_soat';   // bước 152: quản lý cơ sở cũng làm (máy chủ chỉ cho cơ sở được giao)
const TRIAL = 'Đang chạy thử — chưa sửa ở đây';
const PM = { tm: 'Tiền mặt', ck: 'Chuyển khoản' };
const TABS = [['tong', 'Tổng'], ['doi-soat', 'Đối soát Fabi'], ['thu', 'Sổ thu'], ['chi', 'Sổ chi']];
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
let SHOW_ZERO = false;   // bước 164: bấm "hiện lại" → hiện cả cột cả tháng bằng 0 (tới khi tải lại trang)
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
    // bước 158: đã bỏ Chốt ca vĩnh viễn + Khoản treo (khoá cuối cùng là Chốt tháng) — không còn ca nào bị khoá riêng
    D = await rpc('app_stc_month', { p_branch: Number(cn), p_month: month }); D.finals = {}; D.treo = [];
  }
  CACHE = { key, at: Date.now(), D };
  return D;
}

const q = (over = {}) => '#/quan-ly/so-thu-chi?' + new URLSearchParams(Object.entries({ ...P, ...over }).filter(([, v]) => v != null && v !== '')).toString();

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : vnToday().slice(0, 7);
  let cn = params.cn === 'ngoai' ? 'ngoai' : (params.cn || lsGet() || '1');
  const isExt = cn === 'ngoai';
  let tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'tong';
  if (isExt && tab === 'doi-soat') tab = 'tong';
  P = { tab, cn, thang: month, pm: params.pm === 'ck' ? 'ck' : 'tm', cot: params.cot || '', loc: params.loc || '' };
  if (params.ds && params.ds + '|' + (params.t || '') !== DS_PARAM) { DS_SEL = params.ds; DS_PARAM = params.ds + '|' + (params.t || ''); DS_B = /^[1-6]$/.test(params.b || '') ? Number(params.b) - 1 : null; DSB.stepFor = null; }   // đường dẫn chọn ca 1 lần
  let D;
  try { D = await load(cn, month); } catch (e) {
    // bước 152: quản lý cơ sở chưa chọn cơ sở → tự mở cơ sở đầu tiên mình được giao
    if (!isExt && !params.cn) {
      const C = await catalog().catch(() => null);
      for (const b of (C?.activeBranches || [])) {
        if (String(b.id) === String(cn)) continue;
        try { D = await load(String(b.id), month); cn = String(b.id); P.cn = cn; break; } catch (_) { /* thử cơ sở sau */ }
      }
    }
    if (!D) return { title: 'Sổ thu chi', html: html`${STYLE}<div class="page-head"><h1>Sổ thu chi</h1></div><div class="alert warn">${e.message}</div>` };
  }
  if (!isExt) lsSet(D.branch.id);
  const head = html`<header class="stc-top stc-head">
      <div class="stc-toprow"><div class="stc-month"><a class="stc-mb" href="${q({ thang: shiftMonth(month, -1) })}" aria-label="Tháng trước">‹</a><strong>${monthLabel(month)}</strong><a class="stc-mb" href="${q({ thang: shiftMonth(month, 1) })}" aria-label="Tháng sau">›</a></div>
        <nav class="branch-tabs" aria-label="Cơ sở">${(D.branches || []).map((b) => html`<a class="${String(cn) === String(b.id) ? 'on' : ''}" href="${q({ cn: b.id })}">${b.code}</a>`)}
          ${D.owner ? html`<a class="stc-qn ${isExt ? 'on' : ''}" href="${q({ cn: 'ngoai', tab: tab === 'doi-soat' ? 'tong' : tab })}">Quỹ ngoài</a>` : ''}</nav></div>
      <div class="stc-sub"><b>Sổ thu chi · ${D.branch.code}</b> · số liệu từ ${dmy(D.from)} · thu chi, đối soát Fabi và quỹ ở một chỗ</div>
      <nav class="stc-tabs" aria-label="Chọn sổ">${TABS.filter((t) => !(isExt && t[0] === 'doi-soat')).map(([k, l]) => html`<a class="${tab === k ? 'on' : ''}" href="${q({ tab: k, cot: '' })}">${l}</a>`)}</nav>
    </header>`;
  const body = tab === 'thu' || tab === 'chi' ? bookPage(D, tab) : tab === 'tong' ? tongPage(D) : dsPage(D);
  return {
    title: `Sổ thu chi ${D.branch.code}`,
    html: html`${STYLE}<div id="stc-page">${head}${body}</div>`,
    mount() {
      const root = $('#stc-page'); if (!root) return;
      watchGio(root, () => after('Đã sửa giờ chốt'));   // bước 162: dòng giờ chốt ở Đối soát Fabi phần A
      if (P.tab === 'tong' && !D.ext) fillCounts(D);
      if (P.tab === 'thu' || P.tab === 'chi') fillFilter(D, P.tab);
      root.addEventListener('click', (ev) => {
        const f5 = ev.target.closest('.stc-qnadd,[data-qned],[data-qnok],.stc-lcadd,.stc-kq,[data-adj],.stc-xadd');
        if (f5 && root.contains(f5)) {
          if (f5.classList.contains('stc-qnadd')) qnDialog(D, null);
          else if (f5.dataset.qned) qnDialog(D, D.items.find((x) => x.id === 'w:' + f5.dataset.qned));
          else if (f5.dataset.qnok) qnConfirm(D, Number(f5.dataset.qnok));
          else if (f5.classList.contains('stc-lcadd')) addPanel(D, f5, 'chi', { preset: 'lc' });
          else if (f5.classList.contains('stc-kq')) countDialog(D);
          else if (f5.dataset.adj) adjDialog(D, Number(f5.dataset.adj));
          else extDialog(D, null);
          return;
        }
        const w = ev.target.closest('[data-ed],[data-unc],.stc-add,[data-col-debt],[data-addca],[data-gap]');
        if (w && root.contains(w)) {
          if (w.dataset.gap) { const it = D.items.find((x) => x.id === w.dataset.gap); if (it?.gap) gapDialog(D, it); }
          else if (w.dataset.addca) addPanel(D, w, w.dataset.book || (P.tab === 'thu' ? 'thu' : 'chi'), { caId: w.dataset.addca });
          else if (w.dataset.ed) editDialog(D, D.items.find((x) => x.id === w.dataset.ed));
          else if (w.dataset.unc) uncollectDialog(D, D.items.find((x) => x.id === w.dataset.unc));
          else if (w.dataset.colDebt) collectDialog(D, w.dataset.colDebt);
          else addPanel(D, w, P.tab === 'thu' ? 'thu' : 'chi');
          return;
        }
        // bước 153: phiếu trừ lương (sửa / xoá), → Trừ lương / bỏ chuyển, phiếu chi chuyển khoản của ca
        const pp = ev.target.closest('[data-people]');
        if (pp && root.contains(pp)) { peopleDialog(D); return; }
        const pw = ev.target.closest('[data-dsphoto]');
        if (pw && root.contains(pw)) { photoDialog(D, Number(pw.dataset.dsphoto)); return; }
        const kw = ev.target.closest('[data-kaed],[data-kadel],[data-toka],[data-kaundo],[data-bankout]');
        if (kw && root.contains(kw)) {
          if (kw.dataset.kaed) kaEditDialog(D, (D.shortfalls || []).find((x) => String(x.id) === kw.dataset.kaed));
          else if (kw.dataset.kadel) kaDelDialog(D, (D.shortfalls || []).find((x) => String(x.id) === kw.dataset.kadel));
          else if (kw.dataset.toka) toKaDialog(D, D.items.find((x) => x.id === kw.dataset.toka));
          else if (kw.dataset.kaundo) kaUndoDialog(D, D.items.find((x) => x.id === kw.dataset.kaundo));
          else bankOutDialog(D, Number(kw.dataset.bankout));
          return;
        }
        const rw = ev.target.closest('[data-restore]');
        if (rw && root.contains(rw)) { const it = D.items.find((x) => x.id === rw.dataset.restore); if (it) restoreDialog(D, it); return; }
        const tw = ev.target.closest('[data-treodo]');
        if (tw && root.contains(tw)) { treoAct(D, tw); return; }
        const bw = ev.target.closest('[data-dsbook],[data-dspm]');
        if (bw && root.contains(bw)) { if (bw.dataset.dsbook) DSB.book = bw.dataset.dsbook; if (bw.dataset.dspm) DSB.pm = bw.dataset.dspm; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); return; }
        const sw = ev.target.closest('[data-dsstep],[data-dsprev],[data-dsnext]');   // bước 171: đổi bước trong 6 bước đối soát
        if (sw && root.contains(sw) && !sw.disabled) { DSB.step = sw.dataset.dsstep != null ? Number(sw.dataset.dsstep) : Math.max(0, Math.min(5, DSB.step + (sw.dataset.dsnext ? 1 : -1)));
          if (DSB.step === 2) DSB.book = 'thu'; if (DSB.step === 3) DSB.book = 'chi';
          const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); $('.stc-dsp')?.scrollIntoView({ block: 'start' }); return; }
        const dw = ev.target.closest('[data-dsfabi],[data-dsblame],[data-dsunblame],[data-dsmode],[data-dscash],[data-dsclose],[data-dsreopen],[data-dsfinal],[data-dsdone],[data-dsundone],[data-tick],[data-dssau]');
        if (dw && root.contains(dw) && !dw.disabled) { dsAct(D, dw); return; }
        const jw = ev.target.closest('[data-dsjump]');   // bước 168: thanh cuối màn hình → nhảy tới chỗ cần xử lý
        if (jw && root.contains(jw)) { dsJump(D, jw); return; }
        const pk = ev.target.closest('[data-dspick]');   // bước 168 (điện thoại): ‹ Chọn ca khác → về lịch thu
        if (pk && root.contains(pk)) { DS_SEL = null; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); $('#stc-ds')?.scrollIntoView({ block: 'start' }); return; }
        const ds = ev.target.closest('[data-dsca]');
        if (ds && root.contains(ds)) { DS_SEL = ds.dataset.dsca; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); if (isPhone()) $('#stc-ds')?.scrollIntoView({ block: 'start' }); else if (ds.classList.contains('stc-go')) $('.stc-dsp')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const zw = ev.target.closest('[data-showzero]');   // bước 164: hiện lại cột cả tháng bằng 0
        if (zw && root.contains(zw)) { SHOW_ZERO = true; const b0 = $('#stc-book'); if (b0) b0.innerHTML = str(bookCard(D, P.tab)); return; }
        const t = ev.target.closest('[data-day],[data-ca],.stc-all,.stc-none'); if (!t || !root.contains(t)) return;
        if (t.dataset.day) { OPEN_D.has(t.dataset.day) ? OPEN_D.delete(t.dataset.day) : OPEN_D.add(t.dataset.day); }
        else if (t.dataset.ca) { OPEN_C.has(t.dataset.ca) ? OPEN_C.delete(t.dataset.ca) : OPEN_C.add(t.dataset.ca); }
        else if (t.classList.contains('stc-all')) { D.items.forEach((x) => { OPEN_D.add(x.date); OPEN_C.add(x.ca_id ? String(x.ca_id) : 'o:' + x.date); }); (D.cas || []).forEach((c) => { OPEN_D.add(c.date); OPEN_C.add(String(c.id)); }); }
        else { OPEN_D.clear(); OPEN_C.clear(); }
        const b = $('#stc-book'); if (b && (P.tab === 'thu' || P.tab === 'chi')) b.innerHTML = str(bookCard(D, P.tab));
      });
      root.addEventListener('change', (ev) => { const c = ev.target.closest('[data-person]'); if (c && root.contains(c)) personMark(D, c.dataset.person, c.checked); });
      root.addEventListener('change', async (ev) => {   // bước 155: chọn nhóm / người nợ ngay trên dòng
        const cx = ev.target.closest('[data-catx]'); const wx = ev.target.closest('[data-whox]');
        if (cx) { const it = D.items.find((x) => x.id === cx.dataset.catx); if (!it) return; cx.disabled = true; try { await setCat(D, it, cx.value); } catch (e) { showSaved(e.message || e, true); cx.disabled = false; } }
        else if (wx) { const it = D.items.find((x) => x.id === wx.dataset.whox); if (it) setWho(D, it, wx.value, wx); }
      });
      if ((P.tab === 'thu' || P.tab === 'chi') && !FTV) finTypes().then(() => { const b = $('#stc-book'); if (b) b.innerHTML = str(bookCard(D, P.tab)); });
      // bước 152: bộ lọc sổ — vẽ lại riêng phần sổ, giữ con trỏ ở ô tìm; đường dẫn cập nhật không tải lại trang
      let lfT = null;
      const lfSet = (k, v) => { const f = parseLoc(P.loc); f[k] = v; if (k === 'type') f.cat = ''; P.loc = locStr(f);
        try { history.replaceState(null, '', q()); } catch (_) { /* bỏ qua */ }
        const b = $('#stc-book'); if (b) b.innerHTML = str(bookCard(D, P.tab));
        const c = $('#stc-lfclr'); if (c) c.hidden = !P.loc; if (k === 'type') fillFilter(D, P.tab);
        root.querySelectorAll('.stc-flt [data-lf]').forEach((e2) => e2.closest('.stc-fl')?.classList.toggle('on', !!f[e2.dataset.lf]));
        const nOn = ['src', 'type', 'cat', 'st'].filter((x) => f[x]).length; const fb = $('.stc-fbtn'); if (fb) fb.textContent = '⚙ Lọc' + (nOn ? ` (${nOn})` : ''); };
      root.addEventListener('input', (ev) => { const i = ev.target.closest('[data-lf="q"]'); if (!i) return; clearTimeout(lfT); lfT = setTimeout(() => lfSet('q', i.value), 250); });
      root.addEventListener('change', (ev) => { const i = ev.target.closest('select[data-lf]'); if (i) lfSet(i.dataset.lf, i.value); });
      root.addEventListener('click', (ev) => { if (!ev.target.closest('#stc-lfclr')) return; P.loc = ''; location.hash = q(); });
      root.addEventListener('click', (ev) => {   // bước 164: ✕ từng điều kiện / Bỏ hết (giữ ô đang chọn) + ⚙ Lọc trên điện thoại
        const fb = ev.target.closest('.stc-fbtn'); if (fb && root.contains(fb)) { fb.closest('.stc-flt').classList.toggle('open'); return; }
        const uw = ev.target.closest('[data-unloc]'); if (!uw || !root.contains(uw)) return;
        if (uw.dataset.unloc === 'all') { P.loc = ''; location.hash = q(); return; }
        const ctl = root.querySelector(`.stc-flt [data-lf="${uw.dataset.unloc}"]`); if (ctl) ctl.value = '';
        lfSet(uw.dataset.unloc, '');
      });
    },
  };
}

// ---------------- Sửa / thêm / xoá (đợt 2a: khoản ngoài ca) ----------------
let CATS = null;
let FT = null;   // app_fin_types: { types, cats }
let FTV = null;  // danh mục đã tải xong (vẽ đồng bộ)
const finTypes = async () => (FT ||= rpc('app_fin_types').catch(() => ({ types: [], cats: [] })).then((r) => (FTV = r)));
const cats = async () => (CATS ||= finTypes().then((r) => r.cats || []));
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
// Khung "+ Thêm phiếu" nằm ngay trong sổ (theo bản mẫu 18/11), thay hộp nổi: Loại · Tiền · Ngày · Ca · Nội dung · Số tiền · Nhóm · Lý do.
// Chọn ca → phiếu bổ sung vào bản đối soát của ca (chỉ Khoản chi / Thu khác, lý do bắt buộc); Ngoài ca → khoản ngoài ca như cũ.
async function addPanel(D, btn, book, { caId = null, preset = null } = {}) {
  document.querySelectorAll('.stc-addp').forEach((x) => x.remove());
  const br = D.branch.id; const today = vnToday();
  const pm = P.tab === 'doi-soat' ? DSB.pm : P.pm;
  const kinds = book === 'chi' ? [['chi', 'Khoản chi'], ['no', 'Cho nợ'], ['lc', 'Luân chuyển quỹ']] : [['khac', 'Thu khác'], ['no', 'Thu nợ'], ['lc', 'Luân chuyển quỹ']];
  const debts = D.open_debts || [];
  // bước 163: ô Ca chỉ hiện ca của ngày đang chọn (caChoices); ca chưa xác nhận Fabi / tháng đã chốt hiện mờ kèm lý do
  const caById = (id) => (id ? (D.cas || []).find((c) => String(c.id) === String(id)) : null);
  const day0 = caById(caId)?.date || (today.startsWith(P.thang) ? today : P.thang + '-01');   // xem tháng khác → ngày đầu tháng đó (như Quỹ ngoài)
  const cs = (await cats()).filter((c) => c.kind === (book === 'chi' ? 'chi' : 'thu') && c.active !== false);
  const pmOpt = (name) => html`<select class="input" name="${name}"><option value="tien_mat" ${pm !== 'ck' ? 'selected' : ''}>Tiền mặt</option><option value="chuyen_khoan" ${pm === 'ck' ? 'selected' : ''}>Chuyển khoản</option></select>`;
  const f = (label, ctl, show = '', cls = '') => html`<label class="stc-af ${cls}" data-show="${show}"><span>${label}</span>${ctl}</label>`;
  const box = document.createElement('form'); box.className = 'stc-addp'; box.noValidate = true;
  box.innerHTML = str(html`<div class="stc-ah"><b>+ Thêm phiếu ${book}</b> <span class="st-meta">phiếu bổ sung của quản lý · Chủ, Quản lý tổng, Quản lý cơ sở đều thêm được</span></div>
    <div class="stc-ar">
      ${f('Loại', html`<select class="input" name="kind">${kinds.map(([k, l]) => html`<option value="${k}" ${k === preset ? 'selected' : ''}>${l}</option>`)}</select>`, '', 'stc-ak')}
      ${f('Tiền', pmOpt('pay'), 'chi khac no-chi')}
      ${f('Chiều', html`<select class="input" name="dir"><option value="tm_tk">Tiền mặt → Tài khoản</option><option value="tk_tm">Tài khoản → Tiền mặt</option></select>`, 'lc')}
      ${f('Tiền', pmOpt('pay2'), 'no-thu')}
      ${f('Ngày', html`<input class="input" type="date" name="date" value="${day0}">`)}
      ${f('Ca', html`<select class="input" name="ca"><option value="">Ngoài ca</option></select><small class="st-meta stc-canote" hidden></small><span class="stc-cajump" hidden></span>`)}
      ${f('Số tiền', html`<input class="input money" name="amount" inputmode="numeric">`, '', 'stc-am')}
    </div>
    <div class="stc-ar">
      ${f('Nội dung', html`<input class="input" name="note" placeholder="${book === 'chi' ? 'vd: Mua đá' : 'vd: Bán vỏ thùng'}">`, 'chi khac lc', 'stc-aw')}
      ${f('Người nợ', html`<input class="input" name="name" list="stc-people" placeholder="Khách"><datalist id="stc-people">${(D.people || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist>`, 'no-chi', 'stc-aw')}
      ${f('Khách trả nợ', html`<select class="input" name="debt"><option value="">— Chọn khách đang nợ —</option></select>`, 'no-thu', 'stc-aw')}
      ${cs.length === 1 ? html`<span class="pill mute stc-ac" data-show="chi khac">Nhóm: ${cs[0].name}<input type="hidden" name="cat" value="${cs[0].id}"></span>`
        : f('Nhóm', html`<select class="input" name="cat"><option value="">— Chọn nhóm —</option>${cs.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select>`, 'chi khac')}
      ${f('Lý do', html`<input class="input" name="reason">`, '', 'stc-aw')}
      <span class="stc-abtn"><button class="btn sm" type="submit">Lưu phiếu</button><button type="button" class="btn sm secondary" data-x>Huỷ</button></span>
    </div><div class="stc-err"></div>`);
  const anchor = btn.closest('.stc-ch') || btn.closest('.stc-it.add, .stc-tools') || btn;
  anchor.insertAdjacentElement('afterend', box);
  bindMoneyInputs(box);
  const el = (n) => box.querySelector(`[name=${n}]`);
  const fillCa = (keep) => {
    const dv = el('date').value; const other = !!dv && !dv.startsWith(P.thang);   // D.cas chỉ có ca của tháng đang xem
    const list = other ? [] : caChoices(D.cas || [], dv, { locked: !!D.locked });
    el('ca').innerHTML = str(html`<option value="">Ngoài ca</option>${list.map((x) => html`<option value="${x.id}" ${x.ok ? '' : 'disabled'}>${x.label}${x.why ? ' — ' + x.why : ''}</option>`)}`);
    el('ca').value = list.some((x) => x.ok && String(x.id) === String(keep ?? '')) ? String(keep) : '';
    const msg = !dv ? '' : other ? `Ngày ${dm(dv)} thuộc tháng khác — mở sổ tháng đó để thêm vào ca`
      : D.locked ? `Ngày ${dm(dv)} — tháng đã chốt, chỉ ghi được ngoài ca` : list.some((x) => x.ok) ? ''
        : list.some((x) => x.done) ? `Ca ngày ${dm(dv)} đã hoàn thành đối soát — Mở lại ở Đối soát Fabi (bước 6) mới thêm vào ca được` : `Ngày ${dm(dv)} chưa có ca nào xác nhận Fabi`;
    const note = box.querySelector('.stc-canote'); note.hidden = !msg; note.textContent = msg;
    // bước 168: ca chưa xác nhận Fabi → nút nhảy tới Xác nhận Fabi của ca đó (vẫn giữ luật: phải xác nhận Fabi mới thêm vào ca được)
    const jw = box.querySelector('.stc-cajump'); const bad = D.locked ? [] : list.filter((x) => !x.ok && (x.why === 'chưa xác nhận Fabi' || x.done));
    jw.hidden = !bad.length;
    jw.innerHTML = str(html`${bad.map((x) => html`<a class="btn sm secondary" href="${q({ tab: 'doi-soat', cot: '', loc: '' })}&ds=${x.id}${x.done ? '&b=6' : ''}">${x.label.split(' · ')[0]}: ${x.done ? 'Mở lại ở Đối soát Fabi' : 'Xác nhận Fabi'} ›</a>`)}`);
  };
  // bước 168: Thu nợ ngoài ca — chỉ nợ phát sinh từ ngày của phiếu trở về trước (máy chủ tệp 147 chặn lại)
  const fillDebt = () => { const dv = el('date').value; const keep = el('debt').value; const ok = debts.filter((x) => debtBefore(x, { date: dv }));
    el('debt').innerHTML = str(html`<option value="">${ok.length ? '— Chọn khách đang nợ —' : `— Không có khách nợ ghi từ ${dv ? dm(dv) : 'ngày này'} trở về trước —`}</option>${ok.map((x) => html`<option value="${x.id}">${x.who} · còn nợ ${fmt(x.left)} · từ ${x.from}</option>`)}`);
    el('debt').value = ok.some((x) => x.id === keep) ? keep : ''; };
  const kindOf = () => { const k = el('kind').value; return k === 'no' ? `no-${book}` : k; };
  const sync = () => {
    const k = kindOf(); const caOk = k === 'chi' || k === 'khac';
    box.querySelectorAll('[data-show]').forEach((x) => { x.hidden = !!x.dataset.show && !x.dataset.show.split(' ').includes(k); });
    if (!caOk) el('ca').value = '';
    el('ca').disabled = !caOk; el('ca').title = caOk ? '' : 'Cho nợ / Thu nợ / Luân chuyển chỉ thêm ngoài ca';
    const ca = caById(el('ca').value);
    el('reason').placeholder = ca ? 'bắt buộc khi thêm vào ca' : 'không bắt buộc';
  };
  el('date').addEventListener('change', () => { fillCa(el('ca').value); fillDebt(); sync(); });
  el('kind').addEventListener('change', () => { if (!el('ca').value) fillCa(''); sync(); }); el('ca').addEventListener('change', sync); fillCa(caId); fillDebt(); sync();
  box.querySelector('[data-x]').addEventListener('click', () => box.remove());
  box.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const sb = box.querySelector('[type=submit]');
    const v = (n) => (el(n)?.value || '').trim(); const amount = parseMoney(v('amount')) || 0; const reason = v('reason') || null;
    const k = v('kind'); const ca0 = caById(v('ca')); const ca = ca0 && ca0.date === v('date') ? ca0 : null;   // chỉ gắn vào ca của đúng ngày đang chọn
    try {
      if (!amount) throw new Error('Nhập số tiền.');
      sb.disabled = true;
      if (ca) {
        if (!reason) throw new Error('Ghi lý do (thêm vào ca bắt buộc lý do).');
        await rpc('app_stc_move_save', { p_report: ca.id, p_mkey: null, p: { kind: v('pay'), amount: (book === 'chi' ? -1 : 1) * amount, note: v('note'), category_id: v('cat') || null }, p_reason: reason });
        return after(`Đã thêm phiếu vào ${caName(ca)}`);
      }
      if (k === 'chi' || k === 'khac') {
        if (!v('cat')) throw new Error('Chọn nhóm.');
        await rpc('app_stc_entry_save', { p_id: null, p: { branch_id: br, entry_date: v('date'), kind: book === 'chi' ? 'chi' : 'thu', amount, note: v('note'), pay_method: v('pay'), category_id: v('cat') }, p_reason: reason });
      } else if (k === 'lc') {
        await rpc('app_stc_transfer_save', { p_id: null, p: { branch_id: br, date: v('date'), direction: v('dir'), amount, note: v('note') }, p_reason: reason });
      } else if (book === 'chi') {
        await rpc('app_stc_debt_save', { p_id: null, p: { branch_id: br, name: v('name'), amount, kind: v('pay') === 'chuyen_khoan' ? 'ck' : 'muon', date: v('date') }, p_reason: reason });
      } else {
        if (!v('debt')) throw new Error('Chọn khách đang nợ.');
        const od = (D.open_debts || []).find((o) => o.id === v('debt'));
        if (od && !shortOk(Number(od.left), amount)) throw new Error('Chưa ghi — sửa số tiền khách trả.');
        await rpc('app_stc_collect', { p_debt: idNum(v('debt')), p: { date: v('date'), kind: v('pay2'), amount }, p_reason: reason });
      }
      after('Đã thêm phiếu');
    } catch (e) { sb.disabled = false; err(box, e); }
  });
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  (el('note') && !el('note').closest('[hidden]') ? el('note') : el('amount')).focus({ preventScroll: true });
}
function collectDialog(D, debtId) {
  const x = (D.open_debts || []).find((o) => o.id === debtId); if (!x) return;
  const d = dialog(form(`Thu nợ · ${x.who}`, html`<div class="st-meta">Còn nợ ${fmt(x.left)} · từ ${x.from}. Khách trả một lần, đủ cả khoản — đưa thiếu thì phần còn thiếu ghi thành nợ mới.</div>
    <label class="field"><span>Ngày thu</span><input class="input" type="date" name="date" value="${vnToday()}"></label>${pmSel('pay', P.pm)}
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(x.left)}"></label>`, ' '));
  open(d, async () => { if (!debtBefore(x, { date: val(d, 'date') })) throw new Error(`Khoản nợ này ghi ${x.from || dm(x.date)} — ngày thu phải từ ngày đó trở đi.`);
    if (!shortOk(Number(x.left), money(d, 'amount'))) throw new Error('Chưa ghi — sửa số tiền khách trả.');
    await rpc('app_stc_collect', { p_debt: idNum(x.id), p: { date: val(d, 'date'), kind: val(d, 'pay'), amount: money(d, 'amount') }, p_reason: val(d, 'reason') || null }); after('Đã ghi thu nợ'); });
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
let qnBusy = false;   // UI-25: bấm "Đã nhận tiền" nhanh 2 lần chỉ gửi 1 lệnh
async function qnConfirm(D, id) {
  if (qnBusy) return;
  const x = D.items.find((i) => i.id === 'w:' + id); if (!x) return;
  if (!confirm(`Xác nhận anh ĐÃ NHẬN ĐỦ ${fmt(x.amount)} (${PM[x.pm].toLowerCase()}, ngày ${dm(x.date)})?\n\nXác nhận xong phiếu bị khoá cả 2 bên.`)) return;
  qnBusy = true;
  try { await rpc('app_fund_withdraw_confirm', { p_id: id }); after('Đã nhận tiền — đã khoá'); } catch (e) { showSaved(e.message, true); } finally { qnBusy = false; }
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
  try { FUND = await rpc('app_fund_branch', { p_branch: D.branch.id, p_month: P.thang }); } catch (e) { box.innerHTML = str(html`<div class="st-meta">${e.message}</div>`); if (tile) tile.textContent = 'Lần cuối: —'; return; }
  const lc = FUND.last_count || {};
  if (tile) tile.textContent = `Lần cuối: tiền mặt ${lc.tien_mat ? dm(lc.tien_mat) : 'chưa'} · tài khoản ${lc.chuyen_khoan ? dm(lc.chuyen_khoan) : 'chưa'}`;   // bước 166: dòng chữ trong khung Kiểm quỹ
  const cs = FUND.counts || [];
  box.innerHTML = str(html`${cs.length ? cs.map((c) => { const df = Number(c.counted) - Number(c.book);
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
  const debts = (D.open_debts || []).filter((o) => debtBefore(o, { date: x.date, shift: ca.shift }) && Number(o.left) > 0 && Number(o.left) <= Number(g.avail || 0));   // bước 168: nợ phát sinh TRƯỚC ca (theo thứ tự ca), két dư đủ cả khoản (máy chủ kiểm lại)
  const acts = thieu ? [['tl', 'Trừ lương', ''], ['qc', 'Quán chịu', ''], ['match', 'Ghép với ca dư', ghepLock]]
    : [['match', 'Ghép với ca thiếu', ''], ['thu', 'Tạo phiếu thu', ''], ['no', 'Gán nợ khách trả', noLock]];
  const first = acts.find((a) => !a[2])?.[0];
  const bU = (ref) => html`<button type="button" class="btn sm secondary" data-undo="${ref}">Huỷ</button>`;
  const bOk = (ref) => html`<button type="button" class="btn sm" data-ok="${ref}">Duyệt</button><button type="button" class="btn sm secondary" data-no="${ref}">Từ chối</button>`;
  const owner = !!D.owner;
  const done = [
    ...(g.tl || []).map((t) => html`<div class="stc-gd"><span>Trừ lương ${t.name}</span><b>${fmt(t.amount)}</b>${bU(`tl:${t.id}`)}</div>`),
    ...(g.decisions || []).map((d) => html`<div class="stc-gd"><span>${d.kind === 'quan_chiu' ? 'Quán chịu' : d.kind === 'thu_khac' ? 'Phiếu thu (Thu khác)' : d.kind === 'treo' ? 'Khoản treo của ca đã chốt (tiền về / ghép) — huỷ thì khoản treo mở lại' : d.kind}</span><b>${fmt(d.amount)}</b>${bU(`decision:${d.id}`)}</div>`),
    ...(g.debts || []).map((o) => html`<div class="stc-gd"><span>Gán nợ khách trả · ${o.who}</span><b>${fmt(o.amount)}</b>${bU(`debt:${o.id}`)}</div>`),
    ...(g.matches || []).map((m) => html`<div class="stc-gd"><span>Ghép với ${m.with}${m.status === 'cho_duyet' ? ' · ⏳ chờ Chủ duyệt' : ''}</span><b>${fmt(m.amount)}</b>
      ${m.status === 'cho_duyet' && owner ? bOk(`match:${m.id}`) : ''}${bU(`match:${m.id}`)}</div>`),
    ...(g.qc_wait || []).map((q) => html`<div class="stc-gd"><span>Quán chịu · ${q.by || ''} · ⏳ chờ Chủ duyệt</span><b>${fmt(q.amount)}</b>
      ${owner ? bOk(`qc:${q.id}`) : ''}${bU(`qc:${q.id}`)}</div>`),
  ];
  const cands = (g.cands || []).filter((c) => Number(c.amount) > 0 && !isFin(D, Number(c.report)));   // ca đã chốt không ghép được
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
    no: () => pane('no', noLock ? lockNote(noLock) : debts.length ? html`<div class="st-meta">Ca dư vì khách trả nợ cũ: chọn khoản nợ, thành Thu nợ của ca này. Khách trả một lần — chỉ gán khoản mà két dư đủ cả khoản.</div>
      <label class="field"><span>Khách trả nợ</span><select class="input" name="debt">${debts.map((o) => html`<option value="${o.id}" data-amt="${o.left}">${o.who} · còn ${fmt(o.left)} · ${o.from || dm(o.date)}</option>`)}</select></label>
      <label class="field"><span>Số tiền khách trả (cả khoản)</span><input class="input" name="debt_amount" inputmode="numeric" data-money readonly value="${fmt(Number(debts[0].left))}"></label>`
      : html`<div class="st-meta">Không có khoản nợ ghi trước ca này mà két dư đủ cả khoản.</div>`),
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
  dsl?.addEventListener('change', () => { const a = Number(dsl.selectedOptions[0]?.dataset.amt || 0); d.querySelector('[name=debt_amount]').value = fmt(a); });
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
function itemRow(x, book, D = null, { quiet = false, who = false } = {}) {
  const pills = [];
  if (x.void) {
    const v = x.void_info || {};
    pills.push(v.action === 'xoa' ? html`<span class="pill off">Đã xoá · ${v.by || ''} · ${v.at || ''}</span><span class="st-meta">Lý do: ${v.reason || ''}</span>`
      : html`<span class="pill mute">Đã sửa · ${v.by || ''} · ${v.at || ''} · xem phiếu bổ sung</span>`);
    if (canRestore(D, x)) pills.push(html`<button type="button" class="btn sm secondary" data-restore="${x.id}">↺ Khôi phục phiếu</button>`);
    return html`<div class="stc-it void"><span class="stc-tag t-${x.col}">${colName(book, x.col)}</span>
      <div class="stc-itb"><div class="stc-itt">${x.title}</div><div class="st-meta">${x.meta || ''}</div><div class="stc-pills">${pills}</div></div>
      <span class="stc-amt ${book}">${sg(book)}${fmt(x.amount)}</span></div>`;
  }
  if (who && x.src === 'move') pills.push(html`<span class="stc-who ${x.edit ? 'ql' : ''}">${x.edit ? 'Quản lý ghi' : 'Nhân viên ghi'}</span>`);   // bước 171
  if (who && book === 'chi' && x.col === 'chi' && Number(x.amount || 0) >= BIG) pills.push(html`<span class="pill warn">Khoản lớn</span>`);
  if (x.edit) {
    const e = x.edit;
    pills.push(html`<span class="pill info">Phiếu bổ sung của quản lý${e.action === 'them' ? ' · thêm' : ''}</span><span class="st-meta">${e.by || ''} · ${e.at || ''}${e.action === 'sua' && e.old_amount != null && Number(e.old_amount) !== Number(x.amount) ? ` · số cũ ${fmt(e.old_amount)} → ${fmt(x.amount)}` : ''}${e.reason ? ' · lý do: ' + e.reason : ''}</span>`);
  }
  if (x.from) pills.push(html`<span class="st-meta">Nợ từ ${x.from}</span>`);
  if (x.status) { const st = x.col === 'lech' ? gapStatus(x.status) : x.status; pills.push(html`<span class="pill ${x.recv === 'cho' || /Chờ/.test(st) ? 'warn' : /Đã/.test(st) ? 'ok' : 'mute'}">${st}</span>`); }
  if (x.col === 'lech' && gapMath(x)) pills.push(html`<span class="pill info">${gapMath(x)}</span>`);
  if (x.col === 'lech' && x.gap && D && !D.ext) {
    const ca = (D.cas || []).find((c) => c.id === x.ca_id);
    const tr = isFin(D, x.ca_id) ? treoOf(D, x.ca_id).filter((t) => t.pm === x.pm) : [];
    pills.push(isFin(D, x.ca_id) ? html`<span class="pill ok">🔒 Ca đã chốt</span>${tr.map((t) => html`<span class="pill ${treoView(t).cls}">Khoản treo · ${treoView(t).label}</span>`)}`
      : ca?.recon_money_done ? html`<button type="button" class="btn sm secondary stc-gapb" data-gap="${x.id}">Phiếu chênh lệch</button>`
      : html`<button type="button" class="btn sm secondary stc-act" data-gap="${x.id}" disabled>Phiếu chênh lệch</button><span class="st-meta">🔒 Xác nhận Fabi ở tab Đối soát Fabi mới xử lý được</span>`);
  }
  if (book === 'chi' && x.col === 'chi') {
    const cs = D ? catSelect(D, x) : null;   // bước 155: chọn nhóm ngay trên dòng (như bản mẫu 18/11)
    pills.push(cs || (x.cat ? html`<span class="pill mute">${x.cat}</span>` : html`<span class="pill warn">Chưa phân loại</span>`));
    if (x.no_cost) pills.push(html`<span class="pill stc-nc">Không tính chi phí</span>`);
    if (D && !D.ext && x.src === 'move') {   // bước 153: khoản chi nhân viên ghi → phiếu trừ lương
      const ka = kaOf(D, x); const ca = (D.cas || []).find((c) => c.id === x.ca_id); const live = !!ca?.recon_money_done && !isFin(D, x.ca_id) && !D.locked;
      if (ka.length) pills.push(html`<span class="pill warn">Đã chuyển trừ lương · ${ka.map((k) => `${k.name} ${fmt(k.amount)}`).join(', ')}</span>${live ? html`<button type="button" class="btn sm secondary" data-kaundo="${x.id}">Bỏ chuyển</button>` : ''}`);
      else if (live && x.can_edit) pills.push(html`<button type="button" class="btn sm secondary" data-toka="${x.id}">→ Trừ lương</button>`);
    }
  }
  if (x.chia) pills.push(html`<span class="pill info">${x.chia}</span>`);
  if (D && !D.ext && x.book === 'chi' && x.col === 'no' && String(x.id).startsWith('dn:')) pills.push(debtPills(D, x));   // bước 155
  if (x.can_edit) pills.push(x.id.startsWith('dc:') ? html`<button type="button" class="btn sm secondary stc-unc" data-unc="${x.id}">Huỷ thu</button>`
    : html`<button type="button" class="btn sm secondary stc-ed" data-ed="${x.id}">Sửa / Xoá</button>`);
  else if (!quiet && !['dt', 'lech'].includes(x.col) && !x.to_qn) {   // bước 164: ca đang khoá đã có 1 dòng ghi chú
    const ca = x.ca_id ? (D?.cas || []).find((c) => c.id === x.ca_id) : null;
    const why = ca && isFin(D, ca.id) ? 'Ca đã chốt — không sửa được nữa' : ca && !ca.recon_money_done ? 'Xác nhận Fabi ở tab Đối soát Fabi mới sửa được' : ca ? 'Khoản tự động / đổi tiền / đã thành nợ — sửa ở phiếu ca' : 'Sửa ở trang cũ';
    pills.push(html`<button type="button" class="btn sm secondary stc-act" disabled title="${why}">Sửa / Xoá</button><span class="st-meta">🔒 ${why}</span>`);
  }
  return html`<div class="stc-it"><span class="stc-tag t-${x.col}">${colName(book, x.col)}</span>
    <div class="stc-itb"><div class="stc-itt">${x.title}</div><div class="st-meta">${x.meta || ''}</div>${pills.length ? html`<div class="stc-pills">${pills}</div>` : ''}</div>
    <span class="stc-amt ${book}">${sg(book)}${fmt(x.amount)}</span></div>`;
}
function cells(byCol, book, totalV, cols = COLS[book]) {
  return html`${cols.map(([k]) => html`<span class="stc-c ${byCol[k] ? '' : 'z'}">${byCol[k] ? fmt(byCol[k]) : ''}</span>`)}<span class="stc-c tot">${fmt(totalV)}</span>
    <span class="stc-chips">${COLS[book].filter(([k]) => byCol[k]).map(([k, l]) => html`<span>${l} <b>${fmt(byCol[k])}</b></span>`)}</span>`;
}
// bước 151: khôi phục phiếu đã xoá = thêm lại phiếu y hệt (ca đã xác nhận Fabi, chưa chốt; hoặc khoản ngoài ca quản lý tạo)
function canRestore(D, x) {
  if (!D || D.ext || D.locked || !x.void || x.void_info?.action !== 'xoa' || !['chi', 'khac'].includes(x.col)) return false;
  // đã có phiếu y hệt còn hiệu lực (đã khôi phục rồi) → ẩn nút, tránh thêm trùng
  if ((D.items || []).some((o) => !o.void && o.id !== x.id && (o.ca_id ?? null) === (x.ca_id ?? null) && o.date === x.date && o.book === x.book
    && o.pm === x.pm && Number(o.amount) === Number(x.amount) && o.title === x.title)) return false;
  if (x.src === 'move') { const ca = (D.cas || []).find((c) => c.id === x.ca_id); return !!ca && ca.recon_money_done && !isFin(D, ca.id); }
  return x.src === 'entry' && !x.ca_id;
}
async function restoreDialog(D, x) {
  const kind = x.book === 'chi' ? 'chi' : 'thu'; const pay = x.pm === 'ck' ? 'chuyen_khoan' : 'tien_mat';
  const cat = (await cats()).find((c) => c.name === x.cat && c.kind === kind);
  const d = dialog(form(`Khôi phục phiếu đã xoá · ${dm(x.date)}`, html`<div class="st-meta">Thêm lại phiếu y hệt: <b>${x.title}</b> · ${PM[x.pm]} · ${sg(kind)}${fmt(x.amount)}${x.cat ? ' · ' + x.cat : ''}. Phiếu đã xoá vẫn hiện gạch ngang.</div>`));
  d.querySelector('[name=reason]').value = 'Khôi phục phiếu xoá nhầm';
  open(d, async () => {
    const rs = val(d, 'reason'); if (!rs) throw new Error('Ghi lý do.');
    if (x.src === 'move') await rpc('app_stc_move_save', { p_report: x.ca_id, p_mkey: null, p: { kind: pay, amount: (kind === 'chi' ? -1 : 1) * Number(x.amount), note: x.title, category_id: cat?.id || null }, p_reason: rs });
    else await rpc('app_stc_entry_save', { p_id: null, p: { branch_id: D.branch.id, entry_date: x.date, kind, amount: Number(x.amount), note: x.title, pay_method: pay, category_id: cat?.id || null }, p_reason: rs });
    after('Đã khôi phục phiếu');
  });
}
function addBtn(D, c, book, label, { noLock = false } = {}) {
  if (D.ext) return D.locked ? off(`+ Thêm khoản ngoài`, 'btn sm secondary') : html`<button type="button" class="btn sm secondary stc-xadd">+ Thêm khoản ngoài</button>`;
  if (String(c.caId).startsWith('o:')) return html`<button type="button" class="btn sm secondary stc-add">+ Thêm phiếu ${book} ngoài ca</button>`;
  const ca = (D.cas || []).find((x) => x.id === c.caId);
  const go = html` <a class="btn sm secondary" href="${q({ tab: 'doi-soat', cot: '' })}&ds=${c.caId}">Xử lý ca này ở Đối soát Fabi ›</a>`;
  if (ca && isFin(D, ca.id)) return html`<span class="st-meta">🔒 Ca đã chốt — không thêm / sửa được nữa</span>`;
  if (noLock && D.locked) return '';   // duyệt mã: ghi chú "Tháng đã chốt" đã có ở đầu ca
  if (ca && ca.done && !D.locked) return html`<span class="st-meta">🔒 Ca đã hoàn thành đối soát — Mở lại ở bước 6 mới thêm / sửa được. </span>${P.tab === 'doi-soat' ? '' : go}`;   // bước 171
  if (ca && !ca.recon_money_done) return noLock ? '' : html`<span class="st-meta">🔒 Chưa xác nhận Fabi — </span>${go}`;
  const bo = book === 'chi' && (P.tab === 'doi-soat' ? DSB.pm : P.pm) === 'ck' ? html`<button type="button" class="btn sm secondary" data-bankout="${c.caId}">Phiếu chi chuyển khoản</button>` : '';   // bước 153
  return ca?.recon_money_done ? html`<button type="button" class="btn sm secondary stc-addca" data-addca="${c.caId}" data-book="${book}">+ Thêm phiếu ${book} vào ${label.toLowerCase()}</button>${bo}${P.tab === 'doi-soat' ? '' : go}`
    : html`<button type="button" class="btn sm secondary stc-addca" disabled title="Chốt tiền ca ở tab Đối soát tiền mới thêm được">+ Thêm phiếu ${book} vào ${label.toLowerCase()}</button><span class="st-meta"> 🔒 chốt tiền ca mới thêm được</span>`;
}
// ---- bước 155: tính năng bản mẫu 18/11 còn thiếu — chọn nhóm trên dòng, người nợ trên dòng Cho nợ, Chi theo loại, phần mỗi cơ sở chịu
function catSelect(D, x) {
  if (D.ext || !FTV || D.locked || x.void) return null;
  const isMove = String(x.id).startsWith('m:');
  // khoản của ca: chọn nhóm được khi ca chưa chốt (không đổi tiền; máy chủ chặn ca đã chốt); khoản ngoài ca: như nút Sửa
  if (isMove ? (x.src !== 'move' || isFin(D, x.ca_id) || kaOf(D, x).length) : !(String(x.id).startsWith('e:') && x.can_edit)) return null;
  const types = (FTV.types || []).filter((t) => t.kind === 'chi' && t.active !== false);
  const cats = (FTV.cats || []).filter((c) => c.kind === 'chi' && c.active !== false);
  const opt = (c) => html`<option value="${c.id}" ${x.cat === c.name ? 'selected' : ''}>${c.name}</option>`;
  const loose = cats.filter((c) => !types.some((t) => String(t.id) === String(c.type_id)));
  return html`<select class="input sm stc-cat ${x.cat || x.no_cost ? '' : 'need'}" data-catx="${x.id}" aria-label="Nhóm chi"><option value="">— Chọn nhóm —</option>
    ${types.map((t) => { const cc = cats.filter((c) => String(c.type_id) === String(t.id)); return cc.length ? html`<optgroup label="${t.name}">${cc.map(opt)}</optgroup>` : ''; })}${loose.map(opt)}
    ${isMove ? html`<option value="x" ${x.no_cost && !x.cat ? 'selected' : ''}>Không tính</option>` : ''}</select>`;
}
async function setCat(D, x, v) {
  if (String(x.id).startsWith('m:')) {
    const [, rid, ...mk] = String(x.id).split(':');
    await rpc('app_tc_check', { p_report: Number(rid), p_mkey: mk.join(':'), p_category: v && v !== 'x' ? Number(v) : null, p_excluded: v === 'x', p_checked: !!v });
  } else {
    await rpc('app_stc_entry_save', { p_id: idNum(x.id), p: { entry_date: x.date, kind: 'chi', amount: Number(x.amount), note: x.title, pay_method: x.pm === 'ck' ? 'chuyen_khoan' : 'tien_mat', category_id: v ? Number(v) : null }, p_reason: 'Chọn nhóm' });
  }
  after(v ? 'Đã chọn nhóm' : 'Đã bỏ nhóm');
}
const debtName = (x) => String(x.title || '').replace(/^Nợ (TM|CK)\s*[:–-]\s*/, '');
function debtPills(D, x) {
  const name = debtName(x); const pp = (D.people || []).find((q) => q.name === name);
  const od = (D.open_debts || []).find((o) => o.id === 'd:' + idNum(x.id));
  const pd = D.debt_paid?.[idNum(x.id)];
  const st = !od ? html`<span class="pill ok">Đã thu${pd ? ' · ' + paidTxt(pd) : ' hết'}</span>` : html`<span class="pill mute">Còn nợ ${fmt(od.left)}</span>`;
  const names = [...new Set([name, ...(D.people || []).map((q) => q.name)])].filter(Boolean);
  const sel = x.can_edit ? html`<label class="stc-who">Người nợ <select class="input sm" data-whox="${x.id}" aria-label="Người nợ">${names.map((n) => html`<option value="${n}" ${n === name ? 'selected' : ''}>${n}${(D.people || []).find((q) => q.name === n)?.no_remind ? ' ✓' : ''}</option>`)}<option value="__add">+ Thêm người nợ…</option></select></label>` : '';
  return html`${sel}${pp?.no_remind ? html`<span class="pill ok">✓ Không nhắc thu ở phiếu chốt ca</span>` : html`<span class="pill info">Phiếu chốt ca sẽ nhắc thu</span>`}${st}`;
}
async function setWho(D, x, v, sel) {
  const save = async (name) => rpc('app_stc_debt_save', { p_id: idNum(x.id), p: { name, amount: Number(x.amount), kind: x.pm === 'ck' ? 'ck' : 'muon', date: x.date }, p_reason: 'Đổi người nợ: ' + name });
  if (v !== '__add') { try { await save(v); after('Đã đổi người nợ'); } catch (e) { showSaved(e.message || e, true); sel.value = debtName(x); } return; }
  sel.value = debtName(x);
  addPersonDialog(async (n, nr) => { await save(n); await rpc('app_stc_person_mark', { p_branch: D.branch.id, p_name: n, p_no_remind: nr }); after('Đã thêm người nợ'); });
}
// bước 164: hộp Thêm người nợ dùng chung (đổi người nợ trên dòng Cho nợ + cửa sổ 👥 Người nợ)
function addPersonDialog(onSave) {
  const d = dialog(form('Thêm người nợ', html`<label class="field"><span>Tên người nợ</span><input class="input" name="name" placeholder="vd: Kho Tổng"></label>
    <label class="stc-chk"><input type="checkbox" name="nr" checked> ✓ Không cần nhắc thu ở phiếu chốt ca</label>`, ' '));
  open(d, async () => { const n = val(d, 'name'); if (!n) throw new Error('Nhập tên người nợ.'); await onSave(n, !!d.querySelector('[name=nr]').checked); });
}
// bước 164: cửa sổ 👥 Người nợ (Sổ chi) — chỉ gom việc đã có: danh sách, ✓ không nhắc, thêm người
function peopleDialog(D) {
  const d = dialog(html`<div class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">👥 Người nợ</h2>${peopleBox(D)}
    <div class="toolbar" style="justify-content:space-between"><button type="button" class="btn sm secondary" data-padd title="Ghi một khoản Cho nợ với tên người mới">+ Thêm người nợ</button><button type="button" class="btn sm" data-x>Đóng</button></div></div>`);
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  d.addEventListener('change', (ev) => { const c = ev.target.closest('[data-person]'); if (c) { d.close(); personMark(D, c.dataset.person, c.checked); } });
  d.querySelector('[data-padd]').addEventListener('click', () => {   // duyệt mã: người nợ chỉ có khi có khoản Cho nợ → mở + Thêm phiếu loại Cho nợ
    d.close(); const b = document.querySelector('#stc-book .stc-ch .stc-add'); if (b) addPanel(D, b, 'chi', { preset: 'no' }); });
}
// ---- bước 154: ảnh phiếu Fabi chốt ca (nhân viên chụp) — trước ở bước Tiền của Đối soát ca (đã bỏ ở bước 152)
const phBtn = (c) => html`<button type="button" class="btn sm secondary" data-dsphoto="${c.id}">📷 Ảnh phiếu Fabi</button>`;
async function photoDialog(D, caId) {
  const ca = (D.cas || []).find((c) => c.id === caId);
  const d = dialog(html`<div class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">Ảnh phiếu Fabi chốt ca · ${ca ? caName(ca) : ''}</h2>
    <div class="stc-photos" id="stc-ph"><div class="st-meta">Đang tải…</div></div>
    <div class="toolbar" style="justify-content:space-between"><a class="btn sm secondary" href="#/ca/phieu?id=${caId}">Mở phiếu chốt ca ›</a><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
  d.querySelector('[data-x]').addEventListener('click', () => d.close());
  d.querySelector('a').addEventListener('click', () => d.close());
  const box = d.querySelector('#stc-ph');
  try {
    const R = await rpc('app_ca_get', { p_id: caId });
    const ph = (R.photos || []).filter((x) => x.kind === 'ipos');
    if (!ph.length) { box.innerHTML = str(html`<div class="st-meta">Ca này chưa có ảnh phiếu Fabi.</div>`); return; }
    box.innerHTML = str(html`${ph.map((x) => html`<figure data-path="${x.path}"><a target="_blank" rel="noopener"><img alt="Ảnh phiếu Fabi" loading="lazy"></a></figure>`)}`);
    const { data } = await sb.storage.from('phieu-ca').createSignedUrls(ph.map((x) => x.path), 3600);
    const u = new Map((data || []).map((x) => [x.path, x.signedUrl]));
    box.querySelectorAll('figure[data-path]').forEach((f) => { const url = u.get(f.dataset.path); if (url) { f.querySelector('img').src = url; f.querySelector('a').href = url; } });
  } catch (e) { box.innerHTML = str(html`<div class="alert error">Không mở được ảnh: ${e.message || e}</div>`); }
}
// ---- bước 153: phiếu trừ lương / → Trừ lương / phiếu chi chuyển khoản
const mkeyOf = (x) => String(x.id).split(':').slice(2).join(':');
const kaOf = (D, x) => (D.shortfalls || []).filter((k) => k.item === 'am_tien' && k.report_id === x.ca_id && k.move_mkey && k.move_mkey === mkeyOf(x));
let EMPS = null;
const emps = async () => (EMPS ||= rpc('app_ca_employees').then((r) => r || []).catch(() => []));
const empOpts = (list, cur) => list.map((e) => html`<option value="${e.id}" ${Number(cur) === Number(e.id) ? 'selected' : ''}>${e.code ? e.code + ' – ' : ''}${e.name}</option>`);
async function kaEditDialog(D, k) {
  if (!k) return; const list = await emps();
  const d = dialog(form(`Sửa phiếu trừ lương · ca ${k.shift} ${dm(k.date)}`, html`
    <label class="field"><span>Nhân viên chịu</span><select class="input" name="emp">${empOpts(list, k.employee_id)}</select></label>
    <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(k.amount)}"></label>
    <label class="field"><span>Trạng thái</span><select class="input" name="st">${[['tru_luong', 'Trừ lương'], ['da_bu', 'Đã nộp bù'], ['mien', 'Miễn (ghi lý do)']].map(([v, l]) => html`<option value="${v}" ${k.status === v ? 'selected' : ''}>${l}</option>`)}</select></label>
    <div class="st-meta">Nhân viên được báo khi đổi người / số tiền / trạng thái.</div>`));
  d.querySelector('[name=reason]').value = k.note || '';
  open(d, async () => { await rpc('app_ka_edit', { p_id: k.id, p_employee: Number(val(d, 'emp')), p_amount: money(d, 'amount'), p_status: val(d, 'st'), p_note: val(d, 'reason') || null }); after('Đã sửa phiếu trừ lương'); });
}
function kaDelDialog(D, k) {
  if (!k) return;
  const d = dialog(form(`Xoá phiếu trừ lương · ${k.name} ${fmt(k.amount)}`, html`<div class="st-meta">Ca ${k.shift} ${dm(k.date)} · ${KA_ITEM[k.item] || k.item}. Nhân viên được báo phiếu đã bỏ. Phần tiền thiếu (nếu có) quay lại dòng chênh lệch của ca.</div>`));
  open(d, async () => { const r = val(d, 'reason'); if (!r) throw new Error('Ghi lý do.'); await rpc('app_ka_delete', { p_id: k.id, p_note: r }); after('Đã xoá phiếu trừ lương'); });
}
async function toKaDialog(D, x) {
  if (!x) return; const list = await emps(); const amt = Number(x.amount);
  const row = (i) => html`<div class="stc-tlp" style="display:flex;gap:6px;flex-wrap:wrap"><select class="input" name="emp_${i}" style="flex:1 1 160px;min-width:0"><option value="">— Chọn nhân viên —</option>${empOpts(list, null)}</select>
    <input class="input" name="amt_${i}" inputmode="numeric" data-money placeholder="Số tiền" value="${i ? '' : fmt(amt)}" style="flex:0 1 120px;min-width:0"></div>`;
  const d = dialog(form(`→ Trừ lương · ${x.title} ${fmt(amt)}`, html`<div class="st-meta">Khoản chi nhân viên ghi thật ra là tiền nhân viên phải chịu. Khoản vẫn là tiền ra khỏi két nhưng thành <b>Không tính chi phí</b>, và tạo phiếu trừ lương (nhân viên được báo, gửi giải trình được). Tổng phải đúng ${fmt(amt)}.</div>
    ${[0, 1, 2].map(row)}`));
  d.querySelector('[name=reason]').value = x.title;
  open(d, async () => {
    const ps = [0, 1, 2].map((i) => ({ employee_id: Number(val(d, 'emp_' + i)), amount: money(d, 'amt_' + i) })).filter((p) => p.employee_id && p.amount > 0);
    if (!ps.length) throw new Error('Chọn nhân viên và số tiền.');
    const tot = ps.reduce((a, p) => a + p.amount, 0); if (tot !== amt) throw new Error(`Tổng ${fmt(tot)} — phải đúng ${fmt(amt)}.`);
    await rpc('app_tc_move_to_ka', { p_report: x.ca_id, p_mkey: mkeyOf(x), p_people: ps, p_reason: val(d, 'reason') || null }); after('Đã chuyển thành trừ lương');
  });
}
function kaUndoDialog(D, x) {
  if (!x) return;
  const d = dialog(form(`Bỏ chuyển trừ lương · ${x.title}`, html`<div class="st-meta">Phiếu trừ lương của khoản này bị bỏ (nhân viên được báo); khoản chi trở lại chờ chọn nhóm.</div>`));
  open(d, async () => { await rpc('app_tc_move_ka_undo', { p_report: x.ca_id, p_mkey: mkeyOf(x) }); after('Đã bỏ chuyển trừ lương'); });
}
function bankOutDialog(D, caId) {
  const ca = (D.cas || []).find((c) => c.id === caId);
  const d = dialog(html`<div class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">Phiếu chi chuyển khoản · ${ca ? caName(ca) : 'ca'}</h2>
    <div class="st-meta">Tiền đã đi ra khỏi tài khoản trong ca (trả tiền hàng, chủ / quản lý rút…). Xoá được khi ghi nhầm. Tạo / xoá: Chủ, Quản lý tổng, Kế toán.</div>
    <div id="stc-bo" class="stack" style="gap:8px"><div class="st-meta">Đang tải…</div></div>
    <div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Đóng</button></div></div>`);
  let changed = false;
  d.querySelector('[data-x]').addEventListener('click', () => { d.close(); if (changed) after('Đã cập nhật phiếu chi chuyển khoản'); });
  const load = () => mountBankOuts(d.querySelector('#stc-bo'), caId, () => { changed = true; load(); });
  load();
}
// ---- bước 152: bộ lọc đầy đủ (thay trang Thu chi cũ)
const HINT = { thu: { dt: 'khách trả TM / CK trên Fabi', no: 'khách trả nợ cũ, từng khoản', khac: 'bán đồ cũ, thu khác', lc: 'đổi TM ↔ CK, chuyển quỹ', lech: 'ca dư tiền' },
  chi: { chi: 'phiếu ca, lương, QL tạo', no: 'khách mượn TM, nợ CK', lc: 'đổi TM ↔ CK, chuyển quỹ', lech: 'ca thiếu tiền' } };   // bước 154: như bản mẫu 18/11
const SRC_OPTS = [['', 'Mọi nguồn'], ['ca', 'Từ phiếu ca'], ['tay', 'Quản lý tạo (ngoài ca)'], ['bu', 'Nộp bù khoản âm'], ['lech', 'Chênh lệch']];
const ST_OPTS = [['', 'Mọi trạng thái'], ['todo', 'Chưa phân loại'], ['cho', 'Chờ xử lý'], ['tl', 'Có trừ lương'], ['void', 'Đã xoá'], ['fin', 'Ca đã chốt'], ['open', 'Ca chưa chốt']];
const TL_ST = { tru_luong: 'Trừ lương', da_bu: 'Đã nộp bù', mien: 'Miễn', huy: 'Đã huỷ' };
function filterBar(book) {   // bước 164: mỗi ô chọn ghi tên trước giá trị, ô đang lọc tô nâu; điện thoại gom vào ⚙ Lọc
  const f = parseLoc(P.loc); const nOn = ['src', 'type', 'cat', 'st'].filter((k) => f[k]).length;
  const wrap = (k, label, ctl) => html`<label class="stc-fl ${f[k] ? 'on' : ''}"><span>${label}</span>${ctl}</label>`;
  const sel = (k, opts, label, help = {}) => wrap(k, label, html`<select class="input sm" data-lf="${k}" aria-label="${label}">${opts.map(([v, l]) => html`<option value="${v}" ${f[k] === v ? 'selected' : ''}>${v ? l : 'Tất cả'}${help[v] ? ' — ' + help[v] : ''}</option>`)}</select>`);
  return html`<div class="stc-flt" role="search">
    <input class="input sm stc-q" type="search" data-lf="q" value="${f.q}" placeholder="Tìm nội dung, nhóm, người, giải trình…" aria-label="Tìm">
    <button type="button" class="btn sm secondary stc-fbtn">⚙ Lọc${nOn ? ` (${nOn})` : ''}</button>
    ${sel('src', SRC_OPTS, 'Nguồn')}
    ${wrap('type', 'Loại', html`<select class="input sm" data-lf="type" aria-label="Loại"><option value="">Tất cả</option>${f.type ? html`<option value="${f.type}" selected>…</option>` : ''}</select>`)}
    ${wrap('cat', 'Nhóm', html`<select class="input sm" data-lf="cat" aria-label="Nhóm"><option value="">Tất cả</option>${f.cat ? html`<option value="${f.cat}" selected>${f.cat}</option>` : ''}</select>`)}
    ${sel('st', ST_OPTS, 'Trạng thái', ST_HELP)}
    <button type="button" class="btn sm secondary" id="stc-lfclr" ${P.loc ? '' : 'hidden'}>Bỏ lọc</button></div>`;
}
const ST_HELP = { todo: 'khoản chi chưa chọn nhóm', cho: 'ca dư / thiếu chưa xử lý', tl: 'hiện danh sách phiếu trừ lương', void: 'phiếu đã xoá (gạch ngang)' };
// dòng "Đang lọc:" — mỗi điều kiện một nút ✕, Bỏ hết, số khoản · tổng tiền
function locRow(f, n, sum) {
  const names = { src: SRC_OPTS, st: ST_OPTS, type: Object.fromEntries(((FTV && FTV.types) || []).map((t) => [String(t.id), t.name])) };
  return html`<div class="stc-locrow"><span class="stc-lcl">Đang lọc:</span>${locChips(f, names).map((c) => html`<button type="button" class="stc-chip" data-unloc="${c.k}">${c.label} ✕</button>`)}<button type="button" class="stc-lnk" data-unloc="all">Bỏ hết</button><span class="stc-lcn">${n} khoản · ${fmt(sum)}</span></div>`;
}
const peopleBtn = (D, book) => (book === 'chi' && !D.ext ? html`<button type="button" class="btn sm secondary" data-people="1">👥 Người nợ</button>` : '');
// Điền Loại / Nhóm theo danh mục thu chi (tải chậm, không chặn trang)
async function fillFilter(D, book) {
  const r = await finTypes(); const f = parseLoc(P.loc); const kind = book === 'thu' ? 'thu' : 'chi';
  const ts = (r.types || []).filter((t) => t.active !== false && (!t.kind || t.kind === kind));
  const cs = (r.cats || []).filter((c) => c.active !== false && c.kind === kind && (!f.type || String(c.type_id) === String(f.type)));
  const ty = $('select[data-lf="type"]'); const ca = $('select[data-lf="cat"]'); if (!ty || !ca) return;
  ty.innerHTML = str(html`<option value="">Tất cả</option>${ts.map((t) => html`<option value="${t.id}" ${String(f.type) === String(t.id) ? 'selected' : ''}>${t.name}</option>`)}`);
  ca.innerHTML = str(html`<option value="">Tất cả</option>${cs.map((c) => html`<option value="${c.name}" ${f.cat === c.name ? 'selected' : ''}>${c.name}</option>`)}`);
}
// Có lọc: danh sách phẳng theo ngày · ca. "Có trừ lương" lấy cả 2 bảng (phiếu trừ lương không thuộc bảng tiền nào).
const KA_ITEM = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', am_tien: 'Âm tiền (khoản chi)', thu_chi: 'Thu chi', cong_no: 'Công nợ' };
// bước 153: mọi phiếu trừ lương của tháng (kể cả loại không gắn dòng chênh lệch) + Sửa / Xoá như trang Thu chi cũ
function kaList(D, f) {
  const qq = fold(f.q).trim();
  const list = (D.shortfalls || []).filter((k) => !qq || fold([k.name, k.reason, k.reply, k.note, KA_ITEM[k.item]].filter(Boolean).join(' · ')).includes(qq));
  const gapOf = (k) => D.items.find((x) => x.col === 'lech' && x.ca_id === k.report_id && x.gap && x.pm === (k.item === 'chuyen_khoan' ? 'ck' : 'tm'));
  const rows = list.map((k) => { const live = !isFin(D, k.report_id) && !D.locked; const g = ['tien_mat', 'chuyen_khoan'].includes(k.item) ? gapOf(k) : null;
    return html`<div class="stc-fr"><div class="st-meta stc-frh">${dm(k.date)} · Ca ${k.shift} · ${KA_ITEM[k.item] || k.item}</div>
      <div class="stc-tlr"><span><b>${k.name}</b> · ${TL_ST[k.status] || 'Chờ xử lý'}${k.reason ? html`<br><span class="st-meta">Lý do: ${k.reason}</span>` : ''}
        ${k.reply ? html`<br><span class="st-meta">Giải trình: “${k.reply}”</span>` : ''}${k.note ? html`<br><span class="st-meta">Ghi chú: ${k.note}</span>` : ''}</span><b>${fmt(k.amount)}</b></div>
      <div class="stc-tlr"><span class="st-meta">${live ? '' : '🔒 Ca đã chốt — không sửa được'}</span><span class="stc-tools">${live ? html`<button type="button" class="btn sm secondary" data-kaed="${k.id}">Sửa</button><button type="button" class="btn sm secondary" data-kadel="${k.id}">Xoá</button>` : ''}${g && live ? html`<button type="button" class="btn sm secondary" data-gap="${g.id}">Mở phiếu chênh lệch</button>` : ''}</span></div></div>`; });
  return html`<div class="stc-ch"><h2>Phiếu trừ lương · đang lọc</h2></div>${locRow(f, list.length, list.reduce((a, k) => a + Number(k.amount || 0), 0))}
    ${rows.length ? html`<div class="stc-its stc-flat">${rows}</div>` : html`<div class="stc-empty">Không có phiếu trừ lương nào khớp bộ lọc.</div>`}`;
}
function bookFlat(D, book, f) {
  if (f.st === 'tl') return kaList(D, f);
  const n = COLS[book].length;
  const base = D.items.filter((x) => x.book === book && (f.st === 'tl' || x.pm === P.pm) && (!P.cot || x.col === P.cot));
  const list = filterItems(base, f, { fin: (id) => isFin(D, id) }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const caOf = (x) => (D.cas || []).find((c) => c.id === x.ca_id);
  const tlRows = (x) => (f.st === 'tl' ? ((x.gap && x.gap.tl) || []).map((t) => html`<div class="stc-tlr ${t.status === 'huy' ? 'void' : ''}"><span><b>${t.name}</b> · ${TL_ST[t.status] || 'Chờ xử lý'}
      ${t.reply ? html`<br><span class="st-meta">Giải trình: “${t.reply}”</span>` : ''}</span><b>${fmt(t.amount)}</b></div>`) : '');
  let lastD = '';
  const rows = list.map((x) => { const c = caOf(x); const dh = x.date !== lastD ? html`<div class="stc-dh">${dm(x.date)} <small>${wd(x.date)}</small></div>` : ''; lastD = x.date;
    return html`${dh}<div class="stc-fr"><div class="st-meta stc-frh">${c ? 'Ca ' + c.shift : 'Ngoài ca'}${x.pm === 'ck' ? ' · CK' : ' · TM'}</div>
      ${itemRow(x, book, D)}${tlRows(x)}${f.st === 'tl' && x.gap ? html`<div class="stc-tlr"><span class="st-meta">${isFin(D, x.ca_id) ? '🔒 Ca đã chốt — không huỷ được' : ''}</span><button type="button" class="btn sm secondary" data-gap="${x.id}">Mở phiếu chênh lệch</button></div>` : ''}</div>`; });
  const fsum = sumItems(list.filter((x) => !x.void));
  return html`<div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[P.pm]}${P.cot ? html` · chỉ hiện <span class="stc-tag t-${P.cot}">${colName(book, P.cot)}</span>` : ''} · đang lọc</h2>
      <span class="stc-tools">${peopleBtn(D, book)}${D.ext ? off('+ Thêm phiếu', 'btn sm') : html`<button type="button" class="btn sm stc-add">+ Thêm phiếu</button>`}</span></div>${locRow(f, list.length, fsum)}
    <div class="stc-g stc-hdr" style="--n:${n}"><span>Khoản</span>${COLS[book].map(([, l]) => html`<span>${l}</span>`)}<span>Tổng</span></div>
    ${rows.length ? html`<div class="stc-its stc-flat">${rows}</div><div class="stc-sum"><span>Cộng</span><b>${fmt(fsum)}</b></div>` : html`<div class="stc-empty">Không có khoản nào khớp bộ lọc.</div>`}`;
}
// bước 164: cột nhìn thấy của bảng ngày (ẩn cột cả tháng bằng 0 theo bảng tiền đang xem, trừ cột đang chọn)
const hiddenCols = (D, book) => (SHOW_ZERO ? [] : zeroCols(D.items || [], book, P.pm, P.cot || ''));
// bước 164: trạng thái của ca ghi một lần ở dòng ca; ca không thêm / sửa được → 1 dòng ghi chú đầu danh sách khoản
const caPill = (D, cx) => (!cx ? '' : D.locked ? html`<span class="pill mute stc-cst">🔒 Tháng đã chốt</span>` : cx.recon_money_done ? html`<span class="pill ok stc-cst">Đã xác nhận Fabi</span>` : html`<span class="pill info stc-cst">⏳ Chưa xác nhận Fabi</span>`);
const caLock = (D, cx) => (!cx ? null : D.locked ? { t: '🔒 Tháng đã chốt: không thêm / sửa được', why: 'Tháng đã Chốt tháng — Chủ mở lại tháng mới sửa được' }
  : !cx.recon_money_done ? { t: '⏳ Chưa xác nhận Fabi: chưa thêm / sửa được', why: 'Xác nhận Fabi ở tab Đối soát Fabi mới thêm / sửa được khoản của ca' } : null);
const visCols = (D, book) => { const h = hiddenCols(D, book); return COLS[book].filter(([k]) => !h.includes(k)); };
function bookCard(D, book) {
  const lf = parseLoc(P.loc); if (locStr(lf)) return bookFlat(D, book, lf);
  if (P.cot) return colView(D, book, P.cot);   // bước 164
  const days = dayTree(D, book, P.pm, P.cot || null);
  const cols = visCols(D, book); const hid = hiddenCols(D, book); const n = cols.length;
  const caLabel = (c) => (c.shift === 'Ngoài ca' ? 'Ngoài ca' : 'Ca ' + c.shift);
  const rows = days.map((d) => {
    const o = OPEN_D.has(d.date);
    const cas = [...d.cas, ...(d.outside.items.length ? [{ caId: 'o:' + d.date, shift: 'Ngoài ca', staff: 'Quản lý ghi', total: d.outside.total, byCol: d.outside.byCol, items: d.outside.items }] : [])];
    return html`<div class="stc-day ${o ? 'open' : ''}"><button type="button" class="stc-drow stc-g" style="--n:${n}" data-day="${d.date}" aria-expanded="${o}">
        <span class="stc-lab"><span class="stc-chev">›</span>${dm(d.date)} <small>${wd(d.date)}</small></span>${cells(d.byCol, book, d.total, cols)}</button>
      ${o ? html`<div class="stc-cas">${cas.map((c) => { const co = OPEN_C.has(String(c.caId)); const cx = (D.cas || []).find((x) => x.id === c.caId); const lk = D.ext ? null : caLock(D, cx); return html`<div class="stc-ca ${co ? 'open' : ''}">
          <button type="button" class="stc-crow stc-g" style="--n:${n}" data-ca="${c.caId}" aria-expanded="${co}"><span class="stc-lab"><span class="stc-chev">›</span>${caLabel(c)} <small>${c.staff || ''}</small>${D.ext ? '' : caPill(D, cx)}</span>${cells(c.byCol, book, c.total, cols)}</button>
          ${co ? html`<div class="stc-its">${lk ? html`<div class="st-meta stc-calock" title="${lk.why}">${lk.t} · <a href="${q({ tab: 'doi-soat', cot: '' })}&ds=${c.caId}">Xử lý ca này ở Đối soát Fabi ›</a></div>` : ''}${c.items.length ? c.items.map((x) => itemRow(x, book, D, { quiet: !!lk })) : html`<div class="st-meta stc-empty">Không có khoản ${book === 'thu' ? 'thu' : 'chi'} ${PM[P.pm].toLowerCase()}.</div>`}
            <div class="stc-it add">${addBtn(D, c, book, caLabel(c), { noLock: !!lk })}</div></div>` : ''}</div>`; })}</div>` : ''}</div>`;
  });
  return html`<div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[P.pm]} <small>${P.cot ? `chỉ hiện ${colName(book, P.cot)}` : 'theo ngày · bấm ngày để xem từng ca'}</small></h2>
      <span class="stc-tools">${P.cot ? html`<a class="btn sm secondary" href="${q({ cot: '' })}">Bỏ lọc</a>` : ''}<button type="button" class="btn sm secondary stc-all">Mở hết</button><button type="button" class="btn sm secondary stc-none">Thu gọn</button>${peopleBtn(D, book)}${D.ext ? off('+ Thêm phiếu', 'btn sm') : html`<button type="button" class="btn sm stc-add">+ Thêm phiếu</button>`}</span></div>
    ${hid.length ? html`<div class="st-meta stc-hidecols">Đang ẩn cột ${hid.map((k) => colName(book, k)).join(', ')} (cả tháng bằng 0) · <button type="button" class="stc-lnk" data-showzero="1">hiện lại</button></div>` : ''}
    <div class="stc-g stc-hdr" style="--n:${n}"><span>Ngày</span>${cols.map(([k, l]) => html`<span class="${P.cot === k ? 'hl' : ''}">${l}</span>`)}<span>Tổng ${book}</span></div>
    ${rows.length ? rows : html`<div class="stc-empty">Tháng này chưa có khoản nào.</div>`}`;
}
// Quỹ ngoài › Sổ chi: phần mỗi cơ sở chịu (tạm tính theo cách chia); theo tỉ lệ doanh thu thì Chốt tháng tính
function qnShare(D) {
  const brs = (D.branches || []).map((b) => b.code); if (!brs.length) return '';
  const chis = (D.items || []).filter((x) => !x.void && x.book === 'chi' && x.col === 'chi');
  const share = Object.fromEntries(brs.map((b) => [b, 0])); let byRev = 0, other = 0;
  chis.forEach((x) => { const c = x.chia || ''; const a = Number(x.amount || 0);
    if (c.startsWith('Chia đều')) brs.forEach((b) => { share[b] += a / brs.length; });
    else if (c.startsWith('1 cơ sở: ')) { const b = c.slice(9); if (b in share) share[b] += a; else other += a; }
    else if (c.startsWith('Theo tỉ lệ')) byRev += a; else other += a; });
  return html`<section class="stc-box"><h3>Phần mỗi cơ sở chịu <small class="st-meta">tạm tính</small></h3>
    ${brs.map((b) => html`<div class="stc-si"><span><b>${b}</b></span><b>${fmt(Math.round(share[b]))}</b></div>`)}
    ${byRev ? html`<div class="stc-si"><span>Theo tỉ lệ doanh thu tháng<br><span class="st-meta">chia ở Chốt tháng</span></span><b>${fmt(byRev)}</b></div>` : ''}
    ${other ? html`<div class="stc-si"><span>Không chia / tự nhập / chưa chọn cách chia</span><b>${fmt(other)}</b></div>` : ''}
    <div class="st-meta stc-note">Tính vào chi phí của cơ sở ở Chốt tháng. Thanh toán kho tổng không chia lại (đã tính theo từng hoá đơn).</div></section>`;
}
// bước 164: các khung của cột phải cũ, chỉ hiện khi bấm ô tương ứng (colView)
const sbox = (title, body, note = '') => html`<section class="stc-box"><h3>${title}</h3>${body}${note ? html`<div class="st-meta stc-note">${note}</div>` : ''}</section>`;
function debtBox(D) {
  const today = vnToday();
  const rows = (D.open_debts || []).map((d) => { const days = Math.max(0, Math.round((new Date(today) - new Date(d.date)) / 864e5)); return html`<div class="stc-si stc-kd"><span><b>${d.who}</b> ${d.no_remind ? html`<span class="pill ok">✓ không nhắc</span>` : ''}<br><span class="st-meta">${d.from} · <span class="${days > 7 ? 'stc-red' : ''}">${days} ngày</span></span></span><span class="stc-r"><b>${fmt(d.left)}</b>${D.ext ? '' : html`<button type="button" class="btn sm secondary stc-col" data-col-debt="${d.id}">Thu nợ</button>`}</span></div>`; });
  return sbox(`Khách còn nợ · ${rows.length}`, rows.length ? rows : html`<div class="st-meta">Không còn ai nợ.</div>`, 'Gồm cả nợ hoá đơn (chưa phải tiền nên không nằm trong sổ). Đỏ khi quá 7 ngày.');
}
function peopleBox(D) {
  const rows = (D.people || []).map((p) => html`<label class="stc-si stc-pp"><span><input type="checkbox" data-person="${p.name}" ${p.no_remind ? 'checked' : ''} ${D.ext ? 'disabled' : ''}> <b>${p.name}</b><br>
      <span class="st-meta">${p.n ? `${p.n} khoản còn nợ · ` : ''}${p.no_remind ? '✓ không nhắc ở phiếu chốt ca' : 'phiếu chốt ca nhắc thu'}</span></span><b>${p.open ? fmt(p.open) : ''}</b></label>`);
  return sbox('Người nợ', rows.length ? rows : html`<div class="st-meta">Chưa có người nợ có tên.</div>`, 'Có dấu ✓: phiếu chốt ca không nhắc thu người này. Khách luôn được nhắc.');
}
function catBox(D) {
  const its = D.items.filter((x) => !x.void && x.book === 'chi' && x.col === 'chi');
  const cost = its.filter((x) => x.cat && !x.no_cost); const totalCost = sumItems(cost);
  const tnames = Object.fromEntries(((FTV && FTV.types) || []).map((t) => [String(t.id), t.name]));
  const tgroups = [...new Set(cost.map((x) => String(x.cat_type ?? '')))].map((t) => { const xs = cost.filter((x) => String(x.cat_type ?? '') === t);
    return { t: tnames[t] || (t ? 'Loại khác' : 'Chưa có loại'), v: sumItems(xs), cs: [...new Set(xs.map((x) => x.cat))].map((c) => [c, sumItems(xs.filter((x) => x.cat === c))]).sort((a, b) => b[1] - a[1]) }; }).sort((a, b) => b.v - a.v);
  return sbox(`Chi theo loại · TM + CK · ${fmt(totalCost)}`, tgroups.length ? tgroups.map((g) => html`<div class="stc-tyg"><div class="stc-tyh"><span>${g.t}</span><b>${fmt(g.v)}</b></div><div class="stc-bar"><i style="width:${totalCost ? Math.round(g.v / totalCost * 100) : 0}%"></i></div>
      ${g.cs.map(([c, v]) => html`<div class="stc-tyc"><span>${c}</span><b>${fmt(v)}</b></div>`)}</div>`) : html`<div class="st-meta">Chưa có khoản chi.</div>`,
    `Không cộng ${fmt(sumItems(its.filter((x) => x.no_cost)))} của các khoản Không tính chi phí. Chi phí Quỹ ngoài và tiền hàng kho tổng xem ở Chốt tháng.`);
}
// bấm một ô số → danh sách từng khoản của loại đó (theo bảng tiền đang xem) + khung liên quan
function colView(D, book, col) {
  const list = D.items.filter((x) => x.book === book && x.pm === P.pm && x.col === col).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const live = list.filter((x) => !x.void); const sum = sumItems(live);
  const caOf = (x) => (D.cas || []).find((c) => c.id === x.ca_id);
  const row = (x) => html`<div class="stc-fr"><div class="st-meta stc-frh">${dm(x.date)} · ${caOf(x) ? 'Ca ' + caOf(x).shift : 'Ngoài ca'}</div>${itemRow(x, book, D)}</div>`;
  const sect = (h, xs) => (xs.length ? html`<div class="stc-sech">${h} · ${xs.length}</div>${xs.map(row)}` : '');
  let top = '', body;
  if (book === 'thu' && col === 'no') { top = debtBox(D); body = sect('Đã thu nợ tháng này', list); }
  else if (book === 'chi' && col === 'chi') { top = html`${D.ext ? qnShare(D) : ''}${catBox(D)}`; const todo = list.filter((x) => !x.void && !x.cat); body = html`${sect('⚠ Cần phân loại', todo)}${sect('Đã phân loại', list.filter((x) => !todo.includes(x)))}`; }
  else if (book === 'chi' && col === 'no') { top = peopleBox(D); body = sect('Các khoản cho nợ', list); }
  else body = list.map(row);
  return html`<div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[P.pm]} · chỉ hiện <span class="stc-tag t-${col}">${colName(book, col)}</span> <small>${live.length} khoản · ${fmt(sum)}</small></h2>
      <span class="stc-tools"><a class="btn sm secondary" href="${q({ cot: '' })}">✕ Bỏ lọc</a>${peopleBtn(D, book)}${D.ext ? off('+ Thêm phiếu', 'btn sm') : html`<button type="button" class="btn sm stc-add">+ Thêm phiếu</button>`}</span></div>
    ${top ? html`<div class="stc-boxes">${top}</div>` : ''}
    ${list.length ? html`<div class="stc-its stc-flat">${body}</div><div class="stc-sum"><span>Cộng</span><b>${fmt(sum)}</b></div>` : html`<div class="stc-empty">Không có khoản nào.</div>`}`;
}
function bookPage(D, book) {   // bước 164: 1 nút chuyển 2 nửa + 1 hàng ô số (bấm ô = chỉ xem loại đó), bỏ cột phải
  const its = D.items;
  const sw = html`<div class="stc-sw">${['tm', 'ck'].map((pm) => html`<a class="stc-pay ${P.pm === pm ? 'on' : ''}" href="${q({ pm })}"><span class="k">${PM[pm]}</span><span class="v">${sg(book)}${fmt(sumItems(its, { book, pm }))}</span></a>`)}</div>`;
  const tiles = COLS[book].map(([k, l]) => {
    const t = tileInfo(D, book, P.pm, k); const on = P.cot === k;
    return html`<a class="stc-tile ${on ? 'on' : ''} ${t.warn ? 'warn' : ''} ${t.zero && !on ? 'zero' : ''}" data-col="${k}" href="${q({ cot: on ? '' : k })}"><span class="stc-tag t-${k}">${l}</span><b>${fmt(t.v)}</b>${on ? html`<small class="stc-tsel">đang lọc ✕</small>` : t.sub ? html`<small>${t.sub}</small>` : ''}</a>`;
  });
  return html`<div class="stc-head">${sw}<div class="stc-tiles stc-t5">${tiles}</div></div>
    <div class="st-meta stc-formula">Tổng ${book} tháng ${Number(String(P.thang || '').slice(5, 7))} = ${COLS[book].map(([, l]) => l).join(' + ')} · bấm một ô để chỉ xem khoản loại đó</div>
    <section class="card stc-book">${filterBar(book)}<div id="stc-book">${bookCard(D, book)}</div></section>`;
}
function tongPage(D) {   // bước 166 (KH5): mẫu B — Việc cần làm | Ai còn nợ lên đầu (khung có giới hạn), bỏ 5 ô nhỏ, So với trang cũ thu gọn cuối trang
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
  const cmp = ext ? '' : html`<details class="card stc-cmp"><summary>So với trang cũ <small>(trong lúc chạy song song)</small> · ${cmpRows.length ? html`<span class="pill warn">${cmpRows.length} chỗ khác</span>` : html`<span class="pill ok">Khớp trang cũ ✓</span>`}</summary>
    ${cmpRows.length ? html`<div class="st-meta">Những chỗ trang mới khác Sổ quỹ / Lệch tiền ca cũ:</div>${cmpRows}` : ''}
    <div class="st-meta stc-note">Khác dự kiến ở ngày quản lý từng sửa tay số nộp quỹ cuối ngày, và ngày hôm nay (kế toán chưa nhập đủ).</div></details>`;
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
  // ----- 2 khung đầu trang (chỉ cơ sở)
  let top = '';
  if (!ext) {
    const todos = todoItems(D, F.waitQN);
    const act = (t) => {
      if (t.kind === 'xn') return html`<a class="btn sm secondary" href="${q({ tab: 'doi-soat', cot: '' })}&ds=${t.ref.id}">Mở ›</a>`;
      if (t.kind === 'fabi') return html`<a class="btn sm secondary" href="${q({ tab: 'doi-soat', cot: '' })}&ds=${t.ref.id}">Mở ›</a>`;
      if (t.kind === 'lech') return html`<a class="btn sm secondary" href="${q({ tab: t.ref.book, pm: t.ref.pm, cot: 'lech' })}">Xử lý ›</a>`;
      if (t.kind === 'cat') return html`<a class="btn sm secondary" href="${q({ tab: 'chi', pm: t.ref.pm, cot: 'chi' })}">Phân loại ›</a>`;
      return D.owner ? html`<button type="button" class="btn sm" data-qnok="${idNum(t.ref.id)}">Đã nhận tiền</button>` : html`<span class="st-meta">chờ Chủ</span>`;
    };
    const nRed = todos.filter((t) => t.red).length;
    const todoBox = html`<section class="card stc-todo"><h3>Việc cần làm <small>${todos.length ? `${todos.length} việc${nRed ? ' · đỏ = làm trước' : ''}` : ''}</small></h3>
      <div class="stc-scroll">${todos.length ? todos.map((t) => html`<div class="stc-ti" data-kind="${t.kind}"><span class="stc-dot ${t.red ? 'red' : ''}"></span><span class="stc-tt">${t.text}${t.sub ? html`<br><span class="st-meta">${gapStatus(t.sub)}</span>` : ''}</span>${t.amount != null ? html`<b class="stc-amt">${fmt(t.amount)}</b>` : html`<span></span>`}${act(t)}</div>`)
        : html`<div class="st-meta stc-none0">Không còn gì. 👍</div>`}</div></section>`;
    const G = debtGroups(D.open_debts, vnToday());
    const nP = G.main.length + G.fam.length;
    const person = (g) => html`<details class="stc-dp"><summary><span class="stc-tt"><b>${g.who}</b>${g.no_remind ? html` <span class="pill ok">✓ không nhắc</span>` : ''}<br><span class="st-meta">${g.n} khoản · lâu nhất <span class="${g.maxDays > 7 && !g.no_remind ? 'stc-red' : ''}">${g.maxDays} ngày</span></span></span><b class="stc-amt">${fmt(g.total)}</b></summary>
      ${g.ks.map((k) => html`<div class="stc-si stc-dk"><span class="st-meta">${k.from || dm(k.date)} · <span class="${k.days > 7 && !g.no_remind ? 'stc-red' : ''}">${k.days} ngày</span></span><span class="stc-r"><b>${fmt(k.left)}</b><button type="button" class="btn sm secondary stc-col" data-col-debt="${k.id}">Thu nợ</button></span></div>`)}</details>`;
    const debtBox2 = html`<section class="card stc-debts"><h3>Ai còn nợ <small>${nP ? html`${nP} người · ${fmt(G.total)}${G.late ? html` · <span class="stc-red">${G.late} người quá 7 ngày</span>` : ''}` : ''}</small></h3>
      <div class="stc-scroll">${nP ? html`${G.main.map(person)}${G.fam.length ? html`<details class="stc-fam"><summary>Người nhà / Kho Tổng (✓ không nhắc) · ${fmt(G.fam.reduce((s, g) => s + g.total, 0))}</summary>${G.fam.map(person)}</details>` : ''}`
        : html`<div class="st-meta stc-none0">Không còn ai nợ.</div>`}</div>
      ${nP ? html`<div class="st-meta stc-note">Gồm cả nợ hoá đơn. Bấm tên để xem từng khoản. Đỏ khi quá 7 ngày.</div>` : ''}</section>`;
    top = html`<div class="stc-top2">${todoBox}${debtBox2}</div>`;
  }
  const qnBox = html`<section class="card stc-side"><h3>${ext ? 'Tiền các cơ sở chuyển về' : 'Chuyển về Quỹ ngoài'} <small>${incoming.length} lần · ${fmt(sumItems(incoming))}${waitN ? ` · ${waitN} chờ Chủ nhận` : ''}</small></h3>
      ${incoming.length ? incoming.map((x) => html`<div class="stc-si stc-qnl"><span><b>${ext ? (x.from || '') + ' · ' : ''}${x.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} · ${dm(x.date)}</b><br>${x.title.includes(' · ') ? html`<span class="st-meta">${x.title.split(' · ').slice(1).join(' · ')}</span><br>` : ''}<span class="pill ${x.recv === 'cho' ? 'warn' : 'ok'}">${x.status || ''}</span>
        ${x.recv === 'cho' ? html`${D.owner ? html` <button type="button" class="btn sm" data-qnok="${idNum(x.id)}">Đã nhận tiền</button>` : ''}${ext ? '' : html` <button type="button" class="btn sm secondary" data-qned="${idNum(x.id)}">Sửa / Xoá</button>`}` : html` <span class="st-meta">🔒</span>`}</span><b>${fmt(x.amount)}</b></div>`)
        : html`<div class="st-meta">Tháng này chưa có.</div>`}
      <div class="st-meta stc-note">Thay cho phiếu rút cũ. Chủ bấm "Đã nhận tiền" thì khoá cả 2 bên.</div></section>`;
  const kqBox = ext ? '' : html`<section class="card stc-side"><h3>Kiểm quỹ <button type="button" class="btn sm secondary stc-kq">Kiểm quỹ</button></h3>
      <div class="st-meta stc-kqlast">Lần cuối: đang tải…</div><div id="stc-kqbox"><div class="st-meta">Đang tải…</div></div></section>`;
  return html`${top}
    <div class="stc-bigs">${big(`Tồn ${name}`, F.tm.ton + F.ck.ton, `${ext ? 'Chỉ Chủ thấy · ' : ''}Tiền mặt + Tài khoản`)}
      ${big('Tiền mặt', F.tm.ton, hot ? `quá ${fmt(ALERT)} · nên chuyển về Quỹ ngoài` : ext ? 'Chủ giữ' : 'gồm 1.000.000 gối đầu trong két', hot ? 'hot' : '')}
      ${big('Tài khoản', F.ck.ton, 'theo sổ')}</div>
    <div class="st-meta stc-formula">${ext ? html`<b>Tồn Quỹ ngoài</b> = Tồn đầu tháng + Tổng thu (gồm tiền các cơ sở chuyển về) − Tổng chi (chi ngoài)`
      : html`<b>Tồn quỹ</b> = Tồn đầu tháng + Tổng thu − Tổng chi − Chuyển về Quỹ ngoài`}</div>
    <section class="card stc-tong">
      <div class="stc-ch"><h2>Tồn ${name} <small>${monthLabel(P.thang)} · cách tính</small></h2></div>
      <div class="stc-tfs">${tf('tm')}${tf('ck')}</div>
      <div class="stc-tools stc-pad">${ext ? html`<span class="st-meta">Thêm khoản chi / thu ngoài ở tab Sổ chi / Sổ thu.</span>` : html`<button type="button" class="btn sm stc-qnadd">+ Chuyển về Quỹ ngoài</button><button type="button" class="btn sm secondary stc-lcadd">+ Luân chuyển tiền mặt ↔ tài khoản</button><button type="button" class="btn sm secondary stc-kq">Kiểm quỹ</button>`}</div>
      <div class="stc-ch"><h2>Tồn quỹ theo ngày</h2><span class="stc-tools">${['tm', 'ck'].map((pm) => html`<a class="btn sm ${P.pm === pm ? '' : 'secondary'}" href="${q({ pm })}">${PM[pm]}</a>`)}</span></div>
      <div class="stc-dg stc-hdr"><span>Ngày</span><span>Đầu ngày</span><span>+ Thu</span><span>− Chi</span><span>${ext ? '' : '− Về Quỹ ngoài'}</span><span>Cuối ngày</span></div>
      ${daily.length ? daily.map((d) => html`<div class="stc-dg stc-dd"><span class="stc-lab">${dm(d.date)} <small>${wd(d.date)}</small></span><span class="stc-c">${fmt(d.start)}</span><span class="stc-c">${d.thu ? '+' + fmt(d.thu) : '–'}</span><span class="stc-c">${d.chi ? '−' + fmt(d.chi) : '–'}</span><span class="stc-c">${d.toQN ? '−' + fmt(d.toQN) : ''}</span><span class="stc-c tot end">${fmt(d.end)}</span></div>`)
        : html`<div class="stc-empty">Tháng này chưa có khoản nào.</div>`}
    </section>
    <div class="stc-two">${qnBox}${kqBox}</div>
    ${cmp}`;
}
let DS_SEL = null;   // ca đang mở ở tab Đối soát Fabi
let DS_B = null;   // bước 171: bước mở theo đường dẫn b=1..6 (dùng 1 lần)
let DS_PARAM = '';   // tham số ds= đã dùng (không ép lại sau mỗi lần vẽ)
const DSB = { book: 'thu', pm: 'tm', step: 0, stepFor: null };   // sổ / bảng đang xem ở phần B
const isFin = (D, id) => !!(D.finals && D.finals[id]);
const caName = (c) => `Ca ${c.shift} ${dm(c.date)}`;
const treoOf = (D, id) => (D.treo || []).filter((t) => Number(t.report_id) === Number(id));
// phần A: các nút của Fabi + tiền thực nhận (gọi app_stc_ds_* — máy chủ kiểm quyền và luật)
function dsAct(D, b) {
  const c = (D.cas || []).find((x) => String(x.id) === String(DS_SEL)); if (!c) return;
  const title = caName(c);
  const ask = (h, body, needReason, fn, msg) => {
    const d = dialog(html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">${h} · ${title}</h2>${body}
      <label class="field"><span>Lý do${needReason ? ' (bắt buộc)' : ' (không bắt buộc)'}</span><input class="input" name="reason"></label>
      <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Lưu</button></div></form>`);
    open(d, async () => { if (needReason && !val(d, 'reason')) throw new Error('Ghi lý do.'); await fn(d); after(msg); });
  };
  const run = async (fn, msg) => { try { await fn(); after(msg); } catch (e) { showSaved(e.message, true); } };
  const f = c.fabi || {}, nv = c.nv || {};
  if (b.dataset.dsfabi) {
    const k = b.dataset.dsfabi; const L = { mo: ['Tiền mở ca', nv.opening, f.opening], dt: ['Doanh thu', nv.revenue, f.revenue], no: ['Nợ bill', nv.debt, f.debt] }[k];
    const more = k === 'no' && Number(f.debt) > Number(nv.debt);
    ask('Lấy số máy Fabi', html`<div class="st-meta">${L[0]}: phiếu nhân viên ghi ${fmt(L[1] ?? 0)} → máy Fabi ${fmt(L[2] ?? 0)}. Web sửa số trên phiếu nhân viên theo máy, lưu số cũ → mới và người sửa.</div>
      ${k === 'dt' ? html`<div class="st-meta">Phiếu thu không đổi: sổ luôn lấy doanh thu máy Fabi.</div>` : k === 'mo' ? html`<div class="st-meta">Chỉ sửa số trên phiếu nhân viên, không tạo phiếu thu / chi.</div>` : ''}
      ${more ? html`<label class="field"><span>Người nợ phần chênh ${fmt(Number(f.debt) - Number(nv.debt))} (thêm khách nợ ở Công nợ — không tạo phiếu chi; để trống nếu không thêm)</span><input class="input" name="name" list="stc-people"><datalist id="stc-people">${(D.people || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist></label>` : ''}`,
      false, (d) => rpc('app_stc_ds_fabi', { p_report: c.id, p_field: k, p_name: more ? val(d, 'name') || null : null, p_reason: val(d, 'reason') || null }), 'Đã lấy số máy Fabi');
  } else if (b.dataset.dsblame) {
    const who = b.dataset.dsblame;
    ask(who === 'nay' ? 'Ca này ghi sai tiền mở ca' : 'Ca trước ghi sai', html`<div class="st-meta">${who === 'nay' ? 'Tiền đầu ca của ca này tính bằng số phải là — phần lệch thành dòng Chênh lệch tiền mặt của ca này.'
      : 'Tiền thực tế ca trước để lại tính bằng số mở ca của ca này — phần lệch thành dòng Chênh lệch tiền mặt của ca trước.'}</div>`, true,
      (d) => rpc('app_stc_ds_blame', { p_report: c.id, p_who: who, p_reason: val(d, 'reason') }), 'Đã chọn ca chịu lệch mở ca');
  } else if (b.dataset.dsunblame) {
    ask('Huỷ chọn ca chịu lệch mở ca', html`<div class="st-meta">Tiền mở ca trở lại như trước khi chọn.</div>`, true, (d) => rpc('app_stc_ds_blame_undo', { p_report: c.id, p_reason: val(d, 'reason') }), 'Đã huỷ chọn');
  } else if (b.dataset.dsmode) {
    run(() => rpc('app_stc_ds_cash', { p_report: c.id, p_mode: b.dataset.dsmode, p_counted: b.dataset.dsmode === 'ca' ? c.ql_counted ?? null : null }), b.dataset.dsmode === 'ca' ? 'Thu theo ca' : 'Thu theo ngày');
  } else if (b.dataset.dscash) {
    const v = parseMoney(document.querySelector('.stc-dsp [name=ds_tm]')?.value || ''); if (v == null) { showSaved('Nhập tiền mặt thực nhận.', true); return; }
    run(() => rpc('app_stc_ds_cash', { p_report: c.id, p_mode: c.cash_mode === 'ca' ? 'ca' : 'ngay', p_counted: v }), 'Đã lưu tiền mặt thực nhận');
  } else if (b.dataset.dsclose) {
    run(async () => { await rpc('app_stc_ds_close', { p_report: c.id }); DSB.step = 2; DSB.book = 'thu'; }, 'Đã xác nhận Fabi — bước 3, 4, 5 đã mở');
  } else if (b.dataset.dsreopen) {
    ask('Mở lại xác nhận Fabi', html`<div class="st-meta">Mở lại để sửa số Fabi / nhân viên ghi / tiền thực nhận. Thu chi của ca khoá sửa tới khi xác nhận lại.</div>`, false,   // bước 160: không bắt ghi lý do
      (d) => rpc('app_stc_ds_reopen', { p_report: c.id, p_reason: val(d, 'reason') || null }), 'Đã mở lại xác nhận');
  } else if (b.dataset.tick) {   // bước 171: mục quản lý tự tích
    const on = !(c.ticks || []).includes(b.dataset.tick);
    run(() => rpc('app_stc_tick', { p_report: c.id, p_item: b.dataset.tick, p_on: on }), on ? 'Đã tích' : 'Đã bỏ tích');
  } else if (b.dataset.dssau) {
    const k = 'sau_' + b.dataset.dssau; const on = !(c.ticks || []).includes(k);
    run(() => rpc('app_stc_tick', { p_report: c.id, p_item: k, p_on: on }), on ? 'Để sau — ca hiện 🟠 tới khi xử lý' : 'Đã bỏ Để sau');
  } else if (b.dataset.dsdone) {
    run(() => rpc('app_stc_ds_done', { p_report: c.id }), 'Đã hoàn thành đối soát ca');
  } else if (b.dataset.dsundone) {
    run(() => rpc('app_stc_ds_undone', { p_report: c.id }), 'Đã mở lại — sửa xong bấm Hoàn thành đối soát ca lần nữa');
  } else if (b.dataset.dsfinal) {
    const { need, treo } = finalNeeds(c, D.items);
    if (need.length) { showSaved(need.join(' · '), true); return; }
    const d = dialog(html`<form class="stack stc-dlg" style="gap:10px"><h2 style="margin:0">🔒 Chốt ca · ${title}</h2>
      <div class="stc-ck"><span>✓ Đã xác nhận Fabi</span><span>✓ Khoản chi đã phân loại hết</span><span>✓ Không còn khoản chờ Chủ duyệt</span><span>✓ Tiền mặt thiếu đã xử lý</span></div>
      ${treo.map((t) => html`<div class="stc-tr0">Chênh lệch ${t.pm === 'tm' ? 'tiền mặt' : 'chuyển khoản'} ${t.kind === 'tien' ? 'thiếu' : 'thừa'} <b>${fmt(t.amount)}</b> chưa xong → khi chốt thành <b>Khoản treo</b>
        ${t.kind === 'tien' ? html`<b>chờ tiền về</b> (hạn 3 ngày; quá hạn thì trừ tiền nhân viên hoặc quán chịu)` : html`<b>tiền thừa chờ ghép</b> (tới hết tháng; chưa ghép thì thành Thu khác)`}.</div>`)}
      <div class="alert warn">Sau khi chốt: thu chi, phiếu chênh lệch, số Fabi của ca này <b>không sửa được nữa</b> (không có nút mở lại).</div>
      <div class="stc-err"></div><div class="toolbar" style="justify-content:flex-end"><button type="button" class="btn sm secondary" data-x>Huỷ</button><button class="btn sm" type="submit">Chốt vĩnh viễn</button></div></form>`);
    open(d, async () => { const r = await rpc('app_stc_ca_final', { p_report: c.id }); after((r?.treo || []).length ? `Đã chốt ca · ${r.treo.length} khoản chuyển sang Khoản treo (tab Tổng)` : 'Đã chốt ca'); });
  }
}
function dsInfo(D) {
  const dates = [...new Set((D.cas || []).map((c) => c.date))].sort();
  const chains = Object.fromEntries(dates.map((d) => [d, dayChain(D, d)]));
  const all = (D.cas || []).map((c) => { const link = chains[c.date].get(c.id); const cs = caChecks(c, link); const gaps = caGaps(D.items, c.id);
    return { c, link, cs, gaps, st: caStage(c, cs, D.finals?.[c.id], treoOf(D, c.id).some((t) => t.status === 'mo'), gaps) }; });
  return { dates, all };
}
// ---- phần A · Fabi
// bước 157: nợ của ca ngay dưới ô Nợ bill — hiện ngay khi nhân viên gửi phiếu (không chờ Xác nhận Fabi). Chỉ xem.
// bước 159: khách trả nợ MỘT LẦN, đủ cả khoản — ghi ngày / ca trả; đưa thiếu thì hỏi trước, phần còn thiếu thành nợ mới
const paidTxt = (p) => (p ? `${dm(p.date)}${p.shift ? ' ca ' + p.shift : ' · quản lý thu'} · ${p.pm === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'}` : '');
const shortOk = (left, amt) => !(amt > 0 && amt < left) || confirm(`Khách đưa thiếu ${fmt(left - amt)}. Khoản nợ ghi đã trả đủ ${fmt(left)}, phần còn thiếu ${fmt(left - amt)} ghi thành nợ mới (tiền đưa từ quỹ). Đồng ý?`);
const DEBT_TAG = { bill: ['HĐ', 'hd', ''], muon: ['TM', 'tm', 'két thiếu'], ck: ['CK', 'ck', 'hotline thiếu'] };
function debtList(D, c) {
  const xs = (D.ca_debts || []).filter((x) => Number(x.report_id) === Number(c.id));
  if (!xs.length) return '';
  const moi = xs.filter((x) => x.t === 'moi'), tra = xs.filter((x) => x.t === 'tra');
  const rowMoi = (x) => { const [lab, cls, why] = DEBT_TAG[x.kind] || DEBT_TAG.bill; const a = Number(x.amount), l = Number(x.left);
    const st = l <= 0 ? html`<span class="pill ok">đã trả${D.debt_paid?.[x.id] ? ' · ' + paidTxt(D.debt_paid[x.id]) : ''}</span>` : '';
    return html`<div class="stc-cdr" data-t="moi"><span class="stc-dtag d-${cls}">${lab}</span><span><b>${x.who || '—'}</b>${why ? html` <span class="st-meta">· ${why}</span>` : ''} ${st}</span><b class="stc-amt">${fmt(a)}</b></div>`; };
  const rowTra = (x) => html`<div class="stc-cdr" data-t="tra"><span class="stc-dtag d-tra">Trả</span><span><b>${x.who || '—'}</b> <span class="st-meta">· ${x.pm === 'chuyen_khoan' ? 'chuyển khoản' : 'tiền mặt'} · nợ từ ${x.from || '—'}</span></span><b class="stc-amt">+${fmt(x.amount)}</b></div>`;
  return html`<div class="stc-cadebt">
    ${moi.length ? html`<div class="stc-cdh">Nợ mới trong ca · ${moi.length} khoản</div>${moi.map(rowMoi)}` : ''}
    ${tra.length ? html`<div class="stc-cdh">Khách trả nợ cũ trong ca</div>${tra.map(rowTra)}` : ''}</div>`;
}
function partA(D, a, part = 1, mk = () => '') {
  const { c, link, cs, st, gaps = [] } = a; const m = link ? link.money : null; const fin = isFin(D, c.id); const f = c.fabi || {}, nv = c.nv || {};
  const kt = c.kt_wait || c.bank_ck == null; const byCa = c.cash_mode === 'ca';
  const last = !(D.cas || []).some((o) => o.date === c.date && SHIFT_ORDER.indexOf(o.shift) > SHIFT_ORDER.indexOf(c.shift));
  const flags = Number(f.edited_bills || 0); const ro = !!D.ext || !!D.locked;
  const warnHd = flags ? html`<div class="stc-warnbox">${mk('hd')} ⚠ Trên máy Fabi ca này có <b>${flags} hoá đơn bị sửa / xoá</b>. Hoá đơn bị sửa / xoá không còn đúng trong doanh thu Fabi — hỏi nhân viên / xem camera, rõ lý do rồi tích mục "Đã hỏi về hoá đơn bị sửa / xoá".</div>` : '';
  const keep = html`${mk('goi') ? html`<div class="st-meta">${mk('goi')} Tiền gối đầu để lại cho ca sau: 1.000.000.</div>` : ''}${mk('ket') ? html`<div class="st-meta">${mk('ket')} Két chuyển nguyên sang ca sau: web tự so tiền đóng ca này với tiền mở ca sau. Lệch thì xử lý ở ô Tiền mở ca của ca sau.</div>` : ''}`;
  if (c.recon_money_done) {
    if (part === 1) return html`<div class="stc-part stc-pa"><div class="h">Số máy Fabi ${phBtn(c)} ${mk('anh')} <span class="st-meta">đã xác nhận Fabi · muốn sửa số: Mở lại xác nhận ở bước 2</span></div><div class="stc-gio" data-gio-ca="${c.id}"></div>
      <div class="stc-stp" id="ds-s1"><div class="stc-fsum"><div><span>Tiền mở ca ${mk('mo')}</span><b>${fmt(f.has ? f.opening ?? 0 : nv.opening ?? 0)}</b></div><div><span>Doanh thu (máy Fabi) ${mk('dt')}</span><b>${fmt(f.revenue ?? nv.revenue ?? 0)}</b></div>
        <div><span>Nợ bill (máy Fabi) ${mk('no')}</span><b>${fmt(f.debt ?? nv.debt ?? 0)}</b></div></div>${warnHd}${debtList(D, c)}</div></div>`;
    return html`<div class="stc-part stc-pa"><div class="stc-stp" id="ds-s2"><div class="h">Tiền thực nhận ${mk('fabi')} <span class="pill ok">✓ Đã xác nhận Fabi</span>${fin || ro ? '' : html`<button type="button" class="btn sm secondary" data-dsreopen="1">Mở lại xác nhận</button>`}</div>
      <div class="stc-fsum"><div><span>Tiền mặt thực nhận ${mk('cash')}</span><b>${m ? fmt(m.tm.real) : '–'}</b></div><div><span>Chuyển khoản thực nhận ${mk('ck')}</span><b>${kt ? 'chờ kế toán' : fmt(c.bank_ck)}</b></div></div>${keep}${gapNote(gaps)}</div>${fixHelp(c)}</div>`;
  }
  const effect = { mo: (x) => (x.blame ? html`<span class="st-meta">→ <b>Có vào sổ:</b> dòng Chênh lệch tiền mặt ${signedFmt(Number(x.blame.diff))} của ${x.blame.who === 'nay' ? 'ca này' : 'ca trước'}.</span>` : x.fix === 'fabi' ? html`<span class="st-meta">→ Lấy số máy: chỉ sửa số trên phiếu nhân viên, không tạo phiếu.</span>` : ''),
    dt: (x) => (x.st === 'red' ? html`<span class="st-meta">→ Phiếu thu không đổi: sổ luôn lấy doanh thu máy Fabi; thiếu tiền thật thì hiện ở dòng Chênh lệch.</span>` : ''),
    no: (x) => (x.st === 'red' && Number(f.debt) > Number(nv.debt) ? html`<span class="st-meta">→ Không tạo phiếu chi: thêm khách nợ ${fmt(Number(f.debt) - Number(nv.debt))} ở Công nợ (bill nợ chưa phải tiền).</span>` : '') };
  const raw = { mo: [nv.opening, f.opening], dt: [nv.revenue, f.revenue], no: [nv.debt, f.debt] };
  const pv = (D.cas || []).find((o) => o.date === c.date && SHIFT_ORDER.indexOf(o.shift) === SHIFT_ORDER.indexOf(c.shift) - 1);
  const prevFin = !!pv && isFin(D, pv.id);   // máy chủ cũng chặn
  const box = (x) => { const [a1, b1] = raw[x.k]; const nvT = Number(a1 ?? 0), fbT = Number(b1 ?? 0);
    const txt = x.st === 'red' && x.fix === 'fabi' ? `🔴 Nhân viên ghi ${nvT > fbT ? 'thừa' : 'thiếu'} ${fmt(nvT - fbT)} so với máy` : x.txt;
    return html`<div class="stc-c4 ${x.st}" data-k="${x.k}"><b>${x.name} ${mk(x.k)}</b><span class="stc-ln">Phiếu nhân viên ghi: <b>${fmt(nvT)}</b></span><span class="stc-ln">Máy Fabi ghi: <b>${f.has ? fmt(fbT) : 'chưa có'}</b></span>
      ${x.k === 'mo' ? html`<span class="st-meta">${x.b}</span>` : ''}<span class="pill ${x.st === 'ok' ? 'ok' : x.st === 'red' ? 'off' : 'info'}">${txt}</span>${effect[x.k](x)}
      ${D.ext ? '' : x.fix === 'fabi' ? html`<span class="stc-tools"><button type="button" class="btn sm" data-dsfabi="${x.k}">Lấy số máy Fabi${x.k === 'no' && Number(f.debt) > Number(nv.debt) ? ` (thêm báo nợ ${fmt(Number(f.debt) - Number(nv.debt))})` : ''}</button></span>`
        : x.fix === 'blame' ? html`<span class="st-meta">Ca nào ghi sai thì ca đó chịu tiền lệch:</span><span class="stc-tools">${prevFin ? html`<span class="st-meta">Ca trước đã chốt ca — không chọn "Ca trước ghi sai" được.</span>` : html`<button type="button" class="btn sm secondary" data-dsblame="truoc">Ca trước ghi sai</button>`}<button type="button" class="btn sm secondary" data-dsblame="nay">Ca này ghi sai</button></span>`
        : x.blame ? html`<span class="stc-tools"><span class="st-meta">${x.blame.by || ''}${x.blame.reason ? ' · ' + x.blame.reason : ''}</span><button type="button" class="btn sm secondary" data-dsunblame="1">Huỷ chọn</button></span>` : ''}</div>`; };
  const s1 = cs.filter((x) => ['mo', 'dt', 'no'].includes(x.k));
  const need = fabiNeeds(c, cs);   // bước 168: cùng luật cũ, gom về so_thu_chi_tinh.js (thanh cuối màn hình dùng chung)
  const r = (lab, a1, b1) => html`<div class="stc-mr"><span>${lab}</span><b>${a1}</b><b>${b1}</b></div>`;
  if (part === 1) return html`<div class="stc-part stc-pa"><div class="h">Số máy Fabi ${phBtn(c)} ${mk('anh')} <span class="st-meta">máy Fabi là chuẩn · so phiếu nhân viên với máy</span></div><div class="stc-gio" data-gio-ca="${c.id}"></div>
    <div class="stc-stp" id="ds-s1"><div class="stc-c4s">${s1.map(box)}</div>${debtList(D, c)}
      ${!f.has ? html`<div class="st-meta">Chưa có file Fabi: ${(c.kt_missing || []).join(', ') || 'chờ kế toán tải'}.</div>` : ''}${warnHd}</div></div>`;
  return html`<div class="stc-part stc-pa"><div class="stc-stp" id="ds-s2"><div class="h">Tiền thực nhận <span class="stc-tools"><button type="button" class="btn sm ${byCa ? '' : 'secondary'}" data-dsmode="ca">Thu theo ca</button><button type="button" class="btn sm ${byCa ? 'secondary' : ''}" data-dsmode="ngay">Thu theo ngày</button></span></div>
      <div class="stc-mt">${r('', 'Tiền mặt', html`Chuyển khoản ${mk('ck')}`)}
        ${r('Phải có / phải nhận', m ? fmt(m.tm.must) : '–', m ? fmt(m.ck.must) : '–')}
        ${r('Thực nhận', byCa ? (c.ql_counted != null ? fmt(c.ql_counted) + ' (quản lý thu)' : 'chưa nhập') : `NV đếm ${fmt(c.nv_counted ?? 0)}`, kt ? 'chờ kế toán' : fmt(c.bank_ck) + ' (kế toán)')}</div>
      ${byCa || last ? html`<div class="stc-cash"><label class="field"><span>Tiền mặt thực nhận${byCa ? ' (quản lý đếm két ca này)' : ' (quản lý đếm két sau ca cuối ngày)'} ${mk('cash')}</span>
          <input class="input money" name="ds_tm" inputmode="numeric" value="${byCa && c.ql_counted != null ? fmt(c.ql_counted) : ''}"></label><button type="button" class="btn sm" data-dscash="1">Lưu</button></div>`
        : html`<div class="st-meta">Thu theo ngày: ca này không nhập, két chuyển sang ca sau; tiền mặt thực nhận nhập ở ca cuối ngày.</div>`}
      ${keep}<div class="st-meta">Chuyển khoản luôn lấy số ngân hàng kế toán nhập.</div></div>
    ${fixHelp(c)}
    <div class="stc-tools stc-a-end">${ro ? '' : html`<button type="button" class="btn" data-dsclose="1" ${need.length ? 'disabled' : ''}>Xác nhận Fabi</button>`} ${mk('fabi')}
      <span class="st-meta">${need.length ? '🔒 Còn thiếu: ' + need.map((n) => n.txt).join(' · ') : gaps.length ? html`Còn lệch <b>${gapShort(gaps)}</b> — vẫn xác nhận được, lệch xử lý ở bước 5.` : 'Đủ điều kiện. Xác nhận xong thì bước 3, 4, 5 mở.'}</span></div></div>`;
}
const signedFmt = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
// bước 161: ghi chú đối soát — số lệch tiền mặt / chuyển khoản của ca và đã xử lý ra sao (tự lấy từ dòng Chênh lệch)
const GAP_DC = { quan_chiu: 'quán chịu', thu_khac: 'ghi Thu khác', treo: 'khoản treo' };
function gapHow(x) {
  const g = x.gap || {}; const out = [];
  (g.tl || []).filter((t) => t.status !== 'huy').forEach((t) => out.push(`trừ lương ${t.name || ''} ${fmt(t.amount)}`));
  (g.decisions || []).forEach((d) => out.push(`${GAP_DC[d.kind] || d.kind} ${fmt(d.amount)}`));
  (g.matches || []).forEach((mm) => out.push(`ghép ${mm.with || ''} ${fmt(mm.amount)}${mm.status === 'cho_duyet' ? ' (chờ Chủ duyệt)' : ''}`));
  (g.qc_wait || []).forEach((q) => out.push(`quán chịu ${fmt(q.amount)} (chờ Chủ duyệt)`));
  (g.debts || []).forEach((d) => out.push(`gán nợ ${d.who || ''} ${fmt(d.amount)}`));
  return out.join(' · ');
}
function gapNote(gaps) {
  if (!gaps.length) return '';
  const all = gaps.every((g) => g.done);
  const line = (g) => { const how = gapHow(g.x);
    return html`<div>${g.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} <b>${g.amt > 0 ? 'dư' : 'thiếu'} ${signedFmt(g.amt)}</b> → ${g.small ? 'lệch nhỏ ≤ 5.000, coi như khớp'
      : g.done ? html`<b>đã xử lý</b>${how ? ' (' + how + ')' : ''}` : html`<b>${g.wait ? 'chờ Chủ duyệt' : 'chưa xử lý'}</b>${how ? ' (' + how + ')' : ''} · xử lý ở phần B, bảng ${PM[g.pm]}`}</div>`; };
  return html`<div class="stc-dsnote ${all ? 'ok' : ''}"><b>Ghi chú đối soát</b>${gaps.map(line)}</div>`;
}
// ---- phần B · Thu chi của ca (giống Sổ thu / Sổ chi, lọc ca này)
// một dòng Chênh lệch + phần "Gồm:" (dùng ở bước 5)
function glRowOf(D, c, x) {
  const parts = gapParts(c, D.cas, x.pm, (x.book === 'thu' ? 1 : -1) * Number(x.gross ?? x.amount));
  return html`${itemRow(x, x.book, D)}${parts.length ? html`<div class="stc-it stc-gparts"><span class="st-meta">Gồm:</span><div class="stc-itb">${parts.map((p) => html`<div class="stc-gpr"><span>${p.label}</span><b>${signedFmt(p.amount)}</b></div>`)}</div><span></span></div>` : ''}`;
}
// bước 171: bk = 'thu' (bước 3 Khoản thu) | 'chi' (bước 4 Khoản chi)
function partB(D, a, bk = null, mk = () => '') {
  const { c, link } = a; const m = link ? link.money : null; const fin = isFin(D, c.id);
  if (!c.recon_money_done) return html`<div class="stc-part stc-pb stc-lockp"><div class="h">B · Thu chi của ca</div><div class="st-meta">🔒 Xác nhận Fabi ở phần A thì phần này mới mở.</div></div>`;
  const book = bk || DSB.book, pm = DSB.pm; const cols = COLS[book]; const n = cols.length; const done = !!c.done; const lk = fin || done;
  const its = D.items.filter((x) => x.ca_id === c.id && x.book === book && x.pm === pm && x.col !== 'lech');
  const by = (col) => sumItems(D.items, { book, pm, col, caId: c.id }); const tot = sumItems(D.items, { book, pm, caId: c.id });
  const byCol = Object.fromEntries(cols.map(([k]) => [k, by(k)]));
  const glAll = D.items.filter((x) => x.ca_id === c.id && x.col === 'lech' && !x.void);
  const gl = glAll.filter((x) => x.book === book && x.pm === pm);
  const other = glAll.filter((x) => !gl.includes(x));
  const kt = c.kt_wait || c.bank_ck == null;
  const r = (lab, a1, b1, cls = '') => html`<div class="stc-mr ${cls}"><span>${lab}</span><b>${a1}</b><b>${b1}</b></div>`;
  const gapB = (g) => (g === 0 ? '✓ Khớp' : signedFmt(g));
  const nb = Number(c.fabi?.debt ?? c.nv?.debt ?? 0);
  const debts = (D.open_debts || []).filter((x) => String(x.from || '').includes(`${c.shift} ${dm(c.date)}`));
  const glRow = (x) => { const parts = gapParts(c, D.cas, x.pm, (x.book === 'thu' ? 1 : -1) * Number(x.gross ?? x.amount));
    return html`${itemRow(x, x.book, D)}${parts.length ? html`<div class="stc-it stc-gparts"><span class="st-meta">Gồm:</span><div class="stc-itb">${parts.map((p) => html`<div class="stc-gpr"><span>${p.label}</span><b>${signedFmt(p.amount)}</b></div>`)}</div><span></span></div>` : ''}`; };
  return html`<div class="stc-part stc-pb"><div class="h">${book === 'thu' ? 'Khoản thu của ca' : 'Khoản chi của ca'} ${mk(book === 'thu' ? 'sot' : 'that')} <span class="st-meta">giống ${book === 'thu' ? 'Sổ thu' : 'Sổ chi'}, chỉ lọc ca này</span>${fin ? html`<span class="pill ok">🔒 khoá</span>` : ''}</div>
    ${done ? html`<div class="stc-warnbox">🔒 Ca đã hoàn thành đối soát nên phiếu đang khoá. Muốn thêm / sửa / xoá phiếu: bấm <b>Mở lại</b> ở bước 6.</div>` : ''}
    <div class="stc-pays" style="margin-top:0">${['tm', 'ck'].map((p) => html`<button type="button" class="stc-pay ${pm === p ? 'on' : ''}" data-dspm="${p}"><span class="k">Bảng ${PM[p]}</span><span class="v">${sg(book)}${fmt(sumItems(D.items, { book, pm: p, caId: c.id }))}</span><span class="s">Tổng ${book} ${caName(c).toLowerCase()}</span></button>`)}</div>
    <div class="st-meta stc-formula"><b>Tổng ${book}</b> = ${cols.filter(([k]) => k !== 'lech').map(([, l], i) => html`${i ? ' + ' : ''}<b>${l}</b>`)} <span class="st-meta">· chênh lệch xem ở bước 5</span></div>
    <div class="stc-tiles">${cols.filter(([k]) => k !== 'lech').map(([k, l]) => html`<div class="stc-tile"><span class="stc-tag t-${k}">${l}${k === 'no' && book === 'thu' ? html` ${mk('tn')}` : ''}${k === 'chi' ? html` ${mk('cat')} ${mk('lon')}` : ''}</span><b>${fmt(byCol[k])}</b></div>`)}</div>
    ${book === 'thu' && (nb || debts.length) ? html`<div class="stc-mt stc-box">${r('Nợ bill của ca (chưa phải tiền · không vào Sổ thu / Sổ chi)', '', 'Số tiền', 'hd')}${r('Phiếu nhân viên khai nợ hoá đơn', '', fmt(c.nv?.debt ?? 0))}${r('Máy Fabi', '', fmt(c.fabi?.debt ?? 0), 't')}
      ${debts.map((x) => r(html`→ Khách đang nợ: <b>${x.who}</b>`, '', fmt(x.left)))}<div class="st-meta">Khoản nợ nằm ở Sổ thu › bấm ô Thu nợ › Khách còn nợ. Khách trả thì ghi Thu nợ ở ca nhận tiền.</div></div>` : ''}
    <section class="card stc-book stc-cab"><div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[pm]} <small>${caName(c)}</small></h2>${lk || D.locked ? '' : html`<span class="stc-tools"><button type="button" class="btn sm stc-addca" data-addca="${c.id}" data-book="${book}">+ Thêm phiếu</button></span>`}</div>
      <div class="stc-g stc-hdr" style="--n:${n}"><span>Ca</span>${cols.map(([, l]) => html`<span>${l}</span>`)}<span>Tổng ${book}</span></div>
      <div class="stc-ca open"><div class="stc-crow stc-g" style="--n:${n}"><span class="stc-lab">${caName(c)} <small>${c.staff || ''}</small></span>${cells(byCol, book, tot)}</div>
        <div class="stc-its">${its.length ? its.map((x) => itemRow(x, book, D, { who: true })) : html`<div class="st-meta stc-empty">Không có khoản ${book} ${PM[pm].toLowerCase()}.</div>`}
          <div class="stc-it add">${fin ? html`<span class="st-meta">🔒 Ca đã chốt — không thêm / sửa được nữa</span>` : done ? html`<span class="st-meta">🔒 Ca đã hoàn thành đối soát — Mở lại ở bước 6 để thêm / sửa</span>` : addBtn(D, { caId: c.id }, book, 'ca ' + c.shift)}</div></div></div></section>
    <div class="st-meta"><span class="stc-who">Nhân viên ghi</span> là phiếu trên phiếu chốt ca · <span class="stc-who ql">Quản lý ghi</span> là phiếu quản lý thêm hoặc sửa khi đối soát, kèm lý do.</div></div>`;
}
// ---- 🔒 Chốt ca
// Ca sau cùng ngày nhận két của ca này phải xong ô "Tiền mở ca" (có Fabi, khớp hoặc đã chọn ca chịu) — máy chủ kiểm lại cả ca sau chưa gửi phiếu.
function nextNeed(D, c) {
  const i = SHIFT_ORDER.indexOf(c.shift); if (i < 0 || i >= SHIFT_ORDER.length - 1) return null;
  const nx = (D.cas || []).find((o) => o.date === c.date && o.shift === SHIFT_ORDER[i + 1]); if (!nx) return null;
  const mo = caChecks(nx, dayChain(D, c.date).get(nx.id)).find((k) => k.k === 'mo');
  return nx.fabi?.has && mo?.st === 'ok' ? null : `Ca ${nx.shift} (ca sau) chưa xong tiền mở ca — xử lý ở ca ${nx.shift} trước`;
}
function partFinal(D, a) {
  const { c } = a; const fin = D.finals?.[c.id];
  if (fin) { const tr = treoOf(D, c.id);
    return html`<div class="stc-fin done"><b>🔒 Đã chốt ca</b><span class="st-meta">${fin.by || ''} · ${fin.at || ''} — khoá vĩnh viễn: thu chi, phiếu chênh lệch, số Fabi của ca không sửa được nữa.</span>
      ${tr.length ? html`<span class="st-meta">Khoản treo: ${tr.map((t) => `${t.pm === 'tm' ? 'TM' : 'CK'} ${fmt(t.amount)} (${treoView(t).label})`).join(' · ')} — <a href="${q({ tab: 'tong' })}">xem tab Tổng ›</a></span>` : ''}</div>`; }
  if (D.ext) return '';
  const { need, treo } = finalNeeds(c, D.items);
  const nn = nextNeed(D, c); if (nn) need.push(nn);
  if (D.locked) need.push('Tháng đã chốt');
  return html`<div class="stc-fin"><button type="button" class="btn sm" data-dsfinal="1" ${need.length ? 'disabled' : ''}>🔒 Chốt ca</button>
    <span class="st-meta">${need.length ? '🔒 ' + need.join(' · ') : treo.length ? `Đủ điều kiện. ${treo.length} khoản còn chờ sẽ thành Khoản treo.` : 'Đủ điều kiện chốt. Chốt xong khoá vĩnh viễn.'}</span></div>`;
}
// ---- bước 171 (đợt A): mở 1 ca = 6 bước, mỗi bước có khung "Quản lý cần kiểm tra". Mục nào có, xong chưa: dsChecks (so_thu_chi_tinh.js).
const CHK = {
  mo: ['Tiền mở ca khớp tiền ca trước để lại', 'Lệch thì chọn ca nào ghi sai, ca đó chịu tiền lệch'],
  dt: ['Doanh thu trên phiếu khớp máy Fabi', 'Lệch thì bấm "Lấy số máy Fabi"'],
  no: ['Nợ bill trên phiếu khớp máy Fabi', 'Lệch thì bấm "Lấy số máy Fabi"'],
  hd: ['Đã hỏi về hoá đơn bị sửa / xoá trên máy', 'Hỏi nhân viên hoặc xem camera, rõ lý do rồi tích'],
  anh: ['Ảnh phiếu Fabi in cuối ca đúng với số máy', 'Bấm 📷 xem ảnh, so doanh thu, tiền mặt, chuyển khoản'],
  cash: ['Đã đếm két và nhập tiền mặt thực nhận', 'Quản lý tự đếm, không lấy số nhân viên đếm'],
  ck: ['Chuyển khoản đã có số ngân hàng', 'Số này kế toán nhập; chưa có thì ca chờ kế toán'],
  goi: ['Két để lại đúng 1.000.000 cho ca sau', 'Tiền gối đầu; thiếu thì ca sau báo lệch tiền mở ca'],
  ket: ['Tiền đóng ca này bằng tiền mở ca sau', 'Web tự so với ô Tiền mở ca của ca sau'],
  fabi: ['Đã Xác nhận Fabi', 'Bấm nút Xác nhận Fabi ở cuối bước này; xong thì bước 3, 4, 5 mở'],
  tn: ['Thu nợ đúng khách, đúng tiền mặt / chuyển khoản', 'Khách chuyển khoản mà ghi tiền mặt thì két sẽ thiếu'],
  sot: ['Không sót khoản thu ngoài bán hàng', 'Ví dụ bán vỏ chai, khách trả nợ mà nhân viên quên ghi'],
  cat: ['Mọi khoản chi đã chọn nhóm', 'Chọn nhóm = đã kiểm khoản đó'],
  that: ['Khoản chi là thật, đúng số tiền', 'Khoản lạ hoặc không rõ nội dung thì hỏi nhân viên'],
  lon: ['Đã xem kỹ khoản từ 300.000 trở lên', 'Khoản lớn có nhãn vàng "Khoản lớn"'],
  tm: ['Tiền mặt lệch đã chọn cách xử lý', 'Lệch từ 5.000 trở xuống coi như khớp; chưa xử lý được thì bấm Để sau'],
  ck5: ['Chuyển khoản lệch đã chọn cách xử lý', 'Như tiền mặt'],
  ld: ['Đã hỏi người làm ca lý do thiếu / thừa', 'Ghi lý do trong phiếu chênh lệch để Chủ xem được'],
};
function chkBox(c, list, ro) {
  if (!list.length) return '';
  const done = list.filter((x) => x.ok).length;
  return html`<section class="stc-chk"><h3>Quản lý cần kiểm tra ở bước này <em>${done}/${list.length} xong</em></h3>${list.map((x, n) => { const [t, how] = CHK[x.k] || [x.k, ''];
    const inner = html`<span class="bx">✓</span><span class="t"><i class="stc-mk ${x.ok ? 'ok' : ''}">${n + 1}</i> <b>${t}</b><span class="how">${how} · <b>${x.auto ? (x.wait ? 'đang chờ ca sau gửi phiếu' : 'web tự tích') : 'quản lý bấm để tích'}</b></span></span>`;
    return x.auto ? html`<div class="stc-ci auto ${x.ok ? 'ok' : ''}">${inner}</div>`
      : html`<button type="button" class="stc-ci ${x.ok ? 'ok' : ''}" data-tick="${x.k}" aria-pressed="${x.ok ? 'true' : 'false'}" ${ro || c.done ? 'disabled' : ''}>${inner}</button>`; })}</section>`;
}
// bước 2: số ở bước này sai thì sửa ở đâu (anh Tiến hỏi 20/11)
function fixHelp(c) {
  const row = (t, d) => html`<div class="stc-fhr"><b>${t}</b><span class="st-meta">${d}</span></div>`;
  return html`<div class="stc-fixhelp"><div class="h">Số ở bước này sai thì sửa ở đâu</div>
    ${row('"Phải có" sai', html`Web tự tính, không sửa tay. Sửa ở nơi sinh ra nó: tiền mở ca, doanh thu ở <button type="button" class="stc-lk" data-dsstep="0">bước 1</button>, khoản thu ở <button type="button" class="stc-lk" data-dsstep="2">bước 3</button>, khoản chi ở <button type="button" class="stc-lk" data-dsstep="3">bước 4</button>. Sửa xong số ở đây tự tính lại.`)}
    ${row('Tiền giao ca sai', html`(tiền ca trước để lại khác tiền ca này nhận) Không sửa số. Ở <button type="button" class="stc-lk" data-dsstep="0">bước 1</button>, ô Tiền mở ca, chọn ca nào ghi sai: web ghi một dòng Chênh lệch tiền mặt cho ca chịu, xử lý ở bước 5 của ca đó.`)}
    ${row('Tiền mặt thực nhận sai', c.recon_money_done ? 'Ca đã Xác nhận Fabi nên ô đang khoá: bấm Mở lại xác nhận, đếm lại két, sửa ô rồi Lưu.' : 'Đếm lại két, sửa ô tiền mặt thực nhận rồi bấm Lưu.')}
    ${row('Chuyển khoản thực nhận sai', 'Số này kế toán nhập theo sao kê ngân hàng. Quản lý không sửa ở đây: báo kế toán nhập lại, số ở đây tự đổi theo.')}</div>`;
}
// bước 5: chênh lệch tiền mặt / chuyển khoản — số luôn tính lại theo dữ liệu mới nhất của bước 1–4
function gapStep(D, a, mk) {
  const { c, link } = a; const m = link ? link.money : null; const kt = c.kt_wait || c.bank_ck == null; const ro = !!D.ext || !!D.locked || !!c.done;
  const glAll = D.items.filter((x) => x.ca_id === c.id && x.col === 'lech' && !x.void);
  const gapB = (g) => (g === 0 ? '✓ Khớp' : signedFmt(g));
  const r = (lab, a1, b1, cls = '') => html`<div class="stc-mr ${cls}"><span>${lab}</span><b>${a1}</b><b>${b1}</b></div>`;
  const card = (pm) => { const rows = glAll.filter((x) => x.pm === pm); const pend = (a.gaps || []).some((g) => g.pm === pm && !(g.small || g.done || g.wait)); const sau = (c.ticks || []).includes('sau_' + pm);
    return html`<section class="card stc-book stc-glc"><div class="stc-ch"><h2>${PM[pm]} ${mk(pm === 'tm' ? 'tm' : 'ck5')} <small>${!rows.length ? 'khớp' : pend ? (sau ? 'để sau' : 'còn lệch chưa xử lý') : 'đã có cách xử lý'}</small></h2></div>
      <div class="stc-its" style="margin:8px 10px 10px">${rows.length ? rows.map((x) => glRowOf(D, c, x)) : html`<div class="st-meta stc-empty">Không lệch ${PM[pm].toLowerCase()}.</div>`}
        ${pend ? html`<div class="stc-it add"><button type="button" class="btn sm secondary ${sau ? 'on' : ''}" data-dssau="${pm}" ${ro ? 'disabled' : ''}>${sau ? '✓ Để sau · bấm để bỏ' : 'Để sau'}</button><span class="st-meta">Chưa xử lý ngay được thì bấm Để sau: ca hiện 🟠 và nằm trong Việc cần làm tới khi xử lý.</span></div>` : ''}</div></section>`; };
  return html`<div class="stc-part stc-pb"><div class="h">Chênh lệch <span class="st-meta">luôn tính lại theo số mới nhất của bước 1 đến 4 · bấm "Phiếu chênh lệch" để xử lý</span></div>
    ${m ? html`<div class="stc-mt stc-box">${r('Tiền của ca', 'Tiền mặt', 'Chuyển khoản', 'hd')}${r('Phải có / phải nhận', fmt(m.tm.must), fmt(m.ck.must))}${r('Thực nhận', fmt(m.tm.real), kt ? '⏳' : fmt(m.ck.real))}${r('Lệch = thực nhận − phải có', gapB(m.tm.gap), kt ? '–' : gapB(m.ck.gap), 't')}</div>` : ''}
    ${card('tm')}${card('ck')}
    ${mk('ld') ? html`<div class="st-meta">${mk('ld')} Hỏi người làm ca lý do thiếu / thừa, ghi lý do trong phiếu chênh lệch để Chủ xem được, rồi tích mục ở trên.</div>` : ''}</div>`;
}
// bước 6: tóm tắt + Hoàn thành đối soát ca (phải tích đủ; máy chủ tự kiểm lại)
function doneStep(D, a, left) {
  const c = a.c; const n = left.reduce((s, v) => s + v, 0); const ro = !!D.ext || !!D.locked; const pend = (a.gaps || []).filter((g) => !g.done);
  return html`<div class="stc-part"><div class="h">Hoàn thành đối soát ca</div>
    <div class="stc-sum">${[0, 1, 2, 3, 4].map((i) => html`<button type="button" class="stc-sr" data-dsstep="${i}"><i class="stc-mk ${left[i] ? '' : 'ok'}">${left[i] ? i + 1 : '✓'}</i><b>${DS_STEPS[i]}</b><span class="pill ${left[i] ? 'warn' : 'ok'}">${left[i] ? `còn ${left[i]} mục ›` : 'xong'}</span></button>`)}</div>
    ${c.done ? html`<div class="alert ${pend.length ? 'warn' : 'ok'}">${pend.length ? `🟠 Đã đối soát, còn ${pend.length} chênh lệch chờ xử lý / chờ Chủ duyệt. Xong thì ca tự chuyển 🟢.` : '🟢 Đã hoàn thành đối soát ca.'} <span class="st-meta">${c.done.by || ''}${c.done.at ? ' · ' + c.done.at : ''}</span></div>
        <div class="st-meta">Phiếu thu chi của ca đang khoá. Bấm Mở lại để sửa; các mục đã tích được giữ.</div>
        ${ro ? '' : html`<div class="stc-tools"><button type="button" class="btn sm secondary" data-dsundone="1">Mở lại</button></div>`}`
      : html`<div class="st-meta">${n ? html`Còn <b>${n} mục</b> chưa kiểm tra. Bấm vào bước còn thiếu ở trên để tới đúng chỗ.` : 'Đã kiểm tra đủ mọi mục.'}</div>
        ${ro ? '' : html`<div class="stc-tools"><button type="button" class="btn" data-dsdone="1" ${n ? 'disabled' : ''}>🔒 Hoàn thành đối soát ca</button></div>`}
        <div class="st-meta">Phải tích đủ mọi mục ở 5 bước mới bấm được. Ca chỉ thành "đã đối soát" sau nút này.</div>`}</div>`;
}
function dsPanel(D, a) {
  const c = a.c; const steps = dsChecks(c, dsCtx(D, c)); const left = dsLeft(steps); const ro = !!D.ext || !!D.locked;
  if (DSB.stepFor !== c.id) {   // ca mới mở: theo đường dẫn b=, không thì ca đã hoàn thành → bước 6, còn lại → bước đầu tiên còn thiếu
    const f = left.findIndex((n, i) => n > 0 && (c.recon_money_done || i < 2));
    DSB.stepFor = c.id; DSB.step = DS_B != null ? DS_B : c.done || f < 0 ? 5 : f; DS_B = null;
    if (DSB.step === 2) DSB.book = 'thu'; if (DSB.step === 3) DSB.book = 'chi';
  }
  const i = DSB.step; const list = steps[i] || [];
  const mk = (k) => { const n = list.findIndex((x) => x.k === k); return n < 0 ? '' : html`<i class="stc-mk ${list[n].ok ? 'ok' : ''}" data-mk="${k}">${list[n].ok ? '✓' : n + 1}</i>`; };
  const lock = !c.recon_money_done && i >= 2 && i <= 4;
  const body = lock ? html`<div class="stc-part stc-lockp"><div class="h">${DS_STEPS[i]}</div><div class="st-meta">🔒 Bước này mở sau khi <b>Xác nhận Fabi</b> ở bước 2.</div><div class="stc-tools"><button type="button" class="btn sm" data-dsstep="1">Về bước 2</button></div></div>`
    : i === 0 ? partA(D, a, 1, mk) : i === 1 ? partA(D, a, 2, mk) : i === 2 ? partB(D, a, 'thu', mk) : i === 3 ? partB(D, a, 'chi', mk) : i === 4 ? gapStep(D, a, mk) : doneStep(D, a, left);
  return html`<div class="stc-dsp stc-full"><div class="stc-dsh"><b>${caName(c)}</b> <span class="st-meta">${c.staff || ''}</span> <span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></div>
    <nav class="stc-steps" aria-label="Các bước đối soát">${DS_STEPS.map((t, k) => { const n = k < 5 ? left[k] : (c.done ? 0 : 1);
      return html`<button type="button" class="stc-st ${k === i ? 'on' : ''} ${n ? (k < i ? 'todo' : '') : 'done'}" data-dsstep="${k}" aria-current="${k === i ? 'step' : 'false'}"><i>${!n && k !== i ? '✓' : k + 1}</i><span>${t}</span></button>`; })}</nav>
    <section class="stc-step" data-step="${i}">${lock || i === 5 ? '' : chkBox(c, list, ro)}${body}</section>${dsBar(D, a, left)}</div>`;
}
// thanh cố định cuối màn hình: Quay lại · bước này còn N mục · Tiếp (nút Xác nhận Fabi ở cuối bước 2, nút Hoàn thành ở bước 6)
function dsBar(D, a, left = []) {
  const i = DSB.step; const n = i < 5 ? left[i] || 0 : 0;
  return html`<div class="stc-dsbar" role="region" aria-label="Các bước đối soát"><div class="stc-dbh"><button type="button" class="btn sm secondary" data-dsprev="1" ${i ? '' : 'disabled'}>‹ Quay lại</button>
    <span class="st-meta stc-dbm">${i === 5 ? (a.c.done ? 'Ca đã hoàn thành đối soát' : 'Bước cuối') : n ? html`Bước này còn <b>${n} mục</b> chưa xong` : '✓ Bước này đã xong'}</span>
    <button type="button" class="btn sm" data-dsnext="1" ${i === 5 ? 'disabled' : ''}>Tiếp ›</button></div></div>`;
}
const isPhone = () => { try { return matchMedia('(max-width: 600px)').matches; } catch (_) { return false; } };
// nhảy tới chỗ cần xử lý từ thanh cuối màn hình
function dsJump(D, b) {
  const k = b.dataset.dsjump; const go = (el) => { if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('stc-flash'); setTimeout(() => el.classList.remove('stc-flash'), 1600); };
  if (k === 'red') go($('#ds-s1 .stc-c4.red') || $('#ds-s1'));
  else if (k === 'kt') go($('#ds-s2 .stc-mt') || $('#ds-s2'));
  else if (k === 'cash') { const i = $('.stc-dsp [name=ds_tm]'); go(i || $('#ds-s2')); if (i) setTimeout(() => i.focus({ preventScroll: true }), 400); }
  else if (k === 'gap') { DSB.book = b.dataset.jbook || DSB.book; DSB.pm = b.dataset.jpm || DSB.pm; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); go($('.stc-glc')); }
}
function dsBody(D) {
  const { dates, all } = dsInfo(D);
  if (!all.length) return html`<section class="card stc-empty">Tháng này chưa có ca nào.</section>`;
  const extra = [...new Set(all.map((a) => a.c.shift).filter((s) => !SHIFT_ORDER.includes(s)))];
  const cols = [...SHIFT_ORDER, ...extra];
  const ph = isPhone();   // bước 168: điện thoại không tự chọn ca — chọn ca thì phần xử lý ca lên đầu trang
  if (!all.some((a) => String(a.c.id) === String(DS_SEL))) DS_SEL = ph ? null : (all.find((a) => !['fin', 'xong'].includes(a.st.k)) || all[all.length - 1]).c.id;
  const sel = all.find((a) => String(a.c.id) === String(DS_SEL));
  if (ph && sel) return html`<button type="button" class="stc-pick" data-dspick="1">‹ Chọn ca khác <span class="st-meta">· lịch thu ${all.length} ca</span></button>${dsPanel(D, sel)}`;
  const cnt = (k) => all.filter((a) => a.st.k === k).length;
  const cell = (d, s) => { const a = all.find((x) => x.c.date === d && x.c.shift === s); if (!a) return html`<span class="st-meta">–</span>`;
    return html`<button type="button" class="stc-dsc d-${a.st.k} ${String(a.c.id) === String(DS_SEL) ? 'on' : ''}" data-dsca="${a.c.id}"><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span>${a.st.note ? html`<small>${a.st.note}</small>` : ''}</button>`; };
  const side = (title, list, empty) => ph ? html`<details class="card stc-side stc-sidep"><summary><b>${title}</b> <small>${list.length}</small></summary>${list.length ? html`<div class="stc-dsl">${list.map((a) => html`<button type="button" class="stc-si stc-go" data-dsca="${a.c.id}"><span>${caName(a.c)}${a.st.note ? html`<br><span class="st-meta">${a.st.note}</span>` : ''}</span><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></button>`)}</div>` : html`<div class="st-meta">${empty}</div>`}</details>`
    : html`<section class="card stc-side"><h3>${title} <small>${list.length}</small></h3>${list.length ? html`<div class="stc-dsl">${list.map((a) => html`<button type="button" class="stc-si stc-go" data-dsca="${a.c.id}"><span>${caName(a.c)}${a.st.note ? html`<br><span class="st-meta">${a.st.note}</span>` : ''}</span><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></button>`)}</div>` : html`<div class="st-meta">${empty}</div>`}</section>`;   // danh sách dài → cuộn trong khung, không đẩy phần ca xuống
  const how = html`Mỗi ca: <b>A · Fabi</b> (so phiếu nhân viên với máy Fabi · tiền mặt / chuyển khoản thực nhận) → đi <b>6 bước</b>: ① Số máy Fabi → ② Tiền thực nhận, <b>Xác nhận Fabi</b> → ③ Khoản thu → ④ Khoản chi → ⑤ Chênh lệch → ⑥ <b>🔒 Hoàn thành đối soát ca</b> (phải tích đủ mục kiểm tra; còn lệch chưa xử lý → 🟠, hết lệch → 🟢). Khoá cuối cùng là <b>Chốt tháng</b> (chỉ Chủ mở lại).`;
  const top = ph ? html`<div class="stc-dsmini"><span>🟢 ${cnt('xong')}/${all.length}</span><span class="${cnt('xn') ? 'w' : ''}">🔵 Chưa hoàn thành ${cnt('xn')}</span><span class="${cnt('con') ? 'w' : ''}">🟠 Còn lệch ${cnt('con')}</span><span class="${cnt('cho') ? 'w' : ''}">Chờ xác nhận ${cnt('cho')}</span><span class="${cnt('lech') ? 'w' : ''}">Ô đỏ ${cnt('lech')}</span><span class="${cnt('kt') ? 'w' : ''}">Chờ KT ${cnt('kt')}</span></div>
    <details class="stc-how"><summary>ⓘ Cách làm</summary><div class="st-meta">${how}</div></details>` : '';
  return ph ? html`${top}<div class="stc-layout"><section class="card stc-book">
        <div class="stc-wk"><div class="stc-wr stc-hdr" style="--k:${cols.length}"><span>Ngày</span>${cols.map((s) => html`<span>${s}</span>`)}</div>
          ${[...dates].reverse().map((d) => html`<div class="stc-wr" style="--k:${cols.length}"><span class="stc-lab">${dm(d)} <small>${wd(d)}</small></span>${cols.map((s) => cell(d, s))}</div>`)}</div></section>
      <aside class="stc-aside">${side('Chờ xác nhận Fabi', all.filter((a) => ['cho', 'lech'].includes(a.st.k)), 'Không có.')}${side('🔵 Đã xác nhận, chưa hoàn thành', all.filter((a) => a.st.k === 'xn'), 'Không có.')}${side('🟠 Còn lệch', all.filter((a) => a.st.k === 'con'), 'Không có.')}${side('🟢 Hoàn thành', all.filter((a) => a.st.k === 'xong'), 'Chưa có.')}${side('Chờ kế toán', all.filter((a) => a.st.k === 'kt'), 'Không có.')}</aside></div>`
    : html`<div class="stc-tiles">
      <div class="stc-tile"><span>🟢 Hoàn thành</span><b>${cnt('xong')} / ${all.length}</b><small>đã bấm Hoàn thành đối soát ca, hết tiền lệch cần xử lý</small></div>
      <div class="stc-tile ${cnt('xn') ? 'warn' : ''}"><span>🔵 Chưa hoàn thành</span><b>${cnt('xn')}</b><small>đã xác nhận Fabi, chưa bấm Hoàn thành đối soát ca</small></div>
      <div class="stc-tile ${cnt('con') ? 'warn' : ''}"><span>🟠 Còn lệch</span><b>${cnt('con')}</b><small>đã hoàn thành, còn chênh lệch chờ xử lý ở bước 5</small></div>
      <div class="stc-tile ${cnt('cho') ? 'warn' : ''}"><span>Chờ xác nhận Fabi</span><b>${cnt('cho')}</b><small>bước 1 đã khớp</small></div>
      <div class="stc-tile ${cnt('lech') ? 'warn' : ''}"><span>Còn ô đỏ Fabi</span><b>${cnt('lech')}</b><small>tiền mở ca / doanh thu / nợ</small></div>
      <div class="stc-tile ${cnt('kt') ? 'warn' : ''}"><span>Chờ kế toán</span><b>${cnt('kt')}</b><small>thiếu file Fabi / ngân hàng</small></div></div>
    <div class="st-meta stc-formula">${how}</div>
    <div class="stc-layout"><section class="card stc-book">
        <div class="stc-wk"><div class="stc-wr stc-hdr" style="--k:${cols.length}"><span>Ngày</span>${cols.map((s) => html`<span>${s}</span>`)}</div>
          ${[...dates].reverse().map((d) => html`<div class="stc-wr" style="--k:${cols.length}"><span class="stc-lab">${dm(d)} <small>${wd(d)}</small></span>${cols.map((s) => cell(d, s))}</div>`)}</div></section>
      <aside class="stc-aside">${side('Chờ xác nhận Fabi', all.filter((a) => ['cho', 'lech'].includes(a.st.k)), 'Không có.')}${side('🔵 Đã xác nhận, chưa hoàn thành', all.filter((a) => a.st.k === 'xn'), 'Không có.')}${side('🟠 Còn lệch', all.filter((a) => a.st.k === 'con'), 'Không có.')}${side('🟢 Hoàn thành', all.filter((a) => a.st.k === 'xong'), 'Chưa có.')}${side('Chờ kế toán', all.filter((a) => a.st.k === 'kt'), 'Không có.')}</aside></div>
    ${sel ? dsPanel(D, sel) : ''}`;
}
function dsPage(D) { return html`<div id="stc-ds">${dsBody(D)}</div>`; }

// ---------------- Khoản treo (tab Tổng) ----------------
function treoCard(D) {
  const list = D.treo || []; const open = list.filter((t) => t.status === 'mo'); const done = list.filter((t) => t.status !== 'mo');
  const row = (t) => { const v = treoView(t);
    const acts = t.status !== 'mo' || D.ext ? '' : t.kind === 'tien' && v.over
      ? html`<button type="button" class="btn sm" data-treodo="tru" data-treo="${t.id}">Trừ tiền nhân viên</button>${D.owner ? html`<button type="button" class="btn sm secondary" data-treodo="qc" data-treo="${t.id}">Quán chịu</button>` : ''}`
      : t.kind === 'thua' && t.thu_khac ? html`<button type="button" class="btn sm" data-treodo="thu" data-treo="${t.id}">Ghi Thu khác</button>` : html`<button type="button" class="btn sm" data-treodo="use" data-treo="${t.id}">${t.kind === 'tien' ? 'Đã về' : 'Ghép với ca thiếu'}</button>`;
    return html`<div class="stc-si stc-treo"><span><b>${t.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} ${fmt(t.left ?? t.amount)}</b>${Number(t.left) !== Number(t.amount) ? html` <span class="st-meta">/ ${fmt(t.amount)}</span>` : ''}
      <br><span class="pill ${v.cls}">${v.label}</span><br><span class="st-meta">Từ ca ${t.shift} ${dm(t.date)} (ca gốc đã chốt)</span></span><span class="stc-tools">${acts}</span></div>`; };
  return html`<section class="card stc-side"><h3>Khoản treo <small>${open.length} đang chờ${open.some((t) => treoView(t).over) ? ` · ${open.filter((t) => treoView(t).over).length} quá hạn` : ''}</small></h3>
    ${open.length ? open.map(row) : html`<div class="st-meta">Không còn khoản treo. 👍</div>`}${done.map(row)}
    <div class="st-meta stc-note">Tạo khi Chốt ca: phần lệch còn chờ tách khỏi ca. Chờ tiền về: hạn 3 ngày; tiền về thì bù vào ca có chuyển khoản dư; quá hạn thì trừ tiền nhân viên hoặc quán chịu. Tiền thừa: ghép với ca thiếu chưa chốt; hết tháng chưa ghép thì thành Thu khác. Ca gốc vẫn khoá.</div></section>`;
}
function treoAct(D, b) {
  const t = (D.treo || []).find((x) => String(x.id) === String(b.dataset.treo)); if (!t) return;
  const head = `${t.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} ${fmt(t.left)} · từ ca ${t.shift} ${dm(t.date)}`;
  if (b.dataset.treodo === 'use') {
    const kind = t.kind === 'tien' ? 'du' : 'thieu';
    const cands = D.items.filter((x) => x.col === 'lech' && x.gap && x.gap.kind === kind && x.pm === t.pm && Number(x.gap.avail) > 0 && !isFin(D, x.ca_id)
      && (D.cas || []).find((c) => c.id === x.ca_id)?.recon_money_done);
    const d = dialog(form(`${t.kind === 'tien' ? 'Tiền đã về' : 'Ghép tiền thừa'} · ${head}`, html`
      <div class="st-meta">${t.kind === 'tien' ? 'Chọn ca có chuyển khoản dư (tiền khách chuyển chậm đã về ở ca đó).' : 'Chọn ca thiếu cùng loại tiền để bù bằng tiền thừa này.'} Chỉ ca đã xác nhận Fabi, chưa chốt.</div>
      ${cands.length ? html`<div class="stack" style="gap:6px">${cands.map((x, i) => { const c = (D.cas || []).find((o) => o.id === x.ca_id);
        return html`<label class="stc-si"><span><input type="radio" name="ca" value="${x.ca_id}" data-amt="${Math.min(Number(x.gap.avail), Number(t.left))}" ${i ? '' : 'checked'}> ${caName(c)} · ${kind === 'du' ? 'dư' : 'thiếu'} ${fmt(x.gap.avail)}</span></label>`; })}</div>
        <label class="field"><span>Số tiền</span><input class="input" name="amount" inputmode="numeric" data-money value="${fmt(Math.min(Number(cands[0].gap.avail), Number(t.left)))}"></label>`
        : html`<div class="alert warn">Chưa có ca phù hợp trong tháng này (ca ${kind === 'du' ? 'dư chuyển khoản' : 'thiếu ' + PM[t.pm].toLowerCase()}, đã xác nhận Fabi, chưa chốt).</div>`}`, ' '));
    d.querySelectorAll('[name=ca]').forEach((r) => r.addEventListener('change', () => { d.querySelector('[name=amount]').value = fmt(Number(r.dataset.amt)); }));
    open(d, async () => { const ca = d.querySelector('[name=ca]:checked'); if (!ca) throw new Error('Chọn một ca.');
      await rpc('app_stc_treo_use', { p_treo: t.id, p_report: Number(ca.value), p_amount: money(d, 'amount'), p_reason: val(d, 'reason') || null }); after(t.kind === 'tien' ? 'Đã ghi tiền về' : 'Đã ghép'); });
  } else if (b.dataset.treodo === 'tru') {
    const g = D.items.find((x) => x.ca_id === t.report_id && x.col === 'lech' && x.pm === t.pm)?.gap; const people = g?.people || [];
    const left = Number(t.left); const each = people.length ? Math.floor(left / people.length / 1000) * 1000 : 0;
    const d = dialog(form(`Trừ tiền nhân viên · ${head}`, html`<div class="st-meta">Quá hạn 3 ngày chưa thấy tiền về. Ghi phiếu trừ tiền lên ca gốc (ca gốc vẫn khoá, số chênh lệch không đổi). Tổng phải đúng ${fmt(left)}.</div>
      ${people.length ? people.map((p, i) => html`<label class="field"><span>${p.name}</span><input class="input" name="tl_${p.id}" inputmode="numeric" data-money value="${fmt(i ? each : left - each * (people.length - 1))}"></label>`)
        : html`<div class="alert warn">Mở tháng của ca gốc để thấy người làm ca.</div>`}`));
    open(d, async () => { if (!val(d, 'reason')) throw new Error('Ghi lý do.');
      const ps = people.map((p) => ({ employee_id: p.id, amount: money(d, 'tl_' + p.id) })).filter((p) => p.amount > 0);
      if (!ps.length) throw new Error('Nhập số tiền trừ.');
      const tot = ps.reduce((s, p) => s + p.amount, 0); if (tot !== left) throw new Error(`Tổng trừ ${fmt(tot)} — phải đúng ${fmt(left)}.`);
      await rpc('app_stc_treo_close', { p_treo: t.id, p_kind: 'tru', p_people: ps, p_reason: val(d, 'reason') }); after('Đã tạo phiếu trừ tiền'); });
  } else if (b.dataset.treodo === 'qc') {
    const d = dialog(form(`Quán chịu · ${head}`, html`<div class="st-meta">Quá hạn 3 ngày chưa thấy tiền về. Quán chịu ${fmt(t.left)} (tính chi phí "Âm tiền – quán chịu"). Chỉ Chủ quyết.</div>`));
    open(d, async () => { if (!val(d, 'reason')) throw new Error('Ghi lý do.');
      await rpc('app_stc_treo_close', { p_treo: t.id, p_kind: 'qc', p_people: null, p_reason: val(d, 'reason') }); after('Đã ghi quán chịu'); });
  } else if (b.dataset.treodo === 'thu') {
    const d = dialog(form(`Ghi Thu khác · ${head}`, html`<div class="st-meta">Hết tháng chưa ghép được với ca thiếu nào. Ghi ${fmt(t.left)} thành phiếu thu "Thu khác" của ca gốc (ca gốc vẫn khoá).</div>`));
    open(d, async () => { if (!val(d, 'reason')) throw new Error('Ghi lý do.');
      await rpc('app_stc_treo_close', { p_treo: t.id, p_kind: 'thu', p_people: null, p_reason: val(d, 'reason') }); after('Đã ghi Thu khác'); });
  }
}


const STYLE = html`<style>
  .stc-bar { display: flex; flex-direction: column; gap: 10px; }
  .stc-month { display: flex; align-items: center; gap: 8px; }
  .stc-month strong { min-width: 110px; text-align: center; }
  .stc-qn { border-style: dashed !important; }
  .stc-pays { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .stc-pay { display: flex; flex-direction: column; gap: 2px; padding: 12px 16px; border-radius: 16px; background: var(--card); border: 2px solid var(--line); text-decoration: none; color: var(--ink); }
  .stc-pay.on { border-color: var(--primary); background: var(--caramel-soft); }
  .stc-pay .k { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .stc-pay .v { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stc-pay .s { font-size: 12px; color: var(--muted); }
  .stc-formula { margin: 10px 2px; }
  /* bước 164: phần đầu gọn */
  .stc-head { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 10px; align-items: stretch; margin-top: 12px; }
  .stc-sw { display: grid; grid-template-columns: 1fr 1fr; border: 2px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--card); }
  .stc-sw .stc-pay { border: 0; border-radius: 0; padding: 10px 12px; justify-content: center; }
  .stc-sw .stc-pay + .stc-pay { border-left: 1px solid var(--line); }
  .stc-sw .stc-pay .v { font-size: 18px; }
  .stc-t5 { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
  .stc-tile.zero { opacity: .5; } .stc-tsel { color: var(--primary) !important; font-weight: 700; }
  .stc-hidecols { padding: 6px 14px; border-bottom: 1px solid var(--line-soft); }
  .stc-lnk { background: none; border: 0; padding: 0; font: inherit; color: var(--primary); text-decoration: underline; cursor: pointer; }
  .stc-day:nth-child(even of .stc-day) > .stc-drow { background: color-mix(in srgb, var(--subtle) 55%, transparent); }
  .stc-g > .stc-c.tot { background: var(--subtle); border-radius: 6px; padding: 2px 6px; }
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
  .stc-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); }
  .stc-box { border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; background: var(--card); min-width: 0; }
  .stc-box h3 { margin: 0 0 6px; font-size: 15px; } .stc-box .st-meta { font-size: 12.5px; }
  .stc-fl { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); border-radius: 10px; padding-left: 8px; background: var(--card); }
  .stc-fl > span { font-size: 12px; color: var(--muted); white-space: nowrap; } .stc-fl select { border: 0; background: transparent; max-width: 220px; }
  .stc-fl.on { border-color: var(--primary); background: var(--caramel-soft); } .stc-fl.on > span { color: var(--primary); font-weight: 700; }
  .stc-fbtn { display: none !important; }
  .stc-locrow { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 14px; border-bottom: 1px solid var(--line-soft); background: var(--subtle); font-size: 13px; }
  .stc-lcl { font-weight: 700; } .stc-lcn { margin-left: auto; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stc-chip { border: 1px solid var(--primary); border-radius: 999px; padding: 2px 10px; background: var(--card); color: var(--ink); font: inherit; font-size: 12.5px; cursor: pointer; max-width: 100%; overflow-wrap: anywhere; text-align: left; }
  .stc-dh { padding: 10px 4px 2px; font-weight: 800; } .stc-dh small { color: var(--muted); font-weight: 500; }
  .stc-calock { padding: 6px 10px; margin: 4px 0; border-left: 3px solid var(--warn-line); background: var(--warn-bg); border-radius: 6px; }
  .stc-cst { font-size: 11px; margin-left: 4px; white-space: nowrap; }
  .stc-cas > .stc-ca { border-left: 3px solid var(--caramel, #c79a6b); margin-left: 10px; }
  .stc-ca > .stc-its { border-left: 2px dashed var(--line); margin-left: 22px; padding-left: 4px; }
  .stc-day.open > .stc-drow { background: var(--caramel-soft); }
  .stc-sech { padding: 10px 4px 2px; font-weight: 700; font-size: 13px; color: var(--muted); }
  .stc-sum { display: flex; justify-content: space-between; padding: 10px 14px; border-top: 2px solid var(--line); font-weight: 800; font-variant-numeric: tabular-nums; }
  .stc-si { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line-soft); }
  .stc-si:last-of-type { border-bottom: 0; }
  .stc-dsl { max-height: 230px; overflow-y: auto; overscroll-behavior: contain; padding-right: 4px; }
  @media (max-width: 980px) { .stc-dsl { max-height: 160px; } }
  .stc-addp { margin: 10px 0; padding: 12px; border: 1.5px dashed var(--line); border-radius: 12px; background: var(--subtle); display: flex; flex-direction: column; gap: 10px; }
  .stc-ah, .stc-ar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
  .stc-ah .stc-ak { margin-left: auto; }
  .stc-af { display: inline-flex; align-items: center; gap: 8px; padding: 4px 6px 4px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card, #fff); margin: 0; min-width: 0; }
  .stc-af[hidden] { display: none; }
  .stc-af > span { font-weight: 600; white-space: nowrap; font-size: 14px; }
  .stc-addp .stc-af .input { width: auto; min-width: 0; height: 36px; min-height: 0; border: 1px solid var(--line-soft); padding: 4px 8px; font-size: 14px; }
  .stc-aw { flex: 1 1 220px; } .stc-addp .stc-aw .input { flex: 1; width: 100%; }
  .stc-addp .stc-am .input { width: 130px; }
  .stc-ac[hidden] { display: none; }
  .stc-abtn { display: inline-flex; gap: 8px; margin-left: auto; }
  .stc-addp .stc-err:empty { display: none; }
  @media (max-width: 720px) { .stc-af, .stc-ah .stc-ak { flex: 1 1 100%; margin-left: 0; } .stc-addp .stc-af .input { flex: 1; width: 100%; } .stc-abtn { flex: 1 1 100%; justify-content: flex-end; } }
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
  .stc-dsc .pill { white-space: normal; } .stc-dsc small { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; }
  .stc-dsc.d-xong { background: var(--ok-bg); border-color: var(--ok-line); } .stc-dsc.d-con { background: #fff7ed; border-color: #fdba74; } .stc-dsc.d-xn { background: var(--info-bg); border-color: var(--info-line); }
  .pill.yel { background: var(--warn-bg); color: var(--warn-ink); }
  .stc-dsnote { border-radius: 10px; padding: 8px 10px; margin-top: 8px; display: flex; flex-direction: column; gap: 3px; background: #fff7ed; border: 1px solid #fdba74; }
  .stc-dsnote.ok { background: var(--ok-bg); border-color: var(--ok-line); } .stc-dsc.on { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
  .stc-dsbar { position: sticky; bottom: 0; z-index: 6; margin: 4px -12px -12px; padding: 10px 12px; background: var(--card); border-top: 2px solid var(--primary); border-radius: 0 0 14px 14px; box-shadow: 0 -6px 16px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 6px; }
  .stc-dbh { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; } .stc-dbh .btn { width: auto; }
  .stc-dbn { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .stc-jump { border: 1px solid var(--line-strong); background: var(--subtle); border-radius: 999px; padding: 4px 10px; font-size: 13px; cursor: pointer; color: inherit; text-align: left; }
  .stc-flash { outline: 3px solid #f59e0b; outline-offset: 2px; transition: outline-color .3s; }
  .stc-pick { display: block; width: 100%; text-align: left; padding: 10px 12px; margin: 0 0 8px; border: 1px solid var(--line-strong); border-radius: 12px; background: var(--card); font-weight: 700; color: var(--primary); cursor: pointer; }
  .stc-dsmini { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 13px; padding: 2px 2px 6px; } .stc-dsmini .w { color: #b45309; font-weight: 700; }
  .stc-how { font-size: 13px; margin-bottom: 6px; } .stc-how summary { cursor: pointer; color: var(--primary); font-weight: 700; }
  .stc-sidep summary { cursor: pointer; display: flex; gap: 6px; align-items: center; } .stc-sidep[open] summary { margin-bottom: 6px; }
  .stc-cajump { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; } .stc-cajump .btn { width: auto; }
  .stc-dsp { margin: 6px 12px 14px; border: 1px solid var(--line-strong); border-radius: 14px; background: var(--subtle); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .stc-dsh { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  /* bước 171: 6 bước đối soát + mục quản lý phải kiểm tra */
  .stc-steps { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; margin: 10px 0; }
  .stc-st { background: none; border: 0; padding: 4px 0; display: grid; justify-items: center; gap: 3px; min-width: 0; cursor: pointer; color: var(--muted); font: inherit; }
  .stc-st i { font-style: normal; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 13px; border: 2px solid var(--line-strong); background: var(--card); color: var(--ink-2); }
  .stc-st span { font-size: 11.5px; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
  .stc-st.done i { background: var(--ok-bg); border-color: var(--ok-line); color: var(--ok-ink); }
  .stc-st.todo i { border-color: var(--warn-line); background: var(--warn-bg); }
  .stc-st.on { color: var(--ink); } .stc-st.on i { background: var(--header); border-color: var(--header); color: #fff; } .stc-st.on span { font-weight: 700; }
  .stc-step { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .stc-chk { background: var(--warn-bg); border: 1px solid var(--warn-line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 6px; color: var(--warn-ink); }
  .stc-chk h3 { margin: 0; font-size: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .stc-chk h3 em { font-style: normal; margin-left: auto; font-size: 12.5px; background: var(--card); border-radius: 99px; padding: 1px 9px; }
  .stc-ci { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; align-items: start; background: var(--card); border-radius: 9px; padding: 7px 10px; color: var(--ink); border: 0; text-align: left; width: 100%; font: inherit; }
  button.stc-ci { cursor: pointer; } button.stc-ci:disabled { cursor: default; opacity: .75; }
  .stc-ci .bx { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--warn-line); display: grid; place-items: center; font-size: 13px; font-weight: 700; color: transparent; margin-top: 1px; }
  .stc-ci.ok .bx { background: var(--ok-line); border-color: var(--ok-line); color: #fff; }
  .stc-ci.ok .t > b { color: var(--muted); }
  .stc-ci .how { display: block; font-size: 12.5px; color: var(--muted); }
  .stc-mk { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 99px; background: var(--warn-line); color: var(--ink); font-size: 12px; font-weight: 700; font-style: normal; vertical-align: 1px; }
  .stc-mk.ok { background: var(--ok-line); color: #fff; }
  .stc-who { font-size: 11.5px; font-weight: 700; border-radius: 4px; padding: 1px 6px; background: var(--info-bg); color: var(--info-ink); white-space: nowrap; }
  .stc-who.ql { background: var(--plum-bg); color: var(--plum-ink); }
  .stc-fixhelp { border: 1px dashed var(--line-strong); border-radius: 10px; padding: 10px 12px; display: grid; gap: 8px; }
  .stc-fixhelp .h { font-weight: 700; } .stc-fhr { display: grid; gap: 2px; }
  .stc-lk { background: none; border: 0; padding: 0; font: inherit; color: var(--primary-dark); text-decoration: underline; cursor: pointer; }
  .stc-sum { display: grid; } .stc-sr { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 9px 0; border: 0; border-top: 1px solid var(--line); background: none; text-align: left; font: inherit; color: inherit; cursor: pointer; }
  .stc-sr:first-child { border-top: 0; }
  .stc-dsbar .stc-dbh { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; } .stc-dbm { text-align: center; }
  [data-dssau].on { background: var(--header); color: #fff; border-color: var(--header); }
  @media (max-width: 600px) { .stc-st span { display: none; } .stc-st.on span { display: block; } }
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
  /* bước 151: Đối soát Fabi */
  .stc-full { margin: 14px 0 0; }
  .stc-part { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
  .stc-part > .h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 800; font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }
  .stc-part > .h .st-meta { text-transform: none; letter-spacing: 0; font-weight: 500; }
  .stc-pa > .h { color: var(--primary); } .stc-pb { border: 2px solid var(--info-line); } .stc-pb > .h { color: var(--info-ink); } .stc-lockp { opacity: .65; }
  .stc-cadebt { margin-top: 8px; border: 2px solid var(--warn-line, #d9a441); background: var(--warn-bg, #fff8ea); border-radius: 10px; padding: 4px 10px 6px; }
  .stc-cdh { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-top: 6px; }
  .stc-cdr { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px dashed var(--line); }
  .stc-cdh + .stc-cdr { border-top: 0; }
  .stc-cdr .stc-amt { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .stc-dtag { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 6px; color: #fff; min-width: 32px; text-align: center; }
  .stc-dtag.d-hd { background: #6a4fa0; } .stc-dtag.d-tm { background: #2e7d32; } .stc-dtag.d-ck { background: #1565c0; } .stc-dtag.d-tra { background: #00796b; }
  .stc-fsum { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  .stc-fsum > div { background: var(--subtle); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; display: flex; flex-direction: column; font-size: 12.5px; color: var(--muted); min-width: 0; }
  .stc-fsum b { color: var(--ink); font-size: 15px; font-variant-numeric: tabular-nums; }
  .stc-ln { font-size: 13px; } .stc-ln b { font-variant-numeric: tabular-nums; }
  .stc-warnbox { background: var(--warn-bg); color: var(--warn-ink); border: 1px solid var(--warn-line); border-radius: 10px; padding: 8px 12px; font-size: 13px; }
  .stc-glhint { background: var(--warn-bg); color: var(--warn-ink); border-radius: 10px; padding: 6px 10px; font-size: 13px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .stc-box { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; }
  .stc-mr.hd { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; } .stc-mr.t { border-top: 1px solid var(--line-strong); font-weight: 700; }
  .stc-cab .stc-crow { cursor: default; } .stc-cab .stc-crow:hover { background: transparent; }
  .stc-glc { border: 2px solid var(--warn-line); } .stc-glc .stc-ch { background: var(--warn-bg); } .stc-glc .stc-ch h2 { color: var(--warn-ink); }
  .stc-gparts { background: var(--subtle); } .stc-gpr { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; } .stc-gpr b { font-variant-numeric: tabular-nums; }
  .stc-fin { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px; border-radius: 12px; border: 2px dashed var(--primary); background: var(--caramel-soft); }
  .stc-fin.done { border-style: solid; border-color: var(--ok-line); background: var(--ok-bg); }
  .stc-ck { display: flex; flex-direction: column; gap: 3px; font-size: 14px; color: var(--ok-ink); }
  .stc-tr0 { background: var(--subtle); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; font-size: 13.5px; }
  .stc-treo { align-items: flex-start; flex-wrap: wrap; } .stc-treo > span:first-child { flex: 1 1 180px; min-width: 0; }
  /* bước 154: giao diện như bản mẫu 18/11 — dải đầu xanh rêu, tab hồ sơ, nút / tiêu đề chữ thường */
  #stc-page { --stc-hd: var(--header, #3a4c3e); --stc-hd-ink: #f5efe6; --stc-hd-dim: #c9d3c4; }
  .stc-top { background: var(--stc-hd); color: var(--stc-hd-ink); border-radius: 18px 18px 0 0; padding: 14px 18px 0; display: flex; flex-direction: column; gap: 10px; margin: 0 0 16px; }
  .stc-toprow { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .stc-top .stc-month { display: flex; align-items: center; gap: 6px; }
  .stc-top .stc-mb { border: 1px solid rgba(255,255,255,.25); color: var(--stc-hd-ink); border-radius: 10px; width: 32px; height: 32px; display: inline-grid; place-items: center; text-decoration: none; font-weight: 700; }
  .stc-top .stc-month strong { font-size: 15px; min-width: 110px; text-align: center; color: var(--stc-hd-ink); }
  .stc-top .branch-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 0; padding: 0; border: 0; }
  .stc-top .branch-tabs a { color: var(--stc-hd-dim) !important; background: transparent !important; border: 0 !important; padding: 6px 12px; border-radius: 10px; font-weight: 600; text-decoration: none; text-transform: none; letter-spacing: normal; box-shadow: none; min-height: 0; }
  .stc-top .branch-tabs a.on { background: rgba(255,255,255,.14) !important; color: var(--stc-hd-ink) !important; }
  .stc-top .branch-tabs a.stc-qn { border: 1px dashed rgba(255,255,255,.35) !important; }
  .stc-sub { font-size: 12px; color: var(--stc-hd-dim); } .stc-sub b { color: var(--stc-hd-ink); font-weight: 600; }
  .stc-top .stc-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
  .stc-top .stc-tabs a { color: var(--stc-hd-dim); padding: 10px 18px 12px; font-size: 17px; font-weight: 700; border-radius: 14px 14px 0 0; text-decoration: none; }
  .stc-top .stc-tabs a.on { background: var(--ground, #f5efe6); color: var(--ink); }
  #stc-page .btn { text-transform: none; letter-spacing: normal; font-weight: 600; border-radius: 10px; }
  #stc-page .btn.secondary { background: var(--card); border: 1px solid var(--line-strong); color: var(--ink-2); box-shadow: none; }
  #stc-page .btn.sm { padding: 5px 10px; font-size: 12.5px; min-height: 0; }
  #stc-page h2, #stc-page h3 { text-transform: none; letter-spacing: normal; font-family: inherit; }
  #stc-page .stc-side h3 { font-size: 16px; font-weight: 700; }
  #stc-page .stc-side .st-meta { font-size: 12.5px; }
  #stc-page .stc-c { font-size: 13.5px; }
  #stc-page .stc-g { grid-template-columns: minmax(92px, 1fr) repeat(var(--n), minmax(0, 1fr)) minmax(0, 1.15fr); column-gap: 6px; }
  #stc-page .stc-layout { grid-template-columns: minmax(0, 1fr) 310px; }
  #stc-page .stc-ch .stc-tools { margin-left: auto; }
  @media (max-width: 720px) { .stc-top { padding: 12px 12px 0; border-radius: 14px 14px 0 0; } .stc-top .stc-tabs a { font-size: 15px; padding: 9px 12px 11px; } #stc-page .stc-layout { grid-template-columns: minmax(0, 1fr); } }
  .stc-cat { max-width: 220px; font-size: 12.5px; padding: 3px 6px; } .stc-cat.need { border-color: var(--warn-line, #f59e0b); background: var(--warn-bg); }
  .stc-who { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); } .stc-who select { font-size: 12.5px; padding: 3px 6px; }
  .stc-go { width: 100%; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--line); cursor: pointer; font: inherit; color: inherit; } .stc-go:hover { background: var(--subtle); }
  .stc-tyg { padding: 8px 0; border-bottom: 1px solid var(--line); } .stc-tyg:last-of-type { border-bottom: 0; }
  .stc-tyh { display: flex; justify-content: space-between; font-weight: 700; gap: 8px; } .stc-bar { height: 6px; background: var(--line-soft, #f2ebe1); border-radius: 4px; margin: 6px 0 4px; overflow: hidden; } .stc-bar i { display: block; height: 100%; background: var(--primary); border-radius: 4px; }
  .stc-tyc { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--ink-2); gap: 8px; padding-left: 10px; } .stc-tyc b { font-weight: 500; }
  .stc-chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .stc-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; } .stc-photos figure { margin: 0; } .stc-photos img { width: 100%; border-radius: 10px; border: 1px solid var(--line, #e5e7eb); display: block; }
  .stc-flt { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--line, #e5e7eb); }
  .stc-flt .stc-q { flex: 1 1 220px; min-width: 0; } .stc-flt select { flex: 0 1 auto; max-width: 100%; }
  .stc-flat { margin: 0 10px 10px; } .stc-fr { border-bottom: 1px dashed var(--line, #e5e7eb); padding: 4px 0; } .stc-frh { padding: 2px 4px; }
  .stc-tlr { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 8px 4px 22px; font-size: 13px; }
  .stc-tlr > span { min-width: 0; overflow-wrap: anywhere; } .stc-tlr.void { opacity: .55; text-decoration: line-through; }
  .stc-tile.stc-bad { border-color: var(--off-line); background: var(--off-bg); }
  /* bước 166: tab Tổng mẫu B — 2 khung đầu trang cao bằng nhau, giới hạn chiều cao, cuộn bên trong */
  .stc-top2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
  .stc-top2 > .card { display: flex; flex-direction: column; max-height: 340px; min-width: 0; padding: 12px 14px; }
  .stc-top2 h3 { margin: 0 0 6px; font-size: 15px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 8px; }
  .stc-top2 h3 small { color: var(--muted); font-weight: 500; font-size: 12px; }
  .stc-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
  .stc-ti { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--line-soft); }
  .stc-ti:last-child { border-bottom: 0; } .stc-tt { min-width: 0; overflow-wrap: anywhere; }
  .stc-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--warn-line); } .stc-dot.red { background: var(--off-line); }
  .stc-dp { border-bottom: 1px solid var(--line-soft); padding: 6px 0; } .stc-dp:last-child { border-bottom: 0; }
  details.stc-cmp > summary { list-style: none; }
  details.stc-cmp > summary::before { content: "›"; display: inline-block; margin-right: 6px; color: var(--muted); transition: transform .15s; }
  details.stc-cmp[open] > summary::before { transform: rotate(90deg); }
  .stc-two > :only-child { grid-column: 1 / -1; }
  .stc-dp > summary, .stc-fam > summary { display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: pointer; list-style: none; }
  .stc-dp > summary::-webkit-details-marker, .stc-fam > summary::-webkit-details-marker, .stc-cmp > summary::-webkit-details-marker { display: none; }
  .stc-dp > summary::after, .stc-fam > summary::after { content: "›"; color: var(--muted); font-size: 18px; transition: transform .15s; }
  .stc-dp[open] > summary::after, .stc-fam[open] > summary::after { transform: rotate(90deg); }
  .stc-dp > summary { text-transform: none; letter-spacing: normal; }   /* tên người nợ là nội dung — giữ nguyên chữ (them.css in hoa mọi summary) */
  .stc-dp > summary > .stc-tt { flex: 1; } .stc-dk { padding-left: 12px; align-items: center; }
  .stc-fam { margin-top: 6px; border: 1px dashed var(--line-strong); border-radius: 10px; padding: 6px 10px; } .stc-fam > summary { font-weight: 600; color: var(--ink-2); font-size: 13px; }
  .stc-none0 { padding: 6px 0; }
  .stc-tong { margin-top: 12px; }
  .stc-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 12px; align-items: start; }
  .stc-two .stc-side h3 { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 8px; } .stc-two .stc-side h3 small { color: var(--muted); font-weight: 500; font-size: 12px; }
  .stc-two .stc-side { padding: 12px 14px; min-width: 0; }
  details.stc-cmp { padding: 10px 14px; } details.stc-cmp > summary { cursor: pointer; font-weight: 600; } details.stc-cmp > summary small { color: var(--muted); font-weight: 400; }
  @media (max-width: 720px) { .stc-top2, .stc-two { grid-template-columns: minmax(0, 1fr); } .stc-top2 > .card { max-height: 320px; } }
  @media (max-width: 980px) { .stc-layout { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 720px) {
    .stc-full { margin: 10px -6px 0; padding: 8px; } .stc-part { padding: 8px; } .stc-glc .stc-its { margin: 0 4px 8px !important; }
    .stc-bigs { grid-template-columns: 1fr 1fr; } .stc-big:first-child { grid-column: 1 / -1; }
    .stc-tfs { grid-template-columns: minmax(0, 1fr); }
    .stc-dg { grid-template-columns: minmax(50px, .62fr) repeat(3, minmax(0, 1fr)); gap: 4px; padding: 9px 8px; font-size: 12.5px; }
    #stc-page .stc-dg .stc-c { font-size: 12px; letter-spacing: -.2px; }   /* điện thoại: số tiền 8 chữ số (−10.450.000) không bị cắt */
    .stc-dg .stc-lab { flex-direction: column; align-items: flex-start; gap: 0; line-height: 1.15; }   /* thứ xuống dưới ngày */
    @media (max-width: 380px) { #stc-page .stc-dg .stc-c { font-size: 11px; } .stc-dg { grid-template-columns: minmax(44px, .5fr) repeat(3, minmax(0, 1fr)); } }
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
    .stc-head { grid-template-columns: minmax(0, 1fr); } .stc-tile.zero { display: none; }
    .stc-fbtn { display: inline-flex !important; } .stc-flt .stc-fl { display: none; } .stc-flt.open .stc-fl { display: flex; flex: 1 1 100%; } .stc-flt.open .stc-fl select { flex: 1; max-width: none; }
    .stc-t5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>`;
