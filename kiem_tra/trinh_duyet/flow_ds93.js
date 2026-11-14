// Bước 93: Đối soát ca — "+ Thêm thu chi tiền mặt / chuyển khoản" ngay ở bước Thu chi (bắt buộc lý do), "+ Thêm khách nợ" ở bước Khách nợ. role=chu (điện thoại, confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const vis = () => $$('.ds-pane').filter((p) => !p.hidden).map((p) => p.dataset.ds).join(',');
  const r = []; window.confirm = () => true;
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/doi_soat_den.js', '../js/pages/phieu_ca.js', '../js/pages/doi_soat_ca.js', '../js/pages/doi_soat.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === ov[0].shift && x.branch_code === 'LLB') || ov[0];   // LLB: không chờ kế toán
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 7000000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5180000, ipos_opening: 1000000, pos_debt: 100000, pos_diff: -320000, cups: 50, moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -200000, note: 'Chi lương Quang hỗ trợ' }], goods: [], handover: [{ content: 'Máy xay kêu to' }],
      debts: [{ table_name: '3', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    {
      // bước 93: thêm thu chi ngay ở bước Thu chi; thêm khách nợ ở bước Khách nợ
      location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=6'; await wait('[data-addmv]'); await sleep(1500);
      const mvN = async () => (((await rpc('app_ca_recon', { p_id: id })) || {}).data?.moves || []).length; const n0 = await mvN();
      r.push(`nút thêm: ${$$('[data-addmv]').map((x) => x.innerText).join(' / ')}`);
      $('[data-addmv="chuyen_khoan"]').click(); await sleep(600);
      const row = $('#moves').lastElementChild; const setv = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      r.push(`dòng mới: loại ${row.querySelector('.mv-kind').value} · khung mở ${$('#ds-mv-ed').open}`);
      setv(row.querySelector('.mv-amt'), '50.000'); setv(row.querySelector('.mv-note'), 'Thu tiền thanh lý'); await sleep(2500);
      r.push(`chưa lý do: ${$$('.rc-need').some((x) => !x.hidden) ? 'nhắc ghi lý do' : 'KHÔNG nhắc'}`);
      setv($('#ds-mv-ed .rc-why'), 'Nhân viên quên ghi'); await sleep(3000);
      const n1 = await mvN(); r.push(`thu chi máy chủ: ${n0} → ${n1} · danh sách CK hiện ${$$('#ds-tc-ck .dt-r').length} dòng`);
      location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=5'; await wait('[data-rdgo]'); await sleep(1200);
      $('[data-rdgo]').click(); await sleep(800); r.push(`thêm khách nợ: ${txt('dialog h2')}`); $('dialog [data-x]')?.click();
    }
    r.push(`cuối: ${W()}`);
  } catch (e) { r.push('LỖI ' + (e.stack || e)); }
  out.push({ route: 'đối soát thêm thu chi 93', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
