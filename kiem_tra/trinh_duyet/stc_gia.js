// Giả lập app_stc_* (Sổ thu chi mới). Đợt 1: đọc (app_stc_month / app_stc_ext). Đợt 2a: sửa / thêm / xoá khoản ngoài ca, người nợ ✓,
// làm giống máy chủ trên bản sao dữ liệu giả: khoản cũ thành void (gạch ngang), khoản mới có edit (phiếu bổ sung).
import { EXT, MONTH } from '../test/stc_fixture.js';
import { makeFund } from '../test/fund_gia.js';
import { gioCheck } from '../js/gio_chot_tinh.js';
import { dsChecks, dsCtx, TICKS } from '../js/so_thu_chi_tinh.js';

const copy = (o) => JSON.parse(JSON.stringify(o));
export function makeStc(T, me) {
  const admin = () => ['chu', 'ql_tong'].includes(me.role);
  // khoản của phiếu ca mang mã thật 'm:<ca>:<mkey>' như máy chủ (bước 153: → Trừ lương cần mkey)
  let ST = null; const st = () => ST || (ST = ((d) => { d.items.forEach((x) => { if (x.src === 'move' && String(x.id).startsWith('z:')) x.id = 'm:' + x.ca_id + ':z' + x.id.slice(2); }); return d; })(copy(MONTH)));
  // chặng 4 (tệp 162): tổng danh sách khách nợ hoá đơn của ca (như billListOf ở so_thu_chi_tinh.js)
  const billList = (c) => (st().ca_debts || []).filter((x) => x.report_id === c.id && x.t === 'moi' && (x.kind || 'bill') === 'bill').reduce((a, x) => a + Number(x.amount || 0), 0);
  // Đối soát về Chốt ca (thiết kế 22/11): mỗi ca thử phần tiền cũng là một phiếu chốt ca (ca_gia) để trang đối soát của ca mở được;
  // trạng thái chờ kế toán của các ca này lấy theo dữ liệu thử phần tiền (fb_gia ktState hỏi T.__stcKt trước)
  T.shift_reports = T.shift_reports || [];
  (MONTH.cas || []).forEach((c) => {
    if (T.shift_reports.some((r) => r.id === c.id)) return;
    T.shift_reports.push({ id: c.id, branch_id: 1, work_date: c.date, shift: c.shift, status: 'hoan_thanh', recon_status: 'chua', cash_mode: c.cash_mode || 'ngay',
      opening_cash: c.nv?.opening ?? 1000000, total_revenue: c.nv?.revenue ?? 0, pos_debt: c.nv?.debt ?? 0,
      pos_cash: c.fabi?.tm ?? 0, pos_transfer: c.fabi?.ck ?? 0, reported_transfer: c.fabi?.ck ?? 0, cash_counted: (c.nv?.opening ?? 1000000) + (c.fabi?.tm ?? 0),   // ô TM / CK ở bảng tuần ≈ 0 như phiếu thật
      created_by: 1, completed_by: 1, completed_at: c.date + ' 12:00:00', updated_at: c.date + ' 12:00:00', updated_by: 1 });
  });
  T.__stcKt = (id) => { const c = st().cas.find((x) => x.id === Number(id)); if (!c) return null;
    const ready = !c.kt_wait; return { need: true, fabi: !!c.fabi?.has, bank: c.bank_ck != null, ready, missing: ready ? [] : (c.kt_missing || []) }; };
  // tệp 164: trạng thái Việc · Tiền của một phiếu (giống app__ca_ds_row); light = không phân biệt red / xn
  const W_LB = { nhan_su: 'Nhân viên trong ca', ban_giao: 'Bàn giao ca sau', nhap_hang: 'Nhập hàng' };
  const dsRow = (r, light = false) => {
    const thieu = Object.keys(W_LB).filter((k) => !(T.shift_report_checks || []).some((x) => x.report_id === r.id && x.item === k)
      && (k !== 'nhap_hang' || (T.delivery_invoices || []).some((d) => d.received_report_id === r.id))).map((k) => W_LB[k]);   // Nhập hàng chỉ tính khi ca có hàng kho tổng (như tệp 164)
    const c = st().cas.find((x) => x.id === r.id);
    const kt = T.__ktState ? T.__ktState(r.id) : (T.__stcKt(r.id) || { need: false, ready: true, missing: [] });
    let st1; let viec = !thieu.length; let tth = [];
    if (r.recon_status === 'hoan_thanh') { st1 = 'ok'; viec = true; thieu.length = 0; }
    else if (kt && kt.need && !kt.ready) { st1 = 'kt'; tth = kt.missing || []; }
    else if (!c || !c.recon_money_done) {
      const red = c && !light && (Number(c.nv?.opening) !== Number(c.fabi?.opening) || Number(c.nv?.revenue) !== Number(c.fabi?.revenue)
        || Number(c.nv?.debt ?? 0) !== Number(c.fabi?.debt ?? 0) || Number(c.nv?.debt ?? 0) !== billList(c));
      st1 = red ? 'red' : 'xn';
    } else if (!c.done) st1 = 'ht';
    else {   // 🟠 (anh Tiến chốt 23/11): đã Hoàn thành nhưng còn chênh lệch chờ xử lý (máy chủ: thiếu dấu mục tiền)
      const pend = st().items.filter((x) => x.ca_id === r.id && x.gap && Number(x.gap.avail || 0) > 0);
      st1 = pend.length ? 'lech' : 'ok'; tth = [...new Set(pend.map((x) => (x.pm === 'ck' ? 'Chuyển khoản' : 'Tiền mặt')))];
    }
    return { id: r.id, date: r.work_date, shift: r.shift, recon: r.recon_status, tab: !viec ? 'viec' : st1 !== 'ok' ? 'tien' : 'xong',
      viec: { xong: viec, thieu, x2: 'khong_can' }, tien: { st: st1, thieu: tth } };
  };
  const SH_ORD = (s) => { const i = ['Sáng', 'Chiều', 'Tối'].indexOf(s); return i < 0 ? 9 : i; };
  const byCa = (a, b) => (a.work_date < b.work_date ? -1 : a.work_date > b.work_date ? 1 : SH_ORD(a.shift) - SH_ORD(b.shift) || a.id - b.id);
  // bước 153: mọi phiếu trừ lương của tháng (app_stc_month.shortfalls) — dựng từ gap.tl của dữ liệu giả
  let SF = null; let SFN = 900;
  const sfs = () => SF || (SF = st().items.filter((x) => x.gap && (x.gap.tl || []).length).flatMap((x) => x.gap.tl.map((t) => ({ id: t.id, report_id: x.ca_id, date: x.date,
    shift: (st().cas.find((c) => c.id === x.ca_id) || {}).shift || '', item: x.pm === 'ck' ? 'chuyen_khoan' : 'tien_mat', employee_id: 1, name: t.name, amount: t.amount,
    status: t.status, reply: t.reply || null, reason: 'Thiếu tiền ca', note: null, move_mkey: null }))));
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
  // tệp 153: tìm yêu cầu sửa số theo mã; ghi số đã duyệt vào phiếu; ô coi là khớp theo số đã duyệt
  const fixFind = (id) => { for (const c of st().cas) for (const [k, q] of Object.entries(c.fixes || {})) if (q.id === Number(id)) return { c, k, q }; throw new Error('Không tìm thấy yêu cầu sửa số.'); };
  const fixApply = (c, k, q) => {
    if (k === 'mo') { c.nv.opening = q.new.val; c.start_tm = q.new.val; }
    else if (k === 'no') c.nv.debt = q.new.val;
    else { q.new.total = q.new.tm + q.new.ck + Number(c.nv.debt || 0); c.nv.revenue = q.new.total; }
  };
  const fixOk = (c, k, v) => c.fixes?.[k]?.status === 'duyet' && Number(v) === Number(k === 'dt' ? c.fixes[k].new.total : c.fixes[k].new.val);
  // tệp 152: khoản nợ của ca sửa / xoá / đổi được (của đúng ca, TM hoặc CK, khách chưa trả đồng nào); xoá / đổi thì để lại dòng t = 'xoa'
  const caDebtPick = (rid, did) => {
    const d = (st().ca_debts || []).find((x) => x.t === 'moi' && Number(x.report_id) === Number(rid) && Number(x.id) === Number(did));
    if (!d) throw new Error('Không tìm thấy khoản nợ của ca này.');
    if (!['muon', 'ck'].includes(d.kind)) throw new Error('Nợ hoá đơn không sửa ở đây — số tiền đi theo ô Nợ bill.');
    if (Number(d.left) < Number(d.amount)) throw new Error('Khách đã trả khoản này — Huỷ thu ở Sổ thu trước rồi mới sửa.');
    return d;
  };
  const caDebtGone = (d, action, reason) => {
    st().ca_debts = st().ca_debts.filter((x) => x !== d);
    st().ca_debts.push({ report_id: d.report_id, t: 'xoa', id: d.id, who: d.who, kind: d.kind, amount: d.amount, left: 0, pm: null, from: null,
      edit: { action, by: by(), at: 'vừa xong', reason: String(reason).trim() } });
  };
  const expOpen = (c) => { const i = SH.indexOf(c.shift); if (i <= 0) return { exp: 1000000, prev: null };
    const prev = st().cas.find((x) => x.date === c.date && x.shift === SH[i - 1]); if (!prev) return { exp: null, prev: null };
    return { exp: prev.cash_mode === 'ca' ? 1000000 : Number(prev.real_tm ?? 0), prev }; };
  const untick = (c, ks) => { c.ticks = (c.ticks || []).filter((k) => !ks.includes(k)); };   // bước 171: dữ liệu đổi → bỏ tích mục liên quan
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

  // bước 162: giờ chốt ca (app_ca_gio / app_ca_gio_save). Ca của Sổ thu chi (dữ liệu giả 141–183) giữ giờ riêng; phiếu thật (T.shift_reports) ghi thẳng vào phiếu.
  // Ca 181: file Fabi vô lý (23:59) → sửa tay được; ca 182: có file Fabi → theo file; còn lại không có file.
  const GIO = {}; const GLOG = {}; const SH3 = ['Sáng', 'Chiều', 'Tối']; const GT = { 'Sáng': ['06:45', '12:30'], 'Chiều': ['12:30', '17:30'], 'Tối': ['17:30', '22:45'] };
  const gioRow = (id) => {
    id = Number(id); const fc = st().cas.find((c) => c.id === id);
    if (fc) { if (!GIO[id]) { const [a, b] = GT[fc.shift] || GT['Sáng']; GIO[id] = { id, date: fc.date, shift: fc.shift, branch: st().branches[0].id, status: 'hoan_thanh', fix: true,
      rev_start: `${fc.date} ${a}`, rev_end: `${fc.date} ${b}`, fabi_close: id === 182 ? `${fc.date} ${b}` : id === 181 ? `${fc.date} 23:59` : null }; } return GIO[id]; }
    const r = (T.shift_reports || []).find((x) => x.id === id); if (!r) return null;
    return { id, date: r.work_date, shift: r.shift, branch: r.branch_id, status: r.status, rev_start: r.rev_start, rev_end: r.rev_end, fabi_close: null, ref: r };
  };
  const gioNext = (g) => { const ns = SH3[SH3.indexOf(g.shift) + 1]; if (!ns) return null;
    if (g.fix) { const c = st().cas.find((x) => x.date === g.date && x.shift === ns); return c ? gioRow(c.id) : null; }
    const r = (T.shift_reports || []).find((x) => x.branch_id === g.branch && x.work_date === g.date && x.shift === ns); return r ? gioRow(r.id) : null; };
  const gioPut = (g, k, v) => { g[k] = v; if (g.ref) g.ref[k] = v; };
  const gioView = (p_report) => {
    const g = gioRow(p_report); if (!g) throw new Error('Không tìm thấy ca.');
    const can0 = admin() || (me.role === 'ql' && (g.fix ? Number(g.branch) === st().branches[0].id : (T.branches || []).find((b) => b.id === g.branch)?.code === 'LLB'));   // quản lý thử: được giao cơ sở 1 (Sổ thu chi giả) + LLB (phiếu thật)
    if (!can0) throw new Error('Không có quyền xem ca này.');
    const n = gioNext(g);
    const nx = n ? { id: n.id, shift: n.shift, submitted: n.status === 'hoan_thanh', rev_start: n.status === 'hoan_thanh' ? n.rev_start : null, rev_end: n.status === 'hoan_thanh' ? n.rev_end : null } : null;
    const base0 = { id: g.id, shift: g.shift, date: g.date, status: g.status, rev_start: g.rev_start, rev_end: g.rev_end, fabi_close: g.fabi_close, next: nx };
    const bad = !!g.fabi_close && gioCheck({ ...base0, by_fabi: false }, g.fabi_close, 'x') !== null;
    const byf = !!g.fabi_close && !bad;
    return { g, n, v: { ...base0, by_fabi: byf, fabi_bad: bad, can_edit: !byf && g.status === 'hoan_thanh', log: (GLOG[g.id] || []).slice().reverse() } };
  };

  return {
    // tệp 164 (Đối soát về Chốt ca): bảng tuần + ca chưa xong — không có quyền đối soát → []
    app_ca_ds_tuan({ p_branch, p_from, p_to }) {
      if (!me.perms.doi_soat || !['chu', 'ql_tong', 'ql'].includes(me.role)) return [];
      return (T.shift_reports || []).filter((r) => r.branch_id === Number(p_branch) && r.status === 'hoan_thanh' && r.work_date >= p_from && r.work_date <= p_to)
        .sort(byCa).map((r) => dsRow(r));
    },
    app_ca_ds_con({ p_branch }) {
      if (!me.perms.doi_soat || !['chu', 'ql_tong', 'ql'].includes(me.role)) return [];
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      return (T.shift_reports || []).filter((r) => r.branch_id === Number(p_branch) && r.status === 'hoan_thanh' && r.recon_status !== 'hoan_thanh' && r.work_date >= '2026-11-01' && r.work_date <= today)
        .sort(byCa).map((r) => { const x = dsRow(r, true); return { id: x.id, date: x.date, shift: x.shift, tab: x.tab, st: x.tien.st }; });
    },
    // chặng 4: bài thử dựng tình huống (bỏ qua kiểm quyền) — gộp trường vào 1 ca; nv / fabi gộp sâu
    app__test_stc_ca({ p_id, p }) {
      const c = st().cas.find((x) => x.id === Number(p_id)); if (!c) throw new Error('Không tìm thấy ca.');
      Object.entries(p || {}).forEach(([k, v]) => { c[k] = v && typeof v === 'object' && !Array.isArray(v) && c[k] && typeof c[k] === 'object' ? { ...c[k], ...v } : v; });
    },
    // → Trừ lương (anh Tiến chốt 22/11: người làm ca có ô tích): gắn p_n nhân viên đang làm vào ca (đã làm) — app_ca_get trả về như phiếu thật
    // chặng 6.3 (chỉ bài thử): coi ca như đã Xác nhận Fabi để mở bước 3–5, bỏ các mục quản lý tự tích
    // chặng 6.3b: bỏ lần trả nợ cũ của ca (dòng t='tra' trong sổ tháng giả). sb_gia gọi trước, không phải dòng giả thì để ca_gia xử lý.
    __stcTraUncollect({ p_report, p_debt, p_reason }) {
      const L = st().ca_debts || []; const i = L.findIndex((x) => x.t === 'tra' && Number(x.id) === Number(p_debt)); if (i < 0) return false;
      if (Number(L[i].report_id) !== Number(p_report)) throw new Error('Khoản khách trả không thuộc ca này.');
      if (!String(p_reason || '').trim()) throw new Error('Ghi lý do sửa hoặc xoá khoản khách trả.');
      const c = st().cas.find((x) => x.id === Number(p_report)); if (c?.done) throw new Error('Ca đã hoàn thành đối soát — mở lại để sửa.');
      if (c?.recon_money_done) throw new Error(`Mục ${L[i].pm === 'chuyen_khoan' ? 'Chuyển khoản' : 'Tiền mặt'} đã đối soát — bấm Sửa ở mục đó để mở lại trước.`);
      L.splice(i, 1); return true;
    },
    // chặng 6.3c: ghi khách trả nợ cũ vào ca cho dòng open_debts của sổ tháng giả (sb_gia gọi trước, không phải dòng giả thì để ca_gia)
    __stcTraCollect({ p_report, p_debt, p_kind, p_amount, p_reason }) {
      const id = typeof p_debt === 'number' ? 'd:' + p_debt : String(p_debt); const O = st().open_debts || []; const o = O.find((x) => x.id === id || x.id === String(p_debt)); if (!o) return false;
      if (!String(p_reason || '').trim()) throw new Error('Ghi lý do (vd: khách trả nhưng nhân viên không biết).');
      const c = st().cas.find((x) => x.id === Number(p_report)); if (c?.done) throw new Error('Ca đã hoàn thành đối soát — mở lại để sửa.');
      if (c?.recon_money_done) throw new Error(`Mục ${p_kind === 'chuyen_khoan' ? 'Chuyển khoản' : 'Tiền mặt'} đã đối soát — bấm Sửa ở mục đó để mở lại trước.`);
      if (!(p_amount > 0)) throw new Error('Nhập số tiền khách trả lớn hơn 0.');
      if (p_amount > Number(o.left)) throw new Error('Khách trả nhiều hơn số nợ.');
      o.left = Number(o.left) - p_amount;
      (st().ca_debts = st().ca_debts || []).push({ report_id: Number(p_report), t: 'tra', id: 9000 + O.indexOf(o), who: o.who, kind: o.kind, amount: p_amount, left: 0, pm: p_kind, from: o.from });
      return true;
    },
    // chặng 6.4: thêm một khoản "Nợ khác" chưa phân loại vào ca (bài thử flow_nhom64 phần C — gọi trước khi trang đọc tháng)
    app__test_ca_debt_add({ p_report, p_who, p_kind, p_amount, p_grp }) { const id = ++N; (st().ca_debts = st().ca_debts || []).push({ report_id: Number(p_report), t: 'moi', id, who: p_who, kind: p_kind || 'muon', amount: Number(p_amount), left: Number(p_amount), pm: null, from: null, sorted: false, person_id: null, grp: p_grp || 'khac', content: null }); return id; },
    app__test_ds_open({ p_id }) { const c = st().cas.find((x) => x.id === Number(p_id)); if (!c) throw new Error('Không tìm thấy ca.'); c.recon_money_done = true; c.done = null; c.ticks = []; },
    app__test_ca_staff({ p_id, p_n = 2 }) {
      const rid = Number(p_id); T.shift_report_staff = T.shift_report_staff || []; T.employees = T.employees || [];
      // nhân viên GIẢ (không dùng tên thật trong dữ liệu chép về máy thử)
      const FAKE = [[9901, 'NVA', 'Nhân viên A (thử)'], [9902, 'NVB', 'Nhân viên B (thử)'], [9903, 'NVC', 'Nhân viên C (thử)']].slice(0, p_n);
      FAKE.forEach(([id, code, name]) => { if (!T.employees.some((e) => e.id === id)) T.employees.push({ id, code, name, status: 'Đang làm', rank: 'NV', pay_cash: 0 }); });
      const es = FAKE.map(([id]) => T.employees.find((e) => e.id === id));
      es.forEach((e) => { if (!T.shift_report_staff.some((s) => s.report_id === rid && s.employee_id === e.id)) T.shift_report_staff.push({ report_id: rid, employee_id: e.id, worked: 1, source: 'lich', time_in: '06:45', time_out: '12:30' }); });
      return es.map((e) => e.id);
    },
    // Nhập hàng (luật 15/11; anh Tiến chốt 22/11 "chỉ hiện khi còn hàng"): gắn 1 lần hàng kho tổng CHƯA đối soát vào ca (như ca cũ trước 15/11) — bỏ dấu Nhập hàng của ca
    app__test_ca_hang({ p_id }) {
      T.delivery_invoices = T.delivery_invoices || []; T.delivery_lines = T.delivery_lines || [];
      const id = Math.max(9000, ...T.delivery_invoices.map((x) => x.id || 0)) + 1; const rid = Number(p_id); const r = (T.shift_reports || []).find((x) => x.id === rid) || {};
      T.delivery_invoices.push({ id, branch_id: r.branch_id || 1, work_date: r.work_date || '2026-11-10', kind: 'hoa_don', state: 'da_nhan', doc_no: 'PX-THU-' + id, received_report_id: rid });
      T.delivery_lines.push({ id: Math.max(9000, ...T.delivery_lines.map((x) => x.id || 0)) + 1, invoice_id: id, sort: 1, name: 'Sữa tươi (thử)', unit: 'hộp', qty_invoice: 2, checked_at: null });
      T.shift_report_checks = (T.shift_report_checks || []).filter((x) => !(x.report_id === rid && x.item === 'nhap_hang'));
      return id;
    },
    app_ca_gio({ p_report }) { return gioView(p_report).v; },
    app_ca_gio_save({ p_report, p_end, p_reason }) {
      if (!['chu', 'ql_tong', 'ql'].includes(me.role)) throw new Error('Chỉ Chủ, Quản lý tổng hoặc quản lý đối soát của cơ sở này đối soát tiền được.');
      const { g, n, v } = gioView(p_report);
      if (!v.can_edit && v.by_fabi) throw new Error('Ca đã có file Fabi — giờ chốt lấy theo file.');
      const err = gioCheck(v, p_end, p_reason); if (err) throw new Error(err);
      const old = g.rev_end; if (old === p_end) return { changed: false, rev_end: p_end, next: null };
      gioPut(g, 'rev_end', p_end); (GLOG[g.id] = GLOG[g.id] || []).push({ at: now(), by_name: by(), action: 'sua_gio', before: old, after: p_end, reason: String(p_reason).trim() });
      let next = null;
      if (n && n.status === 'hoan_thanh' && n.rev_start !== p_end) { next = { shift: n.shift, from: n.rev_start, to: p_end }; gioPut(n, 'rev_start', p_end); }
      return { changed: true, rev_end: p_end, next };
    },
    app_stc_month({ p_branch, p_month }) {
      // bước 152: quản lý cơ sở chỉ được giao cơ sở đầu tiên (giả lập Phân công việc Đối soát ca)
      const mine = (bid) => admin() || (me.role === 'ql' && Number(bid) === st().branches[0].id);
      if (!mine(p_branch)) throw new Error('Bạn không được xem thu chi của cơ sở này.');
      const d = copy(st()); d.owner = me.role === 'chu';
      d.ca_debts = (d.ca_debts || []).map((x) => (x.t === 'moi' ? { ...x, grp: x.grp || 'khach', sorted: !!x.sorted || (x.grp || 'khach') === 'khach' } : x));   // chặng 6.4: nợ khách không cần Xếp d.branches = d.branches.filter((x) => mine(x.id)); d.shortfalls = copy(sfs().filter((k) => k.status !== 'huy'));
      const b = d.branches.find((x) => x.id === Number(p_branch)) || d.branches[0];
      d.branch = { id: b.id, code: b.code, name: b.code };
      if (p_month !== '2026-11') { Object.assign(d, { month: p_month, from: p_month + '-01', to: p_month + '-28', cas: [], items: [], compare: { fund_days: [], gaps: [] } }); }
      if (new URLSearchParams(location.search).get('stclock')) d.locked = true;   // bước 163: &stclock=1 giả tháng đã Chốt tháng
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
      // bước 172 (trigger gác tên của tệp 151): nợ ngoài ca chỉ nhận người ĐANG DÙNG trong danh sách
      if (!st().people.some((x) => x.active !== 0 && x.name.toLowerCase() === String(p.name).trim().toLowerCase())) throw new Error(`Người nợ "${String(p.name).trim()}" chưa có trong danh sách. Thêm ở Sổ thu chi › Sổ chi › 👥 Người nợ trước.`);
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
      if (od.date && p.date && p.date < od.date) throw new Error(`Khoản nợ ghi ngày ${od.date.slice(8, 10)}/${od.date.slice(5, 7)} — ngày thu phải từ ngày đó trở đi.`);   // bước 168 (tệp 147)
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
      if (ca.done) throw new Error('Ca đã hoàn thành đối soát — bấm Mở lại trước.');   // bước 171 (tệp 150)
      const id = p_mkey ? `m:${p_report}:${p_mkey}` : null; const x = id ? items().find((i) => i.id === id) : null;
      untick(ca, (x ? x.book === 'chi' : !p.delete && p.amount < 0) ? ['that', 'lon', 'ld', 'sau_tm', 'sau_ck'] : ['tn', 'sot', 'ld', 'sau_tm', 'sau_ck']);
      if (p.delete) { items().push(voidOf(x, 'xoa', r)); items().splice(items().indexOf(x), 1); return null; }
      amountOk(Math.abs(p.amount)); if (!String(p.note || x?.title || '').trim()) throw new Error('Ghi nội dung khoản.');
      const nk = 'n' + (++N);
      const it = { id: `m:${p_report}:${nk}`, date: ca.date, ca_id: ca.id, book: p.amount < 0 ? 'chi' : 'thu', pm: pmOf(p.kind), col: p.amount < 0 ? 'chi' : 'khac', amount: Math.abs(p.amount),
        title: p.note || x?.title, meta: 'Phiếu ca', cat: catName(p.category_id) || x?.cat || null, src: 'move', can_edit: true };
      if (x) { items().push(voidOf(x, 'sua', r)); items().splice(items().indexOf(x), 1, { ...it, edit: edit('sua', r, x.amount) }); }
      else items().push({ ...it, edit: edit('them', r) });
      return nk;
    },
    // chặng 3 (tệp 160): đổi một khoản thu / chi của ca thành Luân chuyển TM – CK — giữ vế cũ (thành "lc", không tính chi phí), thêm vế ngược lại
    app_stc_move_exchange({ p_report, p_mkey, p_reason }) {
      need(); const r = reason(p_reason); const ca = st().cas.find((c) => c.id === Number(p_report)); finGuard(p_report);
      if (!ca?.recon_money_done) throw new Error('Ca chưa xác nhận Fabi — xác nhận ở Đối soát Fabi trước rồi mới đổi khoản.');
      if (ca.done) throw new Error('Ca đã hoàn thành đối soát — Mở lại ở tab ③ Hoàn thành của trang đối soát ca mới đổi được.');
      const x = items().find((i) => i.id === `m:${p_report}:${p_mkey}`);
      if (!x || x.col === 'lc') throw new Error('Khoản này vừa thay đổi. Tải lại trang rồi làm lại.');
      untick(ca, ['that', 'lon', 'ld', 'sau_tm', 'sau_ck', 'tn', 'sot']);
      const nk = 'n' + (++N);
      items().splice(items().indexOf(x), 1, { ...x, col: 'lc', cat: null, no_cost: true, can_edit: false, edit: edit('sua', r, x.amount) });
      items().push({ id: `m:${p_report}:${nk}`, date: x.date, ca_id: x.ca_id, book: x.book === 'chi' ? 'thu' : 'chi', pm: x.pm === 'tm' ? 'ck' : 'tm', col: 'lc', amount: x.amount,
        title: x.title, meta: 'Phiếu ca', src: 'move', can_edit: false, no_cost: true });
      return 'lc-' + nk;
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
      // tệp 156: máy Fabi không có số ở ô này → chặn (trước đây ghi số trên phiếu thành trống)
      if (p_field === 'dt' && f.revenue == null) throw new Error('Máy Fabi không có số doanh thu ở ca này — bấm "Sai, sửa số", ghi số theo phiếu máy in để Chủ duyệt.');
      if (p_field === 'mo' && f.opening == null) throw new Error('Máy Fabi không có số tiền đầu ca ở ca này — bấm "Sai, sửa số" để Chủ duyệt.');
      if (p_field === 'mo') { c.nv.opening = f.opening; c.start_tm = f.opening; }
      else if (p_field === 'dt') c.nv.revenue = f.revenue;
      else if (p_field === 'no') {   // tệp 162: Nợ bill phải bằng danh sách khách nợ hoá đơn của ca
        const bl = billList(c);
        if (f.debt < bl) throw new Error(`Máy Fabi ghi nợ ${f.debt} — ít hơn danh sách khách nợ hoá đơn của ca (${bl}). Khách nợ thật thì giữ số nợ: bấm "Sai, sửa số".`);
        const diff = f.debt - bl;
        if (diff > 0 && !String(p_name || '').trim()) throw new Error(`Máy Fabi ghi nợ nhiều hơn danh sách khách nợ hoá đơn ${diff} — chọn người nợ phần chênh để Nợ bill khớp danh sách.`);
        c.nv.debt = f.debt;
        if (diff > 0) { const id = ++N; st().open_debts.push({ id: 'd:' + id, who: p_name.trim(), kind: 'bill', amount: diff, left: diff, date: c.date, from: `ca ${c.shift} ${c.date.slice(8, 10)}/${c.date.slice(5, 7)}`, no_remind: false });
          (st().ca_debts = st().ca_debts || []).push({ report_id: c.id, t: 'moi', id: 900000 + id, who: p_name.trim(), kind: 'bill', amount: diff, left: diff, pm: null, from: null }); } }
      else throw new Error('Ô cần sửa không hợp lệ.');
    },
    // bước 173 (tệp 153): máy Fabi ghi sai — gửi số sửa, Chủ duyệt / từ chối (Chủ gửi = duyệt ngay); duyệt thì ghi số vào phiếu
    app_stc_fix_request({ p_report, p_field, p, p_reason }) {
      const c = dsCa(p_report, true); const r = reason(p_reason);
      if (!c.fabi?.has) throw new Error('Chưa có file Fabi của ca này — chờ kế toán tải lên.');
      if (!['mo', 'dt', 'no'].includes(p_field)) throw new Error('Ô cần sửa không hợp lệ.');
      c.fixes = c.fixes || {}; const cur = c.fixes[p_field]; const chu = me.role === 'chu';
      if (cur?.status === 'cho') throw new Error('Ô này đang chờ Chủ duyệt — bấm Bỏ sửa trước khi gửi lại.');
      if (cur?.status === 'duyet' && !chu) throw new Error('Chủ đã duyệt số cho ô này — chỉ Chủ bỏ được.');
      const nw = p_field === 'dt' ? { tm: Number(p.tm), ck: Number(p.ck) } : { val: Number(p.val) };
      if (Object.values(nw).some((v) => !(v >= 0))) throw new Error('Nhập số đúng (số không âm).');
      const q = { id: ++N, status: chu ? 'duyet' : 'cho', new: nw, reason: r, by: by(), at: 'vừa xong' }; c.fixes[p_field] = q;
      if (chu) fixApply(c, p_field, q);
      return q.id;
    },
    app_stc_fix_cancel({ p_req }) {
      const { c, k, q } = fixFind(p_req); dsCa(c.id, true);
      if (q.status === 'duyet' && me.role !== 'chu') throw new Error('Chỉ Chủ bỏ được số Chủ đã duyệt.');
      delete c.fixes[k];
    },
    app_stc_fix_decide({ p_req, p_ok, p_note }) {
      if (me.role !== 'chu') throw new Error('Chỉ Chủ duyệt / từ chối số sửa.');
      const { c, k, q } = fixFind(p_req); dsCa(c.id, true);
      if (q.status !== 'cho') throw new Error('Yêu cầu này không còn chờ duyệt.');
      Object.assign(q, { status: p_ok ? 'duyet' : 'tu_choi', note: p_note || null, decided_by: by() });
      if (p_ok) fixApply(c, k, q);
    },
    // CHỈ DÙNG TRONG BÀI THỬ: tạo sẵn một số sửa đang chờ Chủ duyệt (như quản lý vừa gửi)
    app__thu_fix_cho({ p_report, p_field, p }) {
      const c = st().cas.find((x) => x.id === Number(p_report)); c.fixes = c.fixes || {};
      c.fixes[p_field] = { id: ++N, status: 'cho', new: p_field === 'dt' ? { tm: Number(p.tm), ck: Number(p.ck) } : { val: Number(p.val) }, reason: 'thử', by: 'Quản lý thử', at: 'vừa xong' };
    },
    // CHỈ DÙNG TRONG BÀI THỬ: tệp Fabi của ca có nhưng KHÔNG có số doanh thu (như 4 ca thật: net / tm / ck trống) — chặng 2
    app__thu_fabi_trong({ p_report }) {
      const c = st().cas.find((x) => x.id === Number(p_report)); c.fabi = { ...c.fabi, revenue: null, tm: null, ck: null };
    },
    // CHỈ DÙNG TRONG BÀI THỬ: đặt tiền mở ca (phiếu NV = máy Fabi = tiền đầu ca thật) để thử thiếu / thừa khi giao ca
    app__thu_mo_ca({ p_report, p_val }) {
      const c = st().cas.find((x) => x.id === Number(p_report)); const v = Number(p_val);
      c.nv = { ...c.nv, opening: v }; c.nv_raw = { ...(c.nv_raw || {}), opening: v }; c.fabi = { ...c.fabi, opening: v }; c.start_tm = v;
    },
    app_stc_ds_blame({ p_report, p_who, p_reason }) {
      const c = dsCa(p_report, true); const r = reason(p_reason); if (c.blame) throw new Error('Đã chọn ca chịu lệch mở ca — huỷ trước khi chọn lại.');
      const { exp, prev } = expOpen(c); const diff = Number(c.fabi.opening) - exp; if (!diff) throw new Error('Tiền mở ca đã đúng — không cần chọn.');
      if (!['nay', 'truoc', 'doi'].includes(p_who)) throw new Error('Chọn ca chịu lệch: ca trước, ca này hoặc hai ca cùng chịu.');
      if (p_who === 'doi' && diff > 0) throw new Error('Hai ca cùng chịu chỉ dùng khi thiếu tiền lúc giao ca — thừa thì chọn một ca.');
      const pa = p_who === 'truoc' ? diff : p_who === 'doi' ? Math.trunc(diff / 2) : 0;   // tệp 154: chia đôi, ca này chịu phần lẻ
      if (p_who !== 'nay') { if (!prev) throw new Error('Ca đầu ngày không có ca trước — chọn "Ca này ghi sai".'); prev.real_tm = Number(prev.real_tm || 0) + pa; }
      if (p_who !== 'truoc') c.start_tm = exp + pa;
      c.blame = { who: p_who, diff, prev_amt: pa, prev_report: prev ? prev.id : null, reason: r, by: by() };
    },
    app_stc_ds_blame_undo({ p_report, p_reason }) {
      const c = dsCa(p_report, true); reason(p_reason); if (!c.blame) throw new Error('Chưa chọn ca chịu lệch mở ca.');
      const b = c.blame, pa = b.prev_amt ?? (b.who === 'truoc' ? b.diff : 0);
      if (b.who !== 'truoc') c.start_tm = Number(c.start_tm) + b.diff - pa;
      if (b.who !== 'nay') { const { prev } = expOpen(c); prev.real_tm -= pa; }
      c.blame = null;
    },
    app_stc_ds_cash({ p_report, p_mode, p_counted }) {
      const c = dsCa(p_report, true); if (!['ca', 'ngay'].includes(p_mode)) throw new Error('Chọn thu theo ca hay theo ngày.');
      untick(c, ['goi', 'ld', 'sau_tm']);
      c.cash_mode = p_mode; if (p_mode === 'ca') c.ql_counted = p_counted ?? null; else { c.ql_counted = null; if (p_counted != null) c.real_tm = p_counted; }
    },
    app_stc_ds_close({ p_report }) {
      const c = dsCa(p_report, true);
      if (c.kt_wait || c.bank_ck == null || !c.fabi?.has) throw new Error('Chờ kế toán (file Fabi / số ngân hàng) rồi mới chốt.');
      const { exp } = expOpen(c); const f = c.fabi;
      const fx = Object.values(c.fixes || {});   // tệp 153
      if (fx.some((q) => q.status === 'cho')) throw new Error('Còn số sửa chờ Chủ duyệt — Chủ duyệt xong mới xác nhận.');
      if (fx.some((q) => q.status === 'tu_choi')) throw new Error('Chủ đã từ chối số sửa — sửa lại số hoặc bấm "Bỏ sửa, lấy số máy Fabi" rồi mới xác nhận.');
      const moOpen = fixOk(c, 'mo', c.nv.opening) ? c.nv.opening : f.opening;
      if ((c.nv.opening !== f.opening && !fixOk(c, 'mo', c.nv.opening)) || (!c.blame && exp != null && moOpen !== exp)
        || (c.nv.revenue !== f.revenue && !fixOk(c, 'dt', c.nv.revenue)) || (c.nv.debt !== f.debt && !fixOk(c, 'no', c.nv.debt))
        || (Array.isArray(st().ca_debts) && c.nv.debt !== billList(c))) throw new Error('Còn ô đỏ ở bước ① (tiền mở ca / doanh thu / nợ) — sửa xong mới chốt.');   // tệp 162: nợ khớp danh sách
      if (c.cash_mode === 'ca' && c.ql_counted == null) throw new Error('Nhập tiền mặt thực nhận ở bước ② trước.');
      c.recon_money_done = true; items().forEach((x) => { if (x.ca_id === c.id && x.id.startsWith('m:') && !x.void) x.can_edit = true; });
      return { tm: 0, ck: 0 };
    },
    // bước 171 (tệp 150): mục quản lý tự tích, Hoàn thành đối soát ca, Mở lại
    app_stc_tick({ p_report, p_item, p_on }) {
      const c = dsCa(p_report, false); if (!TICKS.includes(p_item)) throw new Error('Mục kiểm tra không hợp lệ.');
      if (c.done) throw new Error('Ca đã hoàn thành đối soát — bấm Mở lại trước.');
      c.ticks = (c.ticks || []).filter((k) => k !== p_item); if (p_on) c.ticks.push(p_item);
    },
    app_stc_ds_done({ p_report }) {
      const c = dsCa(p_report, false); if (c.done) return;
      if (!c.recon_money_done) throw new Error('Còn mục chưa kiểm tra: Chưa Xác nhận Fabi');
      const left = dsChecks(c, dsCtx(st(), c)).flat().filter((x) => !x.ok).map((x) => x.k);
      if (left.length) throw new Error('Còn mục chưa kiểm tra: ' + left.join(' · '));
      c.done = { by: by(), at: 'vừa xong' };
    },
    app_stc_ds_undone({ p_report }) { const c = dsCa(p_report, false); c.done = null; },
    app_stc_ds_reopen({ p_report, p_reason }) {
      const c = dsCa(p_report, false); c.recon_money_done = false; c.done = null;   // bước 160 (tệp 143): không bắt lý do · bước 171: bỏ luôn dấu Hoàn thành
      items().forEach((x) => { if (x.ca_id === c.id && x.id.startsWith('m:')) x.can_edit = false; });
    },
    // bước 153: phiếu trừ lương — sửa / xoá; khoản chi → trừ lương / bỏ chuyển
    app_ka_edit({ p_id, p_employee, p_amount, p_status, p_note }) {
      const k = sfs().find((x) => x.id === Number(p_id)); if (!k || k.status === 'huy') throw new Error('Không tìm thấy phiếu (có thể đã bị xóa).'); finGuard(k.report_id);
      if (!['tru_luong', 'da_bu', 'mien'].includes(p_status)) throw new Error('Chọn Trừ lương, Đã bù hoặc Miễn.');
      if (p_status === 'mien' && !String(p_note || '').trim()) throw new Error('Miễn khoản âm phải ghi lý do.');
      if (!(Number(p_amount) > 0)) throw new Error('Số tiền phải lớn hơn 0.');
      Object.assign(k, { employee_id: Number(p_employee), amount: Number(p_amount), status: p_status, note: p_note || null });
    },
    app_ka_delete({ p_id, p_note }) {
      const k = sfs().find((x) => x.id === Number(p_id)); if (!k) throw new Error('Không tìm thấy phiếu.'); finGuard(k.report_id); reason(p_note); k.status = 'huy';
    },
    app_tc_move_to_ka({ p_report, p_mkey, p_people, p_reason }) {
      const x = items().find((i) => i.id === `m:${p_report}:${p_mkey}`); if (!x) throw new Error('Khoản này vừa thay đổi. Tải lại trang.'); finGuard(p_report);
      const tot = (p_people || []).reduce((a, q) => a + Number(q.amount), 0); if (tot !== Number(x.amount)) throw new Error('Tổng người chịu phải bằng số tiền khoản.');
      (p_people || []).forEach((q) => sfs().push({ id: ++SFN, report_id: Number(p_report), date: x.date, shift: (st().cas.find((c) => c.id === Number(p_report)) || {}).shift || '',
        item: 'am_tien', employee_id: q.employee_id, name: 'NV ' + q.employee_id, amount: Number(q.amount), status: 'tru_luong', reply: null, reason: p_reason || x.title, note: null, move_mkey: p_mkey }));
      x.no_cost = true; x.can_edit = false; return (p_people || []).length;
    },
    // bước 155: chọn nhóm ngay trên dòng chi của ca (trang thật gọi app_tc_check) — chỉ xử lý khoản của Sổ thu chi giả, còn lại để fin_gia
    __tc_check({ p_report, p_mkey, p_category, p_excluded }) {
      const x = items().find((i) => i.id === `m:${p_report}:${p_mkey}`); if (!x) return false; finGuard(p_report);
      x.cat = p_excluded ? null : catName(p_category); x.no_cost = !!p_excluded; return true;
    },
    app_tc_move_ka_undo({ p_report, p_mkey }) {
      finGuard(p_report); sfs().filter((k) => k.report_id === Number(p_report) && k.move_mkey === p_mkey).forEach((k) => { k.status = 'huy'; });
      const x = items().find((i) => i.id === `m:${p_report}:${p_mkey}`); if (x) { x.no_cost = false; x.can_edit = true; }
    },
    app_stc_finals({ p_branch } = {}) {
      if (!(admin() || (me.role === 'ql' && Number(p_branch) === st().branches[0].id))) throw new Error('Bạn không được xem thu chi của cơ sở này.');
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
    // bước 172: danh sách người nợ thật + thêm / sửa / ngừng dùng (giống supabase/151_nguoi_no.sql)
    app_stc_people() {
      need(); const rk = { khach: 0, kho: 1, chu: 2, khac: 3 };
      return copy(st().people).sort((a, b) => (b.active ?? 1) - (a.active ?? 1) || (rk[a.grp] ?? 0) - (rk[b.grp] ?? 0) || a.name.localeCompare(b.name, 'vi'));
    },
    app_stc_person_save({ p_id, p }) {
      need(); const nm = String(p.name || '').trim(); const act = p.active === 0 || p.active === false || p.active === '0' ? 0 : 1;
      if (!nm) throw new Error('Nhập tên người nợ.');
      if (!['khach', 'kho', 'chu', 'khac'].includes(p.grp)) throw new Error('Chọn nhóm công nợ.');
      const old = p_id ? st().people.find((x) => x.id === Number(p_id)) : null;
      if (p_id && !old) throw new Error('Không tìm thấy người nợ.');
      if (old && (old.shared || (old.grp === 'khach' && old.name.toLowerCase() === 'khách'))) throw new Error('Người chung "Khách" luôn có — không sửa được.');   // chặng 6.4
      if (p.grp === 'khach') throw new Error('Nợ khách hàng không cần tên — ghi chú ở khoản nợ.');
      if (old && old.name.toLowerCase() === 'kho tổng' && (nm.toLowerCase() !== 'kho tổng' || act === 0 || p.grp !== 'kho')) throw new Error('Kho tổng luôn có — không đổi tên / ngừng dùng được.');
      if (st().people.some((x) => x !== old && x.name.toLowerCase() === nm.toLowerCase())) throw new Error('Đã có người nợ tên này.');
      if (!old) { const id = ++N; st().people.push({ id, name: nm, phone: p.phone || null, grp: p.grp, active: act, no_remind: p.grp !== 'khach', open: 0, n: 0 }); return id; }
      st().open_debts.filter((d) => d.who.toLowerCase() === old.name.toLowerCase()).forEach((d) => { d.who = nm; d.no_remind = p.grp !== 'khach'; });
      Object.assign(old, { name: nm, phone: p.phone || null, grp: p.grp, active: act, no_remind: p.grp !== 'khach' });
      return old.id;
    },
    // bước 172: quản lý xếp một khoản nợ mới của ca vào đúng người + nhóm công nợ (giống app_stc_debt_sort ở tệp 151)
    app_stc_debt_sort({ p_debt, p_person, p_grp }) {
      need(); const d = (st().ca_debts || []).find((x) => x.t === 'moi' && Number(x.id) === Number(p_debt));
      if (!d) throw new Error('Không tìm thấy khoản nợ.');
      if (!(Number(d.left) > 0)) throw new Error('Khoản nợ đã thu — không đổi được.');
      const p = p_grp === 'khach' ? st().people.find((x) => x.shared) : st().people.find((x) => x.id === Number(p_person) && x.active !== 0);   // chặng 6.4: Khách hàng → người chung
      if (!p) throw new Error('Chọn người nợ trong danh sách.');
      if (!['khach', 'kho', 'chu', 'khac'].includes(p_grp)) throw new Error('Chọn nhóm công nợ.');
      if ((st().cas.find((c) => c.id === Number(d.report_id)) || {}).done) throw new Error('Ca đã hoàn thành đối soát — bấm Mở lại trước.');
      if (p_grp === 'khach') { Object.assign(d, { who: d.content || d.who, person_id: p.id, grp: 'khach', sorted: true }); return; }
      if (d.who.toLowerCase() !== p.name.toLowerCase()) d.content = d.content || d.who;
      Object.assign(d, { who: p.name, person_id: p.id, grp: p_grp, sorted: true });
    },
    // thiết kế sua-no-cua-ca (tệp 152): sửa / xoá / đổi Luân chuyển / thêm khoản nợ TM, CK của ca ở bước 1 — giống luật máy chủ, không tính lại tiền
    app_stc_ca_debt_save({ p_report, p_debt, p, p_reason }) {
      const c = dsCa(p_report, false); if (!String(p_reason || '').trim()) throw new Error('Ghi lý do sửa / xoá.');
      if (c.done) throw new Error('Ca đã hoàn thành đối soát — bấm Mở lại trước.');
      const pick = p_debt != null ? caDebtPick(p_report, p_debt) : null;
      if (!['muon', 'ck'].includes(p?.kind)) throw new Error('Chọn tiền mặt hay chuyển khoản.');
      const amt = Number(p?.amount); if (!(amt > 0)) throw new Error('Nhập số tiền nợ lớn hơn 0.');
      const now = { by: by(), at: 'vừa xong', reason: String(p_reason).trim() };
      if (pick) {
        if (pick.kind === p.kind && Number(pick.amount) === amt) throw new Error('Chưa đổi gì.');
        Object.assign(pick, { edit: { action: 'sua', ...now, old_amount: Number(pick.amount), old_kind: pick.kind }, kind: p.kind, amount: amt, left: amt });
        return pick.id;
      }
      const pe = st().people.find((x) => x.id === Number(p?.person_id) && x.active !== 0);
      if (!pe) throw new Error('Chọn người nợ trong danh sách.');
      if (!['khach', 'kho', 'chu', 'khac'].includes(p?.grp)) throw new Error('Chọn nhóm công nợ.');
      const id = ++N; st().ca_debts.push({ report_id: Number(p_report), t: 'moi', id, who: pe.name, kind: p.kind, amount: amt, left: amt, pm: null, from: null,
        sorted: true, person_id: pe.id, grp: p.grp, content: null, edit: { action: 'them', ...now } });
      return id;
    },
    app_stc_ca_debt_delete({ p_report, p_debt, p_reason }) {
      const c = dsCa(p_report, false); if (!String(p_reason || '').trim()) throw new Error('Ghi lý do sửa / xoá.');
      if (c.done) throw new Error('Ca đã hoàn thành đối soát — bấm Mở lại trước.');
      const d = caDebtPick(p_report, p_debt); caDebtGone(d, 'xoa', p_reason);
    },
    app_stc_ca_debt_to_exchange({ p_report, p_debt, p_reason }) {
      const c = dsCa(p_report, false); if (!String(p_reason || '').trim()) throw new Error('Ghi lý do sửa / xoá.');
      if (c.done) throw new Error('Ca đã hoàn thành đối soát — bấm Mở lại trước.');
      const d = caDebtPick(p_report, p_debt);
      if (d.kind !== 'muon') throw new Error('Chỉ khoản nợ tiền mặt (khách mượn) mới đổi thành Luân chuyển TM – CK.');
      caDebtGone(d, 'doi', p_reason);
    },
    // CHỈ DÙNG TRONG BÀI THỬ (không có trên máy chủ thật): thêm một khoản nợ mới còn tiền vào một ca, như nhân viên gõ tên trên phiếu chốt ca
    app__thu_them_no_ca({ p_report, p_who, p_amount }) {
      const id = ++N; st().ca_debts.push({ report_id: Number(p_report), t: 'moi', id, who: p_who, kind: 'muon', amount: Number(p_amount), left: Number(p_amount), pm: null, from: null, sorted: false });
      return id;
    },
    app_stc_person_mark({ p_name, p_no_remind }) {
      need(); const pe = st().people.find((x) => x.name.toLowerCase() === String(p_name).toLowerCase()); if (pe) pe.no_remind = !!p_no_remind;
      st().open_debts.filter((d) => d.who.toLowerCase() === String(p_name).toLowerCase()).forEach((d) => { d.no_remind = !!p_no_remind; });
      return 1;
    },
  };
}
