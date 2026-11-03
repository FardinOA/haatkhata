import { businessDetail, requireSuperAdmin } from "@/server/admin/service";
import { getAuth } from "@/server/auth/session";
import { route } from "@/server/http";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/admin/businesses/[id]">) => {
  requireSuperAdmin(await getAuth());
  return businessDetail((await ctx.params).id);
});
