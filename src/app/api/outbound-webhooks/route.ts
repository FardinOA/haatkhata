import { randomBytes } from "node:crypto";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { withTenant } from "@/server/db";
import { webhookDeliveries, webhookEndpoints } from "@/server/db/schema-platform";
import { HttpError, json, route } from "@/server/http";
import { encrypt } from "@/server/messaging/crypto";
import { validateWebhookUrl, WEBHOOK_EVENTS } from "@/server/notify/webhooks";

export const GET = route(async () => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  return withTenant(a.businessId, async (tx) => ({
    endpoints: await tx.select({ id: webhookEndpoints.id, url: webhookEndpoints.url, events: webhookEndpoints.events, active: webhookEndpoints.active, createdAt: webhookEndpoints.createdAt }).from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt)),
    deliveries: await tx.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(40),
    events: WEBHOOK_EVENTS,
  }));
});

/** Adds an endpoint. Its signing secret is returned once. */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const input = await json(req, z.object({ url: z.string().trim().max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1) }));
  const bad = validateWebhookUrl(input.url);
  if (bad) throw new HttpError(400, bad);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const id = `we_${randomBytes(8).toString("base64url")}`;
  await withTenant(a.businessId, (tx) => tx.insert(webhookEndpoints).values({ businessId: a.businessId, id, url: input.url, events: input.events, secretEnc: encrypt(secret) }));
  return { id, secret };
});
