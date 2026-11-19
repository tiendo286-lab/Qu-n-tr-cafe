// Bài thử trang Sổ thu chi mới (đợt 1 — chỉ xem). Chạy: index.html?auto=1&role=chu&script=flow_stc1 và test/phone.html?...
// role=ql: chỉ kiểm thông báo "Đang chạy thử". Kết quả: out[].stc1 = { ok: [...], fail: [...] }.
import { MONTH } from './stc_fixture.js';
import { ALERT, COLS, dayTree, fundSummary, sumItems } from '../js/so_thu_chi_tinh.js';

export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();   // giao diện chung viết hoa một số nhãn
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const go = async (h, sel = '.stc-head') => { location.hash = h; await sleep(300); await wait(sel); await sleep(400); };
  const role = localStorage.getItem('test_role');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);

  if (role === 'qlt') {
    await go('#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11', '.stc-big');
    ok(!$('.stc-qn'), '12. Quản lý tổng không có nút Quỹ ngoài');
    ok($$('.stc-big').length === 3, '12. Quản lý tổng xem được tab Tổng');
    out.push({ stc1: { ok: good, fail: bad } }); return;
  }
  if (role === 'ql') {
    await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11', '#root .alert');
    ok(txt($('#root')).includes('đang chạy thử: chỉ chủ và quản lý tổng xem được.'), '7. quản lý cơ sở thấy thông báo đang chạy thử');
    out.push({ stc1: { ok: good, fail: bad } }); return;
  }

  // 1. hai bảng tiền mặt / chuyển khoản
  await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11', '.stc-pay');
  const pays = $$('.stc-pay');
  ok(pays.length === 2 && txt(pays[0]).includes('tiền mặt') && txt(pays[1]).includes('chuyển khoản'), '1. có 2 bảng Tiền mặt / Chuyển khoản');
  ok(num(txt($('.stc-pay .v'))) === sumItems(MONTH.items, { book: 'thu', pm: 'tm' }), '1. tổng thu tiền mặt đúng dữ liệu (' + txt($('.stc-pay .v')) + ')');
  // 2. hàng ô theo cột, lọc Thu nợ
  ok($$('.stc-tile[data-col]').map((t) => t.dataset.col).join() === COLS.thu.map((c) => c[0]).join(), '2. hàng ô đúng cột Sổ thu');
  $('.stc-tile[data-col=no]').click(); await sleep(300); await wait('.stc-day'); await sleep(300);
  ok(location.hash.includes('cot=no') && $$('.stc-day').length === dayTree(MONTH, 'thu', 'tm', 'no').length, '2. lọc Thu nợ: số ngày = ' + dayTree(MONTH, 'thu', 'tm', 'no').length);
  // 3. bấm ngày → ca → khoản
  $('.stc-day .stc-drow').click(); await sleep(250);
  ok($$('.stc-ca').length > 0, '3. bấm ngày hiện ca');
  $('.stc-ca .stc-crow').click(); await sleep(250);
  const its = $$('.stc-it:not(.add)');
  ok(its.length > 0 && its.every((i) => txt($('.stc-tag', i)) === 'thu nợ'), '3. bấm ca hiện khoản, chỉ còn Thu nợ');
  ok(its.some((i) => txt(i).includes('nợ từ')), '3. khoản thu nợ ghi "Nợ từ …"');
  // 4. Sổ chi: khoản Không tính có nhãn, Chi theo loại không cộng
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11', '.stc-pay');
  $('.stc-all')?.click(); await sleep(400);
  const kt = $$('.stc-it').find((i) => txt(i).includes('quản lý lấy tiền két'));
  ok(!!kt && !!$('.stc-nc', kt) && txt($('.stc-nc', kt)).includes('không tính chi phí'), '4. khoản "Không tính" có nhãn Không tính chi phí');
  ok(!$$('.stc-ty').some((t) => txt(t).includes('không tính')), '4. Chi theo loại không có khoản Không tính');
  // 5. không có nút sửa bấm được
  ok($$('.stc-act').length > 0 && $$('.stc-act').every((b) => b.disabled), '5. nút sửa / thêm đều tắt');
  ok(txt($('#root')).includes('đang chạy thử'), '5. có chữ Đang chạy thử');
  // 6. tháng chưa có dữ liệu
  await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-12', '.stc-pay');
  ok(txt($('#stc-book')).includes('tháng này chưa có khoản nào.'), '6. tháng 12 trống có chữ');
  // 9–11. Tab Tổng: 3 ô lớn, tồn quỹ theo ngày, so với trang cũ
  const F = fundSummary(MONTH);
  await go('#/quan-ly/so-thu-chi?tab=tong&cn=1&thang=2026-11', '.stc-big');
  const big = $$('.stc-big');
  ok(big.length === 3 && num(txt($('.v', big[1]))) === F.tm.ton && num(txt($('.v', big[2]))) === F.ck.ton, `9. 3 ô lớn, tiền mặt ${F.tm.ton}, tài khoản ${F.ck.ton}`);
  ok(big[1].classList.contains('hot') === (F.tm.ton > ALERT), '9. tiền mặt quá 20 triệu mới đỏ');
  ok($$('.stc-tf').length === 2 && txt($$('.stc-tf')[0]).includes('chuyển về quỹ ngoài'), '9. cách tính tiền mặt / tài khoản có dòng Chuyển về Quỹ ngoài');
  const dd = $$('.stc-dd');
  ok(dd.length > 0 && num(txt($('.end', dd[0]))) === F.tm.ton, '10. cuối ngày mới nhất = tồn quỹ');
  const cmp = $$('.stc-cmpr');
  ok(cmp.length === 1 && txt(cmp[0]).includes('18/11') && txt(cmp[0]).includes('20.000'), '11. so với trang cũ: 1 ngày khác 20.000 (' + cmp.map(txt).join(' | ') + ')');
  ok(!/−-|--\d/.test(txt($('#stc-page'))), '11. không có số hai dấu trừ');
  // 13. chuyển về Quỹ ngoài chờ Chủ nhận, nút tắt
  const qn = $$('.stc-qnl');
  ok(qn.some((r) => txt(r).includes('chờ chủ nhận') && $('button[data-qnok]:not([disabled])', r)), '13. khoản chờ Chủ nhận: Chủ có nút Đã nhận tiền (đợt 5)');
  // 14–17. Tab Đối soát Fabi
  await go('#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11', '.stc-wk');
  const hdr = txt($('.stc-wk .stc-hdr'));
  ok(hdr.includes('sáng') && hdr.includes('chiều') && hdr.includes('tối') && !hdr.includes('cuối ngày'), '14. bảng tuần Sáng / Chiều / Tối, không có cột Cuối ngày');
  const cell = (id) => $(`.stc-dsc[data-dsca="${id}"]`);
  ok(txt(cell(183)).includes('fabi ✓') && txt(cell(182)).includes('tiền mở ca') && txt(cell(172)).includes('chờ kế toán'), '14. ô ghi trạng thái ca (' + [183, 182, 172].map((i) => txt(cell(i))).join(' | ') + ')');
  // bước 151: khung ca = A · Fabi + B · Thu chi của ca + Chốt ca
  cell(181).click(); await sleep(400);
  ok(txt($('.stc-dsp .stc-pa')).includes('đã xác nhận') && $$('.stc-dsp .stc-pa .stc-fsum > div').length === 5, '15. ca đã xác nhận Fabi: phần A thu gọn 5 ô số');
  ok(!!$('.stc-dsp .stc-pb [data-dsbook="thu"]') && !!$('.stc-dsp .stc-pb [data-dsbook="chi"]') && !!$('.stc-dsp .stc-glc'), '15. phần B có Sổ thu | Sổ chi và khung Chênh lệch');
  ok(!!$('.stc-dsp [data-dsfinal]'), '15. có nút Chốt ca');
  cell(182).click(); await sleep(400);
  ok(!!$('.stc-dsp [data-dsclose][disabled]') && !!$('.stc-dsp [data-dsfabi]:not([disabled])'), '16. còn ô đỏ: Xác nhận Fabi tắt, Lấy số máy Fabi bấm được');
  ok(txt($('.stc-dsp .stc-pb')).includes('xác nhận fabi ở phần a'), '16. chưa xác nhận Fabi: phần B khoá');
  cell(172).click(); await sleep(400);
  ok(txt($('.stc-dsp .stc-pa')).includes('chờ kế toán') && !!$('.stc-dsp [data-dsclose][disabled]'), '17. ca chờ kế toán: ② ghi chờ kế toán, Xác nhận Fabi tắt');
  if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. đối soát: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  // 12. Quỹ ngoài (Chủ)
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=ngoai&thang=2026-11', '.stc-pay');
  ok(!$$('.stc-tabs a').some((a) => txt(a) === 'đối soát fabi'), '12. Quỹ ngoài không có tab Đối soát Fabi');
  $('.stc-all')?.click(); await sleep(300);
  ok($$('.stc-it').some((i) => txt(i).includes('1 cơ sở: hs')), '12. chi ngoài (tiền mặt) có nhãn cách chia');
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=ngoai&thang=2026-11&pm=ck', '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
  ok($$('.stc-it').some((i) => txt(i).includes('chia đều')), '12. chi ngoài (chuyển khoản) có nhãn Chia đều');
  // 8. không tràn ngang trên điện thoại
  if (window.innerWidth <= 400) {
    for (const t of ['tong']) { await go(`#/quan-ly/so-thu-chi?tab=${t}&cn=1&thang=2026-11`, '.stc-big');
      ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. ${t}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); }
    for (const t of ['thu', 'chi']) { await go(`#/quan-ly/so-thu-chi?tab=${t}&cn=1&thang=2026-11`, '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
      ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. ${t}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); }
  }
  out.push({ stc1: { ok: good, fail: bad } });
};
