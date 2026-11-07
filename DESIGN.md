---
version: 2
name: ManagerCAL
description: "Kính trên cát: nền cát ấm có đốm màu làm mờ (tối: 'Đêm'), lớp điều khiển là kính trong mờ viền sáng, lớp nội dung là vật liệu đục. Nhấn ngọc (#19a37e) cho đạt / xong / mục đang chọn, đỏ (#c8352b) cho quá hạn / không đạt, hổ phách cho chờ, nút chính là viên thuốc đen. Be Vietnam Pro cho giao diện, Tinos cho giấy chứng nhận in."
source: "Cùng họ với CV và Trợ lý văn bản (SCADA Glass); nguyên tắc rút từ các repo đã gắn sao: dickwu/apple-design-skill, Nutlope/hallmark, Leonxlnx/taste-skill, emilkowalski/skills, nextlevelbuilder/ui-ux-pro-max-skill, google-labs-code/design.md, VoltAgent/awesome-design-md."

colors:
  sand-b0: "#b49c82"     # nền
  sand-b1: "#efe4d5"     # đốm sáng
  sand-b2: "#8a6a4c"
  ink: "rgb(24,24,26)"
  ink-2: "rgba(24,24,26,.8)"
  ink-3: "rgba(24,24,26,.7)"   # chữ phụ – CV dùng .52 (~3:1) đã nâng lên .7 theo HIG
  card: "rgba(255,252,247,.92)"
  card-solid: "#fffcf7"
  accent: "#1b1b1d"      # nút chính (chữ trắng 17:1)
  c1-ngoc: "#19a37e"     # tô, cột, chấm; chữ ngọc dùng #0e7558 (5.5:1)
  c2-do: "#c8352b"       # quá hạn / không đạt; chữ đỏ #b42318 (6.4:1)
  c3-ho-phach: "#e09a1a" # chờ soát xét / chờ ký
  seal: "#b8860b"        # chỉ cho số tem
  dark-b0: "#0c0d11"
  dark-card: "#22252c"
  dark-c1: "#3ddc97"

typography:
  ui: { family: Be Vietnam Pro, body: 14px, small: 12–13px, min: 11px }
  page-title: { size: 22–26px, weight: 600, tracking: -0.02em }
  greeting: { size: clamp(28px,3.4vw,44px), weight: 600, tracking: -0.035em }
  kpi-number: { size: clamp(28px,2.6vw,38px), weight: 600, tabular-nums }
  document: { family: Tinos, size: 12–13pt }

radius: { control: 12px, pill: 999px, card: 18px, glass-bar: 20px, dialog: 22px }
hit-target: { desktop: ">= 32px (min 28)", touch: ">= 44px" }
---

# DESIGN.md — ManagerCAL

Đọc tệp này trước khi thêm hoặc sửa màn hình. Token ở `src/index.css` (`:root`, `:root.dark`, `@theme`); thành phần dùng chung ở `src/components/ui.tsx`; khung ở `src/layouts/MainLayout.tsx`. Khi CSS và tệp này lệch nhau, CSS là sự thật – sửa tệp này cho khớp.

## Hai lớp vật liệu

| Lớp | Vật liệu | Dùng cho |
|---|---|---|
| Nền | đốm màu làm mờ + voan (`.app-bg`), vẽ một lần, cố định | toàn ứng dụng |
| Điều khiển | **kính** (`.glass`): trong mờ, viền sáng, blur 26px | thanh trên, thanh bên, dock điện thoại, nhóm tab, nút tròn (`.round`) |
| Nội dung | **đục** (`.card`, `--card` 92% trắng ngà) | bảng, biểu mẫu, biên bản, hồ sơ – mọi thứ phải đọc lâu |
| Màn hình nhìn | thẻ kính (`.gc`) | chỉ **Tổng quan** |

Không đặt kính lên kính; không dùng `.gc` cho màn hình nhập liệu. `prefers-reduced-transparency` → kính thành đục.

## Màu – một màu một nghĩa

