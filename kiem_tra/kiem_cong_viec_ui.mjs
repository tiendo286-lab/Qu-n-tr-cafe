// Kiểm tra module/biểu mẫu trong DOM bộ nhớ; không thay cho kiểm tra hình ảnh 390px.
// Hàm nhận parseHTML của linkedom (chỉ dùng ở môi trường thử, không thêm thư viện vào web).
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

export async function runUiChecks(root, parseHTML) {
  const { document, window, HTMLElement } = parseHTML('<html><body><main id="test-root"></main></body></html>');
  const calls = [], cases = [], cache = new Map();
  const now = '2026-11-15 12:00:00';
  const fixture = {
    now, people: [{ id: 1, name: 'Chủ thử', role: 'chu', can_manage: true }, { id: 7, name: 'Kế toán thử', role: 'ke_toan' }],
    branches: [{ id: 1, code: 'CS A', name: 'Cơ sở thử' }], handover: [], rules: [],
    tasks: [{ id: 1, content: 'Đối soát ca thử', status: 'da_giao', assignee_id: 7, assignee_name: 'Kế toán thử', cv_kind: 'recon', cv_key: 'recon:1', source_state: { title: 'Đối soát ca thử', kind: 'recon', blocked: 'Chờ dữ liệu', link: '/quan-ly/doi-soat/ca?id=1' }, due_date: '2026-11-14', priority: 'gap' },
      { id: 2, content: 'Hồ sơ chờ xác nhận', status: 'cho_duyet', assignee_id: 7, reviewer_id: 1, report: 'Đã bổ sung', priority: 'binh_thuong' }],
    sources: [{ key: 'doc_followup:1:v1', kind: 'doc_followup', title: 'Đôn đốc sổ tay', detail: '8/12 đã đọc', link: '/noi-quy?id=1' }],
  };
  const enhance = (parent) => parent.querySelectorAll('form').forEach((f) => {
    const items = [...f.querySelectorAll('[name]')];
    Object.defineProperty(f, 'elements', { value: { namedItem: (name) => items.find((e) => e.name === name) }, configurable: true });
    for (const el of items) {
      if (!(el.name in f)) Object.defineProperty(f, el.name, { value: el, configurable: true });
      if (el.type === 'checkbox') el.checked = el.hasAttribute('checked');
      if (el.tagName === 'SELECT') Object.defineProperty(el, 'value', {
        get() { return [...this.querySelectorAll('option')].find((o) => o.hasAttribute('selected'))?.value || ''; },
        set(value) { this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === String(value))); }, configurable: true,
      });
    }
  });
  HTMLElement.prototype.showModal = function () { this.setAttribute('open', ''); enhance(this); };
  HTMLElement.prototype.close = function () { this.dispatchEvent(new window.Event('close')); this.remove(); };
  HTMLElement.prototype.scrollIntoView = function () {};
  class FormDataFake {
    constructor(f) { this.rows = [...f.querySelectorAll('input,select,textarea')].filter((e) => e.name && !e.disabled && (e.type !== 'checkbox' || e.checked)).map((e) => [e.name, e.type === 'checkbox' ? 'on' : e.value || '']); }
    [Symbol.iterator]() { return this.rows[Symbol.iterator](); }
  }
  const context = vm.createContext({ document, window, console, FormData: FormDataFake, location: { hash: '#/quan-ly/giao-viec' },
    sessionStorage: { setItem() {} }, setTimeout, clearTimeout, confirm: () => true });
  const stub = (name, source) => { const m = new vm.SourceTextModule(source, { context, identifier: name }); cache.set(name, m); return m; };
  context.__rpc = async (name, args) => { calls.push({ name, args }); if (name === 'app_cv_board') return fixture; if (name === 'app_cv_preview') return { rows: [], token: 'preview' }; return 1; };
  stub('app.js', 'export function render() {}'); stub('data.js', "export function vnToday(){return '2026-11-15'}");
  stub('sb.js', 'export const rpc=(name,args)=>globalThis.__rpc(name,args)');
  for (const name of ['ui.js', 'tien.js', 'cong_viec.js', 'pages/viec.js', 'pages/trung_tam_viec.js']) stub(name, await fs.readFile(path.join(root, 'docs/js', name), 'utf8'));
  const m = cache.get('pages/trung_tam_viec.js');
  await m.link((specifier, parent) => { const name = path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier), specifier)); assert.ok(cache.has(name), name); return cache.get(name); }); await m.evaluate();
  const ui = cache.get('ui.js').namespace;
  const show = async (params = {}) => {
    const p = await m.namespace.render({ params, me: { account_id: 1 } }); document.getElementById('test-root').innerHTML = ui.str(p.html);
    document.querySelectorAll('select').forEach((el) => Object.defineProperty(el, 'value', {
      get() { return [...this.querySelectorAll('option')].find((o) => o.hasAttribute('selected'))?.value || ''; },
      set(value) { this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === String(value))); }, configurable: true,
    }));
    p.mount(); return p;
  };
  const $ = (s) => document.querySelector(s), click = (s) => { const el = $(s); assert.ok(el, s); el.onclick ? el.onclick({ target: el }) : el.dispatchEvent(new window.Event('click')); };
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
  await show();
  assert.equal(document.querySelectorAll('[data-task]').length, 2);
  assert.ok($('#cv-results').textContent.includes('Chờ xác nhận'));
  assert.ok($('#cv-results').textContent.includes('Chờ đầu vào')); cases.push('Phân biệt chờ đầu vào và chờ xác nhận');
  click('[data-metric="blocked"]'); assert.equal(document.querySelectorAll('[data-task]').length, 1); cases.push('Lọc trạng thái');
  click('#v-add');
  let f = $('#cv-task-form'); assert.ok(f); assert.ok(f.assignee_id.textContent.includes('Kế toán thử'));
  f.content.value = 'Công việc thử'; f.assignee_id.value = '7'; f.onsubmit({ preventDefault() {} }); await flush();
  let call = calls.find((c) => c.name === 'app_cv_task_save'); assert.equal(call.args.p.assignee_id, '7'); assert.equal(call.args.p.content, 'Công việc thử'); cases.push('Tạo việc với tài khoản kế toán riêng');
  await show({ tab: 'quy-tac' }); click('[data-template="recurring"]');
  f = $('#cv-rule-form'); assert.ok(!$('#cv-schedule').hidden); f.assignee_id.value = '7'; f.enabled.checked = true;
  f.onsubmit({ preventDefault() {} }); await flush(); assert.ok($('.cv-error').textContent.includes('Xem trước')); cases.push('Không bật khi chưa xem trước');
  click('#cv-preview'); await flush(); f.onsubmit({ preventDefault() {} }); await flush();
  call = calls.find((c) => c.name === 'app_cv_rule_save'); assert.equal(call.args.p_preview, 'preview'); assert.equal(call.args.p.enabled, true); cases.push('Xem trước và lưu quy tắc');
  await show(); click('#cv-add-rule'); f = $('#cv-rule-form'); f.kind.value = 'doc_read'; f.kind.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(f.assign_mode.value, 'subject'); assert.ok(f.branch_id.disabled); assert.ok(f.assignee_id.disabled); cases.push('Đọc tài liệu giao chính người trên hồ sơ, toàn công ty');
  $('dialog').close();
  await show(); click('[data-view="sources"]'); click('[data-source]'); assert.ok($('[data-open-source]')); assert.ok(!$('#cv-task-form').content); cases.push('Việc nguồn mở đúng hồ sơ, không sửa nội dung nguồn');
  $('dialog').close();
  return { passed: cases.length, cases };
}
