// Chặng 6.2 (anh Tiến duyệt hình mẫu 23/11): trang Duyệt nghỉ & làm thay (#/quan-ly/nghi-lam-thay).
// role=chu: dựng 3 phiếu đã gửi có nghỉ / hỗ trợ → thẻ Chờ phân loại: áp hàng loạt (tự ghép 1–1, x2), bỏ lý do 1 ca → Lưu: ca đó báo đỏ, ca khác lưu
//   → Chờ Chủ duyệt (tích sẵn) → Duyệt các ca đã tích → Đã duyệt → Sửa → Duyệt lại. role=qlt: Lưu được, không có nút Duyệt. role=ql: chỉ xem.
export default async ({ sleep, out }) => {
  const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
  const txt = (s) => ($(s)?.innerText || '').replace(/\s+/g, ' ').trim();
  const wait = async (fn, n = 300) => { for (let i = 0; i < n; i++) { if (typeof fn === 'string' ? $(fn) : fn()) return true; await sleep(100); } return false; };
  const W = () => `rộng ${document.documentElement.clientWidth}/${document.documentElement.scrollWidth}`;
  const role = new URLSearchParams(location.search).get('role');
  const r = []; const ok = (c, m) => r.push(`${c ? 'ĐẠT' : 'LỖI'} ${m}`);
  const go = async (h) => { location.hash = '#/__tam'; await sleep(200); location.hash = h; await wait('.x2p-tabs'); await sleep(800); };
  try {
    await wait('#root .page-head, #root h1, #root .appbar', 600); await sleep(2000);
    const { rpc } = await import('../js/sb.js');
    {
      var day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      const ov = await rpc('app_ca_overview', { p_date: day });
      const emps = await rpc('app_ca_employees');
      // Phiếu đã gửi: absent=true → người đầu lịch nghỉ + 1 người hỗ trợ; absent=false → chỉ 1 người hỗ trợ làm thêm
      const mk = async (o, absent, more = 0, hid = null, aid = null) => {   // hid / aid: chỉ định người hỗ trợ / người nghỉ (cặp đổi ca)   // more: số người hỗ trợ thêm (ca nhiều người)
        const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift });
        for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_claim', { p_id: id, p_part: k, p_force: false });
        const R = await rpc('app_ca_get', { p_id: id });
        const staff = (R.staff || []).map((s, i) => ({ ...s, worked: !(absent && i === 0), absent_reason: absent && i === 0 ? 'Ốm' : null, time_in: '06:45', time_out: '12:39' }));
        if (absent && !staff.some((s) => s.source === 'lich' && !s.worked)) { const n = aid ? { id: aid } : emps.find((e) => !staff.some((s) => s.employee_id === e.id)); staff.push({ employee_id: n.id, source: 'lich', worked: false, absent_reason: 'Ốm' }); }
        const h = hid ? { id: hid } : emps.find((e) => !staff.some((s) => s.employee_id === e.id));
        staff.push({ employee_id: h.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' });
        for (let i = 0; i < more; i++) { const h2 = emps.find((e) => !staff.some((s) => s.employee_id === e.id)); staff.push({ employee_id: h2.id, source: 'ho_tro', worked: true, time_in: '06:45', time_out: '12:39' }); }
        await rpc('app_ca_save', { p_id: id, p: { rev_start: R.rev_start || day + ' 06:45', rev_end: (R.rev_start || '') > day + ' 12:00' ? day + ' 23:30' : day + ' 12:39', reported_transfer: 3000000, total_revenue: 5000000, pos_cash: 2000000, pos_transfer: 3000000,
          cash_counted: 3000000, ipos_opening: 1000000, pos_debt: 0, pos_diff: 0, cups: 50, moves: [], goods: [], handover: [], debts: [], staff } });
        await rpc('app_ca_photo_add', { p_id: id, p_path: 'r/x.jpg', p_kind: 'ipos' });
        for (const k of ['tien', 'nhan_su']) await rpc('app_ca_part_done', { p_id: id, p_part: k, p_on: true, p_as_staff: true });
        return id;
      };
      var mkCa = mk, ovAll = ov, empAll = emps, pickOv = []; for (const o of ov) if (!pickOv.some((x) => x.branch_id === o.branch_id)) pickOv.push(o);
    }
    if (role === 'chu') {
      const pick = pickOv;   // 3 cơ sở khác nhau, ca đầu ngày
      const ids = [await mkCa(pick[0], true), await mkCa(pick[1], true), await mkCa(pick[2], false)];
      r.push(`Dựng 3 phiếu: ${(await Promise.all(ids.map((id) => rpc('app_ca_get', { p_id: id })))).map((x) => x.status).join(', ')}`);
      // 27/11 (cách 2, tệp 186): ca thứ 4 có 1 người nghỉ + 2 người hỗ trợ (3 người) → lưu riêng từng người
      const id4 = pick[3] ? await mkCa(pick[3], true, 1) : null;
      await go('#/quan-ly/nghi-lam-thay');
      // 27/11 (anh Tiến): ca đúng 1 người nghỉ + 1 người hỗ trợ → ghép sẵn, chỉ một khung, không có Lưu người này
      {
        const p = $(`.x2p-ca[data-id="${ids[0]}"]`), g0 = await rpc('app_cv_get', { p_id: ids[0] });
        const hp = g0.people.find((x) => x.kind === 'ho_tro');
        ok(!!p && p.querySelector('.cv-a .cv-helper').value === String(hp.employee_id) && p.querySelector('.cv-e').hidden && !p.querySelector('.cv-hl').hidden
          && Number(p.querySelector('.cv-h').value) === Number(hp.hours), `Ca 1 nghỉ + 1 hỗ trợ: ghép sẵn người làm thay, điền giờ ${p?.querySelector('.cv-h').value}, khung Hỗ trợ ẩn`);
        ok(!p.querySelector('[data-p1]') && !!p.querySelector('[data-one]') && g0.rows.length === 0, 'Ca 1 nghỉ + 1 hỗ trợ: chỉ một nút Lưu ca này (chưa lưu gì lên máy chủ)');
        const s = p.querySelector('.cv-helper'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true }));
        ok(!p.querySelector('.cv-e').hidden && p.querySelector('.cv-hl').hidden, 'Bỏ chọn người làm thay → khung Hỗ trợ hiện lại');
        s.value = String(hp.employee_id); s.dispatchEvent(new Event('change', { bubbles: true }));
        ok(p.querySelector('.cv-e').hidden, 'Chọn lại → khung Hỗ trợ ẩn');
      }
      if (id4) {
        const c4 = () => $(`.x2p-ca[data-id="${id4}"]`);
        const one = $(`.x2p-ca[data-id="${ids[2]}"]`);
        ok($$('[data-p1]').filter((b) => c4().contains(b)).length === 3 && !one.querySelector('[data-p1]'), `Ca 3 người có 3 nút Lưu người này; ca 1 người không có · ${W()}`);
        const A = c4().querySelector('.cv-a'), E = c4().querySelector('.cv-e');
        A.querySelector('[data-p1]').click(); await sleep(400);
        ok(c4().classList.contains('bad') && /Chưa chọn lý do/.test(c4().querySelector('.x2p-err').innerText), `Lưu người này khi chưa chọn lý do: báo đỏ — ${c4().querySelector('.x2p-err').innerText}`);
        A.querySelector('.cv-reason').value = 'ma_chay'; A.querySelector('.cv-reason').dispatchEvent(new Event('change', { bubbles: true }));
        E.querySelector('.cv-x').checked = true;   // người thứ hai đang điền dở, chưa lưu
        A.querySelector('[data-p1]').click(); await wait(() => !A.querySelector('.x2p-saved').hidden, 100);
        let g4 = await rpc('app_cv_get', { p_id: id4 });
        ok(g4.state === 'chua_phan_loai' && g4.rows.length === 1 && g4.rows[0].reason === 'ma_chay', `Lưu 1 người: máy chủ ${g4.state}, ${g4.rows.length} dòng · ${txt('#x2p-msg')}`);
        ok(!!c4() && !A.querySelector('.x2p-saved').hidden && E.querySelector('.x2p-saved').hidden && E.querySelector('.cv-x').checked, 'Ca vẫn ở Chờ phân loại, người đã lưu có nhãn Đã lưu, ô đang điền dở của người kia còn nguyên');
        await go('#/quan-ly/nghi-lam-thay');
        ok(c4()?.querySelector('.cv-a .cv-reason').value === 'ma_chay' && !c4().querySelector('.cv-a .x2p-saved').hidden && /Chưa phân loại/i.test(c4().innerText), 'Mở lại trang: lý do đã lưu được điền sẵn, ca vẫn Chưa phân loại');
        await go('#/quan-ly/nghi-lam-thay?tab=duyet');
        ok(!c4(), 'Ca lưu dở KHÔNG nằm ở Chờ Chủ duyệt');
        let e4 = ''; try { await rpc('app_cv_approve', { p_id: id4, p_items: null, p_note: '' }); } catch (e) { e4 = e.message; }
        g4 = await rpc('app_cv_get', { p_id: id4 });
        ok(g4.state === 'chua_phan_loai', `Ca lưu dở chưa duyệt được: ${e4 || g4.state}`);
        await go('#/quan-ly/nghi-lam-thay');
        const n0 = $('[data-tab="duyet"] strong').textContent;
        { const e1 = c4().querySelectorAll('.cv-e')[0]; e1.querySelector('[data-p1]').click(); await wait(() => !e1.querySelector('.x2p-saved').hidden, 100); }
        ok(!!c4() && (await rpc('app_cv_get', { p_id: id4 })).state === 'chua_phan_loai', 'Lưu người thứ hai: ca vẫn Chưa phân loại');
        c4().querySelectorAll('.cv-e')[1].querySelector('[data-p1]').click(); await wait(() => !c4(), 100);
        g4 = await rpc('app_cv_get', { p_id: id4 });
        ok(!c4() && g4.state === 'cho_duyet' && g4.rows.length === 3, `Lưu người cuối: ca đủ người → ${g4.state}, ${g4.rows.length} dòng · ${txt('#x2p-msg')}`);
        ok(Number($('[data-tab="duyet"] strong').textContent) === Number(n0) + 1 && !!$(`.x2p-ca[data-id="${ids[0]}"]`), 'Số ở thẻ Chờ Chủ duyệt tăng 1, các ca khác còn nguyên');
      } else r.push('(bỏ qua phần lưu từng người: dữ liệu thử không đủ 4 cơ sở)');
      ok(!!$('a[href="#/quan-ly/nghi-lam-thay"]'), 'menu Quản lý ca có "Nghỉ & làm thay"');
      ok(txt('.x2p-tabs').includes('Chờ phân loại') && txt('.x2p-tabs').includes('Đã duyệt'), `3 thẻ: ${txt('.x2p-tabs')}`);
      const mine = () => ids.map((id) => $(`.x2p-ca[data-id="${id}"]`));
      ok(mine().every(Boolean), `3 ca hiện ở Chờ phân loại · ${$$('.x2p-ca').length} dòng · ${W()}`);
      mine().forEach((el) => { const c = el.querySelector('.x2p-pick'); c.checked = true; c.dispatchEvent(new Event('change')); });
      $('#x2p-reason').value = 'tu_tim'; $('#x2p-x').checked = true; $('#x2p-apply').click(); await sleep(300);
      const [a, b, c] = mine();
      ok(a.querySelector('.cv-reason').value === 'tu_tim' && !!a.querySelector('.cv-helper').value && a.querySelector('.cv-x').checked, 'Áp: ca 1–1 tự ghép người làm thay, tích x2');
      ok(c.querySelector('.cv-e .cv-x')?.checked === true, 'Áp: ca chỉ có người hỗ trợ → x2 cho người làm thêm');
      ok(/chưa lưu/.test(txt('#x2p-msg')), `Thông báo áp: ${txt('#x2p-msg')}`);
      b.querySelector('.cv-reason').value = ''; // ca 2 bỏ lý do → phải báo đỏ, không lưu
      $('#x2p-save').click(); await wait(() => txt('#x2p-msg').includes('báo đỏ'), 100);
      ok(b.classList.contains('bad') && /Chưa chọn lý do/.test(b.querySelector('.x2p-err').innerText), `Ca thiếu lý do báo đỏ: ${b.querySelector('.x2p-err').innerText}`);
      const st = await Promise.all(ids.map((id) => rpc('app_cv_get', { p_id: id }).then((x) => x.state)));
      ok(st[0] === 'cho_duyet' && st[1] === 'chua_phan_loai' && st[2] === 'cho_duyet', `Sau Lưu: ${st.join(', ')} · ${txt('#x2p-msg')}`);
      // 27/11: nút "Lưu ca này" ngay trong khung ca — lưu riêng 1 ca, không tải lại trang
      {
        const b2 = $(`.x2p-ca[data-id="${ids[1]}"]`), a2 = $(`.x2p-ca[data-id="${ids[0]}"]`);
        ok(/^lưu ca này$/i.test(b2.querySelector('[data-one]')?.textContent.trim()), `Khung ca có nút: ${b2.querySelector('[data-one]')?.innerText} · ${W()}`);
        b2.querySelector('[data-one]').click(); await sleep(400);
        ok(b2.classList.contains('bad') && !!$(`.x2p-ca[data-id="${ids[1]}"]`), `Lưu ca này khi thiếu lý do: báo đỏ, không lưu — ${b2.querySelector('.x2p-err').innerText}`);
        b2.querySelector('.cv-reason').value = 'tu_tim'; a2.dataset.giu = '1';
        const n0 = $('[data-tab="duyet"] strong').textContent;
        b2.querySelector('[data-one]').click(); await wait(() => !$(`.x2p-ca[data-id="${ids[1]}"]`), 100);
        const s1 = (await rpc('app_cv_get', { p_id: ids[1] })).state;
        ok(!$(`.x2p-ca[data-id="${ids[1]}"]`) && s1 === 'cho_duyet', `Lưu ca này: ca rời danh sách, máy chủ ${s1} · ${txt('#x2p-msg')}`);
        ok($(`.x2p-ca[data-id="${ids[0]}"]`)?.dataset.giu === '1', 'Trang không tải lại (khung ca khác còn nguyên)');
        ok(Number($('[data-tab="duyet"] strong').textContent) === Number(n0) + 1, `Số ở thẻ Chờ Chủ duyệt tăng 1: ${n0} → ${$('[data-tab="duyet"] strong').textContent}`);
      }
      await go('#/quan-ly/nghi-lam-thay?tab=duyet');
      {
        const d2 = $(`.x2p-ca[data-id="${ids[1]}"]`);
        ok(/^duyệt ca này$/i.test(d2?.querySelector('[data-one]')?.textContent.trim()), `Chờ Chủ duyệt: khung ca có nút ${d2?.querySelector('[data-one]')?.innerText}`);
        d2.querySelector('[data-one]').click(); await wait(() => !$(`.x2p-ca[data-id="${ids[1]}"]`), 100);
        const s2 = (await rpc('app_cv_get', { p_id: ids[1] })).state;
        ok(!$(`.x2p-ca[data-id="${ids[1]}"]`) && s2 === 'da_duyet' && !!$(`.x2p-ca[data-id="${ids[0]}"]`), `Duyệt ca này: chỉ ca đó được duyệt (${s2}), ca khác còn chờ · ${txt('#x2p-msg')} · ${W()}`);
      }
      const d1 = $(`.x2p-ca[data-id="${ids[0]}"]`), d3 = $(`.x2p-ca[data-id="${ids[2]}"]`);
      ok(d1 && d3 && d1.querySelector('.x2p-pick').checked && d3.querySelector('.x2p-pick').checked, `Chờ Chủ duyệt: 2 ca tích sẵn · ${txt('#x2p-count')}`);
      ok(!!$('#x2p-ok') && !$('#x2p-save'), 'Chủ có nút Duyệt các ca đã tích');
      $('#x2p-ok').click(); await wait(() => !$(`.x2p-ca[data-id="${ids[0]}"]`) || /Đã duyệt/.test(txt('.flash, .alert.ok')), 100); await sleep(800);
      const st2 = await Promise.all(ids.map((id) => rpc('app_cv_get', { p_id: id }).then((x) => x.state)));
      ok(st2[0] === 'da_duyet' && st2[2] === 'da_duyet', `Sau Duyệt: ${st2.join(', ')} · ${txt('#root .alert')}`.slice(0, 200));
      await go('#/quan-ly/nghi-lam-thay?tab=xong');
      const x1 = $(`.x2p-ca[data-id="${ids[0]}"]`);
      ok(!!x1 && /Chủ đã duyệt/i.test(x1.innerText) && /x2 lương/.test(x1.innerText), `Đã duyệt: ${x1?.innerText.replace(/\s+/g, ' ').slice(0, 160)}`);
      x1.querySelector('[data-edit]').click(); await sleep(300);
      const x1e = $(`.x2p-ca[data-id="${ids[0]}"]`);
      ok(!!x1e.querySelector('.cv-reason') && !!x1e.querySelector('[data-reok]'), 'Sửa → mở ô sửa + nút Duyệt lại');
      x1e.querySelector('.cv-a .cv-x').checked = false; x1e.querySelector('[data-reok]').click(); await sleep(1500);
      const g = await rpc('app_cv_get', { p_id: ids[0] });
      ok(g.state === 'da_duyet' && g.rows.some((x) => x.absent_id && x.x2 === false), `Duyệt lại: x2 bỏ → ${g.rows.map((x) => x.x2).join(',')}`);
      // 28/11 (anh Tiến): cặp đổi ca — A nghỉ ca X + làm thay ở ca Y, B nghỉ ca Y + làm thay ở ca X → một khung, một nút
      {
        const rest = []; for (const o of ovAll) if (!pick.slice(0, 4).includes(o) && !rest.some((x) => x.branch_id === o.branch_id)) rest.push(o);   // mỗi cơ sở lấy ca kế tiếp (giờ doanh thu nối ca trước)
        const firstOf = async (o) => { const id = await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift }); const R = await rpc('app_ca_get', { p_id: id });
          return (R.staff || [])[0]?.employee_id ?? null; };
        let oX = null, oY = null, A = null, B = null;
        for (const x of rest) { const a = await firstOf(x); if (a == null) continue;
          for (const y of rest) { if (y === x) continue; const b = await firstOf(y); if (b != null && b !== a) { oX = x; oY = y; A = a; B = b; break; } }
          if (oX) break; }
        // ca chưa có lịch (dữ liệu thử): tự chỉ định người nghỉ của từng ca
        if (!oX && rest.length >= 2 && empAll.length >= 4) { oX = rest[0]; oY = rest[1]; A = empAll[2].id; B = empAll[3].id; }
        if (!oX) r.push(`LỖI không dựng được cặp đổi ca (còn ${rest.length} ca trống)`);
        else {
          const idX = await mkCa(oX, true, 0, B, A), idY = await mkCa(oY, true, 0, A, B);
          await go('#/quan-ly/nghi-lam-thay');
          const cX = () => $(`.x2p-ca[data-id="${idX}"]`), cY = () => $(`.x2p-ca[data-id="${idY}"]`);
          const wrap = cX()?.closest('.x2p-pair');
          ok(!!wrap && wrap.contains(cY()) && /Đổi ca:/.test(wrap.querySelector('.x2p-pt').innerText), `Cặp đổi ca gộp một khung: ${wrap?.querySelector('.x2p-pt').innerText.replace(/\s+/g, ' ').slice(0, 120)} · ${W()}`);
          ok(!!wrap && !wrap.querySelector('[data-one]') && !wrap.querySelector('[data-p1]') && $$('[data-pairgo]').filter((b) => wrap.contains(b)).length === 1 && /Lưu cả 2 ca/.test(wrap.querySelector('[data-pairgo]').textContent), 'Cặp đổi ca: chỉ một nút Lưu cả 2 ca');
          ok(cX().querySelector('.cv-a[data-swap] .cv-helper').value === String(B) && cY().querySelector('.cv-a[data-swap] .cv-helper').value === String(A), 'Cặp đổi ca: mỗi người nghỉ được ghép sẵn với người đổi ca với mình');
          wrap.querySelector('[data-pairgo]').click(); await sleep(400);
          ok(cX().classList.contains('bad') && (await rpc('app_cv_get', { p_id: idX })).state === 'chua_phan_loai', `Thiếu lý do: báo đỏ, chưa lưu ca nào — ${cX().querySelector('.x2p-err').innerText}`);
          const sx = cX().querySelector('.cv-a[data-swap] .cv-reason'); sx.value = 'tu_tim'; sx.dispatchEvent(new Event('change', { bubbles: true }));
          ok(cY().querySelector('.cv-a[data-swap] .cv-reason').value === 'tu_tim', 'Chọn lý do cho một người → người kia điền theo');
          wrap.querySelector('[data-pairgo]').click(); await wait(() => !cX() && !cY(), 100);
          let sp = await Promise.all([idX, idY].map((id) => rpc('app_cv_get', { p_id: id }).then((x) => x.state)));
          ok(!cX() && !cY() && !wrap.isConnected && sp.every((x) => x === 'cho_duyet'), `Lưu cả 2 ca một lần: ${sp.join(', ')} · ${txt('#x2p-msg')}`);
          await go('#/quan-ly/nghi-lam-thay?tab=duyet');
          const w2 = cX()?.closest('.x2p-pair');
          ok(!!w2 && w2.contains(cY()) && /Duyệt cả 2 ca/.test(w2.querySelector('[data-pairgo]')?.textContent || ''), `Chờ Chủ duyệt: cặp đổi ca một khung, nút ${w2?.querySelector('[data-pairgo]')?.innerText} · ${W()}`);
          w2.querySelector('[data-pairgo]').click(); await wait(() => !cX() && !cY(), 100);
          sp = await Promise.all([idX, idY].map((id) => rpc('app_cv_get', { p_id: id }).then((x) => x.state)));
          ok(sp.every((x) => x === 'da_duyet'), `Duyệt cả 2 ca một lần: ${sp.join(', ')} · ${txt('#x2p-msg')}`);
        }
      }
      // 28/11 (tệp 194, anh Tiến): lý do Đổi ca + nút nhanh — ca toàn Đổi ca xong luôn, khỏi Chủ duyệt
      {
        const more = []; for (const o of ovAll) if (!more.some((x) => x.branch_id === o.branch_id) && o.shift !== pick[0].shift && !(await rpc('app_ca_get', { p_id: await rpc('app_ca_open', { p_branch: o.branch_id, p_date: day, p_shift: o.shift }) })).status?.startsWith('hoan')) more.push(o);
        const oQ = more[2] || more[0], oD = more[3] || more[1];
        const idQ = oQ ? await mkCa(oQ, true) : null, idD = oD && oD !== oQ ? await mkCa(oD, true) : null;
        if (!idQ || !idD) r.push(`LỖI không dựng được 2 ca thử Đổi ca (còn ${more.length} ca trống)`);
        else {
          await go('#/quan-ly/nghi-lam-thay');
          const cQ = () => $(`.x2p-ca[data-id="${idQ}"]`), cD = () => $(`.x2p-ca[data-id="${idD}"]`);
          ok([...cQ().querySelectorAll('.cv-reason option')].some((o) => o.value === 'doi_ca') && !!cQ().querySelector('[data-dc]'), `Có lý do Đổi ca và nút nhanh Đổi ca · ${W()}`);
          const sQ = cQ().querySelector('.cv-reason'); sQ.value = 'doi_ca'; sQ.dispatchEvent(new Event('change', { bubbles: true }));
          ok(cQ().querySelector('.cv-x').disabled && !cQ().querySelector('.cv-x').checked, 'Chọn Đổi ca → ô x2 bị khoá, không tích');
          sQ.value = 'tu_tim'; sQ.dispatchEvent(new Event('change', { bubbles: true }));
          ok(!cQ().querySelector('.cv-x').disabled, 'Đổi sang lý do khác → ô x2 mở lại');
          const nx = Number($('[data-tab="xong"] strong').textContent), nd = Number($('[data-tab="duyet"] strong').textContent);
          cQ().querySelector('[data-dc]').click(); await wait(() => !cQ(), 100);
          const gQ = await rpc('app_cv_get', { p_id: idQ });
          ok(!cQ() && gQ.state === 'da_duyet' && gQ.rows[0].reason === 'doi_ca' && gQ.rows[0].x2 === false, `Bấm nhanh Đổi ca ở Chờ phân loại: ${gQ.state} · ${txt('#x2p-msg')}`);
          ok(Number($('[data-tab="xong"] strong').textContent) === nx + 1 && Number($('[data-tab="duyet"] strong').textContent) === nd, 'Số ở thẻ Đã duyệt tăng 1, thẻ Chờ Chủ duyệt không đổi');
          // ca thứ hai: lưu lý do thường → sang Chờ Chủ duyệt → Chủ bấm nhanh Đổi ca ngay ở bước duyệt
          cD().querySelector('.cv-reason').value = 'tu_tim'; cD().querySelector('.cv-x').checked = true; cD().querySelector('[data-one]').click(); await wait(() => !cD(), 100);
          // 28/11 (bản chạy thử): bước duyệt làm ở BẢNG THEO CA — mỗi cơ sở một cột, thao tác ngay dưới cột
          await go('#/quan-ly/nghi-lam-thay?tab=duyet');
          ok(/bảng theo ca/i.test($('#x2p-kieu')?.textContent || ''), 'Có nút Xem dạng bảng theo ca (thử)');
          $('#x2p-kieu').click(); await wait('.x2p-board'); await sleep(700);
          if (!cD()) { const k = [...$('#x2p-g').options].find((o) => o.textContent.includes(oD.shift)); if (k) { $('#x2p-g').value = k.value; $('#x2p-g').dispatchEvent(new Event('change', { bubbles: true })); await sleep(900); } }
          {
            const col = cD()?.closest('.x2p-col');
            ok(!!col && $$('.x2p-col').length >= 2 && !!col.querySelector('.x2p-pp.x') && !!col.querySelector('.x2p-pp.p'), `Bảng theo ca: ${$$('.x2p-col').length} cột, cột của ca có người ✗ nghỉ và + làm ngoài lịch · ${txt('.x2p-gnav').slice(0, 70)} · ${W()}`);
            ok(!$('#x2p-ok') && !$('.x2p-pick') && /duyệt ca này/i.test(cD().querySelector('[data-one]')?.textContent || '') && /kieu=bang/.test(location.hash) && /danh sách/i.test($('#x2p-kieu').textContent), 'Bảng theo ca: nút Duyệt ca này nằm ngay dưới cột, không có tích hàng loạt, có nút quay về danh sách');
          }
          ok(!!cD()?.querySelector('[data-dc]') && cD().querySelector('.cv-x').checked, 'Chờ Chủ duyệt: ca đang x2 có nút nhanh Đổi ca');
          // 28/11 (anh Tiến): đỏ = còn phải xử lý, xanh = có làm / đã duyệt xong
          const colD = cD().closest('.x2p-col'), colOk = $$('.x2p-col').find((c) => c !== colD && !c.querySelector('.x2p-ca') && c.querySelector('.x2p-pp'));
          ok(colD.querySelector('.x2p-pp.x').classList.contains('r') && colD.querySelector('.x2p-pp.p').classList.contains('r') && /cần xử lý/i.test(colD.querySelector('h3').textContent), 'Bảng theo ca: người nghỉ / làm ngoài lịch của ca đang chờ hiện ĐỎ');
          ok(!colOk || [...colOk.querySelectorAll('.x2p-pp')].every((p) => p.classList.contains('g')), `Bảng theo ca: cột đã duyệt xong hiện XANH (${colOk ? colOk.querySelector('h3').textContent.replace(/\s+/g, ' ').trim() : 'không có cột nào khác'})`);
          window.__colD = colD;
          cD().querySelector('[data-dc]').click(); await wait(() => !cD(), 100);
          const gD = await rpc('app_cv_get', { p_id: idD });
          ok(!window.__colD.isConnected || window.__colD.classList.contains('done'), 'Bảng theo ca: xử lý xong → cột chuyển XANH (hoặc bảng sang buổi kế)');
          ok(!cD() && gD.state === 'da_duyet' && gD.rows[0].reason === 'doi_ca' && gD.rows[0].x2 === false, `Bấm nhanh Đổi ca ở bước duyệt: ${gD.state}, x2 ${gD.rows[0].x2} · ${txt('#x2p-msg')}`);
          await go('#/quan-ly/nghi-lam-thay?tab=xong');
          ok(/Đổi ca — không cần duyệt/i.test(cD()?.querySelector('.x2p-t').textContent || '') && /Đổi ca \(lịch chưa sửa\)/.test(cD().textContent), `Đã duyệt: ${cD()?.textContent.replace(/\s+/g, ' ').slice(0, 140)} · ${W()}`);
        }
      }
      r.push(`Khung: ${W()}`);
    } else {
      let id = null;
      try { id = await mkCa(pickOv[0], true); } catch (e) { r.push(`(không dựng được ca bằng vai ${role}: ${e.message})`); }
      await go('#/quan-ly/nghi-lam-thay');
      r.push(`Thẻ: ${txt('.x2p-tabs')} · ${W()}`);
      const row = id && $(`.x2p-ca[data-id="${id}"]`);
      if (role === 'qlt') {
        ok(!!row && !!row.querySelector('.cv-reason') && !!$('#x2p-save') && !!$('#x2p-reason'), 'QL tổng: ca hiện, sửa được, có Áp + Lưu');
        if (row) { row.querySelector('.x2p-pick').checked = true; row.querySelector('.x2p-pick').dispatchEvent(new Event('change')); $('#x2p-reason').value = 'nho_ql'; $('#x2p-apply').click(); await sleep(200);
          $('#x2p-save').click(); await sleep(1500); ok((await rpc('app_cv_get', { p_id: id })).state === 'cho_duyet', 'QL tổng lưu phân loại → chờ Chủ duyệt'); }
        await go('#/quan-ly/nghi-lam-thay?tab=duyet');
        ok(!$('#x2p-ok') && !!$('#x2p-save'), 'QL tổng ở Chờ Chủ duyệt: có Lưu, không có Duyệt');
      }
      if (role === 'ql') ok((!id || !!row) && !$('#x2p-save') && !$('#x2p-ok') && !$('.x2p-pick') && !$('.cv-reason'), `Quản lý cơ sở chỉ xem (ca ${id ? 'hiện' : 'không dựng được'}, không tích, không lưu / duyệt)`);
    }
  } catch (e) { r.push('LỖI ' + e.stack); }
  out.push({ route: 'duyệt nghỉ & làm thay', title: r.join(' || '), len: 0, errs: [...window.__ERR, ...r.filter((x) => x.startsWith('LỖI'))] });
};
