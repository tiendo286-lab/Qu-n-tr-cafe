import { can, render as rerender } from '../app.js';
import { compareRows, reviewOf } from '../fabi_so_sanh.js?v=2026.11.20.1';
import { addDays, catalog, vnToday } from '../data.js';
import { rpc } from '../sb.js';
import { xlsx } from '../excel.js';
import { dmy, dt, fmt, signed } from '../tien.js';
import { $, $$, flash, go, html, showSaved, str } from '../ui.js';
import { mountSync, syncPanel } from '../fabi_sync.js';
import { parseDetail } from './ke_toan_fabi.js';
import { DOW, mondayOf } from './ke_toan_ck.js';

const SHIFTS = ['Sáng', 'Chiều', 'Tối'];
const STATES = { khop: ['Khớp phiếu', 'ok'], lech: ['Nhân viên gõ khác Fabi', 'warn'], da_sua: ['Web đã sửa số theo Fabi', 'warn'],
  chua_phieu: ['Chưa có phiếu nhân viên', 'warn'], dang_chot: ['Nhân viên đang chốt', 'mute'] };
// bước 136: ca cần quản lý xem = reviewOf (chưa có phiếu / nhân viên gõ khác Fabi / web đã sửa số đối soát theo Fabi)
const stateOf = (f) => reviewOf(f)?.kind || (f.report_status !== 'hoan_thanh' ? 'dang_chot' : 'khop');
const lsGet = () => { try { return localStorage.getItem('ckBranch'); } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem('ckBranch', String(v)); } catch (_) { /* bộ nhớ bị chặn */ } };
const validDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const total = (rows, key) => rows.reduce((n, f) => n + Number(f[key] || 0), 0);

