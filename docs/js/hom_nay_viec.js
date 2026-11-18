// Việc hôm nay (bước 138, chia nhóm bước 142): gom việc của người đăng nhập từ các hồ sơ có sẵn, xếp quá hạn → hôm nay → sắp tới → khác → đang chờ.
// Bước 142: mỗi việc gắn thêm nhóm (cat: vh Vận hành / ns Nhân sự / kh Khác), nhãn, loại gộp, người làm, trạng thái kiểm tra.
// Hàm thuần (không gọi máy chủ, không chạm trang) để thử bằng jsc; các hàm của Công việc truyền vào qua `helpers`.

export const GROUP_LABEL = { late: 'Quá hạn', today: 'Hạn hôm nay', soon: 'Sắp đến hạn', later: 'Khác', waiting: 'Đang chờ' };
export const ORDER = ['late', 'today', 'soon', 'later', 'waiting'];
// Luật nhóm (anh Tiến chốt 18/11): tiền, chốt ca, hàng hoá, số dư ngân hàng → Vận hành; nghỉ & làm thay, đào tạo, nội quy, cam kết → Nhân sự; còn lại → Khác.
const JOB_TAG = { 1: 'Chốt ca', 2: 'Chốt ca', 3: 'Chốt ca', 4: 'Ngân hàng', 7: 'Tiền', 8: 'Tiền', 10: 'Tiền', 11: 'Hàng hoá', 12: 'Hàng hoá', 13: 'Hàng hoá', 14: 'Hàng hoá' };
const TODO_RULE = { cho_doi_soat: ['vh', 'Chốt ca'], dang_sua: ['vh', 'Chốt ca'], qua_ngay: ['vh', 'Chốt ca'], thieu_fabi: ['vh', 'Chốt ca'],
  thu_chi: ['vh', 'Tiền'], mon: ['vh', 'Tiền'], phieu_rut: ['vh', 'Tiền'], thieu_nh: ['vh', 'Ngân hàng'],
  nghi_thay: ['ns', 'Nghỉ & làm thay'], chu_duyet: ['ns', 'Nghỉ & làm thay'] };
export const jobCat = (job, name) => (JOB_TAG[job] ? { cat: 'vh', tag: JOB_TAG[job] } : { cat: 'kh', tag: name || '' });
export const todoCat = (key) => { const r = TODO_RULE[key]; return r ? { cat: r[0], tag: r[1] } : { cat: 'kh', tag: '' }; };
const STAGE = { chua_gioi_thieu: 'Chưa giới thiệu', da_gioi_thieu: 'Đã giới thiệu, chưa thực hành có giám sát', da_thuc_hanh: 'Đã thực hành có giám sát, chờ chấm mức', giai_doan_2: 'Giai đoạn 2' };
const LEVEL = { tb: 'Trung bình', kha: 'Khá', tot: 'Tốt' };
const YOU = { text: 'Bạn', mine: true, none: false };
const short = (s) => String(s || '').replace(/^[^–]*–\s*/, '');
// danh sách người (id, tên) → nhãn người làm; có mình thì ghi "Bạn" đứng đầu
function whoOf(ids, names, me, many = '') {
  const list = (ids || []).map((id, i) => ({ id, name: id === me ? 'Bạn' : short((names || [])[i]) }));
  list.sort((a, b) => (b.id === me) - (a.id === me));
  if (!list.length) return { text: 'Chưa có người nhận', mine: false, none: true };
  return { text: list.map((x) => x.name).join(' + ') + (list.length > 1 ? many : ''), mine: list.some((x) => x.id === me), none: false };
}
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

