// Chốt ca: xem theo tuần, từng cơ sở (bước 76) — bảng ngày × ca, bấm ô để mở phiếu
import { isManager } from '../app.js';
import { WEEKDAYS, addDays, vnToday, weekStart } from '../data.js';
import { rpc } from '../sb.js';
import { dmy, signed } from '../tien.js';
import { $$, go, html, showSaved } from '../ui.js';

export const perm = 'chot_ca';

export const STAFF_LABEL = { dang_chot: ['Đang chốt', 'warn'], hoan_thanh: ['Hoàn thành', 'ok'] };

export function dayName(iso) {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return WEEKDAYS[(d + 6) % 7];
}

export function datePicker(path, day, extra = '') {
  const today = vnToday();
  return html`<section class="card toolbar ca-date" style="padding:12px 14px;gap:8px">
    <a class="btn sm secondary" href="#${path}?ngay=${addDays(day, -1)}${extra}" aria-label="Ngày trước">‹</a>
    <div style="flex:1;text-align:center;min-width:140px"><div style="font-weight:700">${dayName(day)} ${dmy(day)}</div>
      ${day === today ? html`<div style="font-size:12px;color:var(--primary)">Hôm nay</div>` : html`<a href="#${path}?ngay=${today}${extra}" style="font-size:12px">Về hôm nay</a>`}</div>
    <a class="btn sm secondary" href="#${path}?ngay=${addDays(day, 1)}${extra}" aria-label="Ngày sau">›</a>
    <input class="input sm ca-date-input" type="date" value="${day}" aria-label="Chọn ngày" style="width:150px" data-path="${path}" data-extra="${extra}">
  </section>`;
}
export function bindDatePicker() {
  $$('.ca-date-input').forEach((i) => i.addEventListener('change', () => { if (i.value) go(`${i.dataset.path}?ngay=${i.value}${i.dataset.extra}`); }));
}

// Bước 76 (anh Tiến chốt 13/11): xem theo TUẦN, mỗi lần 1 cơ sở — hàng = ngày (Thứ 2 → CN), cột = ca;
// ô ca: màu + chữ ngắn (Xong / Đang chốt / Chưa mở / Thiếu phiếu) + tiền mặt / chuyển khoản lệch; ngày đã qua chưa mở phiếu → đỏ "Thiếu phiếu", bấm để mở bù.
const LS_BR = 'tcBranch';
const START = '2026-11-01';   // ngày bắt đầu dùng web — trước ngày này không báo "Thiếu phiếu"
const lsGet = () => { try { return Number(localStorage.getItem(LS_BR)) || null; } catch (_) { return null; } };
const lsSet = (v) => { try { localStorage.setItem(LS_BR, String(v)); } catch (_) { /* bỏ qua */ } };
const kfmt = (n) => { const a = Math.abs(Number(n) || 0); const s = Number(n) < 0 ? '−' : Number(n) > 0 ? '+' : ''; return a === 0 ? '0' : a >= 1e6 ? `${s}${(a / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}tr` : a >= 1000 ? `${s}${Math.round(a / 1000)}k` : `${s}${a}`; };

