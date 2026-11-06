// =============================================================================
// Đồng bộ thời gian thực + ai đang online.
//  - Chế độ máy chủ: WebSocket tới /api/ws (Durable Object "Hub" trên Cloudflare). Người khác thao tác xong
//    → máy chủ đẩy tên các bảng vừa đổi → trang đang mở tải lại đúng phần đó (không hỏi định kỳ).
//    Mất kết nối → tự nối lại; trong lúc mất thì hỏi lại 30 giây/lần.
//  - Chế độ demo: các tab cùng trình duyệt báo nhau qua BroadcastChannel (mở 2 tab, đăng nhập 2 người
//    khác nhau để thử chat và đồng bộ).
// =============================================================================
import type { User } from "../types";

export interface Presence { online: string[]; seen: Record<string, number> }
export type LinkStatus = "connecting" | "online" | "offline";
export interface RealtimeEvents {
  /** bảng vừa đổi (đã lọc thay đổi do chính tab này gây ra) */
  changed(tables: string[], channel?: string): void;
  presence(p: Presence): void;
  typing(uid: string, channel: string): void;
  status(s: LinkStatus): void;
}
export interface RealtimeLink {
  stop(): void;
  typing(channel: string): void;
}

/** Mã của tab này: máy chủ gắn vào sự kiện để tab không tự tải lại hai lần vì thao tác của chính mình */
export const CLIENT_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export function serverLink(apiBase: string, ev: RealtimeEvents): RealtimeLink {
  let ws: WebSocket | null = null;
  let stopped = false;
  let tries = 0;
  let everOpen = false;
  let ping: ReturnType<typeof setInterval> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let lastTyping = 0;

  const url = () => {
    const base = new URL(apiBase + "/ws", location.href);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    return base.toString();
  };
  const startPolling = () => {
    if (poll) return;
    poll = setInterval(() => { if (document.visibilityState === "visible") ev.changed(["*"]); }, 30_000);
  };
  const stopPolling = () => { if (poll) { clearInterval(poll); poll = null; } };

  const connect = () => {
    if (stopped) return;
    ev.status("connecting");
    try { ws = new WebSocket(url()); } catch { schedule(); return; }
    ws.onopen = () => {
      tries = 0;
      ev.status("online");
      stopPolling();
      // nối lại sau khi mất kết nối: có thể đã lỡ sự kiện → tải lại toàn bộ
      if (everOpen) ev.changed(["*"]);
      everOpen = true;
      ping = setInterval(() => { try { ws?.send("ping"); } catch { /* sẽ đóng */ } }, 30_000);
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data === "pong") return;
      let m: { t: string; tables?: string[]; channel?: string; online?: string[]; seen?: Record<string, number>; uid?: string; cid?: string };
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === "presence") ev.presence({ online: m.online ?? [], seen: m.seen ?? {} });
      else if (m.t === "changed" && m.tables && m.cid !== CLIENT_ID) ev.changed(m.tables, m.channel);
      else if (m.t === "typing" && m.uid && m.channel) ev.typing(m.uid, m.channel);
    };
    ws.onclose = () => {
      if (ping) { clearInterval(ping); ping = null; }
      ws = null;
      if (stopped) return;
      ev.status("offline");
      startPolling();
      schedule();
    };
    ws.onerror = () => { try { ws?.close(); } catch { /* bỏ qua */ } };
  };
  const schedule = () => {
    if (stopped) return;
    const delay = [1000, 2000, 5000, 10_000, 30_000][Math.min(tries++, 4)];
    retry = setTimeout(connect, delay);
  };
  // máy ngủ dậy / mạng có lại → nối ngay
  const online = () => { if (!ws && !stopped) { if (retry) clearTimeout(retry); tries = 0; connect(); } };
  window.addEventListener("online", online);
  document.addEventListener("visibilitychange", online);
  connect();

  return {
    stop() {
      stopped = true;
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", online);
      if (retry) clearTimeout(retry);
      if (ping) clearInterval(ping);
      stopPolling();
      try { ws?.close(1000, "logout"); } catch { /* bỏ qua */ }
    },
    typing(channel) {
      const now = Date.now();
      if (now - lastTyping < 3000 || ws?.readyState !== WebSocket.OPEN) return;
      lastTyping = now;
      ws.send(JSON.stringify({ t: "typing", channel }));
    },
  };
}

/** Demo: các tab báo nhau. reload(tables) đọc lại dữ liệu tab khác vừa ghi vào IndexedDB. */
export function demoLink(me: User, ev: RealtimeEvents, hooks: { onLocalFlush(fn: (tables: string[]) => void): void; reload(tables: string[]): Promise<void> }): RealtimeLink {
  if (typeof BroadcastChannel === "undefined") {
    ev.presence({ online: [me.id], seen: {} });
    ev.status("online");
    return { stop() { /* không có */ }, typing() { /* không có */ } };
  }
  const bc = new BroadcastChannel("managercal-demo");
  const tabs = new Map<string, { uid: string; at: number }>();
  const seen: Record<string, number> = {};
  let lastTyping = 0;
  const emitPresence = () => {
    const now = Date.now();
    const online = new Set([me.id]);
    for (const [tab, x] of tabs) {
      if (now - x.at < 25_000) online.add(x.uid);
      else { tabs.delete(tab); seen[x.uid] = x.at; }
    }
    ev.presence({ online: [...online], seen: { ...seen } });
  };
  const hb = () => bc.postMessage({ t: "hb", tab: CLIENT_ID, uid: me.id });
  bc.onmessage = (e) => {
    const m = e.data as { t: string; tab?: string; uid?: string; tables?: string[]; channel?: string };
    if (m.t === "hb" && m.tab && m.uid) {
      const isNew = !tabs.has(m.tab);
      tabs.set(m.tab, { uid: m.uid, at: Date.now() });
      if (isNew) { hb(); emitPresence(); }
    } else if (m.t === "bye" && m.tab) {
      const x = tabs.get(m.tab);
      if (x) { seen[x.uid] = Date.now(); tabs.delete(m.tab); emitPresence(); }
    } else if (m.t === "changed" && m.tables) {
      hooks.reload(m.tables).catch(console.error);
    } else if (m.t === "typing" && m.uid && m.channel) {
      if (!m.channel.startsWith("dm:") || m.channel.includes(me.id)) ev.typing(m.uid, m.channel);
    }
  };
  hooks.onLocalFlush((tables) => bc.postMessage({ t: "changed", tables, tab: CLIENT_ID }));
  const bye = () => bc.postMessage({ t: "bye", tab: CLIENT_ID });
  window.addEventListener("pagehide", bye);
  const timer = setInterval(() => { hb(); emitPresence(); }, 10_000);
  hb();
  emitPresence();
  ev.status("online");
  return {
    stop() {
      clearInterval(timer);
      window.removeEventListener("pagehide", bye);
      bye();
      hooks.onLocalFlush(() => undefined);
      bc.close();
    },
    typing(channel) {
      const now = Date.now();
      if (now - lastTyping < 3000) return;
      lastTyping = now;
      bc.postMessage({ t: "typing", uid: me.id, channel });
    },
  };
}
