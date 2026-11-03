import { z } from "zod";
import { HttpError, json, route } from "@/server/http";
import { attachPhone, eventStream, sendCode, TOKEN_RE } from "@/server/scan-relay";

// The link is the phone's only credential: it can push codes to the paired
// order screen and hear back what happened — it never sees shop data.
async function valid(ctx: RouteContext<"/api/scan/[token]/phone">) {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) throw new HttpError(404, "This scanner link isn't valid");
  return token;
}

export const GET = route(async (req: Request, ctx: RouteContext<"/api/scan/[token]/phone">) => {
  const token = await valid(ctx);
  return eventStream(req, (send) => attachPhone(token, send));
});

export const POST = route(async (req: Request, ctx: RouteContext<"/api/scan/[token]/phone">) => {
  const token = await valid(ctx);
  const { id, code } = await json(req, z.object({ id: z.string().min(1).max(40), code: z.string().trim().min(1).max(120) }));
  return { delivered: sendCode(token, id, code) };
});
