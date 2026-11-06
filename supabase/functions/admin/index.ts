// Edge Function "admin" – Quản lý tài khoản đăng nhập (cần quyền cao của máy chủ Supabase).
// Dán toàn bộ file này vào Supabase → Edge Functions → Deploy a new function → Via Editor, tên: admin.
// Tắt "Verify JWT" (hàm tự kiểm tra người gọi bên trong).
//
// Hành động: temp_password, bulk, lock, logout, create_account, delete_account
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const EMAIL_DOMAIN = "milano.invalid"; // đuôi .invalid: không bao giờ nhận được thư thật
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // bỏ ký tự dễ nhầm l, 1, o, 0, i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function fail(message: string, status = 400) {
  return json({ ok: false, message }, status);
}
function tempPassword(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
function vnNow() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}
function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys);
    const first = Object.values(parsed)[0];
    if (typeof first === "string") return first;
  }
  throw new Error("Thiếu khóa máy chủ Supabase.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const apikey = req.headers.get("apikey") || "";
    if (!jwt) return fail("Chưa đăng nhập.", 401);

    // Người gọi: dùng chính hàm app_me() của cơ sở dữ liệu để lấy quyền (giống hệt trang web).
    const asUser = createClient(url, apikey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: me, error: meErr } = await asUser.rpc("app_me");
    if (meErr || !me) return fail("Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.", 401);
    const can = (p: string) => !!me.perms?.[p];
    const isOwner = me.role === "chu";

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const loadAccount = async (id: number) => {
      const { data } = await admin.from("accounts").select("*").eq("id", id).maybeSingle();
      if (data && data.employee_id) {
        const { data: e } = await admin.from("employees").select("code, name, status").eq("id", data.employee_id).maybeSingle();
        (data as any).employees = e;
      }
      return data as any;
    };
    // Lý do không được thao tác (null = được)
    const cannotTouch = (t: any): string | null => {
      if (!t) return "Không tìm thấy tài khoản.";
      if (t.id === me.account_id) return "Không thao tác được trên tài khoản của chính bạn (dùng mục Đổi mật khẩu).";
      if ((t.system_role === "chu" || t.system_role === "ql_tong") && !isOwner)
        return "Chỉ Chủ được thao tác trên tài khoản Chủ / Quản lý tổng.";
      return null;
    };
    const audit = (actionName: string, detail: string) =>
      admin.from("audit_log").insert({ account_id: me.account_id, action: actionName, detail, created_at: vnNow() });

    // Tạo (hoặc cập nhật) người dùng Supabase Auth cho tài khoản, đặt mật khẩu tạm.
    const setPassword = async (t: any, password: string) => {
      let uid = t.auth_user_id as string | null;
      let email = t.auth_email || `a${t.id}@${EMAIL_DOMAIN}`;
      if (uid) {
        const { error } = await admin.auth.admin.updateUserById(uid, { password });
        if (error) throw new Error(error.message);
      } else {
        let { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error && /email/i.test(error.message) && email.endsWith(EMAIL_DOMAIN)) {
          // Dự phòng nếu Supabase không nhận đuôi .invalid: example.com cũng là tên miền dành riêng, không nhận thư.
          email = `a${t.id}@example.com`;
          ({ data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true }));
        }
        if (error) throw new Error(error.message);
        uid = data.user!.id;
      }
      const { error: upErr } = await admin
        .from("accounts")
        .update({
          auth_user_id: uid, auth_email: email, has_password: 1, must_change: 1,
          password_set_at: vnNow(), password_set_by: me.account_id,
        })
        .eq("id", t.id);
      if (upErr) throw new Error(upErr.message);
      await admin.rpc("app_kill_sessions", { p_uid: uid });
    };

    if (action === "temp_password") {
      if (!can("quan_ly_nhan_vien")) return fail("Bạn không có quyền cấp mật khẩu.", 403);
      const t = await loadAccount(Number(body.account_id));
      const why = cannotTouch(t);
      if (why) return fail(why, 403);
      if (t.employees && t.employees.status !== "Đang làm") return fail("Nhân viên đã ngừng làm, tài khoản đang bị khóa.");
      const pw = tempPassword();
      await setPassword(t, pw);
      await audit("cap_mat_khau_tam", `account=${t.id}`);
      return json({ ok: true, password: pw, login: t.employees?.code || t.login_name, name: t.employees?.name || t.display_name });
    }

    if (action === "bulk") {
      if (!can("quan_ly_nhan_vien")) return fail("Bạn không có quyền cấp mật khẩu.", 403);
      const includeTemp = body.scope === "chua_doi";
      const { data: accs, error } = await admin.from("accounts").select("*").eq("locked", 0).not("employee_id", "is", null);
      if (error) return fail(error.message);
      const { data: emps } = await admin.from("employees").select("id, code, name, status").eq("status", "Đang làm");
      const byId = new Map((emps || []).map((e: any) => [e.id, e]));
      const rows = (accs || []).filter((a: any) => byId.has(a.employee_id)).map((a: any) => ({ ...a, employees: byId.get(a.employee_id) }));
      const targets = rows.filter((r: any) =>
        (r.has_password === 0 || (includeTemp && r.must_change === 1)) && !cannotTouch(r));
      const out = [];
      for (const t of targets) {
        const pw = tempPassword();
        await setPassword(t, pw);
        out.push({ login: t.employees.code, name: t.employees.name, password: pw });
      }
      out.sort((a, b) => a.name.localeCompare(b.name, "vi"));
      await audit("cap_mat_khau_hang_loat", `n=${out.length}`);
      return json({ ok: true, rows: out });
    }

    if (action === "lock") {
      if (!can("quan_ly_nhan_vien")) return fail("Bạn không có quyền.", 403);
      const t = await loadAccount(Number(body.account_id));
      const why = cannotTouch(t);
      if (why) return fail(why, 403);
      const locked = t.locked ? 0 : 1;
      await admin.from("accounts").update({ locked }).eq("id", t.id);
      if (t.auth_user_id) {
        await admin.auth.admin.updateUserById(t.auth_user_id, { ban_duration: locked ? "876000h" : "none" });
        if (locked) await admin.rpc("app_kill_sessions", { p_uid: t.auth_user_id });
      }
      await audit(locked ? "khoa_tai_khoan" : "mo_khoa_tai_khoan", `account=${t.id}`);
      return json({ ok: true, locked: !!locked });
    }

    if (action === "logout") {
      if (!can("quan_ly_nhan_vien")) return fail("Bạn không có quyền.", 403);
      const t = await loadAccount(Number(body.account_id));
      const why = cannotTouch(t);
      if (why) return fail(why, 403);
      if (t.auth_user_id) {
        const { data: killed, error: kErr } = await admin.rpc("app_kill_sessions", { p_uid: t.auth_user_id });
        if (kErr || killed === false) return fail("Supabase không cho phép xóa phiên đăng nhập. Hãy dùng Khóa rồi Mở khóa tài khoản.");
      }
      await audit("dang_xuat_moi_thiet_bi", `account=${t.id}`);
      return json({ ok: true });
    }

    if (action === "create_account") {
      if (!can("phan_quyen")) return fail("Chỉ Chủ được tạo tài khoản riêng.", 403);
      const login = String(body.login || "").trim();
      const name = String(body.name || "").trim();
      const role = String(body.role || "ql");
      if (!/^[A-Za-z0-9._-]{3,30}$/.test(login))
        return fail("Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.");
      if (!name || name.length > 60) return fail("Hãy nhập tên hiển thị (tối đa 60 ký tự).");
      if (!["chu", "ql_tong", "ql"].includes(role)) return fail("Vai trò không hợp lệ.");
      const { data: clash1 } = await admin.from("accounts").select("id").ilike("login_name", login).limit(1);
      const { data: clash2 } = await admin.from("employees").select("id").ilike("code", login).limit(1);
      if ((clash1 && clash1.length) || (clash2 && clash2.length))
        return fail("Tên đăng nhập đã trùng với một tài khoản hoặc mã nhân viên khác.");
      const { data: acc, error } = await admin
        .from("accounts")
        .insert({ login_name: login, display_name: name, system_role: role })
        .select()
        .single();
      if (error) return fail(error.message);
      const pw = tempPassword();
      await setPassword(acc, pw);
      await audit("tao_tai_khoan", `${login}:${role}`);
      return json({ ok: true, password: pw, login, name });
    }

    if (action === "delete_account") {
      if (!can("phan_quyen")) return fail("Chỉ Chủ được xóa tài khoản.", 403);
      const t = await loadAccount(Number(body.account_id));
      if (!t) return fail("Không tìm thấy tài khoản.");
      if (t.employee_id || t.employee_code) return fail("Tài khoản của nhân viên không xóa được; hãy khóa tài khoản.");
      if (t.id === me.account_id) return fail("Không xóa được tài khoản của chính bạn.");
      if (t.system_role === "chu") {
        const { count } = await admin.from("accounts").select("id", { count: "exact", head: true }).eq("system_role", "chu");
        if ((count || 0) <= 1) return fail("Phải còn ít nhất một tài khoản Chủ.");
      }
      if (t.auth_user_id) await admin.auth.admin.deleteUser(t.auth_user_id);
      await admin.from("accounts").delete().eq("id", t.id);
      await audit("xoa_tai_khoan", t.login_name || String(t.id));
      return json({ ok: true });
    }

    return fail("Hành động không hợp lệ.");
  } catch (e) {
    return fail(String((e as Error)?.message || e), 500);
  }
});
