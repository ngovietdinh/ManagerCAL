import clsx from "clsx";
import { Loader2, X, Inbox, AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import type { Tone } from "@/lib/labels";
import { errorMessage } from "@/lib/errors";
import { dayjs } from "@/lib/format";

// ---------------------------------------------------------------------------
// Nút
// ---------------------------------------------------------------------------
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}
export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "btn",
        size === "sm" && "min-h-8 px-3 text-xs",
        size === "md" && "min-h-10 px-4 text-sm",
        size === "lg" && "min-h-12 px-6 text-[15px]",
        variant === "primary" && "btn--primary",
        variant === "secondary" && "btn--secondary",
        variant === "ghost" && "btn--ghost",
        variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
        variant === "success" && "bg-brand-600 text-white hover:bg-brand-700",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
// Field cấp id cho ô nhập bên trong để nhãn gắn đúng ô (trình đọc màn hình đọc được, bấm nhãn chọn được ô)
const FieldCtx = createContext<{ id: string; describedBy?: string } | null>(null);
const useFieldProps = (id?: string) => {
  const f = useContext(FieldCtx);
  return { id: id ?? f?.id, "aria-describedby": f?.describedBy };
};

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  const id = useId();
  const msgId = hint || error ? `${id}-msg` : undefined;
  return (
    <FieldCtx.Provider value={{ id, describedBy: msgId }}>
      <div className={clsx("min-w-0", className)}>
        {label && <label className="label" htmlFor={id}>{label}</label>}
        {children}
        {hint && !error && <p id={msgId} className="mt-1 text-xs text-slate-500">{hint}</p>}
        {error && <p id={msgId} className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      </div>
    </FieldCtx.Provider>
  );
}

export function Input({ className, id, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...useFieldProps(id)} {...rest} className={clsx("input", className)} />;
}

export function NumberInput({ value, onChange, className, id, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null | undefined; onChange: (v: number) => void }) {
  const fieldProps = useFieldProps(id);
  // hiển thị có dấu phân cách hàng nghìn cho số tiền
  const [text, setText] = useState(value == null ? "" : new Intl.NumberFormat("vi-VN").format(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value == null ? "" : new Intl.NumberFormat("vi-VN").format(value));
  }, [value]);
  return (
    <input
      {...fieldProps}
      {...rest}
      inputMode="decimal"
      className={clsx("input text-right tabular-nums", className)}
      value={text}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(value == null ? "" : new Intl.NumberFormat("vi-VN").format(value)); }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
        onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

export function Textarea({ className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...useFieldProps(id)} {...rest} className={clsx("input", className)} />;
}

