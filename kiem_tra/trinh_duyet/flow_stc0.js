// Kiểm nhanh giả lập Sổ thu chi mới (đợt 1): app_stc_month / app_stc_ext trả dữ liệu, vai khác bị chặn.
import { rpc } from '../js/sb.js';
export default async ({ out }) => {
  const r = [];
  try { const d = await rpc('app_stc_month', { p_branch: 1, p_month: '2026-11' }); r.push(`month: ca ${d.cas.length} · khoản ${d.items.length} · so cũ ${d.compare.fund_days.length}`); } catch (e) { r.push('month lỗi: ' + e.message); }
  try { const e = await rpc('app_stc_ext', { p_month: '2026-11' }); r.push(`ext: khoản ${e.items.length}`); } catch (e) { r.push('ext lỗi: ' + e.message); }
  out.push({ stc0: r });
};
