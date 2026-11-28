// Tệp 174: trang Phân công đào tạo theo ca + Việc đào tạo của tôi. Chạy (chuan_bi.sh … --dao-tao-gia, thời gian thật), index.html và test/phone.html:
//   role=chu · role=kt&dtptc=7 (người phụ trách chính) · role=ql (HD chính NV05) · role=ql2 (quản lý NV08 được giao) · role=c1 (Cấp 1 NV07) · role=nv
// Lịch giả ở dt_gia.js (script=flow_pcdt): phiếu 1 NV03 đi làm hôm kia S · hôm qua S · hôm nay C · mai S · ngày kia T; phiếu 2 NV04 không lịch.
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const $ = (s, r = document) => r.querySelector(s); const all = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  // tệp 187: đo hộp thoại có tràn ngang không (trước đây chỉ đo trang) + dòng ca trên điện thoại
  const dfits = (dl) => { if (!dl) return false; const R = dl.getBoundingClientRect();
    return dl.scrollWidth <= dl.clientWidth + 1 && R.right <= window.innerWidth + 1 && R.left >= -1
      && [dl, ...dl.querySelectorAll('.pcd-mid, .pcd-top, .pcd-foot')].every((x) => x.scrollWidth <= x.clientWidth + 1)
      && [...dl.querySelectorAll('button, select, label, h2, .pcd-meta, .pill')].every((x) => { const r = x.getBoundingClientRect(); return !r.width || (r.right <= R.right + 1 && r.left >= R.left - 1); }); };
  const phone = window.innerWidth <= 520;
  const go = async (h) => visit(h + (h.includes('?') ? '&' : '?') + 't=' + Date.now());
  const addD = (n) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const today = addD(0), y = addD(-1), m1 = addD(1);
  const card1 = () => $('details.pcd-card[data-id="1"]');
  // tệp 202: thẻ không còn danh sách ca; hộp bật lên vẫn mở từ ô "Xem việc của một người dạy" ([data-open]) → bài bấm một nút [data-open] tạm
  const openShift = async (date, shift) => { const b = document.createElement('button'); b.type = 'button'; b.hidden = true; b.dataset.open = `1|${date}|${shift}`;
    $('#pcd').appendChild(b); b.click(); b.remove(); await sleep(500); return $('dialog[open].pcd-dlg'); };
  const inl = (date, shift, id = 1) => $(`.pcd-inl[data-inl="${id}|${date}|${shift}"]`);
  const openPhieu = async (id) => { const c = $(`details.pcd-card[data-id="${id}"]`); if (!c.open) c.querySelector('summary').click();
    for (let i = 0; i < 80 && !$(`.dtg-ph[data-ph="${id}"] #dt-tabs`); i++) await sleep(100); if (!$(`.dtg-ph[data-ph="${id}"] #dt-tabs`)) { $(`.dtg-ph[data-ph="${id}"] [data-phload]`)?.click(); for (let i = 0; i < 80 && !$(`.dtg-ph[data-ph="${id}"] #dt-tabs`); i++) await sleep(100); } await sleep(200); };
  const closeDlg = async () => { $('dialog[open].pcd-dlg')?.close(); await sleep(200); };
  try {
    if (['chu', 'kt', 'ql'].includes(role)) {
      await go('#/cong-viec/dao-tao'); for (let i = 0; i < 40 && !location.hash.startsWith('#/cong-viec/dao-tao'); i++) await sleep(100);
      ok(location.hash.startsWith('#/cong-viec/dao-tao') && !$('a[href="#/dao-tao/phan-cong"]'), '28/11: đường cũ Phân công đào tạo tự chuyển về trang Đào tạo gộp, menu không còn mục riêng');
      await go('#/cong-viec/dao-tao');
      ok(!!$('#pcd > .pcd-sum') && /\d/.test(txt($('#pcd > .pcd-sum'))), 'có ô tổng có số');
      const c1 = card1();
      ok(!!c1 && txt(c1.querySelector('summary')).includes('Người học thử'), 'thẻ phiếu 1: tên nhân viên mới');
      // tệp 202: phân công nằm trong thẻ ngày của phiếu
      await openPhieu(2);
      ok(/Chưa có lịch đã công bố/.test(txt($('.dtg-ph[data-ph="2"]'))) && !$('.dtg-ph[data-ph="2"] .pcd-inl'), 'phiếu 2 không lịch: ghi "Chưa có lịch đã công bố", không có khối phân công');
      await openPhieu(1);
      ok(!$('.pcd-sh', c1), 'thẻ không còn danh sách ca riêng');
      ok(all('.pcd-inl').filter((x) => !/không còn trong lịch/.test(txt(x))).length === 5, 'phiếu 1 có 5 ca theo lịch đã công bố (mỗi ca một khối phân công trong thẻ ngày) — có ' + all('.pcd-inl').length);
      ok([addD(-2), y, today, m1, addD(2)].every((d) => !!$(`#dt-tabs .dt-tab[data-tab="${d}"]`)), 'dãy thẻ ngày có đủ 5 ngày đi làm (cả ngày sắp tới)');
      const offRow = inl(y, 'Tối');
      ok(!!offRow && /không còn trong lịch/.test(txt(offRow)) && /15/.test(txt(offRow)), 'lịch đổi sau khi giao: ca hôm qua Tối (mục 15) vẫn hiện, ghi "không còn trong lịch"');
      ok(/hôm nay/.test(txt($(`#dt-tabs .dt-tab[data-tab="${today}"]`))) && !!inl(today, 'Chiều'), 'thẻ hôm nay có khối phân công ca Chiều');
      ok(/Đã giao/.test(txt($(`#dt-tabs .dt-tab[data-tab="${m1}"]`))) && /Chưa giao/.test(txt($(`#dt-tabs .dt-tab[data-tab="${addD(2)}"]`))), 'nhãn trên thẻ ngày: mai "Đã giao", ngày kia "Chưa giao"');
      ok(!!$('.dtg-ph .dt-item[data-no="13"][data-check="1"]'), 'mục 13 chờ kiểm tra hiện trong phiếu');
      ok(role === 'chu' ? !$('.dtg-ph .it-check') : !!$('.dtg-ph .it-check[data-no="13"]'), role === 'chu' ? 'Chủ không có nút Xác nhận đạt (chỉ HD chính / người phụ trách chính)' : 'có nút Xác nhận đạt');
      ok(/NV08/.test(txt(inl(m1, 'Sáng'))) && /giao lại/.test(txt(inl(m1, 'Sáng'))), 'thẻ ngày mai: nhóm NV08 + nhóm "giao lại"');
      { $(`#dt-tabs .dt-tab[data-tab="${m1}"]`).click(); await sleep(300); const bx = inl(m1, 'Sáng'); const a = bx.getBoundingClientRect();
        ok(a.width > 200 && a.right <= window.innerWidth + 1 && bx.scrollWidth <= bx.clientWidth + 1 && fits(), 'khối phân công trong thẻ ngày không tràn ngang');
        ok(!!$('.pcd-go', bx) && !!$('.pcd-mate[data-pick="7"]', bx), 'khối phân công ngày mai: có người làm cùng ca và nút lưu ngay trong thẻ'); }
      // ---- Phân công ca mai
      let dl = await openShift(m1, 'Sáng');
      ok(dfits(dl), 'hộp Phân công không tràn ngang');
      ok(!!dl && !!$('.pcd-mate[data-pick="7"]', dl) && !!$('.pcd-mate[data-pick="8"]', dl), 'bảng Phân công: người làm cùng ca NV07 + NV08 hiện sẵn');
      ok(/NV08/.test(txt($('label.pcd-it[data-no="10"] .pcd-where', dl))), 'mục 10 ghi đang giao NV08');
      ok(!!$('label.pcd-it[data-no="13"] input:disabled', dl) && !!$('label.pcd-it[data-no="13"] .pcd-lock', dl), 'mục 13 chờ kiểm tra bị khoá');
      ok(!$('label.pcd-it[data-no="3"]', dl), 'mục 3 đã đạt không hiện');
      if (dl) {
        $('.pcd-mate[data-pick="7"]', dl).click(); await sleep(200); dl = $('dialog[open].pcd-dlg');
        [20, 21, 22].forEach((n) => { const x = $(`input[data-no="${n}"]`, dl); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); });
        await sleep(100);
        ok(txt($('#pcd-n', dl)) === '3', 'đếm "Đã chọn 3"');
        window.__DT_PLAN = []; $('#pcd-go', dl).click(); await sleep(1300);
        const p = (window.__DT_PLAN || [])[0];
        ok((window.__DT_PLAN || []).length === 1 && p.p_items.join() === '20,21,22' && p.p_employee === 7 && p.p_date === m1 && p.p_shift === 'Sáng', 'Phân công: lưu 1 lần, đúng mục / người / ngày / ca');
      }
      dl = await openShift(m1, 'Sáng');
      ok(!!$('.pcd-gv[data-who="7"]', dl), 'Đã giao trong ca này: có NV07');
      if (dl) {
        $('.pcd-gv[data-who="7"] [data-edit]', dl).click(); await sleep(200); dl = $('dialog[open].pcd-dlg');
        ok($('input[data-no="20"]', dl)?.checked && $('input[data-no="22"]', dl)?.checked, 'Sửa: mục của NV07 tích sẵn');
        const x = $('input[data-no="11"]', dl); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true }));
        $('#pcd-go', dl).click(); await sleep(1300);
      }
      for (let i = 0; i < 60 && !inl(m1, 'Sáng'); i++) await sleep(100);
      ok(/NV08.*10, 12/.test(txt($('.pcd-inl-sum', inl(m1, 'Sáng')))), 'tích mục 11 cho NV07 → mục rời NV08 (còn 10, 12) — có ' + txt($('.pcd-inl-sum', inl(m1, 'Sáng'))));
      // ---- Chi tiết ngày đã qua
      dl = await openShift(y, 'Sáng');
      ok(!!dl && /Đã giới thiệu/.test(txt(dl)) && /Hiện tại/.test(txt(dl)) && !$('#pcd-go', dl), 'ca hôm qua: Chi tiết ngày như phiếu, không có nút Phân công');
      ok(dfits(dl), 'hộp Chi tiết ngày không tràn ngang');
      await closeDlg();
      dl = await openShift(y, 'Tối');
      ok(!!dl && /không còn trong lịch/.test(txt(dl)) && !$('#pcd-go', dl), 'ca không còn trong lịch: mở được, ghi rõ, không có nút Phân công');
      await closeDlg();
      dl = await openShift(today, 'Chiều');
      ok(!!dl && !!$('[data-view="ct"]', dl) && !!$('[data-view="pc"]', dl), 'ca hôm nay: có 2 nút Chi tiết ngày / Phân công');
      await closeDlg();
      // ---- Lọc người dạy + ngày
      const w = $('#pcd-who'); const d = $('#pcd-d');
      if (w && d) { w.value = '8'; w.dispatchEvent(new Event('change', { bubbles: true })); d.value = m1; d.dispatchEvent(new Event('change', { bubbles: true })); await sleep(300); }
      ok(all('.pcd-fw-it').length === 1 && /10, 12/.test(txt($('.pcd-fw-it'))), 'lọc NV08 + ngày mai → 1 ca, mục 10, 12');
      // ---- Xác nhận đạt trong thẻ (người phụ trách chính / HD chính)
      if (role !== 'chu') {
        for (let i = 0; i < 60 && !$('.dtg-ph .it-check[data-no="13"]'); i++) await sleep(100);
        const before = txt($('summary', card1())); $('.dtg-ph .it-check[data-no="13"]').click(); await sleep(1500);
        ok(/Đạt 2\//.test(before) && /Đạt 3\//.test(txt($('summary', card1()))), 'Xác nhận đạt mục 13 → Đạt 2 → 3');
      }
      ok(fits(), 'trang không tràn ngang');
    }
    if (role === 'ql2' || role === 'c1') {
      await go('#/cong-viec/dao-tao');
      ok(!$('#pcd > .pcd-sum') && !!$('#pcd-mine'), 'không có bảng phân công; trang hiện Việc đào tạo của tôi');
      await go('#/hom-nay');
      const mine = $('#pcd-mine'); const card = $(`.pcd-mc[data-key="1|${m1}|Sáng"]`, mine || document);
      ok(!!mine && !!card, 'Việc hôm nay có khối Việc đào tạo của tôi, có ca mai');
      ok(card?.querySelector('a.pcd-mo')?.getAttribute('href') === '#/dao-tao/phieu?id=1', 'thẻ ca có đường "Mở phiếu ›" tới đúng phiếu');
      if (role === 'ql2' && card) {
        ok(/Bạn dạy/.test(txt(card)) && /10–12/.test(txt(card)) && !!$('[data-sub]', card), 'quản lý: "Bạn dạy" mục 10–12 + nút Giao lại cho Cấp 1');
        ok(/NV07.*13/.test(txt(card)), 'phần đã giao lại cho NV07 (mục 13)');
        ok(!!$('.pcd-mk[data-no="13"] [data-ktok]', mine), 'Chờ bạn kiểm tra có mục 13');
        $('[data-sub]', card).click(); await sleep(400); let dl = $('dialog[open].pcd-dlg');
        ok(!!dl && !!$('.pcd-mate[data-pick="7"]', dl) && !$('.pcd-mate[data-pick="8"]', dl), 'hộp Giao lại: chỉ Cấp 1 làm cùng ca (NV07)');
        ok(!!dl && !$('input[data-no="13"]', dl) && !!$('input[data-no="10"]', dl), 'hộp Giao lại: chỉ mục chưa chấm của tôi');
        ok(dfits(dl), 'hộp Giao lại không tràn ngang');
        ok(!!dl && $('#pcd-sgo', dl).disabled && /Chọn một nhân viên Cấp 1 trước/.test(txt(dl)), 'hộp Giao lại: chưa chọn người thì nút khoá, có câu nhắc chọn Cấp 1');
        if (dl) {
          $('.pcd-mate[data-pick="7"]', dl).click(); await sleep(200); dl = $('dialog[open].pcd-dlg');
          ok($('#pcd-sgo', dl).disabled && /dạy thay bạn/.test(txt(dl)), 'chọn NV07, chưa tích mục nào: nút vẫn khoá (trước đây bấm được dù 0 mục)');
          [10, 11].forEach((n) => { const x = $(`input[data-no="${n}"]`, dl); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); });
          ok(!$('#pcd-sgo', dl).disabled && /Giao lại 2 mục cho/.test(txt($('#pcd-sgo', dl))), 'tích 2 mục: nút ghi "Giao lại 2 mục cho …" — ' + txt($('#pcd-sgo', dl)));
          ok(dfits(dl), 'hộp Giao lại (đã chọn người) không tràn ngang');
          window.__DT_PLAN = []; $('#pcd-sgo', dl).click(); await sleep(1300);
          const p = (window.__DT_PLAN || [])[0];
          ok(p && p.fn === 'app_dt_sub_assign' && p.p_items.join() === '10,11' && p.p_employee === 7, 'Giao lại: lưu 1 lần đúng mục / người');
        }
        const c2 = $(`.pcd-mc[data-key="1|${m1}|Sáng"]`);
        ok(/NV07.*10, 11, 13|NV07.*10–11, 13/.test(txt(c2)) && !!$('[data-take="7"]', c2), 'thẻ hiện NV07 dạy 10, 11, 13 + nút Lấy lại');
        // bỏ tích hết phần NV07 đang giữ → nút thành "Lấy lại N mục từ …" (không lưu, đóng hộp)
        $('[data-sub]', c2)?.click(); await sleep(400); dl = $('dialog[open].pcd-dlg');
        if (dl) { $('.pcd-mate[data-pick="7"]', dl).click(); await sleep(200); dl = $('dialog[open].pcd-dlg');
          [...dl.querySelectorAll('input[data-no]:checked')].forEach((x) => { x.checked = false; x.dispatchEvent(new Event('change', { bubbles: true })); });
          ok(!$('#pcd-sgo', dl).disabled && /Lấy lại 2 mục từ/.test(txt($('#pcd-sgo', dl))), 'bỏ tích hết phần NV07 giữ: nút ghi "Lấy lại 2 mục từ …" — ' + txt($('#pcd-sgo', dl)));
          await closeDlg(); }
        $('[data-take="7"]', c2)?.click(); await sleep(1300);
        ok(/Bạn dạy.*10–12/.test(txt($(`.pcd-mc[data-key="1|${m1}|Sáng"]`))), 'Lấy lại → mục 10, 11 về quản lý');
        $('.pcd-mk[data-no="13"] [data-ktok]')?.click(); await sleep(1300);
        ok(!$('.pcd-mk[data-no="13"]'), 'Xác nhận đạt mục 13 → hết chờ kiểm tra');
      }
      if (role === 'c1' && card) ok(/giao lại/.test(txt(card)) && !$('[data-sub]', card), 'Cấp 1: thấy "(… giao lại)", không có nút Giao lại');
      if (role === 'c1') { const { rpc } = await import('../js/sb.js'); const P = await rpc('app_dt_my_plan'); ok((P.cap1 || []).length === 0, 'Cấp 1 không nhận danh sách nhân viên Cấp 1 (chỉ gửi quản lý)'); }
      ok(fits(), 'Việc hôm nay không tràn ngang');
    }
    if (role === 'nv') { await go('#/hom-nay'); ok(!$('#pcd-mine'), 'nhân viên không dạy: không có khối Việc đào tạo của tôi'); }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ pcdt: { ok: good, fail: bad } });
};
