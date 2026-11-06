// Cấu hình lúc chạy (public/config.js) ưu tiên hơn biến lúc build (.env)
interface RuntimeConfig { apiBase?: string }
const runtime: RuntimeConfig = (globalThis as unknown as { APP_CONFIG?: RuntimeConfig }).APP_CONFIG ?? {};

/**
 * Địa chỉ API máy chủ. Mặc định "/api" (Cloudflare Worker phục vụ cả app lẫn API trên cùng tên miền).
 * Nếu không có API ở đó (chạy dev, hosting tĩnh), app tự chuyển sang chế độ demo.
 */
export const apiBase = (runtime.apiBase || import.meta.env.VITE_API_BASE || "/api").replace(/\/+$/, "");
