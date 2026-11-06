---
version: alpha
name: ManagerCAL
description: "Phòng kiểm định ngăn nắp: nền xám lạnh rất nhạt (#f4f6fa), chữ xanh mực (#15213a), một màu nhấn duy nhất là xanh kiểm định (#1e56a0) cho hành động chính và mục đang chọn; vàng đồng (#b8860b) chỉ dành cho tem và con số cần chú ý. Giao diện dùng Be Vietnam Pro, giấy chứng nhận in ra dùng Tinos (Times New Roman). Mật độ cao, bảng trước thẻ, trạng thái là nhãn nền nhạt chữ đậm."

colors:
  bg: "#f4f6fa"
  surface: "#ffffff"
  surface-2: "#eef2f7"
  line: "#dde3ec"
  line-strong: "#c5cedb"
  text: "#15213a"
  text-2: "#4a5670"
  text-3: "#7a8699"
  accent: "#1e56a0"
  accent-hover: "#174685"
  accent-soft: "#e6eef9"
  seal: "#b8860b"
  seal-soft: "#fbf3dc"
  success: "#1d6b52"
  success-soft: "#dcefe7"
  warning: "#a8650f"
  warning-soft: "#f8ead3"
  danger: "#b3261e"
  danger-soft: "#f9e1df"
  focus: "#2f6fed"
  dark-bg: "#0b1220"
  dark-surface: "#131c2e"
  dark-text: "#e8edf5"

typography:
  page-title: { fontFamily: Be Vietnam Pro, fontSize: 22px, fontWeight: 600, letterSpacing: -0.01em }
  section:    { fontFamily: Be Vietnam Pro, fontSize: 16px, fontWeight: 600 }
  body:       { fontFamily: Be Vietnam Pro, fontSize: 14px, lineHeight: 1.55 }
  small:      { fontFamily: Be Vietnam Pro, fontSize: 12px }
  document:   { fontFamily: Tinos, fontSize: 13pt, lineHeight: 1.45 }

spacing: { unit: 4px, control-height: 40px, hit-target-desktop: 28px, hit-target-mobile: 44px, page-gutter-mobile: 16px, container: 1600px }
rounded: { control: 10px, card: 14px, pill: 999px }
---

# DESIGN.md — ManagerCAL

Đọc tệp này trước khi thêm hoặc sửa màn hình, bảng, hộp thoại. Token Tailwind ở `src/index.css` (`@theme`), lớp dùng chung ở `src/components/ui.tsx`. Khi CSS và tệp này lệch nhau, CSS là sự thật.

## Overview
Người dùng là kiểm định viên, người soát xét, người ký và nhân viên tiếp nhận; họ làm việc với số liệu đo, số GCN, số tem cả ngày. Ứng dụng phải giống **sổ kiểm định được kẻ cẩn thận**, không giống trang quảng cáo. Ba điều làm nên khuôn mặt sản phẩm:
1. **Xanh kiểm định** `accent` là màu nhấn duy nhất: một nút chính mỗi vùng, mục đang chọn ở thanh bên, dòng cần chú ý.
2. **Tờ giấy chứng nhận** (`.doc`, font Tinos, khổ A4, góc vuông) luôn là bản in thật: quốc hiệu, số GCN, mã QR tra cứu, chỗ ký.
3. **Ngôn ngữ nghề**: "phiếu", "biên bản", "chuẩn", "sai số cho phép", "tem", "ủy quyền", "soát xét", "phê duyệt" – không dùng chữ chung chung.

## Colors
- Nền `bg` xám lạnh, mặt làm việc `surface` trắng; phân lớp bằng đường kẻ `line`, không chồng bóng.
- `accent` chỉ cho nút chính, mục đang chọn, liên kết. Khoảng 3% điểm ảnh có màu là vừa.
- `seal` vàng đồng chỉ cho số tem, con số nổi bật trên tổng quan (nền `seal-soft` + chữ đậm). Không dùng vàng cho chữ nhỏ trên nền trắng.
- Trạng thái: nhãn **nền nhạt + chữ đậm** (`Badge` tone), không nền đậm chữ trắng. Đạt = `success`, Không đạt = `danger`, chờ = `warning`. Lỗi luôn có chữ hoặc biểu tượng đi kèm, không chỉ dựa vào màu.
- Dark mode qua lớp `.dark` trên `html`, các lớp `dark:` của Tailwind.

## Typography
- Be Vietnam Pro cho giao diện; Tinos chỉ cho tài liệu in (GCN, thông báo không đạt, phiếu tiếp nhận, biên bản).
- 5 cỡ chữ: 12 (nhãn, tiêu đề cột), 13 (phụ), 14 (thân), 16 (tiêu đề khối), 22 (tiêu đề trang). Không thêm cỡ lẻ.
- Số liệu đo, tiền, ngày: căn phải, `tabular-nums`, số chữ số thập phân theo `decimals` của mẫu biên bản.
- Tên người, số GCN, số tem, số sê-ri hiển thị nguyên văn.

## Layout
- Thanh bên trái 256px cố định trên máy tính, trượt ra trên điện thoại. Vùng trang tối đa 1600px, lề 16px trên điện thoại.
- Đầu trang: tiêu đề + một dòng phụ, hành động chính nằm bên phải cùng hàng (`PageHeader`). Không có hero.
- **Bảng trước thẻ** cho mọi dữ liệu có cột (`.table`): kẻ ngang mảnh, tiêu đề cột 12px, không sọc ngựa vằn. Thẻ (`Card`) chỉ cho nhóm thông tin của một hồ sơ.
- Bốn trạng thái cho mọi danh sách: đang tải (`Loading`), trống (`Empty` một câu + một hành động), lỗi (`ErrorBox`), đầy đủ. Thiếu dữ liệu ghi "–", không bịa số.
- Biên bản số liệu: lưới ô nhập chặt, mỗi điểm đo một hàng, cột cuối là Đạt/Không đạt tính ngay khi gõ.

## Components
- `Button` primary (accent) chỉ một nút mỗi vùng; `secondary` viền; `ghost` trong bảng; `danger` cho thu hồi, huỷ – phải hỏi lại (`confirm`).
- `Badge` cao 22px, pill. `Stat` cho ô số trên tổng quan. `Modal` cho biểu mẫu ngắn; biểu mẫu dài (tiếp nhận, biên bản) dùng trang riêng.
- Kết luận nghiệp vụ (Đạt/Không đạt) luôn kèm sai số và sai số cho phép bên cạnh; phần mềm tính, người ký chịu trách nhiệm.

## Rà soát theo Apple HIG (bắt buộc trước khi chụp hình gửi duyệt)
1. Tương phản chữ/nền ≥ 4.5:1 tính từ mã màu (`text` trên `bg` = 13.9:1; `text-3` trên `surface` = 4.6:1; chữ trắng trên `accent` = 7.2:1).
2. Chữ ≥ 11px (nhỏ nhất trong app là 12px).
3. Vùng bấm ≥ 28px trên máy tính, ≥ 44px trên điện thoại (nút `md` cao 36px + lề; thanh dưới điện thoại 56px).

## Motion
Chỉ `transform`, `opacity`, màu; 120–240ms; ease-out; tôn trọng `prefers-reduced-motion`. Không hiệu ứng cho thao tác lặp (chuyển tab, lọc bảng).

## Known debt
- Chưa có chế độ giấy A4 cho biên bản số liệu (mới có GCN, thông báo không đạt, phiếu tiếp nhận).
