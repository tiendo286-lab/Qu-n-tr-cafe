// Nhân viên order ca cho tuần kế tiếp (ưu tiên điện thoại)
import { render as rerender, isManager } from '../app.js';
import { CODE, addDays, getWeek, orderWindow, remaining, vnToday, weekDays, weekLabel, weekStart } from '../data.js';
import { rpc, sel } from '../sb.js';
import { $, $$, flash, html } from '../ui.js';

export const perm = 'order_ca';

const STYLE = html`<style>
  .opt { position: absolute; opacity: 0; pointer-events: none; }
  .choice { flex: 1; min-height: 44px; border-radius: 10px; border: 1px solid var(--line-strong); background: #fff; color: var(--ink-2); font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; text-align: center; }
  .opt:checked + .choice.ok { border: 2px solid var(--ok-line); background: var(--ok-bg); color: var(--ok-ink); font-weight: 700; }
  .opt:checked + .choice.off { border: 2px solid var(--off-line); background: var(--off-bg); color: var(--off-ink); font-weight: 700; }
  .opt:checked + .choice::before { content: "✓ "; }
  .opt:focus-visible + .choice { outline: 3px solid var(--focus); outline-offset: 1px; }
  .opt:disabled + .choice { cursor: default; }
  .order-row.missing .choice { border: 2px dashed var(--off-line); background: #fff5f5; }
</style>`;

function wrap(inner) {
  return isManager()
    ? html`<div class="page-head"><h1>Order ca của tôi</h1></div><div class="stack" style="max-width:480px;gap:12px">${inner}</div>`
    : inner;
}

