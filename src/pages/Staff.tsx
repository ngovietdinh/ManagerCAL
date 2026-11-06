import clsx from "clsx";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useData, useIndex, useTable } from "@/app/data";
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Toggle, useUi } from "@/components/ui";
import { dayjs, fmtDate, todayStr } from "@/lib/format";
import { AUTH_ROLE_LABEL, ROLES, ROLE_LABEL } from "@/lib/labels";
import PasswordModal from "@/components/PasswordModal";
import type { AuthRole, Authorization, Role, User } from "@/lib/types";

type UserForm = Omit<User, "id" | "created_at">;
const emptyUser = (): UserForm => ({ code: "", full_name: "", email: "", phone: null, roles: [], branch_id: null, title: null, inspector_card_no: null, inspector_card_expiry: null, active: true });

function cardTone(expiry: string | null): "red" | "amber" | "gray" {
  if (!expiry) return "gray";
  const days = dayjs(expiry).diff(dayjs(todayStr()), "day");
  return days < 0 ? "red" : days <= 60 ? "amber" : "gray";
}

export default function Staff() {
  const [tab, setTab] = useState<"users" | "matrix">("users");
  return (
    <>
      <PageHeader title="Nhân sự, ủy quyền" subtitle="Hồ sơ kiểm định viên, thẻ kiểm định viên và ma trận ủy quyền theo lĩnh vực đo" />
      <Tabs value={tab} onChange={setTab} className="mb-4 w-fit max-w-full" items={[{ value: "users", label: "Nhân sự" }, { value: "matrix", label: "Ma trận ủy quyền" }]} />
      {tab === "users" ? <UsersTab /> : <MatrixTab />}
    </>
  );
}

function UsersTab() {
  const { svc, me, can, api } = useData();
  const [pwFor, setPwFor] = useState<{ id: string; full_name: string } | null>(null);
  const ui = useUi();
  const { rows, loading } = useTable("users", { orderBy: { field: "code" } });
  const branches = useIndex("branches");
  const { rows: branchList } = useTable("branches");
  const [edit, setEdit] = useState<{ id: string | null; form: UserForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = can("users");

  const save = async () => {
    if (!edit) return;
    const f = edit.form;
    if (!f.code.trim() || !f.full_name.trim()) { ui.toast("Cần nhập mã và họ tên", "error"); return; }
    if (edit.id === me?.id && me?.roles.includes("admin") && !f.roles.includes("admin")) { ui.toast("Không thể tự bỏ quyền Quản trị của chính mình", "error"); return; }
    setSaving(true);
    try {
      if (edit.id) await svc.patch("users", "users", edit.id, f);
      else {
        const created = await svc.create("users", "users", f);
        // chế độ máy chủ: người mới cần mật khẩu để đăng nhập
        if (api && created) setPwFor({ id: created.id, full_name: created.full_name });
      }
      ui.toast("Đã lưu");
      setEdit(null);
    } catch (e) { ui.error(e); } finally { setSaving(false); }
  };
  const setF = (p: Partial<UserForm>) => setEdit((s) => (s ? { ...s, form: { ...s.form, ...p } } : s));

  return (
    <>
      <div className="mb-3 flex justify-end">{editable && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ id: null, form: emptyUser() })}>Thêm nhân sự</Button>}</div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Chưa có nhân sự." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Mã</th><th>Họ tên</th><th>Chức danh</th><th>Vai trò</th><th>Chi nhánh</th><th>Số thẻ KĐV</th><th>Hạn thẻ</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-xs">{u.code}</td>
                  <td className="font-medium">{u.full_name}<div className="text-xs font-normal text-slate-500">{u.email}</div></td>
                  <td>{u.title ?? "–"}</td>
                  <td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone={r === "admin" ? "violet" : r === "signer" ? "blue" : "gray"}>{ROLE_LABEL[r]}</Badge>)}</div></td>
                  <td>{u.branch_id ? branches[u.branch_id]?.name ?? "–" : "–"}</td>
                  <td className="font-mono text-xs">{u.inspector_card_no ?? "–"}</td>
                  <td>{u.inspector_card_expiry ? <Badge tone={cardTone(u.inspector_card_expiry)}>{fmtDate(u.inspector_card_expiry)}</Badge> : "–"}</td>
                  <td><Badge tone={u.active ? "green" : "red"}>{u.active ? "Hoạt động" : "Khoá"}</Badge></td>
                  <td className="whitespace-nowrap text-right">{editable && <>
                    {api && <Button size="sm" variant="ghost" className="min-h-7" onClick={() => setPwFor({ id: u.id, full_name: u.full_name })}>Mật khẩu</Button>}
                    <Button size="sm" variant="ghost" className="min-h-7" onClick={() => { const { id, created_at: _c, ...form } = u; void _c; setEdit({ id, form }); }}>Sửa</Button>
                  </>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pwFor && <PasswordModal user={pwFor} onClose={() => setPwFor(null)} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Sửa nhân sự" : "Thêm nhân sự"} size="lg"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Huỷ</Button><Button loading={saving} onClick={save}>Lưu</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã nhân viên"><Input value={edit.form.code} onChange={(e) => setF({ code: e.target.value })} /></Field>
            <Field label="Họ tên"><Input value={edit.form.full_name} onChange={(e) => setF({ full_name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={edit.form.email} onChange={(e) => setF({ email: e.target.value })} /></Field>
            <Field label="Số điện thoại"><Input value={edit.form.phone ?? ""} onChange={(e) => setF({ phone: e.target.value || null })} /></Field>
            <Field label="Chức danh"><Input value={edit.form.title ?? ""} onChange={(e) => setF({ title: e.target.value || null })} /></Field>
            <Field label="Chi nhánh">
              <Select value={edit.form.branch_id ?? ""} onChange={(e) => setF({ branch_id: e.target.value || null })}>
                <option value="">– Không –</option>{branchList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Số thẻ kiểm định viên"><Input value={edit.form.inspector_card_no ?? ""} onChange={(e) => setF({ inspector_card_no: e.target.value || null })} /></Field>
            <Field label="Hạn thẻ"><Input type="date" value={edit.form.inspector_card_expiry ?? ""} onChange={(e) => setF({ inspector_card_expiry: e.target.value || null })} /></Field>
            <Field label="Vai trò" className="sm:col-span-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ROLES.map((r: Role) => (
                  <Checkbox key={r} label={ROLE_LABEL[r]} checked={edit.form.roles.includes(r)}
                    onChange={(v) => setF({ roles: v ? [...edit.form.roles, r] : edit.form.roles.filter((x) => x !== r) })} />
                ))}
              </div>
            </Field>
            <div className="sm:col-span-2"><Toggle checked={edit.form.active} onChange={(v) => setF({ active: v })} label="Đang hoạt động" hint="Tài khoản bị khoá không đăng nhập, không được phân công." /></div>
          </div>
        )}
      </Modal>
    </>
  );
}

