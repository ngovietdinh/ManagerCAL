// =============================================================================
// LocalRepo – lưu trong IndexedDB của trình duyệt (chế độ demo và dùng offline).
// Toàn bộ dữ liệu nạp vào bộ nhớ; ghi xuống IndexedDB sau mỗi thay đổi (gộp theo nhịp).
// =============================================================================
import type { Row, TableName } from "../types";
import type { Query, Repo } from "./repo";
import { AppError } from "./repo";

const DB_NAME = "managercal";
const STORE = "tables";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(): Promise<Record<string, unknown>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const keys = store.getAllKeys();
    const vals = store.getAll();
    tx.oncomplete = () => {
      const out: Record<string, unknown> = {};
      (keys.result as string[]).forEach((k, i) => { out[k] = vals.result[i]; });
      resolve(out);
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function idbPut(entries: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const [k, v] of Object.entries(entries)) store.put(v, k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbClear(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type Data = { [T in TableName]?: Row<T>[] };

export class LocalRepo implements Repo {
  private data: Data = {};
  private seq: Record<string, number> = {};
  private dirty = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(t: TableName) => void>();
  private memoryOnly: boolean;

  constructor(opts: { memoryOnly?: boolean } = {}) {
    this.memoryOnly = !!opts.memoryOnly || typeof indexedDB === "undefined";
  }

  /** Nạp từ IndexedDB. Trả về true nếu đã có dữ liệu. */
  async load(): Promise<boolean> {
    if (this.memoryOnly) return Object.keys(this.data).length > 0;
    const all = await idbGetAll();
    for (const [k, v] of Object.entries(all)) {
      if (k === "__seq") this.seq = v as Record<string, number>;
      else (this.data as Record<string, unknown>)[k] = v;
    }
    return Object.keys(all).length > 0;
  }

  /** Thay toàn bộ dữ liệu (dùng khi nạp demo / nhập sao lưu) */
  async replaceAll(data: Data, seq: Record<string, number> = {}): Promise<void> {
    this.data = structuredClone(data);
    this.seq = { ...seq };
    for (const k of Object.keys(this.data)) this.dirty.add(k);
    this.dirty.add("__seq");
    await this.flush();
    this.listeners.forEach((fn) => fn("settings"));
  }

  exportAll(): { data: Data; seq: Record<string, number> } {
    return { data: structuredClone(this.data), seq: { ...this.seq } };
  }

  private table<T extends TableName>(t: T): Row<T>[] {
    if (!this.data[t]) (this.data as Record<string, unknown[]>)[t] = [];
    return this.data[t] as Row<T>[];
  }

  private markDirty(t: TableName) {
    this.dirty.add(t);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush().catch(console.error), 150);
    this.listeners.forEach((fn) => fn(t));
  }

  async flush(): Promise<void> {
    if (this.memoryOnly || this.dirty.size === 0) return;
    const entries: Record<string, unknown> = {};
    for (const k of this.dirty) entries[k] = k === "__seq" ? this.seq : structuredClone((this.data as Record<string, unknown>)[k] ?? []);
    this.dirty.clear();
    await idbPut(entries);
  }

  async list<T extends TableName>(table: T, q: Query<Row<T>> = {}): Promise<Row<T>[]> {
    let rows = this.table(table).slice();
    if (q.where) {
      const w = q.where as Record<string, unknown>;
      rows = rows.filter((r) => Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
    }
    if (q.orderBy) {
      const { field, dir = "asc" } = q.orderBy;
      const m = dir === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        const x = (a as unknown as Record<string, unknown>)[field], y = (b as unknown as Record<string, unknown>)[field];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return x < y ? -m : x > y ? m : 0;
      });
    }
    if (q.limit) rows = rows.slice(0, q.limit);
    return structuredClone(rows);
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const r = this.table(table).find((x) => x.id === id);
    return r ? structuredClone(r) : null;
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const rows = this.table(table);
    if (rows.some((x) => x.id === row.id)) throw new AppError("DUPLICATE", "Dữ liệu bị trùng.");
    rows.push(structuredClone(row));
    this.markDirty(table);
    return structuredClone(row);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const rows = this.table(table);
    const i = rows.findIndex((x) => x.id === id);
    if (i < 0) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu.");
    rows[i] = { ...rows[i], ...structuredClone(patch) };
    this.markDirty(table);
    return structuredClone(rows[i]);
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const rows = this.table(table);
    const i = rows.findIndex((x) => x.id === id);
    if (i >= 0) { rows.splice(i, 1); this.markDirty(table); }
  }

  async nextSequence(key: string): Promise<number> {
    this.seq[key] = (this.seq[key] ?? 0) + 1;
    this.dirty.add("__seq");
    this.markDirty("settings");
    return this.seq[key];
  }

  subscribe(fn: (t: TableName) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
