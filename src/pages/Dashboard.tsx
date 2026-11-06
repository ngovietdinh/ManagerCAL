// =============================================================================
// Tổng quan – "màn hình nhìn" kiểu kính (DESIGN.md › Hai lớp giao diện).
// Mọi con số và cột nhỏ là dữ liệu thật; thiếu dữ liệu ghi "–", không bịa phần trăm.
// =============================================================================
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Award, ClipboardList, FlaskConical, Gauge, IdCard, PackagePlus, Wallet } from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useData, useIndex, useTable } from "@/app/data";
import { dueText } from "@/components/aHelpers";
import { dayjs, fmtDate, money, todayStr } from "@/lib/format";
import { JOB_STATUS_LABEL } from "@/lib/labels";
import { hasRole } from "@/lib/perm";
import type { JobStatus } from "@/lib/types";

const OPEN: JobStatus[] = ["received", "assigned", "in_progress", "review", "approval"];

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

/** Cột nhỏ: giá trị thật theo kỳ, cột cuối là kỳ hiện tại */
function Bars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="gx-bars mt-3" role="img" aria-label={label}>
      {values.map((v, i) => <i key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />)}
    </div>
  );
}

function Kpi({ to, icon, label, value, unit, note, bars, barsLabel, variant, delay }: {
  to: string; icon: ReactNode; label: string; value: ReactNode; unit?: string; note: ReactNode; bars?: number[]; barsLabel?: string;
  variant?: "emerald" | "bank" | "alert"; delay: number;
}) {
  return (
    <Link to={to} className={clsx("gc rise flex min-h-[168px] flex-col", variant && `gc--${variant}`)} style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      <div className="flex items-center gap-2.5 text-[13px] font-semibold">
        <span className="gx-ico [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span>{label}
      </div>
      <div className="gx-big mt-3">{value}{unit && <small>{unit}</small>}</div>
      <div className="gx-note mt-1">{note}</div>
      {bars && <Bars values={bars} label={barsLabel ?? label} />}
    </Link>
  );
}

