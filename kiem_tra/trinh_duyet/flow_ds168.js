// Bước 168: Đối soát Fabi — giao diện (không đổi điều kiện khoá). Chạy role chu / qlt / ql, index.html và test/phone.html.
//  a. điện thoại: chưa chọn ca → hàng nhãn nhỏ + ⓘ Cách làm + danh sách bên gập; chọn ca → phần xử lý lên đầu, lịch thành "‹ Chọn ca khác"
//  b. thanh cuối màn hình "Hoàn thành đối soát ca": việc còn thiếu bấm nhảy tới chỗ xử lý + nút Xác nhận Fabi (điều kiện như cũ)
//  c. + Thêm phiếu trong ca: Ngày + Ca điền sẵn; ca chưa xác nhận Fabi có nút nhảy tới Xác nhận Fabi
//  d. Thu nợ chỉ nợ phát sinh trước ngày / ca ghi thu
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const phone = innerWidth <= 600;
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const open = async (id) => { location.hash = DS + '&ds=' + id + '&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(400); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // ---- a. chưa chọn ca
    location.hash = DS + '&t=' + Date.now(); await sleep(500); await wait('#stc-ds'); await sleep(500);
    if (phone) {
      ok(!$('.stc-dsp'), 'a. điện thoại chưa chọn ca: không tự mở ca');
      ok(!!$('.stc-dsmini') && !$('#stc-ds .stc-tiles'), 'a. 5 ô số thành 1 hàng nhãn nhỏ');
      ok(!!$('details.stc-how') && !$('details.stc-how').open && txt($('details.stc-how summary')).includes('cách làm'), 'a. dòng giải thích gập vào "ⓘ Cách làm"');
      ok($$('details.stc-sidep').length >= 3 && $$('details.stc-sidep').every((d) => !d.open && /\d/.test(txt(d.querySelector('summary')))), 'a. danh sách bên gập lại (tên + số đếm)');
      ok($$('.stc-wk .stc-wr').length >= 6, 'a. lịch vẫn cả tháng');
      wide('a. điện thoại chưa chọn ca');
      $('.stc-dsc[data-dsca="183"]').click(); await sleep(500);
      ok(!!$('.stc-pick') && !!$('.stc-dsp') && !$('.stc-wk'), 'a. chọn ca → phần xử lý ca lên đầu, lịch thành "‹ Chọn ca khác"');
      ok($('#stc-ds').firstElementChild?.classList.contains('stc-pick'), 'a. "‹ Chọn ca khác" ở trên cùng');
      $('.stc-pick').click(); await sleep(400);
      ok(!$('.stc-dsp') && !!$('.stc-wk'), 'a. bấm "‹ Chọn ca khác" → về lịch thu');
    } else {
      ok(!!$('.stc-dsp') && $$('#stc-ds > .stc-tiles > .stc-tile').length === 5 && !$('.stc-dsmini') && !$('.stc-pick'), 'a. máy tính giữ nguyên (tự chọn ca, 5 ô số, lịch + danh sách bên)');
    }
    // ---- b. ca 182: chưa xác nhận Fabi, còn ô đỏ
    await open(182);
    const bar = $('.stc-dsp .stc-dsbar');
    ok(!!bar && getComputedStyle(bar).position === 'sticky', 'b. có thanh cố định cuối màn hình');
    ok(txt(bar).includes('hoàn thành đối soát ca') && !!$('[data-dsclose]', bar) && $('[data-dsclose]', bar).disabled, 'b. thanh "Hoàn thành đối soát ca" + nút Xác nhận Fabi đang khoá');
    ok(txt($('[data-dsclose]', bar)).includes('hoàn thành đối soát ca'), 'b. nút ở thanh cuối tên "🔒 Hoàn thành đối soát ca" (anh Tiến chốt 20/11)');
    ok(!$('.stc-pa [data-dsclose]') && $$('[data-dsclose]').length === 1, 'b. nút Xác nhận Fabi chỉ còn ở thanh cuối (chuyển vị trí, không thêm nút)');
    const chip = $$('.stc-jump', bar).find((b) => txt(b).includes('ô đỏ'));
    ok(!!chip, 'b. ghi rõ còn thiếu: "còn ô đỏ ở ①"');
    if (chip) { chip.click(); await sleep(300); ok(!!$('#ds-s1 .stc-flash, #ds-s1.stc-flash'), 'b. bấm "còn ô đỏ" → nhảy tới ô đỏ ở ①'); }
    wide('b. ca 182');
    // ca 172: chờ kế toán
    await open(172);
    ok($$('.stc-dsbar .stc-jump').some((b) => txt(b).includes('chờ kế toán')) && $('.stc-dsbar [data-dsclose]').disabled, 'b. ca chờ kế toán: ghi "chờ kế toán", nút khoá');
    // ca 183: đã xác nhận, thiếu tiền mặt 30.000
    await open(183);
    ok(!$('.stc-dsbar [data-dsclose]') && txt($('.stc-dsbar')).includes('còn 1 chênh lệch'), 'b. đã xác nhận còn lệch: thanh ghi "còn 1 chênh lệch", không còn nút Xác nhận');
    const gj = $$('.stc-dsbar .stc-jump').find((b) => txt(b).includes('tiền mặt thiếu 30.000'));
    ok(!!gj, 'b. chênh lệch ghi rõ "Tiền mặt thiếu 30.000 chưa xử lý"');
    if (gj) { gj.click(); await sleep(400); ok(txt($('.stc-glc h2')).includes('chênh lệch tiền mặt') && txt($('.stc-glc h2')).includes('thiếu'), 'b. bấm → mở bảng Chênh lệch tiền mặt (Sổ chi) ở phần B'); }
    // ---- c. + Thêm phiếu trong ca 183 → Ngày + Ca điền sẵn
    $('[data-dsbook="chi"]')?.click(); await sleep(300);
    const add = $('.stc-pb .stc-addca[data-addca="183"]'); ok(!!add, 'c. có nút + Thêm phiếu trong ca');
    if (add) {
      add.click(); await sleep(500); const box = $('.stc-addp');
      ok(box && box.querySelector('[name=date]').value === '2026-11-18' && box.querySelector('[name=ca]').value === '183', 'c. Ngày 18/11 và Ca Tối điền sẵn đúng ca');
      const dt = box.querySelector('[name=date]'); dt.value = '2026-11-17'; dt.dispatchEvent(new Event('change')); await sleep(200);
      const opt = [...box.querySelectorAll('[name=ca] option')].find((o) => o.value === '172');
      ok(opt && opt.disabled && txt(opt).includes('chưa xác nhận fabi'), 'c. ca chưa xác nhận Fabi: mờ + ghi lý do trong danh sách');
      const j = box.querySelector('.stc-cajump a'); ok(!!j && !box.querySelector('.stc-cajump').hidden && j.getAttribute('href').includes('ds=172') && txt(j).includes('xác nhận fabi'), 'c. có nút nhảy tới Xác nhận Fabi của ca đó');
      wide('c. khung thêm phiếu');
      box.querySelector('[data-x]').click(); await sleep(200);
    }
    // ---- d. Thu nợ ngoài ca: chỉ nợ ghi từ ngày phiếu trở về trước
    $('[data-dsbook="thu"]')?.click(); await sleep(300);
    const add2 = $('.stc-pb .stc-addca[data-addca="183"]');
    if (add2) {
      add2.click(); await sleep(500); const box = $('.stc-addp'); const k = box.querySelector('[name=kind]'); k.value = 'no'; k.dispatchEvent(new Event('change')); await sleep(150);
      const dt = box.querySelector('[name=date]'); const opts = () => [...box.querySelectorAll('[name=debt] option')].filter((o) => o.value).map((o) => o.value).sort().join(',');
      dt.value = '2026-11-15'; dt.dispatchEvent(new Event('change')); await sleep(150);
      ok(opts() === 'd:2', 'd. Thu nợ ngày 15/11: chỉ nợ ghi trước đó (Cô Lan Anh 10/11) — có ' + opts());
      dt.value = '2026-11-18'; dt.dispatchEvent(new Event('change')); await sleep(150);
      ok(opts() === 'd:1,d:2,d:3,d:501', 'd. Thu nợ ngày 18/11: thấy cả nợ 16/11 + 18/11 — có ' + opts());
      dt.value = '2026-11-09'; dt.dispatchEvent(new Event('change')); await sleep(150);
      ok(opts() === '' && txt(box.querySelector('[name=debt] option')).includes('không có khách nợ'), 'd. ngày trước mọi khoản nợ: ghi "Không có khách nợ…"');
      box.querySelector('[data-x]').click(); await sleep(200);
    } else bad.push('d. không mở được khung thêm phiếu thu');
    // Thu nợ từ "Ai còn nợ" (tab Tổng): ngày thu trước ngày nợ → báo lỗi, không ghi
    location.hash = '#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11&t=' + Date.now(); await sleep(500); await wait('.stc-debts');
    $$('details.stc-dp').forEach((d) => { d.open = true; }); $$('details.stc-fam').forEach((d) => { d.open = true; });
    const cb = $('[data-col-debt="d:501"]');
    if (cb) {
      cb.click(); const dl = await wait('dialog[open]', 30); await sleep(200);
      const di = dl.querySelector('[name=date]'); di.value = '2026-11-17';
      dl.querySelector('button[type=submit]').click(); await sleep(600);
      ok(!!$('dialog[open]') && txt($('dialog[open]')).includes('ngày thu phải từ ngày đó'), 'd. Thu nợ ghi ngày 17/11 cho nợ 18/11 → báo lỗi, không ghi');
      $('dialog[open] [data-x]')?.click(); await sleep(200);
    } else bad.push('d. không thấy nút Thu nợ của Anh Dũng (d:501) ở Ai còn nợ');
    wide('d. tab Tổng');
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message); }
  out.push({ ds168: { ok: good, fail: bad } });
};
