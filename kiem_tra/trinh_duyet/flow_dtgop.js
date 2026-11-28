// Trang Đào tạo gộp (anh Tiến 28/11/2026): một mục Đào tạo — danh sách + bộ lọc, mở một người là thấy chờ kiểm tra · phân công theo ca · phiếu trong MỘT màn hình (28/11 tối: bỏ 3 nút chia).
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
    ok(!$('[data-dtab]') && !$('[data-dpane]'), '28/11 tối: không còn nút chia Phiếu / Phân công / Chờ kiểm tra — gộp một màn hình');
    ok(!$('[data-dsec]') && !$('details.dtg-card .pcd-sh') && !$('details.dtg-card .pcd-ktr'), 'tệp 202: thẻ không còn danh sách ca / khối chờ kiểm tra riêng — nằm trong thẻ ngày của phiếu');
    ok(all('#dt-tabs .dt-tab-tag').length > 0 && all('.dtg-ph[data-ph="1"] .pcd-inl').length > 0, 'thẻ ngày của phiếu có nhãn tình trạng và khối phân công');
    ok(board ? all('.dtg-ph[data-ph="1"] .pcd-go').length > 0 : all('.dtg-ph[data-ph="1"] .pcd-go').length === 0, board ? 'người được phân công: có nút lưu phân công ngay trong thẻ ngày' : 'người khác: phân công chỉ xem, không có nút lưu');
    ok(board ? !!$('#pcd > .pcd-sum') && !!$('#pcd-who') : !$('#pcd > .pcd-sum') && !$('#pcd-who'), board ? 'có ô tổng + ô xem việc của một người dạy' : 'không có ô tổng / ô xem việc của người dạy');
    ok(fits(), 'mở phiếu trong thẻ: không tràn ngang');
    card(2).querySelector('summary').click();
    const got2 = await wait(() => !!$('.dtg-ph[data-ph="2"] #dt-tabs') || !!$('.dtg-ph[data-ph="2"] .alert'));
    ok(got2 && all('#dt-tabs').length <= 1 && !!$('.dtg-ph[data-ph="1"] [data-phload]'), 'mở phiếu người thứ hai → cả trang chỉ một phiếu, thẻ thứ nhất còn nút "Mở phiếu ở đây"');
    $('.dtg-ph[data-ph="1"] [data-phload]').click();
    ok(await wait(() => !!$('.dtg-ph[data-ph="1"] #dt-tabs') || !!$('.dtg-ph[data-ph="1"] .alert')) && !!$('.dtg-ph[data-ph="2"] [data-phload]'), 'bấm "Mở phiếu ở đây" → phiếu về lại thẻ thứ nhất');

    if (board) {
      // 4. phân công ngay trong thẻ ngày sắp tới: chọn người làm cùng ca → tích mục → lưu, không bật hộp
      const addD = (n) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
      const d2 = addD(2); const key = `1|${d2}|Tối`; const box = () => $(`.pcd-inl[data-inl="${key}"]`);
      $(`#dt-tabs .dt-tab[data-tab="${d2}"]`).click(); await sleep(300);
      ok(seen(box()) && /Chưa giao/.test(txt($(`#dt-tabs .dt-tab[data-tab="${d2}"]`))), 'bấm thẻ ngày kia → khối phân công hiện ngay trong thẻ, nhãn "Chưa giao"');
      const other = $('.pcd-other', box()); other.value = [...other.options].find((o) => /NV07/.test(o.textContent)).value; other.dispatchEvent(new Event('change', { bubbles: true })); await sleep(200);
      const cb = $('label.pcd-it[data-no="5"] input', box()); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150);
      ok(txt($('.pcd-n', box())) === '1' && !$('.pcd-go', box()).disabled && !$('dialog[open]'), 'chọn người dạy + tích 1 mục → "Đã chọn 1", nút lưu bật, không có hộp bật lên');
      $('.pcd-go', box()).click(); await sleep(1500); await wait(() => !!box());
      ok(/NV07/.test(txt($('.pcd-inl-sum', box()))) && /Đã giao/.test(txt($(`#dt-tabs .dt-tab[data-tab="${d2}"]`))), 'lưu xong: thẻ ngày kia ghi NV07 dạy mục 5, nhãn đổi thành "Đã giao"');
      ok(card(1).open && $(`#dt-tabs .dt-tab[data-tab="${d2}"]`).classList.contains('on'), 'lưu xong vẫn ở đúng thẻ ngày đang xem');
      const kr = $('.dtg-ph .dt-item[data-check="1"]');
      if (role === 'chu') ok(!$('.dtg-ph .it-check'), 'Chủ không có nút Xác nhận đạt (chỉ HD chính / người phụ trách chính)');
      else if (kr) {
        // 5. xác nhận mục chờ kiểm tra ngay trong phiếu → trang vẽ lại vẫn giữ thẻ mở, phiếu, bộ lọc
        type('hoc thu'); await sleep(150);
        const before = txt($('summary', card(1)));
        $('.it-check', kr).click(); await sleep(1500); await wait(() => !!$('.dtg-ph[data-ph="1"] #dt-tabs'));
        const c2 = card(1);
        ok(!!c2 && c2.open && !!$('.dtg-ph[data-ph="1"] #dt-tabs') && all('#dt-tabs').length === 1, 'xác nhận đạt trong phiếu → trang vẽ lại, thẻ vẫn mở, phiếu vẫn còn');
        ok($('#dtg-q').value === 'hoc thu', 'vẽ lại vẫn giữ chữ đang tìm');
        ok(txt($('summary', c2)) !== before, 'số Đạt trên thẻ đổi sau khi xác nhận — ' + txt($('summary', c2)).slice(0, 90));
        $('#dtg-clear').click(); await sleep(150);
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