export default function Dashboard() {
  const { me, can } = useData();
  const { rows: jobs } = useTable("jobs");
  const { rows: certs } = useTable("certificates");
  const { rows: orders } = useTable("orders");
  const { rows: devices } = useTable("devices", { where: { status: "active" } });
  const { rows: standards } = useTable("standards");
  const { rows: users } = useTable("users", { where: { active: true } });
  const { rows: settingsRows } = useTable("settings");
  const customers = useIndex("customers");
  const devIdx = useIndex("devices");
  const settings = settingsRows[0];
  const today = todayStr();

  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => dayjs().subtract(5 - i, "month").format("YYYY-MM")), []);

  const s = useMemo(() => {
    const open = jobs.filter((j) => OPEN.includes(j.status));
    const overdue = open.filter((j) => j.due_date && j.due_date < today);
    const live = certs.filter((c) => c.status !== "replaced");
    const inMonth = (m: string) => live.filter((c) => c.issued_at.startsWith(m));
    const cm = inMonth(months[5]);
    const pass = cm.filter((c) => c.kind === "certificate").length;
    const fail = cm.length - pass;
    const jobById = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const revenueOf = (m: string) => inMonth(m).reduce((sum, c) => sum + (jobById[c.job_id]?.price ?? 0), 0);
    const unpaid = orders.filter((o) => !o.paid && o.status !== "cancelled").reduce((sum, o) => sum + o.total_amount, 0);
    const in30 = dayjs().add(30, "day").format("YYYY-MM-DD");
    const due = devices.filter((d) => d.next_due && d.next_due <= in30).sort((a, b) => a.next_due!.localeCompare(b.next_due!));
    const stdDays = settings?.reminders.standard_due_days ?? 45;
    const stdSoon = dayjs().add(stdDays, "day").format("YYYY-MM-DD");
    const stdWarn = standards.filter((x) => x.status === "locked" || (x.status === "ok" && x.cal_due && x.cal_due <= stdSoon));
    const cardDays = settings?.reminders.card_due_days ?? 60;
    const cardSoon = dayjs().add(cardDays, "day").format("YYYY-MM-DD");
    const cardWarn = users.filter((u) => u.inspector_card_expiry && u.inspector_card_expiry <= cardSoon);
    // số phiếu tiếp nhận theo tháng (cho cột nhỏ của "đang xử lý")
    const receivedBy = months.map((m) => jobs.filter((j) => j.created_at.startsWith(m)).length);
    const dueByMonth = months.map((_, i) => {
      const from = dayjs().add(i * 30 - 150, "day").format("YYYY-MM-DD");
      const to = dayjs().add(i * 30 - 120, "day").format("YYYY-MM-DD");
      return devices.filter((d) => d.next_due && d.next_due > from && d.next_due <= to).length;
    });
    return {
      open, overdue, pass, fail, total: cm.length, unpaid, due, stdWarn, cardWarn, stdDays, cardDays, receivedBy, dueByMonth,
      certsBy: months.map((m) => inMonth(m).length), revenueBy: months.map(revenueOf),
      byStatus: OPEN.map((st) => ({ st, n: jobs.filter((j) => j.status === st).length })),
    };
  }, [jobs, certs, orders, devices, standards, users, settings, today, months]);

  const myWork = useMemo(() => {
    if (!me) return [];
    const out: { id: string; code: string; device: string; customer: string; due: string | null; why: string; late: boolean }[] = [];
    const push = (j: (typeof jobs)[number], why: string) => out.push({
      id: j.id, code: j.code, device: devIdx[j.device_id]?.name ?? "–", customer: customers[j.customer_id]?.name ?? "–", due: j.due_date, why,
      late: !!j.due_date && j.due_date < today,
    });
    for (const j of jobs) {
      if (j.assignee_id === me.id && ["assigned", "in_progress"].includes(j.status)) push(j, j.status === "assigned" ? "Được phân công" : "Đang làm");
      else if (can("review") && j.status === "review" && j.assignee_id !== me.id && (!j.reviewer_id || j.reviewer_id === me.id)) push(j, "Chờ bạn soát xét");
      else if (can("sign") && j.status === "approval") push(j, "Chờ bạn ký");
      else if (can("assign") && !hasRole(me, "technician") && j.status === "received") push(j, "Chờ phân công");
    }
    return out.sort((a, b) => Number(b.late) - Number(a.late) || (a.due ?? "9").localeCompare(b.due ?? "9"));
  }, [jobs, me, can, devIdx, customers, today]);

  const toSign = jobs.filter((j) => j.status === "approval").length;
  const toReview = jobs.filter((j) => j.status === "review").length;
  const firstName = me?.full_name.trim().split(/\s+/).slice(-1)[0] ?? "";
  const maxStatus = Math.max(1, ...s.byStatus.map((x) => x.n));

  return (
    <div className="grid grid-cols-12 gap-3.5">
      {/* lời chào + hành động chính */}
      <section className="gc rise col-span-12 flex flex-col justify-between gap-5 p-6 xl:col-span-8">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-7 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--c1)_16%,transparent)] px-3 text-[12.5px] font-semibold text-[var(--c1-lo)] dark:text-[var(--c1)]">
              <span className="h-2 w-2 rounded-full bg-[var(--c1)]" aria-hidden />{s.open.length} phiếu đang xử lý
            </span>
            <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--edge)] bg-[rgba(var(--hi),calc(0.5*var(--gk)))] px-3 text-[12.5px] font-semibold">
              {dayjs().format("dddd, DD/MM/YYYY").replace(/^./, (c) => c.toUpperCase())}
            </span>
          </div>
          <h1 className="mt-4 text-[clamp(28px,3.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.035em]">
            {greeting()}, <span className="text-[var(--ink-3)]">{firstName}</span>
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15px] text-[var(--ink-2)]">
            {s.overdue.length > 0 ? <><b className="text-[#b42318] dark:text-[#ff9a80]">{s.overdue.length} phiếu đã quá hẹn trả</b>, </> : "Không có phiếu nào quá hẹn trả, "}
            {myWork.length > 0 ? <>{myWork.length} việc đang chờ bạn</> : "không có việc nào đang chờ bạn"}
            {s.due.length > 0 && <>, và {s.due.length} thiết bị của khách đến hạn kiểm định trong 30 ngày tới</>}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("orders") && <Link to="/orders/new" className="btn btn--primary min-h-[42px] px-5 text-sm"><PackagePlus className="h-4 w-4" />Tiếp nhận đơn mới</Link>}
          <Link to="/jobs" className="btn btn--secondary min-h-[42px] px-5 text-sm"><ClipboardList className="h-4 w-4" />Phiếu công việc</Link>
          {can("sign") && toSign > 0 && <Link to="/jobs?status=approval" className="btn btn--secondary min-h-[42px] px-5 text-sm">Chờ ký <b className="tabular-nums">{toSign}</b></Link>}
          {can("review") && toReview > 0 && <Link to="/jobs?status=review" className="btn btn--secondary min-h-[42px] px-5 text-sm">Chờ soát xét <b className="tabular-nums">{toReview}</b></Link>}
        </div>
      </section>

      {/* thẻ tối: việc của tôi */}
      <section className="gc gc--bank rise col-span-12 flex flex-col p-5 xl:col-span-4" style={{ animationDelay: "70ms" }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-[13px] font-semibold"><span className="gx-ico"><ClipboardList className="h-[17px] w-[17px]" /></span>Việc của tôi</div>
          <Link to="/jobs?mine=1" className="inline-flex min-h-8 items-center gap-1 rounded-full bg-white/12 px-3 text-xs font-semibold hover:bg-white/20">Tất cả <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {myWork.length === 0 ? (
          <p className="mt-6 text-sm text-white/80">Không có việc nào đang chờ bạn.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {myWork.slice(0, 5).map((w) => (
              <li key={w.id}>
                <Link to={`/jobs/${w.id}`} className="flex min-h-12 items-center gap-3 rounded-xl px-1 py-2 hover:bg-white/8">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{w.device}</div>
                    <div className="truncate text-xs text-white/75">{w.customer} · {w.code}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className={clsx("font-semibold", w.late ? "text-[#ffb09a]" : "text-[#7ee6b8]")}>{w.why}</div>
                    <div className="text-white/70">{w.due ? (w.late ? `quá hạn ${dayjs(today).diff(dayjs(w.due), "day")} ngày` : `hẹn ${fmtDate(w.due).slice(0, 5)}`) : "–"}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {myWork.length > 5 && <div className="mt-auto pt-3 text-xs text-white/75">và {myWork.length - 5} việc khác</div>}
      </section>

      {/* số liệu chính */}
      <div className="col-span-12 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi to="/certificates" icon={<Award />} label="GCN tháng này" value={s.total} variant="emerald" delay={120}
          note={s.total ? `Đạt ${s.pass} · Không đạt ${s.fail}` : "Chưa phát hành GCN nào"} bars={s.certsBy} barsLabel="Số GCN phát hành 6 tháng gần nhất" />
        <Kpi to="/jobs?overdue=1" icon={<AlertTriangle />} label="Phiếu quá hẹn trả" value={s.overdue.length} delay={170} variant={s.overdue.length ? "alert" : undefined}
          note={s.overdue.length ? "Cần xử lý ngay" : "Đúng tiến độ"} bars={s.receivedBy} barsLabel="Số phiếu tiếp nhận 6 tháng gần nhất" />
        <Kpi to="/reports" icon={<Wallet />} label="Doanh thu tháng" value={money(s.revenueBy[5])} unit="đ" delay={220}
          note={`Chưa thu: ${money(s.unpaid)} đ`} bars={s.revenueBy} barsLabel="Doanh thu 6 tháng gần nhất" />
        <Kpi to="/devices?due=1" icon={<Gauge />} label="Thiết bị đến hạn" value={s.due.length} unit="/ 30 ngày" delay={270}
          note={`Quá hạn: ${s.due.filter((d) => d.next_due! < today).length}`} />
      </div>

      {/* tiến độ theo trạng thái */}
      <section className="gc rise col-span-12 p-5 xl:col-span-7" style={{ animationDelay: "320ms" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Phiếu theo bước</h2>
          <Link to="/jobs" className="link text-[13px]">Mở bảng phiếu</Link>
        </div>
        <div className="space-y-2.5">
          {s.byStatus.map(({ st, n }) => (
            <Link key={st} to={`/jobs?status=${st}`} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 rounded-xl hover:bg-[rgba(var(--ink-rgb),0.03)]">
              <span className="text-[13px] font-medium">{JOB_STATUS_LABEL[st]}</span>
              <span className="relative h-7 overflow-hidden rounded-[9px] bg-[rgba(var(--ink-rgb),0.06)]">
                <span className={clsx("absolute inset-y-1 left-1 rounded-[7px]", st === "approval" || st === "review" ? "bg-[var(--c3)]" : "bg-[var(--c1)]")}
                  style={{ width: n ? `calc(${(n / maxStatus) * 100}% - 8px)` : 0 }} />
              </span>
              <b className="text-right tabular-nums">{n}</b>
            </Link>
          ))}
        </div>
      </section>

      {/* cảnh báo kỹ thuật */}
      <section className="gc rise col-span-12 p-5 md:col-span-6 xl:col-span-5" style={{ animationDelay: "370ms" }}>
        <h2 className="mb-3 text-[15px] font-semibold">Cần chú ý</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Link to="/standards" className="rounded-[14px] border border-[var(--edge)] bg-[rgba(var(--hi),calc(0.55*var(--gk)))] p-3.5 hover:bg-[rgba(var(--hi),calc(0.8*var(--gk)))]">
            <div className="flex items-center gap-2 text-[13px] font-semibold"><FlaskConical className="h-4 w-4" />Chuẩn đo lường</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{s.stdWarn.length}</div>
            <div className="text-xs text-[var(--ink-3)]">{s.stdWarn.filter((x) => x.status === "locked").length} đã khoá, còn lại hết hạn trong {s.stdDays} ngày</div>
          </Link>
          <Link to="/staff" className="rounded-[14px] border border-[var(--edge)] bg-[rgba(var(--hi),calc(0.55*var(--gk)))] p-3.5 hover:bg-[rgba(var(--hi),calc(0.8*var(--gk)))]">
            <div className="flex items-center gap-2 text-[13px] font-semibold"><IdCard className="h-4 w-4" />Thẻ kiểm định viên</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{s.cardWarn.length}</div>
            <div className="truncate text-xs text-[var(--ink-3)]">{s.cardWarn.map((u) => u.full_name).join(", ") || `Không có thẻ hết hạn trong ${s.cardDays} ngày`}</div>
          </Link>
        </div>
      </section>

      {/* thiết bị của khách đến hạn – cơ hội đơn hàng */}
      <section className="gc rise col-span-12 p-0" style={{ animationDelay: "420ms" }}>
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold">Thiết bị của khách sắp đến hạn</h2>
          <Link to="/devices?due=1" className="link text-[13px]">Xem tất cả</Link>
        </div>
        {s.due.length === 0 ? <p className="px-5 pb-5 text-sm text-[var(--ink-3)]">Không có thiết bị nào đến hạn trong 30 ngày tới.</p> : (
          <div className="table-wrap px-2 pb-2">
            <table className="table">
              <thead><tr><th>Khách hàng</th><th>Thiết bị</th><th>Số sê-ri</th><th>Hạn</th><th></th><th></th></tr></thead>
              <tbody>
                {s.due.slice(0, 8).map((d) => {
                  const late = d.next_due! < today;
                  return (
                    <tr key={d.id}>
                      <td className="max-w-64 truncate"><Link className="link" to={`/customers/${d.customer_id}`}>{customers[d.customer_id]?.name ?? "–"}</Link></td>
                      <td className="min-w-40">{d.name}</td>
                      <td className="code tabular-nums text-[var(--ink-2)]">{d.serial ?? "–"}</td>
                      <td className="code tabular-nums">{fmtDate(d.next_due)}</td>
                      <td className={clsx("code text-xs font-semibold", late ? "text-[#b42318] dark:text-[#ff9a80]" : "text-[#8a5a00] dark:text-[#ffd982]")}>{dueText(d.next_due)}</td>
                      <td className="text-right">{can("orders") && <Link to={`/orders/new?customer=${d.customer_id}&device=${d.id}`} className="btn btn--secondary min-h-8 px-3 text-xs">Tạo đơn</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
