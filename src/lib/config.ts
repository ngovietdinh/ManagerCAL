// Cấu hình lúc chạy (public/config.js) ưu tiên hơn biến lúc build (.env)
interface RuntimeConfig { supabaseUrl?: string; supabaseAnonKey?: string }
const runtime: RuntimeConfig = (globalThis as unknown as { APP_CONFIG?: RuntimeConfig }).APP_CONFIG ?? {};

export const config = {
  supabaseUrl: runtime.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: runtime.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

/** Có máy chủ Supabase → chế độ máy chủ; không → chế độ demo trên trình duyệt */
export const isServerMode = Boolean(config.supabaseUrl && config.supabaseAnonKey);
