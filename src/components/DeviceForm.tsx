// Biểu mẫu thiết bị của khách – dùng ở hồ sơ khách và phiếu tiếp nhận
import { useTable } from "@/app/data";
import { Field, Input, SearchSelect, Textarea } from "@/components/ui";
import type { Device } from "@/lib/types";

export type DeviceForm = Omit<Device, "id" | "customer_id" | "created_at" | "last_cert_id" | "last_result" | "status">;
export const emptyDevice = (): DeviceForm => ({
  instrument_type_id: "", name: "", manufacturer: "", model: "", serial: "", range_text: "", resolution_text: "", accuracy_class: "", location: "", customer_code: "", next_due: null, note: "",
});

/** Chuẩn hoá chuỗi rỗng thành null trước khi lưu */
export const cleanDevice = (f: DeviceForm): DeviceForm => ({
  ...f, name: f.name.trim(), manufacturer: f.manufacturer || null, model: f.model || null, serial: f.serial || null, range_text: f.range_text || null,
  resolution_text: f.resolution_text || null, accuracy_class: f.accuracy_class || null, location: f.location || null, customer_code: f.customer_code || null, next_due: f.next_due || null, note: f.note || null,
});

export function DeviceFields({ f, set, compact }: { f: DeviceForm; set: (p: Partial<DeviceForm>) => void; compact?: boolean }) {
  const { rows: types } = useTable("instrument_types", { where: { active: true } });
  const pickType = (id: string | null) => {
    const t = types.find((x) => x.id === id);
    set({ instrument_type_id: id ?? "", ...(t && !f.name ? { name: t.name } : {}) });
  };
  return (
    <div className={compact ? "grid gap-2 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
      <Field label="Loại phương tiện đo *" className={compact ? "" : "sm:col-span-2"}>
        <SearchSelect items={types} value={f.instrument_type_id || null} onChange={pickType} getLabel={(t) => t.name} getSub={(t) => `${t.code} · chu kỳ ${t.cycle_months} tháng`} allowClear={false} />
      </Field>
      <Field label="Tên thiết bị *"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      <Field label="Số sê-ri"><Input value={f.serial ?? ""} onChange={(e) => set({ serial: e.target.value })} /></Field>
      <Field label="Hãng sản xuất"><Input value={f.manufacturer ?? ""} onChange={(e) => set({ manufacturer: e.target.value })} /></Field>
      <Field label="Kiểu (model)"><Input value={f.model ?? ""} onChange={(e) => set({ model: e.target.value })} /></Field>
      <Field label="Phạm vi đo"><Input value={f.range_text ?? ""} onChange={(e) => set({ range_text: e.target.value })} placeholder="vd 0 – 220 g" /></Field>
      <Field label="Độ phân giải / giá trị độ chia"><Input value={f.resolution_text ?? ""} onChange={(e) => set({ resolution_text: e.target.value })} placeholder="vd d = 0,1 mg; e = 1 mg" /></Field>
      <Field label="Cấp chính xác"><Input value={f.accuracy_class ?? ""} onChange={(e) => set({ accuracy_class: e.target.value })} /></Field>
      <Field label="Vị trí đặt"><Input value={f.location ?? ""} onChange={(e) => set({ location: e.target.value })} /></Field>
      <Field label="Mã nội bộ của khách"><Input value={f.customer_code ?? ""} onChange={(e) => set({ customer_code: e.target.value })} /></Field>
      <Field label="Hạn kiểm định kế tiếp" hint={compact ? undefined : "Chỉ nhập nếu thiết bị đã có GCN cũ"}><Input type="date" value={f.next_due ?? ""} onChange={(e) => set({ next_due: e.target.value || null })} /></Field>
      {!compact && <Field label="Ghi chú" className="sm:col-span-2"><Textarea rows={2} value={f.note ?? ""} onChange={(e) => set({ note: e.target.value })} /></Field>}
    </div>
  );
}
