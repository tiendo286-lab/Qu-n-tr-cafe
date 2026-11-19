// Giả lập app_stc_* (Sổ thu chi mới). Đợt 1: đọc (app_stc_month / app_stc_ext). Đợt 2a: sửa / thêm / xoá khoản ngoài ca, người nợ ✓,
// làm giống máy chủ trên bản sao dữ liệu giả: khoản cũ thành void (gạch ngang), khoản mới có edit (phiếu bổ sung).
import { EXT, MONTH } from '../test/stc_fixture.js';
import { makeFund } from '../test/fund_gia.js';

const copy = (o) => JSON.parse(JSON.stringify(o));
export function makeStc(T, me) {
  const admin = () => ['chu', 'ql_tong'].includes(me.role);
  let ST = null; const st = () => ST || (ST = copy(MONTH));
  let EX = null; const ex = () => EX || (EX = copy(EXT));
  const base = makeFund(T, me);   // đợt 5: hàm Sổ quỹ cũ, giữ T đồng bộ cho trang cũ
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
  const SH = ['Sáng', 'Chiều', 'Tối'];
  // bước 151: Chốt ca vĩnh viễn + Khoản treo (giống máy chủ 135)
  const FIN = {}; const TREO = []; let TN = 0;
  const finGuard = (rid) => { if (FIN[Number(rid)]) throw new Error('Ca này đã CHỐT CA (khoá vĩnh viễn) nên không sửa được.'); };
  const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const dd = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const treoLeft = (t) => t.amount - t.used;
  const dsCa = (rid, open) => {
    if (!['chu', 'ql_tong', 'ql'].includes(me.role)) throw new Error('Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này đối soát tiền được.');
    const c = st().cas.find((x) => x.id === Number(rid)); if (!c) throw new Error('Không tìm thấy ca.');
    finGuard(rid);
    if (open && c.recon_money_done) throw new Error('Ca đã chốt tiền — bấm "Mở lại chốt" trước khi sửa.'); return c;
  };
  const expOpen = (c) => { const i = SH.indexOf(c.shift); if (i <= 0) return { exp: 1000000, prev: null };
    const prev = st().cas.find((x) => x.date === c.date && x.shift === SH[i - 1]); if (!prev) return { exp: null, prev: null };
    return { exp: prev.cash_mode === 'ca' ? 1000000 : Number(prev.real_tm ?? 0), prev }; };
  const gapAll = () => items().filter((x) => x.gap && !x.void);
  const gapIt = (rid, kind) => {
    if (!['chu', 'ql_tong', 'ql'].includes(me.role)) throw new Error('Bạn không được xử lý lệch tiền của cơ sở này.');
    const ca = st().cas.find((c) => c.id === Number(rid)); if (!ca?.recon_money_done) throw new Error('Ca chưa chốt tiền — chốt ở tab Đối soát tiền trước.');
    finGuard(rid);
    const x = gapAll().find((i) => i.ca_id === Number(rid) && i.gap.kind === kind); if (!x) throw new Error('Không tìm thấy khoản lệch.'); return x;
  };
  const ganUndo = (dc, r) => {
    const { snap, odSnap } = dc.gan; items().push(voidOf(dc, 'xoa', r)); items().splice(items().indexOf(dc), 1);
    const cur = items().find((i) => i.id === snap.id && !i.void); if (cur) items().splice(items().indexOf(cur), 1, snap); else items().push(snap);
    const od = st().open_debts.find((d) => d.id === odSnap.id); if (od) od.left = odSnap.left; else st().open_debts.push(odSnap);
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
      const d = copy(ex()); d.items.forEach((x) => { if (x.id.startsWith('x:')) x.can_edit = true; }); if (p_month !== '2026-11') { d.month = p_month; d.items = []; }
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
      if (x?.gan) return ganUndo(x, r);
      items().push(voidOf(x, 'xoa', r)); items().splice(items().indexOf(x), 1);
      const od = st().open_debts.find((d) => d.id === (x.debt_ref || 'd:' + p_debt));
      if (od) od.left += x.amount; else st().open_debts.push({ id: x.debt_ref || 'd:' + p_debt, who: x.title, kind: 'bill', amount: x.amount, left: x.amount, date: x.date, from: x.from || '', no_remind: false });
    },
    app_stc_move_save({ p_report, p_mkey, p, p_reason }) {
      need(); const r = reason(p_reason); const ca = st().cas.find((c) => c.id === Number(p_report)); finGuard(p_report);
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
    // Task 3: gán nợ khách trả — nợ đóng vào ca dư, lệch tự giảm (hết dư thì mất khoản lệch; ≤ 5.000 thì coi như khớp)
    app_stc_gap_debt({ p_report, p_debt, p_amount, p_reason }) {
      const x = gapIt(p_report, 'du'); const r = reason(p_reason); const g = x.gap;
      if (g.has_thu) throw new Error('Đã tạo phiếu thu — huỷ phiếu thu trước khi gán nợ.');
      gapAmt(p_amount, g.avail); const a = Number(p_amount);
      const od = st().open_debts.find((d) => d.id === 'd:' + p_debt); if (!od) throw new Error('Khoản nợ này đã được thu hoặc không còn.');
      if (od.date > x.date) throw new Error('Khoản nợ ghi sau ngày của ca này.');
      if (a > od.left) throw new Error('Khách trả nhiều hơn số nợ (' + od.left + ').');
      const snap = copy(x); const odSnap = copy(od);
      od.left -= a; if (od.left <= 0) st().open_debts.splice(st().open_debts.indexOf(od), 1);
      items().push({ id: 'dc:' + p_debt, date: x.date, ca_id: x.ca_id, book: 'thu', pm: x.pm, col: 'no', amount: a, title: od.who, meta: 'Gán nợ khách trả (quản lý)',
        from: od.from, src: 'debt', can_edit: true, edit: edit('them', r), gan: { snap, odSnap } });
      x.amount -= a; x.gross = (x.gross ?? snap.amount) - a; g.total -= a; g.remain -= a; g.avail -= a; g.debts.push({ id: Number(p_debt), who: od.who, amount: a });
      if (x.amount <= 0) items().splice(items().indexOf(x), 1);
      else if (x.amount <= 5000) { x.gap = null; x.status = 'Lệch nhỏ ≤ 5.000 (coi như khớp)'; } else gapStat(x);
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
      const rr = reason(p_reason);
      if (p_kind === 'debt') { const dc = items().find((i) => i.id === 'dc:' + p_id && i.gan); if (!dc) throw new Error('Không phải khoản gán nợ của Sổ thu chi.'); return ganUndo(dc, rr); }
      gapAll().forEach((x) => {
        const g = x.gap; const list = { tl: g.tl, decision: g.decisions, match: g.matches, qc: g.qc_wait }[p_kind];
        const e = list.find((w) => w.id === p_id); if (!e) return; list.splice(list.indexOf(e), 1);
        if (p_kind === 'match' && e.status === 'da_duyet') { x.amount += e.amount; g.remain += e.amount; }
        else if (p_kind === 'tl' || p_kind === 'decision') g.remain += e.amount;
        g.avail += e.amount; g.has_tl = g.tl.length > 0; g.has_thu = g.decisions.some((d) => d.kind === 'thu_khac'); gapStat(x);
      });
    },
    // đợt 5: Chuyển về Quỹ ngoài (= phiếu rút) — gọi hàm cũ (T) rồi phản chiếu vào sổ cơ sở + Quỹ ngoài
    app_fund_withdraw_save({ p_id, p }) {
      const inT = !p_id || T.fund_withdrawals.some((w) => w.id === p_id);
      const old = p_id ? items().find((i) => i.id === 'w:' + p_id) : null;
      if (old?.recv === 'da') throw new Error('Chủ đã xác nhận nhận tiền nên phiếu này không sửa được nữa.');
      const id = inT ? base.app_fund_withdraw_save({ p_id, p }) : (amountOk(p.amount), p_id);
      const pm = pmOf(p.method); const t = 'Chuyển về Quỹ ngoài' + (p.note ? ' · ' + p.note : '');
      const meta = p.kind === 'cuoi_thang' ? 'Phiếu rút cuối tháng (cũ)' : 'Phiếu rút giữ hộ (cũ)';
      const row = { date: p.wdate, ca_id: null, pm, col: 'lc', amount: Number(p.amount), meta, status: 'Chờ Chủ nhận', recv: 'cho', src: 'withdrawal', checked: true, no_cost: true };
      const up = (list, it) => { const i = list.findIndex((x) => x.id === it.id); if (i >= 0) list[i] = { ...list[i], ...it }; else list.push(it); };
      up(items(), { ...row, id: 'w:' + id, book: 'chi', title: t, to_qn: true });
      up(ex().items, { ...row, id: 'w:' + id, book: 'thu', title: 'Từ ' + (st().branch?.code || 'LHP') + ' chuyển về' + (p.note ? ' · ' + p.note : ''), from: 'LHP' });
      return id;
    },
    app_fund_withdraw_delete({ p_id }) {
      if (items().find((i) => i.id === 'w:' + p_id)?.recv === 'da') throw new Error('Chủ đã xác nhận nhận tiền nên phiếu này không xóa được.');
      if (T.fund_withdrawals.some((w) => w.id === p_id)) base.app_fund_withdraw_delete({ p_id });
      [items(), ex().items].forEach((l) => { const i = l.findIndex((x) => x.id === 'w:' + p_id); if (i >= 0) l.splice(i, 1); });
    },
    app_fund_withdraw_confirm({ p_id }) {
      if (me.role !== 'chu') throw new Error('Chỉ Chủ xác nhận đã nhận tiền.');
      if (T.fund_withdrawals.some((w) => w.id === p_id)) base.app_fund_withdraw_confirm({ p_id });
      [items(), ex().items].forEach((l) => { const x = l.find((i) => i.id === 'w:' + p_id); if (x) Object.assign(x, { recv: 'da', status: 'Chủ đã nhận · khoá' }); });
    },
    // đợt 5: khoản chi / thu ngoài của Quỹ ngoài
    app_ext_month({ p_month }) {
      const d = base.app_ext_month({ p_month });
      ex().items.filter((x) => x.id.startsWith('x:') && !d.entries.some((e) => 'x:' + e.id === x.id)).forEach((x) => d.entries.push({ id: Number(x.id.slice(2)), entry_date: x.date,
        kind: x.book === 'chi' ? 'chi' : 'thu', category_id: (T.fin_categories || []).find((c) => c.name === x.cat)?.id || null, note: x.title, amount: x.amount,
        pay_method: x.pm === 'ck' ? 'chuyen_khoan' : 'tien_mat', alloc_mode: x.alloc_mode || 'doanh_thu', alloc_branch: null, manual: {}, alloc: [], ok: true, fixed: false, category: x.cat }));
      return d;
    },
    app_ext_entry_save({ p_id, p }) {
      const inT = !p_id || T.ext_entries.some((e) => e.id === p_id);
      if (!inT) { amountOk(p.amount); if (!String(p.note || '').trim()) throw new Error('Ghi nội dung khoản ' + p.kind + '.'); }
      const id = inT ? base.app_ext_entry_save({ p_id, p }) : p_id;
      const it = { id: 'x:' + id, date: p.entry_date, ca_id: null, book: p.kind === 'chi' ? 'chi' : 'thu', pm: pmOf(p.pay_method), col: p.kind === 'chi' ? 'chi' : 'khac',
        amount: Number(p.amount), title: p.note, meta: 'Chủ ghi', cat: catName(p.category_id), checked: true, no_cost: false, src: 'ext', alloc_mode: p.alloc_mode };
      const l = ex().items; const i = l.findIndex((x) => x.id === it.id); if (i >= 0) l[i] = it; else l.push(it);
      return id;
    },
    app_ext_entry_delete({ p_id }) {
      if (T.ext_entries.some((e) => e.id === p_id)) base.app_ext_entry_delete({ p_id });
      const l = ex().items; const i = l.findIndex((x) => x.id === 'x:' + p_id); if (i >= 0) l.splice(i, 1);
    },
    // đợt 4: Đối soát tiền 3 bước (giống app_stc_ds_* trên máy chủ)
    app_stc_ds_fabi({ p_report, p_field, p_name }) {
      const c = dsCa(p_report, true); const f = c.fabi;
      if (!f?.has) throw new Error('Chưa có file Fabi của ca này — chờ kế toán tải lên.');
      if (p_field === 'mo') { c.nv.opening = f.opening; c.start_tm = f.opening; }
      else if (p_field === 'dt') c.nv.revenue = f.revenue;
      else if (p_field === 'no') { const diff = f.debt - c.nv.debt; c.nv.debt = f.debt;
        if (diff > 0 && String(p_name || '').trim()) st().open_debts.push({ id: 'd:' + (++N), who: p_name.trim(), kind: 'bill', amount: diff, left: diff, date: c.date, from: `ca ${c.shift} ${c.date.slice(8, 10)}/${c.date.slice(5, 7)}`, no_remind: false }); }
      else throw new Error('Ô cần sửa không hợp lệ.');
    },
    app_stc_ds_blame({ p_report, p_who, p_reason }) {
      const c = dsCa(p_report, true); const r = reason(p_reason); if (c.blame) throw new Error('Đã chọn ca chịu lệch mở ca — huỷ trước khi chọn lại.');
      const { exp, prev } = expOpen(c); const diff = Number(c.fabi.opening) - exp; if (!diff) throw new Error('Tiền mở ca đã đúng — không cần chọn.');
      if (p_who === 'truoc') { if (!prev) throw new Error('Ca đầu ngày không có ca trước — chọn "Ca này ghi sai".');
        if (prev.cash_mode === 'ca') throw new Error('Ca trước thu theo ca (đã giao lại 1.000.000) — chọn "Ca này ghi sai".'); prev.real_tm = Number(prev.real_tm || 0) + diff; }
      else c.start_tm = exp;
      c.blame = { who: p_who, diff, reason: r, by: by() };
    },
    app_stc_ds_blame_undo({ p_report, p_reason }) {
      const c = dsCa(p_report, true); reason(p_reason); if (!c.blame) throw new Error('Chưa chọn ca chịu lệch mở ca.');
      if (c.blame.who === 'nay') c.start_tm = Number(c.start_tm) + c.blame.diff; else { const { prev } = expOpen(c); prev.real_tm -= c.blame.diff; }
      c.blame = null;
    },
    app_stc_ds_cash({ p_report, p_mode, p_counted }) {
      const c = dsCa(p_report, true); if (!['ca', 'ngay'].includes(p_mode)) throw new Error('Chọn thu theo ca hay theo ngày.');
      c.cash_mode = p_mode; if (p_mode === 'ca') c.ql_counted = p_counted ?? null; else { c.ql_counted = null; if (p_counted != null) c.real_tm = p_counted; }
    },
    app_stc_ds_close({ p_report }) {
      const c = dsCa(p_report, true);
      if (c.kt_wait || c.bank_ck == null || !c.fabi?.has) throw new Error('Chờ kế toán (file Fabi / số ngân hàng) rồi mới chốt.');
      const { exp } = expOpen(c); const f = c.fabi;
      if (c.nv.opening !== f.opening || (!c.blame && exp != null && f.opening !== exp) || c.nv.revenue !== f.revenue || c.nv.debt !== f.debt) throw new Error('Còn ô đỏ ở bước ① (tiền mở ca / doanh thu / nợ) — sửa xong mới chốt.');
      if (c.cash_mode === 'ca' && c.ql_counted == null) throw new Error('Nhập tiền mặt thực nhận ở bước ② trước.');
      c.recon_money_done = true; items().forEach((x) => { if (x.ca_id === c.id && x.id.startsWith('m:') && !x.void) x.can_edit = true; });
      return { tm: 0, ck: 0 };
    },
    app_stc_ds_reopen({ p_report, p_reason }) {
      const c = dsCa(p_report, false); reason(p_reason); c.recon_money_done = false;
      items().forEach((x) => { if (x.ca_id === c.id && x.id.startsWith('m:')) x.can_edit = false; });
    },
    app_stc_finals() {
      if (!admin()) throw new Error('Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.');
      const t0 = today();
      return { finals: Object.entries(FIN).map(([id, f]) => ({ id: Number(id), ...f })),
        treo: TREO.map((t) => { const c = st().cas.find((x) => x.id === t.report_id); const age = dd(c.date, t0);
          return { ...t, date: c.date, shift: c.shift, left: treoLeft(t), days_left: 3 - age, over: t.kind === 'tien' && t.status === 'mo' && age > 3, thu_khac: t.kind === 'thua' && t.status === 'mo' && c.date.slice(0, 7) < t0.slice(0, 7) }; }) };
    },
    app_stc_ca_final({ p_report }) {
      const c = dsCa(p_report, false);
      if (!c.recon_money_done) throw new Error('Chưa xác nhận Fabi — xác nhận ở phần A trước.');
      const mine = items().filter((x) => x.ca_id === c.id && !x.void);
      const todo = mine.filter((x) => x.book === 'chi' && x.col === 'chi' && !x.cat).length; if (todo) throw new Error(`Còn ${todo} khoản chi chưa phân loại.`);
      const gs = mine.filter((x) => x.gap);
      if (gs.some((x) => x.gap.qc_wait.length || x.gap.matches.some((m) => m.status === 'cho_duyet'))) throw new Error('Còn khoản chờ Chủ duyệt (quán chịu / ghép) — duyệt xong mới chốt.');
      const tm = gs.find((x) => x.gap.kind === 'thieu' && x.pm === 'tm' && x.gap.remain > 5000); if (tm) throw new Error(`Tiền mặt thiếu còn ${tm.gap.remain} chưa xử lý (trừ tiền / quán chịu / ghép).`);
      FIN[c.id] = { by: by(), at: now() }; const out = [];
      gs.filter((x) => x.gap.remain > 5000).forEach((x) => { const t = { id: ++TN, report_id: c.id, pm: x.pm, kind: x.gap.kind === 'thieu' ? 'tien' : 'thua', amount: x.gap.remain, used: 0, status: 'mo', done_kind: null, done_note: null }; TREO.push(t); out.push(t); });
      return { treo: out.map((t) => ({ id: t.id, item: t.pm === 'tm' ? 'tien_mat' : 'chuyen_khoan', kind: t.kind, amount: t.amount })) };
    },
    app_stc_treo_use({ p_treo, p_report, p_amount }) {
      const t = TREO.find((x) => x.id === Number(p_treo)); if (!t || t.status !== 'mo') throw new Error('Khoản treo không còn mở.');
      if (FIN[Number(p_report)]) throw new Error('Ca nhận đã chốt — chọn ca chưa chốt.');
      const kind = t.kind === 'tien' ? 'du' : 'thieu'; const y = gapAll().find((i) => i.ca_id === Number(p_report) && i.gap.kind === kind && i.pm === t.pm);
      amountOk(p_amount); if (Number(p_amount) > treoLeft(t)) throw new Error('Khoản treo chỉ còn ' + treoLeft(t) + '.');
      if (!y || Number(p_amount) > y.gap.avail) throw new Error('Ca nhận chỉ còn ' + (y ? y.gap.avail : 0) + (kind === 'du' ? ' tiền dư.' : ' tiền thiếu.'));
      y.gap.decisions.push({ id: ++N, kind: 'treo', amount: Number(p_amount) }); y.gap.remain -= p_amount; y.gap.avail -= p_amount; gapStat(y);
      t.used += Number(p_amount); if (treoLeft(t) <= 0) { t.status = 'xong'; t.done_kind = t.kind === 'tien' ? 've' : 'ghep'; t.done_note = (t.kind === 'tien' ? 'tiền về ở ' : 'ghép với ') + caLab(p_report); }
    },
    app_stc_treo_close({ p_treo, p_kind, p_people, p_reason }) {
      const t = TREO.find((x) => x.id === Number(p_treo)); if (!t || t.status !== 'mo') throw new Error('Khoản treo không còn mở.');
      const c = st().cas.find((x) => x.id === t.report_id);
      if (p_kind === 'thu') { if (t.kind !== 'thua') throw new Error('Chỉ tiền thừa chờ ghép mới ghi Thu khác.'); }
      else {
        if (t.kind !== 'tien') throw new Error('Chỉ khoản chờ tiền về mới trừ tiền / quán chịu.');
        if (dd(c.date, today()) <= 3) throw new Error('Chưa quá hạn 3 ngày — chờ tiền về hoặc bấm "Đã về".');
        if (p_kind === 'qc' && me.role !== 'chu') throw new Error('Chỉ Chủ quyết Quán chịu cho khoản treo.');
        if (p_kind === 'tru' && (p_people || []).reduce((s, p) => s + Number(p.amount), 0) !== Number(t.left ?? t.amount)) throw new Error('Tổng trừ tiền phải bằng phần còn treo.');
      }
      reason(p_reason);
      t.status = 'xong'; t.done_kind = p_kind; t.done_note = p_kind === 'tru' ? 'trừ tiền nhân viên' : p_kind === 'qc' ? 'quán chịu' : 'ghi Thu khác';
      return 'ok';
    },
    app_stc_person_mark({ p_name, p_no_remind }) {
      need(); const pe = st().people.find((x) => x.name.toLowerCase() === String(p_name).toLowerCase()); if (pe) pe.no_remind = !!p_no_remind;
      st().open_debts.filter((d) => d.who.toLowerCase() === String(p_name).toLowerCase()).forEach((d) => { d.no_remind = !!p_no_remind; });
      return 1;
    },
  };
}
