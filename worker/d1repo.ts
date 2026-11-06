// =============================================================================
// D1Repo – cài đặt Repo trên Cloudflare D1, sống trong MỘT lượt gọi API.
//
// - Đọc: truy vấn SQL, nhớ đệm theo id trong lượt gọi; bảng danh mục nhỏ nạp cả bảng một lần.
// - Ghi: KHÔNG ghi ngay. Gom vào bộ đệm, cuối lượt `commit()` đẩy tất cả trong một db.batch()
//   (D1 chạy batch như một giao dịch: hoặc ghi hết, hoặc không ghi gì). Nhờ vậy một thao tác
//   nghiệp vụ nhiều bước (phát hành GCN + tem + thiết bị + nhật ký) là nguyên tử, và số truy vấn
//   mỗi lượt gọi luôn nhỏ (giới hạn D1 gói miễn phí: 50 truy vấn / lượt).
// - Bộ đếm: đọc giá trị hiện tại, tăng trong bộ nhớ, ghi kèm batch. Hai yêu cầu đồng thời lấy cùng
//   số thì chỉ mục UNIQUE (số GCN, mã đơn…) làm batch sau thất bại → không trùng, không mất số.
// =============================================================================
import type { Query, Repo } from "../src/lib/store/repo";
import { AppError, matchQuery } from "../src/lib/store/repo";
import type { Row, TableName } from "../src/lib/types";
import type { D1Database, D1PreparedStatement } from "./d1";

/** Bảng nhỏ, đọc nhiều: nạp cả bảng một lần mỗi lượt gọi */
const SMALL: TableName[] = ["settings", "branches", "users", "authorizations", "fields", "instrument_types", "procedures", "standards"];
/** Kích thước tối đa một tham số JSON khi ghi hàng loạt (D1 giới hạn ~2 MB mỗi giá trị) */
const CHUNK_BYTES = 600_000;

type Doc = Record<string, unknown>;

export class D1Repo implements Repo {
  private cache = new Map<string, Map<string, Doc | null>>(); // tbl → id → doc (null = đã xoá)
  private full = new Set<string>();                           // bảng đã nạp đủ
  private dirty = new Map<string, Map<string, Doc | null>>();  // thay đổi chờ ghi
  private seq = new Map<string, number>();
  private seqDirty = new Set<string>();
  private inserted = new Map<string, Set<string>>();          // id thêm mới trong lượt (ghi bằng INSERT thuần)
  queries = 0;

  /** assumeEmpty: CSDL trống (khởi tạo lần đầu) → không cần đọc gì */
  constructor(private db: D1Database, opts: { assumeEmpty?: boolean } = {}) {
    if (opts.assumeEmpty) this.assumeEmpty = true;
  }
  private assumeEmpty = false;

  private tbl(t: string) {
    let m = this.cache.get(t);
    if (!m) { m = new Map(); this.cache.set(t, m); }
    return m;
  }
  private q(sql: string, ...binds: unknown[]) {
    this.queries++;
    return this.db.prepare(sql).bind(...binds);
  }
  private static parse(s: unknown): Doc { return JSON.parse(String(s)) as Doc; }

  private async loadFull(t: string) {
    if (this.full.has(t)) return;
    if (!this.assumeEmpty) {
      const res = await this.q("SELECT id, data FROM rows WHERE tbl = ?", t).all<{ id: string; data: string }>();
      const m = this.tbl(t);
      for (const r of res.results) if (!m.has(r.id)) m.set(r.id, D1Repo.parse(r.data));
    }
    this.full.add(t);
  }

