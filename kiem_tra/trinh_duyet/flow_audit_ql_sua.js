// KIỂM TRA (đang FAIL = có lỗi): quản lý mở bước Kiểm tra trên Phiếu chốt ca phải sửa thẳng được MỌI số trên phiếu.
// Chạy: role=chu, confirm=1, script=flow_audit_ql_sua (thêm &che=direct để thử "Sửa thẳng" của Chủ sau khi đã duyệt phần tiền).
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  window.confirm = () => true;
  const mode = new URLSearchParams(location.search).get('che') || 'review';
  let fail = null; const notes = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === ov[0].shift && x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    // phiếu khớp hết để "Duyệt phần tiền" duyệt được cả tiền mặt và chuyển khoản
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2450000, total_revenue: 7000000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5400000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 100000, pos_diff: -100000, cups: 50,
      moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }, { kind: 'chuyen_khoan', amount: 50000, note: 'Thu CK' }], goods: [], handover: [{ content: 'Máy xay kêu to' }],
      debts: [{ table_name: '3', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    try { sessionStorage.removeItem('ds_step:' + id); } catch (_) { /* bỏ qua */ }
    const open = async () => { location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(2000); };
    await open();
    if (mode === 'direct' || mode === 'locked') {
      const ok = $('#ds-money-ok'); if (!ok) throw new Error('Không thấy nút Duyệt phần tiền');
      ok.click(); await sleep(2500); await open();
    }
    const ADD = [['+ Thu', '[data-addsg]'], ['+ Chi', '#add-move'], ['+ Báo nợ', '[data-newdebt]'], ['+ Thu nợ', '[data-qlpick]'], ['+ Khách CK rút tiền mặt', '#add-rut2']];
    const shownBtn = (sel) => [...document.querySelectorAll(sel)].some((b) => b.offsetParent !== null && !b.disabled);
    if (mode === 'locked') {   // đã duyệt phần tiền, chưa bấm Sửa: không còn nút thêm nào hiện
      const still = ADD.filter(([, sel]) => shownBtn(sel)).map(([n]) => n);
      if (still.length) fail = 'Phần tiền đã duyệt mà vẫn hiện nút: ' + still.join(', ');
      out.push({ route: 'audit_ql_sua (locked)', title: still.length ? '' : 'không còn nút thêm', errs: fail ? [fail] : [] });
      return;
    }
    if (mode === 'direct') {
      const me = $('#ds-money-edit'); if (!me) throw new Error('Không thấy nút ✎ Sửa phần tiền');
      me.click(); await sleep(800); const f = $('dialog[open] form'); if (!f) throw new Error('Không mở hộp Sửa phần tiền');
      f.why.value = 'kiểm tra'; f.requestSubmit(); await sleep(2500); await wait('.ds-pane'); await sleep(1500);
    }
    // mỗi ô cần sửa được: [tên hiển thị, cách tìm]
    const byLabel = (re) => $$('input, select, textarea').filter((el) => re.test((el.closest('label, .pc-f')?.innerText || el.getAttribute('aria-label') || el.placeholder || '').replace(/\s+/g, ' ')));
    const need = [
      ['Giờ bắt đầu / kết thúc doanh thu', () => [$('#rev_start'), $('#rev_end')]],
      ['Số dư đầu', () => [$('#opening_cash')]],
      ['Doanh thu (NET)', () => [$('#total_revenue')]],
      ['Tiền mặt (Fabi)', () => [$('#pos_cash')]],
      ['Chuyển khoản (Fabi)', () => [$('#pos_transfer')]],
      ['Nợ trên phiếu Fabi', () => [$('#pos_debt')]],
      ['Tiền chênh lệch trên phiếu Fabi', () => [$('#pos_diff')]],
      ['Tổng tiền thực đếm', () => [$('#cash_counted')]],
      ['CK nhận trên hotline', () => [$('#reported_transfer')]],
      ['Số cốc', () => [$('#cups')]],
      ['Thu / chi trong ca', () => $$('#moves input[data-k="amount"], #moves input.money, #moves input[aria-label*="Số tiền"]')],
      ['Khách nợ', () => byLabel(/Số tiền nợ/)],
      ['Bàn giao ca sau', () => byLabel(/Nội dung bàn giao/)],
    ];
    const locked = [];
    for (const [name, find] of need) {
      const els = find().filter(Boolean);
      if (!els.length) { locked.push(name + ' (không có ô)'); continue; }
      if (els.some((el) => el.disabled || el.readOnly)) locked.push(name);
      else notes.push('✓ ' + name);
    }
    const missing = ADD.filter(([, sel]) => !shownBtn(sel)).map(([n]) => n);
    if (missing.length) locked.push('thiếu nút ' + missing.join(', '));
    if (locked.length) fail = 'Quản lý KHÔNG sửa được: ' + locked.join(', ');
  } catch (er) { fail = er.message; }
  out.push({ route: 'audit_ql_sua (' + mode + ')', title: notes.join(' · '), errs: fail ? [fail] : [] });
};
