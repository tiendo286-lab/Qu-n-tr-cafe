// Giả lập bước 39: nghỉ & làm thay (app_cv_*), thực tế trên lịch, bảng công, công của tôi — chỉ để chạy thử giao diện
export function makeCv(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  T.shift_covers = T.shift_covers || []; T.cover_reviews = T.cover_reviews || {};
  // 1 người "trả lương tiền mặt" để thử
  { const e = T.employees.find((x) => x.status === 'Đang làm' && x.id > 10); if (e) e.pay_cash = true; }
  const emp = (id) => T.employees.find((e) => e.id === id) || { code: '?', name: '?' };
  const hrs = (a, b) => { if (!a || !b) return 0; const m = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5)); return Math.round((((m(b) - m(a)) + 1440) % 1440) / 60 * 100) / 100; };
  const LBL = { tu_tim: 'Tự tìm người thay', nho_ql: 'Nhờ quản lý tìm người', ma_chay: 'Ma chay tứ thân phụ mẫu', thieu_lich: 'Quản lý không xếp đủ lịch' };
  const people = (id) => (T.__eff(id).staff || []).filter((s) => (s.source === 'lich' && !s.worked) || (s.source === 'ho_tro' && s.worked))
    .map((s) => ({ employee_id: s.employee_id, kind: s.worked ? 'ho_tro' : 'nghi', hours: hrs(s.time_in, s.time_out), code: emp(s.employee_id).code, name: emp(s.employee_id).name, pay_cash: !!emp(s.employee_id).pay_cash }));
  const state = (id) => {
    const P = people(id); if (!P.length) return 'khong_can';
    const rows = T.shift_covers.filter((c) => c.report_id === id); if (!rows.length) return 'chua_phan_loai';
    const na = P.filter((p) => p.kind === 'nghi').map((p) => p.employee_id).sort().join(); const nh = P.filter((p) => p.kind === 'ho_tro').map((p) => p.employee_id).sort().join();
    if (na !== rows.filter((r) => r.absent_id).map((r) => r.absent_id).sort().join() || nh !== rows.filter((r) => r.helper_id).map((r) => r.helper_id).sort().join()) return 'lech';
    return T.cover_reviews[id]?.ok_at ? 'da_duyet' : 'cho_duyet';
  };
  const js = (c) => ({ ...c, reason_label: LBL[c.reason], absent: c.absent_id ? `${emp(c.absent_id).code} – ${emp(c.absent_id).name}` : null,
    helper: c.helper_id ? `${emp(c.helper_id).code} – ${emp(c.helper_id).name}` : c.helper_name, outsider: !c.helper_id && !!c.helper_name });
  const write = (id, items) => {
    const P = people(id);
    for (const p of P.filter((x) => x.kind === 'nghi')) if (!items.some((i) => i.absent_id === p.employee_id && i.reason)) throw new Error('Còn người nghỉ chưa chọn lý do.');
    for (const p of P.filter((x) => x.kind === 'ho_tro')) if (!items.some((i) => i.helper_id === p.employee_id)) throw new Error('Còn người hỗ trợ chưa gắn vào dòng nào.');
    T.shift_covers = T.shift_covers.filter((c) => c.report_id !== id).concat(items.map((i, k) => { const h = Number(i.hours ?? (P.find((p) => p.employee_id === i.helper_id) || {}).hours ?? 0);
      return { id: Date.now() + k, report_id: id, absent_id: i.absent_id || null, reason: i.reason, helper_id: i.helper_id || null, helper_name: i.helper_id ? null : i.helper_name || null, hours: h, x2: !!i.x2, deduct_hours: i.reason === 'nho_ql' ? h : 0 }; }));
  };
  const isOwner = me.role === 'chu'; const canCls = ['chu', 'ql_tong'].includes(me.role);
  T.account_perms = T.account_perms || [];
  return {
    app_account_perms: () => T.account_perms.map((x) => ({ ...x, granted_by: 'Chủ' })),
    app_set_account_perm({ p_account, p_perm, p_on }) {
      if (me.role !== 'chu') throw new Error('Bạn không có quyền thực hiện thao tác này.');
      T.account_perms = T.account_perms.filter((x) => !(x.account_id === p_account && x.perm === p_perm));
      if (p_on) T.account_perms.push({ account_id: p_account, perm: p_perm, granted_at: now() });
    },
    app_cv_get({ p_id }) {
      const r = T.shift_reports.find((x) => x.id === p_id); const rv = T.cover_reviews[p_id] || {};
      return { state: state(p_id), can_classify: canCls, is_owner: isOwner, open: true, recon_status: r.recon_status, people: people(p_id),
        rows: T.shift_covers.filter((c) => c.report_id === p_id).map(js), set_by: rv.set_at ? me.name : null, set_at: rv.set_at || null, ok_by: rv.ok_at ? 'admin – Chủ' : null, ok_at: rv.ok_at || null, ok_note: rv.ok_note || null };
    },
    app_cv_save({ p_id, p_items }) { if (!canCls) throw new Error('Chỉ Quản lý tổng / Chủ phân loại nghỉ và làm thay.'); write(p_id, p_items); T.cover_reviews[p_id] = { set_at: now() }; return state(p_id); },
    app_cv_approve({ p_id, p_items, p_note }) {
      if (!isOwner) throw new Error('Chỉ Chủ duyệt nghỉ / làm thay.');
      if (p_items) write(p_id, p_items);
      T.cover_reviews[p_id] = { ...(T.cover_reviews[p_id] || {}), set_at: now(), ok_at: now(), ok_note: p_note || null };
      return state(p_id);
    },
    app_cv_complain({ p_cover, p_text }) { const c = T.shift_covers.find((x) => x.id === p_cover); if (!String(p_text || '').trim()) throw new Error('Nhập nội dung khiếu nại.'); if (c.absent_id === me.employee_id) c.complaint_absent = p_text; else c.complaint_helper = p_text; c.resolved_at = null; },
    app_cv_resolve({ p_cover, p_x2, p_deduct, p_note }) { const c = T.shift_covers.find((x) => x.id === p_cover); if (p_x2 !== null && p_x2 !== undefined) c.x2 = p_x2; if (p_deduct !== null && p_deduct !== undefined) c.deduct_hours = p_deduct; c.resolved_at = now(); c.resolve_note = p_note || null; },
    app_lich_thuc_te({ p_from, p_to, p_branch }) {
      return T.shift_reports.filter((r) => r.status === 'hoan_thanh' && r.work_date >= p_from && r.work_date <= p_to && (!p_branch || r.branch_id === p_branch))
        .flatMap((r) => (T.__eff(r.id).staff || []).map((s) => ({ report_id: r.id, date: r.work_date, shift: r.shift, branch_id: r.branch_id, employee_id: s.employee_id, code: emp(s.employee_id).code, name: emp(s.employee_id).name,
          pay_cash: !!emp(s.employee_id).pay_cash, source: s.source, worked: !!s.worked, time_in: s.time_in, time_out: s.time_out, hours: hrs(s.time_in, s.time_out), official: T.__checks(r.id).includes('nhan_su'), reason: null, x2: null })));
    },
    app_bang_cong({ p_month }) {
      const reps = T.shift_reports.filter((r) => r.status === 'hoan_thanh' && r.work_date.startsWith(p_month));
      const by = {};
      reps.forEach((r) => (T.__eff(r.id).staff || []).forEach((s) => { const e = emp(s.employee_id); const x = by[s.employee_id] ||= { employee_id: e.id, code: e.code, name: e.name, rank: e.rank, status: e.status, pay_cash: !!e.pay_cash, shifts: 0, hours: 0, pending: 0, cash_paid: 0, absent: 0, x2_hours: 0, deduct_hours: 0 };
        if (s.worked) { x.shifts++; x.hours += hrs(s.time_in, s.time_out); x.cash_paid += Number(s.cash_paid || 0); if (!T.__checks(r.id).includes('nhan_su')) x.pending++; } else x.absent++; }));
      const covers = T.shift_covers.filter((c) => reps.some((r) => r.id === c.report_id)).map((c) => { const r = T.shift_reports.find((x) => x.id === c.report_id); return { ...js(c), date: r.work_date, shift: r.shift, branch: 'LHP', approved: !!T.cover_reviews[c.report_id]?.ok_at, open: true }; });
      covers.filter((c) => c.approved).forEach((c) => { if (c.helper_id && c.x2 && by[c.helper_id]) by[c.helper_id].x2_hours += c.hours; if (c.absent_id && by[c.absent_id]) by[c.absent_id].deduct_hours += c.deduct_hours; });
      return { month: p_month, can_resolve: canCls, is_owner: isOwner, rows: Object.values(by), covers };
    },
    app_cong_mine({ p_month }) {
      const m = p_month || now().slice(0, 7);
      const reps = T.shift_reports.filter((r) => r.status === 'hoan_thanh' && r.work_date.startsWith(m));
      return { month: m,
        shifts: reps.flatMap((r) => (T.__eff(r.id).staff || []).filter((s) => s.employee_id === me.employee_id).map((s) => ({ date: r.work_date, shift: r.shift, branch: 'LHP', worked: !!s.worked, source: s.source, time_in: s.time_in, time_out: s.time_out, hours: hrs(s.time_in, s.time_out), official: T.__checks(r.id).includes('nhan_su') }))),
        covers: T.shift_covers.filter((c) => (c.absent_id === me.employee_id || c.helper_id === me.employee_id) && T.cover_reviews[c.report_id]?.ok_at)
          .map((c) => { const r = T.shift_reports.find((x) => x.id === c.report_id); return { ...js(c), date: r.work_date, shift: r.shift, branch: 'LHP', me_absent: c.absent_id === me.employee_id }; }) };
    },
  };
}
