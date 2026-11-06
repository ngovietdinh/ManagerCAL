// Tờ giấy chứng nhận / thông báo kết quả kiểm định – khổ A4, dựng hoàn toàn từ snapshot (bất biến)
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { dayjs } from "@/lib/format";
import { JOB_KIND_LABEL } from "@/lib/labels";
import type { Certificate, EvalSection } from "@/lib/types";

export const lookupUrl = (number: string) => `${location.origin}${location.pathname}#/lookup/${encodeURIComponent(number)}`;

const fmt = (n: number | null | undefined, decimals = 2) =>
  n == null ? "–" : new Intl.NumberFormat("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

function placeFromAddress(addr: string): string {
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  return last.replace(/^(TP\.?|Thành phố|Tỉnh)\s*/i, "") || "Hà Nội";
}

export default function CertDocument({ cert }: { cert: Certificate }) {
  const s = cert.snapshot;
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(lookupUrl(cert.number), { margin: 0, width: 220, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [cert.number]);
  const pass = cert.kind === "certificate";
  const issued = dayjs(cert.issued_at);
  const sections = (s.result?.sections ?? []).filter((x) => x.kind !== "checklist");
  const stamp = cert.status === "revoked" ? "ĐÃ THU HỒI" : cert.status === "replaced" ? "BỊ THAY THẾ" : null;

  const info: [string, string][] = [
    ["Tên phương tiện đo", [s.device.name, s.instrument_type.name !== s.device.name ? `(${s.instrument_type.name})` : ""].filter(Boolean).join(" ")],
    ["Kiểu / Số sê-ri", [s.device.model, s.device.serial].filter(Boolean).join(" / ") || "–"],
    ["Nơi sản xuất", s.device.manufacturer ?? "–"],
    ["Phạm vi đo", s.device.range_text ?? "–"],
    ["Độ phân giải / cấp chính xác", [s.device.resolution_text, s.device.accuracy_class ? `cấp ${s.device.accuracy_class}` : null].filter(Boolean).join("; ") || "–"],
    ["Nơi sử dụng", [s.customer.name, s.customer.address].filter(Boolean).join(", ")],
    ["Mã của khách hàng", s.device.customer_code ?? "–"],
    ["Hình thức kiểm định", JOB_KIND_LABEL[s.kind]],
    ["Phương pháp kiểm định", s.procedure ? `${s.procedure.code} – ${s.procedure.name}` : "–"],
    ["Chuẩn sử dụng", s.standards.map((st) => `${st.code} – ${st.name}${st.cal_cert_no ? ` (GCN HC số ${st.cal_cert_no})` : ""}`).join("; ") || "–"],
    ["Điều kiện môi trường", [s.env.temp != null ? `nhiệt độ ${fmt(s.env.temp, 1)} °C` : null, s.env.humidity != null ? `độ ẩm ${fmt(s.env.humidity, 0)} %RH` : null, s.env.pressure != null ? `áp suất ${fmt(s.env.pressure, 0)} hPa` : null].filter(Boolean).join(", ") || "–"],
    ["Ngày kiểm định", s.performed_at ? dayjs(s.performed_at).format("DD/MM/YYYY") : "–"],
    ["Nơi kiểm định", s.place || "–"],
  ];

  return (
    <div className="doc relative" data-testid="cert-doc">
      {stamp && (
        <div className="pointer-events-none absolute left-[30mm] top-[70mm] -rotate-[20deg] border-4 px-6 py-2 text-[40pt] font-bold italic opacity-70"
          style={{ color: cert.status === "revoked" ? "#b3261e" : "#a8650f", borderColor: cert.status === "revoked" ? "#b3261e" : "#a8650f" }}>{stamp}</div>
      )}
      <table style={{ width: "100%" }}>
        <tbody><tr>
          <td style={{ width: "45%", verticalAlign: "top", fontSize: "11pt" }}>
            <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{s.company.name}</div>
            <div>{s.company.address}</div>
            <div>ĐT: {s.company.phone}{s.company.email ? ` · ${s.company.email}` : ""}</div>
          </td>
          <td style={{ verticalAlign: "top", textAlign: "center", fontSize: "11.5pt" }}>
            <div style={{ fontWeight: 700 }}>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div style={{ fontWeight: 700, textDecoration: "underline" }}>Độc lập – Tự do – Hạnh phúc</div>
          </td>
        </tr></tbody>
      </table>
      <div style={{ textAlign: "left", marginTop: "8pt", fontSize: "11.5pt" }}>Số: <b>{cert.number}</b>{cert.replaces_id ? " (bản thay thế)" : ""}</div>
      <h1>{pass ? "GIẤY CHỨNG NHẬN KIỂM ĐỊNH" : "THÔNG BÁO KẾT QUẢ KIỂM ĐỊNH"}</h1>
      <div className="sub" style={{ fontSize: "11pt" }}>{pass ? "CERTIFICATE OF VERIFICATION" : "NOTICE OF VERIFICATION RESULT"}</div>
      {!pass && <div className="center" style={{ marginTop: "4pt", fontWeight: 700, fontSize: "13pt" }}>Kết luận: KHÔNG ĐẠT</div>}

      <table className="grid" style={{ marginTop: "8pt" }}>
        <tbody>
          {info.map(([k, v]) => (
            <tr key={k}><td style={{ width: "36%", fontWeight: 700 }}>{k}</td><td>{v}</td></tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Kết luận</td>
            <td style={{ fontWeight: 700 }}>{pass ? "ĐẠT yêu cầu kỹ thuật đo lường" : "KHÔNG ĐẠT yêu cầu kỹ thuật đo lường"}</td>
          </tr>
          {pass && <tr><td style={{ fontWeight: 700 }}>Số tem kiểm định</td><td>{cert.seal_no ?? "–"}</td></tr>}
          {pass && <tr><td style={{ fontWeight: 700 }}>Có hiệu lực đến ngày</td><td style={{ fontWeight: 700 }}>{cert.valid_to ? dayjs(cert.valid_to).format("DD/MM/YYYY") : "–"}</td></tr>}
        </tbody>
      </table>

      {sections.length > 0 && (
        <>
          <div style={{ marginTop: "8pt", fontWeight: 700, fontSize: "11.5pt" }}>Kết quả kiểm định</div>
          <table className="grid" style={{ marginTop: "3pt" }}>
            <thead><tr>
              <th style={{ textAlign: "left" }}>Nội dung / điểm kiểm</th><th style={{ width: "20%" }}>Sai số</th><th style={{ width: "20%" }}>Sai số cho phép</th><th style={{ width: "14%" }}>Kết quả</th>
            </tr></thead>
            <tbody>
              {sections.map((sec: EvalSection) => (
                <SectionRows key={sec.id} sec={sec} />
              ))}
            </tbody>
          </table>
        </>
      )}

      <table style={{ width: "100%", marginTop: "14pt", pageBreakInside: "avoid" }}>
        <tbody><tr>
          <td style={{ width: "40%", verticalAlign: "top", fontSize: "10pt" }}>
            {qr && <img src={qr} alt="Mã QR tra cứu" style={{ width: "28mm", height: "28mm" }} />}
            <div>Quét mã để tra cứu giấy chứng nhận</div>
            <div style={{ marginTop: "6pt" }}>Kiểm định viên: {s.performer?.full_name ?? "–"}{s.performer?.inspector_card_no ? ` (thẻ số ${s.performer.inspector_card_no})` : ""}</div>
            <div style={{ color: "#555", fontSize: "9pt" }}>Mã băm: {cert.hash.slice(0, 12)}</div>
          </td>
          <td style={{ verticalAlign: "top", textAlign: "center" }}>
            <div style={{ fontStyle: "italic" }}>{placeFromAddress(s.company.address)}, ngày {issued.format("DD")} tháng {issued.format("MM")} năm {issued.format("YYYY")}</div>
            <div style={{ fontWeight: 700, marginTop: "2pt" }}>{s.signer.title ? s.signer.title.toUpperCase() : "NGƯỜI KÝ"}</div>
            <div style={{ height: "22mm" }} />
            <div style={{ fontWeight: 700 }}>{s.signer.full_name}</div>
          </td>
        </tr></tbody>
      </table>
    </div>
  );
}

function SectionRows({ sec }: { sec: EvalSection }) {
  const d = sec.decimals ?? 2;
  const unit = sec.unit ? ` ${sec.unit}` : "";
  return (
    <>
      <tr><td colSpan={4} style={{ fontWeight: 700, background: "#f0f0f0" }}>{sec.title}</td></tr>
      {sec.rows.map((r, i) => (
        <tr key={i}>
          <td>{r.label}</td>
          <td className="center">{r.error == null ? "–" : `${r.error > 0 ? "+" : ""}${fmt(r.error, d + 1)}${unit}`}</td>
          <td className="center">{r.mpe == null ? "–" : `± ${fmt(r.mpe, d + 1)}${unit}`}</td>
          <td className="center">{r.pass == null ? "–" : r.pass ? "Đạt" : "Không đạt"}</td>
        </tr>
      ))}
    </>
  );
}
