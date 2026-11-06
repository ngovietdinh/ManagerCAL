// Khung trao đổi nội bộ: danh sách cuộc trò chuyện (kênh chung + từng người, ai đang online) và
// hội thoại (tin nhắn, trích dẫn phiếu/đơn/GCN, lời nhờ có nút trả lời nhanh).
import clsx from "clsx";
import { ArrowLeft, Award, ClipboardList, Hash, Loader2, PackageOpen, Paperclip, Search, Send, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useData, useRow, useTable } from "@/app/data";
import { Avatar, Badge, Button, useUi } from "@/components/ui";
import { dayjs, fmtDate, fmtTime } from "@/lib/format";
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from "@/lib/labels";
import { ASK_LABEL, GENERAL, dmChannel, dmPeer } from "@/lib/services/chat";
import type { ChatAsk, ChatMessage, ChatRef, ChatRefKind, User } from "@/lib/types";
import { useChatDock } from "./ChatDock";

export function lastSeenText(ms: number | undefined) {
  if (!ms) return "Chưa online";
  return `Hoạt động ${dayjs(ms).fromNow()}`;
}

/** Ảnh đại diện có chấm xanh khi đang online */
export function PresenceAvatar({ user, online, size = 36 }: { user: Pick<User, "full_name">; online: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={user.full_name} size={size} />
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--card-solid)] bg-[#12a26f]" aria-hidden />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Danh sách cuộc trò chuyện
// ---------------------------------------------------------------------------
function ConversationList({ current, onPick }: { current: string | null; onPick: (c: string) => void }) {
  const { me, users, presence } = useData();
  const { summary } = useChatDock();
  const [q, setQ] = useState("");
  const online = useMemo(() => new Set(presence.online), [presence.online]);
  const byChannel = useMemo(() => new Map(summary.map((s) => [s.id, s])), [summary]);
  const general = byChannel.get(GENERAL);
  const people = useMemo(() => {
    const k = q.trim().toLowerCase();
    return users
      .filter((u) => u.active && u.id !== me!.id && (!k || u.full_name.toLowerCase().includes(k) || (u.title ?? "").toLowerCase().includes(k)))
      .map((u) => ({ u, ch: byChannel.get(dmChannel(me!.id, u.id)) }))
      .sort((a, b) => (Number(online.has(b.u.id)) - Number(online.has(a.u.id))) || (b.ch?.last_at ?? "").localeCompare(a.ch?.last_at ?? "") || a.u.full_name.localeCompare(b.u.full_name, "vi"));
  }, [users, me, q, byChannel, online]);
  const onlineCount = presence.online.length;
  const othersOnline = presence.online.filter((id) => id !== me!.id).length;

  const Row = ({ id, title, sub, unread, avatar }: { id: string; title: string; sub: string; unread: number; avatar: React.ReactNode }) => (
    <button type="button" onClick={() => onPick(id)} aria-current={current === id ? "true" : undefined}
      className={clsx("flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-left transition-colors",
        current === id ? "bg-[var(--chip)] text-[var(--chip-ink)] shadow-[0_4px_14px_rgba(var(--sh),0.14)]" : "hover:bg-[rgba(var(--ink-rgb),0.05)]")}>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate text-[13.5px]", unread ? "font-semibold" : "font-medium")}>{title}</span>
        <span className="block truncate text-xs text-[var(--ink-3)]">{sub}</span>
      </span>
      {unread > 0 && <span className="min-w-5 rounded-full bg-[#c8352b] px-1.5 text-center text-[11px] font-semibold leading-5 text-white" aria-label={`${unread} tin chưa đọc`}>{unread > 99 ? "99+" : unread}</span>}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <label className="relative mx-1 mb-2 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm đồng nghiệp" aria-label="Tìm đồng nghiệp" className="input min-h-10 w-full pl-9" />
      </label>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1 pb-2">
        <Row id={GENERAL} title="Kênh chung" unread={general?.unread ?? 0}
          sub={general?.last_text ?? `${onlineCount} người đang online`}
          avatar={<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgba(var(--ink-rgb),0.08)]"><Hash className="h-4 w-4" /></span>} />
        <div className="px-2.5 pb-1 pt-3 text-[12px] font-semibold text-[var(--ink-3)]">Đồng nghiệp · {othersOnline} online</div>
        {people.map(({ u, ch }) => (
          <Row key={u.id} id={dmChannel(me!.id, u.id)} title={u.full_name} unread={ch?.unread ?? 0}
            sub={ch?.last_text ? `${ch.last_user_id === me!.id ? "Bạn: " : ""}${ch.last_text}` : online.has(u.id) ? "Đang online" : (u.title ?? lastSeenText(presence.seen[u.id]))}
            avatar={<PresenceAvatar user={u} online={online.has(u.id)} />} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trích dẫn công việc
// ---------------------------------------------------------------------------
const REF_ICON: Record<ChatRefKind, typeof ClipboardList> = { job: ClipboardList, order: PackageOpen, certificate: Award };
const REF_PATH: Record<ChatRefKind, string> = { job: "/jobs/", order: "/orders/", certificate: "/certificates/" };

function RefCard({ r, onNavigate, inverse }: { r: ChatRef; onNavigate?: () => void; inverse?: boolean }) {
  const { row: job } = useRow("jobs", r.kind === "job" ? r.id : null);
  const Icon = REF_ICON[r.kind];
  return (
    <Link to={REF_PATH[r.kind] + r.id} onClick={onNavigate}
      className={clsx("mt-1.5 flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
        inverse ? "border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.08)]" : "border-[var(--edge)] bg-[var(--card-solid)] hover:bg-[rgba(var(--ink-rgb),0.04)]")}>
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-semibold tabular-nums">{r.label}</span>
          {job && <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>}
        </span>
        {r.sub && <span className={clsx("block truncate text-xs", inverse ? "opacity-80" : "text-[var(--ink-3)]")}>{r.sub}</span>}
      </span>
    </Link>
  );
}

const ASK_STATUS: Record<ChatAsk["status"], { label: string; tone: "amber" | "blue" | "green" | "gray" }> = {
  open: { label: "Chờ trả lời", tone: "amber" },
  accepted: { label: "Đã nhận", tone: "blue" },
  done: { label: "Đã xong", tone: "green" },
  declined: { label: "Bận", tone: "gray" },
};

function AskCard({ m, onNavigate }: { m: ChatMessage; onNavigate?: () => void }) {
  const { me, svc, users } = useData();
  const ui = useUi();
  const [busy, setBusy] = useState<string | null>(null);
  const ask = m.ask!;
  const jobRef = m.refs.find((r) => r.kind === "job");
  const toMe = ask.to_user_id === me!.id;
  const st = ASK_STATUS[ask.status];
  const answer = async (s: Exclude<ChatAsk["status"], "open">) => {
    setBusy(s);
    try { await svc.chatAnswer(m.id, s); } catch (e) { ui.error(e); } finally { setBusy(null); }
  };
  const to = users.find((u) => u.id === ask.to_user_id);
  return (
    <div className="w-full min-w-0 max-w-[420px] rounded-2xl border border-[var(--edge)] bg-[var(--card-solid)] p-3 text-[var(--ink)] shadow-[0_4px_14px_rgba(var(--sh),0.08)]">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold">Nhờ {toMe ? "bạn" : to?.full_name ?? ""} {ASK_LABEL[ask.kind]}</span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      {jobRef && <RefCard r={jobRef} onNavigate={onNavigate} />}
      {toMe && ask.status !== "done" && ask.status !== "declined" && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {jobRef && <Link to={`/jobs/${jobRef.id}`} onClick={onNavigate} className="btn btn--primary min-h-11 px-3.5 text-xs sm:min-h-9">Mở phiếu</Link>}
          {ask.status === "open" && <Button size="sm" variant="secondary" className="min-h-11 sm:min-h-9" loading={busy === "accepted"} onClick={() => answer("accepted")}>Nhận</Button>}
          <Button size="sm" variant="secondary" className="min-h-11 sm:min-h-9" loading={busy === "done"} onClick={() => answer("done")}>Đã xong</Button>
          {ask.status === "open" && <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-9" loading={busy === "declined"} onClick={() => answer("declined")}>Bận</Button>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chọn công việc để trích dẫn
// ---------------------------------------------------------------------------
type RefPick = { kind: ChatRefKind; id: string; label: string; sub: string };
function RefPicker({ onPick, onClose }: { onPick: (p: RefPick) => void; onClose: () => void }) {
  const { rows: jobs } = useTable("jobs");
  const { rows: orders } = useTable("orders");
  const { rows: certs } = useTable("certificates");
  const { rows: customers } = useTable("customers");
  const { rows: devices } = useTable("devices");
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const items = useMemo(() => {
    const cus = new Map(customers.map((c) => [c.id, c.name]));
    const dev = new Map(devices.map((d) => [d.id, d]));
    const all: (RefPick & { at: string })[] = [
      ...jobs.map((j) => { const d = dev.get(j.device_id); return { kind: "job" as const, id: j.id, label: j.code, sub: [d?.name, d?.serial, cus.get(j.customer_id), JOB_STATUS_LABEL[j.status]].filter(Boolean).join(" · "), at: j.created_at }; }),
      ...orders.map((o) => ({ kind: "order" as const, id: o.id, label: o.code, sub: `Đơn hàng · ${cus.get(o.customer_id) ?? ""}`, at: o.created_at })),
      ...certs.map((c) => ({ kind: "certificate" as const, id: c.id, label: c.number, sub: `${c.kind === "certificate" ? "GCN" : "Thông báo không đạt"} · ${c.snapshot.device.name} · ${c.snapshot.customer.name}`, at: c.created_at })),
    ];
    const k = q.trim().toLowerCase();
    return all.filter((x) => !k || `${x.label} ${x.sub}`.toLowerCase().includes(k)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  }, [jobs, orders, certs, customers, devices, q]);
  return (
    <div className="rise absolute inset-x-2 bottom-[calc(100%+6px)] z-10 flex max-h-[min(360px,55vh)] flex-col rounded-[18px] border border-[var(--edge)] bg-[var(--card-solid)] p-2 shadow-[0_18px_50px_rgba(var(--sh),0.22)]">
      <div className="flex items-center gap-2 px-1 pb-2">
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Tìm mã phiếu, đơn, số GCN, khách, thiết bị…" aria-label="Tìm công việc để trích dẫn" className="input min-h-10 flex-1" />
        <button type="button" className="round" onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Công việc">
        {items.map((x) => {
          const Icon = REF_ICON[x.kind];
          return (
            <button key={x.kind + x.id} type="button" role="option" aria-selected={false} onClick={() => onPick(x)}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-[rgba(var(--ink-rgb),0.05)]">
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold tabular-nums">{x.label}</span><span className="block truncate text-xs text-[var(--ink-3)]">{x.sub}</span></span>
            </button>
          );
        })}
        {!items.length && <div className="p-4 text-center text-sm text-[var(--ink-3)]">Không tìm thấy</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hội thoại
// ---------------------------------------------------------------------------
function useMessages(channel: string) {
  const { svc, versions } = useData();
  const tv = (versions.chat_messages ?? 0) + (versions["*"] ?? 0);
  const [latest, setLatest] = useState<ChatMessage[] | null>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { setLatest(null); setOlder([]); setHasMore(false); }, [channel]);
  useEffect(() => {
    let cancelled = false;
    svc.chatList(channel, null, 50).then((r) => { if (cancelled) return; setLatest(r); setHasMore((h) => h || r.length === 50); }).catch(() => { if (!cancelled) setLatest([]); });
    return () => { cancelled = true; };
  }, [svc, channel, tv]);
  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...(latest ?? [])].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [older, latest]);
  const loadMore = useCallback(async () => {
    if (!all.length) return;
    setLoadingMore(true);
    try {
      const r = await svc.chatList(channel, all[0].created_at, 50);
      setOlder((o) => [...r, ...o]);
      setHasMore(r.length === 50);
    } finally { setLoadingMore(false); }
  }, [svc, channel, all]);
  return { messages: all, loading: latest === null, hasMore, loadMore, loadingMore };
}

function Thread({ channel, onBack, onNavigate }: { channel: string; onBack?: () => void; onNavigate?: () => void }) {
  const { me, users, svc, presence, typing, sendTyping } = useData();
  const { summary } = useChatDock();
  const ui = useUi();
  const { messages, loading, hasMore, loadMore, loadingMore } = useMessages(channel);
  const [text, setText] = useState("");
  const [refs, setRefs] = useState<RefPick[]>([]);
  const [picker, setPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastCount = useRef(0);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const online = useMemo(() => new Set(presence.online), [presence.online]);
  const isGeneral = channel === GENERAL;
  const peer = isGeneral ? null : byId.get(dmPeer(channel, me!.id));
  const unread = summary.find((s) => s.id === channel)?.unread ?? 0;

  // đang xem kênh có tin mới → đánh dấu đã đọc
  useEffect(() => {
    if (!unread || loading || document.visibilityState !== "visible") return;
    const t = setTimeout(() => svc.chatRead(channel).catch(() => undefined), 300);
    return () => clearTimeout(t);
  }, [unread, loading, channel, svc]);

  // cuộn xuống cuối khi có tin mới (nếu đang ở cuối) hoặc khi mở kênh
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const grewAtEnd = messages.length > lastCount.current && (lastCount.current === 0 || messages[messages.length - 1]?.user_id === me!.id || atBottom.current);
    if (grewAtEnd) el.scrollTop = el.scrollHeight;
    lastCount.current = messages.length;
  }, [messages, me]);
  useEffect(() => { lastCount.current = 0; }, [channel]);

  const send = async () => {
    if (sending || (!text.trim() && !refs.length)) return;
    setSending(true);
    try {
      await svc.chatSend({ channel, text, refs: refs.map((r) => ({ kind: r.kind, id: r.id })) });
      setText(""); setRefs([]); setPicker(false);
    } catch (e) { ui.error(e); } finally { setSending(false); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };
  const typers = (typing[channel] ?? []).filter((u) => u !== me!.id).map((u) => byId.get(u)?.full_name.split(" ").slice(-1)[0]).filter(Boolean);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-[52px] items-center gap-2.5 border-b border-[rgba(var(--ink-rgb),0.08)] px-3 pb-2">
        {onBack && <button type="button" className="round" onClick={onBack} aria-label="Danh sách trò chuyện"><ArrowLeft className="h-4 w-4" /></button>}
        {peer ? <PresenceAvatar user={peer} online={online.has(peer.id)} /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-[rgba(var(--ink-rgb),0.08)]"><Hash className="h-4 w-4" /></span>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{peer ? peer.full_name : "Kênh chung"}</div>
          <div className="truncate text-xs text-[var(--ink-3)]">
            {peer ? <>{online.has(peer.id) ? <span className="font-medium text-[var(--c1-lo)]">Đang online</span> : lastSeenText(presence.seen[peer.id])}{peer.title ? ` · ${peer.title}` : ""}</>
              : `Toàn công ty · ${presence.online.length} người đang online`}
          </div>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-live="polite"
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {hasMore && <div className="mb-2 text-center"><Button size="sm" variant="ghost" loading={loadingMore} onClick={loadMore}>Xem tin cũ hơn</Button></div>}
        {loading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--c1)]" /></div>}
        {!loading && !messages.length && (
          <div className="mx-auto max-w-xs p-6 text-center text-sm text-[var(--ink-3)]">
            {peer ? `Bắt đầu trò chuyện với ${peer.full_name}. Gõ mã phiếu (vd. DH2611-0001-01) hoặc bấm kẹp giấy để trích dẫn công việc.` : "Kênh chung của cả công ty. Mọi người đều đọc được."}
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.user_id === me!.id;
          const newDay = !prev || dayjs(prev.created_at).format("YYYY-MM-DD") !== dayjs(m.created_at).format("YYYY-MM-DD");
          const grouped = !newDay && prev?.user_id === m.user_id && dayjs(m.created_at).diff(prev.created_at, "minute") < 5;
          const author = byId.get(m.user_id);
          const extraRefs = m.ask ? m.refs.filter((r) => r !== m.refs.find((x) => x.kind === "job")) : m.refs;
          return (
            <div key={m.id}>
              {newDay && <div className="my-3 text-center text-xs font-medium text-[var(--ink-3)]">{dayjs(m.created_at).isSame(dayjs(), "day") ? "Hôm nay" : fmtDate(m.created_at)}</div>}
              <div className={clsx("flex items-end gap-2", mine && "justify-end", grouped ? "mt-1" : "mt-3")} data-testid="chat-message">
                {!mine && (grouped ? <span className="w-8 shrink-0" /> : <Avatar name={author?.full_name ?? "?"} size={32} />)}
                <div className={clsx("flex min-w-0 max-w-[82%] flex-col", mine ? "items-end" : "items-start", (m.ask || extraRefs.length > 0) && "w-[420px]")}>
                  {!mine && !grouped && isGeneral && <span className="mb-0.5 px-1 text-xs font-semibold text-[var(--ink-2)]">{author?.full_name ?? "Người dùng đã xoá"}</span>}
                  {m.ask && <AskCard m={m} onNavigate={onNavigate} />}
                  {m.text && (
                    <div className={clsx("mt-1 whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[14px] leading-snug",
                      mine ? "rounded-br-md bg-[var(--accent)] text-[var(--accent-ink)]" : "rounded-bl-md bg-[rgba(var(--ink-rgb),0.07)]")}>{m.text}</div>
                  )}
                  {extraRefs.map((r) => <div key={r.kind + r.id} className="w-full min-w-0 max-w-[420px]"><RefCard r={r} onNavigate={onNavigate} /></div>)}
                  <time className="mt-0.5 px-1 text-[11px] text-[var(--ink-3)]" dateTime={m.created_at}>{fmtTime(m.created_at)}</time>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative border-t border-[rgba(var(--ink-rgb),0.08)] px-2 pt-2">
        {picker && <RefPicker onClose={() => setPicker(false)} onPick={(p) => { setRefs((r) => (r.some((x) => x.id === p.id) ? r : [...r, p].slice(0, 5))); setPicker(false); }} />}
        <div className="min-h-[18px] px-2 text-xs text-[var(--ink-3)]" aria-live="polite">{typers.length ? `${typers.join(", ")} đang gõ…` : ""}</div>
        {refs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-1.5">
            {refs.map((r) => (
              <span key={r.id} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[rgba(var(--ink-rgb),0.07)] pl-3 pr-1 text-xs font-semibold">
                {r.label}
                <button type="button" onClick={() => setRefs((x) => x.filter((y) => y.id !== r.id))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[rgba(var(--ink-rgb),0.08)] sm:h-7 sm:w-7" aria-label={`Bỏ trích dẫn ${r.label}`}><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5 pb-2">
          <button type="button" className="round shrink-0" onClick={() => setPicker((p) => !p)} aria-label="Trích dẫn phiếu, đơn hoặc GCN" title="Trích dẫn công việc" aria-expanded={picker}><Paperclip className="h-[17px] w-[17px]" /></button>
          <textarea value={text} rows={1} maxLength={2000}
            onChange={(e) => { setText(e.target.value); if (e.target.value) sendTyping(channel); }}
            onKeyDown={onKey} aria-label="Nội dung tin nhắn" placeholder={peer ? `Nhắn ${peer.full_name}…` : "Nhắn cả công ty…"}
            className="input max-h-36 min-h-11 flex-1 resize-none py-2.5 leading-snug [field-sizing:content]" />
          <button type="button" onClick={send} disabled={sending || (!text.trim() && !refs.length)} aria-label="Gửi"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] transition disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Toàn bộ khung chat. narrow: chỉ hiện một cột (danh sách hoặc hội thoại) */
export default function ChatView({ channel, onChannel, onNavigate, narrow }: { channel: string | null; onChannel: (c: string | null) => void; onNavigate?: () => void; narrow?: boolean }) {
  if (narrow) {
    return channel
      ? <Thread key={channel} channel={channel} onBack={() => onChannel(null)} onNavigate={onNavigate} />
      : <div className="h-full pt-1"><ConversationList current={null} onPick={onChannel} /></div>;
  }
  return (
    <div className="grid h-full min-h-0 grid-cols-[250px_minmax(0,1fr)] gap-2">
      <div className="min-h-0 border-r border-[rgba(var(--ink-rgb),0.08)] pr-1 pt-1"><ConversationList current={channel ?? GENERAL} onPick={onChannel} /></div>
      <Thread key={channel ?? GENERAL} channel={channel ?? GENERAL} onNavigate={onNavigate} />
    </div>
  );
}
