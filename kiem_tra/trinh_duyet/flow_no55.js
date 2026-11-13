// Bước 55: công nợ đã thu hiện ở đúng ca thu — ca Sáng nợ bàn 7 (50.000), khách trả tiền mặt ở ca Chiều. role=chu (confirm=1)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const br = ov[0].branch_id; const sh = ov.filter((x) => x.branch_id === br).map((x) => x.shift);
    const mk = async (shift, p, before) => {
      const id = await rpc('app_ca_open', { p_branch: br, p_date: day, p_shift: shift });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
      const R = await rpc('app_ca_get', { p_id: id });
      if (before) await before(id, R);
      await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + (shift === sh[0] ? ' 12:39' : ' 17:10'), cups: 50, moves: [], goods: [], handover: [], pos_diff: 0,
        staff: (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })), ...p } }).catch((e) => r.push(`lưu ${shift}: ${e.message}`));
      await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true }).catch((e) => r.push(`xong ${shift} ${k}: ${e.message}`));
      return id;
    };
    const id1 = await mk(sh[0], { total_revenue: 5050000, pos_cash: 2000000, pos_transfer: 3000000, pos_debt: 50000, reported_transfer: 3000000, cash_counted: 3000000, ipos_opening: 1000000, opening_cash: 1000000, debts: [{ table_name: '7', amount: 50000, note: 'anh Hải' }] });
    const id2 = await mk(sh[1], { total_revenue: 2000000, pos_cash: 1000000, pos_transfer: 1000000, pos_debt: 0, reported_transfer: 1000000, cash_counted: 4050000, ipos_opening: 3000000, opening_cash: 3000000, debts: [] },
      async (id, R) => { const d = (R.open_debts || [])[0]; if (d) await rpc('app_ca_debt_collect', { p_debt: d.id, p_report: id, p_kind: 'tien_mat', p_note: null }); else r.push('ca 2 không thấy nợ ca 1'); });
    r.push(`trạng thái: ${(await rpc('app_ca_get', { p_id: id1 })).status} / ${(await rpc('app_ca_get', { p_id: id2 })).status}`);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat?xem=ngay'; await wait('.bc'); await sleep(1000);
    r.push(`Bảng ca: ${$$('.bc').map((x) => x.innerText.replace(/\s+/g, ' ')).filter((t) => /nợ/i.test(t)).join(' | ') || 'không ô nào ghi nợ'} · ${W()}`);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id1; await wait('#debts'); await sleep(1500);
    r.push(`Ca nợ (${sh[0]}): ${txt('#debts')} · link ${$('.db-paid a')?.getAttribute('href')}`);
    location.hash = '#/__tam'; await sleep(200); location.hash = '#/quan-ly/doi-soat/ca?id=' + id2; await wait('#debts'); await sleep(1500);
    const sec = $('#debts').closest('.pc-sec');
    r.push(`Ca thu (${sh[1]}): ${(sec?.innerText || '').replace(/\s+/g, ' ').slice(0, 330)} · ${W()}`);
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'công nợ theo ca thu', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
