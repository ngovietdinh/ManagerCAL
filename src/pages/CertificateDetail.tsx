import { ArrowLeft, Ban, Printer, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData, useIndex, useRow } from "@/app/data";
import CertDocument from "@/components/CertDocument";
import { Badge, Button, Empty, Field, Input, Loading, Modal, Textarea, useUi } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CERT_KIND_LABEL, CERT_STATUS_LABEL, CERT_STATUS_TONE } from "@/lib/labels";
import type { CertSnapshot } from "@/lib/types";

export default function CertificateDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { svc, can } = useData();
  const { row: cert, loading } = useRow("certificates", id);
  const certs = useIndex("certificates");
  const users = useIndex("users");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cust, setCust] = useState<CertSnapshot["customer"] | null>(null);
  const [dev, setDev] = useState<CertSnapshot["device"] | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!cert) return <Empty text="Không tìm thấy giấy chứng nhận." action={<Link className="link" to="/certificates">Về sổ cấp GCN</Link>} />;

  const openReplace = () => { setReason(""); setCust({ ...cert.snapshot.customer }); setDev({ ...cert.snapshot.device }); setReplaceOpen(true); };
  const doReplace = async () => {
    if (!reason.trim()) { ui.toast("Cần ghi lý do thay thế.", "error"); return; }
    setBusy(true);
    try {
      const nc = await svc.replaceCertificate(cert.id, { reason: reason.trim(), customer: cust ?? undefined, device: dev ?? undefined });
      ui.toast(`Đã phát hành bản thay thế số ${nc.number}.`);
      setReplaceOpen(false);
      nav(`/certificates/${nc.id}`);
    } catch (e) { ui.error(e); } finally { setBusy(false); }
  };
  const doRevoke = async () => {
    if (!reason.trim()) { ui.toast("Cần ghi lý do thu hồi.", "error"); return; }
    if (!(await ui.confirm({ title: `Thu hồi ${cert.number}?`, message: "Giấy chứng nhận sẽ mất hiệu lực, khách hàng và cơ quan tra cứu sẽ thấy trạng thái thu hồi. Không hoàn tác được.", danger: true, confirmText: "Thu hồi" }))) return;
    setBusy(true);
    try { await svc.revokeCertificate(cert.id, reason.trim()); ui.toast("Đã thu hồi giấy chứng nhận."); setRevokeOpen(false); } catch (e) { ui.error(e); } finally { setBusy(false); }
  };

  const replaced = cert.replaces_id ? certs[cert.replaces_id] : null;
  const replacedBy = cert.replaced_by_id ? certs[cert.replaced_by_id] : null;
  const signer = users[cert.signer_id];

  return (
    <>
      <div className="no-print mb-4">
        <Link to="/certificates" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Sổ cấp GCN</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{CERT_KIND_LABEL[cert.kind]} số {cert.number}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Badge tone={CERT_STATUS_TONE[cert.status]}>{CERT_STATUS_LABEL[cert.status]}</Badge>
              <span>Cấp ngày {fmtDate(cert.issued_at)}{cert.valid_to ? `, hiệu lực đến ${fmtDate(cert.valid_to)}` : ""}</span>
              <span>· Ký: {signer?.full_name ?? cert.snapshot.signer.full_name}</span>
              {cert.seal_no && <span>· Tem <span className="seal-no">{cert.seal_no}</span></span>}
              <span>· Mã băm <code className="text-xs">{cert.hash.slice(0, 12)}</code></span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Phiếu <Link className="link" to={`/jobs/${cert.job_id}`}>công việc</Link>
              {replaced && <> · Thay thế GCN số <Link className="link" to={`/certificates/${replaced.id}`}>{replaced.number}</Link></>}
              {replacedBy && <> · Được thay thế bởi số <Link className="link" to={`/certificates/${replacedBy.id}`}>{replacedBy.number}</Link></>}
              {cert.revoke_reason && <> · Lý do: {cert.revoke_reason}</>}
              <span className="text-xs"> · tạo {fmtDateTime(cert.created_at)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>In / Lưu PDF</Button>
            {can("sign") && cert.status === "valid" && <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={openReplace}>Thay thế</Button>}
            {can("sign") && cert.status === "valid" && <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => { setReason(""); setRevokeOpen(true); }}>Thu hồi</Button>}
          </div>
        </div>
        {cert.status !== "valid" && (
          <div className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold ${cert.status === "revoked" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
            {cert.status === "revoked" ? "ĐÃ THU HỒI" : "BỊ THAY THẾ"}{cert.revoke_reason ? ` – ${cert.revoke_reason}` : ""}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <CertDocument cert={cert} />
      </div>

      <Modal open={replaceOpen} onClose={() => setReplaceOpen(false)} title={`Thay thế ${cert.number}`} size="lg"
        footer={<><Button variant="secondary" onClick={() => setReplaceOpen(false)}>Huỷ</Button><Button loading={busy} onClick={doReplace}>Phát hành bản thay thế</Button></>}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Bản thay thế nhận số mới, bản này chuyển sang trạng thái "Bị thay thế". Chỉ sửa được thông tin hành chính; kết quả đo giữ nguyên.</p>
        <Field label="Lý do thay thế" className="mb-3"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: sai địa chỉ khách hàng" /></Field>
        {cust && dev && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên khách hàng"><Input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></Field>
            <Field label="Mã số thuế"><Input value={cust.tax_code ?? ""} onChange={(e) => setCust({ ...cust, tax_code: e.target.value || null })} /></Field>
            <Field label="Địa chỉ" className="sm:col-span-2"><Input value={cust.address ?? ""} onChange={(e) => setCust({ ...cust, address: e.target.value || null })} /></Field>
            <Field label="Tên thiết bị"><Input value={dev.name} onChange={(e) => setDev({ ...dev, name: e.target.value })} /></Field>
            <Field label="Hãng sản xuất"><Input value={dev.manufacturer ?? ""} onChange={(e) => setDev({ ...dev, manufacturer: e.target.value || null })} /></Field>
            <Field label="Kiểu"><Input value={dev.model ?? ""} onChange={(e) => setDev({ ...dev, model: e.target.value || null })} /></Field>
            <Field label="Số sê-ri"><Input value={dev.serial ?? ""} onChange={(e) => setDev({ ...dev, serial: e.target.value || null })} /></Field>
            <Field label="Phạm vi đo"><Input value={dev.range_text ?? ""} onChange={(e) => setDev({ ...dev, range_text: e.target.value || null })} /></Field>
            <Field label="Vị trí sử dụng"><Input value={dev.location ?? ""} onChange={(e) => setDev({ ...dev, location: e.target.value || null })} /></Field>
            <Field label="Mã của khách"><Input value={dev.customer_code ?? ""} onChange={(e) => setDev({ ...dev, customer_code: e.target.value || null })} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title={`Thu hồi ${cert.number}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setRevokeOpen(false)}>Huỷ</Button><Button variant="danger" loading={busy} onClick={doRevoke}>Thu hồi</Button></>}>
        <Field label="Lý do thu hồi"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: phát hiện chuẩn sử dụng bị sai" /></Field>
      </Modal>
    </>
  );
}
