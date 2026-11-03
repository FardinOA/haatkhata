import { clientIp, route } from "@/server/http";
import { placeOrderRequest } from "@/server/public/storefront";

/** Anonymous order request from a public catalogue → a DRAFT order for the seller. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/storefront/[slug]/order">) => {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => null);
  return placeOrderRequest(slug, body, clientIp(req));
});
