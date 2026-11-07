import clsx from "clsx";
import {
  Award, BarChart3, Bell, BookOpen, Building2, ClipboardList, FlaskConical, Gauge, History, KeyRound, LayoutDashboard, LogOut,
  Menu, MessagesSquare, Moon, PackageOpen, Search, Settings, Stamp, Sun, Users, UsersRound, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useData, useTable } from "@/app/data";
import { useTheme } from "@/app/theme";
import { useCardTables } from "@/app/useCardTables";
import PasswordModal from "@/components/PasswordModal";
import { Avatar } from "@/components/ui";
import { ChatDockProvider, useChatDock } from "@/components/chat/ChatDock";
import ChatView, { PresenceAvatar } from "@/components/chat/ChatView";
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

/** Ai đang online (trừ mình): chồng ảnh đại diện, bấm để mở chat */
function OnlineStack() {
  const { me, users, presence, linkStatus } = useData();
  const { openChat } = useChatDock();
  const others = presence.online.filter((id) => id !== me?.id).map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u);
  const label = linkStatus === "offline" ? "Mất kết nối đồng bộ – đang thử lại" : others.length ? `${others.length} đồng nghiệp đang online: ${others.map((u) => u.full_name).join(", ")}` : "Chưa có đồng nghiệp nào online";
  return (
    <button type="button" onClick={() => openChat()} title={label} aria-label={label}
      className="hidden h-[38px] items-center gap-2 rounded-full border border-[rgba(var(--hi),calc(0.32*var(--gk)))] bg-[rgba(var(--hi),calc(0.16*var(--gk)))] pl-1.5 pr-3 text-[13px] lg:flex">
      <span className="flex items-center gap-1">
        {others.slice(0, 4).map((u) => <PresenceAvatar key={u.id} user={u} online size={26} />)}
        {!others.length && <span className={clsx("ml-1.5 h-2 w-2 rounded-full", linkStatus === "offline" ? "bg-[#c8352b]" : "bg-[#12a26f]")} aria-hidden />}
      </span>
      <span className="whitespace-nowrap tabular-nums">{linkStatus === "offline" ? "Mất kết nối" : others.length > 4 ? `+${others.length - 4} online` : `${others.length} online`}</span>
    </button>
  );
}

function ChatButton() {
  const { unread, open, openChat, close } = useChatDock();
  return (
    <button type="button" className="round" onClick={() => (open ? close() : openChat())} aria-label={`Trao đổi nội bộ${unread ? `, ${unread} tin chưa đọc` : ""}`} aria-expanded={open} title="Trao đổi nội bộ">
      <MessagesSquare className="h-[17px] w-[17px]" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#c8352b] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
  );
}

/** Khung chat trượt từ phải (máy tính) – vẫn làm việc với trang bên dưới */
function ChatDrawer() {
  const { open, close, channel, setChannel } = useChatDock();
  const loc = useLocation();
  useEffect(() => { if (loc.pathname.startsWith("/chat")) close(); }, [loc.pathname, close]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, close]);
  if (!open) return null;
  return (
    <section role="dialog" aria-label="Trao đổi nội bộ" className="rise no-print fixed bottom-4 right-4 top-[86px] z-[45] hidden w-[min(780px,calc(100vw-300px))] flex-col rounded-[22px] border border-[var(--edge)] bg-[var(--card-solid)] p-3 shadow-[0_24px_60px_rgba(var(--sh),0.28)] lg:flex">
      <div className="mb-2 flex items-center justify-between px-1">
        <b className="text-[15px]">Trao đổi nội bộ</b>
        <button type="button" className="round" onClick={close} aria-label="Đóng khung chat"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1"><ChatView channel={channel} onChannel={setChannel} /></div>
    </section>
  );
}

export default function MainLayout() {
  return <ChatDockProvider><Layout /></ChatDockProvider>;
}

function Layout() {
  const { me, can, logout, mode, linkStatus } = useData();
  useCardTables();
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
            <small className="hidden truncate text-[12px] text-[var(--ink-3)] sm:block">Quản lý kiểm định phương tiện đo</small>
          </span>
        </Link>
        <div className="flex-1" />
        <div className="hidden h-[38px] items-center gap-2.5 rounded-full border border-[rgba(var(--hi),calc(0.32*var(--gk)))] bg-[rgba(var(--hi),calc(0.16*var(--gk)))] whitespace-nowrap px-4 text-[13px] md:flex">
          <span className={clsx("h-2 w-2 rounded-full", mode === "server" ? "bg-[var(--c1)]" : "bg-[var(--c3)]")} aria-hidden />
          <span>{mode === "server" ? "Máy chủ · dữ liệu dùng chung" : "Demo · dữ liệu trong trình duyệt"}</span>
          <span className="h-4 w-px bg-[rgba(var(--ink-rgb),0.15)] lg:max-xl:hidden" aria-hidden />
          <span className="text-[var(--ink-2)] lg:max-xl:hidden">{new Date().toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
          <span className="lg:max-xl:hidden"><Clock /></span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <OnlineStack />
          <Link to="/lookup" className="round hidden sm:grid" aria-label="Tra cứu GCN công khai" title="Tra cứu GCN công khai"><Search className="h-[17px] w-[17px]" /></Link>
          <button type="button" className="round hidden sm:grid" onClick={toggle} aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} title={dark ? "Giao diện sáng" : "Giao diện tối"}>
            {dark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          </button>
          <ChatButton />
          <Link to="/notifications" className="round" aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}>
            <Bell className="h-[17px] w-[17px]" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#c8352b] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <div className="relative" ref={menuRef}>
            <button type="button" className="round round--white overflow-hidden p-0" onClick={() => setMenu((m) => !m)} aria-label="Tài khoản" aria-expanded={menu}
              title={linkStatus === "online" ? "Bạn đang online" : linkStatus === "connecting" ? "Đang kết nối…" : "Mất kết nối – đang thử lại"}>
              <Avatar name={me?.full_name ?? "?"} size={38} />
            </button>
            {/* chấm trạng thái của chính mình: xanh = online, hổ phách = đang kết nối, đỏ = mất kết nối */}
            <span aria-hidden className={clsx("pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--card-solid)]",
              linkStatus === "online" ? "bg-[#12a26f]" : linkStatus === "connecting" ? "bg-[#e0a100]" : "bg-[#c8352b]")} />
            {menu && (
              <div className="rise absolute right-0 top-[50px] z-50 w-64 rounded-[18px] border border-[var(--edge)] bg-[var(--card-solid)] p-2 shadow-[0_18px_50px_rgba(var(--sh),0.22)]">
                <div className="px-3 py-2">
                  <div className="truncate text-sm font-semibold">{me?.full_name}</div>
                  <div className="truncate text-xs text-[var(--ink-3)]">{me?.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div>
                </div>
                {mode === "server" && (
                  <button type="button" onClick={() => { setMenu(false); setPwOpen(true); }} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)]">
                    <KeyRound className="h-4 w-4" /> Đổi mật khẩu
                  </button>
                )}
                <Link to="/lookup" className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)] sm:hidden"><Search className="h-4 w-4" /> Tra cứu GCN</Link>
                <button type="button" onClick={toggle} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)] sm:hidden">
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Giao diện sáng" : "Giao diện tối"}
                </button>
                <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-[rgba(var(--ink-rgb),0.06)]">
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
      <ChatDrawer />
      <main className="app-main mx-auto max-w-[1680px] px-3 pb-28 pt-[86px] lg:pb-8 lg:pl-[268px] lg:pr-6">
        <Outlet />
      </main>
    </div>
  );
}
