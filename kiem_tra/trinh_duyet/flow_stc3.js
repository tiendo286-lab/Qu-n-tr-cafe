// Bài thử Sổ thu chi mới đợt 3: phiếu chênh lệch ngay trong sổ (trừ lương / quán chịu / ghép / phiếu thu, khoá chéo, Chủ duyệt).
// Chạy: index.html?auto=1&role=chu&script=flow_stc3 và test/phone.html?...; role=qlt: quán chịu → chờ Chủ duyệt, không có nút Duyệt.
// Kết quả: out[].stc3 = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = localStorage.getItem('test_role');
  const go = async (h) => { location.hash = h; await sleep(300); await wait('.stc-pay'); await sleep(400); $('.stc-all')?.click(); await sleep(300); };
  const dlg = () => $('dialog[open]');
  const setv = (sel, v) => { const el = $(sel, dlg()); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const row = (id) => $(`[data-gap="${id}"]`)?.closest('.stc-it');
  const openGap = async (id) => { $(`[data-gap="${id}"]`).click(); await wait('dialog[open] .stc-gapd', 30); await sleep(200); };
  const act = (k) => $(`[data-act="${k}"]`, dlg());
  const save = async () => { $('button[type=submit]', dlg()).click(); await sleep(900); };
  const settle = async (h) => { await wait('.stc-pay'); await sleep(300); await go(h); };
  const CHI = '#/quan-ly/so-thu-chi?tab=chi&cn=1&thang=2026-11&pm=tm', THU = '#/quan-ly/so-thu-chi?tab=thu&cn=1&thang=2026-11&pm=tm';
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);

  if (role === 'qlt') {
    await go(CHI); await openGap('g:183:tm');
    ok(!$('[data-ok]', dlg()), 'Q1. Quản lý tổng không có nút Duyệt');
    act('qc').click(); await sleep(100); setv('[name=reason]', 'Khách quỵt'); await save(); await settle(CHI);
    ok(txt(row('g:183:tm')).includes('⏳ chờ chủ duyệt'), 'Q2. quán chịu của Quản lý tổng → ⏳ chờ Chủ duyệt');
    await openGap('g:183:tm');
    ok(txt(dlg()).includes('quán chịu') && txt(dlg()).includes('chờ chủ duyệt') && !$('[data-ok]', dlg()), 'Q3. phiếu ghi quán chịu chờ Chủ duyệt, vẫn không có nút Duyệt');
    out.push({ stc3: { ok: good, fail: bad } }); return;
  }

  try {
  // 1. bấm khoản chênh lệch → mở phiếu
  await go(CHI);
  const b183 = $('[data-gap="g:183:tm"]');
  ok(!!b183 && !b183.disabled, '1. khoản chênh lệch có nút Phiếu chênh lệch');
  await openGap('g:183:tm');
  const t = txt(dlg());
  ok(['phải có', 'thực tế', 'lệch', '30.000', 'tú', 'ngọc'].every((w) => t.includes(w)), '1. phiếu có Phải có / Thực tế / Lệch / người làm ca');
  // 2. ca thiếu có 3 cách
  ok(!!act('tl') && !!act('qc') && !!act('match') && !act('thu'), '2. ca thiếu: Trừ lương / Quán chịu / Ghép');
  act('tl').click(); await sleep(100);
  ok($('[name=tl_900]', dlg())?.value === '15.000' && $('[name=tl_901]', dlg())?.value === '15.000', '2. trừ lương chia đều 15.000 / người');
  // 3. ghép: ca gợi ý trong 3 ngày, thiếu lý do bị báo
  act('match').click(); await sleep(100);
  ok(txt($('[name=cand]', dlg())).includes('ca sáng 18/11') && $('[name=match_amount]', dlg()).value === '20.000', '3. ghép gợi ý ca Sáng 18/11, số 20.000');
  setv('[name=reason]', ''); await save();
  ok(txt($('.stc-err', dlg())).includes('lý do'), '3. thiếu lý do bị báo');
  setv('[name=reason]', 'Ghép với ca sáng'); await save(); await settle(CHI);
  ok(txt(row('g:183:tm')).includes('30.000 − 20.000 ghép = 10.000') && txt($('.stc-amt', row('g:183:tm'))).includes('10.000'), '3. hiện "30.000 − 20.000 ghép = 10.000", sổ còn 10.000');
  await go(THU);
  ok(txt(row('g:181:tm')).includes('đã xử lý') && txt(row('g:181:tm')).includes('20.000 − 20.000 ghép = 0'), '3. ca dư bên kia: đã xử lý, 20.000 − 20.000 = 0');
  // 4. trừ lương phần còn lại → khoá ghép
  await go(CHI); await openGap('g:183:tm');
  ok(txt($('.stc-avail', dlg())).includes('10.000'), '4. còn xử lý được 10.000');
  act('tl').click(); await sleep(100);
  ok($('[name=tl_900]', dlg()).value === '5.000', '4. chia đều phần còn lại 5.000 / người');
  setv('[name=reason]', 'Trừ lương 2 bạn'); await save(); await settle(CHI);
  ok(txt(row('g:183:tm')).includes('đã xử lý'), '4. trừ lương hết phần còn lại → Đã xử lý');
  await openGap('g:183:tm');
  ok(act('match')?.disabled && txt(dlg()).includes('đã tạo phiếu trừ tiền'), '4. đã có phiếu trừ tiền → Ghép bị khoá');
  // 5. huỷ phiếu trừ tiền → ghép mở lại
  const undos = $$('[data-undo^="tl:"]', dlg());
  ok(undos.length === 2, '5. có 2 phiếu trừ tiền, mỗi phiếu có nút Huỷ');
  for (let i = 0; i < 2; i++) {
    if (!dlg()) await openGap('g:183:tm');
    setv('[name=reason]', 'Ghi nhầm'); $('[data-undo^="tl:"]', dlg()).click(); await sleep(900); await settle(CHI);
  }
  await openGap('g:183:tm');
  ok(!act('match')?.disabled && !$$('[data-undo^="tl:"]', dlg()).length, '5. huỷ hết phiếu trừ tiền → Ghép mở lại');
  dlg().close(); await sleep(200);
  // 6. Chủ duyệt quán chịu đang chờ
  await openGap('g:162:tm');
  ok(!!$('[data-ok^="qc:"]', dlg()) && txt(dlg()).includes('quản lý tổng'), '6. Chủ thấy nút Duyệt cho quán chịu đang chờ');
  $('[data-ok^="qc:"]', dlg()).click(); await sleep(900); await settle(CHI);
  ok(txt(row('g:162:tm')).includes('đã xử lý') && !txt(row('g:162:tm')).includes('⏳'), '6. Chủ duyệt → Đã xử lý');
  // 7. ca dư: ghép / phiếu thu / gán nợ; phiếu thu → khoá gán nợ
  await go(THU); await openGap('g:143:tm');
  ok(!!act('match') && !!act('thu') && !!act('no') && !act('tl'), '7. ca dư: Ghép / Phiếu thu / Gán nợ khách trả');
  ok(txt(row('g:143:tm')).includes('chưa làm phiếu thu'), '7. ca dư ghi "Chờ xử lý · chưa làm phiếu thu"');
  act('match').click(); await sleep(100);
  ok(txt(dlg()).includes('không có ca thiếu'), '7. không có ca thiếu trong 3 ngày → báo rõ');
  // 7b. gán nợ khách trả (chỉ nợ ghi trước ca) → hết dư; Huỷ thu ở dòng thu nợ → dư trở lại
  ok(!!act('no') && !act('no').disabled, '7b. Gán nợ khách trả bấm được');
  act('no').click(); await sleep(100);
  const dsel = txt($('[name=debt]', dlg()));
  ok(dsel.includes('cô lan anh') && !dsel.includes('bàn 5'), '7b. chỉ chọn được nợ ghi trước ca (' + dsel + ')');
  ok($('[name=debt_amount]', dlg())?.value === '10.000', '7b. số gán mặc định = phần dư 10.000');
  setv('[name=reason]', 'Cô Lan Anh trả nợ'); await save(); await settle(THU);
  const gn = () => $$('.stc-it:not(.void)').find((i) => txt(i).includes('cô lan anh') && txt(i).includes('gán nợ khách trả'));
  ok(!row('g:143:tm') && !!gn(), '7b. gán hết → không còn dư, có dòng thu nợ "Gán nợ khách trả"');
  $('button.stc-unc', gn()).click(); await wait('dialog[open]', 30); await sleep(200);
  setv('[name=reason]', 'Gán nhầm'); await save(); await settle(THU);
  ok(!!row('g:143:tm') && txt($('.stc-amt', row('g:143:tm'))).includes('10.000') && !gn(), '7b. Huỷ thu → ca dư 10.000 trở lại');
  await openGap('g:143:tm');
  act('thu').click(); await sleep(100); setv('[name=reason]', 'Tiền dư thật'); await save(); await settle(THU);
  await openGap('g:143:tm');
  ok(act('no')?.disabled && txt(dlg()).includes('đã tạo phiếu thu'), '7. đã tạo phiếu thu → Gán nợ bị khoá');
  // 8. không tràn ngang
  if (window.innerWidth <= 400) {
    ok(dlg().scrollWidth <= window.innerWidth + 1, `8. phiếu không tràn ngang (${dlg().scrollWidth}/${window.innerWidth})`);
    dlg().close(); await sleep(200);
    ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `8. trang không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`);
  }
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message + ' · ' + [...document.querySelectorAll('dialog[open] .stc-err')].map(txt).join(' | ')); }
  out.push({ stc3: { ok: good, fail: bad } });
};
