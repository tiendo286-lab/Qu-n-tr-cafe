// Bước 173 đợt C phần 2 (tệp 154): thiếu tiền khi giao ca → "Hai ca cùng chịu" (chia đôi, ca này chịu phần lẻ). Chạy role chu / qlt / ql, index.html và test/phone.html.
//  Ca 182 (Chiều 18/11, chưa xác nhận Fabi), ca trước 181 thu theo ca → phải mở 1.000.000. Bài đặt mở ca 975.001 (thiếu 24.999).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s);
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 60) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const wide = (m) => ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, m + ': không tràn ngang');
  const type = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const calls = (fn, from = 0) => (window.__LOG || []).slice(from).filter((x) => x[0] === 'rpc' && x[1] === fn).map((x) => x[2]);
  const DS = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-11';
  const open = async () => { location.hash = '#/quan-ly/so-thu-chi?tab=doi-soat&cn=1&thang=2026-10&t=' + Date.now(); await sleep(500);
    location.hash = DS + '&ds=182&b=1&t=' + Date.now(); await sleep(400); await wait('.stc-dsp'); await sleep(500); };
  const box = () => $('.stc-dsp .stc-c4[data-k="mo"]');
  const dlg = () => $('dialog[open]');
  const sb = (await import('/js/sb.js')).sb;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await sb.rpc('app__thu_mo_ca', { p_report: 182, p_val: 975001 }); await open();
    ok(box()?.classList.contains('red') && txt(box()).includes('thiếu 24.999'), 'ô Tiền mở ca đỏ: thiếu 24.999 khi giao ca');
    ok(!!box()?.querySelector('[data-dsblame="truoc"]') && !!box()?.querySelector('[data-dsblame="doi"]') && !!box()?.querySelector('[data-dsblame="nay"]'), 'thiếu → 3 nút: Ca trước ghi sai · Hai ca cùng chịu · Ca này ghi sai');
    wide('ô Tiền mở ca 3 nút');
    box().querySelector('[data-dsblame="doi"]').click(); await wait('dialog[open] [name=reason]', 40); await sleep(200);
    ok(txt(dlg()).includes('chia đôi'), 'hộp hỏi giải thích chia đôi');
    const k0 = (window.__LOG || []).length;
    $('button[type=submit]', dlg()).click(); await sleep(600);
    ok(calls('app_stc_ds_blame', k0).length === 0 && !!dlg(), 'chưa ghi lý do → chưa gửi');
    type($('[name=reason]', dlg()), 'Không rõ ai đếm sai'); $('button[type=submit]', dlg()).click(); await sleep(900);
    const sent = calls('app_stc_ds_blame', k0);
    ok(sent.length === 1 && sent[0].p_who === 'doi', 'gửi đúng 1 lần, chọn "doi"');
    await open();
    ok(box()?.classList.contains('ok') && txt(box()).includes('hai ca cùng chịu') && txt(box()).includes('−12.499') && txt(box()).includes('−12.500'),
      'ô xanh: Hai ca cùng chịu — ca trước −12.499 · ca này −12.500 (ca này chịu phần lẻ): ' + txt(box()));
    ok(txt(box()).includes('của ca trước và') , 'ghi rõ dòng Chênh lệch của mỗi ca');
    wide('ô đã chọn hai ca cùng chịu');
    box().querySelector('[data-dsunblame]').click(); await wait('dialog[open] [name=reason]', 40); await sleep(200);
    type($('[name=reason]', dlg()), 'chọn lại'); $('button[type=submit]', dlg()).click(); await sleep(900); await open();
    ok(box()?.classList.contains('red') && !!box()?.querySelector('[data-dsblame="doi"]'), 'Huỷ chọn → về đỏ, hỏi lại');
    // thừa → không có nút chia đôi
    await sb.rpc('app__thu_mo_ca', { p_report: 182, p_val: 1020000 }); await open();
    ok(box()?.classList.contains('red') && !box()?.querySelector('[data-dsblame="doi"]') && !!box()?.querySelector('[data-dsblame="nay"]'), 'thừa → không có "Hai ca cùng chịu"');
  } catch (e) { bad.push('LỖI CHẠY: ' + e.message); }
  out.push({ stc14: { ok: good, fail: bad } });
};
