// Kế toán · File ca Fabi (bước 42): tải file "BÁO CÁO CA CHI TIẾT" của từng ca từ Fabi (chọn nhiều file một lần).
// Web đọc file ngay trên trình duyệt, gửi số lên máy chủ; máy chủ tự so với phiếu chốt ca, sửa theo Fabi và báo quản lý.
// Kế toán không phải xem hay xử lý lệch.
import { render as rerender } from '../app.js';
import { addDays, vnToday } from '../data.js';
import { xlsx } from '../excel.js';
import { rpc } from '../sb.js';
import { dmy, fmt, signed } from '../tien.js';
import { $, flash, go, html, showSaved, str } from '../ui.js';
import { DOW, WEEK_CSS, mondayOf } from './ke_toan_ck.js';

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

// Bảng tuần: mỗi cơ sở 1 bảng, hàng = ca + tổng ngày, cột = 7 ngày + cả tuần; ô = doanh thu NET, CK, số cốc, trạng thái so với phiếu
const SHORT = { khop: ['✓ khớp phiếu', 'ck-w-ok'], lech: ['✗ đã sửa theo Fabi', 'ck-w-bad'], chua_phieu: ['chưa có phiếu', 'ck-w-bad'], dang_chot: ['phiếu đang chốt', 'ck-w-miss'] };
const fbTabs = (day, wk) => html`<nav class="ck-view" aria-label="Cách xem"><a href="#/ke-toan/fabi" class="${wk ? '' : 'on'}">Danh sách</a><a href="#/ke-toan/fabi?xem=tuan&ngay=${day}" class="${wk ? 'on' : ''}">Bảng tuần</a></nav>`;
async function renderWeek(day) {
  const mon = mondayOf(day); const days = [...Array(7)].map((_, i) => addDays(mon, i));
  const D = await rpc('app_fabi_list', { p_from: mon, p_to: days[6] });
  const files = D.files.filter((f) => f.branch_code); const unknown = D.files.filter((f) => !f.branch_code);
  const codes = [...new Set([...files.map((f) => f.branch_code), ...D.missing.map((m) => m.branch_code)])];
  const order = ['Sáng', 'Chiều', 'Tối'];
  const shifts = [...new Set([...order, ...files.map((f) => f.shift), ...D.missing.map((m) => m.shift)].filter(Boolean))].filter((x) => order.includes(x) || files.some((f) => f.shift === x));
  const val = (code, d, sh) => {
    const fs = files.filter((f) => f.branch_code === code && f.work_date === d && f.shift === sh);
    if (!fs.length) return D.missing.some((m) => m.branch_code === code && m.work_date === d && m.shift === sh) ? { st: 'miss' } : { st: 'none' };
    const sts = fs.map(statusOf); const st = sts.includes('lech') ? 'lech' : sts.includes('chua_phieu') ? 'chua_phieu' : sts.includes('dang_chot') ? 'dang_chot' : 'khop';
    const cupsOk = fs.every((f) => f.cups !== null && f.cups !== undefined);
    return { st, net: fs.reduce((t, f) => t + Number(f.net || 0), 0), ck: fs.reduce((t, f) => t + Number(f.ck || 0), 0), cups: cupsOk ? fs.reduce((t, f) => t + Number(f.cups || 0), 0) : null, n: fs.length };
  };
  const sumOf = (vs) => { const ok = vs.filter((v) => v.net !== undefined); const miss = vs.filter((v) => v.st === 'miss').length;
    if (!ok.length) return { st: miss ? 'miss' : 'none', miss };
    return { st: 'tot', net: ok.reduce((t, v) => t + v.net, 0), ck: ok.reduce((t, v) => t + v.ck, 0), cups: ok.every((v) => v.cups !== null) ? ok.reduce((t, v) => t + v.cups, 0) : null, miss, bad: ok.filter((v) => v.st === 'lech' || v.st === 'chua_phieu').length }; };
  const cell = (v, href) => {
    const body = v.st === 'none' ? html`<span class="st-meta">—</span>` : v.st === 'miss' ? html`<span class="ck-w-miss">chưa tải</span>`
      : html`<b>${fmt(v.net)}</b><span class="st-meta">CK ${fmt(v.ck)}</span>${v.cups !== null ? html`<span class="st-meta">${v.cups} cốc</span>` : html`<span class="ck-w-miss">thiếu nhóm món</span>`}
        ${v.st === 'tot' ? (v.bad ? html`<span class="ck-w-bad">${v.bad} ca khác phiếu</span>` : '') : html`<span class="${SHORT[v.st][1]}">${SHORT[v.st][0]}</span>`}${v.st === 'tot' && v.miss ? html`<span class="ck-w-miss">${v.miss} ca chưa tải</span>` : ''}`;
    return html`<td class="ck-w-c ${v.st === 'lech' || v.st === 'chua_phieu' ? 'bad' : ''}">${href ? html`<a href="${href}">${body}</a>` : body}</td>`;
  };
  const table = (code) => {
    const V = shifts.map((sh) => days.map((d) => val(code, d, sh)));
    const dayTot = days.map((d, i) => sumOf(V.map((row) => row[i])));
    const shTot = V.map((row) => sumOf(row)); const wk = sumOf(V.flat());
    return html`<section class="card stack" style="gap:8px"><div class="ck-w-h"><h2 style="margin:0">${code}</h2>
        ${wk.st === 'tot' ? html`<span class="st-meta">Cả tuần: doanh thu <b>${fmt(wk.net)}đ</b> · CK ${fmt(wk.ck)}đ${wk.cups !== null ? ` · ${fmt(wk.cups)} cốc` : ''}${wk.bad ? html` · <b class="neg">${wk.bad} ca khác phiếu</b>` : ''}${wk.miss ? html` · <span class="ck-w-miss">${wk.miss} ca chưa tải file</span>` : ''}</span>` : wk.miss ? html`<span class="ck-w-miss">${wk.miss} ca chưa tải file</span>` : ''}</div>
      <div class="table-wrap ck-w-wrap"><table class="ck-w">
        <thead><tr><th>Ca</th>${days.map((d) => html`<th class="${d === vnToday() ? 'today' : ''}"><a href="#/ke-toan/fabi?tu=${d}&den=${d}">${DOW[new Date(d + 'T00:00:00Z').getUTCDay()]}<br><span>${dmy(d).slice(0, 5)}</span></a></th>`)}<th>Cả tuần</th></tr></thead>
        <tbody>${shifts.map((sh, k) => html`<tr><th>${sh}</th>${V[k].map((v, i) => cell(v, `#/ke-toan/fabi?tu=${days[i]}&den=${days[i]}`))}${cell(shTot[k])}</tr>`)}
          <tr class="ck-w-tot"><th>Tổng ngày</th>${dayTot.map((v) => cell(v))}${cell(wk)}</tr></tbody></table></div></section>`;
  };
  return {
    title: 'File ca Fabi',
    html: html`<style>${WEEK_CSS}</style>
      <div class="page-head"><div><h1>File ca Fabi</h1><div class="sub">Bảng tuần: mỗi ô là số theo file Fabi của ca (doanh thu NET, chuyển khoản, số cốc) và kết quả so với phiếu chốt ca. Bấm vào ô để xem chi tiết ngày đó.</div></div></div>
      <div class="stack" style="max-width:1100px;gap:12px">
        <section class="card toolbar" style="padding:12px 14px;gap:8px">${fbTabs(day, true)}
          <a class="btn sm secondary" href="#/ke-toan/fabi?xem=tuan&ngay=${addDays(mon, -7)}">‹ Tuần trước</a>
          <input class="input sm" type="date" id="fb-wday" value="${day}" aria-label="Ngày trong tuần">
          <a class="btn sm secondary" href="#/ke-toan/fabi?xem=tuan&ngay=${addDays(mon, 7)}">Tuần sau ›</a>
          <strong>${dmy(mon)} – ${dmy(days[6])}</strong></section>
        <div class="ck-w-legend st-meta"><span class="ck-w-ok">✓ khớp phiếu</span> · <span class="ck-w-bad">✗ đã sửa theo Fabi</span> (đã báo quản lý) · <span class="ck-w-miss">chưa tải</span> = có phiếu chốt ca mà chưa có file · — chưa có phiếu, chưa có file</div>
        ${unknown.length ? html`<div class="alert warn">${unknown.length} file chưa nhận ra cơ sở: ${unknown.map((f) => f.store).join(', ')} — báo Chủ.</div>` : ''}
        ${codes.length ? codes.map(table) : html`<div class="card st-meta">Tuần này chưa có file Fabi nào và chưa có phiếu chốt ca nào.</div>`}
      </div>`,
    mount() { $('#fb-wday').addEventListener('change', (e) => { location.hash = '#/ke-toan/fabi?xem=tuan&ngay=' + e.target.value; }); },
  };
}

