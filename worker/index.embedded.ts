// Điểm vào Worker cho bản gói sẵn giao diện (xem scripts/embed-assets.mjs).
import { handleApi, type Env } from "./api";
import { ASSETS } from "./embedded/assets";

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const cache = new Map<string, Uint8Array>();

function serve(path: string): Response | null {
  const a = ASSETS[path];
  if (!a) return null;
  let body: string | Uint8Array;
  if (a.s !== undefined) body = a.s;
  else {
    let bin = cache.get(path);
    if (!bin) { bin = decode(a.b!); cache.set(path, bin); }
    body = bin;
  }
  const immutable = path.startsWith("/assets/");
  return new Response(body as BodyInit, {
    headers: {
      "content-type": a.t,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      const res = await handleApi(req, env);
      res.headers.set("x-content-type-options", "nosniff");
      return res;
    }
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
    const path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    // không có phần mở rộng → trang ứng dụng (định tuyến bằng #)
    return serve(path) ?? (/\.[a-z0-9]+$/i.test(path) ? new Response("Not Found", { status: 404 }) : serve("/index.html")!);
  },
};
