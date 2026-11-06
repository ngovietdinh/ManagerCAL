import clsx from "clsx";
import {
  Award, Bell, BookOpen, Building2, ClipboardList, FlaskConical, History, LayoutDashboard, LogOut, Menu, PackageOpen, Search, Settings,
  Stamp, Users, UsersRound, X, BarChart3, Gauge,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useData, useTable } from "@/app/data";
import { Avatar } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/labels";
import PasswordModal from "@/components/PasswordModal";
import type { Action } from "@/lib/perm";

type NavItem = { to: string; label: string; icon: typeof Users; end?: boolean; action?: Action };
const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Theo dõi", items: [
    { to: "/", label: "Tổng quan", icon: LayoutDashboard, end: true },
    { to: "/jobs", label: "Phiếu công việc", icon: ClipboardList },
    { to: "/orders", label: "Đơn hàng, tiếp nhận", icon: PackageOpen },
    { to: "/certificates", label: "Giấy chứng nhận", icon: Award },
  ] },
  { title: "Khách hàng", items: [
    { to: "/customers", label: "Khách hàng", icon: Building2 },
    { to: "/devices", label: "Thiết bị của khách", icon: Gauge },
  ] },
  { title: "Kỹ thuật", items: [
    { to: "/standards", label: "Chuẩn đo lường", icon: FlaskConical },
    { to: "/seals", label: "Tem kiểm định", icon: Stamp },
    { to: "/catalog", label: "Danh mục, quy trình", icon: BookOpen },
    { to: "/staff", label: "Nhân sự, ủy quyền", icon: UsersRound },
  ] },
  { title: "Quản trị", items: [
    { to: "/reports", label: "Báo cáo", icon: BarChart3, action: "reports" },
    { to: "/settings", label: "Cài đặt", icon: Settings, action: "settings" },
    { to: "/audit", label: "Nhật ký thao tác", icon: History, action: "audit" },
  ] },
];

export default function MainLayout() {
  const { me, can, logout, mode } = useData();
  const [pwOpen, setPwOpen] = useState(false);
  const { rows: settings } = useTable("settings");
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { rows: notis } = useTable("notifications", { where: { read: false } });
  const unread = notis.filter((n) => n.user_id === me?.id || n.user_id === null).length;
  useEffect(() => setOpen(false), [loc.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <img src="./icons/icon.svg" alt="" className="h-8 w-8" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{settings[0]?.company.short_name ?? "ManagerCAL"}</div>
          <div className="text-xs text-slate-500">Quản lý kiểm định</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => {
          const items = g.items.filter((i) => !i.action || can(i.action));
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => clsx("flex min-h-9 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive ? "bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
                  <Icon className="h-4 w-4" />{label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <Link to="/lookup" className="flex min-h-9 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <Search className="h-4 w-4" /> Tra cứu GCN (công khai)
        </Link>
        <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2">
          {mode === "server"
            ? <button type="button" onClick={() => setPwOpen(true)} className="rounded-full" aria-label="Đổi mật khẩu" title="Đổi mật khẩu"><Avatar name={me?.full_name ?? "?"} size={32} /></button>
            : <Avatar name={me?.full_name ?? "?"} size={32} />}
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-medium">{me?.full_name}</div>
            <div className="truncate text-xs text-slate-500">{me?.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div>
          </div>
          <button type="button" onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Đăng xuất" title="Đăng xuất"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-slate-900">
            <button className="absolute right-3 top-4 p-2" onClick={() => setOpen(false)} aria-label="Đóng menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:px-8">
        <button className="p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu className="h-6 w-6" /></button>
        <div className="flex-1 truncate text-sm text-slate-500">
          {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          {mode === "demo" && <span className="ml-3 rounded-full bg-seal-100 px-2 py-0.5 text-xs font-semibold text-seal-800">Chế độ demo – dữ liệu lưu trong trình duyệt</span>}
        </div>
        <Link to="/notifications" className="relative rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Thông báo">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
        </Link>
      </header>
      {pwOpen && me && <PasswordModal user={me} onClose={() => setPwOpen(false)} />}
      <main className="mx-auto max-w-[1600px] p-4 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
