// Edge Function "ai-thong-bao" – gửi thông báo Web Push về điện thoại anh Tiến cho trang Công ty AI (tệp 178).
// Triển khai: Supabase → Edge Functions → Deploy a new function → Via Editor, tên: ai-thong-bao. TẮT "Verify JWT"
// (hàm tự kiểm tra bí mật riêng ở header x-ai-bi-mat; chỉ Postgres của dự án gọi qua pg_net).
// Bí mật cần đặt (Edge Functions → Secrets): AI_BI_MAT (trùng ai_cai_dat.edge_bi_mat), VAPID_PUBLIC, VAPID_PRIVATE,
// VAPID_SUBJECT (dạng mailto:...). Không ghi các giá trị này vào mã.
//
// Đầu vào (POST JSON): { subs: [{endpoint, p256dh, auth}], tieu_de, noi_dung, url }  →  { gui, loi }
import webpush from "npm:web-push@3.6.7";

const BI_MAT = Deno.env.get("AI_BI_MAT") ?? "";
const PUB = Deno.env.get("VAPID_PUBLIC") ?? "";
const PRIV = Deno.env.get("VAPID_PRIVATE") ?? "";
const SUBJ = Deno.env.get("VAPID_SUBJECT") ?? "";
if (PUB && PRIV && SUBJ) webpush.setVapidDetails(SUBJ, PUB, PRIV);

function bang_nhau(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let k = 0;
  for (let i = 0; i < a.length; i++) k |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return k === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Chỉ nhận POST", { status: 405 });
  if (!BI_MAT || !bang_nhau(req.headers.get("x-ai-bi-mat") ?? "", BI_MAT)) return new Response("Sai bí mật", { status: 401 });
  if (!PUB || !PRIV || !SUBJ) return new Response("Chưa đặt khoá VAPID", { status: 500 });
  let d: { subs?: { endpoint: string; p256dh: string; auth: string }[]; tieu_de?: string; noi_dung?: string; url?: string };
  try { d = await req.json(); } catch { return new Response("Sai dữ liệu", { status: 400 }); }
  const payload = JSON.stringify({ tieu_de: d.tieu_de ?? "Công ty AI", noi_dung: d.noi_dung ?? "", url: d.url ?? "#trang-dau" });
  let gui = 0, loi = 0;
  await Promise.all((d.subs ?? []).slice(0, 20).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      gui++;
    } catch (_e) {
      loi++;
    }
  }));
  return Response.json({ gui, loi });
});
