// Thẻ Cài đặt của trang Order (chỉ Chủ): chỉnh trang Order ca của nhân viên, bên phải là hình xem trước đổi theo ngay.
// Máy chủ: tệp 192 (app_order_cfg / app_order_cfg_save). Mở bằng #/quan-ly/order?tab=cai-dat (order_ql.js gọi sang).
import { render as rerender } from '../app.js';
import { DOW_LABELS, addDays, catalog, getWeek, vnToday, weekStart, withFtAfter } from '../data.js';
import { rpc, sel } from '../sb.js';
import { $, $$, flash, html, str } from '../ui.js';
import { orderCfg, orderMount, orderView } from './order_nv.js?v=2026.11.28.1';   // cùng bản với trang Order ca; số ?v= tăng khi phát hành

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Thanh thẻ ở đầu trang Order: chỉ Chủ thấy (order_ql.js cũng dùng)
export const orderTabs = (on, start) => html`<nav class="tabs-nav" id="od-tabs" style="margin-bottom:12px">
  <a class="${on === 'order' ? 'on' : ''}" href="#/quan-ly/order${start ? `?tuan=${start}` : ''}">Order</a>
  <a class="${on === 'cai-dat' ? 'on' : ''}" href="#/quan-ly/order?tab=cai-dat">Cài đặt</a></nav>`;

const CSS = html`<style>
  .oc-wrap { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
  .oc-left { flex: 1 1 460px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
  .oc-right { flex: 0 1 414px; min-width: 0; max-width: 100%; display: flex; flex-direction: column; gap: 8px; }
  .oc-phone { border: 10px solid var(--ink, #2b2520); border-radius: 30px; background: var(--bg, #f5efe6); padding: 12px 10px; max-height: 760px; overflow-y: auto; }
  .oc-phone > .stack { gap: 12px; }
  .oc-check { display: flex; gap: 10px; align-items: flex-start; min-height: 44px; cursor: pointer; }
  .oc-check input { width: 20px; height: 20px; margin: 2px 0 0; flex: none; }
  .oc-check .hint { font-size: 13px; color: var(--muted); font-weight: 400; }
  .oc-time { width: 90px; text-align: center; }
  @media (max-width: 560px) { .oc-phone { border-width: 6px; border-radius: 20px; padding: 8px 6px; } .oc-right { flex-basis: 100%; } }
</style>`;

