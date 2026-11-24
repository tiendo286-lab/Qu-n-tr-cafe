// Trang đối soát ca mới — đợt 3 (Hoàn thành gộp, Mở lại, Duyệt phần việc, tự sang ca). Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-2-3.md (Task 4).
// role=chu|qlt|ql · index.html và test/phone.html. Ca giả 181 (dữ liệu thử: đã Hoàn thành sẵn, phần việc chưa duyệt).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(400); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const L = () => window.__LOG.filter((x) => x[0] === 'rpc'); const since = (n) => L().slice(n).map((x) => x[1]);
  const tab = async (k) => { $(`[data-dsm-tab="${k}"]`)?.click(); await sleep(250); };
  const ticksOf = async (rpc) => { const R = await rpc('app_ca_get', { p_id: 181 }); const D = await rpc('app_stc_month', { p_branch: R.branch_id, p_month: R.work_date.slice(0, 7) }); return [...((D.cas || []).find((c) => c.id === 181)?.ticks || [])].sort().join(','); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    try { await rpc('app__test_ca_staff', { p_id: 181, p_n: 2 }); } catch (_) { /* hook cũ */ }
    // 1. ca đã Hoàn thành: có nút Mở lại; Mở lại → bỏ Hoàn thành, sửa được
    await go('#/ca/doi-soat-moi?id=181&tab=xong', '#dsm');
    ok(!!$('#dsm-reopen'), 'ca đã Hoàn thành: có nút Mở lại');
    $('#dsm-reopen')?.click(); await wait('dialog[open] form, form [name=reason]', 30);
    let n0 = L().length; const f = $('[name=reason]')?.closest('form');
    if (f) { $('[name=reason]').value = 'thử đợt 3'; f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]')?.click(); }
    await until(() => since(n0).includes('app_ds2_reopen'), 40); await until(() => !!$('#dsm-done'), 40); await sleep(400);
    ok(since(n0).includes('app_ds2_reopen'), `Mở lại gọi app_ds2_reopen: ${since(n0).join(', ')}`);
    ok(!$('#dsm-reopen') && !!$('#dsm-done'), 'sau Mở lại: hết nút Mở lại, có nút Hoàn thành');
    // 2. Duyệt phần việc: một lệnh app_ds2_work_ok, phần việc thành đã duyệt
    await tab('viec');
    ok(!!$('#dsm-workok'), `trang Phần việc có nút Duyệt phần việc: ${$('#dsm-workok')?.innerText.trim() || '-'}`);
    n0 = L().length; $('#dsm-workok')?.click();
    await until(() => since(n0).includes('app_ds2_work_ok'), 40); await until(() => !$('#dsm-workok'), 40); await sleep(300);
    ok(since(n0).includes('app_ds2_work_ok') && !$('#dsm-workok'), `Duyệt phần việc gọi app_ds2_work_ok rồi hết nút: ${since(n0).join(', ')}`);
    // 3. Hoàn thành khi còn mục cần hỏi người chưa tích → báo rõ, không lưu gì (ô tích không đổi)
    const t0 = await ticksOf(rpc);
    await tab('xong'); n0 = L().length; $('#dsm-done')?.click();
    await until(() => since(n0).includes('app_ds2_finish'), 40); await until(() => /\S/.test($('#dsm-finerr')?.innerText || ''), 40); await sleep(300);
    ok(/Còn mục|chưa|Chờ/i.test($('#dsm-finerr')?.innerText || ''), `Hoàn thành thiếu mục → báo: ${($('#dsm-finerr')?.innerText || '-').slice(0, 120)}`);
    ok(!$('#dsm-reopen'), 'Hoàn thành thiếu mục → ca chưa Hoàn thành');
    ok(await ticksOf(rpc) === t0, 'Hoàn thành thiếu mục → không lưu ô tích nào');
    // 4. tích đủ mục cần hỏi người + chọn nhóm + Để sau ở trang Tiền, rồi Hoàn thành → xong; tự sang ca sau 1,5 giây, bấm "Ở lại ca này" thì ở lại
    await tab('tien');
    for (let g = 0; g < 8 && $('[data-dsm-pane="tien"] select[data-catx].need'); g++) { const s = $('[data-dsm-pane="tien"] select[data-catx].need'); s.value = [...s.options].find((o) => o.value && o.value !== 'x')?.value || ''; s.dispatchEvent(new Event('change', { bubbles: true })); await sleep(600); }
    for (let g = 0; g < 4 && $('[data-dsm-pane="tien"] [data-dssau][aria-pressed="false"]'); g++) { $('[data-dsm-pane="tien"] [data-dssau][aria-pressed="false"]').click(); await sleep(600); }
    for (let g = 0; g < 12 && $('[data-dsm-pane="tien"] [data-tick][aria-pressed="false"]:not([data-tick="anh"]):not([data-tick="sot"]):not([data-tick="that"]):not([data-tick="goi"])'); g++) {
      $('[data-dsm-pane="tien"] [data-tick][aria-pressed="false"]:not([data-tick="anh"]):not([data-tick="sot"]):not([data-tick="that"]):not([data-tick="goi"])').click(); await sleep(600); }
    await tab('xong');
    const conf = $$('.dsm-confirm li').map((x) => x.innerText.trim());
    ok(conf.length > 0, `trang Hoàn thành ghi rõ bấm là xác nhận: ${conf.join(' · ')}`);
    n0 = L().length; $('#dsm-done')?.click();
    await until(() => !!$('#dsm-stay'), 40);
    ok(since(n0).includes('app_ds2_finish') && !!$('#dsm-stay'), `Hoàn thành đủ → xong, có nút "Ở lại ca này": ${since(n0).join(', ')}`);
    $('#dsm-stay')?.click(); await sleep(2200);
    ok(/id=181\b/.test(location.hash) && !!$('#dsm-reopen'), `bấm Ở lại → vẫn ở ca 181, ca đã Hoàn thành (${location.hash})`);
    ok(fits(), `trang Hoàn thành không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    // 5. Mở lại rồi Hoàn thành lần nữa, không bấm Ở lại → tự sang ca tiếp theo chưa xong (hoặc báo hết ca)
    $('#dsm-reopen')?.click(); await wait('form [name=reason]', 30);
    const f2 = $('[name=reason]')?.closest('form'); if (f2) (f2.requestSubmit ? f2.requestSubmit() : f2.querySelector('button[type=submit]')?.click());
    await until(() => !!$('#dsm-done'), 40); await sleep(300);
    $('#dsm-done')?.click();
    const moved = await until(() => !/id=181\b/.test(location.hash) || /Hết ca/.test($('#dsm')?.innerText || ''), 60);
    ok(moved, `Hoàn thành xong tự sang ca tiếp theo chưa xong: ${location.hash}`);
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'trang đối soát ca mới (đợt 3: Hoàn thành mới)', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
