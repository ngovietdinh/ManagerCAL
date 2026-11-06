import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIndex, useTable } from "@/app/data";
import { Badge, Button, Empty, Input, Loading, MonthPicker, PageHeader, Select, useUi } from "@/components/ui";
import { exportXlsx } from "@/lib/excel";
import { fmtDate, monthStr } from "@/lib/format";
import { CERT_KIND_LABEL, CERT_STATUS_LABEL, CERT_STATUS_TONE } from "@/lib/labels";
import type { CertKind, CertStatus } from "@/lib/types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

export default function Certificates() {
  const nav = useNavigate();
  const ui = useUi();
  const { rows: certs, loading } = useTable("certificates", { orderBy: { field: "issued_at", dir: "desc" } });
  const users = useIndex("users");
  const [kind, setKind] = useState<CertKind | "">("");
  const [status, setStatus] = useState<CertStatus | "">("");
  const [month, setMonth] = useState<string>("");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const k = norm(q.trim());
    return certs.filter((c) => {
      if (kind && c.kind !== kind) return false;
      if (status && c.status !== status) return false;
      if (month && monthStr(c.issued_at) !== month) return false;
      if (k) {
        const hay = norm([c.number, c.snapshot.customer.name, c.snapshot.device.name, c.snapshot.device.serial ?? "", c.snapshot.device.model ?? "", c.seal_no ?? ""].join(" "));
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [certs, kind, status, month, q]);

  const exportList = async () => {
    try {
      await exportXlsx(`so-cap-gcn${month ? "-" + month : ""}`, [{
        name: "Sổ cấp GCN", title: "SỔ CẤP GIẤY CHỨNG NHẬN KIỂM ĐỊNH",
        columns: [
          { header: "Số GCN", key: "number", width: 18 }, { header: "Loại", key: "kind", width: 26 }, { header: "Khách hàng", key: "customer", width: 36 },
          { header: "Thiết bị", key: "device", width: 28 }, { header: "Kiểu / Sê-ri", key: "serial", width: 22 }, { header: "Loại PTĐ", key: "type", width: 22 },
          { header: "Ngày cấp", key: "issued", width: 12 }, { header: "Hiệu lực đến", key: "valid", width: 12 }, { header: "Số tem", key: "seal", width: 14 },
          { header: "Người ký", key: "signer", width: 22 }, { header: "Trạng thái", key: "status", width: 14 },
        ],
        rows: list.map((c) => ({
          number: c.number, kind: CERT_KIND_LABEL[c.kind], customer: c.snapshot.customer.name, device: c.snapshot.device.name,
          serial: [c.snapshot.device.model, c.snapshot.device.serial].filter(Boolean).join(" / "), type: c.snapshot.instrument_type.name,
          issued: fmtDate(c.issued_at), valid: fmtDate(c.valid_to), seal: c.seal_no ?? "", signer: c.snapshot.signer.full_name, status: CERT_STATUS_LABEL[c.status],
        })),
      }]);
    } catch (e) { ui.error(e); }
  };

  return (
    <>
      <PageHeader title="Giấy chứng nhận" subtitle="Sổ cấp giấy chứng nhận kiểm định và thông báo kết quả không đạt"
        actions={<Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportList} disabled={!list.length}>Xuất Excel</Button>} />
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <Input className="max-w-xs" placeholder="Tìm số GCN, khách, thiết bị, sê-ri, tem…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
        <Select className="w-auto" value={kind} onChange={(e) => setKind(e.target.value as CertKind | "")} aria-label="Loại">
          <option value="">Mọi loại</option>
          {(Object.keys(CERT_KIND_LABEL) as CertKind[]).map((k) => <option key={k} value={k}>{CERT_KIND_LABEL[k]}</option>)}
        </Select>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as CertStatus | "")} aria-label="Trạng thái">
          <option value="">Mọi trạng thái</option>
          {(Object.keys(CERT_STATUS_LABEL) as CertStatus[]).map((k) => <option key={k} value={k}>{CERT_STATUS_LABEL[k]}</option>)}
        </Select>
        <MonthPicker value={month || monthStr()} onChange={setMonth} />
        {month && <Button size="sm" variant="ghost" onClick={() => setMonth("")}>Mọi tháng</Button>}
        <span className="ml-auto text-xs text-slate-500">{list.length} / {certs.length} bản</span>
      </div>
      {loading ? <Loading /> : list.length === 0 ? (
        <div className="card"><Empty text={certs.length ? "Không có giấy chứng nhận khớp bộ lọc." : "Chưa phát hành giấy chứng nhận nào – phát hành từ phiếu công việc ở bước phê duyệt."} /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr>
              <th>Số GCN</th><th>Loại</th><th>Khách hàng</th><th>Thiết bị</th><th>Loại PTĐ</th><th>Ngày cấp</th><th>Hiệu lực đến</th><th>Số tem</th><th>Người ký</th><th>Trạng thái</th>
            </tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/certificates/${c.id}`)}>
                  <td className="whitespace-nowrap font-medium tabular-nums">{c.number}</td>
                  <td><Badge tone={c.kind === "certificate" ? "green" : "red"}>{c.kind === "certificate" ? "GCN" : "Không đạt"}</Badge></td>
                  <td className="max-w-64 truncate">{c.snapshot.customer.name}</td>
                  <td>
                    <div>{c.snapshot.device.name}</div>
                    <div className="text-xs text-slate-500">{[c.snapshot.device.model, c.snapshot.device.serial].filter(Boolean).join(" · ") || "–"}</div>
                  </td>
                  <td>{c.snapshot.instrument_type.name}</td>
                  <td className="whitespace-nowrap tabular-nums">{fmtDate(c.issued_at)}</td>
                  <td className="whitespace-nowrap tabular-nums">{fmtDate(c.valid_to)}</td>
                  <td>{c.seal_no ? <span className="seal-no">{c.seal_no}</span> : "–"}</td>
                  <td>{users[c.signer_id]?.full_name ?? c.snapshot.signer.full_name}</td>
                  <td><Badge tone={CERT_STATUS_TONE[c.status]}>{CERT_STATUS_LABEL[c.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
