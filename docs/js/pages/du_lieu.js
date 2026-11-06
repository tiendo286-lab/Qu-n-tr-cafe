// Dữ liệu & sao lưu (chỉ Chủ): số liệu hiện có + tải gói sao lưu ZIP.
// (Phần nhập dữ liệu từ bản offline đã bỏ theo yêu cầu chủ hệ thống — ngày 07/11/2026.)
import { rpc, sb, selAll } from '../sb.js';
import { SQLITE_SCHEMA } from '../sqlite_schema.js';
import { $, html, loadScript } from '../ui.js';

export const perm = 'du_lieu';

const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const LABELS = {
  employees: 'Nhân viên', weeks: 'Tuần làm việc', order_entries: 'Ô order', weekly_schedule_entries: 'Ô lịch tuần',
  branches: 'Cơ sở', shifts: 'Ca làm việc', fixed_schedule_entries: 'Ô lịch cố định', staffing_requirements: 'Ô định biên',
  shift_reports: 'Phiếu chốt ca', tasks: 'Công việc',
};

async function count(table) {
  const { count: n } = await sb.from(table).select('*', { count: 'exact', head: true });
  return n ?? 0;
}

export async function render() {
  const keys = Object.keys(LABELS);
  const nums = await Promise.all(keys.map((k) => count(k).catch(() => null)));
  return {
    title: 'Dữ liệu & sao lưu',
    html: html`
      <div class="page-head"><div><h1>Dữ liệu &amp; sao lưu</h1>
        <div class="sub">Chỉ Chủ vào được. Xem số liệu hiện có và tải bản sao lưu về máy.</div></div></div>
      <div class="grid2">
        <section class="card stack">
          <h2 style="margin:0">Dữ liệu hiện tại trên web</h2>
          <div class="kv">${keys.filter((k, i) => nums[i] !== null).map((k) => html`<div>${LABELS[k]}</div><strong>${nums[keys.indexOf(k)]}</strong>`)}</div>
        </section>
        <section class="card stack">
          <h2 style="margin:0">Tải bản sao lưu</h2>
          <div style="font-size:14px;color:var(--ink-2);line-height:1.6">Tải về máy một gói ZIP gồm lịch tuần, order, nhân viên, chi nhánh, ca, định biên, lịch cố định. Mật khẩu không nằm trong gói.
            Nên tải hằng tuần và cất ở nơi an toàn (máy tính, Google Drive).</div>
          <div><button class="btn" type="button" id="export-btn">Tải gói dữ liệu ZIP</button></div>
          <div id="export-status" style="font-size:13px;color:var(--muted)"></div>
        </section>
      </div>`,
    mount() {
      $('#export-btn').addEventListener('click', () => exportZip($('#export-btn'), $('#export-status')));
    },
  };
}

// ---------------- Xuất gói ZIP giống định dạng bản offline (QuanTriLichLamCafe-Transfer-v1)
async function exportZip(btn, status) {
  btn.disabled = true;
  try {
    status.textContent = 'Đang tải thư viện…';
    await loadScript(SQLJS + 'sql-wasm.js'); await loadScript(JSZIP);
    const SQL = await window.initSqlJs({ locateFile: (f) => SQLJS + f });
    const db = new SQL.Database();
    SQLITE_SCHEMA.forEach((ddl) => db.run(ddl));
    const tables = SQLITE_SCHEMA.filter((d) => d.startsWith('CREATE TABLE')).map((d) => d.match(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-z_]+)"?/i)[1]);
    const cols = (t) => db.exec(`PRAGMA table_info("${t}")`)[0].values.map((r) => r[1]);
    const contacts = new Map((await selAll('employee_contacts', '*')).map((c) => [c.employee_id, c]));
    const stats = {};
    db.run('BEGIN');
    for (const t of tables) {
      status.textContent = `Đang đọc ${t}…`;
      let rows;
      try { rows = await selAll(t, '*'); } catch (_) { continue; } // bảng chỉ bản offline có (cũ, trống)
      if (t === 'employees') rows = rows.map((e) => ({ ...e, email: contacts.get(e.id)?.email || null, phone: contacts.get(e.id)?.phone || null }));
      if (t === 'accounts') rows = rows.map((a) => ({ ...a, password_hash: null, session_version: 1 }));
      const c = cols(t).filter((k) => rows.length && k in rows[0]);
      if (!c.length) { stats[t] = 0; continue; }
      const stmt = db.prepare(`INSERT OR IGNORE INTO "${t}" (${c.map((k) => `"${k}"`).join(',')}) VALUES (${c.map(() => '?').join(',')})`);
      rows.forEach((r) => stmt.run(c.map((k) => (r[k] === undefined ? null : r[k]))));
      stmt.free();
      stats[t] = rows.length;
    }
    db.run('COMMIT');
    const ok = db.exec('PRAGMA integrity_check')[0].values[0][0];
    const bytes = db.export();
    const now = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19);
    const manifest = { format: 'QuanTriLichLamCafe-Transfer-v1', created_at: now, app_version: 'Bản web GitHub Pages + Supabase', database: 'xep_lich.sqlite3',
      stats: { employees: stats.employees || 0, weeks: stats.weeks || 0, evaluation_rounds: stats.evaluation_rounds || 0, evaluation_round_employees: stats.evaluation_round_employees || 0, evaluation_voucher_allocations: stats.evaluation_voucher_allocations || 0 } };
    const info = ['QUẢN TRỊ LỊCH LÀM CAFE - GÓI CHUYỂN DỮ LIỆU', `Thời điểm xuất: ${now.replace('T', ' ')}`, 'Phiên bản: bản web (GitHub Pages + Supabase)', `SQLite integrity_check: ${ok}`, '',
      `Nhân viên: ${manifest.stats.employees}`, `Tuần làm việc: ${manifest.stats.weeks}`, `Lần đánh giá: ${manifest.stats.evaluation_rounds}`, '',
      'Có thể gửi nguyên file ZIP này qua Zalo rồi dùng nút NHẬP DỮ LIỆU TỪ MÁY KHÁC ở bản offline.'].join('\n');
    const zip = new window.JSZip();
    zip.file('xep_lich.sqlite3', bytes); zip.file('manifest.json', JSON.stringify(manifest, null, 2)); zip.file('THONG_TIN_DU_LIEU.txt', info);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `DU_LIEU_QUAN_TRI_LICH_LAM_${now.slice(0, 10).replace(/-/g, '')}_${now.slice(11, 16).replace(':', '')}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    rpc('app_log', { p_action: 'xuat_du_lieu_zip', p_detail: JSON.stringify(manifest.stats) }).catch(() => {});
    status.textContent = `Đã tạo gói ZIP: ${manifest.stats.employees} nhân viên, ${manifest.stats.weeks} tuần.`;
  } catch (e) {
    status.textContent = 'Không tạo được gói ZIP: ' + e.message;
  }
  btn.disabled = false;
}
