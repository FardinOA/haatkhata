import { requireBusiness } from "@/server/auth/session";
import { HttpError, route } from "@/server/http";
import { ensurePublicToken, getPublicTokens, revokePublicToken } from "@/server/public/invoice";
import { can } from "@/lib/domain";

const linkFor = (req: Request, token: string) => `${new URL(req.url).origin}/i/${token}`;

/** Current customer link, if any. */
export const GET = route(async (req: Request, ctx: RouteContext<"/api/orders/[id]/public-link">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  const token = (await getPublicTokens(a.businessId, [id]))[id];
  return { url: token ? linkFor(req, token) : null };
});

/** Create (or return) the customer link — FR-INV-04. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/orders/[id]/public-link">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  const token = await ensurePublicToken(a.businessId, id);
  if (!token) throw new HttpError(404, "Order not found. If you just created it, wait a moment for it to sync.");
  return { url: linkFor(req, token) };
});

/** Revoke: the old link stops working immediately (NFR-SEC-05). */
export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/orders/[id]/public-link">) => {
  const a = await requireBusiness();
  if (!can(a.role, "create_order") && !can(a.role, "settings")) throw new HttpError(403, "Your role can't revoke customer links");
  const { id } = await ctx.params;
  if (!(await revokePublicToken(a.businessId, id))) throw new HttpError(404, "Order not found");
  return { ok: true };
});
