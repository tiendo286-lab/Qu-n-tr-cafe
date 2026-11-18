// Bài thử Sổ thu chi mới đợt 4: tab Đối soát tiền 3 bước (Sửa theo Fabi, ca nào ghi sai mở ca ca đó chịu, tiền thực nhận, Chốt tiền ca / Mở lại chốt).
// Chạy: index.html?auto=1&role=chu&script=flow_stc4 và test/phone.html?... Kết quả: out[].stc4 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg() || document); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const pick = async () => { await wait('[data-dsca="182"]'); $('[data-dsca="182"]').click(); await sleep(400); await wait('.stc-dsp'); };
  const go = async () => { location.hash = DS; await sleep(300); await wait('.stc-dsp'); await sleep(400); await pick(); };
  const box = (k) => $(`.stc-dsp .stc-c4[data-k="${k}"]`);
  const act = async (sel, reason, extra) => { $(sel).click(); await wait('dialog[open]', 30); await sleep(200); if (extra) extra(); if (reason != null) setv('[name=reason]', reason);
    $('button[type=submit]', dlg()).click(); await sleep(900); };
  const settle = async () => { if (!dlg()) { await sleep(300); await go(); } };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await go();
    ok(txt($('.stc-dsh')).includes('ca chiều 18/11'), '1. mở phiếu tiền ca Chiều 18/11');
    ok(!!$('[data-dsclose][disabled]'), '1. còn ô đỏ → nút Chốt tiền ca tắt');
    // 2. mở ca tầng 1: Sửa theo Fabi
    ok(!!$('[data-dsfabi="mo"]', box('mo')) && txt(box('mo')).includes('nv ghi khác fabi'), '2. tiền mở ca: NV ghi khác Fabi → có Sửa theo Fabi');
    await act('[data-dsfabi="mo"]', ''); await settle();
    ok(!!$('[data-dsblame="nay"]', box('mo')) && !!$('[data-dsblame="truoc"]', box('mo')), '2. sửa xong → còn lệch số phải là → chọn Ca trước / Ca này ghi sai');
    // 3. ca trước thu theo ca → không chọn được "ca trước"; chọn "ca này"
    await act('[data-dsblame="truoc"]', 'thử');
    ok(!!dlg() && txt($('.stc-err', dlg())).includes('thu theo ca'), '3. ca trước thu theo ca → báo chọn "Ca này ghi sai"');
    $('[data-x]', dlg()).click(); await sleep(200);
    await act('[data-dsblame="nay"]', ''); ok(!!dlg() && txt($('.stc-err', dlg())).includes('lý do'), '3. chọn ca chịu bắt lý do');
    setv('[name=reason]', 'NV ca chiều đếm nhầm'); $('button[type=submit]', dlg()).click(); await sleep(900); await settle();
    ok(box('mo').classList.contains('ok') && txt(box('mo')).includes('ca này chịu'), '3. mở ca xanh: "Ca này chịu"');
    await act('[data-dsunblame]', 'chọn lại'); await settle();
    ok(!!$('[data-dsblame="nay"]', box('mo')), '3. huỷ chọn → hỏi lại');
    await act('[data-dsblame="nay"]', 'NV ca chiều đếm nhầm'); await settle();
    // 4. nợ: Fabi nhiều hơn → thêm báo nợ phần chênh
    await act('[data-dsfabi="no"]', '', () => { ok(!!$('[name=name]', dlg()), '4. nợ Fabi nhiều hơn → hỏi tên người nợ phần chênh'); setv('[name=name]', 'Khách bàn 3'); }); await settle();
    ok(box('no').classList.contains('ok'), '4. nợ xanh sau Sửa theo Fabi');
    // 5. tiền thực nhận thu theo ca
    $('[data-dsmode="ca"]').click(); await sleep(900); await settle();
    ok(!!$('.stc-dsp [name=ds_tm]'), '5. thu theo ca → có ô nhập tiền mặt thực nhận');
    setv('.stc-dsp [name=ds_tm]', '2.000.000'); $('[data-dscash]').click(); await sleep(900); await settle();
    ok(txt($('.stc-dsp')).includes('2.000.000 (quản lý thu)'), '5. đã lưu tiền mặt thực nhận 2.000.000');
    // 6. chốt
    ok(!!$('[data-dsclose]:not([disabled])'), '6. hết ô đỏ + có tiền thực nhận → Chốt bấm được');
    $('[data-dsclose]').click(); await sleep(1000); await settle();
    ok(txt($('.stc-dsp')).includes('đã chốt') && !!$('[data-dsreopen]') && !$('[data-dsfabi]'), '6. Đã chốt: khoá, có Mở lại chốt');
    location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&pm=tm'; await sleep(300); await wait('.stc-pay'); await sleep(400); $('.stc-all')?.click(); await sleep(300);
    const sua = $$('.stc-it:not(.void)').find((i) => txt(i).includes('mua sữa tươi'));
    ok(!!sua && !!$('button.stc-ed:not([disabled])', sua), '6. chốt xong → khoản của ca sửa được ở Sổ chi');
    // 7. mở lại chốt
    await go(); await act('[data-dsreopen]', 'nhập lại tiền'); await settle();
    ok(!!$('[data-dsclose]') && !txt($('.stc-dsp')).includes('🔒 đã chốt'), '7. Mở lại chốt → về chưa chốt');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message + ' · ' + [...document.querySelectorAll('dialog[open] .stc-err')].map(txt).join(' | ')); }
  out.push({ stc4: { ok: good, fail: bad } });
};
