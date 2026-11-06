// Tạo CSDL D1 "managercal" trên Cloudflare (nếu chưa có) và ghi database_id vào wrangler.jsonc.
// Chạy một lần trước lần deploy đầu tiên: `npm run cf:setup`
// Cần: biến CLOUDFLARE_API_TOKEN (quyền Workers Scripts: Edit, D1: Edit) và CLOUDFLARE_ACCOUNT_ID,
//      hoặc đã `npx wrangler login`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const NAME = "managercal";
const wrangler = (...args) => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

let list = [];
try { list = JSON.parse(wrangler("d1", "list", "--json")); } catch { console.error("Không đọc được danh sách D1. Kiểm tra token / đăng nhập wrangler."); process.exit(1); }
let db = list.find((d) => d.name === NAME);
if (!db) {
  console.log(`Tạo CSDL D1 "${NAME}" (vùng Châu Á – Thái Bình Dương)…`);
  const out = wrangler("d1", "create", NAME, "--location", "apac");
  const id = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
  if (!id) { console.error(out); process.exit(1); }
  db = { uuid: id, name: NAME };
}
const id = db.uuid ?? db.id;
const path = new URL("../wrangler.jsonc", import.meta.url);
writeFileSync(path, readFileSync(path, "utf8").replace(/"database_id":\s*"[^"]*"/, `"database_id": "${id}"`));
console.log(`Đã ghi database_id = ${id} vào wrangler.jsonc. Tiếp theo: npm run deploy`);