// src: { now, pc, training, ka, todo, today, more } — nguồn nào lỗi thì truyền null (today = app_today_me, more = app_today_more).
// helpers: { jobName, pcDue, gvDue, rstate, curStep } từ cv_chung.js.
export function collectWork({ now, pc, training, ka, todo, today, more }, helpers) {
  const items = [];
  const seen = new Set();
  const me = pc?.me ?? null;
  const add = (it) => { if (seen.has(it.key)) return; seen.add(it.key);
    items.push({ waitingFor: null, sub: '', cat: 'kh', tag: '', kind: null, kindLabel: '', who: YOU, gap: false, review: false, redo: null, ...it }); };

  for (const t of pc?.tasks || []) {
    const name = helpers.jobName(t.job); const step = helpers.curStep ? helpers.curStep(t) : null;
    add({ key: 'pc:' + t.id, title: name + (t.code ? ' · ' + t.code : ''), due: helpers.pcDue(t), link: '/viec', ...jobCat(t.job, name),
      kind: 'pc:' + t.job, kindLabel: name, who: step ? whoOf(step.accounts, step.names, me, ' (ai làm trước cũng được)') : YOU });
  }
  // Giao việc riêng (cả việc sinh từ Bàn giao ca). sent = việc mình đã báo xong (app_today_more), luôn là đang chờ.
  const addGv = (k, sent) => {
    const st = helpers.rstate(k);
    const review = st === 3 && me != null && k.reviewer_id === me;
    const waiting = sent || (st === 3 && me != null && k.reviewer_id != null && k.reviewer_id !== me);
    const reviewer = short(k.reviewer);
    const who = st === 0 ? whoOf((k.classifiers || []).map((c) => c.id), (k.classifiers || []).map((c) => c.name), me)
      : review ? whoOf([k.assignee_id], [k.assignee], me) : (k.assignee_id === me || sent) ? YOU : whoOf([k.assignee_id].filter((x) => x != null), [k.assignee], me);
    add({ key: 'gv:' + k.id, title: (k.content || helpers.jobName(24)) + (k.code ? ' · ' + k.code : ''), due: helpers.gvDue(k), link: '/viec',
      sub: k.handover ? (k.src || 'Bàn giao ca') : '',
      cat: k.handover ? 'vh' : 'kh', tag: k.handover ? 'Bàn giao ca' : 'Giao việc riêng', kind: k.handover ? 'bgc' : null, kindLabel: k.handover ? 'Bàn giao ca' : '',
      who, gap: k.priority === 'gap', review, redo: st === 2 && k.review_note ? k.review_note : null,
      waitingFor: waiting ? (reviewer ? reviewer + ' kiểm tra' : 'Người kiểm tra') : null });
  };
  for (const k of pc?.gv || []) addGv(k, false);
  for (const k of more?.review_wait || []) addGv(k, true);
  for (const t of training?.rows || []) {
    const reviewer = (t.my_duties || []).includes('Kiểm tra và nhận xét');
    add({ key: 'dt:' + t.id, title: 'Đào tạo · ' + t.employee, sub: (t.my_duties || []).join(' · '),
      due: t.due ? t.due + ' 23:59:59' : null, link: '/dao-tao/phieu?id=' + t.id, cat: 'ns', tag: 'Đào tạo', kind: 'dt', kindLabel: 'Phiếu đào tạo',
      waitingFor: t.status === 'cho_nhan_xet' && !reviewer ? 'Người nhận xét cuối' : null });
  }
  for (const f of more?.followups || []) {
    add({ key: `dtf:${f.training_id}:${f.item_no}`, title: short(f.employee) + ' · ' + (f.item || 'Hạng mục ' + f.item_no),
      sub: (STAGE[f.stage] || '') + (f.stage === 'giai_doan_2' && f.level ? ' · đang ở mức ' + (LEVEL[f.level] || f.level) : ''),
      due: f.due ? f.due + ' 23:59:59' : null, link: '/dao-tao/phieu?id=' + f.training_id, cat: 'ns', tag: 'Đào tạo', kind: 'dtf',
      kindLabel: 'Đào tạo đã giao người hướng dẫn', who: { text: f.instructor || 'Chưa có người nhận', mine: false, none: !f.instructor } });
  }
  for (const k of ka || []) {
    const canReply = k.status === 'chua_xu_ly' || k.auto_tru;
    if (!canReply) continue;
    const isNew = !k.seen_at && !k.reply;
    const waiting = !!k.reply && k.status === 'chua_xu_ly';
    if (!isNew && !waiting) continue;
    add({ key: 'ka:' + k.id, title: `Khoản âm ca ${k.shift} ${k.branch} · ${dm(k.work_date)}`,
      sub: isNew ? 'Xem và giải trình nếu không đồng ý' : 'Đã gửi giải trình', due: null, link: '/cua-toi/khoan-am',
      cat: 'vh', tag: 'Tiền', kind: 'ka', kindLabel: 'Khoản âm',
      waitingFor: waiting ? 'Quản lý xem giải trình' : null });
  }
  // bước 141: đọc Nội quy (gộp 1 dòng), ký Cam kết, theo dõi của Kế toán — từ app_today_me
  const end = (d) => (d ? d + ' 23:59:59' : null);
  if (today?.rules) {
    const r = today.rules;
    add({ key: 'nq', title: 'Đọc nội quy', sub: `Đã đọc ${r.read}/${r.total} bài`, due: end(r.due), link: '/noi-quy?id=' + r.first_unread, cat: 'ns', tag: 'Nội quy' });
  }
  if (today?.commit) {
    add({ key: 'ck', title: 'Ký cam kết', sub: `${COMMIT_LABEL[today.commit.status] || 'Chưa ký'} · ký bản giấy và nộp cho Kế toán`, due: end(today.commit.due), link: '/noi-quy', cat: 'ns', tag: 'Cam kết' });
  }
  for (const d of today?.follow?.rules || []) {
    add({ key: `nqf:${d.doc_id}:${d.version}`, title: 'Nhắc đọc nội quy: ' + d.title, sub: `${d.unread} người chưa đọc bản ${d.version}`,
      due: end(d.due), link: '/theo-doi-noi-quy?loc=chua_doc', cat: 'ns', tag: 'Nội quy', kind: 'nqf', kindLabel: 'Nhắc đọc nội quy' });
  }
  const fc = today?.follow?.commit;
  if (fc && Number(fc.pending) > 0) {
    add({ key: 'ckf', title: 'Theo dõi cam kết', sub: `${fc.pending} nhân viên chưa ký và nộp${Number(fc.overdue) ? ` · ${fc.overdue} quá hạn` : ''}`,
      due: end(fc.due), link: '/theo-doi-noi-quy?loc=chua_ky', cat: 'ns', tag: 'Cam kết' });
  }
  for (const x of todo || []) {
    if (x.key === 'cong_viec_cua_toi' || !(Number(x.n) > 0)) continue;
    add({ key: 'todo:' + x.key, title: x.label, sub: `${x.n} hồ sơ`, due: null, link: x.link, ...todoCat(x.key) });
  }

  for (const it of items) it.group = groupOf(it, now);
  items.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group)
    || (ms(a.due) || Infinity) - (ms(b.due) || Infinity));
  return { items, failed: pc == null && training == null && ka == null && todo == null && today == null, failedMore: more == null };
}
