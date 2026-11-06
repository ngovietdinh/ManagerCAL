// Chủ đề "Cát" (sáng) / "Đêm" (tối). Mặc định theo hệ điều hành; người dùng chọn thì nhớ trong trình duyệt.
import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "managercal.theme";

const read = (): ThemePref => {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
};
const systemDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

export function applyTheme(pref: ThemePref = read()) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c0d11" : "#b49c82");
  return dark;
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    setDark(applyTheme(pref));
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const h = () => setDark(applyTheme("system"));
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [pref]);
  const toggle = useCallback(() => {
    const next: ThemePref = dark ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch { /* bỏ qua */ }
    setPref(next);
  }, [dark]);
  return { dark, toggle };
}
