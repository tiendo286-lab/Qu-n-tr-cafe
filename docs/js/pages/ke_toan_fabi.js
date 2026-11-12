// Kế toán · File ca Fabi (bước 42): tải file "BÁO CÁO CA CHI TIẾT" của từng ca từ Fabi (chọn nhiều file một lần).
// Web đọc file ngay trên trình duyệt, gửi số lên máy chủ; máy chủ tự so với phiếu chốt ca, sửa theo Fabi và báo quản lý.
// Kế toán không phải xem hay xử lý lệch.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { xlsx } from '../excel.js';
import { rpc } from '../sb.js';
import { dmy, fmt, signed } from '../tien.js';
import { $, flash, go, html, showSaved, str } from '../ui.js';

export const perm = 'ke_toan';

const ST = {
  khop: ['Khớp phiếu nhân viên', 'ok'], lech: ['Khác phiếu — đã sửa theo Fabi, báo quản lý', 'off'], chua_phieu: ['Chưa có phiếu trên web — đã báo quản lý', 'off'],
  dang_chot: ['Phiếu đang chốt — so khi nhân viên gửi', 'mute'], chua_ro_co_so: ['Chưa nhận ra cơ sở — báo Chủ', 'warn'],
};
const statusOf = (f) => (!f.branch_code ? 'chua_ro_co_so' : !f.report_id ? 'chua_phieu' : f.report_status !== 'hoan_thanh' ? 'dang_chot' : (f.diff || []).length || (f.fixed || []).length ? 'lech' : 'khop');

// Đọc 1 file chi tiết ca (sheet "Báo cáo ca")
export function parseDetail(X, wb) {
  const a = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  if (!String(a[0]?.[0] || '').startsWith('BÁO CÁO CA CHI TIẾT')) return null;
  const ma = (String(a[1]?.[0] || '').match(/Mã ca:\s*(\S+)/) || [])[1];
  const cell = (re) => { for (const v of a[1] || []) { const m = String(v ?? '').match(re); if (m) return m[1].trim(); } return null; };
  const val = (lab) => { const r = a.find((x) => x && String(x[0] ?? '').trim() === lab); return r ? Number(r[1]) : null; };
  const section = (title) => {
    const i = a.findIndex((x) => x && String(x[0] ?? '').trim() === title); if (i < 0) return [];
    const rows = []; for (let j = i + 2; j < a.length && a[j] && a[j][0] != null && String(a[j][0]).trim() !== ''; j++) rows.push(a[j]); return rows;
  };
  const bills = section('THÔNG TIN TỜ TIỀN').map((r) => ({ menh_gia: Number(r[0]), sl: Number(r[1]), tong: Number(r[2]) }));
  return {
    ma_ca: ma, store: String(a[0][0]).replace(/^.*—\s*/, '').trim(), open: cell(/Mở:\s*(.+)/), close: cell(/Đóng:\s*(.+)/),
    dau: val('Số dư đầu ca'), cuoi: val('Số dư cuối ca'), net: val('Doanh thu (net)'), hd: val('Tổng số hoá đơn'),
    pay: section('PHƯƠNG THỨC THANH TOÁN').filter((r) => String(r[0]).trim() !== 'TỔNG').map((r) => ({ name: String(r[0]).trim(), amount: Number(r[1]) })),
    tra_no: section('PHIẾU THANH TOÁN NỢ').map((r) => ({ method: String(r[0]).trim(), amount: Number(r[1]) })),
    sua: section('HOÁ ĐƠN SỬA/XOÁ').map((r) => ({ id: String(r[0]), amount: Number(r[1]) })),
    bills, tong: bills.length ? bills.reduce((s, b) => s + (b.tong || 0), 0) : null,
  };
}