export async function render({ params }) {
  const today = vnToday();
  const day = validDay(params.ngay) ? params.ngay : validDay(params.den) ? params.den : addDays(today, -1);
  const mon = mondayOf(day), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const [cat, D, KW, MN] = await Promise.all([catalog(), rpc('app_fabi_list', { p_from: mon, p_to: days[6] }),
    rpc('app_ca_kt_wait').catch(() => []), rpc('app_fabi_menu').catch(() => ({ items: [] }))]);
  const branches = cat.activeBranches.filter((b) => ![b.code, b.display_code].includes('LLB'));
  const has = (id) => branches.some((b) => String(b.id) === String(id));
  const branch = branches.find((b) => String(b.id) === String(has(params.cn) ? params.cn : has(lsGet()) ? lsGet() : branches[0]?.id));
  if (!branch) return { title: 'File ca Fabi', html: html`<div class="card">Chưa có cơ sở dùng Fabi.</div>` };
  lsSet(branch.id);
  const code = branch.display_code || branch.code;
  const belongs = (f) => [branch.code, branch.display_code].filter(Boolean).includes(f.branch_code);
  const files = D.files.filter(belongs), missing = D.missing.filter(belongs);
  const unknown = D.files.filter((f) => !f.branch_code);
  const review = files.filter((f) => reviewOf(f)).sort((a, b) => (a.work_date + a.open_at < b.work_date + b.open_at ? -1 : 1));
  const isKT = can('ke_toan'), isDS = can('doi_soat');
  const wait = KW.filter((k) => String(k.branch_id) === String(branch.id) && k.date >= mon && k.date <= days[6]);
  const menuMissing = (MN.items || []).filter((x) => !x.grp);
  const query = (p = {}) => '#/ke-toan/fabi?' + new URLSearchParams({ cn: branch.id, ngay: day, ...p });
  const at = (d, sh) => files.filter((f) => f.work_date === d && f.shift === sh);
  const missingAt = (d, sh) => missing.some((f) => f.work_date === d && f.shift === sh);
  const shifts = [...new Set([...SHIFTS, ...files.map((f) => f.shift).filter(Boolean)])];
  const summaryCell = (d, sh) => {
    const rows = at(d, sh), miss = missingAt(d, sh);
    const bad = rows.map(reviewOf).filter(Boolean), why = bad.map((v) => v.short).join(' · ');
    return html`<td><button class="fb-cell ${bad.length ? 'review' : rows.length ? 'ready' : miss ? 'missing' : 'empty'} ${d === day ? 'selected' : ''}"
      data-day="${d}" aria-label="${sh} ${dmy(d)}: ${rows.length ? `${rows.length} file` : miss ? 'thiếu file' : 'chưa có dữ liệu'}">
      ${rows.length ? html`<b>${fmt(total(rows, 'net'))}</b><span>CK ${fmt(total(rows, 'ck'))}</span><small title="${why}">${bad.length ? (why.length > 44 ? why.slice(0, 42) + '…' : why) : rows.some((f) => stateOf(f) === 'dang_chot') ? 'Đang chốt phiếu' : '✓ Đã có file'}</small>`
        : html`<b>${miss ? 'Thiếu file' : '—'}</b><small>${miss ? 'Phiếu đã có trên web' : 'Chưa có dữ liệu'}</small>`}</button></td>`;
  };
  const money = (label, value) => html`<div><span>${label}</span><b>${fmt(value)}<small>đ</small></b></div>`;
  // bước 136: bảng so sánh 7 mục — Nhân viên nhập · File Fabi · Chênh (dòng khác tô đỏ)
  const cmpTable = (f) => html`<div class="fb-cmp-wrap"><table class="fb-cmp"><thead><tr><th>Mục</th><th>Nhân viên nhập</th><th>File Fabi</th><th>Chênh</th></tr></thead>
    <tbody>${compareRows(f).map((x) => html`<tr class="${x.same ? '' : 'bad'}"><td>${x.label}</td><td>${x.nv === null ? '—' : fmt(x.nv)}</td><td>${x.fabi === null ? '—' : fmt(x.fabi)}</td>
      <td>${x.same ? '✓' : x.gap === null ? 'chưa ghi' : signed(x.gap)}</td></tr>`)}</tbody></table></div>`;
  const fileCard = (f) => {
    const st = STATES[stateOf(f)], rv = reviewOf(f);
    return html`<article class="fb-file ${rv ? 'has-review' : ''}" id="fb-ca-${f.ma_ca}"><div class="fb-file-head"><strong>${(f.open_at || '').slice(11, 16)}–${(f.close_at || '').slice(11, 16)}</strong><span class="pill ${st[1]}">${st[0]}</span></div>
      ${rv ? html`<div class="fb-why"><div class="fb-reason"><b>Lỗi:</b>${rv.lines.map((l) => html`<div>${l}</div>`)}</div>
        ${f.nguoi_chot ? html`<p class="st-meta">Người chốt phiếu: <b>${f.nguoi_chot}</b></p>` : ''}
        ${f.nv ? cmpTable(f) : ''}
        ${isDS && f.report_id ? html`<a class="btn sm secondary fb-open-ds" href="#/quan-ly/doi-soat/ca?id=${f.report_id}">Mở đối soát ca ›</a>` : ''}</div>` : ''}
      <div class="fb-money">${money('Doanh thu NET', f.net)}${money('Chuyển khoản', f.ck)}${money('Tiền mặt', f.tm)}${money('Nợ trên Fabi', f.no)}</div>
      <details><summary>Xem số tiền và thông tin file</summary><div class="fb-extra">
        <div class="fb-money">${money('Số dư đầu ca', f.dau)}${money('Tiền đếm thực tế', f.tong)}</div>
        <p>Chênh lệch tiền trên Fabi: <strong>${signed(f.chenh)}</strong></p>
        <p class="st-meta">Đây là chênh lệch trên Fabi; kết quả sau thu chi và công nợ xem ở Đối soát.</p>
        <p>Số cốc: <strong>${f.cups ?? 'Chưa tính được'}</strong>${(f.cups_unknown || []).length ? html` · thiếu nhóm ${f.cups_unknown.length} món` : ''}</p>
        ${(f.tra_no || []).length ? html`<p>Khách trả nợ trên file: ${f.tra_no.map((x) => `${x.method} ${fmt(x.amount)}đ`).join(' · ')}</p>` : ''}
        ${(f.sua || []).length ? html`<p class="pill warn">${f.sua.length} hóa đơn sửa / xóa</p>` : ''}
        <p class="st-meta">Mã ca: ${f.ma_ca}<br>Nhập gần nhất: ${f.uploaded_at ? dt(f.uploaded_at) : '—'}</p>
      </div></details></article>`;
  };
  // bước 136: khung "Ca cần quản lý xem" của cơ sở + tuần đang xem
  const reviewBox = review.length ? html`<section class="card fb-review" id="fb-review"><div class="fb-section-head"><h2>Ca cần quản lý xem · ${code}</h2><span class="st-meta">${review.length} ca trong tuần</span></div>
    ${review.map((f) => html`<div class="fb-review-row"><div><strong>${dmy(f.work_date).slice(0, 5)} · Ca ${f.shift || '?'}</strong><div class="fb-review-why">${reviewOf(f).short}</div></div>
      <button class="btn sm secondary" data-ca="${f.ma_ca}" data-cday="${f.work_date}">Xem</button></div>`)}</section>` : '';
  return { title: 'File ca Fabi', html: html`<style>${CSS}</style>
    <div class="page-head"><div><h1>File ca Fabi</h1><div class="sub">${isKT ? 'Kiểm soát file chi tiết từng ca và kết quả so với phiếu nhân viên.' : 'Xem kết quả so file Fabi với phiếu nhân viên.'}</div></div>
      <div class="fb-head-actions"><button class="btn secondary" id="fb-reload">Làm mới</button>${isKT ? html`<label class="btn">Chọn Excel thủ công<input type="file" id="fb-file" accept=".xlsx,.xls" multiple hidden></label>` : ''}</div>
      <div id="saved-indicator" class="saved" role="status" hidden></div></div>
    <div class="fb-board stack">${isKT ? syncPanel() : ''}<div id="fb-msg" role="status"></div>
      <section class="card fb-controls"><nav class="branch-tabs" aria-label="Cơ sở">${branches.map((b) => html`<a class="${b.id === branch.id ? 'on' : ''}" href="${query({ cn: b.id })}" title="${b.name}">${b.display_code || b.code}</a>`)}</nav>
        <div class="fb-week-nav"><a class="btn sm secondary" href="${query({ ngay: addDays(mon, -7) })}" aria-label="Tuần trước">‹</a>
          <div><strong>${dmy(mon).slice(0, 5)} – ${dmy(days[6])}</strong><span>${branch.name || code}</span></div>
          <a class="btn sm secondary" href="${query({ ngay: addDays(mon, 7) })}" aria-label="Tuần sau">›</a>
          <input class="input sm" id="fb-wday" type="date" value="${day}" aria-label="Chọn ngày xem file Fabi">
          <a class="btn sm secondary" href="${query({ ngay: addDays(today, -1) })}">Hôm qua</a></div></section>
      <div class="fb-stats"><div><span>File đã có · ${code}</span><b>${files.length}</b><small>trong tuần đang xem</small></div>
        <div class="${missing.length ? 'needs' : ''}"><span>Phiếu thiếu file</span><b>${missing.length}</b><small>đã có phiếu trên web</small></div>
        <div class="${review.length ? 'needs' : ''}"><span>Cần quản lý xem</span><b>${review.length}</b><small>khác phiếu hoặc chưa có phiếu</small></div></div>
      ${reviewBox}
      ${unknown.length ? html`<div class="alert warn">${unknown.length} file trong tuần chưa nhận ra cơ sở: ${unknown.map((f) => f.store).join(', ')}. Báo Chủ kiểm tra.</div>` : ''}
      <section class="card fb-week"><div class="fb-section-head"><h2>Tuần của ${code}</h2><span class="st-meta">Bấm ô ca để xem chi tiết ngày</span></div>
        <div class="table-wrap"><table class="fb-table"><thead><tr><th>Ca</th>${days.map((d) => html`<th class="${d === day ? 'selected' : ''}"><button data-day="${d}">${DOW[new Date(d + 'T00:00:00Z').getUTCDay()]}<b>${dmy(d).slice(0, 5)}</b></button></th>`)}<th>Cả tuần</th></tr></thead>
          <tbody>${shifts.map((sh) => html`<tr><th>${sh}</th>${days.map((d) => summaryCell(d, sh))}<td class="fb-week-total"><b>${fmt(total(files.filter((f) => f.shift === sh), 'net'))}</b><small>doanh thu</small></td></tr>`)}
          <tr class="fb-totals"><th>Tổng ngày</th>${days.map((d) => html`<td><b>${files.some((f) => f.work_date === d) ? fmt(total(files.filter((f) => f.work_date === d), 'net')) : '—'}</b></td>`)}<td><b>${fmt(total(files, 'net'))}</b></td></tr></tbody></table></div></section>
      <nav class="fb-days" aria-label="Ngày trong tuần">${days.map((d) => {
        const n = files.filter((f) => f.work_date === d).length, miss = missing.filter((f) => f.work_date === d).length;
        return html`<button class="${d === day ? 'on' : ''}" data-day="${d}" aria-pressed="${d === day}"><span>${DOW[new Date(d + 'T00:00:00Z').getUTCDay()]}</span><b>${d.slice(8)}</b><small>${miss ? `Thiếu ${miss}` : n ? `${n} file` : 'Chưa có'}</small></button>`;
      })}</nav>
      <section id="fb-day-detail" class="stack"><div class="fb-section-head"><h2>Chi tiết ${dmy(day)} · ${code}</h2><span class="st-meta">${files.filter((f) => f.work_date === day).length} file</span></div>
        ${shifts.map((sh) => {
          const rows = at(day, sh), miss = missingAt(day, sh);
          return html`<section class="card fb-shift"><div class="fb-section-head"><h3>Ca ${sh}</h3>${!rows.length ? html`<span class="pill ${miss ? 'warn' : 'mute'}">${miss ? 'Thiếu file Fabi' : 'Chưa có dữ liệu'}</span>` : ''}</div>
            ${rows.length ? rows.map(fileCard) : html`<p class="st-meta">${miss ? 'Phiếu chốt ca đã có trên web. Chạy đồng bộ nếu là hôm qua, hoặc chọn Excel của ca này để bổ sung.' : day >= today ? 'Chưa có file của ca này. Tiện ích tự lấy ca đã đóng của hôm qua.' : 'Chưa có file và chưa có phiếu để đối chiếu. Cần kiểm tra nếu cơ sở có mở ca.'}</p>`}</section>`;
        })}
        <div class="fb-day-total"><span>Doanh thu ngày ${dmy(day).slice(0, 5)}<small>Theo các file đã có</small></span><b>${fmt(total(files.filter((f) => f.work_date === day), 'net'))}đ</b></div>
      </section>
      <details class="card fb-tasks" id="kt-wait"><summary>Việc còn thiếu của ${code} trong tuần <span class="pill ${wait.length || missing.length ? 'warn' : 'ok'}">${wait.length || missing.length ? 'Cần bổ sung' : 'Không có phiếu đang thiếu'}</span></summary>
        <p class="st-meta">Chỉ liệt kê các phiếu đã có trên web. Ca chưa có cả file lẫn phiếu được ghi riêng ở chi tiết ngày.</p>
        ${missing.map((m) => html`<div class="fb-task"><div><strong>${dmy(m.work_date)} · ${m.shift}</strong><div class="st-meta">Thiếu file Fabi</div></div><button class="btn sm secondary" data-day="${m.work_date}">Xem ngày</button></div>`)}
        ${wait.filter((k) => !k.bank).map((k) => html`<div class="fb-task"><div><strong>${dmy(k.date)} · ${k.shift}</strong><div class="st-meta">${(k.missing || []).filter((s) => !s.includes('file')).join(' · ') || 'Thiếu số chuyển khoản ngân hàng'}</div></div><a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?cn=${branch.id}&ngay=${k.date}">Nhập chuyển khoản</a></div>`)}
      </details>
      ${menuMissing.length ? html`<div class="alert warn" id="fb-menu-warn"><strong>${menuMissing.length} món chưa có nhóm</strong> — <a href="#/cai-dat/nhom-mon">chọn nhóm món</a> để tính đủ số cốc.</div>` : ''}
    </div>`,
    mount() {
      $('#fb-reload').onclick = () => rerender();
      $('#fb-wday').onchange = (e) => { if (e.target.value) go(query({ ngay: e.target.value }).slice(1)); };
      $$('[data-day]').forEach((b) => { b.onclick = () => go(query({ ngay: b.dataset.day }).slice(1)); });
      $$('[data-ca]').forEach((b) => { b.onclick = () => go(query({ ngay: b.dataset.cday, ca: b.dataset.ca }).slice(1)); });
      const target = params.ca && document.getElementById('fb-ca-' + params.ca);
      if (target) { target.classList.add('focus'); setTimeout(() => target.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); }
      if (!isKT) return undefined;
      $('#fb-file').onchange = (e) => importFiles(e, (date) => go(query({ ngay: date }).slice(1)));
      return mountSync(() => rerender());
    },
  };
}

async function importFiles(e, nav) {
  const files = [...e.target.files]; if (!files.length) return;
  const msg = $('#fb-msg'); msg.innerHTML = str(html`<div class="alert">Đang đọc ${files.length} file…</div>`);
  e.target.disabled = true;
  try {
    const X = await xlsx(), rows = [], bad = [];
    for (const f of files) {
      try { const row = parseDetail(X, X.read(await f.arrayBuffer(), { type: 'array' })); if (row?.ma_ca) rows.push(row); else bad.push(f.name); }
      catch (_) { bad.push(f.name); }
    }
    if (!rows.length) throw Error('Không thấy file chi tiết ca. File đúng bắt đầu bằng “BÁO CÁO CA CHI TIẾT”, xuất từ chi tiết từng ca trên Fabi.');
    const res = await rpc('app_fabi_upload', { p_rows: rows });
    if (!e.target.isConnected) return;
    const count = (s) => res.filter((x) => x.status === s).length;
    const lines = [`Đã tải ${res.length} ca`, count('khop') ? `${count('khop')} khớp` : '', count('lech') ? `${count('lech')} khác phiếu, đã báo quản lý` : '',
      count('chua_phieu') ? `${count('chua_phieu')} chưa có phiếu` : '', count('chua_ro_co_so') ? `${count('chua_ro_co_so')} chưa nhận ra cơ sở` : '',
      bad.length ? `bỏ qua ${bad.length} file sai mẫu` : ''].filter(Boolean);
    showSaved('Đã tải file Fabi'); flash(lines.join(' · '), count('lech') || count('chua_phieu') || bad.length ? 'warn' : 'ok');
    const days = res.map((x) => x.work_date).filter(Boolean).sort();
    if (days.length) nav(days[days.length - 1]); else rerender();
  } catch (err) { if (msg.isConnected) msg.innerHTML = str(html`<div class="alert error">Không tải được: ${err.message}</div>`); }
  finally { if (e.target.isConnected) { e.target.disabled = false; e.target.value = ''; } }
}

const CSS = html`
.fb-sync[data-connected="no"] .fb-sync-actions,.fb-sync[data-connected="no"] .fb-sync-foot label { display:none; }
.fb-board { max-width:1200px; gap:16px; }.fb-board p { margin:6px 0; }.fb-board h2,.fb-board h3 { margin:0; }
.fb-head-actions,.fb-sync-actions { display:flex; flex-wrap:wrap; gap:8px; }.fb-eyebrow { color:var(--primary); font-size:11px; font-weight:800; letter-spacing:1.5px; margin-bottom:5px; }
.fb-sync { border-top:4px solid #344536; }.fb-sync-head,.fb-sync-foot,.fb-section-head,.fb-file-head { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
.fb-sync-head h2 { font-size:23px; }.fb-sync-actions { margin:14px 0; }.fb-sync-foot { border-top:1px solid var(--line); padding-top:12px; }.fb-sync-foot label { display:flex; align-items:center; gap:8px; font-weight:650; }
.fb-sync-foot input { width:18px; height:18px; accent-color:var(--primary); }.fb-sync #fb-sync-state { margin-top:12px; font-weight:650; }.fb-progress { display:flex; gap:10px; align-items:center; }.fb-progress[hidden] { display:none; }.fb-progress progress { flex:1; accent-color:var(--primary); }
.fb-controls { display:flex; flex-direction:column; gap:16px; }.fb-week-nav { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }.fb-week-nav > div { flex:1; min-width:160px; }.fb-week-nav strong,.fb-week-nav span { display:block; }.fb-week-nav span { font-size:12px; color:var(--ink-2); }
.fb-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }.fb-stats > div { border:1px solid var(--line); border-radius:14px; padding:15px 18px; background:var(--card); }.fb-stats span,.fb-stats small { display:block; color:var(--ink-2); }.fb-stats b { display:block; font-size:30px; margin:5px 0; line-height:1; color:#344536; }.fb-stats .needs b { color:#a04f18; }.fb-stats small { font-size:11px; }
.fb-week { padding:0; overflow:hidden; }.fb-week .fb-section-head { padding:16px; }.fb-table { border-collapse:collapse; width:100%; min-width:920px; font-variant-numeric:tabular-nums; font-size:12px; }.fb-table th,.fb-table td { border:1px solid var(--line); padding:4px; vertical-align:top; }.fb-table th { background:var(--subtle); }.fb-table thead button { border:0; background:transparent; cursor:pointer; width:100%; color:inherit; padding:8px; }.fb-table thead b { display:block; margin-top:4px; }.fb-table tbody th { text-align:left; white-space:nowrap; vertical-align:middle; padding:10px; }.fb-table .selected { background:#f3e5d1; }
.fb-cell { width:100%; min-height:96px; display:flex; flex-direction:column; align-items:flex-end; gap:5px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--ink); text-align:right; padding:10px 7px; cursor:pointer; }.fb-cell b { font-size:14px; }.fb-cell span,.fb-cell small { font-size:11px; }.fb-cell.ready small { color:var(--ok-ink); }.fb-cell.review { background:#fff3e7; }.fb-cell.review small,.fb-cell.missing { color:#995118; }.fb-cell.missing { background:#fff7e9; }.fb-cell.empty { color:var(--ink-2); }.fb-cell.selected { border-color:var(--primary); }.fb-cell:hover { border-color:var(--primary); }.fb-week-total { text-align:right; padding:12px 8px!important; background:var(--subtle); }.fb-week-total small { display:block; font-size:10px; margin-top:6px; color:var(--ink-2); }.fb-totals td { padding:12px 8px; text-align:right; background:#e8eee8; }
.fb-days { display:flex; gap:6px; }.fb-days button { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:3px; border:1px solid var(--line); border-radius:10px; padding:9px 2px; background:var(--card); color:var(--ink-2); cursor:pointer; }.fb-days b { font-size:18px; color:var(--ink); }.fb-days small { font-size:10px; }.fb-days .on { background:#f3e5d1; border-color:var(--primary); color:var(--primary); font-weight:700; }
.fb-shift { padding:16px; }.fb-shift h3 { font-size:18px; }.fb-file { margin-top:12px; padding-top:12px; border-top:1px solid var(--line); }.fb-file-head > strong { color:var(--ink-2); font-size:13px; }.fb-money { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:14px 0; font-variant-numeric:tabular-nums; }.fb-money span { display:block; color:var(--ink-2); font-size:12px; margin-bottom:4px; }.fb-money b { font-size:19px; }.fb-money small { font-size:11px; font-weight:400; margin-left:3px; }.fb-file summary { color:var(--primary); font-size:13px; cursor:pointer; padding:6px 0; }.fb-extra { overflow-wrap:anywhere; }.fb-extra .fb-money { grid-template-columns:repeat(2,minmax(0,1fr)); max-width:500px; }
.fb-day-total { display:flex; justify-content:space-between; align-items:center; gap:10px; border-radius:14px; padding:16px; background:#344536; color:#fff; }.fb-day-total small { display:block; font-weight:400; font-size:11px; margin-top:4px; opacity:.8; }.fb-day-total b { color:#fff; font-size:24px; }
.fb-tasks > summary { cursor:pointer; font-weight:700; }.fb-tasks .pill { margin-left:8px; }.fb-task { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 0; border-top:1px solid var(--line); }.fb-task > div { min-width:0; }.fb-board #fb-msg:empty { display:none; }
.fb-review { border-left:4px solid var(--warn-line); }.fb-review-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 0; border-top:1px solid var(--line); }.fb-review-row > div { min-width:0; }.fb-review-why { color:var(--warn-ink); font-size:13px; margin-top:3px; overflow-wrap:anywhere; }
.fb-file.focus { outline:2px solid var(--primary); outline-offset:6px; border-radius:6px; }.fb-why { margin:12px 0; display:flex; flex-direction:column; gap:8px; align-items:flex-start; }.fb-reason { width:100%; box-sizing:border-box; background:var(--off-bg); border:1px solid var(--off-line); color:var(--off-ink); border-radius:10px; padding:10px 12px; font-size:14px; line-height:1.5; }.fb-reason b { display:block; margin-bottom:2px; }
.fb-cmp-wrap { width:100%; }.fb-cmp { width:100%; max-width:640px; border-collapse:collapse; font-variant-numeric:tabular-nums; font-size:13px; }.fb-cmp th,.fb-cmp td { border:1px solid var(--line); padding:7px 9px; text-align:right; }.fb-cmp th:first-child,.fb-cmp td:first-child { text-align:left; }.fb-cmp th { background:var(--subtle); font-size:12px; }.fb-cmp tr.bad td { background:var(--off-bg); color:var(--off-ink); font-weight:700; }.fb-cmp td:last-child { white-space:nowrap; }
@media(max-width:700px) { .fb-board { gap:12px; }.fb-week { display:none; }.fb-head-actions { width:100%; }.fb-head-actions > * { flex:1; text-align:center; }.fb-head-actions .btn { font-size:12px; }.fb-sync-head h2 { font-size:20px; }.fb-sync-head { align-items:flex-start; }.fb-sync-actions > .btn { flex:1 1 130px; min-height:44px; padding:9px; font-size:13px; }.fb-sync-foot { align-items:flex-start; }.fb-sync-foot label { font-size:13px; }.fb-controls { padding:12px; }.fb-week-nav { gap:6px; }.fb-week-nav > div { min-width:150px; }.fb-week-nav input { flex:1 1 180px; min-width:150px; width:auto; }.fb-stats { gap:6px; }.fb-stats > div { padding:12px 9px; }.fb-stats span { font-size:11px; min-height:30px; }.fb-stats b { font-size:25px; }.fb-stats small { font-size:10px; }.fb-section-head h2 { font-size:19px; }.fb-shift { padding:13px; }.fb-file-head .pill { white-space:normal; font-size:11px; }.fb-money { grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }.fb-money b { font-size:19px; }.fb-day-total b { font-size:21px; }.fb-tasks > summary { font-size:14px; }.fb-tasks .pill { margin:6px 0 0; }.fb-task { flex-wrap:wrap; }.fb-cmp { table-layout:fixed; font-size:12px; }.fb-cmp th,.fb-cmp td { padding:6px 4px; overflow-wrap:anywhere; }.fb-cmp th:first-child { width:30%; }.fb-cmp th { font-size:10.5px; }.fb-review-row .btn { flex:none; } }
`;
