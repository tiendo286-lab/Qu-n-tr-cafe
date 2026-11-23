// Bước 168: Đối soát Fabi — giao diện (không đổi điều kiện khoá). Chạy role chu / qlt / ql, index.html và test/phone.html.
//  a. điện thoại: chưa chọn ca → hàng nhãn nhỏ + ⓘ Cách làm + danh sách bên gập; chọn ca → phần xử lý lên đầu, lịch thành "‹ Chọn ca khác"
//  b. thanh cuối màn hình "Hoàn thành đối soát ca": việc còn thiếu bấm nhảy tới chỗ xử lý + nút Xác nhận Fabi (điều kiện như cũ)
//  c. + Thêm phiếu trong ca: Ngày + Ca điền sẵn; ca chưa xác nhận Fabi có nút nhảy tới Xác nhận Fabi
//  d. Thu nợ chỉ nợ phát sinh trước ngày / ca ghi thu
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): tab Đối soát Fabi + lịch ca + ô số + danh sách bên đã bỏ → phần a kiểm đường cũ về bảng tuần Chốt ca
//   (bảng tuần mới kiểm kỹ ở flow_dsca); khối tiền một ca ở trang đối soát ca (bước 1–5 = tab ②, bước 6 = tab ③). Phần b–d chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
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
  const tab3 = async () => { $('.ds-pt[data-ptab="xong"]')?.click(); await sleep(350); };   // bước 6 cũ = tab ③ Hoàn thành
  const XONG = '[data-tab-pane="xong"]';
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    // ---- a. chưa chọn ca: đường cũ (không có ca) → bảng tuần Chốt ca của cơ sở (ô ca hai dòng Việc · Tiền, "Còn N ca chưa đối soát xong")
    location.hash = DS + '&t=' + Date.now(); await sleep(500); await wait('.cw-t', 80); await wait('.cw-con', 30); await sleep(500);
    // tháng này → tuần hiện tại (có thể chưa có phiếu nào trong tuần) — kiểm bảng tuần + dòng "Còn N ca chưa đối soát xong" (tính từ 01/11), không phụ thuộc ngày chạy
    ok(location.hash.startsWith('#/ca?') && !!$('.cw-t') && !!$('.cw-con') && !$('.stc-dsp'), 'a. đường cũ Đối soát Fabi (chưa chọn ca) → bảng tuần Chốt ca: ' + location.hash.slice(0, 40));
    wide('a. bảng tuần Chốt ca');
    // ---- b. ca 182: chưa xác nhận Fabi, còn ô đỏ
    await open(182);
    const bar = $('.stc-dsp .stc-dsbar');
    ok(!!bar && getComputedStyle(bar).position === 'sticky', 'b. có thanh cố định cuối màn hình');
    ok(!!$('[data-dsprev]', bar) && !!$('[data-dsnext]', bar) && /bước này còn \d+ mục/.test(txt(bar)), 'b. bước 171: thanh cuối = Quay lại · bước này còn N mục · Tiếp');
    await st(1);
    const cl = $('.stc-dsp .stc-pa [data-dsclose]');
    ok(!!cl && cl.disabled && txt(cl).includes('xác nhận fabi') && $$('[data-dsclose]').length === 1 && !$('[data-dsclose]', $('.stc-dsbar')), 'b. bước 171: nút tên "Xác nhận Fabi", nằm cuối bước 2 (không còn ở thanh cuối), đang khoá');
    ok(txt($('.stc-dsp .stc-a-end')).includes('còn ô đỏ'), 'b. ghi rõ còn thiếu: "còn ô đỏ ở ①"');
    await tab3(); $(XONG + ' .stc-sum [data-dsstep="0"]').click(); await sleep(350);
    ok($('.stc-dsp .stc-steps [data-dsstep].on')?.dataset.dsstep === '0' && !!$('#ds-s1 .stc-c4.red') && !$('[data-tab-pane="tien"]').hidden, 'b. bước 6 (tab ③): bấm dòng "Số máy Fabi còn N mục" → về tab ②, tới bước 1 có ô đỏ');
    wide('b. ca 182');
    // ca 172: chờ kế toán
    location.hash = '#/ca/doi-soat?id=172&t=' + Date.now(); await sleep(400); await wait('#ds-nextca2'); await sleep(300);
    ok(txt($('#root')).includes('chờ kế toán') && !$('.stc-dsp') && !$('[data-dsclose]:not([disabled])'), 'b. ca chờ kế toán: trang báo "chờ kế toán", không có nút Xác nhận Fabi (luật 17/11)');
    // ca 183: đã xác nhận + đã hoàn thành, thiếu tiền mặt 30.000
    await open(183);
    ok(!$('.stc-dsp [data-dsclose]') && txt($(XONG)).includes('còn 1 chênh lệch') && txt($('.stc-dsp .stc-dsh')).includes('🟠'), 'b. đã hoàn thành còn lệch: bước 6 (tab ③) ghi "còn 1 chênh lệch", ca 🟠, không còn nút Xác nhận');
    await st(4);
    { const gtm = $$('.stc-step .stc-glc')[0];
      ok(!!gtm && txt($('h2', gtm)).includes('tiền mặt') && txt(gtm).includes('30.000') && !!$('[data-gap]', gtm), 'b. bước 5: khung Tiền mặt có dòng thiếu 30.000 + nút Phiếu chênh lệch'); }
    $(XONG + ' [data-dsundone]')?.click(); await sleep(800);   // bước 171: ca đã hoàn thành phải Mở lại (tab ③) mới thêm phiếu được
    // ---- c. + Thêm phiếu trong ca 183 → Ngày + Ca điền sẵn
    await st(3);
    const add = $('.stc-pb .stc-addca[data-addca="183"]'); ok(!!add, 'c. có nút + Thêm phiếu trong ca');
    if (add) {
      add.click(); await sleep(500); const box = $('.stc-addp');
      ok(box && box.querySelector('[name=date]').value === '2026-11-18' && box.querySelector('[name=ca]').value === '183', 'c. Ngày 18/11 và Ca Tối điền sẵn đúng ca');
      // chặng 6.3d: ở trang đối soát ca, Ngày + Ca cố định theo ca (không đổi sang ngày / ca khác, không có "Ngoài ca")
      ok(box.querySelector('[name=date]').disabled && box.querySelector('[name=ca]').disabled && ![...box.querySelectorAll('[name=ca] option')].some((o) => o.value === ''), 'c. Ngày + Ca cố định theo ca, không có "Ngoài ca"');
      wide('c. khung thêm phiếu');
      box.querySelector('[data-x]').click(); await sleep(200);
    }
    // ---- d. Thu nợ ngoài ca: chỉ nợ ghi từ ngày phiếu trở về trước
    await st(2);
    const add2 = $('.stc-pb .stc-addca[data-addca="183"]');
    if (add2) {
      add2.click(); await sleep(500); const box = $('.stc-addp'); const k = box.querySelector('[name=kind]'); k.value = 'no'; k.dispatchEvent(new Event('change')); await sleep(150);
      const dt = box.querySelector('[name=date]'); const opts = () => [...box.querySelectorAll('[name=debt] option')].filter((o) => o.value).map((o) => o.value).sort().join(',');
      // chặng 6.3d: Thu nợ trong ca (Ngày cố định 18/11 ca Tối) — chỉ nợ ghi trước ca này, còn tiền
      ok(dt.disabled && opts().length > 0 && opts().split(',').includes('d:2'), 'd. Thu nợ trong ca: danh sách nợ ghi trước ca (có Cô Lan Anh 10/11) — ' + opts());
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
