// Tệp 174: trang Phân công đào tạo theo ca + Việc đào tạo của tôi. Chạy (chuan_bi.sh … --dao-tao-gia, thời gian thật), index.html và test/phone.html:
//   role=chu · role=kt&dtptc=7 (người phụ trách chính) · role=ql (HD chính NV05) · role=ql2 (quản lý NV08 được giao) · role=c1 (Cấp 1 NV07) · role=nv
// Lịch giả ở dt_gia.js (script=flow_pcdt): phiếu 1 NV03 đi làm hôm kia S · hôm qua S · hôm nay C · mai S · ngày kia T; phiếu 2 NV04 không lịch.
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const $ = (s, r = document) => r.querySelector(s); const all = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const go = async (h) => visit(h + (h.includes('?') ? '&' : '?') + 't=' + Date.now());
  const addD = (n) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const today = addD(0), y = addD(-1), m1 = addD(1);
  const card1 = () => $('details.pcd-card[data-id="1"]');
  const openShift = async (date, shift) => { const c = card1(); if (c && !c.open) { c.open = true; await sleep(100); }
    $(`.pcd-sh[data-key="${date}|${shift}"]`, card1())?.click(); await sleep(500); return $('dialog[open].pcd-dlg'); };
  const closeDlg = async () => { $('dialog[open].pcd-dlg')?.close(); await sleep(200); };
  try {
    if (['chu', 'kt', 'ql'].includes(role)) {
      await go('#/dao-tao/phan-cong');
      ok(!!$('a[href="#/dao-tao/phan-cong"]'), 'menu có mục Phân công đào tạo');
      ok(!!$('#pcd .pcd-sum') && /\d/.test(txt($('#pcd .pcd-sum'))), 'có ô tổng có số');
      const c1 = card1();
      ok(!!c1 && txt(c1.querySelector('summary')).includes('Người học thử'), 'thẻ phiếu 1: tên nhân viên mới');
      if (c1) { c1.open = true; await sleep(150); }
      ok(all('.pcd-sh', c1).length === 5, 'phiếu 1 có 5 ca theo lịch đã công bố — có ' + all('.pcd-sh', c1).length);
      ok(/Ngày 3/.test(txt($(`.pcd-sh[data-key="${today}|Chiều"]`, c1))), 'ca hôm nay là "Ngày 3" (theo ngày đi làm thật)');
      const c2 = $('details.pcd-card[data-id="2"]'); if (c2) { c2.open = true; await sleep(100); }
      ok(/Chưa có lịch đã công bố/.test(txt(c2)), 'phiếu 2 không lịch: ghi "Chưa có lịch đã công bố"');
      ok(/giao lại/.test(txt($('.pcd-ktr[data-no="13"]', c1))), 'Chờ kiểm tra trong thẻ: mục 13 ghi "giao lại"');
      ok(role === 'chu' ? !$('.pcd-ktr [data-ktok]', c1) : !!$('.pcd-ktr[data-no="13"] [data-ktok]', c1), role === 'chu' ? 'Chủ không có nút Xác nhận đạt (chỉ HD chính / người phụ trách chính)' : 'có nút Xác nhận đạt');
      ok(/NV08/.test(txt($(`.pcd-sh[data-key="${m1}|Sáng"]`, c1))) && /giao lại/.test(txt($(`.pcd-sh[data-key="${m1}|Sáng"]`, c1))), 'dòng ca mai: nhóm NV08 + nhóm "giao lại"');
      // ---- Phân công ca mai
      let dl = await openShift(m1, 'Sáng');
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
      ok(/NV08.*10, 12/.test(txt($(`.pcd-sh[data-key="${m1}|Sáng"]`, card1()))), 'tích mục 11 cho NV07 → mục rời NV08 (còn 10, 12) — có ' + txt($(`.pcd-sh[data-key="${m1}|Sáng"]`, card1())));
      // ---- Chi tiết ngày đã qua
      dl = await openShift(y, 'Sáng');
      ok(!!dl && /Đã giới thiệu/.test(txt(dl)) && /Hiện tại/.test(txt(dl)) && !$('#pcd-go', dl), 'ca hôm qua: Chi tiết ngày như phiếu, không có nút Phân công');
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
        const before = txt($('summary', card1())); $('.pcd-ktr[data-no="13"] [data-ktok]', card1()).click(); await sleep(1300);
        ok(/Đạt 2\//.test(before) && /Đạt 3\//.test(txt($('summary', card1()))), 'Xác nhận đạt mục 13 → Đạt 2 → 3');
      }
      ok(fits(), 'trang không tràn ngang');
    }
    if (role === 'ql2' || role === 'c1') {
      await go('#/dao-tao/phan-cong');
      ok(!$('#pcd .pcd-sum') && !!$('#pcd-mine'), 'không có bảng phân công; trang hiện Việc đào tạo của tôi');
      await go('#/hom-nay');
      const mine = $('#pcd-mine'); const card = $(`.pcd-mc[data-key="1|${m1}|Sáng"]`, mine || document);
      ok(!!mine && !!card, 'Việc hôm nay có khối Việc đào tạo của tôi, có ca mai');
      if (role === 'ql2' && card) {
        ok(/Bạn dạy/.test(txt(card)) && /10–12/.test(txt(card)) && !!$('[data-sub]', card), 'quản lý: "Bạn dạy" mục 10–12 + nút Giao lại cho Cấp 1');
        ok(/NV07.*13/.test(txt(card)), 'phần đã giao lại cho NV07 (mục 13)');
        ok(!!$('.pcd-mk[data-no="13"] [data-ktok]', mine), 'Chờ bạn kiểm tra có mục 13');
        $('[data-sub]', card).click(); await sleep(400); let dl = $('dialog[open].pcd-dlg');
        ok(!!dl && !!$('.pcd-mate[data-pick="7"]', dl) && !$('.pcd-mate[data-pick="8"]', dl), 'hộp Giao lại: chỉ Cấp 1 làm cùng ca (NV07)');
        ok(!!dl && !$('input[data-no="13"]', dl) && !!$('input[data-no="10"]', dl), 'hộp Giao lại: chỉ mục chưa chấm của tôi');
        if (dl) {
          $('.pcd-mate[data-pick="7"]', dl).click(); await sleep(200); dl = $('dialog[open].pcd-dlg');
          [10, 11].forEach((n) => { const x = $(`input[data-no="${n}"]`, dl); x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); });
          window.__DT_PLAN = []; $('#pcd-sgo', dl).click(); await sleep(1300);
          const p = (window.__DT_PLAN || [])[0];
          ok(p && p.fn === 'app_dt_sub_assign' && p.p_items.join() === '10,11' && p.p_employee === 7, 'Giao lại: lưu 1 lần đúng mục / người');
        }
        const c2 = $(`.pcd-mc[data-key="1|${m1}|Sáng"]`);
        ok(/NV07.*10, 11, 13|NV07.*10–11, 13/.test(txt(c2)) && !!$('[data-take="7"]', c2), 'thẻ hiện NV07 dạy 10, 11, 13 + nút Lấy lại');
        $('[data-take="7"]', c2)?.click(); await sleep(1300);
        ok(/Bạn dạy.*10–12/.test(txt($(`.pcd-mc[data-key="1|${m1}|Sáng"]`))), 'Lấy lại → mục 10, 11 về quản lý');
        $('.pcd-mk[data-no="13"] [data-ktok]')?.click(); await sleep(1300);
        ok(!$('.pcd-mk[data-no="13"]'), 'Xác nhận đạt mục 13 → hết chờ kiểm tra');
      }
      if (role === 'c1' && card) ok(/giao lại/.test(txt(card)) && !$('[data-sub]', card), 'Cấp 1: thấy "(… giao lại)", không có nút Giao lại');
      ok(fits(), 'Việc hôm nay không tràn ngang');
    }
    if (role === 'nv') { await go('#/hom-nay'); ok(!$('#pcd-mine'), 'nhân viên không dạy: không có khối Việc đào tạo của tôi'); }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ pcdt: { ok: good, fail: bad } });
};
