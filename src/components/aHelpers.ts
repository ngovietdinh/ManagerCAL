// Tiện ích nhỏ dùng chung cho các trang khách hàng / đơn hàng
import { dayjs, todayStr } from "@/lib/format";
import type { Tone } from "@/lib/labels";

/** Bỏ dấu, viết thường để tìm kiếm */
export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export const matches = (q: string, ...fields: (string | null | undefined)[]) => {
  const k = norm(q).trim();
  if (!k) return true;
  return norm(fields.join(" ")).includes(k);
};

/** Số ngày từ hôm nay tới hạn (âm = quá hạn) */
export const daysUntil = (d: string | null | undefined) => (d ? dayjs(d).diff(dayjs(todayStr()), "day") : null);

/** Màu nhãn hạn: đỏ quá hạn, vàng ≤ 30 ngày, xám còn xa */
export const dueTone = (d: string | null | undefined): Tone => {
  const n = daysUntil(d);
  if (n == null) return "none";
  if (n < 0) return "red";
  if (n <= 30) return "amber";
  return "gray";
};

export const dueText = (d: string | null | undefined) => {
  const n = daysUntil(d);
  if (n == null) return "–";
  if (n < 0) return `Quá hạn ${-n} ngày`;
  if (n === 0) return "Hôm nay";
  return `Còn ${n} ngày`;
};
