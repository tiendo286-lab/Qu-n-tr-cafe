// Dữ liệu & sao lưu (chỉ Chủ): nhập file SQLite / gói ZIP của bản offline 1.7.6 hoặc bản web cũ lên Supabase.
// File được đọc ngay trên trình duyệt (sql.js), không gửi lên đâu khác ngoài Supabase của quán.
import { rpc, sb } from '../sb.js';
import { $, html, loadScript, str } from '../ui.js';

export const perm = 'du_lieu';

const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const CHUNK = 500;
const LABELS = {
  employees: 'Nhân viên', weeks: 'Tuần làm việc', order_entries: 'Ô order', weekly_schedule_entries: 'Ô lịch tuần',
  evaluation_rounds: 'Lần đánh giá', evaluation_round_employees: 'Phiếu đánh giá', evaluation_voucher_allocations: 'Mã voucher',
  branches: 'Cơ sở', shifts: 'Ca làm việc', fixed_schedule_entries: 'Ô lịch cố định', staffing_requirements: 'Ô định biên',
};

async function count(table) {
  const { count: n } = await sb.from(table).select('*', { count: 'exact', head: true });
  return n ?? 0;
}

async function openDatabase(file) {
  await loadScript(SQLJS + 'sql-wasm.js');
  const SQL = await window.initSqlJs({ locateFile: (f) => SQLJS + f });
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.zip$/i.test(file.name)) {
    await loadScript(JSZIP);
    const zip = await window.JSZip.loadAsync(bytes);
    const entry = zip.file('xep_lich.sqlite3') || zip.file(/\.sqlite3?$|\.db$/i)[0];
    if (!entry) throw new Error('Gói ZIP không có file dữ liệu xep_lich.sqlite3.');
    bytes = await entry.async('uint8array');
  }
  let db;
  try { db = new SQL.Database(bytes); } catch (e) { throw new Error('File không phải dữ liệu SQLite hợp lệ.'); }
  const ok = db.exec('PRAGMA integrity_check')[0]?.values?.[0]?.[0];
  if (String(ok).toLowerCase() !== 'ok') throw new Error('File dữ liệu bị hỏng (integrity_check: ' + ok + ').');
  const tables = new Set((db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values || []).map((r) => r[0]));
  for (const t of ['employees', 'weeks', 'settings']) if (!tables.has(t)) throw new Error('File dữ liệu thiếu bảng bắt buộc: ' + t);
  return { db, tables };
}

function rowsOf(db, table) {
  const res = db.exec(`SELECT * FROM "${table}"`)[0];
  if (!res) return [];
  return res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i] instanceof Uint8Array ? null : v[i]])));
}

export async function render() {
  const keys = Object.keys(LABELS);
  const nums = await Promise.all(keys.map(count));
  return {
    title: 'Dữ liệu & sao lưu',
    html: html`
      <div class="page-head"><div><h1>Dữ liệu &amp; sao lưu</h1>
        <div class="sub">Chỉ Chủ vào được. Nhập dữ liệu từ bản offline 1.7.6 (Mac/Windows) hoặc bản web cũ chạy trên máy tính.</div></div></div>
      <div class="grid2">
        <section class="card stack">
          <h2 style="margin:0">Dữ liệu hiện tại trên Supabase</h2>
          <div class="kv">${keys.map((k, i) => html`<div>${LABELS[k]}</div><strong>${nums[i]}</strong>`)}</div>
        </section>
        <section class="card stack">
          <h2 style="margin:0">Nhập dữ liệu</h2>
          <div class="alert warn">Nhập sẽ <strong>thay toàn bộ</strong> dữ liệu lịch, order, nhân viên, đánh giá hiện có bằng dữ liệu trong file.
            <strong>Tài khoản đăng nhập và mật khẩu được giữ nguyên</strong> (gắn lại theo mã nhân viên).</div>
          <div style="font-size:14px;color:var(--ink-2)">Chọn một trong các file:<br>
            • Gói <strong>.zip</strong> xuất từ bản offline (nút XUẤT DỮ LIỆU) hoặc từ bản web cũ (trang Dữ liệu &amp; sao lưu)<br>
            • File <strong>xep_lich.sqlite3</strong> của bản offline, hoặc <strong>app.sqlite3</strong> của bản web cũ</div>
          <input class="input" type="file" id="file" accept=".zip,.sqlite3,.sqlite,.db">
          <div id="preview"></div>
        </section>
      </div>
      <section class="card stack" id="progress-card" hidden>
        <h2 style="margin:0">Đang nhập dữ liệu…</h2>
        <div class="progress"><div id="bar"></div></div>
        <div id="status" style="font-size:14px"></div>
        <div style="font-size:13px;color:var(--muted)">Không đóng trang cho tới khi xong.</div>
      </section>
      <section class="card stack" id="result-card" hidden></section>
      <section class="card stack">
        <h2 style="margin:0">Xuất gói ZIP &amp; sao lưu</h2>
        <div style="font-size:14px;color:var(--ink-2)">Tải gói ZIP (mở được bằng bản offline) sẽ có ở bước 5. Hiện Supabase tự sao lưu cơ sở dữ liệu mỗi ngày (giữ 7 ngày ở gói Free).</div>
      </section>`,
    mount() {
      let source = null;
      $('#file').addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        const pv = $('#preview');
        source = null;
        if (!file) { pv.innerHTML = ''; return; }
        pv.innerHTML = '<div class="loading">Đang đọc file…</div>';
        try {
          source = await openDatabase(file);
          source.name = file.name;
          const pick = (t) => (source.tables.has(t) ? source.db.exec(`SELECT COUNT(*) FROM "${t}"`)[0].values[0][0] : 0);
          const maxWeek = source.db.exec('SELECT MAX(start_date) FROM weeks')[0]?.values?.[0]?.[0] || '—';
          pv.innerHTML = str(html`<div class="alert ok">File hợp lệ: <strong>${file.name}</strong></div>
            <div class="kv">${Object.keys(LABELS).map((k) => html`<div>${LABELS[k]}</div><strong>${pick(k)}</strong>`)}
              <div>Tuần mới nhất</div><strong>${maxWeek}</strong></div>
            <button class="btn solid-danger" type="button" id="go">Nhập dữ liệu này (thay dữ liệu hiện có)</button>`);
          $('#go').addEventListener('click', () => runImport(source));
        } catch (e) {
          pv.innerHTML = str(html`<div class="alert error">${e.message}</div>`);
        }
      });
    },
  };
}