export async function render({ params }) {
  const today = vnToday();
  const wk = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(params.tuan || '') ? params.tuan : /^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : today);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(wk, i));
  const all = await Promise.all(days.map((d) => rpc('app_ca_overview', { p_date: d }).then((rows) => rows.map((r) => ({ ...r, day: d })))));
  const branches = [];
  all.flat().forEach((r) => { if (!branches.some((b) => b.id === r.branch_id)) branches.push({ id: r.branch_id, code: r.branch_code, name: r.branch_name }); });
  const has = (v) => branches.some((b) => String(b.id) === String(v));
  const cn = has(params.cn) ? Number(params.cn) : has(lsGet()) ? Number(lsGet()) : branches[0]?.id;
  if (cn) lsSet(cn);
  const BR = branches.find((b) => b.id === cn) || { code: '', name: '' };
  const mine = all.map((rows) => rows.filter((r) => r.branch_id === cn));
  const shifts = []; mine.flat().forEach((r) => { if (!shifts.includes(r.shift)) shifts.push(r.shift); });
  const q = (o) => '#/ca?' + Object.entries({ tuan: wk, cn, ...o }).map(([k, v]) => `${k}=${v}`).join('&');
  const nDone = mine.flat().filter((s) => s.status === 'hoan_thanh').length;
  const nMiss = mine.flat().filter((s) => !s.report_id && s.day < today && s.day >= START).length;
  const cell = (s, d) => {
    if (!s) return html`<td class="cw-na">—</td>`;
    const miss = !s.report_id && d < today && d >= START;
    const [cls, lb] = s.status === 'hoan_thanh' ? ['ok', 'Xong'] : s.report_id ? ['warn', 'Đang chốt'] : miss ? ['miss', 'Thiếu phiếu'] : ['none', 'Chưa mở'];
    const money = s.status === 'hoan_thanh' && s.cash_left != null ? html`<span class="cw-m"><span class="${Number(s.cash_left) < 0 ? 'neg' : ''}">TM ${kfmt(s.cash_left)}</span><span class="${Number(s.transfer_left) < 0 ? 'neg' : ''}">CK ${kfmt(s.transfer_left)}</span></span>` : '';
    return html`<td><button type="button" class="ca-shift cw-c ${cls}" data-b="${s.branch_id}" data-s="${s.shift}" data-d="${d}" data-id="${s.report_id || ''}" title="Ca ${s.shift} ${dmy(d)}${s.completed_by ? ' · chốt: ' + s.completed_by : ''}">
      <span class="cw-st">${lb}</span>${money}</button></td>`;
  };
  const body = html`${STYLE}${WSTYLE}
    <section class="card cw-bar">
      <nav class="branch-tabs" aria-label="Cơ sở">${branches.map((b) => html`<a class="${cn === b.id ? 'on' : ''}" href="${q({ cn: b.id })}" title="${b.name}">${b.code}</a>`)}</nav>
      <div class="cw-wk"><a class="btn sm secondary" href="${q({ tuan: addDays(wk, -7) })}" aria-label="Tuần trước">‹</a>
        <div class="cw-wt"><b>${dmy(days[0]).slice(0, 5)} – ${dmy(days[6])}</b>${today >= days[0] && today <= days[6] ? html`<span class="pill info">Tuần này</span>` : html`<a href="${q({ tuan: weekStart(today) })}">Về tuần này</a>`}</div>
        <a class="btn sm secondary" href="${q({ tuan: addDays(wk, 7) })}" aria-label="Tuần sau">›</a></div></section>
    ${!branches.length ? html`<div class="card">Chưa có cơ sở nào bật ca làm việc.</div>` : html`
    <section class="card cw-card"><div class="cw-h"><h2>${BR.code} – ${BR.name}</h2><span class="st-meta">${nDone} phiếu xong${nMiss ? html` · <b class="neg">${nMiss} thiếu phiếu</b>` : ''}</span></div>
      <div class="cw-wrap"><table class="cw-t"><thead><tr><th></th>${shifts.map((s) => html`<th>${s}</th>`)}</tr></thead>
        <tbody>${days.map((d, i) => html`<tr class="${d === today ? 'today' : ''}"><th><b>${WEEKDAYS[i].replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</b><span>${dmy(d).slice(0, 5)}</span></th>
          ${shifts.map((sh) => cell(mine[i].find((r) => r.shift === sh), d))}</tr>`)}</tbody></table></div>
      <div class="cw-lg"><span class="cw-c ok">Xong</span><span class="cw-c warn">Đang chốt</span><span class="cw-c none">Chưa mở</span><span class="cw-c miss">Thiếu phiếu</span><span class="st-meta">TM / CK: tiền mặt / chuyển khoản lệch (âm = thiếu). Bấm ô để mở phiếu.</span></div></section>`}`;
  return {
    title: 'Chốt ca',
    html: isManager() ? html`<div class="page-head"><div><h1>Chốt ca</h1><div class="sub">Xem theo tuần, từng cơ sở: nhân viên chốt ca, quản lý đối soát. Ô đỏ là ngày đã qua mà chưa có phiếu.</div></div></div><div class="stack" style="max-width:900px;gap:12px">${body}</div>`
      : html`<div class="stack" style="gap:12px">${body}</div>`,
    mount() {
      $$('.cw-c[data-b]').forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.id) return go(`/ca/phieu?id=${b.dataset.id}`);
        const d = b.dataset.d;
        if (!confirm(`Mở phiếu chốt ca ${b.dataset.s} ngày ${dmy(d)}${d < vnToday() ? ' (phiếu bổ sung)' : ''}?`)) return;
        b.disabled = true;
        try { const id = await rpc('app_ca_open', { p_branch: Number(b.dataset.b), p_date: d, p_shift: b.dataset.s }); go(`/ca/phieu?id=${id}`); }
        catch (e) { b.disabled = false; showSaved(e.message, true); }
      }));
    },
  };
}

