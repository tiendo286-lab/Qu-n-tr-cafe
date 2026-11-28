// Bài thử Sổ thu chi mới đợt 4: tab Đối soát tiền 3 bước (Sửa theo Fabi, ca nào ghi sai mở ca ca đó chịu, tiền thực nhận, Chốt tiền ca / Mở lại chốt).
// Chạy: index.html?auto=1&role=chu&script=flow_stc4 và test/phone.html?... Kết quả: out[].stc4 = { ok, fail }.
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): khối tiền một ca ở trang đối soát ca #/ca/doi-soat?id= (bước 1–5 = tab ②, bước 6 = tab ③). Chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg() || document); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const DS = '#/ca/doi-soat?id=182&tab=tien';   // khối tiền ca Chiều 18/11 ở tab ② trang đối soát ca (lưới ca của tab cũ đã bỏ)
  const go = async () => { location.hash = '#/__tam'; await sleep(250); location.hash = DS; await sleep(300); await wait('.stc-dsp'); await sleep(400); };
  const box = (k) => $(`.stc-dsp .stc-c4[data-k="${k}"]`);
  const st = async (i) => { const b = $(`.stc-dsp .stc-steps [data-dsstep="${i}"]`); if (b) { b.click(); await sleep(350); } };   // bước 171: sang bước i + 1 của ca đang mở
  const act = async (sel, reason, extra) => { $(sel).click(); await wait('dialog[open]', 30); await sleep(200); if (extra) extra(); if (reason != null) setv('[name=reason]', reason);
    $('button[type=submit]', dlg()).click(); await sleep(900); };
  const settle = async () => { if (!dlg()) { await sleep(300); await go(); } };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await go();
    ok(txt($('.stc-dsh')).includes('ca chiều 18/11'), '1. mở phiếu tiền ca Chiều 18/11');
    await st(1); ok(!!$('[data-dsclose][disabled]'), '1. còn ô đỏ → nút Xác nhận Fabi (bước 2) tắt'); await st(0);
    // 2. mở ca tầng 1: Sửa theo Fabi
    ok(!!$('[data-dsfabi="mo"]', box('mo')) && txt(box('mo')).includes('so với máy'), '2. tiền mở ca: nhân viên ghi khác máy → có Lấy số máy Fabi');
    await act('[data-dsfabi="mo"]', ''); await settle();
    ok(!!$('[data-dsblame="nay"]', box('mo')) && !!$('[data-dsblame="truoc"]', box('mo')), '2. sửa xong → còn lệch số phải là → chọn Ca trước / Ca này ghi sai');
    // 3. tệp 154 (anh Tiến chốt 20/11): ca trước thu theo ca CŨNG chọn được "Ca trước ghi sai"; thừa tiền → không có "Hai ca cùng chịu"
    ok(!$('[data-dsblame="doi"]', box('mo')), '3. thừa khi giao ca → không có nút "Hai ca cùng chịu"');
    await act('[data-dsblame="truoc"]', 'thử'); await settle();
    ok(box('mo').classList.contains('ok') && txt(box('mo')).includes('ca trước chịu'), '3. ca trước thu theo ca vẫn chọn được "Ca trước ghi sai"');
    await act('[data-dsunblame]', 'chọn lại'); await settle();
    await act('[data-dsblame="nay"]', ''); ok(!!dlg() && txt($('.stc-err', dlg())).includes('lý do'), '3. chọn ca chịu bắt lý do');
    setv('[name=reason]', 'NV ca chiều đếm nhầm'); $('button[type=submit]', dlg()).click(); await sleep(900); await settle();
    ok(box('mo').classList.contains('ok') && txt(box('mo')).includes('ca này chịu'), '3. mở ca xanh: "Ca này chịu"');
    await act('[data-dsunblame]', 'chọn lại'); await settle();
    ok(!!$('[data-dsblame="nay"]', box('mo')), '3. huỷ chọn → hỏi lại');
    await act('[data-dsblame="nay"]', 'NV ca chiều đếm nhầm'); await settle();
    // 4. nợ: Fabi nhiều hơn → thêm báo nợ phần chênh
    await act('[data-dsfabi="no"]', '', () => { ok(!!$('select[name=name]', dlg()) && !$('input[name=name]', dlg()), '4. nợ Fabi nhiều hơn → hỏi người nợ phần chênh bằng ô chọn (bước 172: chỉ chọn người có sẵn)'); setv('[name=name]', 'Bàn 5'); }); await settle();
    ok(box('no').classList.contains('ok'), '4. nợ xanh sau Sửa theo Fabi');
    // 5. tiền thực nhận thu theo ca
    await st(1); $('[data-dsmode="ca"]').click(); await sleep(900); await settle();
    ok(!!$('.stc-dsp [name=ds_tm]'), '5. thu theo ca → có ô nhập tiền mặt thực nhận');
    setv('.stc-dsp [name=ds_tm]', '2.000.000'); $('[data-dscash]').click(); await sleep(900); await settle();
    ok(txt($('.stc-dsp')).includes('2.000.000 (quản lý thu)'), '5. đã lưu tiền mặt thực nhận 2.000.000');
    // 6. chốt
    ok(!!$('[data-dsclose]:not([disabled])'), '6. hết ô đỏ + có tiền thực nhận → Chốt bấm được');
    $('[data-dsclose]').click(); await sleep(1000); await settle();
    ok($('.stc-dsp .stc-steps [data-dsstep].on')?.dataset.dsstep === '2' && txt($('.stc-dsp .stc-dsh')).includes('🔵'), '6. bước 171: xác nhận xong tự sang bước 3, ca 🔵 Đã xác nhận Fabi (chưa hoàn thành)');
    await st(0); const khoa1 = !$('[data-dsfabi]'); await st(1);
    ok(txt($('.stc-dsp')).includes('đã xác nhận') && !!$('[data-dsreopen]') && khoa1, '6. Đã xác nhận Fabi: bước 1 khoá, bước 2 có Mở lại xác nhận');
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
