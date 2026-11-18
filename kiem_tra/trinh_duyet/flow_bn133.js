// Bước 133: Báo nợ chọn người nợ · Thu/Chi → Báo nợ · Luân chuyển TM – CK 2 chiều · quyền Kiểm tra theo cơ sở. Dữ liệu giả.
// &phan=chot (role=nv|chu): phiếu chốt ca · &phan=ds (role=chu): bước Kiểm tra · &phan=quyen (role=ql&noassign=1): quản lý không phân công.
export default async ({ sleep, out }) => {
  const $ = (q, r = document) => r.querySelector(q); const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const pick = (sel, val) => { const o = [...sel.options].find((x) => x.value === val); sel.value = o ? o.value : val; sel.dispatchEvent(new Event('change', { bubbles: true })); };
  const fails = [], seen = []; const check = (ok, l) => { (ok ? seen : fails).push((ok ? '✓ ' : '✗ ') + l); };
  const noScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const q = new URLSearchParams(location.search); const phan = q.get('phan') || 'chot';
  window.confirm = () => true;
  try {
    await wait('#root h1, #root h2, #root .card, #root nav', 600); await sleep(1500); $$('dialog[open]').forEach((d) => d.close());
    const { rpc } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day }); const o = ov.find((x) => x.branch_code === (phan === 'chot' ? 'LHP' : 'LLB')) || ov[0];   // LLB: không cần file Fabi → mở được Kiểm tra
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id }); const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? R.staff.map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 6900000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5300000, ipos_opening: 1000000, opening_cash: 1000000, pos_debt: 0, pos_diff: -200000, cups: 50, goods: [], handover: [], debts: [], staff,
      moves: [{ kind: 'tien_mat', amount: -150000, note: 'Mua đá' }, { kind: 'chuyen_khoan', amount: -30000, note: 'Chuyển kho' }] } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r' + id + '/ipos/a.jpg', p_kind: 'ipos' });
    if (phan === 'chot') {
      location.hash = '#/ca/phieu?id=' + id; await wait('#cm-next'); await sleep(300);
      $('[data-shift-step="2"]').click(); await wait('#cm-open'); await sleep(300);
      $('#cm-add-debt')?.click(); await sleep(200);
      let who = $('[data-dwho="0"]');
      check(!!who && [...who.options].some((x) => /Kho tổng/.test(x.textContent)) && [...who.options].some((x) => /Khách/.test(x.textContent)), 'Dòng Báo nợ có menu Người nợ (Khách, Kho tổng…)');
      pick(who, 'Kho tổng'); await sleep(200);
      check(!$('[data-db="0"][data-k="table_name"]') && /② Nợ kho tổng/.test(txt($('.cm-debt'))), 'Chọn Kho tổng → ẩn ô tên, ghi "② Nợ kho tổng"');
      set($('[data-db="0"][data-k="amount"]'), '10586000');
      const tono = $$('[data-tono]').find((b) => /Mua đá/.test(txt(b.closest('.sc-row')) + (b.closest('.sc-row').querySelector('[data-k="note"]')?.value || '')));
      tono?.click(); await sleep(200);
      who = $('[data-dwho="1"]'); check(!!who, 'Thu/Chi → Báo nợ: dòng nợ mới có menu Người nợ');
      const fam = who && [...who.options].find((x) => x.dataset.grp === 'khac');
      if (fam) { pick(who, fam.value); await sleep(200); }
      check(!!fam && /③ Nợ khác/.test(txt($$('.cm-debt')[1])), 'Chọn người nhà → "③ Nợ khác"');
      $('#cm-exchange')?.click(); await sleep(200);
      const xb = $$('[data-xdir][data-v="ck_tm"]').slice(-1)[0]; xb?.click(); await sleep(200);
      const ex = $$('.sc-exchange').slice(-1)[0];
      check(!!ex && /Luân chuyển tiền mặt – CK/.test(txt(ex)) && /Tiền mặt \+/.test(txt(ex)) && /chuyển khoản −/.test(txt(ex)), 'Luân chuyển chọn CK → TM: tiền mặt +, chuyển khoản −');
      const exAmt = ex?.querySelector('[data-k="amount"]'); if (exAmt) set(exAmt, '200000');
      const exNote = ex?.querySelector('[data-k="note"]'); if (exNote) set(exNote, 'Rút tiền về két');
      check(/Luân chuyển TM – CK/.test(txt($('.sc-shift-table, .sc-money, #root'))), 'Bảng tiền có dòng "± Luân chuyển TM – CK"');
      check(noScroll(), 'Phiếu chốt ca không tràn ngang');
      await sleep(2500); $('[data-shift-step="1"]')?.click(); await sleep(1500);
      const saved = await rpc('app_ca_get', { p_id: id });
      const dk = (saved.debts || []).find((d) => d.table_name === 'Kho tổng'); const dx = (saved.debts || []).find((d) => d.grp === 'khac');
      check(dk?.grp === 'kho' && Number(dk.amount) === 10586000, 'Lưu: nợ Kho tổng vào nhóm ② (' + JSON.stringify(dk && { g: dk.grp, a: dk.amount }) + ')');
      check(!!dx, 'Lưu: nợ người nhà vào nhóm ③');
      const pair = (saved.moves || []).filter((m) => m.exchange_key);
      check(pair.length === 2 && pair.some((m) => m.kind === 'tien_mat' && Number(m.amount) === 200000) && pair.some((m) => m.kind === 'chuyen_khoan' && Number(m.amount) === -200000), 'Lưu: luân chuyển CK → TM đúng dấu 2 vế');
    } else {
      for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
      location.hash = '#/ca/phieu?id=' + id + '&__ds=1&buoc=4'; await wait('.ds-pane'); await sleep(1800);
      if (phan === 'quyen') {
        check(!$('#ds-money-open') && /Chỉ quản lý đối soát cơ sở này/.test(txt($('#root'))) && !!$('.ds-norecon'), 'Quản lý không phân công: không có nút Mở để sửa, có dòng "Chỉ quản lý đối soát cơ sở này…"' + ($('.ds-norecon') ? '' : ' — trang: ' + txt($('#root .content, #root main, #root')).slice(-260)));
      } else {
        $('#ds-money-open')?.click(); await sleep(1500); await wait('.ds-pane');
        const rowOf = (note) => $$('#moves .mv-row').find((r) => r.querySelector('.mv-note')?.value === note);
        rowOf('Chuyển kho')?.querySelector('.uv-2no')?.click(); await sleep(300);
        const drow = $$('#debts .uv-debt').slice(-1)[0];
        const who = drow?.querySelector('.debt-who');
        check(!!who && /đổi từ/.test(txt(drow)), 'Kiểm tra: Chi CK → Báo nợ có menu Người nợ + ghi "đổi từ"');
        if (who) { pick(who, 'Kho tổng'); await sleep(200); }
        check(drow?.querySelector('.db-table')?.hidden && /② Nợ kho tổng/.test(txt(drow)), 'Kiểm tra: chọn Kho tổng → ẩn ô tên, ghi "② Nợ kho tổng"');
        rowOf('Mua đá')?.querySelector('.uv-2rut')?.click(); await sleep(300);
        const ex = $$('#moves .sc-exchange').slice(-1)[0];
        check(!!ex && /Luân chuyển tiền mặt – CK/.test(txt(ex)) && ex.dataset.dir === 'tm_ck', 'Kiểm tra: Chi TM → Luân chuyển (chiều TM → CK)');
        ex?.querySelector('.mv-xdir[data-v="ck_tm"]')?.click(); await sleep(200);
        check(ex?.dataset.dir === 'ck_tm' && /Chuyển khoản giảm · tiền mặt tăng/.test(txt(ex)), 'Kiểm tra: đổi chiều CK → TM');
        $('#ds-money-save')?.click(); await sleep(600);
        const dlg = $('dialog[open]');
        check(!!dlg && /Đổi .*→ Báo nợ CK · Kho tổng \(② Nợ kho tổng\)/.test(txt(dlg)), 'Hộp Lưu ghi "Đổi … → Báo nợ CK · Kho tổng (② Nợ kho tổng)" — ' + txt(dlg).slice(0, 160));
        const w = $('dialog[open] [name=why]'); if (w) w.value = 'Kho tổng vay';
        $('dialog[open] form')?.requestSubmit(); await sleep(2500);
        const saved = await rpc('app_ca_get', { p_id: id });
        check((saved.debts || []).some((d) => d.table_name === 'Kho tổng' && d.grp === 'kho' && d.kind === 'ck'), 'Lưu: máy chủ có nợ CK Kho tổng nhóm ②');
        check(noScroll(), 'Kiểm tra không tràn ngang');
      }
    }
  } catch (er) { fails.push('LỖI ' + (er.stack || er)); }
  out.push({ route: 'bn133 ' + phan, title: seen.join(' · ').slice(0, 1200), errs: fails });
};
