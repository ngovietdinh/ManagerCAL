// Cấu hình khi chạy. Mặc định app gọi API máy chủ ở "/api" (Cloudflare Worker + D1).
// Không có API ở đó (vd. đặt trên hosting tĩnh) thì app tự chạy chế độ DEMO: dữ liệu lưu trong trình duyệt.
window.APP_CONFIG = {
  apiBase: "",
};
