// =============================================================================
// Ngữ cảnh dữ liệu: kho lưu trữ, lớp nghiệp vụ, người dùng hiện tại, hook đọc bảng.
// =============================================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isServerMode } from "@/lib/config";
import { Services } from "@/lib/services";
import { LocalRepo, idbClear } from "@/lib/store/local";
import type { Repo, Query } from "@/lib/store/repo";
import { seedDemo } from "@/lib/seed/demo";
import type { Row, TableName, User } from "@/lib/types";
import { can, type Action } from "@/lib/perm";

interface DataCtx {
  repo: Repo;
  svc: Services;
  me: User | null;
  users: User[];
  mode: "demo" | "server";
  login: (userId: string) => Promise<void>;
  logout: () => void;
  can: (a: Action) => boolean;
  resetDemo: () => Promise<void>;
  version: number; // tăng mỗi khi dữ liệu đổi
}

const Ctx = createContext<DataCtx | null>(null);
const LS_USER = "managercal.user";

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [version, setVersion] = useState(0);
  const meRef = useRef<User | null>(null);
  meRef.current = me;

  const repo = useMemo<Repo>(() => new LocalRepo(), []);
  const svc = useMemo(() => new Services(repo, () => meRef.current), [repo]);

  const loadUsers = useCallback(async () => {
    const list = await repo.list("users", { orderBy: { field: "code" } });
    setUsers(list);
    return list;
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = repo as LocalRepo;
      const had = await local.load();
      if (!had) await seedDemo(repo);
      const list = await loadUsers();
      const savedId = localStorage.getItem(LS_USER);
      const u = list.find((x) => x.id === savedId && x.active) ?? null;
      if (!cancelled) { setMe(u); setReady(true); }
      if (u) { meRef.current = u; svc.runDailyChecks().catch(console.error); }
    })();
    const unsub = repo.subscribe(() => setVersion((v) => v + 1));
    return () => { cancelled = true; unsub(); };
  }, [repo, svc, loadUsers]);

  // làm mới hồ sơ người dùng hiện tại khi bảng users đổi
  useEffect(() => {
    if (!me) return;
    repo.get("users", me.id).then((u) => { if (u && JSON.stringify(u) !== JSON.stringify(me)) setMe(u); });
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const value = useMemo<DataCtx>(() => ({
    repo, svc, me, users, version,
    mode: isServerMode ? "server" : "demo",
    login: async (userId) => {
      const u = await repo.get("users", userId);
      if (!u || !u.active) throw new Error("INACTIVE_USER");
      localStorage.setItem(LS_USER, u.id);
      meRef.current = u;
      setMe(u);
      svc.runDailyChecks().catch(console.error);
    },
    logout: () => { localStorage.removeItem(LS_USER); setMe(null); },
    can: (a) => can(me, a),
    resetDemo: async () => {
      await idbClear();
      localStorage.removeItem(LS_USER);
      location.reload();
    },
  }), [repo, svc, me, users, version]);

  if (!ready) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("DataProvider missing");
  return c;
}

/** Đọc một bảng, tự tải lại khi dữ liệu đổi */
export function useTable<T extends TableName>(table: T, q?: Query<Row<T>>): { rows: Row<T>[]; loading: boolean; error: unknown; reload: () => void } {
  const { repo, version } = useData();
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const qKey = JSON.stringify(q ?? {});
  const reload = useCallback(() => {
    repo.list(table, JSON.parse(qKey)).then((r) => { setRows(r); setError(null); }).catch(setError).finally(() => setLoading(false));
  }, [repo, table, qKey]);
  useEffect(() => { reload(); }, [reload, version]);
  return { rows, loading, error, reload };
}

/** Đọc một dòng theo id */
export function useRow<T extends TableName>(table: T, id: string | null | undefined): { row: Row<T> | null; loading: boolean; reload: () => void } {
  const { repo, version } = useData();
  const [row, setRow] = useState<Row<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    if (!id) { setRow(null); setLoading(false); return; }
    repo.get(table, id).then(setRow).finally(() => setLoading(false));
  }, [repo, table, id]);
  useEffect(() => { reload(); }, [reload, version]);
  return { row, loading, reload };
}

/** Bản đồ id → dòng, tiện tra tên */
export function useIndex<T extends TableName>(table: T): Record<string, Row<T>> {
  const { rows } = useTable(table);
  return useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);
}
