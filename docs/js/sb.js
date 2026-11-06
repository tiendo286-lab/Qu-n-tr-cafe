// Kết nối Supabase. Project URL và Publishable key được phép công khai (đặt trong trang web là bình thường).
// Quyền thật sự được kiểm tra trong cơ sở dữ liệu (RLS + hàm kiểm tra quyền).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const SUPABASE_URL = 'https://krndtaskjhjpnqauoqiw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_PCwfHHqV2_5AmzU72B1Gdw_pb2BXBkf';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'milano-lich-lam' },
});

// Lỗi tiếng Anh từ Supabase → tiếng Việt dễ hiểu
export function viError(err) {
  const m = String(err?.message || err || '');
  if (/Invalid login credentials/i.test(m)) return 'Mã nhân viên hoặc mật khẩu không đúng.';
  if (/JWT|not authenticated|permission denied/i.test(m)) return 'Phiên đăng nhập đã hết hoặc bạn không có quyền. Hãy tải lại trang.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  if (/Password should be at least/i.test(m)) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (/same.*password|different from the old/i.test(m)) return 'Mật khẩu mới phải khác mật khẩu cũ.';
  if (/banned/i.test(m)) return 'Tài khoản đang bị khóa. Hãy liên hệ quản lý.';
  return m || 'Có lỗi xảy ra.';
}

export async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(viError(error));
  return data;
}

// Đọc bảng; ném lỗi tiếng Việt nếu có. q: (builder) => builder
export async function sel(table, cols = '*', q = (b) => b) {
  const { data, error } = await q(sb.from(table).select(cols));
  if (error) throw new Error(viError(error));
  return data || [];
}

// Đọc hết (vượt giới hạn 1000 dòng/lần của Supabase)
export async function selAll(table, cols = '*', q = (b) => b, page = 1000) {
  let out = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await q(sb.from(table).select(cols)).range(from, from + page - 1);
    if (error) throw new Error(viError(error));
    out = out.concat(data || []);
    if (!data || data.length < page) break;
  }
  return out;
}

// Gọi Edge Function "admin" (cấp mật khẩu, khóa tài khoản...)
export async function adminFn(action, payload = {}) {
  const { data, error } = await sb.functions.invoke('admin', { body: { action, ...payload } });
  if (error) {
    let msg = error.message;
    try { const body = await error.context.json(); msg = body.message || msg; } catch (_) { /* không phải JSON */ }
    if (/Failed to send a request|Function not found|404/i.test(msg)) {
      msg = 'Chưa cài hàm “admin” trên Supabase (Edge Functions). Xem hướng dẫn cài đặt.';
    }
    throw new Error(viError(msg));
  }
  if (data && data.ok === false) throw new Error(data.message);
  return data;
}
