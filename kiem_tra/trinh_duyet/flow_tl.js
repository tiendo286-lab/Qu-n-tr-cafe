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
    await step('NV xem quy trình, training và đánh giá', async () => {
      await go('#/quy-trinh'); const group = txt('.procedure-card'); $('.procedure-card').click(); await sleep(400); await settle();
      if (!txt('.qt-my-status').includes('Training chạy bàn') || !txt('.qt-my-status').includes('Đánh giá chạy bàn')) throw new Error('Thiếu trạng thái training / đánh giá');
      if (!$('.qt-index-link') || !$('.qt-doc-card')) throw new Error('Thiếu mục lục hoặc bài quy trình');
      return group + ' | ' + txt('.qt-my-status') + ' | nút sửa: ' + $$('a[href^="#/tai-lieu/soan"]').length;
    });
    await step('NV chỉ thấy bản đăng, không sửa được nhóm', async () => {
      const { makeTl } = await import('./tl_gia.js');
      const T = {}; const api = makeTl(T, { employee_id: 1, perms: {} });
      T.docs.push({ id: 101, kind: 'quy_trinh', title: 'Nháp kín', draft_html: '<p>Kín</p>', published_version: 0, procedure_title: 'Bộ kín' });
      Object.assign(T.docs.find((d) => d.id === 2), { procedure_title: 'Tên chưa đăng', published_procedure_title: 'Quy trình nhân viên order' });
      const rows = api.app_tl_list({ p_kind: 'quy_trinh' });
      if (rows.some((d) => d.id === 101) || rows.find((d) => d.id === 2).procedure_title !== 'Quy trình nhân viên order') throw new Error('Lộ bộ nháp cho nhân viên');
      let denied = false;
      try { api.app_tl_save_procedure({ p_id: 2, p_title: 'Sửa trái phép', p_html: '<p>x</p>', p_procedure: 'x' }); } catch { denied = true; }
      if (!denied) throw new Error('Nhân viên được sửa quy trình');
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('Trang tràn ngang');
      return 'Ẩn bản nháp, giữ tên bản đăng, chặn nhân viên sửa, không tràn ngang';
    });
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
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await step('Danh sách quy trình và liên kết bài cũ', async () => {
    await go('#/quy-trinh');
    assert(txt('.procedure-card').includes('Quy trình nhân viên order'), 'Thiếu bộ quy trình cũ');
    assert(!$('.doc-card'), 'Trang danh sách còn trộn các bài');
    $('#qt-search').value = 'kéo rèm'; $('#qt-search').dispatchEvent(new Event('input'));
    assert(!$('.procedure-card').hidden && txt('#qt-count').startsWith('1 '), 'Tìm nội dung không ra bộ quy trình');
    await go('#/quy-trinh?id=2');
    assert($('#doc-2')?.open, 'Liên kết bài cũ không mở đúng bài');
    assert($('#root').textContent.includes('Quy trình nhân viên order'), 'Liên kết bài thiếu tên bộ');
    assert($('.qt-index-link'), 'Thiếu mục lục bài quy trình');
    $('#qt-search').value = 'kéo rèm'; $('#qt-search').dispatchEvent(new Event('input'));
    assert(!$('#doc-2').hidden && txt('#qt-count').startsWith('1 '), 'Tìm nội dung không ra bài');
    return 'Bộ cũ, liên kết bài và tìm từ nội dung đều đúng';
  });
  await step('Tạo quy trình mới và lưu nháp', async () => {
    await go('#/tai-lieu/soan?loai=quy_trinh');
    $('#ed-title').value = 'Vệ sinh máy'; $('#ed-area').innerHTML = '<p>Rửa máy cuối ca.</p>';
    $('#ed-save').click(); await sleep(200);
    assert(txt('#saved-indicator').includes('Nhập tên quy trình'), 'Cho lưu khi thiếu tên quy trình');
    $('#ed-procedure').value = 'Quy trình pha chế'; $('#ed-save').click(); await sleep(400);
    assert(txt('#saved-indicator').includes('Đã lưu'), 'Không lưu được bài quy trình');
    window.__QT_ID = Number(new URLSearchParams(location.hash.split('?')[1]).get('id'));
    await go('#/quy-trinh');
    assert($$('.procedure-card').some((x) => x.textContent.includes('Quy trình pha chế')), 'Thiếu quy trình mới');
    return 'Tạo riêng bộ mới, không đổi bộ order';
  });
  await step('Đăng bài rồi mở đúng quy trình', async () => {
    await go('#/tai-lieu/soan?id=' + window.__QT_ID);
    $('#ed-publish').click(); await sleep(600); await settle();
    assert($('#doc-' + window.__QT_ID)?.open, 'Đăng xong không mở bài');
    assert(!$('#doc-2'), 'Bài order lẫn vào bộ pha chế');
    return txt('#root h2') + ' | ' + txt('.doc-card summary');
  });
  await step('Nhóm bản nháp chỉ đổi cho nhân viên khi đăng', async () => {
    const { rpc } = await import('../js/sb.js');
    const d = await rpc('app_tl_get', { p_id: window.__QT_ID });
    await rpc('app_tl_save_procedure', { p_id: d.id, p_title: d.title, p_html: d.draft_html, p_procedure: 'Quy trình quản lý' });
    let rows = await rpc('app_tl_list', { p_kind: 'quy_trinh' });
    let saved = rows.find((x) => x.id === d.id);
    assert(saved.procedure_title === 'Quy trình quản lý' && saved.published_procedure_title === 'Quy trình pha chế' && saved.has_draft, 'Nháp làm thay đổi nhóm bản đăng');
    await rpc('app_tl_publish', { p_id: d.id });
    rows = await rpc('app_tl_list', { p_kind: 'quy_trinh' });
    saved = rows.find((x) => x.id === d.id);
    assert(saved.published_procedure_title === 'Quy trình quản lý', 'Đăng không đổi nhóm');
    await go('#/quy-trinh');
    assert(document.documentElement.scrollWidth <= innerWidth, 'Trang tràn ngang');
    return 'Tách nhóm bản nháp / bản đăng, không tràn ngang';
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