- **Đen** (`--accent`): hành động chính, một nút mỗi vùng (`Button variant="primary"`, `.btn--primary`).
- **Ngọc** (`brand-*`, `--c1`): Đạt, xong, mục đang chọn, liên kết. Chữ ngọc luôn dùng `brand-700` / `--c1-lo`.
- **Đỏ**: quá hạn, không đạt, lỗi, huỷ. Luôn kèm chữ ("quá hạn 5 ngày", "Không đạt"), không chỉ dựa vào màu.
- **Hổ phách**: đang chờ người khác (soát xét, ký).
- **Vàng đồng**: chỉ số tem (`.seal-no`).
- Trung tính tông ấm: thang `slate-*` đã được định nghĩa lại (400 = 4,9:1, 500 = 6,4:1 trên thẻ). Không dùng tím/hồng làm nhấn.
- Thẻ nhấn trên Tổng quan: `gc--emerald` (một thẻ: GCN tháng này), `gc--alert` chỉ khi có cảnh báo thật (phiếu quá hạn > 0), `gc--bank` (thẻ tối "Việc của tôi").

## Chữ

Be Vietnam Pro (đủ dấu tiếng Việt). Thang: 12 (nhãn, tiêu đề cột), 13 (phụ), 14 (thân), 15 (tiêu đề khối), 22–26 (tiêu đề trang); lời chào và số KPI theo clamp. Số liệu, tiền, ngày: `tabular-nums`, căn phải trong bảng. Tiêu đề viết thường kiểu câu; không chữ in hoa giãn cách. Tên người, số GCN, số tem, số sê-ri giữ nguyên văn.

## Khung

- Thanh trên: kính viên thuốc, cách mép 12–16px, cao 58px: logo + tên công ty | trạng thái (chấm + chế độ + giờ) | tra cứu, sáng/tối, thông báo, tài khoản (menu: đổi mật khẩu, đăng xuất).
- Thanh bên (≥ 1024px): kính bo 20px cách mép 16px; mục đang chọn là chip trắng có bóng (như cột biểu tượng của CV).
- Điện thoại: dock kính viên thuốc ở đáy (4 mục + "Tất cả mục"), không cuộn ngang, lề 12–16px.
- Trang: tiêu đề + một dòng phụ, hành động chính bên phải (`PageHeader`). Không hero, trừ lời chào của Tổng quan.

## Thành phần

- `Button`: viên thuốc; `primary` đen, `secondary` trắng ngà viền mảnh, `ghost`, `danger` đỏ. Hành động phá huỷ phải hỏi lại.
- `Tabs`: nhóm viên thuốc kính, mục chọn là chip trắng.
- `Badge`: nền nhạt + chữ đậm, cao ≥ 22px.
- `Card`: đục, bo 18px, tiêu đề 15px không kẻ ngang.
- `Stat`: thẻ đục, nhãn + số lớn + dòng phụ.
- Bảng `.table`: kẻ ngang mảnh, tiêu đề cột 12px kiểu câu, không sọc. Bảng luôn nằm trong `.table-wrap` để cuộn ngang trên điện thoại.
- `Modal`: tấm đục bo 22px, nền sau mờ nhẹ.
- Cột nhỏ trong thẻ KPI (`.gx-bars`): **dữ liệu thật** của 6 kỳ gần nhất, cột cuối là kỳ hiện tại. Không vẽ cột trang trí.
- Giấy chứng nhận (`.doc`): tờ A4 trắng, Times, góc vuông, không theo chủ đề sáng/tối.

## Chuyển động (Emil Kowalski)

Chỉ `transform`, `opacity`, màu; ease-out `cubic-bezier(.2,.8,.2,1)`; nhấn nút 120ms, menu/hộp thoại ≤ 240ms; thẻ Tổng quan hiện lần lượt 50ms một lần khi mở trang. Nhấc thẻ khi rê chuột chỉ cho thẻ bấm được và chỉ trên chuột. `prefers-reduced-motion` tắt hết.

## Rà soát theo Apple HIG (bắt buộc trước khi chụp hình duyệt)

