// =============================================================================
// Xác thực: mật khẩu PBKDF2-SHA256 (WebCrypto), phiên đăng nhập bằng cookie HttpOnly.
// Token phiên chỉ lưu dạng băm SHA-256 trong D1.
// =============================================================================
import type { D1Database } from "./d1";

export const SESSION_COOKIE = "mc_session";
const SESSION_DAYS = 30;
export const DEFAULT_ITERATIONS = 100_000; // tối đa Workers cho phép với PBKDF2; chỉnh qua biến PBKDF2_ITERATIONS
const MAX_FAILURES = 8;     // khoá đăng nhập 15 phút sau 8 lần sai liên tiếp
const LOCK_MINUTES = 15;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) => Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));

export async function sha256(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return hex(bits);
}

/** So sánh hai chuỗi hex không rò rỉ thời gian */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự.";
  if (pw.length > 200) return "Mật khẩu quá dài.";
  return null;
}

export async function passwordStatement(db: D1Database, user_id: string, password: string, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return db.prepare(
    "INSERT INTO auth_passwords (user_id, salt, hash, iterations, updated_at) VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT (user_id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, iterations = excluded.iterations, updated_at = excluded.updated_at",
  ).bind(user_id, hex(salt), hash, iterations, new Date().toISOString());
}

export async function checkPassword(db: D1Database, user_id: string, password: string): Promise<boolean> {
  const row = await db.prepare("SELECT salt, hash, iterations FROM auth_passwords WHERE user_id = ?").bind(user_id).first<{ salt: string; hash: string; iterations: number }>();
  if (!row) return false;
  return safeEqual(await pbkdf2(password, fromHex(row.salt), row.iterations), row.hash);
}

/** true nếu email đang bị khoá vì sai quá nhiều lần */
export async function isLocked(db: D1Database, email: string): Promise<boolean> {
  const r = await db.prepare("SELECT count, first_at FROM auth_failures WHERE email = ?").bind(email).first<{ count: number; first_at: string }>();
  if (!r) return false;
  const age = Date.now() - Date.parse(r.first_at);
  return r.count >= MAX_FAILURES && age < LOCK_MINUTES * 60_000;
}

export async function recordFailure(db: D1Database, email: string) {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  await db.prepare(
    "INSERT INTO auth_failures (email, count, first_at) VALUES (?1, 1, ?2) ON CONFLICT (email) DO UPDATE SET " +
    "count = CASE WHEN auth_failures.first_at < ?3 THEN 1 ELSE auth_failures.count + 1 END, " +
    "first_at = CASE WHEN auth_failures.first_at < ?3 THEN ?2 ELSE auth_failures.first_at END",
  ).bind(email, now, cutoff).run();
}

export async function clearFailures(db: D1Database, email: string) {
  await db.prepare("DELETE FROM auth_failures WHERE email = ?").bind(email).run();
}

export async function createSession(db: D1Database, user_id: string): Promise<{ token: string; maxAge: number }> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), user_id, expires, new Date().toISOString()).run();
  return { token, maxAge: SESSION_DAYS * 86_400 };
}

export async function sessionUserId(db: D1Database, token: string | null): Promise<string | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await db.prepare("SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).first<{ user_id: string; expires_at: string }>();
  if (!r || r.expires_at < new Date().toISOString()) return null;
  return r.user_id;
}

export async function deleteSession(db: D1Database, token: string | null) {
  if (token) await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export function readCookie(req: Request, name: string): string | null {
  const h = req.headers.get("cookie") ?? "";
  for (const part of h.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function sessionCookie(token: string, maxAge: number, secure: boolean) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
