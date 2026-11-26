// Việc #8 (anh Tiến 26/11/2026, chọn B): việc bàn giao chưa xong LUÔN hiện cho ca sau — tệp 183.
// Phiếu chốt ca: mở phiếu là thấy khung "Việc chưa xong từ ca trước" (cả trước khi nhận phần), dải nhắc ở các bước khác,
// bước Bàn giao bấm "Đã xong" / "Bỏ đánh dấu" được cả việc đã vào Công việc. Trang đối soát ca (role chu): thẻ chỉ xem.
// Chạy: role=nv và role=chu, ở index.html và test/phone.html.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const wait = async (s, n = 120) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  try {
    await wait('#root .page-head, #root h1, #root .appbar, #root .m-foot', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const { DATA: T } = await import('../test/data.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const id = await rpc('app_ca_open', { p_branch: ov[0].branch_id, p_date: day, p_shift: ov[0].shift });
    const cur = T.shift_reports.find((x) => x.id === id);
    // ca hôm qua cùng cơ sở (đã hoàn thành) có 2 việc bàn giao chưa xong: 1 việc thường, 1 việc đã vào Công việc
    const prevId = Math.max(...T.shift_reports.map((x) => x.id)) + 1;
    const yday = new Date(Date.parse(day) - 864e5).toISOString().slice(0, 10);
    T.shift_reports.push({ ...cur, id: prevId, work_date: yday, status: 'hoan_thanh' });
    const hId = Math.max(0, ...T.handover_items.map((x) => x.id)) + 1;
    T.handover_items.push({ id: hId, branch_id: cur.branch_id, report_id: prevId, content: 'Thay bóng đèn kho', created_by: 1, created_at: yday + ' 12:00:00' },
      { id: hId + 1, branch_id: cur.branch_id, report_id: prevId, content: 'Gọi thợ sửa máy lạnh', created_by: 1, created_at: yday + ' 12:01:00', task_id: 99901 });
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/ca/phieu?id=' + id; await wait('.cm-col'); await sleep(800);

    // 1. vừa mở phiếu (chưa nhận phần): thấy khung, chỉ xem
    const box0 = await wait('#cm-carried');
    ok(!!box0, 'mở phiếu: có khung Việc chưa xong từ ca trước');
    ok(/còn 2 việc/i.test(txt('#cm-carried')), `mở phiếu: còn 2 việc (${txt('#cm-carried h3')})`);
    ok($$('#cm-carried [data-ho-old]').length === 2, 'mở phiếu: hiện đủ 2 việc');
    ok(!$('#cm-carried [data-hodone]'), 'mở phiếu: chưa có nút Đã xong (chỉ xem)');
    ok(/cũng có trong Công việc/i.test(txt('#cm-carried')), 'việc đã vào Công việc ghi rõ "cũng có trong Công việc"');
    ok(!/Đã giao việc/.test(txt('#cm-carried')), 'không còn nhãn sai "Đã giao việc"');
    ok(fits(), 'mở phiếu: không tràn ngang');

    // 2. nhận phần → bước Nhân viên: dải nhắc
    $('#cm-claim')?.click(); await wait('.cm-person, #cm-helper'); await sleep(800);
    ok(/Còn 2 việc chưa xong từ ca trước/i.test(txt('.cm-ho-nhac')), `bước Nhân viên: dải nhắc (${txt('.cm-ho-nhac') || '-'})`);
    ok(!$('#cm-carried'), 'bước Nhân viên: không lặp khung đầy đủ');
    ok(fits(), 'bước Nhân viên: không tràn ngang');

    // 3. Xem việc › → bước Bàn giao: có nút Đã xong cho cả 2 việc
    $('.cm-ho-nhac [data-shift-step]')?.click();
    await until(() => $('#cm-carried [data-hodone]'));
    ok(/Bàn giao/i.test(txt('#cm-root h2')), `Xem việc › sang bước Bàn giao (${txt('#cm-root h2')})`);
    ok($$('#cm-carried [data-hodone]').length === 2, 'bước Bàn giao: 2 nút Đã xong (cả việc đã vào Công việc)');
    ok(!$('.cm-ho-nhac'), 'bước Bàn giao: không hiện dải nhắc');

    // 4. Đã xong việc đã vào Công việc
    $(`#cm-carried [data-hodone="${hId + 1}"]`).click();
    await until(() => T.handover_items.find((x) => x.id === hId + 1).done_at && $(`#cm-carried [data-hodone="${hId + 1}"][data-undo="1"]`));
    const h2 = T.handover_items.find((x) => x.id === hId + 1);
    ok(!!h2.done_at && h2.done_report_id === id, 'Đã xong: máy chủ ghi xong ở đúng phiếu');
    ok(/Bỏ đánh dấu/i.test($(`#cm-carried [data-hodone="${hId + 1}"]`)?.innerText || ''), 'Đã xong: nút đổi thành Bỏ đánh dấu');
    ok(/còn 1 việc/i.test(txt('#cm-carried h3')), `Đã xong: còn 1 việc (${txt('#cm-carried h3')})`);
    ok(/Công việc cũng tự đóng/i.test(txt('#saved-indicator')), `Đã xong: báo thẻ Công việc tự đóng (${txt('#saved-indicator')})`);

    // 5. Bỏ đánh dấu
    $(`#cm-carried [data-hodone="${hId + 1}"]`).click();
    await until(() => !T.handover_items.find((x) => x.id === hId + 1).done_at && /còn 2 việc/i.test(txt('#cm-carried h3')));
    ok(!T.handover_items.find((x) => x.id === hId + 1).done_at, 'Bỏ đánh dấu: việc mở lại');
    ok(/còn 2 việc/i.test(txt('#cm-carried h3')), 'Bỏ đánh dấu: còn 2 việc');
    ok(fits(), 'bước Bàn giao: không tràn ngang');

    // 6. Đã xong việc thường rồi để đó → trang đối soát ca (quản lý) thấy "Ca này làm xong"
    $(`#cm-carried [data-hodone="${hId}"]`).click();
    await until(() => T.handover_items.find((x) => x.id === hId).done_at);
    if (role !== 'nv') {
      location.hash = '#/__tam'; await sleep(250); location.hash = '#/ca/doi-soat?id=' + id; await wait('#dsm'); await sleep(600);
      $('[data-dsm-tab="viec"]')?.click(); await sleep(300);
      const c = await wait('#dsm-carried', 40);
      ok(!!c, 'trang đối soát ca: có thẻ Việc chưa xong từ ca trước');
      ok(/còn 1 việc/i.test(c?.innerText || ''), `trang đối soát ca: còn 1 việc (${(c?.querySelector('h2')?.innerText || '-').replace(/\s+/g, ' ')})`);
      ok(/Ca này làm xong/i.test(c?.innerText || '') && /ở Công việc/i.test(c?.innerText || ''), 'trang đối soát ca: nhãn Ca này làm xong + Chưa xong · ở Công việc');
      ok(!c?.querySelector('button'), 'trang đối soát ca: thẻ chỉ xem, không có nút');
      ok(fits(), 'trang đối soát ca: không tràn ngang');
    }
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'việc #8 bàn giao ca sau', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
