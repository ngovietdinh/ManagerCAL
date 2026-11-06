// =============================================================================
// RemoteRepo – đọc dữ liệu qua API máy chủ (Cloudflare Worker + D1).
// Ghi dữ liệu KHÔNG đi qua đây mà qua rpc(): máy chủ chạy lớp nghiệp vụ và kiểm tra quyền.
// =============================================================================
import { Services } from "../services";
import { isRemoteMethod } from "../services/rpc";
import type { Certificate, Row, TableName, User } from "../types";
import type { Query, Repo } from "./repo";
import { AppError } from "./repo";

export class ApiError extends AppError {
  details?: Record<string, unknown>;
  status: number;
  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(code, message);
    this.status = status;
    this.details = details;
  }
}

export interface Health { ok: boolean; mode: "server"; needsSetup: boolean }

/** Có API máy chủ không? (trên hosting tĩnh như R2 sẽ không có → chế độ demo) */
export async function detectServer(base: string): Promise<Health | null> {
  try {
    const res = await fetch(`${base}/health`, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) return null;
    const h = (await res.json()) as Health;
    return h?.mode === "server" ? h : null;
  } catch {
    return null;
  }
}

export class RemoteRepo implements Repo {
  private listeners = new Set<(t: TableName) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  onAuthLost: () => void = () => undefined;

  constructor(public base: string) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        credentials: "same-origin", cache: "no-store", ...init,
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      });
    } catch {
      throw new ApiError("NETWORK", "Mất kết nối mạng. Hãy kiểm tra Internet và thử lại.", 0);
    }
    const body = await res.json().catch(() => ({})) as { error?: { code: string; message: string; details?: Record<string, unknown> } };
    if (!res.ok || body.error) {
      const e = body.error ?? { code: "SERVER_ERROR", message: `Lỗi máy chủ (${res.status}).` };
      if (res.status === 401 && !path.startsWith("/login")) this.onAuthLost();
      throw new ApiError(e.code, e.message, res.status, e.details);
    }
    return body as T;
  }

  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }); }

  async list<T extends TableName>(table: T, q?: Query<Row<T>>): Promise<Row<T>[]> {
    const qs = q && Object.keys(q).length ? `?q=${encodeURIComponent(JSON.stringify(q))}` : "";
    return (await this.request<{ rows: Row<T>[] }>(`/data/${table}${qs}`)).rows;
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    return (await this.request<{ row: Row<T> | null }>(`/data/${table}/${encodeURIComponent(id)}`)).row;
  }

  async insert<T extends TableName>(): Promise<Row<T>> { throw new ApiError("FORBIDDEN", "Thao tác ghi phải đi qua máy chủ.", 403); }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    // ngoại lệ duy nhất: đánh dấu thông báo của mình đã đọc
    if (table === "notifications" && Object.keys(patch).length === 1 && (patch as { read?: boolean }).read === true) {
      await this.post("/notifications/read", { ids: [id] });
      this.emit(table);
      return { ...(await this.get(table, id)) } as Row<T>;
    }
    throw new ApiError("FORBIDDEN", "Thao tác ghi phải đi qua máy chủ.", 403);
  }

  async remove(): Promise<void> { throw new ApiError("FORBIDDEN", "Thao tác ghi phải đi qua máy chủ.", 403); }
  async nextSequence(): Promise<number> { throw new ApiError("FORBIDDEN", "Bộ đếm chỉ tăng trên máy chủ.", 403); }

  async rpc(method: string, args: unknown[]): Promise<unknown> {
    const r = await this.post<{ result: unknown }>("/rpc", { method, args });
    this.emit("settings");
    return r.result;
  }

  async markRead(ids: string[]) {
    if (!ids.length) return;
    await this.post("/notifications/read", { ids });
    this.emit("notifications");
  }

  async lookup(number: string): Promise<Certificate | null> {
    return (await this.request<{ certificate: Certificate | null }>(`/lookup/${encodeURIComponent(number.trim())}`)).certificate;
  }

  async me(): Promise<User | null> {
    try { return (await this.request<{ user: User }>("/me")).user; } catch (e) { if ((e as ApiError).status === 401) return null; throw e; }
  }

  emit(t: TableName) { this.listeners.forEach((fn) => fn(t)); }

  /** Có thay đổi → giao diện tải lại. Ngoài ra cứ 30 giây làm mới một lần để thấy việc người khác vừa làm. */
  subscribe(fn: (t: TableName) => void): () => void {
    this.listeners.add(fn);
    if (!this.timer && typeof window !== "undefined") {
      this.timer = setInterval(() => { if (document.visibilityState === "visible") this.emit("jobs"); }, 30_000);
    }
    return () => {
      this.listeners.delete(fn);
      if (!this.listeners.size && this.timer) { clearInterval(this.timer); this.timer = null; }
    };
  }
}

/** Services cho máy khách ở chế độ máy chủ: hàm ghi gửi lên máy chủ, hàm đọc chạy tại chỗ qua RemoteRepo */
export function remoteServices(repo: RemoteRepo, currentUser: () => User | null): Services {
  const local = new Services(repo, currentUser);
  return new Proxy(local, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && isRemoteMethod(prop)) return (...args: unknown[]) => repo.rpc(prop, args);
      if (prop === "lookupCertificate") return (n: string) => repo.lookup(n);
      return Reflect.get(target, prop, receiver);
    },
  });
}
