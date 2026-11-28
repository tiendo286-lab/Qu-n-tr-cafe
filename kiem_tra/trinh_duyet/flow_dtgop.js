// Trang Đào tạo gộp (anh Tiến 28/11/2026): một mục Đào tạo — danh sách + bộ lọc, mở phiếu / phân công theo ca / chờ kiểm tra ngay trong thẻ.
// Chạy (chuan_bi.sh … --dao-tao-gia, thời gian thật), index.html và test/phone.html:
//   role=chu · role=kt&dtptc=7 (người phụ trách chính) · role=ql (HD chính NV05) · role=ql2 · role=c1 · role=nv
// Lịch giả ở dt_gia.js chỉ có khi script=flow_pcdt → bài này không kiểm số ca, chỉ kiểm khung trang (số ca do flow_pcdt kiểm).
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const $ = (s, r = document) => r.querySelector(s); const all = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const seen = (el) => !!el && el.getClientRects().length > 0;
  const go = async (h) => visit(h + (h.includes('?') ? '&' : '?') + 't=' + Date.now());
  const wait = async (fn, n = 60) => { for (let i = 0; i < n && !fn(); i++) await sleep(100); return !!fn(); };
  const card = (id) => $(`details.dtg-card[data-id="${id}"]`);
  const shown = () => all('details.dtg-card').filter((c) => !c.hidden).length;
  const type = (v) => { const q = $('#dtg-q'); q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); };
  const board = ['chu', 'kt', 'ql'].includes(role);
  try {
    // 1. đường cũ + menu
    await go('#/dao-tao/phan-cong'); await wait(() => location.hash.startsWith('#/cong-viec/dao-tao'));
    ok(location.hash.startsWith('#/cong-viec/dao-tao'), 'đường cũ #/dao-tao/phan-cong tự chuyển về Đào tạo — ' + location.hash);
    await go('#/cong-viec/dao-tao'); await wait(() => !!$('#dtg-f'));
    ok(!$('a[href^="#/dao-tao/phan-cong"]'), 'không còn mục Phân công đào tạo riêng');
    ok(txt($('#root h1')) === 'Đào tạo', 'tiêu đề trang là "Đào tạo" — ' + txt($('#root h1')));
    ok(!$('[data-dttab]') && !$('.dtb') && !$('.dtk'), 'không còn thẻ Phân công / Chờ kiểm tra kiểu cũ');

    // 2. bộ lọc
    ok(['#dtg-q', '#dtg-cs', '#dtg-prog', '#dtg-hd', '#dtg-clear'].every((s) => !!$(s)), 'bộ lọc đủ: tìm tên, cơ sở, chương trình, người hướng dẫn chính, Bỏ lọc');
    const chips = all('.dtg-chip');
    ok(chips.length === 6 && chips.every((b) => /\d/.test(txt(b))), 'có 6 nút trạng thái, nút nào cũng có số — ' + chips.length);
    const total = all('details.dtg-card').length; const n0 = shown();
    ok(total >= 2 && n0 === total, `mặc định hiện ${n0}/${total} người (dữ liệu thử không có ai hoàn thành)`);
    ok(new RegExp(`Đang hiện ${n0} / ${total}`).test(txt($('#dtg-count'))), 'dòng đếm đúng — ' + txt($('#dtg-count')));
    type('hoc thu hai'); await sleep(150);
    ok(shown() === 1 && !card(2).hidden && card(1).hidden, 'gõ không dấu "hoc thu hai" → còn đúng người thứ hai — hiện ' + shown());
    type('zzz khong co'); await sleep(150);
    ok(shown() === 0 && seen($('#dtg-empty')) && /Không có ai khớp/.test(txt($('#dtg-empty'))), 'không khớp ai → hiện dòng "Không có ai khớp bộ lọc"');
    $('#dtg-clear').click(); await sleep(150);
    ok(shown() === total && $('#dtg-q').value === '' && !seen($('#dtg-empty')), 'Bỏ lọc → hiện lại tất cả, ô tìm trống');
    const done = $('.dtg-chip[data-st="hoan_thanh"]'); done.click(); await sleep(150);
    ok(shown() === 0 && done.getAttribute('aria-pressed') === 'true', 'bấm nút Đã hoàn thành → chỉ lọc người hoàn thành (dữ liệu thử: 0 người)');
    const numsA = chips.map((b) => txt(b)).join('|'); done.click(); await sleep(150);
    ok(shown() === total && done.getAttribute('aria-pressed') === 'false' && chips.map((b) => txt(b)).join('|') === numsA, 'bấm lần nữa → bỏ lọc trạng thái; số trên các nút không đổi khi bấm');
    const prog = $('#dtg-prog'); prog.value = 'pha_che'; prog.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150);
    ok(shown() === 0, 'chọn Pha chế → không còn phiếu Chạy bàn');
    await go('#/cong-viec/dao-tao'); await wait(() => !!$('#dtg-f'));
    ok($('#dtg-prog').value === 'pha_che' && shown() === 0, 'vẽ lại trang vẫn giữ bộ lọc đã chọn');
    $('#dtg-clear').click(); await sleep(150);

    // 3. mở phiếu ngay trong thẻ
    const hash0 = location.hash;
    card(1).querySelector('summary').click();
    const got1 = await wait(() => !!$('.dtg-ph[data-ph="1"] #dt-tabs') || !!$('.dtg-ph[data-ph="1"] .alert'));
    ok(got1 && location.hash === hash0, 'bấm vào người thứ nhất → phiếu hiện ngay trong thẻ, không chuyển trang');
    ok(all('[data-dtab]', card(1)).length === (board ? 3 : 0), board ? 'có 3 nút: Phiếu đào tạo · Phân công theo ca · Chờ kiểm tra' : 'không có quyền bảng: không có nút Phân công theo ca / Chờ kiểm tra');
    ok(board ? !!$('#pcd > .pcd-sum') && !!$('#pcd-who') : !$('#pcd > .pcd-sum') && !$('#pcd-who'), board ? 'có ô tổng + ô xem việc của một người dạy' : 'không có ô tổng / ô xem việc của người dạy');
    ok(fits(), 'mở phiếu trong thẻ: không tràn ngang');
    card(2).querySelector('summary').click();
    const got2 = await wait(() => !!$('.dtg-ph[data-ph="2"] #dt-tabs') || !!$('.dtg-ph[data-ph="2"] .alert'));
    ok(got2 && all('#dt-tabs').length <= 1 && !!$('.dtg-ph[data-ph="1"] [data-phload]'), 'mở phiếu người thứ hai → cả trang chỉ một phiếu, thẻ thứ nhất còn nút "Mở phiếu ở đây"');
    $('.dtg-ph[data-ph="1"] [data-phload]').click();
    ok(await wait(() => !!$('.dtg-ph[data-ph="1"] #dt-tabs') || !!$('.dtg-ph[data-ph="1"] .alert')) && !!$('.dtg-ph[data-ph="2"] [data-phload]'), 'bấm "Mở phiếu ở đây" → phiếu về lại thẻ thứ nhất');

    if (board) {
      // 4. ba nút trong thẻ
      const c = card(1); const pane = (k) => $(`[data-dpane="${k}"]`, c);
      $('[data-dtab="ca"]', c).click(); await sleep(150);
      ok(seen(pane('ca')) && !seen(pane('phieu')) && !seen(pane('kt')), 'bấm Phân công theo ca → chỉ hiện phần theo ca');
      ok(!!$('.pcd-shs, .pcd-nosched', pane('ca')), 'phần theo ca có danh sách ca (hoặc dòng "Chưa có lịch đã công bố")');
      $('[data-dtab="kt"]', c).click(); await sleep(150);
      ok(seen(pane('kt')) && !seen(pane('ca')), 'bấm Chờ kiểm tra → chỉ hiện phần chờ kiểm tra');
      const kr = $('.pcd-ktr', pane('kt'));
      ok(!!kr || /Không có mục nào chờ kiểm tra/.test(txt(pane('kt'))), 'phần chờ kiểm tra có mục chờ hoặc dòng "Không có mục nào chờ kiểm tra"');
      if (role === 'chu') ok(!$('[data-ktok]') && !$('[data-ktp2]'), 'Chủ không có nút Xác nhận đạt / Giao giai đoạn 2 (chỉ HD chính / người phụ trách chính)');
      else if (kr) {
        const lv = $('.pcd-kt-lv', kr); const p2 = $('[data-ktp2]', kr);
        ok(!!$('[data-ktok]', kr) && !!p2, 'có nút Xác nhận đạt + Giao giai đoạn 2');
        lv.value = 'tot'; lv.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
        ok(p2.hidden, 'mức Tốt → ẩn nút Giao giai đoạn 2');
        lv.value = 'kha'; lv.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
        ok(!p2.hidden, 'mức Khá → hiện nút Giao giai đoạn 2');
        // 5. lưu rồi trang vẽ lại: còn đúng thẻ mở, đúng nút, bộ lọc
        type('hoc thu'); await sleep(150);
        const before = txt($('summary', card(1)));
        if (role === 'kt') {   // người phụ trách chính: Giao giai đoạn 2 = xác nhận mức đang chọn rồi mở hộp giao người luyện thêm
          p2.click(); const dlg = await wait(() => !!$('dialog[open] #dt-guide-person-form'));
          ok(dlg && /Giao giai đoạn 2/.test(txt($('dialog[open]'))), 'bấm Giao giai đoạn 2 → mở hộp "Giao giai đoạn 2"');
          $('dialog[open]')?.close(); await sleep(200);
          const app = await import('../js/app.js'); await app.render(); await sleep(400);
        } else { $('[data-ktok]', kr).click(); await sleep(1500); }
        await wait(() => !!card(1));
        const c2 = card(1);
        ok(!!c2 && c2.open && $('[data-dtab="kt"]', c2).getAttribute('aria-pressed') === 'true' && seen($('[data-dpane="kt"]', c2)), 'xác nhận xong → trang vẽ lại, thẻ vẫn mở ở nút Chờ kiểm tra');
        ok($('#dtg-q').value === 'hoc thu', 'vẽ lại vẫn giữ chữ đang tìm');
        ok(txt($('summary', c2)) !== before, 'số Đạt trên thẻ đổi sau khi xác nhận — ' + txt($('summary', c2)).slice(0, 90));
        $('#dtg-clear').click(); await sleep(150);
        // 6. lưu trong phiếu nhúng → trang vẽ lại, phiếu vẫn còn trong thẻ
        $('[data-dtab="phieu"]', c2).click();
        ok(await wait(() => !!$('.dtg-ph[data-ph="1"] #dt-tabs')), 'quay lại nút Phiếu đào tạo → phiếu hiện trong thẻ');
        const { render } = await import('../js/app.js'); await render(); await sleep(300);
        ok(!!card(1) && card(1).open && !!$('.dtg-ph[data-ph="1"] #dt-tabs') && all('#dt-tabs').length === 1, 'trang vẽ lại (như sau khi lưu trong phiếu) → phiếu vẫn còn trong thẻ đang mở — mở=' + card(1)?.open + ' · số phiếu=' + all('#dt-tabs').length + ' · trong thẻ: ' + txt($('.dtg-ph[data-ph="1"]')).slice(0, 80));
      }
    } else {
      // (quản lý được giao lại vẫn có nút xác nhận trong khối Việc đào tạo của tôi — quyền có từ tệp 174, không thuộc thẻ)
      ok(!$('details.dtg-card [data-ktok]') && !$('details.dtg-card [data-ktp2]') && !$('details.dtg-card .pcd-sh'), 'không có quyền bảng: trong thẻ không có nút xác nhận / ca phân công');
      if (role === 'ql2') ok(!!$('#pcd-mine'), 'quản lý được giao dạy: trang có khối Việc đào tạo của tôi');
    }
    ok(fits(), 'cuối bài: không tràn ngang');
  } catch (e) { bad.push('flow: ' + (e.stack || e)); }
  out.push({ dtgop: { ok: good, fail: bad } });
};
