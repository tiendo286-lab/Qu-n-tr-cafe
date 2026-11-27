// Công việc › Đào tạo. Bước 170 (anh Tiến giao 19/11/2026): 3 tab Phiếu | Phân công (số chưa giao) | Chờ kiểm tra (số chờ).
//  * Ai thấy 2 tab mới: Chủ + người phụ trách chính (mọi phiếu mở), HD chính (phiếu của mình). Người khác chỉ thấy Phiếu.
//  * Phân công: theo phiếu (khối thu gọn) → hạng mục CHƯA ĐẠT theo Ngày 1…8; tích / "Chọn cả ngày" → thanh "Đã chọn N" → người, cơ sở, ghi chú → lưu 1 lần.
//    Gợi ý người / cơ sở theo lịch đã công bố (máy chủ tính, app_dt_assign_board). Giao hàng loạt dùng chung kiểm tra quyền (app_dt_assign_bulk).
//  * Chờ kiểm tra: gom theo phiếu, mỗi dòng Xác nhận đạt · đổi mức rồi xác nhận · Giao giai đoạn 2. KHÔNG có xác nhận hàng loạt.
import { render as rerender } from '../app.js';
import { catalog } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, flash, html, once, showSaved } from '../ui.js';
import { DT_STATUS, dtLabel } from './dao_tao.js?v=2026.11.27.5';
import { openItemGuide } from './dt_cong_viec.js';

const PROGRAMS = [['chay_ban', 'Chạy bàn'], ['pha_che', 'Pha chế']];
const TABS = [['phieu', 'Phiếu'], ['phan-cong', 'Phân công'], ['kiem-tra', 'Chờ kiểm tra']];
const STATE = { chua_giao: ['Chưa giao', 'mute'], dang_giao: ['Đang giao Cấp 1', 'info'], cho_kt: ['Chờ kiểm tra', 'warn'] };
const LEVEL = { tb: 'Trung bình', kha: 'Khá', tot: 'Tốt' };
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const F = { st: '', who: '' };   // bộ lọc tab Phân công (giữ khi vẽ lại)
const OPEN = new Set();          // khối phiếu đang mở
const dm = (d) => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;
const wd = (d) => DOW[new Date(String(d).slice(0, 10) + 'T00:00:00Z').getUTCDay()];
const schedLine = (r) => (r.sched?.length ? r.sched.slice(0, 4).map((s) => `${wd(s.date)} ${dm(s.date)} · ${s.branch || '—'} · ${s.shift}`).join(' | ') + (r.sched.length > 4 ? ` | +${r.sched.length - 4} ca` : '') : 'Chưa xếp lịch');
const stateWho = (it) => (it.state === 'dang_giao' && it.who_rank !== 'Cấp 1' ? `Đang giao ${it.who || ''}` : STATE[it.state][0]);

