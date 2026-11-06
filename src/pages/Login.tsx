import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useData } from "@/app/data";
import { Avatar, Button, useUi } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/labels";

export default function Login() {
  const { me, users, login, mode, resetDemo } = useData();
  const nav = useNavigate();
  const ui = useUi();
  const [busy, setBusy] = useState<string | null>(null);
  if (me) return <Navigate to="/" replace />;

  const pick = async (id: string) => {
    setBusy(id);
    try { await login(id); nav("/", { replace: true }); } catch (e) { ui.error(e); } finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <img src="./icons/icon.svg" alt="" className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ManagerCAL</h1>
            <p className="text-sm text-slate-500">Quản lý công ty kiểm định phương tiện đo</p>
          </div>
        </div>
        <div className="card p-4">
          {mode === "demo" ? (
            <>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Chế độ demo: chọn một người để vào làm việc với vai trò của người đó. Dữ liệu lưu trong trình duyệt này.</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.filter((u) => u.active).map((u) => (
                  <button key={u.id} type="button" onClick={() => pick(u.id)} disabled={!!busy}
                    className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <Avatar name={u.full_name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{u.full_name} <span className="text-xs text-slate-500">· {u.title}</span></div>
                      <div className="truncate text-xs text-slate-500">{u.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                <span>Muốn làm lại từ đầu?</span>
                <Button size="sm" variant="ghost" onClick={async () => { if (await ui.confirm({ title: "Nạp lại dữ liệu demo?", message: "Mọi thay đổi bạn đã làm trong trình duyệt này sẽ mất.", danger: true, confirmText: "Nạp lại" })) resetDemo(); }}>Nạp lại dữ liệu demo</Button>
              </div>
            </>
          ) : (
            <p className="text-sm">Chế độ máy chủ chưa được bật trong bản này.</p>
          )}
        </div>
      </div>
    </div>
  );
}
