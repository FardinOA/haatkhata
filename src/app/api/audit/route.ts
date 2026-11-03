import { desc } from "drizzle-orm";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { schema, withTenant } from "@/server/db";
import { route } from "@/server/http";

/** Sensitive actions, for the owner (FR-AUD-01). */
export const GET = route(async () => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const rows = await withTenant(a.businessId, (tx) => tx.select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(300));
  return { entries: rows };
});
