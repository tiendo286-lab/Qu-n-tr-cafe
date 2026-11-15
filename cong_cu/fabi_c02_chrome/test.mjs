// Chạy bằng Node >=20: node cong_cu/fabi_c02_chrome/test.mjs
// Toàn bộ dữ liệu ca ở đây là giả; không gọi Fabi/Supabase thật.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as core from './core.mjs';
import { validationTests } from './validation_test.mjs';
import { installWebBridge } from './web_bridge.mjs';
import { bridgeTests } from './web_bridge_test.mjs';

export async function runTests() {
  let passed = 0;
  const check = (fn) => { fn(); passed++; };
  check(() => assert.equal(core.previousDay(Date.parse('2026-11-14T17:01:00Z')), '2026-11-14'));
  check(() => assert.equal(core.vnClock(Date.parse('2026-11-15T01:15:00Z')).minutes, 495));
  check(() => assert.equal(core.previousDay(Date.parse('2026-12-31T17:01:00Z')), '2026-12-31'));
  check(() => assert.throws(() => core.detailIdentity('https://other.example/report/revenue/revenue/shift-detail?shift_id=x&store=y')));
  check(() => assert.throws(() => core.detailIdentity('https://fabi.ipos.vn/report/revenue/revenue/shift-detail?store=y')));
  const day = core.previousDay(); const vn = day.split('-').reverse().join('/');
  const makeRow = (n) => ({ short: '#' + String(n).padStart(5, '0'), open: `${vn} 07:00`, close: `${vn} 12:00`, device: `TEST-DEVICE-${n}` });
  const rows = Array.from({ length: 12 }, (_, i) => makeRow(i + 1));
  const pages = [{ page: 1, pages: 2, rows: rows.slice(0, 10) }, { page: 2, pages: 2, rows: rows.slice(10) }];
  check(() => assert.equal(core.queueRows(pages, day).length, 12));
  check(() => assert.throws(() => core.queueRows([pages[0], pages[0]], day)));
  check(() => assert.throws(() => core.queueRows([{ page: 1, rows: [{ ...rows[0], close: '' }] }], day)));
  check(() => assert.throws(() => core.queueRows([{ page: 1, rows: [{ ...rows[0], open: '01/01/2000 07:00' }] }], day)));
  check(() => assert.throws(() => core.queueRows([], day)));
  const source = (await fs.readFile(new URL('./worker.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  const fabiSource = await fs.readFile(new URL('./fabi_page.js', import.meta.url), 'utf8');
  const milanoSource = await fs.readFile(new URL('./milano_page.js', import.meta.url), 'utf8');
  new vm.Script(fabiSource.replace('export async function', 'async function'));
  new vm.Script(milanoSource.replace('export async function', 'async function'));
  passed += 2;
  async function harness({ fail = false, missingStore = false, navigationReturnsNull = false, savedState, minutes = 495, beforeCreate } = {}) {
    const local = savedState ? { state: structuredClone(savedState) } : {}, session = {}, tabs = new Map();
    const time = { ...core.vnClock(), minutes }; let startup, message;
    let id = 1, uploaded = 0, previewed = 0;
    const area = (store) => ({
      get: async (key) => ({ [key]: structuredClone(store[key]) }),
      set: async (data) => Object.assign(store, structuredClone(data)),
      remove: async (key) => { delete store[key]; },
    });
    const context = vm.createContext({ ...core, installWebBridge, vnClock: () => ({ ...time }), console, Date, URL, Uint8Array, atob, btoa, setTimeout, crypto: webcrypto,
      fabiPage: function fabiPage() {}, milanoPage: function milanoPage() {},
      chrome: {
        storage: { local: area(local), session: area(session) },
        action: { setBadgeText: async () => {} },
        tabs: {
          create: async ({ url }) => { if (beforeCreate) await beforeCreate(); const t = { id: id++, url, status: 'complete' }; tabs.set(t.id, t); return t; },
          update: async (n, { url }) => { if (url) tabs.get(n).url = url; },
          get: async (n) => { if (!tabs.has(n)) throw Error('Đã đóng tab'); return tabs.get(n); },
        },
        scripting: { executeScript: async ({ func, args: [command, arg], target }) => {
          if (fail) throw Error('Lỗi thử nghiệm');
          let result;
          if (func.name === 'fabiPage') {
            if (command === 'list') result = pages[arg.page - 1];
            if (command === 'open') {
              const url = core.FABI + '-detail?store=TEST&shift_id=TEST' + arg.short.slice(1);
              tabs.get(target.tabId).url = url; result = navigationReturnsNull ? null : { url };
            }
            if (command === 'export') result = { base64: btoa('PK-test-' + arg.short) };
          } else {
            const index = Number(arg.id.slice(-5)) - 1;
            if (command === 'preview') previewed++;
            const hash = 'test-hash-' + arg.id;
            const unchanged = command === 'upload' && arg.previousHash === hash;
            if (command === 'upload' && !unchanged) uploaded++;
            result = { id: arg.id, hash, store: core.STORES[missingStore ? 0 : index % 4], status: unchanged ? 'unchanged' : 'khop' };
          }
          return [{ result }];
        } },
        alarms: { get: async () => ({}), create: async () => {}, onAlarm: { addListener() {} } },
        runtime: { id: 'test', onInstalled: { addListener() {} }, onStartup: { addListener(fn) { startup = fn; } }, onMessage: { addListener(fn) { message = fn; } }, onMessageExternal: { addListener() {} } },
      },
    });
    new vm.Script(source).runInContext(context);
    const run = (s) => vm.runInContext(s, context);
    return { run, local, session, time, startup: () => startup(), tabCount: () => tabs.size, count: () => ({ uploaded, previewed }),
      send: (type) => new Promise((resolve) => message({ type }, { id: 'test' }, resolve)) };
  }
  const h = await harness();
  await h.run("start('preview')"); await h.run('drive()');
  check(() => assert.equal(h.local.state.run.status, 'success'));
  check(() => assert.equal(h.local.state.run.results.length, 12));
  check(() => assert.deepEqual(h.count(), { uploaded: 0, previewed: 12 }));
  check(() => assert.equal(h.local.state.lastSuccess, undefined));
  await h.run("start('upload')"); await h.run('drive()');
  check(() => assert.equal(h.local.state.lastSuccess, day));
  check(() => assert.equal(h.count().uploaded, 12));
  check(() => assert.equal(h.count().previewed, 12)); // dùng lại đúng bộ đã kiểm tra, không xuất thêm
  await h.run("start('upload')"); await h.run('drive()');
  check(() => assert.equal(h.count().uploaded, 12)); // file nguyên vẹn + máy chủ xác nhận → không nhập lại
  check(() => assert.equal(h.session.pending, undefined));
  const bad = await harness({ fail: true });
  await bad.run("start('preview')");
  await bad.run('drive()'); await bad.run('drive()'); await bad.run('drive()');
  check(() => assert.equal(bad.local.state.run.status, 'error'));
  check(() => assert.equal(bad.count().uploaded, 0));
  const missing = await harness({ missingStore: true });
  await missing.run("start('preview')");
  await missing.run('drive()'); await missing.run('drive()'); await missing.run('drive()');
  check(() => assert.equal(missing.local.state.run.status, 'error'));
  check(() => assert.equal(missing.local.state.lastSuccess, undefined));
  check(() => assert.equal(missing.count().uploaded, 0));
  const missingUpload = await harness({ missingStore: true });
  await missingUpload.run("start('upload')"); await missingUpload.run('drive()');
  check(() => assert.equal(missingUpload.count().uploaded, 0)); // lịch tự động cũng kiểm đủ bộ trước khi ghi
  const stopped = await harness(); await stopped.run("start('preview')");
  stopped.local.state.run.stopRequested = true;
  await stopped.run('drive()');
  check(() => assert.equal(stopped.local.state.run.status, 'stopped'));
  check(() => assert.equal(stopped.count().uploaded, 0));
  const navigated = await harness({ navigationReturnsNull: true });
  await navigated.run("start('preview')"); await navigated.run('drive()');
  check(() => assert.equal(navigated.local.state.run.status, 'success'));
  check(() => assert.equal(navigated.count().uploaded, 0));
  const off = await harness(); await off.startup(); await off.run('clock()');
  check(() => assert.equal(off.tabCount(), 0)); // cài mới chưa bật lịch không tự mở tab/nhập dữ liệu
  const auto = await harness({ minutes: 494 });
  auto.local.state = { enabled: true, run: null, done: {} };
  await auto.startup();
  check(() => assert.equal(auto.tabCount(), 0)); // trước 08:15 không chạy
  auto.time.minutes = 660; await auto.run('clock()'); // máy thức muộn lúc 11:00
  check(() => assert.equal(auto.local.state.run.status, 'success'));
  check(() => assert.equal(auto.count().uploaded, 12));
  check(() => assert.equal(auto.local.state.lastSuccess, day));
  check(() => assert.equal(auto.local.state.lastAuto, auto.time.day));
  await auto.run('clock()');
  check(() => assert.equal(auto.tabCount(), 2));
  check(() => assert.equal(auto.count().uploaded, 12));
  const reopened = await harness({ savedState: auto.local.state, minutes: 900 });
  await reopened.startup();
  check(() => assert.equal(reopened.local.state.enabled, true));
  check(() => assert.equal(reopened.tabCount(), 0)); // mở lại Chrome cùng ngày không nhập lại ngày đã xong
  check(() => assert.equal(reopened.count().uploaded, 0));
  const lostFiles = await harness();
  await lostFiles.run("start('upload')");
  await lostFiles.run("(async () => { const s = await read(); while (s.run.phase !== 'commit') await step(s); await save(s); })()");
  delete lostFiles.session.batch;
  await lostFiles.run('drive()'); await lostFiles.run('drive()'); await lostFiles.run('drive()');
  check(() => assert.equal(lostFiles.local.state.run.status, 'error'));
  check(() => assert.equal(lostFiles.count().uploaded, 0)); // mất file tạm thì dừng, không ghi số giả
  check(() => assert.equal(lostFiles.local.state.lastSuccess, undefined));
  const beforeCommit = await harness();
  await beforeCommit.run("start('upload')");
  await beforeCommit.run("(async () => { const s = await read(); while (s.run.phase !== 'commit') await step(s); await save(s); })()");
  beforeCommit.local.state.run.stopRequested = true;
  await beforeCommit.run('drive()');
  check(() => assert.equal(beforeCommit.count().uploaded, 0)); // Dừng lúc chờ không nhập thêm ca kế tiếp
  check(() => assert.equal(beforeCommit.local.state.run.status, 'stopped'));
  const simultaneous = await harness();
  simultaneous.local.state = { enabled: true, run: null, done: {} };
  await simultaneous.run('Promise.all([clock(), clock()])');
  check(() => assert.equal(simultaneous.tabCount(), 2));
  check(() => assert.equal(simultaneous.count().uploaded, 12));
  const doubleClick = await harness();
  await doubleClick.run("Promise.allSettled([start('preview'), start('preview')])");
  check(() => assert.equal(doubleClick.tabCount(), 2));
  await doubleClick.run('drive()');
  check(() => assert.equal(doubleClick.local.state.run.status, 'success'));
  const mixed = await harness(); mixed.local.state = { enabled: true, run: null, done: {} };
  await mixed.run("Promise.all([start('preview'), clock()])");
  check(() => assert.equal(mixed.tabCount(), 2));
  check(() => assert.equal(mixed.local.state.lastAuto, undefined));
  await mixed.run('drive()'); await mixed.run('clock()');
  check(() => assert.equal(mixed.count().uploaded, 12)); // lệnh kiểm tra thủ công không làm mất lượt tự động trong ngày
  let began, release;
  const beganOpening = new Promise((resolve) => { began = resolve; });
  const openingGate = new Promise((resolve) => { release = resolve; });
  const cancelled = await harness({ beforeCreate: async () => { began(); await openingGate; } });
  cancelled.local.state = { enabled: true, run: null, done: {} };
  const opening = cancelled.run("start('preview')");
  await beganOpening; await cancelled.send('stop'); release(); await opening;
  check(() => assert.equal(cancelled.local.state.enabled, false));
  check(() => assert.equal(cancelled.local.state.run, null));
  check(() => assert.equal(cancelled.count().uploaded, 0));
  const partial = await harness(); await partial.run("start('upload')");
  await partial.run("(async () => { const s = await read(); while (s.run.phase !== 'commit') await step(s); await step(s); await save(s); })()");
  check(() => assert.equal(partial.count().uploaded, 1));
  delete partial.session.batch;
  await partial.run('drive()'); await partial.run('drive()'); await partial.run('drive()');
  check(() => assert.equal(partial.local.state.run.status, 'error'));
  check(() => assert.equal(partial.local.state.lastSuccess, undefined));
  const recovered = await harness({ savedState: partial.local.state });
  await recovered.run("start('upload')"); await recovered.run('drive()');
  check(() => assert.equal(recovered.local.state.run.status, 'success'));
  check(() => assert.equal(recovered.count().uploaded, 11)); // một ca đã xác minh trước khi mất phiên không bị nhập lại
  passed += await validationTests(day, core.STORES[0]);
  passed += await bridgeTests();
  return { passed, note: 'Dữ liệu giả; chưa thay thế kiểm tra Chrome/Fabi/Milano thật.' };
}
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) console.log(await runTests());
