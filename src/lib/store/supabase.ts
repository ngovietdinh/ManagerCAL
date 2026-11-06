// =============================================================================
// SupabaseRepo – lớp lưu trữ chạy trên máy chủ Supabase (PostgREST + Realtime).
// Cùng giao diện Repo với LocalRepo; giao diện và Services không biết sự khác nhau.
// Quyền truy cập do RLS trong supabase/migrations quyết định.
// =============================================================================
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Row, TableName } from "../types";
import type { Query, Repo } from "./repo";
import { AppError } from "./repo";

export const supabase: SupabaseClient = createClient(config.supabaseUrl || "http://localhost", config.supabaseAnonKey || "missing", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "managercal.auth" },
});

type Result<T> = { data: T | null; error: PostgrestError | { message: string; code?: string } | null };

function unwrap<T>(res: Result<T>): T {
  if (res.error) {
    const e = res.error as PostgrestError;
    if (e.code === "23505") throw new AppError("DUPLICATE", e.message);
    if (e.code === "42501" || /row-level security/i.test(e.message)) throw new AppError("FORBIDDEN", e.message);
    throw new AppError(e.code ?? "DB_ERROR", e.message);
  }
  return res.data as T;
}

const PAGE = 1000;

export class SupabaseRepo implements Repo {
  private listeners = new Set<(t: TableName) => void>();
  private channelStarted = false;

  constructor(private client: SupabaseClient = supabase) {}

  async list<T extends TableName>(table: T, q: Query<Row<T>> = {}): Promise<Row<T>[]> {
    const out: Row<T>[] = [];
    for (let from = 0; ; from += PAGE) {
      let b = this.client.from(table).select("*");
      if (q.where) b = b.match(q.where as Record<string, unknown>);
      if (q.orderBy) b = b.order(q.orderBy.field, { ascending: (q.orderBy.dir ?? "asc") === "asc", nullsFirst: false });
      const to = q.limit ? Math.min(from + PAGE, q.limit) - 1 : from + PAGE - 1;
      if (to < from) break;
      const rows = unwrap(await b.range(from, to)) as Row<T>[];
      out.push(...rows);
      if (rows.length < to - from + 1 || (q.limit && out.length >= q.limit)) break;
    }
    return q.limit ? out.slice(0, q.limit) : out;
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    return (unwrap(await this.client.from(table).select("*").eq("id", id).maybeSingle()) as Row<T> | null) ?? null;
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    return unwrap(await this.client.from(table).insert(row as never).select("*").single()) as Row<T>;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const rows = unwrap(await this.client.from(table).update(patch as never).eq("id", id).select("*")) as Row<T>[];
    if (!rows.length) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu (hoặc không có quyền sửa).");
    return rows[0];
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    unwrap(await this.client.from(table).delete().eq("id", id));
  }

  async nextSequence(key: string): Promise<number> {
    const v = unwrap(await this.client.rpc("next_sequence", { p_key: key })) as number | string;
    return Number(v);
  }

  subscribe(fn: (t: TableName) => void): () => void {
    this.listeners.add(fn);
    if (!this.channelStarted) {
      this.channelStarted = true;
      this.client
        .channel("managercal-changes")
        .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
          const t = payload.table as TableName;
          this.listeners.forEach((l) => l(t));
        })
        .subscribe();
    }
    return () => this.listeners.delete(fn);
  }
}
