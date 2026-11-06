-- =============================================================================
-- ManagerCAL trên Cloudflare D1 (SQLite)
-- Mỗi bản ghi nghiệp vụ là một tài liệu JSON trong bảng `rows` (tbl = tên bảng
-- logic trong src/lib/types.ts). Cách này khớp 1-1 với lớp Repo của ứng dụng,
-- không phải đổi lược đồ khi thêm trường. Ràng buộc quan trọng dùng chỉ mục.
-- =============================================================================

CREATE TABLE IF NOT EXISTS rows (
  tbl  TEXT NOT NULL,
  id   TEXT NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (tbl, id)
) WITHOUT ROWID;

-- Lọc nhanh các trường hay dùng
CREATE INDEX IF NOT EXISTS rows_status    ON rows (tbl, json_extract(data, '$.status'));
CREATE INDEX IF NOT EXISTS rows_customer  ON rows (tbl, json_extract(data, '$.customer_id'));
CREATE INDEX IF NOT EXISTS rows_order     ON rows (tbl, json_extract(data, '$.order_id'));
CREATE INDEX IF NOT EXISTS rows_user      ON rows (tbl, json_extract(data, '$.user_id'));
CREATE INDEX IF NOT EXISTS rows_number    ON rows (tbl, json_extract(data, '$.number'));
CREATE INDEX IF NOT EXISTS rows_created   ON rows (tbl, json_extract(data, '$.created_at'));

-- Không trùng: số GCN, số tem, mã đơn, mã phiếu, mã khách, email người dùng
CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_number  ON rows (json_extract(data, '$.number')) WHERE tbl = 'certificates';
CREATE UNIQUE INDEX IF NOT EXISTS uq_seal_number  ON rows (json_extract(data, '$.number')) WHERE tbl = 'seals';
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_code   ON rows (json_extract(data, '$.code'))   WHERE tbl = 'orders';
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_code     ON rows (json_extract(data, '$.code'))   WHERE tbl = 'jobs';
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_code ON rows (json_extract(data, '$.code'))  WHERE tbl = 'customers';
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email   ON rows (lower(json_extract(data, '$.email'))) WHERE tbl = 'users';

-- Bộ đếm (số GCN, mã đơn…)
CREATE TABLE IF NOT EXISTS sequences (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
) WITHOUT ROWID;

-- Mật khẩu (PBKDF2-SHA256) và phiên đăng nhập – tách khỏi dữ liệu nghiệp vụ
CREATE TABLE IF NOT EXISTS auth_passwords (
  user_id    TEXT PRIMARY KEY,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions (user_id);

-- Chống dò mật khẩu: đếm lần đăng nhập sai theo email
CREATE TABLE IF NOT EXISTS auth_failures (
  email      TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  first_at   TEXT NOT NULL
) WITHOUT ROWID;
