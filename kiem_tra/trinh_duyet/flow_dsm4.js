// Trang đối soát ca mới — đợt 4 (chuyển hẳn, hoạt động độc lập). Kế hoạch: tai_lieu/superpowers/plans/2026-11-24-trang-doi-soat-ca-moi-dot-4.md.
// role=chu|qlt|ql · index.html và test/phone.html. Ca giả 182 (gắn 2 nhân viên giả).
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const wait = async (s, n = 80) => { for (let i = 0; i < n && !$(s); i++) await sleep(100); return $(s); };
  const until = async (f, n = 80) => { for (let i = 0; i < n; i++) { try { if (f()) return true; } catch (_) { /* chờ */ } await sleep(100); } return false; };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(250); location.hash = h; await sleep(500); if (sel) await wait(sel); await sleep(400); };
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const L = () => window.__LOG.filter((x) => x[0] === 'rpc'); const since = (n) => L().slice(n);
  const viec = () => $('[data-dsm-pane="viec"]');
  const submit = (f) => (f.requestSubmit ? f.requestSubmit() : f.querySelector('button[type=submit]')?.click());
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    try { await rpc('app__test_ca_staff', { p_id: 182, p_n: 2 }); } catch (_) { /* hook cũ */ }
    // 1. đường dẫn đối soát ca hiện nay mở trang mới; trang cũ chỉ còn ở đường dẫn dự phòng
    await go('#/ca/doi-soat?id=182&tab=viec', '#dsm');
    ok(!!$('#dsm'), '#/ca/doi-soat?id= mở trang đối soát ca mới');
    ok(!/trang cũ thẻ|Về trang cũ/i.test($('#dsm')?.textContent || ''), 'trang mới không còn chữ dẫn sang trang cũ (trừ đường dẫn dự phòng)');
    ok(/#\/ca\/doi-soat-cu\?id=182$/.test($('#dsm-old')?.getAttribute('href') || ''), `đường dẫn nhỏ "Trang cũ (dự phòng)": ${$('#dsm-old')?.getAttribute('href') || '-'}`);
    ok(/#\/ca\/phieu\?id=182$/.test($('#dsm-phieu')?.getAttribute('href') || ''), 'có nút Xem phiếu nhân viên');
    // 2. khối đánh giá nhân viên + nghỉ & làm thay nằm ngay trang ①
    await until(() => /Đánh giá/.test($('#dsm-dg')?.textContent || ''), 40);   // textContent: tiêu đề viết hoa bằng CSS
    ok(/Đánh giá/.test($('#dsm-dg')?.textContent || ''), 'trang ① có khối Đánh giá nhân viên');
    ok(!!$('#dsm-cv') && L().some((x) => x[1] === 'app_cv_get'), 'trang ① có khối Nghỉ & làm thay (đọc app_cv_get)');
    // 3. sửa người làm: hộp sửa, gửi ĐỦ danh sách người làm vào bản đối soát, đọc lại thấy giờ mới
    const nStaff = $$('[data-dsmst]', viec()).length;
    ok(nStaff >= 2, `mỗi người làm có nút Sửa (${nStaff})`);
    $('[data-dsmst="0"]', viec())?.click(); await wait('form [name=out]', 30);
    let f = $('[name=out]')?.closest('form');
    if (f) { const shown = (n) => { const el = f.querySelector(`[name=${n}]`)?.closest('[data-w]') || f.querySelector(`[name=${n}]`); return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; };
      f.worked.value = '0'; f.worked.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150);
      ok(!shown('out') && shown('absent'), `hộp sửa: chọn Phát sinh nghỉ → ẩn giờ đến / về, hiện ô lý do nghỉ (giờ: ${shown('out')}, lý do: ${shown('absent')})`);
      f.worked.value = '1'; f.worked.dispatchEvent(new Event('change', { bubbles: true })); await sleep(150); }
    if (f) { f.out.value = '13:15'; f.reason.value = 'thử đợt 4'; let n0 = L().length; submit(f);
      await until(() => since(n0).some((x) => x[1] === 'app_ca_recon_save'), 40); await until(() => /13:15/.test(viec()?.innerText || ''), 40); await sleep(300);
      const sv = since(n0).find((x) => x[1] === 'app_ca_recon_save');
      ok(!!sv && Array.isArray(sv[2]?.p?.staff) && sv[2].p.staff.length === nStaff && sv[2].p.staff[0].time_out === '13:15' && !('moves' in (sv[2].p || {})),
        `lưu người làm gửi đủ ${nStaff} người, chỉ khoá staff: ${JSON.stringify(sv?.[2]?.p?.staff?.map((x) => x.time_out) || null)}`);
      ok(/13:15/.test(viec()?.innerText || ''), 'đọc lại bản đối soát: hiện giờ về mới 13:15'); }
    else ok(false, 'hộp sửa người làm có ô giờ về');
    // 4. Nhân sự đã duyệt → sửa người làm: web bỏ duyệt Nhân sự trước rồi mới lưu (máy chủ khoá trường của mục đã duyệt)
    if (/Duyệt phần việc/.test($('#dsm-next1')?.textContent || '')) { $('#dsm-next1').click(); await until(() => !!$('[data-dsm-tab="tien"][aria-selected="true"]'), 40); await sleep(300); }
    $('[data-dsm-tab="viec"]')?.click(); await sleep(300);   // quay lại bước ① sửa người làm
    $('[data-dsmst="1"]', viec())?.click(); await wait('form [name=note]', 30);
    f = $('[name=note]')?.closest('form');
    if (f) { f.note.value = 'đi muộn có báo'; f.reason.value = 'thử đợt 4'; let n0 = L().length; submit(f);
      await until(() => since(n0).some((x) => x[1] === 'app_ca_recon_save'), 40); await sleep(500);
      const names = since(n0).map((x) => x[1] + (x[1] === 'app_ca_check' ? ':' + x[2].p_item + '=' + x[2].p_on : ''));
      const iU = names.indexOf('app_ca_check:nhan_su=false'), iS = names.indexOf('app_ca_recon_save');
      ok(iU >= 0 && iS > iU, `Nhân sự đã duyệt: bỏ duyệt rồi mới lưu: ${names.join(', ')}`); }
    // 5. thêm người hỗ trợ rồi bỏ: số người làm đổi theo
    $('#dsm-staffadd')?.click(); await wait('form [name=emp]', 30);
    f = $('[name=emp]')?.closest('form');
    if (f) { const op = [...f.emp.options].find((o) => o.value); f.emp.value = op?.value || ''; f.in.value = '08:00'; f.out.value = '10:00'; f.reason.value = 'thử đợt 4';
      submit(f); await until(() => $$('[data-dsmst]', viec()).length === nStaff + 1, 40); await sleep(300);
      ok($$('[data-dsmst]', viec()).length === nStaff + 1, `thêm người hỗ trợ: ${nStaff} → ${$$('[data-dsmst]', viec()).length}`);
      $(`[data-dsmst="${nStaff}"]`, viec())?.click(); await wait('form [data-del]', 30);
      const f2 = $('form [data-del]')?.closest('form'); if (f2) { f2.reason.value = 'thêm nhầm'; f2.querySelector('[data-del]').click(); }
      await until(() => $$('[data-dsmst]', viec()).length === nStaff, 40); await sleep(300);
      ok($$('[data-dsmst]', viec()).length === nStaff, 'bỏ người hỗ trợ vừa thêm: số người về như cũ'); }
    else ok(false, 'hộp thêm người hỗ trợ có ô chọn nhân viên');
    // 6. công việc bàn giao cho ca sau: thêm một việc
    $('#dsm-hoadd')?.click(); await wait('form [name=content]', 30);
    f = $('[name=content]')?.closest('form');
    if (f) { f.content.value = 'Máy xay số 2 kêu to — báo sửa'; f.reason.value = 'thử đợt 4'; let n0 = L().length; submit(f);
      await until(() => since(n0).some((x) => x[1] === 'app_ca_recon_handover_save'), 40); await until(() => /Máy xay số 2/.test(viec()?.innerText || ''), 40);
      const hv = since(n0).find((x) => x[1] === 'app_ca_recon_handover_save');
      ok(!!hv && (hv[2]?.p_items || []).some((x) => /Máy xay số 2/.test(x.content || '')) && /Máy xay số 2/.test(viec()?.innerText || ''), 'thêm công việc bàn giao: lưu và hiện trong danh sách'); }
    else ok(false, 'hộp thêm công việc bàn giao có ô nội dung');
    ok(fits(), `trang ① không tràn ngang (${document.documentElement.clientWidth}/${document.documentElement.scrollWidth})`);
    // 7. trang cũ dự phòng vẫn mở được, có nút sang trang mới
    await go('#/ca/doi-soat-cu?id=182', '#ds-newpage');
    ok(/#\/ca\/doi-soat\?id=182$/.test($('#ds-newpage')?.getAttribute('href') || ''), `trang cũ (dự phòng) có nút sang trang mới: ${$('#ds-newpage')?.getAttribute('href') || '-'}`);
  } catch (e) { bad.push('LỖI ' + e.message); }
  out.push({ route: 'trang đối soát ca mới (đợt 4: độc lập)', title: `ĐẠT ${good.length} · LỖI ${bad.length} || ${[...bad.map((x) => 'LỖI ' + x), ...good.map((x) => 'ĐẠT ' + x)].join(' || ')}`, len: 0, errs: [...window.__ERR, ...bad] });
};
