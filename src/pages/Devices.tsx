import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, Input, Modal, Select, Tabs, useUi } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { dueText, dueTone, matches } from "@/components/aHelpers";
import { exportXlsx, readXlsx } from "@/lib/excel";
import { dayjs, fmtDate, todayStr } from "@/lib/format";
import { RESULT_LABEL } from "@/lib/labels";

type DueFilter = "all" | "overdue" | "7" | "30" | "90";
const COLS = ["Khách hàng (mã)", "Loại PTĐ (mã)", "Tên thiết bị", "Hãng", "Kiểu", "Số sê-ri", "Phạm vi", "Độ phân giải", "Cấp chính xác", "Vị trí", "Mã của khách", "Hạn kế tiếp (YYYY-MM-DD)"] as const;

interface ImportRow { raw: Record<string, string>; errors: string[]; customer_id?: string; type_id?: string }

export default function Devices() {
  const { svc, can } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { rows: devices, loading } = useTable("devices", { orderBy: { field: "next_due" } });
  const { rows: customers } = useTable("customers");
  const { rows: types } = useTable("instrument_types");
  const customerById = useIndex("customers");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [due, setDue] = useState<DueFilter>(params.get("due") ? "30" : "all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [imp, setImp] = useState<ImportRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayStr();

  const list = useMemo(() => {
    const limit = due === "all" || due === "overdue" ? null : dayjs().add(Number(due), "day").format("YYYY-MM-DD");
    return devices.filter((d) => {
      if (d.status !== "active" && due !== "all") return false;
      if (type && d.instrument_type_id !== type) return false;
      if (due === "overdue" && !(d.next_due && d.next_due < today)) return false;
      if (limit && !(d.next_due && d.next_due <= limit)) return false;
      const c = customerById[d.customer_id];
      return matches(q, d.name, d.serial, d.manufacturer, d.model, d.customer_code, d.location, c?.name, c?.code);
    });
  }, [devices, q, type, due, today, customerById]);

  const selected = devices.filter((d) => sel.has(d.id));
  const selCustomer = selected.length ? selected[0].customer_id : null;
  const sameCustomer = selected.every((d) => d.customer_id === selCustomer);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exportList = () => exportXlsx(`thiet-bi-${today}`, [{
    name: "Thiết bị", title: "Danh sách thiết bị của khách",
    columns: [{ header: "Khách hàng", key: "customer", width: 36 }, { header: "Thiết bị", key: "name", width: 26 }, { header: "Loại PTĐ", key: "type", width: 22 }, { header: "Hãng / kiểu", key: "mm", width: 22 },
      { header: "Số sê-ri", key: "serial", width: 16 }, { header: "Vị trí", key: "location", width: 22 }, { header: "Kết quả gần nhất", key: "result", width: 14 }, { header: "Hạn kế tiếp", key: "due", width: 14 }],
    rows: list.map((d) => ({ customer: customerById[d.customer_id]?.name, name: d.name, type: types.find((t) => t.id === d.instrument_type_id)?.name, mm: [d.manufacturer, d.model].filter(Boolean).join(" "), serial: d.serial, location: d.location, result: d.last_result ? RESULT_LABEL[d.last_result] : "", due: d.next_due ? fmtDate(d.next_due) : "" })),
  }]);

  const downloadTemplate = () => exportXlsx("mau-nhap-thiet-bi", [{
    name: "Thiết bị", columns: COLS.map((c) => ({ header: c, key: c, width: 20 })),
    rows: [
      { [COLS[0]]: customers[0]?.code ?? "KH-0001", [COLS[1]]: "CAN-PT", [COLS[2]]: "Cân phân tích", [COLS[3]]: "Sartorius", [COLS[4]]: "BSA224S", [COLS[5]]: "0034512187", [COLS[6]]: "0 – 220 g", [COLS[7]]: "d = 0,1 mg; e = 1 mg", [COLS[8]]: "I", [COLS[9]]: "Phòng QC", [COLS[10]]: "QC-CAN-01", [COLS[11]]: "2027-03-31" },
      { [COLS[0]]: customers[0]?.code ?? "KH-0001", [COLS[1]]: "AP-KE", [COLS[2]]: "Áp kế lò xo", [COLS[3]]: "Wika", [COLS[4]]: "233.50", [COLS[5]]: "AK-2023-114", [COLS[6]]: "0 – 10 bar", [COLS[7]]: "", [COLS[8]]: "1,6", [COLS[9]]: "Nồi hơi số 1", [COLS[10]]: "", [COLS[11]]: "" },
    ],
  }]);

  const onFile = async (file: File) => {
    try {
      const rows = await readXlsx(file);
      if (!rows.length) { ui.toast("Tệp không có dòng dữ liệu nào", "error"); return; }
      setImp(rows.map((raw) => {
        const errors: string[] = [];
        const c = customers.find((x) => x.code.toLowerCase() === (raw[COLS[0]] ?? "").trim().toLowerCase());
        const t = types.find((x) => x.code.toLowerCase() === (raw[COLS[1]] ?? "").trim().toLowerCase());
        if (!c) errors.push(`Không tìm thấy khách "${raw[COLS[0]] ?? ""}"`);
        if (!t) errors.push(`Không tìm thấy loại PTĐ "${raw[COLS[1]] ?? ""}"`);
        if (!(raw[COLS[2]] ?? "").trim()) errors.push("Thiếu tên thiết bị");
        const d = (raw[COLS[11]] ?? "").trim();
        if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push("Hạn kế tiếp phải dạng YYYY-MM-DD");
        return { raw, errors, customer_id: c?.id, type_id: t?.id };
      }));
    } catch (e) { ui.error(e); }
  };

  const doImport = async () => {
    if (!imp) return;
    const ok = imp.filter((r) => r.errors.length === 0);
    setImporting(true);
    try {
      for (const r of ok) {
        const v = (k: (typeof COLS)[number]) => (r.raw[k] ?? "").trim() || null;
        await svc.createDevice({ customer_id: r.customer_id!, instrument_type_id: r.type_id!, name: v(COLS[2])!, manufacturer: v(COLS[3]), model: v(COLS[4]), serial: v(COLS[5]), range_text: v(COLS[6]), resolution_text: v(COLS[7]), accuracy_class: v(COLS[8]), location: v(COLS[9]), customer_code: v(COLS[10]), next_due: v(COLS[11]), note: null });
      }
      ui.toast(`Đã nhập ${ok.length} thiết bị`);
      setImp(null);
    } catch (e) { ui.error(e); } finally { setImporting(false); }
  };

  const countDue = (f: DueFilter) => devices.filter((d) => d.status === "active" && d.next_due && (f === "overdue" ? d.next_due < today : d.next_due <= dayjs().add(Number(f), "day").format("YYYY-MM-DD"))).length;

  return (
    <>
      <PageHeader title="Thiết bị của khách" subtitle={`${devices.filter((d) => d.status === "active").length} thiết bị đang theo dõi · ${countDue("overdue")} quá hạn`}
        actions={<>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportList}>Xuất Excel</Button>
          {can("customers") && <>
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={downloadTemplate}>Tải mẫu Excel</Button>
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Nhập từ Excel</Button>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </>}
        </>} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input placeholder="Tìm thiết bị, sê-ri, khách hàng…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-56">
          <option value="">Mọi loại PTĐ</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Tabs value={due} onChange={setDue} items={[
          { value: "all", label: "Tất cả" }, { value: "overdue", label: "Quá hạn", count: countDue("overdue") }, { value: "7", label: "7 ngày", count: countDue("7") }, { value: "30", label: "30 ngày", count: countDue("30") }, { value: "90", label: "90 ngày", count: countDue("90") },
        ]} />
      </div>
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm dark:border-brand-800 dark:bg-brand-900/20">
          <span>Đã chọn {sel.size} thiết bị{!sameCustomer && <span className="text-red-700"> – phải cùng một khách hàng mới tạo được đơn</span>}</span>
          {can("orders") && sameCustomer && <Button size="sm" onClick={() => nav(`/orders/new?customer=${selCustomer}&device=${[...sel].join(",")}`)}>Tạo đơn cho {sel.size} thiết bị</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Bỏ chọn</Button>
        </div>
      )}
      <Card bodyClass="p-0">
        {loading ? null : list.length === 0 ? <Empty text="Không có thiết bị nào khớp bộ lọc." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th className="w-8"></th><th>Khách hàng</th><th>Thiết bị</th><th>Loại PTĐ</th><th>Số sê-ri</th><th>Hạn kế tiếp</th><th>Kết quả gần nhất</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={sel.has(d.id)} onChange={() => toggle(d.id)} aria-label="Chọn" /></td>
                    <td className="max-w-56 truncate"><Link className="link" to={`/customers/${d.customer_id}`}>{customerById[d.customer_id]?.name ?? "–"}</Link></td>
                    <td><div className="font-medium">{d.name}</div><div className="text-xs text-slate-500">{[d.manufacturer, d.model].filter(Boolean).join(" ")}{d.location ? ` · ${d.location}` : ""}</div></td>
                    <td>{types.find((t) => t.id === d.instrument_type_id)?.name ?? "–"}</td>
                    <td className="tabular-nums">{d.serial ?? "–"}</td>
                    <td>{d.next_due ? <><div>{fmtDate(d.next_due)}</div><Badge tone={dueTone(d.next_due)}>{dueText(d.next_due)}</Badge></> : <span className="text-slate-400">–</span>}</td>
                    <td>{d.last_result ? <Badge tone={d.last_result === "pass" ? "green" : "red"}>{RESULT_LABEL[d.last_result]}</Badge> : "–"}</td>
                    <td><Badge tone={d.status === "active" ? "green" : "gray"}>{d.status === "active" ? "Đang dùng" : "Ngừng"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!imp} onClose={() => setImp(null)} title="Xem trước dữ liệu nhập" size="xl"
        footer={<><Button variant="secondary" onClick={() => setImp(null)}>Huỷ</Button><Button loading={importing} disabled={!imp?.some((r) => !r.errors.length)} onClick={doImport}>Nhập {imp?.filter((r) => !r.errors.length).length ?? 0} dòng hợp lệ</Button></>}>
        {imp && (
          <>
            <p className="mb-2 text-sm text-slate-600">{imp.length} dòng, {imp.filter((r) => r.errors.length).length} dòng lỗi (sẽ bỏ qua).</p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>#</th><th>Khách</th><th>Loại PTĐ</th><th>Tên</th><th>Sê-ri</th><th>Hạn</th><th>Lỗi</th></tr></thead>
                <tbody>
                  {imp.map((r, i) => (
                    <tr key={i} className={r.errors.length ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <td>{i + 1}</td><td>{r.raw[COLS[0]]}</td><td>{r.raw[COLS[1]]}</td><td>{r.raw[COLS[2]]}</td><td>{r.raw[COLS[5]]}</td><td>{r.raw[COLS[11]]}</td>
                      <td className="text-xs text-red-700">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
