// Giả lập app_dt_* (Đào tạo) — chỉ để chạy thử giao diện. Có sẵn 1 phiếu cho nhân viên id 3 (người hướng dẫn: id 5).
const PROG = await (await fetch(new URL('./dt_program.json', import.meta.url))).json();
export function makeDt(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = now().slice(0, 10);
  T.trainings = [{ id: 1, employee_id: 3, program_id: 1, branch_id: 1, start_date: today, instructor_id: 5, manager_id: 1 }];
  T.training_marks = [{ training_id: 1, item_no: 1, introduced: true, practiced: true, level: 'tot', by_account: 1, at: now() }, { training_id: 1, item_no: 2, introduced: true, practiced: false, level: null }];
  T.training_days = [];
  const total = PROG.items.length;
  const params = new URLSearchParams(location.search);
  const workflow = ['flow_dt137', 'flow_dt169', 'flow_dt170'].includes(params.get('script')) || params.get('dtwork') === '1';
  let reviewer = Number(params.get('dtptc')) || null;   // bước 169: ?dtptc=<tài khoản> = người phụ trách chính có sẵn
  const extras = [];
  const part = (t) => extras.filter((f) => f.training_id === t.id);
  const dayFromStart = (t, days) => new Date(Date.parse(t.start_date) + days * 864e5).toISOString().slice(0, 10);
  const due = (t) => dayFromStart(t, 12);
  const tr = (id) => { const t = T.trainings.find((x) => x.id === id); if (!t) throw new Error('Không tìm thấy phiếu đào tạo.'); return t; };
  const ach = (t) => T.training_marks.filter((m) => m.training_id === t.id && m.level && !m.cho_kiem_tra).length;   // bước 169: Chờ kiểm tra chưa tính đạt
  // bước 169 (tệp 148): vai trên phiếu — HD chính, người phụ trách chính (PTC); giao: HDC + PTC + Chủ; xác nhận đạt: HDC + PTC
  const isHdc = (t) => me.employee_id != null && me.employee_id === t.instructor_id;
  const isPtc = () => reviewer != null && me.account_id === reviewer;
  const canAssign = (t) => me.role === 'chu' || isPtc() || isHdc(t);
  const canCheck = (t) => isPtc() || isHdc(t);
  const accName = (id) => ({ 1: 'admin – Chủ', 5: 'NV05 – Người hướng dẫn thử', 7: 'ketoan – Kế toán thử', 9: 'NV07 – Nhân viên cấp 1 thử', 10: 'NV08 – Quản lý khác thử' }[id] || (id ? 'TK ' + id : null));
  const status = (t) => (workflow && part(t).some((f) => f.is_extra && !f.finished_at) ? 'dao_tao_bo_sung'
    : ach(t) >= total ? workflow && !t.workflow_review_at ? 'cho_nhan_xet' : 'hoan_thanh' : today >= dayFromStart(t, 8) || t.cont_trainer_kind ? 'dao_tao_tiep' : 'dang_dao_tao');
  const emp = (id) => T.employees.find((e) => e.id === id);
  // bước 170: bài flow_dt170 — lịch đã công bố quanh hôm nay (NV mới 3; Cấp 1 NV07 trùng 2 ca; NV09 Cấp 1 cơ sở 1 không trùng ca)
  if (params.get('script') === 'flow_dt170') {
    if (!T.employees.some((e) => e.id === 9)) T.employees.push({ id: 9, code: 'NV09', name: 'Cấp 1 cơ sở thử', rank: 'Cấp 1', status: 'Đang làm' });
    T.employee_branches = T.employee_branches || []; T.employee_branches.push({ employee_id: 9, branch_id: 1 });
    T.weeks = T.weeks || []; const wid = 9170; T.weeks.push({ id: wid, start_date: today, end_date: today });
    T.schedule_published = T.schedule_published || [];
    [[3, 0, 'Sáng', 1], [3, 1, 'Sáng', 1], [3, 2, 'Chiều', 1], [3, 3, 'Sáng', 2], [7, 1, 'Sáng', 1], [7, 2, 'Chiều', 1], [9, 4, 'Tối', 1]]
      .forEach(([e, d, sh, b]) => T.schedule_published.push({ week_id: wid, employee_id: e, weekday: d, shift: sh, branch_id: b, role: 'phuc_vu', published_at: now() }));
  }
  // tệp 122: người hướng dẫn chính phải là nhân viên cấp Quản lý đang làm
  const mainGuide = (id) => { if (!id) throw new Error('Chọn người hướng dẫn chính (nhân viên cấp Quản lý).'); const e = emp(Number(id)); if (!e || e.rank !== 'Quản lý' || e.status !== 'Đang làm') throw new Error('Người hướng dẫn chính phải là nhân viên cấp Quản lý đang làm.'); };
  const canEdit = (t) => !!me.perms.dao_tao || [t.instructor_id, t.cont_trainer_id].includes(me.employee_id);
  const sum = (t) => ({ id: t.id, employee_id: t.employee_id, start_date: t.start_date, branch_id: t.branch_id, branch: (T.branches.find((b) => b.id === t.branch_id) || {}).code,
    instructor: t.instructor_id ? `${emp(t.instructor_id).code} – ${emp(t.instructor_id).name}` : null, manager: t.manager_id ? 'admin – Chủ' : null,
    achieved: ach(t), total, status: status(t), n_check: T.training_marks.filter((m) => m.training_id === t.id && m.level && m.cho_kiem_tra).length,
    missing: PROG.items.filter((i) => !T.training_marks.some((m) => m.training_id === t.id && m.item_no === i.no && m.level && !m.cho_kiem_tra)).map((i) => i.no) });
  return {
    app_dt_work_list: ({ p_mine } = {}) => ({ today, reviewer: reviewer ? 'Người nhận xét thử' : null, reviewer_id: reviewer,
      accounts: me.role === 'chu' ? [{ id: 1, name: 'Người nhận xét thử' }] : null,
      rows: T.trainings.filter((t) => !p_mine || (workflow && status(t) !== 'hoan_thanh')).map((t) => ({
        ...sum(t), program: 'chay_ban', due: due(t), employee: emp(t.employee_id).name,
        my_duties: [...(me.account_id === reviewer ? ['Kiểm tra và nhận xét'] : []), ...(isHdc(t) ? ['Hướng dẫn'] : [])],
      })) }),
    app_dt_reviewer_save({ p_account }) { if (me.role !== 'chu') throw new Error('Chỉ Chủ được chọn.'); reviewer = p_account; },
    app_dt_followup_save({ p_id, p_no, p_employee, p_note, p_extra = true, p_branch = null }) {
      if (!(p_employee == null && p_extra) && !canAssign(tr(p_id))) throw new Error('Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.');
      const next = { training_id: p_id, no: p_no, note: p_note, employee_id: p_employee, name: emp(p_employee)?.name, is_extra: p_extra, finished_at: null };
      const current = part(tr(p_id)).find((f) => f.no === p_no);
      if (current && !p_extra && current.is_extra && current.finished_at) next.phase2_done_at = current.finished_at;   // giữ dấu Đã đánh giá giai đoạn 2
      next.branch_id = p_extra && !p_branch ? current?.branch_id : p_branch;
      next.branch = T.branches.find((b) => b.id === next.branch_id)?.code;
      if (current) Object.assign(current, next);
      else extras.push(next);
    },
    app_dt_work_action({ p_id, p_action, p_note }) {
      const t = tr(p_id);
      if (me.account_id !== reviewer) throw new Error('Chỉ người nhận xét được thao tác.');
      if (p_action === 'review') {
        if (today < dayFromStart(t, 8)) throw new Error('Chưa đến mốc 8 ngày để hoàn thành phiếu.');
        if (status(t) !== 'cho_nhan_xet') throw new Error('Chưa đủ hạng mục.');
        t.workflow_review = p_note;
        t.workflow_review_at = now();
      }
    },
    // bước 169: dựng tình huống cho bài thử theo vai (bỏ qua kiểm quyền)
    app__test_dt_assign({ p_no, p_employee }) { const t = tr(1); const cur = part(t).find((f) => f.no === p_no); const nx = { training_id: 1, no: p_no, employee_id: p_employee, name: emp(p_employee)?.name, is_extra: false, finished_at: null };
      if (cur) Object.assign(cur, nx); else extras.push(nx); },
    app__test_dt_pending({ p_no, p_level }) { let m = T.training_marks.find((x) => x.training_id === 1 && x.item_no === p_no); if (!m) T.training_marks.push(m = { training_id: 1, item_no: p_no });
      Object.assign(m, { introduced: true, practiced: true, level: p_level, cho_kiem_tra: true, cho_by: 9, cho_at: now(), by_account: 9, at: now() }); },
    app__test_dt_fill() {
      const t = tr(1);
      for (const i of PROG.items) if (!T.training_marks.some((m) => m.training_id === t.id && m.item_no === i.no && m.level)) {
        const existing = T.training_marks.find((m) => m.training_id === t.id && m.item_no === i.no);
        const fields = { training_id: t.id, item_no: i.no, introduced: true, practiced: true, level: 'tot' };
        if (existing) Object.assign(existing, fields);
        else T.training_marks.push(fields);
      }
    },
    app_dt_list: () => T.employees.filter((e) => e.status === 'Đang làm').map((e) => ({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank,
      branches: T.employee_branches.filter((x) => x.employee_id === e.id).map((x) => (T.branches.find((b) => b.id === x.branch_id) || {}).code),
      roles: T.employee_roles.filter((x) => x.employee_id === e.id).map((x) => x.role), training: (() => { const t = T.trainings.find((x) => x.employee_id === e.id); return t ? sum(t) : null; })() })),
    app_dt_staff_status: () => T.trainings.map(sum),
    app_dt_options: () => ({ employees: T.employees.filter((e) => e.status === 'Đang làm').map(({ id, code, name, rank }) => ({ id, code, name, rank })), managers: [{ id: 1, name: 'admin – Chủ' }], branches: T.branches.map((b) => ({ id: b.id, code: b.code })) }),
    app_dt_create({ p_employee, p }) {
      if (T.trainings.some((t) => t.employee_id === p_employee)) throw new Error('Nhân viên này đã có phiếu đào tạo chạy bàn.');
      mainGuide(p.instructor_id);
      const id = Math.max(0, ...T.trainings.map((t) => t.id)) + 1; T.trainings.push({ id, employee_id: p_employee, program_id: 1, branch_id: Number(p.branch_id) || null, start_date: p.start_date, instructor_id: p.instructor_id, manager_id: Number(p.manager_id) || null }); return id;
    },
    app_dt_instructor_save({ p_id, p_employee }) {
      const t = tr(p_id); if (!isPtc() && !me.perms.dao_tao) throw new Error('Chỉ người phụ trách chính đào tạo được đổi người hướng dẫn chính.');
      mainGuide(p_employee); t.instructor_id = Number(p_employee);
    },
    app_dt_check_ok({ p_id, p_no, p_level }) {
      const t = tr(p_id); if (!canCheck(t)) throw new Error('Chỉ người hướng dẫn chính của phiếu hoặc người phụ trách chính đào tạo được xác nhận đạt.');
      const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === p_no);
      if (!m || !m.cho_kiem_tra || !m.level) throw new Error('Hạng mục này không chờ kiểm tra.');
      Object.assign(m, { level: p_level || m.level, cho_kiem_tra: false, checked_by: me.account_id, checked_at: now() });
      return { achieved: ach(t), status: status(t), level: m.level };
    },
    // bước 170 (tệp 149): tab Phân công + Chờ kiểm tra
    app_dt_assign_board({ p_program }) {
      const allOpen = me.role === 'chu' || isPtc();
      const vis = T.trainings.filter((t) => status(t) !== 'hoan_thanh' && (allOpen || isHdc(t)));
      if (!allOpen && !vis.length) return { can_board: false, rows: [] };
      if (p_program === 'pha_che') return { can_board: true, all: allOpen, rows: [] };
      const addD = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
      const pubOf = (eid) => (T.schedule_published || []).filter((s) => s.employee_id === eid).map((s) => { const w = (T.weeks || []).find((x) => x.id === s.week_id); return w ? { date: addD(w.start_date, s.weekday), branch_id: s.branch_id, shift: s.shift } : null; }).filter(Boolean);
      const bcode = (id) => (T.branches.find((b) => b.id === id) || {}).code || null;
      const nm = (e) => `${e.code} – ${e.name}`;
      return { can_board: true, all: allOpen, today, rows: vis.map((t) => {
        const ss = pubOf(t.employee_id).filter((x) => x.date >= t.start_date && x.date <= due(t)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        const cnt = {}; ss.forEach((x) => { cnt[x.branch_id] = (cnt[x.branch_id] || 0) + 1; });
        const best = Number(Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a - b)[0]) || t.branch_id;
        const keys = new Set(ss.map((x) => `${x.date}|${x.branch_id}|${x.shift}`));
        const okP = T.employees.filter((e) => e.status === 'Đang làm' && e.id !== t.employee_id && (e.id === t.instructor_id || ['Cấp 1', 'Quản lý'].includes(e.rank)));
        const same = okP.filter((e) => e.rank === 'Cấp 1').map((e) => ({ id: e.id, name: nm(e), n: pubOf(e.id).filter((x) => keys.has(`${x.date}|${x.branch_id}|${x.shift}`)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
        const brc = okP.filter((e) => e.rank === 'Cấp 1' && !same.some((x) => x.id === e.id) && (T.employee_branches || []).some((x) => x.employee_id === e.id && x.branch_id === best)).map((e) => ({ id: e.id, name: nm(e) }));
        const other = okP.filter((e) => !same.some((x) => x.id === e.id) && !brc.some((x) => x.id === e.id)).map((e) => ({ id: e.id, name: nm(e), hdc: e.id === t.instructor_id }));
        const items = PROG.items.filter((i) => { const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === i.no); return !m || !m.level || m.cho_kiem_tra; }).map((i) => {
          const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === i.no) || {}; const f = part(t).find((x) => x.no === i.no) || {};
          const kt = !!(m.cho_kiem_tra && m.level); const fe = f.employee_id || null; const who = emp(fe || t.instructor_id);
          return { no: i.no, day: i.day, title: i.title, level: m.level || null, state: kt ? 'cho_kt' : fe && fe !== t.instructor_id ? 'dang_giao' : 'chua_giao',
            who_id: fe || t.instructor_id, who: who ? nm(who) : null, who_rank: who?.rank || null, branch_id: f.branch_id || t.branch_id, branch: bcode(f.branch_id || t.branch_id),
            phase2: !!(f.is_extra && !f.finished_at), pending_by: kt ? accName(m.cho_by) : null, pending_at: kt ? m.cho_at : null };
        });
        return { id: t.id, employee: nm(emp(t.employee_id)), start_date: t.start_date, due: due(t), branch_id: t.branch_id, branch: bcode(t.branch_id), instructor_id: t.instructor_id,
          instructor: emp(t.instructor_id) ? nm(emp(t.instructor_id)) : null, achieved: ach(t), total, sched: ss.map((x) => ({ ...x, branch: bcode(x.branch_id) })), best_branch: best,
          same, br_c1: brc, other, items, n_chua: items.filter((x) => x.state === 'chua_giao').length, n_kt: items.filter((x) => x.state === 'cho_kt').length,
          n_dang: items.filter((x) => x.state === 'dang_giao').length, can_check: canCheck(t) };
      }) };
    },
    app_dt_assign_bulk({ p_id, p_items, p_employee, p_branch, p_note }) {
      const t = tr(p_id); if (!canAssign(t)) throw new Error('Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.');
      if (!p_items?.length) throw new Error('Chọn ít nhất 1 hạng mục.');
      let changed = 0;
      [...new Set(p_items)].forEach((no) => { const cur = part(t).find((f) => f.no === no); const before = cur?.employee_id || t.instructor_id;
        const nx = { training_id: t.id, no, employee_id: p_employee, name: emp(p_employee)?.name, note: p_note || cur?.note || null, is_extra: !!(cur?.is_extra && !cur?.finished_at), finished_at: null, branch_id: p_employee ? p_branch : null };
        nx.branch = T.branches.find((b) => b.id === nx.branch_id)?.code;
        if (cur) Object.assign(cur, nx); else extras.push(nx);
        if ((p_employee || t.instructor_id) !== before) changed += 1; });
      window.__DT_BULK = (window.__DT_BULK || []).concat([{ p_id, p_items, p_employee, p_branch, p_note }]);   // bài thử đếm số lần gọi (1 lần lưu)
      return { n: new Set(p_items).size, changed };
    },
    app_dt_get({ p_id }) {
      const t = tr(p_id);
      return { ...t, ...sum(t), program: { name: 'Nhân viên chạy bàn 8 ngày', days: PROG.days }, employee: { code: emp(t.employee_id).code, name: emp(t.employee_id).name, rank: emp(t.employee_id).rank },
        items: PROG.items.map((i) => { const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === i.no) || {}; return { ...i, introduced: !!m.introduced, practiced: !!m.practiced, level: m.level || null, by: m.at ? (accName(m.by_account) || 'admin – Chủ') : null, at: m.at || null,
          pending: !!(m.cho_kiem_tra && m.level), pending_by: m.cho_kiem_tra ? accName(m.cho_by) : null, pending_at: m.cho_kiem_tra ? m.cho_at : null }; }),
        can_check: canCheck(t), is_ptc: isPtc(), is_hdc: isHdc(t), ptc: reviewer ? accName(reviewer) : null, can_pick_hdc: isPtc() || !!me.perms.dao_tao,
        hdc_choices: isPtc() || me.perms.dao_tao ? T.employees.filter((e) => e.rank === 'Quản lý' && e.status === 'Đang làm' && e.id !== t.employee_id).map(({ id, code, name }) => ({ id, code, name })) : null,
        days_log: Object.fromEntries(T.training_days.filter((d) => d.training_id === t.id).map((d) => [d.day, d])), tasks: [],
        ...(workflow ? { due: due(t), today, review_from: dayFromStart(t, 8), followups: part(t).map((f) => ({ ...f, mine: f.employee_id != null && f.employee_id === me.employee_id })), can_review: me.account_id === reviewer,
          can_assign: canAssign(t), item_branches: canAssign(t) ? T.branches : null, helpers: canAssign(t) ? T.employees.filter((e) => e.id !== t.employee_id && (e.id === t.instructor_id || ['Cấp 1', 'Quản lý'].includes(e.rank))).map((e) => ({ id: e.id, name: `${e.code} – ${e.name}` })) : null } : {}),
        can_edit: canEdit(t), can_admin: !!me.perms.dao_tao, is_trainee: me.employee_id === t.employee_id };
    },
    app_dt_update({ p_id, p }) { const t = tr(p_id); if (!canEdit(t)) throw new Error('Bạn không có quyền.'); if ('instructor_id' in p && p.instructor_id !== t.instructor_id) mainGuide(p.instructor_id); Object.assign(t, p); },
    app_dt_mark({ p_id, p_no, p }) {
      const t = tr(p_id);
      const mine = part(t).find((f) => f.no === p_no && f.employee_id === me.employee_id && (!f.is_extra || !f.finished_at));
      if (!canEdit(t) && !mine) throw new Error('Bạn chỉ được cập nhật hạng mục được giao.');
      let m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === p_no); if (!m) { m = { training_id: t.id, item_no: p_no, introduced: false, practiced: false, level: null }; T.training_marks.push(m); }
      const n = { ...m, ...p };
      if (workflow && n.practiced && !n.level && (!m.practiced || m.level)) throw new Error('Chọn mức đạt khi đánh dấu đã thực hành.');
      if (n.practiced && !n.introduced) throw new Error(`Hạng mục ${p_no} phải “Đã giới thiệu” trước.`);
      if (n.level && !(n.introduced && n.practiced)) throw new Error(`Hạng mục ${p_no} phải đủ 2 bước rồi mới đánh giá mức đạt.`);
      // bước 169: Cấp 1 ghi mức đạt → Chờ kiểm tra; HDC / PTC tự ghi thì khỏi kiểm
      const cap1 = !canCheck(t) && emp(me.employee_id)?.rank === 'Cấp 1';
      const pend = !!n.level && cap1;
      Object.assign(m, n, { at: now(), by_account: me.account_id,
        cho_kiem_tra: !n.level ? false : canCheck(t) ? false : pend || !!m.cho_kiem_tra, cho_by: pend ? me.account_id : m.cho_by, cho_at: pend ? now() : m.cho_at });
      const followup = part(t).find((f) => f.no === p_no && f.employee_id);
      if (followup && p.level) followup.finished_at = now();
      return { by: `${me.code} – ${me.name}`, at: now(), achieved: ach(t), status: status(t), pending: !!m.cho_kiem_tra };
    },
    app_dt_day_comment({ p_id, p_day, p_comment }) { let d = T.training_days.find((x) => x.training_id === p_id && x.day === p_day); if (!d) T.training_days.push(d = { training_id: p_id, day: p_day }); d.comment = p_comment; },
    app_dt_day_confirm({ p_id, p_day, p_who, p_on }) {
      const t = tr(p_id);
      if (p_who === 'nv' && me.employee_id !== t.employee_id) throw new Error('Chỉ chính nhân viên được đào tạo mới xác nhận.');
      if (p_who === 'hd' && !canEdit(t)) throw new Error('Chỉ người hướng dẫn mới xác nhận.');
      let d = T.training_days.find((x) => x.training_id === p_id && x.day === p_day); if (!d) T.training_days.push(d = { training_id: p_id, day: p_day });
      d[p_who === 'nv' ? 'trainee_at' : 'instructor_at'] = p_on ? now() : null;
    },
    app_dt_delete({ p_id }) { T.trainings = T.trainings.filter((t) => t.id !== p_id); },
    app_dt_mine: () => T.trainings.filter((t) => [t.employee_id, t.instructor_id].includes(me.employee_id) || t.manager_id === me.account_id)
      .map((t) => ({ ...sum(t), employee: `${emp(t.employee_id).code} – ${emp(t.employee_id).name}`, role: t.employee_id === me.employee_id ? 'hoc' : t.manager_id === me.account_id ? 'quan_ly' : 'huong_dan' })),
  };
}