  async list<T extends TableName>(table: T, q: Query<Row<T>> = {}): Promise<Row<T>[]> {
    let docs: Doc[];
    if (SMALL.includes(table) || this.assumeEmpty || this.full.has(table)) {
      await this.loadFull(table);
      docs = [...this.tbl(table).values()].filter((d): d is Doc => d !== null);
    } else {
      // truy vấn SQL theo điều kiện, rồi chồng các thay đổi chưa ghi lên
      const where: string[] = ["tbl = ?"];
      const binds: unknown[] = [table];
      for (const [k, v] of Object.entries(q.where ?? {})) {
        if (!/^[a-z_][a-z0-9_]*$/i.test(k)) throw new AppError("BAD_QUERY");
        if (v === null) where.push(`json_extract(data, '$.${k}') IS NULL`);
        else { where.push(`json_extract(data, '$.${k}') = ?`); binds.push(typeof v === "boolean" ? (v ? 1 : 0) : v); }
      }
      const field = (f: string) => { if (!/^[a-z_][a-z0-9_]*$/i.test(f)) throw new AppError("BAD_QUERY"); return `json_extract(data, '$.${f}')`; };
      if (q.range?.lt != null) { where.push(`${field(q.range.field)} < ?`); binds.push(q.range.lt); }
      if (q.range?.gt != null) { where.push(`${field(q.range.field)} > ?`); binds.push(q.range.gt); }
      // có sắp xếp + giới hạn → để CSDL làm (dùng chỉ mục, chỉ đọc đúng số dòng cần), rỗng xếp cuối như trong bộ nhớ
      let tail = "";
      if (q.orderBy && q.limit) {
        const f = field(q.orderBy.field);
        tail = ` ORDER BY ${f} IS NULL, ${f} ${q.orderBy.dir === "desc" ? "DESC" : "ASC"} LIMIT ${Math.max(1, Math.floor(q.limit))}`;
      }
      const res = await this.q(`SELECT id, data FROM rows WHERE ${where.join(" AND ")}${tail}`, ...binds).all<{ id: string; data: string }>();
      const m = this.tbl(table);
      const seen = new Set<string>();
      docs = [];
      for (const r of res.results) {
        seen.add(r.id);
        const cached = m.get(r.id);
        if (cached === null) continue;                 // đã xoá trong lượt này
        const d = cached ?? D1Repo.parse(r.data);
        if (!m.has(r.id)) m.set(r.id, d);
        docs.push(d);
      }
      // bản ghi mới/sửa trong lượt này mà SQL chưa thấy
      for (const [id, d] of this.dirty.get(table) ?? []) if (d && !seen.has(id)) docs.push(d);
    }
    // lọc lại trong bộ nhớ (đúng cho cả dữ liệu đã sửa chưa ghi), sắp xếp, giới hạn
    let out = docs.filter((d) => matchQuery(d, q as never));
    if (q.orderBy) {
      const { field, dir = "asc" } = q.orderBy;
      const s = dir === "asc" ? 1 : -1;
      out = out.slice().sort((a, b) => {
        const x = a[field] as never, y = b[field] as never;
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return x < y ? -s : x > y ? s : 0;
      });
    }
    if (q.limit) out = out.slice(0, q.limit);
    return structuredClone(out) as unknown as Row<T>[];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const m = this.tbl(table);
    if (!m.has(id)) {
      if (SMALL.includes(table) || this.assumeEmpty || this.full.has(table)) await this.loadFull(table);
      else {
        const r = await this.q("SELECT data FROM rows WHERE tbl = ? AND id = ?", table, id).first<{ data: string }>();
        m.set(id, r ? D1Repo.parse(r.data) : null);
      }
    }
    const d = m.get(id);
    return d ? (structuredClone(d) as unknown as Row<T>) : null;
  }

  /** Nạp trước nhiều id một lần (vd. thiết bị của một đơn hàng 100 dòng) */
  async prefetch(table: TableName, ids: string[]): Promise<void> {
    const m = this.tbl(table);
    const need = [...new Set(ids)].filter((id) => !m.has(id));
    if (!need.length || this.assumeEmpty || this.full.has(table)) return;
    const res = await this.q("SELECT id, data FROM rows WHERE tbl = ? AND id IN (SELECT value FROM json_each(?))", table, JSON.stringify(need)).all<{ id: string; data: string }>();
    for (const r of res.results) m.set(r.id, D1Repo.parse(r.data));
    for (const id of need) if (!m.has(id)) m.set(id, null);
  }

  private mark(table: string, id: string, doc: Doc | null) {
    this.tbl(table).set(id, doc);
    let d = this.dirty.get(table);
    if (!d) { d = new Map(); this.dirty.set(table, d); }
    d.set(id, doc);
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    // Không hỏi CSDL trước: bản ghi mới ghi bằng INSERT thuần, nếu id đã tồn tại thì cả lô bị từ chối
    // (DUPLICATE). Chỉ kiểm tra ngay những gì đã có trong bộ nhớ của lượt gọi.
    const m = this.tbl(table);
    if (m.get(row.id)) throw new AppError("DUPLICATE", "Dữ liệu bị trùng.");
    if (!m.has(row.id) && (SMALL.includes(table) || this.full.has(table)) && !this.assumeEmpty) {
      await this.loadFull(table);
      if (m.get(row.id)) throw new AppError("DUPLICATE", "Dữ liệu bị trùng.");
    }
    const doc = structuredClone(row) as unknown as Doc;
    const wasDeleted = m.get(row.id) === null && this.dirty.get(table)?.has(row.id);
    this.mark(table, row.id, doc);
    if (!wasDeleted) {
      let set = this.inserted.get(table);
      if (!set) { set = new Set(); this.inserted.set(table, set); }
      set.add(row.id);
    }
    return structuredClone(row);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const cur = await this.get(table, id);
    if (!cur) throw new AppError("NOT_FOUND", "Không tìm thấy dữ liệu.");
    const next = { ...(cur as unknown as Doc), ...(structuredClone(patch) as Doc), id } as Doc;
    this.mark(table, id, next);
    return structuredClone(next) as unknown as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const cur = await this.get(table, id);
    if (cur) this.mark(table, id, null);
  }

