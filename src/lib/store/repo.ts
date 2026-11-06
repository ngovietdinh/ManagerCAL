// =============================================================================
// LỚP LƯU TRỮ – điểm duy nhất giao diện/nghiệp vụ chạm vào dữ liệu.
// Có hai bản cài đặt: LocalRepo (IndexedDB, chế độ demo/offline) và SupabaseRepo.
// =============================================================================
import type { Row, TableName } from "../types";

export interface Query<R> {
  where?: Partial<R>;
  orderBy?: { field: keyof R & string; dir?: "asc" | "desc" };
  limit?: number;
}

export interface Repo {
  list<T extends TableName>(table: T, q?: Query<Row<T>>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  /** Bộ đếm nguyên tử (số GCN, mã đơn...) – trả về giá trị mới */
  nextSequence(key: string): Promise<number>;
  /** Có thay đổi dữ liệu → giao diện tải lại */
  subscribe(fn: (table: TableName) => void): () => void;
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const nowIso = () => new Date().toISOString();

export class AppError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}
