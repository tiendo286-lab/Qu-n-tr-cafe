// Bước 141: trang Theo dõi đọc & cam kết. role=kt | nvkt | chu (được xem, sửa cam kết) ; role=nv (không có quyền).
export default async ({ visit, sleep, out }) => {
  const q = new URLSearchParams(location.search);
  const role = q.get('role') || 'kt';
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const waitFor = async (c, m) => { for (let i = 0; i < 40; i++) { if (c()) return; await sleep(100); } throw new Error(m); };
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  try {
    let root = await visit('#/theo-doi-noi-quy');
    if (role === 'nv') {
      assert(root.textContent.includes('Bạn không có quyền vào trang này'), 'Nhân viên vào được trang theo dõi.');
      out.push('ĐẠT nhân viên không vào được trang theo dõi');
      return;
    }
    assert(root.querySelector('#nqf') && root.querySelectorAll('.nqf-r').length > 0, 'Trang theo dõi chưa có danh sách nhân viên.');
    assert(fits(), 'Trang theo dõi tràn ngang.');
    root = await visit('#/theo-doi-noi-quy?loc=chua_ky');
    const before = root.querySelectorAll('.nqf-r').length;
    const card = root.querySelector('.nqf-r');
    const id = card.dataset.id;
    const sel = card.querySelector('.nqf-ck');
    sel.value = 'da_ky_nop';
    sel.dispatchEvent(new Event('change'));
    await waitFor(() => { const r = document.getElementById('root'); return r.querySelectorAll('.nqf-r').length === before - 1 && !r.querySelector(`.nqf-r[data-id="${id}"]`); },
      'Chọn Đã ký và nộp chưa lưu / chưa rời mục Chưa ký.');
    root = await visit('#/theo-doi-noi-quy?loc=chua_doc');
    assert(root.querySelector('.nqf-u')?.textContent.startsWith('Chưa đọc:'), 'Thiếu danh sách bài chưa đọc.');
    const search = root.querySelector('#nqf-q');
    search.value = 'khong-co-ai-ten-nay'; search.dispatchEvent(new Event('input'));
    assert([...root.querySelectorAll('.nqf-r')].every((c) => c.hidden), 'Ô tìm chưa lọc được.');
    assert(fits(), 'Trang theo dõi tràn ngang (lọc).');
    out.push(`ĐẠT trang theo dõi đọc & cam kết (${role})`);
  } catch (e) { out.push('KIỂM TRA THẤT BẠI: ' + e.message); }
};