export function Select({ className, children, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...useFieldProps(id)} {...rest} className={clsx("input pr-8", className)}>{children}</select>;
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx("flex items-start gap-3", disabled ? "opacity-60" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      {(label || hint) && (
        <span className="text-sm">
          {label}
          {hint && <span className="block text-xs text-slate-500">{hint}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <label className={clsx("inline-flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="h-4 w-4 rounded accent-brand-700" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Ô chọn có tìm kiếm (danh sách nhân viên dài) */
export function SearchSelect<T extends { id: string }>({
  items, value, onChange, getLabel, getSub, placeholder = "Chọn…", allowClear = true, disabled,
}: {
  items: T[]; value: string | null | undefined; onChange: (id: string | null) => void;
  getLabel: (t: T) => string; getSub?: (t: T) => string; placeholder?: string; allowClear?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.id === value);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const filtered = useMemo(() => {
    const k = norm(q);
    return items.filter((i) => !k || norm(getLabel(i) + " " + (getSub?.(i) ?? "")).includes(k)).slice(0, 100);
  }, [items, q, getLabel, getSub]);
  return (
    <div className="relative min-w-0" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} className="input flex items-center justify-between text-left">
        <span className={clsx("truncate", !selected && "text-slate-400")}>{selected ? getLabel(selected) : placeholder}</span>
        {allowClear && selected && !disabled && (
          <X className="h-4 w-4 shrink-0 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); onChange(null); }} />
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="relative mb-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input autoFocus className="input pl-8" placeholder="Tìm…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 && <div className="p-3 text-center text-sm text-slate-500">Không có kết quả</div>}
            {filtered.map((i) => (
              <button type="button" key={i.id} onClick={() => { onChange(i.id); setOpen(false); setQ(""); }}
                className={clsx("block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800", i.id === value && "bg-brand-50 dark:bg-brand-900/30")}>
                <div className="truncate">{getLabel(i)}</div>
                {getSub && <div className="truncate text-xs text-slate-500">{getSub(i)}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hiển thị
// ---------------------------------------------------------------------------
export function Card({ className, children, title, actions, bodyClass }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode; bodyClass?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={clsx(bodyClass ?? "px-5 pb-5 pt-3", !(title || actions) && !bodyClass && "pt-5")}>{children}</div>
    </section>
  );
}

const TONES: Record<Tone, string> = {
  // nền nhạt + chữ đậm; một màu một nghĩa (ngọc = đạt, đỏ = quá hạn / không đạt, hổ phách = chờ)
  gray: "bg-[rgba(var(--ink-rgb),0.07)] text-slate-700 dark:text-slate-300",
  green: "bg-[#d6f5e4] text-[#0d6b4c] dark:bg-[rgba(61,220,151,0.16)] dark:text-[#7ee6b8]",
  red: "bg-[#fde1e1] text-[#a3242a] dark:bg-[rgba(255,122,92,0.18)] dark:text-[#ffb09a]",
  amber: "bg-[#fff0d4] text-[#8a5a00] dark:bg-[rgba(255,209,102,0.16)] dark:text-[#ffd982]",
  orange: "bg-[#ffe6d5] text-[#9a3d0c] dark:bg-[rgba(255,160,100,0.16)] dark:text-[#ffc29a]",
  blue: "bg-[#e3ecf7] text-[#24476f] dark:bg-[rgba(120,170,255,0.16)] dark:text-[#b2cdf7]",
  violet: "bg-[rgba(var(--ink-rgb),0.85)] text-[var(--chip)] dark:bg-[rgba(255,255,255,0.85)] dark:text-[#111215]",
  cyan: "bg-[#dcf1f1] text-[#165e60] dark:bg-[rgba(90,210,210,0.16)] dark:text-[#9fe3e3]",
  pink: "bg-[#fbe3ea] text-[#8c2a46] dark:bg-[rgba(255,140,170,0.16)] dark:text-[#ffb7c9]",
  none: "text-slate-500",
};
export const toneClass = (t: Tone) => TONES[t];

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex min-h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-[var(--c1)]", className)} />;
}

export function Loading({ text = "Đang tải…" }: { text?: string }) {
  return <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Spinner /> {text}</div>;
}

export function Empty({ text = "Chưa có dữ liệu", icon, action }: { text?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-slate-500">
      {icon ?? <Inbox className="h-8 w-8 opacity-40" />}
      <div>{text}</div>
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-[#f3c4c0] bg-[#fdecea] p-4 text-sm text-[#a3242a] dark:border-[rgba(255,122,92,0.35)] dark:bg-[rgba(255,122,92,0.12)] dark:text-[#ffb09a]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">{errorMessage(error)}</div>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function Stat({ label, value, tone = "gray", sub, icon, onClick, active }: { label: string; value: ReactNode; tone?: Tone; sub?: ReactNode; icon?: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={clsx("card flex min-h-[96px] flex-col gap-2 px-5 py-4 text-left transition disabled:cursor-default", onClick && "hover:shadow-lg", active && "ring-2 ring-[var(--c1)]")}>
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        {icon && <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-[9px] [&>svg]:h-4 [&>svg]:w-4", tone === "gray" ? "bg-[rgba(var(--ink-rgb),0.07)]" : TONES[tone])}>{icon}</span>}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--ink-3)]">{sub}</div>}
    </button>
  );
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  if (url) return <img src={url} alt={name} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />;
  return (
    // tông cát ấm, khác nhau nhẹ theo tên (không dùng tím/hồng làm màu nhấn – DESIGN.md)
    <div style={{ width: size, height: size, background: `hsl(${20 + (hue % 40)} 28% 84%)`, color: `hsl(${20 + (hue % 40)} 30% 24%)`, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold">{initials}</div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={clsx("glass flex gap-1 overflow-x-auto rounded-full p-1", className)}>
      {items.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={clsx("flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
            value === t.value ? "bg-[var(--chip)] text-[var(--chip-ink)] shadow-[0_4px_14px_rgba(var(--sh),0.16)]" : "text-[var(--ink-2)] hover:bg-[rgba(var(--hi),calc(0.4*var(--gk)))]")}>
          {t.label}
          {t.count != null && t.count > 0 && <span className="min-w-5 rounded-full bg-[var(--accent)] px-1.5 text-center text-[11px] leading-5 text-[var(--accent-ink)]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-[var(--ink-3)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const shift = (n: number) => onChange(dayjs(value + "-01").add(n, "month").format("YYYY-MM"));
  return (
    <div className="inline-flex min-h-10 items-center rounded-full border border-[var(--line-2)] bg-[rgba(var(--hi),calc(0.85*var(--gk)))] px-1">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[rgba(var(--ink-rgb),0.06)] sm:h-8 sm:w-8" onClick={() => shift(-1)} aria-label="Tháng trước"><ChevronLeft className="h-4 w-4" /></button>
      <input type="month" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="w-36 bg-transparent py-1.5 text-center text-sm outline-none" />
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[rgba(var(--ink-rgb),0.06)] sm:h-8 sm:w-8" onClick={() => shift(1)} aria-label="Tháng sau"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

export function DateNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const shift = (n: number) => onChange(dayjs(value).add(n, "day").format("YYYY-MM-DD"));
  return (
    <div className="inline-flex min-h-10 items-center rounded-full border border-[var(--line-2)] bg-[rgba(var(--hi),calc(0.85*var(--gk)))] px-1">
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[rgba(var(--ink-rgb),0.06)] sm:h-8 sm:w-8" onClick={() => shift(-1)} aria-label="Hôm trước"><ChevronLeft className="h-4 w-4" /></button>
      <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="bg-transparent py-1.5 text-center text-sm outline-none" />
      <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[rgba(var(--ink-rgb),0.06)] sm:h-8 sm:w-8" onClick={() => shift(1)} aria-label="Hôm sau"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hộp thoại
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[rgba(20,16,12,0.38)] backdrop-blur-[3px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={clsx("rise flex max-h-[92dvh] w-full min-w-0 max-w-full flex-col rounded-t-[22px] border border-[var(--edge)] bg-[var(--card-solid)] shadow-[0_24px_60px_rgba(var(--sh),0.28)] sm:rounded-[22px]",
        size === "sm" && "sm:max-w-sm", size === "md" && "sm:max-w-lg", size === "lg" && "sm:max-w-3xl", size === "xl" && "sm:max-w-6xl")}>
        <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-5">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="round" aria-label="Đóng"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-3">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pb-5 pt-3 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Thông báo nổi & hộp xác nhận
// ---------------------------------------------------------------------------
interface ToastItem { id: number; text: ReactNode; tone: "success" | "error" | "info" }
interface ConfirmState { title: string; message?: ReactNode; danger?: boolean; confirmText?: string; resolve: (v: boolean) => void }
interface UiCtx {
  toast: (text: ReactNode, tone?: ToastItem["tone"]) => void;
  error: (e: unknown) => void;
  confirm: (opts: Omit<ConfirmState, "resolve">) => Promise<boolean>;
}
const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirm] = useState<ConfirmState | null>(null);
  const toast = useCallback((text: ReactNode, tone: ToastItem["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  const error = useCallback((e: unknown) => toast(errorMessage(e), "error"), [toast]);
  const confirm = useCallback((opts: Omit<ConfirmState, "resolve">) => new Promise<boolean>((resolve) => setConfirm({ ...opts, resolve })), []);
  const value = useMemo(() => ({ toast, error, confirm }), [toast, error, confirm]);
  const close = (v: boolean) => { confirmState?.resolve(v); setConfirm(null); };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[2000] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={clsx("rise pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-[0_12px_30px_rgba(var(--sh),0.25)]",
            t.tone === "success" && "bg-[#0e7558]", t.tone === "error" && "bg-[#b42318]", t.tone === "info" && "bg-[#1b1b1d]")}>{t.text}</div>
        ))}
      </div>
      <Modal open={!!confirmState} onClose={() => close(false)} title={confirmState?.title} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => close(false)}>Huỷ</Button>
          <Button variant={confirmState?.danger ? "danger" : "primary"} onClick={() => close(true)}>{confirmState?.confirmText ?? "Đồng ý"}</Button>
        </>}>
        <div className="text-sm text-slate-600 dark:text-slate-300">{confirmState?.message}</div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useUi() {
  const c = useContext(Ctx);
  if (!c) throw new Error("UiProvider missing");
  return c;
}
