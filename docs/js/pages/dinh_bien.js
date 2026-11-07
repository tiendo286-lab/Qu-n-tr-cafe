// Định biên: số người cần cho từng ca – vai trò – ngày ở mỗi chi nhánh. Tự động lưu.
import { WEEKDAYS, catalog } from '../data.js';
import { sb, sel, viError } from '../sb.js';
import { $$, hhmm, html, showSaved } from '../ui.js';

export const perm = 'sua_danh_muc';
const TINTS = ['#e9eff4', '#fbf0d9', '#efe6ee', '#e6ecdc', '#f6e3e1'];

export async function render({ params }) {
  const cat = await catalog();
  const brs = cat.activeBranches;
  if (!brs.length) return { title: 'Định biên', html: html`<div class="card">Chưa có chi nhánh đang hoạt động.</div>` };
  const branch = brs.find((b) => String(b.id) === params.cn) || brs[0];
  const reqRows = await sel('staffing_requirements', 'weekday, shift, role, required_count', (b) => b.eq('branch_id', branch.id));
  const req = new Map(reqRows.map((r) => [`${r.weekday}|${r.shift}|${r.role}`, r.required_count]));
  const blocks = cat.branchShifts(branch.id).map((s) => {
    const rows = cat.activeRoles.map((r) => ({ role: r.name, counts: WEEKDAYS.map((_, d) => req.get(`${d}|${s.name}|${r.name}`) || 0) }));
    return { s, rows, totals: WEEKDAYS.map((_, d) => rows.reduce((t, r) => t + r.counts[d], 0)) };
  });
  return {
    title: 'Định biên',
    html: html`
      <div class="page-head"><div><h1>Định biên nhân sự</h1>
        <div class="sub">Số người cần cho từng ca, vai trò, ngày. Áp dụng cho mọi tuần chưa chốt; tuần đã chốt giữ nguyên. Tự động lưu.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <nav class="toolbar" aria-label="Chọn chi nhánh">${brs.map((b) => html`<a class="btn sm ${b.id === branch.id ? '' : 'secondary'}" href="#/quan-ly/dinh-bien?cn=${b.id}" style="min-height:44px">${b.code} – ${b.name}</a>`)}</nav>
      <div style="font-size:14px;color:var(--ink-2)"><strong>${branch.code} – ${branch.name}</strong> · ${blocks.length} ca đang dùng: ${blocks.map((b) => b.s.name).join(' · ')}</div>
      ${blocks.length ? blocks.map((blk, bi) => html`<section class="card flush staff-block">
        <div class="card-head" style="background:${TINTS[bi % 5]};justify-content:center"><h2>Ca ${blk.s.name} <span style="font-weight:500;color:var(--ink-2);font-size:14px">· ${blk.s.start || '?'}–${blk.s.end || '?'}</span></h2></div>
        <div class="table-wrap"><table class="table rt-fx" aria-label="Định biên ca ${blk.s.name}">
          <thead class="dark"><tr><th>Vị trí</th>${WEEKDAYS.map((d) => html`<th class="center">${d}</th>`)}</tr></thead>
          <tbody>${blk.rows.map((row) => html`<tr><th scope="row" style="background:none;color:var(--ink);font-weight:600">${blk.s.name} – ${row.role}</th>
            ${row.counts.map((c, d) => html`<td class="center"><input class="input sm staff-input" type="number" min="0" max="50" step="1" inputmode="numeric" value="${c}"
              data-weekday="${d}" data-shift="${blk.s.name}" data-role="${row.role}" aria-label="${blk.s.name} ${row.role} ${WEEKDAYS[d]}" style="width:72px;text-align:center"></td>`)}</tr>`)}
            <tr style="background:var(--sage-bg)"><th scope="row" style="background:none;color:var(--primary-dark)">Tổng ca ${blk.s.name}</th>
              ${blk.totals.map((t, d) => html`<td class="center total-cell" data-weekday="${d}" style="font-weight:700;color:var(--primary-dark)">${t}</td>`)}</tr>
          </tbody></table></div></section>`)
        : html`<div class="card">Chi nhánh này chưa bật ca nào. Vào <a href="#/quan-ly/chi-nhanh">Chi nhánh, ca &amp; vai trò</a> để bật ca và nhập giờ.</div>`}`,
    mount() {
      const recompute = (block) => block.querySelectorAll('.total-cell').forEach((cell) => {
        let sum = 0;
        block.querySelectorAll(`.staff-input[data-weekday="${cell.dataset.weekday}"]`).forEach((i) => { sum += parseInt(i.value || '0', 10) || 0; });
        cell.textContent = sum;
      });
      $$('.staff-input').forEach((input) => {
        let last = input.value;
        input.addEventListener('change', async () => {
          const n = parseInt(input.value, 10);
          if (Number.isNaN(n) || n < 0 || n > 50) { input.value = last; showSaved('Số người phải từ 0 đến 50.', true); return; }
          input.value = n;
          const { error } = await sb.from('staffing_requirements').upsert({
            branch_id: branch.id, weekday: Number(input.dataset.weekday), shift: input.dataset.shift, role: input.dataset.role, required_count: n,
            updated_at: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' '),
          }, { onConflict: 'branch_id,weekday,shift,role' });
          if (error) { input.value = last; showSaved(viError(error), true); } else { last = input.value; showSaved('Đã lưu · ' + hhmm()); }
          recompute(input.closest('.staff-block'));
        });
      });
    },
  };
}
