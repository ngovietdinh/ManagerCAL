// =============================================================================
// TRAO ĐỔI NỘI BỘ – kênh chung toàn công ty + nhắn riêng hai người.
// Tin nhắn trích dẫn được phiếu / đơn / GCN; lời nhờ ("nhờ anh soát xét phiếu này") có nút trả lời nhanh.
// Chạy trong lớp Services nên ở chế độ máy chủ mọi kiểm tra (ai đọc được kênh nào, ai trả lời lời nhờ)
// diễn ra trên máy chủ.
// =============================================================================
import type { ChatAsk, ChatAskKind, ChatChannel, ChatMessage, ChatRead, ChatRef, ChatRefKind, User } from "../types";
import { AppError, newId, nowIso } from "../store/repo";
import type { Services } from "./index";

export const GENERAL = "general";
export const dmChannel = (a: string, b: string) => `dm:${[a, b].sort().join(":")}`;
export const dmMembers = (channel: string): string[] => (channel.startsWith("dm:") ? channel.slice(3).split(":") : []);
export const dmPeer = (channel: string, me: string) => dmMembers(channel).find((x) => x !== me) ?? me;

export const ASK_LABEL: Record<ChatAskKind, string> = { review: "soát xét", sign: "ký phát hành", check: "xem giúp" };
const ANSWER_TEXT: Record<Exclude<ChatAsk["status"], "open">, string> = {
  accepted: "Đã nhận, mình xem ngay",
  done: "Xong rồi nhé",
  declined: "Đang bận, nhờ người khác giúp nhé",
};
export const MAX_TEXT = 2000;

/** Mã phiếu (DH2611-0002-01), mã đơn (DH2611-0002), số GCN (00011/26/KĐ-HN) gõ trong tin → tự thành trích dẫn */
const CODE_RE = /\b([A-Z]{2}\d{4}-\d{4}(?:-\d{2})?)\b|\b(\d{5}\/\d{2}\/[^\s,;.]+)/g;

export function canAccess(me: User, channel: string): boolean {
  if (channel === GENERAL) return true;
  const m = dmMembers(channel);
  return m.length === 2 && m.includes(me.id);
}

const err = (code: string, message: string) => new AppError(code, message);

async function channelRow(svc: Services, channel: string, me: User): Promise<ChatChannel> {
  if (!canAccess(me, channel)) throw err("FORBIDDEN", "Bạn không ở trong cuộc trò chuyện này.");
  const cur = await svc.repo.get("chat_channels", channel);
  if (cur) return cur;
  const members = dmMembers(channel);
  for (const id of members) {
    const u = await svc.repo.get("users", id);
    if (!u || !u.active) throw err("NOT_FOUND", "Không tìm thấy người nhận.");
  }
  const row: ChatChannel = { id: channel, kind: channel === GENERAL ? "general" : "dm", members, count: 0, last_at: null, last_text: null, last_user_id: null, created_at: nowIso() };
  return svc.repo.insert("chat_channels", row);
}

async function resolveRef(svc: Services, kind: ChatRefKind, id: string): Promise<ChatRef | null> {
  if (kind === "job") {
    const j = await svc.repo.get("jobs", id);
    if (!j) return null;
    const [d, c] = await Promise.all([svc.repo.get("devices", j.device_id), svc.repo.get("customers", j.customer_id)]);
    return { kind, id, label: j.code, sub: [d?.name, c?.name].filter(Boolean).join(" · ") || null };
  }
  if (kind === "order") {
    const o = await svc.repo.get("orders", id);
    if (!o) return null;
    const c = await svc.repo.get("customers", o.customer_id);
    return { kind, id, label: o.code, sub: c?.name ?? null };
  }
  const cert = await svc.repo.get("certificates", id);
  if (!cert) return null;
  return { kind, id, label: cert.number, sub: [cert.snapshot.device.name, cert.snapshot.customer.name].filter(Boolean).join(" · ") || null };
}

