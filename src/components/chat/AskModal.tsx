// Luồng nhanh từ trang phiếu: "Nhờ đồng nghiệp" soát xét / ký / xem giúp → gửi tin riêng có trích dẫn phiếu
// và lời nhờ (người nhận bấm Nhận / Đã xong ngay trong chat, có thông báo + email).
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useData, useTable } from "@/app/data";
import { Button, Field, Modal, Textarea, useUi } from "@/components/ui";
import { todayStr } from "@/lib/format";
import { ASK_LABEL, dmChannel } from "@/lib/services/chat";
import type { ChatAskKind, Job } from "@/lib/types";
import { useChatDock } from "./ChatDock";
import { PresenceAvatar, lastSeenText } from "./ChatView";

type Kind = ChatAskKind | "share";
const KINDS: { value: Kind; label: string }[] = [
  { value: "review", label: "Soát xét" },
  { value: "sign", label: "Ký phát hành" },
  { value: "check", label: "Xem giúp" },
  { value: "share", label: "Chỉ gửi phiếu" },
];

export default function AskModal({ job, fieldId, open, onClose }: { job: Job; fieldId: string | null; open: boolean; onClose: () => void }) {
  const { me, users, svc, presence } = useData();
  const { openChat } = useChatDock();
  const ui = useUi();
  const { rows: auths } = useTable("authorizations");
  const defaultKind: Kind = job.status === "approval" ? "sign" : job.status === "review" || job.status === "in_progress" ? "review" : "check";
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [to, setTo] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const online = useMemo(() => new Set(presence.online), [presence.online]);

  useEffect(() => { if (open) { setKind(defaultKind); setTo(null); } }, [open, defaultKind]);
  useEffect(() => {
    setText(kind === "share" ? `Phiếu ${job.code}` : `Nhờ anh/chị ${ASK_LABEL[kind]} giúp phiếu ${job.code} với ạ.`);
  }, [kind, job.code]);

  // gợi ý đúng người: có ủy quyền lĩnh vực của phiếu cho việc được nhờ, đang online lên trước
  const people = useMemo(() => {
    const today = todayStr();
    const authorized = (uid: string, role: "review" | "sign" | "perform") => !!fieldId && auths.some((a) => a.user_id === uid && a.field_id === fieldId && a.role === role && a.valid_from <= today && (!a.valid_to || a.valid_to >= today));
    return users
      .filter((u) => u.active && u.id !== me!.id)
      .map((u) => {
        const fit = kind === "review" ? u.id !== job.assignee_id && authorized(u.id, "review")
          : kind === "sign" ? u.roles.includes("signer") && authorized(u.id, "sign")
          : kind === "check" ? authorized(u.id, "perform") || authorized(u.id, "review") : true;
        return { u, fit };
      })
      .sort((a, b) => Number(b.fit) - Number(a.fit) || Number(online.has(b.u.id)) - Number(online.has(a.u.id)) || a.u.full_name.localeCompare(b.u.full_name, "vi"));
  }, [users, me, kind, auths, fieldId, job.assignee_id, online]);

  const send = async () => {
    if (!to) return;
    setBusy(true);
    try {
      const channel = dmChannel(me!.id, to);
      await svc.chatSend({ channel, text, refs: [{ kind: "job", id: job.id }], ask: kind === "share" ? null : { kind, to_user_id: to } });
      const name = users.find((u) => u.id === to)?.full_name ?? "";
      ui.toast(kind === "share" ? `Đã gửi phiếu cho ${name}` : `Đã nhờ ${name} ${ASK_LABEL[kind]}`);
      onClose();
      openChat(channel);
    } catch (e) { ui.error(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Nhờ đồng nghiệp · phiếu ${job.code}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Huỷ</Button>
        <Button onClick={send} loading={busy} disabled={!to}>{kind === "share" ? "Gửi phiếu" : "Gửi lời nhờ"}</Button>
      </>}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Nhờ việc gì" className="glass flex flex-wrap gap-1 rounded-full p-1">
          {KINDS.map((k) => (
            <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
              className={clsx("min-h-9 flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold", kind === k.value ? "bg-[var(--chip)] text-[var(--chip-ink)] shadow-[0_4px_14px_rgba(var(--sh),0.16)]" : "text-[var(--ink-2)]")}>{k.label}</button>
          ))}
        </div>
        <div>
          <div className="label mb-1.5">Gửi cho</div>
          <div role="radiogroup" aria-label="Người nhận" className="max-h-64 space-y-1 overflow-y-auto">
            {people.map(({ u, fit }) => (
              <button key={u.id} type="button" role="radio" aria-checked={to === u.id} onClick={() => setTo(u.id)}
                className={clsx("flex min-h-12 w-full items-center gap-2.5 rounded-2xl border px-2.5 py-1.5 text-left",
                  to === u.id ? "border-[var(--c1)] bg-[rgba(18,162,111,0.08)]" : "border-transparent hover:bg-[rgba(var(--ink-rgb),0.04)]")}>
                <PresenceAvatar user={u} online={online.has(u.id)} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.full_name}</span>
                  <span className="block truncate text-xs text-[var(--ink-3)]">{online.has(u.id) ? "Đang online" : lastSeenText(presence.seen[u.id])}{u.title ? ` · ${u.title}` : ""}</span>
                </span>
                {fit && kind !== "share" && <span className="rounded-full bg-[rgba(var(--ink-rgb),0.07)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)]">Có ủy quyền</span>}
              </button>
            ))}
          </div>
        </div>
        <Field label="Lời nhắn"><Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} /></Field>
      </div>
    </Modal>
  );
}
