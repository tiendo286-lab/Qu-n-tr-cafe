// Chặng 4: phiếu đào tạo theo TAB NGÀY THẬT (anh Tiến chốt 22/11). Chạy (chuan_bi.sh … --dao-tao-gia):
//   role=chu · role=ql (HD chính, NV05) · role=c1 (Cấp 1, NV07) · role=nv (người học, NV3) · role=kt&dtptc=7 (người phụ trách chính) · role=ql2
// index.html và test/phone.html (390px).
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const $ = (s, r = document) => r.querySelector(s); const all = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const waitFor = async (c, ms = 5000) => { for (let t = 0; t < ms; t += 100) { try { if (c()) return true; } catch (_) { /* chờ tiếp */ } await sleep(100); } return false; };
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const pane = (k) => $(`.dt-pane[data-pane="${k}"]`);
  const tab = (k) => $(`.dt-tab[data-tab="${k}"]`);
  const row = (no) => $(`.dt-item[data-no="${no}"]`);
  const card = (k, no) => $(`.dt-pane[data-pane="${k}"] .dt-hcard[data-no="${no}"]`);
  const where = (no) => row(no)?.closest('.dt-pane')?.dataset.pane;
  const shown = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  const pick = async (formId, value) => { const f = await waitFor(() => $(`dialog[open] #${formId}`)) && $(`dialog[open] #${formId}`); if (f) f.querySelector(`button[value="${value}"]`).click(); return !!f; };
  const tick = (el, v = true) => { el.checked = v; el.dispatchEvent(new Event('change')); };
  try {
    await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
    // 1. thanh tab theo ngày thật + tab Ngày tiếp theo
    ok(!!$('#dt-tabs') && /Ngày 1/.test(txt(tab(today))) && /hôm nay/.test(txt(tab(today))), '1. có tab "Ngày 1 · dd/mm · hôm nay" cho ngày thật đã có lần tích');
    ok(/Ngày tiếp theo/.test(txt(tab('next'))) && /còn 67/.test(txt(tab('next'))), '1. tab "Ngày tiếp theo · còn 67"');
    ok(!!tab('next')?.classList.contains('on') && shown(pane('next')) && !shown(pane(today)), '1. mở phiếu vào tab Ngày tiếp theo (còn hạng mục chưa có mức)');
    ok(all('.dt-item').length === 68 && new Set(all('.dt-item').map((r) => r.dataset.no)).size === 68, '1. mỗi hạng mục đúng 1 hàng để sửa (68 hàng)');
    ok(where(1) === today && where(2) === 'next' && where(68) === 'next', '1. hạng mục có mức → tab ngày đã dạy; chưa có mức → Ngày tiếp theo');
    ok(!$('.dt-day') && !$('.day-cmt[data-day="1"]'), '1. không còn khối ngày giáo trình kiểu cũ để ghi');
    // 2. tab một ngày: dòng lịch sử + thẻ chỉ xem
    tab(today).click(); await sleep(250);
    ok(shown(pane(today)) && !shown(pane('next')) && tab(today).classList.contains('on'), '2. bấm tab ngày → hiện đúng ngày đó');
    ok(/Mức đạt Tốt/.test(txt(row(1)?.querySelector('.dt-hl'))) && txt(row(1)?.querySelector('.dt-hl')).includes('admin – Chủ'), '2. hàng 1 có dòng lịch sử "Mức đạt Tốt · admin – Chủ"');
    ok(!!card(today, 2) && /Đã giới thiệu/.test(txt(card(today, 2))) && !!card(today, 2).querySelector('.dt-goto[data-tab="next"]'), '2. hạng mục 2 (chưa có mức) hiện thẻ lịch sử chỉ xem + nút "Xem ở Ngày tiếp theo ›"');
    if (card(today, 2)) {
      card(today, 2).querySelector('.dt-goto').click(); await sleep(300);
      ok(tab('next').classList.contains('on') && shown(row(2)), '2. "Xem ở Ngày tiếp theo ›" → sang tab đó, thấy hàng của hạng mục');
    }
    // 3. bộ lọc vẫn dùng được: hiện mọi hạng mục khớp (ẩn thanh tab), bỏ lọc thì về tab cũ
    const f = $('#dt-item-filter'); f.value = 'done'; f.dispatchEvent(new Event('change')); await sleep(150);
    ok($('#dt-tabs').hidden && shown(row(1)) && !shown(row(2)) && /\/68 hạng mục/.test(txt($('#dt-item-filter-count'))), '3. lọc "Hoàn thành": ẩn thanh tab, hiện hàng 1, ẩn hàng 2, có số đếm');
    f.value = 'all'; f.dispatchEvent(new Event('change')); await sleep(150);
    ok(!$('#dt-tabs').hidden && tab('next').classList.contains('on') && shown(row(2)) && !shown(row(1)), '3. chọn "Tất cả" → về lại tab đang xem');

    if (role === 'ql') {   // HD chính: chấm tại chỗ, đào tạo lại, nhận xét + xác nhận theo ngày, xác nhận đạt
      const r3 = row(3); tick(r3.querySelector('.it-intro'));
      ok(await waitFor(() => txt(r3.querySelector('.it-by')).includes('Quản lý thử')), '4. tích Giới thiệu hạng mục 3 → lưu');
      ok(row(3) === r3 && where(3) === 'next', '4. chấm ở Ngày tiếp theo: hàng không bị vẽ lại / không nhảy đi');
      tab(today).click();
      ok(await waitFor(() => card(today, 3) && /Đã giới thiệu/.test(txt(card(today, 3))) && txt(card(today, 3)).includes('5 – Quản lý thử')), '4. mở tab hôm nay → tải lại, thấy "Đã giới thiệu · 5 – Quản lý thử" cho hạng mục 3');
      ok(tab(today)?.classList.contains('on') && where(3) === 'next', '4. sau khi tải lại: vẫn ở tab hôm nay, hàng 3 vẫn ở Ngày tiếp theo');
      const rl = row(1)?.querySelector('.it-relearn'); ok(!!rl, '5. hạng mục đã có mức có nút "↻ Đào tạo lại"');
      if (rl) {
        rl.click(); ok(await pick('dt-relearn-level', 'tot'), '5. Đào tạo lại → hỏi mức');
        ok(await waitFor(() => /Đào tạo lại · Tốt → Tốt/.test(txt(row(1)?.querySelector('.dt-hl')))), '5. đào tạo lại ra đúng mức cũ vẫn thành dòng lịch sử "↻ Đào tạo lại · Tốt → Tốt"');
        ok(tab(today)?.classList.contains('on'), '5. vẫn ở tab hôm nay');
      }
      const cm = $(`.day-cmt[data-day="${today}"]`); ok(!!cm && !cm.disabled, '6. ô nhận xét theo ngày thật mở cho HD');
      if (cm) { cm.value = 'Học tốt hôm nay'; cm.dispatchEvent(new Event('change')); await waitFor(() => /Đã lưu/.test(txt($('#saved-indicator')))); }
      const hd = $(`.day-ok[data-day="${today}"][data-who="hd"]`); const nv = $(`.day-ok[data-day="${today}"][data-who="nv"]`);
      ok(!!hd && !hd.disabled && !!nv && nv.disabled, '6. HD bấm được "Người hướng dẫn xác nhận", không bấm thay nhân viên');
      if (hd) {
        hd.click();
        ok(await waitFor(() => /Người hướng dẫn đã xác nhận · 5 – Quản lý thử/.test(txt($(`.day-ok[data-day="${today}"][data-who="hd"]`)))), '6. xác nhận theo ngày thật hiện tên người xác nhận');
        ok($(`.day-cmt[data-day="${today}"]`)?.value === 'Học tốt hôm nay' && /Ghi bởi 5 – Quản lý thử/.test(txt(pane(today))), '6. nhận xét theo ngày thật lưu lại, ghi tên người viết');
      }
      await rpc('app__test_dt_pending', { p_no: 4, p_level: 'kha' });
      await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
      ok(where(4) === today && /chờ kiểm tra/.test(txt(row(4)?.querySelector('.dt-hl'))) && txt(row(4)?.querySelector('.dt-hl')).includes('Nhân viên cấp 1 thử'), '7. Cấp 1 ghi mức → dòng "chờ kiểm tra" mang tên Cấp 1, hàng ở tab hôm nay');
      const btn = row(4)?.querySelector('.it-check');
      if (btn) {
        btn.click();
        ok(await waitFor(() => /Xác nhận đạt/.test(txt(row(4)?.querySelector('.dt-hl'))) && txt(row(4).querySelector('.dt-hl')).includes('5 – Quản lý thử')), '7. Xác nhận đạt → dòng "✓ Xác nhận đạt · 5 – Quản lý thử"');
      } else ok(false, '7. thiếu nút Xác nhận đạt');
    }
    if (role === 'c1') {   // Cấp 1 được giao hạng mục 3
      await rpc('app__test_dt_assign', { p_no: 3, p_employee: 7 });
      await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
      const r3 = row(3); ok(where(3) === 'next' && !r3.querySelector('.it-intro').disabled, '4. Cấp 1 chấm được hạng mục được giao ở tab Ngày tiếp theo');
      tick(r3.querySelector('.it-intro')); await waitFor(() => txt(r3.querySelector('.it-by')));
      r3.querySelector('.it-prac').click(); ok(await pick('dt-practice-level', 'kha'), '4. tích Thực hành → hỏi mức');
      ok(await waitFor(() => row(3)?.querySelector('.dt-chkbox')), '4. ghi mức → "Chờ kiểm tra"');
      ok(where(3) === 'next', '4. hàng 3 vẫn nằm ở Ngày tiếp theo tới lần mở phiếu sau (không nhảy dưới tay)');
      tab(today).click(); await sleep(400);
      ok(/Mức đạt Khá · ⏳ chờ kiểm tra/.test(txt(card(today, 3))) && txt(card(today, 3)).includes('NV07 – Nhân viên cấp 1 thử'), '4. tab hôm nay: "Thực hành · Mức đạt Khá · ⏳ chờ kiểm tra · NV07"');
      ok($(`.day-cmt[data-day="${today}"]`)?.disabled && $(`.day-ok[data-day="${today}"][data-who="hd"]`)?.disabled, '6. Cấp 1 không ghi nhận xét / xác nhận phần người hướng dẫn');
    }
    if (role === 'nv') {   // người học
      ok(all('.it-intro').every((x) => x.disabled) && !$('.it-relearn'), '4. người học không chấm, không có nút Đào tạo lại');
      tab(today).click(); await sleep(250);
      const nv = $(`.day-ok[data-day="${today}"][data-who="nv"]`); ok(!!nv && !nv.disabled && $(`.day-ok[data-day="${today}"][data-who="hd"]`).disabled, '6. người học bấm được "Nhân viên xác nhận" của ngày thật');
      if (nv) { nv.click(); ok(await waitFor(() => /Nhân viên đã xác nhận · NV3 – Nhân viên thử/.test(txt($(`.day-ok[data-day="${today}"][data-who="nv"]`)))), '6. hiện "✓ Nhân viên đã xác nhận · NV3 – Nhân viên thử"'); }
    }
    if (role === 'chu') {   // Chủ: phiếu mới → tab tạm của hôm nay; nhận xét kiểu cũ chỉ xem
      ok(!!row(1)?.querySelector('.it-relearn'), '5. Chủ có nút "↻ Đào tạo lại"');
      await rpc('app_dt_day_comment', { p_id: 1, p_day: 1, p_comment: 'Nhận xét kiểu cũ ngày 1' });
      await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
      ok(/Nhận xét kiểu cũ ngày 1/.test(txt($('.dt-old'))) && !$('.dt-old textarea'), '8. nhận xét theo ngày giáo trình (trước khi đổi) còn, chỉ xem');
      const id2 = await rpc('app_dt_create', { p_employee: 8, p: { start_date: today, instructor_id: 5 } });
      await visit(`#/dao-tao/phieu?id=${id2}&t=${Date.now()}`);
      ok(all('.dt-tab').length === 1 && !!tab('next') && !$('.dt-dnote'), '9. phiếu mới chưa tích: chỉ có tab Ngày tiếp theo, chưa có ô nhận xét');
      const r1 = row(1); tick(r1.querySelector('.it-intro'));
      ok(await waitFor(() => tab(today)?.classList.contains('dt-tab-new')), '9. tích lần đầu trong ngày → thêm tab "Ngày 1 · hôm nay"');
      ok(row(1) === r1 && where(1) === 'next', '9. hàng vẫn tại chỗ');
      tab(today)?.click();
      ok(await waitFor(() => shown(pane(today)) && /Đã giới thiệu/.test(txt(card(today, 1))) && !!$(`.day-cmt[data-day="${today}"]`)), '9. bấm tab mới → thấy lịch sử hôm nay + ô nhận xét của ngày');
    }
    if (role === 'kt') {   // người phụ trách chính (dtptc=7): xem lịch sử, không chấm
      ok(!!$('#dt-tabs') && !$('.it-relearn') && all('.it-intro').every((x) => x.disabled), '4. người phụ trách chính xem được tab theo ngày, không chấm');
    }
    if (role === 'ql2') ok(!!$('#dt-tabs') && all('.dt-item').length === 68, '4. Quản lý khác xem được tab theo ngày');
    ok(fits(), 'không tràn ngang');
    const bar = $('#dt-tabs'); ok(!bar || bar.scrollWidth <= bar.clientWidth + 1 || getComputedStyle(bar).overflowX === 'auto', 'thanh tab cuộn ngang trong khung');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ dtc4: { ok: good, fail: bad } });
};
