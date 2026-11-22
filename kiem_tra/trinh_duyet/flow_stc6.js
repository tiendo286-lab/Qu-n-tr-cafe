// Bài thử bước 151 (sửa bước 158: đã bỏ Chốt ca vĩnh viễn + Khoản treo): tab Đối soát Fabi (A · Fabi → B · Thu chi của ca → 🔒 Chốt ca) + Khoản treo ở tab Tổng.
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc6 và test/phone.html?... ; role=qlt cũng chốt được. Kết quả: out[].stc6 = { ok, fail }.
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): khối 6 bước nay ở trang đối soát của ca (bước 1–5 = tab ② Phần tiền, bước 6 = tab ③);
//   đường cũ ?tab=doi-soat&ds= tự chuyển sang; lưới ca của tab cũ bỏ → trạng thái ca xem ở nhãn đầu khối tiền. Chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
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
  // bước 168: điện thoại đang mở ca thì lịch thu gọn thành "‹ Chọn ca khác" — bấm để xem ô lịch rồi chọn lại ca
  const calCell = async () => ({ t: txt($('.stc-dsp .stc-dsh .pill')) });   // trạng thái ca: nhãn đầu khối tiền (lưới ca của tab cũ đã bỏ)
  const submit = async () => { $('button[type=submit]', dlg()).click(); await sleep(1000); };
  const st = async (i) => { const b = $(`.stc-dsp .stc-steps [data-dsstep="${i}"]`); if (b) { b.click(); await sleep(350); } };   // bước 171: sang bước i + 1 của ca đang mở
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 1. ca Tối 18/11 (đã xác nhận Fabi, thiếu tiền mặt 30.000 chưa xử lý)
    await open(183);
    ok(/phần tiền/.test(txt($('.ds-pt[aria-selected="true"]'))) && !!$('#stc-page.stc-one[data-ds="183"]'), '1. mở đúng tab ② Phần tiền của trang đối soát ca 183 (thay tab "Đối soát Fabi" cũ)');
    await st(1);
    ok(txt($('.stc-dsh')).includes('ca tối 18/11') && txt($('.stc-dsh')).includes('còn lệch') && !!$('.stc-pa [data-dsreopen]'), '1. mở thẳng ca Tối 18/11, đã xác nhận (bước 2 có Mở lại xác nhận) · 🟠 Còn lệch');
    ok(txt($('.stc-pa .stc-dsnote')).includes('tiền mặt thiếu −30.000 → chưa xử lý'), '1b. bước 161: Ghi chú đối soát "Tiền mặt thiếu −30.000 → chưa xử lý"');
    { const c = await calCell(183); ok(c.t.includes('còn lệch') && c.t.includes('🟠'), '1b. ca Tối 18/11 hiện "🟠 Còn lệch" (nhãn đầu khối tiền)'); }
    await st(3);
    ok($$('.stc-pb .stc-cab .stc-it').some((i) => txt(i).includes('quản lý lấy tiền két')) && !$$('.stc-pb .stc-cab .stc-it').some((i) => txt(i).includes('ca thiếu tiền')) && !$('.stc-step .stc-glc'), '2. bước 4 Khoản chi chỉ có thu chi thật, chênh lệch nằm ở bước 5');
    await st(4);
    { const [gtm, gck] = $$('.stc-step .stc-glc');
      ok(!!gtm && txt($('h2', gtm)).includes('tiền mặt') && $$('[data-gap]', gtm).length === 1 && txt(gtm).includes('30.000'), '2. bước 5: khung Tiền mặt có 1 dòng thiếu 30.000');
      ok(!!gck && txt($('h2', gck)).includes('chuyển khoản') && !$$('[data-gap]', gck).length && txt(gck).includes('không lệch chuyển khoản'), '2. bước 5: khung Chuyển khoản không có dòng lệch'); }
    ok(!$('[data-dsfinal]') && !$('.stc-fin'), '3. bước 158: không còn nút / khung Chốt ca');
    wide('3. Đối soát Fabi');
    // 4. xử lý phiếu chênh lệch: trừ lương 30.000 → chốt được
    $('.stc-glc [data-gap]').click(); await wait('dialog[open]', 30); await sleep(300);
    setv('[name=reason]', 'thiếu thật'); await submit();
    if (dlg()) { bad.push('4. phiếu trừ lương lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
    await open(183);
    ok(!!$('[data-tab-pane="xong"] [data-dsundone]'), '5. ca đã hoàn thành: tab ③ Hoàn thành có nút Mở lại');
    { const c = await calCell(183); ok(c.t.includes('hoàn thành') && c.t.includes('🟢'), '5. bước 161: trừ lương xong → "🟢 Hoàn thành" (nhãn đầu khối tiền)'); }
    await st(1);
    ok(txt($('.stc-pa .stc-dsnote')).includes('đã xử lý') && txt($('.stc-pa .stc-dsnote')).includes('trừ lương') && $('.stc-pa .stc-dsnote').classList.contains('ok'), '5. Ghi chú đối soát chuyển xanh: "đã xử lý (trừ lương …)"');
    ok(!/khoản treo|ca đã chốt/.test(txt($('#root'))), '5. không còn ô "Ca đã chốt" / "Khoản treo"');
    // bước 171: đã hoàn thành thì khoá thêm phiếu; Mở lại → thêm được, ca về 🔵
    await st(2); const khoa = !$('.stc-pb [data-addca]'); $('[data-tab-pane="xong"] [data-dsundone]').click(); await sleep(800); await st(2); const mo = !!$('.stc-pb [data-addca]'); await st(1);
    ok(khoa && mo && !!$('[data-dsreopen]') && txt($('.stc-dsh')).includes('🔵'), '5. bước 171: đã hoàn thành thì khoá thêm phiếu; Mở lại → thêm phiếu được, ca 🔵, vẫn có Mở lại xác nhận');
    // 6. Sổ chi chung: ca đã chốt không còn nút
    location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-pay'); await sleep(300);
    $('.stc-all')?.click(); await sleep(400);
    const caRow = $$('.stc-ca').find((c) => txt(c).includes('quản lý lấy tiền két'));
    ok(!!caRow && !txt(caRow).includes('ca đã chốt') && !!caRow.querySelector('[data-addca]'), '6. Sổ chi chung: ca đã xác nhận (vừa Mở lại) có nút thêm, không còn "Ca đã chốt"');
    { const dn = $$('.stc-ca').find((c) => txt(c).includes('đã hoàn thành đối soát'));
      ok(!!dn && !dn.querySelector('[data-addca]') && !!dn.querySelector('a[href*="#/ca/doi-soat?id="]'), '6. bước 171: ca đã hoàn thành → không có nút thêm, có đường dẫn sang trang đối soát ca để Mở lại'); }
    const c182 = $$('.stc-ca').find((c) => txt(c).includes('mua sữa tươi'));
    ok(!!c182 && !!c182.querySelector('a[href*="#/ca/doi-soat?id=182"]'), '6. ca chưa xác nhận: đường dẫn sang trang đối soát ca');
    // 6b. khôi phục phiếu xoá nhầm (ca Sáng 18/11 đã xác nhận Fabi, chưa chốt)
    await open(181); $('[data-tab-pane="xong"] [data-dsundone]')?.click(); await sleep(800); await st(3);   // bước 171: ca đã hoàn thành phải Mở lại mới xoá / khôi phục phiếu được
    const rowOf = (t) => [...document.querySelectorAll('.stc-pb .stc-cab .stc-it')].find((i) => txt(i).includes(t) && !i.classList.contains('void'));
    const md = rowOf('mua đá');
    if (md && md.querySelector('button.stc-ed')) {
      md.querySelector('button.stc-ed').click(); await wait('dialog[open]', 30); await sleep(200);
      setv('[name=reason]', 'thử xoá'); $('.stc-del', dlg()).click(); await sleep(1000);
      await open(181); await st(3);
      const vd = [...document.querySelectorAll('.stc-pb .stc-cab .stc-it.void')].find((i) => txt(i).includes('mua đá'));
      ok(!!vd && !!vd.querySelector('[data-restore]') && !rowOf('mua đá'), '6b. xoá phiếu → gạch ngang, có nút Khôi phục phiếu');
      vd.querySelector('[data-restore]').click(); await wait('dialog[open]', 30); await sleep(200); await submit();
      await open(181); await st(3);
      ok(!!rowOf('mua đá'), '6b. khôi phục → phiếu "Mua đá" trở lại (phiếu xoá vẫn gạch ngang)');
    } else bad.push('6b. không thấy nút Sửa / Xoá của "Mua đá"');
    // 8. tab Tổng: không còn Khoản treo / Ca chưa chốt
    location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-big'); await sleep(400);
    ok(!$$('.stc-tile').some((t) => /khoản treo|ca chưa chốt/.test(txt(t))) && !$$('.stc-side').some((c) => txt(c).includes('khoản treo')), '8. tab Tổng: không còn ô / khung Khoản treo, Ca chưa chốt');
    ok($$('.stc-todo .stc-ti[data-kind=fabi]').some((t) => txt(t).includes('chưa xác nhận fabi')), '8. tab Tổng: khung Việc cần làm có "Ca … chưa xác nhận Fabi" (bước 166)');
    wide('8. Tổng');
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc6: { ok: good, fail: bad } });
};
