import { requireAuth, revokeSession } from "@/server/auth/session";
import { route } from "@/server/http";

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/auth/sessions/[id]">) => {
  const a = await requireAuth();
  const { id } = await ctx.params;
  await revokeSession(a.user.id, id);
  return { ok: true };
});
