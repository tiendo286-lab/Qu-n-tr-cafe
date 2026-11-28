// Nhân viên & tài khoản › Đào tạo — MỘT trang duy nhất (anh Tiến chốt 28/11/2026):
//  * Danh sách người có phiếu (app_dt_work_list) + bộ lọc: tìm tên / mã · cơ sở · chương trình · người hướng dẫn chính · trạng thái.
//    Lọc tại chỗ, không hỏi lại máy chủ. Không chọn trạng thái thì ẩn người đã hoàn thành. Việc cần làm (chờ kiểm tra / ca chưa giao) lên đầu.
//  * Bấm một người → thẻ xổ ra tại chỗ: Phiếu đào tạo (chính trang phiếu, nhúng vào) · Phân công theo ca · Chờ kiểm tra.
//    Hai nút sau chỉ có khi máy chủ trả bảng theo ca cho phiếu đó (app_dt_plan_board: Chủ, người phụ trách chính, HD chính của phiếu).
//  * Mỗi lúc chỉ nhúng MỘT phiếu (phiếu dùng id cố định trong trang); mở phiếu người khác thì phiếu trước thu về nút "Mở phiếu ở đây".
//  * Thẻ Phân công / Chờ kiểm tra kiểu cũ (bước 170) đã bỏ; trang riêng Phân công đào tạo (tệp 174) gộp vào đây — phần theo ca ở pc_dao_tao.js.
//  * Quyền không đổi: web chỉ ẩn / hiện theo can_board, can_check, accounts máy chủ trả.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { $, $$, flash, html, str } from '../ui.js';
import { DT_STATUS, dtLabel } from './dao_tao.js?v=2026.11.28.8';
import { chipCounts, matchRow, optionsOf, sortRows } from './dao_tao_loc.js?v=2026.11.28.8';
import { planUi } from './pc_dao_tao.js?v=2026.11.28.8';
import { PCD_CSS, dm, mountMyPlan, myPlanHtml } from './pc_dao_tao_toi.js?v=2026.11.28.8';
import { render as phieuRender } from './phieu_dao_tao.js?v=2026.11.28.8';

export const perm = null;
const PROG = { chay_ban: 'Chạy bàn', pha_che: 'Pha chế' };
const TABS = [['phieu', 'Phiếu đào tạo'], ['ca', 'Phân công theo ca'], ['kt', 'Chờ kiểm tra']];
// Trạng thái trang — sống qua các lần vẽ lại (lưu trong phiếu, xác nhận đạt, phân công ca)
const F = { q: '', cs: '', prog: '', hd: '', st: '' };
const OPEN = new Set();    // thẻ đang mở
const TAB = new Map();     // id phiếu → nút đang chọn (mặc định Phiếu đào tạo)
let PH = null;             // phiếu đang nhúng
let mucDone = '';          // ?muc= đã áp vào bộ lọc (chỉ áp khi đường dẫn đổi)

const CSS = html`<style>
  .dtg { max-width: 980px; gap: 12px; }
  .dtg-f { display: flex; flex-direction: column; gap: 10px; }
  .dtg-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .dtg-row label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--ink-2); flex: 1 1 140px; min-width: 0; }
  .dtg-row label.wide { flex: 2 1 220px; }
  .dtg-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .dtg-chip { border: 2px solid transparent; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; min-height: 36px; padding: 4px 12px; }
  .dtg-chip[aria-pressed="true"] { border-color: var(--ink); }
  .dtg-foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
  .dtg-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  .dtg-tab { border: 1.5px solid var(--primary); color: var(--primary-dark); border-radius: 10px; padding: 8px 12px; font: inherit; font-weight: 700; background: var(--card); cursor: pointer; min-height: 44px; }
  .dtg-tab[aria-pressed="true"] { background: var(--primary); color: #fff; }
  .dtg-ph { min-width: 0; } .dtg-ph .page-head { margin: 0 0 8px; } .dtg-ph .page-head h1 { font-size: 18px; }
  .dtg-rv > summary { cursor: pointer; font-weight: 700; text-transform: none; letter-spacing: 0; }
  .dtg [hidden] { display: none !important; }
  @media (max-width: 640px) { .dtg-row label, .dtg-row label.wide { flex: 1 1 100%; } .dtg-tab { flex: 1 1 auto; } }
</style>`;

