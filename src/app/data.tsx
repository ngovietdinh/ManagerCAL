// =============================================================================
// Ngữ cảnh dữ liệu: kho lưu trữ, lớp nghiệp vụ, người dùng hiện tại, hook đọc bảng.
//
// Hai chế độ, tự chọn khi mở app:
//  - "server": có API máy chủ (Cloudflare Worker + D1) → đăng nhập email/mật khẩu, dữ liệu dùng chung.
//  - "demo":   không có API (chạy dev, hoặc đặt trên hosting tĩnh như R2) → dữ liệu mẫu trong trình duyệt.
// =============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiBase } from "@/lib/config";
import { Services } from "@/lib/services";
import { LocalRepo, idbClear } from "@/lib/store/local";
import { RemoteRepo, detectServer, remoteServices } from "@/lib/store/remote";
import { demoLink, serverLink, type LinkStatus, type Presence, type RealtimeLink } from "@/lib/store/realtime";
import type { Repo, Query } from "@/lib/store/repo";
import { DEMO_VERSION, seedDemo } from "@/lib/seed/demo";
import type { Row, TableName, User } from "@/lib/types";
import { can, type Action } from "@/lib/perm";

export interface SetupInput { company_name: string; full_name: string; email: string; password: string; demo: boolean }

interface DataCtx {
  repo: Repo;
  svc: Services;
  me: User | null;
  users: User[];
  mode: "demo" | "server";
  /** chế độ máy chủ: hệ thống chưa có người dùng nào → cần khởi tạo */
  needsSetup: boolean;
  /** chế độ máy chủ: kết nối API (đổi mật khẩu, sao lưu…) */
  api: RemoteRepo | null;
  login: (userId: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  setup: (input: SetupInput) => Promise<void>;
  logout: () => Promise<void>;
  can: (a: Action) => boolean;
  resetDemo: () => Promise<void>;
  version: number; // tăng mỗi khi dữ liệu đổi (bất kỳ bảng nào)
  /** phiên bản riêng từng bảng – trang chỉ tải lại khi bảng nó dùng thay đổi */
  versions: Record<string, number>;
  /** ai đang mở ứng dụng; lần cuối thấy (ms) */
  presence: Presence;
  linkStatus: LinkStatus;
  /** người đang gõ trong kênh */
  typing: Record<string, string[]>;
  sendTyping: (channel: string) => void;
}

const Ctx = createContext<DataCtx | null>(null);
const LS_USER = "managercal.user";
const LS_DEMO = "managercal.demo";

// Nạp kho và (nếu trống) dữ liệu demo đúng một lần cho mỗi kho,
// kể cả khi React chạy hiệu ứng hai lần (StrictMode).
// Trình duyệt còn giữ bộ demo đời trước → xoá và nạp bộ demo hiện hành.
const inits = new WeakMap<LocalRepo, Promise<void>>();
function initOnce(repo: LocalRepo): Promise<void> {
  let p = inits.get(repo);
  if (!p) {
    p = repo.load().then(async (had) => {
      const stale = had && localStorage.getItem(LS_DEMO) !== DEMO_VERSION;
      if (stale) { await idbClear(); await repo.replaceAll({}, {}); localStorage.removeItem(LS_USER); }
      if (!had || stale) { await seedDemo(repo); localStorage.setItem(LS_DEMO, DEMO_VERSION); }
    }).then(() => repo.flush());
    inits.set(repo, p);
  }
  return p;
}

interface Boot { mode: "demo" | "server"; repo: Repo; svc: Services; api: RemoteRepo | null; needsSetup: boolean }
let bootPromise: Promise<Boot> | null = null;

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [versions, setVersions] = useState<Record<string, number>>({});
  const version = versions.__all ?? 0;
  const [presence, setPresence] = useState<Presence>({ online: [], seen: {} });
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("connecting");
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const linkRef = useRef<RealtimeLink | null>(null);
  // gom nhiều thay đổi liền nhau thành một lần vẽ lại
  const pending = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bump = useCallback((t: string) => {
    pending.current.add(t);
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      const ts = [...pending.current];
      pending.current.clear();
      setVersions((v) => {
        const n: Record<string, number> = { ...v, __all: (v.__all ?? 0) + 1 };
        for (const x of ts) n[x] = (n[x] ?? 0) + 1;
        return n;
      });
    }, 40);
  }, []);
  const [needsSetup, setNeedsSetup] = useState(false);
  const meRef = useRef<User | null>(null);
  meRef.current = me;

  // ---- khởi động: chọn chế độ (một lần cho cả trang)
  useEffect(() => {
    let cancelled = false;
    bootPromise ??= (async (): Promise<Boot> => {
      const health = await detectServer(apiBase);
      if (health) {
        const api = new RemoteRepo(apiBase);
        return { mode: "server", repo: api, api, svc: remoteServices(api, () => meRef.current), needsSetup: health.needsSetup };
      }
      const repo = new LocalRepo();
      await initOnce(repo);
      return { mode: "demo", repo, api: null, svc: new Services(repo, () => meRef.current), needsSetup: false };
    })();
    bootPromise.then(async (b) => {
      if (cancelled) return;
      // các hàm dùng meRef phải trỏ vào ref của lần render này
      if (b.mode === "server") b.svc = remoteServices(b.api!, () => meRef.current);
      else b.svc = new Services(b.repo, () => meRef.current);
      let u: User | null = null;
      if (b.mode === "server") {
        b.api!.onAuthLost = () => setMe(null);
        if (!b.needsSetup) u = await b.api!.me().catch(() => null);
      } else {
        const list = await b.repo.list("users");
        const savedId = localStorage.getItem(LS_USER);
        u = list.find((x) => x.id === savedId && x.active) ?? null;
      }
      if (cancelled) return;
      setBoot(b);
      setNeedsSetup(b.needsSetup);
      meRef.current = u;
      setMe(u);
      setReady(true);
      if (u) b.svc.runDailyChecks().catch(console.error);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!boot) return;
    return boot.repo.subscribe((t) => bump(t));
  }, [boot, bump]);

  // ---- kết nối thời gian thực khi đã đăng nhập
  useEffect(() => {
    if (!boot || !me) { setPresence({ online: [], seen: {} }); return; }
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const ev = {
      changed: (tables: string[]) => { for (const t of tables) boot.api ? boot.api.emit(t as TableName) : bump(t); },
      presence: setPresence,
      status: setLinkStatus,
      typing: (uid: string, channel: string) => {
        setTyping((x) => ({ ...x, [channel]: [...new Set([...(x[channel] ?? []), uid])] }));
        const k = `${channel}|${uid}`;
        clearTimeout(typingTimers.get(k));
        typingTimers.set(k, setTimeout(() => setTyping((x) => ({ ...x, [channel]: (x[channel] ?? []).filter((u) => u !== uid) })), 4000));
      },
    };
    let link: RealtimeLink;
    if (boot.mode === "server") link = serverLink(apiBase, ev);
    else {
      const local = boot.repo as LocalRepo;
      link = demoLink(me, ev, { onLocalFlush: (fn) => { local.onFlushed = fn; }, reload: (t) => local.reload(t) });
    }
    linkRef.current = link;
    return () => { link.stop(); linkRef.current = null; typingTimers.forEach(clearTimeout); };
  }, [boot, me?.id, bump]);

  const loadUsers = useCallback(async () => {
    if (!boot) return [];
    if (boot.mode === "server" && !meRef.current) { setUsers([]); return []; }
    const list = await boot.repo.list("users", { orderBy: { field: "code" } });
    setUsers(list);
    return list;
  }, [boot]);

  // danh sách người dùng + làm mới hồ sơ của mình khi dữ liệu đổi
  useEffect(() => {
    if (!boot) return;
    loadUsers().catch(() => undefined);
    if (me) boot.repo.get("users", me.id).then((u) => {
      if (!u || !u.active) { setMe(null); return; }
      if (JSON.stringify(u) !== JSON.stringify(me)) setMe(u);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.users, versions["*"], boot, me?.id]);

  const value = useMemo<DataCtx | null>(() => {
    if (!boot) return null;
    const enter = (u: User) => {
      meRef.current = u;
      setMe(u);
      boot.svc.runDailyChecks().catch(console.error);
    };
    return {
      repo: boot.repo, svc: boot.svc, api: boot.api, me, users, version, versions, mode: boot.mode, needsSetup,
      presence, linkStatus, typing, sendTyping: (channel) => linkRef.current?.typing(channel),
      login: async (userId) => {
        const u = await boot.repo.get("users", userId);
        if (!u || !u.active) throw new Error("INACTIVE_USER");
        localStorage.setItem(LS_USER, u.id);
        enter(u);
      },
      loginWithPassword: async (email, password) => {
        const r = await boot.api!.post<{ user: User }>("/login", { email, password });
        enter(r.user);
      },
      setup: async (input) => {
        await boot.api!.post("/setup", input);
        setNeedsSetup(false);
        const u = await boot.api!.me();
        if (u) enter(u);
      },
      logout: async () => {
        if (boot.mode === "server") await boot.api!.post("/logout", {}).catch(() => undefined);
        localStorage.removeItem(LS_USER);
        meRef.current = null;
        setMe(null);
      },
      can: (a) => can(me, a),
      resetDemo: async () => {
        await idbClear();
        localStorage.removeItem(LS_USER);
        location.reload();
      },
    };
  }, [boot, me, users, version, versions, needsSetup, presence, linkStatus, typing]);

  if (!ready || !value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("DataProvider missing");
  return c;
}

/** Đọc một bảng, tự tải lại khi dữ liệu đổi */
export function useTable<T extends TableName>(table: T, q?: Query<Row<T>>): { rows: Row<T>[]; loading: boolean; error: unknown; reload: () => void } {
  const { repo, versions, me } = useData();
  const tv = (versions[table] ?? 0) + (versions["*"] ?? 0);
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const qKey = JSON.stringify(q ?? {});
  const reload = useCallback(() => {
    repo.list(table, JSON.parse(qKey)).then((r) => { setRows(r); setError(null); }).catch(setError).finally(() => setLoading(false));
  }, [repo, table, qKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload, tv, me?.id]);
  return { rows, loading, error, reload };
}

/** Đọc một dòng theo id */
export function useRow<T extends TableName>(table: T, id: string | null | undefined): { row: Row<T> | null; loading: boolean; reload: () => void } {
  const { repo, versions } = useData();
  const tv = (versions[table] ?? 0) + (versions["*"] ?? 0);
  const [row, setRow] = useState<Row<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    if (!id) { setRow(null); setLoading(false); return; }
    repo.get(table, id).then(setRow).catch(() => setRow(null)).finally(() => setLoading(false));
  }, [repo, table, id]);
  useEffect(() => { reload(); }, [reload, tv]);
  return { row, loading, reload };
}

/** Bản đồ id → dòng, tiện tra tên */
export function useIndex<T extends TableName>(table: T): Record<string, Row<T>> {
  const { rows } = useTable(table);
  return useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);
}
