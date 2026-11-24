// Giả lập app_dt_* (Đào tạo) — chỉ để chạy thử giao diện. Có sẵn 1 phiếu cho nhân viên id 3 (người hướng dẫn: id 5).
const PROG = await (await fetch(new URL('./dt_program.json', import.meta.url))).json();
export function makeDt(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const today = now().slice(0, 10);
  T.trainings = [{ id: 1, employee_id: 3, program_id: 1, branch_id: 1, start_date: today, instructor_id: 5, manager_id: 1 }];
  T.training_marks = [{ training_id: 1, item_no: 1, introduced: true, practiced: true, level: 'tot', by_account: 1, at: now() }, { training_id: 1, item_no: 2, introduced: true, practiced: false, level: null }];
  T.training_days = [];
  T.training_mark_log = []; T.training_day_notes = [];   // chặng 4 (tệp 163): sổ lịch sử + nhận xét theo ngày thật
  const total = PROG.items.length;
  const params = new URLSearchParams(location.search);
  const workflow = ['flow_dt137', 'flow_dt169', 'flow_dt170', 'flow_dt_c4', 'flow_pcdt'].includes(params.get('script')) || params.get('dtwork') === '1';
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
  // chặng 4 (tệp 163): ghi sổ lịch sử giống trigger training_marks_log — mỗi lần đổi thật thành 1 dòng; đào tạo lại luôn ghi
  let logId = 0;
  const meName = () => `${me.code} – ${me.name}`;
  const st3 = (m) => (m ? { introduced: !!m.introduced, practiced: !!m.practiced, level: m.level || null } : null);
  const logMark = (tid, no, o, n, { relearn = false, by = meName(), at = now(), kind = null, pending = false } = {}) => {
    const gd2 = extras.some((f) => f.training_id === tid && f.no === no && f.is_extra && f.employee_id);
    if (!kind) {
      if (o && o.introduced === n.introduced && o.practiced === n.practiced && o.level === n.level && !relearn) return;
      kind = relearn || (gd2 && o?.level && n.level) ? 'dao_tao_lai'
        : o && ((o.introduced && !n.introduced) || (o.practiced && !n.practiced) || (o.level && !n.level)) ? 'bo_tich'
          : n.level && n.level !== o?.level ? 'muc' : n.practiced && !o?.practiced ? 'thuc_hanh' : 'gioi_thieu';
    }
    T.training_mark_log.push({ id: ++logId, training_id: tid, no, at, day: at.slice(0, 10), by, kind, old: o, new: n, pending: !!pending, gd2, note: null });
  };
  const dayNote = (t, d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || !T.training_mark_log.some((l) => l.training_id === t.id && l.day === d)) throw new Error('Ngày này chưa có lần đào tạo nào trên phiếu.');
    let n = T.training_day_notes.find((x) => x.training_id === t.id && x.day === d); if (!n) T.training_day_notes.push(n = { training_id: t.id, day: d });
    return n;
  };
  T.training_marks.forEach((m) => logMark(m.training_id, m.item_no, null, st3(m), { by: 'admin – Chủ' }));   // phiếu có sẵn: dòng lịch sử hôm nay
  // bước 170: bài flow_dt170 — lịch đã công bố quanh hôm nay (NV mới 3; Cấp 1 NV07 trùng 2 ca; NV09 Cấp 1 cơ sở 1 không trùng ca)
  if (params.get('script') === 'flow_dt170') {
    if (!T.employees.some((e) => e.id === 9)) T.employees.push({ id: 9, code: 'NV09', name: 'Cấp 1 cơ sở thử', rank: 'Cấp 1', status: 'Đang làm' });
    T.employee_branches = T.employee_branches || []; T.employee_branches.push({ employee_id: 9, branch_id: 1 });
    T.weeks = T.weeks || []; const wid = 9170; T.weeks.push({ id: wid, start_date: today, end_date: today });
    T.schedule_published = T.schedule_published || [];
    [[3, 0, 'Sáng', 1], [3, 1, 'Sáng', 1], [3, 2, 'Chiều', 1], [3, 3, 'Sáng', 2], [7, 1, 'Sáng', 1], [7, 2, 'Chiều', 1], [9, 4, 'Tối', 1]]
      .forEach(([e, d, sh, b]) => T.schedule_published.push({ week_id: wid, employee_id: e, weekday: d, shift: sh, branch_id: b, role: 'phuc_vu', published_at: now() }));
  }
  // tệp 174: bài flow_pcdt — phân công theo ca. Phiếu 1 bắt đầu hôm kia; NV03 đi làm hôm kia Sáng · hôm qua Sáng · hôm nay Chiều · mai Sáng · ngày kia Tối;
  // NV07 (Cấp 1) hôm nay Chiều + mai Sáng; NV08 (Quản lý) mai Sáng. Phiếu 2 (NV04) không có lịch.
  const addD = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
  if (params.get('script') === 'flow_pcdt') {
    const d0 = addD(today, -2);
    T.trainings[0].start_date = d0;
    if (!T.employees.some((e) => e.id === 4)) T.employees.push({ id: 4, code: 'NV04', name: 'Người học thứ hai', rank: 'Thử việc', status: 'Đang làm' });
    T.trainings.push({ id: 2, employee_id: 4, program_id: 1, branch_id: 1, start_date: today, instructor_id: 5, manager_id: null });
    T.weeks = T.weeks || []; T.weeks.push({ id: 9174, start_date: d0, end_date: addD(d0, 6) });
    T.schedule_published = T.schedule_published || [];
    [[3, 0, 'Sáng'], [3, 1, 'Sáng'], [3, 2, 'Chiều'], [3, 3, 'Sáng'], [3, 4, 'Tối'], [7, 2, 'Chiều'], [7, 3, 'Sáng'], [8, 3, 'Sáng']]
      .forEach(([e, d, sh]) => T.schedule_published.push({ week_id: 9174, employee_id: e, weekday: d, shift: sh, branch_id: 1, role: 'phuc_vu', published_at: now() }));
    const y = addD(today, -1), m1 = addD(today, 1);
    const fx = (no, employee_id, date, shift, sub_by = null) => extras.push({ training_id: 1, no, employee_id, name: emp(employee_id)?.name, note: null, is_extra: false, finished_at: null, branch_id: 1, branch: 'TEST', date, shift, sub_by });
    fx(3, 5, y, 'Sáng'); fx(4, 5, y, 'Sáng'); [10, 11, 12].forEach((no) => fx(no, 8, m1, 'Sáng')); fx(13, 7, m1, 'Sáng', 8);
    T.training_marks.push({ training_id: 1, item_no: 3, introduced: true, practiced: true, level: 'tot', by_account: 5, at: y + ' 07:40:00' },
      { training_id: 1, item_no: 4, introduced: true, practiced: false, level: null, by_account: 5, at: y + ' 08:05:00' },
      { training_id: 1, item_no: 13, introduced: true, practiced: true, level: 'kha', by_account: 9, at: now(), cho_kiem_tra: true, cho_by: 9, cho_at: now() });
    logMark(1, 3, null, { introduced: true, practiced: false, level: null }, { by: 'NV05 – Người hướng dẫn thử', at: y + ' 07:20:00' });
    logMark(1, 3, { introduced: true, practiced: false, level: null }, { introduced: true, practiced: true, level: 'tot' }, { by: 'NV05 – Người hướng dẫn thử', at: y + ' 07:40:00' });
    logMark(1, 4, null, { introduced: true, practiced: false, level: null }, { by: 'NV05 – Người hướng dẫn thử', at: y + ' 08:05:00' });
    logMark(1, 13, null, { introduced: true, practiced: true, level: 'kha' }, { by: 'NV07 – Nhân viên cấp 1 thử', pending: true });
  }
  // tệp 174: hàm phụ của phân công theo ca
  const nmE = (e) => (e ? `${e.code} – ${e.name}` : null);
  const bcodeOf = (id) => (T.branches.find((b) => b.id === id) || {}).code || null;
  const pubAll = () => (T.schedule_published || []).map((s) => { const w = (T.weeks || []).find((x) => x.id === s.week_id); return w ? { emp: s.employee_id, date: addD(w.start_date, s.weekday), branch_id: s.branch_id, shift: s.shift } : null; }).filter(Boolean);
  const SH_ORD = (s) => ['Sáng', 'Chiều', 'Tối'].indexOf(s);
  const schedOf = (eid, from) => pubAll().filter((x) => x.emp === eid && x.date >= from).map(({ date, branch_id, shift }) => ({ date, branch_id, shift }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : SH_ORD(a.shift) - SH_ORD(b.shift)));
  const matesOf = (date, shift, br, except) => [...new Set(pubAll().filter((x) => x.date === date && x.shift === shift && x.branch_id === br && x.emp !== except).map((x) => x.emp))];
  const markOf = (tid, no) => T.training_marks.find((m) => m.training_id === tid && m.item_no === no);
  const stateOf = (m) => (!m ? 'chua' : m.level && m.cho_kiem_tra ? 'cho_kt' : m.level ? 'dat' : m.introduced ? 'gioi_thieu' : 'chua');
  const fuOf = (t, no) => extras.find((f) => f.training_id === t.id && f.no === no);
  const setFu = (t, no, patch) => { let f = fuOf(t, no); if (!f) extras.push(f = { training_id: t.id, no, employee_id: null, note: null, is_extra: false, finished_at: null, branch_id: null });
    Object.assign(f, patch); f.name = emp(f.employee_id)?.name || null; f.branch = bcodeOf(f.branch_id); return f; };
  const subGuard = (t, d, sh) => {
    if (emp(me.employee_id)?.rank !== 'Quản lý') throw new Error('Chỉ quản lý được giao lại cho Cấp 1.');
    if (!d || d < today) throw new Error('Ngày đã qua không giao lại được.');
    const mine = extras.filter((f) => f.training_id === t.id && f.date === d && f.shift === sh && ((f.employee_id === me.employee_id && !f.sub_by) || f.sub_by === me.employee_id));
    if (!mine.length) throw new Error('Bạn không có phần dạy ở ca này.');
    return mine;
  };
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
    app__test_dt_pending({ p_no, p_level }) { let m = T.training_marks.find((x) => x.training_id === 1 && x.item_no === p_no); const o = m ? st3(m) : null; if (!m) T.training_marks.push(m = { training_id: 1, item_no: p_no });
      Object.assign(m, { introduced: true, practiced: true, level: p_level, cho_kiem_tra: true, cho_by: 9, cho_at: now(), by_account: 9, at: now() });
      logMark(1, p_no, o, st3(m), { by: accName(9), pending: true }); },
    // chặng 4: dữ liệu mẫu để chụp ảnh cho anh duyệt — phiếu 1 có lịch sử 3 ngày thật (hôm kia, hôm qua, hôm nay)
    app__test_dt_demo() {
      const t = tr(1); const D = (k) => new Date(Date.now() + 7 * 3600e3 - k * 864e5).toISOString().slice(0, 10);
      const A = D(2), B = D(1), C = D(0); const HD = accName(5), C1 = accName(9), NV = 'NV03 – Người học thử';
      t.start_date = A; T.training_marks = []; T.training_mark_log = []; T.training_day_notes = [];
      const S = (i, p, l) => ({ introduced: i, practiced: p, level: l });
      const L = (no, day, hm, by, kind, o, n, pending = false) => T.training_mark_log.push({ id: ++logId, training_id: 1, no, at: `${day} ${hm}:00`, day, by, kind, old: o, new: n, pending, gd2: false, note: null });
      const I = S(true, false, null), O = S(false, false, null);
      [[1, '08:10', '08:25', 'tot'], [2, '08:15', '08:40', 'kha'], [3, '09:00', '09:20', 'tot'], [4, '09:05', '09:45', 'kha'], [5, '10:00', '10:30', 'tb']]
        .forEach(([no, a, b, lv]) => { L(no, A, a, HD, 'gioi_thieu', null, I); L(no, A, b, HD, 'muc', I, S(true, true, lv)); });
      L(6, A, '10:10', HD, 'gioi_thieu', null, I); L(6, B, '08:20', HD, 'muc', I, S(true, true, 'kha'));
      L(7, B, '08:30', HD, 'gioi_thieu', null, I); L(7, B, '09:00', HD, 'muc', I, S(true, true, 'tot'));
      L(8, B, '08:35', C1, 'gioi_thieu', null, I); L(8, B, '09:10', C1, 'muc', I, S(true, true, 'kha'), true); L(8, B, '14:00', HD, 'xac_nhan', S(true, true, 'kha'), S(true, true, 'kha'));
      L(9, B, '09:30', HD, 'gioi_thieu', null, I); L(9, B, '10:00', HD, 'muc', I, S(true, true, 'tb'));
      L(10, B, '10:15', C1, 'gioi_thieu', null, I); L(10, B, '10:40', C1, 'muc', I, S(true, true, 'kha'), true); L(10, C, '08:05', HD, 'xac_nhan', S(true, true, 'kha'), S(true, true, 'tot'));
      L(5, C, '08:30', HD, 'dao_tao_lai', S(true, true, 'tb'), S(true, true, 'kha'));
      L(11, C, '08:50', HD, 'gioi_thieu', null, I); L(12, C, '09:00', HD, 'gioi_thieu', null, I); L(12, C, '09:05', HD, 'bo_tich', I, O); L(12, C, '09:07', HD, 'gioi_thieu', O, I);
      L(13, C, '09:20', C1, 'gioi_thieu', null, I); L(13, C, '09:40', C1, 'muc', I, S(true, true, 'tot'), true);
      const M = (no, lv, by, at, x = {}) => T.training_marks.push({ training_id: 1, item_no: no, introduced: true, practiced: !!lv, level: lv, by_account: by, at, ...x });
      M(1, 'tot', 5, `${A} 08:25:00`); M(2, 'kha', 5, `${A} 08:40:00`); M(3, 'tot', 5, `${A} 09:20:00`); M(4, 'kha', 5, `${A} 09:45:00`); M(5, 'kha', 5, `${C} 08:30:00`);
      M(6, 'kha', 5, `${B} 08:20:00`); M(7, 'tot', 5, `${B} 09:00:00`); M(8, 'kha', 9, `${B} 09:10:00`, { checked_by: 5, checked_at: `${B} 14:00:00` }); M(9, 'tb', 5, `${B} 10:00:00`);
      M(10, 'tot', 9, `${B} 10:40:00`, { checked_by: 5, checked_at: `${C} 08:05:00` }); M(11, null, 5, `${C} 08:50:00`); M(12, null, 5, `${C} 09:07:00`);
      M(13, 'tot', 9, `${C} 09:40:00`, { cho_kiem_tra: true, cho_by: 9, cho_at: `${C} 09:40:00` });
      [8, 10, 13].forEach((no) => { if (!part(t).some((f) => f.no === no)) extras.push({ training_id: 1, no, employee_id: 7, name: emp(7)?.name, is_extra: false, finished_at: null }); });
      T.training_day_notes.push({ training_id: 1, day: A, comment: 'Nắm được cách chào khách, đưa menu. Ghi order còn chậm.', comment_by: HD, comment_at: `${A} 21:00:00`, trainee_at: `${A} 21:05:00`, trainee_by: NV, instructor_at: `${A} 21:00:00`, instructor_by: HD },
        { training_id: 1, day: B, comment: 'Bưng khay ổn. Mục 9 cần luyện thêm.', comment_by: HD, comment_at: `${B} 21:10:00`, instructor_at: `${B} 21:10:00`, instructor_by: HD });
      T.training_days = [{ training_id: 1, day: 1, comment: 'Ghi theo ngày giáo trình (trước khi đổi): đi làm đúng giờ.', instructor_at: `${A} 21:30:00` }];
    },
    app__test_dt_fill() {
      const t = tr(1);
      for (const i of PROG.items) if (!T.training_marks.some((m) => m.training_id === t.id && m.item_no === i.no && m.level)) {
        const existing = T.training_marks.find((m) => m.training_id === t.id && m.item_no === i.no);
        const fields = { training_id: t.id, item_no: i.no, introduced: true, practiced: true, level: 'tot' };
        const o = existing ? st3(existing) : null;
        if (existing) Object.assign(existing, fields);
        else T.training_marks.push(fields);
        logMark(t.id, i.no, o, st3(fields), { by: 'admin – Chủ' });
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
      const t = tr(p_id); if (!isPtc() && me.role !== 'chu') throw new Error('Chỉ người phụ trách chính đào tạo hoặc Chủ được đổi người hướng dẫn chính.');
      mainGuide(p_employee); t.instructor_id = Number(p_employee);
    },
    app_dt_check_ok({ p_id, p_no, p_level }) {
      const t = tr(p_id);
      const subOk = part(t).some((f) => f.no === p_no && f.sub_by != null && f.sub_by === me.employee_id);   // tệp 174: quản lý đã giao lại mục này
      if (!canCheck(t) && !subOk) throw new Error('Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc quản lý đã giao lại mục này được xác nhận đạt.');
      const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === p_no);
      if (!m || !m.cho_kiem_tra || !m.level) throw new Error('Hạng mục này không chờ kiểm tra.');
      const o = st3(m);
      Object.assign(m, { level: p_level || m.level, cho_kiem_tra: false, checked_by: me.account_id, checked_at: now() });
      logMark(t.id, p_no, o, st3(m), { kind: 'xac_nhan' });
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
        if (cur && cur.employee_id !== p_employee) Object.assign(nx, { date: null, shift: null, sub_by: null });   // tệp 174: trang cũ đổi người → mục rời ca
        if (cur) Object.assign(cur, nx); else extras.push(nx);
        if ((p_employee || t.instructor_id) !== before) changed += 1; });
      window.__DT_BULK = (window.__DT_BULK || []).concat([{ p_id, p_items, p_employee, p_branch, p_note }]);   // bài thử đếm số lần gọi (1 lần lưu)
      return { n: new Set(p_items).size, changed };
    },
    // tệp 174: phân công theo ca + quản lý giao lại cho Cấp 1 + việc đào tạo của tôi
    app_dt_plan_board() {
      const allOpen = me.role === 'chu' || isPtc();
      const vis = T.trainings.filter((t) => status(t) !== 'hoan_thanh' && (allOpen || isHdc(t)));
      if (!allOpen && !vis.length) return { can_board: false, rows: [] };
      return { can_board: true, today,
        trainers: T.employees.filter((e) => e.status === 'Đang làm' && ['Cấp 1', 'Quản lý'].includes(e.rank)).sort((a, b) => (a.rank < b.rank ? 1 : a.rank > b.rank ? -1 : a.code < b.code ? -1 : 1))
          .map((e) => ({ id: e.id, name: nmE(e), rank: e.rank, branches: (T.employee_branches || []).filter((x) => x.employee_id === e.id).map((x) => bcodeOf(x.branch_id)) })),
        rows: vis.map((t) => ({ id: t.id, employee_id: t.employee_id, employee: nmE(emp(t.employee_id)), program: 'Nhân viên chạy bàn 8 ngày', start_date: t.start_date, due: due(t),
          branch: bcodeOf(t.branch_id), instructor_id: t.instructor_id, instructor: nmE(emp(t.instructor_id)), achieved: ach(t), total, can_check: canCheck(t),
          shifts: schedOf(t.employee_id, t.start_date).map((x) => ({ ...x, branch: bcodeOf(x.branch_id), mates: matesOf(x.date, x.shift, x.branch_id, t.employee_id) })),
          items: PROG.items.map((i) => { const m = markOf(t.id, i.no); const f = fuOf(t, i.no) || {}; const kt = !!(m && m.level && m.cho_kiem_tra);
            return { no: i.no, day: i.day, title: i.title, state: stateOf(m), level: m?.level || null, who_id: f.employee_id ?? null, date: f.date || null, shift: f.shift || null,
              branch_id: f.branch_id || null, sub_by: f.sub_by || null, pending_by: kt ? accName(m.cho_by) : null, pending_at: kt ? m.cho_at : null }; }) })) };
    },
    app_dt_plan_assign({ p_id, p_date, p_shift, p_branch, p_employee, p_items }) {
      const t = tr(p_id); if (!canAssign(t)) throw new Error('Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.');
      if (!p_employee) throw new Error('Chọn người dạy.');
      if (!p_date || p_date < today) throw new Error('Ngày đã qua không phân công lại được.');
      const s = schedOf(t.employee_id, t.start_date).find((x) => x.date === p_date && x.shift === p_shift);
      if (!s) throw new Error('Ca này không có trong lịch đã công bố của nhân viên.');
      window.__DT_PLAN = (window.__DT_PLAN || []).concat([{ fn: 'app_dt_plan_assign', p_id, p_date, p_shift, p_branch, p_employee, p_items }]);
      const items = p_items || [];
      part(t).filter((f) => f.employee_id === p_employee && f.date === p_date && f.shift === p_shift && !items.includes(f.no) && !markOf(t.id, f.no)?.level)
        .forEach((f) => Object.assign(f, { employee_id: null, name: null, date: null, shift: null, sub_by: null }));
      let n = 0, moved = 0, skipped = 0;
      items.forEach((no) => { if (markOf(t.id, no)?.level) { skipped += 1; return; } const f = fuOf(t, no); if (f?.date && (f.date !== p_date || f.shift !== p_shift)) moved += 1;
        setFu(t, no, { employee_id: p_employee, date: p_date, shift: p_shift, sub_by: null, branch_id: s.branch_id, finished_at: null }); n += 1; });
      return { n, moved, skipped };
    },
    app_dt_plan_unassign({ p_id, p_date, p_shift, p_employee }) {
      const t = tr(p_id); if (!canAssign(t)) throw new Error('Chỉ người hướng dẫn chính của phiếu, người phụ trách chính đào tạo hoặc Chủ được giao hạng mục.');
      if (!p_date || p_date < today) throw new Error('Ngày đã qua không phân công lại được.');
      const xs = part(t).filter((f) => f.employee_id === p_employee && f.date === p_date && f.shift === p_shift && !markOf(t.id, f.no)?.level);
      xs.forEach((f) => Object.assign(f, { employee_id: null, name: null, date: null, shift: null, sub_by: null }));
      return xs.length;
    },
    app_dt_sub_assign({ p_id, p_date, p_shift, p_employee, p_items }) {
      const t = tr(p_id); const mine = subGuard(t, p_date, p_shift); const my = me.employee_id;
      const c = emp(p_employee); if (!c || c.rank !== 'Cấp 1' || c.status !== 'Đang làm' || c.id === t.employee_id) throw new Error('Chỉ giao lại cho nhân viên Cấp 1 có tài khoản.');
      const items = p_items || [];
      if (items.some((no) => !mine.some((f) => f.no === no) || markOf(t.id, no)?.level)) throw new Error('Chỉ giao lại được mục của bạn, chưa chấm.');
      window.__DT_PLAN = (window.__DT_PLAN || []).concat([{ fn: 'app_dt_sub_assign', p_id, p_date, p_shift, p_employee, p_items }]);
      part(t).filter((f) => f.date === p_date && f.shift === p_shift && f.employee_id === p_employee && f.sub_by === my && !items.includes(f.no) && !markOf(t.id, f.no)?.level)
        .forEach((f) => Object.assign(f, { employee_id: my, name: emp(my)?.name, sub_by: null }));
      let n = 0; items.forEach((no) => { const f = fuOf(t, no); if (f.employee_id !== p_employee) { Object.assign(f, { employee_id: p_employee, name: c.name, sub_by: my }); n += 1; } });
      return { n };
    },
    app_dt_sub_take({ p_id, p_date, p_shift, p_employee }) {
      const t = tr(p_id); subGuard(t, p_date, p_shift); const my = me.employee_id;
      const xs = part(t).filter((f) => f.date === p_date && f.shift === p_shift && f.employee_id === p_employee && f.sub_by === my && !markOf(t.id, f.no)?.level);
      xs.forEach((f) => Object.assign(f, { employee_id: my, name: emp(my)?.name, sub_by: null }));
      return xs.length;
    },
    app_dt_my_plan() {
      const my = me.employee_id;
      if (!my) return { today, shifts: [], checks: [], cap1: [] };
      const ord = (s) => ['Sáng', 'Chiều', 'Tối'].indexOf(s);
      const it = (t, f) => { const m = markOf(t.id, f.no); return { no: f.no, title: PROG.items.find((i) => i.no === f.no)?.title, state: stateOf(m), level: m?.level || null }; };
      const keys = new Map();
      T.trainings.filter((t) => status(t) !== 'hoan_thanh').forEach((t) => part(t).filter((f) => f.date && f.date >= addD(today, -1) && (f.employee_id === my || f.sub_by === my))
        .forEach((f) => keys.set(`${t.id}|${f.date}|${f.shift}`, { t, date: f.date, shift: f.shift })));
      const shifts = [...keys.values()].map(({ t, date, shift }) => {
        const fs = part(t).filter((f) => f.date === date && f.shift === shift).sort((a, b) => a.no - b.no);
        const sc = schedOf(t.employee_id, t.start_date); const s = sc.find((x) => x.date === date && x.shift === shift);
        const subs = []; fs.filter((f) => f.sub_by === my && f.employee_id !== my).forEach((f) => { let g = subs.find((x) => x.who_id === f.employee_id); if (!g) subs.push(g = { who_id: f.employee_id, who: nmE(emp(f.employee_id)), items: [] }); g.items.push(it(t, f)); });
        const byF = fs.find((f) => f.employee_id === my && f.sub_by);
        return { training_id: t.id, trainee: nmE(emp(t.employee_id)), date, shift, branch: s ? bcodeOf(s.branch_id) : null, day_no: new Set(sc.filter((x) => x.date <= date).map((x) => x.date)).size,
          mates: s ? matesOf(date, shift, s.branch_id, t.employee_id) : [], own: fs.filter((f) => f.employee_id === my).map((f) => it(t, f)), subs, by: byF ? nmE(emp(byF.sub_by)) : null };
      }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : ord(a.shift) - ord(b.shift)));
      const checks = T.trainings.flatMap((t) => part(t).filter((f) => f.sub_by === my).map((f) => ({ f, m: markOf(t.id, f.no), t })).filter(({ m }) => m && m.level && m.cho_kiem_tra)
        .map(({ f, m, t }) => ({ training_id: t.id, trainee: nmE(emp(t.employee_id)), no: f.no, title: PROG.items.find((i) => i.no === f.no)?.title, level: m.level, who: accName(m.cho_by), at: m.cho_at })));
      return { today, me_id: my, me_rank: emp(my)?.rank || null, shifts, checks,
        cap1: T.employees.filter((e) => e.rank === 'Cấp 1' && e.status === 'Đang làm').map((e) => ({ id: e.id, name: nmE(e), branches: (T.employee_branches || []).filter((x) => x.employee_id === e.id).map((x) => bcodeOf(x.branch_id)) })) };
    },
    app_dt_get({ p_id }) {
      const t = tr(p_id);
      return { ...t, ...sum(t), program: { name: 'Nhân viên chạy bàn 8 ngày', days: PROG.days }, employee: { code: emp(t.employee_id).code, name: emp(t.employee_id).name, rank: emp(t.employee_id).rank },
        items: PROG.items.map((i) => { const m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === i.no) || {}; return { ...i, introduced: !!m.introduced, practiced: !!m.practiced, level: m.level || null, by: m.at ? (accName(m.by_account) || 'admin – Chủ') : null, at: m.at || null,
          pending: !!(m.cho_kiem_tra && m.level), pending_by: m.cho_kiem_tra ? accName(m.cho_by) : null, pending_at: m.cho_kiem_tra ? m.cho_at : null }; }),
        can_check: canCheck(t), is_ptc: isPtc(), is_hdc: isHdc(t), ptc: reviewer ? accName(reviewer) : null, can_pick_hdc: isPtc() || me.role === 'chu',
        hdc_choices: isPtc() || me.perms.dao_tao ? T.employees.filter((e) => e.rank === 'Quản lý' && e.status === 'Đang làm' && e.id !== t.employee_id).map(({ id, code, name }) => ({ id, code, name })) : null,
        days_log: Object.fromEntries(T.training_days.filter((d) => d.training_id === t.id).map((d) => [d.day, d])), tasks: [],
        ...(workflow ? { due: due(t), today, review_from: dayFromStart(t, 8), followups: part(t).map((f) => ({ ...f, mine: f.employee_id != null && f.employee_id === me.employee_id })), can_review: me.account_id === reviewer,
          can_assign: canAssign(t), item_branches: canAssign(t) ? T.branches : null, helpers: canAssign(t) ? T.employees.filter((e) => e.id !== t.employee_id && (e.id === t.instructor_id || ['Cấp 1', 'Quản lý'].includes(e.rank))).map((e) => ({ id: e.id, name: `${e.code} – ${e.name}` })) : null } : {}),
        can_edit: canEdit(t), can_admin: !!me.perms.dao_tao, is_trainee: me.employee_id === t.employee_id };
    },
    app_dt_update({ p_id, p }) { const t = tr(p_id); if (!canEdit(t)) throw new Error('Bạn không có quyền.'); if ('instructor_id' in p && p.instructor_id !== t.instructor_id) { if (!isPtc() && me.role !== 'chu') throw new Error('Chỉ người phụ trách chính đào tạo hoặc Chủ được đổi người hướng dẫn chính.'); mainGuide(p.instructor_id); } Object.assign(t, p); },
    app_dt_mark({ p_id, p_no, p: p0 }) {
      const { relearn, ...p } = p0 || {};   // chặng 4: p.relearn = đào tạo lại (luôn ghi sổ)
      const t = tr(p_id);
      const mine = part(t).find((f) => f.no === p_no && f.employee_id === me.employee_id && (!f.is_extra || !f.finished_at));
      if (!canEdit(t) && !mine) throw new Error('Bạn chỉ được cập nhật hạng mục được giao.');
      let m = T.training_marks.find((x) => x.training_id === t.id && x.item_no === p_no); const o = m ? st3(m) : null;
      if (!m) { m = { training_id: t.id, item_no: p_no, introduced: false, practiced: false, level: null }; T.training_marks.push(m); }
      const n = { ...m, ...p };
      if (workflow && n.practiced && !n.level && (!m.practiced || m.level)) throw new Error('Chọn mức đạt khi đánh dấu đã thực hành.');
      if (n.practiced && !n.introduced) throw new Error(`Hạng mục ${p_no} phải “Đã giới thiệu” trước.`);
      if (n.level && !(n.introduced && n.practiced)) throw new Error(`Hạng mục ${p_no} phải đủ 2 bước rồi mới đánh giá mức đạt.`);
      // bước 169: Cấp 1 ghi mức đạt → Chờ kiểm tra; HDC / PTC tự ghi thì khỏi kiểm
      const cap1 = !canCheck(t) && emp(me.employee_id)?.rank === 'Cấp 1';
      const pend = !!n.level && cap1;
      Object.assign(m, n, { at: now(), by_account: me.account_id,
        cho_kiem_tra: !n.level ? false : canCheck(t) ? false : pend || !!m.cho_kiem_tra, cho_by: pend ? me.account_id : m.cho_by, cho_at: pend ? now() : m.cho_at });
      logMark(t.id, p_no, o, st3(m), { relearn: !!relearn, pending: !!m.cho_kiem_tra });
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
    // chặng 4 (tệp 163): lịch sử + nhận xét / xác nhận theo ngày thật
    app_dt_history({ p_id }) {
      const t = tr(p_id); const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
      return { log: T.training_mark_log.filter((l) => l.training_id === t.id).sort((a, b) => cmp(a.day, b.day) || cmp(a.at, b.at) || a.id - b.id).map(({ training_id: _t, ...l }) => l),
        notes: T.training_day_notes.filter((n) => n.training_id === t.id).sort((a, b) => cmp(a.day, b.day)).map(({ training_id: _t, ...n }) => n) };
    },
    app_dt_dnote_comment({ p_id, p_day, p_comment }) {
      const t = tr(p_id); if (!canEdit(t)) throw new Error('Bạn không có quyền.'); if (t.workflow_review_at) throw new Error('Phiếu đã có nhận xét cuối.');
      Object.assign(dayNote(t, p_day), { comment: String(p_comment || '').trim() || null, comment_by: meName(), comment_at: now() });
    },
    app_dt_dnote_confirm({ p_id, p_day, p_who, p_on }) {
      const t = tr(p_id); if (t.workflow_review_at) throw new Error('Phiếu đã có nhận xét cuối.');
      if (p_who === 'nv' && me.employee_id !== t.employee_id) throw new Error('Chỉ chính nhân viên được đào tạo mới xác nhận phần của nhân viên.');
      if (p_who === 'hd' && !canEdit(t)) throw new Error('Chỉ người hướng dẫn / người có quyền Đào tạo mới xác nhận phần người hướng dẫn.');
      if (p_who !== 'nv' && p_who !== 'hd') throw new Error('Không hợp lệ.');
      const n = dayNote(t, p_day); const k = p_who === 'nv' ? 'trainee' : 'instructor';
      n[k + '_at'] = p_on ? now() : null; n[k + '_by'] = p_on ? meName() : null;
    },
    app_dt_delete({ p_id }) { T.trainings = T.trainings.filter((t) => t.id !== p_id); },
    app_dt_mine: () => T.trainings.filter((t) => me.employee_id && [t.employee_id, t.instructor_id, t.cont_trainer_id].includes(me.employee_id))   // bước 174 (tệp 155): bỏ Quản lý phụ trách cũ
      .map((t) => ({ ...sum(t), employee: `${emp(t.employee_id).code} – ${emp(t.employee_id).name}`, role: t.employee_id === me.employee_id ? 'hoc' : 'huong_dan' })),
  };
}
