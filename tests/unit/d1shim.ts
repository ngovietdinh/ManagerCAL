// Giả lập Cloudflare D1 bằng SQLite có sẵn trong Node (node:sqlite) để kiểm thử máy chủ không cần Cloudflare.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database, D1PreparedStatement, D1Result } from "../../worker/d1";

class Stmt implements D1PreparedStatement {
  constructor(private db: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...values: unknown[]) { return new Stmt(this.db, this.sql, values); }
  private p() { return this.params.map((v) => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v)) as never[]; }
  async first<T>() { return ((this.db.prepare(this.sql).get(...this.p()) as T) ?? null); }
  async all<T>(): Promise<D1Result<T>> { return { results: this.db.prepare(this.sql).all(...this.p()) as T[], success: true }; }
  async run(): Promise<D1Result> { this.db.prepare(this.sql).run(...this.p()); return { results: [], success: true }; }
  runSync() { this.db.prepare(this.sql).run(...this.p()); }
}

export function createD1(): D1Database & { raw: DatabaseSync; count: number } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8"));
  const d1 = {
    raw, count: 0,
    prepare(sql: string) { d1.count++; return new Stmt(raw, sql); },
    async batch(stmts: D1PreparedStatement[]) {
      raw.exec("BEGIN");
      try { for (const s of stmts) (s as Stmt).runSync(); raw.exec("COMMIT"); }
      catch (e) { raw.exec("ROLLBACK"); throw e; }
      return stmts.map(() => ({ results: [], success: true }));
    },
  };
  return d1;
}
