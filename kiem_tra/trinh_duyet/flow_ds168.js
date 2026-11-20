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
  const st = async (i) => { const b = $(`.stc-dsp .stc-steps [data-dsstep="${i}"]`); if (b) { b.click(); await sleep(350); } };   // bước 171: sang bước i + 1 của ca đang mở
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
    ok(!!$('[data-dsprev]', bar) && !!$('[data-dsnext]', bar) && /bước này còn \d+ mục/.test(txt(bar)), 'b. bước 171: thanh cuối = Quay lại · bước này còn N mục · Tiếp');
    await st(1);
    const cl = $('.stc-dsp .stc-pa [data-dsclose]');
    ok(!!cl && cl.disabled && txt(cl).includes('xác nhận fabi') && $$('[data-dsclose]').length === 1 && !$('[data-dsclose]', $('.stc-dsbar')), 'b. bước 171: nút tên "Xác nhận Fabi", nằm cuối bước 2 (không còn ở thanh cuối), đang khoá');
    ok(txt($('.stc-dsp .stc-a-end')).includes('còn ô đỏ'), 'b. ghi rõ còn thiếu: "còn ô đỏ ở ①"');
    await st(5); $('.stc-dsp .stc-sum [data-dsstep="0"]').click(); await sleep(350);
    ok($('.stc-dsp .stc-steps [data-dsstep].on')?.dataset.dsstep === '0' && !!$('#ds-s1 .stc-c4.red'), 'b. bước 6: bấm dòng "Số máy Fabi còn N mục" → tới bước 1 có ô đỏ');
    wide('b. ca 182');
    // ca 172: chờ kế toán
    await open(172); await st(1);
    ok(txt($('.stc-dsp .stc-a-end')).includes('chờ kế toán') && $('.stc-dsp [data-dsclose]').disabled, 'b. ca chờ kế toán: ghi "chờ kế toán", nút khoá');
    // ca 183: đã xác nhận + đã hoàn thành, thiếu tiền mặt 30.000
    await open(183);
    ok(!$('.stc-dsp [data-dsclose]') && txt($('.stc-dsp .stc-step')).includes('còn 1 chênh lệch') && txt($('.stc-dsp .stc-dsh')).includes('🟠'), 'b. đã hoàn thành còn lệch: bước 6 ghi "còn 1 chênh lệch", ca 🟠, không còn nút Xác nhận');
    await st(4);
    { const gtm = $$('.stc-step .stc-glc')[0];
      ok(!!gtm && txt($('h2', gtm)).includes('tiền mặt') && txt(gtm).includes('30.000') && !!$('[data-gap]', gtm), 'b. bước 5: khung Tiền mặt có dòng thiếu 30.000 + nút Phiếu chênh lệch'); }
    await st(5); $('.stc-dsp [data-dsundone]')?.click(); await sleep(800);   // bước 171: ca đã hoàn thành phải Mở lại mới thêm phiếu được
    // ---- c. + Thêm phiếu trong ca 183 → Ngày + Ca điền sẵn
    await st(3);
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
    await st(2);
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
