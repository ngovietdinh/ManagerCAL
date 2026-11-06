-- Trao đổi nội bộ: đọc tin theo kênh, mới nhất trước (dùng chỉ mục, không quét cả bảng)
CREATE INDEX IF NOT EXISTS rows_channel ON rows (tbl, json_extract(data, '$.channel'), json_extract(data, '$.created_at'));

-- Cấu hình bí mật của ứng dụng (khoá API gửi email…): chỉ máy chủ đọc, không lộ qua API dữ liệu, không nằm trong sao lưu
CREATE TABLE IF NOT EXISTS app_secrets (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
) WITHOUT ROWID;