export async function render({ params }) {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.den || '') ? params.den : vnToday();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.tu || '') ? params.tu : addDays(to, -2);
  const D = await rpc('app_fabi_list', { p_from: from, p_to: to });
  const nav = (p) => go('/ke-toan/fabi?' + new URLSearchParams({ tu: from, den: to, ...p }).toString());
  const row = (f) => { const st = statusOf(f); return html`<tr><td data-label="Ca"><strong>${f.branch_code || f.store}</strong> · ${f.shift || ''} ${dmy(f.work_date)}<div class="st-meta">${(f.open_at || '').slice(11)}–${(f.close_at || '').slice(11)} · mã ${f.ma_ca}</div></td>
      <td class="r" data-label="Doanh thu">${fmt(f.net)}</td><td class="r" data-label="Chuyển khoản">${fmt(f.ck)}</td><td class="r" data-label="Tiền mặt">${fmt(f.tm)}</td><td class="r" data-label="Nợ">${fmt(f.no)}</td>
      <td class="r" data-label="Đếm thực tế">${fmt(f.tong)}</td><td class="r" data-label="Chênh lệch"><strong>${signed(f.chenh)}</strong></td>
      <td data-label="So với phiếu"><span class="pill ${ST[st][1]}">${ST[st][0]}</span>${(f.diff || []).length ? html`<div class="st-meta">${f.diff.map((x) => `${x.label}: NV ${fmt(x.nv)} → Fabi ${fmt(x.fabi)}`).join(' · ')}</div>` : ''}
        ${(f.tra_no || []).length || (f.sua || []).length ? html`<div class="st-meta">${[(f.tra_no || []).length ? `khách trả nợ ${f.tra_no.map((t) => t.method + ' ' + fmt(t.amount)).join(', ')}` : '', (f.sua || []).length ? `${f.sua.length} hóa đơn sửa / xóa` : ''].filter(Boolean).join(' · ')}</div>` : ''}</td></tr>`; };
  return {
    title: 'File ca Fabi',
    html: html`<div class="page-head"><div><h1>File ca Fabi</h1><div class="sub">Ngày hôm sau (hoặc sau nữa), tải <strong>file chi tiết của từng ca</strong> từ Fabi lên đây. Chọn nhiều file một lần được. Web tự so với phiếu chốt ca, sửa theo Fabi và báo quản lý — kế toán không phải xử lý lệch.</div></div>
        <div id="saved-indicator" class="saved" role="status" hidden></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        <section class="card stack" style="gap:10px"><h2 style="margin:0">Tải file</h2>
          <div class="st-meta">Trên Fabi: Báo cáo ca → mở từng ca → xuất Excel (file tên <strong>shift_report_detail_…xlsx</strong>). Mỗi cơ sở 3 ca mỗi ngày. Lela Box không dùng Fabi.</div>
          <label class="btn" style="align-self:flex-start">Chọn file Excel (chọn nhiều được)<input type="file" id="fb-file" accept=".xlsx,.xls" multiple hidden></label>
          <div id="fb-msg"></div></section>
        <div class="toolbar" style="gap:8px;flex-wrap:wrap"><label class="field" style="margin:0"><span>Từ ngày</span><input class="input" type="date" id="fb-from" value="${from}"></label>
          <label class="field" style="margin:0"><span>Đến ngày</span><input class="input" type="date" id="fb-to" value="${to}"></label></div>
        ${D.missing.length ? html`<div class="alert warn"><strong>Phiếu trên web chưa có file Fabi (${D.missing.length}):</strong> ${D.missing.map((m) => `${m.branch_code} ${m.shift} ${dmy(m.work_date)}`).join(' · ')}. Tải thêm file của các ca này.</div>`
          : html`<div class="alert ok">Mọi phiếu chốt ca trong khoảng ngày này đã có file Fabi.</div>`}
        <section class="card flush"><div class="card-head"><h2>File đã tải (${D.files.length})</h2></div>
          ${D.files.length ? html`<div class="table-wrap"><table class="table rt"><thead><tr><th>Ca</th><th class="r">Doanh thu</th><th class="r">Chuyển khoản</th><th class="r">Tiền mặt</th><th class="r">Nợ</th><th class="r">Đếm thực tế</th><th class="r">Chênh lệch</th><th>So với phiếu nhân viên</th></tr></thead>
            <tbody>${D.files.map(row)}</tbody></table></div>` : html`<div class="st-meta" style="padding:12px">Chưa tải file nào trong khoảng ngày này.</div>`}</section>
      </div>`,
    mount() {
      $('#fb-from').addEventListener('change', (e) => { if (e.target.value) nav({ tu: e.target.value }); });
      $('#fb-to').addEventListener('change', (e) => { if (e.target.value) nav({ den: e.target.value }); });
      $('#fb-file').addEventListener('change', async (e) => {
        const files = [...e.target.files]; if (!files.length) return;
        const msg = $('#fb-msg'); msg.innerHTML = str(html`<div class="st-meta">Đang đọc ${files.length} file…</div>`);
        try {
          const X = await xlsx(); const rows = []; const bad = [];
          for (const f of files) {
            try { const x = parseDetail(X, X.read(await f.arrayBuffer(), { type: 'array' })); if (x && x.ma_ca) rows.push(x); else bad.push(f.name); } catch (_) { bad.push(f.name); }
          }
          if (!rows.length) { msg.innerHTML = str(html`<div class="alert error">Không thấy file chi tiết ca nào. File đúng bắt đầu bằng dòng "BÁO CÁO CA CHI TIẾT" (xuất từ màn hình chi tiết 1 ca trên Fabi).</div>`); return; }
          const res = await rpc('app_fabi_upload', { p_rows: rows });
          const cnt = (k) => res.filter((x) => x.status === k).length;
          const lines = [`Đã tải ${res.length} ca`, cnt('khop') ? `${cnt('khop')} khớp` : '', cnt('lech') ? `${cnt('lech')} khác phiếu (đã sửa theo Fabi, báo quản lý)` : '', cnt('chua_phieu') ? `${cnt('chua_phieu')} chưa có phiếu (đã báo quản lý)` : '',
            cnt('dang_chot') ? `${cnt('dang_chot')} phiếu đang chốt` : '', cnt('chua_ro_co_so') ? `${cnt('chua_ro_co_so')} chưa nhận ra cơ sở` : '', bad.length ? `bỏ qua ${bad.length} file không đúng mẫu (${bad.join(', ')})` : ''].filter(Boolean);
          showSaved('Đã tải file Fabi');
          const days = res.map((x) => x.work_date).filter(Boolean).sort();
          flash(lines.join(' · ') + '.', cnt('lech') || cnt('chua_phieu') ? 'warn' : 'ok');
          if (days.length) nav({ tu: days[0] < from ? days[0] : from, den: days[days.length - 1] > to ? days[days.length - 1] : to }); else rerender();
        } catch (err) { msg.innerHTML = str(html`<div class="alert error">Không tải được: ${err.message}</div>`); }
      });
    },
  };
}
