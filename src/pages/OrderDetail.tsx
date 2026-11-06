import { Printer } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData, useIndex, useRow, useTable } from "@/app/data";
import { Badge, Button, Card, Empty, Loading, PageHeader, useUi } from "@/components/ui";
import { dayjs, fmtDate, money, todayStr } from "@/lib/format";
import { JOB_KIND_LABEL, JOB_STATUS_LABEL, JOB_STATUS_TONE, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/labels";

export default function OrderDetail() {
  const { id } = useParams();
  const { svc, can, users } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const { row: o, loading } = useRow("orders", id);
  const { rows: jobs } = useTable("jobs", { where: { order_id: id ?? "" }, orderBy: { field: "code" } });
  const { rows: certs } = useTable("certificates");
  const { rows: settingsRows } = useTable("settings");
  const customers = useIndex("customers");
  const devices = useIndex("devices");
  const types = useIndex("instrument_types");
  const branches = useIndex("branches");
  const [slip, setSlip] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!o) return <Empty text="Không tìm thấy đơn hàng." action={<Link className="link" to="/orders">Về danh sách</Link>} />;
  const c = customers[o.customer_id];
  const company = settingsRows[0]?.company;
  const receiver = users.find((u) => u.id === o.received_by);

  const returnDevice = async (jobId: string) => {
    setBusy(jobId);
    try { await svc.returnDevice(jobId, todayStr()); ui.toast("Đã ghi nhận trả thiết bị cho khách"); } catch (e) { ui.error(e); } finally { setBusy(null); }
  };
  const markPaid = async (paid: boolean) => {
    try { await svc.setOrderPaid(o.id, paid, todayStr()); ui.toast(paid ? "Đã ghi nhận thu tiền" : "Đã bỏ đánh dấu thu tiền"); } catch (e) { ui.error(e); }
  };

  if (slip) {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button variant="secondary" onClick={() => setSlip(false)}>Quay lại</Button>
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>In</Button>
        </div>
        <div className="doc">
          <div className="flex justify-between text-[11pt]">
            <div><b className="uppercase">{company?.name}</b><br />{company?.address}<br />ĐT: {company?.phone} · {company?.email}</div>
            <div className="text-right">Số: <b>{o.code}</b></div>
          </div>
          <h1>Phiếu tiếp nhận phương tiện đo</h1>
          <p className="sub">Ngày {dayjs(o.received_at).format("DD")} tháng {dayjs(o.received_at).format("MM")} năm {dayjs(o.received_at).format("YYYY")}</p>
          <p className="mt-3">Khách hàng: <b>{c?.name}</b><br />Địa chỉ: {c?.address ?? "…"}{c?.tax_code ? ` · MST: ${c.tax_code}` : ""}<br />Người giao: {o.contact_name ?? "…"}{o.contact_phone ? ` · ĐT: ${o.contact_phone}` : ""}<br />Nơi thực hiện: {o.onsite ? "Tại hiện trường của khách hàng" : `Tại phòng thí nghiệm (${branches[o.branch_id ?? ""]?.name ?? ""})`}</p>
          <table className="grid mt-3">
            <thead><tr><th style={{ width: "6%" }}>TT</th><th>Tên phương tiện đo</th><th>Kiểu / số sê-ri</th><th>Tình trạng khi nhận</th><th>Phụ kiện</th><th>Loại kiểm định</th></tr></thead>
            <tbody>
              {jobs.map((j, i) => {
                const d = devices[j.device_id];
                return (
                  <tr key={j.id}>
                    <td className="center">{i + 1}</td>
                    <td>{d?.name}{d?.range_text ? `, ${d.range_text}` : ""}<br /><i>{types[j.instrument_type_id]?.name}</i></td>
                    <td>{[d?.manufacturer, d?.model].filter(Boolean).join(" ")}<br />{d?.serial ?? ""}</td>
                    <td>{j.intake.condition}</td><td>{j.intake.accessories || "–"}</td><td className="center">{JOB_KIND_LABEL[j.kind]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3">Tổng số: <b>{jobs.length}</b> phương tiện đo. Ngày hẹn trả kết quả: <b>{o.expected_at ? fmtDate(o.expected_at) : "theo thoả thuận"}</b>.{o.note ? <><br />Ghi chú: {o.note}</> : null}</p>
          <div className="mt-8 grid grid-cols-2 text-center">
            <div><b>NGƯỜI GIAO</b><br /><i>(Ký, ghi rõ họ tên)</i><br /><br /><br /><br />{o.contact_name ?? ""}</div>
            <div><b>NGƯỜI NHẬN</b><br /><i>(Ký, ghi rõ họ tên)</i><br /><br /><br /><br />{receiver?.full_name ?? ""}</div>
          </div>
        </div>
      </div>
    );
  }

  const late = o.status === "open" && o.expected_at && o.expected_at < todayStr();
  return (
    <>
      <PageHeader title={`Đơn ${o.code}`} subtitle={<><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge> {o.onsite && <Badge tone="cyan">Hiện trường</Badge>}</>}
        actions={<>
          {can("finance") && (o.paid ? <Button variant="secondary" onClick={() => markPaid(false)}>Bỏ đánh dấu đã thu</Button> : <Button variant="success" onClick={() => markPaid(true)}>Ghi nhận đã thu tiền</Button>)}
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => setSlip(true)}>In phiếu tiếp nhận</Button>
        </>} />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Đơn hàng">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Ngày nhận</dt><dd className="font-medium">{fmtDate(o.received_at)}</dd></div>
            <div><dt className="text-xs text-slate-500">Hẹn trả</dt><dd className={late ? "font-medium text-red-700" : "font-medium"}>{fmtDate(o.expected_at)}{late ? " (trễ)" : ""}</dd></div>
            <div><dt className="text-xs text-slate-500">Chi nhánh</dt><dd className="font-medium">{branches[o.branch_id ?? ""]?.name ?? "–"}</dd></div>
            <div><dt className="text-xs text-slate-500">Người tiếp nhận</dt><dd className="font-medium">{receiver?.full_name ?? "–"}</dd></div>
            <div><dt className="text-xs text-slate-500">Tổng tiền</dt><dd className="font-medium tabular-nums">{money(o.total_amount)} đ</dd></div>
            <div><dt className="text-xs text-slate-500">Thu tiền</dt><dd><Badge tone={o.paid ? "green" : "amber"}>{o.paid ? `Đã thu ${fmtDate(o.paid_at)}` : "Chưa thu"}</Badge></dd></div>
            {o.note && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Ghi chú</dt><dd>{o.note}</dd></div>}
          </dl>
        </Card>
        <Card title="Khách hàng">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Tên</dt><dd className="font-medium"><Link className="link" to={`/customers/${o.customer_id}`}>{c?.name ?? "–"}</Link></dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Địa chỉ</dt><dd>{c?.address ?? "–"}</dd></div>
            <div><dt className="text-xs text-slate-500">Người liên hệ</dt><dd className="font-medium">{o.contact_name ?? c?.contact_name ?? "–"}</dd></div>
            <div><dt className="text-xs text-slate-500">Điện thoại</dt><dd className="font-medium tabular-nums">{o.contact_phone ?? c?.phone ?? "–"}</dd></div>
          </dl>
        </Card>
      </div>
      <Card title={`Phiếu công việc (${jobs.length})`} bodyClass="p-0">
        {jobs.length === 0 ? <Empty text="Đơn chưa có phiếu nào." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Phiếu</th><th>Thiết bị</th><th>Sê-ri</th><th>Loại PTĐ</th><th>Kiểm định viên</th><th>Trạng thái</th><th>GCN</th><th className="num">Giá</th><th></th></tr></thead>
              <tbody>
                {jobs.map((j) => {
                  const d = devices[j.device_id];
                  const cert = j.certificate_id ? certs.find((x) => x.id === j.certificate_id) : null;
                  return (
                    <tr key={j.id} className="cursor-pointer" onClick={() => nav(`/jobs/${j.id}`)}>
                      <td className="font-medium">{j.code}{j.priority === "urgent" && <Badge tone="red" className="ml-1">Gấp</Badge>}</td>
                      <td>{d?.name ?? "–"}<div className="text-xs text-slate-500">{JOB_KIND_LABEL[j.kind]}</div></td>
                      <td className="tabular-nums">{d?.serial ?? "–"}</td>
                      <td>{types[j.instrument_type_id]?.name ?? "–"}</td>
                      <td>{users.find((u) => u.id === j.assignee_id)?.full_name ?? <span className="text-slate-400">Chưa phân công</span>}</td>
                      <td><Badge tone={JOB_STATUS_TONE[j.status]}>{JOB_STATUS_LABEL[j.status]}</Badge></td>
                      <td onClick={(e) => e.stopPropagation()}>{cert ? <Link className="link tabular-nums" to={`/certificates/${cert.id}`}>{cert.number}</Link> : "–"}</td>
                      <td className="num">{money(j.price)}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {j.status === "issued" && can("orders") && <Button size="sm" variant="secondary" className="min-h-7" loading={busy === j.id} onClick={() => returnDevice(j.id)}>Trả thiết bị</Button>}
                        {j.status === "returned" && <span className="text-xs text-slate-500">Trả {fmtDate(j.returned_at)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
