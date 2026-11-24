// Bài thử bước 153: (1) lọc "Có trừ lương" hiện MỌI phiếu trừ lương + Sửa / Xoá; (2) "→ Trừ lương" / "Bỏ chuyển" trên khoản chi của ca;
// (3) nút "Phiếu chi chuyển khoản" của ca ở Sổ chi · bảng Chuyển khoản. Chạy: index.html?auto=1&role=chu|qlt|ql&confirm=1&script=flow_stc8 (+ test/phone.html).
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): khối tiền một ca ở trang đối soát ca #/ca/doi-soat?id= (bước 1–5 = tab ②, bước 6 = tab ③). Chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg() || document); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const submit = async () => { $('button[type=submit]', dlg()).click(); await sleep(1000); };
  const wide = (m) => { if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const BASE = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11';
  const go = async (h) => { location.hash = h + '&t=' + Date.now(); await sleep(400); await wait('.stc-flt'); await sleep(500); };
  const rows = () => $$('#stc-book .stc-fr');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. mọi phiếu trừ lương + giải trình
    await go(BASE + '&loc=st:tl');
    ok(txt($('#stc-book h2')).includes('phiếu trừ lương') && rows().length >= 2, `1. lọc Có trừ lương → danh sách phiếu trừ lương (${rows().length} phiếu)`);
    const lan = rows().find((r) => txt(r).includes('lan')); const minh = rows().find((r) => txt(r).includes('minh'));
    ok(!!lan && txt(lan).includes('em đếm nhầm tờ 20 nghìn') && !!lan.querySelector('[data-kaed]') && !!lan.querySelector('[data-kadel]'), '1. phiếu của Lan: giải trình + nút Sửa / Xoá');
    wide('1. danh sách trừ lương');
    // 2. Sửa: số tiền 15.000, Đã nộp bù
    lan.querySelector('[data-kaed]').click(); await wait('dialog[open] [name=amount]', 40); await sleep(300);
    setv('[name=amount]', '15.000'); setv('[name=st]', 'da_bu'); setv('[name=reason]', 'đã nộp lại'); await submit();
    if (dlg()) { bad.push('2. sửa lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
    await go(BASE + '&loc=st:tl');
    const lan2 = rows().find((r) => txt(r).includes('lan'));
    ok(!!lan2 && txt(lan2).includes('đã nộp bù') && txt(lan2).includes('15.000'), '2. sửa phiếu: Đã nộp bù · 15.000');
    // 3. Xoá phiếu của Minh
    rows().find((r) => txt(r).includes('minh'))?.querySelector('[data-kadel]')?.click(); await wait('dialog[open]', 40); await sleep(200);
    setv('[name=reason]', 'ghi nhầm'); await submit();
    await go(BASE + '&loc=st:tl');
    ok(!!minh && !rows().some((r) => txt(r).includes('minh')), '3. xoá phiếu của Minh → không còn trong danh sách');
    // 4. → Trừ lương trên khoản chi "Mua đá" của ca Sáng 18/11 (đã xác nhận Fabi, chưa chốt)
    // bước 171: → Trừ lương / Phiếu chi chuyển khoản chỉ có ở ca chưa Hoàn thành đối soát → quản lý bấm Mở lại ca Sáng 18/11 ở bước 6 trước
    location.hash = '#/ca/doi-soat-cu?id=181&tab=xong'; await wait('[data-tab-pane="xong"] [data-dsundone]', 60); await sleep(300);
    $('[data-tab-pane="xong"] [data-dsundone]')?.click(); await sleep(900);
    await go(BASE); $('.stc-all')?.click(); await sleep(500);
    const md = () => $$('#stc-book .stc-it').find((i) => txt(i).includes('mua đá') && i.querySelector('[data-toka]'));
    const row = md();
    ok(!!row, '4. khoản chi của ca có nút → Trừ lương');
    if (row) {
      row.querySelector('[data-toka]').click(); await wait('dialog[open] [name=emp_0]', 40); await sleep(300);
      const sel = $('[name=emp_0]', dlg()); sel.value = [...sel.options].find((o) => o.value)?.value || ''; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await submit();
      if (dlg()) { bad.push('4. chuyển lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
      await go(BASE); $('.stc-all')?.click(); await sleep(500);
      const conv = $$('#stc-book .stc-it').find((i) => txt(i).includes('đã chuyển trừ lương'));
      ok(!!conv && txt(conv).includes('không tính chi phí') && !!conv.querySelector('[data-kaundo]'), '4. sau khi chuyển: "Đã chuyển trừ lương", Không tính chi phí, có nút Bỏ chuyển');
      await go(BASE + '&loc=st:tl');
      ok(rows().some((r) => txt(r).includes('âm tiền (khoản chi)')), '4. phiếu trừ lương mới hiện trong lọc Có trừ lương');
      // 5. Bỏ chuyển
      await go(BASE); $('.stc-all')?.click(); await sleep(500);
      $$('#stc-book [data-kaundo]')[0]?.click(); await wait('dialog[open]', 40); await sleep(200); await submit();
      await go(BASE); $('.stc-all')?.click(); await sleep(500);
      ok(!$$('#stc-book .stc-it').some((i) => txt(i).includes('đã chuyển trừ lương')) && !!md(), '5. Bỏ chuyển → khoản chi trở lại, có lại nút → Trừ lương');
    }
    // 5b. anh Tiến chốt 22/11: → Trừ lương hiện người làm ca có ô tích — mặc định không ai được tích; tích ai web tự chia đều (sửa được); vẫn chọn được người ngoài ca
    { const { rpc } = await import('../js/sb.js');
      const ids = await rpc('app__test_ca_staff', { p_id: 181, p_n: 2 });
      await go(BASE); $('.stc-all')?.click(); await sleep(500);
      const r2 = $$('#stc-book .stc-it').find((i) => txt(i).includes('mua đá') && i.querySelector('[data-toka]'));
      r2?.querySelector('[data-toka]').click(); await wait('dialog[open] [data-tlc]', 40); await sleep(300);
      const cbs = $$('[data-tlc]', dlg()); const tick = (c) => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); };
      const amt = (id) => $(`[name=tk_${id}]`, dlg())?.value;
      ok(ids.length === 2 && cbs.length === 2 && !cbs.some((c) => c.checked) && !amt(ids[0]) && !!$('[name=emp_0]', dlg()), '5b. → Trừ lương: 2 người làm ca có ô tích, chưa ai được tích, có ô chọn người ngoài ca');
      if (cbs.length === 2) {
        tick(cbs[0]); await sleep(150); const one = amt(cbs[0].dataset.tlc); tick(cbs[1]); await sleep(150);
        ok(one === '50.000' && amt(cbs[0].dataset.tlc) === '25.000' && amt(cbs[1].dataset.tlc) === '25.000', `5b. tích 1 người → 50.000; tích người thứ 2 → 25.000 / người (thấy ${one})`);
        await submit();
        if (dlg()) { bad.push('5b. chuyển lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
        await go(BASE); $('.stc-all')?.click(); await sleep(500);
        ok($$('#stc-book .stc-it').some((i) => txt(i).includes('đã chuyển trừ lương')), '5b. lưu → khoản chi "Đã chuyển trừ lương" (2 người)');
        $$('#stc-book [data-kaundo]')[0]?.click(); await wait('dialog[open]', 40); await sleep(200); await submit();
      } else if (dlg()) $('[data-x]', dlg())?.click(); }
    // 6. phiếu chi chuyển khoản của ca (bảng Chuyển khoản)
    await go(BASE + '&pm=ck'); $('.stc-all')?.click(); await sleep(500);
    const bo = $('#stc-book [data-bankout]');
    ok(!!bo, '6. Sổ chi · bảng Chuyển khoản: ca có nút "Phiếu chi chuyển khoản"');
    if (bo) { bo.click(); await wait('dialog[open] #stc-bo', 40); await sleep(600); ok(!!$('dialog[open] #stc-bo'), '6. bấm → mở hộp Phiếu chi chuyển khoản của ca'); $('dialog[open] [data-x]')?.click(); await sleep(300); }
    await go(BASE + '&pm=tm'); $('.stc-all')?.click(); await sleep(400);
    ok(!$('#stc-book [data-bankout]'), '6. bảng Tiền mặt không có nút phiếu chi chuyển khoản');
    wide('6. Sổ chi');
    // 7. bước 154: ảnh phiếu Fabi chốt ca xem ở Đối soát Fabi (phần A)
    location.hash = '#/ca/doi-soat-cu?id=182&tab=tien'; await sleep(500); await wait('.stc-dsp'); await sleep(500);
    const pb = $('.stc-pa [data-dsphoto]'); ok(!!pb, '7. phần A có nút 📷 Ảnh phiếu Fabi');
    if (pb) { pb.click(); await wait('dialog[open] #stc-ph', 40); await sleep(1200); ok(!!$('dialog[open] #stc-ph') && !!$('dialog[open] a[href*="#/ca/phieu?id=182"]'), '7. mở hộp ảnh phiếu Fabi + đường dẫn phiếu chốt ca'); $('dialog[open] [data-x]')?.click(); await sleep(300); }
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc8: { ok: good, fail: bad } });
};
