// Cài đặt: email thông báo giao việc, dung lượng dữ liệu (ước tính bao lâu thì đầy)
import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "@/app/data";
import { Badge, Button, Card, Field, Input, Loading, NumberInput, Select, Toggle, useUi } from "@/components/ui";
import { FREE_LIMIT, PAID_LIMIT, analyzeStorage, fmtBytes, fmtMonths, monthsUntilFull, statsFromData, type StorageInfo } from "@/lib/storage";

interface EmailCfg { configured: boolean; enabled: boolean; provider: "brevo" | "resend"; from_email: string; from_name: string; key_hint: string }

export function EmailCard() {
  const { api, mode } = useData();
  const ui = useUi();
  const [cfg, setCfg] = useState<EmailCfg | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  useEffect(() => { if (api) api.request<EmailCfg>("/admin/email").then(setCfg).catch(ui.error); }, [api, ui]);

  if (mode !== "server") {
    return (
      <Card title="Email thông báo">
        <p className="text-sm text-[var(--ink-2)]">Gửi email khi giao việc chỉ có ở chế độ máy chủ (Cloudflare). Ở chế độ demo, thông báo hiện trong ứng dụng.</p>
      </Card>
    );
  }
  if (!cfg) return <Card title="Email thông báo"><Loading /></Card>;

  const save = async () => {
    setBusy("save");
    try {
      const r = await api!.post<EmailCfg>("/admin/email", { provider: cfg.provider, from_email: cfg.from_email, from_name: cfg.from_name, enabled: cfg.enabled, api_key: key });
      setCfg(r); setKey("");
      ui.toast("Đã lưu cấu hình email");
    } catch (e) { ui.error(e); } finally { setBusy(null); }
  };
  const test = async () => {
    setBusy("test");
    try { const r = await api!.post<{ to: string }>("/admin/email/test", {}); ui.toast(`Đã gửi thư thử tới ${r.to}`); } catch (e) { ui.error(e); } finally { setBusy(null); }
  };

  return (
    <Card title="Email thông báo" actions={<Badge tone={cfg.configured && cfg.enabled ? "green" : "gray"}>{cfg.configured ? (cfg.enabled ? "Đang gửi" : "Đã tắt") : "Chưa cấu hình"}</Badge>}>
      <p className="mb-3 text-sm text-[var(--ink-2)]">
        Gửi email cho người nhận khi: được phân công phiếu, có phiếu chờ soát xét / chờ ký, phiếu bị trả lại, đơn mới chờ phân công, đồng nghiệp nhờ việc trong chat.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dịch vụ gửi thư">
          <Select value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value as EmailCfg["provider"] })}>
            <option value="brevo">Brevo – 300 thư/ngày miễn phí, không cần tên miền</option>
            <option value="resend">Resend – cần tên miền riêng</option>
          </Select>
        </Field>
        <Field label="Khoá API" hint={cfg.key_hint ? `Đã lưu ${cfg.key_hint}. Để trống nếu không đổi.` : "Không hiển thị lại sau khi lưu."}>
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={cfg.key_hint || "Dán khoá API"} />
        </Field>
        <Field label="Email người gửi" hint={cfg.provider === "brevo" ? "Địa chỉ đã xác minh trong Brevo (Senders)" : "Thuộc tên miền đã xác minh trong Resend"}>
          <Input type="email" value={cfg.from_email} onChange={(e) => setCfg({ ...cfg, from_email: e.target.value })} placeholder="ten@congty.vn" />
        </Field>
        <Field label="Tên người gửi"><Input value={cfg.from_name} onChange={(e) => setCfg({ ...cfg, from_name: e.target.value })} placeholder="KĐ QT Việt" /></Field>
      </div>
      <div className="mt-3"><Toggle checked={cfg.enabled} onChange={(v) => setCfg({ ...cfg, enabled: v })} label="Bật gửi email thông báo" /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={busy === "save"} onClick={save}>Lưu cấu hình email</Button>
        <Button variant="secondary" loading={busy === "test"} disabled={!cfg.configured} onClick={test}>Gửi thư thử cho tôi</Button>
      </div>
      <details className="mt-3 text-xs text-[var(--ink-2)]">
        <summary className="cursor-pointer font-semibold">Cách lấy khoá Brevo (5 phút)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Đăng ký miễn phí tại brevo.com.</li>
          <li>Senders, Domains & Dedicated IPs → Senders → thêm email gửi (vd. Gmail của công ty) và bấm xác minh trong thư Brevo gửi tới.</li>
          <li>SMTP & API → API Keys → Generate a new API key, dán vào ô Khoá API ở trên.</li>
          <li>Lưu, rồi bấm "Gửi thư thử cho tôi". Thư gửi từ Gmail qua dịch vụ khác có thể vào mục Spam lần đầu: đánh dấu "Không phải spam".</li>
        </ol>
      </details>
    </Card>
  );
}

