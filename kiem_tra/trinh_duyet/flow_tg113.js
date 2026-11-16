// Bước 113: nút bấm 1 lần Thu | Chi · TM | CK (chốt ca + đối soát), Báo nợ TM | CK | HĐ, Thu nợ đứng đầu.
// role=chu, confirm=1; máy tính và test/phone.html. Dữ liệu giả lập.
export default async ({ sleep, out }) => {
  const $ = (q) => document.querySelector(q), $$ = (q) => [...document.querySelectorAll(q)];
  const wait = async (sel, n = 180) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); if (!$(sel)) throw new Error('Không thấy ' + sel); };
  const r = []; let fail = null;
  const check = (ok, msg) => { if (!ok) throw new Error(msg); r.push(msg); };
  try {
    await wait('#root h1, #root h2, #root .card, #root nav'); $$('dialog[open]').forEach((d) => d.close());
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id }); const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:35' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:35' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: day + ' 06:45', rev_end: day + ' 12:35', ipos_opening: 1000000, total_revenue: 5420000, pos_cash: 3220000, pos_transfer: 2100000, pos_debt: 100000, pos_diff: 0,
      cash_counted: 4220000, reported_transfer: 2100000, cups: 10, moves: [{ kind: 'tien_mat', amount: 30000, note: 'bán bã cà phê' }], goods: [], handover: [], debts: [{ table_name: 'Bàn 5', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/t.jpg', p_kind: 'ipos' });
    location.hash = '#/ca/phieu?id=' + id; await wait('#cm-next'); await sleep(300);
    $('[data-shift-step="3"]').click(); await wait('#cm-check'); await sleep(300);
    const row0 = () => $$('.sc-row').find((x) => x.querySelector('[data-mkind]'));
    // bước 114: chốt ca xếp giống đối soát
    { const body = $('#cm-body'); const kids = [...body.querySelectorAll(':scope > *')]; const pos = (q) => kids.findIndex((x) => x.matches(q));
      check(pos('#cm-verdict') === 0 && pos('#cm-verdict') < pos('#cm-money-table') && pos('#cm-money-table') < pos('#cm-fabi'), 'Chốt ca: kết quả trên cùng → bảng tiền → Phiếu Fabi (giống đối soát)');
      check(!$('#cm-fabi').open && /đã nhập/.test($('#cm-fabi-sum').textContent), 'Chốt ca: Phiếu Fabi nhập đủ thì thu gọn 1 dòng');
      $('#cm-fabi-sum').click(); await sleep(200); check($('#cm-fabi').open && !!$('#cm-close'), 'Chốt ca: bấm vào Phiếu Fabi là mở ra sửa được');
      $('#cm-fabi-sum').click(); await sleep(200); }
    check(row0().querySelector('[data-tg="dir"][data-v="thu"]').classList.contains('on'), 'Chốt ca: dòng thu hiện nút Thu đang chọn');
    { const t = (q) => row0().querySelector(q).getBoundingClientRect().top; check(Math.abs(t('.sc-kt') - t('[data-k="amount"]')) < 14 && Math.abs(t('[data-k="amount"]') - t('[data-mx]')) < 14, 'Chốt ca: Thu/Chi · TM/CK · số tiền · ✕ trên 1 dòng'); }
    check(!$$('#cm-root select[data-mkind]').some((x) => !x.hidden), 'Chốt ca: không còn ô chọn thả xuống Thu/Chi');
    row0().querySelector('[data-tg="dir"][data-v="chi"]').click(); await sleep(300);
    check(row0().querySelector('[data-mkind]').value === 'chi_tm' && row0().querySelector('[data-tg="dir"][data-v="chi"]').classList.contains('on'), 'Chốt ca: bấm Chi 1 lần là đổi');
    row0().querySelector('[data-tg="pay"][data-v="ck"]').click(); await sleep(300);
    check(row0().querySelector('[data-mkind]').value === 'chi_ck', 'Chốt ca: bấm CK 1 lần là đổi');
    check(/− Chi\s*0\s*-30\.000/.test($('#cm-money-table').textContent.replace(/\s+/g, ' ')), 'Chốt ca: bảng tiền tính lại (Chi CK −30.000)');
    check(/Còn thiếu/.test($('#cm-verdict').textContent), 'Chốt ca: chưa đủ thì dòng trên cùng báo Còn thiếu');
    $$('[data-mcat]').forEach((x) => { const o = [...x.options].find((y) => y.value && y.value !== 'x') || [...x.options].find((y) => y.value); if (o) { x.value = o.value; x.dispatchEvent(new Event('change', { bubbles: true })); } }); await sleep(200);
    $('#cm-check').click(); await sleep(400);
    check(/khớp|thiếu|thừa/i.test($('#cm-verdict').textContent) && !$('#cm-next').disabled, 'Chốt ca: bấm Kiểm tra → kết quả hiện ở dòng trên cùng: ' + $('#cm-verdict .sc-v').childNodes[0].textContent.trim());
    const dk = $('[data-dk="0"][data-v="ck"]'); dk.click(); await sleep(300);
    check($('[data-dk="0"][data-v="ck"]').classList.contains('on'), 'Chốt ca: Báo nợ chọn CK 1 lần');
    check(!$('.cm-dkk'), 'Chốt ca: bỏ khối giải thích Báo nợ dài');
    check(!!$('#cm-add-debt') && $$('#cm-add-debt').length === 1, 'Chốt ca: luôn có đúng 1 nút + Báo nợ');
    check(!/bước Thu chi/.test($('#cm-root').textContent), 'Chốt ca: không còn chữ "bước Thu chi" cũ');
    { const W = document.documentElement.clientWidth; const wide = $$('#cm-root *').filter((x) => x.getBoundingClientRect().right > W + 1).map((x) => x.tagName + '.' + x.className + '[' + Math.round(x.getBoundingClientRect().right) + ']').slice(0, 6); check(document.documentElement.scrollWidth <= W + 1, 'Chốt ca: không tràn ngang ' + W + 'px ' + wide.join(' ')); }
    // đối soát: phiếu nhân viên đã gửi
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=4'; await wait('#moves .mv-row'); await sleep(800);
    const pane = $('.ds-pane[data-ds="3"]');
    const kids = [...pane.children]; const pos = (q) => kids.findIndex((x) => x.matches(q));
    check(pos('#ds-money-table') >= 0 && pos('#ds-money-table') < pos('.ds-fabi') && pos('.ds-fabi') < pos('.uv'), 'Đối soát: bảng tiền lên đầu → Phiếu Fabi (gọn 1 dòng) → Các khoản');
    check(!$('.ds-fabi').open || !!$('.ds-fabi .ds-ic.bad'), 'Đối soát: Phiếu Fabi khớp thì thu gọn');
    { const row = $$('#moves .mv-row').find((x) => x.querySelector('.uv-type')); const t = (q) => row.querySelector(q).getBoundingClientRect().top;
      check(Math.abs(t('.sc-kt') - t('.mv-amt')) < 14 && Math.abs(t('.mv-amt') - t('.pc-del')) < 14, 'Đối soát: Thu/Chi · TM/CK · số tiền · ✕ trên 1 dòng'); }
    { const ok = $('#ds-money-ok'); const foot = $('.wz-foot'); const t = (x) => x.getBoundingClientRect().top;
      check(!!ok && !ok.hidden && foot.contains(ok) && Math.abs(t(ok) - t($('#ds-prev'))) < 14 && getComputedStyle(foot).position === 'sticky' && !$('.ds-mbar'), 'Đối soát: Quay lại · Duyệt phần tiền cùng 1 hàng ở đáy màn hình (giống chốt ca)'); }
    check(!pane.textContent.includes('CHƯA ĐỐI SOÁT'), 'Đối soát: không còn nhãn "CHƯA ĐỐI SOÁT" ở trang tiền');
    check($$('#rev_start').length === 1 && $$('#cash_counted').length === 1 && $$('#reported_transfer').length === 1, 'Đối soát: không trùng ô nhập');
    check(!$('.pc-ban .seg') && !!$('.pc-ban a'), 'Đối soát: bỏ 2 thẻ gốc / đối soát, còn 1 liên kết xem phiếu gốc');
    const mrow = $$('#moves .mv-row').find((x) => x.querySelector('.uv-type'));
    const was = mrow.querySelector('.uv-type').value; const to = was.startsWith('thu') ? 'chi' : 'thu';
    mrow.querySelector(`[data-tg="dir"][data-v="${to}"]`).click(); await sleep(200);
    check(mrow.querySelector('.uv-type').value === to + was.slice(3) && mrow.querySelector('.mv-sign').value === (to === 'thu' ? '+' : '-'), `Đối soát: bấm ${to === 'thu' ? 'Thu' : 'Chi'} 1 lần đổi loại khoản`);
    const acts = $$('.uv .sc-actions button').map((b) => b.textContent.trim());
    check(acts.join('|') === '+ Thu nợ|+ Thu|+ Chi|+ Báo nợ|+ Khách CK rút tiền mặt', 'Đối soát: nút giống chốt ca — ' + acts.join(' · '));
    check(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, 'Đối soát: không tràn ngang');
    // bước 113b: phần tiền đã duyệt → ô khoá, có nút "Sửa phần tiền" ngay trang tiền → mở lại là sửa được
    for (const it of ['thu_chi', 'tien_mat', 'chuyen_khoan']) await rpc('app_ca_result_set', { p_id: id, p_item: it, p_result: 'khop', p_amount: null, p_reason: 'Thử khoá', p_people: [] });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=4'; await wait('#moves .mv-row'); await sleep(800);
    const amt = () => $('#moves .mv-row .mv-amt');
    check(amt().disabled && !!$('#ds-money-edit'), 'Đối soát: phần tiền đã duyệt → ô khoá, có nút Sửa phần tiền');
    $('#ds-money-edit').click(); await wait('dialog form [name=why]'); await sleep(200);
    const fm = $('dialog form'); fm.querySelector('[data-reopen]').click(); await sleep(300);
    check(/lý do/i.test(fm.querySelector('.den-err').textContent), 'Đối soát: Sửa phần tiền bắt ghi lý do');
    fm.why.value = 'Nhân viên ghi nhầm khoản'; fm.querySelector('[data-reopen]').click(); await sleep(1500); await wait('#moves .mv-row'); await sleep(800);
    check(!amt().disabled && !$('#ds-money-edit') && !!$('#ds-money-ok'), 'Đối soát: mở lại xong sửa được, có nút Duyệt phần tiền');
  } catch (err) { fail = err.message; r.push('FAIL: ' + err.message); }
  out.push({ route: 'tg113', title: r.join(' | '), errs: [...(window.__ERR || []), ...(fail ? [fail] : [])] });
};
