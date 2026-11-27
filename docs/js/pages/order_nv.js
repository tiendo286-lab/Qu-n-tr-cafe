// Nhân viên order ca cho tuần kế tiếp (ưu tiên điện thoại)
import { render as rerender, isManager } from '../app.js';
import { CODE, addDays, catalog, ftShort, isFT, withFtAfter, getWeek, orderWindow, remaining, vnToday, weekDays, weekLabel, weekStart } from '../data.js';
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
  .order-row.ft { background: var(--plum-bg); padding-left: 22px !important; border-top: 1px dashed var(--line) !important; }
  .order-row.ft .sn { color: var(--plum-ink); font-size: 13px; }
  .order-row.ft .choice { min-height: 38px; }
  .ft-note { font-size: 12px; color: var(--plum-ink); line-height: 1.5; }
  .od-note { background: #fdf1d8; border: 1px solid #e6c98a; color: #5c3a05; border-radius: 10px; padding: 10px 12px; line-height: 1.5; font-size: 14px; white-space: pre-line; overflow-wrap: anywhere; }
  .od-quick { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line-soft); }
  .od-quick button { flex: 1; min-height: 44px; border-radius: 10px; background: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
  .od-quick .qok { border: 1px solid var(--ok-line); color: var(--ok-ink); } .od-quick .qoff { border: 1px solid var(--off-line); color: var(--off-ink); }
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
  const [win, shifts0, entries, subs, cat, cfg] = await Promise.all([
    orderWindow(week.id),
    sel('shifts', 'id, name, sort_order', (b) => b.eq('status', 'Đang sử dụng').order('sort_order').order('id')),
    sel('order_entries', 'weekday, shift, status, is_manual', (b) => b.eq('week_id', week.id).eq('employee_id', me.employee_id)),
    sel('order_submissions', 'employee_id', (b) => b.eq('week_id', week.id).eq('employee_id', me.employee_id)),
    catalog(),
    orderCfg(),
  ]);
  const par = cat.ftParents();
  const shifts = withFtAfter(shifts0, par);
  const ent = new Map(entries.map((e) => [`${e.weekday}|${e.shift}`, e]));
  const submitted = subs.length > 0 || entries.some((e) => e.status === 'ĐI LÀM ĐƯỢC' || e.status === 'NGHỈ');
  const o = { week, win, shifts, par, ent, submitted, sent: subs.length > 0, cfg, me };   // sent: nhân viên đã tự bấm gửi
  return { title: 'Order ca', html: wrap(orderView(o)), mount() { orderMount(o); } };
}

// Cài đặt trang Order ca (tệp 192). Máy chủ chưa có hàm → dùng mặc định = trang như trước.
export const CFG0 = { note: '', quick_day: false, quick_copy: false, require_all: true, edit_after: true, can_edit: false };
export async function orderCfg() { try { return { ...CFG0, ...((await rpc('app_order_cfg')) || {}) }; } catch { return { ...CFG0 }; } }

