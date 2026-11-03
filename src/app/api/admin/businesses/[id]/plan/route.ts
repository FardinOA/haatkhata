import { z } from "zod";
import { overridePlan, requireSuperAdmin } from "@/server/admin/service";
import { getAdminAuth } from "@/server/auth/session";
import { json, route } from "@/server/http";

/** Plan override, always with a reason (FR-ADM-01). */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/admin/businesses/[id]/plan">) => {
  const a = await getAdminAuth();
  requireSuperAdmin(a);
  const { plan, days, reason } = await json(req, z.object({ plan: z.enum(["trial", "expired", "starter", "business", "pro"]), days: z.number().int().min(1).max(3650), reason: z.string().trim().min(5).max(300) }));
  await overridePlan(a.user.id, (await ctx.params).id, plan, days, reason);
  return { ok: true };
});
