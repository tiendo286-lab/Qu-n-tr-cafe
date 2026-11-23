// Bài thử Sổ thu chi mới đợt 2a: sửa / thêm / xoá khoản ngoài ca (gạch ngang + phiếu bổ sung), người nợ ✓, Thu nợ.
// Chạy: index.html?auto=1&role=chu&script=flow_stc2 và test/phone.html?... Kết quả: out[].stc2 = { ok, fail }.
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): khối tiền một ca ở trang đối soát ca #/ca/doi-soat?id= (bước 1–5 = tab ②, bước 6 = tab ③). Chỉ đổi chỗ trỏ, ý kiểm giữ nguyên.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const go = async (h, sel = '.stc-pay') => { location.hash = h; await sleep(300); await wait(sel); await sleep(400); };
  const dlg = () => $('dialog[open]');
  const pan = () => $('.stc-addp');   // khung + Thêm phiếu nằm trong sổ (thay hộp nổi)
  const setp = (sel, v) => { const el = $(sel, pan()); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const setv = (sel, v) => { const el = $(sel, dlg()); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const openAll = async () => { $('.stc-all')?.click(); await sleep(300); };
  const item = (t) => $$('.stc-it:not(.void):not(.add)').find((i) => txt(i).includes(t));
  const total = () => num(txt($('.stc-pay.on .v')));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);

  // 1. nút Sửa / Xoá: khoản ngoài ca bấm được, khoản ca tắt
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11'); await openAll();
  // bước 171: ca đã Hoàn thành đối soát (ca Sáng 18/11) → Sổ chi khoá sửa / thêm, ghi chú đầu ca dẫn sang Đối soát Fabi; quản lý bấm Mở lại ở bước 6 rồi mới sửa được
  { const d0 = item('chi lương – minh'); const c0 = d0 && d0.closest('.stc-ca');
    ok(!!c0 && !$('button.stc-ed:not([disabled])', c0) && txt($('.stc-calock', c0)).includes('đã hoàn thành đối soát') && !!$('.stc-calock a[href*="doi-soat?id=181"]', c0) && !$('button.stc-addca:not([disabled])', c0) && !$('[data-toka]', c0),
      '0. bước 171: ca đã Hoàn thành đối soát → không có Sửa / Xoá, thêm phiếu, → Trừ lương; ghi chú đầu ca dẫn sang Đối soát Fabi'); }
  location.hash = '#/ca/doi-soat?id=181&tab=xong'; await wait('[data-tab-pane="xong"] [data-dsundone]', 60); await sleep(300);
  $('[data-tab-pane="xong"] [data-dsundone]')?.click(); await sleep(900);
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11'); await openAll();
  const td = item('tiền điện tháng 10');
  ok(!!td && !!$('button.stc-ed:not([disabled])', td), '1. khoản ngoài ca có nút Sửa / Xoá bấm được');
  const kt = item('chi lương – minh');
  ok(!!kt && !!$('.stc-act[disabled]', kt) && !$('button.stc-ed:not([disabled])', kt), '1. khoản tự động của ca (chi lương) vẫn tắt');
  // 2. sửa số tiền + lý do → gạch ngang + phiếu bổ sung
  const t0 = total();
  $('button.stc-ed', td).click(); await wait('dialog[open]', 30); await sleep(200);
  setv('[name=amount]', '1.300.000'); setv('[name=reason]', 'Hoá đơn đúng là 1.300.000');
  $('button[type=submit]', dlg()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  ok($$('.stc-it.void').some((i) => txt(i).includes('tiền điện tháng 10')), '2. dòng cũ gạch ngang');
  const td2 = item('tiền điện tháng 10');
  ok(!!td2 && txt(td2).includes('phiếu bổ sung của quản lý') && txt(td2).includes('1.300.000'), '2. dòng mới có nhãn Phiếu bổ sung của quản lý');
  ok(total() - t0 === 50000, `2. tổng chi tăng đúng 50.000 (${total() - t0})`);
  // 4. sửa không lý do (khoản Internet là chuyển khoản)
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&pm=ck'); await openAll();
  const inet = item('internet tháng 11'); ok(!!inet, '4. thấy khoản Internet ở bảng chuyển khoản');
  $('button.stc-ed', inet).click(); await wait('dialog[open]', 30); await sleep(200);
  setv('[name=amount]', '300.000'); setv('[name=reason]', '');
  $('button[type=submit]', dlg()).click(); await sleep(500);
  ok(txt($('.stc-err', dlg())).includes('ghi lý do sửa / xoá'), '4. sửa không lý do bị báo');
  // 3. xoá
  setv('[name=reason]', 'Ghi trùng'); $('button.stc-del', dlg()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  ok(!item('internet tháng 11') && $$('.stc-it.void').some((i) => txt(i).includes('internet tháng 11') && txt(i).includes('đã xoá') && txt(i).includes('ghi trùng')), '3. xoá → gạch ngang + "Đã xoá · lý do"');
  // 5. thêm phiếu ngoài ca, khoản chi (nhóm bắt buộc)
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&pm=tm');
  $('button.stc-add').click(); await wait('.stc-addp', 30); await sleep(200);
  ok(!dlg(), '5. + Thêm phiếu mở khung ngay trong sổ, không phải hộp nổi');
  setp('[name=kind]', 'chi'); setp('[name=note]', 'Mua khăn lau'); setp('[name=amount]', '40.000');
  $('button[type=submit]', pan()).click(); await sleep(500);
  ok(txt($('.stc-err', pan())).includes('chọn nhóm'), '5. chưa chọn nhóm bị báo');
  const cs = $('[name=cat]', pan()); setp('[name=cat]', cs.options[1]?.value || '');
  $('button[type=submit]', pan()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  const kl = item('mua khăn lau'); ok(!!kl && txt(kl).includes('thêm'), '5. khoản mới có nhãn "thêm"');
  // 6. người nợ (bước 164: khung Người nợ hiện khi bấm ô Cho nợ; bước 172: danh sách thật — đổi NHÓM công nợ thay cho ô ✓ không nhắc)
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&pm=tm&cot=no');
  const pr =$$('.stc-pp').find((r) => txt(r).includes('bàn 5'));
  ok(!!pr && txt(pr).includes('nợ khách hàng'), '6. Bàn 5 thuộc nhóm Nợ khách hàng (phiếu chốt ca nhắc thu)');
  $('[data-pedit]', pr).click(); await wait('dialog[open] [name=pgrp]', 30); await sleep(200);
  setv('[name=pgrp]', 'khac'); $('button[type=submit]', dlg()).click(); await sleep(900); await wait('.stc-pay');
  ok(txt($$('.stc-pp').find((r) => txt(r).includes('bàn 5'))).includes('người nhà'), '6. đổi sang nhóm Người nhà / người quen (chặng 6.4: tên mới của Nợ khác) → phiếu chốt ca không nhắc người này nữa');
  // 7. khách đang nợ → thu nợ một phần (bước 164: khung Khách còn nợ hiện khi bấm ô Thu nợ)
  await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11&cot=no');
  const kd = $$('.stc-kd').find((r) => txt(r).includes('cô lan anh'));
  $('button.stc-col', kd).click(); await wait('dialog[open]', 30); await sleep(200);
  // bước 159: khách đưa thiếu → web hỏi "Khách đưa thiếu … Đồng ý?" rồi mới ghi (phần thiếu thành nợ mới). Bài thử trả lời Đồng ý và kiểm là web có hỏi.
  const asked = []; const oldConfirm = window.confirm; window.confirm = (m) => { asked.push(String(m)); return true; };
  setv('[name=amount]', '15.000'); $('button[type=submit]', dlg()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  window.confirm = oldConfirm;
  ok(asked.length === 1 && asked[0].includes('đưa thiếu 5.000'), '7. thu nợ thiếu: web hỏi "Khách đưa thiếu 5.000 … Đồng ý?" (' + (asked[0] || 'không hỏi').slice(0, 60) + ')');
  ok(!dlg() && !!item('cô lan anh') && txt($$('.stc-kd').find((r) => txt(r).includes('cô lan anh'))).includes('5.000'), '7. thu nợ một phần: có khoản thu nợ, còn nợ 5.000');
  // 9–11. đợt 2b: khoản của ca đã chốt tiền sửa được; ca chưa chốt khoá; thêm vào ca bắt lý do
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&pm=tm'); await openAll();
  const da = item('mua đá');
  ok(!!da && !!$('button.stc-ed:not([disabled])', da), '9. khoản của ca đã chốt tiền có Sửa / Xoá');
  const st = item('mua sữa tươi');
  const stCa = st && st.closest('.stc-ca');   // bước 164: ca khoá ghi 1 dòng ghi chú đầu danh sách khoản, từng khoản không lặp
  ok(!!st && !$('button.stc-ed:not([disabled])', st) && !!stCa && txt($('.stc-calock', stCa)).includes('chưa xác nhận fabi'), '10. ca chưa xác nhận Fabi: khoá, ghi chú "Chưa xác nhận Fabi" ở đầu ca');
  $('button.stc-ed', da).click(); await wait('dialog[open]', 30); await sleep(200);
  setv('[name=amount]', '55.000'); setv('[name=reason]', 'Mua thêm đá');
  $('button[type=submit]', dlg()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  ok($$('.stc-it.void').some((i) => txt(i).includes('mua đá')) && txt(item('mua đá')).includes('55.000') && txt(item('mua đá')).includes('phiếu bổ sung'), '9. sửa khoản ca: gạch ngang + phiếu bổ sung 55.000');
  // chặng 6.3d (anh Tiến chọn 23/11): Sổ thu chi luôn ngoài ca — dòng ca có đường dẫn "+ Thêm phiếu … ở trang đối soát ca ›"
  const goCa = $$('a.stc-addca-go').find((a) => a.getAttribute('href').includes('#/ca/doi-soat?id='));
  ok(!!goCa && $$('a[href*="#/ca/doi-soat?id="]').length > 0, '11. "+ Thêm phiếu vào ca" ở Sổ thu chi là đường dẫn sang trang đối soát ca');
  ok(!$$('button.stc-addca[data-addca]').some((b) => !b.disabled), '11. Sổ thu chi không thêm phiếu vào ca tại sổ');
  // 8. không tràn ngang
  if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  out.push({ stc2: { ok: good, fail: bad } });
};
