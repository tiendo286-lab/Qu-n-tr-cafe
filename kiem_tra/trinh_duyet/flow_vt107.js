// Bước 124: việc có sẵn dùng chung hộp cài đặt từng cơ sở (role=chu, confirm=1; index.html + test/phone.html).
// Đối soát ca: nhãn "Việc có sẵn", không có Bắt buộc ảnh / Xoá; đổi phạt 1 cơ sở; Có kiểm tra thiếu người → lỗi; đủ → lưu, ô cơ sở hiện phạt mới.
// Kiểm quỹ: có Chu kỳ / Ngày làm. Phân chia nhân viên phát sinh: hộp cũ. Hoá đơn bù: 1 dòng "Mọi cơ sở", không có Có kiểm tra.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const go = async (h, sel) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await wait(sel, 1500); await sleep(900); };
  const dlg = () => $('dialog[open]');
  const vis = (el) => !!el && el.offsetParent !== null;
  const setv = (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const tick = (el, on) => { if (el && el.checked !== on) el.click(); };
  const fails = [], seen = [];
  const check = (ok, label) => { (ok ? seen : fails).push((ok ? '✓ ' : '✗ ') + label); };
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const openJob = async (j, sel) => { $$(`[data-job="${j}"]`).find((e) => vis(e) && e.classList.contains('pb-jn'))?.click(); await wait(`dialog[open] ${sel}`, 30); await sleep(200); };
  window.confirm = () => { fails.push('✗ dùng confirm() của trình duyệt'); return true; };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    $('#rm-close')?.click(); await sleep(200);
    await go('#/cong-viec/phan-cong', '#pc-body');
    await openJob(1, '#pv-save');
    let d = dlg();
    check(!!d && /Việc có sẵn/i.test(txt(d)) && /Web tạo việc khi/i.test(txt(d)) && !/Bắt buộc chụp ảnh/i.test(txt(d)) && !$('#pv-del', d) && !$('#pv-name', d), 'Đối soát ca: hộp chung, "Việc có sẵn", không có ảnh / xoá / đổi tên');
    check(noScroll(), 'Hộp không tràn ngang');
    const rows = () => $$('.pv-row[data-i]', dlg());
    setv($('[data-k=fine]', rows()[1]), '30000');
    tick($('#pv-check', dlg()), true); await sleep(150);
    $('#pv-save', dlg()).click(); await sleep(700);
    check(/Chọn người kiểm tra cho LHP\./.test(txt($('.pc-err', dlg()))), 'Có kiểm tra thiếu người → "Chọn người kiểm tra cho LHP."');
    for (const r of rows()) { if (!$('[data-k=on]', r)?.checked) continue; $('[data-pick=ckr]', r).click(); await sleep(80); tick($('.pv-pop[data-for=ckr] input[value="7"]', r), true); await sleep(80); }
    $('#pv-save', dlg()).click(); await sleep(1200);
    const cell = $$('[data-wjob="1"]').find((e) => vis(e) && /30\.000đ/.test(txt(e)));
    check(!dlg() && !!cell, 'Lưu → ô ĐK hiện phạt 30.000đ' + (dlg() ? ' (lỗi: ' + txt($('.pc-err', dlg())) + ')' : ''));
    await openJob(10, '#pv-save');
    check(!!$('.pv-row[data-i] [data-k=cy]', dlg()) && !!$('.pv-row[data-i] [data-k=grace]', dlg()), 'Kiểm quỹ: có Chu kỳ + Quá hạn cho phép');
    dlg().close(); await sleep(200);
    await openJob(13, '#pv-save');
    check(/Mọi cơ sở/.test(txt(dlg())) && !$('#pv-check', dlg()) && rows().length === 1, 'Hoá đơn bù: 1 dòng "Mọi cơ sở", không có Có kiểm tra');
    dlg().close(); await sleep(200);
    await openJob(2, '#pj-rows');
    check(!!$('#pj-rows', dlg()), 'Phân chia nhân viên phát sinh: vẫn hộp cũ');
    dlg().close(); await sleep(200);
    check(noScroll(), 'Bảng không tràn ngang');
  } catch (er) { fails.push(er.message); }
  out.push({ route: 'vt107', title: seen.join(' · ').slice(0, 900), errs: fails });
};
