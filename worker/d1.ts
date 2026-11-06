// Kiểu tối thiểu của Cloudflare D1 mà máy chủ dùng (để không phụ thuộc gói @cloudflare/workers-types
// khi typecheck và để kiểm thử bằng SQLite của Node qua lớp giả lập ở tests/unit/d1shim.ts).
export interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta?: unknown }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
