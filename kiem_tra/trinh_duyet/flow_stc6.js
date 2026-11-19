// Bài thử bước 151: tab Đối soát Fabi (A · Fabi → B · Thu chi của ca → 🔒 Chốt ca) + Khoản treo ở tab Tổng.
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc6 và test/phone.html?... ; role=qlt cũng chốt được. Kết quả: out[].stc6 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg() || document); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const wide = (m) => { if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const open = async (id) => { location.hash = DS + '&ds=' + id + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(400); };
  const submit = async () => { $('button[type=submit]', dlg()).click(); await sleep(1000); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. ca Tối 18/11 (đã xác nhận Fabi, thiếu tiền mặt 30.000 chưa xử lý)
    await open(183);
    ok(txt($('.stc-tabs a.on')) === 'đối soát fabi', '1. tab tên "Đối soát Fabi"');
    ok(txt($('.stc-dsh')).includes('ca tối 18/11') && txt($('.stc-pa')).includes('đã xác nhận'), '1. mở thẳng ca Tối 18/11, phần A đã xác nhận (thu gọn)');
    ok(!$('.stc-glc .stc-it [data-gap]') && txt($('.stc-glhint')).includes('sổ chi · tiền mặt −30.000'), '2. đang xem Sổ thu · TM: không có dòng thiếu; dòng nhắc "Sổ chi · Tiền mặt −30.000"');
    $('.stc-glhint [data-dsbook]').click(); await sleep(400);
    ok(txt($('.stc-glc h2')).includes('chênh lệch tiền mặt · thiếu') && $$('.stc-glc [data-gap]').length === 1, '2. bấm nhắc → Sổ chi · Tiền mặt: khung Chênh lệch có 1 dòng thiếu');
    ok($$('.stc-pb .stc-cab .stc-it').some((i) => txt(i).includes('quản lý lấy tiền két')) && !$$('.stc-pb .stc-cab .stc-it').some((i) => txt(i).includes('ca thiếu tiền')), '2. sổ của ca chỉ có thu chi thật, chênh lệch nằm khung riêng');
    $('[data-dspm="ck"]').click(); await sleep(400);
    ok(!$$('.stc-glc [data-gap]').length && txt($('.stc-glc')).includes('không có tiền thiếu chuyển khoản'), '2. bảng Chuyển khoản: không có dòng thiếu tiền mặt');
    $('[data-dspm="tm"]').click(); await sleep(300);
    ok(!!$('[data-dsfinal][disabled]') && txt($('.stc-fin')).includes('tiền mặt thiếu 30.000'), '3. còn tiền mặt thiếu → Chốt ca tắt, ghi rõ lý do');
    wide('3. Đối soát Fabi');
    // 4. xử lý phiếu chênh lệch: trừ lương 30.000 → chốt được
    $('.stc-glc [data-gap]').click(); await wait('dialog[open]', 30); await sleep(300);
    setv('[name=reason]', 'thiếu thật'); await submit();
    if (dlg()) { bad.push('4. phiếu trừ lương lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
    await open(183);
    ok(!!$('[data-dsfinal]:not([disabled])'), '4. trừ lương xong → Chốt ca bấm được');
    // 5. Chốt ca: hộp xác nhận → chốt vĩnh viễn
    $('[data-dsfinal]').click(); await wait('dialog[open]', 30); await sleep(200);
    ok(txt(dlg()).includes('không sửa được nữa') && txt(dlg()).includes('chốt vĩnh viễn'), '5. hộp xác nhận cảnh báo không sửa được nữa');
    await submit(); await open(183);
    ok(txt($('.stc-fin')).includes('đã chốt ca') && !$('[data-dsfinal]') && !$('[data-dsreopen]'), '5. đã chốt: khung xanh, không còn nút chốt / mở lại xác nhận');
    ok(!$('.stc-pb [data-addca]') && !$('.stc-pb .stc-ed') && !$('.stc-glc [data-gap]'), '5. đã chốt: không còn nút thêm / sửa / phiếu chênh lệch');
    ok(txt($('.stc-dsc[data-dsca="183"]')).includes('đã chốt'), '5. ô ca ghi "Đã chốt ca"');
    // 6. Sổ chi chung: ca đã chốt không còn nút
    location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-pay'); await sleep(300);
    $('.stc-all')?.click(); await sleep(400);
    const caRow = $$('.stc-ca').find((c) => txt(c).includes('quản lý lấy tiền két'));
    ok(!!caRow && txt(caRow).includes('ca đã chốt') && !caRow.querySelector('[data-addca]'), '6. Sổ chi chung: ca đã chốt hiện "🔒 Ca đã chốt", không có nút thêm');
    const c182 = $$('.stc-ca').find((c) => txt(c).includes('mua sữa tươi'));
    ok(!!c182 && !!c182.querySelector('a[href*="ds=182"]'), '6. ca chưa xác nhận: đường dẫn sang Đối soát Fabi');
    // 6b. khôi phục phiếu xoá nhầm (ca Sáng 18/11 đã xác nhận Fabi, chưa chốt)
    await open(181); $('[data-dsbook="chi"]').click(); await sleep(400);
    const rowOf = (t) => [...document.querySelectorAll('.stc-pb .stc-cab .stc-it')].find((i) => txt(i).includes(t) && !i.classList.contains('void'));
    const md = rowOf('mua đá');
    if (md && md.querySelector('button.stc-ed')) {
      md.querySelector('button.stc-ed').click(); await wait('dialog[open]', 30); await sleep(200);
      setv('[name=reason]', 'thử xoá'); $('.stc-del', dlg()).click(); await sleep(1000);
      await open(181); $('[data-dsbook="chi"]').click(); await sleep(400);
      const vd = [...document.querySelectorAll('.stc-pb .stc-cab .stc-it.void')].find((i) => txt(i).includes('mua đá'));
      ok(!!vd && !!vd.querySelector('[data-restore]') && !rowOf('mua đá'), '6b. xoá phiếu → gạch ngang, có nút Khôi phục phiếu');
      vd.querySelector('[data-restore]').click(); await wait('dialog[open]', 30); await sleep(200); await submit();
      await open(181); $('[data-dsbook="chi"]').click(); await sleep(400);
      ok(!!rowOf('mua đá'), '6b. khôi phục → phiếu "Mua đá" trở lại (phiếu xoá vẫn gạch ngang)');
    } else bad.push('6b. không thấy nút Sửa / Xoá của "Mua đá"');
    // 7. ca Sáng 18/11 (dư tiền mặt 20.000): ca sau (Chiều) chưa xong tiền mở ca → chưa chốt được
    await open(181);
    ok(!!$('[data-dsfinal][disabled]') && txt($('.stc-fin')).includes('ca chiều (ca sau) chưa xong tiền mở ca'), '7. ca sau chưa xong tiền mở ca → Chốt ca tắt, ghi rõ lý do');
    // xử lý ca Chiều: lấy số máy Fabi (mở ca) → "Ca này ghi sai"
    await open(182);
    $('[data-dsfabi="mo"]')?.click(); await wait('dialog[open]', 30); await sleep(200); if (dlg()) await submit();
    await open(182);
    $('[data-dsblame="nay"]')?.click(); await wait('dialog[open]', 30); await sleep(200); if (dlg()) { setv('[name=reason]', 'nhận két ghi sai'); await submit(); }
    if (dlg()) { bad.push('7. chọn ca chịu lệch lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
    await open(181);
    ok(txt($('.stc-fin')).includes('khoản treo') && !!$('[data-dsfinal]:not([disabled])'), '7. ca sau xong tiền mở ca → chốt được, báo sẽ thành Khoản treo');
    $('[data-dsfinal]').click(); await wait('dialog[open]', 30); await sleep(200);
    ok(txt(dlg()).includes('tiền thừa chờ ghép'), '7. hộp xác nhận ghi "tiền thừa chờ ghép"'); await submit();
    location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-big'); await sleep(400);
    const tk = $$('.stc-tile').find((t) => txt(t).includes('khoản treo'));
    ok(!!tk && txt(tk).includes('1'), '8. tab Tổng: ô Khoản treo = 1');
    const card = $$('.stc-side').find((s) => txt(s).includes('khoản treo'));
    ok(!!card && txt(card).includes('tiền thừa chờ ghép') && txt(card).includes('ca sáng 18/11'), '8. khung Khoản treo: tiền thừa chờ ghép, ghi ca gốc');
    wide('8. Tổng');
    card.querySelector('[data-treodo="use"]').click(); await wait('dialog[open]', 30); await sleep(200);
    ok(txt(dlg()).includes('chưa có ca phù hợp'), '8. Ghép: không có ca thiếu phù hợp → báo rõ');
    $('[data-x]', dlg()).click(); await sleep(200);
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc6: { ok: good, fail: bad } });
};