const TABLE_LABEL: Record<string, string> = {
  jobs: "Phiếu công việc", certificates: "Giấy chứng nhận", orders: "Đơn hàng", audit_logs: "Nhật ký thao tác", notifications: "Thông báo",
  seals: "Tem", devices: "Thiết bị của khách", customers: "Khách hàng", procedures: "Quy trình, mẫu biên bản", chat_messages: "Tin nhắn",
  chat_channels: "Cuộc trò chuyện", chat_reads: "Đánh dấu đã đọc", standards: "Chuẩn", users: "Nhân sự", authorizations: "Ủy quyền",
  instrument_types: "Loại phương tiện đo", fields: "Lĩnh vực", settings: "Cài đặt", branches: "Chi nhánh", seal_batches: "Lô tem",
};

export function StorageCard() {
  const { api, repo, mode } = useData();
  const ui = useUi();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [jobsPm, setJobsPm] = useState<number | null>(null);
  const [msgsPd, setMsgsPd] = useState<number | null>(null);
  const [plan, setPlan] = useState<"free" | "paid">("free");
  const load = useCallback(async () => {
    try {
      if (api) setInfo(await api.request<StorageInfo>("/admin/storage"));
      else {
        const r = repo as unknown as { exportAll?: () => { data: Record<string, { created_at?: string }[]> } };
        if (r.exportAll) setInfo(statsFromData(r.exportAll().data));
      }
    } catch (e) { ui.error(e); }
  }, [api, repo, ui]);
  useEffect(() => { load(); }, [load]);
  const a = useMemo(() => (info ? analyzeStorage(info) : null), [info]);
  useEffect(() => {
    if (!a) return;
    setJobsPm((v) => v ?? Math.max(a.jobsPerMonth, 1));
    setMsgsPd((v) => v ?? Math.max(Math.round(a.msgsPerMonth / 30), 1));
  }, [a]);

  if (!info || !a) return <Card title="Dung lượng dữ liệu"><Loading /></Card>;
  const limit = plan === "free" ? FREE_LIMIT : PAID_LIMIT;
  const months = monthsUntilFull(a, limit, jobsPm ?? 0, (msgsPd ?? 0) * 30);
  const pct = Math.min(100, (a.size / limit) * 100);
  const top = [...info.tables].sort((x, y) => y.bytes - x.bytes).slice(0, 8);

  return (
    <Card title="Dung lượng dữ liệu" className="lg:col-span-2" actions={<Button size="sm" variant="secondary" onClick={load}>Đo lại</Button>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span><b className="text-[22px] tabular-nums">{fmtBytes(a.size)}</b> / {fmtBytes(limit)}</span>
            <span className="tabular-nums text-[var(--ink-2)]">{pct < 0.1 ? "< 0,1" : pct.toFixed(1).replace(".", ",")} %</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[rgba(var(--ink-rgb),0.08)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Đã dùng">
            <div className="h-full rounded-full bg-[var(--c1)]" style={{ width: `${Math.max(pct, 0.6)}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--ink-3)]">
            {mode === "server" ? "Kích thước thật của CSDL D1" : "Ước tính từ dữ liệu demo trong trình duyệt"} · đo được mỗi phiếu ≈ <b>{fmtBytes(a.perJob)}</b> (phiếu, GCN, đơn, nhật ký, thông báo), mỗi tin nhắn ≈ <b>{fmtBytes(a.perMsg)}</b>, hệ số chỉ mục ×{a.overhead.toFixed(1).replace(".", ",")}.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Số phiếu mỗi tháng"><NumberInput value={jobsPm} onChange={setJobsPm} /></Field>
            <Field label="Tin nhắn mỗi ngày"><NumberInput value={msgsPd} onChange={setMsgsPd} /></Field>
            <Field label="Gói Cloudflare">
              <Select value={plan} onChange={(e) => setPlan(e.target.value as "free" | "paid")}><option value="free">Miễn phí (500 MB)</option><option value="paid">Trả phí (10 GB)</option></Select>
            </Field>
          </div>
          <div className="mt-3 rounded-2xl bg-[rgba(var(--ink-rgb),0.05)] p-4 text-sm" data-testid="storage-forecast">
            Với <b>{jobsPm ?? 0} phiếu/tháng</b> và <b>{msgsPd ?? 0} tin nhắn/ngày</b>, CSDL đầy sau <b>{fmtMonths(months)}</b>.
          </div>
          <p className="mt-2 text-xs text-[var(--ink-3)]">
            Giới hạn khác của gói miễn phí: 5 triệu dòng đọc mỗi ngày. Danh sách phiếu đọc toàn bộ phiếu mỗi lần mở, nên khi đã có vài nghìn phiếu
            và nhiều người cùng làm, nên chuyển gói trả phí (5 USD/tháng: 10 GB, 25 tỉ dòng đọc/tháng) trước khi chạm giới hạn đọc.
          </p>
        </div>
        <div className="table-wrap">
          <table className="table table--grid">
            <thead><tr><th>Bảng</th><th className="num">Số dòng</th><th className="num">Dữ liệu</th><th className="num">30 ngày qua</th></tr></thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.tbl}><td>{TABLE_LABEL[t.tbl] ?? t.tbl}</td><td className="num">{t.n.toLocaleString("vi-VN")}</td><td className="num">{fmtBytes(t.bytes)}</td><td className="num">+{t.n30.toLocaleString("vi-VN")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
