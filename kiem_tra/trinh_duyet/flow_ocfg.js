// Cài đặt trang Order ca (tệp 192, anh Tiến chốt mẫu 27/11/2026). index.html và test/phone.html:
//   role=chu — trang Cài đặt › Order ca (gộp với Giờ order, anh Tiến 28/11) có đủ phần cài đặt, trang Order không còn thẻ; hình xem trước đổi theo ô bật / tắt / lời nhắn; Lưu gọi app_order_cfg_save; giờ sai bị chặn
//   role=ql  — trang Cài đặt › Order ca chỉ có giờ order như cũ, không có phần của Chủ
//   role=nv  — phan=mac-dinh: trang Order ca y như trước (không lời nhắn, không nút nhanh);
//              phan=bat: có lời nhắn, nút cả ngày, chép tuần trước, không bắt chọn đủ; phan=khoa: tắt sửa lại → đã tự gửi thì khoá
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const P = new URLSearchParams(location.search);
  const role = P.get('role') || 'chu'; const phan = P.get('phan') || '';
  const q = (s, r = document) => r.querySelector(s); const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  const waitFor = async (c) => { for (let i = 0; i < 60; i++) { if (c()) return true; await sleep(100); } return false; };
  const fire = (el, t = 'input') => el.dispatchEvent(new Event(t, { bubbles: true }));
  const setCfg = (c) => localStorage.setItem('test_order_cfg', JSON.stringify(c));
  localStorage.setItem('test_open', '1');
  try {
    const { sb } = await import('../js/sb.js');
    {   // dữ liệu giả có thể chưa có ca nào → thêm 3 ca
      const { data: ss } = await sb.from('shifts').select('*');
      if (!ss.some((x) => x.status === 'Đang sử dụng')) await sb.from('shifts').insert([{ id: 1, code: 'S', name: 'Sáng', status: 'Đang sử dụng', sort_order: 0 }, { id: 2, code: 'C', name: 'Chiều', status: 'Đang sử dụng', sort_order: 1 }, { id: 3, code: 'T', name: 'Tối', status: 'Đang sử dụng', sort_order: 2 }]);
    }
    if (role === 'nv') {   // dữ liệu giả chưa có tuần sau → thêm (như flow_ft)
      const t = new Date(Date.now() + 7 * 3600e3); const dow = (t.getUTCDay() + 6) % 7;
      const next = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - dow + 7)).toISOString().slice(0, 10);
      const { data: ws } = await sb.from('weeks').select('*');
      if (!ws.some((w) => w.start_date === next)) await sb.from('weeks').insert({ id: 900, start_date: next, end_date: next });
    }
    if (role === 'chu') {
      localStorage.removeItem('test_order_cfg');
      await visit('#/quan-ly/order?t=' + Date.now());
      ok(!q('#od-tabs') && !q('#oc-form'), 'Chủ: trang Order không còn thẻ Cài đặt (đã gộp sang Cài đặt › Order ca)');
      await visit('#/quan-ly/gio-order'); await waitFor(() => !!q('#oc-preview .day-card'));
      ok(!q('#rule-form') && qa('form#oc-form [name=open_time]').length === 1 && /Các tuần đã tạo/.test(txt(q('#root'))), 'trang Cài đặt › Order ca: giờ order chỉ có một chỗ, bên dưới còn bảng giờ riêng từng tuần');
      const f = q('#oc-form'); const pv = q('#oc-preview');
      ok(!!f && qa('.day-card', pv).length === 7 && qa('.order-row', pv).length >= 21, 'thẻ Cài đặt: có 4 phần cài đặt và hình xem trước đủ 7 ngày');
      ok(f.elements.require_all.checked && f.elements.edit_after.checked && !f.elements.quick_day.checked && !f.elements.quick_copy.checked && f.elements.note.value === '', 'mặc định = như web đang chạy (2 luật bật, 2 nút nhanh tắt, không lời nhắn)');
      ok(!q('#od-note', pv) && !q('.od-quick', pv) && !q('#od-copy', pv), 'hình xem trước mặc định: không lời nhắn, không nút chọn nhanh');
      f.elements.note.value = 'Tuần này cần người ca tối <b>'; fire(f.elements.note);
      ok(/Tuần này cần người ca tối <b>/.test(txt(q('#od-note', pv))) && !q('#od-note b', pv), 'gõ lời nhắn → hiện ngay trong hình (chữ lạ không thành mã)');
      f.elements.quick_day.click(); f.elements.quick_copy.click(); await sleep(50);
      ok(qa('.od-quick', pv).length === 7 && !!q('#od-copy', pv), 'bật 2 nút nhanh → hình có nút cả ngày ở 7 ngày và nút Chép giống tuần trước');
      q('.day-card .qok', pv).click(); await sleep(50);
      const d0 = q('.day-card', pv);
      ok(qa('.order-row', d0).every((r) => r.querySelector('.opt:checked')?.value === 'ok'), 'bấm "Cả ngày đi làm được" trong hình → chọn hết ca của ngày đó');
      q('.day-card .qoff', pv).click(); await sleep(50);
      ok(qa('.order-row', d0).every((r) => r.querySelector('.opt:checked')?.value === 'off'), 'bấm "Cả ngày nghỉ" → cả ngày thành Nghỉ');
      f.elements.require_all.click(); await sleep(50);
      ok(/bỏ trống sẽ tính là Chưa order/i.test(txt(pv)), 'tắt "chọn đủ mọi ô" → hình ghi ô bỏ trống tính là Chưa order');
      f.elements.require_all.click(); await sleep(50);
      // giờ sai bị chặn, không gọi máy chủ
      const k0 = window.__LOG.length;
      f.elements.close_time.value = '25:00'; f.requestSubmit(); await sleep(200);
      ok(!q('#oc-err').hidden && !window.__LOG.slice(k0).some((x) => x[1] === 'app_order_cfg_save'), 'giờ sai → báo đỏ, không lưu');
      f.elements.close_time.value = '22:00';
      const k1 = window.__LOG.length;
      f.requestSubmit(); await sleep(800); await waitFor(() => !!q('#oc-preview .day-card'));
      const c = window.__LOG.slice(k1).find((x) => x[1] === 'app_order_cfg_save');
      const p = c && c[2] && c[2].p;
      ok(!!p && p.quick_day === true && p.quick_copy === true && p.require_all === true && p.edit_after === true && /ca tối/.test(p.note) && p.close_time === '22:00' && p.open_dow === 0, 'Lưu → gọi app_order_cfg_save đúng nội dung');
      ok(q('#oc-form').elements.quick_day.checked && /ca tối/.test(q('#oc-form').elements.note.value), 'lưu xong mở lại: cài đặt còn nguyên');
      ok(fits(), 'trang không tràn ngang');
      localStorage.removeItem('test_order_cfg');
    } else if (role === 'ql') {
      await visit('#/quan-ly/gio-order?t=' + Date.now()); await sleep(600);
      ok(!q('#oc-form') && !q('#oc-preview') && (!!q('#rule-form') || !/Các tuần đã tạo/.test(txt(q('#root')))), 'quản lý: không có phần cài đặt của Chủ (nếu có quyền cài giờ thì chỉ thấy giờ order như cũ)');
    } else if (phan === 'khoa') {
      // Chủ tắt "trước hạn vẫn sửa lại được": nhân viên đã tự gửi thì trang khoá
      setCfg({ note: '', quick_day: true, quick_copy: true, require_all: true, edit_after: false });
      const { data: ws } = await sb.from('weeks').select('*');
      const t = new Date(Date.now() + 7 * 3600e3); const dow = (t.getUTCDay() + 6) % 7;
      const next = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - dow + 7)).toISOString().slice(0, 10);
      const wk = ws.find((w) => w.start_date === next);
      await visit('#/order?t=' + Date.now()); await waitFor(() => !!q('.day-card'));
      ok(!q('#od-locked') && !!q('#submit-btn') && /Gửi một lần là khoá/.test(txt(q('#root'))), 'chưa gửi: vẫn chọn và gửi được, có dòng nhắc "Gửi một lần là khoá"');
      await sb.from('order_submissions').insert({ week_id: wk.id, employee_id: 3, submitted_at: '2026-11-05 10:00:00', updated_at: '2026-11-05 10:00:00' });
      await visit('#/order?t=' + Date.now()); await waitFor(() => !!q('.day-card'));
      ok(!!q('#od-locked') && !q('#submit-btn') && !q('.od-quick') && !q('#od-copy') && qa('.order-row .opt').every((x) => x.disabled), 'đã gửi: có dòng báo khoá, không còn nút gửi / nút nhanh, các ô không bấm được');
      ok(fits(), 'trang không tràn ngang');
      localStorage.removeItem('test_order_cfg');
    } else if (phan === 'bat') {
      setCfg({ note: 'Cần người ca tối', quick_day: true, quick_copy: true, require_all: false, edit_after: true });
      await visit('#/order?t=' + Date.now()); await waitFor(() => !!q('.day-card'));
      ok(/Cần người ca tối/.test(txt(q('#od-note'))), 'nhân viên thấy lời nhắn của quán');
      ok(qa('.od-quick').length === 7 && !!q('#od-copy'), 'có nút cả ngày ở 7 ngày và nút Chép giống tuần trước');
      const btn = q('#submit-btn');
      ok(btn.disabled, 'chưa chọn ô nào → chưa gửi được');
      q('.day-card .qok').click(); await sleep(50);
      ok(!btn.disabled && /bỏ trống/i.test(txt(q('#remain-text'))) && !q('.order-row.missing'), 'chọn 1 ngày là gửi được (không bắt chọn đủ), ô trống không tô đỏ');
      const k = window.__LOG.length;
      q('#od-copy').click(); await waitFor(() => !q('#od-msg').hidden);
      ok(window.__LOG.slice(k).length >= 0 && !q('#od-msg').hidden, 'bấm Chép giống tuần trước → có báo kết quả ngay trên trang: ' + txt(q('#od-msg')).slice(0, 60));
      const n = qa('.order-row').length; const per = n / 7;
      const k2 = window.__LOG.length;
      q('#order-form').requestSubmit(); await sleep(800);
      const c = window.__LOG.slice(k2).find((x) => x[1] === 'app_submit_order');
      ok(!!c && c[2].p_cells.length >= per && c[2].p_cells.length <= n, 'gửi được khi chưa chọn đủ (gửi ' + (c ? c[2].p_cells.length : 0) + '/' + n + ' ô)');
      ok(fits(), 'trang không tràn ngang');
      localStorage.removeItem('test_order_cfg');
    } else {
      localStorage.removeItem('test_order_cfg');
      await visit('#/order?t=' + Date.now()); await waitFor(() => !!q('.day-card'));
      ok(qa('.order-row').length >= 21, 'trang Order ca mở được, đủ ô ca');
      ok(!q('#od-note') && !q('.od-quick') && !q('#od-copy'), 'mặc định: trang Order ca như trước — không lời nhắn, không nút chọn nhanh');
      ok(/Phải chọn đủ \d+ ô mới gửi được/.test(txt(document.body)) && q('#submit-btn').disabled, 'mặc định: vẫn bắt chọn đủ mọi ô');
      q('.order-row .opt[value="ok"]').click(); await sleep(50);
      ok(q('#submit-btn').disabled && qa('.order-row.missing').length > 0, 'chọn 1 ô: chưa gửi được, ô còn lại tô đỏ');
      ok(fits(), 'trang không tràn ngang');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ ocfg: { ok: good, fail: bad } });
};
