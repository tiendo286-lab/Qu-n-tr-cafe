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
      ok(typeof m.caMoney === 'function', '(e2) so_thu_chi.js có caMoney (khối tiền một ca)');

      // (c) trang đối soát của ca: 3 tab, ① mở trước khi phần việc chưa xong, ② có đúng 5 bước tiền, đầu trang có Xem phiếu nhân viên
      const { rpc } = await import('../js/sb.js');
      await go('#/ca/doi-soat?id=182', '.ds-ptabs');
      const pts = $$('.ds-ptabs .ds-pt').map((b) => b.dataset.ptab);
      ok(pts.join(',') === 'viec,tien,xong', '(c) 3 tab ① Phần việc · ② Phần tiền · ③ Hoàn thành: ' + pts.join(','));
      ok($('.ds-pt[data-ptab="viec"]')?.getAttribute('aria-selected') === 'true' && $('[data-tab-pane="tien"]')?.hidden && !$('.ds-tab-viec')?.hidden, '(c) ca chưa làm phần việc → mở tab ①');
      ok($$('[data-tab-pane="tien"] .stc-steps [data-dsstep]').length === 5 && !!$('[data-tab-pane="tien"] .stc-dsp'), '(c) tab ② là khối 6 bước cũ, thanh bước chỉ 5 bước tiền');
      ok(/#\/ca\/phieu\?id=182(&|$)/.test($('.ds-top a.ds-staff')?.getAttribute('href') || ''), '(c) đầu trang có "Xem phiếu nhân viên"');
      // (n) tab ①: chỉ một hàng bước phần việc (không còn bước "Hoàn thành" cũ, không lặp thanh 4 bước của phiếu nhân viên); đèn mục tiền bấm "Xử lý" → tab ②
      ok(!$('.pc-unified-steps') && !!$('#ds-parts .sc-steps') && !/hoàn thành|\btiền\b/.test(txt($('#ds-parts'))), '(n) tab ① chỉ có hàng bước phần việc: ' + txt($('#ds-parts')) + (document.querySelector('.pc-unified-steps') ? ' + thanh 4 bước phiếu nhân viên' : ''));
      await wait('#ds-lights .den-row [data-ds-go="3"]', 40);
      { const xl = $('#ds-lights .den-row [data-ds-go="3"]');
        if (xl) { xl.click(); await sleep(400); ok(!$('[data-tab-pane="tien"]').hidden && $('.ds-pt[data-ptab="tien"]')?.getAttribute('aria-selected') === 'true', '(n) đèn mục tiền bấm "Xử lý" → sang tab ② Phần tiền'); }
        else bad.push('(n) không thấy nút "Xử lý" của mục tiền ở đèn đối soát (ca 182)'); }
      $('.ds-pt[data-ptab="tien"]').click(); await sleep(300);
      ok(!$('[data-tab-pane="tien"]').hidden && $('.ds-tab-viec').hidden && /tab=tien/.test(location.hash), '(c) bấm tab ② → hiện phần tiền, đường dẫn nhớ tab');
      // (m) bước đang mở của khối tiền: mở lại cùng ca bằng đường dẫn có t= mới → về đúng bước b= (như đường cũ của Đối soát Fabi);
      //     đổi tab ③ → ② rồi trang vẽ lại (như sau một thao tác) → vẫn ở bước đang làm, không nhảy về bước đầu
      const curStep = () => $('.stc-dsp .stc-steps [data-dsstep].on')?.dataset.dsstep;
      await go('#/ca/doi-soat?id=182&tab=tien&b=3&t=1', '.stc-dsp');
      $('.stc-dsp .stc-steps [data-dsstep="0"]')?.click(); await sleep(300);
      await go('#/ca/doi-soat?id=182&tab=tien&b=3&t=2', '.stc-dsp');
      ok(curStep() === '2', '(m) mở lại cùng ca với t= mới → về đúng bước b=3 (thấy bước ' + (Number(curStep()) + 1) + ')');
      $('.stc-dsp .stc-steps [data-dsstep="1"]')?.click(); await sleep(300);
      $('.ds-pt[data-ptab="xong"]')?.click(); await sleep(200); $('.ds-pt[data-ptab="tien"]')?.click(); await sleep(200);
      window.dispatchEvent(new HashChangeEvent('hashchange')); await sleep(900); await wait('.stc-dsp'); await sleep(300);
      ok(curStep() === '1' && /tab=tien/.test(location.hash), '(m) đổi tab rồi trang vẽ lại → vẫn ở bước đang làm (bước 2), thấy bước ' + (Number(curStep()) + 1));
      // (o) Nhập hàng (luật 15/11, anh Tiến chốt 22/11 "chỉ hiện khi còn hàng"): ca không gắn hàng kho tổng (182) — ngay lần mở đầu không thấy dòng "Nhập hàng"
      //     ở bảng đèn, bước Bàn giao không nhắc hàng chưa đối soát, tóm tắt phần việc không ghi Nhập hàng
      await go('#/ca/doi-soat?id=182&tab=viec&t=o', '#ds-lights .den-list'); await sleep(300);
      ok(!/nhập hàng/.test(txt($('#ds-lights'))) && !/hàng kho tổng chưa đối soát/.test(txt($('.ds-pane[data-ds="2"]'))) && !/nhập hàng/.test(txt($('.ds-wsum'))),
        '(o) ca không gắn hàng kho tổng: không thấy "Nhập hàng" (bảng đèn: ' + ($$('#ds-lights .den-row strong').map((x) => txt(x)).join(', ') || '—') + ')');
      // (p) ca cũ còn hàng kho tổng chưa đối soát (gắn thử vào ca 183) → dòng "Nhập hàng" đỏ + bước Bàn giao nhắc sang Hàng hoá › Đối soát
      await rpc('app__test_ca_hang', { p_id: 183 });
      await go('#/ca/doi-soat?id=183&tab=viec&t=p', '#ds-lights .den-list'); await sleep(300);
      { const row = $$('#ds-lights .den-row').find((x) => /nhập hàng/.test(txt(x)));
        ok(!!row && row.classList.contains('r') && /hàng kho tổng chưa đối soát/.test(txt($('.ds-pane[data-ds="2"]'))) && !!$('.ds-pane[data-ds="2"] a[href*="#/hang-hoa/doi-soat"]'),
          '(p) ca còn hàng chưa đối soát: dòng "Nhập hàng" đỏ + bước Bàn giao có nút sang Hàng hoá › Đối soát'); }
      // (d) ③ khoá khi còn phần việc; xong phần việc thì mở
      const { TICKS } = await import('../js/so_thu_chi_tinh.js');
      await rpc('app__test_stc_ca', { p_id: 161, p: { ticks: TICKS, done: null } });
      await fresh(); await go('#/ca/doi-soat?id=161&tab=xong', '[data-tab-pane="xong"]');
      const dn = $('[data-tab-pane="xong"] [data-dsdone]');
      ok(!$('[data-tab-pane="xong"]').hidden && !!dn && dn.disabled && /còn phần việc/.test(txt($('[data-tab-pane="xong"]'))), '(d) tab ③: còn phần việc → nút Hoàn thành khoá, ghi "Còn phần việc" · thấy: ' + txt($('[data-tab-pane="xong"]')).slice(0, 220));
      // nhập hàng tách sang menu Hàng hoá từ 15/11: tóm tắt phần việc gọi bước cuối là "Bàn giao" như thanh bước, không ghi "nhận hàng"
      ok(/bàn giao/.test(txt($('.ds-wsum'))) && !/nhận hàng/.test(txt($('.ds-wsum'))), '(d) tóm tắt phần việc: bước "Bàn giao" (không ghi "nhận hàng") · thấy: ' + txt($('.ds-wsum')).slice(0, 120));
      for (const it of ['nhan_su', 'ban_giao', 'nhap_hang']) await rpc('app_ca_check', { p_id: 161, p_item: it, p_on: true });
      await fresh(); await go('#/ca/doi-soat?id=161&tab=xong', '[data-tab-pane="xong"]');
      ok(!!$('[data-tab-pane="xong"] [data-dsdone]') && !$('[data-tab-pane="xong"] [data-dsdone]').disabled, '(d) xong phần việc + tích đủ phần tiền → nút Hoàn thành bấm được · thấy: ' + txt($('[data-tab-pane="xong"]')).slice(0, 220));
      // (g) Ca tiếp theo chưa xong
      const nx = $('.ds-top #ds-nextca2');
      ok(!!nx && /#\/ca\/doi-soat\?id=162(&|$)/.test(nx.getAttribute('href') || ''), '(g) "Ca tiếp theo chưa xong ›" sang ca 162: ' + (nx?.getAttribute('href') || 'không thấy'));
      // (i) ca nhân viên đang chốt dở mở bằng đường mới → báo chưa hoàn thành phiếu (không vỡ trang)
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const idOpen = await rpc('app_ca_open', { p_branch: 1, p_date: today, p_shift: 'Sáng' });
      await go(`#/ca/doi-soat?id=${idOpen}`, '#root .card');
      ok(/chưa hoàn thành phiếu chốt ca/.test(txt($('#root'))) && !$('.ds-ptabs'), '(i) ca đang chốt dở → "Nhân viên chưa hoàn thành phiếu chốt ca…", không có 3 tab');
      // (k) ca chờ kế toán (172): trang báo Chờ kế toán, nút Ca tiếp theo bỏ qua ca chờ kế toán
      await go('#/ca/doi-soat?id=172', '#root .card');
      const nk = $('#ds-nextca2');
      ok(/chờ kế toán/.test(txt($('#root'))) && !!nk && !/id=172(&|$)/.test(nk.getAttribute('href') || '') && /id=173(&|$)/.test(nk.getAttribute('href') || ''), '(k) ca chờ kế toán: báo Chờ kế toán, Ca tiếp theo → 173: ' + (nk?.getAttribute('href') || 'không thấy'));
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
