// Việc hôm nay (bước 138): gom việc của người đăng nhập từ các hồ sơ có sẵn, xếp quá hạn → hôm nay → sắp tới → khác → đang chờ.
// Hàm thuần (không gọi máy chủ, không chạm trang) để thử bằng jsc; các hàm của Công việc truyền vào qua `helpers`.

export const GROUP_LABEL = { late: 'Quá hạn', today: 'Hạn hôm nay', soon: 'Sắp đến hạn', later: 'Khác', waiting: 'Đang chờ' };
const ORDER = ['late', 'today', 'soon', 'later', 'waiting'];
const COMMIT_LABEL = { chua_ky: 'Chưa ký', da_ky_chua_nop: 'Đã ký, chưa nộp', da_ky_nop: 'Đã ký và nộp' };
const SOON_MS = 3 * 864e5;
const ms = (s) => (s ? Date.parse(String(s).replace(' ', 'T')) : NaN);
const dm = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

function groupOf(item, now) {
  if (item.waitingFor) return 'waiting';
  if (!item.due) return 'later';
  if (ms(item.due) < ms(now)) return 'late';
  if (item.due.slice(0, 10) === now.slice(0, 10)) return 'today';
  return ms(item.due) - ms(now) <= SOON_MS ? 'soon' : 'later';
}

// src: { now, pc, training, ka, todo, today } — nguồn nào lỗi thì truyền null (today = app_today_me).
// helpers: { jobName, pcDue, gvDue, rstate } từ cv_chung.js.
export function collectWork({ now, pc, training, ka, todo, today }, helpers) {
  const items = [];
  const seen = new Set();
  const add = (it) => { if (seen.has(it.key)) return; seen.add(it.key); items.push({ waitingFor: null, sub: '', ...it }); };

  for (const t of pc?.tasks || []) {
    add({ key: 'pc:' + t.id, title: helpers.jobName(t.job) + (t.code ? ' · ' + t.code : ''), due: helpers.pcDue(t), link: '/viec' });
  }
  for (const k of pc?.gv || []) {
    const st = helpers.rstate(k);
    const waiting = st === 3 && pc.me != null && k.reviewer_id != null && k.reviewer_id !== pc.me;
    const reviewer = String(k.reviewer || '').replace(/^[^–]*–\s*/, '');
    add({ key: 'gv:' + k.id, title: (k.content || helpers.jobName(24)) + (k.code ? ' · ' + k.code : ''), due: helpers.gvDue(k), link: '/viec',
      waitingFor: waiting ? (reviewer ? reviewer + ' kiểm tra' : 'Người kiểm tra') : null });
  }
  for (const t of training?.rows || []) {
    const reviewer = (t.my_duties || []).includes('Kiểm tra và nhận xét');
    add({ key: 'dt:' + t.id, title: 'Đào tạo · ' + t.employee, sub: (t.my_duties || []).join(' · '),
      due: t.due ? t.due + ' 23:59:59' : null, link: '/dao-tao/phieu?id=' + t.id,
      waitingFor: t.status === 'cho_nhan_xet' && !reviewer ? 'Người nhận xét cuối' : null });
  }
  for (const k of ka || []) {
    const canReply = k.status === 'chua_xu_ly' || k.auto_tru;
    if (!canReply) continue;
    const isNew = !k.seen_at && !k.reply;
    const waiting = !!k.reply && k.status === 'chua_xu_ly';
    if (!isNew && !waiting) continue;
    add({ key: 'ka:' + k.id, title: `Khoản âm ca ${k.shift} ${k.branch} · ${dm(k.work_date)}`,
      sub: isNew ? 'Xem và giải trình nếu không đồng ý' : 'Đã gửi giải trình', due: null, link: '/cua-toi/khoan-am',
      waitingFor: waiting ? 'Quản lý xem giải trình' : null });
  }
  // bước 141: đọc Nội quy (gộp 1 dòng), ký Cam kết, theo dõi của Kế toán — từ app_today_me
  const end = (d) => (d ? d + ' 23:59:59' : null);
  if (today?.rules) {
    const r = today.rules;
    add({ key: 'nq', title: 'Đọc nội quy', sub: `Đã đọc ${r.read}/${r.total} bài`, due: end(r.due), link: '/noi-quy?id=' + r.first_unread });
  }
  if (today?.commit) {
    add({ key: 'ck', title: 'Ký cam kết', sub: `${COMMIT_LABEL[today.commit.status] || 'Chưa ký'} · ký bản giấy và nộp cho Kế toán`, due: end(today.commit.due), link: '/noi-quy' });
  }
  for (const d of today?.follow?.rules || []) {
    add({ key: `nqf:${d.doc_id}:${d.version}`, title: 'Nhắc đọc nội quy: ' + d.title, sub: `${d.unread} người chưa đọc bản ${d.version}`,
      due: end(d.due), link: '/theo-doi-noi-quy?loc=chua_doc' });
  }
  const fc = today?.follow?.commit;
  if (fc && Number(fc.pending) > 0) {
    add({ key: 'ckf', title: 'Theo dõi cam kết', sub: `${fc.pending} nhân viên chưa ký và nộp${Number(fc.overdue) ? ` · ${fc.overdue} quá hạn` : ''}`,
      due: end(fc.due), link: '/theo-doi-noi-quy?loc=chua_ky' });
  }
  for (const x of todo || []) {
    if (x.key === 'cong_viec_cua_toi' || !(Number(x.n) > 0)) continue;
    add({ key: 'todo:' + x.key, title: x.label, sub: `${x.n} hồ sơ`, due: null, link: x.link });
  }

  for (const it of items) it.group = groupOf(it, now);
  items.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group)
    || (ms(a.due) || Infinity) - (ms(b.due) || Infinity));
  return { items, failed: pc == null && training == null && ka == null && todo == null && today == null };
}
