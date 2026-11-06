// =============================================================================
// Hub – Durable Object (một bản cho cả công ty) giữ các kết nối WebSocket của người đang mở ứng dụng.
//
// - Ai đang online: mỗi kết nối gắn thẻ = id người dùng (còn nguyên khi Hub "ngủ đông").
// - Đồng bộ ngay: sau mỗi thao tác ghi, Worker gọi /broadcast → Hub đẩy tên các bảng vừa đổi tới mọi
//   trình duyệt (hoặc chỉ những người liên quan với tin nhắn riêng); trình duyệt tự tải lại phần đó.
// - Dùng WebSocket Hibernation: khi không có sự kiện, Hub ngủ, không tính thời gian chạy;
//   "ping" được trả "pong" tự động mà không đánh thức Hub.
// =============================================================================

// Kiểu tối thiểu của Durable Objects (không phụ thuộc @cloudflare/workers-types)
interface HubWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(v: unknown): void;
  deserializeAttachment(): unknown;
}
interface DurableObjectState {
  acceptWebSocket(ws: HubWebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): HubWebSocket[];
  setWebSocketAutoResponse(pair: unknown): void;
  storage: { get<T>(key: string): Promise<T | undefined>; put(key: string, v: unknown): Promise<void>; list<T>(opts?: { prefix?: string }): Promise<Map<string, T>> };
}
declare const WebSocketPair: { new (): { 0: HubWebSocket; 1: HubWebSocket } };
declare const WebSocketRequestResponsePair: { new (req: string, res: string): unknown };

export interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string | Request, init?: RequestInit): Promise<Response> };
}

interface Att { uid: string; at: number }
export type HubMessage =
  | { t: "presence"; online: string[]; seen: Record<string, number> }
  | { t: "changed"; tables: string[]; by: string | null; channel?: string; cid?: string | null }
  | { t: "typing"; uid: string; channel: string };

export class Hub {
  constructor(private state: DurableObjectState) {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  private att(ws: HubWebSocket): Att | null {
    try { return ws.deserializeAttachment() as Att; } catch { return null; }
  }

  private online(except?: HubWebSocket): string[] {
    const ids = new Set<string>();
    for (const ws of this.state.getWebSockets()) if (ws !== except) { const a = this.att(ws); if (a) ids.add(a.uid); }
    return [...ids];
  }

  private send(msg: HubMessage, to?: string[] | null, except?: HubWebSocket) {
    const data = JSON.stringify(msg);
    const sockets = to ? to.flatMap((uid) => this.state.getWebSockets(uid)) : this.state.getWebSockets();
    for (const ws of sockets) if (ws !== except) { try { ws.send(data); } catch { /* kết nối đã đóng */ } }
  }

  private async presence(except?: HubWebSocket) {
    const seen = Object.fromEntries([...(await this.state.storage.list<number>({ prefix: "seen:" }))].map(([k, v]) => [k.slice(5), v]));
    this.send({ t: "presence", online: this.online(except), seen }, null, except);
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const uid = req.headers.get("x-user-id");
      if (!uid) return new Response("Thiếu người dùng", { status: 400 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.state.acceptWebSocket(server, [uid]);
      server.serializeAttachment({ uid, at: Date.now() } satisfies Att);
      await this.presence();
      return new Response(null, { status: 101, webSocket: client } as ResponseInit);
    }
    if (url.pathname === "/broadcast" && req.method === "POST") {
      const b = (await req.json()) as { msg: HubMessage; to?: string[] | null };
      this.send(b.msg, b.to ?? null);
      return new Response("ok");
    }
    if (url.pathname === "/online") return Response.json({ online: this.online() });
    return new Response("Not found", { status: 404 });
  }

  /** Tin từ trình duyệt: hiện chỉ có "đang gõ" (ping/pong được trả tự động) */
  async webSocketMessage(ws: HubWebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string" || message.length > 300) return;
    const a = this.att(ws);
    if (!a) return;
    let m: { t?: string; channel?: string; to?: string[] };
    try { m = JSON.parse(message); } catch { return; }
    if (m.t === "typing" && typeof m.channel === "string") {
      // kênh riêng: chỉ báo cho người kia; kênh chung: mọi người
      const to = m.channel.startsWith("dm:") ? m.channel.slice(3).split(":").filter((x) => x !== a.uid) : null;
      if (m.channel.startsWith("dm:") && !m.channel.slice(3).split(":").includes(a.uid)) return;
      this.send({ t: "typing", uid: a.uid, channel: m.channel }, to, ws);
    }
  }

  async webSocketClose(ws: HubWebSocket) { await this.gone(ws); }
  async webSocketError(ws: HubWebSocket) { await this.gone(ws); }

  private async gone(ws: HubWebSocket) {
    const a = this.att(ws);
    try { ws.close(1000, "bye"); } catch { /* đã đóng */ }
    if (a) await this.state.storage.put(`seen:${a.uid}`, Date.now());
    await this.presence(ws);
  }
}