const WSTYLE = html`<style>
  .cw-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; }
  .cw-wk { display: flex; align-items: center; gap: 8px; } .cw-wt { display: flex; flex-direction: column; align-items: center; min-width: 130px; font-size: 13px; }
  .cw-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .cw-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; } .cw-h h2 { margin: 0; font-size: 17px; }
  .cw-wrap { overflow-x: auto; }
  .cw-t { width: 100%; border-collapse: separate; border-spacing: 4px; table-layout: fixed; }
  .cw-t thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 700; }
  .cw-t thead th:first-child { width: 58px; }
  .cw-t tbody th { text-align: left; font-size: 13px; font-weight: 400; color: var(--ink-2); }
  .cw-t tbody th b { display: block; } .cw-t tbody th span { font-size: 11px; color: var(--muted); }
  .cw-t tr.today th { color: var(--primary); } .cw-t tr.today th span { color: var(--primary); }
  .cw-t td { padding: 0; } .cw-na { text-align: center; color: var(--muted); }
  .cw-c { width: 100%; min-height: 48px; border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; justify-content: center; font: inherit; cursor: pointer; border: 1px solid var(--line); text-align: left; }
  .cw-c.ok { background: var(--ok-bg); border-color: #b7d8ab; color: var(--ok-ink); } .cw-c.warn { background: var(--warn-bg); border-color: #f6d58a; color: var(--warn-ink); }
  .cw-c.none { background: #fff; color: var(--muted); } .cw-c.miss { background: var(--off-bg); border-color: #f3b4ad; color: #991b1b; }
  .cw-st { font-size: 13px; font-weight: 800; } .cw-m { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; line-height: 1.3; }
  .cw-m .neg, .cw-h .neg { color: #b91c1c; }
  .cw-lg { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } .cw-lg .cw-c { width: auto; min-height: 0; padding: 2px 8px; font-size: 12px; font-weight: 700; cursor: default; }
  @media (max-width: 560px) { .cw-t { border-spacing: 3px; } .cw-c { padding: 5px 6px; } .cw-t thead th:first-child { width: 42px; } }
</style>`;

export const STYLE = html`<style>
  .ca-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  @media (max-width: 560px) { .ca-grid { grid-template-columns: minmax(0, 1fr); } }
  .ca-shift { text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; font: inherit; color: var(--ink); }
  .ca-shift:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  .ca-shift-top { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
  .ca-time, .ca-who { font-size: 12px; color: var(--muted); }
  .ca-diff { font-size: 12px; font-weight: 600; color: var(--ink-2); }
  .ca-date { display: grid !important; grid-template-columns: 48px minmax(0, 1fr) 48px auto; align-items: center; }
  .ca-date .btn { min-width: 44px; padding: 0; }
  @media (max-width: 560px) { .ca-date { grid-template-columns: 48px minmax(0, 1fr) 48px; } .ca-date .ca-date-input { grid-column: 1 / -1; width: 100% !important; } }
</style>`;
