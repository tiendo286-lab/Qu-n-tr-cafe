// Edge Function "ai-so-lieu" — cầu nối CHỈ ĐỌC số liệu Milano cho các phòng Công ty AI chat trong ứng dụng Claude (tệp 184).
// Giao thức MCP kiểu hỏi – đáp từng yêu cầu. Triển khai với "Verify JWT" TẮT: hàm tự kiểm khoá riêng ở tiêu đề
// Authorization: Bearer <khoá>. Trong mã chỉ có mã băm SHA-256 của khoá (khoá thật ở máy anh Tiến và trong ứng dụng Claude).
// Không có công cụ ghi, không nhận SQL tự do: mỗi công cụ gọi đúng một hàm app__sl_* cố định.
const BAM = "5bd80273763dc14ca602b8cfc4058e39790b9a18b4268d6181017419c271202f";
const URL_SB = Deno.env.get("SUPABASE_URL") ?? "";
const KHOA_SB = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const NGAY = { type: "string", description: "Ngày dạng YYYY-MM-DD", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const QUAN = { type: "string", enum: ["LHP", "ĐK", "HS", "LL", "LLB"], description: "Mã quán; bỏ trống = mọi quán" };
const TOOLS = [
  { name: "doanh_thu", rpc: "app__sl_doanh_thu", description: "Doanh thu NET theo Fabi, từng ngày từng quán và tổng theo quán. Tối đa 62 ngày. Chỉ đọc.",
    inputSchema: { type: "object", properties: { tu: NGAY, den: NGAY }, required: ["tu", "den"] } },
  { name: "lich_ca", rpc: "app__sl_lich_ca", description: "Lịch ca đã xếp trên web Milano: ngày, quán, ca, mã và tên nhân viên. Tối đa 45 ngày. Chỉ đọc.",
    inputSchema: { type: "object", properties: { tu: NGAY, den: NGAY, quan: QUAN }, required: ["tu", "den"] } },
  { name: "nhan_vien", rpc: "app__sl_nhan_vien", description: "Danh sách nhân viên đang làm: mã, tên, bậc, vị trí, ngày vào. Không có lương. Chỉ đọc.",
    inputSchema: { type: "object", properties: {} } },
  { name: "giao_hang", rpc: "app__sl_giao_hang", description: "Hàng kho tổng giao cho quán: từng hoá đơn và tổng theo quán + mặt hàng. Tối đa 62 ngày. Chỉ đọc.",
    inputSchema: { type: "object", properties: { tu: NGAY, den: NGAY, quan: QUAN }, required: ["tu", "den"] } },
];
const sha = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const tra = (id: unknown, result: unknown) => json({ jsonrpc: "2.0", id, result });
const chu = (id: unknown, text: string, isError = false) => tra(id, { content: [{ type: "text", text }], isError });

Deno.serve(async (req) => {
  const khoa = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!khoa || (await sha(khoa)) !== BAM) return new Response("Không được phép", { status: 401 });
  if (req.method !== "POST") return new Response("Chỉ nhận POST", { status: 405, headers: { allow: "POST" } });
  let m: any;
  try { m = await req.json(); } catch { return new Response("Sai định dạng", { status: 400 }); }
  if (!m || typeof m !== "object" || Array.isArray(m)) return new Response("Sai định dạng", { status: 400 });
  if (m.id === undefined) return new Response(null, { status: 202 });
  if (m.method === "initialize") {
    return tra(m.id, { protocolVersion: m.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} },
      serverInfo: { name: "milano-so-lieu", version: "1.0.0" },
      instructions: "Số liệu Milano & Lela, chỉ đọc. Không có số thì nói chưa có, không tự bịa, không ghi 0." });
  }
  if (m.method === "ping") return tra(m.id, {});
  if (m.method === "tools/list") return tra(m.id, { tools: TOOLS.map(({ rpc: _r, ...t }) => t) });
  if (m.method === "tools/call") {
    const t = TOOLS.find((x) => x.name === m.params?.name);
    if (!t) return chu(m.id, "Không có công cụ này.", true);
    const a = m.params?.arguments || {};
    const body: Record<string, unknown> = {};
    if ("tu" in t.inputSchema.properties) { body.p_tu = String(a.tu ?? ""); body.p_den = String(a.den ?? ""); }
    if ("quan" in t.inputSchema.properties) body.p_quan = a.quan ? String(a.quan) : null;
    const r = await fetch(URL_SB + "/rest/v1/rpc/" + t.rpc, { method: "POST",
      headers: { apikey: KHOA_SB, authorization: "Bearer " + KHOA_SB, "content-type": "application/json" }, body: JSON.stringify(body) });
    const txt = await r.text();
    console.log("SO_LIEU", JSON.stringify({ cong_cu: t.name, ok: r.ok, dai: txt.length }));
    if (!r.ok) {
      let msg = "Không đọc được số liệu.";
      try { msg = JSON.parse(txt).message || msg; } catch { /* giữ câu chung */ }
      return chu(m.id, msg, true);
    }
    return chu(m.id, txt);
  }
  return json({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Không có lệnh này" } });
});
