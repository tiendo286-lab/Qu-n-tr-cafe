// Đánh giá nhân viên (quản lý): bảng điểm tháng từng người, giải trình chờ xem, trừ điểm bất cứ lúc nào; Chủ mở lại tháng đã khóa và sửa tên tiêu chí
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy } from '../tien.js';
import { $, $$, flash, go, html, norm, showSaved } from '../ui.js';
import { DG_CSS, fillPhotos, markCard, monthLabel, openEmployee, rating } from '../danh_gia.js';

export const perm = 'doi_soat';

export async function render({ params }) {
  const month = /^\d{4}-\d{2}$/.test(params.thang || '') ? params.thang : '';
  const br = params.cn ? Number(params.cn) : null;
  const D = await rpc('app_dg_board', { p_month: month || null, p_branch: br });
  const setName = Object.fromEntries(D.sets.map((s) => [s.code, s.name]));
  const q = params.q || '';
  const emps = D.employees.filter((e) => !q || norm(`${e.code} ${e.name}`).includes(norm(q)));
  const nav = (p) => go('/quan-ly/danh-gia?' + new URLSearchParams(Object.entries({ thang: D.month, cn: br || '', q, ...p }).filter(([, v]) => v !== '' && v !== null)).toString());
  const counts = RATING_COUNT(D.employees);
  const lock = D.open
    ? html`<div class="alert ${D.reopened ? 'warn' : 'info'}">${D.reopened ? html`Chủ đã <strong>mở lại</strong> tháng ${monthLabel(D.month)} để đánh giá tiếp.` : html`Tháng ${monthLabel(D.month)} còn sửa được tới hết <strong>${dmy(D.deadline)}</strong>, sau đó tự khóa.`}
        ${D.is_owner && D.reopened ? html` <button type="button" class="btn sm secondary" id="dg-lock">Khóa lại tháng này</button>` : ''}</div>`
    : html`<div class="alert warn">Tháng ${monthLabel(D.month)} <strong>đã khóa</strong> (quá ngày ${dmy(D.deadline)}). ${D.is_owner ? html`<button type="button" class="btn sm" id="dg-open">Mở lại cho quản lý đánh giá tiếp</button>` : 'Cần sửa thì nhờ Chủ mở lại.'}</div>`;
  const unset = D.employees.filter((e) => e.status === 'Đang làm' && !e.set_saved);
  const guessable = unset.filter((e) => e.set_code);
  const setSel = (e) => html`<select class="input sm dg-set ${e.set_saved ? '' : 'unset'}" data-emp="${e.id}" aria-label="Bộ tiêu chí của ${e.name}">
      ${e.set_saved ? '' : html`<option value="" selected>Chưa chọn bộ${e.set_code ? ` (gợi ý: ${setName[e.set_code]})` : ''}</option>`}
      ${D.sets.map((s) => html`<option value="${s.code}" ${e.set_saved && s.code === e.set_code ? 'selected' : ''}>${s.name}</option>`)}</select>`;
  const row = (e) => { const r = rating(e.score); return html`<div class="dg-row ${e.set_saved ? '' : 'no-set'}" data-emp="${e.id}">
      <button type="button" class="dg-rb" data-emp="${e.id}">
      <span class="dg-who"><strong>${e.code} – ${e.name}</strong><span class="st-meta">${e.rank || ''}${e.status !== 'Đang làm' ? ' · ' + e.status : ''}</span></span>
      <span class="dg-cnt st-meta">${e.n_tru ? `${e.n_tru} lần trừ` : ''}${e.n_tru && e.n_nhac ? ' · ' : ''}${e.n_nhac ? `${e.n_nhac} nhắc nhở` : ''}${e.pending ? html` <span class="pill warn">${e.pending} giải trình</span>` : ''}</span>
      <span class="dg-pt"><strong>${e.score}</strong><span class="pill ${r[2]}">${r[1]}</span></span></button>${setSel(e)}</div>`; };
  return {
    title: 'Đánh giá nhân viên',
    html: html`${DG_CSS}${STYLE}
      <div class="page-head"><div><h1>Đánh giá nhân viên</h1><div class="sub">Mỗi nhân viên chọn một bộ tiêu chí: Pha chế hoặc Chạy bàn. Đầu tháng mỗi người 100 điểm (20 tiêu chí × 5). Phạm lỗi thì trừ 1–5 điểm vào đúng tiêu chí hoặc nhắc nhở; nhân viên được báo và gửi giải trình được.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:960px;gap:12px">
        <div class="toolbar" style="gap:8px;flex-wrap:wrap">
          <label class="field" style="margin:0"><span>Tháng</span><input class="input" type="month" id="dg-m" value="${D.month}"></label>
          <label class="field" style="margin:0"><span>Cơ sở</span><select class="input" id="dg-br"><option value="">Tất cả</option>${D.branches.map((b) => html`<option value="${b.id}" ${br === b.id ? 'selected' : ''}>${b.code} – ${b.name}</option>`)}</select></label>
          <label class="field" style="margin:0;flex:1 1 180px"><span>Tìm nhân viên</span><input class="input" id="dg-q" value="${q}" placeholder="Mã hoặc tên" autocomplete="off"></label>
        </div>
        ${lock}
        <div class="dg-kpi">${counts.map(([l, n, c]) => html`<div class="card"><div class="st-meta">${l}</div><strong class="${c}">${n}</strong></div>`)}</div>
        ${D.pending.length ? html`<section class="card stack" style="gap:8px"><h2 style="margin:0">Giải trình chờ xem (${D.pending.length})</h2>
          ${D.pending.map((m) => html`<div class="stack" style="gap:4px" data-emp="${m.employee_id}"><div class="st-meta"><button type="button" class="dg-link dg-who-l" data-emp="${m.employee_id}">${m.employee}</button></div>${markCard(m, { acts: true })}</div>`)}</section>` : ''}
        <section class="card stack" style="gap:6px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline"><h2 style="margin:0">Bảng điểm tháng ${monthLabel(D.month)}</h2><span class="st-meta">${emps.length} nhân viên · bấm vào tên để trừ điểm / xem lịch sử · ô bên phải: bộ tiêu chí của người đó</span></div>
          ${unset.length ? html`<div class="alert warn" id="dg-unset">Còn <strong>${unset.length}</strong> nhân viên đang làm chưa chọn bộ tiêu chí (Pha chế hoặc Chạy bàn). Mỗi người chỉ một bộ, giữ cố định tới khi quản lý đổi.
            <div class="toolbar" style="margin-top:6px;gap:8px;flex-wrap:wrap"><label style="display:inline-flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" class="check" id="dg-only-unset"> Chỉ hiện người chưa chọn</label>
            ${guessable.length ? html`<button type="button" class="btn sm secondary" id="dg-guess">Chọn theo gợi ý cho ${guessable.length} người</button>` : ''}</div></div>` : ''}
          ${emps.length ? emps.map(row) : html`<div class="st-meta">Không có nhân viên phù hợp.</div>`}</section>
        ${D.is_owner ? html`<details class="card"><summary style="cursor:pointer;font-weight:700">Cài đặt tiêu chí (chỉ Chủ)</summary>
          <div class="st-meta" style="margin:6px 0">Sửa tên tiêu chí rồi bấm ra ngoài ô là lưu. Đổi tên không làm thay đổi các lần đánh giá đã ghi.</div>
          ${D.sets.map((s) => html`<div class="pc-sub" style="margin-top:10px">${s.name.toUpperCase()}</div>
            <div class="dg-crit">${D.criteria.filter((c) => c.set_code === s.code).map((c, i) => html`<label><span class="st-meta">${i + 1}.</span><input class="input sm dg-cn" data-code="${c.code}" value="${c.name}" maxlength="200"></label>`)}</div>`)}
        </details>` : ''}
      </div>`,
    async mount(root) {
      $('#dg-m').addEventListener('change', (ev) => { if (ev.target.value) nav({ thang: ev.target.value }); });
      $('#dg-br').addEventListener('change', (ev) => nav({ cn: ev.target.value }));
      let t; $('#dg-q').addEventListener('input', (ev) => { clearTimeout(t); t = setTimeout(() => nav({ q: ev.target.value.trim() }), 500); });
      const open = (id) => openEmployee(id, { month: D.month, branch: br, onChange: () => rerender() });
      $$('.dg-row').forEach((b) => b.addEventListener('click', (ev) => { if (!ev.target.closest('.dg-set')) open(Number(b.dataset.emp)); }));
      $$('.dg-set').forEach((s) => s.addEventListener('change', async () => {
        if (!s.value) return;
        try {
          await rpc('app_dg_set', { p_employee: Number(s.dataset.emp), p_set: s.value });
          s.classList.remove('unset'); s.closest('.dg-row').classList.remove('no-set'); s.querySelector('option[value=""]')?.remove();
          showSaved(`Đã chọn bộ ${setName[s.value]}`);
        } catch (e) { showSaved(e.message, true); }
      }));
      $('#dg-only-unset')?.addEventListener('change', (ev) => { $$('.dg-row').forEach((r) => { r.hidden = ev.target.checked && !r.classList.contains('no-set'); }); });
      $('#dg-guess')?.addEventListener('click', async (ev) => {
        if (!confirm(`Chọn bộ tiêu chí theo vị trí (gợi ý) cho ${guessable.length} người chưa chọn? Sau này vẫn đổi được từng người.`)) return;
        ev.target.disabled = true;
        try { for (const e of guessable) await rpc('app_dg_set', { p_employee: e.id, p_set: e.set_code }); flash(`Đã chọn bộ tiêu chí cho ${guessable.length} người.`); rerender(); }
        catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
      });
      $$('.dg-who-l').forEach((a) => a.addEventListener('click', () => open(Number(a.dataset.emp))));
      $$('.dg-mk').forEach((c) => c.addEventListener('click', async (ev) => {
        const id = Number(c.dataset.id); const t2 = ev.target;
        try {
          if (t2.closest('.dg-keep')) { const n = prompt('Giữ nguyên điểm. Ghi chú cho nhân viên (không bắt buộc):', ''); if (n === null) return; await rpc('app_dg_resolve', { p_id: id, p_keep: true, p_note: n }); }
          else if (t2.closest('.dg-refund')) { const n = prompt('Hoàn lại điểm. Ghi chú (không bắt buộc):', ''); if (n === null) return; await rpc('app_dg_resolve', { p_id: id, p_keep: false, p_note: n }); }
          else if (t2.closest('.dg-edit') || t2.closest('.dg-del')) { open(Number(c.closest('[data-emp]').dataset.emp)); return; }
          else return;
          flash('Đã lưu. Nhân viên đã được báo.'); rerender();
        } catch (e) { showSaved(e.message, true); }
      }));
      $('#dg-open')?.addEventListener('click', async () => { try { await rpc('app_dg_month_open', { p_month: D.month, p_open: true }); flash(`Đã mở lại tháng ${monthLabel(D.month)}.`); rerender(); } catch (e) { showSaved(e.message, true); } });
      $('#dg-lock')?.addEventListener('click', async () => { try { await rpc('app_dg_month_open', { p_month: D.month, p_open: false }); flash(`Đã khóa lại tháng ${monthLabel(D.month)}.`); rerender(); } catch (e) { showSaved(e.message, true); } });
      $$('.dg-cn').forEach((inp) => { const was = inp.value; inp.addEventListener('change', async () => {
        try { await rpc('app_dg_rename', { p_code: inp.dataset.code, p_name: inp.value }); showSaved('Đã lưu tên tiêu chí'); } catch (e) { inp.value = was; showSaved(e.message, true); }
      }); });
      if (params.nv) open(Number(params.nv));
      fillPhotos(root);
    },
  };
}

