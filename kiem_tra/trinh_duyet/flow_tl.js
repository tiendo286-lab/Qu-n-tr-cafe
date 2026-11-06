// Luồng Nội quy / Quy trình (role=chu: soạn, đăng, cột nhân viên; role=nv: đọc, xác nhận)
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 500), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const go = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); };
  if (q.get('role') === 'nv') {
    await step('NV đọc nội quy', async () => { await go('#/noi-quy'); return txt('.doc-card summary') + ' | bảng: ' + $$('.doc table').length + ' | ảnh có link: ' + $$('.doc img[src]').length + ' | XSS=' + (window.__XSS || 'không') + ' | ' + txt('.alert.warn') + ' | thanh dưới: ' + txt('.tabbar'); });
    await step('NV bấm Tôi đã đọc', async () => { $('.read-btn').click(); await sleep(400); await settle(); return txt('.doc-card summary') + ' | ' + txt('.doc-card .alert'); });
    await step('NV xem quy trình, không có nút sửa', async () => { await go('#/quy-trinh'); return txt('.doc-card summary') + ' | nút sửa: ' + $$('a[href^="#/tai-lieu/soan"]').length; });
    await step('NV vào trang soạn', async () => { await go('#/tai-lieu/soan?loai=noi_quy'); return document.title; });
    return;
  }
  await step('Chủ xem nội quy', async () => { await go('#/noi-quy'); return txt('.doc-card summary') + ' | XSS=' + (window.__XSS || 'không') + ' | nút: ' + txt('.toolbar'); });
  await step('Soạn nội quy mới', async () => {
    await go('#/tai-lieu/soan?loai=noi_quy');
    $('#ed-title').value = 'Đồng phục'; $('#ed-title').dispatchEvent(new Event('input'));
    const area = $('#ed-area'); area.focus();
    const sel = getSelection(); sel.selectAllChildren(area); sel.collapseToEnd();
    document.execCommand('insertText', false, 'Áo đồng phục sạch sẽ');
    $('[data-cmd=h2]').click(); await sleep(50);
    document.execCommand('insertHTML', false, '<p>Thẻ tên</p>');
    sel.selectAllChildren(area.lastChild); $('[data-cmd=bold]').click();
    sel.selectAllChildren(area); sel.collapseToEnd();
    $('[data-cmd=ul]').click(); document.execCommand('insertText', false, 'Giày đen');
    window.prompt = () => '3x2'; sel.selectAllChildren(area); sel.collapseToEnd(); $('[data-cmd=table]').click(); await sleep(50);
    const td = area.querySelector('td'); sel.selectAllChildren(td); sel.collapseToStart(); $('[data-cmd=row]').click(); $('[data-cmd=col]').click();
    // dán HTML độc từ ngoài
    const dt = new DataTransfer(); dt.setData('text/html', '<p style="color:red" onclick="x()">Dán <script>alert(1)</script><a href="javascript:alert(1)">link</a><a href="https://milano.vn">web</a></p>');
    sel.selectAllChildren(area); sel.collapseToEnd(); area.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    $('#ed-save').click(); await sleep(600);
    const h = window.__LAST_HTML || '';
    return `hash=${location.hash} | lưu: ${txt('#saved-indicator')} | có h2=${/<h2>/.test(h)} b=${/<b>|<strong>/.test(h)} ul=${/<ul>/.test(h)} bảng=${(h.match(/<tr>/g) || []).length} hàng, ${(h.match(/<th>/g) || []).length} cột tiêu đề | script=${/script/i.test(h)} onclick=${/onclick/.test(h)} javascript:=${/javascript:/i.test(h)} style=${/style=/.test(h)} link https=${/href="https:\/\/milano.vn"/.test(h)}`;
  });
  await step('Xem trước + Đăng', async () => {
    $('#ed-preview').click(); await sleep(200); const pv = txt('#ed-prev').slice(0, 80);
    $('#ed-publish').click(); await sleep(800); await settle();
    return 'xem trước: ' + pv + ' → ' + location.hash + ' | ' + txt('#root .alert') + ' | ' + $$('.doc-card').length + ' tài liệu';
  });
  await step('Cột Nội quy / Cam kết ở tab Nhân viên', async () => {
    await go('#/quan-ly/nhan-vien');
    const head = [...$$('thead th')].map((t) => t.innerText).join('|');
    const b = $('.nq-btn'); const before = b.innerText; b.click(); await sleep(400); await settle();
    const after = $('.nq-btn').innerText;
    const s = $('.ck-select'); s.value = 'da_ky_nop'; s.dispatchEvent(new Event('change')); await sleep(300);
    const f = $('#ef-ck'); f.value = 'da_ky_nop'; f.dispatchEvent(new Event('input'));
    return `cột: ${head} | nội quy: ${before} → ${after} | cam kết lưu: ${txt('#saved-indicator')} | lọc "Đã ký và nộp": ${txt('#ef-count')}`;
  });
  await step('Xóa tài liệu', async () => {
    await go('#/tai-lieu/soan?id=1'); $('#ed-del').click(); await sleep(500); await settle(); return location.hash + ' | ' + txt('#root .alert') + ' | còn ' + $$('.doc-card').length;
  });
};
