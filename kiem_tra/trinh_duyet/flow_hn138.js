// Việc hôm nay đợt 1 (bước 138): role=chu | nv | ql | kt | nvkt, chạy ở index.html và test/phone.html.
// Tham số thêm: hnorder=1|sent, hnca=0|1|2, hnfail=dt (xem hn_gia.js).
export default async ({ visit, settle, out }) => {
  const q = new URLSearchParams(location.search);
  const role = q.get('role') || 'nv';
  const staff = ['nv', 'nvkt', 'ql'].includes(role);   // có hồ sơ nhân viên trong dữ liệu thử
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  try {
    location.hash = '#/';
    await settle();
    assert(location.hash === '#/hom-nay', 'Mở web chưa vào Việc hôm nay (đang ở ' + location.hash + ').');
    const root = await visit('#/hom-nay');
    const has = (s) => !!root.querySelector(s);
    assert(has('#hn-viec'), 'Thiếu khối Việc của tôi.');
    // anh Tiến chốt 27/11/2026: tài khoản không gắn nhân viên thì ẨN thẻ Ca của tôi hôm nay (trước đây hiện câu "không gắn nhân viên")
    assert(staff ? has('#hn-ca') : !has('#hn-ca'), staff ? 'Thiếu khối Ca của tôi hôm nay.' : 'Tài khoản không gắn nhân viên phải ẩn thẻ Ca của tôi hôm nay.');
    const ca = root.querySelector('#hn-ca')?.textContent || '';
    if (!staff) { /* không có thẻ */ }
    else if (q.get('hnca') === '0') assert(ca.includes('Hôm nay bạn không có ca'), 'Thiếu câu không có ca.');
    else if (q.get('hnca') === '2') assert(ca.indexOf('Sáng') < ca.indexOf('Tối') && ca.includes('Chưa mở phiếu'), 'Hai ca chưa xếp theo giờ / thiếu trạng thái phiếu.');
    else assert(ca.includes('Sáng') && ca.includes('06:45'), 'Thiếu ca hôm nay.');
    if (staff && q.get('hnorder') === '1') assert(root.querySelector('#hn-order')?.getAttribute('href') === '#/order', 'Thiếu nút Order ca đầu trang.');
    else assert(!has('#hn-order'), 'Không được hiện nút Order khi không có đợt mở hoặc đã gửi.');
    const viec = root.querySelector('#hn-viec');
    assert(viec.querySelector('a[href="#/viec"]'), 'Thiếu Xem tất cả công việc.');
    assert(viec.querySelector('.hn-row') || viec.textContent.includes('Hôm nay bạn không có việc cần xử lý'), 'Việc của tôi không có dòng nào và không báo trống.');
    assert(!viec.textContent.includes('Chưa tải được công việc'), 'Một nguồn lỗi làm hỏng cả khối việc.');
    const manager = ['chu', 'ql', 'kt', 'qlt'].includes(role) || role === 'nvkt';
    if (manager) assert(has('#hn-theo-doi'), 'Thiếu khối Theo dõi cho người quản lý / kế toán.');
    else assert(!has('#hn-theo-doi'), 'Nhân viên không có khối Theo dõi.');
    if (staff) {
      assert(has('#hn-luong') && root.querySelector('#hn-luong-more')?.getAttribute('href') === '#/cua-toi/cong', 'Thiếu Bảng lương của tôi / Xem chi tiết.');
      assert(!/tổng lương|tiền mặt đã trả/i.test(root.querySelector('#hn-luong').textContent), 'Bảng lương không được hiện tổng lương / tiền mặt.');
    } else assert(!has('#hn-luong'), 'Tài khoản không gắn nhân viên không có bảng lương.');
    // bước 141: Nội quy / Cam kết, không còn cửa sổ nhắc lúc đăng nhập
    assert(!document.querySelector('dialog[open]'), 'Còn cửa sổ nhắc việc lúc mở web.');
    const row = (k) => root.querySelector(`.hn-row[data-key="${k}"]`);
    if (staff) {
      assert(row('nq')?.getAttribute('href')?.startsWith('#/noi-quy?id=') && /Đã đọc 0\/\d+ bài/.test(row('nq').textContent), 'Thiếu việc Đọc nội quy (gộp 1 dòng).');
      assert(row('ck') && /Chưa ký/.test(row('ck').textContent), 'Thiếu việc Ký cam kết.');
    } else assert(!row('nq') && !row('ck'), 'Tài khoản không gắn nhân viên không có việc đọc nội quy / cam kết.');
    const owner = role === 'kt' || role === 'nvkt';
    const follow = [...root.querySelectorAll('.hn-row[data-key^="nqf:"]')];
    if (owner) {
      assert(follow.length > 0 && follow[0].getAttribute('href') === '#/theo-doi-noi-quy?loc=chua_doc', 'Kế toán thiếu việc nhắc đọc nội quy.');
      assert(row('ckf')?.getAttribute('href') === '#/theo-doi-noi-quy?loc=chua_ky', 'Kế toán thiếu việc theo dõi cam kết.');
    } else assert(!follow.length && !row('ckf'), 'Chỉ Kế toán phụ trách mới có việc theo dõi nội quy / cam kết.');
    assert(fits(), 'Việc hôm nay tràn ngang.');
    if (staff) {
      const cong = await visit('#/cua-toi/cong');
      assert(cong.querySelector('#cg-ka'), 'Công của tôi thiếu mục Khoản âm.');
      assert(fits(), 'Công của tôi tràn ngang.');
    }
    out.push(`ĐẠT Việc hôm nay (${role}${q.get('hnorder') ? ' order=' + q.get('hnorder') : ''}${q.get('hnca') ? ' ca=' + q.get('hnca') : ''}${q.get('hnfail') ? ' lỗi=' + q.get('hnfail') : ''})`);
  } catch (e) { out.push('KIỂM TRA THẤT BẠI: ' + e.message); }
};
