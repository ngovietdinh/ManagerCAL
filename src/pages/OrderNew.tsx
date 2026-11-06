import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Field, Input, Modal, NumberInput, PageHeader, SearchSelect, Select, Textarea, Toggle, useUi } from "@/components/ui";
import { dueText, dueTone } from "@/components/aHelpers";
import { DeviceFields, cleanDevice, emptyDevice, type DeviceForm } from "@/components/DeviceForm";
import { fmtDate, money, todayStr } from "@/lib/format";
import { JOB_KIND_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import type { NewOrderItem } from "@/lib/services";
import type { Device, JobKind, Priority } from "@/lib/types";

const DEFAULT_CONDITION = "Hoạt động bình thường, vỏ ngoài nguyên vẹn";
type Line = { key: string; device_id?: string; device?: DeviceForm; label: string; type_id: string; kind: JobKind; price: number; priority: Priority; condition: string; accessories: string };

export default function OrderNew() {
  const { svc, me } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { rows: customers } = useTable("customers", { where: { active: true }, orderBy: { field: "name" } });
  const { rows: branches } = useTable("branches", { where: { active: true } });
  const { rows: devices } = useTable("devices", { where: { status: "active" } });
  const types = useIndex("instrument_types");
  const procedures = useIndex("procedures");

  const [customerId, setCustomerId] = useState<string | null>(params.get("customer"));
  const [branchId, setBranchId] = useState<string | null>(me?.branch_id ?? null);
  const [receivedAt, setReceivedAt] = useState(todayStr());
  const [expectedAt, setExpectedAt] = useState("");
  const [onsite, setOnsite] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickSel, setPickSel] = useState<Set<string>>(new Set());
  const [newDev, setNewDev] = useState<DeviceForm | null>(null);
  const [saving, setSaving] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const customerDevices = useMemo(() => devices.filter((d) => d.customer_id === customerId), [devices, customerId]);

  useEffect(() => {
    if (branches.length && !branchId) setBranchId(branches[0].id);
  }, [branches, branchId]);

  // điền người liên hệ theo khách
  useEffect(() => {
    if (!customer) return;
    setContactName(customer.contact_name ?? "");
    setContactPhone(customer.contact_phone ?? customer.phone ?? "");
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineFromDevice = (d: Device): Line => ({
    key: d.id, device_id: d.id, label: d.name, type_id: d.instrument_type_id, kind: d.last_cert_id || d.next_due ? "periodic" : "initial",
    price: types[d.instrument_type_id]?.default_price ?? 0, priority: "normal", condition: DEFAULT_CONDITION, accessories: "",
  });

  // prefill thiết bị từ URL
  const prefill = params.get("device");
  useEffect(() => {
    if (!prefill || !customerDevices.length || !Object.keys(types).length) return;
    const ids = prefill.split(",");
    setLines((ls) => {
      const have = new Set(ls.map((l) => l.key));
      const add = customerDevices.filter((d) => ids.includes(d.id) && !have.has(d.id)).map(lineFromDevice);
      return add.length ? [...ls, ...add] : ls;
    });
  }, [prefill, customerDevices, types]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeCustomer = (id: string | null) => {
    if (id !== customerId && lines.length) {
      if (!window.confirm("Đổi khách hàng sẽ xoá danh sách thiết bị đang chọn. Tiếp tục?")) return;
      setLines([]);
    }
    setCustomerId(id);
  };

  const addPicked = () => {
    const have = new Set(lines.map((l) => l.key));
    setLines((ls) => [...ls, ...customerDevices.filter((d) => pickSel.has(d.id) && !have.has(d.id)).map(lineFromDevice)]);
    setPickSel(new Set());
    setPickOpen(false);
  };

  const addNewDevice = () => {
    if (!newDev) return;
    if (!newDev.instrument_type_id) { ui.toast("Cần chọn loại phương tiện đo", "error"); return; }
    if (!newDev.name.trim()) { ui.toast("Cần nhập tên thiết bị", "error"); return; }
    const f = cleanDevice(newDev);
    setLines((ls) => [...ls, { key: `new-${Date.now()}`, device: f, label: `${f.name}${f.serial ? ` (${f.serial})` : ""} – mới`, type_id: f.instrument_type_id, kind: f.next_due ? "periodic" : "initial", price: types[f.instrument_type_id]?.default_price ?? 0, priority: "normal", condition: DEFAULT_CONDITION, accessories: "" }]);
    setNewDev(null);
  };

  const setLine = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const total = lines.reduce((s, l) => s + (l.price || 0), 0);

  const procWarning = (type_id: string) => {
    const t = types[type_id];
    const p = t?.procedure_id ? procedures[t.procedure_id] : null;
    return !p || p.status !== "active";
  };

  const submit = async () => {
    if (!customerId) { ui.toast("Cần chọn khách hàng", "error"); return; }
    if (!lines.length) { ui.toast("Cần thêm ít nhất một thiết bị", "error"); return; }
    setSaving(true);
    try {
      const items: NewOrderItem[] = lines.map((l) => ({
        device_id: l.device_id, device: l.device, kind: l.kind, price: l.price, priority: l.priority,
        intake: { condition: l.condition, accessories: l.accessories, note: "" },
      }));
      const { order, jobs } = await svc.createOrder({ customer_id: customerId, branch_id: branchId, received_at: receivedAt, expected_at: expectedAt || null, onsite, contact_name: contactName || null, contact_phone: contactPhone || null, note: note || null, items });
      ui.toast(`Đã tiếp nhận đơn ${order.code} với ${jobs.length} phiếu công việc`);
      nav(`/orders/${order.id}`, { replace: true });
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Tiếp nhận đơn hàng mới" subtitle="Mỗi thiết bị trong đơn sẽ thành một phiếu công việc"
        actions={<><Button variant="secondary" onClick={() => nav(-1)}>Huỷ</Button><Button loading={saving} onClick={submit} disabled={!customerId || !lines.length}>Tiếp nhận</Button></>} />
      <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
        <Card title="Thông tin đơn">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Khách hàng *" className="sm:col-span-2">
              <SearchSelect items={customers} value={customerId} onChange={changeCustomer} getLabel={(c) => c.name} getSub={(c) => `${c.code}${c.tax_code ? ` · MST ${c.tax_code}` : ""}`} placeholder="Chọn khách hàng…" />
            </Field>
            {customer && <p className="text-xs text-slate-500 sm:col-span-2">{customer.address}</p>}
            <Field label="Chi nhánh thực hiện"><Select value={branchId ?? ""} onChange={(e) => setBranchId(e.target.value || null)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Nơi thực hiện"><div className="pt-2"><Toggle checked={onsite} onChange={setOnsite} label={onsite ? "Tại hiện trường của khách" : "Tại phòng thí nghiệm"} /></div></Field>
            <Field label="Ngày nhận *"><Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} /></Field>
            <Field label="Ngày hẹn trả"><Input type="date" value={expectedAt} min={receivedAt} onChange={(e) => setExpectedAt(e.target.value)} /></Field>
            <Field label="Người liên hệ"><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
            <Field label="SĐT liên hệ"><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        </Card>
        <Card title={`Thiết bị (${lines.length})`} bodyClass="p-0"
          actions={<>
            <Button size="sm" variant="secondary" disabled={!customerId} onClick={() => setPickOpen(true)}>Chọn từ thiết bị đã có{customerId ? ` (${customerDevices.length})` : ""}</Button>
            <Button size="sm" variant="secondary" disabled={!customerId} icon={<Plus className="h-4 w-4" />} onClick={() => setNewDev(emptyDevice())}>Thiết bị mới</Button>
          </>}>
          {lines.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{customerId ? "Chưa có thiết bị nào — chọn từ thiết bị đã có của khách hoặc thêm thiết bị mới." : "Chọn khách hàng trước, rồi thêm thiết bị."}</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((l, i) => (
                <div key={l.key} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <div className="font-medium">{i + 1}. {l.label} <span className="text-xs font-normal text-slate-500">· {types[l.type_id]?.name}</span></div>
                    {procWarning(l.type_id) && <div className="mt-1 flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Loại PTĐ này chưa có quy trình kiểm định đang áp dụng – vẫn tiếp nhận được, nhưng cần gắn quy trình trước khi thực hiện.</div>}
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      <Field label="Loại kiểm định"><Select className="input-sm" value={l.kind} onChange={(e) => setLine(l.key, { kind: e.target.value as JobKind })}>{(Object.keys(JOB_KIND_LABEL) as JobKind[]).map((k) => <option key={k} value={k}>{JOB_KIND_LABEL[k]}</option>)}</Select></Field>
                      <Field label="Đơn giá (đ)"><NumberInput className="input-sm" value={l.price} onChange={(v) => setLine(l.key, { price: v })} /></Field>
                      <Field label="Ưu tiên"><Select className="input-sm" value={l.priority} onChange={(e) => setLine(l.key, { priority: e.target.value as Priority })}>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}</Select></Field>
                      <Field label="Phụ kiện kèm theo"><Input className="input-sm" value={l.accessories} onChange={(e) => setLine(l.key, { accessories: e.target.value })} placeholder="dây nguồn, hộp…" /></Field>
                      <Field label="Tình trạng khi tiếp nhận" className="sm:col-span-4"><Input className="input-sm" value={l.condition} onChange={(e) => setLine(l.key, { condition: e.target.value })} /></Field>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="self-start" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Bỏ thiết bị"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-3 text-sm"><span className="text-slate-500">Tổng tiền</span><span className="text-lg font-semibold tabular-nums">{money(total)} đ</span></div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Chọn thiết bị đã có của khách" size="lg"
        footer={<><Button variant="secondary" onClick={() => setPickOpen(false)}>Đóng</Button><Button disabled={!pickSel.size} onClick={addPicked}>Thêm {pickSel.size} thiết bị</Button></>}>
        {customerDevices.length === 0 ? <p className="text-sm text-slate-500">Khách chưa có thiết bị nào trong hồ sơ. Dùng "Thiết bị mới".</p> : (
          <table className="table">
            <thead><tr><th className="w-8"></th><th>Thiết bị</th><th>Sê-ri</th><th>Loại PTĐ</th><th>Hạn kế tiếp</th></tr></thead>
            <tbody>
              {customerDevices.map((d) => {
                const added = lines.some((l) => l.key === d.id);
                return (
                  <tr key={d.id} className={added ? "opacity-50" : "cursor-pointer"} onClick={() => !added && setPickSel((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}>
                    <td><input type="checkbox" className="h-4 w-4 accent-brand-700" disabled={added} checked={added || pickSel.has(d.id)} readOnly aria-label="Chọn" /></td>
                    <td><div className="font-medium">{d.name}</div><div className="text-xs text-slate-500">{[d.manufacturer, d.model].filter(Boolean).join(" ")}</div></td>
                    <td className="tabular-nums">{d.serial ?? "–"}</td><td>{types[d.instrument_type_id]?.name}</td>
                    <td>{d.next_due ? <>{fmtDate(d.next_due)} <Badge tone={dueTone(d.next_due)}>{dueText(d.next_due)}</Badge></> : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Modal>
      <Modal open={!!newDev} onClose={() => setNewDev(null)} title="Thiết bị mới của khách" size="lg"
        footer={<><Button variant="secondary" onClick={() => setNewDev(null)}>Huỷ</Button><Button onClick={addNewDevice}>Thêm vào đơn</Button></>}>
        {newDev && <DeviceFields f={newDev} set={(p) => setNewDev((x) => x && { ...x, ...p })} />}
      </Modal>
    </>
  );
}
