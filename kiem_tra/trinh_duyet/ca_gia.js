// Giả lập các hàm app_ca_* (Quản lý ca) trong bộ nhớ — chỉ để chạy thử giao diện
export function makeCa(T, me) {
  for (const t of ['shift_reports', 'shift_report_moves', 'shift_report_staff', 'handover_items', 'shift_report_goods', 'shift_report_photos', 'shift_report_checks', 'shift_debts', 'daily_cash_closings']) T[t] = T[t] || [];
  const ITEMS = ['thoi_gian', 'doanh_thu', 'chuyen_khoan', 'tien_mat', 'thu_chi', 'nhan_su', 'ban_giao', 'nhap_hang', 'cong_no'];
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const shifts = () => T.shifts.filter((s) => s.status === 'Đang sử dụng').sort((a, b) => a.sort_order - b.sort_order).map((s) => s.name);
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id || 0)) + 1;
  const name = (aid) => (aid ? (aid === me.account_id ? `${me.code} – ${me.name}` : 'TK ' + aid) : null);
  const ord = (r) => r.work_date + ':' + shifts().indexOf(r.shift);
  const rep = (id) => { const r = T.shift_reports.find((x) => x.id === id); if (!r) throw new Error('Không tìm thấy phiếu chốt ca.'); return r; };
  const needEdit = (id) => { const r = rep(id); if (r.status === 'hoan_thanh') throw new Error('Phiếu đã hoàn thành, không sửa được.'); return r; };
  const forced = (r) => {
    const s = shifts(); if (r.shift === s[0]) return r.work_date + ' 06:45';
    const ps = s[s.indexOf(r.shift) - 1];
    const p = T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === ps && x.status === 'hoan_thanh');
    return p ? eff(p.id).rev_end : null;
  };
  const MONEY = ['tien_mat', 'chuyen_khoan', 'thu_chi', 'cong_no'];
  const RES = {}; const SF = []; let sfSeq = 1;
  const LBL = { tien_mat: 'Tiền mặt', chuyen_khoan: 'Chuyển khoản', thu_chi: 'Thu chi', cong_no: 'Công nợ' };
  const eff = (id) => RECON[id] || snap(id);
  const money = (id) => {
    const d = eff(id); const mv = (k) => (d.moves || []).filter((m) => m.kind === k).reduce((a, m) => a + m.amount, 0);
    const debtNew = T.shift_debts.filter((x) => x.report_id === id).reduce((a, x) => a + (x.amount || 0), 0);
    const col = (k) => T.shift_debts.filter((x) => x.closed_report_id === id && x.collect_kind === k).reduce((a, x) => a + (x.amount || 0), 0);
    const tm = d.cash_counted - d.opening_cash - d.pos_cash - mv('tien_mat') - col('tien_mat');
    const ck = d.reported_transfer - d.pos_transfer - mv('chuyen_khoan') - col('chuyen_khoan');
    const r = rep(id); const sh = shifts(); const ns = sh[sh.indexOf(r.shift) + 1];
    const nx = ns ? T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === ns) : null;
    const nh = nx ? hand(nx.id) : null; const hg = nh ? nh.gap_eff : 0;
    return { sum_gap: d.total_revenue - d.pos_cash - d.pos_transfer - debtNew, debt_new: debtNew, tm_left_self: tm, handover_gap: hg, tm_left: tm + hg, ck_left: ck, ck_left_nv: ck, bank_ok: false, ck_basis: 'nhan_vien',
      next_hand: nh && !['chua_dem', 'cho_ca_truoc'].includes(nh.state) ? { shift: ns, id: nx.id, ...nh } : null };
  };
  const TOL = 5000;
  // Tình trạng nhận két của phiếu ca NHẬN (giống app__ca_hand)
  const hand = (id) => {
    const r = rep(id); const sh = shifts(); if (r.shift === sh[0]) return null;
    const ps = sh[sh.indexOf(r.shift) - 1];
    const prev = T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === ps);
    const cnt = eff(id).opening_cash ?? null; const pc = prev && prev.status === 'hoan_thanh' ? eff(prev.id).cash_counted : null;
    const gap = cnt !== null && pc !== null ? cnt - pc : null;
    const st = cnt === null ? (prev && prev.status !== 'hoan_thanh' ? 'cho_ca_truoc' : 'chua_dem') : !prev ? 'khong_ca_truoc' : pc === null ? 'cho_ca_truoc'
      : Math.abs(gap) <= TOL ? 'khop' : r.open_first_count != null && !r.open_recount_at ? 'can_dem_lai' : 'lech';
    const ge = T.employees.find((e) => e.id === r.open_giver_emp);
    return { state: st, prev_id: prev?.id ?? null, prev_shift: ps, prev_status: prev?.status ?? null, prev_cash: pc, counted: cnt, first_count: r.open_first_count ?? null, gap,
      gap_eff: ['lech', 'can_dem_lai'].includes(st) ? gap : 0, counted_by: name(r.open_counted_by), counted_at: r.open_counted_at || null, blind: !!r.open_counted_at,
      giver_id: r.open_giver_emp || null, giver: ge ? `${ge.code} – ${ge.name}` : null, recount_at: r.open_recount_at || null, ipos_opening: r.ipos_opening ?? null, tol: TOL,
      prev_staff: prev ? T.shift_report_staff.filter((x) => x.report_id === prev.id && x.worked).map((x) => { const e = T.employees.find((y) => y.id === x.employee_id) || {}; return { id: e.id, name: `${e.code} – ${e.name}` }; }) : [] };
  };
  const emp = (id) => T.employees.find((e) => e.id === id) || {};
  const kaJson = (k) => { const r = rep(k.report_id); const b = T.branches.find((x) => x.id === r.branch_id) || {};
    return { ...k, item_label: LBL[k.item], employee: `${emp(k.employee_id).code} – ${emp(k.employee_id).name}`, work_date: r.work_date, shift: r.shift, branch: b.display_code || b.code, branch_id: r.branch_id, created_by: name(k.created_by) }; };
  const RECON = {}; const RLOG = [];
  const sumMoves = (rid, k) => T.shift_report_moves.filter((m) => m.report_id === rid && m.kind === k).reduce((a, m) => a + m.amount, 0);

  const FIELDS = ['rev_start', 'rev_end', 'total_revenue', 'pos_cash', 'pos_transfer', 'reported_transfer', 'cash_counted', 'opening_cash', 'cups', 'goods_status', 'goods_note', 'moves', 'staff', 'goods'];
  const snap = (id) => { const r = T.shift_reports.find((x) => x.id === id); return {
    ...Object.fromEntries(FIELDS.slice(0, 11).map((k) => [k, r[k] ?? null])),
    moves: T.shift_report_moves.filter((m) => m.report_id === id).map((m) => ({ kind: m.kind, amount: m.amount, note: m.note || '' })),
    staff: T.shift_report_staff.filter((x) => x.report_id === id).map((x) => ({ employee_id: x.employee_id, source: x.source, role: x.role || null, worked: !!x.worked, time_in: x.time_in || null, time_out: x.time_out || null, absent_reason: x.absent_reason || null, note: x.note || null })),
    goods: T.shift_report_goods.filter((g) => g.report_id === id).map((g) => ({ item: g.item, qty: g.qty || '' })) }; };
  const F = {
    app_ca_overview({ p_date }) {
      const out = [];
      for (const b of T.branches.filter((x) => x.status === 'Đang hoạt động').sort((a, c) => a.sort_order - c.sort_order)) {
        for (const bs of T.branch_shifts.filter((x) => x.branch_id === b.id && x.enabled)) {
          const sh = T.shifts.find((s) => s.id === bs.shift_id && s.status === 'Đang sử dụng'); if (!sh) continue;
          const r = T.shift_reports.find((x) => x.branch_id === b.id && x.work_date === p_date && x.shift === sh.name);
          const done = r && r.status === 'hoan_thanh';
          out.push({ branch_id: b.id, branch_code: b.display_code || b.code, branch_name: b.name, shift: sh.name, start_time: bs.start_time, end_time: bs.end_time, _o: sh.sort_order,
            report_id: r?.id || null, status: r?.status, recon_status: r?.recon_status, created_by: name(r?.created_by), completed_by: name(r?.completed_by), completed_at: r?.completed_at,
            cash_left: done && me.perms.doi_soat ? money(r.id).tm_left : null,
            transfer_left: done && me.perms.doi_soat ? money(r.id).ck_left : null, ck_basis: 'nhan_vien',
            hand_state: r && me.perms.doi_soat ? hand(r.id)?.state ?? null : null, hand_gap: r && me.perms.doi_soat ? hand(r.id)?.gap ?? null : null,
            revenue: done ? eff(r.id).total_revenue : null, cups: done ? eff(r.id).cups : null,
            short_total: r ? MONEY.reduce((a, it) => a + (RES[r.id + '|' + it]?.result === 'thieu' ? RES[r.id + '|' + it].amount : 0), 0) || null : null,
            checks: r ? T.shift_report_checks.filter((c) => c.report_id === r.id).length : 0, has_debt: !!(r && T.shift_debts.some((d) => d.report_id === r.id)) });
        }
      }
      return out.sort((a, c) => 0);
    },
    app_ca_open({ p_branch, p_date, p_shift }) {
      const ex = T.shift_reports.find((x) => x.branch_id === p_branch && x.work_date === p_date && x.shift === p_shift); if (ex) return ex.id;
      const r = { id: nid('shift_reports'), branch_id: p_branch, work_date: p_date, shift: p_shift, status: 'dang_chot', recon_status: 'chua', created_by: me.account_id, created_at: now(), updated_at: now(), updated_by: me.account_id };
      if (p_shift === shifts()[0]) { r.rev_start = p_date + ' 06:45'; r.opening_cash = 1000000; } else r.rev_start = forced(r);
      T.shift_reports.push(r);
      const w = T.weeks.find((x) => x.start_date <= p_date && x.end_date >= p_date);
      if (w) {
        const wd = Math.round((new Date(p_date) - new Date(w.start_date)) / 864e5);
        T.weekly_schedule_entries.filter((e) => e.week_id === w.id && e.weekday === wd && e.shift === p_shift && e.branch_id === p_branch && e.state === 'ĐÃ XẾP')
          .forEach((e) => T.shift_report_staff.push({ id: nid('shift_report_staff'), report_id: r.id, employee_id: e.employee_id, source: 'lich', role: e.role, worked: 1 }));
      }
      return r.id;
    },
    app_ca_get({ p_id }) {
      const r = rep(p_id); const b = T.branches.find((x) => x.id === r.branch_id); const s = shifts();
      const ps = s[s.indexOf(r.shift) - 1];
      const prev = ps ? T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === ps) : null;
      const emp = (id) => T.employees.find((e) => e.id === id) || {};
      const before = (o) => ord(o) < ord(r);
      const ds = !!me.perms.doi_soat; const hidePrev = !ds && r.opening_cash == null && r.shift !== s[0];
      let h = hand(r.id); if (h && hidePrev) h = { ...h, prev_cash: null, gap: null, hidden: true };
      const ns = s[s.indexOf(r.shift) + 1]; const nx = ns ? T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === ns) : null;
      const hideOwn = r.status === 'hoan_thanh' && !ds && r.completed_by !== me.account_id && !!ns && (!nx || nx.opening_cash == null);
      return { ...r, cash_hand: h, tol: TOL, ...(hideOwn ? { cash_counted: null, cash_hidden: true } : {}), branch_code: b.display_code || b.code, branch_name: b.name, first_shift: s[0], second_shift: s[1],
        created_by_name: name(r.created_by), completed_by_name: name(r.completed_by), recon_by_name: name(r.recon_by), updated_by_name: name(r.updated_by),
        prev: ps ? { shift: ps, id: prev?.id, status: prev?.status, cash_counted: hidePrev ? null : prev?.status === 'hoan_thanh' ? eff(prev.id).cash_counted : prev?.cash_counted, rev_end: prev?.status === 'hoan_thanh' ? eff(prev.id).rev_end : prev?.rev_end } : null,
        money_items: MONEY, results: Object.fromEntries(MONEY.filter((it) => RES[r.id + '|' + it]).map((it) => [it, RES[r.id + '|' + it]])),
        shortfalls: SF.filter((k) => k.report_id === r.id && k.status !== 'huy').map((k) => ({ ...k, employee: `${emp(k.employee_id).code} – ${emp(k.employee_id).name}` })),
        money: r.status === 'hoan_thanh' && me.perms.doi_soat ? money(r.id) : null,
        moves: T.shift_report_moves.filter((m) => m.report_id === r.id),
        staff: T.shift_report_staff.filter((x) => x.report_id === r.id).map((x) => ({ ...x, code: emp(x.employee_id).code, name: emp(x.employee_id).name, rank: emp(x.employee_id).rank })),
        handover: T.handover_items.filter((h) => h.report_id === r.id).map((h) => ({ ...h, created_by_name: name(h.created_by) })),
        carried: T.handover_items.filter((h) => h.branch_id === r.branch_id && h.report_id !== r.id && before(rep(h.report_id)) && (!h.done_at || h.done_report_id === r.id))
          .map((h) => ({ ...h, from_date: rep(h.report_id).work_date, from_shift: rep(h.report_id).shift, created_by_name: name(h.created_by), done_by_name: name(h.done_by) })),
        goods: T.shift_report_goods.filter((g) => g.report_id === r.id), photos: T.shift_report_photos.filter((p) => p.report_id === r.id && !(hideOwn && p.kind === 'ipos')),
        debts: T.shift_debts.filter((d) => d.report_id === r.id),
        open_debts: T.shift_debts.filter((d) => d.branch_id === r.branch_id && d.report_id !== r.id && before(rep(d.report_id)) && (!d.closed_at || d.closed_report_id === r.id))
          .map((d) => ({ ...d, from_date: rep(d.report_id).work_date, from_shift: rep(d.report_id).shift, closed_by_name: name(d.closed_by) })),
        checks: Object.fromEntries(T.shift_report_checks.filter((c) => c.report_id === r.id).map((c) => [c.item, { by: name(c.checked_by), at: c.checked_at }])),
        check_items: ITEMS, forced_start: forced(r), can_edit: r.status === 'dang_chot', can_recon: !!me.perms.doi_soat && r.status === 'hoan_thanh', can_reopen: !!me.perms.mo_lai_phieu_ca && r.status === 'hoan_thanh' };
    },
    app_ca_save({ p_id, p }) {
      const r = needEdit(p_id); const f = forced(r);
      Object.assign(r, { rev_start: f || p.rev_start, rev_end: p.rev_end, total_revenue: p.total_revenue, pos_cash: p.pos_cash, pos_transfer: p.pos_transfer, reported_transfer: p.reported_transfer,
        cash_counted: p.cash_counted, opening_cash: r.shift === shifts()[0] ? 1000000 : r.opening_cash ?? null, opening_note: p.opening_note || null, ipos_opening: 'ipos_opening' in p ? p.ipos_opening : r.ipos_opening, cups: p.cups, goods_status: p.goods_status || r.goods_status || 'khong', goods_note: p.goods_note, updated_at: now(), updated_by: me.account_id });
      T.shift_report_moves = T.shift_report_moves.filter((m) => m.report_id !== r.id).concat(p.moves.map((m, i) => ({ id: 1000 + Math.random(), report_id: r.id, ...m, sort_order: i })));
      T.shift_report_staff = T.shift_report_staff.filter((m) => m.report_id !== r.id).concat(p.staff.map((m) => ({ id: Math.random(), report_id: r.id, ...m, worked: m.worked ? 1 : 0 })));
      T.shift_report_goods = T.shift_report_goods.filter((m) => m.report_id !== r.id).concat(p.goods.filter((g) => g.item).map((g) => ({ id: Math.random(), report_id: r.id, ...g })));
      const keepH = p.handover.filter((h) => h.id).map((h) => h.id);
      T.handover_items = T.handover_items.filter((h) => h.report_id !== r.id || h.task_id || keepH.includes(h.id));
      const hIds = p.handover.map((h) => { if (!h.content.trim()) return null; if (h.id) { T.handover_items.find((x) => x.id === h.id).content = h.content.trim(); return h.id; } const id = nid('handover_items'); T.handover_items.push({ id, branch_id: r.branch_id, report_id: r.id, content: h.content.trim(), created_by: me.account_id, created_at: now() }); return id; });
      const keepD = p.debts.filter((d) => d.id).map((d) => d.id);
      T.shift_debts = T.shift_debts.filter((d) => d.report_id !== r.id || d.closed_at || keepD.includes(d.id));
      const dIds = p.debts.map((d) => { if (!d.table_name.trim()) return null; if (d.id) { Object.assign(T.shift_debts.find((x) => x.id === d.id), { table_name: d.table_name, amount: d.amount || 0, note: d.note }); return d.id; } const id = nid('shift_debts'); T.shift_debts.push({ id, branch_id: r.branch_id, report_id: r.id, table_name: d.table_name, amount: d.amount || 0, note: d.note, created_by: me.account_id, created_at: now() }); return id; });
      return { at: now(), rev_start: r.rev_start, handover_ids: hIds, debt_ids: dIds };
    },
    app_ca_complete({ p_id }) {
      const r = needEdit(p_id); const f = forced(r); if (f) r.rev_start = f;
      const miss = [];
      if (r.opening_cash == null) miss.push('Đếm nhận két đầu ca');
      if (r.ipos_opening == null) miss.push('Số dư đầu trên phiếu iPOS');
      if (!r.rev_start || !r.rev_end) miss.push('giờ doanh thu');
      for (const k of ['total_revenue', 'pos_cash', 'pos_transfer', 'reported_transfer', 'cash_counted', 'cups', 'goods_status']) if (r[k] === null || r[k] === undefined) miss.push(k);
      if (!T.shift_report_photos.some((p) => p.report_id === r.id && p.kind === 'ipos')) miss.push('Ảnh phiếu chốt ca iPOS');
      if (miss.length) throw new Error('Còn thiếu: ' + miss.join(', ') + '.');
      if (r.rev_end <= r.rev_start) throw new Error('Giờ kết thúc doanh thu phải sau giờ bắt đầu.');
      const debtNew = T.shift_debts.filter((d) => d.report_id === r.id).reduce((a, d) => a + (d.amount || 0), 0);
      if (r.total_revenue !== r.pos_cash + r.pos_transfer + debtNew) throw new Error('Mục 1 (Tổng doanh thu) phải bằng Mục 2 + Mục 3 + Công nợ phát sinh.');
      const h = hand(r.id);
      if (h && h.state === 'can_dem_lai') throw new Error(`Tiền nhận két lệch két cuối ca ${h.prev_shift}. Hãy cùng 1 người ca ${h.prev_shift} đếm lại và nhập số đếm lại trước khi hoàn thành.`);
      if (h && h.state === 'lech' && !r.opening_note) throw new Error('Tiền nhận két lệch két cuối ca trước. Ghi lý do lệch trước khi hoàn thành.');
      if (r.ipos_opening !== r.opening_cash && !r.opening_note) throw new Error('Số dư đầu trên iPOS khác tiền nhận két. Ghi lý do trước khi hoàn thành.');
      if (r.goods_status === 'thieu' && !T.shift_report_goods.some((g) => g.report_id === r.id)) throw new Error('Nhập hàng THIẾU: hãy ghi mặt hàng.');
      if (T.shift_report_moves.some((m) => m.report_id === r.id && (!m.amount || !m.note))) throw new Error('Mỗi dòng thu chi cần số tiền khác 0 và nội dung.');
      for (const s of T.shift_report_staff.filter((x) => x.report_id === r.id)) {
        if (s.worked && (!s.time_in || !s.time_out)) throw new Error('Nhập giờ đến và giờ về của NV ' + s.employee_id + '.');
        if (!s.worked && !s.absent_reason) throw new Error('Ghi lý do nghỉ của NV ' + s.employee_id + '.');
      }
      Object.assign(r, { status: 'hoan_thanh', completed_by: me.account_id, completed_at: now() });
    },
    app_ca_handover_done({ p_item, p_report, p_done }) { needEdit(p_report); const h = T.handover_items.find((x) => x.id === p_item); Object.assign(h, p_done ? { done_at: now(), done_by: me.account_id, done_report_id: p_report } : { done_at: null, done_by: null, done_report_id: null }); },
    app_ca_debt_collect({ p_debt, p_report, p_kind, p_note }) { needEdit(p_report); const d = T.shift_debts.find((x) => x.id === p_debt); Object.assign(d, p_kind === null ? { closed_at: null, closed_by: null, closed_report_id: null, close_note: null, collect_kind: null } : { closed_at: now(), closed_by: me.account_id, closed_report_id: p_report, close_note: p_note || 'Đã thu', collect_kind: p_kind }); },
    app_ca_photo_add({ p_id, p_path, p_kind }) { needEdit(p_id); const id = nid('shift_report_photos'); T.shift_report_photos.push({ id, report_id: p_id, path: p_path, kind: p_kind || 'hang' }); return id; },
    app_ca_cash_receive({ p_id, p_amount }) {
      const r = needEdit(p_id); const sh = shifts();
      if (r.shift === sh[0]) throw new Error('Ca đầu ngày nhận 1.000.000đ cố định — không cần đếm nhận két.');
      if (r.opening_cash != null) throw new Error('Ca này đã nhập tiền nhận két. Nếu lệch, hãy cùng người ca trước đếm lại.');
      if (p_amount == null || p_amount < 0) throw new Error('Nhập số tiền đếm được trong két.');
      const prev = T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === sh[sh.indexOf(r.shift) - 1]);
      if (prev && prev.status !== 'hoan_thanh') throw new Error(`Ca ${prev.shift} chưa bấm HOÀN THÀNH phiếu chốt ca. Người ca ${prev.shift} đếm két, hoàn thành phiếu trước, sau đó bạn mới đếm nhận két.`);
      Object.assign(r, { opening_cash: p_amount, open_first_count: p_amount, open_counted_by: me.account_id, open_counted_at: now() });
      return hand(r.id);
    },
    app_ca_cash_recount({ p_id, p_amount, p_giver }) {
      const r = needEdit(p_id); const h = hand(r.id);
      if (!h || h.state !== 'can_dem_lai') throw new Error('Chỉ đếm lại khi tiền nhận két lệch két cuối ca trước (và chưa đếm lại lần nào).');
      if (p_amount == null || p_amount < 0) throw new Error('Nhập số tiền 2 người cùng đếm lại.');
      if (!p_giver) throw new Error('Chọn người ca trước cùng đếm lại.');
      if (h.prev_staff.length && !h.prev_staff.some((x) => x.id === p_giver)) throw new Error(`Người cùng đếm lại phải là nhân viên làm ca ${h.prev_shift}.`);
      Object.assign(r, { opening_cash: p_amount, open_giver_emp: p_giver, open_recount_at: now() });
      const h2 = hand(r.id); if (h2.state === 'lech') window.__LOG.push(['notify', 'Bàn giao két bị lệch', h2.gap]);
      return h2;
    },
    app_ca_photo_del({ p_photo }) { const ph = T.shift_report_photos.find((x) => x.id === p_photo); needEdit(ph.report_id); T.shift_report_photos = T.shift_report_photos.filter((x) => x !== ph); return ph.path; },
    app_ca_check({ p_id, p_item, p_on }) {
      const r = rep(p_id); if (r.status !== 'hoan_thanh') throw new Error('Nhân viên chưa hoàn thành phiếu này.');
      if (r.recon_status === 'hoan_thanh') throw new Error('Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.');
      if (MONEY.includes(p_item)) throw new Error('Hạng mục tiền: chọn kết quả KHỚP / THIẾU / THỪA.');
      T.shift_report_checks = T.shift_report_checks.filter((c) => !(c.report_id === p_id && c.item === p_item));
      if (p_on) T.shift_report_checks.push({ report_id: p_id, item: p_item, checked_by: me.account_id, checked_at: now() });
      const n = T.shift_report_checks.filter((c) => c.report_id === p_id).length;
      if (r.recon_status === 'chua' && n >= ITEMS.length) { Object.assign(r, { recon_status: 'hoan_thanh', recon_by: me.account_id, recon_at: now() }); RLOG.push({ report_id: p_id, action: 'hoan_thanh_doi_soat', by: name(me.account_id), at: now() }); }
    },
    app_ca_result_set({ p_id, p_item, p_result, p_amount, p_reason, p_people }) {
      const r = rep(p_id); if (r.recon_status === 'hoan_thanh') throw new Error('Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.');
      const amt = p_result === 'khop' ? 0 : p_amount || 0;
      if (p_result !== 'khop' && amt <= 0) throw new Error('Nhập số tiền (lớn hơn 0).');
      if (p_result !== 'khop' && !(p_reason || '').trim()) throw new Error('Ghi lý do.');
      if (SF.some((k) => k.report_id === p_id && k.item === p_item && ['da_bu', 'tru_luong', 'mien'].includes(k.status))) throw new Error('Khoản âm của hạng mục này đã được xử lý nên không đổi được kết quả.');
      if (p_result === 'thieu') {
        if (!(p_people || []).length) throw new Error('Chọn nhân viên chịu khoản thiếu.');
        const tot = p_people.reduce((a, x) => a + x.amount, 0); if (tot !== amt) throw new Error(`Tổng tiền chia cho nhân viên (${tot}) phải bằng số tiền thiếu (${amt}).`);
      }
      for (let i = SF.length - 1; i >= 0; i--) if (SF[i].report_id === p_id && SF[i].item === p_item && SF[i].status === 'chua_xu_ly') SF.splice(i, 1);
      if (p_result === 'thieu') p_people.forEach((x) => SF.push({ id: sfSeq++, report_id: p_id, item: p_item, employee_id: x.employee_id, amount: x.amount, reason: p_reason, status: 'chua_xu_ly', created_by: me.account_id, created_at: now() }));
      RES[p_id + '|' + p_item] = { result: p_result, amount: amt, reason: p_reason || null, by: name(me.account_id), at: now() };
      T.shift_report_checks = T.shift_report_checks.filter((c) => !(c.report_id === p_id && c.item === p_item)).concat([{ report_id: p_id, item: p_item, checked_by: me.account_id, checked_at: now() }]);
      RLOG.push({ report_id: p_id, action: 'ket_qua', field: p_item, after: { result: p_result, amount: amt, people: p_people || [] }, reason: p_reason || null, by: name(me.account_id), at: now() });
      if (r.recon_status === 'chua' && T.shift_report_checks.filter((c) => c.report_id === p_id).length >= ITEMS.length) Object.assign(r, { recon_status: 'hoan_thanh', recon_by: me.account_id, recon_at: now() });
    },
    app_ca_result_clear({ p_id, p_item }) {
      delete RES[p_id + '|' + p_item];
      for (let i = SF.length - 1; i >= 0; i--) if (SF[i].report_id === p_id && SF[i].item === p_item && SF[i].status === 'chua_xu_ly') SF.splice(i, 1);
      T.shift_report_checks = T.shift_report_checks.filter((c) => !(c.report_id === p_id && c.item === p_item));
    },
    app_ka_mine: () => SF.filter((k) => k.employee_id === me.employee_id).map(kaJson).reverse(),
    app_ka_seen({ p_id }) { const k = SF.find((x) => x.id === p_id && x.employee_id === me.employee_id); if (k && !k.seen_at) k.seen_at = now(); },
    app_ka_reply({ p_id, p_text }) { if (!(p_text || '').trim()) throw new Error('Nhập nội dung giải trình.'); const k = SF.find((x) => x.id === p_id && x.employee_id === me.employee_id); if (!k) throw new Error('Không tìm thấy khoản âm của bạn.'); Object.assign(k, { reply: p_text.trim(), reply_at: now(), seen_at: k.seen_at || now() }); },
    app_ka_all: ({ p_from, p_to }) => SF.filter((k) => k.status !== 'huy').map(kaJson).filter((k) => (!p_from || k.work_date >= p_from) && (!p_to || k.work_date <= p_to)),
    app_ka_set_status({ p_id, p_status, p_note }) { if (p_status === 'mien' && !(p_note || '').trim()) throw new Error('Miễn khoản âm phải ghi lý do.'); Object.assign(SF.find((x) => x.id === p_id), { status: p_status, status_note: p_note || null, status_by: me.account_id, status_at: now() }); },
    app_ca_report({ p_from, p_to }) {
      const rs = T.shift_reports.filter((r) => r.status === 'hoan_thanh' && r.work_date >= p_from && r.work_date <= p_to);
      return { reports: rs.map((r) => { const d = eff(r.id); const b = T.branches.find((x) => x.id === r.branch_id) || {};
        return { id: r.id, work_date: r.work_date, shift: r.shift, branch_id: r.branch_id, branch: b.display_code || b.code, revenue: d.total_revenue, cups: d.cups, pos_cash: d.pos_cash, pos_transfer: d.pos_transfer, debt_new: 0, recon: r.recon_status,
          short: MONEY.reduce((a, it) => a + (RES[r.id + '|' + it]?.result === 'thieu' ? RES[r.id + '|' + it].amount : 0), 0), over: 0 }; }),
        shortfalls: SF.filter((k) => k.status !== 'huy').map(kaJson).filter((k) => k.work_date >= p_from && k.work_date <= p_to),
        shifts: shifts(), branches: T.branches.filter((b) => b.status === 'Đang hoạt động').map((b) => ({ id: b.id, code: b.display_code || b.code, name: b.name })) };
    },
    app_ca_reopen({ p_id }) { const r = rep(p_id); Object.assign(r, { status: 'dang_chot', recon_status: 'chua', completed_at: null, completed_by: null }); T.shift_report_checks = T.shift_report_checks.filter((c) => c.report_id !== p_id); delete RECON[p_id];
      SF.forEach((k) => { if (k.report_id === p_id && k.status === 'chua_xu_ly') k.status = 'huy'; }); MONEY.forEach((it) => delete RES[p_id + '|' + it]); RLOG.push({ report_id: p_id, action: 'lam_lai', by: name(me.account_id), at: now() }); },
    app_ca_recon({ p_id }) {
      const r = rep(p_id); if (r.status !== 'hoan_thanh') throw new Error('Nhân viên chưa hoàn thành phiếu này.');
      if (!RECON[p_id]) RECON[p_id] = snap(p_id);
      const ids = new Set([...RECON[p_id].staff, ...snap(p_id).staff].map((x) => x.employee_id));
      const employees = Object.fromEntries([...ids].map((id) => { const e = T.employees.find((x) => x.id === id) || {}; return [String(id), { code: e.code, name: e.name, rank: e.rank }]; }));
      return { data: JSON.parse(JSON.stringify(RECON[p_id])), original: snap(p_id), employees, editable: r.recon_status !== 'hoan_thanh', recon_status: r.recon_status,
        log: RLOG.filter((l) => l.report_id === p_id).slice().reverse() };
    },
    app_ca_recon_save({ p_id, p, p_reason }) {
      const r = rep(p_id); if (r.recon_status === 'hoan_thanh') throw new Error('Phiếu đã HOÀN THÀNH ĐỐI SOÁT. Bấm "Mở lại đối soát" trước khi sửa.');
      if (!RECON[p_id]) RECON[p_id] = snap(p_id);
      const old = RECON[p_id];
      for (const k of FIELDS) {
        if (!(k in p)) continue;
        let v = p[k];
        if (k === 'staff') v = (v || []).map((x) => ({ employee_id: x.employee_id, source: x.source, role: x.role, worked: !!x.worked, time_in: x.time_in || null, time_out: x.time_out || null, absent_reason: x.absent_reason || null, note: x.note || null }));
        if (k === 'moves') v = (v || []).map((x) => ({ kind: x.kind, amount: x.amount, note: x.note || '' }));
        if (k === 'goods') v = (v || []).filter((x) => x.item).map((x) => ({ item: x.item, qty: x.qty || '' }));
        if (JSON.stringify(old[k] ?? null) !== JSON.stringify(v ?? null)) { RLOG.push({ report_id: p_id, action: 'sua', field: k, before: old[k] ?? null, after: v ?? null, reason: p_reason || null, by: name(me.account_id), at: now() }); old[k] = v; }
      }
    },
    app_ca_recon_reopen({ p_id, p_reason }) { const r = rep(p_id); if (r.recon_status !== 'hoan_thanh') throw new Error('Phiếu chưa hoàn thành đối soát.'); r.recon_status = 'mo_lai'; RLOG.push({ report_id: p_id, action: 'mo_lai_doi_soat', reason: p_reason || null, by: name(me.account_id), at: now() }); },
    app_ca_recon_finish({ p_id }) {
      const r = rep(p_id); const n = T.shift_report_checks.filter((c) => c.report_id === p_id).length;
      if (n < ITEMS.length) throw new Error(`Còn ${ITEMS.length - n} hạng mục chưa đối soát.`);
      Object.assign(r, { recon_status: 'hoan_thanh', recon_by: me.account_id, recon_at: now() }); RLOG.push({ report_id: p_id, action: 'hoan_thanh_doi_soat', by: name(me.account_id), at: now() });
    },
    app_ca_day({ p_date }) {
      return T.branches.filter((b) => b.status === 'Đang hoạt động').map((b) => {
        const rs = T.shift_reports.filter((r) => r.branch_id === b.id && r.work_date === p_date).sort((a, c) => shifts().indexOf(a.shift) - shifts().indexOf(c.shift));
        const dn = rs.filter((r) => r.status === 'hoan_thanh'); const c = T.daily_cash_closings.find((x) => x.branch_id === b.id && x.work_date === p_date) || {};
        return { branch_id: b.id, branch_code: b.display_code || b.code, branch_name: b.name, shifts: T.branch_shifts.filter((x) => x.branch_id === b.id && x.enabled).length, done: dn.length,
          opening: rs[0]?.opening_cash ?? null, pos_cash: dn.length ? dn.reduce((a, r) => a + r.pos_cash, 0) : null,
          moves_cash: dn.reduce((a, r) => a + sumMoves(r.id, 'tien_mat'), 0), debt_cash: T.shift_debts.filter((d) => d.collect_kind === 'tien_mat' && dn.some((r) => r.id === d.closed_report_id)).reduce((a, d) => a + d.amount, 0), last_counted: dn.at(-1)?.cash_counted ?? null, last_shift: dn.at(-1)?.shift ?? null,
          has_debt: T.shift_debts.some((d) => rs.some((r) => r.id === d.report_id)), counted: c.counted ?? null, note: c.note ?? null, done_by: name(c.done_by), done_at: c.done_at ?? null };
      });
    },
    app_ca_day_save({ p_branch, p_date, p_counted, p_note }) {
      const total = T.branch_shifts.filter((x) => x.branch_id === p_branch && x.enabled).length;
      const done = T.shift_reports.filter((r) => r.branch_id === p_branch && r.work_date === p_date && r.status === 'hoan_thanh').length;
      if (done < total) throw new Error(`Chưa đủ ${total} phiếu ca hoàn thành.`);
      if (p_counted === null) throw new Error('Nhập số tiền mặt cuối ngày đã kiểm đếm.');
      T.daily_cash_closings = T.daily_cash_closings.filter((x) => !(x.branch_id === p_branch && x.work_date === p_date));
      T.daily_cash_closings.push({ branch_id: p_branch, work_date: p_date, counted: p_counted, note: p_note, done_by: me.account_id, done_at: now() });
    },
    app_ca_employees() { return T.employees.filter((e) => e.status === 'Đang làm').map(({ id, code, name: n, rank }) => ({ id, code, name: n, rank })); },
  };
  return F;
}

// Storage giả: lưu blob trong bộ nhớ, trả link blob:
export function makeStorage() {
  const files = new Map();
  return {
    from: () => ({
      upload: async (path, blob) => { files.set(path, blob); window.__LOG.push(['upload', path, blob.size]); return { data: { path }, error: null }; },
      createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: files.has(p) ? URL.createObjectURL(files.get(p)) : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' })), error: null }),
      remove: async (paths) => { paths.forEach((p) => files.delete(p)); return { data: [], error: null }; },
    }),
  };
}
