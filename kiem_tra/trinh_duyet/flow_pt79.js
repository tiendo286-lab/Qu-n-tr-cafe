// Bước 79: trang Đối soát ca trên máy tính — tab ① Phần việc / ② Phần tiền / ③ Hoàn thành, mỗi lần chỉ hiện 1 phần. role=chu (máy tính)
export default async ({ sleep, out }) => {
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = (s, r) => ($(s, r)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 300) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const vis = () => $$('.ds-pane').filter((p) => !p.hidden).map((p) => p.dataset.ds).join(',');
  const r = [];
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(1500);
    const { sb } = await import('../js/sb.js');
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    await sb.from('shift_reports').insert({ id: 9991, branch_id: 1, work_date: day, shift: 'Sáng', status: 'hoan_thanh', recon_status: 'chua', total_revenue: 1000000 });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=9991'; await wait('.ds-ptabs', 400); await sleep(800);
    r.push(`tab: ${$$('.ds-pt').map((b) => b.innerText.replace(/\s+/g, ' ')).join(' | ')} · đang chọn ${txt('.ds-pt[aria-selected="true"]')} · hiện bước ${vis()}`);
    $('.ds-pt[data-ptab="tien"]').click(); await sleep(300); r.push(`bấm Phần tiền → hiện bước ${vis()} · có nút Ghi nhận nợ ${!!$('#rd-add') && !$('#rd-add').closest('.ds-pane').hidden}`);
    $('.ds-pt[data-ptab="viec"]').click(); await sleep(300); r.push(`bấm Phần việc → hiện bước ${vis()} · tiêu đề ${$$('.ds-pane:not([hidden]) .ds-hd span').map((x) => x.innerText).join(' / ')}`);
    $('.ds-pt[data-ptab="xong"]').click(); await sleep(300); r.push(`bấm Hoàn thành → hiện bước ${vis()}`);
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=9991&buoc=3'; await wait('.ds-ptabs', 400); await sleep(800);
    r.push(`mở link buoc=3 → ${txt('.ds-pt[aria-selected="true"]')} · hiện ${vis()} · rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`);
  } catch (e) { r.push('LỖI ' + e.message); }
  out.push({ route: 'tab phần đối soát 79', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
