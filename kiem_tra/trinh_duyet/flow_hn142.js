// Việc hôm nay chia nhóm (bước 142): role=ql | nv | kt | chu, thêm hnfail=more. Chạy ở index.html và test/phone.html.
// Cần dữ liệu thử đào tạo: chuan_bi.sh <thư mục> --dao-tao-gia. Giả lập app_today_more ở hn_gia.js.
export default async ({ visit, settle, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const role = q.get('role') || 'nv';
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  let root;
  const sec = (c) => root.querySelector(`#hn-viec section.hn-grp[data-cat="${c}"]`);
  const cats = () => [...root.querySelectorAll('#hn-viec section.hn-grp')].map((s) => s.dataset.cat).join();
  const click = async (el) => { el.click(); await sleep(150); root = document.getElementById('root'); };
  try {
    root = await visit('#/hom-nay');
    if (q.get('hnfail') === 'more') {
      assert(cats() === 'vh,ns,kh,done', 'Thiếu khối khi app_today_more lỗi: ' + cats());
      assert(/Chưa tải được/.test(sec('done').textContent), 'Đã xong hôm nay phải báo Chưa tải được khi nguồn lỗi.');
      assert(root.querySelectorAll('#hn-viec .hn-row').length > 0, 'Một nguồn lỗi làm mất các việc khác.');
      out.push('ĐẠT Việc hôm nay chia nhóm (' + role + ' lỗi=more)');
      return;
    }
    if (role === 'chu') {
      const tabs = root.querySelector('#hn-tabs');
      assert(tabs && tabs.querySelector('[data-view="all"]').getAttribute('aria-pressed') === 'true', 'Chủ phải mở tab Mọi người trước.');
      const roles = [...root.querySelectorAll('#hn-roles button')].map((b) => b.textContent.replace(/\d+/g, '').trim());
      assert(roles.join('|') === 'Tất cả|Quản lý tổng|Quản lý|Kế toán|Việc khác', 'Nút lọc vai trò sai: ' + roles.join('|'));
      assert(cats() === 'vh,ns,kh,done', 'Tab Mọi người thiếu khối: ' + cats());
      await click(root.querySelector('#hn-roles [data-role="Kế toán"]'));
      const whos = [...root.querySelectorAll('#hn-viec section.hn-grp:not([data-cat="done"]) .hn-who')].map((x) => x.textContent);
      assert(whos.length > 0 && whos.every((t) => !/Bạn/.test(t)), 'Lọc Kế toán còn việc của Chủ / trống: ' + whos.join(' | '));
      await click(root.querySelector('#hn-tabs [data-view="mine"]'));
      assert(!root.querySelector('#hn-roles') && root.querySelector('#hn-tabs [data-view="mine"]').getAttribute('aria-pressed') === 'true', 'Chưa chuyển sang Việc của tôi.');
    }
    assert(cats() === 'vh,ns,kh,done', 'Khối phải theo thứ tự Vận hành, Nhân sự, Khác, Đã xong: ' + cats());
    assert(sec('done').querySelector('.hn-gh').getAttribute('aria-expanded') === 'false', 'Đã xong hôm nay phải thu gọn sẵn.');
    assert(/Đã xong hôm nay/.test(sec('done').textContent) && /\(3\)/.test(sec('done').querySelector('.hn-gh').textContent), 'Đã xong hôm nay thiếu số việc.');
    const dw = [...sec('done').querySelectorAll('.hn-who')];
    assert(dw.filter((x) => x.textContent === 'Người làm: Bạn' && !x.classList.contains('other')).length === 2 && dw.some((x) => /Quản lý HS/.test(x.textContent) && x.classList.contains('other')),
      'Đã xong hôm nay: việc của mình phải ghi Bạn (xanh), việc người khác ghi tên (tím): ' + dw.map((x) => x.textContent).join(' | '));
    // thu gọn Vận hành, vẽ lại vẫn thu
    const gh = () => sec('vh').querySelector('.hn-gh');
    assert(gh().getAttribute('aria-expanded') === 'true', 'Vận hành có việc phải mở sẵn.');
    await click(gh());
    assert(gh().getAttribute('aria-expanded') === 'false', 'Bấm đầu nhóm chưa thu gọn.');
    await visit('#/thong-bao'); root = await visit('#/hom-nay');
    assert(gh().getAttribute('aria-expanded') === 'false', 'Vẽ lại trang không nhớ nhóm đã thu.');
    assert(/\d+ hôm nay|\d+ quá hạn|\d+ gấp|\d+ cần kiểm tra/.test(gh().textContent), 'Nhóm thu gọn vẫn phải hiện số việc gấp / quá hạn / hôm nay.');
    await click(gh());
    // mỗi dòng việc có người làm
    const rows = [...root.querySelectorAll('#hn-viec .hn-row')];
    assert(rows.length && rows.every((r) => r.querySelector('.hn-who')), 'Có dòng việc thiếu nhãn người làm.');
    // việc chờ mình kiểm tra đứng đầu khối
    const rv = rows.find((r) => /Cần bạn kiểm tra/.test(r.textContent));
    if (role !== 'chu' || root.querySelector('#hn-tabs [data-view="mine"]')?.getAttribute('aria-pressed') === 'true') {
      assert(rv, 'Thiếu việc "Cần bạn kiểm tra".');
      const body = rv.closest('.hn-gbody');
      assert(body.firstElementChild === rv || body.firstElementChild.contains(rv), 'Việc cần kiểm tra phải đứng đầu khối.');
      const wait = root.querySelector('#hn-viec .hn-row[data-key="gv:901"]');
      assert(wait && /Chờ .* kiểm tra/.test(wait.textContent) && wait.closest('[data-cat="kh"]'), 'Việc mình đã báo xong phải ở lại nhóm Khác, ghi Chờ … kiểm tra.');
    }
    if (role === 'ql') {
      const b = root.querySelector('#hn-viec .hn-bundle[data-kind="dtf"]');
      assert(b && b.closest('[data-cat="ns"]'), 'Quản lý thiếu dòng gộp Đào tạo đã giao người hướng dẫn ở Nhân sự.');
      assert(b.querySelector('.hn-bh').getAttribute('aria-expanded') === 'false', 'Dòng gộp phải thu sẵn.');
      await click(b.querySelector('.hn-bh'));
      const b2 = root.querySelector('#hn-viec .hn-bundle[data-kind="dtf"]');
      assert(b2.querySelector('.hn-bh').getAttribute('aria-expanded') === 'true' && b2.querySelectorAll('.hn-bkids .hn-row').length === 2, 'Mở dòng gộp chưa thấy 2 hạng mục.');
    }
    // bộ nhớ trình duyệt bị chặn (khoá nhớ nhóm của trang này): vẫn vẽ đủ, mặc định đúng
    const gi = Storage.prototype.getItem, si = Storage.prototype.setItem;
    const block = (f) => function (k, ...r) { if (String(k).startsWith('hn-open')) throw new Error('chặn'); return f.call(this, k, ...r); };
    Storage.prototype.getItem = block(gi); Storage.prototype.setItem = block(si);
    try {
      root.querySelector('#hn-viec').dataset.cu = '1';
      await visit('#/thong-bao'); root = await visit('#/hom-nay');
      assert(!root.querySelector('#hn-viec').dataset.cu, 'Trang chưa vẽ lại khi bộ nhớ bị chặn.');
      assert(cats() === 'vh,ns,kh,done' && sec('vh').querySelector('.hn-gh').getAttribute('aria-expanded') === 'true'
        && sec('done').querySelector('.hn-gh').getAttribute('aria-expanded') === 'false', 'Bộ nhớ bị chặn làm hỏng trang / sai mặc định.');
      await click(sec('vh').querySelector('.hn-gh'));
      assert(sec('vh').querySelector('.hn-gh').getAttribute('aria-expanded') === 'false', 'Bộ nhớ bị chặn thì vẫn phải thu gọn được.');
    }
    finally { Storage.prototype.getItem = gi; Storage.prototype.setItem = si; }
    assert(fits(), 'Việc hôm nay tràn ngang.');
    // hộp Giao việc riêng có ghi chú nhóm Khác
    if (role !== 'nv') {
      const v = await visit('#/viec');
      const btn = v.querySelector('[data-a="gv-new"]');
      if (btn) { btn.click(); await sleep(200); const d = document.querySelector('dialog[open]');
        assert(d && /nhóm\s*Khác/.test(d.textContent), 'Hộp Giao việc riêng thiếu ghi chú nhóm Khác.'); d.close(); }
    }
    out.push('ĐẠT Việc hôm nay chia nhóm (' + role + ')');
  } catch (e) { out.push('KIỂM TRA THẤT BẠI: ' + e.message); }
};