// Phần vẽ: dùng cho trang nhân viên và hình xem trước ở thẻ Cài đặt (o.preview)
export function orderView(o) {
  const { week, win, shifts, par, ent, submitted } = o;
  const cfg = { ...CFG0, ...(o.cfg || {}) };
  const hasFT = shifts.some((s) => isFT(s.name));
  const locked = !!o.sent && !cfg.edit_after && win.state === 'dang_mo';   // đã gửi và Chủ tắt "sửa lại trước hạn"
  const editable = win.state === 'dang_mo' && !locked;
  const total = shifts.length * 7;
  const days = weekDays(week.start_date);

  return html`
    <section class="card stack" style="gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div style="font-size:17px;font-weight:700">Tuần ${weekLabel(week.start_date)}</div>
        ${win.state === 'dang_mo' ? html`<span class="pill ok">Đang mở</span>` : win.state === 'chua_mo' ? html`<span class="pill mute">Chưa mở</span>` : html`<span class="pill off">Đã hết hạn</span>`}
      </div>
      ${win.state === 'dang_mo' ? html`
        <div style="font-size:14px;color:var(--ink-2)">Hạn order: <strong>${win.close_text}</strong> · ${remaining(win.close, win.now)}</div>
        ${hasFT ? html`<div class="ft-note"><strong>FULL TIME</strong> nằm ngay dưới ca chính. Chọn FULL TIME “Đi làm được” thì ca chính tự thành “Đi làm được”; chọn ca chính “Nghỉ” thì FULL TIME tự thành “Nghỉ”.</div>` : ''}
        <div style="font-size:13px;color:var(--muted);line-height:1.5">Chọn <strong style="color:var(--ok-ink)">Đi làm được</strong> hoặc <strong style="color:var(--off-ink)">Nghỉ</strong> cho từng ca. ${cfg.require_all ? `Phải chọn đủ ${total} ô mới gửi được.` : 'Ô nào bỏ trống sẽ tính là Chưa order.'} ${cfg.edit_after ? 'Trước hạn vẫn sửa lại được.' : 'Gửi một lần là khoá — xem kỹ trước khi gửi.'}</div>`
      : win.state === 'chua_mo' ? html`<div style="font-size:14px;color:var(--ink-2)">Order mở lúc <strong>${win.open_text}</strong>, hết hạn ${win.close_text}.</div>`
      : html`<div style="font-size:14px;color:var(--ink-2)">Đã hết hạn lúc ${win.close_text}. ${submitted ? 'Dưới đây là order bạn đã gửi.' : 'Bạn chưa gửi order tuần này — hãy liên hệ quản lý.'}</div>`}
      ${submitted && editable ? html`<div class="alert ok" style="padding:8px 12px">Bạn đã gửi order. Có thể sửa và bấm “Cập nhật order”.</div>` : ''}
      ${locked ? html`<div class="alert warn" id="od-locked" style="padding:8px 12px">Bạn đã gửi order tuần này. Muốn đổi thì nhờ quản lý sửa giúp.</div>` : ''}
      ${cfg.note && win.state !== 'da_dong' ? html`<div class="od-note" id="od-note"><strong>Lời nhắn của quán:</strong> ${cfg.note}</div>` : ''}
      ${cfg.quick_copy && editable ? html`<button class="btn secondary" type="button" id="od-copy" style="min-height:44px">Chép giống tuần trước</button>` : ''}
      <div class="alert" id="od-msg" role="status" style="padding:8px 12px" hidden></div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex-grow:1;height:8px;background:var(--line-soft);border-radius:4px;overflow:hidden"><div id="progress" style="height:8px;width:0;background:var(--primary);border-radius:4px"></div></div>
        <div style="font-size:13px;font-weight:600"><span id="done">0</span>/${total} ô</div>
      </div>
    </section>
    <form id="order-form" class="stack" style="gap:12px">
      ${days.map((d) => html`<section class="card flush day-card">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--subtle)">
          <div style="font-weight:700">${d.name} · ${d.date}</div><div class="day-count" style="font-size:12px;color:var(--muted)"></div></div>
        ${cfg.quick_day && editable ? html`<div class="od-quick"><button type="button" class="qok" data-day="ok">Cả ngày đi làm được</button><button type="button" class="qoff" data-day="off">Cả ngày nghỉ</button></div>` : ''}
        ${shifts.map((s) => {
          const e = ent.get(`${d.index}|${s.name}`);
          const code = e ? CODE[e.status] || 'none' : 'none';
          const f = `c_${d.index}_${s.id}`;
          return html`<div class="order-row ${isFT(s.name) ? 'ft' : ''}" data-d="${d.index}" data-s="${s.name}" data-par="${par[s.name] || ''}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--line-soft)">
            <div style="width:74px;display:flex;flex-direction:column;gap:2px">
              <div class="sn" style="font-weight:600">${isFT(s.name) ? `↳ ${ftShort(s.name)}` : s.name}</div>
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
}

// Phần bấm. o.preview: không gửi lên máy chủ; o.prev(): order tuần trước ([{weekday, shift, status}]) khi xem trước.
export function orderMount(o) {
  const { week, shifts } = o;
  const cfg = { ...CFG0, ...(o.cfg || {}) };
  const total = shifts.length * 7;
  const editable = o.win.state === 'dang_mo' && !(o.sent && !cfg.edit_after);
  {
    {
      const btn = $('#submit-btn'); const remainText = $('#remain-text');
      const say = (text, bad) => { const m = $('#od-msg'); if (!m) return; m.hidden = false; m.className = `alert ${bad ? 'error' : 'ok'}`; m.textContent = text; };
      const update = () => {
        let done = 0;
        const any = !!$('.order-row .opt:checked');   // UI-23: chưa chọn ô nào thì chưa tô đỏ
        const mark = editable && any && cfg.require_all;   // không bắt chọn đủ thì không tô đỏ ô trống
        $$('.day-card').forEach((card) => {
          let n = 0;
          $$('.order-row', card).forEach((row) => {
            const chosen = !!row.querySelector('.opt:checked');
            if (chosen) { n++; done++; }
            row.classList.toggle('missing', mark && !chosen);
            row.querySelector('.missing-text').hidden = !(mark && !chosen);
          });
          card.querySelector('.day-count').textContent = `${n}/${$$('.order-row', card).length} đã chọn`;
        });
        $('#done').textContent = done;
        const bar = $('#progress');
        bar.style.width = `${Math.round((done / (total || 1)) * 100)}%`;
        bar.style.background = done === total ? 'var(--ok-line)' : 'var(--primary)';
        if (btn) {
          btn.disabled = cfg.require_all ? done < total : done === 0;
          remainText.hidden = done === total;
          remainText.style.color = cfg.require_all ? '#b91c1c' : 'var(--muted)';
          remainText.textContent = cfg.require_all ? `Còn ${total - done} ô chưa chọn${mark ? ' — các ô viền đỏ' : ''}` : `Còn ${total - done} ô bỏ trống — sẽ tính là Chưa order`;
        }
      };
      // FULL TIME ↔ ca chính trong cùng ngày
      const rowOf = (d, sn) => $$('.order-row').find((r) => r.dataset.d === d && r.dataset.s === sn);
      const setRow = (row, v) => { const o = row && row.querySelector(`.opt[value="${v}"]`); if (o && !o.checked) o.checked = true; };
      $$('.opt').forEach((o) => o.addEventListener('change', () => {
        const row = o.closest('.order-row');
        if (row.dataset.par && o.value === 'ok') setRow(rowOf(row.dataset.d, row.dataset.par), 'ok');
        if (!row.dataset.par && o.value === 'off') $$('.order-row').filter((r) => r.dataset.d === row.dataset.d && r.dataset.par === row.dataset.s).forEach((r) => setRow(r, 'off'));
        update();
      }));
      // Nút chọn nhanh cả ngày (cài đặt): chọn hết các ca của ngày đó, sau vẫn sửa từng ca được
      $$('.od-quick button').forEach((b) => b.addEventListener('click', () => {
        $$('.order-row', b.closest('.day-card')).forEach((r) => setRow(r, b.dataset.day));
        update();
      }));
      // Chép giống tuần trước (cài đặt): lấy order tuần liền trước của chính mình, ca nào không có thì để nguyên
      const copyBtn = $('#od-copy');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        copyBtn.disabled = true;
        let rows = [];
        try {
          if (o.prev) rows = await o.prev();
          else {
            const pw = await getWeek(addDays(week.start_date, -7));
            rows = pw ? await sel('order_entries', 'weekday, shift, status', (b) => b.eq('week_id', pw.id).eq('employee_id', o.me.employee_id)) : [];
          }
        } catch (e) { say(`Chưa lấy được order tuần trước: ${e.message}`, true); copyBtn.disabled = false; return; }
        let n = 0;
        rows.forEach((e) => { const v = CODE[e.status] || e.status; const row = rowOf(String(e.weekday), e.shift); if (row && (v === 'ok' || v === 'off')) { setRow(row, v); n++; } });
        // giữ luật FULL TIME ↔ ca chính sau khi chép
        $$('.order-row').forEach((r) => { const v = r.querySelector('.opt:checked')?.value; if (r.dataset.par && v === 'ok') setRow(rowOf(r.dataset.d, r.dataset.par), 'ok'); });
        $$('.order-row').forEach((r) => { const v = r.querySelector('.opt:checked')?.value; if (!r.dataset.par && v === 'off') $$('.order-row').filter((x) => x.dataset.d === r.dataset.d && x.dataset.par === r.dataset.s).forEach((x) => setRow(x, 'off')); });
        update(); copyBtn.disabled = false;
        say(n ? `Đã chép ${n} ô giống tuần trước. Xem lại rồi bấm gửi.` : 'Tuần trước bạn chưa order nên không có gì để chép.', !n);
      });
      update();
      $('#order-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (o.preview) { say('Đây là hình xem trước — không gửi order.'); return; }
        const cells = $$('.order-row').map((row) => ({ weekday: Number(row.dataset.d), shift: row.dataset.s, status: row.querySelector('.opt:checked')?.value }))
          .filter((c) => c.status);
        const label0 = btn.textContent;
        btn.disabled = true; btn.textContent = 'Đang gửi…';
        let r;
        try { r = await rpc('app_submit_order', { p_week: week.id, p_cells: cells }); } catch (e) {
          // UI-09: gửi lỗi (mất mạng, hết giờ order…) — giữ nguyên các ô đã chọn, báo lỗi ngay trên nút
          btn.textContent = label0; update();
          let box = $('#order-err');
          if (!box) { box = document.createElement('div'); box.id = 'order-err'; box.className = 'alert error'; box.setAttribute('role', 'alert'); btn.before(box); }
          box.textContent = `Chưa gửi được: ${e.message}. Các ô đã chọn vẫn giữ nguyên — bấm gửi lại.`;
          return;
        }
        flash((r.first ? 'Đã gửi order. ' : 'Đã cập nhật order. ') + `Bạn vẫn sửa được đến ${r.close_text}.`);
        rerender();
      });
    }
  }
}
