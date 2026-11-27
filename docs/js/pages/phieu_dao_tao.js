// Phiếu đào tạo chạy bàn: từng hạng mục (giới thiệu → thực hành → mức đạt), đánh giá cuối khóa, đào tạo tiếp.
// Chặng 4 (anh Tiến duyệt 21/11, chốt làm 22/11 — thiết kế tai_lieu/superpowers/specs/2026-11-22-lich-su-dao-tao-theo-ngay-design.md):
//   phiếu bày theo TAB NGÀY THẬT (Ngày 1 · dd/mm …, ngày không ai tích thì không có tab) + tab "Ngày tiếp theo" (hạng mục chưa có mức đạt, theo sườn 8 ngày).
//   Mỗi hạng mục chỉ có MỘT hàng để sửa (.dt-item): chưa có mức → tab Ngày tiếp theo; có mức → tab ngày gần nhất đã dạy (nút "Đào tạo lại").
//   Ở các ngày khác hạng mục hiện thành thẻ lịch sử chỉ xem (.dt-hcard). Nhận xét + 2 lần xác nhận theo ngày thật (máy chủ tệp 163:
//   app_dt_history, app_dt_dnote_comment / confirm). Nhận xét theo ngày giáo trình cũ (training_days): chỉ xem.
//   Chấm ở tab Ngày tiếp theo thì lưu tại chỗ (hàng không nhảy đi dưới tay); mở tab một ngày thì phiếu tải lại lịch sử.
import { render as rerender } from '../app.js';
import { rpc } from '../sb.js';
import { vnToday } from '../data.js';
import { dmy, dt } from '../tien.js';
import { $, $$, dialog, flash, go, hhmm, html, raw, showSaved, str, once } from '../ui.js';
import { DOC_STYLE, fillImages, sanitize, zoomImages } from '../editor.js';
import { bindTrainingWork, openItemGuide, trainingWork } from './dt_cong_viec.js';
import { DT_STATUS, dtLabel } from './dao_tao.js?v=2026.11.27.8';
import { STATUS as TASK_STATUS } from './viec.js';

const ITEM_FILTERS = {
  all: 'Tất cả',
  new: 'Chưa giới thiệu',
  introduced: 'Đã giới thiệu · chưa hoàn thành',
  phase2: 'Giai đoạn 2',
  check: 'Chờ kiểm tra',   // bước 169: Cấp 1 đã ghi mức đạt, chờ HD chính / người phụ trách chính xác nhận
  done: 'Hoàn thành',
  // bước 140: lọc theo mức thực hành hiện tại của hạng mục
  lv_tb: 'Thực hành · Trung bình',
  lv_kha: 'Thực hành · Khá',
  lv_tot: 'Thực hành · Tốt',
};
const itemFiltersBySheet = new Map();

const needsMorePractice = (level) => level === 'tb' || level === 'kha';
const LEVEL = { tb: 'Trung bình', kha: 'Khá', tot: 'Tốt' };
// chặng 4: phiếu tự vẽ lại sau một lần lưu → giữ tab đang xem + danh sách tab Ngày tiếp theo (mở phiếu lần mới thì tính lại)
const keep = new Map();
const ddmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const hm = (at) => String(at || '').slice(11, 16);
// một dòng lịch sử (giờ · việc · người): chữ cho từng loại của sổ training_mark_log
const histText = (l) => {
  const o = l.old || {}, n = l.new || {}; const lv = (x) => LEVEL[x] || x || '—';
  const wait = l.pending ? ' · ⏳ chờ kiểm tra' : '';
  switch (l.kind) {
    case 'gioi_thieu': return 'Đã giới thiệu';
    case 'thuc_hanh': return 'Đã thực hành có giám sát';
    case 'muc': return `${!o.practiced && n.practiced ? 'Thực hành có giám sát · ' : ''}Mức đạt ${o.level ? lv(o.level) + ' → ' : ''}${lv(n.level)}${wait}`;
    case 'xac_nhan': return `✓ Xác nhận đạt · ${o.level && o.level !== n.level ? `sửa ${lv(o.level)} → ${lv(n.level)}` : 'mức ' + lv(n.level)}`;
    case 'bo_tich': return `Bỏ tích ${o.introduced && !n.introduced ? 'giới thiệu' : o.practiced && !n.practiced ? 'thực hành' : 'mức đạt'}${o.level ? ` (trước đó mức ${lv(o.level)})` : ''}`;
    case 'dao_tao_lai': return `↻ Đào tạo lại${l.gd2 ? ' (giai đoạn 2)' : ''} · ${lv(o.level)} → ${lv(n.level)}${wait}`;
    case 'ghi_cu': return `Ghi trước khi có sổ lịch sử: ${n.level ? 'mức ' + lv(n.level) : n.practiced ? 'đã thực hành' : 'đã giới thiệu'}`;
    default: return l.kind;
  }
};
const nowText = (i) => (i.pending ? `⏳ Chờ kiểm tra · ${LEVEL[i.level] || i.level}` : i.level ? `Đạt · ${LEVEL[i.level] || i.level}`
  : i.practiced ? 'Đã thực hành' : i.introduced ? 'Đã giới thiệu' : 'Chưa giới thiệu');