const CHIP: Record<AuthRole, { letter: string; cls: string }> = {
  perform: { letter: "T", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  review: { letter: "S", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  sign: { letter: "K", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
};

function MatrixTab() {
  const { svc, can } = useData();
  const ui = useUi();
  const { rows: users } = useTable("users", { orderBy: { field: "code" } });
  const { rows: fields } = useTable("fields", { orderBy: { field: "code" } });
  const { rows: auths, loading } = useTable("authorizations");
  const [cell, setCell] = useState<{ user: User; field_id: string } | null>(null);
  const [form, setForm] = useState<{ role: AuthRole; decision_no: string; valid_from: string; valid_to: string }>({ role: "perform", decision_no: "", valid_from: todayStr(), valid_to: "" });
  const editable = can("users");
  const today = todayStr();
  const techUsers = useMemo(() => users.filter((u) => u.active && u.roles.some((r) => ["technician", "reviewer", "signer"].includes(r))), [users]);
  const byCell = useMemo(() => {
    const m: Record<string, Authorization[]> = {};
    for (const a of auths) (m[`${a.user_id}|${a.field_id}`] ??= []).push(a);
    return m;
  }, [auths]);
  const isLive = (a: Authorization) => a.valid_from <= today && (!a.valid_to || a.valid_to >= today);
  const cellAuths = cell ? (byCell[`${cell.user.id}|${cell.field_id}`] ?? []) : [];
  const fieldName = (id: string) => fields.find((f) => f.id === id)?.name ?? id;

  const add = async () => {
    if (!cell) return;
    try {
      await svc.create("users", "authorizations", { user_id: cell.user.id, field_id: cell.field_id, role: form.role, decision_no: form.decision_no || null, valid_from: form.valid_from, valid_to: form.valid_to || null });
      ui.toast("Đã thêm ủy quyền");
      setForm((f) => ({ ...f, decision_no: "", valid_to: "" }));
    } catch (e) { ui.error(e); }
  };
  const remove = async (a: Authorization) => {
    if (!(await ui.confirm({ title: "Xoá ủy quyền?", message: `${AUTH_ROLE_LABEL[a.role]} – ${fieldName(a.field_id)}`, danger: true, confirmText: "Xoá" }))) return;
    try { await svc.delete("users", "authorizations", a.id); ui.toast("Đã xoá"); } catch (e) { ui.error(e); }
  };

  return (
    <>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Phần mềm kiểm tra ma trận này ở mọi bước: phân công, nộp, soát xét, ký. Ô có chữ <b>T</b> thực hiện, <b>S</b> soát xét, <b>K</b> ký GCN; chip mờ là ủy quyền đã hết hạn hoặc chưa đến ngày hiệu lực.</p>
      {loading ? <Loading /> : techUsers.length === 0 ? <Empty text="Chưa có kiểm định viên, người soát xét hay người ký." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Nhân sự</th>{fields.map((f) => <th key={f.id} className="text-center" title={f.name}>{f.code}<div className="font-normal normal-case text-slate-400">{f.name}</div></th>)}</tr></thead>
            <tbody>
              {techUsers.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap font-medium">{u.full_name}<div className="text-xs font-normal text-slate-500">{u.roles.map((r) => ROLE_LABEL[r]).join(", ")}</div></td>
                  {fields.map((f) => {
                    const list = byCell[`${u.id}|${f.id}`] ?? [];
                    return (
                      <td key={f.id} className="text-center">
                        <button type="button" disabled={!editable} onClick={() => setCell({ user: u, field_id: f.id })}
                          className={clsx("inline-flex min-h-8 min-w-12 items-center justify-center gap-1 rounded-lg px-1.5 py-1", editable && "hover:bg-slate-100 dark:hover:bg-slate-800")} aria-label={`${u.full_name} – ${f.name}`}>
                          {list.length === 0 && <span className="text-slate-300">–</span>}
                          {(["perform", "review", "sign"] as AuthRole[]).filter((r) => list.some((a) => a.role === r)).map((r) => {
                            const live = list.some((a) => a.role === r && isLive(a));
                            return <span key={r} className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold", CHIP[r].cls, !live && "opacity-40")} title={`${AUTH_ROLE_LABEL[r]}${live ? "" : " (hết hạn)"}`}>{CHIP[r].letter}</span>;
                          })}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!cell} onClose={() => setCell(null)} title={cell ? `${cell.user.full_name} · ${fieldName(cell.field_id)}` : ""} size="lg">
        {cell && (
          <>
            {cellAuths.length === 0 ? <p className="mb-3 text-sm text-slate-500">Chưa có ủy quyền nào trong lĩnh vực này.</p> : (
              <div className="table-wrap"><table className="table mb-4">
                <thead><tr><th>Vai trò</th><th>Số quyết định</th><th>Từ ngày</th><th>Đến ngày</th><th></th></tr></thead>
                <tbody>
                  {cellAuths.map((a) => (
                    <tr key={a.id} className={isLive(a) ? "" : "text-slate-400"}>
                      <td><Badge tone={isLive(a) ? (a.role === "sign" ? "green" : a.role === "review" ? "amber" : "blue") : "gray"}>{AUTH_ROLE_LABEL[a.role]}</Badge></td>
                      <td>{a.decision_no ?? "–"}</td>
                      <td>{fmtDate(a.valid_from)}</td>
                      <td>{a.valid_to ? fmtDate(a.valid_to) : "Không thời hạn"}</td>
                      <td className="text-right"><Button size="sm" variant="ghost" onClick={() => remove(a)}>Xoá</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
            <Card title="Thêm ủy quyền">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Vai trò"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AuthRole })}>{(Object.keys(AUTH_ROLE_LABEL) as AuthRole[]).map((r) => <option key={r} value={r}>{AUTH_ROLE_LABEL[r]}</option>)}</Select></Field>
                <Field label="Số quyết định"><Input value={form.decision_no} onChange={(e) => setForm({ ...form, decision_no: e.target.value })} placeholder="15/QĐ-…" /></Field>
                <Field label="Từ ngày"><Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></Field>
                <Field label="Đến ngày" hint="Bỏ trống = không thời hạn"><Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} /></Field>
              </div>
              <div className="mt-3 flex justify-end"><Button onClick={add} disabled={!form.valid_from}>Thêm</Button></div>
            </Card>
          </>
        )}
      </Modal>
    </>
  );
}
