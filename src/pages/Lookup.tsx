import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "@/app/data";
import { Button, Input } from "@/components/ui";
import { fmtDate, todayStr } from "@/lib/format";
import { CERT_KIND_LABEL } from "@/lib/labels";
import type { Certificate } from "@/lib/types";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "notfound"; number: string } | { kind: "found"; cert: Certificate };

export default function Lookup() {
  const { number } = useParams();
  const nav = useNavigate();
  const { svc, me } = useData();
  const [q, setQ] = useState(number ?? "");
  const [state, setState] = useState<State>({ kind: "idle" });

  const search = async (n: string) => {
    const s = n.trim();
    if (!s) return;
    setState({ kind: "loading" });
    const cert = await svc.lookupCertificate(s);
    setState(cert ? { kind: "found", cert } : { kind: "notfound", number: s });
  };
  useEffect(() => { if (number) { setQ(number); search(number); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [number]);

  const verdict = (c: Certificate) => {
    const expired = c.valid_to != null && c.valid_to < todayStr();
    if (c.status === "revoked") return { cls: "border-red-300 bg-red-50 text-red-800", text: `Giấy chứng nhận ĐÃ BỊ THU HỒI${c.revoke_reason ? ` – ${c.revoke_reason}` : ""}.` };
    if (c.status === "replaced") return { cls: "border-amber-300 bg-amber-50 text-amber-800", text: "Giấy chứng nhận đã bị thay thế bởi bản khác. Hãy tra cứu số của bản thay thế." };
    if (c.kind === "fail_notice") return { cls: "border-red-300 bg-red-50 text-red-800", text: "Đây là thông báo kết quả KHÔNG ĐẠT, không phải giấy chứng nhận kiểm định." };
    if (expired) return { cls: "border-slate-300 bg-slate-100 text-slate-700", text: `Giấy chứng nhận hợp lệ nhưng ĐÃ HẾT HẠN từ ${fmtDate(c.valid_to)}.` };
    return { cls: "border-emerald-300 bg-emerald-50 text-emerald-800", text: `Giấy chứng nhận hợp lệ, còn hiệu lực đến ${fmtDate(c.valid_to)}.` };
  };

  return (
    <div className="flex min-h-dvh items-start justify-center p-4 pt-10">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center gap-3">
          <img src="./icons/icon.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Tra cứu giấy chứng nhận kiểm định</h1>
            <p className="text-sm text-slate-500">Nhập số ghi trên giấy chứng nhận hoặc quét mã QR.</p>
          </div>
        </div>
        <form className="card flex gap-2 p-3" onSubmit={(e) => { e.preventDefault(); nav(`/lookup/${encodeURIComponent(q.trim())}`); search(q); }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ví dụ: 00012/26/KĐ-HN" aria-label="Số giấy chứng nhận" />
          <Button type="submit" icon={<Search className="h-4 w-4" />} loading={state.kind === "loading"}>Tra cứu</Button>
        </form>

        {state.kind === "notfound" && (
          <div className="mt-4 rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">Không tìm thấy giấy chứng nhận số <b>{state.number}</b>. Hãy kiểm tra lại số hoặc liên hệ đơn vị kiểm định.</div>
        )}
        {state.kind === "found" && (() => {
          const c = state.cert; const v = verdict(c); const s = c.snapshot;
          return (
            <div className="mt-4 space-y-3">
              <div className={`rounded-xl border p-4 text-sm font-medium ${v.cls}`}>{v.text}</div>
              <div className="card p-4">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Loại", CERT_KIND_LABEL[c.kind]], ["Số", c.number], ["Thiết bị", s.device.name], ["Kiểu", s.device.model ?? "–"], ["Số sê-ri", s.device.serial ?? "–"],
                      ["Đơn vị sử dụng", s.customer.name], ["Đơn vị kiểm định", s.company.name], ["Ngày cấp", fmtDate(c.issued_at)], ["Hiệu lực đến", fmtDate(c.valid_to)],
                    ].map(([k, val]) => (
                      <tr key={k} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="py-1.5 pr-3 text-slate-500">{k}</td><td className="py-1.5 font-medium">{val}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        <div className="mt-6 text-sm">
          <Link className="link" to={me ? "/" : "/login"}>← {me ? "Về ứng dụng" : "Đăng nhập ứng dụng"}</Link>
        </div>
      </div>
    </div>
  );
}
