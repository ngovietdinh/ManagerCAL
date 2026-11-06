import { Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData, useIndex, useRow, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, Loading, Modal, PageHeader, Tabs, useUi } from "@/components/ui";
import { dueText, dueTone } from "@/components/aHelpers";
import { DeviceFields, cleanDevice, emptyDevice, type DeviceForm } from "@/components/DeviceForm";
import { fmtDate, money } from "@/lib/format";
import { CERT_KIND_LABEL, CERT_STATUS_LABEL, CERT_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, RESULT_LABEL } from "@/lib/labels";
import type { Device } from "@/lib/types";
import { CustomerFields, type CustomerForm } from "./Customers";

type Tab = "devices" | "orders" | "certs";

export default function CustomerDetail() {
  const { id } = useParams();
  const { svc, can, users } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const { row: c, loading } = useRow("customers", id);
  const { rows: devices } = useTable("devices", { where: { customer_id: id ?? "" }, orderBy: { field: "name" } });
  const { rows: orders } = useTable("orders", { where: { customer_id: id ?? "" }, orderBy: { field: "received_at", dir: "desc" } });
  const { rows: certs } = useTable("certificates", { where: { customer_id: id ?? "" }, orderBy: { field: "issued_at", dir: "desc" } });
  const { rows: jobs } = useTable("jobs", { where: { customer_id: id ?? "" } });
  const types = useIndex("instrument_types");
  const [tab, setTab] = useState<Tab>("devices");
  const [edit, setEdit] = useState<CustomerForm | null>(null);
  const [dev, setDev] = useState<{ id: string | null; f: DeviceForm } | null>(null);
  const [saving, setSaving] = useState(false);

  const deviceById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const jobsByOrder = useMemo(() => {
    const m: Record<string, number> = {};
    for (const j of jobs) m[j.order_id] = (m[j.order_id] ?? 0) + 1;
    return m;
  }, [jobs]);

  if (loading) return <Loading />;
  if (!c) return <Empty text="Không tìm thấy khách hàng." action={<Link className="link" to="/customers">Về danh sách</Link>} />;

  const saveCustomer = async () => {
    if (!edit || !edit.name.trim()) { ui.toast("Cần nhập tên khách hàng", "error"); return; }
    setSaving(true);
    try {
      await svc.patch("customers", "customers", c.id, { ...edit, name: edit.name.trim(), tax_code: edit.tax_code || null, address: edit.address || null, phone: edit.phone || null, email: edit.email || null, contact_name: edit.contact_name || null, contact_phone: edit.contact_phone || null, note: edit.note || null });
      ui.toast("Đã lưu thông tin khách hàng");
      setEdit(null);
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };

  const saveDevice = async () => {
    if (!dev) return;
    if (!dev.f.instrument_type_id) { ui.toast("Cần chọn loại phương tiện đo", "error"); return; }
    if (!dev.f.name.trim()) { ui.toast("Cần nhập tên thiết bị", "error"); return; }
    setSaving(true);
    try {
      const data = cleanDevice(dev.f);
      if (dev.id) await svc.patch("customers", "devices", dev.id, data);
      else await svc.createDevice({ ...data, customer_id: c.id });
      ui.toast(dev.id ? "Đã lưu thiết bị" : "Đã thêm thiết bị");
      setDev(null);
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };

  const editDevice = (d: Device) => setDev({ id: d.id, f: { instrument_type_id: d.instrument_type_id, name: d.name, manufacturer: d.manufacturer, model: d.model, serial: d.serial, range_text: d.range_text, resolution_text: d.resolution_text, accuracy_class: d.accuracy_class, location: d.location, customer_code: d.customer_code, next_due: d.next_due, note: d.note } });

  const sales = users.find((u) => u.id === c.sales_user_id);
  const info: [string, string | null | undefined][] = [
    ["Mã số thuế", c.tax_code], ["Địa chỉ", c.address], ["Điện thoại", c.phone], ["Email", c.email],
    ["Người liên hệ", [c.contact_name, c.contact_phone].filter(Boolean).join(" · ")], ["NV kinh doanh", sales?.full_name], ["Ghi chú", c.note],
  ];

  return (
    <>
      <PageHeader title={c.name} subtitle={`${c.code}${c.active ? "" : " · đã ngừng"}`}
        actions={<>
          {can("customers") && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit({ name: c.name, tax_code: c.tax_code, address: c.address, phone: c.phone, email: c.email, contact_name: c.contact_name, contact_phone: c.contact_phone, sales_user_id: c.sales_user_id, note: c.note })}>Sửa</Button>}
          {can("orders") && <Button onClick={() => nav(`/orders/new?customer=${c.id}`)}>Tạo đơn hàng</Button>}
        </>} />
      <Card className="mb-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v || "–"}</dd></div>)}
        </dl>
      </Card>
      <Tabs className="mb-3 w-fit max-w-full" value={tab} onChange={setTab} items={[
        { value: "devices", label: "Thiết bị", count: devices.length }, { value: "orders", label: "Đơn hàng", count: orders.length }, { value: "certs", label: "Giấy chứng nhận", count: certs.length },
      ]} />

      {tab === "devices" && (
        <Card bodyClass="p-0" title="Thiết bị của khách" actions={can("customers") && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setDev({ id: null, f: emptyDevice() })}>Thêm thiết bị</Button>}>
          {devices.length === 0 ? <Empty text="Khách chưa có thiết bị nào — thêm thiết bị hoặc tạo đơn hàng với thiết bị mới." /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Thiết bị</th><th>Hãng / kiểu</th><th>Số sê-ri</th><th>Loại PTĐ</th><th>Vị trí</th><th>Kết quả gần nhất</th><th>Hạn kế tiếp</th><th></th></tr></thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className={d.status === "retired" ? "opacity-50" : ""}>
                      <td><div className="font-medium">{d.name}</div><div className="text-xs text-slate-500">{d.customer_code ?? ""}{d.range_text ? ` · ${d.range_text}` : ""}</div></td>
                      <td>{[d.manufacturer, d.model].filter(Boolean).join(" ") || "–"}</td>
                      <td className="tabular-nums">{d.serial ?? "–"}</td>
                      <td>{types[d.instrument_type_id]?.name ?? "–"}</td>
                      <td>{d.location ?? "–"}</td>
                      <td>{d.last_result ? <Badge tone={d.last_result === "pass" ? "green" : "red"}>{RESULT_LABEL[d.last_result]}</Badge> : "–"}</td>
                      <td>{d.next_due ? <><div>{fmtDate(d.next_due)}</div><Badge tone={dueTone(d.next_due)}>{dueText(d.next_due)}</Badge></> : "–"}</td>
                      <td className="text-right">{can("customers") && <Button size="sm" variant="ghost" className="min-h-7" onClick={() => editDevice(d)} aria-label="Sửa thiết bị"><Pencil className="h-4 w-4" /></Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "orders" && (
        <Card bodyClass="p-0" title="Đơn hàng">
          {orders.length === 0 ? <Empty text="Chưa có đơn hàng nào." /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Mã đơn</th><th>Ngày nhận</th><th>Hẹn trả</th><th className="num">Số phiếu</th><th className="num">Tổng tiền</th><th>Đã thu</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/orders/${o.id}`)}>
                    <td className="font-medium">{o.code}{o.onsite && <Badge tone="cyan" className="ml-1">Hiện trường</Badge>}</td>
                    <td>{fmtDate(o.received_at)}</td><td>{fmtDate(o.expected_at)}</td>
                    <td className="num">{jobsByOrder[o.id] ?? 0}</td>
                    <td className="num">{money(o.total_amount)}</td>
                    <td><Badge tone={o.paid ? "green" : "amber"}>{o.paid ? `Đã thu ${fmtDate(o.paid_at)}` : "Chưa thu"}</Badge></td>
                    <td><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === "certs" && (
        <Card bodyClass="p-0" title="Giấy chứng nhận">
          {certs.length === 0 ? <Empty text="Chưa có giấy chứng nhận nào." /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Số</th><th>Loại</th><th>Thiết bị</th><th>Ngày cấp</th><th>Hiệu lực đến</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {certs.map((x) => (
                  <tr key={x.id} className="cursor-pointer" onClick={() => nav(`/certificates/${x.id}`)}>
                    <td className="font-medium tabular-nums">{x.number}</td>
                    <td><Badge tone={x.kind === "certificate" ? "green" : "red"}>{CERT_KIND_LABEL[x.kind]}</Badge></td>
                    <td>{deviceById[x.device_id]?.name ?? x.snapshot.device.name}<div className="text-xs text-slate-500">{x.snapshot.device.serial}</div></td>
                    <td>{fmtDate(x.issued_at)}</td><td>{fmtDate(x.valid_to)}</td>
                    <td><Badge tone={CERT_STATUS_TONE[x.status]}>{CERT_STATUS_LABEL[x.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Sửa thông tin khách hàng" size="lg"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button><Button loading={saving} onClick={saveCustomer}>Lưu</Button></>}>
        {edit && <CustomerFields f={edit} set={(p) => setEdit((x) => x && { ...x, ...p })} />}
      </Modal>
      <Modal open={!!dev} onClose={() => setDev(null)} title={dev?.id ? "Sửa thiết bị" : "Thêm thiết bị"} size="lg"
        footer={<><Button variant="secondary" onClick={() => setDev(null)}>Huỷ</Button><Button loading={saving} onClick={saveDevice}>Lưu</Button></>}>
        {dev && <DeviceFields f={dev.f} set={(p) => setDev((x) => x && { ...x, f: { ...x.f, ...p } })} />}
      </Modal>
    </>
  );
}
