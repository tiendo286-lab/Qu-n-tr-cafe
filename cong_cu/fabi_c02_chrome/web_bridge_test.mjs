import assert from 'node:assert/strict';
import { installWebBridge, isControlPage, validRequest, webView } from './web_bridge.mjs';
import { previousDay } from './core.mjs';
export async function bridgeTests() {
  let passed = 0;
  const check = (fn) => { fn(); passed++; };
  const url = 'https://tiendo286-lab.github.io/Qu-n-tr-cafe/#/ke-toan/fabi?cn=1';
  check(() => assert.equal(isControlPage(url), true));
  for (const bad of ['https://other.example/Qu-n-tr-cafe/#/ke-toan/fabi', url.replace('/fabi?', '/fabi-fake?'), url.replace('/Qu-n-tr-cafe/', '/other/'), 'invalid']) check(() => assert.equal(isControlPage(bad), false));
  for (const bad of [{ v: 1, type: 'upload', rows: [] }, { v: 1, type: 'enable', value: 'true' }, { v: 2, type: 'state' }, { v: 1, type: 'navigate' }]) check(() => assert.equal(!!validRequest(bad), false));
  check(() => assert.equal(validRequest({ v: 1, type: 'enable', value: true }), true));
  const state = { enabled: true, done: { secret: true }, lastSuccess: previousDay(), run: { status: 'success', mode: 'preview', day: previousDay(),
    message: 'PRIVATE', queue: [{ private: 'PRIVATE' }], results: [{ private: 'PRIVATE' }], staged: [{ base64: 'PRIVATE' }], app: 5, fabi: 6 } };
  const dto = webView(state, '0.2.0');
  check(() => assert.equal(JSON.stringify(dto).includes('PRIVATE'), false));
  check(() => assert.equal(dto.canUpload, true));
  check(() => assert.equal(webView({ run: { ...state.run, day: '2000-01-01' } }, '0.2.0').canUpload, false));
  let listener, allowed = true, tabUrl = url, writes = 0;
  installWebBridge({ chrome: { tabs: { get: async () => ({ url: tabUrl }) }, runtime: { onMessageExternal: { addListener(fn) { listener = fn; } }, getManifest: () => ({ version: '0.2.0' }) } },
    read: async () => state, authorize: async () => allowed, control: async () => { writes++; return state; } });
  const sender = { tab: { id: 1 }, url, frameId: 0, origin: 'https://tiendo286-lab.github.io', documentId: 'TEST' };
  const call = (m, s = sender) => new Promise((resolve) => listener(m, s, resolve));
  check(() => assert.equal(writes, 0));
  const read = await call({ v: 1, type: 'state' });
  check(() => assert.equal(read.state.extensionVersion, '0.2.0'));
  check(() => assert.equal(writes, 0));
  await call({ v: 1, type: 'preview' }); check(() => assert.equal(writes, 1));
  for (const s of [{ ...sender, frameId: 1 }, { ...sender, id: 'another-extension' }, { ...sender, url: 'https://other.example' }]) {
    const rejected = await call({ v: 1, type: 'upload' }, s);
    check(() => assert.ok(rejected.error));
  }
  allowed = false;
  const denied = await call({ v: 1, type: 'upload' }); check(() => assert.ok(denied.error));
  allowed = true; tabUrl = 'https://other.example';
  const changed = await call({ v: 1, type: 'upload' }); check(() => assert.ok(changed.error));
  check(() => assert.equal(writes, 1));
  return passed;
}
