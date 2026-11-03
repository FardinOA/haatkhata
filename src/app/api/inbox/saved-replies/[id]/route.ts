import { eq } from "drizzle-orm";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { savedReplies } from "@/server/db/schema-platform";
import { route } from "@/server/http";

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/inbox/saved-replies/[id]">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  await withTenant(a.businessId, (tx) => tx.delete(savedReplies).where(eq(savedReplies.id, id)));
  return { ok: true };
});
