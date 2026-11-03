import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { withTenant } from "@/server/db";
import { webhookEndpoints } from "@/server/db/schema-platform";
import { json, route } from "@/server/http";
import { WEBHOOK_EVENTS } from "@/server/notify/webhooks";

export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/outbound-webhooks/[id]">) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const { id } = await ctx.params;
  const patch = await json(req, z.object({ active: z.boolean().optional(), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional() }));
  await withTenant(a.businessId, (tx) => tx.update(webhookEndpoints).set(patch).where(eq(webhookEndpoints.id, id)));
  return { ok: true };
});

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/outbound-webhooks/[id]">) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const { id } = await ctx.params;
  await withTenant(a.businessId, (tx) => tx.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)));
  return { ok: true };
});
