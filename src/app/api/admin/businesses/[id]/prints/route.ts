import { z } from "zod";
import { requireSuperAdmin, resetPrints } from "@/server/admin/service";
import { getAdminAuth } from "@/server/auth/session";
import { json, route } from "@/server/http";

/** Give a shop its trial prints back, always with a reason (FR-ADM-01). */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/admin/businesses/[id]/prints">) => {
  const a = await getAdminAuth();
  requireSuperAdmin(a);
  const { reason } = await json(req, z.object({ reason: z.string().trim().min(5).max(300) }));
  return resetPrints(a.user.id, (await ctx.params).id, reason);
});
