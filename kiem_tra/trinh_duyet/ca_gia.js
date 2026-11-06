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
    if (r.shift === s[1]) { const p = T.shift_reports.find((x) => x.branch_id === r.branch_id && x.work_date === r.work_date && x.shift === s[0] && x.status === 'hoan_thanh'); return p ? p.rev_end : null; }
    return null;
  };
  const sumMoves = (rid, k) => T.shift_report_moves.filter((m) => m.report_id === rid && m.kind === k).reduce((a, m) => a + m.amount, 0);
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
            cash_left: done ? r.cash_counted - r.opening_cash - r.pos_cash - sumMoves(r.id, 'tien_mat') : null,
            transfer_left: done ? r.reported_transfer - r.pos_transfer - sumMoves(r.id, 'chuyen_khoan') : null,
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
      return { ...r, branch_code: b.display_code || b.code, branch_name: b.name, first_shift: s[0], second_shift: s[1],
        created_by_name: name(r.created_by), completed_by_name: name(r.completed_by), recon_by_name: name(r.recon_by), updated_by_name: name(r.updated_by),
        prev: ps ? { shift: ps, id: prev?.id, status: prev?.status, cash_counted: prev?.cash_counted, rev_end: prev?.rev_end } : null,
        moves: T.shift_report_moves.filter((m) => m.report_id === r.id),
        staff: T.shift_report_staff.filter((x) => x.report_id === r.id).map((x) => ({ ...x, code: emp(x.employee_id).code, name: emp(x.employee_id).name, rank: emp(x.employee_id).rank })),
        handover: T.handover_items.filter((h) => h.report_id === r.id).map((h) => ({ ...h, created_by_name: name(h.created_by) })),
        carried: T.handover_items.filter((h) => h.branch_id === r.branch_id && h.report_id !== r.id && before(rep(h.report_id)) && (!h.done_at || h.done_report_id === r.id))
          .map((h) => ({ ...h, from_date: rep(h.report_id).work_date, from_shift: rep(h.report_id).shift, created_by_name: name(h.created_by), done_by_name: name(h.done_by) })),
        goods: T.shift_report_goods.filter((g) => g.report_id === r.id), photos: T.shift_report_photos.filter((p) => p.report_id === r.id),
        debts: T.shift_debts.filter((d) => d.report_id === r.id),
        open_debts: T.shift_debts.filter((d) => d.branch_id === r.branch_id && d.report_id !== r.id && before(rep(d.report_id)) && (!d.closed_at || d.closed_report_id === r.id))
          .map((d) => ({ ...d, from_date: rep(d.report_id).work_date, from_shift: rep(d.report_id).shift, closed_by_name: name(d.closed_by) })),
        checks: Object.fromEntries(T.shift_report_checks.filter((c) => c.report_id === r.id).map((c) => [c.item, { by: name(c.checked_by), at: c.checked_at }])),
        check_items: ITEMS, forced_start: forced(r), can_edit: r.status === 'dang_chot', can_recon: !!me.perms.doi_soat && r.status === 'hoan_thanh', can_reopen: !!me.perms.mo_lai_phieu_ca && r.status === 'hoan_thanh' };
    },
    app_ca_save({ p_id, p }) {
      const r = needEdit(p_id); const f = forced(r);
      Object.assign(r, { rev_start: f || p.rev_start, rev_end: p.rev_end, total_revenue: p.total_revenue, pos_cash: p.pos_cash, pos_transfer: p.pos_transfer, reported_transfer: p.reported_transfer,
        cash_counted: p.cash_counted, opening_cash: r.shift === shifts()[0] ? 1000000 : p.opening_cash, cups: p.cups, goods_status: p.goods_status, goods_note: p.goods_note, updated_at: now(), updated_by: me.account_id });
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
      if (!r.rev_start || !r.rev_end) miss.push('giờ doanh thu');
      for (const k of ['total_revenue', 'pos_cash', 'pos_transfer', 'reported_transfer', 'cash_counted', 'opening_cash', 'cups', 'goods_status']) if (r[k] === null || r[k] === undefined) miss.push(k);
      if (miss.length) throw new Error('Còn thiếu: ' + miss.join(', ') + '.');
      if (r.rev_end <= r.rev_start) throw new Error('Giờ kết thúc doanh thu phải sau giờ bắt đầu.');
      if (!T.shift_debts.some((d) => d.report_id === r.id) && r.total_revenue !== r.pos_cash + r.pos_transfer) throw new Error('Mục 1 (Tổng doanh thu) phải bằng Mục 2 + Mục 3.');
      if (r.goods_status === 'thieu' && !T.shift_report_goods.some((g) => g.report_id === r.id)) throw new Error('Nhập hàng THIẾU: hãy ghi mặt hàng.');
      if (T.shift_report_moves.some((m) => m.report_id === r.id && (!m.amount || !m.note))) throw new Error('Mỗi dòng thu chi cần số tiền khác 0 và nội dung.');
      for (const s of T.shift_report_staff.filter((x) => x.report_id === r.id)) {
        if (s.worked && (!s.time_in || !s.time_out)) throw new Error('Nhập giờ đến và giờ về của NV ' + s.employee_id + '.');
        if (!s.worked && !s.absent_reason) throw new Error('Ghi lý do nghỉ của NV ' + s.employee_id + '.');
      }
      Object.assign(r, { status: 'hoan_thanh', completed_by: me.account_id, completed_at: now() });
    },
    app_ca_handover_done({ p_item, p_report, p_done }) { needEdit(p_report); const h = T.handover_items.find((x) => x.id === p_item); Object.assign(h, p_done ? { done_at: now(), done_by: me.account_id, done_report_id: p_report } : { done_at: null, done_by: null, done_report_id: null }); },
    app_ca_debt_close({ p_debt, p_report, p_note }) { needEdit(p_report); const d = T.shift_debts.find((x) => x.id === p_debt); Object.assign(d, p_note === null ? { closed_at: null, closed_by: null, closed_report_id: null, close_note: null } : { closed_at: now(), closed_by: me.account_id, closed_report_id: p_report, close_note: p_note }); },
    app_ca_photo_add({ p_id, p_path }) { needEdit(p_id); const id = nid('shift_report_photos'); T.shift_report_photos.push({ id, report_id: p_id, path: p_path }); return id; },
    app_ca_photo_del({ p_photo }) { const ph = T.shift_report_photos.find((x) => x.id === p_photo); needEdit(ph.report_id); T.shift_report_photos = T.shift_report_photos.filter((x) => x !== ph); return ph.path; },
    app_ca_check({ p_id, p_item, p_on }) {
      const r = rep(p_id); if (r.status !== 'hoan_thanh') throw new Error('Nhân viên chưa hoàn thành phiếu này.');
      T.shift_report_checks = T.shift_report_checks.filter((c) => !(c.report_id === p_id && c.item === p_item));
      if (p_on) T.shift_report_checks.push({ report_id: p_id, item: p_item, checked_by: me.account_id, checked_at: now() });
      const n = T.shift_report_checks.filter((c) => c.report_id === p_id).length;
      Object.assign(r, n >= ITEMS.length ? { recon_status: 'hoan_thanh', recon_by: me.account_id, recon_at: now() } : { recon_status: 'chua', recon_by: null, recon_at: null });
    },
    app_ca_reopen({ p_id }) { const r = rep(p_id); Object.assign(r, { status: 'dang_chot', recon_status: 'chua', completed_at: null, completed_by: null }); T.shift_report_checks = T.shift_report_checks.filter((c) => c.report_id !== p_id); },
    app_ca_day({ p_date }) {
      return T.branches.filter((b) => b.status === 'Đang hoạt động').map((b) => {
        const rs = T.shift_reports.filter((r) => r.branch_id === b.id && r.work_date === p_date).sort((a, c) => shifts().indexOf(a.shift) - shifts().indexOf(c.shift));
        const dn = rs.filter((r) => r.status === 'hoan_thanh'); const c = T.daily_cash_closings.find((x) => x.branch_id === b.id && x.work_date === p_date) || {};
        return { branch_id: b.id, branch_code: b.display_code || b.code, branch_name: b.name, shifts: T.branch_shifts.filter((x) => x.branch_id === b.id && x.enabled).length, done: dn.length,
          opening: rs[0]?.opening_cash ?? null, pos_cash: dn.length ? dn.reduce((a, r) => a + r.pos_cash, 0) : null,
          moves_cash: dn.reduce((a, r) => a + sumMoves(r.id, 'tien_mat'), 0), last_counted: dn.at(-1)?.cash_counted ?? null, last_shift: dn.at(-1)?.shift ?? null,
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
