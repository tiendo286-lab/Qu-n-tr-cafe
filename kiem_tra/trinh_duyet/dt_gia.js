// Giả lập app_dt_* (Đào tạo) — chỉ để chạy thử giao diện. Có sẵn 1 phiếu cho nhân viên id 3 (người hướng dẫn: id 5).
const PROG = await (await fetch(new URL('./dt_program.json', import.meta.url))).json();
export function makeDt(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = now().slice(0, 10);
  T.trainings = [{ id: 1, employee_id: 3, program_id: 1, branch_id: 1, start_date: today, instructor_id: 5, manager_id: 1 }];
  T.training_marks = [{ training_id: 1, item_no: 1, introduced: true, practiced: true, level: 'tot', by_account: 1, at: now() }, { training_id: 1, item_no: 2, introduced: true, practiced: false, level: null }];
  T.training_days = [];
  const total = PROG.items.length;
  const tr = (id) => { const t = T.trainings.find((x) => x.id === id); if (!t) throw new Error('Không tìm thấy phiếu đào tạo.'); return t; };
  const ach = (t) => T.training_marks.filter((m) => m.training_id === t.id && m.level).length;
  const status = (t) => (ach(t) >= total ? 'hoan_thanh' : today >= new Date(Date.parse(t.start_date) + 8 * 864e5).toISOString().slice(0, 10) || t.cont_trainer_kind ? 'dao_tao_tiep' : 'dang_dao_tao');
  const emp = (id) => T.employees.find((e) => e.id === id);
  const canEdit = (t) => !!me.perms.dao_tao || [t.instructor_id, t.cont_trainer_id].includes(me.employee_id);
  const sum = (t) => ({ id: t.id, employee_id: t.employee_id, start_date: t.start_date, branch_id: t.branch_id, branch: (T.branches.find((b) => b.id === t.branch_id) || {}).code,
    instructor: t.instructor_id ? `${emp(t.instructor_id).code} – ${emp(t.instructor_id).name}` : null, manager: t.manager_id ? 'admin – Chủ' : null,
    achieved: ach(t), total, status: status(t), missing: PROG.items.filter((i) => !T.training_marks.some((m) => m.training_id === t.id && m.item_no === i.no && m.level)).map((i) => i.no) });
  return {
    app_dt_list: () => T.employees.filter((e) => e.status === 'Đang làm').map((e) => ({ employee_id: e.id, code: e.code, name: e.name, rank: e.rank,
      branches: T.employee_branches.filter((x) => x.employee_id === e.id).map((x) => (T.branches.find((b) => b.id === x.branch_id) || {}).code),
      roles: T.employee_roles.filter((x) => x.employee_id === e.id).map((x) => x.role), training: (() => { const t = T.trainings.find((x) => x.employee_id === e.id); return t ? sum(t) : null; })() })),
    app_dt_staff_status: () => T.trainings.map(sum),
    app_dt_options: () => ({ employees: T.employees.filter((e) => e.status === 'Đang làm').map(({ id, code, name, rank }) => ({ id, code, name, rank })), managers: [{ id: 1, name: 'admin – Chủ' }], branches: T.branches.map((b) => ({ id: b.id, code: b.code })) }),
    app_dt_create({ p_employee, p }) {
      if (T.trainings.some((t) => t.employee_id === p_employee)) throw new Error('Nhân viên này đã có phiếu đào tạo chạy bàn.');
      const id = Math.max(0, ...T.trainings.map((t) => t.id)) + 1; T.trainings.push({ id, employee_id: p_employee, program_id: 1, branch_id: Number(p.branch_id) || null, start_date: p.start_date, instructor_id: p.instructor_id, manager_id: Number(p.manager_id) || null }); return id;
    },
    app_dt_get({ p_id }) {
      const t = tr(p_id);
      return { ...t, ...sum(t), program: { name: 'Nhân viên chạy bàn 8 ngày', days: PROG.days }, employee: { code: emp(t.employee_id).code, name: emp(t.employee_id).name, rank: emp(t.employee_id).rank },
        items: PROG.items.map((i) => { const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === i.no) || {}; return { ...i, introduced: !!m.introduced, practiced: !!m.practiced, level: m.level || null, by: m.at ? 'admin – Chủ' : null, at: m.at || null }; }),
        days_log: Object.fromEntries(T.training_days.filter((d) => d.training_id === t.id).map((d) => [d.day, d])), tasks: [],
        can_edit: canEdit(t), can_admin: !!me.perms.dao_tao, is_trainee: me.employee_id === t.employee_id };
    },
    app_dt_update({ p_id, p }) { const t = tr(p_id); if (!canEdit(t)) throw new Error('Bạn không có quyền.'); Object.assign(t, p); },
    app_dt_mark({ p_id, p_no, p }) {
      const t = tr(p_id); if (!canEdit(t)) throw new Error('Bạn không có quyền.');
      let m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === p_no); if (!m) { m = { training_id: t.id, item_no: p_no, introduced: false, practiced: false, level: null }; T.training_marks.push(m); }
      const n = { ...m, ...p };
      if (n.practiced && !n.introduced) throw new Error(`Hạng mục ${p_no} phải “Đã giới thiệu” trước.`);
      if (n.level && !(n.introduced && n.practiced)) throw new Error(`Hạng mục ${p_no} phải đủ 2 bước rồi mới đánh giá mức đạt.`);
      Object.assign(m, n, { at: now() }); return { by: `${me.code} – ${me.name}`, at: now(), achieved: ach(t), status: status(t) };
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
