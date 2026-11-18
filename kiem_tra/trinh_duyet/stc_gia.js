// Giả lập app_stc_month / app_stc_ext (Sổ thu chi mới, đợt 1 — chỉ đọc). Trả dữ liệu giả trong stc_fixture.js.
import { EXT, MONTH } from '../test/stc_fixture.js';

const copy = (o) => JSON.parse(JSON.stringify(o));
export function makeStc(T, me) {
  const admin = () => ['chu', 'ql_tong'].includes(me.role);
  return {
    app_stc_month({ p_branch, p_month }) {
      if (!admin()) throw new Error('Đang chạy thử: chỉ Chủ và Quản lý tổng xem được.');
      const d = copy(MONTH); d.owner = me.role === 'chu';
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
  };
}
