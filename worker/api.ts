// =============================================================================
// API máy chủ ManagerCAL (Cloudflare Worker + D1).
//
//   GET  /api/health                 trạng thái, đã khởi tạo chưa
//   POST /api/setup                  khởi tạo lần đầu (chỉ khi chưa có người dùng)
//   POST /api/login | /api/logout    đăng nhập bằng email + mật khẩu, cookie HttpOnly
//   GET  /api/me                     hồ sơ người đang đăng nhập
//   POST /api/password               đổi mật khẩu của mình / đặt mật khẩu cho người khác (quyền "users")
//   GET  /api/data/:table[?q=json]   đọc danh sách (lọc where, orderBy, limit)
//   GET  /api/data/:table/:id        đọc một bản ghi
//   POST /api/notifications/read     đánh dấu thông báo của mình đã đọc
//   POST /api/rpc                    gọi một thao tác nghiệp vụ (Services) – kiểm tra quyền trên máy chủ
//   GET  /api/lookup/:number         tra cứu GCN công khai (không cần đăng nhập)
//   GET  /api/backup | POST /api/restore   sao lưu / khôi phục toàn bộ (quản trị)
//   GET  /api/ws                     WebSocket: đồng bộ ngay khi người khác thao tác, ai đang online
//   GET|POST /api/admin/email[/test] cấu hình email thông báo (quản trị; khoá API chỉ ghi, không đọc lại)
//   GET  /api/admin/storage          dung lượng dữ liệu theo bảng, tốc độ tăng (quản trị)
// =============================================================================
import { Services } from "../src/lib/services";
import { isRemoteMethod } from "../src/lib/services/rpc";
import { can } from "../src/lib/perm";
import { AppError, newId, nowIso } from "../src/lib/store/repo";
import type { Query } from "../src/lib/store/repo";
import { DEFAULT_SETTINGS, FIELDS, INSTRUMENT_TYPES, PROCEDURES } from "../src/lib/seed/catalog";
import { seedDemo } from "../src/lib/seed/demo";
import type { Notification, Row, TableName, User } from "../src/lib/types";
import {
  DEFAULT_ITERATIONS, SESSION_COOKIE, checkPassword, clearFailures, createSession, deleteSession, isLocked, passwordStatement, readCookie,
  recordFailure, sessionCookie, sessionUserId, sha256, validatePassword,
} from "./auth";
import type { D1Database } from "./d1";
import { D1Repo } from "./d1repo";
import { EmailError, loadEmailConfig, notificationMail, publicEmailConfig, saveEmailConfig, sendEmail, type EmailConfig, type EmailEnv } from "./email";
import type { DurableObjectNamespace, HubMessage } from "./hub";

export interface Env extends EmailEnv { DB: D1Database; PBKDF2_ITERATIONS?: string; HUB?: DurableObjectNamespace }
export interface Ctx { waitUntil(p: Promise<unknown>): void }

const iterations = (env: Env) => {
  const n = Number(env.PBKDF2_ITERATIONS);
  return Number.isInteger(n) && n >= 10_000 && n <= 100_000 ? n : DEFAULT_ITERATIONS;
};

const TABLES: TableName[] = [
  "settings", "branches", "users", "authorizations", "fields", "instrument_types", "procedures", "standards", "customers", "devices",
  "orders", "jobs", "certificates", "seal_batches", "seals", "notifications", "audit_logs",
];
/** Bảng trao đổi nội bộ: không đọc trực tiếp qua /api/data (tin nhắn riêng), chỉ qua các hàm chat của Services */
const CHAT_TABLES: TableName[] = ["chat_channels", "chat_messages", "chat_reads"];
const RESTORE_TABLES: TableName[] = [...TABLES, ...CHAT_TABLES];

/** Gửi một sự kiện tới các trình duyệt đang kết nối (to = chỉ những người này) */
async function broadcast(env: Env, msg: HubMessage, to: string[] | null = null) {
  if (!env.HUB) return;
  try {
    const stub = env.HUB.get(env.HUB.idFromName("company"));
    await stub.fetch("https://hub/broadcast", { method: "POST", body: JSON.stringify({ msg, to }) });
  } catch (e) { console.error("broadcast", e); }
}

