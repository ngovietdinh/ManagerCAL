import clsx from "clsx";
import { AlertTriangle, Award, Ban, CheckCircle2, FileSignature, PackageCheck, Save, Send, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData, useIndex, useRow, useTable } from "@/app/data";
import { JobRecordEditor, JobResultView, buildReadings, textsFromReadings, type RawTexts } from "@/components/JobRecord";
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Loading, Modal, PageHeader, SearchSelect, Select, Textarea, useUi } from "@/components/ui";
import { checkEnv, evaluate } from "@/lib/calc";
import { fmtDate, fmtDateTime, todayStr } from "@/lib/format";
import { CERT_KIND_LABEL, CERT_STATUS_LABEL, CERT_STATUS_TONE, JOB_KIND_LABEL, JOB_STATUS_LABEL, JOB_STATUS_TONE, PRIORITY_LABEL, RESULT_LABEL } from "@/lib/labels";
import type { Job, Priority, Seal, Standard, User } from "@/lib/types";

export default function JobDetail() {
  const { id } = useParams();
  const { me, can, svc } = useData();
  const ui = useUi();
  const { row: job, loading } = useRow("jobs", id);
  const users = useIndex("users");
  const customers = useIndex("customers");
  const devices = useIndex("devices");
  const types = useIndex("instrument_types");
  const fields = useIndex("fields");
  const orders = useIndex("orders");
  const procedures = useIndex("procedures");
  const branches = useIndex("branches");
  const { row: cert } = useRow("certificates", job?.certificate_id);
  const [modal, setModal] = useState<"assign" | "issue" | "return" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!job) return <Empty text="Không tìm thấy phiếu" />;

  const device = devices[job.device_id];
  const customer = customers[job.customer_id];
  const order = orders[job.order_id];
  const type = types[job.instrument_type_id];
  const field = type ? fields[type.field_id] : null;
  const procedure = job.procedure_id ? procedures[job.procedure_id] : null;
  const isAssignee = me?.id === job.assignee_id;
  const canEditRecord = ["assigned", "in_progress"].includes(job.status) && (isAssignee || can("assign"));
  const canReview = job.status === "review" && can("review") && !isAssignee;
  const late = job.due_date && job.due_date < todayStr() && !["issued", "returned", "cancelled"].includes(job.status);

  const doReturnDevice = async () => {
    if (!(await ui.confirm({ title: "Trả thiết bị cho khách?", message: `Ghi nhận đã bàn giao ${device?.name ?? "thiết bị"} cho ${customer?.name ?? "khách"} hôm nay.`, confirmText: "Đã trả" }))) return;
    setBusy(true);
    try { await svc.returnDevice(job.id, todayStr()); ui.toast("Đã ghi nhận trả thiết bị"); } catch (e) { ui.error(e); } finally { setBusy(false); }
  };

  const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-2 py-1 text-sm"><span className="w-32 shrink-0 text-slate-500">{label}</span><span className="min-w-0 flex-1">{children}</span></div>
  );

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">Phiếu {job.code} <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
          {job.priority === "urgent" && <Badge tone="red">{PRIORITY_LABEL.urgent}</Badge>}
          {job.conclusion && <Badge tone={job.conclusion === "pass" ? "green" : "red"}>{RESULT_LABEL[job.conclusion]}</Badge>}</span>}
        subtitle={<>{type?.name ?? "–"} · {field?.name ?? "–"} · {JOB_KIND_LABEL[job.kind]}{late && <span className="ml-2 font-semibold text-red-700 dark:text-red-400">Quá hạn trả {fmtDate(job.due_date)}</span>}</>}
        actions={<>
          {can("assign") && ["received", "assigned", "in_progress"].includes(job.status) && <Button variant="secondary" icon={<UserCheck className="h-4 w-4" />} onClick={() => setModal("assign")}>{job.assignee_id ? "Phân công lại" : "Phân công"}</Button>}
          {job.status === "approval" && can("sign") && <>
            <Button variant="secondary" onClick={() => setModal("return")}>Trả lại</Button>
            <Button icon={<FileSignature className="h-4 w-4" />} onClick={() => setModal("issue")}>Phê duyệt, phát hành</Button>
          </>}
          {job.status === "issued" && can("orders") && <Button icon={<PackageCheck className="h-4 w-4" />} loading={busy} onClick={doReturnDevice}>Trả thiết bị cho khách</Button>}
          {can("assign") && !["issued", "returned", "cancelled"].includes(job.status) && <Button variant="ghost" icon={<Ban className="h-4 w-4" />} onClick={() => setModal("cancel")}>Không thực hiện</Button>}
        </>}
      />

      {job.return_reason && ["in_progress", "assigned"].includes(job.status) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><span className="font-semibold">Bị trả lại:</span> {job.return_reason}</div>
        </div>
      )}
      {job.status === "cancelled" && job.cancel_reason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><span className="font-semibold">Không thực hiện:</span> {job.cancel_reason}</div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          <Card title="Thiết bị và khách hàng" bodyClass="px-4 py-2">
            <Info label="Thiết bị"><span className="font-medium">{device?.name ?? "–"}</span> {device?.manufacturer && <span className="text-slate-500">· {device.manufacturer} {device.model}</span>}</Info>
            <Info label="Số sê-ri">{device?.serial ?? "–"}{device?.customer_code && <span className="text-slate-500"> · mã khách {device.customer_code}</span>}</Info>
            <Info label="Phạm vi đo">{device?.range_text ?? "–"}{device?.resolution_text && ` · ${device.resolution_text}`}{device?.accuracy_class && ` · cấp ${device.accuracy_class}`}</Info>
            <Info label="Nơi đặt">{device?.location ?? "–"}</Info>
            <Info label="Khách hàng">{customer ? <Link className="link" to={`/customers/${customer.id}`}>{customer.name}</Link> : "–"}{customer?.address && <span className="block text-xs text-slate-500">{customer.address}</span>}</Info>
            <Info label="Đơn hàng">{order ? <><Link className="link" to={`/orders/${order.id}`}>{order.code}</Link> · nhận {fmtDate(order.received_at)} · {order.onsite ? "tại hiện trường" : "tại phòng thí nghiệm"}{job.branch_id && branches[job.branch_id] && ` · ${branches[job.branch_id].name}`}</> : "–"}</Info>
            <Info label="Tiếp nhận">{job.intake.condition || "–"}{job.intake.accessories && <span className="block text-xs text-slate-500">Phụ kiện: {job.intake.accessories}</span>}{job.intake.note && <span className="block text-xs text-slate-500">{job.intake.note}</span>}</Info>
            <Info label="Quy trình">{procedure ? <><span className="font-medium">{procedure.code}</span> · {procedure.name} (phiên bản {procedure.version})</> : <span className="font-semibold text-red-700 dark:text-red-400">Chưa gắn quy trình kiểm định – phân công lại và chọn quy trình</span>}</Info>
            <Info label="Phân công">
              KĐV: <span className="font-medium">{job.assignee_id ? users[job.assignee_id]?.full_name : "chưa có"}</span>
              {job.reviewer_id && <> · Soát xét: {users[job.reviewer_id]?.full_name}</>}
              {job.approver_id && <> · Ký: {users[job.approver_id]?.full_name}</>}
              {job.due_date && <> · Hẹn trả: <span className={clsx("tabular-nums", late && "font-semibold text-red-700 dark:text-red-400")}>{fmtDate(job.due_date)}</span></>}
            </Info>
          </Card>

          {cert && (
            <Card title={cert.kind === "certificate" ? "Giấy chứng nhận kiểm định" : "Thông báo kết quả kiểm định"} bodyClass="px-4 py-2"
              actions={<Link to={`/certificates/${cert.id}`}><Button size="sm" variant="secondary" icon={<Award className="h-4 w-4" />}>Xem, in</Button></Link>}>
              <Info label="Số"><span className="font-semibold">{cert.number}</span> <Badge tone={CERT_STATUS_TONE[cert.status]} className="ml-1">{CERT_STATUS_LABEL[cert.status]}</Badge></Info>
              <Info label="Loại">{CERT_KIND_LABEL[cert.kind]}</Info>
              <Info label="Ngày cấp">{fmtDate(cert.issued_at)}{cert.valid_to && <> · hiệu lực đến <span className="font-medium">{fmtDate(cert.valid_to)}</span></>}</Info>
              <Info label="Số tem">{cert.seal_no ? <span className="seal-no">{cert.seal_no}</span> : <span className="text-slate-500">không cấp tem</span>}</Info>
              <Info label="Người ký">{users[cert.signer_id]?.full_name ?? "–"}</Info>
            </Card>
          )}

          {canEditRecord ? (
            <RecordEditor job={job} />
          ) : job.result ? (
            <Card title="Biên bản kiểm định" actions={<span className="text-xs text-slate-500">{job.performed_at && `Thực hiện ${fmtDate(job.performed_at)}`}{job.assignee_id && ` · ${users[job.assignee_id]?.full_name}`}</span>}>
              <RecordSummary job={job} />
              <JobResultView result={job.result} template={procedure?.template} />
            </Card>
          ) : (
            <Card title="Biên bản kiểm định"><Empty text={job.status === "received" ? "Phiếu chưa được phân công" : "Chưa có số liệu"} /></Card>
          )}

          {canReview && <ReviewPanel job={job} />}
        </div>

        <div className="space-y-4">
          <Card title="Dòng thời gian" bodyClass="px-4 py-3">
            <ol className="space-y-3 text-sm">
              {[...job.history].reverse().map((h, i) => (
                <li key={i} className="relative pl-4 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-brand-400">
                  <div className="font-medium">{h.action}</div>
                  <div className="text-xs text-slate-500">{users[h.by]?.full_name ?? h.by} · {fmtDateTime(h.at)}</div>
                  {h.note && <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{h.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
          {job.review_note && job.reviewed_at && (
            <Card title="Ý kiến soát xét" bodyClass="px-4 py-3 text-sm"><div>{job.review_note}</div><div className="mt-1 text-xs text-slate-500">{job.reviewer_id && users[job.reviewer_id]?.full_name} · {fmtDateTime(job.reviewed_at)}</div></Card>
          )}
        </div>
      </div>

      {modal === "assign" && <AssignModal job={job} fieldId={type?.field_id ?? ""} onClose={() => setModal(null)} />}
      {modal === "issue" && <IssueModal job={job} onClose={() => setModal(null)} />}
      {modal === "return" && (
        <ReasonModal title="Trả lại phiếu" label="Lý do trả lại" confirmText="Trả lại" onClose={() => setModal(null)}
          onSubmit={async (r) => { await svc.returnFromApproval(job.id, r); ui.toast("Đã trả lại phiếu"); }} />
      )}
      {modal === "cancel" && (
        <ReasonModal title="Không thực hiện phiếu này" label="Lý do (thiết bị hỏng, ngoài năng lực, khách rút…)" confirmText="Xác nhận không thực hiện" danger onClose={() => setModal(null)}
          onSubmit={async (r) => { await svc.cancelJob(job.id, r); ui.toast("Đã đóng phiếu"); }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tóm tắt điều kiện đo (chỉ đọc)
// ---------------------------------------------------------------------------
function RecordSummary({ job }: { job: Job }) {
  const standards = useIndex("standards");
  return (
    <div className="mb-4 grid gap-2 text-sm md:grid-cols-2">
      <div><span className="text-slate-500">Môi trường:</span> {job.env.temp ?? "–"} °C · {job.env.humidity ?? "–"} %RH{job.env.pressure != null && ` · ${job.env.pressure} hPa`}</div>
      <div><span className="text-slate-500">Chuẩn:</span> {job.standard_ids.length ? job.standard_ids.map((s) => standards[s]?.code ?? s).join(", ") : "–"}</div>
      {job.performed_note && <div className="md:col-span-2"><span className="text-slate-500">Ghi chú:</span> {job.performed_note}</div>}
      <div className="md:col-span-2">
        <span className="text-slate-500">Kết luận:</span>{" "}
        {job.result?.complete ? <Badge tone={job.result.pass ? "green" : "red"}>{job.result.pass ? "Đạt" : "Không đạt"}</Badge> : <Badge tone="amber">Chưa đủ số liệu</Badge>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Biên bản đo – nhập liệu
// ---------------------------------------------------------------------------
function RecordEditor({ job }: { job: Job }) {
  const { svc } = useData();
  const ui = useUi();
  const types = useIndex("instrument_types");
  const procedures = useIndex("procedures");
  const { rows: standards } = useTable("standards", { orderBy: { field: "code" } });
  const procedure = job.procedure_id ? procedures[job.procedure_id] : null;
  const fieldId = types[job.instrument_type_id]?.field_id ?? null;

  const [env, setEnv] = useState({ temp: job.env.temp == null ? "" : String(job.env.temp), humidity: job.env.humidity == null ? "" : String(job.env.humidity), pressure: job.env.pressure == null ? "" : String(job.env.pressure) });
  const [stdIds, setStdIds] = useState<string[]>(job.standard_ids);
  const [performedAt, setPerformedAt] = useState(job.performed_at ?? todayStr());
  const [note, setNote] = useState(job.performed_note ?? "");
  const [texts, setTexts] = useState<RawTexts>({});
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [dirty, setDirty] = useState(false);

  // nạp số liệu đã lưu khi có mẫu
  useEffect(() => {
    if (!procedure) return;
    setTexts(textsFromReadings(procedure.template, job.readings));
    const c: Record<string, Record<string, boolean>> = {};
    for (const s of procedure.template.sections) if (s.kind === "checklist") c[s.id] = { ...((job.readings[s.id] ?? {}) as Record<string, boolean>) };
    setChecks(c);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedure?.id, job.submitted_at, job.return_reason]);

  const parse = (s: string) => { const t = s.trim().replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
  const envNum = useMemo(() => ({ temp: parse(env.temp), humidity: parse(env.humidity), pressure: parse(env.pressure) }), [env]);
  const readings = useMemo(() => (procedure ? buildReadings(procedure.template, texts, checks) : {}), [procedure, texts, checks]);
  const result = useMemo(() => (procedure ? evaluate(procedure.template, readings) : null), [procedure, readings]);
  const envProblems = useMemo(() => (procedure ? checkEnv(procedure.template, envNum) : []), [procedure, envNum]);

  if (!procedure) return <Card title="Biên bản kiểm định"><div className="text-sm text-red-700 dark:text-red-400">Chưa gắn quy trình kiểm định cho phiếu này. Người phân công cần chọn quy trình trước khi nhập số liệu.</div></Card>;

  const save = async () => {
    await svc.saveReadings(job.id, { env: envNum, readings, standard_ids: stdIds, performed_at: performedAt || null, performed_note: note || null });
    setDirty(false);
  };
  const onSave = async () => { setBusy("save"); try { await save(); ui.toast("Đã lưu nháp biên bản"); } catch (e) { ui.error(e); } finally { setBusy(null); } };
  const onSubmit = async () => {
    setBusy("submit");
    try { await save(); await svc.submitForReview(job.id); ui.toast("Đã nộp soát xét"); } catch (e) { ui.error(e); } finally { setBusy(null); }
  };

  const usable = (s: Standard) => svc.standardProblem(s, fieldId, performedAt || todayStr());
  const fieldStds = standards.filter((s) => s.field_id === fieldId || stdIds.includes(s.id));

  return (
    <Card title={<span>{procedure.doc_kind === "ra_report" ? "Biên bản kiểm tra RA" : "Biên bản kiểm định"} <span className="ml-1 text-xs font-normal text-slate-500">{procedure.code} · {procedure.name}</span></span>}
      actions={result && (result.complete ? <Badge tone={result.pass ? "green" : "red"}>{result.pass ? "Đạt" : "Không đạt"}</Badge> : <Badge tone="amber">Chưa đủ số liệu ({result.missing.length})</Badge>)}>
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <div>
          <div className="label">Điều kiện môi trường</div>
          <div className="grid grid-cols-3 gap-2">
            {([["temp", "Nhiệt độ °C"], ["humidity", "Độ ẩm %RH"], ["pressure", "Áp suất hPa"]] as const).map(([k, l]) => (
              <label key={k} className="text-xs text-slate-500">{l}
                <input type="text" inputMode="decimal" className="input num mt-1" value={env[k]} onChange={(e) => { setEnv({ ...env, [k]: e.target.value }); setDirty(true); }} />
              </label>
            ))}
          </div>
          {envProblems.length > 0 && <ul className="mt-1.5 text-xs text-red-700 dark:text-red-400">{envProblems.map((p) => <li key={p}>• {p}</li>)}</ul>}
          {(procedure.template.env_limits.temp || procedure.template.env_limits.humidity) && (
            <div className="mt-1 text-xs text-slate-500">Giới hạn: {procedure.template.env_limits.temp && `${procedure.template.env_limits.temp[0]}–${procedure.template.env_limits.temp[1]} °C`}{procedure.template.env_limits.humidity && ` · ${procedure.template.env_limits.humidity[0]}–${procedure.template.env_limits.humidity[1]} %RH`}</div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Ngày thực hiện"><Input type="date" value={performedAt} onChange={(e) => { setPerformedAt(e.target.value); setDirty(true); }} /></Field>
          </div>
        </div>
        <div>
          <div className="label">Chuẩn sử dụng</div>
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {fieldStds.length === 0 && <div className="p-3 text-sm text-slate-500">Chưa có chuẩn nào thuộc lĩnh vực này.</div>}
            {fieldStds.map((s) => {
              const problem = usable(s);
              const checked = stdIds.includes(s.id);
              return (
                <label key={s.id} className={clsx("flex min-h-10 cursor-pointer items-start gap-2 px-3 py-2 text-sm", problem && !checked && "cursor-not-allowed opacity-60")}>
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={checked} disabled={!!problem && !checked}
                    onChange={(e) => { setStdIds(e.target.checked ? [...stdIds, s.id] : stdIds.filter((x) => x !== s.id)); setDirty(true); }} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{s.code}</span> <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                    <span className="block text-xs text-slate-500">Hạn hiệu chuẩn: {fmtDate(s.cal_due)}{problem && <span className="font-semibold text-red-700 dark:text-red-400"> · {problem}</span>}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {(procedure.legal || procedure.note) && (
        <details className="mb-4 rounded-xl border border-[var(--line-2)] bg-[rgba(var(--ink-rgb),0.025)] px-4 py-2.5 text-sm">
          <summary className="cursor-pointer font-semibold">Yêu cầu của quy trình {procedure.code}</summary>
          {procedure.legal && <p className="mt-2 text-[var(--ink-2)]">{procedure.legal}</p>}
          {procedure.note && <p className="mt-1 text-xs text-[var(--ink-3)]">{procedure.note}</p>}
        </details>
      )}
      <JobRecordEditor template={procedure.template} texts={texts} checks={checks} result={result!}
        onText={(k, v) => { setTexts((t) => ({ ...t, [k]: v })); setDirty(true); }}
        onCheck={(sec, item, v) => { setChecks((c) => ({ ...c, [sec]: { ...(c[sec] ?? {}), [item]: v } })); setDirty(true); }} />

      <div className="mt-4">
        <Field label="Ghi chú"><Textarea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setDirty(true); }} placeholder="Bất thường khi đo, phụ kiện, hiệu chỉnh trước khi kiểm…" /></Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <div className="text-sm">
          {result?.complete ? (
            <span className="flex items-center gap-2"><CheckCircle2 className={clsx("h-4 w-4", result.pass ? "text-emerald-600" : "text-red-600")} />Kết luận: <span className={clsx("font-semibold", result.pass ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{result.pass ? "Đạt" : "Không đạt"}</span></span>
          ) : (
            <div>
              <div className="font-medium text-amber-800 dark:text-amber-300">Chưa đủ số liệu{result?.pass === false && " (đã có mục không đạt)"}</div>
              <ul className="text-xs text-slate-500">{result?.missing.slice(0, 5).map((m) => <li key={m}>• {m}</li>)}{(result?.missing.length ?? 0) > 5 && <li>… còn {result!.missing.length - 5} mục</li>}</ul>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={busy === "save"} disabled={busy !== null} onClick={onSave}>Lưu nháp{dirty ? " *" : ""}</Button>
          <Button icon={<Send className="h-4 w-4" />} loading={busy === "submit"} disabled={busy !== null} onClick={onSubmit}>Nộp soát xét</Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Soát xét
// ---------------------------------------------------------------------------
function ReviewPanel({ job }: { job: Job }) {
  const { svc } = useData();
  const ui = useUi();
  const { rows: settings } = useTable("settings");
  const list = settings[0]?.review.checklist ?? [];
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"ok" | "return" | null>(null);
  const allChecked = list.every((_, i) => checks[String(i)]);

  const submit = async (ok: boolean) => {
    if (!ok && !note.trim()) { ui.toast("Cần ghi lý do trả lại", "error"); return; }
    setBusy(ok ? "ok" : "return");
    try { await svc.reviewJob(job.id, { ok, note: note.trim() || null, checks }); ui.toast(ok ? "Đã chuyển phê duyệt" : "Đã trả lại kiểm định viên"); }
    catch (e) { ui.error(e); } finally { setBusy(null); }
  };

  return (
    <Card title="Soát xét biên bản">
      <div className="space-y-2">
        {list.map((item, i) => <Checkbox key={i} checked={!!checks[String(i)]} onChange={(v) => setChecks({ ...checks, [String(i)]: v })} label={item} className="min-h-7" />)}
      </div>
      <div className="mt-3"><Field label="Ý kiến soát xét"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bắt buộc khi trả lại" /></Field></div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" loading={busy === "return"} disabled={busy !== null} onClick={() => submit(false)}>Trả lại</Button>
        <Button variant="success" loading={busy === "ok"} disabled={busy !== null || !allChecked} title={allChecked ? "" : "Đánh dấu đủ các mục kiểm tra"} onClick={() => submit(true)}>Đồng ý, chuyển phê duyệt</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phân công
// ---------------------------------------------------------------------------
function AssignModal({ job, fieldId, onClose }: { job: Job; fieldId: string; onClose: () => void }) {
  const { svc, users } = useData();
  const ui = useUi();
  const { rows: auths } = useTable("authorizations");
  const { rows: procedures } = useTable("procedures", { where: { status: "active" }, orderBy: { field: "code" } });
  const today = todayStr();
  const ok = (u: User, role: string) => auths.some((a) => a.user_id === u.id && a.field_id === fieldId && a.role === role && a.valid_from <= today && (!a.valid_to || a.valid_to >= today));
  const performers = users.filter((u) => u.active && ok(u, "perform"));
  const [assignee, setAssignee] = useState<string | null>(job.assignee_id ?? performers[0]?.id ?? null);
  const reviewers = users.filter((u) => u.active && u.id !== assignee && ok(u, "review"));
  const [reviewer, setReviewer] = useState<string | null>(job.reviewer_id);
  const [due, setDue] = useState(job.due_date ?? "");
  const [priority, setPriority] = useState<Priority>(job.priority);
  const [procId, setProcId] = useState<string>(job.procedure_id ?? "");
  const [busy, setBusy] = useState(false);
  const sel = assignee ? users.find((u) => u.id === assignee) : null;
  const cardWarn = !sel?.inspector_card_expiry ? null
    : sel.inspector_card_expiry < today ? "Thẻ kiểm định viên đã hết hạn"
    : sel.inspector_card_expiry <= addDays(today, 60) ? `Thẻ kiểm định viên sắp hết hạn (${fmtDate(sel.inspector_card_expiry)})` : null;

  const submit = async () => {
    if (!assignee) return;
    setBusy(true);
    try {
      await svc.assignJob(job.id, { assignee_id: assignee, reviewer_id: reviewer, due_date: due || null, priority, procedure_id: procId || null });
      ui.toast("Đã phân công"); onClose();
    } catch (e) { ui.error(e); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Phân công phiếu ${job.code}`}
      footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={busy} disabled={!assignee} onClick={submit}>Phân công</Button></>}>
      <div className="space-y-3">
        <Field label="Kiểm định viên" hint={cardWarn ? undefined : "Chỉ liệt kê người có ủy quyền thực hiện lĩnh vực này còn hiệu lực"} error={cardWarn}>
          {performers.length === 0 ? <p className="text-sm text-red-700 dark:text-red-400">Chưa có ai được ủy quyền thực hiện lĩnh vực này. Vào Nhân sự, ủy quyền để cấp.</p> : (
            <SearchSelect items={performers} value={assignee} onChange={(v) => { setAssignee(v); if (v === reviewer) setReviewer(null); }} getLabel={(u) => u.full_name} getSub={(u) => `${u.title ?? ""}${u.inspector_card_no ? ` · thẻ ${u.inspector_card_no}` : ""}`} allowClear={false} />
          )}
        </Field>
        <Field label="Người soát xét (tuỳ chọn, phải khác KĐV)">
          <SearchSelect items={reviewers} value={reviewer} onChange={setReviewer} getLabel={(u) => u.full_name} getSub={(u) => u.title ?? ""} placeholder="Để trống: ai có ủy quyền soát xét đều được" />
        </Field>
        <Field label="Quy trình kiểm định">
          <Select value={procId} onChange={(e) => setProcId(e.target.value)}>
            <option value="">– Chưa chọn –</option>
            {procedures.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} (v{p.version})</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hẹn trả"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Ưu tiên">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function addDays(iso: string, n: number) { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

// ---------------------------------------------------------------------------
// Phê duyệt, phát hành
// ---------------------------------------------------------------------------
function IssueModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { svc, me } = useData();
  const ui = useUi();
  const customers = useIndex("customers");
  const orders = useIndex("orders");
  const { rows: settings } = useTable("settings");
  const { rows: seals } = useTable("seals");
  const procedures = useIndex("procedures");
  const isRa = job.procedure_id ? procedures[job.procedure_id]?.doc_kind === "ra_report" : false;
  const pass = job.result?.pass === true;
  const docName = isRa ? "biên bản RA" : pass ? "GCN" : "thông báo";
  const order = orders[job.order_id];
  const customer = customers[job.customer_id];
  const [issuedAt, setIssuedAt] = useState(todayStr());
  const [sealNo, setSealNo] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    if (me) svc.nextSealFor(me.id).then((s) => { if (s) setSealNo((v) => v || s.number); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
  // điền nơi thực hiện mặc định khi đã tải đủ đơn hàng, khách, cài đặt (hiện trường → địa chỉ khách)
  useEffect(() => {
    if (!order || !settings.length || (order.onsite && !customer)) return;
    setPlace((p) => p || (order.onsite ? customer?.address ?? "" : settings[0].company.address));
  }, [order, customer, settings]);

  const seal: Seal | undefined = seals.find((s) => s.number === sealNo.trim());
  const sealState = !sealNo.trim() ? null : !seal ? "Không có số tem này" : seal.status === "stock" ? "Trong kho" : seal.status === "assigned" ? `Đã cấp cho ${seal.assigned_to === me?.id ? "bạn" : "người khác"}` : seal.status === "used" ? "Đã dùng" : "Đã huỷ";
  const sealOk = !sealNo.trim() || (seal && ["stock", "assigned"].includes(seal.status));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await svc.approveAndIssue(job.id, { issued_at: issuedAt, seal_no: pass && !isRa && sealNo.trim() ? sealNo.trim() : null, place });
      ui.toast(`Đã phát hành ${docName} số ${r.certificate.number}`);
      setDone({ id: r.certificate.id, number: r.certificate.number });
    } catch (e) { ui.error(e); } finally { setBusy(false); }
  };

  if (done) return (
    <Modal open onClose={onClose} title="Đã phát hành" footer={<><Button variant="secondary" onClick={onClose}>Đóng</Button><Link to={`/certificates/${done.id}`}><Button icon={<Award className="h-4 w-4" />}>Xem, in {docName}</Button></Link></>}>
      <p className="text-sm">{isRa ? "Biên bản kiểm tra độ chính xác tương đối" : pass ? "Giấy chứng nhận kiểm định" : "Thông báo kết quả kiểm định không đạt"} số <span className="font-semibold">{done.number}</span> đã được ký và lưu. Bản phát hành không sửa được; nếu sai, dùng chức năng thay thế hoặc thu hồi.</p>
    </Modal>
  );

  return (
    <Modal open onClose={onClose} title={`Phê duyệt phiếu ${job.code}`}
      footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button icon={<FileSignature className="h-4 w-4" />} loading={busy} disabled={!sealOk || !issuedAt} onClick={submit}>Ký và phát hành</Button></>}>
      <div className="space-y-3">
        <div className={clsx("rounded-xl p-3 text-sm", pass ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200")}>
          {isRa
            ? <><span className="font-semibold">Kết luận: {pass ? "Đạt" : "Không đạt"}.</span> Phát hành Biên bản kiểm tra độ chính xác tương đối (TT 10/2021/TT-BTNMT), không cấp tem.</>
            : pass ? <><span className="font-semibold">Kết luận: Đạt.</span> Phát hành Giấy chứng nhận kiểm định và cấp tem.</> : <><span className="font-semibold">Kết luận: Không đạt.</span> Phát hành Thông báo kết quả kiểm định không đạt, không cấp tem.</>}
        </div>
        <Field label="Ngày phát hành"><Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} /></Field>
        {pass && !isRa && (
          <Field label="Số tem kiểm định" hint={sealState ?? "Để trống nếu chưa dán tem"} error={sealNo.trim() && !sealOk ? sealState : null}>
            <Input value={sealNo} onChange={(e) => setSealNo(e.target.value)} className="font-mono" placeholder="KĐV-000001" />
          </Field>
        )}
        <Field label="Nơi thực hiện"><Input value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">Hệ thống sẽ tính lại toàn bộ biên bản trước khi ký; nếu kết quả khác bản đã lưu hoặc chuẩn, ủy quyền không hợp lệ, việc phát hành bị chặn.</p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Hộp nhập lý do dùng chung
// ---------------------------------------------------------------------------
function ReasonModal({ title, label, confirmText, danger, onClose, onSubmit }: { title: string; label: string; confirmText: string; danger?: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const ui = useUi();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await onSubmit(reason.trim()); onClose(); } catch (e) { ui.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button variant={danger ? "danger" : "primary"} loading={busy} disabled={!reason.trim()} onClick={go}>{confirmText}</Button></>}>
      <Field label={label}><Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}
