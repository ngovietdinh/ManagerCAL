// =============================================================================
// Gửi email thông báo (giao việc, chờ soát xét, chờ ký, bị trả lại, được đồng nghiệp nhờ…).
// Dùng dịch vụ gửi thư qua HTTP vì Worker không gửi SMTP trực tiếp:
//  - Brevo (brevo.com): gói miễn phí 300 thư/ngày, chỉ cần xác minh MỘT địa chỉ gửi (vd. Gmail của bạn),
//    không cần tên miền riêng → hợp với công ty chưa có tên miền.
//  - Resend (resend.com): 3.000 thư/tháng, cần tên miền riêng đã xác minh để gửi tới người khác.
// Khoá API lưu ở bảng app_secrets (chỉ máy chủ đọc), quản trị nhập trong Cài đặt; hoặc đặt biến
// môi trường EMAIL_PROVIDER / EMAIL_API_KEY / EMAIL_FROM / EMAIL_FROM_NAME của Worker.
// =============================================================================
import type { D1Database } from "./d1";

export type EmailProvider = "brevo" | "resend";
export interface EmailConfig { provider: EmailProvider; api_key: string; from_email: string; from_name: string; enabled: boolean }
export interface EmailEnv {
  DB: D1Database;
  EMAIL_PROVIDER?: string; EMAIL_API_KEY?: string; EMAIL_FROM?: string; EMAIL_FROM_NAME?: string;
}

export async function loadEmailConfig(env: EmailEnv): Promise<EmailConfig | null> {
  const r = await env.DB.prepare("SELECT value FROM app_secrets WHERE key = 'email'").first<{ value: string }>().catch(() => null);
  if (r) { try { return JSON.parse(r.value) as EmailConfig; } catch { /* hỏng → dùng biến môi trường */ } }
  if (env.EMAIL_API_KEY && env.EMAIL_FROM) {
    return { provider: env.EMAIL_PROVIDER === "resend" ? "resend" : "brevo", api_key: env.EMAIL_API_KEY, from_email: env.EMAIL_FROM, from_name: env.EMAIL_FROM_NAME ?? "ManagerCAL", enabled: true };
  }
  return null;
}

export async function saveEmailConfig(db: D1Database, cfg: EmailConfig) {
  await db.prepare("INSERT INTO app_secrets (key, value, updated_at) VALUES ('email', ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify(cfg), new Date().toISOString()).run();
}

/** Thông tin cấu hình an toàn để trả về giao diện (không bao giờ trả khoá) */
export const publicEmailConfig = (c: EmailConfig | null) => c
  ? { configured: true, enabled: c.enabled, provider: c.provider, from_email: c.from_email, from_name: c.from_name, key_hint: c.api_key ? `••••${c.api_key.slice(-4)}` : "" }
  : { configured: false, enabled: false, provider: "brevo" as EmailProvider, from_email: "", from_name: "", key_hint: "" };

export interface Mail { to: string; toName?: string; subject: string; html: string; text: string }

export class EmailError extends Error {}

export async function sendEmail(cfg: EmailConfig, m: Mail, fetchFn: typeof fetch = fetch): Promise<void> {
  let res: Response;
  if (cfg.provider === "resend") {
    res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.api_key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: `${cfg.from_name} <${cfg.from_email}>`, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
  } else {
    res = await fetchFn("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": cfg.api_key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { email: cfg.from_email, name: cfg.from_name }, to: [{ email: m.to, name: m.toName ?? m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text }),
    });
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    throw new EmailError(`Dịch vụ gửi thư trả lỗi ${res.status}${body ? `: ${body}` : ""}`);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Thư thông báo: tiêu đề, nội dung, nút mở đúng trang trong ứng dụng */
export function notificationMail(o: { company: string; to: string; toName: string; title: string; body: string | null; url: string }): Mail {
  const html = `<!doctype html><html><body style="margin:0;background:#f3efe8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1d1a16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:24px">
<tr><td style="font-size:13px;color:#6b645b">${esc(o.company)} · ManagerCAL</td></tr>
<tr><td style="padding-top:8px;font-size:18px;font-weight:600;line-height:1.4">${esc(o.title)}</td></tr>
${o.body ? `<tr><td style="padding-top:8px;font-size:14px;line-height:1.5;color:#3b362f">${esc(o.body)}</td></tr>` : ""}
<tr><td style="padding-top:20px"><a href="${esc(o.url)}" style="display:inline-block;background:#1d1a16;color:#ffffff;text-decoration:none;border-radius:999px;padding:11px 20px;font-size:14px;font-weight:600">Mở trong ManagerCAL</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#6b645b">Thư tự động khi bạn được giao việc. Quản trị có thể tắt trong Cài đặt → Email thông báo.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${o.title}\n${o.body ? o.body + "\n" : ""}\nMở: ${o.url}\n\n${o.company} · ManagerCAL`;
  return { to: o.to, toName: o.toName, subject: o.title, html, text };
}
