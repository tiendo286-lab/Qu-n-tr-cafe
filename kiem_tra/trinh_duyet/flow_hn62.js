// Bước 62: trang chủ theo vai trò — Chủ / Kế toán vào "Việc hôm nay"; Nhân viên vào Order. Chạy với role=chu|kt|nv (confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { rpc } = await import('../js/sb.js');
    const me = await rpc('app_me');
    if (me.role === 'chu') {   // tạo 1 ca đã gửi để có việc "chờ đối soát" / "thiếu file Fabi"
      const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_code === 'LHP') || ov[0];
      const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
      const R = await rpc('app_ca_get', { p_id: id });
      await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 3000000, total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
        cash_counted: 3000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [], staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) } });
      await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    }
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/'; await sleep(2500); await wait('#root h1');
    r.push(`${me.role}: trang chủ → ${location.hash} · ${txt('#root h1')} · việc: ${$$('.hn-i').map((a) => a.innerText.replace(/\s+/g, ' ')).join(' | ') || txt('.hn-done')} · đi nhanh: ${$$('.toolbar a.btn').map((a) => a.innerText.trim()).join(', ')} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'việc hôm nay', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
