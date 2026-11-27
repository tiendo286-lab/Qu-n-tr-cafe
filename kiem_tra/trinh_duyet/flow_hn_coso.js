// Việc hôm nay đợt 2 (27/11/2026): Theo dõi theo cơ sở. role=chu | qlt (có quyền xem Tất cả công việc) | ql | nv (không có quyền).
// Chạy ở index.html và test/phone.html, sau chuan_bi.sh <thư mục> --dao-tao-gia.
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = (s) => Number((String(s).match(/\d+/) || [0])[0]);
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  const q = (s) => document.querySelector(s); const qa = (s) => [...document.querySelectorAll(s)];
  const rows = () => qa('#hn-viec section.hn-grp:not([data-cat="done"]) a.hn-row');
  try {
    await visit('#/hom-nay'); await sleep(300);
    if (role === 'ql' || role === 'nv') {
      ok(!q('#hn-coso') && !q('#hn-tabs') && !q('#hn-brs'), 'không có quyền xem Tất cả công việc: không có bảng Theo cơ sở, không có thẻ Mọi người');
      ok(!!q('#hn-viec'), 'Việc của tôi vẫn hiện bình thường');
      ok(fits(), 'trang không tràn ngang');
    } else {
      const cs = q('#hn-coso');
      ok(!!cs, 'ô Theo dõi có bảng Theo cơ sở');
      const btns = qa('#hn-coso .hn-cs');
      ok(btns.slice(0, 5).map((b) => txt(b.querySelector('b'))).join('|') === 'LHP|ĐK|HS|LL|LLB', 'đủ 5 cơ sở theo thứ tự của hệ thống — ' + btns.map((b) => txt(b.querySelector('b'))).join('|'));
      const total = num(txt(cs.querySelector('.sub')));
      ok(btns.reduce((s, b) => s + num(txt(b.querySelector('.hn-cs-n'))), 0) === total && total > 0, 'cộng số việc các dòng = tổng việc của mọi người (' + total + ')');
      ok(btns.every((b) => b.querySelector('.hn-cs-f .pill')), 'mỗi dòng có nhãn quá hạn / chưa có người nhận / không trễ');
      ok(q('#hn-tabs [data-view="all"]') && q('#hn-tabs [data-view="mine"]'), 'có 2 thẻ Việc của tôi · Mọi người');
      ok(q('#hn-tabs [data-view="' + (role === 'chu' ? 'all' : 'mine') + '"]').getAttribute('aria-pressed') === 'true', role === 'chu' ? 'Chủ mở sẵn Mọi người (như cũ)' : 'người khác mở sẵn Việc của tôi');
      // bấm cơ sở có nhiều việc nhất → sang thẻ Mọi người, lọc đúng cơ sở
      const pick = btns.filter((b) => txt(b.querySelector('b')) !== 'Việc chung').sort((a, b) => num(txt(b.querySelector('.hn-cs-n'))) - num(txt(a.querySelector('.hn-cs-n'))))[0];
      const code = pick.dataset.br; const want = num(txt(pick.querySelector('.hn-cs-n')));
      const wantLate = num(txt(pick.querySelector('.hn-p-late')) || '0');
      pick.click(); await sleep(400);
      ok(q('#hn-tabs [data-view="all"]').getAttribute('aria-pressed') === 'true', 'bấm một cơ sở → thẻ Mọi người');
      ok(q('#hn-brs [data-br="' + code + '"]')?.getAttribute('aria-pressed') === 'true', 'nút lọc cơ sở ' + code + ' đang bật');
      ok(rows().length === want && want > 0, 'số việc hiện = số ghi ở bảng Theo cơ sở (' + want + ') — có ' + rows().length);
      ok(rows().every((r) => txt(r).includes(code)), 'mọi việc đang hiện đều của ' + code);
      ok(!q('#hn-viec section[data-cat="done"]'), 'đang lọc cơ sở thì ẩn mục Đã xong hôm nay');
      // chỉ quá hạn
      q('#hn-fl [data-flag="late"]').click(); await sleep(300);
      ok(rows().length === wantLate && rows().every((r) => r.classList.contains('late')), 'Chỉ việc quá hạn: ' + wantLate + ' việc, đều quá hạn — có ' + rows().length);
      q('#hn-fl [data-flag="late"]').click(); await sleep(300);
      ok(rows().length === want, 'bấm lần nữa thì bỏ lọc quá hạn');
      // chỉ chưa có người nhận (mọi cơ sở)
      q('#hn-brs [data-br="*"]').click(); await sleep(300);
      const nNone = num(txt(q('#hn-fl [data-flag="none"] span')));
      q('#hn-fl [data-flag="none"]').click(); await sleep(300);
      ok(rows().length === nNone && rows().every((r) => r.querySelector('.hn-who.none')), 'Chỉ việc chưa có người nhận: ' + nNone + ' việc, đều ghi chưa có người nhận — có ' + rows().length);
      q('#hn-fl [data-flag="none"]').click(); await sleep(300);
      ok(rows().length === total && !!q('#hn-viec section[data-cat="done"]'), 'Mọi cơ sở, bỏ lọc: đủ ' + total + ' việc, có lại mục Đã xong hôm nay — có ' + rows().length);
      // đổi vai trò vẫn giữ lọc cơ sở, số trên nút khớp
      q('#hn-brs [data-br="' + code + '"]').click(); await sleep(300);
      q('#hn-roles [data-role="Quản lý"]').click(); await sleep(300);
      ok(q('#hn-brs [data-br="' + code + '"]').getAttribute('aria-pressed') === 'true' && rows().length === num(txt(q('#hn-brs [data-br="' + code + '"] span'))), 'đổi vai trò: giữ cơ sở đang lọc, số trên nút = số việc hiện');
      q('#hn-tabs [data-view="mine"]').click(); await sleep(300);
      ok(!q('#hn-brs') && !q('#hn-roles'), 'thẻ Việc của tôi không có nút lọc cơ sở');
      ok(fits(), 'trang không tràn ngang');
      const wide = qa('#hn-coso .hn-cs, #hn-brs button').every((b) => { const r = b.getBoundingClientRect(); return !r.width || r.right <= innerWidth + 1; });
      ok(wide, 'các nút cơ sở nằm trọn trong khung');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ hn_coso: { ok: good, fail: bad } });
};
