// Nút "Ngừng làm" / "Đi làm lại" ở danh sách Nhân viên và trang sửa nhân viên.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const r = []; window.confirm = () => true;
  await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
  location.hash = '#/quan-ly/nhan-vien'; await wait('.emp-row', 300); await sleep(500);
  const btns = $$('.emp-row:not([hidden]) .st-btn');
  r.push(`danh sách: ${btns.length} nút Ngừng làm (${$$('.emp-row:not([hidden])').length} người đang làm)`);
  const b = btns.find((x) => x.dataset.to === 'Ngừng làm');
  if (b) {
    const id = b.dataset.id; b.click(); await sleep(1500); await wait('.emp-row', 100);
    r.push(`sau khi bấm: ${$('.alert')?.innerText.replace(/\s+/g, ' ').slice(0, 140) || 'không có thông báo'}`);
    const row = $(`.st-btn[data-id="${id}"]`)?.closest('tr');
    r.push(`dòng đó: ${row ? (row.hidden ? 'ẩn (ngừng làm)' : 'vẫn hiện') : 'không thấy'}`);
    $('#show-stopped').click(); await sleep(200);
    r.push(`hiện cả người ngừng làm → nút: ${$(`.st-btn[data-id="${id}"]`)?.innerText}`);
    location.hash = `#/quan-ly/nhan-vien?id=${id}`; await wait('#st-emp', 200); await sleep(300);
    r.push(`trang sửa: nút ${$('#st-emp')?.innerText || 'KHÔNG CÓ'}`);
    $('#st-emp')?.click(); await sleep(1500); await wait('#st-emp', 100);
    r.push(`sau khi đi làm lại: ${$('.alert')?.innerText.replace(/\s+/g, ' ').slice(0, 80)} · nút ${$('#st-emp')?.innerText}`);
  }
  out.push({ route: 'ngừng làm', title: r.join(' || ') + ` || rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`, len: 0, errs: [...window.__ERR] });
};
