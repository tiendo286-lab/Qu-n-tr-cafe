// Kiểm tra bộ đọc/kiểm tra ca bằng dữ liệu giả và đúng parser của ứng dụng.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

export async function validationTests(day, store) {
  let passed = 0;
  const check = (fn) => { fn(); passed++; };
  const vn = day.split('-').reverse().join('/');
  const args = { base64: btoa('PK-test'), id: 'TEST00001', day, open: `${vn} 07:00`, close: `${vn} 12:00` };
  const fixture = () => [
    [`BÁO CÁO CA CHI TIẾT — ${store}`], [`Mã ca: ${args.id}`, `Mở: ${args.open}`, `Đóng: ${args.close}`], [],
    ['Số dư đầu ca', 100], ['Số dư cuối ca', 1100], ['Doanh thu (net)', 1000], ['Tổng số hoá đơn', 2], [],
    ['PHƯƠNG THỨC THANH TOÁN'], ['Tên', 'Số tiền'], ['Tiền mặt', 1000], ['TỔNG', 1000], [],
    ['PHIẾU THANH TOÁN NỢ'], ['Tên', 'Số tiền'], [],
    ['HOÁ ĐƠN SỬA/XOÁ'], ['Mã', 'Số tiền'], [],
    ['THÔNG TIN TỜ TIỀN'], ['Mệnh giá', 'Số lượng', 'Tổng'], [100, 11, 1100], [],
    ['MÓN'], ['Tên', 'Số lượng', 'Tổng'], ['Món thử', 2, 1000], [],
    ['NHÓM MÓN'], ['Tên', 'Tổng'], ['Nhóm thử', 1000], [],
  ];
  const app = await fs.readFile(new URL('../../docs/js/pages/ke_toan_fabi.js', import.meta.url), 'utf8');
  const parser = app.slice(app.indexOf('export function parseDetail'), app.indexOf('// Bảng tuần:')).replace('export function', 'function');
  const source = (await fs.readFile(new URL('./milano_page.js', import.meta.url), 'utf8'))
    .replace('export async function', 'async function')
    .replace("const { rpc } = await import(base + 'js/sb.js');", 'const { rpc } = mock;')
    .replace(/const \[\{ parseDetail \}, \{ xlsx \}\] = await Promise\.all\(\[[\s\S]*?\]\);/, 'const { xlsx } = mock;');
  async function harness(raw = fixture(), allowed = true) {
    let saved = null, uploaded = 0;
    const book = { SheetNames: ['Báo cáo ca'], Sheets: { 'Báo cáo ca': {} } };
    const context = vm.createContext({ location: { href: 'https://tiendo286-lab.github.io/Qu-n-tr-cafe/' },
      crypto: webcrypto, TextEncoder, Uint8Array, atob,
      mock: { xlsx: async () => ({ read: () => book, utils: { sheet_to_json: () => raw } }),
        rpc: async (name, p) => {
          if (name === 'app_me') return { perms: { ke_toan: allowed }, must_change: false, private: 'PRIVATE' };
          if (name === 'app_fabi_list') return { files: saved ? [saved] : [], missing: [{ report_id: 1, branch_code: 'LHP', work_date: day, shift: 'sang', status: 'submitted' }] };
          assert.equal(name, 'app_fabi_upload'); uploaded++;
          const row = p.p_rows[0];
          saved = { ma_ca: row.ma_ca, store: row.store, work_date: day, dau: row.dau, net: row.net, tong: row.tong,
            tm: 1000, ck: 0, no: 0, chenh: 0, open_at: `${day}T07:00:00`, close_at: `${day}T12:00:00`, tra_no: [], sua: [] };
          return [{ ma_ca: row.ma_ca, status: 'khop' }];
        } },
    });
    new vm.Script(parser + '\n' + source).runInContext(context);
    return { invoke: (command, extra = {}) => context.milanoPage(command, { ...args, ...extra }),
      uploads: () => uploaded, corrupt: (key = 'net', value = 999) => { saved[key] = value; } };
  }
  const h = await harness();
  const authorized = await h.invoke('authorize');
  check(() => assert.equal(authorized.allowed, true));
  check(() => assert.equal(JSON.stringify(authorized).includes('PRIVATE'), false));
  const denied = await (await harness(fixture(), false)).invoke('authorize');
  check(() => assert.equal(denied.allowed, false));
  const preview = await h.invoke('preview');
  check(() => assert.equal(preview.id, args.id));
  check(() => assert.equal(preview.hash.length, 64));
  check(() => assert.equal(h.uploads(), 0));
  const again = await h.invoke('preview', { base64: btoa('PK-different-ZIP-metadata') });
  check(() => assert.equal(again.hash, preview.hash));
  const wrongHash = await h.invoke('upload', { expectedHash: 'wrong' });
  check(() => assert.match(wrongHash.pageError, /khác bản đã kiểm tra/));
  check(() => assert.equal(h.uploads(), 0));
  const first = await h.invoke('upload', { expectedHash: preview.hash });
  check(() => assert.equal(first.status, 'khop'));
  const repeated = await h.invoke('upload', { expectedHash: preview.hash, previousHash: preview.hash });
  check(() => assert.equal(repeated.status, 'unchanged'));
  check(() => assert.equal(h.uploads(), 1));
  h.corrupt();
  await h.invoke('upload', { expectedHash: preview.hash, previousHash: preview.hash });
  check(() => assert.equal(h.uploads(), 2)); // hash giống vẫn kiểm tra số đang lưu
  h.corrupt('close_at', '2000-01-01T12:00:00');
  await h.invoke('upload', { expectedHash: preview.hash, previousHash: preview.hash });
  check(() => assert.equal(h.uploads(), 3)); // cùng giờ nhưng khác ngày đóng không được coi là khớp
  // 0.3.2 — so file Fabi vừa tải với file đang lưu trên web (nút Kiểm tra & bù ca thiếu).
  const ck = await harness();
  const missing = await ck.invoke('check');
  check(() => assert.equal(missing.state, 'thieu'));
  check(() => assert.equal(missing.hash.length, 64));
  check(() => assert.equal(ck.uploads(), 0)); // kiểm tra không ghi gì
  await ck.invoke('upload', { expectedHash: missing.hash });
  const same = await ck.invoke('check');
  check(() => assert.equal(same.state, 'khop'));
  ck.corrupt('net', 999); ck.corrupt('tm', 5);
  const diff = await ck.invoke('check');
  check(() => assert.equal(diff.state, 'khac'));
  check(() => assert.equal(JSON.stringify(diff.diff), JSON.stringify(['doanh thu', 'tiền mặt'])));
  check(() => assert.equal(ck.uploads(), 1));
  // 0.3.4 — hỏi web trước: phiếu ca chưa có file + file thiếu số (không cần file Excel).
  ck.corrupt('ck', null); ck.corrupt('tm', null);
  const onlyMoney = await ck.invoke('suspects', { from: day, to: day, base64: undefined });
  check(() => assert.equal(JSON.stringify(onlyMoney.days[day].broken), '[]')); // chỉ trống tiền mặt / chuyển khoản: bỏ qua (anh chọn 23/11)
  ck.corrupt('net', null);
  const sus = await ck.invoke('suspects', { from: day, to: day, base64: undefined });
  check(() => assert.equal(JSON.stringify(sus.days[day]), JSON.stringify({ missing: 1, saved: [args.id], broken: [args.id] })));
  const noOptional = fixture().filter((r) => !['PHIẾU THANH TOÁN NỢ', 'HOÁ ĐƠN SỬA/XOÁ'].includes(r[0]));
  const noOptionalResult = await (await harness(noOptional)).invoke('preview');
  check(() => assert.equal(noOptionalResult.id, args.id));
  for (const [label, column, value] of [
    ['Số dư đầu ca', 1, null], ['Số dư cuối ca', 1, ''], ['Tổng số hoá đơn', 1, true],
    ['Món thử', 1, 'không phải số'], ['Nhóm thử', 1, null], ['Tiền mặt', 1, 999], [100, 2, 1000],
  ]) {
    const raw = fixture(); raw.find((r) => r[0] === label)[column] = value;
    const bad = await harness(raw); const result = await bad.invoke('preview');
    check(() => assert.ok(result.pageError, String(label)));
    check(() => assert.equal(bad.uploads(), 0));
  }
  for (const extra of [{ id: 'WRONG' }, { day: '2000-01-01' }, { close: `${vn} 13:00` }]) {
    const result = await h.invoke('preview', extra);
    check(() => assert.ok(result.pageError));
  }
  const foreign = fixture(); foreign[0][0] = 'BÁO CÁO CA CHI TIẾT — Cơ sở ngoài danh sách';
  const foreignResult = await (await harness(foreign)).invoke('preview');
  check(() => assert.match(foreignResult.pageError, /không thuộc 4 cơ sở/));
  return passed;
}
