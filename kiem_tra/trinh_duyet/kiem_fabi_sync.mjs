// Node: thử vòng đời bảng điều khiển bằng DOM giả, không gọi Chrome hoặc Supabase thật.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
export async function runSyncTests() {
  let passed = 0;
  const check = (fn) => { fn(); passed++; };
  const source = (await fs.readFile(new URL('../../docs/js/fabi_sync.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace(/export function/g, 'function');
  const nodes = new Map(), panel = { dataset: {} }; let tick, imports = 0, calls = [];
  const node = (id) => { if (!nodes.has(id)) nodes.set(id, { closest: () => panel }); return nodes.get(id); };
  let state = { bridgeVersion: 1, status: 'running', mode: 'upload', phase: 'commit', day: '2026-11-14', progress: { done: 1, total: 12 }, enabled: true, lastFinishedAt: null, canUpload: false, canEnable: false };
  const context = vm.createContext({
    $: node, html: () => {}, addDays() {}, vnToday() {}, dmy: (s) => s, console, setTimeout, clearTimeout,
    setInterval: (fn) => { tick = fn; return 1; }, clearInterval: () => {},
    document: { hidden: false, addEventListener() {}, removeEventListener() {} }, navigator: { userActivation: { isActive: true } }, confirm: () => true,
    chrome: { runtime: { sendMessage: (_id, m, cb) => { calls.push(m.type); cb({ state }); } } },
  });
  new vm.Script(source).runInContext(context);
  const cleanup = context.mountSync(() => imports++);
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  check(() => assert.deepEqual(calls, ['state']));
  check(() => assert.equal(imports, 0));
  state = { ...state, status: 'success', lastFinishedAt: 100, progress: { done: 12, total: 12 } };
  tick(); await settle();
  check(() => assert.equal(imports, 1)); // mở giữa lượt, xong phải làm mới dữ liệu
  tick(); await settle();
  check(() => assert.equal(imports, 1)); // poll lặp không làm mới vô hạn
  await node('#fb-sync-preview').onclick({ isTrusted: false });
  check(() => assert.equal(calls.filter((x) => x === 'preview').length, 0));
  await node('#fb-sync-preview').onclick({ isTrusted: true });
  check(() => assert.equal(calls.filter((x) => x === 'preview').length, 1));
  cleanup(); tick(); await settle();
  const count = calls.length; tick(); await settle();
  check(() => assert.equal(calls.length, count));
  return { passed, note: 'DOM giả, không thay thế kiểm tra Chrome thật.' };
}
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) console.log(await runSyncTests());
