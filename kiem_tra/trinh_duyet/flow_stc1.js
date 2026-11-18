// Bài thử trang Sổ thu chi mới (đợt 1 — chỉ xem). Chạy: index.html?auto=1&role=chu&script=flow_stc1 và test/phone.html?...
// role=ql: chỉ kiểm thông báo "Đang chạy thử". Kết quả: out[].stc1 = { ok: [...], fail: [...] }.
import { MONTH } from './stc_fixture.js';
import { COLS, dayTree, sumItems } from '../js/so_thu_chi_tinh.js';

export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();   // giao diện chung viết hoa một số nhãn
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const go = async (h, sel = '.stc-head') => { location.hash = h; await sleep(300); await wait(sel); await sleep(400); };
  const role = localStorage.getItem('test_role');
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);

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
  // 8. không tràn ngang trên điện thoại
  if (window.innerWidth <= 400) {
    for (const t of ['thu', 'chi']) { await go(`#/quan-ly/so-thu-chi?tab=${t}&cn=1&thang=2026-11`, '.stc-pay'); $('.stc-all')?.click(); await sleep(300);
      ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. ${t}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); }
  }
  out.push({ stc1: { ok: good, fail: bad } });
};
