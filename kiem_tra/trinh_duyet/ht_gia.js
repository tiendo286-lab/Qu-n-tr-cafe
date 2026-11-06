// Giả lập app_ht_* (Yêu cầu hỗ trợ). Có sẵn 1 yêu cầu của nhân viên (tài khoản 3) với 1 trả lời của quản lý.
export function makeHt(T, me) {
  const now = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  T.support_requests = [{ id: 1, account_id: 3, title: 'Máy POS bị treo', status: 'mo', created_at: now(), last_message_at: now() }];
  T.support_messages = [{ id: 1, request_id: 1, account_id: 3, body: 'Máy POS LHP treo từ 9h', created_at: now() }, { id: 2, request_id: 1, account_id: 1, body: 'Em khởi động lại máy nhé', created_at: now() }];
  T.support_reads = [];
  const mgr = me.role !== 'nv';
  const name = (id) => (id === me.account_id ? `${me.code} – ${me.name}` : id === 1 ? 'admin – Chủ' : id === 3 ? 'NV3 – Nhân viên thử' : 'TK ' + id);
  const req = (id) => { const r = T.support_requests.find((x) => x.id === id); if (!r) throw new Error('Không tìm thấy yêu cầu hỗ trợ.'); if (!mgr && r.account_id !== me.account_id) throw new Error('Bạn chỉ xem được yêu cầu của chính mình.'); return r; };
  const lastRead = (rid) => T.support_reads.find((x) => x.request_id === rid && x.account_id === me.account_id)?.last ?? 0;
  const unread = (r) => T.support_messages.filter((m) => m.request_id === r.id && m.account_id !== me.account_id && m.id > lastRead(r.id)).length;
  const read = (r) => { T.support_reads = T.support_reads.filter((x) => !(x.request_id === r.id && x.account_id === me.account_id)); T.support_reads.push({ request_id: r.id, account_id: me.account_id, last: Math.max(0, ...T.support_messages.map((m) => m.id)) }); };
  const nid = (t) => Math.max(0, ...T[t].map((x) => x.id)) + 1;
  return {
    app_ht_list: () => T.support_requests.filter((r) => mgr || r.account_id === me.account_id).map((r) => {
      const ms = T.support_messages.filter((m) => m.request_id === r.id); const l = ms.at(-1);
      return { ...r, mine: r.account_id === me.account_id, from: name(r.account_id), messages: ms.length, last: l ? { body: l.body, by: name(l.account_id) } : null, unread: unread(r) };
    }),
    app_ht_unread: () => T.support_requests.filter((r) => (mgr || r.account_id === me.account_id) && unread(r)).length,
    app_ht_create({ p_title, p_body }) {
      if (!p_title?.trim()) throw new Error('Nhập tiêu đề yêu cầu.'); if (!p_body?.trim()) throw new Error('Nhập nội dung cần hỗ trợ.');
      const id = nid('support_requests'); T.support_requests.push({ id, account_id: me.account_id, title: p_title, status: 'mo', created_at: now(), last_message_at: now() });
      T.support_messages.push({ id: nid('support_messages'), request_id: id, account_id: me.account_id, body: p_body, created_at: now() }); read({ id }); return id;
    },
    app_ht_get({ p_id }) {
      const r = req(p_id); read(r);
      return { ...r, from: name(r.account_id), mine: r.account_id === me.account_id, is_manager: mgr,
        messages: T.support_messages.filter((m) => m.request_id === r.id).map((m) => ({ ...m, at: m.created_at, by: name(m.account_id), me: m.account_id === me.account_id, from_requester: m.account_id === r.account_id })) };
    },
    app_ht_send({ p_id, p_body }) { const r = req(p_id); if (!p_body?.trim()) throw new Error('Nhập nội dung tin nhắn.'); T.support_messages.push({ id: nid('support_messages'), request_id: r.id, account_id: me.account_id, body: p_body, created_at: now() }); r.status = 'mo'; r.last_message_at = now(); read(r); },
    app_ht_status({ p_id, p_done }) { const r = req(p_id); Object.assign(r, { status: p_done ? 'da_xong' : 'mo', closed_at: p_done ? now() : null, closed_by: p_done ? me.account_id : null }); },
  };
}
