import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { withTenant } from "@/server/db";
import { webhookDeliveries, webhookEndpoints } from "@/server/db/schema-platform";
import { HttpError, route } from "@/server/http";
import { processDueDeliveries } from "@/server/notify/webhooks";

/** Sends a signed `ping` to one endpoint right away. */
export const POST = route(async (_req: Request, ctx: RouteContext<"/api/outbound-webhooks/[id]/test">) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const { id } = await ctx.params;
  const [ep] = await withTenant(a.businessId, (tx) => tx.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id)));
  if (!ep) throw new HttpError(404, "Endpoint not found");
  const did = `whd_${randomBytes(9).toString("base64url")}`;
  await withTenant(a.businessId, (tx) => tx.insert(webhookDeliveries).values({ businessId: a.businessId, id: did, endpointId: id, event: "ping", payload: { id: `evt_${randomBytes(6).toString("hex")}`, event: "ping", created: new Date().toISOString(), data: { message: "Hello from BechaKena" } } }));
  await processDueDeliveries(5);
  const [d] = await withTenant(a.businessId, (tx) => tx.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, did)));
  return { delivery: d };
});
