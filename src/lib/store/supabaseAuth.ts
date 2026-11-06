// Đăng nhập bằng email/mật khẩu trên Supabase Auth; hồ sơ nhân viên ở bảng users (cột auth_id).
import type { User } from "../types";
import { AppError } from "./repo";
import { supabase } from "./supabase";

export async function signIn(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new AppError(error.message === "Invalid login credentials" ? "BAD_CREDENTIALS" : error.message, "Sai email hoặc mật khẩu.");
  return data.user.id;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Gọi fn mỗi khi phiên đăng nhập đổi (đăng nhập, đăng xuất, làm mới token) */
export function onAuthChange(fn: (authId: string | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session?.user.id ?? null));
  return () => data.subscription.unsubscribe();
}

/** Hồ sơ nhân viên gắn với tài khoản đăng nhập; null nếu chưa gắn hoặc đã khoá (RLS trả về rỗng) */
export async function getMyProfile(authId: string): Promise<User | null> {
  const { data, error } = await supabase.from("users").select("*").eq("auth_id", authId).maybeSingle();
  if (error) throw new AppError(error.code ?? "DB_ERROR", error.message);
  return (data as User | null) ?? null;
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new AppError(error.message);
}
