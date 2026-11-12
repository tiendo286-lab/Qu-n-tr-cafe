// Bước 43: đối soát đèn xanh / đỏ (role=chu): ca 1 khớp hết → "Duyệt các mục xanh" → hoàn thành đối soát; ca 2 lệch tiền + người nghỉ → mục đỏ, nút Xử lý
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/doi_soat_den.js', '../js/pages/phieu_ca.js', '../js/pages/doi_soat_ca.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const mk = async (o, f, absent) => {
      const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
      const R = await rpc('app_ca_get', { p_id: id });
      const staff = (R.staff || []).map((s, i) => ({ ...s, worked: !(absent && i === 0), absent_reason: absent && i === 0 ? 'Ốm' : null, time_in: '06:45', time_out: '12:39' }));
      if (absent) { const e = (await rpc('app_ca_employees'))[5]; staff.push({ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '12:40', time_out: '17:10' }); }
      await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 12:40', rev_end: day + (R.shift === ov[0].shift ? ' 12:39' : ' 17:10'), reported_transfer: f.ck, total_revenue: f.ck + f.tm, pos_cash: f.tm, pos_transfer: f.ck,
        cash_counted: f.tong, ipos_opening: f.dau, pos_debt: 0, pos_diff: f.tong - f.dau - f.tm, diff_note: f.tong - f.dau - f.tm ? 'không rõ' : null, cups: 50, moves: [], goods: [], handover: [], debts: [], staff } });
      await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
      return id;
    };
    const o1 = ov.find((x) => x.shift === ov[0].shift && x.branch_id === ov[0].branch_id);
    const id1 = await mk(o1, { dau: 1000000, ck: 3000000, tm: 2000000, tong: 3000000 }, false);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id1; await wait('.den-row'); await sleep(800);
    r.push(`Ca khớp: ${$$('.den-row').map((x) => (x.classList.contains('r') ? '🔴' : x.classList.contains('done') ? '✓' : '🟢') + x.querySelector('strong').innerText).join(' ')} · nút: ${txt('#den-ok')} · ${txt('#ds-lights .pill')} · ${W()}`);
    $('#den-ok').click(); for (let i = 0; i < 300 && (await rpc('app_ca_get', { p_id: id1 })).recon_status !== 'hoan_thanh'; i++) await sleep(100);
    await sleep(800); r.push(`Sau duyệt: recon_status ${(await rpc('app_ca_get', { p_id: id1 })).recon_status} · ${txt('#ds-lights .den-list').slice(0, 120)}`);
    const o2 = ov.find((x) => x.branch_id === ov[0].branch_id && x.shift !== ov[0].shift);
    const id2 = await mk(o2, { dau: 3000000, ck: 1000000, tm: 500000, tong: 3450000 }, true);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id2; await wait('.den-row'); await sleep(800);
    r.push(`Ca lệch: ${$$('.den-row.r').map((x) => x.innerText.replace(/\s+/g, ' ')).join(' | ')} · nút Xử lý ${$$('.den-row [data-ds-go]').length} · ${txt('#ds-lights .toolbar')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'đèn đối soát', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
