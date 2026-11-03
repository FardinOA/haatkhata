import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { channelAccounts } from "@/server/db/schema-platform";
import { HttpError, json, route } from "@/server/http";
import { ingest } from "@/server/messaging/meta";

/**
 * Sandbox: delivers a pretend customer message to a connected account that has
 * no live token, so the inbox can be tried before Meta approval.
 */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  const input = await json(req, z.object({ accountId: z.string(), from: z.string().trim().min(1).max(60), text: z.string().trim().min(1).max(2000), phone: z.string().max(20).optional() }));
  const [acc] = await withTenant(a.businessId, (tx) => tx.select().from(channelAccounts).where(and(eq(channelAccounts.id, input.accountId), isNull(channelAccounts.tokenEnc))));
  if (!acc) throw new HttpError(400, "Test messages work only on sandbox accounts (no access token).");
  const userId = acc.platform === "whatsapp" && input.phone ? `88${input.phone.replace(/\D/g, "").replace(/^88/, "")}` : `sandbox_${input.from.toLowerCase().replace(/\W+/g, "_")}`;
  const r = await ingest({ platform: acc.platform as "messenger", accountExternalId: acc.externalId, userExternalId: userId, name: input.from, text: input.text, externalId: `sbx_${randomBytes(8).toString("hex")}`, at: new Date(), attachments: [] });
  return r;
});
