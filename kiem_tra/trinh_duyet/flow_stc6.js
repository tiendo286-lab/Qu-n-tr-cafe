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
  const cu = (h) => { const q = new URLSearchParams(String(h).split('?')[1] || ''); const b = q.get('b') || '';   // đợt 4: mở thẳng trang cũ dự phòng
    return q.get('ds') ? '#/ca/doi-soat?id=' + q.get('ds') + '&tab=' + (b === '6' ? 'xong' : 'tien') + (b && b !== '6' ? '&b=' + b : '') + (q.get('t') ? '&t=' + q.get('t') : '') : h; };
  const open = async (id) => { location.hash = cu(DS + '&ds=' + id + '&t=' + Date.now()); await sleep(400); await wait('.stc-dsp'); await sleep(400); };
  // bước 168: điện thoại đang mở ca thì lịch thu gọn thành "‹ Chọn ca khác" — bấm để xem ô lịch rồi chọn lại ca
  const submit = async () => { $('button[type=submit]', dlg()).click(); await sleep(1000); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // 28/11/2026 bỏ trang đối soát cũ (khối 6 bước): mục 1–5 và 6b kiểm trên trang mới #/ca/doi-soat?id= — sổ Tiền mặt / Chuyển khoản, khối Chênh lệch, Hoàn thành / Mở lại
    const secTm = () => $('#dsm .dsm-sec[data-pm="tm"]'); const secCk = () => $('#dsm .dsm-sec[data-pm="ck"]');
    const moLai = async () => { $('#dsm-reopen')?.click(); await wait('dialog[open] form', 40); await sleep(200); $('dialog[open] form [type=submit]')?.click(); await sleep(1500); };
    // 1. ca Tối 18/11 (đã Hoàn thành nhưng còn thiếu tiền mặt 30.000 chưa xử lý)
    await open(183); await wait('#dsm', 100); await sleep(400);
    ok(!!$('#dsm') && !$('#stc-page.stc-one') && !!secTm() && !!secCk(), '1. mở trang đối soát ca 183 (trang mới): có sổ Tiền mặt và sổ Chuyển khoản, không còn khối 6 bước cũ');
    ok($$('.dsm-gb', secTm()).length === 1 && txt($('.dsm-gb', secTm())).includes('thiếu') && txt($('.dsm-gb', secTm())).includes('30.000') && !!$('[data-dsmgap]', secTm()), '2. sổ Tiền mặt có 1 khối Chênh lệch thiếu 30.000 + nút Xử lý lệch');
    ok(!$$('.dsm-gb', secCk()).length, '2. sổ Chuyển khoản không có khối chênh lệch');
    ok($$('.dsm-it', secTm()).some((i) => txt(i).includes('quản lý lấy tiền két')) && !$$('#dsm .dsm-it').some((i) => txt(i).includes('ca thiếu tiền')), '2. khoản chi chỉ có thu chi thật, chênh lệch nằm ở khối riêng');
    ok(!$('[data-dsfinal]') && !$('.stc-fin'), '3. bước 158: không còn nút / khung Chốt ca');
    wide('3. Đối soát ca');
    // 4. xử lý phiếu chênh lệch: trừ lương 30.000
    $('[data-dsmgap]', secTm()).click(); await wait('dialog[open]', 30); await sleep(300);
    $$('[data-tlc]', dlg()).forEach((c) => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(150);   // 22/11: tích người phải chịu (mặc định không ai)
    setv('[name=reason]', 'thiếu thật'); await submit();
    if (dlg()) { bad.push('4. phiếu trừ lương lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
    await open(183); await wait('#dsm', 100); await sleep(400);
    ok(!!$('#dsm-reopen') && !$('#dsm-done'), '5. ca đã hoàn thành: bước ③ có nút Mở lại');
    ok(txt($('.dsm-gb', secTm())).includes('trừ lương') && txt($('.dsm-gb', secTm())).includes('30.000'), '5. khối Chênh lệch ghi đã xử lý bằng trừ lương 30.000: ' + txt($('.dsm-gb', secTm())).slice(0, 120));
    ok(!/khoản treo|ca đã chốt/.test(txt($('#root'))), '5. không còn ô "Ca đã chốt" / "Khoản treo"');
    // bước 171: đã hoàn thành thì khoá thêm phiếu; Mở lại → thêm được
    { const khoa = !$('#dsm [data-addca]'); await moLai(); await open(183); await wait('#dsm', 100); await sleep(400); const mo = !!$('#dsm [data-addca]');
      ok(khoa && mo && !!$('#dsm-done') && !$('#dsm-reopen'), '5. đã hoàn thành thì khoá thêm phiếu; Mở lại → thêm phiếu được, bước ③ có lại nút Hoàn thành'); }
    // 6. Sổ chi chung: ca đã chốt không còn nút
    location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-pay'); await sleep(300);
    $('.stc-all')?.click(); await sleep(400);
    const caRow = $$('.stc-ca').find((c) => txt(c).includes('quản lý lấy tiền két'));
    // chặng 6.3d (anh Tiến chốt 23/11): Sổ thu chi luôn ngoài ca — dòng ca có đường dẫn sang trang đối soát ca thay cho nút thêm tại sổ
    ok(!!caRow && !txt(caRow).includes('ca đã chốt') && !!caRow.querySelector('a[href*="#/ca/doi-soat?id="]'), '6. Sổ chi chung: ca đã xác nhận (vừa Mở lại) có đường dẫn thêm phiếu ở trang đối soát ca, không còn "Ca đã chốt"');
    { const dn = $$('.stc-ca').find((c) => txt(c).includes('đã hoàn thành đối soát'));
      ok(!!dn && !dn.querySelector('[data-addca]') && !!dn.querySelector('a[href*="#/ca/doi-soat?id="]'), '6. bước 171: ca đã hoàn thành → không có nút thêm, có đường dẫn sang trang đối soát ca để Mở lại'); }
    const c182 = $$('.stc-ca').find((c) => txt(c).includes('mua sữa tươi'));
    ok(!!c182 && !!c182.querySelector('a[href*="#/ca/doi-soat?id=182"]'), '6. ca chưa xác nhận: đường dẫn sang trang đối soát ca');
    // 6b. khôi phục phiếu xoá nhầm (ca Sáng 18/11 đã xác nhận Fabi, chưa chốt)
    await open(181); await wait('#dsm', 100); await sleep(400); await moLai(); await open(181); await wait('#dsm', 100); await sleep(400);   // ca đã hoàn thành phải Mở lại mới xoá phiếu được
    const rowOf = (t) => $$('#dsm .dsm-it').find((i) => txt(i).includes(t));
    const md = rowOf('mua đá');
    if (md && md.dataset.ed) {
      md.click(); await wait('dialog[open]', 30); await sleep(300);
      setv('[name=reason]', 'thử xoá'); $('.stc-del', dlg()).click(); await sleep(1200);
      if (dlg()) { bad.push('6b. xoá phiếu lỗi: ' + txt($('.stc-err', dlg()))); $('[data-x]', dlg())?.click(); }
      await open(181); await wait('#dsm', 100); await sleep(400);
      ok(!rowOf('mua đá'), '6b. xoá phiếu ở trang đối soát ca → không còn trong sổ tiền của ca');
      location.hash = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-pay'); await sleep(300); $('.stc-all')?.click(); await sleep(400);
      const vd = $$('.stc-it.void').find((i) => txt(i).includes('mua đá'));
      ok(!!vd, '6b. Sổ chi: phiếu đã xoá còn đó, gạch ngang (không mất dấu vết)');
    } else bad.push('6b. không bấm sửa / xoá được "Mua đá" ở trang đối soát ca');
    // 8. tab Tổng: không còn Khoản treo / Ca chưa chốt
    location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11&t=' + Date.now(); await sleep(400); await wait('.stc-big'); await sleep(400);
    ok(!$$('.stc-tile').some((t) => /khoản treo|ca chưa chốt/.test(txt(t))) && !$$('.stc-side').some((c) => txt(c).includes('khoản treo')), '8. tab Tổng: không còn ô / khung Khoản treo, Ca chưa chốt');
    ok($$('.stc-todo .stc-ti[data-kind=fabi]').some((t) => txt(t).includes('chưa xác nhận fabi')), '8. tab Tổng: khung Việc cần làm có "Ca … chưa xác nhận Fabi" (bước 166)');
    wide('8. Tổng');
  } catch (e) { bad.push('LỖI: ' + e.message); }
  out.push({ stc6: { ok: good, fail: bad } });
};
