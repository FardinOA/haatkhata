import { deleteCustomRole, roleInput, saveCustomRole } from "@/server/auth/roles";
import { requireBusiness } from "@/server/auth/session";
import { HttpError, json, route } from "@/server/http";

export const PUT = route(async (req: Request, ctx: RouteContext<"/api/roles/[id]">) => {
  const a = await requireBusiness();
  if (a.role !== "owner") throw new HttpError(403, "Only the owner can edit roles");
  const { id } = await ctx.params;
  return { key: await saveCustomRole(a.businessId, await json(req, roleInput), id) };
});

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/roles/[id]">) => {
  const a = await requireBusiness();
  if (a.role !== "owner") throw new HttpError(403, "Only the owner can delete roles");
  const { id } = await ctx.params;
  await deleteCustomRole(a.businessId, id);
  return { ok: true };
});
