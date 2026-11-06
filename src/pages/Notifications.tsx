import clsx from "clsx";
import { Bell } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useTable } from "@/app/data";
import { Button, Empty, Loading, PageHeader, useUi } from "@/components/ui";
import { fmtDateTime, fmtRelative } from "@/lib/format";

export default function Notifications() {
  const { me, svc } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const { rows, loading } = useTable("notifications", { orderBy: { field: "created_at", dir: "desc" } });
  const mine = useMemo(() => rows.filter((n) => n.user_id !== "system" && (n.user_id === null || n.user_id === me?.id)), [rows, me]);
  const unread = mine.filter((n) => !n.read);

  const open = async (id: string, link: string | null, read: boolean) => {
    try {
      if (!read) await svc.repo.update("notifications", id, { read: true });
      if (link) nav(link);
    } catch (e) { ui.error(e); }
  };
  const readAll = async () => {
    try {
      for (const n of unread) await svc.repo.update("notifications", n.id, { read: true });
      ui.toast("Đã đánh dấu tất cả đã đọc");
    } catch (e) { ui.error(e); }
  };

  return (
    <>
      <PageHeader title="Thông báo" subtitle={unread.length ? `${unread.length} chưa đọc` : "Không có thông báo mới"}
        actions={unread.length > 0 && <Button variant="secondary" size="sm" onClick={readAll}>Đánh dấu tất cả đã đọc</Button>} />
      {loading ? <Loading /> : mine.length === 0 ? <Empty text="Chưa có thông báo nào. Việc được phân công, phiếu chờ duyệt, chuẩn sắp hết hạn sẽ hiện ở đây." icon={<Bell className="h-8 w-8 text-slate-300" />} /> : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {mine.map((n) => (
            <button key={n.id} type="button" onClick={() => open(n.id, n.link, n.read)}
              className={clsx("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60", !n.read && "bg-brand-50/40 dark:bg-brand-900/10")}>
              <span className={clsx("mt-2 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-600")} />
              <div className="min-w-0 flex-1">
                <div className={clsx("text-sm", !n.read && "font-semibold")}>{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-slate-500">{n.body}</div>}
                <div className="mt-1 text-xs text-slate-400" title={fmtDateTime(n.created_at)}>{fmtRelative(n.created_at)}{n.user_id === null && " · gửi tất cả"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
