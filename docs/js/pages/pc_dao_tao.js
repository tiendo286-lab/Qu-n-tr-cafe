// Công việc › Phân công đào tạo (tệp 174, anh Tiến duyệt 24/11/2026) — chạy SONG SONG trang Đào tạo cũ, dùng chung dữ liệu.
//  * Theo nhân viên mới: mỗi người một thẻ, mở ra là các ca theo lịch ĐÃ CÔNG BỐ; "Ngày N" = thứ tự ngày đi làm thật.
//  * Bấm ca: ca tới → Phân công (người làm cùng ca hiện sẵn, tích mục, 1 lần lưu; một ca nhiều người dạy);
//    ca đã qua → Chi tiết ngày như tab ngày của phiếu; ca hôm nay → cả hai.
//  * Mục đã giao ca khác ghi chú; tích = chuyển sang ca này. Mục chờ kiểm tra khoá. Mục đạt không hiện.
//  * Chờ kiểm tra nằm trong thẻ từng nhân viên. Ô lọc: một người dạy phải dạy gì trong một ngày.
//  * Ai thấy bảng: Chủ, người phụ trách chính (mọi phiếu), HD chính (phiếu của mình). Người khác: Việc đào tạo của tôi.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { $, dialog, flash, html, showSaved, str } from '../ui.js';
import { allShifts, cards, dayNo, groupsOf, itemWhere, shiftState, shortfall, span, workOf } from './pc_dao_tao_tinh.js?v=2026.11.28.4';
import { LEVEL, PCD_CSS, dm, mountMyPlan, myPlanHtml, wd } from './pc_dao_tao_toi.js?v=2026.11.28.4';

export const perm = null;
const F = { who: '', d: '' };   // ô lọc (giữ khi vẽ lại)
const OPEN = new Set();          // thẻ nhân viên đang mở
const ST = { chua: ['Chưa giao', 'warn'], giao: ['Đã giao', 'mute'], ok: ['Đã chấm', 'ok'], tre: ['Chưa chấm', 'off'], trong: ['Không phân công', 'mute'] };
const KIND = { gioi_thieu: 'Đã giới thiệu', thuc_hanh: 'Thực hành có giám sát', bo_tich: 'Bỏ tích', ghi_cu: 'Ghi trước khi có sổ lịch sử' };
const nowText = (it) => (it.state === 'cho_kt' ? `⏳ Chờ kiểm tra · ${LEVEL[it.level] || ''}` : it.state === 'dat' ? `Đạt · ${LEVEL[it.level] || ''}` : it.state === 'gioi_thieu' ? 'Đã giới thiệu' : 'Chưa giới thiệu');
const histText = (l) => (l.kind === 'muc' ? `Thực hành có giám sát · Mức đạt ${LEVEL[l.new?.level] || ''}${l.pending ? ' · ⏳ chờ kiểm tra' : ''}`
  : l.kind === 'xac_nhan' ? `Xác nhận đạt · ${LEVEL[l.new?.level] || ''}` : l.kind === 'dao_tao_lai' ? `Đào tạo lại · ${LEVEL[l.new?.level] || ''}` : KIND[l.kind] || l.kind);

