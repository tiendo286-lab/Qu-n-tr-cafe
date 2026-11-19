// Sổ thu chi (mới) — đợt 1 CHỈ XEM, chạy song song trang cũ (Thu chi, Lệch tiền ca, Công nợ, Sổ quỹ).
// 4 tab: Tổng · Đối soát Fabi · Sổ thu · Sổ chi + Quỹ ngoài (chỉ Chủ). Bước 151: tab Đối soát Fabi = A · Fabi → B · Thu chi của ca → 🔒 Chốt ca (khoá vĩnh viễn) + Khoản treo ở tab Tổng.
// Thiết kế: tai_lieu/superpowers/specs/2026-11-18-so-thu-chi-moi-design.md · Hàm tính: ../so_thu_chi_tinh.js · Máy chủ: app_stc_month, app_stc_ext
import { render as rerender } from '../app.js';
import { catalog, vnToday } from '../data.js';
import { rpc, sb } from '../sb.js';
import { bindMoneyInputs, dmy, fmt, parseMoney } from '../tien.js';
import { $, dialog, html, showSaved, str } from '../ui.js';
import { mountBankOuts } from '../phieu_chi_ck.js';
import { ALERT, COLS, LOC_EMPTY, SHIFT_ORDER, caChecks, caStage, compareDays, dayChain, dayTree, filterItems, finalNeeds, fold, fundSummary, gapMath, gapParts, locStr, parseLoc, sumItems, treoView } from '../so_thu_chi_tinh.js';

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
    // bước 151: ca đã chốt + khoản treo (máy chủ chưa có hàm thì coi như chưa có ca nào chốt)
    const [M, F] = await Promise.all([rpc('app_stc_month', { p_branch: Number(cn), p_month: month }), rpc('app_stc_finals', { p_branch: Number(cn), p_month: month })
      .catch((e) => { if (/app_stc_finals|does not exist|could not find/i.test(String(e?.message || e))) return null; throw e; })]);   // chỉ bỏ qua khi máy chủ chưa có hàm
    D = M; D.finals = Object.fromEntries(((F && F.finals) || []).map((f) => [f.id, f])); D.treo = (F && F.treo) || [];
    (D.items || []).forEach((x) => { if (x.ca_id && D.finals[x.ca_id]) x.can_edit = false; });
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
  if (params.ds && params.ds + '|' + (params.t || '') !== DS_PARAM) { DS_SEL = params.ds; DS_PARAM = params.ds + '|' + (params.t || ''); }   // đường dẫn chọn ca 1 lần
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
      <div class="stc-sub"><b>Sổ thu chi · ${D.branch.code}</b> · số liệu từ ${dmy(D.from)} · thu chi, đối soát Fabi, chốt ca và quỹ ở một chỗ</div>
      <nav class="stc-tabs" aria-label="Chọn sổ">${TABS.filter((t) => !(isExt && t[0] === 'doi-soat')).map(([k, l]) => html`<a class="${tab === k ? 'on' : ''}" href="${q({ tab: k, cot: '' })}">${l}</a>`)}</nav>
    </header>`;
  const body = tab === 'thu' || tab === 'chi' ? bookPage(D, tab) : tab === 'tong' ? tongPage(D) : dsPage(D);
  return {
    title: `Sổ thu chi ${D.branch.code}`,
    html: html`${STYLE}<div id="stc-page">${head}${body}</div>`,
    mount() {
      const root = $('#stc-page'); if (!root) return;
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
        const dw = ev.target.closest('[data-dsfabi],[data-dsblame],[data-dsunblame],[data-dsmode],[data-dscash],[data-dsclose],[data-dsreopen],[data-dsfinal]');
        if (dw && root.contains(dw) && !dw.disabled) { dsAct(D, dw); return; }
        const ds = ev.target.closest('[data-dsca]');
        if (ds && root.contains(ds)) { DS_SEL = ds.dataset.dsca; const box = $('#stc-ds'); if (box) box.innerHTML = str(dsBody(D)); if (ds.classList.contains('stc-go')) $('.stc-dsp')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
      if ((P.tab === 'thu' || P.tab === 'chi') && !FTV) finTypes().then(() => { const b = $('#stc-book'); if (b) b.innerHTML = str(bookCard(D, P.tab)); const a = $('.stc-aside'); if (a) a.innerHTML = str(bookSide(D, P.tab)); });
      // bước 152: bộ lọc sổ — vẽ lại riêng phần sổ, giữ con trỏ ở ô tìm; đường dẫn cập nhật không tải lại trang
      let lfT = null;
      const lfSet = (k, v) => { const f = parseLoc(P.loc); f[k] = v; if (k === 'type') f.cat = ''; P.loc = locStr(f);
        try { history.replaceState(null, '', q()); } catch (_) { /* bỏ qua */ }
        const b = $('#stc-book'); if (b) b.innerHTML = str(bookCard(D, P.tab));
        const c = $('#stc-lfclr'); if (c) c.hidden = !P.loc; if (k === 'type') fillFilter(D, P.tab); };
      root.addEventListener('input', (ev) => { const i = ev.target.closest('[data-lf="q"]'); if (!i) return; clearTimeout(lfT); lfT = setTimeout(() => lfSet('q', i.value), 250); });
      root.addEventListener('change', (ev) => { const i = ev.target.closest('select[data-lf]'); if (i) lfSet(i.dataset.lf, i.value); });
      root.addEventListener('click', (ev) => { if (!ev.target.closest('#stc-lfclr')) return; P.loc = ''; location.hash = q(); });
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
  const cas = (D.cas || []).filter((c) => c.recon_money_done && !isFin(D, c.id) && !D.locked)
    .sort((a, b) => (a.date === b.date ? SHIFT_ORDER.indexOf(b.shift) - SHIFT_ORDER.indexOf(a.shift) : a.date < b.date ? 1 : -1));
  const cs = (await cats()).filter((c) => c.kind === (book === 'chi' ? 'chi' : 'thu') && c.active !== false);
  const pmOpt = (name) => html`<select class="input" name="${name}"><option value="tien_mat" ${pm !== 'ck' ? 'selected' : ''}>Tiền mặt</option><option value="chuyen_khoan" ${pm === 'ck' ? 'selected' : ''}>Chuyển khoản</option></select>`;
  const f = (label, ctl, show = '', cls = '') => html`<label class="stc-af ${cls}" data-show="${show}"><span>${label}</span>${ctl}</label>`;
  const box = document.createElement('form'); box.className = 'stc-addp'; box.noValidate = true;
  box.innerHTML = str(html`<div class="stc-ah"><b>+ Thêm phiếu ${book}</b> <span class="st-meta">phiếu bổ sung của quản lý · Chủ, Quản lý tổng, Quản lý cơ sở đều thêm được</span>
      ${f('Loại', html`<select class="input" name="kind">${kinds.map(([k, l]) => html`<option value="${k}" ${k === preset ? 'selected' : ''}>${l}</option>`)}</select>`, '', 'stc-ak')}</div>
    <div class="stc-ar">
      ${f('Tiền', pmOpt('pay'), 'chi khac no-chi')}
      ${f('Chiều', html`<select class="input" name="dir"><option value="tm_tk">Tiền mặt → Tài khoản</option><option value="tk_tm">Tài khoản → Tiền mặt</option></select>`, 'lc')}
      ${f('Tiền', pmOpt('pay2'), 'no-thu')}
      ${f('Ngày', html`<input class="input" type="date" name="date" value="${today}">`)}
      ${f('Ca', html`<select class="input" name="ca"><option value="">Ngoài ca</option>${cas.map((c) => html`<option value="${c.id}" ${String(c.id) === String(caId) ? 'selected' : ''}>${caName(c)}</option>`)}</select>`)}
      ${f('Nội dung', html`<input class="input" name="note" placeholder="${book === 'chi' ? 'vd: Mua đá' : 'vd: Bán vỏ thùng'}">`, 'chi khac lc', 'stc-aw')}
      ${f('Người nợ', html`<input class="input" name="name" list="stc-people" placeholder="Khách"><datalist id="stc-people">${(D.people || []).map((p) => html`<option value="${p.name}"></option>`)}</datalist>`, 'no-chi', 'stc-aw')}
      ${f('Khách trả nợ', html`<select class="input" name="debt"><option value="">— Chọn khách đang nợ —</option>${debts.map((x) => html`<option value="${x.id}">${x.who} · còn nợ ${fmt(x.left)} · từ ${x.from}</option>`)}</select>`, 'no-thu', 'stc-aw')}
    </div>
    <div class="stc-ar">
      ${f('Số tiền', html`<input class="input money" name="amount" inputmode="numeric">`, '', 'stc-am')}
      ${cs.length === 1 ? html`<span class="pill mute stc-ac" data-show="chi khac">Nhóm: ${cs[0].name}<input type="hidden" name="cat" value="${cs[0].id}"></span>`
        : f('Nhóm', html`<select class="input" name="cat"><option value="">— Chọn nhóm —</option>${cs.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select>`, 'chi khac')}
      ${f('Lý do', html`<input class="input" name="reason">`, '', 'stc-aw')}
      <span class="stc-abtn"><button class="btn sm" type="submit">Lưu phiếu</button><button type="button" class="btn sm secondary" data-x>Huỷ</button></span>
    </div><div class="stc-err"></div>`);
  const anchor = btn.closest('.stc-ch') || btn.closest('.stc-it.add, .stc-tools') || btn;
  anchor.insertAdjacentElement('afterend', box);
  bindMoneyInputs(box);
  const el = (n) => box.querySelector(`[name=${n}]`);
  const kindOf = () => { const k = el('kind').value; return k === 'no' ? `no-${book}` : k; };
  const sync = () => {
    const k = kindOf(); const caOk = k === 'chi' || k === 'khac';
    box.querySelectorAll('[data-show]').forEach((x) => { x.hidden = !!x.dataset.show && !x.dataset.show.split(' ').includes(k); });
    if (!caOk) el('ca').value = '';
    el('ca').disabled = !caOk || !cas.length; el('ca').title = caOk ? '' : 'Cho nợ / Thu nợ / Luân chuyển chỉ thêm ngoài ca';
    const ca = cas.find((c) => String(c.id) === el('ca').value);
    if (ca) el('date').value = ca.date; el('date').disabled = !!ca;
    el('reason').placeholder = ca ? 'bắt buộc khi thêm vào ca' : 'không bắt buộc';
  };
  el('kind').addEventListener('change', sync); el('ca').addEventListener('change', sync); sync();
  box.querySelector('[data-x]').addEventListener('click', () => box.remove());
  box.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const sb = box.querySelector('[type=submit]');
    const v = (n) => (el(n)?.value || '').trim(); const amount = parseMoney(v('amount')) || 0; const reason = v('reason') || null;
    const k = v('kind'); const ca = cas.find((c) => String(c.id) === v('ca'));
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
    if (canRestore(D, x)) pills.push(html`<button type="button" class="btn sm secondary" data-restore="${x.id}">↺ Khôi phục phiếu</button>`);
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
  else if (!['dt', 'lech'].includes(x.col) && !x.to_qn) {
    const ca = x.ca_id ? (D?.cas || []).find((c) => c.id === x.ca_id) : null;
    const why = ca && isFin(D, ca.id) ? 'Ca đã chốt — không sửa được nữa' : ca && !ca.recon_money_done ? 'Xác nhận Fabi ở tab Đối soát Fabi mới sửa được' : ca ? 'Khoản tự động / đổi tiền / đã thành nợ — sửa ở phiếu ca' : 'Sửa ở trang cũ';
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
function addBtn(D, c, book, label) {
  if (D.ext) return D.locked ? off(`+ Thêm khoản ngoài`, 'btn sm secondary') : html`<button type="button" class="btn sm secondary stc-xadd">+ Thêm khoản ngoài</button>`;
  if (String(c.caId).startsWith('o:')) return html`<button type="button" class="btn sm secondary stc-add">+ Thêm phiếu ${book} ngoài ca</button>`;
  const ca = (D.cas || []).find((x) => x.id === c.caId);
  const go = html` <a class="btn sm secondary" href="${q({ tab: 'doi-soat', cot: '' })}&ds=${c.caId}">Xử lý & chốt ca này ở Đối soát Fabi ›</a>`;
  if (ca && isFin(D, ca.id)) return html`<span class="st-meta">🔒 Ca đã chốt — không thêm / sửa được nữa</span>`;
  if (ca && !ca.recon_money_done) return html`<span class="st-meta">🔒 Chưa xác nhận Fabi — </span>${go}`;
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
  const st = !od ? html`<span class="pill ok">Đã thu hết</span>` : Number(od.left) < Number(x.amount) ? html`<span class="pill warn">Đã thu ${fmt(Number(x.amount) - Number(od.left))} · còn nợ ${fmt(od.left)}</span>` : html`<span class="pill mute">Còn nợ ${fmt(od.left)}</span>`;
  const names = [...new Set([name, ...(D.people || []).map((q) => q.name)])].filter(Boolean);
  const sel = x.can_edit ? html`<label class="stc-who">Người nợ <select class="input sm" data-whox="${x.id}" aria-label="Người nợ">${names.map((n) => html`<option value="${n}" ${n === name ? 'selected' : ''}>${n}${(D.people || []).find((q) => q.name === n)?.no_remind ? ' ✓' : ''}</option>`)}<option value="__add">+ Thêm người nợ…</option></select></label>` : '';
  return html`${sel}${pp?.no_remind ? html`<span class="pill ok">✓ Không nhắc thu ở phiếu chốt ca</span>` : html`<span class="pill info">Phiếu chốt ca sẽ nhắc thu</span>`}${st}`;
}
async function setWho(D, x, v, sel) {
  const save = async (name) => rpc('app_stc_debt_save', { p_id: idNum(x.id), p: { name, amount: Number(x.amount), kind: x.pm === 'ck' ? 'ck' : 'muon', date: x.date }, p_reason: 'Đổi người nợ: ' + name });
  if (v !== '__add') { try { await save(v); after('Đã đổi người nợ'); } catch (e) { showSaved(e.message || e, true); sel.value = debtName(x); } return; }
  sel.value = debtName(x);
  const d = dialog(form('Thêm người nợ', html`<label class="field"><span>Tên người nợ</span><input class="input" name="name" placeholder="vd: Kho Tổng"></label>
    <label class="stc-chk"><input type="checkbox" name="nr" checked> ✓ Không cần nhắc thu ở phiếu chốt ca</label>`, ' '));
  open(d, async () => { const n = val(d, 'name'); if (!n) throw new Error('Nhập tên người nợ.'); await save(n);
    await rpc('app_stc_person_mark', { p_branch: D.branch.id, p_name: n, p_no_remind: !!d.querySelector('[name=nr]').checked }); after('Đã thêm người nợ'); });
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
function filterBar(book) {
  const f = parseLoc(P.loc);
  const sel = (k, opts, label) => html`<select class="input sm" data-lf="${k}" aria-label="${label}">${opts.map(([v, l]) => html`<option value="${v}" ${f[k] === v ? 'selected' : ''}>${l}</option>`)}</select>`;
  return html`<div class="stc-flt" role="search">
    <input class="input sm stc-q" type="search" data-lf="q" value="${f.q}" placeholder="Tìm nội dung, nhóm, người, giải trình…" aria-label="Tìm">
    ${sel('src', SRC_OPTS, 'Nguồn')}
    <select class="input sm" data-lf="type" aria-label="Loại"><option value="">Mọi loại</option>${f.type ? html`<option value="${f.type}" selected>…</option>` : ''}</select>
    <select class="input sm" data-lf="cat" aria-label="Nhóm"><option value="">Mọi nhóm</option>${f.cat ? html`<option value="${f.cat}" selected>${f.cat}</option>` : ''}</select>
    ${sel('st', ST_OPTS, 'Trạng thái')}
    <button type="button" class="btn sm secondary" id="stc-lfclr" ${P.loc ? '' : 'hidden'}>Bỏ lọc</button></div>`;
}
// Điền Loại / Nhóm theo danh mục thu chi (tải chậm, không chặn trang)
async function fillFilter(D, book) {
  const r = await finTypes(); const f = parseLoc(P.loc); const kind = book === 'thu' ? 'thu' : 'chi';
  const ts = (r.types || []).filter((t) => t.active !== false && (!t.kind || t.kind === kind));
  const cs = (r.cats || []).filter((c) => c.active !== false && c.kind === kind && (!f.type || String(c.type_id) === String(f.type)));
  const ty = $('select[data-lf="type"]'); const ca = $('select[data-lf="cat"]'); if (!ty || !ca) return;
  ty.innerHTML = str(html`<option value="">Mọi loại</option>${ts.map((t) => html`<option value="${t.id}" ${String(f.type) === String(t.id) ? 'selected' : ''}>${t.name}</option>`)}`);
  ca.innerHTML = str(html`<option value="">Mọi nhóm</option>${cs.map((c) => html`<option value="${c.name}" ${f.cat === c.name ? 'selected' : ''}>${c.name}</option>`)}`);
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
  return html`<div class="stc-ch"><h2>Phiếu trừ lương · đang lọc <small>${list.length} phiếu · ${fmt(list.reduce((a, k) => a + Number(k.amount || 0), 0))}</small></h2></div>
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
  const rows = list.map((x) => { const c = caOf(x); return html`<div class="stc-fr"><div class="st-meta stc-frh">${dm(x.date)} · ${c ? 'Ca ' + c.shift : 'Ngoài ca'}${x.pm === 'ck' ? ' · CK' : ' · TM'}</div>
      ${itemRow(x, book, D)}${tlRows(x)}${f.st === 'tl' && x.gap ? html`<div class="stc-tlr"><span class="st-meta">${isFin(D, x.ca_id) ? '🔒 Ca đã chốt — không huỷ được' : ''}</span><button type="button" class="btn sm secondary" data-gap="${x.id}">Mở phiếu chênh lệch</button></div>` : ''}</div>`; });
  return html`<div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · đang lọc <small>${list.length} khoản · ${fmt(sumItems(list.filter((x) => !x.void)))}</small></h2></div>
    <div class="stc-g stc-hdr" style="--n:${n}"><span>Khoản</span>${COLS[book].map(([, l]) => html`<span>${l}</span>`)}<span>Tổng</span></div>
    ${rows.length ? html`<div class="stc-its stc-flat">${rows}</div>` : html`<div class="stc-empty">Không có khoản nào khớp bộ lọc.</div>`}`;
}
function bookCard(D, book) {
  const lf = parseLoc(P.loc); if (locStr(lf)) return bookFlat(D, book, lf);
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
// Quỹ ngoài › Sổ chi: phần mỗi cơ sở chịu (tạm tính theo cách chia); theo tỉ lệ doanh thu thì Chốt tháng tính
function qnShare(D) {
  const brs = (D.branches || []).map((b) => b.code); if (!brs.length) return '';
  const chis = (D.items || []).filter((x) => !x.void && x.book === 'chi' && x.col === 'chi');
  const share = Object.fromEntries(brs.map((b) => [b, 0])); let byRev = 0, other = 0;
  chis.forEach((x) => { const c = x.chia || ''; const a = Number(x.amount || 0);
    if (c.startsWith('Chia đều')) brs.forEach((b) => { share[b] += a / brs.length; });
    else if (c.startsWith('1 cơ sở: ')) { const b = c.slice(9); if (b in share) share[b] += a; else other += a; }
    else if (c.startsWith('Theo tỉ lệ')) byRev += a; else other += a; });
  return html`<section class="card stc-side"><h3>Phần mỗi cơ sở chịu <small class="st-meta">tạm tính</small></h3>
    ${brs.map((b) => html`<div class="stc-si"><span><b>${b}</b></span><b>${fmt(Math.round(share[b]))}</b></div>`)}
    ${byRev ? html`<div class="stc-si"><span>Theo tỉ lệ doanh thu tháng<br><span class="st-meta">chia ở Chốt tháng</span></span><b>${fmt(byRev)}</b></div>` : ''}
    ${other ? html`<div class="stc-si"><span>Không chia / tự nhập / chưa chọn cách chia</span><b>${fmt(other)}</b></div>` : ''}
    <div class="st-meta stc-note">Tính vào chi phí của cơ sở ở Chốt tháng. Thanh toán kho tổng không chia lại (đã tính theo từng hoá đơn).</div></section>`;
}
function bookSide(D, book) {
  const its = D.items.filter((x) => !x.void);
  const card = (title, list, empty, note = '') => html`<section class="card stc-side"><h3>${title}</h3>${list.length ? list : html`<div class="st-meta">${empty}</div>`}${note ? html`<div class="st-meta stc-note">${note}</div>` : ''}</section>`;
  const li = (x, extra = '') => html`<div class="stc-si"><span><b>${x.title}</b> <span class="stc-tag t-${x.pm}">${x.pm === 'tm' ? 'TM' : 'CK'}</span><br><span class="st-meta">${dm(x.date)}${x.from ? ' · nợ từ ' + x.from : ''}${x.status ? ' · ' + x.status : ''}${extra}</span></span><b class="stc-amt ${x.book}">${sg(x.book)}${fmt(x.amount)}</b></div>`;
  // bước 155: ca thiếu / dư bấm vào là mở phiếu chênh lệch; khoản chưa phân loại chọn nhóm tại chỗ
  const caOf = (x) => (D.cas || []).find((c) => c.id === x.ca_id);
  const liGap = (x) => { const ok = !!x.gap && !D.ext && caOf(x)?.recon_money_done && !isFin(D, x.ca_id);
    return ok ? html`<button type="button" class="stc-si stc-go" data-gap="${x.id}"><span><b>${caOf(x) ? caName(caOf(x)) : dm(x.date)}</b> <span class="stc-tag t-${x.pm}">${x.pm === 'tm' ? 'TM' : 'CK'}</span><br><span class="st-meta">${x.status ? gapStatus(x.status) : ''} · mở phiếu chênh lệch ›</span></span><b class="stc-amt ${x.book}">${sg(x.book)}${fmt(x.amount)}</b></button>` : li(x); };
  const liTodo = (x) => { const cs = catSelect(D, x); return cs ? html`<div class="stc-si stc-todo"><span><b>${x.title}</b> <span class="stc-tag t-${x.pm}">${x.pm === 'tm' ? 'TM' : 'CK'}</span><br><span class="st-meta">${caOf(x) ? caName(caOf(x)) : dm(x.date)}${x.meta ? ' · ' + x.meta : ''}</span><br>${cs}</span><b class="stc-amt chi">−${fmt(x.amount)}</b></div>` : li(x); };
  if (book === 'thu') {
    const no = its.filter((x) => x.book === 'thu' && x.col === 'no');
    const du = its.filter((x) => x.book === 'thu' && x.col === 'lech');
    const today = vnToday();
    const debts = (D.open_debts || []).map((d) => { const days = Math.max(0, Math.round((new Date(today) - new Date(d.date)) / 864e5)); return html`<div class="stc-si stc-kd"><span><b>${d.who}</b> ${d.no_remind ? html`<span class="pill ok">✓ không nhắc</span>` : ''}<br><span class="st-meta">${d.from} · <span class="${days > 7 ? 'stc-red' : ''}">${days} ngày</span></span></span><span class="stc-r"><b>${fmt(d.left)}</b>${D.ext ? '' : html`<button type="button" class="btn sm secondary stc-col" data-col-debt="${d.id}">Thu nợ</button>`}</span></div>`; });
    return html`${card(`Thu nợ tháng này · ${fmt(sumItems(no))}`, no.map((x) => li(x)), 'Chưa có khoản thu nợ.')}${card('Ca dư tiền', du.map(liGap), 'Không có ca dư.', 'Bấm một ca để mở phiếu chênh lệch: gán nợ khách trả, ghép với ca thiếu, hoặc tạo phiếu thu.')}
      ${card('Khách đang nợ', debts, 'Không còn ai nợ.', 'Gồm cả nợ hoá đơn (chưa phải tiền nên không nằm trong sổ). Đỏ khi quá 7 ngày.')}`;
  }
  const th = its.filter((x) => x.book === 'chi' && x.col === 'lech');
  const cn = its.filter((x) => x.book === 'chi' && x.col === 'no');
  const todo = its.filter((x) => x.book === 'chi' && x.col === 'chi' && !x.cat);
  const cost = its.filter((x) => x.book === 'chi' && x.col === 'chi' && x.cat && !x.no_cost);
  const totalCost = sumItems(cost);
  const people = (D.people || []).map((p) => html`<label class="stc-si stc-pp"><span><input type="checkbox" data-person="${p.name}" ${p.no_remind ? 'checked' : ''} ${D.ext ? 'disabled' : ''}> <b>${p.name}</b><br>
      <span class="st-meta">${p.n ? `${p.n} khoản còn nợ · ` : ''}${p.no_remind ? '✓ không nhắc ở phiếu chốt ca' : 'phiếu chốt ca nhắc thu'}</span></span><b>${p.open ? fmt(p.open) : ''}</b></label>`);
  // Chi theo loại (như bản mẫu): gom theo loại chi phí, có nhóm con
  const tnames = Object.fromEntries(((FTV && FTV.types) || []).map((t) => [String(t.id), t.name]));
  const tgroups = [...new Set(cost.map((x) => String(x.cat_type ?? '')))].map((t) => { const xs = cost.filter((x) => String(x.cat_type ?? '') === t);
    return { t: tnames[t] || (t ? 'Loại khác' : 'Chưa có loại'), v: sumItems(xs), cs: [...new Set(xs.map((x) => x.cat))].map((c) => [c, sumItems(xs.filter((x) => x.cat === c))]).sort((a, b) => b[1] - a[1]) }; }).sort((a, b) => b.v - a.v);
  const shareCard = D.ext ? qnShare(D) : '';
  return html`${shareCard}${card('Ca thiếu tiền', th.map(liGap), 'Không có ca thiếu.', 'Bấm một ca để mở phiếu chênh lệch: trừ lương, quán chịu hoặc ghép ca.')}${card(`Cho nợ tháng này · ${fmt(sumItems(cn))}`, cn.map((x) => li(x)), 'Chưa có khoản cho nợ.')}
    ${card('Người nợ', people, 'Chưa có người nợ có tên.', 'Có dấu ✓: phiếu chốt ca không nhắc thu người này (thay "Công nợ gia đình" và "Nợ kho tổng"). Khách luôn được nhắc. Thêm người nợ mới bằng "+ Thêm phiếu" › Cho nợ.')}
    ${card(`Cần phân loại · ${todo.length} khoản`, todo.map(liTodo), 'Đã phân loại hết.', 'Chọn nhóm là đối soát luôn.')}
    ${card(`Chi theo loại · TM + CK · ${fmt(totalCost)}`, tgroups.map((g) => html`<div class="stc-tyg"><div class="stc-tyh"><span>${g.t}</span><b>${fmt(g.v)}</b></div><div class="stc-bar"><i style="width:${totalCost ? Math.round(g.v / totalCost * 100) : 0}%"></i></div>
      ${g.cs.map(([c, v]) => html`<div class="stc-tyc"><span>${c}</span><b>${fmt(v)}</b></div>`)}</div>`), 'Chưa có khoản chi.',
      `Không cộng ${fmt(sumItems(its.filter((x) => x.book === 'chi' && x.col === 'chi' && x.no_cost)))} của các khoản Không tính chi phí. Chi phí Quỹ ngoài và tiền hàng kho tổng xem ở Chốt tháng.`)}`;
}
function bookPage(D, book) {
  const its = D.items;
  const pays = ['tm', 'ck'].map((pm) => html`<a class="stc-pay ${P.pm === pm ? 'on' : ''}" href="${q({ pm })}"><span class="k">Bảng ${PM[pm]}</span><span class="v">${sg(book)}${fmt(sumItems(its, { book, pm }))}</span><span class="s">Tổng ${book} ${monthLabel(P.thang).toLowerCase()}</span></a>`);
  const tiles = COLS[book].map(([k, l]) => {
    const v = sumItems(its, { book, pm: P.pm, col: k });
    let s = '';
    if (book === 'chi' && k === 'chi') { const nc = sumItems(its.filter((x) => x.no_cost && x.col === 'chi' && x.book === 'chi' && x.pm === P.pm)); if (nc) s = `trong đó ${fmt(nc)} không tính chi phí`; }
    if (k === 'lech') { const w = its.filter((x) => !x.void && x.book === book && x.pm === P.pm && x.col === 'lech' && /Chờ/.test(x.status || '') && !isFin(D, x.ca_id)).length; if (w) s = `${w} ca chờ xử lý`; }   // bước 155
    return html`<a class="stc-tile ${P.cot === k ? 'on' : ''}" data-col="${k}" href="${q({ cot: P.cot === k ? '' : k })}"><span class="stc-tag t-${k}">${l}</span><b>${fmt(v)}</b><small>${s || (HINT[book] || {})[k] || ''}</small></a>`;
  });
  return html`<div class="stc-pays">${pays}</div>
    <div class="st-meta stc-formula"><b>Tổng ${book}</b> = ${COLS[book].map(([, l], i) => html`${i ? ' + ' : ''}<b>${l}</b>`)}</div>
    <div class="stc-tiles">${tiles}<div class="stc-tile tot"><span>Tổng ${book} · ${PM[P.pm]}</span><b>${fmt(sumItems(its, { book, pm: P.pm }))}</b><small>bấm ô để lọc sổ</small></div></div>
    <div class="stc-layout"><section class="card stc-book">${filterBar(book)}<div id="stc-book">${bookCard(D, book)}</div></section><aside class="stc-aside">${bookSide(D, book)}</aside></div>`;
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
  const notChot = (D.cas || []).filter((c) => !isFin(D, c.id));
  const tOpen = (D.treo || []).filter((t) => t.status === 'mo'); const tOver = tOpen.filter((t) => treoView(t).over).length;
  const pend = its.filter((x) => x.col === 'lech' && x.status && /Chờ/.test(x.status) && !isFin(D, x.ca_id));   // ca đã chốt: phần còn chờ nằm ở Khoản treo
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
      ${ext ? '' : html`<div class="stc-tile ${notChot.length ? 'warn' : ''}"><span>Ca chưa chốt</span><b>${notChot.length}</b><small>xem tab Đối soát Fabi</small></div>
        <div class="stc-tile ${tOver ? 'stc-bad' : tOpen.length ? 'warn' : ''}"><span>Khoản treo</span><b>${tOpen.length}</b><small>${tOpen.length ? fmt(tOpen.reduce((a, t) => a + Number(t.left || 0), 0)) + (tOver ? ` · ${tOver} quá hạn` : '') : 'không có'}</small></div>
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
      <aside class="stc-aside">${ext ? '' : treoCard(D)}
        <section class="card stc-side"><h3>${ext ? 'Tiền các cơ sở chuyển về' : 'Chuyển về Quỹ ngoài'} <small>${waitN} chờ Chủ nhận</small></h3>
          ${incoming.length ? incoming.map((x) => html`<div class="stc-si stc-qnl"><span><b>${ext ? (x.from || '') + ' · ' : ''}${x.pm === 'tm' ? 'Tiền mặt' : 'Chuyển khoản'} · ${dm(x.date)}</b><br>${x.title.includes(' · ') ? html`<span class="st-meta">${x.title.split(' · ').slice(1).join(' · ')}</span><br>` : ''}<span class="pill ${x.recv === 'cho' ? 'warn' : 'ok'}">${x.status || ''}</span>
            ${x.recv === 'cho' ? html`${D.owner ? html` <button type="button" class="btn sm" data-qnok="${idNum(x.id)}">Đã nhận tiền</button>` : ''}${ext ? '' : html` <button type="button" class="btn sm secondary" data-qned="${idNum(x.id)}">Sửa / Xoá</button>`}` : html` <span class="st-meta">🔒</span>`}</span><b>${fmt(x.amount)}</b></div>`)
            : html`<div class="st-meta">Tháng này chưa có.</div>`}
          <div class="st-meta stc-note">Thay cho phiếu rút cũ. Chủ bấm "Đã nhận tiền" thì khoá cả 2 bên.</div></section>
        ${ext ? '' : html`<section class="card stc-side" id="stc-kqbox"><h3>Kiểm quỹ tháng này</h3><div class="st-meta">Đang tải…</div></section>`}
        ${ext ? '' : html`<section class="card stc-side"><h3>Chờ xử lý</h3>
          ${notChot.map((c) => html`<div class="stc-si"><span>Ca ${c.shift} ${dm(c.date)} chưa chốt ca${c.recon_money_done ? '' : ' (chưa xác nhận Fabi)'}</span><a href="${q({ tab: 'doi-soat', cot: '' })}&ds=${c.id}">Mở ›</a></div>`)}
          ${pend.map((x) => html`<div class="stc-si"><span>${x.title} · ${dm(x.date)}<br><span class="st-meta">${x.status}</span></span><b>${fmt(x.amount)}</b></div>`)}
          ${todo.map((x) => html`<div class="stc-si"><span>Chưa phân loại · ${x.title}</span><b>${fmt(x.amount)}</b></div>`)}
          ${notChot.length + pend.length + todo.length ? '' : html`<div class="st-meta">Không còn gì. 👍</div>`}</section>`}
      </aside></div>`;
}
let DS_SEL = null;   // ca đang mở ở tab Đối soát Fabi
let DS_PARAM = '';   // tham số ds= đã dùng (không ép lại sau mỗi lần vẽ)
const DSB = { book: 'thu', pm: 'tm' };   // sổ / bảng đang xem ở phần B
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
    run(() => rpc('app_stc_ds_close', { p_report: c.id }), 'Đã xác nhận Fabi — phần B đã mở');
  } else if (b.dataset.dsreopen) {
    ask('Mở lại xác nhận Fabi', html`<div class="st-meta">Mở lại để sửa số Fabi / nhân viên ghi / tiền thực nhận. Thu chi của ca khoá sửa tới khi xác nhận lại.</div>`, true,
      (d) => rpc('app_stc_ds_reopen', { p_report: c.id, p_reason: val(d, 'reason') }), 'Đã mở lại xác nhận');
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
  const all = (D.cas || []).map((c) => { const link = chains[c.date].get(c.id); const cs = caChecks(c, link);
    return { c, link, cs, st: caStage(c, cs, D.finals?.[c.id], treoOf(D, c.id).some((t) => t.status === 'mo')) }; });
  return { dates, all };
}
// ---- phần A · Fabi
function partA(D, a) {
  const { c, link, cs } = a; const m = link ? link.money : null; const fin = isFin(D, c.id); const f = c.fabi || {}, nv = c.nv || {};
  const kt = c.kt_wait || c.bank_ck == null; const byCa = c.cash_mode === 'ca';
  const last = !(D.cas || []).some((o) => o.date === c.date && SHIFT_ORDER.indexOf(o.shift) > SHIFT_ORDER.indexOf(c.shift));
  if (c.recon_money_done) {
    return html`<div class="stc-part stc-pa"><div class="h">A · Fabi <span class="pill ok">Đã xác nhận</span>${phBtn(c)}${fin ? '' : html`<button type="button" class="btn sm secondary" data-dsreopen="1">Mở lại xác nhận</button>`}</div>
      <div class="stc-fsum"><div><span>Tiền mở ca</span><b>${fmt(f.has ? f.opening ?? 0 : nv.opening ?? 0)}</b></div><div><span>Doanh thu (máy Fabi)</span><b>${fmt(f.revenue ?? nv.revenue ?? 0)}</b></div>
        <div><span>Nợ bill (máy Fabi)</span><b>${fmt(f.debt ?? nv.debt ?? 0)}</b></div>
        <div><span>Tiền mặt thực nhận</span><b>${m ? fmt(m.tm.real) : '–'}</b></div><div><span>Chuyển khoản thực nhận</span><b>${kt ? 'chờ kế toán' : fmt(c.bank_ck)}</b></div></div></div>`;
  }
  const effect = { mo: (x) => (x.blame ? html`<span class="st-meta">→ <b>Có vào sổ:</b> dòng Chênh lệch tiền mặt ${signedFmt(Number(x.blame.diff))} của ${x.blame.who === 'nay' ? 'ca này' : 'ca trước'}.</span>` : x.fix === 'fabi' ? html`<span class="st-meta">→ Lấy số máy: chỉ sửa số trên phiếu nhân viên, không tạo phiếu.</span>` : ''),
    dt: (x) => (x.st === 'red' ? html`<span class="st-meta">→ Phiếu thu không đổi: sổ luôn lấy doanh thu máy Fabi; thiếu tiền thật thì hiện ở dòng Chênh lệch.</span>` : ''),
    no: (x) => (x.st === 'red' && Number(f.debt) > Number(nv.debt) ? html`<span class="st-meta">→ Không tạo phiếu chi: thêm khách nợ ${fmt(Number(f.debt) - Number(nv.debt))} ở Công nợ (bill nợ chưa phải tiền).</span>` : '') };
  const raw = { mo: [nv.opening, f.opening], dt: [nv.revenue, f.revenue], no: [nv.debt, f.debt] };
  const pv = (D.cas || []).find((o) => o.date === c.date && SHIFT_ORDER.indexOf(o.shift) === SHIFT_ORDER.indexOf(c.shift) - 1);
  const prevFin = !!pv && isFin(D, pv.id);   // máy chủ cũng chặn
  const box = (x) => { const [a1, b1] = raw[x.k]; const nvT = Number(a1 ?? 0), fbT = Number(b1 ?? 0);
    const txt = x.st === 'red' && x.fix === 'fabi' ? `🔴 Nhân viên ghi ${nvT > fbT ? 'thừa' : 'thiếu'} ${fmt(nvT - fbT)} so với máy` : x.txt;
    return html`<div class="stc-c4 ${x.st}" data-k="${x.k}"><b>${x.name}</b><span class="stc-ln">Phiếu nhân viên ghi: <b>${fmt(nvT)}</b></span><span class="stc-ln">Máy Fabi ghi: <b>${f.has ? fmt(fbT) : 'chưa có'}</b></span>
      ${x.k === 'mo' ? html`<span class="st-meta">${x.b}</span>` : ''}<span class="pill ${x.st === 'ok' ? 'ok' : x.st === 'red' ? 'off' : 'info'}">${txt}</span>${effect[x.k](x)}
      ${D.ext ? '' : x.fix === 'fabi' ? html`<span class="stc-tools"><button type="button" class="btn sm" data-dsfabi="${x.k}">Lấy số máy Fabi${x.k === 'no' && Number(f.debt) > Number(nv.debt) ? ` (thêm báo nợ ${fmt(Number(f.debt) - Number(nv.debt))})` : ''}</button></span>`
        : x.fix === 'blame' ? html`<span class="st-meta">Ca nào ghi sai thì ca đó chịu tiền lệch:</span><span class="stc-tools">${prevFin ? html`<span class="st-meta">Ca trước đã chốt ca — không chọn "Ca trước ghi sai" được.</span>` : html`<button type="button" class="btn sm secondary" data-dsblame="truoc">Ca trước ghi sai</button>`}<button type="button" class="btn sm secondary" data-dsblame="nay">Ca này ghi sai</button></span>`
        : x.blame ? html`<span class="stc-tools"><span class="st-meta">${x.blame.by || ''}${x.blame.reason ? ' · ' + x.blame.reason : ''}</span><button type="button" class="btn sm secondary" data-dsunblame="1">Huỷ chọn</button></span>` : ''}</div>`; };
  const s1 = cs.filter((x) => ['mo', 'dt', 'no'].includes(x.k));
  const red1 = s1.some((x) => x.st === 'red'); const need = [];
  if (red1) need.push('còn ô đỏ ở ①'); if (kt || !f.has) need.push('chờ kế toán'); if (byCa && c.ql_counted == null) need.push('chưa nhập tiền mặt thực nhận');
  const r = (lab, a1, b1) => html`<div class="stc-mr"><span>${lab}</span><b>${a1}</b><b>${b1}</b></div>`;
  const flags = Number(f.edited_bills || 0);
  return html`<div class="stc-part stc-pa"><div class="h">A · Fabi ${phBtn(c)} <span class="st-meta">máy Fabi là chuẩn · chỉ xác định phiếu đúng, tiền mặt và chuyển khoản thực nhận</span></div>
    <div class="stc-stp"><div class="h"><b>①</b> So phiếu nhân viên với máy Fabi</div><div class="stc-c4s">${s1.map(box)}</div>
      ${!f.has ? html`<div class="st-meta">Chưa có file Fabi: ${(c.kt_missing || []).join(', ') || 'chờ kế toán tải'}.</div>` : ''}
      ${flags ? html`<div class="stc-warnbox">⚠ Trên máy Fabi ca này có <b>${flags} hoá đơn bị sửa / xoá</b>. Hoá đơn bị sửa / xoá không còn đúng trong doanh thu Fabi — kiểm tra lại (hỏi nhân viên / xem camera).</div>` : ''}</div>
    <div class="stc-stp"><div class="h"><b>②</b> Tiền thực nhận <span class="stc-tools"><button type="button" class="btn sm ${byCa ? '' : 'secondary'}" data-dsmode="ca">Thu theo ca</button><button type="button" class="btn sm ${byCa ? 'secondary' : ''}" data-dsmode="ngay">Thu theo ngày</button></span></div>
      <div class="stc-mt">${r('', 'Tiền mặt', 'Chuyển khoản')}
        ${r('Phải có / phải nhận', m ? fmt(m.tm.must) : '–', m ? fmt(m.ck.must) : '–')}
        ${r('Thực nhận', byCa ? (c.ql_counted != null ? fmt(c.ql_counted) + ' (quản lý thu)' : 'chưa nhập') : `NV đếm ${fmt(c.nv_counted ?? 0)}`, kt ? 'chờ kế toán' : fmt(c.bank_ck) + ' (kế toán)')}</div>
      ${byCa || last ? html`<div class="stc-cash"><label class="field"><span>Tiền mặt thực nhận${byCa ? ' (quản lý đếm két ca này)' : ' (quản lý đếm két sau ca cuối ngày)'}</span>
          <input class="input money" name="ds_tm" inputmode="numeric" value="${byCa && c.ql_counted != null ? fmt(c.ql_counted) : ''}"></label><button type="button" class="btn sm" data-dscash="1">Lưu</button></div>`
        : html`<div class="st-meta">Thu theo ngày: ca này không nhập, két chuyển sang ca sau; tiền mặt thực nhận nhập ở ca cuối ngày.</div>`}
      <div class="st-meta">Chuyển khoản luôn lấy số ngân hàng kế toán nhập.</div></div>
    <div class="stc-tools"><button type="button" class="btn sm" data-dsclose="1" ${need.length ? 'disabled' : ''}>Xác nhận Fabi</button>
      <span class="st-meta">${need.length ? '🔒 ' + need.join(' · ') : 'Xác nhận xong mở phần B để xử lý thu chi và chênh lệch của ca.'}</span></div></div>`;
}
const signedFmt = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));
// ---- phần B · Thu chi của ca (giống Sổ thu / Sổ chi, lọc ca này)
function partB(D, a) {
  const { c, link } = a; const m = link ? link.money : null; const fin = isFin(D, c.id);
  if (!c.recon_money_done) return html`<div class="stc-part stc-pb stc-lockp"><div class="h">B · Thu chi của ca</div><div class="st-meta">🔒 Xác nhận Fabi ở phần A thì phần này mới mở.</div></div>`;
  const book = DSB.book, pm = DSB.pm; const cols = COLS[book]; const n = cols.length;
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
  return html`<div class="stc-part stc-pb"><div class="h">B · Thu chi của ca <span class="st-meta">giống Sổ thu / Sổ chi, chỉ lọc ca này</span>${fin ? html`<span class="pill ok">🔒 khoá</span>` : ''}</div>
    <div class="stc-tools"><button type="button" class="btn sm ${book === 'thu' ? '' : 'secondary'}" data-dsbook="thu">Sổ thu</button><button type="button" class="btn sm ${book === 'chi' ? '' : 'secondary'}" data-dsbook="chi">Sổ chi</button>
      <span class="st-meta">Chênh lệch tiền mặt ở bảng Tiền mặt, chuyển khoản ở bảng Chuyển khoản · dư ghi Sổ thu, thiếu ghi Sổ chi.</span></div>
    ${other.length ? html`<div class="stc-glhint">⚠ Ca còn chênh lệch ở: ${other.map((x) => html`<button type="button" class="btn sm secondary" data-dsbook="${x.book}" data-dspm="${x.pm}">${x.book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[x.pm]} ${x.book === 'thu' ? '+' : '−'}${fmt(x.gross ?? x.amount)}</button>`)}</div>` : ''}
    <div class="stc-pays" style="margin-top:0">${['tm', 'ck'].map((p) => html`<button type="button" class="stc-pay ${pm === p ? 'on' : ''}" data-dspm="${p}"><span class="k">Bảng ${PM[p]}</span><span class="v">${sg(book)}${fmt(sumItems(D.items, { book, pm: p, caId: c.id }))}</span><span class="s">Tổng ${book} ${caName(c).toLowerCase()}</span></button>`)}</div>
    <div class="st-meta stc-formula"><b>Tổng ${book}</b> = ${cols.map(([, l], i) => html`${i ? ' + ' : ''}<b>${l}</b>`)}</div>
    <div class="stc-tiles">${cols.map(([k, l]) => html`<div class="stc-tile"><span class="stc-tag t-${k}">${l}</span><b>${fmt(byCol[k])}</b></div>`)}<div class="stc-tile tot"><span>Tổng ${book} · ${PM[pm]}</span><b>${fmt(tot)}</b><small>${caName(c)}</small></div></div>
    ${m ? html`<div class="stc-mt stc-box">${r('Tiền của ca', 'Tiền mặt', 'Chuyển khoản', 'hd')}${r('Phải có / phải nhận', fmt(m.tm.must), fmt(m.ck.must))}${r('Thực tế (đã xác nhận ở phần A)', fmt(m.tm.real), kt ? '⏳' : fmt(m.ck.real))}${r('Lệch → dòng Chênh lệch trong sổ', gapB(m.tm.gap), kt ? '–' : gapB(m.ck.gap), 't')}</div>` : ''}
    ${nb || debts.length ? html`<div class="stc-mt stc-box">${r('Nợ bill của ca (chưa phải tiền · không vào Sổ thu / Sổ chi)', '', 'Số tiền', 'hd')}${r('Phiếu nhân viên khai nợ hoá đơn', '', fmt(c.nv?.debt ?? 0))}${r('Máy Fabi', '', fmt(c.fabi?.debt ?? 0), 't')}
      ${debts.map((x) => r(html`→ Khách đang nợ: <b>${x.who}</b>`, '', fmt(x.left)))}<div class="st-meta">Khoản nợ nằm ở "Khách đang nợ" (Sổ thu, khung bên phải). Khách trả thì ghi Thu nợ ở ca nhận tiền.</div></div>` : ''}
    <section class="card stc-book stc-cab"><div class="stc-ch"><h2>${book === 'thu' ? 'Sổ thu' : 'Sổ chi'} · ${PM[pm]} <small>${caName(c)}</small></h2>${fin ? '' : html`<span class="stc-tools"><button type="button" class="btn sm stc-addca" data-addca="${c.id}" data-book="${book}">+ Thêm phiếu</button></span>`}</div>
      <div class="stc-g stc-hdr" style="--n:${n}"><span>Ca</span>${cols.map(([, l]) => html`<span>${l}</span>`)}<span>Tổng ${book}</span></div>
      <div class="stc-ca open"><div class="stc-crow stc-g" style="--n:${n}"><span class="stc-lab">${caName(c)} <small>${c.staff || ''}</small></span>${cells(byCol, book, tot)}</div>
        <div class="stc-its">${its.length ? its.map((x) => itemRow(x, book, D)) : html`<div class="st-meta stc-empty">Không có khoản ${book} ${PM[pm].toLowerCase()}.</div>`}
          <div class="stc-it add">${fin ? html`<span class="st-meta">🔒 Ca đã chốt — không thêm / sửa được nữa</span>` : addBtn(D, { caId: c.id }, book, 'ca ' + c.shift)}</div></div></div></section>
    <section class="card stc-book stc-glc"><div class="stc-ch"><h2>Chênh lệch ${PM[pm].toLowerCase()} · ${book === 'thu' ? 'dư (+) ghi Sổ thu' : 'thiếu (−) ghi Sổ chi'} <small>${gl.length ? 'mỗi nguồn một dòng' : 'không có'}</small></h2></div>
      <div class="st-meta stc-pad" style="padding-top:8px">Chỉ ${book === 'thu' ? 'tiền dư' : 'tiền thiếu'} của bảng ${PM[pm]}. Bấm "Phiếu chênh lệch" để xử lý ngay tại đây.</div>
      <div class="stc-its" style="margin:0 10px 10px">${gl.length ? gl.map(glRow) : html`<div class="st-meta stc-empty">Không có ${book === 'thu' ? 'tiền dư' : 'tiền thiếu'} ${PM[pm].toLowerCase()}.</div>`}</div></section></div>`;
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
function dsPanel(D, a) {
  return html`<div class="stc-dsp stc-full"><div class="stc-dsh"><b>${caName(a.c)}</b> <span class="st-meta">${a.c.staff || ''}</span> <span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></div>
    ${partA(D, a)}${partB(D, a)}${partFinal(D, a)}</div>`;
}
function dsBody(D) {
  const { dates, all } = dsInfo(D);
  if (!all.length) return html`<section class="card stc-empty">Tháng này chưa có ca nào.</section>`;
  const extra = [...new Set(all.map((a) => a.c.shift).filter((s) => !SHIFT_ORDER.includes(s)))];
  const cols = [...SHIFT_ORDER, ...extra];
  if (!all.some((a) => String(a.c.id) === String(DS_SEL))) DS_SEL = (all.find((a) => a.st.k !== 'fin') || all[all.length - 1]).c.id;
  const sel = all.find((a) => String(a.c.id) === String(DS_SEL));
  const cnt = (k) => all.filter((a) => a.st.k === k).length;
  const tOpen = (D.treo || []).filter((t) => t.status === 'mo');
  const cell = (d, s) => { const a = all.find((x) => x.c.date === d && x.c.shift === s); if (!a) return html`<span class="st-meta">–</span>`;
    return html`<button type="button" class="stc-dsc ${String(a.c.id) === String(DS_SEL) ? 'on' : ''}" data-dsca="${a.c.id}"><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></button>`; };
  const side = (title, list, empty) => html`<section class="card stc-side"><h3>${title} <small>${list.length}</small></h3>${list.length ? html`<div class="stc-dsl">${list.map((a) => html`<button type="button" class="stc-si stc-go" data-dsca="${a.c.id}"><span>${caName(a.c)}</span><span class="pill ${a.st.cls.replace('p-', '')}">${a.st.txt}</span></button>`)}</div>` : html`<div class="st-meta">${empty}</div>`}</section>`;   // danh sách dài → cuộn trong khung, không đẩy phần ca xuống
  return html`<div class="stc-tiles">
      <div class="stc-tile"><span>Ca đã chốt</span><b>${cnt('fin')} / ${all.length}</b><small>khoá vĩnh viễn</small></div>
      <div class="stc-tile ${cnt('fab') ? 'warn' : ''}"><span>Fabi ✓ · chưa chốt ca</span><b>${cnt('fab')}</b><small>xử lý thu chi + chênh lệch rồi Chốt ca</small></div>
      <div class="stc-tile ${tOpen.length ? 'warn' : ''}"><span>Khoản treo</span><b>${tOpen.length}</b><small>${tOpen.length ? fmt(tOpen.reduce((s, t) => s + Number(t.left || 0), 0)) + ' · xem tab Tổng' : 'không có'}</small></div>
      <div class="stc-tile ${cnt('cho') ? 'warn' : ''}"><span>Chờ xác nhận Fabi</span><b>${cnt('cho')}</b><small>phần A đã khớp</small></div>
      <div class="stc-tile ${cnt('lech') ? 'warn' : ''}"><span>Còn ô đỏ Fabi</span><b>${cnt('lech')}</b><small>tiền mở ca / doanh thu / nợ</small></div>
      <div class="stc-tile ${cnt('kt') ? 'warn' : ''}"><span>Chờ kế toán</span><b>${cnt('kt')}</b><small>thiếu file Fabi / ngân hàng</small></div></div>
    <div class="st-meta stc-formula">Mỗi ca: <b>A · Fabi</b> (so phiếu nhân viên với máy Fabi · tiền mặt / chuyển khoản thực nhận) → <b>Xác nhận Fabi</b> → <b>B · Thu chi của ca</b> (sửa thu chi, xử lý chênh lệch) → <b>🔒 Chốt ca</b> (khoá vĩnh viễn; phần còn chờ thành Khoản treo).</div>
    <div class="stc-layout"><section class="card stc-book">
        <div class="stc-wk"><div class="stc-wr stc-hdr" style="--k:${cols.length}"><span>Ngày</span>${cols.map((s) => html`<span>${s}</span>`)}</div>
          ${[...dates].reverse().map((d) => html`<div class="stc-wr" style="--k:${cols.length}"><span class="stc-lab">${dm(d)} <small>${wd(d)}</small></span>${cols.map((s) => cell(d, s))}</div>`)}</div></section>
      <aside class="stc-aside">${side('Chờ xác nhận Fabi', all.filter((a) => ['cho', 'lech'].includes(a.st.k)), 'Không có.')}${side('Fabi ✓ · chưa chốt ca', all.filter((a) => a.st.k === 'fab'), 'Đã chốt hết. 👍')}${side('Chờ kế toán', all.filter((a) => a.st.k === 'kt'), 'Không có.')}</aside></div>
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
  /* bước 151: Đối soát Fabi */
  .stc-full { margin: 14px 0 0; }
  .stc-part { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
  .stc-part > .h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 800; font-size: 12.5px; letter-spacing: .04em; text-transform: uppercase; }
  .stc-part > .h .st-meta { text-transform: none; letter-spacing: 0; font-weight: 500; }
  .stc-pa > .h { color: var(--primary); } .stc-pb { border: 2px solid var(--info-line); } .stc-pb > .h { color: var(--info-ink); } .stc-lockp { opacity: .65; }
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
  @media (max-width: 980px) { .stc-layout { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 720px) {
    .stc-full { margin: 10px -6px 0; padding: 8px; } .stc-part { padding: 8px; } .stc-glc .stc-its { margin: 0 4px 8px !important; }
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
