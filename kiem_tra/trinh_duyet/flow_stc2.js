// Bài thử Sổ thu chi mới đợt 2a: sửa / thêm / xoá khoản ngoài ca (gạch ngang + phiếu bổ sung), người nợ ✓, Thu nợ.
// Chạy: index.html?auto=1&role=chu&script=flow_stc2 và test/phone.html?... Kết quả: out[].stc2 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const go = async (h, sel = '.stc-pay') => { location.hash = h; await sleep(300); await wait(sel); await sleep(400); };
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg()); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const openAll = async () => { $('.stc-all')?.click(); await sleep(300); };
  const item = (t) => $$('.stc-it:not(.void):not(.add)').find((i) => txt(i).includes(t));
  const total = () => num(txt($('.stc-pay.on .v')));
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);

  // 1. nút Sửa / Xoá: khoản ngoài ca bấm được, khoản ca tắt
  await go('#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11'); await openAll();
  const td = item('tiền điện tháng 10');
  ok(!!td && !!$('button.stc-ed:not([disabled])', td), '1. khoản ngoài ca có nút Sửa / Xoá bấm được');
  const kt = item('quản lý lấy tiền két');
  ok(!!kt && !!$('.stc-act[disabled]', kt) && !$('button.stc-ed:not([disabled])', kt), '1. khoản của ca vẫn tắt');
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
  $('button.stc-add').click(); await wait('dialog[open]', 30); await sleep(200);
  setv('[name=kind]', 'chi'); setv('[name=note]', 'Mua khăn lau'); setv('[name=amount]', '40.000');
  $('button[type=submit]', dlg()).click(); await sleep(500);
  ok(txt($('.stc-err', dlg())).includes('chọn nhóm'), '5. chưa chọn nhóm bị báo');
  const cs = $('[name=cat]', dlg()); setv('[name=cat]', cs.options[1]?.value || '');
  $('button[type=submit]', dlg()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  const kl = item('mua khăn lau'); ok(!!kl && txt(kl).includes('thêm'), '5. khoản mới có nhãn "thêm"');
  // 6. người nợ ✓
  const pr = $$('.stc-pp').find((r) => txt(r).includes('bàn 5'));
  ok(!!pr && txt(pr).includes('phiếu chốt ca nhắc thu'), '6. Bàn 5 đang được nhắc');
  $('input[type=checkbox]', pr).click(); await sleep(900); await wait('.stc-pay');
  ok(txt($$('.stc-pp').find((r) => txt(r).includes('bàn 5'))).includes('không nhắc'), '6. bấm ✓ → không nhắc ở phiếu chốt ca');
  // 7. khách đang nợ → thu nợ một phần
  await go('#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11');
  const kd = $$('.stc-kd').find((r) => txt(r).includes('cô lan anh'));
  $('button.stc-col', kd).click(); await wait('dialog[open]', 30); await sleep(200);
  setv('[name=amount]', '15.000'); $('button[type=submit]', dlg()).click(); await sleep(900); await wait('.stc-pay'); await openAll();
  ok(!!item('cô lan anh') && txt($$('.stc-kd').find((r) => txt(r).includes('cô lan anh'))).includes('5.000'), '7. thu nợ một phần: có khoản thu nợ, còn nợ 5.000');
  // 8. không tràn ngang
  if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  out.push({ stc2: { ok: good, fail: bad } });
};