1. Tương phản ≥ 4,5:1 cho chữ ≤ 17px (đo từ mã màu, cả sáng và tối). Đã đo: chữ chính 17:1, `--ink-3` ~6:1, `slate-400` 4,9:1, ngọc 700 5,5:1, đỏ 700 6,4:1, chữ trắng trên nút đen 17:1, chữ trắng trên `brand-600` 4,9:1; tối: chữ phụ 6,5:1, ngọc 8,7:1.
2. Chữ ≥ 11px (nhỏ nhất: số đếm trên chuông 11px).
3. Vùng bấm ≥ 28px máy tính (nút nhỏ 32px, nút tròn 40px), ≥ 44px cảm ứng (`@media (pointer: coarse)`).

Ngoài ra: `:focus-visible` viền ngọc 2px trên mọi phần tử; nút chỉ có biểu tượng phải có `aria-label`; `prefers-contrast: more` làm đậm viền và chữ phụ.

## Điện thoại (< 640px)

- **Bảng → thẻ, tự động:** mọi `.table` trên điện thoại hiển thị thành thẻ. Ô có chữ đầu tiên là tiêu đề thẻ; các ô còn lại xếp 2 cột, kèm nhãn lấy từ tiêu đề cột (`useCardTables` gán `data-label`). Ô chỉ có ô chọn nằm ở góc phải trên, vùng bấm 44px. Ô chỉ có nút thao tác chiếm cả dòng. Ô trống ("–") bị ẩn. Bảng số liệu cần giữ dạng lưới thì thêm `.table--grid` (mẫu biên bản trong Danh mục, bảng dung lượng).
- **Ô nhập cỡ chữ 16px** để iPhone không tự phóng to khi gõ. Ô số đọc của biên bản cao 44px.
- **Vùng bấm 44px:** nút (kể cả `size="sm"`), nút tròn, tab, nút Đạt / Không đạt.
- **Thao tác chính của trang dài nổi ở đáy, ngay trên dock** (vd. Lưu nháp / Nộp soát xét khi nhập biên bản). Dùng lớp kính `.glass`, `sticky bottom-[84px]`; từ 640px trở lên thanh này nằm yên ở chỗ cũ.
- **Tờ A4** (GCN, phiếu tiếp nhận) tự co cho vừa màn hình; khi in vẫn đúng khổ.
- **Điện thoại làm được mọi việc như máy tính** (tiếp nhận đơn, phân công, nhập biên bản, soát xét, ký phát hành, trả thiết bị, chat, nhờ đồng nghiệp): không ẩn chức năng nào, chỉ đổi cách bày. Mọi luồng e2e chạy ở cả hai cỡ (`npx playwright test` có dự án `may-tinh` và `dien-thoai`; máy chủ: `npm run test:e2e:server:phone`).
- **Thanh trên** chỉ giữ: logo + tên ngắn, số đồng nghiệp online, chat, thông báo, tài khoản (có chấm trạng thái online). Tra cứu và đổi sáng/tối nằm trong menu tài khoản.
- Trong lưới/flex, thẻ và ô nhập có `min-width: 0` để tên dài (khách hàng…) không đẩy trang rộng hơn màn hình.
- Kiểm thử: `tests/e2e/mobile.spec.ts`. Không trang nào được cuộn ngang ở 390px.

## Không làm (hallmark / taste-skill)

Gradient tím–xanh, glow; thẻ KPI có ô biểu tượng màu cầu vồng; sparkline hoặc số liệu bịa; thẻ lồng thẻ; eyebrow chữ in hoa giãn cách; emoji làm biểu tượng; `transition: all`; animate kích thước; chữ chung chung ("Bắt đầu ngay", "Mạnh mẽ") – dùng động từ nghề ("Tiếp nhận đơn mới", "Ký và phát hành").

## Known debt

- Một số trang còn class Tailwind màu trực tiếp (`text-red-700`, `bg-amber-50`…) thay vì token; khi sửa trang nào thì đổi sang token ở trang đó.
- Thẻ "Thiết bị đến hạn" trên Tổng quan chưa có cột nhỏ (chưa có chuỗi số liệu theo kỳ có ý nghĩa).
