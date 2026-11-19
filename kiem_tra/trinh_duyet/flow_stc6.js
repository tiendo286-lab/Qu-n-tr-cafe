// Bài thử bước 151 (sửa bước 158: đã bỏ Chốt ca vĩnh viễn + Khoản treo): tab Đối soát Fabi (A · Fabi → B · Thu chi của ca → 🔒 Chốt ca) + Khoản treo ở tab Tổng.
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
    ok(txt($('.stc-dsh')).includes('ca tối 18/11') && txt($('.stc-pa')).includes('còn lệch') && !!$('.stc-pa [data-dsreopen]'), '1. mở thẳng ca Tối 18/11, phần A đã xác nhận (thu gọn) · 🟠 Còn lệch');
    ok(txt($('.stc-pa .stc-dsnote')).includes('tiền mặt thiếu −30.000 → chưa xử lý'), '1b. bước 161: Ghi chú đối soát "Tiền mặt thiếu −30.000 → chưa xử lý"');
    ok(txt($('.stc-dsc[data-dsca="183"]')).includes('còn lệch') && txt($('.stc-dsc[data-dsca="183"]')).includes('tm −30k') && $('.stc-dsc[data-dsca="183"]').classList.contains('d-con'), '1b. ô ca Tối 18/11 màu cam "🟠 Còn lệch · TM −30k"');
    ok(!$('.stc-glc .stc-it [data-gap]') && txt($('.stc-glhint')).includes('sổ chi · tiền mặt −30.000'), '2. đang xem Sổ thu · TM: không có dòng thiếu; dòng nhắc "Sổ chi · Tiền mặt −30.000"');
    $('.stc-glhint [data-dsbook]').click(); await sleep(400);
    ok(txt($('.stc-glc h2')).includes('chênh lệch tiền mặt · thiếu') && $$('.stc-glc [data-gap]').length === 1, '2. bấm nhắc → Sổ chi · Tiền mặt: khung Chênh lệch có 1 dòng thiếu');
    ok($$('.stc-pb .stc-cab .stc-it').some((i) => txt(i).includes('quản lý lấy tiền két')) && !$$('.stc-pb .stc-cab .stc-it').some((i) => txt(i).includes('ca thiếu tiền')), '2. sổ của ca chỉ có thu chi thật, chênh lệch nằm khung riêng');
    $('[data-dspm="ck"]').click(); await sleep(400);
    ok(!$$('.stc-glc [data-gap]').length && txt($('.stc-glc')).includes('không có tiền thiếu chuyển khoản'), '2. bảng Chuyển khoản: không có dòng thiếu tiền mặt');
    $('[data-dspm="tm"]').click(); await sleep(300);
    ok(!$('[data-dsfinal]') && !$('.stc-fin'), '3. bước 158: không còn nút / khung Chốt ca');
    wide('3. Đối soát Fabi');
    // 4. xử lý phiếu chênh lệch: trừ lương 30.000 → chốt được
    $('.stc-glc [data-gap]').click(); await wait('dialog[open]', 30); await sleep(300);
    setv('[name=reason]', 'thiếu thật'); await submit();
    if (dlg()) { bad.push('4. phiếu trừ lương lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
    await open(183);
    ok(!!$('[data-dsreopen]') && !!$('.stc-pb [data-addca]'), '5. ca vẫn sửa được: có Mở lại xác nhận + Thêm phiếu');
    ok(txt($('.stc-dsc[data-dsca="183"]')).includes('hoàn thành') && txt($('.stc-dsc[data-dsca="183"]')).includes('lệch tm −30k') && $('.stc-dsc[data-dsca="183"]').classList.contains('d-xong'), '5. bước 161: trừ lương xong → ô ca xanh "🟢 Hoàn thành · lệch TM −30k"');
    ok(txt($('.stc-pa .stc-dsnote')).includes('đã xử lý') && txt($('.stc-pa .stc-dsnote')).includes('trừ lương') && $('.stc-pa .stc-dsnote').classList.contains('ok'), '5. Ghi chú đối soát chuyển xanh: "đã xử lý (trừ lương …)"');
    ok(!txt($('#stc-ds .stc-tiles')).includes('khoản treo') && !txt($('#stc-ds .stc-tiles')).includes('đã chốt'), '5. không còn ô "Ca đã chốt" / "Khoản treo"');
    // 6. Sổ chi chung: ca đã chốt không còn nút
    location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-pay'); await sleep(300);
    $('.stc-all')?.click(); await sleep(400);
    const caRow = $$('.stc-ca').find((c) => txt(c).includes('quản lý lấy tiền két'));
    ok(!!caRow && !txt(caRow).includes('ca đã chốt') && !!caRow.querySelector('[data-addca]'), '6. Sổ chi chung: ca đã xác nhận vẫn có nút thêm, không còn "Ca đã chốt"');
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
    // 8. tab Tổng: không còn Khoản treo / Ca chưa chốt
    location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-big'); await sleep(400);
    ok(!$$('.stc-tile').some((t) => /khoản treo|ca chưa chốt/.test(txt(t))) && !$$('.stc-side').some((c) => txt(c).includes('khoản treo')), '8. tab Tổng: không còn ô / khung Khoản treo, Ca chưa chốt');
    ok($$('.stc-tile').some((t) => txt(t).includes('ca chưa xác nhận fabi')), '8. tab Tổng: ô "Ca chưa xác nhận Fabi"');
    wide('8. Tổng');
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc6: { ok: good, fail: bad } });
};
