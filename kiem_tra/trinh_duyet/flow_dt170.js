// Bước 170: Đào tạo — tab Phân công + Chờ kiểm tra. Chạy (chuan_bi.sh … --dao-tao-gia, thời gian thật):
//   role=chu · role=ql (HD chính) · role=kt&dtptc=7 (người phụ trách chính) · role=ql2 (Quản lý khác) · role=c1 (Cấp 1) — index.html và test/phone.html.
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const $ = (s, r = document) => r.querySelector(s); const all = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const go = async (h) => visit(h + (h.includes('?') ? '&' : '?') + 't=' + Date.now());
  try {
    let root = await go('#/cong-viec/dao-tao');
    const tabs = all('[data-dttab]').map((a) => a.dataset.dttab).join(',');
    if (role === 'ql2' || role === 'c1') {
      ok(tabs === '', `người không phải Chủ / người phụ trách chính / HD chính không thấy 2 tab mới (${role})`);
      ok(!!$('#dt-work') && all('nav[aria-label="Mục đào tạo"] a').length === 2, 'vẫn giữ nút Chạy bàn / Pha chế');
    } else {
      ok(tabs === 'phieu,phan-cong,kiem-tra', 'có 3 tab Phiếu | Phân công | Chờ kiểm tra — có ' + tabs);
      ok(/\d/.test(txt($('[data-dttab="phan-cong"] .badge'))), 'tab Phân công có số chưa giao');
      ok(all('nav[aria-label="Mục đào tạo"] a').length === 2, 'vẫn giữ nút Chạy bàn / Pha chế');
      // ---- Phân công
      root = await go('#/cong-viec/dao-tao?tab=phan-cong');
      const card = $('details.dtb[data-id="1"]');
      ok(!!card && txt(card.querySelector('summary')).includes('Người học thử') && txt(card.querySelector('summary')).includes('HD chính'), 'khối phiếu: tên NV mới, HD chính');
      ok(card && /Sáng/.test(txt(card.querySelector('.dtb-sched'))) && !/Chưa xếp lịch/.test(txt(card.querySelector('.dtb-sched'))), 'khối phiếu có 1 dòng lịch NV mới (thứ · cơ sở · ca)');
      card.open = true; await sleep(150);
      ok(all('.dtb-day', card).length >= 1 && /Ngày 1/.test(txt(card.querySelector('.dtb-dh'))), 'hạng mục chưa đạt xếp theo Ngày');
      const opt = (lab) => [...card.querySelectorAll(`.dtb-who optgroup[label^="${lab}"] option`)].map((o) => o.textContent);
      ok(opt('Cùng ca').some((x) => x.includes('NV07') && x.includes('trùng 2 ca')), 'gợi ý "Cùng ca": Cấp 1 NV07 trùng 2 ca — có ' + opt('Cùng ca').join(' / '));
      ok(opt('Cấp 1 cơ sở').some((x) => x.includes('NV09')), 'gợi ý "Cấp 1 cơ sở <mã>": NV09');
      ok(opt('Khác').some((x) => x.includes('NV05') && x.includes('HD chính')), 'nhóm "Khác" có HD chính');
      ok(card.querySelector('.dtb-br').value === '1', 'ô cơ sở chọn sẵn nơi NV mới có nhiều ca nhất (TEST)');
      const day1 = card.querySelector('[data-allday="1"]'); day1.checked = true; day1.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150);
      const n1 = all('.dtb-it[data-day="1"] input:not(:disabled)', card).length;
      ok(!card.querySelector('.dtb-bar').hidden && txt(card.querySelector('.dtb-cnt')) === String(n1) && n1 > 0, `"Chọn cả ngày" → thanh "Đã chọn ${n1}"`);
      const sel = card.querySelector('.dtb-who'); sel.value = '7';
      window.__DT_BULK = [];
      card.querySelector('.dtb-go').click(); await sleep(1300); root = document.getElementById('root');
      ok((window.__DT_BULK || []).length === 1 && window.__DT_BULK[0].p_items.length === n1 && window.__DT_BULK[0].p_employee === 7 && window.__DT_BULK[0].p_branch === 1, 'giao hàng loạt: lưu 1 lần (đúng hạng mục, người, cơ sở)');
      const c2 = $('details.dtb[data-id="1"]');
      ok(c2 && c2.open && all('.dtb-it[data-day="1"]', c2).every((x) => txt(x).includes('Đang giao Cấp 1')), 'sau khi giao: hạng mục Ngày 1 → "Đang giao Cấp 1", khối vẫn mở');
      const f = $('#dtb-st'); f.value = 'dang_giao'; f.dispatchEvent(new Event('change')); await sleep(900); root = document.getElementById('root');
      ok(all('details.dtb[data-id="1"] .dtb-it').length === n1, 'lọc trạng thái "Đang giao Cấp 1" đúng số hạng mục');
      // Trả về HD chính
      const c3 = $('details.dtb[data-id="1"]'); c3.open = true; const one = c3.querySelector('.dtb-it input[data-no]'); one.checked = true; one.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
      window.__DT_BULK = []; c3.querySelector('.dtb-back').click(); await sleep(1300);
      ok((window.__DT_BULK || []).length === 1 && window.__DT_BULK[0].p_employee === null, '"Trả về HD chính" gọi giao hàng loạt với người trống');
      const f2 = $('#dtb-st'); f2.value = ''; f2.dispatchEvent(new Event('change')); await sleep(900);
      ok(fits(), 'tab Phân công không tràn ngang');
      // ---- Chờ kiểm tra
      await rpc('app__test_dt_pending', { p_no: 10, p_level: 'tot' }); await rpc('app__test_dt_pending', { p_no: 11, p_level: 'kha' });
      root = await go('#/cong-viec/dao-tao?tab=kiem-tra');
      ok(txt($('[data-dttab="kiem-tra"] .badge')) === '2', 'tab Chờ kiểm tra có số chờ (2)');
      ok(all('.dtk-row').length === 2 && !$('.dtk-all, [data-check-all]'), 'gom theo phiếu, từng dòng, KHÔNG có xác nhận hàng loạt');
      if (role === 'chu') ok(!$('.dtk-ok') && /Chờ HD chính/.test(txt($('.dtk-row'))), 'Chủ (không phải HD chính / người phụ trách chính): xem, không có nút Xác nhận');
      else {
        const r10 = $('.dtk-row[data-no="10"]'); ok(!!r10?.querySelector('.dtk-ok') && r10.querySelector('.dtk-p2').hidden, 'mục mức Tốt: có Xác nhận đạt, ẩn Giao giai đoạn 2');
        const r11 = $('.dtk-row[data-no="11"]'); ok(!!r11 && !r11.querySelector('.dtk-p2').hidden, 'mục mức Khá: có Giao giai đoạn 2');
        r10.querySelector('.dtk-ok').click(); await sleep(1300);
        ok(all('.dtk-row').length === 1 && txt($('[data-dttab="kiem-tra"] .badge')) === '1', 'Xác nhận đạt → bớt 1 dòng chờ');
        $('.dtk-row[data-no="11"] .dtk-p2').click(); await sleep(800);
        const dl = $('dialog[open] #dt-guide-person-form'); ok(!!dl, 'Giao giai đoạn 2 → mở hộp giao người luyện thêm');
        if (dl) { dl.querySelector('[name=person]').value = '7'; dl.querySelector('button[type=submit]').click(); await sleep(1300); }
        ok(!all('.dtk-row').length, 'sau Giao giai đoạn 2: mục đã xác nhận mức, hết chờ kiểm tra');
      }
      ok(fits(), 'tab Chờ kiểm tra không tràn ngang');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ dt170: { ok: good, fail: bad } });
};