export async function render({ params }) {
  if (params.muc !== undefined && params.muc !== mucDone) { mucDone = params.muc; if (PROG[params.muc]) F.prog = params.muc; }
  const [D, B] = await Promise.all([rpc('app_dt_work_list'), rpc('app_dt_plan_board').catch(() => ({ can_board: false, rows: [] }))]);
  const board = !!B.can_board;
  const reload = async () => { const y = window.scrollY; await rerender(); window.scrollTo(0, y); };
  const P = board ? planUi(B, { keepOpen: (id) => OPEN.add(id), reload }) : null;
  const mine = board ? null : await rpc('app_dt_my_plan').catch(() => null);
  const hasMine = !!mine && ((mine.shifts || []).length > 0 || (mine.checks || []).length > 0);
  const BY = new Map((P ? P.rows : []).map((r) => [r.id, r]));
  const rows = sortRows((D.rows || []).map((t) => ({ ...t, n_todo: BY.has(t.id) ? P.nTodo(BY.get(t.id)) : 0 })));
  const tabOf = (id) => (BY.has(id) ? TAB.get(id) || 'phieu' : 'phieu');
  const loadBtn = html`<button type="button" class="btn sm secondary" data-phload>Mở phiếu ở đây</button>`;

  // phiếu đang nhúng: dựng luôn trong lần vẽ này để trang vẽ lại (sau khi lưu trong phiếu) vẫn còn phiếu và giữ chỗ cuộn
  let ph = null;
  if (PH != null && OPEN.has(PH) && tabOf(PH) === 'phieu' && rows.some((t) => t.id === PH)) {
    try { ph = await phieuRender({ params: { id: String(PH) } }); } catch (e) { ph = { html: html`<div class="alert error">${e.message}</div>` }; }
  } else PH = null;

  const card = (t) => {
    const r = BY.get(t.id); const tab = tabOf(t.id);
    const late = t.status !== 'hoan_thanh' && t.due && t.due < D.today;
    return html`<details class="card pcd-card dtg-card" data-id="${t.id}" ${OPEN.has(t.id) ? 'open' : ''}>
      <summary><div class="pcd-h"><b>${t.employee}</b><span class="pcd-meta">${t.branch || 'chưa chọn cơ sở'} · ${PROG[t.program] || t.program || ''} · Đạt ${t.achieved}/${t.total}${t.due ? ' · hạn ' + dm(t.due) : ''} · HD chính ${t.instructor || '—'}</span></div>
        <div class="pcd-bar"><i style="width:${Math.round((100 * t.achieved) / Math.max(1, t.total))}%"></i></div>
        <div class="pcd-sum"><span class="pill ${DT_STATUS[t.status]?.[1] || 'mute'}">${dtLabel(t)}</span>${late ? html`<span class="pill off">Quá hạn</span>` : ''}${r ? P.pills(r) : t.n_check ? html`<span class="pill warn">${t.n_check} chờ kiểm tra</span>` : ''}${t.my_followups ? html`<span class="pill info">Bạn phụ trách ${t.my_followups} mục bổ sung</span>` : ''}</div></summary>
      <div class="pcd-body">
        ${r ? html`${P.warnHtml(r)}<div class="dtg-tabs">${TABS.map(([k, l]) => html`<button type="button" class="dtg-tab" data-dtab="${k}" aria-pressed="${tab === k ? 'true' : 'false'}">${l}${k === 'kt' && P.nKt(r) ? ` (${P.nKt(r)})` : ''}</button>`)}</div>` : ''}
        <div data-dpane="phieu" ${tab === 'phieu' ? '' : 'hidden'}><div class="dtg-ph" data-ph="${t.id}">${ph && PH === t.id ? ph.html : loadBtn}</div></div>
        ${r ? html`<div data-dpane="ca" ${tab === 'ca' ? '' : 'hidden'}>${P.shiftsHtml(r)}</div><div data-dpane="kt" ${tab === 'kt' ? '' : 'hidden'}>${P.ktHtml(r)}</div>` : ''}
      </div></details>`;
  };
  const sel = (id, label, first, opts, cur) => html`<label>${label}<select class="input" id="${id}"><option value="">${first}</option>${opts.map(([v, l]) => html`<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`)}</select></label>`;
  const same = (xs) => xs.map((x) => [x, x]);

  return {
    title: 'Đào tạo',
    html: html`${PCD_CSS}${CSS}<div class="page-head"><div><h1>Đào tạo</h1><div class="sub">Bấm vào một người để mở phiếu, phân công theo ca và kiểm tra ngay tại đây</div></div><a class="btn secondary" href="#/viec">Việc của tôi</a></div>
      <div id="pcd" class="stack pcd dtg">
        ${D.accounts ? html`<details class="card dtg-rv"><summary>Người phụ trách chính: ${D.reviewer || 'chưa chọn'}</summary>
          <form id="dt-reviewer" class="stack" style="gap:8px;margin-top:10px">
            <label class="stack" style="gap:4px">Người phụ trách chính (giao hạng mục, đổi người hướng dẫn chính, xác nhận đạt, nhắc hạn, nhận xét cuối)
              <select class="input" name="reviewer" required><option value="">Chọn tài khoản</option>${D.accounts.map((a) => html`<option value="${a.id}" ${a.id === D.reviewer_id ? 'selected' : ''}>${a.name}</option>`)}</select></label>
            <div><button class="btn secondary">Lưu người phụ trách</button></div><div id="dt-reviewer-error" role="alert"></div>
          </form></details>` : D.reviewer ? html`<div class="sub">Người phụ trách chính: ${D.reviewer}</div>` : ''}
        ${P ? P.sumHtml() : ''}
        ${hasMine ? myPlanHtml(mine) : ''}
        <section class="card dtg-f" id="dtg-f" aria-label="Bộ lọc">
          <div class="dtg-row">
            <label class="wide">Tìm tên / mã<input type="search" class="input" id="dtg-q" placeholder="Gõ tên hoặc mã nhân viên" value="${F.q}"></label>
            ${sel('dtg-cs', 'Cơ sở', 'Tất cả cơ sở', same(optionsOf(rows, 'branch')), F.cs)}
            ${sel('dtg-prog', 'Chương trình', 'Chạy bàn + Pha chế', Object.entries(PROG), F.prog)}
            ${sel('dtg-hd', 'Người hướng dẫn chính', 'Tất cả', same(optionsOf(rows, 'instructor')), F.hd)}
          </div>
          <div class="dtg-chips"><strong style="font-size:13px">Trạng thái:</strong>${Object.entries(DT_STATUS).map(([k, [l, c]]) => html`<button type="button" class="pill ${c} dtg-chip" data-st="${k}" aria-pressed="false">${l}: <span data-n>0</span></button>`)}</div>
          <div class="dtg-foot"><span id="dtg-count" class="pcd-meta" role="status"></span><button type="button" class="btn sm secondary" id="dtg-clear">Bỏ lọc</button></div>
        </section>
        ${P ? P.fwSection() : ''}
        ${rows.map(card)}
        <div class="card" id="dtg-empty" hidden>${rows.length ? 'Không có ai khớp bộ lọc. Bấm "Bỏ lọc" để xem lại (người đã hoàn thành chỉ hiện khi bấm nút "Đã hoàn thành").' : 'Chưa có phiếu đào tạo nào.'}</div>
      </div>`,
    mount(root) {
      const byId = new Map(rows.map((t) => [t.id, t]));
      let phOff = null; let phSeq = 0;
      const offPh = () => { if (typeof phOff === 'function') { try { phOff(); } catch (_) { /* bỏ qua */ } } phOff = null; };
      const box = (id) => $(`.dtg-ph[data-ph="${id}"]`, root);
      if (ph && ph.mount && box(PH)) phOff = ph.mount(box(PH));

      const applyFilter = () => {
        let n = 0;
        $$('details.dtg-card', root).forEach((c) => { const show = matchRow(byId.get(Number(c.dataset.id)), F); c.hidden = !show; if (show) n += 1; });
        const cnt = chipCounts(rows, F);
        $$('.dtg-chip', root).forEach((b) => { b.querySelector('[data-n]').textContent = cnt[b.dataset.st] || 0; b.setAttribute('aria-pressed', F.st === b.dataset.st ? 'true' : 'false'); });
        $('#dtg-count', root).textContent = `Đang hiện ${n} / ${rows.length} người${F.st ? '' : ' (ẩn người đã hoàn thành)'}`;
        $('#dtg-empty', root).hidden = n > 0;
      };
      const readFilter = () => { F.q = $('#dtg-q', root).value; F.cs = $('#dtg-cs', root).value; F.prog = $('#dtg-prog', root).value; F.hd = $('#dtg-hd', root).value; applyFilter(); };

      // nạp phiếu vào thẻ, không vẽ lại cả trang
      const loadPhieu = async (id) => {
        offPh(); const seq = ++phSeq; PH = id;
        $$('.dtg-ph', root).forEach((el) => { if (Number(el.dataset.ph) !== id) el.innerHTML = str(loadBtn); });
        const b = box(id); if (!b) return;
        b.innerHTML = str(html`<div class="pcd-meta">Đang tải phiếu…</div>`);
        let p;
        try { p = await phieuRender({ params: { id: String(id) } }); } catch (e) { p = { html: html`<div class="alert error">${e.message}</div>` }; }
        if (seq !== phSeq || !b.isConnected) return;
        b.innerHTML = str(p.html);
        if (p.mount) phOff = p.mount(b);
      };

      const onToggle = (e) => {
        const c = e.target.closest?.('details.dtg-card'); if (!c || e.target !== c) return;
        const id = Number(c.dataset.id);
        if (c.open) OPEN.add(id); else OPEN.delete(id);   // chỉ ghi nhớ; KHÔNG nạp phiếu ở đây — trình duyệt cũng bắn toggle cho thẻ mở sẵn khi trang vẽ lại
      };
      const onInput = (e) => { if (e.target.id === 'dtg-q') readFilter(); };
      const onChange = (e) => {
        if (['dtg-cs', 'dtg-prog', 'dtg-hd'].includes(e.target.id)) { readFilter(); return; }
        if (P) P.handleChange(e, root);
      };
      const onClick = (e) => {
        const t = e.target;
        const chip = t.closest('.dtg-chip'); if (chip) { F.st = F.st === chip.dataset.st ? '' : chip.dataset.st; applyFilter(); return; }
        if (t.closest('#dtg-clear')) { Object.assign(F, { q: '', cs: '', prog: '', hd: '', st: '' }); ['dtg-q', 'dtg-cs', 'dtg-prog', 'dtg-hd'].forEach((i) => { $('#' + i, root).value = ''; }); applyFilter(); return; }
        const sm = t.closest('details.dtg-card > summary');   // người dùng bấm mở thẻ → nạp phiếu của người đó (sau khi thẻ đổi trạng thái)
        if (sm) { const c = sm.parentElement; const id = Number(c.dataset.id); setTimeout(() => { if (c.isConnected && c.open && tabOf(id) === 'phieu' && PH !== id) loadPhieu(id); }, 0); return; }
        const tb = t.closest('[data-dtab]');
        if (tb) { const c = tb.closest('details.dtg-card'); const id = Number(c.dataset.id); const k = tb.dataset.dtab; TAB.set(id, k);
          $$('[data-dtab]', c).forEach((b) => b.setAttribute('aria-pressed', b === tb ? 'true' : 'false'));
          $$('[data-dpane]', c).forEach((p) => { p.hidden = p.dataset.dpane !== k; });
          if (k === 'phieu' && PH !== id) loadPhieu(id);
          return; }
        const lb = t.closest('[data-phload]'); if (lb) { loadPhieu(Number(lb.closest('.dtg-ph').dataset.ph)); return; }
        if (t.closest('.dtg-ph')) return;   // bấm trong phiếu nhúng: phiếu tự xử lý
        if (P) P.handleClick(e);
      };
      const form = $('#dt-reviewer', root);
      const onSubmit = async (e) => {
        if (e.target !== form) return;
        e.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
        try { await rpc('app_dt_reviewer_save', { p_account: Number(form.elements.reviewer.value) }); flash('Đã lưu người phụ trách đào tạo.'); reload(); }
        catch (error) { $('#dt-reviewer-error', form).textContent = error.message; button.disabled = false; }
      };
      root.addEventListener('toggle', onToggle, true); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
      root.addEventListener('click', onClick); root.addEventListener('submit', onSubmit);
      const offMine = hasMine ? mountMyPlan(root, mine, reload) : null;
      applyFilter();
      return () => {   // #root dùng chung mọi trang → gỡ khi rời trang
        root.removeEventListener('toggle', onToggle, true); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange);
        root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit);
        offPh(); if (typeof offMine === 'function') offMine();
      };
    },
  };
}
