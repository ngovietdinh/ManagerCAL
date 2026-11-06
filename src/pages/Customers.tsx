import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData, useTable } from "@/app/data";
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, PageHeader, SearchSelect, Textarea, useUi } from "@/components/ui";
import { matches } from "@/components/aHelpers";
import { dayjs } from "@/lib/format";
import type { Customer } from "@/lib/types";

export type CustomerForm = Omit<Customer, "id" | "created_at" | "code" | "active">;
export const emptyCustomer = (): CustomerForm => ({ name: "", tax_code: "", address: "", phone: "", email: "", contact_name: "", contact_phone: "", sales_user_id: null, note: "" });

/** Biểu mẫu khách hàng dùng cho thêm mới và sửa */
export function CustomerFields({ f, set }: { f: CustomerForm; set: (p: Partial<CustomerForm>) => void }) {
  const { users } = useData();
  const sales = users.filter((u) => u.active && u.roles.includes("sales"));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tên khách hàng *" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus /></Field>
      <Field label="Mã số thuế"><Input value={f.tax_code ?? ""} onChange={(e) => set({ tax_code: e.target.value })} /></Field>
      <Field label="Điện thoại"><Input value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} /></Field>
      <Field label="Địa chỉ" className="sm:col-span-2"><Input value={f.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={f.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></Field>
      <Field label="Nhân viên kinh doanh"><SearchSelect items={sales} value={f.sales_user_id} onChange={(id) => set({ sales_user_id: id })} getLabel={(u) => u.full_name} getSub={(u) => u.title ?? ""} /></Field>
      <Field label="Người liên hệ"><Input value={f.contact_name ?? ""} onChange={(e) => set({ contact_name: e.target.value })} /></Field>
      <Field label="SĐT liên hệ"><Input value={f.contact_phone ?? ""} onChange={(e) => set({ contact_phone: e.target.value })} /></Field>
      <Field label="Ghi chú" className="sm:col-span-2"><Textarea value={f.note ?? ""} onChange={(e) => set({ note: e.target.value })} rows={2} /></Field>
    </div>
  );
}

export default function Customers() {
  const { svc, can, users } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const { rows: customers, loading } = useTable("customers", { orderBy: { field: "code" } });
  const { rows: devices } = useTable("devices", { where: { status: "active" } });
  const [q, setQ] = useState("");
  const [onlyDue, setOnlyDue] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<CustomerForm>(emptyCustomer());
  const [saving, setSaving] = useState(false);

  const in30 = dayjs().add(30, "day").format("YYYY-MM-DD");
  const perCustomer = useMemo(() => {
    const m: Record<string, { total: number; due: number }> = {};
    for (const d of devices) {
      const c = (m[d.customer_id] ??= { total: 0, due: 0 });
      c.total++;
      if (d.next_due && d.next_due <= in30) c.due++;
    }
    return m;
  }, [devices, in30]);

  const list = customers.filter((c) => matches(q, c.code, c.name, c.tax_code, c.contact_name, c.phone, c.address) && (!onlyDue || (perCustomer[c.id]?.due ?? 0) > 0));

  const save = async () => {
    if (!f.name.trim()) { ui.toast("Cần nhập tên khách hàng", "error"); return; }
    setSaving(true);
    try {
      const c = await svc.createCustomer({ ...f, name: f.name.trim(), tax_code: f.tax_code || null, address: f.address || null, phone: f.phone || null, email: f.email || null, contact_name: f.contact_name || null, contact_phone: f.contact_phone || null, note: f.note || null, active: true });
      ui.toast(`Đã thêm khách hàng ${c.code}`);
      setOpen(false);
      setF(emptyCustomer());
      nav(`/customers/${c.id}`);
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Khách hàng" subtitle={`${customers.length} khách hàng · ${devices.length} thiết bị đang theo dõi`}
        actions={can("customers") && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Thêm khách hàng</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input placeholder="Tìm theo tên, mã, MST, người liên hệ…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Checkbox checked={onlyDue} onChange={setOnlyDue} label="Chỉ khách có thiết bị đến hạn trong 30 ngày" />
      </div>
      <Card bodyClass="p-0">
        {loading ? null : list.length === 0 ? <Empty text={q || onlyDue ? "Không có khách hàng nào khớp bộ lọc." : "Chưa có khách hàng — bấm Thêm khách hàng để bắt đầu."} /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Mã</th><th>Tên khách hàng</th><th>MST</th><th>Liên hệ</th><th>Điện thoại</th><th className="num">Thiết bị</th><th className="num">Đến hạn 30 ngày</th><th>NV kinh doanh</th></tr></thead>
              <tbody>
                {list.map((c) => {
                  const s = perCustomer[c.id] ?? { total: 0, due: 0 };
                  return (
                    <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/customers/${c.id}`)}>
                      <td className="font-medium">{c.code}</td>
                      <td><div className="font-medium">{c.name}</div><div className="max-w-72 truncate text-xs text-slate-500">{c.address}</div></td>
                      <td className="tabular-nums">{c.tax_code ?? "–"}</td>
                      <td>{c.contact_name ?? "–"}</td>
                      <td className="tabular-nums">{c.contact_phone ?? c.phone ?? "–"}</td>
                      <td className="num">{s.total}</td>
                      <td className="num">{s.due > 0 ? <Badge tone="amber">{s.due}</Badge> : <span className="text-slate-400">0</span>}</td>
                      <td>{users.find((u) => u.id === c.sales_user_id)?.full_name ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Thêm khách hàng" size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Huỷ</Button><Button loading={saving} onClick={save}>Lưu</Button></>}>
        <CustomerFields f={f} set={(p) => setF((x) => ({ ...x, ...p }))} />
      </Modal>
    </>
  );
}
