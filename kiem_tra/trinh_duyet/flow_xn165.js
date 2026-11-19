// Bài thử bước 165: Xem như người khác (chỉ Chủ). Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_xn165 (+ test/phone.html), và role=ql (bị chặn).
// Giả lập (sb_gia.js): localStorage test_viewas = nv | ql | qlt | kt | nvkt khi role=chu → app_me trả người đó + view_as; ghi bị chặn như CSDL chỉ đọc.
// &xnexp=1: phiên xem như hết hạn sau 3 giây → trang phải tự về Chủ. Kết quả: out[].xn165 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 120) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const step = localStorage.getItem('xn_step') || '0';
  const calls = (name) => (window.__LOG || []).filter((x) => x[0] === 'rpc' && x[1] === name);
  const hubHas = async (href) => { location.hash = '#/quan-ly/log?t=' + Date.now(); await sleep(900); return !!document.querySelector(`.hub-tabs a[href="#${href}"]`); };
  const done = () => { out.push({ xn165: { ok: good, fail: bad } }); };
  const next = (s) => { localStorage.setItem('xn_step', s); };
  const keep = () => { try { const o = JSON.parse(localStorage.getItem('xn_res') || '{"ok":[],"fail":[]}'); good.unshift(...o.ok); bad.unshift(...o.fail); } catch (_) { /* bỏ qua */ } };
  const save = () => localStorage.setItem('xn_res', JSON.stringify({ ok: good, fail: bad }));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1000);
  try {
    if (role !== 'chu') {
      ok(!(await hubHas('/he-thong/xem-nhu')), 'Q. người không phải Chủ: không có mục Xem như');
      location.hash = '#/he-thong/xem-nhu'; await sleep(1200);
      ok(/không có quyền/i.test(txt($('#root'))), 'Q. vào thẳng trang Xem như → báo không có quyền');
      return done();
    }
    if (new URLSearchParams(location.search).get('xnexp')) {   // hết hạn giữa chừng
      if (step === '0') { localStorage.setItem('test_viewas', 'ql'); localStorage.setItem('test_viewas_until', String(Date.now() + 3000)); next('exp'); location.reload(); await sleep(60000); return; }
      if (step === 'exp') { ok(!!$('#va-bar'), 'E. đang xem như: có dải vàng'); save(); next('exp2'); await sleep(60000); return; }   // chờ trang tự tải lại khi hết hạn
      keep();
      ok(!$('#va-bar') && !localStorage.getItem('test_viewas'), 'E. hết hạn → trang tự tải lại thành Chủ');
      localStorage.removeItem('xn_step'); localStorage.removeItem('xn_res'); return done();
    }
    if (step === '0') {
      localStorage.removeItem('test_viewas'); localStorage.removeItem('xn_res');
      ok(await hubHas('/he-thong/xem-nhu'), '1. Chủ: nhóm Dữ liệu & LOG có tab Xem như người khác');
      location.hash = '#/he-thong/xem-nhu'; await wait('[data-vapick]', 60); await sleep(300);
      ok($$('[data-vapick]').length >= 5 && $$('.va-group').length >= 3, '1. trang Xem như: danh sách chia theo vai');
      const q = $('.va-q'); q.value = 'quan ly'; q.dispatchEvent(new Event('input', { bubbles: true })); await sleep(300);
      const vis = $$('[data-vapick]').filter((b) => b.offsetParent !== null);
      ok(vis.some((b) => b.dataset.vapick === '5') && !vis.some((b) => b.dataset.vapick === '3'), '1. tìm không dấu "quan ly" ra Quản lý thử');
      save(); next('1');
      $('[data-vapick="5"]').click(); await sleep(60000); return;   // trang tự tải lại
    }
    keep();
    if (step === '1') {
      ok(txt($('#va-bar')).includes('Đang xem như Quản lý thử · Quản lý · LHP — chỉ xem'), '2. dải vàng: "Đang xem như Quản lý thử · Quản lý · LHP — chỉ xem" (' + txt($('#va-bar')).slice(0, 80) + ')');
      location.hash = '#/quan-ly/log?t=' + Date.now(); await sleep(900);
      ok(/không có quyền/i.test(txt($('#root'))) && !document.querySelector('.hub-tabs a[href="#/he-thong/xem-nhu"]'), '2. như Quản lý: không vào được LOG hệ thống, không có Xem như');
      const sb = await import('../js/sb.js'); let msg = '';
      try { await sb.rpc('app_stc_entry_save', { p_id: null, p: {}, p_reason: null }); } catch (e) { msg = e.message || String(e); }
      ok(msg === 'Đang xem như người khác — chỉ xem, không lưu được.', '3. bấm lưu → "Đang xem như người khác — chỉ xem, không lưu được." (' + msg + ')');
      const u = await sb.sb.storage.from('phieu-ca').upload('x/y.jpg', new Blob(['a'])).catch((e) => ({ error: e }));
      ok(String(u?.error?.message || '').includes('chỉ xem'), '3. tải ảnh bị chặn ở web (' + (u?.error?.message || 'không chặn') + ')');
      const r = await sb.sb.storage.from('phieu-ca').remove(['x/y.jpg']).catch((e) => ({ error: e }));
      ok(String(r?.error?.message || '').includes('chỉ xem'), '3. xoá ảnh bị chặn ở web');
      if (window.innerWidth > 400) {
        $('#va-bar [data-va="phone"]').click(); await sleep(800);
        const fr = $('#va-frame');
        ok(!!fr && Math.round(fr.getBoundingClientRect().width) === 390, '4. bấm Điện thoại → khung 390px');
        $('#va-bar [data-va="desk"]').click(); await sleep(800);
        ok(!$('#va-frame'), '4. bấm Máy tính → về khung thường');
      } else ok(document.documentElement.scrollWidth <= window.innerWidth + 1, '4. điện thoại: dải vàng không tràn ngang');
      save(); next('2');
      $('#va-bar [data-va="swap"]').click(); await wait('dialog[open] [data-vapick]', 40); await sleep(300);
      $('dialog[open] [data-vapick="3"]').click(); await sleep(60000); return;
    }
    if (step === '2') {
      ok(txt($('#va-bar')).includes('Đang xem như Nhân viên thử'), '5. Đổi người → dải vàng đổi thành Nhân viên thử');
      save(); next('3');
      $('#va-bar [data-va="exit"]').click(); await sleep(60000); return;
    }
    if (step === '3') {
      ok(!$('#va-bar') && (await hubHas('/he-thong/xem-nhu')), '6. Thoát → về Chủ, lại có LOG hệ thống + Xem như');
      localStorage.removeItem('xn_step'); localStorage.removeItem('xn_res'); return done();
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  localStorage.removeItem('xn_step'); done();
};
