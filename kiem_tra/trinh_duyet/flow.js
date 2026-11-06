export default async ({ visit, settle, sleep, out }) => {
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 400), len: 0, errs });
  const calls = (from) => window.__LOG.slice(from).filter((x) => x[0] === 'rpc' && !/^app_(log|order_window|schedule_|notify|me)/.test(x[1]));
  const waitBlob = async (n) => { for (let i = 0; i < 100 && window.__blobs.length <= n; i++) await sleep(100); return window.__blobs[n]; };
  const flashText = () => [...document.querySelectorAll('#root .alert')].map((a) => a.textContent.trim()).join(' | ');
  const step = async (name, fn) => { window.__ERR.length = 0; try { await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, flashText(), [...window.__ERR]); };

  await step('order: mẫu → nhập Form', async () => {
    await visit('#/quan-ly/order?tuan=2026-11-02'); out.pop();
    const n = window.__blobs.length; document.getElementById('tpl-btn').click(); const b = await waitBlob(n);
    if (!b) throw new Error('không tải được file mẫu');
    window.__nextFile = new File([b], 'form.xlsx'); const k = window.__LOG.length;
    document.getElementById('form-btn').click(); await sleep(1500); await settle();
    const c = calls(k).find((x) => x[1] === 'app_order_form_import'); if (!c) throw new Error('không gọi app_order_form_import');
    window.__ERR.push && out.push({ route: '   rows', title: JSON.stringify(c[2].p_rows).slice(0, 200), len: 0, errs: [] });
  });
  await step('nhân viên: mẫu → nhập', async () => {
    await visit('#/quan-ly/nhan-vien'); out.pop();
    const n = window.__blobs.length; document.getElementById('tpl-btn').click(); const b = await waitBlob(n);
    window.__nextFile = new File([b], 'nv.xlsx'); const k = window.__LOG.length;
    document.getElementById('imp-btn').click(); await sleep(1500); await settle();
    const c = calls(k).find((x) => x[1] === 'app_import_employees'); if (!c) throw new Error('không gọi app_import_employees');
    out.push({ route: '   rows', title: JSON.stringify(c[2].p_rows).slice(0, 300), len: 0, errs: [] });
  });
  let zip;
  await step('dữ liệu: xuất ZIP', async () => {
    location.hash = '#/__tam'; await settle(); await visit('#/quan-ly/du-lieu'); out.pop();
    const n = window.__blobs.length; document.getElementById('export-btn').click(); zip = await waitBlob(n);
    for (let i = 0; i < 100 && !zip; i++) { await sleep(200); zip = window.__blobs[n]; }
    if (!zip) throw new Error('không tạo được ZIP'); out.push({ route: '   zip', title: zip.size + ' bytes ' + zip.type, len: 0, errs: [] });
  });
  for (const [name, getFile] of [['ZIP vừa xuất', async () => new File([zip], 'web.zip')], ['ZIP offline', async () => new File([await (await fetch('test/offline.zip')).blob()], 'offline.zip')], ['SQLite offline', async () => new File([await (await fetch('test/offline_moi_nhat.sqlite3')).blob()], 'a.sqlite3')]]) {
    await step('dữ liệu: nhập ' + name, async () => {
      location.hash = '#/__tam'; await settle(); await visit('#/quan-ly/du-lieu'); out.pop();
      const f = await getFile(); const inp = document.getElementById('file'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
      for (let i = 0; i < 100 && !document.getElementById('go'); i++) await sleep(200);
      const k = window.__LOG.length; document.getElementById('go').click();
      for (let i = 0; i < 150 && !calls(k).some((x) => x[1] === 'app_import_finish'); i++) await sleep(200);
      await settle();
      const cs = calls(k); const rowsCalls = cs.filter((x) => x[1] === 'app_import_rows');
      const tabs = {}; rowsCalls.forEach((x) => { tabs[x[2].p_table] = (tabs[x[2].p_table] || 0) + (x[2].p_rows || []).length; });
      out.push({ route: '   calls', title: cs.map((x) => x[1]).filter((v, i, a) => a.indexOf(v) === i).join(',') + ' ' + JSON.stringify(tabs).slice(0, 300), len: 0, errs: [] });
    });
  }
};