async function runImport(source) {
  const typed = prompt('Thay toàn bộ dữ liệu trên Supabase bằng dữ liệu trong file này?\nGõ NHAP để xác nhận:');
  if (typed === null) return;
  if (typed.trim().toUpperCase() !== 'NHAP') { alert('Chưa nhập: cần gõ đúng chữ NHAP.'); return; }
  const card = $('#progress-card'); const bar = $('#bar'); const status = $('#status');
  card.hidden = false; $('#go').disabled = true; $('#file').disabled = true;
  try {
    const order = await rpc('app_import_tables');
    const plan = order.filter((t) => source.tables.has(t)).map((t) => ({ t, rows: rowsOf(source.db, t) }));
    const total = plan.reduce((s, p) => s + p.rows.length, 0) || 1;
    let done = 0;
    const sent = {};
    status.textContent = 'Đang xóa dữ liệu cũ…';
    await rpc('app_import_begin');
    for (const { t, rows } of plan) {
      sent[t] = { src: rows.length, ok: 0 };
      for (let i = 0; i < rows.length; i += CHUNK) {
        const part = rows.slice(i, i + CHUNK);
        status.textContent = `Đang nạp ${t}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}`;
        sent[t].ok += await rpc('app_import_rows', { p_table: t, p_rows: part });
        done += part.length;
        bar.style.width = `${Math.round((done / total) * 100)}%`;
      }
    }
    let roles = [];
    if (source.tables.has('accounts')) {
      const r = source.db.exec("SELECT e.code, a.system_role FROM accounts a JOIN employees e ON e.id = a.employee_id WHERE a.system_role IN ('ql_tong','ql','nv')")[0];
      roles = (r?.values || []).map(([code, role]) => ({ code: String(code), role }));
    }
    status.textContent = 'Đang hoàn tất…';
    const result = await rpc('app_import_finish', { p_roles: roles, p_note: source.name });
    bar.style.width = '100%';
    card.hidden = true;
    const bad = Object.entries(sent).filter(([, v]) => v.ok !== v.src);
    const rc = $('#result-card');
    rc.hidden = false;
    rc.innerHTML = str(html`<h2 style="margin:0">Đã nhập xong</h2>
      ${bad.length ? html`<div class="alert warn">Một số dòng bị bỏ qua vì trùng hoặc không hợp lệ: ${bad.map(([t, v]) => `${t} (${v.ok}/${v.src})`).join(', ')}.</div>`
        : html`<div class="alert ok">Toàn bộ ${done} dòng dữ liệu đã được nạp đầy đủ. Tài khoản đăng nhập giữ nguyên.</div>`}
      <div class="kv">${Object.keys(LABELS).map((k) => html`<div>${LABELS[k]}</div><strong>${result[k] ?? 0}</strong>`)}</div>
      <div><a class="btn" href="#/quan-ly/tai-khoan">Sang Tài khoản đăng nhập để cấp mật khẩu</a></div>`);
  } catch (e) {
    card.hidden = true;
    const rc = $('#result-card');
    rc.hidden = false;
    rc.innerHTML = str(html`<div class="alert error"><strong>Nhập dữ liệu bị lỗi:</strong> ${e.message}<br>
      Dữ liệu có thể mới nạp một phần. Hãy chọn lại file và nhập lại từ đầu.</div>`);
  }
}
