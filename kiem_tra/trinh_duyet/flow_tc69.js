// Bước 69: Thu chi giao diện mới — ô tích dưới số tiền (= đối soát), bấm dòng mở khung sửa, Cần phân loại (chọn nhóm ngay),
// lọc nhanh + Lọc thêm, ô số bấm để lọc, sửa số tiền khoản phiếu ca (bắt lý do), không còn đổi nhóm hàng loạt. role=chu (điện thoại)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const typ = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const row = (t) => $$('.tc-r').find((x) => x.querySelector('strong')?.innerText.includes(t));
  const info = (t) => { const x = row(t); return x ? `${x.querySelector('.tc-a').innerText} · ô ${x.querySelector('.tc-ok').innerText || 'trống'} · ${txt('.tc-c', x)}` : 'KHÔNG THẤY'; };
  const reload = async () => { location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/thu-chi?cn=1'; await wait('.tc-r', 600); await sleep(500); };
  const closed = async () => { for (let i = 0; i < 50 && $('dialog[open]'); i++) await sleep(100); await sleep(1500); await wait('.tc-r', 300); await sleep(300); };
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { sb } = await import('../js/sb.js');
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await sb.from('shift_reports').insert({ id: 9951, branch_id: 1, work_date: today, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
    await sb.from('shift_report_moves').insert([{ id: 99511, report_id: 9951, kind: 'tien_mat', amount: -50000, note: 'Mua đá thử', sort_order: 1 },
      { id: 99512, report_id: 9951, kind: 'tien_mat', amount: -80000, note: 'Mua sữa thử', sort_order: 2 },
      { id: 99513, report_id: 9951, kind: 'tien_mat', amount: 20000, note: 'Bán bã thử', sort_order: 3 }]);
    await reload();
    if (new URLSearchParams(location.search).get('shot')) return;   // dừng để chụp màn hình
    r.push(`ban đầu: Mua đá ${info('Mua đá thử')} · không còn ô chọn nhiều: ${!$('.tc-pick') && !$('#tc-bulk')} · ${W()}`);
    r.push(`Cần phân loại: ${$$('.tc-td b').map((b) => b.innerText).join(', ')}`);
    // 1) tích ô khi chưa có nhóm → mở khung chọn nhóm
    row('Mua đá thử').querySelector('.tc-ok').click(); await wait('dialog[open] form'); await sleep(200);
    let dl = $('dialog[open]');
    r.push(`tích ô (chưa nhóm) → khung: ${txt('h2', dl)} · có nút sửa số tiền ${!!$('.tc-full', dl)}`);
    dl.querySelector('[type=submit]').click(); await sleep(300); r.push(`đối soát không chọn nhóm: ${txt('#tc-err', dl)}`);
    dl.querySelector('[name=cat]').value = [...dl.querySelector('[name=cat]').options].find((o) => o.text === 'Nguyên liệu').value;
    dl.querySelector('[type=submit]').click(); await closed();
    r.push(`sau đối soát: Mua đá ${info('Mua đá thử')} · ${txt('.tc-x', row('Mua đá thử'))}`);
    // 2) chọn nhóm ở khối Cần phân loại
    const td = $$('.tc-td').find((x) => x.innerText.includes('Mua sữa thử')); const s = td.querySelector('.tc-cat');
    s.value = [...s.options].find((o) => o.text === 'Vật dụng').value; s.dispatchEvent(new Event('change')); await closed();
    r.push(`chọn nhóm ở Cần phân loại: Mua sữa ${info('Mua sữa thử')} · còn trong khối: ${$$('.tc-td b').map((b) => b.innerText).join(', ') || '(trống)'}`);
    // 3) bấm dòng → khung sửa khoản phiếu ca, đổi số tiền phải có lý do
    row('Mua sữa thử').querySelector('strong').click(); await wait('dialog[open] form'); await sleep(200); dl = $('dialog[open]');
    r.push(`bấm dòng → ${txt('h2', dl)} · ô lý do ẩn: ${dl.querySelector('.tc-why').hidden}`);
    typ(dl.querySelector('[name=amt]'), '85.000'); await sleep(100);
    r.push(`đổi số tiền → hiện lý do: ${!dl.querySelector('.tc-why').hidden}`);
    dl.querySelector('[type=submit]').click(); await sleep(800); r.push(`lưu không lý do: ${txt('#tc-err', dl)}`);
    typ(dl.querySelector('[name=why]'), 'ghi nhầm'); dl.querySelector('[type=submit]').click(); await closed();
    r.push(`sau sửa: Mua sữa ${info('Mua sữa thử')}`);
    // 4) bấm ô ✓ (đã đối soát) → mở khung sửa, không bỏ đối soát
    row('Mua đá thử').querySelector('.tc-ok').click(); await wait('dialog[open] form'); await sleep(200);
    r.push(`bấm ô ✓ → ${txt('dialog[open] h2')}`); $('dialog[open] [data-x]').click(); await sleep(300);
    // 5) lọc nhanh + Lọc thêm + ô số
    $('.tc-chip[data-q="thu"]').click(); await sleep(150); r.push(`lọc Thu: ${txt('#f-n')} · ngày hiện ${$$('.tc-day:not([hidden])').length}`);
    $('.tc-chip[data-q="all"]').click(); await sleep(100);
    $('#tc-more').click(); await sleep(100); r.push(`Lọc thêm mở: ${!$('#tc-morebox').hidden} · ô: ${$$('#tc-morebox select').map((x) => x.options[0].text).join(', ')}`);
    $('#f-src').value = 'tay'; $('#f-src').dispatchEvent(new Event('change')); await sleep(100); r.push(`nguồn Quản lý tạo: ${txt('#f-n')}`);
    $('.tc-chip[data-q="all"]').click(); await sleep(100);
    $('#k-ds').click(); await sleep(200); r.push(`bấm ô Đã đối soát (${txt('#k-ds .v')}) → ${txt('#f-n')} · ${$$('.tc-r:not([hidden]) strong').map((x) => x.innerText).join(', ')}`);
    $('.tc-chip[data-q="all"]').click(); await sleep(100);
    r.push(`ô số: ${$$('.tc-kpi').map((k) => k.innerText.replace(/\s+/g, ' ')).join(' | ')}`.slice(0, 400));
    r.push(`cuối: ${W()}`);
  } catch (e) { r.push('LỖI: ' + e.message); }
  out.push({ route: 'thu chi 69', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
