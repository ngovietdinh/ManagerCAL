import clsx from "clsx";
import {
  Award, BarChart3, Bell, BookOpen, Building2, ClipboardList, FlaskConical, Gauge, History, KeyRound, LayoutDashboard, LogOut,
  Menu, Moon, PackageOpen, Search, Settings, Stamp, Sun, Users, UsersRound, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useData, useTable } from "@/app/data";
import { useTheme } from "@/app/theme";
import PasswordModal from "@/components/PasswordModal";
import { Avatar } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/labels";
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
/** Dock điện thoại: 4 mục hay dùng + "Thêm" */
const DOCK: NavItem[] = [GROUPS[0].items[0], GROUPS[0].items[1], GROUPS[0].items[2], GROUPS[0].items[3]];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  return <b className="tabular-nums">{now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</b>;
}

export default function MainLayout() {
  const { me, can, logout, mode } = useData();
  const { rows: settings } = useTable("settings");
  const { dark, toggle } = useTheme();
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  const { rows: notis } = useTable("notifications", { where: { read: false } });
  const unread = notis.filter((n) => n.user_id === me?.id || n.user_id === null).length;
  const company = settings[0]?.company;
  useEffect(() => { setSheet(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.action || can(i.action)) })).filter((g) => g.items.length);

  const navList = (
    <nav className="space-y-4" aria-label="Điều hướng chính">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="px-3 pb-1.5 text-[12px] font-semibold text-[var(--ink-3)]">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => clsx("flex min-h-10 items-center gap-3 rounded-full px-3 text-[13.5px] font-medium transition-colors",
                  isActive ? "bg-[var(--chip)] text-[var(--chip-ink)] shadow-[0_4px_14px_rgba(var(--sh),0.16)]" : "text-[var(--ink-2)] hover:bg-[rgba(var(--hi),calc(0.4*var(--gk)))]")}>
                <Icon className="h-[18px] w-[18px] shrink-0" />{label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      {/* thanh trên – kính, dạng viên thuốc */}
      <header className="glass no-print fixed inset-x-3 top-3 z-40 flex h-[58px] items-center gap-3 rounded-[20px] px-2.5 lg:inset-x-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-full pr-2">
          <img src="./icons/icon.svg" alt="" className="h-10 w-10 shrink-0 rounded-full border-2 border-[rgba(var(--hi),calc(0.9*var(--gk)))] shadow-[0_2px_8px_rgba(var(--sh),0.18)]" />
          <span className="flex min-w-0 flex-col leading-tight">
            <b className="truncate text-sm font-semibold">{company?.short_name || company?.name || "ManagerCAL"}</b>
            <small className="truncate text-[12px] text-[var(--ink-3)]">Quản lý kiểm định phương tiện đo</small>
          </span>
        </Link>
        <div className="flex-1" />
        <div className="hidden h-[38px] items-center gap-2.5 rounded-full border border-[rgba(var(--hi),calc(0.32*var(--gk)))] bg-[rgba(var(--hi),calc(0.16*var(--gk)))] px-4 text-[13px] md:flex">
          <span className={clsx("h-2 w-2 rounded-full", mode === "server" ? "bg-[var(--c1)]" : "bg-[var(--c3)]")} aria-hidden />
          <span>{mode === "server" ? "Máy chủ · dữ liệu dùng chung" : "Demo · dữ liệu trong trình duyệt"}</span>
          <span className="h-4 w-px bg-[rgba(var(--ink-rgb),0.15)]" aria-hidden />
          <span className="text-[var(--ink-2)]">{new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
          <Clock />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Link to="/lookup" className="round hidden sm:grid" aria-label="Tra cứu GCN công khai" title="Tra cứu GCN công khai"><Search className="h-[17px] w-[17px]" /></Link>
          <button type="button" className="round" onClick={toggle} aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} title={dark ? "Giao diện sáng" : "Giao diện tối"}>
            {dark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          </button>
          <Link to="/notifications" className="round" aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}>
            <Bell className="h-[17px] w-[17px]" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#c8352b] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <div className="relative" ref={menuRef}>
            <button type="button" className="round round--white overflow-hidden p-0" onClick={() => setMenu((m) => !m)} aria-label="Tài khoản" aria-expanded={menu}>
              <Avatar name={me?.full_name ?? "?"} size={38} />
            </button>
            {menu && (
              <div className="rise absolute right-0 top-[50px] z-50 w-64 rounded-[18px] border border-[var(--edge)] bg-[var(--card-solid)] p-2 shadow-[0_18px_50px_rgba(var(--sh),0.22)]">
                <div className="px-3 py-2">
                  <div className="truncate text-sm font-semibold">{me?.full_name}</div>
                  <div className="truncate text-xs text-[var(--ink-3)]">{me?.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div>
                </div>
                {mode === "server" && (
                  <button type="button" onClick={() => { setMenu(false); setPwOpen(true); }} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)]">
                    <KeyRound className="h-4 w-4" /> Đổi mật khẩu
                  </button>
                )}
                <Link to="/lookup" className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)] sm:hidden"><Search className="h-4 w-4" /> Tra cứu GCN</Link>
                <button type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)]">
                  <LogOut className="h-4 w-4" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* thanh bên – kính, máy tính */}
      <aside className="glass no-print fixed bottom-4 left-4 top-[86px] z-30 hidden w-[236px] overflow-y-auto rounded-[20px] p-3 lg:block">
        {navList}
      </aside>

      {/* dock – kính, điện thoại */}
      <nav className="glass no-print fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 pb-safe lg:hidden" aria-label="Điều hướng nhanh">
        {DOCK.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} aria-label={label}
            className={({ isActive }) => clsx("grid h-11 w-11 place-items-center rounded-full", isActive ? "bg-[var(--chip)] text-[var(--chip-ink)] shadow-[0_4px_14px_rgba(var(--sh),0.18)]" : "text-[var(--ink)]")}>
            <Icon className="h-5 w-5" />
          </NavLink>
        ))}
        <button type="button" onClick={() => setSheet(true)} className="grid h-11 w-11 place-items-center rounded-full" aria-label="Mở toàn bộ mục"><Menu className="h-5 w-5" /></button>
      </nav>
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Điều hướng">
          <div className="absolute inset-0 bg-[rgba(20,16,12,0.38)] backdrop-blur-[3px]" onClick={() => setSheet(false)} />
          <div className="rise absolute inset-x-3 bottom-3 max-h-[80dvh] overflow-y-auto rounded-[22px] border border-[var(--edge)] bg-[var(--card-solid)] p-3 pb-safe shadow-[0_24px_60px_rgba(var(--sh),0.28)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <b className="text-[15px]">Tất cả mục</b>
              <button type="button" className="round" onClick={() => setSheet(false)} aria-label="Đóng"><X className="h-4 w-4" /></button>
            </div>
            {navList}
          </div>
        </div>
      )}

      {pwOpen && me && <PasswordModal user={me} onClose={() => setPwOpen(false)} />}
      <main className="app-main mx-auto max-w-[1680px] px-3 pb-28 pt-[86px] lg:pb-8 lg:pl-[268px] lg:pr-6">
        <Outlet />
      </main>
    </div>
  );
}
