// Bài thử 28/11: mục Đào tạo + Phân công đào tạo chuyển từ nhóm Công việc sang nhóm Nhân viên & tài khoản (chỉ đổi chỗ trên menu).
// Chạy: index.html?auto=1&role=chu|ql|qlt|kt|nv&script=menu_dt (và test/phone.html). Kết quả: out[].menu_dt = { ok, fail }.
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = async (sel, n = 200) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const go = async (h) => { location.hash = '#/__tam'; await sleep(300); location.hash = h; await sleep(600); await wait('#root .page-head, #root h1', 100); await sleep(700); };
  const tabs = () => $$('.hub-tabs a').map((a) => a.textContent.replace(/\s*\d+\s*$/, '').trim());
  const hub = () => $('.hub-tabs')?.getAttribute('aria-label') || '';
  const wide = () => { const w = document.documentElement.clientWidth; return document.documentElement.scrollWidth > w + 1; };
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1200);
  try {
    if (role === 'nv') {
      await go('#/cong-viec/dao-tao');
      ok(!$('.hub-tabs'), 'nhân viên: không có thanh mục con');
      ok(/đào tạo/i.test($('#root h1')?.textContent || ''), `nhân viên: vẫn mở được trang Đào tạo (${$('#root h1')?.textContent})`);
    } else {
      for (const [h, name] of [['#/cong-viec/dao-tao', 'Đào tạo'], ['#/dao-tao/phan-cong', 'Phân công đào tạo']]) {
        await go(h);
        ok(hub() === 'Nhân viên & tài khoản', `${name}: thanh mục con thuộc nhóm Nhân viên & tài khoản (${hub() || 'không có thanh'})`);
        ok($('.hub-tabs a.on')?.textContent.replace(/\s*\d+\s*$/, '').trim() === name, `${name}: mục đang chọn đúng (${$('.hub-tabs a.on')?.textContent})`);
        ok(tabs().includes('Đào tạo') && tabs().includes('Phân công đào tạo'), `${name}: thanh có đủ 2 mục đào tạo (${tabs().join(' | ')})`);
        const act = $$('.sidebar .item.active').map((a) => a.textContent.replace(/\s*\d+\s*$/, '').trim());
        if ($('.sidebar')) ok(act.length === 1 && act[0] === 'Nhân viên & tài khoản', `${name}: menu trái sáng đúng nhóm (${act.join(' | ')})`);
        ok(!wide(), `${name}: không tràn ngang`);
      }
      await go('#/viec');
      ok(!tabs().some((t) => /đào tạo/i.test(t)), `Công việc: không còn mục đào tạo (${hub()}: ${tabs().join(' | ') || 'không có thanh'})`);
      if (role === 'chu') {
        await go('#/quan-ly/nhan-vien');
        ok(tabs().join(' | ') === 'Nhân viên | Đào tạo | Phân công đào tạo | Đánh giá | Phân quyền', `Chủ: thứ tự mục (${tabs().join(' | ')})`);
        ok(!wide(), 'Nhân viên: không tràn ngang');
      }
    }
  } catch (e) { bad.push('flow: ' + (e.stack || e)); }
  out.push({ menu_dt: { ok: good, fail: bad } });
};