function RATING_COUNT(emps) {
  const act = emps.filter((e) => e.status === 'Đang làm' || e.n_tru || e.n_nhac);
  const by = (l) => act.filter((e) => rating(e.score)[1] === l).length;
  return [['Xuất sắc', by('Xuất sắc'), 'ok'], ['Tốt', by('Tốt'), ''], ['Khá', by('Khá'), ''], ['Trung bình', by('Trung bình'), 'warn'], ['Yếu', by('Yếu'), 'bad'],
    ['Có giải trình', emps.reduce((s, e) => s + Number(e.pending || 0), 0), 'warn']];
}

const STYLE = html`<style>
  .dg-kpi { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .dg-kpi .card { padding: 10px 12px; } .dg-kpi strong { font-size: 20px; } .dg-kpi .bad { color: #b91c1c; } .dg-kpi .warn { color: #b45309; } .dg-kpi .ok { color: #15803d; }
  .dg-row { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 6px 12px; align-items: center; padding: 6px 8px; border-top: 1px solid var(--line-soft); cursor: pointer; }
  .dg-row:hover { background: var(--line-soft); } .dg-row[hidden] { display: none; }
  .dg-rb { all: unset; box-sizing: border-box; cursor: pointer; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 4px 12px; align-items: center; padding: 4px 0; }
  .dg-rb:focus-visible { outline: 2px solid var(--primary); }
  .dg-set { width: 100%; } .dg-set.unset { border-color: #d97706; color: #b45309; }
  .dg-who { display: flex; flex-direction: column; min-width: 0; } .dg-who strong { overflow-wrap: anywhere; }
  .dg-pt { display: flex; gap: 6px; align-items: center; white-space: nowrap; } .dg-pt strong { font-size: 18px; min-width: 32px; text-align: right; }
  @media (max-width: 640px) { .dg-row { grid-template-columns: minmax(0, 1fr); } .dg-rb { grid-template-columns: minmax(0, 1fr) auto; } .dg-cnt { grid-column: 1 / -1; grid-row: 2; } .dg-set { width: auto; max-width: 100%; justify-self: start; } }
  .dg-crit { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px 12px; }
  .dg-crit label { display: flex; gap: 6px; align-items: center; } .dg-crit input { flex: 1 1 auto; min-width: 0; }
  .dg-link { all: unset; cursor: pointer; color: var(--primary); font-weight: 600; font-size: 14px; }
  .pc-sub { font-size: 12px; font-weight: 700; letter-spacing: .03em; color: var(--ink-2); }
</style>`;
