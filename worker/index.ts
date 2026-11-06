// Điểm vào Cloudflare Worker: /api/* do API xử lý, còn lại trả tệp tĩnh của ứng dụng (dist/).
import { handleApi, type Env } from "./api";

interface AssetsEnv extends Env { ASSETS: { fetch(req: Request): Promise<Response> } }

export default {
  async fetch(req: Request, env: AssetsEnv): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      const res = await handleApi(req, env);
      res.headers.set("x-content-type-options", "nosniff");
      return res;
    }
    return env.ASSETS.fetch(req);
  },
};
