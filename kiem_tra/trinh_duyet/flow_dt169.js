// Bước 169: Đào tạo — quy tắc phân công theo vai. Chạy (chuan_bi.sh … --dao-tao-gia, thời gian thật):
//   role=chu · role=ql (HD chính, NV05) · role=c1 (Cấp 1, NV07) · role=ql2 (Quản lý khác, NV08) · role=kt&dtptc=7 (người phụ trách chính = tài khoản Kế toán)
// index.html và test/phone.html.
import { rpc } from '../js/sb.js';
export default async ({ visit, sleep, out }) => {
  const good = [], bad = []; const ok = (c, m) => (c ? good : bad).push(m);
  const $ = (s, r = document) => r.querySelector(s); const all = (s, r = document) => [...r.querySelectorAll(s)];
  const role = new URLSearchParams(location.search).get('role') || 'chu';
  const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  const fails = async (fn) => { try { await fn(); return false; } catch (_) { return true; } };
  const row = (no) => $(`.dt-item[data-no="${no}"]`);
  const ach = () => Number($('#dt-ach')?.textContent);
  try {
    let root = await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
    ok(!root.textContent.includes('Quản lý phụ trách'), '6. trên phiếu không còn ô "Quản lý phụ trách"');
    ok(!!$('#dt-item-filter option[value="check"]'), 'bộ lọc có "Chờ kiểm tra"');
    const assignBtns = all('[data-dt-guide-person]').length;
    if (role === 'chu') {
      ok(assignBtns > 0, '3. Chủ giao được hạng mục (có nút Đổi phân công)');
      ok(!!$('#dt-hdc'), '2. Chủ có ô chọn Người hướng dẫn chính (anh chốt 20/11)');
      ok(!(await fails(() => rpc('app_dt_followup_save', { p_id: 1, p_no: 5, p_employee: 7, p_note: null, p_extra: false, p_branch: null }))), '3. Chủ gọi giao hạng mục được');
      const { openCreateDialog } = await import('../js/pages/dao_tao.js');
      openCreateDialog({ id: 7, name: 'Thử', branch: 'TEST' }); await sleep(600);
      const dl = $('dialog[open]'); ok(!!dl && dl.innerText.includes('Người hướng dẫn chính') && !dl.innerText.includes('Quản lý phụ trách'), '6. hộp Tạo phiếu không còn ô "Quản lý phụ trách"');
      if (dl) { const c = dl.querySelector('#dt-cancel'); if (c) c.click(); await sleep(200); }
    }
    if (role === 'ql') {   // HD chính của phiếu
      ok(assignBtns > 0, '3. HD chính giao được hạng mục (có nút Đổi phân công)');
      ok(!$('#dt-hdc') && await fails(() => rpc('app_dt_instructor_save', { p_id: 1, p_employee: 8 })) && await fails(() => rpc('app_dt_update', { p_id: 1, p: { instructor_id: 8 } })), '2. Quản lý có quyền Đào tạo (không phải người phụ trách chính / Chủ) không đổi được HD chính (anh chốt 20/11)');
      await rpc('app__test_dt_pending', { p_no: 3, p_level: 'kha' });
      root = await visit('#/dao-tao/phieu?id=1&t=' + Date.now()); const a0 = ach();
      ok(!!row(3)?.querySelector('.dt-chkbox') && row(3).textContent.includes('Chờ kiểm tra') && !row(3).classList.contains('done'), '4. hạng mục Cấp 1 ghi → "Chờ kiểm tra", chưa tính đạt');
      const sel = row(3)?.querySelector('.it-chk-lv'); const btn = row(3)?.querySelector('.it-check');
      ok(!!sel && !!btn, '5. HD chính thấy ô mức + nút "Xác nhận đạt"');
      if (sel && btn) {
        sel.value = 'tot'; btn.click(); await sleep(1200); root = document.getElementById('root');
        ok(!row(3).querySelector('.dt-chkbox') && row(3).classList.contains('done') && row(3).querySelector('.it-level').value === 'tot' && ach() === a0 + 1, '5. Xác nhận đạt (sửa mức Tốt) → tính đạt, +1 hạng mục');
      }
      const r = await rpc('app_dt_mark', { p_id: 1, p_no: 4, p: { introduced: true, practiced: true, level: 'tb' } });
      ok(!r.pending, '5. HD chính tự ghi → không phải chờ kiểm tra');
      const f = $('#dt-item-filter'); f.value = 'check'; f.dispatchEvent(new Event('change')); await sleep(200);
      ok(/Không có hạng mục phù hợp/.test($('#dt-item-filter-count').textContent), 'lọc "Chờ kiểm tra" sau khi xác nhận hết: không còn mục');
    }
    if (role === 'c1') {   // nhân viên Cấp 1 được giao hạng mục 3
      ok(assignBtns === 0, '3. Cấp 1 không có nút giao hạng mục');
      await rpc('app__test_dt_assign', { p_no: 3, p_employee: 7 });
      root = await visit('#/dao-tao/phieu?id=1&t=' + Date.now()); const a0 = ach();
      const rw = row(3);   // chặng 4: hạng mục chưa có mức nằm ở tab Ngày tiếp theo (mở sẵn) — không còn khối ngày giáo trình để mở
      const intro = rw.querySelector('.it-intro'); ok(!intro.disabled, '4. Cấp 1 tích được Giới thiệu ở hạng mục được giao');
      intro.checked = true; intro.dispatchEvent(new Event('change')); await sleep(800);
      const prac = row(3).querySelector('.it-prac'); prac.checked = true; prac.dispatchEvent(new Event('change')); await sleep(400);
      const pick = $('dialog[open] #dt-practice-level'); ok(!!pick, '4. tích Thực hành → hỏi mức đạt');
      if (pick) { pick.querySelector('button[value="kha"]').click(); await sleep(1500); }
      const r3 = row(3); root = document.getElementById('root');
      ok(!!r3?.querySelector('.dt-chkbox') && r3.textContent.includes('Chờ kiểm tra') && !r3.querySelector('.it-check') && ach() === a0, '4. Cấp 1 chọn mức → "Chờ kiểm tra", chưa tính đạt, không có nút Xác nhận');
      ok(await fails(() => rpc('app_dt_check_ok', { p_id: 1, p_no: 3, p_level: null })), '5. Cấp 1 tự xác nhận đạt bị chặn');
      ok(await fails(() => rpc('app_dt_followup_save', { p_id: 1, p_no: 6, p_employee: 7, p_note: null, p_extra: false, p_branch: null })), '3. Cấp 1 gọi giao hạng mục bị chặn');
    }
    if (role === 'ql2') {   // Quản lý khác: hết quyền giao, không xác nhận
      await rpc('app__test_dt_pending', { p_no: 3, p_level: 'kha' });
      root = await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
      ok(all('[data-dt-guide-person]').length === 0, '3. Quản lý khác không có nút giao hạng mục');
      ok(!!row(3)?.querySelector('.dt-chkbox') && !row(3).querySelector('.it-check'), '5. Quản lý khác thấy "Chờ kiểm tra" nhưng không có nút Xác nhận đạt');
      ok(await fails(() => rpc('app_dt_followup_save', { p_id: 1, p_no: 6, p_employee: 7, p_note: null, p_extra: false, p_branch: null })), '3. Quản lý khác gọi giao hạng mục bị chặn');
      ok(await fails(() => rpc('app_dt_check_ok', { p_id: 1, p_no: 3, p_level: null })), '5. Quản lý khác gọi xác nhận đạt bị chặn');
    }
    if (role === 'kt') {   // người phụ trách chính (dtptc=7)
      ok(root.textContent.includes('Người phụ trách chính') && root.textContent.includes('Kế toán thử'), '1. phiếu ghi người phụ trách chính = tài khoản Chủ chọn');
      ok(assignBtns > 0, '3. người phụ trách chính giao được hạng mục');
      const s = $('#dt-hdc'); ok(!!s, '2. người phụ trách chính có ô chọn Người hướng dẫn chính');
      if (s) {
        s.value = '8'; s.dispatchEvent(new Event('change')); await sleep(1200); root = document.getElementById('root');
        const s2 = $('#dt-hdc'); ok(!!s2 && s2.value === '8', '2. đổi Người hướng dẫn chính sang Quản lý khác → lưu được');
      }
      await rpc('app__test_dt_pending', { p_no: 3, p_level: 'tb' });
      root = await visit('#/dao-tao/phieu?id=1&t=' + Date.now());
      ok(!!row(3)?.querySelector('.it-check'), '5. người phụ trách chính có nút Xác nhận đạt');
    }
    ok(fits(), 'không tràn ngang');
  } catch (e) { bad.push('LỖI CHẠY: ' + (e.stack || e.message)); }
  out.push({ dt169: { ok: good, fail: bad } });
};