async function refsFromText(svc: Services, text: string): Promise<ChatRef[]> {
  const out: ChatRef[] = [];
  for (const m of text.matchAll(CODE_RE)) {
    if (out.length >= 5) break;
    if (m[1]) {
      const isJob = /-\d{2}$/.test(m[1]);
      const rows = isJob ? await svc.repo.list("jobs", { where: { code: m[1] } }) : await svc.repo.list("orders", { where: { code: m[1] } });
      if (rows[0]) { const r = await resolveRef(svc, isJob ? "job" : "order", rows[0].id); if (r) out.push(r); }
    } else if (m[2]) {
      const rows = await svc.repo.list("certificates", { where: { number: m[2] } });
      if (rows[0]) { const r = await resolveRef(svc, "certificate", rows[0].id); if (r) out.push(r); }
    }
  }
  return out;
}

export interface ChatSummaryItem extends ChatChannel { unread: number }

/** Các kênh của tôi kèm số tin chưa đọc (kênh chung luôn có) */
export async function chatSummary(svc: Services): Promise<ChatSummaryItem[]> {
  const me = svc.me();
  const [channels, reads] = await Promise.all([svc.repo.list("chat_channels"), svc.repo.list("chat_reads", { where: { user_id: me.id } })]);
  const readOf = new Map(reads.map((r) => [r.channel, r.read_count]));
  const mine = channels.filter((c) => canAccess(me, c.id));
  if (!mine.some((c) => c.id === GENERAL)) mine.unshift({ id: GENERAL, kind: "general", members: [], count: 0, last_at: null, last_text: null, last_user_id: null, created_at: nowIso() });
  return mine
    .map((c) => ({ ...c, unread: Math.max(0, c.count - (readOf.get(c.id) ?? 0)) }))
    .sort((a, b) => (a.id === GENERAL ? -1 : b.id === GENERAL ? 1 : (b.last_at ?? "").localeCompare(a.last_at ?? "")));
}

/** Tin của một kênh, cũ → mới; before = lấy các tin trước mốc thời gian đó (cuộn lên xem thêm) */
export async function chatList(svc: Services, channel: string, before?: string | null, limit = 50): Promise<ChatMessage[]> {
  const me = svc.me();
  if (!canAccess(me, channel)) throw err("FORBIDDEN", "Bạn không ở trong cuộc trò chuyện này.");
  const rows = await svc.repo.list("chat_messages", {
    where: { channel }, orderBy: { field: "created_at", dir: "desc" }, limit: Math.min(Math.max(limit, 1), 100),
    ...(before ? { range: { field: "created_at", lt: before } } : {}),
  });
  return rows.reverse();
}

export interface ChatSendInput {
  channel: string;
  text: string;
  refs?: { kind: ChatRefKind; id: string }[];
  ask?: { kind: ChatAskKind; to_user_id: string } | null;
}

