// Luồng Đào tạo: role=chu (danh sách, tạo phiếu, chấm hạng mục, cột Nhân viên) ; role=nv (NV id 3 xem phiếu mình, xác nhận ngày, không chấm được)
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const log = (route, title, errs = []) => out.push({ route, title: String(title).slice(0, 500), len: 0, errs });
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const step = async (name, fn) => { window.__ERR.length = 0; let r = ''; try { r = await fn(); } catch (e) { window.__ERR.push('flow: ' + e.stack); } log(name, r || '', [...window.__ERR, ...$$('#root .alert.error').map((a) => 'page: ' + a.textContent.trim())]); };
  const go = async (h) => { location.hash = '#/__tam'; await settle(); await visit(h); out.pop(); };
  const ch = (el, v) => { if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  if (q.get('role') === 'ql') {
    await step('QL chỉ có quyền Đào tạo: danh sách Nhân viên', async () => {
      await go('#/quan-ly/nhan-vien'); const head = [...$$('thead th')].map((t) => t.innerText).join('|');
      return `cột: ${head} | nút Thêm NV: ${$$('a[href*="them=1"]').length} | Excel: ${$$('#imp-btn').length} | nút tạo phiếu: ${$$('.new-dt').length} | tên có link sửa: ${$$('a.emp-name').length}`;
    });
    await step('QL mở form sửa NV', async () => { await go('#/quan-ly/nhan-vien?id=30'); return document.title + ' | ' + txt('#root .card'); });
    return;
  }
  if (q.get('role') === 'nv') {
    await step('NV: phiếu của tôi', async () => { await go('#/cua-toi/dao-tao'); return txt('#root .card') + ' | chân trang: ' + txt('.m-foot'); });
    await step('NV: mở phiếu, ô chấm bị khóa', async () => { await go('#/dao-tao/phieu?id=1'); return `ô giới thiệu khóa=${$$('.it-intro').every((x) => x.disabled)} | nút NV xác nhận bật=${!$('.day-ok[data-who=nv]').disabled} | nút HD bật=${!$('.day-ok[data-who=hd]').disabled}`; });
    await step('NV xác nhận ngày 1', async () => { $('.day-ok[data-who=nv]').click(); await sleep(400); await settle(); return txt('.dt-day[data-day="1"] summary') + ' | ' + txt('.day-ok[data-who=nv]'); });
    await step('NV vào danh sách Nhân viên', async () => { await go('#/quan-ly/nhan-vien'); return document.title; });
    return;
  }
  await step('Menu không còn tab Đào tạo riêng', async () => { await go('#/'); return 'nhóm menu: ' + [...$$('.nav .group')].map((g) => g.innerText).join(', ') + ' | CÁ NHÂN có: ' + (txt('.nav').includes('Phiếu đào tạo của tôi') ? 'Phiếu đào tạo của tôi' : 'KHÔNG'); });
  await step('Nhân viên: lọc đào tạo + tạo phiếu', async () => {
    await go('#/quan-ly/nhan-vien'); const chips = txt('.card-head');
    $('.dt-chip[data-st=chua_dao_tao]').click(); const n = txt('#ef-count');
    $('.new-dt').click(); await sleep(400); const d = $('dialog[open]'); d.querySelector('[name=hd]').value = d.querySelector('#dt-emps option').value;
    d.querySelector('#dt-new').requestSubmit(); await sleep(500); await settle();
    return chips.slice(-90) + ' | lọc chưa đào tạo: ' + n + ' → ' + location.hash + ' · ' + txt('.dt-prog') + ' · nút quay lại: ' + txt('.page-head .toolbar a');
  });
  await step('Chấm: mức trước khi đủ bước bị khóa; đủ 3 bước', async () => {
    const row = $('.dt-item'); const lvLocked = row.querySelector('.it-level').disabled; const pracLocked = row.querySelector('.it-prac').disabled;
    ch(row.querySelector('.it-intro'), true); await sleep(200); ch(row.querySelector('.it-prac'), true); await sleep(200); ch(row.querySelector('.it-level'), 'kha'); await sleep(300);
    return `ban đầu: thực hành khóa=${pracLocked}, mức khóa=${lvLocked} → sau 3 bước: ${txt('.dt-prog')} | ${row.querySelector('.it-by').textContent} | ngày 1: ${txt('.dt-day[data-day="1"] summary')}`;
  });
  await step('Bỏ giới thiệu → xóa mức', async () => {
    const row = $('.dt-item'); ch(row.querySelector('.it-intro'), false); await sleep(300);
    return `thực hành=${row.querySelector('.it-prac').checked} mức="${row.querySelector('.it-level').value}" | ${txt('.dt-prog')}`;
  });
  await step('Nhận xét + HD xác nhận + đánh giá cuối khóa', async () => {
    ch($('.day-cmt'), 'Tốt'); await sleep(200); ch($('.info-f[data-f=strengths]'), 'Nhanh nhẹn'); await sleep(200);
    $('.day-ok[data-who=hd]').click(); await sleep(400); await settle();
    return txt('#saved-indicator') + ' | ' + txt('.day-ok[data-who=hd]') + ' | NV xác nhận (Chủ không phải NV) bật=' + !$('.day-ok[data-who=nv]').disabled;
  });
  await step('Cột Đào tạo ở tab Nhân viên', async () => {
    await go('#/quan-ly/nhan-vien'); const head = [...$$('thead th')].map((t) => t.innerText).join('|');
    ch($('#ef-dt'), 'dang_dao_tao'); $('#ef-dt').dispatchEvent(new Event('input'));
    return head + ' | lọc đang đào tạo: ' + txt('#ef-count') + ' | ' + $$('tr.emp-row:not([hidden]) a.pill').map((a) => a.innerText).join(', ');
  });
};
