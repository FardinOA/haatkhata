import { revokeApiKey } from "@/server/api-keys";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { route } from "@/server/http";

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/api-keys/[id]">) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner"]);
  const { id } = await ctx.params;
  await revokeApiKey(a.businessId, id);
  return { ok: true };
});
