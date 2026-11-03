import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { HttpError, json, route } from "@/server/http";
import { attachDesktop, eventStream, sendResult, tokenBelongsTo } from "@/server/scan-relay";

async function own(ctx: RouteContext<"/api/scan/[token]/desktop">) {
  const { token } = await ctx.params;
  const a = await requireBusiness();
  if (!tokenBelongsTo(token, a.businessId)) throw new HttpError(404, "This scanner link isn't for this shop");
  return token;
}

/** The order screen listens here for codes scanned on the phone. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/scan/[token]/desktop">) => {
  const token = await own(ctx);
  // `?check` answers without streaming: is this link still good for this shop?
  if (new URL(req.url).searchParams.has("check")) return { ok: true };
  return eventStream(req, (send) => attachDesktop(token, send));
});

/** …and answers each one, so the phone can show what happened. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/scan/[token]/desktop">) => {
  const token = await own(ctx);
  const r = await json(req, z.object({ id: z.string().min(1).max(40), ok: z.boolean(), title: z.string().max(200), detail: z.string().max(300).optional() }));
  sendResult(token, { type: "result", ...r });
});
