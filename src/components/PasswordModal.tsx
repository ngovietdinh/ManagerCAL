import { useState } from "react";
import { useData } from "@/app/data";
import { Button, Field, Input, Modal, useUi } from "@/components/ui";
import { errorMessage } from "@/lib/errors";

/** Đổi mật khẩu của mình (cần mật khẩu hiện tại) hoặc đặt mật khẩu cho người khác (quyền Nhân sự). Chỉ có ở chế độ máy chủ. */
export default function PasswordModal({ user, onClose }: { user: { id: string; full_name: string }; onClose: () => void }) {
  const { api, me } = useData();
  const ui = useUi();
  const self = user.id === me?.id;
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (pw.length < 8) { setErr("Mật khẩu phải có ít nhất 8 ký tự."); return; }
    if (pw !== pw2) { setErr("Hai lần nhập không khớp."); return; }
    setBusy(true); setErr(null);
    try {
      await api!.post("/password", self ? { password: pw, current } : { user_id: user.id, password: pw });
      ui.toast(self ? "Đã đổi mật khẩu" : `Đã đặt mật khẩu cho ${user.full_name}`);
      onClose();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title={self ? "Đổi mật khẩu" : `Đặt mật khẩu cho ${user.full_name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={busy} onClick={submit}>Lưu mật khẩu</Button></>}>
      <div className="grid gap-3">
        {self && <Field label="Mật khẩu hiện tại"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>}
        <Field label="Mật khẩu mới (ít nhất 8 ký tự)"><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Nhập lại mật khẩu mới" error={err}><Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {!self && <p className="text-xs text-slate-500">Người này sẽ bị đăng xuất khỏi mọi thiết bị và phải đăng nhập lại bằng mật khẩu mới.</p>}
      </div>
    </Modal>
  );
}
