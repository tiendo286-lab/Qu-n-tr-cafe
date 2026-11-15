// Bước 110: Đối soát ca — phần tiền gộp 1 trang (Phiếu Fabi · Khách nợ · Thu chi · Tiền mặt · Chuyển khoản), 1 nút "Duyệt phần tiền & hoàn thành",
// nút "+ Khách chuyển khoản rút tiền mặt" (2 dòng tiền mặt − / chuyển khoản +). role=chu (confirm=1; máy tính và test/phone.html)
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ((typeof s === 'string' ? $(s) : s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (sel, n = 600) => { for (let i = 0; i < n && !$(sel); i++) await sleep(100); return !!$(sel); };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const vis = () => $$('.ds-pane').filter((p) => !p.hidden).map((p) => p.dataset.ds).join(',');
  const r = []; window.confirm = () => true; window.prompt = () => '200.000';
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2500);
    const { rpc } = await import('../js/sb.js');
    for (const m of ['../js/doi_soat_den.js', '../js/pages/phieu_ca.js', '../js/pages/doi_soat_ca.js']) await Promise.race([import(m).catch(() => {}), sleep(4000)]);
    const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const ov = await rpc('app_ca_overview', { p_date: day });
    const o = ov.find((x) => x.shift === ov[0].shift && x.branch_code === 'LLB') || ov[0];
    const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
    const R = await rpc('app_ca_get', { p_id: id });
    const e = (await rpc('app_ca_employees'))[0];
    const staff = (R.staff || []).length ? (R.staff || []).map((s) => ({ ...s, worked: true, time_in: '06:45', time_out: '12:39' })) : [{ employee_id: e.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }];
    await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: day + ' 12:39', reported_transfer: 2400000, total_revenue: 7000000, pos_cash: 4500000, pos_transfer: 2400000,
      cash_counted: 5150000, ipos_opening: 1000000, pos_debt: 100000, pos_diff: -350000, cups: 50, moves: [{ kind: 'tien_mat', amount: -100000, note: 'Mua đá' }, { kind: 'tien_mat', amount: -200000, note: 'Mua sữa' }], goods: [], handover: [],
      debts: [{ table_name: '3', amount: 100000, kind: 'bill' }], staff } });
    await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
    for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
    location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=4'; await wait('#ds-money-ok'); await sleep(1500);
    r.push(`trang tiền: khung hiện ${vis()} · kết luận: ${txt('.ds-v')} · bảng: ${$$('table.mt tr').map((x) => txt(x)).join(' / ')}`);
    r.push(`kiểm tra: ${$$('.ds-chk > summary').map((x) => txt(x)).join(' | ')} · thu chi: ${$$('#ds-tc .dt-r').length} khoản, ô nhóm ${$$('#ds-tc select.dt-cat').length} · nút phụ: ${$$('.ds-more > summary').map((x) => txt(x)).join(' | ')} · thanh: ${txt('.ds-mbar').slice(0, 160)} · lệch: ${$$('.lx-box').map((b) => b.dataset.item + ' ' + b.dataset.gap).join(', ')} · ${W()}`);
    r.push(`bước: ${$$('.ds-st').filter((b) => !b.hidden).map((b) => txt(b)).join(' / ')} · thẻ phần: ${txt('#ds-parts')}`);
    await sleep(1500);
    r.push(`danh sách gộp: thu chi ${$$('#moves .uv-row').length} · nợ ${$$('#debts .uv-row').length} · ô nhóm ${$$('#moves .uv-cats').length} · ô loại nợ ${$$('.uv-dkind').length} · nút: ${$$('.uv .toolbar button').map((b) => b.textContent.trim()).join(' | ')}`);
    {   // đổi loại dòng thu chi đầu tiên sang Thu · chuyển khoản, ghi lý do ở cuối → tự lưu
      const why = $$('.rc-why').pop(); why.value = 'Thử sửa loại khoản'; why.dispatchEvent(new Event('input', { bubbles: true }));
      const t = $('#moves .uv-type'); t.value = 'thu_ck'; t.dispatchEvent(new Event('change', { bubbles: true })); await sleep(4000);
      const G = await rpc('app_ca_recon', { p_id: id }).catch(() => null);
      r.push(`sau đổi loại: ${JSON.stringify((G?.data?.moves || G?.moves || []).map((m) => m.kind + ' ' + m.amount)).slice(0, 160)}`);
      location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=4'; await wait('#ds-money-ok'); await sleep(2500);
      r.push(`tải lại: dòng đầu ${$('#moves .uv-type')?.value} · bảng: ${$$('table.mt tr').map((x) => txt(x)).join(' / ').slice(0, 220)}`);
      { const w2 = $$('.rc-why').pop(); w2.value = 'Trả lại như cũ'; w2.dispatchEvent(new Event('input', { bubbles: true })); }
      const t2 = $('#moves .uv-type'); t2.value = 'chi_tm'; t2.dispatchEvent(new Event('change', { bubbles: true })); await sleep(4000);
      location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=4'; await wait('#ds-money-ok'); await sleep(2500);
    }
    if (new URLSearchParams(location.search).get('pre')) { window.scrollTo(0, 0); await new Promise(() => {}); }   // chụp ảnh trước khi duyệt
    // khách chuyển khoản rút tiền mặt
    const n0 = $$('#moves .mv-row').length; $('#add-rut2').click(); await sleep(300); r.push(`bảng sửa mở: ${$('#ds-mv-ed')?.open}`);
    const rows = $$('#moves .mv-row').slice(n0).map((x) => `${x.querySelector('.mv-kind').value} ${x.querySelector('.mv-sign').value}${x.querySelector('.mv-amt').value} ${x.querySelector('.mv-note').value}`);
    r.push(`thêm rút tiền mặt: ${rows.join(' · ')}`);
    // xoá 2 dòng thử (không lưu)
    $$('#moves .mv-row').slice(n0).forEach((x) => x.querySelector('.pc-del')?.click()); await sleep(300);
    // chọn Quán chịu cho tiền mặt lệch rồi bấm duyệt 1 lần
    const tm = $('.lx-box[data-item="tien_mat"]');
    if (tm) { const q = tm.querySelector('input[value="qc"]'); q.checked = true; q.dispatchEvent(new Event('change', { bubbles: true })); }
    $('#ds-money-ok').click(); await sleep(3500); await wait('.ds-v'); await sleep(1500);
    const A = await rpc('app_ca_get', { p_id: id });
    r.push(`sau duyệt: ${txt('.alert.ok, .flash, #flash').slice(0, 120)} · kết luận: ${txt('.ds-v')} · đối soát: ${A.recon_status} · mục xong: ${Object.keys(A.checks || {}).concat(Object.keys(A.results || {})).join(',')} · khung hiện ${vis()} · ${W()}`);
    if (new URLSearchParams(location.search).get('dung')) {
      if (new URLSearchParams(location.search).get('b1')) { location.hash = '#/__tam'; await sleep(300); location.hash = '#/quan-ly/doi-soat/ca?id=' + id + '&buoc=1'; await wait('#ds-lights .den-list'); await sleep(2000); }
      window.scrollTo(0, 0); await new Promise(() => {});
    }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'đối soát 110', title: r.join(' || '), len: 0, errs: [...window.__ERR] });
};
