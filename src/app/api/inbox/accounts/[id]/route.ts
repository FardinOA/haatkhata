import { eq } from "drizzle-orm";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { withTenant } from "@/server/db";
import { channelAccounts } from "@/server/db/schema-platform";
import { route } from "@/server/http";

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/inbox/accounts/[id]">) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner", "manager"]);
  const { id } = await ctx.params;
  await withTenant(a.businessId, (tx) => tx.delete(channelAccounts).where(eq(channelAccounts.id, id)));
  return { ok: true };
});
