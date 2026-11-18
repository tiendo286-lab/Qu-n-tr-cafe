// Giả lập app_stc_* (Sổ thu chi mới). Đợt 1: đọc (app_stc_month / app_stc_ext). Đợt 2a: sửa / thêm / xoá khoản ngoài ca, người nợ ✓,
// làm giống máy chủ trên bản sao dữ liệu giả: khoản cũ thành void (gạch ngang), khoản mới có edit (phiếu bổ sung).
import { EXT, MONTH } from '../test/stc_fixture.js';

const copy = (o) => JSON.parse(JSON.stringify(o));
export function makeStc(T, me) {
  const admin = () => ['chu', 'ql_tong'].includes(me.role);
  let ST = null; const st = () => ST || (ST = copy(MONTH));
  let V = 0, N = 1000;
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const by = () => me.name || 'Chủ';
  const need = () => { if (!['chu', 'ql_tong', 'ql'].includes(me.role)) throw new Error('Bạn không được sửa thu chi của cơ sở này.'); };
  const reason = (r) => { if (!String(r || '').trim()) throw new Error('Ghi lý do sửa / xoá.'); return String(r).trim(); };
  const items = () => st().items;
  const voidOf = (x, action, r) => { const v = { ...copy(x), id: 'v:' + (++V), void: true, can_edit: false, void_info: { action, by: by(), at: now(), reason: r } }; delete v.edit; return v; };
  const edit = (action, r, old) => ({ action, by: by(), at: now(), reason: r || null, old_amount: old ?? null });
  const catName = (id) => (T.fin_categories || []).find((c) => c.id === Number(id))?.name || null;
  const pmOf = (m) => (m === 'chuyen_khoan' ? 'ck' : 'tm');
  const entryItem = (id, p) => ({ id: 'e:' + id, date: p.entry_date, ca_id: null, book: p.kind === 'chi' ? 'chi' : 'thu', pm: pmOf(p.pay_method), col: p.kind === 'chi' ? 'chi' : 'khac',
    amount: Number(p.amount), title: p.note, meta: 'Quản lý tạo', cat: catName(p.category_id), checked: true, no_cost: false, src: 'entry', can_edit: true });
  const legs = (id, p) => { const [o, i] = p.direction === 'tm_tk' ? ['tm', 'ck'] : ['ck', 'tm'];
    const t = (p.direction === 'tm_tk' ? 'Nộp tiền mặt vào tài khoản' : 'Rút tài khoản ra tiền mặt') + (p.note ? ' · ' + p.note : '');
    return [{ id: `t:${id}:chi`, date: p.date, ca_id: null, book: 'chi', pm: o, col: 'lc', amount: Number(p.amount), title: t, meta: 'Luân chuyển quỹ', src: 'transfer', can_edit: true },
      { id: `t:${id}:thu`, date: p.date, ca_id: null, book: 'thu', pm: i, col: 'lc', amount: Number(p.amount), title: t, meta: 'Luân chuyển quỹ', src: 'transfer', can_edit: true }]; };
  const amountOk = (a) => { if (!(Number(a) > 0)) throw new Error('Nhập số tiền lớn hơn 0.'); };
  const gapAll = () => items().filter((x) => x.gap && !x.void);
  const gapIt = (rid, kind) => {
    if (!['chu', 'ql_tong', 'ql'].includes(me.role)) throw new Error('Bạn không được xử lý lệch tiền của cơ sở này.');
    const ca = st().cas.find((c) => c.id === Number(rid)); if (!ca?.recon_money_done) throw new Error('Ca chưa chốt tiền — chốt ở tab Đối soát tiền trước.');
    const x = gapAll().find((i) => i.ca_id === Number(rid) && i.gap.kind === kind); if (!x) throw new Error('Không tìm thấy khoản lệch.'); return x;
  };
  const gapAmt = (a, avail) => { amountOk(a); if (Number(a) > avail) throw new Error('Chỉ còn ' + avail + ' chờ xử lý.'); };
  const caLab = (rid) => { const c = st().cas.find((i) => i.id === Number(rid)); return c ? `ca ${c.shift} ${c.date.slice(8, 10)}/${c.date.slice(5, 7)}` : ''; };
  const matchApply = (x, a) => { x.amount -= a; x.gap.remain -= a; };
  const gapStat = (x) => { const g = x.gap; const wait = g.qc_wait.length || g.matches.some((m) => m.status === 'cho_duyet');
    x.status = (g.remain <= 0 ? 'Đã xử lý' : g.kind === 'thieu' ? 'Chờ xử lý · chưa làm phiếu trừ tiền' : 'Chờ xử lý (dư)') + (wait ? ' · ⏳ chờ Chủ duyệt' : '');
    gapAll().forEach((y) => y.gap.cands.forEach((c) => { const o = gapAll().find((i) => i.ca_id === c.report && i.gap.kind !== y.gap.kind); if (o) c.amount = o.gap.avail; })); };
  return {
    app_stc_month({ p_branch, p_month }) {
      if (!admin()) throw new Error('Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.');
      const d = copy(st()); d.owner = me.role === 'chu';
      const b = d.branches.find((x) => x.id === Number(p_branch)) || d.branches[0];
      d.branch = { id: b.id, code: b.code, name: b.code };
      if (p_month !== '2026-11') { Object.assign(d, { month: p_month, from: p_month + '-01', to: p_month + '-28', cas: [], items: [], compare: { fund_days: [], gaps: [] } }); }
      return d;
    },
    app_stc_ext({ p_month }) {
      if (me.role !== 'chu') throw new Error('Quỹ ngoài: chỉ Chủ xem được.');
      const d = copy(EXT); if (p_month !== '2026-11') { d.month = p_month; d.items = []; }
      return d;
    },
    app_stc_entry_save({ p_id, p, p_reason }) {
      need(); amountOk(p.amount); if (!String(p.note || '').trim()) throw new Error(`Ghi nội dung khoản ${p.kind === 'chi' ? 'chi' : 'thu'}.`);
      if (p_id) { const r = reason(p_reason); const x = items().find((i) => i.id === 'e:' + p_id); const old = x.amount;
        items().push(voidOf(x, 'sua', r)); Object.assign(x, entryItem(p_id, p), { edit: edit('sua', r, old) }); return p_id; }
      const id = ++N; items().push({ ...entryItem(id, p), edit: edit('them', p_reason) }); return id;
    },
    app_stc_entry_delete({ p_id, p_reason }) {
      need(); const r = reason(p_reason); const i = items().findIndex((x) => x.id === 'e:' + p_id);
      items().push(voidOf(items()[i], 'xoa', r)); items().splice(i, 1);
    },
    app_stc_transfer_save({ p_id, p, p_reason }) {
      need(); amountOk(p.amount);
      if (p_id) { const r = reason(p_reason); const ls = legs(p_id, p);
        ls.forEach((l) => { const x = items().find((i) => i.id === l.id); const old = x.amount; items().push(voidOf(x, 'sua', r)); Object.assign(x, l, { edit: edit('sua', r, old) }); }); return p_id; }
      const id = ++N; legs(id, p).forEach((l) => items().push({ ...l, edit: edit('them', p_reason) })); return id;
    },
    app_stc_transfer_delete({ p_id, p_reason }) {
      need(); const r = reason(p_reason);
      items().filter((x) => x.id.startsWith(`t:${p_id}:`)).forEach((x) => { items().push(voidOf(x, 'xoa', r)); items().splice(items().indexOf(x), 1); });
    },
    app_stc_debt_save({ p_id, p, p_reason }) {
      need(); amountOk(p.amount); if (!String(p.name || '').trim()) throw new Error('Ghi tên người nợ.');
      const id = p_id || ++N; const pm = p.kind === 'ck' ? 'ck' : 'tm';
      const it = { id: 'dn:' + id, date: p.date, ca_id: null, book: 'chi', pm, col: 'no', amount: Number(p.amount), title: (pm === 'ck' ? 'Nợ CK: ' : 'Nợ TM: ') + p.name,
        meta: 'Quản lý ghi, tiền đưa từ quỹ', src: 'debt', can_edit: true, edit: edit('them', p_reason) };
      items().push(it);
      const pe = st().people.find((x) => x.name.toLowerCase() === p.name.toLowerCase());
      st().open_debts.push({ id: 'd:' + id, who: p.name, kind: p.kind, amount: Number(p.amount), left: Number(p.amount), date: p.date, from: 'quản lý ghi', no_remind: !!pe?.no_remind });
      if (pe) { pe.open += Number(p.amount); pe.n += 1; } else st().people.push({ name: p.name, no_remind: false, open: Number(p.amount), n: 1 });
      return id;
    },
    app_stc_collect({ p_debt, p, p_reason }) {
      need(); amountOk(p.amount); const od = st().open_debts.find((d) => d.id === 'd:' + p_debt); if (!od) throw new Error('Không tìm thấy khoản nợ.');
      if (Number(p.amount) > od.left) throw new Error('Số tiền thu phải lớn hơn 0 và không quá ' + od.left + '.');
      items().push({ id: 'dc:' + p_debt + ':' + (++V), date: p.date, ca_id: null, book: 'thu', pm: pmOf(p.kind), col: 'no', amount: Number(p.amount), title: od.who,
        meta: 'Quản lý thu ngoài ca', from: od.from, src: 'debt', can_edit: true, edit: edit('them', p_reason), debt_ref: od.id });
      od.left -= Number(p.amount); if (od.left <= 0) st().open_debts.splice(st().open_debts.indexOf(od), 1);
    },
    app_stc_uncollect({ p_debt, p_reason }) {
      need(); const r = reason(p_reason); const x = items().find((i) => i.id === 'dc:' + p_debt || i.id.startsWith('dc:' + p_debt + ':'));
      items().push(voidOf(x, 'xoa', r)); items().splice(items().indexOf(x), 1);
      const od = st().open_debts.find((d) => d.id === (x.debt_ref || 'd:' + p_debt));
      if (od) od.left += x.amount; else st().open_debts.push({ id: x.debt_ref || 'd:' + p_debt, who: x.title, kind: 'bill', amount: x.amount, left: x.amount, date: x.date, from: x.from || '', no_remind: false });
    },
    app_stc_move_save({ p_report, p_mkey, p, p_reason }) {
      need(); const r = reason(p_reason); const ca = st().cas.find((c) => c.id === Number(p_report));
      if (!ca?.recon_money_done) throw new Error('Ca chưa chốt tiền — chốt ở tab Đối soát tiền trước.');
      const id = p_mkey ? `m:${p_report}:${p_mkey}` : null; const x = id ? items().find((i) => i.id === id) : null;
      if (p.delete) { items().push(voidOf(x, 'xoa', r)); items().splice(items().indexOf(x), 1); return null; }
      amountOk(Math.abs(p.amount)); if (!String(p.note || x?.title || '').trim()) throw new Error('Ghi nội dung khoản.');
      const nk = 'n' + (++N);
      const it = { id: `m:${p_report}:${nk}`, date: ca.date, ca_id: ca.id, book: p.amount < 0 ? 'chi' : 'thu', pm: pmOf(p.kind), col: p.amount < 0 ? 'chi' : 'khac', amount: Math.abs(p.amount),
        title: p.note || x?.title, meta: 'Phiếu ca', cat: catName(p.category_id) || x?.cat || null, src: 'move', can_edit: true };
      if (x) { items().push(voidOf(x, 'sua', r)); items().splice(items().indexOf(x), 1, { ...it, edit: edit('sua', r, x.amount) }); }
      else items().push({ ...it, edit: edit('them', r) });
      return nk;
    },
    // đợt 3: phiếu chênh lệch (giống app_stc_gap_* trên máy chủ, trên dữ liệu giả)
    app_stc_gap_tl({ p_report, p_item, p_people, p_reason }) {
      const x = gapIt(p_report, 'thieu'); reason(p_reason); const g = x.gap;
      const tot = (p_people || []).reduce((a, p) => a + Number(p.amount || 0), 0);
      if (tot > g.avail) throw new Error('Tổng trừ lương lớn hơn phần còn chờ xử lý (' + g.avail + ').');
      (p_people || []).filter((p) => Number(p.amount) > 0).forEach((p) => g.tl.push({ id: ++N, name: g.people.find((e) => e.id === Number(p.employee_id))?.name || '?', amount: Number(p.amount), status: 'cho' }));
      g.remain -= tot; g.avail -= tot; g.has_tl = g.tl.length > 0; gapStat(x);
    },
    app_stc_gap_qc({ p_report, p_amount, p_reason }) {
      const x = gapIt(p_report, 'thieu'); const r = reason(p_reason); const g = x.gap; gapAmt(p_amount, g.avail);
      if (me.role === 'chu') { g.decisions.push({ id: ++N, kind: 'quan_chiu', amount: Number(p_amount) }); g.remain -= p_amount; g.avail -= p_amount; gapStat(x); return 'ok'; }
      g.qc_wait.push({ id: ++N, amount: Number(p_amount), by: by(), reason: r }); g.avail -= p_amount; gapStat(x); return 'cho_duyet';
    },
    app_stc_gap_match({ p_short, p_over, p_amount, p_reason }) {
      const s = gapIt(p_short, 'thieu'), o = gapIt(p_over, 'du'); reason(p_reason);
      if (s.gap.has_tl) throw new Error('Đã tạo phiếu trừ tiền — huỷ phiếu trừ tiền trước khi ghép.');
      gapAmt(p_amount, s.gap.avail); if (p_amount > o.gap.avail) throw new Error('Ca dư chỉ còn ' + o.gap.avail + ' để ghép.');
      const id = ++N; const st0 = me.role === 'chu' ? 'da_duyet' : 'cho_duyet';
      s.gap.matches.push({ id, amount: Number(p_amount), status: st0, side: 'thieu', with: caLab(p_over) });
      o.gap.matches.push({ id, amount: Number(p_amount), status: st0, side: 'du', with: caLab(p_short) });
      [s, o].forEach((x) => { x.gap.avail -= p_amount; if (st0 === 'da_duyet') matchApply(x, p_amount); gapStat(x); });
      return st0 === 'da_duyet' ? 'ok' : 'cho_duyet';
    },
    app_stc_gap_thu({ p_report, p_amount, p_reason }) {
      const x = gapIt(p_report, 'du'); reason(p_reason); const g = x.gap; gapAmt(p_amount, g.avail);
      g.decisions.push({ id: ++N, kind: 'thu_khac', amount: Number(p_amount) }); g.remain -= p_amount; g.avail -= p_amount; g.has_thu = true; gapStat(x);
    },
    app_stc_gap_approve({ p_kind, p_id, p_ok }) {
      if (me.role !== 'chu') throw new Error('Chỉ Chủ duyệt.');
      gapAll().forEach((x) => {
        const g = x.gap;
        if (p_kind === 'qc') { const q = g.qc_wait.find((w) => w.id === p_id); if (!q) return; g.qc_wait.splice(g.qc_wait.indexOf(q), 1);
          if (p_ok) { g.decisions.push({ id: ++N, kind: 'quan_chiu', amount: q.amount }); g.remain -= q.amount; } else g.avail += q.amount; }
        if (p_kind === 'match') { const m = g.matches.find((w) => w.id === p_id && w.status === 'cho_duyet'); if (!m) return;
          if (p_ok) { m.status = 'da_duyet'; matchApply(x, m.amount); } else { g.matches.splice(g.matches.indexOf(m), 1); g.avail += m.amount; } }
        gapStat(x);
      });
    },
    app_stc_gap_undo({ p_kind, p_id, p_reason }) {
      reason(p_reason);
      gapAll().forEach((x) => {
        const g = x.gap; const list = { tl: g.tl, decision: g.decisions, match: g.matches, qc: g.qc_wait }[p_kind];
        const e = list.find((w) => w.id === p_id); if (!e) return; list.splice(list.indexOf(e), 1);
        if (p_kind === 'match' && e.status === 'da_duyet') { x.amount += e.amount; g.remain += e.amount; }
        else if (p_kind === 'tl' || p_kind === 'decision') g.remain += e.amount;
        g.avail += e.amount; g.has_tl = g.tl.length > 0; g.has_thu = g.decisions.some((d) => d.kind === 'thu_khac'); gapStat(x);
      });
    },
    app_stc_person_mark({ p_name, p_no_remind }) {
      need(); const pe = st().people.find((x) => x.name.toLowerCase() === String(p_name).toLowerCase()); if (pe) pe.no_remind = !!p_no_remind;
      st().open_debts.filter((d) => d.who.toLowerCase() === String(p_name).toLowerCase()).forEach((d) => { d.no_remind = !!p_no_remind; });
      return 1;
    },
  };
}
