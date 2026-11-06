// Luồng Dữ liệu & sao lưu (role=chu): số liệu + tải gói ZIP, mở gói ra kiểm tra có đủ file
export default async ({ visit, settle, sleep, out }) => {
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 700), len: 0, errs });
  const $ = (s) => document.querySelector(s);
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR]); };
  location.hash = '#/quan-ly/du-lieu'; for (let i = 0; i < 100 && !$('#export-btn'); i++) await sleep(100); await sleep(500);
  await step('Số liệu', async () => $('.kv').innerText.replace(/\s+/g, ' '));
  await step('Tải gói ZIP + mở ra kiểm tra', async () => {
    let blob = null; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { blob = b; return orig.call(URL, b); };
    $('#export-btn').click();
    for (let i = 0; i < 600 && !blob; i++) await sleep(100);
    if (!blob) return 'KHÔNG TẠO ĐƯỢC GÓI · ' + $('#export-status').textContent;
    const zip = await window.JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);
    const extra = JSON.parse(await zip.file('du_lieu_tinh_nang_moi.json').async('string'));
    const man = JSON.parse(await zip.file('manifest.json').async('string'));
    return `${$('#export-status').textContent} · file: ${files.join(', ')} · json: ${Object.entries(extra).map(([t, r]) => t + '=' + r.length).join(' ')} · manifest.web_extra=${JSON.stringify(man.web_extra)}`;
  });
};
