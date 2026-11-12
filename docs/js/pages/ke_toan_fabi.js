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

// Bước 49: gợi ý nhóm theo tên món (kế toán xem lại rồi bấm Lưu)
const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const RULES = [
  [/(thuoc|craven|vinataba|marlboro|555|dieu|huong duong|hat dua|hat |banh|kho ga|kho bo|xuc xich|nem|snack|mi tom|thang long)/, /ĐỒ ĂN/],
  [/(mon them|them |topping|tran chau|thach|kem cheese|kem muoi|shot)/, /TOPPING/],
  [/(da xay|sinh to|tuyet|frappe|smoothie)/, /ĐÁ XAY/],
  [/(^ep |nuoc ep| ep |^ep$)/, /NƯỚC ÉP/],
  [/(cacao|bot san|sua chua)/, /ĐỒ UỐNG KHÁC/],
  [/(ca phe|cafe|coffee|bac xiu|nau |den da|espresso|latte|cappuccino|capuchino|americano)/, /CÀ PHÊ/],
  [/(^tra |^tra$| tra )/, /^TRÀ$/],
];
export function guessGroup(name, groups) {
  const n = norm(name) + ' ';
  for (const [re, g] of RULES) if (re.test(n)) { const hit = groups.find((x) => g.test(x)); if (hit) return hit; }
  return '';
}

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
    // bước 49: số lượng từng món + doanh thu từng nhóm → web tính số cốc
    items: section('MÓN').map((r) => ({ name: String(r[0]).trim(), qty: Number(r[1]) || 0, amount: Number(r[2]) || 0 })),
    groups: section('NHÓM MÓN').map((r) => ({ name: String(r[0]).trim(), amount: Number(r[1]) || 0 })),
  };
}

