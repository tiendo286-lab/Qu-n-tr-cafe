// Bước 119 · KIỂM TRA: dòng "Khách mượn" ở bước Kiểm tra có nút Đổi thành "Khách CK rút tiền mặt" → khoản nợ biến mất,
// thêm 1 dòng Khách CK rút tiền mặt (2 bút toán cùng exchange_key). role=chu, confirm=1
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  window.confirm = () => true;
  let fail = null; let seen = '';
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 6900000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5000000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: -500000, cups: 50, moves: [], goods: [], handover: [],
      debts: [{ table_name: 'Chị A ck rút tm', amount: 500000, kind: 'muon', note: '' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/a.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(2000);
    const why = document.querySelector('.rc-why') || $('#rc-reason'); if (!why) throw new Error('Không có ô lý do sửa');
    why.value = 'nhân viên ghi nhầm'; why.dispatchEvent(new Event('input', { bubbles: true }));
    const b = $('[data-muon-rut]'); if (!b) throw new Error('Không có nút Đổi thành Khách CK rút tiền mặt');
    b.click(); await sleep(3000); await wait('.ds-pane'); await sleep(1500);
    const RC = await rpc('app_ca_recon', { p_id: id }); const pair = (RC.data.moves || []).filter((m) => m.exchange_key);
    const debts = ((await rpc('app_ca_get', { p_id: id })).debts || []).filter((d) => d.kind === 'muon');
    seen = `đổi tiền: ${pair.map((m) => m.kind + ' ' + m.amount).join(', ')} · khách mượn còn ${debts.length} · dòng rút TM trên trang ${$$('#moves .sc-exchange').length}`;
    if (pair.length !== 2 || !pair.some((m) => m.amount === -500000) || !pair.some((m) => m.amount === 500000)) fail = 'Không ghi đúng cặp Khách CK rút tiền mặt';
    else if (debts.length) fail = 'Khoản Khách mượn vẫn còn';
    else if ($$('#moves .sc-exchange').length !== 1) fail = 'Trang không hiện dòng Khách CK rút tiền mặt';
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) fail = fail || 'Tràn ngang';
  } catch (er) { fail = er.message; }
  out.push({ route: 'audit_muon_rut', title: seen, errs: fail ? [fail] : [] });
};