export async function renderCfg({ me }) {
  if (me.role !== 'chu') return { title: 'Order lịch làm', html: html`<div class="card">Chỉ Chủ mới mở được thẻ Cài đặt.</div>` };
  const start = addDays(weekStart(vnToday()), 7);
  const [settings, cfg, week, shifts0, cat] = await Promise.all([
    sel('settings', 'key, value', (b) => b.like('key', 'order_%')),
    orderCfg(),
    getWeek(start),
    sel('shifts', 'id, name, sort_order', (b) => b.eq('status', 'Đang sử dụng').order('sort_order').order('id')),
    catalog(),
  ]);
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));
  const rule = { open_dow: Number(s.order_open_dow ?? 0), open_time: s.order_open_time || '08:00', close_dow: Number(s.order_close_dow ?? 3), close_time: s.order_close_time || '22:00' };
  const par = cat.ftParents();
  const shifts = withFtAfter(shifts0, par);
  const dow = (id, v) => html`<select class="input" id="${id}" name="${id}" style="width:150px">${DOW_LABELS.map((d, i) => html`<option value="${i}" ${i === v ? 'selected' : ''}>${d}</option>`)}</select>`;
  const check = (name, on, title, hint) => html`<label class="oc-check"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span><strong>${title}</strong><br><span class="hint">${hint}</span></span></label>`;

  // Đọc ô đang nhập → cài đặt + giờ (để vẽ hình xem trước và để lưu)
  const read = () => {
    const f = $('#oc-form');
    return {
      note: f.elements.note.value.trim(),
      quick_day: f.elements.quick_day.checked, quick_copy: f.elements.quick_copy.checked,
      require_all: f.elements.require_all.checked, edit_after: f.elements.edit_after.checked,
      open_dow: Number(f.elements.open_dow.value), open_time: f.elements.open_time.value.trim(),
      close_dow: Number(f.elements.close_dow.value), close_time: f.elements.close_time.value.trim(),
    };
  };
  const preview = (c) => {
    const o = {
      week: week || { id: 0, start_date: start },
      win: { state: 'dang_mo', close: '2026-01-02T06:00', now: '2026-01-01T00:00:00', close_text: `${c.close_time} ${DOW_LABELS[c.close_dow]}`, open_text: `${c.open_time} ${DOW_LABELS[c.open_dow]}` },
      shifts, par, ent: new Map(), submitted: false, cfg: c, me, preview: true,
      // hình xem trước: "tuần trước" là ví dụ — đi làm được mọi ca chính
      prev: async () => shifts.filter((x) => !par[x.name]).flatMap((x) => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, shift: x.name, status: 'ok' }))),
    };
    $('#oc-preview').innerHTML = str(html`<div class="stack">${orderView(o)}</div>`);
    orderMount(o);
  };

  return {
    title: 'Order lịch làm',
    html: html`
      <div class="page-head"><div><h1>Order lịch làm</h1><div class="sub">Cài đặt trang Order ca của nhân viên · chỉ Chủ thấy thẻ này</div></div></div>
      ${orderTabs('cai-dat')}
      <div class="oc-wrap">
        <form class="oc-left" id="oc-form">
          <section class="card stack" style="gap:10px">
            <h2>1. Giờ order</h2>
            <div class="hint" style="font-size:13px;color:var(--muted)">Nhân viên chỉ order được từ giờ mở đến giờ hết hạn, tính theo tuần liền trước tuần cần order. Giờ riêng cho một tuần (dịp lễ) vẫn chỉnh ở trang <a href="#/quan-ly/gio-order">Giờ order</a>.</div>
            <div class="toolbar" style="gap:16px">
              <div class="field"><label for="open_dow">Mở order</label><div class="toolbar" style="gap:8px">${dow('open_dow', rule.open_dow)}
                <input class="input oc-time" name="open_time" value="${rule.open_time}" maxlength="5" inputmode="numeric" aria-label="Giờ mở"></div></div>
              <div class="field"><label for="close_dow">Hết hạn</label><div class="toolbar" style="gap:8px">${dow('close_dow', rule.close_dow)}
                <input class="input oc-time" name="close_time" value="${rule.close_time}" maxlength="5" inputmode="numeric" aria-label="Giờ hết hạn"></div></div>
            </div>
          </section>
          <section class="card stack" style="gap:10px">
            <h2>2. Lời nhắn đầu trang cho nhân viên</h2>
            <label for="oc-note" class="hint" style="font-size:13px;color:var(--muted)">Anh gõ gì thì nhân viên thấy đúng câu đó ở đầu trang Order ca. Để trống thì không hiện. Tối đa 300 chữ.</label>
            <textarea class="input" id="oc-note" name="note" rows="3" maxlength="300" style="resize:vertical">${cfg.note}</textarea>
          </section>
          <section class="card stack" style="gap:6px">
            <h2>3. Nút chọn nhanh cho nhân viên</h2>
            ${check('quick_day', cfg.quick_day, 'Cả ngày đi làm được / Cả ngày nghỉ', 'Mỗi ngày có 2 nút, bấm một lần là chọn hết các ca của ngày đó. Bấm xong vẫn sửa từng ca được.')}
            ${check('quick_copy', cfg.quick_copy, 'Giống tuần trước', 'Một nút ở đầu trang, chép lại đúng order của tuần trước rồi nhân viên sửa chỗ khác.')}
          </section>
          <section class="card stack" style="gap:6px">
            <h2>4. Luật khi gửi</h2>
            ${check('require_all', cfg.require_all, 'Phải chọn đủ mọi ô mới gửi được', 'Tắt thì ô nào bỏ trống sẽ tính là Chưa order.')}
            ${check('edit_after', cfg.edit_after, 'Trước hạn vẫn sửa lại được', 'Tắt thì gửi một lần là khoá, muốn đổi phải nhờ quản lý.')}
          </section>
          <div class="toolbar" style="justify-content:space-between">
            <div style="font-size:13px;color:var(--muted)">Áp chung cho mọi cơ sở. Lưu xong nhân viên thấy ngay khi mở lại trang.</div>
            <button class="btn" type="submit" id="oc-save" style="min-height:44px">Lưu cài đặt</button>
          </div>
          <div class="alert error" id="oc-err" role="alert" hidden></div>
        </form>
        <div class="oc-right">
          <div style="font-weight:700;font-size:13px">Nhân viên sẽ thấy trang Order ca như sau</div>
          <div style="font-size:13px;color:var(--muted)">Hình này đổi ngay khi anh bật, tắt hay gõ ở bên trái — xem trước rồi mới bấm Lưu. Bấm thử trong hình không gửi gì đi.</div>
          <div class="oc-phone" id="oc-preview"></div>
        </div>
      </div>${CSS}`,
    mount() {
      const form = $('#oc-form');
      preview(read());
      form.addEventListener('input', () => preview(read()));
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const c = read(); const err = $('#oc-err'); const btn = $('#oc-save');
        const bad = (m) => { err.hidden = false; err.textContent = m; };
        err.hidden = true;
        if (!TIME_RE.test(c.open_time) || !TIME_RE.test(c.close_time)) return bad('Giờ không hợp lệ. Nhập dạng giờ:phút, ví dụ 08:00.');
        if (c.close_dow < c.open_dow || (c.close_dow === c.open_dow && c.close_time <= c.open_time)) return bad('Giờ hết hạn phải sau giờ mở.');
        btn.disabled = true;
        try { await rpc('app_order_cfg_save', { p: c }); } catch (e) { btn.disabled = false; return bad(`Chưa lưu được: ${e.message}`); }
        flash('Đã lưu cài đặt Order ca.'); rerender();
        return null;
      });
      $$('#oc-preview a').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
    },
  };
}
