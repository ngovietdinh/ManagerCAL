import clsx from "clsx";
import { Columns3, Table2, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Checkbox, Empty, Field, Input, Loading, Modal, PageHeader, SearchSelect, Select, useUi } from "@/components/ui";
import { fmtDate, todayStr } from "@/lib/format";
import { JOB_STATUSES, JOB_STATUS_LABEL, JOB_STATUS_TONE, PRIORITY_LABEL, RESULT_LABEL } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";
import type { Job, JobStatus, Priority, User } from "@/lib/types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
const OPEN_STATUSES: JobStatus[] = ["received", "assigned", "in_progress", "review", "approval", "issued"];

export default function Jobs() {
  const { me, can, svc } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { rows: jobs, loading } = useTable("jobs", { orderBy: { field: "created_at", dir: "desc" } });
  const customers = useIndex("customers");
  const devices = useIndex("devices");
  const types = useIndex("instrument_types");
  const fields = useIndex("fields");
  const users = useIndex("users");
  const orders = useIndex("orders");
  const certs = useIndex("certificates");
  const { rows: auths } = useTable("authorizations");

  const [view, setView] = useState<"table" | "kanban">("table");
  const status = (params.get("status") ?? "") as JobStatus | "";
  const orderId = params.get("order") ?? "";
  const [field, setField] = useState("");
  const [tech, setTech] = useState("");
  const [mine, setMine] = useState(params.get("mine") === "1");
  const overdue = params.get("overdue") === "1";
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const filtered = useMemo(() => {
    const k = norm(q.trim());
    return jobs.filter((j) => {
      if (status && j.status !== status) return false;
      if (orderId && j.order_id !== orderId) return false;
      if (overdue && !(j.due_date && j.due_date < todayStr() && !["issued", "returned", "cancelled"].includes(j.status))) return false;
      if (field && types[j.instrument_type_id]?.field_id !== field) return false;
      if (tech && j.assignee_id !== tech) return false;
      if (mine && me && j.assignee_id !== me.id && j.reviewer_id !== me.id) return false;
      if (k) {
        const d = devices[j.device_id];
        const hay = norm([j.code, customers[j.customer_id]?.name, d?.name, d?.serial, d?.model, types[j.instrument_type_id]?.name].filter(Boolean).join(" "));
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [jobs, status, orderId, overdue, field, tech, mine, q, me, types, devices, customers]);

  const today = todayStr();
  const technicians = useMemo(() => Object.values(users).filter((u) => u.active && auths.some((a) => a.user_id === u.id && a.role === "perform")), [users, auths]);

  // phân công hàng loạt: chỉ phiếu chờ phân công, cùng lĩnh vực
  const selectable = filtered.filter((j) => j.status === "received");
  const selectedJobs = selectable.filter((j) => selected.has(j.id));
  const selectedFields = new Set(selectedJobs.map((j) => types[j.instrument_type_id]?.field_id));
  const bulkField = selectedFields.size === 1 ? [...selectedFields][0] : null;

  const renderDue = (j: Job) => {
    if (!j.due_date) return <span className="text-slate-400">–</span>;
    const late = j.due_date < today && !["issued", "returned", "cancelled"].includes(j.status);
    return <span className={clsx("tabular-nums", late && "font-semibold text-red-700 dark:text-red-400")}>{fmtDate(j.due_date)}</span>;
  };

  const counts = useMemo(() => {
    const c: Partial<Record<JobStatus, number>> = {};
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);

  return (
    <>
      <PageHeader
        title="Phiếu công việc"
        subtitle={orderId && orders[orderId] ? <>Đơn <Link className="link" to={`/orders/${orderId}`}>{orders[orderId].code}</Link> · {filtered.length} phiếu</> : `${filtered.length} / ${jobs.length} phiếu`}
        actions={<>
          {can("assign") && selectedJobs.length > 0 && (
            <Button icon={<UserCheck className="h-4 w-4" />} onClick={() => setBulkOpen(true)} disabled={!bulkField}
              title={bulkField ? "" : "Các phiếu đã chọn phải cùng lĩnh vực đo"}>
              Phân công {selectedJobs.length} phiếu
            </Button>
          )}
          <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {([["table", Table2, "Bảng"], ["kanban", Columns3, "Kanban"]] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-label={label} title={label}
                className={clsx("flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium", view === v ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200" : "text-slate-600 dark:text-slate-300")}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </>}
      />

      <div className="mb-4 grid gap-2 md:grid-cols-6">
        <Input placeholder="Tìm mã phiếu, khách, thiết bị, sê-ri…" value={q} onChange={(e) => setQ(e.target.value)} className="md:col-span-2" />
        <Select value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {JOB_STATUSES.map((s) => <option key={s} value={s}>{JOB_STATUS_LABEL[s]}{counts[s] ? ` (${counts[s]})` : ""}</option>)}
        </Select>
        <Select value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">Mọi lĩnh vực</option>
          {Object.values(fields).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Select>
        <Select value={tech} onChange={(e) => setTech(e.target.value)}>
          <option value="">Mọi kiểm định viên</option>
          {technicians.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </Select>
        <div className="flex items-center gap-3">
          <Checkbox checked={mine} onChange={setMine} label="Việc của tôi" />
          {orderId && <Button size="sm" variant="ghost" onClick={() => setParam("order", "")}>Bỏ lọc đơn</Button>}
        </div>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Empty text="Không có phiếu nào khớp bộ lọc" action={can("orders") ? <Link to="/orders/new"><Button size="sm" variant="secondary">Lập đơn tiếp nhận</Button></Link> : undefined} />
      ) : view === "table" ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {can("assign") && <th className="w-8">
                  <input type="checkbox" className="h-4 w-4 accent-brand-700" aria-label="Chọn tất cả phiếu chờ phân công"
                    checked={selectable.length > 0 && selectable.every((j) => selected.has(j.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(selectable.map((j) => j.id)) : new Set())} />
                </th>}
                <th>Mã phiếu</th><th>Khách hàng</th><th>Thiết bị</th><th className="hidden 2xl:table-cell">Loại PTĐ</th><th>KĐV</th><th>Hẹn trả</th><th>Trạng thái</th><th>Kết luận</th><th>GCN</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => {
                const d = devices[j.device_id];
                const cert = j.certificate_id ? certs[j.certificate_id] : null;
                return (
                  <tr key={j.id} className="cursor-pointer" onClick={() => nav(`/jobs/${j.id}`)}>
                    {can("assign") && <td onClick={(e) => e.stopPropagation()}>
                      {j.status === "received" && (
                        <input type="checkbox" className="h-4 w-4 accent-brand-700" aria-label={`Chọn ${j.code}`} checked={selected.has(j.id)}
                          onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(j.id); else n.delete(j.id); return n; })} />
                      )}
                    </td>}
                    <td className="whitespace-nowrap font-medium">
                      <Link className="link" to={`/jobs/${j.id}`} onClick={(e) => e.stopPropagation()}>{j.code}</Link>
                      {j.priority === "urgent" && <Badge tone="red" className="ml-1.5">{PRIORITY_LABEL.urgent}</Badge>}
                    </td>
                    <td className="max-w-56 truncate">{customers[j.customer_id]?.name ?? "–"}</td>
                    <td className="min-w-48">
                      <div className="font-medium">{d?.name ?? "–"}</div>
                      <div className="text-xs text-slate-500">{[d?.model, d?.serial].filter(Boolean).join(" · ") || "–"}</div>
                    </td>
                    <td className="hidden 2xl:table-cell">{types[j.instrument_type_id]?.name ?? "–"}</td>
                    <td className="whitespace-nowrap">{j.assignee_id ? users[j.assignee_id]?.full_name : <span className="text-slate-400">–</span>}</td>
                    <td className="whitespace-nowrap">{renderDue(j)}</td>
                    <td><Badge tone={JOB_STATUS_TONE[j.status]}>{JOB_STATUS_LABEL[j.status]}</Badge></td>
                    <td>{j.conclusion ? <Badge tone={j.conclusion === "pass" ? "green" : "red"}>{RESULT_LABEL[j.conclusion]}</Badge> : <span className="text-slate-400">–</span>}</td>
                    <td className="whitespace-nowrap">{cert ? <Link className="link" to={`/certificates/${cert.id}`} onClick={(e) => e.stopPropagation()}>{cert.number}</Link> : <span className="text-slate-400">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {OPEN_STATUSES.map((s) => {
            const col = filtered.filter((j) => j.status === s);
            return (
              <div key={s} className="w-64 shrink-0 rounded-2xl bg-slate-100 p-2 dark:bg-slate-800/60">
                <div className="mb-2 flex items-center justify-between px-1">
                  <Badge tone={JOB_STATUS_TONE[s]}>{JOB_STATUS_LABEL[s]}</Badge>
                  <span className="text-xs font-semibold text-slate-500">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400 dark:border-slate-700">Trống</div>}
                  {col.map((j) => {
                    const d = devices[j.device_id];
                    return (
                      <Link key={j.id} to={`/jobs/${j.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{j.code}</span>
                          {j.priority === "urgent" && <Badge tone="red">Gấp</Badge>}
                        </div>
                        <div className="mt-1 truncate font-medium">{d?.name ?? "–"} <span className="text-xs font-normal text-slate-500">{d?.serial}</span></div>
                        <div className="truncate text-xs text-slate-500">{customers[j.customer_id]?.name}</div>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <span className="truncate text-slate-600 dark:text-slate-300">{j.assignee_id ? users[j.assignee_id]?.full_name : "Chưa phân công"}</span>
                          {renderDue(j)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bulkOpen && bulkField && (
        <BulkAssignModal
          jobs={selectedJobs} fieldId={bulkField} fieldName={fields[bulkField]?.name ?? ""}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); setSelected(new Set()); }}
          technicians={technicians} auths={auths} users={users} svc={svc} ui={ui}
        />
      )}
    </>
  );
}

function BulkAssignModal({ jobs, fieldId, fieldName, onClose, onDone, auths, users, svc, ui }: {
  jobs: Job[]; fieldId: string; fieldName: string; onClose: () => void; onDone: () => void;
  technicians: User[]; auths: { user_id: string; field_id: string; role: string; valid_from: string; valid_to: string | null }[];
  users: Record<string, User>; svc: ReturnType<typeof useData>["svc"]; ui: ReturnType<typeof useUi>;
}) {
  const today = todayStr();
  const ok = (uid: string, role: string) => auths.some((a) => a.user_id === uid && a.field_id === fieldId && a.role === role && a.valid_from <= today && (!a.valid_to || a.valid_to >= today));
  const performers = Object.values(users).filter((u) => u.active && ok(u.id, "perform"));
  const [assignee, setAssignee] = useState<string | null>(performers[0]?.id ?? null);
  const reviewers = Object.values(users).filter((u) => u.active && u.id !== assignee && ok(u.id, "review"));
  const [reviewer, setReviewer] = useState<string | null>(null);
  const [due, setDue] = useState(jobs[0]?.due_date ?? "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const run = async () => {
    if (!assignee) return;
    setBusy(true);
    const errs: string[] = [];
    let okCount = 0;
    for (const j of jobs) {
      try { await svc.assignJob(j.id, { assignee_id: assignee, reviewer_id: reviewer, due_date: due || null, priority }); okCount++; }
      catch (e) { errs.push(`${j.code}: ${errorMessage(e)}`); }
    }
    setBusy(false);
    if (okCount) ui.toast(`Đã phân công ${okCount} phiếu`);
    if (errs.length) setErrors(errs); else onDone();
  };

  return (
    <Modal open onClose={onClose} title={`Phân công ${jobs.length} phiếu – ${fieldName}`}
      footer={<><Button variant="secondary" onClick={onClose}>Đóng</Button><Button loading={busy} disabled={!assignee} onClick={run}>Phân công</Button></>}>
      <div className="space-y-3">
        <div className="text-xs text-slate-500">{jobs.map((j) => j.code).join(", ")}</div>
        <Field label="Kiểm định viên (có ủy quyền thực hiện lĩnh vực này)">
          {performers.length === 0 ? <p className="text-sm text-red-700">Chưa có ai được ủy quyền thực hiện lĩnh vực {fieldName}.</p> : (
            <SearchSelect items={performers} value={assignee} onChange={setAssignee} getLabel={(u) => u.full_name} getSub={(u) => u.inspector_card_expiry && u.inspector_card_expiry < today ? "Thẻ KĐV đã hết hạn" : u.title ?? ""} allowClear={false} />
          )}
        </Field>
        <Field label="Người soát xét (tuỳ chọn)">
          <SearchSelect items={reviewers} value={reviewer} onChange={setReviewer} getLabel={(u) => u.full_name} getSub={(u) => u.title ?? ""} placeholder="Để trống: ai có ủy quyền soát xét đều được" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hẹn trả"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Ưu tiên">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </Select>
          </Field>
        </div>
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <div className="mb-1 font-medium">Không phân công được:</div>
            <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
