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
    app_stc_person_mark({ p_name, p_no_remind }) {
      need(); const pe = st().people.find((x) => x.name.toLowerCase() === String(p_name).toLowerCase()); if (pe) pe.no_remind = !!p_no_remind;
      st().open_debts.filter((d) => d.who.toLowerCase() === String(p_name).toLowerCase()).forEach((d) => { d.no_remind = !!p_no_remind; });
      return 1;
    },
  };
}
