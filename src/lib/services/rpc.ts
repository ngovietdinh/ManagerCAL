// Các phương thức của Services làm thay đổi dữ liệu. Ở chế độ máy chủ, máy khách KHÔNG tự chạy
// các hàm này mà gửi lên /api/rpc; máy chủ chạy đúng lớp Services với người dùng của phiên đăng nhập,
// nên mọi quy tắc chặn cứng được kiểm tra trên máy chủ. Hàm chỉ đọc vẫn chạy ở máy khách.
export const REMOTE_METHODS = [
  "create", "patch", "delete", "saveSettings",
  "recalibrateStandard", "lockExpiredStandards",
  "createCustomer", "createDevice",
  "createOrder", "setOrderPaid",
  "assignJob", "saveReadings", "submitForReview", "reviewJob", "returnFromApproval", "approveAndIssue", "returnDevice", "cancelJob",
  "replaceCertificate", "revokeCertificate",
  "createSealBatch", "assignSeals", "voidSeal",
  "runDailyChecks", "importLibrary",
] as const;
export type RemoteMethod = (typeof REMOTE_METHODS)[number];
export const isRemoteMethod = (m: string): m is RemoteMethod => (REMOTE_METHODS as readonly string[]).includes(m);