export async function render({ me }) {
  if (!me.employee_id) {
    return { title: 'Order ca', html: wrap(html`<div class="card">Tài khoản này không gắn với nhân viên nên không order ca.</div>`) };
  }
  const start = addDays(weekStart(vnToday()), 7);
  const week = await getWeek(start);
  if (!week) {
    return { title: 'Order ca', html: wrap(html`<div class="card">Quản lý chưa mở tuần mới (${weekLabel(start)}). Hãy quay lại sau.</div>`) };
  }
  const [win, shifts, entries, subs] = await Promise.all([
    orderWindow(week.id),
    sel('shifts', 'id, name, sort_order', (b) => b.eq('status', 'Đang sử dụng').order('sort_order').order('id')),
    sel('order_entries', 'weekday, shift, status, is_manual', (b) => b.eq('week_id', week.id).eq('employee_id', me.employee_id)),
    sel('order_submissions', 'employee_id', (b) => b.eq('week_id', week.id).eq('employee_id', me.employee_id)),
  ]);
  const ent = new Map(entries.map((e) => [`${e.weekday}|${e.shift}`, e]));
  const submitted = subs.length > 0 || entries.some((e) => e.status === 'ĐI LÀM ĐƯỢC' || e.status === 'NGHỈ');
  const editable = win.state === 'dang_mo';
  const total = shifts.length * 7;
  const days = weekDays(week.start_date);

  const body = html`
    <section class="card stack" style="gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div style="font-size:17px;font-weight:700">Tuần ${weekLabel(week.start_date)}</div>
        ${win.state === 'dang_mo' ? html`<span class="pill ok">Đang mở</span>` : win.state === 'chua_mo' ? html`<span class="pill mute">Chưa mở</span>` : html`<span class="pill off">Đã hết hạn</span>`}
      </div>
      ${win.state === 'dang_mo' ? html`
        <div style="font-size:14px;color:var(--ink-2)">Hạn order: <strong>${win.close_text}</strong> · ${remaining(win.close, win.now)}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.5">Chọn <strong style="color:var(--ok-ink)">Đi làm được</strong> hoặc <strong style="color:var(--off-ink)">Nghỉ</strong> cho từng ca. Phải chọn đủ ${total} ô mới gửi được. Trước hạn vẫn sửa lại được.</div>`
      : win.state === 'chua_mo' ? html`<div style="font-size:14px;color:var(--ink-2)">Order mở lúc <strong>${win.open_text}</strong>, hết hạn ${win.close_text}.</div>`
      : html`<div style="font-size:14px;color:var(--ink-2)">Đã hết hạn lúc ${win.close_text}. ${submitted ? 'Dưới đây là order bạn đã gửi.' : 'Bạn chưa gửi order tuần này — hãy liên hệ quản lý.'}</div>`}
      ${submitted && editable ? html`<div class="alert ok" style="padding:8px 12px">Bạn đã gửi order. Có thể sửa và bấm “Cập nhật order”.</div>` : ''}
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex-grow:1;height:8px;background:var(--line-soft);border-radius:4px;overflow:hidden"><div id="progress" style="height:8px;width:0;background:var(--primary);border-radius:4px"></div></div>
        <div style="font-size:13px;font-weight:600"><span id="done">0</span>/${total} ô</div>
      </div>
    </section>
    <form id="order-form" class="stack" style="gap:12px">
      ${days.map((d) => html`<section class="card flush day-card">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--subtle)">
          <div style="font-weight:700">${d.name} · ${d.date}</div><div class="day-count" style="font-size:12px;color:var(--muted)"></div></div>
        ${shifts.map((s) => {
          const e = ent.get(`${d.index}|${s.name}`);
          const code = e ? CODE[e.status] || 'none' : 'none';
          const f = `c_${d.index}_${s.id}`;
          return html`<div class="order-row" data-d="${d.index}" data-s="${s.name}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--line-soft)">
            <div style="width:74px;display:flex;flex-direction:column;gap:2px">
              <div style="font-weight:600">${s.name}</div>
              <div class="missing-text" style="font-size:11px;font-weight:600;color:#b91c1c" hidden>Chưa chọn</div>
              ${e && e.is_manual ? html`<div style="font-size:10px;font-weight:600;color:#9a3412;background:#ffedd5;padding:1px 5px;border-radius:6px;align-self:flex-start">QL đã sửa</div>` : ''}
            </div>
            <input class="opt" type="radio" id="${f}_ok" name="${f}" value="ok" ${code === 'ok' ? 'checked' : ''} ${editable ? '' : 'disabled'}>
            <label class="choice ok" for="${f}_ok">Đi làm được</label>
            <input class="opt" type="radio" id="${f}_off" name="${f}" value="off" ${code === 'off' ? 'checked' : ''} ${editable ? '' : 'disabled'}>
            <label class="choice off" for="${f}_off">Nghỉ</label></div>`;
        })}</section>`)}
      ${editable ? html`<section class="card stack" style="gap:8px">
        <button class="btn" id="submit-btn" type="submit" style="min-height:52px">${submitted ? 'Cập nhật order' : 'Gửi order'}</button>
        <div id="remain-text" style="font-size:13px;font-weight:600;color:#b91c1c;text-align:center" hidden></div></section>` : ''}
    </form>${STYLE}`;

  return {
    title: 'Order ca',
    html: wrap(body),
    mount() {
      const btn = $('#submit-btn'); const remainText = $('#remain-text');
      const update = () => {
        let done = 0;
        $$('.day-card').forEach((card) => {
          let n = 0;
          $$('.order-row', card).forEach((row) => {
            const chosen = !!row.querySelector('.opt:checked');
            if (chosen) { n++; done++; }
            row.classList.toggle('missing', editable && !chosen);
            row.querySelector('.missing-text').hidden = !(editable && !chosen);
          });
          card.querySelector('.day-count').textContent = `${n}/${$$('.order-row', card).length} đã chọn`;
        });
        $('#done').textContent = done;
        const bar = $('#progress');
        bar.style.width = `${Math.round((done / (total || 1)) * 100)}%`;
        bar.style.background = done === total ? 'var(--ok-line)' : 'var(--primary)';
        if (btn) {
          btn.disabled = done < total;
          remainText.hidden = done === total;
          remainText.textContent = `Còn ${total - done} ô chưa chọn — các ô viền đỏ`;
        }
      };
      $$('.opt').forEach((o) => o.addEventListener('change', update));
      update();
      $('#order-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const cells = $$('.order-row').map((row) => ({ weekday: Number(row.dataset.d), shift: row.dataset.s, status: row.querySelector('.opt:checked')?.value }))
          .filter((c) => c.status);
        btn.disabled = true; btn.textContent = 'Đang gửi…';
        try {
          const r = await rpc('app_submit_order', { p_week: week.id, p_cells: cells });
          flash((r.first ? 'Đã gửi order. ' : 'Đã cập nhật order. ') + `Bạn vẫn sửa được đến ${r.close_text}.`);
        } catch (e) { flash(e.message, 'error'); }
        rerender();
      });
    },
  };
}
