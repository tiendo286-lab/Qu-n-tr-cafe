// Bước 139: người hướng dẫn chính chỉ là nhân viên cấp Quản lý, bắt buộc khi tạo phiếu.
// Chạy với chuan_bi.sh --dao-tao-gia: index.html?auto=1&role=chu&script=flow_hd139 (và test/phone.html).
import { openCreateDialog } from '../js/pages/dao_tao.js';

export default async ({ visit, sleep, out }) => {
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const waitFor = async (c, m) => { for (let i = 0; i < 40; i++) { if (c()) return; await sleep(100); } throw new Error(m); };
  try {
    await visit('#/quan-ly/nhan-vien');
    await openCreateDialog({ id: 7, name: 'NV07 – Nhân viên cấp 1 thử', branch: 'TEST' });
    const d = document.querySelector('dialog[open]');
    const opts = [...d.querySelectorAll('#dt-emps option')].map((o) => o.value);
    assert(opts.length === 1 && opts[0] === 'NV05 – Người hướng dẫn thử', 'Gợi ý người hướng dẫn chính phải chỉ có Quản lý: ' + opts.join(', '));
    assert(d.querySelector('[name=hd]').required, 'Ô người hướng dẫn chính phải bắt buộc.');
    assert(/Quản lý/.test(d.querySelector('[name=hd]').closest('label').textContent), 'Nhãn chưa ghi rõ chỉ chọn Quản lý.');
    d.querySelector('[name=hd]').value = 'NV07 – Nhân viên cấp 1 thử';
    d.querySelector('#dt-new').requestSubmit();
    await waitFor(() => /Quản lý/.test(d.querySelector('#dt-err').textContent), 'Chọn nhân viên Cấp 1 phải bị chặn.');
    d.close();
    const root = await visit('#/dao-tao/phieu?id=1');
    const f = root.querySelector('[data-f=instructor_id]');
    const list = document.getElementById(f.getAttribute('list'));
    assert(list && [...list.options].every((o) => o.value.startsWith('NV05')), 'Ô người hướng dẫn chính trên phiếu gợi ý cả nhân viên không phải Quản lý.');
    const cont = root.querySelector('[data-f=cont_trainer_id]');
    if (cont) assert(document.getElementById(cont.getAttribute('list')).options.length > 1, 'Người đào tạo tiếp vẫn chọn được mọi nhân viên.');
    out.push('ĐẠT người hướng dẫn chính chỉ là Quản lý, bắt buộc khi tạo phiếu');
  } catch (e) { out.push('KIỂM TRA THẤT BẠI: ' + e.message); }
};
