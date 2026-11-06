// Gói giao diện (dist/) vào thẳng mã Worker – dùng khi không tải được tệp tĩnh lên Cloudflare theo cách thường
// (vd. môi trường có proxy ghi đè header Authorization). Sinh:
//   worker/embedded/assets.ts         bảng đường dẫn → nội dung
//   wrangler.embedded.json            cấu hình như wrangler.jsonc nhưng không dùng "assets", main = worker/index.embedded.ts
// Dùng: npm run deploy:embedded
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
};
const TEXT = new Set([".html", ".js", ".css", ".svg", ".json", ".webmanifest", ".txt"]);
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

const entries = [];
for (const file of walk(dist)) {
  const rel = "/" + relative(dist, file).split("\\").join("/");
  if (rel === "/_headers" || rel === "/_redirects") continue;
  const ext = extname(file);
  const type = TYPES[ext] ?? "application/octet-stream";
  const buf = readFileSync(file);
  entries.push(TEXT.has(ext) ? `${JSON.stringify(rel)}:{t:${JSON.stringify(type)},s:${JSON.stringify(buf.toString("utf8"))}}` : `${JSON.stringify(rel)}:{t:${JSON.stringify(type)},b:${JSON.stringify(buf.toString("base64"))}}`);
}
mkdirSync(join(root, "worker/embedded"), { recursive: true });
writeFileSync(join(root, "worker/embedded/assets.ts"),
  "// TỆP SINH TỰ ĐỘNG bởi scripts/embed-assets.mjs – không sửa tay\n" +
  "export const ASSETS: Record<string, { t: string; s?: string; b?: string }> = {\n" + entries.join(",\n") + "\n};\n");

// cấu hình wrangler cho bản gói sẵn, lấy từ wrangler.jsonc (bỏ chú thích)
const conf = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
delete conf.assets;
delete conf.$schema;
conf.main = "worker/index.embedded.ts";
writeFileSync(join(root, "wrangler.embedded.json"), JSON.stringify(conf, null, 2) + "\n");
console.log(`Đã gói ${entries.length} tệp vào worker/embedded/assets.ts`);
