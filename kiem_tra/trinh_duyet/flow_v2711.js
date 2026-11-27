// Các việc anh Tiến chốt 27/11/2026 (lượt hỏi gom câu cũ). Chạy sau chuan_bi.sh <thư mục> --dao-tao-gia, index.html và test/phone.html:
//   role=chu | kt  — thẻ Ca của tôi ẩn (tài khoản không gắn nhân viên); số đỏ Cảnh báo chỉ đếm lỗi xếp sai; đầu trang điện thoại mỏng; Sổ thu chi nút IN HOA
//   role=ql | nv   — thẻ Ca của tôi vẫn hiện; ql: đầu trang điện thoại mỏng
//   role=c1        — tệp 188: mục đã xác nhận đạt thì Cấp 1 không sửa được; mục chờ kiểm tra vẫn sửa được; đang được giao giai đoạn 2 thì chấm lại được
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const q = (s, r = document) => r.querySelector(s);
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  const phone = innerWidth <= 520;
  const errOf = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message || 'lỗi'; } };
  try {
    if (role === 'c1') {
      await rpc('app__test_dt_assign', { p_no: 3, p_employee: 7 }); await rpc('app__test_dt_done', { p_no: 3, p_level: 'kha' });
      await rpc('app__test_dt_assign', { p_no: 4, p_employee: 7 }); await rpc('app__test_dt_pending', { p_no: 4, p_level: 'kha' });
      const T = await rpc('app_dt_get', { p_id: 1 });
      ok(T.cap1_lock === true, 'máy chủ báo người xem là Cấp 1 thuộc diện khoá mục đã xác nhận');
      const e3 = await errOf(() => rpc('app_dt_mark', { p_id: 1, p_no: 3, p: { level: 'tb' } }));
      ok(/đã được xác nhận đạt/.test(e3), 'Cấp 1 đổi mức mục ĐÃ xác nhận đạt: bị chặn, có câu giải thích — ' + (e3 || 'KHÔNG chặn'));
      const lv3 = (await rpc('app_dt_get', { p_id: 1 })).items.find((i) => i.no === 3);
      ok(lv3.level === 'kha' && !lv3.pending, 'mục 3 giữ nguyên mức Khá, vẫn tính đạt');
      const e4 = await errOf(() => rpc('app_dt_mark', { p_id: 1, p_no: 4, p: { level: 'tot' } }));
      ok(!e4, 'mục 4 đang CHỜ KIỂM TRA: Cấp 1 vẫn sửa mức được — ' + (e4 || 'được'));
      await visit('#/dao-tao/phieu?id=1&t=' + Date.now()); await sleep(400);
      // mục đã có mức có thể nằm ở tab ngày khác → tìm trên mọi tab
      let r3 = q('.dt-item[data-no="3"]');
      if (!r3) for (const b of [...document.querySelectorAll('.dt-days button, [data-day-tab], .v-tab')]) { b.click(); await sleep(250); r3 = q('.dt-item[data-no="3"]'); if (r3) break; }
      if (r3) {
        ok(r3.querySelector('.it-intro').disabled && r3.querySelector('.it-prac').disabled && r3.querySelector('.it-level').disabled, 'trên phiếu: 3 ô của mục 3 bị khoá với Cấp 1');
        ok(/Đã xác nhận đạt/.test(txt(r3.querySelector('.it-lock'))) && !r3.querySelector('.it-relearn'), 'mục 3 có dòng 🔒 "Đã xác nhận đạt…", không có nút Đào tạo lại');
      } else ok(true, '(mục 3 không nằm trên tab đang mở — đã kiểm bằng máy chủ)');
      const r4 = q('.dt-item[data-no="4"]');
      if (r4) ok(!r4.querySelector('.it-lock'), 'mục 4 chờ kiểm tra không có dòng khoá');
      ok(fits(), 'phiếu đào tạo không tràn ngang');
    } else {
      const root = await visit('#/hom-nay'); await sleep(300);
      const staff = role === 'ql' || role === 'nv';
      ok(staff ? !!q('#hn-ca') : !q('#hn-ca'), staff ? 'có nhân viên gắn: vẫn có thẻ Ca của tôi hôm nay' : 'tài khoản không gắn nhân viên: ẩn thẻ Ca của tôi hôm nay');
      ok(!!q('#hn-viec') && !/không gắn nhân viên/.test(txt(root)), 'Việc của tôi vẫn hiện; không còn câu "không gắn nhân viên"');
      ok(fits(), 'Việc hôm nay không tràn ngang');
      if (role !== 'nv') {
        const sb = q('.sidebar');
        if (phone && sb) {
          const nav = q('details.navd'); if (nav?.open) { nav.open = false; await sleep(150); }
          const h = sb.getBoundingClientRect().height;
          ok(h <= 84, 'điện thoại: phần đầu trang của quản lý cao ≤ 84px khi đóng menu — đang ' + Math.round(h) + 'px (trước ~140px)');
          const a = q('.sidebar .brand').getBoundingClientRect(), b = q('.sb-bell').getBoundingClientRect(), c = q('details.navd > summary').getBoundingClientRect();
          ok(Math.abs((b.top + b.bottom) / 2 - (c.top + c.bottom) / 2) <= 6 && a.top < c.bottom && a.bottom > c.top, 'tên web, chuông, nút Menu nằm trên một hàng');
          ok(b.right <= c.left + 1 && a.right <= b.left + 1 && c.right <= innerWidth, 'chuông và nút Menu không đè nhau, không tràn');
          q('details.navd > summary').click(); await sleep(250);
          ok(q('details.navd').open && q('.sidebar .nav a.item')?.getBoundingClientRect().top >= c.bottom - 1, 'bấm Menu: danh sách mở ra bên dưới hàng đầu');
          q('details.navd > summary').click(); await sleep(150);
        }
      }
      if (role === 'chu' || role === 'kt') {
        const W = await import('../js/warnings.js');
        const w = { thieu: [1, 2, 3], thieu_cap2: [1], xep_nghi: [1], xep_chua_order: [1, 2], vuot: [1], thong_3_ca: [] };
        ok(W.warnMenu(w, false) === 4, 'số đỏ Cảnh báo, tuần đang xếp dở: chỉ đếm lỗi xếp sai (4), không đếm 4 ca thiếu người — ra ' + W.warnMenu(w, false));
        ok(W.warnMenu(w, true) === 8 && W.warnTotal(w) === 8, 'tuần đã chốt: đếm đủ 8; trang Cảnh báo vẫn đếm đủ');
      }
      if (role === 'chu') {
        await visit('#/quan-ly/so-thu-chi'); await sleep(900);
        const up = (el) => el && getComputedStyle(el).textTransform === 'uppercase';
        const btn = q('#stc-page .btn'), tab = q('.stc-top .stc-tabs a'), br = q('.stc-top .branch-tabs a');
        ok(!!btn && up(btn), 'Sổ thu chi: nút viết IN HOA');
        ok(!!tab && up(tab) && (!br || up(br)), 'Sổ thu chi: thẻ trang và thẻ cơ sở viết IN HOA');
        const h = q('#stc-page h2, #stc-page h3'); ok(!h || up(h), 'Sổ thu chi: tiêu đề viết IN HOA');
        ok(fits(), 'Sổ thu chi không tràn ngang sau khi đổi IN HOA');
      }
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ v2711: { ok: good, fail: bad } });
};
