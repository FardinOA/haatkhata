import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { pushSubscriptions } from "@/server/db/schema-platform";
import { json, route } from "@/server/http";

const sub = z.object({ endpoint: z.string().url().max(800), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  const s = await json(req, sub);
  await withTenant(a.businessId, (tx) =>
    tx
      .insert(pushSubscriptions)
      .values({ businessId: a.businessId, id: `ps_${randomBytes(8).toString("base64url")}`, userId: a.user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) })
      .onConflictDoUpdate({ target: [pushSubscriptions.businessId, pushSubscriptions.endpoint], set: { userId: a.user.id, p256dh: s.keys.p256dh, auth: s.keys.auth } }),
  );
  return { ok: true };
});

export const DELETE = route(async (req: Request) => {
  const a = await requireBusiness();
  const { endpoint } = await json(req, z.object({ endpoint: z.string() }));
  await withTenant(a.businessId, (tx) => tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, a.user.id))));
  return { ok: true };
});
