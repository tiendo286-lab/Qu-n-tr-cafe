// Bài thử bước 166 (Kế hoạch 5): tab Tổng mẫu B — Việc cần làm | Ai còn nợ lên đầu (khung có giới hạn, cuộn bên trong), bỏ 5 ô nhỏ,
// Kiểm quỹ thành khung riêng, So với trang cũ thu gọn cuối trang, Quỹ ngoài không có 2 khung đầu.
// Chạy: index.html?auto=1&role=chu&confirm=1&script=flow_stc13 (role chu / qlt / ql) và test/phone.html. Kết quả: out[].stc13 = { ok, fail }.
import { MONTH } from './stc_fixture.js';
import { todoItems, debtGroups, fundSummary } from '../js/so_thu_chi_tinh.js';

export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 150) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const phone = window.innerWidth <= 400;
  const wide = (m) => { if (phone) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, `${m}: không tràn ngang (${document.documentElement.scrollWidth}/${window.innerWidth})`); };
  const go = async (cn) => { location.hash = `#/quan-ly/so-thu-chi?tab=tong&cn=${cn}&thang=2026-11&t=${Date.now()}`; await sleep(300); await wait('.stc-big'); await sleep(600); };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    await go(1);
    const T = todoItems(MONTH, fundSummary(MONTH).waitQN);
    const G = debtGroups(MONTH.open_debts, new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
    // 1. bố cục: 2 khung đầu trang, không còn 5 ô nhỏ / cột phải
    const top = $('.stc-top2');
    ok(!!top && !!$('.stc-todo', top) && !!$('.stc-debts', top), '1. đầu trang có 2 khung Việc cần làm | Ai còn nợ');
    ok(!!top && top.compareDocumentPosition($('.stc-bigs')) & Node.DOCUMENT_POSITION_FOLLOWING, '1. 2 khung đứng trước 3 số lớn');
    ok(!$('#stc-page .stc-tiles') && !$('#stc-page .stc-tile') && !$('#stc-page .stc-aside'), '1. bỏ 5 ô nhỏ và cột phải');
    ok(!!$('details.stc-cmp') && !$('details.stc-cmp').open && $$('#stc-page > *').slice(-1)[0] === $('details.stc-cmp'), '1. So với trang cũ thu gọn ở cuối trang');
    ok($$('.stc-tf').length === 2 && $$('.stc-dd').length > 0 && !!$('button.stc-qnadd') && !!$('button.stc-lcadd') && !!$('button.stc-kq'), '1. vẫn đủ cách tính, bảng ngày, nút Chuyển về QN / Luân chuyển / Kiểm quỹ');
    // 2. Việc cần làm
    const rows = $$('.stc-todo .stc-ti');
    ok(rows.length === T.length && T.length > 0, `2. đủ ${T.length} việc (thấy ${rows.length})`);
    ok(txt($('.stc-todo h3')).includes(`${T.length} việc`), '2. tiêu đề ghi tổng số việc');
    const firstNotRed = rows.findIndex((r) => !r.querySelector('.stc-dot.red'));
    ok(firstNotRed === -1 || rows.slice(firstNotRed).every((r) => !r.querySelector('.stc-dot.red')), '2. việc đỏ đứng trước');
    const f0 = T.find((t) => t.kind === 'fabi');
    const fr = rows.find((r) => r.dataset.kind === 'fabi');
    ok(!!f0 && !!fr && txt(fr).includes('chưa xác nhận fabi') && ($('a', fr)?.getAttribute('href') || '').includes(`tab=doi-soat`) && ($('a', fr)?.getAttribute('href') || '').includes(`ds=${f0.ref.id}`), `2. ca chưa xác nhận Fabi có "Mở ›" sang Đối soát Fabi đúng ca ${f0?.ref.id}`);
    const lr = rows.find((r) => r.dataset.kind === 'lech');
    ok(!lr || (($('a', lr)?.getAttribute('href') || '').includes('cot=lech')), '2. lệch chờ xử lý dẫn tới sổ lọc Chênh lệch');
    const cr = rows.find((r) => r.dataset.kind === 'cat');
    ok(!cr || (($('a', cr)?.getAttribute('href') || '').includes('tab=chi') && ($('a', cr)?.getAttribute('href') || '').includes('cot=chi')), '2. chi chưa phân loại dẫn tới Sổ chi › Các khoản chi');
    const qr = rows.filter((r) => r.dataset.kind === 'qn');
    ok(qr.every((r) => (role === 'chu') === !!$('[data-qnok]', r)), `2. khoản chờ Chủ nhận: ${role === 'chu' ? 'Chủ có' : 'không phải Chủ không có'} nút Đã nhận tiền`);
    // 3. Ai còn nợ
    const nP = G.main.length + G.fam.length;
    const dh = txt($('.stc-debts h3'));
    ok(dh.includes(`${nP} người`) && num(dh.split('·')[1] || '') === G.total, `3. tiêu đề: ${nP} người · ${G.total} (thấy "${dh}")`);
    const dps = $$('.stc-debts .stc-scroll > details.stc-dp');
    ok(dps.length === G.main.length && txt($('summary', dps[0])).includes(G.main[0].who.toLowerCase()), '3. mỗi người 1 dòng, người nợ lâu nhất lên đầu');
    ok(!!$('.stc-debts .stc-fam') && G.fam.every((g) => txt($('.stc-fam')).includes(g.who.toLowerCase())) && !dps.some((d) => G.fam.some((g) => txt($('summary', d)).startsWith(g.who.toLowerCase() + ' '))), '3. người có ✓ (Kho Tổng) nằm riêng trong dòng thu gọn');
    const late = G.main.find((g) => g.maxDays > 7);
    const ld = late && dps.find((d) => txt($('summary', d)).includes(late.who.toLowerCase()));
    ok(!late || (!!ld && !!$('summary .stc-red', ld)), `3. quá 7 ngày hiện đỏ (${late?.who || 'không có'})`);
    if (late) ok(dh.includes(`${G.late} người quá 7 ngày`), '3. tiêu đề ghi số người quá 7 ngày');
    // Thu nợ mở hộp thoại
    dps[0].open = true; await sleep(150);
    const cb = $('[data-col-debt]', dps[0]);
    ok(!!cb && cb.offsetParent !== null, '3. mở dòng → thấy từng khoản + nút Thu nợ');
    if (cb) { cb.click(); await wait('dialog[open]', 30); ok(!!$('dialog[open]'), '3. bấm Thu nợ mở hộp thoại thu nợ'); $('dialog[open]')?.close(); await sleep(200); }
    // 4. khung có giới hạn chiều cao, cuộn bên trong (bơm thêm 25 dòng)
    const sc = $('.stc-todo .stc-scroll'); const proto = rows[0];
    for (let i = 0; i < 25; i++) sc.appendChild(proto.cloneNode(true));
    await sleep(100);
    const hT = $('.stc-todo').getBoundingClientRect().height, hD = $('.stc-debts').getBoundingClientRect().height;
    ok(hT <= 341 && sc.scrollHeight > sc.clientHeight, `4. 30 việc: khung cao ${Math.round(hT)}px ≤ 340, cuộn bên trong`);
    ok(phone || Math.abs(hT - hD) <= 1, `4. máy tính: 2 khung cao bằng nhau (${Math.round(hT)} / ${Math.round(hD)})`);
    wide('4. tab Tổng');
    { const cut = $$('.stc-dg span').filter((x) => getComputedStyle(x).display !== 'none' && x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.trim()); ok($$('.stc-dg.stc-dd').length > 0 && !cut.length, 'Tồn quỹ theo ngày: không ô nào bị cắt chữ' + (cut.length ? ' — bị cắt: ' + cut.slice(0, 3).join(' | ') : '')); }
    // 5. Kiểm quỹ
    await wait('#stc-kqbox .stc-kqr, #stc-kqbox .st-meta', 40); await sleep(400);
    ok(txt($('.stc-kqlast')).startsWith('lần cuối:') && !txt($('.stc-kqlast')).includes('đang tải'), '5. khung Kiểm quỹ có dòng "Lần cuối: …" (' + txt($('.stc-kqlast')) + ')');
    // 6. Quỹ ngoài (chỉ Chủ)
    if (role === 'chu') {
      await go('ngoai');
      ok(!$('.stc-top2') && !$('.stc-kqlast') && $$('.stc-big').length === 3 && !!$('.stc-qnl, .stc-two .stc-side'), '6. Quỹ ngoài: không có 2 khung đầu / Kiểm quỹ, vẫn có 3 số lớn + tiền các cơ sở chuyển về');
      ok(!$('#stc-page .stc-tile'), '6. Quỹ ngoài: bỏ ô nhỏ');
      wide('6. Quỹ ngoài');
    }
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.message || e)); }
  out.push({ stc13: { ok: good, fail: bad } });
};
