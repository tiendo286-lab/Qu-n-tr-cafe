// Bài thử Sổ thu chi mới đợt 5: tab Tổng đủ nút (Chuyển về Quỹ ngoài, Đã nhận tiền, Luân chuyển, Kiểm quỹ + Điều chỉnh) và Quỹ ngoài ghi được.
// Chạy: index.html?auto=1&confirm=1&role=chu&script=flow_stc5 và test/phone.html?...; role=qlt: không có nút Đã nhận tiền. Kết quả: out[].stc5 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = localStorage.getItem('test_role');
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg()); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const save = async () => { $('button[type=submit]', dlg()).click(); await sleep(900); };
  const TONG = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11', XT = '#/quan-ly/so-thu-chi?tab=tong&cn=ngoai&thang=2026-11';
  const XCHI = '#/quan-ly/so-thu-chi?tab=chi&cn=ngoai&thang=2026-11';
  const go = async (h, sel = '.stc-head') => { location.hash = h; await sleep(300); await wait(sel); await sleep(500); };
  const openD = async (el) => { el.click(); await wait('dialog[open]', 30); await sleep(250); };
  const qn = (t) => $$('.stc-qnl').find((r) => txt(r).includes(t));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    if (role === 'qlt') {
      await go(TONG, '.stc-big');
      ok(!!$('button.stc-qnadd:not([disabled])'), 'Q1. Quản lý tổng tạo được Chuyển về Quỹ ngoài');
      ok($$('.stc-qnl').length > 0 && !$('[data-qnok]'), 'Q2. Quản lý tổng không có nút Đã nhận tiền');
      out.push({ stc5: { ok: good, fail: bad } }); return;
    }
    // 1. tạo Chuyển về Quỹ ngoài
    await go(TONG, '.stc-big');
    await openD($('button.stc-qnadd'));
    ok(!!$('.stc-bal', dlg()), '1. hộp thoại có số dư');
    setv('[name=m]', 'tien_mat'); setv('[name=amount]', '2.000.000'); setv('[name=note]', 'Nộp chủ thử'); await save(); await go(TONG, '.stc-big');
    const r1 = qn('nộp chủ thử');
    ok(!!r1 && txt(r1).includes('2.000.000') && txt(r1).includes('chờ chủ nhận') && !!$('[data-qnok]', r1) && !!$('[data-qned]', r1), '1. có ở danh sách, chờ Chủ nhận, có nút Đã nhận tiền + Sửa / Xoá');
    // 2. sửa khi còn chờ
    await openD($('[data-qned]', r1));
    ok($('[name=note]', dlg()).value === 'Nộp chủ thử', '2. sửa: ghi chú điền sẵn');
    setv('[name=amount]', '2.500.000'); await save(); await go(TONG, '.stc-big');
    ok(txt(qn('nộp chủ thử')).includes('2.500.000'), '2. sửa số tiền → 2.500.000');
    // 3. xoá
    await openD($('[data-qned]', qn('nộp chủ thử'))); $('.stc-del', dlg()).click(); await sleep(900); await go(TONG, '.stc-big');
    ok(!qn('nộp chủ thử'), '3. xoá → không còn');
    // 4. Chủ Đã nhận tiền → khoá
    await openD($('button.stc-qnadd')); setv('[name=amount]', '1.000.000'); setv('[name=note]', 'Giao chủ'); await save(); await go(TONG, '.stc-big');
    $('[data-qnok]', qn('giao chủ')).click(); await sleep(1000); await go(TONG, '.stc-big');
    ok(txt(qn('giao chủ')).includes('chủ đã nhận') && !$('[data-qned]', qn('giao chủ')) && !$('[data-qnok]', qn('giao chủ')), '4. Đã nhận tiền → khoá, hết nút');
    // 5. luân chuyển
    await openD($('button.stc-lcadd'));
    ok($('[name=kind]', dlg())?.value === 'lc', '5. nút Luân chuyển mở sẵn loại Luân chuyển quỹ');
    $('[data-x]', dlg()).click(); await sleep(200);
    // 6. kiểm quỹ lệch → điều chỉnh
    await openD($('button.stc-kq'));
    setv('[name=m]', 'tien_mat'); setv('[name=amount]', '1'); setv('[name=note]', 'Đếm thử thiếu'); await sleep(300);
    ok(txt($('.stc-cmp', dlg())).includes('sổ'), '6. kiểm quỹ so với sổ');
    await save(); await go(TONG, '.stc-big'); await wait('#stc-kqbox .stc-kqr', 40);
    const kr = () => $$('#stc-kqbox .stc-kqr').find((r) => txt(r).includes('đếm thử thiếu'));
    ok(!!kr() && txt(kr()).includes('lệch') && !!$('[data-adj]', kr()), '6. lần kiểm lệch có nút Điều chỉnh');
    ok(txt($('.stc-kqlast')).includes('/11'), '6. ô Kiểm quỹ lần cuối có ngày (' + txt($('.stc-kqlast')) + ')');
    await openD($('[data-adj]', kr())); const cs = $('[name=cat]', dlg()); setv('[name=cat]', cs.options[1]?.value || ''); await save(); await go(TONG, '.stc-big'); await wait('#stc-kqbox .stc-kqr', 40);
    ok(txt(kr()).includes('đã điều chỉnh') && !$('[data-adj]', kr()), '6. điều chỉnh xong → hết nút');
    // 7–8. Quỹ ngoài: thêm / sửa / xoá khoản ngoài
    await go(XCHI, '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
    await openD($('button.stc-xadd'));
    setv('[name=kind]', 'chi'); const xc = $('[name=cat]', dlg()); setv('[name=cat]', xc.options[1]?.value || ''); setv('[name=note]', 'Lương quản lý thử');
    setv('[name=amount]', '3.000.000'); setv('[name=pay]', 'tien_mat'); setv('[name=mode]', 'deu'); await save(); await go(XCHI, '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
    const xi = (t) => $$('.stc-it:not(.void)').find((i) => txt(i).includes(t));
    ok(!!xi('lương quản lý thử') && txt(xi('lương quản lý thử')).includes('3.000.000'), '7. thêm khoản chi ngoài → có trong Sổ chi Quỹ ngoài');
    await openD($('button.stc-ed', xi('mua máy xay')));
    ok($('[name=note]', dlg()).value.toLowerCase().includes('mua máy xay'), '8. sửa khoản ngoài: điền sẵn');
    setv('[name=amount]', '6.500.000'); await save(); await go(XCHI, '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
    ok(txt(xi('mua máy xay')).includes('6.500.000'), '8. sửa → 6.500.000');
    await openD($('button.stc-ed', xi('mua máy xay'))); $('.stc-del', dlg()).click(); await sleep(900); await go(XCHI, '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
    ok(!xi('mua máy xay'), '8. xoá khoản ngoài');
    // 9. Quỹ ngoài: Đã nhận tiền khoản cơ sở chuyển về
    await go(XT, '.stc-big');
    const w2 = $$('.stc-qnl').find((r) => txt(r).includes('chờ chủ nhận'));
    ok(!!w2 && !!$('[data-qnok]', w2), '9. Quỹ ngoài: khoản chờ có nút Đã nhận tiền');
    $('[data-qnok]', w2).click(); await sleep(1000); await go(XT, '.stc-big');
    ok(!$$('.stc-qnl').some((r) => txt(r).includes('chờ chủ nhận')), '9. bấm → hết khoản chờ');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `10. không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message + ' · ' + [...document.querySelectorAll('dialog[open] .stc-err')].map(txt).join(' | ')); }
  out.push({ stc5: { ok: good, fail: bad } });
};
