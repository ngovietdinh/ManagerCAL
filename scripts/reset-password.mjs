// Đặt lại mật khẩu trực tiếp trong CSDL D1 – dùng khi QUẢN TRỊ quên mật khẩu (nhân viên thường thì
// quản trị đặt lại trong app: Nhân sự, ủy quyền → Mật khẩu).
//
//   npm run reset-password -- email@congty.vn            # sinh mật khẩu tạm ngẫu nhiên
//   npm run reset-password -- email@congty.vn MatKhauMoi  # đặt mật khẩu chỉ định (≥ 8 ký tự)
//   thêm --local [--persist-to <thư mục>] để chạy trên D1 giả lập tại máy
//
// Cần quyền vào tài khoản Cloudflare (CLOUDFLARE_API_TOKEN có quyền D1, hoặc `npx wrangler login`).
// Mọi phiên đăng nhập cũ của người đó bị đăng xuất; khoá tạm do sai mật khẩu được gỡ.
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const local = args.includes("--local");
if (local) args.splice(args.indexOf("--local"), 1);
const persist = flag("--persist-to");
const [email, given] = args;
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Cách dùng: npm run reset-password -- email@congty.vn [mật-khẩu-mới] [--local]");
  process.exit(1);
}
if (given && given.length < 8) { console.error("Mật khẩu phải có ít nhất 8 ký tự."); process.exit(1); }

// mật khẩu tạm dễ đọc: bỏ ký tự dễ nhầm (0/O, 1/l/I)
const ALPHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const temp = () => Array.from(randomBytes(12), (b) => ALPHA[b % ALPHA.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
const password = given ?? temp();

// cùng định dạng với worker/auth.ts: PBKDF2-SHA256, salt 16 byte, 256 bit, lưu hex
const ITER = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITER, 32, "sha256").toString("hex");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const now = new Date().toISOString();
const userSel = `SELECT id FROM rows WHERE tbl = 'users' AND lower(json_extract(data, '$.email')) = lower(${q(email.trim())})`;

const wrangler = (sql) => {
  const a = ["wrangler", "d1", "execute", "managercal", local ? "--local" : "--remote", "--json", "--command", sql];
  if (persist) a.push("--persist-to", persist);
  const out = execFileSync("npx", a, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  return JSON.parse(out);
};

const found = wrangler(`SELECT id, json_extract(data, '$.full_name') AS name, json_extract(data, '$.active') AS active FROM rows WHERE tbl = 'users' AND lower(json_extract(data, '$.email')) = lower(${q(email.trim())})`)[0]?.results ?? [];
if (!found.length) { console.error(`Không có người dùng nào có email ${email}.`); process.exit(1); }
const u = found[0];

wrangler([
  `INSERT INTO auth_passwords (user_id, salt, hash, iterations, updated_at) SELECT id, ${q(salt.toString("hex"))}, ${q(hash)}, ${ITER}, ${q(now)} FROM (${userSel}) WHERE true ` +
    `ON CONFLICT (user_id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, iterations = excluded.iterations, updated_at = excluded.updated_at`,
  `DELETE FROM auth_sessions WHERE user_id IN (${userSel})`,
  `DELETE FROM auth_failures WHERE email = lower(${q(email.trim())})`,
].join("; "));

console.log(`\nĐã đặt lại mật khẩu cho ${u.name} (${email})${u.active ? "" : " – LƯU Ý: tài khoản này đang bị khoá (không hoạt động)"}.`);
if (!given) console.log(`Mật khẩu tạm: ${password}\nĐăng nhập rồi đổi ngay (bấm ảnh đại diện → Đổi mật khẩu).`);
