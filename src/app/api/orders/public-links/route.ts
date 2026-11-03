import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { ensurePublicToken, getPublicTokens } from "@/server/public/invoice";

/** Customer links for several orders at once (invoice QR codes). `ensure` creates missing ones. */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  const { ids, ensure } = await json(req, z.object({ ids: z.array(z.string().max(80)).min(1).max(200), ensure: z.boolean().default(false) }));
  const tokens = await getPublicTokens(a.businessId, ids);
  if (ensure)
    for (const id of ids)
      if (!tokens[id]) {
        const t = await ensurePublicToken(a.businessId, id);
        if (t) tokens[id] = t;
      }
  const origin = new URL(req.url).origin;
  return { links: Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, `${origin}/i/${t}`])) };
});
