// Chốt lịch & báo cáo (bản offline): 7 tab + chốt/mở lại + xuất Excel
import { render as rerender, can } from '../app.js';
import { ST_CHOT, addDays, dmy, focusWeek, getWeek, hasPublished, parseWeekParam, statusLabel, vnToday, weekDays, weekLabel, weekStart } from '../data.js';
import { downloadXlsx } from '../excel.js';
import { rpc, sel } from '../sb.js';
import { $, flash, html, norm, raw } from '../ui.js';
import { loadReport } from '../reports.js';

export const perm = 'bao_cao';
const WARN_CATS = ['THIẾU TỔNG', 'THỪA TỔNG', 'LỆCH VỊ TRÍ', 'THIẾU CẤP 1+', 'XẾP CA ĐÃ NGHỈ', 'XẾP KHI CHƯA ORDER', 'LÀM THÔNG 3 CA', 'CHƯA CÓ CA'];
const TABS = [['lich', 'Xem lịch tuần'], ['canh-bao', 'Cảnh báo'], ['dinh-bien', 'Định biên'], ['nhan-vien', 'Nhân viên'], ['order', 'Order'], ['co-so', 'Cơ sở'], ['lich-su', 'Lịch 30 ngày']];
const roleCode = (r) => String(r || '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase();

export async function render({ params }) {
  let start = parseWeekParam(params.tuan);
  if (!start) { const fw = await focusWeek(); start = fw ? fw.start_date : weekStart(vnToday()); }
  const tab = TABS.some(([k]) => k === params.tab) ? params.tab : 'lich';
  const q = (k, v) => { const p = { tuan: start, tab, ...params, [k]: v }; return '#/quan-ly/bao-cao?' + new URLSearchParams(p).toString(); };
  const week = await getWeek(start);
  const cl = week ? (await sel('schedule_closures', '*', (b) => b.eq('week_id', week.id)))[0] : null;
  const days = weekDays(start);
  const head = html`<div class="page-head"><div><h1>Chốt lịch &amp; báo cáo <span id="st-pill"></span></h1>
      <div class="sub">Kiểm tra toàn bộ lịch sau khi đã xếp xong các cơ sở. Cảnh báo không chặn chốt lịch. Khi chốt, định biên hiện tại được lưu cùng tuần và nhân viên xem được lịch.</div></div>
    <div class="wk-nav"><a class="btn sm secondary" href="#/quan-ly/bao-cao?tuan=${addDays(start, -7)}&tab=${tab}">‹ Tuần trước</a><span class="wk-label">${weekLabel(start)}</span>
      <a class="btn sm secondary" href="#/quan-ly/bao-cao?tuan=${addDays(start, 7)}&tab=${tab}">Tuần sau ›</a></div></div>`;
  const tabsNav = html`<nav class="tabs-nav" aria-label="Mục báo cáo">${TABS.map(([k, l]) => html`<a href="#/quan-ly/bao-cao?tuan=${start}&tab=${k}" class="${tab === k ? 'on' : ''}">${l}</a>`)}</nav>`;

  if (tab === 'lich-su') {
    const cutoff = addDays(vnToday(), -30);
    const rows = await sel('schedule_closures', 'week_id, status, closed_at, updated_at');
    const weeks = rows.length ? await sel('weeks', '*', (b) => b.in('id', rows.map((r) => r.week_id)).gte('end_date', cutoff).order('start_date', { ascending: false })) : [];
    const items = [];
    for (const w of weeks) {
      const c = rows.find((r) => r.week_id === w.id);
      const rep = await loadReport(w);
      const wr = rep.warningReport();
      items.push({ w, c, warn: Object.values(wr.counts).reduce((t, n) => t + n, 0), label: statusLabel(c.status, await hasPublished(w.id)) });
    }
    return {
      title: 'Chốt lịch & báo cáo',
      html: html`${head}${tabsNav}<section class="card flush"><div class="card-head"><h2>Các tuần đã xếp lịch (30 ngày gần đây)</h2></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Tuần</th><th>Trạng thái</th><th>Ngày chốt gần nhất</th><th class="center">Cảnh báo</th><th></th></tr></thead>
        <tbody>${items.length ? items.map((it) => html`<tr><td><strong>${dmy(it.w.start_date)} – ${dmy(it.w.end_date)}</strong></td><td>${it.label}</td><td>${it.c.closed_at || '—'}</td><td class="center">${it.warn}</td>
          <td style="white-space:nowrap"><a class="btn sm" href="#/quan-ly/bao-cao?tuan=${it.w.start_date}&tab=lich">Xem tuần</a>
            ${it.c.status === ST_CHOT && can('chot_tuan') ? html`<button class="btn sm secondary reopen" type="button" data-id="${it.w.id}">Mở lại</button>` : ''}</td></tr>`)
          : html`<tr><td colspan="5">Chưa có tuần nào được xếp lịch.</td></tr>`}</tbody></table></div></section>`,
      mount() {
        document.querySelectorAll('.reopen').forEach((b) => b.addEventListener('click', async () => {
          if (!confirm('Mở lại tuần này để chỉnh sửa?')) return;
          try { await rpc('app_reopen', { p_week: Number(b.dataset.id) }); flash('Đã mở lại tuần để chỉnh sửa. Nhân viên vẫn xem bản đã chốt gần nhất cho tới khi chốt lại.'); } catch (e) { flash(e.message, 'error'); }
          rerender();
        }));
      },
    };
  }
  if (!cl) {
    return { title: 'Chốt lịch & báo cáo', html: html`${head}${tabsNav}<div class="card">${week ? 'Tuần này chưa bắt đầu xếp lịch nên chưa có báo cáo.' : 'Tuần này chưa được tạo.'}
      Xếp lịch ở <a href="#/quan-ly/lich-tong?tuan=${start}">Xếp lịch làm tổng</a> hoặc <a href="#/quan-ly/order?tuan=${start}">Order lịch làm</a>.</div>` };
  }
  const [rep, published] = await Promise.all([loadReport(week), hasPublished(week.id)]);
  const wr = rep.warningReport(); const counts = wr.counts; const stats = rep.pageStats();
  const warnTotal = Object.values(counts).reduce((t, n) => t + n, 0);
  const closed = cl.status === ST_CHOT;
  const branches = rep.cat.activeBranches;
  const cn = params.cn || branches[0]?.code;
  const shifts = rep.cat.activeShifts.map((s) => s.name);

  let body;
  if (tab === 'canh-bao') {
    let lines = wr.lines.map((l) => { const i = l.indexOf(':'); return { cat: l.slice(0, i).trim(), detail: l.slice(i + 1).trim() }; });
    if (params.loai) lines = lines.filter((x) => x.cat === params.loai);
    body = html`<section class="card flush"><div class="filter-bar"><label for="loai" style="font-weight:600;font-size:14px">Lọc cảnh báo</label>
      <select class="input sm" id="loai"><option value="">Tất cả cảnh báo</option>${WARN_CATS.map((c) => html`<option ${params.loai === c ? 'selected' : ''}>${c}</option>`)}</select><span style="font-size:13px">${lines.length} dòng</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Loại cảnh báo</th><th>Chi tiết</th></tr></thead>
      <tbody>${lines.length ? lines.map((x) => html`<tr><td><span class="pill warn">${x.cat}</span></td><td>${x.detail}</td></tr>`) : html`<tr><td colspan="2">Không có cảnh báo.</td></tr>`}</tbody></table></div></section>`;
  } else if (tab === 'dinh-bien') {
    body = html`<section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Cơ sở</th><th>Ngày</th><th>Ca</th><th class="center">Tổng</th><th class="center">Định biên</th><th class="center">Pha chế</th><th class="center">Chạy bàn</th><th class="center">Cấp 1+</th><th>Trạng thái</th></tr></thead>
      <tbody>${rep.staffingRows().map((r) => html`<tr><td>${r.branch_code}</td><td>${r.day}</td><td>${r.shift}</td><td class="center">${r.actual}</td><td class="center">${r.required}</td>
        <td class="center">${r.bar_actual}/${r.bar_required}</td><td class="center">${r.floor_actual}/${r.floor_required}</td><td class="center">${r.senior}</td>
        <td><span class="pill ${r.status === 'ĐỦ' ? 'ok' : r.status.includes('THIẾU') ? 'off' : 'warn'}">${r.status}</span></td></tr>`)}</tbody></table></div></section>`;
  } else if (tab === 'nhan-vien') {
    body = html`<section class="card flush"><div class="filter-bar"><input class="input sm" type="search" id="emp-q" placeholder="Nhập mã NV hoặc họ tên" aria-label="Tìm nhân viên"></div>
      <div class="table-wrap"><table class="table" id="emp-t"><thead><tr><th>Mã NV</th><th>Tên nhân viên</th><th>Phân cấp</th><th class="center">Tổng ca</th>${shifts.map((s) => html`<th class="center">${s}</th>`)}<th>Cơ sở</th></tr></thead>
      <tbody>${rep.employeeReport().map((r) => html`<tr data-search="${norm(`${r.code} ${r.name}`)}"><td>${r.code}</td><td>${r.name}</td><td>${r.rank}</td><td class="center"><strong>${r.total}</strong></td>
        ${shifts.map((s) => html`<td class="center">${r.shift_counts[s] || 0}</td>`)}<td>${r.branches || '—'}</td></tr>`)}</tbody></table></div></section>`;
  } else if (tab === 'order') {
    const o = rep.orderDetails();
    body = html`<div class="tiles">${[['#2563eb', o.summary.active, 'Nhân viên đang làm'], ['#16a34a', o.summary.with_data, 'Đã có order'], ['#9ca3af', o.summary.without_data, 'Chưa có order'], ['#22c55e', o.summary.available, 'Ô đi làm được'], ['#dc2626', o.summary.off, 'Ô nghỉ']]
      .map(([c, n, l]) => html`<div class="tile" style="border-top-color:${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`)}</div>
      <section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Nội dung</th><th>Chi tiết</th></tr></thead>
      <tbody>${o.exceptions.length ? o.exceptions.map((r) => html`<tr><td>${r.category}</td><td>${r.detail}</td></tr>`) : html`<tr><td colspan="2">Không có ngoại lệ.</td></tr>`}</tbody></table></div></section>`;
  } else if (tab === 'co-so') {
    body = html`<section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Cơ sở</th><th class="center">Tổng ca NV</th><th class="center">Ca đủ</th><th class="center">Ca thiếu</th><th class="center">Ca thừa</th><th class="center">Lệch vị trí</th><th class="center">Thiếu cấp 1+</th></tr></thead>
      <tbody>${rep.branchReport().map((r) => html`<tr><td><strong>${r.branch_code}</strong></td><td class="center">${r.total_assignments}</td><td class="center">${r.exact}</td><td class="center">${r.shortage}</td><td class="center">${r.overstaff}</td><td class="center">${r.role_mismatch}</td><td class="center">${r.missing_senior}</td></tr>`)}</tbody></table></div></section>`;
  } else {
    const mode = params.che_do === 'cs' ? 'cs' : 'nv';
    let view;
    if (mode === 'cs') {
      const b = branches.find((x) => x.code === cn) || branches[0];
      const sm = rep.summary(); const rows = rep.branchCompact(b);
      const shiftList = [...new Set(rows.map((r) => r.shift))];
      view = html`<table class="mtx" style="font-size:13px"><thead><tr><th class="nm">Ca – vị trí</th>${days.map((d) => html`<th>${d.short} ${d.date}</th>`)}</tr></thead><tbody>
        ${shiftList.length ? shiftList.map((s) => html`${rows.filter((r) => r.shift === s).map((r) => {
          const n = Math.max(...r.required, ...r.days.map((x) => x.length), 1);
          return Array.from({ length: n }, (_, i) => html`<tr><td class="nm">${s} – ${r.role} ${i + 1}</td>${days.map((d) => {
            const a = r.days[d.index][i];
            if (a) return html`<td class="${a.source === 'FIXED' ? 'st-fx' : 'st-ok'} ${['NGHỈ', 'CHƯA ORDER'].includes(a.base_status) ? 'st-warn' : ''}" style="text-align:left">${a.code} – ${a.name}${a.source === 'FIXED' ? html` <small>CĐ</small>` : ''}${a.base_status === 'NGHỈ' ? ' ⚠ Nghỉ' : a.base_status === 'CHƯA ORDER' ? html` <small>Chưa order</small>` : ''}</td>`;
            return i < r.required[d.index] ? html`<td class="st-off">Thiếu</td>` : html`<td></td>`;
          })}</tr>`);
        })}<tr style="background:#f0f5ff"><td class="nm"><strong>Tổng ca ${s}</strong></td>${days.map((d) => { const t = sm.branches.get(`${b.code}|${d.index}|${s}`);
          return t ? html`<td style="font-weight:700;color:${t.actual >= t.required ? '#166534' : '#b91c1c'}">${t.actual}/${t.required}</td>` : html`<td>—</td>`; })}</tr>`)
        : html`<tr><td colspan="8">Cơ sở này chưa có định biên hoặc người được xếp.</td></tr>`}</tbody></table>`;
    } else {
      const grid = rep.employeeGrid();
      view = html`<table class="mtx" style="font-size:12px" id="nv-grid"><thead><tr><th>STT</th><th class="nm">Nhân viên</th><th>Phân cấp</th>${days.map((d) => html`<th>${d.short} ${d.date}</th>`)}<th>Tổng ca</th></tr></thead><tbody>
        ${grid.map((r, i) => html`<tr data-search="${norm(`${r.code} ${r.name}`)}"><td>${i + 1}</td><td class="nm"><strong>${r.code}</strong> – ${r.name}</td><td>${r.rank}</td>
          ${days.map((d) => { const c = r.days[d.index]; return html`<td ${c.length ? 'class="st-ok"' : ''} style="white-space:normal;min-width:110px">${raw(c.map((a) => `${a.shift} · ${a.branch_name || a.branch_code} – ${roleCode(a.role)}`).map((t) => t.replace(/[&<>]/g, '')).join('<br>'))}</td>`; })}
          <td><strong>${r.total}</strong></td></tr>`)}</tbody></table>`;
    }
    body = html`<section class="card flush"><div class="filter-bar">
      <select class="input sm" id="che-do" aria-label="Kiểu xem"><option value="nv" ${mode === 'nv' ? 'selected' : ''}>Lịch tổng theo nhân viên</option><option value="cs" ${mode === 'cs' ? 'selected' : ''}>Lịch theo cơ sở</option></select>
      ${mode === 'cs' ? html`<select class="input sm" id="cn-sel" aria-label="Cơ sở">${branches.map((b) => html`<option value="${b.code}" ${b.code === cn ? 'selected' : ''}>${b.code} – ${b.name}</option>`)}</select>`
        : html`<input class="input sm" type="search" id="nv-q" placeholder="Tìm nhanh mã NV / họ tên" aria-label="Tìm">`}
      <button class="btn sm" type="button" id="xuat-lich">Xuất lịch đang xem</button></div>
      <div class="mtx-wrap" style="border:0;border-radius:0">${view}</div></section>`;
  }

  return {
    title: 'Chốt lịch & báo cáo',
    html: html`${head}
      <div class="toolbar">
        ${can('chot_tuan') ? (closed ? html`<button class="btn sm secondary" type="button" id="reopen-btn">Mở lại tuần</button>` : html`<button class="btn sm" type="button" id="chot-btn">Chốt lịch</button>`) : ''}
        <button class="btn sm secondary" type="button" id="xuat-bc">Xuất báo cáo Excel</button>
        <a class="btn sm secondary" href="${q('r', Date.now())}">Kiểm tra lại dữ liệu</a>
        <span style="font-size:13px;color:var(--ink-2)">Chốt gần nhất: ${cl.closed_at || '—'}</span></div>
      <div class="tiles">${[['#2563eb', stats.active, 'Nhân viên'], ['#16a34a', stats.total_assignments, 'Tổng ca'], ['#f59e0b', warnTotal, 'Cảnh báo'], ['#dc2626', counts.shortage, 'Ca thiếu'], ['#7c3aed', counts.overstaff, 'Ca thừa'], ['#9ca3af', counts.unassigned, 'Chưa có ca']]
        .map(([c, n, l]) => html`<div class="tile" style="border-top-color:${c}"><div class="n">${n}</div><div class="l">${l}</div></div>`)}</div>
      ${tabsNav}${body}`,
    mount() {
      $('#st-pill').innerHTML = `<span class="pill ${closed ? 'ok' : 'warn'}">${statusLabel(cl.status, published)}</span>`;
      $('#loai')?.addEventListener('change', (ev) => { location.hash = q('loai', ev.target.value).slice(1); });
      $('#che-do')?.addEventListener('change', (ev) => { location.hash = q('che_do', ev.target.value).slice(1); });
      $('#cn-sel')?.addEventListener('change', (ev) => { location.hash = q('cn', ev.target.value).slice(1); });
      const search = (inp, rowsSel) => inp?.addEventListener('input', () => { const t = norm(inp.value.trim()); document.querySelectorAll(rowsSel).forEach((tr) => { tr.hidden = t && !tr.dataset.search.includes(t); }); });
      search($('#emp-q'), '#emp-t tbody tr'); search($('#nv-q'), '#nv-grid tbody tr');
      $('#chot-btn')?.addEventListener('click', async () => {
        const msg = `Chốt lịch tuần ${weekLabel(start)}?\n\nCa thiếu tổng: ${counts.shortage}\nCa thừa: ${counts.overstaff}\nLệch vị trí: ${counts.role_mismatch}\nThiếu QL/Cấp 1+: ${counts.missing_senior}\nXếp vào ca Nghỉ: ${counts.assigned_off}\nXếp khi Chưa order: ${counts.assigned_no_order}\nLàm thông 3 ca: ${counts.three_shifts}\nNhân viên chưa có ca: ${counts.unassigned}\n\nVẫn chốt?`;
        if (!confirm(msg)) return;
        try { const r = await rpc('app_chot', { p_week: week.id }); flash(r.first ? `Đã chốt lịch tuần ${weekLabel(start)}. Nhân viên đã xem được lịch.` : `Đã chốt lại lịch tuần ${weekLabel(start)}. Đã gửi thông báo cho ${r.changed} nhân viên có ca thay đổi.`); }
        catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      $('#reopen-btn')?.addEventListener('click', async () => {
        if (!confirm('Mở lại tuần để chỉnh sửa? Nhân viên vẫn xem bản đã chốt gần nhất cho tới khi chốt lại.')) return;
        try { await rpc('app_reopen', { p_week: week.id }); flash('Đã mở lại tuần để chỉnh sửa.'); } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
      $('#xuat-bc').addEventListener('click', () => exportReport(rep, wr, stats, cl, published));
      $('#xuat-lich')?.addEventListener('click', () => exportWeekly(rep, params.che_do === 'cs' ? 'cs' : 'nv', branches.find((x) => x.code === cn) || branches[0]));
    },
  };
}

function exportReport(rep, wr, stats, cl, published) {
  const w = rep.week; const days = weekDays(w.start_date); const shifts = rep.cat.activeShifts.map((s) => s.name);
  const o = rep.orderDetails();
  downloadXlsx(`Bao_cao_lich_${w.start_date}_${w.end_date}.xlsx`, [
    { name: 'TONG_QUAN', rows: [['NỘI DUNG', 'GIÁ TRỊ'], ['TUẦN', `${dmy(w.start_date)} – ${dmy(w.end_date)}`], ['TRẠNG THÁI', statusLabel(cl.status, published)], ['CHỐT GẦN NHẤT', cl.closed_at || '—'],
      ['NHÂN VIÊN ĐANG LÀM', stats.active], ['NHÂN VIÊN ĐÃ XẾP', stats.assigned_employees], ['NHÂN VIÊN CHƯA CÓ CA', stats.unassigned_employees], ['TỔNG CA ĐÃ XẾP', stats.total_assignments],
      ['TỔNG CẢNH BÁO', Object.values(wr.counts).reduce((t, n) => t + n, 0)]] },
    { name: 'CANH_BAO', rows: [['LOẠI', 'CHI TIẾT'], ...(wr.lines.length ? wr.lines.map((l) => { const i = l.indexOf(':'); return [l.slice(0, i), l.slice(i + 1).trim()]; }) : [['KHÔNG CÓ CẢNH BÁO', '']])] },
    { name: 'DINH_BIEN', rows: [['CƠ SỞ', 'NGÀY', 'CA', 'TỔNG', 'ĐỊNH BIÊN', 'PHA CHẾ', 'CHẠY BÀN', 'CẤP 1+', 'TRẠNG THÁI'],
      ...rep.staffingRows().map((r) => [r.branch_code, r.day, r.shift, r.actual, r.required, `${r.bar_actual}/${r.bar_required}`, `${r.floor_actual}/${r.floor_required}`, r.senior, r.status])] },
    { name: 'NHAN_VIEN', rows: [['MÃ NV', 'TÊN NHÂN VIÊN', 'PHÂN CẤP', 'TỔNG CA', ...shifts.map((s) => s.toUpperCase()), 'CƠ SỞ'],
      ...rep.employeeReport().map((r) => [r.code, r.name, r.rank, r.total, ...shifts.map((s) => r.shift_counts[s] || 0), r.branches])] },
    { name: 'ORDER', rows: [['NỘI DUNG', 'GIÁ TRỊ'], ['NHÂN VIÊN ĐANG LÀM', o.summary.active], ['ĐÃ CÓ ORDER', o.summary.with_data], ['CHƯA CÓ ORDER', o.summary.without_data],
      ['Ô ĐI LÀM ĐƯỢC', o.summary.available], ['Ô NGHỈ', o.summary.off], [], ['NGOẠI LỆ', 'CHI TIẾT'], ...o.exceptions.map((x) => [x.category, x.detail])] },
    { name: 'CO_SO', rows: [['CƠ SỞ', 'TỔNG CA NV', 'CA ĐỦ', 'CA THIẾU', 'CA THỪA', 'LỆCH VỊ TRÍ', 'THIẾU CẤP 1+'],
      ...rep.branchReport().map((r) => [r.branch_code, r.total_assignments, r.exact, r.shortage, r.overstaff, r.role_mismatch, r.missing_senior])] },
    { name: 'LICH_TONG_7_NGAY', rows: [['MÃ NV', 'TÊN NHÂN VIÊN', 'PHÂN CẤP', ...days.map((d) => `${d.name} ${d.date}`), 'TỔNG CA'],
      ...rep.employeeGrid().map((r) => [r.code, r.name, r.rank, ...days.map((d) => r.days[d.index].map((a) => `${a.shift.toUpperCase()}\n${String(a.branch_name || a.branch_code).toUpperCase()} – ${roleCode(a.role)}`).join('\n\n')), r.total])] },
  ]);
}

function exportWeekly(rep, mode, branch) {
  const w = rep.week; const days = weekDays(w.start_date);
  if (mode === 'cs') {
    const sm = rep.summary(); const rows = [['CA – VỊ TRÍ', ...days.map((d) => `${d.name} ${d.date}`)]];
    const comp = rep.branchCompact(branch);
    for (const s of [...new Set(comp.map((r) => r.shift))]) {
      for (const r of comp.filter((x) => x.shift === s)) {
        const n = Math.max(...r.required, ...r.days.map((x) => x.length), 1);
        for (let i = 0; i < n; i++) rows.push([`${s} – ${r.role} ${i + 1}`, ...days.map((d) => { const a = r.days[d.index][i]; return a ? `${a.code} – ${a.name}${a.source === 'FIXED' ? ' CĐ' : ''}` : i < r.required[d.index] ? 'THIẾU' : ''; })]);
      }
      rows.push([`TỔNG CA ${s.toUpperCase()}`, ...days.map((d) => { const t = sm.branches.get(`${branch.code}|${d.index}|${s}`); return t ? `${t.actual}/${t.required}` : ''; })]);
    }
    downloadXlsx(`Lich_co_so_${branch.code}_${w.start_date}.xlsx`, [{ name: 'LICH_TUAN', rows }]);
  } else {
    downloadXlsx(`Lich_tong_theo_nhan_vien_${w.start_date}.xlsx`, [{ name: 'LICH_TUAN', rows: [['STT', 'MÃ NV', 'TÊN NHÂN VIÊN', 'PHÂN CẤP', ...days.map((d) => `${d.name} ${d.date}`), 'TỔNG CA'],
      ...rep.employeeGrid().map((r, i) => [i + 1, r.code, r.name, r.rank, ...days.map((d) => r.days[d.index].map((a) => `${a.shift} · ${a.branch_name || a.branch_code} – ${roleCode(a.role)}`).join('\n')), r.total])] }]);
  }
}