export async function render({ params }) {
  const id = Number(params.id);
  const [T, H] = await Promise.all([rpc('app_dt_get', { p_id: id }),
    rpc('app_dt_history', { p_id: id }).then((h) => ({ log: h?.log || [], notes: h?.notes || [], ok: true }), () => ({ log: [], notes: [], ok: false }))]);
  const PROG = T.program.code || 'chay_ban';
  let guided = []; try { guided = (await rpc('app_dt_guide_items', { p_program: PROG })) || []; } catch (_) { /* chưa có sổ tay */ }
  const hasGuide = new Set(guided.map(Number));
  const opt = T.can_admin ? await rpc('app_dt_options') : null;
  const ed = !!T.can_edit;
  const followups = new Map((T.followups || []).map((f) => [f.no, f]));
  // tệp 188 (anh Tiến chốt 27/11): mục ĐÃ xác nhận đạt thì nhân viên Cấp 1 không sửa nữa — trừ khi đang được giao giai đoạn 2 của mục đó
  const cap1Locked = (no) => {
    if (!T.cap1_lock) return false;
    const it = (T.items || []).find((x) => x.no === no); const a = followups.get(no);
    return !!(it && it.level && !it.pending) && !(a?.mine && a.is_extra && !a.finished_at);
  };
  const canMark = (no) => {
    const assignment = followups.get(no);
    return !T.workflow_review_at && !cap1Locked(no) && (ed || (assignment?.mine && (!assignment.is_extra || !assignment.finished_at)));
  };
  const adm = !!T.can_admin;
  // bước 169: người phụ trách chính hoặc Chủ (anh chốt 20/11 — người có quyền Đào tạo không còn đổi được) chọn / đổi người hướng dẫn chính — danh sách Quản lý có tài khoản đang hoạt động
  const pickHdc = !!T.can_pick_hdc && T.status !== 'hoan_thanh';
  const hdcList = T.hdc_choices || [];
  const canAssign = T.can_assign && T.status !== 'hoan_thanh';
  const days = T.program.days;
  const items = T.items;
  const itemByNo = new Map(items.map((i) => [i.no, i]));
  const cnt = (lv) => items.filter((i) => i.level === lv).length;
  const dlog = (d) => T.days_log[String(d)] || {};
  const empName = (id) => { const e = opt?.employees.find((x) => x.id === id); return e ? `${e.code} – ${e.name}` : ''; };

  // ---- chặng 4: lịch sử theo ngày thật
  const kept = keep.get(T.id); keep.delete(T.id);
  const fresh = kept && Date.now() - kept.t < 15000 ? kept : null;
  const logs = H.log.slice();
  // hạng mục có số liệu mà sổ chưa có dòng nào (không tải được sổ) → 1 dòng "ghi trước khi có sổ" theo lần ghi gần nhất
  const logged = new Set(logs.map((l) => l.no));
  items.forEach((i) => {
    if (logged.has(i.no) || !(i.introduced || i.level)) return;
    logs.push({ no: i.no, at: i.at || '', day: /^\d{4}-\d{2}-\d{2}/.test(i.at || '') ? i.at.slice(0, 10) : 'cu', by: i.by, kind: 'ghi_cu', old: null,
      new: { introduced: i.introduced, practiced: i.practiced, level: i.level }, pending: !!i.pending });
  });
  const dayKeys = [...new Set(logs.map((l) => l.day))].sort((a, b) => (a === b ? 0 : a === 'cu' ? -1 : b === 'cu' ? 1 : a < b ? -1 : 1));
  const realDays = dayKeys.filter((d) => d !== 'cu');
  const dayNo = new Map(realDays.map((d, k) => [d, k + 1]));
  const linesOf = new Map(dayKeys.map((d) => [d, logs.filter((l) => l.day === d)]));
  const lastDay = new Map(); dayKeys.forEach((d) => linesOf.get(d).forEach((l) => lastDay.set(l.no, d)));   // ngày gần nhất có hoạt động
  const notes = new Map(H.notes.map((n) => [n.day, n]));
  const nextSet = new Set(items.filter((i) => !i.level).map((i) => i.no));
  (fresh?.next || []).forEach((no) => nextSet.add(no));   // vừa chấm xong ở tab Ngày tiếp theo: hàng vẫn nằm đó tới lần mở phiếu sau
  const home = (no) => (nextSet.has(no) ? 'next' : lastDay.get(no) || 'cu');
  const today = vnToday();
  const left = items.filter((i) => !i.level).length;
  const tabKeys = [...dayKeys, 'next'];
  const tabName = (k) => (k === 'next' ? 'Ngày tiếp theo' : k === 'cu' ? 'Trước khi có sổ' : `Ngày ${dayNo.get(k)} · ${ddmm(k)}`);
  let cur = fresh && tabKeys.includes(fresh.tab) ? fresh.tab : left || !dayKeys.length ? 'next' : dayKeys[dayKeys.length - 1];

  const histList = (i, lines) => {
    const p = lines.filter((l) => l.pending).pop();
    const x = p && logs.find((l) => l.no === i.no && l.kind === 'xac_nhan' && l.at > p.at && l.day !== p.day);   // xác nhận đạt vào ngày khác
    return html`<ul class="dt-hl">${lines.map((l) => html`<li><span class="dt-hl-t">${hm(l.at) || '—'}</span> ${histText(l)} <span class="st-meta">· ${l.by || '—'}</span></li>`)}
      ${x ? html`<li class="st-meta">→ ${x.by || '—'} xác nhận đạt ${dt(x.at)}</li>` : ''}</ul>`;
  };

  const itemRow = (i, lines) => {
    const edit = canMark(i.no);
    const extra = followups.get(i.no);
    const pending = extra?.is_extra && !extra.finished_at;
    const chk = !!i.pending;   // bước 169: Chờ kiểm tra — chưa tính đạt
    return html`<div class="dt-item ${i.level && !chk ? 'done' : ''} ${chk ? 'dt-chk' : ''}" data-no="${i.no}" data-phase-two="${pending ? '1' : '0'}" data-check="${chk ? '1' : '0'}">
    <div class="dt-it-title">${hasGuide.has(i.no) ? html`<button type="button" class="it-guide" data-no="${i.no}" title="Mở hướng dẫn trong sổ tay"><strong>${i.no}.</strong> ${i.title} <span class="it-book">📖 Hướng dẫn</span></button>`
      : html`<strong>${i.no}.</strong> ${i.title}`} <span class="st-meta">Tr. ${i.page}</span></div>
    <div class="toolbar" style="gap:6px">
      <span class="st-meta dt-item-guide" style="overflow-wrap:anywhere">Người hướng dẫn: <strong>${extra?.name || T.instructor || 'Chưa phân công'}</strong>${extra?.name ? ' · Phân công riêng' : ''}</span>
      <span class="st-meta dt-item-branch">Cơ sở: <strong>${extra?.branch || T.branch || 'Chưa chọn'}</strong></span>
      ${canAssign ? html`<button type="button" class="btn sm secondary" data-dt-guide-person="${i.no}" aria-label="Đổi người hướng dẫn và cơ sở hạng mục ${i.no}">Đổi phân công</button>` : ''}
      ${canAssign && T.helpers?.length ? html`<button type="button" class="btn sm secondary" data-dt-guide-person="${i.no}" data-dt-phase="2"
        ${pending || needsMorePractice(i.level) ? '' : 'hidden'}>${pending ? 'Giao lại giai đoạn 2' : 'Giao giai đoạn 2'}</button>` : ''}
    </div>
    ${extra?.is_extra || extra?.phase2_done_at ? html`<div class="st-meta" style="overflow-wrap:anywhere">
      <strong>${pending ? 'Đang luyện giai đoạn 2' : 'Đã đánh giá giai đoạn 2'}</strong>${extra.note ? ' · ' + extra.note : ''}
    </div>` : ''}
    ${chk ? html`<div class="dt-chkbox"><span class="pill warn">⏳ Chờ kiểm tra</span> <span class="st-meta">${i.pending_by || ''} ghi mức <b>${LEVEL[i.level] || i.level}</b>${i.pending_at ? ' · ' + dt(i.pending_at) : ''} — chưa tính đạt</span>
      ${T.can_check && !T.workflow_review_at ? html`<span class="dt-chkact"><select class="input sm it-chk-lv" aria-label="Mức xác nhận hạng mục ${i.no}">${Object.entries(LEVEL).map(([k, l]) => html`<option value="${k}" ${i.level === k ? 'selected' : ''}>${l}</option>`)}</select><button type="button" class="btn sm it-check" data-no="${i.no}">Xác nhận đạt</button></span>` : ''}</div>` : ''}
    <div class="dt-it-ctl">
      <label><input type="checkbox" class="check it-intro" ${i.introduced ? 'checked' : ''} ${edit ? '' : 'disabled'}> Giới thiệu</label>
      <label><input type="checkbox" class="check it-prac" ${i.practiced ? 'checked' : ''} ${edit && i.introduced ? '' : 'disabled'}> Thực hành</label>
      <select class="input sm it-level" aria-label="Mức đạt hạng mục ${i.no}" ${edit && i.introduced && i.practiced ? '' : 'disabled'}>
        <option value="" disabled ${!i.level ? 'selected' : ''}>— Mức đạt —</option>${Object.entries(LEVEL).map(([k, l]) => html`<option value="${k}" ${i.level === k ? 'selected' : ''}>${l}</option>`)}</select>
      <span class="st-meta it-by">${i.at ? `${i.by} · ${dt(i.at)}` : ''}</span>
      ${cap1Locked(i.no) ? html`<span class="st-meta it-lock">🔒 Đã xác nhận đạt — muốn đổi thì nhờ người hướng dẫn chính</span>` : ''}
      ${edit && pending && i.level && (extra.mine || adm) ? html`<button type="button" class="btn sm secondary it-finish-phase">Lưu mức hiện tại</button>` : ''}
      ${edit && i.level ? html`<button type="button" class="btn sm secondary it-relearn" title="Dạy lại hạng mục này rồi chọn mức mới — lưu vào lịch sử kể cả khi mức không đổi">↻ Đào tạo lại</button>` : ''}
    </div>
    ${lines ? histList(i, lines) : ''}</div>`; };

  // thẻ lịch sử chỉ xem: hạng mục có hoạt động trong ngày nhưng hàng để sửa nằm ở tab khác
  const histCard = (i, lines, d) => {
    const h = home(i.no);
    const again = [...new Set(logs.filter((l) => l.no === i.no && l.kind === 'dao_tao_lai' && l.day !== 'cu' && l.day > d).map((l) => ddmm(l.day)))];
    return html`<div class="dt-hcard" data-no="${i.no}">
      <div class="dt-it-title"><strong>${i.no}.</strong> ${i.title} <span class="st-meta">Tr. ${i.page}</span></div>
      ${histList(i, lines)}
      <div class="st-meta dt-now">Hiện tại: <b>${nowText(i)}</b>${again.length ? ` · đào tạo lại ngày ${again.join(', ')}` : ''}
        <button type="button" class="dt-goto" data-tab="${h}" data-no="${i.no}">Xem ở ${tabName(h)} ›</button></div></div>`;
  };

  // nhận xét + hai lần xác nhận của MỘT ngày thật (tệp 163)
  const dayNote = (d) => {
    const n = notes.get(d) || {}; const lock = !!T.workflow_review_at;
    return html`<div class="dt-dnote stack" style="gap:6px">
      <label class="stack" style="gap:4px"><span class="pc-sub">NHẬN XÉT CỦA NGƯỜI HƯỚNG DẪN · ${dmy(d)}</span>
        <textarea class="input day-cmt" data-day="${d}" rows="2" ${ed && !lock ? '' : 'disabled'}>${n.comment || ''}</textarea></label>
      ${n.comment && n.comment_by ? html`<div class="st-meta">Ghi bởi ${n.comment_by}${n.comment_at ? ' · ' + dt(n.comment_at) : ''}</div>` : ''}
      <div class="dt-confirm">
        <button type="button" class="btn sm ${n.trainee_at ? '' : 'secondary'} day-ok" data-day="${d}" data-who="nv" data-on="${n.trainee_at ? 0 : 1}" ${T.is_trainee && !lock ? '' : 'disabled'}>${n.trainee_at ? `✓ Nhân viên đã xác nhận · ${n.trainee_by || ''} · ${dt(n.trainee_at)}` : 'Nhân viên xác nhận'}</button>
        <button type="button" class="btn sm ${n.instructor_at ? '' : 'secondary'} day-ok" data-day="${d}" data-who="hd" data-on="${n.instructor_at ? 0 : 1}" ${ed && !lock ? '' : 'disabled'}>${n.instructor_at ? `✓ Người hướng dẫn đã xác nhận · ${n.instructor_by || ''} · ${dt(n.instructor_at)}` : 'Người hướng dẫn xác nhận'}</button>
      </div></div>`;
  };

  const dayPane = (d) => {
    const L = linesOf.get(d); const nos = [...new Set(L.map((l) => l.no))].sort((a, b) => a - b);
    const who = [...new Set(L.map((l) => l.by).filter(Boolean))];
    return html`<section class="dt-pane" data-pane="${d}" role="tabpanel" ${d === cur ? '' : 'hidden'}>
      <div class="dt-pane-h"><strong>${d === 'cu' ? 'Ghi trước khi có sổ lịch sử (không rõ ngày)' : `Ngày ${dayNo.get(d)} · ${dmy(d)}${d === today ? ' · hôm nay' : ''}`}</strong>
        <span class="st-meta">${nos.length} hạng mục${who.length ? ' · người tích: ' + who.join(', ') : ''}</span></div>
      ${nos.map((no) => { const i = itemByNo.get(no); if (!i) return ''; const ln = L.filter((l) => l.no === no); return home(no) === d ? itemRow(i, ln) : histCard(i, ln, d); })}
      ${d !== 'cu' && H.ok ? dayNote(d) : ''}
    </section>`;
  };

  const nextPane = () => {
    const groups = days.map((dd) => ({ dd, its: items.filter((i) => i.day === dd.day && nextSet.has(i.no)) })).filter((g) => g.its.length);
    return html`<section class="dt-pane" data-pane="next" role="tabpanel" ${cur === 'next' ? '' : 'hidden'}>
      <div class="dt-pane-h"><strong>Ngày tiếp theo</strong> <span class="st-meta">hạng mục chưa có mức đạt · xếp theo sườn 8 ngày (sườn chỉ là gợi ý)</span></div>
      ${groups.length ? groups.map((g) => html`<div class="dt-grp" data-grp="${g.dd.day}">
          <div class="dt-grp-h"><span class="pc-sub">SƯỜN NGÀY ${g.dd.day}</span> <span class="st-meta">${g.dd.title}</span></div>
          ${g.dd.note ? html`<div class="st-meta">${g.dd.note}</div>` : ''}
          ${g.its.map((i) => itemRow(i))}</div>`)
        : html`<div class="st-meta">Mọi hạng mục đã có mức đạt.</div>`}
    </section>`;
  };

  const tb = items.filter((i) => i.level === 'tb').map((i) => i.no);
  const day8 = days.some((dd) => dd.day === 8) ? html`<section class="card stack" style="gap:10px" id="dt-day8">
      <div class="pc-sub">NGÀY 8 CỦA SƯỜN · CA LÀM ĐỘC LẬP</div>
      <div class="pc-grid">
        <label class="pc-f"><span>Ca làm độc lập</span><select class="input info-f" data-f="day8_shift" ${ed ? '' : 'disabled'}><option value="">—</option>${['Sáng', 'Chiều', 'Tối'].map((s) => html`<option ${T.day8_shift === s ? 'selected' : ''}>${s}</option>`)}</select></label>
        <label class="pc-f"><span>Ngày</span><input class="input info-f" type="date" data-f="day8_date" value="${T.day8_date || ''}" ${ed ? '' : 'disabled'}></label></div>
      <label class="pc-f"><span>Hạng mục ôn lại (ghi STT)</span><input class="input info-f" data-f="day8_review" value="${T.day8_review || ''}" placeholder="${tb.length ? 'Gợi ý — đang ở mức Trung bình: ' + tb.join(', ') : 'vd: 12, 31, 45'}" ${ed ? '' : 'disabled'}></label>
    </section>` : '';
  // nhận xét / xác nhận theo ngày giáo trình đã ghi trước chặng 4: chỉ xem
  const oldDays = days.filter((dd) => { const l = dlog(dd.day); return l.comment || l.trainee_at || l.instructor_at; });
  const oldBox = oldDays.length ? html`<details class="card dt-old"><summary>Nhận xét / xác nhận theo ngày giáo trình (trước khi đổi) · ${oldDays.length} ngày</summary>
      <div class="stack" style="gap:8px;margin-top:8px">${oldDays.map((dd) => { const l = dlog(dd.day); return html`<div class="dt-oldday"><strong>Ngày ${dd.day} – ${dd.title}</strong>
        ${l.comment ? html`<div style="white-space:pre-wrap;overflow-wrap:anywhere">${l.comment}</div>` : ''}
        <div class="st-meta">${l.trainee_at ? `✓ Nhân viên đã xác nhận ${dt(l.trainee_at)}` : 'Nhân viên chưa xác nhận'} · ${l.instructor_at ? `✓ Người hướng dẫn đã xác nhận ${dt(l.instructor_at)}` : 'Người hướng dẫn chưa xác nhận'}</div></div>`; })}</div></details>` : '';

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
        ${trainingWork(T)}
        <section class="card stack" style="gap:10px">
          <div class="dt-prog"><div class="dt-bar"><div id="dt-bar" style="width:${Math.round((T.achieved / T.total) * 100)}%"></div></div><strong><span id="dt-ach">${T.achieved}</span>/${T.total} hạng mục đạt</strong></div>
          <div class="pc-grid">
            ${!T.due ? html`<label class="pc-f"><span>Cơ sở</span>${adm ? html`<select class="input info-f" data-f="branch_id"><option value="">—</option>${opt.branches.map((b) => html`<option value="${b.id}" ${b.id === T.branch_id ? 'selected' : ''}>${b.code}</option>`)}</select>` : html`<div class="pc-fixed">${T.branch || '—'}</div>`}</label>` : ''}
            <label class="pc-f"><span>Ngày bắt đầu</span>${adm ? html`<input class="input info-f" type="date" data-f="start_date" value="${T.start_date}">` : html`<div class="pc-fixed">${dmy(T.start_date)}</div>`}</label>
            <label class="pc-f"><span>Người hướng dẫn chính</span>${pickHdc ? html`<select class="input" id="dt-hdc" aria-label="Người hướng dẫn chính"><option value="" ${T.instructor_id ? '' : 'selected'} disabled>— Chọn quản lý —</option>${hdcList.map((e) => html`<option value="${e.id}" ${e.id === T.instructor_id ? 'selected' : ''}>${e.code} – ${e.name}</option>`)}</select>` : html`<div class="pc-fixed">${T.instructor || '—'}</div>`}</label>
            <label class="pc-f"><span>Người phụ trách chính</span><div class="pc-fixed">${T.ptc || 'Chủ chưa chọn'}</div></label>
          </div>
          ${adm ? html`<datalist id="dt-emps">${opt.employees.map((e) => html`<option value="${e.code} – ${e.name}"></option>`)}</datalist>` : ''}
          <div class="st-meta">Giao hạng mục: chỉ người hướng dẫn chính của phiếu, người phụ trách chính hoặc Chủ. Nhân viên cấp 1 ghi mức đạt → <b>Chờ kiểm tra</b>, người hướng dẫn chính hoặc người phụ trách chính bấm <b>Xác nhận đạt</b> mới tính đạt.</div>
          <div class="st-meta">Mỗi hạng mục đi đủ 3 bước: Đã giới thiệu → Đã thực hành có giám sát → Mức đạt (Trung bình / Khá / Tốt — cả 3 mức đều tính là đạt). Hệ thống ghi người và ngày xác nhận thay cho chữ ký.</div>
          ${T.tasks.length ? html`<div><span class="pc-sub">NHIỆM VỤ ĐÀO TẠO ĐƯỢC GIAO (TAB CÔNG VIỆC)</span>${T.tasks.map((k) => html`<div class="st-meta">• ${k.content} — ${k.assignee || 'chưa giao'} · <span class="pill ${TASK_STATUS[k.status][1]}">${TASK_STATUS[k.status][0]}</span>${k.due_date ? ' · hạn ' + dmy(k.due_date) : ''}</div>`)}</div>` : ''}
        </section>
        <section class="card stack dt-days" style="gap:10px">
          <div class="toolbar" style="gap:8px;align-items:flex-end">
            <label class="pc-f"><span>Lọc hạng mục</span>
              <select class="input" id="dt-item-filter">
                ${Object.entries(ITEM_FILTERS).map(([key, label]) => html`<option value="${key}" ${(itemFiltersBySheet.get(T.id) || 'all') === key ? 'selected' : ''}>${label}</option>`)}
              </select>
            </label>
            <span class="st-meta" id="dt-item-filter-count" role="status"></span>
          </div>
          ${H.ok ? '' : html`<div class="alert warn">Chưa tải được lịch sử theo ngày — phiếu vẫn chấm được. Tải lại trang để xem lịch sử.</div>`}
          <div class="dt-tabs" id="dt-tabs" role="tablist" aria-label="Phiếu theo ngày đào tạo thật">
            ${tabKeys.map((k) => html`<button type="button" class="dt-tab ${k === cur ? 'on' : ''}" role="tab" data-tab="${k}" aria-selected="${k === cur ? 'true' : 'false'}">${tabName(k)}${k === 'next' ? html` · <span class="dt-left">còn ${left}</span>` : k === today ? ' · hôm nay' : ''}</button>`)}
          </div>
          <div class="st-meta" id="dt-filter-note" hidden>Đang lọc: hiện mọi hạng mục khớp, xếp theo ngày. Chọn “Tất cả” để xem lại theo tab.</div>
          ${dayKeys.map(dayPane)}
          ${nextPane()}
        </section>
        ${day8}
        ${oldBox}
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
          <div><span class="pill ${DT_STATUS[st][1]}">${dtLabel(T)}</span></div>
          ${st !== 'hoan_thanh' && !T.due ? html`<div class="pc-sub">E. ĐÀO TẠO TIẾP</div>
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
    mount(root) {
      bindTrainingWork(root, T, rerender);
      let dirty = false;   // đã lưu thêm từ lúc vẽ phiếu → mở tab một ngày thì tải lại lịch sử
      // vẽ lại phiếu nhưng giữ tab đang xem, chỗ đang cuộn và các hàng của tab Ngày tiếp theo
      const refresh = async ({ tab = cur, top = false } = {}) => {
        keep.set(T.id, { t: Date.now(), tab, next: [...nextSet] });
        const y = window.scrollY;
        await rerender();
        window.scrollTo(0, y);
        const bar = document.getElementById('dt-tabs');
        if (top && bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start' });
      };
      $$('[data-dt-guide-person]', root).forEach((button) => button.addEventListener('click', onItemGuide));
      function onItemGuide(event) {
        const button = event.target.closest('[data-dt-guide-person]');
        if (!button) return;
        const no = Number(button.dataset.dtGuidePerson);
        const item = items.find((i) => i.no === no);
        if (!item) return;
        openItemGuide(T, item, followups.get(no), async () => {
          await refresh();
          const row = $(`.dt-item[data-no="${no}"]`);
          if (row && !row.hidden && !row.closest('.dt-pane')?.hidden) row.scrollIntoView({ block: 'nearest' });
        }, button.dataset.dtPhase === '2');
      }
      // ---- tab theo ngày + bộ lọc hạng mục
      const tabs = $('#dt-tabs', root);
      const filter = $('#dt-item-filter', root);
      const panes = $$('.dt-pane', root);
      const stageOf = (row) => (row.dataset.check === '1' ? 'check' : row.dataset.phaseTwo === '1' ? 'phase2' : row.classList.contains('done') ? 'done' : $('.it-intro', row).checked ? 'introduced' : 'new');
      const applyView = () => {
        const f = filter.value; const on = f !== 'all'; let count = 0;
        tabs.hidden = on; $('#dt-filter-note', root).hidden = !on;
        panes.forEach((pane) => {
          let m = 0;
          $$('.dt-item', pane).forEach((row) => {
            row.hidden = on && (f.startsWith('lv_') ? $('.it-level', row).value !== f.slice(3) : f !== stageOf(row));
            if (!row.hidden) m++;
          });
          $$('.dt-hcard, .dt-dnote, .dt-hl', pane).forEach((x) => { x.hidden = on; });   // đang lọc: chỉ hiện hàng để sửa
          $$('.dt-grp', pane).forEach((g) => { g.hidden = on && !$$('.dt-item', g).some((r) => !r.hidden); });
          pane.hidden = on ? m === 0 : pane.dataset.pane !== cur;
          count += m;
        });
        $('#dt-item-filter-count', root).textContent = on ? (count ? `${count}/${items.length} hạng mục` : 'Không có hạng mục phù hợp') : '';
        const n = $('.dt-left', root); if (n) n.textContent = `còn ${$$('.dt-item', root).filter((r) => !$('.it-level', r).value).length}`;
      };
      const centerTab = () => { const on = $('.dt-tab.on', root); if (on) tabs.scrollLeft = on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2; };
      const showTab = async (k) => {
        if (k !== 'next' && dirty) { await refresh({ tab: k, top: true }); return; }
        cur = k;
        $$('.dt-tab', root).forEach((b) => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        applyView(); centerTab();
        if (tabs.getBoundingClientRect().top < 0) tabs.scrollIntoView({ block: 'start' });
      };
      tabs.addEventListener('click', (ev) => { const b = ev.target.closest('.dt-tab'); if (b) showTab(b.dataset.tab); });
      $('.dt-days', root).addEventListener('click', async (ev) => {   // "Xem ở Ngày … ›" trên thẻ lịch sử → sang tab có hàng để sửa
        const g = ev.target.closest('.dt-goto'); if (!g) return;
        await showTab(g.dataset.tab);
        const row = $(`.dt-item[data-no="${g.dataset.no}"]`);
        if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('dt-flash'); setTimeout(() => row.classList.remove('dt-flash'), 1600); }
      });
      // lưu xong ở ngày chưa có tab (thường là hôm nay) → thêm tab tạm, bấm vào thì tải lại lịch sử
      const addDayTab = (at) => {
        const d = String(at || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || $(`.dt-tab[data-tab="${d}"]`, root)) return;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'dt-tab dt-tab-new'; b.dataset.tab = d; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
        b.textContent = `Ngày ${realDays.length + 1} · ${ddmm(d)}${d === today ? ' · hôm nay' : ''}`;
        $('.dt-tab[data-tab="next"]', root).before(b);
      };
      filter.addEventListener('change', () => {
        if (filter.value === 'all') itemFiltersBySheet.delete(T.id);
        else itemFiltersBySheet.set(T.id, filter.value);
        applyView();
      });
      applyView(); centerTab();
      const saveInfo = async (p) => { try { await rpc('app_dt_update', { p_id: T.id, p }); showSaved('Đã lưu · ' + hhmm()); return true; } catch (e) { showSaved(e.message, true); return false; } };
      $$('.info-f').forEach((el) => el.addEventListener('change', async () => { if (await saveInfo({ [el.dataset.f]: el.value || null }) && ['start_date', 'cont_trainer_kind'].includes(el.dataset.f)) refresh(); }));
      $$('.emp-f').forEach((el) => el.addEventListener('change', async () => {
        const q = el.value.trim().toLowerCase(); const code = q.split(/\s*[–-]\s*/)[0];
        const main = el.dataset.f === 'instructor_id';   // bước 139: người hướng dẫn chính chỉ là Quản lý
        const pool = main ? opt.employees.filter((x) => x.rank === 'Quản lý') : opt.employees;
        const e = q ? (pool.find((x) => `${x.code} – ${x.name}`.toLowerCase() === q) || pool.find((x) => String(x.code).toLowerCase() === code)) : null;
        if (q && !e) { showSaved(main ? 'Người hướng dẫn chính phải là nhân viên cấp Quản lý. Chọn trong danh sách gợi ý.' : 'Không tìm thấy nhân viên. Chọn trong danh sách gợi ý.', true); return; }
        await saveInfo({ [el.dataset.f]: e ? e.id : null });
      }));
      $('#dt-hdc')?.addEventListener('change', async (ev) => {
        const sel = ev.target; sel.disabled = true;
        try { await rpc('app_dt_instructor_save', { p_id: T.id, p_employee: Number(sel.value) }); flash('Đã đổi người hướng dẫn chính.'); refresh(); }
        catch (e) { showSaved(e.message, true); sel.disabled = false; sel.value = String(T.instructor_id || ''); }
      });
      $$('.it-check').forEach((b) => b.addEventListener('click', once(async () => {
        const lv = b.closest('.dt-chkbox')?.querySelector('.it-chk-lv')?.value || null;
        try { await rpc('app_dt_check_ok', { p_id: T.id, p_no: Number(b.dataset.no), p_level: lv }); flash('Đã xác nhận đạt.'); refresh(); }
        catch (e) { showSaved(e.message, true); }
      })));
      $('#cont-ok')?.addEventListener('change', (ev) => saveInfo({ cont_result: ev.target.checked ? 'dat' : null }));
      // nhận xét + xác nhận theo NGÀY THẬT (tệp 163)
      $$('.day-cmt', root).forEach((el) => el.addEventListener('change', async () => {
        try { await rpc('app_dt_dnote_comment', { p_id: T.id, p_day: el.dataset.day, p_comment: el.value }); showSaved('Đã lưu · ' + hhmm()); } catch (e) { showSaved(e.message, true); }
      }));
      $$('.day-ok', root).forEach((b) => b.addEventListener('click', once(async () => {
        try { await rpc('app_dt_dnote_confirm', { p_id: T.id, p_day: b.dataset.day, p_who: b.dataset.who, p_on: b.dataset.on === '1' }); refresh(); } catch (e) { showSaved(e.message, true); }
      })));
      // hộp chọn mức: tích Thực hành, hoặc Đào tạo lại
      const levelPicker = (item, { id: fid, title, hint }) => dialog(html`<form method="dialog" id="${fid}" class="d-body stack" style="gap:12px">
          <h3 style="margin:0">${title}</h3>
          <div>${item.no}. ${item.title}</div>
          ${hint ? html`<div class="st-meta">${hint}</div>` : ''}
          <div class="toolbar">
            ${Object.entries(LEVEL).map(([value, label]) => html`<button type="submit" class="btn" value="${value}">${label}</button>`)}
            <button type="submit" class="btn secondary" data-cancel value="" autofocus>Hủy</button>
          </div>
        </form>`);
      // Lưu từng thao tác và khôi phục cả hàng nếu máy chủ từ chối.
      $$('.dt-item').forEach((row) => {
        const no = Number(row.dataset.no);
        if (!canMark(no)) return;
        const intro = row.querySelector('.it-intro'), prac = row.querySelector('.it-prac');
        const lv = row.querySelector('.it-level');
        const phaseButton = row.querySelector('[data-dt-phase="2"]');
        const finishPhase = row.querySelector('.it-finish-phase');
        const relearn = row.querySelector('.it-relearn');
        let saved = { introduced: intro.checked, practiced: prac.checked, level: lv.value || null };
        const sync = (pending) => {
          intro.disabled = pending;
          prac.disabled = pending || !intro.checked;
          lv.disabled = pending || !(intro.checked && prac.checked);
          row.classList.toggle('done', !!lv.value && row.dataset.check !== '1');
          if (phaseButton) {
            phaseButton.disabled = pending;
            phaseButton.hidden = row.dataset.phaseTwo !== '1' && !needsMorePractice(lv.value);
          }
          if (finishPhase) finishPhase.disabled = pending || !lv.value;
          if (relearn) relearn.disabled = pending || !lv.value;
        };
        const send = async (more) => {
          const p = { introduced: intro.checked, practiced: prac.checked, level: lv.value || null };
          sync(true);
          applyView();
          try {
            const r = await rpc('app_dt_mark', { p_id: T.id, p_no: no, p: more ? { ...p, ...more } : p });
            saved = p;
            row.querySelector('.it-by').textContent = `${r.by} · ${dt(r.at)}`;
            const ach = $('#dt-ach');
            ach.textContent = r.achieved;
            $('#dt-bar').style.width = `${Math.round(r.achieved / T.total * 100)}%`;
            dirty = true; addDayTab(r.at);
            const pane = row.closest('.dt-pane')?.dataset.pane;
            // bước 169: vào / ra Chờ kiểm tra → vẽ lại; chặng 4: sửa ở tab một ngày → vẽ lại để thấy dòng lịch sử mới
            if (r.status !== T.status || (p.level && row.dataset.phaseTwo === '1') || !!r.pending !== (row.dataset.check === '1') || pane !== 'next') {
              const d = String(r.at || '').slice(0, 10);
              if (pane && pane !== 'next' && d && pane !== d) flash(`Đã lưu. Lần dạy này thuộc ngày ${ddmm(d)} — hạng mục ${no} chuyển sang tab của ngày đó.`);
              else if (more?.relearn) flash(`Đã lưu đào tạo lại hạng mục ${no}.`);
              refresh();
              return;
            }
            showSaved('Đã lưu · ' + hhmm());
          } catch (e) {
            intro.checked = saved.introduced;
            prac.checked = saved.practiced;
            lv.value = saved.level || '';
            showSaved(e.message, true);
          } finally {
            sync(false);
            if (row.isConnected) applyView();
          }
        };
        intro.addEventListener('change', () => {
          if (!intro.checked) { prac.checked = false; lv.value = ''; }
          send();
        });
        prac.addEventListener('change', () => {
          if (!prac.checked) {
            lv.value = '';
            send();
            return;
          }
          prac.checked = false;
          const picker = levelPicker(itemByNo.get(no), { id: 'dt-practice-level', title: 'Chọn mức đạt' });
          picker.addEventListener('close', () => {
            if (!row.isConnected || !Object.hasOwn(LEVEL, picker.returnValue)) return;
            prac.checked = true;
            lv.value = picker.returnValue;
            send();
          }, { once: true });
        });
        lv.addEventListener('change', () => send());
        finishPhase?.addEventListener('click', () => send());
        // chặng 4: đào tạo lại — luôn thành một dòng lịch sử, kể cả khi ra đúng mức cũ
        relearn?.addEventListener('click', () => {
          const picker = levelPicker(itemByNo.get(no), { id: 'dt-relearn-level', title: '↻ Đào tạo lại', hint: 'Dạy lại xong, chọn mức đạt sau buổi này. Giữ nguyên mức cũ cũng được — vẫn lưu vào lịch sử của hôm nay.' });
          picker.addEventListener('close', () => {
            if (!row.isConnected || !Object.hasOwn(LEVEL, picker.returnValue)) return;
            intro.checked = true; prac.checked = true;
            lv.value = picker.returnValue;
            send({ relearn: true });
          }, { once: true });
        });
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
      $('#dt-del')?.addEventListener('click', once(async () => {
        if (!confirm(`Xóa hẳn phiếu đào tạo của ${T.employee.code} – ${T.employee.name}? Mọi kết quả đã ghi sẽ mất.`)) return;
        try { await rpc('app_dt_delete', { p_id: T.id }); flash('Đã xóa phiếu đào tạo.'); go('/quan-ly/nhan-vien'); } catch (e) { showSaved(e.message, true); }
      }));
    },
  };
}

const STYLE = html`<style>
  .dt-item[hidden], [data-dt-phase][hidden], .dt-days [hidden] { display: none !important; }
  .dt-chkbox { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; margin: 4px 0; border: 1px dashed #d99a3a; border-radius: 8px; background: #fff7e6; overflow-wrap: anywhere; }
  .dt-chkact { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; } .dt-chkact .btn, .dt-chkact select { width: auto; }
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
  .dt-item { border: 1px solid var(--line-soft); border-left: 4px solid #fca5a5; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
  .dt-item.done { border-left-color: var(--ok-line); }
  .dt-it-ctl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
  .dt-it-ctl label { display: inline-flex; gap: 4px; align-items: center; }
  .dt-it-ctl select { width: 150px; }
  .dt-confirm { display: flex; gap: 8px; flex-wrap: wrap; }
  .dt-confirm .btn { white-space: normal; height: auto; min-height: 36px; text-align: left; overflow-wrap: anywhere; }
  /* chặng 4: tab theo ngày thật */
  .dt-tabs { position: relative; display: flex; gap: 2px; overflow-x: auto; border-bottom: 2px solid var(--line); scrollbar-width: thin; }
  .dt-tab { all: unset; box-sizing: border-box; cursor: pointer; white-space: nowrap; padding: 10px 12px; font-weight: 600; font-size: 14px; color: var(--ink-2); border-bottom: 3px solid transparent; margin-bottom: -2px; border-radius: 8px 8px 0 0; }
  .dt-tab:hover { background: var(--line-soft); }
  .dt-tab.on { color: var(--primary); border-bottom-color: var(--primary); background: #fff; }
  .dt-tab:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
  .dt-tab-new { font-style: italic; }
  .dt-pane { display: flex; flex-direction: column; gap: 10px; }
  .dt-pane-h { display: flex; gap: 4px 8px; flex-wrap: wrap; align-items: baseline; }
  .dt-grp { display: flex; flex-direction: column; gap: 10px; }
  .dt-grp + .dt-grp { margin-top: 6px; }
  .dt-grp-h { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .dt-hcard { border: 1px dashed var(--line); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .dt-hl { list-style: none; margin: 0; padding: 6px 0 0; border-top: 1px dashed var(--line); display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
  .dt-hl li { overflow-wrap: anywhere; }
  .dt-hl-t { display: inline-block; min-width: 40px; font-variant-numeric: tabular-nums; color: var(--muted); }
  .dt-now { overflow-wrap: anywhere; }
  .dt-goto { all: unset; cursor: pointer; color: var(--primary); font-weight: 600; margin-left: 4px; white-space: nowrap; }
  .dt-goto:focus-visible { outline: 2px solid var(--primary); border-radius: 4px; }
  .dt-dnote { border-top: 2px solid var(--line); padding-top: 10px; }
  .dt-old summary { cursor: pointer; font-weight: 600; }
  .dt-oldday { border-left: 3px solid var(--line); padding: 2px 0 2px 10px; }
  .dt-flash { animation: dtfl 1.6s ease-out; }
  @keyframes dtfl { from { box-shadow: 0 0 0 3px var(--primary); } to { box-shadow: 0 0 0 0 transparent; } }
  .it-guide { all: unset; cursor: pointer; text-align: left; }
  .it-guide:hover { color: var(--primary); }
  .it-guide:focus-visible { outline: 2px solid var(--primary); border-radius: 4px; }
  .it-book { display: inline-block; font-size: 12px; font-weight: 600; color: var(--primary); background: var(--info-bg); border-radius: 999px; padding: 1px 8px; margin-left: 4px; white-space: nowrap; }
  dialog.dt-guide { padding: 0; border: 0; border-radius: 14px; width: calc(100vw - 16px); max-width: 760px; max-height: 92vh; overflow: hidden; }
  dialog.dt-guide::backdrop { background: rgba(15, 23, 42, .55); }
  .dg-wrap { display: flex; flex-direction: column; max-height: 92vh; }
  .dg-head, .dg-foot { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--subtle, #f3f4f6); }
  .dg-head { border-bottom: 1px solid var(--line); } .dg-foot { border-top: 1px solid var(--line); }
  .dg-body { overflow-y: auto; padding: 8px 16px 16px; flex: 1 1 auto; }
  .dg-sec + .dg-sec { border-top: 1px dashed var(--line); margin-top: 12px; padding-top: 10px; }
  .dg-full { display: inline-block; margin-top: 6px; font-weight: 600; font-size: 14px; }
</style>`;
