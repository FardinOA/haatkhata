import { requireBusiness } from "@/server/auth/session";
import { listCustomRoles, PERMISSIONS, roleInput, saveCustomRole } from "@/server/auth/roles";
import { hasFeature } from "@/server/billing/plans";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { HttpError, json, route } from "@/server/http";

/** Custom roles for this business — devices load these to evaluate permissions (FR-AUTH-06). */
export const GET = route(async () => {
  const a = await requireBusiness();
  const [b] = await db.select({ plan: schema.businesses.plan }).from(schema.businesses).where(eq(schema.businesses.id, a.businessId));
  return { roles: await listCustomRoles(a.businessId), permissions: PERMISSIONS, available: hasFeature(b.plan, "custom_roles") };
});

export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  if (a.role !== "owner") throw new HttpError(403, "Only the owner can create roles");
  const [b] = await db.select({ plan: schema.businesses.plan }).from(schema.businesses).where(eq(schema.businesses.id, a.businessId));
  if (!hasFeature(b.plan, "custom_roles")) throw new HttpError(402, "Custom roles are part of the Pro plan", "limit");
  const key = await saveCustomRole(a.businessId, await json(req, roleInput));
  return { key };
});
