// Đưa Đối soát Fabi về lại Chốt ca (thiết kế 22/11/2026, anh Tiến duyệt): trang đối soát của ca 3 tab trong Chốt ca, bảng tuần Việc · Tiền,
// bỏ tab Đối soát Fabi ở Sổ thu chi. Chạy role=chu|qlt|ql (đủ), role=ql2 (không được giao), role=nv — index.html và test/phone.html, confirm=1.
// Kết quả: out[].dsca = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 60) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ tiếp */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(400); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  // Sổ thu chi giữ dữ liệu tháng 60 giây (CACHE) → sau khi bài thử đổi dữ liệu giả, mở tháng khác một lần để trang tải lại (như flow_stc18)
  const fresh = async () => { await go('#/quan-ly/so-thu-chi?cn=1&thang=2026-10', '.stc-tabs'); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  const cell = (id) => $(`.cw-c[data-id="${id}"]`);
  try {
    if (['chu', 'qlt', 'ql'].includes(role)) {
      // (a) bảng tuần Chốt ca 16/11–22/11, cơ sở 1: ô ca đã gửi phiếu có hai dòng Việc · Tiền (hoặc ✓ Đã đối soát)
      await go('#/ca?cn=1&tuan=2026-11-16', '.cw-c[data-id="182"]');
      const sent = [161, 162, 163, 171, 172, 173, 181, 182, 183].map(cell).filter(Boolean);
      ok(sent.length === 9 && sent.every((c) => (c.querySelector('.cw-dv') && c.querySelector('.cw-dt')) || /đã đối soát/.test(txt(c))), `(a) 9 ô ca đã gửi phiếu đều có Việc · Tiền (${sent.length} ô)`);
      ok(/⏳/.test(txt(cell(172)?.querySelector('.cw-dt'))) && /🔴/.test(txt(cell(182)?.querySelector('.cw-dt'))) && /–/.test(txt(cell(182)?.querySelector('.cw-dv'))),
        `(a) ca 172 chờ kế toán ⏳ · ca 182 ô đỏ 🔴, chưa làm phần việc – (172: ${txt(cell(172)?.querySelector('.cw-dt'))} · 182: ${txt(cell(182)?.querySelector('.cw-dv'))} ${txt(cell(182)?.querySelector('.cw-dt'))})`);
      ok(!!$('.cw-lgds'), '(a) có chú thích ký hiệu Việc · Tiền');
      // anh Tiến chốt 23/11: ca đã bấm Hoàn thành tiền mà còn chênh lệch chờ xử lý (183: thiếu tiền mặt 30.000) → Tiền 🟠, chú thích có 🟠
      ok(/🟠/.test(txt(cell(183)?.querySelector('.cw-dt'))) && /còn chênh lệch/.test((cell(183)?.getAttribute('title') || '').toLowerCase()) && /🟠/.test(txt($('.cw-lgds'))),
        '(a) ca 183 Hoàn thành tiền còn chênh lệch → Tiền 🟠 (' + txt(cell(183)?.querySelector('.cw-dt')) + ')');
      // (b) đầu bảng: Còn N ca chưa đối soát xong · Làm ca cũ nhất ›
      const con = $('.cw-con'); const lk = con?.querySelector('a');
      ok(!!con && /còn \d+ ca chưa đối soát xong/.test(txt(con)) && /#\/ca\/doi-soat\?id=141(&|$)/.test(lk?.getAttribute('href') || ''), '(b) dòng "Còn N ca chưa đối soát xong" → ca cũ nhất 141: ' + txt(con).slice(0, 80) + ' ' + (lk?.getAttribute('href') || ''));
      // bấm ô ca → thẳng trang đối soát của ca, đúng tab
      cell(182)?.click(); await until(() => location.hash.startsWith('#/ca/doi-soat'));
      ok(/^#\/ca\/doi-soat\?id=182&tab=viec/.test(location.hash), '(a2) bấm ô 182 → trang đối soát của ca, tab ①: ' + location.hash.slice(0, 50));
      if (window.innerWidth <= 430) ok(fits(), '(l) bảng tuần không tràn ngang 390px');
      // (e) đường cũ Sổ thu chi › Đối soát Fabi → trang đối soát của ca (tab ②, giữ bước)
      await go('#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11&ds=182&b=2');
      await until(() => location.hash.startsWith('#/ca/doi-soat'));
      const hp = new URLSearchParams(location.hash.split('?')[1] || '');
      ok(location.hash.startsWith('#/ca/doi-soat') && hp.get('id') === '182' && hp.get('tab') === 'tien' && hp.get('b') === '2', `(e) đường cũ ?tab=doi-soat&ds=182&b=2 → ${location.hash.slice(0, 70)}`);
      // (f) Sổ thu chi chỉ còn Tổng · Sổ thu · Sổ chi
      await go('#/quan-ly/so-thu-chi?cn=1&thang=2026-11', '.stc-tabs');
      const tabs = $$('.stc-tabs a').map((a) => txt(a));
      ok(tabs.length === 3 && !tabs.some((t) => t.includes('đối soát')), '(f) Sổ thu chi không còn tab Đối soát Fabi: ' + tabs.join(' · '));
      const m = await import('../js/pages/so_thu_chi.js');
      ok(typeof m.stcPart === 'function' && typeof m.stcBind === 'function', '(e2) so_thu_chi.js có stcPart / stcBind (khối số máy Fabi dùng chung cho trang đối soát ca)');

      // 28/11/2026 (anh Tiến: "xoá đối soát cũ"): (c)…(k) kiểm trên trang mới #/ca/doi-soat?id= — 3 bước ① Phần việc · ② Tiền · ③ Hoàn thành, đi lần lượt
      const { rpc } = await import('../js/sb.js');
      const tab = (k) => $(`[data-dsm-tab="${k}"]`); const pane = (k) => $(`[data-dsm-pane="${k}"]`);
      const all = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();   // cả phần đang ẩn
      await go('#/ca/doi-soat?id=182', '#dsm');
      const pts = $$('[data-dsm-tab]').map((x) => x.dataset.dsmTab);
      ok(pts.join(',') === 'viec,tien,xong', '(c) 3 bước ① Phần việc · ② Tiền · ③ Hoàn thành: ' + pts.join(','));
      ok(tab('viec')?.getAttribute('aria-selected') === 'true' && pane('tien')?.hidden && !pane('viec')?.hidden && tab('tien')?.dataset.lock === '1' && tab('xong')?.dataset.lock === '1', '(c) ca chưa làm phần việc → mở bước ①, bước ② ③ khoá');
      ok(pane('tien')?.querySelectorAll('.stc-dsp').length === 2 && pane('tien')?.querySelectorAll('.dsm-sec').length >= 2 && !$('.stc-steps'), '(c) bước ② có số máy Fabi, tiền thực nhận, sổ Tiền mặt, sổ Chuyển khoản; không còn thanh 6 bước cũ');
      ok(/#\/ca\/phieu\?id=182(&|$)/.test($('#dsm-phieu')?.getAttribute('href') || ''), '(c) đầu trang có "Xem phiếu nhân viên"');
      ok(!$('.pc-unified-steps') && !$('#pc-form') && !$('.ds-ptabs') && !$('#stc-page.stc-one'), '(n) không còn trang đối soát cũ (3 thẻ cũ, thanh bước phiếu nhân viên, khối 6 bước)');
      // (o) Nhập hàng (luật 15/11, anh Tiến chốt 22/11 "chỉ hiện khi còn hàng"): ca không gắn hàng kho tổng (182) — bước ① không nhắc hàng chưa đối soát
      ok(!/hàng kho tổng chưa đối soát|hàng chưa đối soát/.test(all(pane('viec'))), '(o) ca không gắn hàng kho tổng: bước ① không nhắc hàng chưa đối soát');
      // (p) ca cũ còn hàng kho tổng chưa đối soát (gắn thử vào ca 183) → bước ① nhắc
      await rpc('app__test_ca_hang', { p_id: 183 });
      await go('#/ca/doi-soat?id=183&tab=viec&t=p', '#dsm'); await sleep(300);
      ok(/chưa đối soát/.test(all(pane('viec'))) && /hàng/.test(all(pane('viec'))), '(p) ca còn hàng kho tổng chưa đối soát: bước ① có nhắc · thấy: ' + ((all(pane('viec')).match(/.{0,70}chưa đối soát.{0,70}/) || ['—'])[0]));
      // (d) ③ khoá khi còn phần việc; xong phần việc thì mở
      const { TICKS } = await import('../js/so_thu_chi_tinh.js');
      await rpc('app__test_stc_ca', { p_id: 161, p: { ticks: TICKS, done: null } });
      await fresh(); await go('#/ca/doi-soat?id=161&tab=xong', '#dsm');
      ok(tab('xong')?.dataset.lock === '1' && pane('xong')?.hidden, '(d) còn phần việc → bước ③ Hoàn thành khoá (mở đường dẫn tab=xong vẫn không vào được)');
      for (const it of ['nhan_su', 'ban_giao', 'nhap_hang']) await rpc('app_ca_check', { p_id: 161, p_item: it, p_on: true });
      await fresh(); await go('#/ca/doi-soat?id=161&tab=xong', '#dsm');
      ok(!!$('#dsm-done') && tab('xong')?.dataset.lock !== '1', '(d) xong phần việc + tích đủ phần tiền → bước ③ mở, có nút Hoàn thành · thấy: ' + all(pane('xong')).slice(0, 200));
      // (g) Ca tiếp theo chưa xong
      const nxt = () => $$('.dsm-nav a').find((x) => /tiếp theo chưa xong/.test(all(x)));
      const nx = nxt();
      ok(!!nx && /#\/ca\/doi-soat\?id=162(&|$)/.test(nx.getAttribute('href') || ''), '(g) "Ca tiếp theo chưa xong ›" sang ca 162: ' + (nx?.getAttribute('href') || 'không thấy'));
      // (i) ca nhân viên đang chốt dở → báo chưa hoàn thành phiếu (không vỡ trang)
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const idOpen = await rpc('app_ca_open', { p_branch: 1, p_date: today, p_shift: 'Sáng' });
      await go(`#/ca/doi-soat?id=${idOpen}`, '#root .card, #dsm, #root .alert');
      ok(/chưa hoàn thành phiếu chốt ca|chưa gửi phiếu|chưa chốt/.test(txt($('#root'))) && !$('#dsm-done'), '(i) ca đang chốt dở → trang báo nhân viên chưa xong phiếu, không Hoàn thành được · thấy: ' + (txt($('#root')).match(/.{0,50}chưa (hoàn thành phiếu|gửi phiếu|chốt).{0,50}/) || ['—'])[0]);
      // (k) ca chờ kế toán (172): bước ② ghi Chờ kế toán, nút Ca tiếp theo bỏ qua ca chờ kế toán
      await go('#/ca/doi-soat?id=172', '#dsm');
      const nk = nxt();
      ok(/chờ kế toán/.test(all(pane('tien'))) && !!nk && !/id=172(&|$)/.test(nk.getAttribute('href') || '') && /id=173(&|$)/.test(nk.getAttribute('href') || ''), '(k) ca chờ kế toán: báo Chờ kế toán, Ca tiếp theo → 173: ' + (nk?.getAttribute('href') || 'không thấy'));
    }
    if (role === 'kt' || role === 'nv') {   // (h) không đối soát được (Kế toán) · (j) nhân viên: ô như cũ, bấm ô mở phiếu chốt ca
      await go('#/ca?cn=1&tuan=2026-11-16', '.cw-c');
      ok(!$('.cw-dv') && !$('.cw-dt') && !$('.cw-con'), `(${role === 'kt' ? 'h' : 'j'}) không có dòng Việc · Tiền / Còn N ca`);
      const c = cell(182);
      if (c) { c.click(); await until(() => location.hash.startsWith('#/ca/phieu')); ok(/^#\/ca\/phieu\?id=182/.test(location.hash), `(${role === 'kt' ? 'h' : 'j'}) bấm ô → phiếu chốt ca: ` + location.hash.slice(0, 40)); }
    }
    ok(fits(), '(l) không tràn ngang');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e?.stack || e?.message || e)); }
  out.push({ dsca: { ok: good, fail: bad } });
};
