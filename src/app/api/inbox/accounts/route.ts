import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { withTenant } from "@/server/db";
import { channelAccounts } from "@/server/db/schema-platform";
import { HttpError, json, route } from "@/server/http";
import { encrypt } from "@/server/messaging/crypto";

export const GET = route(async () => {
  const a = await requireBusiness();
  const rows = await withTenant(a.businessId, (tx) => tx.select().from(channelAccounts));
  return { accounts: rows.map(({ tokenEnc, ...r }) => ({ ...r, connected: !!tokenEnc })) };
});

/** Connect a Facebook Page, Instagram account or WhatsApp number. The token is encrypted at rest. */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner", "manager"]);
  const input = await json(req, z.object({ platform: z.enum(["messenger", "instagram", "whatsapp"]), externalId: z.string().trim().min(3).max(64), name: z.string().trim().min(1).max(80), accessToken: z.string().trim().max(1000).optional() }));
  const id = `ch_${randomBytes(8).toString("base64url")}`;
  try {
    await withTenant(a.businessId, (tx) => tx.insert(channelAccounts).values({ businessId: a.businessId, id, platform: input.platform, externalId: input.externalId, name: input.name, tokenEnc: input.accessToken ? encrypt(input.accessToken) : null }));
  } catch {
    throw new HttpError(409, "That page or number is already connected to a shop.");
  }
  return { id };
});
