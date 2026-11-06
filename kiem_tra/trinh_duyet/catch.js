window.__ERR = [];
const q = new URLSearchParams(location.search);
if (q.get('role')) localStorage.setItem('test_role', q.get('role'));
if (q.get('login') !== '0') localStorage.setItem('fake_login', '1'); else localStorage.removeItem('fake_login');
localStorage.setItem('test_open', q.get('open') || '0');
window.addEventListener('error', (e) => window.__ERR.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => window.__ERR.push('reject: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
const ce = console.error; console.error = (...a) => { window.__ERR.push('console: ' + a.map((x) => x && x.stack || String(x)).join(' ')); ce(...a); };
window.alert = (m) => window.__ERR.push('alert: ' + m);
window.confirm = (m) => { window.__LOG && window.__LOG.push(['confirm', m]); return q.get('confirm') === '1'; };
window.prompt = (m) => (q.get('confirm') === '1' ? ((m.match(/Gõ ([A-Z]+)/) || [])[1] || 'x') : null);
HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function () { this.open = true; };
window.__blobs = [];
const oc = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blobs.push(b); return oc(b); };
const ic = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () {
  if (this.type === 'file' && window.__nextFile) { const dt = new DataTransfer(); dt.items.add(window.__nextFile); this.files = dt.files; window.__nextFile = null; this.dispatchEvent(new Event('change', { bubbles: true })); return; }
  return ic.call(this);
};