export async function chatSend(svc: Services, input: ChatSendInput): Promise<ChatMessage> {
  const me = svc.me();
  const text = String(input.text ?? "").trim().slice(0, MAX_TEXT);
  const ch = await channelRow(svc, input.channel, me);

  const refs: ChatRef[] = [];
  for (const r of (input.refs ?? []).slice(0, 5)) {
    if (!["job", "order", "certificate"].includes(r.kind)) continue;
    const x = await resolveRef(svc, r.kind, r.id);
    if (x && !refs.some((y) => y.kind === x.kind && y.id === x.id)) refs.push(x);
  }
  for (const x of await refsFromText(svc, text)) if (refs.length < 5 && !refs.some((y) => y.kind === x.kind && y.id === x.id)) refs.push(x);
  if (!text && !refs.length) throw err("BAD_REQUEST", "Tin nhắn trống.");

  let ask: ChatAsk | null = null;
  if (input.ask) {
    if (ch.kind !== "dm") throw err("BAD_REQUEST", "Lời nhờ chỉ gửi trong tin nhắn riêng.");
    if (!ASK_LABEL[input.ask.kind]) throw err("BAD_REQUEST", "Loại lời nhờ không hợp lệ.");
    if (input.ask.to_user_id !== dmPeer(ch.id, me.id) || input.ask.to_user_id === me.id) throw err("BAD_REQUEST", "Người được nhờ phải là người nhận tin.");
    if (!refs.some((r) => r.kind === "job")) throw err("BAD_REQUEST", "Lời nhờ cần trích dẫn một phiếu công việc.");
    ask = { kind: input.ask.kind, to_user_id: input.ask.to_user_id, status: "open", answered_at: null };
  }

  // thời điểm tăng ngặt trong một kênh (hai tin cùng mili-giây vẫn đúng thứ tự, phân trang không sót)
  let created_at = nowIso();
  if (ch.last_at && created_at <= ch.last_at) created_at = new Date(Date.parse(ch.last_at) + 1).toISOString();
  const msg: ChatMessage = { id: newId(), channel: ch.id, user_id: me.id, text, refs, ask, created_at };
  await svc.repo.insert("chat_messages", msg);
  const count = ch.count + 1;
  await svc.repo.update("chat_channels", ch.id, { count, last_at: msg.created_at, last_text: preview(msg), last_user_id: me.id });
  await markRead(svc, me, ch.id, count);

  if (ask) {
    const job = refs.find((r) => r.kind === "job")!;
    await svc.notify({ user_ids: [ask.to_user_id] }, `${me.full_name} nhờ bạn ${ASK_LABEL[ask.kind]} phiếu ${job.label}`, text || job.sub, `/chat/${encodeURIComponent(ch.id)}`, { email: true });
  }
  return msg;
}

export const preview = (m: Pick<ChatMessage, "text" | "refs" | "ask">) =>
  (m.ask ? `Nhờ ${ASK_LABEL[m.ask.kind]} ${m.refs[0]?.label ?? ""}: ` : "") + (m.text || m.refs.map((r) => r.label).join(", ")).slice(0, 140);

async function markRead(svc: Services, me: User, channel: string, count: number) {
  const id = `${me.id}|${channel}`;
  const cur = await svc.repo.get("chat_reads", id);
  if (cur) { if (cur.read_count !== count) await svc.repo.update("chat_reads", id, { read_count: count, read_at: nowIso() }); }
  else await svc.repo.insert("chat_reads", { id, user_id: me.id, channel, read_count: count, read_at: nowIso(), created_at: nowIso() } satisfies ChatRead);
}

export async function chatRead(svc: Services, channel: string): Promise<void> {
  const me = svc.me();
  if (!canAccess(me, channel)) throw err("FORBIDDEN", "Bạn không ở trong cuộc trò chuyện này.");
  const ch = await svc.repo.get("chat_channels", channel);
  if (ch) await markRead(svc, me, channel, ch.count);
}

/** Người được nhờ trả lời nhanh: nhận / xong / bận – kèm một tin trả lời tự động cho người nhờ */
export async function chatAnswer(svc: Services, message_id: string, status: Exclude<ChatAsk["status"], "open">): Promise<ChatMessage> {
  const me = svc.me();
  const m = await svc.repo.get("chat_messages", message_id);
  if (!m || !m.ask || !canAccess(me, m.channel)) throw err("NOT_FOUND", "Không tìm thấy lời nhờ.");
  if (m.ask.to_user_id !== me.id) throw err("FORBIDDEN", "Chỉ người được nhờ mới trả lời được.");
  if (!ANSWER_TEXT[status]) throw err("BAD_REQUEST", "Trả lời không hợp lệ.");
  const updated = await svc.repo.update("chat_messages", m.id, { ask: { ...m.ask, status, answered_at: nowIso() } });
  const job = m.refs.find((r) => r.kind === "job");
  await chatSend(svc, { channel: m.channel, text: `${ANSWER_TEXT[status]}${job ? ` (${job.label})` : ""}` , refs: [] });
  await svc.notify({ user_ids: [m.user_id] }, `${me.full_name}: ${ANSWER_TEXT[status].toLowerCase()}${job ? ` – phiếu ${job.label}` : ""}`, null, `/chat/${encodeURIComponent(m.channel)}`);
  return updated;
}