export async function render({ params }) {
  const program = params.muc === 'pha_che' ? 'pha_che' : 'chay_ban';
  const [D, B, cat] = await Promise.all([rpc('app_dt_work_list'), rpc('app_dt_assign_board', { p_program: program }).catch(() => ({ can_board: false, rows: [] })), catalog().catch(() => ({ activeBranches: [] }))]);
  const board = !!B.can_board;
  const tab = board && ['phan-cong', 'kiem-tra'].includes(params.tab) ? params.tab : 'phieu';
  const rows = B.rows || [];
  const nChua = rows.reduce((t, r) => t + Number(r.n_chua || 0), 0); const nKt = rows.reduce((t, r) => t + Number(r.n_kt || 0), 0);
  const brs = (cat.activeBranches || []).map((b) => ({ id: b.id, code: b.display_code || b.code }));
  const href = (o) => '#/cong-viec/dao-tao?' + new URLSearchParams(Object.entries({ muc: program, tab, ...o }).filter(([, v]) => v && v !== 'phieu')).toString();
  const cards = D.rows.filter((t) => t.program === program).map((t) => {
    const late = t.status !== 'hoan_thanh' && t.due < D.today;
    return html`<a class="card stack" style="color:inherit;text-decoration:none;gap:6px" href="#/dao-tao/phieu?id=${t.id}">
      <strong>${t.employee}</strong>
      <div class="toolbar"><span class="pill ${DT_STATUS[t.status][1]}">${dtLabel(t)}</span>
        ${late ? html`<span class="pill off">Quá hạn</span>` : ''}${t.n_check ? html`<span class="pill warn">${t.n_check} chờ kiểm tra</span>` : ''}</div>
      <div class="sub">${t.achieved}/${t.total} hạng mục · Hạn ${dmy(t.due)}</div>
      ${t.instructor ? html`<div>Hướng dẫn: ${t.instructor}</div>` : ''}
      ${t.my_followups ? html`<div>Bạn phụ trách ${t.my_followups} hạng mục bổ sung</div>` : ''}
    </a>`;
  });

  // ---- tab Phân công
  const whoNames = [...new Set(rows.flatMap((r) => (r.items || []).filter((i) => i.state !== 'cho_kt').map((i) => i.who).filter(Boolean)))].sort();
  const itemOk = (i) => (!F.st || i.state === F.st) && (!F.who || i.who === F.who);
  const personSel = (r) => { const bc = brs.find((b) => b.id === r.best_branch)?.code || '';
    return html`<select class="input sm dtb-who" aria-label="Người hướng dẫn"><option value="">— Chọn người —</option>
      ${r.same?.length ? html`<optgroup label="Cùng ca">${r.same.map((p) => html`<option value="${p.id}">${p.name} — trùng ${p.n} ca</option>`)}</optgroup>` : ''}
      ${r.br_c1?.length ? html`<optgroup label="Cấp 1 cơ sở ${bc}">${r.br_c1.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</optgroup>` : ''}
      ${r.other?.length ? html`<optgroup label="Khác">${r.other.map((p) => html`<option value="${p.id}">${p.name}${p.hdc ? ' (HD chính)' : ''}</option>`)}</optgroup>` : ''}</select>`; };
  const boardCard = (r) => {
    const its = (r.items || []).filter(itemOk);
    const days = [...new Set(its.map((i) => i.day))].sort((a, b) => a - b);
    return html`<details class="card dtb" data-id="${r.id}" ${OPEN.has(r.id) ? 'open' : ''}>
      <summary><div class="dtb-h"><b>${r.employee}</b> <span class="st-meta">· ${r.branch || 'chưa chọn cơ sở'} · HD chính ${r.instructor || '—'} · ${r.achieved}/${r.total} · hạn ${dm(r.due)}</span>
        <span class="dtb-n">${r.n_chua ? html`<span class="pill mute">${r.n_chua} chưa giao</span>` : ''}${r.n_kt ? html`<span class="pill warn">${r.n_kt} chờ kiểm tra</span>` : ''}</span></div>
        <div class="st-meta dtb-sched">📅 ${schedLine(r)}</div></summary>
      ${its.length ? days.map((d) => html`<div class="dtb-day"><label class="dtb-dh"><input type="checkbox" class="check" data-allday="${d}"> <b>Ngày ${d}</b> <span class="st-meta">· Chọn cả ngày</span></label>
          ${its.filter((i) => i.day === d).map((i) => html`<label class="dtb-it ${i.state === 'cho_kt' ? 'kt' : ''}" data-no="${i.no}" data-day="${d}"><input type="checkbox" class="check" data-no="${i.no}" ${i.state === 'cho_kt' ? 'disabled' : ''}>
            <span class="dtb-t"><b>${i.no}.</b> ${i.title}${i.phase2 ? html` <span class="pill warn">giai đoạn 2</span>` : ''}<br><span class="st-meta">${i.who || 'HD chính'} · ${i.branch || '—'}</span></span>
            <span class="pill ${STATE[i.state][1]}">${stateWho(i)}</span></label>`)}</div>`)
        : html`<div class="st-meta" style="padding:8px 0">${(r.items || []).length ? 'Không có hạng mục khớp bộ lọc.' : 'Đã đạt hết hạng mục.'}</div>`}
      <div class="dtb-bar" hidden><b>Đã chọn <span class="dtb-cnt">0</span></b>${personSel(r)}
        <select class="input sm dtb-br" aria-label="Cơ sở đào tạo"><option value="">Theo phiếu${r.branch ? ' · ' + r.branch : ''}</option>${brs.map((b) => html`<option value="${b.id}" ${b.id === r.best_branch ? 'selected' : ''}>${b.code}</option>`)}</select>
        <input class="input sm dtb-note" placeholder="Ghi chú (không bắt buộc)" aria-label="Ghi chú">
        <span class="dtb-btns"><button type="button" class="btn sm dtb-go">Giao</button><button type="button" class="btn sm secondary dtb-back">Trả về HD chính</button></span></div>
    </details>`; };
  const pcBody = html`<section class="card dtb-flt"><label class="pc-f"><span>Trạng thái</span><select class="input sm" id="dtb-st"><option value="">Tất cả</option>${Object.entries(STATE).map(([k, [l]]) => html`<option value="${k}" ${F.st === k ? 'selected' : ''}>${l}</option>`)}</select></label>
      <label class="pc-f"><span>Người hướng dẫn</span><select class="input sm" id="dtb-whof"><option value="">Tất cả</option>${whoNames.map((w) => html`<option value="${w}" ${F.who === w ? 'selected' : ''}>${w}</option>`)}</select></label>
      <span class="st-meta">Gợi ý người / cơ sở theo lịch đã công bố (ngày bắt đầu → hạn 12 ngày). Gợi ý chỉ sắp xếp, không đổi quyền.</span></section>
    ${rows.length ? rows.map(boardCard) : html`<div class="card">Không có phiếu đang mở.</div>`}`;

  // ---- tab Chờ kiểm tra
  const ktRows = rows.filter((r) => Number(r.n_kt) > 0);
  const ktBody = ktRows.length ? ktRows.map((r) => html`<section class="card stack dtk" data-id="${r.id}" style="gap:6px"><div><b>${r.employee}</b> <span class="st-meta">· HD chính ${r.instructor || '—'} · ${r.achieved}/${r.total}</span> <a class="btn sm secondary" href="#/dao-tao/phieu?id=${r.id}">Mở phiếu ›</a></div>
      ${(r.items || []).filter((i) => i.state === 'cho_kt').map((i) => html`<div class="dtk-row" data-no="${i.no}"><span class="dtk-t"><b>${i.no}.</b> ${i.title}<br><span class="st-meta">${i.pending_by || ''} ghi mức <b>${LEVEL[i.level] || i.level}</b>${i.pending_at ? ' · ' + dt(i.pending_at) : ''}</span></span>
        ${r.can_check ? html`<span class="dtk-act"><select class="input sm dtk-lv" aria-label="Mức hạng mục ${i.no}">${Object.entries(LEVEL).map(([k, l]) => html`<option value="${k}" ${i.level === k ? 'selected' : ''}>${l}</option>`)}</select>
          <button type="button" class="btn sm dtk-ok">Xác nhận đạt</button><button type="button" class="btn sm secondary dtk-p2" ${i.level === 'tot' ? 'hidden' : ''}>Giao giai đoạn 2</button></span>` : html`<span class="st-meta">Chờ HD chính / người phụ trách chính xác nhận</span>`}</div>`)}</section>`)
    : html`<div class="card">Không có hạng mục nào chờ kiểm tra. 👍</div>`;

  return {
    title: 'Công việc đào tạo',
    html: html`${CSS}<div class="page-head"><h1>Công việc đào tạo</h1><a class="btn secondary" href="#/viec">Việc của tôi</a></div>
      <div id="dt-work" class="stack" style="max-width:${tab === 'phieu' ? 760 : 960}px;gap:12px">
        <nav class="toolbar" aria-label="Mục đào tạo">
          ${PROGRAMS.map(([key, label]) => html`<a class="btn ${program === key ? '' : 'secondary'}"
            href="${'#/cong-viec/dao-tao?' + new URLSearchParams(Object.entries({ muc: key, tab: tab === 'phieu' ? '' : tab }).filter(([, v]) => v)).toString()}" aria-current="${program === key ? 'page' : 'false'}">${label}</a>`)}
        </nav>
        ${board ? html`<nav class="dt-tabs" aria-label="Tab đào tạo">${TABS.map(([k, l]) => html`<a class="${tab === k ? 'on' : ''}" href="${href({ tab: k })}" data-dttab="${k}">${l}${k === 'phan-cong' && nChua ? html` <span class="badge">${nChua}</span>` : ''}${k === 'kiem-tra' && nKt ? html` <span class="badge">${nKt}</span>` : ''}</a>`)}</nav>` : ''}
        ${tab === 'phieu' ? html`
        ${D.accounts ? html`<form id="dt-reviewer" class="card stack" style="gap:8px">
          <label class="stack" style="gap:4px">Người phụ trách chính đào tạo (giao hạng mục, đổi người hướng dẫn chính, xác nhận đạt, nhắc hạn, nhận xét cuối)
            <select class="input" name="reviewer" required>
              <option value="">Chọn tài khoản</option>
              ${D.accounts.map((a) => html`<option value="${a.id}" ${a.id === D.reviewer_id ? 'selected' : ''}>${a.name}</option>`)}
            </select>
          </label><div><button class="btn secondary">Lưu người phụ trách</button></div>
          <div id="dt-reviewer-error" role="alert"></div>
        </form>` : ''}
        ${D.reviewer ? html`<div class="sub">Người phụ trách chính: ${D.reviewer}</div>` : ''}
        ${cards.length ? cards : html`<div class="card">${program === 'pha_che' ? 'Chưa có phiếu đào tạo Pha chế.' : 'Chưa có phiếu đào tạo Chạy bàn.'}</div>`}` : tab === 'phan-cong' ? pcBody : ktBody}
      </div>`,
    mount(root) {
      const form = $('#dt-reviewer', root);
      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button');
        button.disabled = true;
        try {
          await rpc('app_dt_reviewer_save', { p_account: Number(form.elements.reviewer.value) });
          flash('Đã lưu người phụ trách đào tạo.');
          rerender();
        } catch (error) {
          $('#dt-reviewer-error', form).textContent = error.message;
          button.disabled = false;
        }
      });
      // ---- Phân công
      $('#dtb-st', root)?.addEventListener('change', (e) => { F.st = e.target.value; rerender(); });
      $('#dtb-whof', root)?.addEventListener('change', (e) => { F.who = e.target.value; rerender(); });
      $$('details.dtb', root).forEach((card) => {
        const id = Number(card.dataset.id);
        card.addEventListener('toggle', () => { if (card.open) OPEN.add(id); else OPEN.delete(id); });
        const bar = card.querySelector('.dtb-bar');
        const picked = () => $$('.dtb-it input[data-no]:checked', card).map((x) => Number(x.dataset.no));
        const sync = () => { const n = picked().length; bar.hidden = !n; card.querySelector('.dtb-cnt').textContent = n;
          $$('[data-allday]', card).forEach((a) => { const xs = $$(`.dtb-it[data-day="${a.dataset.allday}"] input:not(:disabled)`, card); a.checked = xs.length > 0 && xs.every((x) => x.checked); }); };
        card.addEventListener('change', (e) => {
          const a = e.target.closest('[data-allday]');
          if (a) $$(`.dtb-it[data-day="${a.dataset.allday}"] input:not(:disabled)`, card).forEach((x) => { x.checked = a.checked; });
          sync();
        });
        const save = async (btn, person) => {
          const items = picked(); if (!items.length) return;
          if (person === undefined) { const v = card.querySelector('.dtb-who').value; if (!v) { showSaved('Chọn người được giao.', true); return; } person = Number(v); }
          btn.disabled = true;
          try {
            const r = await rpc('app_dt_assign_bulk', { p_id: id, p_items: items, p_employee: person, p_branch: person ? Number(card.querySelector('.dtb-br').value) || null : null, p_note: card.querySelector('.dtb-note').value.trim() || null });
            OPEN.add(id); flash(person ? `Đã giao ${r.n} hạng mục.` : `Đã trả ${r.n} hạng mục về HD chính.`); rerender();
          } catch (e) { btn.disabled = false; showSaved(e.message, true); }
        };
        card.querySelector('.dtb-go').addEventListener('click', (e) => save(e.currentTarget));
        card.querySelector('.dtb-back').addEventListener('click', (e) => save(e.currentTarget, null));
      });
      // ---- Chờ kiểm tra (từng dòng, không có xác nhận hàng loạt)
      $$('.dtk-row', root).forEach((row) => {
        const id = Number(row.closest('.dtk').dataset.id); const no = Number(row.dataset.no);
        const lv = row.querySelector('.dtk-lv'); const p2 = row.querySelector('.dtk-p2');
        lv?.addEventListener('change', () => { if (p2) p2.hidden = lv.value === 'tot'; });
        row.querySelector('.dtk-ok')?.addEventListener('click', once(async () => {
          try { await rpc('app_dt_check_ok', { p_id: id, p_no: no, p_level: lv.value }); flash('Đã xác nhận đạt.'); rerender(); } catch (e) { showSaved(e.message, true); }
        }));
        p2?.addEventListener('click', async () => {
          // Giao giai đoạn 2 = xác nhận mức hiện tại (Trung bình / Khá) rồi giao người luyện thêm
          const r = rows.find((x) => x.id === id); const it = (r.items || []).find((x) => x.no === no);
          try { await rpc('app_dt_check_ok', { p_id: id, p_no: no, p_level: lv.value }); } catch (e) { showSaved(e.message, true); return; }
          const T = { id, instructor: r.instructor, instructor_id: r.instructor_id, branch: r.branch, item_branches: brs,
            helpers: [...(r.same || []), ...(r.br_c1 || []), ...(r.other || [])].map((p) => ({ id: p.id, name: p.name })) };
          openItemGuide(T, it, null, () => rerender(), true);
        });
      });
    },
  };
}

