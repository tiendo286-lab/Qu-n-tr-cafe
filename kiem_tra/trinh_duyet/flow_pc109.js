// Bước 109: Bảng phân công Đợt 1 — Việc của tôi (hạng mục, khách nợ, bước thêm tay, Giao việc riêng: tiến độ / báo xong có ảnh / đạt / giao mới),
// Tất cả công việc (chưa có người, giao người, 5 ô việc riêng), Bảng phân công (ô cơ sở, thêm bước, kế toán), Quá hạn & phạt. role=chu (confirm=1); role=ql / nv chỉ xem Việc của tôi.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ((typeof s === 'string' ? $(s, r) : s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel, 1500); await sleep(900); };
  const dlg = () => $('dialog[open]');
  const btn = (re, r = document) => $$('button, a', r).find((b) => re.test(b.textContent.replace(/\s+/g, ' ')));
  const card = (re) => $$('.pc-task').find((c) => re.test(txt(c)));
  const photo = async (inp) => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 20, 20);
    const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg'));
    const dt = new DataTransfer(); dt.items.add(new File([b], 'a.jpg', { type: 'image/jpeg' })); inp.files = dt.files;
  };
  const r = []; window.confirm = () => true; window.alert = (m) => r.push('ALERT ' + m);
  const role = new URLSearchParams(location.search).get('role');
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2000);
    await go('#/viec', '#pc-body');
    r.push(`[${role}] Việc của tôi: ${txt('.pc-stats')} · hạng mục: ${$$('.pc-chip').map((c) => txt(c)).join(' | ')} · nhóm: ${$$('.pc-cat').map((c) => txt(c).slice(0, 40)).join(' / ')} · nút giao ${!!$('[data-a=gv-new]')} · ${W()}`);
    if (role !== 'chu') { r.push(`thẻ: ${$$('.pc-task').map((c) => txt(c).slice(0, 70)).join(' // ')}`); throw 'xong'; }
    btn(/Giao việc riêng/, $('.pc-chips')).click(); await sleep(200);
    r.push(`lọc Giao việc riêng: ${$$('.pc-task').length} thẻ · ${$$('.pc-cat').map((c) => txt(c).slice(0, 40)).join(' / ')}`);
    $('[data-cat=""]').click(); await sleep(200);
    const xb = $('[data-a=pc-step]');
    r.push(`bước thêm tay: ${txt(xb)}`); xb.click(); await sleep(800); r.push(`→ ${txt('#pc-toast')}`);
    // tiến độ + báo xong
    btn(/Ghi tiến độ/, card(/Tủ mát/)).click(); await wait('dialog[open] #g-tx', 30); $('#g-tx', dlg()).value = 'Thợ đã tới, đang thay gioăng'; $('[data-ok]', dlg()).click(); await sleep(900);
    r.push(`ghi tiến độ: ${txt('#pc-toast')} · ${txt(card(/Tủ mát/)?.querySelector('.pc-last'))}`);
    btn(/Báo xong/, card(/Tủ mát/)).click(); await wait('dialog[open] #g-rs', 30); $('#g-rs', dlg()).value = 'Đã thay gioăng'; $('[data-ok]', dlg()).click(); await sleep(500);
    r.push(`báo xong không ảnh: ${txt('.pc-err', dlg())}`); await photo($('#g-dp', dlg())); $('[data-ok]', dlg()).click(); await sleep(1500);
    r.push(`→ ${txt('#pc-toast')} · còn hộp ${!!dlg()} ${dlg() ? txt('.pc-err', dlg()) : ''}`); if (dlg()) dlg().close();
    btn(/Đạt/, card(/ống hút/)).click(); await sleep(900); r.push(`đạt: ${txt('#pc-toast')}`);
    btn(/Phân loại/, card(/Máy xay/)).click(); await wait('dialog[open] #g-who', 30);
    $('#g-who', dlg()).value = '5'; $('#g-rv', dlg()).value = '5'; $('[data-ok]', dlg()).click(); await sleep(500); r.push(`trùng người kiểm tra: ${txt('.pc-err', dlg())}`);
    $('#g-rv', dlg()).value = '6'; $('[data-ok]', dlg()).click(); await sleep(900); r.push(`phân loại: ${txt('#pc-toast')}`);
    $('[data-a=gv-new]').click(); await wait('dialog[open] #g-tt', 30); $('#g-tt', dlg()).value = 'Mua thêm 2 bình chữa cháy'; $('#g-br', dlg()).value = '4'; $('#g-who', dlg()).value = '8'; $('#g-rv', dlg()).value = '1';
    $('[data-ok]', dlg()).click(); await sleep(900); r.push(`giao mới: ${txt('#pc-toast')} · theo dõi: ${txt($$('.pc-cat').find((c) => /theo dõi/.test(txt(c))))}`);
    btn(/Chi tiết/, card(/Tủ mát|camera/)).click(); await wait('dialog[open] .pc-tl', 30); r.push(`chi tiết: ${$$('dialog[open] .pc-tli').map((x) => txt(x).slice(0, 60)).join(' // ')}`); dlg().close();
    // Tất cả công việc
    await go('#/quan-ly/giao-viec', '#pc-body');
    r.push(`Tất cả: ${txt('.pc-stats')} · ${txt('.alert.warn').slice(0, 90)} · người: ${txt('.pc-tbl tbody').slice(0, 120)} · ô việc riêng: ${txt('.pc-tiles')} · ${W()}`);
    btn(/Giao người/, card(/LLB/)).click(); await wait('dialog[open] .pc-grid2', 30); $$('dialog[open] .pc-grid2 input')[2].checked = true; $('[data-ok]', dlg()).click(); await sleep(900);
    r.push(`giao người LLB: ${txt('#pc-toast')} · còn chưa có người ${!!$('.alert.warn')}`);
    $('.pc-tile').click(); await sleep(200); r.push(`lọc Chờ giao: ${$$('.pc-task').length} thẻ`); $('[data-f=rs]').click(); await sleep(200);
    btn(/^LHP$/).click(); await sleep(200); r.push(`lọc LHP: ${$$('.pc-task').length} thẻ`);
    // Bảng phân công
    await go('#/cong-viec/phan-cong', '#pc-body');
    r.push(`Bảng: ${$$('.pb-mx tbody tr').length} dòng · ${txt('.alert.ok').slice(0, 80)} · dòng 1: ${txt($$('.pb-mx tbody tr')[1]).slice(0, 120)} · ${W()}`);
    $('.pb-mx [data-cell="1"][data-b="29"]').click(); await wait('dialog[open] .pc-grid2', 30); $$('dialog[open] .pc-grid2 input').find((i) => i.value === '5').checked = true; $('[data-ok]', dlg()).click(); await sleep(900);
    r.push(`ô LLB: ${txt('#pc-toast')} · ô bây giờ: ${txt('.pb-mx [data-cell="1"][data-b="29"]')}`);
    $('.pb-mx [data-cell="7"][data-b="1"]').click(); await wait('dialog[open] .pc-grid2', 30); r.push(`ô Lệch LHP: ${txt('.pc-info', dlg())}`); dlg().close();
    $('.pb-mx [data-job="1"]').click(); await wait('dialog[open] #pj-add', 30); $('#pj-add', dlg()).click(); await sleep(100);
    r.push(`thêm bước: ${$$('dialog[open] [data-row]').length} bước`); $('[data-ok]', dlg()).click(); await sleep(900); r.push(`→ ${txt('#pc-toast')} · ${txt($$('.pb-mx tbody tr')[1]).slice(0, 90)}`);
    $('.pb-mx [data-job="24"]').click(); await wait('dialog[open] #pj-d0', 30); $('#pj-d2', dlg()).value = '2'; $('[data-ok]', dlg()).click(); await sleep(900); r.push(`việc 24: ${txt('#pc-toast')}`);
    const k = $('#pb-kt'); k.value = '3'; k.dispatchEvent(new Event('change', { bubbles: true })); await wait('dialog[open] #pb-ap', 30); $('[data-ok]', dlg()).click(); await sleep(900); r.push(`kế toán: ${txt('#pc-toast')}`);
    // Quá hạn & phạt
    await go('#/cong-viec/qua-han', '#pc-body');
    r.push(`Quá hạn: ${txt('.pc-chips')} · dòng: ${txt('.qh-row').slice(0, 140)} · ${W()}`);
    $('[data-phat]').click(); await sleep(900); r.push(`phạt: ${txt('#pc-toast')}`);
    $('[data-bo]').click(); await wait('dialog[open] #qh-why', 30); $('[data-ok]', dlg()).click(); await sleep(200); r.push(`bỏ qua thiếu lý do: hộp còn ${!!dlg()}`);
    $('#qh-why', dlg()).value = 'Kế toán chậm file'; $('[data-ok]', dlg()).click(); await sleep(900);
    r.push(`sau: ${txt('.pc-chips')} · tổng: ${txt('.pc-tbl tbody')}`);
    btn(/Đã phạt/).click(); await sleep(200); $('[data-undo]').click(); await sleep(900); r.push(`huỷ: ${txt('#pc-toast')} · ${txt('.pc-chips')}`);
    if (new URLSearchParams(location.search).get('dung')) { const h = new URLSearchParams(location.search).get('r') || '#/viec'; await go(h, '#pc-body'); window.scrollTo(0, 0); await new Promise(() => {}); }
  } catch (e) { if (e !== 'xong') r.push('LỖI ' + (e.stack || e)); }
  out.push({ route: 'công việc 109', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