export async function render() {
  const B = await rpc('app_dt_plan_board').catch((e) => ({ can_board: false, rows: [], err: e.message }));
  if (!B.can_board) {
    const P = await rpc('app_dt_my_plan').catch(() => null);
    return {
      title: 'Việc đào tạo của tôi',
      html: html`${PCD_CSS}<div class="page-head"><div><h1>Việc đào tạo của tôi</h1><div class="sub">Những ca bạn được giao dạy nhân viên mới</div></div></div>
        <div id="pcd" class="stack">${P ? myPlanHtml(P) : html`<div class="card">${B.err || 'Không tải được việc đào tạo.'}</div>`}</div>`,
      mount: (root) => mountMyPlan(root, P, rerender),
    };
  }
  const rows = B.rows || []; const today = B.today;
  const TR = new Map((B.trainers || []).map((t) => [t.id, t]));
  const nameOf = (id, r) => TR.get(id)?.name || (r && id === r.instructor_id ? r.instructor : null) || '—';
  const gLabel = (g, r) => `${nameOf(g.who_id, r)}${g.sub_by ? ` (${nameOf(g.sub_by, r)} giao lại)` : ''} · mục ${span(g.items.map((x) => x.no))}${(g.mixed || []).map((m) => ` (mục ${span(m.nos)}: ${nameOf(m.sub_by, r)} giao lại)`).join('')}`;
  const C = cards(rows, today);
  const fwHtml = () => {
    if (!F.who) return html`<div class="pcd-meta">Chọn người dạy để xem họ phải dạy gì trong ngày.</div>`;
    const d = F.d || today; const xs = workOf(rows, Number(F.who), d);
    if (!xs.length) return html`<div class="pcd-meta">${nameOf(Number(F.who))} không có mục dạy nào ngày ${dm(d)}.</div>`;
    return html`<div class="pcd-meta">${xs.length} ca · ${xs.reduce((s, x) => s + x.items.length, 0)} mục</div>
      ${xs.map((x) => html`<button type="button" class="pcd-fw-it" data-open="${x.row.id}|${x.sh.date}|${x.sh.shift}"><b>${x.row.employee}</b> · ${x.sh.branch || ''} ${x.sh.shift} · ${x.sh.off ? 'không còn trong lịch' : 'Ngày ' + dayNo(x.row, x.sh.date)} · mục ${span(x.items.map((i) => i.no))}</button>`)}`;
  };
  const card = (r) => {
    const kts = r.items.filter((i) => i.state === 'cho_kt');
    const days = Math.max(0, ...r.items.map((i) => Number(i.day) || 0));
    const sf = r.shifts.length ? shortfall(r, days) : 0;
    const shs = allShifts(r);   // + ca "không còn trong lịch" (lịch đổi sau khi đã giao)
    const tre = shs.filter((sh) => shiftState(r, sh, today) === 'tre').length;
    const loose = r.items.filter((i) => i.who_id && !i.date && (i.state === 'chua' || i.state === 'gioi_thieu'));
    return html`<details class="card pcd-card" data-id="${r.id}" ${OPEN.has(r.id) ? 'open' : ''}>
      <summary><div class="pcd-h"><b>${r.employee}</b><span class="pcd-meta">${r.program} · Đạt ${r.achieved}/${r.total} · hạn ${dm(r.due)} · HD chính ${r.instructor || '—'}</span></div>
        <div class="pcd-bar"><i style="width:${Math.round((100 * r.achieved) / Math.max(1, r.total))}%"></i></div>
        <div class="pcd-sum">${kts.length ? html`<span class="pill warn">${kts.length} chờ kiểm tra</span>` : ''}${tre ? html`<span class="pill off">${tre} ca chưa chấm</span>` : ''}${sf ? html`<span class="pill warn">Thiếu ${sf} ngày làm</span>` : ''}</div></summary>
      <div class="pcd-body">
        ${sf ? html`<div class="pcd-warn">Lịch đã công bố tới hạn ${dm(r.due)} mới có ${days - sf} ngày làm, thiếu ${sf} ngày so với ${days} ngày giáo trình (lịch tuần sau có thể chưa công bố).</div>` : ''}
        ${kts.length ? html`<div class="pcd-kt"><div class="pcd-lbl">⏳ CHỜ KIỂM TRA · ${kts.length} MỤC</div>${kts.map((i) => html`<div class="pcd-ktr" data-no="${i.no}"><span><b>${i.no}.</b> ${i.title}<br>
            <span class="pcd-meta">${i.pending_by || '—'} ghi mức <b>${LEVEL[i.level] || i.level}</b>${i.pending_at ? ' · ' + dm(i.pending_at) + ' ' + String(i.pending_at).slice(11, 16) : ''}${i.sub_by ? ` · ${nameOf(i.sub_by, r)} giao lại — ${nameOf(i.sub_by, r)} hoặc người phụ trách chính xác nhận` : ''}</span></span>
            ${r.can_check ? html`<span class="pcd-kta"><select class="input sm pcd-kt-lv" aria-label="Mức hạng mục ${i.no}">${Object.entries(LEVEL).map(([k, v]) => html`<option value="${k}" ${k === i.level ? 'selected' : ''}>${v}</option>`)}</select><button type="button" class="btn sm" data-ktok>Xác nhận đạt</button></span>` : ''}</div>`)}</div>` : ''}
        ${loose.length ? html`<div class="pcd-meta">${loose.length} mục đã giao ở trang cũ, chưa xếp ca: mục ${span(loose.map((i) => i.no))}</div>` : ''}
        ${shs.length ? html`<div class="pcd-shs">${shs.map((sh) => { const st = shiftState(r, sh, today); const gs = groupsOf(r, sh);
          return html`<button type="button" class="pcd-sh ${st}${sh.off ? ' off' : ''}" data-key="${sh.date}|${sh.shift}"><span class="pcd-sd"><span class="pcd-dn">${sh.off ? 'Ngoài lịch' : 'Ngày ' + dayNo(r, sh.date)}</span><b>${wd(sh.date)} ${dm(sh.date)}</b><span>${sh.branch || ''} ${sh.shift}</span></span>
            <span class="pcd-sw">${gs.length ? gs.map((g) => html`<span class="pcd-gl">${gLabel(g, r)}</span>`) : html`<span class="pcd-meta">${sh.date < today ? 'Không có phân công' : 'Chưa phân công'}</span>`}</span>
            ${sh.off ? html`<span class="pcd-meta pcd-offt">không còn trong lịch</span>` : ''}<span class="pill ${ST[st][1]}">${sh.date === today ? 'Hôm nay' : ST[st][0]}</span></button>`; })}</div>`
          : html`<div class="pcd-meta pcd-nosched">Chưa có lịch đã công bố — chưa có ca để phân công.</div>`}
      </div></details>`;
  };

  // ---- bảng dưới khi bấm một ca
  const openShift = (r, sh, view0) => {
    const past = sh.date < today; let view = sh.off ? 'ct' : view0 || (sh.date <= today ? 'ct' : 'pc'); let pick = null; let H = null;
    const d = dialog(''); d.classList.add('pcd-dlg');
    const mates = (sh.mates || []).filter((id) => TR.has(id) && id !== r.employee_id);
    const head = () => html`<div class="pcd-top"><div class="pcd-row"><h2>${r.employee} · ${sh.branch || ''} ${sh.shift} · ${wd(sh.date)} ${dm(sh.date)}</h2>
        <button type="button" class="btn sm secondary" data-x aria-label="Đóng">✕</button></div>
      <div class="pcd-meta">${sh.off ? 'Ca không còn trong lịch đã công bố' : `Ngày ${dayNo(r, sh.date)} đi làm`} · Đạt ${r.achieved}/${r.total} · hạn ${dm(r.due)}${sh.date === today ? ' · ca hôm nay' : ''}</div>
      ${sh.date === today && !sh.off ? html`<div class="pcd-seg" role="tablist"><button type="button" role="tab" data-view="ct" class="${view === 'ct' ? 'on' : ''}" aria-selected="${view === 'ct'}">Chi tiết ngày</button><button type="button" role="tab" data-view="pc" class="${view === 'pc' ? 'on' : ''}" aria-selected="${view === 'pc'}">Phân công</button></div>` : ''}</div>`;
    const detail = () => {
      if (!H) return html`<div class="pcd-mid"><div class="pcd-meta">Đang tải…</div></div>`;
      if (H.err) return html`<div class="pcd-mid"><div class="pcd-meta">${H.err}</div></div>`;
      const gs = groupsOf(r, sh); const whoOf = new Map(gs.flatMap((g) => g.items.map((i) => [i.no, g])));
      const logs = (H.log || []).filter((l) => l.day === sh.date);
      const nos = [...new Set([...gs.flatMap((g) => g.items.map((i) => i.no)), ...logs.map((l) => l.no)])].sort((a, b) => a - b);
      const note = (H.notes || []).find((n) => n.day === sh.date);
      return html`<div class="pcd-mid">
        ${sh.off ? html`<div class="pcd-warn">Ca này không còn trong lịch đã công bố (lịch đã đổi sau khi phân công). Mở một ca khác của ${r.employee}, tích các mục này để chuyển sang ca đó.</div>` : ''}
        <div class="pcd-meta">${nos.length} hạng mục · ${gs.length ? gs.map((g) => gLabel(g, r)).join(' · ') : 'không có phân công'}</div>
        ${nos.length ? nos.map((no) => { const it = r.items.find((i) => i.no === no) || { no, title: '', state: 'chua' }; const ls = logs.filter((l) => l.no === no); const g = whoOf.get(no);
          return html`<div class="pcd-ditem"><div><b>${no}.</b> ${it.title}${g ? html` <span class="pcd-meta">· ${nameOf(g.who_id, r)}${it.sub_by ? ` (${nameOf(it.sub_by, r)} giao lại)` : ''}</span>` : ''}</div>
            <ul>${ls.length ? ls.map((l) => html`<li><span class="pcd-tm">${String(l.at || '').slice(11, 16)}</span>${histText(l)} <span class="pcd-meta">· ${l.by || '—'}</span></li>`) : html`<li class="pcd-meta">Chưa ghi gì ngày này</li>`}</ul>
            <div class="pcd-meta">Hiện tại: <b>${nowText(it)}</b></div></div>`; }) : html`<div class="pcd-meta">Ngày này không có hạng mục nào được giao hoặc ghi.</div>`}
        <div class="pcd-note"><div class="pcd-lbl">NHẬN XÉT CỦA NGƯỜI HƯỚNG DẪN · ${dm(sh.date)}</div>
          ${note?.comment ? html`<div>${note.comment}</div><div class="pcd-meta">Ghi bởi ${note.comment_by || '—'}${note.comment_at ? ' · ' + String(note.comment_at).slice(11, 16) : ''}</div>` : html`<div class="pcd-meta">Chưa có nhận xét.</div>`}
          <div class="pcd-cf"><span class="pill ${note?.trainee_at ? 'ok' : 'mute'}">${note?.trainee_at ? `✓ Nhân viên đã xác nhận · ${note.trainee_by || ''}` : 'Nhân viên chưa xác nhận'}</span>
            <span class="pill ${note?.instructor_at ? 'ok' : 'mute'}">${note?.instructor_at ? `✓ Người hướng dẫn đã xác nhận · ${note.instructor_by || ''}` : 'Người hướng dẫn chưa xác nhận'}</span></div></div>
      </div>
      <div class="pcd-foot"><span class="grow pcd-meta">${past ? 'Ngày đã qua chỉ xem.' : 'Người dạy tích trên phiếu, ở đây hiện lại.'}</span><a class="btn sm secondary" href="#/dao-tao/phieu?id=${r.id}">Mở phiếu</a></div>`;
    };
    const assign = () => {
      const gs = groupsOf(r, sh);
      const pickName = pick ? nameOf(pick, r) : '';
      const opt = (lab, xs) => (xs.length ? html`<optgroup label="${lab}">${xs.map((t) => html`<option value="${t.id}" ${pick === t.id ? 'selected' : ''}>${t.name} (${t.rank}${t.branches?.length ? ' ' + t.branches.join(', ') : ''})</option>`)}</optgroup>` : '');
      const rest = (B.trainers || []).filter((t) => !mates.includes(t.id) && t.id !== r.employee_id);
      const open = r.items.filter((i) => i.state !== 'dat');
      const days = [...new Set(open.map((i) => i.day))].sort((a, b) => a - b);
      const mine = (i) => pick && i.date === sh.date && i.shift === sh.shift && (i.who_id ?? r.instructor_id) === pick;
      const whereTxt = (i) => { const w = itemWhere(r, i.no);
        if (w) return w.date === sh.date && w.shift === sh.shift ? `Ca này · ${nameOf(w.who_id, r)}` : `Đã giao ${wd(w.date)} ${dm(w.date)} ${w.shift} · ${nameOf(w.who_id, r)}`;
        return i.who_id ? `Đã giao ${nameOf(i.who_id, r)}, chưa xếp ca` : ''; };
      return html`<div class="pcd-mid">
        <div class="pcd-lbl">LÀM CÙNG CA NÀY (THEO LỊCH)</div>
        <div class="pcd-mates">${mates.length ? mates.map((id) => { const t = TR.get(id); return html`<button type="button" class="pcd-mate ${pick === id ? 'on' : ''}" data-pick="${id}"><b>${t.name}</b><span>${t.rank}${t.branches?.length ? ' ' + t.branches.join(', ') : ''}</span></button>`; }) : html`<span class="pcd-meta">Không có Cấp 1 / Quản lý nào làm cùng ca này.</span>`}</div>
        <label class="field">Hoặc chọn người khác<select class="input sm" id="pcd-other"><option value="">— Chọn người dạy —</option>
          ${opt('Quản lý', rest.filter((t) => t.rank === 'Quản lý'))}${opt('Cấp 1 cơ sở ' + (sh.branch || ''), rest.filter((t) => t.rank === 'Cấp 1' && (t.branches || []).includes(sh.branch)))}${opt('Cấp 1 cơ sở khác', rest.filter((t) => t.rank === 'Cấp 1' && !(t.branches || []).includes(sh.branch)))}</select></label>
        ${gs.length ? html`<div class="pcd-given"><div class="pcd-lbl">ĐÃ GIAO TRONG CA NÀY</div>${gs.map((g) => html`<div class="pcd-gv" data-who="${g.who_id}"><span>${gLabel(g, r)}</span>
            <span><button type="button" class="btn sm secondary" data-edit="${g.who_id}">Sửa</button>${g.items.every((i) => i.state === 'chua' || i.state === 'gioi_thieu') ? html` <button type="button" class="btn sm secondary" data-un="${g.who_id}">Bỏ</button>` : ''}</span></div>`)}</div>` : ''}
        <div class="pcd-meta">${pick ? html`Tích những mục <b>${pickName}</b> dạy trong ca này. Mục đã giao ca khác vẫn tích được — khi đó mục chuyển sang ca này.` : 'Chọn người dạy trước, rồi tích mục.'} Đã đạt ${r.achieved} mục, không hiện lại.</div>
        ${days.map((dd) => html`<div class="pcd-dgrp"><label class="pcd-dgh"><input type="checkbox" data-allday="${dd}" ${pick ? '' : 'disabled'}> Giáo trình ngày ${dd} <span class="pcd-meta">· chọn cả ngày</span></label>
          ${open.filter((i) => i.day === dd).map((i) => { const lock = i.state === 'cho_kt'; const w = lock ? '' : whereTxt(i);
            return html`<label class="pcd-it" data-no="${i.no}"><input type="checkbox" data-no="${i.no}" data-day="${dd}" ${mine(i) && !lock ? 'checked' : ''} ${lock || !pick ? 'disabled' : ''}>
              <span class="t"><b>${i.no}.</b> ${i.title}${i.state === 'gioi_thieu' ? html` <span class="pill mute">đã giới thiệu</span>` : ''}
                ${lock ? html`<br><span class="pcd-lock">🔒 Chờ kiểm tra — không giao lại</span>` : w && !mine(i) ? html`<br><span class="pcd-where">${w}</span>` : ''}</span></label>`; })}</div>`)}
      </div>
      <div class="pcd-foot"><b class="grow">Đã chọn <span id="pcd-n">0</span> mục</b><button type="button" class="btn" id="pcd-go" disabled>Phân công${pick ? ' cho ' + pickName : ''}</button></div>`;
    };
    const sync = () => {
      const n = d.querySelectorAll('input[data-no]:checked').length; const nEl = d.querySelector('#pcd-n'); if (!nEl) return;
      nEl.textContent = n; d.querySelector('#pcd-go').disabled = !pick || !n;
      d.querySelectorAll('[data-allday]').forEach((a) => { const xs = [...d.querySelectorAll(`input[data-day="${a.dataset.allday}"]:not(:disabled)`)]; a.checked = xs.length > 0 && xs.every((x) => x.checked); });
    };
    const paint = () => { d.innerHTML = str(html`${head()}${view === 'ct' ? detail() : assign()}`); sync(); };
    const loadH = async () => { if (H) return; try { H = await rpc('app_dt_history', { p_id: r.id }); } catch (e) { H = { err: e.message }; } if (d.open && view === 'ct') paint(); };
    d.addEventListener('change', (e) => {
      if (e.target.id === 'pcd-other') { pick = Number(e.target.value) || null; paint(); return; }
      const a = e.target.closest('[data-allday]'); if (a) d.querySelectorAll(`input[data-day="${a.dataset.allday}"]:not(:disabled)`).forEach((x) => { x.checked = a.checked; });
      sync();
    });
    d.addEventListener('click', async (e) => {
      const t = e.target;
      if (t.closest('[data-x]')) { d.close(); return; }
      const v = t.closest('[data-view]'); if (v) { view = v.dataset.view; paint(); if (view === 'ct') loadH(); return; }
      const p = t.closest('[data-pick]') || t.closest('[data-edit]'); if (p) { pick = Number(p.dataset.pick || p.dataset.edit); view = 'pc'; paint(); return; }
      const un = t.closest('[data-un]');
      if (un) { un.disabled = true;
        try { const n = await rpc('app_dt_plan_unassign', { p_id: r.id, p_date: sh.date, p_shift: sh.shift, p_employee: Number(un.dataset.un) }); d.close(); OPEN.add(r.id); flash(`Đã bỏ giao ${n} mục.`); rerender(); }
        catch (err) { un.disabled = false; showSaved(err.message, true); }
        return; }
      const go = t.closest('#pcd-go');
      if (go && pick) {
        const items = [...d.querySelectorAll('input[data-no]:checked')].map((x) => Number(x.dataset.no)); go.disabled = true;
        try {
          const res = await rpc('app_dt_plan_assign', { p_id: r.id, p_date: sh.date, p_shift: sh.shift, p_branch: sh.branch_id, p_employee: pick, p_items: items });
          d.close(); OPEN.add(r.id);
          flash(`Đã phân công ${res.n} mục cho ${nameOf(pick, r)} · ${sh.shift} ${wd(sh.date)} ${dm(sh.date)}${res.moved ? ` · chuyển ${res.moved} mục từ ca khác` : ''}${res.skipped ? ` · bỏ qua ${res.skipped} mục đã chấm` : ''}.`);
          rerender();
        } catch (err) { go.disabled = false; showSaved(err.message, true); }
      }
    });
    paint(); if (view === 'ct') loadH();
  };

  return {
    title: 'Phân công đào tạo',
    html: html`${PCD_CSS}<div class="page-head"><div><h1>Phân công đào tạo</h1><div class="sub">Giao việc đào tạo theo từng ca đi làm của nhân viên mới · trang cũ vẫn dùng được ở <a href="#/cong-viec/dao-tao">Đào tạo</a></div></div></div>
      <div id="pcd" class="stack pcd">
        <div class="pcd-sum"><span class="pill info">${C.n} người đang đào tạo</span><span class="pill ${C.tre ? 'off' : 'mute'}">${C.tre} ca chưa chấm</span><span class="pill ${C.kt ? 'warn' : 'mute'}">${C.kt} mục chờ kiểm tra</span></div>
        <section class="card pcd-fw"><div class="pcd-lbl">XEM VIỆC CỦA MỘT NGƯỜI DẠY</div>
          <div class="pcd-fw-f"><select id="pcd-who" class="input sm" aria-label="Người dạy"><option value="">— Chọn người dạy —</option>${(B.trainers || []).map((t) => html`<option value="${t.id}" ${String(t.id) === F.who ? 'selected' : ''}>${t.name} (${t.rank})</option>`)}</select>
            <input id="pcd-d" type="date" class="input sm" aria-label="Ngày" value="${F.d || today}"></div>
          <div id="pcd-fw-r">${fwHtml()}</div></section>
        ${rows.length ? rows.map(card) : html`<div class="card">Không có nhân viên nào đang đào tạo.</div>`}
      </div>`,
    mount(root) {
      const onChange = (e) => {
        if (e.target.id === 'pcd-who' || e.target.id === 'pcd-d') { F.who = $('#pcd-who', root).value; F.d = $('#pcd-d', root).value; $('#pcd-fw-r', root).innerHTML = str(fwHtml()); }
      };
      const onToggle = (e) => { const c = e.target.closest?.('details.pcd-card'); if (c) { const id = Number(c.dataset.id); if (c.open) OPEN.add(id); else OPEN.delete(id); } };
      const onClick = async (e) => {
        const t = e.target;
        const shb = t.closest('.pcd-sh');
        if (shb) { const r = rows.find((x) => x.id === Number(shb.closest('.pcd-card').dataset.id)); const [date, shift] = shb.dataset.key.split('|');
          const sh = allShifts(r).find((s) => s.date === date && s.shift === shift); if (sh) openShift(r, sh); return; }
        const fo = t.closest('[data-open]');
        if (fo) { const [id, date, shift] = fo.dataset.open.split('|'); const r = rows.find((x) => x.id === Number(id)); const sh = r && allShifts(r).find((s) => s.date === date && s.shift === shift); if (sh) openShift(r, sh); return; }
        const ok = t.closest('.pcd-ktr [data-ktok]');
        if (ok) { const row = ok.closest('.pcd-ktr'); const id = Number(row.closest('.pcd-card').dataset.id); ok.disabled = true;
          try { await rpc('app_dt_check_ok', { p_id: id, p_no: Number(row.dataset.no), p_level: row.querySelector('.pcd-kt-lv').value }); OPEN.add(id); flash('Đã xác nhận đạt.'); rerender(); }
          catch (err) { ok.disabled = false; showSaved(err.message, true); } }
      };
      root.addEventListener('change', onChange); root.addEventListener('toggle', onToggle, true); root.addEventListener('click', onClick);
      return () => { root.removeEventListener('change', onChange); root.removeEventListener('toggle', onToggle, true); root.removeEventListener('click', onClick); };
    },
  };
}
