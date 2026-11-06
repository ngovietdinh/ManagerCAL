import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useData } from "@/app/data";
import { Avatar, Button, Checkbox, Field, Input, useUi } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { ROLE_LABEL } from "@/lib/labels";

function Brand() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <img src="./icons/icon.svg" alt="" className="h-12 w-12" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ManagerCAL</h1>
        <p className="text-sm text-slate-500">Quản lý công ty kiểm định phương tiện đo</p>
      </div>
    </div>
  );
}

export default function Login() {
  const { me, mode, needsSetup } = useData();
  if (me) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Brand />
        {mode === "demo" ? <DemoLogin /> : needsSetup ? <SetupForm /> : <PasswordLogin />}
      </div>
    </div>
  );
}

function PasswordLogin() {
  const { loginWithPassword } = useData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await loginWithPassword(email.trim(), password); /* Login tự chuyển về "/" khi đã có người dùng */ }
    catch (x) { setErr(errorMessage(x)); }
    finally { setBusy(false); }
  };
  return (
    <form className="card grid gap-3 p-5" onSubmit={submit}>
      <h2 className="text-base font-semibold">Đăng nhập</h2>
      <Field label="Email"><Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="Mật khẩu" error={err}><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <Button type="submit" size="lg" loading={busy} className="mt-1">Đăng nhập</Button>
      <p className="text-xs text-slate-500">Quên mật khẩu? Nhờ quản trị đặt lại trong mục Nhân sự, ủy quyền.</p>
    </form>
  );
}

function SetupForm() {
  const { setup } = useData();
  const [f, setF] = useState({ company_name: "", full_name: "", email: "", password: "", password2: "", demo: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password !== f.password2) { setErr("Hai lần nhập mật khẩu không khớp."); return; }
    setBusy(true); setErr(null);
    try {
      await setup({ company_name: f.company_name.trim(), full_name: f.full_name.trim(), email: f.email.trim(), password: f.password, demo: f.demo });
    } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <form className="card grid gap-3 p-5" onSubmit={submit}>
      <div>
        <h2 className="text-base font-semibold">Khởi tạo hệ thống</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Máy chủ chưa có dữ liệu. Tạo tài khoản quản trị đầu tiên; sau đó thêm nhân viên trong mục Nhân sự, ủy quyền.</p>
      </div>
      <Field label="Tên công ty"><Input value={f.company_name} onChange={(e) => set({ company_name: e.target.value })} placeholder="Công ty TNHH Kiểm định …" /></Field>
      <Field label="Họ tên quản trị *"><Input value={f.full_name} onChange={(e) => set({ full_name: e.target.value })} required /></Field>
      <Field label="Email đăng nhập *"><Input type="email" autoComplete="username" value={f.email} onChange={(e) => set({ email: e.target.value })} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mật khẩu * (ít nhất 8 ký tự)"><Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => set({ password: e.target.value })} required minLength={8} /></Field>
        <Field label="Nhập lại mật khẩu *"><Input type="password" autoComplete="new-password" value={f.password2} onChange={(e) => set({ password2: e.target.value })} required minLength={8} /></Field>
      </div>
      <Checkbox checked={f.demo} onChange={(v) => set({ demo: v })} className="min-h-7"
        label={<span>Nạp dữ liệu mẫu để dùng thử <span className="block text-xs text-slate-500">7 nhân viên mẫu, khách hàng, đơn hàng, GCN. Bạn đăng nhập bằng email trên; nhân viên mẫu dùng email @kdviet.vn với cùng mật khẩu. Dùng thật thì bỏ chọn.</span></span>} />
      {err && <p className="text-sm text-red-700 dark:text-red-300">{err}</p>}
      <Button type="submit" size="lg" loading={busy}>Khởi tạo và đăng nhập</Button>
    </form>
  );
}

function DemoLogin() {
  const { users, login, resetDemo } = useData();
  const ui = useUi();
  const [busy, setBusy] = useState<string | null>(null);
  const pick = async (id: string) => {
    setBusy(id);
    try { await login(id); } catch (e) { ui.error(e); } finally { setBusy(null); }
  };
  return (
    <div className="card p-4">
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
    </div>
  );
}
