// Hàm thuần của trang Đào tạo gộp (28/11/2026). Chạy từ thư mục kho mã: jsc -m kiem_tra/dao_tao_loc_tinh.mjs
import { chipCounts, matchRow, norm, optionsOf, sortRows } from '../docs/js/pages/dao_tao_loc.js';

const bad = []; let n = 0;
const ok = (c, m) => { n += 1; if (!c) bad.push(m); };
const ids = (xs) => xs.map((r) => r.id).join(',');
const R = [
  { id: 1, employee: 'NV03 – Người học thử', branch: 'LHP', program: 'chay_ban', instructor: 'NV05 – Quản lý thử', status: 'dang_dao_tao', due: '2026-12-05', n_check: 0 },
  { id: 2, employee: 'NV04 – Trần Đức', branch: 'ĐK', program: 'pha_che', instructor: 'NV08 – Quản lý khác', status: 'chua_dao_tao', due: '2026-12-01', n_check: 0 },
  { id: 3, employee: 'NV09 – Lê Hoàn', branch: 'LHP', program: 'chay_ban', instructor: 'NV05 – Quản lý thử', status: 'hoan_thanh', due: '2026-11-10', n_check: 0 },
  { id: 4, employee: 'NV10 – Đỗ Kiểm', branch: 'LHP', program: 'pha_che', instructor: null, status: 'dang_dao_tao', due: '2026-12-09', n_check: 2 },
  { id: 5, employee: 'NV11 – Phạm Ca', branch: null, program: 'chay_ban', instructor: 'NV08 – Quản lý khác', status: 'dao_tao_tiep', due: '2026-12-03', n_check: 0, n_todo: 1 },
];
const pick = (F, skip) => ids(R.filter((r) => matchRow(r, F, skip)));

ok(norm('  Đỗ Kiểm ') === 'do kiem', 'norm bỏ dấu, chữ thường, bỏ khoảng trắng đầu cuối');
ok(pick({}) === '1,2,4,5', 'mặc định ẩn người đã hoàn thành — ' + pick({}));
ok(pick(undefined) === '1,2,4,5', 'không truyền bộ lọc vẫn chạy');
ok(pick({ st: 'hoan_thanh' }) === '3', 'chọn Đã hoàn thành thì chỉ ra người hoàn thành');
ok(pick({ st: 'dang_dao_tao' }) === '1,4', 'lọc trạng thái Đang đào tạo');
ok(pick({ q: 'nguoi hoc' }) === '1', 'tìm không dấu theo tên');
ok(pick({ q: 'NV1' }) === '4,5', 'tìm theo mã');
ok(pick({ q: 'khong co ai' }) === '', 'không khớp ai thì rỗng');
ok(pick({ cs: 'LHP', prog: 'chay_ban' }) === '1', 'cơ sở + chương trình (người hoàn thành vẫn ẩn)');
ok(pick({ cs: 'LHP' }, true) === '1,3,4', 'skipSt bỏ qua luật trạng thái');
ok(pick({ hd: 'NV08 – Quản lý khác' }) === '2,5', 'lọc người hướng dẫn chính');
const c0 = chipCounts(R, {}); const c1 = chipCounts(R, { st: 'hoan_thanh' });
ok(c0.dang_dao_tao === 2 && c0.hoan_thanh === 1 && c0.chua_dao_tao === 1 && c0.dao_tao_tiep === 1, 'đếm đủ mọi trạng thái, kể cả hoàn thành');
ok(JSON.stringify(c0) === JSON.stringify(c1), 'bấm nút trạng thái không làm số trên nút đổi');
ok(chipCounts(R, { cs: 'ĐK' }).chua_dao_tao === 1 && !chipCounts(R, { cs: 'ĐK' }).dang_dao_tao, 'số trên nút theo các ô lọc khác');
ok(JSON.stringify(chipCounts([], {})) === '{}' && JSON.stringify(chipCounts(null, {})) === '{}', 'danh sách rỗng / null không lỗi');
const before = ids(R);
ok(ids(sortRows(R)) === '5,4,2,1,3', 'việc cần làm lên đầu (theo hạn), hoàn thành xuống cuối — ' + ids(sortRows(R)));
ok(ids(R) === before, 'sortRows không sửa mảng gốc');
ok(sortRows(null).length === 0, 'sortRows(null) trả mảng rỗng');
ok(optionsOf(R, 'branch').join('|') === 'ĐK|LHP', 'optionsOf bỏ null, không trùng — ' + optionsOf(R, 'branch').join('|'));
ok(optionsOf(R, 'instructor').length === 2, 'optionsOf người hướng dẫn: 2 người');

print(bad.length ? bad.map((m) => 'HỎNG: ' + m).join('\n') : `ĐẠT ${n}/${n}`);