export async function render({ params }) {
  if (params.xem === 'tuan') return renderWeek(/^\d{4}-\d{2}-\d{2}$/.test(params.ngay || '') ? params.ngay : vnToday());
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.den || '') ? params.den : vnToday();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.tu || '') ? params.tu : addDays(to, -2);
  const [D, KW, MN] = await Promise.all([rpc('app_fabi_list', { p_from: from, p_to: to }), rpc('app_ca_kt_wait').catch(() => []),
    rpc('app_fabi_menu').catch(() => ({ groups: [], items: [] }))]);
  const unk = MN.items.filter((x) => !x.grp);
  const nav = (p) => go('/ke-toan/fabi?' + new URLSearchParams({ tu: from, den: to, ...p }).toString());
  const row = (f) => { const st = statusOf(f); return html`<tr><td data-label="Ca"><strong>${f.branch_code || f.store}</strong> · ${f.shift || ''} ${dmy(f.work_date)}<div class="st-meta">${(f.open_at || '').slice(11)}–${(f.close_at || '').slice(11)} · mã ${f.ma_ca}</div></td>
      <td class="r" data-label="Doanh thu">${fmt(f.net)}</td><td class="r" data-label="Chuyển khoản">${fmt(f.ck)}</td><td class="r" data-label="Tiền mặt">${fmt(f.tm)}</td><td class="r" data-label="Nợ">${fmt(f.no)}</td>
      <td class="r" data-label="Đếm thực tế">${fmt(f.tong)}</td><td class="r" data-label="Chênh lệch"><strong>${signed(f.chenh)}</strong></td>
      <td class="r" data-label="Số cốc">${f.cups ?? ((f.cups_unknown || []).length ? html`<span class="pill warn">thiếu nhóm ${(f.cups_unknown || []).length} món</span>` : '—')}</td>
      <td data-label="So với phiếu"><span class="pill ${ST[st][1]}">${ST[st][0]}</span>${(f.diff || []).length ? html`<div class="st-meta">${f.diff.map((x) => `${x.label}: NV ${fmt(x.nv)} → Fabi ${fmt(x.fabi)}`).join(' · ')}</div>` : ''}
        ${(f.tra_no || []).length || (f.sua || []).length ? html`<div class="st-meta">${[(f.tra_no || []).length ? `khách trả nợ ${f.tra_no.map((t) => t.method + ' ' + fmt(t.amount)).join(', ')}` : '', (f.sua || []).length ? `${f.sua.length} hóa đơn sửa / xóa` : ''].filter(Boolean).join(' · ')}</div>` : ''}</td></tr>`; };
  return {
    title: 'File ca Fabi',
    html: html`<style>${WEEK_CSS}</style><div class="page-head"><div><h1>File ca Fabi</h1><div class="sub">Ngày hôm sau (hoặc sau nữa), tải <strong>file chi tiết của từng ca</strong> từ Fabi lên đây. Chọn nhiều file một lần được. Web tự so với phiếu chốt ca, sửa theo Fabi và báo quản lý — kế toán không phải xử lý lệch.</div></div>
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
        ${unk.length ? html`<div class="alert warn" id="fb-menu-warn"><strong>${unk.length} món chưa có nhóm</strong> nên chưa tính được số cốc — chọn nhóm 1 lần ở <a href="#/cai-dat/nhom-mon">Cài đặt › Nhóm món Fabi</a> (web đã gợi ý sẵn).</div>` : ''}
        <div class="toolbar" style="gap:8px;flex-wrap:wrap">${fbTabs(to, false)}<label class="field" style="margin:0"><span>Từ ngày</span><input class="input" type="date" id="fb-from" value="${from}"></label>
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
          if (nu) lines.push(`${nu} món chưa có nhóm — chọn ở Cài đặt › Nhóm món Fabi để tính số cốc`);
          flash(lines.filter(Boolean).join(' · ') + '.', cnt('lech') || cnt('chua_phieu') || nu ? 'warn' : 'ok');
          if (days.length) nav({ tu: days[0] < from ? days[0] : from, den: days[days.length - 1] > to ? days[days.length - 1] : to }); else rerender();
        } catch (err) { msg.innerHTML = str(html`<div class="alert error">Không tải được: ${err.message}</div>`); }
      });
    },
  };
}