/** Chạy nền sau khi đã trả lời (Cloudflare: waitUntil); không có ctx (kiểm thử) thì chạy luôn */
const later = (ctx: Ctx | undefined, p: Promise<unknown>) => (ctx ? ctx.waitUntil(p) : p);

/** Sau một thao tác ghi: báo đồng bộ cho đúng người, gửi email các việc được giao */
async function afterWrite(env: Env, req: Request, me: User, changes: ReturnType<D1Repo["changeSet"]>, repo: D1Repo) {
  const tasks: Promise<unknown>[] = [];
  const cid = req.headers.get("x-client");
  const plain = [...changes.keys()].filter((t) => !CHAT_TABLES.includes(t as TableName));
  if (plain.length) tasks.push(broadcast(env, { t: "changed", tables: plain, by: me.id, cid }));
  const channels = new Set<string>();
  for (const t of ["chat_messages", "chat_channels"]) for (const d of changes.get(t)?.docs ?? []) channels.add(String(t === "chat_messages" ? d.channel : d.id));
  for (const ch of channels) {
    const to = ch.startsWith("dm:") ? ch.slice(3).split(":") : null;
    tasks.push(broadcast(env, { t: "changed", tables: ["chat_channels", "chat_messages", "chat_reads"], by: me.id, channel: ch, cid }, to));
  }
  if (!channels.size && changes.has("chat_reads")) tasks.push(broadcast(env, { t: "changed", tables: ["chat_reads"], by: me.id, cid }, [me.id]));

  const n = changes.get("notifications");
  const mails = (n?.docs ?? []).filter((d) => n!.inserted.has(String(d.id)) && d.email === true && d.user_id) as unknown as Notification[];
  if (mails.length) tasks.push((async () => {
    const cfg = await loadEmailConfig(env);
    if (!cfg?.enabled || !cfg.api_key) return;
    const settings = await repo.get("settings", "1");
    const origin = new URL(req.url).origin;
    for (const m of mails.slice(0, 20)) {
      const u = await repo.get("users", m.user_id!);
      if (!u?.active || !u.email) continue;
      const mail = notificationMail({ company: settings?.company.short_name || settings?.company.name || "", to: u.email, toName: u.full_name, title: m.title, body: m.body, url: `${origin}/#${m.link ?? "/notifications"}` });
      await sendEmail(cfg, mail).catch((e) => console.error("email", u.email, String(e)));
    }
  })());
  await Promise.all(tasks);
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const fail = (code: string, message: string, status = 400, details: unknown = undefined) => json({ error: { code, message, details } }, status);

function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    const status = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : e.code === "UNAUTHENTICATED" ? 401 : 400;
    return fail(e.code, e.message, status, (e as AppError & { details?: unknown }).details);
  }
  console.error(e);
  return fail("SERVER_ERROR", "Lỗi máy chủ. Hãy thử lại sau.", 500);
}

async function readJson<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new AppError("BAD_REQUEST", "Dữ liệu gửi lên không hợp lệ."); }
}

async function countUsers(db: D1Database) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM rows WHERE tbl = 'users'").first<{ n: number }>();
  return r?.n ?? 0;
}

async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const r = await db.prepare("SELECT data FROM rows WHERE tbl = 'users' AND lower(json_extract(data, '$.email')) = lower(?)").bind(email.trim()).first<{ data: string }>();
  return r ? (JSON.parse(r.data) as User) : null;
}

async function currentUser(req: Request, env: Env): Promise<User | null> {
  const uid = await sessionUserId(env.DB, readCookie(req, SESSION_COOKIE));
  if (!uid) return null;
  const r = await env.DB.prepare("SELECT data FROM rows WHERE tbl = 'users' AND id = ?").bind(uid).first<{ data: string }>();
  const u = r ? (JSON.parse(r.data) as User) : null;
  return u && u.active ? u : null;
}

const isSecure = (req: Request) => new URL(req.url).protocol === "https:";

