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
    await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11', '.stc-pay');
    ok(!!$('.stc-pay') && $$('.branch-tabs a').length === 1 && !$('.stc-qn'), '7. quản lý cơ sở vào được Sổ thu chi: chỉ cơ sở được giao, không có Quỹ ngoài');
    out.push({ stc1: { ok: good, fail: bad } }); return;
  }

  // 1. hai bảng tiền mặt / chuyển khoản
  await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11', '.stc-pay');
  const pays = $$('.stc-pay');
  ok(pays.length === 2 && txt(pays[0]).includes('tiền mặt') && txt(pays[1]).includes('chuyển khoản'), '1. có 2 bảng Tiền mặt / Chuyển khoản');
  ok(num(txt($('.stc-pay .v'))) === sumItems(MONTH.items, { book: 'thu', pm: 'tm' }), '1. tổng thu tiền mặt đúng dữ liệu (' + txt($('.stc-pay .v')) + ')');
  // 2. hàng ô theo cột, lọc Thu nợ
  ok($$('.stc-tile[data-col]').map((t) => t.dataset.col).join() === COLS.thu.map((c) => c[0]).join(), '2. hàng ô đúng cột Sổ thu');
  // bước 164: bấm ô → danh sách từng khoản của loại đó (không còn bảng ngày)
  $('.stc-tile[data-col=no]').click(); await sleep(300); await wait('#stc-book .stc-fr'); await sleep(300);
  const nNo = MONTH.items.filter((x) => !x.void && x.book === 'thu' && x.pm === 'tm' && x.col === 'no').length;
  ok(location.hash.includes('cot=no') && $$('#stc-book .stc-fr').length === nNo && dayTree(MONTH, 'thu', 'tm', 'no').length > 0, '2. lọc Thu nợ: danh sách ' + nNo + ' khoản');
  // 3. mỗi dòng ghi ngày · ca, chỉ còn Thu nợ
  ok($$('#stc-book .stc-frh').every((h) => /\d{2}\/\d{2} · (ca |ngoài ca)/.test(txt(h))), '3. mỗi khoản ghi ngày · ca');
  const its = $$('#stc-book .stc-fr .stc-it');
  ok(its.length > 0 && its.every((i) => txt($('.stc-tag', i)) === 'thu nợ'), '3. bấm ca hiện khoản, chỉ còn Thu nợ');
  ok(its.some((i) => txt(i).includes('nợ từ')), '3. khoản thu nợ ghi "Nợ từ …"');
  // 4. Sổ chi: khoản Không tính có nhãn, Chi theo loại không cộng
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11', '.stc-pay');
  $('.stc-all')?.click(); await sleep(400);
  const kt = $$('.stc-it').find((i) => txt(i).includes('quản lý lấy tiền két'));
  ok(!!kt && !!$('.stc-nc', kt) && txt($('.stc-nc', kt)).includes('không tính chi phí'), '4. khoản "Không tính" có nhãn Không tính chi phí');
  ok(!$$('.stc-ty').some((t) => txt(t).includes('không tính')), '4. Chi theo loại không có khoản Không tính');
  // 5. không có nút sửa bấm được
  // bước 171: ca đã Hoàn thành đối soát / chưa xác nhận Fabi khoá bằng 1 dòng ghi chú đầu ca, từng dòng không lặp nút tắt; nút tắt (nếu có) không bấm được
  { const caThat = $$('#stc-book .stc-ca').filter((c) => !String(c.querySelector('[data-ca]')?.dataset.ca || '').startsWith('o:'));   // bỏ nhóm "Ngoài ca"
    ok(caThat.length > 0 && $$('.stc-act').every((b) => b.disabled) && caThat.every((c) => !c.querySelector('button.stc-ed:not([disabled])'))
      && $$('.stc-calock').some((n) => txt(n).includes('đã hoàn thành đối soát')),
      '5. khoản của ca không có nút sửa bấm được; ca khoá có ghi chú đầu ca (đã hoàn thành đối soát) — ' + caThat.length + ' ca, ' + $$('.stc-calock').length + ' ghi chú'); }
  ok(!txt($('#root')).includes('đang chạy thử'), '5. không còn chữ Đang chạy thử (bước 152: Sổ thu chi là chỗ làm chính)');
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
  if ($('details.stc-cmp')) $('details.stc-cmp').open = true;   // bước 166: So với trang cũ thu gọn cuối trang
  const cmp = $$('.stc-cmpr');
  ok(cmp.length === 1 && txt(cmp[0]).includes('18/11') && txt(cmp[0]).includes('20.000'), '11. so với trang cũ: 1 ngày khác 20.000 (' + cmp.map(txt).join(' | ') + ')');
  ok(!/−-|--\d/.test(txt($('#stc-page'))), '11. không có số hai dấu trừ');
  // 13. chuyển về Quỹ ngoài chờ Chủ nhận, nút tắt
  const qn = $$('.stc-qnl');
  ok(qn.some((r) => txt(r).includes('chờ chủ nhận') && $('button[data-qnok]:not([disabled])', r)), '13. khoản chờ Chủ nhận: Chủ có nút Đã nhận tiền (đợt 5)');
  // 14–17. Đối soát Fabi — 22/11 (anh Tiến duyệt) về lại Chốt ca: bảng tuần ở Chốt ca (ô ca hai dòng Việc · Tiền, trạng thái đọc ở ô + chú thích khi rê chuột),
  //   trang đối soát của ca: tab ② Phần tiền = bước 1–5, tab ③ Hoàn thành = bước 6 cũ; ca chờ kế toán: trang báo Chờ kế toán (luật 17/11). Chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
  await go('#/ca?cn=1&tuan=2026-11-16', '.cw-c[data-id="182"]');
  const hdr = txt($('.cw-t thead'));
  ok(hdr.includes('sáng') && hdr.includes('chiều') && hdr.includes('tối') && !hdr.includes('cuối ngày'), '14. bảng tuần Sáng / Chiều / Tối, không có cột Cuối ngày');
  const cell = (id) => $(`.cw-c[data-id="${id}"]`); const tip = (id) => (cell(id)?.getAttribute('title') || '').toLowerCase();
  const pick = async (id) => { await go(`#/ca/doi-soat-cu?id=${id}&tab=tien`, '#root .card'); await wait('.stc-dsp, #ds-nextca2', 100); await sleep(300); };
  const st = async (i) => { const b = $(`.stc-dsp .stc-steps [data-dsstep="${i}"]`); if (b) { b.click(); await sleep(350); } };   // bước 171: sang bước i + 1 của ca đang mở
  // ca 183 đã bấm Hoàn thành nhưng còn lệch tiền mặt chờ xử lý → dòng Tiền 🟠 (anh Tiến chốt 23/11, như ô cam "Còn lệch" của lịch cũ)
  ok(txt(cell(183)?.querySelector('.cw-dt')).includes('🟠') && tip(183).includes('còn chênh lệch') && txt(cell(182)?.querySelector('.cw-dt')).includes('🔴') && tip(182).includes('mở ca')
    && txt(cell(172)?.querySelector('.cw-dt')).includes('⏳') && tip(172).includes('chờ kế toán'), '14. ô ghi trạng thái ca (' + [183, 182, 172].map((i) => txt(cell(i)) + ' / ' + tip(i)).join(' | ') + ')');
  // bước 171: khung ca = 6 bước (① Số máy Fabi ② Tiền thực nhận ③ Khoản thu ④ Khoản chi ⑤ Chênh lệch ⑥ Hoàn thành) — nay ①–⑤ ở tab ②, ⑥ ở tab ③
  await pick(181);
  ok($$('.stc-dsp .stc-steps [data-dsstep]').length === 5 && !!$('[data-tab-pane="xong"] [data-dsundone]'), '15. ca đã hoàn thành: tab ② thanh 5 bước tiền, tab ③ Hoàn thành có nút Mở lại');
  await st(0); const n1 = $$('.stc-dsp .stc-pa .stc-fsum > div').length; await st(1);
  ok(!!$('.stc-dsp .stc-pa [data-dsreopen]') && n1 === 3 && $$('.stc-dsp .stc-pa .stc-fsum > div').length === 2, '15. ca đã xác nhận Fabi: bước 1 thu gọn 3 ô số máy, bước 2 có 2 ô tiền thực nhận + Mở lại xác nhận');
  await st(2); const coThu = !!$('.stc-dsp .stc-pb .stc-cab') && txt($('.stc-dsp .stc-pb')).includes('khoản thu của ca'); await st(3); const coChi = txt($('.stc-dsp .stc-pb')).includes('khoản chi của ca'); await st(4);
  ok(coThu && coChi && $$('.stc-dsp .stc-glc').length === 2, '15. bước 3 Khoản thu, bước 4 Khoản chi, bước 5 có 2 khung Chênh lệch (tiền mặt, chuyển khoản)');
  ok(!$('.stc-dsp [data-dsfinal]'), '15. bước 158: không còn nút Chốt ca');
  await pick(182);
  { const fb = !!$('.stc-dsp [data-dsfabi]:not([disabled])'); await st(1);
    ok(!!$('.stc-dsp [data-dsclose][disabled]') && fb, '16. còn ô đỏ: Xác nhận Fabi tắt (bước 2), Lấy số máy Fabi bấm được (bước 1)'); }
  await st(2);
  ok(txt($('.stc-dsp .stc-lockp')).includes('xác nhận fabi'), '16. chưa xác nhận Fabi: bước 3 khoá');
  await pick(172);
  ok(txt($('#root')).includes('chờ kế toán') && !$('.stc-dsp') && !$('[data-dsclose]:not([disabled])'), '17. ca chờ kế toán: trang báo Chờ kế toán, không có chỗ Xác nhận Fabi (luật 17/11)');
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