  async nextSequence(key: string): Promise<number> {
    if (!this.seq.has(key)) {
      let v = 0;
      if (!this.assumeEmpty) {
        const r = await this.q("SELECT value FROM sequences WHERE key = ?", key).first<{ value: number }>();
        v = r?.value ?? 0;
      }
      this.seq.set(key, v);
    }
    const n = this.seq.get(key)! + 1;
    this.seq.set(key, n);
    this.seqDirty.add(key);
    return n;
  }

  /** Đặt thẳng giá trị bộ đếm (khôi phục sao lưu) */
  setSequence(key: string, value: number) {
    this.seq.set(key, value);
    this.seqDirty.add(key);
  }

  subscribe(): () => void { return () => undefined; }

  /** Câu lệnh ghi đang chờ (dùng để gộp với câu lệnh khác vào cùng một batch) */
  pendingStatements(): D1PreparedStatement[] {
    const out: D1PreparedStatement[] = [];
    const INSERT = "INSERT INTO rows (tbl, id, data) SELECT ?1, json_extract(value, '$.id'), json(value) FROM json_each(?2)";
    const UPSERT = INSERT + " WHERE true ON CONFLICT (tbl, id) DO UPDATE SET data = excluded.data";
    for (const [table, changes] of this.dirty) {
      const ins = this.inserted.get(table) ?? new Set<string>();
      const inserts: string[] = [];
      const upserts: string[] = [];
      const deletes: string[] = [];
      for (const [id, d] of changes) {
        if (!d) deletes.push(id);
        else (ins.has(id) ? inserts : upserts).push(JSON.stringify(d));
      }
      // chia nhỏ theo dung lượng để không vượt giới hạn kích thước tham số
      const emit = (sql: string, docs: string[]) => {
        let chunk: string[] = [], size = 0;
        const flush = () => { if (chunk.length) out.push(this.db.prepare(sql).bind(table, `[${chunk.join(",")}]`)); chunk = []; size = 0; };
        for (const u of docs) {
          if (size + u.length > CHUNK_BYTES) flush();
          chunk.push(u); size += u.length + 1;
        }
        flush();
      };
      emit(INSERT, inserts);
      emit(UPSERT, upserts);
      if (deletes.length) out.push(this.db.prepare("DELETE FROM rows WHERE tbl = ? AND id IN (SELECT value FROM json_each(?))").bind(table, JSON.stringify(deletes)));
    }
    for (const key of this.seqDirty) {
      out.push(this.db.prepare("INSERT INTO sequences (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = MAX(sequences.value, excluded.value)").bind(key, this.seq.get(key)));
    }
    return out;
  }

  hasChanges() { return this.dirty.size > 0 || this.seqDirty.size > 0; }

  /** Các thay đổi đang chờ ghi: bảng → bản ghi mới/sửa (gọi TRƯỚC commit; dùng để báo đồng bộ, gửi email) */
  changeSet(): Map<string, { docs: Doc[]; inserted: Set<string> }> {
    const out = new Map<string, { docs: Doc[]; inserted: Set<string> }>();
    for (const [t, m] of this.dirty) out.set(t, { docs: [...m.values()].filter((d): d is Doc => !!d), inserted: new Set(this.inserted.get(t) ?? []) });
    return out;
  }

  /** Ghi mọi thay đổi trong một giao dịch. Trùng khoá duy nhất → DUPLICATE (không ghi gì). */
  async commit(after: D1PreparedStatement[] = [], before: D1PreparedStatement[] = []): Promise<void> {
    const stmts = [...before, ...this.pendingStatements(), ...after];
    if (!stmts.length) return;
    try {
      this.queries += stmts.length;
      await this.db.batch(stmts);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/UNIQUE constraint failed/i.test(msg)) throw new AppError("DUPLICATE", "Dữ liệu bị trùng (có thể người khác vừa thao tác cùng lúc). Hãy thử lại.");
      throw e;
    }
    this.dirty.clear();
    this.seqDirty.clear();
    this.inserted.clear();
  }
}