/** Notification có được người này xem không */
const visibleNotification = (n: Notification, me: User) => n.user_id === me.id || n.user_id === null;

export async function handleApi(req: Request, env: Env, ctx?: Ctx): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method;
  try {
    // ------------------------------------------------------------- công khai
    if (path === "/api/health" && method === "GET") {
      return json({ ok: true, mode: "server", needsSetup: (await countUsers(env.DB)) === 0 });
    }

    if (path === "/api/setup" && method === "POST") {
      if ((await countUsers(env.DB)) > 0) throw new AppError("FORBIDDEN", "Hệ thống đã được khởi tạo.");
      const b = await readJson<{ company_name?: string; full_name?: string; email?: string; password?: string; demo?: boolean }>(req);
      const email = (b.email ?? "").trim().toLowerCase();
      const full_name = (b.full_name ?? "").trim();
      if (!full_name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError("BAD_REQUEST", "Cần nhập họ tên và email hợp lệ.");
      const pwErr = validatePassword(b.password);
      if (pwErr) throw new AppError("BAD_REQUEST", pwErr);

      const repo = new D1Repo(env.DB, { assumeEmpty: true });
      let adminId: string;
      const pwUsers: string[] = [];
      if (b.demo) {
        await seedDemo(repo);
        adminId = "u-an";
        await repo.update("users", adminId, { full_name, email });
        if (b.company_name?.trim()) {
          const s = (await repo.get("settings", "1"))!;
          await repo.update("settings", "1", { company: { ...s.company, name: b.company_name.trim() } });
        }
        for (const u of await repo.list("users")) pwUsers.push(u.id);
      } else {
        const t = nowIso();
        await repo.insert("settings", { ...DEFAULT_SETTINGS, company: { ...DEFAULT_SETTINGS.company, name: b.company_name?.trim() || "Công ty của bạn", short_name: "", address: "", phone: "", email: "", tax_code: "", designation_no: "", designation_date: "", lab_code: "", director_name: full_name }, updated_at: t });
        for (const r of FIELDS) await repo.insert("fields", { ...r, created_at: t });
        for (const r of PROCEDURES) await repo.insert("procedures", { ...r, created_at: t });
        for (const r of INSTRUMENT_TYPES) await repo.insert("instrument_types", { ...r, created_at: t });
        const branch = { id: newId(), code: "TS", name: "Trụ sở chính", address: null, active: true, created_at: t };
        await repo.insert("branches", branch);
        adminId = newId();
        await repo.insert("users", {
          id: adminId, code: "NV01", full_name, email, phone: null, roles: ["admin", "director", "signer", "qa"], branch_id: branch.id,
          title: "Giám đốc", inspector_card_no: null, inspector_card_expiry: null, active: true, created_at: t,
        });
        pwUsers.push(adminId);
      }
      const pwStmts = await Promise.all(pwUsers.map((id) => passwordStatement(env.DB, id, b.password!, iterations(env))));
      await repo.commit(pwStmts);
      const s = await createSession(env.DB, adminId);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie(s.token, s.maxAge, isSecure(req)) });
    }

    if (path === "/api/login" && method === "POST") {
      const b = await readJson<{ email?: string; password?: string }>(req);
      const email = (b.email ?? "").trim().toLowerCase();
      if (!email || !b.password) throw new AppError("BAD_REQUEST", "Nhập email và mật khẩu.");
      if (await isLocked(env.DB, email)) throw new AppError("LOCKED", "Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.");
      const u = await findUserByEmail(env.DB, email);
      const ok = !!u && (await checkPassword(env.DB, u.id, b.password));
      if (!ok || !u) { await recordFailure(env.DB, email); throw new AppError("BAD_LOGIN", "Sai email hoặc mật khẩu."); }
      if (!u.active) throw new AppError("INACTIVE_USER", "Tài khoản đã bị khoá.");
      await clearFailures(env.DB, email);
      const s = await createSession(env.DB, u.id);
      return json({ user: u }, 200, { "set-cookie": sessionCookie(s.token, s.maxAge, isSecure(req)) });
    }

    if (path === "/api/logout" && method === "POST") {
      await deleteSession(env.DB, readCookie(req, SESSION_COOKIE));
      return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0, isSecure(req)) });
    }

    const lookup = path.match(/^\/api\/lookup\/(.+)$/);
    if (lookup && method === "GET") {
      const number = decodeURIComponent(lookup[1]).trim();
      const r = await env.DB.prepare("SELECT data FROM rows WHERE tbl = 'certificates' AND json_extract(data, '$.number') = ?").bind(number).first<{ data: string }>();
      if (!r) return json({ certificate: null });
      const c = JSON.parse(r.data);
      return json({ certificate: {
        id: c.id, number: c.number, kind: c.kind, status: c.status, issued_at: c.issued_at, valid_to: c.valid_to, revoke_reason: c.revoke_reason,
        snapshot: {
          device: { name: c.snapshot.device.name, model: c.snapshot.device.model, serial: c.snapshot.device.serial },
          customer: { name: c.snapshot.customer.name }, company: { name: c.snapshot.company.name },
        },
      } });
    }

    // ------------------------------------------------------------- cần đăng nhập
    const me = await currentUser(req, env);
    if (!me) return fail("UNAUTHENTICATED", "Phiên đăng nhập đã hết. Hãy đăng nhập lại.", 401);

    if (path === "/api/me" && method === "GET") return json({ user: me });

    if (path === "/api/ws" && method === "GET") {
      if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") throw new AppError("BAD_REQUEST", "Cần kết nối WebSocket.");
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin) throw new AppError("FORBIDDEN", "Sai nguồn kết nối.");
      if (!env.HUB) return fail("NO_REALTIME", "Máy chủ chưa bật đồng bộ thời gian thực.", 501);
      const fwd = new Request("https://hub/ws", req);
      fwd.headers.set("x-user-id", me.id);
      return env.HUB.get(env.HUB.idFromName("company")).fetch(fwd);
    }

    if (path === "/api/password" && method === "POST") {
      const b = await readJson<{ user_id?: string; password?: string; current?: string }>(req);
      const target = b.user_id ?? me.id;
      const pwErr = validatePassword(b.password);
      if (pwErr) throw new AppError("BAD_REQUEST", pwErr);
      if (target === me.id) {
        if (!b.current || !(await checkPassword(env.DB, me.id, b.current))) throw new AppError("BAD_LOGIN", "Mật khẩu hiện tại không đúng.");
      } else if (!can(me, "users")) throw new AppError("FORBIDDEN", "Bạn không có quyền đặt mật khẩu cho người khác.");
      const u = await env.DB.prepare("SELECT 1 AS x FROM rows WHERE tbl = 'users' AND id = ?").bind(target).first();
      if (!u) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng.");
      await env.DB.batch([
        await passwordStatement(env.DB, target, b.password!, iterations(env)),
        // đặt lại mật khẩu thì đăng xuất mọi phiên khác của người đó
        env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ? AND token_hash <> ?").bind(target, target === me.id ? await sha256(readCookie(req, SESSION_COOKIE) ?? "") : ""),
      ]);
      return json({ ok: true });
    }

    const one = path.match(/^\/api\/data\/([a-z_]+)\/([^/]+)$/);
    const many = path.match(/^\/api\/data\/([a-z_]+)$/);
    if ((one || many) && method === "GET") {
      const table = (one ?? many)![1] as TableName;
      if (!TABLES.includes(table)) throw new AppError("NOT_FOUND", "Không có bảng này.");
      if (table === "audit_logs" && !can(me, "audit")) throw new AppError("FORBIDDEN", "Bạn không có quyền xem nhật ký.");
      const repo = new D1Repo(env.DB);
      if (one) {
        const row = await repo.get(table, decodeURIComponent(one[2]));
        if (row && table === "notifications" && !visibleNotification(row as Notification, me)) return json({ row: null });
        return json({ row });
      }
      let q: Query<Row<typeof table>> = {};
      const qs = url.searchParams.get("q");
      if (qs) { try { q = JSON.parse(qs); } catch { throw new AppError("BAD_QUERY", "Truy vấn không hợp lệ."); } }
      let rows = await repo.list(table, q);
      if (table === "notifications") rows = (rows as Notification[]).filter((n) => visibleNotification(n, me)) as never;
      return json({ rows });
    }

    if (path === "/api/notifications/read" && method === "POST") {
      const b = await readJson<{ ids?: string[] }>(req);
      const repo = new D1Repo(env.DB);
      await repo.prefetch("notifications", b.ids ?? []);
      for (const id of b.ids ?? []) {
        const n = await repo.get("notifications", id);
        if (n && n.user_id === me.id && !n.read) await repo.update("notifications", id, { read: true });
      }
      const changes = repo.changeSet();
      await repo.commit();
      if (changes.size) later(ctx, broadcast(env, { t: "changed", tables: ["notifications"], by: me.id, cid: req.headers.get("x-client") }, [me.id]));
      return json({ ok: true });
    }

    if (path === "/api/rpc" && method === "POST") {
      const b = await readJson<{ method?: string; args?: unknown[] }>(req);
      if (!b.method || !isRemoteMethod(b.method)) throw new AppError("BAD_REQUEST", "Thao tác không hợp lệ.");
      const args = Array.isArray(b.args) ? b.args : [];
      const repo = new D1Repo(env.DB);
      const svc = new Services(repo, () => me);
      if (b.method === "createOrder") {
        const items = ((args[0] as { items?: { device_id?: string }[] })?.items ?? []);
        await repo.prefetch("devices", items.map((i) => i.device_id).filter((x): x is string => !!x));
      }
      const fn = (svc as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[b.method];
      const result = await fn.apply(svc, args);
      const changes = repo.changeSet();
      await repo.commit();
      if (changes.size) later(ctx, afterWrite(env, req, me, changes, repo));
      // tên các bảng vừa đổi: trình duyệt của người thao tác tải lại đúng phần đó
      return json({ result: result ?? null, changed: [...changes.keys()] });
    }

    if (path === "/api/backup" && method === "GET") {
      if (!can(me, "settings")) throw new AppError("FORBIDDEN", "Chỉ quản trị được sao lưu.");
      const rows = await env.DB.prepare("SELECT tbl, data FROM rows").all<{ tbl: string; data: string }>();
      const seqs = await env.DB.prepare("SELECT key, value FROM sequences").all<{ key: string; value: number }>();
      const data: Record<string, unknown[]> = {};
      for (const r of rows.results) (data[r.tbl] ??= []).push(JSON.parse(r.data));
      return json({ app: "managercal", version: 1, exported_at: nowIso(), data, seq: Object.fromEntries(seqs.results.map((s) => [s.key, s.value])) });
    }

    if (path === "/api/restore" && method === "POST") {
      if (!me.roles.includes("admin")) throw new AppError("FORBIDDEN", "Chỉ quản trị được khôi phục.");
      const b = await readJson<{ data?: Record<string, { id: string }[]>; seq?: Record<string, number> }>(req);
      if (!b.data || typeof b.data !== "object") throw new AppError("BAD_REQUEST", "Tệp sao lưu không hợp lệ.");
      const users = (b.data.users ?? []) as User[];
      if (!users.some((u) => u.id === me.id && u.active && u.roles.includes("admin")))
        throw new AppError("BAD_REQUEST", "Tệp sao lưu không có tài khoản quản trị của bạn – khôi phục sẽ khoá bạn ra ngoài.");
      const repo = new D1Repo(env.DB, { assumeEmpty: true });
      for (const t of Object.keys(b.data)) {
        if (!RESTORE_TABLES.includes(t as TableName)) continue;
        for (const r of b.data[t]) if (r && typeof r.id === "string") await repo.insert(t as TableName, r as never);
      }
      for (const [k, v] of Object.entries(b.seq ?? {})) if (Number.isFinite(Number(v))) repo.setSequence(k, Number(v));
      await repo.commit([], [env.DB.prepare("DELETE FROM rows"), env.DB.prepare("DELETE FROM sequences")]);
      later(ctx, broadcast(env, { t: "changed", tables: RESTORE_TABLES, by: me.id }));
      return json({ ok: true });
    }

    // ------------------------------------------------------------- email thông báo
    if (path === "/api/admin/email" && method === "GET") {
      if (!can(me, "settings")) throw new AppError("FORBIDDEN", "Chỉ quản trị được xem cấu hình email.");
      return json(publicEmailConfig(await loadEmailConfig(env)));
    }
    if (path === "/api/admin/email" && method === "POST") {
      if (!can(me, "settings")) throw new AppError("FORBIDDEN", "Chỉ quản trị được cấu hình email.");
      const b = await readJson<Partial<EmailConfig>>(req);
      const cur = await loadEmailConfig(env);
      const provider = b.provider === "resend" ? "resend" : "brevo";
      const from_email = String(b.from_email ?? "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from_email)) throw new AppError("BAD_REQUEST", "Email người gửi không hợp lệ.");
      const api_key = String(b.api_key ?? "").trim() || cur?.api_key || "";
      if (!api_key) throw new AppError("BAD_REQUEST", "Cần nhập khoá API của dịch vụ gửi thư.");
      const cfg: EmailConfig = { provider, api_key, from_email, from_name: String(b.from_name ?? "").trim() || "ManagerCAL", enabled: b.enabled !== false };
      await saveEmailConfig(env.DB, cfg);
      return json(publicEmailConfig(cfg));
    }
    if (path === "/api/admin/email/test" && method === "POST") {
      if (!can(me, "settings")) throw new AppError("FORBIDDEN", "Chỉ quản trị được gửi thư thử.");
      const cfg = await loadEmailConfig(env);
      if (!cfg?.api_key) throw new AppError("BAD_REQUEST", "Chưa cấu hình dịch vụ gửi thư.");
      const s = await new D1Repo(env.DB).get("settings", "1");
      try {
        await sendEmail(cfg, notificationMail({ company: s?.company.short_name || s?.company.name || "", to: me.email, toName: me.full_name, title: "Thư thử từ ManagerCAL", body: "Nếu bạn đọc được thư này, email thông báo giao việc đã hoạt động.", url: `${url.origin}/#/` }));
      } catch (e) {
        if (e instanceof EmailError) throw new AppError("EMAIL_FAILED", e.message);
        throw e;
      }
      return json({ ok: true, to: me.email });
    }

    // ------------------------------------------------------------- dung lượng
    if (path === "/api/admin/storage" && method === "GET") {
      if (!can(me, "settings")) throw new AppError("FORBIDDEN", "Chỉ quản trị được xem dung lượng.");
      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
      const all = await env.DB.prepare("SELECT tbl, COUNT(*) AS n, SUM(length(data)) AS bytes, MIN(json_extract(data, '$.created_at')) AS oldest FROM rows GROUP BY tbl").all<{ tbl: string; n: number; bytes: number; oldest: string | null }>();
      const recent = await env.DB.prepare("SELECT tbl, SUM(CASE WHEN json_extract(data, '$.created_at') >= ?1 THEN 1 ELSE 0 END) AS n30, SUM(CASE WHEN json_extract(data, '$.created_at') >= ?1 THEN length(data) ELSE 0 END) AS bytes30, SUM(CASE WHEN json_extract(data, '$.created_at') >= ?2 THEN 1 ELSE 0 END) AS n90 FROM rows GROUP BY tbl")
        .bind(since30, since90).all<{ tbl: string; n30: number; bytes30: number; n90: number }>();
      const meta = (all.meta ?? {}) as { size_after?: number };
      const r = new Map(recent.results.map((x) => [x.tbl, x]));
      return json({
        size_bytes: typeof meta.size_after === "number" ? meta.size_after : null,
        limit_bytes: 500 * 1024 * 1024,
        tables: all.results.map((t) => ({ ...t, n30: r.get(t.tbl)?.n30 ?? 0, bytes30: r.get(t.tbl)?.bytes30 ?? 0, n90: r.get(t.tbl)?.n90 ?? 0 })),
      });
    }

    return fail("NOT_FOUND", "Không có API này.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}
