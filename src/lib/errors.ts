// Đổi mã lỗi thành câu tiếng Việt
const MESSAGES: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  DUPLICATE: "Dữ liệu bị trùng.",
  NOT_AUTHORIZED_PERFORM: "Người được phân công chưa có ủy quyền thực hiện trong lĩnh vực này (hoặc ủy quyền đã hết hạn).",
  NOT_AUTHORIZED_REVIEW: "Bạn chưa có ủy quyền soát xét trong lĩnh vực này.",
  NOT_AUTHORIZED_SIGN: "Bạn chưa có ủy quyền ký giấy chứng nhận trong lĩnh vực này.",
  REVIEWER_IS_PERFORMER: "Người soát xét phải khác người thực hiện.",
  NO_PROCEDURE: "Loại phương tiện đo chưa gắn quy trình kiểm định đang áp dụng.",
  STANDARD_UNUSABLE: "Chuẩn {code} không dùng được: {reason}.",
  STANDARD_REQUIRED: "Chưa chọn chuẩn dùng để kiểm định.",
  READINGS_INCOMPLETE: "Biên bản còn thiếu số liệu: {missing}",
  ENV_OUT_OF_RANGE: "Điều kiện môi trường không đạt: {detail}",
  RESULT_MISMATCH: "Kết quả tính lại khác với kết quả đã lưu. Hãy mở biên bản và lưu lại.",
  BAD_STATUS: "Trạng thái phiếu không cho phép thao tác này.",
  SEAL_UNAVAILABLE: "Số tem {number} không có sẵn để dùng.",
  CERT_NOT_VALID: "Giấy chứng nhận không còn hiệu lực.",
  INACTIVE_USER: "Tài khoản đã bị khoá.",
  NO_SEAL_FOR_USER: "Bạn chưa được cấp tem. Hãy xin cấp tem trước khi phát hành.",
  CARD_EXPIRED: "Thẻ kiểm định viên của người thực hiện đã hết hạn.",
};

export function errorMessage(err: unknown): string {
  if (!err) return "Đã xảy ra lỗi";
  const e = err as { code?: string; message?: string; details?: Record<string, unknown> };
  const code = e.code ?? e.message ?? String(err);
  const template = MESSAGES[code];
  if (!template) {
    const m = e.message ?? String(err);
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Mất kết nối mạng. Hãy kiểm tra Internet và thử lại.";
    if (/row-level security|permission denied/i.test(m)) return MESSAGES.FORBIDDEN;
    if (/duplicate key/i.test(m)) return MESSAGES.DUPLICATE;
    return m;
  }
  const d = e.details ?? {};
  return template.replace(/\{(\w+)\}/g, (_, k) => (d[k] !== undefined ? String(d[k]) : "?"));
}
