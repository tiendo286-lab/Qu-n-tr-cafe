// Bài thử bước 156: trang Đối soát ca bỏ bước "Tiền" — thanh bước là Ai làm ca · (Nghỉ & làm thay) · Bàn giao · Hoàn thành;
// bước cuối không còn hạng mục tiền phải duyệt, chỉ có thẻ "Phần tiền · làm ở Sổ thu chi". Chạy: role=chu|ql, confirm=1, script=flow_ds156 (+ test/phone.html).
// 22/11 (Đưa Đối soát Fabi về lại Chốt ca, anh Tiến duyệt): trang đối soát ca 3 tab — ① Phần việc (Ai làm ca · (Nghỉ & làm thay) · Bàn giao), ② Phần tiền
//   (khối tiền một ca), ③ Hoàn thành → thanh bước phần việc không còn "Tiền" lẫn "Hoàn thành"; thẻ "làm ở Sổ thu chi" đã bỏ. Ý kiểm giữ: không có bảng / ô sửa tiền cũ.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2000);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id }); const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 6900000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5300000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: -200000, cups: 50, goods: [], handover: [], staff, debts: [], moves: [] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/a.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/doi-soat?id=' + id; await wait('.ds-pane'); await sleep(1800);
    const bar = txt($('#ds-parts'));
    ok(bar.includes('ai làm ca') && bar.includes('bàn giao') && !/\btiền\b/.test(bar) && !bar.includes('hoàn thành'), `thanh bước phần việc không còn "Tiền" / "Hoàn thành" (${bar.slice(0, 80)})`);
    ok($$('.ds-ptabs .ds-pt').map((x) => x.dataset.ptab).join() === 'viec,tien,xong', 'trang có 3 tab ① Phần việc · ② Phần tiền · ③ Hoàn thành');
    const form = $('#pc-form');
    ok(!!form && !form.querySelector('#ds-money-table, .lx-box, #total_revenue, #moves, .ds-stc-card, a.ds-stc'), 'phần việc không còn bảng tiền / xử lý lệch / ô sửa tiền / thẻ "làm ở Sổ thu chi"');
    ok(!!$('#stc-page.stc-one[data-ds="' + id + '"]'), 'phần tiền là khối tiền của đúng ca này (tab ②)');
    ok(!$$('.ds-hd').some((h) => /còn \d+\/\d+ hạng mục/.test(txt(h)) && txt(h).includes('tiền')), 'không còn đếm hạng mục tiền trong các bước');
    if (window.innerWidth <= 400) ok(document.documentElement.scrollWidth <= window.innerWidth + 1, 'không tràn ngang');
  } catch (err) { bad.push('LỖI: ' + (err && err.message || err)); }
  out.push({ ds156: { ok: good, fail: bad } });
};
