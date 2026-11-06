// Ngữ cảnh chat dùng chung cho cả khung ứng dụng: danh sách kênh + số tin chưa đọc (tải một lần),
// mở khung chat bên phải (máy tính) hoặc trang chat (điện thoại).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/app/data";
import type { ChatSummaryItem } from "@/lib/services/chat";

interface ChatDockCtx {
  summary: ChatSummaryItem[];
  unread: number;
  open: boolean;
  channel: string | null;
  setChannel: (c: string | null) => void;
  openChat: (channel?: string | null) => void;
  close: () => void;
  reloadSummary: () => void;
}
const Ctx = createContext<ChatDockCtx | null>(null);

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const { svc, versions, me } = useData();
  const nav = useNavigate();
  const [summary, setSummary] = useState<ChatSummaryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const tv = (versions.chat_channels ?? 0) + (versions.chat_reads ?? 0) + (versions.users ?? 0) + (versions["*"] ?? 0);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    svc.chatSummary().then((r) => { if (!cancelled) setSummary(r); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [svc, me, tv, tick]);

  const openChat = useCallback((c?: string | null) => {
    if (c !== undefined) setChannel(c);
    if (isDesktop()) setOpen(true);
    else nav(c ? `/chat/${encodeURIComponent(c)}` : "/chat");
  }, [nav]);

  const value = useMemo<ChatDockCtx>(() => ({
    summary, unread: summary.reduce((s, x) => s + x.unread, 0), open, channel, setChannel,
    openChat, close: () => setOpen(false), reloadSummary: () => setTick((x) => x + 1),
  }), [summary, open, channel, openChat]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatDock() {
  const c = useContext(Ctx);
  if (!c) throw new Error("ChatDockProvider missing");
  return c;
}
