import { rpc } from '../js/sb.js';

// Danh sách đào tạo và thao tác theo phiếu trên hai khung.
export default async ({ visit, sleep, out }) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const waitFor = async (condition, message) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (condition()) return;
      await sleep(100);
    }
    throw new Error(message);
  };
  const fits = () => document.documentElement.scrollWidth <= innerWidth + 1;
  try {
    let root = await visit('#/cong-viec/dao-tao');
    assert(root.querySelector('#dt-work'), 'Thiếu danh sách công việc đào tạo.');
    assert(root.querySelector('a[href="#/cong-viec/dao-tao?muc=chay_ban"]'), 'Thiếu mục Chạy bàn.');
    assert(root.querySelector('a[href="#/cong-viec/dao-tao?muc=pha_che"]'), 'Thiếu mục Pha chế.');
    root = await visit('#/cong-viec/dao-tao?muc=pha_che');
    assert(root.textContent.includes('Chưa có phiếu đào tạo Pha chế'), 'Thiếu thông báo chờ phiếu Pha chế.');
    assert(!root.querySelector('a[href="#/dao-tao/phieu?id=1"]') && fits(), 'Phiếu Chạy bàn lọt vào mục Pha chế hoặc trang tràn ngang.');
    root = await visit('#/cong-viec/dao-tao?muc=chay_ban');
    assert(root.querySelector('a[href="#/dao-tao/phieu?id=1"]'), 'Thiếu phiếu trong mục Chạy bàn.');
    const form = root.querySelector('#dt-reviewer');
    form.querySelector('select').value = '1';
    form.requestSubmit();
    await waitFor(() => root.innerText.includes('Người phụ trách chính: Người nhận xét thử'), 'Chưa lưu người nhận xét.');
    assert(fits(), 'Danh sách tràn ngang.');
    root = await visit('#/viec');
    // bước 169: bỏ "Quản lý phụ trách" — Chủ vừa chọn mình làm người phụ trách chính nên phiếu hiện với vai "Kiểm tra và nhận xét"
    assert(root.querySelector('#pc-body [data-training-work="1"]')?.textContent.includes('Kiểm tra và nhận xét'), 'Thiếu việc đào tạo trong Việc của tôi.');
    assert(root.querySelector('[data-training-work="1"] a')?.getAttribute('href') === '#/dao-tao/phieu?id=1', 'Việc đào tạo mở sai phiếu.');
    assert(fits(), 'Việc của tôi bị tràn ngang.');
    root = await visit('#/dao-tao/phieu?id=1');
    assert(!root.querySelector('#dt-finish'), 'Hiện nút hoàn thành trước ngày 8.');
    const work = await rpc('app_dt_work_list');
    const daysAgo = (days) => new Date(Date.parse(work.today) - days * 864e5).toISOString().slice(0, 10);
    await rpc('app_dt_update', { p_id: 1, p: { start_date: daysAgo(8) } });
    await visit('#/cong-viec/dao-tao');
    root = await visit('#/dao-tao/phieu?id=1');
    assert(root.querySelector('#dt-finish')?.disabled, 'Từ ngày 8 phải có nút hoàn thành, khóa khi chưa đủ mục.');
    const chooseFilter = (value) => {
      const select = root.querySelector('#dt-item-filter');
      assert(select, 'Thiếu bộ lọc đầu danh sách.');
      select.value = value;
      select.dispatchEvent(new Event('change'));
    };
    const visible = (no) => !root.querySelector(`.dt-item[data-no="${no}"]`).hidden;
    chooseFilter('introduced');
    assert(!visible(1) && visible(2) && !visible(3), 'Lọc đã giới thiệu chưa đúng.');
    chooseFilter('new');
    assert(!visible(1) && !visible(2) && visible(3), 'Lọc chưa giới thiệu chưa đúng.');
    // bước 140: lọc theo 3 mức thực hành
    const levelLabels = ['lv_tb', 'lv_kha', 'lv_tot'].map((v) => root.querySelector(`#dt-item-filter option[value="${v}"]`)?.textContent);
    assert(levelLabels.join('|') === 'Thực hành · Trung bình|Thực hành · Khá|Thực hành · Tốt', 'Thiếu bộ lọc 3 mức thực hành: ' + levelLabels.join('|'));
    chooseFilter('lv_tot');
    assert(visible(1) && !visible(2) && !visible(3), 'Lọc mức Tốt chưa đúng.');
    chooseFilter('lv_kha');
    assert(!visible(1) && !visible(2) && root.querySelector('#dt-item-filter-count').textContent === 'Không có hạng mục phù hợp', 'Lọc mức Khá chưa đúng.');
    chooseFilter('done');
    assert(visible(1) && !visible(2) && !visible(3), 'Lọc hoàn thành chưa đúng.');
    const initialItem = root.querySelector('.dt-item[data-no="1"]');
    assert(initialItem.querySelector('.dt-item-guide')?.textContent.includes('Người hướng dẫn thử'), 'Thiếu người hướng dẫn chính trên từng mục.');
    initialItem.querySelector('button[data-dt-guide-person]').click();
    const guideForm = document.querySelector('#dt-guide-person-form');
    guideForm.elements.person.value = '5';
    guideForm.elements.branch.value = '2';
    guideForm.requestSubmit();
    await waitFor(() => root.querySelector('.dt-item[data-no="1"] .dt-item-guide')?.textContent.includes('Phân công riêng'), 'Chưa hiện người được phân công riêng.');
    assert(root.querySelector('.dt-item[data-no="1"] .dt-item-branch')?.textContent.includes('TEST2'), 'Chưa hiện cơ sở vừa chọn.');
    assert(root.querySelector('.dt-item[data-no="2"] .dt-item-branch strong')?.textContent === 'TEST', 'Cơ sở mặc định bị đổi ở mục khác.');
    assert(root.querySelector('#dt-item-filter').value === 'done' && !visible(2), 'Mất bộ lọc sau khi đổi phân công.');
    assert(fits(), 'Tràn ngang khi hiện bộ lọc và phân công.');
    chooseFilter('introduced');
    const practice = root.querySelector('.dt-item[data-no="2"] .it-prac');
    practice.click();
    const levelDialog = document.querySelector('#dt-practice-level');
    assert(levelDialog, 'Tích thực hành chưa mở bảng chọn mức.');
    levelDialog.querySelector('[data-cancel]').click();
    await waitFor(() => !practice.checked && !document.querySelector('#dt-practice-level'), 'Hủy chọn mức vẫn giữ dấu tích.');
    practice.click();
    const openPicker = document.querySelector('#dt-practice-level');
    const immediate = new Promise((resolve) => openPicker.closest('dialog').addEventListener('close',
      () => resolve(!visible(2) && root.querySelector('#dt-item-filter-count').textContent === 'Không có hạng mục phù hợp'),
      { once: true }));
    openPicker.querySelector('[value="kha"]').click();
    assert(await immediate, 'Bộ lọc chưa đổi ngay lúc chọn mức.');
    await waitFor(() => practice.checked && root.querySelector('.dt-item[data-no="2"] .it-level').value === 'kha'
      && root.querySelector('.dt-item[data-no="2"] .it-by').textContent, 'Chưa lưu thực hành cùng mức Khá.');
    chooseFilter('done');
    assert(visible(1) && visible(2) && !visible(3), 'Mục vừa chọn mức chưa chuyển vào Hoàn thành.');
    chooseFilter('lv_kha');
    assert(!visible(1) && visible(2) && !visible(3), 'Mục vừa chọn mức Khá chưa hiện trong lọc Khá.');
    chooseFilter('all');

    assert(!root.querySelector('#dt-status').textContent.includes('bổ sung'), 'Giao riêng đã chuyển nhầm sang đào tạo bổ sung.');
    const phaseButton = (no) => root.querySelector(`.dt-item[data-no="${no}"] [data-dt-phase="2"]`);
    assert(phaseButton(1)?.hidden && phaseButton(3)?.hidden, 'Chỉ được giao giai đoạn 2 khi đã thực hành và mức chưa Tốt.');
    assert(phaseButton(2) && !phaseButton(2).hidden, 'Thiếu nút Giao giai đoạn 2 cho hạng mục mức Khá.');
    phaseButton(2).click();
    const phaseForm = document.querySelector('#dt-guide-person-form');
    phaseForm.elements.person.value = '5';
    phaseForm.elements.branch.value = '2';
    phaseForm.elements.note.value = 'Luyện thêm thao tác';
    phaseForm.requestSubmit();
    await waitFor(() => root.querySelector('#dt-status')?.textContent.includes('giai đoạn 2'), 'Chưa cập nhật trạng thái giai đoạn 2.');
    const practiceRow = root.querySelector('.dt-item[data-no="2"]');
    assert(practiceRow.textContent.includes('Luyện thêm thao tác') && practiceRow.querySelector('.dt-item-branch strong').textContent === 'TEST2', 'Thiếu phân công giai đoạn 2.');
    assert(practiceRow.querySelector('.it-level').value === 'kha', 'Mất kết quả thực hành trước đó.');
    const reassessment = practiceRow.querySelector('.it-level');
    reassessment.value = 'tot';
    reassessment.dispatchEvent(new Event('change'));
    await waitFor(() => !root.querySelector('#dt-status')?.textContent.includes('giai đoạn 2'), 'Chưa lưu kết quả giai đoạn 2.');
    assert(root.querySelector('.dt-item[data-no="2"] .it-level').value === 'tot', 'Chưa hiện mức Tốt sau giai đoạn 2.');

    root.querySelector('#dt-remind').requestSubmit();
    await waitFor(() => root.innerText.includes('Đã gửi lời nhắc'), 'Chưa gửi lời nhắc.');
    await rpc('app__test_dt_fill');
    await rpc('app_dt_update', { p_id: 1, p: { start_date: daysAgo(13) } });
    await visit('#/cong-viec/dao-tao');
    root = await visit('#/dao-tao/phieu?id=1');
    await waitFor(() => root.querySelector('#dt-review'), 'Thiếu bước nhận xét cuối.');
    assert(root.querySelector('#dt-overdue')?.textContent.includes('Quá hạn'), 'Thiếu báo quá hạn sau ngày 12.');
    assert(root.querySelector('#dt-finish') && !root.querySelector('#dt-finish').disabled, 'Đủ hạng mục vẫn chưa cho hoàn thành.');
    const review = root.querySelector('#dt-review');
    review.elements.note.value = 'Đã đạt đủ hạng mục';
    review.requestSubmit();
    await waitFor(() => document.querySelector('#dt-status')?.textContent.includes('Đã hoàn thành') && document.getElementById('root').textContent.includes('Đã đạt đủ hạng mục'), 'Chưa hoàn thành phiếu.');
    assert(fits(), 'Phiếu đã hoàn thành tràn ngang.');
    out.push('ĐẠT hai mục đào tạo, người hướng dẫn và cơ sở từng hạng mục, nhắc hạn, nhận xét cuối và kiểm tra tràn ngang');
  } catch (error) { out.push('KIỂM TRA THẤT BẠI: ' + error.message); }
};