export async function render({ params }) {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.den || '') ? params.den : vnToday();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.tu || '') ? params.tu : addDays(to, -2);
  const [D, KW, MN] = await Promise.all([rpc('app_fabi_list', { p_from: from, p_to: to }), rpc('app_ca_kt_wait').catch(() => []),
    rpc('app_fabi_menu').catch(() => ({ groups: [], items: [] }))]);
  const unk = MN.items.filter((x) => !x.grp); const known = MN.items.filter((x) => x.grp);
  const grpSel = (it, val) => html`<select class="input sm" data-mn="${it.name}" data-orig="${it.grp || ''}" aria-label="Nhóm của ${it.name}"><option value="">— Chọn nhóm —</option>${MN.groups.map((g) => html`<option value="${g}" ${g === val ? 'selected' : ''}>${g}</option>`)}</select>`;
  const mnRow = (it, val) => html`<div class="mn-r"><div><strong>${it.name}</strong><div class="st-meta">${fmt(it.qty)} phần · ${it.files} ca${it.grp ? (it.cup ? ' · tính cốc' : ' · không tính cốc') : ''}</div></div>${grpSel(it, val)}</div>`;   // bước 44: ca còn thiếu file Fabi / CK ngân hàng
  const nav = (p) => go('/ke-toan/fabi?' + new URLSearchParams({ tu: from, den: to, ...p }).toString());
  const row = (f) => { const st = statusOf(f); return html`<tr><td data-label="Ca"><strong>${f.branch_code || f.store}</strong> · ${f.shift || ''} ${dmy(f.work_date)}<div class="st-meta">${(f.open_at || '').slice(11)}–${(f.close_at || '').slice(11)} · mã ${f.ma_ca}</div></td>
      <td class="r" data-label="Doanh thu">${fmt(f.net)}</td><td class="r" data-label="Chuyển khoản">${fmt(f.ck)}</td><td class="r" data-label="Tiền mặt">${fmt(f.tm)}</td><td class="r" data-label="Nợ">${fmt(f.no)}</td>
      <td class="r" data-label="Đếm thực tế">${fmt(f.tong)}</td><td class="r" data-label="Chênh lệch"><strong>${signed(f.chenh)}</strong></td>
      <td class="r" data-label="Số cốc">${f.cups ?? ((f.cups_unknown || []).length ? html`<span class="pill warn">thiếu nhóm ${(f.cups_unknown || []).length} món</span>` : '—')}</td>
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
        <section class="card stack" style="gap:8px" id="kt-wait"><h2 style="margin:0">Ca còn thiếu (${KW.length})</h2>
          <div class="st-meta">Phần tiền của các ca này đang chờ kế toán: đủ <strong>file chốt ca Fabi</strong> và <strong>chuyển khoản ngân hàng</strong> thì quản lý mới đối soát được. 10:00 sáng hằng ngày web nhắc các ca hôm trước còn thiếu.</div>
          ${KW.length ? KW.map((k) => html`<div class="kt-w"><div><strong>${k.branch} · ca ${k.shift} ${dmy(k.date)}</strong>${k.status !== 'hoan_thanh' ? html` <span class="pill mute">nhân viên chưa gửi phiếu</span>` : ''}
              <div class="st-meta">Thiếu: ${(k.missing || []).join(', ')}</div></div>
              ${k.bank ? '' : html`<a class="btn sm secondary" href="#/ke-toan/chuyen-khoan?ngay=${k.date}">Nhập chuyển khoản ›</a>`}</div>`)
            : html`<div class="alert ok">Không còn ca nào thiếu.</div>`}
          <style>.kt-w { display: flex; gap: 10px; justify-content: space-between; align-items: center; flex-wrap: wrap; padding: 6px 0; border-top: 1px solid var(--line); } .kt-w > div { min-width: 0; flex: 1 1 220px; overflow-wrap: anywhere; }</style></section>
        <section class="card stack" style="gap:8px" id="fb-menu"><h2 style="margin:0">Nhóm món — tính số cốc ${unk.length ? html`<span class="pill warn">${unk.length} món chưa có nhóm</span>` : MN.items.length ? html`<span class="pill ok">đủ nhóm</span>` : ''}</h2>
          <div class="st-meta">Số cốc của ca = tổng số lượng các món, <strong>trừ nhóm Đồ ăn & thuốc lá và Topping</strong>. Món mới chưa có nhóm: chọn nhóm <strong>1 lần</strong> (web đã gợi ý theo tên — xem lại), bấm Lưu; các ca có món đó tự tính lại số cốc.</div>
          ${unk.length ? html`<div class="mn-list">${unk.map((it) => mnRow(it, guessGroup(it.name, MN.groups)))}</div>` : MN.items.length ? '' : html`<div class="st-meta">Chưa có món nào — tải file Fabi trước.</div>`}
          ${known.length ? html`<details><summary style="cursor:pointer;font-weight:600">Món đã có nhóm (${known.length}) — sửa nếu chọn nhầm</summary><div class="mn-list" style="margin-top:6px">${known.map((it) => mnRow(it, it.grp))}</div></details>` : ''}
          ${MN.items.length ? html`<div><button type="button" class="btn" id="fb-menu-save">Lưu nhóm món</button></div>` : ''}
          <style>.mn-list { display: flex; flex-direction: column; gap: 4px; } .mn-r { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 220px); gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); }
            .mn-r > div { min-width: 0; overflow-wrap: anywhere; } .mn-r select { width: 100%; } @media (max-width: 520px) { .mn-r { grid-template-columns: minmax(0, 1fr); } }</style></section>
        <div class="toolbar" style="gap:8px;flex-wrap:wrap"><label class="field" style="margin:0"><span>Từ ngày</span><input class="input" type="date" id="fb-from" value="${from}"></label>
          <label class="field" style="margin:0"><span>Đến ngày</span><input class="input" type="date" id="fb-to" value="${to}"></label></div>
        ${D.missing.length ? html`<div class="alert warn"><strong>Phiếu trên web chưa có file Fabi (${D.missing.length}):</strong> ${D.missing.map((m) => `${m.branch_code} ${m.shift} ${dmy(m.work_date)}`).join(' · ')}. Tải thêm file của các ca này.</div>`
          : html`<div class="alert ok">Mọi phiếu chốt ca trong khoảng ngày này đã có file Fabi.</div>`}
        <section class="card flush"><div class="card-head"><h2>File đã tải (${D.files.length})</h2></div>
          ${D.files.length ? html`<div class="table-wrap"><table class="table rt"><thead><tr><th>Ca</th><th class="r">Doanh thu</th><th class="r">Chuyển khoản</th><th class="r">Tiền mặt</th><th class="r">Nợ</th><th class="r">Đếm thực tế</th><th class="r">Chênh lệch</th><th class="r">Số cốc</th><th>So với phiếu nhân viên</th></tr></thead>
            <tbody>${D.files.map(row)}</tbody></table></div>` : html`<div class="st-meta" style="padding:12px">Chưa tải file nào trong khoảng ngày này.</div>`}</section>
      </div>`,
    mount() {
      $('#fb-from').addEventListener('change', (e) => { if (e.target.value) nav({ tu: e.target.value }); });
      $('#fb-to').addEventListener('change', (e) => { if (e.target.value) nav({ den: e.target.value }); });
      $('#fb-menu-save')?.addEventListener('click', async (ev) => {
        const items = [...document.querySelectorAll('[data-mn]')].filter((x) => x.value !== x.dataset.orig).map((x) => ({ name: x.dataset.mn, grp: x.value || null }));
        if (!items.length) { showSaved('Chưa đổi nhóm món nào.', true); return; }
        ev.target.disabled = true;
        try { const n = await rpc('app_fabi_menu_set', { p_items: items }); flash(`Đã lưu nhóm cho ${n} món — số cốc các ca có món đó đã tính lại.`, 'ok'); rerender(); }
        catch (e) { showSaved(e.message, true); ev.target.disabled = false; }
      });
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
          const nu = new Set(res.flatMap((x) => x.cups_unknown || [])).size;
          if (nu) lines.push(`${nu} món chưa có nhóm — chọn ở khung "Nhóm món" để tính số cốc`);
          flash(lines.filter(Boolean).join(' · ') + '.', cnt('lech') || cnt('chua_phieu') || nu ? 'warn' : 'ok');
          if (days.length) nav({ tu: days[0] < from ? days[0] : from, den: days[days.length - 1] > to ? days[days.length - 1] : to }); else rerender();
        } catch (err) { msg.innerHTML = str(html`<div class="alert error">Không tải được: ${err.message}</div>`); }
      });
    },
  };
}
