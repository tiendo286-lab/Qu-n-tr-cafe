// Giả lập Bảng phân công (bước 109): app_pc_* + app_gv_* — chỉ để chạy thử giao diện.
export function makePc(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const at = (h) => new Date(Date.now() + 7 * 3600e3 + h * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  const ME = me.account_id;
  const P = [{ id: 1, name: 'admin – Chủ', role: 'chu', kt: false }, { id: 6, name: 'NV01 – QL tổng thử', role: 'ql_tong', kt: false }, { id: 5, name: '5 – Quản lý thử', role: 'ql', kt: false },
    { id: 8, name: '8 – Quản lý HS', role: 'ql', kt: false }, { id: 3, name: 'NV3 – Nhân viên thử', role: 'nv', kt: false }, { id: 7, name: 'KT – Kế toán thử', role: 'nv', kt: true }];
  const nm = (id) => P.find((p) => p.id === id)?.name || `TK ${id}`;
  const B = [{ id: 1, code: 'LHP', fabi: true }, { id: 2, code: 'ĐK', fabi: true }, { id: 3, code: 'HS', fabi: true }, { id: 4, code: 'LL', fabi: true }, { id: 29, code: 'LLB', fabi: false }];
  const bc = (id) => B.find((b) => b.id === id)?.code || null;
  const JOBS = [
    { job: 1, enabled: true, fine: 50000, same_as_1: false, steps: [{ n: 'Đối soát', who: 'branch', d: 1 }] },
    { job: 2, enabled: true, fine: 50000, same_as_1: false, steps: [{ n: 'Phân loại', who: 'acc:6', d: 2 }, { n: 'Duyệt', who: 'acc:1', d: 2 }] },
    { job: 3, enabled: true, fine: 50000, same_as_1: false, steps: [{ n: 'Tải file Fabi', who: 'kt', d: 1 }] },
    { job: 4, enabled: true, fine: 50000, same_as_1: false, steps: [{ n: 'Tải sao kê chuyển khoản', who: 'kt', d: 1 }] },
    { job: 7, enabled: true, fine: 50000, same_as_1: true, steps: [{ n: 'Ghép / trừ lương / quán chịu', who: 'branch', d: 5 }] },
    { job: 8, enabled: true, fine: 0, same_as_1: true, steps: [{ n: 'Xem & quyết định', who: 'branch+ql_tong', d: null }] },
    { job: 10, enabled: true, fine: 50000, same_as_1: true, steps: [{ n: 'Kiểm quỹ', who: 'branch', d: 4 }] },
    { job: 11, enabled: true, fine: 50000, same_as_1: true, steps: [{ n: 'Đôn đốc nhận hàng', who: 'branch', d: 1 }] },
    { job: 12, enabled: true, fine: 50000, same_as_1: true, steps: [{ n: 'Đối soát hàng', who: 'branch', d: 1 }] },
    { job: 13, enabled: true, fine: 50000, same_as_1: false, steps: [{ n: 'Hoá đơn bù / ghép phiếu xuất', who: 'kt', d: 2 }] },
    { job: 14, enabled: true, fine: 50000, same_as_1: false, steps: [{ n: 'Theo dõi giao bù / hoá đơn bổ sung', who: 'kt', d: 2 }] },
    { job: 24, enabled: true, fine: 50000, same_as_1: true, steps: [{ n: 'Phân loại / giao', who: 'branch', d: 1 }, { n: 'Nhận & làm', who: 'doer', d: null }, { n: 'Kiểm tra', who: 'checker', d: 1 }] },
    // bước 123: việc tự thêm
    { job: 100, enabled: true, fine: 0, same_as_1: false, custom: true, name: 'Vệ sinh máy pha', guide: 'Tháo tay pha, ngâm 15 phút, lau group head, chụp ảnh sau khi lau.', need_photo: true, need_check: true,
      steps: [{ n: 'Làm', who: 'branch', d: null }, { n: 'Kiểm tra', who: 'check', d: null }] },
  ];
  const SCHED = [
    { job: 100, branch_id: 1, enabled: true, cycle: 'ngay', day: null, grace_h: 4, fine: 20000, checkers: [6], check_h: 4, from_date: '2026-11-17' },
    { job: 100, branch_id: 2, enabled: true, cycle: 'tuan', day: 2, grace_h: 24, fine: 50000, checkers: [6], check_h: 24, from_date: '2026-11-17' },
    { job: 100, branch_id: 3, enabled: true, cycle: 'tuan', day: 3, grace_h: 24, fine: 50000, checkers: [6], check_h: 24, from_date: '2026-11-17' },
    { job: 100, branch_id: 4, enabled: true, cycle: 'thang', day: 5, grace_h: 72, fine: 0, checkers: [1], check_h: 48, from_date: '2026-11-17' },
    { job: 100, branch_id: 29, enabled: false, cycle: 'tuan', day: 1, grace_h: 24, fine: 50000, checkers: [], check_h: 24, from_date: '2026-11-17' },
  ];
  // bước 124: lịch từng cơ sở cho việc có sẵn (chép hạn / phạt đang dùng)
  [1, 3, 4, 7, 8, 10, 11, 12].forEach((j) => B.forEach((b) => SCHED.push({ job: j, branch_id: b.id, enabled: true, cycle: j === 10 ? 'tuan' : null, day: j === 10 ? 1 : null, grace_h: 72,
    fine: JOBS.find((x) => x.job === j).fine, checkers: [], check_h: 24, due_h: JOBS.find((x) => x.job === j).steps[0].d == null ? null : JOBS.find((x) => x.job === j).steps[0].d * 24, from_date: '2026-11-16' })));
  const ASG = [{ job: 1, branch_id: 1, accounts: [6, ME === 1 ? 1 : 5] }, { job: 1, branch_id: 2, accounts: [5] }, { job: 1, branch_id: 3, accounts: [8, 5] }, { job: 1, branch_id: 4, accounts: [8] }, { job: 1, branch_id: 29, accounts: [] },
    { job: 100, branch_id: 1, accounts: [3] }, { job: 100, branch_id: 2, accounts: [5] }, { job: 100, branch_id: 3, accounts: [8] }, { job: 100, branch_id: 4, accounts: [3] }, { job: 100, branch_id: 29, accounts: [] }];
  let KT = 7;
  const J = (j) => JOBS.find((x) => x.job === j);
  const who = (j, w, b) => {
    if (w === 'kt') return KT ? [KT] : [];
    if (w?.startsWith('acc:')) return [+w.slice(4)];
    if (w?.startsWith('branch')) { const a = (ASG.find((x) => x.job === (J(j).same_as_1 ? 1 : j) && x.branch_id === b)?.accounts) || []; return w === 'branch+ql_tong' ? [...new Set([...a, 6])] : [...a]; }
    return [];
  };
  let seq = 100;
  const step = (st, name, accounts, start, due, done) => ({ id: seq++, step: st, name, accounts, names: accounts.map(nm), start_at: start, due_at: due, done_at: done || null, done_by: null });
  const task = (job, b, title, link, steps, items) => ({ id: seq++, job, branch_id: b, code: bc(b), title, link, created_at: steps[0].start_at, done_at: null, n_steps: J(job).steps.length, auto: job === 2 ? 2 : 1, fine: J(job).fine, steps, items: items || null });
  const it = (title, start, due, link) => ({ id: seq++, title, link: link || '/hang-hoa/doi-soat', start_at: start, due_at: due, done_at: null });
  const TASKS = [
    task(1, 1, 'Đối soát Ca Tối LHP 15/11/2026', '/quan-ly/doi-soat/ca?id=1', [step(0, 'Đối soát', who(1, 'branch', 1), at(-2), at(22))]),
    task(1, 2, 'Đối soát Ca Sáng ĐK 14/11/2026', '/quan-ly/doi-soat/ca?id=2', [step(0, 'Đối soát', who(1, 'branch', 2), at(-28), at(-4))]),
    task(1, 29, 'Đối soát Ca Sáng LLB 15/11/2026', '/quan-ly/doi-soat/ca?id=3', [step(0, 'Đối soát', [], at(-3), at(21))]),
    task(2, 1, 'Nghỉ / làm thay · Ca Tối LHP 13/11/2026', '/quan-ly/doi-soat/ca?id=4', [step(0, 'Phân loại', [6], at(-37), at(-1), at(-30)), step(1, 'Duyệt', [1], at(-30), at(18))]),
    task(3, 3, 'File ca Fabi · ngày 14/11', '/ke-toan/fabi', [step(0, 'Tải file Fabi', [KT], at(-10), at(14))]),
    task(4, 4, 'Chuyển khoản thực nhận · ngày 13/11', '/ke-toan/chuyen-khoan', [step(0, 'Tải sao kê chuyển khoản', [KT], at(-34), at(-10))]),
    task(7, 1, 'Lệch Tiền mặt · Ca Sáng LHP 12/11/2026 · 50.000đ', '/quan-ly/lech-tien', [step(0, 'Ghép / trừ lương / quán chịu', who(7, 'branch', 1), at(-70), at(50))]),
    task(8, 2, 'Giải trình · NV3 – Nhân viên thử · 30.000đ', '/quan-ly/khoan-am', [step(0, 'Xem & quyết định', who(8, 'branch+ql_tong', 2), at(-1), null)]),
    task(10, 1, 'Kiểm quỹ tuần 16/11 – 22/11', '/quan-ly/so-quy', [step(0, 'Kiểm quỹ', who(10, 'branch', 1), at(-10), at(86))]),
    task(12, 1, 'Đối soát hàng · LHP', '/hang-hoa/doi-soat', [step(0, 'Đối soát hàng', who(12, 'branch', 1), at(-20), null)], [it('PX0412 · nhận 15/11 09:00', at(-20), at(4)), it('PX0415 · nhận 15/11 16:00', at(-3), at(21))]),
    task(13, null, 'Hoá đơn bù & ghép phiếu xuất · các cơ sở', '/hang-hoa/kiem-soat', [step(0, 'Hoá đơn bù / ghép phiếu xuất', [KT], at(-5), null)], [it('Ghép phiếu xuất · LL · lần nhận #9', at(-5), at(43), '/hang-hoa/phieu-xuat')]),
  ];
  // bước thêm tay (đã qua bước tự động)
  const manual = task(1, 1, 'Đối soát Ca Sáng LHP 14/11/2026', '/quan-ly/doi-soat/ca?id=5', [step(0, 'Đối soát', who(1, 'branch', 1), at(-30), at(-6), at(-8)), step(1, 'Kiểm tra lại', [ME], at(-8), at(16))]);
  manual.n_steps = 2; TASKS.push(manual);
  // bước 123: việc tự thêm — hôm nay (cần ảnh), làm bổ sung, chờ kiểm tra
  const SC = (b) => SCHED.find((x) => x.job === 100 && x.branch_id === b);
  const cu = (b, title, steps, extra) => Object.assign(task(100, b, title, null, steps), { auto: 0, custom: true, job_name: 'Vệ sinh máy pha', guide: J(100).guide, need_photo: true, need_check: true, extra: !!extra, fine: SC(b).fine });
  const today = now().slice(8, 10) + '/' + now().slice(5, 7);
  TASKS.push(cu(1, 'Vệ sinh máy pha · LHP · ' + today, [step(0, 'Làm', [ME], at(-6), at(10))]));
  TASKS.push(cu(2, 'Vệ sinh máy pha · ĐK · 11/11', [step(0, 'Làm', [ME], at(-2), null)], true));
  const ck = cu(3, 'Vệ sinh máy pha · HS · ' + today, [Object.assign(step(0, 'Làm', [8], at(-8), at(30), at(-1)), { note: 'Đã lau, máy chạy bình thường', photos: ['pc1/a.jpg', 'pc1/b.jpg'], done_by: nm(8) }),
    Object.assign(step(1, 'Kiểm tra', [ME], at(-1), at(23)), { check: true })]);
  TASKS.push(ck);
  TASKS.push(cu(4, 'Vệ sinh máy pha · LL · ' + today, [step(0, 'Làm', [8], at(-3), at(40))]));   // việc của người khác (bước 126)
  const DONE = [{ title: 'Đối soát Ca Chiều LHP 13/11/2026', code: 'LHP', job: 1, done_at: at(-26), by: nm(5), late: false },
    { kind: 'pc', title: 'Lau kính · LHP · 15/11', code: 'LHP', job: 100, done_at: at(-20), late: false, drop: true, note: 'Việc đã bị xoá' }];
  let gseq = 500;
  const EV = {};
  const gv = (o) => { const k = { id: gseq++, content: '', branch_id: null, status: 'chua_phan_cong', priority: 'binh_thuong', src: 'Bàn giao ca', handover: true, giver_id: null, giver: null, assignee_id: null, assignee: null, reviewer_id: null, reviewer: null,
    created_at: at(-5), due: null, cls_due: null, review_due: null, classifiers: null, ext: null, result: null, result_photo: null, fine: 50000, last: null, ...o };
    k.code = bc(k.branch_id); EV[k.id] = EV[k.id] || []; return k; };
  const evAdd = (k, by, note, photo) => { EV[k.id].push({ at: now(), by: nm(by) || by, action: 'x', note, photo: photo || null }); k.last = { at: now(), by: nm(by) || by, note, photo: !!photo }; };
  const GV = [
    gv({ content: 'Máy xay số 2 kêu to, cần gọi thợ', branch_id: 1, src: 'Bàn giao ca · Ca Tối LHP 14/11/2026', cls_due: at(12), classifiers: who(24, 'branch', 1).map((id) => ({ id, name: nm(id) })) }),
    gv({ content: 'Tủ mát rò nước dưới đáy', branch_id: 3, status: 'dang_xu_ly', priority: 'gap', giver_id: 8, giver: nm(8), assignee_id: ME, assignee: nm(ME), reviewer_id: ME === 8 ? 6 : 8, reviewer: nm(ME === 8 ? 6 : 8), due: at(26), src: 'Bàn giao ca · Ca Chiều HS 14/11/2026' }),
    gv({ content: 'Hết ống hút giấy, cần đặt thêm', branch_id: 4, status: 'cho_duyet', giver_id: 8, giver: nm(8), assignee_id: 8, assignee: nm(8), reviewer_id: ME === 8 ? 6 : ME, reviewer: nm(ME === 8 ? 6 : ME), review_due: at(22), result: 'Đã đặt 5 bịch', src: 'Bàn giao ca · Ca Sáng LL 13/11/2026' }),
    gv({ content: 'Kiểm tra lại camera quầy', branch_id: 2, status: 'da_giao', giver_id: ME, giver: nm(ME), assignee_id: 5 === ME ? 3 : 5, assignee: nm(5 === ME ? 3 : 5), reviewer_id: 6, reviewer: nm(6), due: at(-2), src: nm(ME) + ' giao tay', handover: false }),
  ];
  EV[GV[1].id].push({ at: at(-3), by: nm(ME), action: 'x', note: 'Đã lau, kê khay hứng nước, gọi thợ', photo: 'cv501/a.jpg' }); GV[1].last = { at: at(-3), by: nm(ME), note: 'Đã lau, kê khay hứng nước, gọi thợ', photo: true };
  const PEN = [
    { id: 1, job: 1, code: 'ĐK', account_id: 5, name: nm(5), role: 'ql', title: 'Đối soát Ca Sáng ĐK 14/11/2026', step: 'Đối soát', due_at: at(-4), status: 'cho', amount: null, reason: null, fine: 50000, end_at: null, others: [] },
    { id: 2, job: 4, code: 'LL', account_id: 7, name: nm(7), role: 'nv', title: 'Chuyển khoản thực nhận · ngày 13/11', step: 'Tải sao kê chuyển khoản', due_at: at(-10), status: 'cho', amount: null, reason: null, fine: 50000, end_at: null, others: [] },
    { id: 3, job: 10, code: 'HS', account_id: 8, name: nm(8), role: 'ql', title: 'Kiểm quỹ tuần 09/11 – 15/11', step: 'Kiểm quỹ', due_at: at(-50), status: 'phat', amount: 50000, reason: 'Bị phạt do không hoàn thành công việc đúng hạn', decided_at: at(-30), fine: 50000, end_at: at(-48), others: [5] },
    { id: 5, job: 100, code: 'HS', account_id: 8, name: nm(8), role: 'ql', title: 'Vệ sinh máy pha · HS · 12/11', step: 'Làm', due_at: at(-30), status: 'cho', amount: null, reason: null, fine: 30000, end_at: null, others: [] },
    { id: 4, job: 10, code: 'HS', account_id: 5, name: nm(5), role: 'ql', title: 'Kiểm quỹ tuần 09/11 – 15/11', step: 'Kiểm quỹ', due_at: at(-50), status: 'bo', amount: null, reason: 'Nghỉ phép tuần này', decided_at: at(-30), fine: 50000, end_at: at(-48), others: [nm(8)] },
  ];
  PEN[2].others = [nm(5)];
  const isChu = me.role === 'chu';
  const pcView = !!new URLSearchParams(location.search).get('pcview');   // bài thử: xem như Quản lý tổng
  const mine = (t) => !t.done_at && t.steps.some((s) => !s.done_at && s.accounts.includes(ME));
  const findG = (id) => GV.find((k) => k.id === id);
  const err = (m) => { throw new Error(m); };
  return {
    app_pc_mine() {
      return { now: now(), me: ME, can_give: ['chu', 'ql_tong', 'ql'].includes(me.role), tasks: TASKS.filter(mine),
        gv: GV.filter((k) => !['hoan_thanh', 'bo'].includes(k.status) && ((['da_giao', 'dang_xu_ly'].includes(k.status) && k.assignee_id === ME) || (k.status === 'cho_duyet' && k.reviewer_id === ME) || (k.status === 'chua_phan_cong' && (k.classifiers || []).some((c) => c.id === ME)) || (k.ext && k.giver_id === ME))),
        watch: GV.filter((k) => ['da_giao', 'dang_xu_ly', 'cho_duyet'].includes(k.status) && k.giver_id === ME && k.assignee_id !== ME && k.reviewer_id !== ME && !k.ext),
        debts: [{ id: 1, branch_id: 1, code: 'LHP', kind: 'bill', name: 'Khách Minh', note: null, amount: 120000, at: at(-100) }],
        done: DONE, fines: PEN.filter((p) => p.account_id === ME && p.status !== 'bo'), people: P, branches: B };
    },
    app_pc_all() {
      return { now: now(), me: ME, can_edit: true, tasks: TASKS.filter((t) => !t.done_at), gv: GV, done: DONE, people: P, branches: B, jobs: JOBS, late7: { 5: 2, 7: 1 },
        debts: [{ id: 1, branch_id: 1, code: 'LHP', kind: 'bill', name: 'Khách Minh', note: null, amount: 120000, at: at(-100) }] };
    },
    app_pc_board() { return { can_edit: isChu && !pcView, jobs: JOBS.filter((j) => !j.deleted_at), assign: ASG, sched: SCHED, branches: B, people: P, kt: KT, start: '2026-11-16', old_rule_on: false }; },
    app_pc_custom_save({ p_job, p }) {
      if (!isChu || pcView) err('Chỉ tài khoản Chủ sửa được Bảng phân công.');
      if (!String(p.name || '').trim()) err('Ghi tên việc.');
      for (const r of p.rows) {
        const code = bc(r.branch_id);
        if (!['ngay', 'tuan', 'thang'].includes(r.cycle)) err('Chọn chu kỳ cho ' + code + '.');
        if (p.need_check && r.enabled) {
          if (!(r.checkers || []).length) err('Chọn người kiểm tra cho ' + code + '.');
          if (r.checkers.some((x) => (r.accounts || []).includes(x))) err('Người kiểm tra phải khác người làm.');
        }
      }
      let j = p_job ? J(p_job) : null;
      if (!j) { j = { job: Math.max(100, ...JOBS.map((x) => x.job + 1)), same_as_1: false, custom: true, fine: 0 }; JOBS.push(j); }
      Object.assign(j, { name: p.name.trim(), guide: p.guide || null, need_photo: !!p.need_photo, need_check: !!p.need_check, enabled: p.enabled !== false,
        steps: [{ n: 'Làm', who: 'branch', d: null }, ...(p.need_check ? [{ n: 'Kiểm tra', who: 'check', d: null }] : [])] });
      for (const r of p.rows) {
        let s = SCHED.find((x) => x.job === j.job && x.branch_id === r.branch_id); if (!s) SCHED.push(s = { job: j.job, branch_id: r.branch_id, from_date: now().slice(0, 10) });
        Object.assign(s, { enabled: r.enabled, cycle: r.cycle, day: r.cycle === 'ngay' ? null : r.day, grace_h: r.grace_h, fine: r.fine, checkers: r.checkers || [], check_h: r.check_h });
        let a = ASG.find((x) => x.job === j.job && x.branch_id === r.branch_id); if (!a) ASG.push(a = { job: j.job, branch_id: r.branch_id, accounts: [] });
        a.accounts = r.accounts || [];
      }
      return j.job;
    },
    app_pc_custom_delete({ p_job }) {
      if (!isChu || pcView) err('Chỉ tài khoản Chủ sửa được Bảng phân công.');
      const j = J(p_job); if (!j?.custom) err('Chỉ xoá được việc tự thêm.');
      j.deleted_at = now(); let n = 0; TASKS.forEach((t) => { if (t.job === p_job && !t.done_at) { t.done_at = now(); n++; } }); return n;
    },
    app_pc_job_save({ p_job, p }) {
      if (!isChu) err('Chỉ tài khoản Chủ sửa được Bảng phân công.');
      const j = J(p_job);
      if (p_job === 24) { j.steps[0].d = p.d0; j.steps[2].d = p.d2; } else if (p_job === 2) {
        if ((p.steps || []).some((s) => !s.n)) err('Bước chưa có tên.');
        j.steps = p.steps;
      } else {
        if ((p.steps || []).length > 1) err('Việc này không thêm bước được — dùng Có kiểm tra.');
        const chk = !!p.need_check && ![13, 14].includes(p_job);
        for (const r of p.rows || []) {
          let sc = SCHED.find((x) => x.job === p_job && x.branch_id === r.branch_id); if (!sc) SCHED.push(sc = { job: p_job, branch_id: r.branch_id });
          Object.assign(sc, { enabled: r.enabled, due_h: r.due_h, fine: r.fine, checkers: chk ? r.checkers || [] : [], check_h: r.check_h, cycle: r.cycle, day: r.day, grace_h: r.grace_h });
        }
        if (chk) {
          const bad = SCHED.find((x) => x.job === p_job && x.enabled && !(x.checkers || []).length); if (bad) err('Chọn người kiểm tra cho ' + bc(bad.branch_id) + '.');
          if (SCHED.some((x) => x.job === p_job && x.enabled && x.checkers.some((c) => who(p_job, j.steps[0].who, x.branch_id).includes(c)))) err('Người kiểm tra phải khác người làm.');
        }
        if (p.due_d != null) j.steps[0].d = p.due_d || null;
        j.steps = [j.steps[0], ...(chk ? [{ n: 'Kiểm tra', who: 'check', d: null }] : [])]; j.need_check = chk; j.guide = p.guide;
      }
      j.enabled = p.enabled; j.fine = p.fine;
    },
    app_pc_assign_save({ p_job, p_branch, p_accounts, p_apply }) {
      if (!isChu) err('Chỉ tài khoản Chủ sửa được Bảng phân công.');
      const j = J(p_job);
      if (j.same_as_1) { ASG.filter((x) => x.job === 1).forEach((x) => ASG.push({ job: p_job, branch_id: x.branch_id, accounts: [...x.accounts] })); j.same_as_1 = false; }
      let r = ASG.find((x) => x.job === p_job && x.branch_id === p_branch); if (!r) ASG.push(r = { job: p_job, branch_id: p_branch, accounts: [] });
      r.accounts = p_accounts;
      let n = 0;
      if (p_apply) TASKS.filter((t) => !t.done_at && t.branch_id === p_branch && (t.job === p_job || (p_job === 1 && J(t.job).same_as_1))).forEach((t) => { const s = t.steps.find((x) => !x.done_at); if (s && J(t.job).steps[s.step]?.who.startsWith('branch')) { s.accounts = who(t.job, J(t.job).steps[s.step].who, p_branch); s.names = s.accounts.map(nm); n++; } });
      return n;
    },
    app_pc_unlink({ p_job, p_link }) { J(p_job).same_as_1 = p_link; },
    app_pc_kt_set({ p_account, p_apply }) { KT = p_account; P.forEach((p) => { p.kt = p.id === p_account; }); let n = 0; if (p_apply) TASKS.forEach((t) => { const s = t.steps.find((x) => !x.done_at); if (s && J(t.job).steps[s.step]?.who === 'kt') { s.accounts = KT ? [KT] : []; s.names = s.accounts.map(nm); n++; } }); return n; },
    app_pc_reassign({ p_task, p_accounts }) { const t = TASKS.find((x) => x.id === p_task); const s = t.steps.find((x) => !x.done_at); s.accounts = p_accounts; s.names = p_accounts.map(nm); },
    app_pc_step_done({ p_task }) { const t = TASKS.find((x) => x.id === p_task); const s = t.steps.find((x) => !x.done_at); if (s.step < t.auto) err('Bước này tự xong khi làm xong hồ sơ.'); s.done_at = now(); t.done_at = now(); DONE.unshift({ title: t.title, code: t.code, job: t.job, done_at: now(), by: nm(ME), late: false }); },
    app_pc_report_done({ p_task, p_note, p_photos }) {
      const t = TASKS.find((x) => x.id === p_task); const s = t.steps.find((x) => !x.done_at);
      if (!(t.custom && !s.check) && !s.redo) err('Việc này tự xong khi làm xong hồ sơ.');
      if (t.need_photo && !(p_photos || []).length) err('Cần ít nhất 1 ảnh mới báo xong được.');
      Object.assign(s, { note: p_note || null, photos: p_photos || [], done_at: now(), done_by: nm(ME) });
      if (t.need_check) { const sc = SC(t.branch_id); const c = Object.assign(step(1, 'Kiểm tra', sc.checkers, now(), at(sc.check_h)), { check: true }); t.steps.push(c); }
      else { t.done_at = now(); DONE.unshift({ title: t.title, code: t.code, job: t.job, done_at: now(), by: nm(ME), late: false }); }
    },
    app_pc_check({ p_task, p_ok, p_note, p_hours }) {
      const t = TASKS.find((x) => x.id === p_task); const s = t.steps.find((x) => !x.done_at);
      if (!s?.check) err('Việc này chưa tới bước kiểm tra.');
      if (p_ok) { s.done_at = now(); t.done_at = now(); DONE.unshift({ title: t.title, code: t.code, job: t.job, done_at: now(), by: nm(ME), late: false }); return; }
      if (!String(p_note || '').trim()) err('Ghi lý do làm lại.');
      if (![4, 12, 24, 48, 72].includes(+p_hours)) err('Chọn hạn làm lại.');
      Object.assign(s, { done_at: now(), note: p_note.trim() }); const w = t.steps.filter((x) => !x.check).slice(-1)[0];
      t.steps.push(Object.assign(step(0, w.name, w.accounts, now(), at(+p_hours)), { redo: true }));
    },
    app_pc_penalties() { return { can_edit: isChu, now: now(), default_fine: 50000, rows: PEN }; },
    app_pc_penalty_set({ p_id, p_status, p_amount, p_reason }) {
      if (!isChu) err('Chỉ tài khoản Chủ xác nhận phạt.');
      const p = PEN.find((x) => x.id === p_id); if (p_status === 'bo' && !p_reason) err('Ghi lý do bỏ qua.');
      Object.assign(p, { status: p_status, amount: p_status === 'phat' ? p_amount : null, reason: p_status === 'phat' ? 'Bị phạt do không hoàn thành công việc đúng hạn' : p_status === 'bo' ? p_reason : null, decided_at: p_status === 'cho' ? null : now() });
    },
    app_gv_create({ p }) {
      if (!p.content?.trim()) err('Ghi nội dung việc.'); if (!p.assignee_id) err('Chọn người làm.'); if (!p.reviewer_id) err('Chọn người kiểm tra.');
      if (String(p.reviewer_id) === String(p.assignee_id)) err('Người kiểm tra phải khác người làm.');
      const a = +p.assignee_id, r = +p.reviewer_id;
      const k = gv({ content: p.content.trim(), branch_id: p.branch_id ? +p.branch_id : null, status: a === ME ? 'dang_xu_ly' : 'da_giao', giver_id: ME, giver: nm(ME), assignee_id: a, assignee: nm(a), reviewer_id: r, reviewer: nm(r), due: p.due + ':00', priority: p.priority, src: nm(ME) + ' giao tay', handover: false });
      GV.push(k); evAdd(k, ME, `Giao cho ${nm(a)} · kiểm tra: ${nm(r)}`); return k.id;
    },
    app_gv_classify({ p_task, p }) {
      const k = findG(p_task);
      if (p.mode === 'bo') { if (!p.reason?.trim()) err('Ghi lý do không cần xử lý.'); k.status = 'bo'; k.cancelled_at = now(); evAdd(k, ME, 'Không cần xử lý: ' + p.reason); return; }
      const a = p.mode === 'tu' ? ME : +p.assignee_id; if (!a) err('Chọn người làm.'); if (!p.reviewer_id) err('Chọn người kiểm tra.'); if (+p.reviewer_id === a) err('Người kiểm tra phải khác người làm.');
      Object.assign(k, { status: a === ME ? 'dang_xu_ly' : 'da_giao', giver_id: ME, giver: nm(ME), assignee_id: a, assignee: nm(a), reviewer_id: +p.reviewer_id, reviewer: nm(+p.reviewer_id), due: p.due + ':00', priority: p.priority, cls_due: null, classifiers: null });
      evAdd(k, ME, (p.mode === 'tu' ? 'Tự làm' : 'Giao cho ' + nm(a)) + ' · kiểm tra: ' + nm(+p.reviewer_id));
    },
    app_gv_accept({ p_task }) { const k = findG(p_task); k.status = 'dang_xu_ly'; evAdd(k, ME, 'Đã nhận việc'); },
    app_gv_progress({ p_task, p_note, p_photo }) { if (!p_note?.trim()) err('Ghi vài chữ về tiến độ.'); evAdd(findG(p_task), ME, p_note.trim(), p_photo); },
    app_gv_ext({ p_task, p_days, p_reason }) { if (!p_reason?.trim()) err('Ghi lý do xin gia hạn.'); const k = findG(p_task); k.ext = { days: p_days, reason: p_reason.trim(), at: now() }; evAdd(k, ME, 'Xin gia hạn thêm ' + p_days + ' ngày: ' + p_reason); },
    app_gv_ext_decide({ p_task, p_ok }) { const k = findG(p_task); if (p_ok) k.due = at(k.ext.days * 24); evAdd(k, ME, p_ok ? 'Đồng ý gia hạn' : 'Không đồng ý gia hạn'); k.ext = null; },
    app_gv_submit({ p_task, p_result, p_photo }) {
      if (!p_photo) err('Cần ảnh kết quả.'); const k = findG(p_task);
      Object.assign(k, { status: 'cho_duyet', result: p_result, result_photo: p_photo, review_due: at(24), ext: null }); evAdd(k, ME, 'Báo xong: ' + p_result, p_photo);
    },
    app_gv_review({ p_task, p_ok, p_note, p_days }) {
      const k = findG(p_task);
      if (p_ok) { k.status = 'hoan_thanh'; k.approved_at = now(); evAdd(k, ME, 'Kiểm tra: Đạt — đóng việc'); }
      else { if (!p_note?.trim()) err('Ghi lý do làm lại.'); k.status = 'dang_xu_ly'; k.due = at((p_days || 1) * 24); evAdd(k, ME, 'Kiểm tra: Làm lại — ' + p_note); }
    },
    app_gv_reassign({ p_task, p_assignee, p_reviewer }) {
      const k = findG(p_task); if ((p_reviewer || k.reviewer_id) === (p_assignee || k.assignee_id)) err('Người kiểm tra phải khác người làm.');
      Object.assign(k, { assignee_id: p_assignee || k.assignee_id, assignee: nm(p_assignee || k.assignee_id), reviewer_id: p_reviewer || k.reviewer_id, reviewer: nm(p_reviewer || k.reviewer_id) }); evAdd(k, ME, 'Đổi người');
    },
    app_gv_detail({ p_task }) { const k = findG(p_task); return { ...k, events: [{ at: k.created_at, by: 'Nhân viên ca', action: 'x', note: 'Ghi bàn giao ở phiếu ca: ' + k.content, photo: null }, ...EV[k.id]] }; },
  };
}
