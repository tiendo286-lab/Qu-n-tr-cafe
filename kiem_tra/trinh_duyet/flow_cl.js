// Bảng Chênh lệch tiền (#/quan-ly/chenh-lech, anh Tiến 27/11/2026). Chạy trên web dựng ĐỦ dữ liệu (stc_fixture), index.html và test/phone.html:
//   role=chu — mọi cơ sở, số khớp sổ tháng của Sổ thu chi, lọc, mở Phiếu chênh lệch tại bảng và lưu Quán chịu (Chủ: xong ngay), Mở ca
//   role=ql  — chỉ cơ sở được giao; Quán chịu của quản lý thành "Chờ Chủ duyệt", quản lý không có nút Duyệt
//   role=nv  — không vào được
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const q = (s, r = document) => r.querySelector(s); const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = (s) => { const m = String(s).replace(/\./g, '').match(/[−+-]?\d+/); return m ? Number(m[0].replace('−', '-')) : NaN; };
  const cell = (r, l) => txt(q(`td[data-l="${l}"]`, r));
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  const waitFor = async (c) => { for (let i = 0; i < 60; i++) { if (c()) return true; await sleep(100); } return false; };
  const rows = () => qa('#cl-box tr.cl-r');
  const month = '2026-11';
  try {
    if (role === 'nv') {
      const root = await visit('#/quan-ly/chenh-lech?thang=' + month);
      ok(/không có quyền/i.test(txt(root)) && !q('#cl-page'), 'nhân viên không vào được bảng Chênh lệch tiền');
    } else {
      // Anh Tiến chốt 27/11: chỉ ca đã đối soát xong mới về bảng. Dựng: mọi ca đã Hoàn thành, riêng 1 ca có lệch thì CHƯA.
      await rpc('app__test_ca_done', { p_on: true });
      const M0 = await rpc('app_stc_month', { p_branch: 1, p_month: month });
      const hold = (M0.items || []).find((x) => !x.void && x.col === 'lech' && x.ca_id && x.gap && Number(x.gap.avail || 0) > 0 && !/Lệch nhỏ/.test(String(x.status || '')));
      if (hold) await rpc('app__test_ca_done', { p_id: hold.ca_id, p_on: false });
      // Tất cả cơ sở: nạp được, nút "Tất cả cơ sở" đang bật. (Máy chủ giả trả cùng một sổ cho mọi cơ sở nên phần so số bên dưới làm ở trang một cơ sở.)
      await visit('#/quan-ly/chenh-lech?thang=' + month); await waitFor(() => !!q('#cl-page'));
      ok(!!q('#cl-page') && /Tất cả cơ sở/i.test(txt(q('.cl-cn a.on'))) && rows().length > 0, 'mở trang: mặc định Tất cả cơ sở, có dòng');
      if (role === 'ql') ok(/không được xem tiền/i.test(txt(q('#cl-page'))), 'quản lý ở Tất cả cơ sở: có dòng ghi các cơ sở không được xem tiền');
      await visit('#/quan-ly/chenh-lech?thang=' + month + '&cn=1'); await waitFor(() => !!q('#cl-page'));
      ok(!!q('a[href="#/quan-ly/chenh-lech"]') || !!q('a[href^="#/quan-ly/chenh-lech"]'), 'menu Quản lý ca có mục Chênh lệch tiền');
      ok(qa('#cl-tiles .cl-tile').length === 5, 'có 5 ô tổng');
      ok(rows().length > 0, 'bảng có dòng chênh lệch — ' + rows().length);
      const bad1 = rows().filter((r) => { const m = num(cell(r, 'Phải có')), t = num(cell(r, 'Thực tế')), l = num(cell(r, 'Lệch')); return Number.isFinite(m) && Number.isFinite(t) && t - m !== l; });
      ok(bad1.length === 0, 'mọi dòng: thực tế − phải có = lệch — sai ' + bad1.length);
      // số khớp sổ tháng của Sổ thu chi (cơ sở 1): đếm dòng lệch của ca
      const M = await rpc('app_stc_month', { p_branch: 1, p_month: month });
      const doneCa = new Set((M.cas || []).filter((c) => c.done).map((c) => c.id));
      const want = (M.items || []).filter((x) => !x.void && x.col === 'lech' && x.ca_id && doneCa.has(x.ca_id) && Number(x.gross ?? x.amount ?? 0) !== 0);
      ok(!!hold && !q(`#cl-box tr.cl-r[data-key="1:${hold.id}"]`) && /chưa đối soát xong/i.test(txt(q('#cl-chua'))), 'ca có lệch nhưng CHƯA đối soát xong: không có trong bảng, đầu bảng có dòng nhắc — ' + txt(q('#cl-chua')).slice(0, 60));
      const code = M.branch.code;
      q('#cl-f [data-f="st"][data-v="nho"]')?.click(); await sleep(150);
      const nNho = q('#cl-f [data-f="st"][data-v="nho"]') ? rows().filter((r) => cell(r, 'Cơ sở') === code).length : 0;
      q('#cl-f [data-f="st"][data-v=""]').click(); await sleep(150);
      const mine = rows().filter((r) => cell(r, 'Cơ sở') === code);
      ok(mine.length + nNho === want.length, `cơ sở ${code}: số dòng trên bảng (${mine.length} + ${nNho} lệch nhỏ) = số dòng chênh lệch của Sổ thu chi (${want.length})`);
      const sumTable = mine.reduce((s, r) => s + Math.abs(num(cell(r, 'Lệch'))), 0);
      const sumStc = want.filter((x) => !/Lệch nhỏ/.test(String(x.status || ''))).reduce((s, x) => s + Number(x.gross ?? x.amount), 0);
      ok(sumTable === sumStc, `cơ sở ${code}: tổng tiền lệch trên bảng = Sổ thu chi (${sumTable} / ${sumStc})`);
      ok(rows().every((r) => cell(r, 'Cơ sở') === code) && txt(q('.cl-cn a.on')) === code, 'chọn một cơ sở: chỉ hiện dòng của cơ sở đó');
      // lọc
      q('#cl-f [data-f="st"][data-v="cho"]').click(); await sleep(150);
      ok(rows().length > 0 && rows().every((r) => r.classList.contains('cho') && /Còn chênh lệch/i.test(cell(r, 'Trạng thái'))), 'lọc Còn chênh lệch: chỉ còn dòng còn chênh lệch — ' + rows().length);
      q('#cl-f [data-f="dir"][data-v="thieu"]').click(); await sleep(150);
      ok(rows().every((r) => num(cell(r, 'Lệch')) < 0), 'lọc chồng Chỉ thiếu: mọi dòng đều thiếu');
      // xử lý ngay tại bảng: Quán chịu
      const r0 = rows()[0]; const key = r0?.dataset.key; const left0 = r0 ? num(cell(r0, 'Còn lại')) : 0;
      ok(!!r0 && !!q('[data-xl]', r0) && /ca\/doi-soat\?id=\d+/.test(q('a.cl-xem', r0)?.getAttribute('href') || '') && !/Mở ca/i.test(txt(q('.cl-acts', r0))), 'dòng còn chênh lệch có nút Xử lý; không còn nút Mở ca, chỉ còn chữ nhỏ "xem ca"');
      q('[data-xl]', r0).click();
      const opened = await waitFor(() => !!q('dialog[open] .stc-gapd'));
      const dl = q('dialog[open]');
      ok(opened && /Phiếu chênh lệch/i.test(txt(dl)), 'bấm Xử lý: mở đúng Phiếu chênh lệch của Sổ thu chi ngay tại bảng');
      if (dl) {
        const r = dl.getBoundingClientRect(); ok(r.right <= innerWidth + 1 && r.left >= -1, 'phiếu nằm trọn trong khung');
        q('[data-act="qc"]', dl).click(); await sleep(150);
        q('[name=reason]', dl).value = 'Thử bảng chênh lệch';
        q('form', dl).requestSubmit(); await waitFor(() => !q('dialog[open] .stc-gapd')); await waitFor(() => !!q('#cl-page')); await sleep(400);
        q('#cl-f [data-f="st"][data-v=""]')?.click(); await sleep(200);
        const r1 = q(`#cl-box tr.cl-r[data-key="${key}"]`);
        if (role === 'chu') ok(!!r1 && r1.classList.contains('xong') && num(cell(r1, 'Còn lại')) === 0 && /Quán chịu/.test(cell(r1, 'Đã xử lý bằng')), 'Chủ lưu Quán chịu: dòng thành Đã xử lý, còn lại 0, ghi "Quán chịu" — ' + (r1 ? cell(r1, 'Trạng thái') + ' / ' + cell(r1, 'Đã xử lý bằng') : 'mất dòng'));
        else ok(!!r1 && r1.classList.contains('chu') && /chờ Chủ duyệt/i.test(cell(r1, 'Đã xử lý bằng')) && !q('[data-ok]', r1), 'quản lý lưu Quán chịu: dòng thành Chờ Chủ duyệt, quản lý không có nút Duyệt — ' + (r1 ? cell(r1, 'Trạng thái') : 'mất dòng'));
        ok(left0 > 0, 'trước khi xử lý dòng còn ' + left0);
      }
      if (role === 'chu') {   // Chủ duyệt ngay trên dòng (nếu dữ liệu thử có khoản chờ)
        const w = q('#cl-box tr.cl-r.chu [data-ok]');
        if (w) { const k2 = w.dataset.key; w.click(); await sleep(1500); const r2 = q(`#cl-box tr.cl-r[data-key="${k2}"]`);
          ok(!r2 || !r2.classList.contains('chu') || !q('[data-ok]', r2), 'Chủ bấm Duyệt trên dòng: khoản đó hết chờ duyệt'); }
      }
      // quản lý đối soát xong ca đang giữ lại → chênh lệch của ca đó về bảng
      if (hold) { await rpc('app__test_ca_done', { p_id: hold.ca_id, p_on: true });
        await visit('#/quan-ly/chenh-lech?thang=' + month + '&cn=1&t=' + Date.now()); await waitFor(() => !!q('#cl-page')); await sleep(200);
        for (const b of qa('#cl-f [data-f="dir"][aria-pressed="true"], #cl-f [data-f="pm"][aria-pressed="true"]')) { b.click(); await sleep(120); }   // bỏ các nút lọc còn bật từ bước trước
        q('#cl-f [data-f="st"][data-v=""]')?.click(); await sleep(150);
        ok(!!q(`#cl-box tr.cl-r[data-key="1:${hold.id}"]`), 'ca đó đối soát xong → chênh lệch của nó xuất hiện trong bảng'); }
      ok(fits(), 'trang không tràn ngang');
      if (innerWidth <= 520) ok(getComputedStyle(q('.cl-t thead')).display === 'none' && getComputedStyle(rows()[0]).display === 'grid', 'điện thoại: mỗi chênh lệch là một thẻ, không còn bảng ngang');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ cl: { ok: good, fail: bad } });
};
