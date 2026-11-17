// Bước 119 · KIỂM TRA: quản lý sửa ô Nợ (50.000) và Tiền chênh lệch (−3.000) ở bước Kiểm tra → lưu đúng vào bản kiểm tra,
// gõ "−" (dấu trừ Unicode) cũng nhận là số âm. role=chu, confirm=1
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s);
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
      cash_counted: 5500000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    const open = async () => { location.hash = '#/__tam'; await sleep(300); location.hash = '#/ca/phieu?id=' + id + '&__ds=1'; await wait('.ds-pane'); await sleep(2000); };
    await open();
    // bước 121: Mở để sửa → sửa → Lưu (lý do trong hộp)
    $('#ds-money-open')?.click(); await sleep(1500); await wait('.ds-pane');
    const setv = (sel, v) => { const el = $(sel); if (!el) throw new Error('Không có ô ' + sel); if (el.disabled) throw new Error('Ô ' + sel + ' bị khoá'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    setv('#pos_debt', '50.000'); setv('#pos_diff', '−3.000');
    $('#ds-money-save')?.click(); await sleep(400);
    const why = $('dialog[open] [name=why]'); if (!why) throw new Error('Không có hộp lý do khi Lưu');
    why.value = 'nhân viên ghi nhầm'; $('dialog[open] form').requestSubmit(); await sleep(3000);
    const RC = await rpc('app_ca_recon', { p_id: id });
    seen = `pos_debt=${RC.data.pos_debt} pos_diff=${RC.data.pos_diff}`;
    if (RC.data.pos_debt !== 50000 || RC.data.pos_diff !== -3000) fail = 'Không lưu đúng: ' + seen;
    await open();
    const shown = `${$('#pos_debt')?.value} | ${$('#pos_diff')?.value}`; seen += ' · hiện lại: ' + shown;
    if (!/50\.000/.test($('#pos_debt')?.value || '') || !/^-3\.000$/.test($('#pos_diff')?.value || '')) fail = fail || 'Mở lại không hiện đúng: ' + shown;
  } catch (er) { fail = er.message; }
  out.push({ route: 'audit_ba_o', title: seen, errs: fail ? [fail] : [] });
};
