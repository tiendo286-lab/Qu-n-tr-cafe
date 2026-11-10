// Phiếu đào tạo chạy bàn 8 ngày: từng hạng mục (giới thiệu → thực hành → mức đạt), nhận xét & xác nhận cuối ngày, đánh giá cuối khóa, đào tạo tiếp
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { dmy, dt } from '../tien.js';
import { $, $$, dialog, flash, go, hhmm, html, raw, showSaved, str } from '../ui.js';
import { DOC_STYLE, fillImages, sanitize, zoomImages } from '../editor.js';
import { DT_STATUS, dtLabel } from './dao_tao.js';
import { STATUS as TASK_STATUS } from './viec.js';

const LEVEL = { tb: 'Trung bình', kha: 'Khá', tot: 'Tốt' };

export async function render({ params }) {
  const T = await rpc('app_dt_get', { p_id: Number(params.id) });
  const PROG = T.program.code || 'chay_ban';
  let guided = []; try { guided = (await rpc('app_dt_guide_items', { p_program: PROG })) || []; } catch (_) { /* chưa có sổ tay */ }
  const hasGuide = new Set(guided.map(Number));
  const opt = T.can_admin ? await rpc('app_dt_options') : null;
  const ed = !!T.can_edit; const adm = !!T.can_admin;
  const days = T.program.days;
  const items = T.items;
  const cnt = (lv) => items.filter((i) => i.level === lv).length;
  const dlog = (d) => T.days_log[String(d)] || {};
  const empName = (id) => { const e = opt?.employees.find((x) => x.id === id); return e ? `${e.code} – ${e.name}` : ''; };

  const itemRow = (i) => html`<div class="dt-item ${i.level ? 'done' : ''}" data-no="${i.no}">
    <div class="dt-it-title">${hasGuide.has(i.no) ? html`<button type="button" class="it-guide" data-no="${i.no}" title="Mở hướng dẫn trong sổ tay"><strong>${i.no}.</strong> ${i.title} <span class="it-book">📖 Hướng dẫn</span></button>`
      : html`<strong>${i.no}.</strong> ${i.title}`} <span class="st-meta">Tr. ${i.page}</span></div>
    <div class="dt-it-ctl">
      <label><input type="checkbox" class="check it-intro" ${i.introduced ? 'checked' : ''} ${ed ? '' : 'disabled'}> Giới thiệu</label>
      <label><input type="checkbox" class="check it-prac" ${i.practiced ? 'checked' : ''} ${ed && i.introduced ? '' : 'disabled'}> Thực hành</label>
      <select class="input sm it-level" aria-label="Mức đạt hạng mục ${i.no}" ${ed && i.introduced && i.practiced ? '' : 'disabled'}>
        <option value="">— Mức đạt —</option>${Object.entries(LEVEL).map(([k, l]) => html`<option value="${k}" ${i.level === k ? 'selected' : ''}>${l}</option>`)}</select>
      <span class="st-meta it-by">${i.at ? `${i.by} · ${dt(i.at)}` : ''}</span></div></div>`;

  const confirmBox = (d) => { const l = dlog(d); return html`<div class="dt-confirm">
    <button type="button" class="btn sm ${l.trainee_at ? '' : 'secondary'} day-ok" data-day="${d}" data-who="nv" data-on="${l.trainee_at ? 0 : 1}" ${T.is_trainee ? '' : 'disabled'}>${l.trainee_at ? `✓ Nhân viên đã xác nhận ${dt(l.trainee_at)}` : 'Nhân viên xác nhận'}</button>
    <button type="button" class="btn sm ${l.instructor_at ? '' : 'secondary'} day-ok" data-day="${d}" data-who="hd" data-on="${l.instructor_at ? 0 : 1}" ${ed ? '' : 'disabled'}>${l.instructor_at ? `✓ Người hướng dẫn đã xác nhận ${dt(l.instructor_at)}` : 'Người hướng dẫn xác nhận'}</button></div>`; };
  const commentBox = (d) => html`<label class="stack" style="gap:4px"><span class="pc-sub">NHẬN XÉT CỦA NGƯỜI HƯỚNG DẪN (NGÀY ${d})</span>
    <textarea class="input day-cmt" data-day="${d}" rows="2" ${ed ? '' : 'disabled'}>${dlog(d).comment || ''}</textarea></label>`;

  const daySec = (dd) => {
    const its = items.filter((i) => i.day === dd.day);
    const ok = its.filter((i) => i.level).length; const l = dlog(dd.day);
    const tb = items.filter((i) => i.level === 'tb').map((i) => i.no);
    return html`<details class="card dt-day" data-day="${dd.day}">
      <summary><span class="dt-day-t">Ngày ${dd.day} – ${dd.title}</span>
        <span class="st-meta">${its.length ? html`<span class="day-ok-n">${ok}</span>/${its.length} đạt` : 'không có hạng mục mới'}${l.trainee_at ? ' · ✓NV' : ''}${l.instructor_at ? ' · ✓HD' : ''}</span></summary>
      <div class="stack" style="gap:10px;margin-top:10px">
        ${dd.note ? html`<div class="st-meta">${dd.note}</div>` : ''}
        ${its.map(itemRow)}
        ${dd.day === 8 ? html`<div class="pc-grid">
            <label class="pc-f"><span>Ca làm độc lập</span><select class="input info-f" data-f="day8_shift" ${ed ? '' : 'disabled'}><option value="">—</option>${['Sáng', 'Chiều', 'Tối'].map((s) => html`<option ${T.day8_shift === s ? 'selected' : ''}>${s}</option>`)}</select></label>
            <label class="pc-f"><span>Ngày</span><input class="input info-f" type="date" data-f="day8_date" value="${T.day8_date || ''}" ${ed ? '' : 'disabled'}></label></div>
          <label class="pc-f"><span>Hạng mục ôn lại (ghi STT)</span><input class="input info-f" data-f="day8_review" value="${T.day8_review || ''}" placeholder="${tb.length ? 'Gợi ý — đang ở mức Trung bình: ' + tb.join(', ') : 'vd: 12, 31, 45'}" ${ed ? '' : 'disabled'}></label>` : ''}
        ${commentBox(dd.day)}${confirmBox(dd.day)}</div></details>`;
  };

  const missing = T.missing || [];
  const st = T.status;
  return {
    title: `Đào tạo ${T.employee.code}`,
    html: html`${STYLE}${raw(DOC_STYLE)}
      <div class="page-head"><div><h1>Phiếu đào tạo chạy bàn</h1>
        <div class="sub"><strong>${T.employee.code} – ${T.employee.name}</strong> · ${T.employee.rank}</div>
        <div class="toolbar" style="gap:6px;margin-top:6px"><span class="pill ${DT_STATUS[st][1]}" id="dt-status">${dtLabel(T)}</span></div></div>
        <div class="toolbar">${adm ? html`<a class="btn sm secondary" href="#/quan-ly/nhan-vien">‹ Nhân viên</a>` : html`<a class="btn sm secondary" href="#/cua-toi/dao-tao">‹ Phiếu của tôi</a>`}<div id="saved-indicator" class="saved" role="status" hidden></div></div></div>
      <div class="stack" style="max-width:900px;gap:12px">
        <section class="card stack" style="gap:10px">
          <div class="dt-prog"><div class="dt-bar"><div id="dt-bar" style="width:${Math.round((T.achieved / T.total) * 100)}%"></div></div><strong><span id="dt-ach">${T.achieved}</span>/${T.total} hạng mục đạt</strong></div>
          <div class="pc-grid">
            <label class="pc-f"><span>Cơ sở</span>${adm ? html`<select class="input info-f" data-f="branch_id"><option value="">—</option>${opt.branches.map((b) => html`<option value="${b.id}" ${b.id === T.branch_id ? 'selected' : ''}>${b.code}</option>`)}</select>` : html`<div class="pc-fixed">${T.branch || '—'}</div>`}</label>
            <label class="pc-f"><span>Ngày bắt đầu</span>${adm ? html`<input class="input info-f" type="date" data-f="start_date" value="${T.start_date}">` : html`<div class="pc-fixed">${dmy(T.start_date)}</div>`}</label>
            <label class="pc-f"><span>Người hướng dẫn chính</span>${adm ? html`<input class="input emp-f" data-f="instructor_id" list="dt-emps" value="${empName(T.instructor_id)}" placeholder="Gõ mã hoặc tên">` : html`<div class="pc-fixed">${T.instructor || '—'}</div>`}</label>
            <label class="pc-f"><span>Quản lý phụ trách</span>${adm ? html`<select class="input info-f" data-f="manager_id"><option value="">—</option>${opt.managers.map((m) => html`<option value="${m.id}" ${m.id === T.manager_id ? 'selected' : ''}>${m.name}</option>`)}</select>` : html`<div class="pc-fixed">${T.manager || '—'}</div>`}</label>
          </div>
          ${adm ? html`<datalist id="dt-emps">${opt.employees.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}</datalist>` : ''}
          <div class="st-meta">Mỗi hạng mục đi đủ 3 bước: Đã giới thiệu → Đã thực hành có giám sát → Mức đạt (Trung bình / Khá / Tốt — cả 3 mức đều tính là đạt). Hệ thống ghi người và ngày xác nhận thay cho chữ ký.</div>
          ${T.tasks.length ? html`<div><span class="pc-sub">NHIỆM VỤ ĐÀO TẠO ĐƯỢC GIAO (TAB CÔNG VIỆC)</span>${T.tasks.map((k) => html`<div class="st-meta">• ${k.content} — ${k.assignee || 'chưa giao'} · <span class="pill ${TASK_STATUS[k.status][1]}">${TASK_STATUS[k.status][0]}</span>${k.due_date ? ' · hạn ' + dmy(k.due_date) : ''}</div>`)}</div>` : ''}
        </section>
        ${days.map(daySec)}
        <section class="card stack" style="gap:10px">
          <h2 style="margin:0">Phiếu đánh giá cuối khóa</h2>
          <div class="pc-sub">A. TỔNG HỢP KẾT QUẢ</div>
          <div class="kv"><div>Số hạng mục đạt</div><div><strong>${T.achieved}/${T.total}</strong> (Tốt ${cnt('tot')} · Khá ${cnt('kha')} · Trung bình ${cnt('tb')})</div>
            <div>Chưa được đánh giá</div><div>${missing.length ? `${missing.length}: ${missing.join(', ')}` : 'Không còn'}</div>
            <div>Bài kiểm tra lý thuyết</div><div><span class="pill mute">Chờ bổ sung</span></div></div>
          <div class="pc-sub">B. NHẬN XÉT CỦA NGƯỜI HƯỚNG DẪN</div>
          <label class="pc-f"><span>Điểm mạnh</span><textarea class="input info-f" data-f="strengths" rows="2" ${ed ? '' : 'disabled'}>${T.strengths || ''}</textarea></label>
          <label class="pc-f"><span>Điểm cần cải thiện</span><textarea class="input info-f" data-f="improvements" rows="2" ${ed ? '' : 'disabled'}>${T.improvements || ''}</textarea></label>
          <div class="pc-sub">C. KẾT LUẬN</div>
          <div>${st === 'hoan_thanh' ? html`<span class="pill ok">Hoàn thành: đạt đủ ${T.total}/${T.total} hạng mục</span>`
            : st === 'dao_tao_tiep' ? html`<span class="pill warn">Chưa hoàn thành: chuyển đào tạo tiếp (mục E)</span>`
            : html`<span class="pill info">Đang trong 8 ngày đào tạo (bắt đầu ${dmy(T.start_date)})</span>`}</div>
          ${st !== 'hoan_thanh' ? html`<div class="pc-sub">E. ĐÀO TẠO TIẾP</div>
            <div class="pc-grid">
              <label class="pc-f"><span>Người đào tạo tiếp là</span>${adm ? html`<select class="input info-f" data-f="cont_trainer_kind"><option value="">—</option><option value="quan_ly" ${T.cont_trainer_kind === 'quan_ly' ? 'selected' : ''}>Quản lý</option><option value="cap_1" ${T.cont_trainer_kind === 'cap_1' ? 'selected' : ''}>Nhân viên cấp 1</option></select>`
                : html`<div class="pc-fixed">${{ quan_ly: 'Quản lý', cap_1: 'Nhân viên cấp 1' }[T.cont_trainer_kind] || '—'}</div>`}</label>
              <label class="pc-f"><span>Họ tên</span>${adm ? html`<input class="input emp-f" data-f="cont_trainer_id" list="dt-emps" value="${empName(T.cont_trainer_id)}" placeholder="Gõ mã hoặc tên">` : html`<div class="pc-fixed">${T.cont_trainer || '—'}</div>`}</label>
              <label class="pc-f"><span>Ngày hoàn thành</span><input class="input info-f" type="date" data-f="cont_done_date" value="${T.cont_done_date || ''}" ${ed ? '' : 'disabled'}></label>
              <label class="pc-f"><span>Kết quả kiểm tra lại</span><label style="display:flex;gap:6px;align-items:center;min-height:48px"><input type="checkbox" class="check" id="cont-ok" ${T.cont_result === 'dat' ? 'checked' : ''} ${ed ? '' : 'disabled'}> Đạt</label></label></div>
            <div class="st-meta">Các hạng mục còn lại: ${missing.join(', ') || 'không'}</div>` : ''}
          ${adm ? html`<div style="margin-top:8px"><button type="button" class="btn sm secondary danger" id="dt-del">Xóa phiếu đào tạo</button></div>` : ''}
        </section>
      </div>`,
    mount() {
      // mở sẵn ngày đang học (ngày đầu còn hạng mục chưa đạt)
      const firstOpen = days.find((d) => items.some((i) => i.day === d.day && !i.level)) || days[days.length - 1];
      $(`.dt-day[data-day="${firstOpen.day}"]`)?.setAttribute('open', '');
      const saveInfo = async (p) => { try { await rpc('app_dt_update', { p_id: T.id, p }); showSaved('Đã lưu · ' + hhmm()); return true; } catch (e) { showSaved(e.message, true); return false; } };
      $$('.info-f').forEach((el) => el.addEventListener('change', async () => { if (await saveInfo({ [el.dataset.f]: el.value || null }) && ['start_date', 'cont_trainer_kind'].includes(el.dataset.f)) rerender(); }));
      $$('.emp-f').forEach((el) => el.addEventListener('change', async () => {
        const q = el.value.trim().toLowerCase(); const code = q.split(/\s*[–-]\s*/)[0];
        const e = q ? (opt.employees.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || opt.employees.find((x) => String(x.code).toLowerCase() === code)) : null;
        if (q && !e) { showSaved('Không tìm thấy nhân viên. Chọn trong danh sách gợi ý.', true); return; }
        await saveInfo({ [el.dataset.f]: e ? e.id : null });
      }));
      $('#cont-ok')?.addEventListener('change', (ev) => saveInfo({ cont_result: ev.target.checked ? 'dat' : null }));
      $$('.day-cmt').forEach((el) => el.addEventListener('change', async () => {
        try { await rpc('app_dt_day_comment', { p_id: T.id, p_day: Number(el.dataset.day), p_comment: el.value }); showSaved('Đã lưu · ' + hhmm()); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.day-ok').forEach((b) => b.addEventListener('click', async () => {
        try { await rpc('app_dt_day_confirm', { p_id: T.id, p_day: Number(b.dataset.day), p_who: b.dataset.who, p_on: b.dataset.on === '1' }); rerender(); } catch (e) { showSaved(e.message, true); }
      }));
      // hạng mục: lưu ngay từng thao tác
      $$('.dt-item').forEach((row) => {
        const no = Number(row.dataset.no); const intro = row.querySelector('.it-intro'); const prac = row.querySelector('.it-prac'); const lv = row.querySelector('.it-level');
        const sync = () => { prac.disabled = !ed || !intro.checked; lv.disabled = !ed || !(intro.checked && prac.checked); row.classList.toggle('done', !!lv.value); };
        const send = async (p, undo) => {
          try {
            const r = await rpc('app_dt_mark', { p_id: T.id, p_no: no, p });
            row.querySelector('.it-by').textContent = `${r.by} · ${dt(r.at)}`;
            $('#dt-ach').textContent = r.achieved; $('#dt-bar').style.width = `${Math.round((r.achieved / T.total) * 100)}%`;
            const day = row.closest('.dt-day'); const n = day.querySelector('.day-ok-n'); if (n) n.textContent = $$('.dt-item.done', day).length;
            if (r.status !== T.status) { T.status = r.status; T.achieved = r.achieved; $('#dt-status').textContent = dtLabel(T); $('#dt-status').className = `pill ${DT_STATUS[r.status][1]}`; }
            showSaved('Đã lưu · ' + hhmm());
          } catch (e) { undo(); sync(); showSaved(e.message, true); }
        };
        intro.addEventListener('change', () => {
          const p = { introduced: intro.checked };
          if (!intro.checked) { prac.checked = false; lv.value = ''; p.practiced = false; p.level = null; }
          sync(); send(p, () => { intro.checked = !intro.checked; });
        });
        prac.addEventListener('change', () => {
          const p = { practiced: prac.checked };
          if (!prac.checked) { lv.value = ''; p.level = null; }
          sync(); send(p, () => { prac.checked = !prac.checked; });
        });
        let last = lv.value;
        lv.addEventListener('change', () => { sync(); send({ level: lv.value || null }, () => { lv.value = last; }); last = lv.value; });
      });
      // hướng dẫn trong sổ tay: cửa sổ nổi ngay trên phiếu, ‹ › sang hạng mục trước / sau
      const order = items.map((i) => i.no).filter((n) => hasGuide.has(n));
      async function openGuide(no, d) {
        let G;
        try { G = await rpc('app_dt_guide', { p_program: PROG, p_item: no }); } catch (e) { showSaved(e.message, true); return; }
        const k = order.indexOf(no); const prev = order[k - 1]; const next = order[k + 1];
        const it = G.item || {};
        const inner = html`<div class="dg-head"><div><div class="st-meta">Ngày ${it.day} · Tr. ${it.page || '—'} · ${k + 1}/${order.length}</div><strong>${it.no}. ${it.title}</strong></div>
            <button type="button" class="btn sm secondary dg-x" aria-label="Đóng hướng dẫn">✕</button></div>
          <div class="dg-body">${G.guides.length ? G.guides.map((g) => html`<section class="dg-sec">${G.guides.length > 1 ? html`<div class="pc-sub">${g.heading}</div>` : ''}
              <div class="doc">${raw(sanitize(g.html))}</div>
              ${g.doc_id ? html`<a class="dg-full" href="#/quy-trinh?id=${g.doc_id}">Mở cả bài “${g.doc_title || 'Quy trình'}” ›</a>` : ''}</section>`)
            : html`<div class="alert warn">Chưa có hướng dẫn trên web — xem sổ tay trang ${it.page || '?'}.</div>`}</div>
          <div class="dg-foot"><button type="button" class="btn sm secondary dg-go" data-no="${prev || ''}" ${prev ? '' : 'disabled'}>‹ Trước</button>
            <button type="button" class="btn sm secondary dg-x">Đóng</button>
            <button type="button" class="btn sm secondary dg-go" data-no="${next || ''}" ${next ? '' : 'disabled'}>Sau ›</button></div>`;
        if (!d) {
          d = dialog(html`<div class="dg-wrap"></div>`); d.classList.add('dt-guide'); zoomImages(d);
          d.addEventListener('click', (ev) => {
            if (ev.target.closest('.dg-x') || ev.target.closest('.dg-full')) { d.close(); d.remove(); return; }
            const g = ev.target.closest('.dg-go'); if (g && g.dataset.no) openGuide(Number(g.dataset.no), d);
          });
        }
        const w = d.querySelector('.dg-wrap'); w.innerHTML = str(inner); w.querySelector('.dg-body').scrollTop = 0;
        await fillImages(w);
      }
      $$('.it-guide').forEach((b) => b.addEventListener('click', () => openGuide(Number(b.dataset.no))));
      $('#dt-del')?.addEventListener('click', async () => {
        if (!confirm(`Xóa hẳn phiếu đào tạo của ${T.employee.code} – ${T.employee.name}? Mọi kết quả đã ghi sẽ mất.`)) return;
        try { await rpc('app_dt_delete', { p_id: T.id }); flash('Đã xóa phiếu đào tạo.'); go('/quan-ly/nhan-vien'); } catch (e) { showSaved(e.message, true); }
      });
    },
  };
}

const STYLE = html`<style>
  .pill.info { background: var(--info-bg); color: var(--info-ink); }
  .dt-prog { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dt-bar { flex: 1 1 200px; height: 10px; background: var(--line-soft); border-radius: 6px; overflow: hidden; }
  .dt-bar > div { height: 10px; background: var(--ok-line, var(--ok-line)); }
  .pc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
  @media (max-width: 640px) { .pc-grid { grid-template-columns: minmax(0, 1fr); } }
  .pc-f { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .pc-f > span:first-child { font-weight: 600; color: var(--ink-2); font-size: 13px; }
  .pc-fixed { min-height: 40px; display: flex; align-items: center; font-weight: 600; }
  .pc-sub { font-size: 12px; font-weight: 700; letter-spacing: .03em; color: var(--ink-2); }
  .st-meta { font-size: 12px; color: var(--muted); font-weight: 400; }
  .dt-day { padding: 14px 16px; }
  .dt-day summary { cursor: pointer; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline; }
  .dt-day-t { font-weight: 700; font-size: 15px; }
  .dt-item { border: 1px solid var(--line-soft); border-left: 4px solid #fca5a5; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .dt-item.done { border-left-color: var(--ok-line); }
  .dt-it-ctl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
  .dt-it-ctl label { display: inline-flex; gap: 4px; align-items: center; }
  .dt-it-ctl select { width: 150px; }
  .dt-confirm { display: flex; gap: 8px; flex-wrap: wrap; }
  .it-guide { all: unset; cursor: pointer; text-align: left; }
  .it-guide:hover { color: var(--primary); }
  .it-guide:focus-visible { outline: 2px solid var(--primary); border-radius: 4px; }
  .it-book { display: inline-block; font-size: 12px; font-weight: 600; color: var(--primary); background: var(--info-bg); border-radius: 999px; padding: 1px 8px; margin-left: 4px; white-space: nowrap; }
  dialog.dt-guide { padding: 0; border: 0; border-radius: 14px; width: min(760px, 96vw); max-height: 92vh; }
  dialog.dt-guide::backdrop { background: rgba(15, 23, 42, .55); }
  .dg-wrap { display: flex; flex-direction: column; max-height: 92vh; }
  .dg-head, .dg-foot { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--subtle, #f3f4f6); }
  .dg-head { border-bottom: 1px solid var(--line); } .dg-foot { border-top: 1px solid var(--line); }
  .dg-body { overflow-y: auto; padding: 8px 16px 16px; flex: 1 1 auto; }
  .dg-sec + .dg-sec { border-top: 1px dashed var(--line); margin-top: 12px; padding-top: 10px; }
  .dg-full { display: inline-block; margin-top: 6px; font-weight: 600; font-size: 14px; }
</style>`;