const CSS = html`<style>
  .dt-tabs { display: flex; gap: 6px; flex-wrap: wrap; } .dt-tabs a { border: 1.5px solid var(--primary); color: var(--primary); border-radius: 10px; padding: 6px 12px; font-weight: 700; text-decoration: none; background: var(--card); }
  .dt-tabs a.on { background: var(--primary); color: #fff; }
  .dtb-flt { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; } .dtb-flt select { width: auto; min-width: 140px; }
  .dtb summary { cursor: pointer; list-style: none; } .dtb summary::-webkit-details-marker { display: none; }
  .dtb-h { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; overflow-wrap: anywhere; } .dtb-n { display: inline-flex; gap: 4px; margin-left: auto; }
  .dtb-sched { margin-top: 4px; overflow-wrap: anywhere; }
  .dtb-day { border-top: 1px solid var(--line); padding: 6px 0; } .dtb-dh { display: flex; align-items: center; gap: 6px; padding: 4px 0; }
  .dtb-it { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px; } .dtb-it:hover { background: var(--subtle); } .dtb-it.kt { opacity: .8; }
  .dtb-it .check, .dtb-dh .check { width: 20px; height: 20px; flex: 0 0 auto; } .dtb-t { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
  .dtb-bar { position: sticky; bottom: 0; z-index: 4; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 10px; margin-top: 6px; background: var(--card); border-top: 2px solid var(--primary); box-shadow: 0 -6px 14px rgba(0,0,0,.08); }
  .dtb-bar select, .dtb-bar input { width: auto; min-width: 0; flex: 1 1 150px; } .dtb-btns { display: inline-flex; gap: 6px; } .dtb-btns .btn { width: auto; }
  .dtk-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-top: 1px solid var(--line); padding: 8px 0; } .dtk-t { flex: 1 1 260px; min-width: 0; overflow-wrap: anywhere; }
  .dtk-act { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: center; } .dtk-act .btn, .dtk-act select { width: auto; }
  @media (max-width: 600px) { .dtb-n { margin-left: 0; } .dtb-bar select, .dtb-bar input { flex: 1 1 100%; } }
</style>`;
