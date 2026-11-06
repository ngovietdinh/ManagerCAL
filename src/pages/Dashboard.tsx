import { AlertTriangle, Award, ClipboardList, FlaskConical, Gauge, IdCard, Wallet } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { dueText, dueTone } from "@/components/aHelpers";
import { dayjs, fmtDate, money, todayStr } from "@/lib/format";
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from "@/lib/labels";
import { hasRole } from "@/lib/perm";

export default function Dashboard() {
  const { me, can } = useData();
  const nav = useNavigate();
  const { rows: jobs } = useTable("jobs");
  const { rows: certs } = useTable("certificates");
  const { rows: orders } = useTable("orders");
  const { rows: devices } = useTable("devices", { where: { status: "active" } });
  const { rows: standards } = useTable("standards");
  const { rows: users } = useTable("users", { where: { active: true } });
  const { rows: settingsRows } = useTable("settings");
  const customers = useIndex("customers");
  const settings = settingsRows[0];

  const today = todayStr();
  const month = dayjs().format("YYYY-MM");

  const stats = useMemo(() => {
    const open = jobs.filter((j) => !["issued", "returned", "cancelled"].includes(j.status));
    const byStatus = (s: string) => jobs.filter((j) => j.status === s).length;
    const overdue = open.filter((j) => j.due_date && j.due_date < today);
    const certsMonth = certs.filter((c) => c.issued_at.startsWith(month) && c.status !== "replaced");
    const pass = certsMonth.filter((c) => c.kind === "certificate").length;
    const fail = certsMonth.filter((c) => c.kind === "fail_notice").length;
    const jobById = Object.fromEntries(jobs.map((j) => [j.id, j]));
    const revenue = certsMonth.reduce((s, c) => s + (jobById[c.job_id]?.price ?? 0), 0);
    const unpaid = orders.filter((o) => !o.paid && o.status !== "cancelled").reduce((s, o) => s + o.total_amount, 0);
    const in30 = dayjs().add(30, "day").format("YYYY-MM-DD");
    const dueDevices = devices.filter((d) => d.next_due && d.next_due <= in30);
    const stdDays = settings?.reminders.standard_due_days ?? 45;
    const stdSoon = dayjs().add(stdDays, "day").format("YYYY-MM-DD");
    const stdWarn = standards.filter((s) => s.status === "locked" || (s.status === "ok" && s.cal_due && s.cal_due <= stdSoon));
    const cardDays = settings?.reminders.card_due_days ?? 60;
    const cardSoon = dayjs().add(cardDays, "day").format("YYYY-MM-DD");
    const cardWarn = users.filter((u) => u.inspector_card_expiry && u.inspector_card_expiry <= cardSoon);
    return { open, byStatus, overdue, certsMonth, pass, fail, revenue, unpaid, dueDevices, stdWarn, cardWarn, stdDays, cardDays };
  }, [jobs, certs, orders, devices, standards, users, settings, today, month]);

  const chart = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const m = dayjs().subtract(5 - i, "month");
      const key = m.format("YYYY-MM");
      const rows = certs.filter((c) => c.issued_at.startsWith(key) && c.status !== "replaced");
      return { name: m.format("MM/YY"), dat: rows.filter((c) => c.kind === "certificate").length, khongDat: rows.filter((c) => c.kind === "fail_notice").length };
    });
  }, [certs]);

  const myJobs = useMemo(() => {
    if (!me) return [];
    const mine = jobs.filter((j) => j.assignee_id === me.id && ["assigned", "in_progress"].includes(j.status)).map((j) => ({ j, why: "Được phân công" }));
    const review = can("review") ? jobs.filter((j) => j.status === "review" && j.assignee_id !== me.id && (!j.reviewer_id || j.reviewer_id === me.id)).map((j) => ({ j, why: "Chờ soát xét" })) : [];
    const sign = can("sign") ? jobs.filter((j) => j.status === "approval").map((j) => ({ j, why: "Chờ phê duyệt" })) : [];
    const assign = can("assign") && !hasRole(me, "technician") ? jobs.filter((j) => j.status === "received").map((j) => ({ j, why: "Chờ phân công" })) : [];
    return [...mine, ...review, ...sign, ...assign].slice(0, 8);
  }, [jobs, me, can]);

  const dueList = useMemo(() => [...stats.dueDevices].sort((a, b) => (a.next_due! < b.next_due! ? -1 : 1)).slice(0, 10), [stats.dueDevices]);
  const openByStatus = [
    { s: "received", n: stats.byStatus("received") }, { s: "assigned", n: stats.byStatus("assigned") }, { s: "in_progress", n: stats.byStatus("in_progress") },
    { s: "review", n: stats.byStatus("review") }, { s: "approval", n: stats.byStatus("approval") },
  ];

  return (
    <>
      <PageHeader title="Tổng quan" subtitle={`Tình hình đến ${fmtDate(today)} · ${settings?.company.name ?? ""}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Phiếu đang xử lý" value={stats.open.length} tone="blue" icon={<ClipboardList className="h-5 w-5" />} onClick={() => nav("/jobs")}
          sub={openByStatus.filter((x) => x.n).map((x) => `${JOB_STATUS_LABEL[x.s as keyof typeof JOB_STATUS_LABEL]} ${x.n}`).join(" · ") || "Không có"} />
        <Stat label="Phiếu trễ hạn" value={stats.overdue.length} tone={stats.overdue.length ? "red" : "green"} icon={<AlertTriangle className="h-5 w-5" />} onClick={() => nav("/jobs?overdue=1")} sub="Quá ngày hẹn trả" />
        <Stat label="GCN phát hành tháng này" value={stats.certsMonth.length} tone="green" icon={<Award className="h-5 w-5" />} onClick={() => nav("/certificates")}
          sub={stats.certsMonth.length ? `Đạt ${stats.pass} · Không đạt ${stats.fail} (${Math.round((stats.fail / stats.certsMonth.length) * 100)}%)` : "Chưa có"} />
        <Stat label="Doanh thu tháng này" value={money(stats.revenue)} tone="violet" icon={<Wallet className="h-5 w-5" />} onClick={() => nav("/orders")}
          sub={`Chưa thu: ${money(stats.unpaid)} đ`} />
        <Stat label="Thiết bị khách đến hạn 30 ngày" value={stats.dueDevices.length} tone={stats.dueDevices.length ? "amber" : "gray"} icon={<Gauge className="h-5 w-5" />} onClick={() => nav("/devices?due=1")}
          sub={`Quá hạn: ${stats.dueDevices.filter((d) => d.next_due! < today).length}`} />
        <Stat label={`Chuẩn cần chú ý (${stats.stdDays} ngày)`} value={stats.stdWarn.length} tone={stats.stdWarn.length ? "red" : "green"} icon={<FlaskConical className="h-5 w-5" />} onClick={() => nav("/standards")}
          sub={`Đã khoá: ${stats.stdWarn.filter((s) => s.status === "locked").length}`} />
        <Stat label={`Thẻ KĐV sắp hết hạn (${stats.cardDays} ngày)`} value={stats.cardWarn.length} tone={stats.cardWarn.length ? "amber" : "green"} icon={<IdCard className="h-5 w-5" />} onClick={() => nav("/staff")}
          sub={stats.cardWarn.map((u) => u.full_name).join(", ") || "Không có"} />
        <Card className="p-3" bodyClass="p-0">
          <div className="px-1 text-xs text-slate-500">GCN theo tháng (6 tháng)</div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v, n) => [v as number, n === "dat" ? "Đạt" : "Không đạt"]} />
                <Bar dataKey="dat" name="Đạt" stackId="a" fill="#1e56a0" isAnimationActive={false} />
                <Bar dataKey="khongDat" name="Không đạt" stackId="a" fill="#b3261e" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr] [&>*]:min-w-0">
        <Card title="Việc của tôi" actions={<Link to="/jobs" className="link text-sm">Xem tất cả</Link>} bodyClass="p-0">
          {myJobs.length === 0 ? <Empty text="Không có việc nào đang chờ bạn." /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Phiếu</th><th>Thiết bị</th><th>Khách hàng</th><th>Hẹn trả</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {myJobs.map(({ j, why }) => {
                  const d = devices.find((x) => x.id === j.device_id);
                  const late = j.due_date && j.due_date < today;
                  return (
                    <tr key={j.id} className="cursor-pointer" onClick={() => nav(`/jobs/${j.id}`)}>
                      <td className="code font-medium">{j.code}{j.priority === "urgent" && <Badge tone="red" className="ml-1">Gấp</Badge>}</td>
                      <td className="min-w-40">{d?.name ?? "–"}{d?.serial && <div className="text-xs text-slate-500">{d.serial}</div>}</td>
                      <td className="max-w-40 truncate">{customers[j.customer_id]?.name ?? "–"}</td>
                      <td className={late ? "code font-medium text-red-700 dark:text-red-300" : "code"}>{fmtDate(j.due_date)}</td>
                      <td><Badge tone={JOB_STATUS_TONE[j.status]}>{JOB_STATUS_LABEL[j.status]}</Badge><div className="mt-0.5 text-xs text-slate-500">{why}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </Card>
        <Card title="Thiết bị đến hạn sắp tới" actions={<Link to="/devices?due=1" className="link text-sm">Xem tất cả</Link>} bodyClass="p-0">
          {dueList.length === 0 ? <Empty text="Không có thiết bị nào đến hạn trong 30 ngày tới." /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Khách hàng</th><th>Thiết bị</th><th>Hạn</th><th></th></tr></thead>
              <tbody>
                {dueList.map((d) => (
                  <tr key={d.id}>
                    <td className="max-w-52 truncate"><Link className="link" to={`/customers/${d.customer_id}`}>{customers[d.customer_id]?.name ?? "–"}</Link></td>
                    <td>{d.name}<div className="text-xs text-slate-500">{d.serial ?? ""}</div></td>
                    <td className="code"><div>{fmtDate(d.next_due)}</div><Badge tone={dueTone(d.next_due)}>{dueText(d.next_due)}</Badge></td>
                    <td className="text-right">{can("orders") && <Button size="sm" variant="secondary" className="min-h-7 whitespace-nowrap" onClick={() => nav(`/orders/new?customer=${d.customer_id}&device=${d.id}`)}>Tạo đơn</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
      </div>
    </>
  );
}
