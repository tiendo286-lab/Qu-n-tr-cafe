// Bước 171 (đợt A): Đối soát thu chi của ca đi 6 bước + mục quản lý phải kiểm tra + Hoàn thành đối soát ca. Chạy role chu / qlt / ql, index.html và test/phone.html.
//  a. ca 182 (chưa xác nhận Fabi): thanh 6 bước, bước 3–5 khoá, khung mục kiểm tra, tích mục tay, nút Xác nhận Fabi ở bước 2, khung "sai thì sửa ở đâu"
//  b. ca 181 (đã hoàn thành từ trước): 🟢 / 🟠, phiếu khoá, Mở lại → 🔵 Đã xác nhận Fabi
//  c. chưa tích đủ thì không Hoàn thành được; tích đủ + chọn nhóm + Để sau → Hoàn thành
//  d. Mở lại rồi thêm phiếu chi → mục "khoản chi có thật" tự bỏ tích
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const open = async (id, b) => { location.hash = DS + '&ds=' + id + (b ? '&b=' + b : '') + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(400); };
  const step = async (i) => { $(`.stc-dsp .stc-steps [data-dsstep="${i}"]`)?.click(); await sleep(350); };
  const cur = () => $('.stc-dsp .stc-steps [data-dsstep].on')?.dataset.dsstep;
  const pill = () => txt($('.stc-dsp .stc-dsh .pill'));
  const sb = (await import('/js/sb.js')).sb;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // ---- a. ca 182: chưa xác nhận Fabi
    await open(182);
    ok($$('.stc-dsp .stc-steps [data-dsstep]').length === 6, 'a. thanh 6 bước');
    ok(cur() === '0' && !!$('.stc-dsp .stc-step[data-step="0"]'), 'a. mở ca chưa xác nhận → bước 1');
    const chk = $('.stc-dsp .stc-chk');
    ok(!!chk && txt(chk).includes('quản lý cần kiểm tra') && $$('.stc-ci', chk).length >= 4, 'a. bước 1 có khung "Quản lý cần kiểm tra"');
    ok(!!$('.stc-ci.auto', chk) && !!$('.stc-ci[data-tick="anh"]', chk) && !$('.stc-ci[data-tick="anh"]', chk).classList.contains('ok'), 'a. có mục web tự tích và mục "ảnh phiếu Fabi" chờ quản lý tích');
    ok($$('.stc-dsp .stc-step .stc-mk').length >= 3, 'a. số của mục đặt cạnh chỗ cần xem');
    ok(!!$('.stc-dsp #ds-s1 .stc-c4') && !$('.stc-dsp #ds-s2'), 'a. bước 1 chỉ có phần so phiếu với máy');
    $('.stc-ci[data-tick="anh"]').click(); await sleep(600);
    ok($('.stc-ci[data-tick="anh"]')?.classList.contains('ok'), 'a. bấm tích mục "ảnh phiếu Fabi" → lưu, hiện đã tích');
    $('.stc-ci[data-tick="anh"]').click(); await sleep(600);
    ok(!$('.stc-ci[data-tick="anh"]')?.classList.contains('ok'), 'a. bấm lần nữa → bỏ tích');
    const bar = $('.stc-dsp .stc-dsbar');
    ok(!!bar && getComputedStyle(bar).position === 'sticky' && /bước này còn \d+ mục/.test(txt(bar)) && !!$('[data-dsnext]', bar) && $('[data-dsprev]', bar)?.disabled, 'a. thanh đáy: Quay lại (mờ ở bước 1) · còn N mục · Tiếp');
    $('[data-dsnext]', bar).click(); await sleep(350);
    ok(cur() === '1' && !!$('.stc-dsp #ds-s2') && !$('.stc-dsp #ds-s1'), 'a. Tiếp › sang bước 2 Tiền thực nhận');
    const cl = $('.stc-dsp [data-dsclose]');
    ok(!!cl && cl.disabled && txt(cl).includes('xác nhận fabi') && !txt(cl).includes('hoàn thành') && $$('[data-dsclose]').length === 1, 'a. nút "Xác nhận Fabi" ở cuối bước 2, đang khoá vì còn ô đỏ');
    ok(txt($('.stc-dsp .stc-fixhelp')).includes('sai thì sửa ở đâu') && txt($('.stc-dsp .stc-fixhelp')).includes('kế toán'), 'a. bước 2 có khung "sai thì sửa ở đâu"');
    for (const i of [2, 3, 4]) { await step(i); ok(!!$('.stc-dsp .stc-lockp') && txt($('.stc-dsp .stc-lockp')).includes('xác nhận fabi'), `a. bước ${i + 1} khoá tới khi Xác nhận Fabi`); }
    await step(5);
    ok(!!$('.stc-dsp [data-dsdone]') && $('.stc-dsp [data-dsdone]').disabled, 'a. bước 6: nút Hoàn thành đối soát ca đang khoá');
    wide('a. ca chưa xác nhận');

    // ---- b. ca 181: đã hoàn thành từ trước bước 171
    await open(181);
    ok(/🟢|🟠/.test(pill()), 'b. ca đã xác nhận Fabi từ trước coi như đã Hoàn thành (🟢 / 🟠)');
    ok(cur() === '5' && !!$('.stc-dsp [data-dsundone]') && !$('.stc-dsp [data-dsdone]'), 'b. mở ca đã hoàn thành → bước 6, có nút Mở lại');
    await step(3);
    ok(!$('.stc-dsp .stc-step [data-addca]') && txt($('.stc-dsp .stc-step')).includes('mở lại'), 'b. ca đã hoàn thành: không có nút + Thêm phiếu, có dòng nhắc Mở lại');
    await step(5); $('.stc-dsp [data-dsundone]').click(); await sleep(700);
    ok(pill().includes('đã xác nhận fabi') && pill().includes('🔵'), 'b. Mở lại → 🔵 Đã xác nhận Fabi');
    ok(!!$('.stc-dsp [data-dsdone]') && $('.stc-dsp [data-dsdone]').disabled && /còn \d+ mục/.test(txt($('.stc-dsp .stc-step'))), 'b. chưa tích đủ → nút Hoàn thành khoá, ghi còn N mục');
    ok($$('.stc-dsp .stc-sum [data-dsstep]').length === 5, 'b. bước 6 có tóm tắt 5 bước, bấm để tới');

    // ---- c. tích đủ từng bước rồi Hoàn thành
    for (const i of [0, 1, 2, 3, 4]) {
      await step(i);
      for (let g = 0; g < 8 && $('.stc-dsp .stc-step select.stc-cat.need'); g++) { const s = $('.stc-dsp .stc-step select.stc-cat.need'); s.value = [...s.options].find((o) => o.value)?.value || ''; s.dispatchEvent(new Event('change', { bubbles: true })); await sleep(500); }
      for (let g = 0; g < 4 && $('.stc-dsp .stc-step [data-dssau]:not(.on)'); g++) { $('.stc-dsp .stc-step [data-dssau]:not(.on)').click(); await sleep(500); }
      for (let g = 0; g < 8 && $('.stc-dsp .stc-chk .stc-ci[data-tick]:not(.ok)'); g++) { $('.stc-dsp .stc-chk .stc-ci[data-tick]:not(.ok)').click(); await sleep(500); }
      ok(!$('.stc-dsp .stc-chk .stc-ci:not(.ok)'), `c. bước ${i + 1}: tích xong hết mục (${$$('.stc-dsp .stc-chk .stc-ci').length} mục)`);
    }
    await step(2); ok(!!$('.stc-dsp .stc-step [data-addca]') && $('.stc-dsp .stc-step [data-addca]').dataset.book === 'thu', 'c. bước 3 Khoản thu: có + Thêm phiếu thu');
    await step(3); ok($('.stc-dsp .stc-step [data-addca]')?.dataset.book === 'chi' && !$('.stc-dsp .stc-step [data-dsbook]'), 'c. bước 4 Khoản chi: + Thêm phiếu chi, không còn nút đổi Sổ thu / Sổ chi');
    await step(4); ok(txt($('.stc-dsp .stc-step')).includes('thực nhận − phải có'), 'c. bước 5 ghi rõ phép tính lệch');
    await step(5);
    const dn = $('.stc-dsp [data-dsdone]');
    ok(!!dn && !dn.disabled && txt(dn).includes('hoàn thành đối soát ca'), 'c. tích đủ → nút "🔒 Hoàn thành đối soát ca" bấm được');
    dn.click(); await sleep(800);
    ok(/🟢|🟠/.test(pill()) && !!$('.stc-dsp [data-dsundone]'), 'c. bấm Hoàn thành → 🟢 / 🟠');
    wide('c. bước 6');

    // ---- d. Mở lại, thêm phiếu chi → mục khoản chi tự bỏ tích
    $('.stc-dsp [data-dsundone]').click(); await sleep(700);
    const rs = await sb.rpc('app_stc_move_save', { p_report: 181, p_mkey: null, p: { kind: 'tien_mat', amount: -40000, note: 'Thử 171' }, p_reason: 'thử' });
    ok(!rs?.error, 'd. Mở lại rồi thì thêm phiếu chi vào ca được' + (rs?.error ? ': ' + rs.error.message : ''));
    // phiếu vừa thêm bằng lệnh gọi thẳng → bấm bỏ tích rồi tích lại 1 mục để trang tải lại số mới (như mọi thao tác trên trang)
    await step(0); for (let g = 0; g < 2; g++) { $('.stc-ci[data-tick="anh"]').click(); await sleep(600); }
    await open(181, 4);
    ok(cur() === '3', 'd. đường dẫn b=4 mở đúng bước 4');
    ok(txt($('.stc-dsp .stc-step')).includes('thử 171') && txt($('.stc-dsp .stc-step')).includes('quản lý ghi'), 'd. phiếu quản lý thêm có nhãn "Quản lý ghi"');
    const that = $('.stc-ci[data-tick="that"]');
    ok(!!that && !that.classList.contains('ok'), 'd. thêm phiếu chi → mục "khoản chi có thật" tự bỏ tích');
    await step(0); ok($('.stc-ci[data-tick="anh"]')?.classList.contains('ok'), 'd. mục không liên quan (ảnh phiếu Fabi) vẫn giữ');
    wide('d. cuối');
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message); }
  out.push({ ds171: { ok: good, fail: bad } });
};
